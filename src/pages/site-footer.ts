import { escapeHtml } from '../seo/html.ts';
import { DICTIONARIES } from '../i18n/dictionaries.ts';
import type { MsgKey } from '../i18n/ko.ts';
import type { Lang } from '../i18n/lang.ts';
import { FOOTER_LINKS, RELEASES_URL, footerHref } from './routes.ts';

/*
 * The site footer, in one place (docs/PAGES.md#footer, #64). Like the header, the build fills it
 * into every page that has the placeholder (vite.pages.ts → expandSiteHeader). The text is bound
 * to dictionary keys (`data-i18n*`) so the app can relabel it in place after a language switch;
 * the links follow FOOTER_LINKS, which `renderFooterLinks` (src/ui/site-nav.ts) also uses.
 */

/** Placeholder in every page source with the shared footer, replaced by {@link renderSiteFooter}. */
export const SITE_FOOTER_PLACEHOLDER = '<!-- site-footer -->';

const attrs = (a: Record<string, string>): string =>
  Object.entries(a)
    .map(([k, v]) => (v === '' ? k : `${k}="${escapeHtml(v)}"`))
    .join(' ');

/** The static `<footer class="site-footer">` in `lang`. */
export function renderSiteFooter(lang: Lang): string {
  const d = DICTIONARIES[lang];
  const text = (key: MsgKey): string => escapeHtml(d[key]);
  const links = FOOTER_LINKS.map((link) => {
    const a: Record<string, string> = { href: footerHref(link, lang) };
    if (link.rel) a['rel'] = link.rel;
    a['data-footer'] = link.id;
    return `          <li><a ${attrs(a)}>${text(link.label)}</a></li>`;
  });
  const version = attrs({
    class: 'version-footer',
    href: RELEASES_URL,
    rel: 'noopener',
    title: d['version.footerTitle'],
    'data-i18n-title': 'version.footerTitle',
  });
  return [
    '<footer class="site-footer">',
    '      <div class="site-footer-inner">',
    `        <p class="footer-disclaimer" data-i18n="footer.disclaimer">${text('footer.disclaimer')}</p>`,
    `        <ul ${attrs({ class: 'footer-links', 'aria-label': d['footer.linksLabel'], 'data-i18n-aria': 'footer.linksLabel' })}>`,
    ...links,
    '        </ul>',
    '        <p class="footer-meta">',
    `          <span data-i18n="footer.local">${text('footer.local')}</span>`,
    `          <span data-i18n="footer.copyright">${text('footer.copyright')}</span>`,
    `          <a ${version}><span data-i18n="version.footer">${text('version.footer')}</span> <span class="version-footer-num" data-app-version></span></a>`,
    '        </p>',
    '      </div>',
    '    </footer>',
  ].join('\n');
}
