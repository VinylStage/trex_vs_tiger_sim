import { describe, expect, it } from 'vitest';
import { CONSTANTS } from '../src/sim/engine';
import { PARAMS } from '../src/sim/params';
import {
  COEXISTING_MATCHUPS,
  DOCUMENTED_MATCHUPS,
  EVIDENCE,
  HEAVY_KEYS,
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_KEYS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  boundsTable,
  matchupAdSafe,
  matchupAnchor,
  matchupClass,
  matchupHasHominin,
  paramBounds,
  paramEvidence,
  paramKey,
} from '../src/sim/species';

describe('species registry', () => {
  it('lists the catalog: phase 1, then the woolly mammoth and Homo erectus', () => {
    expect(HEAVY_SPECIES_IDS).toEqual([
      'trex',
      'elephant',
      'buffalo',
      'brownBear',
      'mammoth',
      'homoErectus',
    ]);
    expect(PACK_SPECIES_IDS).toEqual(['tiger', 'lion', 'wolf', 'hyena', 'homoErectus']);
  });

  it('keys every species by its id and role, with a complete preset', () => {
    for (const id of HEAVY_SPECIES_IDS) {
      const s = HEAVY_SPECIES[id];
      expect(s.id).toBe(id);
      expect(s.role).toBe('heavy');
      expect(Object.keys(s.ranges)).toEqual([...HEAVY_KEYS]);
      expect(Object.keys(s.evidence)).toEqual([...HEAVY_KEYS]);
      expect(Object.keys(s.bounds).sort()).toEqual([...HEAVY_KEYS].sort());
      expect(s.constants.hide).toBeGreaterThan(0);
      expect(s.constants.hide).toBeLessThanOrEqual(1);
    }
    for (const id of PACK_SPECIES_IDS) {
      const s = PACK_SPECIES[id];
      expect(s.id).toBe(id);
      expect(s.role).toBe('pack');
      expect(Object.keys(s.ranges)).toEqual([...PACK_KEYS]);
      expect(Object.keys(s.evidence)).toEqual([...PACK_KEYS]);
      expect(s.constants.radius).toBeGreaterThan(0);
    }
  });

  it('matches the parameter ids in order', () => {
    expect(PARAMS.map((p) => paramKey(p.id))).toEqual([...HEAVY_KEYS, ...PACK_KEYS]);
    expect(boundsTable('trex', 'tiger')).toHaveLength(PARAMS.length);
  });

  it('carries an evidence tag for every preset value', () => {
    for (const h of HEAVY_SPECIES_IDS) {
      for (const p of PARAMS) expect(EVIDENCE).toContain(paramEvidence(p.id, h, 'tiger'));
    }
    expect(paramEvidence('heavy.mass', 'trex', 'tiger')).toBe('L');
    expect(paramEvidence('heavy.speed', 'buffalo', 'tiger')).toBe('U');
    expect(paramEvidence('heavy.biteForce', 'brownBear', 'tiger')).toBe('D');
    expect(paramEvidence('pack.sprintSpeed', 'trex', 'wolf')).toBe('U');
  });

  it('uses the docs/SPECIES.md values (spot checks)', () => {
    expect(HEAVY_SPECIES.elephant.ranges.mass).toEqual({ min: 2600, mode: 3200, max: 6900 });
    expect(HEAVY_SPECIES.brownBear.ranges.biteForce).toEqual({ min: 0.6, mode: 1.2, max: 3 });
    expect(PACK_SPECIES.lion.ranges.sprintSpeed).toEqual({ min: 11, mode: 14, max: 20.6 });
    expect(PACK_SPECIES.hyena.ranges.dps).toEqual({ min: 1.2, mode: 4, max: 12 });
    expect(HEAVY_SPECIES.elephant.constants.hide).toBe(0.3);
    expect(HEAVY_SPECIES.buffalo.constants.hide).toBe(0.5);
    expect(HEAVY_SPECIES.brownBear.constants.hide).toBe(0.5);
    expect(PACK_SPECIES.wolf.constants.radius).toBe(0.5);
    expect(PACK_SPECIES.hyena.constants.radius).toBe(0.6);
    expect(HEAVY_SPECIES.mammoth.ranges.mass).toEqual({ min: 2800, mode: 4500, max: 6000 });
    expect(HEAVY_SPECIES.mammoth.weapon).toBe('tusk');
    expect(HEAVY_SPECIES.mammoth.constants.hide).toBe(0.25);
    expect(HEAVY_SPECIES.homoErectus.weapon).toBe('hands');
    expect(HEAVY_SPECIES.homoErectus.constants.hide).toBe(1);
    expect(HEAVY_SPECIES.homoErectus.ranges.mass).toEqual(PACK_SPECIES.homoErectus.ranges.mass);
    expect(PACK_SPECIES.homoErectus.constants.radius).toBe(0.3);
  });

  it('keeps every preset inside its own bounds', () => {
    for (const s of [...Object.values(HEAVY_SPECIES), ...Object.values(PACK_SPECIES)]) {
      for (const [k, r] of Object.entries(s.ranges)) {
        const [lo, hi] = (s.bounds as Record<string, readonly [number, number]>)[k] ?? [0, 0];
        expect(r.min, `${s.id} ${k}`).toBeGreaterThanOrEqual(lo);
        expect(r.max, `${s.id} ${k}`).toBeLessThanOrEqual(hi);
        expect(r.min).toBeLessThanOrEqual(r.mode);
        expect(r.mode).toBeLessThanOrEqual(r.max);
      }
    }
  });

  it('widens bounds for the heavy Homo erectus only, never for T. rex or the tiger', () => {
    expect(paramBounds('heavy.mass', 'trex', 'tiger')).toEqual([1000, 20000]);
    expect(paramBounds('pack.mass', 'trex', 'tiger')).toEqual([30, 500]);
    expect(paramBounds('heavy.mass', 'elephant', 'tiger')).toEqual([100, 20000]);
    expect(paramBounds('heavy.mass', 'mammoth', 'tiger')).toEqual([100, 20000]);
    expect(paramBounds('heavy.mass', 'homoErectus', 'tiger')).toEqual([20, 20000]);
    expect(paramBounds('heavy.biteReach', 'homoErectus', 'tiger')).toEqual([0.3, 15]);
    expect(paramBounds('heavy.bodyRadius', 'homoErectus', 'tiger')).toEqual([0.1, 8]);
    expect(paramBounds('heavy.biteReach', 'elephant', 'tiger')).toEqual([1, 15]);
    expect(paramBounds('pack.mass', 'trex', 'homoErectus')).toEqual([5, 1000]);
  });

  it('dates the extinct species', () => {
    expect(HEAVY_SPECIES.homoErectus.era).toEqual({ fromMa: 1.9, toMa: 0.11 });
    expect(PACK_SPECIES.homoErectus.era).toEqual(HEAVY_SPECIES.homoErectus.era);
    expect(HEAVY_SPECIES.mammoth.era).toEqual({ fromMa: 0.4, toMa: 0.004 });
  });
});

