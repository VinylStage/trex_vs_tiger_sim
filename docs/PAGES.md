# Static content pages

> **한국어 요약**
>
> - 시뮬레이터는 한국어 `/`, 영어 `/en/` 두 주소로 제공됩니다(같은 앱 `src/main.ts`, 페이지마다 그 언어 사전만 포함, 언어는 URL로 결정, 저장하지 않음). 그 밖에 검색엔진이 읽을 수 있는 정적 안내 페이지 7종을 한국어(`/<page>/`)와 영어(`/en/<page>/`)로 제공합니다: 사용 방법, 모델 설명, 파라미터 설명, 소개 · 문의, 패치노트, 개인정보처리방침, 라이선스.
> - 시뮬레이터 페이지에는 `#app` 바깥에 정적 소개 · FAQ가 있고, 모든 페이지에 같은 정적 푸터(면책 문구, 소개 · 개인정보처리방침 · 라이선스 · GitHub · 블로그 · Linktree, 버전)가 있습니다. 문구는 `src/i18n/ko.ts` · `src/i18n/en.ts`와 글자 하나까지 같아야 하며 테스트가 확인합니다.
> - 페이지는 손으로 쓴 HTML입니다(`<page>/index.html`, `en/<page>/index.html`). Vite가 저장소 안의 모든 `index.html`을 자동으로 찾아 빌드하므로, 새 페이지는 설정 변경 없이 폴더와 `index.html`만 추가하면 됩니다.
> - 공통 스타일은 `src/pages/site.css`(앱과 같은 색 토큰, 다크 모드, 인쇄용), 공통 스크립트는 `src/pages/site.ts`(현재 메뉴 표시, 언어 링크 유지, 푸터 버전 표시)입니다. 인라인 스크립트·스타일은 쓰지 않습니다(CSP).
> - 글꼴은 앱과 같은 자체 호스팅 Pretendard입니다. `site.ts`가 앱과 같은 `@font-face` 스타일시트를 불러오므로 빌드 결과에서 앱과 페이지가 파일 하나를 함께 씁니다. 웹 글꼴이 오기 전에는 Pretendard와 글자 폭·줄 높이를 맞춘 대체 글꼴(`Pretendard Fallback`)로 그려서, 글꼴이 바뀔 때 레이아웃이 거의 움직이지 않습니다.
> - 접근성: 본문 크기 글자는 양쪽 테마에서 명도 대비 4.5:1 이상([색 대비](#colour-contrast)), 가로로 스크롤되는 표는 키보드로 초점을 옮겨 스크롤할 수 있습니다.
> - 상단 헤더(로고, 사이트 이름, 메뉴, 언어 링크)는 페이지마다 손으로 쓰지 않습니다. 원본에는 `<!-- site-header -->` 한 줄만 두고, 빌드(개발 서버 포함)가 `src/pages/site-header.ts`의 `renderSiteHeader(lang, page)`로 채웁니다. 로고는 모든 페이지와 앱이 같은 `SITE_LOGO`(`/header-logo.svg`)를 씁니다([사이트 헤더](#site-header)).
> - 앱에서 쓸 메뉴는 `src/ui/site-nav.ts`의 `createSiteNav(lang)`이 만듭니다.
> - canonical, hreflang, Open Graph, Twitter 카드, JSON-LD는 손으로 쓰지 않고 빌드할 때 `vite.seo.ts`가 각 페이지의 제목·설명·본문에서 만들어 넣습니다. `sitemap.xml`, `robots.txt`, `llms.txt`도 빌드 때 생성됩니다([SEO.md](SEO.md)). 알 수 없는 주소에는 `404.html`(영어는 `en/404.html`)이 상태 코드 404로 응답합니다.
> - `tests/pages.test.ts`가 파라미터 값, 시나리오 설정, 엔진 상수를 코드와 대조하고, 제목·설명, 메뉴, 링크, CSP, `_headers`, 404 페이지, 색 토큰을 검사합니다. 생성되는 SEO 태그는 `tests/seo.test.ts`가 검사합니다. 코드 값을 바꾸면 이 테스트가 페이지 수정이 필요한 곳을 알려 줍니다.
> - 나중에 Google AdSense를 붙일 때 바꿔야 할 곳은 [AdSense 준비](#adsense-readiness)에 정리했습니다.

## Contents

- [Pages](#pages)
- [URL scheme and languages](#url-scheme-and-languages)
- [Files](#files)
- [How the build finds pages](#how-the-build-finds-pages)
- [Adding a page](#adding-a-page)
- [Writing and markup rules](#writing-and-markup-rules)
- [Site header](#site-header)
- [Patch notes](#patch-notes)
- [The simulator pages (`/`, `/en/`)](#the-simulator-pages--en)
- [Footer](#footer)
- [Colour contrast](#colour-contrast)
- [Fonts](#fonts)
- [SEO](#seo)
- [AdSense readiness](#adsense-readiness)
- [Drift guard](#drift-guard)
- [Mounting the site navigation in the app](#mounting-the-site-navigation-in-the-app)

## Pages

| Page id       | Korean          | English            | Content                                                                                                                                                                                                   |
| ------------- | --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulator`   | `/`             | `/en/`             | The app (`index.html`, `en/index.html`), with a static intro, FAQ and footer outside `#app`                                                                                                               |
| `guide`       | `/guide/`       | `/en/guide/`       | Step-by-step use of the simulator, reading results, sharing, a three-experiment tutorial, FAQ, troubleshooting                                                                                            |
| `model`       | `/model/`       | `/en/model/`       | Plain-language model description: Monte Carlo design, agent rules, outcomes, statistics, reproducibility, species and documented match-ups (`#matchup-*` anchors the matchup badge links to), limitations |
| `parameters`  | `/parameters/`  | `/en/parameters/`  | One card per role parameter in `src/sim/params.ts` (default-species values), the species preset tables, every scenario setting, the engine constants                                                      |
| `about`       | `/about/`       | `/en/about/`       | Purpose, what it teaches, educational disclaimer, how it is built, open source, contact via GitHub issues                                                                                                 |
| `patch-notes` | `/patch-notes/` | `/en/patch-notes/` | Patch notes board: one card per release, newest first, generated from `src/content/patch-notes.ts` ([Patch notes](#patch-notes))                                                                          |
| `privacy`     | `/privacy/`     | `/en/privacy/`     | Privacy policy (effective 2026-10-20): no own cookies, `trexsim.tour` in localStorage (the v0.1.0 key `trexsim.lang` is deleted on load), Cloudflare cookies and logs                                     |
| `license`     | `/license/`     | `/en/license/`     | MIT License text (identical to `LICENSE`), what it covers, the Pretendard (OFL 1.1) notice and its full license text                                                                                      |

The registry is `CONTENT_PAGES` in `src/pages/routes.ts`. The header navigation (`NAV_PAGES`) is simulator · guide · model · parameters · about · patch notes; about, privacy and license are linked from every footer (`FOOTER_LINKS`).

## URL scheme and languages

- Korean is the default language: `/<page>/`. English lives under `/en/<page>/`. The simulator is `/` (Korean) and `/en/` (English): two static entries, `index.html` and `en/index.html`, with one script each (`src/main-ko.ts`, `src/main-en.ts`): both start the same app (`src/main.ts`), and each bundles only its own language's words (#79).
- **The URL decides the language.** Every page has a static `<html lang>`; the app reads its language with `pageLang(location.pathname, <html lang>)` (`src/pages/routes.ts`). Nothing is stored (there is no language key in `localStorage`), and visitors are never redirected by browser language.
- **In-place switch in the app.** The header language button translates the UI (`applyI18n`, also covering the static intro and footer through their `data-i18n` keys), rebuilds the site nav and the footer links, re-points the intro links (`a[data-page]`, `relocalizeLinks`), sets `<html lang>` and `document.title` (the other language's static `<title>`, `app.documentTitle`) and rewrites the URL with `history.replaceState` to `switchedAppUrl(lang, search, hash)`: `/#s=…` ↔ `/en/#s=…`, query and fragment kept. Results, the replay and form state stay. Reloading `/en/` shows English.
- Every page carries `<link rel="canonical">` to its own URL on the production domain `https://trex-vs-tiger.vinylims.com`, so `*.pages.dev` copies (production alias and previews) consolidate onto it.
- Every page carries `hreflang` alternates `ko`, `en` and `x-default` (= **English**, SEO_GEO §1.4). Canonical, hreflang, Open Graph, Twitter and JSON-LD are generated at build time, not written in the sources ([SEO.md](SEO.md#head-tags)).
- Unknown URLs get `404.html` (Korean) or, under `/en/`, `en/404.html`, with status 404 ([SEO.md](SEO.md#404-pages)).
- The header's language link (`a[data-lang-switch]`) points to the counterpart page. Both languages use the **same section ids**, so `site.ts` can keep the reader's place (`/guide/#share` ↔ `/en/guide/#share`).
- Links from a page to the simulator use the simulator URL of the page's language (`/` or `/en/`, the tour deep link `/?tour=1` or `/en/?tour=1`). Links from the app to the static files it needs are root-absolute (`/favicon.svg`, `/version.json`, `/reset/`), and workers load relative to the bundle (`import.meta.url`), so the app works at both `/` and `/en/`.
- Cloudflare Pages serves `<dir>/index.html` at `/<dir>/` and redirects `/<dir>` and `/<dir>/index.html` there.

## Files

| File                                        | Role                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<page>/index.html`, `en/<page>/index.html` | The pages: complete, crawlable HTML with their own title, description, icons and manifest link, the `<!-- site-header -->` placeholder (filled by the build), `<main>` article and footer. The build adds the SEO head ([SEO.md](SEO.md))                                                                          |
| `404.html`, `en/404.html`                   | Not-found pages (noindex): site nav, links to the main pages and the other language, shared footer                                                                                                                                                                                                                 |
| `src/pages/site.css`                        | Shared stylesheet. Its `:root` tokens mirror `src/ui/styles.css` (light and dark); responsive; print rules. Imports `src/ui/site-nav.css`                                                                                                                                                                          |
| `src/pages/site.ts`                         | Imports the self-hosted Pretendard stylesheet (see [Fonts](#fonts)). Otherwise progressive enhancement only: `aria-current` on the nav, language link keeps the `#hash`, writes `v<version>` into the footer. Stores nothing. Never imports `i18n.ts` at run time (it would pull the dictionaries into every page) |
| `src/pages/routes.ts`                       | DOM-free page registry and path helpers (`pagePath`, `parsePagePath`, `counterpartPath`, `pageLang`, `notFoundLang`, `switchedAppUrl`, `canonicalUrl`), `SITE_ORIGIN`, owner URLs, `NAV_LABEL_KEYS`, `FOOTER_LINKS`                                                                                                |
| `src/pages/site-header.ts`                  | The site header in one place ([Site header](#site-header)): `SITE_LOGO`, `siteNavItems()`, `renderSiteHeader()`, `renderAppLogo()`, `expandSiteHeader()`. DOM-free; used by the build, the app and the tests, never by `site.ts`                                                                                   |
| `src/pages/site-footer.ts`                  | The site footer in one place ([Footer](#footer)): `renderSiteFooter(lang)` from the dictionaries and `FOOTER_LINKS`, filled in for `<!-- site-footer -->` by `expandSiteHeader`                                                                                                                                    |
| `src/ui/site-footer.css`                    | Footer styles shared by the app and the pages (imported by `src/ui/app.ts` and `site.css`)                                                                                                                                                                                                                         |
| `src/ui/site-nav.ts`, `src/ui/site-nav.css` | `createSiteNav(lang, current?)` for the app (its items are `siteNavItems()` from `src/pages/site-header.ts`, re-exported), the pure `footerItems()` the tests compare the generated footers against, `renderFooterLinks()` and `relocalizeLinks()` for the in-place language switch                                |
| `vite.pages.ts`                             | `findHtmlEntries(root)`: the build input map (every `index.html` and `404.html`); `siteHeader()`: the plugin that fills the header and footer placeholders                                                                                                                                                         |
| `vite.seo.ts`, `src/seo/*.ts`               | Build-time SEO: head tags and JSON-LD per page, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, 404 asset URLs ([SEO.md](SEO.md))                                                                                                                                                                        |
| `public/_headers` rule `/*/`                | `Cache-Control: no-cache, no-transform` on every directory-style page (see [DEPLOYMENT.md](DEPLOYMENT.md#rule--content-pages))                                                                                                                                                                                     |

## How the build finds pages

`vite.config.ts` passes `findHtmlEntries(root)` to `build.rolldownOptions.input` (Vite 8's name for `rollupOptions`). It walks the repository and returns every `index.html` and `404.html`, skipping `node_modules`, `dist`, `coverage`, `public` (copied verbatim by Vite) and every dot-directory (`.git`, `.claude`, `.github`, …). The root page keeps the key `index`, so the app's assets stay `assets/index-<hash>.*`; nested pages use their directory with `/` → `-` (`en/guide` → `en-guide`), and a `404.html` its directory plus `404` (`404`, `en-404`); each is emitted at its own path (`dist/en/404.html`).

`base: './'` makes every asset URL relative to its HTML file. Vite rewrites them per page: `./assets/…` for `/`, `../assets/…` for `/guide/`, `../../assets/…` for `/en/guide/`. All pages share one `assets/site-<hash>.js` (about 1 KiB) and one `assets/site-<hash>.css`. Code and styles used by both the app and the pages (the route table in `src/pages/routes.ts` and the Pretendard `@font-face` stylesheet) land in one shared chunk that every page including the app links; the bundler names it after its first module, currently `assets/routes-<hash>.js` and `assets/routes-<hash>.css` (see [Fonts](#fonts)). Internal links between pages are root-relative (`/guide/`), which is correct on production and on every preview, because Pages always serves the site at the root of its hostname.

`build.modulePreload.polyfill` is off: with several entries Vite would otherwise split its preload polyfill into a separate shared chunk, adding a request to the app for code neither entry needs (neither has preloadable chunks).

## Adding a page

**A content page in both languages** (e.g. a FAQ; `license` was added this way):

1. Add its id to `CONTENT_PAGES` and `NAV_LABEL_KEYS` in `src/pages/routes.ts`, a `nav.<id>` key to both dictionaries (`src/i18n/ko.ts`, `src/i18n/en.ts`) (it names the page in breadcrumbs and `llms.txt`), and its schema.org type to `PAGE_TYPE` in `src/seo/site.ts`. If it belongs in the header, also add it to `NAV_PAGES`; every page's header nav follows, because the header is generated ([Site header](#site-header)).
2. Copy an existing pair (for example `about/index.html` and `en/about/index.html`) to `<id>/index.html` and `en/<id>/index.html`. Update `<title>`, the meta description and the content. Keep section ids identical in both languages, keep the `<!-- site-header -->` and `<!-- site-footer -->` lines (the build turns them into this page's header, language link included, and footer). Do not write canonical, hreflang, `og:*`, `twitter:*` or JSON-LD: the build generates them, and the sitemap and `llms.txt` pick the page up from the registry.
3. Run `npm run check`. `tests/pages.test.ts` and `tests/seo.test.ts` list anything missing or inconsistent.

**A utility page** (e.g. a future `reset/index.html`): just create the directory and its `index.html`. The build picks it up, the `/*/` header rule covers it, and the CSP checks in `tests/pages.test.ts` run on it automatically. Add `<meta name="robots" content="noindex" />`; it is not in `CONTENT_PAGES`, so it stays out of the sitemap, `llms.txt` and the generated head tags.

## Writing and markup rules

- **CSP**: no inline `<script>` (every script has `src`), no `<style>` blocks, no `style=` attributes, no `on*=` handlers, no `javascript:` URLs. Link the shared files exactly as the existing pages do: `<link rel="stylesheet" href="/src/pages/site.css" />` and `<script type="module" src="/src/pages/site.ts"></script>`.
- **Semantics**: `header` → `nav.site-nav` → `main#main` → `article.page` (`header.page-head` with `nav.breadcrumb` (app short title › the page's nav label, matching the BreadcrumbList JSON-LD), one `h1`, a lead and `p.page-meta` with a `<time datetime="YYYY-MM-DD">`; then `nav.toc`, `div.page-body` of `section`s with `h2`/`h3`) → `footer`. Tables get `thead`/`th scope`.
- **Tables**: every `<table>` sits in `<div class="table-wrap" role="region" tabindex="0" aria-labelledby="caption-<name>">` and has `<caption id="caption-<name>">`. The wrapper scrolls sideways on narrow screens so the page itself never does; `tabindex="0"` lets keyboard users focus the region and scroll it with the arrow keys (Safari never makes scroll containers focusable on its own; WCAG 2.1.1), and the caption gives the region and the table an accessible name. `.table-wrap:focus-visible` draws the focus ring. Use the same caption ids in both languages. The simulator's chart data tables follow the same rule: `.chart-table-wrap` is a focusable `role="region"` named by its chart title (`src/ui/charts.ts`, #68).
- **Numbers that come from code** use `<data data-k="…" value="…">shown</data>`; the test compares both the `value` and the shown text with the code. Parameter cards are `section.param#param-<id>[data-param][data-unit]`, settings `section.setting#setting-<key>[data-setting]`, constants `tr[data-constant]`.
- **Content**: write natural Korean and English (not word-for-word translation), keep claims consistent with `docs/MODEL.md` and `src/sim`, avoid describing UI details that are likely to change, and update the "last updated" date (`p.page-meta <time datetime>`, both languages) when a page changes materially: it is also the page's sitemap `lastmod` and JSON-LD `dateModified`, and the build warns when a page was committed after it ([SEO.md](SEO.md#sitemap-and-lastmod)). Korean uses `word-break: keep-all` so words are not split.
- **Colour**: use the page colour roles for accent text and filled controls, not `--accent` (see [Colour contrast](#colour-contrast)).
- Format with Prettier (`npx prettier --write <file>`); `npm run format:check` covers HTML.

## Site header

The header is not written by hand. Every content page and both 404 pages have one line where the header goes, right after the skip link:

```html
<a class="skip-link" href="#main">…</a>
<!-- site-header -->
<main id="main" class="site-main">…</main>
```

`siteHeader()` in `vite.pages.ts` is a `transformIndexHtml` hook (`order: 'pre'`, so Vite then handles the logo URL like hand-written markup; it runs in `npm run dev` too) that replaces the line with `renderSiteHeader(lang, page)` from `src/pages/site-header.ts`. Language and page come from the source path (`headerRouteOf`: `/en/guide/index.html` → `en`, `guide`; `/404.html` → `ko`, no current page). The built HTML therefore contains the complete static header, for crawlers and readers without JavaScript:

- `a.site-brand` to the simulator of the page's language: the logo `<img>` (`SITE_LOGO`) and the brand text (`app.shortTitle`);
- `nav.site-nav` with `siteNavItems(lang, page)` (the list the app's `createSiteNav` uses), the current page marked `aria-current="page"`;
- `a.lang-switch[data-lang-switch]` to the same page in the other language (the other language's simulator on a 404). `site.ts` adds the `#hash` at run time.

**One logo.** `SITE_LOGO` is the only place the header logo is named: `/header-logo.svg` (the owner's icon, [BRANDING.md](BRANDING.md#assets)), 40 px in the app header and 32 px in the content-page header. The app takes it from the same constant: `src/ui/app.ts` builds its logo with `logoAttrs('app')`, and the static head of `index.html` / `en/index.html` has an `<!-- app-logo -->` line the same plugin replaces with `renderAppLogo()`. To change the logo or its size, change `SITE_LOGO` and nothing else.

A placeholder on a page whose path the plugin cannot resolve, `<!-- site-header -->` on the simulator or `<!-- app-logo -->` on a content page fails the build. `tests/pages.test.ts` runs the same `expandSiteHeader` over the sources, so every other page test sees the header as built, and fails if a source hand-writes a header or a logo `<img>`, lacks its placeholder, or if any page's header logo (src, size, alt) differs from `SITE_LOGO`.

## Patch notes

`/patch-notes/` and `/en/patch-notes/` are a notice board of releases. The sources (`patch-notes/index.html`, `en/patch-notes/index.html`) hold the head, breadcrumb, `h1`, lead, "last updated" date and footer like any content page, and one `<!-- patch-notes -->` line where the board goes. `patchNotes(version)` in `vite.pages.ts` (`order: 'pre'`, dev and build) replaces it with `renderPatchNotes(lang, version)` from `src/pages/patch-notes-page.ts`:

- `nav.toc.patch-index`: a chip per version linking its card, the newest marked "최신" / "Latest";
- `div.page-body.patch-board`: one `section.patch-card#v<x>-<y>-<z>` per version (`versionAnchor`, e.g. `#v0-2-9`), newest first. Each card shows the version badge (a link to its own anchor), the date, a NEW tag on the newest card, the title (`h2`), the bullets grouped under emoji category headings (`h3`: ✨ new · 🛠 improved · 🐛 fixed · 🔒 security · ♿ accessibility · ⚠️ known issues) with their issue links, and the PRs and the GitHub release in its foot.

The words live in `src/content/patch-notes.ts` (`PATCH_NOTES`, typed data, ko and en written separately), never in the HTML. The board shows the entries up to the build's `package.json` version (`releasedNotes`), so an entry written ahead for the next release appears with it. `vite.seo.ts` expands the same placeholder for `llms-full.txt`, and `tests/pages.test.ts` reads the pages expanded. `tests/patch-notes.test.ts` requires an entry, dated as in `CHANGELOG.md`, for every released version, the newest-first order, both languages, 2–6 bullets and the content framing rules (no blood, death or gore words), and a "last updated" date no older than the newest release. Adding an entry is part of every release ([CONTRIBUTING.md](../CONTRIBUTING.md#release-cadence)).

The app's version dialog links "패치노트 보기" / "Patch notes" to the running version's card, and the update banner links "바뀐 점 보기" / "What's new" to the deployed version's card (`src/ui/version.ts`; both follow an in-app language switch through `data-page`).

## The simulator pages (`/`, `/en/`)

`index.html` (Korean) and `en/index.html` (English) carry the static head of their language (title = `app.documentTitle`, description; the build adds canonical, hreflang, Open Graph and JSON-LD including `FAQPage` from the visible FAQ) and this body:

```html
<div id="app">
  <header class="app-header app-static-head">…</header>
  <!-- logo, the only <h1>, link to the other language; the app replaces it -->
</div>
<noscript>…</noscript>
<section class="site-intro" id="intro">…</section>
<!-- answer-first intro -->
<section class="site-faq" id="faq">…</section>
<!-- 4 visible Q&A -->
<!-- site-footer -->
<!-- shared footer, filled by the build -->
```

- **Static header and `<h1>`.** `#app` starts with a static header in the app header's classes: logo (the `<!-- app-logo -->` line, see [Site header](#site-header)), `<h1 data-i18n="app.title">` and `<a data-lang-switch hreflang lang data-i18n="lang.switch">` to the other language's app. Crawlers that do not run JavaScript thus get the page heading and the language link. `startApp` moves the `<h1>` element into its own header and removes the rest (the language button replaces the link), so the page always has exactly one `<h1>`.
- **Outside `#app`.** The intro, FAQ and footer are siblings of `#app`, so they exist without JavaScript (crawlers that do not run scripts, see [SEO.md](SEO.md)) and stay in the DOM after the app mounts.
- **Answer first, compact.** The intro says what the simulator is, how it works in four steps, what you learn (Monte Carlo, confidence intervals, sensitivity) and links to the guide, the model's preliminary results (`/model/#results`), the parameters and the tour. It states no simulation result numbers; the only number (22 parameters) is pinned to `PARAMS.length` by a test.
- **Below the simulator, no layout shift.** The simulator stays at the top. `#app` reserves one viewport (`min-height: 100vh` / `100svh` in `src/ui/styles.css`), so the intro starts below the fold before the app mounts and stays there after it; mounting shifts nothing on screen (measured CLS 0.0000 at 1366/390/320 px). Without JavaScript (`@media (scripting: none)`) `#app` drops the reservation and shows only the static header; the `<noscript>` notice and the intro follow.
- **Translatable in place.** Every static text element has `data-i18n="<key>"` and contains exactly `DICTIONARIES[lang][key]` (`data-i18n-aria`, `data-i18n-title` likewise), so the app's `applyI18n` translates it when the language switches. Links carry `data-page` (plus `data-href-suffix` such as `#results` or `?tour=1`) so `relocalizeLinks` can point them at the other language. The tour link also has `data-tour-start`: the app starts the tour in place on a plain click.

## Footer

Every page (both app entries, all content pages including the license pages, the 404 and `/r/` pages) has exactly one static `<footer class="site-footer">`. The sources contain only the `<!-- site-footer -->` line; the build (and the dev server) replaces it with `renderSiteFooter(lang)` from `src/pages/site-footer.ts`, the same plugin pass that fills the header (`expandSiteHeader`, [Site header](#site-header)), so a disclaimer or link change is one edit in the dictionaries or `FOOTER_LINKS` (#64). The footer contains:

1. the educational disclaimer (`footer.disclaimer`, including that the site does not promote or endorse real animal fighting);
2. `ul.footer-links` in the order of `FOOTER_LINKS` (`src/pages/routes.ts`): about · privacy · license (site pages of the page's language), source code (GitHub repository, `rel="noopener"`), blog `https://vinylims.com` and Linktree `https://link.vinylims.com` (both `rel="me noopener"`, they identify the owner);
3. `p.footer-meta`: "시뮬레이션은 모두 브라우저에서 실행됩니다 / Simulations run in your browser", the copyright line and the version link to the GitHub releases, whose number is filled in by script ([VERSIONING.md](VERSIONING.md#footer-version)).

All links are in the static HTML; nothing a crawler needs is generated at run time. The old app footer claim "서버 전송 · 추적 없음 / No server, no tracking" is gone, because it would become false once ads are added ([ADSENSE.md](ADSENSE.md)). The app no longer renders a footer of its own: it fills the version, and on a language switch rebuilds the links (`renderFooterLinks`) and re-translates the rest. Styles: `src/ui/site-footer.css`.

`/reset/` is a transient utility page (noindex, about half a second on screen) and has no footer.

## Colour contrast

All page text is normal size, so WCAG 2.x AA needs a contrast ratio of at least **4.5:1**. The app's `--accent` (`#2a78d6` light, `#3987e5` dark) does not reach that as a text colour on the page background (4.09:1) or under white text (4.42:1 light, 3.64:1 dark). Both stylesheets therefore define these colour roles in their `:root` blocks (`src/ui/styles.css` is the source, `site.css` mirrors it), so the simulator and the pages use the same blue for links and filled buttons:

| Role                  | Value                                        | Used for                                             |
| --------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `--accent-text`       | `var(--accent-hover)`: `#256abf` / `#5598e7` | Links, eyebrow, parameter chips, TOC hover           |
| `--accent-fill`       | `#256abf` (both themes)                      | Background of the button, skip link and step numbers |
| `--accent-fill-hover` | `#1d5aa6` (both themes)                      | Button hover                                         |
| `--accent-fill-fg`    | `#ffffff`                                    | Text on the filled controls                          |
| `--control-border`    | `#85847f` / `#77766f`                        | Outline of inputs and selects (≥ 3:1, WCAG 1.4.11)   |

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

Each `@font-face` rule covers a `unicode-range`, so a browser downloads only the subsets whose characters appear on the page. `font-display: swap` shows text at once in a fallback font and swaps in Pretendard when it arrives; later page views hit the immutable `assets/` cache and render in Pretendard straight away.

To keep that first swap from reflowing the page, `--font-sans` lists a metric-matched local family, `Pretendard Fallback`, right after Pretendard. `src/assets/fonts/pretendard-fallback.css` (imported by `src/main.ts` and `site.ts`, so it lands in the same shared CSS file) maps it to Arial, Helvetica or Liberation Sans for Latin text and to Noto Sans CJK KR, Source Han Sans or WenQuanYi Zen Hei for Hangul, with `size-adjust` and ascent/descent overrides measured against Pretendard Variable, and separate bold faces above weight 550. Where none of those fonts is installed, the face is skipped and the system stack (`-apple-system`, `system-ui`, `Apple SD Gothic Neo`, `Noto Sans KR`, `Malgun Gothic`, …) applies with its own metrics. Measured font-swap CLS: [PERFORMANCE.md](PERFORMANCE.md#font-swap).

## SEO

- Unique, descriptive `<title>` (`<topic> – <site name>`, at most 60 characters) and meta description (50–165 characters) per page, the two simulator pages included; the tests enforce length and uniqueness. Names, titles and descriptions: [SEO.md](SEO.md).
- Canonical + `hreflang` (`ko`, `en`, `x-default` = English) on every page and in the sitemap; `og:locale` / `og:locale:alternate`; the language's 1200×630 card as `og:image` and `summary_large_image`; JSON-LD. All generated at build time from one registry ([SEO.md](SEO.md)).
- `robots.txt` (generated) allows everything except `/reset/` and names the search and AI crawlers and the sitemap. Submitting the sitemap and setting up the webmaster tools are owner actions: [SEO.md](SEO.md#owner-actions).
- Pages are complete HTML without JavaScript (the no-JS render is verified in the browser check), load one small stylesheet, the shared font stylesheet and a 1 KiB script, and reserve image sizes (`width`/`height`). The only possible layout shift is the one-time font swap described in [Fonts](#fonts), which the metric-matched fallback keeps near zero.

## AdSense readiness

No ad code is included yet. The pages were written with an AdSense review in mind: substantial original content on every page, an about/contact page, a privacy policy, clear navigation and no thin or auto-generated pages. When ads are added, change all of the following in the same PR:

1. **Privacy policy** (both languages): name Google as a third-party vendor, describe its cookies and personalised-ads choices, link Google's policy, add a consent mechanism (certified CMP) for EEA/UK/Switzerland visitors, and bump the effective date.
2. **About page**: it already says “currently uses no analytics” / “현재 분석 도구도 쓰지 않습니다” and that the simulator itself depends on no third-party script; recheck both against what the ads add (an analytics product would make the first false). The build regenerates `llms-full.txt` from the page, so no separate copy needs editing.
3. **CSP** in `public/_headers` and [DEPLOYMENT.md](DEPLOYMENT.md): AdSense needs additional `script-src`, `img-src`, `frame-src`, `connect-src` origins; the inline bootstrap snippet AdSense suggests is not allowed under this CSP, so load it from a same-origin file or use a nonce-free integration.
4. **`public/ads.txt`** with the publisher line.
5. **Layout**: reserve fixed-size ad slots in `site.css` so ads cause no layout shift; keep ads out of the navigation and away from the simulator controls.
6. **Tests**: `tests/pages.test.ts` forbids inline scripts; keep it that way and extend the allow-list deliberately.

## Drift guard

`tests/pages.test.ts` reads the HTML sources and fails when:

- a parameter in `src/sim/params.ts` is missing, extra, or its unit, min/mode/max, bounds (of the default species, T. rex and tiger, from `src/sim/species.ts`) or individual-variation flag differ (values and visible numbers); the card heading must contain the app’s i18n label;
- a species preset in `src/sim/species.ts` (every species × role parameter: min/mode/max and evidence tag, `data-k="preset"`), a heavy weapon kind or a `hide`/`radius` constant is missing or differs on the parameters pages;
- a scenario setting's default, limits or options differ from `defaultConfig()`, `LIMITS`, `SAMPLING_METHODS`, `PACK_TACTICS`, the species id lists, or the work budget from `MAX_WORK`; an engine constant differs from `CONSTANTS`/`DT`;
- any page lacks a title, description, theme-colour, viewport, favicon, apple-touch-icon, manifest link, the shared CSS/JS, one `h1`, `main#main`, footer, or about 2,500 characters of text, or hand-writes a canonical, hreflang, `og:*` or `twitter:*` tag (those are generated); a title is longer than 60 or a description longer than 165 characters; titles or descriptions repeat (across all pages including `/` and `/en/`); ids repeat;
- a content page lacks the visible breadcrumb (app short title → its nav label, `aria-label` = `breadcrumb.label`) that its BreadcrumbList JSON-LD describes;
- a simulator page's `<title>` differs from `app.documentTitle`, its `#app` holds anything but the static header, it has not exactly one `<h1>` (`app.title`, before every other heading) or no static link to the other language, a text node in the static header, intro, FAQ or footer is not bound to a message key, its ordered `data-i18n*` key list differs from the other language's page, an `intro.*`/`faq.*` message is missing or repeated, the intro/FAQ/footer are not after `#app`, the intro has fewer than 3 or more than 4 steps, fewer than 3 or more than 5 FAQ items, or its links differ from guide · model#results · parameters · tour of its language;
- on any page, a `data-i18n` (`-aria`, `-title`) text differs from the dictionary, the footer links differ from `footerItems(lang)` (href, label, rel), the version link does not point at the releases, the header brand differs from `app.shortTitle`, or the footer still claims "no tracking";
- the license pages' MIT text differs from `LICENSE`, or the OFL text from `src/assets/fonts/pretendard/LICENSE.txt`; `package.json` gains runtime `dependencies`;
- a `'trexsim.*'` storage key in `src/` is missing from either privacy page, or a privacy page names a key the code does not use;
- a page source hand-writes its header or a logo `<img>` instead of the `<!-- site-header -->` / `<!-- app-logo -->` placeholder, or a page's header logo (src, size, alt) differs from `SITE_LOGO` ([Site header](#site-header));
- a static nav differs from `siteNavItems(lang, page)`; the language link is wrong; ko/en section ids differ; an internal link or `#anchor` points nowhere; an external link is not `https`;
- a table is not inside a `.table-wrap` with `role="region"`, `tabindex="0"` and an `aria-labelledby` that names its own `<caption id>`;
- any discovered HTML file (including the app's `index.html`) has inline script, style blocks, style attributes, event handlers or `javascript:` URLs;
- `site.css` tokens (colours and `--font-sans`) differ from `src/ui/styles.css`, or a text/background pair from [Colour contrast](#colour-contrast) falls below 4.5:1 in either theme;
- `_headers` does not give every page exactly one `Cache-Control: no-cache, no-transform` (and the CSP), or unknown paths (the 404 pages) get no CSP;
- a 404 page is not noindex, has a canonical, shares a title with a page, has a wrong nav or language link, misses a link to a main page or the other language, or uses a URL that is not root-absolute.

`tests/seo.test.ts` runs the build's generators over the real sources and checks the generated head of every page (canonical, hreflang, OG, Twitter, JSON-LD and `FAQPage` = visible FAQ), the sitemap against the registry and the build entries, `robots.txt`, `llms.txt`, git dates and the IndexNow key ([SEO.md](SEO.md#tests)).

`tests/site.test.ts` covers the header renderer (`renderSiteHeader`, `renderAppLogo`, `headerRouteOf`, `expandSiteHeader` and its errors, the plugin's `pre` order), the path helpers (including `/en/` and the language from the URL, `switchedAppUrl` keeping query and fragment), `siteNavItems`, `FOOTER_LINKS`/`footerItems` (order, hrefs, `rel="me"`), `relocalizeLinks` and `findHtmlEntries` (including the ignored directories, the `en` entry and the 404 entries). `tests/i18n.test.ts` checks that the language state never touches `localStorage`.

## Mounting the site navigation in the app

`src/ui/app.ts` appends `createSiteNav(getLang())` to the app header as a full-width row (`.app-header .site-nav` in `src/ui/styles.css`) and rebuilds it in its `onLangChange` handler, together with the footer links and the URL (see [URL scheme and languages](#url-scheme-and-languages)):

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
