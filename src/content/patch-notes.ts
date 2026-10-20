import type { Lang } from '../ui/i18n.ts';

/*
 * The patch notes board (/patch-notes/, /en/patch-notes/, docs/PAGES.md#patch-notes): one entry
 * per release, newest first, written for players rather than for the CHANGELOG. The page HTML is
 * generated from this data at build time (src/pages/patch-notes-page.ts). Every release adds an
 * entry (CONTRIBUTING.md#release-cadence); tests/patch-notes.test.ts checks that each released
 * version has one, that the list is sorted and that the wording follows the content rules
 * (no blood, death or gore words; simulation states are 전투 불능 / incapacitated).
 *
 * Keep it fun but true: every line describes something the release actually shipped. The Korean
 * and English texts are written separately, not translated word for word.
 */

/** Bullet groups, in the order a card shows them. */
export const PATCH_CATEGORIES = ['new', 'improved', 'fixed', 'security', 'a11y', 'known'] as const;
export type PatchCategory = (typeof PATCH_CATEGORIES)[number];

/** Heading of each bullet group: an emoji and a word. */
export const CATEGORY_LABELS: Readonly<Record<Lang, Readonly<Record<PatchCategory, string>>>> = {
  ko: {
    new: '✨ 새 기능',
    improved: '🛠 개선',
    fixed: '🐛 버그 수정',
    security: '🔒 보안',
    a11y: '♿ 접근성',
    known: '⚠️ 알려진 이슈',
  },
  en: {
    new: '✨ New',
    improved: '🛠 Improvements',
    fixed: '🐛 Bug fixes',
    security: '🔒 Security',
    a11y: '♿ Accessibility',
    known: '⚠️ Known issues',
  },
};

export interface PatchItem {
  cat: PatchCategory;
  /** GitHub issue or pull request numbers this line is about (linked after the text). */
  refs?: readonly number[];
  ko: string;
  en: string;
}

export interface PatchNote {
  /** Released version, `X.Y.Z` as in .release-please-manifest.json and CHANGELOG.md. */
  version: string;
  /** Release date, `YYYY-MM-DD`, the date of the version's CHANGELOG.md heading. */
  date: string;
  title: Readonly<Record<Lang, string>>;
  /** The pull requests that shipped the release. */
  prs: readonly number[];
  /** 2–6 bullets. */
  items: readonly PatchItem[];
}

