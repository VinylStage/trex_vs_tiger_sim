import { describe, expect, it } from 'vitest';
import type { ScenarioConfig } from '../src/sim/config';
import { CONSTANTS, DT, simulateBattle, type RunSummary } from '../src/sim/engine';
import { EVENT_STRIDE } from '../src/sim/events';
import { buildDesign, designRow } from '../src/sim/sampling';
import {
  checkTrace,
  countRng,
  framesDiff,
  framesHash,
  noAttackParams,
  scenario,
} from './trace-helpers';

/**
 * Golden values captured from the engine at origin/main 48905d4 (before the event log existed):
 * summary with `trace = false`, frame count and `framesHash` with `trace = true`.
 * The event log must not change any of them.
 */
const GOLDEN: {
  name: string;
  config: Partial<ScenarioConfig>;
  run: number;
  summary: RunSummary;
  frames: number;
  hash: string;
}[] = [
  {
    name: 'default 10v100',
    config: { runs: 20 },
    run: 7,
    summary: {
      run: 7,
      outcome: 0,
      duration: 44.300000000000004,
      heavyAlive: 10,
      packKilled: 9,
      packRouted: 91,
      packActive: 0,
      heavyHpFrac: 0.9931273613431432,
      heavyAdvantage: 0.9931273613431432,
    },
    frames: 90,
    hash: '16ae2462',
  },
  {
    name: '1v10 direct, no morale',
    config: {
      heavyCount: 1,
      packCount: 10,
      runs: 10,
      packTactic: 'direct',
      morale: false,
      seed: 12345,
      maxTime: 300,
    },
    run: 3,
    summary: {
      run: 3,
      outcome: 0,
      duration: 128.70000000000002,
      heavyAlive: 1,
      packKilled: 10,
      packRouted: 0,
      packActive: 0,
      heavyHpFrac: 0.9697349086873143,
      heavyAdvantage: 0.9697349086873143,
    },
    frames: 259,
    hash: 'd7c05199',
  },
  {
    name: '3v300 small arena',
    config: { heavyCount: 3, packCount: 300, runs: 4, arenaSize: 400, maxTime: 120, seed: 777 },
    run: 1,
    summary: {
      run: 1,
      outcome: 0,
      duration: 27.5,
      heavyAlive: 3,
      packKilled: 16,
      packRouted: 284,
      packActive: 0,
      heavyHpFrac: 0.9743214195636078,
      heavyAdvantage: 0.9743214195636078,
    },
    frames: 56,
    hash: 'c7b3a6e6',
  },
];

// Long no-attack churn: frames decimate (0.5 s → 1 s) and the real P1 cap is reached.
const CHURN: ScenarioConfig = scenario({
  heavyCount: 1,
  packCount: 3000,
  runs: 2,
  arenaSize: 300,
  maxTime: 340,
  seed: 99,
  morale: false,
  params: noAttackParams(),
});
const CHURN_GOLDEN = {
  summary: {
    run: 0,
    outcome: 2,
    duration: 340,
    heavyAlive: 1,
    packKilled: 0,
    packRouted: 0,
    packActive: 3000,
    heavyHpFrac: 1,
    heavyAdvantage: 0,
  } satisfies RunSummary,
  frames: 341,
  hash: '7541d880',
};

describe('event log determinism against main (C1 golden)', () => {
  it.each(GOLDEN)('$name: summary and frames unchanged', (g) => {
    const c = scenario(g.config);
    const row = designRow(buildDesign(c), g.run);
    expect(simulateBattle(c, row, g.run).summary).toEqual(g.summary);
    const out = simulateBattle(c, row, g.run, true);
    expect(out.summary).toEqual(g.summary);
    const trace = out.trace;
    if (!trace) throw new Error('no trace');
    expect(trace.frames.length).toBe(g.frames);
    expect(framesHash(trace.frames)).toBe(g.hash);
    expect(trace.eventStats.p0).toBeGreaterThan(0);
    const check = checkTrace(trace, out.summary);
    expect(check.problems).toEqual([]);
  });

  it('decimating churn run: unchanged, reconstructs, and stays within the real budget (C5)', () => {
    const out = simulateBattle(CHURN, designRow(buildDesign(CHURN), 0), 0, true);
    const trace = out.trace;
    if (!trace) throw new Error('no trace');
    expect(out.summary).toEqual(CHURN_GOLDEN.summary);
    expect(trace.frames.length).toBe(CHURN_GOLDEN.frames);
    expect(framesHash(trace.frames)).toBe(CHURN_GOLDEN.hash);
    expect((trace.frames[2]?.t ?? 0) - (trace.frames[1]?.t ?? 0)).toBeCloseTo(1, 9);

    const s = trace.eventStats;
    expect(s.p1).toBe(CONSTANTS.eventP1Cap);
    expect(s.p1Dropped).toBeGreaterThan(0);
    expect(s.p1Coalesced).toBeGreaterThan(0);
    expect(s.p0Dropped).toBe(0);
    expect(trace.eventsCompleteUntilStep).toBe(Math.round(out.summary.duration / DT));
    expect(trace.events.length).toBe((s.p0 + s.p1) * EVENT_STRIDE);
    expect(trace.events.byteLength).toBeLessThanOrEqual(
      (CONSTANTS.eventP0Cap + CONSTANTS.eventP1Cap) * EVENT_STRIDE * 2,
    );
    const check = checkTrace(trace, out.summary);
    expect(check.problems).toEqual([]);
    expect(check.samples).toBe(CHURN_GOLDEN.frames * 3001);
  });
});

