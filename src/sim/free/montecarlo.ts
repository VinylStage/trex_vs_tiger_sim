import { designRow, type Design } from '../sampling';
import { buildFreeDesign, type FreeConfig } from './config';
import { simulateFreeBattle, type FreeRunSummary } from './engine';

/**
 * Monte Carlo batch for the free model. Same structure as the legacy `runChunk`/`runAll`
 * (src/sim/montecarlo.ts); the worker, per-side aggregate and share wiring follow in P5.
 */

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
