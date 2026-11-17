import { DT } from '../sim/engine';
import { FreeOutcome, type FreeRunSummary } from '../sim/free/engine';
import type { MsgKey } from './i18n';
import type { LiveBar } from './live-chance';
import { SPEEDS } from './replay/timeline';
import type { FreeEvents } from './replay/free-events';
import { decisiveMoment } from './replay/free-events';

/**
 * Pure rules of Live battle mode (RENEWAL-1.0 §4.3, §4.4, §10.2; #183): where the card pause
 * goes, how fast the battle plays, the banners at the end and the captions on the way. The DOM
 * lives in src/ui/live.ts; everything here is tested without a browser.
 */

/** Window of the battle in which the pause may go, as shares of its duration (S, §4.4). */
export const PAUSE_WINDOW = [0.25, 0.6] as const;
/** Pause position when no checkpoint falls in the window (share of the duration). */
export const PAUSE_FALLBACK = 0.4;
/** Real seconds the rest of the battle should take at auto speed (45–60 s, §4.4). */
export const AUTO_TARGET_S = 52.5;
/** Auto speed bounds (§4.4). */
export const AUTO_SPEED_MIN = 0.5;
export const AUTO_SPEED_MAX = 16;
/** Slow-down speed at first contact and at the decisive moment, and its span in battle seconds. */
export const SLOW_SPEED = 0.5;
/** 1 s of battle at 0.5× is about 2 s of real time (§4.4). */
export const SLOW_SPAN_S = 1;
/** Banner thresholds (S, §4.4). */
export const UPSET_CHANCE = 0.3;
export const COMEBACK_CHANCE = 0.2;
export const PHOTO_FINISH_GAP = 0.1;
/** How long a caption stays, in battle seconds. */
export const CAPTION_SPAN_S = 3;

/**
 * Battle time of the card pause: the checkpoint whose value is closest to 50 % within
 * `PAUSE_WINDOW` of the duration (the earliest on a tie), for suspense; for the strength fallback
 * the most even strength. Without a checkpoint in the window, `PAUSE_FALLBACK` of the duration.
 */
export function pauseTime(bar: LiveBar | null, duration: number): number {
  const lo = PAUSE_WINDOW[0] * duration;
  const hi = PAUSE_WINDOW[1] * duration;
  const pts =
    bar === null
      ? []
      : bar.kind === 'chance'
        ? bar.points.map((p) => ({ t: p.t, v: p.chance }))
        : bar.points.map((p) => ({ t: p.t, v: p.ratio }));
  let best: { t: number; d: number } | null = null;
  for (const p of pts) {
    if (p.t < lo || p.t > hi || !Number.isFinite(p.v)) continue;
    const d = Math.abs(p.v - 0.5);
    if (best === null || d < best.d) best = { t: p.t, d };
  }
  return best?.t ?? PAUSE_FALLBACK * duration;
}

/**
 * Tick at which a card picked at battle time `time` applies (§10.2 point 2: `ceil(T / DT) + 1`),
 * so every frame up to the playhead stays as it was.
 */
export const cardTick = (time: number): number => Math.ceil(time / DT - 1e-9) + 1;

/**
 * Auto speed for `remaining` battle seconds (§4.4): the replay step whose real time is closest to
 * `AUTO_TARGET_S`, within 0.5×–16×. The steps are the replay's own (`SPEEDS`), so the speed menu
 * always shows the speed in use.
 */
export function autoSpeed(remaining: number): number {
  const want = Math.min(AUTO_SPEED_MAX, Math.max(AUTO_SPEED_MIN, remaining / AUTO_TARGET_S));
  let best: number = AUTO_SPEED_MIN;
  let gap = Infinity;
  for (const s of SPEEDS) {
    if (s < AUTO_SPEED_MIN || s > AUTO_SPEED_MAX) continue;
    const g = Math.abs(Math.log(s / want));
    if (g < gap - 1e-12) {
      gap = g;
      best = s;
    }
  }
  return best;
}

