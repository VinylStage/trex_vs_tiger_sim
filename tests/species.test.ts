import { describe, expect, it } from 'vitest';
import { PARAMS } from '../src/sim/params';
import {
  DOCUMENTED_MATCHUPS,
  EVIDENCE,
  HEAVY_KEYS,
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_KEYS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  boundsTable,
  matchupAnchor,
  matchupClass,
  paramEvidence,
  paramKey,
} from '../src/sim/species';

describe('species registry', () => {
  it('lists the phase-1 catalog', () => {
    expect(HEAVY_SPECIES_IDS).toEqual(['trex', 'elephant', 'buffalo', 'brownBear']);
    expect(PACK_SPECIES_IDS).toEqual(['tiger', 'lion', 'wolf', 'hyena']);
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
