// Fonts, site navigation and the footer version (shared with the content pages).
import '../pages/site.ts';
import { pagePath, resultPageLang, resultPagePath, SITE_ORIGIN } from '../pages/routes.ts';
import type { ScenarioConfig } from '../sim/config.ts';
import type { FreeConfig } from '../sim/free/config.ts';
import type { Lang } from '../ui/i18n.ts';
import {
  renderCard,
  type CardFormat,
  type CardInput,
  type RenderedCard,
} from '../ui/result-card.ts';
import { encodeConfig } from '../ui/share.ts';
import { hashFromFreeConfig } from '../ui/share-free.ts';
import {
  decodeAnyResultQuery,
  reproduceFreeHash,
  type FreeResultSummary,
} from './free-result-codec.ts';
import { sm, type ShareMsgKey } from './messages.ts';
import { reproduceHash, type ResultError, type ResultSummary } from './result-codec.ts';
import {
  formatCount,
  formatSeconds,
  freeResultView,
  pct,
  pct1,
  resultView,
  viewShareText,
  xIntentUrl,
  type ResultView,
  type Side,
} from './result-text.ts';
import { copyText, flash, saveImage, shareLink, tryCopy } from './share-ui.ts';

/*
 * The shared-result page /r/ and /en/r/ (docs/SHARING.md#result-page). It reads `?r=`, validates
 * it with src/share/result-codec.ts and shows the snapshot. It never loads the simulator or its
 * workers: "Run it yourself" opens the simulator with the config and a reproduction check.
 */

const lang: Lang =
  resultPageLang(location.pathname) ??
  (document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'ko');
const other: Lang = lang === 'ko' ? 'en' : 'ko';
const t = (key: ShareMsgKey, vars?: Readonly<Record<string, string | number>>): string =>
  sm(lang, key, vars);

const DOMAIN = new URL(SITE_ORIGIN).host;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) if (c !== null) e.append(c);
  return e;
}

function button(label: string, cls = 'rp-btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  return b;
}

function link(label: string, href: string, cls = 'rp-btn'): HTMLAnchorElement {
  const a = el('a', cls, label);
  a.href = href;
  return a;
}

// Keep the query when switching language.
const langLink = document.querySelector<HTMLAnchorElement>('a[data-lang-switch]');
if (langLink) langLink.href = resultPagePath(other) + location.search;

const root = document.getElementById('result-root');
const title = document.getElementById('result-title');
const status = el('p', 'rp-status');
status.setAttribute('role', 'status');

/** Canonical URL of this result (production origin, no fragment). */
const shareUrl = `${SITE_ORIGIN}${resultPagePath(lang)}${location.search}`;
const simulatorUrl = (hash: string): string => `${pagePath('simulator', lang)}${hash}`;

const ERROR_KEY: Readonly<Record<ResultError, ShareMsgKey>> = {
  missing: 'result.missing',
  length: 'result.invalid',
  alphabet: 'result.invalid',
  json: 'result.invalid',
  shape: 'result.invalid',
  version: 'result.invalid',
  config: 'result.invalid',
  summary: 'result.invalid',
};

const isFree = (c: ScenarioConfig | FreeConfig): c is FreeConfig =>
  (c as Partial<FreeConfig>).mode === 'free';

function renderError(error: ResultError, config: ScenarioConfig | FreeConfig | null): void {
  if (!root) return;
  const actions = el('div', 'rp-actions');
  if (config) {
    const payload = isFree(config) ? null : encodeConfig(config);
    const hash = isFree(config) ? hashFromFreeConfig(config) : payload ? `#s=${payload}` : '';
    actions.append(link(t('result.runIt'), simulatorUrl(hash), 'rp-btn rp-primary'));
  }
  actions.append(link(t('result.tryOwn'), pagePath('simulator', lang)));
  root.replaceChildren(
    el('p', 'rp-error', t(ERROR_KEY[error])),
    ...(config ? [el('p', 'rp-note', t('result.invalidConfig'))] : []),
    actions,
  );
}

const SIDE_CLASS: Readonly<Record<Side, string>> = {
  heavy: 'rp-heavy',
  pack: 'rp-pack',
  draw: 'rp-draw',
};

function winBar(v: ResultView): HTMLElement {
  const bar = el('div', 'rp-bar');
  bar.setAttribute('role', 'img');
  const parts: string[] = [];
  for (const side of ['heavy', 'pack', 'draw'] as const) {
    const seg = el('span', `rp-seg ${SIDE_CLASS[side]}`);
    seg.style.width = `${v.shares[side] * 100}%`;
    bar.append(seg);
    parts.push(`${sideName(v, side)} ${pct1(v.shares[side])}`);
  }
  bar.setAttribute('aria-label', parts.join(', '));
  return bar;
}

