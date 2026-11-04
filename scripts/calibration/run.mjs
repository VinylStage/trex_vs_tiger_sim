// Free-model calibration runs for docs/research/CALIBRATION.md (P8 of FREE-MATCHUPS.md §8,
// RENEWAL-1.0.md §3.2 and §11 M2).
//
//   node scripts/calibration/run.mjs [--quick] [--out <file.json>] [--only <section>]
//
// Dev-only. It loads the shipped engines from src/ through Vite's SSR module loader (Vite is
// already a dev dependency), so it needs no other package and adds nothing to the site bundle.
// Every batch uses a fixed seed, so a rerun on the same commit and JavaScript engine gives the
// same numbers. The default writes docs/research/calibration-results.json, and `--only <section>`
// alone writes docs/research/calibration-<section>.json instead, so one section never replaces
// the whole committed file; `--quick` cuts every run count to a tenth for a smoke test and writes
// nothing unless --out is given.
//
// Sections:
//   trex-tiger    T. rex vs tiger on both engines, same counts, seed and run count
//   classic       every classic preset (src/ui/form.ts PRESETS) on both engines
//   presets       every Simple-mode preset (src/sim/free/presets.ts) on the free engine
//   species-notes the SPECIES.md §7 match-ups that are not classic presets, on both engines
//   interference  the free T. rex vs tiger runs with crowding (`interference`) switched off
//   symmetry      mirror matches and side swaps on the free engine
//   monotonic     win share against head count on the free engine
//   polar-bear    the add-a-species checks for the polar bear (#184): mirror, count sweeps, the
//                 brown bear and tiger comparisons, flight, one-at-a-time sensitivity
//   hippo         the same checks for the hippopotamus (#186), with the elephant (preset #16)
//                 as the reference opponent

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, stdout, version } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'research', 'calibration-results.json');
const SEED = 20261019;
const Z = 1.959963984540054;

const args = argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const QUICK = flag('--quick');
const ONLY = option('--only');
const OUT =
  option('--out') ??
  (QUICK
    ? undefined
    : ONLY
      ? path.join(ROOT, 'docs', 'research', `calibration-${ONLY}.json`)
      : DEFAULT_OUT);
const runsOf = (n) => (QUICK ? Math.max(20, Math.round(n / 10)) : n);

const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = (p) => server.ssrLoadModule(p);
const classicConfig = await load('/src/sim/config.ts');
const classicMc = await load('/src/sim/montecarlo.ts');
const classicEngine = await load('/src/sim/engine.ts');
const freeConfig = await load('/src/sim/free/config.ts');
const freeMc = await load('/src/sim/free/montecarlo.ts');
const freeAgg = await load('/src/sim/free/aggregate.ts');
const freeEngine = await load('/src/sim/free/engine.ts');
const presetsMod = await load('/src/sim/free/presets.ts');
const speciesMod = await load('/src/sim/free/species.ts');
const formMod = await load('/src/ui/form.ts');
const stats = await load('/src/sim/stats.ts');

const { Outcome } = classicEngine;
const { FreeOutcome } = freeEngine;

// --- statistics ---

const wilson = (k, n) => {
  const w = stats.wilson(k, n, Z);
  return { p: w.p, lo: w.lo, hi: w.hi };
};

/** Newcombe's hybrid score interval for p1 − p2 (independent samples, method 10). */
function diffInterval(a, b) {
  const d = a.p - b.p;
  return {
    d,
    lo: d - Math.sqrt((a.p - a.lo) ** 2 + (b.hi - b.p) ** 2),
    hi: d + Math.sqrt((a.hi - a.p) ** 2 + (b.p - b.lo) ** 2),
  };
}

/**
 * Interval for pA − pB when both shares come from the same n runs (A wins, B wins and draws are
 * one multinomial sample, so the two shares are negatively correlated and `diffInterval` would be
 * too narrow). Wald interval with Var(p̂A − p̂B) = (pA + pB − (pA − pB)²) / n.
 */
function pairedDiffInterval(a, b, n) {
  const d = a.p - b.p;
  const half = Z * Math.sqrt(Math.max(0, a.p + b.p - d * d) / n);
  return { d, lo: d - half, hi: d + half };
}

