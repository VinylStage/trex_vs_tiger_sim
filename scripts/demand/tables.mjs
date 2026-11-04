// Prints the Markdown tables of docs/research/DEMAND.md from the committed results.
//
//   node scripts/demand/tables.mjs [results.json]
//
// Dev-only, no dependencies, no network. The report's tables are pasted from this output, so a
// quarterly rerun of run.mjs followed by this script shows exactly which numbers moved.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { argv, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { compact } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = argv[2] ?? path.join(ROOT, 'docs', 'research', 'demand-results.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const out = (line = '') => stdout.write(`${line}\n`);
const byId = new Map(data.species.map((s) => [s.id, s]));
const name = (s) => `${s.en} (${s.ko})`;
const issue = (s) => (s.issue ? `#${s.issue}` : '–');
const row = (cells) => out(`| ${cells.join(' | ')} |`);

out(`Window ${data.window.start} to ${data.window.end} (exclusive), run ${data.runDate}.`);
out();
out('### Summary (all species, by combined score)');
out();
row([
  '#',
  'Species',
  'Group',
  'Wiki en',
  'Wiki ko',
  'r/whowouldwin',
  'YT en top 10',
  'YT ko top 10',
  'YT en est.',
  'YT ko est.',
  'Score',
]);
row(['--:', '---', '---', '--:', '--:', '--:', '--:', '--:', '--:', '--:', '--:']);
for (const sc of data.scores) {
  const s = byId.get(sc.id);
  row([
    sc.rank,
    name(s),
    s.group === 'sim' ? 'in sim' : `candidate ${issue(s)}`,
    compact(s.wiki.en?.total),
    compact(s.wiki.ko?.total),
    compact(s.reddit?.total),
    compact(s.youtube.en?.topViews),
    compact(s.youtube.ko?.topViews),
    compact(s.youtube.en?.totalResults),
    compact(s.youtube.ko?.totalResults),
    `${sc.score.toFixed(1)}${sc.coverage < 1 ? ` (${Math.round(sc.coverage * 100)} %)` : ''}`,
  ]);
}

out();
out('### Candidates only');
out();
row([
  'Rank',
  'Candidate',
  'Issue',
  'Score',
  'Overall rank',
  'Reddit part',
  'YouTube parts (en / ko)',
  'Wiki parts (en / ko)',
]);
row(['--:', '---', '---', '--:', '--:', '--:', '---', '---']);
const p = (x) => (x === null || x === undefined ? '–' : x.toFixed(2));
let r = 0;
for (const sc of data.scores) {
  const s = byId.get(sc.id);
  if (s.group !== 'candidate') continue;
  r++;
  row([
    r,
    name(s),
    issue(s),
    sc.score.toFixed(1),
    sc.rank,
    p(sc.parts.reddit),
    `${p(sc.parts.youtubeEn)} / ${p(sc.parts.youtubeKo)}`,
    `${p(sc.parts.wikiEn)} / ${p(sc.parts.wikiKo)}`,
  ]);
}

out();
out('### Search terms');
out();
row([
  'Species',
  'Wikipedia en',
  'Wikipedia ko',
  'r/whowouldwin title query',
  'YouTube en',
  'YouTube ko',
]);
row(['---', '---', '---', '---', '---', '---']);
for (const s of data.species) {
  const t = s.terms;
  row([
    s.en,
    t.wiki.en.join(', '),
    t.wiki.ko.join(', '),
    `\`${t.reddit}\``,
    `\`${t.youtube.en}\``,
    `\`${t.youtube.ko}\``,
  ]);
}

out();
const q = data.youtubeQuota;
out(
  `YouTube quota: the data set took ${q.searchCalls + q.cachedSearch} search.list and ${q.videosCalls + q.cachedVideos} videos.list calls, ${q.datasetUnits} units of the 10,000-unit daily quota (the last run sent ${q.units} units; the rest came from the local cache).`,
);
if (data.errors.length) {
  out();
  out('Notes from the run:');
  for (const e of data.errors) out(`- ${e}`);
}
