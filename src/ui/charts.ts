import type { AggregateResult, Sensitivity } from '../sim/montecarlo';
import type { ParamId } from '../sim/params';
import { histogram, type Histogram } from '../sim/stats';
import { h } from './dom';
import { formatFixed, formatNum, formatPct } from './format';
import { t, type MsgKey } from './i18n';

/** Colors and font read from CSS custom properties, so charts follow the light/dark theme. */
export interface Theme {
  fg: string;
  muted: string;
  grid: string;
  surface: string;
  heavy: string;
  pack: string;
  draw: string;
  neutral: string;
  latched: string;
  hpLow: string;
  font: string;
}

export function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string): string =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: v('--fg', '#1b1b1a'),
    muted: v('--muted', '#5f5e5a'),
    grid: v('--grid', '#e3e2de'),
    surface: v('--surface', '#ffffff'),
    heavy: v('--c-trex', '#2a78d6'),
    pack: v('--c-tiger', '#eb6834'),
    draw: v('--c-draw', '#8d8c87'),
    neutral: v('--c-neutral', '#6250d6'),
    latched: v('--c-latched', '#1baf7a'),
    hpLow: v('--c-hp-low', '#e34948'),
    font: v('--font-sans', 'system-ui, sans-serif'),
  };
}

export interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface Size {
  w: number;
  h: number;
}

export type Painter = (ctx: CanvasRenderingContext2D, size: Size, theme: Theme) => Hit[];

const live = new Set<CanvasChart>();
let schemeListener = false;

function watchColorScheme(): void {
  if (schemeListener || typeof matchMedia !== 'function') return;
  schemeListener = true;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    for (const c of live) c.redraw();
  });
}

/** Redraw every live chart (e.g. after a language change). */
export function redrawAllCharts(): void {
  for (const c of live) c.redraw();
}

/**
 * A HiDPI-aware canvas inside a <figure>, redrawn on resize and on color-scheme change, with a
 * hover/tap tooltip driven by the hit regions the painter returns.
 */
export class CanvasChart {
  readonly el: HTMLElement;
  private readonly box: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLDivElement;
  private painter: Painter | null = null;
  private hits: Hit[] = [];
  private readonly ro: ResizeObserver;
  private lastW = -1;

  constructor(titleKey: MsgKey, className: string, note?: MsgKey) {
    this.canvas = h('canvas', { attrs: { role: 'img' } });
    this.tip = h('div', { class: 'chart-tip', attrs: { 'aria-hidden': 'true' } });
    this.tip.hidden = true;
    this.box = h('div', { class: `chart-box ${className}` }, this.canvas, this.tip);
    this.el = h(
      'figure',
      { class: 'chart' },
      h('figcaption', {}, h('span', { class: 'chart-title', i18n: titleKey })),
      note ? h('p', { class: 'chart-note', i18n: note }) : null,
      this.box,
    );
    this.ro = new ResizeObserver(() => {
      const w = this.box.clientWidth;
      if (w !== this.lastW) this.redraw();
    });
    this.ro.observe(this.box);
    this.canvas.addEventListener('pointermove', (e) => this.onPointer(e));
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.canvas.addEventListener('pointerleave', () => {
      this.tip.hidden = true;
    });
    live.add(this);
    watchColorScheme();
  }

  set(painter: Painter, ariaLabel: string, cssHeight?: number): void {
    this.painter = painter;
    this.canvas.setAttribute('aria-label', ariaLabel);
    if (cssHeight !== undefined) this.canvas.style.height = `${cssHeight}px`;
    this.redraw();
  }

  redraw(): void {
    const w = this.box.clientWidth;
    const hgt = this.canvas.clientHeight;
    this.lastW = w;
    this.tip.hidden = true;
    if (!this.painter || w <= 0 || hgt <= 0) return;
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    this.hits = this.painter(ctx, { w, h: hgt }, readTheme());
  }

  destroy(): void {
    this.ro.disconnect();
    live.delete(this);
  }

  private onPointer(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = this.hits.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
    if (!hit) {
      this.tip.hidden = true;
      return;
    }
    this.tip.textContent = hit.text;
    this.tip.hidden = false;
    const bw = this.box.clientWidth;
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    const left = Math.max(0, Math.min(bw - tw, x + 12));
    const top = y - th - 10 >= 0 ? y - th - 10 : y + 16;
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }
}

// ---------- helpers ----------

const DURATION_BINS = 30;

/**
 * Duration histogram over [0, a round number just above the longest battle] instead of
 * [0, maxTime], so short battles are not squeezed into the first few bins.
 */
export function durationHistogram(durations: readonly number[], maxTime: number): Histogram {
  let longest = 0;
  for (const d of durations) if (d > longest) longest = d;
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, longest)));
  const step = longest / mag < 3 ? mag / 2 : mag;
  const upper = Math.min(maxTime, Math.max(10, Math.ceil((longest * 1.0001) / step) * step));
  return histogram(durations, DURATION_BINS, 0, upper);
}

