// Types for matrix.mjs, so the `/bench/` page and tests/bench.test.ts type-check without allowJs.

import type { MatrixSim, Scenario } from './lib.d.mts';

export type { MatrixSim, Scenario };

/** What `configOf` and `timeScenario` need of a bundled engine (bench/harness.mjs). */
export interface TimingSim extends MatrixSim {
  DT: number;
  FREE_MODEL_VERSION: number;
  sanitizeFreeConfig(raw: unknown): { runs: number; mv: number };
  buildFreeDesign(config: never): unknown;
  designRow(design: never, run: number): unknown;
  simulateFreeBattle(config: never, row: never, run: number): { summary: { duration: number } };
  packFreeSummaries(summaries: never): Float64Array<ArrayBuffer>;
}

export interface ScenarioTiming {
  id: string;
  runs: number;
  mv: number;
  /** ms of every timed run, in run order, repeats included. */
  times: number[];
  total: number;
  steps: number;
  /** `packFreeSummaries` of each repeat of the batch. */
  packed: Float64Array<ArrayBuffer>[];
}

export interface TimeStats {
  msMedian: number;
  msP95: number;
  msMean: number;
  agentStepsPerSec: number;
}

export function expandMatrix(
  spec: unknown,
  sim: MatrixSim,
  options?: { reduced?: boolean },
): Scenario[];
export function percentile(sorted: readonly number[], q: number): number;
export function median(xs: readonly number[]): number;
export function configOf(sim: TimingSim, spec: unknown, s: Scenario): unknown;
export function timeScenario(
  sim: TimingSim,
  spec: unknown,
  s: Scenario,
  options?: { minMs?: number },
): ScenarioTiming;
export function timeStats(t: Pick<ScenarioTiming, 'times' | 'total' | 'steps'>): TimeStats;
export function packedBytes(packed: Float64Array): Uint8Array;
export function matrixHashInput(results: readonly { id: string; hash: string }[]): string;
export function warmUpSet(matrix: readonly Scenario[]): Scenario[];
