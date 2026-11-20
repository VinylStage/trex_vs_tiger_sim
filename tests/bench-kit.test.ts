import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { measure } from '../bench/lib.mjs';
import {
  expandMatrix,
  packedBytes,
  percentile,
  timeScenario,
  timeStats,
} from '../bench/matrix.mjs';
import * as harness from '../bench/harness.mjs';
import {
  RESIMS,
  RESIM_CARD,
  batchResult,
  browserOf,
  deviceLabel,
  deviceRow,
  liveVerdict,
  obsFactor,
  passAccepted,
  platformOf,
  quantiles,
  resimTicks,
  type BenchReport,
  type PresetResult,
} from '../src/bench/kit';
import { parsePagePath } from '../src/pages/routes';
import { robotsTxt } from '../src/seo/robots';
import { INDEXABLE_ROUTES, pageSource } from '../src/seo/site';
import { sitemapXml } from '../src/seo/sitemap';
import { DT } from '../src/sim/engine';
import { CARDS_BY_MV, CARD_IDS } from '../src/sim/free/cards';
import { FREE_MODEL_VERSION } from '../src/sim/free/config';
import { RESIM_LIMIT_MS } from '../src/ui/live-gates';
import { PAUSE_WINDOW, cardTick } from '../src/ui/live-model';
import { findHtmlEntries } from '../vite.pages';

