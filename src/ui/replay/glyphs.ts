import type { ColorRole } from './theme';

/**
 * Glyph geometry and paints (docs/REPLAY.md §4). Agents are abstract marks only: triangles,
 * dots, diamonds, rings, arrows, crosses, wedges, lines and squares. The builders append to any
 * path-like sink, so the stage, the DOM legend and the node tests share one definition.
 */

/** The subset of Path2D the builders use; a Path2D satisfies it, and so does a test recorder. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  closePath(): void;
}

/** Sizes, in CSS px or as multiples of the on-screen tiger radius r. */
export const GLYPH = {
  /** r = max(minTigerPx, tigerRadius × scale). */
  minTigerPx: 2.2,
  /** Below this r, tigers are drawn as LOD squares (shape detail would not be legible). */
  lodBelowPx: 3,
  /** T-Rex length = max(minTrexPx, trexLengthM × scale). */
  trexLengthM: 7,
  minTrexPx: 11,
  /** Triangle: nose 0.6·len ahead of the centre, tail 0.4·len behind, base 0.64·len. */
  trexNose: 0.6,
  trexTail: 0.4,
  trexHalfBase: 0.32,
  /** The HP gauge replaces the solid fill below this HP fraction. */
  gaugeBelow: 0.995,
  /** Surface-coloured outline between overlapping triangles (few T-Rex or large glyphs). */
  haloMaxTrex: 50,
  haloMinLen: 18,
  /** Approach: dot of radius 0.8r plus a heading tick from r to 2.3r. */
  dot: 0.8,
  tickFrom: 1,
  tickTo: 2.3,
  /** Latched: diamond with half-diagonal 1.6r (twice the dot's width: tested in V1). */
  diamond: 1.6,
  /** Recovering: ring of radius 0.9r. */
  ring: 0.9,
  /**
   * Routed: chevron along the flight direction, tip 1.6r ahead, wings 0.96r behind and 1.1r to
   * each side, notch 0.32r ahead of the centre: a hollow-backed arrowhead, so it does not
   * cover the same pixels as the approach dot.
   */
  arrowLength: 1.6,
  arrowHalfWidth: 1.1,
  arrowBack: 0.6,
  arrowNotch: 0.2,
  /** Dead: × with half-size 0.8r. */
  cross: 0.8,
  /** LOD square side 1.6r (at least 2 device px); latched ×1.2, routed ×0.8. */
  lodSide: 1.6,
  lodLatched: 1.2,
  lodRouted: 0.8,
  lodMinDevicePx: 2,
} as const;

const TAU = Math.PI * 2;

/** Tiger glyph radius on screen. */
export const tigerRadiusPx = (tigerRadiusM: number, scale: number): number =>
  Math.max(GLYPH.minTigerPx, tigerRadiusM * scale);

/** T-Rex glyph length on screen. */
export const trexLengthPx = (scale: number): number =>
  Math.max(GLYPH.minTrexPx, GLYPH.trexLengthM * scale);

/** Isosceles triangle with its nose along the heading (cos, sin). */
export function trexTriangle(
  s: PathSink,
  x: number,
  y: number,
  cos: number,
  sin: number,
  len: number,
): void {
  const nose = len * GLYPH.trexNose;
  const tail = len * GLYPH.trexTail;
  const half = len * GLYPH.trexHalfBase;
  s.moveTo(x + cos * nose, y + sin * nose);
  s.lineTo(x - cos * tail - sin * half, y - sin * tail + cos * half);
  s.lineTo(x - cos * tail + sin * half, y - sin * tail - cos * half);
  s.closePath();
}

/**
 * Fill height (fraction of the tail-to-nose height) whose area is `hp` of the triangle:
 * the unfilled tip is a similar triangle with area (1 − h)², so h = 1 − √(1 − hp).
 */
export const gaugeHeight = (hp: number): number => 1 - Math.sqrt(1 - Math.min(1, Math.max(0, hp)));

