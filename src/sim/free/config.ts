import {
  LIMITS,
  MAX_WORK,
  SAMPLING_METHODS,
  clamp,
  defaultConfig,
  num,
  pick,
  triangular,
  type SamplingMethod,
  type ScenarioConfig,
} from '../config.ts';
import { DT } from '../engine.ts';
import type { Triangular } from '../params.ts';
import {
  FREE_SPECIES,
  FREE_SPECIES_IDS,
  buffRanges,
  traitRanges,
  type FreeSpeciesId,
} from './species.ts';
import {
  BUFF_TRAITS,
  BUFF_TRAIT_BOUNDS,
  BUFF_TRAIT_IDS,
  LATCH_TRAIT_IDS,
  NEUTRAL,
  TRAITS,
  TRAIT_BOUNDS,
  TRAIT_IDS,
  fixed,
  type BuffTraitId,
  type TraitId,
} from './traits.ts';

/**
 * Free-model scenario (docs/design/FREE-MATCHUPS.md §2). Two symmetric sides, any species on
 * either, one species per side. The legacy `ScenarioConfig` is untouched; a free config is told
 * apart by `mode: 'free'` (`isFreeConfig`).
 */

export type SideId = 'a' | 'b';
export const SIDE_IDS: readonly SideId[] = ['a', 'b'];

export interface SideConfig {
  species: FreeSpeciesId;
  count: number;
  /** Individual-trait ranges, preset from `species`. Inactive latch traits are neutral. */
  params: Record<TraitId, Triangular>;
  /** Pack-buff ranges; neutral unless the species is social. */
  buff: Record<BuffTraitId, Triangular>;
}

/** The five pack-buff effects, each switchable on its own (design §5.5). */
export const PACK_BUFF_EFFECTS = ['coordinate', 'focus', 'groupLatch', 'morale', 'relief'] as const;
export type PackBuffEffect = (typeof PACK_BUFF_EFFECTS)[number];
export type PackBuffSwitches = Record<PackBuffEffect, boolean>;

/** Sampled model constants shared by both sides (design §4.2, §4.3, §5.4, §5.6). */
export const GLOBAL_IDS = [
  'latchRatio',
  'knockRatio',
  'woundRef',
  'interference',
  'buffGrace',
] as const;
export type GlobalId = (typeof GLOBAL_IDS)[number];

export interface GlobalDef {
  id: GlobalId;
  unit: string;
  step: number;
  /** Design symbol. */
  symbol: string;
  preset: Triangular;
  bounds: readonly [number, number];
}

/** All **S** (assumptions with a sensitivity range); see design §4–§5. */
export const GLOBALS: readonly GlobalDef[] = [
  {
    id: 'latchRatio',
    unit: '×',
    step: 0.1,
    symbol: 'R_latch',
    preset: { min: 2, mode: 3, max: 5 },
    bounds: [1, 20],
  },
  {
    id: 'knockRatio',
    unit: '×',
    step: 0.1,
    symbol: 'K_knock',
    preset: { min: 1.5, mode: 2, max: 4 },
    bounds: [1, 20],
  },
  {
    id: 'woundRef',
    unit: 'HP/HP',
    step: 0.01,
    symbol: 'woundRef',
    preset: { min: 0.05, mode: 0.1, max: 0.2 },
    bounds: [0.01, 1],
  },
  {
    id: 'interference',
    unit: '1/ally',
    step: 0.01,
    symbol: 'interference',
    preset: { min: 0, mode: 0.1, max: 0.3 },
    bounds: [0, 1],
  },
  {
    id: 'buffGrace',
    unit: 's',
    step: 0.1,
    symbol: 'T_grace',
    preset: { min: 0, mode: 2, max: 5 },
    bounds: [0, 30],
  },
];

/**
 * Newest model version (`mv`, ADR-0008) of the free engine in this build. A change that alters
 * any free result raises it, and every version from 1 up to it stays runnable, so a link
 * reproduces under the version it names. Wherever `mv` is absent it means 1.
 */
export const FREE_MODEL_VERSION = 1;

/** Whether `v` is a model version this build runs: an integer from 1 to FREE_MODEL_VERSION. */
export const isFreeModelVersion = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= FREE_MODEL_VERSION;

export interface FreeConfig {
  mode: 'free';
  /** Model version the config runs under (ADR-0008). */
  mv: number;
  sides: [SideConfig, SideConfig];
  packBuff: PackBuffSwitches;
  globals: Record<GlobalId, Triangular>;
  runs: number;
  seed: number;
  arenaSize: number;
  maxTime: number;
  sampling: SamplingMethod;
  individualCV: number;
  /** Morale and fleeing for both sides (design §4.5). */
  morale: boolean;
}

/** Either model's config. Legacy configs carry no `mode`. */
export type AnyConfig = ScenarioConfig | FreeConfig;

