import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { expandPatchNotes } from './src/pages/patch-notes-page.ts';
import { expandSiteHeader, headerRouteOf } from './src/pages/site-header.ts';
import { expandSpeciesGuide } from './src/pages/species-page.ts';

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

/**
 * Fills the shared header and footer into every page (docs/PAGES.md#site-header, #footer):
 * `<!-- site-footer -->` in every page with the footer, `<!-- site-header -->` in
 * the content and 404 pages and `<!-- app-logo -->` in the simulator's static head become the
 * markup of src/pages/site-header.ts. It runs before Vite's own HTML processing (`order: 'pre'`),
 * so the logo URL is handled like hand-written markup, and in dev as well as in the build, so the
 * served and built HTML both contain the complete static header.
 */
export function siteHeader(): Plugin {
  return {
    name: 'trexsim:site-header',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return expandSiteHeader(html, headerRouteOf(ctx.path), ctx.path);
      },
    },
  };
}

/**
 * Fills the patch notes board (docs/PAGES.md#patch-notes): `<!-- patch-notes -->` in
 * patch-notes/index.html and en/patch-notes/index.html becomes the version cards rendered from
 * src/content/patch-notes.ts, showing the entries up to the build's package.json `version`.
 * Like {@link siteHeader} it runs before Vite's HTML processing, in dev and in the build.
 */
export function patchNotes(version: string): Plugin {
  return {
    name: 'trexsim:patch-notes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return expandPatchNotes(html, headerRouteOf(ctx.path), version, ctx.path);
      },
    },
  };
}

/**
 * Fills the species guide (docs/PAGES.md#species-guide): `<!-- species-guide -->` in
 * species/index.html and en/species/index.html becomes the overview table and the species
 * sections rendered from the registries (src/pages/species-page.ts). Like {@link patchNotes} it
 * runs before Vite's HTML processing, in dev and in the build.
 */
export function speciesGuide(): Plugin {
  return {
    name: 'trexsim:species-guide',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return expandSpeciesGuide(html, headerRouteOf(ctx.path), ctx.path);
      },
    },
  };
}
