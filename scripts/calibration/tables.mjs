// Prints the Markdown tables of docs/research/CALIBRATION.md from the committed results.
//
//   node scripts/calibration/tables.mjs [results.json]
//   node scripts/calibration/tables.mjs docs/research/calibration-polar-bear.json
//   node scripts/calibration/tables.mjs docs/research/calibration-hippo.json
//   node scripts/calibration/tables.mjs docs/research/calibration-raptor.json
//   node scripts/calibration/tables.mjs docs/research/calibration-white-rhino.json
//   node scripts/calibration/tables.mjs docs/research/calibration-spinosaurus.json
//
// Dev-only, no dependencies. The report's tables are pasted from this output, so a rerun of
// run.mjs followed by this script shows exactly which numbers moved.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { argv, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = argv[2] ?? path.join(ROOT, 'docs', 'research', 'calibration-results.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const S = data.sections;

const NAMES = {
  trex: '_T. rex_',
  elephant: 'elephant',
  buffalo: 'buffalo',
  brownBear: 'brown bear',
  mammoth: 'mammoth',
  tiger: 'tiger',
  lion: 'lion',
  wolf: 'wolf',
  hyena: 'hyena',
  homoErectus: '_H. erectus_',
  polarBear: 'polar bear',
  hippo: 'hippo',
  raptor: '_Utahraptor_',
  whiteRhino: 'white rhino',
  spinosaurus: '_Spinosaurus_',
};

const pct = (x) =>
  x === null || x === undefined || Number.isNaN(x) ? '–' : `${(100 * x).toFixed(1)}`;
const ci = (w) => `${pct(w.p)} (${pct(w.lo)}–${pct(w.hi)})`;
const diff = (d) => `${d.d >= 0 ? '+' : ''}${pct(d.d)} (${pct(d.lo)} to ${pct(d.hi)})`;
const sec = (x) => x.toFixed(0);
const match = (m) => `${NAMES[m.a]} ${m.na} v ${NAMES[m.b]} ${m.nb}`;
const out = (line = '') => stdout.write(`${line}\n`);

function table(head, rows) {
  out(`| ${head.join(' | ')} |`);
  out(`| ${head.map((h, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`);
  for (const r of rows) out(`| ${r.join(' | ')} |`);
  out();
}

/** Free vs classic rows: side A's win share on each engine, the difference, durations, routs. */
function compareTable(title, rows) {
  out(`### ${title}`);
  out();
  table(
    [
      'Match-up (A v B)',
      'Runs',
      'A wins, classic flank',
      'A wins, classic direct',
      'A wins, free',
      'Free − direct (pp)',
      'Median s (flank / direct / free)',
      'Rout % (flank / direct / free)',
    ],
    rows.map((r) => [
      match(r.match),
      r.free.runs,
      ci(r.classicFlank.a),
      ci(r.classicDirect.a),
      ci(r.free.a),
      diff(r.diffDirect),
      `${sec(r.classicFlank.duration.p50)} / ${sec(r.classicDirect.duration.p50)} / ${sec(r.free.duration.p50)}`,
      `${pct(r.classicFlank.rout)} / ${pct(r.classicDirect.rout)} / ${pct(r.free.rout)}`,
    ]),
  );
  table(
    [
      'Match-up (A v B)',
      'B wins, flank',
      'B wins, direct',
      'B wins, free',
      'Draws (flank / direct / free)',
    ],
    rows.map((r) => [
      match(r.match),
      ci(r.classicFlank.b),
      ci(r.classicDirect.b),
      ci(r.free.b),
      `${pct(r.classicFlank.draw.p)} / ${pct(r.classicDirect.draw.p)} / ${pct(r.free.draw.p)}`,
    ]),
  );
}

if (S['trex-tiger']) {
  compareTable('T. rex vs tiger, morale on', S['trex-tiger'].moraleOn);
  compareTable('T. rex vs tiger, morale off', S['trex-tiger'].moraleOff);
}
if (S['classic']) compareTable('Classic presets', S['classic']);
if (S['species-notes']) compareTable('SPECIES.md §7 match-ups', S['species-notes']);

if (S['interference']) {
  out('### Crowding check');
  out();
  table(
    ['Match-up', '`interference`', 'Runs', 'A wins', 'B wins', 'Median s'],
    S['interference'].map((r) => [
      match(r.match),
      r.match.globals ? '0' : '0 / 0.1 / 0.3 (preset)',
      r.free.runs,
      ci(r.free.a),
      ci(r.free.b),
      sec(r.free.duration.p50),
    ]),
  );
}

if (S['presets']) {
  out('### Presets (free engine)');
  out();
  table(
    ['Preset', 'Sides', 'Runs', 'A wins', 'B wins', 'Draws', 'Median s', 'Rout %', 'Status'],
    S['presets'].map((r) => [
      `\`${r.id}\``,
      match(r.match),
      r.free.runs,
      ci(r.free.a),
      ci(r.free.b),
      pct(r.free.draw.p),
      sec(r.free.duration.p50),
      pct(r.free.rout),
      r.hold ? 'hold' : 'ready',
    ]),
  );
}

