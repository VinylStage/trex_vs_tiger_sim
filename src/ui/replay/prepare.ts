import { TigerState, type BattleTrace, type TraceFrame } from '../../sim/engine';
import {
  EventType,
  ReleaseCause,
  byteAngle,
  eventTiger,
  isCosmeticEvent,
  tigerStateAfter,
} from '../../sim/events';
import { trexPose } from './world';

/** "No stamp" in the Uint16 step arrays below. */
export const NO_STEP = 0xffff;

/**
 * Indexes built once per trace (docs/REPLAY.md §2). Pure: no DOM, no allocation after this.
 * Steps are event stamps (time = step × dt); per-agent lists are CSR arrays (`off[j] … off[j+1]`).
 */
export interface Prepared {
  readonly trace: BattleTrace;
  readonly N: number;
  readonly M: number;
  readonly L: number;
  readonly dt: number;
  /** Time of the last frame (s). */
  readonly duration: number;
  /** Frame times, for binary search. */
  readonly frameT: Float64Array;
  /** Distance from a host's centre to a latched tiger: bodyRadius + tigerRadius (m). */
  readonly attachR: number;

  /** Decoded events (structure of arrays, log order). */
  readonly evCount: number;
  readonly evStep: Uint16Array;
  readonly evType: Uint8Array;
  readonly evV: Uint8Array;
  readonly evA: Uint16Array;
  readonly evB: Uint16Array;
  /**
   * For bites (BiteHit / BiteMiss): sim seconds since the same T-Rex's previous logged bite
   * (Infinity for its first). 0 for other events. Used to rate-limit filled bite cones.
   */
  readonly evGap: Float32Array;

  /** Event-exact states hold up to this stamp; after it the replay falls back to frames. */
  readonly completeStep: number;
  readonly completeTime: number;
  /** True when the event log stopped before the end of the battle (budget reached). */
  readonly reduced: boolean;

  /** Per-tiger state transitions (stamp, new state). */
  readonly trOff: Int32Array;
  readonly trStep: Uint16Array;
  readonly trState: Uint8Array;
  /** Tiger state after the last recorded event (the state at `completeStep`). */
  readonly stateAtComplete: Uint8Array;

  /** Per-tiger latch intervals: start/end stamp (end NO_STEP = still latched), host, angle. */
  readonly liOff: Int32Array;
  readonly liStart: Uint16Array;
  readonly liEnd: Uint16Array;
  readonly liHost: Uint16Array;
  /** Latch angle relative to the host's heading (rad). */
  readonly liAng: Float64Array;
  /** Event type that ended the interval (0 while open). */
  readonly liEndKind: Uint8Array;
  /**
   * When the tiger rides its host (s). The engine pins a latched tiger to its host in the tick
   * after the latch (on the latch tick it is still where it made contact), so riding starts one
   * tick after the Latch event. Infinity if the interval ended before that.
   */
  readonly liRide: Float64Array;
  /**
   * Time the tiger stops riding (s; Infinity while open). A throw or a stamina release happens
   * after the latched position update of its tick, so riding lasts until the event's own time.
   * A rout, a bite or a dead host comes before that update: the tiger was last on its host one
   * tick earlier and spends the event's tick moving off or lying where it was.
   */
  readonly liDetach: Float64Array;
  /**
   * For an interval still open when the log stopped: the time up to which the frames confirm the
   * ride (s). The replay walks the frames after `completeTime` and stops at the last one in which
   * the tiger is still Latched at its ride position; a later detach, or a re-latch onto another
   * host or angle, is only visible in the frames. Infinity if every later frame agrees, and
   * Infinity for closed intervals (they end at `liDetach`).
   */
  readonly liFrameEnd: Float64Array;

  /** Stamp at which a tiger died or left the arena (NO_STEP if never, or not recorded). */
  readonly goneStep: Uint16Array;
  /** Where it stays from then on (NaN if unknown). */
  readonly goneX: Float64Array;
  readonly goneY: Float64Array;

  /** T-Rex death time (s), Infinity if it survives or died after `completeTime`. */
  readonly trexDeathTime: Float64Array;
  /** First frame at or after the death; that frame holds the final pose. −1 if none. */
  readonly trexDeathFrame: Int32Array;

  /** Time of the first bite or latch attempt (s), −1 if there was none. */
  readonly firstContact: number;
}

const LATCHED: number = TigerState.Latched;
/**
 * A frame confirms a ride when the tiger lies within this distance of its drawn ride position
 * (m). The quantised latch angle alone moves it by attachR × π/256 (a few centimetres).
 */
const RIDE_FRAME_TOLERANCE = 0.5;
const DEAD: number = TigerState.Dead;
const LEFT: number = TigerState.Left;

