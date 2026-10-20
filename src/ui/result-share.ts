import { sm, type ShareMsgKey } from '../share/messages.ts';
import {
  checkFromHash,
  encodeResult,
  resultPath,
  summarize,
  type AggregateLike,
  type ResultSummary,
} from '../share/result-codec.ts';
import { copyText, flash, shareLink } from '../share/share-ui.ts';
import type { ScenarioConfig } from '../sim/config.ts';
import { getLang, onLangChange } from './i18n.ts';
import { configDiff } from './share.ts';
import './share-panel.css';

/*
 * The simulator's hooks into result sharing (docs/SHARING.md): the "Share result" action shown
 * with finished results, and the reproduction check for "Run it yourself" links
 * (`/#s=…&chk=…`). Both are self-contained; src/ui/app.ts only places them and feeds results.
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

export interface ResultShare {
  el: HTMLElement;
  /** Results changed (null: none shown). */
  update(result: { config: ScenarioConfig; agg: AggregateLike } | null): void;
}

export function createResultShare(): ResultShare {
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
  let current: { config: ScenarioConfig; agg: AggregateLike } | null = null;
  const refresh = (): void => {
    box.hidden = current === null;
    if (!current) return;
    url = resultUrl(location.origin, current.config, current.agg);
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
  if (
    shared.n === agg.n &&
    shared.h === agg.heavyWins &&
    shared.p === agg.packWins &&
    shared.d === agg.draws
  ) {
    return 'same';
  }
  const pairs: [number, { lo: number; hi: number }][] = [
    [shared.h / shared.n, agg.pHeavy],
    [shared.p / shared.n, agg.pPack],
    [shared.d / shared.n, agg.pDraw],
  ];
  const eps = 1e-9;
  return pairs.every(([p, iv]) => p >= iv.lo - eps && p <= iv.hi + eps) ? 'within' : 'outside';
}

export interface ReproduceCheck {
  el: HTMLElement;
  /** A run finished: report against the shared snapshot (once). */
  afterRun(config: ScenarioConfig, agg: AggregateLike): void;
}

/**
 * Reads `chk=` from the starting fragment (before the app rewrites the URL). Without one the
 * element stays hidden and `afterRun` does nothing.
 */
export function createReproduceCheck(hash: string, config: ScenarioConfig): ReproduceCheck {
  const shared = checkFromHash(hash, config);
  const expected = JSON.stringify(configDiff(config));
  const box = el('p', 'repro-check');
  box.setAttribute('role', 'status');
  box.hidden = shared === null;
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
      if (!shared || done) return;
      done = true;
      const outcome = compareRun(shared, agg, JSON.stringify(configDiff(cfg)) === expected);
      key = `repro.${outcome}`;
      box.dataset['outcome'] = outcome;
      relabel();
    },
  };
}
