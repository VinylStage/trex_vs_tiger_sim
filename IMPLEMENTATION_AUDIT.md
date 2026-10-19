# Implementation Audit

Running log of what is implemented, how it was verified, known gaps and deviations. Updated in every PR.

## Status matrix

| Area                                                        | State       | Verification                                  | Issue/PR |
| ----------------------------------------------------------- | ----------- | --------------------------------------------- | -------- |
| Toolchain (Vite 8, TS 6.0, Vitest 5, ESLint 10, Prettier 3) | Done        | `npm run check`, `npm run build` locally + CI | #2       |
| CI / release-please / dependabot / label sync               | Done        | CI on PR                                      | #2       |
| Simulation engine                                           | Not started | —                                             | #3       |
| UI                                                          | Not started | —                                             | #4       |
| Deploy config                                               | Done        | `curl` header checks in docs/DEPLOYMENT.md    | #5       |
| Model documentation (docs/MODEL.md)                         | Done        | Checked against src/sim + 500-run local runs  | #5       |

## Deviations and decisions during implementation

| Date       | Item                          | Detail                                                                                                                                                                                                         |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | TypeScript pinned to `~6.0.3` | `typescript@7.0.2` is `latest`, but `typescript-eslint@8.71.2` peer range is `>=4.8.4 <6.1.0`. Pin until typescript-eslint supports TS 7.                                                                      |
| 2026-10-19 | Labels                        | Repository initially had only default labels; custom labels (`chore`, `simulation`, `ui`, `deploy`, `owner-action`) are created by the label-sync workflow after #2 merges. Earlier issues use default labels. |
| 2026-10-19 | HTML `no-transform`           | Bot Fight Mode on the `vinylims.com` zone injects an inline JavaScript Detections script that `script-src 'self'` blocks; `/` sends `no-cache, no-transform` to opt out (docs/DEPLOYMENT.md).                  |

## Known gaps

- Post-deploy checks in docs/DEPLOYMENT.md (headers, no `challenge-platform` injection) must be run against the live site after merge.
- release-please needs "Allow GitHub Actions to create and approve pull requests" enabled in repository settings; otherwise its job fails on `main`.
