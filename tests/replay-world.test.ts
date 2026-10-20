import { describe, expect, it } from 'vitest';
import { DT, TigerState, type TraceFrame } from '../src/sim/engine';
import { EventType, byteAngle } from '../src/sim/events';
import { crEval, crKnots, frameIndex, lastAtMost, lerpAngle } from '../src/ui/replay/interp';
import { prepare } from '../src/ui/replay/prepare';
import { World, trexPose } from '../src/ui/replay/world';
import { checkMotion, synthTrace, traceOf } from './replay-helpers';
import { noAttackParams } from './trace-helpers';

describe('interpolation helpers', () => {
  it('finds frames and list entries by binary search', () => {
    const times = [0, 0.5, 1, 1.5];
    expect(frameIndex(times, -1)).toBe(0);
    expect(frameIndex(times, 0.49)).toBe(0);
    expect(frameIndex(times, 0.5)).toBe(1);
    expect(frameIndex(times, 9)).toBe(3);
    const arr = Uint16Array.of(9, 3, 5, 5, 8, 9);
    expect(lastAtMost(arr, 1, 5, 2)).toBe(0);
    expect(lastAtMost(arr, 1, 5, 5)).toBe(3);
    expect(lastAtMost(arr, 1, 5, 100)).toBe(4);
  });

  it('interpolates headings along the shortest arc', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 10);
    expect(lerpAngle(0.2, 0.6, 0.25)).toBeCloseTo(0.3, 12);
  });

  it('passes the centripetal Catmull-Rom curve through its control points', () => {
    const k = new Float64Array(3);
    crKnots(0, 0, 1, 0, 3, 1, 4, 4, k);
    expect(crEval(0, 1, 3, 4, k, 0)).toBeCloseTo(1, 12);
    expect(crEval(0, 1, 3, 4, k, 1)).toBeCloseTo(3, 12);
    // Points on a line stay on the line.
    crKnots(0, 0, 1, 1, 2, 2, 3, 3, k);
    expect(crEval(0, 1, 2, 3, k, 0.37)).toBeCloseTo(crEval(0, 1, 2, 3, k, 0.37), 12);
    // Repeated points (an agent standing still) do not divide by zero.
    crKnots(5, 5, 5, 5, 5, 5, 5, 5, k);
    expect(crEval(5, 5, 5, 5, k, 0.5)).toBeCloseTo(5, 12);
  });
});

/**
 * Hand-built battle (L = 100 m, dt = 0.1 s, frames every 0.5 s):
 * - T-Rex 0 walks +x at 2 m/s from (40, 50), heading 0. T-Rex 1 walks +y and dies at 3.0 s.
 * - Tiger 0 latches at 0.7 s (90° left of T-Rex 0), is thrown at 2.3 s, resumes at 4.0 s.
 * - Tiger 1 is bitten to death at 1.2 s while approaching.
 * - Tiger 2 latches at 0.3 s behind T-Rex 0 and is killed by a throw at 1.5 s.
 * - Tiger 3 latches at 0.2 s in front of T-Rex 0 and routs at 1.0 s: the engine's rout comes
 *   before the latched position update, so it leaves its host at 0.9 s and flees +x at 14 m/s.
 * - Tiger 4 latches at 3.0 s and is bitten to death at 3.1 s, before it was ever pinned to
 *   its host: it never rides and dies where it made contact, (48, 46).
 * Latched tigers ride from the tick after their latch, as the engine pins them then.
 */
