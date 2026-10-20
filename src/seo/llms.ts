import {
  NAV_LABEL_KEYS,
  REPO_URL,
  SITE_ORIGIN,
  canonicalUrl,
  type PageId,
} from '../pages/routes.ts';
import { DICTIONARIES, LANGS, type Lang } from '../ui/i18n.ts';
import type { PageFacts } from './extract.ts';
import { decodeEntities, elementById, firstElement, textOf } from './html.ts';
import { INDEXABLE_PAGES, PERSON, SITE_NAME } from './site.ts';

/** A page as llms.txt sees it: its facts plus the source HTML (for llms-full.txt). */
export interface LlmsPage {
  page: PageId;
  lang: Lang;
  facts: PageFacts;
  html: string;
  lastmod: string | null;
}

const SECTION_TITLE: Readonly<Record<Lang, string>> = { ko: '한국어 페이지', en: 'English pages' };

const label = (page: PageId, lang: Lang): string => DICTIONARIES[lang][NAV_LABEL_KEYS[page]];

function find(pages: readonly LlmsPage[], page: PageId, lang: Lang): LlmsPage {
  const p = pages.find((x) => x.page === page && x.lang === lang);
  if (!p) throw new Error(`llms: missing ${lang} ${page}`);
  return p;
}

/**
 * /llms.txt in the llmstxt.org format: H1 site name, a blockquote summary, notes, then one H2 list
 * per language linking every indexable page with its meta description. Everything comes from the
 * pages and the dictionaries; nothing here is hand-maintained page text.
 */
export function llmsTxt(pages: readonly LlmsPage[]): string {
  const out = [
    `# ${SITE_NAME.ko} (${SITE_NAME.en})`,
    '',
    `> ${find(pages, 'simulator', 'ko').facts.description}`,
    `> ${find(pages, 'simulator', 'en').facts.description}`,
    '',
    ...LANGS.map((lang) => `- ${DICTIONARIES[lang]['footer.disclaimer']}`),
    `- ${DICTIONARIES.ko['footer.local']} / ${DICTIONARIES.en['footer.local']}`,
    `- Author: ${PERSON.name} (${PERSON.url}); source code (MIT): ${REPO_URL}`,
    `- Full text of every page: ${SITE_ORIGIN}/llms-full.txt`,
  ];
  for (const lang of LANGS) {
    out.push('', `## ${SECTION_TITLE[lang]}`, '');
    for (const page of INDEXABLE_PAGES) {
      const p = find(pages, page, lang);
      out.push(`- [${label(page, lang)}](${canonicalUrl(page, lang)}): ${p.facts.description}`);
    }
  }
  return `${out.join('\n')}\n`;
}

// ---------- HTML → Markdown-ish text for llms-full.txt ----------

const BLOCK_END =
  /<\/(p|div|section|article|header|ul|ol|dl|dd|dt|blockquote|figure|figcaption|caption|details|summary)>|<br\s*\/?>/gi;

function tableToMarkdown(table: string): string {
  const caption = firstElement(table, 'caption');
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...(r[1] ?? '').matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi)].map((c) =>
      textOf(c[2] ?? '').replaceAll('|', '\\|'),
    ),
  );
  const lines: string[] = [];
  if (caption !== null) lines.push(`${textOf(caption)}:`, '');
  rows.forEach((cells, i) => {
    lines.push(`| ${cells.join(' | ')} |`);
    if (i === 0) lines.push(`|${cells.map(() => ' --- |').join('')}`);
  });
  return `\n\n${lines.join('\n')}\n\n`;
}

/**
 * Readable text of an HTML fragment: headings become `#` lines, list items `- ` lines, tables
 * Markdown tables, `<pre>` blocks fenced code; navigation and scripts are dropped. With `base`
 * (the page's absolute URL), links become `[text](absolute-url)`; without it only their text stays.
 */
export function htmlToText(html: string, base?: string): string {
  const pres: string[] = [];
  let s = html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner: string) => {
    pres.push(
      decodeEntities(inner.replace(/<[^>]*>/g, ''))
        .replace(/^\n/, '')
        .trimEnd(),
    );
    return `@@PRE${pres.length - 1}@@`;
  });
  s = s.replace(/<(script|style|svg|nav|template|noscript)\b[\s\S]*?<\/\1>/gi, '');
  if (base !== undefined) {
    // Entities stay encoded here; the whole text is decoded once, after the tags are gone.
    s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_, attrs: string, inner: string) => {
      const text = inner
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const href = /\bhref="([^"]*)"/.exec(attrs)?.[1];
      if (!href || !text) return inner;
      const url = new URL(decodeEntities(href), base).href;
      const safe = url.replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      return `[${text.replace(/[[\]]/g, '\\$&')}](${safe})`;
    });
  }
  // Tables are laid out here and protected from the whitespace collapse below.
  const tables: string[] = [];
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => {
    tables.push(tableToMarkdown(t));
    return `@@TABLE${tables.length - 1}@@`;
  });
  s = s.replace(/\s+/g, ' ');
  s = s.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, n: string, inner: string) => `\n\n${'#'.repeat(Number(n))} ${textOf(inner)}\n\n`,
  );
  s = s.replace(/<li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<(p|dt|dd|blockquote|figcaption)\b[^>]*>/gi, '\n\n');
  s = s.replace(BLOCK_END, '\n');
  s = decodeEntities(s.replace(/<[^>]*>/g, ''));
  s = s
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  s = s.replace(/@@TABLE(\d+)@@/g, (_, i: string) => tables[Number(i)] ?? '');
  s = s.replace(
    /@@PRE(\d+)@@/g,
    (_, i: string) => `\n\n\`\`\`\n${pres[Number(i)] ?? ''}\n\`\`\`\n\n`,
  );
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** The readable part of a page: `<main>` on content pages, the static intro and FAQ on the app. */
export function pageMainText(p: LlmsPage): string {
  const base = canonicalUrl(p.page, p.lang);
  if (p.page === 'simulator') {
    const parts = [elementById(p.html, 'section', 'intro'), elementById(p.html, 'section', 'faq')];
    return parts
      .filter((x): x is string => x !== null)
      .map((x) => htmlToText(x, base))
      .join('\n\n');
  }
  const main = firstElement(p.html, 'main');
  if (main === null) throw new Error(`llms-full: ${p.lang} ${p.page} has no <main>`);
  return htmlToText(main, base);
}

/** /llms-full.txt: every indexable page's main text, Korean pages first, each with its URL. */
export function llmsFullTxt(pages: readonly LlmsPage[]): string {
  const out = [
    `# ${SITE_NAME.ko} (${SITE_NAME.en}) — full text`,
    '',
    `> ${find(pages, 'simulator', 'en').facts.description}`,
    '',
    `Index: ${SITE_ORIGIN}/llms.txt`,
  ];
  for (const lang of LANGS) {
    for (const page of INDEXABLE_PAGES) {
      const p = find(pages, page, lang);
      out.push('', '---', '', `# ${p.facts.title}`, '', `- URL: ${canonicalUrl(page, lang)}`);
      out.push(`- Language: ${lang}`);
      if (p.lastmod) out.push(`- Last modified: ${p.lastmod}`);
      out.push(`- Description: ${p.facts.description}`, '', pageMainText(p));
    }
  }
  return `${out.join('\n')}\n`;
}
