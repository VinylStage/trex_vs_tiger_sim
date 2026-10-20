import { describe, expect, it } from 'vitest';
import type { BattleTrace } from '../src/sim/engine';
import { CameraRig, CameraTarget, ZOOM_AUTO } from '../src/ui/replay/camera';
import { makeViewport } from '../src/ui/replay/draw';
import {
  FLASH_AREA_PX,
  FLASH_GAP_S,
  FLASH_MAX_SPEED,
  FLASH_WEDGE_MAX_PX,
  FX_MAX_PER_FRAME,
  TRAIL,
  collectEffects,
  collectTrails,
  mayFill,
  newFxCounters,
  type FxCounters,
} from '../src/ui/replay/effects';
import type { Bucket, PathSink } from '../src/ui/replay/glyphs';
import { prepare } from '../src/ui/replay/prepare';
import { World } from '../src/ui/replay/world';
import { traceOf } from './replay-helpers';

const nullSink = (): PathSink => ({
  moveTo: () => undefined,
  lineTo: () => undefined,
  arc: () => undefined,
  closePath: () => undefined,
});

describe('flash rule', () => {
  it('fills only within the rate, speed, size and area limits', () => {
    expect(mayFill(Infinity, 1, 1000, 0)).toBe(true);
    // ≤ 3 per second per T-Rex: the previous bite must be ≥ 0.34 real s earlier.
    expect(mayFill(0.3, 1, 1000, 0)).toBe(false);
    expect(mayFill(FLASH_GAP_S, 1, 1000, 0)).toBe(true);
    // Real time: at 2× a 0.5 s sim gap is 0.25 s real.
    expect(mayFill(0.5, 2, 1000, 0)).toBe(false);
    expect(mayFill(0.7, 2, 1000, 0)).toBe(true);
    // Slow motion keeps the 0.25× floor of the rate rule.
    expect(mayFill(0.09, 0.25, 1000, 0)).toBe(true);
    // Above 4× every cone is an outline.
    expect(mayFill(Infinity, FLASH_MAX_SPEED, 1000, 0)).toBe(true);
    expect(mayFill(Infinity, 8, 1000, 0)).toBe(false);
    // Size and frame area caps.
    expect(mayFill(Infinity, 1, FLASH_WEDGE_MAX_PX + 1, 0)).toBe(false);
    expect(mayFill(Infinity, 1, 3000, FLASH_AREA_PX - 2999)).toBe(false);
    expect(mayFill(Infinity, 1, 3000, FLASH_AREA_PX - 3000)).toBe(true);
  });
});

interface FlashReport {
  frames: number;
  maxArea: number;
  maxEffects: number;
  maxFillsPerSecond: number;
  fillStarts: number;
  fills: number;
  maxHeavyTrails: number;
  maxPackTrails: number;
}

/**
 * Play a trace at `speed`× and 60 Hz like the player does (auto camera, or a fixed close view),
 * recording every filled bite cone's start in real time per T-Rex.
 */
function playFlash(trace: BattleTrace, speed: number, fixedScale?: number): FlashReport {
  const p = prepare(trace);
  const w = new World(p);
  const ct = new CameraTarget(p.N, p.M);
  const rig = new CameraRig();
  const c: FxCounters = newFxCounters();
  const starts: number[][] = Array.from({ length: p.N }, () => []);
  const lastEvent = new Int32Array(p.N).fill(-1);
  let real = 0;
  const rep: FlashReport = {
    frames: 0,
    maxArea: 0,
    maxEffects: 0,
    maxFillsPerSecond: 0,
    fillStarts: 0,
    fills: 0,
    maxHeavyTrails: 0,
    maxPackTrails: 0,
  };
  const hz = 60;
  const sink: (b: Bucket) => PathSink = nullSink;
  for (let t = 0; t <= p.duration; t += speed / hz, real += 1 / hz) {
    w.update(t);
    rig.step(ct.target(w, ZOOM_AUTO), 1 / hz);
    const vp = fixedScale
      ? makeViewport(620, 620, 2, rig.cx, rig.cy, 604 / fixedScale)
      : makeViewport(620, 620, 2, rig.cx, rig.cy, rig.view);
    Object.assign(c, newFxCounters());
    collectTrails(p, w, vp, { heavy: true, pack: true }, sink, c);
    collectEffects(
      p,
      w,
      vp,
      {
        speed,
        fills: true,
        onFill: (k, i) => {
          if (lastEvent[i] === k) return;
          lastEvent[i] = k;
          (starts[i] as number[]).push(real);
        },
      },
      sink,
      c,
    );
    rep.frames++;
    rep.maxArea = Math.max(rep.maxArea, c.flashArea);
    rep.maxEffects = Math.max(rep.maxEffects, c.effects);
    rep.fills += c.fills;
    rep.maxHeavyTrails = Math.max(rep.maxHeavyTrails, c.heavyTrails);
    rep.maxPackTrails = Math.max(rep.maxPackTrails, c.packTrails);
  }
  for (const s of starts) {
    rep.fillStarts += s.length;
    for (let a = 0, b = 0; b < s.length; b++) {
      while ((s[b] as number) - (s[a] as number) >= 1) a++;
      rep.maxFillsPerSecond = Math.max(rep.maxFillsPerSecond, b - a + 1);
    }
  }
  return rep;
}

describe('flash budget accounting (V3, Node)', () => {
  const t10 = traceOf({ runs: 20 }, 7).trace;
  const t50 = traceOf({ heavyCount: 50, packCount: 1000, runs: 2, maxTime: 60 }, 0).trace;

  it.each([0.25, 1, 2, 4])('10v100 close view (12 px/m) at %s×: ≤ 3 fills/s per T-Rex', (speed) => {
    const r = playFlash(t10, speed, 12);
    expect(r.fillStarts).toBeGreaterThan(0);
    expect(r.maxFillsPerSecond).toBeLessThanOrEqual(3);
    expect(r.maxArea).toBeLessThanOrEqual(FLASH_AREA_PX);
    expect(r.maxEffects).toBeLessThanOrEqual(FX_MAX_PER_FRAME);
  });

  it.each([1, 4, 16])('50v1000 auto view at %s×: area ≤ 20,000 px² per frame', (speed) => {
    const r = playFlash(t50, speed);
    expect(r.maxFillsPerSecond).toBeLessThanOrEqual(3);
    expect(r.maxArea).toBeLessThanOrEqual(FLASH_AREA_PX);
    expect(r.maxEffects).toBeLessThanOrEqual(FX_MAX_PER_FRAME);
    expect(r.maxHeavyTrails).toBeLessThanOrEqual(TRAIL.maxHeavy);
    expect(r.maxPackTrails).toBeLessThanOrEqual(TRAIL.maxPack);
    if (speed > FLASH_MAX_SPEED) expect(r.fills).toBe(0);
  });

  it('50v1000 close view at 4×: many simultaneous fills stay under the frame area cap', () => {
    const r = playFlash(t50, 4, 12);
    expect(r.maxArea).toBeGreaterThan(FLASH_AREA_PX / 2);
    expect(r.maxArea).toBeLessThanOrEqual(FLASH_AREA_PX);
    expect(r.maxFillsPerSecond).toBeLessThanOrEqual(3);
  });
});
