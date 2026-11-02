import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig, type ScenarioConfig } from '../src/sim/config';
import type { RunSummary } from '../src/sim/engine';
import { aggregateFree } from '../src/sim/free/aggregate';
import { sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import type { FreeRunSummary } from '../src/sim/free/engine';
import { runAllFree, runFreeChunk } from '../src/sim/free/montecarlo';
import { FREE_PRESETS, presetConfig } from '../src/sim/free/presets';
import { MAX_CHUNK_RUNS } from '../src/ui/chunks';
import { SimPool } from '../src/ui/pool';
import {
  CancelledError,
  HIDE_RELEASE_MS,
  Priority,
  Scheduler,
  type TaskRequest,
  type WorkerLike,
} from '../src/ui/scheduler';
import type { WorkerRequest, WorkerResponse } from '../src/workers/protocol';

/*
 * The priority scheduler over warm workers (#175, docs/design/RENEWAL-1.0.md §10.7) against a
 * scripted fake worker: priority order, preemption at chunk boundaries, cancel and supersede
 * without terminating a worker, crashes, the long-hide release, and results that do not depend
 * on the chunk size, the worker count or the order in which chunks finish.
 */

class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  readonly posted: WorkerRequest[] = [];
  /** Requests not answered yet, oldest first (a real worker handles them in order). */
  readonly open: WorkerRequest[] = [];
  terminated = false;

  postMessage(msg: WorkerRequest): void {
    if (this.terminated) throw new Error('posted to a terminated worker');
    this.posted.push(msg);
    this.open.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(msg: WorkerResponse): void {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>);
  }

  crash(message: string): void {
    this.onerror?.({ message, preventDefault: () => undefined } as ErrorEvent);
  }

  /** Answer the oldest open request with a `result` of fake summaries (or a generic reply). */
  answer(): WorkerRequest {
    const msg = this.open.shift();
    if (!msg) throw new Error('nothing to answer');
    if (msg.type === 'run') {
      const summaries: RunSummary[] = [];
      for (let r = msg.start; r < msg.end; r++) summaries.push({ run: r } as RunSummary);
      this.emit({ type: 'progress', jobId: msg.jobId, done: msg.end - msg.start });
      this.emit({ type: 'result', jobId: msg.jobId, summaries });
    } else {
      this.emit({ type: 'progress', jobId: msg.jobId, done: 1 });
      this.emit({ type: 'aggregate', jobId: msg.jobId, agg: {} as never });
    }
    return msg;
  }
}

function setup(size: number) {
  const workers: FakeWorker[] = [];
  const scheduler = new Scheduler(size, () => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  return { scheduler, workers };
}

/** `n` tasks labelled `${label}${i}`; the label rides in the `run` field of a replay request. */
const labelled: string[] = [];
function tasks(label: string, n: number): TaskRequest[] {
  return Array.from({ length: n }, (_, i): TaskRequest => {
    return (id) => {
      labelled[id] = `${label}${i}`;
      return { msg: { type: 'replay', jobId: id, config: defaultConfig(), run: i } };
    };
  });
}
const labelOf = (msg: WorkerRequest): string => labelled[msg.jobId] ?? '?';

const config = (runs: number): ScenarioConfig => ({ ...defaultConfig(), runs });

afterEach(() => {
  vi.useRealTimers();
});

describe('priority order', () => {
  it('an idle worker always takes the most urgent job next, oldest first within a priority', async () => {
    const { scheduler, workers } = setup(1);
    const order: string[] = [];
    const a = scheduler.submit({ priority: Priority.NextMatch, tasks: tasks('A', 3) });
    const b = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('B', 2) });
    const c = scheduler.submit({ priority: Priority.LiveChance, tasks: tasks('C', 1) });
    const d = scheduler.submit({ priority: Priority.Speculative, tasks: tasks('D', 1) });
    const e = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('E', 1) });
    const w = workers[0] as FakeWorker;
    while (w.open.length > 0) order.push(labelOf(w.answer()));
    // A0 was already running when the others arrived; it is never interrupted.
    expect(order).toEqual(['A0', 'B0', 'B1', 'E0', 'C0', 'A1', 'A2', 'D0']);
    await Promise.all([a.promise, b.promise, c.promise, d.promise, e.promise]);
    expect(workers).toHaveLength(1);
  });

  it('resolves with every task’s answer in task order, whatever order they finish in', async () => {
    const { scheduler, workers } = setup(3);
    const job = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('T', 3) });
    for (const w of [...workers].reverse()) w.answer();
    const ids = (await job.promise).map((r) => r.jobId);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
  });

  it('spawns workers only as needed, never more than its size', () => {
    const { scheduler, workers } = setup(3);
    scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('S', 1) });
    expect(workers).toHaveLength(1);
    scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('M', 10) });
    expect(workers).toHaveLength(3);
    expect(scheduler.workerCount).toBe(3);
  });
});

