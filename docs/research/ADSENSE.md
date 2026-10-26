# Google AdSense readiness

> **한국어 요약**
>
> - **계정과 사이트:** 루트 도메인 `vinylims.com`에 이미 `ads.txt`(`google.com, pub-8355379467698162, DIRECT, f08c47fec0942fa0`)가 있고, 같은 퍼블리셔 ID로 `adsbygoogle.js`를 불러옵니다. AdSense는 2023년 3월부터 하위 도메인을 별도 사이트로 등록할 수 없습니다. 따라서 `trex-vs-tiger.vinylims.com`은 루트 사이트의 승인, 차단 설정, Auto ads 설정을 **공유**합니다. 새 계정을 만들면 안 됩니다(퍼블리셔당 계정 1개). 루트 블로그 마크업의 광고 슬롯 ID가 `HOME_FEED_1` 같은 자리표시자라서 루트 사이트가 실제로 승인됐는지는 **확인되지 않았습니다**. 소유자가 AdSense → Sites 화면에서 직접 확인해야 합니다.
> - **정책 위험:** 동물 학대 정책은 "오락 목적의 동물 학대 조장"(투계·투견 같은 예)을 금지합니다. 멸종 동물과 가상 시나리오를 다루고 추상 도형으로 표현하는 교육용 몬테카를로 모델은 **위험이 낮습니다**. 단, 유혈·고어 표현, 실존 개체, 반려·가축 동물(개·닭)은 피해야 합니다. "충격적인 콘텐츠"는 금지 정책이 아니라 **제한** 정책입니다. 해당되면 광고 수요가 줄어듭니다. 교육 자료에는 예외가 적용됩니다.
> - **가장 큰 승인 장애물은 콘텐츠 양입니다.** 지금 사이트는 JS로 그리는 단일 화면이고, 상태는 `#s=` 프래그먼트에만 있습니다. 첫 화면은 사실상 입력 폼뿐입니다. 크롤러는 `#` 뒤를 같은 URL로 봅니다. 계획 중인 모델 설명·사용법·파라미터·튜토리얼 페이지를 **실제 URL을 가진 정적 HTML**로 만들어야 합니다.
> - **기술 차단 요소:** 현재 CSP(`script-src 'self'`, `default-src 'self'`)는 AdSense를 완전히 막습니다. Google은 도메인 허용 목록 방식은 지원하지 않고 **strict CSP(nonce 또는 hash + `'strict-dynamic'`)만 지원**합니다. 정적 `_headers`로는 요청마다 nonce를 만들 수 없습니다. 그래서 빌드 시 **해시 기반 로더**(권장, 무료, 정적 유지)나 Pages Functions nonce(문서화된 형태, Workers 요청 한도 소모) 중 하나를 골라야 합니다.
> - **즉시 고칠 것:** `/robots.txt`, `/ads.txt`, `/privacy`가 모두 `index.html`(200)을 돌려줍니다(soft 404). 이 때문에 Lighthouse SEO 점수가 92입니다. 푸터 문구 "서버 전송 · 추적 없음"은 광고를 붙이는 순간 사실이 아니게 됩니다.
> - **동의:** EEA·영국·스위스 트래픽에는 Google 인증 CMP가 필요합니다. 무료인 AdSense **개인정보 보호 및 메시지**(Google CMP)를 쓰면 TCF v2.3이 자동으로 처리됩니다. Consent Mode는 GA4나 Google Ads 태그를 추가할 때만 필요합니다. 한국에서는 개인정보 처리방침에 "자동 수집 장치의 설치·운영 및 거부" 항목과 제3자(Google) 행태정보 수집 사실을 적어야 합니다. 개인정보위 정책상 만 14세 미만이 주 이용자인 서비스에서는 맞춤형 광고용 행태정보를 수집하지 않도록 권고합니다.
> - **헤더:** Referrer-Policy는 지금 값이 적합합니다. COOP `same-origin`은 유지하고, 문제가 생기면 `same-origin-allow-popups`로 바꿉니다. Permissions-Policy의 `autoplay=()`는 동영상 광고를 막으므로 뺍니다. `browsing-topics=()`는 Topics API가 폐기되어 영향이 없습니다. COEP는 절대 추가하지 않습니다.

Research date: 2026-10-19. Every external claim links to its source. Claims marked **(unverified)** could not be confirmed from a primary source. Claims marked **(inference)** are my reasoning from the cited material.

## Contents

