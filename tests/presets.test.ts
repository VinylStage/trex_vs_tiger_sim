import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../src/i18n/dictionaries';
import { MAX_WORK, defaultConfig } from '../src/sim/config';
import { aggregateFree, routShare } from '../src/sim/free/aggregate';
import { freeWorkEstimate, sanitizeFreeConfig } from '../src/sim/free/config';
import { runAllFree } from '../src/sim/free/montecarlo';
import {
  FREE_PRESETS,
  PRESET_LIMITS,
  isCloseShare,
  presetConfig,
  presetProblems,
  readyPresets,
  type FreePreset,
  type PresetMeasure,
} from '../src/sim/free/presets';
import { FREE_SPECIES } from '../src/sim/free/species';

/**
 * Simple-mode presets (docs/PRESETS.md, docs/design/RENEWAL-1.0.md §3.2 and §6): the registry,
 * the measured fixture, the rout check and the banned-words check.
 *
 * Unlike the goldens, the fixture is expected to change with the model: a model change shows up
 * as a fixture diff that the owner reviews. Rewrite it with `UPDATE_PRESET_FIXTURE=1` only
 * together with such a change.
 */

const FIXTURE = new URL('./fixtures/preset-shares.json', import.meta.url);
/** The default seed, and fewer runs than the default 500 so the check stays fast (PRESETS.md). */
const SEED = defaultConfig().seed;
const RUNS = 200;

interface FixtureRow {
  id: string;
  matchup: string;
  wins: [number, number, number];
  share: { a: number; b: number; draw: number };
  medianS: number;
  /** null when no run was decided (JSON has no NaN). */
  rout: number | null;
  close: boolean;
}

interface Fixture {
  seed: number;
  runs: number;
  presets: FixtureRow[];
}

function measure(p: FreePreset): FixtureRow {
  const c = sanitizeFreeConfig({ ...presetConfig(p), seed: SEED, runs: RUNS });
  const { summaries } = runAllFree(c);
  const agg = aggregateFree(c, summaries);
  const rout = routShare(summaries);
  const share = { a: agg.pA.p, b: agg.pB.p, draw: agg.pDraw.p };
  return {
    id: p.id,
    matchup: `${p.a.sp} ${String(p.a.n)} v ${p.b.sp} ${String(p.b.n)}`,
    wins: [agg.aWins, agg.bWins, agg.draws],
    share,
    medianS: agg.duration.p50,
    rout: Number.isNaN(rout) ? null : rout,
    close: isCloseShare(share),
  };
}

const toMeasure = (r: FixtureRow): PresetMeasure => ({
  ...r.share,
  medianS: r.medianS,
  rout: r.rout ?? NaN,
});

