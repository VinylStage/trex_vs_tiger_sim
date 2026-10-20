import { PackState, type TraceFrame } from '../../sim/engine';
import { EventType } from '../../sim/events';
import type { Camera } from './camera';
import type { Viewport } from './draw';
import {
  deadCross,
  latchedDiamond,
  packRadiusPx,
  heavyLengthPx,
  heavyTriangle,
  type Bucket,
  type PathSink,
} from './glyphs';
import type { Prepared } from './prepare';
import { heavyPose } from './world';

/**
 * Static overview of the whole battle (docs/REPLAY.md §11), shown instead of an animation when
 * the viewer prefers reduced motion: heavy paths and pack animal paths (both thinned when there are
 * many), where latches happened,
 * where pack animals died, and each heavy's final pose. Built once per trace and viewport; no rAF.
 */
export const OVERVIEW = {
  /** At most this many pack animal paths (evenly strided). */
  maxPack: 600,
  /** At most this many path vertices in total; frames are strided to fit. */
  maxPoints: 150_000,
  /** At most this many heavy paths; above thinHeavyOver heavy they are drawn thin and lighter. */
  maxHeavy: 100,
  thinHeavyOver: 50,
  /** At most this many latch marks (evenly strided). */
  maxLatches: 2000,
  /** Framing: margin around every heavy position (m) and the smallest view. */
  padM: 40,
  minViewM: 80,
  /** Latch marks are diamonds of 0.7 r. */
  latchSize: 0.7,
} as const;

/** Paint order of the overview's buckets. */
export const OVERVIEW_ORDER: readonly Bucket[] = [
  'ovPack',
  'ovHeavy',
  'ovHeavyThin',
  'ovLatch',
  'deadCross',
  'deadHeavy',
  'heavyHalo',
];

/** The camera framing every recorded heavy position (pure). */
export function overviewCamera(p: Prepared): Camera {
  const L = p.L;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const fr of p.trace.frames) {
    for (let i = 0; i < p.N; i++) {
      const x = fr.heavy[i * 4] as number;
      const y = fr.heavy[i * 4 + 1] as number;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0)) return { cx: L / 2, cy: L / 2, view: L };
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    view: Math.min(
      L,
      Math.max(OVERVIEW.minViewM, x1 - x0 + 2 * OVERVIEW.padM, y1 - y0 + 2 * OVERVIEW.padM),
    ),
  };
}

/** Append the overview's geometry for viewport `vp`. Returns the number of path vertices. */
export function buildOverview(p: Prepared, vp: Viewport, sink: (b: Bucket) => PathSink): number {
  const frames = p.trace.frames;
  const F = frames.length;
  if (F === 0) return 0;
  const { scale, ox, oy } = vp;
  const X = (x: number): number => ox + x * scale;
  const Y = (y: number): number => oy + y * scale;
  const tStride = Math.max(1, Math.ceil(p.M / OVERVIEW.maxPack));
  const rStride = Math.max(1, Math.ceil(p.N / OVERVIEW.maxHeavy));
  const paths = Math.ceil(p.N / rStride) + Math.ceil(p.M / tStride);
  const fStride = Math.max(1, Math.ceil((paths * F) / OVERVIEW.maxPoints));
  let points = 0;

  const tp = sink('ovPack');
  for (let j = 0; j < p.M; j += tStride) {
    for (let k = 0; k < F; k += fStride) {
      const fr = frames[k] as TraceFrame;
      const s = fr.pack[j * 3 + 2] as number;
      const x = X(fr.pack[j * 3] as number);
      const y = Y(fr.pack[j * 3 + 1] as number);
      if (k === 0) tp.moveTo(x, y);
      else tp.lineTo(x, y);
      points++;
      if (s >= PackState.Dead) break;
    }
  }

  const rp = sink(p.N > OVERVIEW.thinHeavyOver ? 'ovHeavyThin' : 'ovHeavy');
  for (let i = 0; i < p.N; i += rStride) {
    for (let k = 0; k < F; k += fStride) {
      const fr = frames[k] as TraceFrame;
      const x = X(fr.heavy[i * 4] as number);
      const y = Y(fr.heavy[i * 4 + 1] as number);
      if (k === 0) rp.moveTo(x, y);
      else rp.lineTo(x, y);
      points++;
      if ((fr.heavy[i * 4 + 3] as number) <= 0) break;
    }
  }

  const r = packRadiusPx(p.trace.meta.packRadius, scale);
  // Latch marks: where each latch put the pack animal on its host (ride position at the latch time).
  let latches = 0;
  for (let k = 0; k < p.evCount; k++) {
    if (p.evType[k] === EventType.Latch && (p.evStep[k] as number) <= p.completeStep) latches++;
  }
  const lStride = Math.max(1, Math.ceil(latches / OVERVIEW.maxLatches));
  const pose = new Float64Array(5);
  const lp = sink('ovLatch');
  let seen = 0;
  for (let j = 0; j < p.M; j++) {
    for (let l = p.liOff[j] as number; l < (p.liOff[j + 1] as number); l++) {
      if (seen++ % lStride !== 0) continue;
      const host = p.liHost[l] as number;
      if (host >= p.N) continue;
      heavyPose(p, host, (p.liStart[l] as number) * p.dt, pose);
      const a = (pose[2] as number) + (p.liAng[l] as number);
      const x = X((pose[0] as number) + Math.cos(a) * p.attachR);
      const y = Y((pose[1] as number) + Math.sin(a) * p.attachR);
      latchedDiamond(lp, x, y, r * OVERVIEW.latchSize);
    }
  }

  // Kill marks: grey crosses where pack animals died.
  const last = frames[F - 1] as TraceFrame;
  const kp = sink('deadCross');
  for (let j = 0; j < p.M; j++) {
    if (last.pack[j * 3 + 2] !== PackState.Dead) continue;
    const gx = p.goneX[j] as number;
    const known = !Number.isNaN(gx);
    deadCross(
      kp,
      X(known ? gx : (last.pack[j * 3] as number)),
      Y(known ? (p.goneY[j] as number) : (last.pack[j * 3 + 1] as number)),
      r,
    );
  }

  // Final heavy poses.
  const len = heavyLengthPx(scale, p.heavyLengthM);
  for (let i = 0; i < p.N; i++) {
    const o = i * 4;
    const dead = (last.heavy[o + 3] as number) <= 0;
    const hd = last.heavy[o + 2] as number;
    heavyTriangle(
      sink(dead ? 'deadHeavy' : 'heavyHalo'),
      X(last.heavy[o] as number),
      Y(last.heavy[o + 1] as number),
      Math.cos(hd),
      Math.sin(hd),
      len,
    );
  }
  return points;
}
