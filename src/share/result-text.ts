import type { ScenarioConfig } from '../sim/config.ts';
import type { FreeConfig } from '../sim/free/config.ts';
import type { FreeSpeciesId } from '../sim/free/species.ts';
import type { Lang } from '../i18n/lang.ts';
import { dictionary } from '../i18n/registry.ts';
import { DEFAULT_BASELINE } from './baseline.ts';
import { buffApplies, decodeAnyResultQuery, type FreeResultSummary } from './free-result-codec.ts';
import { sm } from './messages.ts';
import type { ResultSummary } from './result-codec.ts';

/*
 * Words and numbers derived from a result snapshot: winner, outcome tier, the difference to the
 * default matchup, the Wordle-style text share and the link-preview meta. Pure and DOM-free,
 * shared by the result page, the card and the Pages Function (docs/SHARING.md).
 */

export type Side = 'heavy' | 'pack' | 'draw';
export type Tier = 'landslide' | 'clear' | 'close' | 'upset' | 'stalemate';

/**
 * Cartoon emoji per species for the text share and the card text (owner decision, #51). Drawn
 * graphics stay abstract; emoji appear only as text. Species without an entry use the fallback.
 * Keyed by free species id, which covers every classic id too.
 */
export const SPECIES_EMOJI: Readonly<Partial<Record<FreeSpeciesId, string>>> = {
  trex: '🦖',
  elephant: '🐘',
  buffalo: '🐃',
  brownBear: '🐻',
  tiger: '🐅',
  lion: '🦁',
  wolf: '🐺',
  hyena: '🐾',
};
export const FALLBACK_EMOJI: Readonly<Record<'heavy' | 'pack', string>> = {
  heavy: '🔷',
  pack: '🔶',
};

export function speciesEmoji(id: string, role: 'heavy' | 'pack'): string {
  return Object.hasOwn(SPECIES_EMOJI, id)
    ? (SPECIES_EMOJI[id as FreeSpeciesId] as string)
    : FALLBACK_EMOJI[role];
}

/** Emoji cells of the text-share bar. */
export const BAR_CELLS: Readonly<Record<Side, string>> = { heavy: '🟦', pack: '🟧', draw: '⬜' };
export const BAR_LENGTH = 10;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Short species name for `n` animals in `lang`, capitalised ("T-Rex", "Tigers", "호랑이"). */
export function shortName(id: string, n: number, lang: Lang): string {
  const form = lang === 'en' && n !== 1 ? 'other' : 'one';
  const dict = dictionary(lang) as Readonly<Record<string, string>>;
  return capitalize(dict[`species.${id}.${form}`] ?? id);
}

export interface Shares {
  heavy: number;
  pack: number;
  draw: number;
}

export const sharesOf = (s: Pick<ResultSummary, 'n' | 'h' | 'p' | 'd'>): Shares => ({
  heavy: s.h / s.n,
  pack: s.p / s.n,
  draw: s.d / s.n,
});

const SIDES: readonly Side[] = ['heavy', 'pack', 'draw'];

/** Side with the highest share; ties go to heavy, then pack. */
export function winnerOf(sh: Shares): Side {
  return SIDES.reduce((a, b) => (sh[b] > sh[a] ? b : a));
}

export const BASELINE_SHARES: Shares = sharesOf(DEFAULT_BASELINE);

/**
 * Outcome tier (docs/SHARING.md#outcome-tiers): `stalemate` when draws lead; `upset` when the
 * winning side is not the one that wins the default matchup; otherwise by the margin between the
 * top two shares: ≥ 60 points `landslide`, < 20 points `close`, else `clear`.
 */
export function outcomeTier(sh: Shares, baseline: Shares = BASELINE_SHARES): Tier {
  const w = winnerOf(sh);
  if (w === 'draw') return 'stalemate';
  if (w !== winnerOf(baseline)) return 'upset';
  const sorted = SIDES.map((s) => sh[s]).sort((a, b) => b - a);
  const margin = (sorted[0] ?? 0) - (sorted[1] ?? 0);
  if (margin >= 0.6) return 'landslide';
  if (margin < 0.2) return 'close';
  return 'clear';
}

