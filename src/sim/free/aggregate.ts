import { mean, quantileSorted, wilson, type Interval } from '../stats';
import type { FreeConfig } from './config';
import { FreeOutcome, type FreeRunSummary } from './engine';

/**
 * Aggregate of a free-model batch (docs/design/FREE-MATCHUPS.md §6): win shares per side with
 * Wilson intervals and per-side casualty means. No sensitivity analysis yet; it is cheap enough
 * for the main thread.
 */

export interface FreeSideStats {
  /** Mean survivors (alive, active or fled) per run. */
  survivors: number;
  /** Mean agents incapacitated (killed) per run. */
  killed: number;
  /** Mean agents that fled (routed or left) per run. */
  routed: number;
  /** Mean agents still fighting at the end of a run. */
  active: number;
}

export interface FreeAggregate {
  n: number;
  aWins: number;
  bWins: number;
  draws: number;
  pA: Interval;
  pB: Interval;
  pDraw: Interval;
  duration: { mean: number; p5: number; p50: number; p95: number };
  a: FreeSideStats;
  b: FreeSideStats;
  /** Run whose outcome is the most common one and whose duration is closest to that outcome's median. */
  representativeRun: number;
}

export function aggregateFree(
  _config: FreeConfig,
  summaries: readonly FreeRunSummary[],
): FreeAggregate {
  const n = summaries.length;
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  for (const s of summaries) {
    if (s.outcome === FreeOutcome.A) aWins++;
    else if (s.outcome === FreeOutcome.B) bWins++;
    else draws++;
  }
  const durations = Float64Array.from(summaries, (s) => s.duration).sort();
  const side = (pick: (s: FreeRunSummary) => [number, number, number, number]): FreeSideStats => {
    const v = summaries.map(pick);
    return {
      survivors: mean(v.map((x) => x[0])),
      killed: mean(v.map((x) => x[1])),
      routed: mean(v.map((x) => x[2])),
      active: mean(v.map((x) => x[3])),
    };
  };
  const common =
    aWins >= bWins && aWins >= draws
      ? FreeOutcome.A
      : bWins >= draws
        ? FreeOutcome.B
        : FreeOutcome.Draw;
  const ofCommon = summaries.filter((s) => s.outcome === common);
  const sortedCommon = Float64Array.from(ofCommon, (s) => s.duration).sort();
  const median = sortedCommon.length > 0 ? quantileSorted(sortedCommon, 0.5) : 0;
  let representativeRun = summaries[0]?.run ?? 0;
  let bestGap = Infinity;
  for (const s of ofCommon) {
    const gap = Math.abs(s.duration - median);
    if (gap < bestGap) {
      bestGap = gap;
      representativeRun = s.run;
    }
  }
  return {
    n,
    aWins,
    bWins,
    draws,
    pA: wilson(aWins, n),
    pB: wilson(bWins, n),
    pDraw: wilson(draws, n),
    duration: {
      mean: mean(durations),
      p5: n > 0 ? quantileSorted(durations, 0.05) : NaN,
      p50: n > 0 ? quantileSorted(durations, 0.5) : NaN,
      p95: n > 0 ? quantileSorted(durations, 0.95) : NaN,
    },
    a: side((s) => [s.aAlive, s.aKilled, s.aRouted, s.aActive]),
    b: side((s) => [s.bAlive, s.bKilled, s.bRouted, s.bActive]),
    representativeRun,
  };
}
