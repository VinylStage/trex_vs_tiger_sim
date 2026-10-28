import type { FreeAggregate } from '../sim/free/aggregate';
import { FREE_LIMITS, type FreeConfig } from '../sim/free/config';
import { readyPresets } from '../sim/free/presets';
import { FREE_SPECIES, FREE_SPECIES_IDS } from '../sim/free/species';
import { h } from './dom';
import { formatInt, formatNum, formatPct } from './format';
import { getLang, speciesCounter, speciesName, t, teamLabel, type MsgKey } from './i18n';
import { withSideCount, withSideSpecies, type FreeSideIndex } from './free-form-model';
import { countChips, hasHiddenEdits, matchingPreset } from './simple-model';
import { formatShare } from './verdict';
import './simple-mode.css';

/*
 * Simple mode (docs/design/RENEWAL-1.0.md §3.2, #146): the default view of a cold play page. A
 * thin view over the free mode's config (src/ui/free-mode.ts owns the config, the Run button, the
 * run itself and the results panel): preset chips from the preset registry, a species picker and
 * a count per side, and in the results a win share bar and the per-side still-standing / fled /
 * incapacitated breakdown. The pure part is src/ui/simple-model.ts.
 */

export interface SimpleView {
  /** Presets, the two sides and the notes; shown in place of the full free form. */
  form: HTMLElement;
  /** Win share bar, shown above the verdict sentence. */
  bar: HTMLElement;
  /** Still standing / fled / incapacitated per side and the "run again" button. */
  breakdown: HTMLElement;
  /** Rebuild the form from the config, keeping focus on the control named `focusKey`. */
  render(c: FreeConfig, focusKey?: string): void;
  /** Fill the bar and the breakdown from a finished run (empty them for null). */
  renderResult(res: { config: FreeConfig; agg: FreeAggregate } | null): void;
}

export interface SimpleViewOptions {
  /** A Simple edit: the free mode stores the config, rebuilds and writes the address. */
  update(c: FreeConfig, focusKey: string): void;
  /** Start a run (each Simple run draws a fresh seed). */
  run(): void;
  /** The seed of the Simple link the page opened with while the next Run keeps it (#154), else null. */
  linkSeed(): number | null;
}

const SIDES: readonly FreeSideIndex[] = [0, 1];
const sideKey = (i: FreeSideIndex): MsgKey => (i === 0 ? 'free.sideA' : 'free.sideB');
const FOCUS_ATTR = 'data-simple';

let uid = 0;
const nextId = (base: string): string => `${base}-${++uid}`;

