import type { BattleTrace } from '../sim/engine';
import { h, uniqueId } from './dom';
import { formatDuration } from './format';
import { t, type MsgKey } from './i18n';
import { ZOOM_AUTO, easeCamera, targetCamera, type Camera } from './replay/camera';
import { StagePainter, makeViewport } from './replay/draw';
import { ReplayLegend } from './replay/legend';
import { prepare, type Prepared } from './replay/prepare';
import { readReplayTheme, type ReplayTheme } from './replay/theme';
import { World } from './replay/world';

export const SPEEDS = [1, 2, 4, 8, 16] as const;
const DEFAULT_SPEED = 2;
/** 0 = auto (follow the fight), 1 = whole arena, n > 1 = n× on the T-Rex centroid. */
const ZOOMS: readonly { value: number; key: MsgKey }[] = [
  { value: ZOOM_AUTO, key: 'replay.zoomAuto' },
  { value: 1, key: 'replay.zoomFit' },
  { value: 2, key: 'replay.zoom2' },
  { value: 4, key: 'replay.zoom4' },
];
/**
 * Backing-store density cap. Above DENSE_AGENTS glyphs the cap drops to 2: CPU raster cost grows
 * about 1.4× from DPR 2 to 3 (docs/research/ANIMATION.md §3.8).
 */
const DPR_CAP = 3;
const DPR_CAP_DENSE = 2;
const DENSE_AGENTS = 2000;

/**
 * Animated canvas replay of one battle trace, with play/pause, speed, zoom and scrubbing
 * (docs/REPLAY.md). States are event-exact; see replay/prepare.ts and replay/world.ts.
 */
