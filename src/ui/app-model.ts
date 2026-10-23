import { Outcome } from '../sim/engine';
import type { MsgKey, Vars } from './i18n';

/*
 * The pure decisions of the simulator page (#61), split out of the DOM shell src/ui/app.ts the
 * same way as tour-model.ts and version-model.ts: which message to show, which height to reserve,
 * whether results are stale. Unit-tested in Node (tests/app-model.test.ts).
 */

/** A message for a status line: a dictionary key, its placeholders, and whether it is an error. */
export interface Message {
  key: MsgKey;
  vars?: Vars;
  error?: boolean;
}

/** CSS height of the sensitivity chart for `rows` bars (styles.css reserves it for 10). */
export function tornadoHeight(rows: number): number {
  return Math.max(120, 24 + rows * 28);
}

/** Label key of a battle outcome code. */
export function outcomeKey(o: number): MsgKey {
  return o === Outcome.Heavy
    ? 'outcome.heavy'
    : o === Outcome.Pack
      ? 'outcome.pack'
      : 'outcome.draw';
}

/** The shown results came from other settings than the form holds now. */
export function isStale(shownConfig: unknown, formConfig: unknown): boolean {
  return shownConfig !== null && JSON.stringify(shownConfig) !== JSON.stringify(formConfig);
}

/**
 * The exchange-ratio card: a finite ratio is shown as a number; no incapacitated heavy animals and
 * no pack losses (0/0, NaN) and losses on one side only (∞) get a dash and their own sub-line.
 */
export function exchangeCard(ratio: number): { value: number | null; sub: MsgKey } {
  if (Number.isFinite(ratio)) return { value: ratio, sub: 'stat.exchangeSub' };
  return { value: null, sub: Number.isNaN(ratio) ? 'stat.exchangeNone' : 'stat.exchangeInf' };
}

export interface ProgressState {
  running: boolean;
  cancelled: boolean;
  /** Wall time of the last finished run; null while running or after a cancel or error. */
  elapsedMs: number | null;
  /** Estimated time left while running; null until enough runs finished. */
  etaMs: number | null;
}

/**
 * The line under the progress bar: the estimate while running, then how the last run ended.
 * Durations are left in milliseconds for the caller to format; null means an empty line.
 */
export function progressNote(s: ProgressState): { key: MsgKey; ms?: number } | null {
  if (s.running)
    return s.etaMs === null ? { key: 'progress.etaPending' } : { key: 'progress.eta', ms: s.etaMs };
  if (s.cancelled) return { key: 'progress.cancelled' };
  return s.elapsedMs === null ? null : { key: 'progress.done', ms: s.elapsedMs };
}