/** Whole percentage points of the winner's share minus the same side's share in the baseline. */
export function diffVsBaseline(sh: Shares, baseline: Shares = BASELINE_SHARES): number {
  const w = winnerOf(sh);
  return Math.round(sh[w] * 100) - Math.round(baseline[w] * 100);
}

/** "+12%p" / "−39%p" (ko) or "+12 pp" / "−39 pp" (en); "±0" for no change. */
export function formatDiff(points: number, lang: Lang): string {
  const unit = lang === 'ko' ? '%p' : ' pp';
  if (points === 0) return `±0${unit}`;
  return `${points > 0 ? '+' : '−'}${Math.abs(points)}${unit}`;
}

/** Whole percent, "61%". */
export const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** One decimal, "61.2%". */
export const pct1 = (share: number): string => `${(Math.round(share * 1000) / 10).toFixed(1)}%`;

/** Cell counts of the 10-cell bar (largest remainder, ties heavy → pack → draw). */
export function barCells(sh: Shares, length = BAR_LENGTH): Record<Side, number> {
  const raw = SIDES.map((s) => sh[s] * length);
  const cells = raw.map(Math.floor);
  let left = length - cells.reduce((a, b) => a + b, 0);
  const order = [0, 1, 2].sort((a, b) => {
    const ra = (raw[a] as number) - (cells[a] as number);
    const rb = (raw[b] as number) - (cells[b] as number);
    return rb - ra || a - b;
  });
  for (const i of order) {
    if (left <= 0) break;
    cells[i] = (cells[i] as number) + 1;
    left--;
  }
  return { heavy: cells[0] ?? 0, pack: cells[1] ?? 0, draw: cells[2] ?? 0 };
}

export function emojiBar(sh: Shares): string {
  const c = barCells(sh);
  return SIDES.map((s) => BAR_CELLS[s].repeat(c[s])).join('');
}

/** Abstract glyph of a side on the card: triangle (large animals) or dot. */
export type Glyph = 'triangle' | 'dot';

/**
 * Body radius (m) from which a free side is drawn as triangles, like the classic heavy side
 * (design §6: shape follows size, not role).
 */
export const TRIANGLE_RADIUS = 1;

/**
 * Everything a page, card or preview says about one result. For a free result (`free`) the
 * `heavy*` fields describe side A and the `pack*` fields side B; the shares keep those keys.
 */
export interface ResultView {
  lang: Lang;
  free: boolean;
  shares: Shares;
  winner: Side;
  tier: Tier;
  tierLabel: string;
  diff: number;
  diffText: string;
  heavyName: string;
  packName: string;
  /** Names for one animal ("T-Rex", "Tiger", "Tiger A"), as in "{name} wins". */
  heavyOne: string;
  packOne: string;
  heavyEmoji: string;
  packEmoji: string;
  heavySpecies: string;
  heavyCount: number;
  packSpecies: string;
  packCount: number;
  heavyGlyph: Glyph;
  packGlyph: Glyph;
  seed: number;
  /** The line beside the tier: the difference to the default matchup, or the free-model note. */
  context: string;
  /** Free results: pack-buff share per side whose buff applies ("Wolf A 38%"), else empty. */
  buffs: string[];
  /** "T-Rex 1 vs 호랑이 100". */
  matchup: string;
  /** Name of the winning side ("T-Rex", "무승부"). */
  winnerName: string;
  /** "T-Rex 61%". */
  headline: string;
  /** "T-Rex 승리" / "Draw". */
  winLabel: string;
}

type ViewSides = Omit<
  ResultView,
  | 'lang'
  | 'winner'
  | 'tierLabel'
  | 'diffText'
  | 'heavyEmoji'
  | 'packEmoji'
  | 'matchup'
  | 'winnerName'
  | 'headline'
  | 'winLabel'
