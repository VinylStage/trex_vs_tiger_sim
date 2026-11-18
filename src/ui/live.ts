import { copyText } from '../share/share-ui';
import { DT } from '../sim/engine';
import { aggregateFree } from '../sim/free/aggregate';
import { CARD_IDS, drawCards } from '../sim/free/cards';
import type { FreeConfig } from '../sim/free/config';
import type { FreeRunSummary, FreeTrace } from '../sim/free/engine';
import { spliceForkTrace } from '../sim/free/fork';
import type { Intervention } from '../sim/free/interventions';
import {
  encodeFreeResult,
  summarizeFree,
  type FreeResultSummary,
} from '../share/free-result-codec';
import { resultPath } from '../share/result-codec';
import { cardKeys, createCardOffer, type CardChoice, type CardOffer } from './cards-ui';
import { createChanceBar } from './chance-bar';
import { clear, h, uniqueId } from './dom';
import { formatDuration } from './format';
import type { FreeReplayView } from './free-replay';
import { getLang, t, teamLabel, type MsgKey } from './i18n';
import {
  LIVE_CHANCE_BRANCHES,
  LIVE_CHANCE_CHECKPOINTS,
  checkpointTicks,
  mergeAfterCard,
  runLiveChance,
  strengthTimeline,
  ticksAfterCard,
  type LiveBar,
  type LiveChancePoint,
} from './live-chance';
import { PAUSE_SHARE, gateMessageKey, planLiveCards, resimGate, type LivePlan } from './live-gates';
import {
  BANNER_KEYS,
  autoSpeed,
  banners,
  captionAt,
  captions,
  cardTick,
  pauseTime,
  slowMoments,
  speedAt,
  winnerOf,
  type Caption,
} from './live-model';
import { CancelledError, type SimPool } from './pool';
import { deriveFreeEvents } from './replay/free-events';
import type { FreeLive } from './share-free';
import {
  WHATIF_DESIGN_RUNS,
  submitWhatIf,
  submitWhatIfBaseline,
  whatIfOptions,
  type WhatIfJob,
  type WhatIfShift,
} from './what-if';
import './live.css';

/*
 * Live battle mode (RENEWAL-1.0 §4.3, §4.4, §10.2; #183, with the bar of #222). One battle of the
 * free form's config is simulated up front on the warm live worker, then played back at an auto
 * speed. Where the live win chance is closest to 50 % (25–60 % of the battle) it stops and offers
 * 3 variable cards with their what-if shift (#182); a pick re-simulates the same run with the card
 * and swaps the trace at the playhead (frames before it unchanged). The gates of #181 decide how
 * much the pause computes, or move the cards before the battle, or drop them. At the end come the
 * banners, and a result link that carries the card log (#180). Simple mode never shows this.
 */

/** Length of the card pause the gates budget for (S, §10.2's example). */
export const LIVE_PAUSE_MS = 15_000;
/** Length of the prediction beat (§4.5: 30 s by default). */
export const LIVE_PREDICTION_MS = 30_000;
/** What-if pack per draw (R8): off by default. */
const DEFAULT_WHAT_IF_PACK = false;
/** Render-only glyph scale of the Giant and Pocket cards (Appendix B: radius unchanged). */
const GLYPH_SCALE: Readonly<Record<number, number>> = {
  [CARD_IDS.indexOf('giant')]: 1.3,
  [CARD_IDS.indexOf('pocket')]: 0.8,
};

export interface LiveModeOptions {
  pool: SimPool;
  showToast: (text: string) => void;
  /** Called when the viewer leaves the battle on screen: Close, or a new battle started (#239). */
  onLeave?: () => void;
}

export interface LiveMode {
  readonly el: HTMLElement;
  /** Whether the live section is open. */
  readonly active: boolean;
  /** Open a new live battle of `config` (run `run`, default 0). */
  start(config: FreeConfig, run?: number): void;
  /** Replay a shared live battle (#180) and check it against the shared snapshot. */
  open(config: FreeConfig, live: FreeLive, check: FreeResultSummary | null): void;
  close(): void;
  relocalize(): void;
}

type Phase = 'idle' | 'loading' | 'ready' | 'playing' | 'pause' | 'resim' | 'ended' | 'error';

