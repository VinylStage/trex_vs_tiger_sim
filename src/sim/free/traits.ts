import type { Triangular } from '../params.ts';

/**
 * Trait list of the free (symmetric) model, docs/design/FREE-MATCHUPS.md §2.2 and §5.3.
 *
 * Every species carries every individual trait; social species also carry the pack-buff traits.
 * The order of both lists is the column order of a side in the free design matrix, so traits may
 * only ever be appended. Nothing here is read by the legacy engine (`src/sim/engine.ts`).
 */

export const TRAIT_IDS = [
  'mass',
  'bodyRadius',
  'turnRate',
  'sprintSpeed',
  'cruiseSpeed',
  'sprintEndurance',
  'recoveryTime',
  'strikeForce',
  'strikeLethality',
  'strikeInterval',
  'strikeReach',
  'strikeArc',
  'strikeAccuracy',
  'latchChance',
  'latchEndurance',
  'latchDps',
  'shakeRate',
  'bleed',
  'morale',
  'moraleLoss',
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

/** Pack-buff traits (design §5.3); only meaningful for `social` species. */
export const BUFF_TRAIT_IDS = [
  'cohesionRadius',
  'groupLatchGain',
  'focusBonus',
  'moraleSupport',
  'routShock',
  'reliefStamina',
] as const;
export type BuffTraitId = (typeof BUFF_TRAIT_IDS)[number];

/** Latch traits; inactive (neutral) for species that cannot latch (design §4.2). */
export const LATCH_TRAIT_IDS = [
  'latchChance',
  'latchEndurance',
  'latchDps',
] as const satisfies readonly TraitId[];

export interface TraitDef<I extends string = TraitId | BuffTraitId> {
  id: I;
  unit: string;
  /** Input step in a parameter table. */
  step: number;
  /** Per-agent (aleatory) variation applies. Pack-buff traits are run-level only. */
  individual: boolean;
}

const def = <I extends string>(id: I, unit: string, step: number, individual = true) => ({
  id,
  unit,
  step,
  individual,
});

/** Individual traits in `TRAIT_IDS` order. `individual` follows the legacy role parameters. */
export const TRAITS: readonly TraitDef<TraitId>[] = [
  def('mass', 'kg', 1),
  def('bodyRadius', 'm', 0.05, false),
  def('turnRate', 'deg/s', 1),
  def('sprintSpeed', 'm/s', 0.1),
  def('cruiseSpeed', 'm/s', 0.1),
  def('sprintEndurance', 's', 1),
  def('recoveryTime', 's', 1),
  def('strikeForce', 'kN', 0.05),
  def('strikeLethality', 'HP/kN', 0.1, false),
  def('strikeInterval', 's', 0.1),
  def('strikeReach', 'm', 0.05),
  def('strikeArc', 'deg', 1),
  def('strikeAccuracy', 'p', 0.01),
  def('latchChance', 'p', 0.01),
  def('latchEndurance', 's', 1),
  def('latchDps', 'HP/s', 0.1),
  def('shakeRate', '1/s', 0.01),
  def('bleed', '1/s', 0.0005, false),
  def('morale', '0-1', 0.01),
  def('moraleLoss', '0-1', 0.01),
];

/** Pack-buff traits in `BUFF_TRAIT_IDS` order; all run-level. */
export const BUFF_TRAITS: readonly TraitDef<BuffTraitId>[] = [
  def('cohesionRadius', 'm', 1, false),
  def('groupLatchGain', '×/rider', 0.01, false),
  def('focusBonus', 'm', 1, false),
  def('moraleSupport', '0-1', 0.005, false),
  def('routShock', '0-1', 0.005, false),
  def('reliefStamina', '0-1', 0.01, false),
];

/**
 * Hard bounds shared by every species in the free model: the union of the legacy heavy and pack
 * bounds (src/sim/species.ts), widened only where a role never had the trait (strike reach down
 * to the smallest carnivore's head, latch endurance down to 1 s).
 */
export const TRAIT_BOUNDS: Readonly<Record<TraitId, readonly [number, number]>> = {
  mass: [5, 20000],
  bodyRadius: [0.1, 8],
  turnRate: [5, 360],
  sprintSpeed: [0.5, 35],
  cruiseSpeed: [0.5, 20],
  sprintEndurance: [1, 600],
  recoveryTime: [1, 3600],
  strikeForce: [0.1, 150],
  strikeLethality: [0.1, 100],
  strikeInterval: [0.2, 30],
  strikeReach: [0.3, 15],
  strikeArc: [5, 180],
  strikeAccuracy: [0, 1],
  latchChance: [0, 1],
  latchEndurance: [1, 1200],
  latchDps: [0, 200],
  shakeRate: [0, 10],
  bleed: [0, 0.1],
  morale: [0, 1],
  moraleLoss: [0, 1],
};

export const BUFF_TRAIT_BOUNDS: Readonly<Record<BuffTraitId, readonly [number, number]>> = {
  cohesionRadius: [0, 500],
  groupLatchGain: [0, 1],
  focusBonus: [0, 100],
  moraleSupport: [0, 0.2],
  routShock: [0, 0.2],
  reliefStamina: [0, 1],
};

/**
 * Values of inactive traits: latch traits of a species that cannot latch, pack-buff traits of a
 * non-social species. They fill the design column (the layout never depends on the species) and
 * are never read by the engine. Each lies inside its bounds.
 */
export const NEUTRAL: Readonly<Record<(typeof LATCH_TRAIT_IDS)[number] | BuffTraitId, number>> = {
  latchChance: 0,
  latchEndurance: 1,
  latchDps: 0,
  cohesionRadius: 0,
  groupLatchGain: 0,
  focusBonus: 0,
  moraleSupport: 0,
  routShock: 0,
  reliefStamina: 0,
};

export const fixed = (v: number): Triangular => ({ min: v, mode: v, max: v });
