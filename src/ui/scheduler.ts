import type { ScenarioConfig } from '../sim/config';
import type { RunSummary } from '../sim/engine';
import type { FreeConfig } from '../sim/free/config';
import type { FreeRunSummary } from '../sim/free/engine';
import type { WorkerRequest, WorkerResponse } from '../workers/protocol';
import { estimateRemainingMs, splitRuns } from './chunks';

/**
 * Job priorities, lowest number first (docs/design/RENEWAL-1.0.md §10.7). P0 is the live
 * re-simulation; it runs on the dedicated replay worker and is listed so callers share one scale.
 */
export const Priority = {
  Live: 0,
  WhatIf: 1,
  LiveChance: 2,
  NextMatch: 3,
  Speculative: 4,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export interface PoolProgress {
  done: number;
  total: number;
  elapsedMs: number;
  /** null until enough runs finished to extrapolate. */
  etaMs: number | null;
}

/** A hidden page releases its idle workers after this long (they respawn on the next job). */
export const HIDE_RELEASE_MS = 5 * 60_000;

const PROGRESS_THROTTLE_MS = 100;

/** The part of `Worker` the scheduler uses, so the tests can pass a fake. */
export interface WorkerLike {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage(msg: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

/** One message to one worker. `id` is the message's `jobId`; every response carries it back. */
export type TaskRequest = (id: number) => { msg: WorkerRequest; transfer?: Transferable[] };

export interface JobSpec {
  priority: Priority;
  tasks: readonly TaskRequest[];
  /** A `progress` message for task `index`. */
  onProgress?: (index: number, done: number) => void;
  /** The final response of task `index` (anything but `progress` and `error`). */
  onResult?: (index: number, msg: WorkerResponse) => void;
}

export interface Job<T> {
  readonly id: number;
  readonly priority: Priority;
  /** Settles once: the result, the first error, or CancelledError. */
  readonly promise: Promise<T>;
  /** Drop the queued tasks and ignore the in-flight ones. The workers keep running. */
  readonly cancel: () => void;
}

interface JobState {
  id: number;
  priority: Priority;
  spec: JobSpec;
  /** Index of the next task to dispatch. */
  next: number;
  results: WorkerResponse[];
  remaining: number;
  settled: boolean;
  resolve: (r: WorkerResponse[]) => void;
  reject: (e: Error) => void;
}

interface Slot {
  worker: WorkerLike;
  /** Message id in flight on this worker, or null when idle. */
  busy: number | null;
}

interface InFlight {
  job: JobState;
  index: number;
  slot: Slot;
}

/**
 * Priority job queue over a fixed number of warm workers. A job is a list of tasks (one message
 * each, e.g. one chunk of runs); an idle worker always takes the next task of the most urgent job
 * (lowest priority number, then the oldest job), so a new urgent job takes over at the next task
 * boundary without stopping anything. Cancelling a job never terminates a worker: queued tasks
 * are dropped and in-flight answers are discarded when they arrive. Workers are terminated only
 * by `dispose()` (page unload), after a long hide (`setHidden`), or when one crashes.
 */
export class Scheduler {
  readonly size: number;
  private readonly slots: Slot[] = [];
  /** Jobs that still have tasks to dispatch, in submission order. */
  private readonly queue: JobState[] = [];
  private readonly inFlight = new Map<number, InFlight>();
  private nextJobId = 1;
  private nextMessageId = 1;
  private parked = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    size: number,
    private readonly spawn: () => WorkerLike,
  ) {
    this.size = Math.max(1, Math.floor(size));
  }

  /** Live workers (busy or idle). */
  get workerCount(): number {
    return this.slots.length;
  }

  /** Queue a job. Resolves with the final response of every task, in task order. */
  submit(spec: JobSpec): Job<WorkerResponse[]> {
    let resolve!: (r: WorkerResponse[]) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<WorkerResponse[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const job: JobState = {
      id: this.nextJobId++,
      priority: spec.priority,
      spec,
      next: 0,
      results: [],
      remaining: spec.tasks.length,
      settled: false,
      resolve,
      reject,
    };
    if (job.remaining === 0) {
      job.settled = true;
      resolve([]);
    } else {
      this.queue.push(job);
      this.pump();
    }
    return { id: job.id, priority: job.priority, promise, cancel: () => this.cancelJob(job) };
  }

  /**
   * Every run of `config` as one job of small chunks (`splitRuns`). Resolves with the summaries in
   * run order, so the result does not depend on the chunk size, the worker count or which chunk
   * finished first.
   */
  submitRuns(
    config: ScenarioConfig | FreeConfig,
    priority: Priority,
    onProgress: (p: PoolProgress) => void,
  ): Job<(RunSummary | FreeRunSummary)[]> {
    const chunks = splitRuns(config.runs, this.size);
    const chunkDone = chunks.map(() => 0);
    let completedRuns = 0;
    let lastReport = 0;
    const startedAt = performance.now();
    const report = (force: boolean): void => {
      const now = performance.now();
      if (!force && now - lastReport < PROGRESS_THROTTLE_MS) return;
      lastReport = now;
      let done = completedRuns;
      for (const d of chunkDone) done += d;
      const total = config.runs;
      const elapsedMs = now - startedAt;
      onProgress({ done, total, elapsedMs, etaMs: estimateRemainingMs(done, total, elapsedMs) });
    };
    const job = this.submit({
      priority,
      tasks: chunks.map((range): TaskRequest => (id) => ({
        msg: { type: 'run', jobId: id, config, start: range.start, end: range.end },
      })),
      onProgress: (i, done) => {
        chunkDone[i] = done;
        report(false);
      },
      onResult: (i, msg) => {
        const range = chunks[i];
        if (msg.type !== 'result' || !range) return;
        chunkDone[i] = 0;
        completedRuns += range.end - range.start;
        if (completedRuns < config.runs) report(false);
      },
    });
    const promise = job.promise.then((results) => {
      report(true);
      const summaries: (RunSummary | FreeRunSummary)[] = [];
      for (const r of results)
        if (r.type === 'result') for (const s of r.summaries) summaries.push(s);
      return summaries;
    });
    return { id: job.id, priority, promise, cancel: job.cancel };
  }

  /**
   * Start or stop the hide clock. After `HIDE_RELEASE_MS` hidden, idle workers are terminated and
   * busy ones as soon as they go idle with nothing queued. Becoming visible keeps the rest warm.
   */
  setHidden(hidden: boolean): void {
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    if (!hidden) {
      this.parked = false;
      return;
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.parked = true;
      this.releaseIdle();
    }, HIDE_RELEASE_MS);
  }

  /** Cancel every job and terminate every worker (page unload). */
  dispose(): void {
    for (const job of [...this.queue]) this.cancelJob(job);
    for (const { job } of this.inFlight.values()) this.cancelJob(job);
    this.inFlight.clear();
    for (const slot of this.slots) slot.worker.terminate();
    this.slots.length = 0;
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private cancelJob(job: JobState): void {
    if (job.settled) return;
    this.settle(job);
    job.reject(new CancelledError());
  }

  /** Mark settled and drop the job's queued tasks; in-flight ones finish and are ignored. */
  private settle(job: JobState): void {
    job.settled = true;
    const i = this.queue.indexOf(job);
    if (i >= 0) this.queue.splice(i, 1);
  }

  /** The most urgent job with a task left: lowest priority number, then the oldest. */
  private pick(): JobState | undefined {
    let best: JobState | undefined;
    for (const job of this.queue) if (!best || job.priority < best.priority) best = job;
    return best;
  }

  /** Hand tasks to idle workers (spawning up to `size`) until no task or no worker is left. */
  private pump(): void {
    for (;;) {
      const job = this.pick();
      if (!job) break;
      const slot = this.slots.find((s) => s.busy === null) ?? this.addSlot();
      if (!slot) break;
      const index = job.next++;
      if (job.next >= job.spec.tasks.length) this.queue.splice(this.queue.indexOf(job), 1);
      const task = job.spec.tasks[index];
      if (!task) continue;
      const id = this.nextMessageId++;
      slot.busy = id;
      this.inFlight.set(id, { job, index, slot });
      const { msg, transfer } = task(id);
      if (transfer) slot.worker.postMessage(msg, transfer);
      else slot.worker.postMessage(msg);
    }
    if (this.parked) this.releaseIdle();
  }

  private addSlot(): Slot | undefined {
    if (this.slots.length >= this.size) return undefined;
    const slot: Slot = { worker: this.spawn(), busy: null };
    slot.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(slot, e.data);
    slot.worker.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      this.onCrash(slot, new Error(e.message || 'worker failed to start'));
    };
    this.slots.push(slot);
    return slot;
  }

  private onMessage(slot: Slot, msg: WorkerResponse): void {
    const entry = this.inFlight.get(msg.jobId);
    if (!entry || entry.slot !== slot) return;
    const { job, index } = entry;
    if (msg.type === 'progress') {
      if (!job.settled) job.spec.onProgress?.(index, msg.done);
      return;
    }
    this.inFlight.delete(msg.jobId);
    slot.busy = null;
    if (!job.settled) {
      if (msg.type === 'error') {
        this.settle(job);
        job.reject(new Error(msg.message));
      } else {
        job.results[index] = msg;
        if (--job.remaining === 0) {
          job.settled = true;
          job.resolve(job.results);
        }
        try {
          job.spec.onResult?.(index, msg);
        } finally {
          this.pump();
        }
        return;
      }
    }
    this.pump();
  }

  /** A crashed worker is the one case besides unload and hide that ends a worker. */
  private onCrash(slot: Slot, err: Error): void {
    const i = this.slots.indexOf(slot);
    if (i < 0) return;
    this.slots.splice(i, 1);
    slot.worker.terminate();
    const entry = slot.busy === null ? undefined : this.inFlight.get(slot.busy);
    if (slot.busy !== null) this.inFlight.delete(slot.busy);
    slot.busy = null;
    if (entry && !entry.job.settled) {
      this.settle(entry.job);
      entry.job.reject(err);
    }
    this.pump();
  }

  private releaseIdle(): void {
    if (this.queue.length > 0) return;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot?.busy !== null) continue;
      slot.worker.terminate();
      this.slots.splice(i, 1);
    }
  }
}
