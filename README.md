# T-Rex vs Tiger Simulator

[![CI](https://github.com/VinylStage/trex_vs_tiger_sim/actions/workflows/ci.yml/badge.svg)](https://github.com/VinylStage/trex_vs_tiger_sim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

티라노사우루스 N마리 vs 호랑이 M마리가 2D 오픈필드에서 싸우면 누가 이길까? 문헌 기반 파라미터 범위에서 불확실성을 샘플링하는 **몬테카를로 에이전트 기반 시뮬레이션**으로 승률을 추정합니다. 기본 시나리오는 T-Rex 10 vs 호랑이 100.

A Monte Carlo, agent-based battle simulator: N _Tyrannosaurus rex_ vs M tigers on a 2D open field, with literature-based parameter uncertainty sampling. Runs entirely in your browser.

**Live:** <https://trex-vs-tiger.vinylims.com/> · **Releases:** [GitHub Releases](https://github.com/VinylStage/trex_vs_tiger_sim/releases) · [CHANGELOG](CHANGELOG.md)

## Features

- Species choice on each side (heavy: T. rex, elephant, buffalo, brown bear, woolly mammoth, Homo erectus; pack: tiger, lion, wolf, hyena, Homo erectus) or a matchup preset, plus your own counts, number of Monte Carlo runs, seed, arena size, time limit, pack tactic and morale options
- An editable `(min, mode, max)` range for every model parameter
- Latin Hypercube or plain random sampling, plus per-individual variation
- Results:
  - win / draw probabilities with Wilson 95% confidence intervals
  - histograms of battle duration and survivors
  - Spearman sensitivity (tornado chart) of each parameter
- Animated replay of a single battle with abstract glyphs, an event timeline, skip-to-contact, speeds 0.25×–16× and a reduced-motion overview
- Scenario sharing as a URL; the seed is included, so results reproduce exactly in the same browser engine (and statistically across engines)
- Settings export and import as a `TVT2-…` code or a `.json` file (previewed before applying)
- Result sharing: a `/r/` result page with a snapshot and "run it yourself" check, a story or square result card image, and a Wordle-style emoji text; link previews show the result through a tiny `/r/`-only Pages Function
- Korean (`/`) and English (`/en/`) UI, plus static guide, model, parameter, about, patch notes, privacy and license pages in both languages; generated sitemap, robots.txt, llms.txt and structured data
- Interactive guided tour (header **튜토리얼 / Tutorial** button or `?tour=1`)
- Release version badge that detects newer deployments and can reload the latest version after clearing this site's cache and storage
- No backend: every simulation runs in your browser (the only server code rewrites link-preview text on `/r/`, [ADR-0006](docs/adr/0006-pages-function-share-previews.md))

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
| [docs/SPECIES.md](docs/SPECIES.md)                 | Species roster, presets, bounds, sources, calibration                     |
| [docs/PRESETS.md](docs/PRESETS.md)                 | Simple-mode matchup presets, measured fixture, rout check, banned words   |
| [docs/REPLAY.md](docs/REPLAY.md)                   | Replay renderer v2: glyphs, camera, timeline, accessibility               |
| [docs/SEO.md](docs/SEO.md)                         | URL languages, head tags, sitemap/robots/llms, IndexNow, owner actions    |
| [docs/PAGES.md](docs/PAGES.md)                     | Static content pages, URL scheme, drift guard                             |
| [docs/TUTORIAL.md](docs/TUTORIAL.md)               | Guided tour steps, accessibility, deep link                               |
| [docs/SHARING.md](docs/SHARING.md)                 | Settings codes, result links and page, result card, text share, previews  |
| [docs/STREAMING.md](docs/STREAMING.md)             | Streaming setup (Korean): OBS, legibility, viewer formats, checklist      |
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
