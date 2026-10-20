import { maxRunsFor, type ScenarioConfig } from '../sim/config';

export type CostLevel = 'ok' | 'heavy' | 'extreme';

type CostInput = Pick<ScenarioConfig, 'heavyCount' | 'packCount' | 'runs'>;

/**
 * Rough single-thread milliseconds per run on a typical laptop. Empirical fit of the engine
 * (fixed overhead + O(M) pack animal updates scaled by periodic O(N·M) target searches); battle length
 * varies a lot with parameters, so treat this as an order of magnitude.
 */
export function estimateRunMs(heavyCount: number, packCount: number): number {
  return 15 + 0.15 * packCount * (1 + heavyCount / 25);
}

/** Rough wall-clock milliseconds for the whole scenario on `workers` threads. */
export function estimateTotalMs(c: CostInput, workers: number): number {
  return (c.runs * estimateRunMs(c.heavyCount, c.packCount)) / Math.max(1, workers);
}

/** Wall-clock thresholds (ms) above which the UI warns before running. */
export const COST_THRESHOLDS = { heavy: 60_000, extreme: 600_000 } as const;

export function costLevel(c: CostInput, workers: number): CostLevel {
  const ms = estimateTotalMs(c, workers);
  if (ms >= COST_THRESHOLDS.extreme) return 'extreme';
  if (ms >= COST_THRESHOLDS.heavy) return 'heavy';
  return 'ok';
}

export interface CostSummary {
  /** The run count the work budget reduces the runs to, or null when they fit. */
  cap: number | null;
  level: CostLevel;
  /** Rough wall-clock milliseconds for the runs that will actually be done. */
  etaMs: number;
}

/** What running `c` will cost: the work-budget cap (if any) and the time estimate after it. */
export function costSummary(
  c: Pick<ScenarioConfig, 'heavyCount' | 'packCount' | 'runs' | 'maxTime'>,
  workers: number,
): CostSummary {
  const max = maxRunsFor(c);
  const capped = c.runs > max;
  const effective = capped ? { ...c, runs: max } : c;
  return {
    cap: capped ? max : null,
    level: costLevel(effective, workers),
    etaMs: estimateTotalMs(effective, workers),
  };
}

/** Nothing to warn about: the runs fit the budget and finish in under a minute. */
export function isCostOk(s: CostSummary): boolean {
  return s.cap === null && s.level === 'ok';
}
