import { describe, expect, it } from 'vitest';
import { defaultFreeConfig, defaultSide, type FreeConfig } from '../src/sim/free/config';
import {
  FREE_SPECIES,
  FREE_SPECIES_IDS,
  buffRanges,
  defineFreeSpecies,
  freeMatchupAdSafe,
  isFreeSpecies,
  traitRanges,
  type FreeSpecies,
  type FreeSpeciesId,
  type FreeSpeciesSheet,
  type TraitPreset,
} from '../src/sim/free/species';
import {
  BUFF_TRAITS,
  BUFF_TRAIT_BOUNDS,
  BUFF_TRAIT_IDS,
  LATCH_TRAIT_IDS,
  NEUTRAL,
  TRAITS,
  TRAIT_BOUNDS,
  TRAIT_IDS,
} from '../src/sim/free/traits';
import {
  EVIDENCE,
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  isHeavySpecies,
  isPackSpecies,
  matchupAdSafe,
  type Evidence,
} from '../src/sim/species';

/** Unified trait presets of the free model (docs/design/FREE-MATCHUPS.md §2, SPECIES.md §11). */

const SOCIAL: readonly FreeSpeciesId[] = ['lion', 'wolf', 'hyena', 'homoErectus', 'raptor'];
const LATCHERS: readonly FreeSpeciesId[] = [
  'tiger',
  'lion',
  'wolf',
  'hyena',
  'homoErectus',
  'raptor',
];
/** Species with no legacy entry, built by `defineFreeSpecies` (docs/SPECIES.md §11.5). */
const FREE_ONLY: readonly FreeSpeciesId[] = [
  'polarBear',
  'hippo',
  'raptor',
  'whiteRhino',
  'spinosaurus',
];
/** `FREE_SPECIES_IDS` as first shipped: ids are append-only (RENEWAL-1.0 §5.3 step 4). */
const SHIPPED_IDS: readonly FreeSpeciesId[] = [
  'trex',
  'elephant',
  'buffalo',
  'brownBear',
  'mammoth',
  'homoErectus',
  'tiger',
  'lion',
  'wolf',
  'hyena',
  'polarBear',
  'hippo',
  'raptor',
  'whiteRhino',
  'spinosaurus',
];

describe('trait lists', () => {
  it('keeps the column order of design §2.2 and §5.3', () => {
    expect(TRAITS.map((t) => t.id)).toEqual([...TRAIT_IDS]);
    expect(BUFF_TRAITS.map((t) => t.id)).toEqual([...BUFF_TRAIT_IDS]);
    expect(TRAIT_IDS).toHaveLength(20);
    expect(BUFF_TRAIT_IDS).toHaveLength(6);
  });

  it('makes pack-buff traits run-level only', () => {
    expect(BUFF_TRAITS.every((t) => !t.individual)).toBe(true);
  });

  it('has valid bounds and neutral values inside them', () => {
    for (const k of TRAIT_IDS) expect(TRAIT_BOUNDS[k][0]).toBeLessThan(TRAIT_BOUNDS[k][1]);
    for (const k of BUFF_TRAIT_IDS) {
      expect(BUFF_TRAIT_BOUNDS[k][0]).toBeLessThan(BUFF_TRAIT_BOUNDS[k][1]);
      expect(NEUTRAL[k]).toBeGreaterThanOrEqual(BUFF_TRAIT_BOUNDS[k][0]);
    }
    for (const k of LATCH_TRAIT_IDS) {
      expect(NEUTRAL[k]).toBeGreaterThanOrEqual(TRAIT_BOUNDS[k][0]);
      expect(NEUTRAL[k]).toBeLessThanOrEqual(TRAIT_BOUNDS[k][1]);
    }
  });
});

