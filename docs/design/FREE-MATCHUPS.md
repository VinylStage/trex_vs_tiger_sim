# Free matchups: any species on either side (design)

> **한국어 요약**
>
> - 이슈 [#50](https://github.com/VinylStage/trex_vs_tiger_sim/issues/50)의 설계 문서입니다. 구현은 아직 없습니다. 목표는 양쪽 진영 모두 어떤 종이든 고를 수 있게 하는 것입니다. 티라노 대 티라노 같은 같은 종 대결도 됩니다.
> - **권장 방식: 엔진을 두 갈래로 둡니다.** 지금의 대형/무리 엔진(`engine.ts`)은 "기존 모델"로 그대로 얼려 두고, v1/v2 링크와 기존 대결은 계속 이 엔진으로 돌립니다(골든 테스트가 비트 단위로 그대로 통과). 새 대칭 엔진(`engine-free.ts`)은 공유 링크 v3에서만 씁니다. 하나의 일반화 엔진으로 기존 결과를 비트 단위로 재현하는 방법도 검토했지만, 난수 호출 순서와 부동소수점 연산 순서까지 맞추려면 결국 `if (legacy)` 분기투성이가 되어 권하지 않습니다.
> - **대칭 모델:** 모든 개체가 같은 행동 모델(이동, 스태미나, 정면 공격, 떨쳐내기, 사기)을 쓰고, 값만 종마다 다릅니다. **매달리기**는 매달릴 수 있는 종이고 상대가 자기보다 3배 이상 무거울 때만 가능합니다(가정, 민감도 2–5배). 그렇지 않으면 정면 타격으로 싸웁니다. 맞으면 물러나는지는 몸무게 비율로 정하고, 맞을 때 잃는 사기는 받은 피해에 비례합니다.
> - **무리 버프:** `social` 종(사자, 늑대, 점박이하이에나, 호모 에렉투스)만 받습니다. 같은 진영에 살아 있는 동료가 결속 반경 안에 1마리 이상 있으면 켜지고, 그 조건이 2초 넘게 깨지면 꺼집니다. 효과 다섯 가지(협동 접근·포위, 공동 목표, 집단 매달리기, 사기 지원·전염, 교대)는 각각 따로 끌 수 있고 크기에 상한이 있습니다. 모든 수치는 출처를 달거나 가정(S)으로 표시하고 민감도 범위를 줍니다. 비사회성 종(호랑이, 불곰, 티라노 등)은 수가 많아도 이 효과가 전혀 없고, 같은 목표에 몰리면 서로 방해합니다.
> - **UI:** 양쪽 모두 "모든 종" 선택, 진영마다 "무리 버프 적용 / Pack buff active" 배지와 규칙 팝오버, 결과에 버프 활성 시간, 리플레이에서는 버프 받은 개체에 추상적인 고리 표시만 붙입니다.
> - 단계별 PR 계획(8단계)과 소유자에게 묻는 질문(권장 기본값 포함)은 §8, §9에 있습니다.

Status: **Proposed** (design only, no code). Issue: [#50](https://github.com/VinylStage/trex_vs_tiger_sim/issues/50) and its owner comment. Decision record: [ADR-0007](../adr/0007-symmetric-sides.md). Base: `main` at v0.2.2 (includes #24 and #47).

Evidence tags follow [SPECIES.md §3](../SPECIES.md#3-evidence-tags-and-formulas): **L** literature, **D** derived, **S** speculative / assumption, **U** unverified popular figure. Every new number in this document is either cited or tagged **S** with a sensitivity range, and every **S** number becomes a sampled triangular range (so it shows up in the tornado chart) unless noted.

## Contents

1. [Current model analysis](#1-current-model-analysis)
2. [Proposed data model](#2-proposed-data-model)
3. [Engine strategy](#3-engine-strategy)
4. [Combat in the symmetric model](#4-combat-in-the-symmetric-model)
5. [Pack buff rules](#5-pack-buff-rules)
6. [UI and transparency](#6-ui-and-transparency)
7. [Performance](#7-performance)
8. [Phased implementation plan](#8-phased-implementation-plan)
9. [Open questions for the owner](#9-open-questions-for-the-owner)
10. [References](#10-references)

## 1. Current model analysis

The engine is one function, `simulateBattle` in `src/sim/engine.ts`, with two hard-wired roles. Every array, every behaviour and every output is either "heavy" (`r*` arrays, index `i`) or "pack" (`t*` arrays, index `j`). Line numbers below are at v0.2.2 (`1e06e68`).

### 1.1 Heavy-only behaviour

| Behaviour                            | Where                                                                                    | Notes                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Frontal bite cone (attack)           | `engine.ts` 348–375 (`biteVisit`), 481–503 (cooldown, accuracy roll, damage)             | Only heavies attack with a strike. The latched-accuracy bonus (490–492) only targets pack animals. |
| Being latched, carry slowdown        | 437–445 (`rCarry`, `rLatched` per heavy), 469–478 (speed × `max(0.3, 1 − carried/mass)`) | Only heavies can be ridden.                                                                        |
| Shake-off / throw-off                | 619–629 (roll `rShake[h] × DT` inside the pack update), 621 (`throwDamageFrac`)          | A property of the host (`heavy.shakeRate`), evaluated on the rider.                                |
| Turn-limited heading                 | 465–467 (`turnRate × DT`), 474 (×0.5 above 60°)                                          | Pack animals have no heading at all.                                                               |
| Bleeding                             | 505 (`rWound × pack.bleed`), 617 (wound accrues only from pack dps)                      | Only heavies bleed; the coefficient comes from the **pack** side's parameter.                      |
| `hide`, `intimidation`               | 146–163 (`heavyMoraleEffects`), 184–187, 615 (`dps × DT × hide`)                         | Heavy species constants (`species.ts` 92–107).                                                     |
| Retarget to nearest free pack animal | 377–382, 450–460 (every 0.5 s, `heavyRetarget`)                                          | Latched animals are excluded from steering but preferred by the bite (370).                        |
| No stamina, no morale, never flees   | absent by construction                                                                   | MODEL.md §8 "Behaviour".                                                                           |
| Death resolved at end of tick        | 685–694                                                                                  | Pack animals die immediately (`kill`, 327–339).                                                    |
| Spawn in a line facing +x            | 226–245                                                                                  | `rCd`, `rTimer` draw RNG interleaved with the `indiv` draws.                                       |

### 1.2 Pack-only behaviour

| Behaviour                          | Where                                                                                                | Notes                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Latch (grab and hold)              | 587–602 (contact + `latchChance` roll), 605–635 (Latched: ride host, `dps`, latch stamina)           | Only pack animals latch, and only onto heavies, regardless of size.                                             |
| Approach tactics                   | 386–400 (`chooseHeavy`: flank load penalty, linear scan), 541–556 (flank aim point, danger sidestep) | `config.packTactic` applies to every pack species, including the solitary tiger (MODEL.md §3.6 "hypothetical"). |
| Sprint / cruise stamina            | 558–568, 578–582 (Exhausted → Recover)                                                               | Heavies move at one speed forever.                                                                              |
| Recover (disengage)                | 341–346 (`toRecover`), 636–653                                                                       | Any heavy hit sends the pack animal to Recover (498): a hit always detaches, whatever its size.                 |
| Morale, rout                       | 514–523 (rout check), 654–676 (Routed flee, Left)                                                    | `config.morale` (config.ts 31) affects only the pack side.                                                      |
| Morale shock on ally death         | 301–312 (`shockVisit`), 333–338                                                                      | Every pack species, social or not, loses `moraleLoss` when an ally dies within 40 m.                            |
| Intimidation (morale lost to hits) | 185–187, 498, 626                                                                                    | Per-hit constant 0.25 / 0.1 × the heavy's `intimidation`, independent of damage (SPECIES.md §7).                |
| Spawn in a disc                    | 272–293                                                                                              | Flank side `tSide` drawn per animal.                                                                            |

### 1.3 Asymmetry in data and outputs

- **Parameters** are role-prefixed: `heavy.*` (11) and `pack.*` (11), `params.ts` 19–42; the design matrix column order is fixed forever (SPECIES.md §6 rule 2).
- **Species** live in two registries with different key sets and constants: `species.ts` 14–39 (`HEAVY_KEYS`, `PACK_KEYS`), 43–51 (ids), 92–116 (`hide`/`intimidation` vs `radius`). _Homo erectus_ is registered twice under one id (308–328, 390–402).
- **Config**: `heavySpecies`/`packSpecies`, `heavyCount` ≤ 500 / `packCount` ≤ 5000, `packTactic`, `morale` (`config.ts` 17–43).
- **Outputs**: `Outcome = { Heavy, Pack, Draw }` (`engine.ts` 65), `RunSummary` fields `heavyAlive`, `packKilled`, `packRouted`, `heavyAdvantage` (68–79), trace frames `heavy` (x, y, heading, hp) vs `pack` (x, y, state) (81–87), `TraceMeta.reach/arc` per heavy only (90–99), events typed as heavy→pack or pack→heavy (`events.ts` 13–38).
- **Share**: payload v2 keys `heavy`, `pack`, `heavyCount`, `packCount`, `packTactic` (`src/ui/share.ts` 12, 16–28, 51–70); v1 is upgraded by renaming (92–127) and dispatched on `v` (138–140).
- **Consequence observed in calibration** (SPECIES.md §7): one heavy _H. erectus_ beats one pack _H. erectus_ in 79 % of runs and loses to two in 92 %: "the roles, not the species, decide this". A tiger latches onto a brown bear that weighs barely more than it does. These are the artefacts #50 removes.

## 2. Proposed data model

### 2.1 Two symmetric sides

```ts
// src/sim/free/config.ts (new)
export interface SideConfig {
  species: SpeciesId; // any species in the unified registry
  count: number; // 1..5000, see §7 for the total cap
  params: Record<TraitId, Triangular>; // this side's ranges, preset from `species`
}

export interface FreeConfig {
  mode: 'free';
  sides: readonly [SideConfig, SideConfig]; // A (left, blue), B (right, orange)
  packBuff: PackBuffSwitches; // §5.5, all true by default
  runs: number;
  seed: number;
  arenaSize: number;
  maxTime: number;
  sampling: SamplingMethod;
  individualCV: number;
  morale: boolean; // now applies to both sides
}

export type ScenarioConfig = LegacyConfig | FreeConfig; // LegacyConfig = today's interface + mode: 'legacy'
```

One species per side (mixed sides are an open question, §9). Both sides may pick the same species.

### 2.2 Unified trait set

Every species carries one full set of **individual traits**. The 22 legacy role parameters map onto it; traits that a role never needed get new presets (tagged honestly, mostly **S** or **D**).

| Trait id          | Unit  | Ind. | Legacy heavy source   | Legacy pack source                                | New presets needed for                                                    |
| ----------------- | ----- | :--: | --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `mass`            | kg    |  ✓   | `heavy.mass`          | `pack.mass`                                       | —                                                                         |
| `bodyRadius`      | m     |      | `heavy.bodyRadius`    | constant `radius` (degenerate triangle `r, r, r`) | —                                                                         |
| `turnRate`        | deg/s |  ✓   | `heavy.turnRate`      | none (pack has no heading)                        | every pack species (**S**)                                                |
| `sprintSpeed`     | m/s   |  ✓   | `heavy.speed`         | `pack.sprintSpeed`                                | —                                                                         |
| `cruiseSpeed`     | m/s   |  ✓   | none                  | `pack.cruiseSpeed`                                | heavies (**D** from walking-speed literature where it exists, else **S**) |
| `sprintEndurance` | s     |  ✓   | none (infinite)       | `pack.sprintEndurance`                            | heavies (**S**)                                                           |
| `recoveryTime`    | s     |  ✓   | none                  | `pack.recoveryTime`                               | heavies (**S**)                                                           |
| `strikeForce`     | kN    |  ✓   | `heavy.biteForce`     | none                                              | packs (**D**: the bite force behind `pack.dps`, SPECIES.md §3.2)          |
| `strikeLethality` | HP/kN |      | `heavy.biteLethality` | none                                              | packs (**S**)                                                             |
| `strikeInterval`  | s     |  ✓   | `heavy.biteInterval`  | none                                              | packs (**S**)                                                             |
| `strikeReach`     | m     |  ✓   | `heavy.biteReach`     | none (contact radius)                             | packs (**S**, geometry)                                                   |
| `strikeArc`       | deg   |  ✓   | `heavy.biteArc`       | none                                              | packs (**S**)                                                             |
| `strikeAccuracy`  | p     |  ✓   | `heavy.biteAccuracy`  | none                                              | packs (**S**)                                                             |
| `latchChance`     | p     |  ✓   | none                  | `pack.latchChance`                                | only species with `canLatch` (§4.2); others carry `0, 0, 0`               |
| `latchEndurance`  | s     |  ✓   | none                  | `pack.latchEndurance`                             | as above                                                                  |
| `latchDps`        | HP/s  |  ✓   | none                  | `pack.dps`                                        | as above                                                                  |
| `shakeRate`       | 1/s   |  ✓   | `heavy.shakeRate`     | none                                              | packs (**S**)                                                             |
| `bleed`           | 1/s   |      | none                  | `pack.bleed`                                      | heavies (**S**); bleed caused by wounds this side inflicts                |
| `morale`          | 0–1   |  ✓   | none                  | `pack.morale`                                     | heavies (**S**, high: they rarely flee)                                   |
| `moraleLoss`      | 0–1   |  ✓   | none                  | `pack.moraleLoss`                                 | heavies (**S**); used only by social species (§5)                         |

Plus non-sampled species constants carried over unchanged: `hide`, `intimidation` (now defined for every species; 1 unless already set), and the new flags `social` and `canLatch` (§2.3, §4.2). Social species also carry the pack-buff traits of §5.3, sampled like any other trait.

For _Homo erectus_ the two existing role presets merge: mass is identical; heavy strike traits and pack latch traits are kept from the respective roles; `bodyRadius` uses the heavy triangle 0.2–0.3 m.

**Mapping onto a side.** A side's `params` is filled from `species` exactly as today's `speciesRanges` does, with trait ids that are side-local (`mass`, not `heavy.mass`). Both sides use the same trait list, so a mirror matchup simply has two copies of one preset. The free design matrix has `2 × T + G` columns (`T` = traits incl. pack-buff traits, `G` = the five sampled global model constants `R_latch`, `K_knock`, `woundRef`, `interference`, `T_grace`) in the order "all side-A traits, all side-B traits, then the globals". Inactive traits (pack buff for a non-social side, latch traits for a non-latching species) still get a column, so the column layout depends only on the trait list, never on the species, and consume no battle RNG.

### 2.3 Which species are social

`social` means **a cooperative group hunter or group fighter**, the trait the owner asked for ("무리동물일 시에"). It is not "lives in groups": elephants, buffalo and mammoths are gregarious but defend as a herd rather than hunt as a pack; herd defence is mechanic M4 (SPECIES.md §8), a separate future layer (§9 Q2).

| Species                    |        `social`        | Evidence                                                                                                                                                                                                                                                                                                     |
| -------------------------- | :--------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lion                       |          yes           | Coordinated "wing"/"centre" roles [Stander 1992]; females hunt in the largest group they can form and larger groups repel smaller ones in territorial disputes [Packer 1990]; lionesses assess opponents' numbers from roars [McComb 1994] (title confirmed; findings as recalled, to be re-read before P4). |
| Gray wolf                  |          yes           | Group-size effects on hunting bison (plateau at 9–13) [MacNulty 2014] and elk (plateau above 4, attributed to free riding) [MacNulty 2012]; larger packs win interpack fights [Cassidy 2015].                                                                                                                |
| Spotted hyena              |          yes           | Discriminates one, two or three callers and is more cautious when outnumbered [Benson-Amram 2011, via press release]; mobbing of lions increases with the number of hyenas present [Lehmann 2017]; prevails over lionesses at ≥ 4 : 1 [WP, SPECIES.md §4.8].                                                 |
| _Homo erectus_             |      yes (**S**)       | Ileret footprints of > 20 individuals indicate multi-male groups moving together [Hatala 2016]. Cooperative fighting itself is not observable in the fossil record, so all buff values for it are **S** and lower than for the carnivores.                                                                   |
| Tiger                      |           no           | Solitary; coordinated multi-tiger attacks are undocumented [Schaller 1967; MODEL.md §3.6].                                                                                                                                                                                                                   |
| Brown bear                 |           no           | Solitary [WP: Brown bear; research/SPECIES.md §4].                                                                                                                                                                                                                                                           |
| _T. rex_                   |           no           | Assumed solitary [research/SPECIES.md §4]; group behaviour in tyrannosaurids is debated and no group hunting is demonstrated.                                                                                                                                                                                |
| Elephant, buffalo, mammoth | no (for the pack buff) | Herd animals that defend collectively but do not hunt cooperatively (SPECIES.md §4.2, §4.3, §4.9). A future `herd` layer would cover mobbing and rescue (M4).                                                                                                                                                |

### 2.4 Config and share schema v3

- `SHARE_VERSION` becomes 3. Dispatch in `decodeConfig` (share.ts 138–140): `v` missing or < 2 → `upgradeV1` → legacy; `v === 2` → legacy (unchanged code path); `v >= 3` → `sanitizeFreeConfig`.
- v3 payload, diffed against defaults and species presets like v2:

  ```json
  {
    "v": 3,
    "a": { "sp": "lion", "n": 5, "p": { "latchDps": [3, 8, 15] } },
    "b": { "sp": "tiger", "n": 5 },
    "buff": { "relief": false }
  }
  ```

  Scalar keys (`runs`, `seed`, `arenaSize`, `maxTime`, `sampling`, `individualCV`, `morale`) are shared with v2. Unknown species fall back to the default free matchup; unknown trait ids are dropped; ranges are clamped to the species' bounds.

- **v1 and v2 stay bit-identical** because they never reach new code: they decode to a `LegacyConfig` and run the frozen legacy engine. `tests/v1-golden.test.ts`, `tests/v2-golden.test.ts` and the #47 golden (`tests/fixtures/species-47-golden.json` via `intimidation.test.ts`) are untouched and must pass at every phase.
- `encodeConfig` writes v2 for a legacy config and v3 for a free config, so re-sharing an old link keeps it old.
- Length stays under `MAX_SHARE_LENGTH` (8,192): a v3 payload overriding every trait on both sides is about 2 × 26 × 30 bytes ≈ 1.6 kB before base64.

## 3. Engine strategy

### 3.1 Options

**Option A, dual path (recommended).** Freeze `engine.ts` as the legacy engine. Add `src/sim/engine-free.ts` with the symmetric model of §4–§5. `montecarlo.ts` dispatches on `config.mode`. Shared, already-pure helpers (`SpatialGrid`, `EventLog`, `Rng`, `individualFactor`, `wrap`, `len`) are reused, not copied.

**Option B, one generalized engine.** Rewrite `simulateBattle` for two symmetric sides and prove that, for every legacy config, it reproduces today's output bit for bit.

### 3.2 What Option B would have to reproduce

- **RNG call order**: per heavy, `indiv` draws interleaved with the cooldown and timer draws (232–243); then per pack animal two disc draws, eleven `indiv` draws, a timer draw and a side draw (273–293); in the tick, bite rolls inside the heavy loop (493–494) and latch and shake rolls inside the pack loop (588, 619), in index order, heavies first.
- **Floating-point expression order**: e.g. `rHp[h] − dps × DT × hide` (615), `woundMoraleLoss × intimidation` (159), `min(stepLen, aimDist)` in flank but `max(0, dist − contact)` in direct (570–575). Any reassociation changes low bits and, through the clamps and thresholds, eventually outcomes.
- **Sequential, asymmetric tick order** (heavies move and bite before pack animals act; the heavy grid is rebuilt mid-tick, 507), end-of-tick heavy death vs immediate pack death, flank-load linear scan, spawn geometry, trace layout (`heavy`/`pack` frames) and the event semantics.

A generalized engine that satisfies all of this is the legacy engine plus a `legacy` flag on every one of these branches, and it cannot adopt the fairness changes the symmetric model needs (simultaneous resolution, per-side RNG, §4.6). It would also carry the cost of those branches in the hot loop of every legacy run.

### 3.3 Trade-offs and recommendation

| Criterion                | A: dual path                                                                        | B: generalized engine                                              |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Risk to v1/v2 goldens    | None: legacy code is not edited                                                     | High: every refactor risks a low-bit change                        |
| Freedom in the new model | Full (simultaneous resolution, per-side RNG, new spawn)                             | Constrained to what can coexist with the legacy order              |
| Code size                | +≈ 900 lines (`engine-free.ts`), legacy unchanged                                   | Smaller in total, but one file full of mode branches               |
| Maintenance              | Two engines; but legacy is frozen anyway, because any legacy fix breaks the goldens | One engine, harder to read; every change must re-prove legacy      |
| Replay / outputs         | Two trace versions (2 legacy, 3 free) to render                                     | One trace format, but it must still emit legacy frames for goldens |
| Performance              | Legacy unchanged; free engine tuned independently                                   | Mode branches in the hot loop for both                             |

**Recommendation: Option A.** The decisive point is that the legacy engine is already frozen in practice: SPECIES.md §6 forbids any change that moves a v1/v2 result, so "maintaining two engines" means maintaining one. The new engine can then be designed for fairness and clarity from scratch, and its own golden fixture (captured when it ships) protects v3 links the same way.

Mitigations for the duplication: share all pure helpers; keep the free engine's agent state in one set of SoA arrays indexed `0 … nA+nB−1` (side A first) so it is not itself duplicated per side; document both models in MODEL.md as "Classic model" (legacy) and "Free model".

## 4. Combat in the symmetric model

Every agent runs the same state machine: **Approach → (Engaged | Latched) → Recover → Approach**, with **Routed → Left** and **Dead** as exits. "Engaged" means in strike range and facing the target; there is no separate state for it, it is Approach with the target inside the strike cone.

### 4.1 Movement and targeting (individual layer)

- Every agent has a heading limited by `turnRate × DT` and the ×0.5 turn penalty above 60° (as legacy heavies, 465–474).
- Speed: `sprintSpeed` within `sprintTriggerDistance` (60 m) of the target, draining `DT / sprintEndurance` stamina; `cruiseSpeed` beyond, regaining stamina at the cruise rate (as legacy pack, 558–568). Exhaustion → Recover.
- Carry slowdown `max(0.3, 1 − Σ rider mass / own mass)` applies to any agent with riders.
- Target: the nearest present enemy, re-evaluated every 0.5 s or when the target dies, routs or leaves (legacy heavy rule with `heavyRetarget`; one interval for everyone avoids a role-like asymmetry).
- Approach is direct: steer toward the target and stop at strike reach `0.8 × strikeReach` (legacy heavy) or at contact for an agent that will try to latch. Flanking exists only as a pack-buff effect (§5).

### 4.2 Latching by body-size ratio

Latching (grab, hold, ride) is possible only if both hold:

1. The attacker species has `canLatch` (felids, canids, hyena, _H. erectus_ grip). Heavies that never ride prey (_T. rex_, elephant, buffalo, mammoth, brown bear) have `canLatch = false` and fight with strikes only.
2. **Size ratio** `ρ = target mass / attacker mass ≥ R_latch`. `R_latch` = **3** (**S**, sensitivity 2–5).

Why 3: every documented latch in the roster is on prey at least about 3–4 times heavier: lions on buffalo (600 / 150 ≈ 4), wolves on a brown bear (220 / 42 ≈ 5) or on elk and bison [MacNulty 2012, 2014], hyenas on buffalo (≈ 11), all legacy pack-vs-_T. rex_ pairs (≈ 40+). Between animals of similar size the fight is a bite-and-strike exchange, not a ride. Consequences: 1 _T. rex_ vs 1 _T. rex_, 5 tigers vs 5 lions and lion vs lion never latch; 10 wolves vs 1 bear latch as today; 1 tiger vs 1 bear (ρ ≈ 1.2) becomes a strike duel instead of the legacy latch (which SPECIES.md §7 flagged as a handicap for solo attackers).

`R_latch` is one global constant, sampled per run like the others (`individual: false`), so its effect is visible in the tornado chart. The ratio is checked at the moment of the latch roll with both individuals' actual masses.

### 4.3 Strikes

Every agent strikes from a frontal cone exactly like the legacy heavy bite (cooldown `strikeInterval`, reach `strikeReach + target radius`, half-angle `strikeArc`, hit with `strikeAccuracy`, damage `strikeForce × strikeLethality × U(0.7, 1.3)`), against any enemy, latched riders on itself included (with the legacy ×1.5 latched-accuracy bonus, cap 0.95). A latched agent does not strike; it deals `latchDps × DT × target.hide` instead (legacy 615).

**What a hit does to the target** (generalizes the legacy "every heavy hit detaches and sends to Recover", 498):

- **Knock-back.** The target is forced into Recover with the minimum time `recoverMinTime × attacker.intimidation` only if `attacker mass ≥ K_knock × target mass`, `K_knock` = **2** (**S**, 1.5–4). A latched rider is always at least `R_latch` = 3 times lighter than its host, so a host's hit still always detaches its rider, as in legacy. A tiger hit by a lion stays engaged.
- **Morale.** `woundMoraleLoss × attacker.intimidation × min(1, damage / (woundRef × target max HP))`, `woundRef` = **0.1** (**S**, 0.05–0.2). A blow that takes 10 % of HP or more costs the full 0.25; a bare-hand hit costing a 180 kg tiger 1 HP costs it about 0.014. This replaces the per-hit constant that SPECIES.md §7 identified as the cause of hominins routing tigers, without needing `intimidation` as a patch (it stays, at its current values, as a species constant).
- **Wounds and bleeding.** All damage taken (strike and latch) adds to `wound`; each tick the agent loses `wound × enemySide.bleed × DT` (legacy 505, with the coefficient of the side that inflicted the wounds).

### 4.4 Shake-off

Any agent with riders rolls `shakeRate × DT` per rider per tick (legacy 619). A thrown rider loses `throwDamageFrac` (10 %) of its max HP, goes to Recover and is pushed 3 m, with morale loss `throwMoraleLoss × host.intimidation`.

### 4.5 Fleeing

With `morale` on, every agent routs below `routThreshold` (0.2) and flees as the legacy Routed state (654–676), on both sides. Large animals get high, **S** morale presets and lose morale mainly through heavy wounds (§4.3), so a _T. rex_ routs only when badly hurt. With `morale` off nobody routs. Non-social species are **not** affected by allies' deaths or routs (no morale shock): that shock is part of the pack layer (§5, E4), because the legacy shock applied to the solitary tiger only by virtue of its role.

### 4.6 Fairness: simultaneous resolution

Mirror matchups must not favour side A because of update order. Each tick:

1. Rebuild one spatial grid per side (present agents).
2. Refresh pack-buff status (§5.1; staggered, §7).
3. **Move phase**: every agent computes its new heading and position from the start-of-tick snapshot into a second buffer; buffers swap at the end of the phase.
4. **Act phase**: strike, latch and shake rolls against the moved positions; damage, morale deltas and state requests go into per-agent accumulators, never directly into HP.
5. **Apply phase**: apply accumulated damage (sums commute), then deaths, then knock-backs, throws and routs, then emit events in agent index order.

Randomness comes from two streams, `deriveSeed(seed, run, SALT_A)` and `deriveSeed(seed, run, SALT_B)`, each consumed only by its own side in index order. Adding or removing an agent on one side therefore never shifts the other side's random numbers.

### 4.7 Matchup shapes

| Shape                    | What happens                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large vs large (1 v 1)   | Both approach, turn to face, exchange strikes. Turn rate, reach and arc matter (who gets the other into the cone first). No latching (ρ < 3).      |
| Small vs small           | Same as large vs large at a smaller scale; stamina matters more, knock-back happens when one side is twice as heavy.                               |
| Many large vs many large | Each agent picks its own nearest enemy. Non-social crowds suffer interference (§5.6); social sides coordinate when the buff is active.             |
| Mirror (same species)    | Identical presets, independent individual variation. Over many runs P(A) ≈ P(B) (tested, §8 P3).                                                   |
| Many small vs one large  | Small `canLatch` attackers with ρ ≥ 3 latch and ride; the large animal strikes riders and shakes them off. This is the legacy dynamic, re-derived. |

## 5. Pack buff rules

The pack buff is a separate layer on top of the individual model. It is evaluated **per agent**: within one side some members can be buffed while a straggler is not.

### 5.1 Activation (all must hold)

| #   | Condition                                                                                           | Value                                              | Basis                                      |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| A1  | The side's species has `social = true`                                                              | §2.3                                               | Literature per species                     |
| A2  | The pack-buff master switch is on, and the effect's own switch is on (§5.5)                         | default on                                         | Owner requirement (each effect switchable) |
| A3  | The agent is present and not Routed                                                                 | —                                                  | —                                          |
| A4  | At least `N_min − 1` present, non-routed allies are within the cohesion radius `R_coh` of the agent | `N_min` = **2** (owner); `R_coh` per species, §5.3 | Owner comment on #50; `R_coh` **S**        |

A side of one never activates the buff, and a side whose survivors drift apart loses it member by member.

### 5.2 Effects (each bounded, each switchable)

| Effect                                       | Rule while active                                                                                                                                                                                                                                                                                               | Magnitude (default, range)                                                              | Basis                                                                                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1 Coordinated approach (flank/encircle)** | Buffed attackers of one target take angular slots around it, centred on its rear: slot `k` of `n` at `heading + π + (k − (n−1)/2) × Δ`, `Δ = min(2π/n, flankOffset)`. Inside the target's strike cone + `dangerArcPad` they sidestep out of it (legacy flank rule, 544–553). Unbuffed agents approach directly. | `flankOffset` 0.6 rad, `dangerArcPad` 20°, `dangerMargin` 4 m: legacy constants (**S**) | Wing/centre positions [Stander 1992]; ethogram approach → attack-group → attack-individual [MacNulty 2014]. Geometric rule, no damage bonus.                                                  |
| **E2 Shared target**                         | Buffed agents score enemies by `distance − focusBonus × (buffed allies already engaged on it)`; members within `R_coh` adopt the group's target and switch together when it dies, routs or leaves. Riders per target are capped by geometry: `floor(2π (R_t + r_a) / (2 r_a))`.                                 | `focusBonus` **20 m** (**S**, 0–40)                                                     | "Attack-individual" phase, one prey selected [MacNulty 2014]. Mirrors the legacy `flankLoadPenalty` 20 m with the opposite sign.                                                              |
| **E3 Group latching**                        | Latch chance of a buffed agent onto a target that already has `k` buffed riders: `min(cap × base, base × (1 + g × k))`. Each buffed rider also slows its host's turn rate: `× max(0.5, 1 − 0.1 k)`.                                                                                                             | `g` per species §5.3 (**S**, 0–0.5); `cap` **2** (**S**, 1.5–3); turn floor 0.5 (**S**) | Capture success rises with group size and plateaus [MacNulty 2014: 9–13 wolves on bison; MacNulty 2012: > 4 on elk]; the cap reproduces the plateau at about 4 riders.                        |
| **E4a Morale support (numbers)**             | Effective morale for the rout check is `morale + c`, `c = clamp(k_c × ln((a + 1) / (e + 1)), −c_max, +c_max)`, `a` = buffed allies and `e` = enemies within `moraleRadius` (40 m). Courage rises when outnumbering, falls when outnumbered.                                                                     | `k_c` **0.05** (**S**, 0–0.1); `c_max` **0.1** (**S**, 0–0.2)                           | Numbers assessment in lions [McComb 1994], hyenas [Benson-Amram 2011]; larger wolf packs win [Cassidy 2015]; hyena mobbing rises with numbers [Lehmann 2017]. Implements M11 (SPECIES.md §8). |
| **E4b Morale contagion**                     | When an ally dies within `moraleRadius`, every buffed agent in range loses its own `moraleLoss` (the legacy shock, 301–312, now social-only). When an ally routs within `R_coh`, each buffed agent in range loses `routShock`.                                                                                  | `moraleLoss`: species preset (existing **S**); `routShock` **0.05** (**S**, 0–0.1)      | Assumption; the legacy shock already models losses near a death.                                                                                                                              |
| **E5 Relief (rotation)**                     | A buffed rider whose stamina falls below `reliefStamina` releases without morale loss if a buffed ally within `R_coh` is in Approach with stamina ≥ `resumeStamina` (0.8); that ally gets the released rider's target with priority.                                                                            | `reliefStamina` **0.3** (**S**, 0.2–0.5)                                                | Assumption. Avoids the stamina-release gap the legacy model has; no direct field measurement.                                                                                                 |

Nothing in the buff adds raw damage per second. The buff changes **who attacks whom, from where, how often a grab succeeds and how long courage lasts**, which keeps it defensible and keeps `latchDps` and `strikeForce` the individual traits they are.

### 5.3 Per-species pack-buff traits

All sampled triangulars `min / mode / max`, `individual: false`, tag **S** unless stated.

| Species        | `R_coh` (m)   | `g` group latch  | `focusBonus` (m) | `k_c`           | `routShock`    | `reliefStamina` |
| -------------- | ------------- | ---------------- | ---------------- | --------------- | -------------- | --------------- |
| Lion           | 30 / 60 / 100 | 0.1 / 0.25 / 0.4 | 0 / 20 / 40      | 0 / 0.05 / 0.1  | 0 / 0.05 / 0.1 | 0.2 / 0.3 / 0.5 |
| Gray wolf      | 30 / 60 / 120 | 0.1 / 0.3 / 0.5  | 0 / 20 / 40      | 0 / 0.05 / 0.1  | 0 / 0.05 / 0.1 | 0.2 / 0.3 / 0.5 |
| Spotted hyena  | 30 / 60 / 120 | 0.1 / 0.3 / 0.5  | 0 / 20 / 40      | 0 / 0.06 / 0.1  | 0 / 0.05 / 0.1 | 0.2 / 0.3 / 0.5 |
| _Homo erectus_ | 15 / 30 / 60  | 0 / 0.15 / 0.3   | 0 / 15 / 30      | 0 / 0.04 / 0.08 | 0 / 0.05 / 0.1 | 0.2 / 0.3 / 0.5 |

`N_min` = 2 and the cap `2` are global. The hyena's slightly higher `k_c` mode reflects the numbers-dependent courage documented for it; _H. erectus_ is lower everywhere because cooperative fighting is not observable in its record.

**Calibration guard.** SPECIES.md §7 found the wolf-vs-buffalo group-size curve already plateaus near 9–13 wolves **without** any group rule ("herd effects emerge"). The buff must not double-count that: P4 acceptance requires the free-model wolf-vs-buffalo curve, buff on, to keep its plateau inside 9–13 [MacNulty 2014], and the buff magnitudes above are to be lowered if it moves.

### 5.4 Deactivation

| Trigger                          | Rule                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Too few allies / out of cohesion | A4 false continuously for `T_grace` = **2 s** (**S**, 0–5): buff off for that agent. The grace period avoids flicker at the radius edge. Re-activation is immediate when A4 holds again. |
| Agent routs or dies              | Buff off at once (A3).                                                                                                                                                                   |
| Target lost                      | The buff stays on; E2 picks a new shared target and E1 recomputes slots. Riders released by the target's death go to Recover as in legacy (608–610).                                     |
| Morale break cascade             | E4b can push allies below the rout threshold; each rout removes an ally from A4 for the others, so a broken pack loses the buff progressively. No extra rule.                            |
| Last survivor                    | Has no ally, so A4 is false: it fights with individual traits only.                                                                                                                      |

### 5.5 Switches and the individual-only identity

`packBuff = { coordinate, focus, groupLatch, morale, relief }`, all `true` by default, plus the global `morale` toggle (§4.5). E4a and E4b are switched together by `morale`. **With every switch off, a social side behaves bit-identically to the same species with `social = false`**: the buff code paths draw no random numbers and the only shared branch (interference, §5.6) applies to every unbuffed agent. This is a test (§8 P4).

### 5.6 Non-social crowds

A non-social species gets **none** of E1–E5, at any count: each agent targets its own nearest enemy, approaches directly, has no morale support and feels no allies' deaths or routs. Crowding instead **interferes**: when `k ≥ 2` unbuffed allies are within strike reach of the same target, each one's strike accuracy and latch chance are multiplied by `1 / (1 + interference × (k − 1))`, `interference` = **0.1** (**S**, 0–0.3). The same rule applies to a social agent whose buff is inactive, which is what makes §5.5 hold. Basis: assumption; even wolves show falling individual effort as group size grows [MacNulty 2012], and uncoordinated animals obstruct each other at a target.

## 6. UI and transparency

- **Pickers.** The two species selects become "Side A" / "Side B" (ko: "진영 A" / "진영 B"), each listing every species with the existing extant/extinct optgroups, plus a count field per side. Changing a species resets that side's ranges (as today, `form.ts` 191–193).
- **Classic links.** A v1/v2 link opens the classic heavy/pack form with a "Classic model / 기존 모델" note and a button "Open in free model / 자유 대결로 열기" that maps heavy → A and pack → B (results will differ, and the button says so).
- **Pack-buff badge.** Next to each side's count: "무리 버프 적용 / Pack buff active" when the species is social and the count ≥ 2; "개체 단독 행동 / Individuals act alone" for a non-social species with count ≥ 2; nothing for a count of 1. The badge opens a popover with the rule table of §5.1–§5.4 in short form (activation, five effects with their current modes, deactivation), the switches, and a link to the model page section. All strings in `i18n.ts` for ko and en; Korean strings follow the no-particle-after-species rule (SPECIES.md §9).
- **Presets.** Add same-species presets, e.g. 1 _T. rex_ vs 1 _T. rex_, 5 tigers vs 5 lions, 10 wolves vs 1 brown bear, 8 wolves vs 8 wolves.
- **Matchup badge.** `matchupClass` takes an unordered pair; same species gets a new class `intraspecific` ("같은 종 대결 / Same-species match-up"), with sourced notes where fights between conspecifics are documented (wolf interpack fights [Cassidy 2015]; face-biting injuries in tyrannosaurids [Peterson 2009, MODEL.md refs]).
- **Results.** Per side: wins, survivors, incapacitated, fled, and **"pack buff active: x % of agent-time (mean), y s with at least one buffed member (median)"**. `RunSummary` for the free engine adds `aBuffFrac`, `bBuffFrac` (buffed agent-ticks / present agent-ticks) and `aBuffTime`, `bBuffTime`.
- **Replay.** Glyphs stay abstract and side-coloured (A blue, B orange). Shape follows size, not role: body radius ≥ 1 m → heading triangle scaled from the radius (as the heavy glyph), smaller → dot sized from the radius. A buffed agent gets a thin ring in its side colour; no lines, no gore. Legend: "ring = pack buff active / 고리 = 무리 버프 적용". Trace v3 carries a per-frame flag byte and two new P0 events `BuffOn`, `BuffOff` so the ring is exact between frames.
- **Parameters page.** Lists the pack-buff traits per social species (§5.3) and the global constants (`R_latch`, `K_knock`, `woundRef`, `interference`, `T_grace`), checked against the registry by the existing drift tests.

## 7. Performance

- **Work budget.** `workEstimate = runs × steps × (nA + nB)` (config.ts 101–105) carries over unchanged. Proposed side limits: each side 1–5,000, total ≤ 5,500 (the legacy maximum 500 + 5,000), so the event log's 16-bit agent index (`EVENT_MAX_INDEX` 65,534) and the trace float budget stay valid. If P3/P4 benchmarks show the free engine is more than 1.25× the legacy cost per agent-step, add a constant `FREE_WORK_WEIGHT` to the estimate rather than lowering `MAX_WORK`.
- **Neighbour queries.** New queries per agent: nearest enemy (as today, `SpatialGrid.nearest`), strike-cone candidates (as today, `query` with the reach), and for social sides the cohesion count and the morale counts. A naive cohesion count is O(n × k): 5,000 wolves in the legacy spawn disc (radius 120 m at L = 600) give about 870 allies within 60 m, ≈ 4 M visits per tick. Mitigations, all required:
  1. Add `SpatialGrid.countWithin(x, y, r, cap, filter)` with early exit at `cap`. A4 needs only `N_min − 1` = 1 ally; E4a caps `a` and `e` at 32 (the log term barely changes beyond: `ln 33` vs `ln 65`), so a query costs O(cap).
  2. Refresh buff status every 5 ticks (0.5 s), staggered by agent index (`(i + step) % 5 === 0`); `T_grace` (2 s) is far longer than the refresh period.
  3. E2 slot assignment per target is kept in a per-target counter updated in the apply phase, not recomputed by scanning.
- **Grids.** One grid per side, rebuilt every tick (two grids, as legacy). The legacy flank-target linear scan over heavies (386–400) is not carried over; E2 uses the grid.
- **Gate.** P4 ships only if the free engine at 10 v 100, 50 v 1,000 and 500 v 5,000 (lions vs elephants and wolves vs _T. rex_ analogues) stays within 1.5× the legacy ms/run measured with the PERFORMANCE.md method.

## 8. Phased implementation plan

Each phase is one PR. Every PR runs the full `npm run check`; the v1, v2 and #47 goldens must pass unchanged in every phase.

| Phase | PR                                              | Content                                                                                                                                                                           | Tests                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0    | `docs(design)`                                  | This document and ADR-0007.                                                                                                                                                       | `npm run check` (markdown formatting, pages).                                                                                                                                                                                                                                                                                              |
| P1    | `feat(species): unified trait presets`          | Research and fill missing traits (§2.2) for every species, `social`, `canLatch`, pack-buff traits (§5.3); SPECIES.md tables. Legacy registries untouched.                         | Species tests: every species has every trait, presets inside bounds, evidence tags present; legacy `HEAVY_SPECIES`/`PACK_SPECIES` deep-equal to v0.2.2 snapshots.                                                                                                                                                                          |
| P2    | `feat(sim): free config and design`             | `FreeConfig`, `sanitizeFreeConfig`, trait list, `buildDesign` generalized over a param list (legacy call keeps `PARAMS`).                                                         | Sanitize/clamp tests; design determinism; legacy `designHash` in goldens unchanged.                                                                                                                                                                                                                                                        |
| P3    | `feat(sim): symmetric engine, individual layer` | `engine-free.ts` §4 without the buff; `montecarlo` dispatch; free `RunSummary`.                                                                                                   | Mirror test (2,000 runs, P(A) and P(B) within each other's 95 % CI); side swap (swapped config gives the mirrored win split within CI); no latch when ρ < `R_latch`; trace on/off identical summaries; RNG isolation (adding a B agent leaves A's draws unchanged); new golden `free-v3-golden.json` captured at merge, never regenerated. |
| P4    | `feat(sim): pack buff layer`                    | §5: activation, five effects, deactivation, interference, buff-time metrics, `countWithin`.                                                                                       | Never active for non-social species or a group of one; each switch isolates its effect; **all switches off ≡ `social = false` bit-identical**; activation/deactivation scenarios (cohesion edge, grace, last survivor); calibration guard (wolf-vs-buffalo plateau 9–13); performance gate §7; extend the free golden.                     |
| P5    | `feat(share): v3 links`                         | Encoder/decoder v3, worker protocol, aggregate per side.                                                                                                                          | v1/v2 goldens; v3 round trip; malformed v3 → defaults; length limit; v2 re-encodes as v2.                                                                                                                                                                                                                                                  |
| P6    | `feat(ui): free matchups`                       | Side pickers, badge and popover, presets incl. mirror matchups, results buff time, matchup class `intraspecific`, i18n ko/en.                                                     | species-ui, i18n key parity, form-notes, verdict wording tests; pages drift tests.                                                                                                                                                                                                                                                         |
| P7    | `feat(replay): trace v3`                        | Size-based glyphs, buff ring, legend, `BuffOn`/`BuffOff` events.                                                                                                                  | replay-world, glyph raster, events-determinism (event log changes no summary), legacy trace v2 rendering unchanged.                                                                                                                                                                                                                        |
| P8    | `docs: free model`                              | MODEL.md "Free model" section, SPECIES.md social table and calibration runs (mirror matchups, 5 tigers vs 5 lions, 10 wolves vs 1 bear), parameter pages, PERFORMANCE.md numbers. | pages tests; calibration table regenerated from the shipped engine.                                                                                                                                                                                                                                                                        |

## 9. Open questions for the owner

| #   | Question                                                                     | Recommended default                                                                                                                                    |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Which model does the bare page (no link) open with?                          | Keep the classic 10 _T. rex_ vs 100 tigers until P8 calibration is done, then switch the default to the free model. Old links stay classic either way. |
| Q2  | Should herd animals (elephant, buffalo, mammoth) get a group effect?         | Not in #50. They are `social = false` for the pack buff; herd defence (mobbing, rescue, M4) becomes its own issue.                                     |
| Q3  | Is _Homo erectus_ social?                                                    | Yes, with lower **S** values (§5.3), based on group footprints [Hatala 2016].                                                                          |
| Q4  | Mixed species on one side (e.g. 5 lions + 10 hyenas)?                        | No: one species per side in v3; revisit later.                                                                                                         |
| Q5  | Should large animals (_T. rex_, elephant) be able to flee in the free model? | Yes, with high morale presets and damage-scaled morale loss; the `morale` toggle turns fleeing off for both sides.                                     |
| Q6  | Latching threshold `R_latch`.                                                | 3× heavier target (sampled 2–5).                                                                                                                       |

## 10. References

New in this document (accessed 2026-10-20; access level as in SPECIES.md §10):

- **[Benson-Amram 2011]** Benson-Amram S., Heinen V.K., Dryer S.L., Holekamp K.E. Numerical assessment and individual call discrimination by wild spotted hyaenas, _Crocuta crocuta_. _Animal Behaviour_ 82:743–752. [Abs: MSU press release and ScienceDaily summary, <https://msutoday.msu.edu/news/2011/hyenas>]
- **[Cassidy 2015]** Cassidy K.A., MacNulty D.R., Stahler D.R., Smith D.W., Mech L.D. Group composition effects on aggressive interpack interactions of gray wolves in Yellowstone National Park. _Behavioral Ecology_ 26:1352–1360. <https://pubs.usgs.gov/publication/70154805> [Abs]
- **[Hatala 2016]** Hatala K.G., Roach N.T., Ostrofsky K.R., et al. Footprints reveal direct evidence of group behavior and locomotion in _Homo erectus_. _Scientific Reports_ 6:28766. <https://doi.org/10.1038/srep28766> [Abs]
- **[Lehmann 2017]** Lehmann K.D.S., Montgomery T.M., MacLachlan S.M., et al. Lions, hyenas and mobs (oh my!). _Current Zoology_ 63:313–322. <https://par.nsf.gov/biblio/10132938> [Abs]
- **[MacNulty 2012]** MacNulty D.R., Smith D.W., Mech L.D., Vucetich J.A., Packer C. Nonlinear effects of group size on the success of wolves hunting elk. _Behavioral Ecology_ 23:75–82. <https://doi.org/10.1093/beheco/arr159> [Abs]
- **[McComb 1994]** McComb K., Packer C., Pusey A. Roaring and numerical assessment in contests between groups of female lions, _Panthera leo_. _Animal Behaviour_ 47:379–387. [Bibliographic record only; findings to be re-read before P4]
- **[Packer 1990]** Packer C., Scheel D., Pusey A.E. Why lions form groups: food is not enough. _The American Naturalist_ 136:1–19. <https://doi.org/10.1086/285079> [Abs]

Already cited in SPECIES.md or MODEL.md: [MacNulty 2014], [Stander 1992], [Schaller 1967], [Peterson 2009], [WP: Brown bear], [WP: Spotted hyena].
