import { LIMITS, type ScenarioConfig } from '../sim/config.ts';
import type { FreeAggregate } from '../sim/free/aggregate.ts';
import type { FreeConfig } from '../sim/free/config.ts';
import { FREE_SPECIES } from '../sim/free/species.ts';
import { sideBuffState, type FreeSideIndex } from '../ui/free-form-model.ts';
import { base64UrlDecode, base64UrlEncode } from '../ui/share.ts';
import {
  freeConfigDiff,
  freeConfigFromObject,
  hashFromFreeConfig,
  isFreePayload,
} from '../ui/share-free.ts';
import {
  CHECK_KEY,
  MAX_RESULT_LENGTH,
  RESULT_KEY,
  decodeResult,
  type ResultError,
  type ResultSummary,
} from './result-codec.ts';

/*
 * Result links of free matchups (docs/SHARING.md#free-result-links, design §2.5):
 * `/r/?r=<base64url(JSON {v: 2, c, s})>` where `c` is the v3 config payload (`m: "free"`) and `s`
 * a per-side snapshot. Version 1 links (classic, src/share/result-codec.ts) are untouched: they
 * are decoded by the very same `decodeResult`, so they stay bit-compatible. Pure and DOM-free;
 * it imports the config schema, never the simulator (tests/result-share.test.ts guards that).
 */

/** Format version of a free result payload (`v`). Classic results stay at RESULT_VERSION 1. */
export const FREE_RESULT_VERSION = 2;

type Tuple6 = [number, number, number, number, number, number];

/**
 * Snapshot of a free aggregate. Counts are integers with `a + b + d === n` (side A wins, side B
 * wins, draws). Per side (prefix `a`/`b`), all optional means: `as`/`bs` survivors, `ak`/`bk`
 * incapacitated, `ar`/`br` fled; and, only for a side whose pack buff applies (a social species,
 * two or more animals, any effect on), `ab`/`bb` the buffed share of agent-time and `at`/`bt` the
 * median seconds with at least one buffed member. `ci` holds the 95 % Wilson intervals
 * `[aLo, aHi, bLo, bHi, dLo, dHi]`.
 */
export interface FreeResultSummary {
  n: number;
  a: number;
  b: number;
  d: number;
  t?: number;
  as?: number;
  bs?: number;
  ak?: number;
  bk?: number;
  ar?: number;
  br?: number;
  ab?: number;
  bb?: number;
  at?: number;
  bt?: number;
  ci?: Tuple6;
}

type SideKey = 's' | 'k' | 'r' | 'b' | 't';
const sideField = (i: FreeSideIndex, k: SideKey): keyof FreeResultSummary =>
  `${i === 0 ? 'a' : 'b'}${k}` as keyof FreeResultSummary;

const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Whether side `i`'s pack buff applies in `config` (the snapshot then carries its buff time). */
export function buffApplies(config: FreeConfig, i: FreeSideIndex): boolean {
  return sideBuffState(config, i, FREE_SPECIES[config.sides[i].species].social) === 'active';
}

/** Compact snapshot of a free aggregate; non-finite means are left out. */
export function summarizeFree(config: FreeConfig, agg: FreeAggregate): FreeResultSummary {
  const s: FreeResultSummary = { n: agg.n, a: agg.aWins, b: agg.bWins, d: agg.draws };
  const put = (k: keyof FreeResultSummary, v: number, digits: number): void => {
    if (Number.isFinite(v)) (s as unknown as Record<string, number>)[k] = round(v, digits);
  };
  put('t', agg.duration.mean, 1);
  for (const i of [0, 1] as const) {
    const side = i === 0 ? agg.a : agg.b;
    put(sideField(i, 's'), side.survivors, 2);
    put(sideField(i, 'k'), side.killed, 1);
    put(sideField(i, 'r'), side.routed, 1);
    if (buffApplies(config, i)) {
      const buff = i === 0 ? agg.buffA : agg.buffB;
      put(sideField(i, 'b'), Math.min(1, Math.max(0, buff.mean.activeFrac)), 3);
      put(sideField(i, 't'), buff.anyTimeMedian, 1);
    }
  }
  const iv = [agg.pA, agg.pB, agg.pDraw].flatMap((x) => [x.lo, x.hi]);
  if (iv.every(Number.isFinite)) {
    s.ci = iv.map((x) => round(Math.min(1, Math.max(0, x)), 4)) as Tuple6;
  }
  return s;
}