describe('preemption', () => {
  it('a more urgent job takes over within one chunk, then the background job resumes', async () => {
    const { scheduler, workers } = setup(2);
    const background = scheduler.submitRuns(config(500), Priority.NextMatch, () => undefined);
    const [w0, w1] = workers as [FakeWorker, FakeWorker];
    w0.answer();
    w1.answer();
    expect(labelsOf([w0, w1])).toEqual(['bg', 'bg']);

    const urgent = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('U', 3) });
    // Nothing is interrupted: each worker finishes its current chunk, then takes urgent work.
    expect(w0.open.map(isRun)).toEqual([true]);
    w0.answer();
    expect(w0.open.map(labelOf)).toEqual(['U0']);
    w1.answer();
    expect(w1.open.map(labelOf)).toEqual(['U1']);
    w0.answer();
    expect(w0.open.map(labelOf)).toEqual(['U2']);
    w1.answer();
    expect(w1.open.map(isRun)).toEqual([true]);
    w0.answer();
    await urgent.promise;

    while (w0.open.length + w1.open.length > 0) {
      if (w0.open.length > 0) w0.answer();
      if (w1.open.length > 0) w1.answer();
    }
    const out = await background.promise;
    expect(out.map((s) => s.run)).toEqual([...Array(500).keys()]);
    expect(workers.some((w) => w.terminated)).toBe(false);
  });

  it('chunks are small (at most MAX_CHUNK_RUNS runs), so the wait is bounded', () => {
    const { scheduler, workers } = setup(3);
    scheduler.submitRuns(config(20000), Priority.NextMatch, () => undefined);
    for (const w of workers) {
      const msg = w.open[0];
      expect(msg?.type === 'run' && msg.end - msg.start).toBe(MAX_CHUNK_RUNS);
    }
  });
});

describe('cancel and supersede keep the workers warm', () => {
  it('cancel drops the queued chunks, discards in-flight answers and terminates nothing', async () => {
    const { scheduler, workers } = setup(2);
    const progress: number[] = [];
    const job = scheduler.submitRuns(config(200), Priority.LiveChance, (p) =>
      progress.push(p.done),
    );
    job.cancel();
    await expect(job.promise).rejects.toBeInstanceOf(CancelledError);
    const next = scheduler.submit({ priority: Priority.Speculative, tasks: tasks('N', 2) });
    // The in-flight chunks finish and are ignored; each worker then takes the next job.
    for (const w of workers) w.answer();
    expect(progress).toEqual([]);
    expect(workers.map((w) => w.open.map(labelOf))).toEqual([['N0'], ['N1']]);
    for (const w of workers) w.answer();
    await next.promise;
    expect(workers.flatMap((w) => w.posted).filter(isRun)).toHaveLength(2);
    expect(workers.some((w) => w.terminated)).toBe(false);
  });

  it('cancelling one job leaves the others running', async () => {
    const { scheduler, workers } = setup(1);
    const keep = scheduler.submit({ priority: Priority.NextMatch, tasks: tasks('K', 2) });
    const drop = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('D', 2) });
    drop.cancel();
    await expect(drop.promise).rejects.toBeInstanceOf(CancelledError);
    const w = workers[0] as FakeWorker;
    const order: string[] = [];
    while (w.open.length > 0) order.push(labelOf(w.answer()));
    expect(order).toEqual(['K0', 'K1']);
    await keep.promise;
  });

  it('SimPool: superseding a run, an aggregate or a replay never terminates a worker', async () => {
    const workers: FakeWorker[] = [];
    const pool = new SimPool(3, () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
    const first = pool.run(config(300), () => undefined);
    const agg = pool.aggregate(config(2), [{ run: 0 } as RunSummary]);
    const second = pool.runFree({ ...sanitizeFreeConfig({}), runs: 40 }, () => undefined);
    const replay1 = pool.replay(config(10), 1);
    const replay2 = pool.replay(config(10), 2);
    await expect(first).rejects.toBeInstanceOf(CancelledError);
    await expect(agg).rejects.toBeInstanceOf(CancelledError);
    await expect(replay1).rejects.toBeInstanceOf(CancelledError);
    for (let guard = 0; guard < 100 && pool.running; guard++) {
      for (const w of workers) if (w.open[0]?.type === 'run') w.answer();
      await Promise.resolve();
    }
    expect((await second).length).toBe(40);
    // Three run workers and one replay worker, all still alive.
    expect(workers).toHaveLength(4);
    expect(workers.some((w) => w.terminated)).toBe(false);
    void replay2.catch(() => undefined);
    pool.dispose();
    expect(workers.every((w) => w.terminated)).toBe(true);
  });
});

