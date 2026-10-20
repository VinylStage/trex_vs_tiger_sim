import { TigerState, type TraceFrame } from '../../sim/engine';
import { EventType } from '../../sim/events';
import type { Viewport } from './draw';
import {
  FX_BUCKETS,
  TRAIL_BUCKETS,
  biteCone,
  burst,
  ring,
  tigerRadiusPx,
  type Bucket,
  type PathSink,
} from './glyphs';
import { frameIndex } from './interp';
import type { Prepared } from './prepare';
import type { World } from './world';

/**
 * Event effects and motion trails (docs/REPLAY.md §9). Pure: they only append geometry to path
 * sinks and count what they drew, so the flash budget is unit-tested in Node.
 *
 * Effects are abstract outlines (rings, wedges, short rays) timed in real seconds, so they stay
 * readable at 16×. Kills are neutral grey rings; nothing is red and nothing is figurative.
 */

/** Effect lifetimes in real seconds (ANIMATION.md §6.2). */
export const FX_DURATION: Readonly<Partial<Record<number, number>>> = {
  [EventType.BiteHit]: 0.32,
  [EventType.BiteMiss]: 0.22,
  [EventType.Latch]: 0.28,
  [EventType.Throw]: 0.36,
  [EventType.TigerDeath]: 0.5,
  [EventType.Rout]: 0.3,
  [EventType.TrexDeath]: 0.9,
};
/** Longest effect lifetime: the scan window is this many real seconds back. */
export const FX_WINDOW_S = 0.9;
/** Most effects drawn in one frame (bites, rings, bursts together). */
export const FX_MAX_PER_FRAME = 300;

/**
 * Flash safety (WCAG 2.3.1; ANIMATION.md §3.4). A bite cone is filled only if
 * - the same T-Rex's previous bite was at least FLASH_GAP_S real seconds earlier, so one T-Rex
 *   starts at most 3 fills in any second (0, 0.34, 0.68 s);
 * - playback is at most FLASH_MAX_SPEED× (above it every cone is an outline);
 * - the wedge is at most FLASH_WEDGE_MAX_PX, and the frame's filled area stays at most
 *   FLASH_AREA_PX CSS px² (< 21,824 px² = 25 % of the 341 × 256 px "10° field").
 * Everything else is drawn as an outline.
 */
export const FLASH_GAP_S = 0.34;
export const FLASH_MAX_SPEED = 4;
export const FLASH_AREA_PX = 20_000;
export const FLASH_WEDGE_MAX_PX = 4_000;

/** Whether a bite may be drawn filled (pure, see the constants above). */
export function mayFill(gapSim: number, speed: number, area: number, usedArea: number): boolean {
  const sp = Math.max(0.25, speed);
  return (
    speed <= FLASH_MAX_SPEED &&
    gapSim >= FLASH_GAP_S * sp &&
    area <= FLASH_WEDGE_MAX_PX &&
    usedArea + area <= FLASH_AREA_PX
  );
}

/** Motion trails: 3 s of sim time behind each agent, within budgets (ANIMATION.md §3.2). */
export const TRAIL = {
  simSeconds: 3,
  maxTrex: 100,
  maxTigers: 400,
  /** Tiger trails only when tigers are drawn as glyphs at least this large (r, CSS px). */
  minTigerPx: 3,
  /** Off-screen margin (CSS px) inside which trails are still built. */
  cullPx: 50,
} as const;

/** What the effect and trail passes drew in the last frame. */
export interface FxCounters {
  effects: number;
  /** Effects skipped by FX_MAX_PER_FRAME. */
  capped: number;
  wedges: number;
  fills: number;
  /** Filled bite-cone area (CSS px²). */
  flashArea: number;
  trexTrails: number;
  tigerTrails: number;
}

export const newFxCounters = (): FxCounters => ({
  effects: 0,
  capped: 0,
  wedges: 0,
  fills: 0,
  flashArea: 0,
  trexTrails: 0,
  tigerTrails: 0,
});

export interface FxOptions {
  /** Playback speed (sim s per real s). */
  speed: number;
  /** Adaptive quality may forbid fills altogether (outline-only effects). */
  fills: boolean;
  /** Debug hook: called for every filled bite cone (event index, T-Rex). */
  onFill?: ((event: number, trex: number) => void) | undefined;
}

