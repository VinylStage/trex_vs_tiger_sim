import { TigerState, type TraceFrame } from '../../sim/engine';
import { EventType } from '../../sim/events';
import { clamp, crEval, crKnots, frameIndex, lastAtMost, lerp, lerpAngle } from './interp';
import { NO_STEP, type Prepared } from './prepare';

const APPROACH: number = TigerState.Approach;
const LATCHED: number = TigerState.Latched;
const ROUTED: number = TigerState.Routed;
const DEAD: number = TigerState.Dead;
const LEFT: number = TigerState.Left;
/** A thrown tiger lands this far beyond its latch point (CONSTANTS.throwDistance). */
const THROW_DISTANCE = 3;
/** Parameter step for the finite-difference heading along a spline segment. */
const HEADING_DF = 0.02;

const kn = new Float64Array(3);

/**
 * Pose of T-Rex `i` at `time` into `out` = [x, y, heading, hpFrac, alive (1/0)].
 * Position: centripetal Catmull-Rom through the frames (clamped to the arena). Heading: the
 * recorded heading, shortest-arc interpolated. A T-Rex that dies inside a frame interval moves
 * straight to its final pose at the exact death time and stays there.
 */
export function trexPose(p: Prepared, i: number, time: number, out: Float64Array): void {
  trexPoseAt(p, i, time, frameIndex(p.frameT, time), out);
}

function trexPoseAt(p: Prepared, i: number, time: number, k: number, out: Float64Array): void {
  const fr = p.trace.frames;
  const F = fr.length;
  const kb = Math.min(k + 1, F - 1);
  const a = fr[k] as TraceFrame;
  const b = fr[kb] as TraceFrame;
  const ta = p.frameT[k] as number;
  const tb = p.frameT[kb] as number;
  const o = i * 4;
  const td = p.trexDeathTime[i] as number;
  // Same float tolerance as the stamp lookup in World.update.
  const dead = time + 1e-6 * p.dt >= td;
  if (dead || (td > ta && td <= tb)) {
    const d = fr[p.trexDeathFrame[i] as number] as TraceFrame;
    const g = dead ? 1 : clamp((time - ta) / (td - ta), 0, 1);
    out[0] = lerp(a.trex[o] as number, d.trex[o] as number, g);
    out[1] = lerp(a.trex[o + 1] as number, d.trex[o + 1] as number, g);
    out[2] = lerpAngle(a.trex[o + 2] as number, d.trex[o + 2] as number, g);
    out[3] = dead ? 0 : lerp(Math.max(0, a.trex[o + 3] as number), 0, g);
    out[4] = dead ? 0 : 1;
    return;
  }
  const hpA = a.trex[o + 3] as number;
  if (hpA <= 0) {
    // Died after the event log stopped: frames only (dead T-Rex do not move).
    out[0] = a.trex[o] as number;
    out[1] = a.trex[o + 1] as number;
    out[2] = a.trex[o + 2] as number;
    out[3] = 0;
    out[4] = 0;
    return;
  }
  const f = tb > ta ? clamp((time - ta) / (tb - ta), 0, 1) : 0;
  const z = fr[Math.max(k - 1, 0)] as TraceFrame;
  const c = fr[Math.min(k + 2, F - 1)] as TraceFrame;
  const ax = a.trex[o] as number;
  const ay = a.trex[o + 1] as number;
  const bx = b.trex[o] as number;
  const by = b.trex[o + 1] as number;
  // At the ends of the trace, mirror the neighbour instead of repeating the end point, so the
  // curve keeps its speed instead of easing in and out.
  const zx = k > 0 ? (z.trex[o] as number) : 2 * ax - bx;
  const zy = k > 0 ? (z.trex[o + 1] as number) : 2 * ay - by;
  const cx = k + 2 < F ? (c.trex[o] as number) : 2 * bx - ax;
  const cy = k + 2 < F ? (c.trex[o + 1] as number) : 2 * by - ay;
  crKnots(zx, zy, ax, ay, bx, by, cx, cy, kn);
  out[0] = clamp(crEval(zx, ax, bx, cx, kn, f), 0, p.L);
  out[1] = clamp(crEval(zy, ay, by, cy, kn, f), 0, p.L);
  out[2] = lerpAngle(a.trex[o + 2] as number, b.trex[o + 2] as number, f);
  out[3] = Math.max(0, lerp(hpA, Math.max(0, b.trex[o + 3] as number), f));
  out[4] = 1;
}

/**
 * Every agent's interpolated state at one time (docs/REPLAY.md §3). Pure apart from its own
 * output arrays, which are allocated once and refilled by `update`.
 */
