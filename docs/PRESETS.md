# Simple-mode presets

> **한국어 요약**
>
> - 쉬운 모드에서 고를 대진 프리셋을 `src/sim/free/presets.ts`에 모았습니다. 설계 문서 [RENEWAL-1.0.md §6](design/RENEWAL-1.0.md#6-simple-mode-preset-list)의 목록 가운데 두 종이 모두 지금 있는 11개만 넣었고, 나머지 12개는 종이 추가될 때 들어옵니다(아래 [대기 중인 프리셋](#presets-waiting-for-a-species)).
> - 프리셋마다 자유 대결 엔진으로 같은 시드(20261019)와 같은 실행 수(200회)로 승률, 전투 시간 중앙값, 진 쪽의 이탈 비율을 재서 `tests/fixtures/preset-shares.json`에 기록합니다. 테스트가 매번 다시 계산해 기록과 비트 단위로 같은지 확인하므로, 모델이 바뀌면 이 파일의 차이로 드러납니다.
> - 이탈 점검: 전투 시간 중앙값이 30초 미만이거나 진 쪽의 이탈 비율이 90%를 넘으면 실패입니다(모두 **S**). 문서로 남긴 예외(override)가 있으면 통과합니다. 예외도 받지 못한 프리셋은 보류(hold)되어 쉬운 모드에 나오지 않습니다.
> - 측정 결과 1:1 대결은 진 쪽이 거의 항상 이탈로 끝납니다(100%). 1:1 세 개와 불곰 vs 늑대 무리는 근거를 적은 예외로 통과하고, 사자 무리 vs 호랑이 다섯, 티라노 vs 호모 에렉투스 100, 사자 vs 하이에나는 보류입니다. 보류를 풀지는 소유자가 정합니다(R4).
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

The `close` tag is never chosen by hand: the test fails until the tag matches the fixture. A `check` override may only loosen `short` and `rout`. The test asserts that every preset without a hold passes, and that every held preset still fails, so a preset that starts passing after a model change is noticed and released.

## Fixture

Measured on `main` at 0e5bfd8 plus this change; the engine is unchanged. `tests/fixtures/preset-shares.json` is authoritative; update this table with it.

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

What the numbers show:

- **One on one, the loser flees in every decided run.** Under the free morale rule (FREE-MATCHUPS.md §4.5) a lone animal routs before it is incapacitated, so the rout share of a duel is 100 %. Design §3.2 expected the check to catch the large social groups (§6 names #2, #6, #10, #11 and #18). It also trips every duel.
- **A non-social crowd does not cascade.** 100 tigers against 10 _T. rex_ end with 2.2 % fled: without the pack layer there is no morale contagion.
- **Two passes are narrow.** `elephants-pride` (89.1 %) and `mammoth-wolves` (89.8 %) sit just under the 90 % limit; a model change may tip them.
- **Free shares differ from the classic ones in §6.** `bear-wolf-pack` (classic: bear 57.6 %) and `buffalo-pride` (classic: lions 58.9 %) are not close in the free model, so neither carries `close`.

## Overrides and holds

| Preset              | Kind     | Allowed                   | Reason                                                                                                                                                                                                                           |
| ------------------- | -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lion-tiger`        | override | rout 100 %, median ≥ 20 s | One on one, the loser flees once its morale breaks and there is no group for a rout to spread through. Two big cats of similar size settle it in a few strikes. It is the landing default of design §3.2.                        |
| `tiger-bear`        | override | rout 100 %                | One on one, as above.                                                                                                                                                                                                            |
| `trex-mirror`       | override | rout 100 %                | One on one, as above.                                                                                                                                                                                                            |
| `bear-wolf-pack`    | override | rout 100 %                | Field records: most meetings of brown bears and wolves over a carcass end with one side withdrawing rather than with injuries ([SPECIES.md §5](SPECIES.md#brown-bears-and-wolves)), so a fight that ends in a rout matches them. |
| `pride-five-tigers` | hold     | –                         | Every member of the losing side flees (rout share 100 %), and the median is 26 s.                                                                                                                                                |
| `trex-erectus-100`  | hold     | –                         | 97 % of the _H. erectus_ that leave the fight flee rather than being incapacitated.                                                                                                                                              |
| `lions-hyenas`      | hold     | –                         | 98 % of the losing side's members flee, and the median is 26 s.                                                                                                                                                                  |

A hold is released by one of: an owner-accepted override with a reason, other head counts (design §6 lists `lions-hyenas` at 3 v 10 as a proposal), or a morale retune under a new model version (R4 a, ADR-0008). Until then Simple mode leaves these three out. They are the only presets of _H. erectus_ and spotted hyenas, so release checklist item 5 ("each species with at least one preset", design §1.4) needs one of them released, or another preset for those species, before 1.0.

## Presets waiting for a species

These design §6 presets stay out of the registry until their species ship (design §5.2). `FreeSpeciesId` would reject them, so they cannot be added early by mistake.

| #   | Preset (ko / en)                                                   | Waits for                        |
| --- | ------------------------------------------------------------------ | -------------------------------- |
| 12  | 티라노 vs 스피노 (육상 대결) / T. rex vs _Spinosaurus_ (land duel) | _Spinosaurus_ (batch A)          |
| 13  | 티라노 vs 트리케라톱스 / T. rex vs _Triceratops_                   | _Triceratops_ (batch A′)         |
| 14  | 코끼리 vs 코뿔소 / Elephant vs rhino                               | white rhinoceros (batch A)       |
| 15  | 하마 vs 코뿔소 / Hippo vs rhino                                    | hippopotamus and rhino (batch A) |
| 16  | 코끼리 vs 하마 / Elephant vs hippo                                 | hippopotamus (batch A)           |
| 17  | 북극곰 vs 불곰 / Polar bear vs brown bear                          | polar bear (batch A)             |
| 18  | 랩터 무리 vs 티라노 / Raptor pack vs T. rex                        | raptor pack (batch A)            |
| 19  | 티라노 vs 카피바라 천 마리 / T. rex vs a thousand capybaras        | capybara (batch B, R15)          |
| 20  | 북극곰 vs 펭귄 이천 마리 / Polar bear vs two thousand penguins     | polar bear and penguin (batch C) |
| 21  | 벌꿀오소리 vs 사자 셋 / Honey badger vs three lions                | honey badger (batch C)           |
| 22  | 고릴라 vs 불곰 / Gorilla vs brown bear                             | gorilla (batch B, R14)           |
| 23  | 티라노 vs 기가노토사우루스 / T. rex vs _Giganotosaurus_            | _Giganotosaurus_ (batch B)       |

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
npx prettier --write tests/fixtures/preset-shares.json
```

Then update the [fixture table](#fixture), and the [overrides and holds](#overrides-and-holds) if a check result changed.
