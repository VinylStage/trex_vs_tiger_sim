import { SPECIES_GUIDE } from '../content/species-guide.ts';
import { DICTIONARIES } from '../i18n/dictionaries.ts';
import type { Lang } from '../i18n/lang.ts';
import { escapeHtml } from '../seo/html.ts';
import { sanitizeFreeConfig } from '../sim/free/config.ts';
import { FREE_PRESETS, type FreePreset } from '../sim/free/presets.ts';
import { FREE_SPECIES, FREE_SPECIES_IDS, type FreeSpeciesId } from '../sim/free/species.ts';
import { HEAVY_SPECIES_IDS, PACK_SPECIES_IDS, erasNeverMet, type Era } from '../sim/species.ts';
import type { Triangular } from '../sim/params.ts';
import { freeSideGlyph, type FreeGlyph } from '../ui/replay/free-world.ts';
import { hashFromFreeConfig } from '../ui/share-free.ts';
import { SIMPLE_DEFAULT_PRESET, simpleCanShow, simpleRunConfig } from '../ui/simple-model.ts';
import { playPagePath } from './routes.ts';
import type { HeaderRoute } from './site-header.ts';

/*
 * The species guide (`/species/`, `/en/species/`, docs/PAGES.md#species-guide), rendered at build
 * time from the registries: src/sim/free/species.ts (the free roster, its era, mass, body radius,
 * social and latch flags), src/sim/species.ts (the classic roles and the era rule), and
 * src/sim/free/presets.ts (the presets). Only the scientific name and a short note are curated
 * (src/content/species-guide.ts). `<!-- species-guide -->` in species/index.html and
 * en/species/index.html becomes the overview table and one section per species. DOM-free and
 * pure: vite.pages.ts runs it in dev and in the build, vite.seo.ts for llms-full.txt, and
 * tests/species-page.test.ts compares the page with the registries.
 */

/** Placeholder in the species guide sources, replaced by {@link renderSpeciesGuide}. */
export const SPECIES_GUIDE_PLACEHOLDER = '<!-- species-guide -->';

/** Every species the page lists: the free roster, which includes every classic species. */
export const GUIDE_SPECIES: readonly FreeSpeciesId[] = FREE_SPECIES_IDS;

/** Anchor of a species' section: `#sp-trex`, `#sp-brownBear`. */
export const speciesAnchor = (id: FreeSpeciesId): string => `sp-${id}`;

/**
 * A species that shares no time with any other species in the roster (the era rule of
 * `erasNeverMet`): every matchup with it is a what-if (design R15). Today that is _T. rex_ only.
 */
export function isWhatIf(id: FreeSpeciesId): boolean {
  const era = FREE_SPECIES[id].era;
  return GUIDE_SPECIES.filter((o) => o !== id).every((o) => erasNeverMet(era, FREE_SPECIES[o].era));
}

/** The classic-mode roles a species fills (`heavy`, `pack`, or both for _H. erectus_). */
export function classicRoles(id: FreeSpeciesId): ('heavy' | 'pack')[] {
  const out: ('heavy' | 'pack')[] = [];
  if ((HEAVY_SPECIES_IDS as readonly string[]).includes(id)) out.push('heavy');
  if ((PACK_SPECIES_IDS as readonly string[]).includes(id)) out.push('pack');
  return out;
}

/** Every preset with the species on either side, in registry order (held ones included). */
export const presetsWith = (id: FreeSpeciesId): FreePreset[] =>
  FREE_PRESETS.filter((p) => p.a.sp === id || p.b.sp === id);

/** The glyph the replay draws for a species: shape from its body-radius mode. */
export const speciesGlyph = (id: FreeSpeciesId): FreeGlyph =>
  freeSideGlyph(FREE_SPECIES[id].traits.bodyRadius.range.mode).glyph;

/**
 * The opponent of a "Try it" link: side B of Simple mode's default preset (the tiger), or its
 * side A (the lion) for that species itself, so the link never shows a mirror.
 */
export function tryOpponent(id: FreeSpeciesId): FreeSpeciesId {
  const p = FREE_PRESETS.find((x) => x.id === SIMPLE_DEFAULT_PRESET);
  if (!p) throw new Error(`missing preset ${SIMPLE_DEFAULT_PRESET}`);
  return id === p.b.sp ? p.a.sp : p.b.sp;
}

/**
 * The "Try it" link of a species: the play page of `lang` with a Simple link
 * (docs/SHARING.md#simple-links) of the species against {@link tryOpponent}, one on one, every
 * other setting at Simple's defaults and the default seed, so it opens in Simple mode.
 */