describe('free species registry', () => {
  it('lists every legacy species once, then the free-only species', () => {
    const legacy = new Set<string>([...HEAVY_SPECIES_IDS, ...Object.keys(PACK_SPECIES)]);
    for (const id of legacy) expect(FREE_SPECIES_IDS, id).toContain(id);
    expect(FREE_SPECIES_IDS.filter((id) => !legacy.has(id))).toEqual([...FREE_ONLY]);
    expect(new Set(FREE_SPECIES_IDS).size).toBe(FREE_SPECIES_IDS.length);
    for (const id of FREE_SPECIES_IDS) expect(FREE_SPECIES[id].id).toBe(id);
    expect(isFreeSpecies('lion')).toBe(true);
    expect(isFreeSpecies('dragon')).toBe(false);
  });

  it('only appends ids: every shipped id keeps its position', () => {
    expect(FREE_SPECIES_IDS.slice(0, SHIPPED_IDS.length)).toEqual([...SHIPPED_IDS]);
  });

  it.each(FREE_SPECIES_IDS)('%s has every trait, ordered, within bounds', (id) => {
    const s = FREE_SPECIES[id];
    expect(Object.keys(s.traits)).toEqual([...TRAIT_IDS]);
    expect(Object.keys(s.buff)).toEqual([...BUFF_TRAIT_IDS]);
    for (const k of TRAIT_IDS) {
      const { min, mode, max } = s.traits[k].range;
      const [lo, hi] = TRAIT_BOUNDS[k];
      expect(min, `${id}.${k}`).toBeLessThanOrEqual(mode);
      expect(mode, `${id}.${k}`).toBeLessThanOrEqual(max);
      expect(min, `${id}.${k}`).toBeGreaterThanOrEqual(lo);
      expect(max, `${id}.${k}`).toBeLessThanOrEqual(hi);
    }
    for (const k of BUFF_TRAIT_IDS) {
      const { min, mode, max } = s.buff[k].range;
      const [lo, hi] = BUFF_TRAIT_BOUNDS[k];
      expect(min).toBeLessThanOrEqual(mode);
      expect(mode).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(lo);
      expect(max).toBeLessThanOrEqual(hi);
    }
  });

  it.each(FREE_SPECIES_IDS)('%s tags every active trait and only active traits', (id) => {
    const s = FREE_SPECIES[id];
    for (const k of TRAIT_IDS) {
      const inactive = !s.canLatch && (LATCH_TRAIT_IDS as readonly string[]).includes(k);
      const ev = s.traits[k].evidence;
      if (inactive) {
        expect(ev, `${id}.${k}`).toBeNull();
        expect(s.traits[k].range).toEqual({
          min: NEUTRAL[k as keyof typeof NEUTRAL],
          mode: NEUTRAL[k as keyof typeof NEUTRAL],
          max: NEUTRAL[k as keyof typeof NEUTRAL],
        });
      } else {
        expect(EVIDENCE, `${id}.${k}`).toContain(ev);
      }
    }
    for (const k of BUFF_TRAIT_IDS) {
      if (s.social) expect(EVIDENCE).toContain(s.buff[k].evidence);
      else {
        expect(s.buff[k].evidence).toBeNull();
        expect(s.buff[k].range).toEqual({ min: NEUTRAL[k], mode: NEUTRAL[k], max: NEUTRAL[k] });
      }
    }
  });

  it('marks the social group hunters and the latching species (design §2.3, §4.2)', () => {
    expect(FREE_SPECIES_IDS.filter((id) => FREE_SPECIES[id].social)).toEqual(
      FREE_SPECIES_IDS.filter((id) => SOCIAL.includes(id)),
    );
    expect(FREE_SPECIES_IDS.filter((id) => FREE_SPECIES[id].canLatch)).toEqual(
      FREE_SPECIES_IDS.filter((id) => LATCHERS.includes(id)),
    );
  });

  it('gives Homo erectus lower pack-buff values than every carnivore (design §5.3)', () => {
    const he = FREE_SPECIES.homoErectus.buff;
    for (const id of ['lion', 'wolf', 'hyena'] as const) {
      const c = FREE_SPECIES[id].buff;
      expect(he.cohesionRadius.range.mode).toBeLessThan(c.cohesionRadius.range.mode);
      expect(he.groupLatchGain.range.mode).toBeLessThan(c.groupLatchGain.range.mode);
      expect(he.moraleSupport.range.mode).toBeLessThan(c.moraleSupport.range.mode);
    }
  });
});