function sideName(v: ResultView, side: Side): string {
  return side === 'heavy' ? v.heavyName : side === 'pack' ? v.packName : t('result.draw');
}

function legend(v: ResultView, s: { ci?: readonly number[] }): HTMLElement {
  const list = el('ul', 'rp-legend');
  (['heavy', 'pack', 'draw'] as const).forEach((side, i) => {
    const ci = s.ci;
    const lo = ci?.[i * 2];
    const hi = ci?.[i * 2 + 1];
    const marker = el('span', `rp-marker ${SIDE_CLASS[side]}`);
    marker.setAttribute('aria-hidden', 'true');
    list.append(
      el(
        'li',
        '',
        marker,
        el('span', 'rp-legend-name', sideName(v, side)),
        el('strong', '', pct1(v.shares[side])),
        lo !== undefined && hi !== undefined
          ? el('span', 'rp-legend-ci', t('result.ci', { lo: pct1(lo), hi: pct1(hi) }))
          : null,
      ),
    );
  });
  return list;
}

type StatItem = [string, string];

function classicStats(v: ResultView, s: ResultSummary): StatItem[] {
  const items: StatItem[] = [];
  if (s.t !== undefined) items.push([t('result.duration'), formatSeconds(s.t, lang)]);
  if (s.hs !== undefined) {
    items.push([t('result.survivors', { heavy: v.heavyName }), s.hs.toLocaleString(lang)]);
  }
  if (s.pk !== undefined) {
    items.push([t('result.incapacitated', { pack: v.packName }), s.pk.toLocaleString(lang)]);
  }
  return items;
}

/** Per side: survivors, incapacitated, fled and, where the pack buff applies, its active time. */
function freeStats(v: ResultView, s: FreeResultSummary): StatItem[] {
  const items: StatItem[] = [];
  if (s.t !== undefined) items.push([t('result.duration'), formatSeconds(s.t, lang)]);
  const num = (x: number): string => x.toLocaleString(lang);
  const sides = [
    { name: v.heavyName, sv: s.as, k: s.ak, r: s.ar, b: s.ab, bt: s.at },
    { name: v.packName, sv: s.bs, k: s.bk, r: s.br, b: s.bb, bt: s.bt },
  ];
  for (const x of sides) {
    if (x.sv !== undefined) items.push([t('result.survivors', { heavy: x.name }), num(x.sv)]);
    if (x.k !== undefined) items.push([t('result.incapacitated', { pack: x.name }), num(x.k)]);
    if (x.r !== undefined) items.push([t('free.fled', { side: x.name }), num(x.r)]);
    if (x.b !== undefined) {
      const time = x.bt === undefined ? '' : formatSeconds(x.bt, lang);
      items.push([
        t('free.buff', { side: x.name }),
        t('free.buffValue', { pct: pct(x.b), t: time }),
      ]);
    }
  }
  return items;
}

function stats(items: readonly StatItem[]): HTMLElement | null {
  if (items.length === 0) return null;
  const dl = el('dl', 'rp-stats');
  for (const [k, val] of items) dl.append(el('div', '', el('dt', '', k), el('dd', '', val)));
  return dl;
}

/** What the page shows of one decoded result, classic or free. */
interface Shown {
  view: ResultView;
  summary: { n: number; t?: number; ci?: readonly number[] };
  stats: StatItem[];
  /** Simulator fragment of "Run it yourself" (config and reproduction check). */
  runIt: string;
  seed: number;
}

