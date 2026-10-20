# Performance

> **한국어 요약**
>
> - 이슈 #24에서 바꾼 성능 개선과 그 전후 측정값을 정리한 문서입니다. 조사 배경과 원래 측정은 [research/PERFORMANCE.md](research/PERFORMANCE.md)에 있습니다.
> - 몬테카를로 집계를 워커로 옮겨서 20,000회 실행 뒤 메인 스레드가 0.5초가량 멈추던 현상이 사라졌습니다. 민감도(스피어먼 ρ) 계산은 결과값이 비트 단위로 같은 채 약 2.3배 빨라졌습니다.
> - `SpatialGrid.nearest`가 동물이 있는 칸의 경계 상자 안만 찾도록 바꿔서 엔진이 대규모 전투에서 최대 1.36배 빨라졌습니다. 같은 시드의 결과는 그대로입니다.
> - 워커 수 기본값은 논리 코어 수 − 1(최소 1, 최대 8)입니다.
> - 웹 글꼴이 바뀔 때 생기던 레이아웃 이동(CLS)은 글자 폭을 맞춘 대체 글꼴로 거의 0이 되었고, 언어 전환과 시작 시 긴 작업도 줄었습니다.

This page records what issue #24 changed for speed and responsiveness and the before/after numbers. The investigation, the original baselines and the full list of candidate changes are in [research/PERFORMANCE.md](research/PERFORMANCE.md).

## Summary

"Before" is `main` before #24; "after" is branch `feat/24-ux-perf` with every change below. Browser numbers are from the production build (`vite build` + `vite preview`) with the CSP from `public/_headers`.

| Metric                                                              | Before        | After               | Change                  |
| ------------------------------------------------------------------- | ------------- | ------------------- | ----------------------- |
| Main-thread long task after 5,000 runs (1v10)                       | 175–196 ms    | none > 50 ms        | aggregation in a worker |
| Main-thread long task after 20,000 runs (1v1)                       | 499–536 ms    | none > 50 ms (0–58) | aggregation in a worker |
| `aggregate()` in Node, 5,000 / 20,000 runs                          | 73 / 345 ms   | 32 / 149 ms         | 2.3x, identical output  |
| Engine, 10v100 (ms/run, Node)                                       | 11.0          | 10.8                | ≈ 1.0x (within noise)   |
| Engine, 50v1000 (ms/run, Node)                                      | 204–248       | 176–210             | ≈ 1.17x, bit-identical  |
| Engine, 500v5000 (ms/run, Node)                                     | 2,207–2,417   | 1,665–1,780         | ≈ 1.36x, bit-identical  |
| Font-swap CLS, 12 page × viewport pairs: sum / worst                | 0.406 / 0.169 | 0.002 / 0.0017      | metric-matched fallback |
| Language switch with results, 412 px, 4x CPU (median of 6)          | 228 ms        | 188 ms              | one chart repaint       |
| Language switch with results, 412 px, no throttling (median of 6)   | 56 ms         | 44 ms               | one chart repaint       |
| Language switch before any run, 412 px, 4x CPU (median of 5)        | 128 ms        | 96 ms               | lazy advanced table     |
| Startup long tasks at 4x CPU, 412 px: total / longest (median of 5) | 849 / 441 ms  | 542 / 235 ms        | lazy advanced table     |
| Layout shift when the first results render (1366×900 / 390×800)     | 0.40 / 0.83   | 0 / 0.0002          | results skeleton        |

The result-render CLS row comes from the UX work in the same issue (the results panel reserves its final size on the first Run); it is listed because it was measured with the same harness.

## Environment and method

