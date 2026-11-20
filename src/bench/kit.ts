import { fmtHistMs as fmtMs } from '../../bench/history.mjs';
import { percentile } from '../../bench/matrix.mjs';
import { RESIM_LIMIT_MS, resimGate } from '../ui/live-gates';
import { PAUSE_WINDOW, cardTick } from '../ui/live-model';

export { fmtMs };

/**
 * Pure half of the live benchmark kit (`/bench/`, #191, docs/PERFORMANCE.md "Live benchmark"):
 * the statistics, the gate verdicts, the card ticks of the re-simulations and the report the page
 * copies as JSON. The page (src/bench/main.ts) and its worker only measure; every decision here
 * is tested without a clock (tests/bench-kit.test.ts).
 */

/** Re-simulations per preset after the live run (K). */
export const RESIMS = 8;

/** The card every re-simulation plays: accuracy × 1.2 for 20 s on side A, in every model. */
export const RESIM_CARD = 'focus';

/** p50, p95 and the largest value of a sample; NaN for an empty one. */
export interface Quantiles {
  p50: number;
  p95: number;
  max: number;
}

export function quantiles(xs: readonly number[]): Quantiles {
  const sorted = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.length === 0 ? NaN : (sorted[sorted.length - 1] as number),
  };
}

/**
 * Card ticks of the K re-simulations: K points spread evenly over the pause window of Live
 * battle mode (`PAUSE_WINDOW` of the live run's duration), each turned into a tick the way a
 * picked card is (`cardTick`). One point sits in the middle of the window when K is 1.
 */
export function resimTicks(durationS: number, k: number = RESIMS): number[] {
  const n = Math.max(0, Math.floor(k));
  const d = Number.isFinite(durationS) && durationS > 0 ? durationS : 0;
  const [lo, hi] = PAUSE_WINDOW;
  return Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1);
    return cardTick(f * d);
  });
}

/**
 * Verdict of one preset. Gate (a) is decided by the live run's own cost (`resimGate`, §10.2
 * point 5); the M3 budget (§10.5) asks that a preset passing it re-simulates within 500 ms at p95.
 * A preset that fails the gate falls back to pre-battle cards, so the budget does not apply.
 */
export interface LiveVerdict {
  gate: 'pass' | 'fail';
  resim: Quantiles;
  /** p95 ≤ 500 ms for a preset that passes the gate; null when the gate fails. */
  withinBudget: boolean | null;
}

export function liveVerdict(liveSimMs: number, resimMs: readonly number[]): LiveVerdict {
  const resim = quantiles(resimMs);
  const gate = resimGate(liveSimMs) ? 'pass' : 'fail';
  return {
    gate,
    resim,
    withinBudget:
      gate === 'pass' ? Number.isFinite(resim.p95) && resim.p95 <= RESIM_LIMIT_MS : null,
  };
}

/** One preset's measurements in one pass. Times in ms. */
export interface PresetResult {
  id: string;
  agents: number;
  liveSimMs: number;
  /** Battle seconds of the live run. */
  durationS: number;
  ticks: number[];
  resimMs: number[];
  verdict: LiveVerdict;
  batch: BatchResult;
}

/** The preset's Simple batch over the batch workers. */
export interface BatchResult {
  runs: number;
  workers: number;
  /** Median and p95 of the per-run times on one worker (gate (b)'s `msPerRun`). */
  msPerRun: number;
  msPerRunP95: number;
  /** Wall time from the first chunk sent to the last result back. */
  wallMs: number;
}

export function batchResult(
  times: readonly number[],
  workers: number,
  wallMs: number,
): BatchResult {
  const q = quantiles(times);
  return { runs: times.length, workers, msPerRun: q.p50, msPerRunP95: q.p95, wallMs };
}

/** Whether every preset that passes gate (a) re-simulates within the budget (M3 acceptance). */
export function passAccepted(presets: readonly PresetResult[]): boolean {
  return presets.every((p) => p.verdict.withinBudget !== false);
}

/**
 * OBS load factor per preset (§10.7 `c_obs`): batch ms/run with OBS running ÷ without, and its
 * median over the presets both passes measured. Null when either pass is missing.
 */
export function obsFactor(
  plain: readonly PresetResult[],
  obs: readonly PresetResult[] | null,
): { median: number; byPreset: Record<string, number> } | null {
  if (!obs || obs.length === 0 || plain.length === 0) return null;
  const base = new Map(plain.map((p) => [p.id, p.batch.msPerRun]));
  const byPreset: Record<string, number> = {};
  for (const p of obs) {
    const b = base.get(p.id);
    if (b !== undefined && b > 0 && Number.isFinite(p.batch.msPerRun)) {
      byPreset[p.id] = p.batch.msPerRun / b;
    }
  }
  const ratios = Object.values(byPreset);
  if (ratios.length === 0) return null;
  return { median: quantiles(ratios).p50, byPreset };
}

