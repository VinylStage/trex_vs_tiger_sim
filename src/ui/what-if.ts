import { cardDef } from '../sim/free/cards';
import type { FreeConfig } from '../sim/free/config';
import { FreeOutcome, type FreeRunSummary } from '../sim/free/engine';
import type { Intervention, InterventionSide } from '../sim/free/interventions';
import { splitRuns } from './chunks';
import { h } from './dom';
import { formatPct } from './format';
import { t } from './i18n';
import { CancelledError, Priority, type Scheduler } from './scheduler';

/**
 * What-if shift of the offered cards (RENEWAL-1.0 §10.2 point 3, §4.3; #182). When a pause offers
 * its cards, each card is played at the pause tick T in N fresh battles of the same matchup, and
 * the win share of the side it is played on is shown before and after: "같은 대결 N판 기준". The
 * battles start from the beginning, so the numbers say what the card does to this matchup, not
 * to the battle on screen, and the label says so.
 *
 * - The battles are runs 0 … N − 1 of the match's config with `runs: WHATIF_DESIGN_RUNS`, the
 *   same runs with and without the card (paired, so the shift is not drowned in run-to-run noise).
 *   The design size is fixed, so a smaller N after degradation (#181) still uses the same runs.
 *   The baseline is one job per match, since it does not depend on T.
 * - A one-side card can be played on either side, so its N runs are split between the two sides
 *   (`whatIfOptions`), keeping the pause workload at 3 × N runs as gate (b) assumes (#181). The
 *   label always carries the N behind the number shown.
 * - The batches run as one P1 job on the batch workers, so they take over from the live chance
 *   (P2) within one chunk.
 */

/** Runs of the what-if design: the largest N (`WHATIF_RUNS[0]`, #181). */
export const WHATIF_DESIGN_RUNS = 200;

/** Shift (percentage points) from which a card gets the "card swing" marker (S, §4.3). */
export const CARD_SWING_PP = 15;

/** One what-if batch: a card on a side, with the number of battles behind it. */
export interface WhatIfOption {
  card: number;
  side: InterventionSide;
  /** Runs 0 … runs − 1 of the what-if config. */
  runs: number;
}

/** Win counts of N battles. */
export interface WinCounts {
  a: number;
  b: number;
  draw: number;
  n: number;
}

/** A card's shift for the side it is played on (side A for a card on both). */
export interface WhatIfShift {
  card: number;
  side: InterventionSide;
  /** The side whose win share is shown. */
  shownSide: 0 | 1;
  n: number;
  /** Win share of `shownSide` without and with the card, in [0, 1]. */
  before: number;
  after: number;
  /** after − before, in percentage points. */
  deltaPp: number;
  swing: boolean;
}

/**
 * The what-if batches for the offered `cards` with `n` battles per card: a card on both sides
 * gets n, a one-side card ⌈n / 2⌉ on side A and ⌊n / 2⌋ on side B. Unknown cards are skipped.
 */
export function whatIfOptions(mv: number, cards: readonly number[], n: number): WhatIfOption[] {
  const total = Math.max(0, Math.floor(n));
  const out: WhatIfOption[] = [];
  for (const card of cards) {
    const def = cardDef(mv, card);
    if (!def || total === 0) continue;
    if (def.target === 'both') {
      out.push({ card, side: 2, runs: total });
    } else {
      const a = Math.ceil(total / 2);
      if (a > 0) out.push({ card, side: 0, runs: a });
      if (total - a > 0) out.push({ card, side: 1, runs: total - a });
    }
  }
  return out;
}

/** The config the what-if battles run under: the match's config with the fixed design size. */
export const whatIfConfig = (config: FreeConfig): FreeConfig => ({
  ...config,
  runs: WHATIF_DESIGN_RUNS,
});

/** Counts of the first `n` summaries. */
export function countWins(summaries: readonly FreeRunSummary[], n = summaries.length): WinCounts {
  const c: WinCounts = { a: 0, b: 0, draw: 0, n: 0 };
  for (const s of summaries.slice(0, n)) {
    if (s.outcome === FreeOutcome.A) c.a++;
    else if (s.outcome === FreeOutcome.B) c.b++;
    else c.draw++;
    c.n++;
  }
  return c;
}

const share = (c: WinCounts, side: 0 | 1): number => (c.n > 0 ? (side === 0 ? c.a : c.b) / c.n : 0);

