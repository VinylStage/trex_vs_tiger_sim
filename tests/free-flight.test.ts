import { describe, expect, it } from 'vitest';
import { routShare } from '../src/sim/free/aggregate';
import { defaultFreeConfig, sanitizeFreeConfig } from '../src/sim/free/config';
import { runAllFree } from '../src/sim/free/montecarlo';
import {
  FREE_SPECIES,
  FREE_SPECIES_IDS,
  SPECIES_REVISIONS,
  freeSpeciesAt,
  traitRanges,
} from '../src/sim/free/species';
import { FLIGHT_TRAIT_IDS, TRAIT_IDS } from '../src/sim/free/traits';
import {
  freeConfigDiff,
  freeConfigFromHash,
  freeConfigFromObject,
  hashFromFreeConfig,
} from '../src/ui/share-free';
import { defaultSimpleConfig, hasHiddenEdits, simpleRunConfig } from '../src/ui/simple-model';
import { FREE_PRESETS, presetConfig } from '../src/sim/free/presets';

/*
 * Per-species flight traits of model 2 (#169, docs/SPECIES.md §11.6), the flight mode that turns
 * them on (`realistic`) or off (`allIn`, the default; owner decision 2026-11-16, docs/MODEL.md
 * §3.8) and the polar bear's revised behaviour rows. Model 1 is pinned by the older goldens; model 2 by
 * tests/mv2-golden.test.ts.
 */

describe('flight traits in the registry', () => {
  it('exist for every species from model 2 on, and for none under model 1', () => {
    for (const id of FREE_SPECIES_IDS) {
      expect(FREE_SPECIES[id].flight, id).toBeNull();
      expect(freeSpeciesAt(id, 1)).toBe(FREE_SPECIES[id]);
      expect(freeSpeciesAt(id, 2).flight, id).not.toBeNull();
      expect(SPECIES_REVISIONS[2]?.[id], id).toBeDefined();
    }
  });

  it('are ordered rows with a sensitivity range for every S value', () => {
    for (const id of FREE_SPECIES_IDS) {
      const f = freeSpeciesAt(id, 2).flight;
      if (!f) throw new Error(id);
      for (const k of FLIGHT_TRAIT_IDS) {
        const { range, evidence } = f[k];
        expect(range.min, `${id} ${k}`).toBeLessThanOrEqual(range.mode);
        expect(range.mode, `${id} ${k}`).toBeLessThanOrEqual(range.max);
        if (evidence === 'S') expect(range.max, `${id} ${k}`).toBeGreaterThan(range.min);
        expect(evidence, `${id} ${k}`).not.toBe('U');
      }
      expect(f.threatRatio.range.mode, id).toBeGreaterThanOrEqual(1);
      expect(f.threatTime.range.mode, id).toBeGreaterThan(0);
    }
  });

  it('give the solitary shock to non-social species only (social ones keep the pack layer)', () => {
    for (const id of FREE_SPECIES_IDS) {
      const s = freeSpeciesAt(id, 2);
      const shock = s.flight?.soloShock;
      if (s.social)
        expect(shock, id).toEqual({ range: { min: 0, mode: 0, max: 0 }, evidence: null });
      else expect(shock?.range.mode, id).toBeGreaterThan(0);
    }
  });

  it('keep every trait row of model 1, except the polar bear behaviour rows of model 2', () => {
    const changed = ['sprintEndurance', 'recoveryTime', 'morale'];
    for (const id of FREE_SPECIES_IDS) {
      for (const k of TRAIT_IDS) {
        const same = !(id === 'polarBear' && changed.includes(k));
        expect(
          freeSpeciesAt(id, 2).traits[k] === FREE_SPECIES[id].traits[k] || !same,
          `${id} ${k}`,
        ).toBe(true);
        if (same) expect(traitRanges(id, 2)[k]).toEqual(traitRanges(id, 1)[k]);
      }
      expect(freeSpeciesAt(id, 2).constants).toEqual(FREE_SPECIES[id].constants);
    }
    expect(traitRanges('polarBear', 1).morale).toEqual({ min: 0.55, mode: 0.75, max: 0.9 });
    expect(traitRanges('polarBear', 2).morale).toEqual({ min: 0.4, mode: 0.6, max: 0.8 });
  });

  it('diff a link against the presets of its own model version', () => {
    for (const mv of [1, 2]) {
      const c = sanitizeFreeConfig({ mv, sides: [{ species: 'polarBear' }, { species: 'tiger' }] });
      expect(freeConfigDiff(c)['a']).toEqual({ sp: 'polarBear', n: 1 });
    }
  });
});

