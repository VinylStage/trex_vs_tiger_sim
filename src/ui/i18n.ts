import type { ParamId } from '../sim/params.ts';
import {
  DEFAULT_HEAVY,
  DEFAULT_PACK,
  type HeavySpeciesId,
  type PackSpeciesId,
  type SpeciesId,
  type Weapon,
} from '../sim/species.ts';

export type Lang = 'ko' | 'en';
export const LANGS: readonly Lang[] = ['ko', 'en'];
export const DEFAULT_LANG: Lang = 'ko';

const ko = {
  'app.title': '티렉스 대 호랑이 시뮬레이터',
  'app.shortTitle': '티렉스 대 호랑이',
  'app.tagline': '티라노사우루스 vs 호랑이 · 몬테카를로 방법으로 배우는 교육용 시뮬레이션',
  'app.documentTitle': '티렉스 대 호랑이 시뮬레이터 – 티라노사우루스 vs 호랑이, 누가 이길까?',
  'lang.switch': 'English',
  'lang.switchAria': 'Switch the interface to English',
  'share.copy': '설정 링크 복사',
  'share.hint': '현재 설정을 URL로 공유합니다. 시드가 포함되므로 같은 결과가 재현됩니다.',
  'share.copied': '링크를 복사했습니다.',
  'share.failed': '복사하지 못했습니다. 주소창의 URL을 직접 복사하세요.',

  'nav.label': '사이트 메뉴',
  'breadcrumb.label': '이동 경로',
  'nav.simulator': '시뮬레이터',
  'nav.guide': '사용 방법',
  'nav.model': '모델 설명',
  'nav.parameters': '파라미터',
  'nav.about': '소개',
  'nav.privacy': '개인정보처리방침',
  'nav.license': '라이선스',
  'version.badgeTitle': '버전 정보와 업데이트 확인',
  'version.status.checking': '확인 중',
  'version.status.latest': '최신',
  'version.status.newer': '새 버전',
  'version.status.rebuild': '새 빌드',
  'version.status.changed': '변경됨',
  'version.status.error': '확인 불가',
  'version.dialogTitle': '버전 정보',
  'version.current': '현재 버전',
  'version.builtAt': '빌드 시각',
  'version.deployed': '배포된 최신 버전',
  'version.checkedAt': '마지막 확인',
  'version.unknown': '알 수 없음',
  'version.msg.checking': '배포된 최신 버전을 확인하는 중입니다…',
  'version.msg.latest': '최신 버전을 사용하고 있습니다.',
  'version.msg.newer': '새 버전이 배포되었습니다. 아래 버튼으로 불러오세요.',
  'version.msg.rebuild': '같은 버전에 새 변경 사항이 배포되었습니다. 아래 버튼으로 불러오세요.',
  'version.msg.changed': '지금 배포된 버전이 이 페이지와 다릅니다. 아래 버튼으로 불러오세요.',
  'version.msg.error':
    '배포 정보를 가져오지 못했습니다. 네트워크 연결을 확인한 뒤 “다시 확인”을 누르세요.',
  'version.recheck': '다시 확인',
  'version.releaseNotes': '릴리스 노트 (GitHub)',
  'version.reload': '최신 버전 불러오기 (캐시·저장소 초기화)',
  'version.confirmTitle': '캐시와 저장소를 초기화할까요?',
  'version.confirmBody':
    '이 사이트가 브라우저에 저장한 캐시와 데이터를 지운 뒤 최신 버전을 다시 불러옵니다. 튜토리얼 안내를 닫았거나 마친 기록이 초기화됩니다. 지금 시나리오 설정과 언어는 주소(URL)에 담겨 있어 그대로 유지됩니다.',
  'version.confirm': '초기화하고 불러오기',
  'version.cancel': '취소',
  'version.resetting': '초기화하는 중…',
  'version.close': '닫기',
  'version.banner': '새 버전이 배포되었습니다: {label}',
  'version.bannerAction': '업데이트',
  'version.bannerDismiss': '나중에',
  'version.bannerRegion': '업데이트 알림',
  'version.updated': '최신 버전을 불러왔습니다 (v{version}).',
  'version.footer': '버전',
  'version.footerTitle': '릴리스 노트 보기',

  'config.title': '시나리오',
  'config.presets': '대결 프리셋',
  'preset.default': '{label} (기본)',
  'preset.hint':
    '양쪽 종, 마릿수, 실행 횟수를 한 번에 바꾸고 파라미터 범위를 그 종의 기본값으로 되돌립니다. 나머지 설정은 그대로입니다.',
  'team.one': '{name} {n}마리',
  'team.other': '{name} {n}마리',

  'field.heavyCount': '{Heavy} 수',
  'field.packCount': '{Pack} 수',
  'field.runs': '시뮬레이션 횟수',
  'field.seed': '시드',
  'field.arenaSize': '경기장 한 변 (m)',
  'field.maxTime': '제한 시간 (초)',
  'field.sampling': '샘플링 방법',
  'field.individualCV': '개체 변동 (CV)',
  'field.packTactic': '무리 전술',
  'field.heavySpecies': '대형 동물',
  'field.packSpecies': '무리 동물',
  'help.heavySpecies':
    '혼자 싸우는 대형 동물입니다. 바꾸면 이쪽 파라미터 범위가 그 종의 기본값으로 바뀝니다.',
  'help.packSpecies':
    '여럿이 함께 공격하는 무리 동물입니다. 바꾸면 이쪽 파라미터 범위가 그 종의 기본값으로 바뀝니다.',
  'species.group.extant': '현생 동물',
  'species.group.extinct': '멸종 동물',
  'matchup.label': '대결 성격',
  'matchup.documented': '야생에서 관찰된 대결',
  'matchup.neverMet': '서로 만난 적 없는 종',
  'matchup.undocumented': '관찰 기록 없는 가상 대결',
  'matchup.sources': '근거 보기',
  'toast.rangesReset': '파라미터 범위를 {name} 기본값으로 바꿨습니다.',
  'toast.presetApplied': '{label} 프리셋을 적용했습니다.',
  'toast.undo': '되돌리기',
  'toast.restored': '이전 설정을 되살렸습니다.',
  'toast.dismiss': '닫기',
  'field.morale': '사기 · 도주',
  'help.heavyCount': '성체 {heavyPl} 마릿수.',
  'help.packCount': '성체 {packPl} 마릿수.',
  'help.runs': '실행 횟수가 많을수록 신뢰구간이 좁아집니다.',
  'help.seed': '같은 시드와 설정이면 결과가 정확히 재현됩니다.',
  'help.arenaSize': '정사각형 경기장. 도주한 {packPl} 개체는 경계를 벗어나면 전투에서 이탈합니다.',
  'help.maxTime': '이 시간까지 승부가 나지 않으면 무승부입니다.',
  'help.sampling': 'LHS는 같은 실행 횟수로 파라미터 공간을 더 고르게 덮습니다.',
  'help.individualCV':
    '한 실행 안에서 개체마다 능력치에 N(1, CV) 계수를 곱합니다 (0.5–1.5로 절단).',
  'help.packTactic':
    '측면 포위: 정면 공격 범위를 피해 옆·뒤로 접근. 정면 돌격: 가장 가까운 {heavy} 쪽으로 곧장 달려듦.',
  'help.morale': '끄면 {packPl} 무리는 사기가 떨어져도 도주하지 않습니다.',
  'seed.randomize': '무작위',
  'seed.randomizeAria': '무작위 시드 생성',
  'sampling.lhs': 'LHS (라틴 하이퍼큐브)',
  'sampling.random': '단순 무작위',
  'tactic.flank': '측면 포위',
  'tactic.direct': '정면 돌격',
  'morale.on': '사기 저하와 도주를 모델링',

  'advanced.title': '고급: 모델 파라미터 범위',
  'advanced.intro':
    '각 파라미터는 실행마다 삼각분포(최소 · 최빈 · 최대)에서 샘플링됩니다. 기본값은 고른 종의 프리셋이고, 이름 옆 글자는 근거 수준입니다(L 문헌, D 문헌에서 유도, S 추정, U 미검증). 출처는 파라미터 설명 페이지와 docs/SPECIES.md에 있습니다.',
  'advanced.param': '파라미터',
  'advanced.min': '최소',
  'advanced.mode': '최빈',
  'advanced.max': '최대',
  'advanced.unit': '단위',
  'advanced.reset': '종 기본값',
  'advanced.resetRowAria': '{name} 범위를 종 기본값으로 되돌리기',
  'advanced.resetAll': '모든 파라미터를 종 기본값으로',
  'advanced.modified': '{n}개 변경됨',
  'advanced.inputAria': '{name} {which}',
  'species.trex': '티라노사우루스',
  'species.elephant': '아프리카코끼리',
  'species.buffalo': '아프리카물소',
  'species.brownBear': '불곰',
  'species.tiger': '호랑이',
  'species.lion': '사자',
  'species.wolf': '회색늑대',
  'species.hyena': '점박이하이에나',
  'species.trex.one': 'T-Rex',
  'species.trex.other': 'T-Rex',
  'species.elephant.one': '코끼리',
  'species.elephant.other': '코끼리',
  'species.buffalo.one': '물소',
  'species.buffalo.other': '물소',
  'species.brownBear.one': '불곰',
  'species.brownBear.other': '불곰',
  'species.tiger.one': '호랑이',
  'species.tiger.other': '호랑이',
  'species.lion.one': '사자',
  'species.lion.other': '사자',
  'species.wolf.one': '늑대',
  'species.wolf.other': '늑대',
  'species.hyena.one': '하이에나',
  'species.hyena.other': '하이에나',
  'evidence.L': '문헌 값',
  'evidence.D': '문헌에서 유도한 값',
  'evidence.S': '추정값',
  'evidence.U': '미검증 대중 수치',
  'evidence.aria': '근거: {tag}',

  'cost.capped': '작업량 한도 때문에 실행 시 반복 횟수가 {n}회로 줄어듭니다.',
  'cost.heavy':
    '무거운 시나리오입니다 (대략 {eta} 예상). 기기에 따라 더 걸릴 수 있으니 실행 횟수를 줄이는 것을 고려하세요.',
  'cost.extreme':
    '매우 무거운 시나리오입니다 (대략 {eta} 예상). 계산하는 동안 브라우저가 느려질 수 있습니다.',

  'run.start': '시뮬레이션 실행',
  'run.cancel': '취소',
  'run.cancelled': '취소했습니다.',
  'run.error': '오류: {msg}',
  'run.aggregating': '집계 중…',
  'progress.label': '진행률',
  'progress.text': '{done} / {total}회 ({pct})',
  'progress.eta': '남은 시간 약 {eta}',
  'progress.etaPending': '남은 시간 계산 중…',
  'progress.workers': '워커 {n}개',

  'results.title': '결과',
  'results.empty':
    '설정을 확인하고 “시뮬레이션 실행”을 누르세요. 모든 계산은 이 브라우저 안에서 이뤄집니다.',
  'results.stale': '설정이 바뀌었습니다. 아래 결과는 이전 설정 기준입니다.',
  'verdict.heavy': '{Heavy} 승리 확률 {p} (95% CI {lo}–{hi})',
  'verdict.pack': '{Pack} 승리 확률 {p} (95% CI {lo}–{hi})',
  'verdict.draw': '무승부(시간 초과) 확률 {p} (95% CI {lo}–{hi})',
  'verdict.basis': '{heavyTeam} vs {packTeam} · {n}회 시뮬레이션 · 시드 {seed} · 계산 {elapsed}',

  'outcome.heavy': '{Heavy} 승리',
  'outcome.pack': '{Pack} 승리',
  'outcome.draw': '무승부',
  'stat.ci': '95% CI {lo}–{hi}',
  'stat.duration': '전투 시간 (중앙값)',
  'stat.durationSub': '5–95%: {p5} – {p95}',
  'stat.survivors': '{Heavy} 생존 (평균)',
  'stat.ofN': '{n}마리 중',
  'stat.killed': '죽은 {PackPl} (평균)',
  'stat.routed': '도주한 {PackPl} (평균)',
  'stat.exchange': '교환비',
  'stat.exchangeSub': '{heavy} 1마리 손실당 죽은 {packPl}',
  'stat.exchangeInf': '{heavy} 손실 없음',
  'stat.exchangeNone': '사망 없음',

  'chart.outcome': '승패 확률과 95% 신뢰구간',
  'chart.duration': '전투 시간 분포',
  'chart.survivors': '{Heavy} 생존 수 분포',
  'chart.sensitivity': '민감도 (스피어만 상관, 상위 10개)',
  'chart.sensitivityHelp':
    '각 파라미터 값과 “{heavy} 우세도”({heavy} 남은 체력 비율 − 아직 싸우는 {packPl} 비율)의 순위 상관. 양수는 값이 클수록 {heavyPl} 쪽에 유리합니다.',
  'chart.favHeavy': '{heavyPl} 유리 →',
  'chart.favPack': '← {packPl} 유리',
  'chart.runs': '실행 수',
  'chart.seconds': '초',
  'chart.heavyAlive': '생존 {HeavyPl}',
  'chart.binTip': '{range}: {count}회 ({pct})',
  'chart.outcomeTip': '{name}: {p} (95% CI {lo}–{hi})',
  'chart.rhoTip': '{name}: ρ = {rho}',
  'chart.noData': '데이터 없음',

  'replay.title': '전투 재생',
  'replay.loading': '전투를 다시 계산하는 중…',
  'replay.representative': '대표 전투',
  'replay.random': '무작위 전투',
  'replay.repNote': '{heavy} 우세도가 중앙값에 가장 가까운 전투',
  'replay.randomNote': '무작위로 고른 전투',
  'replay.runInfo': '실행 #{run} · {outcome} · {duration}',
  'replay.play': '재생',
  'replay.pause': '일시정지',
  'replay.speed': '속도',
  'replay.zoom': '보기',
  'replay.zoomAuto': '자동 (전투 따라가기)',
  'replay.zoomFit': '경기장 전체',
  'replay.zoom2': '{heavyPl} 중심 2배',
  'replay.zoom4': '{heavyPl} 중심 4배',
  'replay.scrub': '재생 위치',
  'replay.canvasLabel':
    '전투 재생 애니메이션: 삼각형은 {heavyPl}, 무리 동물({packPl})은 상태에 따라 점(접근), 마름모(매달림), 고리(회복), 화살표(도주), ×(사망)로 표시합니다',
  'replay.legendLabel': '재생 범례',
  'replay.legendHeavy': '{Heavy}',
  'replay.legendHp': '다친 {heavy} (채운 면적 = 남은 체력)',
  'replay.legendHeavyDead': '쓰러진 {heavy}',
  'replay.legendPack': '{PackPl}',
  'replay.legendBite': '공격 범위 (명중은 채워 표시, 빠른 재생에서는 윤곽만)',
  'replay.lodNote':
    '멀리서는 {packPl} 개체를 작은 사각형으로 그립니다. 확대하면 상태별 모양이 보입니다.',
  'replay.reducedNote':
    '{time} 이후는 기록 한도를 넘어 저장된 표본 사이를 이어 그립니다. 상태 변화가 늦게 보이거나 빠질 수 있습니다.',
  'replay.failed': '재생을 불러오지 못했습니다: {msg}',
  'replay.prevEvent': '◀ 이전 사건',
  'replay.nextEvent': '다음 사건 ▶',
  'replay.skipContact': '첫 접촉으로',
  'replay.valueText': '{cur} / {total}',
  'replay.scene':
    '{time}: {heavyPl} {total}마리 중 {alive}마리 생존. {PackPl} 상태: 접근 {approach}, 매달림 {latched}, 회복 {recover}, 도주·이탈 {out}, 사망 {dead}',
  'replay.overviewLabel':
    '전투 전체 요약 그림: 선은 이동 경로, 마름모는 {packPl} 개체가 매달린 곳, ×는 {packPl} 개체가 쓰러진 곳, 삼각형은 {heavy}의 마지막 위치입니다',
  'replay.overviewNote':
    '동작 줄이기 설정이 켜져 있어 전투 전체를 한 장으로 보여 줍니다(선: 이동 경로, 마름모: 매달린 곳, ×: 쓰러진 곳). 재생을 누르면 효과 없이 재생합니다.',
  'replay.announceSpeed': '재생 속도 {speed}',
  'replay.announceView': '보기: {view}',
  'replay.noMoreEvents': '그쪽으로는 더 이상 사건이 없습니다',
  'replay.keysTitle': '키보드 단축키',
  'replay.keyPlay': '재생 / 일시정지',
  'replay.keySeek': '1초 뒤로 / 앞으로',
  'replay.keySeekBig': '5초 뒤로 / 앞으로',
  'replay.keyPage': '전체 길이의 10%만큼 앞으로 / 뒤로',
  'replay.keyEnds': '처음 / 끝으로',
  'replay.keySpeed': '느리게 / 빠르게',
  'replay.keyEvent': '이전 / 다음 사건 (접촉, 쓰러짐, 도주) 1초 전으로',
  'replay.keyContact': '첫 접촉 2초 전으로',
  'replay.keyView': '자동 보기와 경기장 전체 보기 전환',
  'replay.legendEvents': '사건',
  'replay.legendLatchRing': '매달림 (좁아지는 고리)',
  'replay.legendOutRing': '도주·사망 (회색 고리)',
  'replay.legendThrow': '떨쳐 냄 (짧은 선 세 개)',
  'replay.legendTrail': '최근 3초 이동 자취',
  'state.approach': '접근',
  'state.latched': '매달림',
  'state.recover': '회복',
  'state.routed': '도주',
  'state.dead': '사망',

  'time.sec': '{s}초',
  'time.minSec': '{m}분 {s}초',
  'time.hourMin': '{h}시간 {m}분',

  'footer.disclaimer':
    '모든 대결은 교육용 모델입니다. 티라노사우루스는 다른 어떤 종과도 같은 시대에 살지 않았고, 야생에서 관찰된 대결도 크게 단순화했으며, 모든 상호작용 규칙은 가정입니다. 결과는 불확실한 입력에 따라 승패가 어떻게 달라지는지 보여 줄 뿐 실제 싸움의 예측이 아니며, 이 사이트는 실제 동물 싸움을 조장하거나 지지하지 않습니다.',
  'footer.linksLabel': '사이트 정보와 링크',
  'footer.about': '소개 · 문의',
  'footer.privacy': '개인정보처리방침',
  'footer.license': '라이선스',
  'footer.source': '소스 코드 (GitHub)',
  'footer.blog': '블로그 (Vinyl’s Log)',
  'footer.linktree': 'Linktree',
  'footer.local': '시뮬레이션은 모두 브라우저에서 실행됩니다.',
  'footer.copyright': '© 2026 VinylStage · MIT 라이선스 오픈 소스',

  'intro.title': '티렉스 대 호랑이 시뮬레이터란?',
  'intro.lead':
    '티라노사우루스 N마리와 호랑이 M마리가 탁 트인 평지에서 맞붙으면 어떻게 될까요? 이 시뮬레이터는 이 질문을 출발점으로 몬테카를로 방법을 직접 체험해 보는 무료 교육용 도구입니다. 코끼리와 사자, 불곰과 늑대처럼 야생에서 관찰된 대결도 고를 수 있습니다. 한 판의 승패 대신, 문헌에 근거한 불확실한 능력치로 전투를 수백 번 반복해 승률과 그 불확실성을 함께 보여 줍니다.',
  'intro.howTitle': '어떻게 작동하나요?',
  'intro.how1': '양쪽 종과 마릿수, 전술, 실행 횟수를 정하고, 원하면 22개 능력치의 범위도 바꿉니다.',
  'intro.how2': '전투마다 체중, 무는 힘, 속도 같은 능력치를 범위 안에서 새로 뽑습니다.',
  'intro.how3':
    '개체마다 단순한 규칙으로 움직이는 에이전트 기반 전투를 브라우저가 여러 번 계산합니다.',
  'intro.how4':
    '결과를 승률과 95% 신뢰구간, 전투 시간 분포, 민감도 차트, 전투 재생으로 정리합니다.',
  'intro.learnTitle': '무엇을 배울 수 있나요?',
  'intro.learn1': '몬테카를로 시뮬레이션: 무작위 실험을 반복해 답을 근사하는 방법',
  'intro.learn2': '신뢰구간: 실행 횟수에 따라 추정이 얼마나 정밀해지는지',
  'intro.learn3': '민감도 분석: 결과가 어떤 가정에 가장 크게 좌우되는지',
  'intro.moreTitle': '더 알아보기',
  'intro.link.guide': '사용 방법과 결과 읽는 법',
  'intro.link.model': '모델 설명과 기본 가정의 예비 결과',
  'intro.link.parameters': '파라미터 범위와 출처',
  'intro.link.tour': '1분 튜토리얼 시작',
  'faq.title': '자주 묻는 질문',
  'faq.q1': '티라노사우루스와 호랑이가 실제로 만난 적이 있나요?',
  'faq.a1':
    '없습니다. 티라노사우루스는 약 6,800만–6,600만 년 전 백악기 말에 살았고, 호랑이는 그보다 훨씬 뒤에 나타났습니다. 이 대결은 방법을 배우기 위한 가상의 시나리오입니다.',
  'faq.q2': '그래서 누가 이기나요?',
  'faq.a2':
    '정해진 답은 없습니다. 승률은 마릿수, 사기, 전술, 능력치 범위 같은 가정에 따라 크게 달라집니다. 기본 가정에서의 예비 결과와 그 해석은 모델 설명 페이지에 있고, 위의 시뮬레이터로 직접 확인할 수도 있습니다.',
  'faq.q3': '몬테카를로 시뮬레이션이란 무엇인가요?',
  'faq.a3':
    '불확실한 값을 무작위로 뽑아 같은 실험을 여러 번 반복하고, 결과의 분포로 답을 추정하는 방법입니다. 실행 횟수가 많을수록 승률의 신뢰구간이 좁아집니다.',
  'faq.q4': '결과를 공유하거나 다시 재현할 수 있나요?',
  'faq.a4':
    '네. 링크 복사를 누르면 종, 마릿수, 파라미터 범위, 시드가 담긴 주소가 만들어집니다. 같은 링크를 열고 실행하면 같은 결과가 나옵니다.',
  'faq.q5': '어떤 동물을 고를 수 있나요?',
  'faq.a5':
    '대형 동물은 티라노사우루스, 아프리카코끼리, 아프리카물소, 불곰이고, 무리 동물은 호랑이, 사자, 회색늑대, 점박이하이에나입니다. 코끼리와 사자, 물소와 사자, 불곰과 늑대처럼 야생에서 관찰된 대결에는 표시가 붙고, 기본값마다 근거 수준(문헌, 유도, 추정, 미검증)을 함께 보여 줍니다. 사람과 가축은 다루지 않습니다.',

  'tour.start': '튜토리얼',
  'tour.counter': '{n} / {total}',
  'tour.back': '이전',
  'tour.next': '다음',
  'tour.skip': '건너뛰기',
  'tour.done': '완료',
  'tour.announce': '{n} / {total}단계: {title}',
  'tour.demo': '빠른 데모 실행 ({n}회)',
  'tour.demoRunning': '데모 실행 중… 끝나면 결과 단계로 넘어갑니다.',
  'tour.demoFailed': '데모가 끝나지 않았습니다. 다시 실행하거나 “다음”으로 계속하세요.',
  'tour.demoHint':
    '지금 {n}회짜리 빠른 데모를 돌리면 다음 단계에서 실제 결과를 함께 살펴볼 수 있습니다.',
  'tour.hasResults': '이미 결과가 있으니 다음 단계에서 바로 살펴봅니다.',
  'tour.guide': '가이드 읽기',
  'tour.offer.title': '처음 오셨나요?',
  'tour.offer.body': '1분 투어로 설정, 실행, 결과 읽는 법을 차례로 알아보세요.',
  'tour.offer.start': '투어 시작',
  'tour.offer.dismiss': '괜찮아요',
  'tour.welcome.title': '시뮬레이터 둘러보기',
  'tour.welcome.body':
    '두 종의 동물이 넓은 들판에서 싸우면 누가 이길까요? 기본은 티라노사우루스 10마리와 호랑이 100마리이고, 야생에서 관찰된 대결도 고를 수 있습니다. 이 시뮬레이터는 문헌에서 가져온 불확실한 능력치를 전투마다 새로 뽑아 수백 번 싸움을 붙이고, 승률과 신뢰구간을 보여줍니다. 모든 계산은 이 브라우저 안에서 이뤄집니다. ← → 키로 이동하고 Esc로 닫을 수 있습니다.',
  'tour.presets.title': '종과 대결 프리셋',
  'tour.presets.body':
    '위쪽 목록에서 대형 동물과 무리 동물을 고르고, 아래 프리셋으로 대결 구도를 한 번에 정할 수 있습니다. 프리셋은 양쪽 종, 마릿수, 실행 횟수를 바꾸고 파라미터 범위를 그 종의 기본값으로 되돌립니다. 배지는 야생에서 관찰된 대결인지, 서로 만난 적 없는 종인지 알려 줍니다.',
  'tour.counts.title': '마릿수',
  'tour.counts.body':
    '양쪽 마릿수를 직접 정합니다. 마릿수가 많을수록 전투 한 번을 계산하는 시간이 길어지며, 무거운 설정이면 아래에 예상 시간 경고가 나타납니다.',
  'tour.runs.title': '실행 횟수와 시드',
  'tour.runs.body':
    '정한 횟수만큼 전투를 반복합니다. 횟수가 많을수록 승률의 95% 신뢰구간이 좁아집니다. 시드가 같으면 결과가 똑같이 재현되므로, 링크를 공유하면 다른 사람도 같은 숫자를 봅니다.',
  'tour.advanced.title': '고급: 파라미터 범위',
  'tour.advanced.body':
    '체중, 무는 힘, 속도 같은 능력치는 값 하나가 아니라 최소 · 최빈 · 최대로 정한 삼각분포에서 실행마다 새로 뽑습니다. 범위를 바꿔 가정이 결과를 어떻게 움직이는지 확인해 보세요. 바꾼 줄에는 점(•)이 붙고 ↺로 되돌릴 수 있습니다.',
  'tour.run.title': '실행',
  'tour.run.body':
    '“시뮬레이션 실행”을 누르면 CPU 코어마다 워커 하나씩 일을 나눠 계산합니다. 진행률과 남은 시간이 표시되고 언제든 취소할 수 있습니다.',
  'tour.results.title': '결과',
  'tour.results.body':
    '실행이 끝나면 이곳에 판정, 요약 카드, 차트(승패 확률, 전투 시간, 생존 수, 민감도)와 전투 재생이 나타납니다. 투어를 마친 뒤 실행해 보세요.',
  'tour.verdict.title': '판정과 요약 카드',
  'tour.verdict.body':
    '가장 가능성이 높은 결과와 그 확률, 95% 신뢰구간(Wilson)입니다. 카드에는 결과별 확률, 전투 시간 중앙값, 평균 생존 · 사망 · 도주 수, 교환비가 있습니다.',
  'tour.outcome.title': '승패 확률 차트',
  'tour.outcome.body':
    '막대는 결과별 확률, 가는 선은 95% 신뢰구간입니다. 마우스를 올리거나 탭하면 정확한 값이 나옵니다. 아래 히스토그램은 전투 시간과 {heavy} 생존 수의 분포입니다.',
  'tour.sensitivity.title': '민감도',
  'tour.sensitivity.body':
    '어떤 가정이 승패를 가장 크게 좌우하는지 보여줍니다. 오른쪽(양수) 막대는 값이 클수록 {heavyPl} 쪽에, 왼쪽(음수)은 {packPl} 쪽에 유리하다는 뜻입니다. 긴 막대의 범위를 고급 설정에서 바꿔 보세요.',
  'tour.replay.title': '전투 재생',
  'tour.replay.body':
    '대표 전투({heavy} 우세도가 중앙값에 가장 가까운 전투)나 무작위 전투를 다시 계산해 애니메이션으로 보여줍니다. 재생 · 일시정지, 속도, 보기 배율, 재생 위치를 조절할 수 있습니다.',
  'tour.share.title': '링크 공유',
  'tour.share.body':
    '시드를 포함한 현재 설정 전체가 주소에 담깁니다. 링크를 보내면 받는 사람도 같은 시나리오와 같은 결과를 봅니다. 서버에는 아무것도 저장되지 않습니다.',
  'tour.header.title': '언어와 튜토리얼',
  'tour.header.body':
    '한국어와 English를 전환합니다. 이 투어는 “튜토리얼” 버튼으로 언제든 다시 볼 수 있습니다.',
  'tour.finish.title': '준비 완료',
  'tour.finish.body':
    '이제 시나리오를 바꿔 직접 실행해 보세요. 모델의 가정과 각 파라미터의 의미 · 출처는 가이드에서 자세히 설명합니다.',

  'param.heavy.mass': '체중',
  'param.heavy.speed': '이동 속도',
  'param.heavy.turnRate': '선회 속도',
  'param.heavy.biteForce': '무는 힘',
  'param.heavy.biteLethality': '물기 치명도',
  'param.heavy.biteInterval': '물기 간격',
  'param.heavy.biteReach': '물기 사거리',
  'param.heavy.biteArc': '물기 각도 (반각)',
  'param.heavy.biteAccuracy': '물기 명중률',
  'param.heavy.shakeRate': '떨쳐내기 빈도',
  'param.heavy.bodyRadius': '몸 반경',
  'param.pack.mass': '체중',
  'param.pack.sprintSpeed': '질주 속도',
  'param.pack.cruiseSpeed': '순항 속도',
  'param.pack.sprintEndurance': '질주 지구력',
  'param.pack.latchEndurance': '매달리기 지구력',
  'param.pack.recoveryTime': '회복 시간',
  'param.pack.latchChance': '매달리기 성공률',
  'param.pack.dps': '초당 피해',
  'param.pack.bleed': '출혈률',
  'param.pack.morale': '초기 사기',
  'param.pack.moraleLoss': '사기 손실',
  'param.weapon.tusk': '엄니 · 밟기 힘',
  'param.weapon.horn': '뿔 들이받기 힘',
  'param.weapon.pawBite': '물기 · 앞발 힘',
  'param.attack.biteLethality': '공격 치명도',
  'param.attack.biteInterval': '공격 간격',
  'param.attack.biteReach': '공격 사거리',
  'param.attack.biteArc': '공격 각도 (반각)',
  'param.attack.biteAccuracy': '공격 명중률',

  'paramHelp.heavy.mass': '체력(HP)과 같습니다. 매달린 {packPl} 무게에 따른 감속에도 쓰입니다.',
  'paramHelp.heavy.speed': '추격 속도. 매달린 {packPl} 무게가 무거울수록 느려집니다.',
  'paramHelp.heavy.turnRate': '몸과 머리를 돌릴 수 있는 최대 각속도.',
  'paramHelp.heavy.biteForce': '한 번 공격할 때 피해 = 공격 힘 × 치명도 × (0.7–1.3).',
  'paramHelp.heavy.biteLethality': '공격 힘 1 kN당 피해(HP). 개체 변동 없음.',
  'paramHelp.heavy.biteInterval': '공격 시도 사이의 재정비 시간.',
  'paramHelp.heavy.biteReach': '몸 중심에서 공격이 닿는 거리.',
  'paramHelp.heavy.biteArc': '정면 기준 좌우로 공격할 수 있는 각도.',
  'paramHelp.heavy.biteAccuracy': '공격 성공 확률. 매달린 {pack} 개체에겐 1.5배 (최대 0.95).',
  'paramHelp.heavy.shakeRate':
    '매달린 {pack} 개체를 초당 떨쳐낼 확률. 떨어진 개체는 최대 체력의 10% 피해.',
  'paramHelp.heavy.bodyRadius': '{pack} 개체가 달라붙는 접촉 거리를 정합니다. 개체 변동 없음.',
  'paramHelp.pack.mass':
    '체력(HP)과 같습니다. 매달린 {pack} 개체는 이 무게만큼 {heavy} 개체를 느리게 합니다.',
  'paramHelp.pack.sprintSpeed': '목표 60 m 이내에서 질주하며 스태미나를 소모합니다.',
  'paramHelp.pack.cruiseSpeed': '먼 거리 이동 · 후퇴 속도.',
  'paramHelp.pack.sprintEndurance': '스태미나가 바닥날 때까지 질주할 수 있는 시간.',
  'paramHelp.pack.latchEndurance': '물고 매달려 있을 수 있는 최대 시간.',
  'paramHelp.pack.recoveryTime': '스태미나를 0에서 가득 채우는 데 걸리는 시간.',
  'paramHelp.pack.latchChance': '접촉했을 때 물고 매달리기에 성공할 확률 (실패 시 1초 후 재시도).',
  'paramHelp.pack.dps':
    '매달려 있는 동안 {heavy} 개체에게 주는 초당 피해. {heavy} 쪽 가죽 배율이 곱해집니다.',
  'paramHelp.pack.bleed':
    '{heavy} 개체가 매초 (누적 상처 피해 × 출혈률)만큼 체력을 잃습니다. 개체 변동 없음.',
  'paramHelp.pack.morale': '0.2 아래로 떨어지면 도주합니다 (사기 모델 사용 시).',
  'paramHelp.pack.moraleLoss': '40 m 이내의 동료가 죽을 때마다 잃는 사기.',
} as const;

