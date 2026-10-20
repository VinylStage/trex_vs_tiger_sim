# Species

> **한국어 요약**
>
> - 엔진은 두 역할로 여러 종을 다룹니다. **대형 동물**(`heavy.*`: 혼자 싸움, 선회 제한, 정면 공격 범위, 떨쳐내기, 매달린 무게로 감속)과 **무리 동물**(`pack.*`: 질주와 순항, 스태미나, 매달리기와 초당 피해, 사기와 도주)입니다. 파라미터는 22개 그대로이고 순서도 바뀌지 않았습니다.
> - 1차 카탈로그(8종): 대형 동물 = 티라노사우루스, 아프리카코끼리, 아프리카물소, 불곰 / 무리 동물 = 호랑이, 사자, 회색늑대, 점박이하이에나. 여기에 대형 동물 털매머드와, 양쪽 역할 모두에 멸종 인류 호모 에렉투스를 더했습니다(#47). 현생 인류와 가축은 다루지 않습니다.
> - 호모 에렉투스는 다른 동물과 같은 조건(옷 · 도구 · 무기 · 불 · 훈련 없음, 평균 성인의 신체 능력)으로 모델링한 사고 실험이며, 대결 배지 아래와 모델 · 파라미터 페이지에 실제 폭력을 묘사하거나 지지하지 않는다는 안내를 붙입니다. 체중만 화석 문헌 값(L)이고, 맨손 타격 힘은 현생 인류 측정에서 유도(D), 나머지는 추정(S)입니다.
> - 모든 기본값에 근거 수준(L 문헌, D 유도, S 추정, U 미검증)을 달았고, 시뮬레이터의 파라미터 표에도 표시합니다. 행동에 관한 값은 모든 종에서 추정입니다.
> - 종 상수 두 개: `hide`(무리에게 받는 피해 배율, 코끼리 0.3, 물소 · 불곰 0.5, 티라노사우루스 1)와 `radius`(무리 동물 몸 반경, 호랑이 · 사자 0.8 m, 하이에나 0.6 m, 늑대 0.5 m). 난수를 쓰지 않고, 티라노사우루스 · 호랑이에서는 정확히 항등이라 예전 공유 링크(v1)가 비트 단위로 같은 결과를 냅니다.
> - 야생에서 관찰된 대결(코끼리–사자, 물소–사자, 물소–하이에나, 불곰–늑대, 불곰–호랑이)에는 배지가 붙고, 티라노사우루스와의 대결은 “서로 만난 적 없는 종”으로 표시됩니다.

Source of truth: `src/sim/species.ts`. The parameter pages (`/parameters/#species`, `/en/parameters/#species`) repeat the presets and are checked against the registry by `tests/pages.test.ts`. The research behind this document, including the phase-2 and deferred species and the change plan, is in [research/SPECIES.md](research/SPECIES.md).

## Contents

1. [Roles and parameters](#1-roles-and-parameters)
2. [Catalog](#2-catalog)
3. [Evidence tags and formulas](#3-evidence-tags-and-formulas)
4. [Parameter tables](#4-parameter-tables)
5. [Documented match-ups](#5-documented-match-ups)
6. [Compatibility rules](#6-compatibility-rules)
7. [Calibration notes](#7-calibration-notes)
8. [What the engine cannot express](#8-what-the-engine-cannot-express)
9. [Content rules](#9-content-rules)
10. [References](#10-references)

## 1. Roles and parameters

| Role  | Ids (order fixed)                                                                                                                                               | Behaviour (MODEL.md §3)                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| heavy | `heavy.mass`, `.speed`, `.turnRate`, `.biteForce`, `.biteLethality`, `.biteInterval`, `.biteReach`, `.biteArc`, `.biteAccuracy`, `.shakeRate`, `.bodyRadius`    | One large animal: turn-limited, frontal attack cone, shake-off, slowed by latched weight |
| pack  | `pack.mass`, `.sprintSpeed`, `.cruiseSpeed`, `.sprintEndurance`, `.latchEndurance`, `.recoveryTime`, `.latchChance`, `.dps`, `.bleed`, `.morale`, `.moraleLoss` | Many attackers: sprint/cruise, stamina, latch with damage per second, bleeding, morale   |

The v1 ids were `trex.*` and `tiger.*` in the same order; share links with them are upgraded through an alias map (`upgradeV1` in `src/ui/share.ts`).

Each species carries, besides its eleven preset triangles:

- **bounds**: its own hard limits for sanitising and for the per-animal clamp. _T. rex_ and the tiger keep exactly the v1 bounds. The other species use the v1 bounds widened where needed: heavy mass 100–20,000 kg, heavy weapon force 0.1–150 kN, pack mass 5–1,000 kg. The heavy _Homo erectus_ alone widens further to human size: mass from 20 kg, reach (`biteReach`) from 0.3 m and `bodyRadius` from 0.1 m (`HEAVY_HOMININ_BOUNDS`).
- **era**: `extant` or a range in millions of years; the matchup badge reads it.
- **weapon** (heavies): what `biteForce` stands for. `bite` (_T. rex_), `tusk` (tusks, trunk and trampling), `horn`, `pawBite`, `hands` (bare-hand strikes and grip, _H. erectus_). Only the labels change; the formula is the same.
- **flags**: `adSafe` (whether ads may load on a matchup with this species; read through `matchupAdSafe`, [ADSENSE.md §6](ADSENSE.md#6-per-matchup-ad-safety)) and `hominin` (adds the thought-experiment note, §9).
- **constants**, not sampled and not in the URL: `hide` and `intimidation` (heavies) and `radius` (packs), §7. `intimidation` multiplies the morale a pack animal loses when the heavy hits it or throws it off, and the minimum recovery time after a hit (not after a throw); it is exactly 1 for every species that shipped before #47 and for the mammoth.

## 2. Catalog

| Species                | Id            | Role  | Era          | Weapon / radius | `hide` | Why                                            | Data quality                               |
| ---------------------- | ------------- | ----- | ------------ | --------------- | -----: | ---------------------------------------------- | ------------------------------------------ |
| _Tyrannosaurus rex_    | `trex`        | heavy | 68–66 Ma     | bite            |      1 | Default, the brand                             | Good for mass, speed, bite                 |
| African bush elephant  | `elephant`    | heavy | extant       | tusk/trample    |    0.3 | Documented lion-pride predation (Savuti)       | Good mass and speed; weapon **S**          |
| African buffalo        | `buffalo`     | heavy | extant       | horn            |    0.5 | Classic lion prey; buffalo also kill lions     | Good mass; speed **U**                     |
| Brown bear             | `brownBear`   | heavy | extant       | bite/paw        |    0.5 | Documented vs wolves and vs Amur tigers        | Good mass and speed; bite **D**            |
| Tiger                  | `tiger`       | pack  | extant       | radius 0.8 m    |      — | Default                                        | As MODEL.md                                |
| Lion                   | `lion`        | pack  | extant       | radius 0.8 m    |      — | The best-documented group hunter of large prey | Good mass, speed, bite                     |
| Gray wolf              | `wolf`        | pack  | extant       | radius 0.5 m    |      — | Best group-size success data [MacNulty 2014]   | Good mass; speed **U**                     |
| Spotted hyena          | `hyena`       | pack  | extant       | radius 0.6 m    |      — | Large clans, measured bite, long chases        | Good                                       |
| Woolly mammoth         | `mammoth`     | heavy | 0.4–0.004 Ma | tusk/trample    |   0.25 | Ice-age megaherbivore with frozen-carcass data | Good mass; speed and weapon **D/S**        |
| _Homo erectus_ (heavy) | `homoErectus` | heavy | 1.9–0.11 Ma  | bare hands      |      1 | Owner request (#47): a hominin on both sides   | Mass **L**; strike force **D**; rest **S** |
| _Homo erectus_ (pack)  | `homoErectus` | pack  | 1.9–0.11 Ma  | radius 0.3 m    |      — | Many hominins vs one heavy                     | Mass **L**; rest **S**                     |

**Phase 2** (no new mechanics needed, weaker data): Giganotosaurus, Allosaurus, polar bear, Deinonychus (with Velociraptor and Utahraptor variants), African wild dog. **Deferred** until new mechanics exist (§8): Nile crocodile, Spinosaurus, Komodo dragon. Their research tables are in [research/SPECIES.md](research/SPECIES.md) §5.

The UI offers these matchup presets: 10 _T. rex_ vs 100 tigers (default), 1 vs 10 tigers, 5 elephants vs 30 lions, 1 buffalo vs 6 lions, 1 buffalo vs 15 hyenas, 1 brown bear vs 8 wolves, 1 brown bear vs 1 tiger, 1 woolly mammoth vs 12 wolves, 1 _T. rex_ vs 100 _Homo erectus_ (`PRESETS` in `src/ui/form.ts`).

The heavy and the pack _Homo erectus_ share the id `homoErectus` (one id per role registry, like every species) and the same body-mass preset.

## 3. Evidence tags and formulas

### 3.1 Evidence tags and source access

| Tag   | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| **L** | Literature value, used directly or bracketing a reported range. |
| **D** | Derived from literature with a stated formula (§3.2).           |
| **S** | Speculative: author judgement, deliberately wide.               |
| **U** | Unverified popular figure (no peer-reviewed source found).      |

Source access levels in §10: **[FT]** full text read; **[Abs]** abstract or search summary only; **[WP]** taken from Wikipedia, which cites the primary source; **[MODEL]** already cited in `docs/MODEL.md`. Values marked [Abs] or [WP] should be re-checked against the primary source before they are presented as fact in the UI.

### 3.2 Shared calibration formulas

1. **HP = mass in kg** for both roles (unchanged).
2. **Heavy damage per hit** = weapon force (kN) × lethality (HP/kN) × U(0.7, 1.3) (unchanged). For non-biting weapons (tusks, horns, paws) `biteForce` is only relabelled; the formula stays.
3. **Pack bite force when no measurement exists:** F ≈ 1.35 kN × (BFQ / 139) × (m / 200 kg)^0.57. It is anchored on the tiger (1.2–1.5 kN in MODEL.md, BFQ 139). BFQ values come from the table in [WP: Bite force quotient] (Wroe 2005; Christiansen & Wroe 2007). The 0.57 exponent is the mass exponent of Hite et al.'s BFQ regression, quoted on the same page. Checks: hyena 0.61 kN vs 0.57 kN estimated; wild dog at 18.9 kg 0.35 kN vs 0.43 kN tabulated; lion 1.06–1.21 kN vs 1.59 kN measured in a lioness. Expect about ±30 % error; the formula underestimates lions.
4. **Pack dps from bite force** (F in kN): dps ≈ (2·F_min, 4.4·F_mode, 8·F_max). This reproduces the tiger default 2/6/12 HP/s from 1.2/1.35/1.5 kN. It encodes MODEL.md §5.3: 4–12 HP/kN per bite, one bite or claw strike every 1–2 s, upper tail trimmed.
5. **Heavy turn rate from agility:** ω ≈ ω_T. rex × √(A / A_T. rex), with A the τ/I agility index of [Snively 2019] Table 3 (body + swing leg). Because θ = ½αt², the time to turn a fixed angle scales as 1/√α.
6. **Geometry** (`bodyRadius`, `biteReach`, `packRadius`) is always **S**: half the torso length, plus neck, head, trunk or horns for reach.

## 4. Parameter tables

Ids use the role names (`heavy.*`, `pack.*`). The **Basis** column is the evidence tag the parameter table shows. Hard bounds: §1.

### 4.1 _Tyrannosaurus rex_ (heavy, default)

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

### 4.2 African bush elephant (heavy)

- **Evidence.** Bulls average 6.0 t (90 % within 5.2–6.9 t); cows 3.0 t (2.6–3.5 t) [Larramendi 2016, WP]. 6.8 m/s is the fastest reliable elephant speed, recorded in Asian elephants [Hutchinson 2003; 2006]. Mean tusk mass at 60 years: 109 kg in bulls, 17.7 kg in cows [WP].
- **Interactions.** Adults are "considered invulnerable to predation" and mob lions [WP]. At Savuti (Chobe), lions killed 74 elephants in 1993–96, 26 of them older than nine and one bull over 15 [Joubert 2006, via WP]. A 30-lion pride killed about one elephant every three days in the late dry season; 7 of 8 victims were 4–11 years old [Power & Compion 2009].
- **Weapon.** No measured force exists for tusks, trunk blows or trampling. `biteForce` is relabelled "tusk/trample force" and anchored on body weight (3.2 t × g ≈ 31 kN). It is **S**.
- **Engine cannot express:** trampling a downed attacker, trunk grab-and-throw (approximated by `shakeRate`), herd bunching around calves, mock charges that scare attackers without contact, and thick skin (→ `hide`, §7).

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

### 4.3 African (Cape) buffalo (heavy)

- **Evidence.** Males 650–900 kg, females up to 500 kg, skin thicker than 2–3 cm [WP]. No peer-reviewed top speed was found; the common 56 km/h figure is **U**.
- **Interactions.** Lions are the main predator. A pride isolates one animal, attacks the rear and suffocates it with a bite to the nose; in other cases the buffalo drives off or kills lions, and large herds protect against lions in open areas [WP]. Male lions mainly capture buffalo [Funston 2001].
- **Bison proxy.** Wolves hunting bison are the best quantitative group-size data set [MacNulty 2014]. American bison is not in this roster, so a buffalo preset (similar mass) serves as a stand-in for calibration (§7).
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

### 4.4 Brown bear (heavy)

- **Evidence.** Mean adult male 217 kg across 19 populations, female 152 kg; coastal bears are about twice as heavy [WP]. 48 km/h is the highest reliably recorded speed in Yellowstone [WP: Grizzly bear, citing Kearns 1937]. Claws 5–6 cm [WP]. Bears fight by striking with the paws and biting the head or neck [WP].
- **Interactions.** Brown bears regularly take wolf kills, and most carcass conflicts end without bloodshed [WP]. The first recorded grizzly kill of an adult wolf in the western US was published in 2008 [Jimenez 2008]. In the Russian Far East, Amur tigers attacked brown and black bears in 32 recorded cases (1944–59); bears killed female tigers or cubs in 4 [WP].
- **Engine cannot express:** 360° paw strikes at close range (the frontal cone is too narrow for a bear surrounded by wolves), sitting back against cover, and a fat/fur layer that reduces wolf damage (→ `hide`, §7).

| Parameter             | Unit  | min | mode |  max | Basis | Source / rationale                                                                                             |
| --------------------- | ----- | --: | ---: | ---: | :---: | -------------------------------------------------------------------------------------------------------------- |
| `heavy.mass`          | kg    | 130 |  220 |  450 |   L   | Mean adult male 217 kg over 19 populations, female 152 kg; coastal bears about twice as heavy (via Wikipedia). |
| `heavy.speed`         | m/s   |   8 |   11 | 13.3 |   L   | 48 km/h (13.3 m/s) the highest reliably recorded in Yellowstone (Kearns 1937, via Wikipedia).                  |
| `heavy.turnRate`      | deg/s |  60 |  120 |  200 | **S** | Agile quadruped; no data.                                                                                      |
| `heavy.biteForce`     | kN    | 0.6 |  1.2 |    3 |   D   | Bite ≈ 0.8–1.1 kN derived from BFQ 78 (formula in §3.2). Max widened for paw strikes (unmeasured).             |
| `heavy.biteLethality` | HP/kN |   4 |    8 |   12 | **S** | Shared mapping.                                                                                                |
| `heavy.biteInterval`  | s     | 0.8 |  1.5 |    3 | **S** | Alternating swipes and bites.                                                                                  |
| `heavy.biteReach`     | m     | 1.2 |  1.5 |  1.9 | **S** | Geometry: radius + head/forelimb.                                                                              |
| `heavy.biteArc`       | deg   |  45 |   70 |  100 | **S** | Forelimb swipes widen the frontal arc.                                                                         |
| `heavy.biteAccuracy`  | p     | 0.3 | 0.45 | 0.65 | **S** | —                                                                                                              |
| `heavy.shakeRate`     | 1/s   | 0.1 | 0.25 |  0.5 | **S** | Can roll and swat.                                                                                             |
| `heavy.bodyRadius`    | m     | 0.6 | 0.75 |  0.9 | **S** | Geometry.                                                                                                      |

### 4.5 Tiger (pack, default)

Unchanged from MODEL.md §5.2. One additional documented interaction is worth a matchup preset: Amur tigers vs brown bears (§4.4). Tigers are also documented against dhole packs, with the outcome depending on pack size [WP: Tiger]. That would need a heavy tiger preset (open question).

| Parameter              | Unit |  min |  mode |   max | Basis | Source / rationale                                                        |
| ---------------------- | ---- | ---: | ----: | ----: | :---: | ------------------------------------------------------------------------- |
| `pack.mass`            | kg   |  100 |   180 |   260 |   L   | Current default (MODEL.md §5.2).                                          |
| `pack.sprintSpeed`     | m/s  |   11 |    14 |    18 | **S** | Current default.                                                          |
| `pack.cruiseSpeed`     | m/s  |    4 |     6 |     8 | **S** | Current default.                                                          |
| `pack.sprintEndurance` | s    |   10 |    20 |    40 | **S** | Current default.                                                          |
| `pack.latchEndurance`  | s    |   15 |    30 |    60 | **S** | Current default.                                                          |
| `pack.recoveryTime`    | s    |   30 |    60 |   120 | **S** | Current default.                                                          |
| `pack.latchChance`     | p    | 0.15 |  0.35 |   0.6 | **S** | Current default.                                                          |
| `pack.dps`             | HP/s |    2 |     6 |    12 |   D   | Current default: bite 1.2–1.5 kN × 4–12 HP/kN per 1–2 s.                  |
| `pack.bleed`           | 1/s  |    0 | 0.002 | 0.005 | **S** | Current default.                                                          |
| `pack.morale`          | 0–1  |  0.4 |   0.6 |  0.85 | **S** | Current default.                                                          |
| `pack.moraleLoss`      | 0–1  | 0.03 |  0.08 |  0.15 | **S** | Current default.                                                          |
| _constant_ `radius`    | m    |      |   0.8 |       | **S** | Body contact radius (the former engine constant `tigerRadius` was 0.8 m). |

### 4.6 Lion (pack)

- **Evidence.** Females 110–144 kg, males 160–225 kg (Southern Africa) [WP, Smuts 1980]. Top speed 74.1 km/h recorded [WP, Wilson 2018]; lions normally run only in short bursts at 48–59 km/h [WP]. A lioness bite measured 1,594 N at the canines [WP, van der Meijden 2023]; the Wroe 2005 estimate of 1,768 N is quoted by secondary sources **[U]**.
- **Cooperation.** Prides average about 15, and up to 30 have been observed [WP]. In coordinated hunts, "wing" lionesses circle and start the attack while "centres" wait for prey fleeing toward them, and each lioness repeats her position [Stander 1992]. A companion Etosha study by the same author ("Foraging dynamics of lions in a semi-arid environment", 1992) reports capture success rising with group size (abstract via search; citation details **[U]**).
- **Engine cannot express:** position-specific latch effects (a nose hold on a buffalo is lethal, a rump hold is not), and role assignment (wing vs centre), which `flank` only approximates.

| Parameter              | Unit |  min |  mode |   max | Basis | Source / rationale                                                                                                  |
| ---------------------- | ---- | ---: | ----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`            | kg   |  110 |   150 |   225 |   L   | Females 110–144 kg, males 160–225 kg (Smuts 1980, via Wikipedia). Mode for a mixed hunting pride.                   |
| `pack.sprintSpeed`     | m/s  |   11 |    14 |  20.6 |   L   | Short bursts at 48–59 km/h; 74.1 km/h (20.6 m/s) recorded by Wilson 2018 (via Wikipedia).                           |
| `pack.cruiseSpeed`     | m/s  |    3 |     5 |     7 | **S** | —                                                                                                                   |
| `pack.sprintEndurance` | s    |    8 |    15 |    30 | **S** | Lions run fast only in short bursts; heart ~0.45–0.57 % of body mass (via Wikipedia).                               |
| `pack.latchEndurance`  | s    |   20 |    45 |   120 | **S** | Can hold an ungulate throat up to 13 min (via Wikipedia), but riding a large, moving animal is shorter.             |
| `pack.recoveryTime`    | s    |   40 |    90 |   180 | **S** | —                                                                                                                   |
| `pack.latchChance`     | p    |  0.2 |   0.4 |  0.65 | **S** | Coordinated pride roles ("wings" and "centres", Stander 1992). Success rises with group size (Stander 1992 Etosha). |
| `pack.dps`             | HP/s |  2.5 |     7 |    14 |   D   | Bite 1.2–1.8 kN: lioness measured 1,594 N (van der Meijden 2023); Wroe 2005 estimate 1,768 N. Formula in §3.3.      |
| `pack.bleed`           | 1/s  |    0 | 0.002 | 0.005 | **S** | As tiger.                                                                                                           |
| `pack.morale`          | 0–1  | 0.45 |  0.65 |   0.9 | **S** | Social hunters; prides persist against elephants (Power & Compion 2009) but adults are usually avoided.             |
| `pack.moraleLoss`      | 0–1  | 0.02 |  0.06 |  0.12 | **S** | —                                                                                                                   |
| _constant_ `radius`    | m    |      |   0.8 |       | **S** | Body contact radius (the former engine constant `tigerRadius` was 0.8 m).                                           |

### 4.7 Gray wolf (pack)

- **Evidence.** Mean body mass 40 kg, range 12–79 kg [WP]. No peer-reviewed sprint speed was found; 56–65 km/h is **U**. Packs average 8 in North America and 5.5 in Europe, with up to 42 recorded [WP].
- **Cooperation.** Against bison, capture success rises with group size and levels off at 9–13 wolves; solo capture success is 0.01 on bison vs 0.14 on elk [MacNulty 2014]. The paper's ethogram (approach → attack-group → attack-individual → capture, "biting and restraining") maps closely onto the engine's Approach → Latched states [MacNulty 2014, Table 1].
- **Engine cannot express:** coursing a fleeing heavy (heavies never flee), and ganging up on one target in the "attack-individual" phase. `flank` spreads attackers instead.

| Parameter              | Unit |   min |  mode |   max | Basis | Source / rationale                                                                                                               |
| ---------------------- | ---- | ----: | ----: | ----: | :---: | -------------------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`            | kg   |    30 |    42 |    60 |   L   | Mean 40 kg; > 54 kg uncommon; record 79 kg (via Wikipedia).                                                                      |
| `pack.sprintSpeed`     | m/s  |    12 |    15 |    18 | **U** | Popular 56–65 km/h; no peer-reviewed measurement found.                                                                          |
| `pack.cruiseSpeed`     | m/s  |   2.5 |     4 |     6 | **U** | Trot ~10 km/h (popular); lope faster.                                                                                            |
| `pack.sprintEndurance` | s    |    20 |    40 |    90 | **S** | Moose chases in a Scandinavian snow-tracking study were short (SLU, 1997–2003; units unverified); wolves are endurance trotters. |
| `pack.latchEndurance`  | s    |    10 |    25 |    60 | **S** | Wolves bite and hang on hindquarters or nose ("capture: biting and restraining", MacNulty 2014).                                 |
| `pack.recoveryTime`    | s    |    30 |    60 |   120 | **S** | —                                                                                                                                |
| `pack.latchChance`     | p    |   0.1 |  0.25 |  0.45 | **S** | Calibration only: solo capture success 0.01 on bison vs 0.14 on elk (MacNulty 2014).                                             |
| `pack.dps`             | HP/s |   0.8 |   2.5 |     6 |   D   | Bite ≈ 0.4–0.75 kN derived from BFQ 136 (formula in §3.2).                                                                       |
| `pack.bleed`           | 1/s  | 0.001 | 0.003 | 0.006 | **S** | Wolves may wound large prey and rest before killing it (via Wikipedia).                                                          |
| `pack.morale`          | 0–1  |  0.35 |  0.55 |   0.8 | **S** | Bear–wolf carcass conflicts mostly end without bloodshed (via Wikipedia).                                                        |
| `pack.moraleLoss`      | 0–1  |  0.03 |  0.08 |  0.15 | **S** | —                                                                                                                                |
| _constant_ `radius`    | m    |       |   0.5 |       | **S** | Body contact radius (the former engine constant `tigerRadius` was 0.8 m).                                                        |

### 4.8 Spotted hyena (pack)

- **Evidence.** 40–64 kg in the Serengeti, ~68 kg in Zambia [WP]. Chases of several kilometres at up to 60 km/h; heart ~1 % of body mass [WP]. Estimated 566 N canine and 986 N carnassial bite for a 63 kg animal [WP, Christiansen & Wroe 2007]. 4,500 N is the highest bite force recorded in a carnivoran [Erickson 2012], from a captive-hyena study (Binder & Van Valkenburgh 2000, via WP).
- **Cooperation.** Clans of up to 80. Hyenas hunt alone, in parties of 2–5 or in large groups [WP]. They usually prevail against lionesses without males when they outnumber them 4 : 1 [WP].
- **Engine cannot express:** morale that depends on the local numbers ratio (§8, M11).

| Parameter              | Unit |   min |  mode |   max | Basis | Source / rationale                                                                                                                                                               |
| ---------------------- | ---- | ----: | ----: | ----: | :---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack.mass`            | kg   |    40 |    55 |    70 |   L   | Serengeti males 40.5–55 kg, females 44.5–63.9 kg; Zambia ~68 kg (via Wikipedia).                                                                                                 |
| `pack.sprintSpeed`     | m/s  |    11 |    14 |  16.7 |   L   | Chases at up to 60 km/h (Kruuk 1972, via Wikipedia).                                                                                                                             |
| `pack.cruiseSpeed`     | m/s  |     3 |   4.5 |     6 | **S** | —                                                                                                                                                                                |
| `pack.sprintEndurance` | s    |    30 |    60 |   150 | **S** | Chases of several km; heart ~1 % of body mass (via Wikipedia).                                                                                                                   |
| `pack.latchEndurance`  | s    |    15 |    30 |    60 | **S** | —                                                                                                                                                                                |
| `pack.recoveryTime`    | s    |    30 |    60 |   120 | **S** | —                                                                                                                                                                                |
| `pack.latchChance`     | p    |  0.15 |   0.3 |   0.5 | **S** | Calibration only: wildebeest calves 15 % solo vs 74 % in groups (Kruuk 1972, secondary); ~1/3 of attempts succeed in Masai Mara (Holekamp 1997, secondary).                      |
| `pack.dps`             | HP/s |   1.2 |     4 |    12 |   D   | Estimated 566 N canine / 986 N carnassial for 63 kg (Christiansen & Wroe 2007, via Wikipedia); 4,500 N measured maximum (Binder & Van Valkenburgh 2000, cited by Erickson 2012). |
| `pack.bleed`           | 1/s  | 0.001 | 0.003 | 0.008 | **S** | Feeds on live prey.                                                                                                                                                              |
| `pack.morale`          | 0–1  |  0.35 |  0.55 |   0.8 | **S** | Prevails against lionesses at ≥ 4:1 (via Wikipedia): numbers-dependent courage the engine cannot express.                                                                        |
| `pack.moraleLoss`      | 0–1  |  0.03 |  0.08 |  0.15 | **S** | —                                                                                                                                                                                |
| _constant_ `radius`    | m    |       |   0.6 |       | **S** | Body contact radius (the former engine constant `tigerRadius` was 0.8 m).                                                                                                        |

### 4.9 Woolly mammoth (heavy)

- **Evidence.** Roughly the size of the African bush elephant. Average males 2.8–3.15 m at the shoulder and 4.5–6 t, females 2.3–2.6 m and 2.8–4 t; the largest males about 3.5 m and 8.2 t [Larramendi 2016, via WP: Woolly mammoth]. Skin no thicker than an elephant's (about 1.25–2.5 cm), a fat layer up to 10 cm, guard hairs 30 cm on the back and up to 90 cm on the flanks [WP]. The species arose from _M. trogontherii_ in Siberia about 400 ka; mainland populations lasted to about 10 ka, Wrangel Island to about 4 ka [WP].
- **Weapon.** Long, strongly curved tusks, "unsuitable for stabbing but may have been used for hitting", as injuries to fossil shoulder blades suggest [WP]. As for the elephant, `biteForce` is relabelled "tusk/trample force" and anchored on body weight (4.5 t × g ≈ 44 kN); it is **S**.
- **Interactions.** "Adult woolly mammoths could effectively defend themselves from predators with their tusks, trunks, and size; however, juveniles and weakened adults were vulnerable to pack hunters such as wolves, cave hyenas, and large felines" [WP]. No record of a pack taking an adult exists, so pairings with wolves and hyenas are "no recorded encounters" (§5), not documented.
- **Engine cannot express:** the same gaps as the elephant (trampling, trunk throws, herd defence of calves), plus snow and cold.

| Parameter             | Unit  |   min |  mode |   max | Basis | Source / rationale                                                                                                       |
| --------------------- | ----- | ----: | ----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------------------ |
| `heavy.mass`          | kg    | 2,800 | 4,500 | 6,000 |   L   | Females 2.8–4 t, average males 4.5–6 t (Larramendi 2016, via Wikipedia). Mode for a mixed adult.                         |
| `heavy.speed`         | m/s   |     3 |   4.5 |   6.8 |   D   | No measurement. Elephant analogue (same mass class and limb design): the elephant row, Hutchinson 2003/2006.             |
| `heavy.turnRate`      | deg/s |    30 |    50 |    90 | **S** | As the elephant.                                                                                                         |
| `heavy.biteForce`     | kN    |    10 |    25 |    50 | **S** | Re-labelled "tusk/trample force". Body weight at 4.5 t ≈ 44 kN. No measurement.                                          |
| `heavy.biteLethality` | HP/kN |     2 |     5 |     9 | **S** | Blunt trauma, as the elephant.                                                                                           |
| `heavy.biteInterval`  | s     |     2 |     4 |     8 | **S** | —                                                                                                                        |
| `heavy.biteReach`     | m     |   2.8 |   3.5 |   4.5 | **S** | Geometry: body radius + curved tusks and trunk.                                                                          |
| `heavy.biteArc`       | deg   |    40 |    60 |    90 | **S** | Tusk sweeps and head swings.                                                                                             |
| `heavy.biteAccuracy`  | p     |  0.15 |   0.3 |   0.5 | **S** | —                                                                                                                        |
| `heavy.shakeRate`     | 1/s   |  0.08 |   0.2 |   0.4 | **S** | Trunk, as the elephant.                                                                                                  |
| `heavy.bodyRadius`    | m     |   1.3 |   1.6 |   1.9 | **S** | Geometry: shoulder height 2.3–3.15 m, a little lower than the elephant.                                                  |
| _constant_ `hide`     | ×     |       |  0.25 |       | **S** | Elephant skin plus a fat layer up to 10 cm and guard hair up to 90 cm: a little more protection than the elephant's 0.3. |

### 4.10 _Homo erectus_ (heavy and pack)

**Framing.** _Homo erectus_ is an extinct human species of about 1.9 Ma to 117–108 ka (last appearance at Ngandong, Java) [Rizal 2020]. It is modelled on exactly the same footing as every animal: **unclothed, no tools, no weapons, no fire, no trained fighting skill**, only the physical capability of an average healthy adult. This is a thought experiment on physical capability; it does not depict or endorse real violence, and the badge, the model page and the parameter pages say so. Living humans are not modelled (§9).

- **Evidence.** Reconstructed adult height 141–167 cm, and "about 50 kg may have been normal" [WP: Homo erectus]. The Nariokotome boy (KNM-WT 15000) weighed 51–54 kg at death; adult projections are 160–178 cm and 60–83 kg [Cunningham 2018, via WP: Turkana Boy]. Dmanisi individuals are at the small end [Garvin 2017, Abs]. Grabowski et al. found that earlier estimates were inflated by large modern reference samples, while confirming that _H. erectus_ was larger than earlier hominins [Grabowski 2015, Abs]. Endurance-running traits appear with early _Homo_ about 2 Ma [Bramble & Lieberman 2004, Abs]; some _H. erectus_ torsos may suit power running more than modern humans [WP, citing Bastir 2020].
- **Modern-human analogues.** No performance can be measured on a fossil, so running, striking and stamina borrow modern-human figures. Maximal straight punches of novice boxers: 1.6 kN lead hand, 2.4 kN rear hand; intermediate 2.3/3.7 kN, elite 2.8/4.8 kN [Smith 2000, Abs]. Untrained adults strike below novice boxers. Molar bite force of young adults: 597–909 N by sex and study [Abs: PubMed 8322012 (1993); Acta Odontol. Scand. (1995)]; the bite is not the weapon here.
- **Mapping bare hands onto the heavy weapon (D/S).** A heavy hit deals `biteForce × biteLethality × U(0.7, 1.3)` HP. With strike force 0.8–2.4 kN (**D**: novice-boxer peaks as the ceiling, untrained adults below) and a blunt, toothless lethality of 0.2–1 HP/kN (**S**, below the elephant's blunt 2–9), a hit costs a 42 kg wolf about 0.75 HP of 42 at the mode. The engine sends every hit attacker into `Recover` and takes a fixed 0.25 of its morale (0.1 for a throw, MODEL.md §3.8), independent of damage. Calibrated for bites, tusks and horns, this let a bare-handed hominin rout a lone tiger in 98 % of runs. `intimidation` = 0.02 (**S**) scales those morale losses and the 5 s minimum recovery after a hit (not after a throw) for _H. erectus_ only: a blow that costs a predator a few HP is not a deterrent like a bite (§7).
- **Mapping bare hands onto pack damage (S).** `pack.dps` 0.2–2 HP/s: about one strike or grip action per second × 0.8–2.4 kN × 0.3–1 HP/kN, trimmed. The tiger's formula (§3.2 item 4) is for bites and does not apply.
- **Engine cannot express:** throwing, climbing, cooperative planning, and anything that needs tools or fire (all excluded by the framing anyway); heat dissipation by sweating, which is what makes humans endurance runners, appears only as fast recovery.

| Parameter                 | Unit  |  min | mode |  max | Basis | Source / rationale                                                                                                                                                                         |
| ------------------------- | ----- | ---: | ---: | ---: | :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heavy.mass`              | kg    |   40 |   52 |   68 |   L   | About 50 kg typical; KNM-WT 15000 51–54 kg at death, adult 60–83 kg projected; Dmanisi smaller (via Wikipedia).                                                                            |
| `heavy.speed`             | m/s   |    5 |  6.5 |  8.5 | **S** | Modern-human analogue for an untrained adult running speed held over a fight; elite sprinters peak near 10–12 m/s.                                                                         |
| `heavy.turnRate`          | deg/s |  120 |  200 |  300 | **S** | A biped pivots in well under a second.                                                                                                                                                     |
| `heavy.biteForce`         | kN    |  0.8 |  1.5 |  2.4 |   D   | Re-labelled "bare-hand strike and grip force". Novice boxers 1.6 kN lead / 2.4 kN rear hand (Smith 2000) as ceiling.                                                                       |
| `heavy.biteLethality`     | HP/kN |  0.2 |  0.5 |    1 | **S** | Blunt, untrained strikes without claws or teeth: about 0.75 HP per hit on a 42 kg wolf at the mode.                                                                                        |
| `heavy.biteInterval`      | s     |  0.6 |    1 |    2 | **S** | Roughly one committed strike per second.                                                                                                                                                   |
| `heavy.biteReach`         | m     |  0.7 | 0.85 |    1 | **S** | Geometry: arm length from a 141–167 cm body.                                                                                                                                               |
| `heavy.biteArc`           | deg   |   50 |   70 |  100 | **S** | Two arms cover a wide frontal arc.                                                                                                                                                         |
| `heavy.biteAccuracy`      | p     | 0.15 | 0.25 |  0.4 | **S** | Untrained strikes at a moving, low-built animal.                                                                                                                                           |
| `heavy.shakeRate`         | 1/s   | 0.03 | 0.08 | 0.15 | **S** | Prying off a latched carnivore by hand is slow; well below the bears and the elephant.                                                                                                     |
| `heavy.bodyRadius`        | m     |  0.2 | 0.25 |  0.3 | **S** | Geometry: half the shoulder width.                                                                                                                                                         |
| _constant_ `hide`         | ×     |      |    1 |      | **S** | Bare skin, no fur or thick hide: no reduction (the identity, like _T. rex_).                                                                                                               |
| _constant_ `intimidation` | ×     |      | 0.02 |      | **S** | Morale and recovery effect of a bare-hand hit relative to a bite or tusk blow (1 for every other heavy). Chosen so a lone hominin loses most fights against one tiger, lion or hyena (§7). |

| Parameter              | Unit |  min |   mode |   max | Basis | Source / rationale                                                                                            |
| ---------------------- | ---- | ---: | -----: | ----: | :---: | ------------------------------------------------------------------------------------------------------------- |
| `pack.mass`            | kg   |   40 |     52 |    68 |   L   | As the heavy row.                                                                                             |
| `pack.sprintSpeed`     | m/s  |    6 |    7.5 |     9 | **S** | Modern-human analogue: untrained adults far below the ~10 m/s of the fastest sprinters (Bramble & Lieberman). |
| `pack.cruiseSpeed`     | m/s  |  2.3 |      3 |     4 | **S** | Comfortable distance-running speeds; humans are endurance runners (Bramble & Lieberman 2004).                 |
| `pack.sprintEndurance` | s    |   20 |     40 |    90 | **S** | Near-maximal running fades within about a minute.                                                             |
| `pack.latchEndurance`  | s    |   15 |     30 |    60 | **S** | Holding on to a moving animal by grip alone.                                                                  |
| `pack.recoveryTime`    | s    |   20 |     40 |    90 | **S** | Faster than the carnivores (30–180 s): sweating and endurance physiology. The model's only "endurance" lever. |
| `pack.latchChance`     | p    |  0.1 |    0.2 |  0.35 | **S** | No claws or bite hold; lower than every carnivore.                                                            |
| `pack.dps`             | HP/s |  0.2 |    0.8 |     2 | **S** | Bare-hand mapping above.                                                                                      |
| `pack.bleed`           | 1/s  |    0 | 0.0005 | 0.002 | **S** | Blunt strikes rarely open wounds.                                                                             |
| `pack.morale`          | 0–1  |  0.3 |    0.5 |  0.75 | **S** | No predator-like attack drive towards a large animal.                                                         |
| `pack.moraleLoss`      | 0–1  | 0.04 |    0.1 |  0.18 | **S** | —                                                                                                             |
| _constant_ `radius`    | m    |      |    0.3 |       | **S** | Body contact radius: half the shoulder width plus clearance.                                                  |

## 5. Documented match-ups

The matchup badge marks a pairing **documented** when field observations exist (`DOCUMENTED_MATCHUPS` in `src/sim/species.ts`), **never met** when the species' eras do not overlap (every _T. rex_ pairing), and **no recorded encounters** otherwise. Extant species carry no first-appearance date, so an extinct species against a living one counts as "never met" unless it is listed in `COEXISTING_MATCHUPS` (below). The badge links to the matching section of the model page (`/model/#matchup-<anchor>`). Documented match-ups are still heavily simplified.

### Elephants and lions

Adults are "considered invulnerable to predation" and mob lions [WP: African bush elephant]. At Savuti (Chobe), lions killed 74 elephants in 1993–96, 26 of them older than nine [Joubert 2006, via WP]. A 30-lion pride killed about one elephant every three days in the late dry season; 7 of 8 victims were 4–11 years old [Power & Compion 2009].

### Buffalo and lions

Lions are the buffalo's main predator. A pride isolates one animal, attacks the rear and suffocates it with a bite to the nose; in other cases the buffalo drives off or kills lions, and large herds protect against lions in open areas [WP: African buffalo]. Male lions mainly capture buffalo [Funston 2001].

### Buffalo and hyenas

Spotted hyenas occasionally take adult buffalo bulls [WP: Spotted hyena]. Rare in the field; the model favours the hyenas far more (§7).

### Brown bears and wolves

Brown bears regularly take wolf kills, and most carcass conflicts end without bloodshed [WP: Brown bear]. The first recorded grizzly kill of an adult wolf in the western US was published in 2008 [Jimenez 2008].

### Brown bears and tigers

In the Russian Far East, Amur tigers attacked brown and black bears in 32 recorded cases (1944–59); bears killed female tigers or cubs in 4 [WP: Brown bear]. Field records mainly concern subadult or denning bears.

### Extinct species that shared a time and place with living ones

These pairings are labelled **no recorded encounters**: the fossil records overlap, but no encounter of the modelled kind is recorded (`COEXISTING_MATCHUPS`).

| Pairing                                         | Overlap                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| _H. erectus_ (heavy) and spotted hyenas         | _Crocuta crocuta_ in southern Africa from about 2.1 Ma, common 2.0–1.5 Ma [Reynolds 2010, via WP: Spotted hyena]         |
| _H. erectus_ (heavy) and tigers                 | Tiger fossils in the Ngandong fauna with the last _H. erectus_ [WP: Panthera tigris soloensis; Rizal 2020]               |
| African bush elephants and _H. erectus_ (pack)  | Earliest possible _Loxodonta africana_ at Omo, 2.44–2.27 Ma [Sanders 2023, via WP: African bush elephant]                |
| Woolly mammoths and gray wolves                 | _Canis lupus_ from about 406 ka [Iurino 2022, via WP: Wolf]; wolves took juvenile and weak mammoths [WP: Woolly mammoth] |
| Woolly mammoths and spotted hyenas              | Eurasian cave hyenas (_Crocuta_) for at least a million years [WP: Spotted hyena; WP: Woolly mammoth]                    |
| Woolly mammoths and _H. erectus_ (both extinct) | The era rule finds the overlap (0.4–0.11 Ma); no shared site is known                                                    |

**Known gap.** Other extinct–living pairings with _H. erectus_ (lions, wolves, buffalo, brown bears) and the mammoth (lions, tigers) fall back to "never met" for want of a sourced overlap; some of them, such as lions and Pleistocene hominins in Africa, probably did overlap. First-appearance dates for the extant species would replace the special list.

## 6. Compatibility rules

1. **Every v1 share link reproduces bit-identically**: same design matrix, same battle RNG streams, same summaries, aggregate and replay trace. `tests/v1-golden.test.ts` checks six v1 fragments (including out-of-v1-bounds values, a payload without a version and one that overrides every parameter) against fixtures captured on `main` before the change (`tests/fixtures/v1-golden.json`). Never regenerate that fixture.
2. Still 22 sampled parameters, in the v1 order. LHS columns are generated column by column from one stream, so a future parameter may only be **appended**, with `individual: false`, and per-animal draws in `simulateBattle` must never be inserted before existing ones.
3. A new mechanic is either a species constant whose _T. rex_/tiger value is an exact identity (×1, +0, a disabled branch) or an appended parameter, and it draws no random numbers when inactive. `hide` is applied as `dps × DT × hide`, so `× 1` is exact in IEEE-754; `intimidation` multiplies `woundMoraleLoss`, `throwMoraleLoss` and the `recoverMinTime` that follows a hit (a throw keeps the full `recoverMinTime`) and is exactly 1 for every species that shipped before #47 (`tests/species.test.ts` checks this with `Object.is`); `radius` for the tiger is 0.8 m, the former engine constant.
4. _T. rex_ and the tiger keep their v1 bounds forever: the engine clamps every per-animal value to the bounds, so widening them would change v1 results whose ranges touch a bound (for example `tiger.mass` max 500 × an individual factor of 1.3).

Share payload v2: `{"v":2,"heavy":"elephant","pack":"lion","heavyCount":5,"packCount":30,"params":{"pack.dps":[2,6,10]}}`. Params are diffed against the selected species' presets. Unknown species ids fall back to `trex`/`tiger`. A v1 payload (no `v`, or `v: 1`) is renamed key by key (`trexCount` → `heavyCount`, `tigerCount` → `packCount`, `tigerTactic` → `packTactic`, `trex.*` → `heavy.*`, `tiger.*` → `pack.*`); keys v1 could not carry are dropped, as v1 dropped them.

## 7. Calibration notes

**Method.** 200 runs per matchup with the defaults (seed 20261019, LHS, CV 0.08, 600 m arena, 1,200 s cap, `flank`, morale on), computed with the shipped engine. 95 % confidence intervals are about ±7 percentage points at mid probabilities. These are model statements, not predictions.

| Matchup                  | Class      | Heavy wins | Pack wins | Draw | Median duration | Reality check                                                    |
| ------------------------ | ---------- | ---------: | --------: | ---: | --------------: | ---------------------------------------------------------------- |
| 5 elephants vs 30 lions  | documented |       98 % |       0 % |  3 % |           338 s | Herds hold, as expected                                          |
| 1 elephant vs 27 lions   | documented |       60 % |      32 % |  9 % |           557 s | Lone adult cow; 11 % without `hide` — adults rarely taken        |
| 1 buffalo vs 6 lions     | documented |       40 % |      60 % |  1 % |           172 s | A classic hunt; 9 % buffalo wins without `hide`                  |
| 10 buffalo vs 12 lions   | documented |      100 % |       0 % |  0 % |            69 s | Herds protect in the open                                        |
| 1 buffalo vs 15 hyenas   | documented |        5 % |      96 % |  0 % |            45 s | **Too easy for hyenas**; field kills of bulls are rare           |
| 1 brown bear vs 8 wolves | documented |       56 % |      44 % |  1 % |           151 s | Bears usually dominate; 21 % without `hide`                      |
| 1 brown bear vs 1 tiger  | documented |       88 % |       0 % | 13 % |            42 s | A lone tiger never kills; latch/retreat handicaps solo attackers |
| 1 _T. rex_ vs 10 tigers  | never met  |       91 % |       8 % |  2 % |           370 s | Baseline                                                         |
| 1 _T. rex_ vs 30 lions   | never met  |       13 % |      88 % |  0 % |           203 s | Fantasy                                                          |
| 1 _T. rex_ vs 50 wolves  | never met  |       45 % |      56 % |  0 % |           242 s | Fantasy                                                          |

**Woolly mammoth and _Homo erectus_** ([#47](https://github.com/VinylStage/trex_vs_tiger_sim/issues/47); same method, 200 runs each, computed on this branch with `intimidation` = 0.02 for the heavy _H. erectus_). "Heavy wins" includes every run in which all attackers fled; the mean numbers of attackers incapacitated (`packKilled` in the code) and fled are given because flight, not incapacitation, decides most pack-of-hominin runs.

| Matchup                                 | Class     | Heavy wins | Pack wins | Draw | Median duration | Pack incapacitated / fled (mean) | Reality check                                                    |
| --------------------------------------- | --------- | ---------: | --------: | ---: | --------------: | -------------------------------: | ---------------------------------------------------------------- |
| 1 mammoth vs 12 wolves (preset)         | no record |       92 % |       0 % |  8 % |           309 s |                       1.3 / 10.6 | Adults "could effectively defend themselves"; plausible          |
| 1 mammoth vs 30 wolves                  | no record |       91 % |       4 % |  5 % |           331 s |                       1.3 / 28.6 | Morale routs large packs before damage adds up                   |
| 1 mammoth vs 15 hyenas                  | no record |       85 % |       2 % | 14 % |           307 s |                       0.9 / 14.0 | —                                                                |
| 1 mammoth vs 20 lions                   | never met |       77 % |      11 % | 13 % |           689 s |                       2.2 / 17.1 | Modern lions never met mammoths (cave lions are another species) |
| 1 _T. rex_ vs 100 _H. erectus_ (preset) | never met |       92 % |       6 % |  2 % |           302 s |                       1.8 / 96.4 | Fantasy; nearly every attacker flees                             |
| 1 _T. rex_ vs 300 _H. erectus_          | never met |       36 % |      65 % |  0 % |           187 s |                      0.7 / 199.0 | Numbers win once total damage outpaces routing                   |
| 1 _T. rex_ vs 30 _H. erectus_           | never met |       96 % |       0 % |  5 % |           249 s |                       2.1 / 27.9 | —                                                                |
| 1 elephant vs 30 _H. erectus_           | no record |       98 % |       0 % |  3 % |           225 s |                       1.5 / 28.4 | Unarmed hominins do not bring down an adult elephant; plausible  |
| 1 mammoth vs 30 _H. erectus_            | no record |       97 % |       0 % |  3 % |           241 s |                       1.6 / 28.3 | As the elephant                                                  |
| 1 buffalo vs 20 _H. erectus_            | never met |       92 % |       8 % |  0 % |           193 s |                       3.4 / 15.9 | —                                                                |
| 1 _H. erectus_ vs 8 wolves              | never met |        0 % |     100 % |  0 % |            22 s |                        0.0 / 0.0 | An unarmed adult has no chance against a pack; plausible         |
| 1 _H. erectus_ vs 3 wolves              | never met |        0 % |     100 % |  0 % |            30 s |                        0.0 / 0.0 | Plausible                                                        |
| 1 _H. erectus_ vs 1 wolf                | never met |       57 % |      41 % |  3 % |           349 s |                        0.5 / 0.1 | Closer to even; still favours the hominin somewhat (see below)   |
| 1 _H. erectus_ vs 3 hyenas              | no record |        0 % |     100 % |  0 % |            24 s |                        0.0 / 0.0 | Plausible                                                        |
| 1 _H. erectus_ vs 1 hyena               | no record |       32 % |      60 % |  8 % |           420 s |                        0.2 / 0.1 | The hominin loses most runs                                      |
| 1 _H. erectus_ vs 1 tiger               | no record |       12 % |      73 % | 15 % |           354 s |                        0.0 / 0.1 | The hominin loses most runs; draws are 20-minute stand-offs      |
| 1 _H. erectus_ vs 1 lion                | never met |       14 % |      79 % |  8 % |           312 s |                        0.0 / 0.1 | The hominin loses most runs                                      |
| 1 _H. erectus_ vs 1 _H. erectus_        | no record |       79 % |      18 % |  4 % |           472 s |                        0.5 / 0.3 | The heavy role wins symmetric duels: a role artefact             |
| 1 _H. erectus_ vs 2 _H. erectus_        | no record |        8 % |      92 % |  1 % |           195 s |                        0.2 / 0.0 | —                                                                |

Before `intimidation` (every heavy hit cost 0.25 morale), the same seed gave the hominin 98 % against one tiger, 99 % against one hyena and 100 % against one wolf: the lone predator fled after two or three bare-hand hits. The mammoth and pack-of-hominin rows are unchanged because only the heavy _H. erectus_ has `intimidation` ≠ 1.

Findings carried over from the research runs:

- **1 HP/kg makes mid-size heavies too fragile.** A 3.2 t elephant has only about 21 lions' worth of HP and no defence against riders except its frontal cone and shake-off. `hide` (elephant 0.3, buffalo 0.5, brown bear 0.5) moves the lone-heavy results to plausible levels while leaving juveniles vulnerable (a 0.9 t juvenile against 27 lions still loses in nearly every run). All `hide` values are **S**; calibrate against the qualitative targets above.
- **Wolves vs a lone buffalo** (a bison stand-in) give a sigmoidal curve: almost no kills for 1–3 wolves and a plateau from about 12, close to the 9–13-wolf plateau observed for wolves hunting bison [MacNulty 2014]. The model measures "kill within 20 minutes", the field data capture per encounter, so only the shape compares.
- **`pack.dps` is the top Spearman driver** in almost every matchup (|ρ| 0.3–0.6), followed by `heavy.shakeRate` and `heavy.mass`. Per-species dps calibration is the priority.
- **Herd effects emerge** without herd rules: neighbours' cones cover each other's riders.

Findings from the mammoth and _Homo erectus_ runs:

- **Hit morale was a per-hit constant.** Every heavy hit took 0.25 of the attacker's morale whatever the damage, so bare-hand hits routed lone predators. The species constant `intimidation` (exactly 1 for every earlier species, so their results are bit-identical; 0.02 **S** for the heavy _H. erectus_) scales the hit and throw morale loss and the minimum recovery after a hit. With it, and with lower, **S** bare-hand lethality, accuracy and shake-off, a lone hominin loses most runs against one tiger (73 %), lion (79 %) or hyena (60 %). The brown bear vs 1 tiger row above still reflects the shared constant and is unchanged on purpose.
- **What `intimidation` cannot fix.** A heavy's hit still detaches a latched attacker and sends it to recover, so a lone predator rarely holds on long; the fights run 5–7 minutes and 8–15 % end as 20-minute stand-offs. Against one wolf the hominin still wins 57 %, mostly by slowly incapacitating it with many weak blows. A truer duel needs hits that do not always detach, or the role-free engine ([#50](https://github.com/VinylStage/trex_vs_tiger_sim/issues/50)).
- **Against a pack the hominin loses quickly**: 3 or 8 wolves and 3 hyenas win every run in under 30 s.
- **As attackers, hominins mostly flee.** `pack.dps` (|ρ| ≈ 0.6) and `pack.morale` dominate; large numbers (300 against one _T. rex_) win only because the total damage rate outruns routing.
- **Role asymmetry.** The same species on both sides does not give 50/50: one heavy _H. erectus_ beats one pack _H. erectus_ in 79 % of runs and loses to two in 92 %; the roles, not the species, decide this.
- **The mammoth behaves like a slightly better-insulated elephant.** Its `hide` (0.25) is **S**; against 12 wolves it holds in 92 % of runs, consistent with adults being rarely taken.

## 8. What the engine cannot express

| #   | Mechanic                        | Species that need it                      | Minimal proposal                                                                           | Status      |
| --- | ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| M1  | Species constants and labels    | all                                       | `radius`, weapon labels                                                                    | implemented |
| M2  | Thick skin, fat, fur            | elephant, buffalo, bears                  | `hide` multiplier on incoming pack damage                                                  | implemented |
| M3  | Hunt success ≠ "kill everyone"  | all documented matchups                   | Record the first heavy death per run; aggregate P(≥ 1 heavy killed) and time to first kill | open        |
| M4  | Herd mobbing / rescue           | buffalo, elephant                         | Heavy attacks also target attackers latched onto other heavies within reach                | open        |
| M5  | 360° close-range strikes        | bears, elephant (trunk), crocodile (tail) | Secondary weapon with reach ≈ radius + 1 m, half-arc 180°                                  | open        |
| M6  | Prey flees / escapes            | buffalo, elephant                         | Heavy leaves when HP is low and reaches the edge → outcome "escaped"                       | open        |
| M7  | Hit-and-run strikes             | Komodo dragon, wolves, wild dogs          | Pack attack mode `strike`: instant damage and a forced recovery                            | open        |
| M8  | Heavy grab-and-hold, death roll | crocodile                                 | Heavy pins one attacker                                                                    | open        |
| M9  | Terrain, water, ambush start    | crocodile, Spinosaurus                    | Water tiles, ambush spawn; spawn must stay identical for v1                                | open        |
| M10 | Heavy-vs-heavy duels            | Spinosaurus vs _T. rex_, bull elephants   | A symmetric mode with two heavy sides                                                      | open        |
| M11 | Numbers-dependent courage       | hyena (4 : 1 rule), wolves                | Morale change ∝ log(local pack count / local heavy count), 0 for the tiger                 | open        |

## 9. Content rules

- No living humans (_Homo sapiens_) and no domestic animals anywhere in the roster. Gorilla is excluded (not a predator, no heavy-vs-pack data).
- The one hominin, the extinct _Homo erectus_, is modelled unclothed, with no tools, weapons, fire or trained skill, from an average adult's physical capability. Every matchup with it shows the thought-experiment note under the badge (`matchup.thoughtExperiment`: a physical-capability thought experiment that does not depict or endorse real violence), and the model and parameter pages repeat it. Wording stays neutral (incapacitated, fled), with the scientific name only.
- Every species carries `adSafe`; a living-human species would be `false` and its matchups would load no ads ([ADSENSE.md §6](ADSENSE.md#6-per-matchup-ad-safety)). All current species are `true`.
- The replay keeps abstract glyphs and role colours for every species (heavy = blue triangle scaled from the species body radius, exactly 7 m for _T. rex_; pack = orange dot sized from `radius`); no gore.
- Cross-era pairings are labelled "never met"; documented pairings link to sourced notes. Elephant and mammoth copy mentions tusks only as anatomy.
- Korean UI strings never put a particle after a species name; English strings use singular/plural forms chosen with `Intl.PluralRules`.

## 10. References

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
- **[Bramble & Lieberman 2004]** Endurance running and the evolution of _Homo_. _Nature_ 432:345–352. <https://doi.org/10.1038/nature03052> [Abs; sprint figures via Nature News 2004]
- **[Cunningham 2018]** Cunningham D.L., Graves R.R., Wescott D.J., McCarthy R.C. The effect of ontogeny on estimates of KNM-WT 15000's adult body size. _J. Hum. Evol._ 121:119–127. <https://doi.org/10.1016/j.jhevol.2018.04.002> [WP]
- **[Garvin 2017]** Garvin H.M. et al. Body size, brain size, and sexual dimorphism in _Homo naledi_ from the Dinaledi Chamber. _J. Hum. Evol._ (2017). [Abs]
- **[Grabowski 2015]** Grabowski M., Hatala K.G., Jungers W.L., Richmond B.G. Body mass estimates of hominin fossils and the evolution of human body size. _J. Hum. Evol._ 85:75–93. <https://doi.org/10.1016/j.jhevol.2015.05.005> [Abs]
- **[Hubel 2016a]** Hubel T.Y. et al. Energy cost and return for hunting in African wild dogs and cheetahs. _Nat. Commun._ 7:11034. <https://doi.org/10.1038/ncomms11034> [FT]
- **[Hubel 2016b]** Hubel T.Y. et al. Additive opportunistic capture explains group hunting benefits in African wild dogs. _Nat. Commun._ 7:11033. <https://doi.org/10.1038/ncomms11033> [FT abstract and introduction]
- **[Hutchinson 2003]** Hutchinson J.R. et al. Are fast-moving elephants really running? _Nature_ 422:493–494. <https://doi.org/10.1038/422493a> [Abs]
- **[Hutchinson 2006]** Hutchinson J.R. et al. The locomotor kinematics of Asian and African elephants: changes with speed and size. _J. Exp. Biol._ 209:3812–3827. <https://doi.org/10.1242/jeb.02443> [Abs]
- **[Hutchinson 2019]** Divergent evolution of terrestrial locomotor abilities in extant Crocodylia. _Sci. Rep._ <https://doi.org/10.1038/s41598-019-55768-6> [FT]
- **[Iurino 2022]** Iurino D.A. et al. A Middle Pleistocene wolf from central Italy provides insights on the first occurrence of _Canis lupus_ in Europe. _Sci. Rep._ 12:2882. <https://doi.org/10.1038/s41598-022-06812-5> [WP]
- **[Jimenez 2008]** Gray wolves, _Canis lupus_, killed by cougars, _Puma concolor_, and a grizzly bear, _Ursus arctos_, in Montana, Alberta, and Wyoming. _Can. Field-Nat._ 122:76–78. <https://doi.org/10.22621/cfn.v122i1.550> [Abs]
- **[Joubert 2006]** Hunting behaviour of lions (_Panthera leo_) on elephants (_Loxodonta africana_) in the Chobe National Park, Botswana. _Afr. J. Ecol._ 44:279–281. <https://doi.org/10.1111/j.1365-2028.2006.00626.x> [WP]
- **[Larramendi 2016]** Shoulder height, body mass and shape of proboscideans. _Acta Palaeontol. Pol._ 61:537–574. <https://doi.org/10.4202/app.00136.2014> [WP]
- **[MacNulty 2014]** MacNulty D.R., Tallian A., Stahler D.R., Smith D.W. Influence of group size on the success of wolves hunting bison. _PLoS ONE_ 9:e112884. <https://doi.org/10.1371/journal.pone.0112884> [FT]
- **[Power & Compion 2009]** Lion predation on elephants in the Savuti, Chobe National Park, Botswana. _African Zoology_ 44:36–44. <https://doi.org/10.3377/004.044.0104> [Abs]
- **[Rayfield 2001]** Cranial design and function in a large theropod dinosaur. _Nature_ 409:1033–1037. <https://doi.org/10.1038/35059070> [Abs]
- **[Reynolds 2010]** Reynolds S.C. Where the wild things were: spatial and temporal distribution of carnivores in the Cradle of Humankind. _J. Taphonomy_ 8:233–257. [WP]
- **[Rizal 2020]** Rizal Y., Westaway K.E. et al. Last appearance of _Homo erectus_ at Ngandong, Java, 117,000–108,000 years ago. _Nature_ 577:381–385. <https://doi.org/10.1038/s41586-019-1863-2> [Abs]
- **[Sakamoto 2022]** Sakamoto M. Estimating bite force in extinct dinosaurs using phylogenetically predicted physiological cross-sectional areas of jaw adductor muscles. _PeerJ_ 10:e13731. <https://doi.org/10.7717/peerj.13731> [FT]
- **[Sanders 2023]** Sanders W.J. _Evolution and Fossil Record of African Proboscidea_. CRC Press, pp. 257–261. <https://doi.org/10.1201/b20016> [WP]
- **[Sellers 2017]** Investigating the running abilities of _Tyrannosaurus rex_ using stress-constrained multibody dynamic analysis. _PeerJ_ 5:e3420. <https://peerj.com/articles/3420/> [MODEL]
- **[Sellers & Manning 2007]** Estimating dinosaur maximum running speeds using evolutionary robotics. _Proc. R. Soc. B_ 274. <https://doi.org/10.1098/rspb.2007.0846>, full text <https://pmc.ncbi.nlm.nih.gov/articles/PMC2279215/> [FT]
- **[Sereno 2022]** Sereno P.C. et al. _Spinosaurus_ is not an aquatic dinosaur. _eLife_ 11:e80092. <https://doi.org/10.7554/eLife.80092> [FT]
- **[Smith 2000]** Smith M.S., Dyson R.J., Hale T., Janaway L. Development of a boxing dynamometer and its punch force discrimination efficacy. _J. Sports Sci._ 18(6):445–450. [Abs]
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
- [WP: Woolly mammoth] <https://en.wikipedia.org/wiki/Woolly_mammoth> (accessed 2026-10-20)
- [WP: Homo erectus] <https://en.wikipedia.org/wiki/Homo_erectus> (accessed 2026-10-20)
- [WP: Turkana Boy] <https://en.wikipedia.org/wiki/Turkana_Boy> (accessed 2026-10-20)
- [WP: Panthera tigris soloensis] <https://en.wikipedia.org/wiki/Panthera_tigris_soloensis> (accessed 2026-10-20)
- [WP: Endurance running hypothesis] <https://en.wikipedia.org/wiki/Endurance_running_hypothesis> (accessed 2026-10-20)
- **Bite force of modern adults** (not the model's weapon): PubMed 8322012 (1993; molar means 847 N men, 597 N women) and _Acta Odontologica Scandinavica_ (1995; 909 N, 777 N), both via search summaries [Abs].

**Policy**

- **[Google Publisher Policies]** <https://support.google.com/publisherpolicies/answer/10502938> [Abs]