describe('mapping from the legacy registry', () => {
  it('reads every former heavy trait from HEAVY_SPECIES', () => {
    for (const id of ['trex', 'elephant', 'buffalo', 'brownBear', 'mammoth'] as const) {
      const h = HEAVY_SPECIES[id];
      const t = FREE_SPECIES[id].traits;
      const pairs = [
        ['mass', 'mass'],
        ['bodyRadius', 'bodyRadius'],
        ['turnRate', 'turnRate'],
        ['sprintSpeed', 'speed'],
        ['strikeForce', 'biteForce'],
        ['strikeLethality', 'biteLethality'],
        ['strikeInterval', 'biteInterval'],
        ['strikeReach', 'biteReach'],
        ['strikeArc', 'biteArc'],
        ['strikeAccuracy', 'biteAccuracy'],
        ['shakeRate', 'shakeRate'],
      ] as const;
      for (const [free, legacy] of pairs) {
        expect(t[free].range, `${id}.${free}`).toEqual(h.ranges[legacy]);
        expect(t[free].evidence, `${id}.${free}`).toBe(h.evidence[legacy]);
      }
      expect(FREE_SPECIES[id].constants).toEqual(h.constants);
    }
  });

  it('reads every former pack trait from PACK_SPECIES', () => {
    for (const id of ['tiger', 'lion', 'wolf', 'hyena'] as const) {
      const p = PACK_SPECIES[id];
      const t = FREE_SPECIES[id].traits;
      const pairs = [
        ['mass', 'mass'],
        ['sprintSpeed', 'sprintSpeed'],
        ['cruiseSpeed', 'cruiseSpeed'],
        ['sprintEndurance', 'sprintEndurance'],
        ['recoveryTime', 'recoveryTime'],
        ['latchChance', 'latchChance'],
        ['latchEndurance', 'latchEndurance'],
        ['latchDps', 'dps'],
        ['bleed', 'bleed'],
        ['morale', 'morale'],
        ['moraleLoss', 'moraleLoss'],
      ] as const;
      for (const [free, legacy] of pairs) {
        expect(t[free].range, `${id}.${free}`).toEqual(p.ranges[legacy]);
        expect(t[free].evidence, `${id}.${free}`).toBe(p.evidence[legacy]);
      }
      const r = p.constants.radius;
      expect(t.bodyRadius.range).toEqual({ min: r, mode: r, max: r });
      expect(FREE_SPECIES[id].constants).toEqual({ hide: 1, intimidation: 1 });
    }
  });

  it('merges the two Homo erectus presets as design §2.2 says', () => {
    const t = FREE_SPECIES.homoErectus.traits;
    const h = HEAVY_SPECIES.homoErectus;
    const p = PACK_SPECIES.homoErectus;
    expect(h.ranges.mass).toEqual(p.ranges.mass);
    expect(t.mass.range).toEqual(h.ranges.mass);
    expect(t.bodyRadius.range).toEqual(h.ranges.bodyRadius);
    expect(t.turnRate.range).toEqual(h.ranges.turnRate);
    expect(t.strikeForce.range).toEqual(h.ranges.biteForce);
    expect(t.shakeRate.range).toEqual(h.ranges.shakeRate);
    expect(t.sprintSpeed.range).toEqual(p.ranges.sprintSpeed);
    expect(t.cruiseSpeed.range).toEqual(p.ranges.cruiseSpeed);
    expect(t.latchChance.range).toEqual(p.ranges.latchChance);
    expect(t.latchDps.range).toEqual(p.ranges.dps);
    expect(t.morale.range).toEqual(p.ranges.morale);
    expect(FREE_SPECIES.homoErectus.constants).toEqual(h.constants);
  });

  it('returns fresh range objects', () => {
    const a = traitRanges('trex');
    a.mass.min = -1;
    expect(traitRanges('trex').mass.min).toBe(HEAVY_SPECIES.trex.ranges.mass.min);
    expect(HEAVY_SPECIES.trex.ranges.mass.min).not.toBe(-1);
    const b = buffRanges('wolf');
    b.cohesionRadius.mode = -1;
    expect(buffRanges('wolf').cohesionRadius.mode).toBe(60);
  });
});

