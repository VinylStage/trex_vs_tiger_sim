import { describe, expect, it } from 'vitest';
import { MAX_WORK, defaultConfig, sanitizeConfig } from '../src/sim/config';
import { DT } from '../src/sim/engine';
import {
  FREE_LIMITS,
  FREE_PARAMS,
  FREE_PARAM_INDEX,
  GLOBALS,
  GLOBAL_IDS,
  PACK_BUFF_EFFECTS,
  defaultFreeConfig,
  freeRanges,
  freeWorkEstimate,
  freeWorkWeight,
  FREE_WORK_WEIGHT_BUFF,
  isFreeConfig,
  sanitizeFreeConfig,
  type FreeConfig,
} from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import { FREE_SPECIES, buffRanges, traitRanges } from '../src/sim/free/species';
import {
  BUFF_TRAIT_IDS,
  LATCH_TRAIT_IDS,
  NEUTRAL,
  TRAIT_BOUNDS,
  TRAIT_IDS,
} from '../src/sim/free/traits';
import { PARAMS } from '../src/sim/params';
import { buildDesign, buildDesignFrom, designRow } from '../src/sim/sampling';

/** Free-model config and design (docs/design/FREE-MATCHUPS.md §2, §8 P2). */

const fnv = (a: Float64Array): string => {
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let h = 0x811c9dc5;
  for (let k = 0; k < b.length; k++) h = Math.imul(h ^ (b[k] as number), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('free config defaults', () => {
  it('is a mirror T. rex duel with every switch on and the shared scalar defaults', () => {
    const c = defaultFreeConfig();
    const d = defaultConfig();
    expect(c.mode).toBe('free');
    expect(c.sides.map((s) => [s.species, s.count])).toEqual([
      ['trex', 1],
      ['trex', 1],
    ]);
    expect(c.sides[0].params).toEqual(traitRanges('trex'));
    expect(c.sides[0].buff).toEqual(buffRanges('trex'));
    expect(Object.values(c.packBuff).every(Boolean)).toBe(true);
    expect(Object.keys(c.packBuff)).toEqual([...PACK_BUFF_EFFECTS]);
    expect(Object.keys(c.globals)).toEqual([...GLOBAL_IDS]);
    for (const k of [
      'runs',
      'seed',
      'arenaSize',
      'maxTime',
      'sampling',
      'individualCV',
      'morale',
    ] as const) {
      expect(c[k], k).toBe(d[k]);
    }
  });

  it('is a fixed point of the sanitizer', () => {
    expect(sanitizeFreeConfig(defaultFreeConfig())).toEqual(defaultFreeConfig());
  });

  it('keeps every global preset inside its bounds', () => {
    for (const g of GLOBALS) {
      expect(g.preset.min).toBeLessThanOrEqual(g.preset.mode);
      expect(g.preset.mode).toBeLessThanOrEqual(g.preset.max);
      expect(g.preset.min).toBeGreaterThanOrEqual(g.bounds[0]);
      expect(g.preset.max).toBeLessThanOrEqual(g.bounds[1]);
    }
    expect(GLOBALS.find((g) => g.id === 'latchRatio')?.preset).toEqual({ min: 2, mode: 3, max: 5 });
  });

  it('tells free and legacy configs apart without touching the legacy shape', () => {
    expect(isFreeConfig(defaultFreeConfig())).toBe(true);
    expect(isFreeConfig(defaultConfig())).toBe(false);
    expect('mode' in defaultConfig()).toBe(false);
    expect('mode' in sanitizeConfig({ mode: 'free' })).toBe(false);
  });
});

describe('sanitizeFreeConfig', () => {
  it('returns the defaults for garbage', () => {
    for (const bad of [null, 1, 'x', [], { sides: 'no' }, { sides: [1, 2] }]) {
      expect(sanitizeFreeConfig(bad)).toEqual(defaultFreeConfig());
    }
  });

  it('accepts any species on either side, including mirror matchups', () => {
    const c = sanitizeFreeConfig({
      sides: [
        { species: 'tiger', count: 5 },
        { species: 'lion', count: 5 },
      ],
    });
    expect(c.sides.map((s) => s.species)).toEqual(['tiger', 'lion']);
    const m = sanitizeFreeConfig({ sides: [{ species: 'wolf' }, { species: 'wolf' }] });
    expect(m.sides[0].params).toEqual(m.sides[1].params);
  });

  it('falls back to the default species and drops unknown keys', () => {
    const c = sanitizeFreeConfig({
      sides: [{ species: 'dragon', evil: 1 }, { species: '__proto__' }],
      evil: true,
    });
    expect(c.sides.map((s) => s.species)).toEqual(['trex', 'trex']);
    expect(c).not.toHaveProperty('evil');
    expect(c.sides[0]).not.toHaveProperty('evil');
  });

  it('clamps trait ranges to the shared bounds and sorts them', () => {
    const c = sanitizeFreeConfig({
      sides: [{ species: 'lion', params: { mass: { min: 99999, mode: 1, max: 150 } } }],
    });
    expect(c.sides[0].params.mass).toEqual({
      min: TRAIT_BOUNDS.mass[0],
      mode: 150,
      max: TRAIT_BOUNDS.mass[1],
    });
  });

  it('rejects a partial range whole, as the legacy sanitizer does', () => {
    const c = sanitizeFreeConfig({ sides: [{ species: 'lion', params: { mass: { min: 120 } } }] });
    expect(c.sides[0].params.mass).toEqual(FREE_SPECIES.lion.traits.mass.range);
  });

  it('keeps inactive traits neutral whatever the input says', () => {
    const c = sanitizeFreeConfig({
      sides: [
        {
          species: 'trex',
          params: { latchChance: { min: 0.5, mode: 0.6, max: 0.7 } },
          buff: { cohesionRadius: { min: 10, mode: 20, max: 30 } },
        },
        { species: 'wolf', buff: { cohesionRadius: { min: 10, mode: 20, max: 30 } } },
      ],
    });
    for (const k of LATCH_TRAIT_IDS) {
      const v = NEUTRAL[k];
      expect(c.sides[0].params[k]).toEqual({ min: v, mode: v, max: v });
    }
    for (const k of BUFF_TRAIT_IDS) {
      const v = NEUTRAL[k];
      expect(c.sides[0].buff[k]).toEqual({ min: v, mode: v, max: v });
    }
    expect(c.sides[1].buff.cohesionRadius).toEqual({ min: 10, mode: 20, max: 30 });
  });

  it('clamps counts per side and caps the total by giving way on side B', () => {
    const c = sanitizeFreeConfig({
      sides: [
        { species: 'wolf', count: 9999 },
        { species: 'trex', count: 9999 },
      ],
    });
    expect(c.sides[0].count).toBe(FREE_LIMITS.sideCount[1]);
    expect(c.sides[0].count + c.sides[1].count).toBe(FREE_LIMITS.totalCount);
    const z = sanitizeFreeConfig({ sides: [{ count: 0 }, { count: -3.7 }] });
    expect(z.sides.map((s) => s.count)).toEqual([1, 1]);
    const f = sanitizeFreeConfig({ sides: [{ count: 2.6 }, { count: '7' }] });
    expect(f.sides.map((s) => s.count)).toEqual([3, 1]);
  });

  it('lowers runs to fit the work budget', () => {
    const c = sanitizeFreeConfig({
      runs: 20000,
      maxTime: 3600,
      sides: [{ count: 5000 }, { count: 500 }],
    });
    expect(freeWorkEstimate(c)).toBeLessThanOrEqual(MAX_WORK);
    expect(c.runs).toBe(Math.floor(MAX_WORK / (Math.round(3600 / DT) * 5500)));
  });

  it('reads switches, globals and scalars strictly', () => {
    const c = sanitizeFreeConfig({
      packBuff: { relief: false, focus: 'no', bogus: false },
      globals: { latchRatio: { min: 0, mode: 4, max: 99 }, buffGrace: 'x' },
      morale: false,
      sampling: 'random',
      seed: -1,
    });
    expect(c.packBuff).toEqual({
      coordinate: true,
      focus: true,
      groupLatch: true,
      morale: true,
      relief: false,
    });
    expect(c.globals.latchRatio).toEqual({ min: 1, mode: 4, max: 20 });
    expect(c.globals.buffGrace).toEqual({ min: 0, mode: 2, max: 5 });
    expect(c.morale).toBe(false);
    expect(c.sampling).toBe('random');
    expect(c.seed).toBe(0);
  });
});

describe('free design', () => {
  const lionsVsBuffalo = (): FreeConfig =>
    sanitizeFreeConfig({
      sides: [
        { species: 'lion', count: 6 },
        { species: 'buffalo', count: 1 },
      ],
      runs: 64,
    });

  it('has one column per side trait, side buff trait and global', () => {
    expect(FREE_PARAMS).toHaveLength(
      2 * (TRAIT_IDS.length + BUFF_TRAIT_IDS.length) + GLOBAL_IDS.length,
    );
    expect(FREE_PARAMS.map((p) => p.key).slice(0, 2)).toEqual(['a.mass', 'a.bodyRadius']);
    expect(FREE_PARAM_INDEX['b.mass']).toBe(TRAIT_IDS.length + BUFF_TRAIT_IDS.length);
    expect(FREE_PARAMS.at(-1)?.key).toBe('g.buffGrace');
    expect(new Set(FREE_PARAMS.map((p) => p.key)).size).toBe(FREE_PARAMS.length);
    expect(FREE_PARAMS.filter((p) => p.kind !== 'trait').every((p) => !p.individual)).toBe(true);
  });

  it('keeps the layout independent of the species', () => {
    const a = freeRanges(defaultFreeConfig());
    const b = freeRanges(lionsVsBuffalo());
    expect(a).toHaveLength(b.length);
  });

  it('is deterministic and stays inside every range', () => {
    const c = lionsVsBuffalo();
    const d1 = buildFreeDesign(c);
    const d2 = buildFreeDesign(c);
    expect(fnv(d1.values)).toBe(fnv(d2.values));
    expect(d1.dims).toBe(FREE_PARAMS.length);
    const ranges = freeRanges(c);
    for (let r = 0; r < d1.runs; r++) {
      const row = designRow(d1, r);
      ranges.forEach((t, j) => {
        expect(row[j]).toBeGreaterThanOrEqual(t.min);
        expect(row[j]).toBeLessThanOrEqual(t.max);
      });
    }
    // Fixed (neutral) columns are exactly their value.
    const k = FREE_PARAM_INDEX['b.latchChance'] as number;
    expect(Array.from({ length: d1.runs }, (_, r) => designRow(d1, r)[k])).toEqual(
      new Array(d1.runs).fill(0),
    );
  });

  it('changes with the seed and the sampling method', () => {
    const c = lionsVsBuffalo();
    const base = fnv(buildFreeDesign(c).values);
    expect(fnv(buildFreeDesign({ ...c, seed: c.seed + 1 }).values)).not.toBe(base);
    expect(fnv(buildFreeDesign({ ...c, sampling: 'random' }).values)).not.toBe(base);
  });

  it('leaves the legacy design generator unchanged', () => {
    const c = { ...defaultConfig(), runs: 50 };
    const legacy = buildDesign(c);
    const direct = buildDesignFrom(
      PARAMS.map((p) => c.params[p.id]),
      c.runs,
      c.seed,
      c.sampling,
    );
    expect(fnv(legacy.values)).toBe(fnv(direct.values));
    expect(legacy.dims).toBe(PARAMS.length);
  });
});

describe('work weight of the pack buff (design §7)', () => {
  const OFF = { coordinate: false, focus: false, groupLatch: false, morale: false, relief: false };
  const pair = (a: string, b: string, packBuff?: object) =>
    sanitizeFreeConfig({
      sides: [{ species: a }, { species: b }],
      ...(packBuff ? { packBuff } : {}),
    });

  it('counts an agent-step once without an active pack buff', () => {
    expect(freeWorkWeight(pair('tiger', 'brownBear'))).toBe(1);
    expect(freeWorkWeight(pair('wolf', 'buffalo', OFF))).toBe(1);
  });

  it('weights configs with a social side and any effect on', () => {
    expect(freeWorkWeight(pair('wolf', 'buffalo', { ...OFF, relief: true }))).toBe(
      FREE_WORK_WEIGHT_BUFF,
    );
  });

  it('caps runs by the weighted work', () => {
    const input = {
      runs: 20000,
      maxTime: 3600,
      sides: [
        { species: 'wolf', count: 5000 },
        { species: 'trex', count: 500 },
      ],
    };
    const buffed = sanitizeFreeConfig(input);
    const plain = sanitizeFreeConfig({ ...input, packBuff: OFF });
    const perRun = Math.round(3600 / DT) * 5500 * FREE_WORK_WEIGHT_BUFF;
    expect(buffed.runs).toBe(Math.max(1, Math.floor(MAX_WORK / perRun)));
    expect(buffed.runs).toBeLessThan(plain.runs);
    expect(freeWorkEstimate(buffed)).toBeLessThanOrEqual(MAX_WORK);
  });
});
