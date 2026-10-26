import { sanitizeConfig, type ScenarioConfig } from '../sim/config';
import { simulateBattle } from '../sim/engine';
import type { FreeConfig } from '../sim/free/config';
import { simulateFreeBattle } from '../sim/free/engine';
import { aggregate, runChunk, unpackSummaries } from '../sim/montecarlo';
import { buildDesign, designRow, type Design } from '../sim/sampling';
import { sanitizeFreeConfig } from '../sim/free/config';
import { buildFreeDesign } from '../sim/free/design';
import { runFreeChunk, unpackFreeSummaries } from '../sim/free/montecarlo';
import { aggregateFree } from '../sim/free/aggregate';
import {
  freeTraceTransferList,
  traceTransferList,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol';

// tsconfig `lib` is DOM-only, so type the worker global locally.
const ctx = self as unknown as {
  postMessage(msg: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};

const PROGRESS_INTERVAL_MS = 100;

// The design only depends on the config, so it is rebuilt once per scenario, not per chunk.
let cachedKey = '';
let cachedDesign: Design | null = null;

function designFor(config: ScenarioConfig): Design {
  const key = JSON.stringify(config);
  if (cachedDesign === null || key !== cachedKey) {
    cachedDesign = buildDesign(config);
    cachedKey = key;
  }
  return cachedDesign;
}

let cachedFreeKey = '';
let cachedFreeDesign: Design | null = null;

function freeDesignFor(config: FreeConfig): Design {
  const key = JSON.stringify(config);
  if (cachedFreeDesign === null || key !== cachedFreeKey) {
    cachedFreeDesign = buildFreeDesign(config);
    cachedFreeKey = key;
  }
  return cachedFreeDesign;
}

/** A free-model run chunk (`mode: 'free'`), sanitized like every other payload. */
function handleFree(msg: Extract<WorkerRequest, { type: 'run' }>): void {
  const config = sanitizeFreeConfig(msg.config);
  const design = freeDesignFor(config);
  const start = Math.max(0, Math.min(config.runs, Math.floor(msg.start)));
  const end = Math.max(start, Math.min(config.runs, Math.floor(msg.end)));
  let last = performance.now();
  const summaries = runFreeChunk(config, design, start, end, (done) => {
    const now = performance.now();
    if (now - last >= PROGRESS_INTERVAL_MS) {
      last = now;
      ctx.postMessage({ type: 'progress', jobId: msg.jobId, done });
    }
  });
  ctx.postMessage({ type: 'result', jobId: msg.jobId, summaries });
}

const isFreePayload = (c: unknown): boolean =>
  typeof c === 'object' && c !== null && (c as { mode?: unknown }).mode === 'free';

function handle(msg: WorkerRequest): void {
  if (msg.type === 'aggregate-free') {
    // Off the main thread, like the legacy aggregate (#24).
    const config = sanitizeFreeConfig(msg.config);
    const agg = aggregateFree(config, unpackFreeSummaries(msg.summaries));
    ctx.postMessage({ type: 'aggregate-free', jobId: msg.jobId, agg });
    return;
  }
  if (msg.type === 'replay-free') {
    const config = sanitizeFreeConfig(msg.config);
    const run = Math.max(0, Math.min(config.runs - 1, Math.floor(msg.run)));
    const { trace } = simulateFreeBattle(config, designRow(freeDesignFor(config), run), run, true);
    if (!trace) throw new Error('engine returned no trace');
    ctx.postMessage({ type: 'replay-free', jobId: msg.jobId, trace }, freeTraceTransferList(trace));
    return;
  }
  if (msg.type === 'run' && isFreePayload(msg.config)) {
    handleFree(msg);
    return;
  }
  // Never trust the payload: the config may originate from a shared URL.
  const config = sanitizeConfig(msg.config);
  const design = designFor(config);
  if (msg.type === 'run') {
    const start = Math.max(0, Math.min(config.runs, Math.floor(msg.start)));
    const end = Math.max(start, Math.min(config.runs, Math.floor(msg.end)));
    let last = performance.now();
    const summaries = runChunk(config, design, start, end, (done) => {
      const now = performance.now();
      if (now - last >= PROGRESS_INTERVAL_MS) {
        last = now;
        ctx.postMessage({ type: 'progress', jobId: msg.jobId, done });
      }
    });
    ctx.postMessage({ type: 'result', jobId: msg.jobId, summaries });
    return;
  }
  if (msg.type === 'aggregate') {
    // Off the main thread: at 20,000 runs the Spearman sensitivities alone take hundreds of ms.
    const agg = aggregate(config, design, unpackSummaries(msg.summaries));
    ctx.postMessage({ type: 'aggregate', jobId: msg.jobId, agg });
    return;
  }
  const run = Math.max(0, Math.min(config.runs - 1, Math.floor(msg.run)));
  const { trace } = simulateBattle(config, designRow(design, run), run, true);
  if (!trace) throw new Error('engine returned no trace');
  ctx.postMessage({ type: 'replay', jobId: msg.jobId, trace }, traceTransferList(trace));
}

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    handle(msg);
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      jobId: typeof msg.jobId === 'number' ? msg.jobId : -1,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
