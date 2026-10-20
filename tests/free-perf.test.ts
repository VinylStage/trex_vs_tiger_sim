import { describe, expect, it } from 'vitest';
import { sanitizeConfig } from '../src/sim/config';
import { DT, simulateBattle } from '../src/sim/engine';
import { buildFreeDesign, sanitizeFreeConfig } from '../src/sim/free/config';
import { simulateFreeBattle } from '../src/sim/free/engine';
import { buildDesign, designRow } from '../src/sim/sampling';

/**
 * Cost of the free engine against the legacy engine at a comparable size (docs/PERFORMANCE.md,
 * "Free engine"). The work budget (`MAX_WORK`, `freeWorkEstimate`) counts agent-steps, so the
 * measure is wall time per simulated agent-step: Σ(ticks run × agents) over the runs. Target from
 * design §7: the free engine costs at most 1.5× the legacy engine per agent-step.
 *
 * Both engines run the same species and counts (T. rex vs tigers), alternately, best of several
 * rounds, so machine noise affects both sides alike. `BENCH=1` also prints the larger sizes used
 * in docs/PERFORMANCE.md.
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

/** Best (lowest) ns per agent-step of each engine over `rounds` alternating rounds. */
function compare(heavy: number, pack: number, runs: number, maxTime: number, rounds: number) {
  let legacy = Infinity;
  let free = Infinity;
  for (let k = 0; k < rounds; k++) {
    legacy = Math.min(legacy, nsPerStep(legacyRun(heavy, pack, runs, maxTime)));
    free = Math.min(free, nsPerStep(freeRun(heavy, pack, runs, maxTime)));
  }
  return { legacy, free, ratio: free / legacy };
}

describe('free engine cost per agent-step', () => {
  it('stays within 1.5× the legacy engine at 10 v 100', () => {
    const r = compare(10, 100, 6, 300, 3);
    expect(r.ratio).toBeLessThanOrEqual(1.5);
  }, 120_000);

  it.runIf(process.env['BENCH'])(
    'prints the PERFORMANCE.md table',
    () => {
      for (const [h, p, runs] of [
        [10, 100, 40],
        [50, 1000, 8],
        [500, 5000, 2],
      ] as const) {
        const r = compare(h, p, runs, 300, 3);
        console.log(
          `${h}v${p}: legacy ${r.legacy.toFixed(1)} ns/agent-step, free ${r.free.toFixed(1)}, ratio ${r.ratio.toFixed(2)}`,
        );
      }
    },
    1_800_000,
  );
});
