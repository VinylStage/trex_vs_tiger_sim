# Species roster for a multi-species engine

> Research track: **species**. Prepared 2026-10-19 against `origin/main` at `6c84e0e` (read-only).
> Status: proposal, ready to land as `docs/SPECIES.md`.
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
14. [Flight traits for model 2 (#169)](#14-flight-traits-for-model-2-169)

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
| Hippopotamus           | extant                           | HEAVY (batch A)   | ♂ mean 1.48 t, ♀ 1.365 t, max ~2.7 t [WP]; 1.3–3.2 t [ADW]     | ~8 m/s claimed, never measured **[U]** [Hutchinson & Pringle 2024]                          | trots at all speeds, brief aerial phase [Hutchinson & Pringle 2024]   | ~8.1 kN, one female, unpublished, no primary record (#210) **[U]**; canines to 50 cm [WP]        | gape 100–110° [WP]                                                  | "several hundred metres" [ADW]      | pods, but almost no social bonds; feeds alone [WP]                                                                       | lions, hyenas and crocodiles take calves; lion prides rarely adults [WP] (§5.18)                                                                                                                    | ✓ ; no water                             |
| White rhinoceros       | extant                           | HEAVY (batch A)   | ♂ mean 2.0–2.3 t, ♀ 1.6–1.7 t, max 3.6 t [WP]; 1.0–3.6 t [ADW] | 40 km/h "for short periods" claimed, never measured **[U]** [ADW]                           | runs at 24 km/h [ADW]; trots and gallops [Alexander & Pond 1992]      | horn force: no measurement; front horn ~60 cm [WP]                                               | very poor eyesight [WP]                                             | "short periods" [ADW]               | crashes of up to 14, mostly cows; adult bulls solitary and territorial [WP]                                              | adults have no natural predators; lions rarely take calves, once a sick bull; young bull elephants killed up to 49 at Pilanesberg [Slotow & van Dyk 2001] (§5.19)                                   | ✓ ; no herd defence                      |
| Nile crocodile         | extant                           | HEAVY (deferred)  | ♂ 225–750 kg, records > 1 t [WP]                               | 14 km/h land bursts [WP]; no crocodylian recorded above 5 m/s [Hutchinson 2019]             | swims 30–35 km/h [WP]                                                 | 3.0 kN measured at 86 kg; 7–23 kN at 225–750 kg by regression [Erickson 2012]                    | short reach, fast lateral snap                                      | n/a                                 | gathers at carcasses; cooperative fish blocking [WP]                                                                     | crocodiles and lions mostly avoid each other; tug-of-war over carcasses; each preys on the other when sizes differ [WP]                                                                             | ✗ ambush, death roll, water              |
| Giganotosaurus         | extinct, S. America              | HEAVY (phase 2)   | 4.2–13.8 t; compiled 5.5–8.5 t; 6.9 t model [WP; Snively 2019] | 14 m/s kinematic ceiling only [WP, Blanco & Mazzetta 2001]                                  | n/a                                                                   | weaker than _T. rex_, no absolute value [WP, Therrien 2005]; relatives 8–25 kN [Sakamoto 2022]   | skull 1.53–1.80 m [WP]; agility ≈ ½ _T. rex_ [Snively 2019]         | n/a                                 | relative _Mapusaurus_ found in a multi-individual bonebed [WP]                                                           | probably juvenile sauropods [WP]                                                                                                                                                                    | ✓                                        |
| Allosaurus             | extinct, N. America and Portugal | HEAVY (phase 2)   | 1.0–2.7 t [WP; Snively 2019]                                   | 9.4 m/s in a 1.4 t model [Sellers & Manning 2007]                                           | n/a                                                                   | 0.8–2.1 kN [Rayfield 2001, WP] to 4.4 / 9.4 kN [Sakamoto 2022]                                   | 92° gape [WP]; agility slightly above adult _T. rex_ [Snively 2019] | n/a                                 | packs vs aggregations debated [WP]                                                                                       | _Stegosaurus_ spike wound in an Allosaurus vertebra [WP, Carpenter 2005]                                                                                                                            | ✓                                        |
| Spinosaurus            | extinct, N. Africa               | HEAVY (deferred)  | 7.4 t flesh model [Sereno 2022]                                | no estimate                                                                                 | n/a                                                                   | 4.8 / 11.9 kN [Sakamoto 2022]                                                                    | long narrow snout                                                   | n/a                                 | n/a                                                                                                                      | aquatic vs wading-ambush debate [Sereno 2022; WP]                                                                                                                                                   | ✗ aquatic; demand is heavy-vs-heavy      |
| Triceratops            | extinct 68–66 Ma, W. N. America  | HEAVY (batch A′)  | "up to 6–10 t"; "Kelsey" ~5.4 t [WP]                           | no estimate; faster than elephants, like rhinos [Paul & Christiansen 2000]                  | n/a                                                                   | horn force: no measurement; brow horns ~1 m [WP]                                                 | skull ~2–2.5 m [WP]                                                 | n/a                                 | little evidence of herds; one bonebed of three juveniles [Mathews 2009, WP]                                              | healed _T. rex_ tooth marks on a brow horn [Happ 2008]; frill lesions suggest horn combat [Farke 2009] (§5.20)                                                                                      | ✓                                        |
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

### 5.5 Polar bear (HEAVY, phase 2; shipped in the free model, #184)

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
| `heavy.bodyRadius`    | m     | 0.7 | 0.85 |    1 | **S** | — (superseded in the free sheet below: derived from mass, **D**)          |

**Free-model source sheet (#184).** The polar bear has no legacy entry: the classic engine does not offer it, and its free entry is built from this sheet with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §11.5). It covers every free-model input (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of polar bear 1 v brown bear 1 (the preset). The swing is the change in the polar bear's win share from min to max, against 83.4 % with every input at its preset ([CALIBRATION.md §13](CALIBRATION.md#13-polar-bear-184)).

| Free trait        | From (heavy row above) | Unit  |   min |  mode |   max | Basis | Sensitivity range | Swing (pp) | Source / rationale                                                                                                                                                                                                                  |
| ----------------- | ---------------------- | ----- | ----: | ----: | ----: | :---: | ----------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mass`            | `heavy.mass`           | kg    |   250 |   450 |   800 |   L   | –                 |          – | As above [WP].                                                                                                                                                                                                                      |
| `bodyRadius`      | `heavy.bodyRadius`     | m     |  0.75 |  0.95 |   1.1 |   D   | –                 |          – | The brown bear's 0.6 / 0.75 / 0.9 m scaled isometrically by (polar bear mass ÷ brown bear mass)^(1/3) at each of min, mode and max, rounded to 0.05 m. The replay sizes the glyph from it, so the glyph follows mass (§5.3 step 4). |
| `turnRate`        | `heavy.turnRate`       | deg/s |    50 |   100 |   180 | **S** | 50–180            |        0.0 | As above: a heavier, slower-turning brown bear.                                                                                                                                                                                     |
| `sprintSpeed`     | `heavy.speed`          | m/s   |     6 |     9 |  11.1 |   L   | –                 |          – | As above [WP].                                                                                                                                                                                                                      |
| `cruiseSpeed`     | new                    | m/s   |     1 |   1.5 |     2 |   L   | –                 |          – | Mode: usual travel 5.5 km/h (1.53 m/s) [WP], used directly. The ends are a ±0.5 m/s spread around it, the brown bear's width.                                                                                                       |
| `sprintEndurance` | new                    | s     |    20 |    45 |   120 | **S** | 20–120            |       +4.4 | The brown bear's row (docs/SPECIES.md §11.2): "mechanically like the brown bear".                                                                                                                                                   |
| `recoveryTime`    | new                    | s     |    45 |    90 |   180 | **S** | 45–180            |        0.0 | The brown bear's row.                                                                                                                                                                                                               |
| `strikeForce`     | `heavy.biteForce`      | kN    |   0.8 |   1.5 |   3.5 | **S** | 0.8–3.5           |      +39.7 | As above (brown bear scaled by mass^0.57). The largest swing: the preset's result rests mostly on this unmeasured value.                                                                                                            |
| `strikeLethality` | `heavy.biteLethality`  | HP/kN |     4 |     8 |    12 | **S** | 4–12              |      +30.6 | Shared mapping (§3.3 item 2).                                                                                                                                                                                                       |
| `strikeInterval`  | `heavy.biteInterval`   | s     |   0.8 |   1.5 |     3 | **S** | 0.8–3             |      −30.4 | The brown bear's alternating swipes and bites.                                                                                                                                                                                      |
| `strikeReach`     | `heavy.biteReach`      | m     |   1.3 |   1.6 |     2 | **S** | 1.3–2             |       +0.3 | As above (geometry: radius + head and forelimb).                                                                                                                                                                                    |
| `strikeArc`       | `heavy.biteArc`        | deg   |    45 |    70 |   100 | **S** | 45–100            |        0.0 | The brown bear's forelimb swipes.                                                                                                                                                                                                   |
| `strikeAccuracy`  | `heavy.biteAccuracy`   | p     |   0.3 |  0.45 |  0.65 | **S** | 0.3–0.65          |      +22.6 | The brown bear's row.                                                                                                                                                                                                               |
| `latchChance`     | –                      |       |     0 |     0 |     0 |   –   | –                 |          – | Inactive: the polar bear does not latch (neutral values, docs/SPECIES.md §11.1). Same for `latchEndurance` (1 s) and `latchDps` (0).                                                                                                |
| `shakeRate`       | `heavy.shakeRate`      | 1/s   |   0.1 |  0.25 |   0.5 | **S** | 0.1–0.5           |        0.0 | The brown bear's row. Only read when a latcher rides it (`R_latch`, 2–5× lighter), which a brown bear never is.                                                                                                                     |
| `bleed`           | new                    | 1/s   | 0.001 | 0.003 | 0.006 | **S** | 0.001–0.006       |        0.0 | The brown bear's row: claws, as the wolf (docs/SPECIES.md §11.2).                                                                                                                                                                   |
| `morale`          | new                    |       |  0.55 |  0.75 |   0.9 | **S** | 0.55–0.9          |      +20.0 | The brown bear's row: large animals flee mainly when badly wounded (D5).                                                                                                                                                            |
| `moraleLoss`      | new                    |       |  0.02 |  0.05 |   0.1 | **S** | 0.02–0.1          |        0.0 | The shared heavy placeholder; read only by social species (docs/SPECIES.md §11.2).                                                                                                                                                  |

Flags and constants: `era` extant; `adSafe` true (a wild species, abstract glyph, no gore in any text); `social` false (solitary, §4); `canLatch` false (bites and swipes, §4); no pack-buff rows. `hide` 0.5 **S**, the brown bear's value for a fat and fur layer (sensitivity not measured: it only scales damage from a latcher, and no latcher appears in the preset); `intimidation` 1 **S**, as every species before #47. Inactive traits carry no tag. The S values with no swing do not change the preset's result at 1,000 runs; they can matter elsewhere (turning against a crowd, shake-off against a tiger rider).

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): with every living species in the roster "no recorded encounter" (`undocumented`): no field record of the polar bear against any of them was found in the sources used here. With the brown bear, their ranges meet in the Arctic, where wild hybrids have been recorded [WP: Polar bear]; that is the "Why?" of the preset, not a recorded fight. With _T. rex_ "never met" (66 Ma); with the woolly mammoth and _H. erectus_ "no recorded overlap" (`unrecorded`, the era rule). Not a what-if species: it shares its era with every living species.

**Model 2 (#169).** Free model version 2 replaces three of the brown bear's behaviour rows above with researched polar bear values (`sprintEndurance` 10 / 25 / 60 s, `recoveryTime` 60 / 120 / 300 s, `morale` 0.4 / 0.6 / 0.8, all **S**) and adds the flight traits (`threatRatio` 1.5 / 2 / 3, `threatTime` 5 / 10 / 30 s, `soloShock` 0 / 0.04 / 0.08, all **S**). Sources, the rows kept and why: [§14.4–§14.5](#144-the-values). Model 1 keeps the sheet above.

Kept internal, never shipped: the YouGov "paradox" of RENEWAL-1.0 §5.2 (grizzly 73 % vs polar bear 64 %). It appears in no preset text, no species-guide note and no UI string.

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

### 5.8 Spinosaurus (HEAVY, deferred; shipped in the free model as a land duel, #185)

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

#### _Spinosaurus_: the land duel of the free model (#185)

_Spinosaurus aegyptiacus_, researched 2026-11-05 for batch A of the 1.0 renewal (RENEWAL-1.0 §5.2: mass L [Sereno 2022], bite L [Sakamoto 2022], speed S; label "semi-aquatic; land duel"; no new mechanics). The heavy-vs-heavy duel that deferred it above is solved by the free model, which puts any species on either side; the water terrain is not, so it ships as a **land duel** only, as the issue asks, and carries a visible "semi-aquatic; land duel" label on the play page and the species guide. It has no legacy entry: its free entry is built from the sheet below with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §4.15 and §11.5). The id is `spinosaurus`, the same as in `scripts/demand/species.json`. The table above is kept as written in 2026-10; where the sheet below differs (bite mode, body radius), the sheet below is what ships.

- **A contested body plan.** Four readings of the same fossils, all used here only as ranges:
  - _Semi-aquatic, quadrupedal on land_ [Ibrahim 2014]: retracted nostrils, an elongate neck and trunk that "shift the center of body mass anterior to the knee joint", a downsized pelvic girdle, short hindlimbs and solid limb bones "for buoyancy control in water" (abstract). The paper proposed an obligate quadruped on land (via [WP: Spinosaurus]).
  - _Tail-propelled swimmer_ [Ibrahim 2020]: tall neural spines and elongate chevrons form "a large, flexible fin-like organ"; robotic models give it more thrust in water than terrestrial theropod tails (abstract).
  - _Bipedal, shoreline or wading_ [Henderson 2018]: a 3D model with lungs and air sacs puts the center of mass "much closer to the hips than previously estimated", so it "would still have been a competent walker on land"; it floats but is laterally unstable and "unsinkable" (abstract). [Hone & Holtz 2021] [FT]: the pursuit-predator model "is not supported", a "wading" model "is not contradicted by any line of evidence"; it "almost certainly fed primarily from the water and may have swum". [Sereno 2022] [FT]: a CT-based flesh model is "bipedal on land", its center of mass 15.3–28.5 cm in front of the hip socket depending on the air space, over the hind feet; the forelimbs did not bear weight; it could wade to about 2.6 m before floating, was "incapable of diving", and swam at about 0.8 m/s at the surface (1.2–1.4 m/s at most). [Myhrvold 2024] [FT]: _Spinosaurus_ "meets those bipedal criteria for being graviportal" (a slow-moving biped).
  - _Subaqueous forager_ [Fabbri 2022]: dense bones in _Spinosaurus_ and _Baryonyx_ indicate "subaqueous foraging behaviour" (abstract); [Myhrvold 2024] reanalysed the same data and found the method's conclusions invalid for these taxa.
  - The free model has no water, so only the land side of the debate enters it: posture, speed and turning, all **S**. The bipedal reading is the more recent and is the one the preset text cites; the S ranges are wide enough to include a slow quadruped.
- **Mass (L).** Sereno 2022's adult flesh model weighs 7,390 kg with bird-like air spaces, 7,716 kg with crocodile-like and 8,013 kg with lizard-like air spaces (Table 10), body length 13.53 m (Table 7), "under 14 m". Dal Sasso et al. 2005 estimated 7–9 t for 16–18 m; Therrien & Henderson 2007 12–20.9 t from skull length, an approach Campione & Evans 2020 caution against for _Spinosaurus_; older surveys gave "upwards of 6 t" (von Huene 1926, Glut 1982) and 4 t (Paul 1988); all via [WP: Spinosaurus]. The row is 6,000 / 7,400 / 9,000 kg: the mode is Sereno's model, the maximum Dal Sasso's upper end, the minimum the older 6 t; Sereno's three air-space options sit inside, and the 12–20.9 t estimates are left outside.
- **Bite (L).** Sakamoto 2022 [FT] (via [WP: Spinosaurus] for the exact figures): 4,829 N anterior and 11,936 N posterior, jaws "adapted for generating relatively faster shutting speeds with less muscle input force", i.e. fast-snapping rather than crushing. The row brackets the two figures, 4.8 / 8.35 / 11.9 kN, with the mode at their midpoint (the earlier table's 3 / 6 / 12 went below and above the published figures). For comparison, _T. rex_ is 25.4 / 48.5 kN in the same study (§5.1). D'Amore et al. 2024 also find "relatively weak bite forces compared to those of other theropods" (via [WP: Spinosaurus]).
- **Speed (S, no estimate).** No running-speed estimate for _Spinosaurus_ was found. Its hind limbs are short for its size (adult femur 81 cm in Sereno 2022's model) and it is read as a graviportal biped [Myhrvold 2024]; the quadruped reading would make it slower still. The row keeps the table above: 2 / 4 / 6 m/s, below _T. rex_'s 3.4 / 5.5 / 8 m/s.
- **Era.** Cenomanian, about 100 to 94 Ma, North Africa (Bahariya Formation, Egypt; Kem Kem beds, Morocco; Niger) [WP: Spinosaurus]; Sereno 2022 dates its reconstruction "ca. 95 Ma". `era` is 100–94 Ma. A second species, _S. mirabilis_ from Niger, is not modelled.
- **Interactions.** None in the roster: it shares no time with any other species there, so it carries the what-if tag. _T. rex_ lived about 68–66 Ma in North America, roughly 26–34 million years later. Its contemporaries were _Carcharodontosaurus_, abelisaurids, sauropods, large crocodyliforms, pterosaurs and large fish such as _Onchopristis_; isotopes suggest spinosaurids fed more on fish than the other theropods there [WP: Spinosaurus]. Hone & Holtz 2021 expect it also took terrestrial prey and scavenged.

**Free-model source sheet (#185).** It covers every free-model input (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of _Spinosaurus_ 1 v _T. rex_ 1 (preset #12 seen from the _Spinosaurus_ side) and again against one elephant. The swing is the change in the _Spinosaurus_ win share from min to max, against 3.5 % and 88.9 % with every input at its preset ([CALIBRATION.md §17](CALIBRATION.md#17-spinosaurus-185)). Because the mass estimates disagree, the two L rows were swept as well.

| Free trait        | Unit  |   min |  mode |   max | Basis | Sensitivity range | Swing vs _T. rex_ (pp) | Swing vs elephant (pp) | Source / rationale                                                                                                                                                                                                            |
| ----------------- | ----- | ----: | ----: | ----: | :---: | ----------------- | ---------------------: | ---------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mass`            | kg    | 6,000 | 7,400 | 9,000 |   L   | 6,000–9,000       |                   +3.1 |                   +9.9 | Above. Sereno 2022: 7,390–8,013 kg by air space; Dal Sasso 2005: 7–9 t; older surveys 6 t (via [WP]). 12–20.9 t (Therrien & Henderson 2007) left outside.                                                                     |
| `bodyRadius`      | m     |  2.05 |  2.45 |  2.95 |   D   | –                 |                      – |                      – | _T. rex_'s 2 / 2.5 / 3 m (§5.1) scaled by (mass ratio)^(1/3) at min, mode and max, rounded to 0.05 m. A long, narrow body (13.5 m, trunk 1.28 m deep [Sereno 2022]) would argue for less; the glyph is a triangle either way. |
| `turnRate`        | deg/s |    15 |    22 |    32 | **S** | 15–32             |                   +0.2 |                   +0.2 | The table above: a long body, no agility data. Below _T. rex_ (22–45).                                                                                                                                                        |
| `sprintSpeed`     | m/s   |     2 |     4 |     6 | **S** | 2–6               |                   +0.3 |                   +1.7 | No estimate (above): short hind limbs, a graviportal biped [Myhrvold 2024], or a quadruped [Ibrahim 2014].                                                                                                                    |
| `cruiseSpeed`     | m/s   |   0.6 |     1 |   1.4 | **S** | 0.6–1.4           |                   +0.1 |                   +0.2 | Below _T. rex_'s 0.8 / 1.28 / 1.64 m/s, in proportion to the sprint row.                                                                                                                                                      |
| `sprintEndurance` | s     |    20 |    60 |   180 | **S** | 20–180            |                   +2.6 |                  +20.3 | _T. rex_'s row (a large theropod).                                                                                                                                                                                            |
| `recoveryTime`    | s     |    60 |   120 |   300 | **S** | 60–300            |                   −0.1 |                   −2.6 | _T. rex_'s row.                                                                                                                                                                                                               |
| `strikeForce`     | kN    |   4.8 |  8.35 |  11.9 |   L   | 4.8–11.9          |                   +6.3 |                  +24.2 | Sakamoto 2022: 4.8 kN anterior, 11.9 kN posterior; mode at the midpoint.                                                                                                                                                      |
| `strikeLethality` | HP/kN |     3 |     6 |    10 | **S** | 3–10              |                   +7.8 |                  +32.4 | The table above: conical teeth without serrations, for gripping fish [WP]; below the shared 4 / 8 / 12 mapping.                                                                                                               |
| `strikeInterval`  | s     |     1 |     2 |   3.5 | **S** | 1–3.5             |                  −13.1 |                  −21.8 | The table above: fast-closing jaws [Sakamoto 2022], quicker than _T. rex_ (1.5–4). The largest swing against _T. rex_.                                                                                                        |
| `strikeReach`     | m     |     5 |     6 |     7 | **S** | 5–7               |                   +2.1 |                   +2.2 | Geometry: body radius + neck (2.18 m) + head (1.57 m) in Sereno 2022's model (Table 7), about 6.2 m.                                                                                                                          |
| `strikeArc`       | deg   |    25 |    40 |    60 | **S** | 25–60             |                    0.0 |                    0.0 | The table above: a narrow snout.                                                                                                                                                                                              |
| `strikeAccuracy`  | p     |  0.25 |  0.45 |  0.65 | **S** | 0.25–0.65         |                   +6.8 |                  +23.2 | The table above.                                                                                                                                                                                                              |
| `latchChance`     |       |     0 |     0 |     0 |   –   | –                 |                      – |                      – | Inactive: it does not latch (neutral values, docs/SPECIES.md §11.1). Same for `latchEndurance` (1 s) and `latchDps` (0).                                                                                                      |
| `shakeRate`       | 1/s   |  0.05 |  0.12 |  0.25 | **S** | 0.05–0.25         |                    0.0 |                    0.0 | _T. rex_'s row; read only when a latcher rides it.                                                                                                                                                                            |
| `bleed`           | 1/s   | 0.002 | 0.004 | 0.008 | **S** | 0.002–0.008       |                   +0.4 |                   +1.0 | _T. rex_'s row.                                                                                                                                                                                                               |
| `morale`          | 0–1   |   0.7 |  0.85 |  0.95 | **S** | 0.7–0.95          |                   +2.5 |                  +10.2 | _T. rex_'s row: no behavioural evidence either way.                                                                                                                                                                           |
| `moraleLoss`      | 0–1   |  0.02 |  0.05 |   0.1 | **S** | 0.02–0.1          |                    0.0 |                    0.0 | The shared heavy placeholder; read only by social species (docs/SPECIES.md §11.2).                                                                                                                                            |

Flags and constants: `era` 100–94 Ma; `adSafe` true (an extinct wild species, abstract glyph, no gore in any text; the film that made the _T. rex_ pairing popular is not named anywhere); `social` false (no evidence of groups); `canLatch` false (bites only). `hide` 1 **S** and `intimidation` 1 **S**, as _T. rex_; sensitivity not measured, since `hide` only scales damage from a latcher and neither reference opponent latches. Inactive traits carry no tag.

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): "never met" with every species in the roster (_T. rex_ about 30 million years later and on another continent; _Utahraptor_ about 25–45 million years earlier; every other species living or Pleistocene). The species guide therefore shows the what-if tag, as for _T. rex_ and _Utahraptor_. Not an absurd species; no hominin note. Label "semi-aquatic; land duel" (`matchup.landDuel`, ko/en) on the play page whenever it is on a side, and on its species-guide card.

Preset facts (the "Why?" of preset #12, `trex-spinosaurus`): never met, about 30 million years apart, in North America and North Africa (above); it walked on two legs and caught fish while wading [Sereno 2022], so a land duel; similar weights (8 t and 7.4 t at the modes); the _T. rex_ bite several times stronger [Sakamoto 2022]. The design's demand notes (a film clip, its view count, a pageview spike) stay internal and are not shipped.

**Sources that could not be reached** (2026-11-05, from this environment): en.wikipedia.org through the fetch tool and through the MediaWiki action API (rate-limited); the page was read through the Wikimedia core REST API instead (revision 1383593376). elifesciences.org through the fetch tool (the page was read with curl). The full texts of Ibrahim 2014 (_Science_), Ibrahim 2020 and Fabbri 2022 (_Nature_) and Henderson 2018 (PeerJ returned 403) were not read; their abstracts come from Europe PMC and Crossref. Dal Sasso 2005, Therrien & Henderson 2007, Campione & Evans 2020, D'Amore 2024 and the older mass surveys are cited via Wikipedia only. No number above comes from them beyond what those summaries state.

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

### 5.15 Deinonychus and other dromaeosaurids (PACK; Utahraptor shipped in the free model, #188)

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

#### _Utahraptor_: the raptor pack of the free model (#188)

_Utahraptor ostrommaysi_, researched 2026-11-05 for batch A of the 1.0 renewal (RENEWAL-1.0 §5.2: mass L, speed L, bite L/D; a social pack species that must pass the rout check). The free id is `raptor`, with _Utahraptor_ as its default animal; the _Velociraptor_ and _Deinonychus_ variants above are not shipped. It has no legacy entry: its free entry is built from the sheet below with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §4.13 and §11.5). Two values in the design's data-state column are corrected here: the speed L belongs to _Velociraptor_ (Sellers & Manning 2007 did not model _Utahraptor_), so it is **S**; and the bite is **D**, scaled from _Deinonychus_.

- **Mass and size (L).** About 6–7 m long [WP: Utahraptor]. Mass estimates: "under 500 kg" (Kirkland, Gaston & Burge 1993, the description); 350–450 kg by comparison with _Achillobator_; 290 kg from femoral length (Zanno & Makovicky 2013); 280 kg for BYUVP 15465, 4.9 m long (Molina-Pérez & Larramendi 2019); 391 and 481 kg for two specimens and 777 kg for a third (Pintore et al. 2024), all via [WP: Utahraptor]. The row takes 280–500 kg with the mode at 400 kg, as the sheet above had; the single 777 kg estimate is left outside. Largest femur 56.5–60 cm; sickle claw about 24 cm [WP: Utahraptor].
- **Era.** Upper Yellow Cat Member, Cedar Mountain Formation, Utah. Joeckel et al. 2019 date the member to 139 ± 1.3 to 134.6 ± 1.7 Ma; Holtz gave 130–125 Ma; both via [WP: Utahraptor]. `era` spans both, 139–125 Ma. RENEWAL-1.0 §6 said "about 126 million years ago", the younger reading; the preset text says only "about 70 million years apart" from _T. rex_, which holds for either.
- **Speed (S, no estimate).** No running-speed estimate for _Utahraptor_ was found. Its describers judged it slower than _Deinonychus_ and _Velociraptor_, about as fast as the contemporary iguanodonts and faster than sauropods; Paul calls it "not particularly fast", an ambush hunter of large prey; the tibia is stout, about as long as the femur as in large non-dromaeosaur theropods [WP: Utahraptor]. Anchors from [Sellers & Manning 2007] (model predictions): _Velociraptor_ 10.8 m/s at 20 kg, _Dilophosaurus_ 10.5 m/s at 430 kg, _Allosaurus_ 9.4 m/s, _Tyrannosaurus_ 8.0 m/s at 6 t (values via search summary of the paper's table; the full text at pmc.ncbi.nlm.nih.gov could not be read from this environment, see below).
- **Bite (D).** No _Utahraptor_ bite estimate was found; [Sakamoto 2022] [FT] gives _Deinonychus_ 298 N anterior and 706 N posterior (skull width 114.5 mm), _Velociraptor_ 131 / 304 N and _Dromaeosaurus_ 885 N posterior. Sakamoto discusses the 8,200 N that [Gignac 2010] inferred from bite marks on _Tenontosaurus_ and argues 706 N fits an animal of that size. No _Utahraptor_ skull width is known, so the row scales the _Deinonychus_ posterior bite isometrically with muscle cross-section, F ∝ m^(2/3), from 75 kg (the mode of the _Deinonychus_ row above): 0.706 kN × (m ÷ 75)^(2/3) at 280 / 400 / 500 kg = 1.70 / 2.15 / 2.50 kN, rounded to 0.05. Its premaxilla is about 250 % the size of _Deinonychus_'s and the lower jaw robust [WP: Utahraptor], which this scaling does not capture, and Paul suggests dromaeosaurines relied on the jaws more; the bite may therefore be underestimated. The Gignac figure is not used.
- **Prey restraint and latching.** [Fowler 2011] [FT]: the enlarged second-toe claw works like a hawk's talon, holding "prey of subequal body size to the predator, while the victim is pinned down by the body weight of the raptor". [Bishop 2019] [FT], a musculoskeletal model of the _Deinonychus_ leg: claw-tip force was "relatively small", supporting "the grasping or restraint of prey smaller than the predator", while "the transmission of a large proportion of body weight into a substrate principally via the claws" is "not well supported". _Utahraptor_ had large flexor tubercles, perhaps a stronger grip than _Deinonychus_ [WP: Utahraptor]. The engine's latch is the closest mechanic to prey restraint; because the evidence argues against riding much larger prey, `latchChance` sits below the lion's.
- **Group living (S).** A nine-ton sandstone block holds at least seven _Utahraptor_ individuals, an adult of about 4.8 m, four juveniles and a hatchling, with at least one possible iguanodont; Kirkland reads it as a predator trap, and whether they were mired together or one by one is unclear [WP: Utahraptor]. Together with the different ages, it suggests gregariousness and some care of the young [WP: Utahraptor]. Cooperative hunting is contested: parallel dromaeosaurid trackways [WP, Li 2007] against Komodo-like mobbing [WP, Roach & Brinkman 2007] and the different diets of young and adult _Deinonychus_, read as evidence against mammal-like pack hunting [Frederickson 2020] [Abs]. The model makes it `social` (groups exist); every pack-buff value is **S**, with no cooperation inside every range.
- **Interactions.** None in the roster: _Utahraptor_ shares no time with any other species there, so it carries the what-if tag on the species guide. Its contemporaries were iguanodonts (_Hippodraco_, _Cedrorestes_), the nodosaurid _Gastonia_, sauropods and an allosauroid that probably dominated it [WP: Utahraptor].

**Free-model source sheet (#188).** It covers every free-model input, the six pack-buff traits included (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of preset #18 (_Utahraptor_ 12 v _T. rex_ 1). The swing is the change in the raptors' win share from min to max, against 7.1 % with every input at its preset ([CALIBRATION.md §15](CALIBRATION.md#15-raptor-pack-188)).

| Free trait        | Unit    |   min |  mode |  max | Basis | Sensitivity range | Swing (pp) | Source / rationale                                                                                                                                                                                                       |
| ----------------- | ------- | ----: | ----: | ---: | :---: | ----------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mass`            | kg      |   280 |   400 |  500 |   L   | –                 |          – | 280 (Molina-Pérez & Larramendi 2019), 290 (Zanno & Makovicky 2013), 350–450 (_Achillobator_ comparison), under 500 (Kirkland 1993), all via [WP].                                                                        |
| `bodyRadius`      | m       |  0.95 |  1.05 |  1.1 |   D   | –                 |          – | The lion's constant 0.8 m (180 kg) scaled isometrically by (mass ÷ 180 kg)^(1/3) at min, mode and max, rounded to 0.05 m. Check: half of a 4.9–7 m length without the tail is about 1–1.5 m.                             |
| `turnRate`        | deg/s   |    60 |   120 |  200 | **S** | 60–200            |      +10.2 | No data. A 300–500 kg biped with a flexible tail [WP]: well above _T. rex_ (22–45, [Snively 2019]) and below the lion (90–300).                                                                                          |
| `sprintSpeed`     | m/s     |     6 |     8 | 10.5 | **S** | 6–10.5            |       +0.1 | No estimate (above). Max: _Dilophosaurus_ (430 kg) 10.5 m/s; mode: the modelled _Tyrannosaurus_ 8.0 m/s, for an animal judged "not particularly fast"; min: 6 m/s, the sheet above's lower end [Sellers & Manning 2007]. |
| `cruiseSpeed`     | m/s     |   1.5 |   2.5 |    4 | **S** | 1.5–4             |       +7.2 | Below the _Deinonychus_ row (2.5 / 4 / 6): heavier and an ambush hunter.                                                                                                                                                 |
| `sprintEndurance` | s       |    10 |    20 |   40 | **S** | 10–40             |       +3.9 | The _Deinonychus_ row: short bursts of an ambush hunter (Paul, via [WP]).                                                                                                                                                |
| `recoveryTime`    | s       |    30 |    60 |  120 | **S** | 30–120            |       +3.9 | The _Deinonychus_ row.                                                                                                                                                                                                   |
| `strikeForce`     | kN      |   1.7 |  2.15 |  2.5 |   D   | –                 |          – | _Deinonychus_ posterior bite 706 N [Sakamoto 2022] × (mass ÷ 75 kg)^(2/3). Gignac 2010's 4.1–8.2 kN not used (above).                                                                                                    |
| `strikeLethality` | HP/kN   |     4 |     8 |   12 | **S** | 4–12              |       +3.4 | Shared pack mapping (§3.3 item 2).                                                                                                                                                                                       |
| `strikeInterval`  | s       |     1 |   1.5 |  2.5 | **S** | 1–2.5             |       −1.0 | Shared pack row (bites and kicks).                                                                                                                                                                                       |
| `strikeReach`     | m       |   1.4 |   1.7 |    2 | **S** | 1.4–2             |       +1.4 | Geometry: body radius + head and neck, about 0.5–0.9 m.                                                                                                                                                                  |
| `strikeArc`       | deg     |    30 |    45 |   70 | **S** | 30–70             |       +1.6 | The lion's row.                                                                                                                                                                                                          |
| `strikeAccuracy`  | p       |   0.3 |  0.45 |  0.6 | **S** | 0.3–0.6           |       +1.2 | The lion's row.                                                                                                                                                                                                          |
| `latchChance`     | p       |   0.1 |  0.25 |  0.5 | **S** | 0.1–0.5           |       −2.8 | Prey restraint [Fowler 2011], but small claw forces favour prey smaller than the predator [Bishop 2019]: below the lion (0.15 / 0.35 / 0.6) and the _Deinonychus_ row.                                                   |
| `latchEndurance`  | s       |    15 |    30 |   60 | **S** | 15–60             |       +0.3 | The _Deinonychus_ row.                                                                                                                                                                                                   |
| `latchDps`        | HP/s    |   3.4 |   9.5 |   20 |   D   | –                 |          – | From the bite by §3.3 item 4: 2·F_min, 4.4·F_mode (rounded to 0.1), 8·F_max. Close to the sheet above's _Utahraptor_ 3 / 10 / 25 **S**.                                                                                  |
| `shakeRate`       | 1/s     |   0.1 |  0.25 |  0.5 | **S** | 0.1–0.5           |        0.0 | The lion's row; read only when a latcher rides it (none in preset #18).                                                                                                                                                  |
| `bleed`           | 1/s     | 0.001 | 0.004 | 0.01 | **S** | 0.001–0.01        |      +14.2 | The _Deinonychus_ row: prey restraint ends in blood loss [Fowler 2011].                                                                                                                                                  |
| `morale`          | 0–1     |   0.3 |  0.55 |  0.8 | **S** | 0.3–0.8           |      +29.3 | The _Deinonychus_ row. The largest swing.                                                                                                                                                                                |
| `moraleLoss`      | 0–1     |  0.03 |  0.08 | 0.15 | **S** | 0.03–0.15         |       −7.1 | The _Deinonychus_ row.                                                                                                                                                                                                   |
| `cohesionRadius`  | m       |    30 |    60 |  100 | **S** | 30–100            |       −3.7 | The lion's row (a spacing, not a strength of cooperation).                                                                                                                                                               |
| `groupLatchGain`  | ×/rider |     0 |  0.12 | 0.25 | **S** | 0–0.25            |       +0.5 | 0: no cooperation (mobbing, [Roach & Brinkman 2007]; [Frederickson 2020]); max: the lion's mode; mode: half of it, rounded down to the 0.01 input step.                                                                  |
| `focusBonus`      | m       |     0 |    10 |   20 | **S** | 0–20              |        0.0 | As `groupLatchGain`: 0 to the lion's mode (20).                                                                                                                                                                          |
| `moraleSupport`   | 0–1     |     0 | 0.025 | 0.05 | **S** | 0–0.05            |       +0.1 | As `groupLatchGain`: 0 to the lion's mode (0.05).                                                                                                                                                                        |
| `routShock`       | 0–1     |     0 | 0.025 | 0.05 | **S** | 0–0.05            |      −17.9 | As `groupLatchGain`: 0 to the lion's mode (0.05). The rout-cascade lever: second-largest swing; rout share 69.6 % at 0, 88.8 % at 0.05 (limit 90 %).                                                                     |
| `reliefStamina`   | 0–1     |   0.2 |   0.3 |  0.5 | **S** | 0.2–0.5           |        0.0 | The lion's row (a threshold, not a strength of cooperation).                                                                                                                                                             |

Flags and constants: `era` 139–125 Ma (above); `adSafe` true (an extinct wild species, abstract glyph, no gore in any text); `social` true (found in groups; cooperative hunting contested, above); `canLatch` true (prey restraint). `hide` 1 **S** and `intimidation` 1 **S**, as every former pack species (docs/SPECIES.md §11.1); sensitivity not measured, since `hide` only scales damage from a latcher and the _T. rex_ does not latch.

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): "never met" with every species in the roster. _T. rex_ lived about 68–66 Ma, some 60–70 million years later; every other species is living or Pleistocene. The species guide therefore shows the what-if tag, as it does for _T. rex_. Not an absurd species; no hominin note.

Preset facts (the "Why?" of preset #18, `raptors-trex`): never met, about 70 million years apart (above); _Utahraptor_ the largest known dromaeosaurid, about 400 kg against _T. rex_'s 8,000 kg at the modes (docs/SPECIES.md §4.1), so about twenty times lighter; fossils of several found together [WP: Utahraptor]; cooperative hunting debated (above). The design's mention of a children's book title stays internal and is not shipped.

Not reachable from this environment (2026-11-05): en.wikipedia.org through the fetch tool (the page was read through the MediaWiki API instead), and the full text of [Sellers & Manning 2007] at pmc.ncbi.nlm.nih.gov (a bot check; not bypassed) and at Europe PMC (server error for PMC2279215 and for Pintore et al. 2024, PMC7616063). The Sellers & Manning speeds above come from a search summary of the paper's table and its abstract; Pintore et al.'s masses come from Wikipedia only.

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

### 5.18 Hippopotamus (HEAVY, batch A; shipped in the free model, #186)

Common hippopotamus, _Hippopotamus amphibius_. Researched 2026-11-04 for batch A of the 1.0 renewal (RENEWAL-1.0 §5.2: mass L, gait L, top speed and bite **U**, to be turned into **S** with sensitivity ranges). Like the polar bear it has no legacy entry: the classic engine does not offer it, and its free entry is built from the sheet below with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §4.12 and §11.5).

- **Mass and size.** Mean adult mass about 1.48 t for bulls and 1.365 t for cows; exceptionally large males reach 2.66 t; head–body length typically 3.3–3.45 m, shoulder height about 1.4 m [WP: Hippopotamus, citing Owen-Smith 1988]. Wild adults weigh 1,300–3,200 kg; a captive male reached 4,500 kg [ADW: Hippopotamus amphibius]. Skin about 6 cm thick over much of the body [WP: Hippopotamus, citing Eltringham 1999].
- **Gait (L).** Hippos trot at every speed on land, never canter or gallop, and use brief aerial phases at their fastest relative speeds: 169 strides from 46 trials of 32 individuals, filmed in zoos and on video [Hutchinson & Pringle 2024] [FT]. They change speed mainly by shortening stance, and reach higher stride frequencies and lower duty factors than elephants.
- **Top speed (U → S).** "Maximal speeds have not been reliably measured but have been claimed (without empirical documentation) at up to ~8 m s⁻¹ (~30 kph)" [Hutchinson & Pringle 2024, citing Dagg 1973, Garland 1983, Kingdon 1989, Nowak 1999]; their own videos could not be converted into absolute speeds. The same paper notes that hippos "would match the performance of elephants" if they reach about 7 m/s. Wikipedia repeats 30 km/h as "not confirmed" [WP: Hippopotamus]; Animal Diversity Web gives "up to 30 km per hour" held "for several hundred meters", without a measurement [ADW]. The S row puts the claimed figure at the top (8.3 m/s = 30 km/h), the mode at 6 m/s (just under the elephant's fastest reliable 6.8 m/s, §5.2), and the bottom at 4 m/s (the elephant's usual 4–4.5 m/s, §5.2), so the whole range lies within a "probably like an elephant" reading of the paper.
- **Bite (U → S; re-checked for #210, range kept).** No peer-reviewed bite-force measurement or model of the hippo was found, in 2026-11-04 (#186) or in a second, wider search on 2026-11-05 (#210, table below). The widely repeated figure is "1,800 psi"; popular articles attribute it to a measurement on a female hippo for National Geographic's _Dangerous Encounters_, presented by Brady Barr, given as about 8,100 N (≈ 1,821 lbf, so "psi" is a mislabelled force), and say no male was tested because of its aggression. The broadcast itself could not be identified or watched: the show's episode list has "Bite Force" (2005), "Hippo Stakeout" and "To Catch A Hippo", and IMDb lists "Undercover Hippo" (2008), but no reachable synopsis ties the measurement to one of them. Which teeth bit the device, what the device was (one popular article says only "a device at the end of a stick"), how many bites were taken and the animal's size are all unknown. The one peer-reviewed paper that states a hippo bite force, a surgical case series [Haddara 2020], gives 12,600 kPa (≈ 1,830 psi, the same figure read as a pressure) and cites a popular listicle for it, so it is not an independent source. The bite-force datasets used elsewhere in this file contain no hippo: [Wroe 2005] covers mammalian predators and marsupials, [Christiansen & Wroe 2007] 151 carnivorans, and [Erickson 2012] names 4,500 N in the spotted hyena as the highest bite recorded in a carnivoran mammal. No jaw-muscle cross-section, lever-arm model or dry-skull estimate for _Hippopotamus_ was found; the skull and chewing studies that exist ([Avedik & Clauss 2023], [Fidalgo 2025]) report shape and chewing motion, not force. The only quantitative hint about bulls is indirect: in 2,994 aged hippos, males were about 5 % heavier than females but had lower jaws 44 % and canines 81 % heavier [Shannon 2021], which supports a bull maximum above the measured female without giving a number. The figure therefore stays **U**, used only as the S mode; the range 4 / 8 / 15 kN is **kept unchanged** because nothing found justifies moving it (decision in IMPLEMENTATION_AUDIT, 2026-11-05). The jaw opens 100–110° and the lower canines grow to 50 cm and the incisors to 40 cm; the canines and incisors serve mainly in combat, not feeding, and interlocking incisors restrict the jaw to up-and-down chewing [WP: Hippopotamus, citing Herring 1975, Eltringham 1999 and Kingdon 1988; Avedik & Clauss 2023].
- **Behaviour.** Bulls hold territories in the water, not on land; fights between bulls use the incisors to block and the canines to strike [WP: Hippopotamus]. Pods can hold over 100 animals, but adults form "almost no social bonds" and grazing on land is solitary [WP: Hippopotamus], so the model treats it as solitary (no pack buff). Considered highly aggressive; it charges boats [WP: Hippopotamus].
- **Interactions.** Nile crocodiles, lions and spotted hyenas prey on young hippos; adults are rarely preyed on, but large lion prides have taken adults, occasionally at Gorongosa [WP: Hippopotamus]. Hippos displace or kill crocodiles [WP]. No field record of a hippo against an elephant, a rhino or any other roster species was found in the sources used here.
- **Engine cannot express:** water (the hippo's refuge and fighting ground), the wide-gape biting display, herd crowding in a pool, and a charge that only drives an intruder off. The free model has no water edge (M9), so every hippo matchup is on land.

**Bite-force sources reviewed for #210** (2026-11-05). "Level" is the tag the force value would carry as a model input (§3.2); "–" means the source gives no force. "Access" uses the §13 levels.

| Source                                                                                                    | What it reports                                                                                                       | Force value                                 | Level | Access                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | :---: | ---------------------------------------------------------------------------------------------------------------------- |
| Brady Barr, _Dangerous Encounters_ (National Geographic)                                                  | The original measurement. Episode, device, teeth used, bite count and the animal's size could not be identified       | ~8.1 kN, one female (as reported by others) |   U   | Not found. Episode list via [WP: Dangerous Encounters with Brady Barr]; imdb.com and natgeotv.com could not be reached |
| A-Z Animals, "The Mighty Mouths of Hippos" (2021, updated 2025)                                           | 1,800–2,000 psi "or approximately 8,000 to 8,900 Newtons"; males not tested; "a device at the end of a stick"         | 8.0–8.9 kN                                  |   U   | Read, popular                                                                                                          |
| hippoworlds.com, "Hippo Bite Force"                                                                       | 1,800 psi ≈ 8,100 N, a female, Barr, Nat Geo; "a single field measurement rather than a large, peer-reviewed dataset" | 8.1 kN                                      |   U   | Read, popular                                                                                                          |
| Frey 2023, "What Is A Hippos Bite Force?" (Simply Ecologist blog, <https://doi.org/10.59350/xp09b-yyh67>) | 1,800 psi (8,100 N), no source given                                                                                  | 8.1 kN                                      |   U   | Read, popular                                                                                                          |
| National Geographic, Hippopotamus fact page                                                               | "nearly three times stronger than a lion's", no number, no source                                                     | –                                           |   U   | Read                                                                                                                   |
| [Haddara 2020] (peer-reviewed case series)                                                                | "12 600 kPa", citing a ThoughtCo listicle (its ref. 7)                                                                | the same figure as a pressure               |   U   | [FT]; the listicle could not be reached                                                                                |
| [Wroe 2005], [Christiansen & Wroe 2007]                                                                   | Bite-force estimates for predators and marsupials / 151 carnivorans; no hippo                                         | –                                           |   –   | [Abs]                                                                                                                  |
| [Erickson 2012]                                                                                           | Highest carnivoran-mammal bite recorded: 4,500 N (spotted hyena); no hippo                                            | –                                           |   –   | [FT]                                                                                                                   |
| [Shannon 2021]                                                                                            | 2,994 aged hippos: males ~5 % heavier, lower jaw 44 % and canines 81 % heavier than females                           | – (weapon mass, L)                          |   –   | [FT]                                                                                                                   |
| [Avedik & Clauss 2023]                                                                                    | 86 skulls and live animals: orthal chewing, interlocking incisors; no force                                           | –                                           |   –   | [FT]                                                                                                                   |
| [Fidalgo 2025]                                                                                            | 198 skulls, geometric morphometrics: the mandible keeps changing shape at 20–25 years; no force                       | –                                           |   –   | [Abs]                                                                                                                  |
| Herring 1975; Herring & Herring (superficial masseter and gape)                                           | Gape mechanics; whether either gives muscle size could not be checked                                                 | –                                           |   –   | Not reached; cited via [WP: Hippopotamus]                                                                              |
| [WP: Hippopotamus] (accessed 2026-11-05)                                                                  | Masseter and digastric power the jaw [citing Kingdon 1988]; the article gives no bite-force figure                    | –                                           |   –   | Read                                                                                                                   |

Not reachable from this environment (2026-11-05): imdb.com (bot challenge), natgeotv.com (no connection), thoughtco.com (HTTP 402), comicvine.gamespot.com (403), royalsocietypublishing.org and Wiley journal pages (403), and an Adelaide thesis record (thesis.library.adelaide.edu.au, handle 2440/88463) that surfaced in a search for hippo jaw biomechanics, whose title and content are therefore unknown.

**Free-model source sheet (#186).** It covers every free-model input (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of hippo 1 v elephant 1 (preset #16 seen from the hippo's side). The swing is the change in the hippo's win share from min to max, against 16.1 % with every input at its preset ([CALIBRATION.md §14](CALIBRATION.md#14-hippopotamus-186)).

| Free trait        | Unit  |   min |  mode |   max | Basis | Sensitivity range | Swing (pp) | Source / rationale                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ----- | ----: | ----: | ----: | :---: | ----------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mass`            | kg    | 1,300 | 1,500 | 3,200 |   L   | –                 |          – | Min and max: wild adults 1,300–3,200 kg [ADW]. Mode: a bull, mean 1.48 t [WP, citing Owen-Smith 1988], rounded. Larger records (2.66 t wild, 4.5 t captive) are left outside.                                                                                                                                                                                                                                                      |
| `bodyRadius`      | m     |     1 |  1.15 |  1.55 |   D   | –                 |          – | The buffalo's 0.7 / 0.85 / 1 m (§5.3, a barrel-bodied grazer of similar shoulder height) scaled isometrically by (hippo mass ÷ buffalo mass)^(1/3) at each of min, mode and max, rounded to 0.05 m. Check: half the 3.3–3.45 m head–body length is 1.65–1.7 m, and the buffalo's radius is about two thirds of its half-length. At 1 m and above the replay draws triangles, so the hippo is always a triangle (length 2.8–4.3 m). |
| `turnRate`        | deg/s |    40 |    70 |   120 | **S** | 40–120            |       +1.4 | No data. Between the elephant (30–90) and the buffalo (60–150): higher stride frequencies than elephants [Hutchinson & Pringle 2024], short legs.                                                                                                                                                                                                                                                                                  |
| `sprintSpeed`     | m/s   |     4 |     6 |   8.3 | **S** | 4–8.3             |       +1.7 | **U → S.** Max: the undocumented claim of ~8 m/s (30 km/h) [Hutchinson & Pringle 2024; WP; ADW]. Mode: just under the elephant's fastest reliable 6.8 m/s, since the paper finds hippos may at best "match the performance of elephants" at ~7 m/s. Min: the elephant's usual 4–4.5 m/s (§5.2).                                                                                                                                    |
| `cruiseSpeed`     | m/s   |   0.8 |   1.2 |   1.8 | **S** | 0.8–1.8           |        0.0 | A walking trot [Hutchinson & Pringle 2024]; no measured walking speed found (3–5 km a night of grazing [WP] is a distance, not a speed). The buffalo's mode with a narrower top.                                                                                                                                                                                                                                                   |
| `sprintEndurance` | s     |    15 |    40 |   100 | **S** | 15–100            |       +8.4 | "Can maintain these speeds for several hundred meters" [ADW, no measurement]: 200–600 m at 4–8 m/s is 25–150 s; the range is set lower because a 1.5 t trotter tires fast.                                                                                                                                                                                                                                                         |
| `recoveryTime`    | s     |    60 |   120 |   300 | **S** | 60–300            |       −3.0 | The elephant's row (megaherbivore).                                                                                                                                                                                                                                                                                                                                                                                                |
| `strikeForce`     | kN    |     4 |     8 |    15 | **S** | 4–15              |      +29.9 | **U → S.** Mode: the ~8.1 kN reported for one female (television measurement, unpublished; primary record still not found after the #210 review, see the table above and §13). Range kept by #210. Max: a bull's body weight (1.5 t × g ≈ 14.7 kN), the elephant's anchoring rule (§5.2), since bulls are larger and were not measured. Min: half the reported figure. The largest swing together with `strikeInterval`.           |
| `strikeLethality` | HP/kN |     4 |     8 |    12 | **S** | 4–12              |      +24.3 | Shared mapping for a toothed bite (§3.3 item 2): the canines (to 50 cm) are the combat weapon [WP].                                                                                                                                                                                                                                                                                                                                |
| `strikeInterval`  | s     |   1.5 |   2.5 |     5 | **S** | 1.5–5             |      −30.6 | No data. Lunging bites with a 100–110° gape [WP]; slower than the bears' alternating swipes (0.8–3), faster than the elephant's blows (2–8).                                                                                                                                                                                                                                                                                       |
| `strikeReach`     | m     |   1.6 |   1.9 |   2.3 | **S** | 1.6–2.3           |       +2.5 | Geometry: body radius + about 0.6–0.8 m of head and open jaw.                                                                                                                                                                                                                                                                                                                                                                      |
| `strikeArc`       | deg   |    30 |    50 |    80 | **S** | 30–80             |       +0.1 | Head swings in bull fights [WP]; the buffalo's arc, a little wider for the gape.                                                                                                                                                                                                                                                                                                                                                   |
| `strikeAccuracy`  | p     |   0.2 |  0.35 |  0.55 | **S** | 0.2–0.55          |      +23.1 | The buffalo's row (a heavy grazer striking with the head).                                                                                                                                                                                                                                                                                                                                                                         |
| `latchChance`     |       |     0 |     0 |     0 |   –   | –                 |          – | Inactive: the hippo does not latch (neutral values, docs/SPECIES.md §11.1). Same for `latchEndurance` (1 s) and `latchDps` (0).                                                                                                                                                                                                                                                                                                    |
| `shakeRate`       | 1/s   |  0.03 |  0.08 |   0.2 | **S** | 0.03–0.2          |        0.0 | The buffalo's row: short legs, cannot reach a rider on the back. Only read when a latcher rides it.                                                                                                                                                                                                                                                                                                                                |
| `bleed`           | 1/s   | 0.001 | 0.003 | 0.006 | **S** | 0.001–0.006       |       +0.2 | The brown bear's row: deep canine gashes, like claws (docs/SPECIES.md §11.2).                                                                                                                                                                                                                                                                                                                                                      |
| `morale`          | 0–1   |  0.65 |   0.8 |  0.95 | **S** | 0.65–0.95         |      +11.6 | The elephant's row: considered highly aggressive; charges boats [WP].                                                                                                                                                                                                                                                                                                                                                              |
| `moraleLoss`      | 0–1   |  0.02 |  0.05 |   0.1 | **S** | 0.02–0.1          |        0.0 | The shared heavy placeholder; read only by social species (docs/SPECIES.md §11.2).                                                                                                                                                                                                                                                                                                                                                 |

Flags and constants: `era` extant; `adSafe` true (a wild species, abstract glyph, no gore in any text); `social` false (adults form almost no social bonds and feed alone on land, above); `canLatch` false (bites only). `hide` 0.3 **S**: the skin is about 6 cm thick, at least as thick as the elephant's, so it takes the elephant's value (sensitivity not measured: `hide` only scales damage from a latcher, and no latcher appears in preset #16; against latching lions it matters, see CALIBRATION.md §14). `intimidation` 1 **S**, as every species before #47. Inactive traits carry no tag.

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): with the lion and the spotted hyena the interaction is documented (both prey on young hippos, and lion prides occasionally on adults [WP: Hippopotamus]); free mode shows no matchup badge, so this is recorded here and in the species guide note only. With every other living species in the roster "no recorded encounter" (`undocumented`): the elephant and the buffalo share its rivers, but no recorded fight was found; the polar bear, brown bear and tiger do not share its range. With _T. rex_ "never met" (66 Ma); with the woolly mammoth and _H. erectus_ "no recorded overlap" (`unrecorded`, the era rule). Not a what-if species.

Preset facts (the "Why?" of preset #16, `elephant-hippo`): both use the same African rivers and waterholes [WP: Hippopotamus; WP: African bush elephant], and the elephant's mode mass (3.2 t, §5.2) is about twice the hippo's (1.5 t, above). Preset #15 (hippo vs rhino) joined with the white rhinoceros (#187, §5.19).

Kept internal, never shipped: the demand notes of RENEWAL-1.0 §5.2 (YouGov 69 %, Reddit comment counts) and the television programme behind the bite figure. Neither appears in any preset text, species-guide note or UI string.

### 5.19 White rhinoceros (HEAVY, batch A; shipped in the free model, #187)

Southern white rhinoceros, _Ceratotherium simum simum_. Researched 2026-11-05 for batch A of the 1.0 renewal (RENEWAL-1.0 §5.2: mass L, speed **U** to be turned into **S** with a sensitivity range, horn force S, the horn as anatomy only). Like the polar bear and the hippo it has no legacy entry: the classic engine does not offer it, and its free entry is built from the sheet below with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §4.14 and §11.5). The id is `whiteRhino`, the same as in `scripts/demand/species.json`.

- **Mass and size (L).** Bulls average about 2,000–2,300 kg and cows about 1,600–1,700 kg; up to 3,600 kg is considered reliable, larger claims (to 4,500 kg) are unverified; head–body length 3.7–4 m in bulls and 3.35–3.65 m in cows, shoulder height 1.7–1.86 m in bulls [WP: White rhinoceros]. Adults 1,000–3,600 kg [ADW: Ceratotherium simum]; males 2,300 kg and females 1,800 kg [SDZWA]. By mean mass it is the largest land mammal after the elephants and "weighs more on average than a hippopotamus despite a considerable mass overlap" [WP: White rhinoceros].
- **Gait (L, qualitative).** White rhinos trot and gallop: Alexander & Pond filmed both and found low bone stresses in running, which suggests unusually high safety factors [Alexander & Pond 1992, abstract]. The abstract gives no speed; the full text could not be read from this environment (Wiley, closed access).
- **Top speed (U → S).** No measured top speed was found. Secondary sources agree on "up to 40 km/h for short periods" [ADW; SDZWA; RRC], and ADW gives 24 km/h as a running speed; none cites a measurement. Popular pages repeat 50–64 km/h without a source; they are not used. The S row puts the 40 km/h claim (11.1 m/s) at the top, the 24 km/h running speed (6.7 m/s, rounded to 7) at the mode, and 5 m/s at the bottom, just above the elephant's usual 4–4.5 m/s (§5.2), since the rhino gallops and the elephant does not.
- **Horn force (S).** No measurement of the force of a horn strike, a charge or a shove exists in the sources read. The horn is solid keratin on the snout, the front one about 60 cm long on average and up to 166 cm (cows), about 4 kg [WP: White rhinoceros]; 1,660 mm for the longer horn [ADW]. It appears only as anatomy: in the model the strike is a frontal head blow (`strikeForce` relabelled "horn force"), anchored like the elephant's and the hippo's on body weight (§5.2, §5.18).
- **Behaviour.** The most social rhino: crashes of up to 14, mostly cows; sub-adult bulls gather, often with a cow; most adult bulls are solitary and hold territories marked with dung and urine; the most serious fights are between bulls over a cow [WP: White rhinoceros]. "Sedentary, semi-social and territorial"; stable groups of up to six [RRC]. Generally non-aggressive, cows with calves more so [ADW]; "relatively unaggressive" with very poor eyesight [WP]. The model treats it as solitary (no pack buff): groups are cows with calves, and no cooperative defence is recorded.
- **Interactions.** Adults have no natural predators other than humans, and calves are rarely attacked thanks to the mother and their tough skin; one exceptional case is a lion pride taking a sick 1,540 kg bull at Mala Mala [WP: White rhinoceros]. Lions have killed a few calves, and torn ears and tails come from rare fights with spotted hyenas [ADW]. **Elephants:** at Pilanesberg, South Africa, young orphan bull elephants in early, long musth killed up to 49 white rhinos (confirmed in 1994 and 1996, a set suggested in 1992), of both sexes and all ages [Slotow & van Dyk 2001, abstract]; "more than 40 in five years" from 1992, which stopped after six older bulls were introduced in 1998 [Slotow 2000, via Science News]. **Hippo:** no scientific record of an encounter was found; only popular write-ups of filmed waterhole meetings, which are not cited (content rules, CONTRIBUTING.md).
- **Engine cannot express:** the charge that only drives an intruder off, horn wiping and other threat displays, wallowing, cows defending calves, and the musth that drove the Pilanesberg elephants (the model's elephant is an adult cow-sized animal, §5.2).

**Free-model source sheet (#187).** It covers every free-model input (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of white rhino 1 v elephant 1 (preset #14 seen from the rhino's side) and again in 1,000 runs of white rhino 1 v hippo 1 (preset #15 seen from the rhino's side). The swing is the change in the rhino's win share from min to max, against 26.4 % and 63.1 % with every input at its preset ([CALIBRATION.md §16](CALIBRATION.md#16-white-rhinoceros-187)).

| Free trait        | Unit  |   min |  mode |   max | Basis | Sensitivity range | Swing vs elephant (pp) | Swing vs hippo (pp) | Source / rationale                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----- | ----: | ----: | ----: | :---: | ----------------- | ---------------------: | ------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mass`            | kg    | 1,600 | 2,000 | 3,600 |   L   | –                 |                      – |                   – | Min: the cow mean, 1,600–1,700 kg [WP]. Mode: the low end of the bull mean, 2,000–2,300 kg [WP], rounded; above the hippo's 1.5 t, as the sources say on average. Max: 3,600 kg, the largest considered reliable [WP; ADW]. Unverified claims to 4,500 kg are left outside.                                                                                               |
| `bodyRadius`      | m     |   1.1 |  1.25 |   1.6 |   D   | –                 |                      – |                   – | The buffalo's 0.7 / 0.85 / 1 m (§5.3) scaled isometrically by (rhino mass ÷ buffalo mass)^(1/3) at each of min, mode and max, rounded to 0.05 m, as for the hippo. Check: half the 3.35–4 m head–body length is 1.7–2 m, and the buffalo's radius is about two thirds of its half-length. At 1 m and above the replay draws triangles, so the rhino is always a triangle. |
| `turnRate`        | deg/s |    40 |    80 |   140 | **S** | 40–140            |                   +1.0 |                +0.2 | No data. "Surprisingly agile" [RRC]; it gallops [Alexander & Pond 1992]. Between the hippo (40–120) and the buffalo (60–150).                                                                                                                                                                                                                                             |
| `sprintSpeed`     | m/s   |     5 |     7 |  11.1 | **S** | 5–11.1            |                   +2.6 |                 0.0 | **U → S.** Max: 40 km/h "for short periods" [ADW; SDZWA; RRC], no measurement. Mode: 24 km/h running speed [ADW], 6.7 m/s rounded. Min: just above the elephant's usual 4–4.5 m/s (§5.2).                                                                                                                                                                                 |
| `cruiseSpeed`     | m/s   |   0.8 |   1.2 |     2 | **S** | 0.8–2             |                   +0.5 |                −0.1 | The buffalo's row (a grazer of similar build); no measured walking speed found.                                                                                                                                                                                                                                                                                           |
| `sprintEndurance` | s     |    15 |    40 |   100 | **S** | 15–100            |                   +9.1 |                +4.0 | "For short periods" [ADW]; the hippo's row (a 1.5–3 t runner).                                                                                                                                                                                                                                                                                                            |
| `recoveryTime`    | s     |    60 |   120 |   300 | **S** | 60–300            |                   −2.5 |                −1.0 | The elephant's row (megaherbivore).                                                                                                                                                                                                                                                                                                                                       |
| `strikeForce`     | kN    |     6 |    12 |    20 | **S** | 6–20              |                  +35.8 |               +50.2 | Horn force, no measurement. Max: body weight at the mode (2 t × g ≈ 19.6 kN), the elephant's and the hippo's anchoring rule (§5.2, §5.18). Mode: about 60 % of it, the elephant's ratio of mode to body weight (20 of 31 kN). Min: half the mode.                                                                                                                         |
| `strikeLethality` | HP/kN |     4 |     8 |    12 | **S** | 4–12              |                  +33.2 |               +46.6 | The buffalo's horn row (shared mapping, §3.3 item 2): a pointed horn, not a blunt blow.                                                                                                                                                                                                                                                                                   |
| `strikeInterval`  | s     |   1.5 |   2.5 |     5 | **S** | 1.5–5             |                  −38.0 |               −46.1 | No data. The hippo's row: a heavy head strike, slower than the buffalo's hooks (1–4), faster than the elephant's blows (2–8).                                                                                                                                                                                                                                             |
| `strikeReach`     | m     |   1.7 |     2 |   2.5 | **S** | 1.7–2.5           |                   +1.6 |                +3.7 | Geometry: body radius + head and the front horn (about 60 cm on average [WP]).                                                                                                                                                                                                                                                                                            |
| `strikeArc`       | deg   |    30 |    45 |    70 | **S** | 30–70             |                    0.0 |                 0.0 | The buffalo's row: head swings with a horn.                                                                                                                                                                                                                                                                                                                               |
| `strikeAccuracy`  | p     |  0.15 |   0.3 |   0.5 | **S** | 0.15–0.5          |                  +34.5 |               +52.0 | The elephant's row, below the buffalo's: very poor eyesight [WP].                                                                                                                                                                                                                                                                                                         |
| `latchChance`     |       |     0 |     0 |     0 |   –   | –                 |                      – |                   – | Inactive: the rhino does not latch (neutral values, docs/SPECIES.md §11.1). Same for `latchEndurance` (1 s) and `latchDps` (0).                                                                                                                                                                                                                                           |
| `shakeRate`       | 1/s   |  0.03 |  0.08 |   0.2 | **S** | 0.03–0.2          |                    0.0 |                 0.0 | The buffalo's row: short legs, cannot reach a rider on the back. Only read when a latcher rides it.                                                                                                                                                                                                                                                                       |
| `bleed`           | 1/s   | 0.001 | 0.002 | 0.005 | **S** | 0.001–0.005       |                   +0.1 |                 0.0 | The buffalo's row: horn punctures.                                                                                                                                                                                                                                                                                                                                        |
| `morale`          | 0–1   |   0.6 |  0.75 |   0.9 | **S** | 0.6–0.9           |                  +16.5 |               +24.2 | The buffalo's row: generally non-aggressive [ADW; WP], but cows with calves and bulls over a cow fight.                                                                                                                                                                                                                                                                   |
| `moraleLoss`      | 0–1   |  0.02 |  0.05 |   0.1 | **S** | 0.02–0.1          |                    0.0 |                 0.0 | The shared heavy placeholder; read only by social species (docs/SPECIES.md §11.2).                                                                                                                                                                                                                                                                                        |

Flags and constants: `era` extant; `adSafe` true (a wild species, abstract glyph, no gore in any text; the horn trade is not mentioned in any shipped text); `social` false (groups are mostly cows with calves, adult bulls are solitary, above); `canLatch` false (horn blows only). `hide` 0.3 **S**: calves are protected by "their tough skin" [WP: White rhinoceros], so it takes the elephant's and the hippo's value; no skin-thickness measurement was checked (sensitivity not measured: `hide` only scales damage from a latcher, and neither preset has one; against latching lions it matters, see CALIBRATION.md §16). `intimidation` 1 **S**, as every species before #47. Inactive traits carry no tag.

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): with the elephant the interaction is documented (Pilanesberg, above); with the lion and the spotted hyena documented too (calves, one sick bull; torn ears and tails [WP; ADW]); free mode shows no matchup badge, so this is recorded here and in the species guide note only. With the hippo, the buffalo and every other living species "no recorded encounter" (`undocumented`): the hippo and the buffalo share its range, but no scientific record of a fight was found. With _T. rex_ and _Utahraptor_ "never met" (gone for at least 66 Ma); with the woolly mammoth and _H. erectus_ "no recorded overlap" (`unrecorded`, the era rule). Not a what-if species.

Preset facts: #14 `elephant-rhino`: young bull elephants attacked and killed white rhinos at Pilanesberg, and it stopped after older bulls were brought in [Slotow 2000; Slotow & van Dyk 2001]; the shipped text says "attacking" (banned-words rule). #15 `hippo-rhino`: both graze African grasslands and stay near water (the hippo rests in it by day [WP: Hippopotamus]; the white rhino drinks twice a day and wallows [WP: White rhinoceros]); the white rhino weighs more on average despite a considerable mass overlap [WP: White rhinoceros].

Kept internal, never shipped: the demand notes of RENEWAL-1.0 §5.2 (YouGov 74 %, a documentary-series episode, Reddit pairings), the popular write-ups of filmed hippo–rhino meetings and everything about poaching and the horn trade. None appears in any preset text, species-guide note or UI string.

**Sources that could not be reached** (2026-11-05, from this environment): the Koedoe full text (koedoe.co.za, host blocked; abstract read via the Crossref API), the _Pachyderm_ paper on elephants killing black and white rhinos in Hluhluwe-Umfolozi (pachydermjournal.org, host blocked; not used), the _Nature_ paper Slotow et al. 2000 (closed access; read via Science News), and the full text of Alexander & Pond 1992 (closed access; abstract via Crossref). No number above comes from them beyond what the abstracts and Science News state.

### 5.20 Triceratops (HEAVY, batch A′; shipped in the free model, #189)

_Triceratops horridus_ (with _T. prorsus_ inside the same ranges). Researched 2026-11-05 for batch A′ of the 1.0 renewal (RENEWAL-1.0 §5.2: mass L, speed S, horn S, the "Documented" badge from the healed bite). Like the white rhino it has no legacy entry: the classic engine does not offer it, and its free entry is built from the sheet below with `defineFreeSpecies` (`src/sim/free/species.ts`, docs/SPECIES.md §4.16 and §11.5). The id is `triceratops`, the same as in `scripts/demand/species.json`.

- **Era and range.** Late Maastrichtian of Laramidia (western North America), "about 69 to 66 million years ago"; fossil range 68–66 Ma [WP: Triceratops]. The sheet uses 68–66 Ma, the same as _T. rex_ (§5.1). One of the dominant herbivores of its time: hundreds of skulls are known from the Hell Creek Formation [WP].
- **Mass and size (L).** About 8–9 m long and "up to 6–10 t"; "Kelsey" (_T. horridus_), 6.7–7.3 m long with a 2 m skull, was estimated at about 5.4 t by the Black Hills Institute; "Big John" about 8 m long [WP: Triceratops]. The largest skull is estimated at 2.5 m [WP]. No Triceratops-specific value from a volumetric study (e.g. Campione & Evans 2020) could be read here: the review's abstract gives no species figures and its tables are behind Wiley's paywall. A popular figure of 9.3 t for an 8 m animal (attributed to G. S. Paul) appeared only in secondary search results and is not used. The row is 5,400 / 8,000 / 10,000 kg: Kelsey at the bottom, the top of the 6–10 t range at the top, and its midpoint as the mode.
- **Posture and speed (S).** Certainly quadrupedal; trackways and skeletal reconstructions show the forelimbs held nearly upright, elbows slightly bowed out, "comparable to the modern rhinoceros" [WP: Triceratops]. Paul & Christiansen 2000 find a near-parasagittal forelimb and infer that "the maximal running speed of even the largest ceratopsids … significantly exceeded that of elephants and was probably broadly similar to that of rhinos" [abstract]. No numerical estimate from a study was found. Popular pages give 24–35 km/h without a source. The S row is 4.5 / 7 / 9.7 m/s: the elephant's mode as the minimum (§5.2), the white rhino's mode as the mode (§5.19), and 35 km/h as the maximum.
- **Horns (S).** Two brow horns about 1 m long and a short nose horn [WP]. No measurement or model of the force of a horn strike exists in the sources read. Farke 2009 found frill (squamosal) lesions significantly more common in _Triceratops_ than in _Centrosaurus_ (P = 0.002), "consistent with _Triceratops_ using its horns in combat and the frill being adapted as a protective structure" [Farke 2009, full text]. A 2026 finite-element study finds the brow horns of _Triceratops_ and _Spiclypeus_ under "low-to-moderate stresses across most tests" in simulated combat [Ames 2026, abstract]; it gives no force usable here. The horn force row is anchored like the white rhino's and the hippo's: body weight at the mode mass (8 t × g ≈ 78.5 kN) as the maximum, about 60 % of it as the mode, about 30 % as the minimum.
- **The healed bite (documented).** A partial adult skull from the Hell Creek Formation has a broken left brow horn with two deep tooth marks matching an adult _Tyrannosaurus_ and tooth scores on the squamosal; the bone healed, so the animal survived [Happ 2008, via WP and a search summary of press and museum coverage]. "Which animal was the aggressor, however, is unknown" [WP]. _T. rex_ also fed on _Triceratops_: a heavily tooth-scored ilium and sacrum [Erickson & Olson 1996, via WP]. The NHM page cited in the issue could not be fetched (below); the chapter itself was not read.
- **Herding (S, treated as solitary).** "Although _Triceratops_ is commonly portrayed as a herding animal, there is currently little evidence to suggest that they lived in herds"; the one _Triceratops_-dominated bonebed holds three juveniles [Mathews 2009, via WP], and a group of three of different sizes found in 2012 may be a family [WP]. Finds were long known only from single individuals [WP]. This is far from the evidence for the lion or the raptor pack (§5.11, §5.15), so the model gives it no pack buff: `social` false. A later herd or family variant would need a new issue.
- **Engine cannot express:** horn locking with a rival, the frill as a shield (no damage direction in the model), herds or family groups defending young, and a predator's attack from behind or the side (the model's strike is a frontal cone).

**Free-model source sheet (#189).** It covers every free-model input (RENEWAL-1.0 §5.3 step 2). The **sensitivity range** of an S value is the range over which it was tested: each S trait was pinned at its min and then at its max, every other input at its preset, in 1,000 runs of _Triceratops_ 1 v _T. rex_ 1 (preset #13 seen from the _Triceratops_ side) and again in 1,000 runs of _Triceratops_ 1 v _Spinosaurus_ 1. The swing is the change in the _Triceratops_ win share from min to max, against 39.8 % and 92.1 % with every input at its preset ([CALIBRATION.md §18](CALIBRATION.md#18-triceratops-189)).

| Free trait        | Unit  |   min |  mode |    max | Basis | Sensitivity range | Swing vs _T. rex_ (pp) | Swing vs _Spinosaurus_ (pp) | Source / rationale                                                                                                                                                                                                                                                                                     |
| ----------------- | ----- | ----: | ----: | -----: | :---: | ----------------- | ---------------------: | --------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mass`            | kg    | 5,400 | 8,000 | 10,000 |   L   | 5,400–10,000      |                  +24.9 |                       +13.3 | Min: "Kelsey", about 5.4 t (Black Hills Institute) [WP]. Max: the top of "up to 6–10 t" [WP]. Mode: the midpoint of 6–10 t; the same as _T. rex_'s mode.                                                                                                                                               |
| `bodyRadius`      | m     |  1.65 |     2 |   2.25 |   D   | –                 |                      – |                           – | The buffalo's 0.7 / 0.85 / 1 m (§5.3) scaled by (mass ratio)^(1/3) at min, mode and max, rounded to 0.05 m, as for the hippo and the white rhino (a quadruped body). Check: half of an 8–9 m length without the 2 m skull is about 3 m, so a 2 m radius sits inside the body. The glyph is a triangle. |
| `turnRate`        | deg/s |    30 |    50 |     90 | **S** | 30–90             |                   −0.1 |                        +1.2 | No data. The elephant's row: a quadruped of similar mass.                                                                                                                                                                                                                                              |
| `sprintSpeed`     | m/s   |   4.5 |     7 |    9.7 | **S** | 4.5–9.7           |                   +1.1 |                        +1.4 | Faster than elephants, like rhinos [Paul & Christiansen 2000]. Min: the elephant's mode (§5.2). Mode: the white rhino's mode (§5.19). Max: 35 km/h, the upper popular figure (no study cited).                                                                                                         |
| `cruiseSpeed`     | m/s   |   0.8 |   1.2 |      2 | **S** | 0.8–2             |                   −0.3 |                        +0.3 | The white rhino's and buffalo's row; no trackway speed was checked.                                                                                                                                                                                                                                    |
| `sprintEndurance` | s     |    15 |    40 |    100 | **S** | 15–100            |                  +11.7 |                       +18.3 | The white rhino's row.                                                                                                                                                                                                                                                                                 |
| `recoveryTime`    | s     |    60 |   120 |    300 | **S** | 60–300            |                   −0.9 |                        −5.7 | The elephant's and white rhino's row (megaherbivore).                                                                                                                                                                                                                                                  |
| `strikeForce`     | kN    |    24 |    47 |     78 | **S** | 24–78             |                  +49.3 |                       +23.1 | Horn force, no measurement. Max: body weight at the mode (8 t × g ≈ 78.5 kN), the rule of the hippo and the white rhino (§5.18, §5.19). Mode and min: 0.6 and 0.3 of it, the white rhino's ratios.                                                                                                     |
| `strikeLethality` | HP/kN |     4 |     8 |     12 | **S** | 4–12              |                  +46.1 |                       +21.4 | The pointed-horn mapping of the buffalo and the white rhino (§3.3 item 2).                                                                                                                                                                                                                             |
| `strikeInterval`  | s     |   1.5 |   2.5 |      5 | **S** | 1.5–5             |                  −53.2 |                       −18.0 | The white rhino's row: heavy head strikes.                                                                                                                                                                                                                                                             |
| `strikeReach`     | m     |   3.2 |     4 |    4.8 | **S** | 3.2–4.8           |                   +4.0 |                        +3.0 | Geometry: body radius + skull (1.5 / 2 / 2.5 m; Kelsey 2 m, the largest 2.5 m [WP]; the minimum assumed).                                                                                                                                                                                              |
| `strikeArc`       | deg   |    30 |    45 |     70 | **S** | 30–70             |                    0.0 |                        +0.1 | The buffalo's and white rhino's row: head swings with horns.                                                                                                                                                                                                                                           |
| `strikeAccuracy`  | p     |   0.2 |  0.35 |   0.55 | **S** | 0.2–0.55          |                  +45.1 |                       +22.5 | The buffalo's row; no data on its eyesight.                                                                                                                                                                                                                                                            |
| `latchChance`     |       |     0 |     0 |      0 |   –   | –                 |                      – |                           – | Inactive: it does not latch (neutral values, docs/SPECIES.md §11.1). Same for `latchEndurance` (1 s) and `latchDps` (0).                                                                                                                                                                               |
| `shakeRate`       | 1/s   |  0.03 |  0.08 |    0.2 | **S** | 0.03–0.2          |                    0.0 |                         0.0 | The buffalo's and white rhino's row; only read when a latcher rides it.                                                                                                                                                                                                                                |
| `bleed`           | 1/s   | 0.001 | 0.002 |  0.005 | **S** | 0.001–0.005       |                    0.0 |                        +0.1 | The white rhino's row.                                                                                                                                                                                                                                                                                 |
| `morale`          | 0–1   |   0.6 |  0.75 |    0.9 | **S** | 0.6–0.9           |                  +22.6 |                       +10.9 | The buffalo's and white rhino's row: a herbivore that defends itself.                                                                                                                                                                                                                                  |
| `moraleLoss`      | 0–1   |  0.02 |  0.05 |    0.1 | **S** | 0.02–0.1          |                    0.0 |                         0.0 | The shared heavy placeholder; read only by social species (docs/SPECIES.md §11.2).                                                                                                                                                                                                                     |

Flags and constants: `era` 68–66 Ma; `adSafe` true (an extinct wild species, abstract glyph, no gore in any text); `social` false (above); `canLatch` false (horn blows only). `hide` 0.5 **S**: the body was covered in large scales, the largest known in ceratopsians at up to 9 cm, with conical feature scales [WP], and the frill is solid; no measurement, so it takes the buffalo's value, between the dinosaurs' 1 and the pachyderms' 0.3 (sensitivity not measured: `hide` only scales damage from a latcher, and neither opponent is one). `intimidation` 1 **S**, as every species before #47. Inactive traits carry no tag.

Overlap labels (content check, RENEWAL-1.0 §5.3 step 3): with _T. rex_ **documented** (the healed bite and the feeding traces, above); free mode shows no matchup badge, so preset #13 carries the `documented` tag and the species guide note says it. With _Utahraptor_ and _Spinosaurus_ "never met" (disjoint eras); with every living species, the woolly mammoth and _H. erectus_ "never met" (gone for 66 Ma). Its era overlaps _T. rex_'s, so neither is a what-if species: _T. rex_ loses the what-if tag it had alone until now (`isWhatIf`, docs/PAGES.md). No text-share emoji exists for a horned dinosaur (🦖 is _T. rex_'s, 🦕 a sauropod), so it uses the fallback 🔷 / 🔶.

Preset facts (the "Why?" of preset #13, `trex-triceratops`): they lived together in western North America about 68–66 million years ago [WP: Triceratops; §5.1]; a brow horn with a broken tip carries healed _T. rex_ tooth marks, so the horned animal survived the encounter [Happ 2008]. The shipped text does not say which animal attacked, as the source does not know.

Kept internal, never shipped: the demand notes of RENEWAL-1.0 §5.2 (the UK favourite poll, pageviews, Reddit counts) and a palaeontologist's opinion on who would win a fight, quoted on Wikipedia. None appears in any preset text, species-guide note or UI string.

**Sources that could not be reached** (2026-11-05, from this environment): the NHM Dino Directory page cited in the issue (www.nhm.ac.uk), Science News (sciencenews.org) and the Florida Museum blog (floridamuseum.ufl.edu), all hosts outside this session's network allowance; Europe PMC search (503 "temporarily unavailable" at the time); the Happ 2008 chapter (a book, not online); the Mathews 2009 note (Taylor & Francis, no abstract in Crossref); the Campione & Evans 2020 tables (Wiley). The Wikipedia page was read through the Wikimedia REST API after waiting out a rate limit (`Retry-After`). No number above comes from an unreachable source beyond what Wikipedia, the abstracts and the search summary state.

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

**Deferred until new mechanics exist** (§9): Nile crocodile (M8, M9), Spinosaurus (M9, M10; shipped in the free model as a land duel without water, #185), Komodo dragon (M7).

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

- A scratch copy of `src/sim` at `6c84e0e`, compiled with the repo's `tsc` outside the repository.
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

- **[Avedik & Clauss 2023]** Avedik A., Clauss M. Chewing, dentition and tooth wear in Hippopotamidae (_Hippopotamus amphibius_ and _Choeropsis liberiensis_). _PLoS ONE_ 18:e0291825. <https://doi.org/10.1371/journal.pone.0291825> [FT, via Europe PMC PMC10550173, read 2026-11-05]
- **[Alexander & Pond 1992]** Alexander R.McN., Pond C.M. Locomotion and bone strength of the white rhinoceros, _Ceratotherium simum_. _J. Zool._ 227:63–69. <https://doi.org/10.1111/j.1469-7998.1992.tb04344.x> [Abs, via the Crossref API, read 2026-11-05; full text closed]
- **[Donadio & Buskirk 2006]** Donadio E., Buskirk S.W. Diet, morphology, and interspecific killing in Carnivora. _Am. Nat._ 167:524–536. <https://doi.org/10.1086/501033> [Abs, via Europe PMC, read 2026-11-10]
- **[Hayward 2006]** Hayward M.W. Prey preferences of the spotted hyaena (_Crocuta crocuta_) and degree of dietary overlap with the lion (_Panthera leo_). _J. Zool._ 270:606–614. <https://doi.org/10.1111/j.1469-7998.2006.00183.x> [Abs, via Crossref, read 2026-11-10]
- **[Hayward & Kerley 2005]** Hayward M.W., Kerley G.I.H. Prey preferences of the lion (_Panthera leo_). _J. Zool._ 267:309–322. <https://doi.org/10.1017/S0952836905007508> [Abs, via Crossref, read 2026-11-10]
- **[Hayward 2012]** Hayward M.W., Jędrzejewski W., Jędrzejewska B. Prey preferences of the tiger _Panthera tigris_. _J. Zool._ 286:221–231. <https://doi.org/10.1111/j.1469-7998.2011.00871.x> [Abs, via Crossref, read 2026-11-10]
- **[Hurst 1982a]** Hurst R.J., Øritsland N.A., Watts P.D. Body mass, temperature and cost of walking in polar bears. _Acta Physiol. Scand._ 115:391–395. <https://doi.org/10.1111/j.1748-1716.1982.tb07096.x> [Abs, via Europe PMC, read 2026-11-10]
- **[Hurst 1982b]** Hurst R.J. et al. Polar bear locomotion: body temperature and energetic cost. _Can. J. Zool._ 60:40–44. <https://doi.org/10.1139/z82-005> [Abs, via Crossref, read 2026-11-10]
- **[Miller 2015]** Miller S., Wilder J., Wilson R.R. Polar bear–grizzly bear interactions during the autumn open-water period in Alaska. _J. Mammal._ 96:1317–1325. <https://doi.org/10.1093/jmammal/gyv140> [Abs, via Semantic Scholar, read 2026-11-10]
- **[Owen-Smith & Mills 2008]** Owen-Smith N., Mills M.G.L. Predator–prey size relationships in an African large-mammal food web. _J. Anim. Ecol._ 77:173–183. <https://doi.org/10.1111/j.1365-2656.2007.01314.x> [Abs, via Europe PMC, read 2026-11-10]
- **[Pagano 2018]** Pagano A.M. et al. High-energy, high-fat lifestyle challenges an Arctic apex predator, the polar bear. _Science_ 359:568–572. <https://doi.org/10.1126/science.aan8677> [Abs, via Europe PMC, read 2026-11-10]
- **[Sinclair 2003]** Sinclair A.R.E., Mduma S., Brashares J.S. Patterns of predation in a diverse predator–prey system. _Nature_ 425:288–290. <https://doi.org/10.1038/nature01934> [Abs, via Europe PMC, read 2026-11-10]
- **[Valeix 2007]** Valeix M., Chamaillé-Jammes S., Fritz H. Interference competition and temporal niche shifts: elephants and herbivore communities at waterholes. _Oecologia_ 153:739–748. <https://doi.org/10.1007/s00442-007-0764-5> [Abs, via Europe PMC, read 2026-11-10]
- **[Bates & Falkingham 2012]** Estimating maximum bite performance in _Tyrannosaurus rex_ using multi-body dynamics. _Biology Letters_ 8:660–664. <https://doi.org/10.1098/rsbl.2012.0056> [MODEL]
- **[Bishop 2019]** Bishop P.J. Testing the function of dromaeosaurid (Dinosauria, Theropoda) 'sickle claws' through musculoskeletal modelling and optimization. _PeerJ_ 7:e7577. <https://doi.org/10.7717/peerj.7577> [FT, via Europe PMC PMC6717499, read 2026-11-05]
- **[Christiansen & Wroe 2007]** Bite forces and evolutionary adaptations to feeding ecology in carnivores. _Ecology_ 88:347–358. <https://doi.org/10.1890/0012-9658(2007)88[347:BFAEAT]2.0.CO;2> [WP]
- **[D'Amore 2011]** D'Amore D.C. et al. The effects of biting and pulling on the forces generated during feeding in the Komodo dragon. _PLoS ONE_ 6:e26226. <https://doi.org/10.1371/journal.pone.0026226> [FT]
- **[Erickson 2012]** Erickson G.M. et al. Insights into the ecology and evolutionary success of crocodilians revealed through bite-force and tooth-pressure experimentation. _PLoS ONE_ 7:e31781. <https://doi.org/10.1371/journal.pone.0031781> [FT]
- **[Fidalgo 2025]** Fidalgo D. et al. Impact of life history on _Hippopotamus_ skull ontogeny. _Evol. Dev._ <https://doi.org/10.1111/ede.70013> [Abs, read 2026-11-05]
- **[Ames 2026]** Ames C., Rowe A.J., Button D.J. Let them fight: using finite element analysis to determine combative evolutionary drivers of ceratopsian (Dinosauria: Ornithischia) horns. _PeerJ_ (2026). <https://doi.org/10.7717/peerj.21728> [Abs, via the Crossref API, read 2026-11-05]
- **[Campione & Evans 2020]** Campione N.E., Evans D.C. The accuracy and precision of body mass estimation in non-avian dinosaurs. _Biol. Rev._ 95:1759–1797. <https://doi.org/10.1111/brv.12638> [Abs, via the Crossref API, read 2026-11-05; no species values in the abstract]
- **[Farke 2009]** Farke A.A., Wolff E.D.S., Tanke D.H. Evidence of combat in _Triceratops_. _PLoS ONE_ 4(1):e4252. <https://doi.org/10.1371/journal.pone.0004252> [FT, PLOS XML, read 2026-11-05]
- **[Fowler 2011]** The predatory ecology of _Deinonychus_ and the origin of flapping in birds. _PLoS ONE_ 6:e28964. <https://doi.org/10.1371/journal.pone.0028964> [FT, via Europe PMC PMC3237572, read 2026-11-05]
- **[Frederickson 2020]** Frederickson J.A., Engel M.H., Cifelli R.L. Ontogenetic dietary shifts in _Deinonychus antirrhopus_ (Theropoda; Dromaeosauridae): insights into the ecology and social behavior of raptorial dinosaurs through stable isotope analysis. _Palaeogeogr. Palaeoclimatol. Palaeoecol._ 552:109780. <https://doi.org/10.1016/j.palaeo.2020.109780> [Abs, search summary, 2026-11-05]
- **[Fry 2009]** A central role for venom in predation by _Varanus komodoensis_. _PNAS_ 106:8969–8974. <https://doi.org/10.1073/pnas.0810883106> [Abs]
- **[Funston 2001]** Funston P.J., Mills M.G.L., Biggs H.C. Factors affecting the hunting success of male and female lions in the Kruger National Park. _J. Zool._ 253:419–431. <https://doi.org/10.1017/S0952836901000395> [Abs]
- **[Gignac 2010]** A description of _Deinonychus antirrhopus_ bite marks and estimates of bite force using tooth indentation simulations. _J. Vert. Paleontol._ 30:1169–1177. <https://doi.org/10.1080/02724634.2010.483535> [Abs]
- **[Haddara 2020]** Haddara M.M. et al. Hippopotamus bite morbidity: a report of 11 cases from Burundi. _Oxford Med. Case Rep._ 2020:omaa061. <https://doi.org/10.1093/omcr/omaa061> [FT, via Europe PMC PMC7416829, read 2026-11-05]. Its bite figure (12,600 kPa) cites a popular listicle (Strauss B., "The 10 Strongest Bites in the Animal Kingdom", ThoughtCo), which could not be reached.
- **[Hubel 2016a]** Hubel T.Y. et al. Energy cost and return for hunting in African wild dogs and cheetahs. _Nat. Commun._ 7:11034. <https://doi.org/10.1038/ncomms11034> [FT]
- **[Hubel 2016b]** Hubel T.Y. et al. Additive opportunistic capture explains group hunting benefits in African wild dogs. _Nat. Commun._ 7:11033. <https://doi.org/10.1038/ncomms11033> [FT abstract and introduction]
- **[Hutchinson 2003]** Hutchinson J.R. et al. Are fast-moving elephants really running? _Nature_ 422:493–494. <https://doi.org/10.1038/422493a> [Abs]
- **[Hutchinson 2006]** Hutchinson J.R. et al. The locomotor kinematics of Asian and African elephants: changes with speed and size. _J. Exp. Biol._ 209:3812–3827. <https://doi.org/10.1242/jeb.02443> [Abs]
- **[Hutchinson 2019]** Divergent evolution of terrestrial locomotor abilities in extant Crocodylia. _Sci. Rep._ <https://doi.org/10.1038/s41598-019-55768-6> [FT]
- **[Hutchinson & Pringle 2024]** Hutchinson J.R., Pringle E.V. Footfall patterns and stride parameters of Common hippopotamus (_Hippopotamus amphibius_) on land. _PeerJ_ 12:e17675. <https://doi.org/10.7717/peerj.17675> [FT, via Europe PMC PMC11227274, read 2026-11-04]
- **[Jimenez 2008]** Gray wolves, _Canis lupus_, killed by cougars, _Puma concolor_, and a grizzly bear, _Ursus arctos_, in Montana, Alberta, and Wyoming. _Can. Field-Nat._ 122:76–78. <https://doi.org/10.22621/cfn.v122i1.550> [Abs]
- **[Joubert 2006]** Hunting behaviour of lions (_Panthera leo_) on elephants (_Loxodonta africana_) in the Chobe National Park, Botswana. _Afr. J. Ecol._ 44:279–281. <https://doi.org/10.1111/j.1365-2028.2006.00626.x> [WP]
- **[Larramendi 2016]** Shoulder height, body mass and shape of proboscideans. _Acta Palaeontol. Pol._ 61:537–574. <https://doi.org/10.4202/app.00136.2014> [WP]
- **[MacNulty 2014]** MacNulty D.R., Tallian A., Stahler D.R., Smith D.W. Influence of group size on the success of wolves hunting bison. _PLoS ONE_ 9:e112884. <https://doi.org/10.1371/journal.pone.0112884> [FT]
- **[Paul & Christiansen 2000]** Paul G.S., Christiansen P. Forelimb posture in neoceratopsian dinosaurs: implications for gait and locomotion. _Paleobiology_ 26:450–465. <https://doi.org/10.1666/0094-8373(2000)026<0450:FPINDI>2.0.CO;2> [Abs, via the Crossref API, read 2026-11-05]
- **[Power & Compion 2009]** Lion predation on elephants in the Savuti, Chobe National Park, Botswana. _African Zoology_ 44:36–44. <https://doi.org/10.3377/004.044.0104> [Abs]
- **[Rayfield 2001]** Cranial design and function in a large theropod dinosaur. _Nature_ 409:1033–1037. <https://doi.org/10.1038/35059070> [Abs]
- **[Sakamoto 2022]** Sakamoto M. Estimating bite force in extinct dinosaurs using phylogenetically predicted physiological cross-sectional areas of jaw adductor muscles. _PeerJ_ 10:e13731. <https://doi.org/10.7717/peerj.13731> [FT]
- **[Sellers 2017]** Investigating the running abilities of _Tyrannosaurus rex_ using stress-constrained multibody dynamic analysis. _PeerJ_ 5:e3420. <https://peerj.com/articles/3420/> [MODEL]
- **[Sellers & Manning 2007]** Estimating dinosaur maximum running speeds using evolutionary robotics. _Proc. R. Soc. B_ 274. <https://doi.org/10.1098/rspb.2007.0846>, full text <https://pmc.ncbi.nlm.nih.gov/articles/PMC2279215/> [FT]
- **[Sereno 2022]** Sereno P.C. et al. _Spinosaurus_ is not an aquatic dinosaur. _eLife_ 11:e80092. <https://doi.org/10.7554/eLife.80092> [FT, re-read 2026-11-05 for #185]
- **[Fabbri 2022]** Fabbri M. et al. Subaqueous foraging among carnivorous dinosaurs. _Nature_ 603:852–857. <https://doi.org/10.1038/s41586-022-04528-0> [Abs, via Europe PMC, read 2026-11-05]
- **[Henderson 2018]** Henderson D.M. A buoyancy, balance and stability challenge to the hypothesis of a semi-aquatic _Spinosaurus_ Stromer, 1915 (Dinosauria: Theropoda). _PeerJ_ 6:e5409. <https://doi.org/10.7717/peerj.5409> [Abs, via the Crossref API, read 2026-11-05]
- **[Hone & Holtz 2021]** Hone D.W.E., Holtz T.R. Jr. Evaluating the ecology of _Spinosaurus_: shoreline generalist or aquatic pursuit specialist? _Palaeontologia Electronica_ 24(1):a03. <https://doi.org/10.26879/1110> [FT, read 2026-11-05]
- **[Ibrahim 2014]** Ibrahim N. et al. Semiaquatic adaptations in a giant predatory dinosaur. _Science_ 345:1613–1616. <https://doi.org/10.1126/science.1258750> [Abs, via Europe PMC, read 2026-11-05]
- **[Ibrahim 2020]** Ibrahim N. et al. Tail-propelled aquatic locomotion in a theropod dinosaur. _Nature_ 581:67–70. <https://doi.org/10.1038/s41586-020-2190-3> [Abs, via Europe PMC, read 2026-11-05]
- **[Myhrvold 2024]** Myhrvold N.P. et al. Diving dinosaurs? Caveats on the use of bone compactness and pFDA for inferring lifestyle. _PLoS ONE_ 19:e0298957. <https://doi.org/10.1371/journal.pone.0298957> [FT, read 2026-11-05]
- **[Shannon 2021]** Shannon G., Sadler P., Smith J., Roylance-Casson E., Cordes L.S. Contrasting selection pressure on body and weapon size in a polygynous megaherbivore. _Biol. Lett._ 17:20210368. <https://doi.org/10.1098/rsbl.2021.0368> [FT, via Europe PMC PMC8492169, read 2026-11-05]
- **[Slotow 2000]** Slotow R., van Dyk G., Poole J., Page B., Klocke A. Older bull elephants control young males. _Nature_ 408:425–426. <https://doi.org/10.1038/35044191> [not read, closed; summarised by Milius S., "Really big guys restrain youth violence", _Science News_, 25 Nov 2000, <https://www.sciencenews.org/article/really-big-guys-restrain-youth-violence>, read 2026-11-05]
- **[Slotow & van Dyk 2001]** Slotow R., van Dyk G. Role of delinquent young "orphan" male elephants in high mortality of white rhinoceros in Pilanesberg National Park, South Africa. _Koedoe_ 44(1). <https://doi.org/10.4102/koedoe.v44i1.188> [Abs, via the Crossref API, read 2026-11-05; koedoe.co.za not reachable]
- **[Snively 2019]** Snively E. et al. Lower rotational inertia and larger leg muscles indicate more rapid turns in tyrannosaurids than in other large theropods. _PeerJ_ 7:e6432. <https://doi.org/10.7717/peerj.6432> [FT]
- **[Stander 1992]** Cooperative hunting in lions: the role of the individual. _Behav. Ecol. Sociobiol._ 29:445–454. <https://doi.org/10.1007/BF00170175> [Abs]
- **[van der Meijden 2023]** Measurement of voluntary bite forces in large carnivores using a semi-automated reward-driven system. _J. Exp. Biol._ 226:jeb245255. <https://doi.org/10.1242/jeb.245255> [WP]
- **[Wilson 2018]** Biomechanics of predator–prey arms race in lion, zebra, cheetah and impala. _Nature_ 554:183–188. <https://doi.org/10.1038/nature25479> [WP]
- **[Wroe 2005]** Bite club: comparative bite force in big biting mammals and the prediction of predatory behaviour in fossil taxa. _Proc. R. Soc. B_ 272:619–625. <https://doi.org/10.1098/rspb.2004.2986>. Individual values quoted here (lion 1,768 N; wild dog ~428 N) come from secondary search snippets **[U]**.
- **Other sources cited only via Wikipedia** (not read): Smuts 1980 (lion mass), Kearns 1937 (grizzly speed), Bates 2009 ("Big Al" mass), Carpenter 2005 (_Stegosaurus_ spike wound), Therrien 2005 (theropod jaw mechanics), Blanco & Mazzetta 2001 (Giganotosaurus speed), Coria & Currie 2002 (Giganotosaurus braincase), Ostrom 1976, Brinkman 1998, Campione 2014, Roach & Brinkman 2007, Li 2007 (Deinonychus), and for _Triceratops_ (#189) Happ 2008 (the healed bite; also a search summary of press and museum coverage), Mathews et al. 2009 (the juvenile bonebed, _J. Vert. Paleontol._ 29:286–290, <https://doi.org/10.1080/02724634.2009.10010382>) and Erickson & Olson 1996 (_T. rex_ bite marks). The Wikipedia pages below give their full citations.
- **Hippopotamus, cited only via secondary sources** (not read, 2026-11-04): Owen-Smith 1988 (mass), Eltringham 1999 (skin, dentition), Herring 1975 (gape), via [WP: Hippopotamus]; Dagg 1973, Garland 1983, Kingdon 1989 and Nowak 1999 (the undocumented ~8 m/s claim), via [Hutchinson & Pringle 2024]. **[ADW: Hippopotamus amphibius]** Animal Diversity Web account, <https://animaldiversity.org/accounts/Hippopotamus_amphibius/> (mass range, 30 km/h claim). The bite figure (about 8.1 kN, one female, television measurement attributed to Brady Barr) was found only in popular secondary articles (for example <https://a-z-animals.com/blog/what-is-a-hippos-bite-force/>); its primary record could not be found or checked from this environment, so it is **U**. A second search for #210 (2026-11-05) found no primary record either; the sources checked and the hosts that could not be reached are listed in §5.18.
- **White rhinoceros, secondary sources** (read 2026-11-05): **[ADW: Ceratotherium simum]** Animal Diversity Web account, <https://animaldiversity.org/accounts/Ceratotherium_simum/> (mass range, 24 and 40 km/h, predators); **[SDZWA]** San Diego Zoo Wildlife Alliance Library fact sheet, <https://ielc.libguides.com/sdzg/factsheets/whiterhino> (mass, "can gallop up to 40 kph"); **[RRC]** an untitled white rhino fact section hosted by the Rhino Resource Center, <https://rhinoresourcecenter.com/wp-content/uploads/2006/12/1175861943.pdf> (pp. 57–59: mass, "up to 40 km/h for short periods", social behaviour). None cites a speed measurement. Not reachable: koedoe.co.za and pachydermjournal.org (host blocked from this environment).
- **Scandinavian wolf chase study** (SLU): "Wolf predation on moose and roe deer: chase distances and outcome". <https://research.slu.se/en/publications/wolf-predation-on-moose-and-roe-deer-chase-distances-and-outcome-> [Abs; units not verified]

**Wikipedia pages** (secondary, accessed 2026-10-19)

- [WP: Hippopotamus] <https://en.wikipedia.org/wiki/Hippopotamus> (revision 1382059641, accessed 2026-11-04; current text re-read 2026-11-05 for #210, no bite-force figure)
- [WP: Dangerous Encounters with Brady Barr] <https://en.wikipedia.org/wiki/Dangerous_Encounters_with_Brady_Barr> (episode list only, accessed 2026-11-05)
- [WP: White rhinoceros] <https://en.wikipedia.org/wiki/White_rhinoceros> (revision 1379845975, read through the MediaWiki API, accessed 2026-11-05)
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
- [WP: Utahraptor] <https://en.wikipedia.org/wiki/Utahraptor> (re-read 2026-11-05 for #188 through the MediaWiki API)
- [WP: Dakotaraptor] <https://en.wikipedia.org/wiki/Dakotaraptor>
- [WP: Spinosaurus] <https://en.wikipedia.org/wiki/Spinosaurus> (re-read 2026-11-05 for #185 through the Wikimedia REST API, revision 1383593376)
- [WP: Triceratops] <https://en.wikipedia.org/wiki/Triceratops> (read 2026-11-05 for #189 through the Wikimedia REST API, revision 1383251293)
- [WP: Giganotosaurus] <https://en.wikipedia.org/wiki/Giganotosaurus>
- [WP: Allosaurus] <https://en.wikipedia.org/wiki/Allosaurus>
- [WP: Tiger] <https://en.wikipedia.org/wiki/Tiger>
- [WP: Bite force quotient] <https://en.wikipedia.org/wiki/Bite_force_quotient>

**Policy**

- **[Google Publisher Policies]** <https://support.google.com/publisherpolicies/answer/10502938> [Abs]

## 14. Flight traits for model 2 (#169)

Researched 2026-11-10 for #169 (owner decision 2026-11-02: flight follows researched behaviour, as per-species traits). They ship under free model version 2 together with the deterministic math of #197; model 1 keeps no flight traits, so its links reproduce unchanged (ADR-0008). The registry rows are in `src/sim/free/species.ts` (`SPECIES_REVISIONS[2]`), the summary in [docs/SPECIES.md §11.6](../SPECIES.md#116-flight-traits-model-2-169) and the measured swing of every **S** value in [CALIBRATION.md §19](CALIBRATION.md#19-flight-traits-and-model-2-169-197).

### 14.1 What was missing

In the model 1 engine a solitary animal loses morale only to its own wounds (FREE-MATCHUPS.md §4.5), and one _T. rex_ strike usually incapacitates a tiger outright, so tigers fled in 2.5–11.5 % of their losses where the classic model, through its nearby-incapacitation shock, gave 52–93 % (CALIBRATION.md §3). The tiger's own evidence (it avoids injurious fights) points to more flight. The fix the owner chose is a set of per-species traits, not a global rule.

### 14.2 The three traits

| Trait         | Unit   | Meaning (engine, `src/sim/free/engine.ts`)                                                                                                                                                                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `threatRatio` | ×      | Disengage threshold as a body-mass ratio: an active enemy whose individual mass is at least this many times the agent's own outmatches it.                                                                                                                                            |
| `threatTime`  | s      | Disengage tendency: seconds spent within an outmatching enemy's strike reach (+ its own body radius + the 4 m danger margin), or riding it, after which an unhurt agent breaks off. Morale falls linearly from the agent's starting value to the rout threshold (0.2) over this time. |
| `soloShock`   | morale | Solitary morale sensitivity: morale a member of a non-social species loses for each ally incapacitated within 40 m in a tick (at most 3). Social species carry 0 (inactive): their shock is the pack buff's contagion (design §5.2).                                                  |

They are species constants like `hide`: not sampled per run, not in the design matrix and not in links, so the design matrix keeps its layout in every model version. The engine reads each row's mode; the min and max are the sensitivity range, swept one at a time in CALIBRATION.md §19. A mass ratio was chosen over an HP fraction for the threshold because wounds already cost morale in proportion to the damage (`woundRef`, design §4.5); the gap #169 found is flight _before_ the first wound.

### 14.3 Sources

What the literature supports, and what it does not:

- **No study measures a disengage time or a morale loss.** Every `threatTime` and `soloShock` value is **S**. Their ranges are wide on purpose.
- **Predator–prey size.** Living large carnivores favour prey of about half to twice their own mass, within a total prey range up to about an order of magnitude above it; ungulates larger than twice a predator's mass contributed substantially only to the diet of lions (group hunters), and megaherbivores substantially above 1,000 kg were rarely killed [Owen-Smith & Mills 2008, Abs]. Prey above about 150 kg have few natural predators [Sinclair 2003, Abs]. Interspecific attacks among carnivores are least likely at small and large body-size differences [Donadio & Buskirk 2006, Abs] (the paper's numeric ratio was not read, so none is used).
- **Tiger.** Preferred prey 60–250 kg, a predator-to-preferred-prey ratio of about 1:1, "similar to other solitary felids" [Hayward 2012, Abs].
- **Lion.** Preferred prey 190–550 kg, most preferred 350 kg; buffalo and giraffe are significantly preferred, and the right skew of the preference curve is attributed to collective hunting [Hayward & Kerley 2005, Abs]. Adult elephants mob and chase off lions; in Chobe, successful lion hunts on elephants took place after dark, with prides of more than 27 lions against herds of fewer than 5, mostly on young elephants [WP: African bush elephant, citing Power & Compion 2009].
- **Spotted hyena.** Preferred prey 56–182 kg, mode 102 kg; buffalo and giraffe are significantly avoided [Hayward 2006, Abs]. Hyenas leave a carcass to lions or wait at 30–100 m, and prevail against lionesses only when they outnumber them about 4:1 [WP: Spotted hyena].
- **Gray wolf.** Bison, the wolves' most formidable prey, needed 9–13 wolves for capture success to level off, against 2–6 for elk [MacNulty 2014, Abs]. Wolves can wound large prey and wait, lessening the risk of injury, and are dominated by brown bears at carcasses [WP: Wolf].
- **Polar bear.** Adult walruses are too large and formidable to hunt; polar bears take young ones [WP: Polar bear]. At whale carcasses in Alaska, polar bears were more likely to be displaced by grizzly bears than by other polar bears, and grizzlies were socially dominant [Miller 2015, Abs]. Walking costs about twice the quadruped prediction, and deep body temperature rises steeply with speed, a "relative inability to dissipate metabolic heat" [Hurst 1982a, Abs; Hurst 1982b, Abs]; field metabolic rates are 1.6 times higher than assumed [Pagano 2018, Abs].
- **Large herbivores.** Elephants are behaviourally dominant over other herbivores at waterholes, and the most affected species shift their visits [Valeix 2007, Abs]. Young bull elephants killed rhinos in South African parks [WP: African bush elephant; Slotow 2000, not read]. Buffalo drive off or kill lions; adult white rhinos have no natural predators and are "relatively unaggressive"; hippos are aggressive, and adults are rarely preyed upon [WP pages of each species].
- **Extinct species and _H. erectus_.** No behavioural data. Their values are **S**, taken from the living analogue named in the table.

### 14.4 The values

Format min / mode / max. **D**: derived from the cited preference range divided by the species' mass mode (SPECIES.md §11.1); **S**: author judgement.

| Species        | `threatRatio` (×) | Basis | `threatTime` (s) | `soloShock`     | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ----------------- | :---: | ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiger          | 1.4 / 2 / 10      |   D   | 5 / 15 / 60      | 0 / 0.04 / 0.08 | Min: preferred-prey top 250 kg ÷ 180 kg [Hayward 2012]; mode: favoured prey up to 2× [Owen-Smith & Mills 2008]; max: the order-of-magnitude prey range. Short time: avoids injurious fights (MODEL.md §3.8).                                                                                                                                                                                                                    |
| Lion           | 3.7 / 6.7 / 10    |   D   | 10 / 30 / 90     | – (social)      | Min: preferred top 550 kg ÷ 150 kg [Hayward & Kerley 2005]; mode: the ~1,000 kg megaherbivore line ÷ 150 kg [Owen-Smith & Mills 2008], so buffalo and giraffe stay within reach, elephants and rhinos do not.                                                                                                                                                                                                                   |
| Spotted hyena  | 1.9 / 3.3 / 10    |   D   | 5 / 20 / 60      | – (social)      | Mode: preferred top 182 kg ÷ 55 kg; min: preferred mode 102 kg ÷ 55 kg [Hayward 2006]. Buffalo (avoided) is above the mode. Leaves kills to lions readily [WP].                                                                                                                                                                                                                                                                 |
| Gray wolf      | 6 / 15 / 25       | **S** | 5 / 20 / 60      | – (social)      | Packs take bison, their most formidable prey, with 9–13 wolves [MacNulty 2014], and a pack of 15 can bring down an adult moose [WP]. The mode keeps the model's bison stand-in, a 600 kg buffalo (§8.2, 14× a 42 kg wolf), within reach; the prey masses were not checked, so it is S. A first draft's mode of 6 made the buffalo a threat and contradicted these hunts. Wolves limit injury risk by wounding and waiting [WP]. |
| _H. erectus_   | 1.5 / 2 / 4       | **S** | 5 / 20 / 60      | – (social)      | No data; the living-carnivore 2× rule as a stand-in.                                                                                                                                                                                                                                                                                                                                                                            |
| Raptor pack    | 2 / 3 / 4         | **S** | 10 / 30 / 90     | – (social)      | No data; between the solitary rule (2) and a lion pack's preferred top (3.7), as its pack-buff rows sit between none and the lion's (§5.15).                                                                                                                                                                                                                                                                                    |
| Brown bear     | 1.5 / 2 / 4       | **S** | 10 / 30 / 90     | 0 / 0.04 / 0.08 | The carnivore 2× rule; dominant over wolves at carcasses [WP: Wolf] and over polar bears [Miller 2015], so a longer time than the tiger.                                                                                                                                                                                                                                                                                        |
| Polar bear     | 1.5 / 2 / 3       | **S** | 5 / 10 / 30      | 0 / 0.04 / 0.08 | Avoids adult walruses [WP]; yields to grizzlies [Miller 2015], hence the shortest time of the bears.                                                                                                                                                                                                                                                                                                                            |
| _T. rex_       | 1.5 / 2 / 4       | **S** | 20 / 60 / 180    | 0 / 0.04 / 0.08 | No data; the carnivore 2× rule. Nothing in the roster is twice its mass, so it rarely acts.                                                                                                                                                                                                                                                                                                                                     |
| _Spinosaurus_  | 1 / 1.5 / 2       | **S** | 10 / 30 / 90     | 0 / 0.04 / 0.08 | No data; a fish specialist (§5.8), so a lower threshold than _T. rex_.                                                                                                                                                                                                                                                                                                                                                          |
| Elephant       | 1.2 / 1.5 / 3     | **S** | 20 / 60 / 180    | 0 / 0.04 / 0.08 | Dominant at waterholes [Valeix 2007] and mobs lions [WP]: gives way only to something clearly heavier; long time.                                                                                                                                                                                                                                                                                                               |
| Woolly mammoth | 1.2 / 1.5 / 3     | **S** | 20 / 60 / 180    | 0 / 0.04 / 0.08 | The elephant analogue (§5 mammoth rows).                                                                                                                                                                                                                                                                                                                                                                                        |
| Buffalo        | 1.2 / 1.5 / 3     | **S** | 15 / 45 / 120    | 0 / 0.04 / 0.08 | Drives off or kills lions [WP]; gives way to the dominant elephant [Valeix 2007].                                                                                                                                                                                                                                                                                                                                               |
| Hippopotamus   | 1.5 / 2 / 4       | **S** | 20 / 60 / 180    | 0 / 0.04 / 0.08 | Aggressive; adults rarely preyed upon [WP]: a higher threshold and a long time.                                                                                                                                                                                                                                                                                                                                                 |
| White rhino    | 1 / 1.25 / 2      | **S** | 5 / 20 / 60      | 0 / 0.04 / 0.08 | "Relatively unaggressive" [WP]; young bull elephants killed rhinos [WP]: a low threshold and a short time.                                                                                                                                                                                                                                                                                                                      |
| _Triceratops_  | 1.2 / 1.5 / 3     | **S** | 15 / 45 / 120    | 0 / 0.04 / 0.08 | No data; the horned-herbivore analogue (buffalo).                                                                                                                                                                                                                                                                                                                                                                               |

`soloShock` is one shared **S** row: no study measures it. Its mode is half the classic tiger's `pack.moraleLoss` mode (0.08), the "weak, unbuffed" shock of #169 option 3, and its range runs from none to the classic value.

### 14.5 Polar bear behaviour rows (model 2)

The polar bear shipped (#184) with the brown bear's behaviour rows, tagged **S**. Under the owner's rule that animal traits are researched and species-specific (#169, scope note 2026-11-02), model 2 replaces the rows the sources above speak to. Model 1 keeps the brown bear's rows, so its links reproduce.

| Free trait        | Model 1 (brown bear) | Model 2          | Basis | Rationale                                                                                                                                                                                       |
| ----------------- | -------------------- | ---------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sprintEndurance` | 20 / 45 / 120 s      | 10 / 25 / 60 s   | **S** | Running costs about twice the quadruped prediction and body temperature rises steeply with speed [Hurst 1982a, b]; hunts end in a short charge after a stalk [WP]. Shorter than the brown bear. |
| `recoveryTime`    | 45 / 90 / 180 s      | 60 / 120 / 300 s | **S** | The same heat load: slower recovery than the brown bear (the elephant's and _T. rex_'s row).                                                                                                    |
| `morale`          | 0.55 / 0.75 / 0.9    | 0.4 / 0.6 / 0.8  | **S** | Displaced by grizzlies more often than by conspecifics; grizzlies are socially dominant despite their smaller size [Miller 2015]. Below the brown bear, near the tiger (0.4 / 0.6 / 0.85).      |

Reviewed and kept (no polar-bear-specific evidence found, so the brown bear analogue stays, still **S**): `turnRate`, `strikeLethality`, `strikeInterval`, `strikeArc`, `strikeAccuracy`, `shakeRate`, `bleed`, `moraleLoss` and the constants `hide` 0.5 and `intimidation` 1. A thicker fat layer (5–10 cm [WP]) could argue for a lower `hide`, but no measurement relates it to damage taken, so it was not changed.

### 14.6 Sources not reached

- Slotow et al. 2000 (_Nature_ 408:425) and Power & Compion 2009 (_African Zoology_ 44:36): no abstract was available through Crossref, Europe PMC or Semantic Scholar; their findings are cited through Wikipedia.
- Seryodkin et al. 2018 (Amur tiger and bears, _Biology Bulletin_ 45:853): no abstract available; not used.
- Best 1982 (polar bear thermoregulation, _J. Comp. Physiol. B_ 146:63): no abstract available; not used.
- Wikipedia's Walrus, Elk and Tiger pages: the API rate-limited this session, so walrus and elk masses were not checked and no value rests on them.
- OpenAlex: its free daily budget was used up; Crossref, Europe PMC and Semantic Scholar served the abstracts.

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
