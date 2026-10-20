import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEAVY_SPECIES_IDS, PACK_SPECIES_IDS } from '../src/sim/species';

/*
 * The onboarding docs drifted from the roster twice (#45 → #54, found by the #82 audit). These
 * checks fail when a species is added or removed without updating README and ARCHITECTURE.
 */

const read = (file: string): string => readFileSync(file, 'utf8');

/** Items of the README feature line "(heavy: a, b, …; pack: c, d, …)". */
function readmeRoster(): { heavy: string[]; pack: string[] } {
  const m = /\(heavy: ([^;]+); pack: ([^)]+)\)/.exec(read('README.md'));
  if (!m) throw new Error('README species line not found');
  const split = (s: string): string[] => s.split(',').map((x) => x.trim());
  return { heavy: split(m[1] ?? ''), pack: split(m[2] ?? '') };
}

describe('docs list the species roster the code has', () => {
  it('README names as many heavy and pack species as species.ts has', () => {
    const { heavy, pack } = readmeRoster();
    expect(heavy).toHaveLength(HEAVY_SPECIES_IDS.length);
    expect(pack).toHaveLength(PACK_SPECIES_IDS.length);
  });

  it('ARCHITECTURE labels the registry with the current counts', () => {
    expect(read('ARCHITECTURE.md')).toContain(
      `roster: ${HEAVY_SPECIES_IDS.length} heavy, ${PACK_SPECIES_IDS.length} pack`,
    );
  });

  it('ARCHITECTURE no longer describes aggregation on the main thread', () => {
    const arch = read('ARCHITECTURE.md');
    expect(arch).not.toContain('UI->>UI: aggregate');
    expect(arch).not.toMatch(/\bapp --> mc\b/);
  });
});
