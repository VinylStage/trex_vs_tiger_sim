# Simple-mode presets

> **한국어 요약**
>
> - 쉬운 모드에서 고를 대진 프리셋을 `src/sim/free/presets.ts`에 모았습니다. 설계 문서 [RENEWAL-1.0.md §6](design/RENEWAL-1.0.md#6-simple-mode-preset-list)의 목록 가운데 두 종이 모두 지금 있는 18개만 넣었고(북극곰 vs 불곰은 #184, 코끼리 vs 하마는 #186, 랩터 무리 vs 티라노는 #188, 코끼리 vs 코뿔소와 하마 vs 코뿔소는 #187, 티라노 vs 스피노(육상 대결)는 #185, 티라노 vs 트리케라톱스는 #189에서 추가), 나머지 5개는 종이 추가될 때 들어옵니다(아래 [대기 중인 프리셋](#presets-waiting-for-a-species)).
> - 프리셋마다 자유 대결 엔진으로 같은 시드(20261019)와 같은 실행 수(200회)로 승률, 전투 시간 중앙값, 진 쪽의 이탈 비율을 재서 `tests/fixtures/preset-shares.json`에 기록합니다. 테스트가 매번 다시 계산해 기록과 비트 단위로 같은지 확인하므로, 모델이 바뀌면 이 파일의 차이로 드러납니다.
> - 이탈 점검: 전투 시간 중앙값이 30초 미만이거나 진 쪽의 이탈 비율이 90%를 넘으면 실패입니다(모두 **S**). 문서로 남긴 예외(override)가 있으면 통과합니다. 예외도 받지 못한 프리셋은 보류(hold)되어 쉬운 모드에 나오지 않습니다.
> - 모델 3(#230)에서는 도주한 쪽이 경기장 밖으로 빠져나갈 때까지 전투가 이어집니다. 승률은 모델 2와 거의 같고, 1:1 대결 다섯과 불곰 vs 늑대 무리, 그리고 보류였던 세 프리셋(사자 무리 vs 호랑이 다섯, 티라노 vs 호모 에렉투스 100, 사자 vs 하이에나)이 이탈 예외로 쉬운 모드에 나옵니다. 보류 해제는 소유자가 정했습니다(2026-11-18). 모델 3의 기준 파일은 `tests/fixtures/preset-shares-mv3.json`입니다.
> - 모델 4(#237)는 물러나는 상대에게 매달리려는 동물이 그 한 걸음을 따라잡게 합니다. 프리셋 승률은 200회 기준 최대 2회 차이로 그대로이고, 예외와 보류도 바뀌지 않았습니다. 지금 점검하는 기준 파일은 `tests/fixtures/preset-shares-mv4.json`입니다.
> - 프리셋 이름, "왜?" 문구, 예외와 보류 사유는 금지어 테스트를 거칩니다. 잔혹하거나 죽음을 뜻하는 말, 베팅 용어, 작품·상표·방송 플랫폼 이름, 조회수를 쓰지 않습니다.

Source of truth: `src/sim/free/presets.ts`, `tests/presets.test.ts` and `tests/fixtures/preset-shares.json`. The design is [RENEWAL-1.0.md §3.2 and §6](design/RENEWAL-1.0.md#32-simple-mode-and-advanced-mode), with owner decision R4 (b): keep the model for 1.0 and contain the mass-rout cascade.

## Contents

- [Registry](#registry)
- [Measurement](#measurement)
- [Checks](#checks)
- [Fixture](#fixture)
- [Overrides and holds](#overrides-and-holds)
- [Presets waiting for a species](#presets-waiting-for-a-species)
- [Banned words](#banned-words)
- [Updating the fixture](#updating-the-fixture)

## Registry

`FREE_PRESETS` lists every preset of design §6 whose two species exist in `FREE_SPECIES_IDS`. Each entry has:

| Field   | Meaning                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`    | Stable and append-only: links and share images may name it.                                                                 |
| `name`  | ko and en, common nouns only (design §1.2).                                                                                 |
| `a`/`b` | Species and head count per side.                                                                                            |
| `runs`  | Optional run count. No preset sets one, so Simple mode runs the default 500, which every preset fits in the work budget.    |
| `tags`  | `popular`, `documented`, `close`, `mirror`, `army`, `absurd`, `thought-experiment`, and the §6 tags `ice-age` and `rivals`. |
| `why`   | The "왜? / Why?" text: the literature or a described source, never a title or a view count.                                 |
| `check` | Optional documented override of the check limits, with a reason.                                                            |
| `hold`  | Optional reason the preset stays out of Simple mode.                                                                        |

`presetConfig(preset, seed?)` builds the `FreeConfig` through `sanitizeFreeConfig`; `readyPresets()` returns the presets that are not on hold. Nothing in the registry runs the engine.

## Measurement

Each preset runs on the free engine at the default seed 20261019 with **200 runs**. The default 500 runs would make the check take about 75 s on one core instead of about 30 s; 200 runs gives the same pass or fail for every preset as 500 did when this was written.

| Value           | Definition                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Win share       | Runs won by side A, by side B and drawn, each ÷ runs (`aggregateFree`).                                                                                                                      |
| Median duration | p50 of the run durations in seconds (`aggregateFree`).                                                                                                                                       |
| Rout share      | Over the decided runs, the losing side's fled agents ÷ its fled + incapacitated agents, pooled (`routShare` in `src/sim/free/aggregate.ts`). NaN, stored as `null`, when no run was decided. |

The loser of a decided run has no active agent left, so its fled + incapacitated equals its count.

## Checks

`presetProblems(preset, measurement)` returns every check a preset fails. All limits are **S**.

| Check          | Fails when                                                                      | Limit (`PRESET_LIMITS`) |
| -------------- | ------------------------------------------------------------------------------- | ----------------------- |
| `short`        | The median duration is under the limit                                          | 30 s                    |
| `rout`         | The rout share is over the limit                                                | 90 %                    |
| `social-count` | A social side (lion, wolf, spotted hyena, _H. erectus_) has more than the limit | 100                     |
| `close-tag`    | The `close` tag disagrees with the measurement                                  | 35–65 % for both sides  |

The `close` tag is never chosen by hand: for every preset, held or not, the test fails until the tag matches the fixture. A `check` override may only loosen `short` and `rout`. The test asserts that every preset without a hold passes, and that every held preset still fails the rout check (`short` or `rout`, the reason its hold names), so a preset that starts passing after a model change is noticed and released.

## Fixture

There is one fixture per free model version (`mv`, ADR-0008): `tests/fixtures/preset-shares.json` for model 1, `tests/fixtures/preset-shares-mv2.json` for model 2 (#169, #197) `tests/fixtures/preset-shares-mv3.json` for model 3 (#230) and `tests/fixtures/preset-shares-mv4.json` for model 4 (#237). Every preset must reproduce the row of every model a link can name; only the newest model, which Simple mode runs, must pass the checks above. An older model's fixture is never rewritten.

### Model 4 (the checked fixture)

Measured on `fix/237-free-retreat-step` (free model 4, #237) in the default flight mode `allIn`. The only change from model 3 is the retreat step: an animal that wants to latch now closes the step its target takes while backing off in Recover ([MODEL.md §3.10](MODEL.md#310-retreat-step-free-model-4)). `tests/fixtures/preset-shares-mv4.json` is authoritative.

| Preset (`id`)            | Sides                         | A wins | B wins | Draws |  Median | Rout share | Close | Status                   |
| ------------------------ | ----------------------------- | -----: | -----: | ----: | ------: | ---------: | ----- | ------------------------ |
| `lion-tiger`             | lion 1 v tiger 1              | 59.0 % | 41.0 % |   0 % |  50.8 s |      100 % | yes   | override                 |
| `pride-five-tigers`      | lion 5 v tiger 5              | 63.0 % | 37.0 % |   0 % |  62.6 s |      100 % | yes   | override (released hold) |
| `tiger-bear`             | tiger 1 v brown bear 1        | 19.5 % | 80.5 % |   0 % |  62.9 s |      100 % | no    | override                 |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         | 69.0 % | 31.0 % |   0 % | 101.6 s |     96.1 % | no    | override                 |
| `buffalo-pride`          | buffalo 1 v lion 6            | 12.0 % | 88.0 % |   0 % | 153.6 s |     63.7 % | no    | passes                   |
| `elephants-pride`        | elephant 5 v lion 30          |  100 % |    0 % |   0 % | 115.4 s |     87.0 % | no    | passes                   |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |  100 % |    0 % |   0 % | 118.2 s |     89.8 % | no    | passes                   |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       | 51.0 % | 49.0 % |   0 % | 155.1 s |     64.0 % | yes   | passes                   |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |  100 % |    0 % |   0 % | 143.0 s |      2.2 % | no    | passes                   |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  100 % |    0 % |   0 % | 142.8 s |     94.6 % | no    | override (released hold) |
| `lions-hyenas`           | lion 3 v spotted hyena 10     | 38.0 % | 62.0 % |   0 % |  67.1 s |     97.5 % | yes   | override (released hold) |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   | 72.0 % | 28.0 % |   0 % | 103.8 s |     95.0 % | no    | override                 |
| `elephant-hippo`         | elephant 1 v hippo 1          | 81.5 % | 18.5 % |   0 % | 233.3 s |     89.5 % | no    | passes                   |
| `raptors-trex`           | _Utahraptor_ 12 v _T. rex_ 1  | 13.0 % | 87.0 % |   0 % | 269.3 s |     70.1 % | no    | passes                   |
| `elephant-rhino`         | elephant 1 v white rhino 1    | 73.5 % | 26.5 % |   0 % | 210.9 s |     95.5 % | no    | override                 |
| `hippo-rhino`            | hippo 1 v white rhino 1       | 41.5 % | 58.5 % |   0 % | 177.4 s |     94.5 % | yes   | override                 |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  | 96.5 % |  3.5 % |   0 % | 198.9 s |     50.5 % | no    | passes                   |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  | 62.0 % | 38.0 % |   0 % | 157.2 s |     73.0 % | yes   | passes                   |

What changed against model 3 (below): seven presets differ by at most two of 200 runs (`bear-wolf-pack` 136 → 138 bear wins, `buffalo-pride` 23 → 24 buffalo wins, `lions-hyenas` 74 → 76 lion wins; the other four only in rout share or median), rout shares by at most 0.9 pp, and the other eleven rows are identical. Every check, override and close tag is unchanged.

### Model 3

Measured on `fix/230-battle-end` (model 3, #230) in the default flight mode `allIn`, which every preset and every Simple run used until model 4. Morale rout works as in model 2; what changed is that a battle ends only once the fleeing side has run off the field or been caught ([MODEL.md §2.4](MODEL.md#24-outcomes)). `tests/fixtures/preset-shares-mv3.json` is authoritative.

| Preset (`id`)            | Sides                         | A wins | B wins | Draws |  Median | Rout share | Close | Status                   |
| ------------------------ | ----------------------------- | -----: | -----: | ----: | ------: | ---------: | ----- | ------------------------ |
| `lion-tiger`             | lion 1 v tiger 1              | 59.0 % | 41.0 % |   0 % |  50.8 s |      100 % | yes   | override                 |
| `pride-five-tigers`      | lion 5 v tiger 5              | 63.0 % | 37.0 % |   0 % |  62.6 s |      100 % | yes   | override (released hold) |
| `tiger-bear`             | tiger 1 v brown bear 1        | 19.5 % | 80.5 % |   0 % |  62.9 s |      100 % | no    | override                 |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         | 68.0 % | 32.0 % |   0 % | 101.6 s |     95.9 % | no    | override                 |
| `buffalo-pride`          | buffalo 1 v lion 6            | 11.5 % | 88.5 % |   0 % | 153.6 s |     62.9 % | no    | passes                   |
| `elephants-pride`        | elephant 5 v lion 30          |  100 % |    0 % |   0 % | 115.4 s |     86.9 % | no    | passes                   |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |  100 % |    0 % |   0 % | 118.2 s |     89.9 % | no    | passes                   |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       | 51.0 % | 49.0 % |   0 % | 155.1 s |     64.0 % | yes   | passes                   |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |  100 % |    0 % |   0 % | 143.0 s |      2.0 % | no    | passes                   |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  100 % |    0 % |   0 % | 142.8 s |     94.6 % | no    | override (released hold) |
| `lions-hyenas`           | lion 3 v spotted hyena 10     | 37.0 % | 63.0 % |   0 % |  67.1 s |     97.0 % | yes   | override (released hold) |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   | 72.0 % | 28.0 % |   0 % | 103.8 s |     95.0 % | no    | override                 |
| `elephant-hippo`         | elephant 1 v hippo 1          | 81.5 % | 18.5 % |   0 % | 233.3 s |     89.5 % | no    | passes                   |
| `raptors-trex`           | _Utahraptor_ 12 v _T. rex_ 1  | 13.0 % | 87.0 % |   0 % | 269.6 s |     70.0 % | no    | passes                   |
| `elephant-rhino`         | elephant 1 v white rhino 1    | 73.5 % | 26.5 % |   0 % | 210.9 s |     95.5 % | no    | override                 |
| `hippo-rhino`            | hippo 1 v white rhino 1       | 41.5 % | 58.5 % |   0 % | 177.4 s |     94.5 % | yes   | override                 |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  | 96.5 % |  3.5 % |   0 % | 198.9 s |     50.5 % | no    | passes                   |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  | 62.0 % | 38.0 % |   0 % | 157.2 s |     73.0 % | yes   | passes                   |

What changed against model 2 (below):

- **Winners and close tags are model 2's** within run-level noise (largest move: `raptors-trex`, raptors 7.0 → 13.0 %); every close tag holds.
- **Medians grow** by the time the losing side needs to leave the arena, so no preset is short any more (shortest `lion-tiger`, 50.8 s); `lion-tiger` drops its median override.
- **Rout shares fall** where the winner catches fleeing animals before they escape: the duels from 100 % to 50–96 %. Five overrides are no longer needed (`mammoth-wolves` 89.9 %, `trex-mirror` 64.0 %, `elephant-hippo` 89.5 %, `trex-spinosaurus` 50.5 %, `trex-triceratops` 73.0 %) and were dropped.
- **Nine presets carry a rout override** (`maxRoutShare` 1): the six that still exceed 90 % and the three former holds, released by the owner (2026-11-18). See [Overrides and holds](#overrides-and-holds).

### Model 2

Measured on `feat/169-197-flight-determinism` (model 2: deterministic math and the polar bear's researched rows) in the default flight mode `allIn` ("Fight to the end", owner decision 2026-11-16, [MODEL.md §3.8](MODEL.md#38-morale-and-rout)): every preset and every Simple run use it, so the per-species flight traits of [SPECIES.md §11.6](SPECIES.md#116-flight-traits-model-2-169) are inactive. `tests/fixtures/preset-shares-mv2.json` is authoritative.

| Preset (`id`)            | Sides                         | A wins | B wins | Draws |  Median | Rout share | Close | Status         |
| ------------------------ | ----------------------------- | -----: | -----: | ----: | ------: | ---------: | ----- | -------------- |
| `lion-tiger`             | lion 1 v tiger 1              | 58.5 % | 41.0 % | 0.5 % |  22.5 s |      100 % | yes   | override       |
| `pride-five-tigers`      | lion 5 v tiger 5              | 62.0 % | 37.0 % | 1.0 % |  26.2 s |      100 % | yes   | hold           |
| `tiger-bear`             | tiger 1 v brown bear 1        | 19.5 % | 80.5 % |   0 % |  32.0 s |      100 % | no    | override       |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         | 68.0 % | 32.0 % |   0 % |  69.6 s |     97.0 % | no    | override       |
| `buffalo-pride`          | buffalo 1 v lion 6            | 15.0 % | 84.5 % | 0.5 % | 138.8 s |     71.6 % | no    | passes         |
| `elephants-pride`        | elephant 5 v lion 30          | 99.0 % |    0 % | 1.0 % |  49.9 s |     89.0 % | no    | passes         |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |  100 % |    0 % |   0 % |  74.7 s |     90.1 % | no    | override (new) |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       | 51.0 % | 49.0 % |   0 % |  95.2 s |      100 % | yes   | override       |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |  100 % |    0 % |   0 % | 134.9 s |      2.3 % | no    | passes         |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  100 % |    0 % |   0 % |  45.5 s |     97.2 % | no    | hold           |
| `lions-hyenas`           | lion 3 v spotted hyena 10     | 36.5 % | 63.5 % |   0 % |  25.6 s |     98.2 % | yes   | hold           |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   | 71.0 % | 28.0 % | 1.0 % |  69.9 s |      100 % | no    | override       |
| `elephant-hippo`         | elephant 1 v hippo 1          | 81.5 % | 18.5 % |   0 % | 119.5 s |     99.5 % | no    | override       |
| `raptors-trex`           | _Utahraptor_ 12 v _T. rex_ 1  |  7.0 % | 93.0 % |   0 % | 155.2 s |     83.5 % | no    | passes         |
| `elephant-rhino`         | elephant 1 v white rhino 1    | 73.5 % | 26.5 % |   0 % | 114.2 s |      100 % | no    | override       |
| `hippo-rhino`            | hippo 1 v white rhino 1       | 41.0 % | 58.5 % | 0.5 % | 102.7 s |      100 % | yes   | override       |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  | 96.5 % |  3.5 % |   0 % | 112.0 s |      100 % | no    | override       |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  | 61.5 % | 38.5 % |   0 % |  91.9 s |      100 % | yes   | override       |

What changed against model 1 (below):

- **Without the flight traits, model 2 is model 1 up to the last bits.** Deterministic math changes the last bits of some normal deviates, which reshuffles individual runs: every preset without the polar bear stays within 1 pp of its model 1 share and its winner, and the close tags all hold. The tiger horde still ends with almost every tiger incapacitated (rout 2.3 %, median 134.9 s; model 1 2.2 %, 140.6 s).
- **The polar bear yields more to the brown bear** (82.0 % → 71.0 %): model 2's researched polar bear rows, which apply in both flight modes, lower its morale and its sprint endurance (it yields to grizzlies, [Miller 2015]).
- **One preset needs a new override.** `mammoth-wolves` routs 90.1 %, 0.1 pp over the limit (model 1: 89.8 %); the run reshuffle tipped the narrow pass that model 1 warned of. Its override cites the wolves' field record below. `elephants-pride` (89.0 %) still passes narrowly. The three overrides the flight traits needed (`elephants-pride`, `raptors-trex`, `trex-squad-tiger-horde`) were removed with the flight mode.
- **`lions-hyenas` stays close** (hyenas 63.5 %) and stays on hold.

#### Model 2 in the `realistic` flight mode (reference, not checked)

Simple never runs `realistic`, so these numbers are not a fixture and not checked; they are the first model 2 fixture, measured with the flight traits always on, and the `realistic` mode gives them bit for bit (the model 2 golden holds `realistic` cases that reproduce that version's numbers). With them, four presets exceeded a limit and carried an override until the flight mode arrived: `elephants-pride`, `mammoth-wolves` and `raptors-trex` the rout limit, `trex-squad-tiger-horde` the median.

| Preset (`id`)            | Sides                         | A wins | B wins | Draws |  Median | Rout share | Close |
| ------------------------ | ----------------------------- | -----: | -----: | ----: | ------: | ---------: | ----- |
| `lion-tiger`             | lion 1 v tiger 1              | 58.5 % | 41.0 % | 0.5 % |  22.5 s |      100 % | yes   |
| `pride-five-tigers`      | lion 5 v tiger 5              | 62.0 % | 37.0 % | 1.0 % |  26.2 s |      100 % | yes   |
| `tiger-bear`             | tiger 1 v brown bear 1        | 18.5 % | 81.5 % |   0 % |  30.6 s |      100 % | no    |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         | 68.0 % | 32.0 % |   0 % |  69.6 s |     97.0 % | no    |
| `buffalo-pride`          | buffalo 1 v lion 6            | 16.5 % | 83.0 % | 0.5 % | 133.8 s |     73.6 % | no    |
| `elephants-pride`        | elephant 5 v lion 30          |  100 % |    0 % |   0 % |  37.2 s |     93.8 % | no    |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |  100 % |    0 % |   0 % |  45.8 s |     94.2 % | no    |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       | 51.0 % | 49.0 % |   0 % |  95.2 s |      100 % | yes   |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |  100 % |    0 % |   0 % |  27.4 s |     86.4 % | no    |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  100 % |    0 % |   0 % |  41.7 s |     97.9 % | no    |
| `lions-hyenas`           | lion 3 v spotted hyena 10     | 46.5 % | 53.5 % |   0 % |  24.4 s |     99.8 % | yes   |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   | 76.5 % | 22.0 % | 1.5 % |  67.2 s |      100 % | no    |
| `elephant-hippo`         | elephant 1 v hippo 1          | 86.5 % | 13.5 % |   0 % |  95.3 s |      100 % | no    |
| `raptors-trex`           | _Utahraptor_ 12 v _T. rex_ 1  |    0 % |  100 % |   0 % |  64.6 s |     95.9 % | no    |
| `elephant-rhino`         | elephant 1 v white rhino 1    | 93.5 % |  6.5 % |   0 % |  71.3 s |      100 % | no    |
| `hippo-rhino`            | hippo 1 v white rhino 1       | 43.5 % | 56.0 % | 0.5 % |  95.8 s |      100 % | yes   |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  | 96.5 % |  3.5 % |   0 % | 112.0 s |      100 % | no    |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  | 62.0 % | 38.0 % |   0 % |  91.1 s |      100 % | yes   |

- **Flight acts where one side far outweighs the other.** The tiger horde ends with most tigers fled (rout 86.4 %) within about half a minute (median 27.4 s), the picture the classic model gave (MODEL.md §6). Lions against elephants (93.8 %), wolves against a mammoth (94.2 %) and raptors against _T. rex_ (95.9 %, raptors 0 %) break off more.
- **The white rhino gives way to the elephant.** `elephant-rhino` 93.5 % for the elephant (`allIn` 73.5 %): the rhino's low threshold (1.25×) makes the 1.6× heavier elephant a threat.

### Model 1

Measured on `main` at 0e5bfd8 plus this change; the engine is unchanged. The `polar-bear-brown-bear` row was appended with the polar bear (#184), the `elephant-hippo` row with the hippo (#186) the `raptors-trex` row with the raptor pack (#188) the `elephant-rhino` and `hippo-rhino` rows with the white rhinoceros (#187) the `trex-spinosaurus` row with _Spinosaurus_ (#185) and the `trex-triceratops` row with _Triceratops_ (#189); the earlier rows did not change. `tests/fixtures/preset-shares.json` is authoritative; update this table with it.

| Preset (`id`)            | Sides                         | A wins | B wins | Draws |  Median | Rout share | Close | Status   |
| ------------------------ | ----------------------------- | -----: | -----: | ----: | ------: | ---------: | ----- | -------- |
| `lion-tiger`             | lion 1 v tiger 1              | 58.5 % | 41.0 % | 0.5 % |  22.5 s |      100 % | yes   | override |
| `pride-five-tigers`      | lion 5 v tiger 5              | 62.0 % | 37.0 % | 1.0 % |  26.3 s |      100 % | yes   | hold     |
| `tiger-bear`             | tiger 1 v brown bear 1        | 19.5 % | 80.5 % |   0 % |  32.0 s |      100 % | no    | override |
| `bear-wolf-pack`         | brown bear 1 v wolf 8         | 68.0 % | 32.0 % |   0 % |  69.7 s |     97.0 % | no    | override |
| `buffalo-pride`          | buffalo 1 v lion 6            | 15.5 % | 84.0 % | 0.5 % | 138.8 s |     70.9 % | no    | passes   |
| `elephants-pride`        | elephant 5 v lion 30          | 99.0 % |    0 % | 1.0 % |  48.7 s |     89.1 % | no    | passes   |
| `mammoth-wolves`         | mammoth 1 v wolf 12           |  100 % |    0 % |   0 % |  74.7 s |     89.8 % | no    | passes   |
| `trex-mirror`            | _T. rex_ 1 v _T. rex_ 1       | 51.0 % | 49.0 % |   0 % |  95.3 s |      100 % | yes   | override |
| `trex-squad-tiger-horde` | _T. rex_ 10 v tiger 100       |  100 % |    0 % |   0 % | 140.6 s |      2.2 % | no    | passes   |
| `trex-erectus-100`       | _T. rex_ 1 v _H. erectus_ 100 |  100 % |    0 % |   0 % |  45.5 s |     97.2 % | no    | hold     |
| `lions-hyenas`           | lion 3 v spotted hyena 10     | 37.5 % | 62.5 % |   0 % |  25.6 s |     98.2 % | yes   | hold     |
| `polar-bear-brown-bear`  | polar bear 1 v brown bear 1   | 82.0 % | 17.5 % | 0.5 % |  70.9 s |      100 % | no    | override |
| `elephant-hippo`         | elephant 1 v hippo 1          | 81.5 % | 18.5 % |   0 % | 119.5 s |     99.5 % | no    | override |
| `raptors-trex`           | _Utahraptor_ 12 v _T. rex_ 1  |  7.5 % | 92.5 % |   0 % | 154.6 s |     83.3 % | no    | passes   |
| `elephant-rhino`         | elephant 1 v white rhino 1    | 73.5 % | 26.5 % |   0 % | 114.3 s |      100 % | no    | override |
| `hippo-rhino`            | hippo 1 v white rhino 1       | 41.0 % | 58.5 % | 0.5 % | 102.7 s |      100 % | yes   | override |
| `trex-spinosaurus`       | _T. rex_ 1 v _Spinosaurus_ 1  | 96.5 % |  3.5 % |   0 % | 112.0 s |      100 % | no    | override |
| `trex-triceratops`       | _T. rex_ 1 v _Triceratops_ 1  | 61.5 % | 38.5 % |   0 % |  91.9 s |      100 % | yes   | override |

What the numbers show:

- **One on one, the loser flees in every decided run.** Under the free morale rule (FREE-MATCHUPS.md §4.5) a lone animal routs before it is incapacitated, so the rout share of a duel is 100 %. Design §3.2 expected the check to catch the large social groups (§6 names #2, #6, #10, #11 and #18). It also trips every duel.
- **A non-social crowd does not cascade.** 100 tigers against 10 _T. rex_ end with 2.2 % fled: without the pack layer there is no morale contagion.
- **The raptor pack passes unaided.** `raptors-trex` is the first social preset added after the check: its losing raptors flee in 83.3 % of cases, under the 90 % limit, because its cooperation effects (rout contagion included) are set between none and the lion's mode ([SPECIES.md §11.4](SPECIES.md#114-pack-buff-traits)). It is not close: the design's 12 v 1 proposal was kept, since larger packs win more but rout more (CALIBRATION.md §15: 30 raptors win 17.0 % with a rout share of 93.5 %).
- **The rhino duels are the closest heavy duels.** `hippo-rhino` is the first heavy-against-heavy preset that is close (rhino 58.5 %): the white rhino (2 t at the mode) is a little heavier than the hippo (1.5 t), and both rest on unmeasured strike values (CALIBRATION.md §16). `elephant-rhino` is not close (elephant 73.5 %).
- **The land duel is lopsided.** `trex-spinosaurus` (design §6 #12) is not close: _T. rex_ wins 96.5 %. The two weigh about the same (8 t and 7.4 t at the mode), but the _Spinosaurus_ bite is several times weaker [Sakamoto 2022], and no single value of its sheet, pinned at either end of its range, makes it the favourite (CALIBRATION.md §17). It is a 1 v 1 by design, so its count was not tuned.
- **The documented duel is close.** `trex-triceratops` (design §6 #13) is close: _T. rex_ wins 61.5 %. _Triceratops_ is as heavy at the mode (8 t), and its horn rests on unmeasured values (force, interval, accuracy) that each swing the duel by tens of points (CALIBRATION.md §18). The count was not tuned (1 v 1 by design); the result follows from the sheet.
- **Two passes are narrow.** `elephants-pride` (89.1 %) and `mammoth-wolves` (89.8 %) sit just under the 90 % limit; a model change may tip them.
- **Free shares differ from the classic ones in §6.** `bear-wolf-pack` (classic: bear 57.6 %) and `buffalo-pride` (classic: lions 58.9 %) are not close in the free model, so neither carries `close`.

## Overrides and holds

**Model 3 (#230).** Every preset is in Simple mode. The three holds below were released by owner decision 2026-11-18 ("프리셋은 상관없어 그렇게 해줘") with a rout override (`RELEASED` in `src/sim/free/presets.ts`): from model 3 a battle ends only once the fleeing animals have run off the field, so the replay shows the rout. Rout overrides under model 3: `lion-tiger`, `pride-five-tigers`, `tiger-bear`, `bear-wolf-pack`, `trex-erectus-100`, `lions-hyenas`, `polar-bear-brown-bear`, `elephant-rhino`, `hippo-rhino`; `lion-tiger`'s median override and the overrides of `mammoth-wolves`, `trex-mirror`, `elephant-hippo`, `trex-spinosaurus` and `trex-triceratops` were dropped. The table is the record of model 2.

| Preset                  | Kind     | Allowed                   | Reason                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lion-tiger`            | override | rout 100 %, median ≥ 20 s | One on one, the loser flees once its morale breaks and there is no group for a rout to spread through. Two big cats of similar size settle it in a few strikes. It is the landing default of design §3.2.                                                                                   |
| `tiger-bear`            | override | rout 100 %                | One on one, as above.                                                                                                                                                                                                                                                                       |
| `trex-mirror`           | override | rout 100 %                | One on one, as above.                                                                                                                                                                                                                                                                       |
| `polar-bear-brown-bear` | override | rout 100 %                | One on one, as above. Added with the polar bear (#184); the median (71 s) passes unaided.                                                                                                                                                                                                   |
| `elephant-hippo`        | override | rout 100 %                | One on one, as above. Added with the hippo (#186); the median (119 s) passes unaided. Re-checked under model 2 (`allIn`): still passes with the override (rout 99.5 %, median 120 s).                                                                                                       |
| `elephant-rhino`        | override | rout 100 %                | One on one, as above. Added with the white rhino (#187); the median (114 s) passes unaided. Re-checked under model 2 (`allIn`): still passes with the override (median 114 s).                                                                                                              |
| `hippo-rhino`           | override | rout 100 %                | One on one, as above. Added with the white rhino (#187); the median (103 s) passes unaided. Re-checked under model 2 (`allIn`): still passes with the override (median 103 s).                                                                                                              |
| `trex-spinosaurus`      | override | rout 100 %                | One on one, as above. Added with _Spinosaurus_ (#185); the median (112 s) passes unaided. Re-checked under model 2 (`allIn`): still passes with the override.                                                                                                                               |
| `trex-triceratops`      | override | rout 100 %                | One on one, as above. Added with _Triceratops_ (#189); the median (92 s) passes unaided. Re-checked under model 2 (`allIn`): still passes with the override.                                                                                                                                |
| `bear-wolf-pack`        | override | rout 100 %                | Field records: most meetings of brown bears and wolves over a carcass end with one side withdrawing rather than with injuries ([SPECIES.md §5](SPECIES.md#brown-bears-and-wolves)), so a fight that ends in a rout matches them.                                                            |
| `mammoth-wolves`        | override | rout 100 % (model 2)      | The living analogue: wolves avoid injury from large prey, wounding it and waiting rather than pressing an attack (SPECIES.md §11.6), so a pack that breaks off matches them. Model 2 (`allIn`) routs 90.1 % at the fixture measure, 0.1 pp over the limit; model 1 passed unaided (89.8 %). |
| `pride-five-tigers`     | hold     | –                         | Every member of the losing side flees (rout share 100 %), and the median is 26 s.                                                                                                                                                                                                           |
| `trex-erectus-100`      | hold     | –                         | 97 % of the _H. erectus_ that leave the fight flee rather than being incapacitated.                                                                                                                                                                                                         |
| `lions-hyenas`          | hold     | –                         | 98 % of the losing side's members flee, and the median is 26 s.                                                                                                                                                                                                                             |

A hold is released by one of: an owner-accepted override with a reason, other head counts (design §6 lists `lions-hyenas` at 3 v 10 as a proposal), or a morale retune under a new model version (R4 a, ADR-0008). Until then Simple mode leaves these three out. They are the only presets of _H. erectus_ and spotted hyenas, so release checklist item 5 ("each species with at least one preset", design §1.4) needs one of them released, or another preset for those species, before 1.0.

## Presets waiting for a species

These design §6 presets stay out of the registry until their species ship (design §5.2). `FreeSpeciesId` would reject them, so they cannot be added early by mistake.

| #   | Preset (ko / en)                                               | Waits for                        |
| --- | -------------------------------------------------------------- | -------------------------------- |
| 19  | 티라노 vs 카피바라 천 마리 / T. rex vs a thousand capybaras    | capybara (batch B, R15)          |
| 20  | 북극곰 vs 펭귄 이천 마리 / Polar bear vs two thousand penguins | polar bear and penguin (batch C) |
| 21  | 벌꿀오소리 vs 사자 셋 / Honey badger vs three lions            | honey badger (batch C)           |
| 22  | 고릴라 vs 불곰 / Gorilla vs brown bear                         | gorilla (batch B, R14)           |
| 23  | 티라노 vs 기가노토사우루스 / T. rex vs _Giganotosaurus_        | _Giganotosaurus_ (batch B)       |

Each one joins the registry in the species' own PR (design §5.3 step 8), is measured into the fixture, and passes the checks there. Counts marked "proposal" in §6 may be tuned towards `close` at that point.

## Banned words

`tests/presets.test.ts` checks every name, "Why?" text, override reason and hold reason, and the free result strings (`free.stat.*`, `free.rout.*`), against:

- gore and death words (the same patterns as `tests/pages.test.ts`, plus "deadliest", "slaughter", "corpse" and "wound")
- betting words: 베팅, 배당, 도박, 내기, odds, bet, wager, stake, prize, jackpot, gamble (design §4.5)
- titles, trademarks and tools: 월드컵 / World Cup, film and show titles, the documentary series and the children's book series of design §2.3, monster and game franchises, the name-draw tool (§2.2), broadcasters and children's channels
- streaming platform names, which design §1.2 allows only in setup and integration text
- view counts (조회, views) and title brackets (《》, 『』, 「」, quotation marks)

The test also proves the patterns still catch the words and still allow the common nouns presets use (쥐라기 for the period, 빙하기, 피로, 피해, "Late Jurassic").

## Updating the fixture

The fixture is meant to change with the model, unlike the goldens, which never change. Rewrite it only together with the change that moves it, and let the owner review the diff (design §10.4, item 4):

```bash
UPDATE_PRESET_FIXTURE=1 npx vitest run tests/presets.test.ts
npx prettier --write tests/fixtures/preset-shares-mv2.json
```

The variable rewrites only the newest model's fixture (`FIXTURES[FREE_MODEL_VERSION]` in the test). A new model version adds its own file to `FIXTURES`; the older ones stay as measured.

Then update the [fixture table](#fixture), and the [overrides and holds](#overrides-and-holds) if a check result changed.
