import type { ScenarioConfig } from '../src/sim/config';
import {
  DT,
  TRACE_VERSION,
  TigerState,
  simulateBattle,
  type BattleTrace,
  type TraceFrame,
  type TraceOptions,
} from '../src/sim/engine';
import { EventType, tigerStateAfter, eventTiger } from '../src/sim/events';
import { buildDesign, designRow } from '../src/sim/sampling';
import { frameIndex, lastAtMost } from '../src/ui/replay/interp';
import { NO_STEP, prepare, type Prepared } from '../src/ui/replay/prepare';
import { World } from '../src/ui/replay/world';
import { scenario } from './trace-helpers';

/** Traced run `run` of a scenario. */
export function traceOf(
  over: Partial<ScenarioConfig>,
  run: number,
  options: TraceOptions = {},
): { trace: BattleTrace; config: ScenarioConfig } {
  const config = scenario(over);
  const row = designRow(buildDesign(config), run);
  const out = simulateBattle(config, row, run, true, options);
  if (!out.trace) throw new Error('no trace');
  return { trace: out.trace, config };
}

export interface SynthAgent {
  /** Position at time t (m). */
  pos: (t: number) => [number, number];
  heading?: (t: number) => number;
  hp?: (t: number) => number;
}

/**
 * Hand-built trace for unit tests: frames every `every` s up to `duration`, events given as
 * [stamp, type, v, a, b]. Tiger states in the frames are derived from the events, as the engine's
 * frames would hold them.
 */
export function synthTrace(opts: {
  L?: number;
  duration: number;
  every?: number;
  trex: SynthAgent[];
  tigers: SynthAgent[];
  events: [number, number, number, number, number][];
  complete?: number | undefined;
  bodyRadius?: number;
}): BattleTrace {
  const L = opts.L ?? 100;
  const every = opts.every ?? 0.5;
  const N = opts.trex.length;
  const M = opts.tigers.length;
  const steps = Math.round(opts.duration / DT);
  // A stopped log holds no event after its last complete stamp; the frames still see them all.
  const logged = opts.events.filter(([s]) => s <= (opts.complete ?? steps));
  const events = new Uint16Array(logged.length * 4);
  logged.forEach(([s, type, v, a, b], k) => {
    events.set([s, (type << 8) | v, a, b], k * 4);
  });
  const frames: TraceFrame[] = [];
  const everySteps = Math.round(every / DT);
  for (let s = 0; s <= steps; s += everySteps) {
    const t = s * DT;
    const trex = new Float32Array(N * 4);
    opts.trex.forEach((ag, i) => {
      const [x, y] = ag.pos(t);
      trex.set([x, y, ag.heading?.(t) ?? 0, ag.hp?.(t) ?? 1], i * 4);
    });
    const state = new Uint8Array(M).fill(TigerState.Approach);
    for (const [es, type, , a, b] of opts.events) {
      if (es > s) break;
      const j = eventTiger(type, a, b);
      const next = tigerStateAfter(type);
      if (j >= 0 && next >= 0 && type !== EventType.BiteMiss && type !== EventType.LatchFail)
        state[j] = next;
    }
    const tiger = new Float32Array(M * 3);
    opts.tigers.forEach((ag, j) => {
      const [x, y] = ag.pos(t);
      tiger.set([x, y, state[j] as number], j * 3);
    });
    frames.push({ t, trex, tiger });
  }
  return {
    version: TRACE_VERSION,
    arenaSize: L,
    trexCount: N,
    tigerCount: M,
    frames,
    events,
    eventsCompleteUntilStep: opts.complete ?? steps,
    eventStats: { p0: logged.length, p1: 0, p1Coalesced: 0, p1Dropped: 0, p0Dropped: 0 },
    meta: {
      dt: DT,
      bodyRadius: opts.bodyRadius ?? 2.5,
      tigerRadius: 0.8,
      reach: new Float32Array(N).fill(5.5),
      arc: new Float32Array(N).fill(Math.PI / 4),
    },
  };
}

/** Latch angle of the interval tiger j is in at `step` (NaN if none). */
export function latchAngleAt(p: Prepared, j: number, step: number): number {
  const lo = p.liOff[j] as number;
  const li = lastAtMost(p.liStart, lo, p.liOff[j + 1] as number, step);
  return li >= lo ? (p.liAng[li] as number) : Number.NaN;
}

export interface MotionReport {
  samples: number;
  /** Agent-frame displacement pairs checked, and those exempt (a Throw in between). */
  pairs: number;
  exempt: number;
  violations: string[];
  /** Largest displacement / allowed displacement seen. */
  worstRatio: number;
  latchedSamples: number;
  latchedClamped: number;
  latchedWorstError: number;
}

/**
 * Sample a trace like the player does (`hz` frames per real second at `speed`×) and check:
 * V4 — per-agent screen displacement per frame ≤ max(4 px, 3 × that agent's median), except
 *      across a Throw of that tiger;
 * V5 — every latched tiger sits bodyRadius + tigerRadius from its host's centre (±1 %), unless
 *      its ride position lies outside the arena and was clamped like the engine clamps it.
 */
