import './bench.css';
import { expandMatrix, matrixHashInput, type Scenario } from '../../bench/matrix.mjs';
import spec from '../../bench/scenarios.json';
import { FREE_MODEL_VERSION } from '../sim/free/config';
import { CARD_IDS } from '../sim/free/cards';
import { FREE_PRESETS, presetConfig, readyPresets, type FreePreset } from '../sim/free/presets';
import { FREE_SPECIES_IDS } from '../sim/free/species';
import { poolSize, splitRuns } from '../ui/chunks';
import { trustedWorkerUrl } from '../ui/pool';
import workerUrl from './bench.worker.ts?worker&url';
import {
  RESIMS,
  RESIM_CARD,
  batchResult,
  deviceRow,
  fmtMs,
  liveVerdict,
  obsFactor,
  passAccepted,
  resimTicks,
  type BenchReport,
  type DeviceInfo,
  type MatrixResult,
  type PassResult,
  type PresetResult,
} from './kit';
import type { BenchCall, BenchRequest, BenchResponse } from './protocol';

/*
 * The live benchmark kit (`/bench/`, #191; docs/PERFORMANCE.md "Live benchmark"). Hidden: noindex,
 * not in the sitemap, linked from nowhere. Start runs every preset (a warm-up, the live run with
 * its trace, then K re-simulations with one card at different ticks, then the preset's Simple
 * batch over the app's worker count) and the reduced matrix of bench/scenarios.json. The page only
 * shows what it measured and copies it as JSON: there is no network call in this file or its
 * worker, and the CSP's `connect-src 'self'` would block one to anywhere else.
 */

const SEED = (spec as { seed: number }).seed;
/** The run every preset plays live: the first of its seeded batch. */
const LIVE_RUN = 0;

type TrustedTypesLike = Parameters<typeof trustedWorkerUrl>[1];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

const device: DeviceInfo = {
  cores: navigator.hardwareConcurrency > 0 ? navigator.hardwareConcurrency : null,
  memoryGb: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
  userAgent: navigator.userAgent,
};
const WORKERS = poolSize(navigator.hardwareConcurrency);

/** One worker that answers one request at a time. */
class BenchWorker {
  private readonly w: Worker;
  private next = 1;
  private waiting = new Map<number, (r: BenchResponse) => void>();

  constructor(url: string) {
    this.w = new Worker(url, { type: 'module' });
    this.w.onmessage = (e: MessageEvent<BenchResponse>) => {
      const done = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      done?.(e.data);
    };
    this.w.onerror = (e) => {
      e.preventDefault();
      const message = e.message || 'worker failed to start';
      for (const [id, done] of this.waiting) done({ type: 'error', id, message });
      this.waiting.clear();
    };
  }

  call<T extends BenchResponse['type']>(
    req: BenchCall,
    want: T,
  ): Promise<Extract<BenchResponse, { type: T }>> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, (r) => {
        if (r.type === want) resolve(r as Extract<BenchResponse, { type: T }>);
        else reject(new Error(r.type === 'error' ? r.message : `unexpected ${r.type}`));
      });
      const msg: BenchRequest = { ...req, id };
      this.w.postMessage(msg);
    });
  }
}

