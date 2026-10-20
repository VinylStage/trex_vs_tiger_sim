# Branding

> **한국어 요약**
>
> - 브랜드 그림은 시뮬레이터 재생 화면을 그대로 씁니다. **파란 삼각형 = 티라노사우루스**, **주황 점 = 호랑이**, 격자와 축척 막대뿐입니다. 동물 그림, 얼굴, 발톱 자국, 피, 대결 포스터 같은 표현은 쓰지 않습니다.
> - 글꼴은 **Pretendard 하나만** 씁니다(SIL OFL 1.1). 글꼴 파일은 저장소에 넣지 않고, `node brand/render.mjs`가 처음 실행될 때 받아서 SHA-256을 확인합니다.
> - 모든 에셋(`public/`의 파비콘, 앱 아이콘, OG 이미지, 매니페스트)은 `node brand/render.mjs` 한 번으로 다시 만들어집니다. 렌더링 결과는 매번 바이트 단위로 같습니다.
> - 빌드는 글자 하나라도 Pretendard가 아닌 글꼴(예: WenQuanYi, Unifont)로 그려지거나, 제목이 칸을 넘치거나, 화면 속 개체 수가 10 대 100이 아니면 실패합니다.
> - OG 이미지에는 승률 같은 숫자를 넣지 않습니다. 지어낸 숫자는 교육용 사이트의 신뢰를 떨어뜨리고, 실제 숫자는 모델이 바뀌면 낡기 때문입니다.
> - 아이콘과 매니페스트 링크는 모든 페이지 원본에 있고, `og:image`와 `twitter:image`는 빌드가 언어별 카드로 넣습니다. 자세한 내용은 [연결 방법](#wiring)과 [SEO.md](SEO.md#head-tags)에 있습니다.

## Contents

- [Concept](#concept)
- [Palette](#palette)
- [Typography](#typography)
- [Assets](#assets)
- [Wiring](#wiring)
- [Regenerating](#regenerating)
- [What the build checks](#what-the-build-checks)
- [Do and don't](#do-and-dont)
- [Decisions](#decisions)

## Concept

The brand is the simulator's own replay. Everything is drawn with the replay's glyphs:

| Glyph                   | Meaning              |
| ----------------------- | -------------------- |
| Blue oriented triangle  | One _T. rex_ agent   |
| Orange dot              | One tiger agent      |
| Hollow orange ring      | A recovering tiger   |
| Grid, scale bar, `t = ` | The arena and timing |

**OG card (1200×630).** The left column holds the title in two lines, set large: `티렉스 / 대 호랑이` on the Korean card and `T-Rex / vs Tiger` on the English one. The connective word (`대`, `vs`) is smaller and grey, so the two names carry the line. Under the title come a blue/orange two-segment rule, the subtitle (`몬테카를로 전투 시뮬레이션` / `Monte Carlo battle simulator`) and a legend that names the two glyphs. The domain and the icon sit at the top. The right column is a white replay panel showing one frame of the default scenario: 10 T-Rex in a bowed line, and 100 tigers using the default 측면 포위 (flank) tactic. The tigers wrap around both ends of the line toward its rear, with only a few in front. The upper flank is denser than the lower one, so the swarm never closes into a letter shape. The panel also has a HUD (time, ▶10 ●100) and a 100 m scale bar on the default 600 m arena. A 1 px hairline frames the card so the pale paper stays separate from white chat UIs. A thin blue/orange band runs along the bottom edge, so the team colours still show in a 300 px preview.

**Icon.** A dark arena tile with two blue triangles facing a loose group of orange dots. The SVG holds two drawings and picks one with a media query:

- **40 px and below** (tabs, bookmarks, `favicon.ico` 16/32): two triangles and three dots. On the 64-unit grid, 4 units = 1 px at 16×16, and each dot is snapped to a clean 3 px disc.
- **Above 40 px**: the arena grid, two triangles and five dots.

A 1 CSS px `#3b3b38` edge keeps the tile visible on dark tab strips such as Chrome's `#202124`.

## Palette

All values are the site tokens from `src/ui/styles.css`, plus one darker text tone for the OG subtitle.

| Role                                   | Hex       | Used in                                                  |
| -------------------------------------- | --------- | -------------------------------------------------------- |
| Paper (`--bg`, light)                  | `#f7f6f3` | OG background, manifest `background_color`/`theme_color` |
| Surface (`--surface`, light)           | `#ffffff` | OG replay panel                                          |
| Ink (`--fg`, light)                    | `#1b1b1a` | OG title and legend, icon tile                           |
| Muted (`--muted`, light)               | `#5f5e5a` | Connective `대`/`vs`, domain, HUD                        |
| Subtitle                               | `#45443f` | OG subtitle (darker than muted so it reads at 300 px)    |
| Border (`--border`, light)             | `#d9d8d2` | OG hairline frame, replay panel border                   |
| Grid (`--grid`, light)                 | `#e3e2de` | Replay grid                                              |
| Draw (`--c-draw`)                      | `#8d8c87` | Scale bar                                                |
| T-Rex (`--c-trex`, light)              | `#2a78d6` | OG triangles, rule, bottom band                          |
| T-Rex (`--c-trex`, dark)               | `#3987e5` | Icon triangles (they sit on the dark tile)               |
| Tiger (`--c-tiger`, light)             | `#eb6834` | Dots everywhere, rule, bottom band                       |
| Icon edge (`--border`, dark)           | `#3b3b38` | 1 px icon outline                                        |
| Crosshair dots (OG background texture) | `#c9c8c2` | Faint background grid, faded out behind the title        |

## Typography

**Pretendard 1.3.9 is the only typeface** in every asset, for Hangul and Latin alike ([ADR-0005](adr/0005-self-hosted-pretendard.md) makes the same rule for the site).

| Text                     | Weight        | Size / tracking                                                                       |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------- |
| OG title                 | Black 900     | 136 px, line-height 1.0, −0.035em (ko) / −0.03em (en); optical kerning on `T-Rex`     |
| Connective `대` / `vs`   | ExtraBold 800 | 0.7em of the title, `#5f5e5a`, gap after it 0.2em (ko) / 0.14em (en), shared baseline |
| OG subtitle              | Bold 700      | 40 px, −0.02em                                                                        |
| OG legend                | Bold 700      | 26 px                                                                                 |
| Domain, HUD, scale label | SemiBold 600  | 24 px (domain), 18 px (HUD)                                                           |
| Contact sheet captions   | Medium 500    | Review sheet only, not shipped                                                        |

The title, subtitle, legend and domain are placed by their **ink edge**, not their em box. The first glyph's side bearing is measured with canvas `measureText`, so every left edge lines up with the 40 px icon at x = 76.

**Licence.** Pretendard is licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/). Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name "Pretendard". The full text ships with the site's font files in `src/assets/fonts/pretendard/LICENSE.txt`. The OFL allows the font to be used in rendered images. The font files are not committed for the brand pipeline; the PNGs contain only rendered pixels.

**Source.** `brand/render.mjs` downloads the static OTFs (Medium, SemiBold, Bold, ExtraBold, Black) into `brand/.cache/fonts/`, which git ignores, and checks each file against a pinned SHA-256:

- Primary: `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-<Weight>.otf`
- Fallback: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-<Weight>.otf`
- Project: <https://github.com/orioncactus/pretendard>

`cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/...` without `packages/pretendard/` returns 404.

## Assets

Everything in this table is generated by `node brand/render.mjs`. Do not edit the files by hand.

Exception: the header logo is `public/header-logo.svg`, the original v0.1.0 icon (two-tone tile with a white triangle and stripes), kept by the owner's choice. It is a hand-written SVG, not generated, and it is the logo of **every page's header**: the app header (`src/ui/app.ts`, 40 px), the static head of `index.html` and `en/index.html` (40 px), and the header of every content page and both 404 pages (32 px). All of them take it from one constant, `SITE_LOGO` in `src/pages/site-header.ts`; the page sources only hold placeholders the build fills ([PAGES.md](PAGES.md#site-header)), and `tests/pages.test.ts` fails if any page shows another logo. The favicon (`<link rel="icon">`), app icons and OG cards stay on the generated set.

| File                           | Size             | What it is                                                                                                                                                                 | Referenced from                                                                            |
| ------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `public/favicon.svg`           | 1.2 KB           | Vector icon, 64-unit grid, small/large variants via `@media (max-width: 40px)`                                                                                             | `<link rel="icon">` on every page (not the header logo); OG brand row; manifest            |
| `public/favicon.ico`           | 14 KB            | 16, 32 (small variant) and 48 px (large variant) BMP frames, no resampling                                                                                                 | Requested at `/favicon.ico` by crawlers and browsers that skip SVG icons                   |
| `public/apple-touch-icon.png`  | 180×180, 5 KB    | Full-bleed square, large variant, no rounded corners (iOS applies its own mask)                                                                                            | `<link rel="apple-touch-icon">` on every page                                              |
| `public/icon-192.png`          | 192×192, 8 KB    | Rounded tile, transparent corners                                                                                                                                          | `site.webmanifest` (`purpose: any`)                                                        |
| `public/icon-512.png`          | 512×512, 22 KB   | Rounded tile, transparent corners                                                                                                                                          | `site.webmanifest` (`purpose: any`)                                                        |
| `public/icon-maskable-512.png` | 512×512, 11 KB   | Full-bleed tile and grid; glyphs scaled to 0.72 so they stay inside the 80 % safe zone                                                                                     | `site.webmanifest` (`purpose: maskable`)                                                   |
| `public/og-image-ko.png`       | 1200×630, 120 KB | Korean social card                                                                                                                                                         | `og:image`/`twitter:image` of Korean pages (generated)                                     |
| `public/og-image-en.png`       | 1200×630, 129 KB | English social card                                                                                                                                                        | `og:image`/`twitter:image` of English pages (generated)                                    |
| `public/og-result-ko.png`      | 1200×630, 52 KB  | Korean result-link card: title 시뮬레이션 / 결과 공유, abstract glyph panel and win bar, no numbers                                                                        | `og:image` of `/r/` ([SHARING.md](SHARING.md)); the same for every result link (generated) |
| `public/og-result-en.png`      | 1200×630, 56 KB  | English result-link card (Simulation / result)                                                                                                                             | `og:image` of `/en/r/` (generated)                                                         |
| `public/site.webmanifest`      | 1 KB             | Name `티렉스 대 호랑이`, short name `티렉스대호랑이`, Korean description (`lang: ko` covers name, short name and description), `start_url: /`, `standalone`, paper colours | `<link rel="manifest">` on every page                                                      |

Sources in `brand/`:

| File                       | Role                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `brand/render.mjs`         | Entry point: fonts, icon SVGs, Chromium rasters, checks, packing, contact sheet          |
| `brand/pack.py`            | Pillow: `optimize=True` PNGs, `favicon.ico` from the hand-tuned frames, 300 KB OG limit  |
| `brand/src/mark.mjs`       | Single source of the icon geometry (favicon, square and maskable variants)               |
| `brand/src/og.html`        | OG card (`?lang=ko` / `?lang=en`); the replay frame comes from a seeded PRNG             |
| `brand/src/og-result.html` | Result-link card (`?lang=ko` / `?lang=en`); static, deterministic glyph panel            |
| `brand/src/fonts.css`      | `@font-face` rules for the downloaded Pretendard files (private family name)             |
| `brand/src/sheet.html`     | Review contact sheet: chat previews at 600/300 px, icons at 16–512 px, tab strips, masks |
| `brand/src/raster.html`    | Blank page used to rasterise SVGs through `<img>`, the same path a favicon takes         |

## Wiring

Every page source (both app entries, all content pages and the 404 pages) has `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` and `<link rel="manifest" href="/site.webmanifest">` in its static head; `tests/pages.test.ts` checks them. `favicon.ico` is not linked: browsers and crawlers that skip SVG icons request `/favicon.ico` on their own.

The social cards are not hand-written. The build (`vite.seo.ts`) adds `og:image` (absolute URL), `og:image:type`, `og:image:width`/`height` (1200×630), `og:image:alt`, `twitter:card` = `summary_large_image`, `twitter:image` and `twitter:image:alt` to every indexable page: `og-image-ko.png` on Korean pages, `og-image-en.png` on English ones. File names and alt texts live in `OG_IMAGE` in `src/seo/site.ts`; details in [SEO.md](SEO.md#head-tags). If a card changes, give it a new file name, because Facebook and Kakao cache by image URL. The CSP needs no change, because every file is same-origin.

## Regenerating

Requirements: Node 22+, Python 3 with Pillow, and Playwright with its Chromium build. Playwright is deliberately **not** a project dependency, so `npm ci` stays small.

```sh
# once, if Playwright is not installed yet
npm i --no-save playwright && npx playwright install chromium
python3 -m pip install Pillow

# regenerate every file in public/ listed above
node brand/render.mjs

# also copy the review contact sheet somewhere
node brand/render.mjs --preview /tmp/brand-preview.png

# use an existing Playwright install instead
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs node brand/render.mjs
```

`PYTHON` picks another Python interpreter. The contact sheet is always written to `brand/.cache/preview.png`. With the same Chromium build, the output is byte-identical between runs, because the replay frame uses a seeded PRNG.

## What the build checks

`node brand/render.mjs` stops with an error when any of these fails:

1. **Font files.** Each OTF must match its pinned SHA-256.
2. **Every glyph is Pretendard.** For every element on the OG cards and the contact sheet, Chrome DevTools Protocol `CSS.getPlatformFontsForNode` must report only the downloaded `Pretendard-{Medium,SemiBold,Bold,ExtraBold,Black}` custom fonts. Elements that contain Hangul are checked again on their own. Known fallback faces such as WenQuanYi Zen Hei, Unifont and Noto are rejected by name. `document.fonts.check` must pass for every loaded weight.
3. **Layout.** The title lines, subtitle, legend and domain must:
   - stay inside the 560 px text column, at least 24 px clear of the replay panel and above the bottom band;
   - have their ink start at x = 76 ± 0.75 px.
4. **Honest HUD.** The replay frame must contain exactly 10 T-Rex and 100 tigers, the counts it prints.
5. **Packing.** Each OG PNG must be 300 KB or smaller, and `favicon.ico` must have exactly the 16, 32 and 48 px frames.

## Do and don't

**Do**

- Draw only with the replay's glyphs (triangles, dots, rings), grids and scale bars, in the palette above.
- Set every text in Pretendard, using the weights in the typography table.
- Keep the titles exact: `티렉스 대 호랑이` and `T-Rex vs Tiger`.
- Keep the counts and labels true to the default scenario (10 vs 100, 600 m arena, flank tactic).
- Check new artwork at 300 px wide and the icon at 16×16, on both light and dark backgrounds (`brand/.cache/preview.png`).

**Don't**

- No animal illustration of any kind: no silhouettes, heads, skulls, faces, eyes, ears, teeth, paw prints or stripes on a body.
- No blood, wounds, death markers (the replay's ✕ stays in the app), claw-scratch streaks, or weapons.
- No fighting-game or versus-poster language, such as slanted splits, lightning, explosions or "VS" badges.
- No made-up statistics: no win probabilities, confidence intervals or rankings on brand assets.
- No other typeface, and no system-font fallback.
- No rounded corners baked into `apple-touch-icon.png`, and nothing important outside the safe zone of the maskable icon.

## Decisions

- **No numbers on the card.** An earlier draft showed a win-probability bar with an invented 50 % estimate and 95 % CI. That bar was removed. A made-up result undermines an educational simulator. A real result depends on the model version and the run count, so it would go stale on a static image. The two-segment rule and the bottom band carry the team colours instead.
- **Glyphs, not animals.** The site applies for Google AdSense and is meant to be scientific and playful. Abstract replay glyphs keep the brand clear of violent imagery, and they match what the visitor sees in the app.
- **Small icon variant.** At 16 px, five dots merge into one blob. The small variant uses three snapped dots instead, so "blue triangles vs an orange group" still reads.