>;

function viewOf(lang: Lang, x: ViewSides): ResultView {
  const winner = winnerOf(x.shares);
  const winnerName =
    winner === 'heavy' ? x.heavyOne : winner === 'pack' ? x.packOne : sm(lang, 'result.draw');
  return {
    ...x,
    lang,
    winner,
    tierLabel: sm(lang, `tier.${x.tier}`),
    diffText: formatDiff(x.diff, lang),
    heavyEmoji: speciesEmoji(x.heavySpecies, 'heavy'),
    packEmoji: speciesEmoji(x.packSpecies, 'pack'),
    matchup: sm(lang, 'result.matchup', {
      heavy: x.heavyName,
      heavyCount: x.heavyCount,
      pack: x.packName,
      packCount: x.packCount,
    }),
    winnerName,
    headline: sm(lang, 'result.headline', { name: winnerName, pct: pct(x.shares[winner]) }),
    winLabel:
      winner === 'draw' ? sm(lang, 'result.drawWin') : sm(lang, 'result.win', { name: winnerName }),
  };
}

export function resultView(config: ScenarioConfig, s: ResultSummary, lang: Lang): ResultView {
  const shares = sharesOf(s);
  const diff = diffVsBaseline(shares);
  return viewOf(lang, {
    free: false,
    shares,
    tier: outcomeTier(shares),
    diff,
    heavyName: shortName(config.heavySpecies, config.heavyCount, lang),
    packName: shortName(config.packSpecies, config.packCount, lang),
    heavyOne: shortName(config.heavySpecies, 1, lang),
    packOne: shortName(config.packSpecies, 1, lang),
    heavySpecies: config.heavySpecies,
    heavyCount: config.heavyCount,
    packSpecies: config.packSpecies,
    packCount: config.packCount,
    heavyGlyph: 'triangle',
    packGlyph: 'dot',
    seed: config.seed,
    context: sm(lang, 'result.vsDefault', { diff: formatDiff(diff, lang) }),
    buffs: [],
  });
}

/** Win shares of a free snapshot under the classic keys (side A → heavy, side B → pack). */
export const freeSharesOf = (s: Pick<FreeResultSummary, 'n' | 'a' | 'b' | 'd'>): Shares => ({
  heavy: s.a / s.n,
  pack: s.b / s.n,
  draw: s.d / s.n,
});

/** Whether a free config is a mirror (same-species) matchup. */
export const isMirror = (config: FreeConfig): boolean =>
  config.sides[0].species === config.sides[1].species;

/**
 * Name of a free side for `n` animals. In a mirror matchup both sides carry their side letter:
 * "호랑이 A" / "Tigers B".
 */
export function freeSideName(config: FreeConfig, i: 0 | 1, n: number, lang: Lang): string {
  const name = shortName(config.sides[i].species, n, lang);
  if (!isMirror(config)) return name;
  return sm(lang, 'free.sideName', { name, side: i === 0 ? 'A' : 'B' });
}

/**
 * View of a free result. There is no baseline, so the tier never says "upset" and the context
 * line names the free model (and the same-species match-up for a mirror).
 */
