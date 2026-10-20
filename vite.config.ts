import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { findHtmlEntries } from './vite.pages.ts';
import { seo } from './vite.seo.ts';

interface BuildInfo {
  version: string;
  sha: string;
  builtAt: string;
}

const SHA_RE = /^[0-9a-f]{7,40}$/i;

function gitHead(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function buildSha(): string {
  for (const candidate of [env.CF_PAGES_COMMIT_SHA, gitHead()]) {
    if (candidate && SHA_RE.test(candidate)) return candidate.toLowerCase();
  }
  return 'dev';
}

function readBuildInfo(): BuildInfo {
  const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return { version: pkg.version, sha: buildSha(), builtAt: new Date().toISOString() };
}

function versionJson(info: BuildInfo): Plugin {
  const source = `${JSON.stringify(info)}\n`;
  return {
    name: 'trexsim:version-json',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source });
    },
  };
}

const info = readBuildInfo();
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(info.version),
    __BUILD_SHA__: JSON.stringify(info.sha),
    __BUILD_TIME__: JSON.stringify(info.builtAt),
  },
  plugins: [versionJson(info), seo({ root, version: info.version, deepen: env.CF_PAGES === '1' })],
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: findHtmlEntries(root),
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
