export type Species = 'trex' | 'tiger';

export interface Triangular {
  min: number;
  mode: number;
  max: number;
}

export interface ParamDef {
  id: ParamId;
  species: Species;
  unit: string;
  default: Triangular;
  bounds: readonly [number, number];
  step: number;
  /** Individual (aleatory) variation is applied to this parameter. */
  individual: boolean;
}

export const PARAM_IDS = [
  'trex.mass',
  'trex.speed',
  'trex.turnRate',
  'trex.biteForce',
  'trex.biteLethality',
  'trex.biteInterval',
  'trex.biteReach',
  'trex.biteArc',
  'trex.biteAccuracy',
  'trex.shakeRate',
  'trex.bodyRadius',
  'tiger.mass',
  'tiger.sprintSpeed',
  'tiger.cruiseSpeed',
  'tiger.sprintEndurance',
  'tiger.latchEndurance',
  'tiger.recoveryTime',
  'tiger.latchChance',
  'tiger.dps',
  'tiger.bleed',
  'tiger.morale',
  'tiger.moraleLoss',
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
  species: id.startsWith('trex.') ? 'trex' : 'tiger',
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
  def('trex.mass', 'kg', 5650, 8000, 9500, [1000, 20000], 50),
  def('trex.speed', 'm/s', 3.4, 5.5, 8, [0.5, 25], 0.1),
  def('trex.turnRate', 'deg/s', 22, 30, 45, [5, 360], 1),
  def('trex.biteForce', 'kN', 8.5, 35, 57, [1, 150], 0.5),
  def('trex.biteLethality', 'HP/kN', 4, 8, 12, [0.1, 100], 0.1, false),
  def('trex.biteInterval', 's', 1.5, 2.5, 4, [0.2, 30], 0.1),
  def('trex.biteReach', 'm', 4.5, 5.5, 6.5, [1, 15], 0.1),
  def('trex.biteArc', 'deg', 30, 45, 70, [5, 180], 1),
  def('trex.biteAccuracy', 'p', 0.3, 0.5, 0.7, [0, 1], 0.01),
  def('trex.shakeRate', '1/s', 0.05, 0.12, 0.25, [0, 10], 0.01),
  def('trex.bodyRadius', 'm', 2, 2.5, 3, [0.5, 8], 0.1, false),
  def('tiger.mass', 'kg', 100, 180, 260, [30, 500], 5),
  def('tiger.sprintSpeed', 'm/s', 11, 14, 18, [2, 35], 0.1),
  def('tiger.cruiseSpeed', 'm/s', 4, 6, 8, [0.5, 20], 0.1),
  def('tiger.sprintEndurance', 's', 10, 20, 40, [1, 600], 1),
  def('tiger.latchEndurance', 's', 15, 30, 60, [1, 1200], 1),
  def('tiger.recoveryTime', 's', 30, 60, 120, [1, 3600], 1),
  def('tiger.latchChance', 'p', 0.15, 0.35, 0.6, [0, 1], 0.01),
  def('tiger.dps', 'HP/s', 2, 6, 12, [0, 200], 0.1),
  def('tiger.bleed', '1/s', 0, 0.002, 0.005, [0, 0.1], 0.0005, false),
  def('tiger.morale', '0-1', 0.4, 0.6, 0.85, [0, 1], 0.01),
  def('tiger.moraleLoss', '0-1', 0.03, 0.08, 0.15, [0, 1], 0.01),
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
