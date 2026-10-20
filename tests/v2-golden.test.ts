import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeConfig } from '../src/sim/config';
import { simulateBattle, type RunSummary } from '../src/sim/engine';
import { aggregate, runAll } from '../src/sim/montecarlo';
import { designRow } from '../src/sim/sampling';

/**
 * Golden fixtures for the species roster shipped in v0.2.0, captured from origin/main 9ef2a63
 * (its `src/sim` is identical to the v0.2.0 release 435f9a6), not from a feature branch: every
 * v0.2.0 preset and every elephant/buffalo/brown-bear × lion/wolf/hyena pair. New species and
 * mechanics must keep these results bit for bit: design matrix, run summaries, aggregate and the
 * replay trace of the representative run. Keep this test forever; NEVER regenerate the fixture.
 */
interface GoldenCase {
  name: string;
  input: Record<string, unknown>;
  designHash: string;
  summaries: number[][];
  aggregate: Record<string, unknown>;
  trace: Record<string, unknown> & { run: number };
}

const golden = JSON.parse(
  readFileSync(new URL('./fixtures/v2-golden.json', import.meta.url), 'utf8'),
) as { capturedFrom: string; cases: GoldenCase[] };

const fnv = (h: number, bytes: Uint8Array): number => {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ (bytes[k] as number), 0x01000193);
  return h >>> 0;
};
const hex = (h: number): string => h.toString(16).padStart(8, '0');
const bytesOf = (a: ArrayBufferView): Uint8Array =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const hashOf = (a: ArrayBufferView): string => hex(fnv(0x811c9dc5, bytesOf(a)));

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

describe(`v0.2.0 species results reproduce bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every shipped preset and every non-default pair', () => {
    expect(golden.cases.filter((c) => c.name.startsWith('preset:'))).toHaveLength(7);
    expect(golden.cases.filter((c) => c.name.startsWith('pair:'))).toHaveLength(9);
  });

  it.each(golden.cases)('$name', (g) => {
    const config = sanitizeConfig(g.input);
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
    }).toEqual(g.aggregate);

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
