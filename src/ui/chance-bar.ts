import { h } from './dom';
import { formatFixed, formatPct } from './format';
import { t } from './i18n';
import type { LiveBar } from './live-chance';

/**
 * The live bar (RENEWAL-1.0 §10.2 point 4, §4.4; #222): "실시간 예상 승률" while the live-chance
 * job delivered a chance, "전력 비율" when it fell back to the strength ratio. The two never mix:
 * a strength value is shown as a ratio ("6.2 : 3.8"), never as a percentage or with chance
 * wording. Between checkpoints the bar holds the last point at or before the playhead, never a
 * later one. Text only (`textContent`); the value is announced politely only when the shown
 * point changes, so a playing battle does not flood a screen reader.
 */

/** What the bar shows at one playhead time. */
export type BarReading =
  | { readonly kind: 'chance'; readonly t: number; readonly a: number }
  | { readonly kind: 'strength'; readonly t: number; readonly a: number };

/**
 * The reading of `bar` at playhead time `time`: the last point with `t ≤ time` (points in time
 * order), or null before the first one. Never a value from a later point.
 */
export function barAt(bar: LiveBar | null, time: number): BarReading | null {
  if (!bar) return null;
  let found: BarReading | null = null;
  if (bar.kind === 'chance') {
    for (const p of bar.points) {
      if (!(p.t <= time)) break;
      found = { kind: 'chance', t: p.t, a: p.chance };
    }
  } else {
    for (const p of bar.points) {
      if (!(p.t <= time)) break;
      found = { kind: 'strength', t: p.t, a: p.ratio };
    }
  }
  return found;
}

/** The words of a reading: label, the value for each side, and one line for screen readers. */
export interface BarText {
  label: string;
  a: string;
  b: string;
  /** Spoken line, e.g. "실시간 예상 승률: 늑대 62%, 호랑이 38%". */
  spoken: string;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0.5));

export function barText(r: BarReading, names: readonly [string, string]): BarText {
  const a = clamp01(r.a);
  if (r.kind === 'chance') {
    const pa = formatPct(a, 0);
    const pb = formatPct(1 - a, 0);
    const label = t('live.bar.chance');
    return {
      label,
      a: pa,
      b: pb,
      spoken: t('live.bar.spoken', { label, a: names[0], pa, b: names[1], pb }),
    };
  }
  // A ratio out of 10, so it can never be read as a percentage chance.
  const ra = formatFixed(a * 10, 1);
  const rb = formatFixed((1 - a) * 10, 1);
  const label = t('live.bar.strength');
  return {
    label,
    a: ra,
    b: rb,
    spoken: t('live.bar.spoken', { label, a: names[0], pa: ra, b: names[1], pb: rb }),
  };
}

/** The bar's DOM: label, two side values, a two-colour track; `update` on every playhead move. */
export interface ChanceBarView {
  readonly el: HTMLElement;
  set(bar: LiveBar | null, names: readonly [string, string]): void;
  update(time: number): void;
  relocalize(): void;
}

export function createChanceBar(): ChanceBarView {
  const label = h('span', { class: 'chance-label' });
  const valA = h('span', { class: 'chance-value chance-a' });
  const valB = h('span', { class: 'chance-value chance-b' });
  const fillA = h('span', { class: 'chance-fill chance-fill-a' });
  const track = h('span', { class: 'chance-track', attrs: { 'aria-hidden': 'true' } }, fillA);
  const note = h('span', { class: 'chance-note' });
  const spoken = h('span', {
    class: 'visually-hidden',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const el = h(
    'div',
    { class: 'chance-bar' },
    h('div', { class: 'chance-head' }, label, note),
    h('div', { class: 'chance-row' }, valA, track, valB),
    spoken,
  );
  el.hidden = true;
  let bar: LiveBar | null = null;
  let names: readonly [string, string] = ['', ''];
  let shown: BarReading | null = null;
  let time = 0;

  const render = (force: boolean): void => {
    const r = barAt(bar, time);
    el.hidden = bar === null;
    if (!force && r?.t === shown?.t && r?.kind === shown?.kind) return;
    shown = r;
    note.textContent = bar?.kind === 'strength' ? t('live.bar.strengthNote') : '';
    if (!r) {
      label.textContent = bar
        ? t(bar.kind === 'chance' ? 'live.bar.chance' : 'live.bar.strength')
        : '';
      valA.textContent = '';
      valB.textContent = '';
      fillA.style.width = '50%';
      return;
    }
    const text = barText(r, names);
    label.textContent = text.label;
    valA.textContent = `${names[0]} ${text.a}`;
    valB.textContent = `${text.b} ${names[1]}`;
    // CSSOM, not a style attribute: allowed under the strict CSP.
    fillA.style.width = `${(clamp01(r.a) * 100).toFixed(1)}%`;
    spoken.textContent = text.spoken;
  };

  return {
    el,
    set(next, sideNames) {
      bar = next;
      names = sideNames;
      render(true);
    },
    update(next) {
      time = next;
      render(false);
    },
    relocalize() {
      render(true);
    },
  };
}
