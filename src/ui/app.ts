import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../sim/config';
import { Outcome, type RunSummary } from '../sim/engine';
import { aggregate, type AggregateResult } from '../sim/montecarlo';
import { buildDesign } from '../sim/sampling';
import {
  CanvasChart,
  durationHistogram,
  paintHistogram,
  paintOutcome,
  paintTornado,
  redrawAllCharts,
} from './charts';
import { clear, h } from './dom';
import { createConfigForm, qualifiedParamLabel } from './form';
import { formatDuration, formatInt, formatNum, formatPct } from './format';
import {
  applyI18n,
  getLang,
  initLang,
  onLangChange,
  setLang,
  t,
  type Lang,
  type MsgKey,
  type Vars,
} from './i18n';
import { CancelledError, SimPool, type PoolProgress } from './pool';
import { ReplayView } from './replay';
import { configFromHash, hashFromConfig } from './share';
import { createSiteNav } from './site-nav';
import { createTour } from './tour';
import { DEMO_RUNS, tourRequested, withoutTourParam } from './tour-model';
import { createVersionBadge, createVersionFooter } from './version';

export const REPO_URL = 'https://github.com/VinylStage/trex_vs_tiger_sim';
export const MODEL_DOC_URL = `${REPO_URL}/blob/main/docs/MODEL.md`;

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

