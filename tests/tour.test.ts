import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../src/i18n/dictionaries';
import { LANGS } from '../src/ui/i18n';
import {
  DEMO_RUNS,
  TOUR_PARAM,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  availableIndices,
  expandNow,
  findStep,
  guideHref,
  inflateRect,
  intersectRect,
  isStepAvailable,
  mergeRects,
  parseTourFlag,
  MIN_POPOVER_ROOM,
  SIMPLE_TOUR_STEPS,
  manualHref,
  tourFor,
  placePopover,
  readTourFlag,
  resolveStep,
  shouldOfferTour,
  stepCounter,
  tourRequested,
  unionRect,
  withoutTourParam,
  writeTourFlag,
  type FlagStorage,
  type TourStep,
} from '../src/ui/tour-model';

const step = (id: string, targets: string[], requires?: string[]): TourStep => ({
  id,
  title: 'tour.welcome.title',
  body: 'tour.welcome.body',
  targets,
  ...(requires ? { requires } : {}),
});

/** A: centred, B: needs "b", C: needs "c" or "c2", D: spotlights "d" but requires "gate". */
const STEPS: readonly TourStep[] = [
  step('A', []),
  step('B', ['b']),
  step('C', ['c', 'c2']),
  step('D', ['d'], ['gate']),
  step('E', []),
];

const visibleSet =
  (...ids: string[]) =>
  (id: string): boolean =>
    ids.includes(id);

class MemoryStorage implements FlagStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const throwingStorage: FlagStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('tour step data', () => {
  it('has unique ids and translated titles and bodies', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lang of LANGS) {
      const dict: Record<string, string> = DICTIONARIES[lang];
      for (const s of TOUR_STEPS) {
        expect(dict[s.title], `${lang} ${s.title}`).toBeTruthy();
        expect(dict[s.body], `${lang} ${s.body}`).toBeTruthy();
      }
    }
  });

  it('starts with a centred welcome and ends with a centred finish that links the guide', () => {
    expect(TOUR_STEPS[0]?.targets).toEqual([]);
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last?.targets).toEqual([]);
    expect(last?.extra).toBe('guide');
  });

  it('offers the demo on the run step and expands the advanced section', () => {
    expect(TOUR_STEPS.find((s) => s.extra === 'demo')?.id).toBe('run');
    expect(TOUR_STEPS.find((s) => s.id === 'advanced')?.expand).toBe('advanced');
    expect(DEMO_RUNS).toBe(100);
  });

  it('shows either the results preview or the result steps, never both', () => {
    const withoutResults = visibleSet('presets', 'counts', 'run', 'results', 'results-empty');
    const withResults = visibleSet(
      'presets',
      'run',
      'results',
      'verdict',
      'stat-cards',
      'outcome-chart',
      'sensitivity-chart',
      'replay',
    );
    const ids = (fn: (id: string) => boolean): string[] =>
      availableIndices(TOUR_STEPS, fn).map((i) => TOUR_STEPS[i]?.id ?? '');
    expect(ids(withoutResults)).toContain('results');
    expect(ids(withoutResults)).not.toContain('verdict');
    expect(ids(withResults)).not.toContain('results');
    expect(ids(withResults)).toEqual(
      expect.arrayContaining(['verdict', 'outcome', 'sensitivity', 'replay']),
    );
  });

  it('replaces the results preview with the verdict step when results appear', () => {
    const always = ['presets', 'counts', 'runs', 'seed', 'advanced', 'run', 'results', 'share'];
    const before = visibleSet(...always, 'results-empty', 'lang', 'tour');
    const after = visibleSet(
      ...always,
      'verdict',
      'stat-cards',
      'outcome-chart',
      'sensitivity-chart',
      'replay',
      'lang',
      'tour',
    );
    const preview = TOUR_STEPS.findIndex((s) => s.id === 'results');
    const verdict = TOUR_STEPS.findIndex((s) => s.id === 'verdict');
    expect(stepCounter(TOUR_STEPS, before, preview)).toEqual({ n: 7, total: 10 });
    expect(resolveStep(TOUR_STEPS, before, preview)).toBe(preview);
    expect(resolveStep(TOUR_STEPS, after, preview)).toBe(verdict);
    expect(stepCounter(TOUR_STEPS, after, verdict)).toEqual({ n: 7, total: 13 });
  });
});