export function tryItHref(id: FreeSpeciesId, lang: Lang): string {
  const base = sanitizeFreeConfig({
    sides: [
      { species: id, count: 1 },
      { species: tryOpponent(id), count: 1 },
    ],
  });
  const config = simpleRunConfig(base, base.seed);
  if (!simpleCanShow(config)) throw new Error(`species guide: Simple cannot show ${id}`);
  return `${playPagePath(lang)}${hashFromFreeConfig(config, { simple: true })}`;
}

interface Words {
  overview: string;
  caption: string;
  colSpecies: string;
  colEra: string;
  colMass: string;
  colGroup: string;
  colLatch: string;
  extant: string;
  ago: (from: string, to: string) => string;
  whatIf: string;
  whatIfNote: string;
  era: string;
  mass: string;
  massMode: (v: string) => string;
  size: string;
  sizeFixed: string;
  sizeMode: (v: string) => string;
  social: string;
  solitary: string;
  socialNote: string;
  solitaryNote: string;
  latch: string;
  latchYes: string;
  latchNo: string;
  yes: string;
  no: string;
  classic: string;
  heavy: string;
  pack: string;
  presets: string;
  noPresets: string;
  held: string;
  glyph: Record<FreeGlyph, string>;
  tryIt: string;
  tryNote: (a: string, b: string) => string;
  evidence: Record<'L' | 'D' | 'S' | 'U', string>;
}

/** Numbers as both languages write them: `5,650`, `0.8`, `0.004`. */
export const fmt = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

/** Years before present of `ma` million years, as a reader sees them. */
export function yearsAgo(ma: number, lang: Lang): string {
  const years = Math.round(ma * 1e6);
  if (lang === 'ko') return years >= 1e4 ? `${fmt(years / 1e4)}만` : fmt(years);
  return years >= 1e6 ? `${fmt(years / 1e6)} million` : fmt(years);
}

const WORDS: Readonly<Record<Lang, Words>> = {
  ko: {
    overview: '한눈에 보기',
    caption: '종 목록: 시대, 몸무게, 무리 생활, 매달리기',
    colSpecies: '종',
    colEra: '시대',
    colMass: '몸무게 (kg)',
    colGroup: '생활',
    colLatch: '매달리기',
    extant: '현생',
    ago: (from, to) => `약 ${from}~${to} 년 전`,
    whatIf: '만약에',
    whatIfNote:
      '로스터의 다른 어떤 종과도 같은 시대에 살지 않았습니다. 이 종이 나오는 대결은 모두 “만약에”를 가정한 사고 실험입니다.',
    era: '시대',
    mass: '몸무게',
    massMode: (v) => `가장 흔한 값 ${v} kg`,
    size: '몸 반경',
    sizeFixed: '모든 개체가 같음',
    sizeMode: (v) => `가장 흔한 값 ${v} m`,
    social: '무리 생활',
    solitary: '단독 생활',
    socialNote: '여럿이 함께 있으면 무리 버프(결속, 집중 공격, 사기 지원)를 받습니다.',
    solitaryNote: '여럿을 고르더라도 무리 버프를 받지 않고 각자 싸웁니다.',
    latch: '매달리기',
    latchYes: '훨씬 큰 상대에게 매달려 버틸 수 있습니다.',
    latchNo: '매달리지 않고, 정면 공격 범위 안의 상대를 칩니다.',
    yes: '예',
    no: '아니요',
    classic: '클래식 모드 역할',
    heavy: '대형 동물 쪽',
    pack: '무리 동물 쪽',
    presets: '이 종이 나오는 추천 대결',
    noPresets: '아직 이 종이 나오는 추천 대결은 없습니다.',
    held: '점검 중이라 간단 모드에는 아직 보이지 않음',
    glyph: { triangle: '재생 화면에서는 삼각형', dot: '재생 화면에서는 점' },
    tryIt: '간단 모드에서 해 보기',
    tryNote: (a, b) => `${a} 1 vs ${b} 1, 나머지는 기본값으로 열립니다.`,
    evidence: { L: '문헌 값', D: '문헌에서 유도', S: '추정', U: '미검증 수치' },
  },
  en: {
    overview: 'At a glance',
    caption: 'Species list: era, mass, group living, latching',
    colSpecies: 'Species',
    colEra: 'Era',
    colMass: 'Mass (kg)',
    colGroup: 'Lives',
    colLatch: 'Latches',
    extant: 'Living today',
    ago: (from, to) => `about ${from} to ${to} years ago`,
    whatIf: 'what-if',
    whatIfNote:
      'It shared no time with any other species in the roster, so every matchup with it is a “what-if” thought experiment.',
    era: 'Era',
    mass: 'Mass',
    massMode: (v) => `most likely ${v} kg`,
    size: 'Body radius',
    sizeFixed: 'the same for every animal',
    sizeMode: (v) => `most likely ${v} m`,
    social: 'In groups',
    solitary: 'Alone',
    socialNote:
      'Several of them together get the pack buff (cohesion, focused attacks, morale support).',
    solitaryNote: 'Several of them still fight one by one, without the pack buff.',
    latch: 'Latching',
    latchYes: 'It can grab and hold on to a much larger opponent.',
    latchNo: 'It does not latch; it strikes opponents inside its frontal attack cone.',
    yes: 'Yes',
    no: 'No',
    classic: 'Classic mode role',
    heavy: 'heavy side',
    pack: 'pack side',
    presets: 'Presets with this species',
    noPresets: 'No preset uses this species yet.',
    held: 'being checked, not yet shown in Simple mode',
    glyph: { triangle: 'drawn as a triangle in the replay', dot: 'drawn as a dot in the replay' },
    tryIt: 'Try it in Simple mode',
    tryNote: (a, b) => `Opens ${a} 1 vs ${b} 1, everything else at the defaults.`,
    evidence: {
      L: 'literature value',
      D: 'derived from literature',
      S: 'assumption',
      U: 'unverified figure',
    },
  },
};

