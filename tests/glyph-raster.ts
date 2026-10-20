import { BUCKET_ORDER, PAINTS, type Bucket, type PathSink } from '../src/ui/replay/glyphs';

/**
 * Minimal canvas-like rasterizer for the glyph builders, so shape tests run in node: records
 * paths (arcs flattened), then paints them in bucket order like the stage does and reports which
 * pixels end up in a non-background colour.
 */

interface SubPath {
  pts: number[];
  closed: boolean;
}

export class RecordingPath implements PathSink {
  readonly subpaths: SubPath[] = [];
  private cur: SubPath | null = null;

  moveTo(x: number, y: number): void {
    this.cur = { pts: [x, y], closed: false };
    this.subpaths.push(this.cur);
  }

  lineTo(x: number, y: number): void {
    if (!this.cur) this.moveTo(x, y);
    else this.cur.pts.push(x, y);
  }

  arc(x: number, y: number, r: number, a0: number, a1: number): void {
    let end = a1;
    while (end < a0) end += Math.PI * 2;
    const n = Math.max(8, Math.ceil(((end - a0) / (Math.PI * 2)) * 96));
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((end - a0) * k) / n;
      this.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  }

  closePath(): void {
    if (this.cur) {
      this.cur.closed = true;
      const [x, y] = this.cur.pts;
      this.cur = { pts: [x ?? 0, y ?? 0], closed: false };
      this.subpaths.push(this.cur);
    }
  }
}

function insideNonZero(path: RecordingPath, px: number, py: number): boolean {
  let wind = 0;
  for (const sp of path.subpaths) {
    const p = sp.pts;
    const n = p.length / 2;
    if (n < 3) continue;
    for (let k = 0; k < n; k++) {
      const x0 = p[k * 2] as number;
      const y0 = p[k * 2 + 1] as number;
      const x1 = p[((k + 1) % n) * 2] as number;
      const y1 = p[((k + 1) % n) * 2 + 1] as number;
      if (y0 <= py) {
        if (y1 > py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) wind++;
      } else if (y1 <= py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) wind--;
    }
  }
  return wind !== 0;
}

function onStroke(path: RecordingPath, px: number, py: number, half: number): boolean {
  for (const sp of path.subpaths) {
    const p = sp.pts;
    const n = p.length / 2;
    const segs = sp.closed ? n : n - 1;
    for (let k = 0; k < segs; k++) {
      const x0 = p[k * 2] as number;
      const y0 = p[k * 2 + 1] as number;
      const x1 = p[((k + 1) % n) * 2] as number;
      const y1 = p[((k + 1) % n) * 2 + 1] as number;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      const u = ((px - x0) * dx + (py - y0) * dy) / l2;
      // Butt caps on open ends; joins inside a polyline are filled by the neighbour segment.
      const open = !sp.closed && ((k === 0 && u < 0) || (k === segs - 1 && u > 1));
      if (open) continue;
      const cu = Math.min(1, Math.max(0, u));
      const ex = x0 + cu * dx - px;
      const ey = y0 + cu * dy - py;
      if (ex * ex + ey * ey <= half * half) return true;
    }
  }
  return false;
}

/** Rasterize recorded buckets into a size × size mask (coverage ≥ 50 %, 4 × 4 supersampling). */
export function rasterize(paths: Partial<Record<Bucket, RecordingPath>>, size = 32): Uint8Array {
  const mask = new Uint8Array(size * size);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inked = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let color: string | null = null;
          for (const bucket of BUCKET_ORDER) {
            const path = paths[bucket];
            if (!path) continue;
            for (const paint of PAINTS[bucket]) {
              const hit =
                paint.mode === 'fill'
                  ? insideNonZero(path, px, py)
                  : onStroke(path, px, py, ('width' in paint ? paint.width : 1) / 2);
              if (hit) color = paint.color;
            }
          }
          if (color !== null && color !== 'surface') inked++;
        }
      }
      if (inked * 2 >= SS * SS) mask[y * size + x] = 1;
    }
  }
  return mask;
}

export function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) inter++;
    if (a[k] || b[k]) union++;
  }
  return union === 0 ? 0 : inter / union;
}

/** Collect a glyph's buckets as recording paths. */
export function record(
  build: (sink: (b: Bucket) => PathSink) => void,
): Partial<Record<Bucket, RecordingPath>> {
  const paths: Partial<Record<Bucket, RecordingPath>> = {};
  build((b) => (paths[b] ??= new RecordingPath()));
  return paths;
}
