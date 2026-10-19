import { NAV_PAGES, pagePath, type PageId } from '../pages/routes';
import { h } from './dom';
import { DICTIONARIES, type Lang, type MsgKey } from './i18n';
import './site-nav.css';

export const NAV_LABEL_KEYS: Readonly<Record<PageId, MsgKey>> = {
  simulator: 'nav.simulator',
  guide: 'nav.guide',
  model: 'nav.model',
  parameters: 'nav.parameters',
  about: 'nav.about',
  privacy: 'nav.privacy',
};

export interface SiteNavItem {
  page: PageId;
  href: string;
  label: string;
  current: boolean;
}

/** Links of the shared site navigation in `lang` (same order and labels as the static pages). */
export function siteNavItems(lang: Lang, current: PageId = 'simulator'): SiteNavItem[] {
  return NAV_PAGES.map((page) => ({
    page,
    href: pagePath(page, lang),
    label: DICTIONARIES[lang][NAV_LABEL_KEYS[page]],
    current: page === current,
  }));
}

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
