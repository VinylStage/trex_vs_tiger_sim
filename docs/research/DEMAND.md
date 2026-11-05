# Species demand signals

> **한국어 요약**
>
> - 새 동물의 순서를 정할 때 참고할 수요 신호를 API로만 모았습니다: 위키백과 조회수(영어 · 한국어), r/whowouldwin 게시물 제목 수(Arctic Shift), YouTube 검색(영어 · 한국어, "○○ vs"). 기간은 2025-11-01부터 2026-10-31까지 12개월입니다.
> - 후보 8종의 종합 점수 순서: **고릴라 93 · 하마 86 · 랩터 무리 82 · 흰코뿔소 80** · 스피노사우루스 72 · 카피바라 71 · 트리케라톱스 70 · 황제펭귄 67. 가중치를 바꿔도 위 네 종의 순서는 같았고(§5), 한국어 신호만 보면 카피바라가 1위입니다.
> - YouTube는 수치를 공개하지 않습니다. 종합 점수 계산에만 쓰고, 저장소에는 종·언어별 인기 등급(상위 · 중간 · 하위 3분의 1, `high` / `mid` / `low`)만 남깁니다. 원본 API 응답은 git에서 제외된 로컬 캐시에만 최대 30일 보관합니다(§1, §7).
> - 고릴라의 Reddit 수치는 밈의 영향을 크게 받고, "raptor", "rhino", "lion" 같은 검색어에는 스포츠 팀이나 캐릭터 이름이 섞입니다(§6). 점수 차이가 3점 안쪽이면 같은 수준으로 보세요.
> - **이 표는 결정이 아니라 소유자 결정의 입력입니다.** 데이터 준비 상태와 엔진 요구(RENEWAL-1.0 §5.1, §5.2)는 반영하지 않았습니다.
> - 분기마다 같은 명령으로 다시 돌립니다(§8).

