import { sm, type ShareMsgKey } from '../share/messages.ts';
import {
  checkFromHash,
  encodeResult,
  resultPath,
  summarize,
  type AggregateLike,
  type ResultSummary,
} from '../share/result-codec.ts';
import {
  encodeFreeResult,
  freeCheckFromHash,
  summarizeFree,
  type FreeResultSummary,
} from '../share/free-result-codec.ts';
import { copyText, flash, shareLink } from '../share/share-ui.ts';
import type { ScenarioConfig } from '../sim/config.ts';
import type { FreeAggregate } from '../sim/free/aggregate.ts';
import type { FreeConfig } from '../sim/free/config.ts';
import { getLang, onLangChange } from './i18n.ts';
import { configDiff } from './share.ts';
import { freeConfigDiff } from './share-free.ts';
import './share-panel.css';

/*
 * The simulator's hooks into result sharing (docs/SHARING.md): the "Share result" action shown
 * with finished results, and the reproduction check for "Run it yourself" links
 * (`/#s=…&chk=…`), for classic and free results. Both are self-contained; src/ui/app.ts and
 * src/ui/free-mode.ts only place them and feed results.
 */

const t = (key: ShareMsgKey): string => sm(getLang(), key);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.append(...children);
  return e;
}

/** Absolute URL of the result page for a finished run, on the current origin. */
export function resultUrl(origin: string, config: ScenarioConfig, agg: AggregateLike): string {
  return `${origin}${resultPath(getLang(), encodeResult(config, summarize(agg)))}`;
}

/** Absolute URL of the result page for a finished free run, on the current origin. */
export function freeResultUrl(origin: string, config: FreeConfig, agg: FreeAggregate): string {
  return `${origin}${resultPath(getLang(), encodeFreeResult(config, summarizeFree(config, agg)))}`;
}

export interface ResultShare<C = ScenarioConfig, A = AggregateLike> {
  el: HTMLElement;
  /** Results changed (null: none shown). */
  update(result: { config: C; agg: A } | null): void;
}

export function createResultShare(): ResultShare {
  return createShareBox(resultUrl);
}

export function createFreeResultShare(): ResultShare<FreeConfig, FreeAggregate> {
  return createShareBox(freeResultUrl);
}

function createShareBox<C, A>(
  toUrl: (origin: string, config: C, agg: A) => string,
): ResultShare<C, A> {
  const shareBtn = el('button', 'btn btn-small btn-primary');
  shareBtn.type = 'button';
  const open = el('a', 'result-share-open');
  open.target = '_blank';
  open.rel = 'noopener';
  const status = el('span', 'result-share-status');
  status.setAttribute('role', 'status');
  const box = el('div', 'result-share', shareBtn, open, status);
  box.hidden = true;
  let url = '';

  const relabel = (): void => {
    shareBtn.textContent = t('rs.share');
    shareBtn.title = t('rs.shareHint');
    open.textContent = t('rs.open');
  };
  let current: { config: C; agg: A } | null = null;
  const refresh = (): void => {
    box.hidden = current === null;
    if (!current) return;
    url = toUrl(location.origin, current.config, current.agg);
    open.href = url;
  };

  shareBtn.addEventListener('click', () => {
    if (!url) return;
    void (async () => {
      const o = await shareLink({ title: t('rs.share'), url });
      if (o !== 'unavailable') return;
      if (await copyText(url, getLang())) flash(status, t('rs.copied'));
    })();
  });

  relabel();
  onLangChange(() => {
    relabel();
    refresh();
  });
  return {
    el: box,
    update(result) {
      current = result;
      refresh();
    },
  };
}

export type ReproOutcome = 'same' | 'within' | 'outside' | 'changed';

/**
 * Compare a fresh run with a shared snapshot of the same config: identical counts → `same`;
 * every shared rate inside the run's 95 % Wilson interval → `within`; else `outside`.
 */
export function compareRun(
  shared: ResultSummary,
  agg: AggregateLike,
  sameConfig: boolean,
): ReproOutcome {
  if (!sameConfig) return 'changed';
  return compareCounts(
    shared.n,
    [shared.h, shared.p, shared.d],
    agg.n,
    [agg.heavyWins, agg.packWins, agg.draws],
    [agg.pHeavy, agg.pPack, agg.pDraw],
  );
}

/** `compareRun` for a free snapshot (side A wins, side B wins, draws). */
export function compareFreeRun(
  shared: FreeResultSummary,
  agg: FreeAggregate,
  sameConfig: boolean,
): ReproOutcome {
  if (!sameConfig) return 'changed';
  return compareCounts(
    shared.n,
    [shared.a, shared.b, shared.d],
    agg.n,
    [agg.aWins, agg.bWins, agg.draws],
    [agg.pA, agg.pB, agg.pDraw],
  );
}

function compareCounts(
  sharedN: number,
  shared: readonly [number, number, number],
  n: number,
  counts: readonly [number, number, number],
  intervals: readonly { lo: number; hi: number }[],
): Exclude<ReproOutcome, 'changed'> {
  if (sharedN === n && shared.every((k, i) => k === counts[i])) return 'same';
  const eps = 1e-9;
  return shared.every((k, i) => {
    const iv = intervals[i] as { lo: number; hi: number };
    const p = k / sharedN;
    return p >= iv.lo - eps && p <= iv.hi + eps;
  })
    ? 'within'
    : 'outside';
}

export interface ReproduceCheck<C = ScenarioConfig, A = AggregateLike> {
  el: HTMLElement;
  /** A run finished: report against the shared snapshot (once). */
  afterRun(config: C, agg: A): void;
}

/**
 * Reads `chk=` from the starting fragment (before the app rewrites the URL). Without one the
 * element stays hidden and `afterRun` does nothing.
 */
export function createReproduceCheck(hash: string, config: ScenarioConfig): ReproduceCheck {
  const shared = checkFromHash(hash, config);
  const expected = JSON.stringify(configDiff(config));
  return reproduceBox(shared !== null, (cfg, agg) =>
    shared === null
      ? 'changed'
      : compareRun(shared, agg, JSON.stringify(configDiff(cfg)) === expected),
  );
}

/** The reproduction check of a free "Run it yourself" link (`#s=<v3>&chk=…`). */
export function createFreeReproduceCheck(
  hash: string,
  config: FreeConfig,
): ReproduceCheck<FreeConfig, FreeAggregate> {
  const shared = freeCheckFromHash(hash, config);
  const expected = JSON.stringify(freeConfigDiff(config));
  return reproduceBox(shared !== null, (cfg, agg) =>
    shared === null
      ? 'changed'
      : compareFreeRun(shared, agg, JSON.stringify(freeConfigDiff(cfg)) === expected),
  );
}

function reproduceBox<C, A>(
  active: boolean,
  compare: (config: C, agg: A) => ReproOutcome,
): ReproduceCheck<C, A> {
  const box = el('p', 'repro-check');
  box.setAttribute('role', 'status');
  box.hidden = !active;
  let key: ShareMsgKey = 'repro.pending';
  const relabel = (): void => {
    box.textContent = t(key);
  };
  relabel();
  onLangChange(relabel);
  let done = false;
  return {
    el: box,
    afterRun(cfg, agg) {
      if (!active || done) return;
      done = true;
      const outcome = compare(cfg, agg);
      key = `repro.${outcome}`;
      box.dataset['outcome'] = outcome;
      relabel();
    },
  };
}
