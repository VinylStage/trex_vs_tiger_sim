# Architecture

> Diagrams use Mermaid syntax supported by GitHub's renderer (Mermaid 11.16.x as of 2026-10): YAML frontmatter `config`, expanded node shapes (`id@{ shape: … }`), edge IDs/animation, `architecture-beta`, typed sequence participants. Mermaid 11.17+/12.x-only features are intentionally avoided.

## 1. System context

Everything runs in the visitor's browser. Cloudflare Pages only serves static files built from `main`.

```mermaid
---
title: System context
---
architecture-beta
    group gh(cloud)[GitHub]
    service repo(disk)[Repository] in gh
    service ci(server)[Actions CI] in gh

    group cf(cloud)[Cloudflare Pages Free]
    service build(server)[Pages build] in cf
    service cdn(internet)[Static CDN] in cf

    group client(internet)[Visitor browser]
    service ui(server)[UI main thread] in client
    service workers(server)[Web Worker pool] in client

    repo:R --> L:ci
    repo:B --> T:build
    build:R --> L:cdn
    cdn:R --> L:ui
    ui:B --> T:workers
```

| Concern         | Where                              | Why                                                                                                         |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Compute         | Browser Web Workers                | Workers Free = 10 ms CPU/request; infeasible server-side ([ADR-0001](docs/adr/0001-client-side-compute.md)) |
| Hosting         | Cloudflare Pages (Git integration) | Free, unlimited static requests ([ADR-0002](docs/adr/0002-cloudflare-pages-git-integration.md))             |
| State / sharing | URL fragment `#s=`                 | No backend ([ADR-0003](docs/adr/0003-no-backend-url-sharing.md))                                            |
| Runtime deps    | None                               | [ADR-0004](docs/adr/0004-no-runtime-dependencies.md)                                                        |

## 2. Module structure

```mermaid
---
title: Source modules (src/)
config:
  flowchart:
    curve: basis
---
flowchart LR
    subgraph UI["src/ui (main thread)"]
        app@{ shape: rect, label: "app.ts<br/>wiring" }
        form@{ shape: rect, label: "form.ts<br/>config editor" }
        share@{ shape: rect, label: "share.ts<br/>URL codec" }
        i18n@{ shape: rect, label: "i18n.ts<br/>ko / en" }
        charts@{ shape: rect, label: "charts.ts<br/>canvas charts" }
        replay@{ shape: rect, label: "replay.ts<br/>battle replay" }
        pool@{ shape: rect, label: "pool.ts<br/>worker pool" }
        helpers@{ shape: rect, label: "chunks.ts · cost.ts<br/>dom.ts · format.ts" }
    end
    subgraph W["src/workers"]
        worker@{ shape: hex, label: "sim.worker.ts" }
        protocol@{ shape: doc, label: "protocol.ts<br/>message types" }
    end
    subgraph SIM["src/sim (pure, DOM-free)"]
        config@{ shape: doc, label: "config.ts<br/>schema + clamp" }
        params@{ shape: doc, label: "params.ts<br/>parameter table" }
        rng@{ shape: rect, label: "rng.ts<br/>sfc32 + splitmix" }
        sampling@{ shape: rect, label: "sampling.ts<br/>LHS / MC design" }
        engine@{ shape: rect, label: "engine.ts<br/>agent battle" }
        spatial@{ shape: rect, label: "spatial.ts<br/>uniform grid" }
        mc@{ shape: rect, label: "montecarlo.ts<br/>batch + aggregate" }
        stats@{ shape: rect, label: "stats.ts<br/>Wilson, Spearman" }
    end
    app --> form & charts & replay & pool & share & i18n
    share --> config
    form --> config & params
    pool e1@--> worker
    app --> helpers
    pool & worker --> protocol
    worker --> mc
    app --> mc
    mc --> sampling & engine & stats
    sampling --> rng & params
    engine --> spatial & rng
    e1@{ animate: true }
```

Rule: `src/sim` has no DOM access, so it can be unit-tested in Node and run inside workers.

## 3. Run sequence