Status: first run on 2026-11-04 against `main` at `6d49806` (v0.2.23). Issue [#190](https://github.com/VinylStage/trex_vs_tiger_sim/issues/190), part of epic [#129](https://github.com/VinylStage/trex_vs_tiger_sim/issues/129). Design: [RENEWAL-1.0.md §5.1 and §5.3 step 1](../design/RENEWAL-1.0.md#53-add-a-species-pipeline-definition-of-done). Script: `scripts/demand/run.mjs`; tables: `scripts/demand/tables.mjs`; committed totals: [`demand-results.json`](demand-results.json). Revised under [#207](https://github.com/VinylStage/trex_vs_tiger_sim/issues/207): YouTube figures replaced by tiers, regenerated from the same run's cache (same data, no new API calls).

**This report is an input to the owner's decision on the species order, not a decision.** It measures attention, not feasibility: data quality and engine needs decide the batch (RENEWAL-1.0 §5.1), and none of that is in the score.

## Contents

1. [Method](#1-method)
2. [Sources and terms](#2-sources-and-terms)
3. [Summary table](#3-summary-table)
4. [Candidate ranking](#4-candidate-ranking)
5. [How stable the ranking is](#5-how-stable-the-ranking-is)
6. [Caveats](#6-caveats)
7. [Sources left out](#7-sources-left-out)
8. [Re-running every quarter](#8-re-running-every-quarter)

## 1. Method

- **Species.** Every species the free engine has (the 11 ids of `FREE_SPECIES_IDS`) as a reference, and the 8 candidates of epic #129: _Spinosaurus_ (#185), hippopotamus (#186), white rhinoceros (#187), raptor pack (#188), _Triceratops_ (#189), and gorilla, capybara and emperor penguin (batch B, R14 and R15). The list, with an en and a ko term for every source, is `scripts/demand/species.json`; `tests/demand.test.ts` fails if a free-engine species is missing from it. A candidate moves to `sim` in the PR that ships it (the hippopotamus in #186, the raptor pack in #188, the white rhinoceros in #187); the tables below are from the first run, when it was still a candidate.
- **Window.** The last 12 complete calendar months before the run date (UTC): 2025-11-01 to 2026-10-31.
- **API calls only.** No HTML page is fetched (RENEWAL-1.0 §5.3). The client identifies itself as `trex-vs-tiger-demand/1.0 (https://trex-vs-tiger.vinylims.com)`, which the Wikimedia API requires. It waits between calls (Wikimedia 1 s, Arctic Shift 2 s) and backs off on 429, 5xx and Arctic Shift's "Timeout" replies, honouring `Retry-After`.
- **Cache.** Raw responses go to `scripts/demand/.cache/` (gitignored) so a rerun of the same window spends no quota. Entries older than 30 days are deleted when the script starts, which keeps YouTube API data within the 30-day storage limit of its developer policies. The committed `demand-results.json` holds Wikipedia and Reddit totals per species, and for YouTube a tier only: no key, no YouTube figure of any kind, no video ids or titles, no Reddit post content.
- **YouTube tiers.** YouTube numbers are used inside the score but never published. For each language, the 19 species are ranked by the summed views of their ten most-viewed "X vs" videos and cut into thirds by position: the top third is `high`, the middle third `mid`, the bottom third `low` (19 species: 7 / 6 / 6; position `i` of `n` gets tier `floor(3i / n)`). A tier says only where a species sits among these 19; it carries no count, estimate or ratio. `rankTiers` in `scripts/demand/lib.mjs` implements it.
- **Combined score.** Each source is put on a log scale against the largest value among all 19 species, `log10(1 + x) / log10(1 + max)`, so 1.0 is the leader and a tenfold gap costs a fixed step rather than everything. The score is the weighted mean of those five parts × 100:

  | Source                                    | Weight | Why                                                     |
  | ----------------------------------------- | -----: | ------------------------------------------------------- |
  | r/whowouldwin posts (Arctic Shift)        |   0.30 | Battle-specific and close to this site's format         |
  | YouTube en, ten most-viewed "X vs" videos |   0.20 | Battle-specific video demand, English                   |
  | YouTube ko, ten most-viewed "X vs" videos |   0.20 | Battle-specific video demand, Korean (the default page) |
  | Wikipedia en pageviews                    |   0.15 | General interest, not battle-specific                   |
  | Wikipedia ko pageviews                    |   0.15 | General interest, Korean                                |

  The published score is rounded to whole points and lists only the Reddit and Wikipedia parts (`publishScores`). The YouTube parts are dropped, and with whole points the YouTube share of a score can be bounded only to a band of a few points on a log scale whose reference (the leading species' views) is not published, so no YouTube figure can be backed out.

  Battle-specific sources carry 0.7, following RENEWAL-1.0 §5.1 ("weighed across battle-specific sources"). A source without a number for a species would be left out of its mean and the other weights rescaled; in this run every species has all five. The weights and the scaling are in `scripts/demand/lib.mjs` (`WEIGHTS`, `logScale`, `combinedScores`) and unit-tested.

## 2. Sources and terms

| Source                                                                                           | Endpoint and settings                                                                                                                                                                                                           | Metric                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Wikimedia REST pageviews](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/) | `per-article/{en,ko}.wikipedia/all-access/user/{title}/daily`, summed by month                                                                                                                                                  | Views over the 12 months; for the raptor pack, Velociraptor and Utahraptor added                                                             |
| [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift/tree/master/api) (Reddit archive)  | `posts/search/aggregate?aggregate=created_utc&frequency=month&subreddit=whowouldwin&title=…`                                                                                                                                    | Posts whose title matches the query                                                                                                          |
| [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/search/list)                 | `search.list` with `type=video`, `order=viewCount`, `maxResults=10`, `publishedAfter`/`publishedBefore` = the window, `regionCode` US or KR, `relevanceLanguage` en or ko; then `videos.list?part=statistics` for those ten ids | Sum of the ten videos' view counts on the run date, used in the score and published only as a tier (§1); `pageInfo.totalResults` is not used |

Daily rather than monthly pageviews: the monthly figure for October was still a one-day partial on 2026-11-04, while the daily series was complete, so the script asks for days and sums them.

Search terms (from `scripts/demand/species.json`):

| Species                                | Wikipedia en             | Wikipedia ko             | r/whowouldwin title query                                          | YouTube en           | YouTube ko          |
| -------------------------------------- | ------------------------ | ------------------------ | ------------------------------------------------------------------ | -------------------- | ------------------- |
| Tyrannosaurus rex                      | Tyrannosaurus            | 티라노사우루스           | `tyrannosaurus OR trex OR "t rex"`                                 | `t rex vs`           | `티라노사우루스 vs` |
| African bush elephant                  | Elephant                 | 코끼리                   | `elephant OR elephants`                                            | `elephant vs`        | `코끼리 vs`         |
| African buffalo                        | African buffalo          | 아프리카물소             | `buffalo OR buffalos OR buffaloes`                                 | `buffalo vs`         | `물소 vs`           |
| Brown bear                             | Brown bear               | 불곰                     | `grizzly OR "brown bear" OR kodiak`                                | `grizzly bear vs`    | `불곰 vs`           |
| Woolly mammoth                         | Woolly mammoth           | 털매머드                 | `mammoth OR mammoths`                                              | `mammoth vs`         | `매머드 vs`         |
| Homo erectus                           | Homo erectus             | 호모 에렉투스            | `"homo erectus"`                                                   | `homo erectus vs`    | `호모 에렉투스 vs`  |
| Tiger                                  | Tiger                    | 호랑이                   | `tiger OR tigers`                                                  | `tiger vs`           | `호랑이 vs`         |
| Lion                                   | Lion                     | 사자                     | `lion OR lions`                                                    | `lion vs`            | `사자 vs`           |
| Gray wolf                              | Wolf                     | 회색늑대                 | `wolf OR wolves`                                                   | `wolf vs`            | `늑대 vs`           |
| Spotted hyena                          | Hyena                    | 하이에나                 | `hyena OR hyenas`                                                  | `hyena vs`           | `하이에나 vs`       |
| Polar bear                             | Polar bear               | 북극곰                   | `"polar bear" OR "polar bears"`                                    | `polar bear vs`      | `북극곰 vs`         |
| Spinosaurus                            | Spinosaurus              | 스피노사우루스           | `spinosaurus OR spino`                                             | `spinosaurus vs`     | `스피노사우루스 vs` |
| Hippopotamus                           | Hippopotamus             | 하마                     | `hippo OR hippos OR hippopotamus`                                  | `hippo vs`           | `하마 vs`           |
| White rhinoceros                       | Rhinoceros               | 코뿔소                   | `rhino OR rhinos OR rhinoceros`                                    | `rhino vs`           | `코뿔소 vs`         |
| Raptor pack (Utahraptor, Velociraptor) | Velociraptor, Utahraptor | 벨로키랍토르, 유타랍토르 | `velociraptor OR velociraptors OR utahraptor OR raptor OR raptors` | `velociraptor vs`    | `랩터 vs`           |
| Triceratops                            | Triceratops              | 트리케라톱스             | `triceratops`                                                      | `triceratops vs`     | `트리케라톱스 vs`   |
| Gorilla                                | Gorilla                  | 고릴라                   | `gorilla OR gorillas`                                              | `gorilla vs`         | `고릴라 vs`         |
| Capybara                               | Capybara                 | 카피바라                 | `capybara OR capybaras`                                            | `capybara vs`        | `카피바라 vs`       |
| Emperor penguin                        | Emperor penguin          | 황제펭귄                 | `"emperor penguin" OR "emperor penguins"`                          | `emperor penguin vs` | `황제펭귄 vs`       |

Wikipedia titles are the article a reader lands on for the common name (Elephant, Rhinoceros, Wolf, Hyena), not always the modelled species, and must not be redirects: a redirect's own pageviews are near zero. The ko wolf article was first listed as 늑대, a redirect to 회색늑대, and corrected before this run was committed.

## 3. Summary table

All 19 species, by combined score. "Wiki" = 12-month pageviews; "r/whowouldwin" = matching post titles; "YouTube" = the species' tier among the 19 by the ten most-viewed matching videos published in the window (§1).

|   # | Species                                            | Group          | Wiki en | Wiki ko | r/whowouldwin | YouTube en | YouTube ko | Score |
| --: | -------------------------------------------------- | -------------- | ------: | ------: | ------------: | ---------- | ---------- | ----: |
|   1 | Lion (사자)                                        | in sim         |   1.30M |     25k |            83 | high       | high       |    96 |
|   2 | Gorilla (고릴라)                                   | candidate #129 |    804k |    5.7k |           128 | high       | mid        |    93 |
|   3 | Tyrannosaurus rex (티라노사우루스)                 | in sim         |   1.09M |     18k |            99 | mid        | low        |    92 |
|   4 | Tiger (호랑이)                                     | in sim         |   1.24M |     39k |            62 | high       | high       |    92 |
|   5 | African bush elephant (아프리카코끼리)             | in sim         |    970k |     16k |            54 | high       | high       |    90 |
|   6 | Gray wolf (회색늑대)                               | in sim         |   1.03M |     18k |            51 | mid        | high       |    89 |
|   7 | Polar bear (북극곰)                                | in sim         |    925k |     16k |            55 | high       | mid        |    89 |
|   8 | Brown bear (불곰)                                  | in sim         |    721k |    9.5k |            54 | high       | mid        |    88 |
|   9 | Hippopotamus (하마)                                | candidate #186 |    788k |     15k |            37 | mid        | mid        |    86 |
|  10 | Raptor pack (Utahraptor, Velociraptor) (랩터 무리) | candidate #188 |    658k |    7.9k |            26 | low        | high       |    82 |
|  11 | White rhinoceros (흰코뿔소)                        | candidate #187 |    497k |     11k |            24 | low        | low        |    80 |
|  12 | Spotted hyena (점박이하이에나)                     | in sim         |    660k |    7.1k |             5 | mid        | high       |    74 |
|  13 | Spinosaurus (스피노사우루스)                       | candidate #185 |    552k |    7.9k |             6 | low        | low        |    72 |
|  14 | Capybara (카피바라)                                | candidate #129 |   1.36M |     47k |             1 | high       | mid        |    71 |
|  15 | Triceratops (트리케라톱스)                         | candidate #189 |    393k |    4.9k |             3 | low        | mid        |    70 |
|  16 | African buffalo (아프리카물소)                     | in sim         |    252k |    3.3k |             4 | mid        | low        |    69 |
|  17 | Woolly mammoth (털매머드)                          | in sim         |    455k |    2.1k |             2 | mid        | high       |    69 |
|  18 | Emperor penguin (황제펭귄)                         | candidate #129 |    418k |     11k |             2 | low        | low        |    67 |
|  19 | Homo erectus (호모 에렉투스)                       | in sim         |    597k |    4.6k |             0 | low        | low        |    53 |

## 4. Candidate ranking

The candidates only. The Reddit and Wikipedia parts are the log-scaled values that enter the score (1.00 = the leader among all 19 species); YouTube enters the score the same way but is shown as its tier only.

| Rank | Candidate                                          | Issue | Score | Overall rank | Reddit part | Wiki parts (en / ko) | YouTube tier (en / ko) |
| ---: | -------------------------------------------------- | ----- | ----: | -----------: | ----------: | -------------------- | ---------------------- |
|    1 | Gorilla (고릴라)                                   | #129  |    93 |            2 |        1.00 | 0.96 / 0.80          | high / mid             |
|    2 | Hippopotamus (하마)                                | #186  |    86 |            9 |        0.75 | 0.96 / 0.89          | mid / mid              |
|    3 | Raptor pack (Utahraptor, Velociraptor) (랩터 무리) | #188  |    82 |           10 |        0.68 | 0.95 / 0.83          | low / high             |
|    4 | White rhinoceros (흰코뿔소)                        | #187  |    80 |           11 |        0.66 | 0.93 / 0.86          | low / low              |
|    5 | Spinosaurus (스피노사우루스)                       | #185  |    72 |           13 |        0.40 | 0.94 / 0.83          | low / low              |
|    6 | Capybara (카피바라)                                | #129  |    71 |           14 |        0.14 | 1.00 / 1.00          | high / mid             |
|    7 | Triceratops (트리케라톱스)                         | #189  |    70 |           15 |        0.29 | 0.91 / 0.79          | low / mid              |
|    8 | Emperor penguin (황제펭귄)                         | #129  |    67 |           18 |        0.23 | 0.92 / 0.86          | low / low              |

Read against RENEWAL-1.0 §5.2:

- Hippo, white rhino and the raptor pack sit together just behind the sim's big carnivores, which matches their batch A placement. Hippo leads the three on every source except Korean YouTube.
- Gorilla leads the candidates, driven by Reddit (128 titles, more than any species, sim included). That is the meme the design records (§2.3), and R14 already places gorilla in batch B after hippo and rhino with neutral naming; nothing here argues for moving it, only that the interest has not faded within the window.
- _Spinosaurus_ and _Triceratops_ are mid-table on general interest but low on Reddit (6 and 3 titles). Their case in the design rests on dinosaur-specific evidence (polls, a film clip, a documented bite) that this report does not measure.
- Capybara has the most Wikipedia views of all 19 species in both languages and almost no fight titles (1), which is the "what-if tier" pattern of §2.3.

## 5. How stable the ranking is

The candidate order under other weightings (same data). Orders only: a score under a weighting that leans on one YouTube language would come close to a YouTube-only metric, which this report does not publish.

| Weighting                                   | Order                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Default (Reddit 0.3, YouTube 0.4, wiki 0.3) | gorilla, hippo, raptor, rhino, _Spinosaurus_, capybara, _Triceratops_, penguin |
| Equal (0.2 each)                            | gorilla, hippo, raptor, rhino, capybara, _Spinosaurus_, _Triceratops_, penguin |
| Without YouTube                             | gorilla, hippo, raptor, rhino, _Spinosaurus_, capybara, _Triceratops_, penguin |
| Reddit only                                 | gorilla, hippo, raptor, rhino, _Spinosaurus_, _Triceratops_, penguin, capybara |
| English sources only                        | gorilla, hippo, raptor, rhino, _Spinosaurus_, _Triceratops_, capybara, penguin |
| Korean sources only (YouTube ko, wiki ko)   | capybara, raptor, hippo, _Triceratops_, gorilla, penguin, rhino, _Spinosaurus_ |

The top four keep their order in every weighting that includes Reddit. Korean signals alone put capybara first and flatten the field: the eight sit much closer together than under any other weighting. Treat score gaps under about 3 points as ties: the raptor–rhino gap (2 points) is inside that, and so are several sim species in §3.

## 6. Caveats

- **These are estimates of attention.** Pageviews, post counts and view counts measure interest, not who would play a matchup, and none of them separates "fight" interest from documentary, meme or children's content.
- **YouTube `totalResults` is not used.** The API documents it as an approximation and caps it; most of the 38 searches hit the cap, so it carries no ranking information. It is neither scored nor published.
- **YouTube top-10 views are lumpy.** One viral video can carry most of a species' sum, and lifetime views on the run date favour videos published early in the window. Korean "사자 vs" and "매머드 vs" land in the top tier, far above what their other signals suggest, which points to one or two very large videos, possibly animation or music rather than animal content. Video titles are not stored (§1), so this was not checked per video; a manual look is cheap if the owner wants it.
- **Term ambiguity, English.** Title keyword matches include non-animal uses: "raptor"/"raptors" (a basketball team, aircraft), "rhino" (a comic-book character, a frequent r/whowouldwin subject), "lion" (characters, a football team), "tiger", "wolf", "gorilla" ("100 men vs a gorilla"), "buffalo" (a football team, also bison), "mammoth" (an ice-hockey team since 2025), "spino" (short for _Spinosaurus_ but also other uses). The penguin query is the exact phrase "emperor penguin" to avoid the comic-book Penguin, so its count is a floor. Raptor's Reddit count is likely inflated the most.
- **Term ambiguity, Korean.** 사자 is also a common word (使者, "messenger"); 물소 is any water buffalo; 랩터 is the generic loanword; 하마 and 늑대 have slang uses. Korean YouTube "vs" searches also pick up toy and preschool channels.
- **Brand noise.** "Tiger" is also a beer, a golfer, a sports nickname and many brands; "lion" and "gorilla" (a glass brand) likewise. The "vs" in the YouTube query and r/whowouldwin's battle format reduce this but do not remove it.
- **Wikipedia article choice.** Generic articles (Elephant, Rhinoceros, Wolf, Hyena) catch more readers than the modelled species' own article. The raptor pack sums two articles in each language, which gives it a small edge over single-article species. Korean Wikipedia is small (5.7k views a year for 고릴라), so its parts sit on a much shorter scale than English.
- **Arctic Shift.** Title keyword search only (bodies are not searched); counts are what the archive holds on the run date, and the most recent days can still be filling in. A query sometimes times out on the first try; the script retries.
- **Recency.** One 12-month window, with no extra weight on recent months. The monthly series are in `demand-results.json` for anyone who wants to look at trends (for example a spike month).

## 7. Sources left out

- **Steam Workshop** (`IPublishedFileService/QueryFiles`): left out. There is no Steam Web API key for this project, and the design's own finding is that the top items of the relevant animal battle game are giant-monster mods whose IP the site cannot use (RENEWAL-1.0 §2.3), so the signal would say little about real species. It can be added later as a fourth source if the owner provides a key.
- **HTML scrapers** (the research run's `yt_search.py`, `play_app.py`, `steam_thread.py`): not committed, per RENEWAL-1.0 §5.3.
- **Arctic Shift terms.** Its API documentation (linked in §2) states no terms of use beyond rate limits ("a couple requests per second" is fine; excessive use gets 429; use the dumps for bulk work) and offers the aggregate endpoint for counts. The script makes one aggregate call per species, two seconds apart, and stores counts only. Reddit's own data terms apply to the underlying posts; nothing from the posts is stored.
- **YouTube terms.** The Data API is used with a project key read from `YOUTUBE_API_KEY`, never written to a file, log line or error message. The report stays on the conservative side of the [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies): API data may be stored for at most 30 days, and independently calculated YouTube metrics are not to be published. So raw responses live only in the gitignored cache, pruned at 30 days, and nothing derived from them is committed except a three-level tier per species and language (§1) and a whole-point combined score without YouTube parts. The first version of this report (#205) published per-species view sums, `totalResults` estimates and YouTube score parts; #207 replaced them with tiers. Those figures remain in earlier commits of `main`, which is never force-pushed. `tests/demand.test.ts` fails if `demand-results.json` holds a YouTube number again. If the owner wants no YouTube signal at all, rerun without the key: the script then scores the other three sources.

## 8. Re-running every quarter

Re-run at the start of each quarter (January, April, July, October), after the 2nd of the month so the last month is complete, and update this file. RENEWAL-1.0 §5.3 re-ranks the species queue from this refresh.

```bash
NODE_USE_ENV_PROXY=1 YOUTUBE_API_KEY=… node scripts/demand/run.mjs
npx prettier --write docs/research/demand-results.json
node scripts/demand/tables.mjs
```

- `NODE_USE_ENV_PROXY=1` is needed only behind an HTTP proxy (Node's built-in `fetch` ignores `HTTPS_PROXY` otherwise).
- `--today YYYY-MM-DD` fixes the run date, and with it the window; with the cache, a rerun with the same date reproduces the same numbers without network calls. `--cache-only` guarantees that: it needs no key, sends nothing and fails on a cache miss (used for #207).
- The script refuses to send more than 60 uncached `search.list` calls (`--max-search` changes the limit). One run is 38 searches and 38 `videos.list` calls: **3,838 units** of the default 10,000-unit daily quota. This first run spent exactly that.
- Expect it to take 5 to 30 minutes: Wikimedia answered many calls from this environment with 429 and a `Retry-After` of up to a minute, and Arctic Shift needed retries for several queries.
- To add a species, append it to `species.json` with both terms for every source, check its Wikipedia titles are not redirects, and rerun. Paste the tables printed by `tables.mjs` into §2–§4 (YouTube appears as tiers only; never paste a figure from the cache), update the §5 orders and the Korean summary, and record the run date and base commit in the status line.
