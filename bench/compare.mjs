// Base-against-head comparison of the CI perf job (.github/workflows/perf.yml,
// docs/PERFORMANCE.md "Standing performance checks").
//
//   node bench/compare.mjs --base <checkout> [--dist <dir>] [--summary <file.md>] [--out <file.json>]
//
// Bundles the free engine of the base checkout and of this checkout with the same harness and
// runs the reduced matrix of bench/scenarios.json on both in one process, alternating which goes
// first each round, so a slow moment of the runner hits both. A scenario fails when the median
// over rounds of (head ms/run ÷ base ms/run) is above `reduced.regressionLimit`, scaled by how
// much this pull request raised that scenario's ceiling in bench/budgets.json: an intended
// slowdown passes by raising the ceiling in the same pull request. With `--dist` it also checks
// every built page's startup JavaScript against its budget. Exit 1 on any failure.

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, env, exit, stdout } from 'node:process';
import {
  BENCH_DIR,
  ROOT,
  checkPages,
  expandMatrix,
  fmtKb,
  fmtMs,
  loadSim,
  measure,
  median,
  pageSizes,
  readJson,
  warmUp,
} from './lib.mjs';

const args = argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = option('--base');
const DIST = option('--dist');
const SUMMARY = option('--summary') ?? env.GITHUB_STEP_SUMMARY;
const OUT = option('--out');
if (!BASE) throw new Error('--base <checkout> is required');

const log = (line) => stdout.write(`${line}\n`);
const spec = readJson(path.join(BENCH_DIR, 'scenarios.json'));
const R = spec.reduced;
const headBudgets = readJson(path.join(BENCH_DIR, 'budgets.json'));
const baseBudgetsFile = path.join(BASE, 'bench', 'budgets.json');
const baseBudgets = existsSync(baseBudgetsFile) ? readJson(baseBudgetsFile) : null;

const md = [];
const failures = [];
const notes = [];
const started = Date.now();

// --- engine ---

const head = await loadSim(ROOT, 'head');
let base = null;
try {
  base = await loadSim(path.resolve(BASE), 'base');
} catch (e) {
  notes.push(
    `The base engine could not be bundled with this harness (${String(e.message).split('\n')[0]}); the engine comparison is skipped.`,
  );
}

const rows = [];
if (base) {
  const headMatrix = expandMatrix(spec, head.sim, { reduced: true });
  const baseIds = new Set(expandMatrix(spec, base.sim, { reduced: true }).map((s) => s.id));
  const matrix = headMatrix.filter((s) => baseIds.has(s.id));
  for (const s of headMatrix) if (!baseIds.has(s.id)) notes.push(`New scenario, no base: ${s.id}`);

  warmUp(base.sim, spec, matrix);
  warmUp(head.sim, spec, matrix);
  const samples = new Map(matrix.map((s) => [s.id, { base: [], head: [], ratio: [] }]));
  const hashes = new Map(matrix.map((s) => [s.id, { base: new Set(), head: new Set() }]));
  for (let round = 0; round < R.rounds; round++) {
    const order = round % 2 === 0 ? [base, head] : [head, base];
    for (const s of matrix) {
      const got = {};
      for (const side of order) {
        const r = measure(side.sim, spec, s, { minMs: R.minMs });
        got[side.label] = r;
        hashes.get(s.id)[side.label].add(r.hash);
      }
      const x = samples.get(s.id);
      x.base.push(got.base.msMean);
      x.head.push(got.head.msMean);
      x.ratio.push(got.head.msMean / got.base.msMean);
    }
    log(`round ${round + 1} of ${R.rounds} done`);
  }

  for (const s of matrix) {
    const x = samples.get(s.id);
    const h = hashes.get(s.id);
    const ratio = median(x.ratio);
    const headCeiling = headBudgets.scenarios[s.id]?.msMedian;
    const baseCeiling = baseBudgets?.scenarios?.[s.id]?.msMedian;
    const raise = headCeiling && baseCeiling ? Math.max(1, headCeiling / baseCeiling) : 1;
    const limit = R.regressionLimit * raise;
    const deterministic = h.base.size === 1 && h.head.size === 1;
    const same = deterministic && [...h.base][0] === [...h.head][0];
    const status = !deterministic ? 'nondeterministic' : ratio > limit ? 'slower' : 'ok';
    if (status !== 'ok')
      failures.push(`${s.id}: ${status} (${ratio.toFixed(2)}x, limit ${limit.toFixed(2)}x)`);
    rows.push({
      id: s.id,
      base: median(x.base),
      head: median(x.head),
      ratio,
      limit,
      status,
      results: same ? 'same' : 'changed',
    });
  }

  md.push('### Engine (reduced matrix, base and head alternating)', '');
  md.push(
    `${matrix.length} scenarios, ${R.rounds} rounds, each batch repeated to at least ${R.minMs} ms. Fails above ${R.regressionLimit}x unless bench/budgets.json raises the scenario's ceiling in this pull request.`,
    '',
  );
  md.push('| Scenario | Base ms/run | Head ms/run | Head / base | Limit | Results | Status |');
  md.push('| --- | ---: | ---: | ---: | ---: | --- | --- |');
  const shown = [...rows].sort((a, b) => b.ratio - a.ratio);
  for (const r of shown) {
    md.push(
      `| \`${r.id}\` | ${fmtMs(r.base)} | ${fmtMs(r.head)} | ${r.ratio.toFixed(2)}x | ${r.limit.toFixed(2)}x | ${r.results} | ${r.status === 'ok' ? 'ok' : `**${r.status}**`} |`,
    );
  }
  md.push('');
  const changed = rows.filter((r) => r.results === 'changed').length;
  if (changed > 0) {
    notes.push(
      `${changed} scenario(s) give different results on head than on base: expected for a model change, otherwise worth a look.`,
    );
  }
}

// --- startup JavaScript per page ---

let pages = [];
if (DIST) {
  pages = checkPages(pageSizes(DIST), headBudgets);
  md.push('### Startup JavaScript per page (gzip)', '');
  md.push('| Page | Size | Budget | Status |', '| --- | ---: | ---: | --- |');
  for (const p of pages) {
    md.push(
      `| \`${p.page}\` | ${fmtKb(p.gzipBytes)} | ${p.budget === null ? '–' : fmtKb(p.budget)} | ${p.status === 'over' ? '**over**' : p.status} |`,
    );
    if (p.status === 'over') failures.push(`${p.page}: ${p.gzipBytes} B over budget ${p.budget} B`);
    if (p.status === 'unlisted')
      notes.push(`No budget for page ${p.page}: add one to bench/budgets.json.`);
  }
  for (const page of Object.keys(headBudgets.pages)) {
    if (!pages.some((p) => p.page === page)) notes.push(`Budgeted page not built: ${page}`);
  }
  md.push('');
}

const seconds = ((Date.now() - started) / 1000).toFixed(0);
const head1 = failures.length === 0 ? 'passed' : 'failed';
const out = [`## Performance check ${head1}`, '', `Measured in ${seconds} s.`, ''];
if (failures.length > 0) out.push(...failures.map((f) => `- **${f}**`), '');
if (notes.length > 0) out.push(...notes.map((n) => `- ${n}`), '');
out.push(...md);
const text = `${out.join('\n')}\n`;
log(text);
if (SUMMARY) appendFileSync(SUMMARY, text);
if (OUT) writeFileSync(OUT, `${JSON.stringify({ rows, pages, failures, notes }, null, 2)}\n`);
exit(failures.length === 0 ? 0 : 1);
