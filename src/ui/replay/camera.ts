import { TigerState } from '../../sim/engine';
import type { World } from './world';

/** Centre and side (m) of the visible square. */
export interface Camera {
  cx: number;
  cy: number;
  view: number;
}

/** Zoom modes: 0 = auto (follow the fight), 1 = whole arena, n > 1 = n× on the T-Rex centroid. */
export const ZOOM_AUTO = 0;
export const ZOOM_FIT = 1;

/** Camera tuning (docs/REPLAY.md §8, ANIMATION.md §3.3). Distances in metres, times in s. */
export const CAMERA = {
  /** Auto framing: margin around the trimmed box and the smallest view. */
  padM: 20,
  minViewM: 60,
  /** Trim the 2 % outliers on each side once the box has more than trimMinPoints points. */
  trim: 0.02,
  trimMinPoints: 40,
  /** At most this many tigers (evenly strided) feed the auto box. */
  maxTigers: 1500,
  /** SmoothDamp times for the centre and for log(view). */
  centreTime: 0.45,
  zoomTime: 0.6,
  /**
   * Zoom hysteresis on log(view): the zoom goal only moves when the target is more than 6 %
   * wider (zoom out) or more than 12 % narrower (zoom in), so the view does not "breathe".
   */
  zoomOutHysteresis: Math.log(1.06),
  zoomInHysteresis: Math.log(1 / 1.12),
} as const;

/**
 * Critically damped spring toward `target` (SmoothDamp, the Game Programming Gems 4 form used by
 * Unity, with the exact exp(−ωΔt) instead of its polynomial approximation, so it is the exact
 * solution over any step and therefore frame-rate independent). Never overshoots.
 * `io` = [position, velocity], updated in place.
 */
export function smoothDamp(io: Float64Array, target: number, smoothTime: number, dt: number): void {
  const cur = io[0] as number;
  const vel = io[1] as number;
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = Math.exp(-x);
  const change = cur - target;
  const temp = (vel + omega * change) * dt;
  let next = target + (change + temp) * exp;
  let nextVel = (vel - omega * temp) * exp;
  // A large initial velocity toward the target could carry past it; stop there instead.
  if (target - cur > 0 === next > target) {
    next = target;
    nextVel = 0;
  }
  io[0] = next;
  io[1] = nextVel;
}

/**
 * Smoothed camera: centre and log(view) each follow their target with SmoothDamp; zoom changes
 * pass a hysteresis band first. `step(target, 0)` (seek, scrub, mode change while paused) snaps.
 */
export class CameraRig {
  private readonly x = new Float64Array(2);
  private readonly y = new Float64Array(2);
  private readonly z = new Float64Array(2);
  private goal = 0;
  private ready = false;

  get cx(): number {
    return this.x[0] as number;
  }
  get cy(): number {
    return this.y[0] as number;
  }
  get view(): number {
    return Math.exp(this.z[0] as number);
  }

  /** Forget the current pose; the next step snaps. */
  reset(): void {
    this.ready = false;
  }

  snap(target: Camera): void {
    this.x[0] = target.cx;
    this.y[0] = target.cy;
    this.z[0] = Math.log(target.view);
    this.x[1] = 0;
    this.y[1] = 0;
    this.z[1] = 0;
    this.goal = this.z[0];
    this.ready = true;
  }

  /** Follow `target` for `dt` real seconds (≤ 0 snaps). */
  step(target: Camera, dt: number): void {
    if (!this.ready || !(dt > 0)) {
      this.snap(target);
      return;
    }
    const lz = Math.log(target.view);
    const dz = lz - this.goal;
    if (dz > CAMERA.zoomOutHysteresis || dz < CAMERA.zoomInHysteresis) this.goal = lz;
    smoothDamp(this.x, target.cx, CAMERA.centreTime, dt);
    smoothDamp(this.y, target.cy, CAMERA.centreTime, dt);
    smoothDamp(this.z, this.goal, CAMERA.zoomTime, dt);
  }
}

/** Value at quantile q of the first n entries of a sorted array. */
function quantile(sorted: Float64Array, n: number, q: number): number {
  return sorted[Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))))] as number;
}

/**
 * Computes the camera each zoom mode wants. Owns its scratch buffers, so `target` allocates
 * nothing per frame.
 */
export class CameraTarget {
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private readonly stride: number;
  readonly out: Camera = { cx: 0, cy: 0, view: 1 };

  constructor(trexCount: number, tigerCount: number) {
    this.stride = Math.max(1, Math.ceil(tigerCount / CAMERA.maxTigers));
    const cap = trexCount + Math.ceil(tigerCount / this.stride);
    this.xs = new Float64Array(cap);
    this.ys = new Float64Array(cap);
  }

  /** The camera `zoom` wants for the world's current state (see ZOOM_*). */
  target(w: World, zoom: number): Camera {
    const p = w.p;
    const L = p.L;
    const out = this.out;
    out.cx = L / 2;
    out.cy = L / 2;
    out.view = L;
    if (zoom === ZOOM_FIT) return out;
    if (zoom > 1) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < p.N; i++) {
        if (!w.ralive[i]) continue;
        sx += w.rx[i] as number;
        sy += w.ry[i] as number;
        n++;
      }
      if (n > 0) {
        out.cx = sx / n;
        out.cy = sy / n;
      }
      out.view = L / zoom;
      return out;
    }
    // Auto: trimmed box of living T-Rex and tigers still in the fight (approach, latched, recover).
    const xs = this.xs;
    const ys = this.ys;
    let n = 0;
    for (let i = 0; i < p.N; i++) {
      if (!w.ralive[i]) continue;
      xs[n] = w.rx[i] as number;
      ys[n] = w.ry[i] as number;
      n++;
    }
    for (let j = 0; j < p.M; j += this.stride) {
      if ((w.ts[j] as number) > TigerState.Recover) continue;
      xs[n] = w.tx[j] as number;
      ys[n] = w.ty[j] as number;
      n++;
    }
    if (n === 0) return out;
    // Sort the whole buffer with the unused tail at +∞, so no subarray view is allocated.
    xs.fill(Infinity, n);
    ys.fill(Infinity, n);
    xs.sort();
    ys.sort();
    const trim = n > CAMERA.trimMinPoints ? CAMERA.trim : 0;
    const x0 = quantile(xs, n, trim);
    const x1 = quantile(xs, n, 1 - trim);
    const y0 = quantile(ys, n, trim);
    const y1 = quantile(ys, n, 1 - trim);
    out.cx = (x0 + x1) / 2;
    out.cy = (y0 + y1) / 2;
    out.view = Math.min(
      L,
      Math.max(CAMERA.minViewM, x1 - x0 + 2 * CAMERA.padM, y1 - y0 + 2 * CAMERA.padM),
    );
    return out;
  }
}
