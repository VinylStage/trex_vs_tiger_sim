import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../sim/config';
import type { RunSummary } from '../sim/engine';
import type { AggregateResult } from '../sim/montecarlo';
import type { ParamId } from '../sim/params';
import { HEAVY_SPECIES, type SpeciesId } from '../sim/species';
import {
  CanvasChart,
  durationHistogram,
  histogramTable,
  outcomeTable,
  paintHistogram,
  paintOutcome,
  paintTornado,
  redrawAllCharts,
  tornadoTable,
  type HistogramOptions,
} from './charts';
import { announce } from './announce';
import {
  exchangeCard,
  isStale,
  outcomeKey,
  progressNote,
  tornadoHeight,
  type Message,
} from './app-model';
import { clear, h } from './dom';
import { costSummary, isCostOk } from './cost';
import { createConfigForm, matchupBadge, matchupNote, qualifiedParamLabel } from './form';
import { formatDuration, formatInt, formatNum, formatPct } from './format';
import {
  applyI18n,
  getLang,
  initLang,
  loadLang,
  onLangChange,
  otherLang as otherLangOf,
  setLang,
  setNamePair,
  t,
  speciesCounter,
  teamLabel,
  type Lang,
  type MsgKey,
} from './i18n';
import { CancelledError, SimPool, type PoolProgress } from './pool';
import type { ReplayView } from './replay';
import { routeHashChange, routeLink } from './link-route';
import {
  armLinkSeed,
  simpleCanShow,
  simpleKeepsAddress,
  type NavigationType,
} from './simple-model';
import { classicHashFromConfig } from './share';
import { defaultFreeConfig } from '../sim/free/config';
import { createFreeMode } from './free-mode';
import {
  freeHashModelNewer,
  freeInputModelNewer,
  hashFromFreeConfig,
  parseFreeConfigInput,
} from './share-free';
import { copyText } from '../share/share-ui';
import { createConfigTransfer } from './config-transfer';
import { createReproduceCheck, createResultShare } from './result-share';
import { hashHasAppState, pageLang, pagePath, playPageLang, switchedAppUrl } from '../pages/routes';
import { logoAttrs } from '../pages/site-shell';
import { createSiteNav, relocalizeLinks, renderFooterLinks } from './site-nav';
import './site-footer.css';
import type { Tour } from './tour';
import { createTourOffer } from './tour-offer';
import {
  DEMO_RUNS,
  manualHref,
  tourFor,
  tourRequested,
  withoutTourParam,
  type TourKind,
  type TourTrigger,
} from './tour-model';
import { createVersionBadge, fillVersionFooter } from './version';
import {
  formatShare,
  headline,
  intervalVars,
  leadingOutcome,
  outcomes,
  precisionLine,
  type OutcomeKind,
} from './verdict';

interface RunResult {
  config: ScenarioConfig;
  agg: AggregateResult;
  summaries: RunSummary[];
  elapsedMs: number;
}

/**
 * What the results panel shows while there are no results yet: the skeleton of a running first
 * run, or that run's cancellation or failure. The skeleton has the final block sizes, so results
 * arriving seconds after the click shift nothing below them (docs/research/UX_AUDIT.md P0-4).
 */
type Placeholder = 'pending' | 'cancelled' | 'failed';

interface ReplayState {
  kind: 'representative' | 'random';
  run: number;
  loading: boolean;
  error?: string;
}

/** How this page load happened (`PerformanceNavigationTiming.type`), if the browser says. */
function navigationType(): NavigationType {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return nav?.type;
}

/** Whether the page was opened from a play page of this site (the language fallback). */
function referrerIsPlayPage(): boolean {
  try {
    const r = new URL(document.referrer);
    return r.origin === location.origin && playPageLang(r.pathname) !== null;
  } catch {
    return false;
  }
}

