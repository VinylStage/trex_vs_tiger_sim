import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FREE_CASES_MV4, captureFree, captureMath, type Mv2Golden } from './mv2-golden-capture';

/**
 * Golden fixture of free `mv` 4 (#237): an agent that wants to latch closes the step its target
 * takes while backing off in Recover (docs/MODEL.md §3.10). Classic stays at model 3, pinned by
 * tests/mv3-golden.test.ts, so this golden has free cases only. Like every golden it must never be
 * regenerated. The same fixture is checked under JavaScriptCore by `npm run test:jsc`
 * (scripts/cross-engine/check-goldens.mjs).
 *
 * The fixture is written only when it does not exist yet (`CAPTURE_MV4_GOLDEN=<label>`).
 */

const FIXTURE = new URL('./fixtures/mv4-golden.json', import.meta.url);

if (process.env['CAPTURE_MV4_GOLDEN'] && !existsSync(FIXTURE)) {
  const { captureAllMv4 } = await import('./mv2-golden-capture');
  writeFileSync(
    FIXTURE,
    `${JSON.stringify(captureAllMv4(process.env['CAPTURE_MV4_GOLDEN']), null, 1)}\n`,
  );
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Mv2Golden;

describe(`free model 4 reproduces bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every case, and no classic case', () => {
    expect(golden.free.map((c) => c.name)).toEqual(FREE_CASES_MV4.map((c) => c.name));
    expect(golden.classic).toEqual([]);
  });

  it('deterministic math and Rng.normal()', () => {
    expect(captureMath()).toEqual(golden.math);
  });

  it.each(golden.free.map((g, i) => [g.name, g, FREE_CASES_MV4[i]] as const))(
    'free: %s',
    (_, g, c) => {
      expect(captureFree(g.name, g.input, c?.opts, 4)).toEqual(g);
    },
    120_000,
  );

  it('differs from model 3 where the retreat step acts', async () => {
    const { FREE_CASES_MV3 } = await import('./mv2-golden-capture');
    const mv3 = JSON.parse(
      readFileSync(new URL('./fixtures/mv3-golden.json', import.meta.url), 'utf8'),
    ) as Mv2Golden;
    const changed = mv3.free.filter(
      (g, i) => JSON.stringify(g.summaries) !== JSON.stringify(golden.free[i]?.summaries),
    );
    expect(FREE_CASES_MV3.length).toBe(mv3.free.length);
    expect(changed.length).toBeGreaterThan(0);
  });
});
