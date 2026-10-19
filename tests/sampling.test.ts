import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/sim/config';
import { PARAMS, type Triangular } from '../src/sim/params';
import { buildDesign, designRow } from '../src/sim/sampling';

const triCdf = (x: number, { min, mode, max }: Triangular): number => {
  if (x <= min) return 0;
  if (x >= max) return 1;
  if (x <= mode) return ((x - min) * (x - min)) / ((max - min) * (mode - min));
  return 1 - ((max - x) * (max - x)) / ((max - min) * (max - mode));
};

describe('buildDesign', () => {
  it('is deterministic', () => {
    const c = { ...defaultConfig(), runs: 50 };
    expect(buildDesign(c).values).toEqual(buildDesign(c).values);
  });

  it('LHS hits every stratum exactly once per dimension', () => {
    const c = { ...defaultConfig(), runs: 64, sampling: 'lhs' as const };
    const d = buildDesign(c);
    PARAMS.forEach((p, j) => {
      const range = c.params[p.id];
      if (range.max === range.min) return;
      const strata = new Set<number>();
      for (let i = 0; i < d.runs; i++) {
        const u = triCdf(d.values[i * d.dims + j] as number, range);
        strata.add(Math.min(d.runs - 1, Math.floor(u * d.runs + 1e-9)));
      }
      expect(strata.size).toBe(d.runs);
    });
  });

  it('keeps samples within ranges for random sampling', () => {
    const c = { ...defaultConfig(), runs: 200, sampling: 'random' as const };
    const d = buildDesign(c);
    for (let i = 0; i < d.runs; i++) {
      const row = designRow(d, i);
      PARAMS.forEach((p, j) => {
        const r = c.params[p.id];
        expect(row[j]).toBeGreaterThanOrEqual(r.min);
        expect(row[j]).toBeLessThanOrEqual(r.max);
      });
    }
  });
});
