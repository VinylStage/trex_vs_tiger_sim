import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CONTENT_PAGES,
  LANG_STORAGE_KEY,
  NAV_PAGES,
  SITE_ORIGIN,
  canonicalUrl,
  counterpartPath,
  pagePath,
  parsePagePath,
} from '../src/pages/routes';
import { DICTIONARIES, LANGS, STORAGE_KEY } from '../src/ui/i18n';
import { NAV_LABEL_KEYS, siteNavItems } from '../src/ui/site-nav';
import { findHtmlEntries } from '../vite.pages';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('page routes', () => {
  it('maps pages to Korean and English paths', () => {
    expect(pagePath('simulator', 'ko')).toBe('/');
    expect(pagePath('simulator', 'en')).toBe('/');
    expect(pagePath('guide', 'ko')).toBe('/guide/');
    expect(pagePath('guide', 'en')).toBe('/en/guide/');
    expect(canonicalUrl('privacy', 'en')).toBe(`${SITE_ORIGIN}/en/privacy/`);
  });

  it('parses every form Pages serves or redirects', () => {
    expect(parsePagePath('/')).toEqual({ page: 'simulator', lang: null });
    expect(parsePagePath('/index.html')).toEqual({ page: 'simulator', lang: null });
    for (const p of ['/model', '/model/', '/model/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'model', lang: 'ko' });
    }
    for (const p of ['/en/model', '/en/model/', '/en/model/index.html']) {
      expect(parsePagePath(p)).toEqual({ page: 'model', lang: 'en' });
    }
  });

  it('rejects unknown paths', () => {
    for (const p of [
      '/en/',
      '/nope/',
      '/en/nope/',
      '/en/en/guide/',
      '/guide/extra/',
      '/assets/x.js',
    ]) {
      expect(parsePagePath(p), p).toBeNull();
    }
  });

  it('round-trips every content page through its counterpart', () => {
    for (const page of CONTENT_PAGES) {
      expect(counterpartPath(pagePath(page, 'ko'))).toBe(pagePath(page, 'en'));
      expect(counterpartPath(pagePath(page, 'en'))).toBe(pagePath(page, 'ko'));
    }
    expect(counterpartPath('/')).toBeNull();
    expect(counterpartPath('/nope/')).toBeNull();
  });

  it('uses the same language storage key as the app', () => {
    expect(LANG_STORAGE_KEY).toBe(STORAGE_KEY);
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

  it('marks the simulator as current by default', () => {
    expect(
      siteNavItems('en')
        .filter((i) => i.current)
        .map((i) => i.page),
    ).toEqual(['simulator']);
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

  it('discovers the app and every content page of this repository', () => {
    const entries = findHtmlEntries(ROOT);
    expect(entries['index']).toBe(join(ROOT, 'index.html'));
    for (const page of CONTENT_PAGES) {
      expect(entries[page]).toBe(join(ROOT, page, 'index.html'));
      expect(entries[`en-${page}`]).toBe(join(ROOT, 'en', page, 'index.html'));
    }
  });
});