let workers: BenchWorker[] | null = null;
function pool(): BenchWorker[] {
  if (!workers) {
    const url = trustedWorkerUrl(
      workerUrl,
      (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes,
    );
    workers = Array.from({ length: WORKERS }, () => new BenchWorker(url));
  }
  return workers;
}

// ---------- DOM ----------

const status = $('bench-status') as HTMLParagraphElement;
const startBtn = $('bench-start') as HTMLButtonElement;
const obsBox = $('bench-obs') as HTMLInputElement;
const matrixBox = $('bench-matrix') as HTMLInputElement;
const obsStep = $('bench-obs-step');
const obsBtn = $('bench-obs-run') as HTMLButtonElement;
const presetBody = $('bench-presets') as HTMLTableSectionElement;
const matrixBody = $('bench-matrix-rows') as HTMLTableSectionElement;
const matrixHashEl = $('bench-matrix-hash');
const verdictEl = $('bench-verdict') as HTMLParagraphElement;
const output = $('bench-output');
const jsonBox = $('bench-json') as HTMLTextAreaElement;
const rowBox = $('bench-row');
const copyBtn = $('bench-copy') as HTMLButtonElement;
const copied = $('bench-copied');

function cell(tr: HTMLTableRowElement, text: string, cls?: string): void {
  const td = document.createElement('td');
  td.textContent = text;
  if (cls) td.className = cls;
  tr.append(td);
}

function fillDevice(): void {
  $('bench-cores').textContent = device.cores === null ? '?' : String(device.cores);
  $('bench-memory').textContent = device.memoryGb === null ? '–' : `${device.memoryGb} GB`;
  $('bench-ua').textContent = device.userAgent;
  $('bench-workers').textContent = String(WORKERS);
  $('bench-build').textContent =
    `${__APP_VERSION__} (${__BUILD_SHA__.slice(0, 7)}), model ${FREE_MODEL_VERSION}`;
}

const say = (text: string): void => {
  status.textContent = text;
};

function presetRow(p: PresetResult, obs: boolean): void {
  const tr = document.createElement('tr');
  const v = p.verdict;
  cell(tr, p.id);
  cell(tr, obs ? 'OBS' : '–');
  cell(tr, String(p.agents), 'num');
  cell(tr, fmtMs(p.liveSimMs), 'num');
  cell(tr, fmtMs(v.resim.p50), 'num');
  cell(tr, fmtMs(v.resim.p95), 'num');
  cell(tr, v.gate === 'pass' ? '통과 pass' : '실패 fail', v.gate);
  cell(
    tr,
    v.withinBudget === null ? '–' : v.withinBudget ? '예 yes' : '아니오 no',
    v.withinBudget === false ? 'fail' : '',
  );
  cell(tr, String(p.batch.runs), 'num');
  cell(tr, fmtMs(p.batch.msPerRun), 'num');
  cell(tr, fmtMs(p.batch.wallMs), 'num');
  cell(tr, String(p.batch.workers), 'num');
  presetBody.append(tr);
}

function matrixRow(m: MatrixResult): void {
  const tr = document.createElement('tr');
  cell(tr, m.id);
  cell(tr, String(m.runs), 'num');
  cell(tr, fmtMs(m.msMedian), 'num');
  cell(tr, fmtMs(m.msP95), 'num');
  cell(tr, m.hash ?? '–', 'hash');
  matrixBody.append(tr);
}

// ---------- measuring ----------

async function sha16(data: BufferSource): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = new Uint8Array(await subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

async function measurePreset(p: FreePreset, index: number, total: number): Promise<PresetResult> {
  const ws = pool();
  const live = ws[0] as BenchWorker;
  const label = `${index + 1}/${total} ${p.id}`;
  const focus = CARD_IDS.indexOf(RESIM_CARD);
  const base = { type: 'live', preset: p.id, seed: SEED, run: LIVE_RUN } as const;

  say(`${label}: 준비 · warm-up`);
  await live.call({ ...base, interventions: [] }, 'live');
  say(`${label}: 라이브 실행 · live run`);
  const first = await live.call({ ...base, interventions: [] }, 'live');
  const ticks = resimTicks(first.durationS);
  const resimMs: number[] = [];
  for (const [i, tick] of ticks.entries()) {
    say(`${label}: 재시뮬레이션 · re-simulation ${i + 1}/${ticks.length}`);
    const r = await live.call({ ...base, interventions: [{ tick, card: focus, side: 0 }] }, 'live');
    resimMs.push(r.ms);
  }

  const runs = presetConfig(p, SEED).runs;
  say(`${label}: 배치 · batch, ${runs} runs × ${ws.length} workers`);
  const queue = splitRuns(runs, ws.length);
  const times: number[] = [];
  const t0 = performance.now();
  await Promise.all(
    ws.map(async (w) => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const r = await w.call(
          { type: 'batch', preset: p.id, seed: SEED, start: c.start, end: c.end },
          'batch',
        );
        times.push(...r.times);
      }
    }),
  );
  const wallMs = performance.now() - t0;

  return {
    id: p.id,
    agents: p.a.n + p.b.n,
    liveSimMs: first.ms,
    durationS: first.durationS,
    ticks,
    resimMs,
    verdict: liveVerdict(first.ms, resimMs),
    batch: batchResult(times, ws.length, wallMs),
  };
}

async function runPass(obs: boolean): Promise<PassResult> {
  const ws = pool();
  say('워커 준비 · warming up the workers');
  await Promise.all(ws.map((w) => w.call({ type: 'warm' }, 'warm')));
  const presets = readyPresets();
  const out: PresetResult[] = [];
  for (const [i, p] of presets.entries()) {
    const r = await measurePreset(p, i, presets.length);
    out.push(r);
    presetRow(r, obs);
  }
  return { obs, presets: out, accepted: passAccepted(out) };
}