export const isFreeConfig = (c: AnyConfig): c is FreeConfig =>
  (c as Partial<FreeConfig>).mode === 'free';

/** Per side 1–5,000; both together at most the legacy maximum 500 + 5,000 (design §7). */
export const FREE_LIMITS = {
  sideCount: [1, 5000],
  totalCount: 5500,
} as const;

/** Default free matchup: one _T. rex_ against one (design §6 presets; mirror allowed). */
export const DEFAULT_FREE_SPECIES: readonly [FreeSpeciesId, FreeSpeciesId] = ['trex', 'trex'];

const isLatchTrait = (k: TraitId): boolean => (LATCH_TRAIT_IDS as readonly string[]).includes(k);

/** Preset side for a species: trait and buff presets, inactive traits neutral. */
export function defaultSide(species: FreeSpeciesId, count = 1): SideConfig {
  return { species, count, params: traitRanges(species), buff: buffRanges(species) };
}

export const defaultPackBuff = (): PackBuffSwitches =>
  Object.fromEntries(PACK_BUFF_EFFECTS.map((e) => [e, true])) as PackBuffSwitches;

export const globalPresets = (): Record<GlobalId, Triangular> =>
  Object.fromEntries(GLOBALS.map((g) => [g.id, { ...g.preset }])) as Record<GlobalId, Triangular>;

export function defaultFreeConfig(): FreeConfig {
  const d = defaultConfig();
  return {
    mode: 'free',
    mv: FREE_MODEL_VERSION,
    sides: [defaultSide(DEFAULT_FREE_SPECIES[0]), defaultSide(DEFAULT_FREE_SPECIES[1])],
    packBuff: defaultPackBuff(),
    globals: globalPresets(),
    runs: d.runs,
    seed: d.seed,
    arenaSize: d.arenaSize,
    maxTime: d.maxTime,
    sampling: d.sampling,
    individualCV: d.individualCV,
    morale: d.morale,
  };
}

/**
 * Cost of a free agent-step relative to a legacy one, for the work budget (design §7). The
 * individual layer costs no more than the legacy engine per agent-step; with an active pack
 * buff (a social side with any effect on) it measured about 1.8–2.4× (docs/PERFORMANCE.md), so
 * such configs count 2.5 agent-steps each and `MAX_WORK` keeps its meaning.
 */
export const FREE_WORK_WEIGHT_BUFF = 2.5;

type WorkInput = Pick<FreeConfig, 'maxTime'> & {
  sides: readonly { count: number; species?: FreeSpeciesId }[];
  packBuff?: PackBuffSwitches;
};

export function freeWorkWeight(c: WorkInput): number {
  const sw = c.packBuff;
  if (!sw || !PACK_BUFF_EFFECTS.some((e) => sw[e])) return 1;
  const social = c.sides.some((s) => s.species !== undefined && FREE_SPECIES[s.species].social);
  return social ? FREE_WORK_WEIGHT_BUFF : 1;
}

/** Weighted agent-steps of a free batch, the same measure as the legacy `workEstimate`. */
export function freeWorkEstimate(c: WorkInput & Pick<FreeConfig, 'runs'>): number {
  return c.runs * Math.round(c.maxTime / DT) * totalCount(c.sides) * freeWorkWeight(c);
}

/** Largest run count that keeps `freeWorkEstimate` within MAX_WORK (at least 1). */
export function freeMaxRunsFor(c: WorkInput): number {
  const perRun = Math.round(c.maxTime / DT) * totalCount(c.sides) * freeWorkWeight(c);
  return Math.max(1, Math.min(LIMITS.runs[1], Math.floor(MAX_WORK / perRun)));
}

const totalCount = (sides: readonly { count: number }[]): number =>
  sides.reduce((s, x) => s + x.count, 0);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const record = (v: unknown): Record<string, unknown> => (isObject(v) ? v : {});

/** One side from untrusted input; `count` is clamped per side here and for the total later. */
function sanitizeSide(input: unknown, fallbackSpecies: FreeSpeciesId): SideConfig {
  const o = record(input);
  const species = pick(o['species'], FREE_SPECIES_IDS, fallbackSpecies);
  const s = FREE_SPECIES[species];
  const side = defaultSide(species);
  side.count = num(o['count'], 1, FREE_LIMITS.sideCount, true);
  const rawParams = record(o['params']);
  for (const k of TRAIT_IDS) {
    // Inactive traits stay neutral whatever the input says: the engine never reads them.
    if (!s.canLatch && isLatchTrait(k)) {
      side.params[k] = fixed(NEUTRAL[k as keyof typeof NEUTRAL]);
      continue;
    }
    if (Object.hasOwn(rawParams, k)) {
      side.params[k] = triangular(rawParams[k], side.params[k], TRAIT_BOUNDS[k]);
    }
  }
  const rawBuff = record(o['buff']);
  for (const k of BUFF_TRAIT_IDS) {
    if (!s.social) {
      side.buff[k] = fixed(NEUTRAL[k]);
      continue;
    }
    if (Object.hasOwn(rawBuff, k)) {
      side.buff[k] = triangular(rawBuff[k], side.buff[k], BUFF_TRAIT_BOUNDS[k]);
    }
  }
  return side;
}