if (process.env['UPDATE_PRESET_FIXTURE']) {
  const fixture: Fixture = { seed: SEED, runs: RUNS, presets: FREE_PRESETS.map(measure) };
  writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 1)}\n`);
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;
const rowOf = (p: FreePreset): FixtureRow => {
  const r = fixture.presets.find((x) => x.id === p.id);
  if (!r) throw new Error(`no fixture row for ${p.id}`);
  return r;
};

describe('preset registry', () => {
  it('has unique, stable-looking ids and unique names', () => {
    const ids = FREE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const lang of ['ko', 'en'] as const) {
      const names = FREE_PRESETS.map((p) => p.name[lang]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it.each(FREE_PRESETS.map((p) => [p.id, p] as const))(
    '%s survives sanitizeFreeConfig unchanged and fits the work budget',
    (_, p) => {
      const c = presetConfig(p);
      expect(c.sides.map((s) => [s.species, s.count])).toEqual([
        [p.a.sp, p.a.n],
        [p.b.sp, p.b.n],
      ]);
      expect(c.runs).toBe(p.runs ?? defaultConfig().runs);
      expect(freeWorkEstimate(c)).toBeLessThanOrEqual(MAX_WORK);
      expect(presetConfig(p, 7).seed).toBe(7);
    },
  );

  it('keeps a social side within the preset limit', () => {
    for (const p of FREE_PRESETS) {
      for (const s of [p.a, p.b]) {
        if (FREE_SPECIES[s.sp].social) expect(s.n, p.id).toBeLessThanOrEqual(100);
      }
    }
    expect(PRESET_LIMITS.socialCount).toBe(100);
  });

  it('tags mirror matches and every H. erectus preset as such', () => {
    for (const p of FREE_PRESETS) {
      expect(p.tags.includes('mirror'), p.id).toBe(p.a.sp === p.b.sp);
      const erectus = p.a.sp === 'homoErectus' || p.b.sp === 'homoErectus';
      expect(p.tags.includes('thought-experiment'), p.id).toBe(erectus);
    }
  });

  it('documents every override and hold, and an override only loosens a limit', () => {
    for (const p of FREE_PRESETS) {
      if (p.check) {
        expect(p.check.reason.length, p.id).toBeGreaterThan(40);
        expect(p.check.maxRoutShare ?? 1, p.id).toBeGreaterThanOrEqual(PRESET_LIMITS.maxRoutShare);
        expect(p.check.minMedianS ?? 0, p.id).toBeLessThanOrEqual(PRESET_LIMITS.minMedianS);
      }
      if (p.hold !== undefined) expect(p.hold.length, p.id).toBeGreaterThan(40);
    }
  });

  it('shows only presets that are not on hold', () => {
    expect(readyPresets().map((p) => p.id)).toEqual(
      FREE_PRESETS.filter((p) => !p.hold).map((p) => p.id),
    );
    expect(readyPresets().length).toBeGreaterThan(0);
  });
});

describe('preset checks', () => {
  const base: FreePreset = {
    id: 'x',
    name: { ko: 'x', en: 'x' },
    a: { sp: 'tiger', n: 1 },
    b: { sp: 'brownBear', n: 1 },
    tags: [],
    why: { ko: 'x', en: 'x' },
  };
  const ok: PresetMeasure = { a: 0.2, b: 0.8, draw: 0, medianS: 40, rout: 0.5 };

  it('fails a short battle and a rout over the limit, and passes the edges', () => {
    expect(presetProblems(base, ok)).toEqual([]);
    expect(presetProblems(base, { ...ok, medianS: 29.9 })).toEqual(['short']);
    expect(presetProblems(base, { ...ok, medianS: 30 })).toEqual([]);
    expect(presetProblems(base, { ...ok, rout: 0.91 })).toEqual(['rout']);
    expect(presetProblems(base, { ...ok, rout: 0.9 })).toEqual([]);
    expect(presetProblems(base, { ...ok, rout: NaN })).toEqual([]);
  });

  it('accepts what a documented override allows', () => {
    const p = { ...base, check: { maxRoutShare: 1, minMedianS: 20, reason: 'r' } };
    expect(presetProblems(p, { ...ok, medianS: 21, rout: 1 })).toEqual([]);
    expect(presetProblems(p, { ...ok, medianS: 19 })).toEqual(['short']);
  });

  it('assigns close from the measurement, never by hand', () => {
    expect(isCloseShare({ a: 0.35, b: 0.65 })).toBe(true);
    expect(isCloseShare({ a: 0.34, b: 0.66 })).toBe(false);
    const close = { ...ok, a: 0.5, b: 0.5 };
    expect(presetProblems(base, close)).toEqual(['close-tag']);
    expect(presetProblems({ ...base, tags: ['close'] }, close)).toEqual([]);
    expect(presetProblems({ ...base, tags: ['close'] }, ok)).toEqual(['close-tag']);
  });

  it('fails a social side over the preset limit', () => {
    const p = { ...base, b: { sp: 'wolf' as const, n: 101 } };
    expect(presetProblems(p, ok)).toEqual(['social-count']);
    expect(presetProblems({ ...p, b: { sp: 'tiger' as const, n: 1000 } }, ok)).toEqual([]);
  });
});

describe(`preset fixture (seed ${String(fixture.seed)}, ${String(fixture.runs)} runs each)`, () => {
  it('was measured at the documented seed and run count, for every preset in order', () => {
    expect([fixture.seed, fixture.runs]).toEqual([SEED, RUNS]);
    expect(fixture.presets.map((r) => r.id)).toEqual(FREE_PRESETS.map((p) => p.id));
  });

  it.each(FREE_PRESETS.map((p) => [p.id, p] as const))(
    '%s: the free engine reproduces the fixture',
    (_, p) => {
      expect(measure(p)).toEqual(rowOf(p));
    },
    120_000,
  );

  it.each(FREE_PRESETS.map((p) => [p.id, p] as const))(
    '%s: passes the rout check, or is on hold and still fails it',
    (_, p) => {
      const problems = presetProblems(p, toMeasure(rowOf(p)));
      if (p.hold === undefined) expect(problems).toEqual([]);
      else expect(problems).not.toEqual([]);
    },
  );
});

// ---------- banned words (design §1.2, §4.5; CONTRIBUTING.md content framing rules) ----------

/**
 * Words no preset name, "Why?" text, override or hold reason may use. Gore and death words follow
 * tests/pages.test.ts; betting words follow design §4.5; titles, trademarks, platforms and view
 * counts follow the common-noun rule of design §1.2.
 */
const BANNED: readonly RegExp[] = [
  /(?<![가-힣])피[를가]|유혈|학살|도륙|잔혹|\b(?:blood\w*|bloody|massacre\w*|gore|gory|slaughter\w*|corpses?|wounds?)\b|kill count/i,
  /(?<!가)죽[은을는지기음었이]|사망|\b(?:dead|deadliest|killed|kills?|died|dies|die|death)\b|to the death/i,
  /베팅|배팅|배당|도박|내기|\b(?:odds|bets?|betting|wager\w*|stakes?|prizes?|jackpot|gambl\w*)\b/i,
  /월드컵|world ?cup|쥬라기|jurassic (?:park|world)|고질라|godzilla|킹콩|king ?kong|포켓몬|pok[eé]mon|디지몬|digimon|공룡왕|dinosaur king/i,
  /페이스 ?오프|face-?off|who would win|누가 이길까|아이스 ?에이지|walking with dinosaurs|prehistoric planet/i,
  /내셔널 ?지오그래픽|national geographic|애니멀 ?플래닛|animal planet|디스커버리|discovery channel|\bbbc\b|핑크퐁|pinkfong|아기 ?상어|baby shark/i,
  /몬스터 ?헌터|monster hunter|battle simulator|룰렛|roulette/i,
  /치지직|chzzk|트위치|twitch|유튜브|youtube|아프리카 ?tv|afreeca|\bsoop\b/i,
  /조회|\bviews?\b/i,
  /[《》『』「」〈〉"“”]/,
];

const bannedIn = (s: string): string | null => {
  for (const re of BANNED) {
    const m = re.exec(s);
    if (m) return m[0];
  }
  return null;
};

const presetTexts = (p: FreePreset): string[] => [
  p.name.ko,
  p.name.en,
  p.why.ko,
  p.why.en,
  ...(p.check ? [p.check.reason] : []),
  ...(p.hold === undefined ? [] : [p.hold]),
];

describe('banned words', () => {
  it.each(FREE_PRESETS.map((p) => [p.id, p] as const))(
    '%s uses no gore, death or betting words, titles, platforms or view counts',
    (_, p) => {
      expect(presetTexts(p).map(bannedIn).filter(Boolean)).toEqual([]);
    },
  );

  it('the free result breakdown and rout notice strings pass the same check', () => {
    for (const lang of ['ko', 'en'] as const) {
      const hits = Object.entries(DICTIONARIES[lang])
        .filter(([k]) => k.startsWith('free.stat.') || k.startsWith('free.rout.'))
        .map(([k, v]) => [k, bannedIn(v)] as const)
        .filter(([, m]) => m !== null);
      expect(hits).toEqual([]);
    }
  });

  it('recognises what it rejects, and allows the common nouns presets use', () => {
    for (const s of [
      '동물 월드컵',
      'Jurassic Park',
      'a Godzilla match',
      'Animal Face-Off',
      'Who Would Win?',
      '피를 보지 않고',
      'a dead tiger',
      '베팅',
      'the odds',
      '57.7M views',
      '조회수',
      '《제목》',
      '치지직',
      'the marble roulette',
    ]) {
      expect(bannedIn(s), s).not.toBeNull();
    }
    for (const s of [
      '쥐라기 후기',
      'Late Jurassic',
      '피로',
      '피해',
      '빙하기',
      'glacial-period steppe',
      '숲',
      'Joubert 2006',
      '50/50',
    ]) {
      expect(bannedIn(s), s).toBeNull();
    }
  });
});
