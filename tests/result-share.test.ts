import { existsSync, readFileSync } from 'node:fs';
import { SHARE_MESSAGES } from '../src/i18n/dictionaries';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { headerRouteOf } from '../src/pages/site-header';
import { resultPageLang, resultPagePath } from '../src/pages/routes';
import { sitemapXml } from '../src/seo/sitemap';
import { DEFAULT_BASELINE } from '../src/share/baseline';
import {
  CODE_PREFIX,
  configCode,
  configFileJson,
  MAX_CONFIG_FILE_BYTES,
  parseConfigFile,
  parseConfigInput,
  parsePayload,
} from '../src/share/config-code';

import {
  checkFromHash,
  decodeResult,
  decodeResultQuery,
  encodeResult,
  MAX_RESULT_LENGTH,
  reproduceHash,
  resultPath,
  summarize,
  validateSummary,
  type AggregateLike,
  type ResultSummary,
} from '../src/share/result-codec';
import {
  onResultRequest,
  RESULT_HEADERS,
  resultPathLang,
  REWRITTEN_META,
} from '../src/share/result-function';
import {
  barCells,
  buildMeta,
  diffVsBaseline,
  emojiBar,
  formatDiff,
  outcomeTier,
  shareText,
  speciesEmoji,
  winnerOf,
  xIntentUrl,
} from '../src/share/result-text';
import { defaultConfig, type ScenarioConfig } from '../src/sim/config';
import { aggregate, runAll } from '../src/sim/montecarlo';
import { wilson } from '../src/sim/stats';
import { CARD_SIZE, cardLayout, STORY_SAFE } from '../src/ui/result-card';
import { compareRun } from '../src/ui/result-share';
import {
  base64UrlEncode,
  configFromHash,
  decodeConfig,
  encodeConfig,
  hashFromConfig,
} from '../src/ui/share';
import { findHtmlEntries } from '../vite.pages';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/** Deterministic PRNG for the fuzz cases. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function oneVsHundred(): ScenarioConfig {
  const c = defaultConfig();
  c.heavyCount = 1;
  c.packCount = 100;
  return c;
}

function fakeAgg(n: number, h: number, p: number, d: number): AggregateLike {
  return {
    n,
    heavyWins: h,
    packWins: p,
    draws: d,
    pHeavy: wilson(h, n),
    pPack: wilson(p, n),
    pDraw: wilson(d, n),
    duration: { mean: 43.4662 },
    heavySurvivors: { mean: 0.61234 },
    packKilled: { mean: 14.116 },
  };
}

const rawResult = (obj: unknown): string => base64UrlEncode(JSON.stringify(obj));
const validBody = (s: unknown, c: unknown = { v: 2, heavyCount: 1 }): string =>
  rawResult({ v: 1, c, s });

// ---------- result codec ----------

describe('result codec', () => {
  const config = oneVsHundred();
  const summary = summarize(fakeAgg(500, 305, 175, 20));

  it('summarises an aggregate compactly', () => {
    expect(summary).toEqual({
      n: 500,
      h: 305,
      p: 175,
      d: 20,
      t: 43.5,
      hs: 0.61,
      pk: 14.1,
      ci: expect.any(Array),
    });
    expect(summary.ci).toHaveLength(6);
  });

  it('round-trips config and summary', () => {
    const r = encodeResult(config, summary);
    const back = decodeResult(r);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.summary).toEqual(summary);
    expect(back.config).toEqual(config);
    expect(r.length).toBeLessThan(400);
  });

  it('round-trips a custom matchup and edited params', () => {
    const c = defaultConfig();
    c.heavySpecies = 'elephant';
    c.packSpecies = 'lion';
    c.heavyCount = 3;
    c.packCount = 40;
    c.seed = 4_000_000_000;
    c.params['pack.dps'] = { min: 1.5, mode: 4.25, max: 9 };
    const back = decodeResult(encodeResult(c, summary));
    expect(back.ok && back.config).toEqual(decodeConfig(encodeConfig(c)));
  });

  it('builds the result path per language', () => {
    expect(resultPath('ko', 'abc')).toBe('/r/?r=abc');
    expect(resultPath('en', 'abc')).toBe('/en/r/?r=abc');
  });

  it('decodes from a query string and rejects oversized queries unparsed', () => {
    const r = encodeResult(config, summary);
    expect(decodeResultQuery(`?r=${r}`).ok).toBe(true);
    expect(decodeResultQuery(`?x=1&r=${r}`).ok).toBe(true);
    expect(decodeResultQuery('').ok).toBe(false);
    const huge = decodeResultQuery(`?r=${'A'.repeat(MAX_RESULT_LENGTH + 100)}`);
    expect(huge).toEqual({ ok: false, error: 'length', config: null });
  });

  it.each([
    ['missing', null],
    ['missing', ''],
    ['length', 'A'.repeat(MAX_RESULT_LENGTH + 1)],
    ['alphabet', 'abc$def'],
    ['alphabet', 'abc=='],
    ['json', 'AAAA'],
    ['json', base64UrlEncode('{"v":1,')],
    ['shape', rawResult([1, 2, 3])],
    ['shape', rawResult('text')],
    ['version', rawResult({ v: 2, c: {}, s: { n: 1, h: 1, p: 0, d: 0 } })],
    ['config', rawResult({ v: 1, c: [1], s: { n: 1, h: 1, p: 0, d: 0 } })],
    ['config', rawResult({ v: 1, s: { n: 1, h: 1, p: 0, d: 0 } })],
  ] as const)('rejects %s input', (error, input) => {
    const res = decodeResult(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(error);
  });

  describe('strict summary validation', () => {
    const bad: [string, unknown][] = [
      ['sum mismatch', { n: 10, h: 5, p: 4, d: 0 }],
      ['sum over n', { n: 10, h: 6, p: 5, d: 0 }],
      ['negative count', { n: 10, h: 11, p: -1, d: 0 }],
      ['fractional count', { n: 10, h: 5.5, p: 4.5, d: 0 }],
      ['string count', { n: '10', h: 10, p: 0, d: 0 }],
      ['null count (from NaN/Infinity in JSON)', { n: 10, h: null, p: 0, d: 10 }],
      ['zero runs', { n: 0, h: 0, p: 0, d: 0 }],
      ['too many runs', { n: 20001, h: 20001, p: 0, d: 0 }],
      ['missing count', { n: 10, h: 10, p: 0 }],
      ['unknown key', { n: 1, h: 1, p: 0, d: 0, x: 1 }],
      ['negative duration', { n: 1, h: 1, p: 0, d: 0, t: -1 }],
      ['duration too long', { n: 1, h: 1, p: 0, d: 0, t: 99999 }],
      ['string duration', { n: 1, h: 1, p: 0, d: 0, t: 'NaN' }],
      ['survivors above the head count', { n: 1, h: 1, p: 0, d: 0, hs: 2 }],
      ['pack losses above the head count', { n: 1, h: 1, p: 0, d: 0, pk: 101 }],
      ['short ci', { n: 1, h: 1, p: 0, d: 0, ci: [0, 1] }],
      ['ci out of range', { n: 1, h: 1, p: 0, d: 0, ci: [0, 1.5, 0, 0, 0, 0] }],
      ['ci lo > hi', { n: 1, h: 1, p: 0, d: 0, ci: [0.9, 0.1, 0, 0, 0, 0] }],
      ['ci not numbers', { n: 1, h: 1, p: 0, d: 0, ci: ['a', 1, 0, 0, 0, 0] }],
      ['array summary', [1, 1, 0, 0]],
      ['null summary', null],
    ];

    it.each(bad)('rejects %s, offering the config', (_, s) => {
      const res = decodeResult(validBody(s));
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBe('summary');
      expect(res.config?.heavyCount).toBe(1);
    });

    it('accepts a minimal summary and the extremes', () => {
      expect(validateSummary({ n: 1, h: 1, p: 0, d: 0 }, oneVsHundred())).toEqual({
        n: 1,
        h: 1,
        p: 0,
        d: 0,
      });
      expect(decodeResult(validBody({ n: 1, h: 0, p: 0, d: 1 })).ok).toBe(true);
      expect(
        decodeResult(validBody({ n: 20000, h: 0, p: 20000, d: 0, t: 3600, hs: 1, pk: 100 })).ok,
      ).toBe(true);
    });
  });

  it('survives fuzzed garbage without throwing and never accepts it', () => {
    const rnd = mulberry(51);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < 2000; i++) {
      const len = Math.floor(rnd() * 300);
      let s = '';
      for (let k = 0; k < len; k++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      const res = decodeResult(s);
      expect(res.ok).toBe(false);
    }
  });

  it('survives fuzzed JSON bodies and accepts only consistent summaries', () => {
    const rnd = mulberry(7);
    const pickValue = (): unknown => {
      const r = rnd();
      if (r < 0.15) return Math.floor(rnd() * 40) - 5;
      if (r < 0.25) return rnd() * 100;
      if (r < 0.35) return null;
      if (r < 0.45) return 'x';
      if (r < 0.55) return [rnd()];
      if (r < 0.6) return {};
      return Math.floor(rnd() * 20);
    };
    let accepted = 0;
    for (let i = 0; i < 3000; i++) {
      const s: Record<string, unknown> = {};
      for (const k of ['n', 'h', 'p', 'd', 't', 'hs', 'pk', 'ci', 'zz']) {
        if (rnd() < 0.8) s[k] = pickValue();
      }
      const res = decodeResult(validBody(rnd() < 0.5 ? s : { ...s, ci: undefined }));
      if (!res.ok) continue;
      accepted++;
      const v = res.summary;
      expect(Number.isInteger(v.n) && v.n >= 1).toBe(true);
      expect(v.h + v.p + v.d).toBe(v.n);
    }
    // Most random bodies fail; a few consistent ones may pass and must then be well-formed.
    expect(accepted).toBeLessThan(300);
  });
});

// ---------- reproduction check ----------

describe('reproduction check links', () => {
  const summary = summarize(fakeAgg(500, 305, 175, 20));

  it('carries the config and the snapshot in the simulator fragment', () => {
    const c = oneVsHundred();
    const hash = reproduceHash(c, summary);
    expect(hash.startsWith(`${hashFromConfig(c)}&chk=`)).toBe(true);
    expect(configFromHash(hash)).toEqual(c);
    expect(checkFromHash(hash, c)).toEqual(summary);
  });

  it('works for the defaults (no s=)', () => {
    const c = defaultConfig();
    const s = summarize(fakeAgg(500, 500, 0, 0));
    const hash = reproduceHash(c, s);
    expect(hash.startsWith('#chk=')).toBe(true);
    expect(configFromHash(hash)).toBeNull();
    expect(checkFromHash(hash, c)).toEqual(s);
  });

  it('ignores missing or invalid checks', () => {
    const c = oneVsHundred();
    expect(checkFromHash('#s=abc', c)).toBeNull();
    expect(checkFromHash('#chk=***', c)).toBeNull();
    expect(checkFromHash(`#chk=${rawResult({ n: 2, h: 1, p: 0, d: 0 })}`, c)).toBeNull();
  });

  it('compares a fresh run with the snapshot', () => {
    const shared: ResultSummary = { n: 500, h: 305, p: 175, d: 20 };
    expect(compareRun(shared, fakeAgg(500, 305, 175, 20), true)).toBe('same');
    expect(compareRun(shared, fakeAgg(500, 300, 180, 20), true)).toBe('within');
    expect(compareRun(shared, fakeAgg(500, 200, 280, 20), true)).toBe('outside');
    expect(compareRun(shared, fakeAgg(500, 305, 175, 20), false)).toBe('changed');
  });
});

// ---------- config code and file ----------

describe('config code', () => {
  const c = oneVsHundred();

  it('round-trips the code, a full link and a bare payload', () => {
    const code = configCode(c);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(parseConfigInput(code)).toEqual({ ok: true, config: c });
    expect(parseConfigInput(`  ${code.toLowerCase().slice(0, 5)}${code.slice(5)}\n`)).toEqual({
      ok: true,
      config: c,
    });
    const url = `https://trex-vs-tiger.vinylims.com/en/${hashFromConfig(c)}&chk=abc`;
    expect(parseConfigInput(url)).toEqual({ ok: true, config: c });
    expect(parseConfigInput(encodeConfig(c))).toEqual({ ok: true, config: c });
  });

  it('treats an empty code as the defaults', () => {
    expect(configCode(defaultConfig())).toBe(CODE_PREFIX);
    expect(parseConfigInput(CODE_PREFIX)).toEqual({ ok: true, config: defaultConfig() });
  });

  it('upgrades v1 payloads like the #s= link', () => {
    const v1 = base64UrlEncode(JSON.stringify({ trexCount: 2, tigerCount: 30, seed: 5 }));
    const res = parsePayload(v1);
    expect(res.ok && res.config).toEqual(decodeConfig(v1));
    expect(res.ok && res.config.heavyCount).toBe(2);
  });

  it.each([
    ['empty', '   '],
    ['length', 'A'.repeat(20000)],
    ['alphabet', `${CODE_PREFIX}abc!`],
    ['json', `${CODE_PREFIX}AAAA`],
    ['shape', `${CODE_PREFIX}${base64UrlEncode('[1]')}`],
    ['noPayload', 'https://example.com/#tour=1'],
    ['noPayload', 'https://example.com/'],
  ] as const)('reports %s', (error, input) => {
    expect(parseConfigInput(input)).toEqual({ ok: false, error });
  });

  it('round-trips the .json file', () => {
    const text = configFileJson(c, new Date('2026-10-20T00:00:00Z'));
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(doc).toMatchObject({
      app: 'trex-vs-tiger',
      kind: 'config',
      v: 2,
      exportedAt: '2026-10-20T00:00:00.000Z',
    });
    expect(parseConfigFile(text)).toEqual({ ok: true, config: c });
  });

  it('rejects oversized, foreign and malformed files', () => {
    expect(parseConfigFile('{}', MAX_CONFIG_FILE_BYTES + 1)).toEqual({
      ok: false,
      error: 'length',
    });
    expect(parseConfigFile('not json')).toEqual({ ok: false, error: 'json' });
    expect(parseConfigFile('{"app":"other","kind":"config","config":{}}')).toEqual({
      ok: false,
      error: 'app',
    });
    expect(parseConfigFile('{"app":"trex-vs-tiger","kind":"config","config":3}')).toEqual({
      ok: false,
      error: 'shape',
    });
  });

  it('reads a v1 config object in a file', () => {
    const text = JSON.stringify({
      app: 'trex-vs-tiger',
      kind: 'config',
      v: 1,
      config: { trexCount: 4 },
    });
    const res = parseConfigFile(text);
    expect(res.ok && res.config.heavyCount).toBe(4);
  });
});

// ---------- text share, tiers, meta ----------

describe('outcome tiers and the default baseline', () => {
  const sh = (heavy: number, pack: number, draw: number) => ({ heavy, pack, draw });

  it('labels the outcome against the default matchup', () => {
    expect(outcomeTier(sh(1, 0, 0))).toBe('landslide');
    expect(outcomeTier(sh(0.75, 0.25, 0))).toBe('clear');
    expect(outcomeTier(sh(0.55, 0.45, 0))).toBe('close');
    expect(outcomeTier(sh(0.3, 0.7, 0))).toBe('upset');
    expect(outcomeTier(sh(0.2, 0.3, 0.5))).toBe('stalemate');
    expect(winnerOf(sh(0.4, 0.4, 0.2))).toBe('heavy');
  });

  it('reports the points difference to the baseline', () => {
    expect(diffVsBaseline(sh(0.61, 0.35, 0.04))).toBe(-39);
    expect(diffVsBaseline(sh(0.3, 0.7, 0))).toBe(70);
    expect(formatDiff(-39, 'ko')).toBe('−39%p');
    expect(formatDiff(12, 'en')).toBe('+12 pp');
    expect(formatDiff(0, 'ko')).toBe('±0%p');
  });

  it('matches the default scenario as the engine computes it today', () => {
    const c = defaultConfig();
    const { design, summaries } = runAll(c);
    const agg = aggregate(c, design, summaries);
    expect({ n: agg.n, h: agg.heavyWins, p: agg.packWins, d: agg.draws }).toEqual(DEFAULT_BASELINE);
  }, 60_000);
});

describe('text share', () => {
  const c = oneVsHundred();
  const s: ResultSummary = { n: 500, h: 305, p: 175, d: 20 };

  it('fills a 10-cell bar by largest remainder', () => {
    expect(barCells({ heavy: 0.61, pack: 0.35, draw: 0.04 })).toEqual({
      heavy: 6,
      pack: 4,
      draw: 0,
    });
    expect(barCells({ heavy: 1 / 3, pack: 1 / 3, draw: 1 / 3 })).toEqual({
      heavy: 4,
      pack: 3,
      draw: 3,
    });
    for (let i = 0; i <= 100; i++) {
      const h = i / 100;
      const cells = barCells({ heavy: h, pack: (1 - h) * 0.7, draw: (1 - h) * 0.3 });
      expect(cells.heavy + cells.pack + cells.draw).toBe(10);
    }
    expect(emojiBar({ heavy: 0.61, pack: 0.35, draw: 0.04 })).toBe('🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧');
  });

  it('writes the Korean text', () => {
    expect(shareText(c, s, 'ko', 'https://x.test/r/?r=1')).toBe(
      [
        '🦖 T-Rex 1 vs 🐅 호랑이 100 — 500회',
        '🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧',
        'T-Rex 61% · 호랑이 35% · 무승부 4%',
        'https://x.test/r/?r=1',
      ].join('\n'),
    );
  });

  it('writes the English text with plural names', () => {
    expect(shareText(c, s, 'en', 'https://x.test/en/r/?r=1')).toBe(
      [
        '🦖 T-Rex 1 vs 🐅 Tigers 100 — 500 runs',
        '🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧',
        'T-Rex 61% · Tiger 35% · Draw 4%',
        'https://x.test/en/r/?r=1',
      ].join('\n'),
    );
  });

  it('has an emoji for every species and a generic fallback', () => {
    expect(speciesEmoji('trex', 'heavy')).toBe('🦖');
    expect(speciesEmoji('mammoth', 'heavy')).toBe('🔷');
    expect(speciesEmoji('dhole', 'pack')).toBe('🔶');
    expect(speciesEmoji('__proto__', 'pack')).toBe('🔶');
  });

  it('builds the X intent', () => {
    expect(xIntentUrl('a b', 'https://x.test/?r=1')).toBe(
      'https://x.com/intent/tweet?text=a+b&url=https%3A%2F%2Fx.test%2F%3Fr%3D1',
    );
  });

  it('never uses death words in any sharing message', () => {
    const banned = /죽|사망|학살|도륙|피\b|잔혹|kill|dead|death|massacre|gore/i;
    for (const dict of Object.values(SHARE_MESSAGES)) {
      for (const [k, v] of Object.entries(dict)) expect(v, k).not.toMatch(banned);
    }
  });
});

describe('link-preview meta (Pages Function)', () => {
  const r = encodeResult(oneVsHundred(), { n: 500, h: 305, p: 175, d: 20 });

  it('describes a valid result in the path language', () => {
    expect(buildMeta(`?r=${r}`, 'ko')).toEqual({
      title: 'T-Rex 1 vs 호랑이 100 — T-Rex 61%',
      description:
        '500회 몬테카를로 시뮬레이션 스냅샷 · 우세 · 기본 대결 대비 −39%p. 같은 설정으로 직접 실행해 보세요.',
    });
    expect(buildMeta(`?r=${r}`, 'en')?.title).toBe('T-Rex 1 vs Tigers 100 — T-Rex 61%');
  });

  it('returns null for anything that does not validate', () => {
    expect(buildMeta('', 'ko')).toBeNull();
    expect(buildMeta('?r=garbage!', 'ko')).toBeNull();
    expect(buildMeta(`?r=${'A'.repeat(5000)}`, 'ko')).toBeNull();
    expect(buildMeta(`?r=${validBody({ n: 2, h: 1, p: 0, d: 0 })}`, 'ko')).toBeNull();
  });

  it('takes the language from the path', () => {
    expect(resultPathLang('/en/r/')).toBe('en');
    expect(resultPathLang('/r/')).toBe('ko');
  });
});

// ---------- the Function glue, with a fake HTMLRewriter ----------

class FakeRewriter {
  handlers: [string, (el: { setAttribute(n: string, v: string): void }) => void][] = [];
  on(selector: string, h: { element(el: { setAttribute(n: string, v: string): void }): void }) {
    this.handlers.push([selector, h.element]);
    return this;
  }
  transform(res: Response): Response {
    const set: Record<string, string> = {};
    for (const [sel, fn] of this.handlers) fn({ setAttribute: (_, v) => (set[sel] = v) });
    res.headers.set('x-rewritten', encodeURIComponent(JSON.stringify(set)));
    return res;
  }
}

describe('result Function', () => {
  const page = '<html><head><meta property="og:title" content="static" /></head></html>';
  const ctx = (url: string, type = 'text/html; charset=utf-8', status = 200) => ({
    request: new Request(url),
    next: async () => new Response(page, { status, headers: { 'content-type': type } }),
  });
  const r = encodeResult(oneVsHundred(), { n: 500, h: 305, p: 175, d: 20 });

  it('rewrites the four meta tags for a valid link and sets the page headers', async () => {
    const g = globalThis as { HTMLRewriter?: unknown };
    g.HTMLRewriter = FakeRewriter;
    try {
      const res = await onResultRequest(ctx(`https://x.test/en/r/?r=${r}`));
      const set = JSON.parse(decodeURIComponent(res.headers.get('x-rewritten') ?? '{}')) as Record<
        string,
        string
      >;
      expect(Object.keys(set)).toEqual(REWRITTEN_META.map((m) => m.selector));
      expect(set['meta[property="og:title"]']).toBe('T-Rex 1 vs Tigers 100 — T-Rex 61%');
      expect(res.headers.get('x-robots-tag')).toBe('noindex');
      expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
      expect(await res.text()).toBe(page);
    } finally {
      delete g.HTMLRewriter;
    }
  });

  it('returns the page untouched for invalid links and non-HTML responses', async () => {
    const g = globalThis as { HTMLRewriter?: unknown };
    g.HTMLRewriter = FakeRewriter;
    try {
      for (const res of [
        await onResultRequest(ctx('https://x.test/r/?r=bad!')),
        await onResultRequest(ctx('https://x.test/r/')),
        await onResultRequest(ctx(`https://x.test/r/?r=${r}`, 'image/png')),
        await onResultRequest(ctx(`https://x.test/r/?r=${r}`, 'text/html', 404)),
      ]) {
        expect(res.headers.get('x-rewritten')).toBeNull();
        expect(res.headers.get('cache-control')).toBe('no-cache, no-transform');
      }
    } finally {
      delete g.HTMLRewriter;
    }
  });

  it('sends exactly the headers public/_headers gives /r/ and /en/r/', () => {
    const src = read('public/_headers');
    for (const path of ['/r/', '/en/r/']) {
      const h = headersFor(src, path);
      const expected = Object.fromEntries(
        Object.entries(RESULT_HEADERS).map(([k, v]) => [k.toLowerCase(), [v]]),
      );
      expect(h).toEqual(expected);
    }
  });

  it('runs only on /r/ and /en/r/ (_routes.json)', () => {
    const routes = JSON.parse(read('public/_routes.json')) as {
      version: number;
      include: string[];
      exclude: string[];
    };
    expect(routes.version).toBe(1);
    expect(routes.include.sort()).toEqual(['/en/r', '/en/r/*', '/r', '/r/*']);
    expect(existsSync(join(ROOT, 'functions/r/[[path]].ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'functions/en/r/[[path]].ts'))).toBe(true);
  });
});

/** Minimal Cloudflare Pages `_headers` matcher (as in tests/pages.test.ts). */
function headersFor(src: string, path: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let matches = false;
  for (const line of src.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      matches = new RegExp(`^${pattern}$`).test(path);
    } else if (matches) {
      const [name = '', ...rest] = line.trim().split(':');
      (out[name.toLowerCase()] ??= []).push(rest.join(':').trim());
    }
  }
  return out;
}

