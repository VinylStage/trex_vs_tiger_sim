# Static content pages

> **한국어 요약**
>
> - 시뮬레이터(`/`) 외에 검색엔진이 읽을 수 있는 정적 안내 페이지 5종을 한국어(`/<page>/`)와 영어(`/en/<page>/`)로 제공합니다: 사용 방법, 모델 설명, 파라미터 설명, 소개 · 문의, 개인정보처리방침.
> - 페이지는 손으로 쓴 HTML입니다(`<page>/index.html`, `en/<page>/index.html`). Vite가 저장소 안의 모든 `index.html`을 자동으로 찾아 빌드하므로, 새 페이지는 설정 변경 없이 폴더와 `index.html`만 추가하면 됩니다.
> - 공통 스타일은 `src/pages/site.css`(앱과 같은 색 토큰, 다크 모드, 인쇄용), 공통 스크립트는 `src/pages/site.ts`(현재 메뉴 표시, 언어 링크 유지)입니다. 인라인 스크립트·스타일은 쓰지 않습니다(CSP).
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

| File                                        | Role                                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<page>/index.html`, `en/<page>/index.html` | The pages: complete, crawlable HTML with head metadata, shared header/nav, `<main>` article and footer                                                                                                                   |
| `src/pages/site.css`                        | Shared stylesheet. Its `:root` tokens mirror `src/ui/styles.css` (light and dark); responsive; print rules. Imports `src/ui/site-nav.css`                                                                                |
| `src/pages/site.ts`                         | Progressive enhancement only: `aria-current` on the nav, language link keeps the `#hash`, remembers the language for the simulator. Never imports `i18n.ts` at run time (it would pull the dictionaries into every page) |
| `src/pages/routes.ts`                       | DOM-free page registry and path helpers (`pagePath`, `parsePagePath`, `counterpartPath`, `canonicalUrl`), `SITE_ORIGIN`, `LANG_STORAGE_KEY`                                                                              |
| `src/ui/site-nav.ts`, `src/ui/site-nav.css` | `createSiteNav(lang, current?)` for the app, and the pure `siteNavItems()` the tests compare the static navs against                                                                                                     |
| `vite.pages.ts`                             | `findHtmlEntries(root)`: the build input map                                                                                                                                                                             |
| `public/robots.txt`                         | Allow all; points at the sitemap                                                                                                                                                                                         |
| `public/sitemap.xml`                        | The app and every page, with `xhtml:link` hreflang alternates                                                                                                                                                            |
| `public/_headers` rule `/*/`                | `Cache-Control: no-cache, no-transform` on every directory-style page (see [DEPLOYMENT.md](DEPLOYMENT.md#rule--content-pages))                                                                                           |

## How the build finds pages

`vite.config.ts` passes `findHtmlEntries(root)` to `build.rolldownOptions.input` (Vite 8's name for `rollupOptions`). It walks the repository and returns every `index.html`, skipping `node_modules`, `dist`, `coverage`, `public` (copied verbatim by Vite) and every dot-directory (`.git`, `.claude`, `.github`, …). The root page keeps the key `index`, so the app's assets stay `assets/index-<hash>.*`; nested pages use their directory with `/` → `-` (`en/guide` → `en-guide`).

`base: './'` makes every asset URL relative to its HTML file. Vite rewrites them per page: `./assets/…` for `/`, `../assets/…` for `/guide/`, `../../assets/…` for `/en/guide/`. All pages share one `assets/site-<hash>.js` (about 1 KiB) and one `assets/site-<hash>.css`. Internal links between pages are root-relative (`/guide/`), which is correct on production and on every preview, because Pages always serves the site at the root of its hostname.

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
- **Semantics**: `header` → `nav.site-nav` → `main#main` → `article.page` (`header.page-head` with one `h1`, `nav.toc`, `div.page-body` of `section`s with `h2`/`h3`) → `footer`. Tables get `thead`/`th scope`. Wide tables sit in `.table-wrap` so phones never scroll the page sideways.
- **Numbers that come from code** use `<data data-k="…" value="…">shown</data>`; the test compares both the `value` and the shown text with the code. Parameter cards are `section.param#param-<id>[data-param][data-unit]`, settings `section.setting#setting-<key>[data-setting]`, constants `tr[data-constant]`.
- **Content**: write natural Korean and English (not word-for-word translation), keep claims consistent with `docs/MODEL.md` and `src/sim`, avoid describing UI details that are likely to change, and update the "last updated" date when a page changes materially. Korean uses `word-break: keep-all` so words are not split.
- Format with Prettier (`npx prettier --write <file>`); `npm run format:check` covers HTML.

## SEO

- Unique, descriptive `<title>` (`<topic> | <site name>`) and meta description (50–320 characters) per page; the tests enforce uniqueness.
- Canonical + `hreflang` (`ko`, `en`, `x-default`) on every page and in the sitemap; `og:locale` / `og:locale:alternate`.
- `robots.txt` allows everything and names the sitemap. Submit `https://trex-vs-tiger.vinylims.com/sitemap.xml` in Google Search Console after deployment.
- Pages are complete HTML without JavaScript (the no-JS render is verified in the browser check), load one small stylesheet and a 1 KiB script, reserve image sizes (`width`/`height`) and use system fonts, so there is no layout shift.

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
- any discovered HTML file (including the app's `index.html`) has inline script, style blocks, style attributes, event handlers or `javascript:` URLs;
- `site.css` tokens differ from `src/ui/styles.css`;
- `_headers` does not give every page exactly one `Cache-Control: no-cache, no-transform` (and the CSP), or `robots.txt`/`sitemap.xml` miss a page or an alternate.

`tests/site.test.ts` covers the path helpers, `siteNavItems`, the shared storage key and `findHtmlEntries` (including the ignored directories).

## Mounting the site navigation in the app

`src/ui/app.ts` does not mount the nav yet. A minimal integration:

```ts
import { createSiteNav } from './site-nav';

let siteNav = createSiteNav(getLang());
header.append(siteNav);
onLangChange((lang) => {
  const next = createSiteNav(lang);
  siteNav.replaceWith(next);
  siteNav = next;
});
```

The nav's labels and hrefs depend on the language, so it is rebuilt rather than re-translated. Importing `site-nav.ts` brings `site-nav.css` into the app bundle; it only uses the shared tokens.