describe('era and ad safety (read from the legacy registry)', () => {
  // Only species with a legacy entry: a free-only species sets both on its own sheet
  // (SPECIES.md §11.5).
  const withLegacy = FREE_SPECIES_IDS.filter((id) => isHeavySpecies(id) || isPackSpecies(id));

  it.each(withLegacy)('%s carries the era and adSafe flag of its legacy entries', (id) => {
    const legacy = [
      isHeavySpecies(id) ? HEAVY_SPECIES[id] : null,
      isPackSpecies(id) ? PACK_SPECIES[id] : null,
    ].filter((x) => x !== null);
    for (const l of legacy) expect(FREE_SPECIES[id].era).toEqual(l.era);
    expect(FREE_SPECIES[id].adSafe).toBe(legacy.every((l) => l.adSafe));
  });

  it('keeps the extinct group of the species pickers', () => {
    expect(FREE_SPECIES_IDS.filter((id) => FREE_SPECIES[id].era !== 'extant')).toEqual([
      'trex',
      'mammoth',
      'homoErectus',
      'raptor',
      'spinosaurus',
    ]);
  });
});

/** A registry entry written back as the source sheet a species without a legacy entry uses. */
function sheetOf(id: FreeSpeciesId): FreeSpeciesSheet {
  const s = FREE_SPECIES[id];
  const rowOf = (p: TraitPreset): readonly [number, number, number, Evidence] => [
    p.range.min,
    p.range.mode,
    p.range.max,
    p.evidence ?? 'S',
  ];
  const latch = LATCH_TRAIT_IDS as readonly string[];
  const traits = Object.fromEntries(
    TRAIT_IDS.filter((k) => s.canLatch || !latch.includes(k)).map((k) => [k, rowOf(s.traits[k])]),
  );
  const buff = s.social
    ? Object.fromEntries(BUFF_TRAIT_IDS.map((k) => [k, rowOf(s.buff[k])]))
    : null;
  return {
    era: s.era === 'extant' ? 'extant' : { ...s.era },
    adSafe: s.adSafe,
    social: s.social,
    canLatch: s.canLatch,
    constants: { ...s.constants },
    traits: traits as FreeSpeciesSheet['traits'],
    buff: buff as FreeSpeciesSheet['buff'],
  };
}

describe('polar bear (docs/SPECIES.md §4.11, research/SPECIES.md §5.5)', () => {
  const pb = FREE_SPECIES.polarBear;
  const bb = FREE_SPECIES.brownBear;

  it('is a living, ad-safe, solitary striker with no legacy entry', () => {
    expect(pb.era).toBe('extant');
    expect(pb.adSafe).toBe(true);
    expect([pb.social, pb.canLatch]).toEqual([false, false]);
    expect(isHeavySpecies('polarBear')).toBe(false);
    expect(isPackSpecies('polarBear')).toBe(false);
  });

  it('takes mass and speed from the literature and is heavier than the brown bear', () => {
    expect(pb.traits.mass).toEqual({ range: { min: 250, mode: 450, max: 800 }, evidence: 'L' });
    expect(pb.traits.sprintSpeed).toEqual({ range: { min: 6, mode: 9, max: 11.1 }, evidence: 'L' });
    expect(pb.traits.mass.range.mode).toBeGreaterThan(bb.traits.mass.range.mode);
  });

  it('derives its body radius (and so its glyph) from mass: the brown bear scaled by mass^(1/3)', () => {
    const scaled = (k: 'min' | 'mode' | 'max') =>
      Math.round(
        20 *
          bb.traits.bodyRadius.range[k] *
          Math.cbrt(pb.traits.mass.range[k] / bb.traits.mass.range[k]),
      ) / 20;
    expect(pb.traits.bodyRadius).toEqual({
      range: { min: scaled('min'), mode: scaled('mode'), max: scaled('max') },
      evidence: 'D',
    });
  });

  it('shares the brown bear behaviour rows and constants ("mechanically like the brown bear")', () => {
    for (const k of [
      'sprintEndurance',
      'recoveryTime',
      'strikeLethality',
      'strikeInterval',
      'strikeArc',
      'strikeAccuracy',
      'shakeRate',
      'bleed',
      'morale',
      'moraleLoss',
    ] as const) {
      expect(pb.traits[k], k).toEqual(bb.traits[k]);
    }
    expect(pb.constants).toEqual(bb.constants);
  });
});