/** "Nice" axis ticks (1/2/5 × 10^k steps) covering [min, max]. */
export function niceTicks(min: number, max: number, count: number, integer = false): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  if (integer) step = Math.max(1, Math.round(step));
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9) * step;
  for (let v = first; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step || 0);
  return out;
}

function font(theme: Theme, size: number, weight = 400): string {
  return `${weight} ${size}px ${theme.font}`;
}

/** Bar with a 4px rounded data end and a square baseline. */
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hgt: number,
  end: 'right' | 'left' | 'top',
): void {
  if (w <= 0 || hgt <= 0) return;
  const r = Math.min(4, end === 'top' ? w / 2 : hgt / 2, end === 'top' ? hgt : w);
  const radii = end === 'right' ? [0, r, r, 0] : end === 'left' ? [r, 0, 0, r] : [r, r, 0, 0];
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, hgt, radii);
  else ctx.rect(x, y, w, hgt);
  ctx.fill();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function noData(ctx: CanvasRenderingContext2D, size: Size, theme: Theme): Hit[] {
  ctx.fillStyle = theme.muted;
  ctx.font = font(theme, 13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('chart.noData'), size.w / 2, size.h / 2);
  return [];
}

// ---------- outcome bars ----------

export function paintOutcome(agg: AggregateResult): Painter {
  return (ctx, { w, h: hgt }, theme) => {
    const rows = [
      { name: t('outcome.heavy'), iv: agg.pHeavy, color: theme.heavy },
      { name: t('outcome.pack'), iv: agg.pPack, color: theme.pack },
      { name: t('outcome.draw'), iv: agg.pDraw, color: theme.draw },
    ];
    ctx.font = font(theme, 13);
    const labelW = Math.min(w * 0.35, Math.max(...rows.map((r) => ctx.measureText(r.name).width)));
    const valueW = ctx.measureText(formatPct(1)).width;
    const left = labelW + 12;
    const right = w - valueW - 12;
    const top = 4;
    const axisH = 20;
    const plotW = Math.max(10, right - left);
    const bandH = (hgt - top - axisH) / rows.length;
    const barH = Math.min(20, bandH * 0.55);
    const xOf = (p: number): number => left + p * plotW;

    // Grid + axis labels.
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = theme.muted;
    ctx.font = font(theme, 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const x = Math.round(xOf(p)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, hgt - axisH);
      ctx.stroke();
      ctx.fillText(formatPct(p, 0), x, hgt - axisH + 5);
    }

    const hits: Hit[] = [];
    rows.forEach((r, i) => {
      const cy = top + bandH * (i + 0.5);
      ctx.fillStyle = theme.fg;
      ctx.font = font(theme, 13);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ellipsize(ctx, r.name, labelW), labelW, cy);

      ctx.fillStyle = r.color;
      bar(ctx, left, cy - barH / 2, xOf(r.iv.p) - left, barH, 'right');

      // 95% CI whisker.
      ctx.strokeStyle = theme.fg;
      ctx.lineWidth = 1.5;
      const lo = xOf(r.iv.lo);
      const hi = xOf(r.iv.hi);
      const cap = barH * 0.45;
      ctx.beginPath();
      ctx.moveTo(lo, cy);
      ctx.lineTo(hi, cy);
      ctx.moveTo(lo, cy - cap);
      ctx.lineTo(lo, cy + cap);
      ctx.moveTo(hi, cy - cap);
      ctx.lineTo(hi, cy + cap);
      ctx.stroke();

      ctx.fillStyle = theme.fg;
      ctx.font = font(theme, 13, 600);
      ctx.textAlign = 'right';
      ctx.fillText(formatPct(r.iv.p), w, cy);

      hits.push({
        x: 0,
        y: cy - bandH / 2,
        w,
        h: bandH,
        text: t('chart.outcomeTip', {
          name: r.name,
          p: formatPct(r.iv.p),
          lo: formatPct(r.iv.lo),
          hi: formatPct(r.iv.hi),
        }),
      });
    });
    return hits;
  };
}

// ---------- histogram ----------

export interface HistogramOptions {
  color: (theme: Theme) => string;
  /** Integer-valued data (bins centred on integers). */
  discrete: boolean;
  axisTitle: string;
  tickLabel: (v: number) => string;
  binLabel: (lo: number, hi: number) => string;
}

