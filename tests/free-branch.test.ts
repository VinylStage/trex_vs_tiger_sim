import { describe, expect, it } from 'vitest';
import { DT } from '../src/sim/engine';
import { CARD_IDS } from '../src/sim/free/cards';
import { sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  BRANCH_SALT_MIN,
  simulateFreeBattle,
  type FreeBattleOptions,
  type FreeTrace,
} from '../src/sim/free/engine';
import { designRow } from '../src/sim/sampling';

/*
 * Branch hook of the free engine (#179; RENEWAL-1.0 §10.1, §10.2 point 4, §10.4 step 2). Unset,
 * the engine is unchanged (every golden passes as before; checked again here run by run);
 * set, a branch reproduces, keeps every frame before its tick and diverges after it.
 */

const configs: FreeConfig[] = [
  sanitizeFreeConfig({
    runs: 6,
    sides: [
      { species: 'wolf', count: 8 },
      { species: 'brownBear', count: 1 },
    ],
  }),
  sanitizeFreeConfig({
    runs: 6,
    sides: [
      { species: 'lion', count: 3 },
      { species: 'tiger', count: 2 },
    ],
  }),
];

const sim = (config: FreeConfig, run: number, opts?: FreeBattleOptions) =>
  simulateFreeBattle(config, designRow(buildFreeDesign(config), run), run, true, opts);

const upTo = (trace: FreeTrace | undefined, tick: number) =>
  (trace as FreeTrace).frames.filter((f) => f.t <= tick * DT);

describe('branch hook: unset or invalid changes nothing', () => {
  const invalid: FreeBattleOptions['branch'][] = [
    undefined,
    { tick: 50, salt: 5 },
    { tick: 50, salt: 3 },
    { tick: 50, salt: 6.5 },
    { tick: -1, salt: 6 },
    { tick: 1e9, salt: 6 },
    { tick: 2.5, salt: 6 },
    { tick: Number.NaN, salt: 6 },
  ];
  for (const config of configs) {
    it(`${config.sides[0].species} v ${config.sides[1].species}`, () => {
      for (let run = 0; run < config.runs; run++) {
        const plain = sim(config, run);
        for (const branch of invalid)
          expect(sim(config, run, branch ? { branch } : {})).toEqual(plain);
      }
    });
  }
});

describe('branch hook: set', () => {
  it('reproduces for the same inputs', () => {
    for (const config of configs) {
      for (const branch of [
        { tick: 0, salt: 6 },
        { tick: 40, salt: 7 },
        { tick: 120, salt: 37 },
      ]) {
        expect(sim(config, 2, { branch })).toEqual(sim(config, 2, { branch }));
      }
    }
  });

  it('keeps every frame up to the branch tick identical to the parent', () => {
    for (const config of configs) {
      for (let run = 0; run < config.runs; run++) {
        const parent = sim(config, run);
        for (const tick of [0, 30, 100, 155]) {
          const out = sim(config, run, { branch: { tick, salt: 6 + run } });
          expect(upTo(out.trace, tick)).toEqual(upTo(parent.trace, tick));
        }
      }
    }
  });

  it('keeps the parent prefix under an intervention log too', () => {
    const config = configs[0] as FreeConfig;
    const interventions = [{ tick: 60, card: CARD_IDS.indexOf('mud'), side: 2 as const }];
    const parent = sim(config, 1, { interventions });
    const out = sim(config, 1, { interventions, branch: { tick: 90, salt: 9 } });
    expect(upTo(out.trace, 90)).toEqual(upTo(parent.trace, 90));
  });

  it('diverges after the tick, and different salts give different branches', () => {
    for (const config of configs) {
      const tick = 20;
      const parent = sim(config, 0);
      const outs = Array.from(
        { length: 8 },
        (_, j) => sim(config, 0, { branch: { tick, salt: BRANCH_SALT_MIN + j } }).summary,
      );
      // At least one branch ends differently from the parent, and the branches are not all one.
      expect(outs.some((s) => s.duration !== parent.summary.duration)).toBe(true);
      expect(new Set(outs.map((s) => s.duration)).size).toBeGreaterThan(1);
    }
  });
});
