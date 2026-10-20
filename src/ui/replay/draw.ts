import { TigerState } from '../../sim/engine';
import { EventType } from '../../sim/events';
import {
  BUCKET_ORDER,
  GLYPH,
  PAINTS,
  biteCone,
  tigerGlyph,
  tigerRadiusPx,
  trexGauge,
  trexLengthPx,
  trexTriangle,
  type Bucket,
  type Paint,
  type PathSink,
} from './glyphs';
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

/** Bite-cone lifetime in real seconds (effects are timed in real time, so they read at 16×). */
export const BITE_HIT_S = 0.32;
export const BITE_MISS_S = 0.22;
/**
 * Flash safety (WCAG 2.3.1): a T-Rex's bite cone is filled only if its previous bite was at
 * least FLASH_GAP_S real seconds earlier (≤ 3 fills/s), only up to FLASH_MAX_SPEED×, and only
 * while the frame's filled area stays under FLASH_AREA_PX (CSS px², < 21,824 = 25 % of the
 * 341 × 256 px "10° field"). Everything else is drawn as an outline.
 */
export const FLASH_GAP_S = 0.34;
export const FLASH_MAX_SPEED = 4;
export const FLASH_AREA_PX = 20_000;
export const FLASH_WEDGE_MAX_PX = 4_000;

/** Grid spacings (m); the finest one whose cells are ≥ 48 px is drawn. */
const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500] as const;
const GRID_MIN_PX = 48;
/** Scale-bar lengths: 1, 2 or 5 × a power of ten. */
const SCALE_STEPS = [2, 5, 10] as const;

const TIGER_STATE_NAME = ['approach', 'latched', 'recover', 'routed'] as const;

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

/** What the last frame showed (for the legend and tests). */
export interface FrameInfo {
  /** Tigers were drawn as LOD squares. */
  lod: boolean;
  /** Agents inside the view. */
  tigers: number;
  trex: number;
  /** Bite cones drawn, filled area (CSS px²). */
  wedges: number;
  flashArea: number;
}

/**
 * Draws the stage (docs/REPLAY.md §6): arena and grid, dead marks, tethers, tigers by state,
 * T-Rex with HP gauges, latched diamonds, bite cones and the scale bar. One Path2D per bucket per
 * frame, colours precomputed per theme, no typed-array allocation.
 */