describe('Simple tour step data (#158)', () => {
  const ids = (fn: (id: string) => boolean): string[] =>
    availableIndices(SIMPLE_TOUR_STEPS, fn).map((i) => SIMPLE_TOUR_STEPS[i]?.id ?? '');
  const always = ['simple-pick', 'simple-run', 'simple-results', 'share', 'view-switch'];

  it('has unique ids and translated titles and bodies, none shared with the classic tour', () => {
    const own = SIMPLE_TOUR_STEPS.map((s) => s.id);
    expect(new Set(own).size).toBe(own.length);
    for (const id of own) expect(TOUR_STEPS.map((s) => s.id)).not.toContain(id);
    for (const lang of LANGS) {
      const dict: Record<string, string> = DICTIONARIES[lang];
      for (const s of SIMPLE_TOUR_STEPS) {
        expect(dict[s.title], `${lang} ${s.title}`).toBeTruthy();
        expect(dict[s.body], `${lang} ${s.body}`).toBeTruthy();
      }
      for (const k of [
        'tour.simple.runNow',
        'tour.simple.runHint',
        'tour.simple.running',
        'tour.simple.runFailed',
        'tour.simple.manual',
      ]) {
        expect(dict[k], `${lang} ${k}`).toBeTruthy();
      }
    }
  });

  it('is four steps and one Advanced step, before and after a run', () => {
    const before = ids(visibleSet(...always, 'simple-results-empty'));
    const after = ids(visibleSet(...always, 'simple-result'));
    expect(before).toEqual([
      'simple-pick',
      'simple-run',
      'simple-preview',
      'simple-share',
      'simple-advanced',
    ]);
    expect(after).toEqual([
      'simple-pick',
      'simple-run',
      'simple-result',
      'simple-share',
      'simple-advanced',
    ]);
  });

  it('offers a run on the run step and ends on the Advanced switch with the manual link', () => {
    expect(SIMPLE_TOUR_STEPS.find((s) => s.extra === 'run')?.id).toBe('simple-run');
    const last = SIMPLE_TOUR_STEPS[SIMPLE_TOUR_STEPS.length - 1];
    expect(last?.targets).toEqual(['view-switch']);
    expect(last?.extra).toBe('manual');
  });

  it('moves from the run step to the result once results exist', () => {
    const before = visibleSet(...always, 'simple-results-empty');
    const after = visibleSet(...always, 'simple-result');
    const run = SIMPLE_TOUR_STEPS.findIndex((s) => s.id === 'simple-run');
    const preview = SIMPLE_TOUR_STEPS.findIndex((s) => s.id === 'simple-preview');
    const result = SIMPLE_TOUR_STEPS.findIndex((s) => s.id === 'simple-result');
    expect(findStep(SIMPLE_TOUR_STEPS, before, run, 1)).toBe(preview);
    expect(findStep(SIMPLE_TOUR_STEPS, after, run, 1)).toBe(result);
    expect(resolveStep(SIMPLE_TOUR_STEPS, after, preview)).toBe(result);
    expect(stepCounter(SIMPLE_TOUR_STEPS, after, result)).toEqual({ n: 3, total: 5 });
  });
});

describe('which tour starts (#158)', () => {
  it('opens the Simple tour in place from Simple mode, whatever started it', () => {
    for (const trigger of ['button', 'offer', 'link'] as const) {
      expect(tourFor('simple', trigger)).toEqual({ kind: 'simple', showClassic: false });
    }
  });

  it('opens the classic tour from Advanced; only the header button switches to classic', () => {
    expect(tourFor('advanced', 'button')).toEqual({ kind: 'classic', showClassic: true });
    // Old `?tour` links (classic or free fragment, or none) and the offer: as before #158.
    expect(tourFor('advanced', 'link')).toEqual({ kind: 'classic', showClassic: false });
    expect(tourFor('advanced', 'offer')).toEqual({ kind: 'classic', showClassic: false });
  });
});

