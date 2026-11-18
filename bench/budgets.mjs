// Writes the ceilings of bench/budgets.json (docs/PERFORMANCE.md, "Standing performance checks").
//
//   node bench/budgets.mjs [--from <bench run.json>] [--dist <dir>]
//
// `--from` sets the ceiling of every scenario in that run file to its measured median and p95
// times `engineMargin`; scenarios the file does not hold keep their ceilings, so a run with
// `--only <id>` refreshes just that scenario. `--dist` sets every built page's budget to its
// startup JavaScript (gzip) times `pageMargin`. The margins live in the budgets file itself.

import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, stdout } from 'node:process';
import { BENCH_DIR, ROOT, pageSizes, readJson } from './lib.mjs';

const args = argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const FROM = option('--from');
const DIST = option('--dist');
if (!FROM && !DIST) throw new Error('give --from <run.json>, --dist <dir> or both');

const FILE = path.join(BENCH_DIR, 'budgets.json');
const budgets = existsSync(FILE)
  ? readJson(FILE)
  : {
      baseline: null,
      engineMargin: 1.3,
      pageMargin: 1.1,
      scenarios: {},
      pages: {},
    };

const round = (x) => Math.round(x * 100) / 100;
if (FROM) {
  const run = readJson(path.resolve(FROM));
  if (run.matrix === 'full' && run.only === null) {
    budgets.baseline = path.relative(ROOT, path.resolve(FROM)).split(path.sep).join('/');
  }
  for (const r of run.results) {
    budgets.scenarios[r.id] = {
      msMedian: round(r.msMedian * budgets.engineMargin),
      msP95: round(r.msP95 * budgets.engineMargin),
    };
  }
  budgets.scenarios = Object.fromEntries(Object.entries(budgets.scenarios));
  stdout.write(`set ${run.results.length} scenario ceilings from ${FROM}\n`);
}
if (DIST) {
  const sizes = pageSizes(path.resolve(DIST));
  budgets.pages = Object.fromEntries(
    Object.entries(sizes).map(([page, s]) => [
      page,
      { gzipBytes: Math.ceil(s.gzipBytes * budgets.pageMargin) },
    ]),
  );
  stdout.write(`set ${Object.keys(sizes).length} page budgets from ${DIST}\n`);
}
writeFileSync(FILE, `${JSON.stringify(budgets, null, 2)}\n`);
stdout.write(`wrote ${path.relative(ROOT, FILE)}\n`);
