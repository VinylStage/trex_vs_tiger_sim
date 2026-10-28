import { DT } from './engine.ts';
import { PARAMS, type ParamId, type Triangular } from './params.ts';
import {
  DEFAULT_HEAVY,
  DEFAULT_PACK,
  HEAVY_SPECIES_IDS,
  PACK_SPECIES_IDS,
  paramBounds,
  speciesRanges,
  type HeavySpeciesId,
  type PackSpeciesId,
} from './species.ts';

export type SamplingMethod = 'lhs' | 'random';
export type PackTactic = 'flank' | 'direct';

export interface ScenarioConfig {
  /** Species on the heavy side (src/sim/species.ts). */
  heavySpecies: HeavySpeciesId;
  /** Species on the pack side. */
  packSpecies: PackSpeciesId;
  heavyCount: number;
  packCount: number;
  runs: number;
  seed: number;
  arenaSize: number;
  maxTime: number;
  sampling: SamplingMethod;
  individualCV: number;
  packTactic: PackTactic;
  morale: boolean;
  params: Record<ParamId, Triangular>;
}

export const LIMITS = {
  heavyCount: [1, 500],
  packCount: [1, 5000],
  runs: [1, 20000],
  seed: [0, 0xffffffff],
  arenaSize: [100, 5000],
  maxTime: [30, 3600],
  individualCV: [0, 0.3],
} as const satisfies Record<string, readonly [number, number]>;

export const SAMPLING_METHODS: readonly SamplingMethod[] = ['lhs', 'random'];
export const PACK_TACTICS: readonly PackTactic[] = ['flank', 'direct'];

export function defaultConfig(): ScenarioConfig {
  return {
    heavySpecies: DEFAULT_HEAVY,
    packSpecies: DEFAULT_PACK,
    heavyCount: 10,
    packCount: 100,
    runs: 500,
    seed: 20261019,
    arenaSize: 600,
    maxTime: 1200,
    sampling: 'lhs',
    individualCV: 0.08,
    packTactic: 'flank',
    morale: true,
    params: speciesRanges(DEFAULT_HEAVY, DEFAULT_PACK),
  };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Only JSON numbers are accepted; strings, booleans etc. fall back to the default. */
export function num(
  v: unknown,
  fallback: number,
  [lo, hi]: readonly [number, number],
  int: boolean,
) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return clamp(int ? Math.round(v) : v, lo, hi);
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function triangular(v: unknown, fallback: Triangular, bounds: readonly [number, number]) {
  if (typeof v !== 'object' || v === null) return { ...fallback };
  const o = v as Record<string, unknown>;
  const raw = [o['min'], o['mode'], o['max']];
  // A partial range cannot be merged meaningfully with the default triangle; reject it whole.
  if (!raw.every(isFiniteNumber)) return { ...fallback };
  const vals = raw.map((x) => clamp(x, bounds[0], bounds[1])).sort((a, b) => a - b) as [
    number,
    number,
    number,
  ];
  return { min: vals[0], mode: vals[1], max: vals[2] };
}

/**
 * Upper bound on simulated agent-steps per Monte Carlo batch:
 * runs × (maxTime / DT) × (heavyCount + packCount). Keeps a shared link from requesting
 * an effectively unbounded amount of CPU; `runs` is lowered to fit.
 */
export const MAX_WORK = 5e10;

export function workEstimate(
  c: Pick<ScenarioConfig, 'runs' | 'maxTime' | 'heavyCount' | 'packCount'>,
): number {
  return c.runs * Math.round(c.maxTime / DT) * (c.heavyCount + c.packCount);
}

/** Largest run count that keeps `workEstimate` within MAX_WORK (at least 1). */
export function maxRunsFor(
  c: Pick<ScenarioConfig, 'maxTime' | 'heavyCount' | 'packCount'>,
): number {
  const perRun = Math.round(c.maxTime / DT) * (c.heavyCount + c.packCount);
  return Math.max(1, Math.min(LIMITS.runs[1], Math.floor(MAX_WORK / perRun)));
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
  // Unknown species fall back to the defaults; missing params come from the selected species.
  const heavySpecies = pick(o['heavySpecies'], HEAVY_SPECIES_IDS, d.heavySpecies);
  const packSpecies = pick(o['packSpecies'], PACK_SPECIES_IDS, d.packSpecies);
  const params = speciesRanges(heavySpecies, packSpecies);
  for (const p of PARAMS) {
    if (Object.hasOwn(rawParams, p.id)) {
      const bounds = paramBounds(p.id, heavySpecies, packSpecies);
      params[p.id] = triangular(rawParams[p.id], params[p.id], bounds);
    }
  }
  const heavyCount = num(o['heavyCount'], d.heavyCount, LIMITS.heavyCount, true);
  const packCount = num(o['packCount'], d.packCount, LIMITS.packCount, true);
  const maxTime = Math.round(num(o['maxTime'], d.maxTime, LIMITS.maxTime, false) / DT) * DT;
  const runs = Math.min(
    num(o['runs'], d.runs, LIMITS.runs, true),
    maxRunsFor({ maxTime, heavyCount, packCount }),
  );
  return {
    heavySpecies,
    packSpecies,
    heavyCount,
    packCount,
    runs,
    seed: num(o['seed'], d.seed, LIMITS.seed, true) >>> 0,
    arenaSize: num(o['arenaSize'], d.arenaSize, LIMITS.arenaSize, false),
    maxTime,
    sampling: pick(o['sampling'], SAMPLING_METHODS, d.sampling),
    individualCV: num(o['individualCV'], d.individualCV, LIMITS.individualCV, false),
    packTactic: pick(o['packTactic'], PACK_TACTICS, d.packTactic),
    morale: typeof o['morale'] === 'boolean' ? o['morale'] : d.morale,
    params,
  };
}
