import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FREE_SPECIES_IDS } from '../src/sim/free/species';
import {
  TIERS,
  UNPUBLISHED_SOURCES,
  USER_AGENT,
  WEIGHTS,
  arcticAggregateUrl,
  combinedScores,
  compact,
  logScale,
  monthWindow,
  parseArcticAggregate,
  parseWikiPageviews,
  parseYoutubeSearch,
  parseYoutubeVideos,
  publishScores,
  rankTiers,
  redact,
  wikiPageviewsUrl,
  windowDays,
  youtubeSearchParams,
  youtubeVideosParams,
} from '../scripts/demand/lib.mjs';

/* Pure helpers of the dev-only demand pulls (scripts/demand/, docs/research/DEMAND.md, #190). */

const W = monthWindow(new Date('2026-11-04T12:00:00Z'));

describe('monthWindow', () => {
  it('is the last 12 complete months, end exclusive', () => {
    expect(W.start).toBe('2025-11-01');
    expect(W.end).toBe('2026-11-01');
    expect(W.months).toHaveLength(12);
    expect(W.months[0]).toBe('2025-11');
    expect(W.months[11]).toBe('2026-10');
    expect(windowDays(W)).toBe(365);
  });

  it('crosses a year boundary and takes the month count', () => {
    const w = monthWindow(new Date('2026-01-01T00:00:00Z'), 3);
    expect(w).toEqual({
      start: '2025-10-01',
      end: '2026-01-01',
      months: ['2025-10', '2025-11', '2025-12'],
    });
  });

  it('rejects a bad month count', () => {
    expect(() => monthWindow(new Date(), 0)).toThrow();
  });
});

describe('Wikimedia pageviews', () => {
  it('builds the per-article daily URL ending on the last day of the window', () => {
    expect(wikiPageviewsUrl('ko', '호모 에렉투스', W)).toBe(
      'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia/all-access/user/' +
        `${encodeURIComponent('호모_에렉투스')}/daily/2025110100/2026103100`,
    );
  });

  it('sums daily items into months', () => {
    const json = {
      items: [
        { timestamp: '2025110100', views: 4 },
        { timestamp: '2025113000', views: 6 },
        { timestamp: '2025120100', views: 5 },
      ],
    };
    expect(parseWikiPageviews(json)).toEqual({
      total: 15,
      monthly: { '2025-11': 10, '2025-12': 5 },
      days: 3,
    });
  });

  it('rejects malformed responses', () => {
    expect(() => parseWikiPageviews({})).toThrow();
    expect(() => parseWikiPageviews({ items: [{ timestamp: 'x', views: 1 }] })).toThrow();
  });
});

describe('Arctic Shift aggregate', () => {
  it('builds a title search over the window', () => {
    const url = new URL(arcticAggregateUrl('whowouldwin', 'hippo OR hippos', W));
    expect(url.pathname).toBe('/api/posts/search/aggregate');
    expect(url.searchParams.get('title')).toBe('hippo OR hippos');
    expect(url.searchParams.get('after')).toBe('2025-11-01');
    expect(url.searchParams.get('before')).toBe('2026-11-01');
    expect(url.searchParams.get('frequency')).toBe('month');
  });

  it('maps local-midnight buckets to their month and parses string counts', () => {
    const json = {
      data: [
        { created_utc: '2025-10-31T23:00:00.000Z', count: '3' },
        { created_utc: '2026-03-31T22:00:00.000Z', count: '7' },
      ],
    };
    expect(parseArcticAggregate(json)).toEqual({
      total: 10,
      monthly: { '2025-11': 3, '2026-04': 7 },
    });
  });

  it('throws on an in-body error such as a timeout', () => {
    expect(() =>
      parseArcticAggregate({ data: null, error: 'Timeout. Maybe slow down a bit' }),
    ).toThrow(/Timeout/);
    expect(() => parseArcticAggregate({ data: [{ created_utc: 'x', count: '1' }] })).toThrow();
  });
});

