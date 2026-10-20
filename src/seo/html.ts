/*
 * Minimal HTML reading for build-time SEO generation (docs/SEO.md). The inputs are this
 * repository's own Prettier-formatted pages, so a few regular expressions are enough; this is not
 * a general HTML parser. Pure functions, no DOM: the module runs in Node (vite.seo.ts, tests).
 */

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode the named entities the pages use plus numeric references. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Escape text for an HTML attribute value or text node. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Phrasing elements: their tags vanish without a gap (`<a>링크</a>에` reads `링크에`). */
const INLINE_TAG =
  /<\/?(?:a|abbr|b|bdi|cite|code|data|dfn|em|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var)\b[^>]*>/gi;

/** Visible text of an HTML fragment: tags removed, entities decoded, whitespace collapsed. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(INLINE_TAG, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Inner HTML of the first `<name …>` element (to its first closing tag), or null. */
export function firstElement(html: string, name: string): string | null {
  const open = new RegExp(`<${name}(?:\\s[^>]*)?>`, 'i').exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = html.toLowerCase().indexOf(`</${name.toLowerCase()}`, start);
  return close < 0 ? null : html.slice(start, close);
}

/** Inner HTML of the first `<name … id="id" …>` element (to its first closing tag), or null. */
export function elementById(html: string, name: string, id: string): string | null {
  const open = new RegExp(`<${name}\\s[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = html.toLowerCase().indexOf(`</${name.toLowerCase()}`, start);
  return close < 0 ? null : html.slice(start, close);
}

/** `content` of `<meta name="…">` (attributes in any order, value may span lines). */
export function metaContent(html: string, name: string): string | null {
  for (const m of html.matchAll(/<meta\s([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (new RegExp(`\\bname="${name}"`).test(attrs)) {
      const c = /\bcontent="([^"]*)"/.exec(attrs);
      return c ? decodeEntities(c[1] ?? '') : null;
    }
  }
  return null;
}
