import { buildDesignFrom, type Design } from '../sampling';
import { freeRanges, type FreeConfig } from './config';

/*
 * The free design matrix, kept apart from the config schema (./config.ts) so the result page and
 * the Pages Function can validate free configs without importing the sampler.
 */

/** Free design matrix: `runs × FREE_PARAMS.length`, same generator as the legacy design. */
export function buildFreeDesign(c: FreeConfig): Design {
  return buildDesignFrom(freeRanges(c), c.runs, c.seed, c.sampling);
}
