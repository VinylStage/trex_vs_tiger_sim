import type { ScenarioConfig } from './config';
import { DT, Outcome, simulateBattle, type RunSummary } from './engine';
import { PARAMS, type ParamId } from './params';
import { buildDesign, designRow, type Design } from './sampling';
import {
  histogram,
  mean,
  pearson,
  quantileSorted,
  ranks,
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

/** Fields of a RunSummary in the order `packSummaries` stores them. */
const SUMMARY_FIELDS = [
  'run',
  'outcome',
  'duration',
  'heavyAlive',
  'packKilled',
  'packRouted',
  'packActive',
  'heavyHpFrac',
  'heavyAdvantage',
] as const satisfies readonly (keyof RunSummary)[];

/** Numbers per run in a packed summary buffer. */
export const SUMMARY_STRIDE = SUMMARY_FIELDS.length;

/**
 * Pack run summaries into one Float64Array (9 numbers per run), so they cross to a worker as a
 * single transferable buffer instead of thousands of cloned objects. Every field is a double or a
 * small integer, so `unpackSummaries` returns exactly the same values.
 */
export function packSummaries(summaries: readonly RunSummary[]): Float64Array<ArrayBuffer> {
  const out = new Float64Array(summaries.length * SUMMARY_STRIDE);
  summaries.forEach((s, i) => {
    SUMMARY_FIELDS.forEach((f, k) => {
      out[i * SUMMARY_STRIDE + k] = s[f];
    });
  });
  return out;
}

export function unpackSummaries(packed: Float64Array): RunSummary[] {
  const n = Math.floor(packed.length / SUMMARY_STRIDE);
  const out: RunSummary[] = new Array<RunSummary>(n);
  for (let i = 0; i < n; i++) {
    const at = (k: number): number => packed[i * SUMMARY_STRIDE + k] as number;
    out[i] = {
      run: at(0),
      outcome: at(1) as RunSummary['outcome'],
      duration: at(2),
      heavyAlive: at(3),
      packKilled: at(4),
      packRouted: at(5),
      packActive: at(6),
      heavyHpFrac: at(7),
      heavyAdvantage: at(8),
    };
  }
  return out;
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
  heavyWins: number;
  packWins: number;
  draws: number;
  pHeavy: Interval;
  pPack: Interval;
  pDraw: Interval;
  duration: Distribution & { hist: Histogram };
  heavySurvivors: Distribution & { hist: Histogram };
  packKilled: Distribution;
  packRouted: Distribution;
  /**
   * Pooled ratio: total pack animals killed / total heavy lost across all runs.
   * Infinity when pack animals died but no heavy did; NaN when nobody died.
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
  let heavyWins = 0;
  let packWins = 0;
  let draws = 0;
  for (const s of sorted) {
    if (s.outcome === Outcome.Heavy) heavyWins++;
    else if (s.outcome === Outcome.Pack) packWins++;
    else draws++;
  }
  const durations = sorted.map((s) => s.duration);
  const survivors = sorted.map((s) => s.heavyAlive);
  const totalKilled = sorted.reduce((a, s) => a + s.packKilled, 0);
  const totalHeavyLost = sorted.reduce((a, s) => a + (config.heavyCount - s.heavyAlive), 0);

  const adv = sorted.map((s) => s.heavyAdvantage);
  // Spearman's rho = Pearson on ranks. The outcome is ranked once instead of once per
  // parameter; the result is the same number as spearman(xs, adv) bit for bit.
  const advRanks = ranks(adv);
  const xs = new Float64Array(n);
  const sensitivity: Sensitivity[] = PARAMS.map((p, j) => {
    for (let i = 0; i < n; i++) {
      xs[i] = design.values[(sorted[i] as RunSummary).run * design.dims + j] as number;
    }
    const rho = pearson(ranks(xs), advRanks);
    return { id: p.id, rho: Number.isFinite(rho) ? rho : 0 };
  }).sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  const medAdv = quantileSorted(
    [...adv].sort((a, b) => a - b),
    0.5,
  );
  let representativeRun = sorted[0]?.run ?? 0;
  let bestGap = Infinity;
  for (const s of sorted) {
    const gap = Math.abs(s.heavyAdvantage - medAdv);
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
    heavyWins,
    packWins,
    draws,
    pHeavy: wilson(heavyWins, n),
    pPack: wilson(packWins, n),
    pDraw: wilson(draws, n),
    duration: {
      ...dist(durations),
      hist: { min: 0, max: durBins * stepsPerBin * DT, counts: durHist.counts },
    },
    heavySurvivors: {
      ...dist(survivors),
      hist: histogram(survivors, config.heavyCount + 1, -0.5, config.heavyCount + 0.5),
    },
    packKilled: dist(sorted.map((s) => s.packKilled)),
    packRouted: dist(sorted.map((s) => s.packRouted)),
    exchangeRatio:
      totalHeavyLost > 0 ? totalKilled / totalHeavyLost : totalKilled > 0 ? Infinity : NaN,
    sensitivity,
    representativeRun,
  };
}
