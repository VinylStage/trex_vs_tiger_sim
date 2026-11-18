// Engine benchmark of the standing performance checks (docs/PERFORMANCE.md, "Standing
// performance checks").
//
//   npm run bench [-- --reduced] [--only <text>] [--out <file.json>] [--baseline] [--check]
//
// Runs every scenario of bench/scenarios.json on this checkout's free engine, one core, and
// prints ms/run (median, p95), agent-steps per second and a hash of the results per scenario.
// The JSON goes to bench/last-run.json (ignored by git) unless `--out` names another file.
//
//   --repeat N   run the whole matrix N times and keep each scenario's median over the passes
//                (the committed baseline uses 3; one pass of the full matrix shows up to about
//                1.8x between passes on the cheapest scenarios)
//   --reduced    the CI matrix (`reduced` in scenarios.json) instead of the full one
//   --only       only scenarios whose id contains the text (for refreshing one budget)
//   --baseline   also write bench/baseline-v<package version>.json; refuses to overwrite one
//   --check      exit 1 when a scenario's median or p95 is over its ceiling in bench/budgets.json
//                (ceilings are for the reference machine the baseline was measured on)

import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, exit, stdout, version as nodeVersion } from 'node:process';
import {
  BENCH_DIR,
  ROOT,
  expandMatrix,
  fmtMs,
  fmtRate,
  loadSim,
  matrixHash,
  measure,
  median,
  readJson,
  warmUp,
} from './lib.mjs';

const args = argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REDUCED = flag('--reduced');
const REPEAT = Math.max(1, Number(option('--repeat') ?? 1));
const ONLY = option('--only');
const OUT = option('--out') ?? path.join(BENCH_DIR, 'last-run.json');
const pkg = readJson(path.join(ROOT, 'package.json'));
const BASELINE = path.join(BENCH_DIR, `baseline-v${pkg.version}.json`);
if (flag('--baseline') && (REDUCED || ONLY)) throw new Error('a baseline is the full matrix');
if (flag('--baseline') && existsSync(BASELINE)) {
  throw new Error(`${path.relative(ROOT, BASELINE)} exists; baselines are never overwritten`);
}

const spec = readJson(path.join(BENCH_DIR, 'scenarios.json'));
const { sim } = await loadSim();
let matrix = expandMatrix(spec, sim, { reduced: REDUCED });
if (ONLY) matrix = matrix.filter((s) => s.id.includes(ONLY));
const minMs = REDUCED ? spec.reduced.minMs : 0;

const log = (line) => stdout.write(`${line}\n`);
const row = (cells) =>
  log(
    `${cells[0].padEnd(42)} ${cells[1].padStart(5)} ${cells[2].padStart(9)} ${cells[3].padStart(9)} ${cells[4].padStart(10)}  ${cells[5]}`,
  );

const started = Date.now();
warmUp(sim, spec, matrix);
const passes = [];
for (let pass = 0; pass < REPEAT; pass++) {
  if (REPEAT > 1) log(`pass ${pass + 1} of ${REPEAT}`);
  passes.push(matrix.map((s) => measure(sim, spec, s, { minMs })));
}
row(['scenario', 'runs', 'ms med', 'ms p95', 'steps/s', 'hash']);
const results = matrix.map((s, i) => {
  const got = passes.map((p) => p[i]);
  if (new Set(got.map((r) => r.hash)).size !== 1) throw new Error(`${s.id}: passes disagree`);
  const pick = (k) => median(got.map((r) => r[k]));
  const r = {
    ...got[0],
    msMedian: pick('msMedian'),
    msP95: pick('msP95'),
    msMean: pick('msMean'),
    agentStepsPerSec: pick('agentStepsPerSec'),
  };
  row([
    r.id,
    String(r.runs),
    fmtMs(r.msMedian),
    fmtMs(r.msP95),
    fmtRate(r.agentStepsPerSec),
    r.hash,
  ]);
  return { ...r, group: s.group, a: s.a, na: s.na, b: s.b, nb: s.nb, flight: s.flight };
});
const totalMs = Date.now() - started;

let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // not a git checkout
}

const report = {
  version: pkg.version,
  commit,
  date: new Date().toISOString(),
  node: nodeVersion,
  cpu: `${cpus().length} x ${cpus()[0]?.model ?? 'unknown'}`,
  matrix: REDUCED ? 'reduced' : 'full',
  passes: REPEAT,
  only: ONLY ?? null,
  seed: spec.seed,
  mv: sim.FREE_MODEL_VERSION,
  totalMs,
  hash: matrixHash(results),
  results,
};
const json = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(OUT, json);
log(
  `\n${results.length} scenarios in ${(totalMs / 1000).toFixed(1)} s, results hash ${report.hash}`,
);
log(`wrote ${path.relative(ROOT, OUT)}`);
if (flag('--baseline')) {
  writeFileSync(BASELINE, json);
  log(`wrote ${path.relative(ROOT, BASELINE)}`);
}

if (flag('--check')) {
  const budgets = readJson(path.join(BENCH_DIR, 'budgets.json'));
  const over = results.filter((r) => {
    const b = budgets.scenarios[r.id];
    return b !== undefined && (r.msMedian > b.msMedian || r.msP95 > b.msP95);
  });
  const unlisted = results.filter((r) => budgets.scenarios[r.id] === undefined);
  for (const r of unlisted) log(`no budget: ${r.id}`);
  for (const r of over) {
    const b = budgets.scenarios[r.id];
    log(
      `over budget: ${r.id} median ${fmtMs(r.msMedian)} (ceiling ${fmtMs(b.msMedian)}) p95 ${fmtMs(r.msP95)} (ceiling ${fmtMs(b.msP95)})`,
    );
  }
  if (over.length > 0) exit(1);
  log('every listed scenario is within its ceiling');
}
