# ADR-0007: Symmetric sides in a separate engine; freeze the heavy/pack engine

- Status: Accepted (owner, 2026-10-20, [#50 comment](https://github.com/VinylStage/trex_vs_tiger_sim/issues/50#issuecomment-6284898507))
- Date: 2026-10-20
- Issue: #50
- Design: [docs/design/FREE-MATCHUPS.md](../design/FREE-MATCHUPS.md)

## Context

The owner wants any species on either side, including same-species matchups, with pack traits only for social species in groups and an explicit, documented pack-buff rule set. The current engine (`src/sim/engine.ts`) hard-wires two asymmetric roles: only heavies strike, turn, shake riders off and bleed; only pack animals latch, use tactics, tire, have morale and flee. Every v1 and v2 share link must keep reproducing bit-identically (`tests/v1-golden.test.ts`, `tests/v2-golden.test.ts`, the #47 golden), which already forbids changing the legacy engine's RNG call order or floating-point expression order.

## Decision

1. Keep `engine.ts` as the **classic (legacy) engine**, frozen. v1 and v2 links, and every config with `mode: 'legacy'`, run on it unchanged.
2. Add a **symmetric engine** (`src/sim/engine-free.ts`) for `mode: 'free'` configs: two sides A and B, each `{ species, count, params }`, one unified trait set per species, simultaneous resolution within a tick and one RNG stream per side.
3. Latching depends on the species (`canLatch`) and on the body-mass ratio (target ≥ `R_latch` × attacker, default 3); otherwise agents fight with frontal strikes.
4. A **pack-buff layer** applies only to species with `social = true` and only while an agent has at least one present ally within its species' cohesion radius. Its five effects (coordinated approach, shared target, group latching, morale support and contagion, relief) are bounded, sampled, individually switchable, and with all of them off a social side is bit-identical to the same species with `social = false`.
5. Share payload **v3** encodes free configs; v1 and v2 decode to legacy configs and are re-encoded as v2.
6. A page opened without a link keeps the legacy default until free-model calibration (design §8 P8) is done, then switches to the free model. One species per side; herd group defence is out of scope (#72).

## Alternatives considered

- **One generalized engine that reproduces legacy bit for bit.** It would have to keep the legacy RNG order, expression order, sequential heavy-then-pack updates, spawn geometry and trace layout behind a `legacy` flag on every branch, could not adopt simultaneous resolution, and would put those branches in the hot loop of every run. Rejected.
- **Extend the legacy engine with symmetric options as identity constants** (the pattern used for `hide`, `intimidation`, `radius`). Workable for single mechanics, but symmetry changes the tick structure itself, which identity constants cannot express. Rejected.

## Consequences

- Two engines and two trace versions (2 classic, 3 free) to render; the classic one is frozen, so maintenance effort goes into one.
- MODEL.md documents a "Classic model" and a "Free model"; the UI labels classic links as such.
- The free engine gets its own golden fixture when it ships, with the same never-regenerate rule.
- Pack-buff and size-ratio constants are new assumptions (tagged **S** with sensitivity ranges); they appear in the tornado chart and must pass the calibration guard in the design document (§5.3).
