// Shared code of the standing performance checks (docs/PERFORMANCE.md, "Standing performance
// checks"): bundling a source tree's engine, timing and hashing scenarios, and measuring the
// startup JavaScript of every built page. Node built-ins and Vite (already a dev dependency) only.
// The matrix and the timing loop live in bench/matrix.mjs, which the `/bench/` page shares.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { matrixHashInput, packedBytes, timeScenario, timeStats, warmUpSet } from './matrix.mjs';

export const BENCH_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(BENCH_DIR, '..');
export const HARNESS = path.join(BENCH_DIR, 'harness.mjs');

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * Bundles `<root>/src/sim` behind bench/harness.mjs into one ES module with Vite's SSR build and
 * imports it. `root` defaults to this checkout; the CI perf job passes the base checkout too.
 */
export async function loadSim(root = ROOT, label = 'head') {
  const { build } = await import('vite');
  const outDir = mkdtempSync(path.join(tmpdir(), `trex-bench-${label}-`));
  await build({
    root,
    configFile: false,
    logLevel: 'error',
    resolve: { alias: [{ find: /^@sim\//, replacement: `${path.join(root, 'src', 'sim')}/` }] },
    build: {
      ssr: HARNESS,
      outDir,
      emptyOutDir: true,
      minify: false,
      target: 'node22',
      rolldownOptions: { output: { entryFileNames: 'sim.mjs', format: 'es' } },
    },
  });
  const sim = await import(pathToFileURL(path.join(outDir, 'sim.mjs')).href);
  return { label, root, sim };
}

export { expandMatrix, median } from './matrix.mjs';

/**
 * Runs one scenario and times every run on its own (bench/matrix.mjs `timeScenario`). Returns
 * ms/run (median, p95, mean), agent-steps per second (ticks the battle lasted × agents, the unit
 * of the work budget, unweighted) and a SHA-256 of the packed run summaries, which is the same on
 * every rerun of the same engine and changes when the engine's results change. With `minMs` the
 * whole batch repeats until that much time has been timed; the hash is checked on each repeat.
 */
export function measure(sim, spec, s, { minMs = 0 } = {}) {
  const t = timeScenario(sim, spec, s, { minMs });
  const hashes = t.packed.map((p) =>
    createHash('sha256').update(packedBytes(p)).digest('hex').slice(0, 16),
  );
  if (new Set(hashes).size !== 1) throw new Error(`${s.id}: a repeat gave other results`);
  return { id: t.id, runs: t.runs, mv: t.mv, ...timeStats(t), hash: hashes[0] };
}

/** One hash over every scenario's hash, in matrix order. */
export const matrixHash = (results) =>
  createHash('sha256').update(matrixHashInput(results)).digest('hex').slice(0, 16);

/** A few runs of the small scenarios first, so the timed runs see optimised code. */
export function warmUp(sim, spec, matrix) {
  for (const s of warmUpSet(matrix)) measure(sim, spec, s);
}

// --- startup JavaScript per page ---

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * Startup JavaScript of every built page: the module scripts in its HTML plus the chunks it
 * preloads (Vite emits a modulepreload link for every static import), gzip level 9. `import()`
 * chunks are excluded, as in the #82 table.
 */
export function pageSizes(dist) {
  const gz = new Map();
  const gzipOf = (file) => {
    if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(file), { level: 9 }).length);
    return gz.get(file);
  };
  const pages = {};
  for (const html of walk(dist).filter((f) => f.endsWith('.html'))) {
    const text = readFileSync(html, 'utf8');
    const refs = new Set();
    for (const m of text.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) refs.add(m[1]);
    for (const m of text.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+\.js)"/g)) {
      refs.add(m[1]);
    }
    for (const m of text.matchAll(/<link\b[^>]*href="([^"]+\.js)"[^>]*rel="modulepreload"/g)) {
      refs.add(m[1]);
    }
    let bytes = 0;
    const files = [];
    for (const ref of refs) {
      if (/^[a-z]+:/i.test(ref)) continue;
      const file = ref.startsWith('/')
        ? path.join(dist, ref)
        : path.resolve(path.dirname(html), ref);
      bytes += gzipOf(file);
      files.push(path.relative(dist, file));
    }
    pages[path.relative(dist, html).split(path.sep).join('/')] = { gzipBytes: bytes, files };
  }
  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
}

/** Pages over their budget, and built pages the budget file does not list. */
export function checkPages(sizes, budgets) {
  const rows = [];
  for (const [page, { gzipBytes }] of Object.entries(sizes)) {
    const budget = budgets.pages[page]?.gzipBytes;
    rows.push({
      page,
      gzipBytes,
      budget: budget ?? null,
      status: budget === undefined ? 'unlisted' : gzipBytes > budget ? 'over' : 'ok',
    });
  }
  return rows;
}

export const fmtMs = (x) =>
  Number.isFinite(x) ? (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) : '–';
export const fmtRate = (x) =>
  Number.isFinite(x) ? (x >= 1e6 ? `${(x / 1e6).toFixed(2)} M` : `${(x / 1e3).toFixed(0)} k`) : '–';
export const fmtKb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
