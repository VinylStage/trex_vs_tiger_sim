import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { findHtmlEntries } from './vite.pages.ts';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: findHtmlEntries(fileURLToPath(new URL('.', import.meta.url))),
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
