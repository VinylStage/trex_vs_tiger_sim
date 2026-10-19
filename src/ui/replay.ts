import { TigerState, type BattleTrace, type TraceFrame } from '../sim/engine';
import { readTheme, type Theme } from './charts';
import { h, uniqueId } from './dom';
import { formatDuration } from './format';
import { t, type MsgKey } from './i18n';

export const SPEEDS = [1, 2, 4, 8, 16] as const;
const DEFAULT_SPEED = 2;
/** 0 = auto (follow the fight), 1 = whole arena, n > 1 = n× on the T-Rex centroid. */
const ZOOMS: readonly { value: number; key: MsgKey }[] = [
  { value: 0, key: 'replay.zoomAuto' },
  { value: 1, key: 'replay.zoomFit' },
  { value: 2, key: 'replay.zoom2' },
  { value: 4, key: 'replay.zoom4' },
];
/** Body length drawn for a T-Rex (m); the triangle never gets smaller than MIN_TREX_PX. */
const TREX_LENGTH_M = 7;
const MIN_TREX_PX = 11;
const TIGER_RADIUS_M = 0.8;
const MIN_TIGER_PX = 2.2;
/** Auto camera: margin around the fighters and smallest view (m), easing rate (1/s). */
const AUTO_PAD_M = 25;
const AUTO_MIN_VIEW_M = 80;
const CAMERA_EASE = 3;

interface Camera {
  cx: number;
  cy: number;
  /** Side of the visible square in metres. */
  view: number;
}

type Rgb = [number, number, number];

function parseHex(color: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m || m[1] === undefined) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, f: number): string {
  const c = (i: 0 | 1 | 2): number => Math.round(a[i] + (b[i] - a[i]) * f);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * f;
}

