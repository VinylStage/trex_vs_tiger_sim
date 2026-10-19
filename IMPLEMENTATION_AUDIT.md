# Implementation Audit

Running log of what is implemented, how it was verified, known gaps and deviations. Updated in every PR.

## Status matrix

| Area                                                                          | State | Verification                                                                                                                                                                                                                                                        | Issue/PR    |
| ----------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Toolchain (Vite 8, TS 6.0, Vitest 5, ESLint 10, Prettier 3)                   | Done  | `npm run check`, `npm run build` locally + CI                                                                                                                                                                                                                       | #2          |
| CI / release-please / dependabot / label sync                                 | Done  | CI on PR                                                                                                                                                                                                                                                            | #2, #9, #13 |
| Simulation engine (PRNG, LHS, agent model, spatial grid, MC runner, stats)    | Done  | Unit tests (determinism, LHS stratification, Wilson/Spearman reference values, engine invariants, chunk independence, monotone response to tiger damage, config work budget); multi-dimension adversarial review (see below)                                        | #3          |
| UI (form, presets, worker pool, URL share, ko/en i18n, canvas charts, replay) | Done  | 31 unit tests (share codec, i18n key parity, chunking/ETA/cost); Playwright on `vite preview` and on the live Cloudflare preview (real `_headers` CSP): 0 console/CSP errors desktop+mobile+dark, run/cancel/share/language flows, presets, work-budget cap message | #4          |
| Deploy config                                                                 | Done  | Live `curl` checks on `trex-vs-tiger.vinylims.com`: each header once, CSP applied, no `challenge-platform` injection                                                                                                                                                | #5          |
| Model documentation (docs/MODEL.md)                                           | Done  | Checked against src/sim + 500-run local runs                                                                                                                                                                                                                        | #5          |

## Engine review (adversarial, 4 dimensions)

Reviewers: engine logic, statistics, determinism/performance/edge cases, input validation. Each finding was checked by an independent reproducer and an independent refuter.

| Finding                                                                           | Severity | Resolution                                                                                                               |
| --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shared link could request ~thousands of CPU-hours (LIMITS checked per field only) | medium   | `sanitizeConfig` enforces a combined work budget (`MAX_WORK` agent-steps) by lowering `runs`; UI shows the clamped value |
| O(N·M) nearest-neighbour scans per tick                                           | medium   | Expanding-ring nearest search on the tiger grid and a T-Rex grid; grid size scales with population                       |
| Wounded/thrown tigers left Recover within 1–2 ticks                               | medium   | Minimum recovery time after a wound or throw (`CONSTANTS.recoverMinTime`)                                                |
| Trace of large battles nearly frameless                                           | medium   | Adaptive decimation: record every `traceMinEvery` steps, halve frames when the float budget is exceeded                  |
| Bite cone used previous-tick positions for latched tigers                         | low      | Latched geometry derived from the host's current pose                                                                    |
| Morale-shock query could miss tigers that moved into range                        | low      | Query radius padded by maximum per-tick displacement                                                                     |
| `exchangeRatio` 0/0 returned Infinity; docstring wrong                            | low      | Returns `NaN` for 0/0; docstring says pooled ratio                                                                       |
| Duration histogram aliasing against the DT grid                                   | low      | Bin width is a multiple of DT                                                                                            |
| Fractional `maxTime` overshot                                                     | low      | `maxTime` snapped to 0.1 s                                                                                               |
| Partial triangular override merged with defaults then sorted                      | low      | Partial ranges fall back to the full default triangle                                                                    |
| Strings like `''`/`'0x10'` accepted as numbers                                    | low      | Only JSON numbers accepted                                                                                               |
| Cross-browser reproducibility depends on `Math.hypot`/`atan2`                     | low      | `Math.hypot` → `Math.sqrt`; docs narrowed to "identical within the same JS engine"                                       |

## Deviations and decisions during implementation

| Date       | Item                             | Detail                                                                                                                                                                                                         |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | TypeScript pinned to `~6.0.3`    | `typescript@7.0.2` is `latest`, but `typescript-eslint@8.71.2` peer range is `>=4.8.4 <6.1.0`. Pin until typescript-eslint supports TS 7.                                                                      |
| 2026-10-19 | Labels                           | Repository initially had only default labels; custom labels (`chore`, `simulation`, `ui`, `deploy`, `owner-action`) are created by the label-sync workflow after #2 merges. Earlier issues use default labels. |
| 2026-10-19 | `.claude/` ignored               | Local agent worktrees live under `.claude/`; excluded from git, ESLint and Prettier.                                                                                                                           |
| 2026-10-19 | HTML `no-transform`              | Bot Fight Mode on the `vinylims.com` zone injects an inline JavaScript Detections script that `script-src 'self'` blocks; `/` sends `no-cache, no-transform` to opt out (docs/DEPLOYMENT.md). Verified live.   |
| 2026-10-19 | release-please `initial-version` | First release defaulted to 1.0.0; set to 0.1.0 (#13).                                                                                                                                                          |

## Release v0.1.0 (2026-10-19)

- Tag `trex-vs-tiger-sim-v0.1.0` and GitHub Release created by release-please. The component name is included in tags (release-please manifest default); later tags follow the same format.
- Production E2E (Playwright/Chromium against `https://trex-vs-tiger.vinylims.com/`, real `_headers`): 0 console/page/request/CSP problems; run, verdict, charts, replay, share round-trip, ko/en toggle, cancel, work-budget cap, mobile layout all pass. Each security header is served exactly once, and no `challenge-platform` script is injected.

### Merges during the GitHub Actions incident

On 2026-10-19 GitHub reported "Incident with Actions and Pages", and later "Degraded availability for GitHub Actions, GitHub Pages and Webhooks". PR `check` jobs stayed queued, and one job's status stuck at in_progress after its steps had passed. To keep delivery moving:

| PR            | Evidence used instead of the queued `check` job                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #14           | Job log showed every step (typecheck, lint, format, test, build) passing; only the status was stuck                                                                                                     |
| #8, #15, #17  | Exact `ci.yml` steps (`npm ci`, typecheck, lint, format:check, test, build) run locally on Node v24.22.0 (CI runtime) at the PR head SHA; #15 also passed Playwright E2E on the live Cloudflare preview |
| #12 (release) | Same local CI-equivalent run on the post-merge `main` commit                                                                                                                                            |

Each PR carries a comment with the head SHA and the commands. The `main` CI runs queued during the incident are to be confirmed green once Actions recovers (#18).

## Known gaps

- Default parameters make T-Rex win ~100% for 10 vs 100 (tigers rout fast under morale; even without morale tiger damage is too low). This is a model outcome, not a bug; calibration rationale in docs/MODEL.md. Sensitivity is dominated by `tiger.dps`.
- Results are bit-identical only within the same JavaScript engine; `Math.atan2/sin/cos/log` are not required to be correctly rounded across engines.