export class World {
  readonly p: Prepared;
  /** T-Rex position (m), heading (rad), HP fraction and alive flag. */
  readonly rx: Float64Array;
  readonly ry: Float64Array;
  readonly rh: Float64Array;
  readonly rhp: Float64Array;
  readonly ralive: Uint8Array;
  /** Tiger position (m), state, unit heading and host (−1 unless latched with a known host). */
  readonly tx: Float64Array;
  readonly ty: Float64Array;
  readonly ts: Uint8Array;
  readonly tdx: Float64Array;
  readonly tdy: Float64Array;
  readonly thost: Int32Array;
  /** Time of the last `update`. */
  time = Number.NaN;
  private readonly pose = new Float64Array(5);
  private readonly anchor = new Float64Array(2);

  constructor(p: Prepared) {
    this.p = p;
    this.rx = new Float64Array(p.N);
    this.ry = new Float64Array(p.N);
    this.rh = new Float64Array(p.N);
    this.rhp = new Float64Array(p.N);
    this.ralive = new Uint8Array(p.N);
    this.tx = new Float64Array(p.M);
    this.ty = new Float64Array(p.M);
    this.ts = new Uint8Array(p.M);
    this.tdx = new Float64Array(p.M).fill(1);
    this.tdy = new Float64Array(p.M);
    this.thost = new Int32Array(p.M).fill(-1);
  }

  /** True when `time` lies after the event log stopped (frame-sampled states only). */
  isReduced(time: number): boolean {
    return this.p.reduced && time > this.p.completeTime + 1e-9;
  }

  /** Position of a tiger latched to `host` at angle `ang` (host frame) at `time`, clamped. */
  private ridePosition(host: number, ang: number, time: number, extra: number): void {
    const p = this.p;
    trexPose(p, host, time, this.pose);
    const a = (this.pose[2] as number) + ang;
    const d = p.attachR + extra;
    this.anchor[0] = clamp((this.pose[0] as number) + Math.cos(a) * d, 0, p.L);
    this.anchor[1] = clamp((this.pose[1] as number) + Math.sin(a) * d, 0, p.L);
  }

