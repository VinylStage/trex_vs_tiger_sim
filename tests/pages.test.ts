import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  MAX_WORK,
  SAMPLING_METHODS,
  TIGER_TACTICS,
  defaultConfig,
  type ScenarioConfig,
} from '../src/sim/config';
import { CONSTANTS, DT } from '../src/sim/engine';
import { PARAMS } from '../src/sim/params';
import {
  CONTENT_PAGES,
  SITE_ORIGIN,
  canonicalUrl,
  pagePath,
  parsePagePath,
  type ContentPage,
} from '../src/pages/routes';
import { DICTIONARIES, LANGS, type Lang, type MsgKey } from '../src/ui/i18n';
import { siteNavItems } from '../src/ui/site-nav';
import { findHtmlEntries } from '../vite.pages';

/*
 * Drift guard for the static content pages (docs/PAGES.md). The pages are hand-written HTML, so
 * this test re-checks them against the code: parameter values, SEO metadata, navigation, links,
 * the strict CSP (no inline code), _headers, the sitemap and the shared colour tokens.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const sourceOf = (page: ContentPage, lang: Lang): string =>
  lang === 'ko' ? `${page}/index.html` : `en/${page}/index.html`;
const other = (lang: Lang): Lang => (lang === 'ko' ? 'en' : 'ko');

const PAGES = LANGS.flatMap((lang) =>
  CONTENT_PAGES.map((page) => ({
    page,
    lang,
    file: sourceOf(page, lang),
    html: read(sourceOf(page, lang)),
  })),
);

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

  it('includes the app and all content pages', () => {
    expect(files).toContain('index.html');
    for (const p of PAGES) expect(files).toContain(p.file);
  });

  it.each(files)('%s has no inline script, style block, style attribute or handler', (file) => {
    const html = read(file);
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

  it('has a title, description, canonical URL and hreflang alternates', () => {
    const title = one(elements(html, 'title'), '<title>').inner.trim();
    expect(title.length).toBeGreaterThan(10);
    const description = one(meta(html, 'name', 'description'), 'meta description');
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(320);

    const links = tags(html, 'link');
    const canonical = one(
      links.filter((l) => l.attrs['rel'] === 'canonical'),
      'canonical',
    );
    expect(canonical.attrs['href']).toBe(canonicalUrl(page, lang));
    const alternates = Object.fromEntries(
      links
        .filter((l) => l.attrs['rel'] === 'alternate')
        .map((l) => [l.attrs['hreflang'], l.attrs['href']]),
    );
    expect(alternates).toEqual({
      ko: canonicalUrl(page, 'ko'),
      en: canonicalUrl(page, 'en'),
      'x-default': canonicalUrl(page, 'ko'),
    });
  });

  it('has Open Graph, Twitter, theme-colour, viewport and favicon tags', () => {
    expect(one(meta(html, 'property', 'og:url'), 'og:url')).toBe(canonicalUrl(page, lang));
    expect(one(meta(html, 'property', 'og:title'), 'og:title')).toBe(
      decode(one(elements(html, 'title'), '<title>').inner.trim()),
    );
    expect(one(meta(html, 'property', 'og:description'), 'og:description')).toBe(
      one(meta(html, 'name', 'description'), 'description'),
    );
    expect(one(meta(html, 'property', 'og:locale'), 'og:locale')).toBe(
      lang === 'ko' ? 'ko_KR' : 'en_US',
    );
    expect(one(meta(html, 'name', 'twitter:card'), 'twitter:card')).toBe('summary');
    expect(meta(html, 'name', 'twitter:title')).toHaveLength(1);
    expect(meta(html, 'name', 'twitter:description')).toHaveLength(1);
    expect(meta(html, 'name', 'theme-color')).toHaveLength(2);
    expect(meta(html, 'name', 'viewport')).toHaveLength(1);
    expect(tags(html, 'link').some((l) => l.attrs['rel'] === 'icon')).toBe(true);
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
    expect(sectionIds(html)).toEqual(sectionIds(read(sourceOf(page, other(lang)))));
  });

  it('only links to pages and anchors that exist', () => {
    const own = new Set(ids(html));
    for (const a of tags(html, 'a')) {
      const href = a.attrs['href'] ?? '';
      if (href.startsWith('#')) {
        expect(own.has(href.slice(1)), `${href} on this page`).toBe(true);
      } else if (href.startsWith('/')) {
        const [path = '', frag] = href.split('#');
        const target = parsePagePath(path);
        expect(target, href).not.toBeNull();
        if (!target || target.page === 'simulator') {
          expect(path, href).toBe('/');
          expect(frag, href).toBeUndefined();
          continue;
        }
        expect(path, `${href}: canonical form`).toBe(pagePath(target.page, target.lang ?? 'ko'));
        const expected = 'data-lang-switch' in a.attrs ? other(lang) : lang;
        expect(target.lang, `${href}: link language`).toBe(expected);
        if (frag !== undefined) {
          expect(ids(read(sourceOf(target.page, lang))), href).toContain(frag);
        }
      } else {
        expect(href, 'external links use https').toMatch(/^https:\/\//);
      }
    }
  });
});

describe('content pages as a set', () => {
  it('have unique titles and descriptions', () => {
    const titles = PAGES.map((p) => one(elements(p.html, 'title'), 'title').inner.trim());
    const descriptions = PAGES.map((p) => one(meta(p.html, 'name', 'description'), 'description'));
    expect(new Set(titles).size).toBe(PAGES.length);
    expect(new Set(descriptions).size).toBe(PAGES.length);
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
    expect(s.attrs['class']).toContain(`species-${p.species}`);
    expect(textOf(one(elements(s.inner, 'h3'), 'h3').inner)).toContain(
      DICTIONARIES[lang][`param.${p.id}`],
    );
    expect(numberFacts(s.inner, ['min', 'mode', 'max', 'lo', 'hi'])).toEqual({
      min: p.default.min,
      mode: p.default.mode,
      max: p.default.max,
      lo: p.bounds[0],
      hi: p.bounds[1],
    });
    const individual = dataValues(s.inner).filter((d) => d.k === 'individual');
    expect(one(individual, 'individual').value).toBe(String(p.individual));
  });

  const d = defaultConfig();
  const keys = (Object.keys(d) as (keyof ScenarioConfig)[]).filter((k) => k !== 'params');
  const choices: Partial<Record<keyof ScenarioConfig, readonly string[]>> = {
    sampling: SAMPLING_METHODS,
    tigerTactic: TIGER_TACTICS,
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
      DICTIONARIES[lang][`field.${key}` as MsgKey],
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
});

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

describe('public/_headers', () => {
  const src = read('public/_headers');
  const htmlPaths = ['/', ...PAGES.map((p) => pagePath(p.page, p.lang))];

  it.each(htmlPaths)('%s gets the CSP and exactly one no-cache, no-transform', (path) => {
    const h = headersFor(src, path);
    expect(h['content-security-policy']).toHaveLength(1);
    expect(h['cache-control']).toEqual(['no-cache, no-transform']);
  });

  it('keeps long-lived caching on hashed assets', () => {
    expect(headersFor(src, '/assets/site-abc123.js')['cache-control']).toEqual([
      'public, max-age=31536000, immutable',
    ]);
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('allows crawling and points at the sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it('lists the app and every page with hreflang alternates', () => {
    const xml = read('public/sitemap.xml');
    const urls = elements(xml, 'url').map((u) => ({
      loc: textOf(one(elements(u.inner, 'loc'), 'loc').inner),
      alternates: Object.fromEntries(
        tags(u.inner, 'xhtml:link').map((l) => [l.attrs['hreflang'], l.attrs['href']]),
      ),
    }));
    expect(urls.map((u) => u.loc).sort()).toEqual(
      [`${SITE_ORIGIN}/`, ...PAGES.map((p) => canonicalUrl(p.page, p.lang))].sort(),
    );
    for (const p of PAGES) {
      const entry = urls.find((u) => u.loc === canonicalUrl(p.page, p.lang));
      expect(entry?.alternates).toEqual({
        ko: canonicalUrl(p.page, 'ko'),
        en: canonicalUrl(p.page, 'en'),
        'x-default': canonicalUrl(p.page, 'ko'),
      });
    }
  });
});
