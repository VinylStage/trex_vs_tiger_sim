// Shared code of the standing performance checks (docs/PERFORMANCE.md, "Standing performance
// checks"): bundling a source tree's engine, expanding bench/scenarios.json into scenarios,
// timing them, and measuring the startup JavaScript of every built page. Node built-ins and Vite
// (already a dev dependency) only.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

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

/**
 * Every scenario of the spec, expanded against one bundled engine: the scale ladder, every preset
 * in each listed flight mode, and every species of the registry as a mirror and against the
 * reference opponent. `reduced` keeps the groups and run counts of `spec.reduced` (the CI matrix).
 */
export function expandMatrix(spec, sim, { reduced = false } = {}) {
  const r = reduced ? spec.reduced : undefined;
  const runsOf = (n) => (r ? Math.max(1, Math.round(n * r.runScale)) : n);
  const out = [];
  const add = (s) => out.push({ ...s, runs: runsOf(s.runs) });

  for (const step of spec.scale.steps) {
    if (r && step.na + step.nb > r.maxScaleAgents) continue;
    add({
      id: `scale-${step.na}v${step.nb}`,
      group: 'scale',
      a: spec.scale.a,
      na: step.na,
      b: spec.scale.b,
      nb: step.nb,
      flight: spec.scale.flight,
      runs: step.runs,
    });
  }

  const flights = r ? r.presetFlights : spec.presets.flights;
  for (const p of sim.FREE_PRESETS) {
    const agents = p.a.n + p.b.n;
    for (const flight of flights) {
      add({
        id: `preset-${p.id}-${flight}`,
        group: 'preset',
        a: p.a.sp,
        na: p.a.n,
        b: p.b.sp,
        nb: p.b.n,
        flight,
        runs: agents > spec.presets.largeAgents ? spec.presets.largeRuns : spec.presets.runs,
      });
    }
  }

  if (!r || r.species) {
    const { count, reference, alternate, runs } = spec.species;
    for (const sp of sim.FREE_SPECIES_IDS) {
      const ref = sp === reference ? alternate : reference;
      const base = { group: 'species', a: sp, na: count, flight: 'allIn', runs };
      add({ ...base, id: `species-${sp}-mirror`, b: sp, nb: count });
      add({ ...base, id: `species-${sp}-v-${ref}`, b: ref, nb: count });
    }
  }
  return out;
}

const percentile = (sorted, q) => {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export const median = (xs) =>
  percentile(
    [...xs].sort((a, b) => a - b),
    0.5,
  );

/**
 * Config of a scenario on one engine, at the spec's seed and the engine's newest model (a config
 * without `mv` is read as model 1, the version of links that predate the field).
 */
function configOf(sim, spec, s) {
  return sim.sanitizeFreeConfig({
    mv: sim.FREE_MODEL_VERSION,
    sides: [
      { species: s.a, count: s.na },
      { species: s.b, count: s.nb },
    ],
    runs: s.runs,
    seed: spec.seed,
    flight: s.flight,
  });
}

/**
 * Runs one scenario and times every run on its own. Returns ms/run (median, p95, mean),
 * agent-steps per second (ticks the battle lasted × agents, the unit of the work budget,
 * unweighted) and a SHA-256 of the packed run summaries, which is the same on every rerun of the
 * same engine and changes when the engine's results change. With `minMs` the whole batch repeats
 * until that much time has been timed, so a cheap scenario is not measured from a few
 * milliseconds; the repeats run the same seeded runs, and the hash is checked on each.
 */
export function measure(sim, spec, s, { minMs = 0 } = {}) {
  const c = configOf(sim, spec, s);
  const runs = Math.min(s.runs, c.runs);
  const design = sim.buildFreeDesign({ ...c, runs });
  const agents = s.na + s.nb;
  const times = [];
  let steps = 0;
  let total = 0;
  let hash;
  do {
    const summaries = [];
    for (let run = 0; run < runs; run++) {
      const row = sim.designRow(design, run);
      const t0 = performance.now();
      const { summary } = sim.simulateFreeBattle(c, row, run);
      const ms = performance.now() - t0;
      times.push(ms);
      total += ms;
      summaries.push(summary);
      steps += Math.round(summary.duration / sim.DT) * agents;
    }
    const packed = sim.packFreeSummaries(summaries);
    const h = createHash('sha256')
      .update(new Uint8Array(packed.buffer, packed.byteOffset, packed.byteLength))
      .digest('hex')
      .slice(0, 16);
    if (hash !== undefined && h !== hash) throw new Error(`${s.id}: a repeat gave other results`);
    hash = h;
  } while (total < minMs);
  const sorted = [...times].sort((a, b) => a - b);
  return {
    id: s.id,
    runs,
    mv: c.mv,
    msMedian: percentile(sorted, 0.5),
    msP95: percentile(sorted, 0.95),
    msMean: total / times.length,
    agentStepsPerSec: total > 0 ? steps / (total / 1000) : NaN,
    hash,
  };
}

/** One hash over every scenario's hash, in matrix order. */
export const matrixHash = (results) =>
  createHash('sha256')
    .update(results.map((r) => `${r.id}:${r.hash}`).join('\n'))
    .digest('hex')
    .slice(0, 16);

/** A few runs of the small scenarios first, so the timed runs see optimised code. */
export function warmUp(sim, spec, matrix) {
  for (const s of matrix.filter((m) => m.na + m.nb <= 110).slice(0, 4)) {
    measure(sim, spec, { ...s, runs: Math.min(3, s.runs) });
  }
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
