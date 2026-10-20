import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { SpatialGrid } from '../src/sim/spatial';

/**
 * The ring search before the bounding-box limit (docs/PERFORMANCE.md), kept as the reference:
 * the optimised search must return the very same index, ties included, for runs to stay
 * bit-identical.
 */
function referenceNearest(
  arena: number,
  capacity: number,
  n: number,
  xs: Float64Array,
  ys: Float64Array,
  include: (i: number) => boolean,
  x: number,
  y: number,
  accept: (i: number) => boolean,
): number {
  const probe = new SpatialGrid(arena, capacity);
  const cols = probe.cols;
  const size = probe.cellSize;
  const col = (v: number): number => Math.min(cols - 1, Math.max(0, Math.floor(v / size)));
  const cells: number[][] = Array.from({ length: cols * cols }, () => []);
  for (let i = 0; i < n; i++) {
    if (include(i)) cells[col(ys[i] as number) * cols + col(xs[i] as number)]?.push(i);
  }
  const cx = col(x);
  const cy = col(y);
  let best = -1;
  let bestD = Infinity;
  for (let ring = 0; ring < cols; ring++) {
    if (best >= 0) {
      const gap = (ring - 1) * size;
      if (gap > 0 && gap * gap > bestD) break;
    }
    const [r0, r1, c0, c1] = [cy - ring, cy + ring, cx - ring, cx + ring];
    for (let row = r0; row <= r1; row++) {
      if (row < 0 || row >= cols) continue;
      const step = row === r0 || row === r1 ? 1 : Math.max(1, c1 - c0);
      for (let c = c0; c <= c1; c += step) {
        if (c < 0 || c >= cols) continue;
        for (const i of cells[row * cols + c] ?? []) {
          if (!accept(i)) continue;
          const d = ((xs[i] as number) - x) ** 2 + ((ys[i] as number) - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
  }
  return best;
}

describe('SpatialGrid.nearest', () => {
  it('returns exactly the index of the full ring search (clusters, ties, filters)', () => {
    const rng = new Rng(11);
    for (const [arena, n, spread] of [
      [600, 100, 1],
      [600, 100, 0.05],
      [5000, 2000, 0.02],
      [5000, 300, 1],
      [100, 3, 1],
      [3000, 50, 0.001],
    ] as const) {
      const xs = new Float64Array(n);
      const ys = new Float64Array(n);
      const cx = rng.next() * arena;
      const cy = rng.next() * arena;
      for (let i = 0; i < n; i++) {
        // Clustered points (as in a battle), some exact duplicates to force distance ties.
        if (i > 0 && rng.next() < 0.1) {
          xs[i] = xs[i - 1] as number;
          ys[i] = ys[i - 1] as number;
        } else {
          xs[i] = cx + (rng.next() - 0.5) * arena * spread;
          ys[i] = cy + (rng.next() - 0.5) * arena * spread;
        }
      }
      const included = Uint8Array.from({ length: n }, () => (rng.next() < 0.8 ? 1 : 0));
      const accepted = Uint8Array.from({ length: n }, () => (rng.next() < 0.7 ? 1 : 0));
      const include = (i: number): boolean => included[i] === 1;
      const accept = (i: number): boolean => accepted[i] === 1;
      const g = new SpatialGrid(arena, n);
      g.rebuild(n, xs, ys, include);
      for (let q = 0; q < 300; q++) {
        // Queries everywhere, including outside the arena and exactly on indexed points.
        const onPoint = q % 7 === 0 ? Math.floor(rng.next() * n) : -1;
        const x = onPoint >= 0 ? (xs[onPoint] as number) : rng.next() * arena * 1.4 - arena * 0.2;
        const y = onPoint >= 0 ? (ys[onPoint] as number) : rng.next() * arena * 1.4 - arena * 0.2;
        expect(g.nearest(x, y, xs, ys, accept)).toBe(
          referenceNearest(arena, n, n, xs, ys, include, x, y, accept),
        );
      }
    }
  });

  it('forgets the previous bounding box on rebuild', () => {
    const xs = Float64Array.from([10, 590]);
    const ys = Float64Array.from([10, 590]);
    const g = new SpatialGrid(600, 2);
    g.rebuild(2, xs, ys, () => true);
    expect(g.nearest(600, 600, xs, ys, () => true)).toBe(1);
    g.rebuild(2, xs, ys, (i) => i === 0);
    expect(g.nearest(600, 600, xs, ys, () => true)).toBe(0);
    g.rebuild(2, xs, ys, () => false);
    expect(g.nearest(0, 0, xs, ys, () => true)).toBe(-1);
  });

  it('matches brute force for random points, filters and queries (incl. outside the arena)', () => {
    const rng = new Rng(5);
    for (const [arena, n] of [
      [600, 100],
      [5000, 5000],
      [100, 3],
    ] as const) {
      const xs = new Float64Array(n);
      const ys = new Float64Array(n);
      const ok = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = rng.next() * arena;
        ys[i] = rng.next() * arena;
        ok[i] = rng.next() < 0.7 ? 1 : 0;
      }
      const g = new SpatialGrid(arena, n);
      g.rebuild(n, xs, ys, () => true);
      for (let q = 0; q < 200; q++) {
        const x = rng.next() * arena * 1.2 - arena * 0.1;
        const y = rng.next() * arena * 1.2 - arena * 0.1;
        let bd = Infinity;
        for (let i = 0; i < n; i++) {
          if (!ok[i]) continue;
          bd = Math.min(bd, ((xs[i] as number) - x) ** 2 + ((ys[i] as number) - y) ** 2);
        }
        const got = g.nearest(x, y, xs, ys, (i) => ok[i] === 1);
        if (bd === Infinity) expect(got).toBe(-1);
        else expect(((xs[got] as number) - x) ** 2 + ((ys[got] as number) - y) ** 2).toBe(bd);
      }
    }
  });

  it('returns -1 when nothing is indexed', () => {
    const g = new SpatialGrid(100, 4);
    g.rebuild(0, new Float64Array(0), new Float64Array(0), () => true);
    expect(g.nearest(50, 50, new Float64Array(0), new Float64Array(0), () => true)).toBe(-1);
  });

  it('keeps the grid small for small populations', () => {
    expect(new SpatialGrid(5000, 1).cols).toBe(4);
    expect(new SpatialGrid(5000, 5000).cols).toBe(128);
    expect(new SpatialGrid(100, 5000).cols).toBe(10);
  });
});