```mermaid
sequenceDiagram
    actor User
    participant UI@{ "type": "boundary" }
    participant Pool@{ "type": "control" }
    participant Worker@{ "type": "entity" }
    User->>UI: Configure counts / ranges, click Run
    UI->>UI: validate + clamp config, write URL #s=
    UI->>Pool: start(config)
    Pool->>Worker: {config, runStart, runEnd} per chunk
    loop each run in chunk
        Worker->>Worker: design row = LHS(seed)[run]
        Worker->>Worker: simulate battle(seed ⊕ run)
    end
    Worker-->>Pool: progress + RunSummary[]
    Pool-->>UI: progress (%, ETA)
    Pool-->>UI: all RunSummary[]
    UI->>UI: aggregate (win prob + Wilson CI, histograms, Spearman)
    UI->>Worker: replay(run k, trace=true)
    Worker-->>UI: frames
    UI-->>User: charts + animated replay
```

### Determinism

- Master seed `S` (uint32, in the URL).
- Sampling design (LHS permutation matrix) is generated from `S` and rebuilt identically in every worker; run `i` uses row `i`.
- Battle `i` uses PRNG seeded with `splitmix32(S ⊕ hash(i))`.
- Therefore results are identical for a given URL regardless of the number of workers or chunk boundaries.

## 4. Simulation model (summary)

Full model, parameter ranges and literature: [docs/MODEL.md](docs/MODEL.md).

Two-level uncertainty:

1. **Epistemic (per run):** each species parameter is drawn from a triangular distribution `(min, mode, max)` using Latin Hypercube Sampling across runs.
2. **Aleatory (per individual):** each animal multiplies the run-level value by `N(1, CV)` truncated to `[0.5, 1.5]`.

Fixed time step `dt = 0.1 s`; open square arena; battle ends when one side is eliminated (dead or routed) or at `maxTime` (draw).

### Tiger behaviour state machine

```mermaid
---
title: Tiger states
---
stateDiagram-v2
    [*] --> Approach
    Approach --> Latched: contact + latch roll succeeds
    Approach --> Approach: latch roll fails (retry after cooldown)
    Latched --> Recover: stamina depleted / shaken off
    Approach --> Recover: wounded (bite survived)
    Recover --> Approach: stamina recovered
    Approach --> Routed: morale < threshold
    Latched --> Routed: morale < threshold
    Recover --> Routed: morale < threshold
    Routed --> [*]: leaves arena
    Approach --> Dead: hp <= 0
    Latched --> Dead: hp <= 0
    Recover --> Dead: hp <= 0
    Dead --> [*]
```

### T-Rex behaviour

```mermaid
flowchart TD
    tick@{ shape: circle, label: "tick" } --> latched{"tigers latched?"}
    latched -- yes --> shake@{ shape: rect, label: "shake-off roll per latched tiger<br/>(evaluated in the tiger update)" }
    latched -- no --> target
    shake --> target@{ shape: rect, label: "steer toward nearest free tiger<br/>(turn-rate limited)" }
    target --> ready{"bite cooldown ready<br/>and tiger in frontal cone?"}
    ready -- yes --> bite@{ shape: rect, label: "bite roll → damage = force × lethality" }
    ready -- no --> move@{ shape: rect, label: "advance (speed reduced by carried tiger mass)" }
    bite --> move
    move --> done@{ shape: dbl-circ, label: "end tick" }
```

## 5. Delivery pipeline

```mermaid
flowchart LR
    issue@{ shape: doc, label: "Issue" } --> branch@{ shape: rect, label: "branch<br/>type/N-slug" }
    branch --> pr@{ shape: rect, label: "PR (template)" }
    pr --> ci{"CI<br/>typecheck · lint · format · test · build"}
    pr --> preview@{ shape: rect, label: "Pages preview deploy" }
    ci -- green --> merge@{ shape: rect, label: "squash merge → main" }
    merge p1@--> prod@{ shape: rect, label: "Pages production deploy" }
    merge --> rp@{ shape: rect, label: "release-please PR" }
    rp --> tag@{ shape: flag, label: "tag + GitHub Release + CHANGELOG" }
    p1@{ animate: true }
```

## 6. Security

- Static site; no secrets, cookies, storage of user data or third-party requests.
- CSP in `public/_headers`: `default-src 'self'`, no inline scripts, `worker-src 'self'`, `frame-ancestors 'none'`.
- URL fragment input is untrusted → `JSON.parse` only, schema check, numeric clamping, unknown keys dropped (`src/sim/config.ts`).
- Resource limits (max agents, runs, time) are clamped to prevent a shared link from freezing a browser.
