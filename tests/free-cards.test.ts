import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../src/i18n/dictionaries';
import {
  CARD_IDS,
  CARDS_BY_MV,
  CARDS_PER_DRAW,
  cardDef,
  cardDrawSeed,
  drawCards,
  isCardEligible,
  type CardDraw,
  type CardPacks,
} from '../src/sim/free/cards';
import { FREE_MODEL_VERSION } from '../src/sim/free/config';
import { bannedIn } from './banned-words';

/** Variable-card catalogue (#173; docs/design/RENEWAL-1.0.md §4.3, §10.1, Appendix B). */

const VERSIONS = Object.keys(CARDS_BY_MV).map(Number);
const ALL: CardPacks = { morale: true, whatIf: true };
const draw = (over: Partial<CardDraw> = {}): CardDraw => ({
  seed: 20261019,
  matchIndex: 0,
  pauseIndex: 0,
  rerollCount: 0,
  ...over,
});

describe('card ids', () => {
  it('are append-only: the wire codes never move', () => {
    // Change this list only by appending. Reordering or removing breaks every logged card.
    expect([...CARD_IDS]).toEqual([
      'downpour',
      'pitch-dark',
      'mud',
      'heatwave',
      'second-wind',
      'rallying-cry',
      'shaken',
      'focus',
      'power-surge',
      'adrenaline',
      'regroup',
      'agitation',
      'giant',
      'pocket',
    ]);
  });

  it('are unique', () => {
    expect(new Set(CARD_IDS).size).toBe(CARD_IDS.length);
  });
});

describe('catalogue', () => {
  it('has a catalogue for every model version this build runs', () => {
    for (let mv = 1; mv <= FREE_MODEL_VERSION; mv++)
      expect(CARDS_BY_MV[mv], `mv ${mv}`).toBeDefined();
  });

  it.each(VERSIONS)('mv %i: a card with a finite duration holds only mul ops', (mv) => {
    for (const [id, def] of Object.entries(CARDS_BY_MV[mv] ?? {})) {
      if (def.durationS === null) continue;
      expect(def.durationS, id).toBeGreaterThan(0);
      expect(
        def.ops.map((o) => o.op),
        id,
      ).toEqual(def.ops.map(() => 'mul'));
    }
  });

  it.each(VERSIONS)('mv %i: every card has ops and finite magnitudes', (mv) => {
    for (const [id, def] of Object.entries(CARDS_BY_MV[mv] ?? {})) {
      expect(def.ops.length, id).toBeGreaterThan(0);
      for (const o of def.ops)
        if ('k' in o) expect(Number.isFinite(o.k) && o.k !== 0, id).toBe(true);
      for (const o of def.ops) if (o.op === 'mul') expect(o.k, id).toBeGreaterThan(0);
    }
  });

  it.each(VERSIONS)('mv %i: maxHp is scaled before hp', (mv) => {
    for (const [id, def] of Object.entries(CARDS_BY_MV[mv] ?? {})) {
      const fields = def.ops.filter((o) => o.op === 'scale').map((o) => o.field);
      if (fields.includes('hp') && fields.includes('maxHp'))
        expect(fields.indexOf('maxHp'), id).toBeLessThan(fields.indexOf('hp'));
    }
  });

  it('mv 1 matches Appendix B', () => {
    const c = CARDS_BY_MV[1];
    expect(c?.downpour).toEqual({
      target: 'both',
      ops: [
        { op: 'mul', field: 'speed', k: 0.8 },
        { op: 'mul', field: 'accuracy', k: 0.85 },
      ],
      durationS: null,
    });
    expect(c?.focus).toEqual({
      target: 'one',
      ops: [{ op: 'mul', field: 'accuracy', k: 1.2 }],
      durationS: 20,
    });
    expect(c?.adrenaline.durationS).toBe(15);
    expect(c?.['power-surge'].durationS).toBe(20);
    expect(c?.regroup.ops).toEqual([{ op: 'addFracMax', field: 'hp', k: 0.15 }]);
    expect(c?.shaken.ops).toEqual([{ op: 'add', field: 'morale', k: -0.2 }]);
    const targets = CARD_IDS.map((id) => c?.[id].target);
    expect(targets.slice(0, 4)).toEqual(['both', 'both', 'both', 'both']);
    expect(new Set(targets.slice(4))).toEqual(new Set(['one']));
    const needs = Object.fromEntries(
      CARD_IDS.filter((id) => c?.[id].needs).map((id) => [id, c?.[id].needs]),
    );
    expect(needs).toEqual({
      'rallying-cry': 'morale',
      shaken: 'morale',
      giant: 'what-if',
      pocket: 'what-if',
    });
  });

  it('looks up a definition by wire code and version', () => {
    expect(cardDef(1, 0)).toBe(CARDS_BY_MV[1]?.downpour);
    expect(cardDef(1, CARD_IDS.indexOf('pocket'))).toBe(CARDS_BY_MV[1]?.pocket);
    for (const code of [-1, CARD_IDS.length, 1.5, Number.NaN])
      expect(cardDef(1, code)).toBeUndefined();
    expect(cardDef(0, 0)).toBeUndefined();
    expect(cardDef(1.5, 0)).toBeUndefined();
    expect(cardDef(FREE_MODEL_VERSION + 1, 0)).toBeUndefined();
  });

  it('checks eligibility against the packs', () => {
    const c = CARDS_BY_MV[1];
    if (!c) throw new Error('no mv 1');
    const none: CardPacks = { morale: false, whatIf: false };
    expect(isCardEligible(c.downpour, none)).toBe(true);
    expect(isCardEligible(c.shaken, none)).toBe(false);
    expect(isCardEligible(c.shaken, { morale: true, whatIf: false })).toBe(true);
    expect(isCardEligible(c.giant, { morale: true, whatIf: false })).toBe(false);
    expect(isCardEligible(c.giant, { morale: false, whatIf: true })).toBe(true);
  });
});

