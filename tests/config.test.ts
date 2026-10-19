import { describe, expect, it } from 'vitest';
import { LIMITS, defaultConfig, sanitizeConfig } from '../src/sim/config';
import { PARAMS, paramDef } from '../src/sim/params';

describe('sanitizeConfig', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeConfig(null)).toEqual(defaultConfig());
    expect(sanitizeConfig('x')).toEqual(defaultConfig());
  });

  it('clamps numbers, rounds integers and rejects invalid enums', () => {
    const c = sanitizeConfig({
      trexCount: 1e9,
      tigerCount: -3,
      runs: 12.7,
      seed: -1,
      arenaSize: 'abc',
      sampling: 'sobol',
      tigerTactic: 'direct',
      morale: 'yes',
    });
    expect(c.trexCount).toBe(LIMITS.trexCount[1]);
    expect(c.tigerCount).toBe(LIMITS.tigerCount[0]);
    expect(c.runs).toBe(13);
    expect(c.seed).toBe(0);
    expect(c.arenaSize).toBe(defaultConfig().arenaSize);
    expect(c.sampling).toBe('lhs');
    expect(c.tigerTactic).toBe('direct');
    expect(c.morale).toBe(true);
  });

  it('drops unknown keys and params', () => {
    const c = sanitizeConfig({ evil: '<script>', params: { 'x.y': { min: 1 } } });
    expect('evil' in c).toBe(false);
    expect(Object.keys(c.params)).toEqual(PARAMS.map((p) => p.id));
  });

  it('orders and clamps triangular ranges to parameter bounds', () => {
    const c = sanitizeConfig({
      params: { 'trex.mass': { min: 9000, mode: 1e9, max: 2000 } },
    });
    const [, hi] = paramDef('trex.mass').bounds;
    expect(c.params['trex.mass']).toEqual({ min: 2000, mode: 9000, max: hi });
  });
});

describe('parameter table', () => {
  it('has defaults inside bounds and ordered', () => {
    for (const p of PARAMS) {
      const { min, mode, max } = p.default;
      expect(min).toBeLessThanOrEqual(mode);
      expect(mode).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(p.bounds[0]);
      expect(max).toBeLessThanOrEqual(p.bounds[1]);
    }
  });
});
