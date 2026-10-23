import './tour.css';
import { localStorageOrNull } from '../pages/legacy-storage';
import { h, uniqueId } from './dom';
import { getLang, onLangChange, t, type MsgKey } from './i18n';
import {
  DEMO_RUNS,
  TOUR_STEPS,
  findStep,
  guideHref,
  inflateRect,
  intersectRect,
  mergeRects,
  expandNow,
  placePopover,
  readTourFlag,
  resolveStep,
  stepCounter,
  unionRect,
  writeTourFlag,
  type Rect,
  type TourFlag,
  type TourStep,
} from './tour-model';

/** What the tour needs from the app to offer the quick demo. */
export interface TourHost {
  hasResults(): boolean;
  isRunning(): boolean;
  /** Set the run count to DEMO_RUNS and run; resolves true once fresh results are rendered. */
  runDemo(): Promise<boolean>;
}

export interface Tour {
  /** Open the tour at its first available step (no-op while it is open). */
  start(): void;
  isOpen(): boolean;
  /**
   * Tell the open tour that the results or the run state changed. It re-renders the current step,
   * or moves on when that step is no longer available (the results preview once results exist).
   */
  refresh(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Space between a target and the edge of its spotlight hole (px). */
const HOLE_PAD = 6;
const HOLE_RADIUS = 10;
/** Holes closer than this (px) are merged into one. */
const MERGE_GAP = 24;

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function tourElements(id: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`)];
}

/** Rendered (not `display: none` or inside a hidden ancestor). */
const isShown = (el: Element): boolean => el.isConnected && el.getClientRects().length > 0;

const isVisible = (id: string): boolean => tourElements(id).some(isShown);

const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/** The part of `el` that is not clipped by a scrolling ancestor or the viewport. */
function visibleRect(el: Element, viewport: Rect): Rect | null {
  let r: Rect | null = toRect(el.getBoundingClientRect());
  for (let p = el.parentElement; r && p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      r = intersectRect(r, toRect(p.getBoundingClientRect()));
    }
  }
  return r && intersectRect(r, viewport);
}

/** Scrollable ancestors of `el`, innermost first, ending with the document scroller. */
function scrollContainers(el: Element): Element[] {
  const out: Element[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/auto|scroll/.test(`${cs.overflowX} ${cs.overflowY}`)) out.push(p);
  }
  if (document.scrollingElement) out.push(document.scrollingElement);
  return out;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function setRectAttrs(el: SVGRectElement, r: Rect): void {
  el.setAttribute('x', String(r.x));
  el.setAttribute('y', String(r.y));
  el.setAttribute('width', String(Math.max(0, r.w)));
  el.setAttribute('height', String(Math.max(0, r.h)));
}

/** `aria-disabled` keeps the button focusable, so focus never drops out of the dialog. */
function setDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  if (disabled) btn.setAttribute('aria-disabled', 'true');
  else btn.removeAttribute('aria-disabled');
}

const isDisabled = (btn: HTMLButtonElement): boolean =>
  btn.getAttribute('aria-disabled') === 'true';

/**
 * Guided tour over the simulator page. Steps come from `TOUR_STEPS` and anchor to elements with
 * matching `data-tour` attributes. Rendered as a full-viewport modal `<dialog>`: an SVG mask dims
 * the page and cuts a hole around each target, and a popover holds the text and the controls.
 * Everything is positioned through the CSSOM, so it works under the strict CSP.
 */
export function createTour(host: TourHost, steps: readonly TourStep[] = TOUR_STEPS): Tour {
  const storage = localStorageOrNull();
  /** Fallback when localStorage is unavailable: remember the choice for this page load. */
  let sessionFlag: TourFlag | null = null;

  let open = false;
  let index = -1;
  let returnFocus: HTMLElement | null = null;
  let expanded: { id: string; wasOpen: boolean } | null = null;
  let demo: 'idle' | 'running' | 'failed' = 'idle';
  let raf = 0;
  /** Scroll containers the last step scrolled smoothly (their animation may still be running). */
  let scrolled: Element[] = [];

  // ---------- DOM ----------
  const maskId = uniqueId('tour-mask');
  const titleId = uniqueId('tour-title');
  const bodyId = uniqueId('tour-body');
  const mask = svg('mask', { id: maskId });
  mask.append(svg('rect', { width: '100%', height: '100%', fill: 'white' }));
  const dim = svg('rect', {
    class: 'tour-dim',
    width: '100%',
    height: '100%',
    mask: `url(#${maskId})`,
  });
  const defs = svg('defs', {});
  defs.append(mask);
  const backdrop = svg('svg', { class: 'tour-backdrop', 'aria-hidden': 'true' });
  backdrop.append(defs, dim);
  const holes: SVGRectElement[] = [];
  const rings: HTMLDivElement[] = [];
  const ringLayer = h('div', { class: 'tour-rings', attrs: { 'aria-hidden': 'true' } });

  const counter = h('p', { class: 'tour-count' });
  const progressFill = h('span', { class: 'tour-progress-fill' });
  const progress = h(
    'span',
    { class: 'tour-progress', attrs: { 'aria-hidden': 'true' } },
    progressFill,
  );
  const titleEl = h('h2', { class: 'tour-title', id: titleId });
  const bodyEl = h('p', { class: 'tour-body', id: bodyId });
  const noteEl = h('p', { class: 'tour-note' });
  const demoBtn = h('button', { class: 'btn btn-small tour-demo', attrs: { type: 'button' } });
  const guideLink = h('a', { class: 'tour-guide' });
  const extraEl = h('div', { class: 'tour-extra' });
  const skipBtn = h('button', { class: 'btn btn-ghost btn-small', attrs: { type: 'button' } });
  const backBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  const nextBtn = h('button', { class: 'btn btn-primary btn-small', attrs: { type: 'button' } });
  // Sticky at the bottom of the popover (tour.css), so it stays visible when the popover scrolls.
  const nav = h('div', { class: 'tour-nav' }, skipBtn, backBtn, nextBtn);
  const pop = h(
    'div',
    { class: 'tour-pop' },
    h('div', { class: 'tour-head' }, counter, progress),
    titleEl,
    bodyEl,
    extraEl,
    nav,
  );
  const live = h('p', {
    class: 'visually-hidden',
    attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  const dialog = h(
    'dialog',
    {
      class: 'tour',
      attrs: { 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': bodyId },
    },
    backdrop,
    ringLayer,
    pop,
    live,
  );

  const schedule = (): void => {
    if (open && !raf) raf = requestAnimationFrame(layout);
  };
  const ro = new ResizeObserver(schedule);

  // ---------- flag ----------
  function currentFlag(): TourFlag | null {
    return readTourFlag(storage) ?? sessionFlag;
  }

  function remember(flag: TourFlag): void {
    if (sessionFlag !== 'completed') sessionFlag = flag;
    writeTourFlag(storage, flag);
  }

  // ---------- steps ----------
  const step = (): TourStep | undefined => steps[index];

  function restoreExpanded(): void {
    if (!expanded) return;
    const { id, wasOpen } = expanded;
    expanded = null;
    for (const el of tourElements(id)) if (el instanceof HTMLDetailsElement) el.open = wasOpen;
  }

  function show(i: number): void {
    stopScrolling();
    restoreExpanded();
    index = i;
    const s = step();
    if (!s) return;
    if (s.expand) {
      const d = tourElements(s.expand).find((el) => el instanceof HTMLDetailsElement);
      if (d instanceof HTMLDetailsElement) {
        expanded = { id: s.expand, wasOpen: d.open };
        expandNow(d);
      }
    }
    render();
    pop.scrollTop = 0;
    ro.disconnect();
    ro.observe(document.body);
    ro.observe(pop);
    for (const id of s.targets) for (const el of tourElements(id)) ro.observe(el);
    scrollToTargets(s);
    announce();
    animateIn();
    schedule();
  }

  function go(dir: 1 | -1): void {
    const next = findStep(steps, isVisible, index, dir);
    if (next >= 0) show(next);
  }

  function refresh(): void {
    if (!open) return;
    const target = resolveStep(steps, isVisible, index);
    if (target >= 0 && target !== index) {
      show(target);
    } else {
      render();
      schedule();
    }
  }

  function isLast(): boolean {
    return findStep(steps, isVisible, index, 1) < 0;
  }

  function render(): void {
    const s = step();
    if (!s) return;
    const { n, total } = stepCounter(steps, isVisible, index);
    counter.textContent = t('tour.counter', { n, total });
    progressFill.style.transform = `scaleX(${total > 0 ? n / total : 0})`;
    titleEl.textContent = t(s.title);
    bodyEl.textContent = t(s.body);
    const last = isLast();
    setDisabled(backBtn, findStep(steps, isVisible, index, -1) < 0);
    backBtn.textContent = t('tour.back');
    nextBtn.textContent = t(last ? 'tour.done' : 'tour.next');
    skipBtn.textContent = t('tour.skip');
    skipBtn.hidden = last;
    renderExtra(s);
    keepFocusInside();
  }

  function renderExtra(s: TourStep): void {
    const items: HTMLElement[] = [];
    if (s.extra === 'demo') {
      let note: MsgKey | null = null;
      let showButton = false;
      if (demo === 'running') {
        note = 'tour.demoRunning';
        showButton = true;
      } else if (host.hasResults()) {
        note = 'tour.hasResults';
      } else if (!host.isRunning()) {
        note = demo === 'failed' ? 'tour.demoFailed' : 'tour.demoHint';
        showButton = true;
      }
      if (note) {
        noteEl.textContent = t(note, { n: DEMO_RUNS });
        items.push(noteEl);
      }
      if (showButton) {
        demoBtn.textContent = t('tour.demo', { n: DEMO_RUNS });
        setDisabled(demoBtn, demo === 'running');
        demoBtn.classList.toggle('is-busy', demo === 'running');
        items.push(demoBtn);
      }
    } else if (s.extra === 'guide') {
      guideLink.href = guideHref(getLang());
      guideLink.textContent = t('tour.guide');
      items.push(guideLink);
    }
    // Re-attach only when the set of elements changes: detaching the focused demo button would
    // drop focus to the dialog (and keepFocusInside would then move it to Next).
    const current = [...extraEl.children];
    if (current.length !== items.length || items.some((el, i) => current[i] !== el)) {
      const active = document.activeElement;
      extraEl.replaceChildren(...items);
      if (
        active instanceof HTMLElement &&
        items.includes(active) &&
        document.activeElement !== active
      ) {
        active.focus({ preventScroll: true });
      }
    }
    extraEl.hidden = items.length === 0;
  }

  function announce(): void {
    const s = step();
    if (!s) return;
    const { n, total } = stepCounter(steps, isVisible, index);
    live.textContent = t('tour.announce', { n, total, title: t(s.title) });
  }

  function focusables(): HTMLElement[] {
    return [...pop.querySelectorAll<HTMLElement>('button, a[href]')].filter(isShown);
  }

  function keepFocusInside(): void {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && pop.contains(active) && isShown(active)) return;
    nextBtn.focus({ preventScroll: true });
  }

  function scrollToTargets(s: TourStep): void {
    const els = s.targets.flatMap(tourElements).filter(isShown);
    const first = els[0];
    if (!first) return;
    const vp = viewport();
    const smooth = !reducedMotion();
    // A sticky target (the run bar) floats over the content it scrolls with, so scrolling it to the
    // centre does nothing useful. Scroll the end of its container into view instead: the bar then
    // rests at the bottom of the screen and the space above it is free for the popover.
    const sticky = els.find((el) => getComputedStyle(el).position === 'sticky');
    if (sticky) {
      const box = sticky.parentElement;
      const r = sticky.getBoundingClientRect();
      const scroller = box && scrollContainers(box).find((el) => el.scrollHeight > el.clientHeight);
      if (box && scroller && (r.bottom < vp.h - MERGE_GAP || r.top < 0 || r.bottom > vp.h + 1)) {
        // Not scrollIntoView: the page's scroll-padding (kept clear of this very bar) would stop
        // the container's end a bar's height short of the bottom edge.
        scroller.scrollBy({
          top: box.getBoundingClientRect().bottom - vp.h,
          behavior: smooth ? 'smooth' : 'instant',
        });
        if (smooth) scrolled = [scroller];
      }
      return;
    }
    const fullyVisible = els.every((el) => {
      const r = el.getBoundingClientRect();
      const v = visibleRect(el, vp);
      return v !== null && v.w * v.h >= r.width * r.height * 0.98;
    });
    if (fullyVisible) return;
    const union = unionRect(els.map((el) => toRect(el.getBoundingClientRect())));
    const tall = union !== null && union.h > vp.h * 0.55;
    first.scrollIntoView({
      block: tall ? 'start' : 'center',
      inline: 'nearest',
      behavior: smooth ? 'smooth' : 'auto',
    });
    if (smooth) scrolled = scrollContainers(first);
  }

  /**
   * Abort smooth scrolls started by the previous step (an instant scroll to the current position
   * cancels them), so a quick Next does not let them carry the new target off screen.
   */
  function stopScrolling(): void {
    for (const el of scrolled) {
      el.scrollTo({ left: el.scrollLeft, top: el.scrollTop, behavior: 'instant' });
    }
    scrolled = [];
  }

  function animateIn(): void {
    if (reducedMotion() || typeof pop.animate !== 'function') return;
    const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    pop.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 180,
        easing,
      },
    );
    ringLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing });
  }

  // ---------- layout ----------
  function viewport(): Rect {
    return { x: 0, y: 0, w: dialog.clientWidth, h: dialog.clientHeight };
  }

  function layout(): void {
    raf = 0;
    const s = step();
    if (!open || !s) return;
    const vp = viewport();
    const rects: Rect[] = [];
    for (const id of s.targets) {
      for (const el of tourElements(id)) {
        if (!isShown(el)) continue;
        const r = visibleRect(el, vp);
        if (r) rects.push(inflateRect(r, HOLE_PAD));
      }
    }
    const merged = mergeRects(rects, MERGE_GAP);
    // Measure the popover at its natural height (the CSS cap still applies), then fit it.
    pop.style.maxHeight = '';
    const place = placePopover(
      unionRect(merged),
      { w: pop.offsetWidth, h: pop.offsetHeight },
      { w: vp.w, h: vp.h },
    );
    pop.style.maxHeight = place.maxH === undefined ? '' : `${place.maxH}px`;
    // Docked over a target that fills the screen: spotlight only the part above the popover.
    const above: Rect = { x: 0, y: 0, w: vp.w, h: place.y - HOLE_PAD };
    syncHoles(
      place.side === 'dock' ? merged.flatMap((r) => intersectRect(r, above) ?? []) : merged,
    );
    pop.style.left = `${Math.round(place.x)}px`;
    pop.style.top = `${Math.round(place.y)}px`;
    pop.dataset.side = place.side;
    // Short viewports (e.g. 400% zoom): the popover scrolls under its sticky nav row. Keep a
    // focused link or button from being scrolled into view behind that row.
    pop.style.scrollPaddingBottom = `${nav.offsetHeight}px`;
    pop.classList.toggle('is-scrollable', pop.scrollHeight > pop.clientHeight + 1);
  }

  function syncHoles(rects: readonly Rect[]): void {
    while (holes.length < rects.length) {
      const hole = svg('rect', { fill: 'black', rx: String(HOLE_RADIUS) });
      mask.append(hole);
      holes.push(hole);
      const ring = h('div', { class: 'tour-ring' });
      ringLayer.append(ring);
      rings.push(ring);
    }
    while (holes.length > rects.length) {
      holes.pop()?.remove();
      rings.pop()?.remove();
    }
    rects.forEach((r, i) => {
      const hole = holes[i];
      const ring = rings[i];
      if (hole) setRectAttrs(hole, r);
      if (ring) {
        ring.style.left = `${r.x}px`;
        ring.style.top = `${r.y}px`;
        ring.style.width = `${r.w}px`;
        ring.style.height = `${r.h}px`;
      }
    });
  }

  // ---------- events ----------
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(false);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      const inside = active instanceof Node && pop.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  dialog.addEventListener('keydown', onKey);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close(false);
  });
  // Closed by other means (e.g. a platform close request). The event is queued, so ignore it
  // when the tour was already reopened in the meantime.
  dialog.addEventListener('close', () => {
    if (!dialog.open) close(false);
  });
  // Clicks on the dimmed page do nothing and must not move focus out of the popover.
  dialog.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof Node && pop.contains(e.target))) e.preventDefault();
  });
  skipBtn.addEventListener('click', () => close(false));
  backBtn.addEventListener('click', () => {
    if (!isDisabled(backBtn)) go(-1);
  });
  nextBtn.addEventListener('click', () => {
    if (isLast()) close(true);
    else go(1);
  });
  guideLink.addEventListener('click', () => remember('completed'));
  demoBtn.addEventListener('click', () => {
    if (isDisabled(demoBtn) || demo === 'running' || host.isRunning() || host.hasResults()) return;
    demo = 'running';
    render();
    live.textContent = t('tour.demoRunning');
    host.runDemo().then(
      (ok) => demoFinished(ok),
      () => demoFinished(false),
    );
  });

  function demoFinished(ok: boolean): void {
    demo = ok ? 'idle' : 'failed';
    if (!open) return;
    // On success, go() and refresh() announce the step they move to.
    if (ok && step()?.extra === 'demo') go(1);
    else refresh();
    // The page's own run status is inert behind the modal dialog, so announce the failure here.
    if (!ok) live.textContent = t('tour.demoFailed');
  }

  onLangChange(() => {
    if (!open) return;
    render();
    announce();
    schedule();
  });

  // ---------- open / close ----------
  function start(): void {
    if (open) return;
    const first = findStep(steps, isVisible, -1, 1);
    if (first < 0) return;
    if (currentFlag() === null) remember('dismissed');
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    demo = 'idle';
    open = true;
    if (!dialog.isConnected) document.body.append(dialog);
    dialog.showModal();
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    if (!reducedMotion() && typeof backdrop.animate === 'function') {
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    }
    show(first);
    nextBtn.focus({ preventScroll: true });
  }

  function close(completed: boolean): void {
    if (!open) return;
    open = false;
    restoreExpanded();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, { capture: true });
    ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (dialog.open) dialog.close();
    index = -1;
    remember(completed ? 'completed' : 'dismissed');
    const target =
      returnFocus?.isConnected && isShown(returnFocus) ? returnFocus : tourElements('tour')[0];
    returnFocus = null;
    target?.focus({ preventScroll: true });
  }

  return { start, isOpen: () => open, refresh };
}
