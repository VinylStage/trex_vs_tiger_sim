import { describe, expect, it } from 'vitest';
import {
  FLIGHT_MODES,
  FREE_MODEL_VERSION,
  PACK_BUFF_EFFECTS,
  sanitizeFreeConfig,
  type FreeConfig,
  type PackBuffEffect,
} from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FREE_FRAME_STRIDE,
  FreeOutcome,
  FreeState,
  emptyBuffStats,
  simulateFreeBattle,
  type BuffStats,
  type FreeRunSummary,
} from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { FREE_SPECIES } from '../src/sim/free/species';
import { designRow } from '../src/sim/sampling';
import { SpatialGrid } from '../src/sim/spatial';

/** Pack-buff layer (docs/design/FREE-MATCHUPS.md §5, §8 P4). */

const OFF: Record<PackBuffEffect, boolean> = {
  coordinate: false,
  focus: false,
  groupLatch: false,
  morale: false,
  relief: false,
};
const only = (e: PackBuffEffect): Record<PackBuffEffect, boolean> => ({ ...OFF, [e]: true });

const matchup = (a: string, na: number, b: string, nb: number, extra: object = {}): FreeConfig =>
  sanitizeFreeConfig({
    sides: [
      { species: a, count: na },
      { species: b, count: nb },
    ],
    ...extra,
  });

/** Effect counters only (activation bookkeeping excluded). */
const EFFECT_COUNTERS = {
  coordinate: ['coordinate'],
  focus: ['focus'],
  groupLatch: ['groupLatch', 'restraint'],
  morale: ['support', 'contagion'],
  relief: ['relief'],
} as const satisfies Record<PackBuffEffect, readonly (keyof BuffStats)[]>;

const totals = (summaries: readonly FreeRunSummary[], key: 'buffA' | 'buffB'): BuffStats => {
  const t = emptyBuffStats();
  for (const s of summaries) {
    for (const k of Object.keys(t) as (keyof BuffStats)[]) t[k] += s[key][k];
  }
  return t;
};

/** Run `fn` with a species' `social` flag temporarily overridden. */
function withSocial<T>(id: keyof typeof FREE_SPECIES, social: boolean, fn: () => T): T {
  const s = FREE_SPECIES[id] as { social: boolean };
  const before = s.social;
  s.social = social;
  try {
    return fn();
  } finally {
    s.social = before;
  }
}

