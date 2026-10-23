import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The language registry and the on-demand loader (#79), on fresh module instances so that no
 * language is registered yet (tests/setup.ts registers both for every other test).
 */

afterEach(() => {
  vi.resetModules();
});

async function fresh() {
  vi.resetModules();
  const registry = await import('../src/i18n/registry');
  const load = await import('../src/i18n/load');
  return { ...registry, ...load };
}

describe('i18n registry and loader', () => {
  it('throws for a language that is not loaded', async () => {
    const { dictionary, shareDictionary, hasLang } = await fresh();
    expect(hasLang('en')).toBe(false);
    expect(() => dictionary('en')).toThrow(/not loaded/);
    expect(() => shareDictionary('en')).toThrow(/not loaded/);
  });

  it('loads a language on demand, once, and registers both of its tables', async () => {
    const { dictionary, shareDictionary, hasLang, loadLang } = await fresh();
    const a = loadLang('en');
    const b = loadLang('en');
    await Promise.all([a, b]);
    expect(hasLang('en')).toBe(true);
    expect(hasLang('ko')).toBe(false);
    expect(dictionary('en')['lang.switch']).toBe('한국어');
    expect(shareDictionary('en')['xfer.title']).toBe('Export · import settings');
    await expect(loadLang('en')).resolves.toBeUndefined();
  });
});