/** A number the tests compare with the registry: `<data data-k="…" value="…">shown</data>`. */
const num = (k: string, v: number): string => `<data data-k="${k}" value="${v}">${fmt(v)}</data>`;

/** The species' era as text, with registry numbers marked for the tests. */
function eraText(era: Era, lang: Lang): string {
  const w = WORDS[lang];
  if (era === 'extant') return `<span data-k="era" data-value="extant">${w.extant}</span>`;
  const from = `<data data-k="era.fromMa" value="${era.fromMa}">${yearsAgo(era.fromMa, lang)}</data>`;
  const to = `<data data-k="era.toMa" value="${era.toMa}">${yearsAgo(era.toMa, lang)}</data>`;
  return w.ago(from, to);
}

const rangeText = (k: string, r: Triangular, unit: string): string =>
  `${num(`${k}.min`, r.min)}–${num(`${k}.max`, r.max)} ${unit}`;

/** The abstract glyph: a triangle or a dot, never an animal shape (CONTRIBUTING.md). */
function glyphSvg(glyph: FreeGlyph): string {
  const shape =
    glyph === 'triangle'
      ? '<path d="M6 34 L20 6 L34 34 Z" />'
      : '<circle cx="20" cy="20" r="11" />';
  return `<svg class="sp-glyph sp-glyph-${glyph}" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">${shape}</svg>`;
}

const speciesName = (id: FreeSpeciesId, lang: Lang): string => DICTIONARIES[lang][`species.${id}`];

function presetLabel(p: FreePreset, lang: Lang): string {
  return `${escapeHtml(p.name[lang])} (${fmt(p.a.n)} : ${fmt(p.b.n)})`;
}

function overviewTable(lang: Lang): string {
  const w = WORDS[lang];
  const rows = GUIDE_SPECIES.map((id) => {
    const s = FREE_SPECIES[id];
    const m = s.traits.mass.range;
    const tag = isWhatIf(id)
      ? ` <span class="tag tag-speculative sp-whatif">${w.whatIf}</span>`
      : '';
    return [
      `              <tr data-species="${id}">`,
      `                <th scope="row"><a href="#${speciesAnchor(id)}">${escapeHtml(speciesName(id, lang))}</a></th>`,
      `                <td>${eraText(s.era, lang)}${tag}</td>`,
      `                <td>${num('mass.min', m.min)}–${num('mass.max', m.max)}</td>`,
      `                <td>${s.social ? w.social : w.solitary}</td>`,
      `                <td>${s.canLatch ? w.yes : w.no}</td>`,
      '              </tr>',
    ].join('\n');
  });
  return [
    '          <section id="overview">',
    `            <h2>${w.overview}</h2>`,
    '            <div class="table-wrap" role="region" tabindex="0" aria-labelledby="caption-species">',
    '              <table class="sp-table">',
    `                <caption id="caption-species">${w.caption}</caption>`,
    '                <thead>',
    '                  <tr>',
    `                    <th scope="col">${w.colSpecies}</th>`,
    `                    <th scope="col">${w.colEra}</th>`,
    `                    <th scope="col">${w.colMass}</th>`,
    `                    <th scope="col">${w.colGroup}</th>`,
    `                    <th scope="col">${w.colLatch}</th>`,
    '                  </tr>',
    '                </thead>',
    '                <tbody>',
    ...rows,
    '                </tbody>',
    '              </table>',
    '            </div>',
    '          </section>',
  ].join('\n');
}

