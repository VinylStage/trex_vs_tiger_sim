import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  MAX_WORK,
  SAMPLING_METHODS,
  PACK_TACTICS,
  defaultConfig,
  type ScenarioConfig,
} from '../src/sim/config';
import { CONSTANTS, DT } from '../src/sim/engine';
import { PARAMS } from '../src/sim/params';
import {
  DEFAULT_HEAVY,
  DEFAULT_PACK,
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  paramBounds,
  paramEvidence,
  presetRange,
  type HeavySpeciesId,
  type PackSpeciesId,
} from '../src/sim/species';
import {
  CONTENT_PAGES,
  NAV_LABEL_KEYS,
  NAV_PAGES,
  RELEASES_URL,
  pagePath,
  parsePagePath,
  type ContentPage,
  type PageId,
} from '../src/pages/routes';
import {
  DICTIONARIES,
  LANGS,
  interpolate,
  speciesVars,
  type Lang,
  type MsgKey,
} from '../src/ui/i18n';
import { PRESETS } from '../src/ui/form';
import { footerItems, siteNavItems } from '../src/ui/site-nav';
import {
  APP_LOGO_PLACEHOLDER,
  BRAND_TEXT_KEY,
  SITE_HEADER_PLACEHOLDER,
  SITE_LOGO,
  expandSiteHeader,
  headerRouteOf,
  renderSiteHeader,
} from '../src/pages/site-header';
import { expandPatchNotes } from '../src/pages/patch-notes-page';
import { findHtmlEntries } from '../vite.pages';

/*
 * Drift guard for the static content pages (docs/PAGES.md). The pages are hand-written HTML, so
 * this test re-checks them against the code: parameter values, SEO metadata, navigation, links,
 * the strict CSP (no inline code), _headers, the sitemap and the shared colour tokens.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/**
 * A page as the build and the dev server serve it: its source with the shared header and the
 * patch notes board filled in by the same functions vite.pages.ts runs (src/pages/site-header.ts,
 * src/pages/patch-notes-page.ts).
 */
const VERSION = (JSON.parse(read('package.json')) as { version: string }).version;
const readPage = (rel: string): string =>
  expandPatchNotes(
    expandSiteHeader(read(rel), headerRouteOf(`/${rel}`), rel),
    headerRouteOf(`/${rel}`),
    VERSION,
    rel,
  );
const sourceOf = (page: ContentPage, lang: Lang): string =>
  lang === 'ko' ? `${page}/index.html` : `en/${page}/index.html`;
const other = (lang: Lang): Lang => (lang === 'ko' ? 'en' : 'ko');

const PAGES = LANGS.flatMap((lang) =>
  CONTENT_PAGES.map((page) => ({
    page,
    lang,
    file: sourceOf(page, lang),
    html: readPage(sourceOf(page, lang)),
  })),
);

/** The simulator's two static entries: `index.html` (ko, `/`) and `en/index.html` (en, `/en/`). */
const appSourceOf = (lang: Lang): string => (lang === 'ko' ? 'index.html' : 'en/index.html');
const APP_PAGES = LANGS.map((lang) => ({
  page: 'simulator' as const,
  lang,
  file: appSourceOf(lang),
  html: readPage(appSourceOf(lang)),
}));

/** Every page with the shared site shell (static footer, i18n-bound text). */
const ALL_PAGES: readonly { page: PageId; lang: Lang; file: string; html: string }[] = [
  ...APP_PAGES,
  ...PAGES,
];

/** The not-found pages Cloudflare Pages serves for unknown URLs (`/…` and `/en/…`). */
const notFoundSourceOf = (lang: Lang): string => (lang === 'ko' ? '404.html' : 'en/404.html');
const NOT_FOUND_PAGES = LANGS.map((lang) => ({
  page: '404' as const,
  lang,
  file: notFoundSourceOf(lang),
  html: readPage(notFoundSourceOf(lang)),
}));

/** Every page with the shared shell: header or app header, static footer, i18n-bound text. */
const SHELL_PAGES: readonly { page: PageId | '404'; lang: Lang; file: string; html: string }[] = [
  ...ALL_PAGES,
  ...NOT_FOUND_PAGES,
];

/** Search-result limits used in docs/SEO.md: titles up to 60 characters, descriptions ~160. */
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 165;

// ---------- tiny HTML helpers (the pages are well-formed, Prettier-formatted HTML) ----------

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};
const decode = (s: string): string =>
  s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, e: string) => ENTITIES[e] ?? m);
const textOf = (html: string): string =>
  decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

interface Tag {
  name: string;
  attrs: Record<string, string>;
  /** Offset just after the start tag. */
  end: number;
}

