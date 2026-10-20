import { canonicalUrl, type PageId } from '../pages/routes.ts';
import type { Lang } from '../ui/i18n.ts';
import { escapeHtml } from './html.ts';
import { INDEXABLE_ROUTES, alternates } from './site.ts';

/** Last-modified date of a page (ISO 8601), or null when unknown (then `<lastmod>` is omitted). */
export type LastmodOf = (page: PageId, lang: Lang) => string | null;

/**
 * sitemap.xml for every indexable URL (Korean and English), each with its hreflang alternates
 * (`ko`, `en`, `x-default` → English) and, when known, an accurate `<lastmod>` (SEO_GEO §1.4).
 * No `<priority>` or `<changefreq>`: Google ignores both.
 */
export function sitemapXml(lastmod: LastmodOf): string {
  const urls = INDEXABLE_ROUTES.map(({ page, lang }) => {
    const date = lastmod(page, lang);
    const lines = [`    <loc>${escapeHtml(canonicalUrl(page, lang))}</loc>`];
    if (date) lines.push(`    <lastmod>${escapeHtml(date)}</lastmod>`);
    for (const a of alternates(page)) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.href)}" />`,
      );
    }
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
