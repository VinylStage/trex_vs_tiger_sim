/**
 * Newest model version (`mv`, ADR-0008) of the free engine in this build. A change that alters
 * any free result raises it, and every version from 1 up to it stays runnable, so a link
 * reproduces under the version it names. Wherever `mv` is absent it means 1.
 *
 * - 1: the free engine as it shipped through v0.2.26.
 * - 2: deterministic math (#197) and per-species flight traits (#169), with researched polar bear
 *   behaviour values (docs/SPECIES.md §11.6).
 *
 * Kept in its own module so the species registry can read it without importing the config.
 */
export const FREE_MODEL_VERSION = 2;

/** Whether `v` is a model version this build runs: an integer from 1 to FREE_MODEL_VERSION. */
export const isFreeModelVersion = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= FREE_MODEL_VERSION;
