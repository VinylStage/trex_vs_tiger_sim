import { LIMITS, type ScenarioConfig } from '../sim/config.ts';
import {
  base64UrlDecode,
  base64UrlEncode,
  configDiff,
  configFromObject,
  encodeConfig,
  SHARE_VERSION,
} from '../ui/share.ts';

/*
 * Result share links (docs/SHARING.md#result-links): `/r/?r=<base64url(JSON {v, c, s})>`.
 * `c` is the config diff (as in `#s=`, with `v: 2`) and `s` a compact snapshot of the aggregate.
 * Pure and DOM-free: the result page, the main app and the Pages Function
 * (functions/r/[[path]].ts) all decode links with this module, so they accept exactly the same
 * input. It imports only the config schema, never the simulator.
 */

/** Format version of the result payload (`v`). */
export const RESULT_VERSION = 1;
/** Query key: `/r/?r=…`. */
export const RESULT_KEY = 'r';
/** Longest accepted `r` value (characters). Typical links are 150–600. */
export const MAX_RESULT_LENGTH = 4096;

/**
 * Snapshot of an aggregate. Counts are integers with `h + p + d === n`. Optional means:
 * `t` battle duration (s), `hs` heavy survivors, `pk` pack animals incapacitated. `ci` holds the
 * 95 % Wilson intervals `[hLo, hHi, pLo, pHi, dLo, dHi]` as fractions.
 */
export interface ResultSummary {
  n: number;
  h: number;
  p: number;
  d: number;
  t?: number;
  hs?: number;
  pk?: number;
  ci?: Tuple6;
}

/** The parts of an aggregate a summary is built from (`AggregateResult` fits). */
export interface AggregateLike {
  n: number;
  heavyWins: number;
  packWins: number;
  draws: number;
  pHeavy: { lo: number; hi: number };
  pPack: { lo: number; hi: number };
  pDraw: { lo: number; hi: number };
  duration: { mean: number };
  heavySurvivors: { mean: number };
  packKilled: { mean: number };
}

type Tuple6 = [number, number, number, number, number, number];
const tuple6 = (v: readonly number[]): Tuple6 =>
  [v[0], v[1], v[2], v[3], v[4], v[5]].map((x) => x ?? 0) as Tuple6;

const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Compact summary of an aggregate; non-finite means are left out. */
export function summarize(agg: AggregateLike): ResultSummary {
  const s: ResultSummary = { n: agg.n, h: agg.heavyWins, p: agg.packWins, d: agg.draws };
  if (Number.isFinite(agg.duration.mean)) s.t = round(agg.duration.mean, 1);
  if (Number.isFinite(agg.heavySurvivors.mean)) s.hs = round(agg.heavySurvivors.mean, 2);
  if (Number.isFinite(agg.packKilled.mean)) s.pk = round(agg.packKilled.mean, 1);
  const iv = [agg.pHeavy, agg.pPack, agg.pDraw].flatMap((x) => [x.lo, x.hi]);
  if (iv.every(Number.isFinite)) {
    s.ci = tuple6(iv.map((x) => round(Math.min(1, Math.max(0, x)), 4)));
  }
  return s;
}

/** The `r` value of a result link. */
export function encodeResult(config: ScenarioConfig, summary: ResultSummary): string {
  const body = { v: RESULT_VERSION, c: { v: SHARE_VERSION, ...configDiff(config) }, s: summary };
  return base64UrlEncode(JSON.stringify(body));
}

/** Root-relative result page path with its query (`/r/?r=…`, `/en/r/?r=…`). */
export function resultPath(lang: 'ko' | 'en', r: string): string {
  return `${lang === 'en' ? '/en' : ''}/r/?${RESULT_KEY}=${r}`;
}

export type ResultError =
  'missing' | 'length' | 'alphabet' | 'json' | 'shape' | 'version' | 'config' | 'summary';

export type DecodedResult =
  | { ok: true; config: ScenarioConfig; summary: ResultSummary }
  | { ok: false; error: ResultError; config: ScenarioConfig | null };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

const isIn = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const SUMMARY_KEYS = new Set(['n', 'h', 'p', 'd', 't', 'hs', 'pk', 'ci']);

