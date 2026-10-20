import {
  CATEGORY_LABELS,
  PATCH_CATEGORIES,
  releasedNotes,
  versionAnchor,
  type PatchNote,
} from '../content/patch-notes.ts';
import { escapeHtml } from '../seo/html.ts';
import type { Lang } from '../ui/i18n.ts';
import { REPO_URL, RELEASES_URL } from './routes.ts';
import type { HeaderRoute } from './site-header.ts';

/*
 * The board of the patch notes page (docs/PAGES.md#patch-notes), rendered at build time from
 * src/content/patch-notes.ts. `<!-- patch-notes -->` in patch-notes/index.html and
 * en/patch-notes/index.html becomes a version index and one card per released version, newest
 * first. DOM-free and pure: vite.pages.ts runs it in dev and in the build, vite.seo.ts for
 * llms-full.txt, and the tests compare against it.
 */

/** Placeholder in the patch notes page sources, replaced by {@link renderPatchNotes}. */
export const PATCH_NOTES_PLACEHOLDER = '<!-- patch-notes -->';

const WORDS: Readonly<
  Record<
    Lang,
    {
      index: string;
      latest: string;
      prs: string;
      release: string;
      older: string;
      olderLink: string;
    }
  >
> = {
  ko: {
    index: '버전 목록',
    latest: '최신',
    prs: '풀 리퀘스트',
    release: 'GitHub 릴리스',
    older: '커밋 단위의 자세한 변경 내역은',
    olderLink: 'GitHub 릴리스 페이지',
  },
  en: {
    index: 'Versions',
    latest: 'Latest',
    prs: 'Pull requests',
    release: 'GitHub release',
    older: 'For the commit-level details, see the',
    olderLink: 'GitHub releases page',
  },
};

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A `YYYY-MM-DD` date as readers see it: `2026년 10월 20일` / `20 October 2026`. */
export function formatNoteDate(iso: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`not a YYYY-MM-DD date: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return lang === 'ko' ? `${y}년 ${mo}월 ${d}일` : `${d} ${MONTHS_EN[mo - 1] ?? ''} ${y}`;
}

const issueUrl = (n: number): string => `${REPO_URL}/issues/${n}`;
const pullUrl = (n: number): string => `${REPO_URL}/pull/${n}`;
const releaseUrl = (version: string): string => `${RELEASES_URL}/tag/trex-vs-tiger-sim-v${version}`;

const refLinks = (refs: readonly number[], url: (n: number) => string): string =>
  refs.map((n) => `<a href="${url(n)}" rel="noopener">#${n}</a>`).join(', ');

function renderCard(note: PatchNote, lang: Lang, latest: boolean): string {
  const w = WORDS[lang];
  const id = versionAnchor(note.version);
  const groups = PATCH_CATEGORIES.map((cat) => {
    const items = note.items.filter((i) => i.cat === cat);
    if (items.length === 0) return '';
    const lis = items
      .map((i) => {
        const refs = i.refs?.length
          ? ` <span class="patch-refs">(${refLinks(i.refs, issueUrl)})</span>`
          : '';
        return `              <li>${escapeHtml(i[lang])}${refs}</li>`;
      })
      .join('\n');
    return [
      `            <div class="patch-group patch-group-${cat}">`,
      `              <h3>${escapeHtml(CATEGORY_LABELS[lang][cat])}</h3>`,
      '              <ul>',
      lis,
      '              </ul>',
      '            </div>',
    ].join('\n');
  })
    .filter((g) => g !== '')
    .join('\n');
  const newTag = latest ? ` <span class="patch-new" lang="en">NEW</span>` : '';
  return [
    `          <section id="${id}" class="patch-card${latest ? ' is-latest' : ''}" aria-labelledby="${id}-title">`,
    '            <p class="patch-card-meta">',
    `              <a class="patch-version" href="#${id}">v${note.version}</a>${newTag}`,
    `              <time datetime="${note.date}">${formatNoteDate(note.date, lang)}</time>`,
    '            </p>',
    `            <h2 id="${id}-title">${escapeHtml(note.title[lang])}</h2>`,
    groups,
    '            <p class="patch-card-foot">',
    `              ${w.prs}: ${refLinks(note.prs, pullUrl)} ·`,
    `              <a href="${releaseUrl(note.version)}" rel="noopener">${w.release}</a>`,
    '            </p>',
    '          </section>',
  ].join('\n');
}

/**
 * The version index (`nav.toc`) and the cards (`div.page-body`) of the notes a build at
 * `version` shows (src/content/patch-notes.ts `releasedNotes`); the newest carries the NEW tag.
 */
export function renderPatchNotes(lang: Lang, version: string): string {
  const notes = releasedNotes(version);
  if (notes.length === 0) throw new Error(`patch notes: no entry up to v${version}`);
  const w = WORDS[lang];
  const index = notes
    .map((n, i) => {
      const latest = i === 0 ? ` <span class="patch-index-latest">${w.latest}</span>` : '';
      return `            <li><a href="#${versionAnchor(n.version)}">v${n.version}</a>${latest}</li>`;
    })
    .join('\n');
  return [
    '<nav class="toc patch-index" aria-labelledby="toc-title">',
    `          <h2 id="toc-title">${w.index}</h2>`,
    '          <ol>',
    index,
    '          </ol>',
    '        </nav>',
    '',
    '        <div class="page-body patch-board">',
    ...notes.map((n, i) => renderCard(n, lang, i === 0)),
    '          <p class="patch-older">',
    `            ${w.older} <a href="${RELEASES_URL}" rel="noopener">${w.olderLink}</a>${lang === 'ko' ? '를 참고하세요.' : '.'}`,
    '          </p>',
    '        </div>',
  ].join('\n');
}

/**
 * Replace `<!-- patch-notes -->` with the board for the build's `version`. Sources without the
 * placeholder are returned unchanged; the placeholder on any page other than the patch notes page
 * throws.
 */
export function expandPatchNotes(
  html: string,
  route: HeaderRoute | null,
  version: string,
  file: string,
): string {
  if (!html.includes(PATCH_NOTES_PLACEHOLDER)) return html;
  if (!route || route.page !== 'patch-notes') {
    throw new Error(`${file}: ${PATCH_NOTES_PLACEHOLDER} belongs on the patch notes page only`);
  }
  return html.replace(PATCH_NOTES_PLACEHOLDER, () => renderPatchNotes(route.lang, version));
}
