import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * No width under src/ is set in ch (#138). ch is the advance of "0" in the font in use: 0.5613em
 * in the size-adjusted fallback face and 0.5957em in Pretendard, so a ch width grows by 6% when
 * the web font swaps in and the text in it re-wraps, which shifts the page
 * (docs/PERFORMANCE.md#text-widths-in-em-138). Write n ch of Pretendard as n × 0.5957em instead.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const WIDTH_PROPERTY = /^(?:min-|max-)?(?:width|inline-size)$/i;
const CH_LENGTH = /(?<![\w.-])(?:\d+(?:\.\d*)?|\.\d+)ch(?![\w-])/i;

/** Declarations of a width property whose value uses the ch unit, as `property: value`. */
function chWidths(css: string): string[] {
  const found: string[] = [];
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of code.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:\s*([^;{}]*)/gi)) {
    const [, property = '', value = ''] = m;
    if (WIDTH_PROPERTY.test(property) && CH_LENGTH.test(value)) {
      found.push(`${property}: ${value.trim()}`);
    }
  }
  return found;
}

function stylesheets(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return stylesheets(rel);
    return e.name.endsWith('.css') ? [rel] : [];
  });
}

describe('widths in ch', () => {
  it('finds the stylesheets under src/', () => {
    const files = stylesheets('src');
    for (const f of ['src/pages/site.css', 'src/ui/styles.css', 'src/ui/site-footer.css']) {
      expect(files).toContain(f);
    }
  });

  it('are not used in any stylesheet under src/', () => {
    const found = stylesheets('src').flatMap((f) =>
      chWidths(readFileSync(join(ROOT, f), 'utf8')).map((d) => `${f}: ${d}`),
    );
    expect(found, 'use em: n ch of Pretendard is n × 0.5957em').toEqual([]);
  });

  it('are detected in plain and minified declarations', () => {
    expect(chWidths('.page-body p,\n.page-body li {\n  max-width: 70ch;\n}')).toEqual([
      'max-width: 70ch',
    ]);
    expect(chWidths('.a{color:red;max-width:72ch}.b{min-width:5ch}')).toEqual([
      'max-width: 72ch',
      'min-width: 5ch',
    ]);
    expect(chWidths('.a { width: calc(100% - 2.5ch); max-inline-size: .5CH }')).toEqual([
      'width: calc(100% - 2.5ch)',
      'max-inline-size: .5CH',
    ]);
  });

  it('are not confused with em widths, comments, other properties or media queries', () => {
    expect(chWidths('/* 70ch */ .a { max-width: 41.7em; }')).toEqual([]);
    expect(chWidths('.a { padding-inline: 1ch; font: 1rem/1.5 x-ch; }')).toEqual([]);
    expect(chWidths('.a { max-width: var(--w-10ch); }')).toEqual([]);
    expect(chWidths('@media (max-width: 60ch) { .a { width: 100%; } }')).toEqual([]);
  });
});
