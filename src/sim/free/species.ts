import type { Triangular } from '../params.ts';
import {
  HEAVY_SPECIES,
  PACK_SPECIES,
  type Evidence,
  type HeavyKey,
  type HeavySpeciesId,
  type PackKey,
  type PackSpeciesId,
} from '../species.ts';
import {
  BUFF_TRAIT_IDS,
  LATCH_TRAIT_IDS,
  NEUTRAL,
  TRAIT_IDS,
  fixed,
  type BuffTraitId,
  type TraitId,
} from './traits.ts';

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
    social: false,
    canLatch: false,
    constants: { hide: h.constants.hide, intimidation: h.constants.intimidation },
    traits: complete(id, { ...fromHeavy(id), ...mapRows(extras), ...NO_LATCH }),
    buff: NO_BUFF,
  };
}

function packBased(
  id: Exclude<PackSpeciesId, 'homoErectus'>,
  social: boolean,
  extras: PackExtras,
  buff: Readonly<Record<BuffTraitId, Row>> | null,
): FreeSpecies {
  return {
    id,
    social,
    canLatch: true,
    constants: { hide: 1, intimidation: 1 },
    traits: complete(id, { ...fromPack(id), ...mapRows(extras) }),
    buff: buff ? buffRows(buff) : NO_BUFF,
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
};

export const isFreeSpecies = (v: unknown): v is FreeSpeciesId =>
  typeof v === 'string' && (FREE_SPECIES_IDS as readonly string[]).includes(v);

/** Preset triangles of a species' individual traits, in `TRAIT_IDS` order (fresh objects). */
export function traitRanges(id: FreeSpeciesId): Record<TraitId, Triangular> {
  const t = FREE_SPECIES[id].traits;
  return Object.fromEntries(TRAIT_IDS.map((k) => [k, { ...t[k].range }])) as Record<
    TraitId,
    Triangular
  >;
}

/** Preset triangles of a species' pack-buff traits (neutral for a non-social species). */
export function buffRanges(id: FreeSpeciesId): Record<BuffTraitId, Triangular> {
  const b = FREE_SPECIES[id].buff;
  return Object.fromEntries(BUFF_TRAIT_IDS.map((k) => [k, { ...b[k].range }])) as Record<
    BuffTraitId,
    Triangular
  >;
}
