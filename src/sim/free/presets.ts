import { sanitizeFreeConfig, type FreeConfig } from './config.ts';
import { FREE_SPECIES, type FreeSpeciesId } from './species.ts';

/**
 * Simple-mode presets of the free model (docs/design/RENEWAL-1.0.md §3.2 and §6,
 * docs/PRESETS.md). Pure data and checks: nothing here runs the engine. The measured win share,
 * median duration and rout share of every preset live in `tests/fixtures/preset-shares.json`,
 * which `tests/presets.test.ts` recomputes.
 *
 * Only presets whose two species exist are listed; the design's other presets wait for their
 * species and are listed in docs/PRESETS.md.
 */

/** Tags of design §3.2 and §6. `close` is never set by hand: the fixture decides it. */
export const PRESET_TAGS = [
  'popular',
  'documented',
  'close',
  'mirror',
  'army',
  'absurd',
  'thought-experiment',
  'ice-age',
  'rivals',
] as const;
export type PresetTag = (typeof PRESET_TAGS)[number];

export interface PresetSide {
  sp: FreeSpeciesId;
  n: number;
}

/** A documented exception to the rout check; every one is listed in docs/PRESETS.md. */
export interface PresetCheckOverride {
  /** Rout share allowed instead of `PRESET_LIMITS.maxRoutShare`. */
  maxRoutShare?: number;
  /** Median duration (s) allowed instead of `PRESET_LIMITS.minMedianS`. */
  minMedianS?: number;
  /** Why the exception is acceptable, in plain words. */
  reason: string;
}

export interface FreePreset {
  /** Stable and append-only: links and share images may name it. */
  id: string;
  /** Common nouns only (design §1.2). */
  name: { ko: string; en: string };
  a: PresetSide;
  b: PresetSide;
  /** Run count; the default (500, within the work budget) when absent. */
  runs?: number;
  tags: readonly PresetTag[];
  /** Shown under "Why?": the literature or a described source, never a title or a view count. */
  why: { ko: string; en: string };
  check?: PresetCheckOverride;
  /**
   * Kept out of Simple mode: the preset fails a check and no override has been accepted yet. The
   * reason names what would release it; docs/PRESETS.md lists every held preset.
   */
  hold?: string;
}

/**
 * Limits of the preset checks, all **S** (design §3.2, §6, R4): a preset fails when its median
 * duration is under 30 s or its rout share is over 90 %, unless it carries a documented override;
 * `close` means both sides win 35–65 % of runs; a social side holds at most 100 agents.
 */
export const PRESET_LIMITS = {
  minMedianS: 30,
  maxRoutShare: 0.9,
  close: [0.35, 0.65],
  socialCount: 100,
} as const;

const ONE_ON_ONE =
  'One on one, the loser flees once its morale breaks (FREE-MATCHUPS.md §4.5) and there is no group for a rout to spread through, so nearly every decided run ends in a rout.';

const HELD =
  'Fails the rout check: the losing group flees in nearly every run. Released by an owner-accepted override, other counts, or a morale retune under a new model version (R4).';