const RING_BITE_FROM = 1.2;
const RING_BITE_GROW = 2.2;
const RING_LATCH_FROM = 3.2;
const RING_LATCH_SHRINK = 2;
const RING_DEATH_GROW = 3;
const RING_ROUT_GROW = 1.5;
const TREX_DEATH_FROM_PX = 10;
const TREX_DEATH_GROW_PX = 26;
const BURST_FROM_PX = 4;
const BURST_TRAVEL_PX = 10;
const BURST_RAY_PX = 6;

/**
 * Append the effects of every event within FX_WINDOW_S real seconds before the world's time.
 * Events are found by binary search over the stamp-sorted log; alpha is quantised to 3 steps
 * (bucket 0 = fresh) so each colour costs at most three strokes.
 */
export function collectEffects(
  p: Prepared,
  w: World,
  vp: Viewport,
  opt: FxOptions,
  sink: (b: Bucket) => PathSink,
  c: FxCounters,
): void {
  if (p.evCount === 0) return;
  const { cssW, cssH, scale, ox, oy } = vp;
  const sp = Math.max(0.25, opt.speed);
  const time = w.time;
  const from = Math.ceil((time - FX_WINDOW_S * sp) / p.dt - 1e-6);
  const until = Math.floor(time / p.dt + 1e-6);
  let lo = 0;
  let hi = p.evCount;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((p.evStep[mid] as number) < from) lo = mid + 1;
    else hi = mid;
  }
  const meta = p.trace.meta;
  const r = tigerRadiusPx(meta.tigerRadius, scale);
  const inView = (x: number, y: number, m: number): boolean =>
    x >= -m && y >= -m && x <= cssW + m && y <= cssH + m;
  for (let k = lo; k < p.evCount; k++) {
    const step = p.evStep[k] as number;
    if (step > until) break;
    const type = p.evType[k] as number;
    const dur = FX_DURATION[type];
    if (dur === undefined) continue;
    const age = (time - step * p.dt) / sp;
    if (age < 0 || age > dur) continue;
    if (c.effects >= FX_MAX_PER_FRAME) {
      c.capped++;
      continue;
    }
    const prog = age / dur;
    const bk = prog < 1 / 3 ? 0 : prog < 2 / 3 ? 1 : 2;
    const a = p.evA[k] as number;
    const b = p.evB[k] as number;
    switch (type) {
      case EventType.BiteHit:
      case EventType.BiteMiss: {
        if (a >= p.N || !w.ralive[a]) continue;
        const hit = type === EventType.BiteHit;
        const reach = (meta.reach[a] as number) * scale;
        const x = ox + (w.rx[a] as number) * scale;
        const y = oy + (w.ry[a] as number) * scale;
        if (!inView(x, y, reach)) continue;
        const arc = meta.arc[a] as number;
        const area = reach * reach * arc;
        const fill =
          hit && opt.fills && mayFill(p.evGap[k] as number, opt.speed, area, c.flashArea);
        if (fill) {
          c.flashArea += area;
          c.fills++;
          opt.onFill?.(k, a);
        }
        biteCone(sink(fill ? 'biteHit' : 'biteMiss'), x, y, w.rh[a] as number, reach, arc);
        c.wedges++;
        if (hit && b < p.M) {
          const tx = ox + (w.tx[b] as number) * scale;
          const ty = oy + (w.ty[b] as number) * scale;
          ring(sink(FX_BUCKETS.trex[bk]), tx, ty, r * (RING_BITE_FROM + RING_BITE_GROW * prog));
        }
        break;
      }
      case EventType.Latch: {
        if (a >= p.M) continue;
        const x = ox + (w.tx[a] as number) * scale;
        const y = oy + (w.ty[a] as number) * scale;
        if (!inView(x, y, 4 * r)) continue;
        ring(sink(FX_BUCKETS.tiger[bk]), x, y, r * (RING_LATCH_FROM - RING_LATCH_SHRINK * prog));
        break;
      }
      case EventType.Throw: {
        if (a >= p.M || b >= p.N) continue;
        const x = ox + (w.tx[a] as number) * scale;
        const y = oy + (w.ty[a] as number) * scale;
        if (!inView(x, y, 30)) continue;
        let ux = x - (ox + (w.rx[b] as number) * scale);
        let uy = y - (oy + (w.ry[b] as number) * scale);
        const ul = Math.hypot(ux, uy);
        if (ul < 1e-9) {
          ux = 1;
          uy = 0;
        } else {
          ux /= ul;
          uy /= ul;
        }
        const r0 = BURST_FROM_PX + BURST_TRAVEL_PX * prog;
        burst(sink(FX_BUCKETS.trex[bk]), x, y, ux, uy, r0, r0 + BURST_RAY_PX);
        break;
      }
      case EventType.TigerDeath:
      case EventType.Rout: {
        if (a >= p.M) continue;
        const x = ox + (w.tx[a] as number) * scale;
        const y = oy + (w.ty[a] as number) * scale;
        if (!inView(x, y, 5 * r)) continue;
        const death = type === EventType.TigerDeath;
        const rad = r * (1 + (death ? RING_DEATH_GROW : RING_ROUT_GROW) * prog);
        ring(sink((death ? FX_BUCKETS.dead : FX_BUCKETS.out)[bk]), x, y, rad);
        break;
      }
      case EventType.TrexDeath: {
        if (a >= p.N) continue;
        const x = ox + (w.rx[a] as number) * scale;
        const y = oy + (w.ry[a] as number) * scale;
        const rad = TREX_DEATH_FROM_PX + TREX_DEATH_GROW_PX * prog;
        if (!inView(x, y, rad)) continue;
        ring(sink(FX_BUCKETS.dead[bk]), x, y, rad);
        break;
      }
    }
    c.effects++;
  }
}