- 4 vCPU Intel Xeon @ 2.80 GHz, Node v22.22.0, Chromium (Playwright, headless, software GPU). Shared VM: treat differences under about 10% as noise.
- **Engine:** `simulateBattle` over the first _n_ rows of the design for 10v100 (120 runs), 50v1000 (16 runs) and 500v5000 (3 runs), `maxTime` 300 s, tactic `flank`, default ranges, the old and new engine bundled separately and run alternately. Each run's summary and the sensitivities are hashed (FNV-1a over the doubles); the hashes match for every scenario.
- **Aggregation:** `aggregate()` best of 5 on the same summaries, old and new implementation side by side; `JSON.stringify` of the sensitivities is identical.
- **Long tasks:** `PerformanceObserver` (`longtask`), counted from the click on Run until 1 s after the verdict appears; scenarios loaded from a share fragment.
- **Language switch:** Event Timing entries with an `interactionId` (`durationThreshold` 16 ms), the longest per click, 3 clicks per page; with results means after a 200-run simulation. CPU throttling through CDP `Emulation.setCPUThrottlingRate`.
- **Startup:** long tasks in the first 4 s after navigation to `/`, 412×915, 4x CPU.
- **Font swap:** every `.woff2` request delayed by 700 ms, layout-shift entries summed over 2.5 s; `/`, `/en/`, `/guide/`, `/en/guide/`, `/model/` and `/en/model/` at 390×844 and 1366×900.

## Aggregation off the main thread

After the last chunk, the pool packs the run summaries into one `Float64Array` (`packSummaries` in `src/sim/montecarlo.ts`, 9 numbers per run), transfers it to an idle run worker (`type: 'aggregate'` in `src/workers/protocol.ts`) and gets the `AggregateResult` back. The main thread only renders. Before, `aggregate()` ran on the main thread and blocked it for up to half a second at 20,000 runs.

The sensitivity loop used to call `spearman(xs, adv)` for each of the 22 parameters, so it ranked the same outcome vector 22 times. It now ranks `heavyAdvantage` once, ranks each parameter column once into a reused `Float64Array`, and takes `pearson()` of the ranks. `ranks()` sorts a `Uint32Array` of indices keyed by a `Float64Array`. Pearson on the same ranks is exactly what `spearman()` computes, so the result is the same double, not merely close: `tests/aggregate.test.ts` compares the new sensitivity with `spearman()` using `Object.is`, compares `ranks()` with the previous implementation, round-trips `packSummaries`/`unpackSummaries`, and the v1 golden test (`tests/v1-golden.test.ts`) is unchanged.

## Engine: bounding-box ring search

`SpatialGrid.nearest` searches rings of cells around the query point until the next ring cannot hold anything closer. A routed tiger far from the fight used to scan many empty rings before reaching the T-Rex. The grid now tracks the bounding box of its occupied cells: each ring reads only the cells inside that box, and the search stops once a ring covers the whole box. Cells outside the box are empty, so the same points are visited in the same order and ties resolve the same way. Every run is bit-identical: `tests/v1-golden.test.ts` and the event-log determinism tests pass unchanged, and `tests/spatial.test.ts` checks the result index against a copy of the old full ring search with clusters, duplicates and filters.

The gain grows with the battle size because routed tigers flee farther from occupied cells: about 1.17x at 50v1000 and 1.36x at 500v5000; 10v100 is within noise. The larger, model-changing speedup (routed tigers re-pick their flee target on the 1 s retarget timer, research recommendation 8) is tracked separately in #42 and is not part of this change.

## Worker count

