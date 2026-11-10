import type { Triangular } from '../params.ts';
import {
  HEAVY_SPECIES,
  PACK_SPECIES,
  type Era,
  type Evidence,
  type HeavyKey,
  type HeavySpeciesId,
  type PackKey,
  type PackSpeciesId,
} from '../species.ts';
import {
  BUFF_TRAIT_IDS,
  FLIGHT_TRAIT_IDS,
  LATCH_TRAIT_IDS,
  NEUTRAL,
  TRAIT_IDS,
  fixed,
  type BuffTraitId,
  type FlightTraitId,
  type TraitId,
} from './traits.ts';
import type { FreeConfig } from './config.ts';
import { FREE_MODEL_VERSION } from './version.ts';

/**
 * Unified species registry of the free model (docs/design/FREE-MATCHUPS.md §2, docs/SPECIES.md
 * §11). Every species fills every trait, so it can stand on either side.
 *
 * - Traits the legacy roles already had are **read from the legacy registry**
 *   (`HEAVY_SPECIES`, `PACK_SPECIES`), never copied, so the two cannot drift apart. The legacy
 *   registry itself is not changed and the legacy engine never reads this module.
 * - Traits a role never had get new presets with an evidence tag; sources are in SPECIES.md §11.
 * - Inactive traits (latching for a species that cannot latch, the pack buff for a non-social
 *   species) hold the neutral values of `NEUTRAL` and evidence `null`.
 * - `era` and `adSafe` are read from the legacy registry the same way.
 * - A species added after the free model has no legacy entry and is built from its own source
 *   sheet with `defineFreeSpecies` (docs/SPECIES.md §11.5).
 */

export const FREE_SPECIES_IDS = [
  'trex',
  'elephant',
  'buffalo',
  'brownBear',
  'mammoth',
  'homoErectus',
  'tiger',
  'lion',
  'wolf',
  'hyena',
  'polarBear',
  'hippo',
  'raptor',
  'whiteRhino',
  'spinosaurus',
  'triceratops',
] as const;
export type FreeSpeciesId = (typeof FREE_SPECIES_IDS)[number];

/** A preset row: [min, mode, max, evidence]. */
type Row = readonly [number, number, number, Evidence];

export interface TraitPreset {
  readonly range: Triangular;
  /** Evidence tag, or null for an inactive trait (neutral value, never read by the engine). */
  readonly evidence: Evidence | null;
}

export interface FreeSpecies {
  readonly id: FreeSpeciesId;
  /** Geological time, or alive today: the extant and extinct groups of the species pickers. */
  readonly era: Era;
  /** Whether a matchup with it may carry ads; read through `freeMatchupAdSafe` (ADSENSE.md §6). */
  readonly adSafe: boolean;
  /** Cooperative group hunter or fighter: gets the pack buff in groups (design §2.3). */
  readonly social: boolean;
  /** Can grab and ride a much larger target (design §4.2). */
  readonly canLatch: boolean;
  readonly constants: {
    /** Multiplier on latch damage taken (legacy heavy `hide`; 1 for every former pack species). */
    readonly hide: number;
    /** Multiplier on the morale and recovery effect of this species' hits (legacy heavy). */
    readonly intimidation: number;
  };
  readonly traits: Readonly<Record<TraitId, TraitPreset>>;
  readonly buff: Readonly<Record<BuffTraitId, TraitPreset>>;
  /**
   * Flight traits (#169), from model version 2 on; null under model 1, whose engine has none.
   * The engine reads each row's mode; the range is the sensitivity range (SPECIES.md §11.6).
   */
  readonly flight: Readonly<Record<FlightTraitId, TraitPreset>> | null;
}

const row = ([min, mode, max, evidence]: Row): TraitPreset => ({
  range: { min, mode, max },
  evidence,
});

const inactive = (v: number): TraitPreset => ({ range: fixed(v), evidence: null });

/** A legacy heavy preset, mapped: `speed` → `sprintSpeed`, `bite*` → `strike*`. */
function fromHeavy(id: HeavySpeciesId): Partial<Record<TraitId, TraitPreset>> {
  const s = HEAVY_SPECIES[id];
  const m = (k: HeavyKey): TraitPreset => ({ range: { ...s.ranges[k] }, evidence: s.evidence[k] });
  return {
    mass: m('mass'),
    bodyRadius: m('bodyRadius'),
    turnRate: m('turnRate'),
    sprintSpeed: m('speed'),
    strikeForce: m('biteForce'),
    strikeLethality: m('biteLethality'),
    strikeInterval: m('biteInterval'),
    strikeReach: m('biteReach'),
    strikeArc: m('biteArc'),
    strikeAccuracy: m('biteAccuracy'),
    shakeRate: m('shakeRate'),
  };
}

