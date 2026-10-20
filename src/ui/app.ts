import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../sim/config';
import { Outcome, type RunSummary } from '../sim/engine';
import type { AggregateResult } from '../sim/montecarlo';
import type { ParamId } from '../sim/params';
import { HEAVY_SPECIES } from '../sim/species';
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
import { clear, h } from './dom';
import { costSummary, isCostOk } from './cost';
import { createConfigForm, matchupBadge, qualifiedParamLabel } from './form';
import { formatDuration, formatInt, formatNum, formatPct } from './format';
import {
  applyI18n,
  getLang,
  initLang,
  onLangChange,
  setLang,
  setNamePair,
  t,
  teamLabel,
  type Lang,
  type MsgKey,
  type Vars,
} from './i18n';
import { CancelledError, SimPool, type PoolProgress } from './pool';
import { ReplayView } from './replay';
import { heavyLengthForRadius } from './replay/glyphs';
import { configFromHash, hashFromConfig } from './share';
import { pageLang, pagePath, switchedAppUrl } from '../pages/routes';
import { logoAttrs } from '../pages/site-header';
import { createSiteNav, relocalizeLinks, renderFooterLinks } from './site-nav';
import './site-footer.css';
import { createTour } from './tour';
import { DEMO_RUNS, tourRequested, withoutTourParam } from './tour-model';
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

