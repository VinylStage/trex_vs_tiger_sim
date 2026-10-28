# Usability test and survey (1.0 M2)

> **한국어 요약**
>
> - 1.0 개편 설계([RENEWAL-1.0.md](../design/RENEWAL-1.0.md)) M2의 사용성 시험 도구입니다. 18–35세, 이 사이트를 본 적 없는 5–8명이 대상이고, 모집과 진행은 소유자가 합니다. 모집이 안 되면 3명 이상으로 하는 간이 시험(복도 시험)으로 대신합니다.
> - 통과 기준은 설계의 G2 (3)과 G3 (3)입니다. 80% 이상이 도움 없이 첫 결과에 도달하고 그 시간의 중앙값이 60초 이하, 그리고 세 과제(대결 시작, 마릿수 바꾸기, 결과 공유) 각각을 80% 이상이 도움 없이 끝내야 합니다. 첫 결과까지의 조작 수(3회 이하)도 함께 셉니다.
> - 진행자 대본, 동의 안내, 설문(익명, 10문항 이하)은 한국어입니다. 사이트는 아무 데이터도 모으지 않으며, 기록은 진행자의 메모와 참가자가 동의한 경우의 화면 녹화뿐입니다.
> - 아래 [결과 양식](#results-template)은 비어 있습니다. 시험을 실제로 한 뒤에만 채웁니다.

Status: **ready to run, not run yet.** The owner recruits and moderates; nothing below is a result. Issue: [#166](https://github.com/VinylStage/trex_vs_tiger_sim/issues/166), part of [#125](https://github.com/VinylStage/trex_vs_tiger_sim/issues/125).

## Contents

- [Goals and pass criteria](#goals-and-pass-criteria)
- [Participants](#participants)
- [Setup](#setup)
- [Session plan and timing](#session-plan-and-timing)
- [Tasks](#tasks)
- [What to record](#what-to-record)
- [Consent note (Korean)](#consent-note-korean)
- [Moderator script (Korean)](#moderator-script-korean)
- [Anonymous survey (Korean)](#anonymous-survey-korean)
- [Results template](#results-template)
- [After the test](#after-the-test)

## Goals and pass criteria

The test checks the play-first goals of the 1.0 renewal ([RENEWAL-1.0.md §1.1](../design/RENEWAL-1.0.md#11-goals) and the M2 acceptance in [§11](../design/RENEWAL-1.0.md#m2-playlearn-split-simple-mode-usability)). Every threshold is the design's own; the design marks game-design thresholds as **S** (assumptions).

| Id     | Criterion                                                                                            | Measured in             | Pass                                     |
| ------ | ---------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| G2 (1) | First battle result from a cold `/` in at most 3 interactions                                        | T1, interaction count   | Median ≤ 3, and the shortest path is ≤ 3 |
| G2 (3) | At least 80 % reach a first result unaided, with a median time of 60 s or less                       | T1                      | Both parts                               |
| G3 (3) | At least 80 % finish each scripted task without help: start a battle, change a count, share a result | T1, T2, T3 (each alone) | Each task separately                     |
| M2     | Findings are fixed or filed as issues                                                                | After the test          | Every finding has a fix PR or an issue   |

Definitions used for scoring:

- **Cold `/`**: the lobby at `https://trex-vs-tiger.vinylims.com/` (or the preview URL, see [Setup](#setup)) in a fresh private window, with no fragment and no query, never opened before on that device or profile.
- **Interaction**: one deliberate tap, click, key press that submits, or text entry into a field. Scrolling, reading and hovering do not count. Dismissing the first-visit tour offer counts if the participant does it. The shortest path today is two: **시뮬레이터 시작** on the lobby, then **시뮬레이션 실행** on the play page, which opens at the lion vs tiger preset ([PAGES.md](../PAGES.md#simple-mode-and-the-advanced-switch)).
- **First result**: the win share bar and verdict sentence are on screen after a Run.
- **Unaided**: the participant finishes without any hint from the moderator. A neutral prompt from the script ("생각나는 대로 해 보세요") is not a hint. Any pointer to a control, label or area is a hint, and the task is scored "with help".
- **Time**: from the moment the lobby is visible to the moment the first result is visible (T1), or from the end of the task instruction to completion (T2, T3). Stop at 3 minutes; a task not done by then is "not finished".

## Participants

- **5–8 people aged 18–35** who have not seen the site. Adults only, which keeps consent simple: participants under 14 would need a guardian's consent under the Personal Information Protection Act (PIPA), and the design limits the test to adults for that reason.
- Not people who worked on the project, and not people the moderator has shown the site to.
- Mix of devices: aim for at least half on **their own phone** (G2 says phone friendly) and the rest on a laptop or desktop. Note the browser.
- No requirement to like animals, science or games. Note, without names, whether the person watches live streams, since streamers are the first audience (G1).
- **Fallback** (design §11 M2): if recruiting fails, a smaller hallway test with **at least 3 people** still runs, with the same tasks and scoring. Report it as a hallway test: three people cannot show 80 % with any confidence.
- Compensation, if any, is the owner's choice and is not tied to the results.

## Setup

1. **Build.** Test on production or on a Cloudflare preview deployment of the commit under test (design: "on a preview build"). Write the URL, the version from the footer badge and the commit SHA into the results.
2. **Device state.** A new private (incognito) window for every participant, so the site has no stored state: no tour flag, no saved settings. On a participant's own phone, ask them to open a private tab; if that is not possible, open `/reset/` once and then close and reopen the browser.
3. **Start screen.** A blank tab. The moderator gives the address (typed, QR code or a link in a chat message) as part of the script, so the visit starts cold at `/`.
4. **Recording.** Screen recording only with consent, and never the face or voice unless the participant agrees separately. A paper or spreadsheet sheet per participant with the fields in [What to record](#what-to-record). A stopwatch.
5. **Network.** A normal connection. Note it if the page was slow to load; a slow first load is a finding, not a participant error.
6. **No accounts, no data.** The site collects nothing about participants and has no analytics. The survey runs on a separate anonymous form the owner chooses, with no name, email or login field.

## Session plan and timing

About **20 minutes** per participant, at most 25.

| Step | Content                                 | Time    |
| ---- | --------------------------------------- | ------- |
| 1    | Welcome, consent note, recording choice | 3 min   |
| 2    | Warm-up question (no site)              | 1 min   |
| 3    | T1 first result from a cold `/`         | ≤ 3 min |
| 4    | T2 change a count and run again         | ≤ 3 min |
| 5    | T3 share the result                     | ≤ 3 min |
| 6    | T4 open exploration (not scored)        | 3 min   |
| 7    | Short interview                         | 3 min   |
| 8    | Survey (on their own device, anonymous) | 3 min   |

The moderator runs the tasks in this order for everyone, since each task starts where the previous one ended.

## Tasks

The task wording the moderator reads is in the [script](#moderator-script-korean). Its intent:

| Task | Goal for the participant                                                               | Done when                                                                                                    | Criterion                            |
| ---- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| T1   | Starting from the address they were given, see who wins a battle.                      | The win share bar and verdict are visible.                                                                   | G2 (1), (3); G3 (3) "start a battle" |
| T2   | Make one side bigger (more animals on one side) and see the new result.                | A count differs from the one before, and a new result for that count is visible.                             | G3 (3) "change a count"              |
| T3   | Send this result to a friend (the moderator's chat, or copy it so it could be pasted). | A result link or settings link is copied or handed to the share sheet (**결과 공유** or **설정 링크 복사**). | G3 (3) "share a result"              |
| T4   | Free exploration: anything they are curious about. Not scored; note what they try.     | –                                                                                                            | Findings only                        |

Do not name controls in the instructions. Use the participant's goal ("누가 이기는지", "한쪽 수를 늘려", "친구에게 보내"), never button labels.

## What to record

Per participant, per task:

- device and browser; phone or desktop
- time to done (s), or "not finished" at 3 min
- unaided, with help (what hint), or not finished
- interactions counted (T1 in particular), and the path: e.g. `시뮬레이터 시작 → 시뮬레이션 실행`
- hesitations longer than about 5 s, wrong taps, and where they happened
- quotes worth keeping (no names)
- anything that looked like an error, a slow screen or a layout problem, with a screenshot if consented

## Consent note (Korean)

Read aloud or hand over before anything else. Participation needs a clear "네".

> **참여 안내**
>
> - 이 시험은 웹사이트가 쓰기 쉬운지 알아보려는 것입니다. 사람을 평가하는 시험이 아닙니다. 막히는 곳이 있으면 그건 사이트를 고쳐야 한다는 뜻입니다.
> - 약 20분 걸립니다. 언제든 이유를 말하지 않고 그만둘 수 있고, 그만둬도 아무 불이익이 없습니다.
> - 이름, 연락처, 얼굴은 기록하지 않습니다. 진행자는 걸린 시간, 누른 곳, 하신 말씀 일부를 메모합니다. 메모에는 이름 대신 번호(P1, P2 …)만 씁니다.
> - 화면 녹화는 동의하실 때만 하고, 얼굴과 목소리는 녹화하지 않습니다. 녹화본은 결과를 정리하는 데만 쓰고 정리가 끝나면 지웁니다.
> - 마지막에 익명 설문(10문항 이하, 약 3분)이 있습니다. 이름이나 이메일을 묻지 않습니다.
> - 정리한 결과는 번호와 숫자로만 공개 저장소의 문서에 남습니다.
> - 이 사이트는 교육용 시뮬레이션입니다. 실제 동물 싸움과 관계없고, 그런 싸움을 권하거나 지지하지 않습니다.
> - 만 18세 이상 35세 이하인지 확인드립니다.
>
> 참여하시겠어요? 화면 녹화에도 동의하시나요? (녹화는 하지 않아도 참여할 수 있습니다.)

## Moderator script (Korean)

Read the lines in quotes as written. Do not explain the site, the model or any control before the tasks end. If asked "이거 눌러도 돼요?", answer "생각나는 대로 해 보세요". If the participant is stuck for 60 s, ask "지금 무엇을 찾고 계세요?" (not a hint). Give a hint only after 2 minutes, and score the task "with help".

**1. 시작 (3분)**

> "와 주셔서 고맙습니다. 오늘은 한 웹사이트를 처음 써 보시는 모습을 보면서, 어디가 쉽고 어디가 헷갈리는지 알아보려고 합니다. 정답은 없고, 막히면 사이트 탓입니다."
>
> "하시면서 떠오르는 생각을 소리 내어 말해 주시면 큰 도움이 됩니다. 말이 끊겨도 괜찮습니다."
>
> (동의 안내를 읽고, 참여와 녹화 동의를 확인한다.)

**2. 준비 질문 (1분, 사이트 없이)**

> "평소에 동물이나 공룡에 관한 영상이나 글을 보시나요? '누가 더 셀까' 같은 내용을 본 적 있으세요?"
>
> "라이브 방송을 자주 보시나요?" (예 / 아니요만 기록)

**3. 과제 1: 첫 결과 (최대 3분)**

> (새 비공개 창의 빈 탭을 띄운 상태에서 주소를 건넨다.)
>
> "이 주소로 들어가 보세요. 동물끼리 맞붙으면 누가 이기는지 계산해 주는 사이트입니다. **아무 대결이나 하나 골라서, 누가 이기는지 결과를 확인해 보세요.** 다 됐다 싶으면 '됐어요'라고 말해 주세요."
>
> (로비가 보이는 순간부터 시간을 잰다. 승률 막대와 판정 문장이 보이면 멈춘다. 조작 횟수와 경로를 적는다.)
>
> 끝난 뒤: "화면에 나온 결과를 한 문장으로 말해 주실 수 있나요?" (이해했는지만 적고, 고쳐 주지 않는다.)

**4. 과제 2: 마릿수 바꾸기 (최대 3분)**

> "이번에는 **한쪽 동물 수를 늘려서**, 결과가 어떻게 달라지는지 확인해 보세요."
>
> (지시가 끝난 순간부터 잰다. 한쪽 수가 바뀌고 그 수로 새 결과가 나오면 멈춘다.)

**5. 과제 3: 결과 공유 (최대 3분)**

> "방금 결과가 재밌어서 친구에게 보여 주고 싶다고 해 볼게요. **이 결과를 친구에게 보낼 수 있게 해 보세요.** 실제로 보내지 않아도 되고, 보낼 수 있는 상태가 되면 '됐어요'라고 말해 주세요."
>
> (결과 링크나 설정 링크가 복사되거나 공유 창이 열리면 멈춘다. 휴대폰 공유 창이 열리면 취소해도 된다고 말한다.)

**6. 과제 4: 자유 탐색 (3분, 채점하지 않음)**

> "이제 3분 동안 궁금한 걸 마음대로 해 보세요. 해 보고 싶었는데 못 찾은 게 있으면 말해 주세요."

**7. 짧은 인터뷰 (3분)**

> "처음 화면에서 무엇을 해야 할지 바로 아셨나요? 무엇을 보고 아셨어요?"
>
> "결과 화면에서 이해가 안 되거나 믿기 어려웠던 숫자나 말이 있었나요?"
>
> "가장 헷갈렸던 순간 하나만 꼽는다면요?"
>
> "이 사이트를 누군가에게 보여 준다면 누구에게, 어떤 대결을 보여 주고 싶으세요?"

**8. 설문 안내와 마무리**

> "마지막으로 익명 설문이 있습니다. 이름이나 연락처는 묻지 않습니다. 본인 기기로 이 주소에서 3분 정도면 됩니다."
>
> "오늘 도와주셔서 정말 고맙습니다. 막혔던 부분은 모두 사이트를 고치는 데 씁니다."

If a participant asks whether the results are real: answer after the tasks, with the disclaimer ("교육용 모델의 계산이고, 실제 대결 결과나 예측이 아닙니다").

## Anonymous survey (Korean)

Nine questions: seven on a 5-point scale (1 전혀 그렇지 않다 – 5 매우 그렇다) and two open. The owner builds it in an anonymous form tool with no name, email, login or IP collection, and may also share it in the target communities (design §11 M2). The site itself collects nothing. Ask the age bracket only as a range, to check the 18–35 target.

| #   | 질문                                                 | 형식                          |
| --- | ---------------------------------------------------- | ----------------------------- |
| 1   | 나이대를 골라 주세요.                                | 18–24 / 25–29 / 30–35 / 그 밖 |
| 2   | 처음 화면에서 무엇을 하면 되는지 바로 알 수 있었다.  | 1–5                           |
| 3   | 결과(누가 이기는지)를 보기까지 빨랐다.               | 1–5                           |
| 4   | 결과 화면의 승률과 설명을 이해할 수 있었다.          | 1–5                           |
| 5   | 동물이나 마릿수를 바꾸는 방법이 쉬웠다.              | 1–5                           |
| 6   | 결과를 친구에게 보내는 방법이 쉬웠다.                | 1–5                           |
| 7   | 다른 대결도 더 해 보고 싶다.                         | 1–5                           |
| 8   | 가장 헷갈렸거나 불편했던 점은 무엇이었나요?          | 자유 응답                     |
| 9   | 보고 싶은 대결이나 바라는 기능이 있다면 적어 주세요. | 자유 응답                     |

Survey header (Korean):

> 이 설문은 동물 대결 시뮬레이션 사이트를 더 쉽게 만들기 위한 익명 설문입니다. 이름, 연락처 같은 개인 정보는 묻지 않으며, 응답은 숫자와 문장으로만 정리해 공개 문서에 남깁니다. 약 3분 걸립니다. 만 18세 미만이면 응답하지 말아 주세요.

When reporting, give per question the number of answers, the median and the distribution (count per scale point), and group the open answers by theme. Do not quote an open answer that could identify someone.

## Results template

Fill in only after the test has run. Leave a cell empty rather than guessing.

**Session record**

| Field                         | Value |
| ----------------------------- | ----- |
| Dates                         |       |
| Moderator                     |       |
| Build URL                     |       |
| Version and commit SHA        |       |
| Participants (n)              |       |
| Full test or hallway fallback |       |
| Devices (phone / desktop)     |       |

**Per participant**

| P   | Age bracket | Device / browser | T1 time (s) | T1 interactions | T1 unaided | T2 time (s) | T2 unaided | T3 time (s) | T3 unaided | Notes |
| --- | ----------- | ---------------- | ----------- | --------------- | ---------- | ----------- | ---------- | ----------- | ---------- | ----- |
| P1  |             |                  |             |                 |            |             |            |             |            |       |
| P2  |             |                  |             |                 |            |             |            |             |            |       |
| P3  |             |                  |             |                 |            |             |            |             |            |       |
| P4  |             |                  |             |                 |            |             |            |             |            |       |
| P5  |             |                  |             |                 |            |             |            |             |            |       |
| P6  |             |                  |             |                 |            |             |            |             |            |       |
| P7  |             |                  |             |                 |            |             |            |             |            |       |
| P8  |             |                  |             |                 |            |             |            |             |            |       |

**Criteria**

| Criterion                                        | Measured | Pass? |
| ------------------------------------------------ | -------- | ----- |
| G2 (1) median T1 interactions (≤ 3)              |          |       |
| G2 (3) share reaching a first result unaided     |          |       |
| G2 (3) median T1 time (≤ 60 s)                   |          |       |
| G3 (3) T1 start a battle, share unaided (≥ 80 %) |          |       |
| G3 (3) T2 change a count, share unaided (≥ 80 %) |          |       |
| G3 (3) T3 share a result, share unaided (≥ 80 %) |          |       |

**Survey** (n = )

| #   | Median | 1   | 2   | 3   | 4   | 5   |
| --- | ------ | --- | --- | --- | --- | --- |
| 2   |        |     |     |     |     |     |
| 3   |        |     |     |     |     |     |
| 4   |        |     |     |     |     |     |
| 5   |        |     |     |     |     |     |
| 6   |        |     |     |     |     |     |
| 7   |        |     |     |     |     |     |

Age brackets (Q1):

Open answers by theme (Q8, Q9):

**Findings**

| #   | Finding | Seen in (P…) | Severity (blocks a task / slows / cosmetic) | Fix PR or issue |
| --- | ------- | ------------ | ------------------------------------------- | --------------- |
|     |         |              |                                             |                 |

## After the test

1. Fill in the template above in this file, in a PR that references #125.
2. File every finding as an issue (or fix it in a PR) and link it in the findings table; M2 acceptance needs each one fixed or filed.
3. If G2 (3) or G3 (3) fails, the failing task's findings block the M2 acceptance and release checklist item 8 ([RENEWAL-1.0.md §1.4](../design/RENEWAL-1.0.md#14-100-release-checklist)); fix them and run at least the failing task again with new participants.
4. Delete the screen recordings once the findings are written down, as the consent note promises.