/** A legacy pack preset, mapped: `dps` → `latchDps`, constant `radius` → fixed `bodyRadius`. */
function fromPack(id: PackSpeciesId): Partial<Record<TraitId, TraitPreset>> {
  const s = PACK_SPECIES[id];
  const m = (k: PackKey): TraitPreset => ({ range: { ...s.ranges[k] }, evidence: s.evidence[k] });
  return {
    mass: m('mass'),
    bodyRadius: { range: fixed(s.constants.radius), evidence: 'S' },
    sprintSpeed: m('sprintSpeed'),
    cruiseSpeed: m('cruiseSpeed'),
    sprintEndurance: m('sprintEndurance'),
    recoveryTime: m('recoveryTime'),
    latchChance: m('latchChance'),
    latchEndurance: m('latchEndurance'),
    latchDps: m('dps'),
    bleed: m('bleed'),
    morale: m('morale'),
    moraleLoss: m('moraleLoss'),
  };
}

const NO_LATCH = Object.fromEntries(
  LATCH_TRAIT_IDS.map((k) => [k, inactive(NEUTRAL[k])]),
) as Record<(typeof LATCH_TRAIT_IDS)[number], TraitPreset>;

const NO_BUFF = Object.fromEntries(BUFF_TRAIT_IDS.map((k) => [k, inactive(NEUTRAL[k])])) as Record<
  BuffTraitId,
  TraitPreset
>;

/** A copy of `parts` without trait `k`. */
function omit(
  parts: Partial<Record<TraitId, TraitPreset>>,
  k: TraitId,
): Partial<Record<TraitId, TraitPreset>> {
  return Object.fromEntries(Object.entries(parts).filter(([key]) => key !== k));
}

/** Reorder into `TRAIT_IDS` order and fail loudly on a missing trait (caught by the tests). */
function complete(
  id: FreeSpeciesId,
  parts: Partial<Record<TraitId, TraitPreset>>,
): Record<TraitId, TraitPreset> {
  const out = {} as Record<TraitId, TraitPreset>;
  for (const k of TRAIT_IDS) {
    const p = parts[k];
    if (!p) throw new Error(`free species ${id}: missing trait ${k}`);
    out[k] = p;
  }
  return out;
}

function buffRows(rows: Readonly<Record<BuffTraitId, Row>>): Record<BuffTraitId, TraitPreset> {
  return Object.fromEntries(BUFF_TRAIT_IDS.map((k) => [k, row(rows[k])])) as Record<
    BuffTraitId,
    TraitPreset
  >;
}

/** Extra traits of a former heavy (docs/SPECIES.md §11.2). */
interface HeavyExtras {
  cruiseSpeed: Row;
  sprintEndurance: Row;
  recoveryTime: Row;
  bleed: Row;
  morale: Row;
  moraleLoss: Row;
}

/** Extra traits of a former pack species (docs/SPECIES.md §11.3). */
interface PackExtras {
  turnRate: Row;
  strikeForce: Row;
  strikeLethality: Row;
  strikeInterval: Row;
  strikeReach: Row;
  strikeArc: Row;
  strikeAccuracy: Row;
  shakeRate: Row;
}

const mapRows = <K extends string>(rows: Readonly<Record<K, Row>>) =>
  Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, row(v as Row)])) as Record<
    K,
    TraitPreset
  >;

function heavyBased(id: Exclude<HeavySpeciesId, 'homoErectus'>, extras: HeavyExtras): FreeSpecies {
  const h = HEAVY_SPECIES[id];
  return {
    id,
    era: h.era,
    adSafe: h.adSafe,
    social: false,
    canLatch: false,
    constants: { hide: h.constants.hide, intimidation: h.constants.intimidation },
    traits: complete(id, { ...fromHeavy(id), ...mapRows(extras), ...NO_LATCH }),
    buff: NO_BUFF,
    flight: null,
  };
}

