# Sharing: settings codes, result links, result cards

Issue #51. Three ways to hand something on, all generated in the browser:

| What                   | Form                                                                                            | Carries                  | Code                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Settings link          | `/play/#s=<payload>` ([ADR-0003](adr/0003-no-backend-url-sharing.md)); old `/#s=` links forward | config incl. seed        | `src/ui/share.ts`, [link routing](#link-routing)                                      |
| Settings code / file   | `TVT2-<payload>` or a `.json` file                                                              | config incl. seed        | `src/share/config-code.ts`, `src/ui/config-transfer.ts`                               |
| Result link            | `/r/?r=<base64url>` and `/en/r/?r=…`                                                            | config + result snapshot | `src/share/result-codec.ts`, `src/share/result-page.ts`                               |
| Result card            | PNG, 1080×1920 story or 1080×1080 square                                                        | rendered snapshot        | `src/ui/result-card.ts`                                                               |
| Text share             | Wordle-style emoji text                                                                         | snapshot + result link   | `src/share/result-text.ts`                                                            |
| Link preview (crawler) | rewritten `og:*` / `twitter:*` text on `/r/`                                                    | snapshot text            | `src/share/result-function.ts`, [ADR-0006](adr/0006-pages-function-share-previews.md) |

The DOM-free core (`config-code.ts`, `result-codec.ts`, `result-text.ts`, `messages.ts`, `baseline.ts`) is shared by the simulator, the result page and the Pages Function, so all three accept and describe exactly the same links. Strings for these features live in `src/share/messages-ko.ts` and `messages-en.ts` (read through `sm()` in `src/share/messages.ts`), not in the app dictionaries, so the Function and the result page get only what they need; species names still come from the app dictionaries (`src/i18n/ko.ts`, `en.ts`). Each result page bundles only its own language (`src/share/result-page-ko.ts`, `-en.ts`, #79); the Function registers both.

## Config code

- Code: `TVT2-` + the same payload as `#s=` (`encodeConfig`). `TVT2-` alone is the defaults. The prefix is matched case-insensitively.
- The paste field accepts a code, a full URL with `#s=` (other fragment parts such as `chk=` are ignored; a URL without `s=` is rejected), or a bare payload.
- Validation order: length (≤ 8192) → base64url alphabet → `JSON.parse` → v1 upgrade (`upgradeV1`) → `sanitizeConfig`, through `configFromObject` in `src/ui/share.ts`, the same path as `#s=` links.
- `.json` file: `{ "app": "trex-vs-tiger", "kind": "config", "v": 2, "config": <configDiff>, "exportedAt": "<ISO time>" }`, saved through `<a download>` with an object URL, loaded with `file.text()`. Files over 64 KB are rejected before reading; `v` < 2 means v1 names inside `config`.
- An import is shown as a preview (matchup, runs, seed, number of edited ranges) and applied only on **Apply**. It never starts a run.
- Clipboard failures (no API, denied permission, insecure context) open a dialog with the text selected in a read-only field. The existing **Copy settings link** button (formerly "Copy link") uses the same fallback.

## Free matchups (#50)

Free-matchup configs ([design §2.4–2.5](design/FREE-MATCHUPS.md#24-config-and-share-schema-v3)) use their own payload, `src/ui/share-free.ts`:

- **Settings link** `#s=` with payload **v3** and the mode marker `m: "free"`, e.g. `{"v":3,"m":"free","a":{"sp":"tiger","n":5},"b":{"sp":"lion","n":5},"runs":1000}`. Per side `sp` species and `n` count, then `p`/`bf` edited trait and pack-buff ranges, `buff` switches turned off and `g` edited global constants, diffed against the species presets and the free defaults. A v3 link opens the simulator in free mode; every other link opens classic, and v1/v2 payloads decode exactly as before (the goldens guard them).
- **Settings code** `TVT3-<v3 payload>`. Pasting one (or a v3 link) into the classic import field switches to free mode and applies it; free mode has a "Copy settings code" button. `TVT2-` stays the classic code.
- **Result links** (`/r/`) of free results use result format **v2** with the v3 config; the result page, the card, the text share and the link preview handle both ([Free result links](#free-result-links)).
- **Model version** `mv`, absent while it is 1 ([Model version](#model-version-mv)).
- **Simple-mode marker** `ui: "simple"`, appended last, only in links Simple mode writes ([Simple links](#simple-links)).

| v3 key      | Meaning                                                                              | Written                                             |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `v`, `m`    | payload version 3, mode marker `"free"`                                              | always                                              |
| `mv`        | model version ([Model version](#model-version-mv))                                   | only when not 1, right after `m`                    |
| `a`, `b`    | per side `sp` species, `n` count, `p` / `bf` edited ranges                           | always (`p`, `bf` only when edited)                 |
| `buff`, `g` | switches turned off, edited global constants                                         | only when not the default                           |
| scalars     | `runs`, `seed`, `arenaSize`, `maxTime`, `sampling`, `individualCV`, `morale`         | only when not the default                           |
| `ui`        | `"simple"`: written by Simple mode, reopens in Simple (#154); not part of the config | only by Simple mode, for a config it can show, last |

### Model version (`mv`)

[ADR-0008](adr/0008-live-interventions-and-model-version.md): a free link reproduces its results under the model version it names. `FREE_MODEL_VERSION` in `src/sim/free/config.ts` is the newest version this build runs (1 today), and `FreeConfig.mv` is the version a config runs under.

- **Absent means 1.** Every v3 link, `TVT3-` code and free result link made before `mv` existed decodes as model 1, and so does any other input without `mv` (`sanitizeFreeConfig`, the golden fixtures).
- **The encoder omits `mv` while it is 1** and writes any other version right after `m`: `{"v":3,"m":"free","mv":2,"a":…}`. Writing `mv: 1` into every link was the alternative; it was rejected because it would change the bytes of every free link from now on. With the omission, a model 1 link made today is byte for byte the link the earlier encoder made, and every existing test and golden is unchanged.
- **A version this build does not run** is never read under this build's model. It is either a newer model, an integer above `FREE_MODEL_VERSION` (`freeModelNewer`), met in an older cached page built from #124 on, or a malformed value (0, -1, 1.5, the string `"1"`, `null`) that no build will ever run:
  - a settings link or `TVT3-` code opens free mode at the free defaults, without any of the payload's values (`freeConfigFromObject`); it never falls through to the classic decoder;
  - for a newer model only, the simulator keeps the link in the address as it came (`freeHashModelNewer`), whether the page opened with it or it arrived through `hashchange`, and shows a note under the mode switch (`free.newerModel`): the link was made with a newer model, and reloading opens it. **Copy settings link** copies that address. The first edit (a change in the free form, or a switch to classic) hides the note and writes the shown settings to the address as usual. A malformed `mv` gets no note: the address is rewritten to the defaults, as for any malformed payload;
  - a newer model's `TVT3-` code or link pasted into the import field is refused (`freeInputModelNewer`): nothing is applied, the current settings and address stay, and the field shows `xfer.err.newerModel` (the code was made with a newer model; reload the page, then paste it again). A pasted code with a malformed `mv` applies the defaults, like any malformed value;
  - a **Run it yourself** fragment (`#s=…&chk=…`) of such a link opens the same way, and its `chk=` snapshot is dropped (`freeCheckFromHash`), so free mode shows no reproduction check and never compares that snapshot with a run of this build's model;
  - a free result link is a `version` error with no config, so the page shows the invalid-link message and **Try your own** but not **Run it yourself**, and the link preview keeps the static text.

  Reloading loads the current build, which knows a newer version, and the kept address opens the link there.

- **Builds up to v0.2.16 have no `mv` check.** They ignore the key, so a page cached from one of them opens a newer settings link with all its values under model 1, decodes a newer free result link as valid and offers **Run it yourself** for it. Pages already in a cache cannot be changed; the rules above hold for builds from #124 on.

- `freeModelVersion(raw)` in `src/ui/share-free.ts` reads `mv` from a payload; `tests/free-model-version.test.ts` holds payloads written by the encoder before `mv` existed and checks that they decode as model 1 and re-encode byte for byte.

## Link routing

Issue #142, design R2 ([RENEWAL-1.0.md §3.1](design/RENEWAL-1.0.md#31-surfaces-and-urls)). The simulator app moved from `/` and `/en/` to the play pages `/play/` and `/en/play/`, and `/` became the lobby. Every link made before that points at `/` or `/en/`. A link that carries app state (the kinds listed below) now ends on the play page, after one extra `location.replace`, and opens the same mode, config and reproduction check as it did on `/`; the fixture tests and a browser comparison with `main` check this per link type. Two things are not the same as before. The address the app shows is `/play/…` instead of `/…`. And a lobby address without app state (no `key=value` fragment, no settings code, no `tour` parameter) now shows the lobby, where `/` used to show the app with its defaults. That covers a bare `/`, plain anchors such as `/#faq` and a `/?_r=…` reload marker without a fragment.

**Step 1: the lobby forwards.** The first thing in the lobby's `<head>` is a small inline script, identical in both languages. If the address holds app state, it calls `location.replace` to the play page of the same language with the query and fragment byte for byte unchanged. It runs before anything renders and adds no history entry. It runs again on `hashchange`, so a settings link pasted into the address bar of an open lobby tab (which changes only the fragment and does not reload) is forwarded too. An address holds app state when:

- the fragment holds a `key=value` part. This covers `#s=…` (classic v1 and v2, free v3, any model version), `#s=…&chk=…` and `#chk=…` ("Run it yourself"), and any key a later link adds;
- the fragment starts with a settings code (`#TVT2-…`, `#TVT3-…`, any case). The app never read codes from the fragment, so it opens the defaults, as it did on `/`;
- the query holds the tour deep link: a `tour` parameter with or without a value (`?tour=1`, a bare `?tour`, `?a=1&tour`), as the app's `tourRequested` accepts it. `?tourist=` and `?detour=` do not count.

Plain anchors such as `#faq` and other queries (`?utm_…`, the `?_r=` reload marker without a fragment) stay on the lobby. `playForwardUrl(pathname, search, hash)` in `src/pages/routes.ts` states the same rule in TypeScript. `tests/link-routing.test.ts` runs the real inline script from both lobbies and that function over every fixture link and requires them to agree. The script is allowed by its SHA-256 in the CSP ([DEPLOYMENT.md](DEPLOYMENT.md#rule--every-response)).

**Step 2: the play page opens the fragment.** `routeLink(hash)` in `src/ui/link-route.ts` is the pure helper the app reads its starting fragment with:

| Fragment                                                                                           | Opens                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `#s=<v3>` (`m: "free"`), with or without `&chk=`                                                   | Free mode with that config, and the free reproduction check when `chk=` validates                    |
| `#s=<v3>` of a model this build does not run                                                       | Free mode at the free defaults, `newerModel` set, so the address is kept ([`mv`](#model-version-mv)) |
| `#s=<v1 or v2>`, with or without `&chk=`; `#chk=` alone                                            | Classic with that config (the defaults for `#chk=` alone), and the classic reproduction check        |
| `#s=<v3>` with `ui: "simple"` that Simple can show, model this build runs, with or without `&chk=` | **Simple mode** with that config, and the free reproduction check when `chk=` validates (#154)       |
| no app state and no tour deep link (a cold play page)                                              | **Simple mode** at the default preset, lion vs tiger 1:1 (#146)                                      |
| a malformed payload, a settings code; `?tour` alone                                                | Classic at the defaults                                                                              |

For every link made before #154 (none carries `ui`) this is the same decision `startApp` made on `/` before #142 (free when `freeConfigFromHash` finds a v3 payload, otherwise `configFromHash(hash) ?? defaultConfig()`). It now lives in one tested function, `routeLink(hash, search)`.

**Cold play page (#146).** Only a play page with nothing to open changes: no app state in the fragment (`hashHasAppState` in `src/pages/routes.ts`, the same test the lobby forwarder applies, so `''`, `#`, `#main` or `#faq`) and no `tour` parameter (`hasTourParam`, the lobby's own query test, so `?_r=…` and `?utm_…` count as cold while `?tour=0`, which the lobby forwards, still opens classic at the defaults without the tour, as on `main`). It opens Simple mode instead of classic at the defaults, and leaves the address as it is (a plain anchor such as `#main` stays) until the first Run or **Copy settings link** (`simpleKeepsAddress`). No link the lobby forwards is cold, so every old link type opens as before; `tests/link-routing.test.ts` checks that for every fixture, through the lobby and on the play page directly, and checks the cold cases. A Simple Run writes its config, fresh seed included (R3), into the address as a v3 link with the Simple-mode marker, so that link (and a reload) opens Simple again ([Simple links](#simple-links)).

**Classic at the defaults (#158 review).** While the classic simulator is shown, the app writes `classicHashFromConfig` (`src/ui/share.ts`): the same hash as `hashFromConfig` for every config except the defaults, where that would be empty and a copied link would open Simple on a cold play page. At the defaults it writes the bare v2 payload `#s=eyJ2IjoyfQ` (`{"v":2}`), which decodes to the defaults and routes to classic like any v2 link. Links that already exist open exactly as before; only the address the app writes for classic at the defaults changed (it used to be empty), and `tests/link-routing.test.ts` checks both.

### Simple links

Issue #154, design §3.2 ("Link routing"). A link Simple mode writes reopens in Simple mode: the address after a Simple Run, **Copy settings link** while Simple is shown, the result link of a Simple run (**Share result**, **Open result page**) and that result page's **Run it yourself**.

- **The marker.** Simple mode appends `"ui":"simple"` as the last key of the v3 payload: in `#s=`, and in the `c` of a free result link. Without it the encoder writes exactly the bytes it wrote before (`freeConfigDiff(config)`), so every other link is unchanged. The design's routing table chose links by shape (keys ⊆ `v, m, mv, a{sp, n}, b{sp, n}, runs, seed`); that was rejected because it would move existing free-form links of that shape into Simple. An explicit marker changes nothing that was made before #154.
- **Not part of the config.** The decoder never reads `ui` into `FreeConfig` (`freePayloadSimple` in `src/ui/share-free.ts` reads it for routing only), so the engine, `mv`, the result snapshot and the reproduction check (`freeConfigDiff` without the marker) never see it, and a run of a marked link is bit for bit the run of the same link without it. `TVT3-` codes are written by Advanced only and never carry it, and a code or link pasted into the import field (which is in Advanced) always applies in the free form.
- **Older builds.** Every build ignores unknown keys in `c` and `#s=`. A page cached before #154 opens a marked link in the free form of Advanced mode with the same numbers, decodes a marked result link as valid, and its **Run it yourself** drops the marker. Pages already in a cache cannot be changed.
- **The one rule (`simpleCanShow` in `src/ui/simple-model.ts`).** Simple can show a config whole when it has no hidden edits (`hasHiddenEdits`: trait or buff ranges, buff switches, globals, a run count other than Simple's, arena, time limit, CV, sampling or morale; the seed and the species and counts are not hidden). The app writes the marker only while Simple mode is shown **and** `simpleCanShow` holds. `routeLink` opens Simple only when the marker is exactly `"simple"`, the payload names a model this build runs, **and** `simpleCanShow` holds for the decoded config. A marked link that fails either test opens what an unmarked link opens: the free form, or for a newer or malformed `mv` the free defaults as in [Model version](#model-version-mv). So Simple never opens a config it cannot display, and an edit only Advanced can make (then switching back to Simple and sharing) gives a link that opens the free form.
- **The seed.** A page opened in Simple from a marked link runs its first Run with the link's seed instead of a fresh one, so the link and **Run it yourself** reproduce (the note under the counts says so, `simple.linkSeedNote`). Any edit, a view change or that first Run returns to a fresh seed per Run (R3). The seed is armed only when the link was just opened (`armLinkSeed` in `src/ui/simple-model.ts`): not on a reload or a back/forward visit (`PerformanceNavigationTiming.type` `reload` or `back_forward`), whose address the page wrote itself after its last Run, so a reload after a Simple Run still draws a fresh seed; and not when the page was opened from a play page (the referrer), which is the language fallback that reloads the other language's play page when its words cannot be loaded. The in-place language switch keeps the page, and an armed seed stays armed.
- **Pasted into an open page.** A marked link pasted into the address bar of an open play page changes only the fragment (`hashchange`). It opens the same way as on load: `routeLink` decides, a Simple link shows Simple with its config (`setConfig(config, { linkSeed: true })`) and its seed armed, and the address keeps the marker. Any other link takes the path it took before.
- **Unchanged.** Turning Advanced on lands on the free form, as before. **Try your own** on the result page opens a cold `/play/`, which is Simple.

**Fixture tests.** `tests/link-routing.test.ts` holds one fixture per old link type, each opened from the Korean and the English lobby:

- classic v1 and v2 settings links;
- classic "Run it yourself" with a config and with `#chk=` alone;
- free v3 settings links written by the encoder before `mv` existed;
- free "Run it yourself" from a free `/r/` result link;
- a free link of a newer model;
- the tour deep link, alone and with a settings link;
- a malformed payload;
- a `TVT3-` code in the fragment.

For each, the test checks four things:

1. the forwarded URL is the play page with the same query and fragment;
2. `routeLink` opens the expected mode, config and check;
3. that equals the pre-#142 decision on the same fragment;
4. that equals `routeLink` on the original link.

The golden fixtures are untouched: a fragment that reaches `/play/` unchanged decodes and runs bit for bit as it did on `/`.

**What does not move.** Result links stay on `/r/?r=…` and `/en/r/?r=…`, with their Pages Function. Only their **Run it yourself** and **Try your own** links now point at the play page. A result page cached before #142 still links `/#s=…&chk=…`, which the lobby forwards. Settings codes pasted into the import field and `.json` files are unaffected. The app's language switch moves between `/play/` and `/en/play/` (`switchedAppUrl`), and `/reset/` returns to the play page (`appReturnPath`). A tab of an older build names `/` or `/en/` as its return path; the reset maps those to `/play/` and `/en/play/`, so the app opens and drops its `?_r=` marker.

## Result links

`/r/?r=<base64url(JSON { v: 1, c: { v: 2, …configDiff }, s: summary })>`. The query, not a fragment, so link-preview crawlers see it.

Summary `s`:

| Key  | Meaning                                                          | Check                                 |
| ---- | ---------------------------------------------------------------- | ------------------------------------- |
| `n`  | runs                                                             | integer, 1 ≤ n ≤ 20,000               |
| `h`  | heavy-side wins                                                  | integer ≥ 0                           |
| `p`  | pack-side wins                                                   | integer ≥ 0                           |
| `d`  | draws                                                            | integer ≥ 0, and `h + p + d === n`    |
| `t`  | mean engagement time (s), optional                               | finite, 0–3600                        |
| `hs` | mean heavy animals still standing, optional                      | finite, 0 – heavy count of `c`        |
| `pk` | mean pack animals incapacitated, optional                        | finite, 0 – pack count of `c`         |
| `ci` | 95 % Wilson intervals `[hLo, hHi, pLo, pHi, dLo, dHi]`, optional | six finite numbers in [0, 1], lo ≤ hi |

Unknown keys, a wrong `v`, `r` over 4096 characters or outside the base64url alphabet are rejected. When only `s` fails, the page still offers **Run it yourself** with the config from `c`.

The numbers are a **snapshot**: V8 and JavaScriptCore agree statistically but not run for run ([MODEL.md §2.2](MODEL.md)), so the page shows the shared numbers as they were and labels them so. **Run it yourself** opens `/play/#s=<config>&chk=<summary>` (`/en/play/` on the English page); after the person presses Run (never automatically) with unchanged settings, the app reports _exactly the same_, _reproduced within the 95 % CI_ (every shared rate inside the new run's Wilson interval) or _differs_. The `chk=` part is dropped from the address as soon as the app starts, so a reload does not repeat the check.

In the simulator, **Share result** appears under the verdict after a run: Web Share where available, otherwise the link is copied (with the fallback dialog). **Open result page** opens the same link.

### Free result links

A free result ([design §2.5](design/FREE-MATCHUPS.md#25-settings-codes-and-result-links-51)) uses `/r/?r=<base64url(JSON { v: 2, c: { v: 3, m: "free", … }, s })>` (`src/share/free-result-codec.ts`). `c` is the same payload as a free `#s=` link, `mv` included, and the Simple-mode marker when a Simple run made it ([Simple links](#simple-links)); the marker is not validated and **Run it yourself** carries it on; a `c` of a model version this build does not run is a `version` error without a config ([Model version](#model-version-mv)). Version 1 links never reach the new code: a payload whose `c` is not a free payload goes to the unchanged `decodeResult`, so classic links decode, validate and render exactly as before. A free `c` under `v: 1` is a `version` error (the page still offers **Run it yourself**).

| Key        | Meaning                                                                                          | Check                                 |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `n`        | runs                                                                                             | integer, 1 ≤ n ≤ 20,000               |
| `a`, `b`   | side A wins, side B wins                                                                         | integers ≥ 0                          |
| `d`        | draws                                                                                            | integer ≥ 0, and `a + b + d === n`    |
| `t`        | mean engagement time (s), optional                                                               | finite, 0–3600                        |
| `as`, `bs` | mean survivors per side (still standing or fled), optional                                       | finite, 0 – that side's count         |
| `ak`, `bk` | mean incapacitated per side, optional                                                            | finite, 0 – that side's count         |
| `ar`, `br` | mean fled per side, optional                                                                     | finite, 0 – that side's count         |
| `ab`, `bb` | pack buff: mean buffed share of agent-time, only for a side whose buff applies, optional         | finite, 0–1                           |
| `at`, `bt` | pack buff: median seconds with at least one buffed member, only where the buff applies, optional | finite, 0–3600                        |
| `ci`       | 95 % Wilson intervals `[aLo, aHi, bLo, bHi, dLo, dHi]`, optional                                 | six finite numbers in [0, 1], lo ≤ hi |

The buff applies to a side of a social species with two or more animals and at least one effect switched on; buff keys for any other side are rejected. The page lists per side the mean still standing, incapacitated and fled (`freeStats` in `result-text.ts`). The snapshot has no still-standing key, so the page shows `as − ar` (`bs − br`) to one decimal, clamped at 0 because `as` is rounded to two decimals and `ar` to one; that is the figure the app's still-standing card shows (#42), give or take 0.1. The format and its version stay as they are, so older links read the same way. **Run it yourself** opens `/play/#s=<v3>&chk=<summary>` in free mode, and free mode reports _same_ / _within the 95 % CI_ / _differs_ after the next Run, as for classic links.

Wording: the sides are named by species ("호랑이 1 vs 사자 1 — 호랑이 54%"). In a mirror matchup both sides carry their letter ("호랑이 A", "Tigers B"). There is no default matchup to compare with, so the tier is never _upset_ and the line beside it names the free model ("자유 대결 · 잠정 모델", plus "같은 종 대결" for a mirror); the link preview description uses that line instead of the ± points. The card draws side A on the left and side B on the right in their side colours, shape by size as in design §6 (body radius ≥ 1 m: heading triangles, else dots), and adds the pack-buff share of each buffed side to the runs line.

## Result page

`r/index.html` and `en/r/index.html` are ordinary build entries (`vite.pages.ts`) with the shared header (`<!-- site-header -->`, no nav item marked) and footer. Their script `src/share/result-page.ts` imports the sharing core, the card and `src/pages/site.ts`; it never imports the simulator engine, the worker pool or the app (`tests/result-share.test.ts` walks the import graph, and the built chunk contains no worker reference).

- Head: `noindex` (also `X-Robots-Tag` from `_headers`), canonical to `/r/` or `/en/r/` without the query, a static `og:image` (`/og-result-ko.png`, `/og-result-en.png`, rendered by `brand/render.mjs` from `brand/src/og-result.html`). Not in `INDEXABLE_ROUTES`, so absent from the sitemap and llms.txt.
- Body: winner and win % as the `<h1>`, outcome tier, ± points vs the default matchup, matchup line, a win bar (CSSOM widths, no inline style attributes), the three rates with CIs, the optional means, the snapshot note, **Run it yourself**, **Try your own** (`/play/` or `/en/play/`), the card picker and buttons **Save image**, **Share**, **Copy link**, **Share as text**.
- The language link in the header keeps the query (`/r/?r=…` ↔ `/en/r/?r=…`).
- Mobile first: no horizontal overflow at 320 px (checked with Playwright at 320, 390 and 1280 px).

## Outcome tiers

From the shares of heavy wins, pack wins and draws (`outcomeTier` in `result-text.ts`):

1. draws lead → **stalemate / 교착**
2. the winning side is not the side that wins the default matchup → **upset / 이변**
3. margin between the top two shares ≥ 60 points → **landslide / 압승**
4. margin < 20 points → **close fight / 접전**
5. otherwise → **clear edge / 우세**

The ± figure is the winner's share minus the same side's share in the default matchup, in whole points (`+12%p` / `+12 pp`).

## Default baseline

`DEFAULT_BASELINE` in `src/share/baseline.ts` is the outcome of `defaultConfig()` (10 T-Rex vs 100 tigers, 500 runs, seed 20261019): **500 / 0 / 0** heavy / pack / draws, captured with the engine in Node (V8) on 2026-10-20. It is a constant so the result page never runs the simulator. `tests/result-share.test.ts` reruns the default scenario (about 6 s) and fails if the engine changes these counts; then update the constant in the same PR.

## Result card

`src/ui/result-card.ts` draws on a canvas with a fixed light palette (brand colours from [BRANDING.md](BRANDING.md), independent of the viewer's theme):

- Formats: story 1080×1920 with a safe zone of 250 px at the top and 340 px at the bottom (platform UI), square 1080×1080. A test checks every element's y position against the safe zone.
- Content: brand mark (blue triangle, orange dot), matchup with species emoji as text, runs and mean time, an abstract formation (triangles for the heavy side, a loose cloud of dots for the pack, capped at 16 and 90), winner label, big win %, tier chip, ± vs default, win bar, legend, watermark (`trex-vs-tiger.vinylims.com` and "시뮬레이션 · 가정에 따라 다름" / "Simulation · depends on assumptions").
- Drawn graphics are abstract glyphs only. Emoji appear only inside text (owner decision on #51); the emoji font is the platform's.
- Fonts: `document.fonts.load()` for weights 500/700/800/900 of Pretendard with the card's actual text, raced against a 1.5 s timeout, because canvas text never reflows.
- The PNG is encoded once (blob and data URL) when the page or the format changes, before any click, so Web Share keeps the user activation.

Save/share chain (`src/share/share-ui.ts`):

1. In-app browsers (user agent contains `KAKAOTALK`, `Instagram`, `NAVER(inapp`, `FBAN`, `FBAV` or `Line/`): a full-screen dialog with the card as a data-URL `<img>` and "길게 눌러 저장하세요 / Long-press the image to save it". These browsers often ignore `<a download>` and lack file sharing.
2. **Share**: `navigator.canShare({ files })` → `navigator.share({ files, title, text })`; `AbortError` (the person closed the sheet) is ignored; any other failure falls through.
3. Otherwise `<a download>` with an object URL, revoked 30 s later.

The overlay uses a data URL, so the CSP `img-src 'self' data:` is unchanged. Object URLs are only used as download link targets (a navigation, not an image load), so `blob:` is not added to the CSP.

## Text share

```
🦖 T-Rex 1 vs 🐅 호랑이 100 — 500회
🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧
T-Rex 61% · 호랑이 35% · 무승부 4%
https://trex-vs-tiger.vinylims.com/r/?r=…
```

Ten cells by largest remainder (🟦 heavy, 🟧 pack, ⬜ draw). Species emoji come from `SPECIES_EMOJI`, keyed by free species id (every classic id is one too); species without one (today the woolly mammoth and _Homo erectus_) fall back to 🔷 (heavy, or side A of a free result) and 🔶 (pack, or side B). In a free result the side decides, not the species' classic role: a mammoth on side B gets 🔶 (`tests/free-result.test.ts`). Chain: Web Share (text) → clipboard → the X intent `https://x.com/intent/tweet?text=…&url=…`.

## Link preview (Pages Function)

See [ADR-0006](adr/0006-pages-function-share-previews.md) and [DEPLOYMENT.md](DEPLOYMENT.md#pages-function-r-previews). `buildMeta(search, lang)` returns the title ("T-Rex 1 vs 호랑이 100 — T-Rex 61%") and description, or null; the HTMLRewriter glue only writes them. Unit tests run the glue with a fake `HTMLRewriter`.

## Privacy

Codes, files, cards and texts are produced in the browser. Settings links keep the config in the fragment, which never reaches the server. Result links put the snapshot in the query; Cloudflare receives it with the request and the Function reads it to write the preview text. Nothing is stored or logged by the project (privacy pages, section on sharing).

## Device checks still needed (owner)

iOS Safari, Android Chrome, KakaoTalk (iOS and Android), Instagram, the Naver app and Samsung Internet: card save/share, the in-app overlay long-press, the text share sheet, and the link preview text in KakaoTalk/X/Slack after deployment.
