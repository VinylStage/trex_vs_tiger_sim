import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { SpatialGrid } from '../src/sim/spatial';

describe('SpatialGrid.nearest', () => {
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
