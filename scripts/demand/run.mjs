// Demand pulls for docs/research/DEMAND.md (RENEWAL-1.0.md §5.3 step 1, #190).
//
//   YOUTUBE_API_KEY=… node scripts/demand/run.mjs [--today YYYY-MM-DD] [--refresh]
//                                                  [--max-search 60] [--out <file.json>]
//
// Dev-only, no dependencies: Node's built-in fetch against three public APIs, no HTML pages.
//   wiki     Wikimedia REST pageviews, en and ko Wikipedia, daily summed by month, user agents only
//   reddit   Arctic Shift post counts: r/whowouldwin titles matching the species' keywords
//   youtube  YouTube Data API search.list (100 units a call) and videos.list (1 unit a call);
//            skipped with a note when YOUTUBE_API_KEY is unset
//
// The window is the last 12 complete calendar months before --today (default: the current
// date, UTC). Species and search terms come from scripts/demand/species.json. Raw responses are
// cached under scripts/demand/.cache/ (gitignored) so a rerun spends no quota; entries older than
// 30 days are deleted at start, which also keeps YouTube API data within its 30-day storage limit.
// The results file (default docs/research/demand-results.json) holds only totals per species and
// source, never a key or per-video data. The key is added to a request URL at send time only and
// redacted from every error message. Behind an HTTP proxy, set NODE_USE_ENV_PROXY=1.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, env, stdout } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  USER_AGENT,
  WEIGHTS,
  arcticAggregateUrl,
  combinedScores,
  monthWindow,
  parseArcticAggregate,
  parseWikiPageviews,
  parseYoutubeSearch,
  parseYoutubeVideos,
  redact,
  sum,
  wikiPageviewsUrl,
  windowDays,
  youtubeSearchParams,
  youtubeVideosParams,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(HERE, '.cache');
const CACHE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const SUBREDDIT = 'whowouldwin';
const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const GAP_MS = { wiki: 1000, reddit: 2000, youtube: 200 };
const MAX_ATTEMPTS = 8;

const args = argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REFRESH = args.includes('--refresh');
const TODAY = option('--today') ?? new Date().toISOString().slice(0, 10);
const MAX_SEARCH = Number(option('--max-search') ?? 60);
const OUT = option('--out') ?? path.join(ROOT, 'docs', 'research', 'demand-results.json');
const KEY = env.YOUTUBE_API_KEY || undefined;

if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) throw new Error(`--today must be YYYY-MM-DD`);
const window = monthWindow(new Date(`${TODAY}T00:00:00Z`));
const { species } = JSON.parse(readFileSync(path.join(HERE, 'species.json'), 'utf8'));
const log = (line) => stdout.write(`${line}\n`);
const errors = [];
const quota = { searchCalls: 0, videosCalls: 0, cachedSearch: 0, cachedVideos: 0 };

pruneCache();
log(`demand window ${window.start} .. ${window.end} (exclusive), ${species.length} species`);

const lastCall = {};
async function throttle(source) {
  const wait = (lastCall[source] ?? 0) + GAP_MS[source] - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall[source] = Date.now();
}

function pruneCache() {
  mkdirSync(CACHE, { recursive: true });
  for (const file of readdirSync(CACHE)) {
    const full = path.join(CACHE, file);
    if (Date.now() - statSync(full).mtimeMs > CACHE_MAX_AGE_MS) rmSync(full);
  }
}

const cachePath = (source, url) =>
  path.join(CACHE, `${source}-${createHash('sha256').update(url).digest('hex').slice(0, 32)}.json`);

/**
 * GET a JSON body with the cache, a per-source gap and retries on 429 / 5xx (honouring
 * Retry-After) and on Arctic Shift's in-body timeouts. `url` never contains the key; `withKey`
 * appends it to the request only. A 404 returns null when `allow404`.
 */
