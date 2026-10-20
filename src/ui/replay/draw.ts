import { PackState } from '../../sim/engine';
import { TRAIL, collectEffects, collectTrails, newFxCounters, type FxCounters } from './effects';
import {
  BUCKET_ORDER,
  GLYPH,
  PAINTS,
  packGlyph,
  packRadiusPx,
  heavyGauge,
  heavyLengthPx,
  heavyTriangle,
  type Bucket,
  type Paint,
  type PathSink,
} from './glyphs';
import { OVERVIEW_ORDER, buildOverview } from './overview';
import type { Prepared } from './prepare';
import type { ReplayTheme } from './theme';
import type { World } from './world';

/** Screen mapping: CSS px = offset + metres × scale. */
export interface Viewport {
  readonly cssW: number;
  readonly cssH: number;
  readonly dpr: number;
  readonly scale: number;
  readonly ox: number;
  readonly oy: number;
}

/** Margin between the stage edge and a view of `view` metres (CSS px). */
export const STAGE_PAD = 8;

export function makeViewport(
  cssW: number,
  cssH: number,
  dpr: number,
  cx: number,
  cy: number,
  view: number,
): Viewport {
  const scale = (Math.min(cssW, cssH) - STAGE_PAD * 2) / view;
  return { cssW, cssH, dpr, scale, ox: cssW / 2 - cx * scale, oy: cssH / 2 - cy * scale };
}

/** Grid spacings (m); the finest one whose cells are ≥ 48 px is drawn. */
const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500] as const;
const GRID_MIN_PX = 48;
/** Scale-bar lengths: 1, 2 or 5 × a power of ten. */
const SCALE_STEPS = [2, 5, 10] as const;

const PACK_STATE_NAME = ['approach', 'latched', 'recover', 'routed'] as const;
const LAST_BUCKET = BUCKET_ORDER[BUCKET_ORDER.length - 1] as Bucket;

/** Apply one bucket's paints to a path. */
export function paintPath(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  paints: readonly Paint[],
  theme: ReplayTheme,
): void {
  for (const p of paints) {
    if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
    if (p.mode === 'fill') {
      ctx.fillStyle = theme[p.color];
      ctx.fill(path);
    } else {
      ctx.strokeStyle = theme[p.color];
      ctx.lineWidth = p.width ?? 1;
      ctx.stroke(path);
    }
    if (p.alpha !== undefined) ctx.globalAlpha = 1;
  }
}

/** What the last frame showed (for the legend, the debug overlay and tests). */
export interface FrameInfo {
  /** Pack animals were drawn as LOD squares. */
  lod: boolean;
  /** Agents inside the view. */
  pack: number;
  heavy: number;
  /** Effects, bite cones, fills and trails (see effects.ts). */
  fx: FxCounters;
}

/** Per-frame drawing switches (playback speed, reduced motion, adaptive quality tier). */
export interface DrawOptions {
  speed: number;
  effects: boolean;
  fills: boolean;
  heavyTrails: boolean;
  packTrails: boolean;
  forceLod: boolean;
  onFill?: ((event: number, heavy: number) => void) | undefined;
}

/**
 * Draws the stage (docs/REPLAY.md §6): arena and grid, dead marks, trails, tethers, pack animals by
 * state, heavy with HP gauges, latched diamonds, event effects and the scale bar. One Path2D per
 * bucket per frame, colours precomputed per theme, no typed-array allocation.
 */
export class StagePainter {
  readonly info: FrameInfo = { lod: false, pack: 0, heavy: 0, fx: newFxCounters() };
  private readonly paths = new Map<Bucket, Path2D>();
  private readonly sink = (b: Bucket): PathSink => {
    let path = this.paths.get(b);
    if (!path) {
      path = new Path2D();
      this.paths.set(b, path);
    }
    return path;
  };

  constructor(private readonly p: Prepared) {}

  draw(
    ctx: CanvasRenderingContext2D,
    w: World,
    vp: Viewport,
    theme: ReplayTheme,
    opt: DrawOptions,
  ): void {
    const p = this.p;
    const { cssW, cssH, dpr, scale, ox, oy } = vp;
    this.paths.clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, cssW, cssH);
    this.drawArena(ctx, vp, theme);