// Sanity check on a symmetric split (pA = pB = 0.5, no draws, n = 1,000): each share's half-width
// is about 3.1 pp (1.96 × √(0.25 / 1000)), and since B = 1 − A the difference A − B moves twice as
// far as either share, so its paired half-width must be about 6.2 pp. The independent-samples
// interval would give about 4.4 pp (√2 × 3.1), which is the error this function avoids.
{
  const share = wilson(500, 1000);
  const shareHalf = (share.hi - share.lo) / 2;
  const paired = pairedDiffInterval({ p: 0.5 }, { p: 0.5 }, 1000);
  const pairedHalf = (paired.hi - paired.lo) / 2;
  if (Math.abs(shareHalf - 0.031) > 0.0005 || Math.abs(pairedHalf - 2 * shareHalf) > 0.0005) {
    throw new Error(`paired interval check failed: ${shareHalf} / ${pairedHalf}`);
  }
}

const quantiles = (values) => {
  const s = Float64Array.from(values).sort();
  const q = (x) => (s.length > 0 ? stats.quantileSorted(s, x) : NaN);
  return { p5: q(0.05), p50: q(0.5), p95: q(0.95) };
};
const meanOf = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

/**
 * Common record for one batch on either engine. Side A is the classic heavy side, side B the
 * classic pack side. `rout` is the losing side's fled ÷ (fled + incapacitated), pooled over the
 * decided runs (`routShare`, src/sim/free/aggregate.ts); the classic engine's heavies never flee,
 * so a classic run the heavy side lost adds only incapacitated agents.
 */
function record(engine, n, runs, counts) {
  let a = 0;
  let b = 0;
  let draw = 0;
  let fled = 0;
  let out = 0;
  for (const r of runs) {
    if (r.outcome === 'a') a++;
    else if (r.outcome === 'b') b++;
    else draw++;
    if (r.outcome === 'draw') continue;
    const loser = r.outcome === 'a' ? r.b : r.a;
    fled += loser.fled;
    out += loser.fled + loser.incap;
  }
  const dur = quantiles(runs.map((r) => r.duration));
  return {
    engine,
    runs: n,
    counts,
    a: wilson(a, n),
    b: wilson(b, n),
    draw: wilson(draw, n),
    duration: dur,
    rout: out > 0 ? fled / out : null,
    meanA: {
      incap: meanOf(runs.map((r) => r.a.incap)),
      fled: meanOf(runs.map((r) => r.a.fled)),
    },
    meanB: {
      incap: meanOf(runs.map((r) => r.b.incap)),
      fled: meanOf(runs.map((r) => r.b.fled)),
    },
  };
}

function runClassic({ a, b, na, nb, runs, morale = true }, tactic = 'flank') {
  const c = classicConfig.sanitizeConfig({
    heavySpecies: a,
    packSpecies: b,
    heavyCount: na,
    packCount: nb,
    runs,
    seed: SEED,
    morale,
    packTactic: tactic,
  });
  if (c.packTactic !== tactic) throw new Error(`tactic ${tactic} not accepted`);
  const { summaries } = classicMc.runAll(c);
  const rows = summaries.map((s) => ({
    outcome: s.outcome === Outcome.Heavy ? 'a' : s.outcome === Outcome.Pack ? 'b' : 'draw',
    duration: s.duration,
    a: { incap: c.heavyCount - s.heavyAlive, fled: 0 },
    b: { incap: s.packKilled, fled: s.packRouted },
  }));
  return record(`classic-${tactic}`, c.runs, rows, [c.heavyCount, c.packCount]);
}

function runFree({ a, b, na, nb, runs, morale = true, globals, seed = SEED, paramsA }) {
  const c = freeConfig.sanitizeFreeConfig({
    sides: [
      { species: a, count: na, ...(paramsA === undefined ? {} : { params: paramsA }) },
      { species: b, count: nb },
    ],
    runs,
    seed,
    morale,
    ...(globals === undefined ? {} : { globals }),
  });
  const { summaries } = freeMc.runAllFree(c);
  const rows = summaries.map((s) => ({
    outcome: s.outcome === FreeOutcome.A ? 'a' : s.outcome === FreeOutcome.B ? 'b' : 'draw',
    duration: s.duration,
    a: { incap: s.aKilled, fled: s.aRouted },
    b: { incap: s.bKilled, fled: s.bRouted },
  }));
  const rec = record('free', c.runs, rows, [c.sides[0].count, c.sides[1].count]);
  // Cross-check against the shipped aggregate, so the report's definitions are the app's.
  const agg = freeAgg.aggregateFree(c, summaries);
  const shipped = freeAgg.routShare(summaries);
  if (agg.aWins !== Math.round(rec.a.p * rec.runs) || agg.duration.p50 !== rec.duration.p50) {
    throw new Error(`free aggregate mismatch for ${a} ${na} v ${b} ${nb}`);
  }
  if (!(Number.isNaN(shipped) && rec.rout === null) && shipped !== rec.rout) {
    throw new Error(`free rout share mismatch for ${a} ${na} v ${b} ${nb}`);
  }
  return rec;
}

