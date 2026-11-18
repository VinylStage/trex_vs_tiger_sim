import { describe, expect, it } from 'vitest';
import {
  summarizeFree,
  validateFreeSummary,
  type FreeResultSummary,
} from '../src/share/free-result-codec';
import { freeStats, type ResultView } from '../src/share/result-text';
import { sanitizeConfig } from '../src/sim/config';
import { EndReason, PackState, simulateBattle } from '../src/sim/engine';
import { aggregateFree, countEndReasons } from '../src/sim/free/aggregate';
import { sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FREE_FRAME_STRIDE,
  FreeEndReason,
  FreeOutcome,
  FreeState,
  simulateFreeBattle,
  type FreeTrace,
} from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { buildDesign, designRow } from '../src/sim/sampling';

/*
 * Battle end (#230, docs/MODEL.md §2.4). Up to model 2 a side was out as soon as its last member
 * routed, still on the field, so a battle "ended" with the fleeing animals on screen. From model 3
 * a side is out only when nobody of it is in play: incapacitated, or routed and escaped across the
 * arena edge. A run that reaches `maxTime` is a draw with the
 * end reason "time limit", never a win.
 */

/** The owner's report: Simple, 100 H. erectus v 1 T. rex, seed 3842280975. */
const OWNER = {
  seed: 3842280975,
  sides: [{ species: 'homoErectus', count: 100 }, { species: 'trex' }],
};

/** States of side `side`'s agents on the last frame of a trace. */
function lastStates(trace: FreeTrace, side: 0 | 1): number[] {
  const f = trace.frames[trace.frames.length - 1];
  if (!f) throw new Error('no frame');
  const [nA, nB] = trace.counts;
  const from = side === 0 ? 0 : nA;
  const to = side === 0 ? nA : nA + nB;
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(f.agents[i * FREE_FRAME_STRIDE + 4] as number);
  return out;
}

function run(c: FreeConfig, r = 0) {
  return simulateFreeBattle(c, designRow(buildFreeDesign(c), r), r, true);
}

describe('model 2 (unchanged): a battle ends on the last rout, with the fleeing still on the field', () => {
  it("reproduces the owner's report: the run stops while routed H. erectus remain", () => {
    const c = sanitizeFreeConfig({ ...OWNER, mv: 2, runs: 1 });
    const { summary, trace } = run(c);
    expect(summary.outcome).toBe(FreeOutcome.B);
    expect(summary.endReason).toBe(FreeEndReason.Rout);
    expect(summary.duration).toBeLessThan(c.maxTime);
    // Most of side A is still in the arena in the Routed state when the run ends.
    const routed = lastStates(trace as FreeTrace, 0).filter((s) => s === FreeState.Routed);
    expect(routed.length).toBeGreaterThan(50);
  });
});

