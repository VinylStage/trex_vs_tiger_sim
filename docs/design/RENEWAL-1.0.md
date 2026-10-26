# 1.0.0 renewal: play first, streamers first (design)

> **한국어 요약**
>
> - 1.0.0은 보는 재미와 쉬운 사용을 중심으로 한 개편입니다. 1순위 사용자는 시청자와 함께 30분 이상 방송하는 스트리머이고, 2순위는 10–30대 웹 이용자입니다.
> - 놀이와 배우기를 나눕니다. 놀이 화면은 대결하기 `/`, 플레이 `/play/`, 방송 모드 `/stream/` · `/studio/` · `/overlay/`입니다. 배우기 화면은 `/learn/` 허브 아래의 가이드, 모델, 파라미터, 종 도감입니다. 기존 URL과 공유 링크는 모두 지금처럼 열립니다. "배우기 채널"이 별도 유튜브 채널을 뜻했는지는 소유자에게 묻습니다(R13).
> - 쉬운 모드에서는 종, 마릿수, 인기 프리셋만 고릅니다. 지금 있는 파라미터는 모두 고급 모드로 옮깁니다. 10–30대 5–8명을 대상으로 사용성 시험을 하고, 짧은 설문도 함께 진행합니다.
> - 방송의 핵심 루프는 "동물 최강전"입니다. 기본 대진은 "16강 기본"이고 약 40분 걸립니다. 한 경기는 약 2분이며 예측(전투 정지) → 실시간 전투와 승률 막대 → 변수 카드 → 결과 순서로 진행합니다. 전투가 멈춘 동안에도 화면이 8초 넘게 정지하지 않도록 합니다. 30분 이상 진행되는지는 시험 방송에서 실제로 잽니다. 외부 스트리머를 3명 구하지 못하면 소유자가 직접 진행한 시험 방송 기록으로 대신합니다.
> - 변수 카드는 카드 번호를 틱 단위로 기록하고, 같은 판을 그 기록으로 다시 계산해 재생 중인 지점에서 결과를 바꿔 끼웁니다. 지속 효과는 매번 "기본값 × 켜져 있는 배율의 곱"으로 새로 계산하므로 카드가 겹쳐도 값이 어긋나지 않습니다. 기록이 비어 있으면 결과가 비트 단위로 같습니다.
> - 1.0에 새로 넣는 동물은 북극곰, 스피노사우루스(육상 대결), 하마, 흰코뿔소, 랩터 무리입니다. 하마와 코뿔소는 1.0 출시 조건입니다. 1.0 이후에는 매달 한 종 이상 추가합니다.
> - 광고의 첫 관문은 루트 도메인 승인이고, 승인 여부는 블로그 콘텐츠(발행 이력, 원본성)에 달려 있습니다. 블로그 정비는 소유자 작업이며 vinylog와 vinylog-vault 이슈로 추적합니다. 방송 화면, 플레이 화면, `/r/`에는 광고 코드를 넣지 않습니다. CSP는 해시 기반 strict CSP로 옮깁니다.
> - 홍보는 네이버 서치어드바이저와 다음 등록, 프리셋별 공유 이미지, 출시 계획으로 준비합니다. 성과를 어떻게 잴지는 소유자가 정합니다(R33).
> - 일반명사 규칙을 넓힙니다. 기능, 프리셋, 카드 이름뿐 아니라 "왜?" 근거 문구, 방송 도구 문구, 캡션, 블로그 글에도 상표, 작품명, 다른 도구 이름을 쓰지 않습니다. 영어 화면에서는 "odds" 대신 "win chance"를 씁니다.
> - 라이브 채팅은 1.x에서 진행합니다(#118). 3D는 1.x에 선택형 베타로 미룹니다.

Status: **Accepted** by the owner on 2026-10-26 (decision record in §12), revision 2.
Base: `main` at `d9bb961` (v0.2.16, release #121; includes #119–#122, with the patch-notes entry at `5136bb6`). Every code line reference was re-checked against `d9bb961`. Most cited files are unchanged since `d0cc260`. Two moved:

- `src/ui/free-replay.ts`: 87 lines changed in #120. `load()` is now at 218–233.
- `src/ui/share-free.ts`: an import was added, so references below line 16 shifted by one.

#120 closed #117 (physical keys under a Korean IME, and resume when the page becomes visible again).

**What changed in revision 2**

- References are rebased on current `main`. The #117 work items are removed because #120 shipped them.
- Hippo and white rhino are now required for 1.0. _Giganotosaurus_ moves to batch B, and _Allosaurus_ moves to batch C so it ships with _Stegosaurus_. A minimum cadence after 1.0 is written down (§5).
- The ads path now includes the blog remediation, which is owner work, with links to the tracking issues. Root approval is no longer described as outside our control (§2.4, §7.1, §13).
- New: a promotion plan and a decision on how success is measured (§7.6, §7.7). Also new: a usability test, a survey, a fallback for pilot sessions, and a question about what "learning channel" meant (R13).
- Pacing: a cap on static-screen time with idle motion during freezes. The Quick 8 arithmetic is corrected and the length presets are mapped to brackets. The prediction window now starts at 30 s, Twitch's minimum.
- Engine: the intervention log stores card codes, and effects are recomputed deterministically, with no `revert` entries. Added: a priority scheduler, the overlay as the single compute owner, a card-pause compute budget, a defined behaviour when the gates turn live cards off, and battle events derived from frames (§10).
- The cup link now carries everything needed to reproduce the bracket. Added: a tiebreak rule and an opinion-pick format.
- Overlay: disclaimers are shown, and the place where sound plays is decided. The claim that the overlay works offline is dropped.
- Wording: the common-noun rule now covers evidence text, studio copy, captions and blog posts. English strings use "win chance" instead of "odds" and "still standing" instead of "survivors". Card names are fixed, and "Classic 16" is renamed "Standard 16".
- Demand scripts: only API-based pulls are committed.
- The release checklist adds R23, R25, the usability test and search registration.

Inputs: six research tracks dated 2026-10-26 (animals, streamers, live chat, 3D, ads, codebase). Each was fact-checked independently. Where a fact-check corrected a claim, this document uses the corrected version. Blog facts come from `vinylog/docs/ADSENSE_AUDIT.md` and the open issues in `VinylStage/vinylog` and `VinylStage/vinylog-vault`, read on 2026-10-26.

Evidence tags follow [SPECIES.md §3](../SPECIES.md#3-evidence-tags-and-formulas):

- **L**: literature
- **D**: derived
- **S**: assumption, to be tuned
- **U**: unverified popular figure

Every game-design threshold in this document (timings, card magnitudes, banner triggers, gate limits) is **S**. Pilot sessions tune them.

## Contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Research summary](#2-research-summary)
3. [Information architecture](#3-information-architecture)
4. [Streamer session loop](#4-streamer-session-loop)
5. [New animals roadmap](#5-new-animals-roadmap)
6. [Simple-mode preset list](#6-simple-mode-preset-list)
7. [Ads, promotion and measurement](#7-ads-promotion-and-measurement)
8. [Live chat integration](#8-live-chat-integration)
9. [3D assessment](#9-3d-threejs-assessment)
10. [Technical plan](#10-technical-plan)
11. [Milestones to 1.0.0](#11-milestones-to-100)
12. [Owner decisions](#12-owner-decisions)
13. [Risks](#13-risks)

Appendices:

- [A. Refreshed body for issue #118](#appendix-a-refreshed-body-for-issue-118)
- [B. Variable card specification](#appendix-b-variable-card-specification)

---

## 1. Goals and non-goals

### 1.1 Goals

| #   | Goal                                                                                                                                                                                        | Measurable target for 1.0.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Streamers first.** A streamer can run a continuous session of 30 minutes or more with viewers. Nobody waits on a dead screen, and twists in the middle of a battle can change the result. | (1) The default cup (16강 기본 / Standard 16) runs end to end and lasts at least 30 minutes in at least 3 recorded sessions. These are outside pilot sessions, or owner-run dry runs under the R12 fallback. (2) No overlay screen goes more than 8 s without motion or a running countdown, and battle playback fills at least 40% of session time. Both are computed from the session log. (3) A non-technical tester sets up the default route (B, §3.3) from `/stream/` alone, in at most 2 steps and 5 minutes. |
| G2  | **10–30-year-old web players.** Free, instant, no install, phone friendly.                                                                                                                  | (1) First battle result in at most 3 interactions from a cold `/` load: pick a preset, press Run, watch. (2) LCP under 2.5 s on mobile and INP of 200 ms or less. (3) In a moderated test with 5–8 people aged 18–35 who have not seen the site, at least 80% reach a first result unaided, with a median time of 60 s or less (§11 M2).                                                                                                                                                                             |
| G3  | **Very easy for everyone.**                                                                                                                                                                 | (1) Simple mode shows only species, counts, presets and one Run button, and every other control lives in Advanced. (2) A 3–4 step Simple tour exists. (3) In the same test, at least 80% finish each scripted task (start a battle, change a count, share a result) without help.                                                                                                                                                                                                                                    |
| G4  | **Ad-ready on our side.** Everything this repository controls is done, so ads can turn on as soon as the root domain is approved.                                                           | (1) AdSense gates G1–G4 are green on production. (2) The ad loader is merged behind its gates. (3) The privacy page is rewritten, with a privacy officer contact (R23). (4) The CSP canary, which includes a full battle, is green. Ads actually serving is **not** a 1.0 gate. Serving waits on root approval of `vinylims.com`, and that depends on blog remediation the owner is doing (§7.1 step 0).                                                                                                             |
| G5  | **Continuous animal additions.**                                                                                                                                                            | (1) The add-a-species pipeline (§5.3) is documented, and batch A, including hippo and white rhino, has shipped through it. (2) The post-1.0 cadence is agreed (§5.3, R34).                                                                                                                                                                                                                                                                                                                                           |
| G6  | **Play and Learn are split.**                                                                                                                                                               | (1) A `/learn/` hub exists, the nav is grouped into Play and Learn, and the play surfaces carry no long explanatory text. (2) The free model is documented, completing design phase P8. (3) R13 is answered.                                                                                                                                                                                                                                                                                                         |
| G7  | **Findable and shareable.**                                                                                                                                                                 | (1) Search Console, Naver Search Advisor and Daum are registered (owner actions in `docs/SEO.md`). (2) Every Simple preset has its own share image. (3) A success-measurement method is agreed (R33).                                                                                                                                                                                                                                                                                                                |

### 1.2 Rules carried into 1.0

- **Glyphs only.** Agents are drawn as abstract glyphs: no animal or character shapes, faces, limbs, blood, wounds or corpses. See `CONTRIBUTING.md` (content framing rules) and `docs/REPLAY.md`. Animal emoji and pictograms never appear on the stage, in 2D or 3D. They stay limited to the text share. Text labels (viewer names, short species names) may sit next to glyphs in both 2D and 3D (R9, R28).
- **Neutral words.** Use 전투 불능 / incapacitated, 이탈 / fled and 끝까지 남은 / still standing. No gore or death words appear in the UI, share text, cards, captions or SFX names.
- **No betting words.** Use 예측 / 응원 / 예상 승률, and "win chance" in English. Never use 베팅, 배당, "odds", stakes or prizes in the UI, copy, captions, the streamer kit or outreach.
- **Roster limits.** No domestic animals, pets or livestock, and no living humans. The extinct _Homo erectus_ is the one hominin, and it always carries the thought-experiment note (`docs/SPECIES.md` §9).
- **Educational disclaimer** on every play surface, including `/overlay/` (§3.3): the site does not promote or endorse real animal fighting.
- **Naming in common nouns.** Everything users or viewers read uses common nouns. That starts with feature, mode, preset and card names (동물 최강전 / Animal Cup, 방송 모드, 변수 카드, 쉬운 모드) and extends to the following.
  - **Evidence and source text shown to users**, such as `FreePreset.why` under "왜? / Why?". It cites the literature or describes the source ("a 2004 documentary series", "a children's non-fiction book series", "a film clip"), never the title. Popularity numbers (views, poll shares) stay in internal research and never appear in the UI.
  - **Studio and kit copy.** The `name*2` syntax is called "가중치 / weights" and is not named after another tool. The tool it resembles carries a trademark claim and has a public IP dispute (§2.2).
  - **Banners, captions, card text, SFX names and share text.**
  - **Blog posts on `vinylims.com`**, because they decide root approval (§7.1 step 0). Identifiers flagged in the 2026-10-26 content audit become common nouns (vinylog-vault #54, following #52). Factual mentions of public tools and services stay, as #54 specifies.
  - **Third-party marks are never used as names.** This covers "월드컵 / World Cup" (FIFA holds World Cup marks in many jurisdictions; we did not check exposure country by country, so we avoid the word), monster, film and book franchises, TV show names, and other games' and tools' titles.
  - **Streaming platforms** are named only in factual setup and integration text. The Chzzk developer terms also forbid `chzzk`, `치지직` or `naver` in a registered app name (#118).
  - **Species** are named by common name plus scientific name.
  - **Internal research documents** may cite sources by name with a link. Nothing from those citations is copied into user-visible strings.
- **Zero runtime dependencies** (ADR-0004). **No backend or database** (ADR-0003). The **legacy engine stays frozen** (decision D0 in `docs/design/FREE-MATCHUPS.md`).

### 1.3 Non-goals for 1.0.0

- **Live chat reading** (Chzzk, YouTube, Twitch, SOOP), tracked in **#118** for 1.x. 1.0 ships the interfaces chat will plug into later (§8).
- **3D view**, recommended as an opt-in 1.x beta (§9).
- **Accounts, logins, shared viewer voting, server state.** Each would amend ADR-0003.
- **Reinforcements mid-battle.** This is an L-sized engine change (§10.1). Post-1.0.
- **True streaming engine** (stepper refactor, appendable replay). 1.0 uses fork-and-re-simulate (§10.2).
- **Offline play.** There is no service worker: `src/ui/site-data.ts` unregisters any it finds, HTML is served `no-cache`, and `/reset/` sends `Clear-Site-Data`.
- **9:16 overlay layout for short clips.** Planned for 1.1 (§7.6).
- **Client-side analytics**, unless R33 picks one.
- **Ocean arena, insect micro-arena, flying species.**
- **Custom bracket builder.** 1.0 ships curated brackets (R7).
- **Real money, prizes, donation-linked outcomes, user-uploaded images.**
- **Any change to classic-engine results.** Old v1/v2 links stay bit-identical.

### 1.4 1.0.0 release checklist

1. Bare `/` opens Simple mode. Old links (v1, v2, v3, TVT2, TVT3, `/r/`) reproduce the same results, enforced by routing and golden tests.
2. Play and Learn are split, and the free model is documented (P8).
3. A live single battle with variable cards works, and a shared link reproduces the twisted battle bit-identically, including overlapping card durations (golden in §10.4).
4. Streamer mode (`/studio/`, `/overlay/`) and the Animal Cup work, and G1 is met, by pilots or by the R12 fallback.
5. Animal batch A (polar bear, _Spinosaurus_, hippo, white rhino, raptor pack) has shipped, each species with at least one preset. The bracket tests are green: both live gates, rout check and first-round lopsidedness (§6).
6. AdSense gates G1–G4 are green on production for at least one release. The loader is merged with all gates. The canary, which includes a full battle under the new CSP, is green.
7. The performance budgets in §10.5 are met and recorded in `docs/PERFORMANCE.md`.
8. The usability test has run, G2 (3) and G3 (3) are met, and its findings are fixed or filed as issues.
9. The privacy page names a 개인정보 보호책임자 (privacy officer, role or name) with an email (R23).
10. Legal advice on GRAC rating classification has been obtained and recorded, and its outcome applied (R25).
11. Search Console, Naver Search Advisor and Daum are registered, and per-preset share images are live (§7.6).
12. These docs are updated: `MODEL.md`, `REPLAY.md`, `SHARING.md`, `STREAMING.md`, `SPECIES.md`, `ADSENSE.md`, `PAGES.md`, `SEO.md`, `ROADMAP.md`, and the new ADRs.
13. The release carries a `Release-As: 1.0.0` footer (per `CONTRIBUTING.md`, pre-1.0 versioning) and a patch-notes entry.

---

## 2. Research summary

Confidence is noted where it matters. Most big YouTube numbers are lifetime views of videos from 2013–2021, so recency is weighted explicitly.

### 2.1 Audience and platforms

- **Korean live streaming is a near-tie between Chzzk and SOOP. YouTube is third, and Twitch has left Korea.**
  - Twitch shut its Korean business on 2024-02-27 ([Twitch blog](https://blog.twitch.tv/en/2023/12/05/an-update-on-twitch-in-korea)).
  - Chzzk had 39% of Korean hours watched in Q4 2025 ([Stream Hatchet](https://streamhatchet.com/blog/chzzk-basics-a-beginners-guide-for-live-streaming/)). In Q3 2026 Chzzk had 335.2M hours against SOOP's 333M, its first quarterly lead ([Streams Charts](https://streamscharts.com/news/q3-2026-global-livestreaming-landscape)).
  - SOOP still led on average concurrent viewers in a single-day snapshot from March 2026 ([Daum/Mobile Index](https://v.daum.net/v/20260322060219476); the monthly-user figures there are February 2026 data). The two are close enough that pilots cover both (R12).
- **For the `/en/` audience**, TikTok LIVE (33.5% of tracked hours in Q3 2026) and Kick (2.04B hours, +30.7%) matter alongside Twitch (streamers track, from Streams Charts Q3 2026).
- **Chzzk's core audience is in its 20s and 30s.** In May 2026 it had 1.23M users in their 20s and 0.70M in their 30s ([WiseApp via Byline](https://byline.network/2026/07/07_2987173/)). These counts are app-only, so web viewers are missing. Do not size the audience from June 2026, which was a temporary World Cup spike.
- **Talk / Just Chatting is Chzzk's largest category**: 169M hours in 2025, against 144M for LoL ([Stream Hatchet](https://streamhatchet.com/blog/chzzk-basics-a-beginners-guide-for-live-streaming/)). That the simulator fits as a talk-segment block is a _hypothesis_, to be checked by sampling VODs of segments that use web tools.
- **Koreans are shifting from playing to watching.** The 2025 gaming rate was 50.2%, down from 74.4% in 2022, and 86.3% of people who quit gaming moved to video ([KOCCA via ThisIsGame](https://www.thisisgame.com/articles/409820)).
- **Short-form habits of teens and people in their 20s.** 74% watch more than an hour of phone video a day, and humour and memes are the top short-form topic at 55% ([Consumer Insight via Daum](https://v.daum.net/v/20250817073212400)). This supports an absurd (병맛) tone and clip-sized climaxes.
- **Web gamers want free, easy and instant.** Typical sessions run 11–20 min, and 46% have dropped a game because it loaded too slowly ([Poki-commissioned survey, US/UK](https://gamedevreports.substack.com/p/poki-web-gaming-perceptions-in-2026)). The survey is vendor-sponsored and not Korean.
- **Gap.** We have no data on Korean 10–30-year-olds and web games. Naver DataLab needs a login, and Google Trends returned 429. The design closes part of the gap with a moderated usability test with 5–8 target-age users and a short anonymous survey in M2 (§11).

### 2.2 Formats that hold a session

- **Animal brackets ("동물 월드컵" in others' titles) and tier lists are a long-running Korean streamer format.** Ten videos checked, for example [this one](https://www.youtube.com/watch?v=RanZb6gbRLM), have 0.30M–3.96M views. Caveats:
  - Most high-view uploads date from 2017–2023. Verified 2025 activity: 침착맨 (Jun 2025), 윤가놈 (Jul 2025), 감스트 (Oct 2025).
  - **These brackets are decided by opinion** (streamer and chat), not by a computed result. Several are "protect me" or "pet" brackets. That is why R7 offers an opinion-pick format (§4.2).
  - Video lengths were not checked.
  - The format exists. The 30-minute claim must be measured in our own pilot.
- **Names on randomly moving entities** are the hook of a physics name-draw web tool that is common on Chzzk ([tool](https://lazygyu.github.io/roulette/), [Ruliweb](https://bbs.ruliweb.com/community/board/300143/read/72934380)). It takes a pasted name list with weights (`name*2`) and needs no chat API. A third party registered the tool's name with the Korea Copyright Commission and filed claims against streamers' videos. That is a lesson for our own naming and IP (§13), and it is why our copy never borrows the tool's name.
- **Short rounds, a quick prediction and running lore** carried a daily simulated horse-race clip series in 2025: races of about 2 minutes and a 10-second prediction window ([Know Your Meme](https://knowyourmeme.com/editorials/guides/what-got-twitter-obsessed-with-little-horses-racing-inside-mazes-horse-race-tests-and-their-rapidly-growing-fandom-explained)). Those were asynchronous clips, so a 10 s window does not transfer to live streams.
- **Sports framing** (seasons, ceremonies, a commentator) turned a marble-racing YouTube channel into a large one with 1.51M subscribers ([Wikipedia](https://en.wikipedia.org/wiki/Jelle%27s_Marble_Runs)).
- **Suspense matters more than surprise.**
  - Within-game uncertainty raised live viewers of an esports league, while ex-ante expected uncertainty did not ([Oh, Lee & Jang 2023](https://pure.jbnu.ac.kr/en/publications/outcome-uncertainty-and-esports-viewership-the-case-of-overwatch-/)).
  - On Twitch CS:GO streams, suspense enters viewer utility, with "little evidence of the effect of surprise" ([Simonov, Ursu & Zheng](https://ideas.repec.org/p/cpr/ceprdp/17353.html)).
  - The effects are modest and come from esports.
  - **Design implication:** visible, sustained suspense (a live win-chance bar, close matchups, an always-on score for late joiners) rather than random twists alone. A live win-probability graphic is an established broadcast device ([Riot/AWS](https://lolesports.com/en-US/news/dev-diary-win-probability-powered-by-aws-at-worlds)).
- **Native viewer tools.**
  - **Twitch** predictions allow 2–10 outcomes over **30**–1800 s, and polls allow 2–5 choices over 15–1800 s, one of each at a time ([Helix reference](https://dev.twitch.tv/docs/api/reference/)). Any window that feeds a Twitch prediction must be at least 30 s long.
  - **Chzzk has had streamer-run 승부예측 since 2025-11-05**, staked with 통나무 파워 channel points. The panel does not auto-refresh, and the community calls it "포인트 도박" ([Ruliweb](https://bbs.ruliweb.com/pc/board/300006/read/2336091)). It is a zero-integration bridge for 1.0, but our wording must avoid betting language.
  - **SOOP** has chat votes. Its frequent "predictions" are platform-run esports events, not a streamer tool.
- **Latency.** Chzzk was about 3 s behind real time in a 2024 hands-on impression. Twitch low-latency mode is 2–5 s. A window of 30 s with the battle frozen is a design inference, not a measurement.
- **OBS facts.**
  - Browser sources default to 800×600, with a transparent CSS option ([OBS KB](https://obsproject.com/kb/browser-source)).
  - Pages can detect OBS through `window.obsstudio` ([obs-browser README](https://raw.githubusercontent.com/obsproject/obs-browser/master/README.md)).
  - BroadcastChannel works between an OBS custom dock and a browser source on the same scheme and host ([OBS forum, 2022](https://obsproject.com/forum/threads/broadcastchannel-between-browser-docks-and-browsersource-local-files-no-longer-working.153644/)). We have not tested this.
  - An OBS browser source keeps its own cookie and storage profile.
- **Audio.** Game soundtracks are generally not licensed for broadcast, and Twitch mutes VODs ([Twitch music terms](https://legal.twitch.com/en/legal/music/20220711/)). Ship CC0 sound effects only, and no music.

### 2.3 Animals people want

- **YouGov's head-to-head poll** (34 animals, 1,224 US adults, April 2021) ([YouGov](https://yougov.com/en-us/articles/35852-lions-and-tigers-and-bears-what-animal-would-win-f)).
  - Top tier: elephant 74%, rhino 74%, grizzly 73%, tiger 70%, hippo 69%, lion 68%, crocodile 67%, alligator 65%, then gorilla and polar bear tied at 64%.
  - Current roster members: buffalo 55%, wolf 46%, hyena 41%.
  - Some comparisons often quoted from this poll (Komodo over kangaroo and similar) compare overall win rates, not head-to-head results.
- **Most-posted pairings on r/whowouldwin** (12 months, keyword counts, [Arctic Shift](https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=whowouldwin)):
  - lion and tiger 9; gorilla and grizzly 6
  - 5 each: elephant and rhino, elephant and hippo, hippo and polar bear, cougar and lion, chimp and gorilla
  - hippo and rhino 4; _Spinosaurus_ and T. rex 3
  - Reddit vote counts were unavailable.
- **A 2004 documentary series** of staged animal matchups (12 episodes, 4 involving water animals) included elephant vs white rhino, Asiatic lion vs Bengal tiger, Ussuri brown bear vs Siberian tiger, walrus vs polar bear, and lion vs Nile crocodile ([Wikipedia](https://en.wikipedia.org/wiki/Animal_Face-Off)). **A children's non-fiction book series** of matchups (21M+ copies claimed, unverified) includes lion vs tiger, rhino vs hippo, T. rex vs _Velociraptor_ and _Triceratops_ vs _Spinosaurus_. Neither title is used anywhere in the product (§1.2).
- **Dinosaurs.**
  - T. rex leads by far: 19% of US adults in Dec 2024, 24% in Apr 2026, and 30% of UK dinosaur fans ([US](https://yougov.com/en-us/articles/54548-many-americans-dont-have-a-favorite-dinosaur), [UK](https://yougov.com/en-gb/articles/50953-what-is-britains-favourite-dinosaur)).
  - The 4–7% second tier sits inside the margin of error, and 41% of Americans have no favourite dinosaur.
  - _Spinosaurus_ and _Quetzalcoatlus_ pageviews tripled in July 2025, around a dinosaur-film release. A 2001 film clip of a _Spinosaurus_–T. rex fight has 57.7M views (uploaded 2013).
- **Gorilla.**
  - It drove the largest 2025 spike: English Wikipedia had 200,267 views in May 2025 ([pageviews](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Gorilla/monthly/2024010100/2026093000)). The spike lasted about two months.
  - Over the last 12 months it is mid-table: 817k views on English Wikipedia and 5,664 on Korean Wikipedia.
  - The meme started with a post containing a racial slur ([Daily Dot](https://dailydot.com/memes/gorilla-100-men-meme/)). Any gorilla content needs neutral naming and no meme branding.
  - Adding it is a code change: two tests use `'gorilla'` as the standard invalid id (`tests/share.test.ts:303`, `tests/config.test.ts:138`).
- **Hippo and rhino** are in the YouGov top five and in many of the most-posted pairings, yet neither species doc has a table for them. They rank above gorilla on every battle-specific signal, so they are a 1.0 gate (§5.2).
- **Capybara** is the most-viewed animal article in both 12-month samples: 1.37M English and 44,679 Korean views. It has almost no fight demand, so it belongs in a what-if tier. Honey badger and Komodo dragon also have high interest and some battle-specific demand.
- **Custom battle-sim units are dominated by giant-monster mods.** The top workshop item for one animal battle game has 45,591 subscriptions ([Workshop](https://steamcommunity.com/workshop/browse/?appid=1215390&browsesort=totaluniquesubscribers)). That shows demand for spectacle and scale, but we cannot use that IP. A clearly labelled "giant size" what-if card gives the feel without it.
- **"One giant vs thousands"** is proven, mostly with evidence from 2017–2021: 18.8M views for a [man vs 10,000 penguins](https://www.youtube.com/watch?v=MTDWm50Ydi8) game video, 13.1M for a [T. rex vs chickens](https://www.youtube.com/watch?v=o5xK4fmRyuA) video. The engine caps at 5,000 per side and 5,500 total (`src/sim/free/config.ts:145-148`), and the roster has no small species yet.
- **Marine animals** are in high demand, mostly on Korean preschool channels. Marine against marine could run on today's 2D plane with an ocean skin. Mixed land and water fights would need terrain (M9).
- **For predictions, closeness beats popularity.** Near-50/50 pairings make better prediction content.

### 2.4 Ads and policy

- **The first blocker is root approval, and it depends on the blog.**
  - Root `vinylims.com` has shown "Getting ready" since 2026-10-20, and subdomains cannot be registered on their own (`docs/ADSENSE.md:10`, `:52` on `main`). Google judges the site at the root, which is the blog.
  - An earlier application was rejected for **"low value content"**. The blog audit (`vinylog/docs/ADSENSE_AUDIT.md`, 2026-07-27) names originality (80% of posts self-declared as AI-generated) and posting cadence (a seven-post day, a three-month gap) as the main reasons. It also lists a missing Contact page (added since, vinylog #67) and an 80% Horror share.
  - The blog still renders placeholder ad slots (`HOME_FEED_1/2` at `vinylog/src/pages/index.astro:62-63`, plus `POST_HEADER/FOOTER`), which leave empty boxes during review. The fix is vinylog #129 / PR #130, superseding #65.
  - This is owner-controlled work, and it sits on the critical path for ads (§7.1 step 0, §13).
- **The production CSP blocks AdSense at several layers**: `script-src 'self'` first, then `style-src` on the `<ins>` style attribute, then `default-src`.
- **What we tested in Chromium 141**, with an unfilled test slot and Google's example client, not the owner's publisher ID:
  - A hash-based strict CSP with `'strict-dynamic'`, plus Trusted Types allowing `goog#html 'allow-duplicates'`, loaded the full ad chain with zero violations.
  - It requires rewriting the entry loader on every built HTML page. An SRI shortcut breaks dynamic `import()`.
  - Firefox 148+ and Safari 26+ now enforce Trusted Types, and we did not test them.
  - Allowing `goog#html` largely neutralizes Trusted Types on ad pages.
  - Google documents only the nonce form and warns that stricter policies "may break without notice" ([AdSense CSP](https://support.google.com/adsense/answer/16283098)).
- **Where ads must not run.**
  - Not inside an OBS source or overlay, under the software-application rule ([program policies](https://support.google.com/adsense/answer/48182)) and the out-of-context-ads rule.
  - Not on play screens. Keep ads at least 150 px from the game, with no pre-roll and no refresh ([game pages](https://support.google.com/adsense/answer/2768340), [placement](https://support.google.com/adsense/answer/1346295)).
  - Not on auto-generated `/r/` pages or dead-end screens ([publisher policy](https://support.google.com/publisherpolicies/answer/11112688)).
  - Not near viewer names or chat, which count as user-generated content ([UGC](https://support.google.com/adsense/answer/1355699)).
- **Vignette "additional triggers"** have been on by default since 2026-03-09 ([announcement](https://support.google.com/adsense/answer/16853623)).
- **Between-round ads** are allowed only through H5 Games Ads, a closed beta ([H5](https://adsense.google.com/start/h5-games-ads/)).
- **Revenue expectation** is roughly $0.2–1.5 per 1,000 ad page views (low confidence). Stream sessions themselves produce no ad views.

### 2.5 Live chat, 3D and the codebase (details in §8–§10)

- **Chat.**
  - Twitch and YouTube can be read browser-only.
  - Chzzk needs stateless server functions, because CORS is blocked and a client secret is involved.
  - Chzzk developer terms item 13 and SOOP article 17-5 conflict with ads in an app that uses their API.
  - Issue **#118** already exists.
- **3D.** three.js r186 runs under our exact CSP and Trusted Types with zero violations. It costs about 128 KiB gzip as a lazy chunk, roughly 2.1× today's entire initial JS. It is feasible, but it is not what keeps viewers for 30 minutes.
- **Codebase.**
  - The bare page opens classic mode with about 25 controls.
  - Free mode has no presets, no UI for its 57 sampled parameters, a permanent "provisional" banner, no charts and no event bar. Its trace v3 has **no event log** (design phase P7's events are not written yet).
  - A per-tick intervention hook can stay bit-identical when it is empty.
  - Re-simulation cost scales with simulated battle length, and it spreads about 3× from median to p90 within one matchup (elephant vs 6 lions: median 257 s simulated, p90 714 s).
  - `SimPool` runs one batch job at a time: `start()` calls `cancel()`, which terminates the run workers (`src/ui/pool.ts:133-137`, `:203-213`). The first run in a fresh worker is 2–6× slower (cold JIT).
  - **The mass-rout cascade decides outcomes, not just duration.** In 100 tigers vs 100 lions, the default gives tigers 3/3 wins; with `routShock = 0`, lions win 3/3.
  - v3 links carry no model version.

---

## 3. Information architecture

### 3.1 Surfaces and URLs

Recommended (owner decision **R2**): split the lobby from the play document, so the play, stream and overlay documents never load ad code.

| Path (ko; en under `/en/…`)                | Document                                   | Purpose                                                                                                                   | Ad tag                                                                   | Indexed           |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| `/`                                        | **Lobby** (new)                            | Simple picker, preset row, "what's new" strip, a short crawlable play-first intro and FAQ (keeps AdSense gate G1)         | Phase 2: one unit below the fold, at least 150 px from controls          | yes               |
| `/play/`                                   | **Play app** (today's app, moved)          | Battle, replay, results, Advanced (Free and Classic Lab), Live battle, Cup                                                | never                                                                    | `noindex, follow` |
| `/stream/`                                 | Streamer kit (content page)                | Setup steps for the default route, OBS URLs, hotkeys, rules ("free to use on stream and in monetized VODs"), share images | Phase 2 eligible; the loader always skips when `window.obsstudio` exists | yes               |
| `/studio/`                                 | Control panel                              | Owns the session state and drives the overlay                                                                             | never                                                                    | noindex           |
| `/overlay/`                                | Broadcast view                             | Computes and renders the session; OBS browser source or captured window                                                   | never                                                                    | noindex           |
| `/learn/`                                  | Learn hub (new)                            | Entry to all explanatory content                                                                                          | Phase 1                                                                  | yes               |
| `/guide/`, `/model/`, `/parameters/`       | existing                                   | unchanged URLs; P8 adds the free model                                                                                    | Phase 1                                                                  | yes               |
| `/species/`                                | Species guide (new, one page with anchors) | One curated section per species; per-species pages come later (they need two-level routing)                               | Phase 1                                                                  | yes               |
| `/about/`, `/patch-notes/`                 | existing                                   | patch notes move to the footer plus the lobby strip                                                                       | optional end unit                                                        | yes               |
| `/privacy/`, `/license/`, `404`, `/reset/` | existing                                   | unchanged                                                                                                                 | never                                                                    | as today          |
| `/r/*`                                     | Pages Function                             | result previews                                                                                                           | never                                                                    | as today          |

All new paths are one segment deep. That fits `parsePagePath` (`src/pages/routes.ts:72-87`), and `vite.pages.ts` discovers each `index.html`. Sitemap, hreflang and canonical come from `CONTENT_PAGES` (`src/seo/site.ts:20-42`). `play`, `studio` and `overlay` stay out of `INDEXABLE_PAGES` and carry `noindex`.

**Backward compatibility.** Existing links point at `/#s=…`, so the lobby's first module statement forwards them:

- `#s=` (or any config hash) goes to `/play/` with the hash preserved, using `location.replace`.
- This runs before anything else, including the ad loader.
- The same applies to `/en/` → `/en/play/`.
- The "run it yourself" links on `/r/` pages move to `/play/`. Cached old links keep working through the forward.
- Nothing moves under `/learn/<page>/`. That would need a `_redirects` file and two-level routing for no gain.

**Navigation.**

- Play: 대결하기 `/` · 동물 최강전 `/play/#cup` · 방송 모드 `/stream/`
- Learn: 배우기 `/learn/` (guide, model, parameters, 종 도감)
- Footer: 소개, 패치 노트, 개인정보처리방침, 라이선스

Files: `src/pages/routes.ts:35-54`, `src/ui/site-nav.ts`, `src/pages/site-header.ts`. BreadcrumbList gains the hub level (`src/seo/head.ts:133`).

**What "learning channel" means** is an open question (R13). The brief may mean a separate YouTube channel rather than a section of the site. `/learn/` ships in 1.0 either way, and a video channel would be owner content work that `/learn/` can link to later.

### 3.2 Simple mode and Advanced mode

**Engine.** Simple mode is a thin view over `FreeConfig`, because only the free engine allows any species on either side. That means flipping decision D1 (bare page = free model) after a minimum P8 pass (owner decision **R1**):

- free-model docs on the guide, model and parameters pages
- a calibration report comparing free and classic win shares for every classic preset that free mode can express, signed off by the owner
- a decision on the "provisional model" banner

**Simple mode** (`src/ui/simple-mode.ts`, new):

| Element            | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Species cards (2)  | Grouped extant / extinct, as in `free-mode.ts:263-279`. Each card shows the common name, scientific name, era badge, typical mass from `traits.mass.range.mode`, and the abstract glyph. A "new" badge marks species added in the last release.                                                                                                                                                                                                                                                                                                                                   |
| Count steppers (2) | Quick chips 1 · 2 · 5 · 10 · 50 · 100 · 1,000, plus a stepper. For a social species (wolf, lion, spotted hyena, _H. erectus_, raptor pack) the chips stop at 100 (R4), while the stepper still reaches the engine caps (5,000 per side, 5,500 total; R32). The existing work budget lowers the run count automatically. Optional "체급 맞추기 / equal weight" toggle that sets counts to equal total mass (S-sized helper).                                                                                                                                                       |
| Preset row         | Curated presets from §6, filtered to species that exist. The landing default is 사자 vs 호랑이 1:1 (ready now).                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Run                | One large button. A fresh random seed per Run is recommended (owner decision **R3**). The seed is always written into the link, so a shared result reproduces.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Result             | Win bar ("사자 58% : 42% 호랑이", with the 95% interval in small type), one verdict sentence, and per side the 끝까지 남은 / 이탈 / 전투 불능 breakdown (the #42 display). When at least 80% of the losing side fled (S), a one-line notice reads "무리의 사기가 한꺼번에 무너졌어요" with a Why? link, so a rout reads as a rout and not as a bug. Then the replay autoplays at auto speed (§4.4), with two buttons: 다시 (새 판) and 공유. A "왜 이런 결과? / Why?" link goes to Learn. Charts, interval detail, seed and sampling sit behind a "자세히 / Analysis" disclosure. |
| Hidden             | Runs (default unchanged at 500, revisited if a mid-range phone takes more than about 3 s to first result), arena, time limit, CV, sampling, morale, buff switches.                                                                                                                                                                                                                                                                                                                                                                                                                |

**Advanced mode** (inside `/play/`):

- **Free.** Today's free panel (`free-mode.ts`) plus a new **free trait table** over `FREE_PARAMS`:
  - 2 sides × (20 traits + 6 buff traits) + 5 globals = 57 rows (`src/sim/free/config.ts:320-345`).
  - Built like `paramRow` (`form.ts:689-766`) and constructed lazily (`form.ts:768-792`).
  - Free-mode sensitivity charts are post-1.0.
- **Classic (Lab).** Today's classic model, unchanged: 9 presets, the 22-row Advanced table, the tornado chart and the 14-step tour (`tour-model.ts:29-80`).

**How presets work** (`src/sim/free/presets.ts`, new, pure):

```ts
interface FreePreset {
  id: string; // stable, append-only
  name: { ko: string; en: string }; // common nouns only (§1.2)
  a: { sp: FreeSpeciesId; n: number };
  b: { sp: FreeSpeciesId; n: number };
  runs?: number;
  overrides?: Partial<FreeScalars>; // e.g. buff switches, only when documented in §6
  tags: (
    'popular' | 'documented' | 'close' | 'mirror' | 'army' | 'absurd' | 'thought-experiment'
  )[];
  why: { ko: string; en: string }; // shown under "Why?": literature or a described source, never a title or a view count (§1.2)
}
```

- A preset is shown only when both species exist.
- Every preset is unit-tested against `sanitizeFreeConfig` and the work budget (`free/config.ts:204-212`).
- For each preset, a fixture stores the measured free win share at the default seed, the median simulated duration, and the rout share of the losing side (fled ÷ (fled + incapacitated)). A model change then shows up as an explicit fixture diff.
- **Rout check.** A preset fails if its median duration is under 30 s or its rout share is over 90% (S), unless it carries a documented override. This runs on every preset, social or not.
- The `close` tag is assigned from the fixture (35–65%, S), never by hand.
- A test greps every `name` and `why` string against a list of banned titles and words (§1.2, §4.5).

**Link routing** (pure helper in `src/ui/share-free.ts`):

| Incoming                                                                                          | Opens in                                                 |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| v3 (`m:'free'`) with keys ⊆ {v, m, mv, a{sp, n}, b{sp, n}, runs, seed}                            | Simple                                                   |
| v3 with any of `p`, `bf`, `g`, buff or scalar edits                                               | Advanced → Free                                          |
| v3 with `live`                                                                                    | Play → Live battle, positioned at the first intervention |
| v3 `m:'cup'` (checked before `isFreePayload`, which requires `m:'free'`, `share-free.ts:129-136`) | Play → Cup                                               |
| v1/v2 (`#s=` without `m`), TVT2 codes                                                             | Advanced → Classic (unchanged, `app.ts:962-976`)         |
| TVT3 codes                                                                                        | Simple or Advanced, by the same rule                     |
| `/r/` v1 and v2 result links                                                                      | unchanged                                                |

**Tour.** A new `SIMPLE_TOUR_STEPS` (3–4 steps: pick, count, Run, Why?). The tour button stops forcing classic mode (`app.ts:1011-1015`). The classic tour stays in Lab.

### 3.3 Streamer mode

Two surfaces on the same origin, synchronized by a `BroadcastChannel('tvt-stream')`. This needs no backend and stays inside the `'self'` CSP.

- **`/studio/`**: control panel. It holds the authoritative session state (bracket, intervention log, beat, names, prediction controls, session log) and sends commands. **It runs no simulation.**
- **`/overlay/`**: clean 16:9 broadcast view, on a 1920×1080 logical canvas scaled to the source size. **It is the only document that computes**: it simulates deterministically from the config and log it receives, renders, and posts the results (win chance, what-if numbers, gate state) back to the studio. Traces never cross the channel. Details are in §10.7.

BroadcastChannel works only between pages in the **same browser instance**. A normal Chrome window cannot talk to an OBS browser source. So we document three setup routes and name one as the default:

| Route                                        | Control                                                    | Broadcast                                                                                               | Sync                                           | Status                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B. Browser plus window capture (default)** | `/studio/` in Chrome or Edge                               | `/overlay/` opened as a popup by the studio's "방송 화면 열기" button, captured with OBS Window Capture | BroadcastChannel inside one browser            | Expected to work. Two steps: open the studio and press the button, then add a Window Capture of the popup. Sound reaches OBS through its default desktop audio, or an Application Audio Capture source on Windows. `docs/STREAMING.md` covers the capture caveats (BitBlt, hardware acceleration). |
| C. Single window (fallback)                  | `/overlay/?controls=1`, with a control strip hidden by `H` | same window                                                                                             | none needed                                    | For streamers who want one window. The control strip is visible on stream while shown.                                                                                                                                                                                                             |
| A. OBS only (advanced)                       | `/studio/` as an OBS Custom Browser Dock                   | `/overlay/` as an OBS Browser Source (1920×1080)                                                        | BroadcastChannel inside OBS's embedded browser | Forum evidence only (2022). **Spike on OBS 30+ for Windows and macOS** (M4), including module workers and audio inside the OBS browser.                                                                                                                                                            |

Route B is the default because it needs no OBS dock setup and keeps the controls off the stream. The M4 spike confirms it, and the G1 (3) setup test measures it with a non-technical tester.

- **Platforms.** Setup is platform-agnostic: anything OBS can send to works. Pilots cover Chzzk and SOOP first, then YouTube (R12). For `/en/`, the kit covers Twitch and adds setup notes for TikTok LIVE and Kick after a short check of how each takes OBS output. 1.0 has no native prediction bridge for TikTok LIVE or Kick.
- **OBS detection.** If `window.obsstudio` exists, `/overlay/` defaults to a transparent background and hides controls, and the ad loader never runs on any page.
- **Backgrounds.** Dark (default), transparent (OBS's default CSS), chroma green.
- **"No banners" means no ads, consent or promotional banners.** Two pieces of text are required content and always appear:
  - **Educational disclaimer.** It is on the session intro card for 5 s, and then a small persistent tag sits in the bottom safe margin: "가상 시뮬레이션 · 실제 동물 싸움과 무관 / Simulation only, not real animal fighting".
  - **Thought-experiment note** for any _H. erectus_ match. It is on that match's intro and stays as a persistent tag while the match plays.
  - `H` cannot hide either one. The tags are 24 px or more on the 1080p canvas, deliberately below the 32 px body rule because they are small print, not body text. This keeps the broadcast in line with platform violent-content rules, such as Chzzk developer terms item 12(나), which a later chat app must meet.
- **Legibility** (estimates; verify on real phones watching a 1080p stream):
  - headlines and win percentages at 64 px or more on the 1080p canvas, body text at 32 px or more
  - 5% safe margins
  - a configurable facecam corner kept clear
  - team colours also told apart by glyph shape or pattern
  - at most 3 flashes per second, and a reduced-motion variant

---

## 4. Streamer session loop

### 4.1 Design principles (from §2.2)

1. **Sustained, visible suspense.** A live win-chance bar, close matchups, and an always-visible score strip.
2. **Freeze during viewer decisions, but never a dead screen.** Battles pause for predictions and card votes, with big countdowns sized for stream delay and the minimums of native tools. **No overlay screen goes more than 8 s without motion or a running countdown (S).** During freezes the glyphs keep an idle animation in their formation (breathing, small drift), and any number being computed animates while it fills.
3. **Short rounds** of about 2–2.5 min per match, with a 30–60 s climax that stands on its own as a clip.
4. **Rooting interest without money.** Predictions are for points only. Viewers' names go on entities.
5. **Every twist is honest.** The battle is re-simulated under the new rule, and the shown win-chance shift is computed, not scripted.

### 4.2 Flagship format: 동물 최강전 / Animal Cup

- **Brackets** (entries are species × count teams; curated only in 1.0, R7):
  - **16강 기본 / Standard 16**: 16 entrants, the default.
  - **8강 빠른 대진 / Quick 8**: 8 entrants, single elimination.
  - **Quick 8, best of 3**: 8 entrants, every round best of 3.
  - "Classic" is not used as a bracket name, because Classic is already the frozen engine and the Classic (Lab) mode, and every bracket runs on the free engine.
- **What decides a match** (owner decision **R7**):
  - (a) **One live battle decides**, so upsets are possible. The Monte Carlo batch supplies the pre-match "예상 승률" and the upset measure. **Recommended default.**
  - (b) The batch win share decides. Predictable, with fewer moments.
  - (c) The batch for early rounds and a live battle for the final.
  - (d) **Opinion pick**, the proven bracket style (§2.2): the streamer or chat picks the winner. The simulation shows the 예상 승률 before the pick, and after it plays a short live battle with one card as commentary. A running "crowd vs simulation" agreement score follows the whole bracket. The simulation never overrules the pick. **Recommended as a selectable format.**
  - (e) Opinion picks in early rounds, and a live battle from the semifinals.
- **Tiebreak for a live decider** that ends in a draw or at the time limit:
  1. The higher remaining-strength share (HP-weighted active strength, the same measure as the "전력 비율" fallback bar) wins.
  2. If the shares are within 1% (S), the match's pre-match batch win share decides.
  3. If that is exactly 50/50 (a mirror match), a coin flip seeded from `deriveSeed(cupSeed, matchIndex, TIEBREAK_SALT)` decides.
  4. The result shows "판정승 / win on decision". The tiebreak is deterministic, so it reproduces from the link.
- **Seeds and reproduction.** Each match uses `deriveSeed(cupSeed, matchIndex)`, and its live battle uses a run index drawn from that seed. **The whole bracket reproduces from its link**, because the cup payload carries every input that is not derived from the seed: each battle's intervention log, reroll counts, chat-picked counts and opinion picks (§10.3).

**Match beats** (default durations, all S):

| Beat                            | Duration                                  | Overlay shows (always moving)                                                                                                                                                                                                       | Streamer and chat                                                                           | Engine work (priority, §10.7)                                                                                                                          |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prediction (includes the intro) | 30 s default (range 30–60), battle frozen | First 10 s: matchup, counts, "예상 승률 27% : 73%", one fact line, "documented" or "never met" badge. A countdown runs throughout. Glyphs idle in formation. Labels "1 늑대 무리 · 2 불곰" (≤25 characters each, the Twitch limit). | Streamer opens a native poll or prediction with the copied labels, then locks               | Live battle simulated in the warm live worker (P0). Live-chance branches (P2). If live cards are gated off, pre-battle cards are offered here (§10.2). |
| Live, part 1                    | about 20–35 s                             | Battle at auto speed, win-chance bar, captions, slowdown at first contact                                                                                                                                                           | Commentary                                                                                  | Trace playback; next-match batch keeps running (P3)                                                                                                    |
| Variable card                   | 15–20 s pause ("타임!")                   | 3 cards. The what-if counter animates while it fills, then shows "이 변수를 넣으면 같은 대결 N판 기준: 34% → 58%". Glyphs idle.                                                                                                     | Streamer picks, or runs a native poll (Twitch polls need at least 15 s); 1 reroll per match | What-if batches (P1), re-simulation at T (P0), live chance after T (P2), all inside the pause budget (§10.2)                                           |
| Live, part 2                    | about 20–35 s                             | Continues under the new rule, with a swing marker on the win-chance timeline                                                                                                                                                        | –                                                                                           | Swapped trace                                                                                                                                          |
| Result                          | about 15 s                                | Winner; UPSET or COMEBACK banner; crowd-vs-simulation split (optional entry); 끝까지 남은 / still-standing names; 5 s highlight replay                                                                                              | Streamer resolves the native prediction                                                     | Next-match batch (P3)                                                                                                                                  |
| Recap                           | about 10 s                                | Animated bracket, score strip, next-match preview                                                                                                                                                                                   | `N` for next                                                                                | Next-match batch (P3)                                                                                                                                  |

Outside the battle, a match spends about 70–75 s (prediction 30, card 15–20, result 15, recap 10), against about 40–70 s of battle. Merging the intro into the prediction countdown saves 10 s compared with revision 1. About half of every match is therefore frozen. That is acceptable only because every frozen beat keeps something moving and none runs past 8 s without motion. G1 checks both the battle share and the longest static stretch from the session log.

The next-match batch runs at the lowest priority throughout the current match. It never competes with the card pause.

**Session time budget** (estimates; pilots measure the real numbers):

| Preset (R31)                  | Bracket                                                                                                                                                                      | Battles                                                                                                     | Estimate                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **기본 / Standard (default)** | Standard 16: R16 (8 matches, 1 card each), QF (4, 2 cards), SF (2, 2 cards, plus chat picks one side's count within a preset range), final best of 3 with a "final variable" | 16–17 at about 2.2 min = 35–37 min                                                                          | **about 39–41 min** with 2 min setup and a 2 min champion ceremony. The shortest path is about 39 min, so the 30-minute floor holds even then. |
| 짧게 / Short                  | Quick 8, single elimination, shorter beats                                                                                                                                   | 7 at about 1.6 min = about 11 min                                                                           | **about 15 min**                                                                                                                               |
| 길게 / Long                   | Standard 16, best of 3 from the quarterfinals                                                                                                                                | 22–29; expected about 25.5 (2.5 battles per series if each battle is a coin flip) at 2.2 min = about 56 min | **about 60 min**                                                                                                                               |
| Variant                       | Quick 8, best of 3 throughout                                                                                                                                                | 14–21; expected about 17.5 at about 1.4 min = 20–29 min, expected about 24.5 min                            | **about 25–33 min, expected about 28 min.** Below the 30-minute floor on average, so it is not a default.                                      |

- **Labels show the estimate** ("기본 · 약 40분"), not a promised length.
- **Event match.** Every 4th match is an event match with a guaranteed underdog-buff card. Counts are doubled only when neither side is a social species and the doubled match still passes the work budget and both live gates (R4).

**Live battle mode** (라이브 한 판): the same beats without a bracket, for short segments or sandbox play. The streamer picks any preset and applies cards at any pause. Recommended limit: a new card no sooner than 10 s of sim time after the previous one.

### 4.3 Variable cards

Cards are allow-listed game modifiers that map onto per-agent arrays in the free engine (§10.1). The intervention log stores the card's code, and the card catalogue (versioned by model version `mv`) defines what it does.

- **Realistic pack**: on by default.
- **What-if pack**: opt-in toggle, with every card visibly labelled "what-if" (owner decision **R8**).
- Magnitudes are **S** game assumptions, not biology, and the Learn pages say so.
- No card uses injury or death words.
- Cards may overlap freely. Durations are recomputed from base values on every change, so overlapping cards combine predictably (§10.1).

| #   | Card (ko / en)                 | Target   | Effect                                                                                    | Duration       | Shown only if   |
| --- | ------------------------------ | -------- | ----------------------------------------------------------------------------------------- | -------------- | --------------- |
| 1   | 폭우 / Downpour                | both     | speed ×0.8, accuracy ×0.85                                                                | rest of battle | –               |
| 2   | 한밤중 / Pitch dark            | both     | accuracy ×0.8                                                                             | rest           | –               |
| 3   | 진흙탕 / Mud field             | both     | speed ×0.7, turn ×0.8                                                                     | rest           | –               |
| 4   | 폭염 / Heatwave                | both     | stamina ×0.5 (instant drain)                                                              | instant        | –               |
| 5   | 숨 고르기 / Second wind        | one side | stamina refilled to max                                                                   | instant        | –               |
| 6   | 응원 함성 / Rallying cry       | one side | morale +0.2 (clamped)                                                                     | instant        | morale on       |
| 7   | 기세 꺾임 / Shaken             | one side | morale −0.2 (clamped)                                                                     | instant        | morale on       |
| 8   | 집중력 / Focus                 | one side | accuracy ×1.2, capped at `maxAccuracy`                                                    | 20 s           | –               |
| 9   | 괴력 / Power surge             | one side | strike damage ×1.3                                                                        | 20 s           | –               |
| 10  | 아드레날린 / Adrenaline        | one side | speed ×1.25                                                                               | 15 s           | –               |
| 11  | 재정비 / Regroup               | one side | +15% of max HP for active agents; never revives incapacitated ones                        | instant        | –               |
| 12  | 흥분 / Agitation               | one side | speed ×1.15, accuracy ×0.9 (a trade-off)                                                  | rest           | –               |
| 13  | 거대화 / Giant size (what-if)  | one side | HP and max HP ×1.5 (instant), damage ×1.5, speed ×0.85; glyphs drawn larger (render only) | rest           | what-if pack on |
| 14  | 꼬마화 / Pocket size (what-if) | one side | HP and max HP ×0.6 (instant), speed ×1.3                                                  | rest           | what-if pack on |
| –   | 증원 / Reinforcements +N       | one side | needs reserve slots (L)                                                                   | –              | **post-1.0**    |

- **Draw rule.** 3 cards per pause from the eligible set. Morale cards are excluded when morale is off, and one-side cards are offered for either side. The draw is seeded from `deriveSeed(cupSeed or matchSeed, matchIndex, pauseIndex, rerollCount)`, so the offered cards reproduce from the link.
- **One reroll per match.**
- **"Card swing" marker.** A pick that moves the what-if win share by 15 points or more (S) gets a marker.
- **When the live gates turn cards off** (large or long matchups, §10.2), the card beat moves into the prediction beat as **출전 전 변수 / pre-battle cards**. The pick applies at tick 0, before the live battle is simulated, and the overlay says why: "대결 규모가 커서 출전 전 변수만 씁니다". If even that does not fit, the match runs without cards and says so.

Engine mapping, op semantics and bounds are in [Appendix B](#appendix-b-variable-card-specification).

### 4.4 Pacing, upsets and comebacks

- **Auto speed.** The live battle's full trace is known before playback starts, because it is simulated first.
  - Playback speed is chosen so that the remaining sim time fits about 45–60 s of real time, clamped to 0.5×–16× (S).
  - It is recomputed after each card.
  - It slows to 0.5× for about 2 s at first contact and at the decisive moment: the last crossing of 50% on the win-chance timeline, or the final incapacitation. Both moments come from the derived event list (§10.8).
- **Card pause timing.** The pause is placed where the live win chance is closest to 50% within 25–60% of the battle's duration (S), to maximize suspense.
- **Banners** (thresholds S, tuned in pilots):
  - **UPSET**: the winner's pre-match win chance was under 30%.
  - **COMEBACK**: the eventual winner's live win chance dropped below 20% at some checkpoint.
  - **CARD SWING**: as defined in §4.3.
  - **PHOTO FINISH**: the remaining-strength shares at the end are within 10%.
- **Commentary captions.** Short, text-only, AdSense-safe lines triggered by derived events (§10.8): "포위 시작!", "기세가 꺾였다", "역전 각!".
  - The what-if pack adds absurd lines.
  - Captions are the cheapest carrier of the 병맛 tone. The 3D track's lesson, from a narrated puzzle game built from plain rectangles, is that personality came from narration, not from shapes.
  - Captions are rendered with `textContent` on the overlay DOM layer and follow the common-noun and neutral-word rules (§1.2).

### 4.5 Predictions and votes without a backend

- **Honor-system prompt** on the overlay: "채팅에 1 또는 2". The streamer presses `L` to lock.
- **Native tools.**
  - The studio shows labels of 25 characters or fewer, with copy buttons for a Twitch prediction (30–1800 s) or poll (15–1800 s), a Chzzk 승부예측, or a SOOP chat vote.
  - The prediction window is 30–60 s, default 30 s. That meets both Twitch minimums. Chzzk's streamer sets the close time, and we found no documented minimum for SOOP chat votes.
  - Chzzk's panel does not auto-refresh, so we recommend at least 30 s there.
- **Crowd split.** An optional entry ("시청자 예측 A 72%") lets the result card show "시청자 72%가 곰 예측 → 늑대 승".
- **Wording.** We say 예측 / 응원 / 예상 승률, and "win chance" in English. We never say 베팅, 배당, "odds", stakes or prizes (§1.2). Predictions are for points only.
- **No shared tally in 1.0.** A shared tally would need server state (ADR-0003). Chat-driven votes come with #118.

### 4.6 Viewer names on entities

The strongest hook that needs no chat API. Owner decision **R9**.

- The streamer pastes a name list. Weights are supported and labelled "가중치 / weights (`이름*2`)", without naming any other tool (§1.2).
- Names are assigned to pack members and drawn as small text labels near the glyphs, in 2D now and in a later 3D view under the same rule (§9).
- The 끝까지 남은 / still-standing names are announced at the result, with neutral wording.
- **Safety.**
  - A bundled ko/en blocklist plus the streamer's own words.
  - NFKC normalization; display capped at 12 characters.
  - A "hide names" toggle.
  - Names are stored only in the streamer's own `localStorage` (try/catch) and are **not** written into share links.
  - Names appear only on ad-free documents (`/studio/`, `/overlay/`, `/play/`).

### 4.7 Hotkeys, sound, resilience, clips

- **Hotkeys** (studio and focused overlay, shown on screen):

  | Key     | Action               |
  | ------- | -------------------- |
  | Space   | start / pause        |
  | 1, 2, 3 | pick a card          |
  | R       | reroll               |
  | L       | lock prediction      |
  | N       | next match           |
  | B       | bracket              |
  | H       | hide HUD or controls |
  | M       | mute                 |
  | F       | fullscreen           |
  - Keys are read by physical key (`KeyboardEvent.code`) while a Korean IME is active, the same rule the free replay follows since #120.
  - In streamer mode the replay's own key map (J/K/L, arrows, `[ ]`) is switched off, because `L` locks the prediction there.
  - No Ctrl or Alt combinations, to avoid clashing with OBS global hotkeys.
  - Touch targets of 44–48 px or more in the studio.

- **Sound** (owner decision **R11**).
  - At most 6 CC0 effects: round start, last-5-second tick, card reveal, card applied, upset, champion.
  - **SFX play in `/overlay/`**, the document that is captured. The studio plays nothing. No music. Master toggle and volume.
  - **Audio start per route.** Route C: the streamer's first click activates audio. Route B: the popup opens on a one-time "클릭해서 시작" start card, which the streamer clicks before going live, so the popup gets its own user activation. Route A: an OBS browser source cannot receive a gesture, so the M4 spike checks whether OBS's embedded browser plays audio without one.
  - **Permissions-Policy.** The default `/*` header keeps `autoplay=()`. The spike also tests whether that blocks Web Audio in `/overlay/`. If it does, `/overlay/*` gets a `_headers` rule that detaches `Permissions-Policy` and re-sends it without `autoplay=()`.
  - On by default in streamer mode and off elsewhere.
  - Every asset is recorded with source and licence in an asset manifest. Kenney packs are reported as CC0, but kenney.nl was not reachable during research, so each pack must be verified.
- **Resilience.**
  - The studio checkpoints the session state to `localStorage` after every beat (try/catch). The cup link is the recovery path.
  - After an overlay reload, the overlay asks the studio for a full state resend.
  - A network drop does not stop a loaded session, because the simulation is local and `/assets/*` is immutable-cached. Expected; tested in M4.
  - There is **no offline mode**: no service worker, so a reload while offline fails (§1.3). No login.
- **Late joiners.** A persistent mini-bracket and score strip, and a "so far" recap card between matches.
- **Clips and VODs.** The session log records wall-clock markers for upsets, card swings and finals, and beat start and end times (which G1 uses). "Copy as text" exports them for VOD editors. Also a champion result card (existing canvas card infrastructure) and a bracket share link. A 9:16 overlay layout for short clips follows in 1.1 (§7.6).

---

## 5. New animals roadmap

### 5.1 Principles

- **Demand decides the order.** It is weighed across battle-specific sources: the YouGov poll, a 2004 documentary series, a children's book series, Reddit, YouTube and workshop counts. Recent activity is weighted over lifetime views.
- **Feasibility decides the batch, not the order.** It is judged by data quality and by whether the free engine can express the animal without new mechanics. A high-demand animal with missing data gets its source sheet researched. It is not overtaken by a low-demand animal whose table happens to exist.
- **Rules** (§1.2): abstract glyph, adSafe, wild species, neutral naming. What-if species carry a visible tag.

### 5.2 Ranked batches

**Batch A: required for 1.0.** Demand score 4–5 (animals track, §A). Each needs the free-model completion (§5.3), and hippo and rhino also need new source sheets.

| Animal (ko / en)                                                                       | Demand evidence (internal)                                                                                                                           | Data state                                                                      | Engine needs                                 | Notes                                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 하마 / Hippopotamus                                                                    | 5. YouGov 69% (#5); the most comments per post on r/whowouldwin (39 titles); pairs with elephant, polar bear and rhino; a documentary-series episode | Mass L; gait L (Hutchinson & Pringle 2024); top speed **U**; bite **U**         | none (heavy, high `hide`)                    | New source sheet (M). U values become S with sensitivity ranges. Presets #15, #16.                                |
| 흰코뿔소 / White rhinoceros                                                            | 5. YouGov 74% (joint #1); a documentary-series episode against elephant; Reddit pairings with elephant 5 and hippo 4                                 | Mass L; speed **U**; horn force S                                               | none (heavy)                                 | New source sheet (M). Horn appears only as anatomy. Presets #14, #15.                                             |
| 북극곰 / Polar bear                                                                    | 5. YouGov 64% (tied with gorilla); a documentary-series episode against walrus; enWP 930k                                                            | `docs/research/SPECIES.md` §5.5 (mass, speed L; bite S)                         | none                                         | Preset #17. YouGov "paradox": grizzly 73% vs polar bear 64%.                                                      |
| 스피노사우루스 / _Spinosaurus_ (land duel)                                             | 5. A film clip at 57.7M views (2013 upload); 3.0× pageview spike in Jul 2025; Reddit pairing with T. rex 3                                           | §5.8 (Sereno 2022 mass 7,390 kg L; Sakamoto 2022 bite 4.8 / 11.9 kN L; speed S) | none in free mode (heavy vs heavy is solved) | Label "semi-aquatic; land duel". Preset #12.                                                                      |
| 랩터 무리 / Raptor pack (_Utahraptor_ default; _Velociraptor_, _Deinonychus_ variants) | 4. Dinosaur favourite at 5–7% (inside the margin of error); a children's book title against T. rex                                                   | §5.15 (mass L; Sellers & Manning 2007 speed L; bite L/D)                        | social pack                                  | Cooperative hunting is contested, so the buff defaults need an S note. Must pass the rout check (R4). Preset #18. |

**Batch A′: 1.0 if time allows, otherwise the first release after 1.0.**

| Animal                       | Demand evidence (internal)                                                                                                                | Data state              | Role  | Notes                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----- | ------------------------------------------------- |
| 트리케라톱스 / _Triceratops_ | 5. UK favourite #3 (11%); documented healed T. rex bite on a horn ([NHM](https://www.nhm.ac.uk/discover/dino-directory/triceratops.html)) | Mass L; speed S; horn S | heavy | New source sheet. "Documented" badge. Preset #13. |

**Batch B: after 1.0, in cadence order (§5.3).**

| Animal                              | Demand evidence (internal)                                                                    | Data state                                                 | Role                                                     | Notes                                                                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기가노토사우루스 / _Giganotosaurus_ | 3. A Korean kids' video at 5.29M; enWP 311k                                                   | §5.6 (mass L; turn D; bite D)                              | heavy                                                    | Cheap. Preset #23.                                                                                                                                                                                         |
| 카피바라 / Capybara (what-if tier)  | 4 (interest 5, fights 1). #1 in Wikipedia views in both languages; 1 fight title on Reddit    | Mass L; others S/U                                         | calm herd (decide; social would invite the rout cascade) | Owner decision **R15**. Preset #19.                                                                                                                                                                        |
| 고릴라 / Gorilla                    | 5 on interest, falling. YouGov 64%; Reddit #2 pairing (gorilla and grizzly); short 2025 spike | Mass L; bite **U** ("3,420 N", no study found); strength U | heavy (silverback)                                       | Owner decision **R14**, after hippo and rhino. Neutral naming, no meme preset. Update the two tests that use `'gorilla'` as an invalid id. Revisit the exclusion text in `docs/SPECIES.md` §9. Preset #22. |

**Batch C: 1.x.** Needs new mechanics or more research.

- _Stegosaurus_ together with _Allosaurus_ (table in §5.7). _Allosaurus_ waits so its first preset can be the documented pairing (Carpenter et al. 2005), which keeps the "at least one preset" rule. _Stegosaurus_ needs a rear-arc tail weapon.
- _Ankylosaurus_: rear-arc tail weapon. The data includes Arbour 2009's club force (about 14.4 kN for _Euoplocephalus_, read via press only).
- Komodo dragon: needs M7 hit-and-run plus venom as bleed (§5.16).
- Saltwater or Nile crocodile: needs M8 grab-and-hold and M9 water edge (§5.9). Bite 16,414 N measured (Erickson 2012).
- Honey badger: underdog; mostly U data.
- _Tarbosaurus_: derived from the T. rex template. A Korean kids' video has 9.5M views.
- Sauropod: huge HP; "1 vs 500 raptors".
- _Smilodon_, dire wolf, jaguar, leopard.
- Cheetah: speed L (Wilson 2013 peak 25.9 m/s).
- Moose and American bison: documented, with wolf group-size data from MacNulty 2014.
- Emperor penguin (what-if).
- Cheap variants: a Kodiak variant of the brown bear. Before adding an "Amur" tiger variant, check whether the current tiger parameters already reflect Amur tigers; `docs/SPECIES.md` documents the Amur tiger–brown bear records.

**Batch D: later, or out.**

- Walrus (documented against polar bear), red kangaroo, cassowary or ostrich, _Therizinosaurus_.
- _Quetzalcoatlus_: as a ground stalker only.
- Anaconda or _Titanoboa_: needs constriction (M8).
- Chimpanzee: owner decision **R19**, because of human-vs-chimp framing.
- Canada goose: what-if, R15.
- Insect micro-arena: out of scope.
- Marine species: an ocean skin for marine vs marine only, after 1.0 (R17).

**Permanently excluded.**

- Domestic animals, pets and livestock, under the owner rule in `docs/SPECIES.md` §9. Dog-vs-dog or rooster matchups are also where the animal-cruelty policy risk is real.
- _Homo sapiens_.
- Named individuals or zoo animals.
- Trademarked monsters and names.

### 5.3 Add-a-species pipeline (definition of done)

1. **Demand check.** Commit **API-based pulls only** under `scripts/demand/`, with keys read from the environment and never committed:
   - Wikimedia REST pageviews (en, ko)
   - Arctic Shift keyword counts (public API; check its terms before committing)
   - YouTube Data API `search.list` (the default allocation is 100 `search.list` calls a day)
   - workshop ranks through the Steam Web API (`IPublishedFileService/QueryFiles`), or not at all

   The research run's HTML scrapers (`yt_search.py`, `play_app.py`, `steam_thread.py`) are **not** committed. YouTube's terms ban access "using any automated means", as the chat track itself cites, and store pages carry similar terms. Re-run every quarter and write a summary table to `docs/research/DEMAND.md`.

2. **Source sheet.** Add an entry to `docs/research/SPECIES.md` covering every free-model input:
   - the 20 traits, plus 6 buff traits if social
   - legacy-role parameters, while the free registry still derives from them
   - hide and intimidation constants
   - every value tagged L / D / S / U, with a sensitivity range for each S
   - the "Why?" facts for its presets, written as literature citations or described sources (§1.2)
3. **Content check.**
   - `adSafe`
   - era label
   - overlap label: "never met", "no recorded overlap" or documented, with sources
   - "what-if" tag for absurd species
   - the thought-experiment note for any hominin
4. **Plumbing.**
   - Append the id to `FREE_SPECIES_IDS`. Ids are append-only and never renamed.
   - ko and en names, counter word, text-share symbol entry (`src/share/result-text.ts:23-39`), glyph radius from mass.
   - This needs the free-only species plumbing (M1) first.
5. **Calibration.**
   - A mirror match (the species against itself) is 50/50 within the CI.
   - Win share is monotonic in count.
   - Documented interactions match the qualitative literature.
   - Social species pass the rout check (§3.2).
   - Results are recorded in the preset fixture.
6. **Tests.**
   - Registry and sanitize tests.
   - All existing goldens bit-identical: a new species must not change any existing config's result.
   - Preset tests, including the banned-words check.
7. **Docs and release.** `docs/SPECIES.md`, the `/species/` section in ko and en, and a patch-notes bullet.
8. **Presets.** Ship at least one preset per species. It appears in Simple mode as soon as the species ships.

**Cadence after 1.0** (minimum; the owner confirms in **R34**): **at least one new species every month**, each shipped in a minor release with a patch-notes entry and a "new" badge. While ready source sheets remain, the target is two a month. The order follows the ranked queue in §5.2, re-ranked each quarter from the demand refresh. Post-1.0 releases already happen per merged batch, so this needs no new release process.

---

## 6. Simple-mode preset list

Names are common nouns. The **"Why?" column is the text shown to users** (`FreePreset.why`). It cites the literature or describes a source and never names a title or a view count (§1.2). The **demand note is internal** and never shipped. Counts for presets that are not ready yet are proposals, to be tuned towards "close" where the matchup allows. Classic win shares are from `docs/STREAMING.md` (seed 20261019, classic engine). Free-engine shares will differ and go into the preset fixture.

| #   | Preset (ko / en)                                                   | Sides                  | Tags                         | Status                                          | Why? (shown; final copy written from the source sheets)                                                                                    | Demand note (internal)                                          |
| --- | ------------------------------------------------------------------ | ---------------------- | ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | 사자 vs 호랑이 / Lion vs tiger                                     | 1 v 1                  | popular                      | ready                                           | Asiatic lions and Bengal tigers once shared parts of India                                                                                 | Reddit top pairing (9); a documentary-series episode            |
| 2   | 사자 무리 vs 호랑이 다섯 / Pride vs five tigers                    | 5 v 5                  | popular, shows the pack buff | ready after rout check                          | Lions live in prides, tigers alone; the group bonus shows the difference                                                                   | –                                                               |
| 3   | 호랑이 vs 곰 / Tiger vs bear                                       | 1 tiger v 1 brown bear | documented                   | ready                                           | Amur tiger and brown bear encounters are recorded (`docs/SPECIES.md`)                                                                      | Korean folk-tale pair; a documentary-series episode             |
| 4   | 불곰 vs 늑대 무리 / Bear vs wolf pack                              | 1 v 8                  | close, documented            | ready                                           | Recorded encounters (`docs/SPECIES.md` §5)                                                                                                 | classic: bear 57.6%                                             |
| 5   | 물소 vs 사자 무리 / Buffalo vs pride                               | 1 v 6                  | close                        | ready                                           | Lion prides hunt African buffalo (`docs/SPECIES.md` §5)                                                                                    | classic: lions 58.9%                                            |
| 6   | 코끼리 가족 vs 사자 무리 / Elephant family vs pride                | 5 v 30                 | documented                   | ready after rout check                          | Savuti records (Joubert 2006; Power & Compion 2009)                                                                                        | –                                                               |
| 7   | 매머드 vs 늑대 무리 / Mammoth vs wolves                            | 1 v 12                 | ice age                      | ready                                           | Woolly mammoths and grey wolves lived on the same Ice Age steppe; a thought experiment, not a recorded fight                               | classic preset                                                  |
| 8   | 티라노 거울전 / T. rex mirror match                                | 1 v 1                  | mirror                       | ready                                           | The same species on both sides: 50/50 by symmetry                                                                                          | a pure guessing game for chat                                   |
| 9   | 티라노 부대 vs 호랑이 군단 / T. rex squad vs tiger horde           | 10 v 100               | army                         | ready                                           | Never met (about 66 million years apart); tigers live alone, so no group rout                                                              | today's default flagship                                        |
| 10  | 티라노 vs 호모 에렉투스 100 / T. rex vs 100 _H. erectus_           | 1 v 100                | thought experiment           | ready after rout check (_H. erectus_ is social) | Thought experiment (`docs/SPECIES.md` §9); the note is always shown                                                                        | existing preset                                                 |
| 11  | 사자 vs 하이에나 / Lions vs hyenas                                 | 3 v 10 (proposal)      | rivals                       | ready after R4 and rout check                   | Lions and spotted hyenas compete for food where their ranges meet                                                                          | keep the groups small until the rout decision                   |
| 12  | 티라노 vs 스피노 (육상 대결) / T. rex vs _Spinosaurus_ (land duel) | 1 v 1                  | popular                      | needs _Spinosaurus_ (A)                         | Never met (about 30 million years and an ocean apart); a land duel because _Spinosaurus_ waded and walked on two legs (Sereno et al. 2022) | a film clip, 57.7M views; Reddit 3                              |
| 13  | 티라노 vs 트리케라톱스 / T. rex vs _Triceratops_                   | 1 v 1                  | documented                   | needs _Triceratops_ (A′)                        | A _Triceratops_ horn with a healed T. rex bite (Happ 2008)                                                                                 | UK favourite #3                                                 |
| 14  | 코끼리 vs 코뿔소 / Elephant vs rhino                               | 1 v 1                  | popular, documented          | needs rhino (A)                                 | Young bull elephants attacked white rhinos in a South African reserve (Slotow et al. 2000)                                                 | YouGov joint #1 (74/74); a documentary-series episode; Reddit 5 |
| 15  | 하마 vs 코뿔소 / Hippo vs rhino                                    | 1 v 1                  | popular                      | needs both (A)                                  | Written from the hippo and rhino source sheets                                                                                             | Reddit 4; both in the YouGov top five; a children's book title  |
| 16  | 코끼리 vs 하마 / Elephant vs hippo                                 | 1 v 1                  | popular                      | needs hippo (A)                                 | Written from the hippo source sheet                                                                                                        | Reddit 5                                                        |
| 17  | 북극곰 vs 불곰 / Polar bear vs brown bear                          | 1 v 1                  | popular                      | needs polar bear (A)                            | Their ranges meet in the Arctic, where hybrid bears have been recorded                                                                     | YouGov grizzly 73 vs polar bear 64                              |
| 18  | 랩터 무리 vs 티라노 / Raptor pack vs T. rex                        | 12 v 1 (proposal)      | popular                      | needs raptors (A); rout check                   | Never met (_Utahraptor_ about 126 million years ago, T. rex about 67); speed from Sellers & Manning 2007                                   | favourite 5–7%; a children's book title                         |
| 19  | 티라노 vs 카피바라 천 마리 / T. rex vs a thousand capybaras        | 1 v 1,000              | absurd                       | needs capybara (B, R15)                         | What-if: never met; shown with the what-if tag                                                                                             | giant-vs-many format (13.1M and 18.8M views, 2017)              |
| 20  | 북극곰 vs 펭귄 이천 마리 / Polar bear vs two thousand penguins     | 1 v 2,000              | absurd                       | needs polar bear and penguin (C)                | What-if: never met; polar bears live in the Arctic, emperor penguins in the Antarctic                                                      | a man-vs-10,000-penguins game video, 18.8M views                |
| 21  | 벌꿀오소리 vs 사자 셋 / Honey badger vs three lions                | 1 v 3                  | underdog                     | needs honey badger (C)                          | Written from the source sheet; most values are unverified and labelled                                                                     | a 10.3M clip; a 108M meme video                                 |
| 22  | 고릴라 vs 불곰 / Gorilla vs brown bear                             | 1 v 1                  | popular                      | needs gorilla (B, R14)                          | Never met (central Africa vs the northern continents)                                                                                      | Reddit #2 pairing (6); neutral name, no meme framing            |
| 23  | 티라노 vs 기가노토사우루스 / T. rex vs _Giganotosaurus_            | 1 v 1                  | popular                      | needs _Giganotosaurus_ (B)                      | Never met (South America about 98 million years ago, North America about 67)                                                               | a Korean kids' video, 5.29M views                               |

- **Every preset passes the automated rout check** in the fixture (§3.2) before it ships. The table marks the presets with large social groups that are most likely to trip it: #2, #6, #10, #11 and #18.
- M2 ships the presets among 1–10 that pass the check, and #11 after R4. Batch A adds #12 and #14–#18.
- Not recommended: a "1 gorilla vs 100 _H. erectus_" preset. The meme it remixes started with a racial slur, and the framing is human against animal.
- **Cup presets**: "16강 기본 / Standard 16" and "Quick 8" are built from ready species × counts. In a single-elimination bracket any two entries can meet in some round, so **all pairs** are tested (120 for 16 entries, 28 for 8). Each pair must pass:
  - the re-simulation gate and the card-pause budget on the reference streamer profile (§10.2)
  - the rout check
  - the first-round pairs only: no match more lopsided than 90/10 at the batch level (S)

---

## 7. Ads, promotion and measurement

### 7.1 Readiness checklist (in order)

**0. Root approval: blog and account (owner work, on the critical path for ads).** Google reviews `vinylims.com`, and this site can serve ads only after the root is approved (§2.4). An earlier application was rejected for "low value content" (`vinylog/docs/ADSENSE_AUDIT.md`, 2026-07-27, tracking issue vinylog #64). Root approval is not a 1.0 gate for this site, but no ad serves until the following land.

- **Blog content (owner).**
  - [ ] Posting cadence: steady publishing over 6–8 weeks, at most 2 posts a day (vinylog #74, open; the vinylog-vault content gate in `CLAUDE.md` §0.4 and `docs/CONTENT_GUIDELINES.md`, measured by `docs/check-post.py`).
  - [ ] Originality: an honest `aiAssisted` flag on every post, and human-written substance. The audit measured 80% self-declared AI-generated posts (decision record in vinylog #72; disclosure moved to a post footer and its own page in vinylog #99).
  - [ ] Category balance: the audit measured 80% Horror. DevTech posts were added since, so re-measure.
  - [ ] Truncated posts set to draft, and company or environment identifiers replaced with common nouns (vinylog-vault #54 / PR #55, open; following #52).
- **Blog engine.**
  - [ ] Placeholder ad slots `HOME_FEED_1/2` (`vinylog/src/pages/index.astro:62-63`) and `POST_HEADER/FOOTER` render nothing until real slot ids exist. The same issue covers the mobile layout regression, the empty-site build and duplicate H1s (vinylog #129 / PR #130, open; supersedes #65).
  - [ ] The CSP report-only host list is complete (vinylog #80, open).
  - [x] Contact page (vinylog #67) and static category routes (vinylog #69): done.
  - [ ] No structural changes to the blog while the review is pending (vinylog #129).
- **AdSense account.** These settings are shared with the blog.
  - [ ] Sites: `vinylims.com` shows **Ready**. It has shown Getting ready since 2026-10-20. Do not remove and resubmit the site.
  - [ ] Auto ads:
    - Ad intents **off**. They break without a nonce and inject links.
    - "Allow additional triggers for vignette ads" **off**, or vignettes off entirely.
    - Side rails decided.
    - Conservative frequency.
  - [ ] Blocking controls: sensitive categories such as gambling and dating (R22).
  - [ ] Privacy & messaging: a European regulations message with affirmative consent text, tested with `?fc=alwaysshow`. No ad-blocking recovery and no Offerwall.

**1. Content and IA** (G1, extended)

- [ ] `/learn/` hub, `/species/`, the P8 free-model content, and a play-first intro on `/`, all in ko and en.
- [ ] The play, studio and overlay documents never include the loader (§3.1).
- [ ] The streamer kit `/stream/` never mentions ads and never asks anyone to click or view them.

**2. Privacy page** (G3), before any ad code

- [ ] Google's three required statements, plus the Ads Settings and aboutads.info links ([required content](https://support.google.com/adsense/answer/1348695)).
- [ ] The PIPA behavioural-data block: processed without identification, items, method, purpose, retention, and how to refuse, with current Chrome, Edge, Safari and Firefox steps.
- [ ] A statement that Google LLC collects data through automatic devices.
- [ ] A **개인정보 보호책임자** (privacy officer) role or name with an email (R23; release checklist item 9).
- [ ] A "Privacy and cookie settings" `<button>` calling `googlefc.showRevocationMessage` from the bundle.
- [ ] A new effective date, and removal of every "no ads / no tracking" claim, including the footer.

**3. CSP** (G4), deployed **without ads** for at least one release, with the full-battle canary green on that release (§7.2).

**4. Loader and canary**

- [ ] The ad loader runs only when all of these hold:
  - production hostname
  - ad-eligible route
  - no `window.obsstudio`
  - not a stream document
  - `freeMatchupAdSafe(config)` and `matchupAdSafe` are true
- [ ] CI canary:
  - serves `dist` with the real `_headers`
  - loads `adsbygoogle.js` with Google's example client (`ca-pub-1234`, `data-adtest="on"`), never the owner's publisher ID
  - **on ad-free routes, runs a full battle under the new default CSP**: Simple battle to completion (worker spawn, worker chunk imports, aggregation, replay playback), and a Live battle with one card (trace swap)
  - fails on any `securitypolicyviolation`
  - runs in Chromium, Firefox and WebKit, weekly and on every PR that touches `_headers`, the loader, workers or the build

**5. Ads PR**

- [ ] Reserved fixed-size slots, so CLS stays at zero.
- [ ] `data-google-vignette="false"` on Run, Next, Rematch and stream links. This stops only link-click vignettes, which is why the additional triggers must be off as well.
- [ ] No refresh on Run.
- [ ] On ad routes only: remove `autoplay=()` from Permissions-Policy so video creatives can play.

**6. After 1.0**

- [ ] Apply for H5 Games Ads. Use `adBreak('next')` only between cup rounds outside stream mode. Rewarded ads only for optional bonuses, with explicit opt-in (R27).

### 7.2 CSP and Trusted Types changes

Recommended: **option A**, a static hash-based strict CSP (owner decision **R21**).

1. **Build.**
   - Replace the parser-inserted `<script type="module" src>` on every built HTML entry with one identical inline loader. Today that is 21 entries across ko and en, and the new pages add more.
   - The loader reads the entry URL from `<meta name="app-entry">` and creates it through a narrow `app-loader` Trusted Types policy.
   - Set `build.modulePreload: false` and verify.
   - Inject the loader's `'sha256-…'` into `dist/_headers`.
   - Keep `RESULT_HEADERS` in `src/share/result-function.ts` in step; a test already enforces equality with `_headers`.
   - Add a test that the hash matches every `dist/**/*.html`.
2. **Default (`/*`, ad-free).** This policy replaces today's `script-src 'self'` line everywhere, including the line the chat track drafted for its chat route (§8, Appendix A).

   ```
   Content-Security-Policy: default-src 'self'; script-src 'sha256-LOADER' 'strict-dynamic'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types app-loader sim-worker
   ```

   **Workers.** `/*` also matches `/assets/*.js`, so worker script responses carry this policy as the worker's own CSP. A module worker importing its own chunks under `script-src 'sha256-LOADER' 'strict-dynamic'` was not clearly covered by the ads track's harness, whose worker test used one file. The full-battle canary decides. If chunk imports are refused, add an `/assets/*` rule that detaches the CSP and sends `default-src 'self'; script-src 'self'; worker-src 'self'; object-src 'none'; require-trusted-types-for 'script'; trusted-types sim-worker` for asset responses. Documents never load from `/assets/`, so that rule only reaches workers.

3. **Ad routes** (Phase 1: `/learn/`, `/guide/`, `/model/`, `/parameters/`, `/species/`, `/patch-notes/`, ko and en; Phase 2 adds `/`).
   - Detach the inherited header first. A second CSP header would be comma-joined, and both policies would be enforced.

   ```
   ! Content-Security-Policy
   Content-Security-Policy: script-src 'sha256-LOADER' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https: http:; object-src 'none'; base-uri 'self'; worker-src 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types app-loader sim-worker ads-loader goog#html 'allow-duplicates'
   ```

   - Ads need third-party frames, beacons and inline style attributes, which is why there is no `default-src`.
   - The `goog#html` allowlist largely neutralizes Trusted Types on these pages. That is acceptable only because ad routes are content pages; play, studio and overlay keep the strict default.
   - Option A′ (Trusted Types report-only on ad routes) is the fallback if the canary breaks.
   - Option B (a per-request nonce through a Pages Function) is rejected. It spends the shared 100k/day Workers quota, and when the quota runs out it fails open with a placeholder nonce.

4. **`/overlay/*` Permissions-Policy**, only if the M4 spike shows that `autoplay=()` blocks its sound effects (§4.7): detach and re-send the default list without `autoplay=()`.
5. Verify on a preview with `curl -I` that exactly one CSP header is present per route. Keep every line under Cloudflare's 2,000-character limit.
6. Unchanged: `Referrer-Policy: strict-origin-when-cross-origin`, COOP `same-origin`, no COEP.

### 7.3 Placement by page type

| Page or state                                                     | Ad tag           | Units                                                                                      | Notes                                                                                                |
| ----------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Learn pages (hub, guide, model, parameters, species, patch notes) | yes, Phase 1     | in-article after section 2; end of page                                                    | Main approval and revenue surface                                                                    |
| Lobby `/`                                                         | yes, Phase 2     | 1 responsive unit below the fold on mobile, at least 150 px from presets, Run and Advanced | No anchors that could cover Run                                                                      |
| Streamer kit `/stream/`                                           | Phase 2 eligible | 1 at end                                                                                   | The loader skips in OBS                                                                              |
| `/play/` (battle, results, Advanced, Live, Cup)                   | **never**        | –                                                                                          | Game window and continuous interaction; viewer names                                                 |
| `/studio/`, `/overlay/`, any `window.obsstudio` page              | **never**        | –                                                                                          | Software-application and out-of-context rules; YouTube's third-party-ad rule; user-generated content |
| `/r/*`                                                            | **never**        | –                                                                                          | Auto-generated content                                                                               |
| privacy, license, 404, reset, tours, modals, progress             | **never**        | –                                                                                          | Dead-end or behavioural screens                                                                      |

Unit labels read "광고 / Advertisement" only.

### 7.4 Policy risks and mitigations

| Risk                                                                                                                                                     | Mitigation                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root approval fails again on blog quality ("low value content")                                                                                          | Blog remediation before resubmission (§7.1 step 0): vinylog #64, #74, #129/#130, #80; vinylog-vault #54/#55; the vault content gate                                                                           |
| Ads shown in an OBS source or on stream (software-application and out-of-context rules; streamer platform rules)                                         | The tag is never loaded on play, studio or overlay; the `window.obsstudio` gate; leaving stream mode navigates to a different document rather than hiding units with CSS (hiding counts as code modification) |
| Asking anyone to click or view ads ([policy](https://support.google.com/adsense/answer/48182))                                                           | No such copy anywhere, including the streamer kit and partner outreach; the owner never clicks their own ads                                                                                                  |
| Animal cruelty "for entertainment" ([publisher policy](https://support.google.com/publisherpolicies/answer/10502938)) as the site becomes more game-like | Disclaimer on every play surface, including the overlay; abstract glyphs; no gore words; slapstick only in the what-if pack; Learn content stays substantive; copy review before applying                     |
| Gambling ([restriction](https://support.google.com/publisherpolicies/answer/10437963)); Chzzk and SOOP terms also bar gambling apps                      | Points-only predictions; no betting words, in English or Korean (§1.2); no donation-linked outcomes                                                                                                           |
| Auto-refresh or pre-roll in an auto-advancing 40-minute cup                                                                                              | No ads inside the cup at all; H5 `adBreak` only if approved, and never in stream mode                                                                                                                         |
| User-generated content (names, later chat)                                                                                                               | Only on ad-free documents                                                                                                                                                                                     |
| Chzzk item 13 and SOOP article 17-5 (ads in API apps)                                                                                                    | Chat only on an ad-free route, with written confirmation (#118)                                                                                                                                               |
| Child-directed treatment                                                                                                                                 | Position the site as general audience, teens and up (R24)                                                                                                                                                     |
| PIPA disclosure gaps                                                                                                                                     | §7.1 step 2 before any ad code                                                                                                                                                                                |
| GRAC rating classification for an ad-monetized web game                                                                                                  | Legal advice before 1.0 (R25; release checklist item 10)                                                                                                                                                      |
| A subdomain policy strike affects the blog (shared domain)                                                                                               | Framing rules; review mode before launch                                                                                                                                                                      |

### 7.5 Revenue expectation (low confidence)

| Monthly ad page views | at $0.3 RPM | at $1.55 RPM (Google calculator, APAC Games) |
| --------------------- | ----------- | -------------------------------------------- |
| 30,000                | $9          | $47                                          |
| 100,000               | $30         | $155                                         |
| 300,000               | $90         | $465                                         |

Sources: Google's [calculator data](https://adsense.google.com/start/calculator-data.json), and a Korean game blog reporting a page RPM of 0.2–1.3.

Streamers are an awareness channel, not inventory. The end card shows a QR code or short URL ("직접 해보기") with no click incentive.

Complementary options (R26):

- donation links placed away from ad units
- affiliate links with the KFTC disclosure at the top
- non-exclusive CrazyGames distribution
- **not** Poki, which requires web exclusivity

### 7.6 Promotion plan

The brief says the site will be promoted on the web. Ads pay per page view, so being found matters as much as being approved.

- **Search registration** (owner; the steps are already written in `docs/SEO.md`, owner actions; status unknown, to be confirmed):
  - Google Search Console: Domain property `vinylims.com`, sitemap submitted.
  - **Naver Search Advisor** (Korean search runs largely through Naver, and Naver indexes the static HTML first): site verification through the existing `SITE_VERIFICATION` meta support, sitemap submitted.
  - **Daum** webmaster registration (the `robots.txt` Daum line exists).
  - Bing Webmaster Tools; IndexNow on each release (already scripted in `docs/SEO.md`).
  - The prerendered `/learn/` and `/species/` pages are the main search surface.
- **Share cards.** Today `/r/` rewrites the title and description, while `og:image` stays one static card (`src/share/result-function.ts:50`).
  - Add a 1200×630 image **per Simple preset**, generated at build time. That may use a devDependency, which ADR-0004 allows since it covers runtime dependencies only. Preset links point at their own image.
  - Add one image per species pair on `/r/` if the size budget allows; otherwise one per species. The Function picks it from the payload.
  - Check with the Kakao and Facebook share debuggers (`docs/SEO.md`).
- **Short clips.**
  - 1.0: the 5 s highlight, session-log markers with VOD timestamps, the champion card, and the bracket link.
  - 1.1: a `?layout=vertical` overlay (1080×1920 logical canvas, same HUD re-laid out) for Shorts and Reels.
  - The owner records the R12 dry-run sessions and cuts short clips from them, so promotion does not wait on outside streamers.
- **Launch and community** (after M8):
  - Patch notes plus the `/stream/` kit, with the "free to use on stream and in monetized VODs" policy and share images.
  - Personal outreach to 10–20 mid-size Talk streamers on Chzzk and SOOP after the pilots, with the one-page kit. English: YouTube and Twitch, plus TikTok LIVE and Kick setup notes.
  - Posts in game and streaming community boards that allow them, following each board's self-promotion rules.
  - A post on the blog about building the simulator. It follows the vault content gate and counts towards the blog's cadence.
- **Never**: paid traffic, incentivized visits, or any request to click or view ads (§7.4).

### 7.7 Success measurement (owner decision R33)

The site has no analytics today, and any analytics beacon means a CSP change (`script-src`, `connect-src`) plus a privacy-page change.

- **(a) No client analytics in 1.0 (recommended).** Measure with what exists:
  - Search Console and Naver impressions and clicks
  - Cloudflare dashboard request counts, including `/r/` Function requests (share-link opens), which need no client code
  - AdSense page views once ads serve
  - pilot and dry-run session logs (session length, longest static stretch, battle share)
- **(b) Cloudflare Web Analytics beacon** after G4, with a CSP change for its hosts and a privacy-page clause. The blog already loads it (vinylog #129, item 4).
- **(c) A self-hosted counter Function.** It spends the shared Workers quota and moves towards server state (ADR-0003).

Whichever option is chosen, the owner sets targets for: monthly share-link opens, monthly search clicks (Google and Naver), streamer sessions observed, and session length in logged sessions.

---

## 8. Live chat integration

**Status.** Tracked in **#118** (open). 1.0 does **not** depend on it (owner decision **R29**).

**What 1.0 builds for it.** A `TwistSource` interface. Everything that triggers a card goes through it:

- studio clicks
- hotkeys
- "tap the winner of the platform poll"

It feeds a `RoundAggregator`, which calls `applyCard()`. That appends `{tick, card, side}` to the studio's log and sends it to the overlay (§10.7). Chat adapters plug in later without UI changes.

**Summary of the research** (details in the issue):

| Platform | Browser-only                                                                           | Backend                                  | Main risk                                                                                  |
| -------- | -------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Twitch   | yes: anonymous IRC (undocumented, verified live) or implicit-grant OAuth with EventSub | none                                     | mainly the `/en/` audience; chat data must never reach ad networks                         |
| YouTube  | yes: referrer-restricted API key                                                       | none (optional key proxy)                | 10,000 units/day, about 2.8 streamer-hours/day at 5 s polling; a browser key can be copied |
| Chzzk    | no: CORS 403, client secret                                                            | stateless Pages Functions `/api/chzzk/*` | **developer terms item 13 forbid ads in apps using the API**                               |
| SOOP     | partly: third-party SDK script                                                         | token exchange                           | ads need prior consent (article 17-5); own broadcast only                                  |

**Order.**

1. Phase 0 in 1.0: twist engine and vote panel.
2. Phase 1: Twitch and YouTube.
3. Phase 2: Chzzk, after the ads question is settled in writing and an ADR amends ADR-0003 and ADR-0006.
4. Phase 3: SOOP and donation-triggered twists, framed as entertainment and never as wagers.

**CSP for the chat route.** The chat track drafted a replacement CSP for its route that starts from today's `script-src 'self'`. After §7.2 lands, that replacement must start from the new default instead (hashed loader plus `'strict-dynamic'`, Trusted Types `app-loader sim-worker`) and add only the chat hosts to `connect-src`.

The refreshed issue body, which adds the fact-check findings and this CSP note, is in [Appendix A](#appendix-a-refreshed-body-for-issue-118). **Post it as an update to #118 only after the owner has reviewed it.**

---

## 9. 3D (three.js) assessment

**Verdict.** Feasible (high confidence). **Not in 1.0.** Recommended as an opt-in "3D 관전 (beta)" in 1.x that consumes the existing deterministic trace. The Monte Carlo engine stays authoritative, and any physics is cosmetic only. 3D multiplies clips and thumbnails, but the session loop in §4 is what holds 30 minutes.

**Verified facts.**

- three.js r186 (WebGLRenderer, InstancedMesh) runs under the exact production CSP and Trusted Types with zero violations. The same holds for OGL, cannon-es and a custom WebGL2 renderer.
- regl is blocked: it needs `unsafe-eval`, and Trusted Types rejects its `Function` constructor.
- WASM physics (Rapier) needs `'wasm-unsafe-eval'`.
- Avoid the GLTF, Draco, KTX2 and meshopt loaders, lil-gui, and the `WebGL.js` check helper. All geometry and textures should be procedural.
- Sizes as gzip, because Cloudflare does not serve brotli q11:

  | Option                             | Size (gzip)                                                                          |
  | ---------------------------------- | ------------------------------------------------------------------------------------ |
  | three minimal                      | about 128 KiB, roughly 2.1× today's entire initial JS (60.7 KB gzip on live v0.2.15) |
  | Babylon (realistic WebGL download) | about 270 KiB                                                                        |
  | PlayCanvas                         | about 494 KiB                                                                        |
  | custom renderer                    | 1.9 KB sketch; 4–10 KB in production is a guess                                      |

- three has required WebGL2 since r163. WebGL2 reaches 97.13% of global usage, so a 2D fallback is mandatory.
- **OBS caveat.** `docs/STREAMING.md` tells some streamers to disable hardware acceleration. Chromium's software WebGL then drew 5,000 spheres at about 4 fps. So 3D must be opt-in, keep the 2D replay as fallback, and handle `webglcontextlost`.
- **Two trace models.** Classic `World` and free `FreeWorld` / FreeTrace v3 (`src/ui/replay/free-world.ts`). A 3D view must adapt both. InstancedMesh uploads 76 B per instance (about 418 KB per frame at 5,500 agents) unless update ranges are set.

**Options.**

|                    | A. Custom WebGL2 (zero deps)      | B. three.js, one lazy pinned dependency      | C. B + cannon-es cosmetic layer |
| ------------------ | --------------------------------- | -------------------------------------------- | ------------------------------- |
| Lazy size          | about 4–10 KB gzip (estimate)     | about 128 KiB gzip                           | plus 24–34 KiB gzip             |
| Effort (estimates) | MVP 1.5–3 weeks; polish 4–6 weeks | MVP 1–2 weeks; polish 3–5 weeks              | B + 2–4 weeks                   |
| ADR-0004           | intact                            | amendment for one pinned dependency, 3D only | two dependencies                |
| CSP change         | none                              | none (verified)                              | none (verified)                 |
| Ceiling for 병맛   | medium                            | high                                         | highest (dogpile collapse)      |

Cheaper alternative: a **2.5D goofy skin** on the existing Canvas2D replay (squash and stretch, bounce shadows, grey pancakes). No dependency and no CSP change, about 1–2 weeks (estimate).

**Abstract-but-goofy rule.**

- Humour comes from motion (squash, wobble, hop on latch, arc on throw, spin on rout, grey pancake when incapacitated, winner confetti) and from captions (§4.4).
- **Labels are settled once for 2D and 3D** (§1.2): text labels (viewer names, short species names) may float next to glyphs; animal emoji or pictograms on the stage are not allowed in either view. R9 decides whether viewer names show at all.
- Still open under **R28**: googly eyes (a face, which breaks the current rule) and props such as crowns or party hats.

**Prototype plan (1.x).**

- **M0**: decision R28.
- **M1**: a 2–3 day spike on a hidden `noindex` route `/lab3d/` (one segment). Exit criteria:
  - 0 CSP violations
  - lazy chunk of about 128 KiB gzip or less
  - 50 fps or more at 10v100 on a mid-range Android
  - 30 fps or more at 500v5000 on a laptop iGPU
  - also measured inside an OBS browser source
  - 2D replay unchanged
- **M2**: event-driven cosmetics (from the derived events, §10.8), reduced motion, flash limits. About 1 week.
- **M3**: streamer polish, using the 1.1 vertical layout. About 1 week.
- **M4** (optional): cannon-es with at most 200 bodies.
- **M5**: beta release, off by default on low-tier devices.

---

## 10. Technical plan

### 10.1 Engine: interventions (free engine only)

The legacy engine gets no live mode (D0).

**The log stores card codes, not raw effects.** A card's ops, magnitudes and duration live in a catalogue keyed by model version (`mv`). One log entry can therefore drive several arrays, and each op has explicit semantics (multiplicative, additive or set). Retuning a card later is a new `mv`, with the old catalogue kept, so old links still reproduce.

```ts
// src/sim/free/cards.ts (new): the catalogue
export const CARD_IDS = ['downpour', 'pitch-dark', 'mud', 'heatwave', 'second-wind', 'rallying-cry', 'shaken',
  'focus', 'power-surge', 'adrenaline', 'regroup', 'agitation', 'giant', 'pocket'] as const; // append-only; index = wire code
type TraitField = 'speed' | 'accuracy' | 'power' | 'turn';
type StateField = 'hp' | 'maxHp' | 'stamina' | 'morale';
type CardOp =
  | { op: 'mul'; field: TraitField; k: number }     // trait multiplier, active for the card's duration
  | { op: 'scale'; field: StateField; k: number }   // instant: value × k, then clamped
  | { op: 'add'; field: 'morale'; k: number }       // instant: value + k, then clamped
  | { op: 'addFracMax'; field: 'hp'; k: number }    // instant: + k × maxHp, active agents only
  | { op: 'setMax'; field: 'stamina' };             // instant
interface CardDef {
  target: 'both' | 'one';
  ops: readonly CardOp[];
  durationS: number | null;                         // null = rest of battle; instant cards hold only instant ops
  needs?: 'morale' | 'what-if';
}
export const CARDS_BY_MV: Readonly<Record<number, Readonly<Record<(typeof CARD_IDS)[number], CardDef>>>>;

// src/sim/free/interventions.ts (new)
export interface Intervention { tick: number; card: number; side: 0 | 1 | 2 } // side 2 = both
export function sanitizeInterventions(raw: unknown, maxSteps: number, mv: number, config: FreeConfig): Intervention[];

// src/sim/free/engine.ts:200
simulateFreeBattle(config, row, run, trace, opts?: { interventions?: readonly Intervention[]; branch?: { tick: number; salt: number } })
```

- **Hook.** At the top of the tick loop (`free/engine.ts:646`): `if (iv.length) applyDue(step)`. With an empty list no branch is taken, no RNG is drawn, no array is allocated and no arithmetic changes, so results stay bit-identical.
- **Applying entries due at `step`**, in log order:
  1. Instant ops (`scale`, `add`, `addFracMax`, `setMax`) change the current state at once, with clamps. They are never undone.
  2. If any `mul` op starts or expires at this step, the affected (side, field) pairs are recomputed.
- **Deterministic recomputation, not revert.**
  - `effective[i] = clampField(base[i] × clamp(∏ k, 0.5, 2))`.
  - The product runs over the `mul` ops active for that side and field, in a fixed order: start tick, then log index.
  - An op is active while `start ≤ step < end`, where `end = start + round(durationS / DT)` (or never, for "rest").
  - The values are re-derived from `base` on every start or expiry. There are no `revert` entries, no ids, no saved per-agent snapshots and no division, so overlapping durations cannot erase each other, and the same log always yields the same products in the same order.
- **Worked example.** Focus (accuracy ×1.2, 20 s) at tick 100 ends at tick 300. Pitch dark (accuracy ×0.8, rest) arrives at tick 150. Accuracy is then `base × 1.2` on [100, 150), `base × 1.2 × 0.8` on [150, 300), and `base × 0.8` from 300. Mud arriving during Adrenaline behaves the same way for speed.
- **Base arrays.** `base*` copies of the targeted trait arrays are allocated on the first `mul` op of a run, so an empty or instant-only log allocates nothing.
  - Precondition: those arrays are written only at spawn. M3 verifies this for sprint, cruise, `acc`, `hitDmg` and `turn`.
  - Any array the engine also writes during the tick loop instead gets a per-side factor at its read sites. Multiplying by 1.0 is exact in IEEE arithmetic, so goldens still hold.
- **Catalogue rule.** A card with a finite duration may contain only `mul` ops, enforced by a catalogue test. State changes are always instant, so nothing ever needs undoing.
- **Targets.**

  | Field     | Engine array                                                                          |
  | --------- | ------------------------------------------------------------------------------------- |
  | speed     | sprint and cruise (341–342)                                                           |
  | power     | strike damage `hitDmg` (345)                                                          |
  | accuracy  | `acc` (349), clamped to `maxAccuracy`                                                 |
  | turn      | `turn` (340)                                                                          |
  | morale    | `morale` (354); routs then follow the existing check at 1082–1089                     |
  | hp, maxHp | `hp`, `maxHp` (339); `hp` never above `maxHp`; incapacitated agents are never changed |
  | stamina   | `stamina` (281)                                                                       |

- **Bounds.**
  - The combined multiplier is clamped to [0.5, 2] per field (S), then the field clamps apply.
  - At most 64 entries, sorted stably by tick; tick within [0, maxSteps).
  - The card must exist in the catalogue for the link's `mv`. The side must match the card's target: `both` → 2, `one` → 0 or 1.
  - Morale cards are dropped when morale is off.
  - Edits bypass `TRAIT_BOUNDS`, so they are clamped explicitly.
- **Randomness.** No card uses RNG in 1.0. Future randomized cards use a new stream `deriveSeed(seed, run, 5)`. Salts 3 and 4 are taken by the sides (`free/engine.ts:170-171`).
- **Branch hook** (for live win chance). At `branch.tick`, reseed both side RNGs with `deriveSeed(seed, run, branch.salt)` (salts 6 and up). This only happens when `branch` is set, so goldens are unaffected.
- **Reinforcements** are post-1.0. They need reserve slots declared at spawn, a Reserve state, exclusion from summaries (1155–1173) and from trace counts (1209), and a separate salt.

### 10.2 Live step: fork and re-simulate (1.0)

1. **Simulate the live battle up front** in the overlay's warm live worker. The worker message `{type:'replay-free', config, run, interventions}` (`src/workers/protocol.ts:14`, `sim.worker.ts:79-86`) returns the full trace. Its wall time is recorded as `liveSimMs`.
2. **When a card is picked** at playhead T:
   - convert to `tick = ceil(T / DT) + 1`
   - append `{tick, card, side}` to the log
   - re-simulate the same run
   - call `FreeReplayView.load(trace, names, { startAt: T })`. Today `load(trace, sideNames, autoplay)` resets to t = 0 (`free-replay.ts:218-233`), so it gains an options object. Frames before T are identical, so the swap is seamless.
3. **What-if shift.** When the 3 cards are drawn, run N = 100–200 runs per card with the card at tick T, and show "같은 대결 N판 기준" before and after. The shift does not depend on the current battle state, and the label says so.
4. **Live win chance.** At k checkpoints (for example 8), run B branches (for example 32). Each branch replays the same run deterministically to the checkpoint, then diverges through the branch hook. The win share among branches is the "실시간 예상 승률".
   - The cost is about k × B runs, similar to a 200–300-run batch.
   - It is computed during the prediction freeze.
   - After a card, the checkpoints after T are recomputed during the card pause.
   - If the budget is exceeded, the bar falls back to a labelled "전력 비율" (HP-weighted remaining strength), never presented as a probability.
5. **Two gates, both adaptive** (owner decision **R6**). They replace the fixed "1,000 agents" rule of thumb.
   - **(a) Re-simulation gate.** Live cards are allowed only if `liveSimMs × 1.5 ≤ 500 ms` (S; the factor covers cards that lengthen the battle). This uses the live run's **own** measured cost, not the batch average: per-run cost spreads about 3× from median to p90 within a matchup (elephant vs 6 lions: median 257 s, p90 714 s simulated).
   - **(b) Card-pause budget.** The pause must hold:
     - the what-if batches, `W₁ = 3 × N`
     - the live-chance recompute after T, `W₂ ≈ (checkpoints after T) × B`
     - the re-simulation (live worker)

     Require `(W₁ + W₂) × msPerRun_p50 × c_obs ÷ batchWorkers ≤ 0.8 × pause length`. Here `msPerRun_p50` comes from this match's batch, and `c_obs` is the OBS load factor measured by the session-start check (default 1.3, S; §10.7). The next-match batch is not in this sum, because the scheduler keeps it out of the pause.

   - **When a gate fails**, degrade in this order:
     1. N per card: 200 → 100 → 50.
     2. Recompute only the next 2 checkpoints in the pause, and fill the rest during part 2.
     3. Drop the what-if numbers (cards show their effect text only, with "효과 계산 생략: 대결 규모가 큼"), and the bar falls back to "전력 비율".
     4. If gate (a) fails: **pre-battle cards** (§4.3). The pick is applied at tick 0 during the prediction beat, and the live battle is simulated once after it. That simulation must take no more than 50% of the prediction window; otherwise the match runs without cards and the overlay says so.
   - **Example** (4-core streamer PC: 3 workers, one reserved as the live worker, so 2 batch workers; `c_obs` 1.3; W = 450 runs, that is N = 100 plus about 150 live-chance runs; single-thread warm ms per run from the codebase track, Node, so browser numbers will differ and M3 re-measures them on a reference streamer PC):

     | Matchup                    | ms per run            | Pause workload                     | Fits a 15 s pause?                   | Re-sim gate                                    |
     | -------------------------- | --------------------- | ---------------------------------- | ------------------------------------ | ---------------------------------------------- |
     | 1 tiger v 1 lion           | 1.93                  | about 0.6 s                        | yes                                  | passes                                         |
     | 1 brown bear v 8 wolves    | 6.97                  | about 2.0 s                        | yes                                  | passes                                         |
     | 1 elephant v 6 lions       | 10.87                 | about 3.2 s                        | yes                                  | passes                                         |
     | 10 T. rex v 100 tigers     | 33.6 (36–217 per run) | about 9.8 s; about 16 s at N = 200 | only at N = 100                      | passes for most runs                           |
     | 1,000 wolves v 50 mammoths | 118–591               | about 35–175 s                     | no: what-if dropped, bar → 전력 비율 | depends on the run: 177–887 ms with the factor |

   - Simple mode never uses live cards. The gates matter for Live battle mode and the cup. **Every pair in the curated brackets is tested against both gates** (§6, M5). Because CI machines vary, the test compares each pair's p90 cost with a baseline matchup run in the same process. The thresholds are derived from the reference profile recorded in `PERFORMANCE.md`.
6. **Warm workers and scheduling** are in §10.7. Cold JIT is 2–6× slower, and today `pool.cancel()` terminates the run workers (`pool.ts:203-213`). The scheduler never does that during a session.
7. **Phase 2 (post-1.0).** Stepper refactor (`createFreeBattle()` returning `tick/frame/apply/finish`), a time-sliced live worker and an appendable `FreeWorld`. Only if fork-and-re-simulate proves insufficient.

### 10.3 Intervention log and share-link versioning

| Payload                       | Today                                                  | 1.0                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config v3 (`#s=`, `m:'free'`) | `v, m, a, b, buff, g`, scalars (`share-free.ts:76-94`) | adds `mv` (model version; absent means 1) and optional `live:{run, iv:[[tick, card, side], …]}`. Each tuple reproduces exactly under that `mv`'s catalogue. |
| Cup                           | –                                                      | `{v:3, m:'cup', mv, f, d, e:[[sp, n], …], seed, x:[[battle, iv, rr, cnt?, pick?], …], w:[…]}` (below)                                                       |
| Free result link              | v2 (`free-result-codec.ts:31`)                         | v3 adds `mv` and the `live` log; decoded in `functions/r/[[path]].ts`; v2 still decoded                                                                     |
| Classic v1/v2, TVT2, `/r/` v1 | unchanged                                              | unchanged                                                                                                                                                   |

**Cup payload fields.**

- `f`: format (`std16`, `q8`, `q8bo3`, `long`).
- `d`: decider (`live`, `batch`, `mix`, `pick`, `pickfinal`; R7).
- `e`: entries; `seed`: the cup seed.
- `x`: one entry per played battle:
  - `battle`: the battle index
  - `iv`: its intervention log
  - `rr`: reroll counts per pause, which reproduce the offered cards (§4.3)
  - `cnt`: the chat-picked count override (semifinals)
  - `pick`: the opinion pick (0 or 1) in pick formats
- Event-match choices derive from the seed and the format, so they need no field.
- `w`: winners, **kept only as a checksum**. Winners are recomputed from the inputs, and a mismatch shows the existing reproduction notice, like `chk=` does for results.
- Size: about 1–2 KB for 16 entries with full logs, well under `MAX_SHARE_LENGTH` 8192 (`src/ui/share.ts:14`).

**Other rules.**

- Unknown keys are already ignored (`share-free.ts:139-147`), so old cached clients degrade gracefully.
  - Note (#124): this describes builds up to v0.2.16, which ignore `mv` and run a newer link under model 1. Builds from #124 on never read an unknown `mv` as their own; [ADR-0008 §6](../adr/0008-live-interventions-and-model-version.md#decision) defines what they do.
- **Model-version policy** (ADR-0008, new):
  - `mv` increments whenever a free-engine change, or a card-catalogue change, alters any result.
  - For constant-only retunes, a per-`mv` constants table (and card catalogue) keeps old links reproducible.
  - For structural changes, old links open with a "made with model vN" note. The existing `chk=` reproduction message (`result-share.ts:194-206`) already flags differences for links that carry a summary.
  - Plain `#s=` links without `chk` would otherwise change silently, which is why `mv` comes first.
- Viewer names are never encoded.

### 10.4 Keeping goldens bit-identical

1. Before any engine change, add a **social-species golden**: wolves, lions, hyenas and _H. erectus_ with the buffs on. The current free golden covers only non-social species (`tests/free-golden.test.ts:9-16`).
2. The intervention hook and branch hook must pass every existing golden unchanged:
   - `tests/free-golden.test.ts`
   - the new social golden
   - `tests/fixtures/v2-golden.json` and the v1 and species goldens
   - `free-buff`, `free-replay`
3. After the hook lands, add **intervention goldens** (fixed log → fixed summary). They include overlapping durations: Focus then Pitch dark inside its 20 s, and Adrenaline then Mud. Per-agent trait values are asserted at ticks before, inside and after each overlap.
4. Any rout retune (R4) is a new `mv`, with the old constants kept for `mv` 1. It lands with the preset fixture diff reviewed by the owner.
5. Gate: `BENCH=1 npx vitest run tests/free-perf.test.ts` must show no regression beyond noise.

### 10.5 Performance budgets

| Item                         | Budget                                                        | Basis                                                                          |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Lobby initial JS             | at most today's initial JS (60.7 KB gzip, live v0.2.15)       | fact-check measurement                                                         |
| Lobby LCP, INP, CLS          | under 2.5 s on mobile; 200 ms or less; under 0.1              | Core Web Vitals                                                                |
| Overlay frame rate           | 60 fps at 1080p on a mid-range PC inside OBS (to be measured) | the replay holds 58–60 fps at 2,500 agents in a browser (`docs/REPLAY.md:382`) |
| Live re-simulation           | at most 500 ms p95 on the streamer's machine, via gate (a)    | §10.2                                                                          |
| Card-pause workload          | at most 80% of the pause, via gate (b)                        | §10.2                                                                          |
| Live-chance precompute       | finishes inside the prediction window, otherwise "전력 비율"  | §10.2                                                                          |
| Pre-match batch              | precomputed at the lowest priority during the previous match  | scheduler (§10.7)                                                              |
| Static screen on the overlay | no stretch longer than 8 s without motion or a countdown      | §4.1, G1                                                                       |
| 3D chunk (1.x)               | about 128 KiB gzip, lazy; main chunk unchanged                | §9                                                                             |

### 10.6 File-level plan

| Area                   | Files (N = new, C = changed)                                                                                                                                                                                                                                                                                                                  | Milestone |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Goldens and versioning | N `tests/free-golden-social.test.ts`; C `src/ui/share-free.ts`, `src/share/free-result-codec.ts`, `src/sim/free/config.ts` (`mv`)                                                                                                                                                                                                             | M1        |
| Species plumbing       | C `src/sim/free/species.ts` (era, adSafe, standalone constructor), `src/ui/free-mode.ts:76-79`, `src/ui/i18n.ts:65,98`, `src/share/result-text.ts`; C `src/sim/species.ts` (`freeMatchupAdSafe`)                                                                                                                                              | M1        |
| Presets                | N `src/sim/free/presets.ts`, `tests/presets.test.ts` (sanitize, budget, rout check, banned words), `tests/fixtures/preset-shares.json` (share, median duration, rout share)                                                                                                                                                                   | M1        |
| Lobby and play split   | N `play/index.html`, `en/play/index.html`, `src/main-lobby.ts`; C `index.html`, `en/index.html`, `vite.pages.ts` (if needed), `src/pages/routes.ts`, `src/seo/site.ts`, `functions/r/[[path]].ts` (links)                                                                                                                                     | M2        |
| Simple and Advanced    | N `src/ui/simple-mode.ts`, `src/ui/free-trait-table.ts`; C `src/ui/app.ts` (modes, default), `src/ui/tour-model.ts`, `src/i18n/ko.ts`, `src/i18n/en.ts`                                                                                                                                                                                       | M2        |
| Learn                  | N `learn/`, `en/learn/`, `species/`, `en/species/`; C `guide/`, `model/`, `parameters/` (P8), `src/ui/site-nav.ts`, `src/pages/site-header.ts`, `src/seo/head.ts`                                                                                                                                                                             | M2        |
| Usability              | N `docs/research/USABILITY.md` (script, tasks, results, survey questions)                                                                                                                                                                                                                                                                     | M2        |
| Interventions          | N `src/sim/free/interventions.ts`, `src/sim/free/cards.ts`, `tests/free-interventions.test.ts` (incl. overlap goldens, catalogue rule); C `src/sim/free/engine.ts`, `src/workers/protocol.ts`, `src/workers/sim.worker.ts`                                                                                                                    | M3        |
| Scheduler              | N `src/ui/scheduler.ts` (priority job queue over warm workers, chunk-level preemption), `tests/scheduler.test.ts`; C `src/ui/pool.ts` (uses the scheduler; `start()` no longer terminates workers on supersede), `src/ui/chunks.ts` (small chunks)                                                                                            | M3        |
| Events                 | N `src/ui/replay/free-events.ts` (events derived from frames), `tests/free-events.test.ts`                                                                                                                                                                                                                                                    | M3        |
| Live UI                | N `src/ui/live.ts`, `src/ui/cards-ui.ts`, `src/ui/chance-bar.ts`; C `src/ui/free-replay.ts` (`startAt`, swap), `src/ui/replay/free-world.ts`                                                                                                                                                                                                  | M3        |
| Streamer mode          | N `studio/`, `overlay/`, `stream/` (ko and en), `src/stream/channel.ts` (versioned, sequenced protocol), `studio.ts`, `overlay.ts`, `hotkeys.ts`, `sfx.ts`, `names.ts`, `session-log.ts`, `preflight.ts` (session-start check), `public/sfx/*` and an asset manifest; C `public/_headers` (`/overlay/*` Permissions-Policy, only if needed)   | M4        |
| Cup                    | N `src/sim/cup.ts` (incl. tiebreak and pick formats), `tests/cup.test.ts`, `tests/cup-brackets.test.ts` (all pairs: gates, rout, lopsidedness), `src/stream/cup-runner.ts`                                                                                                                                                                    | M5        |
| Species batches        | C `docs/research/SPECIES.md` (new hippo and rhino sheets), `src/sim/free/species.ts` (or the legacy registry while it is the source), `docs/SPECIES.md`, presets                                                                                                                                                                              | M6        |
| Demand scripts         | N `scripts/demand/` (API-based pulls only), `docs/research/DEMAND.md`                                                                                                                                                                                                                                                                         | M6        |
| Ads                    | N build step for the loader hash (a Vite plugin next to `vite.pages.ts`), `src/ads/loader.ts`, `tests/csp-hash.test.ts`, `.github/workflows/ads-canary.yml` (incl. full battle); C `public/_headers`, `src/share/result-function.ts`, `privacy/`, `en/privacy/`, footer                                                                       | M7        |
| Promotion              | N build script for per-preset share images (devDependency only), share-image assets; C `src/share/result-function.ts` (image per pair or species), `stream/` (kit images and policy)                                                                                                                                                          | M8        |
| Docs and ADRs          | N `docs/design/RENEWAL-1.0.md` (this document), `docs/adr/0008-live-interventions-and-model-version.md`; C `docs/MODEL.md`, `REPLAY.md`, `SHARING.md`, `STREAMING.md`, `PAGES.md`, `ADSENSE.md`, `SEO.md`, `CONFIGURATION.md`, `PERFORMANCE.md`, `ROADMAP.md`, `CONTRIBUTING.md` (framing rules for cards, names, predictions, evidence text) | all       |

### 10.7 Session compute: ownership, scheduler, CPU

- **One compute owner.** In streamer mode only `/overlay/` computes (in Route C, the single window). If both documents computed, two documents on the same OBS machine would compete for CPU, and sending full traces over BroadcastChannel would mean moving megabytes per card.
  - **Studio → overlay** commands: `match {config, run, seed}`, `card {tick, card, side}`, `beat {…}`, `names {…}`, `resend-request`. Each message carries a protocol version and a sequence number.
  - **Overlay → studio** results: win chance, what-if numbers, gate state, beat timing.
  - The overlay simulates deterministically from config plus log, so studio and overlay can never disagree about a result.
  - After an overlay reload, it asks for a full resend. The studio keeps the authoritative state and checkpoints it.
- **CPU.** In stream mode the overlay uses `min(cores − 2, 6)` batch workers plus one live worker (S), leaving room for OBS encoding and the compositor. `docs/STREAMING.md:273` already notes that OBS encoding shares the CPU and recommends hardware encoders.
  - **Session-start check** ("방송 전 점검"): with OBS running, the overlay runs a short calibration batch and sets `c_obs` and the worker count from it. The streamer sees a plain result ("이 PC에서 변수 카드: 대부분의 대결에서 가능").
- **OBS embedded browser** (Route A): module workers, the `sim-worker` Trusted Types policy and BroadcastChannel inside OBS are all part of the M4 spike.
- **Scheduler** (`src/ui/scheduler.ts`). Today's pool can hold only one job, and superseding it terminates the workers (`pool.ts:133-137`, `:203-213`). The scheduler replaces that during sessions.
  - **Priorities**: P0 live re-simulation (dedicated live worker); P1 what-if batches for the current pause; P2 live chance for the current match; P3 next-match batch; P4 speculative work (next match's live chance).
  - **Small chunks** (about 10–25 runs, S). Each worker pulls the highest-priority chunk next, so a P1 job takes over within one chunk without killing anything.
  - **Cancelling** a job drops its queued chunks and discards in-flight results. Workers stay warm. They are terminated only on page unload, hide-for-long, or error.
  - Simple and Advanced batches use the same scheduler. With one job at a time they behave as today.

### 10.8 Battle events derived from frames

Captions ("포위 시작!"), the slowdown at first contact, the 5 s highlight, banners and the still-standing names all need battle events. FreeTrace v3 has no event log: design phase P7's `BuffOn`/`BuffOff` events are not written yet (`docs/REPLAY.md:380`). For 1.0, events are **derived from frames**. That needs no engine change and carries no golden risk.

- **Input:** trace frames (every ≥0.5 s: per agent x, y, heading, HP fraction, state; `free/engine.ts` FreeTrace).
- **Events:**
  - first contact: the first frame with an engagement state on either side
  - incapacitation and rout clusters (state transitions, clustered with the classic rule: continue while the next event is within 2 s, cut after 5 s)
  - encirclement: at least k attackers within radius r of one target (S)
  - morale break: the fled share of a side jumps by at least x within 2 s (S)
  - decisive moment: the last 50% crossing on the live win-chance timeline (§10.2)
  - still standing: the agents active in the final frame, mapped to pasted names
- **Precision:** 0.5 s resolution is enough for captions, slowdown and highlights.
- `src/ui/replay/free-events.ts` is pure and tested on fixed traces. An in-engine event log (P7) remains an optional later improvement.

---

## 11. Milestones to 1.0.0

Size: S is up to about 2 days, M about 1 week, L more than 1 week. Each line is one GitHub issue unless noted. **[R#]** marks a dependency on an owner decision. Commits follow the repo's Conventional Commits and issue rules.

### M0. Decide and record

| Item                                                     | Scope                                                                                                                 | Size                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Owner decision pass on §12                               | Answer the blocking decisions (§12 table); the others take their defaults; record with dates                          | S **[blocking set]** |
| docs: accept the renewal design and update ROADMAP       | Status Accepted; ROADMAP lists M1–M8                                                                                  | S                    |
| docs(adr): ADR-0008 live interventions and model version | Amends the ADR-0003 wording on "identical results" to "identical per model version"; card catalogue versioned by `mv` | S                    |

Acceptance: decisions recorded; the ADR is merged.

### M1. Foundations (no visible change)

| Item                                                        | Scope                                                                                                                                                         | Size       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| test: social-species golden for the free engine             | Captured before any engine change                                                                                                                             | S          |
| feat(share): model version `mv` in v3 and free result links | Absent decodes as 1                                                                                                                                           | S          |
| refactor(free): free-only species plumbing                  | `era`, `adSafe`, names, counters and symbols keyed by `FreeSpeciesId`; standalone constructor                                                                 | M          |
| feat(ads): `freeMatchupAdSafe(FreeConfig)`                  | The loader gate accepts free configs                                                                                                                          | S          |
| feat(free): preset registry with a measured fixture         | §3.2: share, median duration, rout share; rout check and banned-words test                                                                                    | S          |
| feat(free): mass-rout decision implementation               | Per R4: preset limits and documented overrides, the Simple chip cap and rout notice, and the #42 display; or a retune under `mv` 2 with `mv` 1 constants kept | M **[R4]** |

Acceptance:

- every existing golden bit-identical, and the new social golden passes
- `npm run check` green
- v3 links without `mv` decode unchanged
- the preset fixture is committed

### M2. Play/Learn split, Simple mode, usability

| Item                                                                | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Size           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| feat(pages): lobby `/` and `/play/` documents with hash forwarding  | §3.1; play is `noindex`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | M **[R2]**     |
| feat(ui): Simple mode                                               | §3.2, incl. still-standing breakdown and rout notice                                                                                                                                                                                                                                                                                                                                                                                                                                 | M **[R1, R3]** |
| feat(ui): Advanced = Free (trait table) + Classic (Lab)             | 57-row free table, lazily built                                                                                                                                                                                                                                                                                                                                                                                                                                                      | M              |
| feat(share): link routing between Simple, Advanced, Classic and Cup | `isSimpleDiff`; routing tests for every link type                                                                                                                                                                                                                                                                                                                                                                                                                                    | S              |
| feat(tour): Simple tour                                             | 3–4 steps; classic tour moves to Lab                                                                                                                                                                                                                                                                                                                                                                                                                                                 | S              |
| feat(pages): `/learn/` hub and Play/Learn nav groups                | sitemap, hreflang, breadcrumbs                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S–M **[R13]**  |
| feat(pages): `/species/` guide, ko and en                           | curated sections per species                                                                                                                                                                                                                                                                                                                                                                                                                                                         | M              |
| docs: P8 free-model content and calibration report                  | guide, model and parameters pages; free vs classic comparison                                                                                                                                                                                                                                                                                                                                                                                                                        | M **[R1]**     |
| content: play-first intro and FAQ on `/`                            | keeps G1 crawlable text                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S              |
| research: usability test and survey                                 | Moderated test with 5–8 people aged 18–35 (adults, to keep consent simple; under-14 participants would need guardian consent under PIPA), on a preview build, tasks from G2/G3; plus an anonymous survey of at most 10 questions shared by the owner in target communities, with no data collected by the site. Results in `docs/research/USABILITY.md`; findings fixed or filed. The owner recruits; if recruiting fails, a smaller hallway test with at least 3 people still runs. | M **[R12]**    |

Acceptance:

- from a cold `/`, a result in at most 3 interactions
- G2 (3) and G3 (3) met in the usability test
- every old link type opens the same result (fixture tests)
- Lighthouse SEO 100 on `/` and `/learn/`
- ko/en key parity
- the R1 banner decision applied

### M3. Live variables

| Item                                                                        | Scope                                                        | Size           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------- |
| feat(free): tick-indexed intervention hook with deterministic recomputation | §10.1; no-op when empty; spawn-only precondition verified    | M              |
| feat(free): variable-card catalogue versioned by `mv`                       | Appendix B; realistic and what-if packs; catalogue rule test | S **[R8]**     |
| feat(ui): priority scheduler over warm workers                              | §10.7; replaces cancel-and-terminate during sessions         | M              |
| feat(worker): replay with interventions and a warm live worker              | §10.2 points 1 and 6                                         | S–M            |
| feat(replay): seamless trace swap at the playhead                           | `startAt`; frames before T identical (test)                  | M              |
| feat(free): branch hook and live-chance job                                 | §10.2 point 4, with fallback                                 | M              |
| feat(live): re-simulation gate, card-pause budget, pre-battle cards         | §10.2 point 5; degradation order                             | M              |
| feat(replay): battle events derived from frames                             | §10.8                                                        | M              |
| feat(ui): what-if shift display                                             | "N판 기준" label                                             | S              |
| feat(share): `live` log in v3 config and free result link v3                | `/r/` decodes it; sanitizer                                  | M              |
| feat(ui): Live battle mode                                                  | single-match card pauses                                     | M **[R5, R6]** |

Acceptance:

- an empty log leaves every golden identical
- the overlap goldens pass
- a link carrying `live` reproduces the battle bit-identically
- re-simulation p95 at most 500 ms for every preset that passes the gate, measured on the reference streamer PC and written to `PERFORMANCE.md`
- superseding a job never terminates a worker during a session (test)

### M4. Streamer mode

| Item                                                                    | Scope                                                                                                                                                                                                                                                | Size        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| spike: routes B, C, A                                                   | Popup plus Window Capture; OBS dock ↔ browser source BroadcastChannel (Windows, macOS, OBS 30+); module workers and Trusted Types inside OBS; audio autoplay in an OBS browser source and in the Route B popup; effect of `autoplay=()` on Web Audio | S           |
| feat(stream): channel protocol                                          | typed, versioned, sequenced messages; overlay as compute owner; resend on reload                                                                                                                                                                     | S           |
| feat(stream): `/overlay/` layout                                        | 1080p canvas, safe areas, backgrounds, legibility, disclaimer and thought-experiment tags, idle motion during freezes                                                                                                                                | M           |
| feat(stream): `/studio/` control panel                                  | matchup or cup, cards, prediction controls, session log                                                                                                                                                                                              | M           |
| feat(stream): session-start check                                       | `c_obs`, worker count, plain-language result                                                                                                                                                                                                         | S           |
| feat(stream): hotkeys with on-screen legend                             | physical keys under the IME (as #120); replay keys off in streamer mode                                                                                                                                                                              | S           |
| feat(stream): CC0 sound effects with asset manifest                     | ≤6 sounds, played in the overlay; route-specific audio start                                                                                                                                                                                         | S **[R11]** |
| feat(stream): viewer names on entities                                  | filter, hide toggle, not shared                                                                                                                                                                                                                      | M **[R9]**  |
| feat(stream): prediction hold state, label copy, crowd split entry      | §4.5                                                                                                                                                                                                                                                 | S **[R10]** |
| feat(stream): markers, beat timing, VOD timestamp export, champion card | §4.7                                                                                                                                                                                                                                                 | S–M         |
| docs: rewrite `STREAMING.md`; `/stream/` kit page                       | default Route B in at most 2 steps; TikTok LIVE and Kick notes                                                                                                                                                                                       | S–M         |

Acceptance:

- Route B verified on at least one Windows OBS, and a non-technical tester completes setup from `/stream/` alone in 5 minutes or less
- a test asserts that no request to `googlesyndication` happens on studio or overlay
- overlay frame rate measured
- hotkeys work with a Korean IME
- sound effects reach the stream in Route B, and in Route A if the spike keeps it

### M5. Animal Cup

| Item                                                                           | Scope                                                            | Size        |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------- |
| feat(sim): cup model                                                           | pure; seeds, deciders (R7), tiebreak (§4.2), opinion picks       | S           |
| feat(stream): cup runner with beats and next-match precompute                  | §4.2; P3 priority                                                | M **[R7]**  |
| feat(ui): curated Standard 16 and Quick 8 brackets                             | all-pairs test: both gates, rout check, first-round lopsidedness | S **[R7]**  |
| feat(ui): length presets                                                       | 짧게 / 기본 / 길게 with estimates (§4.2)                         | S **[R31]** |
| feat(share): full cup link and bracket result card                             | `m:'cup'` payload of §10.3; winners as checksum                  | S–M         |
| feat(ui): late-joiner strip, recap card, UPSET / COMEBACK / CARD SWING banners | §4.4                                                             | S–M         |
| feat(ui): bracket checkpoint and resume                                        | `localStorage` with try/catch                                    | S           |

Acceptance:

- a 16-entrant cup completes with only streamer picks
- a dry-run timing is logged, with the longest static stretch and the battle share
- a cup link reproduces every match result
- resume works after a reload

### M6. Animals batch A (and A′ as time allows)

- Hippo and white rhino: new source sheets plus implementation (M each). **Required for 1.0.**
- Polar bear, _Spinosaurus_, raptor pack: S–M each. **Required for 1.0.**
- _Triceratops_: new source sheet plus implementation (M), if time allows.
- Demand scripts committed (API-based only) with the first `DEMAND.md` (S).
- Capybara **[R15]** and gorilla **[R14]** follow in batch B, per decision.

Acceptance per species: the §5.3 definition of done.

### M7. Ad readiness (our side)

| Item                                                                           | Scope                                                                                             | Size                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------- |
| docs/content: privacy page rewrite, ko and en                                  | §7.1 step 2, incl. privacy officer                                                                | M **[R23]**            |
| feat(build): hashed inline loader, `_headers` injection, `RESULT_HEADERS` sync | §7.2; shipped without ads                                                                         | M **[R21]**            |
| ci: CSP canary in Chromium, Firefox, WebKit                                    | dummy client only; full battle and Live card swap under the new default CSP; worker chunk imports | M                      |
| feat(ads): gated loader, merged dark (no slots)                                | §7.1 step 4                                                                                       | S                      |
| feat(ads): Phase 1 slots on Learn pages                                        | **only after root Ready** (blog remediation, §7.1 step 0)                                         | S **[external: blog]** |

Acceptance:

- zero CSP violations on production for one release, including a full battle
- canary green
- tests prove the loader never runs on play, studio, overlay or `/r/`
- the G1–G3 table in `docs/ADSENSE.md` re-verified on production

### M8. Promotion prep, pilot and 1.0.0

| Item                                                                        | Scope                                                                                                                                                                                                                                                            | Size          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Owner: search registration                                                  | Search Console, Naver Search Advisor, Daum, Bing (`docs/SEO.md` owner actions)                                                                                                                                                                                   | S **[owner]** |
| feat(share): per-preset share images and image per pair or species on `/r/` | §7.6                                                                                                                                                                                                                                                             | S–M           |
| Pilot: 3–5 recorded outside streamer sessions                               | Chzzk and SOOP first, then YouTube; Twitch for `/en/`. Measure session length, longest static stretch, battle share and boredom points from the session log.                                                                                                     | M **[R12]**   |
| Fallback: owner-run dry runs                                                | If fewer than 3 outside sessions are recorded within 3 weeks of M5 acceptance: 3 full default-cup sessions run by the owner through OBS (a real or private broadcast), screen-recorded with the session log. They satisfy G1; outside pilots continue after 1.0. | S–M **[R12]** |
| Fixes from the pilot or dry runs                                            | prioritized list                                                                                                                                                                                                                                                 | M             |
| Owner: GRAC legal advice recorded                                           | release checklist item 10                                                                                                                                                                                                                                        | **[R25]**     |
| Release 1.0.0                                                               | patch notes; `Release-As: 1.0.0`                                                                                                                                                                                                                                 | S             |

Acceptance: the §1.4 checklist is met.

**Parallelism.** M7 runs alongside M2–M5. M6 can start after M1, and the hippo and rhino source sheets should start immediately, because they are on the 1.0 path. The critical path for 1.0 is M1 → M3 → M5 → M8. The critical path for **ads** additionally runs through the owner's blog remediation (§7.1 step 0), which is independent of this repository.

**Post-1.0 backlog.**

- vertical 9:16 overlay layout (1.1)
- batch B and later species at the §5.3 cadence
- #118 chat phases
- 3D beta (§9)
- Phase 2 streaming engine
- reinforcements
- in-engine event log (P7)
- ocean skin
- per-species pages
- free-mode sensitivity chart
- species collection (도감) and hall of fame
- custom bracket builder
- ads Phase 2 (lobby) and H5 Games Ads
- herd defence (#72)

---

## 12. Owner decisions

**Which decisions need an answer.** Only the blocking ones need an answer before work starts. Every other decision takes its recommended default if unanswered, and can still be changed later.

| Decision                                                  | Blocks                 | If unanswered                                      |
| --------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| R1 default engine                                         | M2                     | **blocking**                                       |
| R2 document split                                         | M2                     | **blocking**                                       |
| R4 mass rout (presets and Simple counts)                  | M1                     | **blocking**                                       |
| R7 cup format and decider                                 | M5                     | **blocking**                                       |
| R9 viewer names                                           | M4                     | **blocking**                                       |
| R12 pilot streamers and fallback date                     | M2 test recruiting, M8 | **blocking**                                       |
| R14 gorilla                                               | batch B                | **blocking** for batch B only                      |
| R15 what-if species                                       | batch B                | **blocking** for batch B only                      |
| R21 CSP option                                            | M7                     | **blocking**                                       |
| R23 privacy officer                                       | M7, release            | **blocking**                                       |
| R3, R5, R6, R8, R10, R11, R13, R16–R20, R22, R24, R26–R34 | –                      | the recommendation below                           |
| R25 GRAC advice                                           | release                | an owner action, not a choice: required before 1.0 |

**Decision record (owner, 2026-10-26).** Every blocking decision was answered, each with the recommended option. The non-blocking decisions take their recommended defaults.

| Decision            | Answer                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 default engine   | (a) Simple mode on the free engine, after the minimum P8 pass                                                                                                        |
| R2 document split   | (a) `/` lobby and `/play/` app                                                                                                                                       |
| R4 mass rout        | (b) Keep the model for 1.0 and contain the cascade; a retune comes later with sign-off                                                                               |
| R7 cup decider      | (a) one live battle by default, with (d) opinion pick as a selectable format                                                                                         |
| R9 viewer names     | Allowed as text labels next to glyphs, with a filter and a hide toggle, never in links                                                                               |
| R12 pilot           | The owner runs the test broadcasts personally, so the fallback applies: 3 owner-run dry runs with recordings and session logs ([docs/STREAMING.md](../STREAMING.md)) |
| R14 gorilla         | (a) Batch B, neutral naming, no meme preset                                                                                                                          |
| R15 what-if species | (a) Main roster with a visible "what-if" tag                                                                                                                         |
| R21 CSP             | A, hash-based, with A′ as the fallback                                                                                                                               |
| R23 privacy officer | Use the identity the owner already publishes on the blog: the operator name and the public contact email shown on vinylims.com                                       |
| R25 GRAC advice     | Owner action, still required before 1.0                                                                                                                              |

Each line below gives the options and our recommendation.

**Play experience**

- **R1. Default engine.** (a) Simple mode on the free engine after a minimum P8 pass (docs, calibration report, banner decision). (b) Keep classic as the default. **Recommend (a).** Every popular new matchup needs free mode.
- **R2. Document split.** (a) `/` lobby and `/play/` app. (b) A single document. **Recommend (a).** It keeps ads away from the game and lets the lobby carry ads later.
- **R3. Simple-mode seed.** (a) A fresh seed per Run, written into the link. (b) A fixed seed. **Recommend (a).**
- **R4. Mass-rout cascade.** (a) Retune E4b contagion under `mv` 2. (b) Keep the model for 1.0 and contain the cascade:
  - presets pass the fixture rout check or carry a documented override
  - Simple mode shows the still-standing / fled / incapacitated breakdown with a rout notice
  - Simple's quick chips stop at 100 for social species, while the stepper keeps the engine caps
  - event matches use the underdog buff instead of doubled counts when a side is social

  **Recommend (b) for 1.0, and (a) later with owner sign-off.** A retune flips winners (tigers vs lions) and multiplies re-simulation cost.

- **R5. Live-variable scope for 1.0.** **Recommend** cards 1–14 in §4.3, with reinforcements post-1.0.
- **R6. Live limit.** (a) The two adaptive gates from measured cost (§10.2). (b) A fixed 1,000-agent cap. **Recommend (a).**
- **R7. Cup format.**
  - Curated brackets only in 1.0: **recommend**.
  - Brackets: Standard 16 (default), Quick 8, Quick 8 best of 3.
  - Match decided by: (a) one live battle; (b) the batch win share; (c) the batch for early rounds and a live battle for the final; (d) opinion pick, where the streamer or chat picks and the simulation adds the win chance and a short twisted battle as commentary; (e) opinion picks early, live battle from the semifinals. **Recommend (a) as the default and (d) as a selectable format.**
  - Tiebreak for a live decider as in §4.2: **recommend**.
- **R8. Card tone.** Realistic pack by default, what-if pack as an opt-in toggle. **Recommend.**
- **R9. Viewer names on entities.** Allowed as text labels next to glyphs (the same rule in 2D and in a later 3D view), with a filter and a hide toggle, never written into links. **Recommend yes.**
- **R10. Predictions in 1.0.** An honor-system prompt plus native platform tools, with no backend. **Recommend yes.**
- **R11. Sound.** CC0 sound effects played by `/overlay/`, on by default in streamer mode and off elsewhere, no music. **Recommend.**
- **R12. Pilot.** The owner names 3–5 outside streamers (Chzzk and SOOP first, then YouTube; Twitch, TikTok LIVE or Kick for `/en/`) and recruits the 5–8 usability testers. Fallback: if fewer than 3 outside sessions are recorded within 3 weeks of M5 acceptance, 3 owner-run dry runs with recordings and session logs satisfy G1. **Recommend, with the fallback.**
- **R13. What "learning channel" means.** Did the brief mean (a) a `/learn/` section of this site, (b) a separate subdomain, or (c) a separate YouTube channel for explanations? **Recommend (a) in 1.0 regardless.** (c) would be owner content work that `/learn/` can link to later. If unanswered: (a).

**Roster**

- **R14. Gorilla.** (a) Add it in batch B, after hippo and rhino, with neutral naming and no meme preset. (b) Keep it excluded. **Recommend (a).**
- **R15. What-if species** (capybara, emperor penguin). (a) Main roster with a visible "what-if" tag. (b) A separate tier. **Recommend (a).**
- **R16. Giant-size what-if card.** **Recommend yes**, in the what-if pack.
- **R17. Marine animals.** **Recommend out of 1.0**, with an ocean skin for marine vs marine later.
- **R18. Korea-specific picks** (_Tarbosaurus_, Kodiak variant). **Recommend batch C.**
- **R19. Chimpanzee.** **Recommend defer.** Insects: out of scope.
- **R32. Count limits in Simple mode.** (a) Engine caps with the work budget, with the R4 chip cap for social species. (b) A lower hard cap for believability. **Recommend (a).**
- **R34. Animal cadence after 1.0.** At least one new species per month, two while ready source sheets remain (§5.3). **Recommend.**

**Ads, legal and promotion**

- **R20. Zero ads** on play, studio, overlay and `/r/`. Phase 1 on Learn only. **Recommend confirm.**
- **R21. CSP.** (A) Hash-based, with the Trusted Types allowlist on ad routes only. (A′) Trusted Types report-only on ad routes. (B) Nonce Function. **Recommend A**, with A′ as fallback.
- **R22. AdSense dashboard changes** (shared with the blog): Ad intents off, vignette additional triggers off, sensitive categories blocked. **Recommend yes.**
- **R23. Privacy officer.** Publish a role or name and an email on the privacy page. **Required** (release checklist item 9).
- **R24. Audience positioning.** General audience, teens and up, not child-directed. **Recommend.**
- **R25. GRAC rating.** Get legal advice before 1.0. **Required** (release checklist item 10).
- **R26. Complementary revenue.** Donation links, affiliate links (with disclosure), CrazyGames, or none. **Recommend donation links first.**
- **R27. H5 Games Ads.** Apply after 1.0 ships. **Recommend yes.**
- **R33. Success measurement.** (a) No client analytics in 1.0, using search consoles, Cloudflare dashboard counts, AdSense once live and session logs. (b) Cloudflare Web Analytics beacon after G4, with CSP and privacy changes. (c) An own counter Function. **Recommend (a)**, with the owner setting targets for the metrics in §7.7.

**Later work**

- **R28. 3D.**
  - Timing 1.x: **recommend**.
  - ADR-0004 amendment for one pinned lazy dependency (three) versus a custom renderer: **recommend deciding after the 2.5D skin and pilot feedback**.
  - Text labels are already settled by §1.2 and R9. Still open: googly eyes and props. **Owner call; default is no faces and no props.**
- **R29. Live chat.** 1.0 is not gated on chat. Answer the #118 decisions: the Chzzk and SOOP ads conflict, server functions, developer accounts, anonymous IRC, YouTube quota, vocabulary, donations. **Recommend confirming that 1.0 is not gated.**
- **R30. Naming and IP.** Common nouns only, as extended in §1.2 (evidence text, studio copy, captions, blog posts). Consider registering the product name early. Publish a "free to use on stream and in monetized VODs" policy on `/stream/`. **Recommend yes.**
- **R31. Session length presets.** (a) 짧게 (Quick 8, about 15 min) / 기본 (Standard 16, about 40 min, default; at least 39 min on its shortest path) / 길게 (Standard 16 with best of 3 from the quarterfinals, about 60 min), with Quick 8 best of 3 (about 28 min expected) as a variant. Labels show the estimate. (b) Standard 16 only. **Recommend (a).**

---

## 13. Risks

| Risk                                                                                               | Likelihood                                   | Impact                                | Mitigation                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `vinylims.com` stays unapproved, or is rejected again for "low value content"                 | medium–high until the blog remediation lands | no ad revenue                         | Owner-controlled blog work on the ads critical path (§7.1 step 0): vinylog #64 (tracking), #74 (cadence), #129 / PR #130 (placeholder ad slots, layout), #80 (CSP hosts); vinylog-vault #54 / PR #55 (truncated posts, common nouns); the vault content gate. Not a 1.0 gate for this site. |
| Free model not calibrated in time for the D1 flip                                                  | medium                                       | M2 slips                              | Minimum P8 (§3.2); Simple can launch with a clear "provisional" label if the owner accepts it                                                                                                                                                                                               |
| The rout cascade makes army presets and large Simple counts dull, or a retune flips results        | high (measured)                              | weak content; broken links            | R4 (b) for 1.0: fixture rout check, Simple chip cap and notice, event-match rule; `mv` and the social golden before any retune                                                                                                                                                              |
| Re-simulation or the card-pause workload too slow for long or large battles (worse after a retune) | medium                                       | cards lag; empty pauses               | Two adaptive gates, degradation order and pre-battle cards (§10.2); priority scheduler and warm workers (§10.7); all-pairs bracket test; Phase 2 stepper post-1.0                                                                                                                           |
| Overlapping card durations corrupt values                                                          | low after the redesign                       | wrong results; links not reproducible | Deterministic recomputation from base values (§10.1); overlap goldens (§10.4)                                                                                                                                                                                                               |
| CPU contention between OBS encoding and the simulation                                             | medium                                       | stutter; lowered gates                | Single compute owner (overlay); fewer workers in stream mode; session-start check; hardware encoder advice (`docs/STREAMING.md:273`)                                                                                                                                                        |
| OBS dock-to-source messaging, workers or audio fail in OBS's browser                               | medium                                       | setup friction; silent stream         | Route B is the default; Route A only after the spike; route-specific audio start                                                                                                                                                                                                            |
| The 30-minute session target does not hold, or freezes feel dead                                   | medium                                       | primary goal missed                   | Standard 16 is about 40 min even on its shortest path; 8 s static-screen cap with idle motion; battle-share metric from the session log; pilot measurement; tune beats                                                                                                                      |
| Outside pilot streamers cannot be recruited                                                        | medium                                       | 1.0 never ships                       | R12 fallback: owner-run dry runs with recordings and logs                                                                                                                                                                                                                                   |
| Streamers do not adopt the tool (no evidence of sim-tool adoption in Korea)                        | medium                                       | low reach                             | Outreach to mid-size Talk streamers on Chzzk and SOOP; one-page setup kit; promotion plan (§7.6); clip-friendly moments                                                                                                                                                                     |
| The simple flow is not easy for real users                                                         | medium                                       | G2/G3 missed                          | Usability test and survey in M2, with task-based acceptance criteria                                                                                                                                                                                                                        |
| Old evidence (2013–2021 videos) misleads the roster                                                | medium                                       | wrong priorities                      | Recency weighting; demand decides order (§5.1); quarterly refresh with committed, API-only scripts                                                                                                                                                                                          |
| Demand scripts break platform terms                                                                | low after the change                         | account or legal exposure             | Only API-based pulls committed; scrapers dropped (§5.3)                                                                                                                                                                                                                                     |
| No measurement of success                                                                          | high without a decision                      | cannot tell what works                | R33 (a) uses existing data; targets set by the owner                                                                                                                                                                                                                                        |
| Animal-cruelty "for entertainment" framing as the site becomes a game                              | low–medium                                   | ads restricted                        | Disclaimer on every play surface including the overlay, glyphs, neutral words, slapstick-only what-if pack, copy review                                                                                                                                                                     |
| Gambling perception of predictions (Chzzk 통나무 파워 is seen as "point gambling")                 | medium                                       | policy and brand                      | Points only; no betting words in either language, "win chance" in English; no donation-linked outcomes                                                                                                                                                                                      |
| Offensive viewer names on stream                                                                   | medium                                       | streamer harm                         | Filter, hide toggle, streamer responsibility, ad-free documents                                                                                                                                                                                                                             |
| Trademark exposure from names or evidence text (World Cup, franchise and show titles, tool names)  | medium                                       | takedown                              | Extended common-noun rule (§1.2); banned-words test on preset names and "Why?" text                                                                                                                                                                                                         |
| Name squatting, as happened to a popular name-draw tool                                            | low–medium                                   | claims on streamers' VODs             | Consider name registration (R30); a published free-to-stream policy                                                                                                                                                                                                                         |
| Trusted Types neutralized on ad pages; Google changes break ads                                    | medium                                       | security or ad outage                 | Ads scoped to content pages; multi-browser canary; A′ fallback                                                                                                                                                                                                                              |
| The new CSP breaks workers (chunk imports inside a worker)                                         | low–medium                                   | app broken in production              | Full-battle canary before and after the CSP-only release; `/assets/*` fallback rule (§7.2)                                                                                                                                                                                                  |
| Chzzk and SOOP terms vs ads (chat)                                                                 | high if chat ships on ad pages               | API access revoked                    | Chat only on an ad-free route, with written confirmation (#118)                                                                                                                                                                                                                             |
| GRAC rating applies                                                                                | unknown                                      | legal                                 | Advice before 1.0 (R25, release checklist)                                                                                                                                                                                                                                                  |
| Teen-skewed audience and child-directed treatment                                                  | low–medium                                   | revenue or legal                      | General-audience positioning (R24)                                                                                                                                                                                                                                                          |
| Scope creep for a small team                                                                       | high                                         | 1.0 slips                             | Blocking-decision set; milestone gates; strict non-goals (§1.3); post-1.0 backlog                                                                                                                                                                                                           |
| Accessibility regressions (flashes, motion) in streamer effects                                    | medium                                       | harm; WCAG 2.3.1                      | At most 3 flashes per second; reduced-motion variants (idle motion included); review in M4                                                                                                                                                                                                  |

---

## Appendix A. Refreshed body for issue #118

**Post this as an update to #118 only after the owner has reviewed it.** The issue is "feat: live chat integration (Chzzk, YouTube Live, Twitch) so viewers can trigger twists". The body keeps the existing structure and adds the fact-check results from 2026-10-26 and the CSP note from §8.

```markdown
Tracking issue for reading live chat so viewers' messages trigger twists (variable cards) in a running battle. Owner priority: Chzzk, YouTube Live, Twitch. Research only; nothing is built. 1.0.0 does not depend on this issue (design: docs/design/RENEWAL-1.0.md §8).

## Goal

Viewers vote on allow-listed twists (`!1` / `!2` / `!3`, aliases such as `!비` / `!rain`) during a frozen card pause; the winning card is applied through the same `TwistSource` → `RoundAggregator` → `applyCard()` path that streamer clicks use in 1.0. Setup: at most 2 steps per platform for a non-technical streamer.

## Constraints

- Static Cloudflare Pages, zero runtime dependencies (ADR-0004), strict CSP, Trusted Types, COOP `same-origin`. One Pages Function today (`/r/*`).
- CSP baseline: after the 1.0 renewal the default policy is the hash-based loader policy (`script-src 'sha256-LOADER' 'strict-dynamic'`, `trusted-types app-loader sim-worker`; RENEWAL-1.0 §7.2). The chat route's replacement CSP must start from that policy and only add the chat hosts to `connect-src`; it must not start from the older `script-src 'self'` line.
- Chat is never stored or logged; aggregation in memory only; only counts and fixed card labels are shown; chat text uses `textContent` and never reaches the canvas.
- Chat-connected pages carry no ads (AdSense UGC rule; Chzzk and SOOP terms below).

## Research snapshot (2026-10-26)

| Platform | Browser-only?                                                                                                          | Backend                                                                                                                                               | Auth                                                                                                                       | Quota                                                                                                                              | Main risk                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twitch   | Yes: IRC WSS and EventSub; Helix CORS `*`                                                                              | none                                                                                                                                                  | anonymous IRC (`justinfan`, undocumented; live `PRIVMSG` received in a test) or implicit-grant token with `user:read:chat` | free; EventSub 3 connections / 300 subscriptions per token                                                                         | Twitch left Korea on 2024-02-27, so mainly `/en/`; Twitch data must never reach ad networks; cache at most 24 h                                                     |
| YouTube  | Yes: googleapis CORS echoes our origin                                                                                 | none (optional key proxy)                                                                                                                             | API key restricted by referrer and to YouTube Data API v3                                                                  | 5 units per `liveChatMessages.list`, 5 per stream connection, 10,000/day per project (about 2.8 streamer-hours/day at 5 s polling) | a browser key can be copied and referrers spoofed (quota abuse); REST `liveChat/messages/stream` exists only in the discovery doc (framing and lifetime unverified) |
| Chzzk    | No: `openapi.chzzk.naver.com` returns 403 "Invalid CORS request" to our origin; token exchange needs the client secret | stateless Pages Functions forwarding every Open API call (token, refresh, revoke, session URL, subscribe/unsubscribe) behind a strict path allow-list | streamer OAuth; scope `채팅 메시지 조회` (Naver review, duration unknown)                                                  | unpublished (429 exists)                                                                                                           | **developer terms item 13: no ads in, and no consideration (money or information) for, an app using the API**                                                       |
| SOOP     | Partly: official browser Chat SDK, a third-party script                                                                | token exchange                                                                                                                                        | streamer OAuth; Chat SDK is a "Consent" scope (review asks for company name, homepage, privacy policy, related streamer)   | unknown                                                                                                                            | **policies art. 17-5 (version effective 2026-08-24): ads or revenue need prior consent**; own broadcast only; gambling-category apps barred                         |

### Implementation notes from the fact-check

- Chzzk session hosts range `ssio01`–`ssio29.nchat.naver.com`, so CSP needs `wss://*.nchat.naver.com`. Socket.IO client 1.0.0–2.0.3 only; the client must ping `2` every 25 s; the session URL expires about 30 s after issue; root-namespace CONNECT gets `auth fail`; `sessionKey` goes in the query string.
- Real Chzzk payloads differ from the docs: event bodies arrive double-encoded (a JSON string inside the frame), `userRoleCode` sits inside `profile`, and an undocumented `eventSentAt` is in KST with no offset.
- Chzzk client sessions are capped at 10 per app across all streamers, so only the per-user session route scales (3 per user).
- Chzzk terms also bar apps with violent content at 방송통신심의위원회 grade 2 or above (item 12(나)): keep the no-gore wording and the on-screen disclaimer. App names may not contain chzzk/치지직/naver; apps with zero scope usage for 90 days are deleted; do not use the Chzzk logo (text-only login button).
- Unofficial Chzzk chat (`kr-ss*.chat.naver.com`) can read any channel without OAuth but sits outside the Open API terms and Naver's automated-collection ban: decide explicitly, do not rely on it by accident.
- OBS browser sources keep their own cookie and storage profile: tokens from a normal browser do not carry over. Connect in a normal browser and use window capture (the default streamer route in 1.0); never show tokens, keys or URLs containing secrets on screen.
- COOP `same-origin` breaks popup OAuth: use full-page redirects.
- `_headers`: a duplicate CSP is comma-joined (two enforced policies). Use `! Content-Security-Policy` and a full replacement, built from the 1.0 default policy, on the chat route; `_headers` does not apply to Functions responses, so the OAuth callback sets its own headers.
- In 1.0 the overlay is the only document that computes; chat votes arrive in the studio, which appends the winning card to its log and sends it to the overlay (RENEWAL-1.0 §10.7).
- Zero-integration bridge that already works in 1.0: Chzzk's streamer-run 승부예측 (since 2025-11-05, 통나무 파워), Twitch polls (15–1800 s) and predictions (30–1800 s), SOOP chat votes. The 1.0 app only needs a hold state and short labels (25 characters or fewer).

## Proposed phases

- [ ] **Phase 0 (ships in 1.0, no chat):** twist engine + studio vote panel; streamer taps cards or the winner of the platform's own poll.
- [ ] **Phase 1:** `ChatSource` interface; Twitch (anonymous IRC, optional EventSub login); YouTube (pasted live URL → `videos.list` for `activeLiveChatId`, 1 unit → stream or poll honouring `pollingIntervalMillis`; quota guard; optional "use my own API key").
- [ ] **Phase 2:** Chzzk official via stateless Pages Functions `/api/chzzk/{login,callback,session,subscribe,logout}`; tokens in an AES-256-GCM encrypted HttpOnly Secure SameSite=Lax cookie; hand-written Engine.IO v3 / Socket.IO v2 client (no dependency); new ADR amending ADR-0003/0006. Only after the ads question is settled in writing.
- [ ] **Phase 3:** SOOP Chat SDK on an isolated page; donation-triggered twists (Chzzk DONATION, Super Chat, cheers) framed as entertainment, never as wagers.

## Command design

- Round vote: one window per card pause (15–30 s), 2–4 options; accept `!1`, bare `1`, fullwidth digits, NFKC, named aliases; one vote per user per round (per-session salted hash of the sender id, in memory); random tie-break; global cooldown; ignore messages over about 50 characters.
- Streamer controls: pause, veto, mods/subs-only (Chzzk `profile.userRoleCode`, Twitch badges, YouTube `isChatModerator` / `isChatSponsor`), test mode with simulated chat.

## Out of scope

Sending chat, platform moderation actions, storing or analysing chat, scraped endpoints for YouTube (InnerTube) and Chzzk.

## Owner decisions needed

1. Chzzk/SOOP ad clauses: ad-free chat route plus written confirmation from Naver and SOOP, written permission, or skip these platforms.
2. Server-side code: stateless Pages Functions under `/api/*` with secrets in Cloudflare env (new ADR).
3. Who owns the developer accounts (Naver/Chzzk, Google Cloud, Twitch, SOOP); is there a business entity for SOOP's Consent form.
4. Is SOOP required.
5. Twitch: anonymous IRC acceptable, or official EventSub only.
6. YouTube: accept the shared quota (about 2.8 streamer-hours/day at 5 s polling) plus a "use my own key" option.
7. Command vocabulary (ko/en); nicknames on screen (proposal: never for chat; pasted name lists are a separate 1.0 feature).
8. Donation twists in the first chat release, or later.
9. Confirm 1.0.0 does not wait for chat.

## Acceptance criteria

- [ ] Spike: a Twitch channel's chat is read in the browser on a preview deploy with only `connect-src` changed on the chat route (starting from the 1.0 default CSP); Trusted Types still enforced; no console CSP violations.
- [ ] Spike: a YouTube live chat is read with a referrer-restricted key; quota per streamer-hour measured and written down; REST stream framing and connection lifetime measured.
- [ ] Decision on the Chzzk/SOOP ad clauses recorded before any Chzzk/SOOP code is merged.
- [ ] Chzzk (if approved): OAuth login and chat over Socket.IO v2 without new runtime dependencies; client secret never reaches the browser; proxy path allow-list tested; logout revokes the token.
- [ ] Commands: one vote per user per round, cooldowns, NFKC; no free chat text rendered; nothing persisted (code review).
- [ ] Setup in at most 2 steps per platform, with a "connected · last message N s ago" indicator and a simulated-chat test mode.
- [ ] `/privacy` updated (platforms used, YouTube ToS and Google Privacy Policy links, Twitch terms); PIPA items covered.
- [ ] ADR added; `docs/DEPLOYMENT.md` and `docs/CONFIGURATION.md` CSP sections updated.

## References

- Chzzk: https://chzzk.gitbook.io/chzzk/chzzk-api/session , https://chzzk.gitbook.io/chzzk/chzzk-api/authorization , terms at https://developers.chzzk.naver.com/ , runtime notes https://gist.github.com/fi-xz/69ce1f35ca1b2318a2b410c0d5757e0f
- YouTube: https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList , https://developers.google.com/youtube/v3/determine_quota_cost , https://developers.google.com/youtube/terms/developer-policies
- Twitch: https://dev.twitch.tv/docs/chat/irc/ , https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ , https://dev.twitch.tv/docs/product-lifecycle/ , https://legal.twitch.com/legal/developer-agreement/
- SOOP: https://developers.sooplive.co.kr/
- Cloudflare: https://developers.cloudflare.com/pages/configuration/headers/ , https://developers.cloudflare.com/pages/functions/pricing/
```

Suggested labels: `research`, `streamer-mode`, `enhancement`. Milestone: post-1.0.

---

## Appendix B. Variable card specification

All magnitudes are **S** (game assumptions). The catalogue is versioned by `mv` (§10.1): a link stores `[tick, card, side]`, and that `mv`'s catalogue defines the ops. "Rest" means until the battle ends.

**Op semantics.**

- `mul field ×k`: trait multiplier, active for the card's duration. Effective value = base × the product of active multipliers for that side and field, in (start tick, log index) order, clamped to [0.5, 2] and then to the field bounds. It is recomputed from base on every start or expiry.
- `scale field ×k`: instant; current value × k, clamped. Never undone.
- `add field +k`: instant; current value + k, clamped. Never undone.
- `addFracMax hp +k`: instant; + k × maxHp, for active agents only, never above maxHp. Never revives incapacitated agents.
- `setMax stamina`: instant; stamina set to its maximum.
- A card with a finite duration contains only `mul` ops (catalogue test).

| #   | Card id            | Side | Ops (applied in this order)                                                                                               | Duration | Engine arrays (`src/sim/free/engine.ts`) | Eligibility  |
| --- | ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- | ------------ |
| 1   | `downpour`         | both | `mul speed ×0.8`; `mul accuracy ×0.85`                                                                                    | rest     | sprint and cruise 341–342; acc 349       | always       |
| 2   | `pitch-dark`       | both | `mul accuracy ×0.8`                                                                                                       | rest     | acc 349                                  | always       |
| 3   | `mud`              | both | `mul speed ×0.7`; `mul turn ×0.8`                                                                                         | rest     | 341–342; turn 340                        | always       |
| 4   | `heatwave`         | both | `scale stamina ×0.5`                                                                                                      | instant  | stamina 281                              | always       |
| 5   | `second-wind`      | one  | `setMax stamina`                                                                                                          | instant  | 281                                      | always       |
| 6   | `rallying-cry`     | one  | `add morale +0.2`                                                                                                         | instant  | morale 354                               | morale on    |
| 7   | `shaken`           | one  | `add morale −0.2`                                                                                                         | instant  | 354; rout check 1082–1089                | morale on    |
| 8   | `focus`            | one  | `mul accuracy ×1.2` (then capped at `maxAccuracy`)                                                                        | 20 s     | 349                                      | always       |
| 9   | `power-surge`      | one  | `mul power ×1.3`                                                                                                          | 20 s     | hitDmg 345                               | always       |
| 10  | `adrenaline`       | one  | `mul speed ×1.25`                                                                                                         | 15 s     | 341–342                                  | always       |
| 11  | `regroup`          | one  | `addFracMax hp +0.15`                                                                                                     | instant  | hp and maxHp 339                         | always       |
| 12  | `agitation`        | one  | `mul speed ×1.15`; `mul accuracy ×0.9`                                                                                    | rest     | 341–342; 349                             | always       |
| 13  | `giant` (what-if)  | one  | `scale maxHp ×1.5`; `scale hp ×1.5`; `mul power ×1.5`; `mul speed ×0.85`. Radius unchanged; glyph scaled in the renderer. | rest     | 339, 345, 341–342                        | what-if pack |
| 14  | `pocket` (what-if) | one  | `scale maxHp ×0.6`; `scale hp ×0.6`; `mul speed ×1.3`                                                                     | rest     | 339, 341–342                             | what-if pack |

`maxHp` is scaled before `hp` so the `hp ≤ maxHp` clamp never cuts the new value. Instant state ops affect only active agents.

**Draw.** 3 eligible cards per pause, drawn from `deriveSeed(cupSeed or matchSeed, matchIndex, pauseIndex, rerollCount)`, so the offered cards reproduce from the link. One reroll per match. When the live gates are off, the same draw happens in the prediction beat and the pick is applied at tick 0 (pre-battle cards, §4.3). A card's text (ko and en) states its effect in plain words, follows the common-noun and neutral-word rules (§1.2), and carries the "game variable (assumption)" note in its Learn tooltip.
