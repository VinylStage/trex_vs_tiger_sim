import { expandMatrix, timeScenario, timeStats, warmUpSet } from '../../bench/matrix.mjs';
import * as sim from '../../bench/harness.mjs';
import spec from '../../bench/scenarios.json';
import { DT } from '../sim/engine';
import { buildFreeDesign } from '../sim/free/design';
import { simulateFreeBattle } from '../sim/free/engine';
import { sanitizeInterventions } from '../sim/free/interventions';
import { FREE_PRESETS, presetConfig } from '../sim/free/presets';
import type { FreeConfig } from '../sim/free/config';
import { designRow, type Design } from '../sim/sampling';
import type { BenchRequest, BenchResponse } from './protocol';

/*
 * The worker of the `/bench/` page (#191). It runs the same engine bundle as the app's sim worker
 * and the same timing loop as `npm run bench` (bench/matrix.mjs, behind bench/harness.mjs), and
 * posts only numbers back. One script for every worker of the page, so the page needs one
 * Trusted Types policy, as the app does.
 */

const ctx = self as unknown as {
  postMessage(msg: BenchResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<BenchRequest>) => void) | null;
};

let cached: { key: string; config: FreeConfig; design: Design } | null = null;

/** The preset's config at the seed, and its design (cached: a pass asks for one preset at a time). */
function presetRun(id: string, seed: number): { config: FreeConfig; design: Design } {
  const key = `${id}:${seed}`;
  if (cached?.key !== key) {
    const p = FREE_PRESETS.find((x) => x.id === id);
    if (!p) throw new Error(`unknown preset ${id}`);
    const config = presetConfig(p, seed);
    cached = { key, config, design: buildFreeDesign(config) };
  }
  return cached;
}

const samePacked = (a: Float64Array, b: Float64Array): boolean =>
  a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

function handle(msg: BenchRequest): void {
  switch (msg.type) {
    case 'warm': {
      const matrix = expandMatrix(spec, sim, { reduced: true });
      for (const s of warmUpSet(matrix)) timeScenario(sim, spec, s);
      ctx.postMessage({ type: 'warm', id: msg.id });
      return;
    }
    case 'live': {
      const { config, design } = presetRun(msg.preset, msg.seed);
      const run = Math.max(0, Math.min(config.runs - 1, Math.floor(msg.run)));
      const interventions = sanitizeInterventions(
        msg.interventions,
        Math.round(config.maxTime / DT),
        config.mv,
        config,
      );
      const row = designRow(design, run);
      // As the app's live worker times it (src/workers/sim.worker.ts, `replay-free`): the
      // simulation with its trace, without the message transfer.
      const t0 = performance.now();
      const { trace, summary } = simulateFreeBattle(config, row, run, true, { interventions });
      const ms = performance.now() - t0;
      if (!trace) throw new Error('engine returned no trace');
      ctx.postMessage({ type: 'live', id: msg.id, ms, durationS: summary.duration });
      return;
    }
    case 'batch': {
      const { config, design } = presetRun(msg.preset, msg.seed);
      const start = Math.max(0, Math.min(config.runs, Math.floor(msg.start)));
      const end = Math.max(start, Math.min(config.runs, Math.floor(msg.end)));
      const times: number[] = [];
      for (let run = start; run < end; run++) {
        const row = designRow(design, run);
        const t0 = performance.now();
        simulateFreeBattle(config, row, run);
        times.push(performance.now() - t0);
      }
      ctx.postMessage({ type: 'batch', id: msg.id, times });
      return;
    }
    case 'scenario': {
      const t = timeScenario(sim, spec, msg.scenario, { minMs: msg.minMs });
      const first = t.packed[0] ?? new Float64Array(0);
      const consistent = t.packed.every((p) => samePacked(p, first));
      const { msMedian, msP95 } = timeStats(t);
      ctx.postMessage(
        { type: 'scenario', id: msg.id, runs: t.runs, msMedian, msP95, packed: first, consistent },
        [first.buffer],
      );
      return;
    }
  }
}

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    handle(msg);
  } catch (err) {
    ctx.postMessage({ type: 'error', id: msg.id, message: String(err) });
  }
};
