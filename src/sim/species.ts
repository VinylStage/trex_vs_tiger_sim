import { PARAMS, type ParamId, type Role, type Triangular } from './params.ts';

/**
 * Species registry (docs/SPECIES.md). Every species fills one role with presets for that role's
 * eleven parameters, its own hard bounds and a few non-sampled constants.
 *
 * Compatibility rules (docs/SPECIES.md §6):
 * - T. rex and tiger carry exactly the v1 ranges and bounds, so every v1 share link reproduces
 *   bit-identically.
 * - Species constants consume no random numbers, and their T. rex/tiger values are exact
 *   identities (`hide` = 1, `radius` = 0.8 m, the former engine constant).
 */

export const HEAVY_KEYS = [
  'mass',
  'speed',
  'turnRate',
  'biteForce',
  'biteLethality',
  'biteInterval',
  'biteReach',
  'biteArc',
  'biteAccuracy',
  'shakeRate',
  'bodyRadius',
] as const;
export const PACK_KEYS = [
  'mass',
  'sprintSpeed',
  'cruiseSpeed',
  'sprintEndurance',
  'latchEndurance',
  'recoveryTime',
  'latchChance',
  'dps',
  'bleed',
  'morale',
  'moraleLoss',
] as const;
export type HeavyKey = (typeof HEAVY_KEYS)[number];
export type PackKey = (typeof PACK_KEYS)[number];

export const HEAVY_SPECIES_IDS = ['trex', 'elephant', 'buffalo', 'brownBear'] as const;
export const PACK_SPECIES_IDS = ['tiger', 'lion', 'wolf', 'hyena'] as const;
export type HeavySpeciesId = (typeof HEAVY_SPECIES_IDS)[number];
export type PackSpeciesId = (typeof PACK_SPECIES_IDS)[number];
export type SpeciesId = HeavySpeciesId | PackSpeciesId;

export const DEFAULT_HEAVY: HeavySpeciesId = 'trex';
export const DEFAULT_PACK: PackSpeciesId = 'tiger';

/**
 * Evidence tag of a preset value (docs/SPECIES.md §3): L literature, D derived from literature
 * with a stated formula, S speculative, U unverified popular figure.
 */
export type Evidence = 'L' | 'D' | 'S' | 'U';
export const EVIDENCE: readonly Evidence[] = ['L', 'D', 'S', 'U'];

/** Geological time in millions of years ago (`toMa` the later end), or alive today. */
export type Era = { readonly fromMa: number; readonly toMa: number } | 'extant';

/** What the heavy's `biteForce` family of parameters stands for. */
export type Weapon = 'bite' | 'tusk' | 'horn' | 'pawBite';

/** A preset row: [min, mode, max, evidence]. */
type Row = readonly [number, number, number, Evidence];

interface SpeciesBase<K extends string> {
  readonly era: Era;
  readonly ranges: Readonly<Record<K, Triangular>>;
  readonly evidence: Readonly<Record<K, Evidence>>;
  readonly bounds: Readonly<Record<K, readonly [number, number]>>;
}

export interface HeavySpecies extends SpeciesBase<HeavyKey> {
  readonly id: HeavySpeciesId;
  readonly role: 'heavy';
  readonly weapon: Weapon;
  readonly constants: {
    /** Multiplier on pack damage taken (thick skin, fat, fur). 1 = none. */
    readonly hide: number;
  };
}

export interface PackSpecies extends SpeciesBase<PackKey> {
  readonly id: PackSpeciesId;
  readonly role: 'pack';
  readonly constants: {
    /** Body contact radius (m): latch distance, bite reach padding and glyph size. */
    readonly radius: number;
  };
}

// --- bounds ---

/** v1 hard bounds, kept exactly for T. rex. */
const HEAVY_V1_BOUNDS: Readonly<Record<HeavyKey, readonly [number, number]>> = {
  mass: [1000, 20000],
  speed: [0.5, 25],
  turnRate: [5, 360],
  biteForce: [1, 150],
  biteLethality: [0.1, 100],
  biteInterval: [0.2, 30],
  biteReach: [1, 15],
  biteArc: [5, 180],
  biteAccuracy: [0, 1],
  shakeRate: [0, 10],
  bodyRadius: [0.5, 8],
};

