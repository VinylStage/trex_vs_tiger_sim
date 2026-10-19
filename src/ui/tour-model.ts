import type { Lang, MsgKey } from './i18n';

/**
 * DOM-free part of the guided tour: step data, step filtering and navigation, popover placement,
 * the first-visit flag and the `?tour` deep link. The DOM layer lives in `tour.ts`.
 */

/** Run count used by the tour's quick demo. */
export const DEMO_RUNS = 100;

export interface TourStep {
  readonly id: string;
  readonly title: MsgKey;
  readonly body: MsgKey;
  /** `data-tour` ids to spotlight. An empty list shows a centred dialog without a spotlight. */
  readonly targets: readonly string[];
  /**
   * `data-tour` ids that decide whether the step is shown (at least one must be visible).
   * Defaults to `targets`.
   */
  readonly requires?: readonly string[];
  /** `data-tour` id of a `<details>` element that is opened during the step and restored after. */
  readonly expand?: string;
  /** Extra content: the quick-demo button or the link to the guide page. */
  readonly extra?: 'demo' | 'guide';
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'welcome', title: 'tour.welcome.title', body: 'tour.welcome.body', targets: [] },
  { id: 'presets', title: 'tour.presets.title', body: 'tour.presets.body', targets: ['presets'] },
  { id: 'counts', title: 'tour.counts.title', body: 'tour.counts.body', targets: ['counts'] },
  { id: 'runs', title: 'tour.runs.title', body: 'tour.runs.body', targets: ['runs', 'seed'] },
  {
    id: 'advanced',
    title: 'tour.advanced.title',
    body: 'tour.advanced.body',
    targets: ['advanced'],
    expand: 'advanced',
  },
  { id: 'run', title: 'tour.run.title', body: 'tour.run.body', targets: ['run'], extra: 'demo' },
  {
    id: 'results',
    title: 'tour.results.title',
    body: 'tour.results.body',
    targets: ['results'],
    requires: ['results-empty'],
  },
  {
    id: 'verdict',
    title: 'tour.verdict.title',
    body: 'tour.verdict.body',
    targets: ['verdict', 'stat-cards'],
  },
  {
    id: 'outcome',
    title: 'tour.outcome.title',
    body: 'tour.outcome.body',
    targets: ['outcome-chart'],
  },
  {
    id: 'sensitivity',
    title: 'tour.sensitivity.title',
    body: 'tour.sensitivity.body',
    targets: ['sensitivity-chart'],
  },
  { id: 'replay', title: 'tour.replay.title', body: 'tour.replay.body', targets: ['replay'] },
  { id: 'share', title: 'tour.share.title', body: 'tour.share.body', targets: ['share'] },
  {
    id: 'header',
    title: 'tour.header.title',
    body: 'tour.header.body',
    targets: ['lang', 'tour'],
  },
  {
    id: 'finish',
    title: 'tour.finish.title',
    body: 'tour.finish.body',
    targets: [],
    extra: 'guide',
  },
];

/** Answers whether the element(s) with a given `data-tour` id are present and visible. */
export type VisibleFn = (tourId: string) => boolean;

/** A step is shown if it has no anchor, or if at least one of its required anchors is visible. */
export function isStepAvailable(step: TourStep, isVisible: VisibleFn): boolean {
  const req = step.requires ?? step.targets;
  return req.length === 0 || req.some(isVisible);
}

/** Indices (into `steps`) of the steps that can be shown right now, in order. */
export function availableIndices(steps: readonly TourStep[], isVisible: VisibleFn): number[] {
  const out: number[] = [];
  steps.forEach((s, i) => {
    if (isStepAvailable(s, isVisible)) out.push(i);
  });
  return out;
}

/** Clamp an index into `[0, length - 1]`; non-finite input gives 0, an empty list gives -1. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  if (!Number.isFinite(index)) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}

/**
 * Index of the nearest available step after (`dir = 1`) or before (`dir = -1`) `from`, or -1 when
 * there is none. `from` may be -1 (or `steps.length`) to search from the start (or the end).
 */
export function findStep(
  steps: readonly TourStep[],
  isVisible: VisibleFn,
  from: number,
  dir: 1 | -1,
): number {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const step = steps[i];
    if (step && isStepAvailable(step, isVisible)) return i;
  }
  return -1;
}

/**
 * The step an open tour should show after the page changed (for example when results appeared):
 * `index` while that step is still available, else the next available step, else the previous
 * one, or -1 when no step is available.
 */
export function resolveStep(
  steps: readonly TourStep[],
  isVisible: VisibleFn,
  index: number,
): number {
  const current = steps[index];
  if (current && isStepAvailable(current, isVisible)) return index;
  const next = findStep(steps, isVisible, index, 1);
  return next >= 0 ? next : findStep(steps, isVisible, index, -1);
}

