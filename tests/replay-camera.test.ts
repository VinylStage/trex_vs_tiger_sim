import { describe, expect, it } from 'vitest';
import { PackState } from '../src/sim/engine';
import {
  CAMERA,
  CameraRig,
  CameraTarget,
  ZOOM_AUTO,
  ZOOM_FIT,
  smoothDamp,
} from '../src/ui/replay/camera';
import { QUALITY, QualityGovernor, TIERS } from '../src/ui/replay/quality';
import type { World } from '../src/ui/replay/world';

/** Run SmoothDamp from 0 toward 1 for `seconds` at a fixed frame rate; positions per frame. */
function damp(hz: number, seconds: number, smoothTime = 0.45): number[] {
  const io = new Float64Array(2);
  const out: number[] = [];
  for (let k = 0; k < Math.round(seconds * hz); k++) {
    smoothDamp(io, 1, smoothTime, 1 / hz);
    out.push(io[0] as number);
  }
  return out;
}

describe('camera damping', () => {
  it('approaches the target monotonically and never overshoots', () => {
    for (const hz of [24, 30, 60, 144]) {
      const xs = damp(hz, 3);
      for (let k = 1; k < xs.length; k++) {
        expect(xs[k]).toBeGreaterThanOrEqual(xs[k - 1] as number);
        expect(xs[k]).toBeLessThanOrEqual(1);
      }
      expect(xs[xs.length - 1]).toBeGreaterThan(0.999);
    }
  });

  it('is frame-rate independent: 30, 60 and 144 Hz agree within 0.1 % of the move', () => {
    for (const t of [0.5, 1, 1.5]) {
      const at = (hz: number): number => damp(hz, t)[Math.round(t * hz) - 1] as number;
      const ref = at(144);
      expect(Math.abs(at(30) - ref)).toBeLessThan(0.001);
      expect(Math.abs(at(60) - ref)).toBeLessThan(0.001);
    }
    // Roughly the smoothing time to cover most of the distance.
    expect(damp(60, CAMERA.centreTime).at(-1)).toBeGreaterThan(0.5);
  });

  it('rig: snaps on dt = 0, follows in log-zoom, ignores small zoom changes', () => {
    const rig = new CameraRig();
    rig.step({ cx: 10, cy: 20, view: 100 }, 1 / 60);
    expect([rig.cx, rig.cy, rig.view]).toEqual([10, 20, expect.closeTo(100, 9)]);
    // +4 % wider and −10 % narrower are inside the hysteresis band: the zoom stays put.
    for (const v of [104, 90]) {
      for (let k = 0; k < 120; k++) rig.step({ cx: 10, cy: 20, view: v }, 1 / 60);
      expect(rig.view).toBeCloseTo(100, 9);
    }
    // +20 % is outside: the view converges on it, symmetric in log space.
    for (let k = 0; k < 240; k++) rig.step({ cx: 10, cy: 20, view: 120 }, 1 / 60);
    expect(rig.view).toBeCloseTo(120, 2);
    // Halfway in time is roughly halfway in log(view), whichever the direction.
    const rigOut = new CameraRig();
    const rigIn = new CameraRig();
    rigOut.snap({ cx: 0, cy: 0, view: 100 });
    rigIn.snap({ cx: 0, cy: 0, view: 400 });
    for (let k = 0; k < 18; k++) {
      rigOut.step({ cx: 0, cy: 0, view: 400 }, 1 / 60);
      rigIn.step({ cx: 0, cy: 0, view: 100 }, 1 / 60);
    }
    const fOut = Math.log(rigOut.view / 100) / Math.log(4);
    const fIn = Math.log(400 / rigIn.view) / Math.log(4);
    expect(fOut).toBeCloseTo(fIn, 9);
    // Seek: dt = 0 snaps.
    rig.step({ cx: 500, cy: 500, view: 60 }, 0);
    expect([rig.cx, rig.cy]).toEqual([500, 500]);
    expect(rig.view).toBeCloseTo(60, 9);
  });

  it('auto target: trimmed box of fighters, outliers and fled tigers ignored', () => {
    const N = 2;
    const M = 100;
    const w = {
      p: { N, M, L: 1000 },
      rx: Float64Array.of(400, 440),
      ry: Float64Array.of(500, 520),
      ralive: Uint8Array.of(1, 1),
      tx: new Float64Array(M),
      ty: new Float64Array(M),
      ts: new Uint8Array(M),
    } as unknown as World;
    for (let j = 0; j < M; j++) {
      w.tx[j] = 400 + (j % 10) * 5;
      w.ty[j] = 500 + Math.floor(j / 10) * 2;
    }
    // One far outlier (trimmed) and one far routed tiger (not a fighter).
    w.tx[0] = 990;
    w.ty[0] = 10;
    w.ts[1] = PackState.Routed;
    w.tx[1] = 5;
    w.ty[1] = 5;
    const ct = new CameraTarget(N, M);
    const c = ct.target(w, ZOOM_AUTO);
    expect(c.cx).toBeGreaterThan(400);
    expect(c.cx).toBeLessThan(450);
    expect(c.view).toBeLessThan(120);
    expect(c.view).toBeGreaterThanOrEqual(CAMERA.minViewM);
    expect(ct.target(w, ZOOM_FIT)).toEqual({ cx: 500, cy: 500, view: 1000 });
    const z2 = ct.target(w, 2);
    expect([z2.cx, z2.cy, z2.view]).toEqual([420, 510, 500]);
  });
});

