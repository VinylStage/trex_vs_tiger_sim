// Entry that bench/lib.mjs bundles into one Node module per source tree (docs/PERFORMANCE.md,
// "Standing performance checks"). `@sim/` is an alias for `<root>/src/sim/`, so the same entry
// bundles the head tree and, in the CI perf job, the base tree of a pull request. Keep it to
// exports that have been stable across releases: a base tree that lacks one cannot be compared.

export { DT } from '@sim/engine';
export { designRow } from '@sim/sampling';
export { FREE_MODEL_VERSION, sanitizeFreeConfig } from '@sim/free/config';
export { buildFreeDesign } from '@sim/free/design';
export { simulateFreeBattle } from '@sim/free/engine';
export { packFreeSummaries } from '@sim/free/montecarlo';
export { FREE_PRESETS } from '@sim/free/presets';
export { FREE_SPECIES_IDS } from '@sim/free/species';
