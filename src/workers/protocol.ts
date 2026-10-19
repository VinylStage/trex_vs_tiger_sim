import type { ScenarioConfig } from '../sim/config';
import type { BattleTrace, RunSummary } from '../sim/engine';

/** Main thread → worker. */
export type WorkerRequest =
  | { type: 'run'; jobId: number; config: ScenarioConfig; start: number; end: number }
  | { type: 'replay'; jobId: number; config: ScenarioConfig; run: number };

/** Worker → main thread. */
export type WorkerResponse =
  | { type: 'progress'; jobId: number; done: number }
  | { type: 'result'; jobId: number; summaries: RunSummary[] }
  | { type: 'replay'; jobId: number; trace: BattleTrace }
  | { type: 'error'; jobId: number; message: string };
