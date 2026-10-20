import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/sim/config';
import { HEAVY_SPECIES, PACK_SPECIES } from '../src/sim/species';
import {
  CONSTANTS,
  DT,
  TRACE_VERSION,
  PackState,
  simulateBattle,
  type BattleTrace,
} from '../src/sim/engine';
import {
  EVENT_MAX_INDEX,
  EVENT_MAX_STEP,
  EVENT_NONE,
  EVENT_STRIDE,
  EventLog,
  EventType,
  angleByte,
  byteAngle,
  damageByte,
  eventA,
  eventB,
  eventCount,
  eventStep,
  eventPack,
  eventType,
  eventValue,
  isCosmeticEvent,
  packStateAfter,
  type EventLogLimits,
} from '../src/sim/events';
import { buildDesign, designRow } from '../src/sim/sampling';
import { traceTransferList } from '../src/workers/protocol';
import { checkTrace, framesDiff, noAttackParams, scenario } from './trace-helpers';

const MiB = 1024 * 1024;
const roomy: EventLogLimits = { p0Cap: 1000, p1Cap: 1000, missWindow: 10, failWindow: 20 };

const decode = (events: Uint16Array): number[][] =>
  Array.from({ length: eventCount(events) }, (_, k) => [
    eventStep(events, k),
    eventType(events, k),
    eventValue(events, k),
    eventA(events, k),
    eventB(events, k),
  ]);

describe('event encoding bounds (C4)', () => {
  it('fits every stamp and agent index allowed by LIMITS into u16', () => {
    expect(Math.round(LIMITS.maxTime[1] / DT)).toBeLessThanOrEqual(EVENT_MAX_STEP);
    expect(LIMITS.heavyCount[1] - 1).toBeLessThanOrEqual(EVENT_MAX_INDEX);
    expect(LIMITS.packCount[1] - 1).toBeLessThanOrEqual(EVENT_MAX_INDEX);
    expect(EVENT_MAX_INDEX).toBeLessThan(EVENT_NONE);
  });

  it('fits every type code into the high byte', () => {
    const codes = Object.values(EventType);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(256);
    }
  });

  it('caps the log at 2 MiB of P0 plus 256 KiB of P1', () => {
    expect(CONSTANTS.eventP0Cap * EVENT_STRIDE * 2).toBe(2 * MiB);
    expect(CONSTANTS.eventP1Cap * EVENT_STRIDE * 2).toBe(MiB / 4);
    expect(Math.round(CONSTANTS.biteMissCoalesce / DT)).toBe(10);
    expect(Math.round(CONSTANTS.latchFailCoalesce / DT)).toBe(20);
  });

  it('encodes latch angles in 256 steps per turn', () => {
    expect(angleByte(0)).toBe(0);
    expect(angleByte(Math.PI / 2)).toBe(64);
    expect(angleByte(-Math.PI / 2)).toBe(192);
    expect(angleByte(Math.PI)).toBe(128);
    expect(angleByte(-Math.PI)).toBe(128);
    for (let a = -Math.PI; a <= Math.PI; a += 0.01) {
      const back = byteAngle(angleByte(a));
      const err = Math.abs(Math.atan2(Math.sin(back - a), Math.cos(back - a)));
      expect(err).toBeLessThanOrEqual(Math.PI / 256 + 1e-12);
    }
  });

  it('encodes bite damage as a clamped fraction of max HP', () => {
    expect(damageByte(0, 200)).toBe(0);
    expect(damageByte(100, 200)).toBe(128);
    expect(damageByte(200, 200)).toBe(255);
    expect(damageByte(5000, 200)).toBe(255);
  });
});

describe('event semantics', () => {
  it('classifies only misses and failed latches as cosmetic (P1)', () => {
    const p1 = Object.values(EventType).filter(isCosmeticEvent);
    expect(p1.sort()).toEqual([EventType.BiteMiss, EventType.LatchFail].sort());
  });

  it('maps every event to its tiger and resulting state', () => {
    expect(eventPack(EventType.BiteHit, 3, 7)).toBe(7);
    expect(eventPack(EventType.BiteMiss, 3, 7)).toBe(7);
    expect(eventPack(EventType.Latch, 7, 3)).toBe(7);
    expect(eventPack(EventType.HeavyDeath, 3, EVENT_NONE)).toBe(-1);
    expect(packStateAfter(EventType.BiteHit)).toBe(PackState.Recover);
    expect(packStateAfter(EventType.BiteMiss)).toBe(-1);
    expect(packStateAfter(EventType.Latch)).toBe(PackState.Latched);
    expect(packStateAfter(EventType.LatchFail)).toBe(-1);
    expect(packStateAfter(EventType.Throw)).toBe(PackState.Recover);
    expect(packStateAfter(EventType.Release)).toBe(PackState.Recover);
    expect(packStateAfter(EventType.PackDeath)).toBe(PackState.Dead);
    expect(packStateAfter(EventType.Rout)).toBe(PackState.Routed);
    expect(packStateAfter(EventType.Exit)).toBe(PackState.Left);
    expect(packStateAfter(EventType.HeavyDeath)).toBe(-1);
    expect(packStateAfter(EventType.Exhausted)).toBe(PackState.Recover);
    expect(packStateAfter(EventType.Resume)).toBe(PackState.Approach);
  });
});

