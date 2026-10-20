import type { ScenarioConfig } from '../sim/config';
import type { BattleTrace, RunSummary } from '../sim/engine';
import { packSummaries, type AggregateResult } from '../sim/montecarlo';
import type { WorkerRequest, WorkerResponse } from '../workers/protocol';
import { estimateRemainingMs, poolSize, splitRuns, type RunRange } from './chunks';

export interface PoolProgress {
  done: number;
  total: number;
  elapsedMs: number;
  /** null until enough runs finished to extrapolate. */
  etaMs: number | null;
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

const PROGRESS_THROTTLE_MS = 100;

function spawnWorker(): Worker {
  return new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
}

interface Chunk {
  range: RunRange;
  done: number;
}

interface RunJob {
  config: ScenarioConfig;
  queue: RunRange[];
  inFlight: Map<number, Chunk>;
  completedRuns: number;
  summaries: RunSummary[];
  startedAt: number;
  lastReport: number;
  onProgress: (p: PoolProgress) => void;
  resolve: (s: RunSummary[]) => void;
  reject: (e: Error) => void;
}

interface AggregateJob {
  jobId: number;
  resolve: (a: AggregateResult) => void;
  reject: (e: Error) => void;
}

interface ReplayJob {
  jobId: number;
  resolve: (t: BattleTrace) => void;
  reject: (e: Error) => void;
}

/**
 * Fixed-size pool of simulation workers. Runs are split into small contiguous chunks that idle
 * workers pull from a queue, so uneven battle lengths still balance across cores.
 * Results do not depend on the pool size: every run is seeded by its index.
 */
export class SimPool {
  readonly size: number;
  private workers: Worker[] = [];
  private replayWorker: Worker | null = null;
  private nextJobId = 1;
  private job: RunJob | null = null;
  private replayJob: ReplayJob | null = null;
  private aggJob: AggregateJob | null = null;

  constructor(size = poolSize(globalThis.navigator?.hardwareConcurrency)) {
    this.size = size;
  }

  get running(): boolean {
    return this.job !== null || this.aggJob !== null;
  }

  /** Run every Monte Carlo run of `config`. Rejects with CancelledError if cancelled. */
  run(config: ScenarioConfig, onProgress: (p: PoolProgress) => void): Promise<RunSummary[]> {
    this.cancel();
    const chunks = splitRuns(config.runs, this.size);
    return new Promise<RunSummary[]>((resolve, reject) => {
      const job: RunJob = {
        config,
        queue: chunks,
        inFlight: new Map(),
        completedRuns: 0,
        summaries: [],
        startedAt: performance.now(),
        lastReport: 0,
        onProgress,
        resolve,
        reject,
      };
      this.job = job;
      if (chunks.length === 0) {
        this.finish(job);
        return;
      }
      const wanted = Math.min(this.size, chunks.length);
      while (this.workers.length < wanted) this.workers.push(this.createRunWorker());
      for (const w of this.workers.slice(0, wanted)) this.dispatch(w, job);
    });
  }

  /**
   * Aggregate the summaries of a finished run in one of the (now idle) run workers, so the
   * Spearman sensitivities and quantiles never block the main thread. The result is the same
   * object `aggregate(config, buildDesign(config), summaries)` returns on the main thread.
   */
  aggregate(config: ScenarioConfig, summaries: readonly RunSummary[]): Promise<AggregateResult> {
    this.cancel();
    const worker = this.workers[0] ?? this.createRunWorker();
    if (this.workers.length === 0) this.workers.push(worker);
    const jobId = this.nextJobId++;
    const packed = packSummaries(summaries);
    return new Promise<AggregateResult>((resolve, reject) => {
      this.aggJob = { jobId, resolve, reject };
      const msg: WorkerRequest = { type: 'aggregate', jobId, config, summaries: packed };
      worker.postMessage(msg, [packed.buffer]);
    });
  }

  /** Abort the current Monte Carlo job (workers are terminated and recreated on demand). */
  cancel(): void {
    const job = this.job;
    const agg = this.aggJob;
    if (!job && !agg) return;
    this.job = null;
    this.aggJob = null;
    this.terminateRunWorkers();
    job?.reject(new CancelledError());
    agg?.reject(new CancelledError());
  }

