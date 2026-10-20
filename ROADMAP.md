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

## v0.2.0 — content, tutorial, versioning, species, replay, ad readiness (in progress)

Epic: #20.

| Item                                                                  | Issue    | Status      |
| --------------------------------------------------------------------- | -------- | ----------- |
| Static guide, model, parameters, about, privacy pages (ko/en)         | #21      | Done (#37)  |
| Interactive guided tour                                               | #22      | Done (#38)  |
| Release version badge, update detection, cache/storage reset          | #23      | Done (#39)  |
| Research records (UX, performance, SEO/GEO, AdSense, species, replay) | #35 (PR) | Done        |
| Brand: title, OG cards, icons                                         | #29      | Done        |
| Pretendard as the single typeface                                     | #31      | Done        |
| Footer, license page, auto-generated sitemap                          | #28      | In progress |
| SEO, AIEO and GEO setup                                               | #30      | In progress |
| UI/UX and performance refactor                                        | #24      | Planned     |
| Multi-species roster                                                  | #25      | Planned     |
| Replay animation v2 (abstract glyphs, event log)                      | #26      | In progress |
| AdSense readiness plan and content framing rules                      | #27      | Done (#36)  |

## Later (candidates, not committed)

- Terrain / obstacles (currently pure open field)
- Phase-2 species (Giganotosaurus, Allosaurus, polar bear, dromaeosaurids, African wild dog), see docs/research/SPECIES.md
- Sobol-index sensitivity analysis (currently Spearman rank correlation)
- Export results as CSV/JSON
- WebAssembly engine if profiling shows JS is the bottleneck for >10k agents
- Playwright end-to-end smoke test in CI
