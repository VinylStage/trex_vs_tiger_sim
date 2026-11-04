// Pure helpers for the demand pulls (scripts/demand/run.mjs) and their tables
// (scripts/demand/tables.mjs). No I/O, no network, no clock: every function takes what it needs,
// so tests/demand.test.ts covers the window, the URL builders, the response parsers and the
// combined score without touching an API. Types: lib.d.mts.

export const USER_AGENT = 'trex-vs-tiger-demand/1.0 (https://trex-vs-tiger.vinylims.com)';

/** Sources in the combined score and their weights (DEMAND.md "Combined score"). */
export const WEIGHTS = Object.freeze({
  reddit: 0.3,
  youtubeEn: 0.2,
  youtubeKo: 0.2,
  wikiEn: 0.15,
  wikiKo: 0.15,
});

const pad2 = (n) => String(n).padStart(2, '0');
const ym = (y, m) => `${y}-${pad2(m)}`;

/**
 * The last `n` complete calendar months (UTC) before `today`. `start` is the first day of the
 * first month and `end` the first day of the current month (exclusive), both `YYYY-MM-DD`.
 */
export function monthWindow(today, n = 12) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`month count must be a positive integer`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const current = y * 12 + (m - 1);
  const months = [];
  for (let i = n; i >= 1; i--) {
    const idx = current - i;
    months.push(ym(Math.floor(idx / 12), (idx % 12) + 1));
  }
  return { start: `${months[0]}-01`, end: `${ym(y, m)}-01`, months };
}