async function runMatrix(): Promise<NonNullable<BenchReport['matrix']>> {
  const w = pool()[0] as BenchWorker;
  const matrix: Scenario[] = expandMatrix(
    spec,
    { FREE_PRESETS, FREE_SPECIES_IDS },
    { reduced: true },
  );
  const minMs = (spec as { reduced: { minMs: number } }).reduced.minMs;
  const results: MatrixResult[] = [];
  const t0 = performance.now();
  for (const [i, s] of matrix.entries()) {
    say(`행렬 · matrix ${i + 1}/${matrix.length} ${s.id}`);
    const r = await w.call({ type: 'scenario', scenario: s, minMs }, 'scenario');
    const hash = r.consistent ? await sha16(r.packed) : null;
    const m: MatrixResult = {
      id: s.id,
      group: s.group,
      flight: s.flight,
      runs: r.runs,
      msMedian: r.msMedian,
      msP95: r.msP95,
      hash,
    };
    results.push(m);
    matrixRow(m);
  }
  const all = results.every((r) => r.hash !== null);
  const hash = all
    ? await sha16(
        new TextEncoder().encode(matrixHashInput(results as { id: string; hash: string }[])),
      )
    : null;
  matrixHashEl.textContent = hash ?? '–';
  return { scenarios: results, hash, totalMs: performance.now() - t0 };
}

// ---------- report ----------

const passes: PassResult[] = [];
let matrix: BenchReport['matrix'] = null;

function report(): BenchReport {
  const plain = passes.find((p) => !p.obs);
  const obs = passes.find((p) => p.obs) ?? null;
  return {
    kind: 'trex-live-bench',
    version: __APP_VERSION__,
    build: __BUILD_SHA__,
    date: new Date().toISOString(),
    device,
    workers: WORKERS,
    mv: FREE_MODEL_VERSION,
    seed: SEED,
    resims: RESIMS,
    card: RESIM_CARD,
    passes,
    obsFactor: plain ? obsFactor(plain.presets, obs?.presets ?? null) : null,
    matrix,
  };
}

function showReport(): void {
  const r = report();
  const lines = r.passes.map((p) => {
    const passing = p.presets.filter((x) => x.verdict.gate === 'pass').length;
    return `${p.obs ? 'OBS' : '기본 · plain'}: ${passing}/${p.presets.length} 게이트 (a) 통과 · pass gate (a); ${
      p.accepted
        ? '통과한 프리셋 모두 p95 ≤ 500 ms · every passing preset within 500 ms at p95'
        : '500 ms 초과 있음 · some passing preset over 500 ms at p95'
    }`;
  });
  if (r.obsFactor) lines.push(`OBS factor (c_obs) ${r.obsFactor.median.toFixed(2)}`);
  verdictEl.textContent = lines.join(' · ');
  jsonBox.value = `${JSON.stringify(r, null, 2)}\n`;
  rowBox.textContent = deviceRow(r);
  output.hidden = false;
}

async function start(): Promise<void> {
  startBtn.disabled = true;
  obsBox.disabled = true;
  matrixBox.disabled = true;
  passes.length = 0;
  presetBody.replaceChildren();
  matrixBody.replaceChildren();
  matrix = null;
  try {
    passes.push(await runPass(false));
    if (matrixBox.checked) matrix = await runMatrix();
    showReport();
    if (obsBox.checked) {
      say('OBS를 켠 뒤 아래 버튼을 누르세요 · Start OBS, then press the button below');
      obsStep.hidden = false;
      obsBtn.focus();
      return;
    }
    say('끝 · Done');
  } catch (e) {
    say(`오류 · Error: ${String(e)}`);
  }
  startBtn.disabled = false;
  obsBox.disabled = false;
  matrixBox.disabled = false;
}

async function startObs(): Promise<void> {
  obsBtn.disabled = true;
  try {
    passes.push(await runPass(true));
    showReport();
    say('끝 · Done');
  } catch (e) {
    say(`오류 · Error: ${String(e)}`);
  }
  obsStep.hidden = true;
  obsBtn.disabled = false;
  startBtn.disabled = false;
  obsBox.disabled = false;
  matrixBox.disabled = false;
}

async function copyJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(jsonBox.value);
    copied.textContent = '복사했습니다 · Copied';
  } catch {
    jsonBox.focus();
    jsonBox.select();
    copied.textContent = '선택했습니다. Ctrl+C로 복사하세요 · Selected: press Ctrl+C to copy';
  }
}

fillDevice();
startBtn.addEventListener('click', () => void start());
obsBtn.addEventListener('click', () => void startObs());
copyBtn.addEventListener('click', () => void copyJson());
