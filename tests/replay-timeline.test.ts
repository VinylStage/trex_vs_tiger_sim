import { describe, expect, it } from 'vitest';
import { TigerState, type TraceFrame } from '../src/sim/engine';
import { EventType } from '../src/sim/events';
import { frameIndex } from '../src/ui/replay/interp';
import { OVERVIEW, buildOverview, overviewCamera } from '../src/ui/replay/overview';
import { prepare } from '../src/ui/replay/prepare';
import {
  CH,
  CHANNELS,
  CLUSTER_GAP_S,
  CLUSTER_MAX_S,
  CONTACT_LEAD_S,
  EVENT_LEAD_S,
  SPEEDS,
  buildTimeline,
  contactSeekTime,
  eventStops,
  extractMarkers,
  keyAction,
  nextStop,
  prevStop,
  sceneCounts,
  stepSpeed,
  type SceneCounts,
} from '../src/ui/replay/timeline';
import { World } from '../src/ui/replay/world';
import { makeViewport } from '../src/ui/replay/draw';
import type { Bucket, PathSink } from '../src/ui/replay/glyphs';
import { synthTrace, traceOf } from './replay-helpers';

const scene = (): SceneCounts => ({
  approach: 0,
  latched: 0,
  recover: 0,
  out: 0,
  dead: 0,
  trexAlive: 0,
});

describe('playback speeds', () => {
  it('offers 0.25× to 16× and steps through them', () => {
    expect([...SPEEDS]).toEqual([0.25, 0.5, 1, 2, 4, 8, 16]);
    expect(stepSpeed(2, 1)).toBe(4);
    expect(stepSpeed(2, -1)).toBe(1);
    expect(stepSpeed(0.25, -1)).toBe(0.25);
    expect(stepSpeed(16, 1)).toBe(16);
    expect(stepSpeed(0.5, -1)).toBe(0.25);
    // Off-table values go to the neighbouring table entry.
    expect(stepSpeed(3, 1)).toBe(4);
    expect(stepSpeed(3, -1)).toBe(2);
  });
});

describe('keyboard map', () => {
  it('maps codes (layout independent) and key fallbacks to actions', () => {
    expect(keyAction('Space', ' ', false)).toEqual({ kind: 'toggle' });
    expect(keyAction('KeyK', 'ㅏ', false)).toEqual({ kind: 'toggle' });
    expect(keyAction('ArrowRight', 'ArrowRight', false)).toEqual({ kind: 'seekBy', seconds: 1 });
    expect(keyAction('ArrowLeft', 'ArrowLeft', true)).toEqual({ kind: 'seekBy', seconds: -5 });
    expect(keyAction('KeyJ', 'j', false)).toEqual({ kind: 'seekBy', seconds: -5 });
    expect(keyAction('KeyL', 'l', false)).toEqual({ kind: 'seekBy', seconds: 5 });
    expect(keyAction('PageUp', 'PageUp', false)).toEqual({ kind: 'seekFrac', frac: 0.1 });
    expect(keyAction('Home', 'Home', false)).toEqual({ kind: 'seekTo', to: 'start' });
    expect(keyAction('End', 'End', false)).toEqual({ kind: 'seekTo', to: 'end' });
    expect(keyAction('BracketLeft', '[', false)).toEqual({ kind: 'speed', dir: -1 });
    expect(keyAction('BracketRight', ']', false)).toEqual({ kind: 'speed', dir: 1 });
    expect(keyAction('Comma', ',', false)).toEqual({ kind: 'event', dir: -1 });
    expect(keyAction('Period', '.', false)).toEqual({ kind: 'event', dir: 1 });
    expect(keyAction('KeyC', 'ㅊ', false)).toEqual({ kind: 'contact' });
    expect(keyAction('KeyF', 'f', false)).toEqual({ kind: 'view' });
    expect(keyAction('', ']', false)).toEqual({ kind: 'speed', dir: 1 });
    expect(keyAction('KeyQ', 'q', false)).toBeNull();
    expect(keyAction('Tab', 'Tab', false)).toBeNull();
  });
});

