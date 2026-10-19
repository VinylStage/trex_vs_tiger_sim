# Roadmap

Tracking: GitHub issues. Epic for the MVP: #1.

## v0.1.0 — MVP

| Item                                                     | Issue | Status       |
| -------------------------------------------------------- | ----- | ------------ |
| Scaffold, CI, release-please, baseline docs              | #2    | In progress  |
| Monte Carlo agent-based engine + MODEL.md                | #3    | Planned      |
| Configurable UI, URL sharing, ko/en i18n, charts, replay | #4    | Planned      |
| Cloudflare Pages config + DEPLOYMENT.md                  | #5    | Done         |
| Connect Pages Git integration (owner)                    | #6    | Owner action |

## Later (candidates, not committed)

- Terrain / obstacles (currently pure open field)
- Additional species presets (lion, Amur tiger subspecies split, juvenile T-Rex)
- Sobol-index sensitivity analysis (currently Spearman rank correlation)
- Export results as CSV/JSON
- WebAssembly engine if profiling shows JS is the bottleneck for >10k agents
- Playwright end-to-end smoke test in CI