export type MsgKey = keyof typeof ko;
export type Dictionary = Record<MsgKey, string>;

const en: Dictionary = {
  'app.title': 'T-Rex vs Tiger Simulator',
  'app.shortTitle': 'T-Rex vs Tiger',
  'app.tagline':
    'Tyrannosaurus rex vs tigers · learn the Monte Carlo method with an educational simulation',
  'app.documentTitle': 'T-Rex vs Tiger Simulator – who wins, T. rex or tigers?',
  'lang.switch': '한국어',
  'lang.switchAria': '인터페이스를 한국어로 바꾸기',
  'share.copy': 'Copy settings link',
  'share.hint': 'Share the current settings as a URL. The seed is included, so results reproduce.',
  'share.copied': 'Link copied.',
  'share.failed': 'Could not copy. Copy the URL from the address bar instead.',

  'nav.label': 'Site',
  'breadcrumb.label': 'Breadcrumb',
  'nav.simulator': 'Simulator',
  'nav.guide': 'Guide',
  'nav.model': 'Model',
  'nav.parameters': 'Parameters',
  'nav.about': 'About',
  'nav.privacy': 'Privacy',
  'nav.license': 'License',
  'version.badgeTitle': 'Version info and update check',
  'version.status.checking': 'Checking',
  'version.status.latest': 'Latest',
  'version.status.newer': 'New version',
  'version.status.rebuild': 'New build',
  'version.status.changed': 'Changed',
  'version.status.error': "Can't check",
  'version.dialogTitle': 'Version',
  'version.current': 'Current version',
  'version.builtAt': 'Built',
  'version.deployed': 'Latest deployed',
  'version.checkedAt': 'Last checked',
  'version.unknown': 'unknown',
  'version.msg.checking': 'Checking the latest deployed version…',
  'version.msg.latest': 'You are on the latest version.',
  'version.msg.newer': 'A new version has been deployed. Load it with the button below.',
  'version.msg.rebuild':
    'New changes have been deployed under the same version. Load them with the button below.',
  'version.msg.changed':
    'The deployed version differs from this page. Load it with the button below.',
  'version.msg.error':
    'Could not fetch the deployment info. Check your connection, then press “Check again”.',
  'version.recheck': 'Check again',
  'version.releaseNotes': 'Release notes (GitHub)',
  'version.reload': 'Load the latest version (clear cache & storage)',
  'version.confirmTitle': 'Clear cache and storage?',
  'version.confirmBody':
    'This clears the cache and data this site keeps in your browser, then loads the latest version. The record that you dismissed or finished the tutorial is reset. The current scenario and language live in the URL, so they are kept.',
  'version.confirm': 'Clear and reload',
  'version.cancel': 'Cancel',
  'version.resetting': 'Clearing…',
  'version.close': 'Close',
  'version.banner': 'A new version has been deployed: {label}',
  'version.bannerAction': 'Update',
  'version.bannerDismiss': 'Later',
  'version.bannerRegion': 'Update notice',
  'version.updated': 'Loaded the latest version (v{version}).',
  'version.footer': 'Version',
  'version.footerTitle': 'View release notes',

  'config.title': 'Scenario',
  'config.presets': 'Matchup presets',
  'preset.default': '{label} (default)',
  'preset.hint':
    'Sets both species, the head counts and the number of runs, and resets the ranges to those species’ presets. Other settings are kept.',
  'team.one': '{n} {name}',
  'team.other': '{n} {name}',

  'field.heavyCount': '{Heavy} count',
  'field.packCount': '{Pack} count',
  'field.runs': 'Monte Carlo runs',
  'field.seed': 'Seed',
  'field.arenaSize': 'Arena side (m)',
  'field.maxTime': 'Time limit (s)',
  'field.sampling': 'Sampling',
  'field.individualCV': 'Individual variation (CV)',
  'field.packTactic': 'Pack tactic',
  'field.heavySpecies': 'Large animal',
  'field.packSpecies': 'Pack animal',
  'help.heavySpecies':
    'The large animals that fight alone. Changing it resets this side’s ranges to the species’ presets.',
  'help.packSpecies':
    'The animals that attack in numbers. Changing it resets this side’s ranges to the species’ presets.',
  'species.group.extant': 'Living species',
  'species.group.extinct': 'Extinct species',
  'matchup.label': 'Match-up type',
  'matchup.documented': 'Documented in the wild',
  'matchup.neverMet': 'These species never met',
  'matchup.undocumented': 'No recorded encounters',
  'matchup.sources': 'Sources',
  'toast.rangesReset': 'Ranges reset to the {name} presets.',
  'toast.presetApplied': 'Applied the {label} preset.',
  'toast.undo': 'Undo',
  'toast.restored': 'Previous settings restored.',
  'toast.dismiss': 'Dismiss',
  'field.morale': 'Morale & routing',
  'help.heavyCount': 'Number of adult {heavyPl}.',
  'help.packCount': 'Number of adult {packPl}.',
  'help.runs': 'More runs give narrower confidence intervals.',
  'help.seed': 'The same seed and settings reproduce the results exactly.',
  'help.arenaSize': 'Square arena. Routed {packPl} that cross the edge leave the fight.',
  'help.maxTime': 'If neither side has won by then, the battle is a draw.',
  'help.sampling': 'LHS covers the parameter space more evenly for the same number of runs.',
  'help.individualCV':
    "Within a run, each animal's traits are multiplied by N(1, CV), truncated to 0.5–1.5.",
  'help.packTactic':
    'Flank: avoid the frontal attack cone and close in from the side or rear. Direct: charge straight at the nearest {heavy}.',
  'help.morale': 'When off, {packPl} never rout because of low morale.',
  'seed.randomize': 'Random',
  'seed.randomizeAria': 'Generate a random seed',
  'sampling.lhs': 'LHS (Latin hypercube)',
  'sampling.random': 'Simple random',
  'tactic.flank': 'Flank',
  'tactic.direct': 'Direct charge',
  'morale.on': 'Model morale loss and routing',

  'advanced.title': 'Advanced: model parameter ranges',
  'advanced.intro':
    'Each parameter is sampled per run from a triangular (min · mode · max) distribution. The defaults are the selected species’ presets; the letter next to each name shows its evidence (L literature, D derived from literature, S speculative, U unverified). Sources are on the parameter reference page and in docs/SPECIES.md.',
  'advanced.param': 'Parameter',
  'advanced.min': 'Min',
  'advanced.mode': 'Mode',
  'advanced.max': 'Max',
  'advanced.unit': 'Unit',
  'advanced.reset': 'Preset',
  'advanced.resetRowAria': 'Reset {name} to the species preset',
  'advanced.resetAll': 'Reset all to species presets',
  'advanced.modified': '{n} modified',
  'advanced.inputAria': '{name} {which}',
  'species.trex': 'Tyrannosaurus rex',
  'species.elephant': 'African bush elephant',
  'species.buffalo': 'African buffalo',
  'species.brownBear': 'Brown bear',
  'species.tiger': 'Tiger',
  'species.lion': 'Lion',
  'species.wolf': 'Gray wolf',
  'species.hyena': 'Spotted hyena',
  'species.trex.one': 'T-Rex',
  'species.trex.other': 'T-Rex',
  'species.elephant.one': 'elephant',
  'species.elephant.other': 'elephants',
  'species.buffalo.one': 'buffalo',
  'species.buffalo.other': 'buffalo',
  'species.brownBear.one': 'brown bear',
  'species.brownBear.other': 'brown bears',
  'species.tiger.one': 'tiger',
  'species.tiger.other': 'tigers',
  'species.lion.one': 'lion',
  'species.lion.other': 'lions',
  'species.wolf.one': 'wolf',
  'species.wolf.other': 'wolves',
  'species.hyena.one': 'hyena',
  'species.hyena.other': 'hyenas',
  'evidence.L': 'Literature value',
  'evidence.D': 'Derived from literature',
  'evidence.S': 'Speculative',
  'evidence.U': 'Unverified popular figure',
  'evidence.aria': 'Evidence: {tag}',

  'cost.capped': 'Runs will be reduced to {n} to stay within the work budget.',
  'cost.heavy':
    'Heavy scenario (roughly {eta}). It may take longer on your device; consider fewer runs.',
  'cost.extreme':
    'Very heavy scenario (roughly {eta}). Your browser may become sluggish while it runs.',

  'run.start': 'Run simulation',
  'run.cancel': 'Cancel',
  'run.cancelled': 'Cancelled.',
  'run.error': 'Error: {msg}',
  'run.aggregating': 'Aggregating…',
  'progress.label': 'Progress',
  'progress.text': '{done} / {total} runs ({pct})',
  'progress.eta': 'about {eta} left',
  'progress.etaPending': 'estimating time left…',
  'progress.workers': '{n} workers',

  'results.title': 'Results',
  'results.empty':
    'Review the settings and press “Run simulation”. Everything is computed inside this browser.',
  'results.stale': 'Settings changed — the results below are for the previous settings.',
  'verdict.heavy': '{Heavy} win probability {p} (95% CI {lo}–{hi})',
  'verdict.pack': '{Pack} win probability {p} (95% CI {lo}–{hi})',
  'verdict.draw': 'Draw (time limit) probability {p} (95% CI {lo}–{hi})',
  'verdict.basis': '{heavyTeam} vs {packTeam} · {n} runs · seed {seed} · computed in {elapsed}',

  'outcome.heavy': '{Heavy} victory',
  'outcome.pack': '{Pack} victory',
  'outcome.draw': 'Draw',
  'stat.ci': '95% CI {lo}–{hi}',
  'stat.duration': 'Battle duration (median)',
  'stat.durationSub': '5–95%: {p5} – {p95}',
  'stat.survivors': '{Heavy} survivors (mean)',
  'stat.ofN': 'of {n}',
  'stat.killed': '{PackPl} killed (mean)',
  'stat.routed': '{PackPl} routed (mean)',
  'stat.exchange': 'Exchange ratio',
  'stat.exchangeSub': '{packPl} killed per {heavy} lost',
  'stat.exchangeInf': 'no {heavy} lost',
  'stat.exchangeNone': 'no deaths',

  'chart.outcome': 'Outcome probability with 95% CI',
  'chart.duration': 'Battle duration distribution',
  'chart.survivors': '{Heavy} survivors distribution',
  'chart.sensitivity': 'Sensitivity (Spearman correlation, top 10)',
  'chart.sensitivityHelp':
    'Rank correlation between each parameter and the “{heavy} advantage” ({heavy} HP fraction left − fraction of {packPl} still fighting). Positive: higher values favour the {heavyPl}.',
  'chart.favHeavy': 'favours {heavyPl} →',
  'chart.favPack': '← favours {packPl}',
  'chart.runs': 'runs',
  'chart.seconds': 's',
  'chart.heavyAlive': '{HeavyPl} alive',
  'chart.binTip': '{range}: {count} runs ({pct})',
  'chart.outcomeTip': '{name}: {p} (95% CI {lo}–{hi})',
  'chart.rhoTip': '{name}: ρ = {rho}',
  'chart.noData': 'No data',

  'replay.title': 'Battle replay',
  'replay.loading': 'Re-simulating the battle…',
  'replay.representative': 'Representative battle',
  'replay.random': 'Random battle',
  'replay.repNote': 'the battle closest to the median {heavy} advantage',
  'replay.randomNote': 'a randomly picked battle',
  'replay.runInfo': 'Run #{run} · {outcome} · {duration}',
  'replay.play': 'Play',
  'replay.pause': 'Pause',
  'replay.speed': 'Speed',
  'replay.zoom': 'View',
  'replay.zoomAuto': 'Auto (follow the fight)',
  'replay.zoomFit': 'Whole arena',
  'replay.zoom2': '2× on {heavyPl}',
  'replay.zoom4': '4× on {heavyPl}',
  'replay.scrub': 'Playback position',
  'replay.canvasLabel':
    'Battle replay animation: triangles are {heavyPl}; {packPl} are dots (approaching), diamonds (latched), rings (recovering), arrows (routed) or crosses (dead)',
  'replay.legendLabel': 'Replay legend',
  'replay.legendHeavy': '{Heavy}',
  'replay.legendHp': 'Wounded {heavy} (filled area = HP left)',
  'replay.legendHeavyDead': 'Dead {heavy}',
  'replay.legendPack': '{PackPl}',
  'replay.legendBite': 'Attack reach (filled on a hit; outline only at high speed)',
  'replay.lodNote': 'Zoomed out, {packPl} are small squares. Zoom in to see their shapes.',
  'replay.reducedNote':
    'After {time} the event log was full, so the replay joins stored samples: state changes may show late or not at all.',
  'replay.failed': 'Could not load the replay: {msg}',
  'replay.prevEvent': '◀ Previous event',
  'replay.nextEvent': 'Next event ▶',
  'replay.skipContact': 'Skip to contact',
  'replay.valueText': '{cur} of {total}',
  'replay.scene':
    '{time}: {alive} of {total} {heavyPl} alive. {PackPl}: {approach} approaching, {latched} latched, {recover} recovering, {out} fled or gone, {dead} dead',
  'replay.overviewLabel':
    'Summary of the whole battle: lines are paths, diamonds mark where {packPl} latched, crosses where {packPl} died, triangles the final {heavy} positions',
  'replay.overviewNote':
    'Reduced motion is on, so the whole battle is shown in one picture (lines: paths, diamonds: latches, crosses: deaths). Press Play to animate it without effects.',
  'replay.announceSpeed': 'Playback speed {speed}',
  'replay.announceView': 'View: {view}',
  'replay.noMoreEvents': 'No more events in that direction',
  'replay.keysTitle': 'Keyboard shortcuts',
  'replay.keyPlay': 'Play / pause',
  'replay.keySeek': 'Back / forward 1 s',
  'replay.keySeekBig': 'Back / forward 5 s',
  'replay.keyPage': 'Forward / back by 10 % of the battle',
  'replay.keyEnds': 'Start / end',
  'replay.keySpeed': 'Slower / faster',
  'replay.keyEvent': 'Previous / next event (contact, kill, rout), 1 s before it',
  'replay.keyContact': '2 s before the first contact',
  'replay.keyView': 'Switch between the auto view and the whole arena',
  'replay.legendEvents': 'Events',
  'replay.legendLatchRing': 'Latch (shrinking ring)',
  'replay.legendOutRing': 'Rout or death (grey ring)',
  'replay.legendThrow': 'Thrown off (three short rays)',
  'replay.legendTrail': 'Path over the last 3 s',
  'state.approach': 'Approaching',
  'state.latched': 'Latched',
  'state.recover': 'Recovering',
  'state.routed': 'Routed',
  'state.dead': 'Dead',

  'time.sec': '{s} s',
  'time.minSec': '{m} min {s} s',
  'time.hourMin': '{h} h {m} min',

  'footer.disclaimer':
    'Every match-up is an educational model. T. rex never lived alongside any of the other species, match-ups seen in the wild are heavily simplified, and every interaction rule is an assumption. The model shows how the outcome depends on uncertain inputs; it does not predict a real fight, and this site does not promote or endorse real animal fighting.',
  'footer.linksLabel': 'Site information and links',
  'footer.about': 'About & contact',
  'footer.privacy': 'Privacy',
  'footer.license': 'License',
  'footer.source': 'Source code (GitHub)',
  'footer.blog': 'Blog (Vinyl’s Log)',
  'footer.linktree': 'Linktree',
  'footer.local': 'Simulations run in your browser.',
  'footer.copyright': '© 2026 VinylStage · Open source under the MIT License',

  'intro.title': 'What is the T-Rex vs Tiger Simulator?',
  'intro.lead':
    'What happens if N Tyrannosaurus rex meet M tigers on an open field? This free educational tool uses that question to let you try the Monte Carlo method yourself, and it also offers match-ups observed in the wild, such as elephants and lions or brown bears and wolves. Instead of a single fight, it repeats the battle hundreds of times with uncertain, literature-based traits and shows the win probabilities together with their uncertainty.',
  'intro.howTitle': 'How does it work?',
  'intro.how1':
    'Choose the species and head counts on both sides, the pack tactic and the number of runs, and optionally edit the ranges of the 22 traits.',
  'intro.how2':
    'Every battle draws fresh traits, such as body mass, bite force and speed, from those ranges.',
  'intro.how3':
    'Your browser computes many agent-based battles, in which each animal follows simple rules.',
  'intro.how4':
    'The results show win probabilities with 95% confidence intervals, battle durations, a sensitivity chart and a replay.',
  'intro.learnTitle': 'What can you learn?',
  'intro.learn1': 'Monte Carlo simulation: approximating an answer by repeating random experiments',
  'intro.learn2': 'Confidence intervals: how the estimate sharpens as the number of runs grows',
  'intro.learn3': 'Sensitivity analysis: which assumptions the outcome depends on most',
  'intro.moreTitle': 'Learn more',
  'intro.link.guide': 'How to use it and read the results',
  'intro.link.model': 'The model and its preliminary results',
  'intro.link.parameters': 'Parameter ranges and sources',
  'intro.link.tour': 'Take the one-minute tour',
  'faq.title': 'Frequently asked questions',
  'faq.q1': 'Did Tyrannosaurus rex and tigers ever meet?',
  'faq.a1':
    'No. Tyrannosaurus rex lived at the end of the Cretaceous, about 68 to 66 million years ago, and tigers appeared much later. The match-up is a hypothetical scenario for learning the method.',
  'faq.q2': 'So who wins?',
  'faq.a2':
    'There is no fixed answer. The win probability depends strongly on assumptions such as head counts, morale, tactics and trait ranges. Preliminary results for the default assumptions, and how to read them, are on the model page, and you can check them yourself with the simulator above.',
  'faq.q3': 'What is a Monte Carlo simulation?',
  'faq.a3':
    'It repeats the same experiment many times with uncertain values drawn at random and estimates the answer from the spread of the results. The more runs, the narrower the confidence interval of the win probability.',
  'faq.q4': 'Can I share or reproduce a result?',
  'faq.a4':
    'Yes. Copy link creates an address that holds the species, head counts, parameter ranges and seed. Opening that link and running it gives the same result.',
  'faq.q5': 'Which animals can I choose?',
  'faq.a5':
    'The large animals are Tyrannosaurus rex, the African bush elephant, the African buffalo and the brown bear; the pack animals are the tiger, the lion, the gray wolf and the spotted hyena. Match-ups observed in the wild, such as elephants and lions, buffalo and lions or brown bears and wolves, are marked, and every preset value shows its evidence level (literature, derived, speculative or unverified). Humans and domestic animals are not included.',

  'tour.start': 'Tutorial',
  'tour.counter': '{n} / {total}',
  'tour.back': 'Back',
  'tour.next': 'Next',
  'tour.skip': 'Skip',
  'tour.done': 'Done',
  'tour.announce': 'Step {n} of {total}: {title}',
  'tour.demo': 'Run a quick demo ({n} runs)',
  'tour.demoRunning': 'Running the demo… the tour moves on to the results when it finishes.',
  'tour.demoFailed': 'The demo did not finish. Run it again, or press Next to continue.',
  'tour.demoHint':
    'Run a quick {n}-run demo now and the next steps will walk through real results.',
  'tour.hasResults': 'You already have results, so the next steps use them.',
  'tour.guide': 'Read the guide',
  'tour.offer.title': 'New here?',
  'tour.offer.body': 'Take a one-minute tour of the settings, the run and how to read the results.',
  'tour.offer.start': 'Start the tour',
  'tour.offer.dismiss': 'No thanks',
  'tour.welcome.title': 'Welcome to the simulator',
  'tour.welcome.body':
    'Who wins when two species meet on an open field? The default is 10 Tyrannosaurus rex against 100 tigers, and match-ups observed in the wild are available too. The simulator draws uncertain, literature-based traits afresh for every battle, fights hundreds of battles and reports win probabilities with confidence intervals. Everything runs in this browser. Use the ← → keys to move and Esc to close.',
  'tour.presets.title': 'Species and matchup presets',
  'tour.presets.body':
    'Choose the large animal and the pack animal from the lists at the top, or set a whole match-up with a preset. A preset sets both species, the head counts and the number of runs, and resets the ranges to those species’ presets. The badge tells you whether the match-up has been seen in the wild or the species never met.',
  'tour.counts.title': 'Head counts',
  'tour.counts.body':
    'Set how many animals fight on each side. Bigger battles take longer to compute; when a setting is heavy, a warning with the estimated time appears below.',
  'tour.runs.title': 'Runs and seed',
  'tour.runs.body':
    'The battle is repeated this many times. More runs give a narrower 95% confidence interval for each win probability. The same seed reproduces exactly the same results, so a shared link shows others the same numbers.',
  'tour.advanced.title': 'Advanced: parameter ranges',
  'tour.advanced.body':
    'Traits such as body mass, bite force and speed are not single numbers: every run draws them from a triangular distribution set by min · mode · max. Change a range to see how an assumption moves the result. Changed rows get a dot (•), and ↺ resets them.',
  'tour.run.title': 'Run',
  'tour.run.body':
    'Run simulation splits the work across one Web Worker per CPU core. Progress and the time left are shown, and you can cancel at any time.',
  'tour.results.title': 'Results',
  'tour.results.body':
    'When a run finishes, this panel shows the verdict, summary cards, charts (outcome, battle duration, survivors, sensitivity) and an animated battle replay. Run a simulation after the tour to see them.',
  'tour.verdict.title': 'Verdict and summary cards',
  'tour.verdict.body':
    'The most likely outcome with its probability and 95% (Wilson) confidence interval. The cards add the probability of each outcome, the median battle duration, mean survivors, kills and routs, and the exchange ratio.',
  'tour.outcome.title': 'Outcome chart',
  'tour.outcome.body':
    'Bars show the probability of each outcome and the thin lines its 95% confidence interval. Hover or tap for exact values. The histograms below show the distribution of battle duration and {heavy} survivors.',
  'tour.sensitivity.title': 'Sensitivity',
  'tour.sensitivity.body':
    'Shows which assumptions drive the outcome most. A bar to the right (positive) means larger values favour the {heavyPl}; to the left, the {packPl}. Try changing the range of a long bar under Advanced.',
  'tour.replay.title': 'Battle replay',
  'tour.replay.body':
    'Re-simulates the representative battle (closest to the median {heavy} advantage) or a random one and animates it. Use play/pause, speed, view zoom and the position slider.',
  'tour.share.title': 'Share a link',
  'tour.share.body':
    'All current settings, including the seed, live in the page address. Send the link and the recipient sees the same scenario and the same results. Nothing is stored on a server.',
  'tour.header.title': 'Language and tutorial',
  'tour.header.body':
    'Switch between Korean and English. Replay this tour any time with the Tutorial button.',
  'tour.finish.title': "You're all set",
  'tour.finish.body':
    "Now change the scenario and run it yourself. The guide explains the model's assumptions and what every parameter means, with sources.",

  'param.heavy.mass': 'Body mass',
  'param.heavy.speed': 'Speed',
  'param.heavy.turnRate': 'Turn rate',
  'param.heavy.biteForce': 'Bite force',
  'param.heavy.biteLethality': 'Bite lethality',
  'param.heavy.biteInterval': 'Bite interval',
  'param.heavy.biteReach': 'Bite reach',
  'param.heavy.biteArc': 'Bite arc (half-angle)',
  'param.heavy.biteAccuracy': 'Bite accuracy',
  'param.heavy.shakeRate': 'Shake-off rate',
  'param.heavy.bodyRadius': 'Body radius',
  'param.pack.mass': 'Body mass',
  'param.pack.sprintSpeed': 'Sprint speed',
  'param.pack.cruiseSpeed': 'Cruise speed',
  'param.pack.sprintEndurance': 'Sprint endurance',
  'param.pack.latchEndurance': 'Latch endurance',
  'param.pack.recoveryTime': 'Recovery time',
  'param.pack.latchChance': 'Latch chance',
  'param.pack.dps': 'Damage per second',
  'param.pack.bleed': 'Bleed rate',
  'param.pack.morale': 'Initial morale',
  'param.pack.moraleLoss': 'Morale loss',
  'param.weapon.tusk': 'Tusk and trample force',
  'param.weapon.horn': 'Horn force',
  'param.weapon.pawBite': 'Bite and paw force',
  'param.attack.biteLethality': 'Attack lethality',
  'param.attack.biteInterval': 'Attack interval',
  'param.attack.biteReach': 'Attack reach',
  'param.attack.biteArc': 'Attack arc (half-angle)',
  'param.attack.biteAccuracy': 'Attack accuracy',

  'paramHelp.heavy.mass':
    'Equals hit points (HP). Also sets how much latched {packPl} slow it down.',
  'paramHelp.heavy.speed': 'Chasing speed; reduced by the weight of latched {packPl}.',
  'paramHelp.heavy.turnRate': 'Maximum rate at which it can turn its body and head.',
  'paramHelp.heavy.biteForce': 'Damage per hit = force × lethality × (0.7–1.3).',
  'paramHelp.heavy.biteLethality': 'HP of damage per kN of force. No individual variation.',
  'paramHelp.heavy.biteInterval': 'Recovery time between attacks.',
  'paramHelp.heavy.biteReach': 'Distance from the body centre it can strike.',
  'paramHelp.heavy.biteArc': 'Angle either side of straight ahead in which it can strike.',
  'paramHelp.heavy.biteAccuracy':
    'Chance an attack connects; ×1.5 against a latched {pack} (max 0.95).',
  'paramHelp.heavy.shakeRate':
    'Per-second chance of throwing off a latched {pack}, which takes 10% of its max HP as damage.',
  'paramHelp.heavy.bodyRadius':
    'Sets the contact distance for a latching {pack}. No individual variation.',
  'paramHelp.pack.mass':
    'Equals hit points (HP). A latched {pack} slows the {heavy} by its weight.',
  'paramHelp.pack.sprintSpeed': 'Used within 60 m of the target; drains stamina.',
  'paramHelp.pack.cruiseSpeed': 'Speed when far away or falling back.',
  'paramHelp.pack.sprintEndurance': 'Seconds of sprinting before stamina runs out.',
  'paramHelp.pack.latchEndurance': 'How long it can hang on before tiring.',
  'paramHelp.pack.recoveryTime': 'Time to refill stamina from empty to full.',
  'paramHelp.pack.latchChance': 'Chance to latch on when in contact (retry after 1 s on failure).',
  'paramHelp.pack.dps':
    'Damage dealt to the {heavy} per second while latched, times the {heavy}’s hide multiplier.',
  'paramHelp.pack.bleed':
    'The {heavy} loses (accumulated wound damage × rate) HP every second. No individual variation.',
  'paramHelp.pack.morale': 'Routs when morale drops below 0.2 (morale model on).',
  'paramHelp.pack.moraleLoss': 'Morale lost whenever a packmate within 40 m is killed.',
};

