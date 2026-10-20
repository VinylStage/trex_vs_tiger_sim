# Sharing: settings codes, result links, result cards

Issue #51. Three ways to hand something on, all generated in the browser:

| What                   | Form                                                                       | Carries                  | Code                                                                                  |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Settings link          | `/#s=<payload>` (existing, [ADR-0003](adr/0003-no-backend-url-sharing.md)) | config incl. seed        | `src/ui/share.ts`                                                                     |
| Settings code / file   | `TVT2-<payload>` or a `.json` file                                         | config incl. seed        | `src/share/config-code.ts`, `src/ui/config-transfer.ts`                               |
| Result link            | `/r/?r=<base64url>` and `/en/r/?r=…`                                       | config + result snapshot | `src/share/result-codec.ts`, `src/share/result-page.ts`                               |
| Result card            | PNG, 1080×1920 story or 1080×1080 square                                   | rendered snapshot        | `src/ui/result-card.ts`                                                               |
| Text share             | Wordle-style emoji text                                                    | snapshot + result link   | `src/share/result-text.ts`                                                            |
| Link preview (crawler) | rewritten `og:*` / `twitter:*` text on `/r/`                               | snapshot text            | `src/share/result-function.ts`, [ADR-0006](adr/0006-pages-function-share-previews.md) |

The DOM-free core (`config-code.ts`, `result-codec.ts`, `result-text.ts`, `messages.ts`, `baseline.ts`) is shared by the simulator, the result page and the Pages Function, so all three accept and describe exactly the same links. Strings for these features live in `src/share/messages.ts` (ko/en), not in `src/ui/i18n.ts`, so the Function and the result page get only what they need; species names still come from the main dictionaries.

## Config code

- Code: `TVT2-` + the same payload as `#s=` (`encodeConfig`). `TVT2-` alone is the defaults. The prefix is matched case-insensitively.
- The paste field accepts a code, a full URL with `#s=` (other fragment parts such as `chk=` are ignored; a URL without `s=` is rejected), or a bare payload.
- Validation order: length (≤ 8192) → base64url alphabet → `JSON.parse` → v1 upgrade (`upgradeV1`) → `sanitizeConfig`, through `configFromObject` in `src/ui/share.ts`, the same path as `#s=` links.
- `.json` file: `{ "app": "trex-vs-tiger", "kind": "config", "v": 2, "config": <configDiff>, "exportedAt": "<ISO time>" }`, saved through `<a download>` with an object URL, loaded with `file.text()`. Files over 64 KB are rejected before reading; `v` < 2 means v1 names inside `config`.
- An import is shown as a preview (matchup, runs, seed, number of edited ranges) and applied only on **Apply**. It never starts a run.
- Clipboard failures (no API, denied permission, insecure context) open a dialog with the text selected in a read-only field. The existing **Copy settings link** button (formerly "Copy link") uses the same fallback.

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

The numbers are a **snapshot**: V8 and JavaScriptCore agree statistically but not run for run ([MODEL.md §2.2](MODEL.md)), so the page shows the shared numbers as they were and labels them so. **Run it yourself** opens `/#s=<config>&chk=<summary>`; after the person presses Run (never automatically) with unchanged settings, the app reports _exactly the same_, _reproduced within the 95 % CI_ (every shared rate inside the new run's Wilson interval) or _differs_. The `chk=` part is dropped from the address as soon as the app starts, so a reload does not repeat the check.

In the simulator, **Share result** appears under the verdict after a run: Web Share where available, otherwise the link is copied (with the fallback dialog). **Open result page** opens the same link.

## Result page

`r/index.html` and `en/r/index.html` are ordinary build entries (`vite.pages.ts`) with the shared header (`<!-- site-header -->`, no nav item marked) and footer. Their script `src/share/result-page.ts` imports the sharing core, the card and `src/pages/site.ts`; it never imports the simulator engine, the worker pool or the app (`tests/result-share.test.ts` walks the import graph, and the built chunk contains no worker reference).

- Head: `noindex` (also `X-Robots-Tag` from `_headers`), canonical to `/r/` or `/en/r/` without the query, a static `og:image` (`/og-result-ko.png`, `/og-result-en.png`, rendered by `brand/render.mjs` from `brand/src/og-result.html`). Not in `INDEXABLE_ROUTES`, so absent from the sitemap and llms.txt.
- Body: winner and win % as the `<h1>`, outcome tier, ± points vs the default matchup, matchup line, a win bar (CSSOM widths, no inline style attributes), the three rates with CIs, the optional means, the snapshot note, **Run it yourself**, **Try your own** (`/` or `/en/`), the card picker and buttons **Save image**, **Share**, **Copy link**, **Share as text**.
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

Ten cells by largest remainder (🟦 heavy, 🟧 pack, ⬜ draw). Species emoji come from `SPECIES_EMOJI`; species without one (for example new rosters) fall back to 🔷 (heavy) and 🔶 (pack). Chain: Web Share (text) → clipboard → the X intent `https://x.com/intent/tweet?text=…&url=…`.

## Link preview (Pages Function)

See [ADR-0006](adr/0006-pages-function-share-previews.md) and [DEPLOYMENT.md](DEPLOYMENT.md#pages-function-r-previews). `buildMeta(search, lang)` returns the title ("T-Rex 1 vs 호랑이 100 — T-Rex 61%") and description, or null; the HTMLRewriter glue only writes them. Unit tests run the glue with a fake `HTMLRewriter`.

## Privacy

Codes, files, cards and texts are produced in the browser. Settings links keep the config in the fragment, which never reaches the server. Result links put the snapshot in the query; Cloudflare receives it with the request and the Function reads it to write the preview text. Nothing is stored or logged by the project (privacy pages, section on sharing).

## Device checks still needed (owner)

iOS Safari, Android Chrome, KakaoTalk (iOS and Android), Instagram, the Naver app and Samsung Internet: card save/share, the in-app overlay long-press, the text share sheet, and the link preview text in KakaoTalk/X/Slack after deployment.