describe('YouTube Data API', () => {
  it('search parameters carry no key and stay inside the window', () => {
    const p = youtubeSearchParams('하마 vs', 'ko', W);
    expect(p.has('key')).toBe(false);
    expect(p.get('q')).toBe('하마 vs');
    expect(p.get('regionCode')).toBe('KR');
    expect(p.get('order')).toBe('viewCount');
    expect(p.get('publishedAfter')).toBe('2025-11-01T00:00:00Z');
    expect(p.get('publishedBefore')).toBe('2026-11-01T00:00:00Z');
    expect(() => youtubeSearchParams('x', 'de' as 'en', W)).toThrow();
  });

  it('videos parameters take at most 50 ids', () => {
    expect(youtubeVideosParams(['a', 'b']).get('id')).toBe('a,b');
    expect(() => youtubeVideosParams(Array.from({ length: 51 }, (_, i) => `v${i}`))).toThrow();
  });

  it('parses totalResults and video ids', () => {
    const json = {
      pageInfo: { totalResults: 1000000, resultsPerPage: 10 },
      items: [
        { id: { kind: 'youtube#video', videoId: 'abc' } },
        { id: { kind: 'youtube#channel' } },
      ],
    };
    expect(parseYoutubeSearch(json)).toEqual({ totalResults: 1000000, videoIds: ['abc'] });
    expect(() => parseYoutubeSearch({ error: { message: 'quotaExceeded' } })).toThrow(
      /quotaExceeded/,
    );
  });

  it('sums view counts and skips hidden ones', () => {
    const json = {
      items: [
        { statistics: { viewCount: '120' } },
        { statistics: {} },
        { statistics: { viewCount: '30' } },
      ],
    };
    expect(parseYoutubeVideos(json)).toEqual({ views: [120, 30], topViews: 150 });
  });
});

describe('combined score', () => {
  it('log-scales against the largest value and keeps null', () => {
    expect(logScale([0, 9, 99, null])).toEqual([0, 0.5, 1, null]);
    expect(logScale([0, 0])).toEqual([0, 0]);
    expect(() => logScale([-1])).toThrow();
  });

  it('weights sum to 1 and battle-specific sources carry most of it', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(WEIGHTS.reddit + WEIGHTS.youtubeEn + WEIGHTS.youtubeKo).toBeCloseTo(0.7, 12);
  });

  it('ranks by the weighted mean and rescales over missing sources', () => {
    const rows = combinedScores([
      { id: 'a', metrics: { reddit: 99, youtubeEn: 99, youtubeKo: 99, wikiEn: 99, wikiKo: 99 } },
      { id: 'b', metrics: { reddit: 9, youtubeEn: 9, youtubeKo: 9, wikiEn: 9, wikiKo: 9 } },
      {
        id: 'c',
        metrics: { reddit: 99, youtubeEn: null, youtubeKo: null, wikiEn: null, wikiKo: null },
      },
    ]);
    expect(rows.map((r) => [r.id, r.score, r.rank])).toEqual([
      ['a', 100, 1],
      ['c', 100, 2],
      ['b', 50, 3],
    ]);
    expect(rows.find((r) => r.id === 'c')?.coverage).toBe(0.3);
    expect(rows.find((r) => r.id === 'a')?.parts.wikiKo).toBe(1);
  });

  it('scores a row with no data as 0 with zero coverage', () => {
    const [row] = combinedScores([{ id: 'x', metrics: {} }]);
    expect(row).toMatchObject({ score: 0, coverage: 0, rank: 1 });
  });
});

describe('YouTube tiers', () => {
  it('cuts the ranked values into thirds by position', () => {
    // 6 values: two per tier, largest first; input order does not matter.
    expect(rankTiers([10, 60, 30, 50, 20, 40])).toEqual([
      'low',
      'high',
      'mid',
      'high',
      'low',
      'mid',
    ]);
  });

  it('splits 19 species 7 / 6 / 6', () => {
    const tiers = rankTiers(Array.from({ length: 19 }, (_, i) => 19 - i));
    expect(TIERS.map((t) => tiers.filter((x) => x === t).length)).toEqual([7, 6, 6]);
    expect(tiers.slice(0, 7).every((t) => t === 'high')).toBe(true);
    expect(tiers.slice(13).every((t) => t === 'low')).toBe(true);
  });

  it('keeps null as no data, ranks only present values and breaks ties by input order', () => {
    expect(rankTiers([5, null, 5, 1])).toEqual(['high', null, 'mid', 'low']);
    expect(rankTiers([null, undefined])).toEqual([null, null]);
    expect(rankTiers([7])).toEqual(['high']);
    expect(() => rankTiers([-1])).toThrow();
    expect(() => rankTiers([Number.NaN])).toThrow();
  });
});