    const r = packRadiusPx(p.trace.meta.packRadius, scale);
    // LOD switches on a role-constant reference radius (the pack animal's 0.8 m), so smaller species
    // such as wolves still reach the shape glyphs when zoomed in.
    const lod = opt.forceLod || packRadiusPx(GLYPH.lodRadiusM, scale) < GLYPH.lodBelowPx;
    const len = heavyLengthPx(scale, p.heavyLengthM);
    const info = this.info;
    info.lod = lod;
    info.pack = 0;
    info.heavy = 0;
    const mT = lod ? 3 : 3 * r + 2;
    const mR = len;

    // Pack animals (glyph buckets; LOD squares are drawn directly below).
    if (!lod) {
      for (let j = 0; j < p.M; j++) {
        const s = w.ts[j] as number;
        if (s === PackState.Left) continue;
        const x = ox + (w.tx[j] as number) * scale;
        const y = oy + (w.ty[j] as number) * scale;
        if (x < -mT || y < -mT || x > cssW + mT || y > cssH + mT) continue;
        info.pack++;
        const h = w.thost[j] as number;
        packGlyph(
          s === PackState.Dead ? 'dead' : (PACK_STATE_NAME[s] ?? 'approach'),
          this.sink,
          x,
          y,
          r,
          w.tdx[j] as number,
          w.tdy[j] as number,
          h >= 0 ? ox + (w.rx[h] as number) * scale : x,
          h >= 0 ? oy + (w.ry[h] as number) * scale : y,
        );
      }
    }

    // Heavy: solid triangle at full HP, otherwise a tinted hollow with an area-true HP gauge.
    const halo = p.N <= GLYPH.haloMaxHeavy || len >= GLYPH.haloMinLen;
    for (let i = 0; i < p.N; i++) {
      const x = ox + (w.rx[i] as number) * scale;
      const y = oy + (w.ry[i] as number) * scale;
      if (x < -mR || y < -mR || x > cssW + mR || y > cssH + mR) continue;
      info.heavy++;
      const hd = w.rh[i] as number;
      const cos = Math.cos(hd);
      const sin = Math.sin(hd);
      if (!w.ralive[i]) {
        heavyTriangle(this.sink('deadHeavy'), x, y, cos, sin, len);
        continue;
      }
      const hp = Math.min(1, w.rhp[i] as number);
      if (hp < GLYPH.gaugeBelow) {
        heavyTriangle(this.sink('heavyHollow'), x, y, cos, sin, len);
        heavyTriangle(this.sink('heavyOutline'), x, y, cos, sin, len);
        heavyGauge(this.sink('heavyGauge'), x, y, cos, sin, len, hp);
      } else {
        heavyTriangle(this.sink(halo ? 'heavyHalo' : 'heavy'), x, y, cos, sin, len);
      }
    }

    const fx = info.fx;
    fx.effects = 0;
    fx.capped = 0;
    fx.wedges = 0;
    fx.fills = 0;
    fx.flashArea = 0;
    fx.heavyTrails = 0;
    fx.packTrails = 0;
    const packTrails = opt.packTrails && !lod && r >= TRAIL.minPackPx;
    if (opt.heavyTrails || packTrails)
      collectTrails(p, w, vp, { heavy: opt.heavyTrails, pack: packTrails }, this.sink, fx);
    if (opt.effects)
      collectEffects(
        p,
        w,
        vp,
        { speed: opt.speed, fills: opt.fills, onFill: opt.onFill },
        this.sink,
        fx,
      );

