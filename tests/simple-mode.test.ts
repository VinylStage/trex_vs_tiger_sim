import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/sim/config';
import {
  FREE_LIMITS,
  defaultFreeConfig,
  freeMaxRunsFor,
  sanitizeFreeConfig,
} from '../src/sim/free/config';
import { PRESET_LIMITS, presetConfig, readyPresets } from '../src/sim/free/presets';
import { FREE_SPECIES, FREE_SPECIES_IDS } from '../src/sim/free/species';
import {
  withBuffSwitch,
  withNumber,
  withSideCount,
  withSideSpecies,
} from '../src/ui/free-form-model';
import { freeConfigFromHash, hashFromFreeConfig } from '../src/ui/share-free';
import {
  COUNT_CHIPS,
  countChips,
  defaultSimpleConfig,
  freshSeed,
  hasHiddenEdits,
  matchingPreset,
  simpleRunConfig,
} from '../src/ui/simple-model';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';

/* Simple mode on the play page (docs/design/RENEWAL-1.0.md §3.2, #146): the pure part. */

describe('count chips', () => {
  it('are the design’s 1 · 2 · 5 · 10 · 50 · 100 · 1,000, all within the side cap', () => {
    expect(COUNT_CHIPS).toEqual([1, 2, 5, 10, 50, 100, 1000]);
    for (const n of COUNT_CHIPS) expect(n).toBeLessThanOrEqual(FREE_LIMITS.sideCount[1]);
  });

  it.each(FREE_SPECIES_IDS)('%s: stop at 100 for a social species (R4), else reach 1,000', (sp) => {
    const chips = countChips(sp);
    if (FREE_SPECIES[sp].social) {
      expect(Math.max(...chips)).toBe(PRESET_LIMITS.socialCount);
      expect(chips).not.toContain(1000);
    } else {
      expect(chips).toEqual([...COUNT_CHIPS]);
    }
  });
});

describe('simple run config', () => {
  it('keeps species and counts, takes the seed and resets everything Simple does not show', () => {
    let c = defaultFreeConfig();
    c = withSideSpecies(c, 0, 'wolf');
    c = withSideCount(c, 0, 8);
    c = withSideSpecies(c, 1, 'brownBear');
    c = withBuffSwitch(c, 'relief', false);
    c = withNumber(c, 'runs', 120);
    c = withNumber(c, 'arenaSize', 300);
    const r = simpleRunConfig(c, 12345);
    expect(r.sides.map((s) => [s.species, s.count])).toEqual([
      ['wolf', 8],
      ['brownBear', 1],
    ]);
    expect(r.seed).toBe(12345);
    const expected = sanitizeFreeConfig({
      sides: [
        { species: 'wolf', count: 8 },
        { species: 'brownBear', count: 1 },
      ],
      seed: 12345,
    });
    expect(r).toEqual(expected);
    expect(r.packBuff.relief).toBe(true);
    expect(r.arenaSize).toBe(defaultFreeConfig().arenaSize);
  });

  it('lets the work budget lower the run count of a large matchup', () => {
    let c = defaultSimpleConfig();
    c = withSideCount(withSideSpecies(c, 0, 'wolf'), 0, 5000);
    c = withSideCount(withSideSpecies(c, 1, 'tiger'), 1, 500);
    const r = simpleRunConfig(c, 1);
    expect(freeMaxRunsFor(r)).toBeLessThan(defaultFreeConfig().runs);
    expect(r.runs).toBe(freeMaxRunsFor(r));
  });

  it('is what a preset opens with that seed, for every shown preset', () => {
    for (const p of readyPresets()) {
      expect(simpleRunConfig(presetConfig(p), 77)).toEqual(presetConfig(p, 77));
    }
  });

  it('survives a v3 link unchanged, seed included (R3: the link reproduces the run)', () => {
    const r = simpleRunConfig(defaultSimpleConfig(), 4_000_000_000);
    expect(freeConfigFromHash(hashFromFreeConfig(r))).toEqual(r);
  });
});

describe('presets in Simple mode', () => {
  it('finds the shown preset a config matches, and none for other counts', () => {
    for (const p of readyPresets()) expect(matchingPreset(presetConfig(p))?.id).toBe(p.id);
    const off = withSideCount(defaultSimpleConfig(), 0, 2);
    expect(matchingPreset(off)).toBeUndefined();
  });

  it('never shows a held preset', () => {
    for (const p of readyPresets()) expect(p.hold).toBeUndefined();
    expect(readyPresets().map((p) => p.id)).not.toContain('pride-five-tigers');
  });

  it('lands on the lion vs tiger preset', () => {
    expect(matchingPreset(defaultSimpleConfig())?.id).toBe('lion-tiger');
    expect(hasHiddenEdits(defaultSimpleConfig())).toBe(false);
  });
});

describe('hidden edits', () => {
  it('are reported for Advanced edits Simple would not run, never for the seed', () => {
    const c = defaultSimpleConfig();
    expect(hasHiddenEdits(withNumber(c, 'seed', 99))).toBe(false);
    expect(hasHiddenEdits(withSideSpecies(c, 1, 'wolf'))).toBe(false);
    expect(hasHiddenEdits(withNumber(c, 'runs', 50))).toBe(true);
    expect(hasHiddenEdits(withBuffSwitch(withSideSpecies(c, 0, 'wolf'), 'focus', false))).toBe(
      true,
    );
  });
});

describe('fresh seed', () => {
  it('maps [0, 1) onto the whole seed range', () => {
    expect(freshSeed(() => 0)).toBe(LIMITS.seed[0]);
    expect(freshSeed(() => 0.999_999_999_9)).toBe(LIMITS.seed[1]);
    expect(freshSeed(() => 0.5)).toBe(2 ** 31);
  });

  it('draws from crypto by default, an integer in range', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => freshSeed()));
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(LIMITS.seed[0]);
      expect(s).toBeLessThanOrEqual(LIMITS.seed[1]);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('Simple mode words', () => {
  const keys = (d: Record<string, string>): string[] =>
    Object.keys(d).filter((k) => k.startsWith('simple.') || k.startsWith('view.'));

  it('exist in both languages with the same keys', () => {
    expect(keys(ko).length).toBeGreaterThan(0);
    expect(keys(en)).toEqual(keys(ko));
  });

  it('use neutral words only (CONTRIBUTING.md content framing rules)', () => {
    const banned = /학살|도륙|피|잔혹|죽|사망|massacre|gore|blood|kill|dead|death|die/i;
    for (const d of [ko, en] as Record<string, string>[]) {
      for (const k of keys(d)) expect(d[k], k).not.toMatch(banned);
    }
  });
});
