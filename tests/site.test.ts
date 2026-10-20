import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { LEGACY_STORAGE_KEYS, dropLegacyStorage } from '../src/pages/legacy-storage';
import {
  BLOG_URL,
  CONTENT_PAGES,
  FOOTER_LINKS,
  LINKTREE_URL,
  NAV_PAGES,
  REPO_URL,
  SITE_ORIGIN,
  canonicalUrl,
  counterpartPath,
  footerHref,
  pageLang,
  pagePath,
  parsePagePath,
  switchedAppUrl,
} from '../src/pages/routes';
import { DICTIONARIES, LANGS } from '../src/ui/i18n';
import { NAV_LABEL_KEYS, footerItems, relocalizeLinks, siteNavItems } from '../src/ui/site-nav';
import { findHtmlEntries } from '../vite.pages';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('page routes', () => {
  it('maps pages to Korean and English paths', () => {
    expect(pagePath('simulator', 'ko')).toBe('/');
    expect(pagePath('simulator', 'en')).toBe('/en/');
    expect(pagePath('guide', 'ko')).toBe('/guide/');
    expect(pagePath('guide', 'en')).toBe('/en/guide/');
    expect(pagePath('license', 'en')).toBe('/en/license/');
    expect(canonicalUrl('privacy', 'en')).toBe(`${SITE_ORIGIN}/en/privacy/`);
    expect(canonicalUrl('simulator', 'en')).toBe(`${SITE_ORIGIN}/en/`);
  });

  it('parses every form Pages serves or redirects', () => {
    for (const p of ['/', '/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'simulator', lang: 'ko' });
    }
    for (const p of ['/en', '/en/', '/en/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'simulator', lang: 'en' });
    }
    for (const p of ['/model', '/model/', '/model/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'model', lang: 'ko' });
    }
    for (const p of ['/en/model', '/en/model/', '/en/model/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'model', lang: 'en' });
    }
    expect(parsePagePath('/license/')).toEqual({ page: 'license', lang: 'ko' });
  });

  it('rejects unknown paths', () => {
    for (const p of [
      '/nope/',
      '/en/nope/',
      '/en/en/',
      '/en/en/guide/',
      '/guide/extra/',
      '/assets/x.js',
      '/ko/',
      '/reset/',
    ]) {
      expect(parsePagePath(p), p).toBeNull();
    }
  });

  it('round-trips every page, the simulator included, through its counterpart', () => {
    for (const page of ['simulator', ...CONTENT_PAGES] as const) {
      expect(counterpartPath(pagePath(page, 'ko'))).toBe(pagePath(page, 'en'));
      expect(counterpartPath(pagePath(page, 'en'))).toBe(pagePath(page, 'ko'));
    }
    expect(counterpartPath('/')).toBe('/en/');
    expect(counterpartPath('/en/index.html')).toBe('/');
    expect(counterpartPath('/nope/')).toBeNull();
  });
});

describe('language from the URL', () => {
  it('takes the language from the path of a known page', () => {
    expect(pageLang('/', 'en')).toBe('ko');
    expect(pageLang('/index.html', '')).toBe('ko');
    expect(pageLang('/en/', 'ko')).toBe('en');
    expect(pageLang('/en', '')).toBe('en');
    expect(pageLang('/en/index.html', '')).toBe('en');
    expect(pageLang('/en/guide/', 'ko')).toBe('en');
  });

  it('falls back to <html lang>, then Korean, for unknown paths', () => {
    expect(pageLang('/preview/sub/', 'en')).toBe('en');
    expect(pageLang('/preview/sub/', 'en-US')).toBe('en');
    expect(pageLang('/preview/sub/', 'ko')).toBe('ko');
    expect(pageLang('/preview/sub/', '')).toBe('ko');
    expect(pageLang('/preview/sub/', 'de')).toBe('ko');
  });

  it('switches the app URL in place, keeping the query and the fragment', () => {
    expect(switchedAppUrl('en', '', '')).toBe('/en/');
    expect(switchedAppUrl('ko', '', '')).toBe('/');
    expect(switchedAppUrl('en', '', '#s=abc')).toBe('/en/#s=abc');
    expect(switchedAppUrl('ko', '?tour=1', '#s=abc')).toBe('/?tour=1#s=abc');
    expect(switchedAppUrl('en', '?a=1&b=2', '#x')).toBe('/en/?a=1&b=2#x');
    expect(switchedAppUrl('en', '?', '#')).toBe('/en/');
  });
});

describe('site navigation', () => {
  it('links the simulator and every nav page in each language', () => {
    for (const lang of LANGS) {
      const items = siteNavItems(lang, 'model');
      expect(items.map((i) => i.page)).toEqual(NAV_PAGES);
      for (const item of items) {
        expect(item.href).toBe(pagePath(item.page, lang));
        expect(item.label).toBe(DICTIONARIES[lang][NAV_LABEL_KEYS[item.page]]);
        expect(item.current).toBe(item.page === 'model');
      }
    }
  });

  it('links the simulator in the language being read', () => {
    expect(siteNavItems('en')[0]).toMatchObject({ page: 'simulator', href: '/en/' });
    expect(siteNavItems('ko')[0]).toMatchObject({ page: 'simulator', href: '/' });
  });

  it('marks the simulator as current by default', () => {
    expect(
      siteNavItems('en')
        .filter((i) => i.current)
        .map((i) => i.page),
    ).toEqual(['simulator']);
  });
});

describe('site footer', () => {
  it('links about, privacy, license, the source code, the blog and Linktree', () => {
    expect(FOOTER_LINKS.map((l) => l.id)).toEqual([
      'about',
      'privacy',
      'license',
      'source',
      'blog',
      'linktree',
    ]);
    expect(footerItems('ko').map((i) => i.href)).toEqual([
      '/about/',
      '/privacy/',
      '/license/',
      REPO_URL,
      BLOG_URL,
      LINKTREE_URL,
    ]);
    expect(footerItems('en').map((i) => i.href)).toEqual([
      '/en/about/',
      '/en/privacy/',
      '/en/license/',
      REPO_URL,
      BLOG_URL,
      LINKTREE_URL,
    ]);
  });

  it('marks the owner’s own profiles with rel="me"', () => {
    const rel = Object.fromEntries(FOOTER_LINKS.map((l) => [l.id, l.rel ?? null]));
    expect(rel).toEqual({
      about: null,
      privacy: null,
      license: null,
      source: 'noopener',
      blog: 'me noopener',
      linktree: 'me noopener',
    });
    expect(BLOG_URL).toBe('https://vinylims.com');
    expect(LINKTREE_URL).toBe('https://link.vinylims.com');
  });

  it('labels every link in both languages from the dictionaries', () => {
    for (const lang of LANGS) {
      for (const [i, item] of footerItems(lang).entries()) {
        const link = FOOTER_LINKS[i];
        expect(link).toBeDefined();
        if (!link) continue;
        expect(item.label).toBe(DICTIONARIES[lang][link.label]);
        expect(item.href).toBe(footerHref(link, lang));
      }
    }
  });
});

describe('relocalizeLinks', () => {
  /** Just enough of an anchor element for relocalizeLinks. */
  class FakeAnchor {
    readonly attrs = new Map<string, string>();
    constructor(
      readonly dataset: Record<string, string>,
      private readonly inNav = false,
    ) {}
    closest(sel: string): object | null {
      return sel === '.site-nav' && this.inNav ? {} : null;
    }
    setAttribute(name: string, value: string): void {
      this.attrs.set(name, value);
    }
  }

  it('points page links at the other language and keeps their suffix', () => {
    const guide = new FakeAnchor({ page: 'guide' });
    const model = new FakeAnchor({ page: 'model', hrefSuffix: '#results' });
    const tour = new FakeAnchor({ page: 'simulator', hrefSuffix: '?tour=1' });
    const nav = new FakeAnchor({ page: 'about' }, true);
    const bogus = new FakeAnchor({ page: 'nope' });
    const all = [guide, model, tour, nav, bogus];
    const root = { querySelectorAll: () => all } as unknown as ParentNode;

    relocalizeLinks(root, 'en');
    expect(guide.attrs.get('href')).toBe('/en/guide/');
    expect(model.attrs.get('href')).toBe('/en/model/#results');
    expect(tour.attrs.get('href')).toBe('/en/?tour=1');
    expect(nav.attrs.has('href')).toBe(false);
    expect(bogus.attrs.has('href')).toBe(false);

    relocalizeLinks(root, 'ko');
    expect(tour.attrs.get('href')).toBe('/?tour=1');
    expect(model.attrs.get('href')).toBe('/model/#results');
  });
});

describe('findHtmlEntries', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'html-entries-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const touch = (rel: string): void => {
    const file = join(tmp, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '<!doctype html>');
  };

  it('finds nested index.html files and skips ignored directories', () => {
    for (const rel of [
      'index.html',
      'guide/index.html',
      'en/guide/index.html',
      'en/guide/notes.html',
      'node_modules/pkg/index.html',
      'dist/index.html',
      'coverage/index.html',
      'public/index.html',
      '.claude/worktrees/x/index.html',
      '.git/index.html',
    ]) {
      touch(rel);
    }
    expect(findHtmlEntries(tmp)).toEqual({
      index: join(tmp, 'index.html'),
      guide: join(tmp, 'guide/index.html'),
      'en-guide': join(tmp, 'en/guide/index.html'),
    });
  });

  it('adds 404.html files, keyed by directory, next to the pages of the same directory', () => {
    for (const rel of [
      '404.html',
      'en/404.html',
      'en/index.html',
      'public/404.html',
      'x/400.html',
    ]) {
      touch(rel);
    }
    const entries = findHtmlEntries(tmp);
    expect(entries['404']).toBe(join(tmp, '404.html'));
    expect(entries['en-404']).toBe(join(tmp, 'en/404.html'));
    expect(entries['en']).toBe(join(tmp, 'en/index.html'));
    expect(Object.values(entries)).not.toContain(join(tmp, 'public/404.html'));
    expect(Object.values(entries)).not.toContain(join(tmp, 'x/400.html'));
    expect(Object.keys(entries)).toEqual([...Object.keys(entries)].sort());
  });

  it('discovers both app entries and every content page of this repository', () => {
    const entries = findHtmlEntries(ROOT);
    expect(entries['index']).toBe(join(ROOT, 'index.html'));
    expect(entries['en']).toBe(join(ROOT, 'en', 'index.html'));
    for (const page of CONTENT_PAGES) {
      expect(entries[page]).toBe(join(ROOT, page, 'index.html'));
      expect(entries[`en-${page}`]).toBe(join(ROOT, 'en', page, 'index.html'));
    }
    expect(entries['404']).toBe(join(ROOT, '404.html'));
    expect(entries['en-404']).toBe(join(ROOT, 'en', '404.html'));
  });
});

describe('legacy storage cleanup', () => {
  it('deletes the language key v0.1.0 stored, and only that', () => {
    expect(LEGACY_STORAGE_KEYS).toEqual(['trexsim.lang']);
    const removed: string[] = [];
    dropLegacyStorage({ removeItem: (k) => removed.push(k) });
    expect(removed).toEqual(['trexsim.lang']);
  });

  it('never throws when storage is missing or blocked', () => {
    expect(() => dropLegacyStorage(null)).not.toThrow();
    expect(() =>
      dropLegacyStorage({
        removeItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).not.toThrow();
  });
});
