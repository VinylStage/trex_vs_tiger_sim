import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../sim/config';
import { PARAMS } from '../sim/params';
import { speciesRanges } from '../sim/species';

/** URL fragment key: `#s=<base64url(JSON)>`. */
export const SHARE_KEY = 's';
/**
 * Payload format version, stored as `v`. `sanitizeConfig` ignores it.
 * v1 (no `v` or `v: 1`) used `trex.*`/`tiger.*` ids and `trexCount`/`tigerCount`/`tigerTactic`;
 * it is upgraded through `upgradeV1` and reproduces bit-identically (tests/v1-golden.test.ts).
 */
export const SHARE_VERSION = 2;
/** Reject absurdly long fragments before decoding. */
export const MAX_SHARE_LENGTH = 8192;

type ScalarKey = Exclude<keyof ScenarioConfig, 'params' | 'heavySpecies' | 'packSpecies'>;
const SCALAR_KEYS: readonly ScalarKey[] = [
  'heavyCount',
  'packCount',
  'runs',
  'seed',
  'arenaSize',
  'maxTime',
  'sampling',
  'individualCV',
  'packTactic',
  'morale',
];

export function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on malformed input (bad alphabet or invalid UTF-8). */
export function base64UrlDecode(encoded: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) throw new Error('invalid base64url');
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Minimal JSON-able diff against the defaults. Species are stored as `heavy` and `pack` ids.
 * Params are stored as `[min, mode, max]` tuples and only for ids whose range differs from the
 * selected species' preset, so a link to an unedited matchup stays short.
 */
export function configDiff(config: ScenarioConfig): Record<string, unknown> {
  const d = defaultConfig();
  const out: Record<string, unknown> = {};
  if (config.heavySpecies !== d.heavySpecies) out['heavy'] = config.heavySpecies;
  if (config.packSpecies !== d.packSpecies) out['pack'] = config.packSpecies;
  for (const k of SCALAR_KEYS) {
    if (config[k] !== d[k]) out[k] = config[k];
  }
  const presets = speciesRanges(config.heavySpecies, config.packSpecies);
  const params: Record<string, [number, number, number]> = {};
  for (const p of PARAMS) {
    const a = config.params[p.id];
    const b = presets[p.id];
    if (a.min !== b.min || a.mode !== b.mode || a.max !== b.max) {
      params[p.id] = [a.min, a.mode, a.max];
    }
  }
  if (Object.keys(params).length > 0) out['params'] = params;
  return out;
}

/** Encode a config as a URL fragment payload, or `''` when it equals the defaults. */
export function encodeConfig(config: ScenarioConfig): string {
  const diff = configDiff(config);
  if (Object.keys(diff).length === 0) return '';
  return base64UrlEncode(JSON.stringify({ v: SHARE_VERSION, ...diff }));
}

/** Turn `[min, mode, max]` tuples back into objects; only known parameter ids are kept. */
function expandParams(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const p of PARAMS) {
    if (!Object.hasOwn(src, p.id)) continue;
    const v = src[p.id];
    out[p.id] = Array.isArray(v) ? { min: v[0], mode: v[1], max: v[2] } : v;
  }
  return out;
}

/** v1 scalar keys and their v2 names. */
export const V1_KEYS: Readonly<Record<string, string>> = {
  trexCount: 'heavyCount',
  tigerCount: 'packCount',
  tigerTactic: 'packTactic',
};

/** v1 parameter id → v2 id (`trex.mass` → `heavy.mass`, `tiger.dps` → `pack.dps`). */
export function v1ParamId(id: string): string {
  return id.replace(/^trex\./, 'heavy.').replace(/^tiger\./, 'pack.');
}

/** Keys a v1 payload could not carry: v1 ignored them, so the upgrade drops them too. */
const V2_ONLY = new Set(['heavyCount', 'packCount', 'packTactic', 'heavy', 'pack']);

/**
 * Rewrite a v1 payload into v2 names. Values are untouched: `sanitizeConfig` then clamps them
 * with the T. rex and tiger bounds, which are exactly the v1 bounds.
 */
export function upgradeV1(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === '__proto__' || V2_ONLY.has(k) || k === 'params') continue;
    out[V1_KEYS[k] ?? k] = v;
  }
  out['v'] = SHARE_VERSION;
  const p = o['params'];
  if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) {
      if (/^(trex|tiger)\./.test(k)) params[v1ParamId(k)] = v;
    }
    out['params'] = params;
  }
  return out;
}

/** Decode a payload produced by `encodeConfig`. Any malformed input yields the defaults. */
export function decodeConfig(payload: string): ScenarioConfig {
  if (payload.length === 0 || payload.length > MAX_SHARE_LENGTH) return defaultConfig();
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(payload));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return defaultConfig();
    }
    const raw = parsed as Record<string, unknown>;
    // Main ignored `v`, so anything that is not a number ≥ 2 is a v1 payload.
    const v = raw['v'];
    const o = typeof v !== 'number' || !(v >= 2) ? upgradeV1(raw) : raw;
    return sanitizeConfig({
      ...o,
      heavySpecies: o['heavy'],
      packSpecies: o['pack'],
      params: expandParams(o['params']),
    });
  } catch {
    return defaultConfig();
  }
}

/** Extract the share payload from a location hash (`#s=…`), or null if there is none. */
export function payloadFromHash(hash: string): string | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of h.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === SHARE_KEY) return part.slice(eq + 1);
  }
  return null;
}

/** Config from a location hash, or null when the hash carries no `s=` payload. */
export function configFromHash(hash: string): ScenarioConfig | null {
  const payload = payloadFromHash(hash);
  return payload === null ? null : decodeConfig(payload);
}

/** Location hash for a config (`''` for the defaults, so the URL stays clean). */
export function hashFromConfig(config: ScenarioConfig): string {
  const payload = encodeConfig(config);
  return payload ? `#${SHARE_KEY}=${payload}` : '';
}
