import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeConfig, type ScenarioConfig } from '../src/sim/config';
import { CONSTANTS, heavyMoraleEffects, simulateBattle } from '../src/sim/engine';
import { EVENT_STRIDE, EventType, eventType } from '../src/sim/events';
import { buildDesign, designRow } from '../src/sim/sampling';
import { HEAVY_SPECIES_IDS, type HeavySpeciesId } from '../src/sim/species';
import { expectGoldenCase, type GoldenCase } from './golden-helpers';

/**
 * The `intimidation` constant (#47): a heavy's hits and shake-offs cost a pack animal
 * base × intimidation morale, and the minimum recovery after a hit scales the same way.
 */
describe('heavy morale effects', () => {
  it('scales the shared constants by exactly 0.02 for the heavy Homo erectus', () => {
    expect(heavyMoraleEffects('homoErectus')).toEqual({
      woundMoraleLoss: CONSTANTS.woundMoraleLoss * 0.02,
      throwMoraleLoss: CONSTANTS.throwMoraleLoss * 0.02,
      hitRecoverTime: CONSTANTS.recoverMinTime * 0.02,
    });
  });

  it('keeps the shared constants exactly for every other heavy', () => {
    for (const id of HEAVY_SPECIES_IDS.filter((s) => s !== 'homoErectus')) {
      const e = heavyMoraleEffects(id);
      expect(Object.is(e.woundMoraleLoss, CONSTANTS.woundMoraleLoss), id).toBe(true);
      expect(Object.is(e.throwMoraleLoss, CONSTANTS.throwMoraleLoss), id).toBe(true);
      expect(Object.is(e.hitRecoverTime, CONSTANTS.recoverMinTime), id).toBe(true);
    }
  });
});

describe('morale lost to a hit in a battle', () => {
  /**
   * One heavy against one pack animal that never latches, with certain hits that do almost no
   * damage, no individual variation and fixed morale 0.3. A full hit (−0.25) routs it at once
   * (0.05 < 0.2); 0.02 of that (−0.005 per hit) cannot rout it within the 30 s cap, which allows
   * at most six hits at a 5 s interval (0.3 − 6 × 0.005 = 0.27).
   */
  const duel = (heavySpecies: HeavySpeciesId): ScenarioConfig => {
    const c = sanitizeConfig({
      heavySpecies,
      packSpecies: 'tiger',
      heavyCount: 1,
      packCount: 1,
      runs: 1,
      maxTime: 30,
      individualCV: 0,
      packTactic: 'direct',
    });
    const fix = (id: keyof ScenarioConfig['params'], v: number): void => {
      c.params[id] = { min: v, mode: v, max: v };
    };
    fix('heavy.biteAccuracy', 1);
    fix('heavy.biteInterval', 5);
    fix('heavy.biteLethality', 0.1);
    fix('heavy.biteArc', 180);
    fix('heavy.shakeRate', 0);
    fix('pack.latchChance', 0);
    fix('pack.morale', 0.3);
    fix('pack.moraleLoss', 0);
    return c;
  };
  const run = (c: ScenarioConfig) => {
    const out = simulateBattle(c, designRow(buildDesign(c), 0), 0, true);
    const ev = out.trace?.events ?? new Uint16Array();
    let hits = 0;
    for (let k = 0; k < ev.length / EVENT_STRIDE; k++) {
      if (eventType(ev, k) === EventType.BiteHit) hits++;
    }
    return { summary: out.summary, hits };
  };

  it('routs the attacker after one full-strength hit (shipped heavies)', () => {
    for (const id of ['brownBear', 'buffalo'] as const) {
      const out = run(duel(id));
      expect(out.hits, id).toBe(1);
      expect(out.summary.packRouted, id).toBe(1);
    }
  });

  it('does not rout it after the same hits from Homo erectus (0.02 × the loss)', () => {
    const out = run(duel('homoErectus'));
    expect(out.hits).toBeGreaterThanOrEqual(2);
    expect(out.summary.packRouted).toBe(0);
    expect(out.summary.packActive).toBe(1);
  });
});

/**
 * Fixed-seed golden for the species added in #47, captured on feat/47-hominin-mammoth after
 * `intimidation` landed. It pins the hominin and mammoth results so a regression to the pre-#47
 * morale rule (or any other drift) fails here. Regenerate only together with a documented,
 * deliberate model change for these species (docs/SPECIES.md §7).
 */
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/species-47-golden.json', import.meta.url), 'utf8'),
) as { capturedFrom: string; cases: GoldenCase[] };

describe(`Homo erectus and mammoth golden (from ${golden.capturedFrom})`, () => {
  it.each(golden.cases)('$name', (g) => {
    expectGoldenCase(g);
  });
});
