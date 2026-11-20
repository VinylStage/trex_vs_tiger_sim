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
> - 상시 성능 점검(#241): `npm run bench`가 고정 시나리오(규모 4단계, 모든 프리셋 × 두 도주 모드, 모든 종의 미러전과 기준 상대전)를 재고 결과를 JSON으로 남깁니다. 기준값은 `bench/baseline-v0.2.27.json`, 예산은 기준값 × 1.3(엔진)과 현재 gzip 크기 + 10%(페이지 JS)입니다. 엔진·UI·Vite 설정·`bench/`를 건드리는 PR은 CI `perf` 작업이 기준 커밋과 PR을 번갈아 재서, 어떤 시나리오든 25% 넘게 느려지거나 페이지 JS가 예산을 넘으면 실패합니다. 의도한 저하는 같은 PR에서 `bench/budgets.json`을 올리고 이 문서에 이유를 적으면 통과합니다. 릴리스 PR을 머지하기 전에는 `Release perf` 워크플로가 전체 행렬과 Chromium 측정(실행 중 긴 작업, 첫 결과 CLS, 4배 감속 시작, 재생 프레임)을 돌리고, 버전마다 History 표에 한 줄을 남깁니다.
> - 대응 규칙(#241 6단계)이 시행 중입니다. 예산을 넘으면 같은 PR에서 고치거나 이유를 적고, 이유 없이 예산만 올리지 않습니다. 기준 4코어 머신에서 Simple 실행 한 번이 10초를 넘는 프리셋은 릴리스 전에 실행 횟수를 줄이거나 최적화합니다.
> - 대응 규칙의 첫 적용(#254): `trex-erectus-100`(티라노 1 vs 호모 에렉투스 100)의 Simple 실행이 500회로 10.7–11.5초 걸려 10초 규칙을 넘었으므로 이 프리셋만 300회로 줄였습니다. 같은 측정으로 7.4초입니다. 엔진과 결과는 바뀌지 않았습니다.
> - Simple 모드 결과가 처음 그려질 때의 레이아웃 이동(#251)은 결과 골격으로 0.1399 / 0.4000에서 0 / 0(1366×900 / 390×800)이 되었습니다. 첫 실행을 누르는 순간 막대, 판정 문장, 끝난 방식, 공유 버튼 자리를 최종 크기로 잡아 둡니다.
> - 도주 방향 삼각함수 캐시(#256): 모델 3부터 패주한 동물은 첫 도주 방향을 끝까지 유지하는데, `steer`가 그 방향의 `cos`/`sin`을 매 틱 다시 계산하고 있었습니다. 동물마다 마지막 방향과 그 `cos`/`sin`을 저장해 두고, 방향이 비트 단위로 같을 때만 다시 씁니다. 결과는 모든 모델 버전에서 비트 단위로 같고(골든, JavaScriptCore 골든, 행렬 해시 `c3d307b09caa2695` 그대로), 도주가 많은 프리셋이 3–6% 빨라졌습니다(`trex-erectus-100` 0.94배).

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
> - 기능을 하나씩 잴 때만 성능을 기록하던 방식을 바꿔, 같은 시나리오를 계속 다시 재는 장치를 만들었습니다. 계획 전체(6단계)는 [#241](https://github.com/VinylStage/trex_vs_tiger_sim/issues/241)에 있고, 1–3단계(벤치 스크립트, 예산, PR 관문)에 이어 4단계(릴리스 점검)가 들어갔습니다.
> - 실행: `npm run bench`(전체 행렬, 이 컨테이너에서 약 50초), `npm run build && npm run bench:size`(페이지별 시작 JS). 시나리오는 `bench/scenarios.json`에 고정되어 있고, 종 목록은 코드의 종 레지스트리에서 만들어지므로 새 종을 넣으면 행이 저절로 늘어납니다.
> - 예산(`bench/budgets.json`): 시나리오마다 기준값 × 1.3, 페이지마다 현재 gzip 크기 × 1.1입니다. 숫자는 추측이 아니라 `bench/baseline-v0.2.27.json`에서 나왔습니다. 이 파일은 측정 당시 `package.json` 버전을 따라 0.2.27로 이름이 붙었지만, 실제로는 0.2.28로 출시된 엔진(모델 3)을 잰 것입니다. 파일 이름은 바꾸지 않습니다.
> - PR 관문: `src/sim/**`, `src/ui/**`, `vite.*`, `bench/**`를 건드리는 PR에서 CI `perf` 작업이 기준 커밋과 PR의 엔진을 같은 작업 안에서 번갈아 5번 재고, 어느 시나리오든 1.25배를 넘게 느려지거나 페이지 JS가 예산을 넘으면 실패합니다. 결과 표는 작업 요약에 나옵니다.
> - 의도한 저하(#230 같은 경우)는 같은 PR에서 해당 시나리오의 예산을 올리고, 이 문서의 History 표 아래에 이유를 적으면 통과합니다. 예산을 올린 비율만큼 허용치도 커집니다.
> - 릴리스 점검(4단계): release-please PR을 머지하기 전에 Actions의 `Release perf` 워크플로를 그 PR 브랜치에서 직접 실행합니다(`gh workflow run release-perf.yml --ref <release-please 브랜치>`). release-please PR은 `GITHUB_TOKEN`으로 열리기 때문에 `pull_request` 트리거가 실제로는 돌지 않습니다(승인 대기 상태로만 남음). 전체 행렬(3회 반복), 페이지별 JS, Chromium 측정을 한 작업에서 재고, 작업 요약에 History 표 두 줄(엔진, 브라우저)을 붙여 줍니다. 그 두 줄과 결과 파일 `baseline-v<버전>.json`을 작은 PR로 `main`에 올리면 끝입니다.
> - History 표에는 0.2.28(이 저장소 컨테이너에서 직접 실행)과 0.2.29(모델 4, 출시 뒤 실행) 줄이 들어가 있습니다. Chromium 측정에서 Simple 모드 결과가 처음 그려질 때 CLS가 0.14(1366×900) / 0.40(390×800)으로 나왔는데, 결과 패널이 최종 높이를 미리 잡아 두지 않아 하단 푸터가 밀려나는 한 번의 이동입니다.
> - Playwright는 이 프로젝트의 의존성이 아닙니다. 워크플로가 고정 버전을 저장소 밖 임시 폴더에 설치해서 씁니다.
> - 첫 결과 CLS는 #251에서 고쳤습니다(0 / 0, [아래](#layout-shift-when-simple-results-render-251)).
> - 6단계(대응 규칙)는 시행 중입니다([Response rules](#response-rules-phase-6)). 5단계(실기기)는 #191의 `/bench/` 페이지로 들어갔습니다([Live benchmark](#live-benchmark-191)).

Until #241, performance was measured once per feature (the sections above) and never again, so a regression was noticed only when someone felt it. #230 alone made some presets several times slower per run. These checks re-measure a fixed matrix so the trend is visible and a pull request that slows the engine down fails before it merges.

### What runs

| Piece                                           | What it does                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bench/scenarios.json`                          | The fixed matrix: seed, scale ladder, preset and species settings, run counts, and the reduced matrix and limits of the CI job.                                                          |
| `bench/harness.mjs`                             | The entry that is bundled: the free engine, its design and summary packing, the preset list and the species registry. `@sim/` resolves to the `src/sim/` of the tree being bundled.      |
| `bench/lib.mjs`                                 | Bundles a tree's engine with Vite's SSR build (Vite is already a dev dependency), expands the matrix, times runs, hashes results, measures page JavaScript.                              |
| `bench/run.mjs` (`npm run bench`)               | Runs the matrix on this checkout, prints the table and writes JSON (`bench/last-run.json`, ignored by git, or `--out`).                                                                  |
| `bench/bundle-size.mjs` (`npm run bench:size`)  | Startup JavaScript of every page in `dist/` against its budget.                                                                                                                          |
| `bench/budgets.mjs`                             | Writes ceilings into `bench/budgets.json` from a run file (`--from`) and page budgets from a build (`--dist`).                                                                           |
| `bench/compare.mjs`                             | The CI comparison: base and head in one process, alternating.                                                                                                                            |
| `.github/workflows/perf.yml`                    | The `perf` job.                                                                                                                                                                          |
| `bench/browser.mjs`                             | The Chromium checks of the release check, against `vite preview`; Playwright is loaded from outside the project (`PLAYWRIGHT_DIR`).                                                      |
| `bench/history.mjs`, `bench/release-report.mjs` | Turn a full-matrix run, the page sizes and the Chromium checks into the two History rows and the release summary.                                                                        |
| `bench/matrix.mjs`                              | The matrix expansion, percentiles and the timing loop, without Node built-ins: `bench/lib.mjs` and the `/bench/` page both use it, so a device times exactly what `npm run bench` times. |
| `/bench/` (`bench/index.html`, `src/bench/`)    | The live benchmark kit for real devices (#191, [Live benchmark](#live-benchmark-191)).                                                                                                   |
| `.github/workflows/release-perf.yml`            | The release check (`Release perf`).                                                                                                                                                      |

Node built-ins only (`node:crypto`, `node:zlib`, `node:perf_hooks`) plus Vite for bundling; no runtime or dev dependency was added. The release check also needs Playwright, which stays out of `package.json`: the workflow installs a pinned version into a directory outside the checkout (next sections).

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
- **New baseline.** Each release gets a new file, never overwriting an older one (`--baseline` refuses): `npm run bench -- --baseline --repeat 3` writes `bench/baseline-v<package version>.json`, then `node bench/budgets.mjs --from bench/baseline-v<version>.json --dist dist` resets everything. The release check writes that file for every release (next section); resetting the budgets from it stays a deliberate step, because its numbers come from a CI runner, not the machine the current ceilings were measured on.

### Release check

Before each release-please pull request is merged, the `Release perf` workflow (`.github/workflows/release-perf.yml`) measures the release candidate once in full: the engine matrix, the startup JavaScript of every page and four Chromium checks. Its job summary ends with two History rows ready to paste, and the artifact `release-perf-<version>` holds the JSON.

**How it is triggered.** Run it by hand on the release-please branch:

```bash
gh workflow run release-perf.yml --ref release-please--branches--main--components--trex-vs-tiger-sim
gh run watch "$(gh run list --workflow release-perf.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

or Actions → Release perf → Run workflow, with that branch selected. The workflow also listens for `pull_request` events from a `release-please--` branch (only pull requests that change `.release-please-manifest.json` start it at all), but that path cannot be relied on: release-please opens and updates its pull request with `GITHUB_TOKEN`, and on this repository none of those runs has ever started a job: all 68 `pull_request` runs of the CI workflow on the release branch (2026-10-19 to 2026-11-19, the 0.2.27 and 0.2.28 release pull requests among them) ended as `action_required` or `failure` with zero jobs. It would start on its own only if release-please were given a token of its own (a GitHub App or a PAT), which this repository does not do. `workflow_dispatch` is the supported path; `CONTRIBUTING.md` lists it as a release step.

**What runs** (one job, about 5 minutes on `ubuntu-latest`: 2 min for the matrix, 30 s to install Playwright and Chromium, 2 min for the Chromium checks):

1. `npm ci`, `npm run build`.
2. The commit to record: the checked-out head, or its parent when the head is release-please's `chore(main): release …` commit, so the row names the `main` commit the release was cut from (the release commit itself is replaced when the pull request is squash-merged).
3. `npm run bench -- --repeat 3 --out <dir>/baseline-v<version>.json`: the full matrix, three passes, as for the first baseline. On the release branch `package.json` already holds the new version, so the file has the right name.
4. `npm run bench:size -- --json <dir>/size.json`: page JavaScript against `bench/budgets.json`. A page over budget fails the job (after the remaining steps have run). Engine ceilings are not checked here: they are absolute times on the machine of the baseline, and the runner is a different machine.
5. Playwright, outside the project: `npm install --prefix "$RUNNER_TEMP/playwright" --no-save playwright@<PLAYWRIGHT_VERSION>` and `playwright install --with-deps --only-shell chromium`. The version is pinned in the workflow (`PLAYWRIGHT_VERSION`, 1.64.1). `npx playwright@<version>` alone is not enough, because the measuring script has to import the library, not only run its CLI; `bench/browser.mjs` loads it with `createRequire` from `PLAYWRIGHT_DIR`. `tests/bench.test.ts` fails if Playwright appears in `package.json`.
6. `vite preview` on port 4173 and `node bench/browser.mjs --samples 3`.
7. `node bench/release-report.mjs` writes the summary (`$GITHUB_STEP_SUMMARY` and `summary.md` in the artifact).

Permissions are `contents: read`, the checkout keeps no credentials, and the actions are SHA-pinned (`tests/workflows.test.ts`). A trial run on GitHub's runner from #250 (4 × Intel Xeon Platinum 8573C, Node 24) took 4 min 50 s and gave the same matrix hash for 0.2.29 as the container (`c3d307b09caa2695`): the results do not depend on the machine or the Node version, only the times do.

**Chromium checks** (`bench/browser.mjs`). Headless Chromium from the pinned Playwright, the production build served by `vite preview` (without the `_headers` CSP), every sample in a fresh browser context, median of 3 samples:

| Check                          | Method                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run to verdict                 | `/play/` (Simple mode), preset `elephants-pride` (5 v 30, the mid-size preset; Simple runs 500), 1366×900, no throttling. Time from the click on Run until the result bar is shown with its values (the results skeleton of #251 shows the bar earlier, inside `.is-pending`, and does not count).                                                                 |
| Long tasks from Run            | `PerformanceObserver` (`longtask`, registered before the page's scripts) from the click on Run until 1 s after the verdict, as in [Environment and method](#environment-and-method): count and longest.                                                                                                                                                            |
| CLS on the first result render | Layout-shift entries without recent input in the same window, at 1366×900 and 390×800.                                                                                                                                                                                                                                                                             |
| Startup long tasks             | `/play/`, 412×915, 4x CPU (`Emulation.setCPUThrottlingRate`), long tasks in the first 4 s after navigation: count, total and longest.                                                                                                                                                                                                                              |
| Replay frame time              | Preset `trex-squad-tiger-horde` (110 agents, the largest), 1366×900, no throttling: after the verdict the replay is scrolled into view, rewound (`Home`) and played at 1x and then 16x for 4 s each. p95 of the `requestAnimationFrame` interval while it plays (and the longest). Headless Chromium paces frames at 60 Hz, so 16.7 ms means no frame was dropped. |

Locally, with any Playwright version in a directory of its own:

```bash
npm install --prefix /tmp/pw --no-save playwright@1.64.1 && /tmp/pw/node_modules/.bin/playwright install --only-shell chromium
npm run build && npx vite preview --port 4173 --strictPort &
PLAYWRIGHT_DIR=/tmp/pw node bench/browser.mjs --out /tmp/browser.json
npm run bench -- --repeat 3 --out /tmp/run.json && npm run bench:size -- --json /tmp/size.json
node bench/release-report.mjs --bench /tmp/run.json --size /tmp/size.json --browser /tmp/browser.json
```

`--rows` prints only the two rows. `--commit <sha>` names another commit and `--note <text>` fills the Note column (the workflow's `note` input).

**After the run.** Paste the two rows into the tables below (newest last) and commit them with the run file as `bench/baseline-v<version>.json` in a small `docs(perf)` pull request; it can land before or after the release pull request. A finding (a new long task, a CLS jump, dropped frames, a page over budget) gets its own issue rather than blocking the release, with two exceptions from the [response rules](#response-rules-phase-6): a page over budget, which fails the job and is handled like a failing `perf` gate (fix it, or raise that page's budget with a reason, [Updating budgets](#updating-budgets)), and a preset whose Simple batch takes more than 10 s, which is fixed before the release.

### History

One pair of rows per release, from the [release check](#release-check); the oldest first. Absolute times are only comparable on the same machine (the Machine column); the matrix hash changes exactly when the engine's results change.

Engine and page JavaScript (`npm run bench -- --repeat 3`, `npm run bench:size`):

| Version | Commit    | Date       | Model | Matrix hash        | 1v1 / 10v100 / 50v1000 / 500v5000 (ms/run, median) | Slowest preset (ms/run, median)  | `/play/` JS (gzip) | Machine                                                      | Note                                                                                                         |
| ------- | --------- | ---------- | ----: | ------------------ | -------------------------------------------------- | -------------------------------- | -----------------: | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 0.2.28  | `2b3398c` | 2026-11-18 |     3 | `86bd8311e849d871` | 0.42 / 30.3 / 660 / 6,367                          | `trex-erectus-100` `allIn`, 49.6 |            80.1 KB | 4 × Intel Xeon @ 2.10GHz, Node 22.22.0                       | First baseline, file `bench/baseline-v0.2.27.json` (below); `main` after #240, before the 0.2.28 tag         |
| 0.2.28  | `dae2970` | 2026-11-19 |     3 | `86bd8311e849d871` | 0.39 / 29.4 / 634 / 5,986                          | `trex-erectus-100` `allIn`, 44.8 |            80.2 KB | 4 × Intel Xeon @ 2.10GHz, Node 22.23.5                       | First release check, run locally: 0.2.28 plus #243 (UI) and #247 (dev dependencies), engine unchanged        |
| 0.2.29  | `8ea4b10` | 2026-11-19 |     4 | `c3d307b09caa2695` | 0.40 / 30.5 / 660 / 6,047                          | `trex-erectus-100` `allIn`, 44.8 |            80.2 KB | 4 × Intel Xeon @ 2.10GHz, Node 22.23.5                       | Run locally after the release (the check was not merged yet); model 4 (#237)                                 |
| 0.2.30  | `1220232` | 2026-11-19 |     4 | `c3d307b09caa2695` | 0.32 / 19.8 / 448 / 4,167                          | `trex-erectus-100` `allIn`, 28.6 |            80.4 KB | GitHub `ubuntu-latest`: 4 × Intel Xeon 6975P-C, Node 24.22.2 | First release check on GitHub's runner (run 44457759579); times not comparable with the container rows above |

Chromium (`bench/browser.mjs`, median of 3; long tasks as count / longest, startup as count / total / longest):

| Version | Date       | Run to verdict, `elephants-pride` (ms) | Long tasks from Run | Result CLS, 1366×900 / 390×800 | Startup long tasks, 4x CPU (ms) | Replay frame p95, 1x / 16x (ms) | Browser               | Note                                               |
| ------- | ---------- | -------------------------------------: | ------------------- | ------------------------------ | ------------------------------- | ------------------------------- | --------------------- | -------------------------------------------------- |
| 0.2.28  | 2026-11-19 |                                  4,824 | 1 / 139             | 0.1435 / 0.4000                | 3 / 423 / 246                   | 16.7 / 16.7                     | Chromium 156.0.8078.4 | Same run as the `dae2970` row; CLS below           |
| 0.2.29  | 2026-11-19 |                                  5,230 | 1 / 128             | 0.1435 / 0.4000                | 3 / 432 / 274                   | 16.7 / 16.7                     | Chromium 156.0.8078.4 | Same run as the 0.2.29 engine row                  |
| 0.2.30  | 2026-11-19 |                                  4,255 | 1 / 58              | 0.0071 / 0.0000                | 2 / 237 / 153                   | 16.7 / 16.7                     | Chromium 156.0.8078.4 | Same run as the 0.2.30 engine row, GitHub's runner |

**The first baseline's name.** `bench/baseline-v0.2.27.json` is named after `package.json` at the time it was measured (`--baseline` uses the package version), and an earlier version of this table listed it as 0.2.27. Its commit `2b3398c` is the `main` that release 0.2.28 was cut from: it already holds model 3 (#230), and nothing under `src/sim/` changed between it and the `trex-vs-tiger-sim-v0.2.28` tag. So it measures 0.2.28's engine, which the identical matrix hash of the `dae2970` run confirms. The file keeps its name (baselines are never renamed or overwritten). The release check runs on the release-please branch, where `package.json` already holds the new version, so its files carry the version they measure.

First baseline: measured on a 4 vCPU Intel Xeon @ 2.10 GHz container, Node v22.22.0, three passes. Other slow rows: `trex-squad-tiger-horde` `allIn` 33.4, `elephants-pride` `allIn` 17.8; slowest species row the _Spinosaurus_ mirror at 16.7 ms/run. Page JS: `/en/play/` 78.1 KB, `/r/` 43.4 KB, `/en/r/` 41.4 KB, `/reset/` 3.0 KB, every content page 1.5 KB.

First release check (`dae2970`): the same container and engine a day later, other sessions idle; the median ratio to the first baseline over the 72 scenarios is 0.95 (67 faster, 5 slower; range 0.80 for `trex-mirror` `realistic` to 1.09 for `lions-hyenas` `allIn`). Same results, so this is the spread to expect between two full runs on this machine, not a change. `/play/` JS grew by 0.1 KB with #243.

0.2.29 (model 4, #237): the results changed in 14 of the 72 scenarios (a new matrix hash), the cost did not: the median ratio to the 0.2.28 run is 1.00 (0.89 for `lions-hyenas` `allIn` to 1.10 for `mammoth-wolves` `realistic`), within the spread above. The run files of both checks are `bench/baseline-v0.2.28.json` and `bench/baseline-v0.2.29.json`; `bench/budgets.json` still holds the first baseline's ceilings.

0.2.30 (#251, #254, #256): the first release check run on GitHub's runner, as `CONTRIBUTING.md` describes it (`workflow_dispatch` on the release-please branch, run 44457759579, head `65e8d77`; the row names its parent `1220232`, the `main` the release was cut from). The run file is `bench/baseline-v0.2.30.json`, taken unchanged from the artifact `release-perf-0.2.30`. The matrix hash is still `c3d307b09caa2695` and all 72 scenario hashes equal 0.2.29's, so #256 changed no result. The times are about a third lower than 0.2.29's (median ratio 0.68, from 0.60 for `mammoth-wolves` `realistic` to 0.81 for `tiger-bear` `realistic`, none slower), but most of that is the machine: another CPU and Node 24 instead of the 4 vCPU container and Node 22, so the ratio does not measure #256 (its own gain, on one machine, is in [Escape heading trig cache](#escape-heading-trig-cache-256)). Every page is within its JavaScript budget; `/play/` grew from 80.2 to 80.4 KB. In Chromium the result CLS is 0.0071 / 0 after #251 (was 0.14 / 0.40), with one long task from Run (58 ms). The release commit also carries the patch notes of #258, which landed on `main` after `1220232`; they change no `/play/` JavaScript.

**#254 (after 0.2.29).** `trex-erectus-100` runs 300 times in Simple mode instead of 500, under the [response rules](#response-rules-phase-6). The engine is unchanged, so the matrix hash and `bench/budgets.json` are unchanged too (the matrix runs its own counts, 20 runs for this preset). The next release's Chromium row still times `elephants-pride`; [Fewer Simple runs for `trex-erectus-100`](#fewer-simple-runs-for-trex-erectus-100-254) has this preset's numbers.

**#256 (after 0.2.29).** `steer` reuses `cos`/`sin` of an unchanged heading ([Escape heading trig cache](#escape-heading-trig-cache-256)). The results are bit-identical, so the matrix hash stays `c3d307b09caa2695`. `bench/budgets.json` is unchanged: the gain (2–6 % on most scenarios, at most about 13 %) is far inside the 1.3 margin, and the ceilings are reset from a release baseline, not from a single change ([Updating budgets](#updating-budgets)).

**Chromium findings of the first release check.**

- _Result CLS 0.14 / 0.40._ Both are one shift of the site footer: the Simple results panel does not reserve its final height, so when the verdict renders the panel grows by about 1,660 px (390×800) and pushes the footer, which was in view, off the screen. #24 measured 0 / 0.0002 for the classic results panel, which reserves its size on the first Run; Simple mode (#146) came later. Every sample gave the same value. Fixed in #251: 0 / 0 ([Layout shift when Simple results render](#layout-shift-when-simple-results-render-251)).
- _Long tasks from Run._ 0–2 per sample (longest 139–251 ms), after the batch, while the result and the replay chunk render.
- _Replay._ The replay of `trex-squad-tiger-horde` holds 60 frames per second at 1x and 16x (p95 16.7 ms, longest 16.8 ms), and also at 4x CPU throttling (one frame of 33 ms in two samples). The metric does see slow frames: at 20x throttling the p95 was 50 ms at 1x and 83 ms at 16x.

### Response rules (phase 6)

In force since #251. The checks above only help if a red result leads somewhere, so:

- **Over budget: fix or justify in the pull request.** A failing `perf` job (a scenario more than 25% slower, a page over its JavaScript budget) is fixed in the same pull request, or the pull request raises the affected budgets in `bench/budgets.json` ([Updating budgets](#updating-budgets)) and its description and the History notes say why. No silent budget bumps: a change to `bench/budgets.json` without that reason is not merged.
- **A Simple batch over 10 s is fixed before release.** A preset whose Simple batch (click on Run to the verdict in Simple mode, the preset's Simple run count) takes more than 10 s on the reference machine, the 4 vCPU container of [Environment and method](#environment-and-method), gets a lower run count or an optimisation before the next release. The release check times `elephants-pride` in the browser. For the other presets the matrix gives a quick screen: the `allIn` row's ms/run × the Simple run count ÷ 3 workers. The browser takes about 1.8 times that screen (`elephants-pride`: 2.8 s screened, 5.0 s measured), so a preset screened above 5 s is timed in the browser before the release, Run to verdict as in the table above.

First application (2026-11-19, 0.2.29 matrix, then the browser on the reference machine, median of 3, 1366×900): every preset runs 500 in Simple mode.

| Preset                   |  Screen (s) | Run to verdict in the browser (s) | Rule            |
| ------------------------ | ----------: | --------------------------------: | --------------- |
| `trex-erectus-100`       |         7.5 |                              10.7 | **over 10 s**   |
| `trex-squad-tiger-horde` |         5.0 |                               7.4 | within          |
| `elephants-pride`        |         2.8 |                               5.0 | within          |
| `raptors-trex`           |         2.4 |                               4.6 | within          |
| The other 14 presets     | 1.2 or less |                         not timed | within (screen) |

`trex-erectus-100` (1 _T. rex_ v 100 _H. erectus_, 44.8 ms/run) is over the limit, so under this rule it needs fewer Simple runs or a faster engine before the next release. That change touches the preset registry and its documented shares (`docs/PRESETS.md`), so it was tracked as its own issue rather than made here: #254 lowered its Simple run count to 300, 7.4 s to the verdict ([Fewer Simple runs for `trex-erectus-100`](#fewer-simple-runs-for-trex-erectus-100-254)). Screen at 300 runs: 4.5 s.

To time a preset other than `elephants-pride` in the browser, pass `--run-preset <id>` to `bench/browser.mjs` (the other checks run as usual; the report's `run` and `cls` blocks then name that preset).

## Live benchmark (#191)

The CI runner and the agent containers have no GPU, no OBS and other CPUs, so they can only give a baseline. M3 accepts live cards only on numbers from the reference streamer PC (RENEWAL-1.0 [§10.2 point 5](design/RENEWAL-1.0.md#102-live-step-fork-and-re-simulate-10), [§10.5](design/RENEWAL-1.0.md#105-performance-budgets)): re-simulation p95 ≤ 500 ms for every preset that passes gate (a). The hidden page `/bench/` measures that on any device in a few clicks, and since it also folds in phase 5 of #241 it runs the reduced matrix of `npm run bench` as well, so a device can be put next to the History table.

### How to run the live benchmark

> **한국어**
>
> 1. 방송용 PC(또는 비교할 휴대폰)에서 크롬 계열 브라우저로 `https://trex-vs-tiger.vinylims.com/bench/`를 엽니다. 메뉴 어디에도 링크가 없으니 주소를 직접 입력하세요.
> 2. 다른 앱과 탭을 닫고, 노트북이면 전원을 연결합니다.
> 3. OBS를 켠 상태와 비교하려면 **OBS를 켜고 한 번 더**에 체크합니다. 이때 OBS는 아직 끈 상태로 둡니다.
> 4. **시작**을 누릅니다. 모든 프리셋(준비, 라이브 실행, 재시뮬레이션 8번, Simple 배치)과 시나리오 행렬이 차례로 돌아가며, 4코어 컨테이너 기준 1분 정도 걸립니다. 그동안 페이지를 앞에 두고 다른 작업은 하지 마세요.
> 5. OBS 비교를 골랐다면 안내가 나왔을 때 OBS를 평소 방송 설정으로 켜고 녹화나 송출을 시작한 다음 **OBS 측정 시작**을 누릅니다.
> 6. **JSON 복사**를 눌러 #191(또는 지정된 이슈)에 붙여 넣습니다. 아래 줄은 [Real devices](#real-devices) 표에 그대로 넣을 수 있습니다.
>
> 페이지는 아무것도 보내지 않습니다. 결과는 화면과 복사한 JSON에만 있습니다.

**English**

1. On the streaming PC (or the phone to compare), open `https://trex-vs-tiger.vinylims.com/bench/` in a Chromium-based browser. Nothing links to it; type the address.
2. Close other apps and tabs; plug a laptop in.
3. To compare with OBS running, tick **Second pass with OBS running**, and leave OBS closed for now.
4. Press **Start**. Every preset (warm-up, live run, 8 re-simulations, Simple batch) and then the scenario matrix run in turn; about a minute on the 4-core container. Keep the page in front and the machine otherwise idle.
5. If you chose the OBS pass: when asked, start OBS with the usual stream settings, start recording or streaming, then press **Run the OBS pass**.
6. Press **Copy JSON** and paste it into #191 (or the issue that asked for it). The line under it goes into the [Real devices](#real-devices) table as it is.

The page sends nothing: the results exist only on the screen and in the JSON you copy.

### What the page measures

Every number comes from the production build under the production CSP and Trusted Types, as served: the page loads its worker through the one allowed policy, `sim-worker`, which admits only that worker's bundled URL, as on `/play/`.

| Step           | Method                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device         | `navigator.hardwareConcurrency`, `navigator.deviceMemory` (Chromium only, rounded by the browser), the user agent, the build version and model. Batch workers = `poolSize(cores)`, the app's own count (cores − 1, at most 8).                                                                                                                                                                                                                |
| Warm-up        | Every worker runs the first small scenarios of the matrix untimed (`warmUpSet`, as `npm run bench`), and each preset's live run is played once untimed before it is timed.                                                                                                                                                                                                                                                                    |
| Live run       | The preset's run 0 at the matrix seed (20261118), simulated with its trace in one worker and timed there, as the live worker times `replay-free` (`liveSimMs`, without the message transfer).                                                                                                                                                                                                                                                 |
| Re-simulations | K = 8 runs of the same battle with one card, _Focus_ on side A (available in every model, needs neither morale nor the what-if pack), at 8 ticks spread evenly over the pause window of Live battle mode (25–60 % of the live run's duration, turned into ticks with `cardTick`). p50 and p95 over the 8.                                                                                                                                     |
| Gate verdict   | Gate (a) as `resimGate` decides it: `liveSimMs × 1.5 ≤ 500 ms`. For a preset that passes, the M3 budget: re-simulation p95 ≤ 500 ms. A preset that fails the gate falls back to pre-battle cards, so the budget does not apply to it. A pass is accepted when no passing preset is over the budget.                                                                                                                                           |
| Simple batch   | The preset's Simple run count (`presetConfig`, 300 for `trex-erectus-100`, 500 for the rest) split into the app's chunks (`splitRuns`) over the batch workers. Batch ms/run = median of the per-run times on one worker (gate (b)'s `msPerRun`); wall = first chunk sent to last result back.                                                                                                                                                 |
| OBS pass       | Optional: the same presets again with OBS running. `c_obs` (§10.7) = OBS ÷ plain batch ms/run per preset; the report gives the median.                                                                                                                                                                                                                                                                                                        |
| Matrix         | The reduced matrix of `bench/scenarios.json` (`expandMatrix(…, { reduced: true })`, 53 scenarios at half the run counts, each repeated until 250 ms is timed) on one worker, with the timing loop of `bench/matrix.mjs`. Hashes are SHA-256 of the packed summaries through `crypto.subtle`, so the matrix hash must equal the one `npm run bench -- --reduced` prints for the same engine: if it differs, the device computed other results. |

Not measured here: the replay's frame time and the time from Run to the rendered verdict, which need the real `/play/` page; `bench/browser.mjs` measures them in the release check. The batch wall time of `elephants-pride` is the closest number to the release check's Run to verdict (no rendering, no aggregation).

The page is `noindex, nofollow` and served with `X-Robots-Tag: noindex` (`public/_headers`), is not in `src/seo/site.ts`, so it stays out of the sitemap and `llms.txt`, has no header, footer or link from any page, and has no network code at all (`connect-src 'self'` would also block it). `tests/bench-kit.test.ts` checks all of that, plus the statistics, the gate verdict, the card ticks, the OBS factor and the Real devices row. Its startup JavaScript is budgeted like every page (`bench/index.html`, 27.3 KB, budget 30.1 KB); the worker (67.5 KB) is loaded on Start.

### Real devices

One row per device and run; the page prints it under the JSON. Ladder and slowest preset from the reduced matrix (ms/run, median; 500v5000 is not in it); worst re-sim p95 among the presets that pass gate (a); `elephants-pride` batch = its Simple batch wall time (ms); OBS = `c_obs` of the OBS pass.

| Version | Date       | Device                              | Workers | 1v1 / 10v100 / 50v1000 (ms/run) | Slowest preset (ms/run)  | Worst re-sim p95, gate passing (ms) | Gate (a) passes | `elephants-pride` batch (ms) | OBS  | Reduced hash       | Note                                                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------------------------- | ------: | ------------------------------- | ------------------------ | ----------------------------------- | --------------- | ---------------------------: | ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.2.30  | 2026-11-19 | 4 cores, 16 GB, Chrome 157 on Linux |       3 | 0.40 / 25.2 / 538               | `trex-erectus-100`, 32.8 | 59.4 (`trex-erectus-100`)           | 18 / 18         |                        3,636 | 1.00 | `f3afd0125da00e3e` | **Container baseline, not the reference.** 4 vCPU Intel Xeon @ 2.10 GHz agent container, headless Chromium (preinstalled Playwright), production build with the production CSP; the OBS pass ran without OBS, so 1.00 only shows the pass-to-pass noise |

Container baseline (2026-11-19, the row above): every preset passes gate (a); the most expensive live run is `trex-erectus-100` at 53.3 ms (gate limit 333 ms) and the worst re-simulation p95 59.4 ms, far inside 500 ms. The longest Simple batch is `trex-squad-tiger-horde` at 6.7 s wall. The plain pass took 51 s with the matrix (18 s of it), the OBS pass 28 s. The reduced hash `f3afd0125da00e3e` equals the one `npm run bench -- --reduced` gives on the same commit in Node, scenario for scenario, and the browser's ms/run were 0.92 times Node's (median over the 53 scenarios, 0.79–1.48).

**Cadence** (phase 5 of #241): once per minor version, and whenever the `perf` gate flags an engine slowdown above 25 %, on the owner's streaming PC (with and without OBS) and one mid-range phone. The owner's rows are the reference for M3 and for the 10 s rule of the [response rules](#response-rules-phase-6).

## Layout shift when Simple results render (#251)

> **한국어 요약**
>
> - Simple 모드에서 첫 실행 결과가 그려질 때 결과 패널이 약 1,660 px 늘어나며 보이던 푸터를 화면 밖으로 밀어내, CLS가 0.1399(1366×900) / 0.4000(390×800)이었습니다.
> - #24의 고전 결과 골격과 같은 방식으로, 첫 실행을 누르는 순간 Simple 결과 골격을 보여 줍니다. 막대 라벨의 팀 이름, 각 진영 카드의 항목 이름, 판정 자리의 "계산하는 중" 문장은 그대로 보이고, 숫자 자리는 같은 길이의 자리표시 문자열을 `visibility: hidden`으로 숨깁니다. 끝나면 실제 값으로 바뀌므로 아래 내용이 움직이지 않습니다.
> - 결과: 0 / 0. 패주 안내 줄은 결과가 나와야 알 수 있어서, 무리가 사기를 공유하는 진영이 있을 때만 그 자리를 잡아 둡니다. 그래서 그런 진영이 있는데 안내가 나오지 않는 프리셋(`pride-five-tigers`, `buffalo-pride`, `raptors-trex`)에는 작은 이동이 남습니다(약 0.011 / 0.043, `pride-five-tigers`는 고치기 전 0.135 / 0.401).

The release check of #241 found that the first Simple result moved the page: CLS 0.1435 / 0.4000 on 0.2.28 and 0.2.29. The Simple results panel showed only its one-line empty note until the verdict, then grew by about 1,660 px at once, and the site footer, which was in view, was pushed off the screen. The classic panel has reserved its final size on the first Run since #24 (results skeleton, [Summary](#summary)); Simple mode (#146) came later without one.

**Change.** On the first Simple Run, `free-mode.ts` sets `pending` to the run's config and shows the results body with the class `is-pending`, within the click's input window, so the skeleton's own appearance is not counted as a shift. The skeleton has the final blocks:

- the win share bar (`SimpleView.renderPending` in `simple-mode.ts`): the two team labels as they will read, the shares as `00%`, an empty track;
- the verdict line `Computing. The results will appear here.` and the precision line with `00%` bounds (as in the classic skeleton, `.verdict` already reserves two lines, three on phones);
- the rout notice, when a side shares morale (`routNoticePossible` in `src/sim/free/aggregate.ts`, the precondition of `routNotice`): the notice for side B with `00%`;
- the per-side breakdown with the real headings and labels, each value as the side's count and `00%`, the end-reason line with one reason at `00%`, the "Run again" button (disabled);
- the share buttons.

Placeholder values and the reserved rout notice and share buttons have `visibility: hidden` (`.is-pending .simple-value`, `.is-pending .free-rout-notice`, `.is-pending .result-share` in `simple-mode.css`): they keep their box, are not read out and cannot be focused. Everything with real content (team names, labels, headings, the "Computing" line, the caveat) stays visible and in the accessibility tree. On phones the bar labels reserve two lines (`min-height` in `@media (max-width: 560px)`), because the shares of a finished run (`> 99%`) are wider than the placeholder and wrap the labels there. A cancelled or failed first run goes back to the empty state. No inline styles: the classes come from the stylesheet, so the `style-src 'self'` CSP and Trusted Types are untouched. `bench/browser.mjs` now waits for the bar outside `.is-pending`, so Run to verdict still means the values.

**Measured** with `bench/browser.mjs` (median of 3, Chromium 157.0.8103.78, Playwright 1.63.0, production build on `vite preview`, the 4 vCPU container), preset `elephants-pride`:

| Viewport | Before (`17c781c`) |  After |
| -------- | -----------------: | -----: |
| 1366×900 |             0.1399 | 0.0000 |
| 390×800  |             0.4000 | 0.0000 |

Every sample gave the same value on each side. The release rows above (0.1435 on 0.2.28 and 0.2.29) came from Chromium 156; 0.1399 is the same single footer shift measured with Chromium 157. The rest of that run was unchanged: Run to verdict 4,959 ms (5,217 before), startup long tasks 2 / 374 / 229 ms (3 / 372 / 243), replay p95 16.8 / 16.7 ms (16.7 / 16.7).

Other presets, one sample each with the same probe (`/play/`, Korean): `lion-tiger`, `trex-squad-tiger-horde` and `lions-hyenas` 0 / 0. `pride-five-tigers` 0.0110 / 0.0428 (before: 0.1348 / 0.4012): the lions share morale, so the skeleton holds the rout notice's line, but the tigers lose and they share none, so no notice appears and the line closes. `buffalo-pride` (0.0110 / 0.0428) and `raptors-trex` (0.0110 / 0.0429) do the same: a group on one side, no notice in the result. A survey of all 18 presets (two seeds each, Node) found these three as the only ones where the reserved line closes. `/en/play/` with `elephants-pride`: 0.0023 / 0: the English replay run line wraps to a second line on desktop after the replay loads, below a `.replay-info` that reserves one line there.

## Fewer Simple runs for `trex-erectus-100` (#254)

The [response rules](#response-rules-phase-6) found one preset over 10 s: `trex-erectus-100`, 1 _T. rex_ v 100 _H. erectus_. Since model 3 (#230) a battle lasts until the routed humans have run off the field, so a run costs about 45 ms on one core (44.8 ms/run in the 0.2.29 matrix) and the 500-run Simple batch about 22 core-seconds.

**Change.** The preset sets `runs: 300` in `src/sim/free/presets.ts`, the optional per-preset run count the registry has had from the start (`FreePreset.runs`, read by `simpleRuns` in `src/ui/simple-model.ts`); no other preset sets one, and #240 recorded that none needed one under model 3. 300 is the count the issue proposed: the batch scales with the run count, so 300 should take about 60 % of the 500-run time, leaving about 2.5 s of margin under 10 s on the reference machine. The engine and its results are unchanged, the preset checks and fixtures measure 200 runs whatever a preset sets, and the verdict stays _T. rex_ 100 % ([PRESETS.md](PRESETS.md#simple-run-counts)). The 95 % precision of a share goes from ±4.4 pp to ±5.7 pp at worst (a share near 50 %); at the measured 100 % the Wilson interval is 98.7–100 % (500 runs: 99.2–100 %).

**Measured** with `bench/browser.mjs --run-preset trex-erectus-100` (median of 3, Chromium 157.0.8103.78, Playwright 1.63.0, production build on `vite preview`, the 4 vCPU container, 1366×900), Run to verdict:

| Run count    | Samples (ms)             | Median (ms) |
| ------------ | ------------------------ | ----------: |
| 500 (`main`) | 10,151 / 11,729 / 11,529 |      11,529 |
| 300 (#254)   | 7,078 / 7,404 / 7,730    |       7,404 |

500 runs measured 10.7 s in the first application above and 11.5 s here, on the same container a few hours apart; 300 runs take 64 % of the 500-run time here. No long task from Run in either, result CLS 0 / 0.

**A Simple link written before #254.** A link records its run count, so a Simple link of this preset at 500 runs now has a hidden edit and opens the free form of Advanced mode, where it reproduces its 500-run result ([SHARING.md](SHARING.md), `simpleCanShow`). Tested in `tests/simple-mode.test.ts`.

**Profile** (Node 22 `--cpu-prof`, 60 runs at seed 20261019, about 1,440 ticks and 45 µs per tick per run; the bundle of `bench/lib.mjs`). The cost is spread out: the inlined tick loop of `simulateFreeBattle` 34 % self; the deterministic trigonometry of #197 (`dsin`, `dcos`, `datan2` and their kernels) about 20 %; `steer` 13 % including its trigonometry; the two spatial grid rebuilds per tick 7 %; garbage collection 5 %; morale contagion, cohesion and nearest-enemy queries 2–3 % each. One cheap candidate, not made here: from model 3 a routed agent keeps one escape heading until it leaves (#230), so `steer` recomputes `cos` and `sin` of the same heading every tick. Caching them per agent while the heading is unchanged gave 4–11 % less time per run on this preset in a trial, with the same packed run summaries for every preset in that trial (10 runs each, 60 for this one; the same inputs give the same deterministic outputs); it is not enough on its own to bring 500 runs under 10 s. Made in #256 ([Escape heading trig cache](#escape-heading-trig-cache-256)).

## Escape heading trig cache (#256)

The [#254 profile](#fewer-simple-runs-for-trex-erectus-100-254) of `trex-erectus-100` put the deterministic trigonometry of #197 at about 20 % of the time and `steer` at 13 %. From model 3 a routed agent keeps the heading of its first flight tick until it is across the edge (`escapeH`, #230), yet `steer` computed `cos` and `sin` of its new heading on every tick.

**Change.** `simulateFreeBattle` keeps three more per-agent arrays next to `escapeH`: `stepH`, the heading `steer` last moved the agent along (NaN at spawn), and `stepCos` / `stepSin`, its cosine and sine. `steer` computes `head` as before; when `head` is bit for bit the cached heading it reuses the two values, otherwise it computes them with the same `cos` / `sin` as before (the deterministic ones of `detmath.ts` from model 2, `Math` for model 1) and stores them. The cache is keyed on the heading value itself rather than on the state, so it is invalidated by anything that changes the heading: a turn, a throw, a latch, an intervention, another state. NaN never compares equal, so a fresh agent always misses. A zero heading is never served from the cache, because `===` does not tell `0` from `−0` and their sines differ in sign. `cos` and `sin` are pure functions of their argument, so a reused value is exactly the one a recomputation would return: this is not a model change and needs no new model version. The classic engine is untouched.

In the matrix, the routed agents' calls are 2–59 % of `steer`'s moving calls per preset (58–59 % for `trex-erectus-100`), and 19–59 % of all moving calls hit the cache: an agent that is not routed also hits it when its heading did not move (a turn-limited agent already aligned, a straight approach).

**Bit-identity.** On the head:

- `npm run check`: every golden fixture matches (free models 1–4 including the social and intervention goldens, classic models 1–3 and the v1/v2 link goldens, the preset shares); no fixture was touched.
- `npm run test:jsc` (Bun 1.4.4, JavaScriptCore): model 2, model 3 and free model 4 goldens match.
- `npm run bench`, full matrix: results hash `c3d307b09caa2695` on `main` (`be0198c`) and on the head, every one of the 72 scenario hashes equal; the same hash as the 0.2.29 History row.
- `bench/compare.mjs`: `same` results for all 53 scenarios of the reduced matrix, twice.

**Measured** on the 4 vCPU container of [Environment and method](#environment-and-method) (Node 22.23.5), `main` (`be0198c`) against the head.

The CI gate, `node bench/compare.mjs --base <main worktree> --dist dist`, twice (reduced matrix, `allIn`, five alternating rounds; ratio is head ÷ base, median over rounds):

| Scenario                        | Run 1 | Run 2 |
| ------------------------------- | ----: | ----: |
| `preset-trex-erectus-100-allIn` | 0.91x | 0.96x |
| `preset-elephants-pride-allIn`  | 0.93x | 0.96x |
| `preset-raptors-trex-allIn`     | 0.97x | 0.98x |
| `species-raptor-mirror`         | 0.84x | 0.95x |
| Median over 53 scenarios        | 0.98x | 0.98x |
| Highest                         | 1.04x | 1.06x |

The highest ratios (`scale-50v1000` 1.04x, `preset-bear-wolf-pack-allIn` 1.06x) are each 1.00 or below in the other run: the spread of [the gate's calibration](#pr-gate) (0.94–1.11 with identical engines). Page JavaScript is unchanged (`/play/` 80.4 KB, `/en/play/` 78.4 KB).

Every preset in both flight modes, base and head bundled into one process with the harness of `bench/lib.mjs` and alternated as in the gate, seven rounds, each batch repeated to at least 400 ms (the matrix's run counts: 20 runs for the presets above 30 agents, 60 for the others). The flight-heavy presets, where routed agents make 45 % or more of `steer`'s moving calls:

| Preset, flight                       | Routed share | `main` (ms/run) | Head (ms/run) | Head / `main` |
| ------------------------------------ | -----------: | --------------: | ------------: | ------------: |
| `trex-erectus-100` `allIn`           |         58 % |           45.72 |         42.78 |         0.944 |
| `trex-erectus-100` `realistic`       |         59 % |           41.20 |         39.72 |         0.943 |
| `raptors-trex` `realistic`           |         54 % |            9.68 |          9.18 |         0.940 |
| `trex-squad-tiger-horde` `realistic` |         53 % |           19.19 |         18.67 |         0.972 |
| `elephants-pride` `realistic`        |         45 % |           13.89 |         13.55 |         0.973 |
| `pride-five-tigers` `realistic`      |         45 % |            3.17 |          2.97 |         0.946 |
| `pride-five-tigers` `allIn`          |         45 % |            3.06 |          3.00 |         0.978 |

Over all 36 preset rows the median is 0.98; 33 are at or below 1.00, and the three above (`lion-tiger` `allIn` 1.006, `trex-mirror` `allIn` 1.008, `tiger-bear` `allIn` 1.054) are sub-2 ms duels, inside the 1.8x noise of the cheapest rows ([The matrix](#the-matrix)). The largest gain, `bear-wolf-pack` `realistic` 0.875, is a 6 ms preset with 22 % routed calls, so part of it is noise too. The trial in #254 had 4–11 % on `trex-erectus-100`; here it is 6 % in this measurement and 4–9 % in the gate. With 300 Simple runs (#254) that preset's screen goes from 4.5 s to about 4.3 s.

## Not changed

- No `SharedArrayBuffer`: it needs cross-origin isolation, which conflicts with third-party ad iframes ([research §3](research/PERFORMANCE.md)). Transfers are already zero-copy.
- The cost estimator recalibration, a static HTML shell for the simulator, build-time font subsetting and in-place label updates on a language switch (research recommendations 11, 6, 7 and 2) are open.
