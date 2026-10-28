import { escapeHtml } from '../seo/html.ts';
import { DICTIONARIES } from '../i18n/dictionaries.ts';
import type { Lang } from '../i18n/lang.ts';
import {
  notFoundLang,
  otherLang,
  pagePath,
  parsePagePath,
  playPageLang,
  resultPageLang,
  type PageId,
} from './routes.ts';
import { renderSiteFooter, SITE_FOOTER_PLACEHOLDER } from './site-footer.ts';
import { logoAttrs, navGroupsOf, navItems, type SiteNavItem } from './site-shell.ts';

export { logoAttrs, SITE_LOGO, type SiteNavItem } from './site-shell.ts';

/*
 * The site header, in one place (docs/PAGES.md#site-header). DOM-free and pure, so the same code
 * renders the static header of every content page and 404 page at build time (vite.pages.ts, also
 * in dev) and the logo in the static head of play/index.html / en/play/index.html, and lets the tests
 * compare against it. It holds both dictionaries, so never import it from browser code: the app's
 * logo and site nav use src/pages/site-shell.ts (#79).
 */

/** Dictionary key of the brand text next to the logo in the content-page header. */
export const BRAND_TEXT_KEY = 'app.shortTitle';

/** Placeholder in a content page or 404 source, replaced by {@link renderSiteHeader}. */
export const SITE_HEADER_PLACEHOLDER = '<!-- site-header -->';
/** Placeholder in the play page's static app header, replaced by {@link renderAppLogo}. */
export const APP_LOGO_PLACEHOLDER = '<!-- app-logo -->';

/** Links of the shared site navigation in `lang`, `current` marked (null: none, e.g. a 404). */
export function siteNavItems(lang: Lang, current: PageId | null = 'simulator'): SiteNavItem[] {
  return navItems(lang, current, DICTIONARIES[lang]);
}

const attrs = (a: Record<string, string>): string =>
  Object.entries(a)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(' ');

/** The logo `<img class="logo">` of the app header (static head of the play page). */
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
  const link = (item: SiteNavItem, indent: string): string => {
    const a: Record<string, string> = {
      class: item.head ? 'site-nav-link site-nav-head' : 'site-nav-link',
      href: item.href,
      'data-page': item.page,
    };
    if (item.current) a['aria-current'] = 'page';
    return `${indent}<a ${attrs(a)}>${escapeHtml(item.label)}</a>`;
  };
  const nav = navGroupsOf(siteNavItems(lang, current))
    .map(([head, children]) => {
      const lines = [
        `            <li class="site-nav-group" data-group="${head.group}">`,
        link(head, '              '),
      ];
      if (children.length > 0) {
        lines.push(
          `              <ul class="site-nav-sub" aria-label="${escapeHtml(head.label)}">`,
          ...children.map((c) => `                <li>${link(c, '')}</li>`),
          '              </ul>',
        );
      }
      lines.push('            </li>');
      return lines.join('\n');
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

/**
 * Which page a source is, for {@link expandSiteHeader}: language and page (`play` for the
 * simulator app, null for a 404 or result page).
 */
export interface HeaderRoute {
  lang: Lang;
  page: PageId | 'play' | null;
}

/**
 * The route of a page source by its root-relative path as Vite reports it (`/guide/index.html`,
 * `/en/index.html`, `/404.html`, `/en/404.html`, `/r/index.html`), or null for anything else
 * (`/reset/`). 404 and result pages mark no navigation item (`page: null`); the play pages
 * (`/play/index.html`, `/en/play/index.html`) are `play`.
 */
export function headerRouteOf(path: string): HeaderRoute | null {
  const p = path.split('?')[0] ?? '';
  const nf = notFoundLang(p) ?? resultPageLang(p);
  if (nf) return { lang: nf, page: null };
  if (!/(^|\/)index\.html$|\/$/.test(p)) return null;
  const play = playPageLang(p);
  if (play) return { lang: play, page: 'play' };
  return parsePagePath(p);
}

/**
 * Replace the header placeholders of a page source with the shared markup: `<!-- site-header -->`
 * (lobby, content and 404 pages) and `<!-- app-logo -->` (play page). Pages without placeholders (the
 * `/reset/` utility page) are returned unchanged. Throws when a placeholder needs a route the
 * caller could not resolve, or when the placeholder does not fit the page.
 */
export function expandSiteHeader(html: string, route: HeaderRoute | null, file: string): string {
  const hasHeader = html.includes(SITE_HEADER_PLACEHOLDER);
  const hasLogo = html.includes(APP_LOGO_PLACEHOLDER);
  const hasFooter = html.includes(SITE_FOOTER_PLACEHOLDER);
  if (!hasHeader && !hasLogo && !hasFooter) return html;
  if (!route) throw new Error(`${file}: header placeholder on a page with no known route`);
  const { lang, page } = route;
  if (hasHeader && page === 'play') {
    throw new Error(`${file}: the play page uses ${APP_LOGO_PLACEHOLDER}, not the site header`);
  }
  if (hasLogo && page !== 'play') {
    throw new Error(`${file}: ${APP_LOGO_PLACEHOLDER} belongs in the play page's static head`);
  }
  return html
    .replace(SITE_HEADER_PLACEHOLDER, () => renderSiteHeader(lang, page === 'play' ? null : page))
    .replace(APP_LOGO_PLACEHOLDER, () => renderAppLogo())
    .replace(SITE_FOOTER_PLACEHOLDER, () => renderSiteFooter(lang));
}
