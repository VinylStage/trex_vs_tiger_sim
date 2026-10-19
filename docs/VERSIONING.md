# Versioning, update detection and cache reset

> **한국어 요약**
>
> - 헤더의 배지가 지금 실행 중인 릴리스 버전(`v0.1.0`)과 상태(**확인 중 / 최신 / 새 버전 vX.Y.Z / 새 빌드 / 확인 불가**)를 보여 줍니다. 푸터에도 `버전 v0.1.0 (커밋 7자리)`가 표시되고 릴리스 노트로 연결됩니다.
> - 버전은 빌드 시점에 `package.json`의 `version`(release-please가 올림)과 커밋 SHA(`CF_PAGES_COMMIT_SHA`, 없으면 `git rev-parse HEAD`)에서 가져와 번들에 넣고, 같은 내용을 `dist/version.json`으로도 내보냅니다.
> - 페이지는 로드 직후, 탭이 다시 보일 때(10분 간격 제한), 보이는 동안 30분마다 `/version.json`을 `no-store`로 받아 자기 버전과 비교합니다. 버전이 더 높거나, 버전이 같아도 커밋이 다르면 새 배포로 봅니다.
> - 새 배포가 있으면 레이아웃을 밀지 않는 고정 배너가 뜨고, 배지를 누르면 버전 정보 대화상자가 열립니다. **최신 버전 불러오기 (캐시·저장소 초기화)** 를 확인하면 Cache Storage, 서비스 워커, localStorage, sessionStorage, 이 호스트의 JS 쿠키를 지운 뒤 `/reset/`으로 이동합니다. `/reset/` 응답의 `Clear-Site-Data: "cache", "storage"` 헤더가 브라우저 캐시와 저장소를 한 번 더 비우고, 페이지는 `/?_r=<시각>`으로 새로 불러옵니다. 시나리오(URL `#s=`)는 유지됩니다.
> - 언어 설정과 튜토리얼 진행 상태는 초기화됩니다(확인 문구에 안내).
> - `Clear-Site-Data`에 `"cookies"`는 **넣지 않습니다.** 명세와 MDN에 따르면 이 지시어는 응답 출처의 **등록 도메인 전체**(`vinylims.com`과 모든 `*.vinylims.com` 하위 도메인)의 쿠키를 지우므로, 소유자의 다른 사이트 로그인까지 끊을 수 있습니다. 대신 JS로 이 호스트의 쿠키만 만료시킵니다(HttpOnly 쿠키는 JS로 지울 수 없음).

## Contents