describe('hippopotamus (docs/SPECIES.md §4.12, research/SPECIES.md §5.18)', () => {
  const h = FREE_SPECIES.hippo;
  const buffalo = FREE_SPECIES.buffalo;
  const elephant = FREE_SPECIES.elephant;

  it('is a living, ad-safe, solitary striker with no legacy entry and a thick hide', () => {
    expect(h.era).toBe('extant');
    expect(h.adSafe).toBe(true);
    expect([h.social, h.canLatch]).toEqual([false, false]);
    expect(isHeavySpecies('hippo')).toBe(false);
    expect(isPackSpecies('hippo')).toBe(false);
    // Skin about 6 cm thick: latch damage scaled like the elephant's.
    expect(h.constants).toEqual({ hide: 0.3, intimidation: 1 });
    expect(h.constants.hide).toBe(elephant.constants.hide);
  });

  it('takes mass from the literature and sits between the buffalo and the elephant', () => {
    expect(h.traits.mass).toEqual({ range: { min: 1300, mode: 1500, max: 3200 }, evidence: 'L' });
    expect(h.traits.mass.range.mode).toBeGreaterThan(buffalo.traits.mass.range.mode);
    expect(h.traits.mass.range.mode).toBeLessThan(elephant.traits.mass.range.mode);
  });

  it('turns the unverified top speed and bite into S rows around the reported figures', () => {
    // About 8 m/s (30 km/h) is claimed but unmeasured (Hutchinson & Pringle 2024): the S maximum.
    expect(h.traits.sprintSpeed).toEqual({ range: { min: 4, mode: 6, max: 8.3 }, evidence: 'S' });
    // 8.1 kN reported for one female on television, never published: the S mode.
    expect(h.traits.strikeForce).toEqual({ range: { min: 4, mode: 8, max: 15 }, evidence: 'S' });
    // No row keeps a U tag: every unverified value became S with a range (RENEWAL-1.0 §5.2).
    for (const k of TRAIT_IDS) expect(h.traits[k].evidence, k).not.toBe('U');
  });

  it('derives its body radius (and so its glyph) from mass: the buffalo scaled by mass^(1/3)', () => {
    const scaled = (k: 'min' | 'mode' | 'max') =>
      Math.round(
        20 *
          buffalo.traits.bodyRadius.range[k] *
          Math.cbrt(h.traits.mass.range[k] / buffalo.traits.mass.range[k]),
      ) / 20;
    expect(h.traits.bodyRadius).toEqual({
      range: { min: scaled('min'), mode: scaled('mode'), max: scaled('max') },
      evidence: 'D',
    });
  });
});

