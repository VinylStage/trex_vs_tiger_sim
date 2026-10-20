import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Directories never searched for pages: dependencies, build/test output, static files copied
 * verbatim by Vite (`public/`), and every dot-directory (`.git`, `.claude`, `.github`, …).
 */
export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'coverage',
  'public',
]);

const isIgnored = (name: string): boolean => name.startsWith('.') || IGNORED_DIRS.has(name);

/** File names that are build inputs: pages (`index.html`) and Pages' not-found pages (`404.html`). */
export const ENTRY_FILES: ReadonlySet<string> = new Set(['index.html', '404.html']);

/**
 * Every `index.html` and `404.html` under `root` as a Vite/Rolldown input map, so a new page only
 * needs a `<dir>/index.html` and no config change. The root page keeps the key `index`; nested
 * pages use their directory with `/` → `-` (`en/guide/index.html` → `en-guide`). A `404.html` is
 * keyed by its directory plus `404` (`404.html` → `404`, `en/404.html` → `en-404`) and is emitted
 * at the same path (`dist/404.html`, `dist/en/404.html`), where Cloudflare Pages serves the
 * nearest one for unknown URLs (docs/SEO.md#404-pages). Keys are sorted for a stable build.
 */
export function findHtmlEntries(root: string): Record<string, string> {
  const found: [string, string][] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!isIgnored(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && ENTRY_FILES.has(entry.name)) {
        const rel = relative(root, dir).split(sep).join('/');
        const parts = rel === '' ? [] : rel.split('/');
        if (entry.name === '404.html') parts.push('404');
        found.push([parts.length === 0 ? 'index' : parts.join('-'), join(dir, entry.name)]);
      }
    }
  };
  walk(root);
  found.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(found);
}
