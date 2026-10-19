# ADR-0005: Self-hosted Pretendard as the single typeface

- Status: Accepted
- Date: 2026-10-19
- Issue: #31

## Context

The owner requires one typeface across the simulator, the content pages, canvas text and brand assets: **Pretendard** (SIL Open Font License 1.1). The CSP allows fonts only from `'self'` (`font-src 'self'`), so a third-party font CDN cannot be used at runtime. A full Hangul font is several MB, which would hurt LCP/CLS (and later AdSense revenue via Core Web Vitals).

## Decision

- Vendor `pretendard@1.3.9` **variable dynamic-subset** build: 92 `woff2` files split by `unicode-range` plus its `@font-face` stylesheet, under `src/assets/fonts/pretendard/` (imported from `src/main.ts`, so Vite fingerprints the files into `assets/` and they get the 1-year immutable cache rule).
- Browsers download only the subsets whose characters appear on the page (measured: 14 files on the simulator page).
- `font-display: swap` (from the upstream stylesheet) and a system fallback stack in `--font-sans` keep text visible while loading.
- Canvas charts and the replay redraw after `document.fonts.ready`, because canvas text does not reflow when a web font arrives.
- The OFL licence ships next to the font files (`LICENSE.txt`). The vendored directory is excluded from Prettier.

## Consequences

- No external requests; CSP unchanged.
- ~3 MB of font files are deployed (92 files, far below the Pages 20,000-file and 25 MiB-per-file limits), but a typical page fetches only a few hundred KB.
- Upgrading Pretendard = replace the vendored directory from the npm tarball and keep the relative `url(./…)` paths.
