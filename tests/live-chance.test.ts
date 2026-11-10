import { describe, expect, it } from 'vitest';
import { DT } from '../src/sim/engine';
import { CARD_IDS } from '../src/sim/free/cards';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  BRANCH_SALT_MIN,
  FreeOutcome,
  FreeState,
  simulateFreeBattle,
  type FreeTrace,
} from '../src/sim/free/engine';
import { designRow } from '../src/sim/sampling';
import {
  LIVE_CHANCE_BRANCHES,
  checkpointTicks,
  mergeAfterCard,
  runLiveChance,
  strengthRatio,
  strengthTimeline,
  submitLiveChance,
  ticksAfterCard,
  type LiveChancePoint,
  type StrengthPoint,
} from '../src/ui/live-chance';
import type { WinChancePoint } from '../src/ui/replay/free-events';
import { Scheduler, type WorkerLike } from '../src/ui/scheduler';
import type { WorkerRequest } from '../src/workers/protocol';

/*
 * Live-chance job (#179, RENEWAL-1.0 §10.2 point 4): checkpoint placement, the P2 branch job on
 * the scheduler (against a fake worker that runs the real engine), the recompute after a card,
 * and the "전력 비율" fallback, which is never a chance.
 */

const config = sanitizeFreeConfig({
  runs: 4,
  sides: [
    { species: 'wolf', count: 6 },
    { species: 'tiger', count: 1 },
  ],
});
const RUN = 1;
const row = designRow(buildFreeDesign(config), RUN);

/** Workers that run each `branch-free` message on the real engine and answer asynchronously. */
function computing(size: number, hold = false) {
  const posted: WorkerRequest[] = [];
  const scheduler = new Scheduler(size, () => {
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(msg: WorkerRequest) {
        posted.push(msg);
        if (hold) return;
        if (msg.type !== 'branch-free') throw new Error(`unexpected ${msg.type}`);
        const c = sanitizeFreeConfig(msg.config);
        const r = designRow(buildFreeDesign(c), msg.run);
        const outcomes = msg.branches.map(
          (branch) =>
            simulateFreeBattle(c, r, msg.run, false, {
              interventions: msg.interventions ?? [],
              branch,
            }).summary.outcome,
        );
        setTimeout(() =>
          w.onmessage?.({ data: { type: 'branch-free', jobId: msg.jobId, outcomes } } as never),
        );
      },
      terminate: () => undefined,
    };
    return w;
  });
  return { scheduler, posted };
}

describe('checkpoint ticks', () => {
  it('spreads k ticks evenly over [from, end), starting at from', () => {
    expect(checkpointTicks(0, 800, 8)).toEqual([0, 100, 200, 300, 400, 500, 600, 700]);
    expect(checkpointTicks(150, 450, 3)).toEqual([150, 250, 350]);
    expect(checkpointTicks(10, 13, 8)).toEqual([10, 11, 12]);
    expect(checkpointTicks(10, 10, 8)).toEqual([]);
    expect(checkpointTicks(0, 100, 0)).toEqual([]);
  });

  it('after a card at T: as many checkpoints as were at or after T, over [T, new end)', () => {
    const pts = checkpointTicks(0, 800, 8).map((tick) => ({ tick }) as LiveChancePoint);
    expect(ticksAfterCard(pts, 350, 1000)).toEqual([350, 512, 675, 837]);
    expect(ticksAfterCard(pts, 790, 900)).toEqual([790]);
  });

  it('keeps the points before T and replaces the rest', () => {
    const p = (tick: number, chance: number) => ({ tick, chance }) as LiveChancePoint;
    const old = [p(0, 0.5), p(100, 0.6), p(200, 0.7), p(300, 0.8)];
    expect(mergeAfterCard(old, [p(250, 0.1), p(150, 0.2)], 150)).toEqual([
      p(0, 0.5),
      p(100, 0.6),
      p(150, 0.2),
      p(250, 0.1),
    ]);
  });
});