/** Every release, newest first. */
export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '0.2.9',
    date: '2026-10-20',
    title: {
      ko: '누구든 덤벼라: 자유 대결 개장 🥊',
      en: 'Anyone vs anyone: Free matchup is open 🥊',
    },
    prs: [90],
    items: [
      {
        cat: 'new',
        refs: [50],
        ko: '설정 패널 맨 위에 ‘대결 방식’ 스위치가 생겼습니다. 클래식은 그대로 두고, 자유 대결에서는 열 가지 종 중 누구든 A 진영과 B 진영에 세울 수 있어요. 매머드 대 매머드 같은 같은 종 대결도 OK.',
        en: 'A new mode switch sits at the top of the settings panel. Classic stays exactly as it was; Free matchup puts any of the ten species on side A or side B. Mammoth vs mammoth? Go for it.',
      },
      {
        cat: 'new',
        ko: '결과는 A 승리 · B 승리 · 무승부 비율을 95% 구간과 함께 보여 주고, 진영별 생존 · 전투 불능 · 도주 평균도 한눈에 정리합니다.',
        en: 'Results show A wins, B wins and draws with 95% intervals, plus the average survivors, incapacitated and fled on each side.',
      },
      {
        cat: 'new',
        ko: '자유 대결 설정도 v3 링크와 TVT3- 설정 코드로 공유됩니다. 기존 가져오기 칸에 TVT3 코드를 붙여 넣으면 알아서 자유 대결로 넘어가요.',
        en: 'Free setups travel as v3 links and TVT3- settings codes. Paste a TVT3 code into the usual import box and the simulator hops into Free mode by itself.',
      },
      {
        cat: 'known',
        ko: '자유 대결 리플레이와 무리 버프 규칙은 아직 오븐 안에 있습니다. 숫자는 보정 전 잠정값이고, 결과 링크(/r/)는 당분간 클래식 전용이에요.',
        en: 'Free-mode replays and pack-buff rules are still in the oven. The numbers are provisional until calibration lands, and result links (/r/) stay classic-only for now.',
      },
    ],
  },
  {
    version: '0.2.8',
    date: '2026-10-20',
    title: {
      ko: '모두를 위한 대청소 🧹',
      en: 'Accessibility spring cleaning 🧹',
    },
    prs: [88],
    items: [
      {
        cat: 'a11y',
        refs: [68, 70],
        ko: '차트 데이터 표가 키보드로 들어갈 수 있는 스크롤 영역이 됐습니다. 아직 아무것도 그리지 않은 차트는 더 이상 ‘이름 없는 이미지’ 행세를 하지 않아요.',
        en: 'Chart data tables are now keyboard-reachable scroll regions, and a chart with nothing drawn yet no longer pretends to be a nameless image.',
      },
      {
        cat: 'a11y',
        refs: [69],
        ko: '되돌리기 안내와 ‘링크 복사’ 메시지를 스크린 리더가 매번 빠짐없이 읽어 줍니다. 같은 말을 두 번 해도요.',
        en: 'Screen readers now announce the undo notice and the copy-link message every single time, even when the message repeats itself.',
      },
      {
        cat: 'a11y',
        refs: [71],
        ko: '언어 버튼의 접근 가능한 이름이 보이는 글자로 시작하고, 영어 가이드 속 한국어 단어에는 lang="ko" 이름표를 달았습니다.',
        en: 'The language button’s accessible name now starts with its visible text, and the Korean word on the English guide wears a lang="ko" name tag.',
      },
      {
        cat: 'fixed',
        ko: '앱에서 언어를 바꾸면 파비콘이 /en/favicon.svg를 찾아 길을 잃던 문제를 고쳤습니다. 이제 모든 페이지가 절대 경로를 써요.',
        en: 'Fixed the favicon getting lost at /en/favicon.svg after an in-app language switch. Every page now uses root-absolute asset URLs.',
      },
    ],
  },
  {
    version: '0.2.7',
    date: '2026-10-20',
    title: {
      ko: '현관에 자물쇠 세 개 추가 🔐',
      en: 'Three more locks on the front door 🔐',
    },
    prs: [85],
    items: [
      {
        cat: 'security',
        refs: [57],
        ko: 'GitHub Actions를 커밋 SHA로 고정했습니다. 누가 태그를 슬쩍 옮겨도 빌드는 꿈쩍하지 않아요.',
        en: 'GitHub Actions are pinned to commit SHAs, so a quietly moved tag can’t sneak new code into the build.',
      },
      {
        cat: 'security',
        refs: [58],
        ko: 'HSTS를 켰습니다. 브라우저가 이제 이 사이트는 무조건 HTTPS로만 찾아와요.',
        en: 'HSTS is on: browsers now insist on HTTPS for this site, no exceptions.',
      },
      {
        cat: 'security',
        refs: [59],
        ko: 'CSP에 Trusted Types를 적용했습니다. 통과할 수 있는 정책은 시뮬레이션 워커를 불러오는 sim-worker 단 하나뿐이에요.',
        en: 'Trusted Types are enforced in the CSP, with exactly one policy on the guest list: sim-worker, which loads the simulation worker and nothing else.',
      },
    ],
  },
  {
    version: '0.2.6',
    date: '2026-10-20',
    title: {
      ko: '무대 뒤에서 새 엔진 시동 ⚙️',
      en: 'A new engine, idling backstage ⚙️',
    },
    prs: [83],
    items: [
      {
        cat: 'new',
        refs: [50],
        ko: '양쪽 진영이 똑같은 규칙으로 싸우는 대칭 엔진을 만들었습니다. 모든 개체가 같은 상태 기계로 이동 · 공격 · 도주 · 회복해요.',
        en: 'Built a symmetric engine where both sides play by the same rules: every agent runs one state machine for moving, striking, routing and recovering.',
      },
      {
        cat: 'new',
        ko: '매달리기는 붙잡을 수 있는 종만, 그것도 자기보다 충분히 무거운 상대에게만 할 수 있습니다. 밀려나는 정도는 몸무게 비율로 정해져요.',
        en: 'Latching is reserved for species that can grab, and only onto opponents that are a lot heavier. Knock-back now scales with the mass ratio.',
      },
      {
        cat: 'improved',
        ko: '새 엔진은 개체 한 걸음당 계산 비용이 클래식 엔진보다 적습니다(벤치마크 0.46–0.70배). 같은 종끼리, 진영을 바꿔 돌려도 공정한지 테스트가 지켜봐요.',
        en: 'Per agent-step the new engine is cheaper than the classic one (0.46–0.70× in benchmarks), and tests make sure mirror and side-swapped matchups come out fair.',
      },
      {
        cat: 'known',
        ko: '아직 화면에는 연결되지 않았습니다. 무대 뒤에서 몸 푸는 중이에요.',
        en: 'Not wired into the UI yet. It’s stretching backstage.',
      },
    ],
  },
  {
    version: '0.2.5',
    date: '2026-10-20',
    title: {
      ko: '자유 대결 설계도에 도장 쾅 📐',
      en: 'Free matchup blueprints, stamped 📐',
    },
    prs: [77],
    items: [
      {
        cat: 'new',
        refs: [50],
        ko: '양쪽 진영에 어떤 종이든 세울 수 있는 자유 대결 설정을 만들었습니다(같은 종 대결 포함). 진영별 1–5,000, 합계 5,500까지.',
        en: 'Added the config behind free matchups: any species on either side, mirror matchups included, 1–5,000 per side and 5,500 in total.',
      },
      {
        cat: 'improved',
        ko: '입력 정리 장치(sanitizer)가 범위를 벗어난 값을 공통 경계 안으로 돌려보내고, 실행 횟수를 작업 예산에 맞게 줄여 줍니다.',
        en: 'A sanitizer nudges out-of-range values back inside the shared bounds and trims the run count to fit the work budget.',
      },
      {
        cat: 'improved',
        ko: '클래식 설정과 결과는 한 비트도 바뀌지 않았습니다. 예전 공유 링크도 전과 똑같이 열려요.',
        en: 'Classic settings and results are bit-for-bit unchanged. Your old share links open exactly as before.',
      },
    ],
  },
  {
    version: '0.2.4',
    date: '2026-10-20',
    title: {
      ko: '모든 종에게 같은 이력서 양식 📋',
      en: 'One résumé template for every species 📋',
    },
    prs: [75],
    items: [
      {
        cat: 'new',
        refs: [50],
        ko: '열 가지 종 모두가 같은 20개 개체 특성과 6개 무리 버프 특성을 채우는 통합 프리셋을 만들었습니다. 자유 대결을 위한 기초 공사예요.',
        en: 'All ten species now fill in the same 20 individual traits and 6 pack-buff traits. Groundwork for free matchups.',
      },
      {
        cat: 'new',
        ko: '사회성 종인지, 큰 상대에게 매달릴 수 있는지 같은 성격 표시도 종마다 붙였습니다.',
        en: 'Each species also carries flags such as “social” and “can latch onto bigger opponents”.',
      },
      {
        cat: 'improved',
        refs: [74],
        ko: '자유 대결 계획을 설계 문서와 ADR-0007로 정리했습니다. 클래식 엔진은 지금 모습 그대로 보존합니다.',
        en: 'The free matchup plan is written up in a design doc and ADR-0007. The classic engine stays frozen as it is.',
      },
    ],
  },
  {
    version: '0.2.3',
    date: '2026-10-20',
    title: {
      ko: '결과 자랑 타임 📤',
      en: 'Show-off time 📤',
    },
    prs: [56],
    items: [
      {
        cat: 'new',
        refs: [51],
        ko: '설정을 TVT2- 코드나 .json 파일로 내보내고 가져올 수 있습니다. 적용하기 전에 미리보기도 보여 드려요.',
        en: 'Export and import settings as TVT2- codes or .json files, with a preview before anything is applied.',
      },
      {
        cat: 'new',
        ko: '‘결과 공유’로 가벼운 /r/ 결과 페이지 링크를 만들 수 있고, 메신저 링크 미리보기에도 결과가 뜹니다.',
        en: '“Share result” creates a link to a lightweight /r/ result page, and the link preview in chat apps shows the result too.',
      },
      {
        cat: 'new',
        ko: '추상 도형으로 그린 결과 카드(1080×1920 세로, 1080×1080 정사각)를 저장하거나 바로 공유하세요.',
        en: 'Save or share a result card drawn in abstract glyphs, in 1080×1920 portrait or 1080×1080 square.',
      },
      {
        cat: 'improved',
        ko: '클립보드를 쓸 수 없는 환경에서는 직접 선택해 복사할 수 있는 텍스트 상자를 대신 띄웁니다.',
        en: 'No clipboard access? You get a selectable text box instead.',
      },
      {
        cat: 'fixed',
        ko: '결과 카드의 무리 점들이 우연히 글자 모양으로 뭉치지 않도록 느슨한 구름처럼 흩뿌립니다.',
        en: 'Pack dots on the result card now scatter as a loose cloud, so they never accidentally spell a letter.',
      },
    ],
  },
  {
    version: '0.2.2',
    date: '2026-10-20',
    title: {
      ko: '매머드와 호모 에렉투스 입장 🦣',
      en: 'Enter the mammoth (and Homo erectus) 🦣',
    },
    prs: [54],
    items: [
      {
        cat: 'new',
        refs: [47],
        ko: '털매머드와 호모 에렉투스가 합류했습니다. 새 프리셋 ‘매머드 1 대 늑대 12’, ‘티렉스 1 대 호모 에렉투스 100’도 준비했어요.',
        en: 'The woolly mammoth and Homo erectus join the roster, with two new presets: 1 mammoth vs 12 wolves and 1 T-Rex vs 100 Homo erectus.',
      },
      {
        cat: 'fixed',
        ko: '맨손의 호모 에렉투스 한 명이 호랑이를 98% 확률로 줄행랑치게 만들던 ‘기 싸움 버그’를 잡았습니다. 종마다 위압감 상수를 둬서 이제 혼자서는 대부분 집니다.',
        en: 'Squashed the “stare-down bug” where one bare-handed Homo erectus sent a tiger running in 98% of runs. A per-species intimidation constant now applies, and a lone hominin loses most runs to one tiger.',
      },
      {
        cat: 'improved',
        ko: '결과, 리플레이, 안내 페이지의 표현을 ‘전투 불능’으로 통일했습니다.',
        en: 'Results, replays and the guide pages now consistently say “incapacitated”.',
      },
      {
        cat: 'improved',
        ko: '화석 기록이 겹치는 조합은 ‘만난 적 없음’ 대신 ‘기록된 만남 없음’으로 정직하게 안내합니다.',
        en: 'Pairs whose fossil records overlap now honestly read “no recorded encounters” instead of “never met”.',
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-10-20',
    title: {
      ko: '더 빠르게, 더 또렷하게 ⚡',
      en: 'Faster, clearer, comfier ⚡',
    },
    prs: [52],
    items: [
      {
        cat: 'improved',
        refs: [24],
        ko: '공간 탐색을 다듬어 500 대 5,000 같은 큰 판이 약 27% 빨라졌고, 집계는 워커에서 돌아가서 결과를 셀 때 화면이 멈칫하지 않습니다.',
        en: 'Tuned the spatial search so big 500 v 5,000 battles run about 27% faster, and moved the tallying into a worker so the page no longer stutters while it counts.',
      },
      {
        cat: 'improved',
        ko: '워커 수를 ‘코어 수 − 1’로 바꿔 페이지가 숨 쉴 코어 하나를 남겨 둡니다.',
        en: 'The worker pool now uses one worker fewer than you have cores, leaving the page a core to breathe.',
      },
      {
        cat: 'new',
        ko: '결과 첫 줄이 이제 횟수로 말합니다: “이 모델로 500번 싸워 보니 T-Rex 쪽이 498번 이겼습니다.”',
        en: 'The headline now talks in counts: “In 500 simulated battles under this model, the T-Rex side won 498.”',
      },
      {
        cat: 'a11y',
        ko: '버튼, 링크, 입력 칸의 색 대비를 WCAG AA 기준에 맞췄습니다.',
        en: 'Buttons, links and form controls now meet WCAG AA contrast.',
      },
      {
        cat: 'fixed',
        ko: '모바일 화면에서 어긋나던 배치를 한 바퀴 손봤습니다.',
        en: 'A round of mobile layout fixes for small screens.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-20',
    title: {
      ko: '한 페이지에서 사이트로 이사 🏗',
      en: 'Moving from one page to a whole site 🏗',
    },
    prs: [32, 34, 37, 38, 39, 41, 43, 44, 45, 48],
    items: [
      {
        cat: 'new',
        refs: [37, 43],
        ko: '사용 방법, 모델 설명, 파라미터, 소개, 개인정보처리방침 페이지를 한국어와 영어로 열었습니다. 언어는 주소가 정하고, 사이트맵과 404 페이지도 갖췄어요.',
        en: 'Guide, model, parameters, about and privacy pages opened in Korean and English. The URL picks the language, and there’s a sitemap and proper 404 pages too.',
      },
      {
        cat: 'new',
        refs: [44],
        ko: '도형으로만 그리는 추상 리플레이 v2: 사건 단위로 정확하고, 카메라와 타임라인, 접근성 지원까지.',
        en: 'Replay v2: event-exact abstract replays drawn in plain shapes, with a camera, a timeline and accessibility support.',
      },
      {
        cat: 'new',
        refs: [45],
        ko: '티렉스와 호랑이 말고도 여러 종을 고르는 종 선택기와 대결 프리셋이 생겼습니다. 예전 링크도 그대로 열려요.',
        en: 'Species pickers and matchup presets bring more animals than just the T-Rex and the tiger, and old links still open as before.',
      },
      {
        cat: 'new',
        refs: [38],
        ko: '처음 오신 분을 위한 대화형 둘러보기 투어를 준비했습니다.',
        en: 'A guided tour now walks first-time visitors through the simulator.',
      },
      {
        cat: 'new',
        refs: [39],
        ko: '헤더에 버전 배지가 생겼습니다. 새 배포를 감지하면 알려 드리고, 캐시를 비운 뒤 최신 버전을 불러올 수 있어요.',
        en: 'A version badge in the header spots new deployments and can clear the cache to load the latest one.',
      },
      {
        cat: 'improved',
        refs: [32, 34, 41, 48],
        ko: 'Pretendard 글꼴을 직접 호스팅하고, OG 카드와 아이콘 세트를 새로 그렸으며, 모든 페이지의 헤더 로고를 하나로 맞췄습니다.',
        en: 'Self-hosted the Pretendard typeface, drew new social cards and icons, and made every page’s header logo the same one.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-19',
    title: {
      ko: '첫 출근했습니다 🎉',
      en: 'Hello, world (of Monte Carlo) 🎉',
    },
    prs: [8, 11, 15],
    items: [
      {
        cat: 'new',
        refs: [8],
        ko: '티라노사우루스 N마리와 호랑이 M마리를 수천 번 맞붙여 보는 몬테카를로 에이전트 기반 엔진이 첫 출근했습니다.',
        en: 'Day one: a Monte Carlo, agent-based engine that pits N T. rex against M tigers thousands of times.',
      },
      {
        cat: 'new',
        refs: [15],
        ko: '능력치 범위와 시나리오를 마음대로 바꾸는 설정 화면, 링크 하나로 끝나는 URL 공유, 한국어와 영어 지원.',
        en: 'A settings panel for every range and scenario knob, one-link URL sharing, and Korean and English from the start.',
      },
      {
        cat: 'security',
        refs: [11],
        ko: '문단속부터 했습니다: Cloudflare Pages 보안 헤더와 엄격한 CSP.',
        en: 'Locked the doors on day one: Cloudflare Pages security headers and a strict CSP.',
      },
    ],
  },
];

/** `[major, minor, patch]` of an `X.Y.Z` version. */
export function versionParts(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`not an X.Y.Z version: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Fragment id of a version's card: `0.2.9` → `v0-2-9`. */
export const versionAnchor = (version: string): string => `v${version.replaceAll('.', '-')}`;

/**
 * The entries a build at `version` shows: every entry up to and including that version. An entry
 * written ahead of its release (the next version) stays hidden until package.json reaches it, so
 * the notes land together with the release.
 */
export function releasedNotes(version: string): PatchNote[] {
  return PATCH_NOTES.filter((n) => compareVersions(n.version, version) <= 0);
}
