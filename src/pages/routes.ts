import type { Lang, MsgKey } from '../ui/i18n.ts';

/** Production origin used for canonical URLs, hreflang alternates and the sitemap. */
export const SITE_ORIGIN = 'https://trex-vs-tiger.vinylims.com';

/** Owner links shown in every footer (docs/PAGES.md#footer). */
export const REPO_URL = 'https://github.com/VinylStage/trex_vs_tiger_sim';
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LINKTREE_URL = 'https://link.vinylims.com';
export const BLOG_URL = 'https://vinylims.com';

/**
 * Static content pages. Each one exists twice: Korean at `/<page>/` (source `<page>/index.html`)
 * and English at `/en/<page>/` (source `en/<page>/index.html`). See docs/PAGES.md.
 */
export const CONTENT_PAGES = [
  'guide',
  'model',
  'parameters',
  'about',
  'privacy',
  'license',
] as const;
export type ContentPage = (typeof CONTENT_PAGES)[number];

/**
 * `simulator` is the app: Korean at `/` (source `index.html`), English at `/en/` (source
 * `en/index.html`). Both load the same `src/main.ts`; the language comes from the URL.
 */
export type PageId = 'simulator' | ContentPage;

/** Order of the shared site navigation (header). Privacy and license are in the footer only. */
export const NAV_PAGES: readonly PageId[] = ['simulator', 'guide', 'model', 'parameters', 'about'];

/** Dictionary key of each page's short name (navigation, breadcrumbs, llms.txt). */
export const NAV_LABEL_KEYS: Readonly<Record<PageId, MsgKey>> = {
  simulator: 'nav.simulator',
  guide: 'nav.guide',
  model: 'nav.model',
  parameters: 'nav.parameters',
  about: 'nav.about',
  privacy: 'nav.privacy',
  license: 'nav.license',
};

const otherLang = (lang: Lang): Lang => (lang === 'ko' ? 'en' : 'ko');

/** Root-relative path of a page in a language. */
export function pagePath(page: PageId, lang: Lang): string {
  if (page === 'simulator') return lang === 'en' ? '/en/' : '/';
  return lang === 'en' ? `/en/${page}/` : `/${page}/`;
}

const isContentPage = (v: string): v is ContentPage =>
  (CONTENT_PAGES as readonly string[]).includes(v);

/**
 * Which page a pathname shows, and in which language. Accepts the forms Pages serves or
 * redirects (`/guide`, `/guide/`, `/guide/index.html`, `/en`, `/en/`, `/en/index.html`).
 * Unknown paths give null.
 */
export function parsePagePath(pathname: string): { page: PageId; lang: Lang } | null {
  const parts = pathname
    .replace(/\/index\.html$/, '/')
    .split('/')
    .filter((p) => p !== '');
  if (parts.length === 0) return { page: 'simulator', lang: 'ko' };
  const [first, second] = parts;
  if (parts.length === 1 && first === 'en') return { page: 'simulator', lang: 'en' };
  if (parts.length === 1 && first !== undefined && isContentPage(first)) {
    return { page: first, lang: 'ko' };
  }
  if (parts.length === 2 && first === 'en' && second !== undefined && isContentPage(second)) {
    return { page: second, lang: 'en' };
  }
  return null;
}

/** Language of a not-found page source: `/en/404.html` → 'en', `/404.html` → 'ko', else null. */
export function notFoundLang(path: string): Lang | null {
  if (/^\/?404\.html$/.test(path)) return 'ko';
  if (/^\/?en\/404\.html$/.test(path)) return 'en';
  return null;
}

/**
 * Language of a shared-result page (docs/SHARING.md#result-page), not an indexable page:
 * `/r/`, `/r/index.html` → 'ko'; `/en/r/`, `/en/r/index.html` → 'en'; anything else null.
 */
export function resultPageLang(path: string): Lang | null {
  if (/^\/?r\/(index\.html)?$/.test(path)) return 'ko';
  if (/^\/?en\/r\/(index\.html)?$/.test(path)) return 'en';
  return null;
}

/** Root-relative path of the result page in a language. */
export const resultPagePath = (lang: Lang): string => (lang === 'en' ? '/en/r/' : '/r/');

/** The same page in the other language (app or content page), or null for an unknown path. */
export function counterpartPath(pathname: string): string | null {
  const here = parsePagePath(pathname);
  return here ? pagePath(here.page, otherLang(here.lang)) : null;
}

/**
 * The language a page is in: from its path when it is a known page, otherwise from its
 * `<html lang>` (for example when the app is served under an unexpected path), otherwise Korean.
 */
export function pageLang(pathname: string, htmlLang: string): Lang {
  const here = parsePagePath(pathname);
  if (here) return here.lang;
  return htmlLang.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

/**
 * URL the app shows after switching to `lang` in place: the app path of that language with the
 * query (`?tour=…`, …) and fragment (`#s=…`) kept.
 */
export function switchedAppUrl(lang: Lang, search: string, hash: string): string {
  const q = search === '?' ? '' : search;
  const h = hash === '#' ? '' : hash;
  return `${pagePath('simulator', lang)}${q}${h}`;
}

/** Absolute production URL of a page. */
export function canonicalUrl(page: PageId, lang: Lang): string {
  return `${SITE_ORIGIN}${pagePath(page, lang)}`;
}

/** One link of the shared site footer. */
export interface FooterLink {
  id: 'about' | 'privacy' | 'license' | 'source' | 'blog' | 'linktree';
  /** i18n key of the visible label (the static pages repeat the dictionary text). */
  label: MsgKey;
  /** Site page (localised path) or external URL. */
  target: { page: ContentPage } | { url: string };
  /** `rel` attribute; `me` marks the owner's own profiles. */
  rel?: string;
}

/**
 * The footer links of every page, in order. The static footers of all pages repeat them (checked
 * by tests/pages.test.ts) and the app rebuilds them when the language changes.
 */
export const FOOTER_LINKS: readonly FooterLink[] = [
  { id: 'about', label: 'footer.about', target: { page: 'about' } },
  { id: 'privacy', label: 'footer.privacy', target: { page: 'privacy' } },
  { id: 'license', label: 'footer.license', target: { page: 'license' } },
  { id: 'source', label: 'footer.source', target: { url: REPO_URL }, rel: 'noopener' },
  { id: 'blog', label: 'footer.blog', target: { url: BLOG_URL }, rel: 'me noopener' },
  { id: 'linktree', label: 'footer.linktree', target: { url: LINKTREE_URL }, rel: 'me noopener' },
];

/** `href` of a footer link in a language. */
export function footerHref(link: FooterLink, lang: Lang): string {
  return 'page' in link.target ? pagePath(link.target.page, lang) : link.target.url;
}