// ---------- the result page entries ----------

describe('result pages', () => {
  it('are build entries with the shared header, outside the sitemap', () => {
    const entries = findHtmlEntries(ROOT);
    expect(entries['r']).toBe(join(ROOT, 'r/index.html'));
    expect(entries['en-r']).toBe(join(ROOT, 'en/r/index.html'));
    expect(headerRouteOf('/r/index.html')).toEqual({ lang: 'ko', page: null });
    expect(headerRouteOf('/en/r/index.html')).toEqual({ lang: 'en', page: null });
    expect(resultPageLang('/r/')).toBe('ko');
    expect(resultPageLang('/en/r/')).toBe('en');
    expect(resultPageLang('/rx/')).toBeNull();
    expect(sitemapXml(() => null)).not.toMatch(/\/r\//);
  });

  it.each(['ko', 'en'] as const)(
    '%s page: noindex, canonical without query, static OG card',
    (lang) => {
      const file = lang === 'en' ? 'en/r/index.html' : 'r/index.html';
      const html = read(file);
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(html).toContain(
        `<link rel="canonical" href="https://trex-vs-tiger.vinylims.com${resultPagePath(lang)}" />`,
      );
      expect(html).toContain('<!-- site-header -->');
      const img = `og-result-${lang}.png`;
      expect(html).toContain(`content="https://trex-vs-tiger.vinylims.com/${img}"`);
      expect(existsSync(join(ROOT, 'public', img))).toBe(true);
      const png = readFileSync(join(ROOT, 'public', img));
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
      for (const m of REWRITTEN_META) {
        const attr = m.selector.slice(5, -1);
        expect(html.replace(/\s+/g, ' '), m.selector).toContain(`<meta ${attr} content=`);
      }
    },
  );

  it('never imports the simulator, its workers or the app', () => {
    const forbidden = [
      'src/workers/',
      'src/ui/pool.ts',
      'src/sim/montecarlo.ts',
      'src/sim/sampling.ts',
      'src/ui/app.ts',
      'src/ui/replay.ts',
    ];
    const seen = new Set<string>();
    const walk = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^import\s+(?!type\b)[^'"]*['"](\.[^'"]+)['"]/gm)) {
        const spec = m[1] as string;
        if (spec.endsWith('.css')) continue;
        let target = resolve(dirname(file), spec);
        if (!target.endsWith('.ts')) target += '.ts';
        walk(target);
      }
    };
    walk(join(ROOT, 'src/share/result-page.ts'));
    walk(join(ROOT, 'src/share/result-function.ts'));
    const files = [...seen].map((f) => relative(ROOT, f));
    expect(files).toContain('src/share/result-codec.ts');
    for (const f of files) for (const bad of forbidden) expect(f.startsWith(bad), f).toBe(false);
  });
});

// ---------- the card ----------

describe('result card layout', () => {
  it('keeps every story element inside the safe zone', () => {
    const L = cardLayout('story');
    const top = STORY_SAFE.top;
    const bottom = CARD_SIZE.story.h - STORY_SAFE.bottom;
    const ys = [
      L.brandY - 40,
      L.matchupY - L.matchupSize,
      L.runsY,
      L.winY,
      L.pctY,
      L.tierY,
      L.barY + L.barH,
      L.legendY,
      L.waterY + 30,
    ];
    if (L.field) ys.push(L.field.y, L.field.y + L.field.h);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y).toBeLessThanOrEqual(bottom);
    }
  });

  it('fits the square format', () => {
    const L = cardLayout('square');
    expect(L.waterY + 30).toBeLessThan(CARD_SIZE.square.h);
    expect(L.brandY).toBeGreaterThan(40);
  });
});