export function startApp(root: HTMLElement): void {
  // The language comes from the URL (`/play/` Korean, `/en/play/` English) and its `<html lang>`.
  initLang(pageLang(location.pathname, document.documentElement.lang));
  // Same text as the static <title> of this language's play page (tests/pages.test.ts).
  document.title = t('play.documentTitle');
  const pool = new SimPool();
  // A cold page (no app state, no tour deep link) opens Simple mode (#146), and so does a link
  // Simple mode wrote (#154). Any other v3 link (`#s=` with `m: "free"`) opens the free form of
  // Advanced mode; every other link opens classic (D1). Old links that land on the lobby reach
  // this page with the same fragment (link-route.ts).
  const startHash = location.hash;
  const startRoute = routeLink(startHash, location.search);
  const startFree = startRoute.mode === 'classic' ? null : startRoute.config;
  /** Simple mode, or Advanced mode with the free form or the classic simulator. */
  let view: 'simple' | 'advanced' = startRoute.mode === 'simple' ? 'simple' : 'advanced';
  /** The engine Advanced mode shows; Simple mode always runs the free engine. */
  let mode: 'classic' | 'free' = startRoute.mode === 'classic' ? 'classic' : 'free';
  // Simple mode leaves a cold address alone until its first Run, which writes the config and its
  // fresh seed (R3); a reload of a cold page therefore opens Simple again.
  let simpleLinked = false;
  // A free link of a newer model opens at the free defaults (ADR-0008 §6). The address keeps that
  // link until the user edits something, so a reload (which loads the current build) or a copied
  // address still carries it, and a note says why the defaults are shown. A malformed `mv` also
  // opens the defaults, but its address is rewritten like any malformed link.
  let keepNewerLink = startRoute.mode === 'free' && startRoute.newerModel;
  const newerLinkNote = h('p', { class: 'stale-banner free-newer-link', i18n: 'free.newerModel' });
  newerLinkNote.hidden = !keepNewerLink;
  let config: ScenarioConfig = startRoute.mode === 'classic' ? startRoute.config : defaultConfig();
  // "Run it yourself" links carry a result snapshot (`&chk=`); read it before the URL is rewritten.
  const repro = createReproduceCheck(location.hash, config);
  const resultShare = createResultShare();
  let result: RunResult | null = null;
  let status: Message | null = null;
  let replayState: ReplayState | null = null;
  let replayToken = 0;
  let lastSrDecile = -1;
  let running = false;
  /** The last run was cancelled (its progress bar stays at the point it stopped). */
  let lastCancelled = false;
  let placeholder: Placeholder | null = null;
  let lastProgress: PoolProgress | null = null;
  /** Wall time of the last finished run; null while running or after a cancel or error. */
  let lastElapsedMs: number | null = null;

  // ---------- header ----------
  const langBtn = h('button', {
    class: 'btn btn-ghost',
    i18n: 'lang.switch',
    i18nAria: 'lang.switchAria',
    attrs: { type: 'button', 'data-tour': 'lang' },
  });
  const tourBtn = h('button', {
    class: 'btn btn-ghost',
    i18n: 'tour.start',
    attrs: { type: 'button', 'data-tour': 'tour' },
  });
  const otherLang = (): Lang => otherLangOf(getLang());
  // The button is labelled in the language it switches to.
  langBtn.lang = otherLang();
  // The page bundles only its own words; fetch the other language's early (#79). If they cannot
  // be loaded, open that language's page instead.
  const warmLang = (): void => void loadLang(otherLang()).catch(() => undefined);
  langBtn.addEventListener('pointerenter', warmLang);
  langBtn.addEventListener('focus', warmLang);
  langBtn.addEventListener('click', () => {
    const next = otherLang();
    setLang(next).catch(() =>
      location.assign(switchedAppUrl(next, location.search, location.hash)),
    );
  });
  const shareBtn = h('button', {
    class: 'btn',
    i18n: 'share.copy',
    i18nTitle: 'share.hint',
    attrs: { type: 'button', 'data-tour': 'share' },
  });
  // The toast is visual only; screen readers hear the message through the persistent announcer,
  // because a live region that was `hidden` misses text set as it appears (#69).
  const toast = h('div', { class: 'toast', attrs: { 'aria-hidden': 'true' } });
  toast.hidden = true;
  let toastTimer = 0;
  const showToast = (text: string): void => {
    toast.textContent = text;
    toast.hidden = false;
    announce(text);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2500);
  };
  shareBtn.addEventListener('click', () => {
    simpleLinked = true;
    writeUrl();
    const url = location.href;
    // Without clipboard access the link is shown in a selected field instead (src/share/share-ui.ts).
    void copyText(url, getLang()).then((ok) => ok && showToast(t('share.copied')));
  });

  // play/index.html and en/play/index.html ship a static header inside #app with the page's only <h1> and
  // a link to the other language, for crawlers that do not run JavaScript (docs/SEO.md). The app
  // moves that <h1> into its own header and drops the rest: the language button replaces the link.
  const staticHead = root.querySelector('.app-static-head');
  const title = staticHead?.querySelector('h1') ?? h('h1', { i18n: 'app.title' });
  staticHead?.remove();

  const header = h(
    'header',
    { class: 'app-header' },
    h(
      'div',
      { class: 'brand' },
      h('img', {
        class: 'logo',
        attrs: logoAttrs('app'),
      }),
      h(
        'div',
        {},
        h('div', { class: 'brand-title' }, title, createVersionBadge()),
        h('p', { class: 'tagline', i18n: 'app.tagline' }),
      ),
    ),
    h('div', { class: 'header-actions' }, shareBtn, tourBtn, langBtn),
  );
  // The play page is not a nav item: no link is the current page (not even the lobby's).
  let siteNav = createSiteNav(getLang(), null);
  header.append(siteNav);

  // ---------- view (Simple / Advanced, #146) and match-up mode (classic / free, #50) ----------
  let switchSeq = 0;
  /** The Advanced switch; one instance per config panel. */
  function viewSwitch(): HTMLElement {
    const id = `view-switch-${++switchSeq}`;
    const hintId = `${id}-hint`;
    const box = h('input', {
      id,
      attrs: { type: 'checkbox', role: 'switch', 'aria-describedby': hintId },
    });
    box.checked = view === 'advanced';
    box.addEventListener('change', () => setView(box.checked ? 'advanced' : 'simple'));
    // In Advanced mode a small link opens the guide's manual for the form shown (#158), in a new
    // tab so the results on this page stay.
    const manual =
      view === 'advanced'
        ? h(
            'a',
            {
              class: 'view-manual',
              attrs: {
                href: manualHref(getLang(), mode === 'classic' ? 'advanced-classic' : 'advanced'),
                target: '_blank',
                rel: 'noopener',
              },
            },
            h('span', { class: 'view-manual-icon', text: '?', attrs: { 'aria-hidden': 'true' } }),
            h('span', { text: t('view.manual') }),
            h('span', { class: 'visually-hidden', text: t('view.manualNewTab') }),
          )
        : null;
    return h(
      'div',
      { class: 'view-switch', attrs: { 'data-tour': 'view-switch' } },
      h(
        'div',
        { class: 'view-switch-row' },
        h(
          'label',
          { class: 'view-switch-label', attrs: { for: id } },
          box,
          h('span', { text: t('view.advanced') }),
        ),
        manual,
      ),
      h('small', {
        class: 'hint',
        id: hintId,
        text: t(view === 'advanced' ? 'view.advancedOn' : 'view.advancedOff'),
      }),
    );
  }

  /** The Advanced switch, and in Advanced mode the classic / free radio group below it. */
  function modeSwitch(): HTMLElement {
    return h(
      'div',
      { class: 'matchup-switches' },
      viewSwitch(),
      view === 'advanced' ? engineSwitch() : null,
    );
  }

  /** Radio group choosing the model. */
  function engineSwitch(): HTMLElement {
    const name = `matchup-mode-${++switchSeq}`;
    const hintId = `${name}-hint`;
    const option = (value: 'classic' | 'free', key: MsgKey): HTMLElement => {
      const input = h('input', { attrs: { type: 'radio', name, value } });
      input.checked = mode === value;
      input.addEventListener('change', () => {
        if (input.checked) setMode(value);
      });
      return h('label', { class: 'mode-option' }, input, h('span', { text: t(key) }));
    };
    return h(
      'fieldset',
      { class: 'mode-switch', attrs: { 'aria-describedby': hintId } },
      h('legend', { text: t('mode.label') }),
      h(
        'div',
        { class: 'mode-options' },
        option('classic', 'mode.classic'),
        option('free', 'mode.free'),
      ),
      h('small', { class: 'hint', id: hintId, text: t('mode.help') }),
    );
  }
  const classicSwitchSlot = h('div', { class: 'classic-mode-switch' });

  // ---------- config panel ----------
  const form = createConfigForm(config, pool.size, (c) => {
    config = c;
    writeUrl();
    updateStale();
    syncNames();
    renderCostNote();
  });

  /**
   * Messages without explicit names (results, charts, replay, tour) name the species of the shown
   * results, or of the edited scenario before the first run.
   */
  function syncNames(): void {
    setNamePair(result?.config ?? config);
  }
  syncNames();

  const runBtn = h('button', {
    class: 'btn btn-primary btn-large',
    i18n: 'run.start',
    attrs: { type: 'button' },
  });
  const cancelBtn = h('button', { class: 'btn', i18n: 'run.cancel', attrs: { type: 'button' } });
  cancelBtn.disabled = true;
  const progressFill = h('div', { class: 'progress-fill' });
  const progressTrack = h(
    'div',
    {
      class: 'progress-track',
      i18nAria: 'progress.label',
      attrs: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        // Run moves focus here, so keyboard and screen-reader users follow the run (WCAG 2.4.3).
        tabindex: '-1',
      },
    },
    progressFill,
  );
  const progressText = h('span', { class: 'progress-text' });
  const progressEta = h('span', { class: 'progress-eta' });
  const progress = h(
    'div',
    { class: 'progress' },
    progressTrack,
    h('div', { class: 'progress-meta' }, progressText, progressEta),
  );
  progress.hidden = true;
  const srProgress = h('p', {
    class: 'visually-hidden',
    attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  const statusEl = h('p', {
    class: 'run-status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  // A short cost note next to Run (the form's full warning may be scrolled away). Not a live
  // region: the form's warning already announces the same change.
  const costNoteEl = h('p', { class: 'run-status run-cost' });
  costNoteEl.hidden = true;

  const runBar = h(
    'div',
    { class: 'run-bar', attrs: { 'data-tour': 'run' } },
    h('div', { class: 'run-buttons' }, runBtn, cancelBtn),
    progress,
    statusEl,
    costNoteEl,
    repro.el,
    srProgress,
  );
  const configPanel = h(
    'section',
    { class: 'panel config-panel', attrs: { 'aria-labelledby': 'config-title' } },
    h('h2', { id: 'config-title', i18n: 'config.title' }),
    classicSwitchSlot,
    form.el,
    runBar,
    createConfigTransfer({
      getConfig: () => config,
      applyFreeInput: (text) => {
        // A newer model's code is refused, not swapped for the defaults (ADR-0008 §6).
        if (freeInputModelNewer(text)) return 'newerModel';
        const fc = parseFreeConfigInput(text);
        if (!fc) return 'notFree';
        free.setConfig(fc);
        setMode('free');
        writeUrl();
        return 'applied';
      },
      applyConfig: (c) => {
        config = c;
        form.setConfig(c);
        writeUrl();
        updateStale();
        syncNames();
      },
    }),
  );
  // The sticky run bar must never cover a focused field (WCAG 2.4.11): its height feeds
  // `scroll-padding-bottom` of the page (single column) and of the config panel (two columns).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--runbar-h',
        `${Math.ceil(runBar.offsetHeight)}px`,
      );
    }).observe(runBar);
  }

  // ---------- results panel ----------
  const emptyEl = h('p', {
    class: 'results-empty',
    i18n: 'results.empty',
    attrs: { 'data-tour': 'results-empty' },
  });
  const staleEl = h('p', { class: 'stale-banner', i18n: 'results.stale' });
  staleEl.hidden = true;
  const verdictEl = h('p', { class: 'verdict' });
  const precisionEl = h('p', { class: 'verdict-precision' });
  const caveatLink = h('a', { i18n: 'verdict.caveatLink' });
  const caveatEl = h(
    'p',
    { class: 'verdict-caveat' },
    h('span', { i18n: 'verdict.caveat' }),
    ' ',
    caveatLink,
  );
  const basisEl = h('p', { class: 'verdict-basis' });
  const badgeSlot = h('div', { class: 'verdict-badge' });
  const cardsEl = h('div', { class: 'stat-cards', attrs: { 'data-tour': 'stat-cards' } });
  const outcomeChart = new CanvasChart('chart.outcome', 'h-outcome');
  const durationChart = new CanvasChart('chart.duration', 'h-hist');
  const survivorsChart = new CanvasChart('chart.survivors', 'h-hist');
  const tornadoChart = new CanvasChart('chart.sensitivity', 'h-tornado', 'chart.sensitivityHelp');

  // The replay renderer loads when it is first needed (#80): on Run, or for a shared result. Run
  // is a user input, so the replay mounting into its slot shortly after it is not a layout shift.
  const replaySlot = h('div', { class: 'replay-slot' });
  let replayView: ReplayView | null = null;
  let replayModule: Promise<typeof import('./replay')> | null = null;
  const ensureReplay = (): Promise<typeof import('./replay')> =>
    (replayModule ??= import('./replay').then(
      (m) => {
        replayView = new m.ReplayView();
        replaySlot.append(replayView.el);
        return m;
      },
      (err: unknown) => {
        replayModule = null;
        throw err;
      },
    ));
  const repBtn = h('button', {
    class: 'btn btn-small',
    i18n: 'replay.representative',
    attrs: { type: 'button' },
  });
  const randomBtn = h('button', {
    class: 'btn btn-small',
    i18n: 'replay.random',
    attrs: { type: 'button' },
  });
  const replayInfo = h('p', { class: 'replay-info', attrs: { 'aria-live': 'polite' } });
  repBtn.addEventListener('click', () => {
    if (result) void loadReplay(result.agg.representativeRun, 'representative');
  });
  randomBtn.addEventListener('click', () => {
    if (!result || result.summaries.length === 0) return;
    const pick = result.summaries[Math.floor(Math.random() * result.summaries.length)];
    if (pick) void loadReplay(pick.run, 'random');
  });

  // Completion moves focus here (tabindex -1: focusable by script, not a tab stop).
  const resultsTitle = h('h2', {
    id: 'results-title',
    i18n: 'results.title',
    attrs: { tabindex: '-1' },
  });
  const resultsBody = h(
    'div',
    { class: 'results-body' },
    staleEl,
    h(
      'div',
      {
        class: 'verdict-box',
        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', 'data-tour': 'verdict' },
      },
      verdictEl,
      precisionEl,
      caveatEl,
      basisEl,
      badgeSlot,
      resultShare.el,
    ),
    cardsEl,
    h(
      'div',
      { class: 'chart-grid' },
      h('div', { class: 'span-2', attrs: { 'data-tour': 'outcome-chart' } }, outcomeChart.el),
      durationChart.el,
      survivorsChart.el,
      h('div', { class: 'span-2', attrs: { 'data-tour': 'sensitivity-chart' } }, tornadoChart.el),
    ),
    h(
      'section',
      {
        class: 'replay-section',
        attrs: { 'aria-labelledby': 'replay-title', 'data-tour': 'replay' },
      },
      h(
        'div',
        { class: 'replay-head' },
        h('h3', { id: 'replay-title', i18n: 'replay.title' }),
        h('div', { class: 'replay-buttons' }, repBtn, randomBtn),
      ),
      replayInfo,
      replaySlot,
    ),
  );
  resultsBody.hidden = true;

  const resultsPanel = h(
    'section',
    {
      class: 'panel results-panel',
      attrs: { 'aria-labelledby': 'results-title', 'data-tour': 'results' },
    },
    resultsTitle,
    emptyEl,
    resultsBody,
  );

  // ---------- footer ----------
  // The footer is static HTML outside #app (play/index.html, en/play/index.html): links, disclaimer and a
  // version slot. The app fills the version and re-localises it when the language changes.
  fillVersionFooter(document);

  const free = createFreeMode({
    initial: startFree ?? defaultFreeConfig(),
    pool,
    modeSwitch,
    onChange: () => {
      holdNewerLink(false);
      writeUrl();
    },
    onRun: () => {
      if (view !== 'simple') return;
      simpleLinked = true;
      writeUrl();
    },
    showToast,
    // An open Simple tour leaves its results preview once results exist (also for runs it did not
    // start), like the classic tour below.
    onRunEnd: () => tours.simple?.refresh(),
    startHash,
    notice: newerLinkNote,
    view: view === 'simple' ? 'simple' : 'full',
    // A Simple link (not a cold page) keeps its seed for the first Run, so it reproduces (#154),
    // unless this load is a reload, a back/forward visit or the language fallback (armLinkSeed).
    linkSeed:
      startRoute.mode === 'simple' &&
      hashHasAppState(startHash) &&
      armLinkSeed(navigationType(), referrerIsPlayPage()),
  });

  clear(root);
  root.append(
    header,
    h(
      'main',
      { class: 'layout', id: 'main' },
      configPanel,
      resultsPanel,
      free.configPanel,
      free.resultsPanel,
    ),
    toast,
  );
  renderCostNote();
  applyMode();

  function applyMode(): void {
    const isFree = mode === 'free';
    configPanel.hidden = isFree;
    resultsPanel.hidden = isFree;
    free.configPanel.hidden = !isFree;
    free.resultsPanel.hidden = !isFree;
    classicSwitchSlot.replaceChildren(modeSwitch());
    if (isFree) free.setView(view === 'simple' ? 'simple' : 'full');
  }

  /**
   * Show a view and engine; false when already shown. Simple mode runs the free engine, so only a
   * change of engine cancels a run in progress.
   */
  function show(nextView: 'simple' | 'advanced', nextMode: 'classic' | 'free'): boolean {
    const engine = nextView === 'simple' ? 'free' : nextMode;
    if (nextView === view && engine === mode) return false;
    if (engine !== mode && (running || free.isRunning())) pool.cancel();
    view = nextView;
    mode = engine;
    // The classic mode never holds a free link.
    if (engine === 'classic') holdNewerLink(false);
    applyMode();
    writeUrl();
    return true;
  }

  function setMode(next: 'classic' | 'free'): void {
    if (!show('advanced', next)) return;
    // Keep focus on the switch of the panel now shown.
    const panel = next === 'free' ? free.configPanel : configPanel;
    panel.querySelector<HTMLInputElement>(`.mode-switch input[value="${next}"]`)?.focus();
  }

  function setView(next: 'simple' | 'advanced'): void {
    if (!show(next, mode)) return;
    const panel = mode === 'free' ? free.configPanel : configPanel;
    panel.querySelector<HTMLInputElement>('.view-switch input')?.focus();
  }

  // ---------- behaviour ----------
  /** Keep the address of a newer model's link and show the note, or let both go. */
  function holdNewerLink(hold: boolean): void {
    keepNewerLink = hold;
    newerLinkNote.hidden = !hold;
  }

  function writeUrl(): void {
    if (keepNewerLink) return;
    if (view === 'simple' && simpleKeepsAddress(location.hash, simpleLinked)) return;
    // Simple mode marks its links so they reopen in Simple (#154), but only for a config Simple
    // can show whole: after an Advanced-only edit the link opens the free form instead.
    const fc = mode === 'free' ? free.getConfig() : null;
    const hash = fc
      ? hashFromFreeConfig(fc, { simple: view === 'simple' && simpleCanShow(fc) })
      : classicHashFromConfig(config);
    if (hash === location.hash) return;
    history.replaceState(history.state, '', hash || `${location.pathname}${location.search}`);
  }

  function updateStale(): void {
    staleEl.hidden = !isStale(result?.config ?? null, config);
  }

  function setStatus(msg: Message | null): void {
    status = msg;
    renderStatus();
  }

  function renderStatus(): void {
    statusEl.textContent = status ? t(status.key, status.vars) : '';
    statusEl.classList.toggle('is-error', status?.error === true);
    renderCostNote();
  }

  /** Shown only while idle with no other status, so it never competes with run messages. */
  function renderCostNote(): void {
    const cost = costSummary(config, pool.size);
    const show = !running && status === null && !isCostOk(cost);
    costNoteEl.hidden = !show;
    if (!show) {
      costNoteEl.textContent = '';
      return;
    }
    const parts: string[] = [];
    if (cost.cap !== null) parts.push(t('run.costCapped', { n: formatInt(cost.cap) }));
    if (cost.level !== 'ok') {
      const eta = formatDuration(cost.etaMs / 1000, 0);
      parts.push(t(cost.level === 'heavy' ? 'run.costHeavy' : 'run.costExtreme', { eta }));
    }
    costNoteEl.textContent = parts.join(' ');
  }

  function onProgress(p: PoolProgress): void {
    lastProgress = p;
    renderProgress();
    const frac = p.total > 0 ? p.done / p.total : 0;
    const decile = Math.floor(frac * 10);
    if (decile !== lastSrDecile) {
      lastSrDecile = decile;
      srProgress.textContent = `${t('progress.label')} ${formatPct(frac, 0)}`;
    }
  }

  /**
   * The progress bar stays visible once a run has started, showing how the last run ended:
   * hiding it again would move everything below the config panel (layout shift).
   */
  function renderProgress(): void {
    const p = lastProgress;
    if (!p) return;
    const frac = p.total > 0 ? p.done / p.total : 0;
    progressFill.style.transform = `scaleX(${frac})`;
    progressTrack.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    progressText.textContent = t('progress.text', {
      done: formatInt(p.done),
      total: formatInt(p.total),
      pct: formatPct(frac, 0),
    });
    progress.classList.toggle('is-cancelled', !running && lastCancelled);
    const note = progressNote({
      running,
      cancelled: lastCancelled,
      elapsedMs: lastElapsedMs,
      etaMs: p.etaMs,
    });
    progressEta.textContent =
      note === null
        ? ''
        : note.ms === undefined
          ? t(note.key)
          : running
            ? t(note.key, { eta: formatDuration(note.ms / 1000, 0) })
            : t(note.key, { elapsed: formatDuration(note.ms / 1000) });
  }

  /**
   * Whether focus is still where the run put it (or nowhere), so moving it is expected. A run the
   * tour starts, or a user who tabbed elsewhere meanwhile, keeps focus where it is.
   */
  function focusFollowsRun(): boolean {
    const a = document.activeElement;
    return (
      a === null || a === document.body || a === runBtn || a === cancelBtn || a === progressTrack
    );
  }

  /** Move focus to the results heading and bring it into view (smoothly unless reduced motion). */
  function focusResults(): void {
    resultsTitle.focus({ preventScroll: true });
    const r = resultsTitle.getBoundingClientRect();
    const single = matchMedia('(max-width: 999px)').matches;
    if (!single && r.top >= 0 && r.bottom <= innerHeight) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsPanel.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  /** Resolves true when the run finished and its results are rendered. */
  async function run(): Promise<boolean> {
    // Same validation the workers apply (incl. the work budget), so the pool's run indices
    // and the main-thread design match what the workers simulate.
    const cfg = sanitizeConfig(structuredClone(config));
    if (cfg.runs !== config.runs) {
      config = structuredClone(cfg);
      form.setConfig(cfg);
      writeUrl();
    }
    const moveFocus = focusFollowsRun();
    void ensureReplay().catch(() => undefined);
    running = true;
    lastCancelled = false;
    lastElapsedMs = null;
    progress.hidden = false;
    // Focus moves to the progress bar before Run is disabled, so it never drops to <body>.
    if (moveFocus) progressTrack.focus();
    runBtn.disabled = true;
    cancelBtn.disabled = false;
    lastSrDecile = -1;
    onProgress({ done: 0, total: cfg.runs, elapsedMs: 0, etaMs: null });
    setStatus({ key: 'progress.workers', vars: { n: pool.size } });
    if (!result) {
      // First run: show the results skeleton now, within the click's input window.
      placeholder = 'pending';
      renderResults();
    }
    const t0 = performance.now();
    let ok = false;
    try {
      const summaries = await pool.run(cfg, onProgress);
      setStatus({ key: 'run.aggregating' });
      // In a worker: Spearman sensitivities over 20,000 runs would block the page for 100s of ms.
      const agg = await pool.aggregate(cfg, summaries);
      result = { config: cfg, agg, summaries, elapsedMs: performance.now() - t0 };
      lastElapsedMs = result.elapsedMs;
      placeholder = null;
      setStatus(null);
      renderResults();
      repro.afterRun(cfg, agg);
      void loadReplay(agg.representativeRun, 'representative');
      ok = true;
      return true;
    } catch (err) {
      lastCancelled = err instanceof CancelledError;
      if (err instanceof CancelledError) setStatus({ key: 'run.cancelled' });
      else {
        setStatus({
          key: 'run.error',
          vars: { msg: err instanceof Error ? err.message : String(err) },
          error: true,
        });
      }
      if (!result) {
        placeholder = err instanceof CancelledError ? 'cancelled' : 'failed';
        renderResults();
      }
      return false;
    } finally {
      running = false;
      const follow = focusFollowsRun();
      runBtn.disabled = false;
      cancelBtn.disabled = true;
      if (follow) {
        if (ok) focusResults();
        else runBtn.focus();
      } else if (ok && matchMedia('(max-width: 999px)').matches) {
        // Single-column layout: bring the freshly computed results into view.
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        resultsPanel.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      }
      renderProgress();
      renderCostNote();
      // An open tour leaves its results preview once results exist (also for runs it did not start).
      tours.classic?.refresh();
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => pool.cancel());

  async function loadReplay(run: number, kind: ReplayState['kind']): Promise<void> {
    if (!result) return;
    const token = ++replayToken;
    replayState = { kind, run, loading: true };
    renderReplayInfo();
    try {
      const [trace, replay] = await Promise.all([pool.replay(result.config, run), ensureReplay()]);
      if (token !== replayToken) return;
      replayState = { kind, run, loading: false };
      renderReplayInfo();
      const heavy = HEAVY_SPECIES[result.config.heavySpecies];
      replayView?.load(trace, true, {
        heavyLengthM: replay.heavyLengthForRadius(heavy.ranges.bodyRadius.mode),
      });
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
    const s = result.summaries.find((x) => x.run === st.run);
    const note = t(st.kind === 'representative' ? 'replay.repNote' : 'replay.randomNote');
    const info = s
      ? t('replay.runInfo', {
          run: st.run + 1,
          outcome: t(outcomeKey(s.outcome)),
          duration: formatDuration(s.duration),
        })
      : '';
    replayInfo.textContent = `${info} — ${note}`;
  }

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

  const OUTCOME_CARD: Readonly<Record<OutcomeKind, { label: MsgKey; marker: string }>> = {
    heavy: { label: 'outcome.heavy', marker: 'mk-heavy' },
    pack: { label: 'outcome.pack', marker: 'mk-pack' },
    draw: { label: 'outcome.draw', marker: 'mk-draw' },
  };

  /** The eight summary cards; values are placeholders until `agg` exists. */
  function renderCards(agg: AggregateResult | null, cfg: ScenarioConfig): void {
    const blank = '…';
    const none = '\u00a0';
    const of = (n: number, species: SpeciesId): string =>
      t('stat.ofN', { n: formatInt(n), counter: speciesCounter(species) });
    // Skeleton sub-lines carry text as long as the final ones, hidden (.is-pending .stat-sub),
    // so the cards keep their final height.
    const runs = formatInt(cfg.runs);
    const shareSkeleton = t('stat.share', { k: runs, n: runs, lo: '00%', hi: '00%' });
    const shares = agg
      ? outcomes(agg).map((o) =>
          card(
            t(OUTCOME_CARD[o.kind].label),
            formatShare(o.k, o.n),
            t('stat.share', { k: formatInt(o.k), n: formatInt(o.n), ...intervalVars(o) }),
            OUTCOME_CARD[o.kind].marker,
          ),
        )
      : (['heavy', 'pack', 'draw'] as const).map((k) =>
          card(t(OUTCOME_CARD[k].label), blank, shareSkeleton, OUTCOME_CARD[k].marker),
        );
    let exchange: [string, string] = [blank, none];
    if (agg) {
      const ex = exchangeCard(agg.exchangeRatio);
      exchange = [ex.value === null ? '—' : formatNum(ex.value, 1), t(ex.sub)];
    }
    cardsEl.replaceChildren(
      ...shares,
      card(
        t('stat.duration'),
        agg ? formatDuration(agg.duration.p50) : blank,
        agg
          ? t('stat.durationSub', {
              p5: formatDuration(agg.duration.p5, 0),
              p95: formatDuration(agg.duration.p95, 0),
            })
          : t('stat.durationSub', { p5: formatDuration(10, 0), p95: formatDuration(10, 0) }),
      ),
      card(
        t('stat.survivors'),
        agg ? formatNum(agg.heavySurvivors.mean, 2) : blank,
        of(cfg.heavyCount, cfg.heavySpecies),
      ),
      card(
        t('stat.killed'),
        agg ? formatNum(agg.packKilled.mean, 1) : blank,
        of(cfg.packCount, cfg.packSpecies),
      ),
      card(
        t('stat.routed'),
        agg ? formatNum(agg.packRouted.mean, 1) : blank,
        of(cfg.packCount, cfg.packSpecies),
      ),
      card(t('stat.exchange'), exchange[0], exchange[1]),
    );
  }

  /** The verdict box: headline, plain-language precision, the toy-model caveat and the basis. */
  function renderVerdict(
    cfg: ScenarioConfig,
    agg: AggregateResult | null,
    elapsedMs: number,
  ): void {
    caveatLink.href = pagePath('model', getLang());
    const note = matchupNote(cfg);
    badgeSlot.replaceChildren(matchupBadge(cfg), ...(note ? [note] : []));
    const basis = (elapsed: string): string =>
      t('verdict.basis', {
        heavyTeam: teamLabel(cfg.heavySpecies, cfg.heavyCount),
        packTeam: teamLabel(cfg.packSpecies, cfg.packCount),
        n: formatInt(agg ? agg.n : cfg.runs),
        seed: String(cfg.seed),
        elapsed,
      });
    if (!agg) {
      verdictEl.textContent = t(`results.${placeholder ?? 'pending'}`);
      // Same text length as the final line, kept invisible: it holds the line's height.
      precisionEl.textContent = t('verdict.precision', { lo: '00%', hi: '00%' });
      basisEl.textContent = basis('…');
      return;
    }
    const lead = leadingOutcome(agg);
    verdictEl.textContent = headline(lead);
    precisionEl.textContent = precisionLine(lead);
    basisEl.textContent = basis(formatDuration(elapsedMs / 1000));
  }

  function renderResults(opts: { deferCharts?: boolean } = {}): void {
    const showBody = result !== null || placeholder !== null;
    emptyEl.hidden = showBody;
    resultsBody.hidden = !showBody;
    resultsBody.classList.toggle('is-pending', result === null);
    updateStale();
    resultShare.update(result);
    if (!showBody) return;
    syncNames();
    // Static bindings (replay legend and controls) name the species of these results.
    applyI18n(resultsBody);
    if (!result) {
      renderVerdict(config, null, 0);
      renderCards(null, config);
      for (const c of [outcomeChart, durationChart, survivorsChart, tornadoChart]) c.reset();
      replayInfo.textContent = '';
      return;
    }
    const { agg, config: cfg } = result;
    const deferPaint = opts.deferCharts === true;
    renderVerdict(cfg, agg, result.elapsedMs);
    renderCards(agg, cfg);

    outcomeChart.set(
      paintOutcome(agg),
      outcomes(agg)
        .map((o) => `${t(OUTCOME_CARD[o.kind].label)} ${formatShare(o.k, o.n)}`)
        .join(', '),
      { table: outcomeTable(agg), deferPaint },
    );
    const durationOpts: HistogramOptions = {
      color: (th) => th.neutral,
      discrete: false,
      axisTitle: t('chart.seconds'),
      tickLabel: (v) => formatNum(v, 0),
      binLabel: (lo, hi) => `${formatNum(lo, 0)}–${formatNum(hi, 0)} ${t('chart.seconds')}`,
    };
    const durHist = durationHistogram(
      result.summaries.map((s) => s.duration),
      cfg.maxTime,
    );
    durationChart.set(
      paintHistogram(durHist, durationOpts),
      `${t('chart.duration')}: ${t('stat.duration')} ${formatDuration(agg.duration.p50)}`,
      { table: histogramTable(durHist, durationOpts.binLabel), deferPaint },
    );
    const survivorOpts: HistogramOptions = {
      color: (th) => th.heavy,
      discrete: true,
      axisTitle: t('chart.heavyAlive'),
      tickLabel: (v) => formatInt(v),
      binLabel: (lo) => `${t('chart.heavyAlive')} ${formatInt(lo + 0.5)}`,
    };
    survivorsChart.set(
      paintHistogram(agg.heavySurvivors.hist, survivorOpts),
      `${t('chart.survivors')}: ${t('stat.survivors')} ${formatNum(agg.heavySurvivors.mean, 2)}`,
      { table: histogramTable(agg.heavySurvivors.hist, survivorOpts.binLabel), deferPaint },
    );
    const top = agg.sensitivity.slice(0, 10);
    const label = (id: ParamId): string => qualifiedParamLabel(id, cfg);
    tornadoChart.set(
      paintTornado(top, label),
      top
        .slice(0, 3)
        .map((s) => `${label(s.id)} ${formatNum(s.rho, 2)}`)
        .join(', '),
      { cssHeight: tornadoHeight(top.length), table: tornadoTable(top, label), deferPaint },
    );
    renderReplayInfo();
  }

  // In-place language switch: results, replay and form state stay; the URL moves to the other
  // language's play page (`/play/` ↔ `/en/play/`) with the query and `#s=` fragment kept.
  onLangChange((lang) => {
    const nextNav = createSiteNav(lang, null);
    siteNav.replaceWith(nextNav);
    siteNav = nextNav;
    document.title = t('play.documentTitle');
    langBtn.lang = otherLang();
    history.replaceState(history.state, '', switchedAppUrl(lang, location.search, location.hash));
    const footerLinks = document.querySelector<HTMLElement>('.site-footer .footer-links');
    if (footerLinks) renderFooterLinks(footerLinks, lang);
    relocalizeLinks(document, lang);
    applyI18n(document.body);
    form.refresh();
    classicSwitchSlot.replaceChildren(modeSwitch());
    free.relocalize();
    renderStatus();
    renderProgress();
    // Charts repaint once, after the new text is on screen (not twice in the same task).
    renderResults({ deferCharts: true });
    replayView?.refresh();
  });

  window.addEventListener('hashchange', () => {
    holdNewerLink(freeHashModelNewer(location.hash));
    if (keepNewerLink) announce(t('free.newerModel'));
    // A link opens as it does on load (routeHashChange): a Simple link in Simple with its seed
    // armed for the next Run (#154), any other free link in the free form, a classic one in classic.
    const next = routeHashChange(location.hash, location.search);
    if (!next) return;
    if (next.mode === 'simple') {
      show('simple', 'free');
      free.setConfig(next.config, { linkSeed: true });
      simpleLinked = true;
      writeUrl();
      return;
    }
    if (next.mode === 'free') {
      free.setConfig(next.config);
      setMode('free');
      return;
    }
    setMode('classic');
    config = next.config;
    form.setConfig(next.config);
    updateStale();
    syncNames();
  });

  // ---------- guided tour ----------
  // The tours load on their first start (#80); the first-visit offer is a small startup module.
  // Simple mode has its own short tour (#158); the classic tour walks Advanced → classic.
  const tours: Partial<Record<TourKind, Tour>> = {};
  const tourModules = new Map<TourKind, Promise<Tour>>();
  let offer: ReturnType<typeof createTourOffer> = null;
  const tourHost = {
    hasResults: () => result !== null,
    isRunning: () => running,
    runDemo: async () => {
      if (running) return false;
      config = { ...config, runs: DEMO_RUNS };
      form.setConfig(config);
      writeUrl();
      updateStale();
      return run();
    },
  };
  // Simple's "run it now" is a normal Simple run (fresh seed, default run count).
  const simpleTourHost = {
    hasResults: () => free.hasResult(),
    isRunning: () => free.isRunning(),
    runDemo: () => free.runNow(),
  };
  const loadTour = (kind: TourKind): Promise<Tour> => {
    let loading = tourModules.get(kind);
    if (!loading) {
      loading = import('./tour').then(
        (m) =>
          (tours[kind] = m.createTour(
            kind === 'simple' ? simpleTourHost : tourHost,
            m.tourSteps(kind),
          )),
        (err: unknown) => {
          tourModules.delete(kind);
          throw err;
        },
      );
      tourModules.set(kind, loading);
    }
    return loading;
  };
  const startTour = (trigger: TourTrigger): void => {
    if (tours.simple?.isOpen() || tours.classic?.isOpen()) return;
    offer?.remove();
    offer = null;
    const { kind, showClassic } = tourFor(view, trigger);
    if (showClassic) show('advanced', 'classic');
    void loadTour(kind).then(
      (t) => t.start(),
      () => undefined,
    );
  };
  tourBtn.addEventListener('click', () => startTour('button'));
  // Warm the tour on intent, so a click opens it without a visible wait.
  tourBtn.addEventListener(
    'pointerenter',
    () => void loadTour(tourFor(view, 'button').kind).catch(() => undefined),
  );

  // Canvas text does not reflow when a web font arrives; redraw once Pretendard is ready.
  void document.fonts?.ready.then(() => {
    replayView?.refresh();
    redrawAllCharts();
  });

  renderResults();
  writeUrl();

  if (tourRequested(location.search)) {
    // Consume the deep link so a reload or a copied link does not restart the tour.
    const url = `${location.pathname}${withoutTourParam(location.search)}${location.hash}`;
    history.replaceState(history.state, '', url);
    startTour('link');
  } else {
    offer = createTourOffer(
      () => startTour('offer'),
      () =>
        document.querySelector<HTMLElement>('[data-tour="tour"]')?.focus({ preventScroll: true }),
    );
    if (offer) header.after(offer.el);
  }
}