function speciesSection(id: FreeSpeciesId, lang: Lang): string {
  const w = WORDS[lang];
  const d = DICTIONARIES[lang];
  const s = FREE_SPECIES[id];
  const g = SPECIES_GUIDE[id];
  const anchor = speciesAnchor(id);
  const mass = s.traits.mass;
  const radius = s.traits.bodyRadius.range;
  const glyph = speciesGlyph(id);
  const whatIf = isWhatIf(id);
  const size =
    radius.min === radius.max
      ? `${num('bodyRadius.mode', radius.mode)} m (${w.sizeFixed})`
      : `${rangeText('bodyRadius', radius, 'm')} (${w.sizeMode(num('bodyRadius.mode', radius.mode))})`;
  const roles = classicRoles(id)
    .map((r) => w[r])
    .join(lang === 'ko' ? ', ' : ' and ');
  const presets = presetsWith(id);
  const presetList =
    presets.length === 0
      ? `            <p class="sp-presets-none">${w.noPresets}</p>`
      : [
          '            <ul class="sp-presets">',
          ...presets.map(
            (p) =>
              `              <li data-preset="${p.id}">${presetLabel(p, lang)}${p.hold === undefined ? '' : ` <span class="sp-held">(${w.held})</span>`}</li>`,
          ),
          '            </ul>',
        ].join('\n');
  const evidence = mass.evidence ?? 'S';
  const lines = [
    `          <section id="${anchor}" class="sp-card" data-species="${id}" aria-labelledby="${anchor}-title">`,
    '            <div class="sp-card-head">',
    `              ${glyphSvg(glyph)}`,
    '              <div>',
    `                <h2 id="${anchor}-title">${escapeHtml(speciesName(id, lang))}${whatIf ? ` <span class="tag tag-speculative sp-whatif">${w.whatIf}</span>` : ''}</h2>`,
    `                <p class="sp-sci" lang="la"><i>${escapeHtml(g.scientific)}</i></p>`,
    '              </div>',
    '            </div>',
    `            <p>${escapeHtml(g.note[lang])}</p>`,
  ];
  if (whatIf) lines.push(`            <p class="sp-whatif-note">${w.whatIfNote}</p>`);
  if (id === 'homoErectus') {
    lines.push(
      `            <p class="warning" data-i18n="matchup.thoughtExperiment">${escapeHtml(d['matchup.thoughtExperiment'])}</p>`,
    );
  }
  lines.push(
    '            <dl class="facts sp-facts">',
    `              <dt>${w.era}</dt>`,
    `              <dd>${eraText(s.era, lang)}</dd>`,
    `              <dt>${w.mass}</dt>`,
    `              <dd>${rangeText('mass', mass.range, 'kg')} (${w.massMode(num('mass.mode', mass.range.mode))}; <abbr data-k="mass.evidence" title="${w.evidence[evidence]}">${evidence}</abbr>)</dd>`,
    `              <dt>${w.size}</dt>`,
    `              <dd>${size}; ${w.glyph[glyph]}</dd>`,
    `              <dt>${s.social ? w.social : w.solitary}</dt>`,
    `              <dd data-k="social" data-value="${s.social}">${s.social ? w.socialNote : w.solitaryNote}</dd>`,
    `              <dt>${w.latch}</dt>`,
    `              <dd data-k="canLatch" data-value="${s.canLatch}">${s.canLatch ? w.latchYes : w.latchNo}</dd>`,
    `              <dt>${w.classic}</dt>`,
    `              <dd data-k="classic" data-value="${classicRoles(id).join(' ')}">${roles}</dd>`,
    '            </dl>',
    `            <h3 id="${anchor}-presets">${w.presets}</h3>`,
    presetList,
    '            <p class="sp-try">',
    `              <a class="button" href="${escapeHtml(tryItHref(id, lang))}" data-try="${id}">${w.tryIt}</a>`,
    `              <span class="sp-try-note">${escapeHtml(w.tryNote(speciesName(id, lang), speciesName(tryOpponent(id), lang)))}</span>`,
    '            </p>',
    '          </section>',
  );
  return lines.join('\n');
}

