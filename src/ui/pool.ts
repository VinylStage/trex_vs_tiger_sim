import type { ScenarioConfig } from '../sim/config';
import type { BattleTrace, RunSummary } from '../sim/engine';
import type { FreeConfig } from '../sim/free/config';
import type { FreeRunSummary, FreeTrace } from '../sim/free/engine';
import type { FreeAggregate } from '../sim/free/aggregate';
import { packFreeSummaries } from '../sim/free/montecarlo';
import { packSummaries, type AggregateResult } from '../sim/montecarlo';
import type { WorkerRequest, WorkerResponse } from '../workers/protocol';
import workerUrl from '../workers/sim.worker.ts?worker&url';
import { poolSize } from './chunks';
import {
  CancelledError,
  Priority,
  Scheduler,
  type Job,
  type PoolProgress,
  type TaskRequest,
} from './scheduler';

export { CancelledError, Priority, type PoolProgress } from './scheduler';

/** The subset of the Trusted Types API used here (not in TypeScript's DOM lib yet). */
interface TrustedTypesLike {
  createPolicy(
    name: string,
    rules: { createScriptURL(input: string): string },
  ): { createScriptURL(input: string): unknown };
}

/**
 * The CSP's only Trusted Types policy (`trusted-types sim-worker`, docs/DEPLOYMENT.md). The Worker
 * constructor is a TrustedScriptURL sink, so under `require-trusted-types-for 'script'` it needs a
 * policy-made value. The policy accepts nothing but the bundled worker URL.
 */
export const WORKER_POLICY = 'sim-worker';

/** `url` as the Worker constructor accepts it under Trusted Types; the plain URL elsewhere. */
export function trustedWorkerUrl(url: string, tt: TrustedTypesLike | undefined): string {
  if (!tt) return url;
  const policy = tt.createPolicy(WORKER_POLICY, {
    createScriptURL(input) {
      if (input !== url) throw new TypeError(`${WORKER_POLICY}: unexpected URL`);
      return input;
    },
  });
  return policy.createScriptURL(url) as string;
}

let workerScript: string | undefined;

