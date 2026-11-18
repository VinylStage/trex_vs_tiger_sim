# Performance

> **한국어 요약**
>
> - 이슈 #24에서 바꾼 성능 개선과 그 전후 측정값을 정리한 문서입니다. 조사 배경과 원래 측정은 [research/PERFORMANCE.md](research/PERFORMANCE.md)에 있습니다.
> - 몬테카를로 집계를 워커로 옮겨서 20,000회 실행 뒤 메인 스레드가 0.5초가량 멈추던 현상이 사라졌습니다. 민감도(스피어먼 ρ) 계산은 결과값이 비트 단위로 같은 채 약 2.3배 빨라졌습니다.
> - `SpatialGrid.nearest`가 동물이 있는 칸의 경계 상자 안만 찾도록 바꿔서 엔진이 대규모 전투에서 최대 1.36배 빨라졌습니다. 같은 시드의 결과는 그대로입니다.
> - 워커 수 기본값은 논리 코어 수 − 1(최소 1, 최대 8)입니다.
> - 웹 글꼴이 바뀔 때 생기던 레이아웃 이동(CLS)은 글자 폭을 맞춘 대체 글꼴로 거의 0이 되었고, 언어 전환과 시작 시 긴 작업도 줄었습니다.
> - 우선순위 스케줄러(#175)로 워커를 미리 데워 둔 채 재사용합니다. 작업을 취소하거나 새 작업으로 바꿔도 워커를 끄지 않으며, 한 덩어리는 최대 25회입니다. 배치 실행 시간은 측정 오차 범위 안에서 그대로입니다.
> - 그 뒤 본문 최대 폭을 `ch`(숫자 0의 폭) 단위로 정하면서 글꼴이 바뀌는 순간 폭이 넓어져 이동이 다시 생겼습니다(#138). 폭을 `em`으로 바꿔서 12개 페이지·화면 조합의 합계가 0.0524에서 0.0034로 줄었습니다.
> - 실시간 변수 카드의 두 관문(#181)은 측정값만으로 판단합니다. 재시뮬레이션 시간 × 1.5가 500 ms 이하일 때만 대결 중 카드를 쓰고, 카드 쉬는 시간의 계산량이 80%를 넘으면 효과 계산 횟수와 승률 체크포인트를 차례로 줄입니다. Node에서 잰 프리셋은 모두 첫 관문을 넉넉히 통과합니다.
> - 상시 성능 점검(#241): `npm run bench`가 고정 시나리오(규모 4단계, 모든 프리셋 × 두 도주 모드, 모든 종의 미러전과 기준 상대전)를 재고 결과를 JSON으로 남깁니다. 기준값은 `bench/baseline-v0.2.27.json`, 예산은 기준값 × 1.3(엔진)과 현재 gzip 크기 + 10%(페이지 JS)입니다. 엔진·UI·Vite 설정·`bench/`를 건드리는 PR은 CI `perf` 작업이 기준 커밋과 PR을 번갈아 재서, 어떤 시나리오든 25% 넘게 느려지거나 페이지 JS가 예산을 넘으면 실패합니다. 의도한 저하는 같은 PR에서 `bench/budgets.json`을 올리고 이 문서에 이유를 적으면 통과합니다.

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

The font-swap row went back up to 0.052 when text widths in `ch` landed (#52) and is 0.0034 / 0.0017 since #138; see [Text widths in em](#text-widths-in-em-138).

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

The sensitivity loop used to call `spearman(xs, adv)` for each of the 22 parameters, so it ranked the same outcome vector 22 times. It now ranks `heavyAdvantage` once, ranks each parameter column once into a reused `Float64Array`, and takes `pearson()` of the ranks. `ranks()` sorts a `Uint32Array` of indices keyed by a `Float64Array`. Pearson on the same ranks is exactly what `spearman()` computes, so the result is the same double, bit for bit: `tests/aggregate.test.ts` compares the new sensitivity with `spearman()` using `Object.is`, compares `ranks()` with the previous implementation, round-trips `packSummaries`/`unpackSummaries`, and the v1 golden test (`tests/v1-golden.test.ts`) is unchanged.

## Engine: bounding-box ring search

`SpatialGrid.nearest` searches rings of cells around the query point until the next ring cannot hold anything closer. A routed tiger far from the fight used to scan many empty rings before reaching the T-Rex. The grid now tracks the bounding box of its occupied cells: each ring reads only the cells inside that box, and the search stops once a ring covers the whole box. Cells outside the box are empty, so the same points are visited in the same order and ties resolve the same way. Every run is bit-identical: `tests/v1-golden.test.ts` and the event-log determinism tests pass unchanged, and `tests/spatial.test.ts` checks the result index against a copy of the old full ring search with clusters, duplicates and filters.

The gain grows with the battle size because routed tigers flee farther from occupied cells: about 1.17x at 50v1000 and 1.36x at 500v5000; 10v100 is within noise. The larger, model-changing speedup (routed tigers re-pick their flee target on the 1 s retarget timer, research recommendation 8) is tracked separately in #42 and is not part of this change.

## Worker count

The pool now starts `hardwareConcurrency − 1` workers (at least 1, at most 8; 3 when the core count is unknown), see `poolSize` in `src/ui/chunks.ts`. On the 4-core test machine, 3 workers finished a 50v1000 × 40-run job as fast as 4 (5.7–6.0 s vs 5.2–6.3 s), and only the 4-worker runs showed unattributed 56–155 ms main-thread stalls ([research §2.2](research/PERFORMANCE.md#22-monte-carlo-wall-time-vs-worker-count-chromium-real-app-navigatorhardwareconcurrency-overridden)). Leaving one core keeps the page, the replay and (later) ad scripts responsive. Results do not depend on the worker count: per-run seeds come from `(masterSeed, runIndex)`.

## Scheduler and warm workers (#175)

The run workers now sit behind a priority scheduler (`src/ui/scheduler.ts`, [ARCHITECTURE §3](../ARCHITECTURE.md#workers-and-scheduling)). Cancelling or superseding a batch no longer terminates the workers, so the next batch starts on warm, JIT-compiled workers. Chunks are capped at `MAX_CHUNK_RUNS` = 25 runs so a more urgent job waits at most one small chunk. Below the cap the split is unchanged (about `workers × 4` chunks), so small and heavy batches are chunked exactly as before and only batches above about 300 runs (at 3 workers) get more, smaller chunks.

**Results.** Unchanged: every run is still seeded by its index, and the scheduler now returns summaries in run order. Before, the pool concatenated them in the order chunks finished. `tests/scheduler.test.ts` runs the one-on-one presets through `SimPool` at 1, 3 and 8 workers, with a fake worker that runs the real free engine and answers in a scrambled order. The summaries equal `runAllFree` and the wins and median match `tests/fixtures/preset-shares.json`. A one-off run of the same check over all 11 presets at 1 and 8 workers also matched the fixture. Every golden test passes unchanged.

**Batch wall time.** `SimPool` from `main` and from this branch were bundled side by side (rolldown) and driven against the real `sim.worker.ts` in Node `worker_threads`, 3 workers, alternating old and new. Cold is a fresh pool's first batch (3 rounds). Warm is the median of 7 batches on a pool that has already run one. The table shows the median, with the range in brackets, in ms. Node v22.22.0 on the 4 vCPU machine above. Other jobs were running on it (load average 6–8), so the spread is wide.

| Batch                         | Chunks (old → new) | Cold, old              | Cold, new              | Warm, old             | Warm, new             | Warm new / old |
| ----------------------------- | ------------------ | ---------------------- | ---------------------- | --------------------- | --------------------- | -------------: |
| free lion 1 v tiger 1 × 2,000 | 12 → 80            | 1,154 [1,137–1,179]    | 1,030 [1,020–1,351]    | 415 [380–765]         | 365 [292–565]         |           0.88 |
| free 1 v 1 × 20,000           | 12 → 800           | 5,314 [5,292–6,450]    | 5,169 [3,793–5,194]    | 5,155 [3,005–5,603]   | 4,299 [3,411–7,337]   |           0.83 |
| free lion 5 v tiger 5 × 500   | 12 → 20            | 3,173 [2,838–3,346]    | 3,607 [3,172–3,767]    | 716 [416–979]         | 691 [534–1,147]       |           0.97 |
| classic 1 v 1 × 20,000        | 12 → 800           | 14,230 [10,753–16,125] | 10,747 [10,506–17,871] | 11,337 [6,457–20,931] | 12,594 [6,551–17,536] |           1.11 |
| classic 10 v 100 × 500        | 12 → 20            | 4,830 [2,090–5,228]    | 4,087 [1,789–4,658]    | 2,068 [1,302–2,252]   | 2,134 [1,316–2,584]   |           1.03 |
| classic 50 v 1,000 × 40       | 10 → 10 (control)  | 5,548 [5,445–5,627]    | 5,821 [5,672–5,833]    | 3,510 [2,925–4,704]   | 3,933 [3,191–4,418]   |           1.12 |

The last row is chunked identically on both branches, so its 1.12 shows the noise on this machine. An earlier session of the same benchmark gave warm ratios of 0.97, 1.14, 0.70, 0.99, 0.95 and 0.98 for the six rows, and a third gave 0.81 for free 1 v 1 × 20,000. None of the rows moved consistently in either direction.

To isolate the cost of the extra messages, the worst case (free 1 v 1 × 20,000, about 0.3 ms per run, 800 instead of 4 chunks) ran on **one** worker: warm 6,011 ms [5,122–6,471] old vs 6,372 ms [6,011–6,859] new, median of 9. That is about 6 %, or roughly 0.45 ms per extra chunk round trip, and it only shows up when single runs are this cheap. A default batch (500 runs, 12 → 20 chunks) adds 8 round trips, which is well inside the noise. Workers that stay warm across batches save the cold-start cost the old `cancel()` paid on every supersede: compare the cold and warm columns.

The harness is not committed (it needs the bundled `main` pool next to the branch). To repeat it, bundle `src/workers/sim.worker.ts` and both `SimPool` versions, with the `?worker&url` import stubbed, and run the worker under a `self` shim on `worker_threads`.

## Live-card gates (#181)

`src/ui/live-gates.ts` decides, from measurements only, whether a match gets live cards and how much the card pause computes ([RENEWAL-1.0 §10.2](design/RENEWAL-1.0.md#102-live-step-fork-and-re-simulate-10) point 5, owner decision R6). It is pure and table-tested (`tests/live-gates.test.ts`); nothing in it reads a clock.

- **Gate (a), re-simulation**: `liveSimMs × 1.5 ≤ 500 ms` (`resimGate`). `liveSimMs` is the live run's own simulation time in the live worker (`LiveReplay.liveSimMs`), not a batch average.
- **Gate (b), card-pause budget**: `(3N + checkpoints after T × B) × msPerRun × c_obs ÷ batchWorkers ≤ 0.8 × pause` (`pauseGate`). `c_obs` defaults to 1.3 when no session-start check measured it, and is never taken below 1.
- **Degradation** (`planLiveCards`), first fit wins:
  1. N per card 200, then 100, then 50, with every checkpoint after the card;
  2. N = 50 and only the next 2 checkpoints in the pause (`chance: 'near'`; the rest after the pause);
  3. no what-if numbers and the "전력 비율" bar (`noWhatIf`, "효과 계산 생략: 대결 규모가 큼");
  4. when gate (a) fails: pre-battle cards at tick 0 if `liveSimMs × 1.5 ≤ 0.5 × prediction window` ("대결 규모가 커서 출전 전 변수만 씁니다"), otherwise no cards ("…변수 카드 없이 진행합니다").
- The factor 1.5 also applies to the pre-battle check, because the single simulation after a pick can last longer than the run without cards that was measured.

**Presets in Node** (single thread, warm, model 2, 30 runs each with a trace, the 4 vCPU VM above, other jobs running; seed 1). The plan uses p90 as `liveSimMs` and p50 as `msPerRun`, with §10.2's example PC: 2 batch workers, `c_obs` 1.3, a 15 s pause, a 30 s prediction window, 5 checkpoints after the card, B = 32. Browser numbers will differ. The acceptance measurement of re-simulation p95 on the owner's reference streamer PC is still open (#126).

| Preset                   | ms/run p50 | ms/run p90 | Plan         |
| ------------------------ | ---------: | ---------: | ------------ |
| `lion-tiger`             |        1.9 |        3.4 | live 200 all |
| `pride-five-tigers`      |        7.1 |       11.9 | live 200 all |
| `tiger-bear`             |        1.5 |        4.5 | live 200 all |
| `bear-wolf-pack`         |       12.9 |       31.0 | live 200 all |
| `buffalo-pride`          |        7.5 |       25.5 | live 200 all |
| `elephants-pride`        |        9.5 |       24.9 | live 200 all |
| `mammoth-wolves`         |       10.6 |       15.3 | live 200 all |
| `trex-mirror`            |        2.2 |        6.7 | live 200 all |
| `trex-squad-tiger-horde` |       28.1 |       68.6 | live 100 all |
| `trex-erectus-100`       |       22.7 |       37.5 | live 200 all |
| `lions-hyenas`           |        2.4 |        4.8 | live 200 all |
| `polar-bear-brown-bear`  |        1.0 |        1.2 | live 200 all |
| `elephant-hippo`         |        1.7 |        5.7 | live 200 all |
| `raptors-trex`           |       10.4 |       19.5 | live 200 all |
| `elephant-rhino`         |        1.3 |        2.3 | live 200 all |
| `hippo-rhino`            |        1.3 |        2.5 | live 200 all |
| `trex-spinosaurus`       |        1.4 |        2.4 | live 200 all |
| `trex-triceratops`       |        1.2 |        2.7 | live 200 all |

Every ready preset passes gate (a) with room to spare. Only `trex-squad-tiger-horde` drops to N = 100. The gates matter for large custom matchups, and later for the cup brackets (M5), which test every pair.

## Font swap

Pretendard loads with `font-display: swap`, so a first visit paints text in a fallback font and reflows when the web font arrives. The default system fonts have different widths and line heights, which shifted the content pages by up to 0.17 (guide, 1366 px).

`src/assets/fonts/pretendard-fallback.css` defines a local family, `Pretendard Fallback`, listed right after Pretendard in `--font-sans` (app and `site.css`, kept equal by the token mirror test):

| Face         | Local fonts                                             | `size-adjust` | ascent / descent override |
| ------------ | ------------------------------------------------------- | ------------- | ------------------------- |
| Latin ≤ 550  | Arial, Helvetica, Liberation Sans                       | 100.93%       | 94.32% / 23.88%           |
| Latin > 550  | Arial Bold, Helvetica Bold, Liberation Sans Bold        | 98.6%         | 96.55% / 24.44%           |
| Hangul ≤ 550 | Noto Sans CJK KR, Source Han Sans KR, WenQuanYi Zen Hei | 86.43%        | 110.15% / 27.88%          |
| Hangul > 550 | the bold cuts of the same fonts (WenQuanYi has none)    | 86.43%        | 110.15% / 27.88%          |

The values come from Canvas `TextMetrics` in Chromium at 1,000 px: Pretendard Variable has ascent 0.952 em, descent 0.241 em and no line gap; common Hangul syllables advance 0.8643 em at every weight; a Latin sentence is 1.0093x as wide as in Arial at weight 400 and 0.986x as wide as in Arial Bold at 600–700. The overrides are divided by `size-adjust` because they scale with it. Separate bold faces matter: without them the browser synthesises bold from the regular face, which is about 5% narrower than Pretendard's bold. With the two bold faces removed from the `908470d` build, the swap measured 0.0661 on `/en/guide/` at 1366 px (0.0708 over the 12 pairs). In the first screen, the bold lead-ins of three list items widened, the text after them moved 9–17 px to the right, and a link that was split across two lines moved whole onto the next line. The only element on the page that changed height was the bold table row header "1 buffalo vs 15 hyenas" below the fold (2 → 3 lines). No heading re-wrapped; an earlier version of this page said headings did (#138).

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

### Text widths in em (#138)

`max-width: 70ch` on `.page-body p` and `.page-body li` (#52) brought the shift back. `ch` is the advance of "0" in the element's font: 0.5613 em in `Pretendard Fallback` and 0.5957 em in Pretendard Variable at weight 400 (Chromium computed widths at 1,000 px). When Pretendard arrived, a 70ch column at 16 px widened from 627.8 to 667.2 px and its text re-wrapped: on `/en/guide/` at 1366 px the first paragraph went from 6 lines to 5 and the content below it moved up. At 390 px the column is narrower than 70ch, so phones were not affected.

Text widths are now in `em`, n ch of Pretendard being n × 0.5957 em:

| Rule                                                          | Before | After     |
| ------------------------------------------------------------- | ------ | --------- |
| `.page-body p`, `.page-body li` (`src/pages/site.css`)        | `70ch` | `41.7em`  |
| `.intro-lead` (`src/ui/styles.css`)                           | `80ch` | `47.66em` |
| `.faq-item p` (`src/ui/styles.css`)                           | `72ch` | `42.89em` |
| `.site-footer p` (`src/ui/site-footer.css`)                   | `72ch` | `42.89em` |
| `.version-footer-num`, `min-width` (`src/ui/site-footer.css`) | `5ch`  | `2.98em`  |

The version slot in the footer stays empty without JavaScript, so its `5ch` would also have widened at the swap (38.1 → 40.5 px at 13.6 px). `tests/css-units.test.ts` fails when `width`, `min-width`, `max-width` or an `inline-size` property in a stylesheet under `src/` uses `ch`.

With Pretendard loaded, the columns keep their width. On all 21 built pages at 390, 1366 and 1920 px, the 2,922 elements under these rules have the same height and position as on `main`, and every page has the same height. Prose at 16 px is about 667.2 px wide on both. The only width differences are below 0.5 px: the footer disclaimer and the patch-note card lines at 13.6 and 14.4 px are 0.27–0.41 px wider, because Chromium's `ch` at those sizes matches a font size rounded down to 1/64 px; `.intro-lead` is 0.05 px wider; and the prose column is 0.01 px wider (667.19 px on `main`, 667.20 px with `41.7em`), because 70ch of Pretendard is 41.699em. Before the swap the column now has its final width: on `/en/guide/` at 1366 px the first paragraph is 667.2 px wide and 5 lines tall before and after.

Font-swap CLS over the 12 pairs (method above, Chromium 141, median of 3 runs; a second pass of 3 runs gave the same medians):

| Build                           |    Sum | Worst                          |
| ------------------------------- | -----: | ------------------------------ |
| `908470d` (#24, before `70ch`)  | 0.0022 | 0.0017 (`/guide/`, 1366 px)    |
| `main` at `0e5bfd8`             | 0.0524 | 0.0242 (`/en/guide/`, 1366 px) |
| with text widths in `em` (#138) | 0.0034 | 0.0017 (`/en/guide/`, 1366 px) |

Per pair, `main` → #138: `/guide/` 1366 px 0.0225 → 0.0012, `/en/guide/` 1366 px 0.0242 → 0.0017, `/en/model/` 1366 px 0.0053 → 0.0002; the other nine pairs are 0–0.0001 on both. Counting every `p`, `li`, heading and table cell on the 12 pairs, 96 changed height at the swap on `main` (3 in the first 900 px) and 51 with #138 (none in the first 900 px). 38 of those 51 are on `/en/model/` at 390 px, mostly cells of narrow tables, and change on `main` too.

The remaining 0.0034 is text moving sideways while no block in view changes height: the English header links (weight 500, drawn from the regular fallback face) move 3–5 px, and in a few list items a word moves up to the line above, which shifts the rest of the item's lines sideways (68 px for a link on `/en/guide/`).

## Language switch and startup

- The language switch painted every chart twice in one task (`renderResults`, then `redrawAllCharts`). Charts now repaint once, in a task after the next frame, so the translated text paints first.
- The advanced parameter table (22 rows, 66 inputs) was built at start-up and rebuilt on every language switch, although most visits never open it. It is now built when the section is first opened, or right away if it was open before a rebuild.

Together these cut the longest start-up task from 441 to 235 ms and the start-up total from 849 to 542 ms at 4x CPU, and the language switch by 20–25%. The switch still rebuilds the form; updating the labels in place (research recommendation 2) would remove most of the remaining 190 ms at 4x CPU.

## Startup JavaScript per page (#82)

The startup JavaScript of a page is every script in its built HTML plus their static imports (`import()` excluded), compressed with brotli quality 11 (gzip level 9 in brackets). Measured with `vite build` at d442cab (v0.2.12) and on the branch.

| Page              | Before (v0.2.12)  | One language per page (#79) | Plus lazy replay and tour (#80) |
| ----------------- | ----------------- | --------------------------- | ------------------------------- |
| `/`               | 74.0 KB (86.7 KB) | 66.9 KB (76.7 KB)           | 50.0 KB (56.6 KB)               |
| `/en/`            | 74.0 KB (86.7 KB) | 65.2 KB (75.0 KB)           | 48.2 KB (55.0 KB)               |
| `/r/`             | 32.1 KB (38.2 KB) | 24.2 KB (27.3 KB)           | 24.5 KB (27.7 KB)               |
| `/en/r/`          | 32.1 KB (38.2 KB) | 22.4 KB (25.7 KB)           | 22.8 KB (26.0 KB)               |
| content pages[^1] | 1.0 KB (1.2 KB)   | 1.1 KB (1.2 KB)             | 1.1 KB (1.2 KB)                 |

[^1]: `/guide/`, `/patch-notes/` and the other content pages load only `routes` and `site`, no dictionary.

**One language per page (#79, #67).** Both dictionaries used to sit in a chunk shared by the app and the `/r/` page, so every page downloaded the other language for nothing. The words now live in `src/i18n/ko.ts`, `src/i18n/en.ts` and `src/share/messages-<lang>.ts`; each page has its own entry (`src/main-ko.ts`, `src/main-en.ts`, `src/share/result-page-ko.ts`, `-en.ts`) that bundles only its language and registers it (`src/i18n/registry.ts`) before the page starts. The language button loads the other language with `import()` (`src/i18n/load.ts`; two chunks, about 9 KB br), warmed on hover or focus; if it cannot be loaded, the button opens the other language's URL instead. `tests/i18n-bundle.test.ts` fails if an entry's static import graph reaches the other language. The switch itself (relabelling, one chart repaint) is unchanged; with the Playwright harness at 4x CPU it measured 184–300 ms (`/`) and 355–507 ms (`/en/`) both before and after, so the load adds no measurable time once warmed.

**Lazy replay and tour (#80).** The replay renderer (`src/ui/replay.ts` and `replay/*`, 16.8 KB br) loads with `import()` when Run is pressed and mounts into `.replay-slot`; the tour (`src/ui/tour.ts`, 3.2 KB br plus 0.8 KB CSS) loads on its first start and is warmed when the pointer enters its button. The first-visit offer moved to `src/ui/tour-offer.ts` so it still renders with the page. Loading `/` requests neither chunk. CLS while the replay mounts is unchanged against v0.2.12: 0.0169 at 1366×900 and 0.0002 at 390×800 on both builds (Playwright, layout shifts without recent input).

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

**Regression test.** `tests/free-perf.test.ts` has two halves. In every `npm test` it checks the deterministic part of the claim: `freeWorkEstimate` counts the same agent-steps as `workEstimate` for the same matchup (and exactly `FREE_WORK_WEIGHT_BUFF` times as many with an active pack buff), and seeded 10 v 100 batches (tigers, and wolves with the buff on) never simulate more (weighted) agent-steps than the budget counted. The timing gates (the free engine costs at most 1.5× the legacy engine per agent-step at 10 v 100 with tigers, and per weighted agent-step with wolves and the buff on; median of 7 interleaved rounds after a warm-up) run only with `BENCH=1 npx vitest run tests/free-perf.test.ts`: wall time is not deterministic, and in the default suite a single slow round on a loaded machine failed them (#82). Run the gates whenever `src/sim/free/engine.ts` changes.

## Deterministic math (#197)

Model 2 of both engines replaces `Math.sin`, `cos`, `atan2` and `log` with `src/sim/detmath.ts`. Measured 2026-11-10 in vitest (Node 22, V8) on a 4-core container, 30 runs × 300 s per batch, median of 5 alternating rounds, wall time per simulated agent-step, in two sessions:

| Batch                                       | Model 1 (ns)  | Model 2 (ns)  | Ratio     |
| ------------------------------------------- | ------------- | ------------- | --------- |
| Free, 10 _T. rex_ v 100 tigers, morale off  | 129.9 / 124.7 | 135.6 / 133.4 | 1.04–1.07 |
| Free, _T. rex_ 1 v 50 wolves (pack buff)    | 405.2 / 396.1 | 478.0 / 430.4 | 1.09–1.18 |
| Classic, 10 _T. rex_ v 100 tigers (default) | 164.8 / 172.3 | 184.5 / 187.0 | 1.09–1.12 |

Per call the functions cost about twice V8's built-ins (2 million calls: `dsin` 31.8 ns against 16.2 ns, `dcos` 28.7 against 21.2, `datan2` 36.8 against 22.4, `dlog` 41.0 against 10.8). The wolf row also includes flight (wolves break off from the _T. rex_), so it overstates the math. With morale on, model 2's figure for the free tiger horde is higher per agent-step (about 2.2×) because far more tigers flee, and a fleeing agent searches for its nearest enemy every tick; the battle ends in about a fifth of the simulated time (median 27 s against 133 s), so a whole batch is cheaper. Issue #197 allows about 10 %; the free engine stays within it, the classic engine sits at its edge. Not measured: real browsers.

**Flight mode (owner decision 2026-11-16).** In `allIn`, the default, the engine skips the flight pass entirely (`flightOn` is false), so its cost is model 2's math alone. Measured 2026-11-16 the same way (vitest, Node 22, 4-core container, 30 runs × 300 s, median of 5 alternating rounds, wall time per simulated agent-step, morale on): 10 _T. rex_ v 100 tigers 165.8 ns in `allIn` against 362.8 ns in `realistic`, where most tigers flee and a fleeing agent searches for its nearest enemy every tick (its battles end in about a fifth of the time, so a `realistic` batch is still cheaper); 10 lions v 1 elephant 365.0 against 369.1 ns (+1 %, the flight pass itself). Simple and every preset run `allIn`.

## Battle end and model 3 (#230)

Model 3 runs a battle until one side is out (MODEL.md §2.4): a routed agent stays in the battle until it has run off the field or been caught. The per-tick cost barely changes (one more count per tick; an agent with no enemy left fighting searches for the nearest routed one, a second grid query only then); the cost per run grows with the time the losing side needs to leave. Measured 2026-11-18 in vitest (Node 22, V8) on the 4-core container, one batch per row (20 runs for the 30+ agent presets, 60 for the others, seed 20261019), wall time per run on one core, model 2 against model 3, both `allIn` (the mode Simple runs). Two calibration runs shared the machine, so treat the figures as ±20 %.

| Preset (Simple runs 500)                  | Model 2 (ms/run) | Model 3 (ms/run) | Model 3, one Simple batch (core-s) |
| ----------------------------------------- | ---------------: | ---------------: | ---------------------------------: |
| `lion-tiger`                              |              2.6 |              3.4 |                                1.7 |
| `pride-five-tigers`                       |              8.5 |              3.0 |                                1.5 |
| `bear-wolf-pack`                          |             11.8 |              5.5 |                                2.8 |
| `elephants-pride`                         |             12.3 |             17.6 |                                8.8 |
| `mammoth-wolves`                          |              6.5 |              7.7 |                                3.9 |
| `trex-squad-tiger-horde`                  |             35.2 |             34.6 |                               17.3 |
| `trex-erectus-100`                        |             25.0 |             44.3 |                               22.1 |
| `raptors-trex`                            |             13.6 |             14.9 |                                7.5 |
| other duels                               |          0.7–4.0 |          1.0–5.9 |                            0.5–2.9 |
| 100 _H. erectus_ v 1 _T. rex_ (#230 link) |             28.1 |             42.9 |                               21.5 |

The heaviest Simple batches stay at about 20 core-seconds, about 5 s of wall time on a 4-core machine (phones slower); no preset needs a run-count change. The work budget counts `maxTime` ticks (`freeWorkEstimate`), so the 3,600 s default lowers the run cap of very large configs to a third (1,000 v 1,000 with the pack buff: 833 → 277 runs; 5,500 agents: 303 → 101 with the buff, 757 → 252 without); those are the batches where a 1,200 s cap could cut long battles short. With morale off (no fleeing) battles run until one side is incapacitated and cost much more: in a first version of model 3 that had no rout in `allIn`, `elephants-pride` took 71 ms per run and the 100 _H. erectus_ link 213 ms.

## Standing performance checks (#241)

> **한국어 요약**
>
> - 기능을 하나씩 잴 때만 성능을 기록하던 방식을 바꿔, 같은 시나리오를 계속 다시 재는 장치를 만들었습니다. 계획 전체(6단계)는 [#241](https://github.com/VinylStage/trex_vs_tiger_sim/issues/241)에 있고, 이번에 1–3단계(벤치 스크립트, 예산, PR 관문)가 들어갔습니다.
> - 실행: `npm run bench`(전체 행렬, 이 컨테이너에서 약 50초), `npm run build && npm run bench:size`(페이지별 시작 JS). 시나리오는 `bench/scenarios.json`에 고정되어 있고, 종 목록은 코드의 종 레지스트리에서 만들어지므로 새 종을 넣으면 행이 저절로 늘어납니다.
> - 예산(`bench/budgets.json`): 시나리오마다 기준값 × 1.3, 페이지마다 현재 gzip 크기 × 1.1입니다. 숫자는 추측이 아니라 `bench/baseline-v0.2.27.json`에서 나왔습니다.
> - PR 관문: `src/sim/**`, `src/ui/**`, `vite.*`, `bench/**`를 건드리는 PR에서 CI `perf` 작업이 기준 커밋과 PR의 엔진을 같은 작업 안에서 번갈아 5번 재고, 어느 시나리오든 1.25배를 넘게 느려지거나 페이지 JS가 예산을 넘으면 실패합니다. 결과 표는 작업 요약에 나옵니다.
> - 의도한 저하(#230 같은 경우)는 같은 PR에서 해당 시나리오의 예산을 올리고, 이 문서의 History 표 아래에 이유를 적으면 통과합니다. 예산을 올린 비율만큼 허용치도 커집니다.
> - 4단계(릴리스마다 전체 측정 + Chromium 측정), 5단계(실기기, #191), 6단계(대응 규칙)는 아직 계획입니다.

Until #241, performance was measured once per feature (the sections above) and never again, so a regression was noticed only when someone felt it. #230 alone made some presets several times slower per run. These checks re-measure a fixed matrix so the trend is visible and a pull request that slows the engine down fails before it merges.

### What runs

| Piece                                          | What it does                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bench/scenarios.json`                         | The fixed matrix: seed, scale ladder, preset and species settings, run counts, and the reduced matrix and limits of the CI job.                                                     |
| `bench/harness.mjs`                            | The entry that is bundled: the free engine, its design and summary packing, the preset list and the species registry. `@sim/` resolves to the `src/sim/` of the tree being bundled. |
| `bench/lib.mjs`                                | Bundles a tree's engine with Vite's SSR build (Vite is already a dev dependency), expands the matrix, times runs, hashes results, measures page JavaScript.                         |
| `bench/run.mjs` (`npm run bench`)              | Runs the matrix on this checkout, prints the table and writes JSON (`bench/last-run.json`, ignored by git, or `--out`).                                                             |
| `bench/bundle-size.mjs` (`npm run bench:size`) | Startup JavaScript of every page in `dist/` against its budget.                                                                                                                     |
| `bench/budgets.mjs`                            | Writes ceilings into `bench/budgets.json` from a run file (`--from`) and page budgets from a build (`--dist`).                                                                      |
| `bench/compare.mjs`                            | The CI comparison: base and head in one process, alternating.                                                                                                                       |
| `.github/workflows/perf.yml`                   | The `perf` job.                                                                                                                                                                     |

Node built-ins only (`node:crypto`, `node:zlib`, `node:perf_hooks`) plus Vite for bundling; no runtime or dev dependency was added.

### The matrix

All scenarios run the free engine at its newest model (`mv`, passed explicitly: a config without it is read as model 1), seed 20261118, one core, default ranges.

| Group   | Scenarios                                                                                                                                   | Runs (full matrix)                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Scale   | _T. rex_ v tigers, `allIn`: 1v1, 10v100, 50v1000, 500v5000                                                                                  | 200, 30, 8, 3                               |
| Presets | every preset in `src/sim/free/presets.ts` (held ones included) in `allIn` and `realistic`                                                   | 60; 20 for presets with more than 30 agents |
| Species | every id in `FREE_SPECIES_IDS`, 5 v 5, `allIn`: once as a mirror, once against the reference (_T. rex_; the _T. rex_ itself against tigers) | 60                                          |

The run counts are cut far below what Simple runs (500) so the full matrix takes about 50 s on the 4-vCPU container; they measure cost, not win shares. Because the species rows come from the registry, a new species adds two rows (and a new preset two) without anyone editing `scenarios.json`; `tests/bench.test.ts` checks that, and that `bench/budgets.json` has a ceiling for every scenario, so adding a species or preset also means adding its ceilings (`--only` below).

**Metrics per scenario.** Every run is timed on its own (`performance.now()` around `simulateFreeBattle`). ms/run is the median and p95 over the runs; agent-steps/s is Σ(ticks the battle lasted × agents) ÷ timed seconds, the unit of the work budget (unweighted). The hash is a SHA-256 of the packed run summaries (`packFreeSummaries`), cut to 16 hex digits; the matrix hash hashes them all in order. The same engine gives the same hashes on every rerun, so a changed hash means the results changed. Battles differ in length, so ms/run varies a lot between runs of one scenario; the comparison is always on the same seeded runs.

**Noise.** One pass of the full matrix moved the cheapest scenarios (1–3 ms/run) by up to 1.8× between two passes on the same machine (JIT state, a shared VM). `--repeat N` runs the whole matrix N times and keeps each scenario's median over the passes; the baseline uses 3.

### Budgets

`bench/budgets.json` holds:

| Key              | Meaning                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `baseline`       | The run file the ceilings were last set from as a whole.                                                                    |
| `engineMargin`   | 1.3: a scenario's ceiling is its baseline median and p95 times this (container noise is about 10%, the cheapest rows more). |
| `pageMargin`     | 1.1: a page's budget is its startup JavaScript times this.                                                                  |
| `scenarios.<id>` | `msMedian` and `msP95` ceilings, ms/run on the machine of the baseline.                                                     |
| `pages.<page>`   | `gzipBytes`: the page's startup JavaScript budget.                                                                          |

Startup JavaScript is what the [#82 table](#startup-javascript-per-page-82) counts: the module scripts in the built HTML plus every chunk it preloads (Vite emits a modulepreload link for each static import), `import()` chunks and inline scripts excluded, here gzip level 9 from `node:zlib`.

The ceilings are absolute times on the machine that measured the baseline, so they are checked only on demand: `npm run bench -- --check` exits 1 when a scenario is over its ceiling. The CI runner is a different machine; there the ceilings matter only as ratios (next section).

### PR gate

The `perf` job runs on pull requests that touch `src/sim/**`, `src/ui/**`, `vite.*`, `bench/**` or the workflow itself. It builds the head (`npm run build`), checks the base commit out into a worktree, and runs `node bench/compare.mjs --base <base> --dist dist`:

1. Both trees' engines are bundled with the head's harness, so base and head run the same measuring code. If the base cannot be bundled with it (an export the harness needs is missing there), the engine comparison is skipped with a note and the page budgets are still checked.
2. The reduced matrix (`reduced` in `scenarios.json`): the scale ladder up to 1,100 agents (500v5000 is left out: one run takes about 6 s), every preset in `allIn`, every species row, at half the run counts. Each batch repeats until at least 250 ms is timed, so cheap scenarios are not measured from a few milliseconds.
3. Five rounds; in each, base and head run every scenario back to back, base first in even rounds and head first in odd ones, so a slow moment of the runner hits both. The ratio per round is head ÷ base mean ms/run; the gate takes the median over rounds.
4. A scenario fails when that ratio is above 1.25 × (head ceiling ÷ base ceiling, at least 1), or when one tree gives different hashes in different rounds (nondeterminism). Results that differ between base and head are reported, not failed: a model change is expected to change them.
5. A page fails when its gzip size is over its budget. A built page with no budget, and a budgeted page that was not built, are reported as notes.
6. The markdown summary goes to `$GITHUB_STEP_SUMMARY`: failures and notes first, then the table sorted by ratio.

Scenarios that exist only on the head (a new species or preset) have no base and are listed as new. Permissions are `contents: read`; the actions are the SHA-pinned ones of `ci.yml` (`tests/workflows.test.ts`).

**Calibration of the gate.** With base = head (this branch against `main`, identical engines) on the 4-vCPU container, two runs of the gate gave ratios between 0.94 and 1.11 over all 53 scenarios, against the 1.25 limit; with three rounds and 150 ms the spread reached 1.22, which is why the job uses five rounds and 250 ms. A deliberate 1 ms busy-wait per battle failed the 15 cheapest scenarios (1.3–2.2×), and raising one scenario's ceiling sixfold in the same tree let that scenario pass (limit 7.5×). The whole comparison takes about 3.5 minutes on the container.

### Updating budgets

- **Intended slowdown.** Measure the affected scenarios on the head and raise their ceilings in the same pull request, then add a row to the History table below with the reason:

  ```bash
  npm run bench -- --only preset-elephants-pride --repeat 3 --out /tmp/run.json
  node bench/budgets.mjs --from /tmp/run.json
  ```

  `--from` rewrites only the scenarios in the file, at their measured value × `engineMargin`. The gate then allows the scenario 1.25 × (new ceiling ÷ old ceiling), so the allowance grows by exactly the raise. Measure on the machine the baseline came from, or rescale by hand: what counts is the ratio of the new ceiling to the old.

- **Bigger page on purpose.** `npm run build && node bench/budgets.mjs --dist dist` resets every page budget to its current size + 10%; edit a single `pages.<page>` entry by hand to raise one.
- **New baseline.** Each release gets a new file, never overwriting an older one (`--baseline` refuses): `npm run bench -- --baseline --repeat 3` writes `bench/baseline-v<package version>.json`, then `node bench/budgets.mjs --from bench/baseline-v<version>.json --dist dist` resets everything. Releases doing this routinely is phase 4.

### History

| Version | Commit    | Date       | Model | Matrix hash        | 1v1 / 10v100 / 50v1000 / 500v5000 (ms/run, median) | Slowest preset (ms/run, median)  | `/play/` JS (gzip) | Note                                        |
| ------- | --------- | ---------- | ----: | ------------------ | -------------------------------------------------- | -------------------------------- | -----------------: | ------------------------------------------- |
| 0.2.27  | `2b3398c` | 2026-11-18 |     3 | `86bd8311e849d871` | 0.42 / 30.3 / 660 / 6,367                          | `trex-erectus-100` `allIn`, 49.6 |            80.1 KB | First baseline; `main` after #240 (model 3) |

Measured on a 4 vCPU Intel Xeon @ 2.10 GHz container, Node v22.22.0, three passes. The baseline is named after the package version at the time (0.2.27); the commit already holds model 3 (#230), which ships as 0.2.28. Other slow rows: `trex-squad-tiger-horde` `allIn` 33.4, `elephants-pride` `allIn` 17.8; slowest species row the _Spinosaurus_ mirror at 16.7 ms/run. Page JS: `/en/play/` 78.1 KB, `/r/` 43.4 KB, `/en/r/` 41.4 KB, `/reset/` 3.0 KB, every content page 1.5 KB.

### Planned (phases 4–6 of #241)

- **Release check (phase 4).** Before each release-please merge, the full matrix plus the Chromium checks (long tasks from Run to verdict, CLS on font swap and first result, startup long tasks, replay frame time) in a manual or scheduled workflow, with a dated row per version in the History table.
- **Real devices (phase 5).** The `/bench/` page of #191 runs the same matrix on the owner's PC and a mid-range phone, once per minor version and whenever the gate flags a slowdown.
- **Response rules (phase 6).** Over budget means fix or justify in the pull request, no silent budget bumps; a preset whose Simple batch exceeds 10 s on the reference 4-core machine gets fewer runs or an optimisation before release.

## Not changed

- No `SharedArrayBuffer`: it needs cross-origin isolation, which conflicts with third-party ad iframes ([research §3](research/PERFORMANCE.md)). Transfers are already zero-copy.
- The cost estimator recalibration, a static HTML shell for the simulator, build-time font subsetting and in-place label updates on a language switch (research recommendations 11, 6, 7 and 2) are open.
