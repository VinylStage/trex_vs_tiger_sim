# Static content pages

> **한국어 요약**
>
> - 시뮬레이터(`/`) 외에 검색엔진이 읽을 수 있는 정적 안내 페이지 5종을 한국어(`/<page>/`)와 영어(`/en/<page>/`)로 제공합니다: 사용 방법, 모델 설명, 파라미터 설명, 소개 · 문의, 개인정보처리방침.
> - 페이지는 손으로 쓴 HTML입니다(`<page>/index.html`, `en/<page>/index.html`). Vite가 저장소 안의 모든 `index.html`을 자동으로 찾아 빌드하므로, 새 페이지는 설정 변경 없이 폴더와 `index.html`만 추가하면 됩니다.
> - 공통 스타일은 `src/pages/site.css`(앱과 같은 색 토큰, 다크 모드, 인쇄용), 공통 스크립트는 `src/pages/site.ts`(현재 메뉴 표시, 언어 링크 유지)입니다. 인라인 스크립트·스타일은 쓰지 않습니다(CSP).
> - 글꼴은 앱과 같은 자체 호스팅 Pretendard입니다. `site.ts`가 앱과 같은 `@font-face` 스타일시트를 불러오므로 빌드 결과에서 앱과 페이지가 파일 하나를 함께 씁니다.
> - 접근성: 본문 크기 글자는 양쪽 테마에서 명도 대비 4.5:1 이상([색 대비](#colour-contrast)), 가로로 스크롤되는 표는 키보드로 초점을 옮겨 스크롤할 수 있습니다.
> - 앱에서 쓸 메뉴는 `src/ui/site-nav.ts`의 `createSiteNav(lang)`이 만듭니다.
> - `tests/pages.test.ts`가 파라미터 값, 시나리오 설정, 엔진 상수를 코드와 대조하고, 제목·설명·canonical·hreflang, 메뉴, 링크, CSP, `_headers`, 사이트맵, 색 토큰을 검사합니다. 코드 값을 바꾸면 이 테스트가 페이지 수정이 필요한 곳을 알려 줍니다.
> - 나중에 Google AdSense를 붙일 때 바꿔야 할 곳은 [AdSense 준비](#adsense-readiness)에 정리했습니다.

## Contents

- [Pages](#pages)
- [URL scheme and languages](#url-scheme-and-languages)
- [Files](#files)
- [How the build finds pages](#how-the-build-finds-pages)
- [Adding a page](#adding-a-page)
- [Writing and markup rules](#writing-and-markup-rules)
- [Colour contrast](#colour-contrast)
- [Fonts](#fonts)
- [SEO](#seo)
- [AdSense readiness](#adsense-readiness)
- [Drift guard](#drift-guard)
- [Mounting the site navigation in the app](#mounting-the-site-navigation-in-the-app)

## Pages

| Page id      | Korean         | English           | Content                                                                                                               |
| ------------ | -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `simulator`  | `/`            | `/` (client-side) | The app itself (`index.html`); not a content page                                                                     |
| `guide`      | `/guide/`      | `/en/guide/`      | Step-by-step use of the simulator, reading results, sharing, a three-experiment tutorial, FAQ, troubleshooting        |
| `model`      | `/model/`      | `/en/model/`      | Plain-language model description: Monte Carlo design, agent rules, outcomes, statistics, reproducibility, limitations |
| `parameters` | `/parameters/` | `/en/parameters/` | One card per parameter in `src/sim/params.ts`, every scenario setting, the engine constants                           |
| `about`      | `/about/`      | `/en/about/`      | Purpose, what it teaches, educational disclaimer, how it is built, open source, contact via GitHub issues             |
| `privacy`    | `/privacy/`    | `/en/privacy/`    | Privacy policy (effective 2026-10-19): no own cookies, `trexsim.lang` in localStorage, Cloudflare cookies and logs    |

The registry is `CONTENT_PAGES` in `src/pages/routes.ts`. The header navigation (`NAV_PAGES`) is simulator · guide · model · parameters · about; privacy and about are also linked from every footer.

## URL scheme and languages

- Korean is the default language: `/<page>/`. English lives under `/en/<page>/`. The simulator is `/` in both languages because it switches language client-side.
- Every page carries `<link rel="canonical">` to its own URL on the production domain `https://trex-vs-tiger.vinylims.com`, so `*.pages.dev` copies (production alias and previews) consolidate onto it.
- Every page carries `hreflang` alternates `ko`, `en` and `x-default` (= Korean).
- The header's language link (`a[data-lang-switch]`) points to the counterpart page. Both languages use the **same section ids**, so `site.ts` can keep the reader's place (`/guide/#share` ↔ `/en/guide/#share`).
- Links from a page to the simulator (`/`) make the app open in the language being read: `site.ts` writes `trexsim.lang` (the same localStorage key `src/ui/i18n.ts` uses) when such a link is clicked.
- Cloudflare Pages serves `<dir>/index.html` at `/<dir>/` and redirects `/<dir>` and `/<dir>/index.html` there.

## Files

| File                                        | Role                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<page>/index.html`, `en/<page>/index.html` | The pages: complete, crawlable HTML with head metadata, shared header/nav, `<main>` article and footer                                                                                                                                                                                                  |
| `src/pages/site.css`                        | Shared stylesheet. Its `:root` tokens mirror `src/ui/styles.css` (light and dark); responsive; print rules. Imports `src/ui/site-nav.css`                                                                                                                                                               |
| `src/pages/site.ts`                         | Imports the self-hosted Pretendard stylesheet (see [Fonts](#fonts)). Otherwise progressive enhancement only: `aria-current` on the nav, language link keeps the `#hash`, remembers the language for the simulator. Never imports `i18n.ts` at run time (it would pull the dictionaries into every page) |
| `src/pages/routes.ts`                       | DOM-free page registry and path helpers (`pagePath`, `parsePagePath`, `counterpartPath`, `canonicalUrl`), `SITE_ORIGIN`, `LANG_STORAGE_KEY`                                                                                                                                                             |
| `src/ui/site-nav.ts`, `src/ui/site-nav.css` | `createSiteNav(lang, current?)` for the app, and the pure `siteNavItems()` the tests compare the static navs against                                                                                                                                                                                    |
| `vite.pages.ts`                             | `findHtmlEntries(root)`: the build input map                                                                                                                                                                                                                                                            |
| `public/robots.txt`                         | Allow all; points at the sitemap                                                                                                                                                                                                                                                                        |
| `public/sitemap.xml`                        | The app and every page, with `xhtml:link` hreflang alternates                                                                                                                                                                                                                                           |
| `public/_headers` rule `/*/`                | `Cache-Control: no-cache, no-transform` on every directory-style page (see [DEPLOYMENT.md](DEPLOYMENT.md#rule--content-pages))                                                                                                                                                                          |

## How the build finds pages

`vite.config.ts` passes `findHtmlEntries(root)` to `build.rolldownOptions.input` (Vite 8's name for `rollupOptions`). It walks the repository and returns every `index.html`, skipping `node_modules`, `dist`, `coverage`, `public` (copied verbatim by Vite) and every dot-directory (`.git`, `.claude`, `.github`, …). The root page keeps the key `index`, so the app's assets stay `assets/index-<hash>.*`; nested pages use their directory with `/` → `-` (`en/guide` → `en-guide`).

`base: './'` makes every asset URL relative to its HTML file. Vite rewrites them per page: `./assets/…` for `/`, `../assets/…` for `/guide/`, `../../assets/…` for `/en/guide/`. All pages share one `assets/site-<hash>.js` (about 1 KiB) and one `assets/site-<hash>.css`. Code and styles used by both the app and the pages (the route table in `src/pages/routes.ts` and the Pretendard `@font-face` stylesheet) land in one shared chunk that every page including the app links; the bundler names it after its first module, currently `assets/routes-<hash>.js` and `assets/routes-<hash>.css` (see [Fonts](#fonts)). Internal links between pages are root-relative (`/guide/`), which is correct on production and on every preview, because Pages always serves the site at the root of its hostname.

`build.modulePreload.polyfill` is off: with several entries Vite would otherwise split its preload polyfill into a separate shared chunk, adding a request to the app for code neither entry needs (neither has preloadable chunks).

## Adding a page

**A content page in both languages** (e.g. a FAQ):

1. Add its id to `CONTENT_PAGES` in `src/pages/routes.ts`. If it belongs in the header, also add it to `NAV_PAGES`, to `NAV_LABEL_KEYS` in `src/ui/site-nav.ts` and a `nav.<id>` key to both dictionaries in `src/ui/i18n.ts`, and add the link to the nav of every page.
2. Copy an existing pair (for example `about/index.html` and `en/about/index.html`) to `<id>/index.html` and `en/<id>/index.html`. Update `<title>`, the meta description, canonical, the three `hreflang` alternates, `og:*`/`twitter:*`, the language link and the content. Keep section ids identical in both languages.
3. Add both URLs to `public/sitemap.xml` with their alternates.
4. Run `npm run check`. `tests/pages.test.ts` lists anything missing or inconsistent.

**A utility page** (e.g. a future `reset/index.html`): just create the directory and its `index.html`. The build picks it up, the `/*/` header rule covers it, and the CSP checks in `tests/pages.test.ts` run on it automatically. Add `<meta name="robots" content="noindex" />` and leave it out of the sitemap if it should not appear in search results.

## Writing and markup rules

- **CSP**: no inline `<script>` (every script has `src`), no `<style>` blocks, no `style=` attributes, no `on*=` handlers, no `javascript:` URLs. Link the shared files exactly as the existing pages do: `<link rel="stylesheet" href="/src/pages/site.css" />` and `<script type="module" src="/src/pages/site.ts"></script>`.
- **Semantics**: `header` → `nav.site-nav` → `main#main` → `article.page` (`header.page-head` with one `h1`, `nav.toc`, `div.page-body` of `section`s with `h2`/`h3`) → `footer`. Tables get `thead`/`th scope`.
- **Tables**: every `<table>` sits in `<div class="table-wrap" role="region" tabindex="0" aria-labelledby="caption-<name>">` and has `<caption id="caption-<name>">`. The wrapper scrolls sideways on narrow screens so the page itself never does; `tabindex="0"` lets keyboard users focus the region and scroll it with the arrow keys (Safari never makes scroll containers focusable on its own; WCAG 2.1.1), and the caption gives the region and the table an accessible name. `.table-wrap:focus-visible` draws the focus ring. Use the same caption ids in both languages.
- **Numbers that come from code** use `<data data-k="…" value="…">shown</data>`; the test compares both the `value` and the shown text with the code. Parameter cards are `section.param#param-<id>[data-param][data-unit]`, settings `section.setting#setting-<key>[data-setting]`, constants `tr[data-constant]`.
- **Content**: write natural Korean and English (not word-for-word translation), keep claims consistent with `docs/MODEL.md` and `src/sim`, avoid describing UI details that are likely to change, and update the "last updated" date when a page changes materially. Korean uses `word-break: keep-all` so words are not split.
- **Colour**: use the page colour roles for accent text and filled controls, not `--accent` (see [Colour contrast](#colour-contrast)).
- Format with Prettier (`npx prettier --write <file>`); `npm run format:check` covers HTML.

## Colour contrast

All page text is normal size, so WCAG 2.x AA needs a contrast ratio of at least **4.5:1**. The app's `--accent` (`#2a78d6` light, `#3987e5` dark) does not reach that as a text colour on the page background (4.09:1) or under white text (4.42:1 light, 3.64:1 dark). `site.css` therefore defines page-only colour roles in a top-level `html { }` block. They are not app tokens, so they stay out of the mirrored `:root` blocks:

| Role                  | Value                                        | Used for                                             |
| --------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `--accent-text`       | `var(--accent-hover)`: `#256abf` / `#5598e7` | Links, eyebrow, parameter chips, TOC hover           |
| `--accent-fill`       | `#256abf` (both themes)                      | Background of the button, skip link and step numbers |
| `--accent-fill-hover` | `#1d5aa6` (both themes)                      | Button hover                                         |
| `--accent-fill-fg`    | `var(--accent-fg)`: `#ffffff`                | Text on the filled controls                          |

Links inside `.warning` boxes use `--warn-fg` (underlined, thicker underline on hover). Link hover switches to `--fg`. `--accent` itself is kept for non-text decoration (formula border, current-nav underline, focus ring via `--focus`).

Checked pairs (light / dark), computed with the WCAG 2.x formula:

| Text on background                          | Where                                       | Light   | Dark    |
| ------------------------------------------- | ------------------------------------------- | ------- | ------- |
| `--fg` on `--bg`                            | Body text                                   | 15.95:1 | 16.03:1 |
| `--muted` on `--surface-2`                  | Tags (lowest muted pair)                    | 5.69:1  | 6.27:1  |
| `--accent-text` on `--bg`                   | Links, eyebrow                              | 4.99:1  | 6.17:1  |
| `--accent-text` on `--surface`              | Links in cards and notes, parameter chips   | 5.39:1  | 5.65:1  |
| `--accent-text` on `--surface-2`            | Code inside links                           | 4.73:1  | 5.01:1  |
| `--accent-fill-fg` on `--accent-fill`       | Button, skip link, step numbers             | 5.39:1  | 5.39:1  |
| `--accent-fill-fg` on `--accent-fill-hover` | Button hover                                | 6.85:1  | 6.85:1  |
| `--warn-fg` on `--warn-bg`                  | Warning text and its links, speculative tag | 7.87:1  | 10.53:1 |

`tests/pages.test.ts` resolves these pairs from `site.css` (light and dark tokens plus the `html { }` roles) and fails below 4.5:1, so a token change in the app that breaks contrast on the pages is caught. When you add a rule that puts text on a new background, add the pair to `PAIRS` in that test.

## Fonts

The pages use the same typeface as the app: self-hosted **Pretendard** ([ADR-0005](adr/0005-self-hosted-pretendard.md)). `site.ts` imports `src/assets/fonts/pretendard/pretendard-variable-dynamic-subset.css`, the file `src/main.ts` also imports, and `site.css` mirrors the app's `--font-sans` stack (the token mirror test covers it). Because both entries import the same stylesheet, the build emits it once, in the shared chunk's CSS file (currently `assets/routes-<hash>.css`), and links it from every page's HTML, so it applies without JavaScript and is cached once for the whole site. The font files are same-origin, which `font-src 'self'` allows.

Each `@font-face` rule covers a `unicode-range`, so a browser downloads only the subsets whose characters appear on the page. `font-display: swap` shows text at once in the fallback stack (`-apple-system`, `system-ui`, `Apple SD Gothic Neo`, `Noto Sans KR`, `Malgun Gothic`, …) and swaps in Pretendard when it arrives. That swap can reflow text once on a first visit, because the fallback fonts have slightly different metrics; later page views hit the immutable `assets/` cache and render in Pretendard straight away.

## SEO

- Unique, descriptive `<title>` (`<topic> | <site name>`) and meta description (50–320 characters) per page; the tests enforce uniqueness.
- Canonical + `hreflang` (`ko`, `en`, `x-default`) on every page and in the sitemap; `og:locale` / `og:locale:alternate`.
- `robots.txt` allows everything and names the sitemap. Submit `https://trex-vs-tiger.vinylims.com/sitemap.xml` in Google Search Console after deployment.
- Pages are complete HTML without JavaScript (the no-JS render is verified in the browser check), load one small stylesheet, the shared font stylesheet and a 1 KiB script, and reserve image sizes (`width`/`height`). The only possible layout shift is the one-time font swap described in [Fonts](#fonts).

## AdSense readiness

No ad code is included yet. The pages were written with an AdSense review in mind: substantial original content on every page, an about/contact page, a privacy policy, clear navigation and no thin or auto-generated pages. When ads are added, change all of the following in the same PR:

1. **Privacy policy** (both languages): name Google as a third-party vendor, describe its cookies and personalised-ads choices, link Google's policy, add a consent mechanism (certified CMP) for EEA/UK/Switzerland visitors, and bump the effective date.
2. **About page**: the statements “no third-party scripts” / “외부 라이브러리 없음 … 다른 회사의 스크립트를 불러오지 않습니다” and “no analytics” must be revised.
3. **CSP** in `public/_headers` and [DEPLOYMENT.md](DEPLOYMENT.md): AdSense needs additional `script-src`, `img-src`, `frame-src`, `connect-src` origins; the inline bootstrap snippet AdSense suggests is not allowed under this CSP, so load it from a same-origin file or use a nonce-free integration.
4. **`public/ads.txt`** with the publisher line.
5. **Layout**: reserve fixed-size ad slots in `site.css` so ads cause no layout shift; keep ads out of the navigation and away from the simulator controls.
6. **Tests**: `tests/pages.test.ts` forbids inline scripts; keep it that way and extend the allow-list deliberately.

## Drift guard

`tests/pages.test.ts` reads the HTML sources and fails when:

- a parameter in `src/sim/params.ts` is missing, extra, or its unit, min/mode/max, bounds or individual-variation flag differ (values and visible numbers); the card heading must contain the app's i18n label;
- a scenario setting's default, limits or options differ from `defaultConfig()`, `LIMITS`, `SAMPLING_METHODS`, `TIGER_TACTICS`, or the work budget from `MAX_WORK`; an engine constant differs from `CONSTANTS`/`DT`;
- any page lacks a title, description, canonical, the three hreflang alternates, OG/Twitter, theme-colour, viewport, favicon, the shared CSS/JS, one `h1`, `main#main`, footer, or about 2,500 characters of text; titles or descriptions repeat; ids repeat;
- a static nav differs from `siteNavItems(lang, page)`; the language link is wrong; ko/en section ids differ; an internal link or `#anchor` points nowhere; an external link is not `https`;
- a table is not inside a `.table-wrap` with `role="region"`, `tabindex="0"` and an `aria-labelledby` that names its own `<caption id>`;
- any discovered HTML file (including the app's `index.html`) has inline script, style blocks, style attributes, event handlers or `javascript:` URLs;
- `site.css` tokens (colours and `--font-sans`) differ from `src/ui/styles.css`, or a text/background pair from [Colour contrast](#colour-contrast) falls below 4.5:1 in either theme;
- `_headers` does not give every page exactly one `Cache-Control: no-cache, no-transform` (and the CSP), or `robots.txt`/`sitemap.xml` miss a page or an alternate.

`tests/site.test.ts` covers the path helpers, `siteNavItems`, the shared storage key and `findHtmlEntries` (including the ignored directories).

## Mounting the site navigation in the app

`src/ui/app.ts` appends `createSiteNav(getLang())` to the app header as a full-width row (`.app-header .site-nav` in `src/ui/styles.css`) and rebuilds it in its `onLangChange` handler:

```ts
let siteNav = createSiteNav(getLang());
header.append(siteNav);
onLangChange((lang) => {
  const next = createSiteNav(lang);
  siteNav.replaceWith(next);
  siteNav = next;
});
```

The nav's labels and hrefs depend on the language, so it is rebuilt rather than re-translated. Importing `site-nav.ts` brings `site-nav.css` into the app bundle; it only uses the shared tokens.
