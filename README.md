# T-Rex vs Tiger Simulator

[![CI](https://github.com/VinylStage/trex_vs_tiger_sim/actions/workflows/ci.yml/badge.svg)](https://github.com/VinylStage/trex_vs_tiger_sim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

티라노사우루스 N마리 vs 호랑이 M마리가 2D 오픈필드에서 싸우면 누가 이길까? 문헌 기반 파라미터 범위에서 불확실성을 샘플링하는 **몬테카를로 에이전트 기반 시뮬레이션**으로 승률을 추정합니다. 기본 시나리오는 T-Rex 10 vs 호랑이 100.

A Monte Carlo, agent-based battle simulator: N _Tyrannosaurus rex_ vs M tigers on a 2D open field, with literature-based parameter uncertainty sampling. Runs entirely in your browser.

**Live:** <https://trex-vs-tiger.vinylims.com/> · **Releases:** [GitHub Releases](https://github.com/VinylStage/trex_vs_tiger_sim/releases) · [CHANGELOG](CHANGELOG.md)

## Features

- Set the T-Rex and tiger counts, the number of Monte Carlo runs, the seed, the arena size, the time limit and the tiger tactic and morale options yourself
- Edit every model parameter's `(min, mode, max)` range
- Latin Hypercube or plain random sampling, plus per-individual variation
- Results:
  - win / draw probabilities with Wilson 95% confidence intervals
  - histograms of battle duration and survivors
  - Spearman sensitivity (tornado chart) of each parameter
- Animated replay of a single battle
- Share any scenario as a URL; the seed is included, so results reproduce exactly in the same browser engine (and statistically across engines)
- Korean / English UI, plus static guide, model, parameter, about and privacy pages in both languages
- Interactive guided tour (header **튜토리얼 / Tutorial** button or `?tour=1`)
- Release version badge that detects newer deployments and can reload the latest version after clearing this site's cache and storage
- No backend: every simulation runs in your browser

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + format + unit tests
npm run build      # → dist/
```

Node: see `.node-version` (24).

## Documentation

| Doc                                                | Content                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)                 | System, modules, run sequence, state machines, pipeline (Mermaid)         |
| [docs/MODEL.md](docs/MODEL.md)                     | Simulation model, parameters, sources, assumptions                        |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)           | Cloudflare Pages setup and free-plan budget                               |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md)     | Every config file explained                                               |
| [docs/adr/](docs/adr/README.md)                    | Architecture Decision Records                                             |
| [docs/PAGES.md](docs/PAGES.md)                     | Static content pages, URL scheme, drift guard                             |
| [docs/TUTORIAL.md](docs/TUTORIAL.md)               | Guided tour steps, accessibility, deep link                               |
| [docs/VERSIONING.md](docs/VERSIONING.md)           | Version badge, update detection, cache/storage reset                      |
| [docs/BRANDING.md](docs/BRANDING.md)               | Title, OG cards, icon set and how to re-render them                       |
| [docs/ADSENSE.md](docs/ADSENSE.md)                 | AdSense readiness gates, owner actions, checklist                         |
| [docs/research/](docs/research/README.md)          | Research records (UX, performance, SEO/GEO, AdSense, species, animation)  |
| [ROADMAP.md](ROADMAP.md)                           | Planned work                                                              |
| [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) | Implementation status, verification, deviations                           |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | GitHub Flow, conventional commits, release process, content framing rules |
| [SECURITY.md](SECURITY.md)                         | Vulnerability reporting                                                   |

## Disclaimer

This is an educational toy model. _T. rex_ and tigers never coexisted, and every interaction rule is an assumption. The output shows how the outcome depends on uncertain inputs. It is not a prediction of a real fight. See [docs/MODEL.md](docs/MODEL.md).

## License

[MIT](LICENSE)