export function createSimpleView(opts: SimpleViewOptions): SimpleView {
  const form = h('div', { class: 'simple-form' });
  const bar = h('div', { class: 'simple-bar' });
  bar.hidden = true;
  const breakdown = h('div', {
    class: 'simple-breakdown',
    attrs: { 'data-tour': 'simple-result' },
  });
  breakdown.hidden = true;
  let cfg: FreeConfig | null = null;

  const focusable = (el: HTMLElement, key: string): HTMLElement => {
    el.setAttribute(FOCUS_ATTR, key);
    return el;
  };

  function presets(c: FreeConfig): HTMLElement {
    const current = matchingPreset(c);
    const lang = getLang();
    const titleId = nextId('simple-presets-title');
    const list = h('div', { class: 'preset-buttons simple-presets' });
    for (const p of readyPresets()) {
      const btn = h('button', {
        class: 'btn btn-small btn-chip',
        text: p.name[lang],
        attrs: { type: 'button', 'aria-pressed': String(p === current) },
      });
      btn.addEventListener('click', () => {
        if (!cfg) return;
        // Species and counts from the preset; the seed and everything else stay as they are, and
        // the run uses the defaults for what Simple does not show (simpleRunConfig).
        let next = withSideSpecies(withSideSpecies(cfg, 0, p.a.sp), 1, p.b.sp);
        next = withSideCount(withSideCount(next, 0, p.a.n), 1, p.b.n);
        opts.update(next, `preset-${p.id}`);
      });
      list.append(focusable(btn, `preset-${p.id}`));
    }
    return h(
      'section',
      {
        class: 'simple-section',
        attrs: { 'aria-labelledby': titleId, 'data-tour': 'simple-pick' },
      },
      h('h3', { id: titleId, class: 'simple-heading', text: t('simple.presets') }),
      list,
      current
        ? h(
            'p',
            { class: 'simple-why' },
            h('strong', { text: t('simple.why') }),
            ' ',
            current.why[lang],
          )
        : null,
    );
  }

  function side(c: FreeConfig, i: FreeSideIndex): HTMLElement {
    const s = c.sides[i];
    const sid = nextId(`simple-${i}-species`);
    const select = h('select', { id: sid, class: 'species-select' });
    for (const group of ['extant', 'extinct'] as const) {
      const og = h('optgroup', { attrs: { label: t(`species.group.${group}`) } });
      for (const id of FREE_SPECIES_IDS) {
        if ((FREE_SPECIES[id].era === 'extant') !== (group === 'extant')) continue;
        og.append(h('option', { attrs: { value: id }, text: speciesName(id) }));
      }
      select.append(og);
    }
    select.value = s.species;
    select.addEventListener('change', () => {
      if (cfg) opts.update(withSideSpecies(cfg, i, select.value), `species-${i}`);
    });

    const cid = nextId(`simple-${i}-count`);
    const hintId = `${cid}-hint`;
    const count = h('input', {
      id: cid,
      attrs: {
        type: 'number',
        inputmode: 'numeric',
        min: String(FREE_LIMITS.sideCount[0]),
        max: String(FREE_LIMITS.sideCount[1]),
        step: '1',
        'aria-describedby': hintId,
      },
    });
    count.value = String(s.count);
    count.addEventListener('change', () => {
      const n = Number(count.value);
      if (!cfg) return;
      if (count.value.trim() === '' || !Number.isFinite(n)) {
        count.value = String(cfg.sides[i].count);
        return;
      }
      opts.update(withSideCount(cfg, i, n), `count-${i}`);
    });

    const chipsLabel = nextId(`simple-${i}-chips`);
    const chips = h('div', {
      class: 'simple-chips',
      attrs: { role: 'group', 'aria-labelledby': `${chipsLabel} ${cid}-label` },
    });
    for (const n of countChips(s.species)) {
      const chip = h('button', {
        class: 'btn btn-small btn-chip',
        text: formatInt(n),
        attrs: { type: 'button', 'aria-pressed': String(n === s.count) },
      });
      chip.addEventListener('click', () => {
        if (cfg) opts.update(withSideCount(cfg, i, n), `chip-${i}-${n}`);
      });
      chips.append(focusable(chip, `chip-${i}-${n}`));
    }
    const social = FREE_SPECIES[s.species].social;
    return h(
      'fieldset',
      { class: `free-side free-side-${i === 0 ? 'a' : 'b'} simple-side` },
      h(
        'legend',
        {},
        h('span', {
          class: `marker ${i === 0 ? 'mk-heavy' : 'mk-pack'}`,
          attrs: { 'aria-hidden': 'true' },
        }),
        ' ',
        t(sideKey(i)),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { attrs: { for: sid }, text: t('free.species') }),
        focusable(select, `species-${i}`),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { id: `${cid}-label`, attrs: { for: cid }, text: t('free.count') }),
        focusable(count, `count-${i}`),
        h('span', { id: chipsLabel, class: 'visually-hidden', text: t('simple.quickCounts') }),
        chips,
        h('small', {
          class: 'hint',
          id: hintId,
          text: [
            t('free.countHelp', {
              max: formatInt(FREE_LIMITS.sideCount[1]),
              total: formatInt(FREE_LIMITS.totalCount),
            }),
            social
              ? t('simple.socialChips', { n: formatInt(Math.max(...countChips(s.species))) })
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        }),
      ),
    );
  }

  function notes(c: FreeConfig): HTMLElement[] {
    const [a, b] = c.sides;
    const out: HTMLElement[] = [];
    if (a.species === b.species)
      out.push(h('p', { class: 'free-note', text: t('free.sameSpecies') }));
    // H. erectus carries its thought-experiment note wherever it is shown (docs/SPECIES.md §9).
    if (a.species === 'homoErectus' || b.species === 'homoErectus') {
      out.push(h('p', { class: 'matchup-note', text: t('matchup.thoughtExperiment') }));
    }
    if (hasHiddenEdits(c)) out.push(h('p', { class: 'free-note', text: t('simple.hiddenEdits') }));
    const seed = opts.linkSeed();
    out.push(
      h('p', {
        class: 'free-note',
        text:
          seed === null ? t('simple.seedNote') : t('simple.linkSeedNote', { seed: String(seed) }),
      }),
    );
    return out;
  }

  function render(c: FreeConfig, focusKey?: string): void {
    cfg = c;
    form.replaceChildren(
      presets(c),
      h(
        'div',
        { class: 'free-sides simple-sides', attrs: { 'data-tour': 'simple-pick' } },
        side(c, 0),
        side(c, 1),
      ),
      ...notes(c),
    );
    if (focusKey) form.querySelector<HTMLElement>(`[${FOCUS_ATTR}="${focusKey}"]`)?.focus();
  }

  const againBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  againBtn.addEventListener('click', () => opts.run());

  function renderResult(res: { config: FreeConfig; agg: FreeAggregate } | null): void {
    bar.hidden = res === null;
    breakdown.hidden = res === null;
    if (!res) {
      bar.replaceChildren();
      breakdown.replaceChildren();
      return;
    }
    const { config: c, agg } = res;
    const team = (i: FreeSideIndex): string =>
      t('free.sideTeam', {
        side: t(sideKey(i)),
        team: teamLabel(c.sides[i].species, c.sides[i].count),
      });
    const share = [formatShare(agg.aWins, agg.n), formatShare(agg.bWins, agg.n)] as const;
    const segment = (cls: string, k: number): HTMLElement => {
      const el = h('span', { class: `simple-bar-seg ${cls}` });
      el.style.flexGrow = String(k);
      el.hidden = k === 0;
      return el;
    };
    bar.replaceChildren(
      h(
        'p',
        { class: 'simple-bar-labels' },
        h('span', { class: 'simple-bar-a', text: `${team(0)} ${share[0]}` }),
        h('span', { class: 'simple-bar-b', text: `${share[1]} ${team(1)}` }),
      ),
      h(
        'div',
        {
          class: 'simple-bar-track',
          attrs: {
            role: 'img',
            'aria-label': t('simple.barLabel', {
              a: team(0),
              pa: share[0],
              b: team(1),
              pb: share[1],
              pd: formatShare(agg.draws, agg.n),
            }),
          },
        },
        segment('mk-heavy', agg.aWins),
        segment('mk-draw', agg.draws),
        segment('mk-pack', agg.bWins),
      ),
    );
    // Still standing / fled / incapacitated per side (#42): the three add up to the side's count.
    const rows = (i: FreeSideIndex): HTMLElement => {
      const s = i === 0 ? agg.a : agg.b;
      const n = c.sides[i].count;
      const row = (key: MsgKey, mean: number): HTMLElement =>
        h(
          'li',
          {},
          h('span', { class: 'simple-part-label', text: t(key) }),
          h('span', {
            class: 'simple-part-value',
            text: t('simple.part', {
              mean: formatNum(mean, 1),
              n: formatInt(n),
              counter: speciesCounter(c.sides[i].species),
              pct: formatPct(n > 0 ? mean / n : 0, 0),
            }),
          }),
        );
      return h(
        'div',
        { class: `simple-breakdown-side simple-breakdown-${i === 0 ? 'a' : 'b'}` },
        h(
          'h4',
          {},
          h('span', {
            class: `marker ${i === 0 ? 'mk-heavy' : 'mk-pack'}`,
            attrs: { 'aria-hidden': 'true' },
          }),
          ' ',
          team(i),
        ),
        h(
          'ul',
          {},
          row('simple.standing', s.active),
          row('simple.fled', s.routed),
          row('simple.out', s.killed),
        ),
      );
    };
    againBtn.textContent = t('simple.again');
    breakdown.replaceChildren(
      h('p', { class: 'simple-breakdown-title', text: t('simple.breakdown') }),
      h('div', { class: 'simple-breakdown-sides' }, ...SIDES.map(rows)),
      h('div', { class: 'simple-again' }, againBtn),
    );
  }

  return { form, bar, breakdown, render, renderResult };
}
