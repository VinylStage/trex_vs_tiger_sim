import { FreeState, type FreeTrace } from '../sim/free/engine';
import { h, uniqueId } from './dom';
import { formatDuration, formatFixed } from './format';
import { t } from './i18n';
import { makeViewport, type Viewport } from './replay/draw';
import { FreeWorld, freeLod, type FreeSideGlyph } from './replay/free-world';
import { GLYPH, heavyTriangle } from './replay/glyphs';
import { blend, readReplayTheme, type ReplayTheme } from './replay/theme';
import { DEFAULT_SPEED, SPEEDS } from './replay/timeline';

/*
 * Replay of one free-matchup battle (design §6, #50 item 3b). Abstract glyphs only, coloured by
 * side (A blue, B orange); shape follows size (triangles for large animals, dots for small
 * ones); a thin ring in the side colour marks an animal whose pack buff is active; grey = fled,
 * × = incapacitated. It keeps the classic replay's performance rules (docs/REPLAY.md §6, §11):
 * one batched path per paint, level-of-detail squares when dots get small, the rAF loop only
 * while playing and on screen, pause when the page is hidden, no autoplay under reduced motion,
 * backing-store density capped at 3 (2 above 2,000 animals), a reserved 1:1 stage.
 */

const DPR_CAP = 3;
const DPR_CAP_DENSE = 2;
const DENSE_AGENTS = 2000;
/** Camera easing rate (1/s): the view settles on the fight box within about a second. */
const CAMERA_RATE = 3;
/** Grid spacings (m): the finest one whose cells are ≥ 48 px is drawn. */
const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500] as const;
const GRID_MIN_PX = 48;
/** Buff ring: radius = glyph radius × RING_SCALE + RING_GAP px, line width 1 px. */
const RING_SCALE = 1.35;
const RING_GAP = 2.5;
/** Opacity of the buff ring over the arena: present but quieter than the glyph. */
const RING_ALPHA = 0.7;

type ViewMode = 'auto' | 'fit';

interface Paints {
  side: [string, string];
  ring: [string, string];
  out: string;
  dead: string;
}

function clockText(seconds: number): string {
  return seconds >= 0 && seconds < 59.95
    ? t('time.sec', { s: formatFixed(seconds, 1) })
    : formatDuration(seconds);
}

