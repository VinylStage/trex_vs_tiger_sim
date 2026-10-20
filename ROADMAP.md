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

## v0.2.x — patch and feature releases after v0.2.0 (0.2.1–0.2.7 released 2026-10-20)

| Item                                                                     | Issue | Status                                                                                                            |
| ------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------- |
| UX and performance pass, mobile fixes                                    | #24   | Done (#52, v0.2.1)                                                                                                |
| Homo erectus and woolly mammoth                                          | #47   | Done (#54, v0.2.2)                                                                                                |
| Config export/import, result share links, result card, `/r/` pages       | #51   | Done (#56, v0.2.3)                                                                                                |
| Any species on either side (role-free matchups)                          | #50   | In progress: design and ADR-0007 (#74), trait presets (#75), free config (#77), free engine (#83) merged; UI next |
| Code audit 2026-10-20: security, accessibility, docs, tests, performance | #82   | In progress: step 1 done (#85, v0.2.7)                                                                            |
| Herd group defense for social herbivores                                 | #72   | Planned                                                                                                           |
| Rout (flee) rate in the results                                          | #42   | Planned                                                                                                           |

## Later (candidates, not committed)

- Sharing P2 (#51): per-bucket pre-generated OG images (species pair × outcome tier; needs a build-time PNG rasterizer, an owner decision on a dev dependency), QR codes, Kakao SDK, compressed links, challenge links

- Terrain / obstacles (currently pure open field)
- Species calibration follow-ups (buffalo vs hyenas, first-heavy-death metric M3)
- Phase-2 species (Giganotosaurus, Allosaurus, polar bear, dromaeosaurids, African wild dog), see docs/research/SPECIES.md
- Sobol-index sensitivity analysis (currently Spearman rank correlation)
- Export results as CSV/JSON
- WebAssembly engine if profiling shows JS is the bottleneck for >10k agents
- Playwright end-to-end smoke test in CI
