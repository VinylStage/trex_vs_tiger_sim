// Types for lib.mjs, so tests/bench.test.ts type-checks without allowJs.

export interface Scenario {
  id: string;
  group: 'scale' | 'preset' | 'species';
  a: string;
  na: number;
  b: string;
  nb: number;
  flight: 'allIn' | 'realistic';
  runs: number;
}

export interface MatrixSim {
  FREE_PRESETS: readonly {
    id: string;
    a: { sp: string; n: number };
    b: { sp: string; n: number };
  }[];
  FREE_SPECIES_IDS: readonly string[];
}

export interface PageSize {
  gzipBytes: number;
  files: string[];
}

export interface PageCheck {
  page: string;
  gzipBytes: number;
  budget: number | null;
  status: 'ok' | 'over' | 'unlisted';
}

export const BENCH_DIR: string;
export const ROOT: string;
export function readJson(file: string): unknown;
export function expandMatrix(
  spec: unknown,
  sim: MatrixSim,
  options?: { reduced?: boolean },
): Scenario[];
export function median(xs: readonly number[]): number;
export function pageSizes(dist: string): Record<string, PageSize>;
export function checkPages(
  sizes: Record<string, PageSize>,
  budgets: { pages: Record<string, { gzipBytes: number } | undefined> },
): PageCheck[];

export function measure(
  sim: import('./matrix.d.mts').TimingSim,
  spec: unknown,
  s: Scenario,
  options?: { minMs?: number },
): import('./matrix.d.mts').TimeStats & { id: string; runs: number; mv: number; hash: string };
