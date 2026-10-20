import { describe, expect, it } from 'vitest';
import { FREE_PARAM_INDEX, buildFreeDesign, sanitizeFreeConfig } from '../src/sim/free/config';
import {
  FREE_FRAME_STRIDE,
  FreeOutcome,
  FreeState,
  simulateFreeBattle,
  type FreeRunSummary,
} from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { designRow } from '../src/sim/sampling';
import { wilson } from '../src/sim/stats';

/** Free engine, individual layer (docs/design/FREE-MATCHUPS.md §4, §8 P3). */

const matchup = (a: string, na: number, b: string, nb: number, extra: object = {}) =>
  sanitizeFreeConfig({
    sides: [
      { species: a, count: na },
      { species: b, count: nb },
    ],
    ...extra,
  });

const wins = (s: readonly FreeRunSummary[], o: number): number =>
  s.filter((r) => r.outcome === o).length;

/** Every state each agent passes through in a traced run (frames are 0.5 s apart). */
function statesSeen(config: ReturnType<typeof matchup>, runs: number): Set<number>[] {
  const design = buildFreeDesign(config);
  const n = config.sides[0].count + config.sides[1].count;
  const seen = Array.from({ length: n }, () => new Set<number>());
  for (let r = 0; r < runs; r++) {
    const { trace } = simulateFreeBattle(config, designRow(design, r), r, true);
    if (!trace) throw new Error('no trace');
    for (const f of trace.frames) {
      for (let i = 0; i < n; i++) seen[i]?.add(f.agents[i * FREE_FRAME_STRIDE + 4] as number);
    }
  }
  return seen;
}

describe('fairness', () => {
  it.each([
    ['trex', 1, 1500],
    ['wolf', 8, 800],
    ['elephant', 1, 1500],
  ] as const)('mirror %s × %i: P(A) and P(B) are inside each other’s 95 %% CI', (sp, n, runs) => {
    const { summaries } = runAllFree(matchup(sp, n, sp, n, { runs }));
    const a = wilson(wins(summaries, FreeOutcome.A), runs);
    const b = wilson(wins(summaries, FreeOutcome.B), runs);
    expect(a.p).toBeGreaterThanOrEqual(b.lo);
    expect(a.p).toBeLessThanOrEqual(b.hi);
    expect(b.p).toBeGreaterThanOrEqual(a.lo);
    expect(b.p).toBeLessThanOrEqual(a.hi);
  });

  it('swapping the sides mirrors the win split (tiger vs brown bear)', () => {
    const runs = 1500;
    const ab = runAllFree(matchup('tiger', 1, 'brownBear', 1, { runs })).summaries;
    const ba = runAllFree(matchup('brownBear', 1, 'tiger', 1, { runs })).summaries;
    const tigerFirst = wilson(wins(ab, FreeOutcome.A), runs);
    const tigerSecond = wilson(wins(ba, FreeOutcome.B), runs);
    expect(tigerFirst.p).toBeGreaterThanOrEqual(tigerSecond.lo);
    expect(tigerFirst.p).toBeLessThanOrEqual(tigerSecond.hi);
    expect(tigerSecond.p).toBeGreaterThanOrEqual(tigerFirst.lo);
    expect(tigerSecond.p).toBeLessThanOrEqual(tigerFirst.hi);
  });
});

describe('latching by species and body-mass ratio (design §4.2)', () => {
  it('never latches between animals of similar size (lions vs tigers)', () => {
    const seen = statesSeen(matchup('lion', 5, 'tiger', 5, { runs: 20 }), 20);
    expect(seen.every((s) => !s.has(FreeState.Latched))).toBe(true);
  });

  it('never latches for a species that cannot grab (T. rex vs Homo erectus)', () => {
    const seen = statesSeen(matchup('trex', 1, 'homoErectus', 30, { runs: 10 }), 10);
    expect(seen[0]?.has(FreeState.Latched)).toBe(false);
    // The small side does latch onto the much heavier animal.
    expect(seen.slice(1).some((s) => s.has(FreeState.Latched))).toBe(true);
  });

  it('latches only when the target is at least R_latch times heavier', () => {
    const wolves = matchup('wolf', 10, 'brownBear', 1, { runs: 10 });
    expect(statesSeen(wolves, 10).some((s) => s.has(FreeState.Latched))).toBe(true);
    const strict = sanitizeFreeConfig({
      ...wolves,
      globals: { latchRatio: { min: 15, mode: 15, max: 15 } },
    });
    expect(statesSeen(strict, 10).every((s) => !s.has(FreeState.Latched))).toBe(true);
  });
});