/**
 * Trails: a polyline from each agent's drawn position back through the frames of the last
 * TRAIL.simSeconds of sim time, split into three age buckets (pre-blended tones, newest darkest).
 * Drawn deterministically from the trace, so scrubbing and camera moves never smear.
 * At most TRAIL.maxTrex T-Rex and TRAIL.maxTigers tigers (approaching or routed, only while the
 * frames show the same state) get a trail.
 */
export function collectTrails(
  p: Prepared,
  w: World,
  vp: Viewport,
  opt: { trex: boolean; tigers: boolean },
  sink: (b: Bucket) => PathSink,
  c: FxCounters,
): void {
  const frames = p.trace.frames;
  if (frames.length === 0) return;
  const { cssW, cssH, scale, ox, oy } = vp;
  const time = w.time;
  const k = frameIndex(p.frameT, time);
  const k0 = frameIndex(p.frameT, Math.max(0, time - TRAIL.simSeconds));
  const m = TRAIL.cullPx;
  const ageBucket = (kk: number): 0 | 1 | 2 => {
    const age = (time - (p.frameT[kk] as number)) / TRAIL.simSeconds;
    return age < 1 / 3 ? 0 : age < 2 / 3 ? 1 : 2;
  };
  if (opt.trex) {
    for (let i = 0; i < p.N && c.trexTrails < TRAIL.maxTrex; i++) {
      if (!w.ralive[i]) continue;
      let px = ox + (w.rx[i] as number) * scale;
      let py = oy + (w.ry[i] as number) * scale;
      if (px < -m || py < -m || px > cssW + m || py > cssH + m) continue;
      c.trexTrails++;
      for (let kk = k; kk >= k0; kk--) {
        const fr = frames[kk] as TraceFrame;
        const x = ox + (fr.trex[i * 4] as number) * scale;
        const y = oy + (fr.trex[i * 4 + 1] as number) * scale;
        const s = sink(TRAIL_BUCKETS.trex[ageBucket(kk)]);
        s.moveTo(px, py);
        s.lineTo(x, y);
        px = x;
        py = y;
      }
    }
  }
  if (!opt.tigers) return;
  for (let j = 0; j < p.M && c.tigerTrails < TRAIL.maxTigers; j++) {
    const st = w.ts[j] as number;
    if (st !== TigerState.Approach && st !== TigerState.Routed) continue;
    let px = ox + (w.tx[j] as number) * scale;
    let py = oy + (w.ty[j] as number) * scale;
    if (px < -m || py < -m || px > cssW + m || py > cssH + m) continue;
    c.tigerTrails++;
    for (let kk = k; kk >= k0; kk--) {
      const fr = frames[kk] as TraceFrame;
      if (fr.tiger[j * 3 + 2] !== st) break;
      const x = ox + (fr.tiger[j * 3] as number) * scale;
      const y = oy + (fr.tiger[j * 3 + 1] as number) * scale;
      const s = sink(TRAIL_BUCKETS.tiger[ageBucket(kk)]);
      s.moveTo(px, py);
      s.lineTo(x, y);
      px = x;
      py = y;
    }
  }
}