describe('raptor pack, Utahraptor (docs/SPECIES.md §4.13, research/SPECIES.md §5.15)', () => {
  const r = FREE_SPECIES.raptor;
  const lion = FREE_SPECIES.lion;

  it('is an extinct, ad-safe, social latcher with no legacy entry', () => {
    expect(r.era).toEqual({ fromMa: 139, toMa: 125 });
    expect(r.adSafe).toBe(true);
    expect([r.social, r.canLatch]).toEqual([true, true]);
    expect(isHeavySpecies('raptor')).toBe(false);
    expect(isPackSpecies('raptor')).toBe(false);
    expect(r.constants).toEqual({ hide: 1, intimidation: 1 });
  });

  it('takes mass from the literature and is lighter than the hippo, heavier than the lion', () => {
    expect(r.traits.mass).toEqual({ range: { min: 280, mode: 400, max: 500 }, evidence: 'L' });
    expect(r.traits.mass.range.mode).toBeGreaterThan(lion.traits.mass.range.max);
    expect(r.traits.mass.range.max).toBeLessThan(FREE_SPECIES.hippo.traits.mass.range.min);
    for (const k of TRAIT_IDS) expect(r.traits[k].evidence, k).not.toBe('U');
  });

  it('derives the bite from Deinonychus (Sakamoto 2022) and the latch damage from the bite', () => {
    // 706 N for a 75 kg Deinonychus, scaled by (mass ratio)^(2/3) at min, mode and max.
    const bite = (m: number) => Math.round(20 * 0.706 * (m / 75) ** (2 / 3)) / 20;
    const { min, mode, max } = r.traits.mass.range;
    expect(r.traits.strikeForce).toEqual({
      range: { min: bite(min), mode: bite(mode), max: bite(max) },
      evidence: 'D',
    });
    // The pack dps rule of docs/SPECIES.md §3.2 item 4: 2·F_min, 4.4·F_mode, 8·F_max.
    const f = r.traits.strikeForce.range;
    expect(r.traits.latchDps.range.min).toBeCloseTo(2 * f.min, 6);
    expect(r.traits.latchDps.range.mode).toBeCloseTo(Math.round(10 * 4.4 * f.mode) / 10, 6);
    expect(r.traits.latchDps.range.max).toBeCloseTo(8 * f.max, 6);
    expect(r.traits.latchDps.evidence).toBe('D');
  });

  it('derives its body radius from mass: the lion scaled by mass^(1/3)', () => {
    const scaled = (k: 'min' | 'mode' | 'max') =>
      Math.round(20 * 0.8 * Math.cbrt(r.traits.mass.range[k] / 180)) / 20;
    expect(r.traits.bodyRadius).toEqual({
      range: { min: scaled('min'), mode: scaled('mode'), max: scaled('max') },
      evidence: 'D',
    });
  });

  it('keeps every cooperation effect between none and the lion pride (contested pack hunting)', () => {
    for (const k of ['groupLatchGain', 'focusBonus', 'moraleSupport', 'routShock'] as const) {
      expect(r.buff[k].evidence, k).toBe('S');
      expect(r.buff[k].range.min, k).toBe(0);
      expect(r.buff[k].range.max, k).toBeLessThanOrEqual(lion.buff[k].range.mode);
      expect(r.buff[k].range.mode, k).toBeLessThan(lion.buff[k].range.mode);
    }
    expect(r.buff.cohesionRadius).toEqual(lion.buff.cohesionRadius);
    expect(r.buff.reliefStamina).toEqual(lion.buff.reliefStamina);
  });
});

describe('white rhinoceros (docs/SPECIES.md §4.14, research/SPECIES.md §5.19)', () => {
  const w = FREE_SPECIES.whiteRhino;
  const buffalo = FREE_SPECIES.buffalo;
  const elephant = FREE_SPECIES.elephant;

  it('is a living, ad-safe, solitary striker with no legacy entry and a tough hide', () => {
    expect(w.era).toBe('extant');
    expect(w.adSafe).toBe(true);
    expect([w.social, w.canLatch]).toEqual([false, false]);
    expect(isHeavySpecies('whiteRhino')).toBe(false);
    expect(isPackSpecies('whiteRhino')).toBe(false);
    expect(w.constants).toEqual({ hide: 0.3, intimidation: 1 });
  });

  it('takes mass from the literature: heavier than the hippo on average, lighter than the elephant', () => {
    expect(w.traits.mass).toEqual({ range: { min: 1600, mode: 2000, max: 3600 }, evidence: 'L' });
    expect(w.traits.mass.range.mode).toBeGreaterThan(FREE_SPECIES.hippo.traits.mass.range.mode);
    expect(w.traits.mass.range.mode).toBeLessThan(elephant.traits.mass.range.mode);
  });

  it('turns the unverified top speed into an S row and keeps the horn force S', () => {
    // 40 km/h "for short periods" is claimed but unmeasured (ADW, SDZWA): the S maximum.
    expect(w.traits.sprintSpeed).toEqual({ range: { min: 5, mode: 7, max: 11.1 }, evidence: 'S' });
    // No horn measurement: the maximum is body weight at the mode (2 t × g ≈ 19.6 kN).
    expect(w.traits.strikeForce).toEqual({ range: { min: 6, mode: 12, max: 20 }, evidence: 'S' });
    for (const k of TRAIT_IDS) expect(w.traits[k].evidence, k).not.toBe('U');
  });

  it('derives its body radius (and so its glyph) from mass: the buffalo scaled by mass^(1/3)', () => {
    const scaled = (k: 'min' | 'mode' | 'max') =>
      Math.round(
        20 *
          buffalo.traits.bodyRadius.range[k] *
          Math.cbrt(w.traits.mass.range[k] / buffalo.traits.mass.range[k]),
      ) / 20;
    expect(w.traits.bodyRadius).toEqual({
      range: { min: scaled('min'), mode: scaled('mode'), max: scaled('max') },
      evidence: 'D',
    });
  });
});

