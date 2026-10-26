import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../src/sim/config';
import { simulateBattle } from '../src/sim/engine';
import { aggregate, packSummaries, runChunk } from '../src/sim/montecarlo';
import { buildDesign, designRow } from '../src/sim/sampling';
import { aggregateFree } from '../src/sim/free/aggregate';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import { packFreeSummaries, runFreeChunk, unpackFreeSummaries } from '../src/sim/free/montecarlo';
import {
  freeTraceTransferList,
  traceTransferList,
  type WorkerResponse,
} from '../src/workers/protocol';
import { simulateFreeBattle } from '../src/sim/free/engine';

/*
 * Message dispatch of src/workers/sim.worker.ts (#61), run in Node: the module installs
 * `self.onmessage`, so a stand-in `self` captures what it posts. The engine itself is covered
 * elsewhere; this checks that each request reaches the right function with a sanitized config.
 */

interface Posted {
  msg: WorkerResponse;
  transfer: Transferable[] | undefined;
}

const posted: Posted[] = [];
const workerSelf: {
  postMessage(msg: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((e: { data: unknown }) => void) | null;
} = {
  postMessage: (msg, transfer) => posted.push({ msg, transfer }),
  onmessage: null,
};

const send = (data: unknown): Posted[] => {
  posted.length = 0;
  workerSelf.onmessage?.({ data });
  return [...posted];
};

const small = (): ScenarioConfig => ({ ...defaultConfig(), runs: 6, heavyCount: 2, packCount: 12 });

beforeAll(async () => {
  vi.stubGlobal('self', workerSelf);
  await import('../src/workers/sim.worker');
});

beforeEach(() => {
  posted.length = 0;
});

describe('sim.worker dispatch', () => {
  it('installs a message handler', () => {
    expect(typeof workerSelf.onmessage).toBe('function');
  });

  it('run: answers with exactly the summaries runChunk computes', () => {
    const config = small();
    const out = send({ type: 'run', jobId: 7, config, start: 2, end: 5 });
    const last = out.at(-1)?.msg;
    expect(last?.type).toBe('result');
    if (last?.type !== 'result') return;
    expect(last.jobId).toBe(7);
    const expected = runChunk(sanitizeConfig(config), buildDesign(sanitizeConfig(config)), 2, 5);
    expect(last.summaries).toEqual(expected);
    for (const p of out.slice(0, -1)) expect(p.msg.type).toBe('progress');
  });

  it('run: clamps the range to the configured runs', () => {
    const config = small();
    const last = send({ type: 'run', jobId: 1, config, start: -4, end: 1e9 }).at(-1)?.msg;
    expect(last?.type === 'result' && last.summaries.map((s) => s.run)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('run: sanitizes a hostile config before simulating', () => {
    const config = { ...small(), runs: 3, heavyCount: -50, packCount: 1e12 } as ScenarioConfig;
    const last = send({ type: 'run', jobId: 2, config, start: 0, end: 3 }).at(-1)?.msg;
    expect(last?.type).toBe('result');
    const safe = sanitizeConfig(config);
    expect(last?.type === 'result' && last.summaries).toEqual(
      runChunk(safe, buildDesign(safe), 0, safe.runs),
    );
  });

  it('aggregate: unpacks the transferred summaries and aggregates them', () => {
    const config = small();
    const design = buildDesign(config);
    const summaries = runChunk(config, design, 0, config.runs);
    const out = send({ type: 'aggregate', jobId: 3, config, summaries: packSummaries(summaries) });
    expect(out).toHaveLength(1);
    const msg = out[0]?.msg;
    expect(msg?.type).toBe('aggregate');
    expect(msg?.type === 'aggregate' && msg.agg).toEqual(aggregate(config, design, summaries));
  });

  it('aggregate-free: aggregates a free batch in the worker, with a sanitized config', () => {
    const config = sanitizeFreeConfig({
      runs: 8,
      sides: [
        { species: 'tiger', count: 2 },
        { species: 'lion', count: 2 },
      ],
    });
    const summaries = runFreeChunk(config, buildFreeDesign(config), 0, config.runs);
    const packed = packFreeSummaries(summaries);
    expect(unpackFreeSummaries(packed)).toEqual(summaries);
    const out = send({ type: 'aggregate-free', jobId: 5, config, summaries: packed });
    expect(out).toHaveLength(1);
    const msg = out[0]?.msg;
    expect(msg?.type).toBe('aggregate-free');
    expect(msg?.type === 'aggregate-free' && msg.agg).toEqual(aggregateFree(config, summaries));
  });

  it('replay: sends the traced battle of the requested run and transfers its buffers', () => {
    const config = small();
    const out = send({ type: 'replay', jobId: 4, config, run: 99 });
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p?.msg.type).toBe('replay');
    if (p?.msg.type !== 'replay') return;
    // run 99 is clamped to the last run
    const { trace } = simulateBattle(config, designRow(buildDesign(config), 5), 5, true);
    expect(p.msg.trace.events).toEqual(trace?.events);
    expect(p.transfer).toEqual(traceTransferList(p.msg.trace));
  });

  it('replay-free: sends the free trace of the requested run and transfers its buffers', () => {
    const config = sanitizeFreeConfig({
      runs: 4,
      sides: [
        { species: 'wolf', count: 6 },
        { species: 'tiger', count: 1 },
      ],
    });
    const out = send({ type: 'replay-free', jobId: 5, config, run: 99 });
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p?.msg.type).toBe('replay-free');
    if (p?.msg.type !== 'replay-free') return;
    // run 99 is clamped to the last run
    const { trace } = simulateFreeBattle(config, designRow(buildFreeDesign(config), 3), 3, true);
    expect(p.msg.trace.frames.length).toBe(trace?.frames.length);
    expect(p.msg.trace.frames.at(-1)?.agents).toEqual(trace?.frames.at(-1)?.agents);
    expect(p.transfer).toEqual(freeTraceTransferList(p.msg.trace));
    expect(new Set(p.transfer).size).toBe(p.transfer?.length);
  });

  it('reports a failure as an error message with the job id (or −1 without one)', () => {
    const withId = send({ type: 'aggregate', jobId: 5, config: small(), summaries: null });
    expect(withId.map((p) => p.msg)).toEqual([
      { type: 'error', jobId: 5, message: expect.any(String) as string },
    ]);
    const without = send({ type: 'aggregate', jobId: 'x', config: small(), summaries: null });
    expect(without[0]?.msg).toMatchObject({ type: 'error', jobId: -1 });
  });
});
