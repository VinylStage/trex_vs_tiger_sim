/* Korean words of the sharing features (src/share/messages.ts, #79). */

export const shareKo = {
  'xfer.title': '설정 내보내기 · 가져오기',
  'xfer.codeLabel': '설정 코드',
  'xfer.codeHelp':
    '코드, 공유 링크(#s=…) 또는 .json 파일로 설정을 옮길 수 있습니다. 시드가 포함되어 같은 결과가 재현됩니다.',
  'xfer.copyCode': '코드 복사',
  'xfer.saveFile': '.json 저장',
  'xfer.pasteLabel': '코드 또는 링크 붙여넣기',
  'xfer.pastePlaceholder': 'TVT2-… 또는 https://…#s=…',
  'xfer.check': '확인',
  'xfer.loadFile': '.json 불러오기',
  'xfer.previewTitle': '가져올 설정',
  'xfer.apply': '이 설정 적용',
  'xfer.cancel': '취소',
  'xfer.applied': '설정을 적용했습니다. 실행 버튼을 눌러 시작하세요.',
  'xfer.codeCopied': '설정 코드를 복사했습니다.',
  'xfer.saved': '설정 파일을 저장했습니다.',
  'xfer.summary': '{heavy} {heavyCount} vs {pack} {packCount} · {runs}회 · 시드 {seed}',
  'xfer.summaryParams': '수정한 파라미터 범위 {n}개',
  'xfer.summaryDefaultParams': '파라미터 범위는 종 기본값',
  'xfer.err.empty': '코드나 링크를 입력하세요.',
  'xfer.err.length': '입력이 너무 깁니다.',
  'xfer.err.alphabet': '코드에 쓸 수 없는 문자가 있습니다.',
  'xfer.err.json': '코드를 해석하지 못했습니다. 잘린 부분이 없는지 확인하세요.',
  'xfer.err.shape': '설정 형식이 아닙니다.',
  'xfer.err.noPayload': '이 링크에는 설정(#s=…)이 없습니다.',
  'xfer.err.app': '이 시뮬레이터에서 내보낸 설정 파일이 아닙니다.',
  'xfer.err.file': '파일을 읽지 못했습니다.',

  'copy.fallbackTitle': '아래 텍스트를 직접 복사하세요',
  'copy.close': '닫기',

  'rs.share': '결과 공유',
  'rs.shareHint': '이번 결과의 스냅샷과 설정을 담은 링크를 만듭니다.',
  'rs.open': '결과 페이지 열기',
  'rs.copied': '결과 링크를 복사했습니다.',
  'rs.failed': '결과 링크를 만들지 못했습니다.',

  'repro.pending': '공유된 결과를 검증하는 중입니다. 설정을 바꾸지 말고 ‘실행’을 누르세요.',
  'repro.same': '공유된 결과와 정확히 같은 결과가 나왔습니다.',
  'repro.within': '재현됨: 공유된 승률이 이번 실행의 95% 신뢰구간 안에 있습니다.',
  'repro.outside': '차이 있음: 공유된 승률 중 일부가 이번 실행의 95% 신뢰구간 밖에 있습니다.',
  'repro.changed': '설정이 공유된 결과와 달라 검증하지 않았습니다.',

  'result.documentTitle': '{headline} – 공유된 시뮬레이션 결과',
  'result.eyebrow': '공유된 시뮬레이션 결과',
  'result.win': '{name} 승리',
  'result.drawWin': '무승부',
  'result.headline': '{name} {pct}',
  'result.vsDefault': '기본 대결(T-Rex 10 vs 호랑이 100) 대비 {diff}',
  'result.matchup': '{heavy} {heavyCount} vs {pack} {packCount}',
  'result.runs': '{n}회 시뮬레이션 · 시드 {seed}',
  'result.runsShort': '{n}회',
  'result.ci': '95% 신뢰구간 {lo}–{hi}',
  'result.duration': '평균 교전 시간',
  'result.survivors': '{heavy} 평균 생존',
  'result.incapacitated': '{pack} 평균 전투 불능',
  'result.draw': '무승부',
  'result.snapshot':
    '스냅샷: 링크를 만든 시점에 공유자의 브라우저에서 계산한 숫자입니다. 브라우저 엔진에 따라 개별 실행은 달라도 통계적으로는 일치합니다. ‘직접 실행’으로 확인해 보세요.',
  'result.disclaimer':
    '교육용 몬테카를로 모델입니다. 결과는 가정에 따라 달라지며 실제 싸움의 예측이 아닙니다.',
  'result.format': '이미지 형식',
  'result.formatStory': '스토리 (9:16)',
  'result.formatSquare': '정사각형 (1:1)',
  'result.saveImage': '이미지 저장',
  'result.share': '공유하기',
  'result.copyLink': '링크 복사',
  'result.textShare': '텍스트 공유',
  'result.runIt': '이 설정으로 직접 실행',
  'result.tryOwn': '나도 해보기',
  'result.linkCopied': '링크를 복사했습니다.',
  'result.textCopied': '결과 텍스트를 복사했습니다.',
  'result.imageSaved': '이미지를 저장했습니다.',
  'result.preparing': '이미지를 준비하는 중…',
  'result.previewAlt': '결과 카드 미리보기: {headline}',
  'result.invalid': '이 결과 링크를 읽지 못했습니다. 링크가 잘렸거나 손상되었을 수 있습니다.',
  'result.invalidConfig':
    '결과 숫자는 확인할 수 없지만, 링크에 담긴 설정으로 직접 실행해 볼 수 있습니다.',
  'result.missing':
    '결과 링크에 결과가 없습니다. 시뮬레이터에서 실행한 뒤 ‘결과 공유’를 눌러 링크를 만드세요.',
  'result.overlayHint': '이미지를 길게 눌러 저장하세요',
  'result.overlayClose': '닫기',
  'result.shareTitle': '티렉스 대 호랑이 시뮬레이션 결과',

  'tier.landslide': '압승',
  'tier.clear': '우세',
  'tier.close': '접전',
  'tier.upset': '이변',
  'tier.stalemate': '교착',

  'text.head': '{heavy} vs {pack} — {runs}회',
  'text.pcts': '{heavyName} {h} · {packName} {p} · 무승부 {d}',

  'card.brand': '티렉스 대 호랑이 시뮬레이터',
  'card.watermark': '시뮬레이션 · 가정에 따라 다름',
  'card.runs': '{n}회 시뮬레이션 · 평균 {t}',
  'card.runsNoT': '{n}회 시뮬레이션',

  'meta.title': '{matchup} — {winner} {pct}',
  'meta.description':
    '{runs}회 몬테카를로 시뮬레이션 스냅샷 · {tier} · 기본 대결 대비 {diff}. 같은 설정으로 직접 실행해 보세요.',
  'meta.descriptionFree':
    '{runs}회 몬테카를로 시뮬레이션 스냅샷 · {tier} · {context}. 같은 설정으로 직접 실행해 보세요.',

  'free.sideName': '{name} {side}',
  'free.context': '자유 대결 · 잠정 모델',
  'free.contextMirror': '같은 종 대결 · 자유 대결 · 잠정 모델',
  'free.fled': '{side} 평균 도주',
  'free.buff': '{side} 무리 버프 활성',
  'free.buffValue': '개체·시간의 {pct} · 중앙값 {t}',
  'free.cardBuff': '무리 버프 {list}',
} as const;

export type ShareMsgKey = keyof typeof shareKo;
export type ShareDictionary = Readonly<Record<ShareMsgKey, string>>;
