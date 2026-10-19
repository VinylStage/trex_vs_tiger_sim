import { describe, expect, it } from 'vitest';
import { defaultConfig, LIMITS, type ScenarioConfig } from '../src/sim/config';
import { PARAMS } from '../src/sim/params';
import {
  base64UrlDecode,
  base64UrlEncode,
  configDiff,
  configFromHash,
  decodeConfig,
  encodeConfig,
  hashFromConfig,
  MAX_SHARE_LENGTH,
  payloadFromHash,
} from '../src/ui/share';

const encodeRaw = (obj: unknown): string => base64UrlEncode(JSON.stringify(obj));

function customConfig(): ScenarioConfig {
  const c = defaultConfig();
  c.trexCount = 3;
  c.tigerCount = 250;
  c.runs = 1234;
  c.seed = 4_000_000_000;
  c.sampling = 'random';
  c.tigerTactic = 'direct';
  c.morale = false;
  c.individualCV = 0.15;
  c.params['tiger.dps'] = { min: 1.5, mode: 4.25, max: 9 };
  c.params['trex.biteAccuracy'] = { min: 0.1, mode: 0.2, max: 0.9 };
  return c;
}

describe('base64url', () => {
  it('round-trips UTF-8 text without padding or unsafe characters', () => {
    const text = '티라노 vs 호랑이 🦖🐅 ~~~???';
    const enc = base64UrlEncode(text);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(base64UrlDecode(enc)).toBe(text);
  });

  it('rejects characters outside the alphabet and invalid UTF-8', () => {
    expect(() => base64UrlDecode('abc$')).toThrow();
    expect(() => base64UrlDecode('_w')).toThrow();
  });
});

describe('share codec', () => {
  it('encodes the default config as an empty payload and a clean URL', () => {
    expect(encodeConfig(defaultConfig())).toBe('');
    expect(hashFromConfig(defaultConfig())).toBe('');
  });

  it('round-trips a customised config exactly', () => {
    const c = customConfig();
    const hash = hashFromConfig(c);
    expect(hash.startsWith('#s=')).toBe(true);
    expect(configFromHash(hash)).toEqual(c);
  });

  it('stores only fields and params that differ from the defaults', () => {
    const c = defaultConfig();
    c.trexCount = 1;
    c.params['tiger.mass'] = { min: 90, mode: 180, max: 260 };
    expect(configDiff(c)).toEqual({ trexCount: 1, params: { 'tiger.mass': [90, 180, 260] } });
  });

  it('returns defaults for garbage input', () => {
    for (const bad of ['%%%', '!!', 'not base64 at all', encodeRaw('just a string'), 'AAAA']) {
      expect(decodeConfig(bad)).toEqual(defaultConfig());
    }
    expect(decodeConfig(base64UrlEncode('{"trexCount": 5'))).toEqual(defaultConfig());
    expect(decodeConfig(encodeRaw([1, 2, 3]))).toEqual(defaultConfig());
    expect(decodeConfig(encodeRaw(null))).toEqual(defaultConfig());
    expect(configFromHash('#s=')).toEqual(defaultConfig());
  });

  it('rejects oversized payloads', () => {
    expect(decodeConfig('A'.repeat(MAX_SHARE_LENGTH + 1))).toEqual(defaultConfig());
  });

  it('clamps out-of-range values', () => {
    const c = decodeConfig(
      encodeRaw({
        trexCount: 1e9,
        tigerCount: -5,
        runs: 2.6,
        arenaSize: 1,
        params: { 'trex.biteAccuracy': [-1, 0.5, 7], 'tiger.dps': { min: 1, mode: 2, max: 1e6 } },
      }),
    );
    expect(c.trexCount).toBe(LIMITS.trexCount[1]);
    expect(c.tigerCount).toBe(LIMITS.tigerCount[0]);
    expect(c.runs).toBe(3);
    expect(c.arenaSize).toBe(LIMITS.arenaSize[0]);
    expect(c.params['trex.biteAccuracy']).toEqual({ min: 0, mode: 0.5, max: 1 });
    const dpsBounds = PARAMS.find((p) => p.id === 'tiger.dps')?.bounds;
    expect(c.params['tiger.dps'].max).toBe(dpsBounds?.[1]);
  });

  it('drops unknown keys and unknown parameter ids', () => {
    const raw =
      '{"v":1,"trexCount":2,"evil":"<script>","__proto__":{"polluted":true},' +
      '"params":{"trex.mass":[6000,7000,8000],"trex.laser":[1,2,3],"__proto__":[1,2,3]}}';
    const c = decodeConfig(base64UrlEncode(raw));
    expect(c.trexCount).toBe(2);
    expect(Object.keys(c).sort()).toEqual(Object.keys(defaultConfig()).sort());
    expect(Object.keys(c.params).sort()).toEqual(PARAMS.map((p) => p.id).sort());
    expect(c.params['trex.mass']).toEqual({ min: 6000, mode: 7000, max: 8000 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('falls back per field when types are wrong', () => {
    const c = decodeConfig(
      encodeRaw({ sampling: 'magic', morale: 'yes', seed: 'abc', runs: '42' }),
    );
    const d = defaultConfig();
    expect(c.sampling).toBe(d.sampling);
    expect(c.morale).toBe(d.morale);
    expect(c.seed).toBe(d.seed);
    expect(c.runs).toBe(d.runs);
  });

  it('keeps the URL reasonably short even when every parameter is overridden', () => {
    const c = customConfig();
    for (const p of PARAMS) {
      const [lo, hi] = p.bounds;
      c.params[p.id] = { min: lo, mode: (lo + hi) / 2, max: hi };
    }
    const hash = hashFromConfig(c);
    expect(configFromHash(hash)).toEqual(c);
    expect(hash.length).toBeLessThan(2000);
  });

  it('keeps a typical shared URL short', () => {
    const c = defaultConfig();
    c.trexCount = 1;
    c.seed = 123456789;
    expect(hashFromConfig(c).length).toBeLessThan(80);
  });

  it('parses the payload out of a hash with other fragments', () => {
    expect(payloadFromHash('#foo=1&s=abc')).toBe('abc');
    expect(payloadFromHash('#s=xyz')).toBe('xyz');
    expect(payloadFromHash('')).toBeNull();
    expect(payloadFromHash('#section')).toBeNull();
    expect(configFromHash('#about')).toBeNull();
  });
});
