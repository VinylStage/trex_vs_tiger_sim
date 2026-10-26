export type Role = 'heavy' | 'pack';

export interface Triangular {
  min: number;
  mode: number;
  max: number;
}

export interface ParamDef {
  id: ParamId;
  role: Role;
  unit: string;
  /** Input step in the parameter table. */
  step: number;
  /** Individual (aleatory) variation is applied to this parameter. */
  individual: boolean;
}

export const PARAM_IDS = [
  'heavy.mass',
  'heavy.speed',
  'heavy.turnRate',
  'heavy.biteForce',
  'heavy.biteLethality',
  'heavy.biteInterval',
  'heavy.biteReach',
  'heavy.biteArc',
  'heavy.biteAccuracy',
  'heavy.shakeRate',
  'heavy.bodyRadius',
  'pack.mass',
  'pack.sprintSpeed',
  'pack.cruiseSpeed',
  'pack.sprintEndurance',
  'pack.latchEndurance',
  'pack.recoveryTime',
  'pack.latchChance',
  'pack.dps',
  'pack.bleed',
  'pack.morale',
  'pack.moraleLoss',
] as const;

export type ParamId = (typeof PARAM_IDS)[number];

export const PARAM_INDEX: Readonly<Record<ParamId, number>> = Object.fromEntries(
  PARAM_IDS.map((id, i) => [id, i]),
) as Record<ParamId, number>;

const def = (id: ParamId, unit: string, step: number, individual = true): ParamDef => ({
  id,
  role: id.startsWith('heavy.') ? 'heavy' : 'pack',
  unit,
  step,
  individual,
});

/**
 * The 22 role parameters. Presets, hard bounds and evidence tags are per species
 * (src/sim/species.ts, docs/SPECIES.md). Order must match PARAM_IDS: it is the column order of
 * the design matrix, so it never changes.
 */
export const PARAMS: readonly ParamDef[] = [
  def('heavy.mass', 'kg', 10),
  def('heavy.speed', 'm/s', 0.1),
  def('heavy.turnRate', 'deg/s', 1),
  def('heavy.biteForce', 'kN', 0.1),
  def('heavy.biteLethality', 'HP/kN', 0.1, false),
  def('heavy.biteInterval', 's', 0.1),
  def('heavy.biteReach', 'm', 0.1),
  def('heavy.biteArc', 'deg', 1),
  def('heavy.biteAccuracy', 'p', 0.01),
  def('heavy.shakeRate', '1/s', 0.01),
  def('heavy.bodyRadius', 'm', 0.1, false),
  def('pack.mass', 'kg', 1),
  def('pack.sprintSpeed', 'm/s', 0.1),
  def('pack.cruiseSpeed', 'm/s', 0.1),
  def('pack.sprintEndurance', 's', 1),
  def('pack.latchEndurance', 's', 1),
  def('pack.recoveryTime', 's', 1),
  def('pack.latchChance', 'p', 0.01),
  def('pack.dps', 'HP/s', 0.1),
  def('pack.bleed', '1/s', 0.0005, false),
  def('pack.morale', '0-1', 0.01),
  def('pack.moraleLoss', '0-1', 0.01),
];