function packBased(
  id: Exclude<PackSpeciesId, 'homoErectus'>,
  social: boolean,
  extras: PackExtras,
  buff: Readonly<Record<BuffTraitId, Row>> | null,
): FreeSpecies {
  const p = PACK_SPECIES[id];
  return {
    id,
    era: p.era,
    adSafe: p.adSafe,
    social,
    canLatch: true,
    constants: { hide: 1, intimidation: 1 },
    traits: complete(id, { ...fromPack(id), ...mapRows(extras) }),
    buff: buff ? buffRows(buff) : NO_BUFF,
    flight: null,
  };
}

type LatchTraitId = (typeof LATCH_TRAIT_IDS)[number];

/**
 * The source sheet of a species with no legacy-registry entry (docs/SPECIES.md §11.5): every
 * input of the free model, as preset rows `[min, mode, max, evidence]`.
 */
export interface FreeSpeciesSheet {
  readonly era: Era;
  readonly adSafe: boolean;
  readonly social: boolean;
  readonly canLatch: boolean;
  readonly constants: FreeSpecies['constants'];
  /** Every individual trait. Latch rows only when `canLatch`; they are neutral otherwise. */
  readonly traits: Readonly<
    Record<Exclude<TraitId, LatchTraitId>, Row> & Partial<Record<LatchTraitId, Row>>
  >;
  /** Pack-buff rows when `social`, null otherwise (neutral). */
  readonly buff: Readonly<Record<BuffTraitId, Row>> | null;
}

/**
 * Standalone constructor: a registry entry built from its own sheet, without reading the legacy
 * registry, so a new species can join the free model alone. Everything is copied, so editing the
 * sheet afterwards changes nothing. Throws on a sheet whose rows do not match its flags (caught
 * by the tests).
 */
export function defineFreeSpecies(id: FreeSpeciesId, sheet: FreeSpeciesSheet): FreeSpecies {
  if (!sheet.canLatch && LATCH_TRAIT_IDS.some((k) => Object.hasOwn(sheet.traits, k))) {
    throw new Error(`free species ${id}: latch rows on a species that cannot latch`);
  }
  if (sheet.social !== (sheet.buff !== null)) {
    throw new Error(`free species ${id}: pack-buff rows must be given exactly when social`);
  }
  const era = sheet.era;
  return {
    id,
    era: era === 'extant' ? 'extant' : { fromMa: era.fromMa, toMa: era.toMa },
    adSafe: sheet.adSafe,
    social: sheet.social,
    canLatch: sheet.canLatch,
    constants: { hide: sheet.constants.hide, intimidation: sheet.constants.intimidation },
    traits: complete(id, {
      ...mapRows<Exclude<TraitId, LatchTraitId>>(sheet.traits),
      ...(sheet.canLatch ? {} : NO_LATCH),
    }),
    buff: sheet.buff ? buffRows(sheet.buff) : NO_BUFF,
    flight: null,
  };
}

/** Shared assumption rows (SPECIES.md §11): one value for every species of a kind. */
const HEAVY_MORALE_LOSS: Row = [0.02, 0.05, 0.1, 'S'];
const PACK_STRIKE_LETHALITY: Row = [4, 8, 12, 'S'];
const PACK_STRIKE_INTERVAL: Row = [1, 1.5, 2.5, 'S'];

/** Pack-buff rows of design §5.3: R_coh, g, focusBonus, k_c, routShock, reliefStamina. */
const CARNIVORE_BUFF = (
  cohesionMax: number,
  gainMode: number,
  gainMax: number,
  supportMode: number,
): Record<BuffTraitId, Row> => ({
  cohesionRadius: [30, 60, cohesionMax, 'S'],
  groupLatchGain: [0.1, gainMode, gainMax, 'S'],
  focusBonus: [0, 20, 40, 'S'],
  moraleSupport: [0, supportMode, 0.1, 'S'],
  routShock: [0, 0.05, 0.1, 'S'],
  reliefStamina: [0.2, 0.3, 0.5, 'S'],
});