describe('flight in the engine', () => {
  const rout = (mv: number, morale = true, flight?: string): number => {
    const c = sanitizeFreeConfig({
      mv,
      runs: 60,
      morale,
      ...(flight === undefined ? {} : { flight }),
      sides: [{ species: 'trex' }, { species: 'tiger', count: 10 }],
    });
    return routShare(runAllFree(c).summaries);
  };

  it('lets tigers break off against a T. rex under model 2 in realistic mode (#169)', () => {
    expect(rout(1)).toBeLessThan(0.2);
    expect(rout(2, true, 'realistic')).toBeGreaterThan(0.5);
  });

  it('keeps the flight traits inactive in the default allIn mode (owner decision 2026-11-16)', () => {
    expect(rout(2)).toBeLessThan(0.2);
    expect(rout(2, true, 'allIn')).toBe(rout(2));
    // Model 1 has no flight traits, so a flight mode changes nothing there.
    expect(rout(1, true, 'realistic')).toBe(rout(1));
  });

  it('does nothing with morale off: nobody flees in either model or mode', () => {
    expect([rout(1, false), rout(2, false), rout(2, false, 'realistic')]).toEqual([0, 0, 0]);
  });
});

describe('flight mode in the config and the link', () => {
  const sides = [{ species: 'trex' }, { species: 'tiger', count: 10 }];

  it('defaults to allIn, accepts realistic under model 2 and forces allIn under model 1', () => {
    expect(defaultFreeConfig().flight).toBe('allIn');
    expect(sanitizeFreeConfig({ mv: 2, sides }).flight).toBe('allIn');
    expect(sanitizeFreeConfig({ mv: 2, sides, flight: 'realistic' }).flight).toBe('realistic');
    for (const bad of ['REALISTIC', 'all', 1, null, true, '__proto__']) {
      expect(sanitizeFreeConfig({ mv: 2, sides, flight: bad }).flight, String(bad)).toBe('allIn');
    }
    expect(sanitizeFreeConfig({ mv: 1, sides, flight: 'realistic' }).flight).toBe('allIn');
    expect(sanitizeFreeConfig({ sides, flight: 'realistic' }).flight).toBe('allIn');
  });

  it('writes the mode into a link only for realistic under model 2, and reads it back', () => {
    const allIn = sanitizeFreeConfig({ mv: 2, sides });
    const realistic = sanitizeFreeConfig({ mv: 2, sides, flight: 'realistic' });
    expect(freeConfigDiff(allIn)).not.toHaveProperty('flight');
    expect(freeConfigDiff(realistic)['flight']).toBe('realistic');
    expect(freeConfigFromHash(hashFromFreeConfig(realistic))).toEqual(realistic);
    expect(freeConfigFromHash(hashFromFreeConfig(allIn))).toEqual(allIn);
    // The Simple marker stays last.
    expect(Object.keys(freeConfigDiff(realistic, { simple: true })).slice(-2)).toEqual([
      'flight',
      'ui',
    ]);
  });

  it('leaves model 1 links as they were: never written, ignored when present', () => {
    const mv1 = sanitizeFreeConfig({ mv: 1, sides });
    expect(freeConfigDiff(mv1)).not.toHaveProperty('flight');
    const forged = freeConfigFromObject({
      v: 3,
      m: 'free',
      a: { sp: 'trex', n: 1 },
      b: { sp: 'tiger', n: 10 },
      flight: 'realistic',
    });
    expect(forged.mv).toBe(1);
    expect(forged.flight).toBe('allIn');
  });

  it('is allIn for every preset and the cold Simple page', () => {
    expect(defaultSimpleConfig().flight).toBe('allIn');
    for (const p of FREE_PRESETS) expect(presetConfig(p).flight, p.id).toBe('allIn');
  });

  it('is a hidden edit for Simple mode, which always runs allIn', () => {
    const realistic = sanitizeFreeConfig({ mv: 2, sides, flight: 'realistic' });
    expect(simpleRunConfig(realistic, 1).flight).toBe('allIn');
    expect(hasHiddenEdits(realistic)).toBe(true);
    expect(hasHiddenEdits(sanitizeFreeConfig({ mv: 2, sides }))).toBe(false);
  });
});
