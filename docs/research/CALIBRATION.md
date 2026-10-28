# Free-model calibration report (P8)

> **한국어 요약**
>
> - 자유 대결 엔진(쉬운 모드의 기본)을 클래식 엔진과 같은 종, 같은 마릿수, 같은 시드(20261019), 같은 실행 수로 비교하고, 자유 엔진만의 점검(거울전, 진영 바꾸기, 마릿수에 따른 단조성)과 쉬운 모드 프리셋의 근거 점검을 했습니다. 측정 스크립트는 `scripts/calibration/`에, 원자료는 `calibration-results.json`에 있습니다.
> - **티라노 vs 호랑이:** 자유 엔진의 결과는 클래식의 기본 전술 `flank`(뒤로 돌아 들어감)보다 `direct`(곧장 달려듦)에 훨씬 가깝습니다. 자유 모델에서 혼자 사는 호랑이는 포위하지 않기 때문입니다(설계 의도). 그래서 티라노 1 대 호랑이 20에서 호랑이 승률이 클래식 46.3%에서 자유 1.8%로 떨어집니다. 또 자유 모델의 호랑이는 거의 이탈하지 않고(이탈 비율 3–12%, 클래식 52–93%) 전투 불능이 될 때까지 싸웁니다. 앞의 것은 예상된 모델 차이이고, 뒤의 것은 보정 문제일 수 있어 #169로 올렸습니다(소유자 결정 필요).
> - **구조 점검은 통과:** 같은 종 거울전 14개 모두 50:50(두 진영 승률 차이의 95% 구간이 모두 0을 포함), 진영 바꾸기 3쌍 모두 같음, 마릿수 4개 곡선 모두 단조 증가.
> - **보정 문제로 보이는 것:** 호모 에렉투스 1마리가 어떤 육식동물과의 1:1에서도 한 번도 이기지 못하고 늘 이탈함(#167), 늑대 대 물소 곡선이 9–13마리에서 평평해지지 않음(#168), 혼자 사는 동물이 훨씬 큰 상대 앞에서도 거의 이탈하지 않음(#169). 파라미터 페이지에 자유 모델 항목이 없음(#170). 이미 알려진 1:1 이탈 100%와 보류 프리셋 3개(R4)는 그대로입니다.
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

1. **#169** Solitary animals almost never flee a much larger opponent (tiger rout share 3–12 % in free vs 52–93 % in classic). Design-consistent but against the tiger evidence; affects the ready flagship preset. Owner decision.
2. **#167** A lone _H. erectus_ never wins a duel against any carnivore and always flees.
3. **#168** The wolf-vs-buffalo curve has no plateau at 9–13; the guard test is looser than the design.

**Already known and tracked elsewhere:** one-on-one rout share 100 % and the three held presets (R4, PRESETS.md); `elephants-pride` and `mammoth-wolves` sit just under the 90 % rout limit (PRESETS.md); herd defence for elephants, buffalo and mammoths (#72); hunt success vs "incapacitate everyone" (SPECIES.md §8, M3).

**Watch items, no issue:** lion over tiger 1 v 1 (56 %) despite the tiger's mass; lions over a lone buffalo (82–83 %); hyenas over a lone buffalo (74 %).

## 9. Follow-up issues

| Issue                                                              | Kind                                                                 | Blocks the banner decision?       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------- |
| [#167](https://github.com/VinylStage/trex_vs_tiger_sim/issues/167) | Calibration: lone _H. erectus_ duels                                 | No (no ready preset)              |
| [#168](https://github.com/VinylStage/trex_vs_tiger_sim/issues/168) | Calibration guard: wolf-vs-buffalo plateau                           | No                                |
| [#169](https://github.com/VinylStage/trex_vs_tiger_sim/issues/169) | Calibration, owner decision: solitary animals rarely flee            | Recommended yes (flagship preset) |
| [#170](https://github.com/VinylStage/trex_vs_tiger_sim/issues/170) | Docs: free-model traits on the parameters page (the missing P8 page) | Yes (part of the criterion)       |

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
3. #169 is decided: either "keep it" (documented, nothing to wait for) or a retune shipped under a new model version.

Issues #167 and #168 need not hold the banner: no ready preset uses a lone _H. erectus_ against a carnivore, and the plateau question is about a guard's wording.

When it goes, the "provisional model" wording in the share contexts and the guide's `#advanced-limits` paragraph should change with it. A replacement could be the result's existing caveat link to the model page, which already says that results are statements about assumptions. This report changes no UI.

## 11. Owner decisions

1. **Sign off this report** (RENEWAL-1.0 §3.2 item 2), or list objections.
2. **#169**: keep solitary animals' near-zero flight, or retune under `mv` 2.
3. **The banner**: accept the recommendation in §10, remove it now, or keep it with other wording.
4. **R4 holds**: unchanged by this report; `pride-five-tigers`, `trex-erectus-100` and `lions-hyenas` still fail only the rout check.

## 12. Reproducing

```bash
npm ci
node scripts/calibration/run.mjs            # about 10 minutes on one core; writes docs/research/calibration-results.json
node scripts/calibration/tables.mjs         # prints every table in this report
node scripts/calibration/run.mjs --quick    # a tenth of the runs, writes nothing: a smoke test
node scripts/calibration/run.mjs --only trex-tiger --out /tmp/t.json   # one section
```

Sections: `trex-tiger`, `classic`, `presets`, `species-notes`, `interference`, `symmetry`, `monotonic`. Every batch has a fixed seed, so a rerun on the same commit gives the same numbers within the same JavaScript engine (MODEL.md §2.2). Measured with Node v22.22.0. When the free engine changes (a new `mv`), rerun both scripts, update the tables and recheck §8 and §10.

The tables in this report: generated from docs/research/calibration-results.json (commit 12b5968, v22.22.0).