const label = (m) =>
  `${m.a} ${m.na} v ${m.b} ${m.nb}${m.morale === false ? ' (morale off)' : ''}${m.globals ? ' (globals)' : ''}${m.paramsA ? ` (${Object.keys(m.paramsA).join(', ')} pinned)` : ''}`;

function log(line) {
  stdout.write(`${line}\n`);
}

const fmt = (x) => (x === null || Number.isNaN(x) ? '–' : `${(100 * x).toFixed(1)}%`);
function logRow(name, r) {
  log(
    `  ${r.engine.padEnd(14)} ${name.padEnd(36)} A ${fmt(r.a.p).padStart(6)} B ${fmt(r.b.p).padStart(6)} draw ${fmt(r.draw.p).padStart(6)} p50 ${r.duration.p50.toFixed(1).padStart(7)} s rout ${fmt(r.rout)}`,
  );
}

/**
 * One matchup on both engines. The classic engine runs twice: with its default pack tactic
 * `flank` (every pack animal circles to the rear) and with `direct` (straight at the nearest
 * heavy). The free engine has no tactic switch: every agent approaches directly, and only a social
 * side's pack buff adds a coordinated approach (FREE-MATCHUPS.md §4.1, §5.2 E1).
 */
function compare(m) {
  const flank = runClassic(m, 'flank');
  const direct = runClassic(m, 'direct');
  const free = runFree(m);
  logRow(label(m), flank);
  logRow(label(m), direct);
  logRow(label(m), free);
  return {
    match: m,
    classicFlank: flank,
    classicDirect: direct,
    free,
    diffFlank: diffInterval(free.a, flank.a),
    diffDirect: diffInterval(free.a, direct.a),
  };
}

// --- sections ---

const sections = {};

sections['trex-tiger'] = () => {
  const grid = [
    [1, 1, 2000],
    [1, 2, 2000],
    [1, 3, 2000],
    [1, 5, 1000],
    [1, 10, 1000],
    [1, 20, 1000],
    [1, 30, 1000],
    [1, 50, 1000],
    [3, 30, 500],
    [10, 100, 500],
    [10, 300, 500],
  ];
  const on = grid.map(([na, nb, runs]) =>
    compare({ a: 'trex', b: 'tiger', na, nb, runs: runsOf(runs) }),
  );
  const off = [
    [1, 1, 2000],
    [1, 10, 1000],
    [10, 100, 500],
  ].map(([na, nb, runs]) =>
    compare({ a: 'trex', b: 'tiger', na, nb, runs: runsOf(runs), morale: false }),
  );
  return { moraleOn: on, moraleOff: off };
};

sections['classic'] = () =>
  formMod.PRESETS.map((p) =>
    compare({
      a: p.heavySpecies,
      b: p.packSpecies,
      na: p.heavyCount,
      nb: p.packCount,
      runs: runsOf(p.runs),
    }),
  );

sections['presets'] = () =>
  presetsMod.FREE_PRESETS.map((p) => {
    const m = { a: p.a.sp, b: p.b.sp, na: p.a.n, nb: p.b.n, runs: runsOf(500) };
    const free = runFree(m);
    logRow(p.id, free);
    return { id: p.id, hold: p.hold !== undefined, tags: p.tags, match: m, free };
  });

