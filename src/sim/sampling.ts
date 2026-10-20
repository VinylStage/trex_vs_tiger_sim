import type { SamplingMethod, ScenarioConfig } from './config';
import { triangularInv } from './distributions';
import { PARAMS, type Triangular } from './params';
import { Rng, deriveSeed } from './rng';

const DESIGN_SALT = 1;

/**
 * Run-level parameter design: `runs × PARAMS.length` matrix (row-major) of sampled values.
 * Deterministic in (seed, runs, sampling, ranges), so every worker can rebuild it locally.
 */
export interface Design {
  runs: number;
  dims: number;
  values: Float64Array;
}

/**
 * Design over any ordered list of ranges: one column per range, generated column by column from
 * one stream seeded with `deriveSeed(seed, 0, 1)`. `buildDesign` (legacy) and the free model's
 * design (`src/sim/free/config.ts`) both use it; the loop and the order of random draws are
 * exactly those of the original `buildDesign`, so legacy design matrices are unchanged.
 */
export function buildDesignFrom(
  ranges: readonly Triangular[],
  runs: number,
  seed: number,
  sampling: SamplingMethod,
): Design {
  const n = runs;
  const dims = ranges.length;
  const values = new Float64Array(n * dims);
  const rng = new Rng(deriveSeed(seed, 0, DESIGN_SALT));
  const perm = new Int32Array(n);
  for (let j = 0; j < dims; j++) {
    const range = ranges[j] as Triangular;
    if (sampling === 'lhs') {
      for (let i = 0; i < n; i++) perm[i] = i;
      for (let i = n - 1; i > 0; i--) {
        const k = rng.int(i + 1);
        const tmp = perm[i] as number;
        perm[i] = perm[k] as number;
        perm[k] = tmp;
      }
      for (let i = 0; i < n; i++) {
        const u = ((perm[i] as number) + rng.next()) / n;
        values[i * dims + j] = triangularInv(u, range);
      }
    } else {
      for (let i = 0; i < n; i++) values[i * dims + j] = triangularInv(rng.next(), range);
    }
  }
  return { runs: n, dims, values };
}

/** Legacy design: the 22 role parameters in PARAMS order. */
export function buildDesign(config: ScenarioConfig): Design {
  return buildDesignFrom(
    PARAMS.map((p) => config.params[p.id]),
    config.runs,
    config.seed,
    config.sampling,
  );
}

export function designRow(design: Design, run: number): Float64Array {
  return design.values.subarray(run * design.dims, (run + 1) * design.dims);
}
