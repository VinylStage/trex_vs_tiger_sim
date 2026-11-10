import { DT } from '../sim/engine';
import type { FreeConfig } from '../sim/free/config';
import {
  BRANCH_SALT_MIN,
  FREE_FRAME_STRIDE,
  FreeOutcome,
  FreeState,
  type FreeTrace,
} from '../sim/free/engine';
import type { Intervention } from '../sim/free/interventions';
import { MAX_CHUNK_RUNS } from './chunks';
import type { WinChancePoint } from './replay/free-events';
import { CancelledError, Priority, type Scheduler, type TaskRequest } from './scheduler';

/**
 * Live win chance, "실시간 예상 승률" (RENEWAL-1.0 §10.2 point 4). At each of k checkpoints, B
 * branches replay the live run (same config, run and intervention log) up to the checkpoint tick
 * and diverge there through the engine's branch hook (`opts.branch`, salts from 6). Side A's win
 * share among the branches is the chance at that checkpoint. The branches run as a P2 job on the
 * batch workers. When the job misses its budget, the bar falls back to "전력 비율" (HP-weighted
 * remaining strength), which is a different type with a `ratio`, never a `chance`, so it cannot
 * be shown or used as a probability by mistake.
 */

/** Branches per checkpoint (B; S, §10.2). */
export const LIVE_CHANCE_BRANCHES = 32;
/** Checkpoints per live battle (k; S, §10.2). */
export const LIVE_CHANCE_CHECKPOINTS = 8;

/** Side A's win chance at one checkpoint, with the branch counts behind it. */
export interface LiveChancePoint extends WinChancePoint {
  /** Checkpoint tick; `t` is `tick × dt`. */
  readonly tick: number;
  /** Branches won by side A, won by side B, drawn; `n` in all. */
  readonly a: number;
  readonly b: number;
  readonly draw: number;
  readonly n: number;
}

/** "전력 비율" at one time: side A's share of the HP-weighted remaining strength. Not a chance. */
export interface StrengthPoint {
  readonly t: number;
  readonly ratio: number;
}

/** What the bar shows: the win chance, or the labelled strength fallback. */
export type LiveBar =
  | { readonly kind: 'chance'; readonly points: readonly LiveChancePoint[] }
  | { readonly kind: 'strength'; readonly points: readonly StrengthPoint[] };

/**
 * `k` checkpoint ticks spread evenly over `[from, end)`: `from + floor((end − from) × j / k)` for
 * j = 0…k−1, without duplicates (a short span yields fewer). Empty when the span is empty.
 */
export function checkpointTicks(from: number, end: number, k: number): number[] {
  const lo = Math.max(0, Math.floor(from));
  const span = Math.floor(end) - lo;
  const count = Math.max(0, Math.floor(k));
  const out: number[] = [];
  if (span <= 0) return out;
  for (let j = 0; j < count; j++) {
    const tick = lo + Math.floor((span * j) / count);
    if (out.at(-1) !== tick) out.push(tick);
  }
  return out;
}

/**
 * Checkpoints to recompute after a card at `tick` (§10.2 point 4): as many as `points` has at or
 * after `tick` (at least one), spread over `[tick, end)` of the re-simulated battle. Points
 * before `tick` stay as they were: they show what was known before the card.
 */
export function ticksAfterCard(
  points: readonly LiveChancePoint[],
  tick: number,
  end: number,
): number[] {
  const after = points.filter((p) => p.tick >= tick).length;
  return checkpointTicks(tick, end, Math.max(1, after));
}

/** The old points before `tick`, then the recomputed ones, in tick order. */
export function mergeAfterCard(
  points: readonly LiveChancePoint[],
  fresh: readonly LiveChancePoint[],
  tick: number,
): LiveChancePoint[] {
  return [...points.filter((p) => p.tick < tick), ...fresh].sort((x, y) => x.tick - y.tick);
}

export interface LiveChanceRequest {
  config: FreeConfig;
  run: number;
  interventions: readonly Intervention[];
  /** Checkpoint ticks (`checkpointTicks`, or `ticksAfterCard` after a card). */
  ticks: readonly number[];
  /** Branches per checkpoint; default `LIVE_CHANCE_BRANCHES`. */
  branches?: number;
}

export interface LiveChanceJob<T> {
  readonly promise: Promise<T>;
  /** Drop the job; the promise rejects with CancelledError. Workers stay warm. */
  readonly cancel: () => void;
}

