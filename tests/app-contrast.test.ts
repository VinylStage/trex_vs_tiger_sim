import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * WCAG AA contrast of the simulator's own colour roles (src/ui/styles.css), in both themes:
 * text 4.5:1 (1.4.3), form-control outlines 3:1 against every surface they sit on (1.4.11).
 * The content pages are checked in tests/pages.test.ts against the mirrored tokens.
 */

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

function tokens(dark: boolean): Map<string, string> {
  const read = (block: string | undefined, into: Map<string, string>): void => {
    for (const m of (block ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      into.set(m[1] ?? '', (m[2] ?? '').trim());
    }
  };
  const vars = new Map<string, string>();
  read(/^:root\s*\{([^}]*)\}/m.exec(css)?.[1], vars);
  if (dark)
    read(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1], vars);
  return vars;
}

function colour(vars: ReadonlyMap<string, string>, name: string): string {
  let value = vars.get(name) ?? '';
  for (let hops = 0; hops < 5; hops++) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    if (!ref) break;
    value = vars.get(ref[1] ?? '') ?? '';
  }
  expect(value, `${name} resolves to #rrggbb`).toMatch(/^#[0-9a-f]{6}$/i);
  return value;
}

function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const channel = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const PAIRS: readonly (readonly [fg: string, bg: string, min: number, where: string])[] = [
  ['--accent-fill-fg', '--accent-fill', 4.5, 'Run button, primary buttons'],
  ['--accent-fill-fg', '--accent-fill-hover', 4.5, 'primary button hover'],
  ['--accent-text', '--bg', 4.5, 'links on the page background (intro, footer)'],
  ['--accent-text', '--surface', 4.5, 'links in panels and dialogs'],
  ['--accent-text', '--surface-2', 4.5, 'links on tinted boxes'],
  ['--control-border', '--surface', 3, 'input and select outline in panels'],
  ['--control-border', '--surface-2', 3, 'input and select outline on tinted boxes'],
  ['--control-border', '--bg', 3, 'input and select outline on the page background'],
  ['--fg', '--surface', 4.5, 'body text in panels'],
  ['--muted', '--surface', 4.5, 'hints'],
  ['--muted', '--surface-2', 4.5, 'hints on tinted boxes'],
];

describe('src/ui/styles.css colour roles', () => {
  it.each(
    [false, true].flatMap((dark) =>
      PAIRS.map(([fg, bg, min, where]) => ({ dark, fg, bg, min, where })),
    ),
  )('$fg on $bg ($where) reaches $min:1 (dark: $dark)', ({ dark, fg, bg, min }) => {
    const vars = tokens(dark);
    expect(contrastRatio(colour(vars, fg), colour(vars, bg))).toBeGreaterThanOrEqual(min);
  });

  it('fills primary buttons, outlines controls and colours links with these roles', () => {
    const rule = (selector: string): string => {
      const at = css.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf('}', at));
    };
    expect(rule('.btn-primary')).toContain('background: var(--accent-fill)');
    expect(rule('.btn-primary:hover:not(:disabled)')).toContain(
      'background: var(--accent-fill-hover)',
    );
    expect(rule("input[type='number'],\nselect")).toContain('var(--control-border)');
    expect(rule('\na')).toContain('color: var(--accent-text)');
  });
});
