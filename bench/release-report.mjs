// CLI of the release check (docs/PERFORMANCE.md, "Release check"): prints the markdown summary,
// with the two History rows ready to paste, from the outputs of one release run.
//
//   node bench/release-report.mjs --bench <run.json> --size <size.json> [--browser <browser.json>]
//                                 [--commit <sha>] [--note <text>] [--rows]
//
//   --bench    a full-matrix file of `npm run bench` (`--out`)
//   --size     the file of `npm run bench:size -- --json`
//   --browser  the file of bench/browser.mjs; without it only the engine row is printed
//   --commit   the commit to name in the row (default: the run's); the release workflow passes the
//              `main` commit a release-please branch was cut from
//   --rows     print only the History rows, without the summary around them

import path from 'node:path';
import { argv, stdout } from 'node:process';
import { browserRow, engineRow, releaseSummary } from './history.mjs';
import { readJson } from './lib.mjs';

const args = argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const need = (name) => {
  const v = option(name);
  if (!v) throw new Error(`give ${name} <file>`);
  return readJson(path.resolve(v));
};

const bench = need('--bench');
const size = need('--size');
const browserFile = option('--browser');
const browser = browserFile ? readJson(path.resolve(browserFile)) : null;
const commit = option('--commit');
const note = option('--note') ?? '';

if (args.includes('--rows')) {
  stdout.write(`${engineRow(bench, size, { commit, note })}\n`);
  if (browser) stdout.write(`${browserRow(browser, { version: bench.version, note })}\n`);
} else {
  stdout.write(`${releaseSummary({ bench, size, browser, commit, note })}\n`);
}