if (S['symmetry']) {
  out('### Mirror matches (free engine)');
  out();
  table(
    [
      'Mirror',
      'Runs',
      'A wins',
      'B wins',
      'Draws',
      'A − B (pp, paired)',
      '0 inside?',
      'Median s',
      'Rout %',
    ],
    S['symmetry'].mirrors.map((r) => [
      match(r.match),
      r.free.runs,
      ci(r.free.a),
      ci(r.free.b),
      pct(r.free.draw.p),
      diff(r.diff),
      r.diff.lo <= 0 && r.diff.hi >= 0 ? 'yes' : '**no**',
      sec(r.free.duration.p50),
      pct(r.free.rout),
    ]),
  );
  if (S['symmetry'].rechecks) {
    out('### Mirror recheck (free engine)');
    out();
    table(
      ['Mirror', 'Seed', 'Runs', 'A wins', 'B wins', 'A − B (pp, paired)', '0 inside?'],
      S['symmetry'].rechecks.map((r) => [
        match(r.match),
        r.match.seed,
        r.free.runs,
        ci(r.free.a),
        ci(r.free.b),
        diff(r.diff),
        r.diff.lo <= 0 && r.diff.hi >= 0 ? 'yes' : '**no**',
      ]),
    );
  }
  out('### Side swaps (free engine)');
  out();
  table(
    [
      'Pair',
      'Runs',
      'First order: A wins',
      'Swapped: same species wins',
      'Difference (pp)',
      '0 inside?',
    ],
    S['symmetry'].swaps.map((r) => [
      `${match(r.first.match)} / ${match(r.second.match)}`,
      r.first.free.runs,
      ci(r.first.free.a),
      ci(r.second.free.b),
      diff(r.diff),
      r.diff.lo <= 0 && r.diff.hi >= 0 ? 'yes' : '**no**',
    ]),
  );
}

if (S['monotonic']) {
  const z = 1.959963984540054;
  for (const [key, rows] of Object.entries(S['monotonic'])) {
    out(`### Count sweep: ${key}`);
    out();
    table(
      ['Match-up', 'Runs', 'A wins', 'B wins', 'Median s', 'Rout %', 'Step'],
      rows.map((r, i) => {
        let step = '';
        if (i > 0) {
          const prev = rows[i - 1].free.b;
          const cur = r.free.b;
          // A drop in B's share larger than both intervals allow counts as non-monotonic.
          const se = Math.sqrt(
            (prev.p * (1 - prev.p)) / rows[i - 1].free.runs + (cur.p * (1 - cur.p)) / r.free.runs,
          );
          step = cur.p - prev.p < -z * se ? '**drop**' : 'ok';
        }
        return [
          match(r.match),
          r.free.runs,
          ci(r.free.a),
          ci(r.free.b),
          sec(r.free.duration.p50),
          pct(r.free.rout),
          step,
        ];
      }),
    );
  }
}

/** A step in a count sweep: the varying side's share may not drop by more than both intervals allow. */
function stepCheck(rows, i, side) {
  if (i === 0) return '';
  const z = 1.959963984540054;
  const prev = rows[i - 1].free[side];
  const cur = rows[i].free[side];
  const se = Math.sqrt(
    (prev.p * (1 - prev.p)) / rows[i - 1].free.runs + (cur.p * (1 - cur.p)) / rows[i].free.runs,
  );
  return cur.p - prev.p < -z * se ? '**drop**' : 'ok';
}

const freeRow = (r) => [
  match(r.match),
  r.free.runs,
  ci(r.free.a),
  ci(r.free.b),
  pct(r.free.draw.p),
  sec(r.free.duration.p50),
  pct(r.free.rout),
];
const FREE_HEAD = ['Match-up', 'Runs', 'A wins', 'B wins', 'Draws', 'Median s', 'Rout %'];

/**
 * The add-a-species tables of one species section (polar bear, hippo): mirror matches, count
 * sweeps, side swaps, comparison rows, much larger opponents and one-at-a-time sensitivity.
 * `varyA` lists the sweeps in which side A (the species itself) varies; in the others side B does.
 */