describe('Advanced settings manual links', () => {
  it('point at sections that exist on both guide pages', () => {
    for (const lang of LANGS) {
      const html = readFileSync(lang === 'en' ? 'en/guide/index.html' : 'guide/index.html', 'utf8');
      for (const section of ['advanced', 'advanced-free', 'advanced-classic'] as const) {
        const href = manualHref(lang, section);
        expect(href).toBe(`${guideHref(lang)}#${section}`);
        expect(html, `${lang} #${section}`).toMatch(new RegExp(`\\bid="${section}"`));
      }
    }
    expect(manualHref('ko')).toBe('/guide/#advanced');
  });
});

describe('step filtering', () => {
  it('always shows steps without targets', () => {
    expect(isStepAvailable(step('x', []), () => false)).toBe(true);
  });

  it('needs at least one visible target', () => {
    const s = step('x', ['a', 'b']);
    expect(isStepAvailable(s, visibleSet())).toBe(false);
    expect(isStepAvailable(s, visibleSet('b'))).toBe(true);
  });

  it('uses `requires` instead of the targets when given', () => {
    const s = step('x', ['shown'], ['gate']);
    expect(isStepAvailable(s, visibleSet('shown'))).toBe(false);
    expect(isStepAvailable(s, visibleSet('gate'))).toBe(true);
  });

  it('lists available steps in order', () => {
    expect(availableIndices(STEPS, visibleSet())).toEqual([0, 4]);
    expect(availableIndices(STEPS, visibleSet('c2', 'gate'))).toEqual([0, 2, 3, 4]);
  });
});

describe('navigation', () => {
  const vis = visibleSet('c');

  it('skips unavailable steps in both directions', () => {
    expect(findStep(STEPS, vis, 0, 1)).toBe(2);
    expect(findStep(STEPS, vis, 2, 1)).toBe(4);
    expect(findStep(STEPS, vis, 4, -1)).toBe(2);
    expect(findStep(STEPS, vis, 2, -1)).toBe(0);
  });

  it('returns -1 past either end', () => {
    expect(findStep(STEPS, vis, 4, 1)).toBe(-1);
    expect(findStep(STEPS, vis, 0, -1)).toBe(-1);
    expect(findStep([], vis, -1, 1)).toBe(-1);
  });

  it('finds the first and last step from outside the list', () => {
    expect(findStep(STEPS, vis, -1, 1)).toBe(0);
    expect(findStep(STEPS, vis, STEPS.length, -1)).toBe(4);
  });

  it('counts only available steps', () => {
    expect(stepCounter(STEPS, vis, 0)).toEqual({ n: 1, total: 3 });
    expect(stepCounter(STEPS, vis, 2)).toEqual({ n: 2, total: 3 });
    expect(stepCounter(STEPS, vis, 4)).toEqual({ n: 3, total: 3 });
  });

  it('never counts more steps than are available', () => {
    // B (index 1) and D (index 3) are unavailable: they take the place of the next available step.
    expect(stepCounter(STEPS, vis, 1)).toEqual({ n: 2, total: 3 });
    expect(stepCounter(STEPS, vis, 3)).toEqual({ n: 3, total: 3 });
    expect(stepCounter([step('A', []), step('B', ['b'])], vis, 1)).toEqual({ n: 1, total: 1 });
  });

  it('stays on an available step and leaves one that became unavailable', () => {
    expect(resolveStep(STEPS, vis, 2)).toBe(2);
    expect(resolveStep(STEPS, vis, 1)).toBe(2);
    expect(resolveStep(STEPS, vis, 3)).toBe(4);
    expect(resolveStep([step('A', []), step('B', ['b'])], vis, 1)).toBe(0);
    expect(resolveStep([step('B', ['b'])], vis, 0)).toBe(-1);
  });
});