export const FREE_PRESETS: readonly FreePreset[] = [
  {
    id: 'lion-tiger',
    name: { ko: '사자 vs 호랑이', en: 'Lion vs tiger' },
    a: { sp: 'lion', n: 1 },
    b: { sp: 'tiger', n: 1 },
    tags: ['popular', 'close'],
    why: {
      ko: '아시아사자와 벵골호랑이는 한때 인도의 일부 지역에서 함께 살았습니다.',
      en: 'Asiatic lions and Bengal tigers once shared parts of India.',
    },
    check: {
      maxRoutShare: 1,
      minMedianS: 20,
      reason: `${ONE_ON_ONE} Two big cats of similar size settle it in a few strikes.`,
    },
  },
  {
    id: 'pride-five-tigers',
    name: { ko: '사자 무리 vs 호랑이 다섯', en: 'Pride vs five tigers' },
    a: { sp: 'lion', n: 5 },
    b: { sp: 'tiger', n: 5 },
    tags: ['popular', 'close'],
    why: {
      ko: '사자는 무리를 지어 살고 호랑이는 혼자 삽니다. 무리 버프가 그 차이를 보여 줍니다.',
      en: 'Lions live in prides and tigers alone; the pack buff shows the difference.',
    },
    hold: HELD,
  },
  {
    id: 'tiger-bear',
    name: { ko: '호랑이 vs 곰', en: 'Tiger vs bear' },
    a: { sp: 'tiger', n: 1 },
    b: { sp: 'brownBear', n: 1 },
    tags: ['documented'],
    why: {
      ko: '러시아 극동에서는 아무르호랑이와 불곰이 마주친 기록이 남아 있습니다.',
      en: 'Encounters between Amur tigers and brown bears are recorded in the Russian Far East.',
    },
    check: { maxRoutShare: 1, reason: ONE_ON_ONE },
  },
  {
    id: 'bear-wolf-pack',
    name: { ko: '불곰 vs 늑대 무리', en: 'Bear vs wolf pack' },
    a: { sp: 'brownBear', n: 1 },
    b: { sp: 'wolf', n: 8 },
    tags: ['documented'],
    why: {
      ko: '불곰과 늑대 무리가 먹이를 두고 맞선 기록이 있고, 대부분은 큰 충돌 없이 끝납니다.',
      en: 'Brown bears and wolf packs are recorded facing off over carcasses; most such meetings end without a fight.',
    },
    check: {
      maxRoutShare: 1,
      reason:
        'Field records: most meetings of brown bears and wolves over a carcass end with one side withdrawing rather than with injuries (SPECIES.md §5), so a fight that ends in a rout matches them.',
    },
  },
  {
    id: 'buffalo-pride',
    name: { ko: '물소 vs 사자 무리', en: 'Buffalo vs pride' },
    a: { sp: 'buffalo', n: 1 },
    b: { sp: 'lion', n: 6 },
    tags: [],
    why: {
      ko: '사자 무리는 아프리카물소를 사냥하고, 물소가 사자를 물리치는 경우도 기록되어 있습니다.',
      en: 'Lion prides hunt African buffalo, and buffalo are also recorded driving lions off.',
    },
  },
  {
    id: 'elephants-pride',
    name: { ko: '코끼리 가족 vs 사자 무리', en: 'Elephant family vs pride' },
    a: { sp: 'elephant', n: 5 },
    b: { sp: 'lion', n: 30 },
    tags: ['documented'],
    why: {
      ko: '보츠와나 사부티에서는 큰 사자 무리가 어린 코끼리를 사냥한 기록이 있습니다(Joubert 2006; Power & Compion 2009).',
      en: 'At Savuti in Botswana, a large lion pride was recorded hunting young elephants (Joubert 2006; Power & Compion 2009).',
    },
  },
  {
    id: 'mammoth-wolves',
    name: { ko: '매머드 vs 늑대 무리', en: 'Mammoth vs wolves' },
    a: { sp: 'mammoth', n: 1 },
    b: { sp: 'wolf', n: 12 },
    tags: ['ice-age'],
    why: {
      ko: '털매머드와 회색늑대는 빙하기의 같은 초원에 살았습니다. 기록된 싸움이 아니라 사고 실험입니다.',
      en: 'Woolly mammoths and grey wolves lived on the same glacial-period steppe; a thought experiment, not a recorded fight.',
    },
  },
  {
    id: 'trex-mirror',
    name: { ko: '티라노 거울전', en: 'T. rex mirror match' },
    a: { sp: 'trex', n: 1 },
    b: { sp: 'trex', n: 1 },
    tags: ['mirror', 'close'],
    why: {
      ko: '양쪽이 같은 종이라 대칭에 따라 50 대 50입니다.',
      en: 'The same species on both sides: 50/50 by symmetry.',
    },
    check: { maxRoutShare: 1, reason: ONE_ON_ONE },
  },
  {
    id: 'trex-squad-tiger-horde',
    name: { ko: '티라노 부대 vs 호랑이 군단', en: 'T. rex squad vs tiger horde' },
    a: { sp: 'trex', n: 10 },
    b: { sp: 'tiger', n: 100 },
    tags: ['army'],
    why: {
      ko: '두 종은 만난 적이 없습니다(약 6,600만 년 차이). 호랑이는 혼자 사는 동물이라 무리 이탈이 번지지 않습니다.',
      en: 'Never met (about 66 million years apart); tigers live alone, so no group rout spreads among them.',
    },
  },
  {
    id: 'trex-erectus-100',
    name: { ko: '티라노 vs 호모 에렉투스 100', en: 'T. rex vs 100 H. erectus' },
    a: { sp: 'trex', n: 1 },
    b: { sp: 'homoErectus', n: 100 },
    tags: ['thought-experiment'],
    why: {
      ko: '신체 능력만 비교하는 사고 실험입니다. 실제 폭력을 묘사하거나 지지하지 않습니다.',
      en: 'A thought experiment about physical capability only; it does not depict or endorse real violence.',
    },
    hold: HELD,
  },
  {
    id: 'lions-hyenas',
    name: { ko: '사자 vs 하이에나', en: 'Lions vs hyenas' },
    a: { sp: 'lion', n: 3 },
    b: { sp: 'hyena', n: 10 },
    tags: ['rivals', 'close'],
    why: {
      ko: '사자와 점박이하이에나는 사는 곳이 겹치는 지역에서 먹이를 두고 경쟁합니다.',
      en: 'Lions and spotted hyenas compete for food where their ranges meet.',
    },
    hold: HELD,
  },
];

