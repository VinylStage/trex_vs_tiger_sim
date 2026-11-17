import { EndReason, type EndReasonCode } from '../sim/engine';
import type { EndReasonCounts } from '../sim/free/aggregate';
import { t, type MsgKey } from './i18n';
import { formatShare } from './verdict';

/**
 * Labels of how battles ended (#230, docs/MODEL.md §2.4): one run's end reason, and the share of
 * runs per reason for a batch. Pure apart from the message lookup.
 */

const KEYS: Readonly<Record<EndReasonCode, MsgKey>> = {
  [EndReason.Wipeout]: 'end.wipeout',
  [EndReason.Rout]: 'end.rout',
  [EndReason.TimeLimit]: 'end.timeLimit',
  [EndReason.Mutual]: 'end.mutual',
};

/** Label of one end reason code. */
export const endReasonLabel = (code: EndReasonCode): string => t(KEYS[code]);

/** The most common end reason of a batch (the lowest code on a tie). */
export function commonEndReason(counts: EndReasonCounts): EndReasonCode {
  let best = 0;
  for (let k = 1; k < counts.length; k++)
    if ((counts[k] as number) > (counts[best] as number)) best = k;
  return best as EndReasonCode;
}

/** Every end reason that occurred, most common first: "All incapacitated 97% · Draw: time limit 3%". */
export function endReasonBreakdown(counts: EndReasonCounts): string {
  const n = counts.reduce((a, b) => a + b, 0);
  return counts
    .map((k, code): [EndReasonCode, number] => [code as EndReasonCode, k])
    .filter(([, k]) => k > 0)
    .sort((x, y) => y[1] - x[1] || x[0] - y[0])
    .map(([code, k]) => t('end.part', { label: endReasonLabel(code), pct: formatShare(k, n) }))
    .join(' · ');
}