function renderResult({
  view: v,
  summary: s,
  stats: statItems,
  runIt: runHash,
  seed,
}: Shown): void {
  if (!root) return;
  const winnerPct = pct(v.shares[v.winner]);
  document.title = t('result.documentTitle', { headline: `${v.matchup} — ${v.headline}` });
  if (title) {
    title.textContent = '';
    title.append(
      el('span', 'rp-winlabel', v.winLabel),
      el('span', `rp-pct ${SIDE_CLASS[v.winner]}`, winnerPct),
    );
  }

  const tags = el(
    'p',
    'rp-tags',
    el('span', `rp-tier ${SIDE_CLASS[v.winner]}`, v.tierLabel),
    el('span', 'rp-diff', v.context),
  );
  const matchup = el(
    'p',
    'rp-matchup',
    `${v.heavyEmoji} ${v.heavyName} ${formatCount(v.heavyCount, lang)} vs ${v.packEmoji} ${v.packName} ${formatCount(v.packCount, lang)}`,
  );
  const runs = el(
    'p',
    'rp-runs',
    t('result.runs', { n: formatCount(s.n, lang), seed: String(seed) }),
  );

  // ---- card ----
  const cardInput: CardInput = { view: v, summary: s, domain: DOMAIN };
  let format: CardFormat = 'story';
  let card: RenderedCard | null = null;
  let token = 0;
  const preview = el('img', 'rp-card-preview');
  preview.alt = t('result.previewAlt', { headline: v.headline });
  preview.width = 1080;
  preview.height = 1920;
  const formatGroup = el('div', 'rp-format');
  formatGroup.setAttribute('role', 'radiogroup');
  formatGroup.setAttribute('aria-label', t('result.format'));
  const formatButtons = (['story', 'square'] as const).map((f) => {
    const b = button(t(f === 'story' ? 'result.formatStory' : 'result.formatSquare'), 'rp-chip');
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      format = f;
      void prepare();
    });
    formatGroup.append(b);
    return [f, b] as const;
  });
  const saveBtn = button(t('result.saveImage'), 'rp-btn rp-primary');
  const shareBtn = button(t('result.share'));
  const copyBtn = button(t('result.copyLink'));
  const textBtn = button(t('result.textShare'));

  async function prepare(): Promise<void> {
    const my = ++token;
    card = null;
    saveBtn.disabled = true;
    for (const [f, b] of formatButtons) b.setAttribute('aria-checked', String(f === format));
    preview.width = 1080;
    preview.height = format === 'story' ? 1920 : 1080;
    preview.classList.toggle('is-square', format === 'square');
    status.textContent = t('result.preparing');
    try {
      const c = await renderCard(cardInput, format);
      if (my !== token) return;
      card = c;
      preview.src = c.dataUrl;
      saveBtn.disabled = false;
      status.textContent = '';
    } catch {
      if (my === token) status.textContent = '';
    }
  }

  const imageOf = (c: RenderedCard) => ({ ...c, alt: preview.alt });
  const text = viewShareText(v, s.n, shareUrl);

  saveBtn.addEventListener('click', () => {
    if (!card) return;
    void saveImage(imageOf(card), lang, { preferShare: false }).then((o) => {
      if (o === 'downloaded') flash(status, t('result.imageSaved'));
    });
  });
  shareBtn.addEventListener('click', () => {
    void (async () => {
      if (card && typeof navigator.canShare === 'function') {
        const o = await saveImage(imageOf(card), lang, {
          preferShare: true,
          title: t('result.shareTitle'),
          text,
        });
        if (o !== 'downloaded') return;
      } else {
        const o = await shareLink({ title: t('result.shareTitle'), text, url: shareUrl });
        if (o !== 'unavailable') return;
      }
      if (await copyText(shareUrl, lang)) flash(status, t('result.linkCopied'));
    })();
  });
  copyBtn.addEventListener('click', () => {
    void copyText(shareUrl, lang).then((ok) => ok && flash(status, t('result.linkCopied')));
  });
  textBtn.addEventListener('click', () => {
    void (async () => {
      const o = await shareLink({ text });
      if (o !== 'unavailable') return;
      if (await tryCopy(text)) {
        flash(status, t('result.textCopied'));
        return;
      }
      const body = text.slice(0, text.lastIndexOf('\n'));
      window.open(xIntentUrl(body, shareUrl), '_blank', 'noopener');
    })();
  });

  const runIt = link(t('result.runIt'), simulatorUrl(runHash), 'rp-btn rp-primary');
  const tryOwn = link(t('result.tryOwn'), pagePath('simulator', lang));

  const statsEl = stats(statItems);
  root.replaceChildren(
    tags,
    matchup,
    runs,
    winBar(v),
    legend(v, s),
    ...(statsEl ? [statsEl] : []),
    el('p', 'rp-note', t('result.snapshot')),
    el('div', 'rp-actions', runIt, tryOwn),
    el(
      'section',
      'rp-card',
      formatGroup,
      el('div', 'rp-card-frame', preview),
      el('div', 'rp-actions', saveBtn, shareBtn, copyBtn, textBtn),
      status,
    ),
    el('p', 'rp-disclaimer', t('result.disclaimer')),
  );
  void prepare();
}

const decoded = decodeAnyResultQuery(location.search);
if (!decoded.ok) renderError(decoded.error, decoded.config);
else if (decoded.kind === 'free') {
  const view = freeResultView(decoded.config, decoded.summary, lang);
  renderResult({
    view,
    summary: decoded.summary,
    stats: freeStats(view, decoded.summary),
    runIt: reproduceFreeHash(decoded.config, decoded.summary),
    seed: decoded.config.seed,
  });
} else {
  const view = resultView(decoded.config, decoded.summary, lang);
  renderResult({
    view,
    summary: decoded.summary,
    stats: classicStats(view, decoded.summary),
    runIt: reproduceHash(decoded.config, decoded.summary),
    seed: decoded.config.seed,
  });
}
