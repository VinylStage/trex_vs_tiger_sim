import type { ScenarioConfig } from './config';
import { DT, Outcome, simulateBattle, type RunSummary } from './engine';
import { PARAMS, type ParamId } from './params';
import { buildDesign, designRow, type Design } from './sampling';
import {
  histogram,
  mean,
  quantileSorted,
  spearman,
  wilson,
  type Histogram,
  type Interval,
} from './stats';

export function runChunk(
  config: ScenarioConfig,
  design: Design,
  start: number,
  end: number,
  onProgress?: (done: number) => void,
): RunSummary[] {
  const out: RunSummary[] = [];
  for (let run = start; run < end; run++) {
    out.push(simulateBattle(config, designRow(design, run), run).summary);
    onProgress?.(run - start + 1);
  }
  return out;
}

export function runAll(config: ScenarioConfig): { design: Design; summaries: RunSummary[] } {
  const design = buildDesign(config);
  return { design, summaries: runChunk(config, design, 0, config.runs) };
}

export interface Sensitivity {
  id: ParamId;
  rho: number;
}

export interface Distribution {
  mean: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface AggregateResult {
  n: number;
  trexWins: number;
  tigerWins: number;
  draws: number;
  pTrex: Interval;
  pTigers: Interval;
  pDraw: Interval;
  duration: Distribution & { hist: Histogram };
  trexSurvivors: Distribution & { hist: Histogram };
  tigersKilled: Distribution;
  tigersRouted: Distribution;
  /**
   * Pooled ratio: total tigers killed / total T-Rex lost across all runs.
   * Infinity when tigers died but no T-Rex did; NaN when nobody died.
   */
  exchangeRatio: number;
  sensitivity: Sensitivity[];
  /** Run index closest to the median trexAdvantage — a representative battle for replay. */
  representativeRun: number;
}

function dist(values: number[]): Distribution {
  const s = [...values].sort((a, b) => a - b);
  return {
    mean: mean(s),
    p5: quantileSorted(s, 0.05),
    p50: quantileSorted(s, 0.5),
    p95: quantileSorted(s, 0.95),
  };
}

export function aggregate(
  config: ScenarioConfig,
  design: Design,
  summaries: RunSummary[],
): AggregateResult {
  const sorted = [...summaries].sort((a, b) => a.run - b.run);
  const n = sorted.length;
  let trexWins = 0;
  let tigerWins = 0;
  let draws = 0;
  for (const s of sorted) {
    if (s.outcome === Outcome.Trex) trexWins++;
    else if (s.outcome === Outcome.Tigers) tigerWins++;
    else draws++;
  }
  const durations = sorted.map((s) => s.duration);
  const survivors = sorted.map((s) => s.trexAlive);
  const totalKilled = sorted.reduce((a, s) => a + s.tigersKilled, 0);
  const totalTrexLost = sorted.reduce((a, s) => a + (config.trexCount - s.trexAlive), 0);

  const adv = sorted.map((s) => s.trexAdvantage);
  const sensitivity: Sensitivity[] = PARAMS.map((p, j) => {
    const xs = sorted.map((s) => design.values[s.run * design.dims + j] as number);
    const rho = spearman(xs, adv);
    return { id: p.id, rho: Number.isFinite(rho) ? rho : 0 };
  }).sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  const medAdv = quantileSorted(
    [...adv].sort((a, b) => a - b),
    0.5,
  );
  let representativeRun = sorted[0]?.run ?? 0;
  let bestGap = Infinity;
  for (const s of sorted) {
    const gap = Math.abs(s.trexAdvantage - medAdv);
    if (gap < bestGap) {
      bestGap = gap;
      representativeRun = s.run;
    }
  }

  // Bin on the integer step grid so no bin straddles a different number of DT steps.
  const maxSteps = Math.round(config.maxTime / DT);
  const stepsPerBin = Math.max(1, Math.ceil(maxSteps / 30));
  const durBins = Math.ceil(maxSteps / stepsPerBin);
  const durHist = histogram(
    durations.map((d) => Math.round(d / DT)),
    durBins,
    0,
    durBins * stepsPerBin,
  );
  return {
    n,
    trexWins,
    tigerWins,
    draws,
    pTrex: wilson(trexWins, n),
    pTigers: wilson(tigerWins, n),
    pDraw: wilson(draws, n),
    duration: {
      ...dist(durations),
      hist: { min: 0, max: durBins * stepsPerBin * DT, counts: durHist.counts },
    },
    trexSurvivors: {
      ...dist(survivors),
      hist: histogram(survivors, config.trexCount + 1, -0.5, config.trexCount + 0.5),
    },
    tigersKilled: dist(sorted.map((s) => s.tigersKilled)),
    tigersRouted: dist(sorted.map((s) => s.tigersRouted)),
    exchangeRatio:
      totalTrexLost > 0 ? totalKilled / totalTrexLost : totalKilled > 0 ? Infinity : NaN,
    sensitivity,
    representativeRun,
  };
}