describe('errors, hide and unload', () => {
  it('an error message rejects only its job; the worker stays warm', async () => {
    const { scheduler, workers } = setup(1);
    const bad = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('B', 2) });
    const good = scheduler.submit({ priority: Priority.NextMatch, tasks: tasks('G', 1) });
    const w = workers[0] as FakeWorker;
    const msg = w.open.shift() as WorkerRequest;
    w.emit({ type: 'error', jobId: msg.jobId, message: 'boom' });
    await expect(bad.promise).rejects.toThrow('boom');
    expect(w.open.map(labelOf)).toEqual(['G0']);
    w.answer();
    await good.promise;
    expect(w.terminated).toBe(false);
  });

  it('a crashed worker is terminated, its job rejects and the other jobs move to a new worker', async () => {
    const { scheduler, workers } = setup(2);
    const a = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('A', 1) });
    const b = scheduler.submit({ priority: Priority.NextMatch, tasks: tasks('B', 2) });
    const [w0, w1] = workers as [FakeWorker, FakeWorker];
    w0.crash('');
    await expect(a.promise).rejects.toThrow('worker failed to start');
    expect(w0.terminated).toBe(true);
    expect(w1.terminated).toBe(false);
    const w2 = workers[2] as FakeWorker;
    expect(w2.open.map(labelOf)).toEqual(['B1']);
    w1.answer();
    w2.answer();
    await b.promise;
    expect(scheduler.workerCount).toBe(2);
  });

  it('a long hide releases idle workers (busy ones when they finish); showing keeps them', async () => {
    vi.useFakeTimers();
    const { scheduler, workers } = setup(2);
    const job = scheduler.submit({ priority: Priority.NextMatch, tasks: tasks('H', 3) });
    scheduler.setHidden(true);
    vi.advanceTimersByTime(HIDE_RELEASE_MS - 1);
    scheduler.setHidden(false);
    vi.advanceTimersByTime(HIDE_RELEASE_MS);
    expect(workers.some((w) => w.terminated)).toBe(false);

    scheduler.setHidden(true);
    vi.advanceTimersByTime(HIDE_RELEASE_MS);
    // Both are busy and a task is queued: nothing is released yet.
    expect(workers.some((w) => w.terminated)).toBe(false);
    const [w0, w1] = workers as [FakeWorker, FakeWorker];
    w0.answer();
    expect(w0.open.map(labelOf)).toEqual(['H2']);
    w1.answer();
    expect(w1.terminated).toBe(true);
    w0.answer();
    await job.promise;
    expect(w0.terminated).toBe(true);
    expect(scheduler.workerCount).toBe(0);

    // The next job spawns fresh workers.
    scheduler.setHidden(false);
    scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('V', 1) });
    expect(scheduler.workerCount).toBe(1);
  });

  it('dispose cancels every job and terminates every worker', async () => {
    const { scheduler, workers } = setup(2);
    const job = scheduler.submit({ priority: Priority.WhatIf, tasks: tasks('X', 5) });
    scheduler.dispose();
    await expect(job.promise).rejects.toBeInstanceOf(CancelledError);
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(scheduler.workerCount).toBe(0);
  });
});

/**
 * A fake worker that really runs the free engine on each chunk and answers asynchronously, in a
 * scrambled order, so chunks finish out of order like they do on real cores.
 */
function computingPool(size: number): SimPool {
  let tick = 0;
  return new SimPool(size, () => {
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(msg: WorkerRequest) {
        if (msg.type !== 'run') throw new Error(`unexpected ${msg.type}`);
        const c = sanitizeFreeConfig(msg.config);
        const summaries = runFreeChunk(c, buildFreeDesign(c), msg.start, msg.end);
        setTimeout(
          () => w.onmessage?.({ data: { type: 'result', jobId: msg.jobId, summaries } } as never),
          (tick++ * 7) % 5,
        );
      },
      terminate: () => undefined,
    };
    return w as unknown as Worker;
  });
}

describe('results do not depend on chunking or worker count', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/preset-shares.json', import.meta.url), 'utf8'),
  ) as {
    seed: number;
    runs: number;
    presets: { id: string; wins: [number, number, number]; medianS: number }[];
  };
  // The one-on-one presets keep this fast; docs/PERFORMANCE.md records the full preset check.
  const small = FREE_PRESETS.filter((p) => p.a.n + p.b.n <= 2);

  it('has small presets to check', () => {
    expect(small.length).toBeGreaterThanOrEqual(3);
  });

  it.each(small.map((p) => [p.id, p] as const))(
    '%s through the pool at 1, 3 and 8 workers matches the preset fixture and runAllFree',
    async (_, p) => {
      const cfg: FreeConfig = sanitizeFreeConfig({
        ...presetConfig(p),
        seed: fixture.seed,
        runs: fixture.runs,
      });
      const expected = runAllFree(cfg).summaries;
      const row = fixture.presets.find((r) => r.id === p.id);
      for (const size of [1, 3, 8]) {
        const out: FreeRunSummary[] = await computingPool(size).runFree(cfg, () => undefined);
        expect(out).toEqual(expected);
        const agg = aggregateFree(cfg, out);
        expect([agg.aWins, agg.bWins, agg.draws]).toEqual(row?.wins);
        expect(agg.duration.p50).toBe(row?.medianS);
      }
    },
  );
});

const isRun = (m: WorkerRequest): boolean => m.type === 'run';
function labelsOf(ws: FakeWorker[]): string[] {
  return ws.flatMap((w) => w.open.map((m) => (m.type === 'run' ? 'bg' : labelOf(m))));
}
