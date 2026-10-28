// Prints the Markdown tables of docs/research/CALIBRATION.md from the committed results.
//
//   node scripts/calibration/tables.mjs [results.json]
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

out(
  `Generated from ${path.relative(ROOT, file)} (commit ${data.commit.slice(0, 7)}, ${data.node}).`,
);
