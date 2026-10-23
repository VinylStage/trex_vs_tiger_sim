import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Plugin } from 'vite';
import { expandPatchNotes } from './src/pages/patch-notes-page.ts';
import { notFoundLang, parsePagePath, type PageId } from './src/pages/routes.ts';
import { headerRouteOf } from './src/pages/site-header.ts';
import { extractPageFacts } from './src/seo/extract.ts';
import { injectHead } from './src/seo/head.ts';
import { llmsFullTxt, llmsTxt, type LlmsPage } from './src/seo/llms.ts';
import { robotsTxt } from './src/seo/robots.ts';
import { INDEXABLE_ROUTES, pageSource } from './src/seo/site.ts';
import { pageLastmod, sitemapXml, visibleDateIsStale } from './src/seo/sitemap.ts';
import type { Lang } from './src/i18n/lang.ts';

/*
 * Build-time SEO (docs/SEO.md): injects canonical, hreflang, Open Graph, Twitter and JSON-LD into
 * every indexable page, emits sitemap.xml, robots.txt, llms.txt and llms-full.txt, and makes the
 * 404 pages' asset URLs root-absolute. All words come from the pages and src/seo/site.ts; this
 * file only reads files and git.
 */

const git = (root: string, args: string[]): string | null => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

/** How much git history the build has, for docs/SEO.md#lastmod and the build log. */
export interface GitHistory {
  available: boolean;
  shallow: boolean;
  /** Commits at the shallow boundary: their parents are missing, so file dates there are unknown. */
  boundary: ReadonlySet<string>;
}

export function gitHistory(root: string): GitHistory {
  if (git(root, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
    return { available: false, shallow: false, boundary: new Set() };
  }
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']) === 'true';
  const boundary = new Set<string>();
  if (shallow) {
    const rel = git(root, ['rev-parse', '--git-path', 'shallow']);
    const file = rel && (isAbsolute(rel) ? rel : join(root, rel));
    if (file && existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n'))
        if (line) boundary.add(line.trim());
    }
  }
  return { available: true, shallow, boundary };
}

/**
 * Fetch the full history into a shallow clone, so file dates can be read. Cloudflare Pages builds
 * from a depth-1 clone (docs/SEO.md#lastmod), so the plugin does this on Pages (`CF_PAGES=1`) and
 * never touches a developer's clone. Returns whether the clone is complete afterwards.
 */
export function unshallow(root: string): boolean {
  try {
    execFileSync('git', ['fetch', '--quiet', '--unshallow', 'origin'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 120_000,
    });
  } catch {
    // Network or credential problem: keep the shallow clone and omit lastmod.
  }
  return git(root, ['rev-parse', '--is-shallow-repository']) === 'false';
}

/**
 * Committer date (ISO 8601) of the last commit that touched `file`, or null when git cannot tell:
 * no repository, the file is untracked or has uncommitted changes, or the commit found is a
 * shallow-clone boundary (whose date says nothing about when the file last changed).
 */
export function gitLastmod(root: string, history: GitHistory, file: string): string | null {
  if (!history.available) return null;
  const out = git(root, ['log', '-1', '--format=%H %cI', '--', file]);
  if (!out) return null;
  const [sha = '', date = ''] = out.split(' ');
  if (history.boundary.has(sha)) return null;
  const dirty = git(root, ['status', '--porcelain', '--', file]);
  if (dirty === null || dirty !== '') return null;
  return date || null;
}

export { notFoundLang };

/**
 * Built HTML pages whose relative URLs are rewritten root-absolute: all of them. 404 pages are
 * served at any unknown path (`/a/b/c`), the app moves between `/` and `/en/` with
 * `history.pushState` (so `./favicon.svg` became `/en/favicon.svg`), and `/r/` pages are served
 * through a Pages Function under `/r/*`. One rule for every page keeps them all consistent.
 */
export const needsRootAbsoluteUrls = (fileName: string): boolean => fileName.endsWith('.html');

/**
 * Vite writes relative URLs for `base: './'` (`./assets/…`, `../favicon.svg`), which resolve
 * against the address the page is shown at. Rewrite every relative `src`/`href` in a page
 * (emitted at `fileName`) to the root-absolute path it means.
 */
export function absolutizeUrls(html: string, fileName: string): string {
  return html.replace(/(\s(?:src|href)=")(\.\.?\/[^"]*)"/g, (_, attr: string, rel: string) => {
    const url = new URL(rel, `https://site.invalid/${fileName}`);
    return `${attr}${url.pathname}${url.search}${url.hash}"`;
  });
}

