import type { FreeTrace } from './engine.ts';

/**
 * Splices a forked trace onto the trace it was forked from (RENEWAL-1.0 §10.2 point 2,
 * docs/REPLAY.md §14). A run with a card at `tick` is identical to its parent up to the start of
 * that tick, so every frame either trace stores at a time ≤ `tick × dt` has the same contents.
 * The engine thins frames by total battle length, though, so the two traces need not store the
 * same frames before `tick`. The splice keeps the parent's frames up to `tick × dt` and the
 * fork's frames after it: the prefix is then exactly what the viewer was watching, and a swap at
 * the playhead (`FreeReplayView.load(…, { startAt })`) shows no jump. The frames after `tick × dt`
 * keep the fork's own interval, which the replay interpolates like any other.
 *
 * The result holds at most the parent's and the fork's frame budgets together. Frames are shared,
 * not copied. A fork of a different matchup (counts or dt) is returned unchanged.
 */
export function spliceForkTrace(parent: FreeTrace, fork: FreeTrace, tick: number): FreeTrace {
  if (
    parent.counts[0] !== fork.counts[0] ||
    parent.counts[1] !== fork.counts[1] ||
    parent.meta.dt !== fork.meta.dt
  ) {
    return fork;
  }
  // `(step + 1) × dt` in the engine and `tick × dt` here are the same float for step + 1 = tick.
  const cut = tick * fork.meta.dt;
  const frames = parent.frames.filter((f) => f.t <= cut);
  for (const f of fork.frames) if (f.t > cut) frames.push(f);
  return { ...fork, frames };
}