    // Paint in layer order, with LOD squares slotted in where their glyphs would be.
    const paint = (from: Bucket, to: Bucket): void => {
      const a = BUCKET_ORDER.indexOf(from);
      const b = BUCKET_ORDER.indexOf(to);
      for (let k = a; k <= b; k++) {
        const bucket = BUCKET_ORDER[k] as Bucket;
        const path = this.paths.get(bucket);
        if (path) paintPath(ctx, path, PAINTS[bucket], theme);
      }
    };
    if (lod) {
      const side = Math.max(GLYPH.lodMinDevicePx, Math.round(r * GLYPH.lodSide * dpr)) / dpr;
      this.squares(ctx, w, vp, PackState.Dead, theme.deadMark, GLYPH.lodMinDevicePx / dpr);
      paint('deadCross', 'approachTick');
      this.squares(ctx, w, vp, PackState.Routed, theme.lodRouted, side * GLYPH.lodRouted);
      this.squares(ctx, w, vp, PackState.Recover, theme.lodRecover, side);
      this.squares(ctx, w, vp, PackState.Approach, theme.pack, side);
      paint('heavyHollow', 'heavyHalo');
      this.squares(ctx, w, vp, PackState.Latched, theme.pack, side * GLYPH.lodLatched);
      paint('latched', LAST_BUCKET);
    } else {
      paint('deadCross', LAST_BUCKET);
    }
    this.drawScaleBar(ctx, vp, theme);
  }

  /** Arena fill, adaptive grid and border, with lines snapped to device pixels. */
  private drawArena(ctx: CanvasRenderingContext2D, vp: Viewport, theme: ReplayTheme): void {
    const { cssW, cssH, dpr, scale, ox, oy } = vp;
    const L = this.p.L;
    const size = L * scale;
    ctx.fillStyle = theme.arena;
    ctx.fillRect(ox, oy, size, size);
    const dev = Math.max(1, Math.round(dpr));
    const lw = dev / dpr;
    const snap = (v: number): number => (Math.round(v * dpr) + (dev % 2 ? 0.5 : 0)) / dpr;
    let grid: number = GRID_STEPS[GRID_STEPS.length - 1] as number;
    for (const g of GRID_STEPS) {
      if (g * scale >= GRID_MIN_PX) {
        grid = g;
        break;
      }
    }
    const x0 = Math.max(0, -ox / scale);
    const x1 = Math.min(L, (cssW - ox) / scale);
    const y0 = Math.max(0, -oy / scale);
    const y1 = Math.min(L, (cssH - oy) / scale);
    if (x1 > x0 && y1 > y0) {
      const path = new Path2D();
      for (let g = Math.ceil(x0 / grid) * grid; g <= x1; g += grid) {
        if (g <= 0 || g >= L) continue;
        const px = snap(ox + g * scale);
        path.moveTo(px, oy + y0 * scale);
        path.lineTo(px, oy + y1 * scale);
      }
      for (let g = Math.ceil(y0 / grid) * grid; g <= y1; g += grid) {
        if (g <= 0 || g >= L) continue;
        const py = snap(oy + g * scale);
        path.moveTo(ox + x0 * scale, py);
        path.lineTo(ox + x1 * scale, py);
      }
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = lw;
      ctx.stroke(path);
    }
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = lw;
    const bx = snap(ox);
    const by = snap(oy);
    ctx.strokeRect(bx, by, snap(ox + size) - bx, snap(oy + size) - by);
  }

  /** LOD: device-pixel-snapped squares for every pack animal in one state, in one colour. */
  private squares(
    ctx: CanvasRenderingContext2D,
    w: World,
    vp: Viewport,
    state: number,
    color: string,
    side: number,
  ): void {
    const { cssW, cssH, dpr, scale, ox, oy } = vp;
    const half = side / 2;
    const s = Math.max(1, Math.round(side * dpr)) / dpr;
    ctx.fillStyle = color;
    for (let j = 0; j < this.p.M; j++) {
      if (w.ts[j] !== state) continue;
      const x = ox + (w.tx[j] as number) * scale;
      const y = oy + (w.ty[j] as number) * scale;
      if (x < -side || y < -side || x > cssW + side || y > cssH + side) continue;
      this.info.pack++;
      ctx.fillRect(Math.round((x - half) * dpr) / dpr, Math.round((y - half) * dpr) / dpr, s, s);
    }
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D, vp: Viewport, theme: ReplayTheme): void {
    const { cssW, cssH, scale } = vp;
    const raw = Math.min(120, cssW * 0.25) / scale;
    const mag = 10 ** Math.floor(Math.log10(raw));
    let meters = mag;
    for (const m of SCALE_STEPS) if (m * mag <= raw) meters = m * mag;
    const px = meters * scale;
    const x = 14;
    const y = cssH - 14;
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

/**
 * Paint the reduced-motion overview (overview.ts) framed by `vp`. Called on load, resize and
 * theme change only; there is no animation.
 */
export function paintOverview(
  ctx: CanvasRenderingContext2D,
  p: Prepared,
  vp: Viewport,
  theme: ReplayTheme,
): void {
  const { cssW, cssH, dpr, scale, ox, oy } = vp;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = theme.arena;
  ctx.fillRect(ox, oy, p.L * scale, p.L * scale);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox, oy, p.L * scale, p.L * scale);
  const paths = new Map<Bucket, Path2D>();
  buildOverview(p, vp, (b) => {
    let path = paths.get(b);
    if (!path) {
      path = new Path2D();
      paths.set(b, path);
    }
    return path;
  });
  for (const b of OVERVIEW_ORDER) {
    const path = paths.get(b);
    if (path) paintPath(ctx, path, PAINTS[b], theme);
  }
}
