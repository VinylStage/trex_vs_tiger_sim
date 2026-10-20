import { describe, expect, it } from 'vitest';
import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../src/sim/config';
import { PARAMS } from '../src/sim/params';
import {
  SUMMARY_STRIDE,
  aggregate,
  packSummaries,
  runAll,
  unpackSummaries,
} from '../src/sim/montecarlo';
import { Rng } from '../src/sim/rng';
import { ranks, spearman } from '../src/sim/stats';

/** The rank function before typed arrays (#24), kept as the reference. */
function referenceRanks(xs: readonly number[]): number[] {
  const n = xs.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (xs[a] as number) - (xs[b] as number),
  );
  const r = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && xs[idx[j + 1] as number] === xs[idx[i] as number]) j++;
    for (let k = i; k <= j; k++) r[idx[k] as number] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

const config = (over: Partial<ScenarioConfig>): ScenarioConfig =>
  sanitizeConfig({ ...defaultConfig(), maxTime: 120, ...over });

describe('ranks', () => {
  it('equals the reference ranks, ties averaged, for typed and plain inputs', () => {
    const rng = new Rng(3);
    for (const n of [0, 1, 2, 17, 500]) {
      // Coarse values force many ties.
      const xs = Array.from({ length: n }, () => Math.round(rng.next() * 20) / 4 - 2);
      expect([...ranks(xs)]).toEqual(referenceRanks(xs));
      expect([...ranks(Float64Array.from(xs))]).toEqual(referenceRanks(xs));
    }
  });
});

describe('aggregate', () => {
  const cases = [
    config({ heavyCount: 2, packCount: 12, runs: 60, seed: 9 }),
    config({ heavyCount: 1, packCount: 1, runs: 80, seed: 2, sampling: 'random' }),
  ];

  it.each(cases)('ranks the outcome once and still matches spearman() bit for bit', (c) => {
    const { design, summaries } = runAll(c);
    const agg = aggregate(c, design, summaries);
    const sorted = [...summaries].sort((a, b) => a.run - b.run);
    const adv = sorted.map((s) => s.heavyAdvantage);
    for (const s of agg.sensitivity) {
      const j = PARAMS.findIndex((p) => p.id === s.id);
      const xs = sorted.map((r) => design.values[r.run * design.dims + j] as number);
      const rho = spearman(xs, adv);
      expect(Object.is(s.rho, Number.isFinite(rho) ? rho : 0), s.id).toBe(true);
    }
  });

  it.each(cases)('gives the same result from packed summaries (worker path)', (c) => {
    const { design, summaries } = runAll(c);
    const packed = packSummaries(summaries);
    expect(packed.length).toBe(summaries.length * SUMMARY_STRIDE);
    expect(unpackSummaries(packed)).toEqual(summaries);
    // structuredClone stands in for postMessage; Infinity and NaN must survive it too.
    const viaWorker = structuredClone(aggregate(c, design, unpackSummaries(packed)));
    expect(viaWorker).toStrictEqual(aggregate(c, design, summaries));
  });
});
