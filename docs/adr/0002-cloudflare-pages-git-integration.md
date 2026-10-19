# ADR-0002: Deploy with Cloudflare Pages Git integration

- Status: Accepted
- Date: 2026-10-19
- Issue: #5, #6

## Context

Options: (a) Pages Git integration (Cloudflare builds on push), (b) GitHub Actions + `wrangler pages deploy` with an API token stored as a repo secret. The automation container has no Cloudflare credentials and the connected Cloudflare MCP server exposes no Pages/Workers deploy operation.

## Decision

Use the Pages Git integration (owner chose this at kickoff). Production branch: `main`. Every PR gets a preview deployment.

## Consequences

- No Cloudflare secrets in GitHub.
- One-time manual dashboard connection by the account owner (#6).
- Builds count against the Pages free quota (500 builds/month) — well above this project's expected volume.
- Cloudflare's build does not gate on GitHub CI; `main` is protected by the PR flow (CI must be green before squash-merge).

## Note on Pages vs Workers (2026)

Cloudflare's Workers best-practices page states that new projects should prefer Workers (static assets) over Pages; Pages "continues to work" and has no announced end-of-life. This project stays on Pages per the owner's requirement. The app is a plain `dist/` directory with `_headers`, so migrating later is a config-only change (`wrangler.jsonc` with `assets.directory: "./dist"`), per <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>.
