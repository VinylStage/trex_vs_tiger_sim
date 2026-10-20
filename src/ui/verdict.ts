import type { AggregateResult } from '../sim/montecarlo';
import type { Interval } from '../sim/stats';
import { formatInt, formatPct } from './format';
import { t, type MsgKey } from './i18n';

/*
 * Headline framing (docs/research/UX_AUDIT.md P0-3): counts first ("498 of 500"), percentages
 * only as precise as the run count supports, and never 100% or 0% for a share that is not
 * exactly all or none of the runs.
 */

/** Decimals a share of `n` runs supports: none below 1,000 runs, one from 1,000. */
export function shareDigits(n: number): number {
  return n >= 1000 ? 1 : 0;
}

/**
 * `k / n` as a percentage with honest precision. All or none of the runs read "> 99%" / "< 1%"
 * (one decimal from 1,000 runs), and a share that would round to 0% or 100% is written the
 * same way instead.
 */
export function formatShare(k: number, n: number): string {
  if (n <= 0) return '—';
  const digits = shareDigits(n);
  const step = 10 ** -digits / 100;
  const p = k / n;
  const rounded = Math.round(p / step) * step;
  if (k >= n || rounded >= 1) return `> ${formatPct(1 - step, digits)}`;
  if (k <= 0 || rounded <= 0) return `< ${formatPct(step, digits)}`;
  return formatPct(p, digits);
}

/**
 * An observed share in a data table (a histogram bin): exactly none or all of the runs print
 * 0% / 100%, anything else as `formatShare` (never rounded onto 0% or 100%).
 */
export function formatCountShare(k: number, n: number): string {
  if (n <= 0) return '—';
  if (k <= 0) return formatPct(0, 0);
  if (k >= n) return formatPct(1, 0);
  return formatShare(k, n);
}

/** Wilson bounds of 0/n or n/n land within rounding error of 0 or 1. */
const EDGE = 1e-9;

/**
 * An interval bound with the share's precision. Bounds of 0 or 1 print as 0% / 100%; any other
 * bound gets one or two more decimals rather than rounding to them, and one still within 0.005
 * points of 0% or 100% after two decimals prints as "< 0.01%" / "> 99.99%".
 */
export function formatBound(x: number, n: number): string {
  if (x <= EDGE) return formatPct(0, 0);
  if (x >= 1 - EDGE) return formatPct(1, 0);
  let digits = shareDigits(n);
  while (digits < 2) {
    const step = 10 ** -digits / 100;
    const rounded = Math.round(x / step) * step;
    if (rounded > 0 && rounded < 1) break;
    digits++;
  }
  const step = 10 ** -digits / 100;
  const rounded = Math.round(x / step) * step;
  if (rounded <= 0) return `< ${formatPct(step, digits)}`;
  if (rounded >= 1) return `> ${formatPct(1 - step, digits)}`;
  return formatPct(x, digits);
}

export type OutcomeKind = 'heavy' | 'pack' | 'draw';

export interface Lead {
  kind: OutcomeKind;
  /** Runs with this outcome. */
  k: number;
  n: number;
  iv: Interval;
}

/** Every outcome with its count, in display order (heavy, pack, draw). */
export function outcomes(agg: AggregateResult): Lead[] {
  return [
    { kind: 'heavy', k: agg.heavyWins, n: agg.n, iv: agg.pHeavy },
    { kind: 'pack', k: agg.packWins, n: agg.n, iv: agg.pPack },
    { kind: 'draw', k: agg.draws, n: agg.n, iv: agg.pDraw },
  ];
}

/** The most frequent outcome (the first one on a tie). */
export function leadingOutcome(agg: AggregateResult): Lead {
  return outcomes(agg).reduce((a, b) => (b.k > a.k ? b : a));
}

const HEADLINE: Readonly<Record<OutcomeKind, MsgKey>> = {
  heavy: 'verdict.heavy',
  pack: 'verdict.pack',
  draw: 'verdict.draw',
};

/** "In 500 simulated battles under this model, the T-Rex side won 498 (> 99%)." */
export function headline(lead: Lead): string {
  return t(HEADLINE[lead.kind], {
    n: formatInt(lead.n),
    k: formatInt(lead.k),
    pct: formatShare(lead.k, lead.n),
  });
}

/** The plain-language precision line under the headline (the 95% Wilson interval). */
export function precisionLine(lead: Lead): string {
  return t('verdict.precision', intervalVars(lead));
}

export function intervalVars(lead: Lead): { lo: string; hi: string } {
  return { lo: formatBound(lead.iv.lo, lead.n), hi: formatBound(lead.iv.hi, lead.n) };
}
