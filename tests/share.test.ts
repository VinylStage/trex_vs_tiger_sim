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
  SHARE_VERSION,
  upgradeV1,
  v1ParamId,
  V1_KEYS,
} from '../src/ui/share';

const encodeRaw = (obj: unknown): string => base64UrlEncode(JSON.stringify(obj));

function customConfig(): ScenarioConfig {
  const c = defaultConfig();
  c.heavyCount = 3;
  c.packCount = 250;
  c.runs = 1234;
  c.seed = 4_000_000_000;
  c.sampling = 'random';
  c.packTactic = 'direct';
  c.morale = false;
  c.individualCV = 0.15;
  c.params['pack.dps'] = { min: 1.5, mode: 4.25, max: 9 };
  c.params['heavy.biteAccuracy'] = { min: 0.1, mode: 0.2, max: 0.9 };
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
    c.heavyCount = 1;
    c.params['pack.mass'] = { min: 90, mode: 180, max: 260 };
    expect(configDiff(c)).toEqual({ heavyCount: 1, params: { 'pack.mass': [90, 180, 260] } });
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
        v: 2,
        heavyCount: 1e9,
        packCount: -5,
        runs: 2.6,
        arenaSize: 1,
        params: { 'heavy.biteAccuracy': [-1, 0.5, 7], 'pack.dps': { min: 1, mode: 2, max: 1e6 } },
      }),
    );
    expect(c.heavyCount).toBe(LIMITS.heavyCount[1]);
    expect(c.packCount).toBe(LIMITS.packCount[0]);
    expect(c.runs).toBe(3);
    expect(c.arenaSize).toBe(LIMITS.arenaSize[0]);
    expect(c.params['heavy.biteAccuracy']).toEqual({ min: 0, mode: 0.5, max: 1 });
    const dpsBounds = PARAMS.find((p) => p.id === 'pack.dps')?.bounds;
    expect(c.params['pack.dps'].max).toBe(dpsBounds?.[1]);
  });

  it('drops unknown keys and unknown parameter ids', () => {
    const raw =
      '{"v":1,"trexCount":2,"evil":"<script>","__proto__":{"polluted":true},' +
      '"params":{"trex.mass":[6000,7000,8000],"trex.laser":[1,2,3],"__proto__":[1,2,3]}}';
    const c = decodeConfig(base64UrlEncode(raw));
    expect(c.heavyCount).toBe(2);
    expect(Object.keys(c).sort()).toEqual(Object.keys(defaultConfig()).sort());
    expect(Object.keys(c.params).sort()).toEqual(PARAMS.map((p) => p.id).sort());
    expect(c.params['heavy.mass']).toEqual({ min: 6000, mode: 7000, max: 8000 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('drops unknown keys and unknown parameter ids in a v2 payload', () => {
    const raw =
      '{"v":2,"heavyCount":2,"trexCount":3,"__proto__":{"polluted":true},' +
      '"params":{"heavy.mass":[6000,7000,8000],"trex.speed":[1,2,3],"__proto__":[1,2,3]}}';
    const c = decodeConfig(base64UrlEncode(raw));
    expect(c.heavyCount).toBe(2);
    expect(c.params['heavy.mass']).toEqual({ min: 6000, mode: 7000, max: 8000 });
    expect(c.params['heavy.speed']).toEqual(defaultConfig().params['heavy.speed']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('writes v2 payloads', () => {
    const hash = hashFromConfig(customConfig());
    const json = JSON.parse(base64UrlDecode(hash.slice(3))) as Record<string, unknown>;
    expect(json['v']).toBe(SHARE_VERSION);
    expect(SHARE_VERSION).toBe(2);
    expect(json['heavyCount']).toBe(3);
    expect(json['trexCount']).toBeUndefined();
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
    c.heavyCount = 1;
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

describe('v1 links', () => {
  it('upgrades v1 names to v2 names', () => {
    expect(
      upgradeV1({
        v: 1,
        trexCount: 2,
        tigerCount: 30,
        tigerTactic: 'direct',
        heavyCount: 9,
        seed: 5,
        params: { 'trex.mass': [1, 2, 3], 'tiger.dps': [4, 5, 6], 'pack.bleed': [0, 0, 0] },
      }),
    ).toEqual({
      v: 2,
      heavyCount: 2,
      packCount: 30,
      packTactic: 'direct',
      seed: 5,
      params: { 'heavy.mass': [1, 2, 3], 'pack.dps': [4, 5, 6] },
    });
    expect(v1ParamId('tiger.moraleLoss')).toBe('pack.moraleLoss');
    expect(V1_KEYS).toEqual({
      trexCount: 'heavyCount',
      tigerCount: 'packCount',
      tigerTactic: 'packTactic',
    });
  });

  it('decodes a v1 link and its v2 equivalent to the same config', () => {
    const v1 = {
      v: 1,
      trexCount: 3,
      tigerCount: 250,
      tigerTactic: 'direct',
      morale: false,
      params: { 'tiger.dps': [1.5, 4.25, 9], 'trex.biteAccuracy': [0.1, 0.2, 0.9] },
    };
    const v2 = {
      v: 2,
      heavyCount: 3,
      packCount: 250,
      packTactic: 'direct',
      morale: false,
      params: { 'pack.dps': [1.5, 4.25, 9], 'heavy.biteAccuracy': [0.1, 0.2, 0.9] },
    };
    const a = decodeConfig(encodeRaw(v1));
    expect(a).toEqual(decodeConfig(encodeRaw(v2)));
    expect(a.packTactic).toBe('direct');
    expect(a.params['pack.dps']).toEqual({ min: 1.5, mode: 4.25, max: 9 });
    // A payload without `v` is a v1 payload.
    expect(decodeConfig(encodeRaw({ ...v1, v: undefined }))).toEqual(a);
    // Re-encoding a v1 link yields a v2 link for the same config.
    expect(configFromHash(hashFromConfig(a))).toEqual(a);
  });

  it('clamps out-of-v1-bounds values with the v1 bounds', () => {
    const c = decodeConfig(
      encodeRaw({ v: 1, params: { 'trex.mass': [500, 600, 700], 'tiger.mass': [10, 20, 900] } }),
    );
    expect(c.params['heavy.mass']).toEqual({ min: 1000, mode: 1000, max: 1000 });
    expect(c.params['pack.mass']).toEqual({ min: 30, mode: 30, max: 500 });
  });

  it('ignores v2-only keys in a v1 payload, as v1 did', () => {
    const c = decodeConfig(encodeRaw({ v: 1, heavyCount: 7, params: { 'heavy.mass': [1, 2, 3] } }));
    expect(c).toEqual(defaultConfig());
  });
});