describe('EventLog', () => {
  it('stores [stamp, type << 8 | v, a, b] in emission order', () => {
    const log = new EventLog(2, 3, roomy);
    log.beginStep(1);
    log.emit(EventType.BiteHit, 77, 1, 2);
    log.emit(EventType.PackDeath, 0, 2, 1);
    log.beginStep(2);
    log.emit(EventType.HeavyDeath, 0, 0, EVENT_NONE);
    const out = log.finish(2);
    expect(Array.from(out.events)).toEqual([
      1,
      (EventType.BiteHit << 8) | 77,
      1,
      2,
      1,
      EventType.PackDeath << 8,
      2,
      1,
      2,
      EventType.HeavyDeath << 8,
      0,
      EVENT_NONE,
    ]);
    expect(out.completeUntilStep).toBe(2);
    expect(out.stats).toEqual({ p0: 3, p1: 0, p1Coalesced: 0, p1Dropped: 0, p0Dropped: 0 });
    expect(out.events.buffer.byteLength).toBe(3 * EVENT_STRIDE * 2);
  });

  it('grows past its initial capacity', () => {
    const log = new EventLog(1, 1, { ...roomy, p0Cap: 5000 });
    for (let s = 1; s <= 3000; s++) {
      log.beginStep(s);
      log.emit(EventType.Resume, 0, 0, EVENT_NONE);
    }
    const out = log.finish(3000);
    expect(eventCount(out.events)).toBe(3000);
    expect(eventStep(out.events, 2999)).toBe(3000);
  });

  it('coalesces misses per T-Rex and failed latches per tiger', () => {
    const log = new EventLog(2, 2, roomy);
    for (let s = 1; s <= 40; s++) {
      log.beginStep(s);
      log.emit(EventType.BiteMiss, 0, 0, 1);
      log.emit(EventType.BiteMiss, 0, 1, 1);
      log.emit(EventType.LatchFail, 0, 1, 0);
    }
    const out = log.finish(40);
    const rows = decode(out.events);
    const steps = (type: number, a: number): number[] =>
      rows.filter((r) => r[1] === type && r[3] === a).map((r) => r[0] as number);
    expect(steps(EventType.BiteMiss, 0)).toEqual([1, 11, 21, 31]);
    expect(steps(EventType.BiteMiss, 1)).toEqual([1, 11, 21, 31]);
    expect(steps(EventType.LatchFail, 1)).toEqual([1, 21]);
    expect(out.stats.p1).toBe(10);
    expect(out.stats.p1Coalesced).toBe(120 - 10);
  });

  it('drops P1 events beyond the P1 cap but keeps recording P0', () => {
    const log = new EventLog(1, 10, { ...roomy, p1Cap: 3 });
    log.beginStep(1);
    for (let j = 0; j < 10; j++) log.emit(EventType.LatchFail, 0, j, 0);
    log.emit(EventType.Exhausted, 0, 4, 0);
    const out = log.finish(1);
    expect(out.stats).toEqual({ p0: 1, p1: 3, p1Coalesced: 0, p1Dropped: 7, p0Dropped: 0 });
    expect(out.completeUntilStep).toBe(1);
    expect(eventType(out.events, 3)).toBe(EventType.Exhausted);
  });

  it('stops on a tick boundary when the P0 cap is reached', () => {
    const log = new EventLog(1, 10, { ...roomy, p0Cap: 5 });
    log.beginStep(1);
    log.emit(EventType.Latch, 0, 0, 0);
    log.emit(EventType.Latch, 0, 1, 0);
    log.beginStep(2);
    log.emit(EventType.Throw, 0, 0, 0);
    log.emit(EventType.LatchFail, 0, 2, 0);
    log.emit(EventType.Throw, 0, 1, 0);
    log.beginStep(3);
    log.emit(EventType.Resume, 0, 0, EVENT_NONE);
    log.emit(EventType.LatchFail, 0, 3, 0);
    log.emit(EventType.Resume, 0, 1, EVENT_NONE); // 6th P0: over the cap
    log.emit(EventType.Exit, 0, 2, EVENT_NONE);
    log.beginStep(4);
    log.emit(EventType.Exit, 0, 3, EVENT_NONE);
    log.emit(EventType.LatchFail, 0, 4, 0);
    const out = log.finish(4);
    // Tick 3 is discarded whole: the log holds ticks 1–2 exactly.
    expect(out.completeUntilStep).toBe(2);
    expect(decode(out.events).map((r) => r[0])).toEqual([1, 1, 2, 2, 2]);
    expect(out.stats).toEqual({ p0: 4, p1: 1, p1Coalesced: 0, p1Dropped: 2, p0Dropped: 4 });
  });

  it('stops before a stamp that does not fit in u16', () => {
    const log = new EventLog(1, 1, roomy);
    log.beginStep(EVENT_MAX_STEP);
    log.emit(EventType.Resume, 0, 0, EVENT_NONE);
    log.beginStep(EVENT_MAX_STEP + 1);
    log.emit(EventType.Exhausted, 0, 0, 0);
    const out = log.finish(EVENT_MAX_STEP + 1);
    expect(out.completeUntilStep).toBe(EVENT_MAX_STEP);
    expect(eventCount(out.events)).toBe(1);
    expect(out.stats.p0Dropped).toBe(1);
  });

  it('records nothing when agent indices would not fit', () => {
    const log = new EventLog(1, EVENT_MAX_INDEX + 2, roomy);
    log.beginStep(1);
    log.emit(EventType.Resume, 0, 0, EVENT_NONE);
    const out = log.finish(1);
    expect(out.completeUntilStep).toBe(0);
    expect(eventCount(out.events)).toBe(0);
  });
});