/**
 * C1–C3 over a scaled-down scenario matrix (docs/research/ANIMATION.md §7). For every run:
 * - C1: summary identical for trace off / trace with events / trace without events; frames
 *   bit-identical with and without events.
 * - C2: identical number of random draws in all three.
 * - C3: event-derived states equal every frame sample; no P0 event dropped.
 */
const MATRIX: { name: string; config: ScenarioConfig; latches?: false }[] = [
  { name: '1v1', config: scenario({ heavyCount: 1, packCount: 1, runs: 30 }) },
  { name: '1v10', config: scenario({ heavyCount: 1, packCount: 10, runs: 16 }) },
  { name: '1v100', config: scenario({ heavyCount: 1, packCount: 100, runs: 6 }) },
  { name: '10v100', config: scenario({ runs: 8 }) },
  {
    name: '10v100 direct, no morale',
    config: scenario({ runs: 3, packTactic: 'direct', morale: false, maxTime: 120 }),
  },
  {
    name: '10v1000 (60 s)',
    config: scenario({ heavyCount: 10, packCount: 1000, runs: 2, maxTime: 60 }),
  },
  {
    name: '50v1000 (60 s)',
    config: scenario({ heavyCount: 50, packCount: 1000, runs: 1, maxTime: 60 }),
  },
  {
    name: '1v5000 churn (30 s)',
    config: scenario({
      heavyCount: 1,
      packCount: 5000,
      runs: 1,
      maxTime: 30,
      morale: false,
      params: noAttackParams(),
    }),
    latches: false,
  },
];

describe('event log determinism and reconstruction over the scenario matrix (C1–C3)', () => {
  it.each(MATRIX)('$name', ({ config, latches }) => {
    const design = buildDesign(config);
    let events = 0;
    let samples = 0;
    let latched = 0;
    for (let run = 0; run < config.runs; run++) {
      const row = designRow(design, run);
      const plain = countRng(() => simulateBattle(config, row, run));
      const withEvents = countRng(() => simulateBattle(config, row, run, true));
      const noEvents = countRng(() => simulateBattle(config, row, run, true, { events: false }));

      expect(withEvents.value.summary).toEqual(plain.value.summary);
      expect(noEvents.value.summary).toEqual(plain.value.summary);
      expect(withEvents.calls).toBe(plain.calls);
      expect(noEvents.calls).toBe(plain.calls);

      const trace = withEvents.value.trace;
      const bare = noEvents.value.trace;
      if (!trace || !bare) throw new Error('no trace');
      expect(framesDiff(trace.frames, bare.frames)).toBe(0);
      expect(bare.events.length).toBe(0);
      expect(bare.eventsCompleteUntilStep).toBe(0);

      expect(trace.eventStats.p0Dropped).toBe(0);
      expect(trace.eventsCompleteUntilStep).toBe(Math.round(plain.value.summary.duration / DT));
      const check = checkTrace(trace, plain.value.summary);
      expect(check.problems).toEqual([]);
      events += trace.events.length / EVENT_STRIDE;
      samples += check.samples;
      latched += check.latchedSamples;
    }
    expect(events).toBeGreaterThan(0);
    expect(samples).toBeGreaterThan(0);
    if (latches !== false) expect(latched).toBeGreaterThan(0);
  });
});