interface Message {
  key: MsgKey;
  vars?: Vars;
  error?: boolean;
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

/** CSS height of the sensitivity chart for `rows` bars (styles.css reserves it for 10). */
function tornadoHeight(rows: number): number {
  return Math.max(120, 24 + rows * 28);
}

function outcomeKey(o: number): MsgKey {
  return o === Outcome.Heavy
    ? 'outcome.heavy'
    : o === Outcome.Pack
      ? 'outcome.pack'
      : 'outcome.draw';
}

export function startApp(root: HTMLElement): void {
  // The language comes from the URL (`/` Korean, `/en/` English) and its static `<html lang>`.
  initLang(pageLang(location.pathname, document.documentElement.lang));
  // Same text as the static <title> of this language's page (tests/pages.test.ts).
  document.title = t('app.documentTitle');
  const pool = new SimPool();
  let config: ScenarioConfig = configFromHash(location.hash) ?? defaultConfig();
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
  const otherLang = (): Lang => (getLang() === 'ko' ? 'en' : 'ko');
  // The button is labelled in the language it switches to.
  langBtn.lang = otherLang();
  langBtn.addEventListener('click', () => setLang(otherLang()));
  const shareBtn = h('button', {
    class: 'btn',
    i18n: 'share.copy',
    i18nTitle: 'share.hint',
    attrs: { type: 'button', 'data-tour': 'share' },
  });
  const toast = h('div', { class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } });
  toast.hidden = true;
  let toastTimer = 0;
  const showToast = (text: string): void => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2500);
  };
  shareBtn.addEventListener('click', () => {
    writeUrl();
    const url = location.href;
    const done = (): void => showToast(t('share.copied'));
    const fail = (): void => showToast(t('share.failed'));
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, fail);
    else fail();
  });

  // index.html and en/index.html ship a static header inside #app with the page's only <h1> and
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
  let siteNav = createSiteNav(getLang());
  header.append(siteNav);

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
    srProgress,
  );
  const configPanel = h(
    'section',
    { class: 'panel config-panel', attrs: { 'aria-labelledby': 'config-title' } },
    h('h2', { id: 'config-title', i18n: 'config.title' }),
    form.el,
    runBar,
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

  const replayView = new ReplayView();
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
      replayView.el,
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
  // The footer is static HTML outside #app (index.html, en/index.html): links, disclaimer and a
  // version slot. The app fills the version and re-localises it when the language changes.
  fillVersionFooter(document);

  clear(root);
  root.append(header, h('main', { class: 'layout', id: 'main' }, configPanel, resultsPanel), toast);
  renderCostNote();

  // ---------- behaviour ----------
  function writeUrl(): void {
    const hash = hashFromConfig(config);
    if (hash === location.hash) return;
    history.replaceState(history.state, '', hash || `${location.pathname}${location.search}`);
  }

  function updateStale(): void {
    staleEl.hidden = !result || JSON.stringify(result.config) === JSON.stringify(config);
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
    if (!running) {
      progressEta.textContent = lastCancelled
        ? t('progress.cancelled')
        : lastElapsedMs === null
          ? ''
          : t('progress.done', { elapsed: formatDuration(lastElapsedMs / 1000) });
    } else {
      progressEta.textContent =
        p.etaMs === null
          ? t('progress.etaPending')
          : t('progress.eta', { eta: formatDuration(p.etaMs / 1000, 0) });
    }
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
      tour.refresh();
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
      const trace = await pool.replay(result.config, run);
      if (token !== replayToken) return;
      replayState = { kind, run, loading: false };
      renderReplayInfo();
      const heavy = HEAVY_SPECIES[result.config.heavySpecies];
      replayView.load(trace, true, {
        heavyLengthM: heavyLengthForRadius(heavy.ranges.bodyRadius.mode),
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
    heavy: { label: 'outcome.heavy', marker: 'mk-trex' },
    pack: { label: 'outcome.pack', marker: 'mk-tiger' },
    draw: { label: 'outcome.draw', marker: 'mk-draw' },
  };

  /** The eight summary cards; values are placeholders until `agg` exists. */
  function renderCards(agg: AggregateResult | null, cfg: ScenarioConfig): void {
    const blank = '…';
    const none = '\u00a0';
    const of = (n: number): string => t('stat.ofN', { n: formatInt(n) });
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
      const r = agg.exchangeRatio;
      exchange = Number.isFinite(r)
        ? [formatNum(r, 1), t('stat.exchangeSub')]
        : Number.isNaN(r)
          ? ['—', t('stat.exchangeNone')]
          : ['—', t('stat.exchangeInf')];
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
        of(cfg.heavyCount),
      ),
      card(t('stat.killed'), agg ? formatNum(agg.packKilled.mean, 1) : blank, of(cfg.packCount)),
      card(t('stat.routed'), agg ? formatNum(agg.packRouted.mean, 1) : blank, of(cfg.packCount)),
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
    badgeSlot.replaceChildren(matchupBadge(cfg));
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
  // language's app path (`/` ↔ `/en/`) with the query and `#s=` fragment kept.
  onLangChange((lang) => {
    const nextNav = createSiteNav(lang);
    siteNav.replaceWith(nextNav);
    siteNav = nextNav;
    document.title = t('app.documentTitle');
    langBtn.lang = otherLang();
    history.replaceState(history.state, '', switchedAppUrl(lang, location.search, location.hash));
    const footerLinks = document.querySelector<HTMLElement>('.site-footer .footer-links');
    if (footerLinks) renderFooterLinks(footerLinks, lang);
    relocalizeLinks(document, lang);
    applyI18n(document.body);
    form.refresh();
    renderStatus();
    renderProgress();
    // Charts repaint once, after the new text is on screen (not twice in the same task).
    renderResults({ deferCharts: true });
    replayView.refresh();
  });

  window.addEventListener('hashchange', () => {
    const c = configFromHash(location.hash);
    if (!c) return;
    config = c;
    form.setConfig(c);
    updateStale();
    syncNames();
  });

  // ---------- guided tour ----------
  const tour = createTour({
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
  });
  tourBtn.addEventListener('click', () => tour.start());
  // Static tour links (`a[data-tour-start]`, e.g. in the intro) start the tour in place instead of
  // reloading the page through `?tour=1`.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[data-tour-start]') : null;
    if (!a || !(e instanceof MouseEvent) || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    tour.start();
  });

  // Canvas text does not reflow when a web font arrives; redraw once Pretendard is ready.
  void document.fonts?.ready.then(() => {
    replayView.refresh();
    redrawAllCharts();
  });

  renderResults();
  writeUrl();

  if (tourRequested(location.search)) {
    // Consume the deep link so a reload or a copied link does not restart the tour.
    const url = `${location.pathname}${withoutTourParam(location.search)}${location.hash}`;
    history.replaceState(history.state, '', url);
    tour.start();
  } else {
    const offer = tour.createOffer();
    if (offer) header.after(offer);
  }
}
