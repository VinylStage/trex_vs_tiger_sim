import { describe, expect, it } from 'vitest';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FREE_FRAME_STRIDE,
  FREE_TRACE_VERSION,
  FreeState,
  simulateFreeBattle,
  type FreeTrace,
} from '../src/sim/free/engine';
import type { FreeSpeciesId } from '../src/sim/free/species';
import { designRow } from '../src/sim/sampling';
import {
  DECISIVE_CHANCE,
  ENCIRCLE_GAP_M,
  ENCIRCLE_MIN_ATTACKERS,
  MORALE_BREAK_JUMP,
  decisiveMoment,
  deriveFreeEvents,
  type FreeBattleEvent,
  type FreeClusterEvent,
} from '../src/ui/replay/free-events';
import { CLUSTER_GAP_S, CLUSTER_MAX_S } from '../src/ui/replay/timeline';

/*
 * Battle events derived from free-trace frames (#176, RENEWAL-1.0 §10.8): first contact,
 * incapacitation and rout clusters under the classic rule, encirclement, morale break, still
 * standing and the decisive moment, on fixed traces built here and on engine traces.
 */

const { Approach, Latched, Routed, Dead, Left } = FreeState;

interface AgentAt {
  x?: number;
  y?: number;
  hp?: number;
  st?: number;
}

/** A trace with frames every 0.5 s up to `until`, agent `i` at time `t` given by `at`. */
function makeTrace(
  counts: [number, number],
  until: number,
  at: (i: number, t: number) => AgentAt,
  radius: [number, number] = [0.5, 0.5],
  step = 0.5,
): FreeTrace {
  const n = counts[0] + counts[1];
  const frames: FreeTrace['frames'] = [];
  for (let k = 0; k * step <= until + 1e-9; k++) {
    const t = k * step;
    const agents = new Float32Array(n * FREE_FRAME_STRIDE);
    for (let i = 0; i < n; i++) {
      const a = at(i, t);
      const o = i * FREE_FRAME_STRIDE;
      const st = a.st ?? Approach;
      // Spread out by default so nobody is encircled unless a test places them.
      agents[o] = a.x ?? i * 20;
      agents[o + 1] = a.y ?? 0;
      agents[o + 3] = st === Dead ? 0 : (a.hp ?? 1);
      agents[o + 4] = st;
    }
    frames.push({ t, agents, buffed: new Uint8Array(n) });
  }
  return {
    version: FREE_TRACE_VERSION,
    arenaSize: 1000,
    counts,
    frames,
    meta: { dt: 0.1, radius, mass: new Float32Array(n).fill(100) },
  };
}

/** State that switches to `to` at time `from` (inclusive). */
const after = (t: number, from: number, to: number): number => (t >= from - 1e-9 ? to : Approach);

const clusters = (events: readonly FreeBattleEvent[], kind: FreeClusterEvent['kind']) =>
  events.filter((e): e is FreeClusterEvent => e.kind === kind);

describe('free events: empty and edge traces', () => {
  it('an empty trace has no events', () => {
    const tr = makeTrace([1, 1], 0, () => ({}));
    tr.frames = [];
    expect(deriveFreeEvents(tr)).toEqual({
      duration: 0,
      firstContact: null,
      lastIncapacitation: null,
      events: [],
      stillStanding: [[], []],
    });
  });

  it('a single frame gives the still standing and nothing else', () => {
    const ev = deriveFreeEvents(makeTrace([2, 1], 0, (i) => ({ st: i === 1 ? Routed : Approach })));
    expect(ev.events).toEqual([]);
    expect(ev.firstContact).toBeNull();
    expect(ev.stillStanding).toEqual([[0], [2]]);
    expect(ev.duration).toBe(0);
  });

  it('a battle without contact has no contact event', () => {
    const ev = deriveFreeEvents(makeTrace([1, 1], 5, () => ({})));
    expect(ev.firstContact).toBeNull();
    expect(ev.events).toEqual([]);
    expect(ev.duration).toBe(5);
  });
});

describe('free events: first contact', () => {
  it('is the first frame with a latched animal', () => {
    const ev = deriveFreeEvents(
      makeTrace([1, 1], 5, (i, t) => ({ st: i === 1 ? after(t, 2.5, Latched) : Approach })),
    );
    expect(ev.firstContact).toBe(2.5);
    expect(ev.events[0]).toEqual({ kind: 'contact', t: 2.5 });
  });

  it('is the first frame with lost HP when nobody latches (strikers)', () => {
    const ev = deriveFreeEvents(
      makeTrace([1, 1], 5, (i, t) => ({ hp: i === 0 && t >= 1.5 ? 0.8 : 1 })),
    );
    expect(ev.firstContact).toBe(1.5);
  });

  it('compares HP with the first frame, not with 1', () => {
    const ev = deriveFreeEvents(makeTrace([1, 1], 3, () => ({ hp: 0.9 })));
    expect(ev.firstContact).toBeNull();
  });
});

