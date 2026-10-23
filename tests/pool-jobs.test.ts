import { describe, expect, it } from 'vitest';
import { defaultConfig, type ScenarioConfig } from '../src/sim/config';
import type { BattleTrace, RunSummary } from '../src/sim/engine';
import { defaultFreeConfig } from '../src/sim/free/config';
import type { AggregateResult } from '../src/sim/montecarlo';
import { CancelledError, SimPool } from '../src/ui/pool';
import type { WorkerRequest, WorkerResponse } from '../src/workers/protocol';

/*
 * SimPool's job lifecycle against a scripted fake worker (#61): chunk dispatch, progress,
 * cancellation, worker errors, aggregation and superseded replays. The real worker dispatch is
 * covered by tests/sim-worker.test.ts.
 */

class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  readonly posted: { msg: WorkerRequest; transfer: unknown }[] = [];
  terminated = false;

  postMessage(msg: WorkerRequest, transfer?: unknown): void {
    this.posted.push({ msg, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Deliver a message from the worker to the pool. */
  emit(msg: WorkerResponse): void {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>);
  }

  /** The worker failed to start or threw outside the message handler. */
  crash(message: string): void {
    this.onerror?.({ message, preventDefault: () => undefined } as ErrorEvent);
  }

  /** The last request not yet answered by `answerRuns`. */
  last(): WorkerRequest | undefined {
    return this.posted.at(-1)?.msg;
  }
}

function setup(size = 2) {
  const workers: FakeWorker[] = [];
  const pool = new SimPool(size, () => {
    const w = new FakeWorker();
    workers.push(w);
    return w as unknown as Worker;
  });
  return { pool, workers };
}

const summary = (run: number): RunSummary => ({ run }) as RunSummary;
const config = (runs: number): ScenarioConfig => ({ ...defaultConfig(), runs });

/** Answer every outstanding run request, repeatedly, until no worker has one left. */
function answerRuns(workers: FakeWorker[]): void {
  const answered = new Set<number>();
  for (let guard = 0; guard < 1000; guard++) {
    const open = workers.flatMap((w) =>
      w.posted
        .map((p) => ({ w, msg: p.msg }))
        .filter(({ msg }) => msg.type === 'run' && !answered.has(msg.jobId)),
    );
    if (open.length === 0) return;
    for (const { w, msg } of open) {
      if (msg.type !== 'run') continue;
      answered.add(msg.jobId);
      const summaries = [];
      for (let r = msg.start; r < msg.end; r++) summaries.push(summary(r));
      w.emit({ type: 'progress', jobId: msg.jobId, done: msg.end - msg.start });
      w.emit({ type: 'result', jobId: msg.jobId, summaries });
    }
  }
}

describe('SimPool.run', () => {
  it('splits the runs over at most `size` workers and returns every summary once', async () => {
    const { pool, workers } = setup(3);
    const progress: number[] = [];
    const p = pool.run(config(30), (pr) => progress.push(pr.done));
    expect(workers).toHaveLength(3);
    expect(pool.running).toBe(true);
    answerRuns(workers);
    const out = await p;
    expect(out.map((s) => s.run).sort((a, b) => a - b)).toEqual([...Array(30).keys()]);
    expect(progress.at(-1)).toBe(30);
    expect(pool.running).toBe(false);
  });

  it('uses fewer workers than its size for a small batch', async () => {
    const { pool, workers } = setup(4);
    const p = pool.run(config(1), () => undefined);
    expect(workers).toHaveLength(1);
    answerRuns(workers);
    expect(await p).toEqual([summary(0)]);
  });

  it('runs free-model configs on the same workers', async () => {
    const { pool, workers } = setup(2);
    const p = pool.runFree({ ...defaultFreeConfig(), runs: 4 }, () => undefined);
    answerRuns(workers);
    expect((await p).length).toBe(4);
  });

  it('rejects with CancelledError on cancel, terminates the workers and ignores late answers', async () => {
    const { pool, workers } = setup(2);
    const p = pool.run(config(20), () => undefined);
    pool.cancel();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(() => answerRuns(workers)).not.toThrow();
    expect(pool.running).toBe(false);
  });

  it('a new run cancels the previous one', async () => {
    const { pool, workers } = setup(2);
    const first = pool.run(config(20), () => undefined);
    const second = pool.run(config(4), () => undefined);
    await expect(first).rejects.toBeInstanceOf(CancelledError);
    answerRuns(workers.filter((w) => !w.terminated));
    expect((await second).length).toBe(4);
  });

  it('rejects with the worker’s message when a chunk fails', async () => {
    const { pool, workers } = setup(2);
    const p = pool.run(config(20), () => undefined);
    const w = workers[0] as FakeWorker;
    const msg = w.last();
    w.emit({ type: 'error', jobId: msg?.jobId ?? -1, message: 'boom' });
    await expect(p).rejects.toThrow('boom');
    expect(workers.every((x) => x.terminated)).toBe(true);
  });

  it('rejects when a worker fails to start', async () => {
    const { pool, workers } = setup(2);
    const p = pool.run(config(20), () => undefined);
    (workers[1] as FakeWorker).crash('');
    await expect(p).rejects.toThrow('worker failed to start');
  });
});

describe('SimPool.aggregate', () => {
  it('sends the packed summaries as a transfer and resolves with the worker’s result', async () => {
    const { pool, workers } = setup(2);
    const p = pool.aggregate(config(2), [summary(0), summary(1)]);
    const w = workers[0] as FakeWorker;
    const req = w.posted[0];
    expect(req?.msg.type).toBe('aggregate');
    expect(req?.transfer).toHaveLength(1);
    const agg = { n: 2 } as unknown as AggregateResult;
    w.emit({ type: 'aggregate', jobId: req?.msg.jobId ?? -1, agg });
    await expect(p).resolves.toBe(agg);
  });

  it('is cancelled by a new run', async () => {
    const { pool } = setup(2);
    const p = pool.aggregate(config(2), [summary(0)]);
    void pool.run(config(2), () => undefined);
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });

  it('rejects with the worker’s error', async () => {
    const { pool, workers } = setup(2);
    const p = pool.aggregate(config(2), [summary(0)]);
    const w = workers[0] as FakeWorker;
    w.emit({ type: 'error', jobId: w.last()?.jobId ?? -1, message: 'bad' });
    await expect(p).rejects.toThrow('bad');
  });
});

describe('SimPool.replay', () => {
  const trace = {} as BattleTrace;

  it('resolves with the trace on its own replay worker', async () => {
    const { pool, workers } = setup(2);
    const p = pool.replay(config(10), 3);
    expect(workers).toHaveLength(1);
    const w = workers[0] as FakeWorker;
    expect(w.last()).toMatchObject({ type: 'replay', run: 3 });
    w.emit({ type: 'replay', jobId: w.last()?.jobId ?? -1, trace });
    await expect(p).resolves.toBe(trace);
  });

  it('a newer replay supersedes the older one: CancelledError, fresh worker', async () => {
    const { pool, workers } = setup(2);
    const first = pool.replay(config(10), 1);
    const second = pool.replay(config(10), 2);
    await expect(first).rejects.toBeInstanceOf(CancelledError);
    expect((workers[0] as FakeWorker).terminated).toBe(true);
    const w = workers[1] as FakeWorker;
    // An answer for the superseded job id is ignored.
    w.emit({ type: 'replay', jobId: -5, trace });
    w.emit({ type: 'replay', jobId: w.last()?.jobId ?? -1, trace });
    await expect(second).resolves.toBe(trace);
  });

  it('is not cancelled by a Monte Carlo run', async () => {
    const { pool, workers } = setup(2);
    const p = pool.replay(config(10), 0);
    const w = workers[0] as FakeWorker;
    void pool.run(config(2), () => undefined);
    w.emit({ type: 'replay', jobId: w.last()?.jobId ?? -1, trace });
    await expect(p).resolves.toBe(trace);
  });

  it('rejects on a worker error message and on a crashed worker', async () => {
    const { pool, workers } = setup(2);
    const a = pool.replay(config(10), 0);
    const w = workers[0] as FakeWorker;
    w.emit({ type: 'error', jobId: w.last()?.jobId ?? -1, message: 'no trace' });
    await expect(a).rejects.toThrow('no trace');
    const b = pool.replay(config(10), 0);
    w.crash('gone');
    await expect(b).rejects.toThrow('gone');
    expect(w.terminated).toBe(true);
  });

  it('dispose rejects a pending replay', async () => {
    const { pool } = setup(2);
    const p = pool.replay(config(10), 0);
    pool.dispose();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });
});