describe('battle trace v2', () => {
  const c = scenario({ heavyCount: 3, packCount: 40, runs: 4 });
  const row = designRow(buildDesign(c), 1);

  it('carries version, events and per-T-Rex geometry', () => {
    const out = simulateBattle(c, row, 1, true);
    const trace = out.trace as BattleTrace;
    expect(trace.version).toBe(TRACE_VERSION);
    expect(trace.version).toBe(2);
    expect(eventCount(trace.events)).toBe(trace.eventStats.p0 + trace.eventStats.p1);
    expect(trace.meta.dt).toBe(DT);
    expect(trace.meta.packRadius).toBe(PACK_SPECIES.tiger.constants.radius);
    const radius = HEAVY_SPECIES.trex.bounds.bodyRadius;
    expect(trace.meta.bodyRadius).toBeGreaterThanOrEqual(radius[0]);
    expect(trace.meta.bodyRadius).toBeLessThanOrEqual(radius[1]);
    expect(trace.meta.reach).toHaveLength(3);
    expect(trace.meta.arc).toHaveLength(3);
    for (const a of trace.meta.arc) expect(a).toBeGreaterThan(0);
    expect(simulateBattle(c, row, 1).trace).toBeUndefined();
  });

  it('transfers every buffer exactly once', () => {
    const trace = simulateBattle(c, row, 1, true).trace as BattleTrace;
    const expected = structuredClone(trace);
    const list = traceTransferList(trace);
    expect(new Set(list).size).toBe(list.length);
    expect(list).toHaveLength(3 + 2 * trace.frames.length);
    expect(list).toContain(trace.events.buffer);
    const moved = structuredClone(trace, { transfer: list });
    expect(trace.events.byteLength).toBe(0);
    expect(trace.meta.reach.byteLength).toBe(0);
    expect(trace.frames[0]?.heavy.byteLength).toBe(0);
    expect(moved).toEqual(expected);
  });
});

describe('event budget (C5)', () => {
  // Scaled-down churn (no latching, no hits): thousands of P0 and P1 events in 300 s.
  const c = scenario({
    heavyCount: 1,
    packCount: 300,
    runs: 1,
    arenaSize: 200,
    maxTime: 300,
    morale: false,
    params: noAttackParams(),
  });
  const row = designRow(buildDesign(c), 0);

  it('keeps every P0 event up to eventsCompleteUntilStep when the caps are hit', () => {
    const full = simulateBattle(c, row, 0, true);
    const capped = simulateBattle(c, row, 0, true, { eventLimits: { p0Cap: 1000, p1Cap: 300 } });
    const ft = full.trace as BattleTrace;
    const ct = capped.trace as BattleTrace;
    const finalStep = Math.round(full.summary.duration / DT);

    // The budget never changes the battle.
    expect(capped.summary).toEqual(full.summary);
    expect(framesDiff(ct.frames, ft.frames)).toBe(0);

    expect(ft.eventStats.p0Dropped).toBe(0);
    expect(ft.eventStats.p0).toBeGreaterThan(1000);
    expect(ft.eventsCompleteUntilStep).toBe(finalStep);

    const until = ct.eventsCompleteUntilStep;
    expect(until).toBeGreaterThan(0);
    expect(until).toBeLessThan(finalStep);
    expect(ct.eventStats.p1).toBe(300);
    expect(ct.eventStats.p0).toBeLessThanOrEqual(1000);
    expect(ct.eventStats.p0 + ct.eventStats.p0Dropped).toBe(ft.eventStats.p0);
    expect(eventCount(ct.events)).toBe(ct.eventStats.p0 + ct.eventStats.p1);

    // P0 events of the capped log are exactly the full log's P0 events through `until`.
    const p0 = (t: BattleTrace, upTo: number): number[][] =>
      decode(t.events).filter((r) => !isCosmeticEvent(r[1] as number) && (r[0] as number) <= upTo);
    expect(decode(ct.events).every((r) => (r[0] as number) <= until)).toBe(true);
    expect(p0(ct, until)).toEqual(p0(ft, until));
    // The next tick's P0 events were not stored.
    expect(p0(ft, until + 1).length).toBeGreaterThan(p0(ct, until).length);

    // Reconstruction stays exact up to the boundary.
    expect(checkTrace(ct, capped.summary).problems).toEqual([]);
  });
});