describe('published scores', () => {
  it('round to whole points and drop the YouTube parts', () => {
    const scored = combinedScores([
      { id: 'a', metrics: { reddit: 99, youtubeEn: 9, youtubeKo: 99, wikiEn: 9, wikiKo: 99 } },
      { id: 'b', metrics: { reddit: 9, youtubeEn: 99, youtubeKo: 9, wikiEn: 99, wikiKo: 9 } },
    ]);
    const published = publishScores(scored);
    expect(published.map((r) => r.id)).toEqual(scored.map((r) => r.id));
    for (const [i, r] of published.entries()) {
      const src = scored[i];
      expect(Number.isInteger(r.score)).toBe(true);
      expect(r.score).toBe(Math.round(src?.score ?? Number.NaN));
      expect(r.rank).toBe(src?.rank);
      expect(Object.keys(r.parts).sort()).toEqual(['reddit', 'wikiEn', 'wikiKo']);
    }
    expect(UNPUBLISHED_SOURCES).toEqual(['youtubeEn', 'youtubeKo']);
  });
});

describe('committed demand-results.json', () => {
  const results = JSON.parse(readFileSync('docs/research/demand-results.json', 'utf8')) as {
    weights: Record<string, number>;
    species: { id: string; youtube: Record<string, unknown> }[];
    scores: { score: number; parts: Record<string, unknown> }[];
  } & Record<string, unknown>;

  /** Paths of every number in `value` (arrays and objects walked). */
  function numberPaths(value: unknown, at: string, out: string[] = []): string[] {
    if (typeof value === 'number') out.push(at);
    else if (Array.isArray(value)) value.forEach((v, i) => numberPaths(v, `${at}[${i}]`, out));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) numberPaths(v, `${at}.${k}`, out);
    }
    return out;
  }

  it('holds no YouTube figure: only a tier per species and language', () => {
    for (const s of results.species) {
      expect(Object.keys(s.youtube).sort(), s.id).toEqual(['en', 'ko']);
      for (const tier of Object.values(s.youtube)) {
        expect([...TIERS, null], s.id).toContain(tier);
      }
    }
    // Any number on a YouTube path fails, except the two that are not API data: the score
    // weights (configuration) and youtubeQuota (this project's own request counts).
    const exempt = /^\$\.(weights|youtubeQuota)\./;
    const leaked = numberPaths(results, '$').filter(
      (p) => /youtube|topViews|totalResults|views/i.test(p) && !exempt.test(p),
    );
    expect(leaked).toEqual([]);
  });

  it('publishes whole-point scores without YouTube parts', () => {
    for (const s of results.scores) {
      expect(Number.isInteger(s.score)).toBe(true);
      for (const k of UNPUBLISHED_SOURCES) expect(s.parts).not.toHaveProperty(k);
    }
  });
});

describe('helpers', () => {
  it('redacts every occurrence of a secret', () => {
    expect(redact('a SECRET b SECRET', 'SECRET')).toBe('a [redacted] b [redacted]');
    expect(redact('plain', undefined)).toBe('plain');
  });

  it('formats compact counts', () => {
    expect([
      compact(null),
      compact(999),
      compact(1234),
      compact(45_678),
      compact(1_234_567),
    ]).toEqual(['–', '999', '1.2k', '46k', '1.23M']);
  });

  it('identifies itself without contact details', () => {
    expect(USER_AGENT).toMatch(/^trex-vs-tiger-demand\/\d/);
    expect(USER_AGENT).not.toMatch(/@/);
  });
});

describe('species list', () => {
  const { species } = JSON.parse(readFileSync('scripts/demand/species.json', 'utf8')) as {
    species: {
      id: string;
      group: string;
      wiki: { en: string[]; ko: string[] };
      reddit: string;
      youtube: { en: string; ko: string };
    }[];
  };

  it('has unique ids, en and ko terms for every source', () => {
    expect(new Set(species.map((s) => s.id)).size).toBe(species.length);
    for (const s of species) {
      expect(['sim', 'candidate']).toContain(s.group);
      expect(s.wiki.en.length).toBeGreaterThan(0);
      expect(s.wiki.ko.length).toBeGreaterThan(0);
      expect(s.reddit.length).toBeGreaterThan(0);
      expect(s.youtube.en.length).toBeGreaterThan(0);
      expect(s.youtube.ko.length).toBeGreaterThan(0);
    }
  });

  it('lists every species the free engine has as "sim"', () => {
    const sim = species.filter((s) => s.group === 'sim').map((s) => s.id);
    expect(sim).toEqual(expect.arrayContaining([...FREE_SPECIES_IDS]));
    expect(sim).toHaveLength(FREE_SPECIES_IDS.length);
  });

  it('keeps YouTube within the run budget (60 search.list calls)', () => {
    expect(species.length * 2).toBeLessThanOrEqual(60);
  });
});
