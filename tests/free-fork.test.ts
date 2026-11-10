import { describe, expect, it } from 'vitest';
import { DT } from '../src/sim/engine';
import { CARD_IDS } from '../src/sim/free/cards';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import { simulateFreeBattle, type FreeTrace } from '../src/sim/free/engine';
import { spliceForkTrace } from '../src/sim/free/fork';
import { designRow } from '../src/sim/sampling';

/*
 * Splicing a forked trace onto its parent (#178; RENEWAL-1.0 §10.2 point 2, docs/REPLAY.md §14):
 * the frames up to the card tick are the parent's, whatever grid the fork was thinned to.
 */

/** A trace of `n` agents with frames at `times`; frame contents encode the time and a tag. */
function synthetic(times: number[], tag: number, counts: [number, number] = [1, 1]): FreeTrace {
  const n = counts[0] + counts[1];
  return {
    version: 3,
    arenaSize: 100,
    counts,
    frames: times.map((t) => ({
      t,
      agents: new Float32Array(n * 5).fill(t * 1000 + tag),
      buffed: new Uint8Array(n),
    })),
    meta: { dt: DT, radius: [1, 1], mass: new Float32Array(n) },
  };
}

const grid = (every: number, end: number): number[] => {
  const out: number[] = [];
  for (let k = 0; k * every * DT <= end + 1e-9; k++) out.push(k * every * DT);
  return out;
};

describe('spliceForkTrace', () => {
  it('keeps the parent frames up to the tick and the fork frames after it', () => {
    // The parent kept every 5 ticks; the fork ran longer and was thinned to every 10.
    const parent = synthetic([...grid(5, 30), 31.7], 1);
    const fork = synthetic([...grid(10, 60), 64.2], 2);
    const tick = 150; // 15 s
    const out = spliceForkTrace(parent, fork, tick);
    const cut = tick * DT;
    expect(out.frames.filter((f) => f.t <= cut)).toEqual(parent.frames.filter((f) => f.t <= cut));
    expect(out.frames.filter((f) => f.t > cut)).toEqual(fork.frames.filter((f) => f.t > cut));
    // Shared, not copied; strictly increasing times; the fork's meta and end.
    expect(out.frames[0]).toBe(parent.frames[0]);
    for (let k = 1; k < out.frames.length; k++) {
      expect((out.frames[k] as { t: number }).t).toBeGreaterThan(
        (out.frames[k - 1] as { t: number }).t,
      );
    }
    expect(out.frames.at(-1)?.t).toBe(64.2);
    expect(out.meta).toBe(fork.meta);
  });

  it('keeps the parent prefix when the fork is denser (it ended sooner)', () => {
    const parent = synthetic(grid(10, 60), 1);
    const fork = synthetic([...grid(5, 25), 25.3], 2);
    const out = spliceForkTrace(parent, fork, 100);
    // 0, 1, …, 10 s from the parent (every 1 s), then 10.5, 11, …, 25, 25.3 s from the fork.
    expect(out.frames.map((f) => f.t)).toEqual([
      ...grid(10, 10),
      ...[...grid(5, 25), 25.3].filter((t) => t > 10),
    ]);
    expect(out.frames.every((f, k) => k > 10 || f === parent.frames[k])).toBe(true);
  });

  it('returns the fork unchanged for another matchup', () => {
    const fork = synthetic(grid(5, 10), 2, [2, 1]);
    expect(spliceForkTrace(synthetic(grid(5, 10), 1), fork, 50)).toBe(fork);
  });

  it('on a real fork: identical to the parent up to the tick, to the fork after it', () => {
    const config = sanitizeFreeConfig({
      runs: 2,
      sides: [
        { species: 'wolf', count: 8 },
        { species: 'brownBear', count: 1 },
      ],
    });
    const row = designRow(buildFreeDesign(config), 1);
    const parent = simulateFreeBattle(config, row, 1, true).trace as FreeTrace;
    const tick = 120;
    const log = [{ tick, card: CARD_IDS.indexOf('mud'), side: 2 as const }];
    const fork = simulateFreeBattle(config, row, 1, true, { interventions: log })
      .trace as FreeTrace;
    const cut = tick * DT;
    // The premise: frames both traces store up to the tick are equal.
    const pre = (t: FreeTrace) => t.frames.filter((f) => f.t <= cut);
    expect(pre(fork)).toEqual(pre(parent));
    const out = spliceForkTrace(parent, fork, tick);
    expect(out).toEqual(fork);
    expect(out.frames.slice(0, pre(parent).length).every((f, k) => f === parent.frames[k])).toBe(
      true,
    );
  });
});