/** The filled part of the HP gauge: from the tail toward the nose, area = hp. */
export function trexGauge(
  s: PathSink,
  x: number,
  y: number,
  cos: number,
  sin: number,
  len: number,
  hp: number,
): void {
  const h = gaugeHeight(hp);
  if (h <= 0) return;
  const nose = len * GLYPH.trexNose;
  const tail = len * GLYPH.trexTail;
  const half = len * GLYPH.trexHalfBase;
  const nx = x + cos * nose;
  const ny = y + sin * nose;
  const ax = x - cos * tail - sin * half;
  const ay = y - sin * tail + cos * half;
  const bx = x - cos * tail + sin * half;
  const by = y - sin * tail - cos * half;
  s.moveTo(ax, ay);
  s.lineTo(bx, by);
  s.lineTo(bx + (nx - bx) * h, by + (ny - by) * h);
  s.lineTo(ax + (nx - ax) * h, ay + (ny - ay) * h);
  s.closePath();
}

/** Bite cone: a wedge of the given radius and half-angle around the heading. */
export function biteCone(
  s: PathSink,
  x: number,
  y: number,
  heading: number,
  radius: number,
  halfArc: number,
): void {
  s.moveTo(x, y);
  s.arc(x, y, radius, heading - halfArc, heading + halfArc);
  s.closePath();
}

export function approachDot(s: PathSink, x: number, y: number, r: number): void {
  const d = r * GLYPH.dot;
  s.moveTo(x + d, y);
  s.arc(x, y, d, 0, TAU);
  s.closePath();
}

/** Heading tick of an approaching tiger, along its unit direction (dx, dy). */
export function approachTick(
  s: PathSink,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
): void {
  s.moveTo(x + dx * r * GLYPH.tickFrom, y + dy * r * GLYPH.tickFrom);
  s.lineTo(x + dx * r * GLYPH.tickTo, y + dy * r * GLYPH.tickTo);
}

export function latchedDiamond(s: PathSink, x: number, y: number, r: number): void {
  const d = r * GLYPH.diamond;
  s.moveTo(x, y - d);
  s.lineTo(x + d, y);
  s.lineTo(x, y + d);
  s.lineTo(x - d, y);
  s.closePath();
}

/** Line from a latched tiger to its host's centre. */
export function tether(s: PathSink, x: number, y: number, hx: number, hy: number): void {
  s.moveTo(x, y);
  s.lineTo(hx, hy);
}

export function recoverRing(s: PathSink, x: number, y: number, r: number): void {
  const d = r * GLYPH.ring;
  s.moveTo(x + d, y);
  s.arc(x, y, d, 0, TAU);
  s.closePath();
}

/** Chevron arrow pointing along the unit flight direction (dx, dy). */
export function routedArrow(
  s: PathSink,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
): void {
  const l = r * GLYPH.arrowLength;
  const w = r * GLYPH.arrowHalfWidth;
  const px = -dy;
  const py = dx;
  const back = l * GLYPH.arrowBack;
  const notch = l * GLYPH.arrowNotch;
  s.moveTo(x + dx * l, y + dy * l);
  s.lineTo(x - dx * back + px * w, y - dy * back + py * w);
  s.lineTo(x + dx * notch, y + dy * notch);
  s.lineTo(x - dx * back - px * w, y - dy * back - py * w);
  s.closePath();
}

/** Effect ring (latch, impact, rout, death): a circle outline of radius `radius`. */
export function ring(s: PathSink, x: number, y: number, radius: number): void {
  s.moveTo(x + radius, y);
  s.arc(x, y, radius, 0, TAU);
}

const BURST_RAYS = [-0.45, 0, 0.45] as const;

