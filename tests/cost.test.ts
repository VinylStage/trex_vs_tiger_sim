import { describe, expect, it } from 'vitest';
import { defaultConfig, maxRunsFor } from '../src/sim/config';
import { costSummary, estimateTotalMs, isCostOk } from '../src/ui/cost';

describe('costSummary', () => {
  it('has nothing to warn about for the default scenario', () => {
    const s = costSummary(defaultConfig(), 4);
    expect(s.cap).toBeNull();
    expect(s.level).toBe('ok');
    expect(isCostOk(s)).toBe(true);
  });

  it('reports the work-budget cap and estimates the time of the capped runs', () => {
    const c = { ...defaultConfig(), heavyCount: 50, packCount: 2000, runs: 20000 };
    const max = maxRunsFor(c);
    expect(max).toBeLessThan(c.runs);
    const s = costSummary(c, 4);
    expect(s.cap).toBe(max);
    expect(s.etaMs).toBeCloseTo(estimateTotalMs({ ...c, runs: max }, 4));
    expect(isCostOk(s)).toBe(false);
  });

  it('flags long runs that fit the budget', () => {
    const c = { ...defaultConfig(), heavyCount: 10, packCount: 400, runs: 5000 };
    const s = costSummary(c, 1);
    expect(s.cap).toBeNull();
    expect(s.level).not.toBe('ok');
    expect(isCostOk(s)).toBe(false);
  });
});
