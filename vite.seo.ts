import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Plugin } from 'vite';
import { parsePagePath, type PageId } from './src/pages/routes.ts';
import { extractPageFacts } from './src/seo/extract.ts';
import { injectHead } from './src/seo/head.ts';
import { llmsFullTxt, llmsTxt, type LlmsPage } from './src/seo/llms.ts';
import { robotsTxt } from './src/seo/robots.ts';
import { INDEXABLE_ROUTES, pageSource } from './src/seo/site.ts';
import { sitemapXml } from './src/seo/sitemap.ts';
import type { Lang } from './src/ui/i18n.ts';

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

/** `/en/404.html` → 'en', `/404.html` → 'ko', anything else → null. */
export function notFoundLang(path: string): Lang | null {
  if (/^\/?404\.html$/.test(path)) return 'ko';
  if (/^\/?en\/404\.html$/.test(path)) return 'en';
  return null;
}

/**
 * 404 pages are served at any unknown path (`/a/b/c`), so the relative URLs Vite writes for
 * `base: './'` (`./assets/…`, `../favicon.svg`) would resolve against that path. Rewrite every
 * relative `src`/`href` in a 404 page (emitted at `fileName`) to the root-absolute path it means.
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
}

export function seo({ root, version }: SeoOptions): Plugin {
  let history: GitHistory | null = null;
  const lastmods = new Map<string, string | null>();
  const lastmod = (page: PageId, lang: Lang): string | null => {
    const file = pageSource(page, lang);
    if (!lastmods.has(file)) {
      history ??= gitHistory(root);
      lastmods.set(file, gitLastmod(root, history, file));
    }
    return lastmods.get(file) ?? null;
  };
  const pages = (): LlmsPage[] =>
    INDEXABLE_ROUTES.map(({ page, lang }) => {
      const html = readFileSync(join(root, pageSource(page, lang)), 'utf8');
      return { page, lang, html, facts: extractPageFacts(html), lastmod: lastmod(page, lang) };
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
          dateModified: lastmod(route.page, route.lang),
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
            notFoundLang(out.fileName) &&
            typeof out.source === 'string'
          ) {
            out.source = absolutizeUrls(out.source, out.fileName);
          }
        }
        const known = INDEXABLE_ROUTES.filter((r) => lastmod(r.page, r.lang) !== null).length;
        const h = history ?? gitHistory(root);
        this.info(
          `lastmod from git for ${known}/${INDEXABLE_ROUTES.length} pages ` +
            `(git: ${h.available ? 'yes' : 'no'}, shallow: ${h.shallow ? `yes, ${h.boundary.size} boundary commit(s)` : 'no'})`,
        );
      },
    },
  };
}
