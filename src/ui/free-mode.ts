import { LIMITS, SAMPLING_METHODS } from '../sim/config';
import { routNotice, type FreeAggregate } from '../sim/free/aggregate';
import { FreeOutcome, type FreeRunSummary } from '../sim/free/engine';
import {
  FREE_LIMITS,
  GLOBALS,
  PACK_BUFF_EFFECTS,
  sanitizeFreeConfig,
  type FreeConfig,
} from '../sim/free/config';
import { FREE_SPECIES, FREE_SPECIES_IDS } from '../sim/free/species';
import type { Interval } from '../sim/stats';
import { copyText } from '../share/share-ui';
import { pagePath } from '../pages/routes';
import { h } from './dom';
import { formatDuration, formatInt, formatNum, formatPct } from './format';
import { getLang, speciesCounter, speciesName, t, teamLabel, type MsgKey } from './i18n';
import { CancelledError, type PoolProgress, type SimPool } from './pool';
import type { FreeReplayView } from './free-replay';
import { createFreeReproduceCheck, createFreeResultShare } from './result-share';
import { createSimpleView } from './simple-mode';
import {
  freshSeed,
  simpleCanShow,
  simpleRunConfig,
  simpleRuns,
  withRequestedRuns,
} from './simple-model';
import { formatBound, formatShare } from './verdict';
import {
  sideBuffState,
  withBuffSwitch,
  withMorale,
  withNumber,
  withSampling,
  withSideCount,
  withSideSpecies,
} from './free-form-model';
import './free-mode.css';

/*
 * Free matchups in the simulator (docs/design/FREE-MATCHUPS.md §6, issue #50): any species on
 * either side, mirror matchups included, run on the free engine through the same worker pool.
 * Self-contained so the classic form and results (src/ui/app.ts, form.ts) stay untouched; the
 * app only swaps panels and routes the share link. The replay is src/ui/free-replay.ts.
 *
 * Two views over the same config (#146): `full`, the free form of Advanced mode, and `simple`,
 * Simple mode (src/ui/simple-mode.ts), which shows only presets, species and counts and runs
 * everything else at its defaults with a fresh seed per Run. A page opened from a link Simple
 * mode wrote (#154) keeps that link's seed for its first Run, so the link reproduces its result.
 */

export type FreeView = 'simple' | 'full';

export interface FreeMode {
  configPanel: HTMLElement;
  resultsPanel: HTMLElement;
  getConfig(): FreeConfig;
  /**
   * Replace the config. `linkSeed`: it came from a Simple link pasted into the open page (#154),
   * so the next Simple Run keeps its seed, as on a page opened with that link.
   */
  setConfig(c: FreeConfig, opts?: { linkSeed?: boolean }): void;
  /** Re-render every text in the current language (results stay). */
  relocalize(): void;
  /** Whether a run is in progress. */
  isRunning(): boolean;
  /** Whether results are shown. */
  hasResult(): boolean;
  /**
   * Run now, as the Run button does (the Simple tour's "run it now", docs/TUTORIAL.md). Resolves
   * true once fresh results are rendered, false when the run was refused, cancelled or failed.
   */
  runNow(): Promise<boolean>;
  /** Show Simple mode or the full free form (same config, same results). */
  setView(v: FreeView): void;
}

export interface FreeModeOptions {
  initial: FreeConfig;
  pool: SimPool;
  /** A fresh mode switch for the top of the config panel. */
  modeSwitch: () => HTMLElement;
  /** Called after every config change (the app writes the URL). */
  onChange: (c: FreeConfig) => void;
  showToast: (text: string) => void;
  /** The location hash the page opened with, read for a reproduction check (`&chk=`). */
  startHash?: string;
  /** A note the app shows under the mode switch (a link of a newer model, ADR-0008 §6). */
  notice?: HTMLElement;
  /** The view to start in (default `full`). */
  view?: FreeView;
  /** Called with the config of every run as it starts (the app writes the URL after a Simple run). */
  onRun?: (c: FreeConfig) => void;
  /**
   * The page opened in Simple mode from a link Simple mode wrote (#154): the first Simple Run uses
   * the link's seed instead of a fresh one, until the first edit or view change.
   */
  linkSeed?: boolean;
}

interface FreeResult {
  config: FreeConfig;
  /** A Simple run made it: its result link carries the Simple-mode marker (#154). */
  simple: boolean;
  agg: FreeAggregate;
  summaries: FreeRunSummary[];
  elapsedMs: number;
}

