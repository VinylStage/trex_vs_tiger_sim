import { DT } from '../engine.ts';
import { cardDef, type CardDef, type TraitField } from './cards.ts';
import type { FreeConfig } from './config.ts';

/**
 * Intervention log of the free engine (docs/design/RENEWAL-1.0.md §10.1, Appendix B; ADR-0008
 * §7). A log entry names a card by its wire code; the catalogue of the run's model version
 * (`config.mv`) defines what it does. Pure data and functions: the engine applies the compiled
 * log at the top of its tick loop (`simulateFreeBattle(…, { interventions })`).
 */

/** Side 2 means both sides (a `both` card). */
export type InterventionSide = 0 | 1 | 2;

export interface Intervention {
  /** Tick at whose start the card applies, in [0, maxSteps). */
  tick: number;
  /** Wire code (`CARD_IDS` index). */
  card: number;
  side: InterventionSide;
}

/** Longest log a run accepts (§10.1 bounds). */
export const MAX_INTERVENTIONS = 64;

/** Bounds of the combined `mul` multiplier per side and field, before the field clamps (§10.1). */
export const MUL_MIN = 0.5;
export const MUL_MAX = 2;

/** One raw entry as a `[tick, card, side]` tuple (the link format, §10.3) or an object. */
function entryOf(raw: unknown): [unknown, unknown, unknown] | null {
  if (Array.isArray(raw)) return raw.length === 3 ? [raw[0], raw[1], raw[2]] : null;
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  return [o['tick'], o['card'], o['side']];
}

/**
 * Valid entries of `raw` for a run of `maxSteps` ticks under model version `mv`:
 * - an entry is kept only if its tick is an integer in [0, maxSteps), its card exists in that
 *   `mv`'s catalogue, and its side matches the card's target (`both` → 2, `one` → 0 or 1);
 * - morale cards are dropped when morale is off;
 * - the kept entries are sorted stably by tick, and only the first `MAX_INTERVENTIONS` remain.
 *
 * Entries are `[tick, card, side]` tuples or `{tick, card, side}` objects; anything else, and a
 * non-array `raw`, yields nothing. The result is always a fresh array of fresh objects.
 */
export function sanitizeInterventions(
  raw: unknown,
  maxSteps: number,
  mv: number,
  config: Pick<FreeConfig, 'morale'>,
): Intervention[] {
  if (!Array.isArray(raw)) return [];
  const out: Intervention[] = [];
  for (const r of raw as unknown[]) {
    const e = entryOf(r);
    if (e === null) continue;
    const [tick, card, side] = e;
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0 || tick >= maxSteps) {
      continue;
    }
    if (typeof card !== 'number') continue;
    const def = cardDef(mv, card);
    if (def === undefined) continue;
    if (def.target === 'both' ? side !== 2 : side !== 0 && side !== 1) continue;
    if (def.needs === 'morale' && !config.morale) continue;
    out.push({ tick, card, side: side as InterventionSide });
  }
  // Array.prototype.sort is stable (ES2019), so entries of one tick keep their log order.
  out.sort((a, b) => a.tick - b.tick);
  if (out.length > MAX_INTERVENTIONS) out.length = MAX_INTERVENTIONS;
  return out;
}

/** Ticks a `mul` op of a card lasting `durationS` seconds stays active; null = rest of battle. */
export const durationTicks = (durationS: number | null): number =>
  durationS === null ? Infinity : Math.round(durationS / DT);

/** A `mul` op of the log with its active window `start ≤ step < end`. */
export interface ActiveMul {
  start: number;
  /** Infinity for a rest-of-battle card. */
  end: number;
  side: InterventionSide;
  field: TraitField;
  k: number;
}

export interface CompiledEntry {
  tick: number;
  side: InterventionSide;
  def: CardDef;
}

export interface CompiledLog {
  /** Entries in log order (sorted by tick), with their card definitions. */
  entries: readonly CompiledEntry[];
  /** Every `mul` op, in (start tick, log index, op index) order: the order of the product. */
  muls: readonly ActiveMul[];
  /** Sorted distinct ticks below `maxSteps` at which an entry applies or a `mul` op expires. */
  events: readonly number[];
}

/**
 * Resolves a sanitized log (`sanitizeInterventions`) against model version `mv`. Entries whose
 * card that `mv` does not define are skipped, so an unsanitized log can never reach the engine.
 */
export function compileInterventions(
  log: readonly Intervention[],
  mv: number,
  maxSteps: number,
): CompiledLog {
  const entries: CompiledEntry[] = [];
  const muls: ActiveMul[] = [];
  const ticks = new Set<number>();
  for (const e of log) {
    const def = cardDef(mv, e.card);
    if (def === undefined) continue;
    entries.push({ tick: e.tick, side: e.side, def });
    ticks.add(e.tick);
    const end = e.tick + durationTicks(def.durationS);
    for (const op of def.ops) {
      if (op.op === 'mul')
        muls.push({ start: e.tick, end, side: e.side, field: op.field, k: op.k });
    }
    if (end < maxSteps) ticks.add(end);
  }
  return { entries, muls, events: [...ticks].sort((a, b) => a - b) };
}

/**
 * Combined multiplier of `field` for side `side` (0 or 1) at `step`: the product of the active
 * `mul` ops in (start tick, log index) order, clamped to [MUL_MIN, MUL_MAX]. Null when no op is
 * active, so the caller restores the base value exactly.
 */
export function mulProduct(
  muls: readonly ActiveMul[],
  side: 0 | 1,
  field: TraitField,
  step: number,
): number | null {
  let p = 1;
  let any = false;
  for (const m of muls) {
    if (m.field !== field || (m.side !== side && m.side !== 2)) continue;
    if (m.start <= step && step < m.end) {
      p *= m.k;
      any = true;
    }
  }
  return any ? Math.min(MUL_MAX, Math.max(MUL_MIN, p)) : null;
}