The pool now starts `hardwareConcurrency − 1` workers (at least 1, at most 8; 3 when the core count is unknown), see `poolSize` in `src/ui/chunks.ts`. On the 4-core test machine, 3 workers finished a 50v1000 × 40-run job as fast as 4 (5.7–6.0 s vs 5.2–6.3 s), and only the 4-worker runs showed unattributed 56–155 ms main-thread stalls ([research §2.2](research/PERFORMANCE.md#22-monte-carlo-wall-time-vs-worker-count-chromium-real-app-navigatorhardwareconcurrency-overridden)). Leaving one core keeps the page, the replay and (later) ad scripts responsive. Results do not depend on the worker count: per-run seeds come from `(masterSeed, runIndex)`.

## Font swap

Pretendard loads with `font-display: swap`, so a first visit paints text in a fallback font and reflows when the web font arrives. The default system fonts have different widths and line heights, which shifted the content pages by up to 0.17 (guide, 1366 px).

`src/assets/fonts/pretendard-fallback.css` defines a local family, `Pretendard Fallback`, listed right after Pretendard in `--font-sans` (app and `site.css`, kept equal by the token mirror test):

| Face         | Local fonts                                             | `size-adjust` | ascent / descent override |
| ------------ | ------------------------------------------------------- | ------------- | ------------------------- |
| Latin ≤ 550  | Arial, Helvetica, Liberation Sans                       | 100.93%       | 94.32% / 23.88%           |
| Latin > 550  | Arial Bold, Helvetica Bold, Liberation Sans Bold        | 98.6%         | 96.55% / 24.44%           |
| Hangul ≤ 550 | Noto Sans CJK KR, Source Han Sans KR, WenQuanYi Zen Hei | 86.43%        | 110.15% / 27.88%          |
| Hangul > 550 | the bold cuts of the same fonts (WenQuanYi has none)    | 86.43%        | 110.15% / 27.88%          |

The values come from Canvas `TextMetrics` in Chromium at 1,000 px: Pretendard Variable has ascent 0.952 em, descent 0.241 em and no line gap; common Hangul syllables advance 0.8643 em at every weight; a Latin sentence is 1.0093x as wide as in Arial at weight 400 and 0.986x as wide as in Arial Bold at 600–700. The overrides are divided by `size-adjust` because they scale with it. Separate bold faces matter: without them the browser synthesises bold from the regular face, which is about 5% narrower than Pretendard's bold, and headings re-wrapped on the swap (0.066 on `/en/guide/` before the bold faces were added).

Font-swap CLS per page (fonts delayed 700 ms):

| Page         | 390 px before | 390 px after | 1366 px before | 1366 px after |
| ------------ | ------------- | ------------ | -------------- | ------------- |
| `/`          | 0.0214        | 0            | 0.0274         | 0             |
| `/en/`       | 0.0009        | 0.0001       | 0.0015         | 0             |
| `/guide/`    | 0.0207        | 0            | 0.1688         | 0.0017        |
| `/en/guide/` | 0.0165        | 0.0001       | 0.0176         | 0.0001        |
| `/model/`    | 0.0462        | 0            | 0.0778         | 0             |
| `/en/model/` | 0.0006        | 0.0001       | 0.0067         | 0.0001        |

Limits: the measurements use the fonts installed in the test VM (Liberation Sans and WenQuanYi Zen Hei). On macOS (Helvetica, Apple SD Gothic Neo) and Windows (Arial, Malgun Gothic) the Latin face applies, but Hangul falls back to the unadjusted system font, because the advances of Apple SD Gothic Neo and Malgun Gothic could not be measured here. Repeat visits are unaffected either way: the fonts come from the immutable `assets/` cache before first paint.

## Language switch and startup

- The language switch painted every chart twice in one task (`renderResults`, then `redrawAllCharts`). Charts now repaint once, in a task after the next frame, so the translated text paints first.
- The advanced parameter table (22 rows, 66 inputs) was built at start-up and rebuilt on every language switch, although most visits never open it. It is now built when the section is first opened, or right away if it was open before a rebuild.

Together these cut the longest start-up task from 441 to 235 ms and the start-up total from 849 to 542 ms at 4x CPU, and the language switch by 20–25%. The switch still rebuilds the form; updating the labels in place (research recommendation 2) would remove most of the remaining 190 ms at 4x CPU.

## Free engine (#50)

The free (symmetric) engine of [#50](https://github.com/VinylStage/trex_vs_tiger_sim/issues/50) (`src/sim/free/engine.ts`, [design §7](design/FREE-MATCHUPS.md#7-performance)) shares the work budget with the legacy engine: `freeWorkEstimate` counts agent-steps exactly like `workEstimate`, and `MAX_WORK` is unchanged. That is only safe if a free agent-step costs no more than a legacy one. The design target is **at most 1.5×** the legacy cost per agent-step.

**Measure.** Wall time per simulated agent-step: Σ over runs of (ticks the battle lasted × agents). The two engines run the same matchup, _T. rex_ vs tigers at the same counts, `maxTime` 300 s, default ranges, alternately, best of three rounds each. Battles differ in length (in the free model the tigers fight on instead of routing after the first deaths, because only social species feel allies' deaths), so per-run times are not comparable but per-agent-step times are. Node v22.22.0 on the 4 vCPU machine above; `BENCH=1 npx vitest run tests/free-perf.test.ts --silent=false`.

| Size                     | Runs | Legacy (ns/agent-step) | Free, individual layer (ns/agent-step) | Free / legacy |
| ------------------------ | ---: | ---------------------: | -------------------------------------: | ------------: |
| 10 _T. rex_ v 100 tigers |   40 |                    205 |                                    144 |          0.70 |
| 50 v 1,000               |    8 |                    349 |                                    244 |          0.70 |
| 500 v 5,000              |    2 |                    951 |                                    439 |          0.46 |

The free engine is cheaper per agent-step at every size. The largest difference is at 500 v 5,000, where the legacy flank tactic scans every heavy linearly once per pack animal per second (`chooseHeavy`); the free individual layer has no flank targeting and uses the grid for every neighbour query. These numbers cover the individual layer (P3); the pack buff follows.

### Pack buff (P4)

The pack-buff layer adds per-agent cohesion checks, morale support counts, shared-target scans, slot geometry, contagion and relief searches for social sides. What keeps them bounded:

- **Staggered refresh.** Buff status and cohesion every 0.5 s (5 ticks), morale support every 2 s, relief checks on the agent's refresh ticks, each staggered by agent index.
- **Capped and early-exit queries.** `SpatialGrid.countWithin` stops at its cap (16 for morale support); `hasWithin` checks the agent's own cell first; `firstWithin` searches rings of cells outward and stops after 32 candidates (relief).
- **Exact coarse rejects.** A per-tick count of active allies on a grid with cell size R_coh: an empty 3×3 block proves there is no ally within R_coh, so lone agents in a sparse late battle cost O(1).
- **Contagion field.** Deaths and routs of a tick are counted into a coarse grid, and each buffed ally sums its 3×3 block, at most 3 deaths and 1 rout per tick (design §5, these caps also stop a few routs from collapsing a whole large pack within a second).
- **Exact optimizations shared with the individual layer.** `wrap()` skips the float modulo when |a| < 2π, `SpatialGrid.query`/`countWithin` are clipped to the occupied box, and search scratch values live in a `Float64Array` (no boxed numbers). All goldens are unchanged.

Even so, with an active buff a free agent-step costs more than a legacy one: per raw agent-step 2.7× at 10 _T. rex_ v 100 wolves, 1.6× at 50 v 1,000 and 1.8× at 500 v 5,000 (and up to 2.4× in long morale-off battles). As design §7 provides, the work budget therefore counts such configs at **`FREE_WORK_WEIGHT_BUFF` = 2.5** agent-steps per agent-step (`freeWorkWeight`, `src/sim/free/config.ts`): `sanitizeFreeConfig` lowers `runs` accordingly and `MAX_WORK` keeps its meaning. Per weighted agent-step:

| Size, buff on (wolves) | Legacy (ns/agent-step) | Free (ns/weighted agent-step) | Free / legacy |
| ---------------------- | ---------------------: | ----------------------------: | ------------: |
| 10 v 100               |                    192 |                           205 |          1.07 |
| 50 v 1,000             |                    335 |                           214 |          0.64 |
| 500 v 5,000            |                  1,012 |                           745 |          0.74 |

The non-social rows (tigers) re-measured on the same run: 0.93, 0.61 and 0.44.

**Regression test.** `tests/free-perf.test.ts` runs the 10 v 100 comparison in every `npm test`, once with tigers and once with wolves and the buff on, and fails if the free engine costs more than 1.5× the legacy engine per (weighted) agent-step (retried twice, so only a sustained slowdown under full-suite load fails it). Both engines run in the same process, alternately, so machine load affects both alike.

## Not changed

- No `SharedArrayBuffer`: it needs cross-origin isolation, which conflicts with third-party ad iframes ([research §3](research/PERFORMANCE.md)). Transfers are already zero-copy.
- The cost estimator recalibration, a static HTML shell for the simulator, build-time font subsetting and in-place label updates on a language switch (research recommendations 11, 6, 7 and 2) are open.