/** Throw burst: three short rays (−26°, 0°, +26°) along the unit direction (ux, uy). */
export function burst(
  s: PathSink,
  x: number,
  y: number,
  ux: number,
  uy: number,
  from: number,
  to: number,
): void {
  for (const rot of BURST_RAYS) {
    const c = Math.cos(rot);
    const n = Math.sin(rot);
    const vx = ux * c - uy * n;
    const vy = ux * n + uy * c;
    s.moveTo(x + vx * from, y + vy * from);
    s.lineTo(x + vx * to, y + vy * to);
  }
}
export function deadCross(s: PathSink, x: number, y: number, r: number): void {
  const d = r * GLYPH.cross;
  s.moveTo(x - d, y - d);
  s.lineTo(x + d, y + d);
  s.moveTo(x + d, y - d);
  s.lineTo(x - d, y + d);
}

/** One paint operation on a path: fill, or stroke with a width (CSS px). */
export interface Paint {
  readonly mode: 'fill' | 'stroke';
  readonly color: ColorRole;
  readonly width?: number;
  /** Translucency that cannot be pre-blended (it must show what lies underneath). */
  readonly alpha?: number;
}

/** Paints of every glyph bucket, in drawing order within the bucket. */
export const PAINTS = {
  deadCross: [{ mode: 'stroke', color: 'deadMark', width: 1.2 }],
  deadTrex: [{ mode: 'stroke', color: 'deadTrex', width: 1.5 }],
  tether: [{ mode: 'stroke', color: 'tether', width: 1.25 }],
  routed: [{ mode: 'fill', color: 'out' }],
  recover: [{ mode: 'stroke', color: 'tiger', width: 1.4 }],
  approach: [{ mode: 'fill', color: 'tiger' }],
  approachTick: [{ mode: 'stroke', color: 'tiger', width: 1.2 }],
  // The halo goes first, so it only widens the diamond's edge against the T-Rex underneath.
  latched: [
    { mode: 'stroke', color: 'surface', width: 2.4 },
    { mode: 'fill', color: 'tiger' },
  ],
  trex: [{ mode: 'fill', color: 'trex' }],
  trexHalo: [
    { mode: 'fill', color: 'trex' },
    { mode: 'stroke', color: 'surface', width: 1.25 },
  ],
  trexHollow: [{ mode: 'fill', color: 'trexTint' }],
  trexGauge: [{ mode: 'fill', color: 'trex' }],
  trexOutline: [{ mode: 'stroke', color: 'trex', width: 1.5 }],
  biteHit: [
    { mode: 'fill', color: 'trex', alpha: 0.2 },
    { mode: 'stroke', color: 'biteLine', width: 1 },
  ],
  biteMiss: [{ mode: 'stroke', color: 'biteLine', width: 1 }],
  // Trails: pre-blended opaque tones, oldest segment bucket (2) drawn first.
  trailTrex2: [{ mode: 'stroke', color: 'trailTrex2', width: 2 }],
  trailTrex1: [{ mode: 'stroke', color: 'trailTrex1', width: 2 }],
  trailTrex0: [{ mode: 'stroke', color: 'trailTrex0', width: 2 }],
  trailTiger2: [{ mode: 'stroke', color: 'trailTiger2', width: 1 }],
  trailTiger1: [{ mode: 'stroke', color: 'trailTiger1', width: 1 }],
  trailTiger0: [{ mode: 'stroke', color: 'trailTiger0', width: 1 }],
  // Event effects: outlines only, alpha quantised to three steps (fresh → old).
  fxTrex0: [{ mode: 'stroke', color: 'trex', width: 1.5, alpha: 0.9 }],
  fxTrex1: [{ mode: 'stroke', color: 'trex', width: 1.5, alpha: 0.6 }],
  fxTrex2: [{ mode: 'stroke', color: 'trex', width: 1.5, alpha: 0.3 }],
  fxTiger0: [{ mode: 'stroke', color: 'tiger', width: 1.5, alpha: 0.9 }],
  fxTiger1: [{ mode: 'stroke', color: 'tiger', width: 1.5, alpha: 0.6 }],
  fxTiger2: [{ mode: 'stroke', color: 'tiger', width: 1.5, alpha: 0.3 }],
  fxOut0: [{ mode: 'stroke', color: 'out', width: 1.5, alpha: 0.9 }],
  fxOut1: [{ mode: 'stroke', color: 'out', width: 1.5, alpha: 0.6 }],
  fxOut2: [{ mode: 'stroke', color: 'out', width: 1.5, alpha: 0.3 }],
  fxDead0: [{ mode: 'stroke', color: 'dead', width: 1.5, alpha: 0.9 }],
  fxDead1: [{ mode: 'stroke', color: 'dead', width: 1.5, alpha: 0.6 }],
  fxDead2: [{ mode: 'stroke', color: 'dead', width: 1.5, alpha: 0.3 }],
  // Reduced-motion overview (drawn once): whole-battle paths and where latches and kills happened.
  ovTiger: [{ mode: 'stroke', color: 'ovTiger', width: 1 }],
  ovTrex: [{ mode: 'stroke', color: 'trex', width: 2 }],
  ovTrexThin: [{ mode: 'stroke', color: 'trailTrex0', width: 1 }],
  ovLatch: [{ mode: 'fill', color: 'tiger' }],
} as const satisfies Record<string, readonly Paint[]>;

