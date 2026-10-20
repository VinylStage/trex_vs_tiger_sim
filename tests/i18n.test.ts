import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARAM_IDS } from '../src/sim/params';
import {
  DICTIONARIES,
  LANGS,
  getLang,
  initLang,
  interpolate,
  onLangChange,
  setLang,
  t,
} from '../src/ui/i18n';

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('i18n dictionaries', () => {
  it('have identical key sets', () => {
    const [first, ...rest] = LANGS.map((l) => Object.keys(DICTIONARIES[l]).sort());
    expect(first?.length).toBeGreaterThan(0);
    for (const keys of rest) expect(keys).toEqual(first);
  });

  it('have no empty strings', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(DICTIONARIES[l])) {
        expect(v.trim(), `${l}:${k}`).not.toBe('');
      }
    }
  });

  it('use the same placeholders in every language', () => {
    const ko: Record<string, string> = DICTIONARIES.ko;
    const en: Record<string, string> = DICTIONARIES.en;
    for (const k of Object.keys(ko)) {
      expect(placeholders(en[k] ?? ''), k).toEqual(placeholders(ko[k] ?? ''));
    }
  });

  it('label and describe every model parameter', () => {
    for (const l of LANGS) {
      const d: Record<string, string> = DICTIONARIES[l];
      for (const id of PARAM_IDS) {
        expect(d[`param.${id}`], `${l} param.${id}`).toBeTruthy();
        expect(d[`paramHelp.${id}`], `${l} paramHelp.${id}`).toBeTruthy();
      }
    }
  });
});

describe('t / interpolate', () => {
  it('interpolates placeholders and leaves unknown ones', () => {
    expect(interpolate('{a} + {b} = {c}', { a: 1, b: '2' })).toBe('1 + 2 = {c}');
  });

  it('switches language without a DOM or storage', () => {
    expect(getLang()).toBe('ko');
    expect(t('run.start')).toBe(DICTIONARIES.ko['run.start']);
    setLang('en');
    expect(t('progress.text', { done: 1, total: 2, pct: '50%' })).toBe('1 / 2 runs (50%)');
    setLang('ko');
    expect(getLang()).toBe('ko');
  });
});

describe('language state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    initLang('ko');
  });

  it('starts in the language it is given (the URL’s), Korean by default', () => {
    expect(initLang('en')).toBe('en');
    expect(getLang()).toBe('en');
    expect(initLang()).toBe('ko');
  });

  it('never reads or writes localStorage', () => {
    const touched: string[] = [];
    const spy = new Proxy(
      {},
      {
        get(_, prop) {
          touched.push(String(prop));
          return () => null;
        },
      },
    );
    vi.stubGlobal('localStorage', spy);
    initLang('ko');
    const seen: string[] = [];
    const off = onLangChange((l) => seen.push(l));
    setLang('en');
    setLang('en');
    setLang('ko');
    off();
    expect(seen).toEqual(['en', 'ko']);
    expect(touched).toEqual([]);
  });
});