1. [Key findings](#1-key-findings)
2. [Current state of this site](#2-current-state-of-this-site)
3. [Policy assessment](#3-policy-assessment)
4. [Prerequisites checklist](#4-prerequisites-checklist)
5. [Step-by-step application plan](#5-step-by-step-application-plan)
6. [CSP and header changes to apply when ads go live](#6-csp-and-header-changes-to-apply-when-ads-go-live)
7. [Consent and privacy](#7-consent-and-privacy)
8. [Page and layout recommendations](#8-page-and-layout-recommendations)
9. [Core Web Vitals impact](#9-core-web-vitals-impact)
10. [Cloudflare-specific notes](#10-cloudflare-specific-notes)
11. [Risks and open questions](#11-risks-and-open-questions)
12. [Sources](#12-sources)
13. [Update 2026-10-26: subdomains, review status, site structure](#13-update-2026-10-26-subdomains-review-status-site-structure)

---

## 1. Key findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Impact                                                                                                                                                                                                                                                      | Action                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `vinylims.com/ads.txt` already lists `pub-8355379467698162`, and the root blog loads `adsbygoogle.js?client=ca-pub-8355379467698162` (checked with curl on 2026-10-19). Since March 2023, AdSense only accepts domains as sites. Subdomains are no longer added or managed separately, and subdomain blocking controls are promoted to the domain ([AdSense: site management change](https://support.google.com/adsense/answer/12170421)). AdSense allows one account per publisher ([AdSense: more than one account](https://support.google.com/adsense/answer/9729)). | The simulator inherits the root site's approval status, blocking controls and Auto ads settings. A policy problem on the simulator can affect `vinylims.com` as a whole **(inference)**.                                                                    | Use the existing account and publisher ID. Do not open a new account. Confirm `vinylims.com` is **Ready** under Sites. The blog's `<ins>` tags use placeholder slot IDs (`HOME_FEED_1`), so ads there may not be live yet **(unverified)**. |
| 2   | The production CSP blocks every AdSense resource. Google says: "Because the domains that the AdSense ad code uses change over time, we only support strict CSP" and "More restrictive policies may break without notice" ([AdSense: CSP](https://support.google.com/adsense/answer/16283098)).                                                                                                                                                                                                                                                                          | Ads cannot load until the CSP changes. Domain allowlists are unsupported.                                                                                                                                                                                   | Move to a hash-based strict CSP generated at build time (§6, option A), or a Pages Functions nonce (§6, option B).                                                                                                                          |
| 3   | The site is one JS-rendered screen. State lives in the `#s=` fragment, and the first screen is mostly a form (screenshot `e2e-prod/01-desktop-initial.png`). The AdSense crawler "won't count site.com and site.com/#anchor separately" ([AdSense crawler](https://support.google.com/adsense/answer/99376)). Google disallows ads on screens "without publisher-content or with low-value content" ([Publisher Policies: screens without publisher-content](https://support.google.com/publisherpolicies/answer/11112688)).                                            | This is the highest approval and enforcement risk.                                                                                                                                                                                                          | Build the planned model, usage, parameter and tutorial pages as real static HTML URLs (§8.1).                                                                                                                                               |
| 4   | `/robots.txt`, `/ads.txt`, `/privacy` and `/sitemap.xml` return `index.html` with HTTP 200. Pages serves the SPA fallback when there is no top-level `404.html` ([Pages: serving](https://developers.cloudflare.com/pages/configuration/serving-pages/)). The Lighthouse 13.5 prod run fails `robots-txt` ("35 errors found"), so SEO scores 92.                                                                                                                                                                                                                        | This is a crawl-hygiene problem. Soft-404s on `ads.txt` are retained for up to 5 days instead of purged ([ads.txt crawl](https://support.google.com/adsense/answer/7679060)).                                                                               | Add `public/robots.txt`, `sitemap.xml` and a real `404.html`.                                                                                                                                                                               |
| 5   | The footer says "서버 전송 · 추적 없음 / No server, no tracking" (`src/ui/i18n.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Once ads load, this claim is false. Publisher Policies forbid content that "misrepresents … the purpose of the content" ([Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938)). It also conflicts with privacy-policy duties. | Reword it to "시뮬레이션은 브라우저에서 실행 · 광고는 Google이 제공" and link a privacy page.                                                                                                                                               |
| 6   | The animal-cruelty policy targets content that "promotes cruelty or gratuitous violence towards animals", for example "cock or dog fighting" ([Animal cruelty](https://support.google.com/publisherpolicies/answer/10400059)). Shocking content is a _restriction_, which reduces demand, not a ban, and educational material can serve unrestricted ([Shocking content](https://support.google.com/publisherpolicies/answer/10437538)).                                                                                                                                | Risk is low if the content stays educational, abstract and non-gory (§3).                                                                                                                                                                                   | Follow the framing rules in §3.3. They also guide the planned animation upgrade and new-animal planning.                                                                                                                                    |
| 7   | Google requires a Google-certified, TCF-integrated CMP to serve personalized ads in the EEA and UK (since 2024-01-16) and Switzerland (since 2024-07-31) ([CMP requirement](https://support.google.com/adsense/answer/13554116)). TCF v2.3 has been mandatory for strings created since 2026-03-01 ([Ad Manager: TCF timeline](https://support.google.com/admanager/answer/9805023)).                                                                                                                                                                                   | Without a certified CMP, EEA/UK/CH traffic gets only non-personalized or limited ads.                                                                                                                                                                       | Use AdSense **Privacy & messaging** (Google's CMP, ID 300, certified). It writes TCF v2.3 strings ([TCF v2.3 troubleshooting](https://support.google.com/adsense/answer/9999955)).                                                          |
| 8   | Header review: `Referrer-Policy: strict-origin-when-cross-origin` is required-compatible. `autoplay=()` blocks muted autoplay. `browsing-topics=()` is moot. COEP is unsupported by Google ad tags.                                                                                                                                                                                                                                                                                                                                                                     | Small fixes are needed.                                                                                                                                                                                                                                     | See §6.4.                                                                                                                                                                                                                                   |
| 9   | Bot Fight Mode on the free plan cannot be bypassed with WAF rules. Verified-bot allowlisting is a Super Bot Fight Mode (paid) feature ([Cloudflare: stop bots](https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/)).                                                                                                                                                                                                                                                                                                                            | Mediapartners-Google could be challenged. Whether Cloudflare lists it as a verified bot is **(unverified)**: Radar was not reachable.                                                                                                                       | Watch the AdSense crawler-errors report. If errors appear, turn Bot Fight Mode off for the zone (§10).                                                                                                                                      |

---

## 2. Current state of this site

| Item                          | Value (2026-10-19)                                                                                                                                                                                                                                                                            | Source                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Production                    | `https://trex-vs-tiger.vinylims.com/`, Cloudflare Pages, static only                                                                                                                                                                                                                          | `docs/DEPLOYMENT.md`                  |
| Duplicate host                | `https://trex-vs-tiger-sim.pages.dev/` serves the same HTML (200)                                                                                                                                                                                                                             | curl                                  |
| Root domain                   | `vinylims.com`, a blog ("Vinyl's Log"). It has `/about`, `/contact`, `/privacy`, `ads.txt` with `pub-8355379467698162`, and `adsbygoogle.js` with that client. Its CSP is report-only and uses a host allowlist.                                                                              | curl                                  |
| HTML CSP (enforced)           | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`                                            | `public/_headers`                     |
| Other headers                 | `COOP: same-origin`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: accelerometer=(), autoplay=(), browsing-topics=(), …`. HTML uses `Cache-Control: no-cache, no-transform`. Cloudflare adds `speculation-rules: "/cdn-cgi/speculation"`. | curl `-I`                             |
| Content URLs                  | One URL `/`. Config lives in the `#s=` fragment. Model docs link out to GitHub (`docs/MODEL.md`).                                                                                                                                                                                             | `src/ui/app.ts`                       |
| Lighthouse (prod, 2026-10-19) | Mobile: Perf 100, A11y 96, BP 100, SEO 92, LCP 1.4 s, CLS 0, TBT 50 ms. Desktop: Perf 100, LCP 0.4 s, CLS 0.001.                                                                                                                                                                              | `<local-workspace>/lh/lh-prod-*.json` |
| Storage                       | `localStorage` for the UI language only                                                                                                                                                                                                                                                       | `src/ui/i18n.ts`                      |
| Build                         | Vite with `base: './'` (relative asset URLs). One entry `<script type="module" crossorigin src="./assets/index-*.js">`.                                                                                                                                                                       | `dist/index.html`                     |

---

## 3. Policy assessment

### 3.1 Relevant policy text

| Policy                                                                                            | Rule (quoted)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Applies?                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Animal cruelty](https://support.google.com/publisherpolicies/answer/10400059)                    | "We do not allow content that: promotes cruelty or gratuitous violence towards animals. Examples: Promoting animal cruelty for entertainment purposes, such as cock or dog fighting". It also bans promoting "the sale of products obtained from endangered or threatened species", for example "Sale of tigers … tiger skins".                                                                                                                                         | It is the closest match, but the simulator involves no real animals and does not promote real fights or sales.                      |
| [Shocking content](https://support.google.com/publisherpolicies/answer/10437538) (restriction)    | Content that "contains gruesome, graphic, or disgusting accounts or imagery (Blood, guts, gore …)" or "depicts acts of violence". For gameplay imagery, it counts only for torture, sexual violence, violence against minors or real persons, or discrimination-based violence. "Educational material about shocking content [is where] ads can appear unrestricted."                                                                                                   | Hypothetical animal-vs-animal combat is a form of "violence". It is abstract, non-gory and educational, so restriction is unlikely. |
| [Adult themes in family content](https://support.google.com/publisherpolicies/answer/10437484)    | Content "made to appear appropriate for a family audience, but contains adult themes including … violence"                                                                                                                                                                                                                                                                                                                                                              | Dinosaurs appeal to children, so the visuals must not become cartoonish-gory.                                                       |
| [Dangerous or derogatory content](https://support.google.com/publisherpolicies/answer/10522641)   | "promoting, glorifying, or condoning violence against others" (people)                                                                                                                                                                                                                                                                                                                                                                                                  | Does not apply as long as there are no humans or real persons.                                                                      |
| [Misrepresentative content](https://support.google.com/publisherpolicies/answer/10502938)         | Content that "misrepresents … the purpose of the content"                                                                                                                                                                                                                                                                                                                                                                                                               | Applies to the "no tracking" footer and to overclaiming realism.                                                                    |
| [Screens without publisher-content](https://support.google.com/publisherpolicies/answer/11112688) | No ads on screens "without publisher-content or with low-value content … under construction … used for alerts, navigation or other behavioral purposes". It also bars ads on "automatically generated content without manual review or curation".                                                                                                                                                                                                                       | Applies to the empty initial screen, progress states, the 404 page and auto-generated result pages.                                 |
| [Ad placement](https://support.google.com/adsense/answer/1346295)                                 | "Be careful when placing links, play buttons … navigation buttons (e.g., 'Previous' or 'Next'), game windows, video players, drop-down menus … near ads". Labels may only be "Advertisements" or "Sponsored Links" (Korean policy text: '광고' or '스폰서 링크'). Google recommends "at least 150 pixels" between ads and Flash games. Ad refresh rule: "Publishers are not permitted to refresh a page or an element of a page without the user requesting a refresh". | Applies to the replay canvas, play/pause, speed select, slider, presets and the Run button.                                         |
| [Program policies](https://support.google.com/adsense/answer/48182)                               | No self-clicks, and no "click the ads", "support us" or arrows pointing at ads.                                                                                                                                                                                                                                                                                                                                                                                         | Do not add "광고를 눌러 응원해 주세요"-style copy.                                                                                  |

### 3.2 Honest risk rating

| Risk                                                                                | Rating                              | Reasoning                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Animal-cruelty violation (site-level, ads disabled)                                 | **Low**                             | The policy example is real animals made to fight for entertainment. The site models a hypothetical between an extinct species and a living one, uses agent dots and arrows, and already states it is an educational toy model (footer disclaimer). Nothing promotes real-world cruelty or the tiger trade. Residual risk: human reviewers see "fight" plus "tiger". Mitigate with framing (§3.3). |
| Shocking-content restriction (fewer ads, not removal)                               | **Low–moderate**                    | "Depicts acts of violence" is broad, and the replay depicts attacks and deaths. Current visuals are abstract (dots, arrows, an ✕ for "dead"). The gameplay-imagery exception and the educational carve-out are favorable. The risk rises if the animation upgrade adds red particles, blood-like effects or "kill" wording.                                                                       |
| Low-value content / screens without content (approval rejection or limited serving) | **High (today)**                    | The site is single-screen, its text is rendered by JS, it has no real sub-URLs, and the model documentation is off-site on GitHub. This is the most common AdSense rejection class: "doesn't have enough unique content or provide a good user experience" ([Site not ready](https://support.google.com/adsense/answer/12176698)). It becomes **Low** once the planned content pages exist.       |
| Adult themes in family content                                                      | **Low**                             | Keep visuals abstract (this matches the owner's rule against character-like animal forms).                                                                                                                                                                                                                                                                                                        |
| Accidental-click / placement violation                                              | **Moderate**                        | The UI is dense with controls. Mitigate with the placement rules in §8.                                                                                                                                                                                                                                                                                                                           |
| Account-wide spillover to `vinylims.com`                                            | **Moderate impact, low likelihood** | Sites are domain-level. A policy strike on the subdomain is likely tracked against `vinylims.com` **(inference)**.                                                                                                                                                                                                                                                                                |

### 3.3 Content framing rules (apply now; also guide the animation and new-animal work)

Do:

- Lead every page with the purpose: "a Monte Carlo agent-based model for exploring how uncertain parameters change outcomes". Treat combat as the toy scenario and the method as the subject. Add a short "what this teaches" box: Monte Carlo methods, confidence intervals, sensitivity analysis, Lanchester-type numbers effects, and paleobiology uncertainty.
- Keep the existing disclaimer ("T. rex와 호랑이는 같은 시대에 산 적이 없고 … 교육용 장난감 모델"). Add an explicit line: "실제 동물 싸움을 조장하거나 지지하지 않습니다. / This site does not promote or endorse real animal fighting." Add a tiger conservation note: tigers are listed as **Endangered** on the IUCN Red List ([IUCN SSC Cat Specialist Group](https://www.catsg.org/living-species-tiger)).
- Use neutral, technical vocabulary in UI, alt text, titles and OG text. Prefer "전투 불능 (incapacitated)", "이탈 (fled)", "교전 (engagement)" and "물기 판정 (bite check)". Avoid "학살 (massacre)", "도륙", "피 (blood)", "kill count" and "잔혹".
- Animation upgrade: abstract glyphs only (dots, arrows, rings, hit flashes, motion trails). Use a non-red hit color or a neutral flash. Do not draw blood, splatter, gore, wounds or corpses. When an agent is incapacitated, fade it or mark it with a grey ✕. This fits the owner's constraint against character-like animal forms and the shocking-content restriction.
- New animal objects: prefer extinct or wild megafauna and robust, well-documented parameters, for example Spinosaurus, Smilodon, woolly mammoth, saltwater crocodile, African elephant, grizzly bear or Komodo dragon **(inference: policy-safety screening only; zoology review is separate)**.

Do not:

- Model domestic animals or pets (dogs, roosters, cats, horses). "Cock or dog fighting" is Google's own example of prohibited animal cruelty.
- Model humans, real named individuals or specific zoo animals. The shocking-content gameplay exception still covers "violence against prominent real-name persons", and "dangerous or derogatory" covers violence against people.
- Show realistic photos or illustrations of animals being hurt in OG images, favicons or tutorial art.
- Link to or embed real animal-fight videos. Do not sell or advertise tiger products (endangered-species clause).

---

## 4. Prerequisites checklist

Account and ownership

- [ ] Account holder is 18 or older ([eligibility](https://support.google.com/adsense/answer/9724)).
- [ ] Confirm the **existing** AdSense account (`pub-8355379467698162`) belongs to the site owner, and that `vinylims.com` shows **Ready** in Sites. If it shows "Getting ready" or "Requires review", the simulator's content quality now matters for that review ([connect site](https://support.google.com/adsense/answer/7584263)).
- [ ] Do not apply with a second account ([one account per publisher](https://support.google.com/adsense/answer/9729)).
- [ ] Ownership signal is already satisfied by the root `ads.txt`. Optionally add `<meta name="google-adsense-account" content="ca-pub-…">` to every page's `<head>`. It is static and CSP-neutral ([connect site: meta tag](https://support.google.com/adsense/answer/7584263)).

Content and navigation

- [ ] Real HTML pages (prerendered, not JS-only) for: Guide (usage), Model, Parameters (all 22, with sources and ranges), Tutorial, About (who/why/contact), Privacy. Use Korean and English versions (both are supported AdSense languages ([languages](https://support.google.com/adsense/answer/9727))).
- [ ] A persistent header nav and a footer with links to every page. Google stresses "clear, easy-to-use navigation" ([site readiness](https://support.google.com/adsense/answer/7299563)).
- [ ] An explanatory intro on `/` above or beside the form, so the first screen is not form-only.
- [ ] Move `docs/MODEL.md` content onto the site. The GitHub link may stay as "source".

Crawl hygiene

- [ ] `public/robots.txt` (allow all, `Sitemap:` line). Mediapartners-Google ignores the `*` group anyway ([special-case crawlers](https://developers.google.com/search/docs/crawling-indexing/google-special-case-crawlers)).
- [ ] `sitemap.xml` with every content URL.
- [ ] A top-level `404.html`, which disables the SPA fallback and the soft-404s ([Pages serving](https://developers.cloudflare.com/pages/configuration/serving-pages/)). The app uses fragment routing, so it does not need the fallback.
- [ ] `<link rel="canonical">` to the custom domain on every page. Redirect or `noindex` the `*.pages.dev` host (§10).
- [ ] Do **not** add `ads.txt` to the subdomain. Google crawls a subdomain `ads.txt` only when the root `ads.txt` references it with `subdomain=`, and that is only needed when the seller or ID differs ([ads.txt FAQ](https://support.google.com/adsense/answer/9785052)). After `404.html` exists, `/ads.txt` returns a clean 404.

Privacy and consent

- [ ] Bilingual privacy page with Google's required disclosures and PIPA items (§7).
- [ ] Footer copy updated, with a link to the privacy page.
- [ ] Privacy & messaging: a European regulations message published for `vinylims.com`, and a revocation entry point (§7.2).

Technical

- [ ] Strict CSP migration done and verified in report-only (§6).
- [ ] Ad loader gated to the production hostname.
- [ ] Reserved, labelled ad containers with no CLS (§8.3).

---

## 5. Step-by-step application plan

Because the domain-level site already exists, "applying" means making the subdomain policy-safe and ready, then switching ads on. If `vinylims.com` is not yet approved, steps 1–4 also strengthen that review.

1. **Confirm the account state (owner, 10 min).** In AdSense, open Sites and check `vinylims.com`: status, ads.txt column, and Auto ads on/off. Then open Privacy & messaging and check whether a European regulations message already exists. Then open Blocking controls, because the blog's settings will apply to the simulator ([site management](https://support.google.com/adsense/answer/12170421)).
2. **Content and information architecture (PRs, before any ad code).** Ship the guide, model, parameters, tutorial, about and privacy pages as prerendered static HTML with nav. Use a Vite multi-page build (`build.rollupOptions.input`). Switch `base` from `'./'` to `'/'` so nested pages resolve `/assets/…`. Add the intro on `/`. This aligns with the owner's planned docs and tutorial pages.
3. **Crawl hygiene PR.** Add `robots.txt`, `sitemap.xml`, `404.html`, canonical links and the pages.dev `noindex` or redirect. Verify with Lighthouse: SEO should be 100, and `curl -sI …/robots.txt` should return `text/plain`.
4. **Privacy PR.** Add the privacy page (§7.3), the footer rewording and the language-storage disclosure.
5. **CSP migration PR, without ads.** Implement option A (§6.2). Deploy the new enforced policy with no ad code at all. Confirm the app, worker, fonts and charts work with zero console violations. This de-risks the CSP change separately from ads.
6. **Ads PR.**
   - Add the loader module with the hostname gate.
   - Add the reserved `<ins>` containers (§8).
   - Remove `autoplay=()` from Permissions-Policy.
   - Optionally add the `google-adsense-account` meta.
   - Ship. Then watch: AdSense Policy center, the Sites ads.txt column, "Crawler errors", browser console (CSP), and PageSpeed Insights.
7. **Consent.** In Privacy & messaging, enable the European regulations message for the site (2- or 3-button). Test with `?fc=alwaysshow` ([messages setup](https://support.google.com/adsense/answer/10924669)). Expect a revocation link that AdSense adds automatically ([revocation](https://support.google.com/adsense/answer/10959060)).
8. **Auto ads decision.** Prefer manual units on `/` and allow Auto ads only on long-form content pages, using page exclusions ([page exclusions](https://support.google.com/adsense/answer/7479535)). Auto ads settings are per site, which is `vinylims.com`. Whether an exclusion can target `trex-vs-tiger.vinylims.com/…` paths **(unverified)**: Google's text says section exclusions do not cover subdomains, but does not say subdomain URLs cannot be entered directly.
9. **Monitor (ongoing maintenance).** Each release: check the Policy center, keep CLS below 0.1, LCP below 2.5 s and INP at or below 200 ms ([Web Vitals](https://web.dev/articles/vitals)), and keep a CSP report-only canary. Re-run this checklist whenever a new animal, new page type or new visual effect is added.

---

## 6. CSP and header changes to apply when ads go live

### 6.1 What Google supports

Google's AdSense CSP page ([AdSense: CSP](https://support.google.com/adsense/answer/16283098)) says:

```
Content-Security-Policy:
    object-src 'none';
    script-src 'nonce-{random}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:;
    base-uri 'none';
    report-uri https://your-report-collector.example.com/
```

- "we only support strict CSP" means allowlists of AdSense domains are unsupported, because "the domains … change over time".
- "You can choose a more permissive policy if it fits your use case. More restrictive policies may break without notice."
- That policy has **no `default-src`, `img-src`, `frame-src`, `connect-src`, `style-src` or `font-src`**. Those resource types are unrestricted. Our `default-src 'self'` would block ad iframes, beacons and creatives.
- `'unsafe-inline'`, `https:` and `http:` are back-compat fallbacks that browsers supporting nonces or hashes plus `'strict-dynamic'` ignore ([web.dev strict CSP](https://web.dev/articles/strict-csp)). **`'unsafe-eval'` is not ignored.** Google lists it, so keep it to stay within the supported policy. You can test removing it with a parallel report-only header.
- Google's page tells you to follow [Adopt a strict CSP](https://web.dev/articles/strict-csp). That guide says to "use a hash-based CSP for HTML pages served statically", and to load external scripts from a hashed inline script with `document.createElement('script')`. Under `'strict-dynamic'`, scripts created by a trusted script are trusted too.

Constraint: Cloudflare Pages `_headers` is static, so a per-request nonce needs Pages Functions. `_headers` rules are **not** applied to responses generated by Functions ([Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)). Function requests count toward the Workers free quota of 100,000 per day, while static requests are unlimited ([Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)).

### 6.2 Option A (recommended): hash-based strict CSP, fully static

Idea: each HTML page carries one identical inline loader. Its SHA-256 goes into `_headers`. The loader starts the app bundle, and the bundle injects `adsbygoogle.js`. Every script in the chain is created by script (not parser-inserted), so `'strict-dynamic'` trusts them, including AdSense's own children and the Google CMP.

Built HTML (each page):

```html
<meta name="app-entry" content="/assets/index-XXXX.js" />
<script>
  (function (d) {
    var m = d.querySelector('meta[name="app-entry"]');
    if (m) {
      var s = d.createElement('script');
      s.type = 'module';
      s.src = m.content;
      d.head.appendChild(s);
    }
  })(document);
</script>
```

Vite plugin sketch (`vite.config.ts`; build only):

```ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const LOADER =
  `(function(d){var m=d.querySelector('meta[name="app-entry"]');if(m){var s=d.createElement('script');` +
  `s.type='module';s.src=m.content;d.head.appendChild(s)}})(document)`;
const LOADER_HASH = `'sha256-${createHash('sha256').update(LOADER, 'utf8').digest('base64')}'`;

export function strictCspLoader(): Plugin {
  return {
    name: 'strict-csp-loader',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace(
          /<script type="module" crossorigin src="([^"]+)"><\/script>/,
          (_m, src: string) =>
            `<meta name="app-entry" content="${src}">\n    <script>${LOADER}</script>`,
        ),
    },
    closeBundle() {
      const p = 'dist/_headers';
      writeFileSync(p, readFileSync(p, 'utf8').replaceAll("'sha256-LOADER'", LOADER_HASH));
    },
  };
}
```

Notes:

- Set `build.modulePreload: false`. Parser-inserted `<link rel="modulepreload">` tags without a nonce are not trusted under `'strict-dynamic'` **(inference from CSP3 semantics; verify in report-only)**. Today there is one entry chunk, so nothing is lost.
- The loader text is identical on every page, so `_headers` needs only one hash.
- Add a unit test that fails if `dist/_headers` still contains `'sha256-LOADER'`, or if the hash does not match the loader in each `dist/**/*.html`.
- Cloudflare's Bot Fight Mode JS Detections injects an inline script. It is already suppressed by `no-transform`. Keep that.

Ad loader module (in the bundle; no inline script needed):

```ts
// src/ads/adsense.ts
const CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX'; // confirm in AdSense; root ads.txt shows pub-8355379467698162
const PROD_HOST = 'trex-vs-tiger.vinylims.com';

export function initAds(): void {
  if (location.hostname !== PROD_HOST) return; // never on *.pages.dev, previews or localhost
  const units = document.querySelectorAll('ins.adsbygoogle');
  if (units.length === 0) return;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  document.head.append(s);
  const w = window as unknown as { adsbygoogle?: unknown[] };
  const q = (w.adsbygoogle ??= []);
  units.forEach(() => q.push({}));
}
```

- Call `initAds()` once per page load. Never call it again after a simulation run, because of the auto-refresh rule ([placement](https://support.google.com/adsense/answer/1346295)).
- Sizing `<ins>` with CSS classes instead of `style="…"` is an accepted modification ("The asynchronous ad code allows you to set the size of an ad through CSS") ([ad code modifications](https://support.google.com/adsense/answer/1354736); [responsive ad code](https://support.google.com/adsense/answer/9183363)).
- Pushing from a bundle instead of an inline `<script>` changes how the code is placed, not ad behavior **(inference: acceptable under the same page)**.

`public/_headers` diff (only the `/*` rule changes; asset and HTML cache rules stay):

```diff
 /*
-  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
+  Content-Security-Policy: script-src 'sha256-LOADER' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; object-src 'none'; base-uri 'self'; worker-src 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
+  Content-Security-Policy-Report-Only: script-src 'sha256-LOADER' 'strict-dynamic'; object-src 'none'; base-uri 'self'; worker-src 'self'
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
-  Permissions-Policy: accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), xr-spatial-tracking=()
+  Permissions-Policy: accelerometer=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), xr-spatial-tracking=()
   Cross-Origin-Opener-Policy: same-origin
   X-Frame-Options: DENY
```

Why each directive:

| Directive                                                                                       | Decision                                                            | Reason                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script-src 'sha256-…' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https: http:`             | Mirrors Google's supported set, with the hash in place of the nonce | [AdSense CSP](https://support.google.com/adsense/answer/16283098), [web.dev](https://web.dev/articles/strict-csp)                                                                                                                        |
| No `default-src`, `style-src`, `img-src`, `frame-src`, `connect-src`, `font-src` or `media-src` | Removed                                                             | Google's supported policy leaves them open. Ad iframes, beacons, CMP frames and inline ad styles need them. A Google `<ins>` uses inline styles, and AdSense injects styles **(inference)**.                                             |
| `worker-src 'self'`                                                                             | Kept                                                                | It is more restrictive than Google's policy, but it protects our `new Worker(...)` from the `'strict-dynamic'` fallback ambiguity. Watch reports. If AdSense ever needs `blob:` workers, add `blob:` **(unverified need)**.              |
| `base-uri 'self'`                                                                               | Kept                                                                | Google uses `'none'`. `'self'` is more permissive, which is allowed.                                                                                                                                                                     |
| `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                               | Kept                                                                | These control who may frame _our_ page, not the ads inside it. They do not affect ad serving. The Auto ads _preview_ tool might frame the site **(unverified)**. If preview fails, it does not affect live serving.                      |
| `form-action 'self'`, `upgrade-insecure-requests`                                               | Kept                                                                | They do not affect cross-origin ad iframes **(inference)**.                                                                                                                                                                              |
| Report-only twin without `'unsafe-eval'`                                                        | Added                                                               | Shows whether AdSense actually needs eval on this site. Without a `report-to` endpoint, violations appear only in DevTools. A small `/csp-report` Pages Function (billed only per report) or a third-party collector can be added later. |

`_headers` gotcha: if a header is set by two matching rules, Pages joins the values with a comma ([Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)). Two comma-joined CSPs are **two policies, both enforced**. Keep CSP in the `/*` rule only.

### 6.3 Option B: per-request nonce with a Pages Function (Google's literal example)

Use this only if option A shows breakage in testing.

- Set Vite `html.cspNonce: '__CSP_NONCE__'`. Vite then adds the nonce to `<script>`, `<style>` and modulepreload or stylesheet `<link>` tags, and emits `<meta property="csp-nonce">` ([Vite CSP](https://vite.dev/guide/features#content-security-policy-csp)).
- Add `functions/_middleware.ts`. For `text/html` responses it should:
  1. generate 16 random bytes and base64-encode them as the nonce;
  2. `replaceAll('__CSP_NONCE__', nonce)` in the body;
  3. set the CSP with `'nonce-…'`;
  4. **re-set every security header**, because `_headers` does not apply to Function responses;
  5. set `Cache-Control: no-store` and delete `ETag`. A revalidated 304 would otherwise pair a cached body (old nonce) with a new header **(inference)**.
- Add `_routes.json` with `{"version":1,"include":["/*"],"exclude":["/assets/*","/favicon.svg","/robots.txt","/sitemap.xml"]}`. This keeps static requests free and unlimited ([Functions routing](https://developers.cloudflare.com/pages/functions/routing/)).
- Side benefit: Cloudflare JS Detections adds the nonce to its injected script when the CSP header carries one ([Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)).
- Costs: Workers quota, and a server component in a "zero runtime deps, static" project.

### 6.4 Other headers

| Header                                         | Today                             | Change                                                                           | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Referrer-Policy`                              | `strict-origin-when-cross-origin` | **Keep**                                                                         | Google's CMP "cannot serve if the site's referrer policy does not allow the referrer … The default strict-origin-when-cross-origin is sufficient" ([message troubleshooting](https://support.google.com/adsense/answer/14660912)). Values such as `same-origin` or `no-referrer` would break messages ([Ad Manager GPT messages](https://support.google.com/admanager/answer/10114216)).                                                                                                                          |
| `Cross-Origin-Opener-Policy`                   | `same-origin`                     | Keep, and fall back to `same-origin-allow-popups` if a consent or ad flow breaks | Ad clicks open new browsing contexts. Under `same-origin`, cross-origin popups get no `window.opener` ([MDN COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)). Ad landing pages normally do not need the opener. I found no Google doc on COOP and AdSense **(unverified)**.                                                                                                                                                                                 |
| `Cross-Origin-Embedder-Policy`                 | not set                           | **Never add**                                                                    | Google Publisher Tag "doesn't support pages using Cross-Origin-Embedder-Policy" ([GPT COEP](https://developers.google.com/publisher-tag/guides/cross-origin-embedder-policy)). AdSense is assumed to behave the same **(inference)**.                                                                                                                                                                                                                                                                             |
| `Permissions-Policy: autoplay=()`              | set                               | **Remove**                                                                       | When disabled, "calls to play() without a user gesture will reject … the autoplay attribute will also be ignored" ([Chrome autoplay](https://developer.chrome.com/blog/autoplay); [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/autoplay)). This blocks muted video creatives.                                                                                                                                                                                     |
| `Permissions-Policy: browsing-topics=()`       | set                               | Optional removal                                                                 | Google retired Topics, Protected Audience, Attribution Reporting and other APIs on 2025-10-17 ([Privacy Sandbox update](https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies)), and filed an intent to remove Topics on 2025-11-07 ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/_R85yctz4Rs/m/CkQpJil0AQAJ)). It has no ad effect. Remove it once Chromium stops recognizing the token, to keep the "only recognized features" rule in `DEPLOYMENT.md`. |
| `Cache-Control: no-cache, no-transform` (HTML) | set                               | Keep                                                                             | Still needed to stop Bot Fight Mode JSD injection under option A.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `X-Frame-Options` / `frame-ancestors`          | DENY / 'none'                     | Keep                                                                             | Irrelevant to ads shown on our page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Also update `docs/DEPLOYMENT.md`, which describes the CSP and "The app makes no network calls", and `README.md` in the same PR.

---

## 7. Consent and privacy

### 7.1 EEA, UK and Switzerland

- Policy: Google's [EU user consent policy](https://www.google.com/about/company/user-consent-policy/) requires legally valid consent for cookies and local storage where legally required, and for ads personalization. It also requires keeping consent records and giving "clear instructions for revocation of consent".
- Certified CMP: a Google-certified CMP integrated with the IAB TCF is required for personalized ads in the EEA and UK (since 2024-01-16) and Switzerland (since 2024-07-31). "Traffic from a non-certified CMP may be eligible for non-personalized ads or limited ads" ([CMP requirement](https://support.google.com/adsense/answer/13554116)). Google's own CMP is listed (Google LLC CMP, TCF CMP ID 300, web and app).
- TCF version: Google's consent solutions in Privacy & messaging support **TCF v2.3** ([AdSense TCF troubleshooting](https://support.google.com/adsense/answer/9999955)). v2.3 has been mandatory for TC strings created on or after 2026-03-01, and failures default to Limited Ads. "No action is required if you are using the Google CMP" ([Ad Manager TCF](https://support.google.com/admanager/answer/9805023)).
- Recommendation: use **Privacy & messaging, European regulations message**. It is free, runs through the same AdSense tag (so no extra CSP work under `'strict-dynamic'`), and handles TCF v2.3 ([about European regulations messages](https://support.google.com/adsense/answer/10961068)). The consent button text must signal clear affirmative consent. "Proceed to site" is not acceptable.
- Revocation: AdSense automatically adds the revocation link on approved sites with the AdSense code ([revocation](https://support.google.com/adsense/answer/10959060)). If you add your own "Privacy and cookie settings" link, do **not** copy Google's `href="javascript:…"` example, because strict CSP blocks `javascript:` URLs. Use a `<button>` with a listener in the bundle that calls `googlefc.callbackQueue.push(googlefc.showRevocationMessage)` ([FC API](https://developers.google.com/funding-choices/fc-api-docs)).
- Consent Mode v2 (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) lets _Google tags_ such as GA4 and Google Ads respect consent ([consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)). AdSense reads the TC string. Consent Mode only matters if GA4 or Google Ads tags are added later. Then enable "consent mode for advertising/analytics purposes" in Privacy & messaging ([consent mode settings](https://support.google.com/adsense/answer/16053245)). Today the site has no analytics, so no action is needed.
- Optional: AdSense also has US-state regulation messages (CCPA-style opt-out). They are not required for this audience. Evaluate them if US traffic grows **(not researched in depth)**.

### 7.2 Korea (PIPA, 개인정보 보호법)

- Privacy policy content: PIPA Art. 30(1)(7) requires the privacy policy to cover "인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치·운영 및 그 거부에 관한 사항(해당하는 경우에만 정한다)". The policy must be posted continuously on the website. Source: secondary summaries ([wikidocs](https://wikidocs.net/230549); search results). **Verify against the current text at [law.go.kr](https://www.law.go.kr/법령/개인정보보호법)**, which could not be fetched (it is JS-only).
- PIPC policy on behavioral ads (2024-01-31): non-identifying behavioral data may be processed without consent, but with transparency and an opt-out. Ad media operators, meaning sites like ours, are recommended to list third-party behavioral-data collection **per web or app** in their privacy policy. For children under 14: where the service knows the user is under 14 or children are the main users, operators should not collect behavioral data for targeted ads ([etoday report of the PIPC announcement](https://www.etoday.co.kr/news/view/2327015)). The PIPC primary document was not fetched **(secondary source)**.
- What this means here: the site is general-audience and not child-directed. A dinosaur theme can attract children, so keep the copy and UX aimed at a general or adult audience, and do not market to children. If the owner decides the site is child-directed, use Google's age signal: TFAT `CHILD`, which replaces the deprecated TFCD and TFUA tags ([TFAT](https://support.google.com/adsense/answer/17042704)). Or request non-personalized ads with `requestNonPersonalizedAds=1` ([NPA code](https://support.google.com/adsense/answer/9042142)). Either choice lowers revenue. Korea's model is notice plus opt-out (no cookie banner required for non-identifying ads data) **(inference from the PIPC policy; not legal advice)**.

### 7.3 Privacy page (`/privacy`, ko + en). Required content

1. Google's required disclosures ([AdSense required content](https://support.google.com/adsense/answer/1348695)):
   - "Third party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites."
   - "Google's use of advertising cookies enables it and its partners to serve ads to your users based on their visit to your sites and/or other sites on the Internet."
   - Users may opt out of personalized advertising via Google Ads Settings, or via www.aboutads.info.
   - If third-party vendors or ad networks are enabled, name them and link to their opt-outs.
2. PIPA items:
   - The operator does not collect personal data directly. Simulations run locally, and `localStorage` stores the language only.
   - Google collects data through automatic collection devices (cookies, device identifiers, IP). State the purpose (ad serving and measurement) and how to refuse (browser cookie settings, Google My Ad Center or Ads Settings).
   - The privacy officer's contact (개인정보 보호책임자).
   - Effective date and change history.
3. An EEA, UK and Swiss consent note, plus the "Privacy and cookie settings" entry point.
4. Link this page from the footer of every page, and enter its URL in the Privacy & messaging message settings.

---

## 8. Page and layout recommendations

### 8.1 Information architecture (real URLs, prerendered)

| URL                 | Content                                                                                  | Ads                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/` (simulator)     | Intro paragraph, form, results, replay, disclaimer                                       | At most 2 manual units (below)                                                                                            |
| `/guide/`           | How to use: presets, reading CI, sensitivity, replay controls                            | In-article after section 2, plus end of page                                                                              |
| `/model/`           | Model description (from `docs/MODEL.md`), assumptions, limitations, references           | In-article plus end; side rail via Auto ads on desktop is acceptable                                                      |
| `/parameters/`      | All 22 parameters: meaning, range, distribution, source, effect                          | In-article every ~3 screens of content                                                                                    |
| `/tutorial/`        | Step-by-step walkthrough. It can embed a live mini-sim, but the text must exist in HTML. | Only at the end. Never next to the tutorial's Next/Previous buttons.                                                      |
| `/about/`           | Who, why, contact, educational stance, conservation note                                 | Optional, one unit                                                                                                        |
| `/privacy/`, `/404` | —                                                                                        | **None** (404 is a "dead end" screen ([no-content policy](https://support.google.com/publisherpolicies/answer/11112688))) |

Bilingual: use `/en/...` mirrors or `?lang=` with `hreflang`. Each language needs crawlable text.

### 8.2 Placement rules for the simulator page

- **Slot S1, all viewports:** after the replay section and the disclaimer, directly above the footer, at least 150 px below the replay controls. Google recommends 150 px for game windows ([placement](https://support.google.com/adsense/answer/1346295)).
- **Slot S2, desktop at 1024 px or wider only:** left column, below the Scenario card. Keep at least 150 px of spacing below the Run/Cancel buttons and add a visible label "광고 / Advertisement". Remove S2 if testing shows mis-clicks.
- Never put ads:
  - inside or next to the result cards, chart legends, preset chips, speed `<select>`, timeline slider or the replay canvas;
  - in the progress or ETA state ("behavioral" screens);
  - in a modal or tutorial overlay;
  - in a floating or sticky custom container.
- Never re-request ads on "Run", "대표 전투" or "무작위 전투". That would be an element refresh without a user request for one ([placement: auto-refreshing ads](https://support.google.com/adsense/answer/1346295)).
- Mobile Auto ads overlays: a bottom anchor can cover the replay controls. Prefer manual units on `/`, and exclude `/` from Auto ads if the root site has Auto ads enabled (§5 step 8). Vignettes appear "between page loads" ([Auto ads](https://support.google.com/adsense/answer/9261805)). With a multi-page site they will trigger on nav clicks, so cap or disable them if they hurt the tutorial flow.
- Labels: use only "광고" or "스폰서 링크" (en: "Advertisements" or "Sponsored Links"). Never use headings such as "추천 링크" or "유용한 자료" ([placement, ko](https://support.google.com/adsense/answer/1346295?hl=ko)).
- Ad-to-content ratio: content must dominate. Google treats whitespace, header, footer and links as non-content ([more ads than content](https://support.google.com/publisherpolicies/answer/11169917)).

### 8.3 Zero-CLS containers (CSP-safe, no inline style)

Use Google's documented "exact ad unit size per screen width" pattern ([responsive ad code](https://support.google.com/adsense/answer/9183363)):

```html
<aside class="ad-slot" aria-label="광고">
  <p class="ad-slot__label" data-i18n="ad.label">광고</p>
  <ins
    class="adsbygoogle ad-unit-banner"
    data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
    data-ad-slot="1234567890"
  ></ins>
</aside>
```

```css
.ad-slot {
  margin-block: 48px;
  text-align: center;
}
.ad-slot__label {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.ad-unit-banner {
  display: inline-block;
  width: 320px;
  height: 100px;
}
@media (min-width: 500px) {
  .ad-unit-banner {
    width: 468px;
    height: 60px;
  }
}
@media (min-width: 800px) {
  .ad-unit-banner {
    width: 728px;
    height: 90px;
  }
}
.ad-unit-rect {
  display: inline-block;
  width: 300px;
  height: 250px;
} /* S2 */
```

- Fixed heights mean the reserved space equals the served size, so the ad causes no layout shift ([web.dev CLS](https://web.dev/articles/optimize-cls): "add a min-height … or … aspect-ratio" and "avoid collapsing the reserved space").
- Do not collapse unfilled in-viewport units. AdSense itself only collapses units outside the viewport ([unfilled ads](https://support.google.com/adsense/answer/10762946)). Hiding via `ins[data-ad-status="unfilled"] { display:none }` is allowed, but use it only for below-the-fold slots. Hiding ad units otherwise is a disallowed modification ([modifications](https://support.google.com/adsense/answer/1354736)).
- Avoid `data-full-width-responsive="true"` on mobile slots that sit above content. It changes the width and can shift layout **(inference)**.
- Dark theme: give the slot a neutral surface (`--surface-2`). Do not restyle creatives to look like content (misleading-placement risk).

---

## 9. Core Web Vitals impact

- Baseline (prod, Lighthouse 13.5): LCP 0.4 s desktop and 1.4 s mobile, CLS ≈ 0, TBT ≤ 50 ms. Targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 ([Web Vitals](https://web.dev/articles/vitals)).
- Expected effects of `adsbygoogle.js` and creatives:
  - Third-party main-thread work raises TBT and INP risk. The simulator's compute stays in Web Workers, but charts and the replay render on the main thread.
  - CLS from late-loading in-page units, controlled with §8.3.
  - Network contention on mobile.
  - I did not measure script size here **(unverified)**. Measure after launch.
- Mitigations:
  1. Start the ad loader after the app's first render (`requestIdleCallback` with a timeout fallback), so ads never delay the form or results LCP **(inference: allowed, since it does not inflate performance; Google publishes no specific rule)**.
  2. On `/`, no ad above the fold on mobile. S1 sits at the bottom.
  3. Fixed-size containers.
  4. Keep the replay `requestAnimationFrame` loop paused when the canvas is off-screen, to reduce INP contention with ad scripts.
  5. Re-run Lighthouse and PSI per release. Field CrUX data needs traffic.
- Third-party "lazy-load AdSense" plugins claim large score recoveries. These are vendor claims and are not adopted here ([Advanced Ads](https://wpadvancedads.com/adsense-page-speed-core-web-vitals/)).

---

## 10. Cloudflare-specific notes

- **Bot Fight Mode (zone `vinylims.com`):**
  - It "Cannot be customized, adjusted, or reconfigured via WAF custom rules", and Skip, Bypass and Allow have no effect. JS Detections are forced on ([BFM](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)).
  - Verified-bot allowlisting is listed as a **Super** Bot Fight Mode capability (Pro and above) ([Cloudflare use case](https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/)).
  - Community threads report Bot Fight Mode challenging Googlebot and Google-Display-Ads-Bot (anecdotal; the thread pages were Cloudflare-gated, so I saw them only in search results).
  - Whether Mediapartners-Google is on Cloudflare's verified-bot list is **(unverified)**.
  - Mitigation: the root blog already runs AdSense in the same zone, so check the AdSense "Crawler errors" report for both hosts. If you see blocked fetches, disable Bot Fight Mode for the zone (Security → Settings). That is the only lever on the Free plan.
  - Also keep `robots.txt` permissive for `Mediapartners-Google` and `Google-Display-Ads-Bot`, which is used to verify sites ([AdSense crawler](https://support.google.com/adsense/answer/99376)).
- **`no-transform`:** keep it under option A. Under option B the JSD script can carry the nonce instead.
- **`*.pages.dev` duplicate:** add a Bulk Redirect from `trex-vs-tiger-sim.pages.dev` to the custom domain ([Pages redirect](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)), or add `https://trex-vs-tiger-sim.pages.dev/*` → `X-Robots-Tag: noindex` in `_headers` ([Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)). Also keep the hostname gate in `initAds()` so preview and pages.dev deployments never request ads. They are not authorized sites, and test clicks there could look like invalid traffic **(inference)**.
- **Speed Brain (`speculation-rules` header):** Cloudflare adds speculation rules on this zone. If it ever switches from prefetch to _prerender_, ad impressions could fire for pages the user never views **(unverified behavior)**. Watch impression/pageview ratios, and turn Speed Brain off if they look inflated.
- **Functions quota:** relevant only for option B (100k requests/day shared with Workers on the Free plan ([pricing](https://developers.cloudflare.com/pages/functions/pricing/))).

---

## 11. Risks and open questions

| Risk / question                                                                      | Likelihood                                   | Impact                                               | Mitigation / owner                                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `vinylims.com` not yet approved (placeholder slot IDs on the blog)                   | Unknown                                      | High: no ads anywhere until approved                 | Owner checks the Sites page. Ship the content pages first.               |
| Simulator content judged "low value"                                                 | High today, low after the content pages ship | Ads limited or disabled                              | §8.1 pages before turning on ads                                         |
| Policy strike on the subdomain affects the blog                                      | Low                                          | High (domain-level)                                  | §3.3 framing. Use review mode in the Policy center before launch.        |
| Hash-based strict CSP breaks some AdSense feature, since Google documents only nonce | Low–moderate **(unverified)**                | Partial ad or CMP failure                            | Test in production with a report-only twin. Fall back to option B.       |
| `'unsafe-eval'` weakens XSS protection                                               | Certain while present                        | Low for a static site with no user-generated content | Test removing it with a report-only twin.                                |
| `worker-src 'self'` stricter than Google's policy                                    | Low                                          | Ad feature break **(unverified)**                    | Monitor. Add `blob:` if reports show it is needed.                       |
| Auto ads settings shared with the blog                                               | High                                         | Unexpected anchors or vignettes on the simulator     | Page exclusions or manual units only. Coordinate settings with the blog. |
| Mediapartners blocked by Bot Fight Mode                                              | Low–moderate **(unverified)**                | Poor targeting, crawl errors                         | Watch crawler errors. Disable Bot Fight Mode if needed.                  |
| Child audience (PIPC under-14 guidance, COPPA)                                       | Low–moderate                                 | Legal and revenue                                    | General-audience positioning. TFAT `CHILD` if it becomes child-directed. |
| New animals or animation drift into gore or domestic-animal fights                   | Medium over time                             | Restriction or violation                             | Add §3.3 to the PR review checklist (CONTRIBUTING).                      |
| CLS regressions from ad slots                                                        | Medium                                       | CWV and SEO                                          | Fixed-size slots, Lighthouse CI gate CLS < 0.1                           |

Open questions for the owner:

1. Is `pub-8355379467698162` your account, and is `vinylims.com` Ready?
2. Is Auto ads on for `vinylims.com`, and which formats?
3. Do you prefer option A (static) or B (Function) for CSP?
4. Do you want bilingual URLs (`/en/…`) or a single bilingual page per topic?

---

## 12. Sources

Google AdSense and Publisher Policies (fetched 2026-10-19 unless noted):

- Eligibility requirements: https://support.google.com/adsense/answer/9724
- Make sure your site's pages are ready: https://support.google.com/adsense/answer/7299563
- Connect your site (code snippet / ads.txt / meta tag; review 2–4 weeks; CMP choice): https://support.google.com/adsense/answer/7584263
- What to do when your site is not ready: https://support.google.com/adsense/answer/12176698
- Site management is changing (subdomains): https://support.google.com/adsense/answer/12170421
- One account per publisher: https://support.google.com/adsense/answer/9729
- Supported languages: https://support.google.com/adsense/answer/9727
- Program policies: https://support.google.com/adsense/answer/48182
- Ad placement policies: https://support.google.com/adsense/answer/1346295 (ko: https://support.google.com/adsense/answer/1346295?hl=ko)
- Modifications of AdSense ad code: https://support.google.com/adsense/answer/1354736
- How to modify your responsive ad code: https://support.google.com/adsense/answer/9183363
- data-ad-status / unfilled units: https://support.google.com/adsense/answer/10762946
- About Auto ads: https://support.google.com/adsense/answer/9261805
- Auto ads page exclusions (search result summary, not fetched): https://support.google.com/adsense/answer/7479535
- AdSense ads crawler: https://support.google.com/adsense/answer/99376
- AdSense CSP integration: https://support.google.com/adsense/answer/16283098
- Ads.txt guide: https://support.google.com/adsense/answer/12171612
- Ads.txt FAQs (subdomain=, redirects): https://support.google.com/adsense/answer/9785052
- Ensure ads.txt can be crawled: https://support.google.com/adsense/answer/7679060
- Required privacy policy content: https://support.google.com/adsense/answer/1348695
- CMP requirements (EEA/UK/CH): https://support.google.com/adsense/answer/13554116
- TCF v2.3 troubleshooting: https://support.google.com/adsense/answer/9999955
- About European regulations messages: https://support.google.com/adsense/answer/10961068
- Create a European regulations message (search result summary; `?fc=alwaysshow`): https://support.google.com/adsense/answer/10924669
- Consent mode settings: https://support.google.com/adsense/answer/16053245
- Consent message troubleshooting (referrer policy): https://support.google.com/adsense/answer/14660912
- Consent revocation link: https://support.google.com/adsense/answer/10959060
- Ad code for non-personalized ads: https://support.google.com/adsense/answer/9042142
- Tag for age treatment (TFAT): https://support.google.com/adsense/answer/17042704
- Google Publisher Policies: https://support.google.com/publisherpolicies/answer/10502938
- Animal cruelty: https://support.google.com/publisherpolicies/answer/10400059
- Adult themes in family content: https://support.google.com/publisherpolicies/answer/10437484
- Dangerous or derogatory content: https://support.google.com/publisherpolicies/answer/10522641
- Google Publisher Restrictions: https://support.google.com/publisherpolicies/answer/10437795
- Shocking content: https://support.google.com/publisherpolicies/answer/10437538
- Screens without publisher-content: https://support.google.com/publisherpolicies/answer/11112688
- More ads than publisher-content (search result summary): https://support.google.com/publisherpolicies/answer/11169917
- Ad Manager: IAB TCF integration and v2.3 timeline: https://support.google.com/admanager/answer/9805023
- Ad Manager: GPT messages and referrer policy: https://support.google.com/admanager/answer/10114216
- EU user consent policy: https://www.google.com/about/company/user-consent-policy/
- Privacy & messaging JS API: https://developers.google.com/funding-choices/fc-api-docs
- Consent mode concepts: https://developers.google.com/tag-platform/security/concepts/consent-mode
- GPT and COEP: https://developers.google.com/publisher-tag/guides/cross-origin-embedder-policy
- Google special-case crawlers (Mediapartners-Google): https://developers.google.com/search/docs/crawling-indexing/google-special-case-crawlers

Web platform:

- Strict CSP (nonce vs hash, dynamic loading): https://web.dev/articles/strict-csp
- Optimize CLS (ads, reserve space): https://web.dev/articles/optimize-cls
- Web Vitals thresholds: https://web.dev/articles/vitals
- Vite CSP / `html.cspNonce`: https://vite.dev/guide/features#content-security-policy-csp, https://vite.dev/config/shared-options#html-cspnonce
- Chrome autoplay policy: https://developer.chrome.com/blog/autoplay
- MDN Permissions-Policy autoplay: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/autoplay
- MDN COOP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
- Privacy Sandbox retirement (2025-10-17): https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies
- Intent to Deprecate and Remove: Topics API (2025-11-07): https://groups.google.com/a/chromium.org/g/blink-dev/c/_R85yctz4Rs/m/CkQpJil0AQAJ

Cloudflare:

- Bot Fight Mode: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- Stop malicious bots (BFM vs Super BFM, verified bots): https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/
- Verified bots concept (search result summary): https://developers.cloudflare.com/bots/concepts/bot/verified-bots/
- Pages serving (404 / SPA fallback): https://developers.cloudflare.com/pages/configuration/serving-pages/
- Pages `_headers` (Functions caveat, comma-join, pages.dev noindex example): https://developers.cloudflare.com/pages/configuration/headers/
- Pages Functions pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Pages Functions routing / `_routes.json`: https://developers.cloudflare.com/pages/functions/routing/
- Redirect pages.dev to a custom domain: https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/

Korea:

- PIPC "맞춤형 광고에 활용되는 온라인 행태정보 보호를 위한 정책 방안" (2024-01-31), as reported: https://www.etoday.co.kr/news/view/2327015
- PIPA Art. 30 privacy-policy items (secondary): https://wikidocs.net/230549. Primary text to verify: https://www.law.go.kr/법령/개인정보보호법

Other:

- IUCN SSC Cat Specialist Group, tiger status (Endangered): https://www.catsg.org/living-species-tiger
- Vendor claim on lazy-loading AdSense (not adopted): https://wpadvancedads.com/adsense-page-speed-core-web-vitals/

Local evidence (this repo and production, 2026-10-19):

- `curl https://vinylims.com/ads.txt` → `google.com, pub-8355379467698162, DIRECT, f08c47fec0942fa0`
- `curl https://vinylims.com/` → loads `adsbygoogle.js?client=ca-pub-8355379467698162`; `<ins … data-ad-slot="HOME_FEED_1">`
- `curl -I https://trex-vs-tiger.vinylims.com/` → current header set (§2)
- `curl https://trex-vs-tiger.vinylims.com/{robots.txt,ads.txt,privacy,sitemap.xml}` → 200 `text/html` (index.html)
- Lighthouse 13.5.0 prod reports: `<local-workspace>/lh/lh-prod-mobile.json`, `lh-prod-desktop.json` (SEO fail: `robots-txt`)

---

## 13. Update 2026-10-26: subdomains, review status, site structure

Research date: 2026-10-26.

**Status.** The AdSense Sites page shows `vinylims.com` as **Getting ready**, last updated 2026-10-20, with ads.txt **Authorized** (owner's screenshot).

**Method.** Official pages were fetched with curl and quoted. Three independent checkers then tried to refute each claim against the same pages. One claim was downgraded to an inference (13.4, row 1).

The owner asked whether the blog could move to a subdomain, with `vinylims.com` becoming an introduction page above the blog and this simulator. The deciding question was whether AdSense can serve ads on separate subdomains.

### 13.1 Subdomains

| Question                                                                          | Finding                                                                                                                                                                                                                                                                                                                     | Source                                                                                                                                                                                                                                                                           | Confidence |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Can `trex-vs-tiger.vinylims.com` or `blog.vinylims.com` be added as its own site? | No. Only these can be added: domains, subdomains on Public Suffix List platforms (for example `site.appspot.com`), and sites run by AdSense platform partners (for example Blogger). `vinylims` is not on the PSL.                                                                                                          | [12170421](https://support.google.com/adsense/answer/12170421?hl=en), [PSL](https://publicsuffix.org/list/public_suffix_list.dat)                                                                                                                                                | High       |
| Do ads serve on a subdomain once `vinylims.com` is Ready?                         | Yes, with no separate site review **(inference)**. Supporting text: "This will not impact ad serving or your earnings" (about removed subdomain entries), "You can only serve ads on a site after it has passed our review", and the Sites report covers "domains and subdomains". No official sentence states it outright. | [12170421](https://support.google.com/adsense/answer/12170421?hl=en), [12131223](https://support.google.com/adsense/answer/12131223?hl=en), [10075505](https://support.google.com/adsense/answer/10075505?hl=en)                                                                 | Medium     |
| Does a subdomain need its own `ads.txt`?                                          | No. The root file covers subdomains. A subdomain file plus a `subdomain=` line in the root file is needed only when the seller or publisher ID differs. The 404 at `trex-vs-tiger.vinylims.com/ads.txt` is correct.                                                                                                         | [9785052](https://support.google.com/adsense/answer/9785052?hl=en), [IAB ads.txt 1.1 §5.5](https://github.com/InteractiveAdvertisingBureau/Supply-Chain-Validation/blob/main/ads.txt%20v1.1.md)                                                                                  | High       |
| Can settings be split per subdomain?                                              | Reporting can: the Sites report, plus a different `data-ad-channel` value on each host. Blocking controls and Auto ads defaults are per domain. Page exclusions match URLs on the same host only.                                                                                                                           | [10075505](https://support.google.com/adsense/answer/10075505?hl=en), [10078316](https://support.google.com/adsense/answer/10078316?hl=en), [180609](https://support.google.com/adsense/answer/180609?hl=en), [7479535](https://support.google.com/adsense/answer/7479535?hl=en) | High       |
| Is a subdomain exempt from policy because it skips site review?                   | No. Policy and blocking apply at the domain level, so a problem on the simulator can affect the `vinylims.com` entry **(inference)**.                                                                                                                                                                                       | [12170421](https://support.google.com/adsense/answer/12170421?hl=en)                                                                                                                                                                                                             | Medium     |

### 13.2 Getting ready

- **Meaning:** "We're running some checks on your site. The review process usually takes a few days, but in some cases can take 2-4 weeks." The same status also covers accounts with setup tasks still pending, such as payment details ([12170222](https://support.google.com/adsense/answer/12170222?hl=en)).
- **Do not remove and resubmit:** "Make sure you don't remove your site and resubmit it because this can delay the process" ([12170222](https://support.google.com/adsense/answer/12170222?hl=en)).
- **Scope of review:** "we may review all pages of your site, not just the sign-up URL where you placed the code" ([81904](https://support.google.com/adsense/answer/81904?hl=en)).
- **Navigation problems:** the same page lists redirects and pages under construction among navigation problems.

### 13.3 Site structure decision

**Decision.** Keep the blog at the root until `vinylims.com` is Ready. After approval, prefer an introduction home page at `/` with the blog left at `/blog/…` over a move to `blog.vinylims.com`. The home page can be excluded from Auto ads ([7479535](https://support.google.com/adsense/answer/7479535?hl=en): "you might not want to show ads on your homepage").

Reasons:

- **No review gain from a move.** A subdomain cannot be registered on its own (13.1).
- **Thin root while under review.** A move leaves the root as a short page plus redirects, which matches the rejection criteria: too little text, under construction, redirects as a navigation problem ([81904](https://support.google.com/adsense/answer/81904?hl=en), [10015918](https://support.google.com/adsense/answer/10015918?hl=en)) **(inference)**.
- **One change at a time.** Google's site-move guide says to plan changes "one after the other, not everything at the same time" ([site move](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)).
- **Simpler variant after approval.** An introduction home page at `/` with the blog kept at `/blog/…` changes no URLs, so it needs no redirects and no re-indexing.

If a subdomain move is ever needed, use per-URL 301 redirects and sitemaps, and keep the redirects for at least a year ([site move](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)). Cloudflare Pages `_redirects` defaults to 302, so append `301` ([Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/)). The Search Console Change of Address tool does not fit a partial move:

- It moves a domain-level property with "all paths under the domain".
- It requires a 301 from the old home page, which here stays in place.

([Change of Address](https://support.google.com/webmasters/answer/9370220?hl=en))

### 13.4 Ad code and labels

| Item                                                            | Finding                                                                                                                                                                                                                         | Source                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Placeholder slot ids on the blog (`HOME_FEED_1`, `POST_HEADER`) | Not ids issued by the account, which breaks the rule to implement code "exactly as it appears" in the account. Google does not document what such units do after approval, so do not rely on them ever filling **(inference)**. | [2708537](https://support.google.com/adsense/answer/2708537?hl=en)                                                                     |
| Ad labels                                                       | Only "Advertisements" or "Sponsored Links" (ko: 광고 / 스폰서 링크); no label is also allowed. A bare "Sponsored" is not one of them.                                                                                           | [1346295](https://support.google.com/adsense/answer/1346295?hl=en)                                                                     |
| Hiding unfilled units                                           | Allowed through `ins.adsbygoogle[data-ad-status="unfilled"]` CSS. Not for units that "Fill empty in-page ads" optimised (`unfill-optimized`), and never for units loaded hidden.                                                | [10762946](https://support.google.com/adsense/answer/10762946?hl=en)                                                                   |
| Ads near the simulator controls                                 | No placement that causes accidental clicks: keep units at least 150 px from game play areas, or leave the game page ad-free. This matches the S2 rule in [docs/ADSENSE.md](../ADSENSE.md).                                      | [1346295](https://support.google.com/adsense/answer/1346295?hl=en), [2768340](https://support.google.com/adsense/answer/2768340?hl=en) |