describe('Spinosaurus, land duel (docs/SPECIES.md §4.15, research/SPECIES.md §5.8)', () => {
  const s = FREE_SPECIES.spinosaurus;
  const trex = FREE_SPECIES.trex;

  it('is an extinct, ad-safe, solitary striker with no legacy entry', () => {
    expect(s.era).toEqual({ fromMa: 100, toMa: 94 });
    expect(s.adSafe).toBe(true);
    expect([s.social, s.canLatch]).toEqual([false, false]);
    expect(isHeavySpecies('spinosaurus')).toBe(false);
    expect(isPackSpecies('spinosaurus')).toBe(false);
    expect(s.constants).toEqual({ hide: 1, intimidation: 1 });
  });

  it('takes mass and bite from the literature, a little lighter than T. rex with a weaker bite', () => {
    // Sereno et al. 2022 flesh model 7,390 kg at the mode; Dal Sasso et al. 2005 up to 9 t.
    expect(s.traits.mass).toEqual({ range: { min: 6000, mode: 7400, max: 9000 }, evidence: 'L' });
    expect(s.traits.mass.range.mode).toBeLessThan(trex.traits.mass.range.mode);
    // Sakamoto 2022: 4.8 kN anterior and 11.9 kN posterior, the mode at the midpoint.
    expect(s.traits.strikeForce).toEqual({
      range: { min: 4.8, mode: 8.35, max: 11.9 },
      evidence: 'L',
    });
    expect(s.traits.strikeForce.range.max).toBeLessThan(trex.traits.strikeForce.range.mode);
  });

  it('keeps the contested posture and speed as S, slower than T. rex', () => {
    expect(s.traits.sprintSpeed).toEqual({ range: { min: 2, mode: 4, max: 6 }, evidence: 'S' });
    expect(s.traits.sprintSpeed.range.mode).toBeLessThan(trex.traits.sprintSpeed.range.mode);
    for (const k of TRAIT_IDS) expect(s.traits[k].evidence, k).not.toBe('U');
  });

  it('derives its body radius (and so its glyph) from mass: T. rex scaled by mass^(1/3)', () => {
    const scaled = (k: 'min' | 'mode' | 'max') =>
      Math.round(
        20 *
          trex.traits.bodyRadius.range[k] *
          Math.cbrt(s.traits.mass.range[k] / trex.traits.mass.range[k]),
      ) / 20;
    expect(s.traits.bodyRadius).toEqual({
      range: { min: scaled('min'), mode: scaled('mode'), max: scaled('max') },
      evidence: 'D',
    });
  });
});

