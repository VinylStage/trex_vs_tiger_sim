import type { Triangular } from './params';
import type { Rng } from './rng';

/** Inverse CDF of the triangular distribution. `u` in [0, 1]. */
export function triangularInv(u: number, t: Triangular): number {
  const { min, mode, max } = t;
  const range = max - min;
  if (range <= 0) return min;
  const fc = (mode - min) / range;
  if (u < fc) return min + Math.sqrt(u * range * (mode - min));
  return max - Math.sqrt((1 - u) * range * (max - mode));
}

export const INDIVIDUAL_FACTOR_MIN = 0.5;
export const INDIVIDUAL_FACTOR_MAX = 1.5;

/** Multiplicative individual variation: N(1, cv) truncated to [0.5, 1.5]. */
export function individualFactor(rng: Rng, cv: number): number {
  if (cv <= 0) return 1;
  for (let i = 0; i < 16; i++) {
    const f = 1 + cv * rng.normal();
    if (f >= INDIVIDUAL_FACTOR_MIN && f <= INDIVIDUAL_FACTOR_MAX) return f;
  }
  return 1;
}
