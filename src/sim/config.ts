import { PARAMS, defaultParamRanges, type ParamId, type Triangular } from './params';

export type SamplingMethod = 'lhs' | 'random';
export type TigerTactic = 'flank' | 'direct';

export interface ScenarioConfig {
  trexCount: number;
  tigerCount: number;
  runs: number;
  seed: number;
  arenaSize: number;
  maxTime: number;
  sampling: SamplingMethod;
  individualCV: number;
  tigerTactic: TigerTactic;
  morale: boolean;
  params: Record<ParamId, Triangular>;
}

export const LIMITS = {
  trexCount: [1, 500],
  tigerCount: [1, 5000],
  runs: [1, 20000],
  seed: [0, 0xffffffff],
  arenaSize: [100, 5000],
  maxTime: [30, 3600],
  individualCV: [0, 0.3],
} as const satisfies Record<string, readonly [number, number]>;

export const SAMPLING_METHODS: readonly SamplingMethod[] = ['lhs', 'random'];
export const TIGER_TACTICS: readonly TigerTactic[] = ['flank', 'direct'];

export function defaultConfig(): ScenarioConfig {
  return {
    trexCount: 10,
    tigerCount: 100,
    runs: 500,
    seed: 20261019,
    arenaSize: 600,
    maxTime: 1200,
    sampling: 'lhs',
    individualCV: 0.08,
    tigerTactic: 'flank',
    morale: true,
    params: defaultParamRanges(),
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function num(v: unknown, fallback: number, [lo, hi]: readonly [number, number], int: boolean) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return clamp(int ? Math.round(n) : n, lo, hi);
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function triangular(v: unknown, fallback: Triangular, bounds: readonly [number, number]) {
  if (typeof v !== 'object' || v === null) return { ...fallback };
  const o = v as Record<string, unknown>;
  const vals = [
    num(o['min'], fallback.min, bounds, false),
    num(o['mode'], fallback.mode, bounds, false),
    num(o['max'], fallback.max, bounds, false),
  ].sort((a, b) => a - b) as [number, number, number];
  return { min: vals[0], mode: vals[1], max: vals[2] };
}

/**
 * Validate untrusted input (e.g. from the URL) into a safe config.
 * Unknown keys are dropped, numbers are clamped, invalid values fall back to defaults.
 */
export function sanitizeConfig(input: unknown): ScenarioConfig {
  const d = defaultConfig();
  if (typeof input !== 'object' || input === null) return d;
  const o = input as Record<string, unknown>;
  const rawParams =
    typeof o['params'] === 'object' && o['params'] !== null
      ? (o['params'] as Record<string, unknown>)
      : {};
  const params = { ...d.params };
  for (const p of PARAMS) {
    if (Object.hasOwn(rawParams, p.id)) {
      params[p.id] = triangular(rawParams[p.id], d.params[p.id], p.bounds);
    }
  }
  return {
    trexCount: num(o['trexCount'], d.trexCount, LIMITS.trexCount, true),
    tigerCount: num(o['tigerCount'], d.tigerCount, LIMITS.tigerCount, true),
    runs: num(o['runs'], d.runs, LIMITS.runs, true),
    seed: num(o['seed'], d.seed, LIMITS.seed, true) >>> 0,
    arenaSize: num(o['arenaSize'], d.arenaSize, LIMITS.arenaSize, false),
    maxTime: num(o['maxTime'], d.maxTime, LIMITS.maxTime, false),
    sampling: pick(o['sampling'], SAMPLING_METHODS, d.sampling),
    individualCV: num(o['individualCV'], d.individualCV, LIMITS.individualCV, false),
    tigerTactic: pick(o['tigerTactic'], TIGER_TACTICS, d.tigerTactic),
    morale: typeof o['morale'] === 'boolean' ? o['morale'] : d.morale,
    params,
  };
}