/** Battle times at which play slows down: first contact and the decisive moment. */
export function slowMoments(events: FreeEvents, bar: LiveBar | null): number[] {
  const out: number[] = [];
  if (events.firstContact !== null) out.push(events.firstContact);
  // The decisive moment reads only a chance timeline; the strength fallback is not one.
  const decisive = decisiveMoment(bar?.kind === 'chance' ? bar.points : [], events);
  if (decisive !== null && !out.includes(decisive)) out.push(decisive);
  return out.sort((a, b) => a - b);
}

/** Speed at battle time `time`: `SLOW_SPEED` just after a slow moment, else `base`. */
export function speedAt(time: number, base: number, moments: readonly number[]): number {
  for (const m of moments)
    if (time >= m && time < m + SLOW_SPAN_S) return Math.min(base, SLOW_SPEED);
  return base;
}

export type BannerKind = 'upset' | 'comeback' | 'cardSwing' | 'photoFinish';

/** Side that won the live battle, or null for a draw. */
export const winnerOf = (s: Pick<FreeRunSummary, 'outcome'>): 0 | 1 | null =>
  s.outcome === FreeOutcome.A ? 0 : s.outcome === FreeOutcome.B ? 1 : null;

/**
 * Banners of a finished live battle (§4.4), in a fixed order:
 * - UPSET: the winner's chance before the battle was under 30 % (chance timelines only);
 * - COMEBACK: the winner's chance fell under 20 % at some checkpoint (chance timelines only);
 * - CARD SWING: the picked card's what-if shift was a swing (#182);
 * - PHOTO FINISH: the two sides' remaining strength (HP share of their start) within 10 points.
 * The strength fallback is never read as a chance, so it gives neither UPSET nor COMEBACK.
 */
export function banners(
  summary: Pick<FreeRunSummary, 'outcome' | 'aHpFrac' | 'bHpFrac'>,
  bar: LiveBar | null,
  preMatchA: number | null,
  cardSwing: boolean,
): BannerKind[] {
  const out: BannerKind[] = [];
  const w = winnerOf(summary);
  const chanceOf = (a: number): number => (w === 0 ? a : 1 - a);
  if (w !== null && preMatchA !== null && chanceOf(preMatchA) < UPSET_CHANCE) out.push('upset');
  if (
    w !== null &&
    bar?.kind === 'chance' &&
    bar.points.some((p) => chanceOf(p.chance) < COMEBACK_CHANCE)
  ) {
    out.push('comeback');
  }
  if (cardSwing) out.push('cardSwing');
  if (w !== null && Math.abs(summary.aHpFrac - summary.bHpFrac) <= PHOTO_FINISH_GAP) {
    out.push('photoFinish');
  }
  return out;
}

export const BANNER_KEYS: Readonly<Record<BannerKind, MsgKey>> = {
  upset: 'live.banner.upset',
  comeback: 'live.banner.comeback',
  cardSwing: 'live.banner.cardSwing',
  photoFinish: 'live.banner.photoFinish',
};

/** A text caption at a battle time (§4.4), from the derived events (§10.8). */
export interface Caption {
  t: number;
  key: MsgKey;
  side: 0 | 1 | null;
}

/**
 * Captions of a battle: first contact, the start of each encirclement and each morale break, and
 * the decisive moment, in time order. Text only, neutral words (§1.2).
 */
export function captions(events: FreeEvents, bar: LiveBar | null): Caption[] {
  const out: Caption[] = [];
  if (events.firstContact !== null)
    out.push({ t: events.firstContact, key: 'live.cap.contact', side: null });
  for (const e of events.events) {
    if (e.kind === 'encircle') out.push({ t: e.t, key: 'live.cap.encircle', side: e.side });
    else if (e.kind === 'moraleBreak') out.push({ t: e.t, key: 'live.cap.morale', side: e.side });
  }
  if (bar?.kind === 'chance') {
    const d = decisiveMoment(bar.points);
    if (d !== null) out.push({ t: d, key: 'live.cap.decisive', side: null });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The caption to show at `time`: the latest one at most `CAPTION_SPAN_S` old, or null. */
export function captionAt(list: readonly Caption[], time: number): Caption | null {
  let found: Caption | null = null;
  for (const c of list) {
    if (c.t > time) break;
    if (time - c.t < CAPTION_SPAN_S) found = c;
  }
  return found;
}