/** The `r` value of a free result link. */
export function encodeFreeResult(config: FreeConfig, summary: FreeResultSummary): string {
  const body = { v: FREE_RESULT_VERSION, c: freeConfigDiff(config), s: summary };
  return base64UrlEncode(JSON.stringify(body));
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

const isIn = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const BASE_KEYS = ['n', 'a', 'b', 'd', 't', 'ci'];

/**
 * Strictly validate a free summary against its config: only known keys; integer counts with
 * `1 ≤ n ≤ LIMITS.runs[1]` and `a + b + d === n`; per-side means within that side's `count`;
 * buff fields only for a side whose buff applies, the share in [0, 1] and the time within the
 * longest battle; six interval ends in [0, 1] with lo ≤ hi. Returns null on any violation.
 */
export function validateFreeSummary(raw: unknown, config: FreeConfig): FreeResultSummary | null {
  if (!isPlainObject(raw)) return null;
  const allowed = new Set(BASE_KEYS);
  for (const i of [0, 1] as const) {
    for (const k of ['s', 'k', 'r'] as const) allowed.add(sideField(i, k));
    if (buffApplies(config, i)) for (const k of ['b', 't'] as const) allowed.add(sideField(i, k));
  }
  for (const k of Object.keys(raw)) if (!allowed.has(k)) return null;
  const { n, a, b, d } = raw;
  if (!isCount(n, LIMITS.runs[1]) || n < 1) return null;
  if (!isCount(a, n) || !isCount(b, n) || !isCount(d, n) || a + b + d !== n) return null;
  const s: FreeResultSummary = { n, a, b, d };
  const out = s as unknown as Record<string, unknown>;
  const maxTime = LIMITS.maxTime[1];
  if ('t' in raw) {
    if (!isIn(raw['t'], 0, maxTime)) return null;
    s.t = raw['t'];
  }
  for (const i of [0, 1] as const) {
    const count = config.sides[i].count;
    const bounds: Record<SideKey, number> = { s: count, k: count, r: count, b: 1, t: maxTime };
    for (const k of ['s', 'k', 'r', 'b', 't'] as const) {
      const key = sideField(i, k);
      if (!(key in raw)) continue;
      if (!isIn(raw[key], 0, bounds[k])) return null;
      out[key] = raw[key];
    }
  }
  if ('ci' in raw) {
    const ci = raw['ci'];
    if (!Array.isArray(ci) || ci.length !== 6 || !ci.every((x) => isIn(x, 0, 1))) return null;
    const v = ci;
    for (let j = 0; j < 6; j += 2) if ((v[j] as number) > (v[j + 1] as number)) return null;
    s.ci = [v[0], v[1], v[2], v[3], v[4], v[5]] as Tuple6;
  }
  return s;
}

/** A decoded result link of either model. */
export type AnyDecodedResult =
  | { ok: true; kind: 'classic'; config: ScenarioConfig; summary: ResultSummary }
  | { ok: true; kind: 'free'; config: FreeConfig; summary: FreeResultSummary }
  | { ok: false; error: ResultError; config: ScenarioConfig | FreeConfig | null };

/**
 * Decode and validate an `r` value of either version. A `c` holding a free (v3) payload goes the
 * free way and needs `v: 2`; everything else is handed to the classic `decodeResult` unchanged,
 * so classic (v1) links decode exactly as before.
 */
export function decodeAnyResult(r: string | null): AnyDecodedResult {
  const classic = (): AnyDecodedResult => {
    const res = decodeResult(r);
    return res.ok ? { ...res, kind: 'classic' } : res;
  };
  if (r === null || r === '' || r.length > MAX_RESULT_LENGTH) return classic();
  if (!/^[A-Za-z0-9_-]+$/.test(r)) return classic();
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(r));
  } catch {
    return classic();
  }
  if (!isPlainObject(parsed)) return classic();
  const c = parsed['c'];
  if (!isFreePayload(c)) return classic();
  const config = freeConfigFromObject(c);
  if (parsed['v'] !== FREE_RESULT_VERSION) return { ok: false, error: 'version', config };
  const summary = validateFreeSummary(parsed['s'], config);
  if (!summary) return { ok: false, error: 'summary', config };
  return { ok: true, kind: 'free', config, summary };
}

/** Decode the result of a query string (`?r=…`), either version. */
export function decodeAnyResultQuery(search: string): AnyDecodedResult {
  if (search.length > MAX_RESULT_LENGTH + 64) return { ok: false, error: 'length', config: null };
  return decodeAnyResult(new URLSearchParams(search).get(RESULT_KEY));
}

/** Simulator fragment for "run it yourself" of a free result: `#s=<v3>&chk=<summary>`. */
export function reproduceFreeHash(config: FreeConfig, summary: FreeResultSummary): string {
  return `${hashFromFreeConfig(config)}&${CHECK_KEY}=${base64UrlEncode(JSON.stringify(summary))}`;
}

/** The shared free summary in a simulator fragment (`chk=`), validated against `config`. */
export function freeCheckFromHash(hash: string, config: FreeConfig): FreeResultSummary | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of h.split('&')) {
    if (!part.startsWith(`${CHECK_KEY}=`)) continue;
    const value = part.slice(CHECK_KEY.length + 1);
    if (value.length > MAX_RESULT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    try {
      return validateFreeSummary(JSON.parse(base64UrlDecode(value)), config);
    } catch {
      return null;
    }
  }
  return null;
}