export function freeResultView(config: FreeConfig, s: FreeResultSummary, lang: Lang): ResultView {
  const shares = freeSharesOf(s);
  const [a, b] = config.sides;
  const glyph = (i: 0 | 1): Glyph =>
    config.sides[i].params.bodyRadius.mode >= TRIANGLE_RADIUS ? 'triangle' : 'dot';
  const buffs: string[] = [];
  for (const i of [0, 1] as const) {
    const frac = i === 0 ? s.ab : s.bb;
    if (frac !== undefined && buffApplies(config, i)) {
      buffs.push(`${freeSideName(config, i, 1, lang)} ${pct(frac)}`);
    }
  }
  return viewOf(lang, {
    free: true,
    shares,
    // Compared with itself the winner is never an upset: free matchups have no baseline.
    tier: outcomeTier(shares, shares),
    diff: 0,
    heavyName: freeSideName(config, 0, a.count, lang),
    packName: freeSideName(config, 1, b.count, lang),
    heavyOne: freeSideName(config, 0, 1, lang),
    packOne: freeSideName(config, 1, 1, lang),
    heavySpecies: a.species,
    heavyCount: a.count,
    packSpecies: b.species,
    packCount: b.count,
    heavyGlyph: glyph(0),
    packGlyph: glyph(1),
    seed: config.seed,
    context: sm(lang, isMirror(config) ? 'free.contextMirror' : 'free.context'),
    buffs,
  });
}

/** Mean duration for cards and the result page: "43초", "3분 05초" / "43 s", "3 min 05 s". */
export function formatSeconds(t: number, lang: Lang): string {
  const s = Math.max(0, Math.round(t));
  if (s < 60) return lang === 'ko' ? `${s}초` : `${s} s`;
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, '0');
  return lang === 'ko' ? `${m}분 ${r}초` : `${m} min ${r} s`;
}

export const formatCount = (n: number, lang: Lang): string =>
  n.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');

/**
 * Wordle-style text share:
 * `🦖 T-Rex 1 vs 🐅 호랑이 100 — 500회`, a 10-cell bar, the three percentages and the link.
 */
export function shareText(
  config: ScenarioConfig,
  s: ResultSummary,
  lang: Lang,
  url: string,
): string {
  return viewShareText(resultView(config, s, lang), s.n, url);
}

/** Text share of a free result: `🐅 호랑이 A 1 vs 🐅 호랑이 B 1 — 500회`, bar, shares, link. */
export function freeShareText(
  config: FreeConfig,
  s: FreeResultSummary,
  lang: Lang,
  url: string,
): string {
  return viewShareText(freeResultView(config, s, lang), s.n, url);
}

/** Text share of a view: head, the 10-cell bar, the three percentages and the link. */
export function viewShareText(v: ResultView, runs: number, url: string): string {
  const head = sm(v.lang, 'text.head', {
    heavy: `${v.heavyEmoji} ${v.heavyName} ${v.heavyCount}`,
    pack: `${v.packEmoji} ${v.packName} ${v.packCount}`,
    runs: formatCount(runs, v.lang),
  });
  const pcts = sm(v.lang, 'text.pcts', {
    heavyName: v.heavyOne,
    packName: v.packOne,
    h: pct(v.shares.heavy),
    p: pct(v.shares.pack),
    d: pct(v.shares.draw),
  });
  return [head, emojiBar(v.shares), pcts, url].join('\n');
}

/** X (Twitter) web intent for a text and a link. */
export function xIntentUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${q.toString()}`;
}

/** Link-preview strings for a result page request. */
export interface ResultMeta {
  title: string;
  description: string;
}

/**
 * Meta strings for a result URL's query (`?r=…`, classic or free) in `lang`, or null when the
 * link does not validate (the page is then served unchanged). Used by the Pages Function.
 */
export function buildMeta(search: string, lang: Lang): ResultMeta | null {
  const res = decodeAnyResultQuery(search);
  if (!res.ok) return null;
  const v =
    res.kind === 'free'
      ? freeResultView(res.config, res.summary, lang)
      : resultView(res.config, res.summary, lang);
  const runs = formatCount(res.summary.n, lang);
  return {
    title: sm(lang, 'meta.title', {
      matchup: v.matchup,
      winner: v.winnerName,
      pct: pct(v.shares[v.winner]),
    }),
    description: v.free
      ? sm(lang, 'meta.descriptionFree', { runs, tier: v.tierLabel, context: v.context })
      : sm(lang, 'meta.description', { runs, tier: v.tierLabel, diff: v.diffText }),
  };
}