/** The closing section: where the numbers come from and how to read them. */
function aboutData(lang: Lang): string {
  const ko = lang === 'ko';
  const p = (path: string): string => (ko ? path : `/en${path}`);
  const paras = ko
    ? [
        '이 페이지의 숫자는 손으로 옮겨 적지 않았습니다. 사이트를 빌드할 때 시뮬레이터가 실제로 쓰는 종 등록부(자유 대결 모델과 클래식 모델)에서 바로 읽어 옵니다. 그래서 시뮬레이터의 기본값이 바뀌면 이 페이지도 함께 바뀝니다.',
        '몸무게와 몸 반경은 삼각분포의 최솟값 · 가장 흔한 값 · 최댓값입니다. 시뮬레이터는 판마다, 그리고 개체마다 이 범위 안에서 값을 새로 뽑습니다. 괄호 안의 글자는 근거 수준입니다: L은 문헌 값, D는 문헌에서 계산한 값, S는 추정, U는 검증되지 않은 대중적 수치입니다.',
        `모든 특성의 범위와 근거는 <a href="${p('/parameters/')}#species">파라미터</a> 페이지에, 엔진이 이 값들을 어떻게 쓰는지는 <a href="${p('/model/')}">모델 설명</a>에 있습니다. 출처 목록은 GitHub의 <a href="https://github.com/VinylStage/trex_vs_tiger_sim/blob/main/docs/SPECIES.md" rel="noopener">종 문서</a>에 있습니다.`,
        '이 시뮬레이터는 교육용 모델입니다. 실제 동물 싸움을 권장하거나 지지하지 않으며, 결과는 가정에 따라 크게 달라집니다. 전투 불능이 된 개체는 회색 표시로만 나타냅니다.',
      ]
    : [
        'No number on this page is typed by hand. The build reads them straight from the species registries the simulator runs on (the free model and the classic model), so when a default changes in the simulator, this page changes with it.',
        'Mass and body radius are the minimum, most likely value and maximum of a triangular distribution. The simulator draws a new value inside that range for every run and every animal. The letter in brackets is the evidence level: L a literature value, D derived from literature, S an assumption, U an unverified popular figure.',
        `Every trait range and its evidence is on the <a href="${p('/parameters/')}#species">parameters</a> page, and how the engine uses them is on the <a href="${p('/model/')}">model</a> page. The sources are listed in the <a href="https://github.com/VinylStage/trex_vs_tiger_sim/blob/main/docs/SPECIES.md" rel="noopener">species document</a> on GitHub.`,
        'The simulator is an educational model. It does not promote or endorse real animal fighting, and its results depend heavily on its assumptions. Incapacitated animals are only shown greyed out.',
      ];
  return [
    '          <section id="about-data">',
    `            <h2>${ko ? '숫자는 어디서 오나' : 'Where the numbers come from'}</h2>`,
    ...paras.map((t) => `            <p>${t}</p>`),
    '          </section>',
  ].join('\n');
}

/**
 * The guide's body: a contents list of the species (`nav.toc`), then `div.page-body` with the
 * overview table and one `section.sp-card#sp-<id>` per species, in registry order.
 */
export function renderSpeciesGuide(lang: Lang): string {
  const toc = GUIDE_SPECIES.map(
    (id) =>
      `            <li><a href="#${speciesAnchor(id)}">${escapeHtml(speciesName(id, lang))}</a></li>`,
  ).join('\n');
  return [
    '<nav class="toc" aria-labelledby="toc-title">',
    `          <h2 id="toc-title">${lang === 'ko' ? '목차' : 'Contents'}</h2>`,
    '          <ol>',
    `            <li><a href="#overview">${WORDS[lang].overview}</a></li>`,
    toc,
    '            <li><a href="#about-data">' +
      (lang === 'ko' ? '숫자는 어디서 오나' : 'Where the numbers come from') +
      '</a></li>',
    '          </ol>',
    '        </nav>',
    '',
    '        <div class="page-body">',
    overviewTable(lang),
    ...GUIDE_SPECIES.map((id) => speciesSection(id, lang)),
    aboutData(lang),
    '        </div>',
  ].join('\n');
}

/**
 * Replace `<!-- species-guide -->` with the guide for the page's language. Sources without the
 * placeholder are returned unchanged; the placeholder on any page other than the species guide
 * throws.
 */
export function expandSpeciesGuide(html: string, route: HeaderRoute | null, file: string): string {
  if (!html.includes(SPECIES_GUIDE_PLACEHOLDER)) return html;
  if (!route || route.page !== 'species') {
    throw new Error(`${file}: ${SPECIES_GUIDE_PLACEHOLDER} belongs on the species guide only`);
  }
  return html.replace(SPECIES_GUIDE_PLACEHOLDER, () => renderSpeciesGuide(route.lang));
}