// The matchups of docs/SPECIES.md §7 (classic calibration notes) that are not classic presets.
sections['species-notes'] = () =>
  [
    ['elephant', 1, 'lion', 27],
    ['buffalo', 10, 'lion', 12],
    ['trex', 1, 'lion', 30],
    ['trex', 1, 'wolf', 50],
    ['mammoth', 1, 'wolf', 30],
    ['mammoth', 1, 'hyena', 15],
    ['mammoth', 1, 'lion', 20],
    ['trex', 1, 'homoErectus', 30],
    ['trex', 1, 'homoErectus', 300],
    ['elephant', 1, 'homoErectus', 30],
    ['buffalo', 1, 'homoErectus', 20],
    ['homoErectus', 1, 'wolf', 1],
    ['homoErectus', 1, 'wolf', 3],
    ['homoErectus', 1, 'hyena', 1],
    ['homoErectus', 1, 'tiger', 1],
    ['homoErectus', 1, 'lion', 1],
    ['homoErectus', 1, 'homoErectus', 1],
    ['homoErectus', 1, 'homoErectus', 2],
  ].map(([a, na, b, nb]) => compare({ a, b, na, nb, runs: runsOf(500) }));

// Does crowding (FREE-MATCHUPS.md §5.6, `interference`) explain the free tigers' weakness?
sections['interference'] = () =>
  [10, 20].flatMap((nb) =>
    [undefined, { interference: { min: 0, mode: 0, max: 0 } }].map((globals) => {
      const m = { a: 'trex', b: 'tiger', na: 1, nb, runs: runsOf(1000), globals };
      const free = runFree(m);
      logRow(label(m), free);
      return { match: m, free };
    }),
  );

const SPECIES = [
  'trex',
  'elephant',
  'buffalo',
  'brownBear',
  'mammoth',
  'tiger',
  'lion',
  'wolf',
  'hyena',
  'homoErectus',
];

sections['symmetry'] = () => {
  const mirrors = [
    ...SPECIES.map((sp) => ({ a: sp, b: sp, na: 1, nb: 1, runs: runsOf(1000) })),
    { a: 'tiger', b: 'tiger', na: 5, nb: 5, runs: runsOf(1000) },
    { a: 'lion', b: 'lion', na: 5, nb: 5, runs: runsOf(1000) },
    { a: 'wolf', b: 'wolf', na: 8, nb: 8, runs: runsOf(1000) },
    { a: 'homoErectus', b: 'homoErectus', na: 10, nb: 10, runs: runsOf(1000) },
  ].map((m) => {
    const free = runFree(m);
    logRow(label(m), free);
    return { match: m, free, diff: pairedDiffInterval(free.a, free.b, free.runs) };
  });
  const swaps = [
    [
      { a: 'tiger', b: 'lion', na: 5, nb: 5 },
      { a: 'lion', b: 'tiger', na: 5, nb: 5 },
    ],
    [
      { a: 'brownBear', b: 'wolf', na: 1, nb: 10 },
      { a: 'wolf', b: 'brownBear', na: 10, nb: 1 },
    ],
    [
      { a: 'trex', b: 'tiger', na: 1, nb: 10 },
      { a: 'tiger', b: 'trex', na: 10, nb: 1 },
    ],
  ].map(([x, y]) => {
    const fx = runFree({ ...x, runs: runsOf(1000) });
    const fy = runFree({ ...y, runs: runsOf(1000) });
    logRow(label(x), fx);
    logRow(label(y), fy);
    // The first order's side A is the second order's side B.
    return {
      first: { match: x, free: fx },
      second: { match: y, free: fy },
      diff: diffInterval(fx.a, fy.b),
    };
  });
  // Supporting evidence for the mirror with the largest gap at 1,000 runs (wolf): 4,000 runs at
  // the default seed and at two others.
  const rechecks = [SEED, 1, 2].map((seed) => {
    const m = { a: 'wolf', b: 'wolf', na: 1, nb: 1, runs: runsOf(4000), seed };
    const free = runFree(m);
    logRow(`${label(m)} seed ${seed}`, free);
    return { match: m, free, diff: pairedDiffInterval(free.a, free.b, free.runs) };
  });
  return { mirrors, swaps, rechecks };
};

sections['monotonic'] = () => {
  const sweep = (a, b, counts, runs) =>
    counts.map((nb) => {
      const m = { a, b, na: 1, nb, runs: runsOf(runs) };
      const free = runFree(m);
      logRow(label(m), free);
      return { match: m, free };
    });
  return {
    bearWolves: sweep('brownBear', 'wolf', [1, 2, 4, 6, 8, 10, 12, 16, 20], 500),
    buffaloWolves: sweep('buffalo', 'wolf', [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 25], 500),
    buffaloLions: sweep('buffalo', 'lion', [1, 2, 3, 4, 6, 8, 10], 500),
    elephantLions: sweep('elephant', 'lion', [5, 10, 20, 30, 40, 60], 300),
  };
};

