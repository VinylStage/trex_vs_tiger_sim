/** Half-open run range `[start, end)`. */
export interface RunRange {
  start: number;
  end: number;
}

/** Chunks per worker: small enough to balance uneven run times, large enough to amortise messaging. */
export const CHUNKS_PER_WORKER = 4;

/**
 * Largest chunk: the scheduler preempts at chunk boundaries (src/ui/scheduler.ts), so a more
 * urgent job waits at most one chunk of this many runs per worker.
 */
export const MAX_CHUNK_RUNS = 25;

/**
 * Split `runs` into contiguous chunks for `workers` workers (≈ runs / (workers × 4) each, at least
 * 1, at most `MAX_CHUNK_RUNS`). The chunks cover `[0, runs)` exactly once, in order. Results do
 * not depend on the split: every run is seeded by its index.
 */
export function splitRuns(runs: number, workers: number): RunRange[] {
  const n = Math.max(0, Math.floor(runs));
  const w = Math.max(1, Math.floor(workers));
  if (n === 0) return [];
  const size = Math.min(MAX_CHUNK_RUNS, Math.max(1, Math.ceil(n / (w * CHUNKS_PER_WORKER))));
  const out: RunRange[] = [];
  for (let start = 0; start < n; start += size) {
    out.push({ start, end: Math.min(n, start + size) });
  }
  return out;
}

/**
 * Pool size: one worker fewer than logical cores (at least 1, at most 8), so the main thread,
 * the compositor and the replay keep a core. Measured in docs/PERFORMANCE.md: on 4 cores, 3
 * workers finish as fast as 4, and 4 caused 56–155 ms main-thread stalls.
 */
export function poolSize(hardwareConcurrency: number | undefined): number {
  const hc = hardwareConcurrency && hardwareConcurrency > 0 ? Math.floor(hardwareConcurrency) : 4;
  return Math.max(1, Math.min(hc - 1, 8));
}

/** Remaining time in ms from linear extrapolation, or null until there is enough signal. */
export function estimateRemainingMs(done: number, total: number, elapsedMs: number): number | null {
  if (done <= 0 || total <= 0 || elapsedMs < 300) return null;
  if (done >= total) return 0;
  return (elapsedMs / done) * (total - done);
}
