import { h } from '../dom';
import type { ReplayTheme } from './theme';
import { CH, CHANNELS, type TimelineModel } from './timeline';

/** Strip layout (CSS px): a marker row on top, the stacked counts below. Height is CSS. */
const MARKER_ROW = 9;
const PAD_BOTTOM = 1;

/**
 * Timeline strip above the slider (docs/REPLAY.md §8): stacked pack animal counts by state, the living
 * Heavy line, and event markers. The static part is rendered once into an offscreen bitmap per
 * size and theme; each frame only blits it and draws the playhead. Pointer drag seeks. It is
 * hidden from assistive technology: the native slider below is the accessible control.
 */
export class TimelineStrip {
  readonly el: HTMLCanvasElement;
  private model: TimelineModel | null = null;
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private ctx: CanvasRenderingContext2D | null = null;
  private dragging = false;

  constructor(private readonly onSeek: (time: number) => void) {
    this.el = h('canvas', { class: 'replay-timeline', attrs: { 'aria-hidden': 'true' } });
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.model || e.button !== 0) return;
      this.dragging = true;
      this.el.setPointerCapture(e.pointerId);
      this.seekFrom(e);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (this.dragging) this.seekFrom(e);
    });
    const stop = (e: PointerEvent): void => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    };
    this.el.addEventListener('pointerup', stop);
    this.el.addEventListener('pointercancel', stop);
  }

  setModel(model: TimelineModel | null): void {
    this.model = model;
    this.cache = null;
  }

  /** Re-render the static part on the next draw (theme change). */
  invalidate(): void {
    this.cache = null;
  }

  private seekFrom(e: PointerEvent): void {
    const m = this.model;
    if (!m) return;
    const r = this.el.getBoundingClientRect();
    if (r.width <= 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    this.onSeek(f * m.duration);
  }

  draw(time: number, theme: ReplayTheme, dpr: number): void {
    const c = this.el;
    const cssW = c.clientWidth;
    const cssH = c.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const ctx = (this.ctx ??= c.getContext('2d', { alpha: false }));
    if (!ctx) return;
    const key = `${bw}x${bh}`;
    if (!this.cache || this.cacheKey !== key) {
      this.cache = this.render(bw, bh, cssW, cssH, dpr, theme);
      this.cacheKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.cache, 0, 0);
    const m = this.model;
    if (!m || m.duration <= 0) return;
    const x = Math.round((time / m.duration) * (cssW - 2) * dpr + dpr) / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.fg;
    ctx.fillRect(x - 1, 0, 2, cssH);
  }

  /** The static strip: surface, stacked counts, heavy line, markers. */
  private render(
    bw: number,
    bh: number,
    cssW: number,
    cssH: number,
    dpr: number,
    theme: ReplayTheme,
  ): HTMLCanvasElement {
    const off = document.createElement('canvas');
    off.width = bw;
    off.height = bh;
    const g = off.getContext('2d', { alpha: false });
    if (!g) return off;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = theme.arena;
    g.fillRect(0, 0, cssW, cssH);
    const m = this.model;
    if (!m || m.duration <= 0) return off;
    const top = MARKER_ROW;
    const H = cssH - top - PAD_BOTTOM;
    const W = cssW - 2;
    const xAt = (t: number): number => 1 + (t / m.duration) * W;
    const xBin = (b: number): number => 1 + (m.bins > 1 ? b / (m.bins - 1) : 0) * W;
    let total = 0;
    for (let ch = 0; ch < CH.heavy; ch++) total += m.counts[ch] as number;
    total = Math.max(1, total);

    // Stacked bands, bottom to top: dead, fled or left, latched, other pack animals still fighting.
    const acc = new Float64Array(m.bins);
    const band = (channels: readonly number[], color: string): void => {
      g.beginPath();
      for (let b = 0; b < m.bins; b++) {
        const y = top + H - ((acc[b] as number) / total) * H;
        if (b === 0) g.moveTo(xBin(b), y);
        else g.lineTo(xBin(b), y);
      }
      for (let b = m.bins - 1; b >= 0; b--) {
        let v = acc[b] as number;
        for (const ch of channels) v += m.counts[b * CHANNELS + ch] as number;
        acc[b] = v;
        g.lineTo(xBin(b), top + H - (v / total) * H);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    band([CH.dead], theme.deadMark);
    band([CH.out], theme.lodRouted);
    band([CH.latched], theme.pack);
    band([CH.approach, CH.recover], theme.lodRecover);

    // Living heavy, as a share of the starting count.
    const n0 = Math.max(1, m.counts[CH.heavy] as number);
    g.beginPath();
    for (let b = 0; b < m.bins; b++) {
      const y = top + 1 + H - 2 - ((m.counts[b * CHANNELS + CH.heavy] as number) / n0) * (H - 2);
      if (b === 0) g.moveTo(xBin(b), y);
      else g.lineTo(xBin(b), y);
    }
    g.strokeStyle = theme.heavy;
    g.lineWidth = 2;
    g.stroke();

    // Reduced detail from here on (event log stopped).
    if (Number.isFinite(m.reducedFrom)) {
      const x = xAt(m.reducedFrom);
      g.fillStyle = theme.muted;
      for (let y = top; y < top + H; y += 4) g.fillRect(x, y, 1, 2);
    }

    // Markers: kills and routs as short ticks, heavy deaths tall, first contact as a ▼.
    const tick = (t: number, y0: number, y1: number, w: number, color: string): void => {
      g.fillStyle = color;
      g.fillRect(Math.round((xAt(t) - w / 2) * dpr) / dpr, y0, w, y1 - y0);
    };
    for (const mk of m.markers) {
      if (mk.kind === 'kills') tick(mk.t, 0, top - 3, 1, theme.dead);
      else if (mk.kind === 'routs') tick(mk.t, 3, top - 1, 1, theme.out);
    }
    for (const mk of m.markers) if (mk.kind === 'heavyDeath') tick(mk.t, 0, cssH, 2, theme.heavy);
    for (const mk of m.markers) {
      if (mk.kind !== 'contact') continue;
      const x = xAt(mk.t);
      g.fillStyle = theme.fg;
      g.beginPath();
      g.moveTo(x - 4, 0);
      g.lineTo(x + 4, 0);
      g.lineTo(x, top - 2);
      g.closePath();
      g.fill();
    }
    return off;
  }
}