  update(t: number): void {
    const p = this.p;
    const fr = p.trace.frames;
    const F = fr.length;
    if (F === 0) return;
    const time = clamp(t, 0, p.duration);
    this.time = time;
    const L = p.L;
    const dt = p.dt;
    const k = frameIndex(p.frameT, time);
    const kb = Math.min(k + 1, F - 1);
    const kz = Math.max(k - 1, 0);
    const kc = Math.min(k + 2, F - 1);
    const a = fr[k] as TraceFrame;
    const b = fr[kb] as TraceFrame;
    const z = fr[kz] as TraceFrame;
    const c = fr[kc] as TraceFrame;
    const ta = p.frameT[k] as number;
    const tb = p.frameT[kb] as number;
    const tz = p.frameT[kz] as number;
    const tc = p.frameT[kc] as number;
    const f = tb > ta ? clamp((time - ta) / (tb - ta), 0, 1) : 0;

    const pose = this.pose;
    for (let i = 0; i < p.N; i++) {
      trexPoseAt(p, i, time, k, pose);
      this.rx[i] = pose[0] as number;
      this.ry[i] = pose[1] as number;
      this.rh[i] = pose[2] as number;
      this.rhp[i] = pose[3] as number;
      this.ralive[i] = pose[4] as number;
    }

    const step = Math.floor(time / dt + 1e-6);
    // Event times (stamp × dt) carry float error; compare them against `now`, which uses the
    // same tolerance as `step`, so an event counts as happened exactly when its stamp does.
    const now = time + 1e-6 * dt;
    const exact = step <= p.completeStep;
    const fromFrameA = ta >= p.completeTime - 1e-9;
    for (let j = 0; j < p.M; j++) {
      const o = j * 3;
      const sa = a.tiger[o + 2] as number;
      const trLo = p.trOff[j] as number;
      const trHi = p.trOff[j + 1] as number;
      let e = trLo - 1;
      let s: number;
      if (exact) {
        e = lastAtMost(p.trStep, trLo, trHi, step);
        s = e >= trLo ? (p.trState[e] as number) : APPROACH;
      } else {
        s = fromFrameA ? sa : (p.stateAtComplete[j] as number);
      }
      this.ts[j] = s;
      this.thost[j] = -1;

      if (s === DEAD || s === LEFT) {
        const gx = p.goneX[j] as number;
        const known = !Number.isNaN(gx) && (p.goneStep[j] as number) <= step;
        this.tx[j] = known ? gx : (a.tiger[o] as number);
        this.ty[j] = known ? (p.goneY[j] as number) : (a.tiger[o + 1] as number);
        continue;
      }

      const liLo = p.liOff[j] as number;
      const liHi = p.liOff[j + 1] as number;
      const li = lastAtMost(p.liStart, liLo, liHi, exact ? step : p.completeStep);
      const rideFrom = li >= liLo ? (p.liRide[li] as number) : Infinity;
      const detach = li >= liLo ? (p.liDetach[li] as number) : -Infinity;
      const riding = now >= rideFrom && now <= detach;
      if (s === LATCHED && riding && (exact || p.liEnd[li] === NO_STEP)) {
        // Ride the host: same pose as the drawn T-Rex, at the recorded latch angle.
        const h = p.liHost[li] as number;
        const ang = (this.rh[h] as number) + (p.liAng[li] as number);
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        this.tx[j] = clamp((this.rx[h] as number) + cos * p.attachR, 0, L);
        this.ty[j] = clamp((this.ry[h] as number) + sin * p.attachR, 0, L);
        this.tdx[j] = cos;
        this.tdy[j] = sin;
        this.thost[j] = h;
        continue;
      }

      // Free motion between anchors: frame samples, plus exact anchors where the tiger leaves a
      // host (its detach time; a thrown tiger lands 3 m out), starts riding one (the tick after
      // its latch), or stops for good (death or exit).
      const ax = a.tiger[o] as number;
      const ay = a.tiger[o + 1] as number;
      const bx = b.tiger[o] as number;
      const by = b.tiger[o + 1] as number;
      let lt = ta;
      let lx = ax;
      let ly = ay;
      let rt = tb;
      let rx = bx;
      let ry = by;
      let anchored = false;
      if (exact) {
        // Also when the tiger detaches right at frame a, so it leaves from the drawn ride
        // position rather than the frame's (which differs by the quantised latch angle).
        if (Number.isFinite(rideFrom) && detach <= now && detach >= ta - 1e-9) {
          const thrown = p.liEndKind[li] === EventType.Throw && p.goneStep[j] !== p.liEnd[li];
          this.ridePosition(
            p.liHost[li] as number,
            p.liAng[li] as number,
            detach,
            thrown ? THROW_DISTANCE : 0,
          );
          lt = detach;
          lx = this.anchor[0] as number;
          ly = this.anchor[1] as number;
          anchored = true;
        }
        // The next ride start: this interval's if it has not begun yet, else the next one's.
        const ni = li >= liLo && rideFrom > now && Number.isFinite(rideFrom) ? li : li + 1;
        if (ni < liHi) {
          const ts0 = p.liRide[ni] as number;
          if (ts0 > now && ts0 <= tb) {
            this.ridePosition(p.liHost[ni] as number, p.liAng[ni] as number, ts0, 0);
            rt = ts0;
            rx = this.anchor[0] as number;
            ry = this.anchor[1] as number;
            anchored = true;
          }
        }
        const gs = p.goneStep[j] as number;
        if (gs !== NO_STEP) {
          const tg = gs * dt;
          if (tg > now && tg < rt) {
            rt = tg;
            rx = p.goneX[j] as number;
            ry = p.goneY[j] as number;
            anchored = true;
          }
        }
      }

      let smooth =
        !anchored &&
        (b.tiger[o + 2] as number) === sa &&
        (z.tiger[o + 2] as number) === sa &&
        (c.tiger[o + 2] as number) === sa;
      if (smooth && exact) {
        // No state change anywhere in the four-frame window (frames can miss short ones).
        const prevOk = e < trLo || (p.trStep[e] as number) * dt <= tz;
        const nextOk = e + 1 >= trHi || (p.trStep[e + 1] as number) * dt > tc;
        smooth = prevOk && nextOk;
      }

      let x: number;
      let y: number;
      let hx: number;
      let hy: number;
      if (smooth) {
        // Mirrored end points at the ends of the trace, as for the T-Rex.
        const zx = k > 0 ? (z.tiger[o] as number) : 2 * ax - bx;
        const zy = k > 0 ? (z.tiger[o + 1] as number) : 2 * ay - by;
        const cx = k + 2 < F ? (c.tiger[o] as number) : 2 * bx - ax;
        const cy = k + 2 < F ? (c.tiger[o + 1] as number) : 2 * by - ay;
        crKnots(zx, zy, ax, ay, bx, by, cx, cy, kn);
        x = crEval(zx, ax, bx, cx, kn, f);
        y = crEval(zy, ay, by, cy, kn, f);
        const f2 = Math.min(1, f + HEADING_DF);
        const f1 = f2 - HEADING_DF;
        hx = crEval(zx, ax, bx, cx, kn, f2) - crEval(zx, ax, bx, cx, kn, f1);
        hy = crEval(zy, ay, by, cy, kn, f2) - crEval(zy, ay, by, cy, kn, f1);
      } else {
        const g = rt > lt ? clamp((time - lt) / (rt - lt), 0, 1) : 0;
        x = lerp(lx, rx, g);
        y = lerp(ly, ry, g);
        hx = rx - lx;
        hy = ry - ly;
      }
      if (s < ROUTED) {
        x = clamp(x, 0, L);
        y = clamp(y, 0, L);
      }
      this.tx[j] = x;
      this.ty[j] = y;
      let hl = Math.hypot(hx, hy);
      if (hl < 1e-9) {
        hx = bx - ax;
        hy = by - ay;
        hl = Math.hypot(hx, hy);
      }
      if (hl >= 1e-9) {
        this.tdx[j] = hx / hl;
        this.tdy[j] = hy / hl;
      }
    }
  }
}
