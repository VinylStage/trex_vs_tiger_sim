import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { setLang, getLang, initLang, t } from '../src/ui/i18n';

/*
 * Each page entry bundles only its own language (#79): the static import graph of an entry never
 * reaches the other language's tables or the both-languages modules. `import()` (the language
 * switch's loader) is not followed, as it is not part of the startup bundle.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function staticGraph(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm)) {
      const spec = m[1] as string;
      if (spec.endsWith('.css')) continue;
      let target = resolve(dirname(file), spec);
      if (!target.endsWith('.ts')) target += '.ts';
      if (existsSync(target)) walk(target);
    }
  };
  walk(join(ROOT, entry));
  return [...seen].map((f) => relative(ROOT, f));
}

const BOTH = ['src/i18n/dictionaries.ts', 'src/i18n/boot-all.ts'];
const TABLES = {
  ko: ['src/i18n/ko.ts', 'src/share/messages-ko.ts'],
  en: ['src/i18n/en.ts', 'src/share/messages-en.ts'],
} as const;

describe.each([
  ['src/main-ko.ts', 'ko', 'en'],
  ['src/main-en.ts', 'en', 'ko'],
  ['src/share/result-page-ko.ts', 'ko', 'en'],
  ['src/share/result-page-en.ts', 'en', 'ko'],
] as const)('%s', (entry, own, other) => {
  const files = staticGraph(entry);

  it(`bundles the ${own} words`, () => {
    for (const f of TABLES[own]) expect(files).toContain(f);
  });

  it(`does not bundle the ${other} words or the both-languages modules`, () => {
    for (const f of [...TABLES[other], ...BOTH]) expect(files).not.toContain(f);
  });
});

describe('setLang', () => {
  it('waits for the words of the new language before switching', async () => {
    initLang('ko');
    const switching = setLang('en');
    expect(getLang()).toBe('ko');
    await switching;
    expect(getLang()).toBe('en');
    expect(t('lang.switch')).toBe('한국어');
    await setLang('ko');
  });
});
