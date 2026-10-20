import type { BattleTrace } from '../sim/engine';
import { h, uniqueId } from './dom';
import { formatDuration, formatInt } from './format';
import { t, type MsgKey } from './i18n';
import { CameraRig, CameraTarget, ZOOM_AUTO, ZOOM_FIT } from './replay/camera';
import { StagePainter, makeViewport, paintOverview, type DrawOptions } from './replay/draw';
import { ReplayLegend } from './replay/legend';
import { overviewCamera } from './replay/overview';
import { prepare, type Prepared } from './replay/prepare';
import { QualityGovernor, TIERS } from './replay/quality';
import { TimelineStrip } from './replay/strip';
import { readReplayTheme, type ReplayTheme } from './replay/theme';
import {
  DEFAULT_SPEED,
  SPEEDS,
  buildTimeline,
  contactSeekTime,
  keyAction,
  nextStop,
  prevStop,
  sceneCounts,
  stepSpeed,
  type ReplayAction,
  type SceneCounts,
  type TimelineModel,
} from './replay/timeline';
import { World } from './replay/world';

export { SPEEDS } from './replay/timeline';

/** View modes: 0 = auto (follow the fight), 1 = whole arena, n > 1 = n× on the T-Rex centroid. */
const ZOOMS: readonly { value: number; key: MsgKey }[] = [
  { value: ZOOM_AUTO, key: 'replay.zoomAuto' },
  { value: ZOOM_FIT, key: 'replay.zoomFit' },
  { value: 2, key: 'replay.zoom2' },
  { value: 4, key: 'replay.zoom4' },
];
/**
 * Backing-store density cap. Above DENSE_AGENTS agents the cap drops to 2: CPU raster cost grows
 * about 1.4× from DPR 2 to 3 (docs/research/ANIMATION.md §3.8). Adaptive quality may lower it.
 */
const DPR_CAP = 3;
const DPR_CAP_DENSE = 2;
const DENSE_AGENTS = 2000;
/** Debug overlay refresh (ms). */
const DEBUG_EVERY_MS = 250;

/** Keyboard shortcuts as listed in the help and announced through aria-keyshortcuts. */
const KEY_HELP: readonly { keys: readonly string[]; label: MsgKey }[] = [
  { keys: ['Space', 'K'], label: 'replay.keyPlay' },
  { keys: ['←', '→'], label: 'replay.keySeek' },
  { keys: ['Shift + ←', 'Shift + →', 'J', 'L'], label: 'replay.keySeekBig' },
  { keys: ['Page Up', 'Page Down'], label: 'replay.keyPage' },
  { keys: ['Home', 'End'], label: 'replay.keyEnds' },
  { keys: ['[', ']'], label: 'replay.keySpeed' },
  { keys: [',', '.'], label: 'replay.keyEvent' },
  { keys: ['C'], label: 'replay.keyContact' },
  { keys: ['F'], label: 'replay.keyView' },
];

/** Counters behind `?debug=fps` (also `window.__fx`), for flash-safety and fps checks. */
interface DebugStats {
  /** Current replay time (s). */
  time: number;
  frames: number;
  fps: number;
  jsP95: number;
  intervalP95: number;
  tier: number;
  effects: number;
  capped: number;
  wedges: number;
  fills: number;
  flashArea: number;
  maxFlashArea: number;
  /** Most fill flashes one T-Rex started within any 1 s of real time, since the last reset. */
  maxFillsPerSecond: number;
  fillStarts: number;
  trexTrails: number;
  tigerTrails: number;
  /** Duration of the last seek: world update + draw, synchronous (ms). */
  seekMs: number;
  maxSeekMs: number;
}

/**
 * Animated canvas replay of one battle trace (docs/REPLAY.md): play/pause, speeds, views, a
 * timeline strip with event markers, skip-to-contact and event jumps, keyboard shortcuts,
 * adaptive quality, and a static overview for viewers who prefer reduced motion.
 * States are event-exact; see replay/prepare.ts and replay/world.ts.
 */
