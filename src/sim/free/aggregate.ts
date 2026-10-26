import { mean, quantileSorted, wilson, type Interval } from '../stats';
import type { FreeConfig } from './config';
import { FreeOutcome, emptyBuffStats, type BuffStats, type FreeRunSummary } from './engine';

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

/** Pack-buff activity of one side over a batch (design §6): per-run means and a median. */
export interface FreeBuffAggregate {
  /** Mean over runs of each BuffStats field (activeFrac is the mean buffed share of time). */
  mean: BuffStats;
  /** Median over runs of the seconds with at least one buffed member. */
  anyTimeMedian: number;
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
  buffA: FreeBuffAggregate;
  buffB: FreeBuffAggregate;
  /** Run whose outcome is the most common one and whose duration is closest to that outcome's median. */
  representativeRun: number;
}

/**
 * Rout share of the losing side (docs/design/RENEWAL-1.0.md §3.2): over the decided runs, the
 * loser's fled agents ÷ its fled + incapacitated agents, pooled. With `side` set, only the runs
 * that side lost count. NaN when no such run exists.
 */
export function routShare(summaries: readonly FreeRunSummary[], side?: 0 | 1): number {
  let fled = 0;
  let out = 0;
  for (const s of summaries) {
    if (s.outcome === FreeOutcome.Draw) continue;
    const loser = s.outcome === FreeOutcome.A ? 1 : 0;
    if (side !== undefined && side !== loser) continue;
    const routed = loser === 0 ? s.aRouted : s.bRouted;
    fled += routed;
    out += routed + (loser === 0 ? s.aKilled : s.bKilled);
  }
  return out > 0 ? fled / out : NaN;
}

/** Rout share of the losing side from which free results show a rout notice (**S**, design §3.2). */
export const ROUT_NOTICE_SHARE = 0.8;

/**
 * The rout a free result points out (design §3.2, #42): the side that won fewer runs, when it
 * fielded a group and at least `ROUT_NOTICE_SHARE` of it fled in the runs it lost. A lone animal
 * that withdraws is no group rout, so a side of one never gets the notice.
 */
export function routNotice(
  config: FreeConfig,
  agg: Pick<FreeAggregate, 'aWins' | 'bWins'>,
  summaries: readonly FreeRunSummary[],
): { side: 0 | 1; share: number } | null {
  if (agg.aWins === agg.bWins) return null;
  const side = agg.aWins < agg.bWins ? 0 : 1;
  if (config.sides[side].count < 2) return null;
  const share = routShare(summaries, side);
  return share >= ROUT_NOTICE_SHARE ? { side, share } : null;
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
  const buff = (pick: (s: FreeRunSummary) => BuffStats): FreeBuffAggregate => {
    const m = emptyBuffStats();
    for (const s of summaries) {
      const b = pick(s);
      for (const k of Object.keys(m) as (keyof BuffStats)[]) m[k] += b[k];
    }
    if (n > 0) for (const k of Object.keys(m) as (keyof BuffStats)[]) m[k] /= n;
    const any = Float64Array.from(summaries, (s) => pick(s).anyTime).sort();
    return { mean: m, anyTimeMedian: n > 0 ? quantileSorted(any, 0.5) : 0 };
  };
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
    buffA: buff((s) => s.buffA),
    buffB: buff((s) => s.buffB),
    representativeRun,
  };
}