/** v1 hard bounds, kept exactly for the tiger. */
const PACK_V1_BOUNDS: Readonly<Record<PackKey, readonly [number, number]>> = {
  mass: [30, 500],
  sprintSpeed: [2, 35],
  cruiseSpeed: [0.5, 20],
  sprintEndurance: [1, 600],
  latchEndurance: [1, 1200],
  recoveryTime: [1, 3600],
  latchChance: [0, 1],
  dps: [0, 200],
  bleed: [0, 0.1],
  morale: [0, 1],
  moraleLoss: [0, 1],
};

/** Bounds for every other species: the v1 bounds widened where a species needs it (§3.1). */
const HEAVY_WIDE_BOUNDS = {
  ...HEAVY_V1_BOUNDS,
  mass: [100, 20000],
  biteForce: [0.1, 150],
} as const;
const PACK_WIDE_BOUNDS = { ...PACK_V1_BOUNDS, mass: [5, 1000] } as const;

// --- presets (docs/SPECIES.md §4, Appendix A) ---

function split<K extends string>(rows: Readonly<Record<K, Row>>) {
  const ranges = {} as Record<K, Triangular>;
  const evidence = {} as Record<K, Evidence>;
  for (const k of Object.keys(rows) as K[]) {
    const [min, mode, max, ev] = rows[k];
    ranges[k] = { min, mode, max };
    evidence[k] = ev;
  }
  return { ranges, evidence };
}

function heavy(
  id: HeavySpeciesId,
  era: Era,
  weapon: Weapon,
  hide: number,
  rows: Readonly<Record<HeavyKey, Row>>,
  bounds: Readonly<Record<HeavyKey, readonly [number, number]>> = HEAVY_WIDE_BOUNDS,
): HeavySpecies {
  return { id, role: 'heavy', era, weapon, constants: { hide }, bounds, ...split(rows) };
}

function pack(
  id: PackSpeciesId,
  era: Era,
  radius: number,
  rows: Readonly<Record<PackKey, Row>>,
  bounds: Readonly<Record<PackKey, readonly [number, number]>> = PACK_WIDE_BOUNDS,
): PackSpecies {
  return { id, role: 'pack', era, constants: { radius }, bounds, ...split(rows) };
}

export const HEAVY_SPECIES: Readonly<Record<HeavySpeciesId, HeavySpecies>> = {
  trex: heavy(
    'trex',
    { fromMa: 68, toMa: 66 },
    'bite',
    1,
    {
      mass: [5650, 8000, 9500, 'L'],
      speed: [3.4, 5.5, 8, 'L'],
      turnRate: [22, 30, 45, 'L'],
      biteForce: [8.5, 35, 57, 'L'],
      biteLethality: [4, 8, 12, 'S'],
      biteInterval: [1.5, 2.5, 4, 'S'],
      biteReach: [4.5, 5.5, 6.5, 'S'],
      biteArc: [30, 45, 70, 'S'],
      biteAccuracy: [0.3, 0.5, 0.7, 'S'],
      shakeRate: [0.05, 0.12, 0.25, 'S'],
      bodyRadius: [2, 2.5, 3, 'S'],
    },
    HEAVY_V1_BOUNDS,
  ),
  elephant: heavy('elephant', 'extant', 'tusk', 0.3, {
    mass: [2600, 3200, 6900, 'L'],
    speed: [3, 4.5, 6.8, 'L'],
    turnRate: [30, 50, 90, 'S'],
    biteForce: [8, 20, 45, 'S'],
    biteLethality: [2, 5, 9, 'S'],
    biteInterval: [2, 4, 8, 'S'],
    biteReach: [2.8, 3.5, 4.3, 'S'],
    biteArc: [40, 60, 90, 'S'],
    biteAccuracy: [0.15, 0.3, 0.5, 'S'],
    shakeRate: [0.08, 0.2, 0.4, 'S'],
    bodyRadius: [1.4, 1.7, 2, 'S'],
  }),
  buffalo: heavy('buffalo', 'extant', 'horn', 0.5, {
    mass: [420, 600, 900, 'L'],
    speed: [8, 11, 15.5, 'U'],
    turnRate: [60, 90, 150, 'S'],
    biteForce: [2, 5, 10, 'S'],
    biteLethality: [4, 8, 12, 'S'],
    biteInterval: [1, 2, 4, 'S'],
    biteReach: [1.5, 1.8, 2.2, 'S'],
    biteArc: [30, 45, 70, 'S'],
    biteAccuracy: [0.2, 0.35, 0.55, 'S'],
    shakeRate: [0.03, 0.08, 0.2, 'S'],
    bodyRadius: [0.7, 0.85, 1, 'S'],
  }),
  brownBear: heavy('brownBear', 'extant', 'pawBite', 0.5, {
    mass: [130, 220, 450, 'L'],
    speed: [8, 11, 13.3, 'L'],
    turnRate: [60, 120, 200, 'S'],
    biteForce: [0.6, 1.2, 3, 'D'],
    biteLethality: [4, 8, 12, 'S'],
    biteInterval: [0.8, 1.5, 3, 'S'],
    biteReach: [1.2, 1.5, 1.9, 'S'],
    biteArc: [45, 70, 100, 'S'],
    biteAccuracy: [0.3, 0.45, 0.65, 'S'],
    shakeRate: [0.1, 0.25, 0.5, 'S'],
    bodyRadius: [0.6, 0.75, 0.9, 'S'],
  }),
};

