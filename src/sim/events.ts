import type { TigerState } from './engine';

/**
 * Replay event log (docs/MODEL.md §2.6). Recorded only for the traced replay run.
 *
 * Each event is 4 × u16 = 8 bytes: `[stamp, type << 8 | v, a, b]`.
 * - `stamp` is the tick index after the update (`step + 1`), the same index as the frame
 *   recorded at `(step + 1) × DT`. Applying every event with stamp ≤ s to the initial state gives
 *   the state of the frame at `s × DT`.
 * - `a` and `b` are agent indices (`EVENT_NONE` = none); `v` is a type-specific byte.
 * - Events are stored in emission order, so the log is sorted by stamp.
 */
export const EventType = {
  /** a = T-Rex, b = tiger, v = damage / tiger max HP × 255 (clamped). Tiger → Recover. */
  BiteHit: 1,
  /** a = T-Rex, b = tiger. Cosmetic (P1). */
  BiteMiss: 2,
  /** a = tiger, b = host T-Rex, v = latch angle in the host frame (256 steps per turn). */
  Latch: 3,
  /** a = tiger, b = T-Rex. Cosmetic (P1). */
  LatchFail: 4,
  /** a = tiger, b = host. Shaken off: tiger → Recover (or Dead, see TigerDeath). */
  Throw: 5,
  /** a = tiger, b = host or EVENT_NONE, v = ReleaseCause. Tiger → Recover. */
  Release: 6,
  /** a = tiger, b = killer T-Rex, v = DeathCause. Tiger → Dead. */
  TigerDeath: 7,
  /** a = tiger, b = host if it was latched, else EVENT_NONE. Tiger → Routed. */
  Rout: 8,
  /** a = tiger. Tiger → Left. */
  Exit: 9,
  /** a = T-Rex. */
  TrexDeath: 10,
  /** a = tiger, b = target T-Rex. Out of stamina while approaching: tiger → Recover. */
  Exhausted: 11,
  /** a = tiger. Tiger → Approach. */
  Resume: 12,
} as const;
export type EventTypeCode = (typeof EventType)[keyof typeof EventType];

/** `v` of a Release event. */
export const ReleaseCause = { Stamina: 0, HostDied: 1 } as const;
/** `v` of a TigerDeath event. */
export const DeathCause = { Bite: 0, Throw: 1 } as const;

/** "No agent" in the a/b fields. */
export const EVENT_NONE = 0xffff;
/** u16 per event. */
export const EVENT_STRIDE = 4;
/** Largest agent index the log can store (EVENT_NONE is reserved). */
export const EVENT_MAX_INDEX = 0xfffe;
/** Largest stamp the log can store. */
export const EVENT_MAX_STEP = 0xffff;

/**
 * P0 events change state and are needed for exact reconstruction; P1 events are cosmetic
 * (misses and failed latch attempts) and may be coalesced or dropped.
 */
export const isCosmeticEvent = (type: number): boolean =>
  type === EventType.BiteMiss || type === EventType.LatchFail;

export interface EventLogLimits {
  /** Most P0 events stored. Reaching it stops the log (see `completeUntilStep`). */
  p0Cap: number;
  /** Most P1 events stored. Later ones are dropped and counted. */
  p1Cap: number;
  /** Minimum stamps between two stored BiteMiss events of the same T-Rex. */
  missWindow: number;
  /** Minimum stamps between two stored LatchFail events of the same tiger. */
  failWindow: number;
}

export interface EventStats {
  /** Stored state-changing events. */
  p0: number;
  /** Stored cosmetic events. */
  p1: number;
  /** P1 events skipped by the per-agent coalescing windows. */
  p1Coalesced: number;
  /** P1 events not stored: P1 cap reached, or the log had stopped. */
  p1Dropped: number;
  /** P0 events not stored because the log stopped. 0 means the log is complete. */
  p0Dropped: number;
}

export interface FinishedEventLog {
  events: Uint16Array<ArrayBuffer>;
  /** Every event with stamp ≤ this value is stored (P1 subject to coalescing and its cap). */
  completeUntilStep: number;
  stats: EventStats;
}

/** Growable event buffer with P0/P1 budgets. Consumes no random numbers. */
export class EventLog {
  private buf: Uint16Array<ArrayBuffer>;
  private readonly maxLength: number;
  private readonly limits: EventLogLimits;
  private readonly lastMiss: Uint16Array;
  private readonly lastFail: Uint16Array;
  private n = 0;
  private p0 = 0;
  private p1 = 0;
  private step = 0;
  private stepStartN = 0;
  private stepStartP0 = 0;
  private stepStartP1 = 0;
  /** -1 while recording; the last complete stamp once stopped. */
  private stoppedAt = -1;
  private p1Coalesced = 0;
  private p1Dropped = 0;
  private p0Dropped = 0;

  constructor(trexCount: number, tigerCount: number, limits: EventLogLimits) {
    this.limits = limits;
    this.maxLength = (Math.max(0, limits.p0Cap) + Math.max(0, limits.p1Cap)) * EVENT_STRIDE;
    this.buf = new Uint16Array(Math.min(this.maxLength, 1024 * EVENT_STRIDE));
    // Stamps start at 1, so 0 means "never".
    this.lastMiss = new Uint16Array(trexCount);
    this.lastFail = new Uint16Array(tigerCount);
    if (Math.max(trexCount, tigerCount) - 1 > EVENT_MAX_INDEX) this.stop();
  }

