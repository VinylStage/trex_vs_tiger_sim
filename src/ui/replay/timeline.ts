import { PackState, type TraceFrame } from '../../sim/engine';
import { EventType, eventPack, isCosmeticEvent, packStateAfter } from '../../sim/events';
import { frameIndex } from './interp';
import type { Prepared } from './prepare';
import type { World } from './world';

/**
 * Timeline model and playback tables (docs/REPLAY.md §8). Pure: built once per trace, then read
 * by the cached timeline strip, the event buttons and the keyboard handler.
 */

/** Playback speeds (sim seconds per real second). */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
export const DEFAULT_SPEED = 2;

/** The next speed up (dir = 1) or down (dir = −1) from `speed`, clamped to the table. */
export function stepSpeed(speed: number, dir: 1 | -1): number {
  if (dir > 0) return SPEEDS.find((s) => s > speed + 1e-9) ?? SPEEDS[6];
  return [...SPEEDS].reverse().find((s) => s < speed - 1e-9) ?? SPEEDS[0];
}

/** "Skip to contact" lands this long before the first contact (s, sim time). */
export const CONTACT_LEAD_S = 2;
/** Event jumps land this long before the event, so it is seen happening. */
export const EVENT_LEAD_S = 1;
/**
 * Kills (or routs) less than CLUSTER_GAP_S apart form one marker, but a marker spans at most
 * CLUSTER_MAX_S, so a long continuous fight still gets a stop every few seconds.
 */
export const CLUSTER_GAP_S = 2;
export const CLUSTER_MAX_S = 5;
/** Columns of the timeline strip's count model. */
export const TIMELINE_BINS = 480;

/** Where "skip to contact" lands, or null if no heavy and pack animal ever met. */
export function contactSeekTime(p: Prepared): number | null {
  if (p.firstContact < 0) return null;
  return Math.min(p.duration, Math.max(0, p.firstContact - CONTACT_LEAD_S));
}

export type MarkerKind = 'contact' | 'heavyDeath' | 'kills' | 'routs';

export interface Marker {
  readonly t: number;
  readonly kind: MarkerKind;
  /** Events merged into this marker. */
  readonly count: number;
}

/** Count channels per bin: pack animals by state (routed and left together), then living heavy. */
export const CH = { approach: 0, latched: 1, recover: 2, out: 3, dead: 4, heavy: 5 } as const;
export const CHANNELS = 6;

export interface TimelineModel {
  readonly duration: number;
  readonly bins: number;
  /** bins × CHANNELS counts, at time b / (bins − 1) × duration. */
  readonly counts: Uint16Array;
  /** Sorted by time. */
  readonly markers: readonly Marker[];
  /** Seek targets for previous / next event: marker time − EVENT_LEAD_S, sorted, deduplicated. */
  readonly stops: Float64Array;
  /** Detail is reduced after this time (event log stopped), or Infinity. */
  readonly reducedFrom: number;
}

/** Group sorted event times into markers (see CLUSTER_GAP_S and CLUSTER_MAX_S). */
function cluster(times: readonly number[], kind: MarkerKind, out: Marker[]): void {
  let start = Number.NaN;
  let last = Number.NaN;
  let count = 0;
  for (const t of times) {
    if (count > 0 && t - last <= CLUSTER_GAP_S && t - start <= CLUSTER_MAX_S) {
      last = t;
      count++;
      continue;
    }
    if (count > 0) out.push({ t: start, kind, count });
    start = t;
    last = t;
    count = 1;
  }
  if (count > 0) out.push({ t: start, kind, count });
}

/** Event markers: first contact, each heavy death, clusters of pack animal kills and of routs. */
export function extractMarkers(p: Prepared): Marker[] {
  const out: Marker[] = [];
  if (p.firstContact >= 0) out.push({ t: p.firstContact, kind: 'contact', count: 1 });
  const deaths: number[] = [];
  for (let i = 0; i < p.N; i++) {
    const td = p.heavyDeathTime[i] as number;
    if (Number.isFinite(td)) deaths.push(td);
  }
  deaths.sort((a, b) => a - b);
  for (let k = 0; k < deaths.length;) {
    const t = deaths[k] as number;
    let n = 0;
    while (k < deaths.length && Math.abs((deaths[k] as number) - t) < 1e-9) {
      n++;
      k++;
    }
    out.push({ t, kind: 'heavyDeath', count: n });
  }
  const kills: number[] = [];
  const routs: number[] = [];
  for (let k = 0; k < p.evCount; k++) {
    const step = p.evStep[k] as number;
    if (step > p.completeStep) break;
    const type = p.evType[k] as number;
    if (type === EventType.PackDeath) kills.push(step * p.dt);
    else if (type === EventType.Rout) routs.push(step * p.dt);
  }
  cluster(kills, 'kills', out);
  cluster(routs, 'routs', out);
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Seek targets for the event buttons: sorted, at least 0.05 s apart. */
export function eventStops(markers: readonly Marker[], duration: number): Float64Array {
  const raw = markers.map((m) => Math.min(duration, Math.max(0, m.t - EVENT_LEAD_S)));
  raw.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of raw)
    if (out.length === 0 || t - (out[out.length - 1] as number) >= 0.05) out.push(t);
  return Float64Array.from(out);
}