export class FreeReplayView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedSel: HTMLSelectElement;
  private readonly viewSel: HTMLSelectElement;
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly lodHint: HTMLParagraphElement;
  private readonly note: HTMLParagraphElement;
  private readonly legend: HTMLUListElement;
  private readonly labels: { el: HTMLElement; text: () => string }[] = [];
  private world: FreeWorld | null = null;
  private sideNames: [string, string] = ['', ''];
  private time = 0;
  private playing = false;
  private speed: number = DEFAULT_SPEED;
  private mode: ViewMode = 'auto';
  private cam = { cx: 0, cy: 0, size: 1 };
  private settled = true;
  private raf = 0;
  private lastTs = 0;
  private visible = true;
  private lod = false;
  private theme: ReplayTheme | null = null;
  private paints: Paints | null = null;
  private readonly motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly ro: ResizeObserver;
  private readonly io: IntersectionObserver;

  private readonly onVisibility = (): void => {
    if (document.hidden && this.playing) this.setPlaying(false);
    this.schedule();
  };
  private readonly onScheme = (): void => {
    this.theme = null;
    this.draw();
  };
  private readonly onMotion = (): void => {
    if (this.motionQuery.matches && this.playing) this.setPlaying(false);
    this.updateNote();
  };

  constructor() {
    const legendId = uniqueId('free-replay-legend');
    this.canvas = h('canvas', {
      class: 'replay-canvas',
      attrs: { role: 'img', 'aria-describedby': legendId },
    });
    this.canvas.addEventListener('click', () => {
      if (!this.world) return;
      this.toggle();
      this.playBtn.focus({ preventScroll: true });
    });
    this.playBtn = h('button', {
      class: 'btn btn-primary btn-small',
      attrs: { type: 'button', 'aria-keyshortcuts': 'Space K' },
    });
    this.playBtn.addEventListener('click', () => this.toggle());

    const speedId = uniqueId('free-replay-speed');
    this.speedSel = h('select', { id: speedId, attrs: { 'aria-keyshortcuts': '[ ]' } });
    for (const s of SPEEDS) {
      this.speedSel.append(h('option', { attrs: { value: String(s) }, text: `${s}×` }));
    }
    this.speedSel.value = String(DEFAULT_SPEED);
    this.speedSel.addEventListener('change', () => {
      this.speed = Number(this.speedSel.value) || DEFAULT_SPEED;
    });

    const viewId = uniqueId('free-replay-view');
    this.viewSel = h('select', { id: viewId, attrs: { 'aria-keyshortcuts': 'F' } });
    const autoOpt = h('option', { attrs: { value: 'auto' } });
    const fitOpt = h('option', { attrs: { value: 'fit' } });
    this.viewSel.append(autoOpt, fitOpt);
    this.viewSel.addEventListener('change', () => {
      this.setMode(this.viewSel.value === 'fit' ? 'fit' : 'auto');
    });

    this.slider = h('input', {
      class: 'replay-slider',
      attrs: {
        type: 'range',
        min: '0',
        max: '1',
        step: '0.1',
        value: '0',
        'aria-keyshortcuts': 'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End',
      },
    });
    this.slider.addEventListener('input', () => this.seek(Number(this.slider.value) || 0));
    this.timeLabel = h('span', { class: 'replay-time', attrs: { 'aria-hidden': 'true' } });
    this.lodHint = h('p', { class: 'replay-lod is-empty' });
    this.note = h('p', { class: 'replay-note is-empty' });
    this.legend = h('ul', { class: 'legend free-replay-legend', id: legendId });

    const speedLabel = h('span', {});
    const viewLabel = h('span', {});
    this.labels.push(
      { el: speedLabel, text: () => t('replay.speed') },
      { el: viewLabel, text: () => t('replay.zoom') },
      { el: autoOpt, text: () => t('replay.zoomAuto') },
      { el: fitOpt, text: () => t('replay.zoomFit') },
    );

    this.el = h(
      'div',
      { class: 'replay free-replay' },
      h('div', { class: 'replay-stage' }, this.canvas, this.lodHint),
      h(
        'div',
        { class: 'replay-controls' },
        h(
          'div',
          { class: 'replay-scrub' },
          h('div', { class: 'replay-slider-row' }, this.slider, this.timeLabel),
        ),
        h(
          'div',
          { class: 'replay-actions' },
          this.playBtn,
          h('label', { class: 'inline-field', attrs: { for: speedId } }, speedLabel, this.speedSel),
          h('label', { class: 'inline-field', attrs: { for: viewId } }, viewLabel, this.viewSel),
        ),
      ),
      this.legend,
      this.note,
    );
    this.el.addEventListener('keydown', (e) => this.onKey(e));

    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      this.schedule();
    });
    this.io.observe(this.canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.schemeQuery.addEventListener('change', this.onScheme);
    this.motionQuery.addEventListener('change', this.onMotion);
    this.relocalize();
  }

  /** Show a trace from the start; autoplays unless the viewer prefers reduced motion. */
  load(trace: FreeTrace, sideNames: [string, string], autoplay = true): void {
    const world = new FreeWorld(trace);
    this.world = world;
    this.sideNames = sideNames;
    this.time = 0;
    world.update(0);
    this.slider.max = String(world.duration);
    this.slider.value = '0';
    this.snapCamera();
    this.playing = autoplay && !this.motionQuery.matches && world.duration > 0;
    this.lastTs = 0;
    this.relocalize();
    this.draw();
    this.schedule();
  }

  clear(): void {
    this.world = null;
    this.setPlaying(false);
    this.relocalize();
    this.draw();
  }

  /** Re-render every text in the current language. */
  relocalize(): void {
    for (const l of this.labels) l.el.textContent = l.text();
    this.canvas.setAttribute('aria-label', t('free.replay.canvasLabel'));
    this.slider.setAttribute('aria-label', t('replay.scrub'));
    this.legend.setAttribute('aria-label', t('replay.legendLabel'));
    this.updatePlay();
    this.updateTime();
    this.updateNote();
    this.updateLodHint();
    this.buildLegend();
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentTime(): number {
    return this.time;
  }

  // ---------- playback ----------

  private toggle(): void {
    if (!this.world) return;
    if (!this.playing && this.time >= this.world.duration) this.seek(0);
    this.setPlaying(!this.playing);
  }

  private setPlaying(on: boolean): void {
    this.playing = on && this.world !== null;
    this.lastTs = 0;
    this.updatePlay();
    this.schedule();
  }

  private seek(time: number): void {
    const w = this.world;
    if (!w) return;
    this.time = Math.min(w.duration, Math.max(0, time));
    w.update(this.time);
    this.snapCamera();
    this.draw();
  }

  private setMode(mode: ViewMode): void {
    this.mode = mode;
    this.viewSel.value = mode;
    this.settled = false;
    this.schedule();
    this.draw();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.world || e.target instanceof HTMLSelectElement) return;
    const big = e.shiftKey ? 5 : 1;
    let handled = true;
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        if (e.target instanceof HTMLButtonElement) return;
        this.toggle();
        break;
      case 'ArrowLeft':
        this.seek(this.time - big);
        break;
      case 'ArrowRight':
        this.seek(this.time + big);
        break;
      case 'j':
      case 'J':
        this.seek(this.time - 5);
        break;
      case 'l':
      case 'L':
        this.seek(this.time + 5);
        break;
      case 'Home':
        this.seek(0);
        break;
      case 'End':
        this.seek(this.world.duration);
        break;
      case 'f':
      case 'F':
        this.setMode(this.mode === 'auto' ? 'fit' : 'auto');
        break;
      case '[':
      case ']': {
        const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
        const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + (e.key === ']' ? 1 : -1)))];
        this.speed = next ?? DEFAULT_SPEED;
        this.speedSel.value = String(this.speed);
        break;
      }
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  /** rAF only while something moves and the stage is on screen (docs/REPLAY.md §11). */
  private schedule(): void {
    const want =
      (this.playing || !this.settled) && this.visible && !document.hidden && this.world !== null;
    if (want && this.raf === 0) {
      this.raf = requestAnimationFrame((ts) => this.frame(ts));
    } else if (!want && this.raf !== 0) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastTs = 0;
    }
  }

  private frame(ts: number): void {
    this.raf = 0;
    const w = this.world;
    if (!w) return;
    const dt = this.lastTs === 0 ? 0 : Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.playing) {
      this.time = Math.min(w.duration, this.time + dt * this.speed);
      w.update(this.time);
      if (this.time >= w.duration) {
        this.playing = false;
        this.updatePlay();
      }
    }
    this.easeCamera(dt);
    this.draw();
    this.schedule();
  }

  // ---------- camera ----------

  private target(): { cx: number; cy: number; size: number } {
    const w = this.world;
    if (!w) return { cx: 0, cy: 0, size: 1 };
    if (this.mode === 'fit') return { cx: w.arena / 2, cy: w.arena / 2, size: w.arena };
    return w.fightBox();
  }

  private snapCamera(): void {
    this.cam = this.target();
    this.settled = true;
  }

  private easeCamera(dt: number): void {
    const goal = this.target();
    const k = 1 - Math.exp(-CAMERA_RATE * dt);
    // Size eases in log space, so zooming in and out feel the same.
    const ls = Math.log(this.cam.size) + (Math.log(goal.size) - Math.log(this.cam.size)) * k;
    this.cam = {
      cx: this.cam.cx + (goal.cx - this.cam.cx) * k,
      cy: this.cam.cy + (goal.cy - this.cam.cy) * k,
      size: Math.exp(ls),
    };
    const near =
      Math.abs(goal.cx - this.cam.cx) < 0.05 &&
      Math.abs(goal.cy - this.cam.cy) < 0.05 &&
      Math.abs(goal.size / this.cam.size - 1) < 0.002;
    if (near && !this.playing) this.cam = goal;
    this.settled = near;
  }

  // ---------- drawing ----------

  private ensureTheme(): { theme: ReplayTheme; paints: Paints } {
    if (!this.theme || !this.paints) {
      const theme = readReplayTheme();
      this.theme = theme;
      this.paints = {
        side: [theme.heavy, theme.pack],
        ring: [blend(theme.heavy, theme.arena, RING_ALPHA), blend(theme.pack, theme.arena, RING_ALPHA)],
        out: theme.out,
        dead: theme.deadMark,
      };
      this.buildLegend();
    }
    return { theme: this.theme, paints: this.paints };
  }

  private viewport(): { ctx: CanvasRenderingContext2D; vp: Viewport } | null {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const cap = (this.world?.n ?? 0) > DENSE_AGENTS ? DPR_CAP_DENSE : DPR_CAP;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, cap);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;
    return { ctx, vp: makeViewport(cssW, cssH, dpr, this.cam.cx, this.cam.cy, this.cam.size) };
  }

  private draw(): void {
    const v = this.viewport();
    if (!v) return;
    const { ctx, vp } = v;
    const { theme, paints } = this.ensureTheme();
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, vp.cssW, vp.cssH);
    const w = this.world;
    if (!w) {
      this.updateTime();
      return;
    }
    this.drawArena(ctx, vp, theme, w.arena);
    const lod = freeLod(vp.scale);
    if (lod !== this.lod) {
      this.lod = lod;
      this.updateLodHint();
    }
    for (const side of [0, 1] as const) this.drawSide(ctx, vp, paints, w, side, lod);
    this.updateTime();
  }

  private drawArena(
    ctx: CanvasRenderingContext2D,
    vp: Viewport,
    theme: ReplayTheme,
    arena: number,
  ): void {
    const x0 = vp.ox;
    const y0 = vp.oy;
    const size = arena * vp.scale;
    ctx.fillStyle = theme.arena;
    ctx.fillRect(x0, y0, size, size);
    const step = GRID_STEPS.find((s) => s * vp.scale >= GRID_MIN_PX) ?? arena;
    ctx.beginPath();
    for (let m = step; m < arena; m += step) {
      const p = m * vp.scale;
      ctx.moveTo(x0 + p, y0);
      ctx.lineTo(x0 + p, y0 + size);
      ctx.moveTo(x0, y0 + p);
      ctx.lineTo(x0 + size, y0 + p);
    }
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(x0, y0, size, size);
  }

  /**
   * One side in at most five batched paints: dead marks, fled (grey), fighting (side colour),
   * recovering (outline) and buff rings. Under LOD, dots become device-pixel-snapped squares
   * and rings are left out (the overlay hint says so).
   */
  private drawSide(
    ctx: CanvasRenderingContext2D,
    vp: Viewport,
    paints: Paints,
    w: FreeWorld,
    side: 0 | 1,
    lod: boolean,
  ): void {
    const g: FreeSideGlyph = w.glyphs[side];
    const from = side === 0 ? 0 : w.nA;
    const to = side === 0 ? w.nA : w.n;
    const tri = g.glyph === 'triangle';
    const len = Math.max(lod ? GLYPH.minHeavyPx * 0.6 : GLYPH.minHeavyPx, g.sizeM * vp.scale);
    const r = tri ? len * 0.42 : Math.max(GLYPH.minPackPx, g.sizeM * vp.scale);
    const sx = (i: number): number => vp.ox + (w.x[i] as number) * vp.scale;
    const sy = (i: number): number => vp.oy + (w.y[i] as number) * vp.scale;
    const color = paints.side[side];

    if (!tri && lod) {
      // Level of detail: squares grouped by paint, snapped to device pixels.
      const px = 1 / vp.dpr;
      const sq = Math.max(GLYPH.lodMinDevicePx * px, r * GLYPH.lodSide);
      const groups: [string, (st: number) => boolean, number][] = [
        [paints.dead, (st) => st === FreeState.Dead, 2 * px],
        [paints.out, (st) => st === FreeState.Routed, sq * GLYPH.lodRouted],
        [color, (st) => st < FreeState.Routed, sq],
      ];
      for (const [fill, match, s] of groups) {
        ctx.fillStyle = fill;
        for (let i = from; i < to; i++) {
          if (!match(w.state[i] as number)) continue;
          const x = Math.round((sx(i) - s / 2) * vp.dpr) / vp.dpr;
          const y = Math.round((sy(i) - s / 2) * vp.dpr) / vp.dpr;
          ctx.fillRect(x, y, s, s);
        }
      }
      return;
    }

    const dead = new Path2D();
    const out = new Path2D();
    const fight = new Path2D();
    const hollow = new Path2D();
    const rings = new Path2D();
    const cross = r * GLYPH.cross;
    for (let i = from; i < to; i++) {
      const st = w.state[i] as number;
      if (st === FreeState.Left) continue;
      const x = sx(i);
      const y = sy(i);
      if (st === FreeState.Dead) {
        dead.moveTo(x - cross, y - cross);
        dead.lineTo(x + cross, y + cross);
        dead.moveTo(x - cross, y + cross);
        dead.lineTo(x + cross, y - cross);
        continue;
      }
      const path = st === FreeState.Routed ? out : st === FreeState.Recover ? hollow : fight;
      if (tri) {
        const a = w.head[i] as number;
        heavyTriangle(path, x, y, Math.cos(a), Math.sin(a), len);
      } else {
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, Math.PI * 2);
      }
      if (!lod && (w.buffed[i] as number) === 1 && st < FreeState.Routed) {
        const rr = r * RING_SCALE + RING_GAP;
        rings.moveTo(x + rr, y);
        rings.arc(x, y, rr, 0, Math.PI * 2);
      }
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = paints.dead;
    ctx.stroke(dead);
    ctx.fillStyle = paints.out;
    ctx.fill(out);
    ctx.fillStyle = color;
    ctx.fill(fight);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke(hollow);
    ctx.strokeStyle = paints.ring[side];
    ctx.lineWidth = 1;
    ctx.stroke(rings);
  }

  // ---------- labels ----------

  private updatePlay(): void {
    this.playBtn.textContent = t(this.playing ? 'replay.pause' : 'replay.play');
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
    this.playBtn.disabled = this.world === null;
  }

  private updateTime(): void {
    const w = this.world;
    this.slider.value = String(this.time);
    this.slider.disabled = w === null;
    this.timeLabel.textContent = w ? `${clockText(this.time)} / ${clockText(w.duration)}` : '';
    if (w) {
      this.slider.setAttribute(
        'aria-valuetext',
        t('replay.valueText', { cur: clockText(this.time), total: clockText(w.duration) }),
      );
    }
  }

  private updateNote(): void {
    const reduced = this.motionQuery.matches && this.world !== null;
    this.note.textContent = reduced ? t('free.replay.reducedNote') : '';
    this.note.classList.toggle('is-empty', !reduced);
  }

  private updateLodHint(): void {
    const on = this.lod && this.world !== null && this.world.glyphs.some((g) => g.glyph === 'dot');
    this.lodHint.textContent = on ? t('free.replay.lodNote') : '';
    this.lodHint.classList.toggle('is-empty', !on);
  }

  /** Legend: one row per side (its glyph and name), then states, then the buff ring. */
  private buildLegend(): void {
    const w = this.world;
    const theme = this.theme ?? readReplayTheme();
    const items: { label: string; paint: (ctx: CanvasRenderingContext2D) => void }[] = [];
    const glyph = (
      ctx: CanvasRenderingContext2D,
      g: FreeSideGlyph,
      color: string,
      mode: 'fill' | 'stroke',
    ): void => {
      const p = new Path2D();
      if (g.glyph === 'triangle') heavyTriangle(p, 15, 9, 1, 0, 16);
      else p.arc(15, 9, 4.2, 0, Math.PI * 2);
      if (mode === 'fill') {
        ctx.fillStyle = color;
        ctx.fill(p);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke(p);
      }
    };
    const sides = w ? ([0, 1] as const) : ([] as const);
    for (const s of sides) {
      const g = (w as FreeWorld).glyphs[s];
      const color = s === 0 ? theme.heavy : theme.pack;
      items.push({ label: this.sideNames[s], paint: (ctx) => glyph(ctx, g, color, 'fill') });
    }
    if (w) {
      const g = w.glyphs[0];
      items.push(
        { label: t('state.recover'), paint: (ctx) => glyph(ctx, g, theme.heavy, 'stroke') },
        { label: t('state.routed'), paint: (ctx) => glyph(ctx, g, theme.out, 'fill') },
        {
          label: t('state.dead'),
          paint: (ctx) => {
            ctx.strokeStyle = theme.deadMark;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(11, 5);
            ctx.lineTo(19, 13);
            ctx.moveTo(11, 13);
            ctx.lineTo(19, 5);
            ctx.stroke();
          },
        },
      );
      if (w.anyBuff) {
        items.push({
          label: t('free.replay.ring'),
          paint: (ctx) => {
            ctx.fillStyle = theme.pack;
            ctx.beginPath();
            ctx.arc(15, 9, 3.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = blend(theme.pack, theme.arena, RING_ALPHA);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(15, 9, 3.4 * RING_SCALE + RING_GAP, 0, Math.PI * 2);
            ctx.stroke();
          },
        });
      }
    }
    const dpr = Math.min(globalThis.devicePixelRatio || 1, DPR_CAP);
    this.legend.replaceChildren(
      ...items.map((it) => {
        const c = h('canvas', { class: 'legend-glyph', attrs: { 'aria-hidden': 'true' } });
        c.width = Math.round(30 * dpr);
        c.height = Math.round(18 * dpr);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = theme.arena;
          ctx.fillRect(0, 0, 30, 18);
          it.paint(ctx);
        }
        return h('li', {}, c, h('span', { text: it.label }));
      }),
    );
  }
}