/**
 * "n / total" for the step at `index`, counting only the steps available right now. A step that
 * is no longer available takes the place of the next available one, so `n` never exceeds `total`.
 */
export function stepCounter(
  steps: readonly TourStep[],
  isVisible: VisibleFn,
  index: number,
): { n: number; total: number } {
  const avail = availableIndices(steps, isVisible);
  const pos = avail.indexOf(index);
  if (pos >= 0) return { n: pos + 1, total: avail.length };
  const before = avail.filter((i) => i < index).length;
  return { n: Math.min(before + 1, avail.length), total: avail.length };
}

// ---------- geometry ----------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Overlap of two rectangles, or null when they do not overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function inflateRect(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad };
}

/**
 * Merge rectangles that overlap or lie within `gap` of each other into their union, so that
 * neighbouring targets (two fields in one row, two adjacent buttons) share one spotlight hole.
 */
export function mergeRects(rects: readonly Rect[], gap: number): Rect[] {
  const out = rects.map((r) => ({ ...r }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (!a || !b) continue;
        if (intersectRect(inflateRect(a, gap / 2), inflateRect(b, gap / 2))) {
          out[i] = unionRect([a, b]) ?? a;
          out.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return out;
}

export type PopoverSide = 'bottom' | 'top' | 'right' | 'left' | 'center' | 'dock';

export interface Placement {
  x: number;
  y: number;
  side: PopoverSide;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Where to put the popover (top-left corner, viewport coordinates). Tries below, above, right and
 * left of the target in that order; when none fits it docks to the bottom edge, overlapping the
 * target. Without a target it is centred. The result always stays `margin` inside the viewport
 * when the popover fits at all.
 */
export function placePopover(
  target: Rect | null,
  pop: Size,
  viewport: Size,
  gap = 12,
  margin = 12,
): Placement {
  const maxX = Math.max(margin, viewport.w - margin - pop.w);
  const maxY = Math.max(margin, viewport.h - margin - pop.h);
  if (!target) {
    return {
      x: clamp((viewport.w - pop.w) / 2, margin, maxX),
      y: clamp((viewport.h - pop.h) / 2, margin, maxY),
      side: 'center',
    };
  }
  const cx = clamp(target.x + target.w / 2 - pop.w / 2, margin, maxX);
  const cy = clamp(target.y + target.h / 2 - pop.h / 2, margin, maxY);
  const below = target.y + target.h + gap;
  if (below + pop.h <= viewport.h - margin) return { x: cx, y: below, side: 'bottom' };
  const above = target.y - gap - pop.h;
  if (above >= margin) return { x: cx, y: above, side: 'top' };
  const right = target.x + target.w + gap;
  if (right + pop.w <= viewport.w - margin) return { x: right, y: cy, side: 'right' };
  const left = target.x - gap - pop.w;
  if (left >= margin) return { x: left, y: cy, side: 'left' };
  return { x: clamp((viewport.w - pop.w) / 2, margin, maxX), y: maxY, side: 'dock' };
}

// ---------- first-visit flag ----------

/** localStorage key; see docs/TUTORIAL.md. */
export const TOUR_STORAGE_KEY = 'trexsim.tour';

/** `dismissed`: the offer was declined or the tour was closed early. `completed`: Done pressed. */
export type TourFlag = 'dismissed' | 'completed';

export type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseTourFlag(v: unknown): TourFlag | null {
  return v === 'dismissed' || v === 'completed' ? v : null;
}

/** The first-visit offer is shown only while no flag has been stored. */
export function shouldOfferTour(flag: TourFlag | null): boolean {
  return flag === null;
}

/** `localStorage`, or null when it is missing or access throws (blocked storage). */
export function browserStorage(): FlagStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readTourFlag(storage: FlagStorage | null): TourFlag | null {
  if (!storage) return null;
  try {
    return parseTourFlag(storage.getItem(TOUR_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Store a flag. `completed` is never downgraded to `dismissed`. Returns false when storage is
 * unavailable or throws (the caller then just forgets the choice at the end of the session).
 */
export function writeTourFlag(storage: FlagStorage | null, flag: TourFlag): boolean {
  if (!storage) return false;
  try {
    if (flag === 'dismissed' && readTourFlag(storage) === 'completed') return true;
    storage.setItem(TOUR_STORAGE_KEY, flag);
    return true;
  } catch {
    return false;
  }
}

// ---------- deep link and guide ----------

/** Query parameter that starts the tour on load: `?tour=1` (any value except `0`). */
export const TOUR_PARAM = 'tour';

export function tourRequested(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has(TOUR_PARAM) && params.get(TOUR_PARAM) !== '0';
}

/** `search` without the tour parameter, as `''` or `'?…'`. */
export function withoutTourParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(TOUR_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** Path of the static guide page for a language. */
export function guideHref(lang: Lang): string {
  return lang === 'en' ? '/en/guide/' : '/guide/';
}