async function getJson(source, url, { withKey = false, allow404 = false } = {}) {
  const file = cachePath(source, url);
  if (!REFRESH) {
    try {
      const hit = JSON.parse(readFileSync(file, 'utf8'));
      return { body: hit.body, cached: true };
    } catch {
      // not cached yet
    }
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle(source);
    const target = withKey ? `${url}&key=${encodeURIComponent(KEY)}` : url;
    // A network error is reduced to its redacted message (not kept as `cause`, which could
    // carry the request URL and with it the key).
    const res = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        'Api-User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    }).catch((err) => redact(err?.cause?.message ?? err?.message ?? err, KEY));
    if (typeof res === 'string') {
      if (attempt === MAX_ATTEMPTS) throw new Error(`${source}: ${res}`);
      await backoff(source, attempt, undefined, res);
      continue;
    }
    if (res.status === 404 && allow404) {
      writeFileSync(file, JSON.stringify({ url, status: 404, body: null }));
      return { body: null, cached: false };
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`${source}: HTTP ${res.status} after retries`);
      await backoff(source, attempt, res.headers.get('retry-after'), `HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    // Arctic Shift reports a query timeout as HTTP 422 with `error` in the body; retry it.
    const timedOut = source === 'reddit' && /timeout/i.test(text);
    if (!res.ok && !timedOut)
      throw new Error(redact(`${source}: HTTP ${res.status} ${text.slice(0, 300)}`, KEY));
    const body = JSON.parse(text);
    if (source === 'reddit' && (timedOut || body.error)) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`reddit: ${body.error}`);
      await backoff(source, attempt, undefined, String(body.error));
      continue;
    }
    writeFileSync(file, JSON.stringify({ url, status: res.status, body }));
    return { body, cached: false };
  }
  throw new Error(`${source}: unreachable`);
}

async function backoff(source, attempt, retryAfter, why) {
  const hinted = Number(retryAfter);
  const seconds =
    Number.isFinite(hinted) && hinted > 0
      ? Math.min(hinted, 120)
      : Math.min(5 * 2 ** (attempt - 1), 90);
  log(`  ${source}: ${why}, retry ${attempt} in ${seconds}s`);
  await sleep(seconds * 1000);
}

async function wiki(sp, lang) {
  const articles = {};
  const monthly = {};
  for (const title of sp.wiki[lang]) {
    const { body } = await getJson('wiki', wikiPageviewsUrl(lang, title, window), {
      allow404: true,
    });
    if (body === null) {
      articles[title] = null;
      errors.push(`wiki ${lang} "${title}": no such article (404)`);
      continue;
    }
    const parsed = parseWikiPageviews(body);
    if (parsed.days < windowDays(window)) {
      errors.push(
        `wiki ${lang} "${title}": ${parsed.days} of ${windowDays(window)} days in the series (the API omits days without views)`,
      );
    }
    articles[title] = parsed.total;
    for (const [k, v] of Object.entries(parsed.monthly)) monthly[k] = (monthly[k] ?? 0) + v;
  }
  const found = Object.values(articles).filter((v) => v !== null);
  return { articles, total: found.length ? sum(found) : null, monthly };
}

async function reddit(sp) {
  const { body } = await getJson('reddit', arcticAggregateUrl(SUBREDDIT, sp.reddit, window));
  const parsed = parseArcticAggregate(body);
  return { query: sp.reddit, ...parsed };
}

async function youtube(sp, lang) {
  const query = sp.youtube[lang];
  const search = await getJson(
    'youtube',
    `${YT_BASE}/search?${youtubeSearchParams(query, lang, window)}`,
    {
      withKey: true,
    },
  );
  if (search.cached) quota.cachedSearch++;
  else quota.searchCalls++;
  const { totalResults, videoIds } = parseYoutubeSearch(search.body);
  let topViews = 0;
  if (videoIds.length) {
    const videos = await getJson('youtube', `${YT_BASE}/videos?${youtubeVideosParams(videoIds)}`, {
      withKey: true,
    });
    if (videos.cached) quota.cachedVideos++;
    else quota.videosCalls++;
    topViews = parseYoutubeVideos(videos.body).topViews;
  }
  return { query, totalResults, videos: videoIds.length, topViews };
}

async function guarded(label, fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = redact(err?.message ?? err, KEY);
    errors.push(`${label}: ${msg}`);
    log(`  ! ${label}: ${msg}`);
    return null;
  }
}

/** Searches this run would send (not in the cache), checked against --max-search first. */
function uncachedSearches() {
  let n = 0;
  for (const sp of species) {
    for (const lang of ['en', 'ko']) {
      const url = `${YT_BASE}/search?${youtubeSearchParams(sp.youtube[lang], lang, window)}`;
      try {
        if (REFRESH) throw new Error('refresh');
        statSync(cachePath('youtube', url));
      } catch {
        n++;
      }
    }
  }
  return n;
}

let youtubeEnabled = Boolean(KEY);
if (!KEY) {
  errors.push('youtube: YOUTUBE_API_KEY is not set, YouTube skipped');
} else {
  const pending = uncachedSearches();
  log(`youtube: ${pending} search.list calls to send (limit ${MAX_SEARCH})`);
  if (pending > MAX_SEARCH) {
    youtubeEnabled = false;
    errors.push(`youtube: ${pending} uncached searches exceed --max-search ${MAX_SEARCH}, skipped`);
  }
}

const rows = [];
for (const sp of species) {
  log(`${sp.id}`);
  const row = {
    id: sp.id,
    group: sp.group,
    issue: sp.issue,
    en: sp.en,
    ko: sp.ko,
    terms: { wiki: sp.wiki, reddit: sp.reddit, youtube: sp.youtube },
    wiki: {
      en: await guarded(`wiki en ${sp.id}`, () => wiki(sp, 'en')),
      ko: await guarded(`wiki ko ${sp.id}`, () => wiki(sp, 'ko')),
    },
    reddit: await guarded(`reddit ${sp.id}`, () => reddit(sp)),
    youtube: youtubeEnabled
      ? {
          en: await guarded(`youtube en ${sp.id}`, () => youtube(sp, 'en')),
          ko: await guarded(`youtube ko ${sp.id}`, () => youtube(sp, 'ko')),
        }
      : { en: null, ko: null },
  };
  rows.push(row);
}

const scores = combinedScores(
  rows.map((r) => ({
    id: r.id,
    metrics: {
      reddit: r.reddit?.total ?? null,
      youtubeEn: r.youtube.en?.topViews ?? null,
      youtubeKo: r.youtube.ko?.topViews ?? null,
      wikiEn: r.wiki.en?.total ?? null,
      wikiKo: r.wiki.ko?.total ?? null,
    },
  })),
);

const result = {
  runDate: TODAY,
  window,
  sources: {
    wiki: 'Wikimedia REST per-article pageviews, all-access, agent=user, daily summed by month; totals sum the listed articles',
    reddit: `Arctic Shift posts/search/aggregate, r/${SUBREDDIT}, title keyword search, monthly`,
    youtube:
      'YouTube Data API search.list (type=video, order=viewCount, maxResults=10, published in the window) and videos.list statistics; topViews sums the ten view counts; totalResults is the API estimate',
  },
  weights: WEIGHTS,
  youtubeQuota: {
    ...quota,
    units: quota.searchCalls * 100 + quota.videosCalls,
    datasetUnits:
      (quota.searchCalls + quota.cachedSearch) * 100 + quota.videosCalls + quota.cachedVideos,
  },
  species: rows,
  scores,
  errors,
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
log(`wrote ${path.relative(ROOT, OUT)}`);
log(
  `youtube quota this run: ${quota.searchCalls} search + ${quota.videosCalls} videos = ${result.youtubeQuota.units} units (${quota.cachedSearch} searches from cache); the data set cost ${result.youtubeQuota.datasetUnits} units in all`,
);
if (errors.length) log(`${errors.length} note(s):\n  ${errors.join('\n  ')}`);