// The polar bear (#184), the first species without a legacy entry: RENEWAL-1.0 §5.3 step 5 and
// the brown bear and tiger comparisons. Side A is the polar bear, except in the brown bear's
// reference rows and the second order of each swap.
sections['polar-bear'] = () => {
  const one = (m) => {
    const free = runFree(m);
    logRow(label(m), free);
    return { match: m, free };
  };
  const PB = 'polarBear';
  const mirrors = [
    { a: PB, b: PB, na: 1, nb: 1, runs: runsOf(1000) },
    { a: PB, b: PB, na: 3, nb: 3, runs: runsOf(1000) },
  ].map((m) => {
    const r = one(m);
    return { ...r, diff: pairedDiffInterval(r.free.a, r.free.b, r.free.runs) };
  });
  // Count sweeps: wolves and tigers against one polar bear (side B varies), and polar bears
  // against one T. rex (side A varies).
  const sweeps = {
    wolves: [1, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30].map((nb) =>
      one({ a: PB, b: 'wolf', na: 1, nb, runs: runsOf(500) }),
    ),
    tigers: [1, 2, 3, 4, 5, 6].map((nb) =>
      one({ a: PB, b: 'tiger', na: 1, nb, runs: runsOf(500) }),
    ),
    vsTrex: [1, 2, 4, 6, 8, 10, 12, 16].map((na) =>
      one({ a: PB, b: 'trex', na, nb: 1, runs: runsOf(500) }),
    ),
  };
  // The sanity check: the polar bear next to the brown bear, against each other and against the
  // same opponents, in both side orders where the order could matter.
  const pairs = [
    [
      { a: PB, b: 'brownBear', na: 1, nb: 1 },
      { a: 'brownBear', b: PB, na: 1, nb: 1 },
    ],
    [
      { a: PB, b: 'tiger', na: 1, nb: 1 },
      { a: 'tiger', b: PB, na: 1, nb: 1 },
    ],
  ].map(([x, y]) => {
    const fx = one({ ...x, runs: runsOf(1000) });
    const fy = one({ ...y, runs: runsOf(1000) });
    return { first: fx, second: fy, diff: diffInterval(fx.free.a, fy.free.b) };
  });
  const sanity = [
    ['brownBear', 'tiger', 1],
    [PB, 'wolf', 8],
    ['brownBear', 'wolf', 8],
    [PB, 'lion', 1],
    ['brownBear', 'lion', 1],
    [PB, 'buffalo', 1],
    ['brownBear', 'buffalo', 1],
  ].map(([a, b, nb]) => one({ a, b, na: 1, nb, runs: runsOf(1000) }));
  // Flight (#169, unchanged here): one polar bear against much larger single opponents.
  const flight = [
    ['trex', 1],
    ['elephant', 1],
    ['mammoth', 1],
  ].map(([b, nb]) => one({ a: PB, b, na: 1, nb, runs: runsOf(1000) }));
  // One-at-a-time sensitivity of every S trait: polar bear 1 v brown bear 1 with the trait pinned
  // at its preset min, then at its max, every other input at its preset.
  const preset = speciesMod.FREE_SPECIES[PB].traits;
  const sTraits = Object.entries(preset).filter(([, t]) => t.evidence === 'S');
  const base = one({ a: PB, b: 'brownBear', na: 1, nb: 1, runs: runsOf(1000) });
  const sensitivity = sTraits.map(([k, t]) => {
    const at = (v) =>
      one({
        a: PB,
        b: 'brownBear',
        na: 1,
        nb: 1,
        runs: runsOf(1000),
        paramsA: { [k]: { min: v, mode: v, max: v } },
      });
    return { trait: k, range: t.range, low: at(t.range.min), high: at(t.range.max) };
  });
  return { mirrors, sweeps, pairs, sanity, flight, sensitivity: { base, traits: sensitivity } };
};