/** The shift of one option from its counts and the baseline counts of the same runs. */
export function whatIfShift(opt: WhatIfOption, before: WinCounts, after: WinCounts): WhatIfShift {
  const shownSide: 0 | 1 = opt.side === 1 ? 1 : 0;
  const b = share(before, shownSide);
  const a = share(after, shownSide);
  const deltaPp = Math.round((a - b) * 1000) / 10;
  return {
    card: opt.card,
    side: opt.side,
    shownSide,
    n: after.n,
    before: b,
    after: a,
    deltaPp,
    swing: Math.abs(deltaPp) >= CARD_SWING_PP,
  };
}

/** Text of a shift, for `textContent` only. `sideName` names the shown side. */
export interface WhatIfText {
  /** "같은 대결 100판 기준 · 지금 전황과는 별개" */
  basis: string;
  /** "사자 승률 42% → 55% (+13%p)" */
  line: string;
  /** "판도 변화" when the shift is a swing, else null. */
  swing: string | null;
}

export function whatIfText(s: WhatIfShift, sideName: string): WhatIfText {
  const sign = s.deltaPp > 0 ? '+' : s.deltaPp < 0 ? '−' : '±';
  return {
    basis: t('whatIf.basis', { n: s.n }),
    line: t('whatIf.line', {
      side: sideName,
      before: formatPct(s.before, 0),
      after: formatPct(s.after, 0),
      delta: `${sign}${Math.abs(s.deltaPp).toFixed(0)}`,
    }),
    swing: s.swing ? t('whatIf.swing') : null,
  };
}

/**
 * The shift as DOM, text nodes only (Trusted Types: nothing is parsed as HTML): the line, the
 * basis with its N, and the swing marker when there is one.
 */
export function whatIfElement(text: WhatIfText): HTMLElement {
  return h(
    'p',
    { class: 'what-if' },
    h('span', { class: 'what-if-line', text: text.line }),
    text.swing ? h('strong', { class: 'what-if-swing', text: text.swing }) : null,
    h('span', { class: 'what-if-basis', text: text.basis }),
  );
}

export interface WhatIfRequest {
  config: FreeConfig;
  /** Pause tick T. */
  tick: number;
  options: readonly WhatIfOption[];
}

export interface WhatIfJob<T> {
  readonly promise: Promise<T>;
  readonly cancel: () => void;
}

/**
 * Runs 0 … runs − 1 of the what-if config under `interventions`, as one job of small chunks
 * (`splitRuns`). Resolves with the summaries in run order.
 */
function submitRange(
  scheduler: Scheduler,
  config: FreeConfig,
  runs: number,
  interventions: readonly Intervention[],
  priority: Priority,
): WhatIfJob<FreeRunSummary[]> {
  const ranges = splitRuns(Math.min(runs, WHATIF_DESIGN_RUNS), scheduler.size);
  const job = scheduler.submit({
    priority,
    tasks: ranges.map((r) => (jobId) => ({
      msg: { type: 'run', jobId, config, start: r.start, end: r.end, interventions },
    })),
  });
  const promise = job.promise.then((results) => {
    const out: FreeRunSummary[] = [];
    for (const r of results) {
      if (r.type !== 'result') throw new Error('unexpected worker response');
      out.push(...(r.summaries as FreeRunSummary[]));
    }
    return out;
  });
  return { promise, cancel: job.cancel };
}

/**
 * The baseline of a match: the `n` what-if battles without a card, as one job. It does not depend
 * on the pause tick, so it is computed once per match (in the prediction beat, at P2).
 */
export function submitWhatIfBaseline(
  scheduler: Scheduler,
  config: FreeConfig,
  n: number = WHATIF_DESIGN_RUNS,
  priority: Priority = Priority.LiveChance,
): WhatIfJob<FreeRunSummary[]> {
  return submitRange(scheduler, whatIfConfig(config), n, [], priority);
}

/**
 * The what-if batches of a pause at P1, one per option, compared with `baseline` (the summaries
 * of `submitWhatIfBaseline` for the same config and at least as many runs). Resolves with one
 * shift per option, in option order; `cancel()` drops every batch (CancelledError).
 */
export function submitWhatIf(
  scheduler: Scheduler,
  req: WhatIfRequest,
  baseline: readonly FreeRunSummary[],
): WhatIfJob<WhatIfShift[]> {
  const config = whatIfConfig(req.config);
  const jobs = req.options.map((o) =>
    submitRange(
      scheduler,
      config,
      o.runs,
      [{ tick: req.tick, card: o.card, side: o.side }],
      Priority.WhatIf,
    ),
  );
  let cancelled = false;
  const promise = Promise.all(jobs.map((j) => j.promise)).then((after) => {
    if (cancelled) throw new CancelledError();
    return req.options.map((o, i) =>
      whatIfShift(o, countWins(baseline, o.runs), countWins(after[i] ?? [])),
    );
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      for (const j of jobs) j.cancel();
    },
  };
}