- [What the visitor sees](#what-the-visitor-sees)
- [Data flow](#data-flow)
- [Build-time version info](#build-time-version-info)
- [How a release-please version reaches the page](#how-a-release-please-version-reaches-the-page)
- [Update detection](#update-detection)
- [Reset and reload](#reset-and-reload)
- [Response headers](#response-headers)
- [Clear-Site-Data: browser support](#clear-site-data-browser-support)
- [Why `"cookies"` is not used](#why-cookies-is-not-used)
- [What is not cleared](#what-is-not-cleared)
- [Files](#files)
- [Verify](#verify)
- [Sources](#sources)

## What the visitor sees

| Element           | Where                                   | Content                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version badge     | Header, right of the title              | `v0.1.0` and a status: **확인 중 / Checking**, **최신 / Latest**, **새 버전 vX.Y.Z / New version vX.Y.Z**, **새 빌드 / New build** (same version, newer commit), **vX.Y.Z 배포됨 / vX.Y.Z deployed** (rollback), **확인 불가 / Can't check**       |
| Version dialog    | Opens from the badge (modal `<dialog>`) | Current version + short SHA, build time, latest deployed version, last check time, link to the [release notes](https://github.com/VinylStage/trex_vs_tiger_sim/releases), **다시 확인 / Check again**, **최신 버전 불러오기 (캐시·저장소 초기화)** |
| Update banner     | Fixed, bottom right (≥ 1000 px) or top  | "새 버전이 배포되었습니다: v0.2.0" with **업데이트** (opens the dialog at the confirmation step) and **나중에** (hides it for this deployment)                                                                                                     |
| Post-reset notice | Same place as the banner, 6 s           | "최신 버전을 불러왔습니다 (v0.2.0)."                                                                                                                                                                                                               |
| Footer            | After "서버 전송 · 추적 없음"           | `버전 v0.1.0 (21c02f5)`, linked to the release notes                                                                                                                                                                                               |
| `/reset/` page    | Shown for about half a second           | "업데이트 중… / Updating…" with a spinner, then the app reloads                                                                                                                                                                                    |

Design notes:

- **No layout shift.** The badge is in the header from the first paint, and its status label has a minimum width, so "확인 중" → "최신" does not reflow anything. The banner is `position: fixed`, which never counts towards Cumulative Layout Shift. The Playwright check measured CLS ≈ 0.001 with the banner shown; that remainder is the existing web-font swap.
- **The banner never hides the Run button.** On the two-column layout it sits over the results column; on narrower screens the config panel's sticky run bar owns the bottom edge, so the banner goes to the top.
- **Accessibility.** The badge is a `<button aria-haspopup="dialog">` whose name is its visible text. The dialog is a native modal `<dialog>` (focus is contained, Esc closes, focus returns to the badge), labelled by its heading; a backdrop click also closes it. The confirmation step moves focus to its heading so screen readers read the explanation before the buttons. Banner and dialog messages are `role="status"` live regions. Animations stop under `prefers-reduced-motion`.
- **Performance.** The first check waits for the `load` event and an idle callback, so it never competes with the app's own resources. `version.json` is ~110 bytes.

## Data flow

```mermaid
---
title: Version info from release to visitor
config:
  flowchart:
    curve: basis
---
flowchart LR
    rp@{ shape: rect, label: "release-please PR<br/>bumps package.json version" } --> main@{ shape: rect, label: "merge to main" }
    main --> build@{ shape: rect, label: "Pages build<br/>npm run build" }
    build --> define@{ shape: doc, label: "bundle constants<br/>__APP_VERSION__ · __BUILD_SHA__ · __BUILD_TIME__" }
    build --> vj@{ shape: doc, label: "dist/version.json<br/>{version, sha, builtAt}" }
    define --> page@{ shape: rect, label: "open tab<br/>(running build)" }
    vj e1@--> fetch@{ shape: rect, label: "fetch /version.json<br/>cache: no-store" }
    page --> fetch
    fetch --> cmp{"same version<br/>and commit?"}
    cmp -- yes --> latest@{ shape: rect, label: "badge: 최신" }
    cmp -- no --> update@{ shape: rect, label: "badge: 새 버전 + banner" }
    e1@{ animate: true }
```

## Build-time version info

`vite.config.ts` computes one `BuildInfo` per build and uses it twice. The config file carries no comments (project rule), so it is explained here.

| Constant / file     | Value                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__APP_VERSION__`   | `version` from `package.json`, e.g. `"0.1.0"`.                                                                                                                 |
| `__BUILD_SHA__`     | `CF_PAGES_COMMIT_SHA` (set by the Cloudflare Pages build), otherwise `git rev-parse HEAD`, otherwise `"dev"`. Only 7–40 hex characters are accepted.           |
| `__BUILD_TIME__`    | ISO 8601 time at which the build started.                                                                                                                      |
| `dist/version.json` | `{"version":"0.1.0","sha":"<40 hex>","builtAt":"<ISO>"}` — the same three values, emitted by a small inline plugin (`trexsim:version-json`, `generateBundle`). |

- The constants are Vite `define` replacements; their TypeScript declarations are in `src/env.d.ts`.
- `npm run dev` serves the same JSON at `/version.json` from a dev-server middleware, so the badge reads "최신" in development as well.
- `vite.config.ts` uses `node:child_process`, `node:fs`, `node:process` and `node:url`, so `@types/node` is a dev dependency, pinned to `~24.x` to match `.node-version`. It is a type package only; the runtime bundle still has zero dependencies ([ADR-0004](adr/0004-no-runtime-dependencies.md)).
- `reset/index.html` is a second HTML entry. Vite 8 names the option `build.rolldownOptions.input` (`build.rollupOptions` is its deprecated alias). The entry keys are `index` and `reset`, so the main bundle keeps its `assets/index-<hash>.js` name. Code shared by both entries (`version-model.ts`, `site-data.ts`) lands in a small common chunk.

## How a release-please version reaches the page

1. Conventional Commits land on `main` through squash merges. Each push to `main` deploys to production with the **same** `package.json` version and a **new** commit SHA. Open tabs see "새 빌드".
2. release-please keeps a release PR open that bumps `package.json` `version`, `.release-please-manifest.json` and `CHANGELOG.md`.
3. Merging the release PR deploys a build whose `__APP_VERSION__` and `version.json` carry the new version. Open tabs see "새 버전 v0.2.0". The GitHub Release and tag (`trex-vs-tiger-sim-v0.2.0`) are created by the same workflow.
4. Nothing else needs to change: the version is never hard-coded in the source.

Preview deployments work the same way: the branch alias `https://<branch>.trex-vs-tiger-sim.pages.dev` moves with every push, so an open preview tab notices the next push.

## Update detection

The logic is in `src/ui/version-model.ts` (DOM-free, covered by `tests/version.test.ts`); `src/ui/version.ts` wires it to the DOM.

**When the page checks.**

| Trigger                                  | Rule                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Page load                                | Always, after `load` + idle callback                                       |
| Tab becomes visible (`visibilitychange`) | Only if the last attempt is ≥ 10 min old                                   |
| Timer, every 30 min                      | Only while the tab is visible, and only if ≥ 10 min since the last attempt |
| Dialog opened                            | If the last attempt is ≥ 1 min old                                         |
| **다시 확인** button                     | Always                                                                     |

Checks never overlap. `fetch('/version.json', { cache: 'no-store' })` bypasses the HTTP cache, and the response is validated (semver version ≤ 64 characters, hex SHA or `dev`) before use.

**Comparison** (`compareBuilds`):

| Deployed vs running                         | Result     | Badge          |
| ------------------------------------------- | ---------- | -------------- |
| Same version, same commit (or either `dev`) | up to date | 최신           |
| Higher version (SemVer 2.0.0 precedence)    | `newer`    | 새 버전 vX.Y.Z |
| Same version, different commit              | `rebuild`  | 새 빌드        |
| Lower version (e.g. a dashboard rollback)   | `changed`  | vX.Y.Z 배포됨  |

**Status reducer** (`reduceStatus`). The badge starts at "확인 중". A failed first check shows "확인 불가". Once a check has succeeded, later background checks keep showing the last known result while they run and when they fail (offline laptop, flaky network), so the badge never flickers.

**Banner.** It appears when the status becomes an update and stays until the visitor dismisses it. A dismissal is remembered in memory for that deployment (`version+sha`) only, so an even newer deployment shows the banner again, and a reload starts fresh.

## Reset and reload

```mermaid
sequenceDiagram
    actor Visitor
    participant Page as App page
    participant CDN as Cloudflare Pages
    participant Reset as /reset/ page
    Visitor->>Page: 최신 버전 불러오기 → 초기화하고 불러오기
    Page->>Page: delete every Cache Storage entry (caches.keys)
    Page->>Page: unregister service workers
    Page->>Page: localStorage.clear(), sessionStorage.clear()
    Page->>Page: expire this host's JS-visible cookies
    Page->>CDN: location.replace("/reset/?from=0.1.0#s=…")
    CDN-->>Reset: HTML + Clear-Site-Data: "cache", "storage"
    Note over Reset: the browser clears the origin's HTTP cache and storage<br/>before the page runs (where supported)
    Reset->>Reset: repeat the JS clean-up, show "업데이트 중…" ≥ 0.4 s
    Reset->>CDN: location.replace("/?_r=<ms>#s=…")
    CDN-->>Page: fresh index.html → new hashed assets
    Page->>Page: drop _r from the URL, show "최신 버전을 불러왔습니다"
```

- **Confirmation.** The action asks first, inside the dialog, and says that the language and tutorial preferences (both in `localStorage`) are reset. The scenario is kept because it lives in the URL fragment (`#s=…`), which both redirects carry along.
- **`location.replace`** is used for both hops, so Back does not return to the old page or to `/reset/`.
- **`?_r=<timestamp>`** gives `index.html` a URL that no cache has seen. `index.html` is already `no-cache`, and assets are content-hashed, so this is a belt-and-braces measure for intermediaries and for Chrome's partial `"cache"` support (see below). The app removes `_r` with `history.replaceState` right away, so shared links stay clean; other query parameters are kept.
- **Opening `/reset/` directly** works too: it is a support link that fixes a stuck client (`https://trex-vs-tiger.vinylims.com/reset/`). The page repeats the JavaScript clean-up for browsers without `Clear-Site-Data`.
- **Without JavaScript** the reset page shows a "Continue" link after 3 s (pure CSS).
- Every async step has a 5 s ceiling, so an unresponsive browser API cannot strand the visitor.

## Response headers

`public/_headers` (no comments allowed in the file) gains two rules:

```text
/version.json
  Cache-Control: no-store

/reset/*
  Cache-Control: no-store, no-transform
  Clear-Site-Data: "cache", "storage"
```

| Rule            | Header                                | Why                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/version.json` | `Cache-Control: no-store`             | Neither the browser nor any intermediary may keep a copy; every check sees the current deployment. The client also sends `cache: 'no-store'`.                                                                                                                   |
| `/reset/*`      | `Cache-Control: no-store`             | The reset page must always come from the network, otherwise the browser would not see the `Clear-Site-Data` header again.                                                                                                                                       |
| `/reset/*`      | `no-transform`                        | `/reset/` is HTML. On the custom domain, Bot Fight Mode would otherwise inject its inline JavaScript Detections script, which the strict CSP blocks ([DEPLOYMENT.md](DEPLOYMENT.md#bot-fight-mode-and-javascript-detections)).                                  |
| `/reset/*`      | `Clear-Site-Data: "cache", "storage"` | Server-side complement to the JavaScript clean-up: clears the origin's HTTP cache (which JavaScript cannot touch) and DOM storage — localStorage, sessionStorage, IndexedDB, service worker registrations and Cache Storage. Directives must be quoted strings. |

The splat in `/reset/*` matches the empty string, so the rule applies to `/reset/` itself (verified on the branch preview: `clear-site-data: "cache", "storage"` on `GET /reset/`, and Chrome logs `Cleared data types: "cache", "storage".`). Pages answers `/reset` and `/reset/index.html` with a `308` to `/reset/`; the second also matches the rule, so its redirect carries the header as well, which only repeats the clearing. The app always links to `/reset/`. The CSP and other headers of the `/*` rule apply as usual. `vite preview` and `npm run dev` do not apply `_headers`; check them on a Pages preview (see [Verify](#verify)).

## Clear-Site-Data: browser support

From MDN browser-compat-data (2026-10). The header needs a secure context (HTTPS), which every Pages URL is.

| Directive   | Chrome / Edge               | Firefox                        | Safari |
| ----------- | --------------------------- | ------------------------------ | ------ |
| `"storage"` | 61                          | 63                             | 17     |
| `"cache"`   | 61, **partial** (see below) | 63–93, removed; again from 138 | 17     |
| `"cookies"` | 61                          | 63                             | 17     |

Chrome caveats for `"cache"` (from the same data): some requests may still be served from cache until the tab reloads or the page opens in a new tab ([crbug 364634040](https://crbug.com/364634040)), and clearing can take seconds ([crbug 40233601](https://crbug.com/40233601)). The flow copes with both: the reset page is a fresh navigation, `index.html` is reloaded under a new `?_r=` URL, and the old page shows "초기화하는 중…" while Chrome holds the `/reset/` response until clearing completes. Browsers that ignore the header still get the JavaScript clean-up; only their HTTP cache stays, which `no-cache` HTML plus hashed assets make harmless.

## Why `"cookies"` is not used

- The spec's `"cookies"` type clears cookies "associated with the origin … as well as cookies on any origin in the same registered domain". MDN: it "affects the entire registered domain, including subdomains", e.g. `https://example.com` and `https://stage.example.com`.
- The production host is `trex-vs-tiger.vinylims.com`. Its registered domain is `vinylims.com`, so `"cookies"` would also delete the cookies of every other `*.vinylims.com` site of the owner (log-in sessions, preferences) and clear HTTP authentication credentials for them — far beyond what "reload this simulator" should do.
- This app sets no cookies of its own. So the reset only expires the cookies that **this host** exposes to JavaScript (`document.cookie`): each name is set to `Max-Age=0` with `Path=/`, once host-only and once with `Domain=<this host>`, plus `Secure` on HTTPS. It never names a parent domain.

## What is not cleared

| Data                                                         | Why                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HttpOnly` cookies (e.g. Cloudflare's `__cf_bm`)             | Invisible to JavaScript by design, and `"cookies"` is deliberately not sent. They are set by the edge, not by the app, and hold no app state.           |
| Cookies scoped to `vinylims.com` or to a path other than `/` | Out of scope on purpose (see above); the app never sets any.                                                                                            |
| HTTP cache, in browsers without `"cache"` support            | JavaScript cannot clear it. HTML is `no-cache` and assets are content-hashed, so a normal load already gets the new build.                              |
| IndexedDB, in browsers without `Clear-Site-Data`             | The app does not use IndexedDB.                                                                                                                         |
| Other tabs of the site                                       | They keep running the old build until they reload; their own badge shows the update. (`"executionContexts"` would reload them but is barely supported.) |

## Files

| File                                                | Role                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                                    | `define` constants, `version.json` plugin and dev middleware, second HTML entry                         |
| `src/env.d.ts`                                      | Type declarations for the three constants                                                               |
| `src/ui/version-model.ts`                           | Pure logic: semver, `version.json` validation, comparison, status reducer, throttle, cookie names, URLs |
| `src/ui/version.ts` / `src/ui/version.css`          | Badge, dialog, banner, footer label                                                                     |
| `src/ui/site-data.ts`                               | JavaScript clean-up shared by the dialog and `/reset/`                                                  |
| `reset/index.html`, `src/reset.ts`, `src/reset.css` | The `/reset/` page                                                                                      |
| `public/_headers`                                   | `/version.json` and `/reset/*` rules                                                                    |
| `tests/version.test.ts`                             | Unit tests for `version-model.ts`                                                                       |

## Verify

```bash
# Build output
npm run build && cat dist/version.json && ls dist/reset/index.html

# Headers on a deployment (production or a preview alias)
host=https://trex-vs-tiger.vinylims.com
curl -sSI "$host/version.json" | grep -iE '^(content-type|cache-control):'
curl -sSI "$host/reset/" | grep -iE '^(cache-control|clear-site-data|content-security-policy):'
curl -s "$host/version.json"
```

Expected: `version.json` has `cache-control: no-store` and the deployed version and SHA; `/reset/` has `cache-control: no-store, no-transform` and `clear-site-data: "cache", "storage"`, plus the site CSP.

In the browser: the badge shows "최신" a moment after load. To see the update path without a new release, block or override `/version.json` in DevTools (Network → right-click → **Override content**) with a higher version: the badge and banner change at the next check (switch tabs away for 10 min, or open the dialog and press **다시 확인**).

## Sources

- Clear-Site-Data specification (W3C WebAppSec): <https://w3c.github.io/webappsec-clear-site-data/>
- MDN, `Clear-Site-Data`: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data>
- MDN browser-compat-data, `http.headers.Clear-Site-Data`: <https://github.com/mdn/browser-compat-data/blob/main/http/headers/Clear-Site-Data.json>
- Cloudflare Pages `_headers` (splats, merging, limits): <https://developers.cloudflare.com/pages/configuration/headers/>
- Cloudflare Pages build environment variables (`CF_PAGES_COMMIT_SHA`): <https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables>
- Vite `define`: <https://vite.dev/config/shared-options#define>; multi-page builds: <https://vite.dev/guide/build#multi-page-app>
- SemVer 2.0.0 precedence: <https://semver.org/#spec-item-11>
- release-please: <https://github.com/googleapis/release-please>