/** Tolerance so that a jump lands "at" a stop and the next press moves on. */
const STOP_EPS = 0.05;

/** First stop after `t`, or null. */
export function nextStop(stops: Float64Array, t: number): number | null {
  for (const s of stops) if (s > t + STOP_EPS) return s;
  return null;
}

/** Last stop before `t`, or null. */
export function prevStop(stops: Float64Array, t: number): number | null {
  for (let k = stops.length - 1; k >= 0; k--) {
    const s = stops[k] as number;
    if (s < t - STOP_EPS) return s;
  }
  return null;
}

/**
 * State counts at TIMELINE_BINS evenly spaced times, event-exact up to the end of the event log
 * and from the frames after it. Linear in events + bins × agents only for the frame part.
 */
export function buildTimeline(p: Prepared, bins = TIMELINE_BINS): TimelineModel {
  const duration = p.duration;
  const counts = new Uint16Array(bins * CHANNELS);
  const state = new Uint8Array(p.M);
  const c = new Int32Array(CHANNELS);
  c[CH.approach] = p.M;
  const chOf = (s: number): number =>
    s === PackState.Approach
      ? CH.approach
      : s === PackState.Latched
        ? CH.latched
        : s === PackState.Recover
          ? CH.recover
          : s === PackState.Dead
            ? CH.dead
            : CH.out;
  const deaths: number[] = [];
  for (let i = 0; i < p.N; i++) deaths.push(p.heavyDeathTime[i] as number);
  deaths.sort((a, b) => a - b);
  const frames = p.trace.frames;
  let k = 0;
  let d = 0;
  for (let b = 0; b < bins; b++) {
    const t = bins > 1 ? (b / (bins - 1)) * duration : duration;
    const o = b * CHANNELS;
    if (p.reduced && t > p.completeTime + 1e-9 && frames.length > 0) {
      // After the log stopped: frame-sampled states.
      const fr = frames[frameIndex(p.frameT, t)] as TraceFrame;
      for (let j = 0; j < p.M; j++) {
        const ch = chOf(fr.pack[j * 3 + 2] as number) + o;
        counts[ch] = (counts[ch] as number) + 1;
      }
      let alive = 0;
      for (let i = 0; i < p.N; i++) if ((fr.heavy[i * 4 + 3] as number) > 0) alive++;
      counts[o + CH.heavy] = alive;
      continue;
    }
    const step = Math.floor(t / p.dt + 1e-6);
    for (; k < p.evCount && (p.evStep[k] as number) <= step; k++) {
      const type = p.evType[k] as number;
      if ((p.evStep[k] as number) > p.completeStep) continue;
      if (isCosmeticEvent(type) || type === EventType.HeavyDeath) continue;
      const next = packStateAfter(type);
      const j = eventPack(type, p.evA[k] as number, p.evB[k] as number);
      if (next < 0 || j < 0 || j >= p.M) continue;
      const from = chOf(state[j] as number);
      c[from] = (c[from] as number) - 1;
      state[j] = next;
      const to = chOf(next);
      c[to] = (c[to] as number) + 1;
    }
    while (d < deaths.length && (deaths[d] as number) <= t + 1e-6 * p.dt) d++;
    for (let ch = 0; ch < CH.heavy; ch++) counts[o + ch] = c[ch] as number;
    counts[o + CH.heavy] = p.N - d;
  }
  const markers = extractMarkers(p);
  return {
    duration,
    bins,
    counts,
    markers,
    stops: eventStops(markers, duration),
    reducedFrom: p.reduced ? p.completeTime : Infinity,
  };
}

/** Counts of the scene at the world's current time (for the canvas label). */
export interface SceneCounts {
  approach: number;
  latched: number;
  recover: number;
  /** Routed or left the arena. */
  out: number;
  dead: number;
  heavyAlive: number;
}