export const FREE_SPECIES: Readonly<Record<FreeSpeciesId, FreeSpecies>> = {
  trex: heavyBased('trex', {
    cruiseSpeed: [0.8, 1.28, 1.64, 'L'],
    sprintEndurance: [20, 60, 180, 'S'],
    recoveryTime: [60, 120, 300, 'S'],
    bleed: [0.002, 0.004, 0.008, 'S'],
    morale: [0.7, 0.85, 0.95, 'S'],
    moraleLoss: HEAVY_MORALE_LOSS,
  }),
  elephant: heavyBased('elephant', {
    cruiseSpeed: [1, 1.3, 2, 'S'],
    sprintEndurance: [20, 60, 180, 'S'],
    recoveryTime: [60, 120, 300, 'S'],
    bleed: [0, 0.001, 0.003, 'S'],
    morale: [0.65, 0.8, 0.95, 'S'],
    moraleLoss: HEAVY_MORALE_LOSS,
  }),
  buffalo: heavyBased('buffalo', {
    cruiseSpeed: [0.8, 1.2, 2, 'S'],
    sprintEndurance: [30, 60, 180, 'S'],
    recoveryTime: [45, 90, 180, 'S'],
    bleed: [0.001, 0.002, 0.005, 'S'],
    morale: [0.6, 0.75, 0.9, 'S'],
    moraleLoss: HEAVY_MORALE_LOSS,
  }),
  brownBear: heavyBased('brownBear', {
    cruiseSpeed: [0.6, 1.2, 1.8, 'S'],
    sprintEndurance: [20, 45, 120, 'S'],
    recoveryTime: [45, 90, 180, 'S'],
    bleed: [0.001, 0.003, 0.006, 'S'],
    morale: [0.55, 0.75, 0.9, 'S'],
    moraleLoss: HEAVY_MORALE_LOSS,
  }),
  mammoth: heavyBased('mammoth', {
    cruiseSpeed: [1, 1.3, 2, 'D'],
    sprintEndurance: [20, 60, 180, 'S'],
    recoveryTime: [60, 120, 300, 'S'],
    bleed: [0, 0.001, 0.003, 'S'],
    morale: [0.65, 0.8, 0.95, 'S'],
    moraleLoss: HEAVY_MORALE_LOSS,
  }),
  // Both legacy presets merge (design §2.2): body, strike and shake-off from the heavy row;
  // running, stamina, grip (latch), bleed and morale from the pack row. Mass is identical.
  homoErectus: {
    id: 'homoErectus',
    era: HEAVY_SPECIES.homoErectus.era,
    adSafe: HEAVY_SPECIES.homoErectus.adSafe && PACK_SPECIES.homoErectus.adSafe,
    social: true,
    canLatch: true,
    constants: {
      hide: HEAVY_SPECIES.homoErectus.constants.hide,
      intimidation: HEAVY_SPECIES.homoErectus.constants.intimidation,
    },
    traits: complete('homoErectus', {
      ...fromPack('homoErectus'),
      ...omit(fromHeavy('homoErectus'), 'sprintSpeed'),
    }),
    buff: buffRows({
      cohesionRadius: [15, 30, 60, 'S'],
      groupLatchGain: [0, 0.15, 0.3, 'S'],
      focusBonus: [0, 15, 30, 'S'],
      moraleSupport: [0, 0.04, 0.08, 'S'],
      routShock: [0, 0.05, 0.1, 'S'],
      reliefStamina: [0.2, 0.3, 0.5, 'S'],
    }),
    flight: null,
  },
  tiger: packBased(
    'tiger',
    false,
    {
      turnRate: [90, 180, 300, 'S'],
      strikeForce: [1.2, 1.35, 1.5, 'D'],
      strikeLethality: PACK_STRIKE_LETHALITY,
      strikeInterval: PACK_STRIKE_INTERVAL,
      strikeReach: [1.1, 1.4, 1.7, 'S'],
      strikeArc: [30, 45, 70, 'S'],
      strikeAccuracy: [0.3, 0.45, 0.6, 'S'],
      shakeRate: [0.1, 0.25, 0.5, 'S'],
    },
    null,
  ),
  lion: packBased(
    'lion',
    true,
    {
      turnRate: [90, 180, 300, 'S'],
      strikeForce: [1.2, 1.6, 1.8, 'D'],
      strikeLethality: PACK_STRIKE_LETHALITY,
      strikeInterval: PACK_STRIKE_INTERVAL,
      strikeReach: [1.1, 1.4, 1.7, 'S'],
      strikeArc: [30, 45, 70, 'S'],
      strikeAccuracy: [0.3, 0.45, 0.6, 'S'],
      shakeRate: [0.1, 0.25, 0.5, 'S'],
    },
    CARNIVORE_BUFF(100, 0.25, 0.4, 0.05),
  ),
  wolf: packBased(
    'wolf',
    true,
    {
      turnRate: [120, 240, 360, 'S'],
      strikeForce: [0.4, 0.55, 0.75, 'D'],
      strikeLethality: PACK_STRIKE_LETHALITY,
      strikeInterval: PACK_STRIKE_INTERVAL,
      strikeReach: [0.7, 0.9, 1.1, 'S'],
      strikeArc: [25, 40, 60, 'S'],
      strikeAccuracy: [0.25, 0.4, 0.55, 'S'],
      shakeRate: [0.15, 0.3, 0.6, 'S'],
    },
    CARNIVORE_BUFF(120, 0.3, 0.5, 0.05),
  ),
  hyena: packBased(
    'hyena',
    true,
    {
      turnRate: [120, 240, 360, 'S'],
      strikeForce: [0.57, 0.9, 1.5, 'D'],
      strikeLethality: PACK_STRIKE_LETHALITY,
      strikeInterval: PACK_STRIKE_INTERVAL,
      strikeReach: [0.8, 1, 1.2, 'S'],
      strikeArc: [25, 40, 60, 'S'],
      strikeAccuracy: [0.25, 0.4, 0.55, 'S'],
      shakeRate: [0.15, 0.3, 0.6, 'S'],
    },
    CARNIVORE_BUFF(120, 0.3, 0.5, 0.06),
  ),
  // The first species without a legacy entry (docs/SPECIES.md §4.11, research/SPECIES.md §5.5).
  polarBear: defineFreeSpecies('polarBear', {
    era: 'extant',
    adSafe: true,
    social: false,
    canLatch: false,
    constants: { hide: 0.5, intimidation: 1 },
    traits: {
      mass: [250, 450, 800, 'L'],
      bodyRadius: [0.75, 0.95, 1.1, 'D'],
      turnRate: [50, 100, 180, 'S'],
      sprintSpeed: [6, 9, 11.1, 'L'],
      cruiseSpeed: [1, 1.5, 2, 'L'],
      sprintEndurance: [20, 45, 120, 'S'],
      recoveryTime: [45, 90, 180, 'S'],
      strikeForce: [0.8, 1.5, 3.5, 'S'],
      strikeLethality: [4, 8, 12, 'S'],
      strikeInterval: [0.8, 1.5, 3, 'S'],
      strikeReach: [1.3, 1.6, 2, 'S'],
      strikeArc: [45, 70, 100, 'S'],
      strikeAccuracy: [0.3, 0.45, 0.65, 'S'],
      shakeRate: [0.1, 0.25, 0.5, 'S'],
      bleed: [0.001, 0.003, 0.006, 'S'],
      morale: [0.55, 0.75, 0.9, 'S'],
      moraleLoss: HEAVY_MORALE_LOSS,
    },
    buff: null,
  }),
  // Built from its own source sheet (docs/SPECIES.md §4.12, research/SPECIES.md §5.18).
  hippo: defineFreeSpecies('hippo', {
    era: 'extant',
    adSafe: true,
    social: false,
    canLatch: false,
    constants: { hide: 0.3, intimidation: 1 },
    traits: {
      mass: [1300, 1500, 3200, 'L'],
      bodyRadius: [1, 1.15, 1.55, 'D'],
      turnRate: [40, 70, 120, 'S'],
      sprintSpeed: [4, 6, 8.3, 'S'],
      cruiseSpeed: [0.8, 1.2, 1.8, 'S'],
      sprintEndurance: [15, 40, 100, 'S'],
      recoveryTime: [60, 120, 300, 'S'],
      strikeForce: [4, 8, 15, 'S'],
      strikeLethality: [4, 8, 12, 'S'],
      strikeInterval: [1.5, 2.5, 5, 'S'],
      strikeReach: [1.6, 1.9, 2.3, 'S'],
      strikeArc: [30, 50, 80, 'S'],
      strikeAccuracy: [0.2, 0.35, 0.55, 'S'],
      shakeRate: [0.03, 0.08, 0.2, 'S'],
      bleed: [0.001, 0.003, 0.006, 'S'],
      morale: [0.65, 0.8, 0.95, 'S'],
      moraleLoss: HEAVY_MORALE_LOSS,
    },
    buff: null,
  }),
  // The first social species without a legacy entry, Utahraptor by default (docs/SPECIES.md
  // §4.13, research/SPECIES.md §5.15).
  raptor: defineFreeSpecies('raptor', {
    era: { fromMa: 139, toMa: 125 },
    adSafe: true,
    social: true,
    canLatch: true,
    constants: { hide: 1, intimidation: 1 },
    traits: {
      mass: [280, 400, 500, 'L'],
      bodyRadius: [0.95, 1.05, 1.1, 'D'],
      turnRate: [60, 120, 200, 'S'],
      sprintSpeed: [6, 8, 10.5, 'S'],
      cruiseSpeed: [1.5, 2.5, 4, 'S'],
      sprintEndurance: [10, 20, 40, 'S'],
      recoveryTime: [30, 60, 120, 'S'],
      strikeForce: [1.7, 2.15, 2.5, 'D'],
      strikeLethality: PACK_STRIKE_LETHALITY,
      strikeInterval: PACK_STRIKE_INTERVAL,
      strikeReach: [1.4, 1.7, 2, 'S'],
      strikeArc: [30, 45, 70, 'S'],
      strikeAccuracy: [0.3, 0.45, 0.6, 'S'],
      latchChance: [0.1, 0.25, 0.5, 'S'],
      latchEndurance: [15, 30, 60, 'S'],
      latchDps: [3.4, 9.5, 20, 'D'],
      shakeRate: [0.1, 0.25, 0.5, 'S'],
      bleed: [0.001, 0.004, 0.01, 'S'],
      morale: [0.3, 0.55, 0.8, 'S'],
      moraleLoss: [0.03, 0.08, 0.15, 'S'],
    },
    buff: {
      cohesionRadius: [30, 60, 100, 'S'],
      groupLatchGain: [0, 0.12, 0.25, 'S'],
      focusBonus: [0, 10, 20, 'S'],
      moraleSupport: [0, 0.025, 0.05, 'S'],
      routShock: [0, 0.025, 0.05, 'S'],
      reliefStamina: [0.2, 0.3, 0.5, 'S'],
    },
  }),
  // Built from its own source sheet (docs/SPECIES.md §4.14, research/SPECIES.md §5.19).
  whiteRhino: defineFreeSpecies('whiteRhino', {
    era: 'extant',
    adSafe: true,
    social: false,
    canLatch: false,
    constants: { hide: 0.3, intimidation: 1 },
    traits: {
      mass: [1600, 2000, 3600, 'L'],
      bodyRadius: [1.1, 1.25, 1.6, 'D'],
      turnRate: [40, 80, 140, 'S'],
      sprintSpeed: [5, 7, 11.1, 'S'],
      cruiseSpeed: [0.8, 1.2, 2, 'S'],
      sprintEndurance: [15, 40, 100, 'S'],
      recoveryTime: [60, 120, 300, 'S'],
      strikeForce: [6, 12, 20, 'S'],
      strikeLethality: [4, 8, 12, 'S'],
      strikeInterval: [1.5, 2.5, 5, 'S'],
      strikeReach: [1.7, 2, 2.5, 'S'],
      strikeArc: [30, 45, 70, 'S'],
      strikeAccuracy: [0.15, 0.3, 0.5, 'S'],
      shakeRate: [0.03, 0.08, 0.2, 'S'],
      bleed: [0.001, 0.002, 0.005, 'S'],
      morale: [0.6, 0.75, 0.9, 'S'],
      moraleLoss: HEAVY_MORALE_LOSS,
    },
    buff: null,
  }),
  // Built from its own source sheet (docs/SPECIES.md §4.15, research/SPECIES.md §5.8). Shown as
  // "semi-aquatic; land duel": its posture and how much it swam are contested, and the free model
  // has no water, so it fights on land only.
  spinosaurus: defineFreeSpecies('spinosaurus', {
    era: { fromMa: 100, toMa: 94 },
    adSafe: true,
    social: false,
    canLatch: false,
    constants: { hide: 1, intimidation: 1 },
    traits: {
      mass: [6000, 7400, 9000, 'L'],
      bodyRadius: [2.05, 2.45, 2.95, 'D'],
      turnRate: [15, 22, 32, 'S'],
      sprintSpeed: [2, 4, 6, 'S'],
      cruiseSpeed: [0.6, 1, 1.4, 'S'],
      sprintEndurance: [20, 60, 180, 'S'],
      recoveryTime: [60, 120, 300, 'S'],
      strikeForce: [4.8, 8.35, 11.9, 'L'],
      strikeLethality: [3, 6, 10, 'S'],
      strikeInterval: [1, 2, 3.5, 'S'],
      strikeReach: [5, 6, 7, 'S'],
      strikeArc: [25, 40, 60, 'S'],
      strikeAccuracy: [0.25, 0.45, 0.65, 'S'],
      shakeRate: [0.05, 0.12, 0.25, 'S'],
      bleed: [0.002, 0.004, 0.008, 'S'],
      morale: [0.7, 0.85, 0.95, 'S'],
      moraleLoss: HEAVY_MORALE_LOSS,
    },
    buff: null,
  }),
  // Built from its own source sheet (docs/SPECIES.md §4.16, research/SPECIES.md §5.20). Treated
  // as solitary: one juvenile bonebed and one possible family group are too little for a herd.
  triceratops: defineFreeSpecies('triceratops', {
    era: { fromMa: 68, toMa: 66 },
    adSafe: true,
    social: false,
    canLatch: false,
    constants: { hide: 0.5, intimidation: 1 },
    traits: {
      mass: [5400, 8000, 10000, 'L'],
      bodyRadius: [1.65, 2, 2.25, 'D'],
      turnRate: [30, 50, 90, 'S'],
      sprintSpeed: [4.5, 7, 9.7, 'S'],
      cruiseSpeed: [0.8, 1.2, 2, 'S'],
      sprintEndurance: [15, 40, 100, 'S'],
      recoveryTime: [60, 120, 300, 'S'],
      strikeForce: [24, 47, 78, 'S'],
      strikeLethality: [4, 8, 12, 'S'],
      strikeInterval: [1.5, 2.5, 5, 'S'],
      strikeReach: [3.2, 4, 4.8, 'S'],
      strikeArc: [30, 45, 70, 'S'],
      strikeAccuracy: [0.2, 0.35, 0.55, 'S'],
      shakeRate: [0.03, 0.08, 0.2, 'S'],
      bleed: [0.001, 0.002, 0.005, 'S'],
      morale: [0.6, 0.75, 0.9, 'S'],
      moraleLoss: HEAVY_MORALE_LOSS,
    },
    buff: null,
  }),
};