export class ReplayView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedSel: HTMLSelectElement;
  private readonly zoomSel: HTMLSelectElement;
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly note: HTMLParagraphElement;
  private readonly legend = new ReplayLegend();
  private prep: Prepared | null = null;
  private world: World | null = null;
  private painter: StagePainter | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private time = 0;
  private playing = false;
  private speed: number = DEFAULT_SPEED;
  private zoom = ZOOM_AUTO;
  private cam: Camera | null = null;
  private readonly camTarget: Camera = { cx: 0, cy: 0, view: 1 };
  private raf = 0;
  private lastTs = 0;
  private visible = true;
  private theme: ReplayTheme | null = null;
  private legendDirty = true;
  private lod = false;
  private dprQuery: MediaQueryList | null = null;
  private readonly ro: ResizeObserver;
  private readonly io: IntersectionObserver;
  private readonly onVisibility = (): void => this.schedule();
  private readonly onScheme = (): void => {
    this.theme = null;
    this.legendDirty = true;
    this.draw();
  };
  private readonly onDpr = (): void => {
    this.watchDpr();
    this.legendDirty = true;
    this.draw();
  };

  constructor() {
    this.canvas = h('canvas', { class: 'replay-canvas', i18nAria: 'replay.canvasLabel' });
    this.canvas.setAttribute('role', 'img');
    this.playBtn = h('button', { class: 'btn btn-primary btn-small', attrs: { type: 'button' } });
    this.playBtn.addEventListener('click', () => this.toggle());

    const speedId = uniqueId('replay-speed');
    this.speedSel = h('select', { id: speedId });
    for (const s of SPEEDS)
      this.speedSel.append(h('option', { attrs: { value: String(s) }, text: `${s}×` }));
    this.speedSel.value = String(DEFAULT_SPEED);
    this.speedSel.addEventListener('change', () => {
      this.speed = Number(this.speedSel.value) || DEFAULT_SPEED;
    });

    const zoomId = uniqueId('replay-zoom');
    this.zoomSel = h('select', { id: zoomId });
    for (const z of ZOOMS) {
      this.zoomSel.append(h('option', { attrs: { value: String(z.value) }, i18n: z.key }));
    }
    this.zoomSel.value = String(this.zoom);
    this.zoomSel.addEventListener('change', () => {
      const z = Number(this.zoomSel.value);
      this.zoom = Number.isFinite(z) && z >= 0 ? z : ZOOM_AUTO;
      this.draw();
    });

    this.slider = h('input', {
      class: 'replay-slider',
      i18nAria: 'replay.scrub',
      attrs: { type: 'range', min: '0', max: '1', step: '0.1', value: '0' },
    });
    this.slider.addEventListener('input', () => {
      this.time = Number(this.slider.value) || 0;
      this.updateLabels();
      this.draw();
    });
    this.timeLabel = h('span', { class: 'replay-time', attrs: { 'aria-live': 'off' } });
    this.note = h('p', { class: 'replay-note is-empty' });

    this.el = h(
      'div',
      { class: 'replay' },
      h('div', { class: 'replay-stage' }, this.canvas),
      h(
        'div',
        { class: 'replay-controls' },
        this.playBtn,
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
        h('div', { class: 'replay-scrub' }, this.slider, this.timeLabel),
      ),
      this.legend.el,
      this.note,
    );

    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      this.schedule();
    });
    this.io.observe(this.canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.onScheme);
    this.watchDpr();
    this.updateLabels();
  }

  /** Show a new trace from the start. */
  load(trace: BattleTrace, autoplay = true): void {
    const prep = prepare(trace);
    this.prep = prep;
    this.world = new World(prep);
    this.painter = new StagePainter(prep);
    this.time = 0;
    this.cam = null;
    const end = this.duration();
    this.slider.max = String(end);
    this.slider.value = '0';
    this.playing = autoplay && end > 0;
    this.lastTs = 0;
    this.updateLabels();
    this.updateNote();
    this.draw();
    this.schedule();
  }

  clear(): void {
    this.prep = null;
    this.world = null;
    this.painter = null;
    this.playing = false;
    this.updateLabels();
    this.updateNote();
    this.draw();
  }

  /** Re-apply language-dependent labels that are not bound via data-i18n. */
  refresh(): void {
    this.updateLabels();
    this.updateNote();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.onScheme);
    this.dprQuery?.removeEventListener('change', this.onDpr);
  }

  /** Re-arm a listener for the next devicePixelRatio change (zoom, moving between screens). */
  private watchDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDpr);
    const dpr = globalThis.devicePixelRatio || 1;
    this.dprQuery = matchMedia(`(resolution: ${dpr}dppx)`);
    this.dprQuery.addEventListener('change', this.onDpr);
  }

  private duration(): number {
    return this.prep?.duration ?? 0;
  }

  private toggle(): void {
    if (!this.prep) return;
    if (!this.playing && this.time >= this.duration()) this.time = 0;
    this.playing = !this.playing;
    this.lastTs = 0;
    this.updateLabels();
    this.schedule();
  }

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
    let dt = 0;
    if (this.lastTs > 0) {
      dt = Math.min(0.25, (ts - this.lastTs) / 1000);
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
    this.schedule();
  }

  private updateLabels(): void {
    const key: MsgKey = this.playing ? 'replay.pause' : 'replay.play';
    this.playBtn.textContent = `${this.playing ? '❚❚' : '▶'} ${t(key)}`;
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
    this.playBtn.disabled = !this.prep;
    this.slider.disabled = !this.prep;
    this.timeLabel.textContent = this.prep
      ? `${formatDuration(this.time)} / ${formatDuration(this.duration())}`
      : '';
  }

  /** One reserved line under the legend: the LOD hint and the reduced-detail notice. */
  private updateNote(): void {
    const parts: string[] = [];
    if (this.prep && this.lod) parts.push(t('replay.lodNote'));
    if (this.prep?.reduced)
      parts.push(t('replay.reducedNote', { time: formatDuration(this.prep.completeTime) }));
    const text = parts.join(' ');
    if (this.note.textContent !== text) this.note.textContent = text;
    this.note.classList.toggle('is-empty', text === '');
  }

  private context(): CanvasRenderingContext2D | null {
    return (this.ctx ??= this.canvas.getContext('2d', { alpha: false }));
  }

  /** @param dt real seconds since the previous animation frame; 0 snaps the camera. */
  private draw(dt = 0): void {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const prep = this.prep;
    const screenDpr = globalThis.devicePixelRatio || 1;
    const cap = prep && prep.N + prep.M > DENSE_AGENTS ? DPR_CAP_DENSE : DPR_CAP;
    const dpr = Math.max(1, Math.min(cap, screenDpr));
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    const theme = (this.theme ??= readReplayTheme());
    if (this.legendDirty) {
      this.legend.draw(theme, Math.max(1, Math.min(DPR_CAP, screenDpr)));
      this.legendDirty = false;
    }
    const ctx = this.context();
    if (!ctx) return;
    const world = this.world;
    const painter = this.painter;
    if (!prep || !world || !painter || prep.trace.frames.length === 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = theme.surface;
      ctx.fillRect(0, 0, cssW, cssH);
      return;
    }

    world.update(this.time);
    const target = targetCamera(world, this.zoom, this.camTarget);
    if (!this.cam || dt === 0) this.cam = { cx: target.cx, cy: target.cy, view: target.view };
    else easeCamera(this.cam, target, dt);
    const cam = this.cam;
    painter.draw(
      ctx,
      world,
      makeViewport(cssW, cssH, dpr, cam.cx, cam.cy, cam.view),
      theme,
      this.speed,
      true,
    );
    if (painter.info.lod !== this.lod) {
      this.lod = painter.info.lod;
      this.updateNote();
    }
  }
}