describe('free events: incapacitation and rout clusters', () => {
  it('uses the classic gap and cap', () => {
    expect([CLUSTER_GAP_S, CLUSTER_MAX_S]).toEqual([2, 5]);
  });

  it('continues while the next is within 2 s (inclusive) and cuts 5 s after the first', () => {
    // Side B incapacitations at 0.5, 2.5, 4.5 (gaps of exactly 2 s), 5.5 (span 5 s: still in),
    // 6.5 (span 6 s: cut), then 9 (gap 2.5 s: new cluster).
    const times = [0.5, 2.5, 4.5, 5.5, 6.5, 9];
    const tr = makeTrace([1, 6], 10, (i, t) =>
      i === 0 ? {} : { st: after(t, times[i - 1] as number, Dead) },
    );
    const c = clusters(deriveFreeEvents(tr).events, 'incapacitated');
    expect(c.map((e) => [e.side, e.t, e.end, e.count])).toEqual([
      [1, 0.5, 5.5, 4],
      [1, 6.5, 6.5, 1],
      [1, 9, 9, 1],
    ]);
    expect(c[0]?.agents).toEqual([1, 2, 3, 4]);
  });

  it('counts simultaneous transitions in one cluster, per side and kind', () => {
    const tr = makeTrace([2, 2], 3, (i, t) => ({ st: after(t, 1, i % 2 === 0 ? Dead : Routed) }));
    const ev = deriveFreeEvents(tr);
    expect(clusters(ev.events, 'incapacitated').map((e) => [e.side, e.agents])).toEqual([
      [0, [0]],
      [1, [2]],
    ]);
    expect(clusters(ev.events, 'fled').map((e) => [e.side, e.agents])).toEqual([
      [0, [1]],
      [1, [3]],
    ]);
    expect(ev.lastIncapacitation).toBe(1);
  });

  it('counts leaving the arena as fled once, and a fled animal later incapacitated twice', () => {
    const st = (i: number, t: number): number => {
      if (i === 1) return t >= 4 ? Left : t >= 1 ? Routed : Approach; // routs, then leaves
      if (i === 2) return t >= 1.5 ? Left : Approach; // leaves straight away
      if (i === 3) return t >= 8 ? Dead : t >= 1 ? Routed : Approach; // flees, later down
      return Approach;
    };
    const ev = deriveFreeEvents(makeTrace([1, 3], 9, (i, t) => ({ st: st(i, t) })));
    const fled = clusters(ev.events, 'fled');
    expect(fled.map((e) => [e.t, e.agents])).toEqual([[1, [1, 3, 2]]]);
    expect(clusters(ev.events, 'incapacitated').map((e) => [e.t, e.agents])).toEqual([[8, [3]]]);
    expect(ev.stillStanding).toEqual([[0], []]);
  });

  it('dates a transition by the first frame that shows it', () => {
    const tr = makeTrace([1, 1], 4, (i, t) => ({ st: i === 1 ? after(t, 2.2, Dead) : Approach }));
    expect(clusters(deriveFreeEvents(tr).events, 'incapacitated')[0]?.t).toBe(2.5);
  });
});

describe('free events: morale break', () => {
  it('fires when the fled share rises by at least x within 2 s, once per rise', () => {
    expect(MORALE_BREAK_JUMP).toBe(0.25);
    // Side B of 8: one flees at 1 s and one at 4 s (+1/8 within any 2 s, no break), two at 5 s
    // (against the 3 s frame: 1/8 → 4/8) and two more at 5.5 s while the rise lasts: one event.
    const flee: Record<number, number> = { 1: 1, 2: 4, 3: 5, 4: 5, 5: 5.5, 6: 5.5 };
    const tr = makeTrace([1, 8], 12, (i, t) => ({
      st: flee[i] !== undefined ? after(t, flee[i], Routed) : Approach,
    }));
    const mb = deriveFreeEvents(tr).events.filter((e) => e.kind === 'moraleBreak');
    expect(mb).toEqual([{ kind: 'moraleBreak', side: 1, t: 5, from: 0.125, to: 0.5 }]);
  });

  it('does not fire for a slow trickle', () => {
    // One of 8 every 2.5 s: never two in a 2 s window.
    const tr = makeTrace([1, 8], 25, (i, t) => ({
      st: i > 0 ? after(t, i * 2.5, Routed) : Approach,
    }));
    expect(deriveFreeEvents(tr).events.some((e) => e.kind === 'moraleBreak')).toBe(false);
  });

  it('fires again after the condition lapsed', () => {
    // Side A of 4: one at 1 s (+0.25: break), one at 10 s (+0.25: break again).
    const at = [1, 10, 99, 99];
    const tr = makeTrace([4, 1], 12, (i, t) => ({
      st: i < 4 ? after(t, at[i] as number, Routed) : Approach,
    }));
    const mb = deriveFreeEvents(tr).events.filter((e) => e.kind === 'moraleBreak');
    expect(mb.map((e) => [e.side, e.t])).toEqual([
      [0, 1],
      [0, 10],
    ]);
  });

  it('keeps counting an animal that fled and was later incapacitated', () => {
    // Side B of 4: two flee at 1 s (break), both incapacitated at 2 s: no new rise, no drop.
    const tr = makeTrace([1, 4], 4, (i, t) => ({
      st: i === 1 || i === 2 ? (t >= 2 ? Dead : after(t, 1, Routed)) : Approach,
    }));
    const mb = deriveFreeEvents(tr).events.filter((e) => e.kind === 'moraleBreak');
    expect(mb).toEqual([{ kind: 'moraleBreak', side: 1, t: 1, from: 0, to: 0.5 }]);
  });

  it('compares with the previous frame when frames are further apart than the window', () => {
    const tr = makeTrace(
      [1, 4],
      12,
      (i, t) => ({ st: i === 1 || i === 2 ? after(t, 4, Routed) : Approach }),
      [0.5, 0.5],
      4,
    );
    const mb = deriveFreeEvents(tr).events.filter((e) => e.kind === 'moraleBreak');
    expect(mb.map((e) => e.t)).toEqual([4]);
  });
});

