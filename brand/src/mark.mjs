// Single source of the brand mark geometry. render.mjs turns these strings into
// public/favicon.svg and the raster icons. The mark is drawn on a 64-unit grid:
// 4 units = 1 px at 16x16 and 2 units = 1 px at 32x32, so the small variant is snapped to it.

export const COLORS = {
  tile: '#1b1b1a',
  edge: '#3b3b38',
  grid: '#ffffff',
  trex: '#3987e5',
  tiger: '#eb6834',
};

// Large variant (shown above 40 px): arena grid, two converging T-Rex triangles, a loose group of five tigers.
const LARGE_GRID = 'M16 3V61M32 3V61M48 3V61M3 16H61M3 32H61M3 48H61';
const LARGE_TREX = ['M30.4 22.9L7.5 26.4L10.1 11.7Z', 'M30.4 41.1L10.1 52.3L7.5 37.6Z'];
const LARGE_TIGERS = [
  [42.5, 19.5],
  [52, 27],
  [40.5, 32],
  [51, 38.5],
  [42.5, 44.5],
];
const LARGE_TIGER_R = 4.8;

// Small variant (40 px and below): two triangles and three 3-px discs, snapped to the 16 px pixel grid.
const SMALL_TREX = ['M30 22L6 28L10 12Z', 'M30 42L10 52L6 36Z'];
const SMALL_TIGERS = [
  [42, 14],
  [50, 30],
  [42, 50],
];
const SMALL_TIGER_R = 6;

const TILE_RX = 14;

const dots = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
const pad = (lines, n = 2) => lines.map((l) => ' '.repeat(n) + l);

function largeGlyphs({ grid = true } = {}) {
  return [
    ...(grid
      ? [
          `<path d="${LARGE_GRID}" stroke="${COLORS.grid}" stroke-opacity=".09" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
        ]
      : []),
    `<g fill="${COLORS.trex}">${LARGE_TREX.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    `<g fill="${COLORS.tiger}">${dots(LARGE_TIGERS, LARGE_TIGER_R)}</g>`,
  ];
}

function smallGlyphs() {
  return [
    `<g fill="${COLORS.trex}">${SMALL_TREX.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    `<g fill="${COLORS.tiger}">${dots(SMALL_TIGERS, SMALL_TIGER_R)}</g>`,
  ];
}

const svg = (body) =>
  ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">', ...pad(body), '</svg>', ''].join(
    '\n',
  );

// Favicon / "any" icon: rounded dark tile with a 1-CSS-px edge (a 2 px non-scaling stroke clipped
// to the tile, so exactly its inner half shows at every size). The large variant is the default, so
// renderers that ignore CSS still draw one clean variant; the media query swaps in the small one.
export function faviconSvg() {
  return svg([
    '<title>T-Rex vs Tiger</title>',
    '<style>@media (max-width: 40px) { .lg { display: none } .sm { display: inline } }</style>',
    `<defs><clipPath id="tile"><rect width="64" height="64" rx="${TILE_RX}"/></clipPath></defs>`,
    `<rect width="64" height="64" rx="${TILE_RX}" fill="${COLORS.tile}"/>`,
    '<g class="lg">',
    ...pad(largeGlyphs()),
    '</g>',
    '<g class="sm" display="none">',
    ...pad(smallGlyphs()),
    '</g>',
    `<rect width="64" height="64" rx="${TILE_RX}" fill="none" stroke="${COLORS.edge}" stroke-width="2" vector-effect="non-scaling-stroke" clip-path="url(#tile)"/>`,
  ]);
}

// Full-bleed square (apple-touch-icon): the platform applies its own corner mask.
export function squareSvg() {
  return svg([`<rect width="64" height="64" fill="${COLORS.tile}"/>`, ...largeGlyphs()]);
}

// Maskable: full-bleed background and grid, glyphs scaled into the 80 % safe-zone circle
// (content corner distance 0.36 of the width against the 0.40 limit).
export const MASKABLE_SCALE = 0.72;
export function maskableSvg() {
  const s = MASKABLE_SCALE;
  const t = 32 * (1 - s);
  return svg([
    `<rect width="64" height="64" fill="${COLORS.tile}"/>`,
    `<path d="M8 0V64M16 0V64M24 0V64M32 0V64M40 0V64M48 0V64M56 0V64M0 8H64M0 16H64M0 24H64M0 32H64M0 40H64M0 48H64M0 56H64" stroke="${COLORS.grid}" stroke-opacity=".07" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    `<g transform="translate(${t} ${t}) scale(${s})">`,
    ...pad(largeGlyphs({ grid: false })),
    '</g>',
  ]);
}