const TAG_RE =
  /<([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function tags(html: string, name?: string): Tag[] {
  const out: Tag[] = [];
  for (const m of html.matchAll(TAG_RE)) {
    const tag = (m[1] ?? '').toLowerCase();
    if (name && tag !== name) continue;
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? '').matchAll(ATTR_RE)) {
      attrs[(a[1] ?? '').toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    }
    out.push({ name: tag, attrs, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Attributes and inner HTML of every `<name>` element. The inner HTML runs to the next
 * `</name>`, which is exact for elements that do not nest (cards, links, rows); an outer element
 * that contains others of its kind is cut short, and its children are listed separately.
 */
function elements(html: string, name: string): { attrs: Record<string, string>; inner: string }[] {
  return tags(html, name).map((t) => {
    const close = html.indexOf(`</${name}`, t.end);
    return { attrs: t.attrs, inner: html.slice(t.end, close < 0 ? html.length : close) };
  });
}

const VOID = new Set([
  'area',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
]);
const TOKEN_RE = /<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)\b[^>]*>|<!--[\s\S]*?-->|([^<]+)/g;

/**
 * The first element whose start tag matches, with nesting of its own tag name counted, so it is
 * exact for elements that contain others of their kind (`<div id="app">`, sections).
 */
function outerElement(
  html: string,
  match: (t: Tag) => boolean,
): { attrs: Record<string, string>; inner: string; outer: string; end: number } {
  const start = tags(html).find(match);
  expect(start, 'element').toBeDefined();
  const t = start as Tag;
  const open = html.lastIndexOf('<', t.end - 1);
  let depth = 1;
  const re = new RegExp(`<(/?)${t.name}\\b[^>]*>`, 'gi');
  re.lastIndex = t.end;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      return {
        attrs: t.attrs,
        inner: html.slice(t.end, m.index),
        outer: html.slice(open, m.index + m[0].length),
        end: m.index + m[0].length,
      };
    }
  }
  throw new Error(`unclosed <${t.name}>`);
}

/** Every non-blank text node of a fragment with the elements that enclose it (outermost first). */
function textNodes(html: string): { text: string; ancestors: Tag[] }[] {
  const out: { text: string; ancestors: Tag[] }[] = [];
  const stack: Tag[] = [];
  for (const m of html.matchAll(TOKEN_RE)) {
    if (m[1]) {
      const name = m[1].toLowerCase();
      const i = stack.map((s) => s.name).lastIndexOf(name);
      if (i >= 0) stack.length = i;
    } else if (m[2]) {
      const tag = tags(m[0])[0];
      if (tag && !VOID.has(tag.name) && !m[0].endsWith('/>')) stack.push(tag);
    } else if (m[3] && m[3].trim() !== '') {
      out.push({ text: textOf(m[3]), ancestors: [...stack] });
    }
  }
  return out;
}

const one = <T>(xs: readonly T[], what: string): T => {
  expect(xs, what).toHaveLength(1);
  return xs[0] as T;
};

const meta = (html: string, key: 'name' | 'property', value: string): string[] =>
  tags(html, 'meta')
    .filter((t) => t.attrs[key] === value)
    .map((t) => t.attrs['content'] ?? '');

const ids = (html: string): string[] =>
  tags(html)
    .map((t) => t.attrs['id'])
    .filter((v): v is string => v !== undefined);

const sectionIds = (html: string): string[] =>
  tags(html, 'section')
    .map((t) => t.attrs['id'])
    .filter((v): v is string => v !== undefined);

/** Number shown to readers, e.g. "5,650" → 5650. */
const shownNumber = (s: string): number => Number(textOf(s).replace(/[,\s]/g, ''));

// ---------- every HTML entry: strict CSP ----------

describe('every HTML page is CSP-safe', () => {
  const files = Object.values(findHtmlEntries(ROOT)).map((f) => relative(ROOT, f));

  it('includes the app, all content pages and both 404 pages', () => {
    expect(files).toContain('index.html');
    expect(files).toContain('en/index.html');
    for (const p of PAGES) expect(files).toContain(p.file);
    for (const p of NOT_FOUND_PAGES) expect(files).toContain(p.file);
  });

  it.each(files)('%s has no inline script, style block, style attribute or handler', (file) => {
    const html = readPage(file);
    for (const s of elements(html, 'script')) {
      expect(s.attrs['src'], `${file}: <script> without src`).toBeTruthy();
      expect(s.inner.trim(), `${file}: inline script body`).toBe('');
    }
    expect(html, `${file}: <style> block`).not.toMatch(/<style[\s>]/i);
    for (const t of tags(html)) {
      for (const attr of Object.keys(t.attrs)) {
        expect(attr, `${file}: <${t.name} ${attr}>`).not.toBe('style');
        expect(attr.startsWith('on'), `${file}: <${t.name} ${attr}> event handler`).toBe(false);
      }
      expect(t.attrs['href'] ?? '', `${file}: javascript: URL`).not.toMatch(/^\s*javascript:/i);
    }
  });
});

// ---------- content pages: metadata, structure, navigation, links ----------

describe.each(PAGES)('$file', ({ page, lang, html }) => {
  it('declares its language', () => {
    expect(one(tags(html, 'html'), '<html>').attrs['lang']).toBe(lang);
  });

  it('has a title and description of search-result length', () => {
    const title = one(elements(html, 'title'), '<title>').inner.trim();
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
    const description = one(meta(html, 'name', 'description'), 'meta description');
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('loads the shared stylesheet and script', () => {
    const links = tags(html, 'link');
    expect(
      links.some(
        (l) => l.attrs['rel'] === 'stylesheet' && l.attrs['href'] === '/src/pages/site.css',
      ),
    ).toBe(true);
    const script = one(tags(html, 'script'), '<script>');
    expect(script.attrs).toMatchObject({ type: 'module', src: '/src/pages/site.ts' });
  });

  it('is structured with header, nav, main, one h1, sections and footer', () => {
    expect(tags(html, 'header').length).toBeGreaterThanOrEqual(1);
    expect(one(tags(html, 'main'), '<main>').attrs['id']).toBe('main');
    expect(tags(html, 'h1')).toHaveLength(1);
    expect(tags(html, 'footer')).toHaveLength(1);
    expect(sectionIds(html).length).toBeGreaterThanOrEqual(5);
    const all = ids(html);
    expect(new Set(all).size, 'duplicate ids').toBe(all.length);
  });

  it('carries substantial text', () => {
    const main = one(elements(html, 'main'), '<main>').inner;
    expect(textOf(main).length).toBeGreaterThan(2500);
  });

  it('has the shared navigation in the same order and wording as the app', () => {
    const nav = one(
      elements(html, 'nav').filter((n) => n.attrs['class'] === 'site-nav'),
      'site nav',
    );
    expect(nav.attrs['aria-label']).toBe(DICTIONARIES[lang]['nav.label']);
    const links = elements(nav.inner, 'a').map((a) => ({
      page: a.attrs['data-page'],
      href: a.attrs['href'],
      label: textOf(a.inner),
    }));
    expect(links).toEqual(
      siteNavItems(lang, page).map(({ page: p, href, label }) => ({ page: p, href, label })),
    );
  });

  it('shows a breadcrumb from the app to this page, named like the navigation', () => {
    const d = DICTIONARIES[lang];
    const nav = one(
      elements(html, 'nav').filter((n) =>
        (n.attrs['class'] ?? '').split(/\s+/).includes('breadcrumb'),
      ),
      'breadcrumb',
    );
    expect(nav.attrs['aria-label']).toBe(d['breadcrumb.label']);
    const items = tags(nav.inner, 'li');
    expect(elements(nav.inner, 'li').map((li) => textOf(li.inner))).toEqual([
      d['app.shortTitle'],
      d[NAV_LABEL_KEYS[page]],
    ]);
    expect(tags(nav.inner, 'a').map((a) => a.attrs['href'])).toEqual([pagePath('simulator', lang)]);
    expect(items.map((li) => li.attrs['aria-current'] ?? null)).toEqual([null, 'page']);
  });

  it('links its counterpart in the other language', () => {
    const sw = one(
      tags(html, 'a').filter((a) => 'data-lang-switch' in a.attrs),
      'language link',
    );
    expect(sw.attrs['href']).toBe(pagePath(page, other(lang)));
    expect(sw.attrs['hreflang']).toBe(other(lang));
    expect(sw.attrs['lang']).toBe(other(lang));
  });

  it('uses the same section ids as its counterpart, so language switches keep the reader’s place', () => {
    expect(sectionIds(html)).toEqual(sectionIds(readPage(sourceOf(page, other(lang)))));
  });

  it('makes every table a focusable scroll region named by its caption', () => {
    const wraps = elements(html, 'div').filter((d) =>
      (d.attrs['class'] ?? '').split(/\s+/).includes('table-wrap'),
    );
    expect(wraps.length, 'every table sits in a .table-wrap').toBe(tags(html, 'table').length);
    for (const w of wraps) {
      const label = w.attrs['aria-labelledby'] ?? '';
      expect(w.attrs, label).toMatchObject({ role: 'region', tabindex: '0' });
      const caption = one(tags(w.inner, 'caption'), `caption in .table-wrap ${label}`);
      expect(caption.attrs['id'], 'aria-labelledby names the caption').toBe(label);
      expect(textOf(one(elements(w.inner, 'caption'), 'caption').inner).length).toBeGreaterThan(5);
    }
  });

  it('only links to pages and anchors that exist', () => {
    checkLinks(html, lang);
  });
});

/**
 * Every link of a page in `lang` goes to an existing page in the same language (the language
 * switch to the other one), in canonical form, to an existing `#anchor`, or to an https URL.
 */
function checkLinks(html: string, lang: Lang): void {
  const own = new Set(ids(html));
  for (const a of tags(html, 'a')) {
    const href = a.attrs['href'] ?? '';
    if (href.startsWith('#')) {
      expect(own.has(href.slice(1)), `${href} on this page`).toBe(true);
    } else if (href.startsWith('/')) {
      const [pathAndQuery = '', frag] = href.split('#');
      const [path = '', query] = pathAndQuery.split('?');
      const target = parsePagePath(path);
      expect(target, href).not.toBeNull();
      if (!target) continue;
      const expected = a.attrs['hreflang'] ?? ('data-lang-switch' in a.attrs ? other(lang) : lang);
      expect(target.lang, `${href}: link language`).toBe(expected);
      expect(path, `${href}: canonical form`).toBe(pagePath(target.page, target.lang));
      if (target.page === 'simulator') {
        expect(frag, href).toBeUndefined();
        if (query !== undefined) expect(query, `${href}: only the tour deep link`).toBe('tour=1');
        continue;
      }
      expect(query, `${href}: content pages take no query`).toBeUndefined();
      if (frag !== undefined) {
        expect(ids(readPage(sourceOf(target.page, lang))), href).toContain(frag);
      }
    } else {
      expect(href, 'external links use https').toMatch(/^https:\/\//);
    }
  }
}

describe('all pages as a set', () => {
  it('have unique titles and descriptions, the simulator included', () => {
    const titles = ALL_PAGES.map((p) => one(elements(p.html, 'title'), 'title').inner.trim());
    const descriptions = ALL_PAGES.map((p) =>
      one(meta(p.html, 'name', 'description'), 'description'),
    );
    expect(new Set(titles).size).toBe(ALL_PAGES.length);
    expect(new Set(descriptions).size).toBe(ALL_PAGES.length);
  });
});

// ---------- the simulator's static entries (/ and /en/) ----------

describe.each(APP_PAGES)('$file (simulator)', ({ lang, html }) => {
  const d = DICTIONARIES[lang];

  it('declares its language statically', () => {
    expect(one(tags(html, 'html'), '<html>').attrs['lang']).toBe(lang);
  });

  it('has the static title the app sets as document.title', () => {
    const title = decode(one(elements(html, 'title'), '<title>').inner.trim());
    expect(title).toBe(d['app.documentTitle']);
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
  });

  it('has a description of search-result length', () => {
    const description = one(meta(html, 'name', 'description'), 'description');
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('loads the app script; #app holds only the static header the app replaces', () => {
    const script = one(tags(html, 'script'), '<script>');
    expect(script.attrs).toMatchObject({ type: 'module', src: '/src/main.ts' });
    const app = outerElement(html, (t) => t.name === 'div' && t.attrs['id'] === 'app');
    const head = outerElement(app.inner, (t) => t.name === 'header');
    expect(head.attrs['class']).toBe('app-header app-static-head');
    expect(app.inner.replace(head.outer, '').trim()).toBe('');
  });

  it('has exactly one static <h1>, the app title, before any other heading', () => {
    const h1 = one(elements(html, 'h1'), '<h1>');
    expect(h1.attrs['data-i18n']).toBe('app.title');
    expect(textOf(h1.inner)).toBe(d['app.title']);
    expect(html.search(/<h1[\s>]/)).toBeLessThan(html.search(/<h[2-6][\s>]/));
    const head = outerElement(html, (t) => t.name === 'header');
    expect(head.inner).toContain('<h1');
  });

  it('links the other language statically, for crawlers that do not run JavaScript', () => {
    const sw = one(
      tags(html, 'a').filter((a) => 'data-lang-switch' in a.attrs),
      'language link',
    );
    expect(sw.attrs).toMatchObject({
      href: pagePath('simulator', other(lang)),
      hreflang: other(lang),
      lang: other(lang),
      'data-i18n': 'lang.switch',
    });
  });

  it('binds every piece of static text to a message key, so the in-place switch translates it', () => {
    const regions = [
      outerElement(html, (t) => t.attrs['class'] === 'app-header app-static-head'),
      outerElement(html, (t) => t.attrs['id'] === 'intro'),
      outerElement(html, (t) => t.attrs['id'] === 'faq'),
      outerElement(html, (t) => t.name === 'footer'),
    ];
    for (const r of regions) {
      for (const { text, ancestors } of textNodes(r.outer)) {
        // Footer links are rebuilt from FOOTER_LINKS (checked against footerItems below).
        const bound = ancestors.some((a) => 'data-i18n' in a.attrs || 'data-footer' in a.attrs);
        expect(bound, `unbound text “${text}”`).toBe(true);
      }
    }
  });

  it('uses the same message keys in the same order as the other language’s page', () => {
    const keysOf = (src: string): string[] =>
      tags(src).flatMap((t) =>
        (['data-i18n', 'data-i18n-aria', 'data-i18n-title'] as const)
          .filter((a) => a in t.attrs)
          .map((a) => `${a}=${t.attrs[a] ?? ''}`),
      );
    expect(keysOf(html)).toEqual(keysOf(readPage(appSourceOf(other(lang)))));
  });

  it('shows every intro and FAQ message exactly once', () => {
    const used = tags(html)
      .map((t) => t.attrs['data-i18n'])
      .filter((k): k is string => k !== undefined && /^(intro|faq)\./.test(k));
    const defined = Object.keys(d).filter((k) => /^(intro|faq)\./.test(k));
    expect([...used].sort()).toEqual([...defined].sort());
  });

  it('puts the intro, the FAQ and the footer after #app, outside it', () => {
    const at = (needle: string): number => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThan(0);
      return i;
    };
    const app = outerElement(html, (t) => t.name === 'div' && t.attrs['id'] === 'app').end;
    const intro = at('id="intro"');
    const faq = at('id="faq"');
    const footer = at('<footer class="site-footer"');
    expect(app).toBeLessThan(intro);
    expect(intro).toBeLessThan(faq);
    expect(faq).toBeLessThan(footer);
    expect(tags(html, 'footer')).toHaveLength(1);
    const all = ids(html);
    expect(new Set(all).size, 'duplicate ids').toBe(all.length);
  });

  it('answers what, how and what you learn, links the docs and the tour, and has a short FAQ', () => {
    const keys = tags(html)
      .map((t) => t.attrs['data-i18n'])
      .filter((k): k is string => k !== undefined);
    for (const k of [
      'intro.title',
      'intro.lead',
      'intro.howTitle',
      'intro.learnTitle',
      'faq.title',
    ]) {
      expect(keys).toContain(k);
    }
    expect(keys.filter((k) => /^intro\.how\d$/.test(k)).length).toBeGreaterThanOrEqual(3);
    expect(keys.filter((k) => /^intro\.how\d$/.test(k)).length).toBeLessThanOrEqual(4);
    const questions = keys.filter((k) => /^faq\.q\d$/.test(k));
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.length).toBeLessThanOrEqual(5);
    expect(keys.filter((k) => /^faq\.a\d$/.test(k))).toHaveLength(questions.length);

    const intro = tags(html, 'a').filter((a) => a.attrs['data-page'] !== undefined);
    expect(intro.map((a) => [a.attrs['data-page'], a.attrs['href']])).toEqual([
      ['guide', pagePath('guide', lang)],
      ['model', `${pagePath('model', lang)}#results`],
      ['parameters', pagePath('parameters', lang)],
      ['simulator', `${pagePath('simulator', lang)}?tour=1`],
    ]);
    for (const a of intro) {
      const suffix = a.attrs['data-href-suffix'] ?? '';
      expect(a.attrs['href'], 'href = page path + data-href-suffix').toBe(
        `${pagePath(a.attrs['data-page'] as PageId, lang)}${suffix}`,
      );
    }
    expect(intro.filter((a) => 'data-tour-start' in a.attrs)).toHaveLength(1);
    checkLinks(html, lang);
  });

  it('states only facts the code pins (the number of parameters)', () => {
    expect(d['intro.how1']).toContain(String(PARAMS.length));
  });
});

// ---------- 404 pages ----------

describe.each(NOT_FOUND_PAGES)('$file (not found)', ({ lang, html }) => {
  it('is a noindex page in its language with a unique short title and no canonical', () => {
    expect(one(tags(html, 'html'), '<html>').attrs['lang']).toBe(lang);
    expect(one(meta(html, 'name', 'robots'), 'robots')).toBe('noindex');
    const title = one(elements(html, 'title'), '<title>').inner.trim();
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
    const titles = ALL_PAGES.map((p) => one(elements(p.html, 'title'), 'title').inner.trim());
    expect(titles).not.toContain(title);
    expect(tags(html, 'link').filter((l) => l.attrs['rel'] === 'canonical')).toHaveLength(0);
  });

  it('has the site navigation, a link to the other language and links to the main pages', () => {
    const nav = one(
      elements(html, 'nav').filter((n) => n.attrs['class'] === 'site-nav'),
      'site nav',
    );
    expect(elements(nav.inner, 'a').map((a) => a.attrs['href'])).toEqual(
      siteNavItems(lang).map((i) => i.href),
    );
    const sw = one(
      tags(html, 'a').filter((a) => 'data-lang-switch' in a.attrs),
      'language link',
    );
    expect(sw.attrs['href']).toBe(pagePath('simulator', other(lang)));
    const main = one(elements(html, 'main'), '<main>').inner;
    const hrefs = tags(main, 'a').map((a) => a.attrs['href']);
    for (const p of ['simulator', 'guide', 'model', 'parameters', 'about'] as const) {
      expect(hrefs).toContain(pagePath(p, lang));
    }
    expect(hrefs).toContain(pagePath('simulator', other(lang)));
    checkLinks(html, lang);
  });

  it('loads the shared stylesheet and script with root-absolute URLs', () => {
    expect(one(tags(html, 'script'), '<script>').attrs['src']).toBe('/src/pages/site.ts');
    for (const t of tags(html)) {
      for (const attr of ['src', 'href']) {
        const v = t.attrs[attr];
        if (v !== undefined) expect(v, `${t.name} ${attr}`).toMatch(/^(\/|#|https:\/\/)/);
      }
    }
  });
});

// ---------- shared shell on every page: i18n-bound text, footer, brand ----------

/** Text of every element bound to a message key, with the binding attribute. */
function boundTexts(
  html: string,
): { key: string; kind: 'text' | 'aria' | 'title'; text: string }[] {
  const out: { key: string; kind: 'text' | 'aria' | 'title'; text: string }[] = [];
  for (const t of tags(html)) {
    const text = t.attrs['data-i18n'];
    if (text !== undefined) {
      const close = html.indexOf(`</${t.name}`, t.end);
      out.push({ key: text, kind: 'text', text: textOf(html.slice(t.end, close)) });
    }
    const aria = t.attrs['data-i18n-aria'];
    if (aria !== undefined)
      out.push({ key: aria, kind: 'aria', text: t.attrs['aria-label'] ?? '' });
    const title = t.attrs['data-i18n-title'];
    if (title !== undefined) out.push({ key: title, kind: 'title', text: t.attrs['title'] ?? '' });
  }
  return out;
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

describe.each(SHELL_PAGES)('$file shell', ({ page, lang, file, html }) => {
  const d: Readonly<Record<string, string>> = DICTIONARIES[lang];

  it('repeats the dictionary text exactly wherever text is bound to a message key', () => {
    const bound = boundTexts(html);
    expect(bound.length).toBeGreaterThan(5);
    for (const b of bound) {
      expect(Object.hasOwn(d, b.key), `unknown key ${b.key}`).toBe(true);
      expect(b.text, `${b.kind} ${b.key}`).toBe(norm(d[b.key] ?? ''));
    }
  });

  it('has the shared footer: disclaimer, links, version and notes', () => {
    const footer = one(elements(html, 'footer'), '<footer>');
    expect(one(tags(html, 'footer'), 'footer').attrs['class']).toBe('site-footer');
    const list = one(
      elements(footer.inner, 'ul').filter((u) => u.attrs['class'] === 'footer-links'),
      'ul.footer-links',
    );
    const links = elements(list.inner, 'a').map((a) => ({
      id: a.attrs['data-footer'],
      href: a.attrs['href'],
      label: textOf(a.inner),
      rel: a.attrs['rel'] ?? null,
    }));
    expect(links).toEqual(
      footerItems(lang).map(({ id, href, label, rel }) => ({ id, href, label, rel })),
    );
    const keys = boundTexts(footer.inner).map((b) => b.key);
    for (const k of ['footer.disclaimer', 'footer.local', 'footer.copyright', 'version.footer']) {
      expect(keys).toContain(k);
    }
    const version = one(
      tags(footer.inner, 'a').filter((a) => a.attrs['class'] === 'version-footer'),
      'a.version-footer',
    );
    expect(version.attrs['href']).toBe(RELEASES_URL);
    expect(tags(footer.inner, 'span').filter((x) => 'data-app-version' in x.attrs)).toHaveLength(1);
    expect(textOf(footer.inner)).not.toMatch(/추적 없음|no tracking/i);
  });

  it('has the static head every page shares; the generated SEO tags are not hand-written', () => {
    expect(meta(html, 'name', 'viewport')).toHaveLength(1);
    expect(meta(html, 'name', 'theme-color')).toHaveLength(2);
    const links = tags(html, 'link');
    const rels = (rel: string): Tag[] => links.filter((l) => l.attrs['rel'] === rel);
    expect(one(rels('icon'), 'icon').attrs['href']).toBe('/favicon.svg');
    expect(one(rels('apple-touch-icon'), 'apple-touch-icon').attrs['href']).toBe(
      '/apple-touch-icon.png',
    );
    expect(one(rels('manifest'), 'manifest').attrs['href']).toBe('/site.webmanifest');
    // canonical, hreflang, og:*, twitter:* and JSON-LD are generated (vite.seo.ts, tests/seo.test.ts)
    expect(rels('canonical')).toHaveLength(0);
    expect(rels('alternate')).toHaveLength(0);
    for (const t of tags(html, 'meta')) {
      expect(t.attrs['property'] ?? '', file).not.toMatch(/^og:/);
      expect(t.attrs['name'] ?? '', file).not.toMatch(/^twitter:/);
    }
  });

  it('names the site consistently', () => {
    if (page !== 'simulator') {
      const brand = one(
        elements(html, 'a').filter((a) => a.attrs['class'] === 'site-brand'),
        'brand',
      );
      expect(brand.attrs['href']).toBe(pagePath('simulator', lang));
      expect(textOf(brand.inner)).toBe(d['app.shortTitle']);
    }
  });
});

// ---------- the shared header (src/pages/site-header.ts): one logo everywhere ----------

describe('shared site header', () => {
  const RAW_SHELL = SHELL_PAGES.map((p) => ({ ...p, source: read(p.file) }));

  it.each(RAW_SHELL)(
    '$file takes its header from the shared module, never hand-written',
    ({ page, source }) => {
      if (page === 'simulator') {
        expect(source.split(APP_LOGO_PLACEHOLDER)).toHaveLength(2);
        expect(source).not.toContain(SITE_HEADER_PLACEHOLDER);
      } else {
        expect(source.split(SITE_HEADER_PLACEHOLDER)).toHaveLength(2);
        expect(source).not.toContain(APP_LOGO_PLACEHOLDER);
        expect(source).not.toContain('class="site-header"');
      }
      // No page source names a logo file itself: the logo is SITE_LOGO, filled in by the build.
      expect(tags(source, 'img').filter((i) => /logo|favicon/.test(i.attrs['src'] ?? ''))).toEqual(
        [],
      );
    },
  );

  it.each(SHELL_PAGES)(
    '$file shows the shared logo (src, size, alt) in its header',
    ({ page, html }) => {
      const header = one(
        elements(html, 'header').filter((h) =>
          /\b(site-header|app-static-head)\b/.test(h.attrs['class'] ?? ''),
        ),
        'header',
      );
      const img = one(tags(header.inner, 'img'), 'header logo');
      const size = String(SITE_LOGO.size[page === 'simulator' ? 'app' : 'page']);
      expect(img.attrs).toMatchObject({
        src: SITE_LOGO.src,
        alt: SITE_LOGO.alt,
        width: size,
        height: size,
      });
    },
  );

  it('uses one logo file on every page, the app header included', () => {
    const logos = new Set(
      SHELL_PAGES.flatMap(({ html }) =>
        elements(html, 'header').flatMap((h) => tags(h.inner, 'img').map((i) => i.attrs['src'])),
      ),
    );
    expect([...logos]).toEqual([SITE_LOGO.src]);
    // The app builds its header from the same constant (logoAttrs), not from a literal path.
    const app = read('src/ui/app.ts');
    expect(app).toContain("logoAttrs('app')");
    expect(app).not.toMatch(/['"]\/(?:header-logo|favicon)\.svg['"]/);
  });

  it.each(SHELL_PAGES.filter((p) => p.page !== 'simulator'))(
    '$file has exactly the rendered header: brand, nav, language link',
    ({ page, lang, html }) => {
      const current = page === '404' ? null : page;
      const header = outerElement(html, (t) => t.name === 'header');
      expect(header.outer).toBe(renderSiteHeader(lang, current));
      const brand = one(
        elements(header.inner, 'a').filter((a) => a.attrs['class'] === 'site-brand'),
        'brand',
      );
      expect(textOf(brand.inner)).toBe(DICTIONARIES[lang][BRAND_TEXT_KEY]);
      const marked = tags(header.inner, 'a').filter((a) => a.attrs['aria-current'] === 'page');
      expect(marked.map((a) => a.attrs['data-page'])).toEqual(
        current && NAV_PAGES.includes(current) ? [current] : [],
      );
    },
  );
});

// ---------- license pages ----------

describe.each(LANGS)('license page (%s)', (lang) => {
  const html = read(sourceOf('license', lang));
  // The HTML parser drops one newline right after <pre> (Prettier puts the text on its own line).
  const pre = (id: string): string =>
    decode(
      one(
        elements(html, 'pre').filter((p) => p.attrs['id'] === id),
        id,
      ).inner.replace(/^\n/, ''),
    );
  const file = (rel: string): string => read(rel).replace(/\r\n/g, '\n').trimEnd();

  it('quotes the MIT License exactly as in LICENSE', () => {
    expect(pre('mit-text')).toBe(file('LICENSE'));
  });

  it('quotes the Pretendard license exactly as shipped with the font', () => {
    expect(pre('ofl-text')).toBe(file('src/assets/fonts/pretendard/LICENSE.txt'));
    expect(textOf(html)).toContain('SIL Open Font License');
    expect(textOf(html)).toContain(
      "Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name 'Pretendard'.",
    );
  });

  it('ships no runtime dependency that would need a notice', () => {
    const pkg = JSON.parse(read('package.json')) as Record<string, unknown>;
    expect(pkg['dependencies'] ?? {}).toEqual({});
  });
});

// ---------- privacy pages: every stored key is disclosed ----------

/** Every `'trexsim.*'` string literal in src/: the site's localStorage/sessionStorage keys. */
function storageKeys(): string[] {
  const keys = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.ts$/.test(e.name)) {
        for (const m of read(rel).matchAll(/['"`](trexsim\.[\w.-]+)['"`]/g)) keys.add(m[1] ?? '');
      }
    }
  };
  walk('src');
  return [...keys].sort();
}

describe('privacy pages list the real storage keys', () => {
  const keys = storageKeys();

  it('finds the storage keys in the code', () => {
    // trexsim.lang is only deleted (src/pages/legacy-storage.ts); the privacy pages say so.
    expect(keys).toEqual(['trexsim.lang', 'trexsim.tour']);
  });

  it.each(LANGS)('%s: names every key and no other', (lang) => {
    const html = read(sourceOf('privacy', lang));
    for (const k of keys) expect(html, k).toContain(`<code>${k}</code>`);
    const named = [...html.matchAll(/<code>(trexsim\.[\w.-]+)<\/code>/g)].map((m) => m[1]);
    expect([...new Set(named)].sort()).toEqual(keys);
  });
});

// ---------- parameter pages: values must match the code ----------

const dataValues = (html: string): { k: string; value: string; shown: string }[] =>
  elements(html, 'data').map((d) => ({
    k: d.attrs['data-k'] ?? '',
    value: d.attrs['value'] ?? '',
    shown: d.inner,
  }));

function numberFacts(html: string, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of dataValues(html)) {
    if (!keys.includes(d.k)) continue;
    expect(out[d.k], `duplicate ${d.k}`).toBeUndefined();
    const n = Number(d.value);
    expect(Number.isFinite(n), `${d.k}="${d.value}"`).toBe(true);
    expect(shownNumber(d.shown), `${d.k}: shown "${textOf(d.shown)}" vs value ${d.value}`).toBe(n);
    out[d.k] = n;
  }
  return out;
}

describe.each(LANGS)('parameters page (%s)', (lang) => {
  const html = read(sourceOf('parameters', lang));
  const sections = elements(html, 'section');

  it('documents exactly the parameters in src/sim/params.ts', () => {
    const documented = sections.map((s) => s.attrs['data-param']).filter((v) => v !== undefined);
    expect(documented).toEqual(PARAMS.map((p) => p.id));
  });

  it.each(PARAMS.map((p) => [p.id, p] as const))('%s matches the code', (_, p) => {
    const s = one(
      sections.filter((x) => x.attrs['data-param'] === p.id),
      p.id,
    );
    expect(s.attrs['id']).toBe(`param-${p.id}`);
    expect(s.attrs['data-unit']).toBe(p.unit);
    expect(s.attrs['class']).toContain(`role-${p.role}`);
    expect(textOf(one(elements(s.inner, 'h3'), 'h3').inner)).toContain(
      DICTIONARIES[lang][`param.${p.id}`],
    );
    expect(numberFacts(s.inner, ['min', 'mode', 'max', 'lo', 'hi'])).toEqual({
      // The page documents the default species (T. rex and tiger); docs/SPECIES.md the others.
      min: presetRange(p.id, DEFAULT_HEAVY, DEFAULT_PACK).min,
      mode: presetRange(p.id, DEFAULT_HEAVY, DEFAULT_PACK).mode,
      max: presetRange(p.id, DEFAULT_HEAVY, DEFAULT_PACK).max,
      lo: paramBounds(p.id, DEFAULT_HEAVY, DEFAULT_PACK)[0],
      hi: paramBounds(p.id, DEFAULT_HEAVY, DEFAULT_PACK)[1],
    });
    const individual = dataValues(s.inner).filter((d) => d.k === 'individual');
    expect(one(individual, 'individual').value).toBe(String(p.individual));
  });

  const d = defaultConfig();
  const keys = (Object.keys(d) as (keyof ScenarioConfig)[]).filter((k) => k !== 'params');
  const choices: Partial<Record<keyof ScenarioConfig, readonly string[]>> = {
    sampling: SAMPLING_METHODS,
    packTactic: PACK_TACTICS,
    heavySpecies: HEAVY_SPECIES_IDS,
    packSpecies: PACK_SPECIES_IDS,
    morale: ['true', 'false'],
  };

  it('documents every scenario setting', () => {
    const documented = sections.map((s) => s.attrs['data-setting']).filter((v) => v !== undefined);
    expect([...documented].sort()).toEqual([...keys].sort());
  });

  it.each(keys)('setting %s matches the code', (key) => {
    const s = one(
      sections.filter((x) => x.attrs['data-setting'] === key),
      key,
    );
    expect(s.attrs['id']).toBe(`setting-${key}`);
    expect(textOf(one(elements(s.inner, 'h3'), 'h3').inner)).toContain(
      // Labels name the species; the page describes the default pair (T. rex and tigers).
      interpolate(
        DICTIONARIES[lang][`field.${key}` as MsgKey],
        speciesVars({ heavySpecies: DEFAULT_HEAVY, packSpecies: DEFAULT_PACK }, lang),
      ),
    );
    const options = choices[key];
    if (options) {
      const facts = dataValues(s.inner);
      expect(
        one(
          facts.filter((f) => f.k === 'default'),
          'default',
        ).value,
      ).toBe(String(d[key]));
      expect(facts.filter((f) => f.k === 'option').map((f) => f.value)).toEqual([...options]);
    } else {
      const [lo, hi] = LIMITS[key as keyof typeof LIMITS];
      expect(numberFacts(s.inner, ['default', 'lo', 'hi'])).toEqual({ default: d[key], lo, hi });
    }
  });

  it('states the work budget', () => {
    const budget = dataValues(html).filter((f) => f.k === 'maxWork');
    expect(one(budget, 'maxWork').value).toBe(String(MAX_WORK));
  });

  it('lists every species preset with its evidence tag and constants (src/sim/species.ts)', () => {
    const presets = elements(html, 'data').filter((d) => d.attrs['data-k'] === 'preset');
    const expected: string[] = [];
    for (const [role, ids] of [
      ['heavy', HEAVY_SPECIES_IDS],
      ['pack', PACK_SPECIES_IDS],
    ] as const) {
      for (const p of PARAMS.filter((x) => x.role === role)) {
        for (const id of ids) {
          const h = role === 'heavy' ? (id as HeavySpeciesId) : DEFAULT_HEAVY;
          const pk = role === 'pack' ? (id as PackSpeciesId) : DEFAULT_PACK;
          const r = presetRange(p.id, h, pk);
          expected.push(`${id} ${p.id} ${r.min} ${r.mode} ${r.max} ${paramEvidence(p.id, h, pk)}`);
        }
      }
    }
    const documented = presets.map((d) => {
      const [min, mode, max] = (d.attrs['value'] ?? '').split(' ').map(Number);
      expect(textOf(d.inner).split(' · ').map(shownNumber)).toEqual([min, mode, max]);
      return `${d.attrs['data-species']} ${d.attrs['data-param']} ${min} ${mode} ${max} ${d.attrs['data-ev']}`;
    });
    expect([...documented].sort()).toEqual([...expected].sort());
    const facts = (k: string): Record<string, string> =>
      Object.fromEntries(
        elements(html, 'data')
          .filter((d) => d.attrs['data-k'] === k)
          .map((d) => [d.attrs['data-species'] ?? '', d.attrs['value'] ?? '']),
      );
    expect(facts('hide')).toEqual(
      Object.fromEntries(
        HEAVY_SPECIES_IDS.map((id) => [id, String(HEAVY_SPECIES[id].constants.hide)]),
      ),
    );
    expect(facts('intimidation')).toEqual(
      Object.fromEntries(
        HEAVY_SPECIES_IDS.map((id) => [id, String(HEAVY_SPECIES[id].constants.intimidation)]),
      ),
    );
    expect(facts('weapon')).toEqual(
      Object.fromEntries(HEAVY_SPECIES_IDS.map((id) => [id, HEAVY_SPECIES[id].weapon])),
    );
    expect(facts('radius')).toEqual(
      Object.fromEntries(
        PACK_SPECIES_IDS.map((id) => [id, String(PACK_SPECIES[id].constants.radius)]),
      ),
    );
  });

  it('states the widened bounds of the other species as in src/sim/species.ts', () => {
    // Every non-default species shares one set of widened bounds; the prose names exactly the
    // ends that differ from the T. rex/tiger (v1) bounds.
    const wide = (id: (typeof PARAMS)[number]['id']): readonly [number, number] =>
      paramBounds(id, 'elephant', 'lion');
    // Heavy hominins have their own, wider bounds (checked below).
    const ordinaryHeavies = HEAVY_SPECIES_IDS.filter(
      (s) => s !== DEFAULT_HEAVY && !HEAVY_SPECIES[s].hominin,
    );
    for (const p of PARAMS) {
      for (const h of ordinaryHeavies) {
        for (const pk of PACK_SPECIES_IDS.filter((s) => s !== DEFAULT_PACK)) {
          expect(paramBounds(p.id, h, pk), `${h}/${pk} ${p.id}`).toEqual(wide(p.id));
        }
      }
    }
    const expected: string[] = [];
    for (const p of PARAMS) {
      const v1 = paramBounds(p.id, DEFAULT_HEAVY, DEFAULT_PACK);
      const w = wide(p.id);
      if (w[0] !== v1[0]) expected.push(`${p.id} lo ${w[0]}`);
      if (w[1] !== v1[1]) expected.push(`${p.id} hi ${w[1]}`);
    }
    const stated = dataValues(html)
      .filter((d) => d.k === 'wide')
      .map((d) => {
        expect(shownNumber(d.shown)).toBe(Number(d.value));
        return d;
      });
    const named = elements(html, 'data')
      .filter((d) => d.attrs['data-k'] === 'wide')
      .map((d) => `${d.attrs['data-param']} ${d.attrs['data-end']} ${Number(d.attrs['value'])}`);
    expect(stated).toHaveLength(named.length);
    expect([...named].sort()).toEqual([...expected].sort());
  });

  it('states the hominin bounds that differ from the widened ones', () => {
    const hominins = HEAVY_SPECIES_IDS.filter((s) => HEAVY_SPECIES[s].hominin);
    expect(hominins.length).toBeGreaterThan(0);
    for (const h of hominins) {
      const expected: string[] = [];
      for (const p of PARAMS.filter((x) => x.role === 'heavy')) {
        const own = paramBounds(p.id, h, DEFAULT_PACK);
        const w = paramBounds(p.id, 'elephant', DEFAULT_PACK);
        if (own[0] !== w[0]) expected.push(`${p.id} lo ${own[0]}`);
        if (own[1] !== w[1]) expected.push(`${p.id} hi ${own[1]}`);
      }
      const named = elements(html, 'data')
        .filter((d) => d.attrs['data-k'] === 'hominin')
        .map((d) => {
          expect(shownNumber(textOf(d.inner))).toBe(Number(d.attrs['value']));
          return `${d.attrs['data-param']} ${d.attrs['data-end']} ${Number(d.attrs['value'])}`;
        });
      expect([...named].sort()).toEqual([...expected].sort());
    }
  });

  it('lists engine constants with their code values', () => {
    const rows = tags(html, 'tr').filter((t) => t.attrs['data-constant'] !== undefined);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const values: Readonly<Record<string, number>> = { ...CONSTANTS, DT };
    for (const row of elements(html, 'tr').filter((r) => r.attrs['data-constant'])) {
      const name = row.attrs['data-constant'] ?? '';
      expect(Object.hasOwn(values, name), `unknown constant ${name}`).toBe(true);
      expect(numberFacts(row.inner, ['value'])).toEqual({ value: values[name] });
    }
  });
});

describe.each(LANGS)('guide page (%s)', (lang) => {
  it('lists the matchup presets of src/ui/form.ts in order', () => {
    const html = read(sourceOf('guide', lang));
    const rows = elements(html, 'tr').filter((r) => r.attrs['data-heavy'] !== undefined);
    expect(
      rows.map((r) => {
        const facts = Object.fromEntries(
          elements(r.inner, 'data').map((d) => {
            expect(shownNumber(d.inner)).toBe(Number(d.attrs['value']));
            return [d.attrs['data-k'], Number(d.attrs['value'])];
          }),
        );
        return {
          heavySpecies: r.attrs['data-heavy'],
          packSpecies: r.attrs['data-pack'],
          heavyCount: facts['heavyCount'],
          packCount: facts['packCount'],
          runs: facts['runs'],
        };
      }),
    ).toEqual(PRESETS.map((p) => ({ ...p })));
  });
});

// ---------- shared design tokens ----------

function tokens(css: string, dark: boolean): Map<string, string> {
  const block = dark
    ? /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)
    : /^:root\s*\{([^}]*)\}/m.exec(css);
  const out = new Map<string, string>();
  for (const m of (block?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1] ?? '', (m[2] ?? '').replace(/\s+/g, ' ').trim());
  }
  return out;
}

describe('src/pages/site.css', () => {
  const site = read('src/pages/site.css');
  const app = read('src/ui/styles.css');

  it.each([false, true])('mirrors the app colour tokens (dark: %s)', (dark) => {
    const mine = tokens(site, dark);
    const theirs = tokens(app, dark);
    expect(mine.size).toBeGreaterThan(10);
    for (const [name, value] of mine)
      expect(`${name}: ${value}`).toBe(`${name}: ${theirs.get(name)}`);
  });

  /*
   * Text colour / background pairs the page rules use (docs/PAGES.md#colour-contrast). All are
   * normal-size text, so WCAG 2.x AA needs 4.5:1. Colours resolve through var() against the
   * light or dark :root tokens plus the page-only roles in the top-level `html { }` block.
   */
  const PAIRS: readonly (readonly [text: string, background: string, where: string])[] = [
    ['--fg', '--bg', 'body text'],
    ['--fg', '--surface', 'cards, notes, tables, header'],
    ['--fg', '--surface-2', 'table heads, code, current nav item'],
    ['--muted', '--bg', 'lead, page meta, footer'],
    ['--muted', '--surface', 'captions, fact labels, nav links'],
    ['--muted', '--surface-2', 'tags'],
    ['--accent-text', '--bg', 'links, eyebrow'],
    ['--accent-text', '--surface', 'links in cards and notes, parameter chips, TOC hover'],
    ['--accent-text', '--surface-2', 'code inside links'],
    ['--accent-fill-fg', '--accent-fill', 'button, skip link, step numbers'],
    ['--accent-fill-fg', '--accent-fill-hover', 'button hover'],
    ['--warn-fg', '--warn-bg', 'warning text and its links, speculative tag'],
  ];

  function palette(dark: boolean): Map<string, string> {
    const vars = tokens(site, false);
    if (dark) for (const [name, value] of tokens(site, true)) vars.set(name, value);
    for (const block of site.matchAll(/^html\s*\{([^}]*)\}/gm)) {
      for (const m of (block[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        vars.set(m[1] ?? '', (m[2] ?? '').trim());
      }
    }
    return vars;
  }

  function colour(vars: ReadonlyMap<string, string>, name: string): string {
    let value = vars.get(name) ?? '';
    for (let hops = 0; hops < 5; hops++) {
      const ref = /^var\((--[\w-]+)\)$/.exec(value);
      if (!ref) break;
      value = vars.get(ref[1] ?? '') ?? '';
    }
    expect(value, `${name} resolves to #rrggbb`).toMatch(/^#[0-9a-f]{6}$/i);
    return value;
  }

  it.each(
    [false, true].flatMap((dark) => PAIRS.map(([text, bg, where]) => ({ dark, text, bg, where }))),
  )('$text on $bg ($where) meets 4.5:1 (dark: $dark)', ({ dark, text, bg }) => {
    const vars = palette(dark);
    expect(contrastRatio(colour(vars, text), colour(vars, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#2a78d6', '#f7f6f3')).toBeCloseTo(4.09, 2);
    expect(contrastRatio('#ffffff', '#256abf')).toBeCloseTo(5.39, 2);
  });
});

/** WCAG 2.x contrast ratio of two `#rrggbb` colours (1 to 21). */
function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const channel = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// ---------- deployment files ----------

/** Minimal Cloudflare Pages `_headers` matcher: splat `*` = any characters, `:name` = one segment. */
function headersFor(src: string, path: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let matches = false;
  for (const line of src.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/:[A-Za-z]\w*/g, '[^/]+');
      matches = new RegExp(`^${pattern}$`).test(path);
    } else if (matches) {
      const [name = '', ...rest] = line.trim().split(':');
      (out[name.toLowerCase()] ??= []).push(rest.join(':').trim());
    }
  }
  return out;
}

describe('English pages mark Korean words (WCAG 3.1.2 language of parts, #71)', () => {
  it.each(SHELL_PAGES.filter((p) => p.lang === 'en').map((p) => [p.file, p.html] as const))(
    '%s',
    (_file, html) => {
      const body = (/<body[\s\S]*<\/body>/.exec(html)?.[0] ?? '').replace(
        /<script[\s\S]*?<\/script>/g,
        '',
      );
      // Drop every element marked lang="ko" (none of them nest another element of the same tag).
      const unmarked = body.replace(/<(\w+)[^>]*\blang="ko"[^>]*>[\s\S]*?<\/\1>/g, '');
      const text = unmarked.replace(/<[^>]*>/g, ' ');
      expect(text.match(/[가-힣]+/g) ?? []).toEqual([]);
    },
  );
});

describe('public/site.webmanifest', () => {
  it('writes name, short name and description in its declared language (#71)', () => {
    const m = JSON.parse(read('public/site.webmanifest')) as Record<string, string>;
    expect(m['lang']).toBe('ko');
    for (const k of ['name', 'short_name', 'description']) {
      expect(m[k], k).toMatch(/[가-힣]/);
      expect(m[k], k).not.toMatch(/\b(the|and|on|in|your)\b/i);
    }
  });
});

describe('public/_headers', () => {
  const src = read('public/_headers');
  const htmlPaths = ALL_PAGES.map((p) => pagePath(p.page, p.lang));

  it.each(htmlPaths)('%s gets the CSP and exactly one no-cache, no-transform', (path) => {
    const h = headersFor(src, path);
    expect(h['content-security-policy']).toHaveLength(1);
    expect(h['cache-control']).toEqual(['no-cache, no-transform']);
  });

  it('never stores /reset/ and clears cache and storage there, not cookies', () => {
    const h = headersFor(src, '/reset/');
    expect(h['content-security-policy']).toHaveLength(1);
    expect(h['cache-control']?.join(', ')).toBe('no-cache, no-transform, no-store');
    expect(h['clear-site-data']).toEqual(['"cache", "storage"']);
    expect(headersFor(src, '/version.json')['cache-control']).toEqual(['no-store']);
  });

  it('sends HSTS once everywhere, scoped to this host (no includeSubDomains, no preload)', () => {
    for (const path of ['/', '/en/', '/reset/', '/version.json', '/assets/a.js', '/nope']) {
      expect(headersFor(src, path)['strict-transport-security'], path).toEqual([
        'max-age=31536000',
      ]);
    }
  });

  it('enforces Trusted Types with only the worker policy', () => {
    const [csp] = headersFor(src, '/')['content-security-policy'] ?? [];
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toMatch(/trusted-types sim-worker(;|$)/);
  });

  it('sends the CSP on unknown paths, where the 404 pages are served', () => {
    for (const path of ['/nope', '/en/nope', '/a/b/c', '/404.html']) {
      expect(headersFor(src, path)['content-security-policy'], path).toHaveLength(1);
    }
  });

  it('keeps long-lived caching on hashed assets', () => {
    expect(headersFor(src, '/assets/site-abc123.js')['cache-control']).toEqual([
      'public, max-age=31536000, immutable',
    ]);
  });
});

// ---------- neutral outcome wording (CONTRIBUTING.md content rules, docs/SPECIES.md §9) ----------

/**
 * Death words for simulation states. `(?<!가)` skips 가죽 (hide); the English words are whole
 * words only. Quoted field records (`#matchup-*` sections of the model page) may keep them.
 */
const DEATH_WORDS =
  /(?<!가)죽[은을는지기음었]|사망|\b(?:dead|killed|kills?|died|dies|die)\b|to the death/i;

const withoutFieldRecords = (html: string): string =>
  html.replace(/<section id="matchup-[^"]*">[\s\S]*?<\/section>/g, '');

describe('neutral outcome wording', () => {
  it.each(SHELL_PAGES.map((p) => [p.file, p] as const))('%s uses no death words', (_, p) => {
    const text = textOf(withoutFieldRecords(p.html));
    expect(DEATH_WORDS.exec(text)?.[0] ?? null).toBeNull();
  });

  it.each(LANGS)('the %s dictionary uses no death words', (lang) => {
    // Placeholder names such as `{dead}` are code, not text.
    const hits = Object.entries(DICTIONARIES[lang]).filter(([, v]) =>
      DEATH_WORDS.test(v.replace(/\{\w+\}/g, '')),
    );
    expect(hits).toEqual([]);
  });

  it('still recognises the words it rejects, and allows 가죽 (hide)', () => {
    for (const s of [
      '죽은 호랑이',
      '사망',
      'tigers killed',
      'a dead tiger',
      'fight to the death',
    ]) {
      expect(DEATH_WORDS.test(s), s).toBe(true);
    }
    for (const s of ['가죽은 두껍다', '가죽을', 'wolf skills', 'diet', 'incapacitated']) {
      expect(DEATH_WORDS.test(s), s).toBe(false);
    }
  });
});