  /** Re-simulate one run with a full trace. A newer replay request supersedes an older one. */
  replay(config: ScenarioConfig, run: number): Promise<BattleTrace> {
    if (this.replayJob) {
      this.replayWorker?.terminate();
      this.replayWorker = null;
      this.replayJob.reject(new CancelledError());
      this.replayJob = null;
    }
    const worker = (this.replayWorker ??= this.createReplayWorker());
    const jobId = this.nextJobId++;
    return new Promise<BattleTrace>((resolve, reject) => {
      this.replayJob = { jobId, resolve, reject };
      const msg: WorkerRequest = { type: 'replay', jobId, config, run };
      worker.postMessage(msg);
    });
  }

  dispose(): void {
    this.cancel();
    this.replayWorker?.terminate();
    this.replayWorker = null;
    if (this.replayJob) {
      this.replayJob.reject(new CancelledError());
      this.replayJob = null;
    }
  }

  private createRunWorker(): Worker {
    const w = spawnWorker();
    w.onmessage = (e: MessageEvent<WorkerResponse>) => this.onRunMessage(w, e.data);
    w.onerror = (e) => {
      e.preventDefault();
      this.fail(new Error(e.message || 'worker failed to start'));
    };
    return w;
  }

  private createReplayWorker(): Worker {
    const w = spawnWorker();
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const job = this.replayJob;
      if (!job || msg.jobId !== job.jobId) return;
      if (msg.type === 'replay') {
        this.replayJob = null;
        job.resolve(msg.trace);
      } else if (msg.type === 'error') {
        this.replayJob = null;
        job.reject(new Error(msg.message));
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      const job = this.replayJob;
      this.replayJob = null;
      this.replayWorker?.terminate();
      this.replayWorker = null;
      job?.reject(new Error(e.message || 'worker failed to start'));
    };
    return w;
  }

  private dispatch(worker: Worker, job: RunJob): void {
    const range = job.queue.shift();
    if (!range) return;
    const jobId = this.nextJobId++;
    job.inFlight.set(jobId, { range, done: 0 });
    const msg: WorkerRequest = {
      type: 'run',
      jobId,
      config: job.config,
      start: range.start,
      end: range.end,
    };
    worker.postMessage(msg);
  }

  private onRunMessage(worker: Worker, msg: WorkerResponse): void {
    const agg = this.aggJob;
    if (agg && msg.jobId === agg.jobId) {
      if (msg.type === 'aggregate') {
        this.aggJob = null;
        agg.resolve(msg.agg);
      } else if (msg.type === 'error') {
        this.fail(new Error(msg.message));
      }
      return;
    }
    const job = this.job;
    if (!job) return;
    const chunk = job.inFlight.get(msg.jobId);
    if (!chunk) return;
    switch (msg.type) {
      case 'progress':
        chunk.done = msg.done;
        this.report(job, false);
        break;
      case 'result':
        job.inFlight.delete(msg.jobId);
        job.completedRuns += chunk.range.end - chunk.range.start;
        for (const s of msg.summaries) job.summaries.push(s);
        if (job.queue.length > 0) this.dispatch(worker, job);
        if (job.inFlight.size === 0 && job.queue.length === 0) this.finish(job);
        else this.report(job, false);
        break;
      case 'error':
        this.fail(new Error(msg.message));
        break;
      case 'replay':
      case 'aggregate':
        break;
    }
  }

  private report(job: RunJob, force: boolean): void {
    const now = performance.now();
    if (!force && now - job.lastReport < PROGRESS_THROTTLE_MS) return;
    job.lastReport = now;
    let done = job.completedRuns;
    for (const c of job.inFlight.values()) done += c.done;
    const total = job.config.runs;
    const elapsedMs = now - job.startedAt;
    job.onProgress({ done, total, elapsedMs, etaMs: estimateRemainingMs(done, total, elapsedMs) });
  }

  private finish(job: RunJob): void {
    this.report(job, true);
    this.job = null;
    job.resolve(job.summaries);
  }

  private fail(err: Error): void {
    const job = this.job;
    const agg = this.aggJob;
    this.job = null;
    this.aggJob = null;
    this.terminateRunWorkers();
    job?.reject(err);
    agg?.reject(err);
  }

  private terminateRunWorkers(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}