export class ReplayView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly strip: TimelineStrip;
  private readonly playBtn: HTMLButtonElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly contactBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly speedSel: HTMLSelectElement;
  private readonly zoomSel: HTMLSelectElement;
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly note: HTMLParagraphElement;
  private readonly live: HTMLParagraphElement;
  private readonly legend = new ReplayLegend();
  private readonly debugEl: HTMLParagraphElement | null;
  private prep: Prepared | null = null;
  private world: World | null = null;
  private painter: StagePainter | null = null;
  private model: TimelineModel | null = null;
  private camTarget: CameraTarget | null = null;
  private readonly rig = new CameraRig();
  private readonly quality = new QualityGovernor();
  private readonly scene: SceneCounts = {
    approach: 0,
    latched: 0,
    recover: 0,
    out: 0,
    dead: 0,
    trexAlive: 0,
  };
  private time = 0;
  private playing = false;
  private speed: number = DEFAULT_SPEED;
  private zoom = ZOOM_AUTO;
  /** Reduced motion: no autoplay, no effects or trails, overview until the viewer acts. */
  private reducedMotion = false;
  private overview = false;
  private raf = 0;
  private lastTs = 0;
  private visible = true;
  private theme: ReplayTheme | null = null;
  private legendDirty = true;
  private lod = false;
  private lastValueSecond = -1;
  /** Exact backing-store size from ResizeObserver's device-pixel-content-box, when known. */
  private devW = 0;
  private devH = 0;
  private dprQuery: MediaQueryList | null = null;
  private readonly motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly ro: ResizeObserver;
  private readonly io: IntersectionObserver;
  private readonly drawOpt: DrawOptions = {
    speed: DEFAULT_SPEED,
    effects: true,
    fills: true,
    trexTrails: true,
    tigerTrails: true,
    forceLod: false,
  };
  private readonly debug: DebugStats | null;
  private debugAt = 0;
  private debugFrames = 0;
  private lastFillEvent: Int32Array = new Int32Array(0);
  private fillTimes: Float64Array = new Float64Array(0);

  private readonly onVisibility = (): void => {
    // Pause while the page is hidden (Page Visibility); the viewer resumes with Play.
    if (document.hidden && this.playing) this.setPlaying(false);
    this.schedule();
  };
  private readonly onScheme = (): void => {
    this.theme = null;
    this.legendDirty = true;
    this.strip.invalidate();
    this.draw();
  };
  private readonly onDpr = (): void => {
    this.watchDpr();
    this.legendDirty = true;
    this.draw();
  };
  private readonly onMotion = (): void => {
    this.reducedMotion = this.motionQuery.matches;
    if (this.reducedMotion && this.playing) this.setPlaying(false);
    this.applyMotionPrefs();
    this.draw();
  };

  constructor() {
    this.reducedMotion = this.motionQuery.matches;
    const debugOn = new URLSearchParams(location.search).get('debug') === 'fps';
    this.debug = debugOn
      ? {
          time: 0,
          frames: 0,
          fps: 0,
          jsP95: 0,
          intervalP95: 0,
          tier: 0,
          effects: 0,
          capped: 0,
          wedges: 0,
          fills: 0,
          flashArea: 0,
          maxFlashArea: 0,
          maxFillsPerSecond: 0,
          fillStarts: 0,
          trexTrails: 0,
          tigerTrails: 0,
          seekMs: 0,
          maxSeekMs: 0,
        }
      : null;
    if (this.debug) (globalThis as { __fx?: DebugStats }).__fx = this.debug;

    const legendId = uniqueId('replay-legend');
    this.legend.el.id = legendId;
    this.canvas = h('canvas', {
      class: 'replay-canvas',
      i18nAria: 'replay.canvasLabel',
      attrs: { role: 'img', 'aria-describedby': legendId },
    });
    this.canvas.addEventListener('click', () => {
      if (!this.prep) return;
      this.toggle();
      this.playBtn.focus({ preventScroll: true });
    });
    this.debugEl = debugOn
      ? h('p', { class: 'replay-debug', attrs: { 'aria-hidden': 'true' } })
      : null;

    this.playBtn = h('button', {
      class: 'btn btn-primary btn-small',
      attrs: { type: 'button', 'aria-keyshortcuts': 'Space K' },
    });
    this.playBtn.addEventListener('click', () => this.toggle());
    this.prevBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'replay.prevEvent',
      attrs: { type: 'button', 'aria-keyshortcuts': ',' },
    });
    this.prevBtn.addEventListener('click', () => this.jumpEvent(-1, false));
    this.contactBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'replay.skipContact',
      attrs: { type: 'button', 'aria-keyshortcuts': 'C' },
    });
    this.contactBtn.addEventListener('click', () => this.jumpContact(false));
    this.nextBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'replay.nextEvent',
      attrs: { type: 'button', 'aria-keyshortcuts': '.' },
    });
    this.nextBtn.addEventListener('click', () => this.jumpEvent(1, false));

    const speedId = uniqueId('replay-speed');
    this.speedSel = h('select', { id: speedId, attrs: { 'aria-keyshortcuts': '[ ]' } });
    for (const s of SPEEDS)
      this.speedSel.append(h('option', { attrs: { value: String(s) }, text: `${s}×` }));
    this.speedSel.value = String(DEFAULT_SPEED);
    this.speedSel.addEventListener('change', () => {
      this.setSpeed(Number(this.speedSel.value) || DEFAULT_SPEED, false);
    });

    const zoomId = uniqueId('replay-zoom');
    this.zoomSel = h('select', { id: zoomId, attrs: { 'aria-keyshortcuts': 'F' } });
    for (const z of ZOOMS) {
      this.zoomSel.append(h('option', { attrs: { value: String(z.value) }, i18n: z.key }));
    }
    this.zoomSel.addEventListener('change', () => {
      const z = Number(this.zoomSel.value);
      this.setZoom(Number.isFinite(z) && z >= 0 ? z : ZOOM_AUTO, false);
    });

    this.slider = h('input', {
      class: 'replay-slider',
      i18nAria: 'replay.scrub',
      attrs: {
        type: 'range',
        min: '0',
        max: '1',
        step: '0.1',
        value: '0',
        'aria-keyshortcuts':
          'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight PageUp PageDown Home End',
      },
    });
    this.slider.addEventListener('input', () => this.seek(Number(this.slider.value) || 0));
    this.timeLabel = h('span', { class: 'replay-time', attrs: { 'aria-hidden': 'true' } });
    this.strip = new TimelineStrip((time) => this.seek(time));
    this.note = h('p', { class: 'replay-note is-empty' });
    this.live = h('p', {
      class: 'visually-hidden',
      attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    });

    const keyList = h('dl', { class: 'replay-keys-list' });
    for (const item of KEY_HELP) {
      const dt = h('dt', {});
      item.keys.forEach((k, i) => {
        if (i > 0) dt.append(' ');
        dt.append(h('kbd', { text: k }));
      });
      keyList.append(h('div', {}, dt, h('dd', { i18n: item.label })));
    }

    this.el = h(
      'div',
      { class: 'replay' },
      h('div', { class: 'replay-stage' }, this.canvas, this.debugEl),
      h(
        'div',
        { class: 'replay-controls' },
        h(
          'div',
          { class: 'replay-scrub' },
          this.strip.el,
          h('div', { class: 'replay-slider-row' }, this.slider, this.timeLabel),
        ),
        h(
          'div',
          { class: 'replay-actions' },
          this.playBtn,
          this.prevBtn,
          this.contactBtn,
          this.nextBtn,
          h(
            'label',
            { class: 'inline-field', attrs: { for: speedId } },
            h('span', { i18n: 'replay.speed' }),
            this.speedSel,
          ),
          h(
            'label',
            { class: 'inline-field', attrs: { for: zoomId } },
            h('span', { i18n: 'replay.zoom' }),
            this.zoomSel,
          ),
        ),
      ),
      h('details', { class: 'replay-keys' }, h('summary', { i18n: 'replay.keysTitle' }), keyList),
      this.legend.el,
      this.note,
      this.live,
    );
    this.el.addEventListener('keydown', (e) => this.onKey(e));

    this.ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const box = e.devicePixelContentBoxSize?.[0];
        this.devW = box ? Math.round(box.inlineSize) : 0;
        this.devH = box ? Math.round(box.blockSize) : 0;
      }
      this.legendDirty = true;
      this.draw();
    });
    try {
      this.ro.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      this.ro.observe(this.canvas);
    }
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      this.schedule();
    });
    this.io.observe(this.canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.schemeQuery.addEventListener('change', this.onScheme);
    this.motionQuery.addEventListener('change', this.onMotion);
    this.watchDpr();
    this.applyMotionPrefs();
    this.updateLabels();
  }

  /**
   * Show a new trace from the start. Autoplays unless the viewer prefers reduced motion; then
   * a static overview is drawn and nothing animates until Play or a seek.
   */
  load(trace: BattleTrace, autoplay = true): void {
    const prep = prepare(trace);
    this.prep = prep;
    this.world = new World(prep);
    this.painter = new StagePainter(prep);
    this.model = buildTimeline(prep);
    this.camTarget = new CameraTarget(prep.N, prep.M);
    this.rig.reset();
    this.quality.reset();
    this.strip.setModel(this.model);
    this.lastFillEvent = new Int32Array(prep.N).fill(-1);
    this.fillTimes = new Float64Array(prep.N * 4).fill(-Infinity);
    this.time = 0;
    const end = this.duration();
    this.slider.max = String(end);
    this.slider.value = '0';
    this.overview = this.reducedMotion;
    this.playing = autoplay && !this.reducedMotion && end > 0;
    this.lastTs = 0;
    this.lastValueSecond = -1;
    this.updateLabels();
    this.updateNote();
    this.draw();
    this.updateScene();
    this.schedule();
  }

  clear(): void {
    this.prep = null;
    this.world = null;
    this.painter = null;
    this.model = null;
    this.camTarget = null;
    this.strip.setModel(null);
    this.playing = false;
    this.overview = false;
    this.updateLabels();
    this.updateNote();
    this.updateScene();
    this.draw();
  }

  /** Re-apply language-dependent labels that are not bound via data-i18n. */
  refresh(): void {
    this.lastValueSecond = -1;
    this.updateLabels();
    this.updateNote();
    this.updateScene();
    this.draw();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.schemeQuery.removeEventListener('change', this.onScheme);
    this.motionQuery.removeEventListener('change', this.onMotion);
    this.dprQuery?.removeEventListener('change', this.onDpr);
  }

  /** Re-arm a listener for the next devicePixelRatio change (zoom, moving between screens). */
  private watchDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDpr);
    const dpr = globalThis.devicePixelRatio || 1;
    this.dprQuery = matchMedia(`(resolution: ${dpr}dppx)`);
    this.dprQuery.addEventListener('change', this.onDpr);
  }

  /** Reduced motion: whole-arena view by default, no effects or trails. */
  private applyMotionPrefs(): void {
    const rm = this.reducedMotion;
    this.drawOpt.effects = !rm;
    if (rm && this.zoom === ZOOM_AUTO) this.setZoom(ZOOM_FIT, false);
    if (!rm && this.overview) this.overview = false;
    this.updateNote();
  }

  private duration(): number {
    return this.prep?.duration ?? 0;
  }

  // ---------- actions ----------

  private setPlaying(on: boolean): void {
    if (!this.prep) return;
    if (on && this.time >= this.duration()) this.time = 0;
    if (on) this.overview = false;
    this.playing = on && this.duration() > 0;
    this.lastTs = 0;
    this.quality.reset();
    this.updateLabels();
    this.updateNote();
    if (!this.playing) this.updateScene();
    this.schedule();
  }

  private toggle(): void {
    this.setPlaying(!this.playing);
  }

  /** Jump to `time` without re-simulating: one world update and one draw (P5). */
  private seek(time: number): void {
    if (!this.prep) return;
    const t0 = performance.now();
    this.time = Math.min(this.duration(), Math.max(0, time));
    this.overview = false;
    this.lastTs = 0;
    this.quality.reset();
    this.lastFillEvent.fill(-1);
    this.slider.value = String(this.time);
    this.draw();
    const ms = performance.now() - t0;
    if (this.debug) {
      this.debug.time = this.time;
      this.debug.seekMs = ms;
      this.debug.maxSeekMs = Math.max(this.debug.maxSeekMs, ms);
    }
    this.updateLabels();
    this.updateNote();
    if (!this.playing) this.updateScene();
  }

  private setSpeed(speed: number, announce: boolean): void {
    this.speed = speed;
    this.drawOpt.speed = speed;
    if (this.speedSel.value !== String(speed)) this.speedSel.value = String(speed);
    if (announce) this.announce(t('replay.announceSpeed', { speed: `${speed}×` }));
  }

  private setZoom(zoom: number, announce: boolean): void {
    this.zoom = zoom;
    if (this.zoomSel.value !== String(zoom)) this.zoomSel.value = String(zoom);
    if (!this.playing) this.draw();
    if (announce) {
      const key = ZOOMS.find((z) => z.value === zoom)?.key ?? 'replay.zoomAuto';
      this.announce(t('replay.announceView', { view: t(key) }));
    }
  }

  private jumpContact(announce: boolean): void {
    if (!this.prep) return;
    const to = contactSeekTime(this.prep);
    if (to === null) return;
    this.seek(to);
    if (announce) this.announce(this.sceneText());
  }

  private jumpEvent(dir: 1 | -1, announce: boolean): void {
    const m = this.model;
    if (!m) return;
    const to = dir > 0 ? nextStop(m.stops, this.time) : prevStop(m.stops, this.time);
    if (to === null) {
      if (announce) this.announce(t('replay.noMoreEvents'));
      return;
    }
    this.seek(to);
    if (announce) this.announce(this.sceneText());
  }

  private run(a: ReplayAction): void {
    const end = this.duration();
    switch (a.kind) {
      case 'toggle':
        this.toggle();
        this.announce(t(this.playing ? 'replay.play' : 'replay.pause'));
        return;
      case 'seekBy':
        this.seek(this.time + a.seconds);
        return;
      case 'seekFrac':
        this.seek(this.time + a.frac * end);
        return;
      case 'seekTo':
        this.seek(a.to === 'start' ? 0 : end);
        return;
      case 'speed':
        this.setSpeed(stepSpeed(this.speed, a.dir), true);
        return;
      case 'event':
        this.jumpEvent(a.dir, true);
        return;
      case 'contact':
        this.jumpContact(true);
        return;
      case 'view':
        this.setZoom(this.zoom === ZOOM_FIT ? ZOOM_AUTO : ZOOM_FIT, true);
        return;
    }
  }

  /** Shortcuts work while focus is anywhere inside the replay, except where a key is native. */
  private onKey(e: KeyboardEvent): void {
    if (!this.prep || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'SELECT' || tag === 'SUMMARY') return;
    if (tag === 'BUTTON' && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) return;
    const action = keyAction(e.code, e.key, e.shiftKey);
    if (!action) return;
    e.preventDefault();
    this.run(action);
  }

  private announce(text: string): void {
    // Clear first so repeating the same message is announced again.
    this.live.textContent = '';
    this.live.textContent = text;
  }

  // ---------- loop ----------

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.playing || !this.visible || document.hidden) {
      this.lastTs = 0;
      return;
    }
    this.raf = requestAnimationFrame((ts) => this.tick(ts));
  }

  private tick(ts: number): void {
    this.raf = 0;
    const t0 = performance.now();
    let dt = 0;
    const interval = this.lastTs > 0 ? ts - this.lastTs : 0;
    if (interval > 0) {
      dt = Math.min(0.25, interval / 1000);
      this.time += dt * this.speed;
      const end = this.duration();
      if (this.time >= end) {
        this.time = end;
        this.playing = false;
      }
    }
    this.lastTs = ts;
    this.slider.value = String(this.time);
    this.updateLabels();
    this.draw(dt);
    const js = performance.now() - t0;
    if (this.quality.push(ts, interval, js)) {
      this.legendDirty = true;
      this.updateNote();
    }
    if (this.debug) this.updateDebug(ts, js);
    if (!this.playing) this.updateScene();
    this.schedule();
  }

  // ---------- labels ----------

  private updateLabels(): void {
    const prep = this.prep;
    const key: MsgKey = this.playing ? 'replay.pause' : 'replay.play';
    const text = `${this.playing ? '❚❚' : '▶'} ${t(key)}`;
    if (this.playBtn.textContent !== text) this.playBtn.textContent = text;
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
    this.playBtn.disabled = !prep;
    this.slider.disabled = !prep;
    this.speedSel.disabled = !prep;
    this.zoomSel.disabled = !prep;
    const m = this.model;
    const prevOff = !m || prevStop(m.stops, this.time) === null;
    const nextOff = !m || nextStop(m.stops, this.time) === null;
    const contactOff = !prep || contactSeekTime(prep) === null;
    if (this.prevBtn.disabled !== prevOff) this.prevBtn.disabled = prevOff;
    if (this.nextBtn.disabled !== nextOff) this.nextBtn.disabled = nextOff;
    if (this.contactBtn.disabled !== contactOff) this.contactBtn.disabled = contactOff;
    const cur = formatDuration(this.time);
    const total = formatDuration(this.duration());
    this.timeLabel.textContent = prep ? `${cur} / ${total}` : '';
    // aria-valuetext: every change while paused, once per whole second while playing.
    const sec = Math.floor(this.time);
    if (!this.playing || sec !== this.lastValueSecond) {
      this.lastValueSecond = sec;
      if (prep) this.slider.setAttribute('aria-valuetext', t('replay.valueText', { cur, total }));
      else this.slider.removeAttribute('aria-valuetext');
    }
  }

  private sceneText(): string {
    const w = this.world;
    const prep = this.prep;
    if (!w || !prep) return t('replay.canvasLabel');
    w.update(this.time);
    const s = sceneCounts(w, this.scene);
    return t('replay.scene', {
      time: formatDuration(this.time),
      alive: formatInt(s.trexAlive),
      total: formatInt(prep.N),
      approach: formatInt(s.approach),
      latched: formatInt(s.latched),
      recover: formatInt(s.recover),
      out: formatInt(s.out),
      dead: formatInt(s.dead),
    });
  }

  /** Canvas label summarising the scene; updated on load, pause and seek, not during playback. */
  private updateScene(): void {
    const text = this.prep
      ? this.overview
        ? t('replay.overviewLabel')
        : this.sceneText()
      : t('replay.canvasLabel');
    this.canvas.setAttribute('aria-label', text);
  }

  /** One reserved two-line note under the legend: overview, LOD and reduced-detail notices. */
  private updateNote(): void {
    const parts: string[] = [];
    if (this.prep && this.overview) parts.push(t('replay.overviewNote'));
    else if (this.prep && this.lod) parts.push(t('replay.lodNote'));
    if (this.prep?.reduced)
      parts.push(t('replay.reducedNote', { time: formatDuration(this.prep.completeTime) }));
    const text = parts.join(' ');
    if (this.note.textContent !== text) this.note.textContent = text;
    this.note.classList.toggle('is-empty', text === '');
  }

  // ---------- drawing ----------

  /** Backing-store density: screen DPR capped at 3 (2 for dense battles or low quality tiers). */
  private densityCap(): number {
    const prep = this.prep;
    const dense = prep !== null && prep.N + prep.M > DENSE_AGENTS;
    const tier = TIERS[this.quality.tier] ?? TIERS[0];
    return Math.min(dense ? DPR_CAP_DENSE : DPR_CAP, tier?.dprCap ?? DPR_CAP);
  }

  /** @param dt real seconds since the previous animation frame; 0 snaps the camera. */
  private draw(dt = 0): void {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const prep = this.prep;
    const screenDpr = globalThis.devicePixelRatio || 1;
    const dpr = Math.max(1, Math.min(this.densityCap(), screenDpr));
    // Exact device pixels when the observer reports them and the density is not capped. They only
    // refine the rounding: a report far from css × dpr (seen under mobile emulation, and stale
    // between a resize and its observer callback) is ignored.
    const rw = Math.round(cssW * dpr);
    const rh = Math.round(cssH * dpr);
    const exact =
      dpr === screenDpr && Math.abs(this.devW - rw) <= 2 && Math.abs(this.devH - rh) <= 2;
    const bw = exact ? this.devW : rw;
    const bh = exact ? this.devH : rh;
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    const theme = (this.theme ??= readReplayTheme());
    const uiDpr = Math.max(1, Math.min(DPR_CAP, screenDpr));
    if (this.legendDirty) {
      this.legend.draw(theme, uiDpr);
      this.legendDirty = false;
    }
    this.strip.draw(this.time, theme, uiDpr);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const world = this.world;
    const painter = this.painter;
    if (!prep || !world || !painter || !this.camTarget || prep.trace.frames.length === 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = theme.surface;
      ctx.fillRect(0, 0, cssW, cssH);
      return;
    }
    if (this.overview) {
      const cam = overviewCamera(prep);
      paintOverview(ctx, prep, makeViewport(cssW, cssH, dpr, cam.cx, cam.cy, cam.view), theme);
      return;
    }

    world.update(this.time);
    const target = this.camTarget.target(world, this.zoom);
    this.rig.step(target, dt);
    const tier = TIERS[this.quality.tier] ?? TIERS[0];
    const o = this.drawOpt;
    const motion = !this.reducedMotion;
    o.effects = motion;
    o.fills = motion && (tier?.fills ?? true);
    o.trexTrails = motion && (tier?.trexTrails ?? true);
    o.tigerTrails = motion && (tier?.tigerTrails ?? true);
    o.forceLod = tier?.forceLod ?? false;
    o.onFill = this.debug ? this.onFill : undefined;
    painter.draw(
      ctx,
      world,
      makeViewport(cssW, cssH, dpr, this.rig.cx, this.rig.cy, this.rig.view),
      theme,
      o,
    );
    if (painter.info.lod !== this.lod) {
      this.lod = painter.info.lod;
      this.updateNote();
    }
  }

  // ---------- debug (?debug=fps) ----------

  /** Record fill-flash starts per T-Rex (real time) to check ≤ 3 per second. */
  private readonly onFill = (event: number, trex: number): void => {
    const d = this.debug;
    if (!d || this.lastFillEvent[trex] === event) return;
    this.lastFillEvent[trex] = event;
    d.fillStarts++;
    const now = performance.now();
    const o = trex * 4;
    const ft = this.fillTimes;
    ft.copyWithin(o, o + 1, o + 4);
    ft[o + 3] = now;
    let n = 0;
    for (let k = 0; k < 4; k++) if (now - (ft[o + k] as number) < 1000) n++;
    d.maxFillsPerSecond = Math.max(d.maxFillsPerSecond, n);
  };

  private updateDebug(ts: number, js: number): void {
    const d = this.debug;
    const info = this.painter?.info;
    if (!d || !info) return;
    d.time = this.time;
    d.frames++;
    this.debugFrames++;
    d.tier = this.quality.tier;
    d.jsP95 = this.quality.p95Js;
    d.intervalP95 = this.quality.p95Interval;
    d.effects = info.fx.effects;
    d.capped = info.fx.capped;
    d.wedges = info.fx.wedges;
    d.fills = info.fx.fills;
    d.flashArea = Math.round(info.fx.flashArea);
    d.maxFlashArea = Math.max(d.maxFlashArea, d.flashArea);
    d.trexTrails = info.fx.trexTrails;
    d.tigerTrails = info.fx.tigerTrails;
    if (ts - this.debugAt < DEBUG_EVERY_MS) return;
    if (this.debugAt > 0) d.fps = (this.debugFrames * 1000) / (ts - this.debugAt);
    this.debugAt = ts;
    this.debugFrames = 0;
    if (this.debugEl) {
      this.debugEl.textContent =
        `${d.fps.toFixed(1)} fps · JS p95 ${d.jsP95.toFixed(1)} ms · T${d.tier} · ` +
        `fx ${d.effects} (+${d.capped}) · fills ${d.fills} · ${d.flashArea} px² · ` +
        `max ${d.maxFillsPerSecond}/s · ${js.toFixed(1)} ms`;
    }
  }
}