describe('adaptive quality', () => {
  /** Feed frames at a fixed interval and draw time for `seconds`; returns the end time. */
  function feed(
    g: QualityGovernor,
    start: number,
    seconds: number,
    iv: number,
    js: number,
  ): number {
    let now = start;
    while (now < start + seconds * 1000) {
      now += iv;
      g.push(now, iv, js);
    }
    return now;
  }
  /** Feed until the tier changes (or `max` s); returns [end time, seconds it took]. */
  function until(
    g: QualityGovernor,
    start: number,
    iv: number,
    js: number,
    max = 60,
  ): [number, number] {
    const tier = g.tier;
    let now = start;
    while (g.tier === tier && now < start + max * 1000) {
      now += iv;
      g.push(now, iv, js);
    }
    return [now, (now - start) / 1000];
  }

  it('steps down after about a second of slow frames, one tier at a time', () => {
    const g = new QualityGovernor();
    let now = feed(g, 0, 2, 16.7, 3);
    expect(g.tier).toBe(0);
    now = feed(g, now, 0.9, 30, 14);
    expect(g.tier).toBe(0);
    const [end, took] = until(g, now, 30, 14);
    expect(g.tier).toBe(1);
    expect(0.9 + took).toBeGreaterThanOrEqual(1);
    expect(0.9 + took).toBeLessThan(2.5);
    feed(g, end, 10, 30, 14);
    expect(g.tier).toBe(TIERS.length - 1);
    expect(TIERS[3]).toMatchObject({ forceLod: true, heavyTrails: false, fills: false, dprCap: 2 });
  });

  it('steps back up after at least 5 s of headroom', () => {
    const g = new QualityGovernor();
    let now = feed(g, 0, 2, 16.7, 3);
    [now] = until(g, now, 40, 14);
    const down = g.tier;
    expect(down).toBe(1);
    const [, took] = until(g, now, 16.7, 3);
    expect(g.tier).toBe(0);
    expect(took).toBeGreaterThanOrEqual(QUALITY.upAfterMs / 1000);
    expect(took).toBeLessThan(QUALITY.upAfterMs / 1000 + 2);
  });

  it('does not treat a steady 30 fps browser cap as slow', () => {
    const g = new QualityGovernor();
    feed(g, 0, 20, 33.3, 2);
    expect(g.tier).toBe(0);
    expect(g.cadenceMs).toBeCloseTo(33.3, 5);
    // A busy page at the same 30 fps (expensive draws) is slow.
    const busy = new QualityGovernor();
    feed(busy, 0, 5, 33.3, 20);
    expect(busy.tier).toBeGreaterThan(0);
  });

  it('backs off when it keeps flapping between tiers', () => {
    const g = new QualityGovernor();
    let now = feed(g, 0, 2, 16.7, 3);
    [now] = until(g, now, 40, 14);
    const up = until(g, now, 16.7, 3);
    now = up[0];
    const first = up[1];
    expect(g.tier).toBe(0);
    [now] = until(g, now, 40, 14);
    expect(g.tier).toBe(1);
    const [, second] = until(g, now, 16.7, 3);
    expect(g.tier).toBe(0);
    expect(second).toBeGreaterThan(first + QUALITY.upAfterMs / 1000 - 0.5);
  });
});
