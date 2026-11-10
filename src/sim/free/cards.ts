import { Rng, deriveSeed } from '../rng.ts';

/**
 * Variable cards of the free model (docs/design/RENEWAL-1.0.md §4.3, §10.1 and Appendix B;
 * ADR-0008). Pure data and functions: nothing here changes the engine. An intervention log stores
 * a card's code, and the catalogue of the link's model version (`mv`) defines what the card does,
 * so a retune is a new `mv` with the old catalogue kept.
 *
 * Magnitudes are game assumptions, not biology. Card text lives in `src/i18n/*` under
 * `card.<id>.name` and `card.<id>.effect`.
 */

/** Card ids. Append-only: the index is the wire code, so never reorder or remove an entry. */
export const CARD_IDS = [
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
] as const;
export type CardId = (typeof CARD_IDS)[number];

/** Trait fields a `mul` op scales for the card's duration. */
export type TraitField = 'speed' | 'accuracy' | 'power' | 'turn';
/** State fields the instant ops change. */
export type StateField = 'hp' | 'maxHp' | 'stamina' | 'morale';

/** One effect of a card; Appendix B gives the semantics. */
export type CardOp =
  /** Trait multiplier, active for the card's duration; recomputed from base on start or expiry. */
  | { op: 'mul'; field: TraitField; k: number }
  /** Instant: value × k, then clamped. Never undone. */
  | { op: 'scale'; field: StateField; k: number }
  /** Instant: value + k, then clamped. Never undone. */
  | { op: 'add'; field: 'morale'; k: number }
  /** Instant: + k × maxHp, active agents only, never above maxHp. */
  | { op: 'addFracMax'; field: 'hp'; k: number }
  /** Instant: stamina set to its maximum. */
  | { op: 'setMax'; field: 'stamina' };

export interface CardDef {
  /** `both` is logged as side 2; `one` as side 0 or 1. */
  target: 'both' | 'one';
  /** Applied in this order. */
  ops: readonly CardOp[];
  /**
   * Seconds the `mul` ops stay active; null = rest of the battle. An instant card (instant ops
   * only) also has null: it has nothing that stays active. A finite duration holds only `mul` ops.
   */
  durationS: number | null;
  /** Offered only when morale is on, or only when the what-if pack is on. */
  needs?: 'morale' | 'what-if';
}

export type CardCatalogue = Readonly<Record<CardId, CardDef>>;

/** Model version 1 (Appendix B). */
const CARDS_MV1: CardCatalogue = {
  downpour: {
    target: 'both',
    ops: [
      { op: 'mul', field: 'speed', k: 0.8 },
      { op: 'mul', field: 'accuracy', k: 0.85 },
    ],
    durationS: null,
  },
  'pitch-dark': {
    target: 'both',
    ops: [{ op: 'mul', field: 'accuracy', k: 0.8 }],
    durationS: null,
  },
  mud: {
    target: 'both',
    ops: [
      { op: 'mul', field: 'speed', k: 0.7 },
      { op: 'mul', field: 'turn', k: 0.8 },
    ],
    durationS: null,
  },
  heatwave: { target: 'both', ops: [{ op: 'scale', field: 'stamina', k: 0.5 }], durationS: null },
  'second-wind': { target: 'one', ops: [{ op: 'setMax', field: 'stamina' }], durationS: null },
  'rallying-cry': {
    target: 'one',
    ops: [{ op: 'add', field: 'morale', k: 0.2 }],
    durationS: null,
    needs: 'morale',
  },
  shaken: {
    target: 'one',
    ops: [{ op: 'add', field: 'morale', k: -0.2 }],
    durationS: null,
    needs: 'morale',
  },
  focus: { target: 'one', ops: [{ op: 'mul', field: 'accuracy', k: 1.2 }], durationS: 20 },
  'power-surge': { target: 'one', ops: [{ op: 'mul', field: 'power', k: 1.3 }], durationS: 20 },
  adrenaline: { target: 'one', ops: [{ op: 'mul', field: 'speed', k: 1.25 }], durationS: 15 },
  regroup: { target: 'one', ops: [{ op: 'addFracMax', field: 'hp', k: 0.15 }], durationS: null },
  agitation: {
    target: 'one',
    ops: [
      { op: 'mul', field: 'speed', k: 1.15 },
      { op: 'mul', field: 'accuracy', k: 0.9 },
    ],
    durationS: null,
  },
  // maxHp before hp, so the hp ≤ maxHp clamp never cuts the new value.
  giant: {
    target: 'one',
    ops: [
      { op: 'scale', field: 'maxHp', k: 1.5 },
      { op: 'scale', field: 'hp', k: 1.5 },
      { op: 'mul', field: 'power', k: 1.5 },
      { op: 'mul', field: 'speed', k: 0.85 },
    ],
    durationS: null,
    needs: 'what-if',
  },
  pocket: {
    target: 'one',
    ops: [
      { op: 'scale', field: 'maxHp', k: 0.6 },
      { op: 'scale', field: 'hp', k: 0.6 },
      { op: 'mul', field: 'speed', k: 1.3 },
    ],
    durationS: null,
    needs: 'what-if',
  },
};