/** Days in the window, end exclusive. */
export function windowDays(window) {
  return Math.round(
    (Date.parse(`${window.end}T00:00:00Z`) - Date.parse(`${window.start}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * Wikimedia REST per-article pageviews (all access, user agents only), daily over the window.
 * Daily rather than monthly: a month's monthly figure appears only days after it ends, while
 * the daily series is complete about a day later, so a run early in a month still sees the whole
 * last month. The parser sums the days into months.
 */
export function wikiPageviewsUrl(lang, title, window) {
  const article = encodeURIComponent(title.replaceAll(' ', '_'));
  const ts = (d) => `${d.replaceAll('-', '')}00`;
  const lastDay = new Date(Date.parse(`${window.end}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return (
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/' +
    `${lang}.wikipedia/all-access/user/${article}/daily/${ts(window.start)}/${ts(lastDay)}`
  );
}

/**
 * Monthly totals from a pageviews response, keyed `YYYY-MM`, their sum, and the number of
 * items (`days` for a daily series; days with no views are omitted by the API).
 */
export function parseWikiPageviews(json) {
  if (!json || !Array.isArray(json.items)) throw new Error('pageviews: no items array');
  const monthly = {};
  for (const item of json.items) {
    const t = String(item.timestamp ?? '');
    if (!/^\d{10}$/.test(t) || typeof item.views !== 'number') {
      throw new Error(`pageviews: bad item ${JSON.stringify(item)}`);
    }
    const key = `${t.slice(0, 4)}-${t.slice(4, 6)}`;
    monthly[key] = (monthly[key] ?? 0) + item.views;
  }
  return { total: sum(Object.values(monthly)), monthly, days: json.items.length };
}

/** Arctic Shift monthly post counts for a title keyword search in one subreddit. */
export function arcticAggregateUrl(subreddit, query, window) {
  const params = new URLSearchParams({
    aggregate: 'created_utc',
    frequency: 'month',
    subreddit,
    title: query,
    after: window.start,
    before: window.end,
  });
  return `https://arctic-shift.photon-reddit.com/api/posts/search/aggregate?${params}`;
}

/**
 * Monthly counts from an Arctic Shift aggregate response. Its month buckets start at local
 * midnight of the server's time zone (e.g. `2025-10-31T23:00:00.000Z` is November), so a bucket
 * is assigned to the UTC month 12 hours after its start. Counts arrive as strings.
 * A response with an `error` field (e.g. "Timeout. Maybe slow down a bit") throws.
 */
export function parseArcticAggregate(json) {
  if (!json || typeof json !== 'object') throw new Error('arctic-shift: not an object');
  if (json.error) throw new Error(`arctic-shift: ${json.error}`);
  if (!Array.isArray(json.data)) throw new Error('arctic-shift: no data array');
  const monthly = {};
  for (const row of json.data) {
    const t = Date.parse(row.created_utc);
    const count = Number(row.count);
    if (Number.isNaN(t) || !Number.isFinite(count) || count < 0) {
      throw new Error(`arctic-shift: bad row ${JSON.stringify(row)}`);
    }
    const d = new Date(t + 12 * 3600 * 1000);
    const key = ym(d.getUTCFullYear(), d.getUTCMonth() + 1);
    monthly[key] = (monthly[key] ?? 0) + count;
  }
  return { total: sum(Object.values(monthly)), monthly };
}

/** Region and language hints per search language. */
const YT_LOCALE = {
  en: { regionCode: 'US', relevanceLanguage: 'en' },
  ko: { regionCode: 'KR', relevanceLanguage: 'ko' },
};

/**
 * YouTube Data API `search.list` parameters, without the key (run.mjs adds it at request time,
 * so it never reaches a cache key, a log line or a results file). Ten videos published inside
 * the window, most viewed first.
 */
export function youtubeSearchParams(query, lang, window) {
  const locale = YT_LOCALE[lang];
  if (!locale) throw new Error(`youtube: unknown language ${lang}`);
  return new URLSearchParams({
    part: 'id',
    type: 'video',
    q: query,
    order: 'viewCount',
    maxResults: '10',
    publishedAfter: `${window.start}T00:00:00Z`,
    publishedBefore: `${window.end}T00:00:00Z`,
    regionCode: locale.regionCode,
    relevanceLanguage: locale.relevanceLanguage,
    safeSearch: 'none',
  });
}

/** `videos.list` parameters for view counts, without the key. */
export function youtubeVideosParams(ids) {
  if (ids.length > 50) throw new Error('youtube: videos.list takes at most 50 ids');
  return new URLSearchParams({ part: 'statistics', id: ids.join(','), maxResults: '50' });
}

/** `totalResults` (an estimate, see DEMAND.md) and the video ids of a search.list response. */
export function parseYoutubeSearch(json) {
  if (!json || typeof json !== 'object') throw new Error('youtube search: not an object');
  if (json.error) throw new Error(`youtube search: ${json.error.message ?? 'error'}`);
  const totalResults = json.pageInfo?.totalResults;
  if (typeof totalResults !== 'number') throw new Error('youtube search: no totalResults');
  const videoIds = (json.items ?? [])
    .map((item) => item?.id?.videoId)
    .filter((id) => typeof id === 'string');
  return { totalResults, videoIds };
}

/** View counts of a videos.list response, in response order. Hidden counts are skipped. */
export function parseYoutubeVideos(json) {
  if (!json || typeof json !== 'object') throw new Error('youtube videos: not an object');
  if (json.error) throw new Error(`youtube videos: ${json.error.message ?? 'error'}`);
  const views = [];
  for (const item of json.items ?? []) {
    const v = Number(item?.statistics?.viewCount);
    if (Number.isFinite(v) && v >= 0) views.push(v);
  }
  return { views, topViews: sum(views) };
}

/** Replaces every occurrence of `secret` in `text` (for error messages that might echo a URL). */
export function redact(text, secret) {
  const s = String(text);
  return secret ? s.split(secret).join('[redacted]') : s;
}

export function sum(values) {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Log-scaled share of the largest value: log10(1 + x) / log10(1 + max), in [0, 1]. `null`
 * (no data) stays `null`. With every value 0 or null, every number maps to 0.
 */
export function logScale(values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  for (const v of present) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`logScale: bad value ${v}`);
  }
  const max = present.length ? Math.max(...present) : 0;
  const denom = Math.log10(1 + max);
  return values.map((v) =>
    v === null || v === undefined ? null : denom === 0 ? 0 : Math.log10(1 + v) / denom,
  );
}

/**
 * Combined demand score per row: each source is log-scaled across all rows, then averaged with
 * `weights`. A source a row has no number for is left out of that row's average and the
 * remaining weights are rescaled; `coverage` is the weight share that was present.
 * Returns rows with `parts`, `score` (0–100, one decimal) and `coverage`, sorted by score
 * (ties by id), each with its 1-based `rank`.
 */
export function combinedScores(rows, weights = WEIGHTS) {
  const keys = Object.keys(weights);
  const scaled = Object.fromEntries(
    keys.map((k) => [k, logScale(rows.map((r) => r.metrics[k] ?? null))]),
  );
  const scored = rows.map((row, i) => {
    const parts = {};
    let acc = 0;
    let w = 0;
    for (const k of keys) {
      const s = scaled[k][i];
      parts[k] = s;
      if (s !== null) {
        acc += weights[k] * s;
        w += weights[k];
      }
    }
    const total = sum(keys.map((k) => weights[k]));
    return {
      id: row.id,
      parts,
      score: w === 0 ? 0 : Math.round((1000 * acc) / w) / 10,
      coverage: total === 0 ? 0 : Math.round((100 * w) / total) / 100,
    };
  });
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return scored.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** YouTube popularity tiers, most popular first (DEMAND.md "YouTube tiers"). */
export const TIERS = Object.freeze(['high', 'mid', 'low']);

/**
 * Coarse popularity tier per value, by rank thirds: the values present are ranked (largest
 * first, ties keep input order), and position `i` of `n` gets `TIERS[floor(3 * i / n)]`, so
 * the top third is `high`, the middle third `mid` and the bottom third `low` (19 species:
 * 7 / 6 / 6). `null` (no data) stays `null`. Only the tier is published, never the value, so
 * no YouTube figure can be read back from it.
 */
export function rankTiers(values) {
  const present = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    if (!Number.isFinite(v) || v < 0) throw new Error(`rankTiers: bad value ${v}`);
    present.push(i);
  });
  const order = [...present].sort((a, b) => values[b] - values[a] || a - b);
  const tiers = values.map(() => null);
  order.forEach((idx, pos) => {
    tiers[idx] = TIERS[Math.floor((3 * pos) / order.length)];
  });
  return tiers;
}

/** Sources whose figures may not be published (their parts are dropped from the output). */
export const UNPUBLISHED_SOURCES = Object.freeze(['youtubeEn', 'youtubeKo']);

/**
 * The committed form of `combinedScores` rows: the score rounded to an integer, the rank and
 * coverage, and only the parts of sources whose figures are public (Reddit, Wikipedia). With
 * YouTube's parts gone and the score coarsened to whole points, the YouTube share of a score
 * cannot be backed out from the published Reddit and Wikipedia numbers beyond a coarse band.
 */
export function publishScores(scored) {
  return scored.map((r) => ({
    id: r.id,
    rank: r.rank,
    score: Math.round(r.score),
    coverage: r.coverage,
    parts: Object.fromEntries(
      Object.entries(r.parts).filter(([k]) => !UNPUBLISHED_SOURCES.includes(k)),
    ),
  }));
}

/** 1234 → "1.2k", 1234567 → "1.23M"; null → "–". For tables only. */
export function compact(n) {
  if (n === null || n === undefined) return '–';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