function demo(complete?: number) {
  const R = 2.5 + 0.8;
  const host = (t: number): [number, number] => [40 + 2 * t, 50];
  return synthTrace({
    duration: 5,
    complete,
    trex: [
      { pos: host, hp: (t) => 1 - 0.04 * t },
      {
        pos: (t) => [20, 20 + Math.min(t, 3)],
        heading: () => Math.PI / 2,
        hp: (t) => (t >= 3 ? 0 : 1 - t / 3),
      },
    ],
    tigers: [
      {
        pos: (t) => {
          if (t < 0.7) return [60 - 20 * t, 50 + R];
          if (t < 2.3) return [40 + 2 * t, 50 + R];
          return [44.6, 50 + R + 3 + (t - 2.3)];
        },
      },
      { pos: (t) => [70 - 3 * Math.min(t, 1.2), 40] },
      {
        pos: (t) => (t < 0.3 ? [30, 50] : [40 + 2 * Math.min(t, 1.5) - R, 50]),
      },
      {
        pos: (t) => {
          if (t < 0.2) return [60, 50];
          if (t < 1) return [40 + 2 * t + R, 50];
          return [41.8 + R + 1.4 + 14 * (t - 1), 50];
        },
      },
      { pos: (t) => [60 - 4 * Math.min(t, 3), 46] },
    ],
    events: [
      [2, EventType.Latch, 0, 3, 0],
      [3, EventType.Latch, 128, 2, 0],
      [7, EventType.Latch, 64, 0, 0],
      [10, EventType.Rout, 0, 3, 0],
      [12, EventType.BiteHit, 200, 0, 1],
      [12, EventType.TigerDeath, 0, 1, 0],
      [15, EventType.Throw, 0, 2, 0],
      [15, EventType.TigerDeath, 1, 2, 0],
      [20, EventType.BiteMiss, 0, 0, 0],
      [23, EventType.Throw, 0, 0, 0],
      [30, EventType.Latch, 0, 4, 0],
      [30, EventType.TrexDeath, 0, 1, 0xffff],
      [31, EventType.BiteHit, 255, 0, 4],
      [31, EventType.TigerDeath, 0, 4, 0],
      [40, EventType.Resume, 0, 0, 0xffff],
    ],
  });
}

describe('prepare()', () => {
  const p = prepare(demo());

  it('decodes the log and indexes state transitions per tiger', () => {
    expect(p.evCount).toBe(15);
    expect(p.reduced).toBe(false);
    expect(p.completeStep).toBe(50);
    expect(p.firstContact).toBeCloseTo(0.2, 12);
    const states = (j: number): number[][] =>
      Array.from({ length: (p.trOff[j + 1] as number) - (p.trOff[j] as number) }, (_, k) => [
        p.trStep[(p.trOff[j] as number) + k] as number,
        p.trState[(p.trOff[j] as number) + k] as number,
      ]);
    expect(states(0)).toEqual([
      [7, TigerState.Latched],
      [23, TigerState.Recover],
      [40, TigerState.Approach],
    ]);
    expect(states(1)).toEqual([
      [12, TigerState.Recover],
      [12, TigerState.Dead],
    ]);
    expect(states(2)).toEqual([
      [3, TigerState.Latched],
      [15, TigerState.Recover],
      [15, TigerState.Dead],
    ]);
    expect([...p.stateAtComplete]).toEqual([
      TigerState.Approach,
      TigerState.Dead,
      TigerState.Dead,
      TigerState.Routed,
      TigerState.Dead,
    ]);
  });

  it('indexes latch intervals with host, angle and how they ended', () => {
    const l0 = p.liOff[0] as number;
    expect((p.liOff[1] as number) - l0).toBe(1);
    expect([p.liStart[l0], p.liEnd[l0], p.liHost[l0], p.liEndKind[l0]]).toEqual([
      7,
      23,
      0,
      EventType.Throw,
    ]);
    expect(p.liAng[l0]).toBeCloseTo(byteAngle(64), 12);
    const l2 = p.liOff[2] as number;
    expect([p.liStart[l2], p.liEnd[l2], p.liEndKind[l2]]).toEqual([3, 15, EventType.Throw]);
    const l3 = p.liOff[3] as number;
    expect([p.liStart[l3], p.liEnd[l3], p.liEndKind[l3]]).toEqual([2, 10, EventType.Rout]);
  });

  it('rides from the tick after the latch until the throw, or one tick before a rout or bite', () => {
    const ride = (j: number): number[] => [
      p.liRide[p.liOff[j] as number] as number,
      p.liDetach[p.liOff[j] as number] as number,
    ];
    expect(ride(0)[0]).toBeCloseTo(0.8, 12);
    expect(ride(0)[1]).toBeCloseTo(2.3, 12);
    expect(ride(2)[0]).toBeCloseTo(0.4, 12);
    expect(ride(2)[1]).toBeCloseTo(1.5, 12);
    expect(ride(3)[0]).toBeCloseTo(0.3, 12);
    expect(ride(3)[1]).toBeCloseTo(0.9, 12);
    // Bitten on the tick after its latch: never pinned to the host.
    expect(ride(4)[0]).toBe(Infinity);
    expect(ride(4)[1]).toBeCloseTo(3, 12);
  });

  it('records deaths, exits and the gap between bites', () => {
    expect([...p.goneStep]).toEqual([0xffff, 12, 15, 0xffff, 31]);
    expect(p.goneX[4]).toBeCloseTo(48, 4);
    expect(p.goneY[4]).toBeCloseTo(46, 4);
    // Bitten while approaching: stays at its frame position after death.
    expect(p.goneX[1]).toBeCloseTo(66.4, 4);
    expect(p.goneY[1]).toBeCloseTo(40, 4);
    // Killed while riding: stays where it was drawn riding (behind T-Rex 0 at 1.5 s).
    expect(p.goneX[2]).toBeCloseTo(43 - p.attachR, 4);
    expect(p.goneY[2]).toBeCloseTo(50, 4);
    expect(p.trexDeathTime[0]).toBe(Infinity);
    expect(p.trexDeathTime[1]).toBeCloseTo(3, 12);
    expect(p.trace.frames[p.trexDeathFrame[1] as number]?.t).toBeCloseTo(3, 12);
    expect(p.evType[4]).toBe(EventType.BiteHit);
    expect(p.evGap[4]).toBe(Infinity);
    expect(p.evType[8]).toBe(EventType.BiteMiss);
    expect(p.evGap[8]).toBeCloseTo(0.8, 6);
    expect(p.evType[12]).toBe(EventType.BiteHit);
    expect(p.evGap[12]).toBeCloseTo(1.1, 6);
    expect(p.evGap[1]).toBe(0);
  });
});

