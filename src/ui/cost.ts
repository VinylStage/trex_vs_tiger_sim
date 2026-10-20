import type { ScenarioConfig } from '../sim/config';

export type CostLevel = 'ok' | 'heavy' | 'extreme';

type CostInput = Pick<ScenarioConfig, 'heavyCount' | 'packCount' | 'runs'>;

/**
 * Rough single-thread milliseconds per run on a typical laptop. Empirical fit of the engine
 * (fixed overhead + O(M) tiger updates scaled by periodic O(N·M) target searches); battle length
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