describe('ad safety and hominins', () => {
  it('marks every current species ad-safe', () => {
    for (const h of HEAVY_SPECIES_IDS) {
      for (const p of PACK_SPECIES_IDS) {
        expect(matchupAdSafe({ heavySpecies: h, packSpecies: p })).toBe(true);
      }
    }
  });

  it('flags only Homo erectus as a hominin', () => {
    expect(HEAVY_SPECIES_IDS.filter((id) => HEAVY_SPECIES[id].hominin)).toEqual(['homoErectus']);
    expect(PACK_SPECIES_IDS.filter((id) => PACK_SPECIES[id].hominin)).toEqual(['homoErectus']);
    expect(matchupHasHominin({ heavySpecies: 'trex', packSpecies: 'homoErectus' })).toBe(true);
    expect(matchupHasHominin({ heavySpecies: 'homoErectus', packSpecies: 'wolf' })).toBe(true);
    expect(matchupHasHominin({ heavySpecies: 'mammoth', packSpecies: 'wolf' })).toBe(false);
  });
});

describe('matchups', () => {
  it('marks field-documented pairings', () => {
    expect(matchupClass('elephant', 'lion')).toBe('documented');
    expect(matchupClass('buffalo', 'lion')).toBe('documented');
    expect(matchupClass('brownBear', 'wolf')).toBe('documented');
    expect(matchupClass('brownBear', 'tiger')).toBe('documented');
    expect(matchupAnchor('elephant', 'lion')).toBe('elephants-and-lions');
    expect(matchupAnchor('trex', 'tiger')).toBeNull();
  });

  it('marks pairings that never lived at the same time', () => {
    for (const p of PACK_SPECIES_IDS) expect(matchupClass('trex', p)).toBe('neverMet');
  });

  it('marks extinct species with overlapping fossil records as undocumented', () => {
    expect(matchupClass('homoErectus', 'tiger')).toBe('undocumented');
    expect(matchupClass('homoErectus', 'hyena')).toBe('undocumented');
    expect(matchupClass('elephant', 'homoErectus')).toBe('undocumented');
    expect(matchupClass('mammoth', 'wolf')).toBe('undocumented');
    expect(matchupClass('mammoth', 'hyena')).toBe('undocumented');
    expect(matchupClass('mammoth', 'homoErectus')).toBe('undocumented');
    expect(matchupClass('homoErectus', 'homoErectus')).toBe('undocumented');
    expect(matchupClass('mammoth', 'lion')).toBe('neverMet');
    expect(matchupClass('trex', 'homoErectus')).toBe('neverMet');
    for (const m of COEXISTING_MATCHUPS) {
      expect(HEAVY_SPECIES[m.heavy].era === 'extant').not.toBe(
        PACK_SPECIES[m.pack].era === 'extant',
      );
    }
  });

  it('marks extant pairings without field records as undocumented', () => {
    expect(matchupClass('elephant', 'wolf')).toBe('undocumented');
    expect(matchupClass('elephant', 'tiger')).toBe('undocumented');
  });

  it('documents only valid species', () => {
    for (const m of DOCUMENTED_MATCHUPS) {
      expect(HEAVY_SPECIES_IDS).toContain(m.heavy);
      expect(PACK_SPECIES_IDS).toContain(m.pack);
    }
  });
});

