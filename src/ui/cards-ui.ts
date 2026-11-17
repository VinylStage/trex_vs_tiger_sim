import { CARD_IDS, cardDef, type CardId } from '../sim/free/cards';
import type { InterventionSide } from '../sim/free/interventions';
import { clear, h } from './dom';
import { t, type MsgKey } from './i18n';
import { whatIfElement, whatIfText, type WhatIfShift } from './what-if';

/**
 * The card offer of a pause in Live battle mode (RENEWAL-1.0 §4.3, #183): up to 3 cards, each
 * with its name, its effect in plain words, the what-if tag where it has one, and a button per
 * side it can be played on (one for a card on both sides). Under each button the what-if shift
 * (#182) once it is known. Buttons are native, so the offer works by keyboard; text only.
 */

/** One way to play an offered card. */
export interface CardChoice {
  card: number;
  side: InterventionSide;
}

/** The sides a card can be played on: both (2), or each side (0, 1) for a one-side card. */
export function choicesOf(mv: number, card: number): CardChoice[] {
  const def = cardDef(mv, card);
  if (!def) return [];
  return def.target === 'both'
    ? [{ card, side: 2 }]
    : [
        { card, side: 0 },
        { card, side: 1 },
      ];
}

/** Message keys of a card's name and effect (`card.<id>.name`, `.effect`). */
export function cardKeys(card: number): { name: MsgKey; effect: MsgKey } | null {
  const id: CardId | undefined = CARD_IDS[card];
  if (id === undefined) return null;
  return { name: `card.${id}.name` as MsgKey, effect: `card.${id}.effect` as MsgKey };
}

export interface CardOfferOptions {
  mv: number;
  cards: readonly number[];
  /** Short names of side A and side B for the buttons. */
  sideNames: readonly [string, string];
  /** Shown above the cards ("팽팽한 순간입니다…"). */
  lead: string;
  /** A note under the lead (a gate message), or null. */
  note: string | null;
  canReroll: boolean;
  onPick: (choice: CardChoice) => void;
  onReroll: () => void;
  onSkip: () => void;
}

export interface CardOffer {
  readonly el: HTMLElement;
  /** Fill in the shifts (one per option of `whatIfOptions`), or the pending text while null. */
  setShifts(shifts: readonly WhatIfShift[] | null, pending: boolean): void;
  /** Disable every button (a pick is being applied). */
  lock(): void;
}

let uid = 0;

export function createCardOffer(o: CardOfferOptions): CardOffer {
  const headId = `live-cards-head-${++uid}`;
  const slots = new Map<string, HTMLElement>();
  const buttons: HTMLButtonElement[] = [];
  const keyOf = (c: CardChoice): string => `${c.card}:${c.side}`;
  const list = h('ul', { class: 'live-card-list' });
  for (const card of o.cards) {
    const keys = cardKeys(card);
    const def = cardDef(o.mv, card);
    if (!keys || !def) continue;
    const actions = h('div', { class: 'live-card-actions' });
    for (const choice of choicesOf(o.mv, card)) {
      const label =
        choice.side === 2
          ? t('live.pickBoth')
          : t('live.pickSide', { side: o.sideNames[choice.side] });
      const btn = h('button', {
        class: 'btn btn-small live-card-pick',
        text: label,
        attrs: { type: 'button' },
      });
      btn.addEventListener('click', () => o.onPick(choice));
      buttons.push(btn);
      const slot = h('div', { class: 'live-card-shift' });
      slots.set(keyOf(choice), slot);
      actions.append(h('div', { class: 'live-card-choice' }, btn, slot));
    }
    list.append(
      h(
        'li',
        { class: 'live-card' },
        h(
          'p',
          { class: 'live-card-name' },
          h('strong', { text: t(keys.name) }),
          def.needs === 'what-if'
            ? h('span', { class: 'live-card-tag', text: t('card.whatIf') })
            : null,
        ),
        h('p', { class: 'live-card-effect', text: t(keys.effect) }),
        actions,
      ),
    );
  }
  const reroll = h('button', {
    class: 'btn btn-small',
    text: t('live.reroll'),
    attrs: { type: 'button' },
  });
  reroll.disabled = !o.canReroll;
  reroll.addEventListener('click', () => o.onReroll());
  const skip = h('button', {
    class: 'btn btn-small',
    text: t('live.skip'),
    attrs: { type: 'button' },
  });
  skip.addEventListener('click', () => o.onSkip());
  buttons.push(reroll, skip);
  const el = h(
    'section',
    { class: 'live-cards', attrs: { 'aria-labelledby': headId } },
    h('h4', { id: headId, text: t('live.cardsHead') }),
    h('p', { class: 'live-cards-lead', text: o.lead }),
    o.note ? h('p', { class: 'live-cards-note', text: o.note }) : null,
    list,
    h('p', { class: 'live-card-note', text: t('card.note') }),
    h('div', { class: 'live-cards-tools' }, reroll, skip),
  );
  return {
    el,
    setShifts(shifts, pending) {
      for (const slot of slots.values()) {
        clear(slot);
        if (pending)
          slot.append(h('span', { class: 'live-pending', text: t('live.whatIfPending') }));
      }
      if (!shifts) return;
      for (const s of shifts) {
        const slot = slots.get(keyOf(s));
        if (!slot) continue;
        const name = o.sideNames[s.shownSide];
        clear(slot);
        slot.append(whatIfElement(whatIfText(s, name)));
      }
    },
    lock() {
      for (const b of buttons) b.disabled = true;
    },
  };
}
