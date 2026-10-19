import type { Lang } from '../ui/i18n';

/** Production origin used for canonical URLs, hreflang alternates and the sitemap. */
export const SITE_ORIGIN = 'https://trex-vs-tiger.vinylims.com';

/**
 * localStorage key of the language preference. Same value as `STORAGE_KEY` in src/ui/i18n.ts
 * (tests/pages.test.ts checks this); duplicated so the pages never load the i18n dictionaries.
 */
export const LANG_STORAGE_KEY = 'trexsim.lang';

/**
 * Static content pages. Each one exists twice: Korean at `/<page>/` (source `<page>/index.html`)
 * and English at `/en/<page>/` (source `en/<page>/index.html`). See docs/PAGES.md.
 */
export const CONTENT_PAGES = ['guide', 'model', 'parameters', 'about', 'privacy'] as const;
export type ContentPage = (typeof CONTENT_PAGES)[number];

/** `simulator` is the app at `/`; it is the same URL in both languages (language is client-side). */
export type PageId = 'simulator' | ContentPage;

/** Order of the shared site navigation (header). Privacy is linked from the footer only. */
export const NAV_PAGES: readonly PageId[] = ['simulator', 'guide', 'model', 'parameters', 'about'];

/** Root-relative path of a page in a language. */
export function pagePath(page: PageId, lang: Lang): string {
  if (page === 'simulator') return '/';
  return lang === 'en' ? `/en/${page}/` : `/${page}/`;
}

const isContentPage = (v: string): v is ContentPage =>
  (CONTENT_PAGES as readonly string[]).includes(v);

/**
 * Which page a pathname shows. Accepts the forms Pages serves or redirects
 * (`/guide`, `/guide/`, `/guide/index.html`). The simulator (`/`, `/index.html`) has no fixed
 * language, so `lang` is null for it. Unknown paths give null.
 */
export function parsePagePath(pathname: string): { page: PageId; lang: Lang | null } | null {
  const parts = pathname
    .replace(/\/index\.html$/, '/')
    .split('/')
    .filter((p) => p !== '');
  if (parts.length === 0) return { page: 'simulator', lang: null };
  const [first, second] = parts;
  if (parts.length === 1 && first !== undefined && isContentPage(first)) {
    return { page: first, lang: 'ko' };
  }
  if (parts.length === 2 && first === 'en' && second !== undefined && isContentPage(second)) {
    return { page: second, lang: 'en' };
  }
  return null;
}

/** The same content page in the other language, or null (simulator or unknown path). */
export function counterpartPath(pathname: string): string | null {
  const here = parsePagePath(pathname);
  if (!here || here.page === 'simulator' || here.lang === null) return null;
  return pagePath(here.page, here.lang === 'ko' ? 'en' : 'ko');
}

/** Absolute production URL of a page. */
export function canonicalUrl(page: PageId, lang: Lang): string {
  return `${SITE_ORIGIN}${pagePath(page, lang)}`;
}