/** Index k of the last frame with t ≤ time (frames are sorted by t). */
export function frameIndex(frames: readonly TraceFrame[], time: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((frames[mid] as TraceFrame).t <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Animated canvas replay of one battle trace, with play/pause, speed, zoom and scrubbing. */
export class ReplayView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedSel: HTMLSelectElement;
  private readonly zoomSel: HTMLSelectElement;
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private trace: BattleTrace | null = null;
  private time = 0;
  private playing = false;
  private speed: number = DEFAULT_SPEED;
  private zoom = 0;
  private cam: Camera | null = null;
  private raf = 0;
  private lastTs = 0;
  private visible = true;
  private theme: Theme | null = null;
  private readonly ro: ResizeObserver;
  private readonly io: IntersectionObserver;
  private readonly onVisibility = (): void => this.schedule();

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
      this.zoom = Number.isFinite(z) && z >= 0 ? z : 0;
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

    const legendItem = (cls: string, key: MsgKey): HTMLElement =>
      h(
        'li',
        {},
        h('span', { class: `swatch ${cls}`, attrs: { 'aria-hidden': 'true' } }),
        h('span', { i18n: key }),
      );

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
      h(
        'ul',
        { class: 'legend' },
        legendItem('sw-trex', 'replay.legendTrex'),
        legendItem('sw-approach', 'state.approach'),
        legendItem('sw-latched', 'state.latched'),
        legendItem('sw-recover', 'state.recover'),
        legendItem('sw-routed', 'state.routed'),
        legendItem('sw-dead', 'state.dead'),
      ),
    );

    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      this.schedule();
    });
    this.io.observe(this.canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      this.theme = null;
      this.draw();
    });
    this.updateLabels();
  }

  /** Show a new trace from the start. */
  load(trace: BattleTrace, autoplay = true): void {
    this.trace = trace;
    this.time = 0;
    this.cam = null;
    const end = this.duration();
    this.slider.max = String(end);
    this.slider.value = '0';
    this.playing = autoplay && end > 0;
    this.lastTs = 0;
    this.updateLabels();
    this.draw();
    this.schedule();
  }

  clear(): void {
    this.trace = null;
    this.playing = false;
    this.updateLabels();
    this.draw();
  }

  /** Re-apply language-dependent labels that are not bound via data-i18n. */
  refresh(): void {
    this.updateLabels();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private duration(): number {
    const f = this.trace?.frames;
    return f && f.length > 0 ? (f[f.length - 1] as TraceFrame).t : 0;
  }

  private toggle(): void {
    if (!this.trace) return;
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
    this.playBtn.disabled = !this.trace;
    this.slider.disabled = !this.trace;
    this.timeLabel.textContent = this.trace
      ? `${formatDuration(this.time)} / ${formatDuration(this.duration())}`
      : '';
  }

  /** Camera the current zoom mode wants for the interpolated frame (a → b at fraction f). */
  private targetCamera(trace: BattleTrace, a: TraceFrame, b: TraceFrame, f: number): Camera {
    const L = trace.arenaSize;
    if (this.zoom === 1) return { cx: L / 2, cy: L / 2, view: L };
    const N = trace.trexCount;
    if (this.zoom > 1) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < N; i++) {
        if ((a.trex[i * 4 + 3] as number) <= 0) continue;
        sx += lerp(a.trex[i * 4] as number, b.trex[i * 4] as number, f);
        sy += lerp(a.trex[i * 4 + 1] as number, b.trex[i * 4 + 1] as number, f);
        n++;
      }
      return n > 0
        ? { cx: sx / n, cy: sy / n, view: L / this.zoom }
        : { cx: L / 2, cy: L / 2, view: L / this.zoom };
    }
    // Auto: bounding box of living T-Rex and tigers still in the fight.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (x: number, y: number): void => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    };
    for (let i = 0; i < N; i++) {
      if ((a.trex[i * 4 + 3] as number) <= 0) continue;
      add(
        lerp(a.trex[i * 4] as number, b.trex[i * 4] as number, f),
        lerp(a.trex[i * 4 + 1] as number, b.trex[i * 4 + 1] as number, f),
      );
    }
    for (let j = 0; j < trace.tigerCount; j++) {
      if ((a.tiger[j * 3 + 2] as number) >= TigerState.Routed) continue;
      add(a.tiger[j * 3] as number, a.tiger[j * 3 + 1] as number);
    }
    if (!Number.isFinite(x0)) return { cx: L / 2, cy: L / 2, view: L };
    const view = Math.min(
      L,
      Math.max(AUTO_MIN_VIEW_M, x1 - x0 + 2 * AUTO_PAD_M, y1 - y0 + 2 * AUTO_PAD_M),
    );
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, view };
  }

  /** @param dt real seconds since the previous animation frame; 0 snaps the camera. */
  private draw(dt = 0): void {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const theme = (this.theme ??= readTheme());
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, cssW, cssH);
    const trace = this.trace;
    if (!trace || trace.frames.length === 0) return;

    const frames = trace.frames;
    const k = frameIndex(frames, this.time);
    const a = frames[k] as TraceFrame;
    const b = (frames[k + 1] ?? a) as TraceFrame;
    const span = b.t - a.t;
    const f = span > 0 ? Math.min(1, Math.max(0, (this.time - a.t) / span)) : 0;
    const N = trace.trexCount;
    const M = trace.tigerCount;
    const L = trace.arenaSize;

    // Camera, eased while playing so the auto view does not jitter.
    const target = this.targetCamera(trace, a, b, f);
    const prev = this.cam;
    const ease = dt > 0 && prev ? 1 - Math.exp(-dt * CAMERA_EASE) : 1;
    const cam: Camera = prev
      ? {
          cx: lerp(prev.cx, target.cx, ease),
          cy: lerp(prev.cy, target.cy, ease),
          view: lerp(prev.view, target.view, ease),
        }
      : target;
    this.cam = cam;
    const pad = 8;
    const scale = (Math.min(cssW, cssH) - pad * 2) / cam.view;
    const ox = cssW / 2 - cam.cx * scale;
    const oy = cssH / 2 - cam.cy * scale;
    const X = (x: number): number => ox + x * scale;
    const Y = (y: number): number => oy + y * scale;

    // Arena.
    ctx.fillStyle = theme.grid;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(X(0), Y(0), L * scale, L * scale);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(X(0) + 0.5, Y(0) + 0.5, L * scale - 1, L * scale - 1);

    const tigerR = Math.max(MIN_TIGER_PX, TIGER_RADIUS_M * scale);

    // Dead tigers underneath everything.
    ctx.strokeStyle = theme.muted;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = 0; j < M; j++) {
      if ((a.tiger[j * 3 + 2] as number) !== TigerState.Dead) continue;
      const x = X(a.tiger[j * 3] as number);
      const y = Y(a.tiger[j * 3 + 1] as number);
      const r = tigerR * 0.9;
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // T-Rex: oriented triangles colored by remaining HP.
    const hpHigh = parseHex(theme.trex);
    const hpLow = parseHex(theme.hpLow);
    const len = Math.max(MIN_TREX_PX, TREX_LENGTH_M * scale);
    for (let i = 0; i < N; i++) {
      const hpA = a.trex[i * 4 + 3] as number;
      const hpB = b.trex[i * 4 + 3] as number;
      const dead = hpA <= 0;
      const x = X(lerp(a.trex[i * 4] as number, b.trex[i * 4] as number, f));
      const y = Y(lerp(a.trex[i * 4 + 1] as number, b.trex[i * 4 + 1] as number, f));
      const hd = lerpAngle(a.trex[i * 4 + 2] as number, b.trex[i * 4 + 2] as number, f);
      const hp = Math.max(0, dead ? 0 : lerp(hpA, Math.max(0, hpB), f));
      const cos = Math.cos(hd);
      const sin = Math.sin(hd);
      const half = len * 0.32;
      ctx.beginPath();
      ctx.moveTo(x + cos * len * 0.6, y + sin * len * 0.6);
      ctx.lineTo(x - cos * len * 0.4 - sin * half, y - sin * len * 0.4 + cos * half);
      ctx.lineTo(x - cos * len * 0.4 + sin * half, y - sin * len * 0.4 - cos * half);
      ctx.closePath();
      if (dead) {
        ctx.strokeStyle = theme.muted;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = hpHigh && hpLow ? mix(hpLow, hpHigh, Math.min(1, hp)) : theme.trex;
        ctx.fill();
        ctx.strokeStyle = theme.surface;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Living tigers on top (latched ones sit on the T-Rex body).
    const groups: Record<number, Path2D> = {};
    const pathFor = (s: number): Path2D => (groups[s] ??= new Path2D());
    for (let j = 0; j < M; j++) {
      const s = a.tiger[j * 3 + 2] as number;
      if (s === TigerState.Dead || s === TigerState.Left) continue;
      const sb = b.tiger[j * 3 + 2] as number;
      // Do not interpolate across teleports (e.g. latch snap) when the state changes.
      const g = sb === s ? f : 0;
      const x = X(lerp(a.tiger[j * 3] as number, b.tiger[j * 3] as number, g));
      const y = Y(lerp(a.tiger[j * 3 + 1] as number, b.tiger[j * 3 + 1] as number, g));
      const r = s === TigerState.Latched ? tigerR * 1.15 : tigerR;
      const p = pathFor(s);
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, Math.PI * 2);
    }
    const fillState = (s: number, color: string): void => {
      const p = groups[s];
      if (!p) return;
      ctx.fillStyle = color;
      ctx.fill(p);
    };
    fillState(TigerState.Routed, theme.draw);
    fillState(TigerState.Approach, theme.tiger);
    const rec = groups[TigerState.Recover];
    if (rec) {
      ctx.strokeStyle = theme.tiger;
      ctx.lineWidth = 1.25;
      ctx.stroke(rec);
    }
    fillState(TigerState.Latched, theme.latched);

    this.drawScaleBar(ctx, theme, scale, cssW, cssH);
  }

  private drawScaleBar(
    ctx: CanvasRenderingContext2D,
    theme: Theme,
    scale: number,
    w: number,
    hgt: number,
  ): void {
    const targetPx = Math.min(120, w * 0.25);
    const raw = targetPx / scale;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const meters =
      [1, 2, 5, 10]
        .map((m) => m * mag)
        .filter((m) => m <= raw)
        .pop() ?? mag;
    const px = meters * scale;
    const x = 14;
    const y = hgt - 14;
    ctx.strokeStyle = theme.fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.lineTo(x + px, y - 4);
    ctx.stroke();
    ctx.fillStyle = theme.fg;
    ctx.font = `500 11px ${theme.font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${meters} m`, x + px + 6, y + 1);
  }
}
