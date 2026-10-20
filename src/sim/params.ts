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
  default: Triangular;
  bounds: readonly [number, number];
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

const def = (
  id: ParamId,
  unit: string,
  min: number,
  mode: number,
  max: number,
  bounds: readonly [number, number],
  step: number,
  individual = true,
): ParamDef => ({
  id,
  role: id.startsWith('heavy.') ? 'heavy' : 'pack',
  unit,
  default: { min, mode, max },
  bounds,
  step,
  individual,
});

/**
 * Default ranges. Sources and rationale for every row: docs/MODEL.md.
 * Order must match PARAM_IDS.
 */
export const PARAMS: readonly ParamDef[] = [
  def('heavy.mass', 'kg', 5650, 8000, 9500, [1000, 20000], 50),
  def('heavy.speed', 'm/s', 3.4, 5.5, 8, [0.5, 25], 0.1),
  def('heavy.turnRate', 'deg/s', 22, 30, 45, [5, 360], 1),
  def('heavy.biteForce', 'kN', 8.5, 35, 57, [1, 150], 0.5),
  def('heavy.biteLethality', 'HP/kN', 4, 8, 12, [0.1, 100], 0.1, false),
  def('heavy.biteInterval', 's', 1.5, 2.5, 4, [0.2, 30], 0.1),
  def('heavy.biteReach', 'm', 4.5, 5.5, 6.5, [1, 15], 0.1),
  def('heavy.biteArc', 'deg', 30, 45, 70, [5, 180], 1),
  def('heavy.biteAccuracy', 'p', 0.3, 0.5, 0.7, [0, 1], 0.01),
  def('heavy.shakeRate', '1/s', 0.05, 0.12, 0.25, [0, 10], 0.01),
  def('heavy.bodyRadius', 'm', 2, 2.5, 3, [0.5, 8], 0.1, false),
  def('pack.mass', 'kg', 100, 180, 260, [30, 500], 5),
  def('pack.sprintSpeed', 'm/s', 11, 14, 18, [2, 35], 0.1),
  def('pack.cruiseSpeed', 'm/s', 4, 6, 8, [0.5, 20], 0.1),
  def('pack.sprintEndurance', 's', 10, 20, 40, [1, 600], 1),
  def('pack.latchEndurance', 's', 15, 30, 60, [1, 1200], 1),
  def('pack.recoveryTime', 's', 30, 60, 120, [1, 3600], 1),
  def('pack.latchChance', 'p', 0.15, 0.35, 0.6, [0, 1], 0.01),
  def('pack.dps', 'HP/s', 2, 6, 12, [0, 200], 0.1),
  def('pack.bleed', '1/s', 0, 0.002, 0.005, [0, 0.1], 0.0005, false),
  def('pack.morale', '0-1', 0.4, 0.6, 0.85, [0, 1], 0.01),
  def('pack.moraleLoss', '0-1', 0.03, 0.08, 0.15, [0, 1], 0.01),
];

export function paramDef(id: ParamId): ParamDef {
  return PARAMS[PARAM_INDEX[id]] as ParamDef;
}

export function defaultParamRanges(): Record<ParamId, Triangular> {
  return Object.fromEntries(PARAMS.map((p) => [p.id, { ...p.default }])) as Record<
    ParamId,
    Triangular
  >;
}