describe('submitLiveChance', () => {
  it('runs B branches per checkpoint at P2, in chunks of at most 25, salts from 6', async () => {
    const { scheduler, posted } = computing(2);
    const ticks = [0, 40, 80];
    const job = submitLiveChance(scheduler, { config, run: RUN, interventions: [], ticks });
    const points = await job.promise;
    const msgs = posted.filter((m) => m.type === 'branch-free');
    expect(msgs).toHaveLength(ticks.length * 2);
    for (const m of msgs) expect(m.branches).toHaveLength(LIVE_CHANCE_BRANCHES / 2);
    const salts = msgs.filter((m) => m.branches[0]?.tick === 40).flatMap((m) => m.branches);
    expect(salts.map((b) => b.salt)).toEqual(
      Array.from({ length: LIVE_CHANCE_BRANCHES }, (_, j) => BRANCH_SALT_MIN + j),
    );
    expect(points.map((p) => p.tick)).toEqual(ticks);
    for (const p of points) {
      expect(p.n).toBe(LIVE_CHANCE_BRANCHES);
      expect(p.a + p.b + p.draw).toBe(p.n);
      expect(p.t).toBe(p.tick * DT);
      expect(p.chance).toBe((p.a + p.draw / 2) / p.n);
    }
    // Plain chance points fit the decisive-moment input.
    const timeline: readonly WinChancePoint[] = points;
    expect(timeline).toHaveLength(3);
  });

  it('equals the branches run directly, with the intervention log, and reproduces', async () => {
    const interventions = [{ tick: 30, card: CARD_IDS.indexOf('mud'), side: 2 as const }];
    const req = { config, run: RUN, interventions, ticks: [50, 10], branches: 7 };
    const a = await submitLiveChance(computing(3).scheduler, req).promise;
    const b = await submitLiveChance(computing(1).scheduler, req).promise;
    expect(a).toEqual(b);
    const direct = [10, 50].map((tick) => {
      const outs = Array.from(
        { length: 7 },
        (_, j) =>
          simulateFreeBattle(config, row, RUN, false, {
            interventions,
            branch: { tick, salt: BRANCH_SALT_MIN + j },
          }).summary.outcome,
      );
      return {
        a: outs.filter((o) => o === FreeOutcome.A).length,
        b: outs.filter((o) => o === FreeOutcome.B).length,
        draw: outs.filter((o) => o === FreeOutcome.Draw).length,
      };
    });
    expect(a.map(({ a: x, b: y, draw }) => ({ a: x, b: y, draw }))).toEqual(direct);
  });
});

describe('전력 비율 fallback', () => {
  const trace = (agents: number[][], mass: number[]): FreeTrace => ({
    version: 3,
    arenaSize: 100,
    counts: [2, 1],
    frames: agents.map((a, k) => ({
      t: k * 0.5,
      agents: new Float32Array(a),
      buffed: new Uint8Array(3),
    })),
    meta: { dt: DT, radius: [1, 1], mass: new Float32Array(mass) },
  });
  // Per agent: x, y, heading, hp fraction, state.
  const ag = (hp: number, state: number) => [0, 0, 0, hp, state];

  it('is side A’s share of Σ hp × mass over the animals still fighting', () => {
    const t = trace(
      [
        [...ag(1, FreeState.Approach), ...ag(1, FreeState.Approach), ...ag(1, FreeState.Approach)],
        [...ag(0.5, FreeState.Latched), ...ag(1, FreeState.Routed), ...ag(0.5, FreeState.Recover)],
        [...ag(0, FreeState.Dead), ...ag(1, FreeState.Left), ...ag(1, FreeState.Approach)],
      ],
      [10, 10, 40],
    );
    expect(strengthRatio(t, 0)).toBeCloseTo(20 / 60);
    expect(strengthRatio(t, 1)).toBeCloseTo(5 / 25);
    expect(strengthRatio(t, 2)).toBe(0);
    expect(strengthRatio(t, 9)).toBe(0.5);
    // Never ahead: 0.7 s reads the frame at 0.5 s.
    expect(strengthTimeline(t, [0, 7, 10])).toEqual([
      { t: 0, ratio: strengthRatio(t, 0) },
      { t: 7 * DT, ratio: strengthRatio(t, 1) },
      { t: 10 * DT, ratio: strengthRatio(t, 2) },
    ]);
  });

  it('is a different type from a chance point', () => {
    const s: StrengthPoint = { t: 0, ratio: 0.5 };
    // @ts-expect-error a strength point is not a win-chance point
    const c: WinChancePoint = s;
    expect(c).toBe(s);
  });

  it('runLiveChance: the chance within budget, the labelled strength fallback after it', async () => {
    const live = simulateFreeBattle(config, row, RUN, true).trace as FreeTrace;
    const ticks = [0, 40];
    const req = { config, run: RUN, interventions: [], ticks, branches: 4 };
    const ok = await runLiveChance(computing(2).scheduler, req, live, 60_000).promise;
    expect(ok.kind).toBe('chance');
    const slow = await runLiveChance(computing(2, true).scheduler, req, live, 5).promise;
    expect(slow).toEqual({ kind: 'strength', points: strengthTimeline(live, ticks) });
  });
});