/**
 * Strictly validate a summary object against its config: only known keys; integer counts with
 * `1 ≤ n ≤ LIMITS.runs[1]` and `h + p + d === n`; finite optional means within the config's
 * bounds; six interval ends in [0, 1] with lo ≤ hi. Returns null on any violation.
 */
export function validateSummary(raw: unknown, config: ScenarioConfig): ResultSummary | null {
  if (!isPlainObject(raw)) return null;
  for (const k of Object.keys(raw)) if (!SUMMARY_KEYS.has(k)) return null;
  const { n, h, p, d } = raw;
  const maxRuns = LIMITS.runs[1];
  if (!isCount(n, maxRuns) || n < 1) return null;
  if (!isCount(h, n) || !isCount(p, n) || !isCount(d, n) || h + p + d !== n) return null;
  const s: ResultSummary = { n, h, p, d };
  if ('t' in raw) {
    if (!isIn(raw['t'], 0, LIMITS.maxTime[1])) return null;
    s.t = raw['t'];
  }
  if ('hs' in raw) {
    if (!isIn(raw['hs'], 0, config.heavyCount)) return null;
    s.hs = raw['hs'];
  }
  if ('pk' in raw) {
    if (!isIn(raw['pk'], 0, config.packCount)) return null;
    s.pk = raw['pk'];
  }
  if ('ci' in raw) {
    const ci = raw['ci'];
    if (!Array.isArray(ci) || ci.length !== 6 || !ci.every((x) => isIn(x, 0, 1))) return null;
    const v = ci;
    for (let i = 0; i < 6; i += 2) if ((v[i] as number) > (v[i + 1] as number)) return null;
    s.ci = tuple6(v);
  }
  return s;
}

/** Decode and validate an `r` value. On failure, `config` is set when `c` alone was valid. */
export function decodeResult(r: string | null): DecodedResult {
  if (r === null || r === '') return { ok: false, error: 'missing', config: null };
  if (r.length > MAX_RESULT_LENGTH) return { ok: false, error: 'length', config: null };
  if (!/^[A-Za-z0-9_-]+$/.test(r)) return { ok: false, error: 'alphabet', config: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(r));
  } catch {
    return { ok: false, error: 'json', config: null };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'shape', config: null };
  const c = parsed['c'];
  const config = isPlainObject(c) ? configFromObject(c) : null;
  if (parsed['v'] !== RESULT_VERSION) return { ok: false, error: 'version', config };
  if (!config) return { ok: false, error: 'config', config: null };
  const summary = validateSummary(parsed['s'], config);
  if (!summary) return { ok: false, error: 'summary', config };
  return { ok: true, config, summary };
}

/** Hash key of the reproduction check: `/#s=<config>&chk=<summary>`. */
export const CHECK_KEY = 'chk';

/**
 * Simulator fragment for "run it yourself": the config as `s=` (left out for the defaults) and
 * the shared summary as `chk=`, so the app can report whether its run reproduces the snapshot.
 */
export function reproduceHash(config: ScenarioConfig, summary: ResultSummary): string {
  const payload = encodeConfig(config);
  const chk = `${CHECK_KEY}=${base64UrlEncode(JSON.stringify(summary))}`;
  return payload ? `#s=${payload}&${chk}` : `#${chk}`;
}

/** The shared summary in a simulator fragment (`chk=`), validated against `config`, or null. */
export function checkFromHash(hash: string, config: ScenarioConfig): ResultSummary | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of h.split('&')) {
    if (!part.startsWith(`${CHECK_KEY}=`)) continue;
    const value = part.slice(CHECK_KEY.length + 1);
    if (value.length > MAX_RESULT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    try {
      return validateSummary(JSON.parse(base64UrlDecode(value)), config);
    } catch {
      return null;
    }
  }
  return null;
}

/** Decode the result of a query string (`?r=…`). Oversized queries are rejected unparsed. */
export function decodeResultQuery(search: string): DecodedResult {
  if (search.length > MAX_RESULT_LENGTH + 64) return { ok: false, error: 'length', config: null };
  return decodeResult(new URLSearchParams(search).get(RESULT_KEY));
}
