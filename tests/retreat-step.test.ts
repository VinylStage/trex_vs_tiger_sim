import { describe, expect, it } from 'vitest';
import { EndReason } from '../src/sim/engine';
import {
  FREE_PARAM_INDEX,
  RETREAT_STEP_SINCE_MV,
  sanitizeFreeConfig,
} from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FREE_CONSTANTS,
  FREE_FRAME_STRIDE,
  FreeState,
  simulateFreeBattle,
  type FreeTraceFrame,
} from '../src/sim/free/engine';
import { designRow } from '../src/sim/sampling';

/**
 * Retreat step, free model 4 (#237, docs/MODEL.md §3.10). An agent that wants to latch steps up
 * to contact distance measured from the target's position at the start of the tick, while a target
 * in Recover backs off in the same tick. Up to model 3 the pursuer therefore ended every tick one
 * target step short of contact: it hovered beside the retreating target until it was exhausted, the
 * roles swapped, and the pair could reach the 3,600 s time limit. From model 4 the pursuer closes
 * that step as well.
 *
 * The case is the one the calibration found (CALIBRATION.md §21): _T. rex_ 1 v tiger 5, default
 * seed, 1,000 runs, run 519, which reaches the time limit under model 3 with the last tiger
 * hovering 3.9 m from the recovering _T. rex_.
 */

const RUN = 519;
const input = {
  runs: 1000,
  sides: [{ species: 'trex' }, { species: 'tiger', count: 5 }],
} as const;

function traced(mv: number): {
  endReason: number;
  duration: number;
  frames: FreeTraceFrame[];
  contact: number;
} {
  const c = sanitizeFreeConfig({ ...input, mv });
  expect(c.mv).toBe(mv);
  const design = buildFreeDesign(c);
  const row = designRow(design, RUN);
  const out = simulateFreeBattle(c, row, RUN, true);
  if (!out.trace) throw new Error('no trace');
  // Latch contact distance: both body radii (run-level) and the contact margin.
  const contact =
    (row[FREE_PARAM_INDEX['a.bodyRadius'] as number] as number) +
    (row[FREE_PARAM_INDEX['b.bodyRadius'] as number] as number) +
    FREE_CONSTANTS.contactMargin;
  return {
    endReason: out.summary.endReason,
    duration: out.summary.duration,
    frames: out.trace.frames,
    contact,
  };
}

const at = (f: FreeTraceFrame, i: number, k: number): number =>
  f.agents[i * FREE_FRAME_STRIDE + k] as number;

/**
 * Longest stretch (s) in which a tiger approaches the _T. rex_ (agent 0) while the _T. rex_ is in
 * Recover, no tiger is latched, and the tiger stays just outside latch contact (within 1 m of
 * it), where no latch can even be tried: the hover.
 */
function longestHover(frames: FreeTraceFrame[], contact: number): number {
  const n = (frames[0] as FreeTraceFrame).agents.length / FREE_FRAME_STRIDE;
  let best = 0;
  for (let j = 1; j < n; j++) {
    let start = -1;
    for (const f of frames) {
      const latched = Array.from({ length: n - 1 }, (_, k) => at(f, k + 1, 4)).includes(
        FreeState.Latched,
      );
      const d = Math.hypot(at(f, j, 0) - at(f, 0, 0), at(f, j, 1) - at(f, 0, 1));
      const hovering =
        at(f, 0, 4) === FreeState.Recover &&
        at(f, j, 4) === FreeState.Approach &&
        !latched &&
        d > contact &&
        d < contact + 1;
      if (!hovering) {
        start = -1;
        continue;
      }
      if (start < 0) start = f.t;
      best = Math.max(best, f.t - start);
    }
  }
  return best;
}

/** Frames in which some tiger rides the _T. rex_ while the _T. rex_ is in Recover. */
const latchedOnRecovering = (frames: FreeTraceFrame[]): number =>
  frames.filter((f) => {
    if (at(f, 0, 4) !== FreeState.Recover) return false;
    for (let j = 1; j < f.agents.length / FREE_FRAME_STRIDE; j++) {
      if (at(f, j, 4) === FreeState.Latched) return true;
    }
    return false;
  }).length;

describe('retreat step (free model 4, #237)', () => {
  it('starts at model 4', () => {
    expect(RETREAT_STEP_SINCE_MV).toBe(4);
  });

  const v3 = traced(3);
  const v4 = traced(4);

  it('model 3 keeps the hover and the time-limit draw', () => {
    expect(v3.endReason).toBe(EndReason.TimeLimit);
    expect(v3.duration).toBe(3600);
    // The last tiger holds just outside contact of the recovering T. rex for several seconds.
    expect(longestHover(v3.frames, v3.contact)).toBeGreaterThanOrEqual(5);
  });

  it('model 4: the pursuer latches onto a recovering target and the run ends', () => {
    expect(v4.endReason).not.toBe(EndReason.TimeLimit);
    expect(v4.duration).toBeLessThan(3600);
    expect(latchedOnRecovering(v4.frames)).toBeGreaterThan(0);
    expect(longestHover(v4.frames, v4.contact)).toBeLessThan(1);
  });
});