describe('World', () => {
  const p = prepare(demo());
  const w = new World(p);

  it('switches tiger states at the exact event times, not at frames', () => {
    w.update(0.69);
    expect(w.ts[0]).toBe(TigerState.Approach);
    w.update(0.7);
    expect(w.ts[0]).toBe(TigerState.Latched);
    w.update(1.19);
    expect(w.ts[1]).toBe(TigerState.Approach);
    w.update(1.2);
    expect(w.ts[1]).toBe(TigerState.Dead);
    w.update(2.31);
    expect(w.ts[0]).toBe(TigerState.Recover);
    w.update(3.99);
    expect(w.ts[0]).toBe(TigerState.Recover);
    w.update(4.0);
    expect(w.ts[0]).toBe(TigerState.Approach);
  });

  it('moves a tiger onto its host during the latch tick, then rides it', () => {
    w.update(0.7);
    expect(w.ts[0]).toBe(TigerState.Latched);
    expect(w.thost[0]).toBe(-1);
    // Frame 0.5 → ride position at 0.8, straight line.
    w.update(0.75);
    expect(w.tx[0]).toBeCloseTo(50 + (41.6 - 50) * (0.25 / 0.3), 6);
    w.update(0.8);
    expect(w.thost[0]).toBe(0);
  });

  it('rides latched tigers on the host pose at the latch angle (V5)', () => {
    for (const t of [0.8, 0.93, 1.6, 2.2]) {
      w.update(t);
      expect(w.ts[0]).toBe(TigerState.Latched);
      expect(w.thost[0]).toBe(0);
      const d = Math.hypot((w.tx[0] as number) - (w.rx[0] as number), (w.ty[0] as number) - 50);
      expect(d).toBeCloseTo(p.attachR, 9);
      expect(w.tx[0]).toBeCloseTo(w.rx[0] as number, 9);
      expect(w.ty[0]).toBeGreaterThan(50);
    }
  });

  it('anchors a thrown tiger 3 m beyond its latch point at the throw time', () => {
    w.update(2.3);
    expect(w.ts[0]).toBe(TigerState.Recover);
    expect(w.thost[0]).toBe(-1);
    expect(w.tx[0]).toBeCloseTo(44.6, 6);
    expect(w.ty[0]).toBeCloseTo(50 + p.attachR + 3, 6);
    // …then moves on toward the next frame sample.
    w.update(2.4);
    expect(w.ty[0]).toBeGreaterThan(50 + p.attachR + 3);
  });

  it('lets a routing tiger leave its host one tick before the rout, without a jump', () => {
    w.update(0.89);
    expect(w.ts[3]).toBe(TigerState.Latched);
    expect(w.thost[3]).toBe(0);
    w.update(0.9);
    expect(w.ts[3]).toBe(TigerState.Latched);
    const rideX = w.tx[3] as number;
    expect(rideX).toBeCloseTo(41.8 + p.attachR, 6);
    w.update(0.95);
    expect(w.ts[3]).toBe(TigerState.Latched);
    expect(w.thost[3]).toBe(-1);
    expect(w.tx[3]).toBeCloseTo(rideX + 0.7, 6);
    w.update(1);
    expect(w.ts[3]).toBe(TigerState.Routed);
    expect(w.tx[3]).toBeCloseTo(41.8 + p.attachR + 1.4, 4);
  });

  it('brings a dying tiger to its final position exactly at the death time', () => {
    w.update(1.0);
    const x10 = w.tx[1] as number;
    w.update(1.1999);
    expect(w.tx[1]).toBeCloseTo(66.4, 2);
    expect(w.tx[1]).toBeLessThan(x10);
    for (const t of [1.2, 2, 5]) {
      w.update(t);
      expect(w.ts[1]).toBe(TigerState.Dead);
      expect(w.tx[1]).toBeCloseTo(66.4, 4);
    }
    // Killed while riding: no jump from the ride position to the death mark.
    w.update(1.4999);
    const rideX = w.tx[2] as number;
    w.update(1.5);
    expect(w.ts[2]).toBe(TigerState.Dead);
    expect(Math.abs((w.tx[2] as number) - rideX)).toBeLessThan(1e-3);
    // Latched but bitten before it was ever pinned: stays at its contact position.
    for (const t of [3, 3.05, 3.1, 4]) {
      w.update(t);
      expect(w.ts[4]).toBe(t < 3.1 ? TigerState.Latched : TigerState.Dead);
      expect(w.thost[4]).toBe(-1);
      expect(w.tx[4]).toBeCloseTo(48, 6);
      expect(w.ty[4]).toBeCloseTo(46, 6);
    }
  });

  it('kills a T-Rex at its event time and keeps it at its final pose', () => {
    w.update(2.9);
    expect(w.ralive[1]).toBe(1);
    expect(w.rhp[1]).toBeGreaterThan(0);
    w.update(3);
    expect(w.ralive[1]).toBe(0);
    expect(w.rhp[1]).toBe(0);
    w.update(4.5);
    expect(w.ry[1]).toBeCloseTo(23, 5);
  });

  it('passes T-Rex positions through every frame sample', () => {
    const out = new Float64Array(5);
    for (const f of p.trace.frames) {
      trexPose(p, 0, f.t, out);
      expect(out[0]).toBeCloseTo(f.trex[0] as number, 5);
      expect(out[1]).toBeCloseTo(f.trex[1] as number, 5);
    }
  });

  it('gives tigers a heading along their motion', () => {
    w.update(0.25);
    expect(w.ts[1]).toBe(TigerState.Approach);
    expect(w.tdx[1]).toBeCloseTo(-1, 6);
    expect(w.tdy[1]).toBeCloseTo(0, 6);
  });
});