/** Presets Simple mode may show: every preset not on hold. */
export const readyPresets = (): FreePreset[] => FREE_PRESETS.filter((p) => p.hold === undefined);

/** The free config of a preset: species and counts on defaults, at the given seed. */
export function presetConfig(p: FreePreset, seed?: number): FreeConfig {
  return sanitizeFreeConfig({
    sides: [
      { species: p.a.sp, count: p.a.n },
      { species: p.b.sp, count: p.b.n },
    ],
    ...(p.runs === undefined ? {} : { runs: p.runs }),
    ...(seed === undefined ? {} : { seed }),
  });
}

/** What the fixture stores for a preset. */
export interface PresetMeasure {
  /** Share of runs side A won, side B won, and drawn. */
  a: number;
  b: number;
  draw: number;
  /** Median simulated duration (s). */
  medianS: number;
  /** Losing side's fled ÷ (fled + incapacitated) over decided runs (`routShare`). */
  rout: number;
}

/** Both sides win 35–65 % of runs. */
export const isCloseShare = (m: Pick<PresetMeasure, 'a' | 'b'>): boolean =>
  [m.a, m.b].every((p) => p >= PRESET_LIMITS.close[0] && p <= PRESET_LIMITS.close[1]);

export type PresetProblem = 'short' | 'rout' | 'social-count' | 'close-tag';

/** Every check a preset fails against its measurement (empty when it passes). */
export function presetProblems(p: FreePreset, m: PresetMeasure): PresetProblem[] {
  const out: PresetProblem[] = [];
  if (m.medianS < (p.check?.minMedianS ?? PRESET_LIMITS.minMedianS)) out.push('short');
  if (m.rout > (p.check?.maxRoutShare ?? PRESET_LIMITS.maxRoutShare)) out.push('rout');
  if ([p.a, p.b].some((s) => FREE_SPECIES[s.sp].social && s.n > PRESET_LIMITS.socialCount)) {
    out.push('social-count');
  }
  if (p.tags.includes('close') !== isCloseShare(m)) out.push('close-tag');
  return out;
}
