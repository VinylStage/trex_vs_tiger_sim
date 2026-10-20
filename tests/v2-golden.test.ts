import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expectGoldenCase, type GoldenCase } from './golden-helpers';

/**
 * Golden fixtures for the species roster shipped in v0.2.0, captured from origin/main 9ef2a63
 * (its `src/sim` is identical to the v0.2.0 release 435f9a6), not from a feature branch: every
 * v0.2.0 preset and every elephant/buffalo/brown-bear × lion/wolf/hyena pair. New species and
 * mechanics must keep these results bit for bit: design matrix, run summaries, aggregate and the
 * replay trace of the representative run. Keep this test forever; NEVER regenerate the fixture.
 */
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/v2-golden.json', import.meta.url), 'utf8'),
) as { capturedFrom: string; cases: GoldenCase[] };

describe(`v0.2.0 species results reproduce bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every shipped preset and every non-default pair', () => {
    expect(golden.cases.filter((c) => c.name.startsWith('preset:'))).toHaveLength(7);
    expect(golden.cases.filter((c) => c.name.startsWith('pair:'))).toHaveLength(9);
  });

  it.each(golden.cases)('$name', (g) => {
    expectGoldenCase(g);
  });
});
