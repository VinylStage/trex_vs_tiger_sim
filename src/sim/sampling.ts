import type { ScenarioConfig } from './config';
import { triangularInv } from './distributions';
import { PARAMS } from './params';
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

export function buildDesign(config: ScenarioConfig): Design {
  const n = config.runs;
  const dims = PARAMS.length;
  const values = new Float64Array(n * dims);
  const rng = new Rng(deriveSeed(config.seed, 0, DESIGN_SALT));
  const perm = new Int32Array(n);
  for (let j = 0; j < dims; j++) {
    const range = config.params[(PARAMS[j] as (typeof PARAMS)[number]).id];
    if (config.sampling === 'lhs') {
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

export function designRow(design: Design, run: number): Float64Array {
  return design.values.subarray(run * design.dims, (run + 1) * design.dims);
}