export const PACK_SPECIES: Readonly<Record<PackSpeciesId, PackSpecies>> = {
  tiger: pack(
    'tiger',
    'extant',
    0.8,
    {
      mass: [100, 180, 260, 'L'],
      sprintSpeed: [11, 14, 18, 'S'],
      cruiseSpeed: [4, 6, 8, 'S'],
      sprintEndurance: [10, 20, 40, 'S'],
      latchEndurance: [15, 30, 60, 'S'],
      recoveryTime: [30, 60, 120, 'S'],
      latchChance: [0.15, 0.35, 0.6, 'S'],
      dps: [2, 6, 12, 'D'],
      bleed: [0, 0.002, 0.005, 'S'],
      morale: [0.4, 0.6, 0.85, 'S'],
      moraleLoss: [0.03, 0.08, 0.15, 'S'],
    },
    PACK_V1_BOUNDS,
  ),
  lion: pack('lion', 'extant', 0.8, {
    mass: [110, 150, 225, 'L'],
    sprintSpeed: [11, 14, 20.6, 'L'],
    cruiseSpeed: [3, 5, 7, 'S'],
    sprintEndurance: [8, 15, 30, 'S'],
    latchEndurance: [20, 45, 120, 'S'],
    recoveryTime: [40, 90, 180, 'S'],
    latchChance: [0.2, 0.4, 0.65, 'S'],
    dps: [2.5, 7, 14, 'D'],
    bleed: [0, 0.002, 0.005, 'S'],
    morale: [0.45, 0.65, 0.9, 'S'],
    moraleLoss: [0.02, 0.06, 0.12, 'S'],
  }),
  wolf: pack('wolf', 'extant', 0.5, {
    mass: [30, 42, 60, 'L'],
    sprintSpeed: [12, 15, 18, 'U'],
    cruiseSpeed: [2.5, 4, 6, 'U'],
    sprintEndurance: [20, 40, 90, 'S'],
    latchEndurance: [10, 25, 60, 'S'],
    recoveryTime: [30, 60, 120, 'S'],
    latchChance: [0.1, 0.25, 0.45, 'S'],
    dps: [0.8, 2.5, 6, 'D'],
    bleed: [0.001, 0.003, 0.006, 'S'],
    morale: [0.35, 0.55, 0.8, 'S'],
    moraleLoss: [0.03, 0.08, 0.15, 'S'],
  }),
  hyena: pack('hyena', 'extant', 0.6, {
    mass: [40, 55, 70, 'L'],
    sprintSpeed: [11, 14, 16.7, 'L'],
    cruiseSpeed: [3, 4.5, 6, 'S'],
    sprintEndurance: [30, 60, 150, 'S'],
    latchEndurance: [15, 30, 60, 'S'],
    recoveryTime: [30, 60, 120, 'S'],
    latchChance: [0.15, 0.3, 0.5, 'S'],
    dps: [1.2, 4, 12, 'D'],
    bleed: [0.001, 0.003, 0.008, 'S'],
    morale: [0.35, 0.55, 0.8, 'S'],
    moraleLoss: [0.03, 0.08, 0.15, 'S'],
  }),
};

