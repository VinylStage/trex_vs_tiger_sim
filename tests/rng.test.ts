import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed, splitmix32 } from '../src/sim/rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs across seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('produces values in [0, 1) with mean ≈ 0.5', () => {
    const r = new Rng(7);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeCloseTo(0.5, 1);
  });

  it('int() stays within range', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v) && v >= 0 && v < 5).toBe(true);
    }
  });

  it('normal() has mean ≈ 0 and variance ≈ 1', () => {
    const r = new Rng(11);
    const n = 20000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const v = r.normal();
      s += v;
      s2 += v * v;
    }
    expect(s / n).toBeCloseTo(0, 1);
    expect(s2 / n - (s / n) ** 2).toBeCloseTo(1, 1);
  });
});

describe('seed derivation', () => {
  it('returns uint32 and separates streams and salts', () => {
    const s = deriveSeed(123, 0);
    expect(s >>> 0).toBe(s);
    expect(deriveSeed(123, 1)).not.toBe(s);
    expect(deriveSeed(123, 0, 1)).not.toBe(s);
    expect(splitmix32(0)).not.toBe(splitmix32(1));
  });
});
