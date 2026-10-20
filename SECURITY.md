# Security Policy

## Supported versions

Only the latest release deployed from `main` is supported.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Security" tab → "Report a vulnerability"). Do not open a public issue.

## Scope notes

- The site is static apart from one Pages Function on `/r/*` and `/en/r/*` that rewrites link-preview meta tags from a validated query and stores nothing (docs/adr/0006-pages-function-share-previews.md). There is no authentication and no user data storage.
- Scenario state is encoded in the URL fragment and is parsed with schema validation and value clamping; it is never evaluated as code.
- A strict Content-Security-Policy with Trusted Types enforcement, and HSTS, are applied via `public/_headers` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#_headers-explained)).
- GitHub Actions are pinned to full commit SHAs and kept current by Dependabot.
