# SEO + AIEO + GEO research: 티렉스 대 호랑이 / T-Rex vs Tiger

- **As of:** 2026-10-19. Every factual claim has a source tag `[S#]`; the URLs are listed in [§9 Sources](#9-sources).
- **Site:** <https://trex-vs-tiger.vinylims.com/>. It runs on Cloudflare Pages with a custom domain on the `vinylims.com` zone. Bot Fight Mode is on, the primary audience is Korean, and there is an English version.
- **Code read (read-only):** `index.html`, `public/_headers`, `docs/MODEL.md`, `docs/DEPLOYMENT.md`, `src/ui/i18n.ts`, `src/ui/app.ts`, `src/ui/share.ts`, `src/ui/styles.css`.
- **Evidence labels:**
  - **[verified]**: primary source (spec, vendor documentation, vendor blog).
  - **[observed]**: my own live probe or local test on 2026-10-19.
  - **[secondary]**: third-party write-up.
  - **[inference]**: my reasoning. Test it before relying on it.
- **Related user request:** "폰트는 pretendard로 통일해" (use Pretendard for all fonts). This report covers only the SEO and Core Web Vitals side of that change ([§1.7](#17-core-web-vitals-and-the-pretendard-switch)) and the OG image ([§3](#3-open-graph--twitter-cards--messenger-previews)). The font change itself belongs to another track.

---

## 0. Executive summary

### 0.1 What is wrong today ([observed], live probes on 2026-10-19)

| #   | Finding                                                                                                                                                                                                                                                                                         | Evidence                                           | Impact                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/robots.txt`, `/llms.txt`, `/sitemap.xml` and any unknown path return the SPA shell (`index.html`) with **HTTP 200 `text/html`**.                                                                                                                                                              | `curl` on each path: 200, `text/html`, 1703–2641 B | Naver treats an HTML robots.txt as "no robots.txt" [S66]. Unknown URLs become soft 404s [S4]. No sitemap can be discovered. Pages does this because the build has no top-level `404.html` [S47]. Cloudflare's managed robots.txt prepends to whatever 200 response the origin returns [S35].                                                                                                                                                                      |
| 2   | **Training crawlers are blocked at the edge.** Requests with GPTBot, ClaudeBot, CCBot or Bytespider user agents get **403** on `/`. OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, meta-externalagent, Yeti, kakaotalk-scrap and Googlebot user agents get **200**. | `curl -A <UA>`, one request each                   | The zone has an AI-training block active (the legacy "Block AI bots" or the new Training control) without any matching robots.txt statement. This is the "stated vs enforced mismatch" Cloudflare itself warns about [S44]. It reduces visibility in model knowledge. Real Googlebot and Bingbot cannot be tested from outside, so the owner must check the setting: since 2026-09-15, **"Block" on Training also blocks Googlebot, Bingbot and Applebot** [S45]. |
| 3   | Pages under the SPA fallback (for example `/guide/`) get Bot Fight Mode's **inline JavaScript Detections script injected**. `/` does not, because it has `no-transform`.                                                                                                                        | `diff` of `/robots.txt` vs `/guide/` bodies        | When the static pages `/guide/` … `/en/...` ship, they will log CSP violations unless their HTML responses also carry `Cache-Control: no-transform` [S39], [S31].                                                                                                                                                                                                                                                                                                 |
| 4   | `https://trex-vs-tiger-sim.pages.dev/` (production) serves the same HTML and has **no `X-Robots-Tag`**. Pages adds `noindex` only to preview URLs.                                                                                                                                              | `curl -I`                                          | Duplicate host. Fix it with a self-referencing canonical plus a Bulk Redirect [S7], [S47], [S50].                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Missing head tags: `index.html` has no `<link rel=canonical>`, no hreflang, no `og:url`, no `og:image`, no `og:locale` and no JSON-LD. `twitter:card` is `summary`. The `<title>` is English on a `lang="ko"` page.                                                                             | `index.html`                                       | Weak snippets, no share image, and no entity data.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | The app overwrites `document.title` with `t('app.title')` ("티라노사우루스 vs 호랑이 시뮬레이터"). The language comes from `localStorage`, not from the URL.                                                                                                                                    | `src/ui/app.ts:67,575`, `src/ui/i18n.ts:480-485`   | Google indexes the rendered title, so the static title is ignored. A single URL serving two languages cannot be targeted with hreflang. Google advises separate URLs per language and no auto-redirects [S6].                                                                                                                                                                                                                                                     |
| 7   | All page content is client-rendered. The only static body text is the `<noscript>` notice.                                                                                                                                                                                                      | `index.html`                                       | GPTBot, ClaudeBot and other AI crawlers **do not execute JavaScript** [S61]. Naver indexes the static HTML first and renders later [S67]. Today those systems see an empty page.                                                                                                                                                                                                                                                                                  |

### 0.2 Top recommendations, in priority order

1. **(Owner, Cloudflare) Fix the AI bot policy first.** In Security → Settings → Bot traffic → _Configure AI bot policies_, set **Search = Allow** and **Agent = Allow**. Set **Training = Allow** for maximum visibility, or _Disallow AI Training_ if the owner prefers. **Never pick "Block"** for Training: it now also blocks Googlebot, Bingbot and Applebot [S45], [S34]. Then check AI Crawl Control → Crawlers for per-crawler blocks [S38].
2. **(Code) Add `public/404.html`** (ko, with a link to `/en/`). This turns off the SPA fallback [S47]. Also add real `robots.txt`, `sitemap.xml` and `llms.txt` files. The app keeps its state in `#s=…` (`src/ui/share.ts`), so it does not need the fallback.
3. **(Code) Separate the language URLs.** Korean lives at `/…` and English at `/en/…`, each with a static `<html lang>`, title, description, canonical and full hreflang set (`ko`, `en`, `x-default`) [S5]. The app should read its language from the URL. The language toggle should navigate to the other URL and keep the `#s=` hash. Remove the `document.title` override, or make it match the static title.
4. **(Code) Put crawlable static content in `index.html` and `/en/index.html`.** Add an answer-first summary with the key numbers, a "how it works" section, a visible FAQ and links to the content pages. Place it **outside `#app`** so it stays visible after the app mounts ([§1.5](#15-crawlable-static-content-for-the-js-app-page)).
5. **(Code) Add JSON-LD:** WebSite, WebApplication, Person, BreadcrumbList and TechArticle, plus FAQPage only where a visible FAQ exists. Static inline JSON-LD **is compatible with `script-src 'self'`**: data blocks are never executed, so CSP never evaluates them [S29], [S30]. I confirmed this in Chromium 140, and Vite 8.3.4 keeps the block untouched ([§2.2](#22-csp-script-src-self-and-inline-json-ld)).
6. **(Code) Add OG and Twitter tags with a 1200×630 PNG or JPG per language.** Keep the important content in a centred 2:1 safe area, because Kakao smart-crops to 800×400 and accepts only JPG/PNG [S82]. Use versioned image URLs.
7. **(Code) Add `Cache-Control: no-transform` to every HTML route in `_headers`**, not only `/`. This keeps Bot Fight Mode's inline script out [S39].
8. **(Owner)** Set up Search Console (Domain property by DNS TXT on `vinylims.com`) [S18], Bing Webmaster Tools (import from GSC) [S76], Naver Search Advisor (HTML meta tag) [S73] and Daum (robots.txt PIN) [S74]. Submit the sitemap to each. Check the GSC **Search generative AI** control is "Include" [S19].
9. **(Code + owner) IndexNow.** Host `/<key>.txt` and ping `api.indexnow.org` after each production deploy. One ping reaches Bing, Naver, Yandex, Seznam, Yep, Internet Archive and Amazon [S75].
10. **(Code) Optional `llms.txt` (v2 spec) plus Markdown copies of the docs pages** [S62]. Google Search ignores these files (no harm, no gain) [S2]. Other agents and Lighthouse's agentic audit use them [S27].

---

## 1. On-page SEO

### 1.1 URL architecture, languages and Pages routing behaviour

**Pages behaviour to design around [verified, S47]:**

- Pages serves a matching HTML file and **redirects `/x.html` → `/x` and `/x/index.html` → `/x/`**.
- With no top-level `404.html`, Pages assumes a SPA and serves `/` for every unknown path.
- With a `404.html`, it serves the closest 404 page up the directory tree, for example `/en/404.html` for English paths.

**Recommended URL set.** Every URL is a directory with a trailing slash, matching what Pages redirects to:

| Purpose              | ko (default)   | en                |
| -------------------- | -------------- | ----------------- |
| Simulator (app)      | `/`            | `/en/`            |
| Guide / how to use   | `/guide/`      | `/en/guide/`      |
| Model explainer      | `/model/`      | `/en/model/`      |
| Parameters & sources | `/parameters/` | `/en/parameters/` |
| About / author       | `/about/`      | `/en/about/`      |
| Privacy              | `/privacy/`    | `/en/privacy/`    |
| License              | `/license/`    | `/en/license/`    |
| 404                  | `/404.html`    | `/en/404.html`    |

**Rules:**

- Use **different URLs per language**. Google does not use cookies or browser settings to pick a language, and Googlebot sends no `Accept-Language` header [S6].
- **Never auto-redirect** visitors by language [S6].
- Set `<html lang="ko">` or `<html lang="en">` statically in each file. `initLang()` should take the language from `location.pathname` (`/en/` → `en`) rather than from `localStorage`, so the URL, the `lang` attribute and the content always agree.
- Keep the share state in the fragment (`#s=…`). Google and Naver both strip fragments, so `/` stays the canonical page for every shared scenario [S4], [S67]. Do not move to `?s=` query strings, which would create crawlable duplicates.

### 1.2 Titles and meta descriptions

Google and Naver both want a unique, descriptive title and description on every page.

- Naver recommends the brand name in the home page title and warns against identical titles across pages [S71].
- Google allows JavaScript to set them, but the static HTML value is the robust one [S4].
- Lighthouse's SEO audit fails a page with no meta description [S26].

**Fix the entity name first (see [§5.4](#54-entity-consistency)).** It is currently inconsistent:

- static `<title>`: "T-Rex vs Tiger Simulator";
- JavaScript title: "티라노사우루스 vs 호랑이 시뮬레이터";
- task brief: "티렉스 대 호랑이 / T-Rex vs Tiger".

The table below proposes one Korean name ("티렉스 대 호랑이") and one English name ("T-Rex vs Tiger"), with "티라노사우루스 vs 호랑이" as a Korean alternate name. These are recommendations, not sourced facts.

| URL            | `<title>`                                                                               | `<meta name="description">`                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | 티렉스 대 호랑이 시뮬레이터 – 티라노사우루스 vs 호랑이, 누가 이길까?                    | 티라노사우루스 N마리와 호랑이 M마리가 싸우면 누가 이길까? 문헌 기반 파라미터로 몬테카를로 전투를 수백 번 돌려 승률(95% 신뢰구간)·전투 시간·민감도를 보여주는 무료 브라우저 시뮬레이터.                               |
| `/en/`         | T-Rex vs Tiger Simulator – who wins, N T. rex or M tigers?                              | Free in-browser Monte Carlo, agent-based simulator. Pick how many Tyrannosaurus rex and tigers fight, sample literature-based parameter ranges and get win probabilities with 95% CIs, battle times and sensitivity. |
| `/guide/`      | 사용 가이드 – 티렉스 대 호랑이 시뮬레이터                                               | 시나리오 설정, 파라미터 범위 편집, 결과 해석(승률·히스토그램·토네이도 차트)과 URL 공유 방법을 단계별로 설명합니다.                                                                                                   |
| `/model/`      | 시뮬레이션 모델 설명(몬테카를로·에이전트 기반) – 티렉스 대 호랑이                       | 2단계 불확실성(LHS 샘플링·개체 변이), 물기·매달리기·출혈·사기 규칙, 기본 결과와 한계를 출처와 함께 설명합니다.                                                                                                       |
| `/parameters/` | 파라미터와 출처: 체중·교합력·속도 – 티렉스 대 호랑이                                    | 티라노사우루스와 호랑이의 22개 파라미터 범위(min·mode·max)와 근거 논문(DOI), 추정치 여부를 표로 정리했습니다.                                                                                                        |
| `/about/`      | 소개 – 티렉스 대 호랑이 시뮬레이터를 만든 사람                                          | 프로젝트 목적, 만든 사람(VinylStage), 소스 코드와 연락처.                                                                                                                                                            |
| `/privacy/`    | 개인정보 처리방침 – 티렉스 대 호랑이                                                    | 이 사이트는 백엔드·추적·쿠키 없이 브라우저에서만 계산합니다. 저장하는 정보와 그 이유.                                                                                                                                |
| `/license/`    | 라이선스(MIT) – 티렉스 대 호랑이                                                        | 소스 코드(MIT)와 문서·이미지의 이용 조건.                                                                                                                                                                            |
| `/en/...`      | English equivalents, e.g. "Model explained (Monte Carlo, agent-based) – T-Rex vs Tiger" | English equivalents                                                                                                                                                                                                  |

### 1.3 Canonical

- Put **one absolute, self-referencing canonical in the static HTML** of every page, for example `<link rel="canonical" href="https://trex-vs-tiger.vinylims.com/model/">`.
- JavaScript must never change it. Google's December 2025 guidance: set the canonical in the original HTML. If JavaScript has to set it, it must be the same URL, because canonicalization happens both before and after rendering [S4], [S3].
- Each language version is canonical to **itself**, not to the Korean page. hreflang only works between canonical pages [S5].
- Fix the `pages.dev` duplicate with a **Bulk Redirect**: `trex-vs-tiger-sim.pages.dev` → `https://trex-vs-tiger.vinylims.com`, 301, preserve path and query [S50]. **Do not tick "Include subdomains"**, so that preview URLs (`<hash>.trex-vs-tiger-sim.pages.dev`, already `noindex` [S47]) keep working for PR previews [inference].

### 1.4 hreflang, including x-default

**Rules [verified, S5]:**

- Every language version lists **itself and all the others**.
- URLs must be fully qualified.
- Links must be **bidirectional**, or Google ignores them.
- `x-default` names the fallback for unmatched languages.
- The same set can go in HTML `<link>` tags, HTTP `Link` headers or the sitemap.

**x-default choice [inference]:** point `x-default` at the **English** URL. Readers whose language is neither Korean nor English are more likely to read English. Korean readers are matched by `hreflang="ko"`.

Head block, identical on `/model/` and `/en/model/`:

```html
<link rel="canonical" href="https://trex-vs-tiger.vinylims.com/model/" />
<!-- on /en/model/ use the /en/model/ URL -->
<link rel="alternate" hreflang="ko" href="https://trex-vs-tiger.vinylims.com/model/" />
<link rel="alternate" hreflang="en" href="https://trex-vs-tiger.vinylims.com/en/model/" />
<link rel="alternate" hreflang="x-default" href="https://trex-vs-tiger.vinylims.com/en/model/" />
```

**Sitemap alternative** (keep both, or just one; they must agree). Google ignores `<priority>` and `<changefreq>`, and uses `<lastmod>` only if it is accurate [S16].

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://trex-vs-tiger.vinylims.com/</loc>
    <lastmod>2026-10-19</lastmod>
    <xhtml:link rel="alternate" hreflang="ko" href="https://trex-vs-tiger.vinylims.com/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://trex-vs-tiger.vinylims.com/en/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://trex-vs-tiger.vinylims.com/en/"/>
  </url>
  <url>
    <loc>https://trex-vs-tiger.vinylims.com/en/</loc>
    <lastmod>2026-10-19</lastmod>
    <xhtml:link rel="alternate" hreflang="ko" href="https://trex-vs-tiger.vinylims.com/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://trex-vs-tiger.vinylims.com/en/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://trex-vs-tiger.vinylims.com/en/"/>
  </url>
  <!-- repeat the pair for /guide/, /model/, /parameters/, /about/, /privacy/, /license/ -->
</urlset>
```

Naver accepts the same sitemap and recommends listing every URL [S69].

### 1.5 Crawlable static content for the JS app page

**Why it matters:**

- Google renders JavaScript, but still calls server-side rendering or prerendering "a great idea … not all bots can run JavaScript" [S4].
- In Vercel's December 2024 measurement, **none of the major AI crawlers (GPTBot/ChatGPT, ClaudeBot) executed JavaScript**. Gemini, through Googlebot, and Applebot did [S61].
- Naver's Yeti indexes the **static HTML first** and renders JavaScript only on a later visit [S67].
- Microsoft's guidance for AI answers: do not hide key information behind JavaScript, in tabs or collapsed elements, or only in images [S65].

**How [inference, matched to this codebase]:**

- Put a static `<header>`, an `<article>` and a `<footer>` in `index.html` **as siblings of `<div id="app">`**. Keep them outside it, so `mount()` does not replace them and Googlebot's rendered DOM still contains them.
- Visually, put the article below the simulator, or above it in a collapsed hero. Keep the text in the DOM, not in `<noscript>`.
- Write the facts as plain sentences with numbers. Those are what answer engines quote ([§5.3](#53-content-patterns-that-earn-citations-geo)).
- Skeleton for `/` (the English `/en/index.html` mirrors it):

```html
<body>
  <header class="site-header">
    <a href="/" class="brand">티렉스 대 호랑이</a>
    <nav aria-label="사이트">
      <a href="/guide/">사용 가이드</a> <a href="/model/">모델 설명</a>
      <a href="/parameters/">파라미터·출처</a> <a href="/about/">소개</a>
      <a href="/en/" hreflang="en" lang="en">English</a>
    </nav>
  </header>

  <div id="app"></div>
  <!-- simulator mounts here -->

  <article id="summary">
    <h1>티렉스 대 호랑이 시뮬레이터: 티라노사우루스 10마리 vs 호랑이 100마리, 누가 이길까?</h1>
    <p>
      <strong>짧은 답:</strong> 기본 가정(사기 ON, 측면 공격, 500회 몬테카를로)에서는
      티라노사우루스가 거의 항상 이깁니다. T-Rex 승률 100%(Wilson 95% 신뢰구간 99.2–100%), 전투 시간
      중앙값 약 26초, 호랑이 평균 14.1마리 사망·85.9마리 도주.
    </p>
    <p>
      이 결과는 예측이 아니라 가정에 대한 민감도입니다. 두 종은 같은 시대에 살지 않았고, 상호작용
      규칙은 모두 가정입니다.
    </p>
    <h2>호랑이가 이기려면?</h2>
    <ul>
      <li>
        사기를 끄고(죽을 때까지 싸움) 호랑이 피해율(dps)을 기본값의 약 3–7배로 올리면 호랑이 승률
        8–46%.
      </li>
      <li>
        사기 OFF에서 T-Rex 1마리당 호랑이 약 30마리부터 호랑이가 이기기 시작하고, 100마리면 모든
        실행에서 이깁니다.
      </li>
    </ul>
    <h2>어떻게 계산하나요?</h2>
    <p>
      22개 파라미터를 삼각분포(min·mode·max)에서 라틴 하이퍼큐브로 뽑고 …
      <a href="/model/">모델 설명 보기</a>
    </p>
    <h2>자주 묻는 질문</h2>
    <h3>티라노사우루스와 호랑이가 실제로 싸운 적이 있나요?</h3>
    <p>
      없습니다. T. rex는 약 6,800만–6,600만 년 전 백악기 말에 살았고, 호랑이는 플라이스토세 이후의
      동물입니다.
    </p>
    <!-- 4–6 more Q/A, visible, not collapsed -->
    <p>
      출처: <a href="/parameters/">파라미터와 참고문헌</a> · 만든 사람:
      <a href="/about/">VinylStage</a> · 업데이트 2026-10-19
    </p>
  </article>

  <footer>… <a href="/privacy/">개인정보</a> <a href="/license/">라이선스(MIT)</a> …</footer>
  <noscript>…existing notice…</noscript>
</body>
```

The numbers above are copied from `docs/MODEL.md` §6–7, the preliminary 500-run results at seed 20261019. Keep them in sync with that file, or render them at build time from the same source.

### 1.6 Internal linking

- Every page carries the same `<nav>` and footer: app, guide, model, parameters, about, privacy, license, plus the other language. Links are plain `<a href>` elements, which is what Google can crawl [S4].
- **Contextual links:**
  - the app summary links to `/model/` and `/parameters/`;
  - `/model/` links each parameter name to its anchor on `/parameters/` (for example `/parameters/#trex-biteForce`);
  - `/guide/` links to the app with a preset `#s=` scenario. The fragment is not indexed, but users and agents can follow it.
- A visible breadcrumb on content pages matches the BreadcrumbList markup ([§2.3](#23-json-ld-examples-copy-ready)). Structured data must match visible content [S14].
- Link the GitHub repository and `https://link.vinylims.com` from `/about/`, and link back from those properties ([§5.4](#54-entity-consistency)).

### 1.7 Core Web Vitals and the Pretendard switch

- **Thresholds at the 75th percentile [verified, S23]:** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- **LCP:** the static `<h1>` and summary paragraph in §1.5 become the LCP element without waiting for JavaScript. Keep the hero free of large images.
- **INP:** simulations already run in Web Workers (`src/workers/`). Keep the main thread free during runs, and keep chart and replay rendering in small chunks.
- **CLS:**
  - reserve fixed heights or `aspect-ratio` for the results panel, charts and the replay canvas before data arrives;
  - CLS is also an input to Lighthouse's agentic-browsing checks [S28].

**Pretendard [verified unless noted]:**

- The CSP is `font-src 'self'` and `style-src 'self'`, so the CDN `<link>`/`@import` snippets in the Pretendard README are **blocked**. The font must be **self-hosted**: copy the files from the `pretendard` npm package, version 1.3.9, licensed OFL-1.1 [S84].
- Use the **variable dynamic-subset** build. It has 92 `@font-face` blocks with `unicode-range`, so a page downloads only the slices it uses. The single-file `PretendardVariable.woff2` is about 2.06 MB [S84] [observed via unpkg].
- Keep `font-display: swap`, which the Pretendard CSS already sets.
- Add a fallback `@font-face` with `size-adjust` and ascent/descent overrides, matched to the system fallback, so the swap does not shift layout [S25].
- The README's recommended stack starts with `"Pretendard Variable", Pretendard, -apple-system, …` [S84].
- **Preloading:**
  - be careful: `preload` ignores `unicode-range`, so preload at most the one subset that covers the above-the-fold Hangul and Latin glyphs, or none [S24];
  - a font preload needs `crossorigin`, and Pages' automatic Early Hints skips `<link>` elements that carry `crossorigin`. To get an Early Hint, add an explicit `Link: </fonts/…woff2>; rel=preload; as=font; crossorigin` header in `_headers` [S49].
- The OFL permits using Pretendard to render the OG images in §3 [S84].

---

## 2. Structured data

### 2.1 Which types and why

| Type                                                | Page(s)                                                    | Google rich result?                                                                                                                                                                                                | Why include                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebSite` (`name`, `alternateName`, `url`)          | home `/` only                                              | No result card; feeds the **site name** shown in results                                                                                                                                                           | Google reads `WebSite` on the domain or subdomain **home page** to choose the site name. One site name per host. Subdirectory home pages such as `/en/` are not supported [S8].                                                                                                                                 |
| `WebApplication` (subtype of `SoftwareApplication`) | `/`, `/en/`                                                | **Not eligible.** Google requires `name`, `offers.price` **and** a rating or review for the software-app rich result [S9].                                                                                         | Entity description: free (`price: 0`), category, OS and features. **Never invent `aggregateRating` or `review`.** Fake reviews violate the structured data guidelines [S14].                                                                                                                                    |
| `Person` (author, `sameAs`)                         | referenced from every page via `@id`                       | No                                                                                                                                                                                                                 | Author disambiguation. Google reads `author.url` and/or `sameAs` [S11].                                                                                                                                                                                                                                         |
| `BreadcrumbList`                                    | all content pages                                          | **Yes**, breadcrumb display                                                                                                                                                                                        | Required: `itemListElement`, `position`, `name`, `item` [S10].                                                                                                                                                                                                                                                  |
| `TechArticle`                                       | `/model/`, `/parameters/`, `/guide/`, ko and en            | Article enhancements (title, date, image)                                                                                                                                                                          | Google's Article docs list `Article`, `NewsArticle` and `BlogPosting` as the supported types [S11]. `TechArticle` is a schema.org subtype of `Article` [S86]. [inference] If the Rich Results Test does not detect it, use `"@type": "Article"` and keep `TechArticle` semantics in `about`/`proficiencyLevel`. |
| `FAQPage`                                           | only pages with a **visible** FAQ (`/`, `/en/`, `/guide/`) | **No longer.** In August 2023 Google limited FAQ rich results to authoritative government and health sites [S15]. The feature was then **deprecated on 2026-05-07, and its docs were removed on 2026-06-15** [S3]. | Low priority. "Structured data that's not being used does not cause problems for Search" [S15]. The value is in the visible Q&A pairs, which AI answers lift word for word [S65], plus understanding by other consumers [inference]. Add the JSON-LD only if it is cheap to keep in sync with the visible FAQ.  |
| `AboutPage` / `ProfilePage`                         | `/about/`                                                  | No                                                                                                                                                                                                                 | Points to the `Person`. Google recommends profile-page markup when `author.url` is an internal profile page [S11]. Optional.                                                                                                                                                                                    |

General guidance:

- Google recommends **JSON-LD**, in `<head>` or `<body>` [S12].
- Structured data must describe **visible** content [S14].
- Google says it isn't required for generative AI search, and there is no special AI schema [S2], [S1].

### 2.2 CSP `script-src 'self'` and inline JSON-LD

**Spec [verified]:**

- The HTML standard says a `<script>` whose `type` is not a JavaScript MIME type, `module`, `importmap` or `speculationrules` is a **data block**, "not processed by the user agent" [S29, #data-block].
- In _prepare the script element_, the type check returns early with "**No script is executed**" [S29, #prepare-the-script-element].
- That return happens **before** the step that calls CSP's _Should element's inline type behavior be blocked by Content Security Policy?_ [S30].
- So `<script type="application/ld+json">` never reaches the CSP inline check. It needs no `'unsafe-inline'`, hash or nonce.

**Browser test [observed]:**

- Setup: a local server sent `Content-Security-Policy: default-src 'self'; script-src 'self'; …`, with headless Chromium 140.0.7339.186.
- The page had an inline JSON-LD block, an inline `<script>` control, and a same-origin external script that parsed the JSON-LD.
- Result:
  - the external script **parsed the JSON-LD successfully**;
  - the inline JavaScript control was blocked;
  - the console showed **exactly one** CSP violation, for the inline JavaScript only.

**Build [observed]:** Vite 8.3.4 (the repo's version) copied an inline `<script type="application/ld+json">` from `index.html` into `dist/index.html` byte-for-byte.

**Google [verified]:** JSON-LD can be static or dynamically injected. Google reads injected markup from the rendered HTML [S12], [S13]. Static is better here because:

- Bing, Naver and AI crawlers that do not render JavaScript also see it [S61], [S67];
- no extra script is needed.

**Repo follow-up [inference]:** `docs/DEPLOYMENT.md` currently says "no inline `<script>` … in `index.html`". Amend it to exempt `type="application/ld+json"` data blocks, and add a test that every inline `<script>` in `dist/**/*.html` has that type. Never let `</script` appear inside the JSON; escape it as `<\/script`.

### 2.3 JSON-LD examples (copy-ready)

Use one stable `@id` per entity and reference it everywhere.

- Person `@id`: `https://link.vinylims.com/#person`.
- If the owner adds the same Person node to `link.vinylims.com` and `vinylims.com`, the entity is consistent across properties [inference].
- The author name below is "VinylStage" (the LICENSE copyright holder). The owner should replace it if they want a real name shown.

**A. Home `/` (Korean), `<head>`:**

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://trex-vs-tiger.vinylims.com/#website",
        "url": "https://trex-vs-tiger.vinylims.com/",
        "name": "티렉스 대 호랑이",
        "alternateName": ["T-Rex vs Tiger", "티라노사우루스 vs 호랑이 시뮬레이터"],
        "inLanguage": ["ko", "en"],
        "publisher": { "@id": "https://link.vinylims.com/#person" }
      },
      {
        "@type": "WebApplication",
        "@id": "https://trex-vs-tiger.vinylims.com/#app",
        "name": "티렉스 대 호랑이 시뮬레이터",
        "alternateName": "T-Rex vs Tiger Simulator",
        "url": "https://trex-vs-tiger.vinylims.com/",
        "description": "티라노사우루스 N마리와 호랑이 M마리의 가상 전투를 문헌 기반 파라미터 범위로 반복 시뮬레이션해 승률(Wilson 95% 신뢰구간), 전투 시간, 파라미터 민감도를 보여주는 몬테카를로 에이전트 기반 시뮬레이터.",
        "inLanguage": "ko",
        "applicationCategory": "EducationalApplication",
        "applicationSubCategory": "Monte Carlo simulation",
        "operatingSystem": "Any (modern web browser)",
        "browserRequirements": "Requires JavaScript and Web Workers",
        "isAccessibleForFree": true,
        "offers": { "@type": "Offer", "price": 0, "priceCurrency": "KRW" },
        "softwareVersion": "0.1.0",
        "license": "https://opensource.org/licenses/MIT",
        "image": "https://trex-vs-tiger.vinylims.com/og/home-ko-1200x630.png",
        "screenshot": "https://trex-vs-tiger.vinylims.com/og/home-ko-1200x630.png",
        "featureList": [
          "티라노사우루스·호랑이 수, 실행 횟수, 시드, 경기장 크기 설정",
          "22개 파라미터의 (min, mode, max) 범위 편집",
          "라틴 하이퍼큐브 샘플링과 개체 변이",
          "Wilson 95% 신뢰구간 승률, 히스토그램, Spearman 민감도(토네이도 차트)",
          "대표 전투 애니메이션 재생, URL로 시나리오 공유"
        ],
        "about": [
          {
            "@type": "Thing",
            "name": "Tyrannosaurus",
            "sameAs": [
              "https://www.wikidata.org/wiki/Q14332",
              "https://en.wikipedia.org/wiki/Tyrannosaurus"
            ]
          },
          {
            "@type": "Thing",
            "name": "Tiger",
            "sameAs": [
              "https://www.wikidata.org/wiki/Q19939",
              "https://en.wikipedia.org/wiki/Tiger"
            ]
          },
          {
            "@type": "Thing",
            "name": "Monte Carlo method",
            "sameAs": "https://www.wikidata.org/wiki/Q232207"
          }
        ],
        "author": { "@id": "https://link.vinylims.com/#person" },
        "isPartOf": { "@id": "https://trex-vs-tiger.vinylims.com/#website" }
      },
      {
        "@type": "Person",
        "@id": "https://link.vinylims.com/#person",
        "name": "VinylStage",
        "url": "https://link.vinylims.com/",
        "sameAs": [
          "https://link.vinylims.com",
          "https://vinylims.com",
          "https://github.com/VinylStage"
        ]
      }
    ]
  }
</script>
```

Notes:

- Google lists `EducationalApplication` among the supported `applicationCategory` values [S9].
- For free apps, Google says to set `offers.price` to `0`. `priceCurrency` is only recommended when the price is above 0 [S9]. Keeping it is harmless.
- I checked the Wikidata IDs on 2026-10-19: Q14332 = _Tyrannosaurus_ (ko "티라노사우루스"), Q19939 = _tiger_ ("호랑이"), Q232207 = _Monte Carlo method_ [S87].
- **Do not add `aggregateRating`** ([§2.1](#21-which-types-and-why)).

**B. Home `/en/`:** use the same graph, with these changes:

- `"@id": "https://trex-vs-tiger.vinylims.com/en/#app"`, `"inLanguage": "en"`, `"url": "https://trex-vs-tiger.vinylims.com/en/"`;
- English `name`, `description` and `featureList`;
- `"offers": {"@type":"Offer","price":0,"priceCurrency":"USD"}`;
- leave out the `WebSite` node, which belongs on the host home page only [S8]. Reference it instead: `"isPartOf": {"@id": "https://trex-vs-tiger.vinylims.com/#website"}`.

**C. `/model/` (Korean) — TechArticle + BreadcrumbList:**

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": "https://trex-vs-tiger.vinylims.com/model/#article",
        "mainEntityOfPage": "https://trex-vs-tiger.vinylims.com/model/",
        "headline": "시뮬레이션 모델 설명: 몬테카를로·에이전트 기반 티라노사우루스 vs 호랑이",
        "description": "2단계 불확실성(LHS 샘플링·개체 변이), 물기·매달리기·출혈·사기 규칙, 기본 결과와 한계를 출처와 함께 설명합니다.",
        "inLanguage": "ko",
        "datePublished": "2026-10-19T00:00:00+09:00",
        "dateModified": "2026-10-19T00:00:00+09:00",
        "image": ["https://trex-vs-tiger.vinylims.com/og/model-ko-1200x630.png"],
        "author": {
          "@type": "Person",
          "@id": "https://link.vinylims.com/#person",
          "name": "VinylStage",
          "url": "https://link.vinylims.com/"
        },
        "publisher": { "@id": "https://link.vinylims.com/#person" },
        "isPartOf": { "@id": "https://trex-vs-tiger.vinylims.com/#website" },
        "about": { "@id": "https://trex-vs-tiger.vinylims.com/#app" },
        "proficiencyLevel": "Beginner",
        "citation": [
          "https://doi.org/10.1038/nature02699",
          "https://doi.org/10.1002/ar.24118",
          "https://doi.org/10.1371/journal.pone.0026037",
          "https://doi.org/10.1038/s41598-017-02161-w",
          "https://doi.org/10.1098/rsbl.2012.0056",
          "https://doi.org/10.1098/rspb.2004.2986"
        ]
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "티렉스 대 호랑이",
            "item": "https://trex-vs-tiger.vinylims.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "모델 설명",
            "item": "https://trex-vs-tiger.vinylims.com/model/"
          }
        ]
      }
    ]
  }
</script>
```

The `citation` values are the DOIs already listed in `docs/MODEL.md` §9. On `/parameters/`, list them all. Google uses image URLs only if they are crawlable, and wants several aspect ratios (16:9, 4:3, 1:1) of at least 50K pixels [S11]. A single 1200×630 image is acceptable; add 1:1 and 4:3 crops if they are cheap to produce.

**D. `/guide/` — visible FAQ mirrored as FAQPage (optional; no rich result since 2026-05-07 [S3]):**

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "inLanguage": "ko",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "티라노사우루스 10마리와 호랑이 100마리가 싸우면 누가 이기나요?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "기본 가정(사기 ON, 500회)에서는 티라노사우루스가 100% 이겼습니다(Wilson 95% 신뢰구간 99.2–100%). 전투 시간 중앙값은 약 26초이며 호랑이 약 14마리가 죽고 86마리가 도주합니다. 예측이 아니라 가정에 따른 결과입니다."
        }
      },
      {
        "@type": "Question",
        "name": "티라노사우루스와 호랑이가 실제로 만난 적이 있나요?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "없습니다. 티라노사우루스는 약 6,800만–6,600만 년 전 백악기 말에 살았고 호랑이는 플라이스토세 이후의 동물이라 공존한 적이 없습니다."
        }
      }
    ]
  }
</script>
```

The text must match the visible Q&A word for word [S14].

**E. BreadcrumbList for `/en/parameters/`:** positions 1 "T-Rex vs Tiger" → `https://trex-vs-tiger.vinylims.com/en/` and 2 "Parameters & sources" → `https://trex-vs-tiger.vinylims.com/en/parameters/`.

**Naver "연관 채널" (related channels) [verified, S72]:**

- Naver reads a `Person` or `Organization` node with `name`, `url` and `sameAs` on the **site root page**.
- It only uses channels from its supported list: Naver Blog/TV/Store/KnowledgeiN/Chzzk, Daangn, Threads, Instagram, YouTube, KakaoStory, KakaoTalk Channel, Tistory, TikTok, Facebook, X.
- GitHub and personal domains are not on that list, so the Person node above is harmless but gives no Naver channel feature. If the owner has a YouTube, X or Instagram account, add it to `sameAs`.

---

## 3. Open Graph / Twitter cards / messenger previews

### 3.1 Tag set (Korean home; English pages swap the values and locales)

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="티렉스 대 호랑이" />
<meta property="og:title" content="티렉스 대 호랑이 시뮬레이터 – 누가 이길까?" />
<meta
  property="og:description"
  content="티라노사우루스 N마리 vs 호랑이 M마리, 몬테카를로로 수백 번 싸워 승률을 계산합니다. 브라우저에서 무료로."
/>
<meta property="og:url" content="https://trex-vs-tiger.vinylims.com/" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:locale:alternate" content="en_US" />
<meta
  property="og:image"
  content="https://trex-vs-tiger.vinylims.com/og/home-ko-1200x630.png?v=1"
/>
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta
  property="og:image:alt"
  content="티라노사우루스 실루엣과 호랑이 무리, '누가 이길까?' 문구와 승률 막대그래프"
/>
<meta name="twitter:card" content="summary_large_image" />
<meta
  name="twitter:image:alt"
  content="티라노사우루스 실루엣과 호랑이 무리, '누가 이길까?' 문구와 승률 막대그래프"
/>
```

- `og:locale` uses the `language_TERRITORY` form, and `og:locale:alternate` lists the other locales [S78].
- Pages that specify `og:image` should also give `og:image:alt` [S78].
- X falls back to `og:title`, `og:description` and `og:image`, so only `twitter:card` (and the alt text) needs a separate tag [S80] [secondary].
- **`og:url` must equal the canonical URL exactly, trailing slash included.** Kakao fetches the `og:url` address if it differs from the shared one [S82]. Kakao also caches the slash and no-slash forms separately [S82] [secondary].

### 3.2 Image specification

| Platform                 | What its docs say                                                                                                                                                                         | Source                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Facebook / Meta          | Use at least **1200×630** for high-resolution displays. 600×315 minimum for large-image posts; 200×200 absolute minimum; ≤ 8 MB. Cached **by image URL**, so a new image needs a new URL. | [S79] [secondary summary of the official page] |
| X                        | `summary_large_image`: **2:1**, minimum 300×157, maximum 4096×4096, < 5 MB. JPG, PNG, WEBP, GIF (first frame). **No SVG.** Alt text ≤ 420 chars.                                          | [S80] [secondary via legacy doc]               |
| KakaoTalk                | OG tags required. Images **JPG/JPEG/PNG only**, smart-cropped to **800×400 (2:1)**. Page must return 200 on port 80/443. Redirects: the first landing page is scraped.                    | [S82]                                          |
| Naver (search thumbnail) | `og:image` larger than 150×150, at least 5,000 bytes, aspect ratio ≤ 3:1, and a **unique image per page**. Site-wide logos or banners are not treated as representative.                  | [S71]                                          |
| Slack                    | Fetches with `Slackbot-LinkExpanding 1.0` using **HTTP Range requests**. Reads oEmbed, Twitter Card and OG tags. Does not honor robots.txt.                                               | [S81]                                          |
| Discord                  | No official spec found. Uses OG tags via `Discordbot`.                                                                                                                                    | [S83] [secondary]                              |

**Recommendation [inference from the table]:**

- **1200×630 PNG** (or high-quality JPG), under about 300 KB, served from `/og/`.
- Keep text and subjects inside a **centred 1200×600 safe area**, so the 2:1 crops on Kakao and X lose nothing.
- Make one image per language for the home page, and ideally one per content page, because Naver wants unique images per page.
- **No WebP or SVG**, for Kakao and X compatibility.
- Use absolute HTTPS URLs and **version the file name or query** (`?v=2`) whenever the image changes.
- Set the text in Pretendard; the OFL permits this [S84].
- Hashed Vite assets work, but the OG image must have a stable URL that the HTML references, so put it in `public/og/`.

### 3.3 Caching and refresh

| Platform  | Cache behaviour                                                                                      | How to refresh                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KakaoTalk | URL-level cache **≥ 1 hour**. Image cache "several hours" on Kakao servers, **plus a device cache**. | Kakao **공유 디버거** (share debugger) → enter the URL → **캐시 초기화** (clear cache), for each URL form you share. If the image URL did not change, devices still show the old image, so change the image URL (`?v=`). Last resort for a user: KakaoTalk 설정 > 데이터 및 저장공간 > 임시 데이터 삭제 (Settings > Data and storage > Delete temporary data). [S82] |
| Facebook  | Cached per image URL.                                                                                | Sharing Debugger → **Scrape Again**. Keep old images online, because existing posts reference them. [S79] [secondary]                                                                                                                                                                                                                                                |
| Slack     | Unfurls are cached globally for **about 30 minutes**.                                                | Wait, or change the URL. [S81]                                                                                                                                                                                                                                                                                                                                       |
| Discord   | Undocumented. Vendors report re-crawls of roughly 30 minutes and persistent client caches.           | Change the URL (`?v=`). [S83] [secondary]                                                                                                                                                                                                                                                                                                                            |
| LinkedIn  | —                                                                                                    | Post Inspector re-fetches. [S88]                                                                                                                                                                                                                                                                                                                                     |

### 3.4 Will Bot Fight Mode block preview bots?

- In a third-party JSON copy of Cloudflare Radar's verified-bots directory, fetched 2026-10-19, these are **Verified bots**:
  - `kakaotalk-scrap` (Page Preview), `Discordbot`, `Slack-ImgProxy`, `Slackbot 1.0`, `Twitterbot`, `facebookexternalhit`, `LinkedInBot`, `TelegramBot`;
  - search crawlers `Yeti` (Naver), `Daum/4.1`, `ZumBot`, `Googlebot`, `bingbot` [S53].
- Cloudflare says Verified bots "have been excluded in default bot configurations across all plans" [S36].
- On Free plans, Bot Fight Mode targets "simple bots from cloud hosting providers and headless browsers" [S33].
- `Slackbot-LinkExpanding` is not listed under that exact name [inference: it may be covered by Slack's verified IP ranges; test it].
- [observed] A request with the Kakao scraper user agent got 200 from my (non-Kakao) IP.
- **If a preview fails:**
  - Bot Fight Mode **cannot be skipped by WAF custom rules or Page Rules**, but it does **not trigger when an IP Access rule matches** [S31], [S32];
  - Kakao publishes its scraper ranges as `211.231.103.0/24` and `27.0.238.0/24` [S82]. An IP Access **Allow** rule for those ranges is the narrow fix. Turning Bot Fight Mode off is the broad fix [S31].

---

## 4. Search engines and webmaster tools (Korea + global)

### 4.1 Naver Search Advisor (searchadvisor.naver.com)

1. **Register** `https://trex-vs-tiger.vinylims.com` and verify ownership.
   - Two methods exist: an HTML file, or an **HTML meta tag** `<meta name="naver-site-verification" content="…">` in the home page `<head>` [S73] [secondary; tag name confirmed on a live site, danawa.com] [observed].
   - **Use the meta tag.** Naver's file is an `.html` file, and Pages redirects `/naverXXXX.html` → `/naverXXXX` (308) [S47]. The verifier may not follow that redirect [inference].
2. **robots.txt must be plain text with a 2xx status.** Naver: if robots.txt is returned as an HTML document it may be interpreted as "none (allow all)". Naver also treats 4xx as allow-all and 5xx as disallow-all [S66]. Yeti obeys robots.txt [S66].
3. **Submit the sitemap** under 요청 → 사이트맵 제출 (Request → Submit sitemap). Naver treats submitted sitemaps and RSS as "content feeds" and revisits them periodically.
   - RSS needs at least one item and full article bodies, and is limited to 10 MB. Naver recommends sitemaps over RSS [S69].
   - An RSS feed is optional here. It only makes sense if the site publishes dated updates, such as a changelog.
4. **Request crawling**: use 웹 페이지 수집 요청 (request page collection) for new pages and the robots.txt 수집 요청 (request robots.txt collection) after changes [S66].
5. **IndexNow is supported.** Use `https://searchadvisor.naver.com/indexnow` or the shared endpoint ([§4.4](#44-indexnow-one-ping-many-engines)). The key file is `/<key>.txt` at the root [S70].
6. **JavaScript:**
   - Naver strips `#fragments`; use real paths for distinct content [S67];
   - it indexes the static HTML first [S67];
   - it advises **not** to rely on JS URLs whose hash or timestamp changes, because cached scripts are used for rendering [S67]. [inference] Vite's content-hashed names are fine when the static HTML already carries the content, which is one more reason for §1.5.
7. **Yeti identification [S68]:**
   - UA `Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)`, or a Chrome-based UA containing `Yeti/1.1`;
   - reverse DNS `*.naver.com`;
   - IP list at `https://searchadvisor.naver.com/doc/naverbot.json`.
   - Naver's link-preview robot (`Blueno`) and ads robot (`Ads-Naver`) are separate [S68].
8. **Titles, descriptions, OG tags [S71]:**
   - put the brand name in the home title;
   - write 1–2 sentence descriptions, with no keyword repetition;
   - Naver also uses OG tags for analysis;
   - use a unique `og:image` per page.

### 4.2 Daum / Kakao search (webmaster.daum.net)

- **Verification:** Daum Webmaster Tool issues a PIN. The owner adds it to **robots.txt** as a comment line of the form `#DaumWebMasterTool:<hash>:<pin>` [S74] [secondary + observed on yellowit.co.kr/robots.txt]. Being a comment, it is ignored by other crawlers (RFC 9309 comments) [S85]. Bing's robots.txt tester has been reported to flag it [S74] [secondary].
- Daum's crawler UA contains `Daum/4.1` and is Cloudflare-verified (Search Engine Crawler) [S53].
- I could not fetch `webmaster.daum.net` from this environment (TLS chain error). The steps above come from secondary sources and need confirming in the live tool.

### 4.3 Bing Webmaster Tools (+ Copilot visibility)

- **Verification options:** import from Google Search Console (auto-verified, sitemaps can be imported) [S76], meta tag `msvalidate.01`, `BingSiteAuth.xml` at the root (an `.xml` file is not affected by the `.html` redirect), or a DNS CNAME [S76] [secondary for the last three]. **Recommended:** import from GSC after GSC is set up.
- **AI Performance report:** shows citations in Copilot and Bing AI summaries, cited pages and grounding queries. It reached public preview in February 2026 [S77] [secondary]. Cloudflare's September 2026 post also links Bing's AI Performance help page [S45].
- Bing honors `NOARCHIVE` for "no AI use in answers or training" [S45]. Do **not** set it if the goal is visibility.

### 4.4 IndexNow (one ping, many engines)

- **Participating engines**, per `indexnow.org/searchengines.json` on 2026-10-19: Bing, Yandex, Seznam, **Naver**, Yep, Internet Archive, **Amazon** [S75].
- A submission to any endpoint is shared with all of them [S75].
- **Key:** 8–128 characters from `a-z A-Z 0-9 -`, hosted as UTF-8 `/<key>.txt` at the root, containing the key [S75], [S70]. A `.txt` file is served as-is by Pages [S47].
- **Submit:**
  - single URL: `GET https://api.indexnow.org/indexnow?url=<url>&key=<key>`;
  - bulk: `POST` JSON `{host, key, keyLocation, urlList}` with **up to 10,000 URLs** [S75].
  - HTTP 200/202 means received, not indexed [S75], [S70].
- **Where [inference]:** a CI step after a successful production deploy (GitHub Actions on `main`) that POSTs the sitemap URLs whose `lastmod` changed. The key is public by design, because it lives on the site, so it does not need to be a secret.
- **Cloudflare Crawler Hints** (Caching → Configuration, all plans) also sends IndexNow signals, based on cache `MISS` events [S52]. [inference] Its effect on a Pages-served hostname is unverified, so treat it as optional. The CI ping is the reliable path.
- Google does not appear in the IndexNow participant list [S75]. Use the sitemap and Search Console for Google.

### 4.5 Google Search Console

- **Verification:**
  - A **Domain property** (`vinylims.com`) can only be verified by **DNS record** [S18]. It covers all subdomains and protocols, and the zone's DNS is already on Cloudflare.
  - A URL-prefix property can use an HTML file, a meta tag, Analytics or Tag Manager [S18].
  - **The HTML-file method is likely to fail on Pages.** Search Console "does not follow redirects" when fetching the file [S18], and Pages redirects `/googleXXXX.html` → `/googleXXXX` [S47] [inference; test it if you try].
  - **Recommended:** a Domain property via DNS TXT, plus optionally a URL-prefix property for `https://trex-vs-tiger.vinylims.com/`. A child property inherits the parent's verification [S18].
- **Submit** `https://trex-vs-tiger.vinylims.com/sitemap.xml`. The robots.txt `Sitemap:` line also works [S16].
- **URL Inspection → Test live URL** for `/`, `/en/` and one content page. It shows the rendered HTML Googlebot received, including JSON-LD and the static content [S21], [S1]. **A 403 here means Cloudflare is blocking Googlebot** (see [§6](#6-cloudflare-specifics-2025-2026)).
- **robots.txt report:** confirms Google fetched the new text robots.txt [S22]. It may show "Syntax not understood" for `Content-Signal`. Cloudflare reports no crawl or SEO impact [S35].
- **Search generative AI control** (Settings → Search generative AI; rolled out to all sites on **2026-08-31**):
  - the default is "Include my site's links and content";
  - "Exclude" removes the site from AI Overviews, AI Mode and Discover AI features;
  - it is not a ranking signal, and it does not control training (Google-Extended does) [S19].
  - Keep **Include**. Google's AI guide now says a site must be included there to be eligible [S2].
- **Generative AI performance report** (Search Console → Performance → Generative AI): impressions in AI Overviews and AI Mode by page, country and device [S20].

---

## 5. AIEO / GEO (visibility in AI answers)

### 5.1 What the platforms say

- **Google:**
  - "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" [S1].
  - "AEO" and "GEO" "is still SEO" [S2].
  - **llms.txt, "chunking", rewriting content for AI and chasing inauthentic mentions can be ignored for Google Search**. Google Search ignores llms.txt, which "will neither harm nor help" [S2].
  - What matters: crawlability (including "by any CDN or hosting infrastructure"), internal links, text content, page experience, structured data matching visible text, and **non-commodity content** [S1], [S2].
  - Spam policies, including scaled-content abuse, apply to generative AI responses too [S3], [S2].
- **Microsoft / Bing (2025-10-08):**
  - AI systems split pages into sections and lift "snippable" pieces;
  - use headings, Q&A pairs, lists and tables, and self-contained sentences;
  - do not hide answers in tabs or expandable menus, PDFs or images [S65].
- **AI crawlers:** most do not run JavaScript [S61], so the content must be in the HTML ([§1.5](#15-crawlable-static-content-for-the-js-app-page)).

### 5.2 llms.txt (and llms-full.txt)

**Spec, llmstxt.org v2 (2024-09-03, revised 2026-08-10) [verified, S62]:**

- The file lives at `/llms.txt`, or at any sub-path, where it covers that path.
- Markdown sections, in order:
  1. an **H1** with the site name (the only required section);
  2. a **blockquote** summary;
  3. optional non-heading paragraphs or lists;
  4. **H2 "file list" sections** of `[name](url): notes`.
- The `## Optional` section no longer has a special meaning in v2.
- Pages that agents might read should offer **Markdown versions at the same URL** with `.md` appended, or `index.md` for directory URLs.
- Discovery uses `rel="alternate" type="text/markdown"` (for the Markdown copy) and `rel="describedby"` (for the llms.txt file), as `<link>` elements or a `Link:` header.

**Other facts:**

- **`llms-full.txt`** (all content in one file) is a community convention popularised by documentation platforms such as Mintlify. It is **not** part of the llmstxt.org spec [S63], [S62].
- **Lighthouse** has an experimental _Agentic Browsing_ category with an llms.txt audit: a missing file (404) is N/A, and a server error fails [S27], [S28]. [observed] Today `/llms.txt` returns the HTML app shell with 200, which is neither valid nor a 404.
- **Recommendation:** ship a small `llms.txt` and Markdown copies of `/model/`, `/parameters/` and `/guide/`. The sources already exist as Markdown (`docs/MODEL.md`), so the cost is low. Skip `llms-full.txt`, or generate it at build time as a concatenation. Expect no Google effect [S2].

Proposed `/llms.txt`:

```markdown
# 티렉스 대 호랑이 (T-Rex vs Tiger)

> 티라노사우루스 N마리와 호랑이 M마리의 가상 전투를 문헌 기반 파라미터 범위로 반복 시뮬레이션해 승률(Wilson 95% 신뢰구간)·전투 시간·민감도(Spearman ρ)를 보여주는 무료 브라우저 몬테카를로 에이전트 기반 시뮬레이터. / A free in-browser Monte Carlo, agent-based simulator of N Tyrannosaurus rex vs M tigers.

- 교육용 장난감 모델입니다. 두 종은 공존한 적이 없고 상호작용 규칙은 모두 가정입니다. Educational toy model, not a prediction.
- 기본 결과(T-Rex 10 vs 호랑이 100, 사기 ON, 500회, seed 20261019): T-Rex 승률 100%(95% CI 99.2–100%), 전투 시간 중앙값 약 26초, 호랑이 평균 14.1마리 사망·85.9마리 도주.
- 시나리오는 URL 프래그먼트(#s=…)로 공유되며 같은 시드면 결과가 재현됩니다. 백엔드·추적 없음.
- 만든 사람: VinylStage (https://link.vinylims.com) · 소스: https://github.com/VinylStage/trex_vs_tiger_sim (MIT)

## 문서 (한국어)

- [모델 설명](https://trex-vs-tiger.vinylims.com/model/index.md): 몬테카를로 설계, 전투 규칙, 기본 결과, 한계
- [파라미터와 출처](https://trex-vs-tiger.vinylims.com/parameters/index.md): 22개 파라미터 범위와 참고문헌(DOI)
- [사용 가이드](https://trex-vs-tiger.vinylims.com/guide/index.md): 설정, 결과 읽는 법, 공유

## Docs (English)

- [Model](https://trex-vs-tiger.vinylims.com/en/model/index.md): Monte Carlo design, battle rules, results, limitations
- [Parameters & sources](https://trex-vs-tiger.vinylims.com/en/parameters/index.md): ranges and references
- [Guide](https://trex-vs-tiger.vinylims.com/en/guide/index.md): how to use and read results

## Optional

- [소개 / About](https://trex-vs-tiger.vinylims.com/about/)
- [라이선스 / License](https://trex-vs-tiger.vinylims.com/license/)
```

### 5.3 Content patterns that earn citations (GEO)

**The GEO paper** (Aggarwal, Murahari, Rajpurohit, Kalyan, Narasimhan, Deshpande; arXiv 2311.09735; KDD 2024) [S64]:

- **Benchmark:** **GEO-bench**, 10,000 queries across 25 domains.
- **Main result:** "GEO can boost visibility by up to 40%".
- **Top methods:** **Cite Sources, Quotation Addition and Statistics Addition** gave "a relative improvement of 30-40% on the Position-Adjusted Word Count metric and 15-30% on the Subjective Impression metric".
- **Keyword stuffing** "offer[s] little to no improvement". In Table 1 it scored 17.7 vs a 19.3 baseline on the overall position-adjusted word count, i.e. worse.
- **Perplexity.ai:** visibility improvements of up to 37%.
- **Lower-ranked sources gain the most.** Cite Sources gave **+115.1%** visibility to the source ranked 5th in search results, and −30.3% to the rank-1 source.
- **Effects vary by domain.**
- **Caveats [inference]:**
  - the test engines were 2023-era (a GPT-3.5-based generative engine and Perplexity);
  - Google states these tactics are not needed for its systems [S2].
  - They do overlap with what Google rewards anyway: sourced, specific, non-commodity content. Use them because they are honest content improvements, not as hacks.

**Applied to this site [inference]:**

- **Answer first.** Each page opens with a one-paragraph direct answer containing the key numbers, for example "10 T-Rex vs 100 tigers → T-Rex win 100% (95% CI 99.2–100%), median 26 s". Explanation follows.
  - This matches the paper's position-weighted visibility metric and Microsoft's "snippable, self-contained sentences" [S64], [S65].
- **Statistics with uncertainty.** Give win rates with Wilson CIs, duration percentiles, the sensitivity ρ values and the what-if table from `docs/MODEL.md` §6–7, all as HTML tables, not images [S65].
- **Cite sources.**
  - Every parameter row on `/parameters/` links its DOI (already in `MODEL.md` §9).
  - Mark assumptions as **[speculative]** in visible text.
  - Mirror the DOIs in `TechArticle.citation`.
- **Quotations.** Where helpful, quote a short attributed sentence from a source, for example a bite-force paper's estimate. Do not invent quotes.
- **Visible, unique facts.** The site's original content is its non-commodity value [S2]:
  - its own simulation results;
  - the "what would make the tigers win" analysis;
  - the disclaimers (never coexisted; coordinated adult tiger attacks undocumented).
- **Freshness signals.** Show "업데이트 YYYY-MM-DD" (updated date) on each page. Keep `dateModified` and sitemap `lastmod` accurate [S16], [S11].

### 5.4 Entity consistency

- **Pick one name per language and use it everywhere:**
  - `<title>` brand suffix, `og:site_name`, `WebSite.name`/`alternateName`, `llms.txt` H1, the visible header, `README.md`, the GitHub repo description and its "Website" field;
  - the **JavaScript `document.title`** (today it says "티라노사우루스 vs 호랑이 시뮬레이터").
  - Google's site-name system takes `WebSite`, `og:site_name`, `<title>` and headings into account, and recommends using the name consistently [S8].
- **Author entity:**
  - the same `Person` `@id`, `name` and `sameAs` on every page;
  - reciprocal links from `link.vinylims.com` (title "VinylStage Linktree"), `vinylims.com` ("Vinyl's Log") and the GitHub profile back to the site [observed for the current titles];
  - Google disambiguates authors with `url`/`sameAs` [S11].
- **Topic entities:** use `about` with Wikidata IDs for Tyrannosaurus (Q14332), Tiger (Q19939) and Monte Carlo method (Q232207) [S87].

### 5.5 FAQ blocks

- Put 5–8 real questions per language on `/` and `/guide/`, written as visible `<h3>` + `<p>` and **not collapsed** [S65].
- Candidate questions:
  - who wins at the default settings;
  - did they ever meet;
  - how many tigers would it take;
  - what is Monte Carlo / LHS;
  - can I change the parameters;
  - is my data stored (no);
  - how to share or reproduce a result (seed + `#s=`).
- FAQPage JSON-LD is optional: no rich result since 2026-05-07 [S3].

### 5.6 robots.txt policy for AI crawlers

**Who is who [verified per vendor docs; status = my 2026-10-19 probe of `/`]:**

| Token / UA                                                         | Operator     | Purpose                                                                                                                                                                               | Honors robots.txt?                                   | Cloudflare class [S53]                                                                      | Live status |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| `GPTBot`                                                           | OpenAI       | **Training** foundation models                                                                                                                                                        | Yes [S54]                                            | AI Crawler                                                                                  | **403**     |
| `OAI-SearchBot`                                                    | OpenAI       | **Search**: surfacing sites in ChatGPT search; opted-out sites show only as navigational links                                                                                        | Yes; changes take ~24 h [S54]                        | Search                                                                                      | 200         |
| `ChatGPT-User`                                                     | OpenAI       | **User-initiated** fetch                                                                                                                                                              | "robots.txt rules may not apply" [S54]               | AI Assistant                                                                                | 200         |
| `ClaudeBot`                                                        | Anthropic    | **Training**                                                                                                                                                                          | Yes; supports `Crawl-delay` [S55]                    | AI Crawler                                                                                  | **403**     |
| `Claude-SearchBot`                                                 | Anthropic    | **Search** indexing for Claude answers                                                                                                                                                | Yes [S55]                                            | AI Search                                                                                   | 200         |
| `Claude-User`                                                      | Anthropic    | **User-initiated** fetch                                                                                                                                                              | Controllable via robots.txt [S55]                    | AI Assistant                                                                                | 200         |
| `PerplexityBot`                                                    | Perplexity   | **Search** (not training)                                                                                                                                                             | Yes [S56]                                            | **Not verified.** Cloudflare de-listed Perplexity on 2025-08-04 over stealth crawling [S43] | 200         |
| `Perplexity-User`                                                  | Perplexity   | **User-initiated** fetch; "generally ignores robots.txt"                                                                                                                              | No [S56]                                             | not verified                                                                                | —           |
| `Google-Extended`                                                  | Google       | robots.txt **token only**, no separate UA. Controls use for **Gemini training and for grounding in Gemini Apps / Vertex AI**. **Does not affect Google Search** inclusion or ranking. | Yes [S17]                                            | —                                                                                           | n/a         |
| `Applebot` / `Applebot-Extended`                                   | Apple        | Applebot = search (Spotlight, Siri, Safari); its data may also train models. `-Extended` = training opt-out token only. Disallowing it doesn't affect search.                         | Yes [S57]                                            | Applebot: AI Search                                                                         | —           |
| `Bytespider`                                                       | ByteDance    | Reportedly gathers LLM training data (Doubao). Was the #1 AI crawler by requests in Cloudflare's 2024 data.                                                                           | No official docs [S46]                               | Search Engine Crawler (Toutiao)                                                             | **403**     |
| `CCBot`                                                            | Common Crawl | Open web archive widely used as **training** data                                                                                                                                     | Yes [S58]                                            | Archiver                                                                                    | **403**     |
| `Amazonbot` / `Amzn-SearchBot` / `Amzn-User`                       | Amazon       | Amazonbot: products and **may train** models. SearchBot: Alexa search, not training. User: user fetches, may not follow robots.txt.                                                   | Yes, except Amzn-User; changes take ~24 h [S59]      | AI Crawler / AI Search                                                                      | —           |
| `meta-externalagent` (+ `meta-externalfetcher`, `Meta-WebIndexer`) | Meta         | ExternalAgent: **training** + indexing. Fetcher: user-initiated, may bypass robots.txt. WebIndexer: Meta AI search citations.                                                         | ExternalAgent yes; Fetcher may not [S60] [secondary] | AI Crawler                                                                                  | 200         |

**Recommended policy for maximum visibility in AI answers [inference]:**

- **Allow everything**: search bots, user-initiated fetchers **and** training crawlers.
- **Reasons:**
  1. Search and user bots are what produce **cited links** in ChatGPT, Claude, Perplexity, Copilot and Meta AI answers. Blocking OAI-SearchBot removes the site from ChatGPT search answers [S54]. Blocking Claude-SearchBot or Claude-User "may reduce your site's visibility" [S55].
  2. Training inclusion is how models learn the site and the entity exists. `Google-Extended` also governs **grounding in Gemini Apps**, so disallowing it reduces Gemini answer visibility, not only training [S17].
  3. The site is MIT-licensed, educational, ad-free, and has no paywall or server cost per request. Static requests on Pages are "free and unlimited" [S51].
  4. Cloudflare's own data: under 1% of sites block Search bots, and 17% block training [S45]. Here there is no business reason to join the 17%.
- **If the owner prefers no training:** disallow only the training-only tokens below. Keep `Google-Extended` allowed if Gemini Apps grounding matters. Never block search, user-fetch or mixed-use search bots.

**Recommended `/robots.txt` (maximum visibility):**

```text
# https://trex-vs-tiger.vinylims.com/robots.txt
# Policy: all content is public. Search indexing, AI answers (retrieval/grounding) and AI training are allowed.
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

Sitemap: https://trex-vs-tiger.vinylims.com/sitemap.xml
# Daum Webmaster Tool ownership (owner adds the issued line):
# #DaumWebMasterTool:<hash>:<pin>
```

- A single `*` group already covers every crawler. Per-bot `Allow` groups are redundant, and they would replace the `*` group for that bot (RFC 9309 group semantics) [S85].
- `Content-Signal` is Cloudflare's Content Signals Policy vocabulary: `search`, `ai-input` (RAG and grounding), `ai-train` [S42], [S35]. Crawlers that don't know it ignore it.

**Alternative (no training, still visible in AI answers):**

```text
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Bytespider
User-agent: Applebot-Extended
User-agent: meta-externalagent
User-agent: Amazonbot
Disallow: /

Sitemap: https://trex-vs-tiger.vinylims.com/sitemap.xml
```

**robots.txt must agree with Cloudflare's edge settings ([§6](#6-cloudflare-specifics-2025-2026)).** Today GPTBot, ClaudeBot, CCBot and Bytespider are 403'd at the edge, while robots.txt says nothing because it is HTML. Cloudflare notes that crawlers treat that kind of mismatch as a reason to disregard preferences [S44].

---

## 6. Cloudflare specifics (2025–2026)

### 6.1 Timeline

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Source       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 2025-07-01 | "Content Independence Day": Cloudflare blocks AI crawlers by default. **Every new domain is asked at sign-up whether to allow AI crawlers**, with control as the default. Pay-per-crawl beta.                                                                                                                                                                                                                                                                                                                                                               | [S40], [S41] |
| 2025-08-04 | Perplexity **de-listed as a Verified bot**; heuristics added to block its stealth crawling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [S43]        |
| 2025-09-24 | **Content Signals Policy**: `search`, `ai-input`, `ai-train` comments and directives in robots.txt. Managed-robots customers (3.8M domains) get `search=yes, ai-train=no`. Free-plan zones can turn the policy text off.                                                                                                                                                                                                                                                                                                                                    | [S42]        |
| 2026-07-01 | New bot taxonomy: Search / Agent / Training. Per-behavior controls (Allow, Block on pages with ads, Block). Signed agents become Verified ("Direct" vs "Intermediary"). "AI Search" is merged into Search.                                                                                                                                                                                                                                                                                                                                                  | [S36], [S44] |
| 2026-08-21 | **Bot Preference Sync**: robots.txt is generated from the Search/Agent/Training policies and **prepended** to the origin robots.txt. On by default for new customers.                                                                                                                                                                                                                                                                                                                                                                                       | [S44]        |
| 2026-09-15 | **Disallow AI Training** setting. **"Block" and "Block on pages with ads" now also block mixed-use crawlers (Applebot, Bingbot, Googlebot)**, i.e. Search too. Legacy **"Block AI bots" deprecated**, **Managed robots.txt deprecated** in favour of Bot Preference Sync. New-domain presets: non-ad sites get Search, Training and Agent = Allow; ad sites get Training = Disallow AI Training and Agent = Block on pages with ads. Migration: legacy "Block AI" = Block → Search Allow, Training **Disallow AI Training**, Agent Block on pages with ads. | [S45], [S34] |

### 6.2 Settings, what they do, and the required state

| Setting (dashboard path)                                                   | What it does                                                                                                                                                                                                                                                                                           | Required state for this site                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Security → Settings → Bot traffic → Configure AI bot policies → Search** | Blocks or allows bots with Search behavior, verified and some unverified [S34], [S37].                                                                                                                                                                                                                 | **Allow**                                                                                                                                                                                                                      |
| **… → Agent**                                                              | User-directed fetchers (ChatGPT-User, Claude-User, …) [S37].                                                                                                                                                                                                                                           | **Allow**                                                                                                                                                                                                                      |
| **… → Training**                                                           | Allow / **Disallow AI Training** (robots.txt preference plus an edge block of training-only bots; "Accountable" mixed-use bots keep search access) / Block on pages with ads / **Block (also blocks Googlebot, Bingbot, Applebot)** [S45].                                                             | **Allow** (max visibility), or _Disallow AI Training_. **Never Block.**                                                                                                                                                        |
| **Bot Preference Sync** (same panel)                                       | Generates robots.txt directives only when a policy is Block, Block on ads or Disallow. Prepends them to the origin robots.txt, detected by a 200 response [S35], [S44].                                                                                                                                | With everything on Allow it adds nothing; either state is fine. **Ship a real text robots.txt first.** Today the origin returns the HTML shell with 200, and Cloudflare would prepend to that [S35] [inference].               |
| **Content Signals Policy** (Free plan)                                     | Shown on robots.txt only when the domain has **no** robots.txt and doesn't use the managed one. Can be turned off in Security Settings [S35], [S42].                                                                                                                                                   | Irrelevant once the repo ships robots.txt.                                                                                                                                                                                     |
| **AI Crawl Control → Crawlers** (`/:zone/ai`)                              | Per-crawler Allow / Block / Charge. A block creates or updates a **WAF custom rule** [S38]. On Free, detection is by user agent [S38].                                                                                                                                                                 | Every crawler set to **Allow**. Check **Security → WAF → Custom rules** for an AI Crawl Control rule and remove its blocks.                                                                                                    |
| **Security → Settings → Bot traffic → Bot Fight Mode**                     | Challenges "simple bots from cloud hosting providers and headless browsers" [S33]. Verified bots are excluded by default [S36]. **Cannot be skipped by WAF or Page Rules; an IP Access rule match bypasses it** [S31], [S32]. Forces **JavaScript Detections** (inline script injection) [S31], [S39]. | Keep it **On** (acceptable) **provided** every HTML route sends `Cache-Control: no-transform` [S39]. Or turn it Off if previews or bots are challenged; watch Security → Analytics → Events, Service = "Bot Fight Mode" [S31]. |
| **Block AI bots** (legacy toggle)                                          | Deprecated 2026-09-15; migrated to the controls above [S45], [S34].                                                                                                                                                                                                                                    | Confirm it no longer shows "Block", or that the migration produced the states above.                                                                                                                                           |
| **Workers & Pages → project → Bulk Redirects**                             | Redirects `pages.dev` → custom domain [S50].                                                                                                                                                                                                                                                           | 301 from `trex-vs-tiger-sim.pages.dev`; _Include subdomains_ **off**.                                                                                                                                                          |
| **Caching → Configuration → Crawler Hints**                                | IndexNow hints from cache MISSes [S52].                                                                                                                                                                                                                                                                | Optional.                                                                                                                                                                                                                      |

**Why the owner must look:**

- My probes cannot tell whether real Googlebot or Bingbot are blocked. Cloudflare identifies them by IP, and a spoofed user agent is not the real bot.
- The 403s for GPTBot, ClaudeBot, CCBot and Bytespider show a training block is active [observed]. If that is the post-2026-09-15 "Block" value, rather than "Disallow AI Training", it would also block Googlebot, Bingbot and Applebot [S45].
- The quickest external check is **GSC URL Inspection → live test** and **Bing Webmaster URL Inspection**.

### 6.3 `_headers` additions needed for the new static pages ([verified] behaviour; content is a proposal)

The live probe shows Bot Fight Mode injecting its inline JSD script into HTML responses without `no-transform` [observed]. Cloudflare documents `no-transform` as the opt-out [S39]. `_headers` path rules support splats and placeholders [S48].

- **Option 1:** list each HTML route explicitly, for example `/guide/`, `/model/`, `/parameters/`, `/about/`, `/privacy/`, `/license/`, `/en/` and `/en/*`, each with `Cache-Control: no-cache, no-transform`.
- **Option 2:** put the static pages under predictable paths so a few rules cover them.
- **Watch out:** a request that matches several rules inherits all of their headers, and a header applied twice is joined with a comma [S48] [verified]. So don't add a blanket `/*` Cache-Control: it would merge with the `/assets/*` immutable rule. `! Header` detaches a header if needed [S48].

---

## 7. Validation checklist

| Step | Tool                                                                                                                                                                                                                         | Pass criteria                                                                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `curl -sI https://trex-vs-tiger.vinylims.com/robots.txt` (repeat for `/sitemap.xml`, `/llms.txt`, `/<indexnow-key>.txt`)                                                                                                     | 200 with `text/plain`, `application/xml` or `text/xml`, `text/plain`/`text/markdown` and `text/plain` respectively. **Not `text/html`.**                                                                                                                                                   |
| 2    | `curl -sI https://trex-vs-tiger.vinylims.com/no-such-page`                                                                                                                                                                   | **404** (served `404.html`), not 200.                                                                                                                                                                                                                                                      |
| 3    | `curl -s https://trex-vs-tiger.vinylims.com/guide/ \| grep -c challenge-platform`                                                                                                                                            | `0`, i.e. no JSD injection. Also no CSP errors in the DevTools console.                                                                                                                                                                                                                    |
| 4    | `curl -s -A "<UA>" -o /dev/null -w '%{http_code}' https://trex-vs-tiger.vinylims.com/` for GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, CCBot                                                                            | 200 for every bot the policy allows. [observed baseline 2026-10-19: GPTBot, ClaudeBot, CCBot, Bytespider = 403]                                                                                                                                                                            |
| 5    | **GSC URL Inspection → Test live URL** (`/`, `/en/`, `/model/`) [S21]                                                                                                                                                        | "URL is available to Google". The rendered HTML contains the static summary, the JSON-LD, canonical and hreflang, and the title is the static one, not overwritten.                                                                                                                        |
| 6    | **GSC robots.txt report** [S22]                                                                                                                                                                                              | Fetched OK; the latest version is the text file.                                                                                                                                                                                                                                           |
| 7    | **GSC Settings → Search generative AI** [S19]                                                                                                                                                                                | "Include …"                                                                                                                                                                                                                                                                                |
| 8    | **Rich Results Test** <https://search.google.com/test/rich-results> [S88]                                                                                                                                                    | BreadcrumbList and Article detected without errors. WebApplication will be reported as **not eligible** (no rating). That is expected; do not "fix" it with fake ratings [S9], [S14].                                                                                                      |
| 9    | **Schema Markup Validator** <https://validator.schema.org/> [S88]                                                                                                                                                            | No errors for WebSite, WebApplication, Person, TechArticle and FAQPage.                                                                                                                                                                                                                    |
| 10   | **Lighthouse** (Chrome DevTools) or **PageSpeed Insights** <https://pagespeed.web.dev/> [S26], [S88]                                                                                                                         | SEO 100: meta description, crawlable links, valid hreflang, `is-crawlable`, valid robots.txt. CWV "good": LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 [S23]. Optionally run the experimental Agentic Browsing category (Chrome 150+) for the llms.txt and accessibility-tree checks [S27], [S28]. |
| 11   | **hreflang check:** view source on each ko/en pair                                                                                                                                                                           | Each page lists ko, en and x-default, including itself. URLs are absolute and return 200; canonicals are self-referencing [S5].                                                                                                                                                            |
| 12   | **Facebook Sharing Debugger** <https://developers.facebook.com/tools/debug/>                                                                                                                                                 | 1200×630 image, correct title and description, no warnings. Click **Scrape Again** after changes [S79].                                                                                                                                                                                    |
| 13   | **Kakao 공유 디버거** (share debugger) <https://developers.kakao.com/tool/debugger/sharing>                                                                                                                                  | Preview shows the image (JPG/PNG) and title. Run **캐시 초기화** (clear cache) for `/` and `/en/` after each OG change [S82].                                                                                                                                                              |
| 14   | **LinkedIn Post Inspector** <https://www.linkedin.com/post-inspector/>; Slack and Discord test posts in a private channel                                                                                                    | Large image card. If stale, change `?v=` [S81].                                                                                                                                                                                                                                            |
| 15   | **Naver Search Advisor** → 사이트 간단 체크 (site quick check) <https://searchadvisor.naver.com/tools/sitecheck>; 웹마스터도구 → robots.txt 검증 (verify) and 수집 요청 (request collection); 사이트맵 제출 (submit sitemap) | robots.txt parsed as rules, not HTML. Sitemap accepted [S66], [S69].                                                                                                                                                                                                                       |
| 16   | **Bing Webmaster Tools** → URL Inspection, Sitemaps, AI Performance                                                                                                                                                          | Indexed. The AI Performance report collects data over time [S77].                                                                                                                                                                                                                          |
| 17   | **IndexNow** test: `curl "https://api.indexnow.org/indexnow?url=https://trex-vs-tiger.vinylims.com/&key=<key>"`                                                                                                              | 200 or 202 [S75].                                                                                                                                                                                                                                                                          |
| 18   | **CSP regression test** (CI)                                                                                                                                                                                                 | Every inline `<script>` in `dist/**/*.html` has `type="application/ld+json"`; the JSON parses; it contains no `</script`. [inference, based on §2.2]                                                                                                                                       |

---

## 8. Owner-only actions (summary)

These are listed in the structured output `owner_actions` as well. They are dashboard steps that code cannot perform.

---

## 9. Sources

All were accessed 2026-10-19 unless noted.

**Google**

- [S1] Google Search Central, "AI features and your website": <https://developers.google.com/search/docs/appearance/ai-features>
- [S2] Google Search Central, "Optimizing your website for generative AI features on Google Search": <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
- [S3] Google Search Central, Latest documentation updates (FAQ rich result deprecated 2026-05-07; docs removed 2026-06-15; llms.txt clarification 2026-06-15; JS canonical/noindex clarifications Dec 2025): <https://developers.google.com/search/updates>
- [S4] Google, JavaScript SEO basics: <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>
- [S5] Google, Localized versions of your pages (hreflang): <https://developers.google.com/search/docs/specialty/international/localized-versions>
- [S6] Google, Managing multi-regional and multilingual sites: <https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites>
- [S7] Google, Consolidate duplicate URLs (canonical): <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
- [S8] Google, Site names: <https://developers.google.com/search/docs/appearance/site-names>
- [S9] Google, Software app (SoftwareApplication) structured data: <https://developers.google.com/search/docs/appearance/structured-data/software-app>
- [S10] Google, Breadcrumb structured data: <https://developers.google.com/search/docs/appearance/structured-data/breadcrumb>
- [S11] Google, Article structured data (incl. author best practices): <https://developers.google.com/search/docs/appearance/structured-data/article>
- [S12] Google, Intro to structured data (JSON-LD recommended; dynamic injection supported): <https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- [S13] Google, Generate structured data with JavaScript: <https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript>
- [S14] Google, General structured data guidelines: <https://developers.google.com/search/docs/appearance/structured-data/sd-policies>
- [S15] Google Search Central Blog, "Changes to HowTo and FAQ rich results" (2023-08-08): <https://developers.google.com/search/blog/2023/08/howto-faq-changes>
- [S16] Google, Build and submit a sitemap: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- [S17] Google, Google's common crawlers, Google-Extended: <https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended>
- [S18] Search Console Help, Verify your site ownership: <https://support.google.com/webmasters/answer/9008080>
- [S19] Search Console Help, Search generative AI control (rolled out 2026-08-31): <https://support.google.com/webmasters/answer/16908024>
- [S20] Search Console Help, Generative AI performance report: <https://support.google.com/webmasters/answer/16984139>
- [S21] Search Console Help, URL Inspection tool: <https://support.google.com/webmasters/answer/9012289>
- [S22] Search Console Help, robots.txt report: <https://support.google.com/webmasters/answer/12818275>

**web.dev and Chrome**

- [S23] web.dev, Web Vitals: <https://web.dev/articles/vitals>
- [S24] web.dev, Best practices for fonts: <https://web.dev/articles/font-best-practices>
- [S25] web.dev, CSS size-adjust for @font-face: <https://web.dev/articles/css-size-adjust>
- [S26] Chrome for Developers, Lighthouse SEO audits: <https://developer.chrome.com/docs/lighthouse/seo/>
- [S27] Chrome for Developers, Lighthouse llms.txt audit: <https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt>
- [S28] Chrome for Developers, Lighthouse agentic browsing scoring: <https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring>

**Specifications**

- [S29] WHATWG HTML, the script element / data block / prepare the script element: <https://html.spec.whatwg.org/multipage/scripting.html#data-block>, <https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element>
- [S30] W3C CSP Level 3, §4.2.3 "Should element's inline type behavior be blocked by Content Security Policy?": <https://www.w3.org/TR/CSP3/#should-block-inline>

**Cloudflare**

- [S31] Cloudflare, Bot Fight Mode: <https://developers.cloudflare.com/bots/get-started/bot-fight-mode/>
- [S32] Cloudflare, Handle false positives from Bot Fight Mode: <https://developers.cloudflare.com/bots/troubleshooting/false-positives/>
- [S33] Cloudflare, Bots — Free plan: <https://developers.cloudflare.com/bots/plans/free/>
- [S34] Cloudflare, Block AI Bots / Configure AI bot policies: <https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/>
- [S35] Cloudflare, robots.txt setting (managed robots.txt, Bot Preference Sync, Content Signals): <https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/>
- [S36] Cloudflare, Verified bots: <https://developers.cloudflare.com/bots/concepts/bot/verified-bots/>
- [S37] Cloudflare, Bots / AI bots classification: <https://developers.cloudflare.com/bots/concepts/bot/>
- [S38] Cloudflare, AI Crawl Control: <https://developers.cloudflare.com/ai-crawl-control/>; Manage AI crawlers: <https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/>
- [S39] Cloudflare, JavaScript Detections (CSP, `no-transform`): <https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/>
- [S40] Cloudflare press release (2025-07-01): <https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/>
- [S41] Cloudflare Blog, "Content Independence Day" (2025-07-01): <https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/>
- [S42] Cloudflare Blog, Content Signals Policy (2025-09-24): <https://blog.cloudflare.com/content-signals-policy/>
- [S43] Cloudflare Blog, Perplexity stealth crawlers (2025-08-04): <https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/>
- [S44] Cloudflare Blog, Bot Preference Sync (2026-08-21): <https://blog.cloudflare.com/bot-preference-sync/>
- [S45] Cloudflare Blog, "Have it both ways: stay discoverable in search while disallowing AI training" (2026-09-15): <https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/>
- [S46] Cloudflare Blog, "Declare your AIndependence" (2024, Bytespider data): <https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/>
- [S47] Cloudflare Pages, Serving Pages (route matching, 404, SPA fallback, preview `noindex`): <https://developers.cloudflare.com/pages/configuration/serving-pages/>
- [S48] Cloudflare Pages, Headers (`_headers`): <https://developers.cloudflare.com/pages/configuration/headers/>
- [S49] Cloudflare Pages, Early Hints: <https://developers.cloudflare.com/pages/configuration/early-hints/>
- [S50] Cloudflare Pages, Redirecting *.pages.dev to a custom domain: <https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/>
- [S51] Cloudflare Pages Functions pricing (static requests free and unlimited): <https://developers.cloudflare.com/pages/functions/pricing/>
- [S52] Cloudflare, Crawler Hints: <https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/>
- [S53] Cloudflare Radar bots directory: <https://radar.cloudflare.com/bots/directory> (blocked by a challenge from this environment). Read via the third-party JSON copy (CC BY-NC 4.0): <https://github.com/microlinkhq/cloudflare-bot-directory> (`src/index.json`, 871 entries)

**AI crawler operators**

- [S54] OpenAI, Overview of OpenAI crawlers: <https://developers.openai.com/api/docs/bots> (also <https://platform.openai.com/docs/bots>)
- [S55] Anthropic, Does Anthropic crawl data from the web…: <https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler>
- [S56] Perplexity, Perplexity crawlers: <https://docs.perplexity.ai/guides/bots>
- [S57] Apple, About Applebot: <https://support.apple.com/en-us/119829>
- [S58] Common Crawl, CCBot: <https://commoncrawl.org/ccbot>
- [S59] Amazon, Amazonbot: <https://developer.amazon.com/amazonbot>
- [S60] Meta, Meta Web Crawlers: <https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/> (returned HTTP 400 to my fetch; content via search summaries)
- [S61] Vercel, "The rise of the AI crawler" (2024-12-17): <https://vercel.com/blog/the-rise-of-the-ai-crawler>

**AIEO / GEO**

- [S62] llms.txt proposal v2: <https://llmstxt.org/>; changes: <https://llmstxt.org/changes.html>
- [S63] Mintlify, llms.txt and llms-full.txt: <https://www.mintlify.com/docs/ai/llmstxt>
- [S64] Aggarwal et al., "GEO: Generative Engine Optimization", KDD 2024: <https://arxiv.org/abs/2311.09735> (results tables: <https://arxiv.org/html/2311.09735v3>)
- [S65] Microsoft Advertising Blog, "Optimizing Your Content for Inclusion in AI Search Answers" (2025-10-08): <https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers>

**Naver, Daum, Bing, IndexNow**

- [S66] Naver Search Advisor, robots.txt 설정하기: <https://searchadvisor.naver.com/guide/seo-basic-robots>
- [S67] Naver Search Advisor, 자바스크립트 검색 최적화: <https://searchadvisor.naver.com/guide/seo-advanced-javascript>
- [S68] Naver Search Advisor, 검색로봇 확인 방법 (Yeti): <https://searchadvisor.naver.com/guide/seo-basic-firewall>
- [S69] Naver Search Advisor, RSS 및 사이트맵 제출: <https://searchadvisor.naver.com/guide/request-feed>
- [S70] Naver Search Advisor, IndexNow 페이지 갱신 요청 / API Key: <https://searchadvisor.naver.com/guide/indexnow-request>, <https://searchadvisor.naver.com/guide/indexnow-api-key>
- [S71] Naver Search Advisor, 콘텐츠 마크업 (title/description/OG): <https://searchadvisor.naver.com/guide/markup-content>
- [S72] Naver Search Advisor, 사이트 연관채널: <https://searchadvisor.naver.com/guide/structured-data-channel>
- [S73] NHN Commerce help, 네이버 사이트 등록하기 (HTML tag verification; secondary): <https://godomall-help.nhn-commerce.com/beginner/search_engine/naver>. Meta name confirmed on <https://www.danawa.com> page source [observed].
- [S74] Daum Webmaster Tool: <https://webmaster.daum.net/> (not reachable from this environment). Secondary: GeekNews <https://news.hada.io/topic?id=2593>; live robots.txt example <https://yellowit.co.kr/robots.txt> [observed].
- [S75] IndexNow documentation: <https://www.indexnow.org/documentation>; FAQ: <https://www.indexnow.org/faq>; participants: <https://www.indexnow.org/searchengines.json>
- [S76] Bing Webmaster Blog, Import sites from Search Console: <https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools>; other methods (secondary): <https://delante.co/how-to-add-a-website-to-bing-webmaster-tools/>
- [S77] Bing AI Performance report (secondary): <https://searchengineland.com/bing-webmaster-tools-testing-new-ai-performance-report-468039>; <https://www.searchinfluence.com/blog/bing-ai-performance-report-copilot-citations/>; Bing help: <https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c>

**Open Graph and messengers**

- [S78] The Open Graph protocol: <https://ogp.me/>
- [S79] Meta for Developers, Images in Link Shares: <https://developers.facebook.com/docs/sharing/webmasters/images> (returned 400 to my fetch; figures via search summary)
- [S80] X, Summary Card with Large Image: <https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image> (legacy: <https://dev.twitter.com/cards/types/summary-large-image>; figures via search summary)
- [S81] Slack, Slack robots: <https://api.slack.com/robots>
- [S82] Kakao DevTalk (official Kakao forum): "Scrap(스크랩, 미리보기)란?" <https://devtalk.kakao.com/t/scrap/33984>; checklist <https://devtalk.kakao.com/t/scrap-url/116202>; cache <https://devtalk.kakao.com/t/topic/33298>; share debugger <https://developers.kakao.com/tool/debugger/sharing>; firewall note <https://developers.kakao.com/docs/latest/ko/kakaotalk-share/common#policy-ip>
- [S83] Discord embeds (secondary; no official doc found): <https://htmlcsstoimage.com/features/og-images-for-discord>

**Other**

- [S84] Pretendard (README, OFL-1.1, v1.3.9): <https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/README.md>; npm: <https://www.npmjs.com/package/pretendard>
- [S85] RFC 9309, Robots Exclusion Protocol: <https://www.rfc-editor.org/rfc/rfc9309>
- [S86] schema.org: <https://schema.org/WebApplication>, <https://schema.org/TechArticle>, <https://schema.org/FAQPage>, <https://schema.org/BreadcrumbList>, <https://schema.org/ProfilePage>
- [S87] Wikidata: <https://www.wikidata.org/wiki/Q14332>, <https://www.wikidata.org/wiki/Q19939>, <https://www.wikidata.org/wiki/Q232207>
- [S88] Validation tools: Rich Results Test <https://search.google.com/test/rich-results>; Schema Markup Validator <https://validator.schema.org/>; PageSpeed Insights <https://pagespeed.web.dev/>; Facebook Sharing Debugger <https://developers.facebook.com/tools/debug/>; LinkedIn Post Inspector <https://www.linkedin.com/post-inspector/>; Naver 사이트 간단 체크 <https://searchadvisor.naver.com/tools/sitecheck>

### Method notes

- **Live probes:** about 25 requests to the production host on 2026-10-19, with default and spoofed crawler user agents.
- **Spoofed user agents** come from a non-verified IP, so a 200 does not prove that a real verified bot is allowed. It only shows that no user-agent-based block exists. A 403 shows a user-agent-based block is active.
- **CSP test:** headless Chromium 140 (playwright-core 1.55.1) against a local server sending `script-src 'self'`.
- **Vite test:** the repo's Vite 8.3.4 against a minimal page.
- **Unreachable sources:**
  - Meta for Developers pages returned HTTP 400.
  - The X docs redirected to an overview page.
  - Radar's directory sat behind a challenge.
  - `webmaster.daum.net` failed TLS verification.
  - For these, the report uses search-engine summaries or secondary sources, and labels them.
