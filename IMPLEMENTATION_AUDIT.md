# Implementation Audit

Running log of what is implemented, how it was verified, known gaps and deviations. Updated in every PR.

## Status matrix

| Area                                                                       | State       | Verification                                                                                                                                                                                             | Issue/PR |
| -------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Toolchain (Vite 8, TS 6.0, Vitest 5, ESLint 10, Prettier 3)                | Done        | `npm run check`, `npm run build` locally + CI                                                                                                                                                            | #2       |
| CI / release-please / dependabot / label sync                              | Done        | CI on PR                                                                                                                                                                                                 | #2       |
| Simulation engine (PRNG, LHS, agent model, spatial grid, MC runner, stats) | Done        | 33 unit tests (determinism, LHS stratification, Wilson/Spearman reference values, engine invariants, chunk independence, monotone response to tiger damage); local benchmark ~15–70 ms/run for 10 vs 100 | #3       |
| UI                                                                         | Not started | —                                                                                                                                                                                                        | #4       |
| Deploy config                                                              | Not started | —                                                                                                                                                                                                        | #5       |

## Deviations and decisions during implementation

| Date       | Item                          | Detail                                                                                                                                                                                                         |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | TypeScript pinned to `~6.0.3` | `typescript@7.0.2` is `latest`, but `typescript-eslint@8.71.2` peer range is `>=4.8.4 <6.1.0`. Pin until typescript-eslint supports TS 7.                                                                      |
| 2026-10-19 | Labels                        | Repository initially had only default labels; custom labels (`chore`, `simulation`, `ui`, `deploy`, `owner-action`) are created by the label-sync workflow after #2 merges. Earlier issues use default labels. |
| 2026-10-19 | `.claude/` ignored            | Local agent worktrees live under `.claude/`; excluded from git, ESLint and Prettier.                                                                                                                           |

## Known gaps

- Default parameters make T-Rex win ~100% for 10 vs 100 (tigers rout fast under morale; even without morale tiger damage is too low). This is a model outcome, not a bug; calibration rationale in docs/MODEL.md. Sensitivity is dominated by `tiger.dps`.

- release-please needs "Allow GitHub Actions to create and approve pull requests" enabled in repository settings; otherwise its job fails on `main`.