/**
 * What a model version changes in a species entry (ADR-0008 §5: old links keep the values of
 * their own version). Trait rows and constants replace those of the previous version; `flight`
 * sets the flight traits. Sources: docs/SPECIES.md §11.6 and research/SPECIES.md §7.
 */
export interface SpeciesRevision {
  readonly traits?: Readonly<Partial<Record<TraitId, Row>>>;
  readonly constants?: Readonly<Partial<FreeSpecies['constants']>>;
  /** Rows of a non-social species; null rows (inactive) for a social species' `soloShock`. */
  readonly flight?: Readonly<Record<FlightTraitId, Row | null>>;
}

/** Shared flight rows (SPECIES.md §11.6): no study measures either, so one **S** value each. */
const SOLO_SHOCK: Row = [0, 0.04, 0.08, 'S'];
const flight = (
  threatRatio: Row,
  threatTime: Row,
  soloShock: Row | null = SOLO_SHOCK,
): Record<FlightTraitId, Row | null> => ({ threatRatio, threatTime, soloShock });

/**
 * Model version 2 (#169): flight traits for every species and researched polar bear behaviour
 * rows in place of the brown bear's. Every row is sourced in docs/SPECIES.md §11.6.
 */
const MV2: Readonly<Record<FreeSpeciesId, SpeciesRevision>> = {
  trex: { flight: flight([1.5, 2, 4, 'S'], [20, 60, 180, 'S']) },
  elephant: { flight: flight([1.2, 1.5, 3, 'S'], [20, 60, 180, 'S']) },
  buffalo: { flight: flight([1.2, 1.5, 3, 'S'], [15, 45, 120, 'S']) },
  brownBear: { flight: flight([1.5, 2, 4, 'S'], [10, 30, 90, 'S']) },
  mammoth: { flight: flight([1.2, 1.5, 3, 'S'], [20, 60, 180, 'S']) },
  homoErectus: { flight: flight([1.5, 2, 4, 'S'], [5, 20, 60, 'S'], null) },
  tiger: { flight: flight([1.4, 2, 10, 'D'], [5, 15, 60, 'S']) },
  lion: { flight: flight([3.7, 6.7, 10, 'D'], [10, 30, 90, 'S'], null) },
  wolf: { flight: flight([2, 6, 15, 'S'], [5, 20, 60, 'S'], null) },
  hyena: { flight: flight([1.9, 3.3, 10, 'D'], [5, 20, 60, 'S'], null) },
  polarBear: {
    traits: {
      sprintEndurance: [10, 25, 60, 'S'],
      recoveryTime: [60, 120, 300, 'S'],
      morale: [0.4, 0.6, 0.8, 'S'],
    },
    flight: flight([1.5, 2, 3, 'D'], [5, 10, 30, 'S']),
  },
  hippo: { flight: flight([1.5, 2, 4, 'S'], [20, 60, 180, 'S']) },
  raptor: { flight: flight([2, 3, 4, 'S'], [10, 30, 90, 'S'], null) },
  whiteRhino: { flight: flight([1, 1.25, 2, 'S'], [5, 20, 60, 'S']) },
  spinosaurus: { flight: flight([1, 1.5, 2, 'S'], [10, 30, 90, 'S']) },
  triceratops: { flight: flight([1.2, 1.5, 3, 'S'], [15, 45, 120, 'S']) },
};

