/**
 * Outcome counts of the default scenario (`defaultConfig()`: 10 T-Rex vs 100 tigers, 500 runs,
 * seed 20261019), the reference for "±%p vs the default matchup" on result pages and cards.
 *
 * Captured once with the engine in Node (V8) and kept as a constant, so the result page never
 * loads the simulator. tests/result-share.test.ts reruns the default scenario and fails when the
 * model changes these numbers; then update the constant (docs/SHARING.md#default-baseline).
 */
export const DEFAULT_BASELINE = { n: 500, h: 500, p: 0, d: 0 } as const;
