import { defaultConfig, type ScenarioConfig } from '../src/sim/config';
import {
  DT,
  PackState,
  type BattleTrace,
  type RunSummary,
  type TraceFrame,
} from '../src/sim/engine';
import {
  DeathCause,
  EVENT_NONE,
  EventType,
  byteAngle,
  eventA,
  eventB,
  eventCount,
  eventStep,
  eventPack,
  eventType,
  eventValue,
  isCosmeticEvent,
  packStateAfter,
} from '../src/sim/events';
import type { Triangular } from '../src/sim/params';
import { Rng } from '../src/sim/rng';

export const scenario = (over: Partial<ScenarioConfig>): ScenarioConfig => ({
  ...defaultConfig(),
  ...over,
});

const ZERO: Triangular = { min: 0, mode: 0, max: 0 };

/** Tigers never latch and T-Rex never hit: endless approach / latch-fail / exhaustion churn. */
export function noAttackParams(): ScenarioConfig['params'] {
  const p = defaultConfig().params;
  p['pack.latchChance'] = { ...ZERO };
  p['heavy.biteAccuracy'] = { ...ZERO };
  return p;
}

/** Run `fn` while counting every raw draw from any Rng. */
export function countRng<T>(fn: () => T): { value: T; calls: number } {
  const proto = Rng.prototype;
  const original = proto.nextU32;
  let calls = 0;
  proto.nextU32 = function (this: Rng): number {
    calls++;
    return original.call(this);
  };
  try {
    const value = fn();
    return { value, calls };
  } finally {
    proto.nextU32 = original;
  }
}

const fnv = (h: number, bytes: Uint8Array): number => {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ (bytes[k] as number), 0x01000193);
  return h >>> 0;
};

/** FNV-1a over every frame's time (f64) and raw Float32 payloads. */
export function framesHash(frames: readonly TraceFrame[]): string {
  let h = 0x811c9dc5;
  const t = new Float64Array(1);
  for (const f of frames) {
    t[0] = f.t;
    h = fnv(h, new Uint8Array(t.buffer));
    h = fnv(h, new Uint8Array(f.heavy.buffer, f.heavy.byteOffset, f.heavy.byteLength));
    h = fnv(h, new Uint8Array(f.pack.buffer, f.pack.byteOffset, f.pack.byteLength));
  }
  return h.toString(16).padStart(8, '0');
}

/** Bit-level frame comparison (Object.is per element, so NaN and ±0 count). */
export function framesDiff(a: readonly TraceFrame[], b: readonly TraceFrame[]): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let diff = 0;
  for (let k = 0; k < a.length; k++) {
    const fa = a[k] as TraceFrame;
    const fb = b[k] as TraceFrame;
    if (!Object.is(fa.t, fb.t)) diff++;
    for (const [x, y] of [
      [fa.heavy, fb.heavy],
      [fa.pack, fb.pack],
    ] as const) {
      if (x.length !== y.length) diff++;
      for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) diff++;
    }
  }
  return diff;
}

export interface TraceCheck {
  /** Tiger-state and T-Rex-alive samples compared against frames. */
  samples: number;
  /** Latched-tiger positions compared against the host pose. */
  latchedSamples: number;
  problems: string[];
}

/**
 * C3: rebuild every agent's state from the event log alone and compare it with each frame.
 * Also checks log well-formedness and that the final state agrees with the summary.
 */