export const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { ko, en };

export type Vars = Readonly<Record<string, string | number>>;

/** Replace `{name}` placeholders; unknown placeholders are left as-is. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}

let current: Lang = DEFAULT_LANG;
const listeners = new Set<(lang: Lang) => void>();

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function getLang(): Lang {
  return current;
}

/** The species pair whose names fill `{heavy}`, `{Pack}`, … in messages (see `speciesVars`). */
export interface NamePair {
  heavySpecies: HeavySpeciesId;
  packSpecies: PackSpeciesId;
}

let names: NamePair = { heavySpecies: DEFAULT_HEAVY, packSpecies: DEFAULT_PACK };

/**
 * Set the species named by messages that do not pass their own names: the results, charts and
 * replay of the shown run. The form passes its own (`speciesVars`).
 */
export function setNamePair(pair: NamePair): void {
  names = { heavySpecies: pair.heavySpecies, packSpecies: pair.packSpecies };
}

export function getNamePair(): NamePair {
  return { ...names };
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Short species name, singular (`one`) or plural (`other`), in the current language. */
export function speciesShort(
  id: SpeciesId,
  form: 'one' | 'other' = 'one',
  lang: Lang = current,
): string {
  return DICTIONARIES[lang][`species.${id}.${form}`];
}

/** Full species name (pickers, table headings). */
export function speciesName(id: SpeciesId): string {
  return DICTIONARIES[current][`species.${id}`];
}

/**
 * Name placeholders for a species pair: `{heavy}` short singular, `{heavyPl}` plural, and
 * capitalised `{Heavy}`/`{HeavyPl}` (the same for `pack`). Korean has no plural or case, so all
 * four are the same there; messages therefore never put a particle after a name.
 */
export function speciesVars(pair: NamePair = names, lang: Lang = current): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, id] of [
    ['heavy', pair.heavySpecies],
    ['pack', pair.packSpecies],
  ] as const) {
    const one = speciesShort(id, 'one', lang);
    const other = speciesShort(id, 'other', lang);
    const Role = capitalize(role);
    out[role] = one;
    out[`${role}Pl`] = other;
    out[Role] = capitalize(one);
    out[`${Role}Pl`] = capitalize(other);
  }
  return out;
}

