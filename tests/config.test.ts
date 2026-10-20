import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  MAX_WORK,
  defaultConfig,
  maxRunsFor,
  sanitizeConfig,
  workEstimate,
} from '../src/sim/config';
import { PARAMS, paramDef } from '../src/sim/params';
import {
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  paramBounds,
  presetRange,
  speciesRanges,
} from '../src/sim/species';

describe('sanitizeConfig', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeConfig(null)).toEqual(defaultConfig());
    expect(sanitizeConfig('x')).toEqual(defaultConfig());
  });

  it('clamps numbers, rounds integers and rejects invalid enums', () => {
    const c = sanitizeConfig({
      heavyCount: 1e9,
      packCount: -3,
      runs: 12.7,
      seed: -1,
      arenaSize: 'abc',
      sampling: 'sobol',
      packTactic: 'direct',
      morale: 'yes',
    });
    expect(c.heavyCount).toBe(LIMITS.heavyCount[1]);
    expect(c.packCount).toBe(LIMITS.packCount[0]);
    expect(c.runs).toBe(13);
    expect(c.seed).toBe(0);
    expect(c.arenaSize).toBe(defaultConfig().arenaSize);
    expect(c.sampling).toBe('lhs');
    expect(c.packTactic).toBe('direct');
    expect(c.morale).toBe(true);
  });

  it('drops unknown keys and params', () => {
    const c = sanitizeConfig({ evil: '<script>', params: { 'x.y': { min: 1 } } });
    expect('evil' in c).toBe(false);
    expect(Object.keys(c.params)).toEqual(PARAMS.map((p) => p.id));
  });

  it('orders and clamps triangular ranges to parameter bounds', () => {
    const c = sanitizeConfig({
      params: { 'heavy.mass': { min: 9000, mode: 1e9, max: 2000 } },
    });
    const [, hi] = paramBounds('heavy.mass', 'trex', 'tiger');
    expect(c.params['heavy.mass']).toEqual({ min: 2000, mode: 9000, max: hi });
  });
});

describe('sanitizeConfig hardening', () => {
  it('accepts only JSON numbers, not numeric strings', () => {
    const d = defaultConfig();
    const c = sanitizeConfig({ seed: '', individualCV: '  ', runs: '0x10', heavyCount: '7' });
    expect(c.seed).toBe(d.seed);
    expect(c.individualCV).toBe(d.individualCV);
    expect(c.runs).toBe(d.runs);
    expect(c.heavyCount).toBe(d.heavyCount);
  });

  it('rejects partial triangular ranges as a whole', () => {
    const d = defaultConfig();
    expect(sanitizeConfig({ params: { 'pack.dps': { min: 20 } } }).params['pack.dps']).toEqual(
      d.params['pack.dps'],
    );
    expect(
      sanitizeConfig({ params: { 'heavy.mass': { min: 1, mode: 2, max: 'x' } } }).params[
        'heavy.mass'
      ],
    ).toEqual(d.params['heavy.mass']);
  });

  it('snaps maxTime to the 0.1 s time step', () => {
    expect(sanitizeConfig({ maxTime: 30.05 }).maxTime).toBeCloseTo(30.1, 10);
    expect(sanitizeConfig({ maxTime: 30.04 }).maxTime).toBeCloseTo(30, 10);
  });

  it('caps runs so the combined work stays within MAX_WORK', () => {
    const c = sanitizeConfig({ heavyCount: 500, packCount: 5000, runs: 20000, maxTime: 3600 });
    expect(c.runs).toBe(maxRunsFor(c));
    expect(c.runs).toBeLessThan(20000);
    expect(workEstimate(c)).toBeLessThanOrEqual(MAX_WORK);
    expect(sanitizeConfig({ runs: 20000 }).runs).toBe(20000);
  });

  it('ignores prototype keys', () => {
    const c = sanitizeConfig(JSON.parse('{"__proto__":{"polluted":1},"params":{"__proto__":{}}}'));
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(c).toEqual(defaultConfig());
  });
});

describe('parameter table', () => {
  it('has every species preset inside its bounds and ordered', () => {
    for (const h of HEAVY_SPECIES_IDS) {
      for (const pk of PACK_SPECIES_IDS) {
        for (const p of PARAMS) {
          const { min, mode, max } = presetRange(p.id, h, pk);
          const [lo, hi] = paramBounds(p.id, h, pk);
          expect(min).toBeLessThanOrEqual(mode);
          expect(mode).toBeLessThanOrEqual(max);
          expect(min, `${h}/${pk} ${p.id}`).toBeGreaterThanOrEqual(lo);
          expect(max, `${h}/${pk} ${p.id}`).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('keeps the parameter order and step metadata', () => {
    expect(PARAMS.map((p) => p.id)).toHaveLength(22);
    expect(paramDef('pack.bleed').individual).toBe(false);
  });
});

describe('species in the config', () => {
  it('defaults to T. rex vs tigers', () => {
    const d = defaultConfig();
    expect(d.heavySpecies).toBe('trex');
    expect(d.packSpecies).toBe('tiger');
    expect(d.params).toEqual(speciesRanges('trex', 'tiger'));
  });

  it('falls back to the default species for unknown ids', () => {
    const c = sanitizeConfig({ heavySpecies: 'gorilla', packSpecies: 42 });
    expect(c.heavySpecies).toBe('trex');
    expect(c.packSpecies).toBe('tiger');
  });

  it('fills missing params from the selected species', () => {
    const c = sanitizeConfig({
      heavySpecies: 'elephant',
      packSpecies: 'wolf',
      params: { 'pack.dps': [1, 2, 3] },
    });
    expect(c.params['heavy.mass']).toEqual(HEAVY_SPECIES.elephant.ranges.mass);
    expect(c.params['pack.mass']).toEqual(PACK_SPECIES.wolf.ranges.mass);
    // Not an object triangle: rejected whole, the species preset stays.
    expect(c.params['pack.dps']).toEqual(PACK_SPECIES.wolf.ranges.dps);
  });

  it('clamps with the selected species bounds', () => {
    const big = { min: 50, mode: 120, max: 200 };
    expect(sanitizeConfig({ params: { 'heavy.mass': big } }).params['heavy.mass']).toEqual({
      min: 1000,
      mode: 1000,
      max: 1000,
    });
    expect(
      sanitizeConfig({ heavySpecies: 'brownBear', params: { 'heavy.mass': big } }).params[
        'heavy.mass'
      ],
    ).toEqual({ min: 100, mode: 120, max: 200 });
  });

  it('keeps T. rex and tiger on exactly the v1 bounds', () => {
    expect(HEAVY_SPECIES.trex.bounds.mass).toEqual([1000, 20000]);
    expect(HEAVY_SPECIES.trex.bounds.biteForce).toEqual([1, 150]);
    expect(PACK_SPECIES.tiger.bounds.mass).toEqual([30, 500]);
    expect(HEAVY_SPECIES.trex.constants.hide).toBe(1);
    expect(PACK_SPECIES.tiger.constants.radius).toBe(0.8);
  });
});