export interface SeoOptions {
  root: string;
  version: string;
  /** Fetch the missing history first when the build runs in a shallow clone (Cloudflare Pages). */
  deepen: boolean;
}

export function seo({ root, version, deepen }: SeoOptions): Plugin {
  let history: GitHistory | null = null;
  let deepened: boolean | null = null;
  const loadHistory = (): GitHistory => {
    const first = gitHistory(root);
    if (!first.shallow || !deepen) return first;
    deepened = unshallow(root);
    return gitHistory(root);
  };
  const gitDates = new Map<string, string | null>();
  const gitDate = (page: PageId, lang: Lang): string | null => {
    const file = pageSource(page, lang);
    if (!gitDates.has(file)) {
      history ??= loadHistory();
      gitDates.set(file, gitLastmod(root, history, file));
    }
    return gitDates.get(file) ?? null;
  };
  // Generated page content (the patch notes board) is filled in, so llms-full.txt carries it.
  const sourceOf = (page: PageId, lang: Lang): string => {
    const file = pageSource(page, lang);
    const html = readFileSync(join(root, file), 'utf8');
    return expandPatchNotes(html, headerRouteOf(`/${file}`), version, file);
  };
  const lastmod = (page: PageId, lang: Lang): string | null =>
    pageLastmod(extractPageFacts(sourceOf(page, lang)).updated, gitDate(page, lang));
  const pages = (): LlmsPage[] =>
    INDEXABLE_ROUTES.map(({ page, lang }) => {
      const html = sourceOf(page, lang);
      const facts = extractPageFacts(html);
      return { page, lang, html, facts, lastmod: pageLastmod(facts.updated, gitDate(page, lang)) };
    });
  const textFiles = (): Record<string, string> => {
    const all = pages();
    return {
      'sitemap.xml': sitemapXml(lastmod),
      'robots.txt': robotsTxt(),
      'llms.txt': llmsTxt(all),
      'llms-full.txt': llmsFullTxt(all),
    };
  };
  const contentTypes: Record<string, string> = {
    'sitemap.xml': 'application/xml; charset=utf-8',
    'robots.txt': 'text/plain; charset=utf-8',
    'llms.txt': 'text/plain; charset=utf-8',
    'llms-full.txt': 'text/plain; charset=utf-8',
  };

  return {
    name: 'trexsim:seo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? '';
        const type = contentTypes[name];
        if (!type) return next();
        res.setHeader('Content-Type', type);
        res.end(textFiles()[name]);
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const route = parsePagePath(ctx.path);
        if (!route || !/(^|\/)index\.html$|\/$/.test(ctx.path)) return html;
        return injectHead(html, {
          page: route.page,
          lang: route.lang,
          facts: extractPageFacts(html),
          version,
        });
      },
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const [fileName, source] of Object.entries(textFiles())) {
          this.emitFile({ type: 'asset', fileName, source });
        }
        for (const out of Object.values(bundle)) {
          if (
            out.type === 'asset' &&
            needsRootAbsoluteUrls(out.fileName) &&
            typeof out.source === 'string'
          ) {
            out.source = absolutizeUrls(out.source, out.fileName);
          }
        }
        let visible = 0;
        let fromGit = 0;
        for (const { page, lang } of INDEXABLE_ROUTES) {
          const updated = extractPageFacts(sourceOf(page, lang)).updated;
          const committed = gitDate(page, lang);
          if (updated) visible += 1;
          else if (committed) fromGit += 1;
          if (visibleDateIsStale(updated, committed)) {
            this.warn(
              `${pageSource(page, lang)}: committed ${committed} but shows "last updated" ` +
                `${updated}; bump the page-meta <time> if the content changed (docs/SEO.md#lastmod)`,
            );
          }
        }
        const h = history ?? loadHistory();
        this.info(
          `lastmod for ${visible + fromGit}/${INDEXABLE_ROUTES.length} pages ` +
            `(${visible} from the visible date, ${fromGit} from git; ` +
            `git: ${h.available ? 'yes' : 'no'}, shallow: ${h.shallow ? `yes, ${h.boundary.size} boundary commit(s)` : 'no'}` +
            `${deepened === null ? '' : `, unshallow: ${deepened ? 'done' : 'failed'}`})`,
        );
      },
    },
  };
}