describe('event stops', () => {
  it('jumps to the next and previous stop, landing exactly on them', () => {
    const stops = Float64Array.of(1, 4, 9);
    expect(nextStop(stops, 0)).toBe(1);
    expect(nextStop(stops, 1)).toBe(4);
    expect(nextStop(stops, 9)).toBeNull();
    expect(prevStop(stops, 9)).toBe(4);
    expect(prevStop(stops, 5)).toBe(4);
    expect(prevStop(stops, 1)).toBeNull();
  });

  it('lands EVENT_LEAD_S before each marker, deduplicated and clamped', () => {
    const s = eventStops(
      [
        { t: 0.5, kind: 'contact', count: 1 },
        { t: 3, kind: 'kills', count: 2 },
        { t: 3.01, kind: 'trexDeath', count: 1 },
        { t: 10, kind: 'routs', count: 1 },
      ],
      20,
    );
    expect([...s]).toEqual([0, 3 - EVENT_LEAD_S, 10 - EVENT_LEAD_S]);
  });
});

describe('real traces', () => {
  const cases = [
    ['10v100', { runs: 20 }, 7],
    ['1v10', { trexCount: 1, tigerCount: 10, runs: 10 }, 4],
    ['50v1000, 60 s', { trexCount: 50, tigerCount: 1000, runs: 2, maxTime: 60 }, 0],
  ] as const;

  it.each(cases)(
    '%s: skip to contact lands within ±0.1 s of first contact − 2 s',
    (_, over, run) => {
      const { trace } = traceOf(over, run);
      const p = prepare(trace);
      expect(p.firstContact).toBeGreaterThan(0);
      const to = contactSeekTime(p);
      expect(to).not.toBeNull();
      expect(Math.abs((to as number) - Math.max(0, p.firstContact - CONTACT_LEAD_S))).toBeLessThan(
        0.1,
      );
      // First contact is the first bite or latch attempt in the log.
      let k = 0;
      while (k < p.evCount && !((p.evType[k] as number) <= EventType.LatchFail)) k++;
      expect(p.firstContact).toBeCloseTo((p.evStep[k] as number) * p.dt, 9);
    },
  );

  it.each(cases)('%s: markers cover every kill, rout and T-Rex death', (_, over, run) => {
    const { trace } = traceOf(over, run);
    const p = prepare(trace);
    const m = extractMarkers(p);
    let kills = 0;
    let routs = 0;
    for (let k = 0; k < p.evCount; k++) {
      if (p.evType[k] === EventType.TigerDeath) kills++;
      if (p.evType[k] === EventType.Rout) routs++;
    }
    const sum = (kind: string): number =>
      m.filter((x) => x.kind === kind).reduce((a, x) => a + x.count, 0);
    expect(sum('kills')).toBe(kills);
    expect(sum('routs')).toBe(routs);
    expect(sum('trexDeath')).toBe([...p.trexDeathTime].filter((x) => Number.isFinite(x)).length);
    expect(m.filter((x) => x.kind === 'contact')).toEqual([
      { t: p.firstContact, kind: 'contact', count: 1 },
    ]);
    for (let i = 1; i < m.length; i++)
      expect(m[i]?.t).toBeGreaterThanOrEqual(m[i - 1]?.t as number);
    // Two kill markers are more than CLUSTER_GAP_S apart.
    const killT = m.filter((x) => x.kind === 'kills').map((x) => x.t);
    for (let i = 1; i < killT.length; i++)
      expect((killT[i] as number) - (killT[i - 1] as number)).toBeGreaterThan(CLUSTER_GAP_S);
  });

  it.each(cases)(
    '%s: timeline counts are event-exact (equal the World at each bin)',
    (_, over, run) => {
      const { trace } = traceOf(over, run);
      const p = prepare(trace);
      const tl = buildTimeline(p, 97);
      const w = new World(p);
      const s = scene();
      for (let b = 0; b < tl.bins; b++) {
        w.update((b / (tl.bins - 1)) * p.duration);
        sceneCounts(w, s);
        const o = b * CHANNELS;
        expect([
          tl.counts[o + CH.approach],
          tl.counts[o + CH.latched],
          tl.counts[o + CH.recover],
          tl.counts[o + CH.out],
          tl.counts[o + CH.dead],
          tl.counts[o + CH.trex],
        ]).toEqual([s.approach, s.latched, s.recover, s.out, s.dead, s.trexAlive]);
      }
      expect(tl.reducedFrom).toBe(Infinity);
    },
  );

  it('after the event log stopped, counts come from the frames', () => {
    const { trace } = traceOf({ runs: 20 }, 7, { eventLimits: { p0Cap: 120, p1Cap: 50 } });
    const p = prepare(trace);
    expect(p.reduced).toBe(true);
    const tl = buildTimeline(p, 64);
    expect(tl.reducedFrom).toBeCloseTo(p.completeTime, 9);
    let checked = 0;
    for (let b = 0; b < tl.bins; b++) {
      const t = (b / (tl.bins - 1)) * p.duration;
      if (t <= p.completeTime + 1e-9) continue;
      const fr = trace.frames[frameIndex(p.frameT, t)] as TraceFrame;
      let dead = 0;
      for (let j = 0; j < p.M; j++) if (fr.tiger[j * 3 + 2] === TigerState.Dead) dead++;
      expect(tl.counts[b * CHANNELS + CH.dead]).toBe(dead);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('splits a long run of kills into markers at most CLUSTER_MAX_S long', () => {
    // 13 tigers die one second apart (1 s … 13 s): markers at 1, 7 and 13 s.
    const trace = synthTrace({
      duration: 15,
      trex: [{ pos: () => [10, 10] }],
      tigers: Array.from({ length: 13 }, (_, j) => ({
        pos: () => [20 + j, 20] as [number, number],
      })),
      events: Array.from(
        { length: 13 },
        (_, j) =>
          [(j + 1) * 10, EventType.TigerDeath, 0, j, 0] as [number, number, number, number, number],
      ),
    });
    const kills = extractMarkers(prepare(trace)).filter((x) => x.kind === 'kills');
    expect(kills.map((x) => [+x.t.toFixed(6), x.count])).toEqual([
      [1, 6],
      [7, 6],
      [13, 1],
    ]);
    expect(CLUSTER_MAX_S).toBe(5);
  });

  it('a battle without contact has no contact stop', () => {
    const trace = synthTrace({
      duration: 3,
      trex: [{ pos: () => [10, 10] }],
      tigers: [{ pos: (t) => [50 + t, 50] }],
      events: [],
    });
    const p = prepare(trace);
    expect(contactSeekTime(p)).toBeNull();
    expect(buildTimeline(p).stops.length).toBe(0);
  });
});

describe('reduced-motion overview', () => {
  it('frames every T-Rex position and stays within its vertex budget', () => {
    const { trace } = traceOf({ trexCount: 50, tigerCount: 1000, runs: 2, maxTime: 60 }, 0);
    const p = prepare(trace);
    const cam = overviewCamera(p);
    for (const fr of trace.frames) {
      for (let i = 0; i < p.N; i++) {
        expect(Math.abs((fr.trex[i * 4] as number) - cam.cx)).toBeLessThanOrEqual(cam.view / 2);
        expect(Math.abs((fr.trex[i * 4 + 1] as number) - cam.cy)).toBeLessThanOrEqual(cam.view / 2);
      }
    }
    const counts = new Map<Bucket, number>();
    const sink = (b: Bucket): PathSink => {
      const add = (): void => void counts.set(b, (counts.get(b) ?? 0) + 1);
      return { moveTo: add, lineTo: add, arc: add, closePath: () => undefined };
    };
    const vp = makeViewport(600, 600, 2, cam.cx, cam.cy, cam.view);
    const points = buildOverview(p, vp, sink);
    expect(points).toBeGreaterThan(1000);
    expect(points).toBeLessThanOrEqual(OVERVIEW.maxPoints);
    // Diamonds are 4 lineTo + 1 moveTo each.
    expect((counts.get('ovLatch') ?? 0) / 5).toBeLessThanOrEqual(OVERVIEW.maxLatches);
    expect(counts.get('ovLatch') ?? 0).toBeGreaterThan(0);
    expect(counts.get('deadCross') ?? 0).toBeGreaterThan(0);
  });
});
