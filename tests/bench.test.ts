import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { checkPages, expandMatrix, median, pageSizes } from '../bench/lib.mjs';
import { FREE_PRESETS } from '../src/sim/free/presets';
import { FREE_SPECIES_IDS } from '../src/sim/free/species';

/*
 * The deterministic half of the standing performance checks (#241, docs/PERFORMANCE.md
 * "Standing performance checks"): which scenarios the matrix holds, and how page sizes are
 * counted. Timing itself runs only in `npm run bench` and the CI perf job.
 */

const spec: unknown = JSON.parse(readFileSync('bench/scenarios.json', 'utf8'));
const budgets = JSON.parse(readFileSync('bench/budgets.json', 'utf8')) as {
  baseline: string;
  scenarios: Record<string, { msMedian: number; msP95: number }>;
  pages: Record<string, { gzipBytes: number }>;
};
const sim = { FREE_PRESETS, FREE_SPECIES_IDS };
const full = expandMatrix(spec, sim);
const reduced = expandMatrix(spec, sim, { reduced: true });
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe('bench scenario matrix', () => {
  it('has unique ids', () => {
    expect(new Set(ids(full)).size).toBe(full.length);
  });

  it('holds the scale ladder 1v1 to 500v5000', () => {
    expect(ids(full.filter((s) => s.group === 'scale'))).toEqual([
      'scale-1v1',
      'scale-10v100',
      'scale-50v1000',
      'scale-500v5000',
    ]);
  });

  it('holds every preset in both flight modes', () => {
    for (const p of FREE_PRESETS) {
      expect(ids(full)).toContain(`preset-${p.id}-allIn`);
      expect(ids(full)).toContain(`preset-${p.id}-realistic`);
    }
  });

  it('holds every species of the registry as a mirror and against a reference', () => {
    for (const sp of FREE_SPECIES_IDS) {
      const rows = full.filter((s) => s.group === 'species' && s.a === sp);
      expect(rows).toHaveLength(2);
      expect(rows.some((s) => s.b === sp)).toBe(true);
      expect(rows.some((s) => s.b !== sp)).toBe(true);
    }
  });

  it('adds rows for a new species without editing scenarios.json', () => {
    const more = expandMatrix(spec, {
      ...sim,
      FREE_SPECIES_IDS: [...FREE_SPECIES_IDS, 'newcomer'],
    });
    expect(ids(more)).toContain('species-newcomer-mirror');
    expect(ids(more)).toContain('species-newcomer-v-trex');
  });

  it('reduces to a subset of the full matrix with fewer runs', () => {
    const byId = new Map(full.map((s) => [s.id, s]));
    expect(reduced.length).toBeGreaterThan(0);
    expect(reduced.length).toBeLessThan(full.length);
    for (const s of reduced) {
      const f = byId.get(s.id);
      expect(f).toBeDefined();
      expect(s.runs).toBeLessThanOrEqual(f?.runs ?? 0);
    }
  });

  it('has a ceiling for every scenario of the full matrix', () => {
    expect(Object.keys(budgets.scenarios).sort()).toEqual(ids(full).sort());
    for (const b of Object.values(budgets.scenarios)) {
      expect(b.msMedian).toBeGreaterThan(0);
      expect(b.msP95).toBeGreaterThanOrEqual(b.msMedian);
    }
  });

  it('names a committed baseline that holds the full matrix', () => {
    const base = JSON.parse(readFileSync(budgets.baseline, 'utf8')) as {
      matrix: string;
      results: { id: string }[];
    };
    expect(base.matrix).toBe('full');
    expect(ids(base.results).sort()).toEqual(ids(full).sort());
  });
});

describe('bench helpers', () => {
  it('takes the median of an odd and an even count', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('counts a page’s module scripts and preloads once each, gzipped', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'bench-dist-'));
    mkdirSync(path.join(dist, 'assets'));
    mkdirSync(path.join(dist, 'en'));
    const a = 'export const a = 1;\n'.repeat(50);
    const b = 'export const b = 2;\n'.repeat(80);
    writeFileSync(path.join(dist, 'assets', 'a.js'), a);
    writeFileSync(path.join(dist, 'assets', 'b.js'), b);
    writeFileSync(
      path.join(dist, 'index.html'),
      '<script>inline()</script><script type="module" crossorigin src="/assets/a.js"></script>' +
        '<link rel="modulepreload" crossorigin href="/assets/b.js"><link rel="modulepreload" href="/assets/a.js">',
    );
    writeFileSync(path.join(dist, 'en', 'index.html'), '<p>no scripts</p>');
    const sizes = pageSizes(dist);
    const gz = (s: string) => gzipSync(s, { level: 9 }).length;
    expect(sizes['index.html']?.gzipBytes).toBe(gz(a) + gz(b));
    expect(sizes['en/index.html']?.gzipBytes).toBe(0);
    const rows = checkPages(sizes, { pages: { 'index.html': { gzipBytes: gz(a) } } });
    expect(rows.find((r) => r.page === 'index.html')?.status).toBe('over');
    expect(rows.find((r) => r.page === 'en/index.html')?.status).toBe('unlisted');
  });
});
