# Roadmap

Tracking: GitHub issues. Epic for the MVP: #1.

## v0.1.0 — MVP (released 2026-10-19)

| Item                                                     | Issue | Status |
| -------------------------------------------------------- | ----- | ------ |
| Scaffold, CI, release-please, baseline docs              | #2    | Done   |
| Monte Carlo agent-based engine + MODEL.md                | #3    | Done   |
| Configurable UI, URL sharing, ko/en i18n, charts, replay | #4    | Done   |
| Cloudflare Pages config + DEPLOYMENT.md                  | #5    | Done   |
| Connect Pages Git integration + custom domain (owner)    | #6    | Done   |

## v0.2.0 — content, tutorial, versioning, species, replay, ad readiness (released 2026-10-20)

Epic: #20.

| Item                                                                  | Issue    | Status     |
| --------------------------------------------------------------------- | -------- | ---------- |
| Static guide, model, parameters, about, privacy pages (ko/en)         | #21      | Done (#37) |
| Interactive guided tour                                               | #22      | Done (#38) |
| Release version badge, update detection, cache/storage reset          | #23      | Done (#39) |
| Research records (UX, performance, SEO/GEO, AdSense, species, replay) | #35 (PR) | Done       |
| Brand: title, OG cards, icons                                         | #29      | Done       |
| Pretendard as the single typeface                                     | #31      | Done       |
| Footer, license page, auto-generated sitemap                          | #28      | Done (#43) |
| SEO, AIEO and GEO setup                                               | #30      | Done (#43) |
| UI/UX and performance refactor                                        | #24      | Done (#52) |
| Multi-species roster                                                  | #25      | Done (#45) |
| Replay animation v2 (abstract glyphs, event log)                      | #26      | Done (#44) |
| AdSense readiness plan and content framing rules                      | #27      | Done (#36) |
| Header logo restored to the original icon                             | —        | Done (#41) |

## v0.2.x — patch and feature releases after v0.2.0 (0.2.1–0.2.12 released 2026-10-20, 0.2.13–0.2.14 released 2026-10-23, 0.2.15–0.2.16 released 2026-10-26)

| Item                                                                     | Issue | Status                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX and performance pass, mobile fixes                                    | #24   | Done (#52, v0.2.1)                                                                                                                                                                           |
| Homo erectus and woolly mammoth                                          | #47   | Done (#54, v0.2.2)                                                                                                                                                                           |
| Config export/import, result share links, result card, `/r/` pages       | #51   | Done (#56, v0.2.3)                                                                                                                                                                           |
| Any species on either side (role-free matchups)                          | #50   | Done: design and ADR-0007 (#74), trait presets (#75), free config (#77), free engine (#83), UI (#90, v0.2.9), pack buff (#100, v0.2.12), share links (#104, v0.2.13), replay (#110, v0.2.15) |
| Code audit 2026-10-20: security, accessibility, docs, tests, performance | #82   | In progress (epic open for the #57 owner action): steps 1–6 merged (#85, #88, #91, #92, #95, #99, #102, #106, #109, #112, #114)                                                              |
| Herd group defense for social herbivores                                 | #72   | Planned                                                                                                                                                                                      |
| Rout (flee) rate in the results                                          | #42   | Planned                                                                                                                                                                                      |
| Patch notes board (`/patch-notes/`), one playful entry per release       | —     | Done (#98, v0.2.11)                                                                                                                                                                          |

## v1.0.0 — streamer-first renewal (accepted 2026-10-26)

Design for owner review: [docs/design/RENEWAL-1.0.md](docs/design/RENEWAL-1.0.md). It covers the play/learn split, Simple and Advanced modes, the streamer session loop with live variable cards, the new-animal batches, ads readiness and the milestones M1–M8. Live chat is tracked separately in #118 and does not gate 1.0. The owner answered the blocking decisions on 2026-10-26 (§12 decision record); milestone issues track the work.

### M2 — play/learn split, Simple mode, usability (epic #125)

| Item                                                    | Issue     | Status                                                                                                       |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Lobby `/` and the app at `/play/`, old links forwarded  | #142      | Done (#143, v0.2.18)                                                                                         |
| Simple mode with an Advanced switch                     | #146      | Done (#151, v0.2.19)                                                                                         |
| Simple links reopen in Simple                           | #154      | Done (#155, v0.2.20)                                                                                         |
| Simple tour and the Advanced settings manual            | #158      | Done (#159, v0.2.21)                                                                                         |
| `/learn/` hub, Play/Learn nav groups, `/species/` guide | #162      | Done (#163, v0.2.22)                                                                                         |
| P8 calibration report and model-page section            | #166      | Done in review: [docs/research/CALIBRATION.md](docs/research/CALIBRATION.md); awaits the owner's sign-off    |
| P8 free model on the parameters page                    | #170      | Open                                                                                                         |
| R1 "provisional model" banner decision                  | #166      | Recommendation: keep until the sign-off, #170 and #169 are done (CALIBRATION.md §10); owner decides          |
| Usability test (5–8 people, 18–35) and anonymous survey | #166      | Kit ready in [docs/research/USABILITY.md](docs/research/USABILITY.md); the owner runs it, results not in yet |
| Free-model calibration follow-ups                       | #167–#169 | Open (#169 needs an owner decision)                                                                          |

## Later (candidates, not committed)

- Sharing P2 (#51): per-bucket pre-generated OG images (species pair × outcome tier; needs a build-time PNG rasterizer, an owner decision on a dev dependency), QR codes, Kakao SDK, compressed links, challenge links

- Terrain / obstacles (currently pure open field)
- Species calibration follow-ups (buffalo vs hyenas, first-heavy-death metric M3)
- Phase-2 species (Giganotosaurus, Allosaurus, polar bear, dromaeosaurids, African wild dog), see docs/research/SPECIES.md
- Sobol-index sensitivity analysis (currently Spearman rank correlation)
- Export results as CSV/JSON
- WebAssembly engine if profiling shows JS is the bottleneck for >10k agents
- Playwright end-to-end smoke test in CI