function speciesTables(pb, { title, varyA, sanityTitle, sensitivityTitle }) {
  out(`### ${title}: mirror matches`);
  out();
  table(
    ['Mirror', 'Runs', 'A wins', 'B wins', 'Draws', 'A − B (pp, paired)', '0 inside?', 'Median s'],
    pb.mirrors.map((r) => [
      match(r.match),
      r.free.runs,
      ci(r.free.a),
      ci(r.free.b),
      pct(r.free.draw.p),
      diff(r.diff),
      r.diff.lo <= 0 && r.diff.hi >= 0 ? 'yes' : '**no**',
      sec(r.free.duration.p50),
    ]),
  );
  for (const [key, rows] of Object.entries(pb.sweeps)) {
    const side = varyA.includes(key) ? 'a' : 'b';
    out(`### ${title}: count sweep ${key} (side ${side.toUpperCase()} varies)`);
    out();
    table(
      [...FREE_HEAD, 'Step'],
      rows.map((r, i) => [...freeRow(r), stepCheck(rows, i, side)]),
    );
  }
  out(`### ${title}: side swaps`);
  out();
  table(
    [
      'Pair',
      'Runs',
      'First order: A wins',
      'Swapped: same species wins',
      'Difference (pp)',
      '0 inside?',
    ],
    pb.pairs.map((r) => [
      `${match(r.first.match)} / ${match(r.second.match)}`,
      r.first.free.runs,
      ci(r.first.free.a),
      ci(r.second.free.b),
      diff(r.diff),
      r.diff.lo <= 0 && r.diff.hi >= 0 ? 'yes' : '**no**',
    ]),
  );
  out(`### ${title}: ${sanityTitle}`);
  out();
  table(FREE_HEAD, pb.sanity.map(freeRow));
  out(`### ${title}: much larger opponents`);
  out();
  table(FREE_HEAD, pb.flight.map(freeRow));
  sensitivityTable(`${title}: one-at-a-time sensitivity (${sensitivityTitle})`, pb.sensitivity);
}

/** One one-at-a-time sensitivity table: `sens` holds the base run and the pinned runs per trait. */
function sensitivityTable(heading, sens) {
  out(`### ${heading}`);
  out();
  const base = sens.base.free;
  table(
    ['Trait (S)', 'Range', 'A wins at min', 'A wins at max', 'Swing (pp)', 'Median s (min / max)'],
    [
      ['all at preset', '–', ci(base.a), ci(base.a), '–', sec(base.duration.p50)],
      ...sens.traits.map((t) => [
        `\`${t.trait}\``,
        `${t.range.min} – ${t.range.max}`,
        ci(t.low.free.a),
        ci(t.high.free.a),
        `${t.high.free.a.p - t.low.free.a.p >= 0 ? '+' : ''}${pct(t.high.free.a.p - t.low.free.a.p)}`,
        `${sec(t.low.free.duration.p50)} / ${sec(t.high.free.duration.p50)}`,
      ]),
    ],
  );
}

if (S['polar-bear']) {
  // The varying side is B, except in the sweep of polar bears against one T. rex.
  speciesTables(S['polar-bear'], {
    title: 'Polar bear',
    varyA: ['vsTrex'],
    sanityTitle: 'next to the brown bear',
    sensitivityTitle: 'polar bear 1 v brown bear 1',
  });
}

if (S['hippo']) {
  speciesTables(S['hippo'], {
    title: 'Hippo',
    varyA: ['vsElephant', 'vsTrex'],
    sanityTitle: 'next to the other heavy species and the lion',
    sensitivityTitle: 'hippo 1 v elephant 1',
  });
}

if (S['raptor']) {
  speciesTables(S['raptor'], {
    title: 'Raptor',
    varyA: ['vsTrex', 'vsBuffalo', 'vsHippo'],
    sanityTitle: 'next to animals of similar mass and the other social hunters',
    sensitivityTitle: '_Utahraptor_ 12 v _T. rex_ 1, preset #18',
  });
  out('### Raptor: rout check against one _T. rex_ (raptors and lions in the same numbers)');
  out();
  table(FREE_HEAD, S['raptor'].routCheck.map(freeRow));
}

if (S['white-rhino']) {
  speciesTables(S['white-rhino'], {
    title: 'White rhino',
    varyA: ['vsElephant', 'vsTrex'],
    sanityTitle: 'next to the other heavy species and the lion',
    sensitivityTitle: 'white rhino 1 v elephant 1, preset #14',
  });
  sensitivityTable(
    'White rhino: one-at-a-time sensitivity (white rhino 1 v hippo 1, preset #15)',
    S['white-rhino'].sensitivityHippo,
  );
}

if (S['spinosaurus']) {
  speciesTables(S['spinosaurus'], {
    title: 'Spinosaurus',
    varyA: ['vsTrex', 'vsElephant'],
    sanityTitle: 'next to the other heavy species',
    sensitivityTitle: 'Spinosaurus 1 v T. rex 1, preset #12',
  });
  sensitivityTable(
    'Spinosaurus: one-at-a-time sensitivity (Spinosaurus 1 v elephant 1)',
    S['spinosaurus'].sensitivityElephant,
  );
}

out(
  `Generated from ${path.relative(ROOT, file)} (commit ${data.commit.slice(0, 7)}, ${data.node}).`,
);