/** "10 T-Rex" / "T-Rex 10마리": a head count with the right plural form. */
export function teamLabel(id: SpeciesId, n: number): string {
  const rule = new Intl.PluralRules(locale()).select(n) === 'one' ? 'one' : 'other';
  return t(`team.${rule}`, { n: n.toLocaleString(locale()), name: speciesShort(id, rule) });
}

export function t(key: MsgKey, vars?: Vars): string {
  const template = DICTIONARIES[current][key];
  // Name placeholders default to the current name pair; explicit vars win.
  return interpolate(template, template.includes('{') ? { ...speciesVars(), ...vars } : vars);
}

/** The label key of a parameter, with the heavy species' weapon overrides (docs/SPECIES.md). */
export function paramLabelKey(id: ParamId, weapon: Weapon = 'bite'): MsgKey {
  if (weapon !== 'bite') {
    if (id === 'heavy.biteForce') return `param.weapon.${weapon}`;
    if (
      id === 'heavy.biteLethality' ||
      id === 'heavy.biteInterval' ||
      id === 'heavy.biteReach' ||
      id === 'heavy.biteArc' ||
      id === 'heavy.biteAccuracy'
    ) {
      return `param.attack.${id.slice('heavy.'.length) as 'biteLethality'}`;
    }
  }
  return `param.${id}`;
}