export const isHeavySpecies = (v: unknown): v is HeavySpeciesId =>
  typeof v === 'string' && (HEAVY_SPECIES_IDS as readonly string[]).includes(v);
export const isPackSpecies = (v: unknown): v is PackSpeciesId =>
  typeof v === 'string' && (PACK_SPECIES_IDS as readonly string[]).includes(v);

/** Role-local key of a parameter id: `heavy.mass` → `mass`. */
export const paramKey = (id: ParamId): string => id.slice(id.indexOf('.') + 1);

function lookup<T>(
  id: ParamId,
  heavyId: HeavySpeciesId,
  packId: PackSpeciesId,
  pick: (s: HeavySpecies | PackSpecies) => Readonly<Record<string, T>>,
): T {
  const s = id.startsWith('heavy.') ? HEAVY_SPECIES[heavyId] : PACK_SPECIES[packId];
  return pick(s)[paramKey(id)] as T;
}

/** The selected species' preset triangle for one parameter. */
export const presetRange = (id: ParamId, h: HeavySpeciesId, p: PackSpeciesId): Triangular => ({
  ...lookup(id, h, p, (s) => s.ranges),
});

/** The selected species' hard bounds for one parameter. */
export const paramBounds = (
  id: ParamId,
  h: HeavySpeciesId,
  p: PackSpeciesId,
): readonly [number, number] => lookup(id, h, p, (s) => s.bounds);

/** The selected species' evidence tag for one parameter's preset. */
export const paramEvidence = (id: ParamId, h: HeavySpeciesId, p: PackSpeciesId): Evidence =>
  lookup(id, h, p, (s) => s.evidence);

/** Preset ranges for every parameter of a species pair, in PARAMS order. */
export function speciesRanges(h: HeavySpeciesId, p: PackSpeciesId): Record<ParamId, Triangular> {
  return Object.fromEntries(PARAMS.map((d) => [d.id, presetRange(d.id, h, p)])) as Record<
    ParamId,
    Triangular
  >;
}

/** Hard bounds of every parameter for a species pair, indexed like PARAMS. */
export function boundsTable(h: HeavySpeciesId, p: PackSpeciesId): (readonly [number, number])[] {
  return PARAMS.map((d) => paramBounds(d.id, h, p));
}

/** Species of a role. */
export const speciesOf = (role: Role, h: HeavySpeciesId, p: PackSpeciesId): SpeciesId =>
  role === 'heavy' ? h : p;

// --- matchups ---

/** How a pairing relates to the real world. */
export type MatchupClass = 'documented' | 'neverMet' | 'undocumented';

/**
 * Pairings with field observations (docs/SPECIES.md §5). The anchor names the section of
 * docs/SPECIES.md that cites them.
 */
export const DOCUMENTED_MATCHUPS: readonly {
  heavy: HeavySpeciesId;
  pack: PackSpeciesId;
  anchor: string;
}[] = [
  { heavy: 'elephant', pack: 'lion', anchor: 'elephants-and-lions' },
  { heavy: 'buffalo', pack: 'lion', anchor: 'buffalo-and-lions' },
  { heavy: 'buffalo', pack: 'hyena', anchor: 'buffalo-and-hyenas' },
  { heavy: 'brownBear', pack: 'wolf', anchor: 'brown-bears-and-wolves' },
  { heavy: 'brownBear', pack: 'tiger', anchor: 'brown-bears-and-tigers' },
];

const eraOverlap = (a: Era, b: Era): boolean => {
  if (a === 'extant' || b === 'extant') return a === b;
  return a.toMa <= b.fromMa && b.toMa <= a.fromMa;
};

/** Classify a pairing: documented in the field, never alive at the same time, or neither. */
export function matchupClass(h: HeavySpeciesId, p: PackSpeciesId): MatchupClass {
  if (DOCUMENTED_MATCHUPS.some((m) => m.heavy === h && m.pack === p)) return 'documented';
  return eraOverlap(HEAVY_SPECIES[h].era, PACK_SPECIES[p].era) ? 'undocumented' : 'neverMet';
}

/** docs/SPECIES.md anchor for a documented pairing, or null. */
export function matchupAnchor(h: HeavySpeciesId, p: PackSpeciesId): string | null {
  return DOCUMENTED_MATCHUPS.find((m) => m.heavy === h && m.pack === p)?.anchor ?? null;
}
