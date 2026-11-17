import { CARDS_PER_DRAW } from '../sim/free/cards';
import type { MsgKey } from './i18n';

/**
 * The two adaptive gates of live cards (RENEWAL-1.0 §10.2 point 5, owner decision R6) and the
 * degradation order when one fails. Pure: every input is a measurement or a setting the caller
 * passes in (the live run's own `liveSimMs`, the match's per-run cost, the OBS factor, the worker
 * count, the pause and prediction windows), so the decisions are table-tested without timing.
 *
 * - **Gate (a), re-simulation.** Live cards only if `liveSimMs × 1.5 ≤ 500 ms`; the factor covers
 *   cards that lengthen the battle.
 * - **Gate (b), card-pause budget.** `(W₁ + W₂) × msPerRun × c_obs ÷ batchWorkers ≤ 0.8 × pause`,
 *   with `W₁ = 3 × N` what-if runs and `W₂ = checkpoints after T × B` live-chance branches.
 * - **Degradation**, in this order: N per card 200 → 100 → 50; then only the next 2 checkpoints
 *   in the pause (the rest after it); then no what-if numbers and the "전력 비율" bar; and when
 *   gate (a) fails, pre-battle cards at tick 0, which must re-simulate within 50 % of the
 *   prediction window, else no cards at all.
 */

/** Gate (a): factor on the live run's own cost, for cards that lengthen the battle (S). */
export const RESIM_FACTOR = 1.5;
/** Gate (a): longest allowed re-simulation, ms (§10.5). */
export const RESIM_LIMIT_MS = 500;
/** Gate (b): share of the card pause the pause workload may use. */
export const PAUSE_SHARE = 0.8;
/** Pre-battle cards: share of the prediction window the one simulation may use. */
export const PREBATTLE_SHARE = 0.5;
/** OBS load factor when no session-start check measured one (S, §10.7). */
export const DEFAULT_C_OBS = 1.3;
/** What-if runs per card, from the most to the fewest (§10.2 point 5, step 1). */
export const WHATIF_RUNS = [200, 100, 50] as const;
/** Checkpoints recomputed inside the pause at degradation step 2. */
export const NEAR_CHECKPOINTS = 2;

/** Measured inputs of the gates. Times in ms. */
export interface GateInput {
  /** Wall time of the live run's simulation in the live worker (`LiveReplay.liveSimMs`). */
  liveSimMs: number;
  /** Median ms per run on one batch worker, from this match's measurements. */
  msPerRun: number;
  /** OBS load factor; `DEFAULT_C_OBS` when absent. */
  cObs?: number;
  /** Batch workers (the live worker excluded). */
  batchWorkers: number;
  /** Length of the card pause. */
  pauseMs: number;
  /** Length of the prediction window (pre-battle cards). */
  predictionMs: number;
  /** Live-chance checkpoints at or after the card tick. */
  checkpointsAfter: number;
  /** Branches per checkpoint (B). */
  branches: number;
}

/** What the live-chance bar recomputes after a card. */
export type ChancePlan =
  /** Every checkpoint after the card, inside the pause. */
  | 'all'
  /** The next `NEAR_CHECKPOINTS` inside the pause, the rest during playback. */
  | 'near'
  /** None: the bar shows the labelled "전력 비율". */
  | 'strength';

/** Why live cards were degraded (the overlay and the live page say it in words). */
export type GateNote =
  /** Everything fits. */
  | 'ok'
  /** Fewer what-if runs or fewer checkpoints in the pause; nothing the viewer must be told. */
  | 'reduced'
  /** What-if numbers dropped: "효과 계산 생략: 대결 규모가 큼". */
  | 'noWhatIf'
  /** Gate (a) failed: "대결 규모가 커서 출전 전 변수만 씁니다". */
  | 'preBattle'
  /** Not even pre-battle cards fit: the match runs without cards and says so. */
  | 'noCards';