export function paramLabel(id: ParamId, weapon?: Weapon): string {
  return t(paramLabelKey(id, weapon));
}

export function paramHelp(id: ParamId, vars?: Vars): string {
  return t(`paramHelp.${id}`, vars);
}

/** BCP 47 locale for number formatting. */
export function locale(): string {
  return current === 'ko' ? 'ko-KR' : 'en-US';
}

function syncDocumentLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

/**
 * Set the starting language and apply it to `<html lang>`. The app passes the language of its
 * URL (`/` Korean, `/en/` English; see `pageLang` in src/pages/routes.ts). Nothing is stored.
 */
export function initLang(lang: Lang = DEFAULT_LANG): Lang {
  current = lang;
  syncDocumentLang();
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  syncDocumentLang();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Attribute names used to bind static elements to message keys. */
export const I18N_ATTR = {
  text: 'data-i18n',
  title: 'data-i18n-title',
  aria: 'data-i18n-aria',
} as const;

function isMsgKey(v: string | null): v is MsgKey {
  return v !== null && Object.hasOwn(ko, v);
}

/** Re-translate every bound element under `root` (text, title and aria-label bindings). */
export function applyI18n(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.text}]`)) {
    const key = el.getAttribute(I18N_ATTR.text);
    if (isMsgKey(key)) el.textContent = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.title}]`)) {
    const key = el.getAttribute(I18N_ATTR.title);
    if (isMsgKey(key)) el.title = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.aria}]`)) {
    const key = el.getAttribute(I18N_ATTR.aria);
    if (isMsgKey(key)) el.setAttribute('aria-label', t(key));
  }
}
