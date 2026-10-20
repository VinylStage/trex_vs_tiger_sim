import { describe, expect, it } from 'vitest';
import {
  BLEND,
  FALLBACK_COLORS,
  REPLAY_TOKENS,
  blend,
  contrast,
  deriveTheme,
  parseHex,
  type BaseColor,
} from '../src/ui/replay/theme';

// The stylesheet as text. Vitest does not load CSS (a `?raw` import comes back empty), and this
// branch has no Node type definitions, so `node:fs` is imported untyped.
const fs = (await import(`node:${'fs'}`)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string;
};
const css = fs.readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

/** Custom properties of the light `:root` block, or of the dark-scheme override. */
function tokens(dark: boolean): Map<string, string> {
  const block = dark
    ? /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)
    : /^:root\s*\{([^}]*)\}/m.exec(css);
  const out = new Map<string, string>();
  for (const m of (block?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    out.set(m[1] ?? '', (m[2] ?? '').trim());
  return out;
}

function palette(dark: boolean): Record<BaseColor, string> {
  const light = tokens(false);
  const theme = dark ? new Map([...light, ...tokens(true)]) : light;
  const out = {} as Record<BaseColor, string>;
  for (const key of Object.keys(REPLAY_TOKENS) as BaseColor[]) {
    const v = theme.get(REPLAY_TOKENS[key]);
    if (v === undefined) throw new Error(`${REPLAY_TOKENS[key]} missing (dark: ${dark})`);
    out[key] = v;
  }
  return out;
}

describe('replay colour tokens (V2)', () => {
  it.each([false, true])('defines every replay token as a hex colour (dark: %s)', (dark) => {
    const pal = palette(dark);
    for (const [k, v] of Object.entries(pal)) expect(parseHex(v), k).not.toBeNull();
  });

  it.each([false, true])('gives every agent colour ≥ 3:1 against the arena (dark: %s)', (dark) => {
    const pal = palette(dark);
    for (const role of ['heavy', 'pack', 'out', 'dead'] as const) {
      const ratio = contrast(pal[role], pal.arena);
      expect(
        ratio,
        `${role} ${pal[role]} on ${pal.arena}: ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it.each([false, true])('keeps the two sides apart in lightness (dark: %s)', (dark) => {
    // Under achromatopsia only lightness is left. Shape carries the state, but the two sides
    // should still not collapse into one grey.
    const pal = palette(dark);
    expect(contrast(pal.heavy, pal.pack)).toBeGreaterThanOrEqual(1.3);
  });

  it('uses the light tokens as the built-in fallback', () => {
    const pal = palette(false);
    for (const key of Object.keys(REPLAY_TOKENS) as BaseColor[])
      expect(FALLBACK_COLORS[key].toLowerCase(), key).toBe(pal[key].toLowerCase());
  });
});

describe('colour helpers', () => {
  it('parses #rgb and #rrggbb', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex(' #0072B2 ')).toEqual([0, 114, 178]);
    expect(parseHex('rgb(0,0,0)')).toBeNull();
  });

  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('blends like canvas source-over on an opaque background', () => {
    expect(blend('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(blend('#0072b2', '#f3f2ee', 0)).toBe('#f3f2ee');
    expect(blend('#0072b2', '#f3f2ee', 1)).toBe('#0072b2');
    expect(blend('oops', '#ffffff', 0.5)).toBe('oops');
  });

  it('pre-blends every translucent paint into an opaque colour', () => {
    const theme = deriveTheme(FALLBACK_COLORS, 'sans-serif');
    expect(theme.heavyTint).toBe(
      blend(FALLBACK_COLORS.heavy, FALLBACK_COLORS.arena, BLEND.heavyTint),
    );
    for (const key of [
      'heavyTint',
      'deadMark',
      'deadHeavy',
      'tether',
      'biteLine',
      'lodRecover',
      'lodRouted',
    ] as const)
      expect(parseHex(theme[key]), key).not.toBeNull();
  });
});