describe('determinism and isolation', () => {
  const config = matchup('wolf', 10, 'brownBear', 1, { runs: 8 });
  const design = buildFreeDesign(config);

  it('gives the same summary with and without a trace', () => {
    for (let r = 0; r < config.runs; r++) {
      const plain = simulateFreeBattle(config, designRow(design, r), r).summary;
      const traced = simulateFreeBattle(config, designRow(design, r), r, true);
      expect(traced.summary).toEqual(plain);
      expect(simulateFreeBattle(config, designRow(design, r), r).summary).toEqual(plain);
    }
  });

  it('keeps side A’s random draws independent of side B’s size', () => {
    const small = matchup('lion', 6, 'buffalo', 1);
    const large = matchup('lion', 6, 'buffalo', 9);
    const rowSmall = designRow(buildFreeDesign(small), 0);
    const rowLarge = designRow(buildFreeDesign(large), 0);
    expect(Array.from(rowSmall)).toEqual(Array.from(rowLarge));
    const ts = simulateFreeBattle(small, rowSmall, 0, true).trace;
    const tl = simulateFreeBattle(large, rowLarge, 0, true).trace;
    if (!ts || !tl) throw new Error('no trace');
    const nA = 6;
    expect(Array.from(ts.meta.mass.subarray(0, nA))).toEqual(
      Array.from(tl.meta.mass.subarray(0, nA)),
    );
    const f0s = ts.frames[0]?.agents.subarray(0, nA * FREE_FRAME_STRIDE);
    const f0l = tl.frames[0]?.agents.subarray(0, nA * FREE_FRAME_STRIDE);
    expect(Array.from(f0s ?? [])).toEqual(Array.from(f0l ?? []));
  });

  it('never reads inactive traits (latch traits of a non-latcher, buff traits of a loner)', () => {
    const c = matchup('tiger', 1, 'brownBear', 1, { runs: 4 });
    const d = buildFreeDesign(c);
    for (let r = 0; r < c.runs; r++) {
      const row = Float64Array.from(designRow(d, r));
      const base = simulateFreeBattle(c, row, r).summary;
      for (const key of ['b.latchChance', 'b.latchDps', 'a.cohesionRadius', 'b.focusBonus']) {
        const k = FREE_PARAM_INDEX[key] as number;
        const mod = Float64Array.from(row);
        mod[k] = 0.5;
        expect(simulateFreeBattle(c, mod, r).summary, key).toEqual(base);
      }
    }
  });
});

describe('battle sanity', () => {
  it('ends with a consistent summary', () => {
    const { summaries } = runAllFree(matchup('lion', 6, 'buffalo', 1, { runs: 40 }));
    for (const s of summaries) {
      expect(s.aAlive + s.aKilled).toBe(6);
      expect(s.bAlive + s.bKilled).toBe(1);
      expect(s.aActive + s.aRouted).toBe(s.aAlive);
      expect(s.bActive + s.bRouted).toBe(s.bAlive);
      if (s.outcome === FreeOutcome.A) expect(s.bActive).toBe(0);
      if (s.outcome === FreeOutcome.B) expect(s.aActive).toBe(0);
      expect(s.advantage).toBeGreaterThanOrEqual(-1);
      expect(s.advantage).toBeLessThanOrEqual(1);
    }
  });

  it('lets nobody flee with morale off', () => {
    const { summaries } = runAllFree(
      matchup('wolf', 8, 'wolf', 8, { runs: 20, morale: false, maxTime: 300 }),
    );
    for (const s of summaries) expect(s.aRouted + s.bRouted).toBe(0);
  });
});
