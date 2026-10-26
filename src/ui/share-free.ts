import {
  GLOBALS,
  PACK_BUFF_EFFECTS,
  defaultFreeConfig,
  globalPresets,
  sanitizeFreeConfig,
  type FreeConfig,
  type SideConfig,
} from '../sim/free/config';
import { buffRanges, traitRanges } from '../sim/free/species';
import { BUFF_TRAIT_IDS, TRAIT_IDS } from '../sim/free/traits';
import type { Triangular } from '../sim/params';
import {
  MAX_SHARE_LENGTH,
  SHARE_KEY,
  base64UrlDecode,
  base64UrlEncode,
  payloadFromHash,
  tupleRange,
} from './share';

/*
 * Share payload v3 for free-model configs (docs/design/FREE-MATCHUPS.md §2.4, §2.5): the same
 * `#s=` fragment, base64url JSON, with `v: 3` and the mode marker `m: "free"`. Legacy payloads
 * (v1, v2) never reach this module and keep decoding through src/ui/share.ts unchanged.
 *
 *   {"v":3,"m":"free","a":{"sp":"lion","n":5},"b":{"sp":"tiger","n":5},"runs":1000}
 *
 * Per side: `sp` species, `n` count, `p` edited trait ranges and `bf` edited pack-buff ranges as
 * `[min, mode, max]`, both diffed against the species presets. `buff` holds switches that are
 * off, `g` edited global constants; scalars as in v2, diffed against the free defaults.
 */

export const FREE_SHARE_VERSION = 3;
export const FREE_MODE_MARKER = 'free';
/** Copy/paste code prefix of a free config (`TVT2-` stays the legacy one). */
export const FREE_CODE_PREFIX = `TVT${FREE_SHARE_VERSION}-`;

const SCALARS = [
  'runs',
  'seed',
  'arenaSize',
  'maxTime',
  'sampling',
  'individualCV',
  'morale',
] as const;

type Tuple = [number, number, number];
const differs = (a: Triangular, b: Triangular): boolean =>
  a.min !== b.min || a.mode !== b.mode || a.max !== b.max;

function diffRanges<K extends string>(
  ids: readonly K[],
  edited: Readonly<Record<K, Triangular>>,
  preset: Readonly<Record<K, Triangular>>,
): Record<string, Tuple> | null {
  const out: Record<string, Tuple> = {};
  for (const k of ids) {
    const a = edited[k];
    if (differs(a, preset[k])) out[k] = [a.min, a.mode, a.max];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sideDiff(side: SideConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { sp: side.species, n: side.count };
  const p = diffRanges(TRAIT_IDS, side.params, traitRanges(side.species));
  if (p) out['p'] = p;
  const bf = diffRanges(BUFF_TRAIT_IDS, side.buff, buffRanges(side.species));
  if (bf) out['bf'] = bf;
  return out;
}

/** Minimal JSON-able form of a free config (always carries `v`, `m` and both sides). */
export function freeConfigDiff(config: FreeConfig): Record<string, unknown> {
  const d = defaultFreeConfig();
  const out: Record<string, unknown> = {
    v: FREE_SHARE_VERSION,
    m: FREE_MODE_MARKER,
    a: sideDiff(config.sides[0]),
    b: sideDiff(config.sides[1]),
  };
  const off = PACK_BUFF_EFFECTS.filter((e) => !config.packBuff[e]);
  if (off.length > 0) out['buff'] = Object.fromEntries(off.map((e) => [e, false]));
  const g = diffRanges(
    GLOBALS.map((x) => x.id),
    config.globals,
    globalPresets(),
  );
  if (g) out['g'] = g;
  for (const k of SCALARS) if (config[k] !== d[k]) out[k] = config[k];
  return out;
}

export function encodeFreeConfig(config: FreeConfig): string {
  return base64UrlEncode(JSON.stringify(freeConfigDiff(config)));
}

/** Location hash of a free config; never empty, so a free link always opens in free mode. */
export function hashFromFreeConfig(config: FreeConfig): string {
  return `#${SHARE_KEY}=${encodeFreeConfig(config)}`;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function expandRanges(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isObject(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k === '__proto__') continue;
    out[k] = Array.isArray(v) ? tupleRange(v) : v;
  }
  return out;
}

const sideInput = (raw: unknown): Record<string, unknown> => {
  const o = isObject(raw) ? raw : {};
  return {
    species: o['sp'],
    count: o['n'],
    params: expandRanges(o['p']),
    buff: expandRanges(o['bf']),
  };
};

/** Whether a parsed payload object is a free-model payload (v ≥ 3 with the mode marker). */
export function isFreePayload(raw: unknown): raw is Record<string, unknown> {
  return (
    isObject(raw) &&
    typeof raw['v'] === 'number' &&
    raw['v'] >= FREE_SHARE_VERSION &&
    raw['m'] === FREE_MODE_MARKER
  );
}

/** Free config from a parsed v3 payload object. Never throws; invalid values fall back. */
export function freeConfigFromObject(raw: Record<string, unknown>): FreeConfig {
  const input: Record<string, unknown> = {
    sides: [sideInput(raw['a']), sideInput(raw['b'])],
    packBuff: isObject(raw['buff']) ? raw['buff'] : {},
    globals: expandRanges(raw['g']),
  };
  for (const k of SCALARS) if (Object.hasOwn(raw, k)) input[k] = raw[k];
  return sanitizeFreeConfig(input);
}

/** Decoded payload object, or null for anything malformed. */
function parsePayloadObject(payload: string): unknown {
  if (payload.length === 0 || payload.length > MAX_SHARE_LENGTH) return null;
  if (!/^[A-Za-z0-9_-]*$/.test(payload)) return null;
  try {
    return JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }
}

/** Free config of a `#s=` hash, or null when the hash holds no free (v3) payload. */
export function freeConfigFromHash(hash: string): FreeConfig | null {
  const payload = payloadFromHash(hash);
  if (payload === null) return null;
  const raw = parsePayloadObject(payload);
  return isFreePayload(raw) ? freeConfigFromObject(raw) : null;
}

/** The copy/paste settings code of a free config. */
export function freeConfigCode(config: FreeConfig): string {
  return FREE_CODE_PREFIX + encodeFreeConfig(config);
}

/**
 * Free config from pasted text: a `TVT3-` code (any case), a link whose `#s=` holds a v3 payload,
 * or a bare v3 payload. Null when the text is not a free config (it may still be a legacy one).
 */
export function parseFreeConfigInput(input: string): FreeConfig | null {
  const text = input.trim();
  if (text === '' || text.length > MAX_SHARE_LENGTH + 2048) return null;
  let payload: string | null = text;
  if (text.slice(0, FREE_CODE_PREFIX.length).toUpperCase() === FREE_CODE_PREFIX) {
    payload = text.slice(FREE_CODE_PREFIX.length);
  } else if (/^https?:\/\//i.test(text) || text.includes('#')) {
    const at = text.indexOf('#');
    payload = at < 0 ? null : payloadFromHash(text.slice(at));
  }
  if (payload === null) return null;
  const raw = parsePayloadObject(payload);
  return isFreePayload(raw) ? freeConfigFromObject(raw) : null;
}