interface Match {
  config: FreeConfig;
  run: number;
  /** The shared log of a replayed link; null for a match played here. */
  fixed: Intervention[] | null;
  check: FreeResultSummary | null;
  log: Intervention[];
  trace: FreeTrace;
  summary: FreeRunSummary | null;
  liveSimMs: number;
  plan: LivePlan;
  bar: LiveBar | null;
  preMatchA: number | null;
  captions: Caption[];
  moments: number[];
  baseSpeed: number;
  baseline: WhatIfJob<FreeRunSummary[]> | null;
  rerolls: number;
  swing: boolean;
  pauseAt: number | null;
}

const sameSummary = (a: FreeResultSummary, b: FreeResultSummary): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The one-run snapshot of a live battle, as its result link carries it (#180). */
export function liveSnapshot(config: FreeConfig, summary: FreeRunSummary): FreeResultSummary {
  return summarizeFree(config, aggregateFree(config, [summary]));
}

const duration = (trace: FreeTrace): number => trace.frames.at(-1)?.t ?? 0;
const endTick = (trace: FreeTrace): number => Math.max(1, Math.round(duration(trace) / DT));

export function createLiveMode(opts: LiveModeOptions): LiveMode {
  const { pool } = opts;
  let phase: Phase = 'idle';
  let match: Match | null = null;
  let token = 0;
  let view: FreeReplayView | null = null;
  let offer: CardOffer | null = null;
  let whatIfJob: WhatIfJob<WhatIfShift[]> | null = null;
  const jobs = new Set<{ cancel: () => void }>();
  let status: { key: MsgKey; vars?: Record<string, string | number> } | null = null;
  let shownCaption: Caption | null = null;
  /** Shifts of the current offer, for the CARD SWING banner of the pick. */
  let lastShifts: WhatIfShift[] = [];
  /** Glyph scale of a pre-battle Giant or Pocket card, applied when the battle starts. */
  const title = h('h3', { id: uniqueId('live-title') });
  const intro = h('p', { class: 'live-intro' });
  const closeBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  const packId = uniqueId('live-what-if-pack');
  const packBox = h('input', { id: packId, attrs: { type: 'checkbox' } });
  packBox.checked = DEFAULT_WHAT_IF_PACK;
  const packLabel = h('label', { class: 'inline-check', attrs: { for: packId } });
  const startBtn = h('button', { class: 'btn btn-primary', attrs: { type: 'button' } });
  const newBtn = h('button', { class: 'btn', attrs: { type: 'button' } });
  const statusEl = h('p', {
    class: 'live-status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const info = h('p', { class: 'live-info' });
  const bar = createChanceBar();
  const captionEl = h('p', { class: 'live-caption', attrs: { 'aria-live': 'polite' } });
  const replaySlot = h('div', { class: 'replay-slot live-replay' });
  const offerSlot = h('div', { class: 'live-offer' });
  const bannerList = h('ul', { class: 'live-banners', attrs: { 'aria-live': 'polite' } });
  const resultEl = h('p', { class: 'live-result' });
  const shareBtn = h('button', { class: 'btn btn-small', attrs: { type: 'button' } });
  shareBtn.hidden = true;
  const el = h(
    'section',
    { class: 'live-section', attrs: { 'aria-labelledby': title.id } },
    h('div', { class: 'live-head' }, title, closeBtn),
    intro,
    h('div', { class: 'live-controls' }, startBtn, newBtn, h('span', {}, packBox, packLabel)),
    statusEl,
    info,
    bar.el,
    captionEl,
    replaySlot,
    offerSlot,
    bannerList,
    h('div', { class: 'live-end' }, resultEl, shareBtn),
  );
  el.hidden = true;

  const names = (c: FreeConfig): [string, string] => [
    teamLabel(c.sides[0].species, c.sides[0].count),
    teamLabel(c.sides[1].species, c.sides[1].count),
  ];

  function setStatus(key: typeof status): void {
    status = key;
    statusEl.textContent = key ? t(key.key, key.vars) : '';
  }

  function cancelJobs(): void {
    for (const j of jobs) j.cancel();
    jobs.clear();
    whatIfJob?.cancel();
    whatIfJob = null;
  }

  function track<T extends { cancel: () => void; promise: Promise<unknown> }>(job: T): T {
    jobs.add(job);
    void job.promise.then(
      () => jobs.delete(job),
      () => jobs.delete(job),
    );
    return job;
  }

  async function ensureView(): Promise<FreeReplayView> {
    if (view) return view;
    const { FreeReplayView } = await import('./free-replay');
    if (!view) {
      view = new FreeReplayView();
      view.onTime = onTime;
      replaySlot.replaceChildren(view.el);
    }
    return view;
  }

  function reset(): void {
    token++;
    cancelJobs();
    match = null;
    offer = null;
    shownCaption = null;
    clear(offerSlot);
    clear(bannerList);
    resultEl.textContent = '';
    captionEl.textContent = '';
    info.textContent = '';
    shareBtn.hidden = true;
    bar.set(null, ['', '']);
    view?.stopAt(null);
    view?.clear();
  }

  function render(): void {
    startBtn.disabled = phase !== 'ready';
    newBtn.disabled =
      phase === 'loading' || phase === 'resim' || (match !== null && match.fixed !== null);
    packBox.disabled = phase !== 'ready' && phase !== 'ended' && phase !== 'idle';
    if (match) {
      info.textContent = t('live.runInfo', { n: match.run + 1, seed: match.config.seed });
    }
  }

  /** The live bar over `trace` for `ticks`, within `budgetMs`; strength when the plan says so. */
  function computeBar(
    m: Match,
    ticks: number[],
    budgetMs: number,
    strength: boolean,
  ): Promise<LiveBar> {
    if (strength || ticks.length === 0) {
      return Promise.resolve({ kind: 'strength', points: strengthTimeline(m.trace, ticks) });
    }
    const job = track(
      runLiveChance(
        pool.scheduler,
        {
          config: m.config,
          run: m.run,
          interventions: m.log,
          ticks,
          branches: LIVE_CHANCE_BRANCHES,
        },
        m.trace,
        budgetMs,
      ),
    );
    return job.promise;
  }

  /** Simulate (and once more when cold) and plan the match. */
  async function prepare(
    config: FreeConfig,
    run: number,
    fixed: Intervention[] | null,
    check: FreeResultSummary | null,
  ): Promise<void> {
    reset();
    const my = token;
    phase = 'loading';
    el.hidden = false;
    setStatus({ key: 'live.loading' });
    render();
    try {
      const v = ensureView();
      const log = fixed ?? [];
      let rep = await pool.replayLive(config, run, log);
      // The first run on a cold worker can be several times slower (§10.2 point 6); measure gate
      // (a) again on the warm worker before moving the cards out of the battle.
      if (!resimGate(rep.liveSimMs)) {
        const again = await pool.replayLive(config, run, log);
        if (again.liveSimMs < rep.liveSimMs) rep = again;
      }
      await v;
      if (my !== token) return;
      const end = endTick(rep.trace);
      const plan = fixed
        ? ({ mode: 'none', whatIfRuns: null, chance: 'strength', note: 'noCards' } as const)
        : planLiveCards({
            liveSimMs: rep.liveSimMs,
            msPerRun: rep.liveSimMs,
            batchWorkers: pool.size,
            pauseMs: LIVE_PAUSE_MS,
            predictionMs: LIVE_PREDICTION_MS,
            // Checkpoints after a pause in the window (25–60 %), at the latest.
            checkpointsAfter: Math.ceil(LIVE_CHANCE_CHECKPOINTS * 0.75),
            branches: LIVE_CHANCE_BRANCHES,
          });
      const m: Match = {
        config,
        run,
        fixed,
        check,
        log: [...log],
        trace: rep.trace,
        summary: rep.summary ?? null,
        liveSimMs: rep.liveSimMs,
        plan,
        bar: null,
        preMatchA: null,
        captions: [],
        moments: [],
        baseSpeed: 1,
        baseline: null,
        rerolls: 0,
        swing: false,
        pauseAt: null,
      };
      match = m;
      // The bar is computed in the prediction beat; in a fixed replay too (it reads no cards).
      const ticks = checkpointTicks(0, end, LIVE_CHANCE_CHECKPOINTS);
      if (plan.mode === 'live' && plan.whatIfRuns !== null) {
        m.baseline = track(submitWhatIfBaseline(pool.scheduler, config, WHATIF_DESIGN_RUNS));
      }
      m.bar = await computeBar(m, ticks, LIVE_PREDICTION_MS, false);
      if (my !== token) return;
      m.preMatchA = m.bar.kind === 'chance' ? (m.bar.points[0]?.chance ?? null) : null;
      afterTrace(m);
      phase = 'ready';
      if (fixed) {
        setStatus({ key: 'live.replayNote' });
        const e = fixed.find((x) => GLYPH_SCALE[x.card] !== undefined && x.side !== 2);
        if (e) pendingScale = { side: e.side as 0 | 1, scale: GLYPH_SCALE[e.card] as number };
      } else {
        const gate = gateMessageKey(plan.note);
        setStatus(gate ? { key: gate } : { key: 'live.ready' });
        if (plan.mode === 'preBattle') showOffer(m, 0);
      }
      render();
    } catch (err) {
      if (my !== token || err instanceof CancelledError) return;
      phase = 'error';
      setStatus({
        key: 'live.failed',
        vars: { msg: err instanceof Error ? err.message : String(err) },
      });
      render();
    }
  }

  /** Derived events, captions, slow moments and the pause point of the current trace. */
  function afterTrace(m: Match): void {
    const events = deriveFreeEvents(m.trace);
    m.captions = captions(events, m.bar);
    m.moments = slowMoments(events, m.bar);
    bar.set(m.bar, names(m.config));
    m.pauseAt =
      m.plan.mode === 'live' && m.log.length === 0 && !m.fixed
        ? pauseTime(m.bar, duration(m.trace))
        : null;
  }

  function play(): void {
    const m = match;
    if (!m || !view || phase !== 'ready') return;
    phase = 'playing';
    clear(offerSlot);
    offer = null;
    m.baseSpeed = autoSpeed(duration(m.trace));
    view.load(m.trace, names(m.config));
    view.setSpeed(m.baseSpeed);
    armPause(m);
    setStatus(null);
    render();
  }

  function armPause(m: Match): void {
    if (!view) return;
    if (m.pauseAt !== null) view.stopAt(m.pauseAt, () => onPause(m));
    else view.stopAt(null);
  }

  function onTime(time: number): void {
    const m = match;
    if (!m || !view) return;
    bar.update(time);
    const c = captionAt(m.captions, time);
    if (c !== shownCaption) {
      shownCaption = c;
      captionEl.textContent = c ? t(c.key) : '';
    }
    if (phase === 'playing') {
      view.setSpeed(speedAt(time, m.baseSpeed, m.moments));
      if (time >= duration(m.trace)) finish(m);
    }
  }

  /** The card pause: draw, plan the pause work, offer. */
  function onPause(m: Match): void {
    if (m !== match || phase !== 'playing') return;
    phase = 'pause';
    showOffer(m, 0);
    render();
  }

  function showOffer(m: Match, pauseIndex: number): void {
    const v = view;
    if (!v) return;
    const pre = m.plan.mode === 'preBattle';
    lastShifts = [];
    const time = pre ? 0 : v.currentTime;
    const tick = pre ? 0 : cardTick(time);
    const cards = drawCards(
      m.config.mv,
      { morale: m.config.morale, whatIf: packBox.checked },
      { seed: m.config.seed, matchIndex: m.run, pauseIndex, rerollCount: m.rerolls },
    );
    // Gate (b) with the checkpoints actually left after the card.
    const pointsAfter =
      m.bar?.kind === 'chance' ? m.bar.points.filter((p) => p.tick >= tick).length : 0;
    const plan = pre
      ? m.plan
      : planLiveCards({
          liveSimMs: m.liveSimMs,
          msPerRun: m.liveSimMs,
          batchWorkers: pool.size,
          pauseMs: LIVE_PAUSE_MS,
          predictionMs: LIVE_PREDICTION_MS,
          checkpointsAfter: pointsAfter,
          branches: LIVE_CHANCE_BRANCHES,
        });
    if (plan.mode === 'live') m.plan = plan;
    const gate = gateMessageKey(plan.note);
    const sideNames = names(m.config);
    offer = createCardOffer({
      mv: m.config.mv,
      cards,
      sideNames,
      lead: t(pre ? 'live.preBattle' : 'live.pause'),
      note: gate ? t(gate) : null,
      canReroll: m.rerolls === 0,
      onPick: (c) => void pick(m, c, time, tick),
      onReroll: () => {
        if (m.rerolls > 0) return;
        m.rerolls++;
        whatIfJob?.cancel();
        showOffer(m, pauseIndex);
      },
      onSkip: () => skip(m),
    });
    offerSlot.replaceChildren(offer.el);
    const n = plan.whatIfRuns;
    const baseline = m.baseline;
    if (!pre && n !== null && baseline) {
      const current = offer;
      current.setShifts(null, true);
      const options = whatIfOptions(m.config.mv, cards, n);
      const my = token;
      void baseline.promise
        .then((base) => {
          if (my !== token || offer !== current) return null;
          whatIfJob = submitWhatIf(pool.scheduler, { config: m.config, tick, options }, base);
          return whatIfJob.promise;
        })
        .then((shifts) => {
          if (!shifts || offer !== current) return;
          current.setShifts(shifts, false);
          lastShifts = shifts;
        })
        .catch(() => {
          if (offer === current) current.setShifts(null, false);
        });
    }
    // The first card button takes focus, so the offer is reachable at once by keyboard.
    offer.el.querySelector<HTMLButtonElement>('.live-card-pick')?.focus({ preventScroll: true });
  }

  function skip(m: Match): void {
    if (m !== match) return;
    whatIfJob?.cancel();
    offer?.lock();
    clear(offerSlot);
    offer = null;
    setStatus({ key: 'live.noCard' });
    m.pauseAt = null;
    if (phase === 'pause') {
      phase = 'playing';
      view?.stopAt(null);
      view?.setPlayback(true);
    } else if (phase === 'ready') {
      // Pre-battle: nothing to apply.
      m.plan = { mode: 'none', whatIfRuns: null, chance: 'strength', note: 'noCards' };
    }
    render();
  }

  async function pick(m: Match, c: CardChoice, time: number, tick: number): Promise<void> {
    if (m !== match || !view) return;
    const pre = phase === 'ready';
    const my = token;
    whatIfJob?.cancel();
    offer?.lock();
    m.swing = lastShifts.some((s) => s.card === c.card && s.side === c.side && s.swing);
    phase = 'resim';
    setStatus({ key: 'live.resim' });
    render();
    try {
      m.log = [{ tick, card: c.card, side: c.side }];
      const rep = await pool.replayLive(m.config, m.run, m.log);
      if (my !== token) return;
      const prevTrace = m.trace;
      m.trace = pre ? rep.trace : spliceForkTrace(prevTrace, rep.trace, tick);
      m.summary = rep.summary ?? null;
      const end = endTick(m.trace);
      if (pre) {
        // Pre-battle: the bar of the battle with the card, as in the prediction beat.
        m.bar = await computeBar(
          m,
          checkpointTicks(0, end, LIVE_CHANCE_CHECKPOINTS),
          LIVE_PREDICTION_MS,
          false,
        );
        m.preMatchA = m.bar.kind === 'chance' ? (m.bar.points[0]?.chance ?? null) : m.preMatchA;
      } else {
        m.bar = await recomputeBar(m, tick, end);
      }
      if (my !== token) return;
      afterTrace(m);
      clear(offerSlot);
      offer = null;
      const sideNames = names(m.config);
      const keys = cardKeys(c.card);
      const cardName = keys ? t(keys.name) : '';
      setStatus(
        c.side === 2
          ? { key: 'live.pickedBoth', vars: { card: cardName } }
          : { key: 'live.picked', vars: { card: cardName, side: sideNames[c.side] } },
      );
      const scale = GLYPH_SCALE[c.card];
      if (pre) {
        phase = 'ready';
        render();
        if (scale !== undefined && c.side !== 2) pendingScale = { side: c.side, scale };
        return;
      }
      phase = 'playing';
      view.load(m.trace, sideNames, { startAt: time });
      if (scale !== undefined && c.side !== 2) view.setGlyphScale(c.side, scale);
      m.baseSpeed = autoSpeed(duration(m.trace) - time);
      view.stopAt(null);
      view.setPlayback(true);
      render();
    } catch (err) {
      if (my !== token || err instanceof CancelledError) return;
      phase = 'error';
      setStatus({
        key: 'live.failed',
        vars: { msg: err instanceof Error ? err.message : String(err) },
      });
      render();
    }
  }

  let pendingScale: { side: 0 | 1; scale: number } | null = null;

  /** The bar after a card at `tick` (§10.2 point 4, #181's plan): all, next 2, or strength. */
  async function recomputeBar(m: Match, tick: number, end: number): Promise<LiveBar> {
    const old = m.bar;
    if (old?.kind !== 'chance' || m.plan.mode !== 'live' || m.plan.chance === 'strength') {
      const ticks = old ? old.points.map((p) => Math.round(p.t / DT)) : [];
      return { kind: 'strength', points: strengthTimeline(m.trace, ticks) };
    }
    const ticks = ticksAfterCard(old.points, tick, end);
    const first = m.plan.chance === 'near' ? ticks.slice(0, 2) : ticks;
    const fresh = await computeBar(m, first, PAUSE_SHARE * LIVE_PAUSE_MS, false);
    if (fresh.kind !== 'chance') {
      return {
        kind: 'strength',
        points: strengthTimeline(
          m.trace,
          old.points.map((p) => p.tick),
        ),
      };
    }
    let points: LiveChancePoint[] = mergeAfterCard(old.points, fresh.points, tick);
    const rest = ticks.slice(first.length);
    if (rest.length > 0) {
      // The rest of the checkpoints during playback (degradation step 2); held until they land.
      const my = token;
      void computeBar(m, rest, LIVE_PREDICTION_MS, false).then(
        (more) => {
          if (my !== token || more.kind !== 'chance' || m !== match) return;
          points = [...points, ...more.points].sort((x, y) => x.tick - y.tick);
          m.bar = { kind: 'chance', points };
          bar.set(m.bar, names(m.config));
        },
        () => undefined,
      );
    }
    return { kind: 'chance', points };
  }

  function finish(m: Match): void {
    if (phase === 'ended') return;
    phase = 'ended';
    view?.stopAt(null);
    const s = m.summary;
    const sideNames = names(m.config);
    clear(bannerList);
    if (s) {
      for (const b of banners(s, m.bar, m.preMatchA, m.swing)) {
        bannerList.append(
          h('li', { class: `live-banner live-banner-${b}`, text: t(BANNER_KEYS[b]) }),
        );
      }
      const w = winnerOf(s);
      const time = formatDuration(s.duration);
      resultEl.textContent =
        w === null
          ? t('live.resultDraw', { time })
          : t('live.result', { winner: sideNames[w], time });
      const snap = liveSnapshot(m.config, s);
      if (m.check) {
        setStatus({ key: sameSummary(snap, m.check) ? 'live.check.same' : 'live.check.differs' });
      }
      shareBtn.hidden = false;
    }
    render();
  }

  function shareUrl(m: Match): string | null {
    if (!m.summary) return null;
    const r = encodeFreeResult(m.config, liveSnapshot(m.config, m.summary), {
      live: { run: m.run, iv: m.log },
    });
    return `${location.origin}${resultPath(getLang(), r)}`;
  }

  startBtn.addEventListener('click', () => {
    const m = match;
    play();
    if (m && pendingScale && view) {
      view.setGlyphScale(pendingScale.side, pendingScale.scale);
      pendingScale = null;
    }
  });
  newBtn.addEventListener('click', () => {
    const m = match;
    if (!m) return;
    void prepare(m.config, (m.run + 1) % Math.max(1, m.config.runs), null, null);
  });
  closeBtn.addEventListener('click', () => api.close());
  shareBtn.addEventListener('click', () => {
    const m = match;
    const url = m ? shareUrl(m) : null;
    if (!url) return;
    void copyText(url, getLang()).then((ok) => ok && opts.showToast(t('live.copied')));
  });
  packBox.addEventListener('change', () => {
    // The pack applies from the next draw; a ready pre-battle offer is drawn again.
    const m = match;
    if (m && phase === 'ready' && m.plan.mode === 'preBattle' && m.log.length === 0)
      showOffer(m, 0);
  });

  function relocalize(): void {
    title.textContent = t('live.title');
    intro.textContent = t('live.intro');
    closeBtn.textContent = t('live.close');
    packLabel.textContent = t('live.whatIfPack');
    startBtn.textContent = t('live.start');
    newBtn.textContent = t('live.newRun');
    shareBtn.textContent = t('live.share');
    statusEl.textContent = status ? t(status.key, status.vars) : '';
    captionEl.textContent = shownCaption ? t(shownCaption.key) : '';
    bar.relocalize();
    view?.relocalize();
    render();
  }

  const api: LiveMode = {
    el,
    get active() {
      return !el.hidden;
    },
    start(config, run = 0) {
      void prepare(config, run, null, null);
      opts.onLeave?.();
    },
    open(config, live, check) {
      void prepare(config, live.run, live.iv, check);
    },
    close() {
      reset();
      phase = 'idle';
      pendingScale = null;
      setStatus(null);
      el.hidden = true;
      render();
      opts.onLeave?.();
    },
    relocalize,
  };
  relocalize();
  return api;
}
