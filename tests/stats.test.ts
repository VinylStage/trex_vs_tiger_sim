import { describe, expect, it } from 'vitest';
import { histogram, mean, quantileSorted, ranks, spearman, wilson } from '../src/sim/stats';

describe('wilson', () => {
  it('matches reference values', () => {
    const w = wilson(50, 100);
    expect(w.p).toBe(0.5);
    expect(w.lo).toBeCloseTo(0.4038, 3);
    expect(w.hi).toBeCloseTo(0.5962, 3);
  });

  it('stays within [0, 1] at the extremes', () => {
    const a = wilson(0, 20);
    expect(a.lo).toBe(0);
    expect(a.hi).toBeGreaterThan(0);
    const b = wilson(20, 20);
    expect(b.hi).toBe(1);
    expect(b.lo).toBeLessThan(1);
  });

  it('returns the uninformative interval for n = 0', () => {
    expect(wilson(0, 0)).toEqual({ p: 0, lo: 0, hi: 1 });
  });
});

describe('descriptive stats', () => {
  it('mean and quantiles', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantileSorted([0, 10], 0.25)).toBe(2.5);
    expect(Number.isNaN(quantileSorted([], 0.5))).toBe(true);
  });

  it('histogram clamps out-of-range values into edge bins', () => {
    const h = histogram([-5, 0, 0.5, 1, 9.9, 20], 10, 0, 10);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(6);
    expect(h.counts[0]).toBe(3);
    expect(h.counts[9]).toBe(2);
  });
});

describe('rank correlation', () => {
  it('averages tied ranks', () => {
    expect(Array.from(ranks([10, 20, 20, 30]))).toEqual([1, 2.5, 2.5, 4]);
  });

  it('is ±1 for monotone relations and 0 for constants', () => {
    const x = [1, 2, 3, 4, 5];
    expect(spearman(x, [1, 4, 9, 16, 25])).toBeCloseTo(1, 12);
    expect(spearman(x, [5, 4, 3, 2, 1])).toBeCloseTo(-1, 12);
    expect(spearman(x, [7, 7, 7, 7, 7])).toBe(0);
  });
});
