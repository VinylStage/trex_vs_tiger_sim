# Species roster for a multi-species engine

> Research track: **species**. Prepared 2026-10-19 against `origin/main` at `6c84e0e` (read-only).
> Status: proposal, ready to land as `docs/SPECIES.md`. Nothing in the repository was changed.
>
> **한국어 요약**
>
> - 현재 엔진의 두 역할을 일반화합니다: **HEAVY**(대형 단독 개체: 선회 제한, 정면 공격 원뿔, 떨쳐내기, 매달린 무게로 감속)와 **PACK**(무리: 질주/순항, 스태미나, 매달리기와 초당 피해, 회복, 사기와 도주).
> - 후보 14종을 조사했습니다(사람은 완전히 제외, 고릴라도 제외). 모든 수치에 출처 수준 표시(L 문헌, D 유도, S 추정, U 미검증)를 달았습니다.
> - **1차 카탈로그(8종)**: HEAVY = 티라노사우루스, 아프리카코끼리, 아프리카물소, 불곰 / PACK = 호랑이, 사자, 회색늑대, 점박이하이에나. 실제로 관찰된 대결(코끼리–사자, 물소–사자, 불곰–늑대, 불곰–호랑이)을 바로 만들 수 있습니다.
> - 스크래치 복사본으로 돌려 본 결과, 늑대–물소 곡선은 야생 관찰(들소 사냥 성공률이 늑대 9–13마리에서 포화)과 모양이 비슷했습니다. 반면 1 HP/kg 규칙 때문에 무리가 중형 HEAVY를 너무 쉽게 잡습니다(사자 27마리가 성체 암컷 코끼리를 89% 확률로 사냥). 종별 `hide`(피부 두께 피해 배율) 상수를 제안합니다.
> - 엔진 변경: `trex.*` → `heavy.*`, `tiger.*` → `pack.*`로 이름만 바꾸고 순서를 유지합니다. 공유 링크는 `v: 2`로 올리고, v1 링크는 별칭 표로 변환해 **기존 결과를 비트 단위로 그대로** 재현합니다.

## Contents