/*
 * The live benchmark kit (`/bench/`, #191, docs/PERFORMANCE.md "Live benchmark"): its statistics
 * and gate verdicts, which are pure, and the checks that keep the page hidden (noindex, outside the
 * sitemap, linked from nowhere) and silent (no network call). The timing itself runs in a browser.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const spec: unknown = JSON.parse(read('bench/scenarios.json'));

describe('stats', () => {
  it('interpolates percentiles like the bench scripts', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBeNaN();
    const xs = Array.from({ length: 21 }, (_, i) => i * 10); // 0..200
    expect(percentile(xs, 0.95)).toBe(190);
  });

  it('gives p50, p95 and max, ignoring non-finite values, in any order', () => {
    expect(quantiles([5, 1, 4, 2, 3])).toEqual({ p50: 3, p95: 4.8, max: 5 });
    expect(quantiles([NaN, 2, Infinity, 4])).toEqual({ p50: 3, p95: 3.9, max: 4 });
    const empty = quantiles([]);
    expect(empty.p50).toBeNaN();
    expect(empty.p95).toBeNaN();
    expect(empty.max).toBeNaN();
  });

  it('summarises a batch from its per-run times', () => {
    const b = batchResult([4, 2, 8, 6], 3, 9.5);
    expect(b).toMatchObject({ runs: 4, workers: 3, msPerRun: 5, wallMs: 9.5 });
    expect(b.msPerRunP95).toBeCloseTo(7.7, 10);
  });
});

describe('gate verdict', () => {
  const limit = RESIM_LIMIT_MS / 1.5;

  it('passes gate (a) exactly up to 500 ms ÷ 1.5 of the live run', () => {
    expect(liveVerdict(limit, [100]).gate).toBe('pass');
    expect(liveVerdict(limit + 0.01, [100]).gate).toBe('fail');
    expect(liveVerdict(NaN, [100]).gate).toBe('fail');
  });

  it('applies the 500 ms p95 budget only to presets that pass the gate', () => {
    expect(liveVerdict(100, [100, 200, 300]).withinBudget).toBe(true);
    expect(liveVerdict(100, [100, 200, 300, 400, 900]).withinBudget).toBe(false);
    expect(liveVerdict(100, Array(20).fill(500) as number[]).withinBudget).toBe(true);
    expect(liveVerdict(400, [900, 900]).withinBudget).toBeNull();
    expect(liveVerdict(100, []).withinBudget).toBe(false);
  });

  it('accepts a pass when no gate-passing preset is over budget', () => {
    const p = (gate: number, resim: number[]): PresetResult =>
      ({ verdict: liveVerdict(gate, resim) }) as PresetResult;
    expect(passAccepted([p(100, [200]), p(900, [2000])])).toBe(true);
    expect(passAccepted([p(100, [200]), p(100, [600])])).toBe(false);
    expect(passAccepted([])).toBe(true);
  });
});

describe('re-simulation ticks', () => {
  it('spreads K card ticks evenly over the pause window, as a picked card would apply', () => {
    const ticks = resimTicks(100);
    expect(ticks).toHaveLength(RESIMS);
    expect(ticks[0]).toBe(cardTick(PAUSE_WINDOW[0] * 100));
    expect(ticks.at(-1)).toBe(cardTick(PAUSE_WINDOW[1] * 100));
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1] as number);
    }
    expect(resimTicks(100, 1)).toEqual([cardTick(((PAUSE_WINDOW[0] + PAUSE_WINDOW[1]) / 2) * 100)]);
    expect(resimTicks(100, 0)).toEqual([]);
    expect(resimTicks(NaN, 2)).toEqual([cardTick(0), cardTick(0)]);
    expect(cardTick(0)).toBe(1);
    expect(DT).toBeGreaterThan(0);
  });

  it('plays a card every model has, needing neither morale nor the what-if pack', () => {
    const code = CARD_IDS.indexOf(RESIM_CARD);
    expect(code).toBeGreaterThanOrEqual(0);
    for (const cat of Object.values(CARDS_BY_MV)) {
      const def = cat[RESIM_CARD];
      expect(def.target).toBe('one');
      expect(def.needs).toBeUndefined();
    }
  });
});

describe('OBS factor', () => {
  const p = (id: string, msPerRun: number): PresetResult =>
    ({ id, batch: { msPerRun } }) as PresetResult;

  it('is the median of OBS ÷ plain batch ms/run over the presets both passes have', () => {
    const f = obsFactor([p('a', 2), p('b', 4), p('c', 10)], [p('a', 3), p('b', 4), p('d', 1)]);
    expect(f).toEqual({ median: 1.25, byPreset: { a: 1.5, b: 1 } });
    expect(obsFactor([p('a', 2)], null)).toBeNull();
    expect(obsFactor([p('a', 0)], [p('a', 1)])).toBeNull();
  });
});

describe('device and report row', () => {
  const chromeWin =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
  const safariIos =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  it('names the browser and platform from the user agent', () => {
    expect(browserOf(chromeWin)).toBe('Chrome 156');
    expect(platformOf(chromeWin)).toBe('Windows');
    expect(browserOf(safariIos)).toBe('Safari 18');
    expect(platformOf(safariIos)).toBe('iOS');
    expect(browserOf(`${chromeWin} Edg/156.0`)).toBe('Edge 156');
    expect(browserOf('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko Firefox/140.0')).toBe(
      'Firefox 140',
    );
    expect(deviceLabel({ cores: 8, memoryGb: 8, userAgent: chromeWin })).toBe(
      '8 cores, 8 GB, Chrome 156 on Windows',
    );
    expect(deviceLabel({ cores: null, memoryGb: null, userAgent: safariIos })).toBe(
      '? cores, Safari 18 on iOS',
    );
  });

  it('writes the Real devices row from a report', () => {
    const preset = (id: string, live: number, resim: number[], wallMs: number): PresetResult => ({
      id,
      agents: 2,
      liveSimMs: live,
      durationS: 60,
      ticks: [],
      resimMs: resim,
      verdict: liveVerdict(live, resim),
      batch: batchResult([1, 2, 3], 3, wallMs),
    });
    const report: BenchReport = {
      kind: 'trex-live-bench',
      version: '0.2.31',
      build: 'abc',
      date: '2026-11-19T10:00:00.000Z',
      device: { cores: 4, memoryGb: null, userAgent: chromeWin },
      workers: 3,
      mv: FREE_MODEL_VERSION,
      seed: 1,
      resims: RESIMS,
      card: RESIM_CARD,
      passes: [
        {
          obs: false,
          presets: [
            preset('elephants-pride', 20, [20, 30], 4321.4),
            preset('lion-tiger', 2, [2, 3], 200),
            preset('trex-erectus-100', 400, [500], 7000),
          ],
          accepted: true,
        },
      ],
      obsFactor: null,
      matrix: {
        scenarios: [
          ['scale-1v1', 'scale', 0.31],
          ['scale-10v100', 'scale', 19.8],
          ['scale-50v1000', 'scale', 448],
          ['preset-lion-tiger-allIn', 'preset', 1.1],
          ['preset-trex-erectus-100-allIn', 'preset', 28.6],
        ].map(([id, group, ms]) => ({
          id: id as string,
          group: group as 'scale' | 'preset',
          flight: 'allIn' as const,
          runs: 10,
          msMedian: ms as number,
          msP95: ms as number,
          hash: '0123456789abcdef',
        })),
        hash: 'fedcba9876543210',
        totalMs: 1,
      },
    };
    expect(deviceRow(report, 'container')).toBe(
      '| 0.2.31 | 2026-11-19 | 4 cores, Chrome 156 on Windows | 3 | 0.31 / 19.8 / 448 | ' +
        '`trex-erectus-100`, 28.6 | 29.5 (`elephants-pride`) | 2 / 3 | 4,321 | – | ' +
        '`fedcba9876543210` | container |',
    );
  });
});

describe('shared timing loop', () => {
  it('times a scenario as `npm run bench` does, with the same hash', () => {
    const [s] = expandMatrix(spec, harness, { reduced: true });
    if (!s) throw new Error('empty matrix');
    const small = { ...s, runs: 4 };
    const t = timeScenario(harness, spec, small, { minMs: 0 });
    expect(t.times).toHaveLength(4);
    expect(t.packed).toHaveLength(1);
    const stats = timeStats(t);
    expect(stats.msMedian).toBeGreaterThan(0);
    const hash = createHash('sha256')
      .update(packedBytes(t.packed[0] as Float64Array))
      .digest('hex')
      .slice(0, 16);
    expect(measure(harness, spec, small).hash).toBe(hash);
  });
});

// ---------- the page stays hidden and silent ----------

describe('/bench/ page', () => {
  const html = read('bench/index.html');

  it('is a build entry, noindex, outside the page registry, sitemap and robots rules', () => {
    expect(findHtmlEntries(ROOT)['bench']).toBe(join(ROOT, 'bench/index.html'));
    expect(html).toMatch(/<meta name="robots" content="noindex[^"]*" \/>/);
    expect(parsePagePath('/bench/')).toBeNull();
    expect(INDEXABLE_ROUTES.map((r) => pageSource(r.page, r.lang))).not.toContain(
      'bench/index.html',
    );
    expect(sitemapXml(() => null)).not.toMatch(/bench/);
    expect(robotsTxt()).not.toMatch(/bench/);
  });

  it('is served with X-Robots-Tag: noindex', () => {
    const headers = read('public/_headers');
    expect(headers).toMatch(/^\/bench\/\*\n {2}X-Robots-Tag: noindex$/m);
  });

  it('is linked from no other page', () => {
    for (const file of Object.values(findHtmlEntries(ROOT))) {
      const rel = relative(ROOT, file);
      if (rel === join('bench', 'index.html')) continue;
      expect(readFileSync(file, 'utf8'), rel).not.toMatch(/href="[^"]*\/bench\//);
    }
    const sources = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter(
      (f) => f.endsWith('.ts') && !f.startsWith('bench'),
    );
    for (const f of sources) {
      expect(read(join('src', f)), f).not.toMatch(/['"`]\/bench\//);
    }
  });

  it('makes no network call: no fetch, beacon, XHR, socket or event source', () => {
    for (const f of ['main.ts', 'kit.ts', 'protocol.ts', 'bench.worker.ts']) {
      const src = read(join('src/bench', f));
      expect(src, f).not.toMatch(
        /\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|EventSource|navigator\.share/,
      );
    }
  });

  it('builds its DOM without innerHTML (Trusted Types)', () => {
    expect(read('src/bench/main.ts')).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
});