describe('standalone constructor', () => {
  it.each(FREE_SPECIES_IDS)('rebuilds %s from its own sheet, without the legacy registry', (id) => {
    const built = defineFreeSpecies(id, sheetOf(id));
    expect(built).toEqual(FREE_SPECIES[id]);
    expect(Object.keys(built.traits)).toEqual([...TRAIT_IDS]);
    expect(Object.keys(built.buff)).toEqual([...BUFF_TRAIT_IDS]);
  });

  it('copies the sheet, so editing it later changes nothing', () => {
    // Homo erectus has every kind of input: an extinct era, latch rows and pack-buff rows.
    const before = structuredClone(FREE_SPECIES.homoErectus);
    const sheet = sheetOf('homoErectus');
    const built = defineFreeSpecies('homoErectus', sheet);
    (sheet.era as { fromMa: number }).fromMa = 0;
    (sheet.era as { toMa: number }).toMa = 0;
    (sheet.constants as { hide: number }).hide = 9;
    (sheet.traits.mass as unknown as number[])[1] = -1;
    (sheet.traits.latchDps as unknown as number[])[1] = -1;
    (sheet.buff?.cohesionRadius as unknown as number[])[1] = -1;
    // The edits stay on the sheet: neither the registry nor the built entry sees them.
    expect(FREE_SPECIES.homoErectus).toEqual(before);
    expect(built).toEqual(before);
  });

  it('rejects a sheet whose rows do not match its flags', () => {
    const trex = sheetOf('trex');
    const lion = sheetOf('lion');
    expect(() =>
      defineFreeSpecies('trex', { ...trex, traits: { ...trex.traits, latchDps: [1, 2, 3, 'S'] } }),
    ).toThrow(/cannot latch/);
    expect(() => defineFreeSpecies('trex', { ...trex, buff: lion.buff })).toThrow(/pack-buff/);
    expect(() => defineFreeSpecies('lion', { ...lion, buff: null })).toThrow(/pack-buff/);
    const traits = Object.fromEntries(
      Object.entries(lion.traits).filter(([k]) => k !== 'latchDps'),
    ) as FreeSpeciesSheet['traits'];
    expect(() => defineFreeSpecies('lion', { ...lion, traits })).toThrow(/missing trait latchDps/);
  });
});

describe('ad safety of free matchups', () => {
  const matchup = (a: FreeSpeciesId, b: FreeSpeciesId): FreeConfig => ({
    ...defaultFreeConfig(),
    sides: [defaultSide(a), defaultSide(b)],
  });

  it('marks every pairing ad-safe, mirror matchups included', () => {
    for (const a of FREE_SPECIES_IDS) {
      for (const b of FREE_SPECIES_IDS) {
        expect(freeMatchupAdSafe(matchup(a, b)), `${a}/${b}`).toBe(true);
      }
    }
  });

  it('agrees with matchupAdSafe on every classic pairing', () => {
    for (const h of HEAVY_SPECIES_IDS) {
      for (const p of PACK_SPECIES_IDS) {
        expect(freeMatchupAdSafe(matchup(h, p)), `${h}/${p}`).toBe(
          matchupAdSafe({ heavySpecies: h, packSpecies: p }),
        );
      }
    }
  });

  it('is false as soon as either side is not ad-safe', () => {
    const registry = FREE_SPECIES as Record<FreeSpeciesId, FreeSpecies>;
    const saved = registry.wolf;
    registry.wolf = { ...saved, adSafe: false };
    try {
      expect(freeMatchupAdSafe(matchup('wolf', 'trex'))).toBe(false);
      expect(freeMatchupAdSafe(matchup('trex', 'wolf'))).toBe(false);
      expect(freeMatchupAdSafe(matchup('wolf', 'wolf'))).toBe(false);
      expect(freeMatchupAdSafe(matchup('trex', 'lion'))).toBe(true);
    } finally {
      registry.wolf = saved;
    }
  });

  it('counts an unknown species as not ad-safe', () => {
    const [a, b] = matchup('trex', 'tiger').sides;
    const dragon = { ...b, species: 'dragon' as FreeSpeciesId };
    expect(freeMatchupAdSafe({ sides: [a, dragon] })).toBe(false);
    expect(freeMatchupAdSafe({ sides: [dragon, a] })).toBe(false);
  });
});
