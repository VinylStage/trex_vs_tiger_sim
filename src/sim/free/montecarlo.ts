import { designRow, type Design } from '../sampling';
import { buildFreeDesign, type FreeConfig } from './config';
import { emptyBuffStats, simulateFreeBattle, type BuffStats, type FreeRunSummary } from './engine';

/**
 * Monte Carlo batch for the free model. Same structure as the legacy `runChunk`/`runAll`
 * (src/sim/montecarlo.ts).
 */

/** Numeric fields of a FreeRunSummary in the order `packFreeSummaries` stores them. */
export const FREE_SUMMARY_FIELDS = [
  'run',
  'outcome',
  'duration',
  'aAlive',
  'aKilled',
  'aRouted',
  'aActive',
  'bAlive',
  'bKilled',
  'bRouted',
  'bActive',
  'aHpFrac',
  'bHpFrac',
  'advantage',
] as const satisfies readonly (keyof FreeRunSummary)[];

/** Pack-buff stats of each side, stored after the scalar fields (side A, then side B). */
export const FREE_BUFF_FIELDS = Object.keys(emptyBuffStats()) as (keyof BuffStats)[];

export const FREE_SUMMARY_STRIDE = FREE_SUMMARY_FIELDS.length + 2 * FREE_BUFF_FIELDS.length;

/**
 * Free summaries as one Float64Array, so they cross to a worker as a single transferable buffer
 * (as `packSummaries` does for the legacy engine). Every field is a double or a small integer,
 * so `unpackFreeSummaries` returns exactly the same values.
 */
export function packFreeSummaries(summaries: readonly FreeRunSummary[]): Float64Array<ArrayBuffer> {
  const out = new Float64Array(summaries.length * FREE_SUMMARY_STRIDE);
  const base = FREE_SUMMARY_FIELDS.length;
  const nb = FREE_BUFF_FIELDS.length;
  summaries.forEach((s, i) => {
    const o = i * FREE_SUMMARY_STRIDE;
    FREE_SUMMARY_FIELDS.forEach((f, k) => {
      out[o + k] = s[f];
    });
    FREE_BUFF_FIELDS.forEach((f, k) => {
      out[o + base + k] = s.buffA[f];
      out[o + base + nb + k] = s.buffB[f];
    });
  });
  return out;
}

export function unpackFreeSummaries(packed: Float64Array): FreeRunSummary[] {
  const n = Math.floor(packed.length / FREE_SUMMARY_STRIDE);
  const out: FreeRunSummary[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * FREE_SUMMARY_STRIDE;
    const base = FREE_SUMMARY_FIELDS.length;
    const nb = FREE_BUFF_FIELDS.length;
    const s: Record<string, unknown> = {};
    FREE_SUMMARY_FIELDS.forEach((f, k) => {
      s[f] = packed[o + k] as number;
    });
    const buffA = emptyBuffStats();
    const buffB = emptyBuffStats();
    FREE_BUFF_FIELDS.forEach((f, k) => {
      buffA[f] = packed[o + base + k] as number;
      buffB[f] = packed[o + base + nb + k] as number;
    });
    s['buffA'] = buffA;
    s['buffB'] = buffB;
    out.push(s as unknown as FreeRunSummary);
  }
  return out;
}

export function runFreeChunk(
  config: FreeConfig,
  design: Design,
  start: number,
  end: number,
  onProgress?: (done: number) => void,
): FreeRunSummary[] {
  const out: FreeRunSummary[] = [];
  for (let run = start; run < end; run++) {
    out.push(simulateFreeBattle(config, designRow(design, run), run).summary);
    onProgress?.(run - start + 1);
  }
  return out;
}

export function runAllFree(config: FreeConfig): { design: Design; summaries: FreeRunSummary[] } {
  const design = buildFreeDesign(config);
  return { design, summaries: runFreeChunk(config, design, 0, config.runs) };
}
