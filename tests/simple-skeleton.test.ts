import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The Simple results skeleton (#251, docs/PERFORMANCE.md "Layout shift when Simple results
 * render"): on the first Run the results panel shows its final blocks with same-length
 * placeholders. They must stay in the layout (visibility, not display or `hidden`) so they hold the
 * final size, and the release check must not take the skeleton for the verdict.
 */

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** The declarations of the rule whose selector list contains `selector`. */
function ruleFor(css: string, selector: string): string | null {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1] ?? '').split(',').map((s) => s.trim());
    if (selectors.includes(selector)) return m[2] ?? '';
  }
  return null;
}

describe('Simple results skeleton', () => {
  const css = read('src/ui/simple-mode.css');

  it.each([
    '.is-pending .simple-value',
    '.is-pending .free-rout-notice',
    '.is-pending .result-share',
  ])('%s keeps its box and hides its placeholder with visibility', (selector) => {
    const rule = ruleFor(css, selector);
    expect(rule).not.toBeNull();
    expect(rule).toMatch(/visibility:\s*hidden/);
    expect(rule).not.toMatch(/display:\s*none/);
  });

  it('reserves two label lines on phones, where the shares wrap', () => {
    expect(css).toMatch(
      /@media \(max-width: 560px\)\s*\{\s*\.simple-bar-labels\s*\{[^}]*min-height:/,
    );
  });

  it('the release check waits for the bar outside the skeleton', () => {
    expect(read('bench/browser.mjs')).toContain("bar.closest('.is-pending')");
  });
});
