# ADR-0001: Run the Monte Carlo simulation in the browser (Web Workers)

- Status: Accepted
- Date: 2026-10-19
- Issue: #1

## Context

A default scenario (10 T-Rex vs 100 tigers, 500 runs, up to 12,000 time steps each) is on the order of 10^8–10^9 agent updates. The project must run on Cloudflare's **free** plan.

Cloudflare Workers Free limits CPU time to **10 ms per invocation** and 100,000 requests/day. A single battle exceeds 10 ms of CPU, so server-side Monte Carlo is infeasible on the free plan regardless of how the work is split (thousands of sub-requests per user run would exhaust the daily quota after a few dozen users).

## Decision

All simulation runs execute client-side in a pool of dedicated Web Workers (`navigator.hardwareConcurrency` workers). The server only serves static assets.

## Consequences

- Hosting cost: zero; static asset requests on Pages are free and unlimited.
- Throughput scales with the visitor's CPU, not the server.
- Results must be deterministic per seed independent of worker count → per-run seeds are derived from `(masterSeed, runIndex)`; the sampling design is rebuilt deterministically in each worker.
- Slow devices get slower runs; the UI shows progress, an ETA and supports cancellation.
