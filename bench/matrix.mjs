// The part of the standing performance checks that runs anywhere (docs/PERFORMANCE.md, "Standing
// performance checks"): expanding bench/scenarios.json into scenarios, percentiles, and timing a
// scenario's runs. No Node built-ins, so the same code runs in Node (bench/lib.mjs, `npm run
// bench`, the CI perf job) and in the browser (the `/bench/` page of #191). Hashing stays with the
// caller: node:crypto in Node, SubtleCrypto in the browser.

/**
 * Every scenario of the spec, expanded against one bundled engine: the scale ladder, every preset
 * in each listed flight mode, and every species of the registry as a mirror and against the
 * reference opponent. `reduced` keeps the groups and run counts of `spec.reduced` (the CI matrix).
 */
export function expandMatrix(spec, sim, { reduced = false } = {}) {
  const r = reduced ? spec.reduced : undefined;
  const runsOf = (n) => (r ? Math.max(1, Math.round(n * r.runScale)) : n);
  const out = [];
  const add = (s) => out.push({ ...s, runs: runsOf(s.runs) });

  for (const step of spec.scale.steps) {
    if (r && step.na + step.nb > r.maxScaleAgents) continue;
    add({
      id: `scale-${step.na}v${step.nb}`,
      group: 'scale',
      a: spec.scale.a,
      na: step.na,
      b: spec.scale.b,
      nb: step.nb,
      flight: spec.scale.flight,
      runs: step.runs,
    });
  }

  const flights = r ? r.presetFlights : spec.presets.flights;
  for (const p of sim.FREE_PRESETS) {
    const agents = p.a.n + p.b.n;
    for (const flight of flights) {
      add({
        id: `preset-${p.id}-${flight}`,
        group: 'preset',
        a: p.a.sp,
        na: p.a.n,
        b: p.b.sp,
        nb: p.b.n,
        flight,
        runs: agents > spec.presets.largeAgents ? spec.presets.largeRuns : spec.presets.runs,
      });
    }
  }

  if (!r || r.species) {
    const { count, reference, alternate, runs } = spec.species;
    for (const sp of sim.FREE_SPECIES_IDS) {
      const ref = sp === reference ? alternate : reference;
      const base = { group: 'species', a: sp, na: count, flight: 'allIn', runs };
      add({ ...base, id: `species-${sp}-mirror`, b: sp, nb: count });
      add({ ...base, id: `species-${sp}-v-${ref}`, b: ref, nb: count });
    }
  }
  return out;
}

/** Linear-interpolated quantile `q` (0–1) of an ascending array; NaN when it is empty. */
export const percentile = (sorted, q) => {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export const median = (xs) =>
  percentile(
    [...xs].sort((a, b) => a - b),
    0.5,
  );

/**
 * Config of a scenario on one engine, at the spec's seed and the engine's newest model (a config
 * without `mv` is read as model 1, the version of links that predate the field).
 */
export function configOf(sim, spec, s) {
  return sim.sanitizeFreeConfig({
    mv: sim.FREE_MODEL_VERSION,
    sides: [
      { species: s.a, count: s.na },
      { species: s.b, count: s.nb },
    ],
    runs: s.runs,
    seed: spec.seed,
    flight: s.flight,
  });
}

/**
 * Runs one scenario and times every run on its own (`performance.now()` around
 * `simulateFreeBattle`). With `minMs` the whole batch repeats until that much time has been
 * timed, so a cheap scenario is not measured from a few milliseconds; the repeats run the same
 * seeded runs. Returns the times, the agent-steps (ticks the battle lasted × agents) and the packed
 * run summaries of every repeat, which the caller hashes and compares.
 */
export function timeScenario(sim, spec, s, { minMs = 0 } = {}) {
  const c = configOf(sim, spec, s);
  const runs = Math.min(s.runs, c.runs);
  const design = sim.buildFreeDesign({ ...c, runs });
  const agents = s.na + s.nb;
  const times = [];
  const packed = [];
  let steps = 0;
  let total = 0;
  do {
    const summaries = [];
    for (let run = 0; run < runs; run++) {
      const row = sim.designRow(design, run);
      const t0 = performance.now();
      const { summary } = sim.simulateFreeBattle(c, row, run);
      const ms = performance.now() - t0;
      times.push(ms);
      total += ms;
      summaries.push(summary);
      steps += Math.round(summary.duration / sim.DT) * agents;
    }
    packed.push(sim.packFreeSummaries(summaries));
  } while (total < minMs);
  return { id: s.id, runs, mv: c.mv, times, total, steps, packed };
}

/** ms/run (median, p95, mean) and agent-steps per second of `timeScenario`'s result. */
export function timeStats({ times, total, steps }) {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    msMedian: percentile(sorted, 0.5),
    msP95: percentile(sorted, 0.95),
    msMean: total / times.length,
    agentStepsPerSec: total > 0 ? steps / (total / 1000) : NaN,
  };
}

/** The warm-up of a matrix: a few runs of its first small scenarios, so timed runs see optimised code. */
export const warmUpSet = (matrix) =>
  matrix
    .filter((m) => m.na + m.nb <= 110)
    .slice(0, 4)
    .map((s) => ({ ...s, runs: Math.min(3, s.runs) }));

/** The bytes of a packed summary array, for hashing. */
export const packedBytes = (packed) =>
  new Uint8Array(packed.buffer, packed.byteOffset, packed.byteLength);

/** One string over every scenario's hash, in matrix order; the matrix hash hashes it. */
export const matrixHashInput = (results) => results.map((r) => `${r.id}:${r.hash}`).join('\n');