/** Revisions per model version; version 1 is `FREE_SPECIES` itself. Append-only. */
export const SPECIES_REVISIONS: Readonly<
  Record<number, Readonly<Partial<Record<FreeSpeciesId, SpeciesRevision>>>>
> = { 2: MV2 };

function revise(s: FreeSpecies, r: SpeciesRevision | undefined): FreeSpecies {
  if (!r) return s;
  const traits = { ...s.traits };
  for (const [k, v] of Object.entries(r.traits ?? {})) traits[k as TraitId] = row(v as Row);
  const flightRows = r.flight;
  return {
    ...s,
    constants: { ...s.constants, ...r.constants },
    traits,
    flight: flightRows
      ? (Object.fromEntries(
          FLIGHT_TRAIT_IDS.map((k) => {
            const v = flightRows[k];
            return [k, v ? row(v) : inactive(0)];
          }),
        ) as Record<FlightTraitId, TraitPreset>)
      : s.flight,
  };
}

const atVersion = new Map<string, FreeSpecies>();

/**
 * The entry of species `id` under model version `mv`: `FREE_SPECIES[id]` with the revisions of
 * versions 2 to `mv` applied in order. Model 1 is the registry entry itself. Cached, so the
 * engine can call it per battle.
 */
export function freeSpeciesAt(id: FreeSpeciesId, mv: number): FreeSpecies {
  const base = FREE_SPECIES[id];
  if (mv <= 1) return base;
  const key = `${String(mv)}:${id}`;
  let s = atVersion.get(key);
  if (!s) {
    s = base;
    for (let v = 2; v <= mv; v++) s = revise(s, SPECIES_REVISIONS[v]?.[id]);
    atVersion.set(key, s);
  }
  return s;
}

