import type { ScenarioConfig } from '../sim/config';
import type { BattleTrace, RunSummary } from '../sim/engine';
import type { FreeConfig } from '../sim/free/config';
import type { FreeRunSummary } from '../sim/free/engine';
import type { FreeAggregate } from '../sim/free/aggregate';
import type { AggregateResult } from '../sim/montecarlo';

/** Main thread → worker. */
export type WorkerRequest =
  /** A free-model config (`mode: 'free'`) runs on the free engine (src/sim/free). */
  | { type: 'run'; jobId: number; config: ScenarioConfig | FreeConfig; start: number; end: number }
  | { type: 'replay'; jobId: number; config: ScenarioConfig; run: number }
  /** `summaries` is `packSummaries(...)` of every run, transferred (src/sim/montecarlo.ts). */
  | { type: 'aggregate'; jobId: number; config: ScenarioConfig; summaries: Float64Array }
  /** `summaries` is `packFreeSummaries(...)` (src/sim/free/montecarlo.ts), transferred. */
  | { type: 'aggregate-free'; jobId: number; config: FreeConfig; summaries: Float64Array };

/** Worker → main thread. */
export type WorkerResponse =
  | { type: 'progress'; jobId: number; done: number }
  | { type: 'result'; jobId: number; summaries: RunSummary[] | FreeRunSummary[] }
  | { type: 'replay'; jobId: number; trace: BattleTrace }
  | { type: 'aggregate'; jobId: number; agg: AggregateResult }
  | { type: 'aggregate-free'; jobId: number; agg: FreeAggregate }
  | { type: 'error'; jobId: number; message: string };

/**
 * Every ArrayBuffer of a trace (frames, event log, meta), for a zero-copy postMessage transfer.
 * Each buffer appears once; a duplicate would make postMessage throw.
 */
export function traceTransferList(trace: BattleTrace): ArrayBuffer[] {
  const list: ArrayBuffer[] = [trace.events.buffer, trace.meta.reach.buffer, trace.meta.arc.buffer];
  for (const f of trace.frames) list.push(f.heavy.buffer, f.pack.buffer);
  return list;
}