describe('free events: encirclement', () => {
  // r = 0.5 + 0.5 + ENCIRCLE_GAP_M between centres.
  const r = 1 + ENCIRCLE_GAP_M;
  const ring = (k: number, dist: number) => (j: number) => ({
    x: 500 + dist * Math.cos((j / k) * 2 * Math.PI),
    y: 500 + dist * Math.sin((j / k) * 2 * Math.PI),
  });

  it('needs k active enemies within r of one active target', () => {
    expect(ENCIRCLE_MIN_ATTACKERS).toBe(3);
    const k = ENCIRCLE_MIN_ATTACKERS;
    // From 2 s, side A's k animals stand at 0.95 r around B's animal (index k); before, far off.
    const tr = makeTrace([k, 1], 6, (i, t) => {
      if (i === k) return { x: 500, y: 500 };
      return t >= 2 && t < 4 ? ring(k, 0.95 * r)(i) : { x: i * 20, y: 0 };
    });
    const enc = deriveFreeEvents(tr).events.filter((e) => e.kind === 'encircle');
    expect(enc).toEqual([{ kind: 'encircle', side: 1, t: 2, end: 4, target: k, attackers: k }]);
  });

  it('ignores enemies just outside r, too few enemies, and fled enemies', () => {
    const k = ENCIRCLE_MIN_ATTACKERS;
    const outside = makeTrace([k, 1], 2, (i) =>
      i === k ? { x: 500, y: 500 } : ring(k, 1.05 * r)(i),
    );
    const few = makeTrace([k - 1, 1], 2, (i) =>
      i === k - 1 ? { x: 500, y: 500 } : ring(k - 1, 0.5 * r)(i),
    );
    const fled = makeTrace([k, 1], 2, (i) =>
      i === k ? { x: 500, y: 500 } : { ...ring(k, 0.5 * r)(i), st: i === 0 ? Routed : Approach },
    );
    for (const tr of [outside, few, fled])
      expect(deriveFreeEvents(tr).events.some((e) => e.kind === 'encircle')).toBe(false);
  });

  it('scales r with the body radii and runs to the end when it never lapses', () => {
    const k = ENCIRCLE_MIN_ATTACKERS;
    // An elephant-sized target (radius 2.5) and wolf-sized attackers (0.4) at 3.5 m.
    const tr = makeTrace(
      [1, k],
      3,
      (i) => (i === 0 ? { x: 500, y: 500 } : ring(k, 3.5)(i - 1)),
      [2.5, 0.4],
    );
    const enc = deriveFreeEvents(tr).events.filter((e) => e.kind === 'encircle');
    expect(enc).toEqual([{ kind: 'encircle', side: 0, t: 0, end: 3, target: 0, attackers: k }]);
  });

  it('names the target with the most attackers, lowest index on ties', () => {
    // A's 4 animals in a ring of 1.2 m around (500, 500); r = 2. B0 at 501 has 3 within r,
    // B1 at 500.5 and B2 at 500 have all 4.
    const tr = makeTrace([4, 3], 1, (i) => {
      if (i >= 4) return { x: 501 - (i - 4) * 0.5, y: 500 };
      return ring(4, 1.2)(i);
    });
    const enc = deriveFreeEvents(tr).events.find((e) => e.kind === 'encircle' && e.side === 1);
    expect(enc).toMatchObject({ side: 1, target: 5, attackers: 4 });
  });
});

