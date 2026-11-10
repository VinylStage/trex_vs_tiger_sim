// Cross-engine check of the model 2 goldens (#197, docs/MODEL.md §2.2).
//
//   bun scripts/cross-engine/check-goldens.mjs      (npm run test:jsc)
//
// Recomputes tests/fixtures/mv2-golden.json with the shared capture code
// (tests/mv2-golden-capture.ts, which Bun loads as TypeScript) and exits non-zero on any
// difference. vitest checks the same fixture under V8 (tests/mv2-golden.test.ts); run here under
// Bun it checks JavaScriptCore, so a pass on both means a link of free `mv` 2 or classic model 2
// gives the same battle in both engines. Dev and CI only: nothing here reaches the site bundle.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { captureAll, compareGolden } from '../../tests/mv2-golden-capture.ts';

const fixture = new URL('../../tests/fixtures/mv2-golden.json', import.meta.url);
const expected = JSON.parse(readFileSync(fixture, 'utf8'));
const engine =
  typeof globalThis.Bun === 'object'
    ? `Bun ${globalThis.Bun.version} (JavaScriptCore)`
    : `Node ${process.version} (V8)`;
const diff = compareGolden(expected, captureAll(expected.capturedFrom));
const cases = expected.free.length + expected.classic.length;
if (diff.length > 0) {
  console.error(`${engine}: ${String(diff.length)} part(s) differ from the model 2 golden:`);
  for (const d of diff) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`${engine}: math, Rng.normal() and ${String(cases)} cases match the model 2 golden.`);
