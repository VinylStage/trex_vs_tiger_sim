import {
  defaultSide,
  sanitizeFreeConfig,
  type FreeConfig,
  type SideConfig,
} from '../sim/free/config';
import { FREE_SPECIES_IDS, type FreeSpeciesId } from '../sim/free/species';

/*
 * The edits the free-mode form makes (src/ui/free-mode.ts), as pure functions: every edit returns
 * a sanitized config, so what the form shows, what the URL carries and what the workers run are
 * the same object. DOM-free, so it is unit-tested (tests/free-ui-plumbing.test.ts).
 */

export type FreeSideIndex = 0 | 1;
export type FreeNumberSetting = 'runs' | 'seed' | 'arenaSize' | 'maxTime' | 'individualCV';

const withSide = (c: FreeConfig, i: FreeSideIndex, side: SideConfig): FreeConfig => {
  const sides = [...c.sides] as [SideConfig, SideConfig];
  sides[i] = side;
  return sanitizeFreeConfig({ ...c, sides });
};

/** Pick a species for a side: its presets replace the side's ranges; the count stays. */
export function withSideSpecies(c: FreeConfig, i: FreeSideIndex, species: string): FreeConfig {
  if (!(FREE_SPECIES_IDS as readonly string[]).includes(species)) return c;
  return withSide(c, i, defaultSide(species as FreeSpeciesId, c.sides[i].count));
}

/** Set a side's head count (clamped per side and to the total by the sanitizer). */
export function withSideCount(c: FreeConfig, i: FreeSideIndex, n: number): FreeConfig {
  if (!Number.isFinite(n)) return c;
  return withSide(c, i, { ...c.sides[i], count: n });
}

/** Set one of the shared numeric settings (clamped by the sanitizer). */
export function withNumber(c: FreeConfig, key: FreeNumberSetting, n: number): FreeConfig {
  if (!Number.isFinite(n)) return c;
  return sanitizeFreeConfig({ ...c, [key]: n });
}

export function withSampling(c: FreeConfig, sampling: string): FreeConfig {
  return sanitizeFreeConfig({ ...c, sampling });
}

export function withMorale(c: FreeConfig, morale: boolean): FreeConfig {
  return sanitizeFreeConfig({ ...c, morale });
}