export type Bucket = keyof typeof PAINTS;

/**
 * A tiger glyph by state: which builders feed which bucket. Used by the stage, the legend and the
 * V1 shape-separability test. (dx, dy) is the unit heading; (hx, hy) the host centre if latched.
 */
export function tigerGlyph(
  state: 'approach' | 'latched' | 'recover' | 'routed' | 'dead',
  sink: (bucket: Bucket) => PathSink,
  x: number,
  y: number,
  r: number,
  dx: number,
  dy: number,
  hx = x,
  hy = y,
): void {
  switch (state) {
    case 'approach':
      approachDot(sink('approach'), x, y, r);
      approachTick(sink('approachTick'), x, y, dx, dy, r);
      return;
    case 'latched':
      if (hx !== x || hy !== y) tether(sink('tether'), x, y, hx, hy);
      latchedDiamond(sink('latched'), x, y, r);
      return;
    case 'recover':
      recoverRing(sink('recover'), x, y, r);
      return;
    case 'routed':
      routedArrow(sink('routed'), x, y, dx, dy, r);
      return;
    case 'dead':
      deadCross(sink('deadCross'), x, y, r);
      return;
  }
}

/** Effect buckets by colour, each with three alpha steps. */
export const FX_BUCKETS = {
  trex: ['fxTrex0', 'fxTrex1', 'fxTrex2'],
  tiger: ['fxTiger0', 'fxTiger1', 'fxTiger2'],
  out: ['fxOut0', 'fxOut1', 'fxOut2'],
  dead: ['fxDead0', 'fxDead1', 'fxDead2'],
} as const satisfies Record<string, readonly [Bucket, Bucket, Bucket]>;

/** Trail buckets by side, indexed by age step (0 = newest). */
export const TRAIL_BUCKETS = {
  trex: ['trailTrex0', 'trailTrex1', 'trailTrex2'],
  tiger: ['trailTiger0', 'trailTiger1', 'trailTiger2'],
} as const satisfies Record<string, readonly [Bucket, Bucket, Bucket]>;

/** Bucket drawing order (layers 2–8 of docs/REPLAY.md §6). */
export const BUCKET_ORDER: readonly Bucket[] = [
  'deadCross',
  'deadTrex',
  'trailTrex2',
  'trailTiger2',
  'trailTrex1',
  'trailTiger1',
  'trailTrex0',
  'trailTiger0',
  'tether',
  'routed',
  'recover',
  'approach',
  'approachTick',
  'trexHollow',
  'trexGauge',
  'trexOutline',
  'trex',
  'trexHalo',
  'latched',
  'biteHit',
  'biteMiss',
  'fxDead2',
  'fxOut2',
  'fxTiger2',
  'fxTrex2',
  'fxDead1',
  'fxOut1',
  'fxTiger1',
  'fxTrex1',
  'fxDead0',
  'fxOut0',
  'fxTiger0',
  'fxTrex0',
];