/** Index of the first frame with t ≥ time (frames.length if none). */
function firstFrameAtOrAfter(frameT: Float64Array, time: number): number {
  let lo = 0;
  let hi = frameT.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((frameT[mid] as number) < time - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Build the replay indexes for one trace. Linear in events + agents (+ one frame scan). */
export function prepare(trace: BattleTrace): Prepared {
  const N = trace.trexCount;
  const M = trace.tigerCount;
  const dt = trace.meta.dt;
  const frames = trace.frames;
  const F = frames.length;
  const frameT = new Float64Array(F);
  for (let k = 0; k < F; k++) frameT[k] = (frames[k] as TraceFrame).t;
  const duration = F > 0 ? (frameT[F - 1] as number) : 0;

  // --- decode ---
  const raw = trace.events;
  const evCount = Math.floor(raw.length / 4);
  const evStep = new Uint16Array(evCount);
  const evType = new Uint8Array(evCount);
  const evV = new Uint8Array(evCount);
  const evA = new Uint16Array(evCount);
  const evB = new Uint16Array(evCount);
  const evGap = new Float32Array(evCount);
  const lastBite = new Int32Array(N).fill(-1);
  for (let k = 0; k < evCount; k++) {
    const tv = raw[k * 4 + 1] as number;
    const step = raw[k * 4] as number;
    const type = tv >>> 8;
    const a = raw[k * 4 + 2] as number;
    evStep[k] = step;
    evType[k] = type;
    evV[k] = tv & 0xff;
    evA[k] = a;
    evB[k] = raw[k * 4 + 3] as number;
    if ((type === EventType.BiteHit || type === EventType.BiteMiss) && a < N) {
      const prev = lastBite[a] as number;
      evGap[k] = prev < 0 ? Infinity : (step - prev) * dt;
      lastBite[a] = step;
    }
  }
  const finalStep = Math.round(duration / dt);
  const completeStep = Math.min(trace.eventsCompleteUntilStep, finalStep);

  // --- pass 1: count transitions and latches per tiger ---
  const trCount = new Int32Array(M);
  const liCount = new Int32Array(M);
  const tigerOf = (k: number): number => {
    const type = evType[k] as number;
    if (isCosmeticEvent(type) || type === EventType.TrexDeath) return -1;
    if ((evStep[k] as number) > completeStep) return -1;
    const j = eventTiger(type, evA[k] as number, evB[k] as number);
    return j >= 0 && j < M && tigerStateAfter(type) >= 0 ? j : -1;
  };
  for (let k = 0; k < evCount; k++) {
    const j = tigerOf(k);
    if (j < 0) continue;
    trCount[j] = (trCount[j] as number) + 1;
    if (evType[k] === EventType.Latch) liCount[j] = (liCount[j] as number) + 1;
  }
  const trOff = new Int32Array(M + 1);
  const liOff = new Int32Array(M + 1);
  for (let j = 0; j < M; j++) {
    trOff[j + 1] = (trOff[j] as number) + (trCount[j] as number);
    liOff[j + 1] = (liOff[j] as number) + (liCount[j] as number);
  }

  // --- pass 2: fill ---
  const nTr = trOff[M] as number;
  const nLi = liOff[M] as number;
  const trStep = new Uint16Array(nTr);
  const trState = new Uint8Array(nTr);
  const liStart = new Uint16Array(nLi);
  const liEnd = new Uint16Array(nLi).fill(NO_STEP);
  const liHost = new Uint16Array(nLi);
  const liAng = new Float64Array(nLi);
  const liEndKind = new Uint8Array(nLi);
  const liRide = new Float64Array(nLi).fill(Infinity);
  const liDetach = new Float64Array(nLi).fill(Infinity);
  const liFrameEnd = new Float64Array(nLi).fill(Infinity);
  const trCur = trOff.slice(0, M);
  const liCur = liOff.slice(0, M);
  const openLatch = new Int32Array(M).fill(-1);
  const stateAtComplete = new Uint8Array(M).fill(TigerState.Approach);
  const goneStep = new Uint16Array(M).fill(NO_STEP);
  const trexDeathTime = new Float64Array(N).fill(Infinity);
  let firstContact = -1;

  for (let k = 0; k < evCount; k++) {
    const type = evType[k] as number;
    const step = evStep[k] as number;
    if (
      firstContact < 0 &&
      (type === EventType.BiteHit ||
        type === EventType.BiteMiss ||
        type === EventType.Latch ||
        type === EventType.LatchFail)
    )
      firstContact = step * dt;
    if (type === EventType.TrexDeath) {
      const i = evA[k] as number;
      if (i < N && step <= completeStep && !Number.isFinite(trexDeathTime[i] as number))
        trexDeathTime[i] = step * dt;
      continue;
    }
    const j = tigerOf(k);
    if (j < 0) continue;
    const next = tigerStateAfter(type) as number;
    const c = trCur[j] as number;
    trStep[c] = step;
    trState[c] = next;
    trCur[j] = c + 1;
    stateAtComplete[j] = next;
    const open = openLatch[j] as number;
    if (next === LATCHED) {
      const l = liCur[j] as number;
      liStart[l] = step;
      liHost[l] = evB[k] as number;
      liAng[l] = byteAngle(evV[k] as number);
      liRide[l] = (step + 1) * dt;
      liCur[j] = l + 1;
      openLatch[j] = l;
    } else if (open >= 0) {
      liEnd[open] = step;
      liEndKind[open] = type;
      const early =
        type === EventType.Rout ||
        type === EventType.BiteHit ||
        (type === EventType.Release && evV[k] === ReleaseCause.HostDied);
      const detach = (early ? step - 1 : step) * dt;
      liDetach[open] = detach;
      if (detach < (liRide[open] as number) - 1e-9) liRide[open] = Infinity;
      openLatch[j] = -1;
    }
    if ((next === DEAD || next === LEFT) && goneStep[j] === NO_STEP) goneStep[j] = step;
  }

  const trexDeathFrame = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const td = trexDeathTime[i] as number;
    if (!Number.isFinite(td)) continue;
    const f = firstFrameAtOrAfter(frameT, td);
    if (f < F) trexDeathFrame[i] = f;
    else trexDeathTime[i] = Infinity;
  }

  const goneX = new Float64Array(M).fill(NaN);
  const goneY = new Float64Array(M).fill(NaN);
  const prepared: Prepared = {
    trace,
    N,
    M,
    L: trace.arenaSize,
    dt,
    duration,
    frameT,
    attachR: trace.meta.bodyRadius + trace.meta.tigerRadius,
    evCount,
    evStep,
    evType,
    evV,
    evA,
    evB,
    evGap,
    completeStep,
    completeTime: completeStep * dt,
    reduced: completeStep < finalStep,
    trOff,
    trStep,
    trState,
    stateAtComplete,
    liOff,
    liStart,
    liEnd,
    liHost,
    liAng,
    liEndKind,
    liRide,
    liDetach,
    liFrameEnd,
    goneStep,
    goneX,
    goneY,
    trexDeathTime,
    trexDeathFrame,
    firstContact,
  };

  const pose = new Float64Array(5);
  const L = trace.arenaSize;
  // Latches still open when the log stopped: ride only while the frames agree (see liFrameEnd).
  const completeTime = completeStep * dt;
  const firstAfter = firstFrameAtOrAfter(frameT, completeTime + 1e-6 * dt);
  for (let j = 0; j < M; j++) {
    const l = openLatch[j] as number;
    if (l < 0) continue;
    const host = liHost[l] as number;
    const rideFrom = liRide[l] as number;
    let end = completeTime;
    let f = firstAfter;
    for (; f < F; f++) {
      const fr = frames[f] as TraceFrame;
      const t = frameT[f] as number;
      if (fr.tiger[j * 3 + 2] !== LATCHED) break;
      if (t >= rideFrom - 1e-9) {
        trexPose(prepared, host, t, pose);
        const a = (pose[2] as number) + (liAng[l] as number);
        const ex = Math.min(L, Math.max(0, (pose[0] as number) + Math.cos(a) * prepared.attachR));
        const ey = Math.min(L, Math.max(0, (pose[1] as number) + Math.sin(a) * prepared.attachR));
        const err = Math.hypot(
          (fr.tiger[j * 3] as number) - ex,
          (fr.tiger[j * 3 + 1] as number) - ey,
        );
        if (err > RIDE_FRAME_TOLERANCE) break;
      }
      end = t;
    }
    liFrameEnd[l] = f >= F ? Infinity : end;
  }

  // Final positions of dead and departed tigers. A tiger killed while latched stays where it last
  // rode (the drawn ride position, so the glyph does not jump); every other one stays at its frame
  // position, which no longer changes after death or exit.
  for (let j = 0; j < M; j++) {
    const s = goneStep[j] as number;
    if (s === NO_STEP) continue;
    const li = (liOff[j + 1] as number) - 1;
    const killedRiding =
      li >= (liOff[j] as number) &&
      liEnd[li] === s &&
      Number.isFinite(liRide[li] as number) &&
      trState[(trOff[j + 1] as number) - 1] === DEAD;
    if (killedRiding) {
      trexPose(prepared, liHost[li] as number, liDetach[li] as number, pose);
      const a = (pose[2] as number) + (liAng[li] as number);
      goneX[j] = Math.min(L, Math.max(0, (pose[0] as number) + Math.cos(a) * prepared.attachR));
      goneY[j] = Math.min(L, Math.max(0, (pose[1] as number) + Math.sin(a) * prepared.attachR));
      continue;
    }
    const f = firstFrameAtOrAfter(frameT, s * dt);
    if (f >= F) {
      goneStep[j] = NO_STEP;
      continue;
    }
    const fr = frames[f] as TraceFrame;
    goneX[j] = fr.tiger[j * 3] as number;
    goneY[j] = fr.tiger[j * 3 + 1] as number;
  }
  return prepared;
}
