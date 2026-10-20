import { describe, expect, it } from 'vitest';
import { sanitizeConfig } from '../src/sim/config';
import { DT, simulateBattle } from '../src/sim/engine';
import { buildFreeDesign, freeWorkWeight, sanitizeFreeConfig } from '../src/sim/free/config';
import { simulateFreeBattle } from '../src/sim/free/engine';
import { buildDesign, designRow } from '../src/sim/sampling';

/**
 * Cost of the free engine against the legacy engine at a comparable size (docs/PERFORMANCE.md,
 * "Free engine"). The work budget (`MAX_WORK`, `freeWorkEstimate`) counts agent-steps, so the
 * measure is wall time per simulated agent-step: Σ(ticks run × agents) over the runs. Target from
 * design §7: the free engine costs at most 1.5× the legacy engine per agent-step.
 *
 * Both engines run the same species and counts (T. rex vs tigers, and T. rex vs wolves with the
 * pack buff on for the free engine), alternately, best of several
 * rounds, so machine noise affects both sides alike. `BENCH=1` also prints the larger sizes used
 * in docs/PERFORMANCE.md.
 */

interface Sample {
  ms: number;
  agentSteps: number;
}

function legacyRun(
  species: string,
  heavy: number,
  pack: number,
  runs: number,
  maxTime: number,
): Sample {
  const c = sanitizeConfig({
    packSpecies: species,
    heavyCount: heavy,
    packCount: pack,
    runs,
    maxTime,
  });
  const d = buildDesign(c);
  let agentSteps = 0;
  const t0 = performance.now();
  for (let r = 0; r < runs; r++) {
    const s = simulateBattle(c, designRow(d, r), r).summary;
    agentSteps += Math.round(s.duration / DT) * (heavy + pack);
  }
  return { ms: performance.now() - t0, agentSteps };
}

function freeRun(
  species: string,
  heavy: number,
  pack: number,
  runs: number,
  maxTime: number,
): Sample {
  const c = sanitizeFreeConfig({
    runs,
    maxTime,
    sides: [
      { species: 'trex', count: heavy },
      { species, count: pack },
    ],
  });
  const d = buildFreeDesign(c);
  let agentSteps = 0;
  const t0 = performance.now();
  for (let r = 0; r < runs; r++) {
    const s = simulateFreeBattle(c, designRow(d, r), r).summary;
    agentSteps += Math.round(s.duration / DT) * (heavy + pack) * freeWorkWeight(c);
  }
  return { ms: performance.now() - t0, agentSteps };
}

const nsPerStep = (s: Sample): number => (s.ms * 1e6) / s.agentSteps;

/** Best (lowest) ns per agent-step of each engine over `rounds` alternating rounds. */
function compare(
  species: string,
  heavy: number,
  pack: number,
  runs: number,
  maxTime: number,
  rounds: number,
) {
  let legacy = Infinity;
  let free = Infinity;
  for (let k = 0; k < rounds; k++) {
    legacy = Math.min(legacy, nsPerStep(legacyRun(species, heavy, pack, runs, maxTime)));
    free = Math.min(free, nsPerStep(freeRun(species, heavy, pack, runs, maxTime)));
  }
  return { legacy, free, ratio: free / legacy };
}

describe('free engine cost per agent-step', () => {
  // Retried: a timing gate, so only a sustained slowdown under full-suite load fails it.
  it('stays within 1.5× the legacy engine at 10 v 100', { timeout: 120_000, retry: 2 }, () => {
    const r = compare('tiger', 10, 100, 6, 300, 5);
    expect(r.ratio).toBeLessThanOrEqual(1.5);
  });

  // Retried: a timing gate, so only a sustained slowdown under full-suite load fails it.
  it(
    'stays within 1.5× per weighted agent-step with the pack buff on (10 T. rex v 100 wolves)',
    { timeout: 120_000, retry: 2 },
    () => {
      const r = compare('wolf', 10, 100, 6, 300, 5);
      expect(r.ratio).toBeLessThanOrEqual(1.5);
    },
  );

  it.runIf(process.env['BENCH'])(
    'prints the PERFORMANCE.md table',
    () => {
      for (const [sp, h, p, runs] of [
        ['tiger', 10, 100, 40],
        ['tiger', 50, 1000, 8],
        ['tiger', 500, 5000, 2],
        ['wolf', 10, 100, 40],
        ['wolf', 50, 1000, 8],
        ['wolf', 500, 5000, 2],
      ] as const) {
        const r = compare(sp, h, p, runs, 300, 3);
        console.log(
          `${sp} ${h}v${p}: legacy ${r.legacy.toFixed(1)} ns/agent-step, free ${r.free.toFixed(1)}, ratio ${r.ratio.toFixed(2)}`,
        );
      }
    },
    1_800_000,
  );
});
