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

/**
 * Every `index.html` under `root` as a Vite/Rolldown input map, so a new page only needs a
 * `<dir>/index.html` and no config change. The root page keeps the key `index` (Vite's default,
 * so asset names stay `assets/index-<hash>.*`); nested pages use their directory with `/` → `-`
 * (`en/guide/index.html` → `en-guide`). Keys are sorted for a stable build.
 */
export function findHtmlEntries(root: string): Record<string, string> {
  const found: [string, string][] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!isIgnored(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name === 'index.html') {
        const rel = relative(root, dir).split(sep).join('/');
        found.push([rel === '' ? 'index' : rel.replaceAll('/', '-'), join(dir, entry.name)]);
      }
    }
  };
  walk(root);
  found.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(found);
}