/**
 * Card catalogue per model version (ADR-0008 §5). Old versions are kept, never edited. Model 2
 * (#169, #197) changed the engine's math and flight, not the cards, so it shares model 1's
 * catalogue.
 */
export const CARDS_BY_MV: Readonly<Record<number, CardCatalogue>> = { 1: CARDS_MV1, 2: CARDS_MV1 };

/** The catalogue of model version `mv`; only an integer key is looked up, never a prototype one. */
const catalogueFor = (mv: number): CardCatalogue | undefined =>
  Number.isInteger(mv) ? CARDS_BY_MV[mv] : undefined;

/** The definition of wire code `code` under model version `mv`, or undefined if it has none. */
export function cardDef(mv: number, code: number): CardDef | undefined {
  const id = Number.isInteger(code) ? CARD_IDS[code] : undefined;
  return id === undefined ? undefined : catalogueFor(mv)?.[id];
}

/** Which packs are on for a draw: morale cards need morale, what-if cards the what-if pack. */
export interface CardPacks {
  morale: boolean;
  whatIf: boolean;
}

export const isCardEligible = (def: CardDef, packs: CardPacks): boolean =>
  def.needs === undefined || (def.needs === 'morale' ? packs.morale : packs.whatIf);

/** Cards offered per pause (§4.3). */
export const CARDS_PER_DRAW = 3;

/** Inputs of one draw; `seed` is the cup seed or the match seed. */
export interface CardDraw {
  seed: number;
  matchIndex: number;
  pauseIndex: number;
  rerollCount: number;
}

/**
 * Seed of a draw. `deriveSeed` takes one stream and one salt, so the four inputs are folded in two
 * steps: (seed, matchIndex, pauseIndex), then rerollCount as the stream of that result.
 */
export const cardDrawSeed = (d: CardDraw): number =>
  deriveSeed(deriveSeed(d.seed, d.matchIndex, d.pauseIndex), d.rerollCount);

/**
 * Offers up to 3 distinct eligible cards of model version `mv`, as wire codes in draw order. The
 * same inputs always give the same cards. Fewer come back only if fewer are eligible; an unknown
 * `mv` offers none. The side of a one-side card is chosen by the player, not drawn.
 */
export function drawCards(mv: number, packs: CardPacks, d: CardDraw): number[] {
  const catalogue = catalogueFor(mv);
  if (!catalogue) return [];
  const pool: number[] = [];
  CARD_IDS.forEach((id, code) => {
    if (isCardEligible(catalogue[id], packs)) pool.push(code);
  });
  const rng = new Rng(cardDrawSeed(d));
  const n = Math.min(CARDS_PER_DRAW, pool.length);
  // Partial Fisher–Yates over the pool in code order.
  for (let i = 0; i < n; i++) {
    const j = i + rng.int(pool.length - i);
    const t = pool[i] as number;
    pool[i] = pool[j] as number;
    pool[j] = t;
  }
  return pool.slice(0, n);
}
