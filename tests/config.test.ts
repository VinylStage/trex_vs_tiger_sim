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
    const [, hi] = paramDef('heavy.mass').bounds;
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
