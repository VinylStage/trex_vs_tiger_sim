// Types for lib.mjs, so tests/demand.test.ts type-checks without allowJs.

export interface MonthWindow {
  /** First day of the first month, `YYYY-MM-DD`. */
  start: string;
  /** First day of the current month (exclusive), `YYYY-MM-DD`. */
  end: string;
  /** `YYYY-MM`, oldest first. */
  months: string[];
}

export interface MonthlyCounts {
  total: number;
  monthly: Record<string, number>;
}

export type SourceKey = 'reddit' | 'youtubeEn' | 'youtubeKo' | 'wikiEn' | 'wikiKo';
export type Weights = Readonly<Record<SourceKey, number>>;

export interface ScoreInput {
  id: string;
  metrics: Partial<Record<SourceKey, number | null>>;
}

export interface ScoredRow {
  id: string;
  parts: Record<SourceKey, number | null>;
  score: number;
  coverage: number;
  rank: number;
}

export type Tier = 'high' | 'mid' | 'low';

export interface PublishedScore {
  id: string;
  rank: number;
  /** Integer, 0–100. */
  score: number;
  coverage: number;
  /** Reddit and Wikipedia parts only; YouTube parts are never published. */
  parts: Partial<Record<SourceKey, number | null>>;
}

export const USER_AGENT: string;
export const TIERS: readonly Tier[];
export const UNPUBLISHED_SOURCES: readonly SourceKey[];
export function rankTiers(values: readonly (number | null | undefined)[]): (Tier | null)[];
export function publishScores(scored: readonly ScoredRow[]): PublishedScore[];
export const WEIGHTS: Weights;
export function monthWindow(today: Date, n?: number): MonthWindow;
export function wikiPageviewsUrl(lang: string, title: string, window: MonthWindow): string;
export function windowDays(window: MonthWindow): number;
export function parseWikiPageviews(json: unknown): MonthlyCounts & { days: number };
export function arcticAggregateUrl(subreddit: string, query: string, window: MonthWindow): string;
export function parseArcticAggregate(json: unknown): MonthlyCounts;
export function youtubeSearchParams(
  query: string,
  lang: 'en' | 'ko',
  window: MonthWindow,
): URLSearchParams;
export function youtubeVideosParams(ids: readonly string[]): URLSearchParams;
export function parseYoutubeSearch(json: unknown): { totalResults: number; videoIds: string[] };
export function parseYoutubeVideos(json: unknown): { views: number[]; topViews: number };
export function redact(text: unknown, secret: string | undefined): string;
export function sum(values: Iterable<number>): number;
export function logScale(values: readonly (number | null | undefined)[]): (number | null)[];
export function combinedScores(rows: readonly ScoreInput[], weights?: Weights): ScoredRow[];
export function compact(n: number | null | undefined): string;
