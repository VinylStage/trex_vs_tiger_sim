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

## Later (candidates, not committed)

- Terrain / obstacles (currently pure open field)
- Additional species presets (lion, Amur tiger subspecies split, juvenile T-Rex)
- Sobol-index sensitivity analysis (currently Spearman rank correlation)
- Export results as CSV/JSON
- WebAssembly engine if profiling shows JS is the bottleneck for >10k agents
- Playwright end-to-end smoke test in CI
