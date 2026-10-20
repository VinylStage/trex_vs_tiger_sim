import { escapeHtml } from '../seo/html.ts';
import { DICTIONARIES, type Lang } from '../ui/i18n.ts';
import {
  NAV_LABEL_KEYS,
  NAV_PAGES,
  notFoundLang,
  otherLang,
  pagePath,
  parsePagePath,
  resultPageLang,
  type PageId,
} from './routes.ts';
import { renderSiteFooter, SITE_FOOTER_PLACEHOLDER } from './site-footer.ts';

/*
 * The site header, in one place (docs/PAGES.md#site-header). DOM-free and pure, so the same code
 * renders the static header of every content page and 404 page at build time (vite.pages.ts, also
 * in dev), gives the app its logo (src/ui/app.ts, the static head of index.html / en/index.html)
 * and the site nav its items (src/ui/site-nav.ts), and lets the tests compare against it.
 * Never import this from src/pages/site.ts: it pulls in the dictionaries.
 */

/**
 * The header logo of every page: the original icon the owner chose (docs/BRANDING.md#assets).
 * The app header shows it at 40 px, the content-page header at 32 px; `alt` is empty because the
 * brand text or the app title sits next to it.
 */
export const SITE_LOGO = {
  src: '/header-logo.svg',
  alt: '',
  size: { app: 40, page: 32 },
} as const;

/** Dictionary key of the brand text next to the logo in the content-page header. */
export const BRAND_TEXT_KEY = 'app.shortTitle';

/** Placeholder in a content page or 404 source, replaced by {@link renderSiteHeader}. */
export const SITE_HEADER_PLACEHOLDER = '<!-- site-header -->';
/** Placeholder in the static head of index.html / en/index.html, replaced by {@link renderAppLogo}. */
export const APP_LOGO_PLACEHOLDER = '<!-- app-logo -->';

export interface SiteNavItem {
  page: PageId;
  href: string;
  label: string;
  current: boolean;
}

/** Links of the shared site navigation in `lang`, `current` marked (null: none, e.g. a 404). */
export function siteNavItems(lang: Lang, current: PageId | null = 'simulator'): SiteNavItem[] {
  return NAV_PAGES.map((page) => ({
    page,
    href: pagePath(page, lang),
    label: DICTIONARIES[lang][NAV_LABEL_KEYS[page]],
    current: page === current,
  }));
}

/** `<img>` attributes of the logo in the app header or the content-page header. */
export function logoAttrs(where: keyof typeof SITE_LOGO.size): Record<string, string> {
  const size = String(SITE_LOGO.size[where]);
  return { src: SITE_LOGO.src, alt: SITE_LOGO.alt, width: size, height: size };
}

const attrs = (a: Record<string, string>): string =>
  Object.entries(a)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(' ');

/** The logo `<img class="logo">` of the app header (static head of index.html / en/index.html). */
export function renderAppLogo(): string {
  return `<img class="logo" ${attrs(logoAttrs('app'))} />`;
}

/**
 * The static `<header class="site-header">` of a content page (`current` = its id) or a 404 page
 * (`current` = null): logo and brand text linking the simulator, the site nav, and the link to
 * the same page in the other language (the simulator for a 404). `src/pages/site.ts` later keeps
 * the language link's `#hash` and re-marks `aria-current` from the URL.
 */
export function renderSiteHeader(lang: Lang, current: PageId | null): string {
  const d = DICTIONARIES[lang];
  const other = otherLang(lang);
  const nav = siteNavItems(lang, current)
    .map((item) => {
      const a: Record<string, string> = {
        class: 'site-nav-link',
        href: item.href,
        'data-page': item.page,
      };
      if (item.current) a['aria-current'] = 'page';
      return `            <li><a ${attrs(a)}>${escapeHtml(item.label)}</a></li>`;
    })
    .join('\n');
  const switchHref = pagePath(current ?? 'simulator', other);
  return [
    '<header class="site-header">',
    '      <div class="site-header-inner">',
    `        <a class="site-brand" href="${pagePath('simulator', lang)}">`,
    `          <img ${attrs(logoAttrs('page'))} />`,
    `          <span>${escapeHtml(d[BRAND_TEXT_KEY])}</span>`,
    '        </a>',
    `        <nav class="site-nav" aria-label="${escapeHtml(d['nav.label'])}">`,
    '          <ul class="site-nav-list">',
    nav,
    '          </ul>',
    '        </nav>',
    `        <a class="lang-switch" ${attrs({ href: switchHref, hreflang: other, lang: other })} data-lang-switch>${escapeHtml(d['lang.switch'])}</a>`,
    '      </div>',
    '    </header>',
  ].join('\n');
}

/** Which page a source is, for {@link expandSiteHeader}: language and page (null for a 404). */
export interface HeaderRoute {
  lang: Lang;
  page: PageId | null;
}

/**
 * The route of a page source by its root-relative path as Vite reports it (`/guide/index.html`,
 * `/en/index.html`, `/404.html`, `/en/404.html`, `/r/index.html`), or null for anything else
 * (`/reset/`). 404 and result pages mark no navigation item (`page: null`).
 */
export function headerRouteOf(path: string): HeaderRoute | null {
  const p = path.split('?')[0] ?? '';
  const nf = notFoundLang(p) ?? resultPageLang(p);
  if (nf) return { lang: nf, page: null };
  if (!/(^|\/)index\.html$|\/$/.test(p)) return null;
  return parsePagePath(p);
}

/**
 * Replace the header placeholders of a page source with the shared markup: `<!-- site-header -->`
 * (content and 404 pages) and `<!-- app-logo -->` (simulator). Pages without placeholders (the
 * `/reset/` utility page) are returned unchanged. Throws when a placeholder needs a route the
 * caller could not resolve, or when the placeholder does not fit the page.
 */
export function expandSiteHeader(html: string, route: HeaderRoute | null, file: string): string {
  const hasHeader = html.includes(SITE_HEADER_PLACEHOLDER);
  const hasLogo = html.includes(APP_LOGO_PLACEHOLDER);
  const hasFooter = html.includes(SITE_FOOTER_PLACEHOLDER);
  if (!hasHeader && !hasLogo && !hasFooter) return html;
  if (!route) throw new Error(`${file}: header placeholder on a page with no known route`);
  if (hasHeader && route.page === 'simulator') {
    throw new Error(`${file}: the simulator uses ${APP_LOGO_PLACEHOLDER}, not the site header`);
  }
  if (hasLogo && route.page !== 'simulator') {
    throw new Error(`${file}: ${APP_LOGO_PLACEHOLDER} belongs in the simulator's static head`);
  }
  return html
    .replace(SITE_HEADER_PLACEHOLDER, () => renderSiteHeader(route.lang, route.page))
    .replace(APP_LOGO_PLACEHOLDER, () => renderAppLogo())
    .replace(SITE_FOOTER_PLACEHOLDER, () => renderSiteFooter(route.lang));
}
