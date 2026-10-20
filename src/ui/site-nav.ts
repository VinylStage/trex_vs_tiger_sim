import { FOOTER_LINKS, NAV_LABEL_KEYS, footerHref, pagePath, type PageId } from '../pages/routes';
import { siteNavItems } from '../pages/site-header';
import { h } from './dom';
import { DICTIONARIES, type Lang } from './i18n';
import './site-nav.css';

// The nav items come from the shared header module, so the app and the static pages agree.
export { NAV_LABEL_KEYS, siteNavItems };
export type { SiteNavItem } from '../pages/site-header';

/**
 * `<nav>` linking the simulator and the content pages for `lang`, with `current` marked
 * `aria-current="page"`. Labels and hrefs depend on the language, so build a new nav (and
 * replace the old one) when the language changes. Markup matches the static pages
 * (`.site-nav > ul.site-nav-list > li > a.site-nav-link[data-page]`).
 */
export function createSiteNav(lang: Lang, current: PageId = 'simulator'): HTMLElement {
  const list = h('ul', { class: 'site-nav-list' });
  for (const item of siteNavItems(lang, current)) {
    const a = h('a', {
      class: 'site-nav-link',
      text: item.label,
      attrs: { href: item.href, 'data-page': item.page },
    });
    if (item.current) a.setAttribute('aria-current', 'page');
    list.append(h('li', {}, a));
  }
  return h(
    'nav',
    { class: 'site-nav', attrs: { 'aria-label': DICTIONARIES[lang]['nav.label'], lang } },
    list,
  );
}

export interface FooterItem {
  id: string;
  href: string;
  label: string;
  rel: string | null;
}

/** Links of the shared site footer in `lang` (same order, labels and rel as the static pages). */
export function footerItems(lang: Lang): FooterItem[] {
  return FOOTER_LINKS.map((link) => ({
    id: link.id,
    href: footerHref(link, lang),
    label: DICTIONARIES[lang][link.label],
    rel: link.rel ?? null,
  }));
}

/**
 * Rewrite the static footer's links (`ul.footer-links` inside `footer.site-footer`) for `lang`.
 * The list exists in the static HTML of every page; the app calls this after switching the
 * language in place. Markup: `ul.footer-links > li > a[data-footer]`.
 */
export function renderFooterLinks(list: HTMLElement, lang: Lang): void {
  const items = footerItems(lang).map((item) => {
    const attrs: Record<string, string> = { href: item.href, 'data-footer': item.id };
    if (item.rel) attrs['rel'] = item.rel;
    return h('li', {}, h('a', { text: item.label, attrs }));
  });
  list.replaceChildren(...items);
}

/**
 * Point every in-page link to a site page (`a[data-page]`, outside the rebuilt site nav) at its
 * `lang` version. An optional `data-href-suffix` (`?tour=1`, `#results`) is appended.
 */
export function relocalizeLinks(root: ParentNode, lang: Lang): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-page]')) {
    if (a.closest('.site-nav')) continue;
    const page = a.dataset['page'];
    if (!isPageId(page)) continue;
    a.setAttribute('href', `${pagePath(page, lang)}${a.dataset['hrefSuffix'] ?? ''}`);
  }
}

const isPageId = (v: string | undefined): v is PageId =>
  v !== undefined && Object.hasOwn(NAV_LABEL_KEYS, v);