describe('model 3: a side is out only when nobody of it is in play', () => {
  it('realistic: the losing group flees and the run ends once every one has escaped or fallen', () => {
    const c = sanitizeFreeConfig({ ...OWNER, mv: 3, flight: 'realistic', runs: 1 });
    const { summary, trace } = run(c);
    expect(summary.outcome).toBe(FreeOutcome.B);
    expect(summary.endReason).toBe(FreeEndReason.Rout);
    const states = lastStates(trace as FreeTrace, 0);
    expect(states.every((s) => s === FreeState.Dead || s === FreeState.Left)).toBe(true);
    expect(states.filter((s) => s === FreeState.Left).length).toBeGreaterThan(0);
  });

  it('allIn (the default) keeps morale rout: the fleeing humans run off and the run ends once they are out', () => {
    const c = sanitizeFreeConfig({ ...OWNER, mv: 3, runs: 1 });
    expect(c.flight).toBe('allIn');
    expect(c.morale).toBe(true);
    const { summary, trace } = run(c);
    expect(summary.outcome).toBe(FreeOutcome.B);
    expect(summary.endReason).toBe(FreeEndReason.Rout);
    const states = lastStates(trace as FreeTrace, 0);
    expect(states.every((s) => s === FreeState.Dead || s === FreeState.Left)).toBe(true);
    expect(states.filter((s) => s === FreeState.Left).length).toBeGreaterThan(50);
  });

  it('morale off: nobody flees, so the run ends when one side is incapacitated', () => {
    const c = sanitizeFreeConfig({ ...OWNER, mv: 3, morale: false, runs: 2 });
    const { summaries } = runAllFree(c);
    for (const s of summaries) {
      expect(s.aRouted + s.bRouted).toBe(0);
      expect(s.endReason).toBe(FreeEndReason.Wipeout);
      const loserAlive = s.outcome === FreeOutcome.A ? s.bAlive : s.aAlive;
      expect(loserAlive).toBe(0);
    }
  });

  it('defaults the time limit to a 3,600 s safety cap, and a run that reaches it is a draw', () => {
    expect(sanitizeFreeConfig({ mv: 3 }).maxTime).toBe(3600);
    const c = sanitizeFreeConfig({
      mv: 3,
      maxTime: 30,
      runs: 10,
      sides: [
        { species: 'elephant', count: 5 },
        { species: 'lion', count: 30 },
      ],
    });
    const { summaries } = runAllFree(c);
    const capped = summaries.filter((s) => s.endReason === FreeEndReason.TimeLimit);
    expect(capped.length).toBeGreaterThan(0);
    for (const s of capped) {
      expect(s.outcome).toBe(FreeOutcome.Draw);
      expect(s.duration).toBe(30);
    }
    const agg = aggregateFree(c, summaries);
    expect(agg.endReasons).toEqual(countEndReasons(summaries));
    expect(agg.endReasons[EndReason.TimeLimit]).toBe(capped.length);
    expect(agg.endReasons.reduce((a, b) => a + b, 0)).toBe(agg.n);
  });
});

describe('classic model 3: the pack is out only once no animal of it is in play', () => {
  const states = (mv: number): { reason: number; packStates: number[] } => {
    const c = sanitizeConfig({ mv, runs: 1 });
    const { summary, trace } = simulateBattle(c, designRow(buildDesign(c), 0), 0, true);
    const f = trace?.frames[trace.frames.length - 1];
    if (!f) throw new Error('no frame');
    const out: number[] = [];
    for (let j = 0; j < c.packCount; j++) out.push(f.pack[j * 3 + 2] as number);
    return { reason: summary.endReason, packStates: out };
  };

  it('model 2 ended with routed tigers on the field; model 3 waits until they escape', () => {
    const v2 = states(2);
    expect(v2.reason).toBe(EndReason.Rout);
    expect(v2.packStates.some((s) => s === PackState.Routed)).toBe(true);
    const v3 = states(3);
    expect(v3.reason).toBe(EndReason.Rout);
    expect(v3.packStates.every((s) => s === PackState.Dead || s === PackState.Left)).toBe(true);
  });
});

describe('end reasons in free result links', () => {
  const c = sanitizeFreeConfig({
    mv: 3,
    runs: 20,
    sides: [{ species: 'lion' }, { species: 'tiger' }],
  });
  const agg = aggregateFree(c, runAllFree(c).summaries);

  it('are written from model 3 on and validated against the counts', () => {
    const s = summarizeFree(c, agg);
    expect(s.e).toEqual(agg.endReasons);
    expect(validateFreeSummary(s, c)).toEqual(s);
    const old = sanitizeFreeConfig({ ...c, mv: 2 });
    expect(summarizeFree(old, aggregateFree(old, runAllFree(old).summaries)).e).toBeUndefined();
    const bad: unknown[] = [
      { ...s, e: [1, 2, 3] },
      { ...s, e: [s.n, 1, 0, 0] },
      { ...s, e: [s.n - 1, 0, 1, 0], d: 0 },
      { ...s, e: [-1, s.n + 1, 0, 0] },
      { ...s, e: [s.n / 2, s.n / 2 - 0.5, 0.5, 0] },
    ];
    for (const x of bad) expect(validateFreeSummary(x, c)).toBeNull();
  });

  it('are listed on the result page, most common first', () => {
    const view = { lang: 'en', heavyName: 'Lion', packName: 'Tiger' } as ResultView;
    const s: FreeResultSummary = { n: 10, a: 6, b: 3, d: 1, e: [2, 7, 1, 0] };
    expect(freeStats(view, s)).toContainEqual([
      'How runs ended',
      'Ended in flight 70% · All incapacitated 20% · Draw: time limit 10%',
    ]);
  });
});
