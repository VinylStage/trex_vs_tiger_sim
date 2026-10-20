import { describe, expect, it } from 'vitest';
import { CHUNKS_PER_WORKER, estimateRemainingMs, poolSize, splitRuns } from '../src/ui/chunks';
import { costLevel, estimateTotalMs } from '../src/ui/cost';
import { durationHistogram } from '../src/ui/charts';
import { orderRange } from '../src/ui/form';

describe('splitRuns', () => {
  it('covers every run exactly once, in order', () => {
    const cases: [number, number][] = [
      [1, 8],
      [7, 3],
      [500, 8],
      [20000, 6],
      [33, 1],
    ];
    for (const [runs, workers] of cases) {
      const chunks = splitRuns(runs, workers);
      expect(chunks[0]?.start).toBe(0);
      expect(chunks[chunks.length - 1]?.end).toBe(runs);
      for (let i = 1; i < chunks.length; i++) expect(chunks[i]?.start).toBe(chunks[i - 1]?.end);
      for (const c of chunks) expect(c.end).toBeGreaterThan(c.start);
    }
  });

  it('makes about workers × CHUNKS_PER_WORKER chunks for load balancing', () => {
    const chunks = splitRuns(500, 8);
    expect(chunks.length).toBeGreaterThanOrEqual(8 * CHUNKS_PER_WORKER - 1);
    expect(chunks.length).toBeLessThanOrEqual(8 * CHUNKS_PER_WORKER);
    expect(splitRuns(3, 8)).toHaveLength(3);
  });

  it('handles degenerate input', () => {
    expect(splitRuns(0, 4)).toEqual([]);
    expect(splitRuns(5, 0)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 5 },
    ]);
  });
});

describe('poolSize / ETA', () => {
  it('leaves one core free, keeps at least 1 and at most 8 workers, assumes 4 cores if unknown', () => {
    expect(poolSize(undefined)).toBe(3);
    expect(poolSize(0)).toBe(3);
    expect(poolSize(1)).toBe(1);
    expect(poolSize(2)).toBe(1);
    expect(poolSize(4)).toBe(3);
    expect(poolSize(9)).toBe(8);
    expect(poolSize(64)).toBe(8);
  });

  it('extrapolates linearly once there is signal', () => {
    expect(estimateRemainingMs(0, 100, 1000)).toBeNull();
    expect(estimateRemainingMs(10, 100, 100)).toBeNull();
    expect(estimateRemainingMs(25, 100, 1000)).toBe(3000);
    expect(estimateRemainingMs(100, 100, 1000)).toBe(0);
  });
});

describe('cost estimate', () => {
  it('does not warn for the default scenario or the presets', () => {
    expect(costLevel({ heavyCount: 10, packCount: 100, runs: 500 }, 4)).toBe('ok');
    expect(costLevel({ heavyCount: 10, packCount: 1000, runs: 200 }, 4)).toBe('ok');
    expect(costLevel({ heavyCount: 1, packCount: 1, runs: 2000 }, 4)).toBe('ok');
  });

  it('warns for very large scenarios', () => {
    expect(costLevel({ heavyCount: 10, packCount: 5000, runs: 2000 }, 8)).not.toBe('ok');
    expect(costLevel({ heavyCount: 500, packCount: 5000, runs: 20000 }, 8)).toBe('extreme');
    expect(estimateTotalMs({ heavyCount: 1, packCount: 1, runs: 100 }, 2)).toBeGreaterThan(0);
  });
});

describe('orderRange', () => {
  const r = { min: 2, mode: 5, max: 8 };
  const bounds = [0, 10] as const;

  it('pushes mode and max up when min passes them', () => {
    expect(orderRange(r, 'min', 9, bounds)).toEqual({ min: 9, mode: 9, max: 9 });
    expect(orderRange(r, 'min', 6, bounds)).toEqual({ min: 6, mode: 6, max: 8 });
  });

  it('pushes mode and min down when max drops below them', () => {
    expect(orderRange(r, 'max', 1, bounds)).toEqual({ min: 1, mode: 1, max: 1 });
  });

  it('widens the range when mode moves outside it', () => {
    expect(orderRange(r, 'mode', 9, bounds)).toEqual({ min: 2, mode: 9, max: 9 });
    expect(orderRange(r, 'mode', 1, bounds)).toEqual({ min: 1, mode: 1, max: 8 });
  });

  it('clamps to the parameter bounds', () => {
    expect(orderRange(r, 'max', 50, bounds)).toEqual({ min: 2, mode: 5, max: 10 });
    expect(orderRange(r, 'min', -3, bounds)).toEqual({ min: 0, mode: 5, max: 8 });
  });
});

describe('durationHistogram', () => {
  it('fits the range to the longest battle, capped at maxTime', () => {
    const hist = durationHistogram([12, 30, 47.5], 1200);
    expect(hist.min).toBe(0);
    expect(hist.max).toBe(50);
    expect(hist.counts.reduce((a, b) => a + b, 0)).toBe(3);
    expect(durationHistogram([1199, 1200], 1200).max).toBe(1200);
    expect(durationHistogram([130], 1200).max).toBe(150);
    expect(durationHistogram([], 600).max).toBe(10);
  });
});