export function paintHistogram(hist: Histogram, opts: HistogramOptions): Painter {
  return (ctx, size, theme) => {
    const { w, h: hgt } = size;
    const counts = hist.counts;
    const total = counts.reduce((a, b) => a + b, 0);
    if (counts.length === 0 || total === 0) return noData(ctx, size, theme);
    const yMax = Math.max(1, ...counts);
    const yTicks = niceTicks(0, yMax, 4, true);
    const yTop = Math.max(yMax, yTicks[yTicks.length - 1] ?? yMax);
    ctx.font = font(theme, 11);
    const left = Math.max(...yTicks.map((v) => ctx.measureText(formatNum(v, 0)).width)) + 10;
    const right = w - 8;
    const top = 8;
    const bottom = hgt - 36;
    const plotW = Math.max(10, right - left);
    const plotH = Math.max(10, bottom - top);
    const xOf = (v: number): number => left + ((v - hist.min) / (hist.max - hist.min)) * plotW;
    const yOf = (c: number): number => bottom - (c / yTop) * plotH;

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = theme.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yTicks) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillText(formatNum(v, 0), left - 6, y);
    }

    const n = counts.length;
    const bw = plotW / n;
    const gap = bw >= 6 ? 2 : bw >= 3 ? 1 : 0;
    const binW = (hist.max - hist.min) / n;
    const hits: Hit[] = [];
    ctx.fillStyle = opts.color(theme);
    counts.forEach((c, i) => {
      const x = left + i * bw;
      const y = yOf(c);
      if (c > 0) bar(ctx, x + gap / 2, y, Math.max(1, bw - gap), bottom - y, 'top');
      const lo = hist.min + i * binW;
      hits.push({
        x,
        y: top,
        w: bw,
        h: plotH,
        text: t('chart.binTip', {
          range: opts.binLabel(lo, lo + binW),
          count: formatNum(c, 0),
          pct: formatPct(c / total),
        }),
      });
    });

    // X axis.
    ctx.strokeStyle = theme.muted;
    ctx.beginPath();
    ctx.moveTo(left, Math.round(bottom) + 0.5);
    ctx.lineTo(right, Math.round(bottom) + 0.5);
    ctx.stroke();
    const lo = opts.discrete ? hist.min + 0.5 : hist.min;
    const hi = opts.discrete ? hist.max - 0.5 : hist.max;
    const xTicks = niceTicks(lo, hi, Math.max(2, Math.floor(plotW / 70)), opts.discrete);
    ctx.fillStyle = theme.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of xTicks) {
      const label = opts.tickLabel(v);
      const half = ctx.measureText(label).width / 2;
      // Keep edge labels inside the canvas instead of clipping them.
      ctx.fillText(label, Math.min(w - half - 1, Math.max(half + 1, xOf(v))), bottom + 5);
    }
    ctx.fillText(opts.axisTitle, left + plotW / 2, bottom + 21);
    return hits;
  };
}

// ---------- tornado ----------

export function paintTornado(
  sens: readonly Sensitivity[],
  label: (id: ParamId) => string,
  top = 10,
): Painter {
  const rows = sens.filter((s) => Number.isFinite(s.rho)).slice(0, top);
  return (ctx, size, theme) => {
    const { w, h: hgt } = size;
    if (rows.length === 0) return noData(ctx, size, theme);
    const maxAbs = Math.max(...rows.map((r) => Math.abs(r.rho)));
    const scale = [0.1, 0.2, 0.3, 0.5, 0.75, 1].find((s) => s >= maxAbs - 1e-9) ?? 1;
    ctx.font = font(theme, 12);
    const labelW = Math.min(
      w * 0.42,
      Math.max(...rows.map((r) => ctx.measureText(label(r.id)).width)),
    );
    const headH = 20;
    const left = labelW + 12;
    const right = w - 4;
    const valueRoom = ctx.measureText('−0.00').width + 8;
    const cx = (left + right) / 2;
    const half = Math.max(10, (right - left) / 2 - valueRoom);
    const bandH = (hgt - headH) / rows.length;
    const barH = Math.min(18, bandH * 0.6);

    ctx.fillStyle = theme.muted;
    ctx.font = font(theme, 11);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(t('chart.favPack'), left, headH / 2);
    ctx.textAlign = 'right';
    ctx.fillText(t('chart.favHeavy'), right, headH / 2);

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, headH);
    ctx.lineTo(Math.round(cx) + 0.5, hgt);
    ctx.stroke();

    const hits: Hit[] = [];
    rows.forEach((r, i) => {
      const cy = headH + bandH * (i + 0.5);
      const name = label(r.id);
      ctx.fillStyle = theme.fg;
      ctx.font = font(theme, 12);
      ctx.textAlign = 'right';
      ctx.fillText(ellipsize(ctx, name, labelW), labelW, cy);

      const len = (Math.abs(r.rho) / scale) * half;
      ctx.fillStyle = r.rho >= 0 ? theme.heavy : theme.pack;
      if (r.rho >= 0) bar(ctx, cx, cy - barH / 2, len, barH, 'right');
      else bar(ctx, cx - len, cy - barH / 2, len, barH, 'left');

      const value = `${r.rho >= 0 ? '+' : '−'}${formatFixed(Math.abs(r.rho), 2)}`;
      ctx.fillStyle = theme.fg;
      ctx.font = font(theme, 11);
      ctx.textAlign = r.rho >= 0 ? 'left' : 'right';
      ctx.fillText(value, r.rho >= 0 ? cx + len + 4 : cx - len - 4, cy);

      hits.push({
        x: 0,
        y: cy - bandH / 2,
        w,
        h: bandH,
        text: t('chart.rhoTip', { name, rho: value }),
      });
    });
    return hits;
  };
}
