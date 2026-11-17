// Cross-engine check of the model 2 and model 3 goldens (#197, #230, docs/MODEL.md §2.2).
//
//   bun scripts/cross-engine/check-goldens.mjs      (npm run test:jsc)
//
// Recomputes tests/fixtures/mv2-golden.json and tests/fixtures/mv3-golden.json with the shared
// capture code (tests/mv2-golden-capture.ts, which Bun loads as TypeScript) and exits non-zero on
// any difference. vitest checks the same fixtures under V8 (tests/mv2-golden.test.ts,
// tests/mv3-golden.test.ts); run here under Bun it checks JavaScriptCore, so a pass on both means
// a link of free `mv` 2 or 3, or classic model 2 or 3, gives the same battle in both engines. Dev
// and CI only: nothing here reaches the site bundle.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { captureAll, captureAllMv3, compareGolden } from '../../tests/mv2-golden-capture.ts';

const engine =
  typeof globalThis.Bun === 'object'
    ? `Bun ${globalThis.Bun.version} (JavaScriptCore)`
    : `Node ${process.version} (V8)`;
let failed = false;
for (const [label, file, capture] of [
  ['model 2', 'mv2-golden.json', captureAll],
  ['model 3', 'mv3-golden.json', captureAllMv3],
]) {
  const fixture = new URL(`../../tests/fixtures/${file}`, import.meta.url);
  const expected = JSON.parse(readFileSync(fixture, 'utf8'));
  const diff = compareGolden(expected, capture(expected.capturedFrom));
  const cases = expected.free.length + expected.classic.length;
  if (diff.length > 0) {
    failed = true;
    console.error(`${engine}: ${String(diff.length)} part(s) differ from the ${label} golden:`);
    for (const d of diff) console.error(`  - ${d}`);
  } else {
    console.log(
      `${engine}: math, Rng.normal() and ${String(cases)} cases match the ${label} golden.`,
    );
  }
}
if (failed) process.exit(1);
