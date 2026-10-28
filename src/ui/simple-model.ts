import { LIMITS } from '../sim/config';
import { hashHasAppState } from '../pages/routes';
import { defaultFreeConfig, sanitizeFreeConfig, type FreeConfig } from '../sim/free/config';
import {
  FREE_PRESETS,
  PRESET_LIMITS,
  presetConfig,
  readyPresets,
  type FreePreset,
} from '../sim/free/presets';
import { FREE_SPECIES, type FreeSpeciesId } from '../sim/free/species';

/*
 * Simple mode on the play page (docs/design/RENEWAL-1.0.md §3.2, #146), as pure functions: the
 * count chips, the config a Simple run uses, the preset a config matches and the fresh seed of
 * each Run. DOM-free, so it is unit-tested (tests/simple-mode.test.ts); the view is
 * src/ui/simple-mode.ts.
 */

/** Quick count chips of design §3.2. */
export const COUNT_CHIPS: readonly number[] = [1, 2, 5, 10, 50, 100, 1000];

/**
 * The chips a species gets: a social species stops at `PRESET_LIMITS.socialCount` (100, R4),
 * because its group morale can break all at once; the number field still reaches the engine caps.
 */
export function countChips(species: FreeSpeciesId): number[] {
  return FREE_SPECIES[species].social
    ? COUNT_CHIPS.filter((n) => n <= PRESET_LIMITS.socialCount)
    : [...COUNT_CHIPS];
}

/** The preset a cold play page lands on: preset #1 of design §6, lion vs tiger 1:1. */
export const SIMPLE_DEFAULT_PRESET = 'lion-tiger';

/** The config of a cold play page: the default preset, every other setting at its default. */
export function defaultSimpleConfig(): FreeConfig {
  const p = FREE_PRESETS.find((x) => x.id === SIMPLE_DEFAULT_PRESET);
  if (!p) throw new Error(`missing preset ${SIMPLE_DEFAULT_PRESET}`);
  return presetConfig(p);
}

/** The shown preset whose species and counts the config has, if any. */
export function matchingPreset(c: FreeConfig): FreePreset | undefined {
  const [a, b] = c.sides;
  return readyPresets().find(
    (p) => p.a.sp === a.species && p.a.n === a.count && p.b.sp === b.species && p.b.n === b.count,
  );
}

/**
 * The config a Simple run uses: the config's species and counts, the given seed, the matching
 * preset's run count if it names one, and every setting Simple does not show at its default
 * (trait ranges, buff switches, globals, runs, arena, time limit, CV, sampling, morale). The work
 * budget lowers the run count as for any free config.
 */
export function simpleRunConfig(c: FreeConfig, seed: number): FreeConfig {
  return sanitizeFreeConfig({
    sides: c.sides.map((s) => ({ species: s.species, count: s.count })),
    seed,
    runs: simpleRuns(c),
  });
}

/** The run count Simple asks for: the matching preset's, else the default (before the budget). */
export const simpleRuns = (c: FreeConfig): number =>
  matchingPreset(c)?.runs ?? defaultFreeConfig().runs;

/**
 * The config with the run count the user asked for, lowered by the work budget only as far as
 * these counts need. The sanitizer clamps `runs` to the budget of the counts it sees, so a config
 * that once held large counts keeps the lowered count; Simple edits re-apply the requested count
 * instead, so shrinking the counts gives the full run count back (#146 review).
 */
export const withRequestedRuns = (c: FreeConfig, runs: number): FreeConfig =>
  sanitizeFreeConfig({ ...c, runs });

/**
 * Whether a cold Simple page leaves its address alone (#146): before the first Run or settings
 * link, as long as the fragment holds no app state (`''`, `#`, a plain anchor such as `#main`).
 */
export const simpleKeepsAddress = (hash: string, linked: boolean): boolean =>
  !linked && !hashHasAppState(hash);

/**
 * Whether the config holds settings Simple does not show and would not run (edits made under
 * Advanced). The seed is not one: every Simple run draws a new one.
 */
export function hasHiddenEdits(c: FreeConfig): boolean {
  return JSON.stringify(simpleRunConfig(c, c.seed)) !== JSON.stringify(sanitizeFreeConfig(c));
}

/**
 * Whether Simple mode can show this config whole, so a link of it may carry the Simple-mode
 * marker and reopen in Simple (#154): no hidden edits. This one rule decides both when a link is
 * written with the marker and when a marked link opens Simple, so Simple never opens a config it
 * cannot display; a marked link with hidden edits opens the free form of Advanced mode instead.
 */
export const simpleCanShow = (c: FreeConfig): boolean => !hasHiddenEdits(c);

/** A uniformly random seed in the seed range (R3: a fresh seed per Run). */
export function freshSeed(random: () => number = cryptoRandom): number {
  const [lo, hi] = LIMITS.seed;
  return lo + Math.floor(random() * (hi - lo + 1));
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}