describe('free events: ordering', () => {
  it('sorts by time, then kind, then side', () => {
    const tr = makeTrace([4, 4], 3, (i, t) => ({
      st: after(
        t,
        1,
        i === 0 || i === 4 ? Dead : i === 1 || i === 5 ? Routed : i === 6 ? Latched : Approach,
      ),
    }));
    const ev = deriveFreeEvents(tr).events;
    expect(ev.map((e) => [e.t, e.kind, e.kind === 'contact' ? null : e.side])).toEqual([
      [1, 'contact', null],
      [1, 'incapacitated', 0],
      [1, 'incapacitated', 1],
      [1, 'fled', 0],
      [1, 'fled', 1],
      [1, 'moraleBreak', 0],
      [1, 'moraleBreak', 1],
    ]);
  });
});

describe('decisive moment', () => {
  const tl = (...pts: [number, number][]) => pts.map(([t, chance]) => ({ t, chance }));

  it('is the last 50 % crossing, interpolated', () => {
    expect(DECISIVE_CHANCE).toBe(0.5);
    expect(decisiveMoment(tl([0, 0.6], [10, 0.4], [20, 0.3], [30, 0.7], [40, 0.9]))).toBeCloseTo(
      25,
    );
    expect(decisiveMoment(tl([0, 0.2], [4, 0.6]))).toBeCloseTo(3);
  });

  it('crosses through points at exactly 50 %, but a touch and turn back is no crossing', () => {
    expect(decisiveMoment(tl([0, 0.4], [10, 0.5], [20, 0.6]))).toBeCloseTo(10);
    expect(decisiveMoment(tl([0, 0.4], [10, 0.5], [20, 0.3]))).toBeNull();
  });

  it('falls back to the last incapacitation, then null', () => {
    expect(decisiveMoment(tl([0, 0.8], [10, 0.9]), { lastIncapacitation: 42 })).toBe(42);
    expect(decisiveMoment([], { lastIncapacitation: 7 })).toBe(7);
    expect(decisiveMoment([], { lastIncapacitation: null })).toBeNull();
    expect(decisiveMoment([])).toBeNull();
  });

  it('takes points in time order and ignores non-finite ones', () => {
    expect(decisiveMoment(tl([10, 0.4], [0, 0.6], [5, Number.NaN], [Number.NaN, 0.1]))).toBeCloseTo(
      5,
    );
  });
});

describe('free events on engine traces', () => {
  function battle(a: FreeSpeciesId, na: number, b: FreeSpeciesId, nb: number, run: number) {
    const config = sanitizeFreeConfig({
      runs: 4,
      seed: 176,
      sides: [
        { species: a, count: na },
        { species: b, count: nb },
      ],
    });
    const out = simulateFreeBattle(config, designRow(buildFreeDesign(config), run), run, true);
    if (!out.trace) throw new Error('no trace');
    return { trace: out.trace, summary: out.summary };
  }

  const cases: [FreeSpeciesId, number, FreeSpeciesId, number][] = [
    ['wolf', 8, 'brownBear', 1],
    ['lion', 5, 'tiger', 3],
    ['tiger', 1, 'tiger', 1],
  ];

  for (const [a, na, b, nb] of cases) {
    it(`${String(na)} ${a} vs ${String(nb)} ${b}: deterministic and consistent with the summary`, () => {
      const one = battle(a, na, b, nb, 1);
      const ev = deriveFreeEvents(one.trace);
      expect(deriveFreeEvents(battle(a, na, b, nb, 1).trace)).toEqual(ev);
      const s = one.summary;
      expect(ev.stillStanding[0]).toHaveLength(s.aActive);
      expect(ev.stillStanding[1]).toHaveLength(s.bActive);
      const down = clusters(ev.events, 'incapacitated');
      const sum = (side: 0 | 1) =>
        down.filter((e) => e.side === side).reduce((acc, e) => acc + e.count, 0);
      expect(sum(0)).toBe(na - s.aAlive);
      expect(sum(1)).toBe(nb - s.bAlive);
      expect(ev.duration).toBeCloseTo(s.duration, 5);
      expect(ev.firstContact).not.toBeNull();
      for (let k = 1; k < ev.events.length; k++)
        expect((ev.events[k] as FreeBattleEvent).t).toBeGreaterThanOrEqual(
          (ev.events[k - 1] as FreeBattleEvent).t,
        );
      // Nothing is lost or fled before the sides met.
      for (const e of ev.events) expect(e.t).toBeGreaterThanOrEqual(ev.firstContact ?? Infinity);
    });
  }

  it('finds the pack encircling the lone animal', () => {
    const ev = deriveFreeEvents(battle('wolf', 8, 'brownBear', 1, 1).trace);
    expect(ev.events.some((e) => e.kind === 'encircle' && e.side === 1)).toBe(true);
  });
});