// The hippopotamus (#186): the same checks as the polar bear. Side A is the hippo, except in the
// comparison rows of other species and the second order of each swap. The sensitivity rows use
// preset #16 (elephant vs hippo) from the hippo's side.
sections['hippo'] = () => {
  const one = (m) => {
    const free = runFree(m);
    logRow(label(m), free);
    return { match: m, free };
  };
  const H = 'hippo';
  const mirrors = [
    { a: H, b: H, na: 1, nb: 1, runs: runsOf(1000) },
    { a: H, b: H, na: 3, nb: 3, runs: runsOf(1000) },
  ].map((m) => {
    const r = one(m);
    return { ...r, diff: pairedDiffInterval(r.free.a, r.free.b, r.free.runs) };
  });
  // Count sweeps: lions and spotted hyenas, the hippo's recorded predators (mostly of calves),
  // against one hippo (side B varies), and hippos against one elephant and one T. rex (side A
  // varies).
  const sweeps = {
    lions: [1, 2, 3, 4, 6, 8, 10, 12, 16, 20].map((nb) =>
      one({ a: H, b: 'lion', na: 1, nb, runs: runsOf(500) }),
    ),
    hyenas: [1, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30].map((nb) =>
      one({ a: H, b: 'hyena', na: 1, nb, runs: runsOf(500) }),
    ),
    vsElephant: [1, 2, 3, 4, 5, 6].map((na) =>
      one({ a: H, b: 'elephant', na, nb: 1, runs: runsOf(500) }),
    ),
    vsTrex: [1, 2, 3, 4, 6, 8].map((na) => one({ a: H, b: 'trex', na, nb: 1, runs: runsOf(500) })),
  };
  const pairs = [
    [
      { a: H, b: 'elephant', na: 1, nb: 1 },
      { a: 'elephant', b: H, na: 1, nb: 1 },
    ],
    [
      { a: H, b: 'polarBear', na: 1, nb: 1 },
      { a: 'polarBear', b: H, na: 1, nb: 1 },
    ],
  ].map(([x, y]) => {
    const fx = one({ ...x, runs: runsOf(1000) });
    const fy = one({ ...y, runs: runsOf(1000) });
    return { first: fx, second: fy, diff: diffInterval(fx.free.a, fy.free.b) };
  });
  // Next to the other heavy grazers and the bears: the hippo against each species of similar or
  // larger build, one on one.
  const sanity = [
    [H, 'buffalo', 1],
    [H, 'brownBear', 1],
    [H, 'tiger', 1],
    [H, 'lion', 1],
    [H, 'mammoth', 1],
    ['buffalo', 'lion', 6],
    [H, 'lion', 6],
  ].map(([a, b, nb]) => one({ a, b, na: 1, nb, runs: runsOf(1000) }));
  // Flight (#169, unchanged here): one hippo against much larger single opponents.
  const flight = [
    ['trex', 1],
    ['elephant', 1],
    ['mammoth', 1],
  ].map(([b, nb]) => one({ a: H, b, na: 1, nb, runs: runsOf(1000) }));
  // One-at-a-time sensitivity of every S trait: hippo 1 v elephant 1 with the trait pinned at its
  // preset min, then at its max, every other input at its preset.
  const preset = speciesMod.FREE_SPECIES[H].traits;
  const sTraits = Object.entries(preset).filter(([, t]) => t.evidence === 'S');
  const base = one({ a: H, b: 'elephant', na: 1, nb: 1, runs: runsOf(1000) });
  const sensitivity = sTraits.map(([k, t]) => {
    const at = (v) =>
      one({
        a: H,
        b: 'elephant',
        na: 1,
        nb: 1,
        runs: runsOf(1000),
        paramsA: { [k]: { min: v, mode: v, max: v } },
      });
    return { trait: k, range: t.range, low: at(t.range.min), high: at(t.range.max) };
  });
  return { mirrors, sweeps, pairs, sanity, flight, sensitivity: { base, traits: sensitivity } };
};

// --- run ---

let head = 'unknown';
try {
  head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // not a git checkout; leave "unknown"
}

const result = {
  generatedBy: 'scripts/calibration/run.mjs',
  commit: head,
  node: version,
  seed: SEED,
  quick: QUICK,
  defaults: 'arena 600 m, cap 1,200 s, LHS, CV 0.08, morale on, classic tactic flank',
  sections: {},
};
const started = Date.now();
for (const [name, fn] of Object.entries(sections)) {
  if (ONLY && ONLY !== name) continue;
  log(`# ${name}`);
  const t0 = Date.now();
  result.sections[name] = fn();
  log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
log(`total ${((Date.now() - started) / 1000).toFixed(1)} s`);
await server.close();

if (OUT) {
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  log(`wrote ${path.relative(ROOT, OUT)}`);
}
