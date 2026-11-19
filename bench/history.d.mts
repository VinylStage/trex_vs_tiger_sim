// Types for history.mjs, so tests/bench.test.ts type-checks without allowJs.

export interface BenchResult {
  id: string;
  group: 'scale' | 'preset' | 'species';
  flight: 'allIn' | 'realistic';
  msMedian: number;
  msP95: number;
}

export interface BenchRun {
  version: string;
  commit: string;
  date: string;
  node: string;
  cpu: string;
  matrix: 'full' | 'reduced';
  passes: number;
  only: string | null;
  mv: number;
  totalMs: number;
  hash: string;
  results: BenchResult[];
}

export interface SizeRun {
  pages: { page: string; gzipBytes: number; budget: number | null; status: string }[];
}

export interface BrowserRun {
  version: string;
  date: string;
  browser: string;
  samples: number;
  run: {
    preset: string;
    verdictMs: number;
    longTaskCount: number;
    longTaskTotalMs: number;
    longestTaskMs: number;
  };
  cls: { desktop: number; mobile: number };
  startup: { page: string; longTaskCount: number; longTaskTotalMs: number; longestTaskMs: number };
  replay: { preset: string; x1P95Ms: number; x16P95Ms: number; x1MaxMs: number; x16MaxMs: number };
}

export function fmtHistMs(x: number): string;
export function fmtHistKb(bytes: number): string;
export function machineOf(cpu: string, node: string): string;
export function slowestPreset(results: readonly BenchResult[]): string;
export function engineRow(
  bench: BenchRun,
  size: SizeRun | null,
  options?: { commit?: string; note?: string },
): string;
export function browserRow(
  browser: BrowserRun,
  options?: { version?: string; note?: string },
): string;
export function releaseSummary(input: {
  bench: BenchRun;
  size: SizeRun | null;
  browser: BrowserRun | null;
  commit?: string;
  note?: string;
}): string;
