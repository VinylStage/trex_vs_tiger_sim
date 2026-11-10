# Free-model calibration report (P8)

> **한국어 요약**
>
> - 자유 대결 엔진(쉬운 모드의 기본)을 클래식 엔진과 같은 종, 같은 마릿수, 같은 시드(20261019), 같은 실행 수로 비교하고, 자유 엔진만의 점검(거울전, 진영 바꾸기, 마릿수에 따른 단조성)과 쉬운 모드 프리셋의 근거 점검을 했습니다. 측정 스크립트는 `scripts/calibration/`에, 원자료는 `calibration-results.json`에 있습니다.
> - **티라노 vs 호랑이:** 자유 엔진의 결과는 클래식의 기본 전술 `flank`(뒤로 돌아 들어감)보다 `direct`(곧장 달려듦)에 훨씬 가깝습니다. 자유 모델에서 혼자 사는 호랑이는 포위하지 않기 때문입니다(설계 의도). 그래서 티라노 1 대 호랑이 20에서 호랑이 승률이 클래식 46.3%에서 자유 1.8%로 떨어집니다. 또 자유 모델의 호랑이는 거의 이탈하지 않고(이탈 비율 3–12%, 클래식 52–93%) 전투 불능이 될 때까지 싸웁니다. 앞의 것은 예상된 모델 차이이고, 뒤의 것은 보정 문제일 수 있어 #169로 올렸습니다(소유자 결정 필요).
> - **구조 점검은 통과:** 같은 종 거울전 14개 모두 50:50(두 진영 승률 차이의 95% 구간이 모두 0을 포함), 진영 바꾸기 3쌍 모두 같음, 마릿수 4개 곡선 모두 단조 증가.
> - **보정 문제로 보이는 것:** 호모 에렉투스 1마리가 어떤 육식동물과의 1:1에서도 한 번도 이기지 못하고 늘 이탈함(#167), 늑대 대 물소 곡선이 9–13마리에서 평평해지지 않음(#168), 혼자 사는 동물이 훨씬 큰 상대 앞에서도 거의 이탈하지 않음(#169). 파라미터 페이지에 자유 모델 항목이 없음(#170). 이미 알려진 1:1 이탈 100%와 보류 프리셋 3개(R4)는 그대로입니다.
> - **북극곰(#184, §13):** 거울전 50:50(1:1, 3:3 모두 구간 안), 마릿수 곡선 3개 모두 단조, 진영 바꾸기 같음. 불곰보다 두 배 무거워 1:1에서 불곰에 83% 이기고, 호랑이 · 사자 · 늑대 · 물소 상대로 모두 불곰 이상입니다. 이 차이는 대부분 추정값(공격 힘 · 간격 · 정확도, 사기)에 달려 있습니다. 이탈 모델(#169)은 바꾸지 않았고, 북극곰도 훨씬 큰 티라노 앞에서는 진 경우의 28%만 이탈합니다.
> - **하마(#186, §14):** 거울전 50:50(1:1, 3:3 모두 구간 안), 마릿수 곡선 4개 모두 단조, 진영 바꾸기 같음. 몸무게가 물소와 코끼리 사이(1.5톤)라 물소 · 곰에는 92–99% 이기고 코끼리에는 16%, 매머드에는 10%만 이깁니다. 사자는 16–20마리가 되어야 다 자란 하마와 비슷해지는데, 사자 무리가 어른 하마를 드물게만 사냥한다는 기록과 맞습니다. 검증되지 않은 두 값 중 최고 속도는 결과에 거의 영향이 없고(+1.7%p), 무는 힘은 가장 큰 영향 중 하나입니다(+29.9%p). 이탈 모델(#169)은 바꾸지 않았습니다.
> - **흰코뿔소(#187, §16):** 거울전 50:50(1:1, 3:3 모두 구간 안), 마릿수 곡선 4개 모두 단조, 진영 바꾸기 같음. 몸무게(2톤)가 하마보다 조금 무거워 1:1에서 하마에 63%, 물소에 93% 이기고, 코끼리에는 26%, 매머드에는 18%만 이깁니다. 사자는 20마리가 되어도 56%로 아직 흰코뿔소가 앞서는데, 다 자란 흰코뿔소는 천적이 거의 없다는 기록과 맞습니다. 검증되지 않은 최고 속도는 결과에 거의 영향이 없고(코끼리 상대 +2.6%p, 하마 상대 0%p), 측정이 없는 뿔 힘 · 공격 간격 · 치명도 · 정확도가 가장 크게 흔듭니다(33–52%p). 이탈 모델(#169)은 바꾸지 않았습니다.
> - **스피노사우루스(#185, §17, 육상 대결):** 거울전 50:50(1:1, 3:3 모두 구간 안), 마릿수 곡선 4개 모두 단조, 진영 바꾸기 같음. 몸무게(7.4톤)는 티라노(8톤)와 비슷하지만 무는 힘이 몇 배 약해(Sakamoto 2022) 1:1에서 티라노에 3.5%만 이기고, 세 마리가 되어야 티라노 한 마리를 넘습니다(56%). 값 하나를 범위 끝으로 옮겨도 13.5%가 최고입니다. 논쟁 중인 자세(네 발 / 두 발)가 영향을 주는 속도 · 선회는 결과에 거의 영향이 없습니다(+0.3%p, +0.2%p). 코끼리에는 몸무게 덕분에 89% 이깁니다.
> - **트리케라톱스(#189, §18):** 거울전 50:50(1:1, 3:3 모두 구간 안), 마릿수 곡선 4개 모두 단조, 진영 바꾸기 같음. 몸무게(8톤)가 티라노와 같고 뿔 힘을 몸무게에 맞춰 잡아, 1:1에서 티라노에 40%를 이깁니다(티라노 60%, 프리셋 "가까움"). 이 값은 맞추지 않았고, 측정이 없는 공격 간격 · 뿔 힘 · 치명도 · 정확도가 각각 45–53%p를 흔들며 문헌의 몸무게 범위도 25%p를 흔듭니다. 속도는 거의 영향이 없습니다(+1.1%p). 다른 대형 초식동물과 스피노사우루스에는 92–100% 이깁니다. 이탈 모델(#169)은 바꾸지 않았습니다.
> - **모델 2(#169, #197, §19):** 종마다 이탈 특성(상대가 몇 배 무거우면 압도당했다고 보는지, 그 상대의 공격 범위에서 얼마나 버티는지, 혼자 사는 종이 가까운 동료가 쓰러질 때 잃는 사기)을 넣고 계산을 어느 자바스크립트 엔진에서도 같게 만든 새 모델 버전으로 다시 쟀습니다. 호랑이의 이탈 비율이 2.5–11.5%에서 19–92%로 올라 클래식 범위에 들어오고, 티라노 10 대 호랑이 100은 평균 13.5마리 전투 불능 · 86.5마리 이탈로 클래식과 같아졌습니다. 대신 호랑이는 50마리가 되어도 티라노 한 마리를 이기지 못하고(모델 1: 60%), 사자 · 랩터 · 늑대 무리도 자기보다 훨씬 큰 동물 앞에서는 물러나 이기지 못합니다. 거울전 · 진영 바꾸기 · 단조성 점검은 그대로 통과하고, 프리셋 네 개에 근거를 적은 예외를 달았습니다. 모델 1의 결과와 파일은 그대로입니다.
> - **R1 "잠정 모델" 안내:** 기준(보정 보고서 + 소유자 승인 + 안내에 대한 결정, 그리고 가이드 · 모델 · 파라미터 페이지의 자유 모델 설명)을 아직 다 채우지 못했으므로 **지금은 내리지 말 것을 권합니다.** 소유자가 이 보고서를 승인하고, #170(파라미터 페이지)을 마치고, #169를 결정하면 내릴 수 있습니다. UI는 바꾸지 않았습니다.

Status: measured 2026-10-28 on `main` at `12b5968` (v0.2.22), engines unchanged by this report. Issue [#166](https://github.com/VinylStage/trex_vs_tiger_sim/issues/166), part of [#125](https://github.com/VinylStage/trex_vs_tiger_sim/issues/125). Design: [RENEWAL-1.0.md §3.2](../design/RENEWAL-1.0.md#32-simple-mode-and-advanced-mode) (minimum P8 pass, owner decision R1) and [FREE-MATCHUPS.md §8](../design/FREE-MATCHUPS.md#8-phased-implementation-plan) (phase P8). **Not signed off by the owner yet.**

Every number below is a statement about the two models under their assumptions, not a prediction of any real encounter. _T. rex_ and tigers never coexisted; most interaction rules and many ranges are assumptions (**S**).

## Contents

1. [Questions](#1-questions)
2. [Method](#2-method)
3. [Free vs classic: T. rex vs tiger](#3-free-vs-classic-t-rex-vs-tiger)
4. [Free vs classic: the classic presets](#4-free-vs-classic-the-classic-presets)
5. [Free vs classic: the other calibration match-ups](#5-free-vs-classic-the-other-calibration-match-ups)
6. [Free-model checks](#6-free-model-checks)
7. [Simple presets against the evidence](#7-simple-presets-against-the-evidence)
8. [Expected differences and calibration problems](#8-expected-differences-and-calibration-problems)
9. [Follow-up issues](#9-follow-up-issues)
10. [The R1 "provisional model" banner](#10-the-r1-provisional-model-banner)
11. [Owner decisions](#11-owner-decisions)
12. [Reproducing](#12-reproducing)
13. [Polar bear (#184)](#13-polar-bear-184)
14. [Hippopotamus (#186)](#14-hippopotamus-186)
15. [Raptor pack (#188)](#15-raptor-pack-188)
16. [White rhinoceros (#187)](#16-white-rhinoceros-187)
17. [_Spinosaurus_ (#185)](#17-spinosaurus-185)
18. [_Triceratops_ (#189)](#18-triceratops-189)
19. [Flight traits and model 2 (#169, #197)](#19-flight-traits-and-model-2-169-197)

## 1. Questions

1. Where both engines can run the same match-up, how do the free engine's win shares, battle durations and rout shares compare with the classic engine's, and which differences come from deliberate model differences rather than from calibration? (RENEWAL-1.0 §3.2: "a calibration report comparing free and classic win shares for every classic preset that free mode can express".)
2. Does the free engine pass the structural checks of the add-a-species pipeline (RENEWAL-1.0 §5.3 step 5) and of P8: mirror matches 50/50 within the interval, side swaps symmetric, win share monotonic in count, the wolf-vs-buffalo plateau guard; and the P8 runs 5 tigers vs 5 lions and 10 wolves vs 1 bear?
3. Does every Simple preset's outcome match the expectation recorded in [PRESETS.md](../PRESETS.md), [SPECIES.md §5 and §7](../SPECIES.md#5-documented-match-ups) and the preset's "Why?" text?
4. Can the "provisional model" banner (`free.provisional`) be removed under its criterion?

## 2. Method

**Engines.** Classic: `src/sim/engine.ts` (frozen, heavy role vs pack role). Free: `src/sim/free/engine.ts` at model version `mv` 1. Both are loaded unchanged from `src/` by `scripts/calibration/run.mjs`, which uses Vite's SSR module loader (already a dev dependency); nothing is added to the site.

**Same inputs where they map.** Side A is the classic heavy side, side B the classic pack side. Every batch uses seed 20261019, LHS sampling, individual CV 0.08, a 600 m arena, the 1,200 s cap and morale on unless stated, and the same run count on every engine (500–2,000, see each table). Ranges are each species' defaults on both engines. For the traits both engines have, the free registry reads the legacy preset (SPECIES.md §11.1), so these ranges are identical by construction. What does not map:

| Classic                                                   | Free                                                                                                                    | Effect on the comparison                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pack tactic `flank` (default) or `direct`                 | No tactic switch: every agent approaches directly; only a social side's pack buff adds a coordinated rear approach (E1) | Classic is run with **both** tactics. For a solitary pack species (tiger), classic `direct` is the closest analogue; for a social one, the free buff sits between the two. |
| Heavies never flee                                        | Every agent can flee (D5)                                                                                               | Classic rout shares count no fled heavies.                                                                                                                                 |
| Morale shock when any pack animal nearby is incapacitated | Shock only through the pack buff of social species (FREE-MATCHUPS.md §4.5); morale loss scales with damage              | Tigers rout far less in free (§3).                                                                                                                                         |
| Only the pack side latches, always                        | Latch only by `canLatch` species onto a target ≥ `R_latch` (2–5×) heavier                                               | Tiger vs brown bear becomes a strike duel.                                                                                                                                 |
| Heavy hit always detaches and knocks back                 | Knock-back only when the striker is ≥ `K_knock` (1.5–4×) heavier                                                        | Mostly the same for big-vs-small match-ups.                                                                                                                                |
| 22 sampled parameters                                     | 57                                                                                                                      | Same seed does not mean paired runs: the two batches are independent samples.                                                                                              |

**Metrics** (identical definitions on both engines, cross-checked against `aggregateFree` and `routShare` on every free batch):

- **Win share** of each side and draws, with the Wilson 95 % interval. A free side wins when the other has no active agent; a classic heavy side wins when no pack animal is active, the pack side when every heavy is incapacitated.
- **Free − classic** (and the side swaps of §6): the difference of side A's win shares in percentage points with Newcombe's hybrid score 95 % interval. The two batches are independent samples, so this interval applies.
- **A − B in a mirror match**: the difference of the two sides' win shares within **one** batch. A wins, B wins and draws come from the same runs (one multinomial sample) and are negatively correlated, so the interval is the paired Wald interval with variance (pA + pB − (pA − pB)²) / n. At pA ≈ pB ≈ 0.5 and n = 1,000 its half-width is about 6.2 pp, twice the 3.1 pp of each share; an independent-samples interval would be about √2 too narrow. The script checks this on a synthetic 50/50 split before it runs anything.
- **Median duration** in seconds over all runs.
- **Rout share**: the losing side's fled ÷ (fled + incapacitated), pooled over decided runs (`routShare`, `src/sim/free/aggregate.ts`; PRESETS.md).

Tables show percentages with the 95 % interval in brackets. "pp" is percentage points.

## 3. Free vs classic: T. rex vs tiger

### _T. rex_ vs tiger, morale on

| Match-up (A v B)        | Runs | A wins, classic flank | A wins, classic direct |       A wins, free |     Free − direct (pp) | Median s (flank / direct / free) | Rout % (flank / direct / free) |
| ----------------------- | ---: | --------------------: | ---------------------: | -----------------: | ---------------------: | -------------------------------: | -----------------------------: |
| _T. rex_ 1 v tiger 1    | 2000 |      98.7 (98.0–99.1) |     100.0 (99.8–100.0) | 100.0 (99.8–100.0) |     +0.0 (-0.2 to 0.2) |                    143 / 18 / 26 |               51.7 / 3.6 / 2.5 |
| _T. rex_ 1 v tiger 2    | 2000 |      99.0 (98.4–99.3) |     100.0 (99.8–100.0) | 100.0 (99.8–100.0) |     +0.0 (-0.2 to 0.2) |                    213 / 23 / 31 |               58.0 / 6.5 / 3.4 |
| _T. rex_ 1 v tiger 3    | 2000 |      98.4 (97.8–98.9) |     100.0 (99.8–100.0) | 100.0 (99.7–100.0) |     -0.0 (-0.3 to 0.1) |                    261 / 27 / 36 |              67.3 / 10.7 / 3.2 |
| _T. rex_ 1 v tiger 5    | 1000 |      98.0 (96.9–98.7) |     100.0 (99.6–100.0) |   99.6 (99.0–99.8) |     -0.4 (-1.0 to 0.1) |                    308 / 36 / 52 |              79.7 / 21.0 / 4.2 |
| _T. rex_ 1 v tiger 10   | 1000 |      87.9 (85.7–89.8) |     100.0 (99.6–100.0) |   99.0 (98.2–99.5) |    -1.0 (-1.8 to -0.4) |                   369 / 55 / 118 |              89.8 / 43.7 / 5.1 |
| _T. rex_ 1 v tiger 20   | 1000 |      53.5 (50.4–56.6) |     100.0 (99.6–100.0) |   97.3 (96.1–98.1) |    -2.7 (-3.9 to -1.8) |                   313 / 71 / 189 |              92.6 / 66.5 / 7.0 |
| _T. rex_ 1 v tiger 30   | 1000 |      27.0 (24.3–29.8) |     100.0 (99.6–100.0) |   87.1 (84.9–89.0) | -12.9 (-15.1 to -10.9) |                   227 / 78 / 235 |              90.3 / 75.9 / 8.7 |
| _T. rex_ 1 v tiger 50   | 1000 |        8.1 (6.6–10.0) |       98.3 (97.3–98.9) |   39.4 (36.4–42.5) | -58.9 (-61.9 to -55.7) |                   126 / 80 / 226 |             80.8 / 84.4 / 11.5 |
| _T. rex_ 3 v tiger 30   |  500 |     99.8 (98.9–100.0) |     100.0 (99.2–100.0) |  99.8 (98.9–100.0) |     -0.2 (-1.1 to 0.6) |                    54 / 25 / 117 |              77.0 / 75.7 / 3.5 |
| _T. rex_ 10 v tiger 100 |  500 |    100.0 (99.2–100.0) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    26 / 23 / 133 |              85.9 / 85.3 / 2.9 |
| _T. rex_ 10 v tiger 300 |  500 |    100.0 (99.2–100.0) |     100.0 (99.2–100.0) |   98.2 (96.6–99.1) |    -1.8 (-3.4 to -0.7) |                    37 / 29 / 265 |              91.4 / 90.5 / 5.5 |

| Match-up (A v B)        |    B wins, flank | B wins, direct |     B wins, free | Draws (flank / direct / free) |
| ----------------------- | ---------------: | -------------: | ---------------: | ----------------------------: |
| _T. rex_ 1 v tiger 1    |    0.0 (0.0–0.2) |  0.0 (0.0–0.2) |    0.0 (0.0–0.2) |               1.4 / 0.0 / 0.0 |
| _T. rex_ 1 v tiger 2    |    0.0 (0.0–0.2) |  0.0 (0.0–0.2) |    0.0 (0.0–0.2) |               1.1 / 0.0 / 0.0 |
| _T. rex_ 1 v tiger 3    |    0.1 (0.0–0.4) |  0.0 (0.0–0.2) |    0.0 (0.0–0.2) |               1.5 / 0.0 / 0.1 |
| _T. rex_ 1 v tiger 5    |    0.3 (0.1–0.9) |  0.0 (0.0–0.4) |    0.0 (0.0–0.4) |               1.7 / 0.0 / 0.4 |
| _T. rex_ 1 v tiger 10   |  10.4 (8.7–12.4) |  0.0 (0.0–0.4) |    0.0 (0.0–0.4) |               1.7 / 0.0 / 1.0 |
| _T. rex_ 1 v tiger 20   | 46.3 (43.2–49.4) |  0.0 (0.0–0.4) |    1.8 (1.1–2.8) |               0.2 / 0.0 / 0.9 |
| _T. rex_ 1 v tiger 30   | 72.9 (70.1–75.6) |  0.0 (0.0–0.4) | 12.6 (10.7–14.8) |               0.1 / 0.0 / 0.3 |
| _T. rex_ 1 v tiger 50   | 91.8 (89.9–93.3) |  1.7 (1.1–2.7) | 60.3 (57.2–63.3) |               0.1 / 0.0 / 0.3 |
| _T. rex_ 3 v tiger 30   |    0.0 (0.0–0.8) |  0.0 (0.0–0.8) |    0.0 (0.0–0.8) |               0.2 / 0.0 / 0.2 |
| _T. rex_ 10 v tiger 100 |    0.0 (0.0–0.8) |  0.0 (0.0–0.8) |    0.0 (0.0–0.8) |               0.0 / 0.0 / 0.0 |
| _T. rex_ 10 v tiger 300 |    0.0 (0.0–0.8) |  0.0 (0.0–0.8) |    1.2 (0.6–2.6) |               0.0 / 0.0 / 0.6 |

### _T. rex_ vs tiger, morale off

| Match-up (A v B)        | Runs | A wins, classic flank | A wins, classic direct |       A wins, free |  Free − direct (pp) | Median s (flank / direct / free) | Rout % (flank / direct / free) |
| ----------------------- | ---: | --------------------: | ---------------------: | -----------------: | ------------------: | -------------------------------: | -----------------------------: |
| _T. rex_ 1 v tiger 1    | 2000 |      98.2 (97.5–98.7) |     100.0 (99.8–100.0) | 100.0 (99.8–100.0) |  +0.0 (-0.2 to 0.2) |                    238 / 18 / 26 |                0.0 / 0.0 / 0.0 |
| _T. rex_ 1 v tiger 10   | 1000 |      36.8 (33.9–39.8) |     100.0 (99.6–100.0) |   99.2 (98.4–99.6) | -0.8 (-1.6 to -0.3) |                  532 / 116 / 123 |                0.0 / 0.0 / 0.0 |
| _T. rex_ 10 v tiger 100 |  500 |    100.0 (99.2–100.0) |     100.0 (99.2–100.0) |  99.8 (98.9–100.0) |  -0.2 (-1.1 to 0.6) |                  311 / 136 / 135 |                0.0 / 0.0 / 0.0 |

| Match-up (A v B)        |    B wins, flank | B wins, direct |  B wins, free | Draws (flank / direct / free) |
| ----------------------- | ---------------: | -------------: | ------------: | ----------------------------: |
| _T. rex_ 1 v tiger 1    |    0.1 (0.0–0.3) |  0.0 (0.0–0.2) | 0.0 (0.0–0.2) |               1.8 / 0.0 / 0.0 |
| _T. rex_ 1 v tiger 10   | 61.4 (58.3–64.4) |  0.0 (0.0–0.4) | 0.0 (0.0–0.4) |               1.8 / 0.0 / 0.8 |
| _T. rex_ 10 v tiger 100 |    0.0 (0.0–0.8) |  0.0 (0.0–0.8) | 0.0 (0.0–0.8) |               0.0 / 0.0 / 0.2 |

### Crowding check

| Match-up              |         `interference` | Runs |           A wins |        B wins | Median s |
| --------------------- | ---------------------: | ---: | ---------------: | ------------: | -------: |
| _T. rex_ 1 v tiger 10 | 0 / 0.1 / 0.3 (preset) | 1000 | 99.0 (98.2–99.5) | 0.0 (0.0–0.4) |      118 |
| _T. rex_ 1 v tiger 10 |                      0 | 1000 | 99.4 (98.7–99.7) | 0.0 (0.0–0.4) |      118 |
| _T. rex_ 1 v tiger 20 | 0 / 0.1 / 0.3 (preset) | 1000 | 97.3 (96.1–98.1) | 1.8 (1.1–2.8) |      189 |
| _T. rex_ 1 v tiger 20 |                      0 | 1000 | 96.1 (94.7–97.1) | 3.4 (2.4–4.7) |      189 |

What the numbers show:

- **Free sits near classic `direct`, not the default `flank`.** Up to 20 tigers per _T. rex_ the free and `direct` win shares differ by less than 3 points; with `flank`, tigers win 10.4 % at 10 and 46.3 % at 20. The classic `flank` tactic sends every tiger to the rear, out of the bite cone, which no free rule gives a solitary species (FREE-MATCHUPS.md §4.1; MODEL.md §1 already says coordinated attacks by many tigers are not documented). This is the largest single difference and it is **expected**.
- **At large counts free gives the tigers more than `direct` does.** At 30 and 50 tigers the free tigers win 12.6 % and 60.3 % (direct: 0 % and 1.7 %), because they do not rout and keep latching until the damage adds up.
- **Crowding is not the cause.** With `interference` fixed at 0 the free shares move by at most 1.6 points.
- **Free tigers almost never flee.** The rout share of the losing tigers is 2.5–11.5 % in free against 51.7–92.6 % with `flank` and 3.6–90.5 % with `direct`. A _T. rex_ strike usually incapacitates a tiger outright, and a non-social tiger feels no shock from allies nearby (FREE-MATCHUPS.md §4.5). In the Simple preset 10 _T. rex_ v 100 tigers, a run ends on average with 97.1 tigers incapacitated and 2.9 fled (classic: about 14 and 86, MODEL.md §6). This follows the design, but it contradicts the tiger's own evidence (avoids injurious fights) and changes how the flagship preset reads: filed as **#169** for an owner decision.
- **Durations.** Free battles are shorter than `flank` for small counts (26 s vs 143 s at 1 v 1: no stand-off behind the _T. rex_) and longer for armies (133 s vs 26 s at 10 v 100: the tigers do not rout en masse).
- **Morale off** removes the rout differences and leaves the tactic one: free and `direct` agree within 1 point, `flank` lets 10 tigers win 61.4 % of runs.

## 4. Free vs classic: the classic presets

All nine classic presets ([form.ts `PRESETS`](../../src/ui/form.ts)) are expressible in the free model, with their own run counts.

### Classic presets

| Match-up (A v B)              | Runs | A wins, classic flank | A wins, classic direct |       A wins, free |     Free − direct (pp) | Median s (flank / direct / free) | Rout % (flank / direct / free) |
| ----------------------------- | ---: | --------------------: | ---------------------: | -----------------: | ---------------------: | -------------------------------: | -----------------------------: |
| _T. rex_ 10 v tiger 100       |  500 |    100.0 (99.2–100.0) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    26 / 23 / 133 |              85.9 / 85.3 / 2.9 |
| _T. rex_ 1 v tiger 10         | 1000 |      87.9 (85.7–89.8) |     100.0 (99.6–100.0) |   99.0 (98.2–99.5) |    -1.0 (-1.8 to -0.4) |                   369 / 55 / 118 |              89.8 / 43.7 / 5.1 |
| elephant 5 v lion 30          |  500 |      98.2 (96.6–99.1) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                   331 / 136 / 46 |             66.8 / 71.4 / 89.0 |
| buffalo 1 v lion 6            | 1000 |      41.1 (38.1–44.2) |       87.7 (85.5–89.6) |   16.7 (14.5–19.1) | -71.0 (-73.9 to -67.7) |                  170 / 116 / 137 |             46.5 / 72.4 / 73.4 |
| buffalo 1 v hyena 15          | 1000 |         4.3 (3.2–5.7) |       58.3 (55.2–61.3) |   26.2 (23.6–29.0) | -32.1 (-36.1 to -27.9) |                     46 / 49 / 51 |             35.1 / 71.3 / 79.2 |
| brown bear 1 v wolf 8         | 1000 |      57.4 (54.3–60.4) |       98.8 (97.9–99.3) |   69.8 (66.9–72.6) | -29.0 (-32.0 to -26.1) |                    156 / 69 / 68 |             84.6 / 94.7 / 96.9 |
| brown bear 1 v tiger 1        | 2000 |      91.5 (90.2–92.6) |     100.0 (99.8–100.0) |   77.8 (76.0–79.6) | -22.2 (-24.0 to -20.4) |                     42 / 16 / 32 |          100.0 / 100.0 / 100.0 |
| mammoth 1 v wolf 12           | 1000 |      92.9 (91.1–94.3) |     100.0 (99.6–100.0) | 100.0 (99.6–100.0) |     +0.0 (-0.4 to 0.4) |                    310 / 75 / 74 |             87.7 / 54.9 / 89.5 |
| _T. rex_ 1 v _H. erectus_ 100 |  500 |      92.6 (90.0–94.6) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    310 / 41 / 45 |             98.0 / 92.8 / 97.2 |

| Match-up (A v B)              |    B wins, flank |   B wins, direct |     B wins, free | Draws (flank / direct / free) |
| ----------------------------- | ---------------: | ---------------: | ---------------: | ----------------------------: |
| _T. rex_ 10 v tiger 100       |    0.0 (0.0–0.8) |    0.0 (0.0–0.8) |    0.0 (0.0–0.8) |               0.0 / 0.0 / 0.0 |
| _T. rex_ 1 v tiger 10         |  10.4 (8.7–12.4) |    0.0 (0.0–0.4) |    0.0 (0.0–0.4) |               1.7 / 0.0 / 1.0 |
| elephant 5 v lion 30          |    0.0 (0.0–0.8) |    0.0 (0.0–0.8) |    0.0 (0.0–0.8) |               1.8 / 0.0 / 0.0 |
| buffalo 1 v lion 6            | 58.4 (55.3–61.4) | 12.3 (10.4–14.5) | 83.2 (80.8–85.4) |               0.5 / 0.0 / 0.1 |
| buffalo 1 v hyena 15          | 95.7 (94.3–96.8) | 41.7 (38.7–44.8) | 73.8 (71.0–76.4) |               0.0 / 0.0 / 0.0 |
| brown bear 1 v wolf 8         | 42.2 (39.2–45.3) |    1.2 (0.7–2.1) | 30.2 (27.4–33.1) |               0.4 / 0.0 / 0.0 |
| brown bear 1 v tiger 1        |    0.0 (0.0–0.2) |    0.0 (0.0–0.2) | 21.5 (19.8–23.4) |               8.5 / 0.0 / 0.7 |
| mammoth 1 v wolf 12           |    0.0 (0.0–0.4) |    0.0 (0.0–0.4) |    0.0 (0.0–0.4) |               7.1 / 0.0 / 0.0 |
| _T. rex_ 1 v _H. erectus_ 100 |    5.2 (3.6–7.5) |    0.0 (0.0–0.8) |    0.0 (0.0–0.8) |               2.2 / 0.0 / 0.0 |

Per preset (classification in §8):

- **10 _T. rex_ v 100 tigers, 1 _T. rex_ v 10 tigers:** as §3. Same winner; free durations and rout shares differ for the reasons given there.
- **5 elephants v 30 lions:** all three agree (98–100 % elephants). Free is shorter (46 s) and more of the losing lions flee (89 %).
- **1 buffalo v 6 lions:** the largest gap. Lions win 83.2 % in free, 58.4 % with `flank`, 12.3 % with `direct`. The pack buff's coordinated approach and group latching (E1, E3) make the free lions stronger than either classic tactic. The field target is qualitative ("lions are the buffalo's main predator", and buffalo sometimes drive lions off, SPECIES.md §5), so a lion-favoured result is plausible; how strongly is not measured anywhere. Watch item, no issue.
- **1 buffalo v 15 hyenas:** free gives the buffalo 26.2 % (classic `flank` 4.3 %, which SPECIES.md §7 flagged as "too easy for hyenas"; `direct` 58.3 %). Free moves toward the field record (adult bulls taken only occasionally), but hyenas still win most runs. Watch item.
- **1 brown bear v 8 wolves:** bear 69.8 % in free, 57.4 % `flank`, 98.8 % `direct`. "Bears usually dominate" (SPECIES.md §7): free is closer to that than classic's default.
- **1 brown bear v 1 tiger:** the tiger wins 21.5 % in free and never in classic. In free the tiger cannot latch onto a bear of similar mass (ρ ≈ 1.2 < `R_latch`), so they exchange strikes: the change FREE-MATCHUPS.md §4.2 intended. Field records are mixed (32 recorded tiger attacks on bears, 4 cases in which the bear prevailed; SPECIES.md §5), so a bear-favoured duel the tiger sometimes wins is more plausible than classic's 0 %.
- **1 mammoth v 12 wolves:** all agree (93–100 % mammoth); free removes classic's 7 % stand-off draws.
- **1 _T. rex_ v 100 _H. erectus_:** all agree (93–100 % _T. rex_); 97 % of the losing hominins flee in free (preset on hold under R4).

## 5. Free vs classic: the other calibration match-ups

The match-ups of [SPECIES.md §7](../SPECIES.md#7-calibration-notes) that are not presets, 500 runs each.

### SPECIES.md §7 match-ups

| Match-up (A v B)                | Runs | A wins, classic flank | A wins, classic direct |       A wins, free |     Free − direct (pp) | Median s (flank / direct / free) | Rout % (flank / direct / free) |
| ------------------------------- | ---: | --------------------: | ---------------------: | -----------------: | ---------------------: | -------------------------------: | -----------------------------: |
| elephant 1 v lion 27            |  500 |      62.4 (58.1–66.5) |       98.6 (97.1–99.3) |   94.2 (91.8–95.9) |    -4.4 (-6.9 to -2.1) |                  575 / 271 / 127 |             91.4 / 76.1 / 95.0 |
| buffalo 10 v lion 12            |  500 |    100.0 (99.2–100.0) |     100.0 (99.2–100.0) |   99.6 (98.6–99.9) |     -0.4 (-1.4 to 0.4) |                     72 / 60 / 36 |             58.5 / 65.0 / 94.3 |
| _T. rex_ 1 v lion 30            |  500 |      13.2 (10.5–16.4) |       99.4 (98.3–99.8) |   79.8 (76.1–83.1) | -19.6 (-23.4 to -16.1) |                  208 / 133 / 103 |             77.7 / 61.7 / 89.9 |
| _T. rex_ 1 v wolf 50            |  500 |      47.2 (42.9–51.6) |     100.0 (99.2–100.0) |  99.8 (98.9–100.0) |     -0.2 (-1.1 to 0.6) |                    233 / 39 / 42 |             96.0 / 85.0 / 93.6 |
| mammoth 1 v wolf 30             |  500 |      89.4 (86.4–91.8) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    340 / 91 / 56 |             95.6 / 79.1 / 93.7 |
| mammoth 1 v hyena 15            |  500 |      85.6 (82.3–88.4) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    326 / 71 / 66 |             93.3 / 64.8 / 92.3 |
| mammoth 1 v lion 20             |  500 |      77.0 (73.1–80.5) |     100.0 (99.2–100.0) |   96.6 (94.6–97.9) |    -3.4 (-5.4 to -1.9) |                  644 / 251 / 142 |             87.2 / 64.6 / 92.7 |
| _T. rex_ 1 v _H. erectus_ 30    |  500 |      96.8 (94.9–98.0) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    258 / 34 / 49 |             93.2 / 83.5 / 91.8 |
| _T. rex_ 1 v _H. erectus_ 300   |  500 |      38.8 (34.6–43.1) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    195 / 54 / 44 |             98.9 / 96.1 / 99.0 |
| elephant 1 v _H. erectus_ 30    |  500 |      97.4 (95.6–98.5) |     100.0 (99.2–100.0) | 100.0 (99.2–100.0) |     +0.0 (-0.8 to 0.8) |                    237 / 61 / 59 |             94.6 / 84.8 / 94.0 |
| buffalo 1 v _H. erectus_ 20     |  500 |      90.8 (87.9–93.0) |      99.8 (98.9–100.0) |   99.0 (97.7–99.6) |     -0.8 (-2.1 to 0.3) |                    198 / 85 / 69 |             81.6 / 79.7 / 93.8 |
| _H. erectus_ 1 v wolf 1         |  500 |      55.8 (51.4–60.1) |       21.6 (18.2–25.4) |      0.0 (0.0–0.8) | -21.6 (-25.4 to -18.1) |                   360 / 104 / 30 |             11.4 / 1.8 / 100.0 |
| _H. erectus_ 1 v wolf 3         |  500 |         0.0 (0.0–0.8) |          0.2 (0.0–1.1) |      0.0 (0.0–0.8) |     -0.2 (-1.1 to 0.6) |                     30 / 39 / 24 |              0.0 / 0.0 / 100.0 |
| _H. erectus_ 1 v hyena 1        |  500 |      29.8 (26.0–34.0) |          2.2 (1.2–3.9) |      0.0 (0.0–0.8) |    -2.2 (-3.9 to -1.0) |                    401 / 52 / 27 |             11.3 / 0.2 / 100.0 |
| _H. erectus_ 1 v tiger 1        |  500 |       11.6 (9.1–14.7) |          1.2 (0.6–2.6) |      0.0 (0.0–0.8) |    -1.2 (-2.6 to -0.2) |                    363 / 63 / 24 |              12.9 / 1.2 / 99.8 |
| _H. erectus_ 1 v lion 1         |  500 |      19.2 (16.0–22.9) |          1.6 (0.8–3.1) |      0.0 (0.0–0.8) |    -1.6 (-3.1 to -0.5) |                    278 / 59 / 26 |              19.1 / 1.6 / 99.6 |
| _H. erectus_ 1 v _H. erectus_ 1 |  500 |      79.0 (75.2–82.3) |       68.8 (64.6–72.7) |   50.2 (45.8–54.6) | -18.6 (-24.5 to -12.5) |                  461 / 190 / 229 |              32.9 / 19.6 / 0.0 |
| _H. erectus_ 1 v _H. erectus_ 2 |  500 |         6.8 (4.9–9.4) |       13.8 (11.1–17.1) |     7.8 (5.8–10.5) |    -6.0 (-9.9 to -2.2) |                  203 / 160 / 187 |                3.9 / 6.2 / 0.4 |

| Match-up (A v B)                |      B wins, flank |    B wins, direct |       B wins, free | Draws (flank / direct / free) |
| ------------------------------- | -----------------: | ----------------: | -----------------: | ----------------------------: |
| elephant 1 v lion 27            |   30.8 (26.9–35.0) |     1.4 (0.7–2.9) |      5.8 (4.1–8.2) |               6.8 / 0.0 / 0.0 |
| buffalo 10 v lion 12            |      0.0 (0.0–0.8) |     0.0 (0.0–0.8) |      0.4 (0.1–1.4) |               0.0 / 0.0 / 0.0 |
| _T. rex_ 1 v lion 30            |   86.6 (83.3–89.3) |     0.6 (0.2–1.7) |   20.2 (16.9–23.9) |               0.2 / 0.0 / 0.0 |
| _T. rex_ 1 v wolf 50            |   52.8 (48.4–57.1) |     0.0 (0.0–0.8) |      0.2 (0.0–1.1) |               0.0 / 0.0 / 0.0 |
| mammoth 1 v wolf 30             |      2.0 (1.1–3.6) |     0.0 (0.0–0.8) |      0.0 (0.0–0.8) |               8.6 / 0.0 / 0.0 |
| mammoth 1 v hyena 15            |      2.4 (1.4–4.1) |     0.0 (0.0–0.8) |      0.0 (0.0–0.8) |              12.0 / 0.0 / 0.0 |
| mammoth 1 v lion 20             |     9.2 (7.0–12.1) |     0.0 (0.0–0.8) |      2.8 (1.7–4.6) |              13.8 / 0.0 / 0.6 |
| _T. rex_ 1 v _H. erectus_ 30    |      0.0 (0.0–0.8) |     0.0 (0.0–0.8) |      0.0 (0.0–0.8) |               3.2 / 0.0 / 0.0 |
| _T. rex_ 1 v _H. erectus_ 300   |   60.8 (56.5–65.0) |     0.0 (0.0–0.8) |      0.0 (0.0–0.8) |               0.4 / 0.0 / 0.0 |
| elephant 1 v _H. erectus_ 30    |      0.0 (0.0–0.8) |     0.0 (0.0–0.8) |      0.0 (0.0–0.8) |               2.6 / 0.0 / 0.0 |
| buffalo 1 v _H. erectus_ 20     |     7.8 (5.8–10.5) |     0.2 (0.0–1.1) |      1.0 (0.4–2.3) |               1.4 / 0.0 / 0.0 |
| _H. erectus_ 1 v wolf 1         |   40.4 (36.2–44.8) |  78.4 (74.6–81.8) | 100.0 (99.2–100.0) |               3.8 / 0.0 / 0.0 |
| _H. erectus_ 1 v wolf 3         | 100.0 (99.2–100.0) | 99.8 (98.9–100.0) | 100.0 (99.2–100.0) |               0.0 / 0.0 / 0.0 |
| _H. erectus_ 1 v hyena 1        |   64.2 (59.9–68.3) |  97.8 (96.1–98.8) | 100.0 (99.2–100.0) |               6.0 / 0.0 / 0.0 |
| _H. erectus_ 1 v tiger 1        |   77.0 (73.1–80.5) |  98.8 (97.4–99.4) | 100.0 (99.2–100.0) |              11.4 / 0.0 / 0.0 |
| _H. erectus_ 1 v lion 1         |   76.2 (72.3–79.7) |  98.4 (96.9–99.2) | 100.0 (99.2–100.0) |               4.6 / 0.0 / 0.0 |
| _H. erectus_ 1 v _H. erectus_ 1 |   17.6 (14.5–21.2) |  31.2 (27.3–35.4) |   49.8 (45.4–54.2) |               3.4 / 0.0 / 0.0 |
| _H. erectus_ 1 v _H. erectus_ 2 |   93.0 (90.4–94.9) |  86.2 (82.9–88.9) |   92.0 (89.3–94.1) |               0.2 / 0.0 / 0.2 |

- **Lone heavies against prides and packs** (elephant v 27 lions, mammoth v 20 lions, _T. rex_ v 30 lions, _T. rex_ v 50 wolves): free sits close to `direct` for wolves and between the two tactics for lions, as the buff predicts. A lone adult elephant holds in 94.2 % (classic `flank` 62.4 %, a value SPECIES.md §7 reached only with `hide`): consistent with adults being "considered invulnerable to predation".
- **The role artefact is gone.** One _H. erectus_ against one: 50.2 % in free, against 79.0 % (`flank`) for the classic heavy role. Against two, the pair wins 86–93 % on every engine.
- **A lone _H. erectus_ never beats any carnivore** (wolf, hyena, tiger, lion: 0 of 500 each, median 24–30 s, the hominin flees in 99.6–100 % of losses). SPECIES.md §7's target was "the hominin loses most runs"; zero wins against a lighter wolf overshoots it. Filed as **#167**.
- **_T. rex_ against 300 _H. erectus_**: classic `flank` lets the crowd win 60.8 %; free and `direct` never. Thought experiment only; no evidence either way.

## 6. Free-model checks

### Mirror matches (free engine)

| Mirror                            | Runs |           A wins |           B wins | Draws |  A − B (pp, paired) | 0 inside? | Median s | Rout % |
| --------------------------------- | ---: | ---------------: | ---------------: | ----: | ------------------: | --------: | -------: | -----: |
| _T. rex_ 1 v _T. rex_ 1           | 1000 | 49.8 (46.7–52.9) | 49.9 (46.8–53.0) |   0.3 |  -0.1 (-6.3 to 6.1) |       yes |       97 |   99.9 |
| elephant 1 v elephant 1           | 1000 | 49.4 (46.3–52.5) | 50.5 (47.4–53.6) |   0.1 |  -1.1 (-7.3 to 5.1) |       yes |      153 |   99.9 |
| buffalo 1 v buffalo 1             | 1000 | 49.3 (46.2–52.4) | 50.5 (47.4–53.6) |   0.2 |  -1.2 (-7.4 to 5.0) |       yes |       73 |  100.0 |
| brown bear 1 v brown bear 1       | 1000 | 50.9 (47.8–54.0) | 48.9 (45.8–52.0) |   0.2 |  +2.0 (-4.2 to 8.2) |       yes |       76 |  100.0 |
| mammoth 1 v mammoth 1             | 1000 | 49.4 (46.3–52.5) | 50.5 (47.4–53.6) |   0.1 |  -1.1 (-7.3 to 5.1) |       yes |      142 |  100.0 |
| tiger 1 v tiger 1                 | 1000 | 50.3 (47.2–53.4) | 49.1 (46.0–52.2) |   0.6 |  +1.2 (-5.0 to 7.4) |       yes |       22 |  100.0 |
| lion 1 v lion 1                   | 1000 | 49.4 (46.3–52.5) | 49.7 (46.6–52.8) |   0.9 |  -0.3 (-6.5 to 5.9) |       yes |       23 |  100.0 |
| wolf 1 v wolf 1                   | 1000 | 52.2 (49.1–55.3) | 46.6 (43.5–49.7) |   1.2 | +5.6 (-0.6 to 11.8) |       yes |       24 |  100.0 |
| hyena 1 v hyena 1                 | 1000 | 51.1 (48.0–54.2) | 47.3 (44.2–50.4) |   1.6 |  +3.8 (-2.3 to 9.9) |       yes |       22 |   99.9 |
| _H. erectus_ 1 v _H. erectus_ 1   | 1000 | 50.2 (47.1–53.3) | 49.7 (46.6–52.8) |   0.1 |  +0.5 (-5.7 to 6.7) |       yes |      233 |    0.0 |
| tiger 5 v tiger 5                 | 1000 | 48.5 (45.4–51.6) | 51.5 (48.4–54.6) |   0.0 |  -3.0 (-9.2 to 3.2) |       yes |       32 |  100.0 |
| lion 5 v lion 5                   | 1000 | 48.9 (45.8–52.0) | 51.1 (48.0–54.2) |   0.0 |  -2.2 (-8.4 to 4.0) |       yes |       24 |  100.0 |
| wolf 8 v wolf 8                   | 1000 | 50.4 (47.3–53.5) | 49.6 (46.5–52.7) |   0.0 |  +0.8 (-5.4 to 7.0) |       yes |       22 |  100.0 |
| _H. erectus_ 10 v _H. erectus_ 10 | 1000 | 51.0 (47.9–54.1) | 49.0 (45.9–52.1) |   0.0 |  +2.0 (-4.2 to 8.2) |       yes |      109 |   72.0 |

### Mirror recheck (free engine)

| Mirror          |     Seed | Runs |           A wins |           B wins | A − B (pp, paired) | 0 inside? |
| --------------- | -------: | ---: | ---------------: | ---------------: | -----------------: | --------: |
| wolf 1 v wolf 1 | 20261019 | 4000 | 50.5 (48.9–52.0) | 48.3 (46.7–49.8) | +2.2 (-0.9 to 5.3) |       yes |
| wolf 1 v wolf 1 |        1 | 4000 | 49.5 (47.9–51.0) | 49.8 (48.3–51.3) | -0.3 (-3.4 to 2.8) |       yes |
| wolf 1 v wolf 1 |        2 | 4000 | 49.2 (47.7–50.7) | 49.8 (48.3–51.4) | -0.6 (-3.7 to 2.5) |       yes |

The rechecks are supporting evidence only; the pass above does not depend on them.

### Side swaps (free engine)

| Pair                                            | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| ----------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| tiger 5 v lion 5 / lion 5 v tiger 5             | 1000 |    40.7 (37.7–43.8) |           43.4 (40.4–46.5) | -2.7 (-7.0 to 1.6) |       yes |
| brown bear 1 v wolf 10 / wolf 10 v brown bear 1 | 1000 |    64.1 (61.1–67.0) |           62.4 (59.4–65.3) | +1.7 (-2.5 to 5.9) |       yes |
| _T. rex_ 1 v tiger 10 / tiger 10 v _T. rex_ 1   | 1000 |    99.0 (98.2–99.5) |           99.6 (99.0–99.8) | -0.6 (-1.5 to 0.2) |       yes |

- **Mirror matches: pass, 14 of 14.** Every paired interval for A − B contains 0. The largest gap, one wolf against one (+5.6 pp, −0.6 to 11.8 at 1,000 runs), was rerun as supporting evidence: +2.2 pp (−0.9 to 5.3) at 4,000 runs on the same seed, and −0.3 and −0.6 pp on two other seeds. The simultaneous resolution (FREE-MATCHUPS.md §4.6) holds.
- **Side swaps: pass.** The P8 runs 5 tigers v 5 lions and 10 wolves v 1 brown bear, and 1 _T. rex_ v 10 tigers, give the same result in either order within the interval. In 5 v 5 the lions win about 57–59 % and the tigers about 41–43 % in either order.
- **One on one, the loser flees** in practically every mirror (rout share 99.9–100 %), except _H. erectus_ (0 %), whose weak blows rarely move morale. Already recorded in PRESETS.md; part of R4.

### Count sweep: one brown bear vs wolves

| Match-up               | Runs |            A wins |           B wins | Median s | Rout % | Step |
| ---------------------- | ---: | ----------------: | ---------------: | -------: | -----: | ---: |
| brown bear 1 v wolf 1  |  500 | 99.8 (98.9–100.0) |    0.2 (0.0–1.1) |       37 |   91.2 |      |
| brown bear 1 v wolf 2  |  500 |  95.8 (93.7–97.2) |    3.6 (2.3–5.6) |       82 |   94.5 |   ok |
| brown bear 1 v wolf 4  |  500 |  85.4 (82.0–88.2) | 14.6 (11.8–18.0) |      107 |   96.6 |   ok |
| brown bear 1 v wolf 6  |  500 |  75.6 (71.6–79.2) | 24.4 (20.8–28.4) |       80 |   96.7 |   ok |
| brown bear 1 v wolf 8  |  500 |  68.8 (64.6–72.7) | 31.2 (27.3–35.4) |       69 |   97.1 |   ok |
| brown bear 1 v wolf 10 |  500 |  61.2 (56.9–65.4) | 38.8 (34.6–43.1) |       61 |   96.9 |   ok |
| brown bear 1 v wolf 12 |  500 |  53.8 (49.4–58.1) | 46.2 (41.9–50.6) |       57 |   96.8 |   ok |
| brown bear 1 v wolf 16 |  500 |  40.0 (35.8–44.4) | 60.0 (55.6–64.2) |       50 |   95.9 |   ok |
| brown bear 1 v wolf 20 |  500 |  31.8 (27.9–36.0) | 68.2 (64.0–72.1) |       47 |   95.7 |   ok |

### Count sweep: one buffalo vs wolves

| Match-up            | Runs |             A wins |           B wins | Median s | Rout % | Step |
| ------------------- | ---: | -----------------: | ---------------: | -------: | -----: | ---: |
| buffalo 1 v wolf 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |       35 |   13.4 |      |
| buffalo 1 v wolf 2  |  500 |  99.8 (98.9–100.0) |    0.2 (0.0–1.1) |       81 |   35.2 |   ok |
| buffalo 1 v wolf 3  |  500 |   98.2 (96.6–99.1) |    1.8 (0.9–3.4) |      125 |   49.8 |   ok |
| buffalo 1 v wolf 4  |  500 |   93.8 (91.3–95.6) |    6.0 (4.2–8.4) |      127 |   60.2 |   ok |
| buffalo 1 v wolf 6  |  500 |   86.0 (82.7–88.8) | 14.0 (11.2–17.3) |      124 |   75.1 |   ok |
| buffalo 1 v wolf 8  |  500 |   78.0 (74.2–81.4) | 22.0 (18.6–25.8) |      107 |   80.6 |   ok |
| buffalo 1 v wolf 10 |  500 |   75.6 (71.6–79.2) | 24.4 (20.8–28.4) |       94 |   83.8 |   ok |
| buffalo 1 v wolf 12 |  500 |   69.2 (65.0–73.1) | 30.8 (26.9–35.0) |       84 |   85.2 |   ok |
| buffalo 1 v wolf 14 |  500 |   66.0 (61.7–70.0) | 34.0 (30.0–38.3) |       73 |   86.7 |   ok |
| buffalo 1 v wolf 16 |  500 |   62.6 (58.3–66.7) | 37.4 (33.3–41.7) |       68 |   87.6 |   ok |
| buffalo 1 v wolf 20 |  500 |   54.8 (50.4–59.1) | 45.2 (40.9–49.6) |       60 |   88.6 |   ok |
| buffalo 1 v wolf 25 |  500 |   46.8 (42.5–51.2) | 53.2 (48.8–57.5) |       53 |   89.0 |   ok |

### Count sweep: one buffalo vs lions

| Match-up            | Runs |           A wins |           B wins | Median s | Rout % | Step |
| ------------------- | ---: | ---------------: | ---------------: | -------: | -----: | ---: |
| buffalo 1 v lion 1  |  500 | 98.2 (96.6–99.1) |    1.8 (0.9–3.4) |       39 |   84.2 |      |
| buffalo 1 v lion 2  |  500 | 78.0 (74.2–81.4) | 22.0 (18.6–25.8) |      161 |   84.5 |   ok |
| buffalo 1 v lion 3  |  500 | 61.2 (56.9–65.4) | 38.6 (34.4–42.9) |      206 |   83.7 |   ok |
| buffalo 1 v lion 4  |  500 | 38.4 (34.2–42.7) | 61.2 (56.9–65.4) |      190 |   79.3 |   ok |
| buffalo 1 v lion 6  |  500 | 18.0 (14.9–21.6) | 81.8 (78.2–84.9) |      141 |   74.6 |   ok |
| buffalo 1 v lion 8  |  500 |  11.6 (9.1–14.7) | 88.4 (85.3–90.9) |       86 |   70.8 |   ok |
| buffalo 1 v lion 10 |  500 |    7.0 (5.1–9.6) | 93.0 (90.4–94.9) |       58 |   66.5 |   ok |

### Count sweep: one elephant vs lions

| Match-up             | Runs |           A wins |           B wins | Median s | Rout % | Step |
| -------------------- | ---: | ---------------: | ---------------: | -------: | -----: | ---: |
| elephant 1 v lion 5  |  300 | 95.7 (92.7–97.5) |    2.3 (1.1–4.7) |      304 |   73.2 |      |
| elephant 1 v lion 10 |  300 | 96.0 (93.1–97.7) |    2.3 (1.1–4.7) |      195 |   88.8 |   ok |
| elephant 1 v lion 20 |  300 | 94.7 (91.5–96.7) |    5.3 (3.3–8.5) |      145 |   94.3 |   ok |
| elephant 1 v lion 30 |  300 | 92.0 (88.4–94.6) |   8.0 (5.4–11.6) |      125 |   95.7 |   ok |
| elephant 1 v lion 40 |  300 | 86.3 (82.0–89.8) | 13.7 (10.2–18.0) |      113 |   96.2 |   ok |
| elephant 1 v lion 60 |  300 | 73.3 (68.1–78.0) | 26.7 (22.0–31.9) |       97 |   97.0 |   ok |

- **Monotonic in count: pass.** In all four sweeps the larger side's win share never drops by more than its interval allows between neighbouring counts.
- **Wolf-vs-buffalo plateau guard: passes the test, not the design's wording.** `tests/free-buff.test.ts` requires p(12) ≥ ½ p(24); measured p(12) = 30.8 %, p(25) = 53.2 %. FREE-MATCHUPS.md §5.3 asks the curve to "keep its plateau inside 9–13" [MacNulty 2014]; the measured curve keeps climbing at about the same slope past 13. The model measures "incapacitated or fled within 20 minutes", the field data capture per hunt, so only the shape compares. Filed as **#168** to decide what the guard should require.
- **The bear-vs-wolves sweep** crosses 50 % between 12 and 16 wolves; the Simple preset (8 wolves) leaves the bear 68.8 %.

## 7. Simple presets against the evidence

500 runs each at the default seed (the fixture in `tests/fixtures/preset-shares.json` uses 200; every win share here is within 5 points of the fixture's, and every preset gets the same check outcome and `close` tag).

### Presets (free engine)

| Preset                   |                         Sides | Runs |             A wins |           B wins | Draws | Median s | Rout % | Status |
| ------------------------ | ----------------------------: | ---: | -----------------: | ---------------: | ----: | -------: | -----: | -----: |
| `lion-tiger`             |              lion 1 v tiger 1 |  500 |   56.0 (51.6–60.3) | 42.8 (38.5–47.2) |   1.2 |       22 |  100.0 |  ready |
| `pride-five-tigers`      |              lion 5 v tiger 5 |  500 |   57.8 (53.4–62.1) | 42.0 (37.8–46.4) |   0.2 |       27 |  100.0 |   hold |
| `tiger-bear`             |        tiger 1 v brown bear 1 |  500 |   23.6 (20.1–27.5) | 76.0 (72.1–79.5) |   0.4 |       33 |  100.0 |  ready |
| `bear-wolf-pack`         |         brown bear 1 v wolf 8 |  500 |   68.8 (64.6–72.7) | 31.2 (27.3–35.4) |   0.0 |       69 |   97.1 |  ready |
| `buffalo-pride`          |            buffalo 1 v lion 6 |  500 |   18.0 (14.9–21.6) | 81.8 (78.2–84.9) |   0.2 |      141 |   74.6 |  ready |
| `elephants-pride`        |          elephant 5 v lion 30 |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       46 |   89.0 |  ready |
| `mammoth-wolves`         |           mammoth 1 v wolf 12 |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       75 |   89.1 |  ready |
| `trex-mirror`            |       _T. rex_ 1 v _T. rex_ 1 |  500 |   49.0 (44.6–53.4) | 50.8 (46.4–55.2) |   0.2 |       96 |  100.0 |  ready |
| `trex-squad-tiger-horde` |       _T. rex_ 10 v tiger 100 |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |      133 |    2.9 |  ready |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       45 |   97.2 |   hold |
| `lions-hyenas`           |             lion 3 v hyena 10 |  500 |   40.2 (36.0–44.6) | 59.6 (55.2–63.8) |   0.2 |       27 |   97.7 |   hold |

| Preset                     | Expectation (source)                                                                                                                                                                                                                     | Free result                              | Verdict                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `lion-tiger`               | No field data on adult fights; "Asiatic lions and Bengal tigers once shared parts of India" (Why?). Tigers are heavier (mass mode 180 vs 150 kg); the lion's bite force mode is higher (1.6 vs 1.35 kN, SPECIES.md §11.3). Expect close. | Lion 56.0 % (51.6–60.3), close tag holds | Plausible. The lion edge comes from the strike-force sheet, not mass; watch item.                  |
| `pride-five-tigers` (hold) | Prides vs solitary cats: the pack buff should favour lions (Why?).                                                                                                                                                                       | Lions 57.8 %                             | As expected; held for the rout check only (R4).                                                    |
| `tiger-bear`               | Tigers attack bears, bears sometimes win (SPECIES.md §5); records mainly subadult bears.                                                                                                                                                 | Bear 76.0 %                              | Plausible for an adult bear; better than classic's 0 % for the tiger.                              |
| `bear-wolf-pack`           | Bears usually dominate at carcasses; most meetings end without a fight (SPECIES.md §5, §7).                                                                                                                                              | Bear 68.8 %, 97 % of losing wolves flee  | Matches.                                                                                           |
| `buffalo-pride`            | Lions are the main predator; buffalo sometimes drive them off (SPECIES.md §5).                                                                                                                                                           | Lions 81.8 %                             | Direction matches; strength unmeasured (watch).                                                    |
| `elephants-pride`          | Herds hold; adults rarely taken (SPECIES.md §5, §7; Savuti records concern juveniles).                                                                                                                                                   | Elephants 100 %                          | Matches. Rout 89.0 %, just under the 90 % limit.                                                   |
| `mammoth-wolves`           | Adults "could effectively defend themselves" (SPECIES.md §7).                                                                                                                                                                            | Mammoth 100 %                            | Matches. Rout 89.1 %, just under the limit.                                                        |
| `trex-mirror`              | 50/50 by symmetry (Why?).                                                                                                                                                                                                                | 49.0 / 50.8 %                            | Matches.                                                                                           |
| `trex-squad-tiger-horde`   | Never met; tigers are solitary, so no group rout (Why?). Classic: _T. rex_ 100 %.                                                                                                                                                        | _T. rex_ 100 %, rout 2.9 %               | Winner matches. The Why? text is literally true, but 97 of 100 tigers end incapacitated: see #169. |
| `trex-erectus-100` (hold)  | Thought experiment; classic _T. rex_ 92.6 %.                                                                                                                                                                                             | _T. rex_ 100 %, rout 97.2 %              | Direction matches; held (R4).                                                                      |
| `lions-hyenas` (hold)      | Lions and hyenas compete; hyenas need numbers (SPECIES.md §8, M11). 10 v 3 is about 3.3 : 1.                                                                                                                                             | Hyenas 59.6 %, close tag holds           | Plausible; held (R4).                                                                              |

No ready preset contradicts its evidence on the winner. The one reading that conflicts with the recorded species behaviour is the tiger horde's near-total incapacitation (#169).

## 8. Expected differences and calibration problems

**Expected from model differences** (by design; no action):

1. Free ≈ classic `direct` for solitary attackers, and far from the default `flank` (§3): solitary animals do not flank in the free model.
2. Social attackers (lions, wolves, hyenas) do better in free than with classic `direct`, through the pack buff's coordinated approach and group latching, and mostly land between the two classic tactics; lions against a lone buffalo beat both (§4, §5).
3. Large animals can flee, so one-on-one duels end in a rout (rout share ≈ 100 %), and classic's 20-minute stand-offs and most draws disappear (§4, §6).
4. Tiger vs brown bear is a strike duel instead of a latch, so the tiger can win (§4).
5. The classic role artefact in same-species duels is gone (§5).
6. Durations shift: shorter duels, longer army battles (§3).

**Look like calibration problems** (filed):

1. **#169** Solitary animals almost never flee a much larger opponent (tiger rout share 3–12 % in free vs 52–93 % in classic). Design-consistent but against the tiger evidence; affects the ready flagship preset. Owner decision: per-species flight traits under a new model version, shipped as model 2 ([§19](#19-flight-traits-and-model-2-169-197)).
2. **#167** A lone _H. erectus_ never wins a duel against any carnivore and always flees.
3. **#168** The wolf-vs-buffalo curve has no plateau at 9–13; the guard test is looser than the design.

**Already known and tracked elsewhere:** one-on-one rout share 100 % and the three held presets (R4, PRESETS.md); `elephants-pride` and `mammoth-wolves` sit just under the 90 % rout limit (PRESETS.md); herd defence for elephants, buffalo and mammoths (#72); hunt success vs "incapacitate everyone" (SPECIES.md §8, M3).

**Watch items, no issue:** lion over tiger 1 v 1 (56 %) despite the tiger's mass; lions over a lone buffalo (82–83 %); hyenas over a lone buffalo (74 %).

## 9. Follow-up issues

| Issue                                                              | Kind                                                                 | Blocks the banner decision? |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------- |
| [#167](https://github.com/VinylStage/trex_vs_tiger_sim/issues/167) | Calibration: lone _H. erectus_ duels                                 | No (no ready preset)        |
| [#168](https://github.com/VinylStage/trex_vs_tiger_sim/issues/168) | Calibration guard: wolf-vs-buffalo plateau                           | No                          |
| [#169](https://github.com/VinylStage/trex_vs_tiger_sim/issues/169) | Calibration, owner decision: solitary animals rarely flee            | Done in model 2 (§19)       |
| [#170](https://github.com/VinylStage/trex_vs_tiger_sim/issues/170) | Docs: free-model traits on the parameters page (the missing P8 page) | Yes (part of the criterion) |

## 10. The R1 "provisional model" banner

**The banner.** `free.provisional` sits at the top of every free result, Simple mode included: "The free-matchup model is still being calibrated. These numbers are provisional; use them as a rough guide." Share texts carry "provisional model" (`free.context`).

**Its criterion.** R1 (a), accepted 2026-10-26, put Simple mode on the free engine "after a minimum P8 pass" (RENEWAL-1.0 §3.2):

1. free-model docs on the guide, model and parameters pages;
2. a calibration report comparing free and classic win shares for every classic preset that free mode can express, **signed off by the owner**;
3. a decision on the "provisional model" banner.

FREE-MATCHUPS.md D1 ties the same step to "free-model calibration (P8) is done". The M2 acceptance requires "the R1 banner decision applied".

**Where each part stands.**

| Part               | State                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1. Guide           | Done (Advanced manual, #158)                                                                                        |
| 1. Model page      | Done in #166 (`/model/#free-model`)                                                                                 |
| 1. Parameters page | **Open: #170**                                                                                                      |
| 2. Report          | Done (this document): all 9 classic presets compared, plus the T. rex vs tiger grid and the SPECIES.md §7 match-ups |
| 2. Owner sign-off  | **Open**                                                                                                            |
| 3. Banner decision | This recommendation; the owner decides                                                                              |

**Recommendation: keep the banner for now; remove it when three things are done.** The structural checks pass (mirror, side swap, monotonicity), no ready preset contradicts its evidence on the winner, and the large free-vs-classic differences are explained by deliberate model changes. So the model is fit to be the Simple default, which it already is. But the criterion is not met yet (parameters page, owner sign-off), and #169 changes how the flagship army preset reads. Remove the banner when:

1. the owner signs off this report (with any objections filed as issues),
2. #170 adds the free model to the parameters page, and
3. #169 is decided: either "keep it" (documented, nothing to wait for) or a retune shipped under a new model version. Decided 2026-11-02 and shipped as model 2 (§19); this condition is met once that change is merged.

Issues #167 and #168 need not hold the banner: no ready preset uses a lone _H. erectus_ against a carnivore, and the plateau question is about a guard's wording.

When it goes, the "provisional model" wording in the share contexts and the guide's `#advanced-limits` paragraph should change with it. A replacement could be the result's existing caveat link to the model page, which already says that results are statements about assumptions. This report changes no UI.

## 11. Owner decisions

1. **Sign off this report** (RENEWAL-1.0 §3.2 item 2), or list objections.
2. **#169**: decided 2026-11-02 (per-species flight traits under `mv` 2, with #197); measured in §19.
3. **The banner**: accept the recommendation in §10, remove it now, or keep it with other wording.
4. **R4 holds**: unchanged by this report; `pride-five-tigers`, `trex-erectus-100` and `lions-hyenas` still fail only the rout check.

## 12. Reproducing

```bash
npm ci
node scripts/calibration/run.mjs            # about 10 minutes on one core; writes docs/research/calibration-results.json
node scripts/calibration/tables.mjs         # prints every table in this report
node scripts/calibration/run.mjs --quick    # a tenth of the runs, writes nothing: a smoke test
node scripts/calibration/run.mjs --only trex-tiger --out /tmp/t.json   # one section
node scripts/calibration/run.mjs --only polar-bear   # writes docs/research/calibration-polar-bear.json (§13)
node scripts/calibration/tables.mjs docs/research/calibration-polar-bear.json
node scripts/calibration/run.mjs --only hippo        # writes docs/research/calibration-hippo.json (§14)
node scripts/calibration/tables.mjs docs/research/calibration-hippo.json
node scripts/calibration/run.mjs --only white-rhino  # writes docs/research/calibration-white-rhino.json (§16)
node scripts/calibration/tables.mjs docs/research/calibration-white-rhino.json
node scripts/calibration/run.mjs --only spinosaurus  # writes docs/research/calibration-spinosaurus.json (§17)
node scripts/calibration/tables.mjs docs/research/calibration-spinosaurus.json
node scripts/calibration/run.mjs --mv 2      # model 2 (§19): every section, flight included, to calibration-results-mv2.json
node scripts/calibration/run.mjs --mv 2 --only flight   # one section of model 2: calibration-flight-mv2.json
```

Sections: `trex-tiger`, `classic`, `presets`, `species-notes`, `interference`, `symmetry`, `monotonic`, `polar-bear` (§13) and `hippo` (§14). `--only <section>` without `--out` writes `calibration-<section>.json`, so one section never replaces the committed results. A full run writes every section, `polar-bear` and `hippo` included, to `calibration-results.json`, and `presets` then also measures `polar-bear-brown-bear` and `elephant-hippo`. Every batch has a fixed seed, so a rerun on the same commit gives the same numbers within the same JavaScript engine (MODEL.md §2.2). Measured with Node v22.22.0. When the free engine changes (a new `mv`), rerun both scripts with `--mv <n>`, which adds `-mv<n>` to the default file names so the older model's files stay as measured; update the tables and recheck §8 and §10. `--mv` defaults to 1, so the commands above still reproduce the model 1 files.

The tables in this report: generated from docs/research/calibration-results.json (commit 12b5968, v22.22.0).

## 13. Polar bear (#184)

Measured 2026-11-02 on the #184 branch at `bec0201` (engines unchanged, model version `mv` 1). The polar bear is the first species without a legacy entry (docs/SPECIES.md §4.11), so it runs on the free engine only and has no classic comparison. These are the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5, a sanity check against the brown bear and the tiger, its flight behaviour under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep of its **S** values. Raw data: `calibration-polar-bear.json` (section `polar-bear`); §1–§12 and `calibration-results.json` are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror                      | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| --------------------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| polar bear 1 v polar bear 1 | 1000 | 49.7 (46.6–52.8) | 50.1 (47.0–53.2) |   0.2 | -0.4 (-6.6 to 5.8) |       yes |       72 |
| polar bear 3 v polar bear 3 | 1000 | 49.9 (46.8–53.0) | 50.1 (47.0–53.2) |   0.0 | -0.2 (-6.4 to 6.0) |       yes |       81 |

### Count sweeps

One polar bear against wolves and against tigers (side B varies), and polar bears against one _T. rex_ (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule.

| Match-up               | Runs |             A wins |           B wins | Draws | Median s | Rout % | Step |
| ---------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: | ---: |
| polar bear 1 v wolf 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       36 |   80.2 |      |
| polar bear 1 v wolf 2  |  500 |   98.6 (97.1–99.3) |    0.8 (0.3–2.0) |   0.6 |      128 |   87.7 |   ok |
| polar bear 1 v wolf 4  |  500 |   97.0 (95.1–98.2) |    2.6 (1.5–4.4) |   0.4 |      154 |   95.6 |   ok |
| polar bear 1 v wolf 6  |  500 |   94.8 (92.5–96.4) |    5.2 (3.6–7.5) |   0.0 |       91 |   96.8 |   ok |
| polar bear 1 v wolf 8  |  500 |   92.6 (90.0–94.6) |   7.4 (5.4–10.0) |   0.0 |       80 |   97.3 |   ok |
| polar bear 1 v wolf 10 |  500 |   88.0 (84.9–90.6) |  12.0 (9.4–15.1) |   0.0 |       71 |   97.5 |   ok |
| polar bear 1 v wolf 12 |  500 |   86.0 (82.7–88.8) | 14.0 (11.2–17.3) |   0.0 |       66 |   97.7 |   ok |
| polar bear 1 v wolf 16 |  500 |   77.2 (73.3–80.7) | 22.8 (19.3–26.7) |   0.0 |       59 |   97.9 |   ok |
| polar bear 1 v wolf 20 |  500 |   69.6 (65.4–73.5) | 30.2 (26.3–34.4) |   0.2 |       54 |   97.8 |   ok |
| polar bear 1 v wolf 25 |  500 |   60.0 (55.6–64.2) | 40.0 (35.8–44.4) |   0.0 |       52 |   97.8 |   ok |
| polar bear 1 v wolf 30 |  500 |   51.8 (47.4–56.1) | 48.2 (43.9–52.6) |   0.0 |       48 |   97.9 |   ok |

| Match-up               | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| ---------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| polar bear 1 v tiger 1 |  500 | 97.8 (96.1–98.8) |    2.2 (1.2–3.9) |   0.0 |       34 |  100.0 |      |
| polar bear 1 v tiger 2 |  500 | 74.0 (70.0–77.7) | 25.8 (22.2–29.8) |   0.2 |       44 |  100.0 |   ok |
| polar bear 1 v tiger 3 |  500 | 50.0 (45.6–54.4) | 49.6 (45.2–54.0) |   0.4 |       46 |  100.0 |   ok |
| polar bear 1 v tiger 4 |  500 | 31.8 (27.9–36.0) | 68.2 (64.0–72.1) |   0.0 |       42 |   99.9 |   ok |
| polar bear 1 v tiger 5 |  500 | 21.4 (18.0–25.2) | 78.6 (74.8–82.0) |   0.0 |       38 |   99.9 |   ok |
| polar bear 1 v tiger 6 |  500 |  12.4 (9.8–15.6) | 87.4 (84.2–90.0) |   0.2 |       35 |   99.9 |   ok |

| Match-up                   | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| -------------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| polar bear 1 v _T. rex_ 1  |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       64 |   27.8 |      |
| polar bear 2 v _T. rex_ 1  |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       74 |   25.7 |   ok |
| polar bear 4 v _T. rex_ 1  |  500 |    0.2 (0.0–1.1) |  99.8 (98.9–100.0) |   0.0 |       94 |   23.3 |   ok |
| polar bear 6 v _T. rex_ 1  |  500 |    3.0 (1.8–4.9) |   97.0 (95.1–98.2) |   0.0 |      117 |   20.5 |   ok |
| polar bear 8 v _T. rex_ 1  |  500 |   8.2 (6.1–10.9) |   91.6 (88.8–93.7) |   0.2 |      137 |   17.7 |   ok |
| polar bear 10 v _T. rex_ 1 |  500 | 15.4 (12.5–18.8) |   84.6 (81.2–87.5) |   0.0 |      154 |   17.3 |   ok |
| polar bear 12 v _T. rex_ 1 |  500 | 25.2 (21.6–29.2) |   74.8 (70.8–78.4) |   0.0 |      173 |   17.1 |   ok |
| polar bear 16 v _T. rex_ 1 |  500 | 46.6 (42.3–51.0) |   53.4 (49.0–57.7) |   0.0 |      182 |   16.8 |   ok |

### Side swaps

| Pair                                                      | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| --------------------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| polar bear 1 v brown bear 1 / brown bear 1 v polar bear 1 | 1000 |    83.4 (81.0–85.6) |           82.4 (79.9–84.6) | +1.0 (-2.3 to 4.3) |       yes |
| polar bear 1 v tiger 1 / tiger 1 v polar bear 1           | 1000 |    97.3 (96.1–98.1) |           96.4 (95.1–97.4) | +0.9 (-0.7 to 2.5) |       yes |

### Next to the brown bear

The same opponents against one brown bear, for comparison (the polar bear rows of the side swaps above give its duels with the brown bear and the tiger).

| Match-up                 | Runs |           A wins |           B wins | Draws | Median s | Rout % |
| ------------------------ | ---: | ---------------: | ---------------: | ----: | -------: | -----: |
| brown bear 1 v tiger 1   | 1000 | 78.2 (75.5–80.6) | 21.0 (18.6–23.6) |   0.8 |       32 |  100.0 |
| polar bear 1 v wolf 8    | 1000 | 91.5 (89.6–93.1) |   8.5 (6.9–10.4) |   0.0 |       75 |   97.3 |
| brown bear 1 v wolf 8    | 1000 | 69.8 (66.9–72.6) | 30.2 (27.4–33.1) |   0.0 |       68 |   96.9 |
| polar bear 1 v lion 1    | 1000 | 96.1 (94.7–97.1) |    3.9 (2.9–5.3) |   0.0 |       38 |   99.9 |
| brown bear 1 v lion 1    | 1000 | 74.8 (72.0–77.4) | 24.5 (21.9–27.3) |   0.7 |       36 |  100.0 |
| polar bear 1 v buffalo 1 | 1000 | 19.9 (17.5–22.5) | 80.0 (77.4–82.4) |   0.1 |       71 |   99.9 |
| brown bear 1 v buffalo 1 | 1000 |    6.6 (5.2–8.3) | 93.2 (91.5–94.6) |   0.2 |       73 |   96.5 |

### Much larger opponents

| Match-up                  | Runs |        A wins |             B wins | Draws | Median s | Rout % |
| ------------------------- | ---: | ------------: | -----------------: | ----: | -------: | -----: |
| polar bear 1 v _T. rex_ 1 | 1000 | 0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       64 |   28.1 |
| polar bear 1 v elephant 1 | 1000 | 0.6 (0.3–1.3) |   99.4 (98.7–99.7) |   0.0 |       82 |   77.3 |
| polar bear 1 v mammoth 1  | 1000 | 0.4 (0.2–1.0) |   99.6 (99.0–99.8) |   0.0 |       82 |   69.6 |

### One-at-a-time sensitivity

Polar bear 1 v brown bear 1 (the preset), 1,000 runs per row: each **S** trait of the polar bear pinned at its preset min, then at its max. The swing is the change in the polar bear's win share from min to max. The constant `hide` (0.5) cannot be pinned through a config and only scales damage from a latcher, which the brown bear is not.

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |          – |                   71 |
| `turnRate`        |      50 – 180 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |
| `sprintEndurance` |      20 – 120 | 79.3 (76.7–81.7) | 83.7 (81.3–85.9) |       +4.4 |              71 / 71 |
| `recoveryTime`    |      45 – 180 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |
| `strikeForce`     |     0.8 – 3.5 | 55.2 (52.1–58.3) | 94.9 (93.4–96.1) |      +39.7 |              84 / 65 |
| `strikeLethality` |        4 – 12 | 61.1 (58.0–64.1) | 91.7 (89.8–93.3) |      +30.6 |              81 / 67 |
| `strikeInterval`  |       0.8 – 3 | 96.4 (95.1–97.4) | 66.0 (63.0–68.9) |      -30.4 |              64 / 79 |
| `strikeReach`     |       1.3 – 2 | 83.1 (80.7–85.3) | 83.4 (81.0–85.6) |       +0.3 |              71 / 71 |
| `strikeArc`       |      45 – 100 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |
| `strikeAccuracy`  |    0.3 – 0.65 | 68.7 (65.8–71.5) | 91.3 (89.4–92.9) |      +22.6 |              78 / 67 |
| `shakeRate`       |     0.1 – 0.5 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |
| `bleed`           | 0.001 – 0.006 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |
| `morale`          |    0.55 – 0.9 | 70.7 (67.8–73.4) | 90.7 (88.7–92.3) |      +20.0 |              70 / 72 |
| `moraleLoss`      |    0.02 – 0.1 | 83.4 (81.0–85.6) | 83.4 (81.0–85.6) |       +0.0 |              71 / 71 |

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: −0.4 pp (−6.6 to 5.8); 3 v 3: −0.2 pp (−6.4 to 6.0), paired interval.                                                                                                                                                |
| Win share monotonic in count     | **Pass.** No drop in any of the three sweeps: the wolves reach about 50 % at 30 (against the brown bear they cross it at 12–16, §6), tigers at 3, and 16 polar bears bring one _T. rex_ to 46.6 %.                                    |
| Side order                       | **Pass.** Both swaps agree within the interval (+1.0 and +0.9 pp).                                                                                                                                                                    |
| Documented interactions          | **Nothing to compare.** The only recorded interaction in the sources (young walruses hunted, adults too formidable, [WP]) involves a species not in the roster; no field record of the polar bear against a roster species was found. |
| Rout check for social species    | Not applicable: the polar bear is solitary.                                                                                                                                                                                           |

**Sanity against the brown bear and the tiger.** The polar bear is about twice the brown bear's mass at the mode (450 vs 220 kg), with a higher strike-force mode (1.5 vs 1.2 kN), and everything else equal. The model ranks it accordingly: it beats the brown bear in 83 % of duels in either side order, and against every shared opponent it does at least as well as the brown bear: tiger 97 vs 78 %, lion 96 vs 75 %, eight wolves 92 vs 70 %, buffalo 20 vs 7 %. The ordering follows from the inputs; its size rests mostly on unmeasured values (strike force, lethality, interval and accuracy, and morale each swing the duel by 20–40 pp). No single **S** value at either end of its range makes the brown bear the favourite (the lowest is 55.2 %, strike force at 0.8 kN); joint pessimistic values were not tested. There is no field record of an adult polar bear fighting a brown bear or a tiger to check the strength against.

**Flight (#169).** The flight model is unchanged; this records how the polar bear behaves under it. Against an opponent of similar size the loser flees in practically every decided run (rout share 99.9–100 % against the brown bear, the tiger and the lion, as for every duel in §6). Against a much larger opponent the losing polar bear mostly fights on until incapacitated: it flees in 28 % of its losses to one _T. rex_, but in 77 % of its losses to an elephant and 70 % to a mammoth. That matches the pattern #169 describes for the tiger (solitary animals rarely flee a much larger opponent), less strongly against the two proboscideans. The decision on #169 applies to it unchanged. Re-run under model 2, with its researched behaviour rows and flight traits: [§19](#19-flight-traits-and-model-2-169-197).

**Preset.** `polar-bear-brown-bear` (design §6 #17): polar bear 82.0 %, median 70.9 s, rout share 100 % in the fixture (200 runs). Not close; ready in Simple mode through the one-on-one override, as `tiger-bear` and `trex-mirror` ([PRESETS.md](../PRESETS.md#overrides-and-holds)).

The tables in this section: generated from docs/research/calibration-polar-bear.json (commit bec0201, v22.22.0).

## 14. Hippopotamus (#186)

Measured 2026-11-04 on `main` at `f70371c` plus the #186 change (engines unchanged, model version `mv` 1). Like the polar bear, the hippo has no legacy entry (docs/SPECIES.md §4.12) and runs on the free engine only. These are the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5, a comparison with the other heavy species and its recorded predators, its flight behaviour under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep of its **S** values against the elephant (preset #16). Raw data: `calibration-hippo.json` (section `hippo`); §1–§13, `calibration-results.json` and `calibration-polar-bear.json` are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror            | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| ----------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| hippo 1 v hippo 1 | 1000 | 49.2 (46.1–52.3) | 50.6 (47.5–53.7) |   0.2 | -1.4 (-7.6 to 4.8) |       yes |      106 |
| hippo 3 v hippo 3 | 1000 | 49.1 (46.0–52.2) | 50.8 (47.7–53.9) |   0.1 | -1.7 (-7.9 to 4.5) |       yes |      134 |

### Count sweeps

One hippo against lions and against spotted hyenas, its recorded predators (side B varies), and hippos against one elephant and against one _T. rex_ (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule.

| Match-up          | Runs |             A wins |           B wins | Draws | Median s | Rout % | Step |
| ----------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: | ---: |
| hippo 1 v lion 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       41 |   50.2 |      |
| hippo 1 v lion 2  |  500 |   85.2 (81.8–88.0) |   7.6 (5.6–10.3) |   7.2 |      347 |   62.0 |   ok |
| hippo 1 v lion 3  |  500 |   78.6 (74.8–82.0) | 15.4 (12.5–18.8) |   6.0 |      441 |   72.4 |   ok |
| hippo 1 v lion 4  |  500 |   70.4 (66.3–74.2) | 21.8 (18.4–25.6) |   7.8 |      420 |   79.9 |   ok |
| hippo 1 v lion 6  |  500 |   69.0 (64.8–72.9) | 28.8 (25.0–32.9) |   2.2 |      381 |   85.9 |   ok |
| hippo 1 v lion 8  |  500 |   66.8 (62.6–70.8) | 32.0 (28.1–36.2) |   1.2 |      324 |   89.4 |   ok |
| hippo 1 v lion 10 |  500 |   62.2 (57.9–66.3) | 37.4 (33.3–41.7) |   0.4 |      267 |   90.1 |   ok |
| hippo 1 v lion 12 |  500 |   60.8 (56.5–65.0) | 39.2 (35.0–43.5) |   0.0 |      206 |   91.4 |   ok |
| hippo 1 v lion 16 |  500 |   53.2 (48.8–57.5) | 46.6 (42.3–51.0) |   0.2 |      162 |   91.6 |   ok |
| hippo 1 v lion 20 |  500 |   43.2 (38.9–47.6) | 56.4 (52.0–60.7) |   0.4 |      136 |   91.9 |   ok |

| Match-up           | Runs |             A wins |           B wins | Draws | Median s | Rout % | Step |
| ------------------ | ---: | -----------------: | ---------------: | ----: | -------: | -----: | ---: |
| hippo 1 v hyena 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       33 |    8.2 |      |
| hippo 1 v hyena 2  |  500 |   98.8 (97.4–99.4) |    0.2 (0.0–1.1) |   1.0 |      201 |   45.0 |   ok |
| hippo 1 v hyena 4  |  500 |   97.6 (95.9–98.6) |    1.6 (0.8–3.1) |   0.8 |      184 |   74.2 |   ok |
| hippo 1 v hyena 6  |  500 |   96.0 (93.9–97.4) |    3.8 (2.4–5.9) |   0.2 |      134 |   84.8 |   ok |
| hippo 1 v hyena 8  |  500 |   94.2 (91.8–95.9) |    5.8 (4.1–8.2) |   0.0 |      116 |   87.9 |   ok |
| hippo 1 v hyena 10 |  500 |   94.4 (92.0–96.1) |    5.6 (3.9–8.0) |   0.0 |      100 |   90.0 |   ok |
| hippo 1 v hyena 12 |  500 |   93.4 (90.9–95.3) |    6.6 (4.7–9.1) |   0.0 |       93 |   91.1 |   ok |
| hippo 1 v hyena 16 |  500 |   90.2 (87.3–92.5) |   9.8 (7.5–12.7) |   0.0 |       84 |   92.3 |   ok |
| hippo 1 v hyena 20 |  500 |   89.6 (86.6–92.0) |  10.4 (8.0–13.4) |   0.0 |       74 |   93.0 |   ok |
| hippo 1 v hyena 25 |  500 |   88.0 (84.9–90.6) |  12.0 (9.4–15.1) |   0.0 |       66 |   93.4 |   ok |
| hippo 1 v hyena 30 |  500 |   86.4 (83.1–89.1) | 13.6 (10.9–16.9) |   0.0 |       61 |   93.7 |   ok |

| Match-up             | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| -------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| hippo 1 v elephant 1 |  500 | 17.0 (14.0–20.5) | 83.0 (79.5–86.0) |   0.0 |      117 |  100.0 |      |
| hippo 2 v elephant 1 |  500 | 50.2 (45.8–54.6) | 49.4 (45.0–53.8) |   0.4 |      145 |   99.7 |   ok |
| hippo 3 v elephant 1 |  500 | 76.8 (72.9–80.3) | 22.8 (19.3–26.7) |   0.4 |      130 |   99.7 |   ok |
| hippo 4 v elephant 1 |  500 | 90.6 (87.7–92.9) |   9.4 (7.1–12.3) |   0.0 |      113 |   99.1 |   ok |
| hippo 5 v elephant 1 |  500 | 96.4 (94.4–97.7) |    3.6 (2.3–5.6) |   0.0 |      100 |   99.8 |   ok |
| hippo 6 v elephant 1 |  500 | 98.2 (96.6–99.1) |    1.8 (0.9–3.4) |   0.0 |       95 |  100.0 |   ok |

| Match-up             | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| -------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| hippo 1 v _T. rex_ 1 |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       76 |   98.6 |      |
| hippo 2 v _T. rex_ 1 |  500 |    0.6 (0.2–1.7) |   99.4 (98.3–99.8) |   0.0 |       93 |   98.0 |   ok |
| hippo 3 v _T. rex_ 1 |  500 |    4.0 (2.6–6.1) |   96.0 (93.9–97.4) |   0.0 |      109 |   97.1 |   ok |
| hippo 4 v _T. rex_ 1 |  500 |   9.2 (7.0–12.1) |   90.8 (87.9–93.0) |   0.0 |      125 |   96.5 |   ok |
| hippo 6 v _T. rex_ 1 |  500 | 28.4 (24.6–32.5) |   71.6 (67.5–75.4) |   0.0 |      150 |   93.7 |   ok |
| hippo 8 v _T. rex_ 1 |  500 | 52.2 (47.8–56.5) |   47.8 (43.5–52.2) |   0.0 |      155 |   92.4 |   ok |

### Side swaps

| Pair                                            | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| ----------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| hippo 1 v elephant 1 / elephant 1 v hippo 1     | 1000 |    16.1 (14.0–18.5) |           14.3 (12.3–16.6) | +1.8 (-1.4 to 5.0) |       yes |
| hippo 1 v polar bear 1 / polar bear 1 v hippo 1 | 1000 |    98.4 (97.4–99.0) |           98.9 (98.0–99.4) | -0.5 (-1.6 to 0.6) |       yes |

### Next to the other heavy species and the lion

The buffalo row against six lions is the reference for the hippo row below it.

| Match-up               | Runs |             A wins |           B wins | Draws | Median s | Rout % |
| ---------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: |
| hippo 1 v buffalo 1    | 1000 |   92.3 (90.5–93.8) |    7.7 (6.2–9.5) |   0.0 |       80 |  100.0 |
| hippo 1 v brown bear 1 | 1000 |   98.8 (97.9–99.3) |    1.2 (0.7–2.1) |   0.0 |       78 |   76.7 |
| hippo 1 v tiger 1      | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       36 |   66.1 |
| hippo 1 v lion 1       | 1000 |   99.8 (99.3–99.9) |    0.0 (0.0–0.4) |   0.2 |       40 |   50.1 |
| hippo 1 v mammoth 1    | 1000 |    10.2 (8.5–12.2) | 89.7 (87.7–91.4) |   0.1 |      114 |  100.0 |
| buffalo 1 v lion 6     | 1000 |   16.7 (14.5–19.1) | 83.2 (80.8–85.4) |   0.1 |      137 |   73.4 |
| hippo 1 v lion 6       | 1000 |   68.8 (65.9–71.6) | 29.0 (26.3–31.9) |   2.2 |      397 |   86.4 |

### Much larger opponents

| Match-up             | Runs |           A wins |             B wins | Draws | Median s | Rout % |
| -------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: |
| hippo 1 v _T. rex_ 1 | 1000 |    0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       76 |   98.6 |
| hippo 1 v elephant 1 | 1000 | 16.1 (14.0–18.5) |   83.6 (81.2–85.8) |   0.3 |      121 |  100.0 |
| hippo 1 v mammoth 1  | 1000 |  10.2 (8.5–12.2) |   89.7 (87.7–91.4) |   0.1 |      114 |  100.0 |

### One-at-a-time sensitivity

Hippo 1 v elephant 1 (preset #16 seen from the hippo's side), 1,000 runs per row: each **S** trait of the hippo pinned at its preset min, then at its max. The swing is the change in the hippo's win share from min to max. The constant `hide` (0.3) cannot be pinned through a config and only scales damage from a latcher, which the elephant is not.

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 16.1 (14.0–18.5) | 16.1 (14.0–18.5) |          – |                  121 |
| `turnRate`        |      40 – 120 | 15.0 (12.9–17.3) | 16.4 (14.2–18.8) |       +1.4 |            121 / 121 |
| `sprintSpeed`     |       4 – 8.3 | 15.1 (13.0–17.5) | 16.8 (14.6–19.2) |       +1.7 |            122 / 120 |
| `cruiseSpeed`     |     0.8 – 1.8 | 16.6 (14.4–19.0) | 16.6 (14.4–19.0) |       +0.0 |            132 / 111 |
| `sprintEndurance` |      15 – 100 |  11.7 (9.9–13.8) | 20.1 (17.7–22.7) |       +8.4 |            122 / 119 |
| `recoveryTime`    |      60 – 300 | 17.5 (15.3–20.0) | 14.5 (12.5–16.8) |       -3.0 |            121 / 121 |
| `strikeForce`     |        4 – 15 |    2.7 (1.9–3.9) | 32.6 (29.8–35.6) |      +29.9 |            124 / 111 |
| `strikeLethality` |        4 – 12 |    4.0 (3.0–5.4) | 28.3 (25.6–31.2) |      +24.3 |            124 / 113 |
| `strikeInterval`  |       1.5 – 5 | 35.5 (32.6–38.5) |    4.9 (3.7–6.4) |      -30.6 |            110 / 124 |
| `strikeReach`     |     1.6 – 2.3 | 15.6 (13.5–18.0) | 18.1 (15.8–20.6) |       +2.5 |            121 / 120 |
| `strikeArc`       |       30 – 80 | 16.1 (14.0–18.5) | 16.2 (14.0–18.6) |       +0.1 |            121 / 121 |
| `strikeAccuracy`  |    0.2 – 0.55 |    4.5 (3.4–6.0) | 27.6 (24.9–30.5) |      +23.1 |            124 / 115 |
| `shakeRate`       |    0.03 – 0.2 | 16.1 (14.0–18.5) | 16.1 (14.0–18.5) |       +0.0 |            121 / 121 |
| `bleed`           | 0.001 – 0.006 | 16.1 (14.0–18.5) | 16.3 (14.1–18.7) |       +0.2 |            121 / 121 |
| `morale`          |   0.65 – 0.95 |  10.0 (8.3–12.0) | 21.6 (19.2–24.3) |      +11.6 |            106 / 134 |
| `moraleLoss`      |    0.02 – 0.1 | 16.1 (14.0–18.5) | 16.1 (14.0–18.5) |       +0.0 |            121 / 121 |

Generated from docs/research/calibration-hippo.json (commit f70371c, v22.22.0).

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: −1.4 pp (−7.6 to 4.8); 3 v 3: −1.7 pp (−7.9 to 4.5), paired interval.                                                                                                                                                                                                                                                                                                                                       |
| Win share monotonic in count     | **Pass.** No drop in any of the four sweeps: lions reach about 50 % at 16–20, hyenas only 13.6 % at 30, two hippos are even with one elephant (50.2 %), and eight hippos bring one _T. rex_ to 52.2 %.                                                                                                                                                                                                                       |
| Side order                       | **Pass.** Both swaps agree within the interval (+1.8 and −0.5 pp).                                                                                                                                                                                                                                                                                                                                                           |
| Documented interactions          | **Consistent, qualitatively.** The sources record lions and spotted hyenas taking young hippos and large lion prides only rarely taking adults [WP: Hippopotamus]. The model's adult hippo beats one lion or one hyena in practically every run, still wins 69 % against six lions (where one buffalo wins 17 %) and loses its majority only at 16–20 lions; hyenas never get close (13.6 % at 30). Calves are not modelled. |
| Rout check for social species    | Not applicable: the hippo is solitary.                                                                                                                                                                                                                                                                                                                                                                                       |

**Sanity against the other heavies.** At the mode the hippo (1.5 t) sits between the buffalo (0.6 t) and the elephant (3.2 t) and the model orders it so: it beats the buffalo in 92 %, the brown bear in 99 % and the polar bear in 98–99 % of duels, and loses to the elephant (16 %) and the mammoth (10 %). The size of the elephant's lead rests on unmeasured values: strike force, interval, lethality and accuracy each swing the duel by 23–31 pp, and no single **S** value at either end of its range makes the hippo the favourite (the highest is 35.5 %, strike interval at 1.5 s); joint optimistic values were not tested. The two **U** values that became **S** behave differently: top speed barely matters (+1.7 pp over 4–8.3 m/s), the bite is one of the two largest swings (+29.9 pp over 4–15 kN). No field record of an adult hippo fighting an elephant was found to check the strength against.

**Flight (#169).** The flight model is unchanged; this records how the hippo behaves under it. One on one against an opponent of similar or larger size, the loser flees in practically every decided run (rout share 98.6–100 % against _T. rex_, the elephant, the mammoth and the buffalo). Unlike the polar bear (28 % against _T. rex_), the losing hippo does flee a much larger opponent, probably because its 1.5 t of HP outlasts the hits that break its morale (not traced here). Against small opponents the pattern of #169 shows from the other side: a lone lion or tiger that loses flees in only 50–66 % of runs. The presets were tuned against this model; the per-species flight traits decided on #169 (with #197, under a new model version) will change these numbers, and §14 should be re-run then. Re-run under model 2: [§19](#19-flight-traits-and-model-2-169-197).

**Preset.** `elephant-hippo` (design §6 #16): elephant 81.5 %, median 119.5 s, rout share 99.5 % in the fixture (200 runs). Not close; ready in Simple mode through the one-on-one override, as `tiger-bear` and `polar-bear-brown-bear` ([PRESETS.md](../PRESETS.md#overrides-and-holds)). Preset #15 (hippo vs rhino) joined with the white rhinoceros (#187, §16).

**Bite anchor review (#210, 2026-11-05).** The `strikeForce` row (4 / 8 / 15 kN **S**, mode from the unpublished ~8.1 kN television figure) was re-researched because it is one of the two largest swings above. No primary record, peer-reviewed measurement or biomechanical estimate was found ([research/SPECIES.md §5.18](SPECIES.md#518-hippopotamus-heavy-batch-a-shipped-in-the-free-model-186)), so the range and mode are kept. No input changed, so this section was not re-run: every number above, `calibration-hippo.json` and the `elephant-hippo` fixture row stand as measured for #186.

The tables in this section: generated from docs/research/calibration-hippo.json (commit f70371c, v22.22.0).

## 15. Raptor pack (#188)

Measured 2026-11-05 on `main` at `68cf53e` plus the #188 change (engines unchanged, model version `mv` 1). The raptor pack (`raptor`, _Utahraptor_ by default) has no legacy entry (docs/SPECIES.md §4.13) and runs on the free engine only. It is the first social species added this way, so besides the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5 this section carries the rout check (§3.2, R4) against one _T. rex_, a comparison with the lion at the same counts, its flight under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep of every **S** value, the six pack-buff traits included, on preset #18. Raw data: `calibration-raptor.json` (section `raptor`); §1–§14 and their files are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror                          | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| ------------------------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| _Utahraptor_ 1 v _Utahraptor_ 1 | 1000 | 51.3 (48.2–54.4) | 48.2 (45.1–51.3) |   0.5 | +3.1 (-3.1 to 9.3) |       yes |       40 |
| _Utahraptor_ 3 v _Utahraptor_ 3 | 1000 | 48.6 (45.5–51.7) | 51.2 (48.1–54.3) |   0.2 | -2.6 (-8.8 to 3.6) |       yes |       41 |
| _Utahraptor_ 8 v _Utahraptor_ 8 | 1000 | 50.4 (47.3–53.5) | 49.5 (46.4–52.6) |   0.1 | +0.9 (-5.3 to 7.1) |       yes |       41 |

### Count sweeps

Raptors against one _T. rex_ (preset #18), one buffalo and one hippo, the roster's nearest stand-ins for the 1–2 t iguanodonts _Utahraptor_ lived with (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule.

Against one _T. rex_:

| Match-up                     | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| ---------------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| _Utahraptor_ 1 v _T. rex_ 1  |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       46 |   37.8 |      |
| _Utahraptor_ 2 v _T. rex_ 1  |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       79 |   50.1 |   ok |
| _Utahraptor_ 4 v _T. rex_ 1  |  500 |    0.0 (0.0–0.8) |  99.8 (98.9–100.0) |   0.2 |      123 |   59.4 |   ok |
| _Utahraptor_ 6 v _T. rex_ 1  |  500 |    1.6 (0.8–3.1) |   98.4 (96.9–99.2) |   0.0 |      159 |   68.4 |   ok |
| _Utahraptor_ 8 v _T. rex_ 1  |  500 |    3.2 (2.0–5.1) |   96.8 (94.9–98.0) |   0.0 |      167 |   74.1 |   ok |
| _Utahraptor_ 10 v _T. rex_ 1 |  500 |    5.0 (3.4–7.3) |   95.0 (92.7–96.6) |   0.0 |      172 |   79.5 |   ok |
| _Utahraptor_ 12 v _T. rex_ 1 |  500 |    7.0 (5.1–9.6) |   93.0 (90.4–94.9) |   0.0 |      160 |   83.2 |   ok |
| _Utahraptor_ 16 v _T. rex_ 1 |  500 |  10.6 (8.2–13.6) |   89.4 (86.4–91.8) |   0.0 |      138 |   86.6 |   ok |
| _Utahraptor_ 20 v _T. rex_ 1 |  500 |  12.0 (9.4–15.1) |   88.0 (84.9–90.6) |   0.0 |      123 |   89.8 |   ok |
| _Utahraptor_ 25 v _T. rex_ 1 |  500 | 14.4 (11.6–17.7) |   85.6 (82.3–88.4) |   0.0 |      109 |   91.9 |   ok |
| _Utahraptor_ 30 v _T. rex_ 1 |  500 | 17.0 (14.0–20.5) |   83.0 (79.5–86.0) |   0.0 |       99 |   93.5 |   ok |

Against one buffalo:

| Match-up                   | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| -------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| _Utahraptor_ 1 v buffalo 1 |  500 |   8.4 (6.3–11.2) | 91.6 (88.8–93.7) |   0.0 |       49 |  100.0 |      |
| _Utahraptor_ 2 v buffalo 1 |  500 | 40.4 (36.2–44.8) | 59.6 (55.2–63.8) |   0.0 |       55 |  100.0 |   ok |
| _Utahraptor_ 3 v buffalo 1 |  500 | 73.4 (69.4–77.1) | 26.6 (22.9–30.6) |   0.0 |       52 |  100.0 |   ok |
| _Utahraptor_ 4 v buffalo 1 |  500 | 86.6 (83.3–89.3) | 13.4 (10.7–16.7) |   0.0 |       48 |  100.0 |   ok |
| _Utahraptor_ 6 v buffalo 1 |  500 | 97.0 (95.1–98.2) |    3.0 (1.8–4.9) |   0.0 |       44 |  100.0 |   ok |
| _Utahraptor_ 8 v buffalo 1 |  500 | 98.0 (96.4–98.9) |    2.0 (1.1–3.6) |   0.0 |       42 |   99.8 |   ok |

Against one hippo:

| Match-up                 | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| ------------------------ | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| _Utahraptor_ 1 v hippo 1 |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       50 |   99.4 |      |
| _Utahraptor_ 2 v hippo 1 |  500 |    5.4 (3.7–7.7) |   94.6 (92.3–96.3) |   0.0 |       93 |   98.7 |   ok |
| _Utahraptor_ 3 v hippo 1 |  500 | 13.0 (10.3–16.2) |   87.0 (83.8–89.7) |   0.0 |      201 |   97.9 |   ok |
| _Utahraptor_ 4 v hippo 1 |  500 | 19.8 (16.5–23.5) |   80.2 (76.5–83.5) |   0.0 |      243 |   97.0 |   ok |
| _Utahraptor_ 6 v hippo 1 |  500 | 38.2 (34.0–42.5) |   61.8 (57.5–66.0) |   0.0 |      266 |   95.6 |   ok |
| _Utahraptor_ 8 v hippo 1 |  500 | 48.4 (44.0–52.8) |   51.2 (46.8–55.6) |   0.4 |      249 |   95.4 |   ok |

### Side swaps

| Pair                                                          | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| ------------------------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| _Utahraptor_ 1 v polar bear 1 / polar bear 1 v _Utahraptor_ 1 | 1000 |    26.0 (23.4–28.8) |           28.0 (25.3–30.9) | -2.0 (-5.9 to 1.9) |       yes |
| _Utahraptor_ 12 v _T. rex_ 1 / _T. rex_ 1 v _Utahraptor_ 12   | 1000 |       7.1 (5.7–8.9) |              8.0 (6.5–9.8) | -0.9 (-3.2 to 1.4) |       yes |

### Next to animals of similar mass and the other social hunters

Its describers compared _Utahraptor_ with a polar bear in size (via [WP: Utahraptor]); the polar bear row is in the side swaps above.

| Match-up                      | Runs |           A wins |           B wins | Draws | Median s | Rout % |
| ----------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: |
| _Utahraptor_ 1 v lion 1       | 1000 | 84.9 (82.5–87.0) | 14.9 (12.8–17.2) |   0.2 |       31 |   99.0 |
| _Utahraptor_ 1 v tiger 1      | 1000 | 87.0 (84.8–88.9) | 12.8 (10.9–15.0) |   0.2 |       28 |  100.0 |
| _Utahraptor_ 1 v brown bear 1 | 1000 | 64.1 (61.1–67.0) | 35.4 (32.5–38.4) |   0.5 |       52 |  100.0 |
| _Utahraptor_ 3 v lion 3       | 1000 | 79.9 (77.3–82.3) | 19.7 (17.4–22.3) |   0.4 |       38 |   99.4 |
| _Utahraptor_ 3 v buffalo 1    | 1000 | 70.7 (67.8–73.4) | 29.3 (26.6–32.2) |   0.0 |       53 |  100.0 |
| lion 3 v buffalo 1            | 1000 | 41.9 (38.9–45.0) | 57.8 (54.7–60.8) |   0.3 |      200 |   84.7 |
| _Utahraptor_ 1 v hyena 4      | 1000 | 52.7 (49.6–55.8) | 47.1 (44.0–50.2) |   0.2 |       78 |   88.1 |

### Rout check against one _T. rex_

Raptors and lions in the same numbers against one _T. rex_. The rout share is the losing side's fled ÷ (fled + incapacitated) over decided runs; the preset limit is 90 % (docs/PRESETS.md).

| Match-up                     | Runs |           A wins |           B wins | Draws | Median s | Rout % |
| ---------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: |
| _Utahraptor_ 8 v _T. rex_ 1  |  500 |    3.2 (2.0–5.1) | 96.8 (94.9–98.0) |   0.0 |      167 |   74.1 |
| lion 8 v _T. rex_ 1          |  500 |    2.0 (1.1–3.6) | 97.0 (95.1–98.2) |   1.0 |      197 |   66.1 |
| _Utahraptor_ 12 v _T. rex_ 1 |  500 |    7.0 (5.1–9.6) | 93.0 (90.4–94.9) |   0.0 |      160 |   83.2 |
| lion 12 v _T. rex_ 1         |  500 |    3.6 (2.3–5.6) | 96.2 (94.1–97.6) |   0.2 |      161 |   79.1 |
| _Utahraptor_ 16 v _T. rex_ 1 |  500 |  10.6 (8.2–13.6) | 89.4 (86.4–91.8) |   0.0 |      138 |   86.6 |
| lion 16 v _T. rex_ 1         |  500 |    5.8 (4.1–8.2) | 94.0 (91.6–95.8) |   0.2 |      143 |   85.0 |
| _Utahraptor_ 20 v _T. rex_ 1 |  500 |  12.0 (9.4–15.1) | 88.0 (84.9–90.6) |   0.0 |      123 |   89.8 |
| lion 20 v _T. rex_ 1         |  500 |   9.2 (7.0–12.1) | 90.6 (87.7–92.9) |   0.2 |      130 |   87.2 |
| _Utahraptor_ 30 v _T. rex_ 1 |  500 | 17.0 (14.0–20.5) | 83.0 (79.5–86.0) |   0.0 |       99 |   93.5 |
| lion 30 v _T. rex_ 1         |  500 | 17.4 (14.3–21.0) | 82.6 (79.0–85.7) |   0.0 |      109 |   90.0 |

### Much larger opponents

| Match-up                    | Runs |        A wins |             B wins | Draws | Median s | Rout % |
| --------------------------- | ---: | ------------: | -----------------: | ----: | -------: | -----: |
| _Utahraptor_ 1 v _T. rex_ 1 | 1000 | 0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       46 |   36.8 |
| _Utahraptor_ 1 v elephant 1 | 1000 | 0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       55 |   87.1 |
| _Utahraptor_ 1 v mammoth 1  | 1000 | 0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       55 |   79.4 |

### One-at-a-time sensitivity

Preset #18 (_Utahraptor_ 12 v _T. rex_ 1), 1,000 runs, each **S** value pinned at its preset min and then its max, every other input at its preset. The two **D** rows (`strikeForce`, `latchDps`) and the **L** mass are not swept.

| Trait (S)         |        Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | -----------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |            – |    7.1 (5.7–8.9) |    7.1 (5.7–8.9) |          – |                  156 |
| `turnRate`        |     60 – 200 |    1.4 (0.8–2.3) |  11.6 (9.8–13.7) |      +10.2 |            141 / 168 |
| `sprintSpeed`     |     6 – 10.5 |    6.1 (4.8–7.8) |    6.2 (4.9–7.9) |       +0.1 |            183 / 145 |
| `cruiseSpeed`     |      1.5 – 4 |    4.0 (3.0–5.4) |  11.2 (9.4–13.3) |       +7.2 |            149 / 174 |
| `sprintEndurance` |      10 – 40 |    2.8 (1.9–4.0) |    6.7 (5.3–8.4) |       +3.9 |            300 / 127 |
| `recoveryTime`    |     30 – 120 |    5.2 (4.0–6.8) |   9.1 (7.5–11.0) |       +3.9 |            123 / 201 |
| `strikeLethality` |       4 – 12 |    5.5 (4.2–7.1) |   8.9 (7.3–10.8) |       +3.4 |            157 / 156 |
| `strikeInterval`  |      1 – 2.5 |    7.5 (6.0–9.3) |    6.5 (5.1–8.2) |       -1.0 |            157 / 159 |
| `strikeReach`     |      1.4 – 2 |    6.3 (5.0–8.0) |    7.7 (6.2–9.5) |       +1.4 |            162 / 159 |
| `strikeArc`       |      30 – 70 |    6.3 (5.0–8.0) |    7.9 (6.4–9.7) |       +1.6 |            161 / 155 |
| `strikeAccuracy`  |    0.3 – 0.6 |    6.4 (5.0–8.1) |    7.6 (6.1–9.4) |       +1.2 |            159 / 155 |
| `latchChance`     |    0.1 – 0.5 |   9.3 (7.7–11.3) |    6.5 (5.1–8.2) |       -2.8 |            202 / 144 |
| `latchEndurance`  |      15 – 60 |    6.5 (5.1–8.2) |    6.8 (5.4–8.5) |       +0.3 |            197 / 144 |
| `shakeRate`       |    0.1 – 0.5 |    7.1 (5.7–8.9) |    7.1 (5.7–8.9) |       +0.0 |            156 / 156 |
| `bleed`           | 0.001 – 0.01 |    1.3 (0.8–2.2) | 15.5 (13.4–17.9) |      +14.2 |            157 / 154 |
| `morale`          |    0.3 – 0.8 |    0.0 (0.0–0.4) | 29.3 (26.6–32.2) |      +29.3 |             51 / 275 |
| `moraleLoss`      |  0.03 – 0.15 |  11.1 (9.3–13.2) |    4.0 (3.0–5.4) |       -7.1 |            194 / 133 |
| `cohesionRadius`  |     30 – 100 |  10.2 (8.5–12.2) |    6.5 (5.1–8.2) |       -3.7 |            184 / 151 |
| `groupLatchGain`  |     0 – 0.25 |    6.8 (5.4–8.5) |    7.3 (5.8–9.1) |       +0.5 |            162 / 153 |
| `focusBonus`      |       0 – 20 |    7.1 (5.7–8.9) |    7.1 (5.7–8.9) |       +0.0 |            156 / 156 |
| `moraleSupport`   |     0 – 0.05 |    7.3 (5.8–9.1) |    7.4 (5.9–9.2) |       +0.1 |            161 / 160 |
| `routShock`       |     0 – 0.05 | 19.8 (17.4–22.4) |    1.9 (1.2–2.9) |      -17.9 |            254 / 108 |
| `reliefStamina`   |    0.2 – 0.5 |    7.5 (6.0–9.3) |    7.5 (6.0–9.3) |       +0.0 |            157 / 157 |

Generated from docs/research/calibration-raptor.json (commit 68cf53e, v22.22.0).

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: +3.1 pp (−3.1 to 9.3); 3 v 3: −2.6 pp (−8.8 to 3.6); 8 v 8, pack buff active on both sides: +0.9 pp (−5.3 to 7.1), paired interval.                                                                                                                                                                                                                                                                                                                                                                    |
| Win share monotonic in count     | **Pass.** No drop in any sweep. Against one _T. rex_ the raptors' share climbs from 0 % (1–4) to 7.0 % at 12 and 17.0 % at 30; three raptors beat one buffalo (73.4 %); eight are even with one hippo (48.4 %).                                                                                                                                                                                                                                                                                                         |
| Side order                       | **Pass.** Both swaps agree within the interval (−2.0 and −0.9 pp).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Documented interactions          | **None to check.** _Utahraptor_ shares no time with any other species in the roster, and its prey (iguanodonts, ankylosaurs) is not in it. The qualitative reading of the sources holds: a single raptor does not take an animal several times its mass (0 % against a hippo or any much larger opponent), a few together take a 600 kg buffalo, which fits a group predator of 1–2 t prey (Kirkland et al., via [WP: Utahraptor]).                                                                                     |
| Rout check for social species    | **Pass at the preset count.** Preset #18 at 12 v 1: rout share 83.2 % here (500 runs) and 83.3 % in the fixture (200 runs), median 155–160 s, both inside the limits without an override. The rout share rises with the head count and crosses 90 % at about 20–25 raptors (89.8 % at 20, 91.9 % at 25). Lions in the same numbers behave the same way, 1–4 pp lower (79.1 % at 12, 90.0 % at 30), so the raptor pack does not cascade more than the existing social carnivores; the rise is the model-wide R4 pattern. |

**The cooperation lever.** The pack-buff rows are **S** between no cooperation and the lion's mode (docs/SPECIES.md §11.4), because pack hunting is contested. Only one of them matters much on preset #18: rout contagion (`routShock`) swings the raptors' share by −17.9 pp, from 19.8 % at 0 (no contagion, median 254 s) to 1.9 % at 0.05 (the lion's mode, median 108 s). Pinned at the lion's mode it lifts the preset's rout share to 88.8 %, just under the limit, against 69.6 % with no contagion. A first draft with the lion's own row (0 / 0.05 / 0.1) gave 4.0 % and a rout share of 89.2 % at 200 runs; that exploration is not part of the JSON. `focusBonus`, `moraleSupport`, `groupLatchGain` and `reliefStamina` barely move it against a single target that cannot be ridden off. `cohesionRadius` (−3.7 pp) matters a little through the contagion range.

**Other sensitivities.** Individual morale is the largest swing (+29.3 pp over 0.3–0.8): at 0.3 the pack flees at once (median 51 s), at 0.8 it wins 29 %. Bleed (+14.2 pp), turn rate (+10.2 pp), cruise speed (+7.2 pp) and morale loss (−7.1 pp) follow. Sprint speed, the value the design listed as L (Sellers & Manning 2007 modelled _Velociraptor_, not _Utahraptor_, so it is **S** here), does not matter (+0.1 pp over 6–10.5 m/s). A higher latch chance slightly lowers the share (−2.8 pp): riders sit under the host's strikes for longer.

**Sanity.** One 400 kg raptor beats one lion (85 %), one tiger (87 %) and one brown bear (64 %) and loses to one polar bear (26–28 %; 450 kg at the mode, with a wider strike arc); three raptors beat three lions (80 %). The derived bite (2.15 kN at the mode) is above the lion's 1.6 kN and the raptor has more than twice the lion's mass (HP), so its lead over the big cats follows from the two **D**/**L** rows rather than from an **S** value. No field record exists to check it against.

**Flight (#169).** The flight model is unchanged; this records how the raptor behaves under it. A lone raptor against _T. rex_ flees in only 37 % of its losses (it is incapacitated in most), against the elephant and the mammoth in 79–87 %. The per-species flight traits decided on #169 (with #197, under a new model version) will change these numbers, and §15 should be re-run then. Re-run under model 2: [§19](#19-flight-traits-and-model-2-169-197).

**Preset.** `raptors-trex` (design §6 #18): raptors 7.5 %, median 154.6 s, rout share 83.3 % in the fixture (200 runs). Not close; ready in Simple mode with no override. The design's 12 v 1 proposal is kept: more raptors win more (17 % at 30) but rout more than the limit allows from about 25, so the matchup cannot be made close within the rout check under `mv` 1.

The tables in this section: generated from docs/research/calibration-raptor.json (commit 68cf53e, v22.22.0).

## 16. White rhinoceros (#187)

Measured 2026-11-05 on `main` at `6de39b6` plus the #187 change (engines unchanged, model version `mv` 1). Like the hippo, the white rhino (`whiteRhino`) has no legacy entry (docs/SPECIES.md §4.14) and runs on the free engine only. These are the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5, a comparison with the other heavy species and its recorded predators, its flight behaviour under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep of its **S** values against the elephant (preset #14) and the hippo (preset #15). Raw data: `calibration-white-rhino.json` (section `white-rhino`); §1–§15 and the other calibration files are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror                        | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| ----------------------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| white rhino 1 v white rhino 1 | 1000 | 49.7 (46.6–52.8) | 50.2 (47.1–53.3) |   0.1 | -0.5 (-6.7 to 5.7) |       yes |       98 |
| white rhino 3 v white rhino 3 | 1000 | 48.5 (45.4–51.6) | 51.5 (48.4–54.6) |   0.0 | -3.0 (-9.2 to 3.2) |       yes |      124 |

### Count sweeps

One rhino against lions and against spotted hyenas, its recorded predators (side B varies), and rhinos against one elephant and against one _T. rex_ (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule.

| Match-up                | Runs |            A wins |           B wins | Draws | Median s | Rout % | Step |
| ----------------------- | ---: | ----------------: | ---------------: | ----: | -------: | -----: | ---: |
| white rhino 1 v lion 1  |  500 | 99.8 (98.9–100.0) |    0.0 (0.0–0.8) |   0.2 |       40 |   25.1 |      |
| white rhino 1 v lion 2  |  500 |  87.6 (84.4–90.2) |    5.8 (4.1–8.2) |   6.6 |      303 |   42.5 |   ok |
| white rhino 1 v lion 3  |  500 |  82.0 (78.4–85.1) |  12.4 (9.8–15.6) |   5.6 |      410 |   55.7 |   ok |
| white rhino 1 v lion 4  |  500 |  81.2 (77.5–84.4) | 13.4 (10.7–16.7) |   5.4 |      440 |   65.2 |   ok |
| white rhino 1 v lion 6  |  500 |  77.0 (73.1–80.5) | 19.4 (16.2–23.1) |   3.6 |      379 |   76.3 |   ok |
| white rhino 1 v lion 8  |  500 |  76.0 (72.1–79.5) | 22.4 (19.0–26.3) |   1.6 |      338 |   84.4 |   ok |
| white rhino 1 v lion 10 |  500 |  73.6 (69.6–77.3) | 25.6 (22.0–29.6) |   0.8 |      278 |   87.5 |   ok |
| white rhino 1 v lion 12 |  500 |  70.8 (66.7–74.6) | 28.4 (24.6–32.5) |   0.8 |      229 |   88.8 |   ok |
| white rhino 1 v lion 16 |  500 |  66.0 (61.7–70.0) | 33.8 (29.8–38.1) |   0.2 |      175 |   90.6 |   ok |
| white rhino 1 v lion 20 |  500 |  56.4 (52.0–60.7) | 43.6 (39.3–48.0) |   0.0 |      144 |   91.7 |   ok |

| Match-up                 | Runs |             A wins |         B wins | Draws | Median s | Rout % | Step |
| ------------------------ | ---: | -----------------: | -------------: | ----: | -------: | -----: | ---: |
| white rhino 1 v hyena 1  |  500 | 100.0 (99.2–100.0) |  0.0 (0.0–0.8) |   0.0 |       32 |    3.2 |      |
| white rhino 1 v hyena 2  |  500 |   99.2 (98.0–99.7) |  0.2 (0.0–1.1) |   0.6 |      124 |   31.5 |   ok |
| white rhino 1 v hyena 4  |  500 |   99.2 (98.0–99.7) |  0.6 (0.2–1.7) |   0.2 |      171 |   67.4 |   ok |
| white rhino 1 v hyena 6  |  500 |   98.2 (96.6–99.1) |  1.2 (0.6–2.6) |   0.6 |      125 |   81.3 |   ok |
| white rhino 1 v hyena 8  |  500 |   96.4 (94.4–97.7) |  3.4 (2.1–5.4) |   0.2 |      108 |   87.2 |   ok |
| white rhino 1 v hyena 10 |  500 |   95.8 (93.7–97.2) |  4.2 (2.8–6.3) |   0.0 |      101 |   89.7 |   ok |
| white rhino 1 v hyena 12 |  500 |   96.2 (94.1–97.6) |  3.8 (2.4–5.9) |   0.0 |       94 |   90.7 |   ok |
| white rhino 1 v hyena 16 |  500 |   94.6 (92.3–96.3) |  5.4 (3.7–7.7) |   0.0 |       81 |   92.4 |   ok |
| white rhino 1 v hyena 20 |  500 |   93.6 (91.1–95.4) |  6.4 (4.6–8.9) |   0.0 |       72 |   93.1 |   ok |
| white rhino 1 v hyena 25 |  500 |   93.6 (91.1–95.4) |  6.4 (4.6–8.9) |   0.0 |       67 |   93.9 |   ok |
| white rhino 1 v hyena 30 |  500 |   90.2 (87.3–92.5) | 9.8 (7.5–12.7) |   0.0 |       63 |   94.0 |   ok |

| Match-up                   | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| -------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| white rhino 1 v elephant 1 |  500 | 26.8 (23.1–30.8) | 73.0 (68.9–76.7) |   0.2 |      116 |  100.0 |      |
| white rhino 2 v elephant 1 |  500 | 65.6 (61.3–69.6) | 34.4 (30.4–38.7) |   0.0 |      126 |   99.9 |   ok |
| white rhino 3 v elephant 1 |  500 | 87.0 (83.8–89.7) | 13.0 (10.3–16.2) |   0.0 |      106 |  100.0 |   ok |
| white rhino 4 v elephant 1 |  500 | 95.2 (93.0–96.8) |    4.8 (3.2–7.0) |   0.0 |       96 |   99.8 |   ok |
| white rhino 5 v elephant 1 |  500 | 97.6 (95.9–98.6) |    2.4 (1.4–4.1) |   0.0 |       88 |  100.0 |   ok |
| white rhino 6 v elephant 1 |  500 | 99.2 (98.0–99.7) |    0.8 (0.3–2.0) |   0.0 |       85 |  100.0 |   ok |

| Match-up                   | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| -------------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| white rhino 1 v _T. rex_ 1 |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       74 |  100.0 |      |
| white rhino 2 v _T. rex_ 1 |  500 |    1.8 (0.9–3.4) |   98.2 (96.6–99.1) |   0.0 |       91 |   99.3 |   ok |
| white rhino 3 v _T. rex_ 1 |  500 |    5.4 (3.7–7.7) |   94.6 (92.3–96.3) |   0.0 |      107 |   99.8 |   ok |
| white rhino 4 v _T. rex_ 1 |  500 | 14.4 (11.6–17.7) |   85.6 (82.3–88.4) |   0.0 |      121 |   99.4 |   ok |
| white rhino 6 v _T. rex_ 1 |  500 | 40.8 (36.6–45.2) |   59.2 (54.8–63.4) |   0.0 |      137 |   98.6 |   ok |
| white rhino 8 v _T. rex_ 1 |  500 | 64.0 (59.7–68.1) |   36.0 (31.9–40.3) |   0.0 |      126 |   97.6 |   ok |

### Side swaps

| Pair                                                    | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| ------------------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| white rhino 1 v elephant 1 / elephant 1 v white rhino 1 | 1000 |    26.4 (23.8–29.2) |           26.3 (23.7–29.1) | +0.1 (-3.8 to 4.0) |       yes |
| white rhino 1 v hippo 1 / hippo 1 v white rhino 1       | 1000 |    63.1 (60.1–66.0) |           62.5 (59.5–65.4) | +0.6 (-3.6 to 4.8) |       yes |

### Next to the other heavy species and the lion

The buffalo and hippo rows against six lions are the references for the rhino row below them.

| Match-up                     | Runs |             A wins |           B wins | Draws | Median s | Rout % |
| ---------------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: |
| white rhino 1 v hippo 1      | 1000 |   63.1 (60.1–66.0) | 36.6 (33.7–39.6) |   0.3 |      102 |  100.0 |
| white rhino 1 v buffalo 1    | 1000 |   93.4 (91.7–94.8) |    6.5 (5.1–8.2) |   0.1 |       79 |   98.7 |
| white rhino 1 v brown bear 1 | 1000 |   99.0 (98.2–99.5) |    1.0 (0.5–1.8) |   0.0 |       78 |   50.4 |
| white rhino 1 v polar bear 1 | 1000 |   98.7 (97.8–99.2) |    1.3 (0.8–2.2) |   0.0 |       74 |   90.8 |
| white rhino 1 v tiger 1      | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       36 |   41.7 |
| white rhino 1 v lion 1       | 1000 |  99.9 (99.4–100.0) |    0.0 (0.0–0.4) |   0.1 |       39 |   26.7 |
| white rhino 1 v mammoth 1    | 1000 |   18.1 (15.8–20.6) | 81.8 (79.3–84.1) |   0.1 |      113 |  100.0 |
| buffalo 1 v lion 6           | 1000 |   16.7 (14.5–19.1) | 83.2 (80.8–85.4) |   0.1 |      137 |   73.4 |
| hippo 1 v lion 6             | 1000 |   68.8 (65.9–71.6) | 29.0 (26.3–31.9) |   2.2 |      397 |   86.4 |
| white rhino 1 v lion 6       | 1000 |   76.8 (74.1–79.3) | 20.5 (18.1–23.1) |   2.7 |      395 |   77.5 |

### Much larger opponents

| Match-up                   | Runs |           A wins |             B wins | Draws | Median s | Rout % |
| -------------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: |
| white rhino 1 v _T. rex_ 1 | 1000 |    0.0 (0.0–0.4) | 100.0 (99.6–100.0) |   0.0 |       74 |   99.9 |
| white rhino 1 v elephant 1 | 1000 | 26.4 (23.8–29.2) |   73.6 (70.8–76.2) |   0.0 |      118 |  100.0 |
| white rhino 1 v mammoth 1  | 1000 | 18.1 (15.8–20.6) |   81.8 (79.3–84.1) |   0.1 |      113 |  100.0 |

### One-at-a-time sensitivity

White rhino 1 v elephant 1 (preset #14 seen from the rhino's side) and white rhino 1 v hippo 1 (preset #15 seen from the rhino's side), 1,000 runs per row: each **S** trait of the rhino pinned at its preset min, then at its max. The swing is the change in the rhino's win share from min to max. The constant `hide` (0.3) cannot be pinned through a config and only scales damage from a latcher, which neither opponent is.

Against the elephant (preset #14):

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 26.4 (23.8–29.2) | 26.4 (23.8–29.2) |          – |                  118 |
| `turnRate`        |      40 – 140 | 25.8 (23.2–28.6) | 26.8 (24.1–29.6) |       +1.0 |            119 / 118 |
| `sprintSpeed`     |      5 – 11.1 | 24.5 (21.9–27.3) | 27.1 (24.4–29.9) |       +2.6 |            120 / 118 |
| `cruiseSpeed`     |       0.8 – 2 | 26.2 (23.6–29.0) | 26.7 (24.1–29.5) |       +0.5 |            131 / 108 |
| `sprintEndurance` |      15 – 100 | 21.0 (18.6–23.6) | 30.1 (27.3–33.0) |       +9.1 |            121 / 116 |
| `recoveryTime`    |      60 – 300 | 27.6 (24.9–30.5) | 25.1 (22.5–27.9) |       -2.5 |            119 / 118 |
| `strikeForce`     |        6 – 20 |    6.9 (5.5–8.6) | 42.7 (39.7–45.8) |      +35.8 |            127 / 106 |
| `strikeLethality` |        4 – 12 |    8.0 (6.5–9.8) | 41.2 (38.2–44.3) |      +33.2 |            127 / 108 |
| `strikeInterval`  |       1.5 – 5 | 49.3 (46.2–52.4) |  11.3 (9.5–13.4) |      -38.0 |            103 / 126 |
| `strikeReach`     |     1.7 – 2.5 | 26.3 (23.7–29.1) | 27.9 (25.2–30.8) |       +1.6 |            119 / 117 |
| `strikeArc`       |       30 – 70 | 26.4 (23.8–29.2) | 26.4 (23.8–29.2) |       +0.0 |            118 / 118 |
| `strikeAccuracy`  |    0.15 – 0.5 |    8.0 (6.5–9.8) | 42.5 (39.5–45.6) |      +34.5 |            127 / 109 |
| `shakeRate`       |    0.03 – 0.2 | 26.4 (23.8–29.2) | 26.4 (23.8–29.2) |       +0.0 |            118 / 118 |
| `bleed`           | 0.001 – 0.005 | 26.4 (23.8–29.2) | 26.5 (23.9–29.3) |       +0.1 |            118 / 118 |
| `morale`          |     0.6 – 0.9 | 17.7 (15.5–20.2) | 34.2 (31.3–37.2) |      +16.5 |            105 / 132 |
| `moraleLoss`      |    0.02 – 0.1 | 26.4 (23.8–29.2) | 26.4 (23.8–29.2) |       +0.0 |            118 / 118 |

Against the hippo (preset #15):

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |          – |                  102 |
| `turnRate`        |      40 – 140 | 62.9 (59.9–65.8) | 63.1 (60.1–66.0) |       +0.2 |            102 / 102 |
| `sprintSpeed`     |      5 – 11.1 | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |       +0.0 |            102 / 100 |
| `cruiseSpeed`     |       0.8 – 2 | 62.8 (59.8–65.7) | 62.7 (59.7–65.6) |       -0.1 |             114 / 89 |
| `sprintEndurance` |      15 – 100 | 60.1 (57.0–63.1) | 64.1 (61.1–67.0) |       +4.0 |            103 / 101 |
| `recoveryTime`    |      60 – 300 | 63.5 (60.5–66.4) | 62.5 (59.5–65.4) |       -1.0 |            102 / 102 |
| `strikeForce`     |        6 – 20 | 30.6 (27.8–33.5) | 80.8 (78.2–83.1) |      +50.2 |             122 / 89 |
| `strikeLethality` |        4 – 12 | 32.2 (29.4–35.2) | 78.8 (76.2–81.2) |      +46.6 |             120 / 91 |
| `strikeInterval`  |       1.5 – 5 | 87.1 (84.9–89.0) | 41.0 (38.0–44.1) |      -46.1 |             86 / 117 |
| `strikeReach`     |     1.7 – 2.5 | 61.7 (58.6–64.7) | 65.4 (62.4–68.3) |       +3.7 |            102 / 102 |
| `strikeArc`       |       30 – 70 | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |       +0.0 |            102 / 102 |
| `strikeAccuracy`  |    0.15 – 0.5 | 30.6 (27.8–33.5) | 82.6 (80.1–84.8) |      +52.0 |             120 / 89 |
| `shakeRate`       |    0.03 – 0.2 | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |       +0.0 |            102 / 102 |
| `bleed`           | 0.001 – 0.005 | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |       +0.0 |            102 / 102 |
| `morale`          |     0.6 – 0.9 | 49.4 (46.3–52.5) | 73.6 (70.8–76.2) |      +24.2 |             95 / 106 |
| `moraleLoss`      |    0.02 – 0.1 | 63.1 (60.1–66.0) | 63.1 (60.1–66.0) |       +0.0 |            102 / 102 |

Generated from docs/research/calibration-white-rhino.json (commit 6de39b6, v22.22.0).

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: −0.5 pp (−6.7 to 5.7); 3 v 3: −3.0 pp (−9.2 to 3.2), paired interval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Win share monotonic in count     | **Pass.** No drop in any of the four sweeps: 20 lions still win only 43.6 %, 30 hyenas 9.8 %, two rhinos beat one elephant (65.6 %), and six to eight rhinos bring one _T. rex_ from 40.8 % to 64.0 %.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Side order                       | **Pass.** Both swaps agree within the interval (+0.1 and +0.6 pp).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Documented interactions          | **Consistent, qualitatively.** Adults have no natural predators and calves are rarely taken; one sick bull fell to a lion pride [WP: White rhinoceros; ADW]. The model's adult rhino beats one lion or one hyena in practically every run, wins 77 % against six lions (the buffalo 17 %, the hippo 69 %) and still leads at 20 lions (56.4 %). The elephant record (young orphan bulls killing up to 49 rhinos at Pilanesberg [Slotow & van Dyk 2001]) agrees in direction: one elephant wins 73.6 % of duels. That record involved bulls in early musth against rhinos of every age, which the model does not represent; calves are not modelled. |
| Rout check for social species    | Not applicable: the rhino is solitary. Both presets are one on one and pass through the one-on-one override (rout share 100 %, medians 114 s and 103 s, above the 30 s limit unaided).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Sanity against the other heavies.** At the mode the rhino (2 t) sits between the hippo (1.5 t) and the elephant (3.2 t), and the model orders it so: it beats the hippo in 63 %, the buffalo in 93 %, the brown bear in 99 % and the polar bear in 99 % of duels, and loses to the elephant (26 %) and the mammoth (18 %). As for the hippo, the size of these leads rests on unmeasured values: horn force, strike interval, lethality and accuracy each swing the elephant duel by 33–38 pp and the hippo duel by 47–52 pp. Against the elephant no single **S** value at either end of its range makes the rhino the favourite (the highest is 49.3 %, strike interval at 1.5 s); against the hippo four of them make the hippo the favourite: horn force, lethality and accuracy at their minimum, and strike interval at its maximum (rhino 30.6–41.0 %). Joint values were not tested. The one **U** value that became **S**, top speed, barely matters: +2.6 pp against the elephant and 0.0 pp against the hippo over 5–11.1 m/s. Morale is the largest behavioural swing (+16.5 and +24.2 pp).

**Flight (#169).** The flight model is unchanged; this records how the rhino behaves under it. One on one against an opponent of similar or larger size, the loser flees in practically every decided run (rout share 98.7–100 % against _T. rex_, the elephant, the mammoth, the hippo and the buffalo). Against the bears the pattern of #169 shows from the other side: a lone brown bear that loses flees in only 50 % of runs, a lone lion in 27 % and a tiger in 42 %. The presets were tuned against this model; the per-species flight traits decided on #169 (with #197, under a new model version) will change these numbers, and §16 should be re-run then. Re-run under model 2: [§19](#19-flight-traits-and-model-2-169-197).

**Presets.** `elephant-rhino` (design §6 #14): elephant 73.5 %, median 114.3 s, rout share 100 % in the fixture (200 runs). Not close. `hippo-rhino` (design §6 #15): rhino 58.5 %, hippo 41.0 %, median 102.7 s, rout share 100 %: close (35–65 % for both), the first close heavy-against-heavy preset. Both are ready in Simple mode through the one-on-one override, as `elephant-hippo` ([PRESETS.md](../PRESETS.md#overrides-and-holds)). The fixture's 58.5 % (200 runs) and this section's 63.1 % (1,000 runs, rhino on side A) agree within their intervals.

The tables in this section: generated from docs/research/calibration-white-rhino.json (commit 6de39b6, v22.22.0).

## 17. _Spinosaurus_ (#185)

Measured 2026-11-05 on `main` at `f85796d` plus the #185 change (engines unchanged, model version `mv` 1). _Spinosaurus_ (`spinosaurus`) has no legacy entry (docs/SPECIES.md §4.15) and runs on the free engine only, on land: the free model has no water, so the issue's "land duel" is the only setting, and the species carries the "semi-aquatic; land duel" label. These are the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5, a comparison with the other heavy species and with _T. rex_ against the raptor pack, its flight behaviour under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep against _T. rex_ (preset #12) and the elephant. Raw data: `calibration-spinosaurus.json` (section `spinosaurus`); §1–§16 and the other calibration files are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror                            | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| --------------------------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| _Spinosaurus_ 1 v _Spinosaurus_ 1 | 1000 | 48.8 (45.7–51.9) | 50.9 (47.8–54.0) |   0.3 | -2.1 (-8.3 to 4.1) |       yes |      248 |
| _Spinosaurus_ 3 v _Spinosaurus_ 3 | 1000 | 49.6 (46.5–52.7) | 49.2 (46.1–52.3) |   1.2 | +0.4 (-5.8 to 6.6) |       yes |      382 |

### Count sweeps

One _Spinosaurus_ against lions and against the raptor pack (side B varies), and _Spinosaurus_ against one _T. rex_ and against one elephant (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule. Neither lions nor _Utahraptor_ shared its time or place; they stand in for a large group of smaller attackers.

| Match-up                  | Runs |             A wins |           B wins | Draws | Median s | Rout % | Step |
| ------------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: | ---: |
| _Spinosaurus_ 1 v lion 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       39 |   76.0 |      |
| _Spinosaurus_ 1 v lion 2  |  500 |   99.0 (97.7–99.6) |    0.0 (0.0–0.8) |   1.0 |      183 |   80.1 |   ok |
| _Spinosaurus_ 1 v lion 3  |  500 |   97.2 (95.4–98.3) |    0.6 (0.2–1.7) |   2.2 |      282 |   87.9 |   ok |
| _Spinosaurus_ 1 v lion 4  |  500 |   97.4 (95.6–98.5) |    0.4 (0.1–1.4) |   2.2 |      282 |   91.3 |   ok |
| _Spinosaurus_ 1 v lion 6  |  500 |   98.2 (96.6–99.1) |    1.0 (0.4–2.3) |   0.8 |      246 |   94.9 |   ok |
| _Spinosaurus_ 1 v lion 8  |  500 |   95.8 (93.7–97.2) |    3.6 (2.3–5.6) |   0.6 |      220 |   96.2 |   ok |
| _Spinosaurus_ 1 v lion 10 |  500 |   94.4 (92.0–96.1) |    5.2 (3.6–7.5) |   0.4 |      195 |   96.9 |   ok |
| _Spinosaurus_ 1 v lion 12 |  500 |   93.2 (90.6–95.1) |    6.6 (4.7–9.1) |   0.2 |      189 |   96.9 |   ok |
| _Spinosaurus_ 1 v lion 16 |  500 |   87.2 (84.0–89.8) | 12.8 (10.2–16.0) |   0.0 |      173 |   96.7 |   ok |
| _Spinosaurus_ 1 v lion 20 |  500 |   80.0 (76.3–83.3) | 20.0 (16.7–23.7) |   0.0 |      157 |   97.0 |   ok |

| Match-up                          | Runs |             A wins |           B wins | Draws | Median s | Rout % | Step |
| --------------------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: | ---: |
| _Spinosaurus_ 1 v _Utahraptor_ 1  |  500 | 100.0 (99.2–100.0) |    0.0 (0.0–0.8) |   0.0 |       51 |   99.8 |      |
| _Spinosaurus_ 1 v _Utahraptor_ 2  |  500 |   98.4 (96.9–99.2) |    0.6 (0.2–1.7) |   1.0 |      107 |   99.5 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 4  |  500 |   96.6 (94.6–97.9) |    3.2 (2.0–5.1) |   0.2 |      233 |   99.0 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 6  |  500 |   89.6 (86.6–92.0) |   9.4 (7.1–12.3) |   1.0 |      285 |   98.0 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 8  |  500 |   82.6 (79.0–85.7) | 17.0 (14.0–20.5) |   0.4 |      295 |   97.3 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 10 |  500 |   77.8 (74.0–81.2) | 21.6 (18.2–25.4) |   0.6 |      252 |   97.2 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 12 |  500 |   73.8 (69.8–77.5) | 26.0 (22.3–30.0) |   0.2 |      224 |   97.1 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 16 |  500 |   68.8 (64.6–72.7) | 31.2 (27.3–35.4) |   0.0 |      194 |   97.3 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 20 |  500 |   64.4 (60.1–68.5) | 35.6 (31.5–39.9) |   0.0 |      165 |   97.4 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 25 |  500 |   59.0 (54.6–63.2) | 41.0 (36.8–45.4) |   0.0 |      139 |   97.4 |   ok |
| _Spinosaurus_ 1 v _Utahraptor_ 30 |  500 |   56.0 (51.6–60.3) | 44.0 (39.7–48.4) |   0.0 |      127 |   97.5 |   ok |

| Match-up                     | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| ---------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| _Spinosaurus_ 1 v _T. rex_ 1 |  500 |    4.4 (2.9–6.6) | 95.6 (93.4–97.1) |   0.0 |      113 |   99.0 |      |
| _Spinosaurus_ 2 v _T. rex_ 1 |  500 | 25.6 (22.0–29.6) | 74.4 (70.4–78.0) |   0.0 |      149 |   99.3 |   ok |
| _Spinosaurus_ 3 v _T. rex_ 1 |  500 | 56.4 (52.0–60.7) | 43.4 (39.1–47.8) |   0.2 |      158 |   99.5 |   ok |
| _Spinosaurus_ 4 v _T. rex_ 1 |  500 | 80.6 (76.9–83.8) | 19.4 (16.2–23.1) |   0.0 |      148 |   97.9 |   ok |
| _Spinosaurus_ 5 v _T. rex_ 1 |  500 | 91.4 (88.6–93.6) |   8.6 (6.4–11.4) |   0.0 |      136 |   98.1 |   ok |
| _Spinosaurus_ 6 v _T. rex_ 1 |  500 | 94.6 (92.3–96.3) |    5.4 (3.7–7.7) |   0.0 |      126 |   98.1 |   ok |

| Match-up                     | Runs |             A wins |          B wins | Draws | Median s | Rout % | Step |
| ---------------------------- | ---: | -----------------: | --------------: | ----: | -------: | -----: | ---: |
| _Spinosaurus_ 1 v elephant 1 |  500 |   86.8 (83.6–89.5) | 12.4 (9.8–15.6) |   0.8 |      170 |   97.8 |      |
| _Spinosaurus_ 2 v elephant 1 |  500 |   99.4 (98.3–99.8) |   0.6 (0.2–1.7) |   0.0 |      125 |   99.4 |   ok |
| _Spinosaurus_ 3 v elephant 1 |  500 |  99.8 (98.9–100.0) |   0.2 (0.0–1.1) |   0.0 |      109 |   99.6 |   ok |
| _Spinosaurus_ 4 v elephant 1 |  500 | 100.0 (99.2–100.0) |   0.0 (0.0–0.8) |   0.0 |      101 |  100.0 |   ok |

### Side swaps

| Pair                                                        | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| ----------------------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| _Spinosaurus_ 1 v _T. rex_ 1 / _T. rex_ 1 v _Spinosaurus_ 1 | 1000 |       3.5 (2.5–4.8) |              3.7 (2.7–5.1) | -0.2 (-1.9 to 1.5) |       yes |
| _Spinosaurus_ 1 v elephant 1 / elephant 1 v _Spinosaurus_ 1 | 1000 |    88.9 (86.8–90.7) |           88.7 (86.6–90.5) | +0.2 (-2.6 to 3.0) |       yes |

### Next to the other heavy species

_T. rex_ against twelve _Utahraptor_ (preset #18) is the reference for the _Spinosaurus_ row below it.

| Match-up                          | Runs |             A wins |           B wins | Draws | Median s | Rout % |
| --------------------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: |
| _Spinosaurus_ 1 v _T. rex_ 1      | 1000 |      3.5 (2.5–4.8) | 96.5 (95.2–97.5) |   0.0 |      115 |   99.2 |
| _Spinosaurus_ 1 v elephant 1      | 1000 |   88.9 (86.8–90.7) |  10.7 (8.9–12.8) |   0.4 |      173 |   97.6 |
| _Spinosaurus_ 1 v mammoth 1       | 1000 |   84.0 (81.6–86.1) | 16.0 (13.9–18.4) |   0.0 |      176 |   98.0 |
| _Spinosaurus_ 1 v white rhino 1   | 1000 |   98.1 (97.1–98.8) |    1.7 (1.1–2.7) |   0.2 |      121 |   98.0 |
| _Spinosaurus_ 1 v hippo 1         | 1000 |   99.0 (98.2–99.5) |    0.8 (0.4–1.6) |   0.2 |      118 |   97.5 |
| _Spinosaurus_ 1 v buffalo 1       | 1000 |  99.9 (99.4–100.0) |    0.1 (0.0–0.6) |   0.0 |       82 |   99.9 |
| _Spinosaurus_ 1 v brown bear 1    | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       79 |   92.9 |
| _Spinosaurus_ 1 v polar bear 1    | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       74 |   99.9 |
| _Spinosaurus_ 1 v tiger 1         | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       35 |   86.3 |
| _Spinosaurus_ 1 v lion 1          | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       39 |   72.8 |
| _T. rex_ 1 v _Utahraptor_ 12      | 1000 |   91.8 (89.9–93.3) |    8.0 (6.5–9.8) |   0.2 |      153 |   82.7 |
| _Spinosaurus_ 1 v _Utahraptor_ 12 | 1000 |   75.6 (72.8–78.2) | 24.3 (21.7–27.1) |   0.1 |      214 |   97.4 |

### Larger or stronger opponents

| Match-up                     | Runs |           A wins |           B wins | Draws | Median s | Rout % |
| ---------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: |
| _Spinosaurus_ 1 v _T. rex_ 1 | 1000 |    3.5 (2.5–4.8) | 96.5 (95.2–97.5) |   0.0 |      115 |   99.2 |
| _Spinosaurus_ 1 v elephant 1 | 1000 | 88.9 (86.8–90.7) |  10.7 (8.9–12.8) |   0.4 |      173 |   97.6 |
| _Spinosaurus_ 1 v mammoth 1  | 1000 | 84.0 (81.6–86.1) | 16.0 (13.9–18.4) |   0.0 |      176 |   98.0 |

### One-at-a-time sensitivity

_Spinosaurus_ 1 v _T. rex_ 1 (preset #12 seen from the _Spinosaurus_ side) and _Spinosaurus_ 1 v elephant 1, 1,000 runs per row: each **S** trait pinned at its preset min, then at its max. Because the mass estimates disagree, the two **L** rows (`mass`, 6,000–9,000 kg, and `strikeForce`, the 4.8–11.9 kN of Sakamoto 2022) are swept the same way; the table header says "S" for every row. The swing is the change in the _Spinosaurus_ win share from min to max. The constant `hide` (1) cannot be pinned through a config and only scales damage from a latcher, which neither opponent is. The elephant is a second opponent because against _T. rex_ the base share (3.5 %) leaves little room to see a swing.

Against _T. rex_ (preset #12):

| Trait (S)         |         Range |    A wins at min |  A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | -------------: | ---------: | -------------------: |
| all at preset     |             – |    3.5 (2.5–4.8) |  3.5 (2.5–4.8) |          – |                  115 |
| `mass`            |   6000 – 9000 |    1.7 (1.1–2.7) |  4.8 (3.6–6.3) |       +3.1 |            106 / 125 |
| `turnRate`        |       15 – 32 |    3.4 (2.4–4.7) |  3.6 (2.6–4.9) |       +0.2 |            115 / 115 |
| `sprintSpeed`     |         2 – 6 |    3.3 (2.4–4.6) |  3.6 (2.6–4.9) |       +0.3 |            116 / 114 |
| `cruiseSpeed`     |     0.6 – 1.4 |    3.1 (2.2–4.4) |  3.2 (2.3–4.5) |       +0.1 |            128 / 104 |
| `sprintEndurance` |      20 – 180 |    1.8 (1.1–2.8) |  4.4 (3.3–5.9) |       +2.6 |            115 / 115 |
| `recoveryTime`    |      60 – 300 |    3.4 (2.4–4.7) |  3.3 (2.4–4.6) |       -0.1 |            115 / 115 |
| `strikeForce`     |    4.8 – 11.9 |    0.5 (0.2–1.2) |  6.8 (5.4–8.5) |       +6.3 |            115 / 114 |
| `strikeLethality` |        3 – 10 |    0.3 (0.1–0.9) | 8.1 (6.6–10.0) |       +7.8 |            115 / 114 |
| `strikeInterval`  |       1 – 3.5 | 13.5 (11.5–15.8) |  0.4 (0.2–1.0) |      -13.1 |            114 / 115 |
| `strikeReach`     |         5 – 7 |    2.3 (1.5–3.4) |  4.4 (3.3–5.9) |       +2.1 |            114 / 115 |
| `strikeArc`       |       25 – 60 |    3.5 (2.5–4.8) |  3.5 (2.5–4.8) |       +0.0 |            115 / 115 |
| `strikeAccuracy`  |   0.25 – 0.65 |    0.6 (0.3–1.3) |  7.4 (5.9–9.2) |       +6.8 |            115 / 114 |
| `shakeRate`       |   0.05 – 0.25 |    3.5 (2.5–4.8) |  3.5 (2.5–4.8) |       +0.0 |            115 / 115 |
| `bleed`           | 0.002 – 0.008 |    3.2 (2.3–4.5) |  3.6 (2.6–4.9) |       +0.4 |            115 / 115 |
| `morale`          |    0.7 – 0.95 |    1.8 (1.1–2.8) |  4.3 (3.2–5.7) |       +2.5 |            106 / 124 |
| `moraleLoss`      |    0.02 – 0.1 |    3.5 (2.5–4.8) |  3.5 (2.5–4.8) |       +0.0 |            115 / 115 |

Against the elephant:

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 88.9 (86.8–90.7) | 88.9 (86.8–90.7) |          – |                  173 |
| `mass`            |   6000 – 9000 | 83.2 (80.8–85.4) | 93.1 (91.4–94.5) |       +9.9 |            166 / 182 |
| `turnRate`        |       15 – 32 | 88.6 (86.5–90.4) | 88.8 (86.7–90.6) |       +0.2 |            173 / 173 |
| `sprintSpeed`     |         2 – 6 | 87.4 (85.2–89.3) | 89.1 (87.0–90.9) |       +1.7 |            177 / 172 |
| `cruiseSpeed`     |     0.6 – 1.4 | 88.7 (86.6–90.5) | 88.9 (86.8–90.7) |       +0.2 |            184 / 164 |
| `sprintEndurance` |      20 – 180 | 70.9 (68.0–73.6) | 91.2 (89.3–92.8) |      +20.3 |            227 / 169 |
| `recoveryTime`    |      60 – 300 | 90.4 (88.4–92.1) | 87.8 (85.6–89.7) |       -2.6 |            173 / 173 |
| `strikeForce`     |    4.8 – 11.9 | 71.1 (68.2–73.8) | 95.3 (93.8–96.4) |      +24.2 |            263 / 138 |
| `strikeLethality` |        3 – 10 | 64.7 (61.7–67.6) | 97.1 (95.9–98.0) |      +32.4 |            307 / 130 |
| `strikeInterval`  |       1 – 3.5 | 98.2 (97.2–98.9) | 76.4 (73.7–78.9) |      -21.8 |            116 / 245 |
| `strikeReach`     |         5 – 7 | 87.2 (85.0–89.1) | 89.4 (87.3–91.2) |       +2.2 |            173 / 173 |
| `strikeArc`       |       25 – 60 | 88.9 (86.8–90.7) | 88.9 (86.8–90.7) |       +0.0 |            173 / 173 |
| `strikeAccuracy`  |   0.25 – 0.65 | 72.9 (70.1–75.6) | 96.1 (94.7–97.1) |      +23.2 |            255 / 138 |
| `shakeRate`       |   0.05 – 0.25 | 88.9 (86.8–90.7) | 88.9 (86.8–90.7) |       +0.0 |            173 / 173 |
| `bleed`           | 0.002 – 0.008 | 88.5 (86.4–90.3) | 89.5 (87.4–91.3) |       +1.0 |            173 / 173 |
| `morale`          |    0.7 – 0.95 | 82.2 (79.7–84.4) | 92.4 (90.6–93.9) |      +10.2 |            170 / 174 |
| `moraleLoss`      |    0.02 – 0.1 | 88.9 (86.8–90.7) | 88.9 (86.8–90.7) |       +0.0 |            173 / 173 |

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: −2.1 pp (−8.3 to 4.1); 3 v 3: +0.4 pp (−5.8 to 6.6), paired interval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Win share monotonic in count     | **Pass.** No drop in any of the four sweeps: 20 lions win 20.0 %, 30 raptors 44.0 %; two _Spinosaurus_ win 25.6 % against one _T. rex_, three 56.4 %, six 94.6 %; two beat one elephant in 99.4 %.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Side order                       | **Pass.** Both swaps agree within the interval (−0.2 and +0.2 pp).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Documented interactions          | **None to match.** _Spinosaurus_ shares no time with any other species in the roster (what-if tag). Its contemporaries in the Kem Kem beds and the Bahariya Formation were _Carcharodontosaurus_, abelisaurids, sauropods, crocodyliforms and large fish [WP: Spinosaurus]; none is in the roster. The qualitative literature agrees the jaws were built for fast closure on fish rather than for large prey [Sakamoto 2022] and that it was a shoreline or wading predator [Hone & Holtz 2021; Sereno 2022]; the model's weak bite against _T. rex_ follows from those values, not from a tuned result. |
| Rout check for social species    | Not applicable: _Spinosaurus_ is solitary. Preset #12 is one on one and passes through the one-on-one override (rout share 100 %, median 112 s, above the 30 s limit unaided). For reference, twelve raptors losing to one _Spinosaurus_ flee in 97.4 % of cases, against 82.7 % when they lose to one _T. rex_: the _Spinosaurus_ fights last longer (median 214 s against 153 s), so more raptors reach the rout threshold. This is not a preset.                                                                                                                                                      |

**The land duel.** At the modes the two weigh about the same (_T. rex_ 8,000 kg, _Spinosaurus_ 7,400 kg), but the _Spinosaurus_ bite is several times weaker (8.35 kN at the mode, against 35 kN; Sakamoto 2022 gives 4.8 / 11.9 kN anterior / posterior for _Spinosaurus_ and 25.4 / 48.5 kN for _T. rex_). _T. rex_ wins 96.5 % of duels. No single sheet value pinned at either end of its range makes _Spinosaurus_ the favourite: the highest share is 13.5 % (strike interval at 1 s), and mass at 9,000 kg gives 4.8 %. Three _Spinosaurus_ are needed to beat one _T. rex_ more often than not (56.4 %). Joint values were not tested. Against the elephant the order flips: _Spinosaurus_ wins 88.9 % by mass (7.4 t against 3.2 t), and the strike values swing it by 22–32 pp.

**What the contested body plan does here.** The quadruped reading (Ibrahim et al. 2014, 2020) and the biped reading (Henderson 2018; Sereno et al. 2022) differ mostly in how the animal moved on land and in water. On land the free model reads speed, turn rate and stamina, and all three matter little in this duel: top speed swings it by 0.3 pp over 2–6 m/s, turn rate by 0.2 pp, sprint endurance by 2.6 pp. The mass range, which spans the published estimates without the 12–20.9 t outlier, swings it by 3.1 pp against _T. rex_ and 9.9 pp against the elephant.

**Flight (#169).** The flight model is unchanged; this records how _Spinosaurus_ behaves under it. One on one against another heavy, the loser flees in practically every decided run (rout share 97.5–99.9 % against _T. rex_, the elephant, the mammoth, the rhino, the hippo and the buffalo). As for the white rhino, a lone brown bear, tiger or lion that loses flees less often (72.8–92.9 %). The preset was measured against this model; the per-species flight traits decided on #169 (with #197, under a new model version) will change these numbers, and §17 should be re-run then. Re-run under model 2: [§19](#19-flight-traits-and-model-2-169-197).

**Preset.** `trex-spinosaurus` (design §6 #12): _T. rex_ 96.5 %, median 112.0 s, rout share 100 % in the fixture (200 runs). Not close. Ready in Simple mode through the one-on-one override ([PRESETS.md](../PRESETS.md#overrides-and-holds)). The fixture's 96.5 % (200 runs) and this section's 96.5 % (1,000 runs, _Spinosaurus_ on side A) agree.

The tables in this section: generated from docs/research/calibration-spinosaurus.json (commit f85796d, v22.22.0).

## 18. _Triceratops_ (#189)

Measured 2026-11-05 on `main` at `c61f9c6` plus the #189 change (engines unchanged, model version `mv` 1). _Triceratops_ (`triceratops`) has no legacy entry (docs/SPECIES.md §4.16) and runs on the free engine only. These are the add-a-species checks of [RENEWAL-1.0 §5.3](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done) step 5, a comparison with the other heavy species and with _T. rex_ against the raptor pack, its flight behaviour under the current model (#169, not changed here) and a one-at-a-time sensitivity sweep against _T. rex_ (preset #13) and _Spinosaurus_. The elephant is not the second opponent, as it was for _Spinosaurus_, because it loses almost every run (1.2 %). Raw data: `calibration-triceratops.json` (section `triceratops`); §1–§17 and the other calibration files are unchanged. Method and metrics as in §2: seed 20261019, every other input at its preset.

### Mirror matches

| Mirror                            | Runs |           A wins |           B wins | Draws | A − B (pp, paired) | 0 inside? | Median s |
| --------------------------------- | ---: | ---------------: | ---------------: | ----: | -----------------: | --------: | -------: |
| _Triceratops_ 1 v _Triceratops_ 1 | 1000 | 50.4 (47.3–53.5) | 49.4 (46.3–52.5) |   0.2 | +1.0 (-5.2 to 7.2) |       yes |       87 |
| _Triceratops_ 3 v _Triceratops_ 3 | 1000 | 48.4 (45.3–51.5) | 51.6 (48.5–54.7) |   0.0 | -3.2 (-9.4 to 3.0) |       yes |      104 |

### Count sweeps

One _Triceratops_ against lions, the raptor pack and _T. rex_ (side B varies), and _Triceratops_ against one _T. rex_ (side A varies). "Step" flags a drop in the varying side's share larger than both intervals allow, the §6 rule. Neither lions nor _Utahraptor_ shared its time or place; they stand in for a large group of smaller attackers.

| Match-up                  | Runs |             A wins |        B wins | Draws | Median s | Rout % | Step |
| ------------------------- | ---: | -----------------: | ------------: | ----: | -------: | -----: | ---: |
| _Triceratops_ 1 v lion 1  |  500 | 100.0 (99.2–100.0) | 0.0 (0.0–0.8) |   0.0 |       28 |    0.0 |      |
| _Triceratops_ 1 v lion 2  |  500 |   99.2 (98.0–99.7) | 0.0 (0.0–0.8) |   0.8 |       66 |    5.6 |   ok |
| _Triceratops_ 1 v lion 3  |  500 |   96.8 (94.9–98.0) | 0.0 (0.0–0.8) |   3.2 |      127 |   10.9 |   ok |
| _Triceratops_ 1 v lion 4  |  500 |   97.4 (95.6–98.5) | 0.2 (0.0–1.1) |   2.4 |      197 |   21.7 |   ok |
| _Triceratops_ 1 v lion 6  |  500 |   97.4 (95.6–98.5) | 0.4 (0.1–1.4) |   2.2 |      268 |   43.4 |   ok |
| _Triceratops_ 1 v lion 8  |  500 |   96.8 (94.9–98.0) | 1.2 (0.6–2.6) |   2.0 |      267 |   58.0 |   ok |
| _Triceratops_ 1 v lion 10 |  500 |   97.8 (96.1–98.8) | 1.2 (0.6–2.6) |   1.0 |      204 |   69.5 |   ok |
| _Triceratops_ 1 v lion 12 |  500 |   96.6 (94.6–97.9) | 2.0 (1.1–3.6) |   1.4 |      191 |   77.9 |   ok |
| _Triceratops_ 1 v lion 16 |  500 |   97.6 (95.9–98.6) | 2.0 (1.1–3.6) |   0.4 |      160 |   84.7 |   ok |
| _Triceratops_ 1 v lion 20 |  500 |   96.4 (94.4–97.7) | 3.6 (2.3–5.6) |   0.0 |      153 |   88.6 |   ok |

| Match-up                          | Runs |             A wins |         B wins | Draws | Median s | Rout % | Step |
| --------------------------------- | ---: | -----------------: | -------------: | ----: | -------: | -----: | ---: |
| _Triceratops_ 1 v _Utahraptor_ 1  |  500 | 100.0 (99.2–100.0) |  0.0 (0.0–0.8) |   0.0 |       47 |   16.2 |      |
| _Triceratops_ 1 v _Utahraptor_ 2  |  500 | 100.0 (99.2–100.0) |  0.0 (0.0–0.8) |   0.0 |       73 |   25.7 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 4  |  500 |   99.2 (98.0–99.7) |  0.6 (0.2–1.7) |   0.2 |      119 |   40.0 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 6  |  500 |   98.8 (97.4–99.4) |  1.0 (0.4–2.3) |   0.2 |      169 |   53.1 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 8  |  500 |   97.6 (95.9–98.6) |  2.0 (1.1–3.6) |   0.4 |      171 |   63.6 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 10 |  500 |   96.8 (94.9–98.0) |  2.8 (1.7–4.6) |   0.4 |      155 |   70.8 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 12 |  500 |   96.0 (93.9–97.4) |  3.6 (2.3–5.6) |   0.4 |      149 |   76.6 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 16 |  500 |   93.8 (91.3–95.6) |  6.2 (4.4–8.7) |   0.0 |      124 |   83.8 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 20 |  500 |   92.2 (89.5–94.2) | 7.8 (5.8–10.5) |   0.0 |      117 |   87.7 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 25 |  500 |   93.4 (90.9–95.3) |  6.6 (4.7–9.1) |   0.0 |       98 |   90.4 |   ok |
| _Triceratops_ 1 v _Utahraptor_ 30 |  500 |   92.0 (89.3–94.1) | 8.0 (5.9–10.7) |   0.0 |       97 |   92.0 |   ok |

| Match-up                     | Runs |           A wins |             B wins | Draws | Median s | Rout % | Step |
| ---------------------------- | ---: | ---------------: | -----------------: | ----: | -------: | -----: | ---: |
| _Triceratops_ 1 v _T. rex_ 1 |  500 | 41.0 (36.8–45.4) |   59.0 (54.6–63.2) |   0.0 |       91 |  100.0 |      |
| _Triceratops_ 1 v _T. rex_ 2 |  500 |    7.2 (5.2–9.8) |   92.8 (90.2–94.8) |   0.0 |       81 |   99.8 |   ok |
| _Triceratops_ 1 v _T. rex_ 3 |  500 |    1.2 (0.6–2.6) |   98.8 (97.4–99.4) |   0.0 |       74 |  100.0 |   ok |
| _Triceratops_ 1 v _T. rex_ 4 |  500 |    0.0 (0.0–0.8) | 100.0 (99.2–100.0) |   0.0 |       71 |  100.0 |   ok |

| Match-up                     | Runs |           A wins |           B wins | Draws | Median s | Rout % | Step |
| ---------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: | ---: |
| _Triceratops_ 1 v _T. rex_ 1 |  500 | 41.0 (36.8–45.4) | 59.0 (54.6–63.2) |   0.0 |       91 |  100.0 |      |
| _Triceratops_ 2 v _T. rex_ 1 |  500 | 83.6 (80.1–86.6) | 16.4 (13.4–19.9) |   0.0 |       87 |  100.0 |   ok |
| _Triceratops_ 3 v _T. rex_ 1 |  500 | 95.6 (93.4–97.1) |    4.4 (2.9–6.6) |   0.0 |       78 |  100.0 |   ok |
| _Triceratops_ 4 v _T. rex_ 1 |  500 | 99.4 (98.3–99.8) |    0.6 (0.2–1.7) |   0.0 |       74 |  100.0 |   ok |

### Side swaps

| Pair                                                                  | Runs | First order: A wins | Swapped: same species wins |    Difference (pp) | 0 inside? |
| --------------------------------------------------------------------- | ---: | ------------------: | -------------------------: | -----------------: | --------: |
| _Triceratops_ 1 v _T. rex_ 1 / _T. rex_ 1 v _Triceratops_ 1           | 1000 |    39.8 (36.8–42.9) |           42.1 (39.1–45.2) | -2.3 (-6.6 to 2.0) |       yes |
| _Triceratops_ 1 v _Spinosaurus_ 1 / _Spinosaurus_ 1 v _Triceratops_ 1 | 1000 |    92.1 (90.3–93.6) |           90.9 (89.0–92.5) | +1.2 (-1.3 to 3.7) |       yes |

### Next to the other heavy species

_T. rex_ against twelve _Utahraptor_ (preset #18) is the reference for the _Triceratops_ row below it.

| Match-up                          | Runs |             A wins |           B wins | Draws | Median s | Rout % |
| --------------------------------- | ---: | -----------------: | ---------------: | ----: | -------: | -----: |
| _Triceratops_ 1 v _T. rex_ 1      | 1000 |   39.8 (36.8–42.9) | 60.1 (57.0–63.1) |   0.1 |       91 |   99.9 |
| _Triceratops_ 1 v _Spinosaurus_ 1 | 1000 |   92.1 (90.3–93.6) |    7.9 (6.4–9.7) |   0.0 |      116 |   99.6 |
| _Triceratops_ 1 v elephant 1      | 1000 |   98.7 (97.8–99.2) |    1.2 (0.7–2.1) |   0.1 |       83 |   99.9 |
| _Triceratops_ 1 v mammoth 1       | 1000 |   98.7 (97.8–99.2) |    1.2 (0.7–2.1) |   0.1 |       84 |   99.9 |
| _Triceratops_ 1 v white rhino 1   | 1000 |   99.6 (99.0–99.8) |    0.4 (0.2–1.0) |   0.0 |       77 |   97.8 |
| _Triceratops_ 1 v hippo 1         | 1000 |   99.8 (99.3–99.9) |    0.2 (0.1–0.7) |   0.0 |       80 |   90.3 |
| _Triceratops_ 1 v buffalo 1       | 1000 |  99.9 (99.4–100.0) |    0.1 (0.0–0.6) |   0.0 |       69 |   13.7 |
| _Triceratops_ 1 v brown bear 1    | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       65 |    0.4 |
| _Triceratops_ 1 v polar bear 1    | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       64 |    8.0 |
| _Triceratops_ 1 v tiger 1         | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       26 |    0.4 |
| _Triceratops_ 1 v lion 1          | 1000 | 100.0 (99.6–100.0) |    0.0 (0.0–0.4) |   0.0 |       28 |    0.0 |
| _T. rex_ 1 v _Utahraptor_ 12      | 1000 |   91.8 (89.9–93.3) |    8.0 (6.5–9.8) |   0.2 |      153 |   82.7 |
| _Triceratops_ 1 v _Utahraptor_ 12 | 1000 |   96.0 (94.6–97.0) |    3.8 (2.8–5.2) |   0.2 |      149 |   77.1 |

### Larger or stronger opponents

| Match-up                     | Runs |           A wins |           B wins | Draws | Median s | Rout % |
| ---------------------------- | ---: | ---------------: | ---------------: | ----: | -------: | -----: |
| _Triceratops_ 1 v _T. rex_ 1 | 1000 | 39.8 (36.8–42.9) | 60.1 (57.0–63.1) |   0.1 |       91 |   99.9 |
| _Triceratops_ 1 v elephant 1 | 1000 | 98.7 (97.8–99.2) |    1.2 (0.7–2.1) |   0.1 |       83 |   99.9 |
| _Triceratops_ 1 v mammoth 1  | 1000 | 98.7 (97.8–99.2) |    1.2 (0.7–2.1) |   0.1 |       84 |   99.9 |

### One-at-a-time sensitivity

_Triceratops_ 1 v _T. rex_ 1 (preset #13 seen from the _Triceratops_ side) and _Triceratops_ 1 v _Spinosaurus_ 1, 1,000 runs per row: each **S** trait pinned at its preset min, then at its max. Because the mass estimates disagree, the **L** `mass` row (5,400–10,000 kg) is swept the same way; the table header says "S" for every row. The swing is the change in the _Triceratops_ win share from min to max. The constant `hide` (0.5) cannot be pinned through a config and only scales damage from a latcher, which neither opponent is.

Against _T. rex_ (preset #13):

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 39.8 (36.8–42.9) | 39.8 (36.8–42.9) |          – |                   91 |
| `mass`            |  5400 – 10000 | 25.2 (22.6–28.0) | 50.1 (47.0–53.2) |      +24.9 |              85 / 96 |
| `turnRate`        |       30 – 90 | 39.9 (36.9–43.0) | 39.8 (36.8–42.9) |       -0.1 |              91 / 91 |
| `sprintSpeed`     |     4.5 – 9.7 | 39.5 (36.5–42.6) | 40.6 (37.6–43.7) |       +1.1 |              92 / 91 |
| `cruiseSpeed`     |       0.8 – 2 | 39.9 (36.9–43.0) | 39.6 (36.6–42.7) |       -0.3 |             106 / 78 |
| `sprintEndurance` |      15 – 100 | 31.6 (28.8–34.5) | 43.3 (40.3–46.4) |      +11.7 |              93 / 91 |
| `recoveryTime`    |      60 – 300 | 40.4 (37.4–43.5) | 39.5 (36.5–42.6) |       -0.9 |              91 / 91 |
| `strikeForce`     |       24 – 78 |  11.7 (9.9–13.8) | 61.0 (57.9–64.0) |      +49.3 |              99 / 85 |
| `strikeLethality` |        4 – 12 | 12.3 (10.4–14.5) | 58.4 (55.3–61.4) |      +46.1 |              99 / 85 |
| `strikeInterval`  |       1.5 – 5 | 71.1 (68.2–73.8) | 17.9 (15.6–20.4) |      -53.2 |              81 / 98 |
| `strikeReach`     |     3.2 – 4.8 | 39.0 (36.0–42.1) | 43.0 (40.0–46.1) |       +4.0 |              92 / 91 |
| `strikeArc`       |       30 – 70 | 39.8 (36.8–42.9) | 39.8 (36.8–42.9) |       +0.0 |              91 / 91 |
| `strikeAccuracy`  |    0.2 – 0.55 | 15.9 (13.8–18.3) | 61.0 (57.9–64.0) |      +45.1 |              97 / 85 |
| `shakeRate`       |    0.03 – 0.2 | 39.8 (36.8–42.9) | 39.8 (36.8–42.9) |       +0.0 |              91 / 91 |
| `bleed`           | 0.001 – 0.005 | 39.8 (36.8–42.9) | 39.8 (36.8–42.9) |       +0.0 |              91 / 91 |
| `morale`          |     0.6 – 0.9 | 27.8 (25.1–30.7) | 50.4 (47.3–53.5) |      +22.6 |              86 / 96 |
| `moraleLoss`      |    0.02 – 0.1 | 39.8 (36.8–42.9) | 39.8 (36.8–42.9) |       +0.0 |              91 / 91 |

Against _Spinosaurus_:

| Trait (S)         |         Range |    A wins at min |    A wins at max | Swing (pp) | Median s (min / max) |
| ----------------- | ------------: | ---------------: | ---------------: | ---------: | -------------------: |
| all at preset     |             – | 92.1 (90.3–93.6) | 92.1 (90.3–93.6) |          – |                  116 |
| `mass`            |  5400 – 10000 | 82.8 (80.3–85.0) | 96.1 (94.7–97.1) |      +13.3 |            115 / 116 |
| `turnRate`        |       30 – 90 | 91.1 (89.2–92.7) | 92.3 (90.5–93.8) |       +1.2 |            116 / 116 |
| `sprintSpeed`     |     4.5 – 9.7 | 91.2 (89.3–92.8) | 92.6 (90.8–94.1) |       +1.4 |            119 / 114 |
| `cruiseSpeed`     |       0.8 – 2 | 91.8 (89.9–93.3) | 92.1 (90.3–93.6) |       +0.3 |            134 / 101 |
| `sprintEndurance` |      15 – 100 | 78.2 (75.5–80.6) | 96.5 (95.2–97.5) |      +18.3 |            144 / 111 |
| `recoveryTime`    |      60 – 300 | 94.4 (92.8–95.7) | 88.7 (86.6–90.5) |       -5.7 |            116 / 116 |
| `strikeForce`     |       24 – 78 | 73.4 (70.6–76.0) | 96.5 (95.2–97.5) |      +23.1 |             171 / 96 |
| `strikeLethality` |        4 – 12 | 75.2 (72.4–77.8) | 96.6 (95.3–97.6) |      +21.4 |             167 / 98 |
| `strikeInterval`  |       1.5 – 5 | 97.6 (96.5–98.4) | 79.6 (77.0–82.0) |      -18.0 |             91 / 158 |
| `strikeReach`     |     3.2 – 4.8 | 91.0 (89.1–92.6) | 94.0 (92.4–95.3) |       +3.0 |            116 / 113 |
| `strikeArc`       |       30 – 70 | 92.1 (90.3–93.6) | 92.2 (90.4–93.7) |       +0.1 |            116 / 116 |
| `strikeAccuracy`  |    0.2 – 0.55 | 74.6 (71.8–77.2) | 97.1 (95.9–98.0) |      +22.5 |             166 / 97 |
| `shakeRate`       |    0.03 – 0.2 | 92.1 (90.3–93.6) | 92.1 (90.3–93.6) |       +0.0 |            116 / 116 |
| `bleed`           | 0.001 – 0.005 | 92.1 (90.3–93.6) | 92.2 (90.4–93.7) |       +0.1 |            116 / 116 |
| `morale`          |     0.6 – 0.9 | 84.5 (82.1–86.6) | 95.4 (93.9–96.5) |      +10.9 |            115 / 116 |
| `moraleLoss`      |    0.02 – 0.1 | 92.1 (90.3–93.6) | 92.1 (90.3–93.6) |       +0.0 |            116 / 116 |

### Verdicts

| Check (RENEWAL-1.0 §5.3 step 5)  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror 50/50 within the interval | **Pass.** 1 v 1: +1.0 pp (−5.2 to 7.2); 3 v 3: −3.2 pp (−9.4 to 3.0), paired interval.                                                                                                                                                                                                                                                                                                                                                                                             |
| Win share monotonic in count     | **Pass.** No step in any of the four sweeps. Lions and raptors barely move one _Triceratops_: 20 lions win 3.6 %, 30 raptors 8.0 % (the small ups and downs, such as 96.8 → 97.8 % for 8 → 10 lions, are inside the intervals). Two _T. rex_ beat one _Triceratops_ in 92.8 %; two _Triceratops_ beat one _T. rex_ in 83.6 %, three in 95.6 %.                                                                                                                                     |
| Side order                       | **Pass.** Both swaps agree within the interval (−2.3 and +1.2 pp).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Documented interactions          | **Qualitative match.** The only direct record is one adult _Triceratops_ that survived a head-on encounter with healed _T. rex_ tooth marks on a broken brow horn [Happ 2008]; _T. rex_ also fed on _Triceratops_ [Erickson & Olson 1996]. Survivors and carcasses both exist, so neither side should win every duel; the model gives _T. rex_ 60.1 % and _Triceratops_ 39.8 %. That share was not tuned: it follows from the sheet, and its strike values are unmeasured (below). |
| Rout check for social species    | Not applicable: _Triceratops_ is solitary (docs/SPECIES.md §4.16). Preset #13 is one on one and passes through the one-on-one override (rout share 100 %, median 92 s, above the 30 s limit unaided). For reference, twelve raptors losing to one _Triceratops_ flee in 77.1 % of cases, against 82.7 % when they lose to one _T. rex_. This is not a preset.                                                                                                                      |

**The documented duel.** At the modes the two weigh the same (8,000 kg), and _T. rex_'s 35 kN bite at 8 HP/kN against the _Triceratops_ horn at 47 kN and 8 HP/kN is close per hit; _T. rex_ wins on accuracy (0.5 against 0.35) and reach (5.5 m against 4 m). _T. rex_ wins 60.1 % at 1,000 runs and 61.5 % in the 200-run fixture, so the preset carries `close`. The result rests on unmeasured values: strike interval (−53.2 pp over 1.5–5 s), horn force (+49.3 pp over 24–78 kN), lethality (+46.1 pp) and accuracy (+45.1 pp) each move it from a clear _T. rex_ win to a clear _Triceratops_ win; the literature mass range moves it by 24.9 pp (25.2 % at 5.4 t, 50.1 % at 10 t). Speed (+1.1 pp) and turn rate (−0.1 pp) barely matter. Joint values were not tested.

**Against the other heavies.** _Triceratops_ ties _T. rex_ as the heaviest species in the roster at the mode (8 t) and wins at least 98.7 % against the elephant, the mammoth, the white rhino, the hippo and the buffalo, and 92.1 % against _Spinosaurus_. Its horn force is anchored on its own body weight (78.5 kN at the mode mass), the rule used for the rhino and the hippo, so it scales with mass; against _Spinosaurus_ that force swings the result by 23.1 pp.

**Flight (#169).** The flight model is unchanged; this records how _Triceratops_ behaves under it. One on one against another heavy, the loser flees in practically every decided run (rout share 90.3–99.9 % against _T. rex_, _Spinosaurus_, the elephant, the mammoth, the rhino and the hippo). A lone buffalo, bear, tiger or lion that loses mostly ends incapacitated instead (rout share 0–13.7 %): one horn hit at 376 HP is close to or above their whole body mass. The preset was measured against this model; the per-species flight traits decided on #169 (with #197, under a new model version) will change these numbers, and §18 should be re-run then. Re-run under model 2: [§19](#19-flight-traits-and-model-2-169-197).

**Preset.** `trex-triceratops` (design §6 #13): _T. rex_ 61.5 %, median 91.9 s, rout share 100 % in the fixture (200 runs). Close. Ready in Simple mode through the one-on-one override ([PRESETS.md](../PRESETS.md#overrides-and-holds)). The fixture's 61.5 % (200 runs) and this section's 60.1 % (1,000 runs, _Triceratops_ on side A) agree within the interval.

The tables in this section: Generated from docs/research/calibration-triceratops.json (commit c61f9c6, v22.22.0).

## 19. Flight traits and model 2 (#169, #197)

Measured 2026-11-10 on `feat/169-197-flight-determinism` with `--mv 2` (free model version 2 and classic model version 2; per-section commits in the raw data, Node v22.22.0). Model 2 brings the per-species flight traits of #169 ([SPECIES.md §11.6](../SPECIES.md#116-flight-traits-model-2-169)), the polar bear's researched behaviour rows and, on both engines, the deterministic math of #197 ([MODEL.md §2.2](../MODEL.md#22-random-numbers-and-determinism)). Every section that model 2 can change was re-run: §3–§7 and the species sections §13–§18, plus a new sweep of the flight traits. Raw data: `calibration-results-mv2.json` (every section, `mv` 2). The model 1 report above and its files are unchanged and stay the record of model 1. Method and metrics as in §2: seed 20261019, every other input at its preset; "before" is model 1 from the files above, "after" model 2.

Classic model 2 is the same model as classic model 1 with deterministic math: across §3–§5 its win shares move by at most 1.2 pp (the changed last bits of the normal deviates reshuffle individual runs), so the classic columns below are model 2 and compare directly with §3–§5.

### 19.1 _T. rex_ vs tiger

Tiger win share and the losing side's rout share (%), morale on. Classic is model 2.

| Match-up (A v B)        | Runs | Tigers win, flank | Tigers win, direct | Tigers win, free mv 1 | Tigers win, free mv 2 | Rout % (flank / direct / free mv 1 / free mv 2) | Free median s (mv 1 / mv 2) | Free tigers incapacitated / fled, mean (mv 1 → mv 2) |
| ----------------------- | ---: | ----------------: | -----------------: | --------------------: | --------------------: | ----------------------------------------------: | --------------------------: | ---------------------------------------------------: |
| _T. rex_ 1 v tiger 1    | 2000 |               0.0 |                0.0 |         0.0 (0.0–0.2) |         0.0 (0.0–0.2) |                         52.0 / 3.6 / 2.5 / 19.1 |                     26 / 25 |                                1.0 / 0.0 → 0.8 / 0.2 |
| _T. rex_ 1 v tiger 2    | 2000 |               0.0 |                0.0 |         0.0 (0.0–0.2) |         0.0 (0.0–0.2) |                         58.3 / 6.5 / 3.4 / 25.2 |                     31 / 30 |                                1.9 / 0.1 → 1.5 / 0.5 |
| _T. rex_ 1 v tiger 3    | 2000 |               0.1 |                0.0 |         0.0 (0.0–0.2) |         0.0 (0.0–0.2) |                        67.3 / 10.7 / 3.2 / 33.1 |                     36 / 32 |                                2.9 / 0.1 → 2.0 / 1.0 |
| _T. rex_ 1 v tiger 5    | 1000 |               0.4 |                0.0 |         0.0 (0.0–0.4) |         0.0 (0.0–0.4) |                        79.8 / 21.0 / 4.2 / 48.1 |                     52 / 35 |                                4.8 / 0.2 → 2.6 / 2.4 |
| _T. rex_ 1 v tiger 10   | 1000 |              10.6 |                0.0 |         0.0 (0.0–0.4) |         0.0 (0.0–0.4) |                        90.0 / 43.7 / 5.1 / 69.1 |                    118 / 36 |                                9.5 / 0.5 → 3.1 / 6.9 |
| _T. rex_ 1 v tiger 20   | 1000 |              46.2 |                0.0 |         1.8 (1.1–2.8) |         0.0 (0.0–0.4) |                        92.7 / 66.5 / 7.0 / 82.7 |                    189 / 37 |                              18.5 / 1.4 → 3.5 / 16.5 |
| _T. rex_ 1 v tiger 30   | 1000 |              72.9 |                0.0 |      12.6 (10.7–14.8) |         0.0 (0.0–0.4) |                        90.1 / 75.9 / 8.7 / 87.7 |                    235 / 37 |                              26.7 / 2.6 → 3.7 / 26.3 |
| _T. rex_ 1 v tiger 50   | 1000 |              92.0 |                1.5 |      60.3 (57.2–63.3) |         0.0 (0.0–0.4) |                       80.4 / 84.4 / 11.5 / 91.7 |                    226 / 38 |                              34.6 / 4.4 → 4.2 / 45.8 |
| _T. rex_ 3 v tiger 30   |  500 |               0.0 |                0.0 |         0.0 (0.0–0.8) |         0.0 (0.0–0.8) |                        77.0 / 75.7 / 3.5 / 78.6 |                    117 / 31 |                              28.9 / 1.1 → 6.4 / 23.6 |
| _T. rex_ 10 v tiger 100 |  500 |               0.0 |                0.0 |         0.0 (0.0–0.8) |         0.0 (0.0–0.8) |                        86.0 / 85.3 / 2.9 / 86.5 |                    133 / 27 |                             97.1 / 2.9 → 13.5 / 86.5 |
| _T. rex_ 10 v tiger 300 |  500 |               0.0 |                0.0 |         1.2 (0.6–2.6) |         0.0 (0.0–0.8) |                        91.4 / 90.5 / 5.5 / 92.0 |                    265 / 32 |                          282.6 / 16.8 → 24.0 / 276.0 |

With morale off, flight does nothing: free tigers win 0 % at 1, 10 and 100 against 1, 1 and 10 _T. rex_ in both models (classic flank: 0.1 %, 61.5 %, 0.0 %).

- **The rout share now lies in the classic range.** Free tigers flee in 19.1–92.0 % of their losses (model 1: 2.5–11.5 %), close to classic `flank` (52–93 %) at the larger counts and between `direct` and `flank` one on one. The flagship army, 10 _T. rex_ v 100 tigers, ends with 13.5 tigers incapacitated and 86.5 fled on average (model 1: 97.1 and 2.9; classic about 14 and 86, MODEL.md §6), and its median drops from 133 s to 27 s (classic 26 s). This closes #169's finding.
- **Tigers no longer win against one _T. rex_ at any count up to 50** (model 1: 1.8 % at 20, 12.6 % at 30, 60.3 % at 50; classic `flank` 46.2–92.0 %). An 8 t animal is 44 times a tiger's mass, far beyond the tiger's `threatRatio` range (1.4–10), so every tiger in its reach breaks off within its `threatTime` (5–60 s), and a lone _T. rex_ is never worn down. The flight sweep (§19.6) shows no value in the tiger's sensitivity ranges that lets 10 tigers win. This follows the evidence the owner asked for (tigers avoid injurious fights; prey of that size is far outside any recorded tiger prey), and it removes the model 1 answer to "how many tigers beat a _T. rex_?". Owner review item.
- **Crowding no longer matters** for the tiger result (§3, `interference` off): tigers win 0 % at 10 and 20 with and without it, rout 68.6–82.7 %.

### 19.2 Classic presets and SPECIES.md §7 match-ups (free engine)

Side A win share and rout share (%) on the free engine, model 1 → model 2. The classic columns (model 2) are within 1.2 pp of §4–§5 and are not repeated.

| Match-up (A v B)                | A wins, mv 1 | A wins, mv 2 | Rout, mv 1 | Rout, mv 2 |
| ------------------------------- | -----------: | -----------: | ---------: | ---------: |
| _T. rex_ 10 v tiger 100         |        100.0 |        100.0 |        2.9 |       86.5 |
| _T. rex_ 1 v tiger 10           |         99.0 |        100.0 |        5.1 |       69.1 |
| elephant 5 v lion 30            |        100.0 |        100.0 |       89.0 |       93.9 |
| buffalo 1 v lion 6              |         16.7 |         17.1 |       73.4 |       74.1 |
| buffalo 1 v hyena 15            |         26.2 |         81.2 |       79.2 |       95.7 |
| brown bear 1 v wolf 8           |         69.8 |         70.5 |       96.9 |       97.0 |
| brown bear 1 v tiger 1          |         77.8 |         79.0 |      100.0 |      100.0 |
| mammoth 1 v wolf 12             |        100.0 |        100.0 |       89.5 |       93.9 |
| _T. rex_ 1 v _H. erectus_ 100   |        100.0 |        100.0 |       97.2 |       97.9 |
| elephant 1 v lion 27            |         94.2 |        100.0 |       95.0 |       98.0 |
| buffalo 10 v lion 12            |         99.6 |         99.6 |       94.3 |       94.3 |
| _T. rex_ 1 v lion 30            |         79.8 |        100.0 |       89.9 |       94.2 |
| _T. rex_ 1 v wolf 50            |         99.8 |        100.0 |       93.6 |       95.3 |
| mammoth 1 v wolf 30             |        100.0 |        100.0 |       93.7 |       96.0 |
| mammoth 1 v hyena 15            |        100.0 |        100.0 |       92.3 |       95.1 |
| mammoth 1 v lion 20             |         96.6 |        100.0 |       92.7 |       96.9 |
| _T. rex_ 1 v _H. erectus_ 30    |        100.0 |        100.0 |       91.8 |       94.1 |
| _T. rex_ 1 v _H. erectus_ 300   |        100.0 |        100.0 |       99.0 |       99.2 |
| elephant 1 v _H. erectus_ 30    |        100.0 |        100.0 |       94.0 |       96.7 |
| buffalo 1 v _H. erectus_ 20     |         99.0 |        100.0 |       93.8 |       97.1 |
| _H. erectus_ 1 v wolf 1         |          0.0 |          0.0 |      100.0 |      100.0 |
| _H. erectus_ 1 v wolf 3         |          0.0 |          0.0 |      100.0 |      100.0 |
| _H. erectus_ 1 v hyena 1        |          0.0 |          0.0 |      100.0 |      100.0 |
| _H. erectus_ 1 v tiger 1        |          0.0 |          0.0 |       99.8 |      100.0 |
| _H. erectus_ 1 v lion 1         |          0.0 |          0.0 |       99.6 |      100.0 |
| _H. erectus_ 1 v _H. erectus_ 1 |         50.2 |         50.2 |        0.0 |        0.0 |
| _H. erectus_ 1 v _H. erectus_ 2 |          7.8 |          7.8 |        0.4 |        0.4 |

- **Carnivores break off against megaherbivores.** Lions against one elephant (27) or one _T. rex_ (30) win 0 % (model 1: 5.8 % and 20.2 %); wolves against one _T. rex_ (50) 0 % (0.2 %); hominins against one _T. rex_ (300) 0 % (model 1: 0 %). Lions against a lone buffalo, their preferred prey, are unchanged within noise (83.2 % → 82.8 %), and so are 12 lions against 10 buffalo (0.4 % → 0.4 %).
- **Hyenas lose to a lone buffalo** (`buffalo 1 v hyena 15`: buffalo 26.2 % → 81.2 %): the buffalo is 11 times a hyena, above the hyena's threshold (3.3×, its preferred prey reach 182 kg and it significantly avoids buffalo [Hayward 2006]). Classic `flank` gives the hyenas 95.5 %, `direct` 42.0 %.
- **The lone-_H. erectus_ duels (#167) are unchanged**: the hominin still wins none against a wolf, hyena, tiger or lion.

### 19.3 Structural checks

- **Mirror matches:** 17 of 17 (the 14 of §6 and the three 4,000-run wolf rechecks) have 0 inside the interval of the win-share difference. Largest gap: wolf 1 v wolf 1 at 1,000 runs, 52.2 % v 46.6 % (−0.6 to 11.8 pp), as in model 1; the rechecks are 50.5 / 48.3, 49.5 / 49.8 and 49.2 / 49.8 %.
- **Side swaps:** all 3 of 3 pairs are symmetric (tiger 5 v lion 5, brown bear 1 v wolf 10, _T. rex_ 1 v tiger 10).
- **Monotonicity (side B's win share as its count grows):**
  - wolves v one brown bear (1–20): 0.2, 3.4, 14.0, 24.2, 31.4, 38.8, 47.2, 60.4, 67.4 % (model 1: 0.2, 3.6, 14.6, 24.4, 31.2, 38.8, 46.2, 60.0, 68.2 %). Non-decreasing.
  - wolves v one buffalo (1–25): 0.0, 0.4, 1.4, 3.0, 7.0, 12.0, 12.2, 16.4, 16.6, 20.0, 24.0, 28.0 % (model 1: 0.0, 0.2, 1.8, 6.0, 14.0, 22.0, 24.4, 30.8, 34.0, 37.4, 45.2, 53.2 %). Non-decreasing.
  - lions v one buffalo (1–10): 1.8, 22.0, 38.2, 61.2, 81.0, 87.2, 91.8 % (model 1: 1.8, 22.0, 38.6, 61.2, 81.8, 88.4, 93.0 %). Non-decreasing.
  - lions v one elephant (5–60): 0.0, 0.0, 0.0, 0.7, 2.7, 5.0 % (model 1: 2.3, 2.3, 5.3, 8.0, 13.7, 26.7 %). Non-decreasing.
- **The wolf-vs-buffalo curve (#168)** rises more slowly than in model 1 (28.0 % at 25 wolves against 53.2 %): the buffalo's mass varies per run and per animal, and the heavier draws exceed the wolf's threshold (15×), so some packs break off. It still has no plateau at 9–13; #168 stays open.

### 19.4 Simple presets

The model 2 fixture and its checks are in [PRESETS.md](../PRESETS.md#model-2-the-checked-fixture) (200 runs, the test's measure). At 500 runs (this report's `presets` section):

| Preset                   | Sides                         | A wins, mv 1 → mv 2 | Median s, mv 1 → mv 2 | Rout, mv 1 → mv 2 |
| ------------------------ | ----------------------------- | ------------------: | --------------------: | ----------------: |
| `lion-tiger`             | lion 1 v tiger 1              |         56.0 → 56.0 |               22 → 22 |     100.0 → 100.0 |
| `pride-five-tigers`      | lion 5 v tiger 5              |         57.8 → 57.8 |               27 → 27 |     100.0 → 100.0 |
| `tiger-bear`             | tiger 1 v brown bear 1        |         23.6 → 22.0 |               33 → 32 |     100.0 → 100.0 |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         |         68.8 → 68.6 |               69 → 68 |       97.1 → 97.1 |
| `buffalo-pride`          | buffalo 1 v lion 6            |         18.0 → 19.0 |             141 → 140 |       74.6 → 76.4 |
| `elephants-pride`        | elephant 5 v lion 30          |       100.0 → 100.0 |               46 → 37 |       89.0 → 93.9 |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |       100.0 → 100.0 |               75 → 46 |       89.1 → 93.9 |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       |         49.0 → 49.0 |               96 → 96 |     100.0 → 100.0 |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |       100.0 → 100.0 |              133 → 27 |        2.9 → 86.5 |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |       100.0 → 100.0 |               45 → 42 |       97.2 → 97.9 |
| `lions-hyenas`           | lion 3 v hyena 10             |         40.2 → 48.0 |               27 → 26 |       97.7 → 99.0 |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   |            – → 76.6 |                – → 68 |         – → 100.0 |
| `elephant-hippo`         | elephant 1 v hippo 1          |            – → 87.2 |                – → 95 |         – → 100.0 |
| `raptors-trex`           | raptor 12 v _T. rex_ 1        |             – → 0.0 |                – → 66 |          – → 95.5 |
| `elephant-rhino`         | elephant 1 v white rhino 1    |            – → 94.0 |                – → 72 |         – → 100.0 |
| `hippo-rhino`            | hippo 1 v white rhino 1       |            – → 42.8 |                – → 96 |         – → 100.0 |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  |            – → 96.2 |               – → 115 |          – → 99.4 |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  |            – → 60.0 |                – → 91 |         – → 100.0 |

No ready preset changes its winner. Four exceed a limit under model 2 and carry a documented override (PRESETS.md): `elephants-pride`, `mammoth-wolves` and `raptors-trex` the 90 % rout limit, `trex-squad-tiger-horde` the 30 s median. The three holds still fail the rout check. The close tags all hold.

### 19.5 The species sections (§13–§18) under model 2

Every check of §13–§18 re-run unchanged in its definition. Mirror matches and side swaps all keep 0 inside their intervals, and every count sweep stays monotonic within 3 pp. What moved:

| Section | Reference match-up           | A wins, mv 1 → mv 2 | Largest S swing, mv 1 → mv 2 (pp) | Much larger opponents: A's rout share when it loses, mv 1 → mv 2     |
| ------- | ---------------------------- | ------------------: | --------------------------------- | -------------------------------------------------------------------- |
| §13     | polar bear 1 v brown bear 1  |         83.4 → 76.4 | `strikeForce` +39.7 → +33.6       | _T. rex_ 28.1 → 85.6; elephant 77.3 → 99.6; mammoth 69.6 → 99.5      |
| §14     | hippo 1 v elephant 1         |         16.1 → 10.3 | `strikeInterval` -30.6 → -22.1    | _T. rex_ 98.6 → 99.5; elephant 100.0 → 100.0; mammoth 100.0 → 100.0  |
| §15     | raptor 12 v _T. rex_ 1       |           7.1 → 0.0 | `turnRate` +10.2 → +0.0           | _T. rex_ 36.8 → 56.1; elephant 87.1 → 97.1; mammoth 79.4 → 95.2      |
| §16     | white rhino 1 v elephant 1   |          26.4 → 6.2 | `strikeForce` +35.8 → +8.3        | _T. rex_ 99.9 → 100.0; elephant 100.0 → 100.0; mammoth 100.0 → 100.0 |
| §17     | _Spinosaurus_ 1 v _T. rex_ 1 |           3.5 → 3.5 | `strikeInterval` -13.1 → -13.0    | _T. rex_ 99.2 → 99.2; elephant 97.6 → 99.5; mammoth 98.0 → 99.9      |
| §18     | _Triceratops_ 1 v _T. rex_ 1 |         39.8 → 39.7 | `strikeInterval` -53.2 → -52.4    | _T. rex_ 99.9 → 100.0; elephant 99.9 → 100.0; mammoth 99.9 → 99.9    |

- **Polar bear (§13).** Its researched rows lower its share against the brown bear (preset `polar-bear-brown-bear`: 83.4 % → 76.4 %); `morale`, now 0.4–0.8, is its second largest swing (+20.0 → +31.1 pp). It flees one _T. rex_ in 85.6 % of its losses (model 1: 28.1 %), and polar bears never beat one _T. rex_ at 1–16 (model 1: up to 46.6 % at 16). Wolves do a little better against it, with its lower morale (polar bear 1–7 pp lower at 2–20 wolves; 49.0 % against 30 wolves, model 1 51.8 %); tigers do worse (2–6 tigers: polar bear 84.6, 68.8, 53.0, 38.0, 28.8 %, model 1 74.0, 50.0, 31.8, 21.4, 12.4 %).
- **Hippo (§14) and white rhino (§16).** Lions and hyenas now break off against both (one hippo against 20 lions: 98.8 % for the hippo, model 1 43.2 %; one rhino against 20 lions 99.4 %, model 1 56.4 %), which matches "adults rarely preyed upon" and the megaherbivore line of [Owen-Smith & Mills 2008], but leaves the record of lion prides occasionally taking adult hippos [WP] unreachable. Both yield to the elephant: the rhino (threshold 1.25×) wins 26.4 % → 6.2 % one on one and needs six against one elephant for 42.8 % (model 1 99.2 %), so its unmeasured strike values swing it far less (`strikeForce` +35.8 → +8.3 pp). The hippo against the elephant 16.1 % → 10.3 %. Against the hippo the rhino is unchanged within noise (63.1 % → 60.1 %).
- **Raptor pack (§15).** Raptors never beat one _T. rex_ in model 2 at 1–30 (model 1: 17.0 % at 30), and neither do lions at 8–30 (model 1: 2.0–17.4 %): each is outmatched 20 to 50 times. The rout check of §15 is therefore no longer "passed unaided": `raptors-trex` routs 95.5 % at 500 runs and carries an override (§19.4). Against the hippo the pack breaks off too (8 raptors: 3.6 %, model 1 48.4 %); against the buffalo nothing changes (the buffalo is 1.5 times a raptor). With the preset at 0 %, its one-at-a-time sensitivity is flat: no single S value of the raptor, pack-buff traits included, lifts it above 0 %.
- **_Spinosaurus_ (§17) and _Triceratops_ (§18).** Their duels with _T. rex_ do not move (3.5 % → 3.5 %, 39.8 % → 39.7 %): neither outweighs the other by any threshold. Lions and raptors now break off against both at every count (100 % for the heavy at 1–20 lions and 1–30 raptors). Against the elephant _Spinosaurus_ wins more (88.9 % → 95.4 %), because the elephant (threshold 1.5×) yields to the 7.4 t animal; _Triceratops_ is unchanged. The largest swings stay with the unmeasured strike values (§17, §18).

### 19.6 Sensitivity of the flight traits

Each species as side A in a match-up where its flight acts; each flight trait pinned at its sensitivity range's min, then its max, every other input at its preset (500 runs). The engine reads the mode, so the sweep moves the mode. Win share and rout share of side A when it loses (%), min → max.

| Match-up (A v B)             | Preset: A wins / rout | `threatRatio` range: A wins; rout | `threatTime` range: A wins; rout   | `soloShock` range: A wins; rout    |
| ---------------------------- | --------------------: | --------------------------------- | ---------------------------------- | ---------------------------------- |
| tiger 10 v _T. rex_ 1        |            0.0 / 69.1 | 1.4–10: 0.0 → 0.0; 69.1 → 69.1    | 5–60: 0.0 → 0.0; 82.9 → 39.5       | 0–0.08: 0.0 → 0.0; 59.2 → 74.7     |
| lion 10 v elephant 1         |            0.0 / 96.5 | 3.7–10: 0.0 → 0.0; 96.5 → 96.5    | 10–90: 0.0 → 0.0; 98.4 → 93.7      | – (social)                         |
| wolf 12 v mammoth 1          |            0.0 / 94.2 | 6–25: 0.0 → 0.0; 94.2 → 94.2      | 5–60: 0.0 → 0.0; 96.2 → 92.2       | – (social)                         |
| hyena 10 v buffalo 1         |            5.8 / 96.9 | 1.9–10: 5.8 → 19.6; 96.9 → 94.7   | 5–60: 0.0 → 32.4; 98.4 → 91.0      | – (social)                         |
| _H. erectus_ 30 v _T. rex_ 1 |            0.0 / 94.2 | 1.5–4: 0.0 → 0.0; 94.2 → 94.2     | 5–60: 0.0 → 0.0; 96.5 → 93.0       | – (social)                         |
| raptor 12 v _T. rex_ 1       |            0.0 / 95.5 | 2–4: 0.0 → 0.0; 95.5 → 95.5       | 10–90: 0.0 → 0.2; 97.8 → 90.6      | – (social)                         |
| polar bear 1 v _T. rex_ 1    |            0.0 / 83.8 | 1.5–3: 0.0 → 0.0; 83.8 → 83.8     | 5–30: 0.0 → 0.0; 93.8 → 65.6       | 0–0.08: 0.0 → 0.0; 83.8 → 83.8     |
| brown bear 1 v _T. rex_ 1    |            0.0 / 15.2 | 1.5–4: 0.0 → 0.0; 15.2 → 15.2     | 10–90: 0.0 → 0.0; 42.4 → 8.2       | 0–0.08: 0.0 → 0.0; 15.2 → 15.2     |
| buffalo 1 v elephant 1       |            0.4 / 98.8 | 1.2–3: 0.4 → 0.4; 98.8 → 98.8     | 15–120: 0.0 → 1.0; 100.0 → 96.6    | 0–0.08: 0.4 → 0.4; 98.8 → 98.8     |
| elephant 1 v _T. rex_ 1      |           0.4 / 100.0 | 1.2–3: 0.4 → 0.6; 100.0 → 99.6    | 20–180: 0.4 → 0.6; 100.0 → 100.0   | 0–0.08: 0.4 → 0.4; 100.0 → 100.0   |
| mammoth 1 v _T. rex_ 1       |           0.8 / 100.0 | 1.2–3: 0.4 → 1.2; 100.0 → 99.8    | 20–180: 0.8 → 0.8; 100.0 → 100.0   | 0–0.08: 0.8 → 0.8; 100.0 → 100.0   |
| hippo 1 v elephant 1         |          12.0 / 100.0 | 1.5–4: 5.8 → 17.0; 100.0 → 100.0  | 20–180: 11.4 → 12.6; 100.0 → 100.0 | 0–0.08: 12.0 → 12.0; 100.0 → 100.0 |
| white rhino 1 v elephant 1   |           4.8 / 100.0 | 1–2: 2.0 → 23.6; 100.0 → 100.0    | 5–60: 4.4 → 7.8; 100.0 → 100.0     | 0–0.08: 4.8 → 4.8; 100.0 → 100.0   |
| _T. rex_ 3 v _Triceratops_ 3 |           61.6 / 99.9 | 1.5–4: 61.2 → 61.6; 99.9 → 99.9   | 20–180: 61.6 → 61.6; 99.9 → 99.9   | 0–0.08: 61.6 → 61.6; 99.9 → 99.9   |
| _Spinosaurus_ 1 v _T. rex_ 1 |            4.4 / 99.0 | 1–2: 2.4 → 4.4; 99.4 → 99.0       | 10–90: 4.4 → 4.4; 99.0 → 99.0      | 0–0.08: 4.4 → 4.4; 99.0 → 99.0     |
| _Triceratops_ 1 v _T. rex_ 1 |          40.8 / 100.0 | 1.2–3: 38.0 → 41.0; 100.0 → 100.0 | 15–120: 40.8 → 41.0; 100.0 → 100.0 | 0–0.08: 40.8 → 40.8; 100.0 → 100.0 |

- **`threatTime` is the flight trait that matters most.** Over its range it moves the rout share of the outmatched side by 3–43 pp (tigers 82.9 % → 39.5 %, the polar bear 93.8 % → 65.6 %, the brown bear 42.4 % → 8.2 % against one _T. rex_), but it changes the winner only for hyenas against a lone buffalo (0 % → 32.4 %).
- **`threatRatio` matters only where a match-up sits near the threshold:** the rhino (2.0 % → 23.6 % against the elephant over 1–2×), the hippo (5.8 % → 17.0 % over 1.5–4×) and hyenas against a buffalo (5.8 % → 19.6 % over 1.9–10×). Elsewhere the opponent is far above or below every value in the range.
- **`soloShock` matters only in groups of a solitary species:** 10 tigers' rout share 59.2 % → 74.7 % over 0–0.08; one on one it has nothing to act on.
- **No flight value in its range lets a carnivore group beat a much larger animal** (tigers, lions, wolves, hominins and raptors all stay at 0–0.2 %). That outcome rests on the thresholds' order of magnitude, which the prey-size literature supports, not on the S values' exact place.

### 19.7 Verdicts

- **#169 is addressed as decided:** flight is per-species, sourced, tagged and swept, and the tiger's rout share is back in the range the tiger's own evidence and the classic model suggest. The flagship preset now reads as the classic one did (most tigers withdraw).
- **The structural checks still pass** under model 2: mirror matches, side swaps and monotonic count sweeps, in §6 and in every species section.
- **Owner review items:** carnivore groups never beat a much larger animal any more (tigers v _T. rex_, lions v elephant, raptors v _T. rex_, lions v hippo or rhino); four preset overrides (§19.4); the rhino's low threshold against the elephant; hyenas against a lone buffalo.
- **Open as before:** #167 (lone hominin duels, unchanged), #168 (no plateau in the wolf-vs-buffalo curve, now lower), #170 (parameters page). Cross-engine identity of model 2 is a CI check (MODEL.md §2.2); a manual check in real Safari and Chrome remains for after release (#197).
