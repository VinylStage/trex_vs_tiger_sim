import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_CASES,
  FREE_CASES,
  captureClassic,
  captureFree,
  captureMath,
  type Mv2Golden,
} from './mv2-golden-capture';

/**
 * Golden fixture of free `mv` 2 and classic model 2 (#169, #197): deterministic math and the
 * per-species flight traits. Like every golden it must never be regenerated; the older goldens
 * keep pinning model 1. The same fixture is checked under JavaScriptCore by
 * `npm run test:jsc` (scripts/cross-engine/check-goldens.mjs), so both engines must give these
 * numbers bit for bit (docs/MODEL.md §2.2).
 *
 * The fixture is written only when it does not exist yet (`CAPTURE_MV2_GOLDEN=<label>`).
 */

const FIXTURE = new URL('./fixtures/mv2-golden.json', import.meta.url);

if (process.env['CAPTURE_MV2_GOLDEN'] && !existsSync(FIXTURE)) {
  const { captureAll } = await import('./mv2-golden-capture');
  writeFileSync(
    FIXTURE,
    `${JSON.stringify(captureAll(process.env['CAPTURE_MV2_GOLDEN']), null, 1)}\n`,
  );
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Mv2Golden;

describe(`model 2 reproduces bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every case', () => {
    expect(golden.free.map((c) => c.name)).toEqual(FREE_CASES.map((c) => c.name));
    expect(golden.classic.map((c) => c.name)).toEqual(CLASSIC_CASES.map((c) => c.name));
  });

  it('deterministic math and Rng.normal()', () => {
    expect(captureMath()).toEqual(golden.math);
  });

  it.each(golden.free.map((g, i) => [g.name, g, FREE_CASES[i]] as const))('free: %s', (_, g, c) => {
    expect(captureFree(g.name, g.input, c?.opts)).toEqual(g);
  });

  it.each(golden.classic.map((g) => [g.name, g] as const))('classic: %s', (_, g) => {
    expect(captureClassic(g.name, g.input)).toEqual(g);
  });
});