type SideIndex = 0 | 1;

const sideKey = (i: SideIndex): MsgKey => (i === 0 ? 'free.sideA' : 'free.sideB');

let uid = 0;
const nextId = (base: string): string => `${base}-${++uid}`;

export function createFreeMode(opts: FreeModeOptions): FreeMode {
  const { pool } = opts;
  let cfg: FreeConfig = sanitizeFreeConfig(opts.initial);
  let view: FreeView = opts.view ?? 'full';
  // The run count asked for (a link, the runs field, or Simple's default), before the work budget
  // lowered it for large counts; Simple edits re-apply it (withRequestedRuns). A Simple link
  // holds the lowered count, so Simple asks for its own.
  let requestedRuns = view === 'simple' ? simpleRuns(cfg) : cfg.runs;
  // The link's seed is kept for the first Simple Run (#154), so "Run it yourself" and a shared
  // Simple link reproduce; any edit or view change goes back to a fresh seed per Run (R3).
  let keepLinkSeed = view === 'simple' && opts.linkSeed === true;
  let result: FreeResult | null = null;
  let running = false;
  let statusKey: { key: MsgKey; vars?: Record<string, string | number>; error?: boolean } | null =
    null;
  let lastProgress: PoolProgress | null = null;
  // "Share result" for finished runs and the check of a free "Run it yourself" link.
  const resultShare = createFreeResultShare();
  const repro = createFreeReproduceCheck(opts.startHash ?? '', cfg);

  // ---------- config panel ----------
  const formEl = h('form', { class: 'config-form free-form', attrs: { novalidate: '' } });
  formEl.addEventListener('submit', (e) => e.preventDefault());

  const runBtn = h('button', { class: 'btn btn-primary btn-large', attrs: { type: 'button' } });
  const cancelBtn = h('button', { class: 'btn', attrs: { type: 'button' } });
  cancelBtn.disabled = true;
  const progressFill = h('div', { class: 'progress-fill' });
  const progressTrack = h(
    'div',
    {
      class: 'progress-track',
      attrs: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        tabindex: '-1',
      },
    },
    progressFill,
  );
  const progressText = h('span', { class: 'progress-text' });
  const progress = h(
    'div',
    { class: 'progress' },
    progressTrack,
    h('div', { class: 'progress-meta' }, progressText),
  );
  progress.hidden = true;
  const statusEl = h('p', {
    class: 'run-status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const copyBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  copyBtn.addEventListener('click', () => {
    void import('./share-free').then(({ freeConfigCode }) =>
      copyText(freeConfigCode(cfg), getLang()).then((ok) => ok && opts.showToast(t('free.copied'))),
    );
  });
  const runBar = h(
    'div',
    { class: 'run-bar', attrs: { 'data-tour': 'simple-run' } },
    h('div', { class: 'run-buttons' }, runBtn, cancelBtn),
    progress,
    statusEl,
    repro.el,
  );
  const simple = createSimpleView({
    update: (c, focusKey) => {
      keepLinkSeed = false;
      cfg = withRequestedRuns(c, requestedRuns);
      commit(undefined, focusKey);
    },
    run: () => void run(),
    linkSeed: () => (keepLinkSeed ? cfg.seed : null),
  });
  const freeTools = h('div', { class: 'free-tools' }, copyBtn);
  const configTitle = h('h2', { id: nextId('free-config-title') });
  const switchSlot = h('div', { class: 'free-mode-switch' });
  const configPanel = h(
    'section',
    { class: 'panel config-panel', attrs: { 'aria-labelledby': configTitle.id } },
    configTitle,
    switchSlot,
    opts.notice,
    simple.form,
    formEl,
    runBar,
    freeTools,
  );

  // ---------- results panel ----------
  const resultsTitle = h('h2', { id: nextId('free-results-title'), attrs: { tabindex: '-1' } });
  const emptyEl = h('p', {
    class: 'results-empty',
    attrs: { 'data-tour': 'simple-results-empty' },
  });
  const provisionalEl = h('p', { class: 'free-provisional' });
  const verdictEl = h('p', { class: 'verdict' });
  const precisionEl = h('p', { class: 'verdict-precision' });
  // Rout notice (design §3.2, #42): a rout should read as a rout, not as a bug.
  const routEl = h('p', { class: 'free-rout-notice' });
  routEl.hidden = true;
  const caveatLink = h('a', {});
  const caveatEl = h('p', { class: 'verdict-caveat' });
  const basisEl = h('p', { class: 'verdict-basis' });
  const cardsEl = h('div', { class: 'stat-cards' });
  // Simple mode keeps the cards (and the basis line) behind a "Details" disclosure (design §3.2).
  const cardsSlot = h('div', { class: 'free-cards-slot' }, cardsEl);
  const detailsSummary = h('summary', {});
  const detailsEl = h('details', { class: 'simple-details' }, detailsSummary);
  // ---------- replay (design §6) ----------
  const replayTitle = h('h3', { id: nextId('free-replay-title') });
  const repBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  const randomBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  const replayInfo = h('p', { class: 'replay-info', attrs: { 'aria-live': 'polite' } });
  // The renderer is a lazy chunk (like the classic replay, #80): loaded with the first trace.
  let replayView: FreeReplayView | null = null;
  const replaySlot = h('div', { class: 'replay-slot' });
  const replaySection = h(
    'section',
    { class: 'replay-section free-replay-section', attrs: { 'aria-labelledby': replayTitle.id } },
    h(
      'div',
      { class: 'replay-head' },
      replayTitle,
      h('div', { class: 'replay-buttons' }, repBtn, randomBtn),
    ),
    replayInfo,
    replaySlot,
  );
  let replayState: {
    kind: 'representative' | 'random';
    run: number;
    loading: boolean;
    error?: string;
  } | null = null;
  let replayToken = 0;
  const staleEl = h('p', { class: 'stale-banner' });
  staleEl.hidden = true;
  const resultsBody = h(
    'div',
    { class: 'results-body' },
    staleEl,
    h(
      'div',
      {
        class: 'verdict-box',
        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', 'data-tour': 'simple-result' },
      },
      provisionalEl,
      simple.bar,
      verdictEl,
      precisionEl,
      routEl,
      caveatEl,
      basisEl,
    ),
    simple.breakdown,
    cardsSlot,
    detailsEl,
    resultShare.el,
    replaySection,
  );
  resultsBody.hidden = true;
  const resultsPanel = h(
    'section',
    {
      class: 'panel results-panel',
      attrs: { 'aria-labelledby': resultsTitle.id, 'data-tour': 'simple-results' },
    },
    resultsTitle,
    emptyEl,
    resultsBody,
  );

  // ---------- form ----------
  function field(label: string, help: string, control: HTMLElement, id: string): HTMLElement {
    const hintId = `${id}-hint`;
    control.setAttribute('aria-describedby', hintId);
    return h(
      'div',
      { class: 'field' },
      h('label', { attrs: { for: id }, text: label }),
      control,
      h('small', { class: 'hint', id: hintId, text: help }),
    );
  }

  function numberInput(
    value: number,
    [lo, hi]: readonly [number, number],
    step: number,
    int: boolean,
    apply: (n: number) => void,
  ): HTMLInputElement {
    const input = h('input', {
      attrs: {
        type: 'number',
        inputmode: int ? 'numeric' : 'decimal',
        min: String(lo),
        max: String(hi),
        step: String(step),
      },
    });
    input.value = String(value);
    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(n)) {
        build();
        return;
      }
      apply(n);
      commit();
    });
    return input;
  }

  function speciesSelect(i: SideIndex, id: string): HTMLSelectElement {
    const el = h('select', { id, class: 'species-select' });
    for (const group of ['extant', 'extinct'] as const) {
      const og = h('optgroup', { attrs: { label: t(`species.group.${group}`) } });
      for (const s of FREE_SPECIES_IDS) {
        if ((FREE_SPECIES[s].era === 'extant') !== (group === 'extant')) continue;
        og.append(h('option', { attrs: { value: s }, text: speciesName(s) }));
      }
      el.append(og);
    }
    el.value = cfg.sides[i].species;
    el.addEventListener('change', () => {
      cfg = withSideSpecies(cfg, i, el.value);
      commit(id);
    });
    return el;
  }

  function badges(i: SideIndex): HTMLElement {
    const species = cfg.sides[i].species;
    const s = FREE_SPECIES[species];
    const buff = sideBuffState(cfg, i, s.social);
    const buffKey: MsgKey | null =
      buff === 'active'
        ? 'free.badge.buffActive'
        : buff === 'off'
          ? 'free.badge.buffOff'
          : buff === 'alone'
            ? 'free.badge.alone'
            : null;
    return h(
      'ul',
      { class: 'free-badges' },
      buffKey ? h('li', { class: buff === 'active' ? 'is-buff' : '', text: t(buffKey) }) : null,
      h('li', {
        class: s.social ? 'is-social' : '',
        text: t(s.social ? 'free.badge.social' : 'free.badge.solitary'),
      }),
      h('li', { text: t(s.canLatch ? 'free.badge.latch' : 'free.badge.strike') }),
    );
  }

  /** The pack-buff rules (design §5) as a disclosure, with this matchup's cohesion radius. */
  function rules(): HTMLElement {
    const social = cfg.sides.filter((x) => FREE_SPECIES[x.species].social);
    const radius =
      social.length > 0
        ? Math.round(Math.max(...social.map((x) => x.buff.cohesionRadius.mode)))
        : 60;
    const grace = GLOBALS.find((g) => g.id === 'buffGrace')?.preset.mode ?? 2;
    const keys: MsgKey[] = [
      'free.rules.activation',
      'free.rules.coordinate',
      'free.rules.focus',
      'free.rules.groupLatch',
      'free.rules.morale',
      'free.rules.relief',
      'free.rules.deactivation',
      'free.rules.loners',
    ];
    return h(
      'details',
      { class: 'free-rules' },
      h('summary', { text: t('free.rules.summary') }),
      h(
        'ul',
        {},
        ...keys.map((k) =>
          h('li', { text: t(k, { r: formatInt(radius), grace: formatNum(grace, 0) }) }),
        ),
      ),
    );
  }

  /** One checkbox per pack-buff effect; shown when either side is a social species. */
  function buffSwitches(): HTMLElement | null {
    if (!cfg.sides.some((x) => FREE_SPECIES[x.species].social)) return null;
    const list = h('div', { class: 'free-buff-switches' });
    for (const e of PACK_BUFF_EFFECTS) {
      const id = nextId(`free-buff-${e}`);
      const box = h('input', { id, attrs: { type: 'checkbox' } });
      box.checked = cfg.packBuff[e];
      box.addEventListener('change', () => {
        cfg = withBuffSwitch(cfg, e, box.checked);
        commit(id);
      });
      list.append(
        h(
          'label',
          { class: 'check', attrs: { for: id } },
          box,
          h('span', { text: t(`free.buff.${e}`) }),
        ),
      );
    }
    const hintId = nextId('free-buff-hint');
    return h(
      'fieldset',
      { class: 'free-shared free-buff', attrs: { 'aria-describedby': hintId } },
      h('legend', { text: t('free.buff.title') }),
      list,
      h('small', { class: 'hint', id: hintId, text: t('free.buff.help') }),
    );
  }

  function sideFieldset(i: SideIndex): HTMLElement {
    const side = cfg.sides[i];
    const sid = nextId(`free-${i}-species`);
    const cid = nextId(`free-${i}-count`);
    const count = numberInput(side.count, FREE_LIMITS.sideCount, 1, true, (n) => {
      cfg = withSideCount(cfg, i, n);
    });
    count.id = cid;
    return h(
      'fieldset',
      { class: `free-side free-side-${i === 0 ? 'a' : 'b'}` },
      h('legend', { text: t(sideKey(i)) }),
      field(t('free.species'), t('free.speciesHelp'), speciesSelect(i, sid), sid),
      field(
        t('free.count'),
        t('free.countHelp', {
          max: formatInt(FREE_LIMITS.sideCount[1]),
          total: formatInt(FREE_LIMITS.totalCount),
        }),
        count,
        cid,
      ),
      badges(i),
    );
  }

  function sharedSettings(): HTMLElement {
    const grid = h('div', { class: 'field-grid' });
    const num = (
      key: 'runs' | 'seed' | 'arenaSize' | 'maxTime' | 'individualCV',
      label: MsgKey,
      help: string,
      step: number,
      int: boolean,
    ): void => {
      const id = nextId(`free-${key}`);
      const input = numberInput(cfg[key], LIMITS[key], step, int, (n) => {
        cfg = withNumber(cfg, key, n);
        if (key === 'runs') requestedRuns = n;
      });
      input.id = id;
      grid.append(field(t(label), help, input, id));
    };
    num('runs', 'field.runs', t('help.runs'), 1, true);
    num('seed', 'field.seed', t('help.seed'), 1, true);
    num('arenaSize', 'field.arenaSize', t('free.arenaHelp'), 10, false);
    num('maxTime', 'field.maxTime', t('help.maxTime'), 10, false);
    num('individualCV', 'field.individualCV', t('help.individualCV'), 0.01, false);

    const sid = nextId('free-sampling');
    const sel = h('select', { id: sid });
    for (const m of SAMPLING_METHODS) {
      sel.append(h('option', { attrs: { value: m }, text: t(`sampling.${m}`) }));
    }
    sel.value = cfg.sampling;
    sel.addEventListener('change', () => {
      cfg = withSampling(cfg, sel.value);
      commit(sid);
    });
    grid.append(field(t('field.sampling'), t('help.sampling'), sel, sid));

    const mid = nextId('free-morale');
    const box = h('input', {
      id: mid,
      attrs: { type: 'checkbox', 'aria-describedby': `${mid}-hint` },
    });
    box.checked = cfg.morale;
    box.addEventListener('change', () => {
      cfg = withMorale(cfg, box.checked);
      commit(mid);
    });
    grid.append(
      h(
        'div',
        { class: 'field field-wide' },
        h('span', { class: 'field-label', text: t('field.morale') }),
        h(
          'label',
          { class: 'check', attrs: { for: mid } },
          box,
          h('span', { text: t('morale.on') }),
        ),
        h('small', { class: 'hint', id: `${mid}-hint`, text: t('free.moraleHelp') }),
      ),
    );
    return h('fieldset', { class: 'free-shared' }, h('legend', { text: t('free.settings') }), grid);
  }

  function matchupNotes(): HTMLElement[] {
    const [a, b] = cfg.sides;
    const out: HTMLElement[] = [];
    if (a.species === b.species) {
      out.push(h('p', { class: 'free-note', text: t('free.sameSpecies') }));
    }
    if (a.species === 'homoErectus' || b.species === 'homoErectus') {
      out.push(h('p', { class: 'matchup-note', text: t('matchup.thoughtExperiment') }));
    }
    out.push(h('p', { class: 'free-note', text: t('free.badge.note') }));
    return out;
  }

  /** Rebuild the form from `cfg`, keeping focus on the control with `focusId`'s role. */
  // Replacing the form removes a focused input, whose blur can fire `change` and so a nested
  // commit; that rebuild is queued instead of running inside replaceChildren.
  let building = false;
  let rebuildQueued = false;
  function build(focusId?: string): void {
    if (building) {
      rebuildQueued = true;
      return;
    }
    building = true;
    try {
      const focusIndex = focusId
        ? [...formEl.querySelectorAll('[id]')].findIndex((e) => e.id === focusId)
        : -1;
      formEl.replaceChildren(
        h('div', { class: 'free-sides' }, sideFieldset(0), sideFieldset(1)),
        ...matchupNotes(),
        rules(),
        ...[buffSwitches()].filter((e): e is HTMLElement => e !== null),
        sharedSettings(),
      );
      if (focusIndex >= 0) {
        const next = formEl.querySelectorAll<HTMLElement>('[id]')[focusIndex];
        next?.focus();
      }
    } finally {
      building = false;
    }
    if (rebuildQueued) {
      rebuildQueued = false;
      build();
    }
  }

  function commit(focusId?: string, simpleFocus?: string): void {
    const active = document.activeElement;
    const keep =
      focusId ?? (active instanceof HTMLElement && formEl.contains(active) ? active.id : undefined);
    cfg = sanitizeFreeConfig(cfg);
    if (view === 'simple') simple.render(cfg, simpleFocus);
    else build(keep);
    updateStale();
    opts.onChange(structuredClone(cfg));
  }

  /** Rebuild the form of the current view. */
  function buildView(): void {
    if (view === 'simple') simple.render(cfg);
    else build();
  }

  /** Show the parts of the current view; the other view's form is emptied, not kept in sync. */
  function applyView(): void {
    const isSimple = view === 'simple';
    simple.form.hidden = !isSimple;
    formEl.hidden = isSimple;
    freeTools.hidden = isSimple;
    resultsPanel.classList.toggle('is-simple', isSimple);
    detailsEl.hidden = !isSimple;
    if (isSimple) detailsEl.append(basisEl, cardsEl);
    else {
      cardsSlot.append(cardsEl);
      caveatEl.after(basisEl);
    }
    switchSlot.replaceChildren(opts.modeSwitch());
    buildView();
  }

  // ---------- running ----------
  function setStatus(s: typeof statusKey): void {
    statusKey = s;
    statusEl.textContent = s ? t(s.key, s.vars) : '';
    statusEl.classList.toggle('is-error', s?.error === true);
  }

  function renderProgress(): void {
    const p = lastProgress;
    if (!p) return;
    const frac = p.total > 0 ? p.done / p.total : 0;
    progressFill.style.transform = `scaleX(${frac})`;
    progressTrack.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    progressTrack.setAttribute('aria-label', t('progress.label'));
    progressText.textContent = t('progress.text', {
      done: formatInt(p.done),
      total: formatInt(p.total),
      pct: formatPct(frac, 0),
    });
  }

  async function run(): Promise<void> {
    if (running) return;
    // Simple mode: the shown species and counts, everything else at its defaults, and a fresh
    // seed for every Run (R3); the app writes it into the address (onRun).
    const isSimple = view === 'simple';
    if (isSimple) {
      requestedRuns = simpleRuns(cfg);
      cfg = simpleRunConfig(cfg, keepLinkSeed ? cfg.seed : freshSeed());
      keepLinkSeed = false;
    }
    const runCfg = sanitizeFreeConfig(structuredClone(cfg));
    if (view === 'simple' || runCfg.runs !== cfg.runs) {
      cfg = runCfg;
      buildView();
      updateStale();
      opts.onChange(structuredClone(cfg));
    }
    opts.onRun?.(structuredClone(runCfg));
    running = true;
    // Fetch the replay chunk while the batch runs (Run is a user input, so mounting is no shift).
    void ensureReplay().catch(() => undefined);
    progress.hidden = false;
    progressTrack.focus();
    runBtn.disabled = true;
    cancelBtn.disabled = false;
    lastProgress = { done: 0, total: runCfg.runs, elapsedMs: 0, etaMs: null };
    renderProgress();
    setStatus({ key: 'progress.workers', vars: { n: pool.size } });
    const t0 = performance.now();
    try {
      const summaries = await pool.runFree(runCfg, (p) => {
        lastProgress = p;
        renderProgress();
      });
      setStatus({ key: 'run.aggregating' });
      // In a worker, like the classic aggregate: no long task on the main thread (#24).
      const agg = await pool.aggregateFree(runCfg, summaries);
      result = {
        config: runCfg,
        simple: isSimple && simpleCanShow(runCfg),
        agg,
        summaries,
        elapsedMs: performance.now() - t0,
      };
      repro.afterRun(runCfg, agg);
      setStatus(null);
      renderResults();
      void loadReplay(agg.representativeRun, 'representative');
      resultsTitle.focus({ preventScroll: true });
      if (matchMedia('(max-width: 999px)').matches) {
        resultsPanel.scrollIntoView({ block: 'start' });
      }
    } catch (err) {
      if (err instanceof CancelledError) setStatus({ key: 'run.cancelled' });
      else {
        setStatus({
          key: 'run.error',
          vars: { msg: err instanceof Error ? err.message : String(err) },
          error: true,
        });
      }
    } finally {
      running = false;
      runBtn.disabled = false;
      cancelBtn.disabled = true;
    }
  }
  runBtn.addEventListener('click', () => void run());

  /** The replay renderer, loaded on first use and mounted into its slot. */
  async function ensureReplay(): Promise<FreeReplayView> {
    if (replayView) return replayView;
    const { FreeReplayView } = await import('./free-replay');
    if (!replayView) {
      replayView = new FreeReplayView();
      replaySlot.replaceChildren(replayView.el);
    }
    return replayView;
  }

  /** Re-simulate one run with its trace in the replay worker and show it. */
  async function loadReplay(run: number, kind: 'representative' | 'random'): Promise<void> {
    const res = result;
    if (!res) return;
    const token = ++replayToken;
    replayState = { kind, run, loading: true };
    renderReplayInfo();
    try {
      const view = ensureReplay();
      const trace = await pool.replayFree(res.config, run);
      const v = await view;
      if (token !== replayToken) return;
      replayState = { kind, run, loading: false };
      renderReplayInfo();
      v.load(trace, [team(res.config, 0), team(res.config, 1)]);
    } catch (err) {
      if (err instanceof CancelledError || token !== replayToken) return;
      replayState = {
        kind,
        run,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      };
      renderReplayInfo();
    }
  }

  function renderReplayInfo(): void {
    const st = replayState;
    replayInfo.classList.toggle('is-error', !!st?.error);
    if (!st || !result) {
      replayInfo.textContent = '';
      return;
    }
    if (st.error) {
      replayInfo.textContent = t('replay.failed', { msg: st.error });
      return;
    }
    if (st.loading) {
      replayInfo.textContent = t('replay.loading');
      return;
    }
    const c = result.config;
    const s = result.summaries.find((x) => x.run === st.run);
    const note = t(st.kind === 'representative' ? 'free.replay.repNote' : 'replay.randomNote');
    const outcome = !s
      ? ''
      : s.outcome === FreeOutcome.Draw
        ? t('outcome.draw')
        : t('free.win', { side: team(c, s.outcome === FreeOutcome.A ? 0 : 1) });
    const info = s
      ? t('replay.runInfo', { run: st.run + 1, outcome, duration: formatDuration(s.duration) })
      : '';
    replayInfo.textContent = `${info} — ${note}`;
  }

  repBtn.addEventListener('click', () => {
    if (result) void loadReplay(result.agg.representativeRun, 'representative');
  });
  randomBtn.addEventListener('click', () => {
    if (!result || result.summaries.length === 0) return;
    const pick = result.summaries[Math.floor(Math.random() * result.summaries.length)];
    if (pick) void loadReplay(pick.run, 'random');
  });
  cancelBtn.addEventListener('click', () => pool.cancel());

  // ---------- results ----------
  function updateStale(): void {
    staleEl.hidden = !result || JSON.stringify(result.config) === JSON.stringify(cfg);
  }

  const team = (c: FreeConfig, i: SideIndex): string =>
    t('free.sideTeam', {
      side: t(sideKey(i)),
      team: teamLabel(c.sides[i].species, c.sides[i].count),
    });

  function card(label: string, value: string, sub: string, marker?: string): HTMLElement {
    return h(
      'div',
      { class: 'stat-card' },
      h(
        'p',
        { class: 'stat-label' },
        marker ? h('span', { class: `marker ${marker}`, attrs: { 'aria-hidden': 'true' } }) : null,
        label,
      ),
      h('p', { class: 'stat-value', text: value }),
      h('p', { class: 'stat-sub', text: sub }),
    );
  }

  const shareSub = (k: number, n: number, iv: Interval): string =>
    t('stat.share', {
      k: formatInt(k),
      n: formatInt(n),
      lo: formatBound(iv.lo, n),
      hi: formatBound(iv.hi, n),
    });

  function renderResults(): void {
    emptyEl.hidden = result !== null;
    resultsBody.hidden = result === null;
    updateStale();
    resultShare.update(
      result ? { config: result.config, agg: result.agg, simple: result.simple } : null,
    );
    simple.renderResult(view === 'simple' ? result : null);
    if (!result) return;
    const { agg, config: c } = result;
    caveatLink.href = pagePath('model', getLang());
    const leads: { k: number; key: 'a' | 'b' | 'draw' }[] = [
      { k: agg.aWins, key: 'a' },
      { k: agg.bWins, key: 'b' },
      { k: agg.draws, key: 'draw' },
    ];
    const lead = leads.reduce((x, y) => (y.k > x.k ? y : x));
    const pct = formatShare(lead.k, agg.n);
    verdictEl.textContent =
      lead.key === 'draw'
        ? t('verdict.draw', { n: formatInt(agg.n), k: formatInt(lead.k), pct })
        : t('free.verdict', {
            n: formatInt(agg.n),
            k: formatInt(lead.k),
            pct,
            team: team(c, lead.key === 'a' ? 0 : 1),
          });
    const iv = lead.key === 'a' ? agg.pA : lead.key === 'b' ? agg.pB : agg.pDraw;
    precisionEl.textContent = t('verdict.precision', {
      lo: formatBound(iv.lo, agg.n),
      hi: formatBound(iv.hi, agg.n),
    });
    basisEl.textContent = t('free.basis', {
      a: team(c, 0),
      b: team(c, 1),
      n: formatInt(agg.n),
      seed: String(c.seed),
      elapsed: formatDuration(result.elapsedMs / 1000),
    });
    const notice = routNotice(c, agg, result.summaries);
    routEl.hidden = notice === null;
    if (notice) {
      const whyLink = h('a', {
        attrs: { href: `${pagePath('model', getLang())}#morale` },
        text: t('free.rout.why'),
      });
      routEl.replaceChildren(
        h('span', {
          text: t('free.rout.notice', {
            side: t(sideKey(notice.side)),
            team: teamLabel(c.sides[notice.side].species, c.sides[notice.side].count),
            pct: formatPct(notice.share, 0),
          }),
        }),
        ' ',
        whyLink,
      );
    }
    // Still standing / fled / incapacitated per side (#42): the three add up to the side's count.
    const part = (i: SideIndex, mean: number): string =>
      t('free.stat.part', {
        n: formatInt(c.sides[i].count),
        counter: speciesCounter(c.sides[i].species),
        pct: formatPct(mean / c.sides[i].count, 0),
      });
    const sideCards = (i: SideIndex): HTMLElement[] => {
      const s = i === 0 ? agg.a : agg.b;
      const side = t(sideKey(i));
      const out = [
        card(t('free.stat.standing', { side }), formatNum(s.active, 1), part(i, s.active)),
        card(t('free.stat.routed', { side }), formatNum(s.routed, 1), part(i, s.routed)),
        card(t('free.stat.killed', { side }), formatNum(s.killed, 1), part(i, s.killed)),
      ];
      // Pack buff (design §6): only where it could apply, a social side of two or more.
      if (sideBuffState(c, i, FREE_SPECIES[c.sides[i].species].social) === 'active') {
        const b = i === 0 ? agg.buffA : agg.buffB;
        out.push(
          card(
            t('free.stat.buff', { side }),
            formatPct(b.mean.activeFrac, 0),
            t('free.stat.buffSub', { t: formatDuration(b.anyTimeMedian) }),
            'mk-buff',
          ),
        );
      }
      return out;
    };
    cardsEl.replaceChildren(
      card(
        t('free.win', { side: t('free.sideA') }),
        formatShare(agg.aWins, agg.n),
        shareSub(agg.aWins, agg.n, agg.pA),
        'mk-heavy',
      ),
      card(
        t('free.win', { side: t('free.sideB') }),
        formatShare(agg.bWins, agg.n),
        shareSub(agg.bWins, agg.n, agg.pB),
        'mk-pack',
      ),
      card(
        t('outcome.draw'),
        formatShare(agg.draws, agg.n),
        shareSub(agg.draws, agg.n, agg.pDraw),
        'mk-draw',
      ),
      card(
        t('stat.duration'),
        formatDuration(agg.duration.p50),
        t('stat.durationSub', {
          p5: formatDuration(agg.duration.p5, 0),
          p95: formatDuration(agg.duration.p95, 0),
        }),
      ),
      ...sideCards(0),
      ...sideCards(1),
    );
  }

  /** Every static text in the current language. */
  function relocalize(): void {
    configTitle.textContent = t('config.title');
    runBtn.textContent = t('run.start');
    cancelBtn.textContent = t('run.cancel');
    copyBtn.textContent = t('free.copyCode');
    resultsTitle.textContent = t('results.title');
    emptyEl.textContent = t('results.empty');
    staleEl.textContent = t('results.stale');
    provisionalEl.textContent = t('free.provisional');
    caveatLink.textContent = t('verdict.caveatLink');
    caveatLink.href = pagePath('model', getLang());
    caveatEl.replaceChildren(h('span', { text: t('verdict.caveat') }), ' ', caveatLink);
    replayTitle.textContent = t('replay.title');
    repBtn.textContent = t('replay.representative');
    randomBtn.textContent = t('replay.random');
    renderReplayInfo();
    replayView?.relocalize();
    if (result) replayView?.setSideNames([team(result.config, 0), team(result.config, 1)]);
    detailsSummary.textContent = t('simple.details');
    applyView();
    if (statusKey) setStatus(statusKey);
    renderProgress();
    renderResults();
  }

  relocalize();

  return {
    configPanel,
    resultsPanel,
    getConfig: () => structuredClone(cfg),
    setConfig: (c, o) => {
      keepLinkSeed = view === 'simple' && o?.linkSeed === true;
      cfg = sanitizeFreeConfig(c);
      requestedRuns = view === 'simple' ? simpleRuns(cfg) : c.runs;
      buildView();
      updateStale();
    },
    relocalize,
    isRunning: () => running,
    hasResult: () => result !== null,
    runNow: async () => {
      if (running) return false;
      const before = result;
      await run();
      return result !== null && result !== before;
    },
    setView: (v) => {
      if (v !== view) keepLinkSeed = false;
      view = v;
      applyView();
      renderResults();
    },
  };
}
