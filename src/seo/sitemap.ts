import { canonicalUrl, type PageId } from '../pages/routes.ts';
import type { Lang } from '../ui/i18n.ts';
import { escapeHtml } from './html.ts';
import { INDEXABLE_ROUTES, alternates } from './site.ts';

/** Last-modified date of a page (ISO 8601), or null when unknown (then `<lastmod>` is omitted). */
export type LastmodOf = (page: PageId, lang: Lang) => string | null;

/**
 * The modification date the build publishes for a page (sitemap `<lastmod>`, llms-full.txt).
 * A page that shows a "last updated" date uses exactly that date, the same one its JSON-LD
 * `dateModified` carries; only a page without one (the simulator) falls back to the git date of
 * its source. One source of truth per page, so the sitemap, the markup and the page agree.
 */
export function pageLastmod(updated: string | null, gitDate: string | null): string | null {
  return updated ?? gitDate;
}

/**
 * True when the page source was committed on a later day than its visible "last updated" date,
 * i.e. someone edited the page without bumping the date. The build warns about it
 * (vite.seo.ts); comparing calendar days in the committer's own time zone is enough here.
 */
export function visibleDateIsStale(updated: string | null, gitDate: string | null): boolean {
  if (!updated || !gitDate) return false;
  return gitDate.slice(0, 10) > updated;
}

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
