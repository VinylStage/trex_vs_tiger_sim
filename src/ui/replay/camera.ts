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
/** Auto camera: margin around the fighters and smallest view (m), easing rate (1/s). */
const AUTO_PAD_M = 25;
const AUTO_MIN_VIEW_M = 80;
const EASE_RATE = 3;

/** The camera a zoom mode wants for the world's current state (pure). */
export function targetCamera(w: World, zoom: number, out: Camera): Camera {
  const p = w.p;
  const L = p.L;
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
  // Auto: bounding box of living T-Rex and tigers still in the fight.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < p.N; i++) {
    if (!w.ralive[i]) continue;
    const x = w.rx[i] as number;
    const y = w.ry[i] as number;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  for (let j = 0; j < p.M; j++) {
    if ((w.ts[j] as number) >= TigerState.Routed) continue;
    const x = w.tx[j] as number;
    const y = w.ty[j] as number;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return out;
  out.cx = (x0 + x1) / 2;
  out.cy = (y0 + y1) / 2;
  out.view = Math.min(
    L,
    Math.max(AUTO_MIN_VIEW_M, x1 - x0 + 2 * AUTO_PAD_M, y1 - y0 + 2 * AUTO_PAD_M),
  );
  return out;
}

/** Move `cam` toward `target`, frame-rate independently; dt = 0 snaps. */
export function easeCamera(cam: Camera, target: Camera, dt: number): void {
  const k = dt > 0 ? 1 - Math.exp(-dt * EASE_RATE) : 1;
  cam.cx += (target.cx - cam.cx) * k;
  cam.cy += (target.cy - cam.cy) * k;
  cam.view += (target.view - cam.view) * k;
}