export function sceneCounts(w: World, out: SceneCounts): SceneCounts {
  out.approach = 0;
  out.latched = 0;
  out.recover = 0;
  out.out = 0;
  out.dead = 0;
  out.heavyAlive = 0;
  for (let j = 0; j < w.p.M; j++) {
    const s = w.ts[j] as number;
    if (s === PackState.Approach) out.approach++;
    else if (s === PackState.Latched) out.latched++;
    else if (s === PackState.Recover) out.recover++;
    else if (s === PackState.Dead) out.dead++;
    else out.out++;
  }
  for (let i = 0; i < w.p.N; i++) out.heavyAlive += w.ralive[i] as number;
  return out;
}

/** What a key press does (docs/REPLAY.md §8, keyboard map). */
export type ReplayAction =
  | { readonly kind: 'toggle' }
  | { readonly kind: 'seekBy'; readonly seconds: number }
  | { readonly kind: 'seekTo'; readonly to: 'start' | 'end' }
  /** Seek by a fraction of the battle's length (Page Up / Page Down). */
  | { readonly kind: 'seekFrac'; readonly frac: number }
  | { readonly kind: 'speed'; readonly dir: 1 | -1 }
  | { readonly kind: 'event'; readonly dir: 1 | -1 }
  | { readonly kind: 'contact' }
  | { readonly kind: 'view' };

/** Seconds per arrow press (Shift: SEEK_BIG_S). */
export const SEEK_SMALL_S = 1;
export const SEEK_BIG_S = 5;
/** Page Up / Page Down step, as a fraction of the battle's length. */
export const SEEK_PAGE = 0.1;

/** KeyboardEvent.code name of a printable ASCII character, as a US layout types it. */
const CHAR_CODES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  ',': 'Comma',
  '.': 'Period',
};

/**
 * Keyboard map. A printable ASCII `key` (KeyboardEvent.key) wins, so the shortcuts follow the
 * characters printed on AZERTY or Dvorak keys, as the shortcut list and aria-keyshortcuts
 * advertise them. Otherwise (`key` is 'Process' or a Hangul jamo while a Korean IME is active,
 * or a navigation key) the physical `code` (KeyboardEvent.code) decides.
 */
export function keyAction(code: string, key: string, shift: boolean): ReplayAction | null {
  const ascii = key.length === 1 && key >= ' ' && key <= '~';
  const name = ascii
    ? (CHAR_CODES[key] ?? (/[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : key))
    : code || key;
  switch (name) {
    case 'Space':
    case ' ':
    case 'KeyK':
      return { kind: 'toggle' };
    case 'ArrowLeft':
      return { kind: 'seekBy', seconds: shift ? -SEEK_BIG_S : -SEEK_SMALL_S };
    case 'ArrowRight':
      return { kind: 'seekBy', seconds: shift ? SEEK_BIG_S : SEEK_SMALL_S };
    case 'KeyJ':
      return { kind: 'seekBy', seconds: -SEEK_BIG_S };
    case 'KeyL':
      return { kind: 'seekBy', seconds: SEEK_BIG_S };
    case 'PageUp':
      return { kind: 'seekFrac', frac: SEEK_PAGE };
    case 'PageDown':
      return { kind: 'seekFrac', frac: -SEEK_PAGE };
    case 'Home':
      return { kind: 'seekTo', to: 'start' };
    case 'End':
      return { kind: 'seekTo', to: 'end' };
    case 'BracketLeft':
    case '[':
      return { kind: 'speed', dir: -1 };
    case 'BracketRight':
    case ']':
      return { kind: 'speed', dir: 1 };
    case 'Comma':
    case ',':
      return { kind: 'event', dir: -1 };
    case 'Period':
    case '.':
      return { kind: 'event', dir: 1 };
    case 'KeyC':
      return { kind: 'contact' };
    case 'KeyF':
      return { kind: 'view' };
    default:
      return null;
  }
}

/**
 * Page Visibility, for both replays (docs/REPLAY.md §11): playback pauses while the page is
 * hidden and resumes when it is visible again, unless the viewer played, paused or seeked in
 * between (`release`). A replay that was not playing when the page was hidden stays as it was.
 */
export class AutoPause {
  private held = false;

  /** The page was hidden or shown: the play state to switch to, or null to leave it. */
  change(hidden: boolean, playing: boolean): boolean | null {
    if (hidden) {
      if (!playing) return null;
      this.held = true;
      return false;
    }
    if (!this.held) return null;
    this.held = false;
    return true;
  }

  /** The viewer (or a new trace) decided the play state; nothing resumes on its own after it. */
  release(): void {
    this.held = false;
  }
}
