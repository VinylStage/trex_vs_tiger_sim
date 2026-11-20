# Herd defence for social herbivores (design)

> **한국어 요약**
>
> - 이슈 [#72](https://github.com/VinylStage/trex_vs_tiger_sim/issues/72)의 설계 제안입니다. #50의 무리 버프(포식자용)와 같은 형식(켜짐 조건, 효과, 꺼짐 조건)으로, 무리 지어 사는 초식동물의 집단 방어를 자유 대결 엔진에 넣는 방법을 정리합니다. 코드는 아직 바꾸지 않습니다.
> - **종별 근거:** 코끼리와 아프리카물소는 집단 방어 기록이 충분합니다(코끼리: 사자 울음 재생 실험에서 무리가 뭉치고 우두머리가 다가감; 물소: 큰 무리일수록 사자에게 덜 잡힘). 털매머드는 코끼리와의 계통 비교와 화석 성비로 추정할 뿐이라 근거가 약합니다. 흰코뿔소는 암컷·새끼 무리가 있지만 집단 방어를 다룬 동료 심사 연구를 찾지 못해 약함, 하마는 땅 위에서는 없음, 트리케라톱스는 없음입니다. 혼자 사는 종은 아무 효과도 받지 않습니다.
> - **규칙:** `herd` 종이고 결속 반경 안에 동료가 1마리 이상 있으면 켜집니다. 효과는 세 가지이며 각각 끌 수 있습니다. H1 대열 유지(무리 중심에서 너무 멀리 쫓아가지 않음), H2 구조(동료에게 매달린 포식자를 먼저 공격), H3 수에 따른 사기(무리 버프 E4a와 같은 식). 피해량을 직접 올리는 효과는 없습니다. 새끼 보호는 나이 구분이 없어 이번 범위에서 뺍니다.
> - **영향(시험 구현, 푸시하지 않음):** 지금 프리셋에서는 이미 무리 쪽이 거의 다 이기거나(코끼리 5 vs 사자 30, 매머드 vs 늑대 12) 혼자라서 규칙이 켜지지 않아(물소 1 vs 사자 6) 변화가 거의 없습니다. 차이는 승부가 팽팽한 소규모 무리 대 큰 무리에서만 나타납니다: 물소 3 vs 사자 20에서 물소 승률 +8%p, 물소 2 vs 사자 12에서 +6~7%p(두 모드 모두). 효과 대부분은 H2 구조에서 나오고, H1 대열 유지는 어느 경우에도 결과를 바꾸지 않아 이번 버전에서는 빼기를 권합니다(§5, O8).
> - **출시:** 새 자유 모델 버전(ADR-0008)으로 내고, 기존 링크는 비트 단위로 그대로입니다. 프리셋은 다시 측정하고 보정 문서에 새 절을 씁니다.
> - **소유자 결정 사항**은 §8에 있습니다: 대상 종, 수치, "끝까지 싸우기"와 "현실 모드"에서 기본으로 켤지.

Status: **Proposal** for owner review. Issue: [#72](https://github.com/VinylStage/trex_vs_tiger_sim/issues/72), split out of #50 by owner decision D2 ([FREE-MATCHUPS.md §9](FREE-MATCHUPS.md#9-decisions)). Base: `main` at v0.2.30 (free model 4). This document changes no code; implementation follows once the owner answers §8.

## Contents

1. [Scope and what already happens](#1-scope-and-what-already-happens)
2. [Field evidence per species](#2-field-evidence-per-species)
3. [Herd rules](#3-herd-rules)
4. [Mapping onto the free engine](#4-mapping-onto-the-free-engine)
5. [Impact estimate (prototype)](#5-impact-estimate-prototype)
6. [UI and transparency](#6-ui-and-transparency)
7. [Rollout](#7-rollout)
8. [Owner decisions](#8-owner-decisions)
9. [References](#9-references)

## 1. Scope and what already happens

#72 asks for sourced group-defence behaviour for herds in the free (symmetric) engine, in the format of the #50 pack buff ([FREE-MATCHUPS.md §5](FREE-MATCHUPS.md#5-pack-buff-rules)): activation, effects, deactivation, bounded magnitudes, each number cited or marked **S** with a sensitivity range, and the same badge and popover in the UI.

Some herd behaviour already emerges in the free engine without any rule, and the design must not count it twice:

- **Counter-charge is already the default.** Every free agent, prey or predator, targets its nearest active enemy and approaches it (`nearestEnemy`, phase 1 of `simulateFreeBattle` in `src/sim/free/engine.ts`). An elephant already charges the nearest lion; nothing has to switch that on.
- **Neighbours' cones already cover riders.** The strike search (`strikeVisit`) hits any enemy in the striker's cone, so a lion riding one buffalo can be struck by the buffalo next to it. SPECIES.md §7 records the effect as "Herd effects emerge without herd rules".
- **A group of herbivores already wins most fights the field also says it wins.** 5 elephants vs 30 lions and 10 buffalo vs 12 lions are near 100 % herd wins (§5; [SPECIES.md §7](../SPECIES.md#7-calibration-notes)).

What the engine cannot express today, and the herd layer adds: herd members **stay together** instead of each chasing its own lion away from the group, they **go to a herd-mate's aid** when a predator holds on to it, and a herd's **courage depends on numbers**. These are mechanics M4 (herd mobbing and rescue) and M11 (numbers-dependent courage, for herds) of [SPECIES.md §8](../SPECIES.md#8-what-the-engine-cannot-express).

Out of scope: shielding the young (the engine has no age classes, §3.5), stampede and flight contagion (§3.5, decision O4), mixed sides (#50 D4), water and terrain (M9).

## 2. Field evidence per species

Access levels follow [SPECIES.md §3.1](../SPECIES.md#31-evidence-tags-and-source-access): **[FT]** full text read, **[Abs]** abstract or search summary only, **[WP]** via Wikipedia. Every [Abs] and [WP] item is to be re-read against the primary source before a number derived from it is shown as fact in the UI.

Verdicts: **well documented** (peer-reviewed field work describes the behaviour in this species), **weak** (indirect, anecdotal, or only in a related species), **absent** (no evidence, or evidence against). Every species in the registry (`FREE_SPECIES_IDS`) is listed.

### 2.1 Candidates

| Species                     | Defensive ring or line                                                                                                                                                       | Mobbing and counter-charge                                                                                                                                                | Shielding young                                                                                                 | Morale support (numbers)                                                                                                                                    | Verdict             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| African bush elephant       | Defensive **bunching**: in 72 lion-roar playbacks to 39 Amboseli families, groups bunched and moved toward the matriarch [McComb 2011, FT]                                   | Matriarchs approach the sound source; adults mob lions [McComb 2011]; [WP: African bush elephant]                                                                         | Lion kills at Savuti fall on 4–11-year-olds, not adults or calves kept in the group [Power & Compion 2009, Abs] | Bunching, listening and moving to the matriarch were all stronger for 3 lions than for 1 (bunching z = 3.76, p = 0.0002) [McComb 2011]                      | **Well documented** |
| African (Cape) buffalo      | Herds prefer open habitat at night and morning when lions hunt; breeding herds grew after lions were reintroduced at Addo [Tambling 2012, Abs]                               | Herds drive off or kill lions [WP: African buffalo]; rescues of a pulled-down herd member are filmed and reported by guides, but no peer-reviewed rate exists (anecdotal) | Juvenile share in breeding herds recovered to pre-lion levels once groups grew [Tambling 2012]                  | Males in bachelor groups had about four times the mortality hazard of females in mixed herds, mostly from lions [Hay 2008, Abs]                             | **Well documented** |
| Woolly mammoth              | No direct record                                                                                                                                                             | Adults "could effectively defend themselves" [WP: Woolly mammoth]; no group record                                                                                        | No direct record                                                                                                | Male-biased fossil record (69 % of 98 sexed specimens) read as matriarchal herds whose young males died alone [Pečnerová 2017, Abs]; elephant bracket       | **Weak** (inferred) |
| White rhinoceros            | An outward-facing circle around calves is described by conservation sources, not by a peer-reviewed study found here [IRF]; Owen-Smith's ethology [Owen-Smith 1975] not read | No record                                                                                                                                                                 | Calves run in front of their mothers when fleeing [Shrader 2013, Abs]                                           | Groups are cows, calves and up to six subadults; mothers' vigilance does not fall with group size, so groups form for the subadults' benefit [Shrader 2013] | **Weak**            |
| Hippopotamus                | Pods rest together in water; on land adults graze alone [WP: Hippopotamus]                                                                                                   | Groups driving off crocodiles in water are filmed (anecdotal); the free model has no water                                                                                | Not on land                                                                                                     | No record                                                                                                                                                   | **Absent** on land  |
| _Triceratops_               | Popular "ring of horns" reconstructions have no evidence; "little evidence to suggest that they lived in herds" [Mathews 2009, via WP]                                       | No record                                                                                                                                                                 | One bonebed of three juveniles [Mathews 2009]; a possible family of three [WP: Triceratops]                     | No record                                                                                                                                                   | **Absent**          |
| American bison (proxy only) | Calf pods form on calving grounds; wolves prefer herds with calves [Carbyn & Trottier 1987, Abs]                                                                             | Cows defend calves, sometimes aggressively [Carbyn & Trottier 1987, 1988, Abs]                                                                                            | As left                                                                                                         | Wolf success against bison plateaus at 9–13 wolves [MacNulty 2014]                                                                                          | Not in the roster   |

Bison are not a species here; they are listed because the buffalo is the model's bison stand-in for the wolf calibration (SPECIES.md §4.3, §7), so their defence explains part of the 9–13 plateau that the herd layer must not move (§3.6).

### 2.2 Species that get nothing

- **Solitary:** _T. rex_, brown bear, polar bear, tiger, _Spinosaurus_, hippopotamus (on land), _Triceratops_. They get no herd effect at any count; several of them on one side still interfere with each other at a target ([FREE-MATCHUPS.md §5.6](FREE-MATCHUPS.md#56-non-social-crowds)).
- **Social predators:** lion, gray wolf, spotted hyena, _Homo erectus_, the raptor pack. They already have the pack buff. `herd` and `social` are exclusive, so no species gets both layers.

### 2.3 Recommendation

| Species          | `herd` | Values                                         |
| ---------------- | :----: | ---------------------------------------------- |
| Elephant         |  yes   | §3.3 row                                       |
| Buffalo          |  yes   | §3.3 row                                       |
| Woolly mammoth   |  yes   | the elephant's row, labelled "inferred" (O1)   |
| White rhinoceros |   no   | owner option O1; if yes, the low row of §3.3   |
| Hippopotamus     |   no   | —                                              |
| _Triceratops_    |   no   | — (a new issue if a ceratopsian herd is added) |

## 3. Herd rules

The herd layer sits beside the pack buff and copies its structure. It is evaluated **per agent**, draws no random numbers, adds no raw damage, and every effect has its own switch.

### 3.1 Activation (all must hold)

| #   | Condition                                                                             | Value                      | Basis                                 |
| --- | ------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------- |
| B1  | The side's species has `herd = true`                                                  | §2.3                       | §2.1 per species                      |
| B2  | The herd master switch and the effect's own switch are on (§3.4)                      | default on (O3)            | Same rule as the pack buff            |
| B3  | The agent is present and not Routed                                                   | —                          | —                                     |
| B4  | At least one present, non-routed ally is within the herd radius `R_herd` of the agent | `R_herd` per species, §3.3 | Bunching distance not measured; **S** |

A side of one never activates the layer. This keeps the wolf-vs-lone-buffalo calibration curve and the `buffalo-pride` (1 v 6) and `mammoth-wolves` (1 v 12) presets exactly as they are, by construction.

### 3.2 Effects (each bounded, each switchable)

| Effect                          | Rule while active                                                                                                                                                                                                                                                                                                                                | Magnitude (default, range)                                              | Basis                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1 Close ranks**              | The agent's herd centre is the mean position of itself and its allies within `R_herd`. In Approach, a step that would end more than `leash` from the herd centre, toward a target that is also more than `leash` from it, is not taken: the agent turns to face the target and holds. A target riding a herd-mate is exempt (H2). Steering only. | `leash` **25 m** (**S**, 15–40)                                         | Bunching on threat [McComb 2011]; herd members are safer than loners [Hay 2008]; predators isolate one animal and attack it [WP: African buffalo]        |
| **H2 Rescue (mob the rider)**   | On each retarget (0.5 s), the agent targets the nearest enemy that is **latched onto a herd-mate** within `R_rescue`, if there is one, instead of its nearest enemy. Its strike search ranks such riders after riders on itself and before every other enemy in its cone. Targeting only: no damage, accuracy or reach bonus.                    | `R_rescue` **40 m** (**S**, 25–60)                                      | Matriarchs approach the threat [McComb 2011]; adults mob lions [WP]; buffalo rescues (anecdotal); bison cows defend calves [Carbyn & Trottier 1987]. M4. |
| **H3 Morale support (numbers)** | As pack-buff E4a: effective morale for the rout check is `morale + c`, `c = clamp(k_h × ln((a + 1) / (e + 1)), −c_max, +c_max)`, `a` = herd-buffed allies and `e` = active enemies within `moraleRadius` (40 m), both capped at 16.                                                                                                              | `k_h` **0.05** (**S**, 0–0.1); `c_max` **0.1** (constant, **S**, 0–0.2) | Stronger response to 3 lions than to 1 [McComb 2011]; group size and survival [Hay 2008; Tambling 2012]. M11 for herds.                                  |

No herd effect adds damage per second, strike force, hide or HP. The layer changes **where a herd member stands, whom it strikes, and how long its courage lasts**, as the pack buff does for predators.

**Why H3 cuts both ways.** A herd facing a far larger group (5 elephants vs 30 lions) gets a negative `c`, down to −0.1. That is deliberate: it is what "numbers-dependent" means, and the elephants' high morale (0.65–0.95) and the small bound keep it from routing a healthy herd. If the owner prefers support that only helps, `c` can be clamped to `[0, c_max]` (option O2).

### 3.3 Per-species herd traits

Species constants, like the flight traits ([SPECIES.md §11.6](../SPECIES.md#116-flight-traits-model-2-169)): not sampled, not in links, not in the design matrix. The engine reads the mode; the range is the sensitivity range swept in calibration. All **S** (no study measures bunching distance or rescue range in metres).

| Species                  | `R_herd` (m) | `leash` (m)  | `R_rescue` (m) | `k_h`            | Note                                          |
| ------------------------ | ------------ | ------------ | -------------- | ---------------- | --------------------------------------------- |
| Elephant                 | 20 / 30 / 50 | 15 / 25 / 40 | 25 / 40 / 60   | 0 / 0.05 / 0.1   | Best documented                               |
| Buffalo                  | 20 / 30 / 50 | 15 / 25 / 40 | 25 / 40 / 60   | 0 / 0.05 / 0.1   | Rescue range anecdotal: low weight in review  |
| Woolly mammoth           | 20 / 30 / 50 | 15 / 25 / 40 | 25 / 40 / 60   | 0 / 0.05 / 0.1   | Inferred from the elephant                    |
| White rhinoceros (if O1) | 10 / 20 / 30 | 15 / 25 / 40 | 0 / 15 / 25    | 0 / 0.025 / 0.05 | Small groups, no rescue record: halved values |

`c_max` 0.1 and the count cap 16 are global constants, as for the pack buff ([FREE-MATCHUPS.md §5.7](FREE-MATCHUPS.md#57-implementation-notes-p4)).

### 3.4 Deactivation

| Trigger             | Rule                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Out of the herd     | B4 false continuously for `T_grace` (the sampled global `buffGrace`, 2 s, 0–5): layer off for that agent. On again at once. |
| Agent routs or dies | Off at once (B3).                                                                                                           |
| Rescue target lost  | The rider is thrown, released, routs or dies: the next retarget picks a new rescue target or the nearest enemy.             |
| Herd breaks up      | Each agent whose allies have all routed, died or moved away loses B4; a scattered herd loses the layer member by member.    |
| Last survivor       | No ally, so B4 is false: it fights with individual traits only, exactly as today.                                           |

### 3.5 What is deliberately left out

- **Shielding the young.** The engine has one mass triangle per side and no age class; a herd of adults with calves in the middle needs juvenile agents and a "protect" target type. SPECIES.md §4.2 already keeps a juvenile elephant variant for calibration only. A later issue could add a calf count per side; H1 is written so the herd centre could then be the calves' centre.
- **Stampede and flight contagion.** Buffalo herds also flee together, which would be the herd twin of pack-buff E4b. It makes herds weaker, not stronger, and it interacts with the `realistic` flight traits of #169; it is not proposed here (O4).
- **A geometric ring.** Assigning outward-facing slots around a centre (the reverse of pack-buff E1) was considered. Without young to protect it only adds turning work and stalls; H1 gives the same "nobody strays" effect with one distance check.

### 3.6 Calibration guards

1. **Lone animals unchanged.** B4 never holds for a side of one, so every 1 v N result (wolf-vs-buffalo plateau [MacNulty 2014], `buffalo-pride`, `mammoth-wolves`, the 1 v 1 presets) is bit-identical with the layer on. This is a test, not a measurement.
2. **All switches off ≡ `herd = false`.** The herd code paths draw no random numbers, so a herd side with every switch off must be bit-identical to the same species without the flag, as the pack buff's §5.5 rule. Also a test.
3. **No new certainties.** No documented matchup may move from "herd usually wins" to "herd always wins" when it was not already there; a shift above 10 pp in any calibration matchup is reported and reviewed before release.

## 4. Mapping onto the free engine

Line references are to `main` at v0.2.30 (free model 4). Everything below is plain TypeScript in modules that already exist; no runtime dependency is added ([ADR-0004](../adr/0004-no-runtime-dependencies.md)).

| Mechanic         | Existing code it reuses                                                                                                                           | Change                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Species flag     | `FreeSpecies.social`, `defineFreeSpecies` checks, `SpeciesRevision` per model version (`src/sim/free/species.ts`)                                 | Add `herd: boolean` and a `herdTraits` record, set through the new model's revision so earlier versions read `herd = false`. `defineFreeSpecies` rejects `herd && social`.                                             |
| Switches         | `PACK_BUFF_EFFECTS`, `PackBuffSwitches`, `sanitizeFreeConfig` (`src/sim/free/config.ts`); `withBuffSwitch` (`src/ui/free-form-model.ts`)          | `HERD_EFFECTS = ['ranks', 'rescue', 'morale']`, `herd` switches defaulting on (O3), ignored below the new `mv` (`HERD_SINCE_MV`), as `flight` is below `FLIGHT_MODE_SINCE_MV`. Share links omit them while all are on. |
| Cohesion (B4)    | Status block at the top of the tick (`buffLayer`): `fillCohesion`, `blockCount`, `SpatialGrid.hasWithin`, `graceLeft`, `buffRefreshTicks` stagger | Run the same block for herd sides with `R_herd`; a `herded` byte array next to `buffed`. Herd centre: a capped `SpatialGrid.query` sum over allies within `R_herd`, on the same refresh ticks.                         |
| H1 (steering)    | Phase 1 Approach branch, just before `if (gap <= 0) { steer(…, 0) }`; `steer` itself is unchanged                                                 | Set `gap = 0` when the leash condition holds, so the existing branch turns the agent to face its target without moving.                                                                                                |
| H2 (targeting)   | The retarget branch (`focusTarget` / `nearestEnemy`); `strikeVisit` score (`d − 1000` for a rider on the striker)                                 | A `rescueTarget(i)` search over the enemy grid within `R_rescue`, filtered to Latched agents whose `host` is on the agent's side; in `strikeVisit`, `d − 500` for a rider on a herded herd-mate.                       |
| H3 (morale)      | `support[i]` set from `countAllies`/`countEnemies` every `supportRefreshTicks`; the rout check already reads `morale + support`                   | Fill `support` for herded agents with `k_h`. No change to the rout check.                                                                                                                                              |
| Stats            | `BuffStats`, `stats[s]`, `buffTicks`/`anyTicks` (buff fraction)                                                                                   | Herd sides fill the same fraction fields (`aBuffFrac`, `aBuffTime`); a herd side is never social, so a side never has both. Add counters `ranks`, `rescue`.                                                            |
| Trace and replay | Trace v3 `buffed` flag byte per agent and frame, `BuffOn`/`BuffOff` events                                                                        | Write the herd flag into the same byte. No trace format change; the replay legend reads the side's species to name it (§6).                                                                                            |

**Cost.** The herd-centre sum and the rescue search are bounded like the pack buff's queries (cap 16 allies; rescue search only among riders, which exist only while a latching predator holds on). The prototype's brute-force version added no measurable time at these counts; the real one must pass the `perf` PR gate ([PERFORMANCE.md](../PERFORMANCE.md#standing-performance-checks-241)) and adds a herd-vs-pack row to `bench/scenarios.json` (for example 500 buffalo vs 5,000 lions).

**Random numbers.** None. Effects only change positions, targets and the rout threshold, so the side streams (`SALT_A`, `SALT_B`) are untouched and guard 2 of §3.6 holds.

## 5. Impact estimate (prototype)

A rough version of B4, H1, H2 and H3 was written into a scratch copy of the engine (not committed, not pushed; brute-force neighbour loops, constants from §3.3 modes). It used free model 4, 400 runs per cell, seed 20261120, both flight modes. Variants: `off` (today), `full` (§3.3 modes), `low` (`R_herd` 20, `leash` 40, `R_rescue` 25, `k_h` 0.025, `c_max` 0.05), `high` (50, 15, 60, 0.1, 0.2), and each effect alone at the modes. The white rhino rows apply the elephant values only to measure sensitivity; they are not a recommendation.

Shares are side A (the herd) wins / side B wins / draws in %, then the median duration in seconds. At 400 runs the 95 % interval is about ±5 pp at mid shares, ±2 pp near 95 %.

Each cell: the herd's win share in % (change against today in pp; median duration). No run in any cell was a draw.

| Matchup                                      | Mode        | today         | full                | low                 | high                | H2 only             | H1 only             | H3 only             |
| -------------------------------------------- | ----------- | ------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| 1 buffalo v 6 lions (`buffalo-pride`)        | `allIn`     | 14.0 (164 s)  | 14.0 (+0.0; 164 s)  | 14.0 (+0.0; 164 s)  | 14.0 (+0.0; 164 s)  | 14.0 (+0.0; 164 s)  | 14.0 (+0.0; 164 s)  | 14.0 (+0.0; 164 s)  |
| 5 buffalo v 6 lions                          | `allIn`     | 99.0 (113 s)  | 98.5 (-0.5; 108 s)  | 98.8 (-0.2; 108 s)  | 99.0 (+0.0; 107 s)  | 99.0 (+0.0; 107 s)  | 99.0 (+0.0; 113 s)  | 98.5 (-0.5; 113 s)  |
| 5 elephants v 30 lions (`elephants-pride`)   | `allIn`     | 100.0 (120 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 119 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 120 s) | 100.0 (+0.0; 120 s) |
| 1 mammoth v 12 wolves (`mammoth-wolves`)     | `allIn`     | 100.0 (118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) |
| 3 mammoths v 30 wolves                       | `allIn`     | 100.0 (74 s)  | 100.0 (+0.0; 72 s)  | 100.0 (+0.0; 72 s)  | 100.0 (+0.0; 72 s)  | 100.0 (+0.0; 72 s)  | 100.0 (+0.0; 74 s)  | 100.0 (+0.0; 74 s)  |
| 3 white rhinos v 12 lions (sensitivity only) | `allIn`     | 98.5 (150 s)  | 99.3 (+0.8; 133 s)  | 99.3 (+0.8; 134 s)  | 99.8 (+1.3; 131 s)  | 99.3 (+0.8; 133 s)  | 98.5 (+0.0; 150 s)  | 98.5 (+0.0; 150 s)  |
| 2 buffalo v 12 lions                         | `allIn`     | 41.0 (157 s)  | 47.5 (+6.5; 135 s)  | 48.5 (+7.5; 138 s)  | 45.8 (+4.8; 130 s)  | 51.2 (+10.2; 138 s) | 41.0 (+0.0; 157 s)  | 39.3 (-1.7; 156 s)  |
| 3 buffalo v 20 lions                         | `allIn`     | 49.8 (132 s)  | 57.8 (+8.0; 125 s)  | 58.8 (+9.0; 126 s)  | 52.8 (+3.0; 119 s)  | 60.5 (+10.7; 126 s) | 49.8 (+0.0; 132 s)  | 48.0 (-1.8; 131 s)  |
| 3 buffalo v 30 hyenas                        | `allIn`     | 92.3 (71 s)   | 93.0 (+0.7; 71 s)   | 93.3 (+1.0; 71 s)   | 88.8 (-3.5; 71 s)   | 94.0 (+1.7; 71 s)   | 92.3 (+0.0; 71 s)   | 90.5 (-1.8; 71 s)   |
| 2 elephants v 60 lions                       | `allIn`     | 97.8 (148 s)  | 97.5 (-0.3; 148 s)  | 97.5 (-0.3; 148 s)  | 95.8 (-2.0; 148 s)  | 98.3 (+0.5; 148 s)  | 97.8 (+0.0; 148 s)  | 97.3 (-0.5; 148 s)  |
| 1 buffalo v 6 lions (`buffalo-pride`)        | `realistic` | 14.8 (166 s)  | 14.8 (+0.0; 166 s)  | 14.8 (+0.0; 166 s)  | 14.8 (+0.0; 166 s)  | 14.8 (+0.0; 166 s)  | 14.8 (+0.0; 166 s)  | 14.8 (+0.0; 166 s)  |
| 5 buffalo v 6 lions                          | `realistic` | 99.0 (112 s)  | 98.5 (-0.5; 107 s)  | 98.8 (-0.2; 107 s)  | 99.0 (+0.0; 106 s)  | 99.0 (+0.0; 107 s)  | 99.0 (+0.0; 112 s)  | 98.5 (-0.5; 113 s)  |
| 5 elephants v 30 lions (`elephants-pride`)   | `realistic` | 100.0 (106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 107 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) |
| 1 mammoth v 12 wolves (`mammoth-wolves`)     | `realistic` | 100.0 (77 s)  | 100.0 (+0.0; 77 s)  | 100.0 (+0.0; 77 s)  | 100.0 (+0.0; 77 s)  | 100.0 (+0.0; 77 s)  | 100.0 (+0.0; 77 s)  | 100.0 (+0.0; 77 s)  |
| 3 mammoths v 30 wolves                       | `realistic` | 100.0 (67 s)  | 100.0 (+0.0; 67 s)  | 100.0 (+0.0; 67 s)  | 100.0 (+0.0; 67 s)  | 100.0 (+0.0; 67 s)  | 100.0 (+0.0; 67 s)  | 100.0 (+0.0; 67 s)  |
| 3 white rhinos v 12 lions (sensitivity only) | `realistic` | 100.0 (106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 107 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) | 100.0 (+0.0; 106 s) |
| 2 buffalo v 12 lions                         | `realistic` | 41.8 (149 s)  | 48.0 (+6.2; 132 s)  | 49.0 (+7.2; 136 s)  | 45.8 (+4.0; 126 s)  | 51.5 (+9.7; 136 s)  | 41.8 (+0.0; 149 s)  | 40.0 (-1.8; 149 s)  |
| 3 buffalo v 20 lions                         | `realistic` | 48.5 (132 s)  | 56.5 (+8.0; 126 s)  | 58.3 (+9.8; 126 s)  | 51.0 (+2.5; 115 s)  | 60.0 (+11.5; 126 s) | 48.5 (+0.0; 132 s)  | 46.8 (-1.7; 130 s)  |
| 3 buffalo v 30 hyenas                        | `realistic` | 99.0 (66 s)   | 98.5 (-0.5; 66 s)   | 99.0 (+0.0; 66 s)   | 98.0 (-1.0; 66 s)   | 99.3 (+0.3; 66 s)   | 99.0 (+0.0; 66 s)   | 99.3 (+0.3; 66 s)   |
| 2 elephants v 60 lions                       | `realistic` | 100.0 (121 s) | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 118 s) | 99.8 (-0.2; 119 s)  | 100.0 (+0.0; 118 s) | 100.0 (+0.0; 121 s) | 100.0 (+0.0; 121 s) |

**Reading.**

- **The presets barely move.** `buffalo-pride` and `mammoth-wolves` are one animal against a pack, so B4 never holds and the results are bit-identical (guard 1). `elephants-pride` and the other large-herd cases were already at 98–100 % herd wins and stay there; only their durations shorten by a few seconds. No preset changes class or `close` tag.
- **The layer matters where a small herd is close to even.** 2 buffalo v 12 lions gains +6.5 pp (`allIn`) and +6.2 pp (`realistic`), 3 buffalo v 20 lions +8.0 pp in both modes, and the fights end 7–22 s sooner. That is the size of effect the field data support: a herd member next to others is safer [Hay 2008], not invulnerable.
- **H2 (rescue) carries the effect.** Alone it gives +10 to +11.5 pp in the close buffalo cases; it acts only while a lion is latched onto a herd-mate, which is exactly the situation the anecdotes describe.
- **H3 (numbers) cuts slightly against outnumbered herds,** −1.7 to −1.8 pp alone, and in the `high` variant (`k_h` 0.1, `c_max` 0.2) it eats most of H2's gain (3 buffalo v 20 lions +3.0 pp, 3 buffalo v 30 hyenas −3.5 pp in `allIn`). That is the two-sided rule of §3.2 working as written; option O2 (help-only) would remove it.
- **H1 (close ranks) never bound.** In every cell H1 alone gives the same win share and median duration as today: predators come to the herd, so no herd member had to chase past the leash. An earlier 40-run smoke test under model 1 showed the opposite risk, one stalled run (2.5 % draws) of 3 white rhinos v 12 lions that the leash held apart. H1 therefore adds code and a stall risk for no measured effect; O8 asks whether to ship it.
- **Both flight modes move alike.** The shifts in `allIn` and `realistic` agree within about 1 pp in every close case. The flight traits act against much larger enemies, and herds here face smaller ones, so the two layers barely interact; this supports O3 (a).
- **White rhino** (sensitivity only): +0.8 pp in `allIn`, nothing in `realistic`; the case is already one-sided.

Limits: one seed, 400 runs per cell, brute-force neighbour loops instead of the grid queries of §4, herd centre and support recomputed every tick instead of on the staggered refresh ticks, and no `T_grace` hysteresis. Real numbers come from the calibration section of §7.

## 6. UI and transparency

Same pattern as the pack buff ([FREE-MATCHUPS.md §6](FREE-MATCHUPS.md#6-ui-and-transparency)), so nothing new is learned by the viewer except the rules.

- **Badge.** `sideBuffState` (`src/ui/free-form-model.ts`) gains a state `herd`: a herd species with count ≥ 2 and any herd switch on shows "무리 방어 적용 / Herd defence active" (key `free.badge.herdActive`), and with every switch off "무리 방어 끔 / Herd defence off". A herd species of one shows nothing, as today. Non-herd, non-social species keep "개체 단독 행동 / Individuals act alone".
- **Popover.** `rules()` in `src/ui/free-mode.ts` lists the herd rules when either side is a herd species: activation (with this matchup's `R_herd`), H1 with `leash`, H2 with `R_rescue`, H3, deactivation and the line "Herd defence adds no damage". Keys `free.rules.herd.*` in `src/i18n/ko.ts` and `src/i18n/en.ts`. A species marked "inferred" (the mammoth, O1) gets a short note: "근거: 코끼리에서 추정 / Inferred from elephants".
- **Switches.** One checkbox per herd effect, shown only when a side is a herd species, next to the pack-buff switches (`buffSwitches()`), in Advanced only. Simple mode runs the defaults.
- **Results.** The existing "pack buff active: x % of agent-time" line reads "herd defence active: x %" for a herd side, from the same fields.
- **Replay.** The same thin ring in the side colour marks a herded agent; the legend reads "고리 = 무리 방어 적용 / ring = herd defence active" when the ringed side is a herd. No lines, no gore.
- **Model and parameters pages.** A model-page subsection "Herd defence" with the §3 tables and the §2 verdicts in short form; the parameters page lists the herd traits per species with their ranges and **S** tags, checked by the existing drift tests.
- **Korean wording** follows the no-particle-after-species rule ([SPECIES.md §9](../SPECIES.md#9-content-rules)); "무리 버프" stays the predators' term and "무리 방어" is the herd's, so the two never share a label.

## 7. Rollout

1. **New free model version.** The layer changes free results, so it ships as the next free `mv` (5, unless another model ships first) under [ADR-0008](../adr/0008-live-interventions-and-model-version.md) point 4. `HERD_SINCE_MV` gates every new code path; the species revision for that version sets `herd` and the herd traits. The card catalogue keeps model 1's (`CARDS_BY_MV[5]`). The classic engine is untouched.
2. **Old links stay identical.** Links and codes naming `mv` 1–4 run without the layer, bit for bit. No golden is regenerated: `free-v3-golden`, the social golden, `mv3-golden` and `mv4-golden` must pass unchanged, and a new `mv5-golden.json` with herd cases (5 elephants v 30 lions, 3 buffalo v 20 lions, a herd with every switch off) is captured at merge and also checked under JavaScriptCore.
3. **Presets re-checked.** `tests/fixtures/preset-shares-mv5.json` is measured with the layer on; every preset is re-checked against `PRESET_LIMITS` (duration, rout share, `close` tag). §5 predicts no change for the 1 v N presets and small shifts elsewhere. A herd preset (for example 3 buffalo v 20 lions, close in §5) is an owner option (O6).
4. **Calibration.** A new section in [research/CALIBRATION.md](../research/CALIBRATION.md), "Herd defence and free model 5 (#72)": both flight modes, the §5 matrix at full run counts, a one-at-a-time sweep of `R_herd`, `leash`, `R_rescue` and `k_h` over §3.3, the guards of §3.6, and a `--only herd` section in `scripts/calibration/run.mjs` writing `calibration-herd-mv5.json`.
5. **Docs.** SPECIES.md §11 gains "Herd traits" with the §3.3 table and the §2.1 evidence; §8 marks M4 implemented for herds; MODEL.md gains a "Herd defence (free model 5)" subsection; FREE-MATCHUPS.md §2.3 points here; ROADMAP marks #72.
6. **Phases.** P1 species flag, traits and config (no behaviour change, `mv` unchanged); P2 engine layer behind `HERD_SINCE_MV` with goldens and tests; P3 UI (badge, popover, switches, legend, i18n); P4 calibration and docs. Each is one PR with `npm run check` and the build green.

## 8. Owner decisions

| #   | Question                                                                  | Options                                                                              | Recommendation                                                                                                                     |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Which species get `herd`?                                                 | elephant, buffalo, mammoth; also white rhino; hippo and _Triceratops_ never (absent) | Elephant, buffalo, mammoth (marked "inferred"). White rhino not yet: the circle is not in a study we could read.                   |
| O2  | Magnitudes                                                                | §3.3 modes and ranges; H3 two-sided or help-only (`c ≥ 0`)                           | §3.3 modes, H3 two-sided like the pack buff                                                                                        |
| O3  | On by default in "끝까지 싸우기" (`allIn`) and "현실 모드" (`realistic`)? | (a) on in both; (b) on only in `realistic`; (c) off by default, opt-in switch        | (a): herd defence is a way of fighting, not of backing off, and the pack buff is on in both modes. §5 shows both modes move alike. |
| O4  | Stampede / flight contagion for herds                                     | none; or a herd twin of E4b in `realistic` only                                      | None in this version                                                                                                               |
| O5  | Shielding the young                                                       | deferred; or a new issue for a calf count per side                                   | Deferred to a new issue                                                                                                            |
| O6  | Simple-mode preset for herd defence                                       | none; or a "buffalo herd vs pride" preset (3 v 20, close in §5)                      | Add it after calibration if it stays close                                                                                         |
| O7  | Model version                                                             | the next free `mv`                                                                   | Yes, with old versions unchanged                                                                                                   |
| O8  | Ship H1 (close ranks)?                                                    | ship with H2 and H3; or leave it out until young are modelled (§3.5)                 | Leave it out: it never changed a result in §5 and can stall a fight; keep the rule written here for the calf work                  |

## 9. References

Accessed 2026-11-20. Access level as in SPECIES.md §3.1.

- **[Carbyn & Trottier 1987]** Carbyn L.N., Trottier T. Responses of bison on their calving grounds to predation by wolves in Wood Buffalo National Park. _Canadian Journal of Zoology_ 65:2072–2078. <https://doi.org/10.1139/z87-317> [Abs]
- **[Carbyn & Trottier 1988]** Carbyn L.N., Trottier T. Descriptions of wolf attacks on bison calves in Wood Buffalo National Park. _Arctic_ 41:297–302. <https://journalhosting.ucalgary.ca/index.php/arctic/article/view/64790> [Abs]
- **[Hay 2008]** Hay C.T., Cross P.C., Funston P.J. Trade-offs of predation and foraging explain sexual segregation in African buffalo. _Journal of Animal Ecology_ 77:850–858. <https://pubs.usgs.gov/publication/70000132> [Abs]
- **[IRF]** International Rhino Foundation. White rhinos: the most social rhinoceros. <https://rhinos.org/?p=4174> (conservation organisation page, not peer-reviewed)
- **[McComb 2011]** McComb K., Shannon G., Durant S.M., et al. Leadership in elephants: the adaptive value of age. _Proceedings of the Royal Society B_ 278:3270–3276. <https://pmc.ncbi.nlm.nih.gov/articles/PMC3169024/> [FT]
- **[Owen-Smith 1975]** Owen-Smith R.N. The social ethology of the white rhinoceros _Ceratotherium simum_. _Zeitschrift für Tierpsychologie_ 38:337–384. <https://doi.org/10.1111/j.1439-0310.1975.tb02010.x> [bibliographic record only; to be read before O1 is reopened]
- **[Pečnerová 2017]** Pečnerová P., Díez-del-Molino D., Dussex N., et al. Genome-based sexing provides clues about behavior and social structure in the woolly mammoth. _Current Biology_ 27:3505–3510. <https://ui.adsabs.harvard.edu/abs/2017CBio...27E3505P> [Abs]
- **[Power & Compion 2009]** Power R.J., Compion R.X.S. Lion predation on elephants in the Savuti, Chobe National Park, Botswana. _African Zoology_ 44:36–44. <https://doi.org/10.1080/15627020.2009.11407437> [Abs]
- **[Shrader 2013]** Shrader A.M., Perrin M.R. et al. Is a reduction in the individual vigilance of mothers a key evolutionary driver of group formation in white rhinos? _African Zoology_ 48:109–114. <https://repository.up.ac.za/handle/2263/31877> [Abs]
- **[Tambling 2012]** Tambling C.J., Druce D.J., Hayward M.W., et al. Spatial and temporal changes in group dynamics and range use enable anti-predator responses in African buffalo. _Ecology_ 93:1297–1304. <https://research.bangor.ac.uk/en/publications/spatial-and-temporal-changes-in-group-dynamics-and-range-use-enab/> [Abs]

Already cited in SPECIES.md or FREE-MATCHUPS.md: [MacNulty 2014], [Mathews 2009], [WP: African bush elephant], [WP: African buffalo], [WP: Woolly mammoth], [WP: Hippopotamus], [WP: Triceratops].
