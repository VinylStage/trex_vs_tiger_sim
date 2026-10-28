/** Interpolation helpers for the replay (pure; docs/REPLAY.md §3). */

export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

export { clamp } from '../../sim/config.ts';

/** Shortest-arc angle interpolation (2D slerp): constant angular speed. */
export function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * f;
}

/** Index of the last element of the sorted `times` that is ≤ `time` (0 if none is). */
export function frameIndex(times: ArrayLike<number>, time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((times[mid] as number) <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Index of the last element of the sorted range `arr[from, to)` that is ≤ `x`, or `from − 1`. */
export function lastAtMost(arr: ArrayLike<number>, from: number, to: number, x: number): number {
  let lo = from;
  let hi = to - 1;
  let found = from - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((arr[mid] as number) <= x) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Smallest knot gap, so repeated points (an agent standing still) never divide by zero. */
const MIN_KNOT = 1e-4;

/**
 * Knots of a centripetal Catmull-Rom segment (α = 0.5, Yuksel et al.): the parameter advances by
 * √distance between control points, which avoids the cusps and loops of the uniform form.
 * Writes [t1, t2, t3] (t0 = 0) into `out`.
 */
export function crKnots(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  out: Float64Array,
): void {
  const t1 = Math.max(MIN_KNOT, Math.sqrt(Math.hypot(p1x - p0x, p1y - p0y)));
  const t2 = t1 + Math.max(MIN_KNOT, Math.sqrt(Math.hypot(p2x - p1x, p2y - p1y)));
  out[0] = t1;
  out[1] = t2;
  out[2] = t2 + Math.max(MIN_KNOT, Math.sqrt(Math.hypot(p3x - p2x, p3y - p2y)));
}

/**
 * One coordinate of the centripetal Catmull-Rom segment between p1 (f = 0) and p2 (f = 1),
 * Barry–Goldman pyramid form. The curve passes through p1 and p2 exactly.
 */
export function crEval(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  knots: Float64Array,
  f: number,
): number {
  const t1 = knots[0] as number;
  const t2 = knots[1] as number;
  const t3 = knots[2] as number;
  const t = t1 + (t2 - t1) * f;
  const a1 = ((t1 - t) * p0 + t * p1) / t1;
  const a2 = ((t2 - t) * p1 + (t - t1) * p2) / (t2 - t1);
  const a3 = ((t3 - t) * p2 + (t - t2) * p3) / (t3 - t2);
  const b1 = ((t2 - t) * a1 + t * a2) / t2;
  const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
  return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
}