1. [Summary](#1-summary)
2. [Scope and ground rules](#2-scope-and-ground-rules)
3. [Conventions](#3-conventions)
4. [Species overview](#4-species-overview)
5. [Species profiles and parameter tables](#5-species-profiles-and-parameter-tables)
6. [Recommended initial catalog](#6-recommended-initial-catalog)
7. [Proposed matchups](#7-proposed-matchups)
8. [Feasibility runs and calibration findings](#8-feasibility-runs-and-calibration-findings)
9. [What the engine cannot express](#9-what-the-engine-cannot-express)
10. [Engine and UI change plan](#10-engine-and-ui-change-plan)
11. [Content and AdSense considerations](#11-content-and-adsense-considerations)
12. [Open questions](#12-open-questions)
13. [References](#13-references)

- [Appendix A: preset snippet](#appendix-a-preset-snippet-for-the-phase-1-catalog)
- [Appendix B: reproducing the feasibility runs](#appendix-b-reproducing-the-feasibility-runs)

## 1. Summary

- **The two roles generalise well.** HEAVY = one large animal with a frontal weapon cone, a shake-off rate and carry slowdown. PACK = many smaller attackers with stamina, latch, damage per second (dps), bleeding, morale and rout. Of 14 candidates, 11 fit one role on today's mechanics (with relabelling, wider bounds and a per-species contact radius). Three need new mechanics: Nile crocodile (ambush, death roll, water), Spinosaurus (semi-aquatic; the popular matchup is heavy-vs-heavy) and Komodo dragon (slashing hit-and-run bites rather than a sustained hold; a solitary hunter).
- **Recommended phase-1 catalog (8 species):** HEAVY: _T. rex_, African bush elephant, African (Cape) buffalo, brown bear. PACK: tiger, lion, gray wolf, spotted hyena. Phase 1 gives four matchups observed in the field (elephants–lions, buffalo–lions, bear–wolves, bear–tiger) plus cross-era _T. rex_ pairings. **Phase 2:** Giganotosaurus, Allosaurus, polar bear, Deinonychus (plus Velociraptor and Utahraptor variants) and African wild dog.
- **Data quality.** Of the 176 preset values (16 species × 11), 30 are literature values (**L**), 13 are derived from literature (**D**), 3 are unverified popular figures (**U**) and 130 are speculative (**S**). Mass, top speed and weapon force are mostly sourced. Behavioural parameters (latch chance, morale, accuracy, intervals, endurance) are **speculative** for every species, as they already are for the tiger. Every value carries a tag (§3.2).
- **Feasibility runs** (scratch copy of the engine, §8): wolves vs a lone buffalo reproduce the shape of field data. Capture is near zero for 1–3 wolves and saturates around 12–16, close to the 9–13-wolf plateau for wolves hunting bison [MacNulty 2014]. But **1 HP/kg makes mid-size heavies too fragile**: 27 lions kill a lone adult cow elephant in 89 % of runs, and 8 wolves kill a brown bear in about 80 %. Adult elephants are described as effectively invulnerable to predation [WP: African bush elephant]. A per-species `hide` damage multiplier (0.3–0.5) moves these results to plausible levels and leaves juveniles vulnerable, as at Savuti.
- **Engine plan** (§10): rename `trex.*` → `heavy.*` and `tiger.*` → `pack.*` in the **same order**, add a species registry, and bump the share payload to `v: 2` with `heavy`/`pack` species ids. Hard bounds become **per species**, and _T. rex_/tiger keep their v1 bounds, so every v1 link (upgraded through an alias map) reproduces bit-identically. New mechanics enter first as non-sampled species constants (`packRadius`, `hide`), which consume no random numbers. With _T. rex_/tiger values they are exact identities.

## 2. Scope and ground rules

- **No humans.** No human data, comparisons or attack records are used anywhere in this roster. **Gorilla is excluded**: it is not a predator, and there is no heavy-vs-pack interaction literature to calibrate against.
- **Cross-era pairings are labelled _fantasy_**, like the existing _T. rex_ vs tiger. Only pairings with field observations are labelled _documented_ (§7).
- **Code read:** `src/sim/engine.ts`, `params.ts`, `config.ts`, `sampling.ts`, `src/ui/share.ts`, `form.ts`, `app.ts`, `replay.ts`, `i18n.ts`, `docs/MODEL.md`, `ROADMAP.md` at `6c84e0e`.
- **Source access.** Several publisher sites were unreachable from the research environment. Open-access papers were read in full through Europe PMC or PLOS. Other values were taken from Wikipedia (a secondary source) or from abstracts and search summaries. §3.2 and §13 mark every source with its access level.

## 3. Conventions

### 3.1 Roles and the 22 parameter ids

The v2 ids keep the v1 order exactly; only the prefix changes (§10.4).

| v1 id                   | v2 id                  | Unit  | Engine meaning                                                                                                | Bounds now (kept for _T. rex_/tiger) | Widest bounds needed by other species                               |
| ----------------------- | ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `trex.mass`             | `heavy.mass`           | kg    | HP (1 HP/kg) and denominator of the carry slowdown                                                            | 1,000–20,000                         | **100–20,000** (bears, buffalo)                                     |
| `trex.speed`            | `heavy.speed`          | m/s   | Chase speed × max(0.3, 1 − carried/mass) × 0.5 if heading error > 60°                                         | 0.5–25                               | same                                                                |
| `trex.turnRate`         | `heavy.turnRate`       | deg/s | Max heading change                                                                                            | 5–360                                | same                                                                |
| `trex.biteForce`        | `heavy.biteForce`      | kN    | **Weapon force**; damage = force × lethality × U(0.7, 1.3). Label per species (bite, tusk/trample, horn, paw) | 1–150                                | **0.1–150**                                                         |
| `trex.biteLethality`    | `heavy.biteLethality`  | HP/kN | Run-level mapping of force to damage                                                                          | 0.1–100                              | same                                                                |
| `trex.biteInterval`     | `heavy.biteInterval`   | s     | Cooldown between attempts                                                                                     | 0.2–30                               | same                                                                |
| `trex.biteReach`        | `heavy.biteReach`      | m     | Body centre to weapon tip                                                                                     | 1–15                                 | same                                                                |
| `trex.biteArc`          | `heavy.biteArc`        | deg   | Half-angle of the frontal cone                                                                                | 5–180                                | same                                                                |
| `trex.biteAccuracy`     | `heavy.biteAccuracy`   | p     | Hit chance (× 1.5, max 0.95, against latched attackers)                                                       | 0–1                                  | same                                                                |
| `trex.shakeRate`        | `heavy.shakeRate`      | 1/s   | Per-attacker throw-off rate                                                                                   | 0–10                                 | same                                                                |
| `trex.bodyRadius`       | `heavy.bodyRadius`     | m     | Contact circle (run-level)                                                                                    | 0.5–8                                | same                                                                |
| `tiger.mass`            | `pack.mass`            | kg    | HP and carried mass when latched                                                                              | 30–500                               | **5–1,000** (wild dog 18 kg, Velociraptor 14 kg, Utahraptor 500 kg) |
| `tiger.sprintSpeed`     | `pack.sprintSpeed`     | m/s   | Speed within 60 m of the target; drains stamina                                                               | 2–35                                 | same                                                                |
| `tiger.cruiseSpeed`     | `pack.cruiseSpeed`     | m/s   | Speed beyond 60 m and while recovering (≤ sprint)                                                             | 0.5–20                               | same                                                                |
| `tiger.sprintEndurance` | `pack.sprintEndurance` | s     | Full-to-empty stamina at sprint                                                                               | 1–600                                | same                                                                |
| `tiger.latchEndurance`  | `pack.latchEndurance`  | s     | Full-to-empty stamina while latched                                                                           | 1–1,200                              | same                                                                |
| `tiger.recoveryTime`    | `pack.recoveryTime`    | s     | Empty-to-full stamina at rest                                                                                 | 1–3,600                              | same                                                                |
| `tiger.latchChance`     | `pack.latchChance`     | p     | Chance a contact becomes a hold                                                                               | 0–1                                  | same                                                                |
| `tiger.dps`             | `pack.dps`             | HP/s  | Damage while latched                                                                                          | 0–200                                | same                                                                |
| `tiger.bleed`           | `pack.bleed`           | 1/s   | Heavy loses wound × bleed HP/s (run-level)                                                                    | 0–0.1                                | same                                                                |
| `tiger.morale`          | `pack.morale`          | 0–1   | Initial morale; rout below 0.2                                                                                | 0–1                                  | same                                                                |
| `tiger.moraleLoss`      | `pack.moraleLoss`      | 0–1   | Morale lost per nearby pack death                                                                             | 0–1                                  | same                                                                |

**Bounds must become per-species.** The engine clamps every per-animal value to the parameter's bounds (`indiv()` in `engine.ts`). Widening a global bound would therefore change results for v1 links whose ranges touch the old bound, for example `tiger.mass` max 500 × an individual factor of 1.3. Each species preset carries its own hard bounds; _T. rex_ and tiger keep exactly the v1 bounds.

Species **constants** (not sampled, not in the URL): `packRadius` (today `CONSTANTS.tigerRadius = 0.8 m`) and the proposed `hide` (§9).

### 3.2 Evidence tags and source access

| Tag   | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| **L** | Literature value, used directly or bracketing a reported range. |
| **D** | Derived from literature with a stated formula (§3.3).           |
| **S** | Speculative: author judgement, deliberately wide.               |
| **U** | Unverified popular figure (no peer-reviewed source found).      |

Source access levels in §13: **[FT]** full text read; **[Abs]** abstract or search summary only; **[WP]** taken from Wikipedia, which cites the primary source; **[MODEL]** already cited in `docs/MODEL.md`. Values marked [Abs] or [WP] should be re-checked against the primary source before they are presented as fact in the UI.

### 3.3 Shared calibration formulas

1. **HP = mass in kg** for both roles (unchanged).
2. **Heavy damage per hit** = weapon force (kN) × lethality (HP/kN) × U(0.7, 1.3) (unchanged). For non-biting weapons (tusks, horns, paws) `biteForce` is only relabelled; the formula stays.
3. **Pack bite force when no measurement exists:** F ≈ 1.35 kN × (BFQ / 139) × (m / 200 kg)^0.57. It is anchored on the tiger (1.2–1.5 kN in MODEL.md, BFQ 139). BFQ values come from the table in [WP: Bite force quotient] (Wroe 2005; Christiansen & Wroe 2007). The 0.57 exponent is the mass exponent of Hite et al.'s BFQ regression, quoted on the same page. Checks: hyena 0.61 kN vs 0.57 kN estimated; wild dog at 18.9 kg 0.35 kN vs 0.43 kN tabulated; lion 1.06–1.21 kN vs 1.59 kN measured in a lioness. Expect about ±30 % error; the formula underestimates lions.
4. **Pack dps from bite force** (F in kN): dps ≈ (2·F_min, 4.4·F_mode, 8·F_max). This reproduces the tiger default 2/6/12 HP/s from 1.2/1.35/1.5 kN. It encodes MODEL.md §5.3: 4–12 HP/kN per bite, one bite or claw strike every 1–2 s, upper tail trimmed.
5. **Heavy turn rate from agility:** ω ≈ ω_T. rex × √(A / A_T. rex), with A the τ/I agility index of [Snively 2019] Table 3 (body + swing leg). Because θ = ½αt², the time to turn a fixed angle scales as 1/√α.
6. **Geometry** (`bodyRadius`, `biteReach`, `packRadius`) is always **S**: half the torso length, plus neck, head, trunk or horns for reach.

## 4. Species overview

Short citation keys resolve in §13. "WP" = Wikipedia page for that species, accessed 2026-10-19.

| Species                | Status                           | Role              | Adult mass                                                     | Top speed                                                                                   | Sustained                                                             | Weapon force                                                                                     | Reach / agility                                                     | Endurance                           | Group size and cooperation                                                                                               | Interactions with large prey or predators                                                                                                                                                           | Engine fit                               |
| ---------------------- | -------------------------------- | ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| _Tyrannosaurus rex_    | extinct 68–66 Ma                 | HEAVY (incumbent) | 5.7–9.5 t [MODEL]                                              | walking gaits ≲ 5 m/s [Sellers 2017]; 8.0 m/s in a 6 t model [Sellers & Manning 2007]       | preferred walk 1.3 m/s [MODEL]                                        | 8.5–57 kN [MODEL]; 25 / 49 kN anterior/posterior [Sakamoto 2022]                                 | jaws ~3 m beyond body; 22–45 °/s                                    | n/a                                 | assumed solitary                                                                                                         | healed bite on a hadrosaur [MODEL]                                                                                                                                                                  | ✓ incumbent                              |
| African bush elephant  | extant                           | HEAVY             | cows 2.6–3.5 t, bulls 5.2–6.9 t [Larramendi 2016, WP]          | 6.8 m/s fastest reliable (Asian elephants) [Hutchinson 2003; 2006]                          | 4–4.5 m/s African (Alexander 1979, quoted via [Hutchinson 2006, Abs]) | tusks, trunk blows, trampling: **no measurement**                                                | trunk ~2 m; no turning data                                         | n/a                                 | cow-led family herds; adults mob lions [WP]                                                                              | adults "considered invulnerable"; Savuti lions killed 74 elephants in 1993–96, 26 older than 9 years [Joubert 2006, WP]; 8 aged 1–11 in Oct 2005 [Power & Compion 2009]                             | ✓ relabel weapon; `hide` advised         |
| African (Cape) buffalo | extant                           | HEAVY             | ♂ 650–900 kg, ♀ ≤ 500 kg [WP]                                  | ~56 km/h **[U]**                                                                            | n/a                                                                   | horns: no measurement                                                                            | horns at the head; agile                                            | n/a                                 | herds of a few to > 1,000 [WP]                                                                                           | lions are the main predator: attack the rear, suffocating bite on the nose; buffalo drive off or kill lions [WP]                                                                                    | ✓ relabel; herd defence missing          |
| Brown bear             | extant                           | HEAVY             | ♂ mean 217 kg, ♀ 152 kg; coastal ~2× [WP]                      | 48 km/h recorded [WP, Kearns 1937]                                                          | n/a                                                                   | bite ≈ 0.8–1.1 kN **[D]**; forearm blows can break the neck of adult moose or bison [WP]         | claws 5–6 cm [WP]                                                   | n/a                                 | solitary                                                                                                                 | dominates wolves at carcasses [WP]; first recorded grizzly kill of an adult wolf in the western US [Jimenez 2008]; Amur tigers attacked bears in 32 cases in 1944–59, bears killed tigers in 4 [WP] | ✓ ; 360° swipe missing                   |
| Polar bear             | extant                           | HEAVY             | ♂ 300–800 kg, ♀ 150–300 kg [WP]                                | ~40 km/h estimate [WP]                                                                      | 5.5 km/h usual travel [WP]                                            | bites and swipes; no measurement                                                                 | n/a                                                                 | n/a                                 | solitary                                                                                                                 | hunts young walruses; adults too formidable [WP]                                                                                                                                                    | ✓ but no pack interaction data           |
| Nile crocodile         | extant                           | HEAVY (deferred)  | ♂ 225–750 kg, records > 1 t [WP]                               | 14 km/h land bursts [WP]; no crocodylian recorded above 5 m/s [Hutchinson 2019]             | swims 30–35 km/h [WP]                                                 | 3.0 kN measured at 86 kg; 7–23 kN at 225–750 kg by regression [Erickson 2012]                    | short reach, fast lateral snap                                      | n/a                                 | gathers at carcasses; cooperative fish blocking [WP]                                                                     | crocodiles and lions mostly avoid each other; tug-of-war over carcasses; each preys on the other when sizes differ [WP]                                                                             | ✗ ambush, death roll, water              |
| Giganotosaurus         | extinct, S. America              | HEAVY (phase 2)   | 4.2–13.8 t; compiled 5.5–8.5 t; 6.9 t model [WP; Snively 2019] | 14 m/s kinematic ceiling only [WP, Blanco & Mazzetta 2001]                                  | n/a                                                                   | weaker than _T. rex_, no absolute value [WP, Therrien 2005]; relatives 8–25 kN [Sakamoto 2022]   | skull 1.53–1.80 m [WP]; agility ≈ ½ _T. rex_ [Snively 2019]         | n/a                                 | relative _Mapusaurus_ found in a multi-individual bonebed [WP]                                                           | probably juvenile sauropods [WP]                                                                                                                                                                    | ✓                                        |
| Allosaurus             | extinct, N. America and Portugal | HEAVY (phase 2)   | 1.0–2.7 t [WP; Snively 2019]                                   | 9.4 m/s in a 1.4 t model [Sellers & Manning 2007]                                           | n/a                                                                   | 0.8–2.1 kN [Rayfield 2001, WP] to 4.4 / 9.4 kN [Sakamoto 2022]                                   | 92° gape [WP]; agility slightly above adult _T. rex_ [Snively 2019] | n/a                                 | packs vs aggregations debated [WP]                                                                                       | _Stegosaurus_ spike wound in an Allosaurus vertebra [WP, Carpenter 2005]                                                                                                                            | ✓                                        |
| Spinosaurus            | extinct, N. Africa               | HEAVY (deferred)  | 7.4 t flesh model [Sereno 2022]                                | no estimate                                                                                 | n/a                                                                   | 4.8 / 11.9 kN [Sakamoto 2022]                                                                    | long narrow snout                                                   | n/a                                 | n/a                                                                                                                      | aquatic vs wading-ambush debate [Sereno 2022; WP]                                                                                                                                                   | ✗ aquatic; demand is heavy-vs-heavy      |
| Tiger                  | extant                           | PACK (incumbent)  | 100–260 kg [MODEL]                                             | 11–18 m/s **[S]** [MODEL]                                                                   | n/a                                                                   | 1.2–1.5 kN [MODEL]                                                                               | n/a                                                                 | short charges [MODEL]               | solitary; coordinated attacks undocumented [MODEL]                                                                       | hunting success 5–50 %; sometimes killed by gaur, buffalo, boar [WP: Tiger]                                                                                                                         | ✓ incumbent                              |
| Lion                   | extant                           | PACK              | ♀ 110–144 kg, ♂ 160–225 kg [WP, Smuts 1980]                    | 74.1 km/h recorded [WP, Wilson 2018]; bursts 48–59 km/h [WP]                                | short bursts only [WP]                                                | 1,594 N measured in a lioness [WP, van der Meijden 2023]                                         | n/a                                                                 | heart 0.45–0.57 % of body mass [WP] | prides average ~15, up to 30 [WP]; "wing" and "centre" roles [Stander 1992]                                              | buffalo, giraffe, juvenile elephants [WP]; male lions mainly capture buffalo [Funston 2001]                                                                                                         | ✓                                        |
| Gray wolf              | extant                           | PACK              | mean 40 kg (12–79) [WP]                                        | 56–65 km/h **[U]**                                                                          | trot ~10 km/h **[U]**                                                 | ≈ 0.5 kN **[D]**                                                                                 | n/a                                                                 | long-distance trotting              | packs average 8 (N. America), 5.5 (Europe), up to 42 [WP]; bison capture success plateaus at 9–13 wolves [MacNulty 2014] | bison, moose; brown bears dominate at carcasses [WP]                                                                                                                                                | ✓                                        |
| Spotted hyena          | extant                           | PACK              | 40–64 kg, Zambia ~68 kg [WP]                                   | 60 km/h [WP]                                                                                | chases of several km [WP]                                             | 566 N canine (estimate) [WP, Christiansen & Wroe 2007]; 4,500 N measured maximum [Erickson 2012] | n/a                                                                 | heart ~1 % of body mass [WP]        | clans up to 80; hunts alone, in 2–5 or large groups [WP]                                                                 | prevails over lionesses at ≥ 4 : 1 [WP]; adult buffalo bulls taken occasionally [WP]                                                                                                                | ✓ ; numbers-dependent courage missing    |
| African wild dog       | extant                           | PACK (phase 2)    | 18–36 kg [WP]                                                  | 19 m/s stride speed [Hubel 2016a]                                                           | mostly walk and trot [Hubel 2016a]                                    | ~0.43 kN [Wroe 2005 **[U]**]                                                                     | n/a                                                                 | chases mean 447 m [Hubel 2016a]     | packs of 2–27 adults [WP]; individual kill rate 15.5 %, no cooperative chasing seen [Hubel 2016b]                        | adult buffalo extremely rare [WP]; lions a major cause of death [WP]                                                                                                                                | ✓ (own mass bounds below 30 kg)          |
| Deinonychus            | extinct, N. America              | PACK (phase 2)    | 60–100 kg [WP]                                                 | not especially fast [WP, Ostrom 1976]; Velociraptor 10.8 m/s model [Sellers & Manning 2007] | n/a                                                                   | 0.3 / 0.7 kN [Sakamoto 2022] vs 4.1–8.2 kN from bite marks [Gignac 2010]                         | sickle claw > 12 cm; "raptor prey restraint" [WP, Fowler 2011]      | n/a                                 | gregariousness debated [WP, Roach & Brinkman 2007]                                                                       | found with _Tenontosaurus_ (1–4 t) [WP]                                                                                                                                                             | ✓                                        |
| Komodo dragon          | extant                           | PACK (deferred)   | wild ~70 kg; ♂ 79–91 kg [WP]                                   | 20 km/h bursts [WP]                                                                         | slow                                                                  | 149 N bite, 337 N pull, measured [D'Amore 2011]                                                  | n/a                                                                 | short bursts                        | solitary; aggregates at carcasses [WP]                                                                                   | takes deer, pigs, water buffalo; kills in minutes to under half an hour [WP]; venom [Fry 2009]                                                                                                      | ✗ slashing strikes, not a hold; solitary |

## 5. Species profiles and parameter tables

Ids use the v2 names; `heavy.*` = `trex.*` and `pack.*` = `tiger.*` in v1. Formulas referenced as "§3.3" are in [§3.3](#33-shared-calibration-formulas).

### 5.1 _Tyrannosaurus rex_ (HEAVY, incumbent)

Unchanged from `docs/MODEL.md` §5.1. Sakamoto 2022's reconstruction (25.4 kN anterior / 48.5 kN posterior) falls inside the current bite-force range, which supports the existing triangle.

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                                                        |
| --------------------- | ----- | ----: | ----: | ----: | :---: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 5,650 | 8,000 | 9,500 |   L   | Current default. Erickson 2004; Persons 2019; Hutchinson 2011.                                                                            |
| `heavy.speed`         | m/s   |   3.4 |   5.5 |     8 |   L   | Current default. Hutchinson & Garcia 2002; Sellers 2017; Sellers & Manning 2007 (8.0 m/s for a 6 t model).                                |
| `heavy.turnRate`      | deg/s |    22 |    30 |    45 |   L   | Current default. Hutchinson, Ng-Thow-Hing & Anderson 2007.                                                                                |
| `heavy.biteForce`     | kN    |   8.5 |    35 |    57 |   L   | Current default. Gignac & Erickson 2017; Bates & Falkingham 2012. Sakamoto 2022: 25.4 kN anterior / 48.5 kN posterior (inside the range). |
| `heavy.biteLethality` | HP/kN |     4 |     8 |    12 | **S** | Current default (shared mapping, see MODEL.md §5.3).                                                                                      |
| `heavy.biteInterval`  | s     |   1.5 |   2.5 |     4 | **S** | Current default.                                                                                                                          |
| `heavy.biteReach`     | m     |   4.5 |   5.5 |   6.5 | **S** | Current default (geometry).                                                                                                               |
| `heavy.biteArc`       | deg   |    30 |    45 |    70 | **S** | Current default.                                                                                                                          |
| `heavy.biteAccuracy`  | p     |   0.3 |   0.5 |   0.7 | **S** | Current default.                                                                                                                          |
| `heavy.shakeRate`     | 1/s   |  0.05 |  0.12 |  0.25 | **S** | Current default.                                                                                                                          |
| `heavy.bodyRadius`    | m     |     2 |   2.5 |     3 | **S** | Current default (geometry).                                                                                                               |

### 5.2 African bush elephant (HEAVY)

- **Evidence.** Bulls average 6.0 t (90 % within 5.2–6.9 t); cows 3.0 t (2.6–3.5 t) [Larramendi 2016, WP]. 6.8 m/s is the fastest reliable elephant speed, recorded in Asian elephants [Hutchinson 2003; 2006]. Mean tusk mass at 60 years: 109 kg in bulls, 17.7 kg in cows [WP].
- **Interactions.** Adults are "considered invulnerable to predation" and mob lions [WP]. At Savuti (Chobe), lions killed 74 elephants in 1993–96, 26 of them older than nine and one bull over 15 [Joubert 2006, via WP]. A 30-lion pride killed about one elephant every three days in the late dry season; 7 of 8 victims were 4–11 years old [Power & Compion 2009].
- **Weapon.** No measured force exists for tusks, trunk blows or trampling. `biteForce` is relabelled "tusk/trample force" and anchored on body weight (3.2 t × g ≈ 31 kN). It is **S**.
- **Engine cannot express:** trampling a downed attacker, trunk grab-and-throw (approximated by `shakeRate`), herd bunching around calves, mock charges that scare attackers without contact, and thick skin (→ `hide`).

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                                                  |
| --------------------- | ----- | ----: | ----: | ----: | :---: | ----------------------------------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 2,600 | 3,200 | 6,900 |   L   | Larramendi 2016: adult females 2.6–3.5 t (mean 3.0 t); bulls 5.2–6.9 t (mean 6.0 t). Mode set for a cow-led family herd.            |
| `heavy.speed`         | m/s   |     3 |   4.5 |   6.8 |   L   | Hutchinson 2003/2006: 6.8 m/s fastest reliable elephant speed (Asian elephants); Alexander 1979: 4–4.5 m/s for an African elephant. |
| `heavy.turnRate`      | deg/s |    30 |    50 |    90 | **S** | No data.                                                                                                                            |
| `heavy.biteForce`     | kN    |     8 |    20 |    45 | **S** | Re-labelled "weapon force" (tusks, trunk blows, trampling). Anchored on body weight: 3.2 t × g ≈ 31 kN. No measurement.             |
| `heavy.biteLethality` | HP/kN |     2 |     5 |     9 | **S** | Blunt trauma; lower than a toothed bite per kN.                                                                                     |
| `heavy.biteInterval`  | s     |     2 |     4 |     8 | **S** | —                                                                                                                                   |
| `heavy.biteReach`     | m     |   2.8 |   3.5 |   4.3 | **S** | Geometry: body radius + ~2 m trunk/tusks.                                                                                           |
| `heavy.biteArc`       | deg   |    40 |    60 |    90 | **S** | Trunk sweeps and head swings.                                                                                                       |
| `heavy.biteAccuracy`  | p     |  0.15 |   0.3 |   0.5 | **S** | —                                                                                                                                   |
| `heavy.shakeRate`     | 1/s   |  0.08 |   0.2 |   0.4 | **S** | The trunk can pluck attackers off the body.                                                                                         |
| `heavy.bodyRadius`    | m     |   1.4 |   1.7 |     2 | **S** | Geometry: shoulder height 2.6–3.2 m.                                                                                                |

**Juvenile variant** (calibration only, for the Savuti age class): `heavy.mass` = 400 / 900 / 1,800 kg **S**; all other rows as above.

### 5.3 African (Cape) buffalo (HEAVY)

- **Evidence.** Males 650–900 kg, females up to 500 kg, skin thicker than 2–3 cm [WP]. No peer-reviewed top speed was found; the common 56 km/h figure is **U**.
- **Interactions.** Lions are the main predator. A pride isolates one animal, attacks the rear and suffocates it with a bite to the nose; in other cases the buffalo drives off or kills lions, and large herds protect against lions in open areas [WP]. Male lions mainly capture buffalo [Funston 2001].
- **Bison proxy.** Wolves hunting bison are the best quantitative group-size data set [MacNulty 2014]. American bison is not in this roster, so a buffalo preset (similar mass) serves as a stand-in for calibration (§8.2).
- **Engine cannot express:** herd mobbing to rescue a herd member, horn tosses with high throw damage, stampede, and fleeing.

| Parameter             | Unit  |  min | mode |  max | Basis | Source / rationale                                                             |
| --------------------- | ----- | ---: | ---: | ---: | :---: | ------------------------------------------------------------------------------ |
| `heavy.mass`          | kg    |  420 |  600 |  900 |   L   | Males 650–900 kg, females up to 500 kg (via Wikipedia).                        |
| `heavy.speed`         | m/s   |    8 |   11 | 15.5 | **U** | Popular figure ~56 km/h (15.5 m/s). No peer-reviewed measurement found.        |
| `heavy.turnRate`      | deg/s |   60 |   90 |  150 | **S** | No data.                                                                       |
| `heavy.biteForce`     | kN    |    2 |    5 |   10 | **S** | Re-labelled "horn hook force". Body weight at 600 kg ≈ 5.9 kN. No measurement. |
| `heavy.biteLethality` | HP/kN |    4 |    8 |   12 | **S** | Shared mapping.                                                                |
| `heavy.biteInterval`  | s     |    1 |    2 |    4 | **S** | —                                                                              |
| `heavy.biteReach`     | m     |  1.5 |  1.8 |  2.2 | **S** | Geometry: radius + horns.                                                      |
| `heavy.biteArc`       | deg   |   30 |   45 |   70 | **S** | —                                                                              |
| `heavy.biteAccuracy`  | p     |  0.2 | 0.35 | 0.55 | **S** | —                                                                              |
| `heavy.shakeRate`     | 1/s   | 0.03 | 0.08 |  0.2 | **S** | Lions on the rump are hard to dislodge.                                        |
| `heavy.bodyRadius`    | m     |  0.7 | 0.85 |    1 | **S** | Geometry: head–body length 2.1–3.0 m.                                          |

### 5.4 Brown bear (HEAVY)

- **Evidence.** Mean adult male 217 kg across 19 populations, female 152 kg; coastal bears are about twice as heavy [WP]. 48 km/h is the highest reliably recorded speed in Yellowstone [WP: Grizzly bear, citing Kearns 1937]. Claws 5–6 cm [WP]. Bears fight by striking with the paws and biting the head or neck [WP].
- **Interactions.** Brown bears regularly take wolf kills, and most carcass conflicts end without bloodshed [WP]. The first recorded grizzly kill of an adult wolf in the western US was published in 2008 [Jimenez 2008]. In the Russian Far East, Amur tigers attacked brown and black bears in 32 recorded cases (1944–59); bears killed female tigers or cubs in 4 [WP].
- **Engine cannot express:** 360° paw strikes at close range (the frontal cone is too narrow for a bear surrounded by wolves), sitting back against cover, and a fat/fur layer that reduces wolf damage (→ `hide`).

| Parameter             | Unit  | min | mode |  max | Basis | Source / rationale                                                                                             |
| --------------------- | ----- | --: | ---: | ---: | :---: | -------------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 130 |  220 |  450 |   L   | Mean adult male 217 kg over 19 populations, female 152 kg; coastal bears about twice as heavy (via Wikipedia). |
| `heavy.speed`         | m/s   |   8 |   11 | 13.3 |   L   | 48 km/h (13.3 m/s) the highest reliably recorded in Yellowstone (Kearns 1937, via Wikipedia).                  |
| `heavy.turnRate`      | deg/s |  60 |  120 |  200 | **S** | Agile quadruped; no data.                                                                                      |
| `heavy.biteForce`     | kN    | 0.6 |  1.2 |    3 |   D   | Bite ≈ 0.8–1.1 kN derived from BFQ 78 (formula in §3.3). Max widened for paw strikes (unmeasured).             |
| `heavy.biteLethality` | HP/kN |   4 |    8 |   12 | **S** | Shared mapping.                                                                                                |
| `heavy.biteInterval`  | s     | 0.8 |  1.5 |    3 | **S** | Alternating swipes and bites.                                                                                  |
| `heavy.biteReach`     | m     | 1.2 |  1.5 |  1.9 | **S** | Geometry: radius + head/forelimb.                                                                              |
| `heavy.biteArc`       | deg   |  45 |   70 |  100 | **S** | Forelimb swipes widen the frontal arc.                                                                         |
| `heavy.biteAccuracy`  | p     | 0.3 | 0.45 | 0.65 | **S** | —                                                                                                              |
| `heavy.shakeRate`     | 1/s   | 0.1 | 0.25 |  0.5 | **S** | Can roll and swat.                                                                                             |
| `heavy.bodyRadius`    | m     | 0.6 | 0.75 |  0.9 | **S** | Geometry.                                                                                                      |

### 5.5 Polar bear (HEAVY, phase 2)

- **Evidence.** Males 300–800 kg, females 150–300 kg; up to ~40 km/h [WP]. Hunts young walruses; adults are too formidable [WP].
- **Fit.** Mechanically like the brown bear. No pack-vs-polar-bear literature was found, so every matchup is fantasy. Kept for audience interest.

| Parameter             | Unit  | min | mode |  max | Basis | Source / rationale                                                        |
| --------------------- | ----- | --: | ---: | ---: | :---: | ------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 250 |  450 |  800 |   L   | Adult males 300–800 kg, females 150–300 kg (via Wikipedia).               |
| `heavy.speed`         | m/s   |   6 |    9 | 11.1 |   L   | Up to ~40 km/h (estimate, via Wikipedia); usual travel 5.5 km/h.          |
| `heavy.turnRate`      | deg/s |  50 |  100 |  180 | **S** | —                                                                         |
| `heavy.biteForce`     | kN    | 0.8 |  1.5 |  3.5 | **S** | Brown-bear value scaled by mass^0.57; no BFQ published in the table used. |
| `heavy.biteLethality` | HP/kN |   4 |    8 |   12 | **S** | —                                                                         |
| `heavy.biteInterval`  | s     | 0.8 |  1.5 |    3 | **S** | —                                                                         |
| `heavy.biteReach`     | m     | 1.3 |  1.6 |    2 | **S** | —                                                                         |
| `heavy.biteArc`       | deg   |  45 |   70 |  100 | **S** | —                                                                         |
| `heavy.biteAccuracy`  | p     | 0.3 | 0.45 | 0.65 | **S** | —                                                                         |
| `heavy.shakeRate`     | 1/s   | 0.1 | 0.25 |  0.5 | **S** | —                                                                         |
| `heavy.bodyRadius`    | m     | 0.7 | 0.85 |    1 | **S** | —                                                                         |

### 5.6 Giganotosaurus (HEAVY, phase 2)

- **Evidence.** Mass estimates span 4.2–13.8 t. A 2021 compilation gives 5.5–8.5 t (mean 6.75 t) [WP]; Snively's model gives 6,908 kg [Snively 2019]. Agility index 0.51 vs 0.95–1.0 for adult _T. rex_ [Snively 2019]. Bite weaker than _T. rex_, with slicing jaws and no absolute estimate [WP, Therrien 2005]. Close relatives: _Carcharodontosaurus_ 11.3 / 25.4 kN, _Acrocanthosaurus_ 8.3 / 17.0 kN [Sakamoto 2022].
- **Era.** 111–106 Ma per current Wikipedia (older literature ~99–97 Ma), South America; it never met _T. rex_.

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                                                                                                                           |
| --------------------- | ----- | ----: | ----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heavy.mass`          | kg    | 4,200 | 6,900 | 9,000 |   L   | Coria & Currie 2002: 4.2 t; Snively 2019 model: 6,908 kg; Reolid 2021 compilation: 5.5–8.5 t (mean 6.75 t); 8.2 t for the larger dentary specimen. Therrien & Henderson 2007 (13.8 t) treated as an outlier. |
| `heavy.speed`         | m/s   |   3.4 |   5.5 |     9 | **S** | No locomotor model. Same mass class as T. rex, so the T. rex range is reused, with a longer upper tail. Blanco & Mazzetta 2001 give 14 m/s as a kinematic ceiling only.                                      |
| `heavy.turnRate`      | deg/s |    16 |    22 |    32 |   D   | T. rex range × 0.72 = √(agility 0.51 / 0.98), Snively 2019 Table 3 (τ/I, body+leg). Assumes time-to-turn ∝ 1/√(angular acceleration).                                                                        |
| `heavy.biteForce`     | kN    |     8 |    17 |    26 |   D   | Therrien 2005: weaker than T. rex, no absolute value. Proxies from Sakamoto 2022: Carcharodontosaurus 11.3/25.4 kN, Acrocanthosaurus 8.3/17.0 kN (anterior/posterior).                                       |
| `heavy.biteLethality` | HP/kN |     4 |     8 |    12 | **S** | Shared mapping. Slicing teeth could justify a higher value; kept equal for comparability.                                                                                                                    |
| `heavy.biteInterval`  | s     |   1.2 |   2.2 |   3.5 | **S** | Jaw muscles arranged for fast closure (Coria & Currie 2002, via Wikipedia; not read directly).                                                                                                               |
| `heavy.biteReach`     | m     |   4.5 |   5.6 |   6.8 | **S** | Geometry: skull 1.53–1.80 m (T. rex ≈ 1.5 m), body 12–13 m.                                                                                                                                                  |
| `heavy.biteArc`       | deg   |    30 |    45 |    70 | **S** | As T. rex.                                                                                                                                                                                                   |
| `heavy.biteAccuracy`  | p     |   0.3 |   0.5 |   0.7 | **S** | As T. rex.                                                                                                                                                                                                   |
| `heavy.shakeRate`     | 1/s   |  0.04 |   0.1 |  0.22 | **S** | Slightly below T. rex because of lower agility.                                                                                                                                                              |
| `heavy.bodyRadius`    | m     |     2 |   2.5 |     3 | **S** | Geometry, as T. rex.                                                                                                                                                                                         |

### 5.7 Allosaurus (HEAVY, phase 2)

- **Evidence.** 1.5 t for "Big Al" [WP, Bates 2009]; 1,512–1,683 kg models [Snively 2019]; 9.4 m/s modelled top speed for 1.4 t [Sellers & Manning 2007]. Bite 0.8–2.1 kN in a finite-element study [WP, Rayfield 2001] vs 4.4 / 9.4 kN [Sakamoto 2022]. Wide gape and fast, controlled head strikes [WP].
- **Interactions.** A _Stegosaurus_ tail-spike wound in an Allosaurus vertebra [WP, Carpenter 2005]. Pack hunting is debated [WP].
- **Note.** At 1–2.7 t Allosaurus could also fill the PACK role against sauropods. That needs pack bounds up to ~3 t and is out of scope here.

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                                       |
| --------------------- | ----- | ----: | ----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------------------ |
| `heavy.mass`          | kg    | 1,000 | 1,600 | 2,700 |   L   | Foster: ~1 t for large adults; Bates 2009 ("Big Al"): 1.5 t; Snively 2019: 1,512–1,683 kg; Wikipedia summary: 1.7–2.7 t. |
| `heavy.speed`         | m/s   |     5 |     8 |    10 |   L   | Sellers & Manning 2007: 9.4 m/s for a 1.4 t model. Popular 30–55 km/h is secondary.                                      |
| `heavy.turnRate`      | deg/s |    25 |    35 |    50 |   D   | Snively 2019 agility 1.11–1.41 vs ~0.95–1.0 for adult T. rex → T. rex range × ~1.05–1.2.                                 |
| `heavy.biteForce`     | kN    |     1 |   4.4 |   9.4 |   L   | Rayfield 2001: 0.8–2.1 kN (muscle-driven FE). Sakamoto 2022: 4.4 kN anterior / 9.4 kN posterior.                         |
| `heavy.biteLethality` | HP/kN |     4 |     8 |    12 | **S** | Shared mapping.                                                                                                          |
| `heavy.biteInterval`  | s     |     1 |     2 |   3.5 | **S** | Rapid, controlled head strikes (Snively 2013, via Wikipedia).                                                            |
| `heavy.biteReach`     | m     |     3 |   3.6 |   4.3 | **S** | Geometry: ~8.5 m animal, skull ~0.85–1 m.                                                                                |
| `heavy.biteArc`       | deg   |    35 |    50 |    75 | **S** | More mobile head and neck than T. rex.                                                                                   |
| `heavy.biteAccuracy`  | p     |  0.35 |  0.55 |  0.75 | **S** | —                                                                                                                        |
| `heavy.shakeRate`     | 1/s   |  0.05 |  0.12 |  0.25 | **S** | As T. rex.                                                                                                               |
| `heavy.bodyRadius`    | m     |   1.2 |   1.5 |   1.8 | **S** | Geometry.                                                                                                                |

### 5.8 Spinosaurus (HEAVY, deferred)

- **Evidence.** 7,390 kg flesh model, bipedal on land, unstable surface swimmer [Sereno 2022]. Bite 4.8 / 11.9 kN, jaws built for fast closure [Sakamoto 2022]. Diving vs wading-ambush is still debated [WP].
- **Why deferred.** Its habitat needs water terrain. The matchup people ask for (Spinosaurus vs _T. rex_) is heavy-vs-heavy, which the two-role engine cannot run.

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                        |
| --------------------- | ----- | ----: | ----: | ----: | :---: | --------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 6,000 | 7,400 | 9,000 |   L   | Sereno 2022 flesh model: 7,390 kg; Dal Sasso 2005: 7–9 t. Therrien & Henderson 2007 (12–20.9 t) excluded. |
| `heavy.speed`         | m/s   |     2 |     4 |     6 | **S** | No estimate. Semi-aquatic, short hind limbs (Ibrahim 2014); bipedal on land (Sereno 2022).                |
| `heavy.turnRate`      | deg/s |    15 |    22 |    32 | **S** | Long body; no agility data.                                                                               |
| `heavy.biteForce`     | kN    |     3 |     6 |    12 |   L   | Sakamoto 2022: 4.8 kN anterior / 11.9 kN posterior.                                                       |
| `heavy.biteLethality` | HP/kN |     3 |     6 |    10 | **S** | Conical, unserrated teeth suited to gripping fish.                                                        |
| `heavy.biteInterval`  | s     |     1 |     2 |   3.5 | **S** | Jaws built for fast closure (Sakamoto 2022).                                                              |
| `heavy.biteReach`     | m     |     5 |     6 |     7 | **S** | Geometry: long narrow snout.                                                                              |
| `heavy.biteArc`       | deg   |    25 |    40 |    60 | **S** | Narrow snout.                                                                                             |
| `heavy.biteAccuracy`  | p     |  0.25 |  0.45 |  0.65 | **S** | —                                                                                                         |
| `heavy.shakeRate`     | 1/s   |  0.05 |  0.12 |  0.25 | **S** | —                                                                                                         |
| `heavy.bodyRadius`    | m     |   2.2 |   2.7 |   3.2 | **S** | Geometry.                                                                                                 |

### 5.9 Nile crocodile (HEAVY, deferred)

- **Evidence.** Adult males 225–750 kg [WP]. Measured bite 3.0 kN in 86 kg animals; the interspecific regression F = 29.632·m + 569 N gives 7.2–22.8 kN at 225–750 kg [Erickson 2012]. On land: bursts to 14 km/h [WP]. No crocodylian has been recorded above 5 m/s, and galloping has only been measured in animals up to 50 kg [Hutchinson 2019].
- **Interactions.** Crocodiles and lions mostly avoid each other. They contest carcasses near water, and either can prey on the other when the size difference is large [WP].
- **Why deferred.** Its weapon is an ambush from water followed by a grip-and-hold and a death roll. The engine has no water, no ambush start and no heavy grab-and-hold (§9).

| Parameter             | Unit  |  min | mode |  max | Basis | Source / rationale                                                                                                                                                    |
| --------------------- | ----- | ---: | ---: | ---: | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    |  225 |  400 |  750 |   L   | Adult males 225–750 kg; mean adult male ≈ 280 kg at 4 m; records > 1,000 kg (via Wikipedia, citing Cott 1961 and Graham 1968).                                        |
| `heavy.speed`         | m/s   |  1.5 |  2.5 |  3.9 |   L   | Brief land bursts up to 14 km/h (Wikipedia). No crocodylian has been recorded above 5 m/s, and galloping has only been measured in animals ≤ 50 kg (Hutchinson 2019). |
| `heavy.turnRate`      | deg/s |   20 |   40 |   80 | **S** | Slow body, fast lateral head snap.                                                                                                                                    |
| `heavy.biteForce`     | kN    |    7 |   12 |   23 |   D   | Erickson 2012 interspecific regression F = 29.632·m + 569 N → 7.2 kN at 225 kg, 12.4 kN at 400 kg, 22.8 kN at 750 kg. Measured 86 kg Nile crocodiles: 3.0 kN.         |
| `heavy.biteLethality` | HP/kN |    4 |    8 |   12 | **S** | —                                                                                                                                                                     |
| `heavy.biteInterval`  | s     |    2 |    4 |    8 | **S** | Grip-and-hold, not repeated bites.                                                                                                                                    |
| `heavy.biteReach`     | m     |  1.5 |  1.9 |  2.4 | **S** | —                                                                                                                                                                     |
| `heavy.biteArc`       | deg   |   40 |   60 |   90 | **S** | —                                                                                                                                                                     |
| `heavy.biteAccuracy`  | p     |  0.3 |  0.5 | 0.75 | **S** | Ambush strikes are accurate; open-field accuracy unknown.                                                                                                             |
| `heavy.shakeRate`     | 1/s   | 0.05 | 0.15 |  0.4 | **S** | Rolling could dislodge riders.                                                                                                                                        |
| `heavy.bodyRadius`    | m     |  0.8 |    1 |  1.3 | **S** | —                                                                                                                                                                     |

### 5.10 Tiger (PACK, incumbent)

Unchanged from MODEL.md §5.2. One additional documented interaction is worth a matchup preset: Amur tigers vs brown bears (§5.4). Tigers are also documented against dhole packs, with the outcome depending on pack size [WP: Tiger]. That would make the tiger a HEAVY preset; see §12.

| Parameter               | Unit |  min |  mode |   max | Basis | Source / rationale                                                |
| ----------------------- | ---- | ---: | ----: | ----: | :---: | ----------------------------------------------------------------- |
| `pack.mass`             | kg   |  100 |   180 |   260 |   L   | Current default (MODEL.md §5.2).                                  |
| `pack.sprintSpeed`      | m/s  |   11 |    14 |    18 | **S** | Current default.                                                  |
| `pack.cruiseSpeed`      | m/s  |    4 |     6 |     8 | **S** | Current default.                                                  |
| `pack.sprintEndurance`  | s    |   10 |    20 |    40 | **S** | Current default.                                                  |
| `pack.latchEndurance`   | s    |   15 |    30 |    60 | **S** | Current default.                                                  |
| `pack.recoveryTime`     | s    |   30 |    60 |   120 | **S** | Current default.                                                  |
| `pack.latchChance`      | p    | 0.15 |  0.35 |   0.6 | **S** | Current default.                                                  |
| `pack.dps`              | HP/s |    2 |     6 |    12 |   D   | Current default: bite 1.2–1.5 kN × 4–12 HP/kN per 1–2 s.          |
| `pack.bleed`            | 1/s  |    0 | 0.002 | 0.005 | **S** | Current default.                                                  |
| `pack.morale`           | 0–1  |  0.4 |   0.6 |  0.85 | **S** | Current default.                                                  |
| `pack.moraleLoss`       | 0–1  | 0.03 |  0.08 |  0.15 | **S** | Current default.                                                  |
| _constant_ `packRadius` | m    |      |   0.8 |       | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m). |

### 5.11 Lion (PACK)

- **Evidence.** Females 110–144 kg, males 160–225 kg (Southern Africa) [WP, Smuts 1980]. Top speed 74.1 km/h recorded [WP, Wilson 2018]; lions normally run only in short bursts at 48–59 km/h [WP]. A lioness bite measured 1,594 N at the canines [WP, van der Meijden 2023]; the Wroe 2005 estimate of 1,768 N is quoted by secondary sources **[U]**.
- **Cooperation.** Prides average about 15, and up to 30 have been observed [WP]. In coordinated hunts, "wing" lionesses circle and start the attack while "centres" wait for prey fleeing toward them, and each lioness repeats her position [Stander 1992]. A companion Etosha study by the same author ("Foraging dynamics of lions in a semi-arid environment", 1992) reports capture success rising with group size (abstract via search; citation details **[U]**).
- **Engine cannot express:** position-specific latch effects (a nose hold on a buffalo is lethal, a rump hold is not), and role assignment (wing vs centre), which `flank` only approximates.

| Parameter               | Unit |  min |  mode |   max | Basis | Source / rationale                                                                                                  |
| ----------------------- | ---- | ---: | ----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`             | kg   |  110 |   150 |   225 |   L   | Females 110–144 kg, males 160–225 kg (Smuts 1980, via Wikipedia). Mode for a mixed hunting pride.                   |
| `pack.sprintSpeed`      | m/s  |   11 |    14 |  20.6 |   L   | Short bursts at 48–59 km/h; 74.1 km/h (20.6 m/s) recorded by Wilson 2018 (via Wikipedia).                           |
| `pack.cruiseSpeed`      | m/s  |    3 |     5 |     7 | **S** | —                                                                                                                   |
| `pack.sprintEndurance`  | s    |    8 |    15 |    30 | **S** | Lions run fast only in short bursts; heart ~0.45–0.57 % of body mass (via Wikipedia).                               |
| `pack.latchEndurance`   | s    |   20 |    45 |   120 | **S** | Can hold an ungulate throat up to 13 min (via Wikipedia), but riding a large, moving animal is shorter.             |
| `pack.recoveryTime`     | s    |   40 |    90 |   180 | **S** | —                                                                                                                   |
| `pack.latchChance`      | p    |  0.2 |   0.4 |  0.65 | **S** | Coordinated pride roles ("wings" and "centres", Stander 1992). Success rises with group size (Stander 1992 Etosha). |
| `pack.dps`              | HP/s |  2.5 |     7 |    14 |   D   | Bite 1.2–1.8 kN: lioness measured 1,594 N (van der Meijden 2023); Wroe 2005 estimate 1,768 N. Formula in §3.3.      |
| `pack.bleed`            | 1/s  |    0 | 0.002 | 0.005 | **S** | As tiger.                                                                                                           |
| `pack.morale`           | 0–1  | 0.45 |  0.65 |   0.9 | **S** | Social hunters; prides persist against elephants (Power & Compion 2009) but adults are usually avoided.             |
| `pack.moraleLoss`       | 0–1  | 0.02 |  0.06 |  0.12 | **S** | —                                                                                                                   |
| _constant_ `packRadius` | m    |      |   0.8 |       | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m).                                                   |

### 5.12 Gray wolf (PACK)

- **Evidence.** Mean body mass 40 kg, range 12–79 kg [WP]. No peer-reviewed sprint speed was found; 56–65 km/h is **U**. Packs average 8 in North America and 5.5 in Europe, with up to 42 recorded [WP].
- **Cooperation.** Against bison, capture success rises with group size and levels off at 9–13 wolves; solo capture success is 0.01 on bison vs 0.14 on elk [MacNulty 2014]. The paper's ethogram (approach → attack-group → attack-individual → capture, "biting and restraining") maps closely onto the engine's Approach → Latched states [MacNulty 2014, Table 1].
- **Engine cannot express:** coursing a fleeing heavy (heavies never flee), and ganging up on one target in the "attack-individual" phase. `flank` spreads attackers instead.

| Parameter               | Unit |   min |  mode |   max | Basis | Source / rationale                                                                                                               |
| ----------------------- | ---- | ----: | ----: | ----: | :---: | -------------------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`             | kg   |    30 |    42 |    60 |   L   | Mean 40 kg; > 54 kg uncommon; record 79 kg (via Wikipedia).                                                                      |
| `pack.sprintSpeed`      | m/s  |    12 |    15 |    18 | **U** | Popular 56–65 km/h; no peer-reviewed measurement found.                                                                          |
| `pack.cruiseSpeed`      | m/s  |   2.5 |     4 |     6 | **U** | Trot ~10 km/h (popular); lope faster.                                                                                            |
| `pack.sprintEndurance`  | s    |    20 |    40 |    90 | **S** | Moose chases in a Scandinavian snow-tracking study were short (SLU, 1997–2003; units unverified); wolves are endurance trotters. |
| `pack.latchEndurance`   | s    |    10 |    25 |    60 | **S** | Wolves bite and hang on hindquarters or nose ("capture: biting and restraining", MacNulty 2014).                                 |
| `pack.recoveryTime`     | s    |    30 |    60 |   120 | **S** | —                                                                                                                                |
| `pack.latchChance`      | p    |   0.1 |  0.25 |  0.45 | **S** | Calibration only: solo capture success 0.01 on bison vs 0.14 on elk (MacNulty 2014).                                             |
| `pack.dps`              | HP/s |   0.8 |   2.5 |     6 |   D   | Bite ≈ 0.4–0.75 kN derived from BFQ 136 (formula in §3.3).                                                                       |
| `pack.bleed`            | 1/s  | 0.001 | 0.003 | 0.006 | **S** | Wolves may wound large prey and rest before killing it (via Wikipedia).                                                          |
| `pack.morale`           | 0–1  |  0.35 |  0.55 |   0.8 | **S** | Bear–wolf carcass conflicts mostly end without bloodshed (via Wikipedia).                                                        |
| `pack.moraleLoss`       | 0–1  |  0.03 |  0.08 |  0.15 | **S** | —                                                                                                                                |
| _constant_ `packRadius` | m    |       |   0.5 |       | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m).                                                                |

### 5.13 Spotted hyena (PACK)

- **Evidence.** 40–64 kg in the Serengeti, ~68 kg in Zambia [WP]. Chases of several kilometres at up to 60 km/h; heart ~1 % of body mass [WP]. Estimated 566 N canine and 986 N carnassial bite for a 63 kg animal [WP, Christiansen & Wroe 2007]. 4,500 N is the highest bite force recorded in a carnivoran [Erickson 2012], from a captive-hyena study (Binder & Van Valkenburgh 2000, via WP).
- **Cooperation.** Clans of up to 80. Hyenas hunt alone, in parties of 2–5 or in large groups [WP]. They usually prevail against lionesses without males when they outnumber them 4 : 1 [WP].
- **Engine cannot express:** morale that depends on the local numbers ratio (§9, M11).

| Parameter               | Unit |   min |  mode |   max | Basis | Source / rationale                                                                                                                                                               |
| ----------------------- | ---- | ----: | ----: | ----: | :---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`             | kg   |    40 |    55 |    70 |   L   | Serengeti males 40.5–55 kg, females 44.5–63.9 kg; Zambia ~68 kg (via Wikipedia).                                                                                                 |
| `pack.sprintSpeed`      | m/s  |    11 |    14 |  16.7 |   L   | Chases at up to 60 km/h (Kruuk 1972, via Wikipedia).                                                                                                                             |
| `pack.cruiseSpeed`      | m/s  |     3 |   4.5 |     6 | **S** | —                                                                                                                                                                                |
| `pack.sprintEndurance`  | s    |    30 |    60 |   150 | **S** | Chases of several km; heart ~1 % of body mass (via Wikipedia).                                                                                                                   |
| `pack.latchEndurance`   | s    |    15 |    30 |    60 | **S** | —                                                                                                                                                                                |
| `pack.recoveryTime`     | s    |    30 |    60 |   120 | **S** | —                                                                                                                                                                                |
| `pack.latchChance`      | p    |  0.15 |   0.3 |   0.5 | **S** | Calibration only: wildebeest calves 15 % solo vs 74 % in groups (Kruuk 1972, secondary); ~1/3 of attempts succeed in Masai Mara (Holekamp 1997, secondary).                      |
| `pack.dps`              | HP/s |   1.2 |     4 |    12 |   D   | Estimated 566 N canine / 986 N carnassial for 63 kg (Christiansen & Wroe 2007, via Wikipedia); 4,500 N measured maximum (Binder & Van Valkenburgh 2000, cited by Erickson 2012). |
| `pack.bleed`            | 1/s  | 0.001 | 0.003 | 0.008 | **S** | Feeds on live prey.                                                                                                                                                              |
| `pack.morale`           | 0–1  |  0.35 |  0.55 |   0.8 | **S** | Prevails against lionesses at ≥ 4:1 (via Wikipedia): numbers-dependent courage the engine cannot express.                                                                        |
| `pack.moraleLoss`       | 0–1  |  0.03 |  0.08 |  0.15 | **S** | —                                                                                                                                                                                |
| _constant_ `packRadius` | m    |       |   0.6 |       | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m).                                                                                                                |

### 5.14 African wild dog (PACK, phase 2)

- **Evidence.** 18–36 kg [WP]. All six collared dogs reached 19 m/s stride speed at least once; chases averaged 447 m (median 324 m); 49 % of distance was walked and 31 % trotted [Hubel 2016a].
- **Cooperation.** Packs of 2–27 adults [WP]. The individual kill rate was 15.5 %, with "no evidence of cooperative chasing" beyond travelling together and sharing kills [Hubel 2016b]. On "hard" prey (wildebeest), group success rises up to 12–14 dogs [MacNulty 2014, citing Creel & Creel].
- **Fit.** Good, but its species bounds must allow 18 kg (the v1 minimum is 30 kg).

| Parameter               | Unit |   min |  mode |  max | Basis | Source / rationale                                                                    |
| ----------------------- | ---- | ----: | ----: | ---: | :---: | ------------------------------------------------------------------------------------- |
| `pack.mass`             | kg   |    18 |    24 |   36 |   L   | 18–36 kg; East Africa 20–25 kg (via Wikipedia).                                       |
| `pack.sprintSpeed`      | m/s  |    12 |    16 |   19 |   L   | All six collared dogs reached 19 m/s stride speed at least once (Hubel 2016a).        |
| `pack.cruiseSpeed`      | m/s  |   2.5 |     4 |    6 | **S** | Most distance at walk (49 %) and trot (31 %) (Hubel 2016a).                           |
| `pack.sprintEndurance`  | s    |    15 |    35 |   90 |   D   | Mean chase 447 m, median 324 m (Hubel 2016a) at roughly 10–14 m/s.                    |
| `pack.latchEndurance`   | s    |    10 |    20 |   45 | **S** | —                                                                                     |
| `pack.recoveryTime`     | s    |    20 |    45 |   90 | **S** | 2.4 chases per dog per day (Hubel 2016a).                                             |
| `pack.latchChance`      | p    |   0.1 |  0.25 | 0.45 | **S** | Calibration only: individual kill rate 15.5 % of chases (Hubel 2016b).                |
| `pack.dps`              | HP/s |   0.8 |     2 |    4 |   D   | Canine bite ≈ 0.43 kN (Wroe 2005 table, via search snippet; matches the BFQ formula). |
| `pack.bleed`            | 1/s  | 0.001 | 0.004 | 0.01 | **S** | Large prey bitten repeatedly on legs, belly and rump (via Wikipedia).                 |
| `pack.morale`           | 0–1  |   0.5 |   0.7 |  0.9 | **S** | Strong bonds; packs defend members against lions (via Wikipedia).                     |
| `pack.moraleLoss`       | 0–1  |  0.02 |  0.05 |  0.1 | **S** | —                                                                                     |
| _constant_ `packRadius` | m    |       |  0.45 |      | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m).                     |

### 5.15 Deinonychus and other dromaeosaurids (PACK, phase 2)

- **Evidence.** 60–73 kg [WP, Paul], 70–100 kg [WP, Brinkman 1998], 100 kg [WP, Campione 2014]. Bite 0.3 / 0.7 kN anterior/posterior [Sakamoto 2022], against 4.1–8.2 kN inferred from bite marks on _Tenontosaurus_ [Gignac 2010]. Sakamoto argues the lower figure is right for an animal of this size. Ostrom judged it "not particularly fast" from its foot/tibia ratio (0.48) [WP].
- **Behaviour.** The "raptor prey restraint" model: leap on, pin under body weight, grip with the sickle claws, feed until the prey dies of blood loss [WP, Fowler 2011]. This maps naturally onto latch + dps + bleed. Pack hunting is contested: Komodo-like mobbing and cannibalism [WP, Roach & Brinkman 2007] vs parallel trackways [WP, Li 2007].
- **Variants:**
  - **Velociraptor:** mass 14 / 17 / 20 kg **L** [WP]; sprint 8 / 10.8 / 13 m/s **L** [Sellers & Manning 2007]; dps 0.3 / 1 / 2.5 **D** (0.13 / 0.30 kN bite [Sakamoto 2022]); `packRadius` 0.35 m.
  - **Utahraptor:** mass 280 / 400 / 500 kg **L** [WP]; sprint 6 / 8 / 11 m/s **S**; dps 3 / 10 / 25 **S**; `packRadius` 1.0 m.
  - **Dakotaraptor** is the only large dromaeosaurid once reported from _T. rex_'s Hell Creek Formation. Parts of its material turned out to be turtle bones, and its status is unresolved [WP: Dakotaraptor]. Do not market "_T. rex_ vs Dakotaraptor" as historical.

| Parameter               | Unit |   min |  mode |  max | Basis | Source / rationale                                                                                                               |
| ----------------------- | ---- | ----: | ----: | ---: | :---: | -------------------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`             | kg   |    60 |    75 |  100 |   L   | Paul: 60–73 kg; Brinkman 1998: 70–100 kg; Campione 2014: 100 kg (via Wikipedia).                                                 |
| `pack.sprintSpeed`      | m/s  |     7 |    10 |   13 | **S** | No estimate. Ostrom 1976: "not particularly fast" (foot/tibia 0.48). Sellers & Manning 2007: 10.8 m/s for 20 kg Velociraptor.    |
| `pack.cruiseSpeed`      | m/s  |   2.5 |     4 |    6 | **S** | —                                                                                                                                |
| `pack.sprintEndurance`  | s    |    10 |    20 |   40 | **S** | —                                                                                                                                |
| `pack.latchEndurance`   | s    |    15 |    30 |   60 | **S** | "Raptor prey restraint": leap on, pin, grip with sickle claws (Fowler 2011).                                                     |
| `pack.recoveryTime`     | s    |    30 |    60 |  120 | **S** | —                                                                                                                                |
| `pack.latchChance`      | p    |  0.15 |  0.35 |  0.6 | **S** | Grasping feet and sickle claws (Fowler 2011).                                                                                    |
| `pack.dps`              | HP/s |     1 |     4 |   15 |   D   | Bite 0.3–0.7 kN (Sakamoto 2022) vs 4.1–8.2 kN from bite marks (Gignac 2010); claws add damage. Wide and right-skewed on purpose. |
| `pack.bleed`            | 1/s  | 0.001 | 0.004 | 0.01 | **S** | RPR model: prey dies of blood loss (Fowler 2011).                                                                                |
| `pack.morale`           | 0–1  |   0.3 |  0.55 |  0.8 | **S** | Cooperative pack hunting is debated (Roach & Brinkman 2007; Li 2007; Frederickson 2020).                                         |
| `pack.moraleLoss`       | 0–1  |  0.03 |  0.08 | 0.15 | **S** | —                                                                                                                                |
| _constant_ `packRadius` | m    |       |   0.6 |      | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m).                                                                |

### 5.16 Komodo dragon (PACK, deferred)

- **Evidence.** Wild adults ~70 kg, males 79–91 kg; sprints up to 20 km/h [WP]. Measured maximum bite 148.6 N and pull 336.5 N; earlier FE models predicted 39 N [D'Amore 2011]. Venom with anticoagulant and shock-inducing effects [Fry 2009]. Takes deer, pigs and water buffalo [WP].
- **Behaviour.** A slashing "grip and rip" bite with venom and anticoagulant saliva. Komodo dragons try to kill on the spot through laceration and blood loss, usually within a few minutes and in under half an hour in successful hunts; the older "bite and wait for sepsis" story is attributed to misread failed attacks [WP].
- **Why deferred.** Repeated slashing strikes do not map onto a sustained latch, and Komodo groups are feeding aggregations, not cooperative hunters [WP]. With latch + bleed, buffalo × 1 vs Komodo × 5 ended in 17 % draws at the 20-minute cap (§8). A hit-and-run strike mode (M7) is the better fit.

| Parameter               | Unit |   min |  mode |  max | Basis | Source / rationale                                                |
| ----------------------- | ---- | ----: | ----: | ---: | :---: | ----------------------------------------------------------------- |
| `pack.mass`             | kg   |    50 |    75 |   90 |   L   | Wild adults ~70 kg; males 79–91 kg; max ~150 kg (via Wikipedia).  |
| `pack.sprintSpeed`      | m/s  |   3.5 |   4.5 |  5.6 |   L   | Brief sprints up to 20 km/h (via Wikipedia).                      |
| `pack.cruiseSpeed`      | m/s  |   0.8 |   1.2 |    2 | **S** | —                                                                 |
| `pack.sprintEndurance`  | s    |     5 |    10 |   20 | **S** | Ectotherm, short bursts.                                          |
| `pack.latchEndurance`   | s    |     5 |    10 |   20 | **S** | "Grip and rip", not a sustained hold (D'Amore 2011).              |
| `pack.recoveryTime`     | s    |    60 |   180 |  600 | **S** | Ectotherm anaerobic recovery.                                     |
| `pack.latchChance`      | p    |  0.15 |   0.3 |  0.5 | **S** | —                                                                 |
| `pack.dps`              | HP/s |   0.3 |     1 |    3 |   D   | Measured bite max 149 N, pull max 337 N (D'Amore 2011).           |
| `pack.bleed`            | 1/s  | 0.002 | 0.008 | 0.02 | **S** | Anticoagulant venom (Fry 2009) mapped onto bleeding.              |
| `pack.morale`           | 0–1  |   0.3 |   0.5 |  0.7 | **S** | —                                                                 |
| `pack.moraleLoss`       | 0–1  |  0.02 |  0.05 |  0.1 | **S** | —                                                                 |
| _constant_ `packRadius` | m    |       |   0.5 |      | **S** | Body contact radius (engine constant `tigerRadius` today, 0.8 m). |

### 5.17 Excluded

- **Gorilla:** not a predator, and no heavy-vs-pack interaction data exist. Excluded under the no-humans ground rule.
- **Dhole, American bison:** not assessed in depth. Both are strong future candidates: dhole packs vs tiger is documented [WP: Tiger], and bison has the best group-size data set [MacNulty 2014].

## 6. Recommended initial catalog

**Phase 1: eight species that run on the current engine with only renaming, relabelling, per-species bounds and `packRadius`.**

| Species               | Ko name        | Role  | Why                                            | Data quality                      | Needs                                         |
| --------------------- | -------------- | ----- | ---------------------------------------------- | --------------------------------- | --------------------------------------------- |
| _T. rex_              | 티라노사우루스 | HEAVY | Incumbent, brand                               | Good for mass, speed, bite        | Nothing                                       |
| African bush elephant | 아프리카코끼리 | HEAVY | Documented lion-pride predation (Savuti)       | Good mass and speed; weapon **S** | Weapon label override; `hide` advised         |
| African buffalo       | 아프리카물소   | HEAVY | Classic lion prey; buffalo also kill lions     | Good mass; speed **U**            | Weapon label override; `hide` advised         |
| Brown bear            | 불곰           | HEAVY | Documented vs wolves and vs Amur tigers        | Good mass and speed; bite **D**   | own mass bounds (from 100 kg); `hide` advised |
| Tiger                 | 호랑이         | PACK  | Incumbent                                      | As MODEL.md                       | Nothing                                       |
| Lion                  | 사자           | PACK  | The best-documented group hunter of large prey | Good mass, speed, bite            | Nothing                                       |
| Gray wolf             | 회색늑대       | PACK  | Best group-size success data [MacNulty 2014]   | Good mass; speed **U**            | `packRadius` 0.5                              |
| Spotted hyena         | 점박이하이에나 | PACK  | Large clans, measured bite, long chases        | Good                              | `packRadius` 0.6                              |

**Phase 2** (no new mechanics, weaker data or interactions): Giganotosaurus, Allosaurus, polar bear (HEAVY); Deinonychus with Velociraptor and Utahraptor variants, and African wild dog (PACK; needs its own mass bounds).

**Deferred until new mechanics exist** (§9): Nile crocodile (M8, M9), Spinosaurus (M9, M10), Komodo dragon (M7).

**Alternative for a dinosaur-first brand:** swap African buffalo and spotted hyena for Giganotosaurus and Deinonychus. Both run on today's engine, but the result is fantasy-only and has no field calibration.

## 7. Proposed matchups

Classes: **Documented** = field observations exist; **Proxy** = a calibration stand-in; **Fantasy** = the species never met. "Feasibility" values come from scratch runs (§8). They are indicative, and some show exactly why calibration is needed.

| #   | Heavy × n               | Pack × m         | Class                               | Why it is interesting / reality check                    | Feasibility (heavy / pack / draw, median s)         |
| --- | ----------------------- | ---------------- | ----------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| 1   | Elephant × 5            | Lion × 30        | Documented                          | Herd vs large pride (Savuti). Expect the herd to hold    | 98 / 0 / 3 %, 338 s                                 |
| 2   | Elephant (juvenile) × 1 | Lion × 27        | Documented                          | Savuti victim class (4–11 yr). Expect lions to win       | 0 / 100 / 0 %, 35 s                                 |
| 3   | Elephant × 1            | Lion × 27        | Documented (rare)                   | Lone adult cow. Expect the elephant to survive most runs | **11 / 89 / 0 %**, 201 s → needs `hide`             |
| 4   | Buffalo × 1             | Lion × 6         | Documented                          | Classic hunt                                             | 9 / 92 / 0 %, 64 s                                  |
| 5   | Buffalo × 10            | Lion × 12        | Documented                          | Herd protection in the open                              | 100 / 0 / 0 %, 70 s                                 |
| 6   | Brown bear × 1          | Wolf × 8         | Documented                          | Carcass dispute; bears normally dominate                 | **21 / 80 / 0 %**, 74 s → needs `hide` / 360° swipe |
| 7   | Brown bear × 1          | Tiger × 1        | Documented                          | Russian Far East; reuses the incumbent tiger             | 88 / 0 / 13 %, 42 s                                 |
| 8   | Buffalo × 1             | Wolf × 1–16      | Proxy                               | Bison stand-in for [MacNulty 2014] group-size curve      | §8.2                                                |
| 9   | Buffalo × 1             | Hyena × 15       | Documented (rare)                   | Hyenas occasionally take adult bulls                     | 0 / 100 / 0 %, 27 s (too easy)                      |
| 10  | Elephant × 1            | Wild dog × 20    | Fantasy (sympatric, not documented) | Small attackers vs a giant                               | 70 / 29 / 1 %, 332 s                                |
| 11  | _T. rex_ × 1            | Tiger × 10       | Fantasy (current preset)            | Baseline                                                 | 91 / 8 / 2 %, 370 s                                 |
| 12  | _T. rex_ × 1            | Deinonychus × 20 | Fantasy                             | The film matchup; 30+ Myr apart                          | 59 / 41 / 1 %, 280 s                                |
| 13  | _T. rex_ × 1            | Lion × 30        | Fantasy                             | Brand extension                                          | 13 / 88 / 0 %, 203 s                                |
| 14  | _T. rex_ × 1            | Wolf × 50        | Fantasy                             | Brand extension                                          | 45 / 56 / 0 %, 242 s                                |
| 15  | _T. rex_ × 1            | Utahraptor × 10  | Fantasy                             | Large dromaeosaurs                                       | 73 / 28 / 0 %, 278 s                                |
| 16  | Giganotosaurus × 1      | Lion × 20        | Fantasy                             | Largest-theropod pairing                                 | 19 / 82 / 0 %, 240 s                                |
| 17  | Giganotosaurus × 1      | Deinonychus × 20 | Fantasy                             | Overlapping era, different continents                    | 36 / 65 / 0 %, 245 s                                |
| 18  | Allosaurus × 1          | Deinonychus × 10 | Fantasy                             | Mid-size theropod                                        | 33 / 68 / 0 %, 155 s                                |
| 19  | Allosaurus × 1          | Wolf × 15        | Fantasy                             | Brand extension                                          | 44 / 56 / 0 %, 174 s                                |
| 20  | Polar bear × 1          | Wolf × 8         | Fantasy (no data found)             | Arctic setting                                           | 60 / 40 / 1 %, 147 s                                |

Deferred-species checks: Spinosaurus × 1 vs tiger × 10: 91 / 9 / 1 %. Nile crocodile × 1 vs lion × 3 on land: 12 / 82 / 7 %; the crocodile loses its water advantage. Buffalo × 1 vs Komodo × 5: 83 / 1 / 17 % (too slow to finish within the cap).

## 8. Feasibility runs and calibration findings

### 8.1 Method

- A scratch copy of `src/sim` at `6c84e0e`, compiled with the repo's `tsc` into the scratchpad. The repository itself was not touched.
- Only change: global bounds widened (`trex.mass` min 50, `trex.biteForce` min 0.1, `tiger.mass` 5–1,000), standing in for per-species bounds. Species ranges were mapped onto `trex.*`/`tiger.*`, and `CONSTANTS.tigerRadius` was set to each species' `packRadius`.
- Defaults otherwise: seed 20261019, LHS, CV 0.08, 600 m arena, 1,200 s cap, `flank`, morale on. 200 runs per matchup (95 % CI about ±7 pp at mid probabilities) and 300 in the sweeps.
- **Sanity check:** the default scenario (10 _T. rex_ vs 100 tigers, 100 runs) gave 100 % _T. rex_, median 26.9 s and 13.8 tigers killed, matching MODEL.md §6.

### 8.2 Wolves vs a lone buffalo (bison proxy)

| Wolves                         | 1   | 2   | 3   | 4    | 5    | 6    | 8    | 10   | 12   | 14    | 16    |
| ------------------------------ | --- | --- | --- | ---- | ---- | ---- | ---- | ---- | ---- | ----- | ----- |
| P(wolves win), morale on       | 0 % | 1 % | 3 % | 7 %  | 18 % | 37 % | 62 % | 79 % | 90 % | 94 %  | 98 %  |
| P(wolves win), morale off      | 1 % | 2 % | 5 % | 16 % | 30 % | 51 % | 82 % | 94 % | 99 % | 100 % | 100 % |
| Median duration (s), morale on | 61  | 60  | 79  | 99   | 119  | 121  | 111  | 90   | 69   | 52    | 44    |

**Reading.** The curve is sigmoidal: almost nothing for 1–3 wolves, then a plateau from about 12. MacNulty et al. found that bison capture success "levelled off at 9–13 wolves", with a solo capture probability of 0.01 [MacNulty 2014]. The **shape** is encouraging, but the quantities differ: the model measures "kill within 20 min", the field data measure capture per encounter. A "first kill" metric (§9, M3) would make the two comparable.

### 8.3 Lions vs elephants

| Lions                               | 5    | 10   | 15   | 20    | 27    | 35    |
| ----------------------------------- | ---- | ---- | ---- | ----- | ----- | ----- |
| P(lions win) vs juvenile (≈ 0.9 t)  | 53 % | 93 % | 99 % | 100 % | 100 % | 100 % |
| P(lions win) vs adult cow (≈ 3.2 t) | 6 %  | 33 % | 62 % | 77 %  | 89 %  | 95 %  |

The juvenile pattern fits Savuti, where juveniles and subadults were the main victims [Power & Compion 2009]. The adult result does **not** fit: adult elephants are "considered invulnerable to predation" [WP: African bush elephant], yet 27 lions kill a lone cow 89 % of the time.

### 8.4 Why mid-size heavies are too fragile, and a fix

- With 1 HP/kg, a 3.2 t elephant has only ~21 lions' worth of HP. Its only defences are a frontal cone and a shake-off rate. The pack's dps ignores thick skin, fat and fur.
- **Test:** multiply pack damage against a given heavy by a `hide` factor.

| Matchup                              | hide 1.0      | hide 0.5 | hide 0.3 |
| ------------------------------------ | ------------- | -------- | -------- |
| Elephant (adult) × 1 vs lion × 27    | 11 % elephant | 36 %     | 60 %     |
| Elephant (juvenile) × 1 vs lion × 27 | 0 %           | 1 %      | 7 %      |
| Brown bear × 1 vs wolf × 8           | 19 % bear     | 56 %     | 77 %     |
| Buffalo × 1 vs lion × 6              | 7 % buffalo   | 41 %     | 71 %     |

- **Proposal:** a species constant `hide` (pack-damage multiplier, applied to dps and wound accumulation). Starting values: elephant 0.3, buffalo 0.5, brown/polar bear 0.5, _T. rex_ and theropods 1.0. All **S**; calibrate against the qualitative targets in §7.
- `x × 1.0` is exact in IEEE-754, so _T. rex_ results stay bit-identical.

### 8.5 Other findings

- **Herd effects emerge already.** 5 elephants hold off 30 lions (98 %) and 10 buffalo hold off 12 lions (100 %), because neighbours' cones cover each other's riders. This is consistent with herds protecting against lions in open areas [WP: African buffalo].
- **`pack.dps` is the top Spearman driver** in almost every matchup (|ρ| 0.3–0.6), followed by `heavy.shakeRate` and `heavy.mass`. Calibrating dps per species is therefore the priority. MODEL.md already found the same for the tiger.
- **A single tiger never kills a brown bear** (0 % in 200 runs; 13 % draws), while tigers do prey on bears in the Russian Far East [WP: Brown bear]. Solo attackers are disadvantaged by the latch/retreat cycle. Field data mainly concern subadult or denning bears, so this may be acceptable.
- **Komodo vs buffalo ends in 17 % draws:** low dps plus bleeding is too slow to finish within 20 minutes, while field kills take minutes [WP: Komodo dragon]. This points to burst strikes (M7) rather than a longer cap.

## 9. What the engine cannot express

| #   | Mechanic                        | Species that need it                      | Minimal proposal                                                                                             | Cost     | v1 impact                                 |
| --- | ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------- |
| M1  | Species constants and labels    | all                                       | `packRadius`, weapon label overrides (`biteForce` → "tusk/trample force", "horn force", "paw/bite force")    | trivial  | none                                      |
| M2  | Thick skin, fat, fur            | elephant, buffalo, bears                  | `hide` multiplier on incoming pack damage (§8.4)                                                             | tiny     | none (1.0)                                |
| M3  | Hunt success ≠ "kill everyone"  | all documented matchups                   | Record `firstHeavyDeath` per run; aggregate P(≥ 1 heavy killed) and time-to-first-kill                       | small    | none (new fields)                         |
| M4  | Herd mobbing / rescue           | buffalo, elephant                         | Heavy bite targeting also prefers attackers latched onto **other** heavies within reach (today only its own) | small    | behind a heavy constant, off for _T. rex_ |
| M5  | 360° close-range strikes        | bears, elephant (trunk), crocodile (tail) | Secondary weapon: reach = radius + ~1 m, half-arc 180°, own force and interval, as species constants         | moderate | none (absent for _T. rex_)                |
| M6  | Prey flees / escapes            | buffalo, elephant, bison                  | Heavy leaves when HP < threshold and reaches the edge → new outcome "escaped"                                | moderate | none (off for _T. rex_)                   |
| M7  | Hit-and-run strikes             | Komodo (slashing bite), wolves, wild dogs | Pack attack mode `strike`: instant damage + forced Recover, instead of a sustained latch                     | moderate | none (tiger keeps `latch`)                |
| M8  | Heavy grab-and-hold, death roll | crocodile                                 | Heavy can "pin" one pack agent: dps to it until shaken off, heavy slowed                                     | larger   | none                                      |
| M9  | Terrain, water, ambush start    | crocodile, Spinosaurus                    | Roadmap terrain item; water tiles change speeds; ambush spawn inside the pack                                | large    | spawn must stay identical for v1          |
| M10 | Heavy-vs-heavy duels            | Spinosaurus vs _T. rex_, bull elephants   | Symmetric engine with two HEAVY sides                                                                        | large    | separate mode                             |
| M11 | Numbers-dependent courage       | hyena (4 : 1 rule), wolves                | Morale change per second ∝ log(local pack count / local heavy count), as a species constant                  | small    | none (0 for tiger)                        |

**Rule for compatibility:** a new mechanic is either a species constant whose _T. rex_/tiger value is an exact identity (×1, +0, disabled branch), or a new sampled parameter **appended after the 22** with `individual: false`. It must also draw no random numbers when inactive. LHS columns are generated column by column from one stream (`sampling.ts`), so appended columns do not disturb the first 22. Per-animal draws in `simulateBattle` must not be inserted before existing ones.

## 10. Engine and UI change plan

### 10.1 Principles

1. Every v1 share link reproduces **bit-identically** (same design matrix, same battle RNG streams).
2. Still 22 sampled parameters in phase 1; new behaviour comes only from species constants.
3. No runtime dependencies, no inline styles, CSP unchanged.

### 10.2 Data model (`src/sim/species.ts`, new)

```ts
export type Role = 'heavy' | 'pack';
export type HeavyKey = 'mass' | 'speed' | 'turnRate' | 'biteForce' | 'biteLethality'
  | 'biteInterval' | 'biteReach' | 'biteArc' | 'biteAccuracy' | 'shakeRate' | 'bodyRadius';
export type PackKey = 'mass' | 'sprintSpeed' | 'cruiseSpeed' | 'sprintEndurance' | 'latchEndurance'
  | 'recoveryTime' | 'latchChance' | 'dps' | 'bleed' | 'morale' | 'moraleLoss';

export interface HeavySpecies {
  id: HeavySpeciesId; role: 'heavy';
  era: { fromMa: number; toMa: number } | 'extant';
  ranges: Record<HeavyKey, Triangular>;
  bounds: Record<HeavyKey, readonly [number, number]>; // trex: exactly the v1 bounds
  constants: { hide: number };                        // 1 for trex
  labels?: Partial<Record<HeavyKey, I18nKey>>;        // e.g. biteForce → 'param.weapon.tusk'
}
export interface PackSpecies {
  id: PackSpeciesId; role: 'pack';
  era: { fromMa: number; toMa: number } | 'extant';
  ranges: Record<PackKey, Triangular>;
  bounds: Record<PackKey, readonly [number, number]>;  // tiger: exactly the v1 bounds
  constants: { radius: number };                      // 0.8 for tiger
}
export const HEAVY_SPECIES: Record<HeavySpeciesId, HeavySpecies> = { trex: …, elephant: …, … };
export const PACK_SPECIES: Record<PackSpeciesId, PackSpecies> = { tiger: …, lion: …, … };
```

- `params.ts`: `PARAM_IDS` become `heavy.*` / `pack.*` **in the same order**. `ParamDef.species` becomes `role`. `ParamDef.bounds` moves to the species registry; `simulateBattle` and `sanitizeConfig` look bounds up through the selected species.
- `defaultParamRanges(heavy, pack)` builds from the species registry. The current `PARAMS[].default` triangles move into `HEAVY_SPECIES.trex` and `PACK_SPECIES.tiger` unchanged.

### 10.3 Config (`config.ts`)

- `ScenarioConfig` gains `heavySpecies`, `packSpecies`. Renames: `trexCount` → `heavyCount`, `tigerCount` → `packCount`, `tigerTactic` → `packTactic`. `LIMITS`, `workEstimate` and `maxRunsFor` are renamed accordingly, with the same numbers.
- `sanitizeConfig` validates species ids against the registry (fallback `trex`/`tiger`). Missing params come from the **selected species'** presets, not from the global default.

### 10.4 Share links (`share.ts`)

- v2 payload, for example `{"v":2,"heavy":"elephant","pack":"lion","heavyCount":5,"packCount":30,"params":{"pack.dps":[2,6,10]}}`. `configDiff` diffs against the selected species' presets, so links stay short.
- v1 upgrade (payload with `v` missing or `1`):

```ts
const V1_KEYS = {
  trexCount: 'heavyCount',
  tigerCount: 'packCount',
  tigerTactic: 'packTactic',
} as const;
function upgradeV1(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o, v: 2, heavy: 'trex', pack: 'tiger' };
  for (const [from, to] of Object.entries(V1_KEYS)) {
    if (Object.hasOwn(o, from)) {
      out[to] = o[from];
      delete out[from];
    }
  }
  const p = o['params'];
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    out['params'] = Object.fromEntries(
      Object.entries(p).map(([k, v]) => [
        k.replace(/^trex\./, 'heavy.').replace(/^tiger\./, 'pack.'),
        v, // sanitizeConfig then clamps with trex/tiger bounds, which equal the v1 bounds
      ]),
    );
  }
  return out;
}
```

- Tests to add to `tests/share.test.ts`:
  1. A fixed v1 fragment (captured from production) decodes to a config whose 20-run summaries **deep-equal** a fixture recorded on `6c84e0e` (golden test).
  2. A v1 fragment with an out-of-v1-bounds value (e.g. `trex.mass` 500) is clamped to 1,000, as today.
  3. v2 round-trip for each species pair.
  4. Unknown species id → fallback, no throw.
  5. A v2 link for _T. rex_/tiger produces the same config as the equivalent v1 link.

### 10.5 Engine (`engine.ts`) and Monte Carlo

- Mechanical rename: `P['trex.x']` → `P['heavy.x']` and `P['tiger.x']` → `P['pack.x']`. `CONSTANTS.tigerRadius` is read from `PACK_SPECIES[config.packSpecies].constants.radius`, and `hide` from the heavy species. `shockPad` (6.5 m) is unaffected: the sprint bound is still 35 m/s.
- `Outcome = { Heavy: 0, Pack: 1, Draw: 2 }` (same numeric codes). `RunSummary` fields become `heavyAlive`, `packKilled`, `packRouted`, `packActive`, `heavyHpFrac`, `heavyAdvantage`, plus `firstHeavyDeath` (M3). `BattleTrace` becomes `{ heavyCount, packCount, frames: { heavy, pack } }`. `AggregateResult` gets `pHeavy`/`pPack`.
- `TigerState` → `PackState`, with the same numeric values (the replay encodes them in `Float32Array`).
- Workers: `protocol.ts` carries the renamed types. The page and the workers ship in the same build, so no protocol versioning is needed.

### 10.6 UI (`form.ts`, `app.ts`, `charts.ts`, `replay.ts`, `styles.css`)

- **Species pickers:** two native `<select>` elements ("Heavy side", "Pack side") at the top of the scenario card, with `<optgroup>`s for extant and extinct species. Changing a species resets **that side's** 11 ranges to the preset. If the user had edited them, a toast "Ranges reset to {species} defaults" offers an "Undo" button (restores the previous ranges in memory).
- **Matchup presets** replace the count-only presets, e.g. "_T. rex_ vs tigers 10 v 100", "Elephant herd vs lion pride 5 v 30", "Buffalo vs lions 1 v 6", "Brown bear vs wolf pack 1 v 8", "Brown bear vs tiger 1 v 1".
- **Matchup badge** next to the verdict: "Documented interaction" (with a link to the SPECIES.md anchor) or "These species never met". The badge is computed from `era`.
- **Parameter table:** group headings use species names. Label overrides apply per species (weapon names). The per-row reset buttons reset to the selected species' preset.
- **Results text** is templated with species names: `verdict.heavy` = "{heavy} win probability {p} …".
- **Replay:** keep role colours (heavy = blue triangle, pack = orange dot) for consistency. Size the pack dot from `packRadius`. Legend labels come from species names.
- Layout: the pickers are full-width on mobile; no new horizontal scroll. Dark mode is unchanged (role tokens, not species tokens).

### 10.7 i18n (`i18n.ts`)

- New keys per species: `species.{id}.name` (ko/en) and English plurals via `Intl.PluralRules` (`species.wolf.one` = "wolf", `.other` = "wolves"; Korean needs none).
- Role-neutral templates. In Korean, avoid particles after names ("{heavy} 승리 확률 {p}", "{heavy} {n}마리 vs {pack} {m}마리").
- About 18 species × 2 languages plus ~20 role strings. The existing key-parity test in `tests/i18n.test.ts` covers them.

### 10.8 Docs

- New `docs/SPECIES.md` (this document, trimmed of §8–§10 once implemented).
- MODEL.md keeps the mechanics and the _T. rex_/tiger tables; per-species rationale moves to SPECIES.md.
- ROADMAP: replace "Additional species presets" with the phases in §6.

### 10.9 Rollout (one PR each)

| PR  | Content                                                                                                                          | Behaviour change     |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | Rename to `heavy.*` / `pack.*`, v2 share payload, v1 alias map, golden tests                                                     | None (bit-identical) |
| 2   | `species.ts` registry with _T. rex_ and tiger only (bounds move into it unchanged); config species fields; `packRadius` constant | None                 |
| 3   | Phase-1 species data, pickers, matchup presets, i18n, SPECIES.md                                                                 | New species only     |
| 4   | `hide` (M2), `firstHeavyDeath` (M3), calibration notes in SPECIES.md                                                             | New species only     |
| 5   | Phase-2 species with their own bounds                                                                                            | New species only     |

### 10.10 Risks

- **Silent result drift** from an inserted RNG draw. Mitigation: the golden test in PR 1, kept forever.
- **Out-of-bounds legacy values and per-animal clamping.** Mitigation: per-species bounds, with _T. rex_/tiger frozen at the v1 values, plus test 2 above.
- **Over-trusting presets.** Most behavioural values are **S**. Mitigation: show the evidence tag next to each preset value in the parameter table, e.g. a small "S" chip with a tooltip.

## 11. Content and AdSense considerations

- Google's publisher policies prohibit content that promotes cruelty or gratuitous violence toward animals; dog fighting and cockfighting are the examples given (paraphrased from a search summary of the policy page) [Google Publisher Policies, Abs]. Keep the current abstract visuals (dots and triangles, no gore) and the educational framing, and avoid domestic-animal matchups.
- The same policy page restricts content promoting products from endangered species (ivory, for example) [Google Publisher Policies, Abs]. Elephant copy should mention tusks only as anatomy.
- Each documented matchup can carry a short, sourced "What happens in the wild" note. This is unique explanatory content; coordinate with the SEO track. No claim is made here about how AdSense reviews sites.
- Cross-era matchups keep the existing "never coexisted" disclaimer, now generated from species `era`.

## 12. Open questions

1. **Brand:** stay "T-Rex vs Tiger Simulator" with a matchup picker, or rename to a neutral title with T-Rex vs Tiger as the default?
2. **HP model:** is a `hide` multiplier enough, or should HP scale sub-linearly with mass for large herbivores?
3. **Dual-role species:** tiger as HEAVY vs dhole packs, and lion as HEAVY vs hyena clans, are documented. Allow one species to carry both a HEAVY and a PACK preset?
4. **Calibration data** worth digitising: time-to-kill for wolves on bison [MacNulty 2014, Dryad data], lion hunt outcomes on buffalo by group size [Funston 2001], Savuti pride sizes per kill [Joubert 2006; Power & Compion 2009].
5. Should presets show their evidence tags in the UI (recommended) or only in docs?

## 13. References

Access: **[FT]** full text read; **[Abs]** abstract or search summary; **[WP]** via Wikipedia; **[MODEL]** already in `docs/MODEL.md`. Accessed 2026-10-19.

**Primary literature**

- **[Bates & Falkingham 2012]** Estimating maximum bite performance in _Tyrannosaurus rex_ using multi-body dynamics. _Biology Letters_ 8:660–664. <https://doi.org/10.1098/rsbl.2012.0056> [MODEL]
- **[Christiansen & Wroe 2007]** Bite forces and evolutionary adaptations to feeding ecology in carnivores. _Ecology_ 88:347–358. <https://doi.org/10.1890/0012-9658(2007)88[347:BFAEAT]2.0.CO;2> [WP]
- **[D'Amore 2011]** D'Amore D.C. et al. The effects of biting and pulling on the forces generated during feeding in the Komodo dragon. _PLoS ONE_ 6:e26226. <https://doi.org/10.1371/journal.pone.0026226> [FT]
- **[Erickson 2012]** Erickson G.M. et al. Insights into the ecology and evolutionary success of crocodilians revealed through bite-force and tooth-pressure experimentation. _PLoS ONE_ 7:e31781. <https://doi.org/10.1371/journal.pone.0031781> [FT]
- **[Fowler 2011]** The predatory ecology of _Deinonychus_ and the origin of flapping in birds. _PLoS ONE_ 6:e28964. <https://doi.org/10.1371/journal.pone.0028964> [WP]
- **[Fry 2009]** A central role for venom in predation by _Varanus komodoensis_. _PNAS_ 106:8969–8974. <https://doi.org/10.1073/pnas.0810883106> [Abs]
- **[Funston 2001]** Funston P.J., Mills M.G.L., Biggs H.C. Factors affecting the hunting success of male and female lions in the Kruger National Park. _J. Zool._ 253:419–431. <https://doi.org/10.1017/S0952836901000395> [Abs]
- **[Gignac 2010]** A description of _Deinonychus antirrhopus_ bite marks and estimates of bite force using tooth indentation simulations. _J. Vert. Paleontol._ 30:1169–1177. <https://doi.org/10.1080/02724634.2010.483535> [Abs]
- **[Hubel 2016a]** Hubel T.Y. et al. Energy cost and return for hunting in African wild dogs and cheetahs. _Nat. Commun._ 7:11034. <https://doi.org/10.1038/ncomms11034> [FT]
- **[Hubel 2016b]** Hubel T.Y. et al. Additive opportunistic capture explains group hunting benefits in African wild dogs. _Nat. Commun._ 7:11033. <https://doi.org/10.1038/ncomms11033> [FT abstract and introduction]
- **[Hutchinson 2003]** Hutchinson J.R. et al. Are fast-moving elephants really running? _Nature_ 422:493–494. <https://doi.org/10.1038/422493a> [Abs]
- **[Hutchinson 2006]** Hutchinson J.R. et al. The locomotor kinematics of Asian and African elephants: changes with speed and size. _J. Exp. Biol._ 209:3812–3827. <https://doi.org/10.1242/jeb.02443> [Abs]
- **[Hutchinson 2019]** Divergent evolution of terrestrial locomotor abilities in extant Crocodylia. _Sci. Rep._ <https://doi.org/10.1038/s41598-019-55768-6> [FT]
- **[Jimenez 2008]** Gray wolves, _Canis lupus_, killed by cougars, _Puma concolor_, and a grizzly bear, _Ursus arctos_, in Montana, Alberta, and Wyoming. _Can. Field-Nat._ 122:76–78. <https://doi.org/10.22621/cfn.v122i1.550> [Abs]
- **[Joubert 2006]** Hunting behaviour of lions (_Panthera leo_) on elephants (_Loxodonta africana_) in the Chobe National Park, Botswana. _Afr. J. Ecol._ 44:279–281. <https://doi.org/10.1111/j.1365-2028.2006.00626.x> [WP]
- **[Larramendi 2016]** Shoulder height, body mass and shape of proboscideans. _Acta Palaeontol. Pol._ 61:537–574. <https://doi.org/10.4202/app.00136.2014> [WP]
- **[MacNulty 2014]** MacNulty D.R., Tallian A., Stahler D.R., Smith D.W. Influence of group size on the success of wolves hunting bison. _PLoS ONE_ 9:e112884. <https://doi.org/10.1371/journal.pone.0112884> [FT]
- **[Power & Compion 2009]** Lion predation on elephants in the Savuti, Chobe National Park, Botswana. _African Zoology_ 44:36–44. <https://doi.org/10.3377/004.044.0104> [Abs]
- **[Rayfield 2001]** Cranial design and function in a large theropod dinosaur. _Nature_ 409:1033–1037. <https://doi.org/10.1038/35059070> [Abs]
- **[Sakamoto 2022]** Sakamoto M. Estimating bite force in extinct dinosaurs using phylogenetically predicted physiological cross-sectional areas of jaw adductor muscles. _PeerJ_ 10:e13731. <https://doi.org/10.7717/peerj.13731> [FT]
- **[Sellers 2017]** Investigating the running abilities of _Tyrannosaurus rex_ using stress-constrained multibody dynamic analysis. _PeerJ_ 5:e3420. <https://peerj.com/articles/3420/> [MODEL]
- **[Sellers & Manning 2007]** Estimating dinosaur maximum running speeds using evolutionary robotics. _Proc. R. Soc. B_ 274. <https://doi.org/10.1098/rspb.2007.0846>, full text <https://pmc.ncbi.nlm.nih.gov/articles/PMC2279215/> [FT]
- **[Sereno 2022]** Sereno P.C. et al. _Spinosaurus_ is not an aquatic dinosaur. _eLife_ 11:e80092. <https://doi.org/10.7554/eLife.80092> [FT]
- **[Snively 2019]** Snively E. et al. Lower rotational inertia and larger leg muscles indicate more rapid turns in tyrannosaurids than in other large theropods. _PeerJ_ 7:e6432. <https://doi.org/10.7717/peerj.6432> [FT]
- **[Stander 1992]** Cooperative hunting in lions: the role of the individual. _Behav. Ecol. Sociobiol._ 29:445–454. <https://doi.org/10.1007/BF00170175> [Abs]
- **[van der Meijden 2023]** Measurement of voluntary bite forces in large carnivores using a semi-automated reward-driven system. _J. Exp. Biol._ 226:jeb245255. <https://doi.org/10.1242/jeb.245255> [WP]
- **[Wilson 2018]** Biomechanics of predator–prey arms race in lion, zebra, cheetah and impala. _Nature_ 554:183–188. <https://doi.org/10.1038/nature25479> [WP]
- **[Wroe 2005]** Bite club: comparative bite force in big biting mammals and the prediction of predatory behaviour in fossil taxa. _Proc. R. Soc. B_ 272:619–625. <https://doi.org/10.1098/rspb.2004.2986>. Individual values quoted here (lion 1,768 N; wild dog ~428 N) come from secondary search snippets **[U]**.
- **Other sources cited only via Wikipedia** (not read): Smuts 1980 (lion mass), Kearns 1937 (grizzly speed), Bates 2009 ("Big Al" mass), Carpenter 2005 (_Stegosaurus_ spike wound), Therrien 2005 (theropod jaw mechanics), Blanco & Mazzetta 2001 (Giganotosaurus speed), Coria & Currie 2002 (Giganotosaurus braincase), Ostrom 1976, Brinkman 1998, Campione 2014, Roach & Brinkman 2007, Li 2007 (Deinonychus). The Wikipedia pages below give their full citations.
- **Scandinavian wolf chase study** (SLU): "Wolf predation on moose and roe deer: chase distances and outcome". <https://research.slu.se/en/publications/wolf-predation-on-moose-and-roe-deer-chase-distances-and-outcome-> [Abs; units not verified]

**Wikipedia pages** (secondary, accessed 2026-10-19)

- [WP: Lion] <https://en.wikipedia.org/wiki/Lion>
- [WP: Wolf] <https://en.wikipedia.org/wiki/Wolf>
- [WP: Spotted hyena] <https://en.wikipedia.org/wiki/Spotted_hyena>
- [WP: African wild dog] <https://en.wikipedia.org/wiki/African_wild_dog>
- [WP: Brown bear] <https://en.wikipedia.org/wiki/Brown_bear>
- [WP: Grizzly bear] <https://en.wikipedia.org/wiki/Grizzly_bear>
- [WP: Polar bear] <https://en.wikipedia.org/wiki/Polar_bear>
- [WP: Nile crocodile] <https://en.wikipedia.org/wiki/Nile_crocodile>
- [WP: African bush elephant] <https://en.wikipedia.org/wiki/African_bush_elephant>
- [WP: African buffalo] <https://en.wikipedia.org/wiki/African_buffalo>
- [WP: Komodo dragon] <https://en.wikipedia.org/wiki/Komodo_dragon>
- [WP: Deinonychus] <https://en.wikipedia.org/wiki/Deinonychus>
- [WP: Velociraptor] <https://en.wikipedia.org/wiki/Velociraptor>
- [WP: Utahraptor] <https://en.wikipedia.org/wiki/Utahraptor>
- [WP: Dakotaraptor] <https://en.wikipedia.org/wiki/Dakotaraptor>
- [WP: Spinosaurus] <https://en.wikipedia.org/wiki/Spinosaurus>
- [WP: Giganotosaurus] <https://en.wikipedia.org/wiki/Giganotosaurus>
- [WP: Allosaurus] <https://en.wikipedia.org/wiki/Allosaurus>
- [WP: Tiger] <https://en.wikipedia.org/wiki/Tiger>
- [WP: Bite force quotient] <https://en.wikipedia.org/wiki/Bite_force_quotient>

**Policy**

- **[Google Publisher Policies]** <https://support.google.com/publisherpolicies/answer/10502938> [Abs]

## Appendix A: preset snippet for the phase-1 catalog

Ranges as `[min, mode, max]`, in the order of §3.1. These are generated from the same data as the tables above.

```ts
export const SPECIES_PRESETS = {
  trex: {
    role: 'heavy',
    ranges: {
      mass: [5650, 8000, 9500],
      speed: [3.4, 5.5, 8],
      turnRate: [22, 30, 45],
      biteForce: [8.5, 35, 57],
      biteLethality: [4, 8, 12],
      biteInterval: [1.5, 2.5, 4],
      biteReach: [4.5, 5.5, 6.5],
      biteArc: [30, 45, 70],
      biteAccuracy: [0.3, 0.5, 0.7],
      shakeRate: [0.05, 0.12, 0.25],
      bodyRadius: [2, 2.5, 3],
    },
  },
  elephant: {
    role: 'heavy',
    ranges: {
      mass: [2600, 3200, 6900],
      speed: [3, 4.5, 6.8],
      turnRate: [30, 50, 90],
      biteForce: [8, 20, 45],
      biteLethality: [2, 5, 9],
      biteInterval: [2, 4, 8],
      biteReach: [2.8, 3.5, 4.3],
      biteArc: [40, 60, 90],
      biteAccuracy: [0.15, 0.3, 0.5],
      shakeRate: [0.08, 0.2, 0.4],
      bodyRadius: [1.4, 1.7, 2],
    },
  },
  buffalo: {
    role: 'heavy',
    ranges: {
      mass: [420, 600, 900],
      speed: [8, 11, 15.5],
      turnRate: [60, 90, 150],
      biteForce: [2, 5, 10],
      biteLethality: [4, 8, 12],
      biteInterval: [1, 2, 4],
      biteReach: [1.5, 1.8, 2.2],
      biteArc: [30, 45, 70],
      biteAccuracy: [0.2, 0.35, 0.55],
      shakeRate: [0.03, 0.08, 0.2],
      bodyRadius: [0.7, 0.85, 1],
    },
  },
  brownbear: {
    role: 'heavy',
    ranges: {
      mass: [130, 220, 450],
      speed: [8, 11, 13.3],
      turnRate: [60, 120, 200],
      biteForce: [0.6, 1.2, 3],
      biteLethality: [4, 8, 12],
      biteInterval: [0.8, 1.5, 3],
      biteReach: [1.2, 1.5, 1.9],
      biteArc: [45, 70, 100],
      biteAccuracy: [0.3, 0.45, 0.65],
      shakeRate: [0.1, 0.25, 0.5],
      bodyRadius: [0.6, 0.75, 0.9],
    },
  },
  tiger: {
    role: 'pack',
    constants: { packRadius: 0.8 },
    ranges: {
      mass: [100, 180, 260],
      sprintSpeed: [11, 14, 18],
      cruiseSpeed: [4, 6, 8],
      sprintEndurance: [10, 20, 40],
      latchEndurance: [15, 30, 60],
      recoveryTime: [30, 60, 120],
      latchChance: [0.15, 0.35, 0.6],
      dps: [2, 6, 12],
      bleed: [0, 0.002, 0.005],
      morale: [0.4, 0.6, 0.85],
      moraleLoss: [0.03, 0.08, 0.15],
    },
  },
  lion: {
    role: 'pack',
    constants: { packRadius: 0.8 },
    ranges: {
      mass: [110, 150, 225],
      sprintSpeed: [11, 14, 20.6],
      cruiseSpeed: [3, 5, 7],
      sprintEndurance: [8, 15, 30],
      latchEndurance: [20, 45, 120],
      recoveryTime: [40, 90, 180],
      latchChance: [0.2, 0.4, 0.65],
      dps: [2.5, 7, 14],
      bleed: [0, 0.002, 0.005],
      morale: [0.45, 0.65, 0.9],
      moraleLoss: [0.02, 0.06, 0.12],
    },
  },
  wolf: {
    role: 'pack',
    constants: { packRadius: 0.5 },
    ranges: {
      mass: [30, 42, 60],
      sprintSpeed: [12, 15, 18],
      cruiseSpeed: [2.5, 4, 6],
      sprintEndurance: [20, 40, 90],
      latchEndurance: [10, 25, 60],
      recoveryTime: [30, 60, 120],
      latchChance: [0.1, 0.25, 0.45],
      dps: [0.8, 2.5, 6],
      bleed: [0.001, 0.003, 0.006],
      morale: [0.35, 0.55, 0.8],
      moraleLoss: [0.03, 0.08, 0.15],
    },
  },
  hyena: {
    role: 'pack',
    constants: { packRadius: 0.6 },
    ranges: {
      mass: [40, 55, 70],
      sprintSpeed: [11, 14, 16.7],
      cruiseSpeed: [3, 4.5, 6],
      sprintEndurance: [30, 60, 150],
      latchEndurance: [15, 30, 60],
      recoveryTime: [30, 60, 120],
      latchChance: [0.15, 0.3, 0.5],
      dps: [1.2, 4, 12],
      bleed: [0.001, 0.003, 0.008],
      morale: [0.35, 0.55, 0.8],
      moraleLoss: [0.03, 0.08, 0.15],
    },
  },
} as const;
```

Proposed `hide` (M2): `trex` 1, `elephant` 0.3, `buffalo` 0.5, `brownbear` 0.5 (all **S**).

## Appendix B: reproducing the feasibility runs

The scratch scripts are outside the repository, in `<local-workspace>/species-exp/`:

- `<local-workspace>/species-exp/species-data.cjs`: species presets (the single source for the tables in this document).
- `<local-workspace>/species-exp/run-matchups.cjs`: `node run-matchups.cjs matchups`, `wolfsweep` or `lionsweep` (run from that directory).
- `<local-workspace>/species-exp/run-armor.cjs`: the `hide` test (§8.4).
- `<local-workspace>/species-exp/gen-tables.cjs`: emits the parameter tables and Appendix A.
- `<local-workspace>/species-exp/sim/`: a copy of `src/sim` at `6c84e0e` with the three widened bounds, compiled to `<local-workspace>/species-exp/out/` with the repository's `tsc` (`node_modules/.bin/tsc -p <local-workspace>/species-exp/tsconfig.json`).
- Raw outputs: `<local-workspace>/species-exp/res-matchups.json`, `<local-workspace>/species-exp/res-wolf.json`, `<local-workspace>/species-exp/res-lion.json`.
