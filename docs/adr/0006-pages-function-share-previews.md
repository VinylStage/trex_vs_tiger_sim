# ADR-0006: A Pages Function for result-link previews only

- Status: Accepted
- Date: 2026-10-20
- Issue: #51
- Amends: [ADR-0003](0003-no-backend-url-sharing.md)

## Context

Shared results (#51) need a link whose preview in messengers and social apps names the result ("T-Rex 1 vs 호랑이 100 — T-Rex 61%"). Crawlers that build link previews never see a URL fragment and do not run JavaScript, so the `#s=` approach of ADR-0003 cannot carry this. The result therefore travels in the query (`/r/?r=<base64url>`), and something has to put its text into the HTML `<meta>` tags at request time. The owner approved serverless code for this and nothing else.

Cloudflare Workers Free limits (checked 2026-10-20): 100,000 requests per day shared by Workers and Pages Functions (reset at midnight UTC), 10 ms CPU per request, 64 MiB worker size. Static asset requests on Pages are free and unlimited and do not count against the Function quota when `_routes.json` excludes them.

## Decision

- One Pages Function, `functions/r/[[path]].ts` and `functions/en/r/[[path]].ts`, both re-exporting `onResultRequest` from `src/share/result-function.ts`.
- `public/_routes.json` includes only `/r`, `/r/*`, `/en/r` and `/en/r/*`. Every other path is a static asset and never invokes the Function.
- What the Function may do: fetch the static result page with `context.next()`, validate `?r=` with the same pure validator the page uses (`src/share/result-codec.ts`), and rewrite four tags with `HTMLRewriter`: `og:title`, `og:description`, `twitter:title`, `twitter:description`. `og:image` stays the static `og-result-<lang>.png`. The language comes from the path (`/en/r/` → English).
- What it must not do: storage (KV, D1, R2, cache API), logging, outgoing requests, cookies, per-user state, or any computation beyond decoding a ≤ 4 KB string. No simulation ever runs on the server (ADR-0001 stands).
- It sets the page's security headers (the `/*` block of `public/_headers` plus `Cache-Control: no-cache, no-transform` and `X-Robots-Tag: noindex`) on its responses itself, because Cloudflare does not promise to apply `_headers` to Function responses. A test keeps the two lists equal.

## Limits and fallback

- CPU: base64url decode, `JSON.parse` of ≤ 4 KB, a config sanitise and string formatting: well under 1 ms, far below 10 ms. Oversized queries (> 4160 characters) are rejected before parsing.
- Requests: one Function call per `/r/` page view or crawler fetch. The project's Pages setting **Settings → Runtime → Fail open / closed** must stay on **Fail open** (owner action, docs/DEPLOYMENT.md): when the 100k/day quota is exhausted, Pages then serves the static `/r/` page as if no Function existed. The page still works fully in the browser; only the preview text falls back to the generic static title. Fail closed would show Cloudflare error 1027 instead.
- Invalid, missing or oversized `?r=`, non-HTML or non-200 responses: the page is returned unchanged (headers only).

## Consequences

- ADR-0003 is amended: settings still travel in the fragment and are never sent to the server; result links put a snapshot (counts and config, no personal data) in the query, which reaches Cloudflare and the Function. Nothing is stored or logged by the project.
- The build stays a plain `dist/`; Pages compiles `functions/` from the repository root with the Git integration (ADR-0002), so the build command and output directory do not change. No Wrangler or `@cloudflare/workers-types` dependency: the Function's runtime types are declared locally.
- Migrating to Workers static assets later means moving `onResultRequest` into a Worker `fetch` handler with `run_worker_first` limited to the same paths.
