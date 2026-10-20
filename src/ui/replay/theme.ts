/**
 * Replay colours (docs/REPLAY.md §5). Rule: hue = side, shape = state, grey = out of
 * the fight. The base colours come from CSS custom properties in src/ui/styles.css; translucent
 * paints are pre-blended over the arena once per theme so drawing never builds colour strings.
 */

/** CSS custom property behind each base colour. */
export const REPLAY_TOKENS = {
  surface: '--surface',
  fg: '--fg',
  muted: '--muted',
  arena: '--replay-arena',
  grid: '--replay-grid',
  border: '--replay-border',
  heavy: '--replay-trex',
  pack: '--replay-tiger',
  out: '--replay-out',
  dead: '--replay-dead',
} as const;

export type BaseColor = keyof typeof REPLAY_TOKENS;
export type BaseColors = Record<BaseColor, string>;

/** Light-theme values, used when a token is missing (and by tests). */
export const FALLBACK_COLORS: BaseColors = {
  surface: '#ffffff',
  fg: '#1b1b1a',
  muted: '#5f5e5a',
  arena: '#f3f2ee',
  grid: '#e4e3de',
  border: '#b9b8b2',
  heavy: '#0072b2',
  pack: '#d55e00',
  out: '#767676',
  dead: '#8d8c87',
};

/** Opacity of each pre-blended paint (over the arena). */
export const BLEND = {
  heavyTint: 0.16,
  deadMark: 0.5,
  deadHeavy: 0.6,
  tether: 0.85,
  biteLine: 0.55,
  lodRecover: 0.45,
  lodRouted: 0.75,
  /** Trail segments by age (newest → oldest); pack animal trails at 0.8 × these. */
  trail0: 0.38,
  trail1: 0.25,
  trail2: 0.13,
  packTrail: 0.8,
  /** Reduced-motion overview: pack animal paths. */
  ovPack: 0.3,
} as const;

export interface ReplayTheme extends BaseColors {
  font: string;
  /** Hollow (damaged) heavy fill: heavy blue at 16 %. */
  heavyTint: string;
  /** Dead-pack animal crosses and LOD squares: grey at 50 %. */
  deadMark: string;
  /** Dead heavy outline: muted at 60 %. */
  deadHeavy: string;
  /** Latch tether: pack animal orange at 85 %. */
  tether: string;
  /** Bite-cone outline: heavy blue at 55 %. */
  biteLine: string;
  /** LOD squares of recovering pack animals (orange at 45 %) and routed pack animals (grey at 75 %). */
  lodRecover: string;
  lodRouted: string;
  /** Trail tones by age, newest (0) to oldest (2). */
  trailHeavy0: string;
  trailHeavy1: string;
  trailHeavy2: string;
  trailPack0: string;
  trailPack1: string;
  trailPack2: string;
  /** Overview pack animal paths: pack animal orange at 30 %. */
  ovPack: string;
}

export type ColorRole = Exclude<keyof ReplayTheme, 'font'>;

/** `#rgb` or `#rrggbb` to [r, g, b] (0–255), or null. */
export function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  const hex = m?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex2 = (v: number): string => Math.round(v).toString(16).padStart(2, '0');

/** Opaque colour of `fg` at opacity `alpha` over `bg` (sRGB, as canvas composites). */
export function blend(fg: string, bg: string, alpha: number): string {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return fg;
  const c = (i: 0 | 1 | 2): string => hex2(b[i] + (a[i] - b[i]) * alpha);
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** WCAG 2.x relative luminance of a hex colour. */
export function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return Number.NaN;
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** WCAG 2.x contrast ratio (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Full theme from the base colours (pure). */
export function deriveTheme(base: BaseColors, font: string): ReplayTheme {
  const over = (c: string, a: number): string => blend(c, base.arena, a);
  return {
    ...base,
    font,
    heavyTint: over(base.heavy, BLEND.heavyTint),
    deadMark: over(base.dead, BLEND.deadMark),
    deadHeavy: over(base.muted, BLEND.deadHeavy),
    tether: over(base.pack, BLEND.tether),
    biteLine: over(base.heavy, BLEND.biteLine),
    lodRecover: over(base.pack, BLEND.lodRecover),
    lodRouted: over(base.out, BLEND.lodRouted),
    trailHeavy0: over(base.heavy, BLEND.trail0),
    trailHeavy1: over(base.heavy, BLEND.trail1),
    trailHeavy2: over(base.heavy, BLEND.trail2),
    trailPack0: over(base.pack, BLEND.trail0 * BLEND.packTrail),
    trailPack1: over(base.pack, BLEND.trail1 * BLEND.packTrail),
    trailPack2: over(base.pack, BLEND.trail2 * BLEND.packTrail),
    ovPack: over(base.pack, BLEND.ovPack),
  };
}

/** Read the current (light or dark) theme from the document's custom properties. */
export function readReplayTheme(): ReplayTheme {
  const cs = getComputedStyle(document.documentElement);
  const base = { ...FALLBACK_COLORS };
  for (const key of Object.keys(REPLAY_TOKENS) as BaseColor[]) {
    const v = cs.getPropertyValue(REPLAY_TOKENS[key]).trim();
    if (parseHex(v)) base[key] = v;
  }
  const font = cs.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif';
  return deriveTheme(base, font);
}