describe('intimidation (morale effect of heavy hits)', () => {
  // Heavies that shipped before #47: their morale effects must stay exact identities.
  const shipped = ['trex', 'elephant', 'buffalo', 'brownBear'] as const;

  it('is exactly 1 for every shipped heavy, so earlier results are bit-identical', () => {
    for (const id of shipped) {
      const k = HEAVY_SPECIES[id].constants.intimidation;
      expect(Object.is(k, 1)).toBe(true);
      expect(Object.is(CONSTANTS.woundMoraleLoss * k, CONSTANTS.woundMoraleLoss)).toBe(true);
      expect(Object.is(CONSTANTS.throwMoraleLoss * k, CONSTANTS.throwMoraleLoss)).toBe(true);
      expect(Object.is(CONSTANTS.recoverMinTime * k, CONSTANTS.recoverMinTime)).toBe(true);
    }
    expect(HEAVY_SPECIES.mammoth.constants.intimidation).toBe(1);
  });

  it('is below 1 only for the unarmed hominin', () => {
    const k = HEAVY_SPECIES.homoErectus.constants.intimidation;
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(1);
    expect(
      HEAVY_SPECIES_IDS.filter((id) => HEAVY_SPECIES[id].constants.intimidation !== 1),
    ).toEqual(['homoErectus']);
  });
});