interface ReplayState {
  kind: 'representative' | 'random';
  run: number;
  loading: boolean;
  error?: string;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

function outcomeKey(o: number): MsgKey {
  return o === Outcome.Trex
    ? 'outcome.trex'
    : o === Outcome.Tigers
      ? 'outcome.tigers'
      : 'outcome.draw';
}

export function startApp(root: HTMLElement): void {
  initLang();
  document.title = t('app.title');
  const pool = new SimPool();
  let config: ScenarioConfig = configFromHash(location.hash) ?? defaultConfig();
  let result: RunResult | null = null;
  let status: Message | null = null;
  let replayState: ReplayState | null = null;
  let replayToken = 0;
  let lastSrDecile = -1;
  let running = false;

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
  const showToast = (key: MsgKey): void => {
    toast.textContent = t(key);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2500);
  };
  shareBtn.addEventListener('click', () => {
    writeUrl();
    const url = location.href;
    const done = (): void => showToast('share.copied');
    const fail = (): void => showToast('share.failed');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, fail);
    else fail();
  });

  const header = h(
    'header',
    { class: 'app-header' },
    h(
      'div',
      { class: 'brand' },
      h('img', {
        class: 'logo',
        attrs: { src: 'favicon.svg', alt: '', width: '40', height: '40' },
      }),
      h(
        'div',
        {},
        h('div', { class: 'brand-title' }, h('h1', { i18n: 'app.title' }), createVersionBadge()),
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
  });

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

  const configPanel = h(
    'section',
    { class: 'panel config-panel', attrs: { 'aria-labelledby': 'config-title' } },
    h('h2', { id: 'config-title', i18n: 'config.title' }),
    form.el,
    h(
      'div',
      { class: 'run-bar', attrs: { 'data-tour': 'run' } },
      h('div', { class: 'run-buttons' }, runBtn, cancelBtn),
      progress,
      statusEl,
      srProgress,
    ),
  );

  // ---------- results panel ----------
  const emptyEl = h('p', {
    class: 'results-empty',
    i18n: 'results.empty',
    attrs: { 'data-tour': 'results-empty' },
  });
  const staleEl = h('p', { class: 'stale-banner', i18n: 'results.stale' });
  staleEl.hidden = true;
  const verdictEl = h('p', { class: 'verdict' });
  const basisEl = h('p', { class: 'verdict-basis' });
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
      basisEl,
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
    h('h2', { id: 'results-title', i18n: 'results.title' }),
    emptyEl,
    resultsBody,
  );

  // ---------- footer ----------
  const footer = h(
    'footer',
    { class: 'app-footer' },
    h('p', { class: 'disclaimer', i18n: 'footer.disclaimer' }),
    h(
      'p',
      { class: 'footer-links' },
      h('a', {
        attrs: { href: MODEL_DOC_URL, rel: 'noopener', target: '_blank' },
        i18n: 'footer.model',
      }),
      h('span', { attrs: { 'aria-hidden': 'true' }, text: ' · ' }),
      h('a', {
        attrs: { href: REPO_URL, rel: 'noopener', target: '_blank' },
        i18n: 'footer.source',
      }),
      h('span', { attrs: { 'aria-hidden': 'true' }, text: ' · ' }),
      h('span', { i18n: 'footer.privacy' }),
      h('span', { attrs: { 'aria-hidden': 'true' }, text: ' · ' }),
      createVersionFooter(),
    ),
  );

  clear(root);
  root.append(
    header,
    h('main', { class: 'layout', id: 'main' }, configPanel, resultsPanel),
    footer,
    toast,
  );

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
  }

  function onProgress(p: PoolProgress): void {
    const frac = p.total > 0 ? p.done / p.total : 0;
    progressFill.style.transform = `scaleX(${frac})`;
    progressTrack.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    progressText.textContent = t('progress.text', {
      done: formatInt(p.done),
      total: formatInt(p.total),
      pct: formatPct(frac, 0),
    });
    progressEta.textContent =
      p.etaMs === null
        ? t('progress.etaPending')
        : t('progress.eta', { eta: formatDuration(p.etaMs / 1000, 0) });
    const decile = Math.floor(frac * 10);
    if (decile !== lastSrDecile) {
      lastSrDecile = decile;
      srProgress.textContent = `${t('progress.label')} ${formatPct(frac, 0)}`;
    }
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
    running = true;
    runBtn.disabled = true;
    cancelBtn.disabled = false;
    progress.hidden = false;
    lastSrDecile = -1;
    onProgress({ done: 0, total: cfg.runs, elapsedMs: 0, etaMs: null });
    setStatus({ key: 'progress.workers', vars: { n: pool.size } });
    const t0 = performance.now();
    try {
      const summaries = await pool.run(cfg, onProgress);
      setStatus({ key: 'run.aggregating' });
      await nextFrame();
      const agg = aggregate(cfg, buildDesign(cfg), summaries);
      result = { config: cfg, agg, summaries, elapsedMs: performance.now() - t0 };
      setStatus(null);
      renderResults();
      void loadReplay(agg.representativeRun, 'representative');
      // Single-column layout: bring the freshly computed results into view.
      if (matchMedia('(max-width: 999px)').matches) {
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        resultsPanel.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      }
      return true;
    } catch (err) {
      if (err instanceof CancelledError) setStatus({ key: 'run.cancelled' });
      else {
        setStatus({
          key: 'run.error',
          vars: { msg: err instanceof Error ? err.message : String(err) },
          error: true,
        });
      }
      return false;
    } finally {
      running = false;
      runBtn.disabled = false;
      cancelBtn.disabled = true;
      progress.hidden = true;
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
      replayView.load(trace);
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

  function renderResults(): void {
    emptyEl.hidden = result !== null;
    resultsBody.hidden = result === null;
    updateStale();
    if (!result) return;
    const { agg, config: cfg } = result;
    const ivText = (iv: { lo: number; hi: number }): Vars => ({
      lo: formatPct(iv.lo),
      hi: formatPct(iv.hi),
    });

    const best = [
      { key: 'verdict.trex' as const, iv: agg.pTrex },
      { key: 'verdict.tigers' as const, iv: agg.pTigers },
      { key: 'verdict.draw' as const, iv: agg.pDraw },
    ].reduce((a, b) => (b.iv.p > a.iv.p ? b : a));
    verdictEl.textContent = t(best.key, { p: formatPct(best.iv.p), ...ivText(best.iv) });
    basisEl.textContent = t('verdict.basis', {
      trex: formatInt(cfg.trexCount),
      tigers: formatInt(cfg.tigerCount),
      n: formatInt(agg.n),
      seed: String(cfg.seed),
      elapsed: formatDuration(result.elapsedMs / 1000),
    });

    clear(cardsEl);
    cardsEl.append(
      card(t('outcome.trex'), formatPct(agg.pTrex.p), t('stat.ci', ivText(agg.pTrex)), 'mk-trex'),
      card(
        t('outcome.tigers'),
        formatPct(agg.pTigers.p),
        t('stat.ci', ivText(agg.pTigers)),
        'mk-tiger',
      ),
      card(t('outcome.draw'), formatPct(agg.pDraw.p), t('stat.ci', ivText(agg.pDraw)), 'mk-draw'),
      card(
        t('stat.duration'),
        formatDuration(agg.duration.p50),
        t('stat.durationSub', {
          p5: formatDuration(agg.duration.p5, 0),
          p95: formatDuration(agg.duration.p95, 0),
        }),
      ),
      card(
        t('stat.survivors'),
        formatNum(agg.trexSurvivors.mean, 2),
        t('stat.ofN', { n: formatInt(cfg.trexCount) }),
      ),
      card(
        t('stat.killed'),
        formatNum(agg.tigersKilled.mean, 1),
        t('stat.ofN', { n: formatInt(cfg.tigerCount) }),
      ),
      card(
        t('stat.routed'),
        formatNum(agg.tigersRouted.mean, 1),
        t('stat.ofN', { n: formatInt(cfg.tigerCount) }),
      ),
      card(
        t('stat.exchange'),
        Number.isFinite(agg.exchangeRatio)
          ? formatNum(agg.exchangeRatio, 1)
          : Number.isNaN(agg.exchangeRatio)
            ? '—'
            : '∞',
        Number.isFinite(agg.exchangeRatio)
          ? t('stat.exchangeSub')
          : Number.isNaN(agg.exchangeRatio)
            ? t('stat.exchangeNone')
            : t('stat.exchangeInf'),
      ),
    );

    outcomeChart.set(
      paintOutcome(agg),
      [
        `${t('outcome.trex')} ${formatPct(agg.pTrex.p)}`,
        `${t('outcome.tigers')} ${formatPct(agg.pTigers.p)}`,
        `${t('outcome.draw')} ${formatPct(agg.pDraw.p)}`,
      ].join(', '),
    );
    durationChart.set(
      paintHistogram(
        durationHistogram(
          result.summaries.map((s) => s.duration),
          cfg.maxTime,
        ),
        {
          color: (th) => th.neutral,
          discrete: false,
          axisTitle: t('chart.seconds'),
          tickLabel: (v) => formatNum(v, 0),
          binLabel: (lo, hi) => `${formatNum(lo, 0)}–${formatNum(hi, 0)} ${t('chart.seconds')}`,
        },
      ),
      `${t('chart.duration')}: ${t('stat.duration')} ${formatDuration(agg.duration.p50)}`,
    );
    survivorsChart.set(
      paintHistogram(agg.trexSurvivors.hist, {
        color: (th) => th.trex,
        discrete: true,
        axisTitle: t('chart.trexAlive'),
        tickLabel: (v) => formatInt(v),
        binLabel: (lo) => `${t('chart.trexAlive')} ${formatInt(lo + 0.5)}`,
      }),
      `${t('chart.survivors')}: ${t('stat.survivors')} ${formatNum(agg.trexSurvivors.mean, 2)}`,
    );
    const top = agg.sensitivity.slice(0, 10);
    tornadoChart.set(
      paintTornado(top, qualifiedParamLabel),
      top
        .slice(0, 5)
        .map((s) => `${qualifiedParamLabel(s.id)} ${formatNum(s.rho, 2)}`)
        .join(', '),
      Math.max(120, 24 + top.length * 28),
    );
    renderReplayInfo();
  }

  onLangChange((lang) => {
    const nextNav = createSiteNav(lang);
    siteNav.replaceWith(nextNav);
    siteNav = nextNav;
    document.title = t('app.title');
    langBtn.lang = otherLang();
    applyI18n(document.body);
    form.refresh();
    renderStatus();
    renderResults();
    replayView.refresh();
    redrawAllCharts();
  });

  window.addEventListener('hashchange', () => {
    const c = configFromHash(location.hash);
    if (!c) return;
    config = c;
    form.setConfig(c);
    updateStale();
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