function spawnWorker(): Worker {
  workerScript ??= trustedWorkerUrl(
    workerUrl,
    (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes,
  );
  return new Worker(workerScript, { type: 'module' });
}

interface ReplayJob {
  jobId: number;
  resolve: (t: BattleTrace | FreeTrace) => void;
  reject: (e: Error) => void;
}

/**
 * The page's simulation workers: a `Scheduler` of warm run workers (small chunks, chunk-level
 * preemption, src/ui/scheduler.ts) plus one replay worker. `run`/`aggregate` are the foreground
 * job of the Simple and Advanced batches: a new one supersedes the previous one, which rejects
 * with CancelledError while every run worker stays warm. A newer replay still terminates the old
 * replay worker. Results do not depend on the pool size or
 * the chunk size: every run is seeded by its index and summaries come back in run order.
 */
export class SimPool {
  readonly size: number;
  /** Background jobs at their own priority (they are not superseded by `run`). */
  readonly scheduler: Scheduler;
  private replayWorker: Worker | null = null;
  private nextJobId = 1;
  private foreground: Job<unknown> | null = null;
  private replayJob: ReplayJob | null = null;

  /** `spawn` creates one worker; the tests pass a fake (tests/pool-jobs.test.ts). */
  constructor(
    size = poolSize(globalThis.navigator?.hardwareConcurrency),
    private readonly spawn: () => Worker = spawnWorker,
  ) {
    this.size = size;
    this.scheduler = new Scheduler(size, spawn);
  }

  get running(): boolean {
    return this.foreground !== null;
  }

  /** Run every Monte Carlo run of `config`. Rejects with CancelledError if cancelled. */
  run(
    config: ScenarioConfig,
    onProgress: (p: PoolProgress) => void,
    priority: Priority = Priority.WhatIf,
  ): Promise<RunSummary[]> {
    return this.own(() => this.scheduler.submitRuns(config, priority, onProgress)) as Promise<
      RunSummary[]
    >;
  }

  /** Run every run of a free-model config (src/sim/free) on the same workers. */
  runFree(
    config: FreeConfig,
    onProgress: (p: PoolProgress) => void,
    priority: Priority = Priority.WhatIf,
  ): Promise<FreeRunSummary[]> {
    return this.own(() => this.scheduler.submitRuns(config, priority, onProgress)) as Promise<
      FreeRunSummary[]
    >;
  }

  /**
   * Aggregate the summaries of a finished run in an idle run worker, so the Spearman
   * sensitivities and quantiles never block the main thread. The result is the same object
   * `aggregate(config, buildDesign(config), summaries)` returns on the main thread.
   */
  aggregate(config: ScenarioConfig, summaries: readonly RunSummary[]): Promise<AggregateResult> {
    const packed = packSummaries(summaries);
    return this.aggregateTask((jobId) => ({
      msg: { type: 'aggregate', jobId, config, summaries: packed },
      transfer: [packed.buffer],
    })) as Promise<AggregateResult>;
  }

  /** `aggregate` for a free-model batch (src/sim/free/aggregate.ts), also in a worker. */
  aggregateFree(config: FreeConfig, summaries: readonly FreeRunSummary[]): Promise<FreeAggregate> {
    const packed = packFreeSummaries(summaries);
    return this.aggregateTask((jobId) => ({
      msg: { type: 'aggregate-free', jobId, config, summaries: packed },
      transfer: [packed.buffer],
    })) as Promise<FreeAggregate>;
  }

  /** Abort the foreground job. Its queued chunks are dropped; no worker is terminated. */
  cancel(): void {
    const job = this.foreground;
    this.foreground = null;
    job?.cancel();
  }

  /** The page was hidden or shown: idle workers are released after a long hide. */
  setHidden(hidden: boolean): void {
    this.scheduler.setHidden(hidden);
  }

  /** Re-simulate one run with a full trace. A newer replay request supersedes an older one. */
  replay(config: ScenarioConfig, run: number): Promise<BattleTrace> {
    return this.startReplay({ type: 'replay', jobId: 0, config, run }) as Promise<BattleTrace>;
  }

  /** Re-simulate one free-model run with its trace (shares the replay worker and its rule). */
  replayFree(config: FreeConfig, run: number): Promise<FreeTrace> {
    return this.startReplay({ type: 'replay-free', jobId: 0, config, run }) as Promise<FreeTrace>;
  }

  private startReplay(
    req: Extract<WorkerRequest, { type: 'replay' | 'replay-free' }>,
  ): Promise<BattleTrace | FreeTrace> {
    if (this.replayJob) {
      this.replayWorker?.terminate();
      this.replayWorker = null;
      this.replayJob.reject(new CancelledError());
      this.replayJob = null;
    }
    const worker = (this.replayWorker ??= this.createReplayWorker());
    const jobId = this.nextJobId++;
    return new Promise<BattleTrace | FreeTrace>((resolve, reject) => {
      this.replayJob = { jobId, resolve, reject };
      const msg: WorkerRequest = { ...req, jobId };
      worker.postMessage(msg);
    });
  }

  /** Terminate every worker (page unload). */
  dispose(): void {
    this.cancel();
    this.scheduler.dispose();
    this.replayWorker?.terminate();
    this.replayWorker = null;
    if (this.replayJob) {
      this.replayJob.reject(new CancelledError());
      this.replayJob = null;
    }
  }

  private aggregateTask(task: TaskRequest): Promise<AggregateResult | FreeAggregate> {
    return this.own(() => this.scheduler.submit({ priority: Priority.WhatIf, tasks: [task] })).then(
      (results) => {
        const r = results[0];
        if (r?.type === 'aggregate' || r?.type === 'aggregate-free') return r.agg;
        throw new Error('unexpected worker response');
      },
    );
  }

  /**
   * Cancel the previous foreground job, then submit the new one, so the old job's queued chunks
   * cannot take a free worker first.
   */
  private own<T>(submit: () => Job<T>): Promise<T> {
    this.cancel();
    const job = submit();
    this.foreground = job;
    const clear = (): void => {
      if (this.foreground === job) this.foreground = null;
    };
    return job.promise.then(
      (r) => {
        clear();
        return r;
      },
      (e: unknown) => {
        clear();
        throw e;
      },
    );
  }

  private createReplayWorker(): Worker {
    const w = this.spawn();
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const job = this.replayJob;
      if (!job || msg.jobId !== job.jobId) return;
      if (msg.type === 'replay' || msg.type === 'replay-free') {
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
}