export function checkMotion(
  trace: BattleTrace,
  { scalePx = 5, speed = 2, hz = 60, legacy = false } = {},
): MotionReport {
  const p = prepare(trace);
  const w = new World(p);
  if (legacy) {
    // Negative control: the version 1 renderer's tiger motion (state from the last frame, linear
    // between frames, frozen until the next frame whenever the state differs).
    const update = w.update.bind(w);
    w.update = (t: number): void => {
      update(t);
      const fr = trace.frames;
      const k = frameIndex(p.frameT, t);
      const a = fr[k] as TraceFrame;
      const b = (fr[k + 1] ?? a) as TraceFrame;
      const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      for (let j = 0; j < p.M; j++) {
        const s = a.tiger[j * 3 + 2] as number;
        const g = b.tiger[j * 3 + 2] === s ? f : 0;
        w.ts[j] = s;
        w.thost[j] = -1;
        w.tx[j] =
          (a.tiger[j * 3] as number) +
          ((b.tiger[j * 3] as number) - (a.tiger[j * 3] as number)) * g;
        w.ty[j] =
          (a.tiger[j * 3 + 1] as number) +
          ((b.tiger[j * 3 + 1] as number) - (a.tiger[j * 3 + 1] as number)) * g;
      }
    };
  }
  const N = p.N;
  const M = p.M;
  const A = N + M;
  const dts = speed / hz;
  const n = Math.max(2, Math.floor(p.duration / dts) + 1);
  const disp = new Float32Array(A * (n - 1)).fill(-1);
  const exemptFlag = new Uint8Array(A * (n - 1));
  const prevX = new Float64Array(A);
  const prevY = new Float64Array(A);
  const prevDrawn = new Uint8Array(A);
  const throwSteps: number[][] = Array.from({ length: M }, () => []);
  for (let j = 0; j < M; j++) {
    for (let l = p.liOff[j] as number; l < (p.liOff[j + 1] as number); l++) {
      if (p.liEndKind[l] === EventType.Throw && p.liEnd[l] !== NO_STEP)
        (throwSteps[j] as number[]).push(p.liEnd[l] as number);
    }
  }
  const report: MotionReport = {
    samples: n,
    pairs: 0,
    exempt: 0,
    violations: [],
    worstRatio: 0,
    latchedSamples: 0,
    latchedClamped: 0,
    latchedWorstError: 0,
  };
  let prevT = 0;
  for (let k = 0; k < n; k++) {
    const t = Math.min(p.duration, k * dts);
    w.update(t);
    for (let a = 0; a < A; a++) {
      const isTrex = a < N;
      const j = a - N;
      const drawn = isTrex || w.ts[j] !== TigerState.Left;
      const x = (isTrex ? (w.rx[a] as number) : (w.tx[j] as number)) * scalePx;
      const y = (isTrex ? (w.ry[a] as number) : (w.ty[j] as number)) * scalePx;
      if (k > 0 && drawn && prevDrawn[a]) {
        const o = a * (n - 1) + (k - 1);
        disp[o] = Math.hypot(x - (prevX[a] as number), y - (prevY[a] as number));
        if (!isTrex) {
          for (const s of throwSteps[j] as number[]) {
            const te = s * p.dt;
            if (te > prevT - 1e-9 && te <= t + 1e-9) exemptFlag[o] = 1;
          }
        }
      }
      prevX[a] = x;
      prevY[a] = y;
      prevDrawn[a] = drawn ? 1 : 0;
    }
    // V5
    const step = Math.floor(t / p.dt + 1e-6);
    for (let j = 0; j < M; j++) {
      if (w.ts[j] !== TigerState.Latched) continue;
      const h = w.thost[j] as number;
      if (h < 0) continue;
      report.latchedSamples++;
      const ang = (w.rh[h] as number) + latchAngleAt(p, j, step);
      const ex = (w.rx[h] as number) + Math.cos(ang) * p.attachR;
      const ey = (w.ry[h] as number) + Math.sin(ang) * p.attachR;
      if (ex < 0 || ey < 0 || ex > p.L || ey > p.L) {
        report.latchedClamped++;
        continue;
      }
      const d = Math.hypot(
        (w.tx[j] as number) - (w.rx[h] as number),
        (w.ty[j] as number) - (w.ry[h] as number),
      );
      const err = Math.abs(d - p.attachR) / p.attachR;
      report.latchedWorstError = Math.max(report.latchedWorstError, err);
      if (err > 0.01 && report.violations.length < 20)
        report.violations.push(`V5 t=${t.toFixed(3)} tiger ${j} host ${h}: d=${d} vs ${p.attachR}`);
    }
    prevT = t;
  }
  // V4
  const buf = new Float32Array(n - 1);
  for (let a = 0; a < A; a++) {
    let m = 0;
    for (let k = 0; k < n - 1; k++) {
      const v = disp[a * (n - 1) + k] as number;
      if (v >= 0) buf[m++] = v;
    }
    if (m === 0) continue;
    const sorted = buf.subarray(0, m).slice().sort();
    const median = sorted[Math.floor((m - 1) / 2)] as number;
    const allowed = Math.max(4, 3 * median);
    for (let k = 0; k < n - 1; k++) {
      const o = a * (n - 1) + k;
      const v = disp[o] as number;
      if (v < 0) continue;
      report.pairs++;
      if (exemptFlag[o]) {
        report.exempt++;
        continue;
      }
      report.worstRatio = Math.max(report.worstRatio, v / allowed);
      if (v > allowed && report.violations.length < 20) {
        const who = a < N ? `T-Rex ${a}` : `tiger ${a - N}`;
        report.violations.push(
          `V4 ${who} at t=${(k * dts).toFixed(3)}→${((k + 1) * dts).toFixed(3)}: ${v.toFixed(2)} px > ${allowed.toFixed(2)} px`,
        );
      }
    }
  }
  return report;
}
