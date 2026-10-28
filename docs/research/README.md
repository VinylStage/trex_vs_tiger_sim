# Research records

Point-in-time research reports. The first six drove the v0.2.0 work (epic #20, 2026-10-19); the last two belong to the 1.0 renewal (epic #125). Each report cites its sources inline; claims marked _(unverified)_ or _(inference)_ were not confirmed from a primary source. CALIBRATION.md is the exception: its script (`scripts/calibration/run.mjs`) and raw output (`calibration-results.json`) are committed. Elsewhere, paths shown as `<local-workspace>/…` refer to measurement scripts and raw outputs kept outside the repository during the research; they are not committed.

| Report                           | Topic                                                                                                         | Drives     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| [UX_AUDIT.md](UX_AUDIT.md)       | WCAG 2.2 / UX audit of the simulator, probability communication, chart accessibility, onboarding, ad-slot map | #24        |
| [PERFORMANCE.md](PERFORMANCE.md) | Engine, worker, aggregation, replay and font profiling with measured baselines                                | #24        |
| [SEO_GEO.md](SEO_GEO.md)         | SEO, AI-engine/generative-engine optimisation, structured data, crawler policy, Cloudflare AI-bot settings    | #28, #30   |
| [ADSENSE.md](ADSENSE.md)         | AdSense eligibility, policy assessment, strict-CSP plan, consent, ad layout                                   | #27        |
| [SPECIES.md](SPECIES.md)         | Candidate species, literature parameter ranges, archetype mapping, engine generalisation plan                 | #25        |
| [ANIMATION.md](ANIMATION.md)     | Replay audit, event log design, abstract visual language, performance targets                                 | #26        |
| [CALIBRATION.md](CALIBRATION.md) | Free vs classic engine, free-model checks, preset sanity checks, the R1 "provisional" banner recommendation   | #166, #125 |
| [USABILITY.md](USABILITY.md)     | Usability test plan, Korean moderator script and survey, empty results template (not run yet)                 | #166, #125 |

These are records, not living specifications: the implemented behaviour is documented in `ARCHITECTURE.md`, `docs/MODEL.md` and the feature docs. Superseded findings are left as written.