describe('rectangles', () => {
  it('unions, intersects and inflates', () => {
    expect(unionRect([])).toBeNull();
    expect(
      unionRect([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 20, y: 5, w: 5, h: 20 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 25, h: 25 });
    expect(intersectRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toEqual({
      x: 5,
      y: 5,
      w: 5,
      h: 5,
    });
    expect(intersectRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBeNull();
    expect(inflateRect({ x: 10, y: 10, w: 5, h: 5 }, 2)).toEqual({ x: 8, y: 8, w: 9, h: 9 });
  });

  it('merges neighbours within the gap and keeps distant ones apart', () => {
    const a = { x: 0, y: 0, w: 100, h: 40 };
    const b = { x: 112, y: 0, w: 100, h: 40 };
    const far = { x: 0, y: 300, w: 100, h: 40 };
    expect(mergeRects([a, b, far], 24)).toEqual([{ x: 0, y: 0, w: 212, h: 40 }, far]);
    expect(mergeRects([a, b], 8)).toEqual([a, b]);
    expect(mergeRects([], 24)).toEqual([]);
  });

  it('merges transitively', () => {
    const rects = [0, 1, 2].map((i) => ({ x: i * 50, y: 0, w: 45, h: 10 }));
    expect(mergeRects(rects, 10)).toEqual([{ x: 0, y: 0, w: 145, h: 10 }]);
  });
});

describe('placePopover', () => {
  const vp = { w: 1000, h: 800 };
  const pop = { w: 300, h: 200 };

  it('centres without a target', () => {
    expect(placePopover(null, pop, vp)).toEqual({ x: 350, y: 300, side: 'center' });
  });

  it('prefers below, then above, then the sides', () => {
    expect(placePopover({ x: 100, y: 100, w: 200, h: 50 }, pop, vp)).toEqual({
      x: 50,
      y: 162,
      side: 'bottom',
    });
    expect(placePopover({ x: 400, y: 550, w: 200, h: 100 }, pop, vp).side).toBe('top');
    const tall = { x: 20, y: 20, w: 400, h: 760 };
    expect(placePopover(tall, pop, vp)).toEqual({ x: 432, y: 300, side: 'right' });
    expect(placePopover({ x: 580, y: 20, w: 400, h: 760 }, pop, vp)).toEqual({
      x: 268,
      y: 300,
      side: 'left',
    });
  });

  it('keeps the popover inside the viewport margin', () => {
    const p = placePopover({ x: 0, y: 10, w: 20, h: 20 }, pop, vp);
    expect(p.x).toBe(12);
    const q = placePopover({ x: 990, y: 10, w: 10, h: 20 }, pop, vp);
    expect(q.x).toBe(vp.w - 12 - pop.w);
  });

  it('docks to the bottom when nothing fits (narrow phone, big target)', () => {
    const phone = { w: 390, h: 844 };
    const p = placePopover({ x: 6, y: 0, w: 378, h: 820 }, { w: 366, h: 260 }, phone);
    expect(p).toEqual({ x: 12, y: 844 - 12 - 260, side: 'dock' });
  });

  it('takes the side with more room and scrolls when the popover fits nowhere whole', () => {
    // 320×568 phone, a tall run bar resting at the bottom: 336 px above it, nothing below.
    const phone = { w: 320, h: 568 };
    const bar = { x: 6, y: 360, w: 308, h: 202 };
    const p = placePopover(bar, { w: 296, h: 356 }, phone);
    expect(p).toEqual({ x: 12, y: 12, side: 'top', maxH: 360 - 12 - 12 });
    // The popover ends `gap` above the target, so it never covers it.
    expect(p.y + (p.maxH ?? 0)).toBe(bar.y - 12);
    // More room below than above: below, capped to the room left.
    const head = { x: 6, y: 40, w: 308, h: 200 };
    expect(placePopover(head, { w: 296, h: 356 }, phone)).toEqual({
      x: 12,
      y: 252,
      side: 'bottom',
      maxH: 568 - 12 - 252,
    });
  });

  it('docks rather than squeeze the popover below the readable minimum', () => {
    const phone = { w: 320, h: 568 };
    const p = placePopover({ x: 6, y: 100, w: 308, h: 340 }, { w: 296, h: 300 }, phone);
    expect(p.side).toBe('dock');
    expect(MIN_POPOVER_ROOM).toBeGreaterThan(100 - 24);
  });

  it('caps a docked popover taller than the viewport', () => {
    const land = { w: 667, h: 375 };
    const p = placePopover({ x: 0, y: 0, w: 667, h: 375 }, { w: 380, h: 420 }, land);
    expect(p).toEqual({ x: 143.5, y: 12, side: 'dock', maxH: 375 - 24 });
  });
});

describe('first-visit flag', () => {
  it('parses only known values', () => {
    expect(parseTourFlag('dismissed')).toBe('dismissed');
    expect(parseTourFlag('completed')).toBe('completed');
    expect(parseTourFlag('yes')).toBeNull();
    expect(parseTourFlag(null)).toBeNull();
  });

  it('offers the tour only while no flag is stored', () => {
    const s = new MemoryStorage();
    expect(shouldOfferTour(readTourFlag(s))).toBe(true);
    expect(writeTourFlag(s, 'dismissed')).toBe(true);
    expect(s.data.get(TOUR_STORAGE_KEY)).toBe('dismissed');
    expect(shouldOfferTour(readTourFlag(s))).toBe(false);
  });

  it('upgrades dismissed to completed but never downgrades', () => {
    const s = new MemoryStorage();
    writeTourFlag(s, 'dismissed');
    writeTourFlag(s, 'completed');
    expect(readTourFlag(s)).toBe('completed');
    writeTourFlag(s, 'dismissed');
    expect(readTourFlag(s)).toBe('completed');
  });

  it('treats unknown stored values as no flag', () => {
    const s = new MemoryStorage();
    s.setItem(TOUR_STORAGE_KEY, 'garbage');
    expect(readTourFlag(s)).toBeNull();
  });

  it('survives missing or throwing storage', () => {
    expect(readTourFlag(null)).toBeNull();
    expect(writeTourFlag(null, 'completed')).toBe(false);
    expect(readTourFlag(throwingStorage)).toBeNull();
    expect(writeTourFlag(throwingStorage, 'dismissed')).toBe(false);
  });
});

describe('deep link and guide', () => {
  it('detects the tour parameter', () => {
    expect(TOUR_PARAM).toBe('tour');
    expect(tourRequested('?tour=1')).toBe(true);
    expect(tourRequested('?tour')).toBe(true);
    expect(tourRequested('?a=b&tour=yes')).toBe(true);
    expect(tourRequested('?tour=0')).toBe(false);
    expect(tourRequested('')).toBe(false);
    expect(tourRequested('?tours=1')).toBe(false);
  });

  it('removes only the tour parameter', () => {
    expect(withoutTourParam('?tour=1')).toBe('');
    expect(withoutTourParam('?a=1&tour=1&b=2')).toBe('?a=1&b=2');
    expect(withoutTourParam('')).toBe('');
  });

  it('links the guide page for each language', () => {
    expect(guideHref('ko')).toBe('/guide/');
    expect(guideHref('en')).toBe('/en/guide/');
  });
});

describe('expandNow', () => {
  /** A `<details>` stand-in whose body is built lazily on `toggle`, like the advanced table. */
  class LazyDetails extends EventTarget {
    open = false;
    rows = 0;
    constructor() {
      super();
      this.addEventListener('toggle', () => {
        if (this.open && this.rows === 0) this.rows = 22;
      });
    }
  }

  it('builds lazy content before the step measures its target', () => {
    const d = new LazyDetails();
    expandNow(d);
    // Same task: the spotlight is measured right after this, so the rows must already exist.
    expect(d.open).toBe(true);
    expect(d.rows).toBe(22);
  });

  it('leaves an already open section alone', () => {
    const d = new LazyDetails();
    d.open = true;
    let toggles = 0;
    d.addEventListener('toggle', () => toggles++);
    expandNow(d);
    expect(toggles).toBe(0);
  });
});
