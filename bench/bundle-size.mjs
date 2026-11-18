// Startup JavaScript per page against bench/budgets.json (docs/PERFORMANCE.md, "Standing
// performance checks").
//
//   npm run build && npm run bench:size [-- --dist <dir>]
//
// For every HTML page in dist/, sums the gzip size (Node zlib, level 9) of the module scripts it
// loads and the chunks it preloads, prints the table and exits 1 when a page is over its budget.

import path from 'node:path';
import { argv, exit, stdout } from 'node:process';
import { BENCH_DIR, ROOT, checkPages, fmtKb, pageSizes, readJson } from './lib.mjs';

const args = argv.slice(2);
const i = args.indexOf('--dist');
const dist = i >= 0 ? path.resolve(args[i + 1]) : path.join(ROOT, 'dist');
const budgets = readJson(path.join(BENCH_DIR, 'budgets.json'));
const rows = checkPages(pageSizes(dist), budgets);

const log = (line) => stdout.write(`${line}\n`);
log(`${'page'.padEnd(36)} ${'gzip'.padStart(9)} ${'budget'.padStart(9)}  status`);
for (const r of rows) {
  log(
    `${r.page.padEnd(36)} ${fmtKb(r.gzipBytes).padStart(9)} ${(r.budget === null ? '–' : fmtKb(r.budget)).padStart(9)}  ${r.status}`,
  );
}
const over = rows.filter((r) => r.status === 'over');
const unlisted = rows.filter((r) => r.status === 'unlisted');
if (unlisted.length > 0) log(`\n${unlisted.length} page(s) have no budget yet`);
if (over.length > 0) {
  log(`\n${over.length} page(s) over budget`);
  exit(1);
}
log('\nevery budgeted page is within its budget');