export type LivePlan =
  | {
      /** Cards during the battle, at a pause. */
      mode: 'live';
      /** What-if runs per card, or null when the numbers are dropped. */
      whatIfRuns: number | null;
      chance: ChancePlan;
      note: 'ok' | 'reduced' | 'noWhatIf';
    }
  | {
      /** Cards in the prediction beat, applied at tick 0. No what-if numbers. */
      mode: 'preBattle';
      whatIfRuns: null;
      chance: 'strength';
      note: 'preBattle';
    }
  | { mode: 'none'; whatIfRuns: null; chance: 'strength'; note: 'noCards' };

const finite = (x: number): number => (Number.isFinite(x) && x > 0 ? x : 0);

/** Gate (a): whether the live run re-simulates within the limit, with the factor. */
export const resimGate = (liveSimMs: number): boolean =>
  Number.isFinite(liveSimMs) && liveSimMs >= 0 && liveSimMs * RESIM_FACTOR <= RESIM_LIMIT_MS;

/** Pre-battle cards: whether the one simulation after the pick fits its share of the window. */
export const preBattleGate = (liveSimMs: number, predictionMs: number): boolean =>
  Number.isFinite(liveSimMs) &&
  liveSimMs >= 0 &&
  liveSimMs * RESIM_FACTOR <= PREBATTLE_SHARE * finite(predictionMs);

/** Wall time of `runs` runs spread over the batch workers, ms (gate (b)'s left side). */
export function pauseWorkMs(runs: number, input: GateInput): number {
  const workers = Math.max(1, Math.floor(input.batchWorkers));
  const c = input.cObs !== undefined && Number.isFinite(input.cObs) ? input.cObs : DEFAULT_C_OBS;
  return (Math.max(0, runs) * finite(input.msPerRun) * Math.max(1, c)) / workers;
}

/** Gate (b): whether `whatIfRuns` per card and `checkpoints` live-chance checkpoints fit. */
export function pauseGate(whatIfRuns: number, checkpoints: number, input: GateInput): boolean {
  const w1 = CARDS_PER_DRAW * Math.max(0, whatIfRuns);
  const w2 = Math.max(0, checkpoints) * Math.max(0, Math.floor(input.branches));
  return pauseWorkMs(w1 + w2, input) <= PAUSE_SHARE * finite(input.pauseMs);
}

/**
 * The plan for live cards under the measured `input`, following the degradation order of
 * §10.2 point 5. The first step that fits wins; the result never depends on a clock.
 */
export function planLiveCards(input: GateInput): LivePlan {
  if (!resimGate(input.liveSimMs)) {
    return preBattleGate(input.liveSimMs, input.predictionMs)
      ? { mode: 'preBattle', whatIfRuns: null, chance: 'strength', note: 'preBattle' }
      : { mode: 'none', whatIfRuns: null, chance: 'strength', note: 'noCards' };
  }
  const all = Math.max(0, Math.floor(input.checkpointsAfter));
  // Step 1: fewer what-if runs, every checkpoint after the card.
  for (const n of WHATIF_RUNS) {
    if (pauseGate(n, all, input)) {
      return {
        mode: 'live',
        whatIfRuns: n,
        chance: 'all',
        note: n === WHATIF_RUNS[0] ? 'ok' : 'reduced',
      };
    }
  }
  // Step 2: the fewest what-if runs, only the next checkpoints inside the pause.
  const near = Math.min(all, NEAR_CHECKPOINTS);
  const fewest = WHATIF_RUNS[WHATIF_RUNS.length - 1] as number;
  if (pauseGate(fewest, near, input)) {
    return { mode: 'live', whatIfRuns: fewest, chance: 'near', note: 'reduced' };
  }
  // Step 3: no what-if numbers, the bar falls back to "전력 비율".
  return { mode: 'live', whatIfRuns: null, chance: 'strength', note: 'noWhatIf' };
}

/** The words a plan's note puts on screen (ko/en `live.gate.*`), or null when nothing is said. */
export function gateMessageKey(note: GateNote): MsgKey | null {
  switch (note) {
    case 'noWhatIf':
      return 'live.gate.noWhatIf';
    case 'preBattle':
      return 'live.gate.preBattle';
    case 'noCards':
      return 'live.gate.noCards';
    default:
      return null;
  }
}
