import { describe, expect, it } from 'vitest';
import {
  INDIVIDUAL_FACTOR_MAX,
  INDIVIDUAL_FACTOR_MIN,
  individualFactor,
  triangularInv,
} from '../src/sim/distributions';
import { Rng } from '../src/sim/rng';

const t = { min: 2, mode: 5, max: 11 };

describe('triangularInv', () => {
  it('maps endpoints and the mode quantile', () => {
    expect(triangularInv(0, t)).toBe(2);
    expect(triangularInv(1, t)).toBe(11);
    expect(triangularInv((5 - 2) / (11 - 2), t)).toBeCloseTo(5, 10);
  });

  it('handles degenerate ranges', () => {
    expect(triangularInv(0.3, { min: 4, mode: 4, max: 4 })).toBe(4);
  });

  it('has the analytic mean', () => {
    const n = 10000;
    let s = 0;
    for (let i = 0; i < n; i++) s += triangularInv((i + 0.5) / n, t);
    expect(s / n).toBeCloseTo((2 + 5 + 11) / 3, 2);
  });
});

describe('individualFactor', () => {
  it('is 1 when cv is 0', () => {
    expect(individualFactor(new Rng(1), 0)).toBe(1);
  });

  it('stays within truncation bounds', () => {
    const r = new Rng(3);
    for (let i = 0; i < 5000; i++) {
      const f = individualFactor(r, 0.3);
      expect(f).toBeGreaterThanOrEqual(INDIVIDUAL_FACTOR_MIN);
      expect(f).toBeLessThanOrEqual(INDIVIDUAL_FACTOR_MAX);
    }
  });
});