export class StagePainter {
  readonly info: FrameInfo = { lod: false, tigers: 0, trex: 0, wedges: 0, flashArea: 0 };
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
    speed: number,
    effects: boolean,
  ): void {
    const p = this.p;
    const { cssW, cssH, dpr, scale, ox, oy } = vp;
    this.paths.clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, cssW, cssH);
    this.drawArena(ctx, vp, theme);

    const r = tigerRadiusPx(p.trace.meta.tigerRadius, scale);
    const lod = r < GLYPH.lodBelowPx;
    const len = trexLengthPx(scale);
    const info = this.info;
    info.lod = lod;
    info.tigers = 0;
    info.trex = 0;
    const mT = lod ? 3 : 3 * r + 2;
    const mR = len;

    // Tigers (glyph buckets; LOD squares are drawn directly below).
    if (!lod) {
      for (let j = 0; j < p.M; j++) {
        const s = w.ts[j] as number;
        if (s === TigerState.Left) continue;
        const x = ox + (w.tx[j] as number) * scale;
        const y = oy + (w.ty[j] as number) * scale;
        if (x < -mT || y < -mT || x > cssW + mT || y > cssH + mT) continue;
        info.tigers++;
        const h = w.thost[j] as number;
        tigerGlyph(
          s === TigerState.Dead ? 'dead' : (TIGER_STATE_NAME[s] ?? 'approach'),
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

    // T-Rex: solid triangle at full HP, otherwise a tinted hollow with an area-true HP gauge.
    const halo = p.N <= GLYPH.haloMaxTrex || len >= GLYPH.haloMinLen;
    for (let i = 0; i < p.N; i++) {
      const x = ox + (w.rx[i] as number) * scale;
      const y = oy + (w.ry[i] as number) * scale;
      if (x < -mR || y < -mR || x > cssW + mR || y > cssH + mR) continue;
      info.trex++;
      const hd = w.rh[i] as number;
      const cos = Math.cos(hd);
      const sin = Math.sin(hd);
      if (!w.ralive[i]) {
        trexTriangle(this.sink('deadTrex'), x, y, cos, sin, len);
        continue;
      }
      const hp = Math.min(1, w.rhp[i] as number);
      if (hp < GLYPH.gaugeBelow) {
        trexTriangle(this.sink('trexHollow'), x, y, cos, sin, len);
        trexTriangle(this.sink('trexOutline'), x, y, cos, sin, len);
        trexGauge(this.sink('trexGauge'), x, y, cos, sin, len, hp);
      } else {
        trexTriangle(this.sink(halo ? 'trexHalo' : 'trex'), x, y, cos, sin, len);
      }
    }

    info.wedges = 0;
    info.flashArea = 0;
    if (effects) this.collectBites(w, vp, speed);

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
      this.squares(ctx, w, vp, TigerState.Dead, theme.deadMark, GLYPH.lodMinDevicePx / dpr);
      paint('deadCross', 'approachTick');
      this.squares(ctx, w, vp, TigerState.Routed, theme.lodRouted, side * GLYPH.lodRouted);
      this.squares(ctx, w, vp, TigerState.Recover, theme.lodRecover, side);
      this.squares(ctx, w, vp, TigerState.Approach, theme.tiger, side);
      paint('trexHollow', 'trexHalo');
      this.squares(ctx, w, vp, TigerState.Latched, theme.tiger, side * GLYPH.lodLatched);
      paint('latched', 'biteMiss');
    } else {
      paint('deadCross', 'biteMiss');
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

  /** LOD: device-pixel-snapped squares for every tiger in one state, in one colour. */
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
      this.info.tigers++;
      ctx.fillRect(Math.round((x - half) * dpr) / dpr, Math.round((y - half) * dpr) / dpr, s, s);
    }
  }

  /**
   * Bite cones of recent BiteHit / BiteMiss events, on the biting T-Rex's current pose. Events are
   * found by binary search over the sorted log; hits are filled within the flash limits.
   */
  private collectBites(w: World, vp: Viewport, speed: number): void {
    const p = this.p;
    if (p.evCount === 0) return;
    const { cssW, cssH, scale, ox, oy } = vp;
    const sp = Math.max(0.25, speed);
    const time = w.time;
    const from = Math.ceil((time - BITE_HIT_S * sp) / p.dt - 1e-6);
    const until = Math.floor(time / p.dt + 1e-6);
    let lo = 0;
    let hi = p.evCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((p.evStep[mid] as number) < from) lo = mid + 1;
      else hi = mid;
    }
    const meta = p.trace.meta;
    const info = this.info;
    for (let k = lo; k < p.evCount; k++) {
      const step = p.evStep[k] as number;
      if (step > until) break;
      const type = p.evType[k] as number;
      if (type !== EventType.BiteHit && type !== EventType.BiteMiss) continue;
      const hit = type === EventType.BiteHit;
      const age = (time - step * p.dt) / sp;
      if (age < 0 || age > (hit ? BITE_HIT_S : BITE_MISS_S)) continue;
      const i = p.evA[k] as number;
      if (i >= p.N || !w.ralive[i]) continue;
      const reach = (meta.reach[i] as number) * scale;
      const x = ox + (w.rx[i] as number) * scale;
      const y = oy + (w.ry[i] as number) * scale;
      if (x < -reach || y < -reach || x > cssW + reach || y > cssH + reach) continue;
      const arc = meta.arc[i] as number;
      const area = reach * reach * arc;
      const fill =
        hit &&
        speed <= FLASH_MAX_SPEED &&
        (p.evGap[k] as number) >= FLASH_GAP_S * sp &&
        area <= FLASH_WEDGE_MAX_PX &&
        info.flashArea + area <= FLASH_AREA_PX;
      if (fill) info.flashArea += area;
      biteCone(this.sink(fill ? 'biteHit' : 'biteMiss'), x, y, w.rh[i] as number, reach, arc);
      info.wedges++;
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