export function checkTrace(trace: BattleTrace, summary: RunSummary): TraceCheck {
  const N = trace.heavyCount;
  const M = trace.packCount;
  const ev = trace.events;
  const n = eventCount(ev);
  const until = trace.eventsCompleteUntilStep;
  const finalStep = Math.round(summary.duration / DT);
  const problems: string[] = [];
  const report = (msg: string): void => {
    if (problems.length < 20) problems.push(msg);
  };

  const state = new Uint8Array(M).fill(PackState.Approach);
  const host = new Int32Array(M).fill(-1);
  const latchByte = new Uint8Array(M);
  const latchStep = new Int32Array(M).fill(-1);
  const heavyDeath = new Int32Array(N).fill(-1);
  let killed = 0;
  let prevStep = 0;
  let k = 0;

  const apply = (e: number): void => {
    const s = eventStep(ev, e);
    const type = eventType(ev, e);
    const v = eventValue(ev, e);
    const a = eventA(ev, e);
    const b = eventB(ev, e);
    if (s < prevStep) report(`event ${e}: stamp ${s} after ${prevStep}`);
    prevStep = s;
    if (s < 1 || s > until) report(`event ${e}: stamp ${s} outside [1, ${until}]`);
    if (type < EventType.BiteHit || type > EventType.Resume) report(`event ${e}: type ${type}`);
    const heavyOperand = type === EventType.BiteHit || type === EventType.BiteMiss ? a : b;
    if (type === EventType.HeavyDeath) {
      if (a >= N || b !== EVENT_NONE) report(`event ${e}: TrexDeath operands ${a},${b}`);
      if (heavyDeath[a] !== -1) report(`event ${e}: T-Rex ${a} dies twice`);
      heavyDeath[a] = s;
      return;
    }
    const j = eventPack(type, a, b);
    if (j < 0 || j >= M) report(`event ${e}: tiger ${j}`);
    if (heavyOperand !== EVENT_NONE && heavyOperand >= N)
      report(`event ${e}: T-Rex ${heavyOperand}`);
    if ((state[j] as number) >= PackState.Dead) report(`event ${e}: tiger ${j} already gone`);
    if (type === EventType.PackDeath) {
      killed++;
      // A death directly follows the bite hit or throw that caused it, in the same tick.
      const bite = v === DeathCause.Bite;
      const ok =
        e > 0 &&
        eventStep(ev, e - 1) === s &&
        eventType(ev, e - 1) === (bite ? EventType.BiteHit : EventType.Throw) &&
        (bite ? eventB(ev, e - 1) : eventA(ev, e - 1)) === j &&
        (bite ? eventA(ev, e - 1) : eventB(ev, e - 1)) === b;
      if (!ok) report(`event ${e}: TigerDeath of ${j} without its cause`);
    }
    if (type === EventType.Latch) {
      host[j] = b;
      latchByte[j] = v;
      latchStep[j] = s;
    }
    if (isCosmeticEvent(type)) return;
    const next = packStateAfter(type);
    if (next >= 0) state[j] = next;
    if (next !== PackState.Latched) host[j] = -1;
  };

  let samples = 0;
  let latchedSamples = 0;
  const reach = trace.meta.bodyRadius + trace.meta.packRadius;
  // Latch angles are quantised to 1/256 turn; positions are Float32.
  const L = trace.arenaSize;
  const clamp = (v: number): number => Math.min(L, Math.max(0, v));
  const floatTol = 1e-3 + L * 2.5e-7;
  const latchTol = reach * (Math.PI / 256) * 1.01 + floatTol;
  for (const f of trace.frames) {
    const fs = Math.round(f.t / DT);
    if (fs > until) break;
    while (k < n && eventStep(ev, k) <= fs) apply(k++);
    for (let j = 0; j < M; j++) {
      samples++;
      const want = f.pack[j * 3 + 2] as number;
      if (state[j] !== want) report(`t=${f.t}: tiger ${j} events say ${state[j]}, frame ${want}`);
      if (state[j] === PackState.Latched && (latchStep[j] as number) < fs) {
        latchedSamples++;
        // Pinned at bodyRadius + tigerRadius and the latch angle in the host frame, then
        // clamped to the arena like every non-routed tiger.
        const h = host[j] as number;
        const hx = f.heavy[h * 4] as number;
        const hy = f.heavy[h * 4 + 1] as number;
        const ang = (f.heavy[h * 4 + 2] as number) + byteAngle(latchByte[j] as number);
        const px = hx + Math.cos(ang) * reach;
        const py = hy + Math.sin(ang) * reach;
        const x = f.pack[j * 3] as number;
        const y = f.pack[j * 3 + 1] as number;
        const clamped = px < 0 || py < 0 || px > L || py > L;
        const err = Math.hypot(clamp(px) - x, clamp(py) - y);
        const off = clamped ? 0 : Math.abs(Math.hypot(x - hx, y - hy) - reach);
        if (err > latchTol || off > floatTol)
          report(`t=${f.t}: latched tiger ${j} is off its host ${h} by ${err} m`);
      }
    }
    for (let i = 0; i < N; i++) {
      samples++;
      const alive = heavyDeath[i] === -1;
      if (alive !== (f.heavy[i * 4 + 3] as number) > 0)
        report(`t=${f.t}: T-Rex ${i} events say alive=${alive}, frame hp ${f.heavy[i * 4 + 3]}`);
    }
  }
  while (k < n) apply(k++);

  if (until === finalStep) {
    let routed = 0;
    let active = 0;
    for (let j = 0; j < M; j++) {
      const s = state[j] as number;
      if (s === PackState.Routed || s === PackState.Left) routed++;
      else if (s < PackState.Routed) active++;
    }
    let heavyAlive = 0;
    for (let i = 0; i < N; i++) if (heavyDeath[i] === -1) heavyAlive++;
    const got = { killed, routed, active, heavyAlive };
    const want = {
      killed: summary.packKilled,
      routed: summary.packRouted,
      active: summary.packActive,
      heavyAlive: summary.heavyAlive,
    };
    if (JSON.stringify(got) !== JSON.stringify(want))
      report(`final state ${JSON.stringify(got)} != summary ${JSON.stringify(want)}`);
  }
  return { samples, latchedSamples, problems };
}