export const isFreeSpecies = (v: unknown): v is FreeSpeciesId =>
  typeof v === 'string' && (FREE_SPECIES_IDS as readonly string[]).includes(v);

/**
 * Whether ads may load for a free matchup (docs/ADSENSE.md §6), the free-model twin of
 * `matchupAdSafe` in src/sim/species.ts: true only when every side's species is ad-safe. An
 * unknown species counts as not ad-safe. It lives here, next to the flag it reads, because
 * src/sim/species.ts must not import this module (this module reads it at load time). Pure.
 */
export function freeMatchupAdSafe(c: Pick<FreeConfig, 'sides'>): boolean {
  return c.sides.every((s) => isFreeSpecies(s.species) && FREE_SPECIES[s.species].adSafe);
}

/**
 * Preset triangles of a species' individual traits under model version `mv` (the newest by
 * default), in `TRAIT_IDS` order (fresh objects).
 */
export function traitRanges(
  id: FreeSpeciesId,
  mv: number = FREE_MODEL_VERSION,
): Record<TraitId, Triangular> {
  const t = freeSpeciesAt(id, mv).traits;
  return Object.fromEntries(TRAIT_IDS.map((k) => [k, { ...t[k].range }])) as Record<
    TraitId,
    Triangular
  >;
}

/** Preset triangles of a species' pack-buff traits (neutral for a non-social species). */
export function buffRanges(
  id: FreeSpeciesId,
  mv: number = FREE_MODEL_VERSION,
): Record<BuffTraitId, Triangular> {
  const b = freeSpeciesAt(id, mv).buff;
  return Object.fromEntries(BUFF_TRAIT_IDS.map((k) => [k, { ...b[k].range }])) as Record<
    BuffTraitId,
    Triangular
  >;
}