  /** Start the events of tick `step` (stamped `step`). Call once per tick, in order. */
  beginStep(step: number): void {
    this.step = step;
    this.stepStartN = this.n;
    this.stepStartP0 = this.p0;
    this.stepStartP1 = this.p1;
    if (step > EVENT_MAX_STEP && this.stoppedAt < 0) this.stop();
  }

  emit(type: EventTypeCode, v: number, a: number, b: number): void {
    const cosmetic = isCosmeticEvent(type);
    if (this.stoppedAt >= 0) {
      if (cosmetic) this.p1Dropped++;
      else this.p0Dropped++;
      return;
    }
    if (cosmetic) {
      const miss = type === EventType.BiteMiss;
      const last = miss ? this.lastMiss : this.lastFail;
      const prev = last[a] as number;
      if (
        prev !== 0 &&
        this.step - prev < (miss ? this.limits.missWindow : this.limits.failWindow)
      ) {
        this.p1Coalesced++;
        return;
      }
      if (this.p1 >= this.limits.p1Cap) {
        this.p1Dropped++;
        return;
      }
      last[a] = this.step;
      this.p1++;
    } else {
      if (this.p0 >= this.limits.p0Cap) {
        this.p0Dropped++;
        this.stop();
        return;
      }
      this.p0++;
    }
    const o = this.n * EVENT_STRIDE;
    if (o + EVENT_STRIDE > this.buf.length) {
      const grown = new Uint16Array(Math.min(this.maxLength, this.buf.length * 2));
      grown.set(this.buf);
      this.buf = grown;
    }
    this.buf[o] = this.step;
    this.buf[o + 1] = (type << 8) | (v & 0xff);
    this.buf[o + 2] = a;
    this.buf[o + 3] = b;
    this.n++;
  }

  /** Copy out the stored events. `finalStep` is the battle's last stamp (its tick count). */
  finish(finalStep: number): FinishedEventLog {
    return {
      events: this.buf.slice(0, this.n * EVENT_STRIDE),
      completeUntilStep: this.stoppedAt >= 0 ? this.stoppedAt : finalStep,
      stats: {
        p0: this.p0,
        p1: this.p1,
        p1Coalesced: this.p1Coalesced,
        p1Dropped: this.p1Dropped,
        p0Dropped: this.p0Dropped,
      },
    };
  }

  /**
   * Stop recording. The current tick's events are discarded so that the log ends on a tick
   * boundary: every event up to the previous stamp is kept, nothing after it.
   */
  private stop(): void {
    this.p0Dropped += this.p0 - this.stepStartP0;
    this.p1Dropped += this.p1 - this.stepStartP1;
    this.n = this.stepStartN;
    this.p0 = this.stepStartP0;
    this.p1 = this.stepStartP1;
    this.stoppedAt = Math.max(0, this.step - 1);
  }
}

// --- Encoding of `v` ---

const TAU = Math.PI * 2;

/** Bite damage as a fraction of the tiger's max HP, 0..255. */
export const damageByte = (damage: number, maxHp: number): number =>
  Math.min(255, Math.max(0, Math.round((255 * damage) / maxHp)));

/** Latch angle (radians, host frame) to 0..255. */
export const angleByte = (angle: number): number => Math.round((angle / TAU) * 256) & 0xff;

/** Inverse of `angleByte`, in [0, 2π). */
export const byteAngle = (v: number): number => ((v & 0xff) / 256) * TAU;

// --- Decoding ---

export const eventCount = (events: Uint16Array): number => events.length / EVENT_STRIDE;
export const eventStep = (events: Uint16Array, k: number): number =>
  events[k * EVENT_STRIDE] as number;
export const eventType = (events: Uint16Array, k: number): number =>
  (events[k * EVENT_STRIDE + 1] as number) >>> 8;
export const eventValue = (events: Uint16Array, k: number): number =>
  (events[k * EVENT_STRIDE + 1] as number) & 0xff;
export const eventA = (events: Uint16Array, k: number): number =>
  events[k * EVENT_STRIDE + 2] as number;
export const eventB = (events: Uint16Array, k: number): number =>
  events[k * EVENT_STRIDE + 3] as number;

type TigerStates = typeof TigerState;
type TigerStateCode = TigerStates[keyof TigerStates];

const APPROACH: TigerStates['Approach'] = 0;
const LATCHED: TigerStates['Latched'] = 1;
const RECOVER: TigerStates['Recover'] = 2;
const ROUTED: TigerStates['Routed'] = 3;
const DEAD: TigerStates['Dead'] = 4;
const LEFT: TigerStates['Left'] = 5;

/** Index of the tiger an event is about, or -1 for T-Rex-only events. */
export function eventTiger(type: number, a: number, b: number): number {
  if (type === EventType.BiteHit || type === EventType.BiteMiss) return b;
  if (type === EventType.TrexDeath || type < EventType.BiteHit || type > EventType.Resume)
    return -1;
  return a;
}

/**
 * The tiger state an event leaves its tiger in, or -1 if it changes none. Applied in log order,
 * these transitions reproduce every frame's tiger states exactly (up to `completeUntilStep`).
 */
export function tigerStateAfter(type: number): TigerStateCode | -1 {
  switch (type) {
    case EventType.BiteHit:
    case EventType.Throw:
    case EventType.Release:
    case EventType.Exhausted:
      return RECOVER;
    case EventType.Latch:
      return LATCHED;
    case EventType.TigerDeath:
      return DEAD;
    case EventType.Rout:
      return ROUTED;
    case EventType.Exit:
      return LEFT;
    case EventType.Resume:
      return APPROACH;
    default:
      return -1;
  }
}
