import { describe, expect, it } from 'vitest';
import { routShare } from '../src/sim/free/aggregate';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { runAllFree } from '../src/sim/free/montecarlo';
import {
  FREE_SPECIES,
  FREE_SPECIES_IDS,
  SPECIES_REVISIONS,
  freeSpeciesAt,
  traitRanges,
} from '../src/sim/free/species';
import { FLIGHT_TRAIT_IDS, TRAIT_IDS } from '../src/sim/free/traits';
import { freeConfigDiff } from '../src/ui/share-free';

/*
 * Per-species flight traits of model 2 (#169, docs/SPECIES.md §11.6) and the polar bear's
 * revised behaviour rows. Model 1 is pinned by the older goldens; model 2 by
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
  const rout = (mv: number, morale = true): number => {
    const c = sanitizeFreeConfig({
      mv,
      runs: 60,
      morale,
      sides: [{ species: 'trex' }, { species: 'tiger', count: 10 }],
    });
    return routShare(runAllFree(c).summaries);
  };

  it('lets tigers break off against a T. rex under model 2 (#169)', () => {
    expect(rout(1)).toBeLessThan(0.2);
    expect(rout(2)).toBeGreaterThan(0.5);
  });

  it('does nothing with morale off: nobody flees in either model', () => {
    expect([rout(1, false), rout(2, false)]).toEqual([0, 0]);
  });
});
