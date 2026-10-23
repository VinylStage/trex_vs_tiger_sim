import './tour-offer.css';
import { localStorageOrNull } from '../pages/legacy-storage';
import { h, uniqueId } from './dom';
import { readTourFlag, shouldOfferTour, writeTourFlag } from './tour-model';

/*
 * The first-visit tour offer (docs/TUTORIAL.md). It is part of the startup page, so it lives
 * apart from the tour itself (src/ui/tour.ts), which loads only when the tour starts (#80).
 */

export interface TourOffer {
  el: HTMLElement;
  remove(): void;
}

/**
 * The offer, or null when the visitor already started, declined or finished the tour. `onStart`
 * runs on "Start"; the offer removes itself, and the tour records its own flag.
 */
export function createTourOffer(
  onStart: () => void,
  focusAfterDismiss: () => void,
): TourOffer | null {
  const storage = localStorageOrNull();
  if (!shouldOfferTour(readTourFlag(storage))) return null;
  const titleId = uniqueId('tour-offer');
  const startBtn = h('button', {
    class: 'btn btn-primary btn-small',
    i18n: 'tour.offer.start',
    attrs: { type: 'button' },
  });
  const dismissBtn = h('button', {
    class: 'btn btn-ghost btn-small',
    i18n: 'tour.offer.dismiss',
    attrs: { type: 'button' },
  });
  const el = h(
    'aside',
    { class: 'tour-offer', attrs: { 'aria-labelledby': titleId } },
    h(
      'div',
      { class: 'tour-offer-text' },
      h('p', { class: 'tour-offer-title', id: titleId, i18n: 'tour.offer.title' }),
      h('p', { class: 'tour-offer-body', i18n: 'tour.offer.body' }),
    ),
    h('div', { class: 'tour-offer-actions' }, startBtn, dismissBtn),
  );
  const offer: TourOffer = { el, remove: () => el.remove() };
  startBtn.addEventListener('click', () => {
    offer.remove();
    onStart();
  });
  dismissBtn.addEventListener('click', () => {
    writeTourFlag(storage, 'dismissed');
    offer.remove();
    focusAfterDismiss();
  });
  return offer;
}