describe('draw', () => {
  it('reproduces for the same inputs', () => {
    for (let i = 0; i < 50; i++) {
      const d = draw({ seed: i * 7919, matchIndex: i % 5, pauseIndex: i % 3, rerollCount: i % 2 });
      expect(drawCards(1, ALL, d)).toEqual(drawCards(1, ALL, d));
    }
  });

  it('pins the draw for fixed inputs', () => {
    // Reproduction from a link depends on these exact cards; a change here is a new `mv` (ADR-0008).
    const ids = (codes: number[]): (string | undefined)[] => codes.map((c) => CARD_IDS[c]);
    expect(ids(drawCards(1, ALL, draw()))).toEqual(['mud', 'downpour', 'pitch-dark']);
    expect(ids(drawCards(1, { morale: false, whatIf: false }, draw({ rerollCount: 1 })))).toEqual([
      'heatwave',
      'mud',
      'power-surge',
    ]);
  });

  it('offers 3 distinct valid codes', () => {
    for (let s = 0; s < 200; s++) {
      const got = drawCards(1, ALL, draw({ seed: s }));
      expect(got).toHaveLength(CARDS_PER_DRAW);
      expect(new Set(got).size).toBe(CARDS_PER_DRAW);
      for (const code of got) expect(cardDef(1, code)).toBeDefined();
    }
  });

  it('seeds from every input, including the reroll count', () => {
    const base = cardDrawSeed(draw());
    for (const key of ['seed', 'matchIndex', 'pauseIndex', 'rerollCount'] as const)
      expect(cardDrawSeed(draw({ [key]: 1 })), key).not.toBe(base);
    const offers = new Set(
      [0, 1, 2, 3].map((r) => JSON.stringify(drawCards(1, ALL, draw({ rerollCount: r })))),
    );
    expect(offers.size).toBeGreaterThan(1);
  });

  it.each([
    [{ morale: false, whatIf: false }, ['rallying-cry', 'shaken', 'giant', 'pocket']],
    [{ morale: true, whatIf: false }, ['giant', 'pocket']],
    [{ morale: false, whatIf: true }, ['rallying-cry', 'shaken']],
    [{ morale: true, whatIf: true }, []],
  ] as const)('respects eligibility %o', (packs, excluded) => {
    const seen = new Set<string>();
    for (let s = 0; s < 400; s++)
      for (const code of drawCards(1, packs, draw({ seed: s }))) seen.add(CARD_IDS[code] ?? '?');
    for (const id of excluded) expect(seen.has(id), id).toBe(false);
    // Every eligible card turns up somewhere.
    expect(seen.size).toBe(CARD_IDS.length - excluded.length);
  });

  it('offers nothing for a model version without a catalogue', () => {
    expect(drawCards(FREE_MODEL_VERSION + 1, ALL, draw())).toEqual([]);
    expect(drawCards(0, ALL, draw())).toEqual([]);
    expect(drawCards(0.5, ALL, draw())).toEqual([]);
  });
});

describe('card text', () => {
  const texts = (lang: 'ko' | 'en'): [string, string][] =>
    Object.entries(DICTIONARIES[lang]).filter(([k]) => k.startsWith('card.'));

  it.each(['ko', 'en'] as const)('%s has a name and an effect for every card', (lang) => {
    const keys = new Set(texts(lang).map(([k]) => k));
    for (const id of CARD_IDS) {
      expect(keys.has(`card.${id}.name`), id).toBe(true);
      expect(keys.has(`card.${id}.effect`), id).toBe(true);
    }
  });

  it.each(['ko', 'en'] as const)('%s labels every what-if card, and only those', (lang) => {
    const label = DICTIONARIES[lang]['card.whatIf'];
    const c = CARDS_BY_MV[FREE_MODEL_VERSION];
    for (const id of CARD_IDS) {
      const name = DICTIONARIES[lang][`card.${id}.name`];
      expect(name.includes(label), id).toBe(c?.[id].needs === 'what-if');
    }
  });

  it.each(['ko', 'en'] as const)('%s card text passes the banned-words check', (lang) => {
    expect(texts(lang).filter(([, v]) => bannedIn(v) !== null)).toEqual([]);
  });
});