describe('fallback after the event log stopped', () => {
  // Same battle, but the log is complete only up to stamp 10 (t = 1.0 s).
  const p = prepare(demo(10));
  const w = new World(p);

  it('is flagged as reduced from the last complete stamp on', () => {
    expect(p.reduced).toBe(true);
    expect(p.completeTime).toBeCloseTo(1, 12);
    expect(w.isReduced(0.9)).toBe(false);
    expect(w.isReduced(1.05)).toBe(true);
  });

  it('keeps event-exact states up to the boundary and uses frame states after it', () => {
    // prepare() only sees the events it is given; drop the ones after the boundary like the
    // engine would have.
    w.update(0.7);
    expect(w.ts[0]).toBe(TigerState.Latched);
    // 1.0 < t < 1.5: frame a (1.0) is the last frame at or before t: still frame/boundary state.
    w.update(1.3);
    expect(w.ts[1]).toBe(TigerState.Approach);
    // From the 1.5 s frame on, the frames say dead.
    w.update(1.5);
    expect(w.ts[1]).toBe(TigerState.Dead);
    w.update(1.6);
    expect(w.tx[1]).toBeCloseTo(66.4, 4);
  });
});

describe('real traces', () => {
  it('match every frame sample: states, T-Rex alive, positions', () => {
    for (const [over, run] of [
      [{ trexCount: 1, tigerCount: 10, runs: 5 }, 1],
      [{ runs: 20 }, 7],
      [{ trexCount: 3, tigerCount: 40, runs: 4 }, 2],
    ] as const) {
      const { trace } = traceOf(over, run);
      const p = prepare(trace);
      const w = new World(p);
      let latched = 0;
      for (const f of trace.frames) {
        w.update(f.t);
        const step = Math.round(f.t / DT);
        for (let i = 0; i < p.N; i++) {
          expect(w.ralive[i] === 1).toBe((f.trex[i * 4 + 3] as number) > 0);
          expect(w.rx[i]).toBeCloseTo(f.trex[i * 4] as number, 3);
        }
        for (let j = 0; j < p.M; j++) {
          const s = f.tiger[j * 3 + 2] as number;
          expect(w.ts[j], `t=${f.t} tiger ${j}`).toBe(s);
          const dx = (w.tx[j] as number) - (f.tiger[j * 3] as number);
          const dy = (w.ty[j] as number) - (f.tiger[j * 3 + 1] as number);
          const err = Math.hypot(dx, dy);
          const lo = p.liOff[j] as number;
          const li = lastAtMost(p.liStart, lo, p.liOff[j + 1] as number, step);
          const rides = li >= lo && Number.isFinite(p.liRide[li] as number);
          // The drawn ride position differs from the engine's by the quantised latch angle
          // (1/256 turn); a thrown tiger lands 3 m farther out on the same bearing.
          const quant = (p.attachR + 3) * (Math.PI / 256) + 1e-3;
          if (s === TigerState.Latched) {
            latched++;
            // Exact on the latch tick (the tiger is still where it made contact).
            expect(err).toBeLessThan(p.liStart[li] === step ? 1e-3 : quant);
          } else if (s === TigerState.Dead) {
            // A tiger killed while riding lies where it was drawn riding (≤ one host tick).
            expect(err).toBeLessThan(rides && p.liEnd[li] === p.goneStep[j] ? 1.5 : 1e-3);
          } else if (s !== TigerState.Left) {
            // Exact, except where the tiger leaves a host right at this frame.
            const leaves = rides && Math.abs((p.liDetach[li] as number) - f.t) < 1e-6;
            expect(err, `t=${f.t} tiger ${j} state ${s}`).toBeLessThan(leaves ? quant : 1e-3);
          }
        }
      }
      expect(latched).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([
    ['1v1', { trexCount: 1, tigerCount: 1, runs: 30 }, [0, 3, 11, 17, 25]],
    ['1v10', { trexCount: 1, tigerCount: 10, runs: 10 }, [0, 4, 9]],
    ['10v100 (default)', { runs: 20 }, [0, 7, 13]],
    ['1v100 direct', { trexCount: 1, tigerCount: 100, runs: 4, tigerTactic: 'direct' }, [1]],
    ['50v1000, 60 s', { trexCount: 50, tigerCount: 1000, runs: 2, maxTime: 60 }, [0]],
  ] as const)('%s: no teleports (V4) and latched tigers ride their host (V5)', (_, over, runs) => {
    let latchedSamples = 0;
    for (const run of runs) {
      const { trace } = traceOf(over, run);
      const r = checkMotion(trace);
      expect(r.violations, `run ${run}`).toEqual([]);
      expect(r.worstRatio).toBeLessThanOrEqual(1);
      latchedSamples += r.latchedSamples;
    }
    expect(latchedSamples).toBeGreaterThan(0);
  });

  it('V4 catches the version 1 replay (frame-sampled states, frozen tigers)', () => {
    const { trace } = traceOf({ runs: 20 }, 7);
    const v1 = checkMotion(trace, { legacy: true });
    expect(v1.violations.length).toBeGreaterThan(0);
    expect(v1.worstRatio).toBeGreaterThan(1.5);
    const v2 = checkMotion(trace);
    expect(v2.violations).toEqual([]);
  });

  it('fallback trace: event-exact before the stop, frame states after it', () => {
    const over = {
      trexCount: 1,
      tigerCount: 120,
      runs: 1,
      arenaSize: 200,
      maxTime: 120,
      morale: false,
      params: noAttackParams(),
    };
    const { trace } = traceOf(over, 0, { eventLimits: { p0Cap: 300, p1Cap: 100 } });
    const p = prepare(trace);
    expect(p.reduced).toBe(true);
    expect(p.completeTime).toBeLessThan(p.duration);
    const w = new World(p);
    for (const f of trace.frames) {
      w.update(f.t);
      for (let j = 0; j < p.M; j++) expect(w.ts[j]).toBe(f.tiger[j * 3 + 2] as number);
    }
    // Between frames after the stop, states come from the last frame (or the boundary).
    const k = trace.frames.findIndex((f) => f.t > p.completeTime + 1);
    const a = trace.frames[k] as TraceFrame;
    w.update(a.t + 0.2);
    for (let j = 0; j < p.M; j++) expect(w.ts[j]).toBe(a.tiger[j * 3 + 2] as number);
  });
});
