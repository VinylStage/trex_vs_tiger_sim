import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simulateBattle, type RunSummary } from '../src/sim/engine';
import { aggregate, runAll } from '../src/sim/montecarlo';
import { designRow } from '../src/sim/sampling';
import { decodeConfig, v1ParamId } from '../src/ui/share';

/**
 * Golden fixtures for v1 share links, captured from origin/main f18a934 before the
 * multi-species rename (#25). Every v1 link must keep reproducing these results bit for bit:
 * the design matrix, every run summary, the aggregate verdict and the replay trace of the
 * representative run. Keep this test forever; never regenerate the fixture.
 */
interface GoldenCase {
  name: string;
  payload: string;
  designHash: string;
  summaries: number[][];
  aggregate: {
    wins: number[];
    p: number[];
    duration: number[];
    survivors: number[];
    killed: number[];
    routed: number[];
    exchangeRatio: string;
    sensitivity: [string, number][];
    representativeRun: number;
  };
  trace: {
    run: number;
    frames: number;
    framesHash: string;
    eventsHash: string;
    eventsCompleteUntilStep: number;
    eventStats: Record<string, number>;
    bodyRadius: number;
    packRadius: number;
    reachHash: string;
    arcHash: string;
  };
}

const golden = JSON.parse(
  readFileSync(new URL('./fixtures/v1-golden.json', import.meta.url), 'utf8'),
) as { capturedFrom: string; cases: GoldenCase[] };

const fnv = (h: number, bytes: Uint8Array): number => {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ (bytes[k] as number), 0x01000193);
  return h >>> 0;
};
const hex = (h: number): string => h.toString(16).padStart(8, '0');
const bytesOf = (a: ArrayBufferView): Uint8Array =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const hashOf = (a: ArrayBufferView): string => hex(fnv(0x811c9dc5, bytesOf(a)));

/** Summary fields in the fixture's column order (v1 names in `summaryFields`). */
const row = (s: RunSummary): number[] => [
  s.run,
  s.outcome,
  s.duration,
  s.heavyAlive,
  s.packKilled,
  s.packRouted,
  s.packActive,
  s.heavyHpFrac,
  s.heavyAdvantage,
];

describe(`v1 share links reproduce bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has the captured cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(6);
  });

  it.each(golden.cases)('$name', (g) => {
    const config = decodeConfig(g.payload);
    const { design, summaries } = runAll(config);
    expect(hashOf(design.values)).toBe(g.designHash);
    expect(summaries.map(row)).toEqual(g.summaries);

    const agg = aggregate(config, design, summaries);
    expect({
      wins: [agg.heavyWins, agg.packWins, agg.draws],
      p: [
        agg.pHeavy.p,
        agg.pHeavy.lo,
        agg.pHeavy.hi,
        agg.pPack.p,
        agg.pPack.lo,
        agg.pPack.hi,
        agg.pDraw.p,
        agg.pDraw.lo,
        agg.pDraw.hi,
      ],
      duration: [agg.duration.mean, agg.duration.p5, agg.duration.p50, agg.duration.p95],
      survivors: [agg.heavySurvivors.mean, agg.heavySurvivors.p50],
      killed: [agg.packKilled.mean, agg.packKilled.p50],
      routed: [agg.packRouted.mean, agg.packRouted.p50],
      exchangeRatio: String(agg.exchangeRatio),
      sensitivity: agg.sensitivity.map((s) => [s.id, s.rho]),
      representativeRun: agg.representativeRun,
    }).toEqual({
      ...g.aggregate,
      // The fixture names parameters with their v1 ids.
      sensitivity: g.aggregate.sensitivity.map(([id, rho]) => [v1ParamId(id), rho]),
    });

    const run = g.trace.run;
    const { trace } = simulateBattle(config, designRow(design, run), run, true);
    if (!trace) throw new Error('no trace');
    let fh = 0x811c9dc5;
    const t = new Float64Array(1);
    for (const f of trace.frames) {
      t[0] = f.t;
      fh = fnv(fh, bytesOf(t));
      fh = fnv(fh, bytesOf(f.heavy));
      fh = fnv(fh, bytesOf(f.pack));
    }
    expect({
      run,
      frames: trace.frames.length,
      framesHash: hex(fh),
      eventsHash: hashOf(trace.events),
      eventsCompleteUntilStep: trace.eventsCompleteUntilStep,
      eventStats: trace.eventStats,
      bodyRadius: trace.meta.bodyRadius,
      packRadius: trace.meta.packRadius,
      reachHash: hashOf(trace.meta.reach),
      arcHash: hashOf(trace.meta.arc),
    }).toEqual(g.trace);
  });
});