/**
 * Validate untrusted input into a safe free config, like `sanitizeConfig`: unknown keys dropped,
 * numbers clamped, invalid values replaced by defaults. Never throws.
 */
export function sanitizeFreeConfig(input: unknown): FreeConfig {
  const d = defaultFreeConfig();
  const o = record(input);
  const rawSides = Array.isArray(o['sides']) ? (o['sides'] as unknown[]) : [];
  const a = sanitizeSide(rawSides[0], DEFAULT_FREE_SPECIES[0]);
  const b = sanitizeSide(rawSides[1], DEFAULT_FREE_SPECIES[1]);
  // Total cap: side B gives way, so side A's count is always what was asked for.
  b.count = clamp(b.count, FREE_LIMITS.sideCount[0], FREE_LIMITS.totalCount - a.count);

  const rawBuff = record(o['packBuff']);
  const packBuff = defaultPackBuff();
  for (const e of PACK_BUFF_EFFECTS) {
    if (typeof rawBuff[e] === 'boolean') packBuff[e] = rawBuff[e];
  }

  const rawGlobals = record(o['globals']);
  const globals = globalPresets();
  for (const g of GLOBALS) {
    if (Object.hasOwn(rawGlobals, g.id)) {
      globals[g.id] = triangular(rawGlobals[g.id], globals[g.id], g.bounds);
    }
  }

  const maxTime = Math.round(num(o['maxTime'], d.maxTime, LIMITS.maxTime, false) / DT) * DT;
  const sides: [SideConfig, SideConfig] = [a, b];
  const runs = Math.min(
    num(o['runs'], d.runs, LIMITS.runs, true),
    freeMaxRunsFor({ maxTime, sides, packBuff }),
  );
  return {
    mode: 'free',
    // Absent means 1 (ADR-0008), so inputs written before `mv` existed keep running model 1.
    mv: isFreeModelVersion(o['mv']) ? o['mv'] : 1,
    sides,
    packBuff,
    globals,
    runs,
    seed: num(o['seed'], d.seed, LIMITS.seed, true) >>> 0,
    arenaSize: num(o['arenaSize'], d.arenaSize, LIMITS.arenaSize, false),
    maxTime,
    sampling: pick(o['sampling'], SAMPLING_METHODS, d.sampling),
    individualCV: num(o['individualCV'], d.individualCV, LIMITS.individualCV, false),
    morale: typeof o['morale'] === 'boolean' ? o['morale'] : d.morale,
  };
}

// --- design ---

export type FreeParamKind = 'trait' | 'buff' | 'global';

/** One column of the free design matrix. */
export interface FreeParam {
  /** `a.mass`, `b.cohesionRadius`, `g.latchRatio`. */
  key: string;
  kind: FreeParamKind;
  side: SideId | null;
  id: TraitId | BuffTraitId | GlobalId;
  /** Per-agent variation applies (individual traits only). */
  individual: boolean;
}

/**
 * Column layout (design §2.2): side A traits, side A buff traits, side B traits, side B buff
 * traits, then the globals. It depends only on the trait lists, never on the species.
 */
export const FREE_PARAMS: readonly FreeParam[] = [
  ...SIDE_IDS.flatMap((side): FreeParam[] => [
    ...TRAITS.map((t) => ({
      key: `${side}.${t.id}`,
      kind: 'trait' as const,
      side,
      id: t.id,
      individual: t.individual,
    })),
    ...BUFF_TRAITS.map((t) => ({
      key: `${side}.${t.id}`,
      kind: 'buff' as const,
      side,
      id: t.id,
      individual: false,
    })),
  ]),
  ...GLOBALS.map((g) => ({
    key: `g.${g.id}`,
    kind: 'global' as const,
    side: null,
    id: g.id,
    individual: false,
  })),
];

/** Column index of a key in FREE_PARAMS. */
export const FREE_PARAM_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  FREE_PARAMS.map((p, i) => [p.key, i]),
);

/** The ranges of a free config in FREE_PARAMS order. */
export function freeRanges(c: FreeConfig): Triangular[] {
  return FREE_PARAMS.map((p) => {
    if (p.kind === 'global') return c.globals[p.id as GlobalId];
    const side = c.sides[p.side === 'a' ? 0 : 1];
    return p.kind === 'trait' ? side.params[p.id as TraitId] : side.buff[p.id as BuffTraitId];
  });
}
