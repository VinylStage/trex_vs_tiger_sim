import type { Scenario } from '../../bench/matrix.mjs';
import type { Intervention } from '../sim/free/interventions';

/**
 * Messages between the `/bench/` page and its workers (src/bench/bench.worker.ts). The page sends
 * preset ids and the scenario of bench/scenarios.json, never a config: the worker builds every
 * config itself from the preset registry at the page's seed.
 */
export type BenchRequest =
  /** A few untimed runs of the matrix's small scenarios, so timed runs see optimised code. */
  | { type: 'warm'; id: number }
  /** One run of a preset with its full trace, timed like the live worker's `replay-free`. */
  | {
      type: 'live';
      id: number;
      preset: string;
      seed: number;
      run: number;
      interventions: readonly Intervention[];
    }
  /** Runs `[start, end)` of the preset's Simple batch, each timed on its own, without traces. */
  | { type: 'batch'; id: number; preset: string; seed: number; start: number; end: number }
  /** One scenario of the reduced matrix (bench/matrix.mjs `timeScenario`). */
  | { type: 'scenario'; id: number; scenario: Scenario; minMs: number };

export type BenchResponse =
  | { type: 'warm'; id: number }
  | { type: 'live'; id: number; ms: number; durationS: number }
  | { type: 'batch'; id: number; times: number[] }
  /**
   * ms/run of the scenario and the packed summaries of its first repeat (transferred), which the
   * page hashes; `consistent` is false when a repeat gave other results.
   */
  | {
      type: 'scenario';
      id: number;
      runs: number;
      msMedian: number;
      msP95: number;
      packed: Float64Array<ArrayBuffer>;
      consistent: boolean;
    }
  | { type: 'error'; id: number; message: string };

/** A request without its id: the page's worker wrapper adds one. */
export type BenchCall = BenchRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, 'id'>
    : never
  : never;