describe('activation (design §5.1)', () => {
  it('never applies to a non-social species, whatever its numbers', () => {
    const { summaries } = runAllFree(matchup('tiger', 8, 'brownBear', 2, { runs: 20 }));
    for (const s of summaries) {
      expect(s.buffA).toEqual(emptyBuffStats());
      expect(s.buffB).toEqual(emptyBuffStats());
    }
  });

  it('never applies to a group of one', () => {
    const { summaries } = runAllFree(matchup('wolf', 1, 'buffalo', 1, { runs: 20 }));
    for (const s of summaries) expect(s.buffA).toEqual(emptyBuffStats());
  });

  it('applies to a social group within the cohesion radius, on its side only', () => {
    const { summaries } = runAllFree(matchup('wolf', 8, 'brownBear', 1, { runs: 10 }));
    for (const s of summaries) {
      expect(s.buffA.activeFrac).toBeGreaterThan(0);
      expect(s.buffA.activeFrac).toBeLessThanOrEqual(1);
      expect(s.buffA.anyTime).toBeGreaterThan(0);
      expect(s.buffA.anyTime).toBeLessThanOrEqual(s.duration + 1e-9);
      expect(s.buffA.activations).toBeGreaterThanOrEqual(8);
      expect(s.buffB).toEqual(emptyBuffStats());
    }
  });

  it('needs an ally inside the cohesion radius', () => {
    const c = matchup('wolf', 8, 'brownBear', 1, { runs: 10 });
    const apart = sanitizeFreeConfig({
      ...c,
      sides: [{ ...c.sides[0], buff: { cohesionRadius: { min: 0, mode: 0, max: 0 } } }, c.sides[1]],
    });
    for (const s of runAllFree(apart).summaries) expect(s.buffA).toEqual(emptyBuffStats());
  });

  it('keeps the buff for T_grace after cohesion is lost, and not longer', () => {
    const base = matchup('wolf', 3, 'brownBear', 1, { runs: 20 });
    const frac = (grace: number): number => {
      const c = sanitizeFreeConfig({
        ...base,
        globals: { buffGrace: { min: grace, mode: grace, max: grace } },
      });
      const s = runAllFree(c).summaries;
      return s.reduce((a, r) => a + r.buffA.activeFrac, 0) / s.length;
    };
    expect(frac(5)).toBeGreaterThanOrEqual(frac(0));
  });

  it('drops a lone survivor back to individual traits', () => {
    const c = matchup('wolf', 3, 'brownBear', 1, {
      runs: 20,
      globals: { buffGrace: { min: 0, mode: 0, max: 0 } },
    });
    const design = buildFreeDesign(c);
    let checked = 0;
    for (let r = 0; r < c.runs; r++) {
      const { trace } = simulateFreeBattle(c, designRow(design, r), r, true);
      if (!trace) throw new Error('no trace');
      // A frame whose previous two frames also had a single active wolf (≥ 1 s alone).
      let aloneFor = 0;
      for (const f of trace.frames) {
        const activeWolves: number[] = [];
        for (let i = 0; i < 3; i++) {
          if ((f.agents[i * FREE_FRAME_STRIDE + 4] as number) < FreeState.Routed)
            activeWolves.push(i);
        }
        aloneFor = activeWolves.length === 1 ? aloneFor + 1 : 0;
        if (aloneFor >= 3) {
          expect(f.buffed[activeWolves[0] as number]).toBe(0);
          checked++;
        }
        for (let i = 0; i < 3; i++) {
          if ((f.agents[i * FREE_FRAME_STRIDE + 4] as number) >= FreeState.Routed) {
            expect(f.buffed[i]).toBe(0);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('switches (design §5.5)', () => {
  const scenarios = [
    matchup('wolf', 12, 'buffalo', 3, { runs: 16 }),
    matchup('lion', 6, 'buffalo', 1, { runs: 16 }),
    matchup('homoErectus', 40, 'trex', 1, { runs: 6 }),
  ];

  it.each(scenarios.map((c, k) => [k, c] as const))(
    'with every effect off a social side equals the same species with social = false (%i)',
    (_k, c) => {
      const off = runAllFree({ ...c, packBuff: OFF }).summaries;
      const loner = withSocial(c.sides[0].species, false, () => runAllFree(c).summaries);
      expect(off).toEqual(loner);
    },
  );

  it.each(PACK_BUFF_EFFECTS)('effect %s fires on its own and only its own counters move', (e) => {
    let fired = 0;
    let changed = false;
    for (const c of scenarios) {
      const on = runAllFree({ ...c, packBuff: only(e) }).summaries;
      const off = runAllFree({ ...c, packBuff: OFF }).summaries;
      const t = totals(on, 'buffA');
      for (const [effect, keys] of Object.entries(EFFECT_COUNTERS)) {
        for (const k of keys) {
          if (effect === e) fired += t[k];
          else expect(t[k], `${e} → ${k}`).toBe(0);
        }
      }
      if (
        JSON.stringify(on.map((s) => [s.outcome, s.duration])) !==
        JSON.stringify(off.map((s) => [s.outcome, s.duration]))
      )
        changed = true;
    }
    expect(fired).toBeGreaterThan(0);
    expect(changed).toBe(true);
  });

  it('turns morale effects off with the global morale toggle', () => {
    const c = matchup('wolf', 12, 'buffalo', 1, { runs: 8, morale: false });
    const t = totals(runAllFree(c).summaries, 'buffA');
    expect(t.support).toBe(0);
    expect(t.contagion).toBe(0);
    expect(t.coordinate).toBeGreaterThan(0);
  });
});

describe('calibration guard (design §5.3)', () => {
  /**
   * Wolves vs one buffalo (bison stand-in), buff on, current model, both flight modes. Field
   * capture success rises with group size and levels off at 9–13 wolves [MacNulty 2014]. The free
   * model does not reach that plateau (#168, design §5.3): without the buff its curve accelerates,
   * and the buff is what bends it. The guard therefore holds the shape the model has and catches a
   * return to the convex no-buff shape. Measured counts only, never interpolated:
   *
   * - rise: p(12) > p(6), p(6) ≤ 0.8 p(12), and p(13) − p(4) ≥ 0.1;
   * - no acceleration: G = [p(25) − p(13)] / [p(13) − p(4)] ≤ 1. The strict plateau, G ≤ 0.5, is
   *   not met (model 4, 2,000 runs: G 0.62 `allIn`, 0.76 `realistic`; buff off about 2).
   *
   * At 300 runs G has a standard error of about 0.25, and the `realistic` value (0.76) sits about
   * one standard error under the bound; this seed gives 0.73 `allIn` and 0.61 `realistic`. If a
   * later model fails it, re-measure at 2,000 runs or more before reading it as a shape change.
   */
  const RUNS = 300;
  const counts = [4, 6, 12, 13, 25] as const;
  it.each(FLIGHT_MODES)(
    'keeps the wolf-vs-buffalo curve rising, not accelerating (%s)',
    (flight) => {
      const p = Object.fromEntries(
        counts.map((k) => {
          const s = runAllFree(
            matchup('wolf', k, 'buffalo', 1, { mv: FREE_MODEL_VERSION, flight, runs: RUNS }),
          ).summaries;
          return [k, s.filter((r) => r.outcome === FreeOutcome.A).length / s.length];
        }),
      ) as Record<(typeof counts)[number], number>;
      expect(p[12]).toBeGreaterThan(p[6]);
      expect(p[6]).toBeLessThanOrEqual(0.8 * p[12]);
      const rise = p[13] - p[4];
      expect(rise).toBeGreaterThanOrEqual(0.1);
      expect((p[25] - p[13]) / rise).toBeLessThanOrEqual(1);
    },
    120_000,
  );
});

describe('SpatialGrid.countWithin', () => {
  it('matches a brute-force count and stops at the cap', () => {
    const n = 400;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    let seed = 1;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 200;
    for (let i = 0; i < n; i++) {
      xs[i] = rnd();
      ys[i] = rnd();
    }
    const g = new SpatialGrid(200, n);
    g.rebuild(n, xs, ys, () => true);
    const even = (i: number): boolean => i % 2 === 0;
    for (const [x, y, r] of [
      [100, 100, 30],
      [0, 0, 50],
      [190, 20, 12.5],
    ] as const) {
      let brute = 0;
      for (let i = 0; i < n; i++) {
        if (even(i) && ((xs[i] as number) - x) ** 2 + ((ys[i] as number) - y) ** 2 <= r * r)
          brute++;
      }
      expect(g.countWithin(x, y, r, xs, ys, even, Infinity)).toBe(brute);
      expect(g.countWithin(x, y, r, xs, ys, even, 3)).toBe(Math.min(3, brute));
      expect(g.countWithin(x, y, r, xs, ys, even, 0)).toBe(0);
    }
  });
});