/** What the page can say about the device; nothing here identifies a person. */
export interface DeviceInfo {
  cores: number | null;
  /** `navigator.deviceMemory` in GB (Chromium only, rounded by the browser), else null. */
  memoryGb: number | null;
  userAgent: string;
}

/** "Chrome 156", "Firefox 140", "Safari 19", "Edge 156" or "browser" from a user agent. */
export function browserOf(ua: string): string {
  const pick = (re: RegExp, name: string): string | null => {
    const m = re.exec(ua);
    return m ? `${name} ${m[1]}` : null;
  };
  return (
    pick(/Edg\/(\d+)/, 'Edge') ??
    pick(/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox') ??
    pick(/(?:Chrome|CriOS)\/(\d+)/, 'Chrome') ??
    pick(/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//, 'Safari') ??
    'browser'
  );
}

/** "Windows", "Android", "iOS", "macOS", "Linux" or "?" from a user agent. */
export function platformOf(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return '?';
}

/** "8 cores, 8 GB, Chrome 156 on Windows" (memory left out when the browser does not say). */
export function deviceLabel(d: DeviceInfo): string {
  const parts = [d.cores === null ? '? cores' : `${d.cores} cores`];
  if (d.memoryGb !== null) parts.push(`${d.memoryGb} GB`);
  parts.push(`${browserOf(d.userAgent)} on ${platformOf(d.userAgent)}`);
  return parts.join(', ');
}

/** One scenario of the reduced matrix, as `npm run bench -- --reduced` reports it. */
export interface MatrixResult {
  id: string;
  group: 'scale' | 'preset' | 'species';
  flight: 'allIn' | 'realistic';
  runs: number;
  msMedian: number;
  msP95: number;
  hash: string | null;
}

/** One pass of the page: every preset, with or without OBS running. */
export interface PassResult {
  obs: boolean;
  presets: PresetResult[];
  accepted: boolean;
}

/** The JSON the page shows and copies. Nothing is sent anywhere. */
export interface BenchReport {
  kind: 'trex-live-bench';
  version: string;
  build: string;
  date: string;
  device: DeviceInfo;
  /** Batch workers the app would use on this device (`poolSize`). */
  workers: number;
  mv: number;
  seed: number;
  resims: number;
  card: string;
  passes: PassResult[];
  obsFactor: ReturnType<typeof obsFactor>;
  matrix: { scenarios: MatrixResult[]; hash: string | null; totalMs: number } | null;
}

const SCALE_IDS = ['scale-1v1', 'scale-10v100', 'scale-50v1000'] as const;
/** The preset whose Simple batch the release check's Chromium row times. */
export const VERDICT_PRESET = 'elephants-pride';

/**
 * The row for the "Real devices" table of docs/PERFORMANCE.md: version, date, device, workers,
 * the reduced scale ladder, the slowest preset of the matrix, the worst re-simulation p95 among
 * presets that pass gate (a), how many pass, the `elephants-pride` Simple batch wall time, the OBS
 * factor and the reduced matrix hash.
 */
export function deviceRow(r: BenchReport, note = ''): string {
  const plain = r.passes.find((p) => !p.obs);
  const scenarios = r.matrix?.scenarios ?? [];
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const ladder = SCALE_IDS.map((id) => fmtMs(byId.get(id)?.msMedian ?? NaN)).join(' / ');
  const presets = scenarios.filter((s) => s.group === 'preset');
  const slowest = presets.reduce<MatrixResult | null>(
    (a, b) => (a === null || b.msMedian > a.msMedian ? b : a),
    null,
  );
  const slow = slowest
    ? `\`${slowest.id.replace(/^preset-/, '').replace(new RegExp(`-${slowest.flight}$`), '')}\`, ${fmtMs(slowest.msMedian)}`
    : '–';
  const passing = (plain?.presets ?? []).filter((p) => p.verdict.gate === 'pass');
  const worst = passing.reduce<PresetResult | null>(
    (a, b) => (a === null || b.verdict.resim.p95 > a.verdict.resim.p95 ? b : a),
    null,
  );
  const resim = worst ? `${fmtMs(worst.verdict.resim.p95)} (\`${worst.id}\`)` : '–';
  const gate = plain ? `${passing.length} / ${plain.presets.length}` : '–';
  const verdictPreset = plain?.presets.find((p) => p.id === VERDICT_PRESET);
  const cell = (s: string): string => s.replace(/\|/g, '\\|');
  return `| ${[
    r.version,
    r.date.slice(0, 10),
    cell(deviceLabel(r.device)),
    String(r.workers),
    ladder,
    slow,
    resim,
    gate,
    verdictPreset ? fmtMs(verdictPreset.batch.wallMs) : '–',
    r.obsFactor ? r.obsFactor.median.toFixed(2) : '–',
    r.matrix?.hash ? `\`${r.matrix.hash}\`` : '–',
    cell(note),
  ].join(' | ')} |`;
}
