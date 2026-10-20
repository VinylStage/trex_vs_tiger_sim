import { describe, expect, it } from 'vitest';
import { sanitizeConfig, workEstimate } from '../src/sim/config';
import { DT, simulateBattle } from '../src/sim/engine';
import { buildFreeDesign, freeWorkEstimate, sanitizeFreeConfig } from '../src/sim/free/config';
import { simulateFreeBattle } from '../src/sim/free/engine';
import { buildDesign, designRow } from '../src/sim/sampling';

/**
 * Cost of the free engine against the legacy engine at a comparable size (docs/PERFORMANCE.md,
 * "Free engine"). The work budget (`MAX_WORK`, `freeWorkEstimate`) counts agent-steps, so the
 * measure is wall time per simulated agent-step: Σ(ticks run × agents) over the runs. Target from
 * design §7: the free engine costs at most 1.5× the legacy engine per agent-step.
 *
 * Both engines run the same species and counts (T. rex vs tigers), alternately, and the gate
 * uses the median ratio of several rounds, so machine noise affects both sides alike.
 *
 * Wall time is not deterministic: on a loaded machine (CI, parallel agents) a single slow round
 * failed the gate although the engine is about 0.7× the legacy cost. The timing gate therefore
 * runs only with `BENCH=1` (#82); the default suite checks the deterministic half of the claim,
 * that the work budget counts the free engine's agent-steps exactly like the legacy ones.
 */

interface Sample {
  ms: number;
  agentSteps: number;
}

function legacyRun(heavy: number, pack: number, runs: number, maxTime: number): Sample {
  const c = sanitizeConfig({ heavyCount: heavy, packCount: pack, runs, maxTime });
  const d = buildDesign(c);
  let agentSteps = 0;
  const t0 = performance.now();
  for (let r = 0; r < runs; r++) {
    const s = simulateBattle(c, designRow(d, r), r).summary;
    agentSteps += Math.round(s.duration / DT) * (heavy + pack);
  }
  return { ms: performance.now() - t0, agentSteps };
}

function freeRun(heavy: number, pack: number, runs: number, maxTime: number): Sample {
  const c = sanitizeFreeConfig({
    runs,
    maxTime,
    sides: [
      { species: 'trex', count: heavy },
      { species: 'tiger', count: pack },
    ],
  });
  const d = buildFreeDesign(c);
  let agentSteps = 0;
  const t0 = performance.now();
  for (let r = 0; r < runs; r++) {
    const s = simulateFreeBattle(c, designRow(d, r), r).summary;
    agentSteps += Math.round(s.duration / DT) * (heavy + pack);
  }
  return { ms: performance.now() - t0, agentSteps };
}

const nsPerStep = (s: Sample): number => (s.ms * 1e6) / s.agentSteps;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/**
 * Median ns per agent-step of each engine, and the median of the per-round ratios, over `rounds`
 * interleaved rounds (legacy, free, legacy, free, …) after one warm-up round each.
 */
function compare(heavy: number, pack: number, runs: number, maxTime: number, rounds: number) {
  legacyRun(heavy, pack, runs, maxTime);
  freeRun(heavy, pack, runs, maxTime);
  const legacy: number[] = [];
  const free: number[] = [];
  const ratios: number[] = [];
  for (let k = 0; k < rounds; k++) {
    const l = nsPerStep(legacyRun(heavy, pack, runs, maxTime));
    const f = nsPerStep(freeRun(heavy, pack, runs, maxTime));
    legacy.push(l);
    free.push(f);
    ratios.push(f / l);
  }
  return { legacy: median(legacy), free: median(free), ratio: median(ratios) };
}

describe('free engine work budget (deterministic)', () => {
  it('estimates the same agent-steps as the legacy engine for the same matchup', () => {
    for (const [heavy, pack, runs, maxTime] of [
      [10, 100, 6, 300],
      [1, 1, 20000, 60],
      [500, 5000, 2, 600],
    ] as const) {
      const legacy = sanitizeConfig({ heavyCount: heavy, packCount: pack, runs, maxTime });
      const free = sanitizeFreeConfig({
        runs,
        maxTime,
        sides: [
          { species: 'trex', count: heavy },
          { species: 'tiger', count: pack },
        ],
      });
      expect(freeWorkEstimate(free)).toBe(workEstimate(legacy));
    }
  });

  it('never simulates more agent-steps than the budget counted (10 v 100)', () => {
    const free = freeRun(10, 100, 6, 300);
    const budget = freeWorkEstimate(
      sanitizeFreeConfig({
        runs: 6,
        maxTime: 300,
        sides: [
          { species: 'trex', count: 10 },
          { species: 'tiger', count: 100 },
        ],
      }),
    );
    expect(free.agentSteps).toBeGreaterThan(0);
    expect(free.agentSteps).toBeLessThanOrEqual(budget);
  });
});

describe('free engine cost per agent-step (BENCH=1)', () => {
  it.runIf(process.env['BENCH'])(
    'stays within 1.5× the legacy engine at 10 v 100 (median of 7 interleaved rounds)',
    () => {
      const r = compare(10, 100, 6, 300, 7);
      expect(r.ratio).toBeLessThanOrEqual(1.5);
    },
    300_000,
  );

  it.runIf(process.env['BENCH'])(
    'prints the PERFORMANCE.md table',
    () => {
      for (const [h, p, runs] of [
        [10, 100, 40],
        [50, 1000, 8],
        [500, 5000, 2],
      ] as const) {
        const r = compare(h, p, runs, 300, 5);
        console.log(
          `${h}v${p}: legacy ${r.legacy.toFixed(1)} ns/agent-step, free ${r.free.toFixed(1)}, ratio ${r.ratio.toFixed(2)}`,
        );
      }
    },
    1_800_000,
  );
});