/**
 * Queue the branches of `req` on `scheduler` at P2 (live chance). Each checkpoint's branches are
 * split evenly into chunks of at most `MAX_CHUNK_RUNS`, so a P1 what-if batch takes over within
 * one chunk. Branch j uses salt `BRANCH_SALT_MIN + j` at every checkpoint. Resolves with one
 * point per checkpoint, in tick order; a draw counts half for each side.
 */
export function submitLiveChance(
  scheduler: Scheduler,
  req: LiveChanceRequest,
  priority: Priority = Priority.LiveChance,
): LiveChanceJob<LiveChancePoint[]> {
  const B = Math.max(1, Math.floor(req.branches ?? LIVE_CHANCE_BRANCHES));
  const ticks = [...new Set(req.ticks.map((t) => Math.floor(t)))].sort((x, y) => x - y);
  const parts = Math.ceil(B / MAX_CHUNK_RUNS);
  const size = Math.ceil(B / parts);
  const owner: number[] = [];
  const tasks: TaskRequest[] = [];
  ticks.forEach((tick, c) => {
    for (let s = 0; s < B; s += size) {
      const branches: { tick: number; salt: number }[] = [];
      for (let j = s; j < Math.min(B, s + size); j++)
        branches.push({ tick, salt: BRANCH_SALT_MIN + j });
      owner.push(c);
      tasks.push((jobId) => ({
        msg: {
          type: 'branch-free',
          jobId,
          config: req.config,
          run: req.run,
          interventions: req.interventions,
          branches,
        },
      }));
    }
  });
  const job = scheduler.submit({ priority, tasks });
  const promise = job.promise.then((results) => {
    const counts = ticks.map(() => [0, 0, 0]);
    results.forEach((r, i) => {
      if (r.type !== 'branch-free') throw new Error('unexpected worker response');
      const tally = counts[owner[i] as number] as number[];
      for (const o of r.outcomes) {
        const k = o === FreeOutcome.A ? 0 : o === FreeOutcome.B ? 1 : 2;
        tally[k] = (tally[k] as number) + 1;
      }
    });
    return ticks.map((tick, c): LiveChancePoint => {
      const [a, b, draw] = counts[c] as [number, number, number];
      const n = a + b + draw;
      return { t: tick * DT, tick, chance: n > 0 ? (a + draw / 2) / n : 0.5, a, b, draw, n };
    });
  });
  return { promise, cancel: job.cancel };
}

/**
 * "전력 비율" of one frame: side A's share of Σ (HP fraction × mass) over the animals still
 * fighting (not fled, not incapacitated). 0.5 when neither side has any. A strength share, not a
 * probability.
 */
export function strengthRatio(trace: FreeTrace, frameIndex: number): number {
  const f = trace.frames[frameIndex];
  if (!f) return 0.5;
  const nA = trace.counts[0];
  const n = nA + trace.counts[1];
  const sum = [0, 0];
  for (let i = 0; i < n; i++) {
    const o = i * FREE_FRAME_STRIDE;
    if ((f.agents[o + 4] as number) >= FreeState.Routed) continue;
    const s = i < nA ? 0 : 1;
    sum[s] = (sum[s] as number) + (f.agents[o + 3] as number) * (trace.meta.mass[i] as number);
  }
  const total = (sum[0] as number) + (sum[1] as number);
  return total > 0 ? (sum[0] as number) / total : 0.5;
}

/** `strengthRatio` at each tick, from the last frame at or before `tick × dt` (never ahead). */
export function strengthTimeline(trace: FreeTrace, ticks: readonly number[]): StrengthPoint[] {
  return ticks.map((tick) => {
    const t = tick * trace.meta.dt;
    let k = 0;
    while (k + 1 < trace.frames.length && (trace.frames[k + 1]?.t as number) <= t) k++;
    return { t, ratio: strengthRatio(trace, k) };
  });
}

/**
 * The live bar for `req`: the win chance if the branches finish within `budgetMs`, otherwise the
 * strength fallback at the same ticks, read from the live `trace` (§10.2 point 4, §10.5). A worker
 * error rejects; `cancel()` rejects with CancelledError.
 */
export function runLiveChance(
  scheduler: Scheduler,
  req: LiveChanceRequest,
  trace: FreeTrace,
  budgetMs: number,
): LiveChanceJob<LiveBar> {
  const job = submitLiveChance(scheduler, req);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    job.cancel();
  }, budgetMs);
  const promise = job.promise.then(
    (points): LiveBar => {
      clearTimeout(timer);
      return { kind: 'chance', points };
    },
    (e: unknown): LiveBar => {
      clearTimeout(timer);
      if (timedOut && e instanceof CancelledError)
        return { kind: 'strength', points: strengthTimeline(trace, req.ticks) };
      throw e;
    },
  );
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
      job.cancel();
    },
  };
}
