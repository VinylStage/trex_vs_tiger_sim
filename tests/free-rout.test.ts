import { describe, expect, it } from 'vitest';
import { aggregateFree, routShare } from '../src/sim/free/aggregate';
import { defaultSide, sanitizeFreeConfig } from '../src/sim/free/config';
import { FreeOutcome, emptyBuffStats, type FreeRunSummary } from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';

/** Rout share and the still standing / fled / incapacitated breakdown of free results (#42). */

function run(
  outcome: number,
  a: [killed: number, routed: number, active: number],
  b: [killed: number, routed: number, active: number],
): FreeRunSummary {
  return {
    run: 0,
    outcome: outcome as FreeRunSummary['outcome'],
    duration: 10,
    aAlive: a[1] + a[2],
    aKilled: a[0],
    aRouted: a[1],
    aActive: a[2],
    bAlive: b[1] + b[2],
    bKilled: b[0],
    bRouted: b[1],
    bActive: b[2],
    aHpFrac: 0,
    bHpFrac: 0,
    advantage: 0,
    buffA: emptyBuffStats(),
    buffB: emptyBuffStats(),
  };
}

describe('routShare', () => {
  it("pools the loser's fled ÷ (fled + incapacitated) over decided runs", () => {
    const runs = [
      run(FreeOutcome.A, [0, 0, 5], [2, 8, 0]),
      run(FreeOutcome.B, [3, 1, 0], [0, 0, 10]),
    ];
    expect(routShare(runs)).toBeCloseTo(9 / 14, 12);
  });

  it('filters by the side that lost', () => {
    const runs = [
      run(FreeOutcome.A, [0, 0, 5], [2, 8, 0]),
      run(FreeOutcome.B, [3, 1, 0], [0, 0, 10]),
    ];
    expect(routShare(runs, 1)).toBeCloseTo(0.8, 12);
    expect(routShare(runs, 0)).toBeCloseTo(0.25, 12);
  });

  it('ignores draws and is NaN without a decided run or a loser out of the fight', () => {
    const draw = run(FreeOutcome.Draw, [1, 1, 1], [1, 1, 1]);
    expect(routShare([draw, run(FreeOutcome.A, [0, 0, 1], [1, 0, 0])])).toBe(0);
    expect(routShare([draw])).toBeNaN();
    expect(routShare([])).toBeNaN();
    expect(routShare([run(FreeOutcome.A, [0, 0, 1], [1, 0, 0])], 0)).toBeNaN();
  });

  it('agrees with a real batch, whose loser always has nobody active left', () => {
    const c = sanitizeFreeConfig({ runs: 24, seed: 7 });
    c.sides = [defaultSide('wolf', 6), defaultSide('brownBear', 1)];
    const cfg = sanitizeFreeConfig(c);
    const { summaries } = runAllFree(cfg);
    let fled = 0;
    let out = 0;
    for (const s of summaries) {
      if (s.outcome === FreeOutcome.Draw) continue;
      const lostA = s.outcome === FreeOutcome.B;
      expect(lostA ? s.aActive : s.bActive).toBe(0);
      fled += lostA ? s.aRouted : s.bRouted;
      out += lostA ? s.aRouted + s.aKilled : s.bRouted + s.bKilled;
    }
    expect(routShare(summaries)).toBe(fled / out);
  });
});

describe('still standing / fled / incapacitated', () => {
  it('adds up to the head count of each side, per run and on average', () => {
    const c = sanitizeFreeConfig({ runs: 20, seed: 3 });
    c.sides = [defaultSide('lion', 5), defaultSide('tiger', 5)];
    const cfg = sanitizeFreeConfig(c);
    const { summaries } = runAllFree(cfg);
    for (const s of summaries) {
      expect(s.aActive + s.aRouted + s.aKilled).toBe(5);
      expect(s.bActive + s.bRouted + s.bKilled).toBe(5);
    }
    const agg = aggregateFree(cfg, summaries);
    for (const side of [agg.a, agg.b]) {
      expect(side.active + side.routed + side.killed).toBeCloseTo(5, 9);
    }
  });
});
