import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_CASES_MV3,
  FREE_CASES_MV3,
  captureClassic,
  captureFree,
  captureMath,
  type Mv2Golden,
} from './mv2-golden-capture';

/**
 * Golden fixture of free `mv` 3 and classic model 3 (#230): a battle ends only when one side has
 * nobody left in play (a routed animal counts until it escapes across the edge), and the default
 * time limit is 3,600 s
 * (docs/MODEL.md §2.4). Like every golden it must never be regenerated; tests/mv2-golden.test.ts
 * keeps pinning model 2. The same fixture is checked under JavaScriptCore by `npm run test:jsc`
 * (scripts/cross-engine/check-goldens.mjs).
 *
 * The fixture is written only when it does not exist yet (`CAPTURE_MV3_GOLDEN=<label>`).
 */

const FIXTURE = new URL('./fixtures/mv3-golden.json', import.meta.url);

if (process.env['CAPTURE_MV3_GOLDEN'] && !existsSync(FIXTURE)) {
  const { captureAllMv3 } = await import('./mv2-golden-capture');
  writeFileSync(
    FIXTURE,
    `${JSON.stringify(captureAllMv3(process.env['CAPTURE_MV3_GOLDEN']), null, 1)}\n`,
  );
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Mv2Golden;

describe(`model 3 reproduces bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every case', () => {
    expect(golden.free.map((c) => c.name)).toEqual(FREE_CASES_MV3.map((c) => c.name));
    expect(golden.classic.map((c) => c.name)).toEqual(CLASSIC_CASES_MV3.map((c) => c.name));
  });

  it('deterministic math and Rng.normal()', () => {
    expect(captureMath()).toEqual(golden.math);
  });

  it.each(golden.free.map((g, i) => [g.name, g, FREE_CASES_MV3[i]] as const))(
    'free: %s',
    (_, g, c) => {
      expect(captureFree(g.name, g.input, c?.opts, 3)).toEqual(g);
    },
    120_000,
  );

  it.each(golden.classic.map((g) => [g.name, g] as const))('classic: %s', (_, g) => {
    expect(captureClassic(g.name, g.input, 3)).toEqual(g);
  });

  it('pins the end rules it was captured for', () => {
    const byName = new Map(golden.free.map((g) => [g.name, g]));
    // The end reason is the last number of a model 3 row: 0 wipe-out, 1 rout, 2 time limit.
    const reasons = (name: string): number[] =>
      (byName.get(name)?.summaries ?? []).map((r) => r[r.length - 1] as number);
    expect(reasons('lion 5 v tiger 5, 60 s time limit (draws on the time limit)')).toContain(2);
    expect(
      reasons('homoErectus 100 v trex 1 (morale off: nobody flees)').every((r) => r === 0),
    ).toBe(true);
    expect(
      reasons('homoErectus 100 v trex 1 (allIn: the group routs and escapes)').every(
        (r) => r === 1,
      ),
    ).toBe(true);
    expect(
      reasons('homoErectus 100 v trex 1 (realistic: the group flees and escapes)').every(
        (r) => r === 1,
      ),
    ).toBe(true);
  });
});
