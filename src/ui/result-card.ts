import type { ScenarioConfig } from '../sim/config.ts';
import { sm } from '../share/messages.ts';
import type { ResultSummary } from '../share/result-codec.ts';
import {
  formatCount,
  formatSeconds,
  pct,
  type ResultView,
  type Side,
} from '../share/result-text.ts';

/*
 * The shareable result card (docs/SHARING.md#result-card), drawn on a canvas: 1080×1920 story or
 * 1080×1080 square. Abstract glyphs only (triangles for the heavy side, dots for the pack, bars);
 * emoji appear only inside text, as the owner allowed (#51). Fixed light palette = brand colours
 * (docs/BRANDING.md), independent of the viewer's theme, so every saved card looks the same.
 */

export type CardFormat = 'story' | 'square';

export const CARD_SIZE: Readonly<Record<CardFormat, { w: number; h: number }>> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

/** Story safe zone: platform UI covers the top 250 px and the bottom 340 px. */
export const STORY_SAFE = { top: 250, bottom: 340 } as const;

export const CARD_PALETTE = {
  bg: '#f7f6f3',
  surface: '#ffffff',
  fg: '#1b1b1a',
  muted: '#5f5e5a',
  grid: '#e3e2de',
  border: '#d9d8d2',
  heavy: '#2a78d6',
  pack: '#eb6834',
  draw: '#8d8c87',
} as const;

export const CARD_FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const WEIGHTS = [500, 700, 800, 900] as const;

export interface CardInput {
  view: ResultView;
  config: ScenarioConfig;
  summary: ResultSummary;
  /** Watermark domain, e.g. `trex-vs-tiger.vinylims.com`. */
  domain: string;
}

/** Every text the card draws, for font loading and tests. */
export function cardTexts(input: CardInput): string[] {
  const { view: v, summary: s } = input;
  const lang = v.lang;
  return [
    sm(lang, 'card.brand'),
    matchupLine(input),
    runsLine(input),
    v.winLabel,
    pct(v.shares[v.winner]),
    v.tierLabel,
    sm(lang, 'result.vsDefault', { diff: v.diffText }),
    `${v.heavyName} ${pct(v.shares.heavy)}`,
    `${v.packName} ${pct(v.shares.pack)}`,
    `${sm(lang, 'result.draw')} ${pct(v.shares.draw)}`,
    input.domain,
    sm(lang, 'card.watermark'),
    String(s.n),
  ];
}

/** "🦖 T-Rex 1  vs  🐅 호랑이 100": emoji as text only. */
export function matchupLine({ view: v, config: c }: CardInput): string {
  const n = (x: number): string => formatCount(x, v.lang);
  return `${v.heavyEmoji} ${v.heavyName} ${n(c.heavyCount)}  vs  ${v.packEmoji} ${v.packName} ${n(c.packCount)}`;
}

function runsLine({ view: v, summary: s }: CardInput): string {
  const n = formatCount(s.n, v.lang);
  return s.t === undefined
    ? sm(v.lang, 'card.runsNoT', { n })
    : sm(v.lang, 'card.runs', { n, t: formatSeconds(s.t, v.lang) });
}

/**
 * Load each weight of Pretendard for the actual card text, giving up after `timeoutMs` (the
 * system fallback then draws the text). Canvas text never reflows, so this runs before drawing.
 */
export async function loadCardFonts(texts: readonly string[], timeoutMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = texts.join(' ');
  const all = Promise.all(
    WEIGHTS.map((w) =>
      document.fonts.load(`${w} 48px "Pretendard Variable"`, sample).catch(() => []),
    ),
  );
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

const font = (weight: number, size: number): string => `${weight} ${size}px ${CARD_FONT}`;

/** Largest size ≤ `size` at which `text` fits `maxWidth`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  let s = size;
  ctx.font = font(weight, s);
  while (s > 16 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(weight, s);
  }
  return s;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  o: { weight: number; size: number; color: string; maxWidth: number; align?: CanvasTextAlign },
): number {
  fitFont(ctx, value, o.weight, o.size, o.maxWidth);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
  return ctx.measureText(value).width;
}

function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x + size * 0.62, y);
  ctx.lineTo(x - size * 0.38, y - size * 0.36);
  ctx.lineTo(x - size * 0.38, y + size * 0.36);
  ctx.closePath();
  ctx.fill();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const SIDE_COLOR: Readonly<Record<Side, string>> = {
  heavy: CARD_PALETTE.heavy,
  pack: CARD_PALETTE.pack,
  draw: CARD_PALETTE.draw,
};

/** Small deterministic PRNG so the glyph field is the same for the same matchup. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Abstract formation: heavy triangles on the left, pack dots on the right (capped counts). */
function glyphField(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { config } = input;
  const rnd = prng(config.seed ^ (config.heavyCount * 7919) ^ config.packCount);
  ctx.strokeStyle = CARD_PALETTE.grid;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = CARD_PALETTE.surface;
  ctx.fill();
  ctx.stroke();
  ctx.save();
  roundRect(ctx, x, y, w, h, 28);
  ctx.clip();
  ctx.strokeStyle = CARD_PALETTE.grid;
  ctx.lineWidth = 1.5;
  for (let gx = x + 40; gx < x + w; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y + 40; gy < y + h; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  const nHeavy = Math.min(config.heavyCount, 16);
  const nPack = Math.min(config.packCount, 90);
  const cy = y + h / 2;
  const heavyX = x + w * 0.3;
  ctx.fillStyle = CARD_PALETTE.heavy;
  const tri = Math.max(26, Math.min(44, h / (nHeavy + 2)));
  for (let i = 0; i < nHeavy; i++) {
    const v = nHeavy === 1 ? 0 : (i / (nHeavy - 1) - 0.5) * 2;
    const ty = cy + v * (h / 2 - tri);
    const tx = heavyX + (1 - v * v) * 30 + (rnd() - 0.5) * 12;
    triangle(ctx, tx, ty, tri);
  }
  // A loose, uneven cloud ahead of the heavy line: rejection-sampled with a minimum spacing and
  // a density that grows to the right, so it never closes into an outline or a letter.
  ctx.fillStyle = CARD_PALETTE.pack;
  const left = heavyX + 70;
  const span = x + w - 24 - left;
  const placed: [number, number][] = [];
  for (let guard = 0; placed.length < nPack && guard < 6000; guard++) {
    const px = left + Math.pow(rnd(), 0.8) * span;
    const py = y + 22 + rnd() * (h - 44);
    if (rnd() > 0.35 + 0.65 * ((px - left) / span)) continue;
    if (placed.some(([qx, qy]) => Math.hypot(qx - px, qy - py) < 26)) continue;
    placed.push([px, py]);
    dot(ctx, px, py, 8);
  }
  ctx.restore();
}

/** The win bar: heavy, pack, draw segments with a small gap, rounded ends. */
function winBar(
  ctx: CanvasRenderingContext2D,
  view: ResultView,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = CARD_PALETTE.grid;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.clip();
  let at = x;
  for (const side of ['heavy', 'pack', 'draw'] as const) {
    const sw = view.shares[side] * w;
    if (sw <= 0) continue;
    ctx.fillStyle = SIDE_COLOR[side];
    ctx.fillRect(at, y, sw, h);
    at += sw;
    if (at < x + w - 1) {
      ctx.fillStyle = CARD_PALETTE.bg;
      ctx.fillRect(at - 2, y, 4, h);
    }
  }
  ctx.restore();
}

/** Legend row: glyph + "name pct" for each side. */
function legend(
  ctx: CanvasRenderingContext2D,
  view: ResultView,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
): void {
  const items: { side: Side; label: string }[] = [
    { side: 'heavy', label: `${view.heavyName} ${pct(view.shares.heavy)}` },
    { side: 'pack', label: `${view.packName} ${pct(view.shares.pack)}` },
    { side: 'draw', label: `${sm(view.lang, 'result.draw')} ${pct(view.shares.draw)}` },
  ];
  const gap = size * 1.1;
  const glyph = size * 0.9;
  ctx.font = font(700, size);
  let total = 0;
  for (const it of items) total += glyph + 12 + ctx.measureText(it.label).width + gap;
  total -= gap;
  const scale = total > maxWidth ? maxWidth / total : 1;
  const s = size * scale;
  ctx.font = font(700, s);
  let at = x;
  for (const it of items) {
    ctx.fillStyle = SIDE_COLOR[it.side];
    const gy = y - s * 0.35;
    if (it.side === 'heavy') triangle(ctx, at + glyph * scale * 0.4, gy, glyph * scale);
    else if (it.side === 'pack') dot(ctx, at + glyph * scale * 0.45, gy, glyph * scale * 0.42);
    else
      ctx.fillRect(
        at + glyph * scale * 0.08,
        gy - glyph * scale * 0.36,
        glyph * scale * 0.72,
        glyph * scale * 0.72,
      );
    at += (glyph + 12) * scale;
    ctx.fillStyle = CARD_PALETTE.fg;
    ctx.textAlign = 'left';
    ctx.fillText(it.label, at, y);
    at += ctx.measureText(it.label).width + gap * scale;
  }
}

/** The brand mark: abstract blue triangle and orange dot. */
function mark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = CARD_PALETTE.heavy;
  triangle(ctx, x + s * 0.38, y, s);
  ctx.fillStyle = CARD_PALETTE.pack;
  dot(ctx, x + s * 1.35, y, s * 0.34);
}

interface Layout {
  margin: number;
  brandY: number;
  matchupY: number;
  matchupSize: number;
  runsY: number;
  field: { y: number; h: number } | null;
  winY: number;
  pctY: number;
  pctSize: number;
  tierY: number;
  barY: number;
  barH: number;
  legendY: number;
  waterY: number;
}

export function cardLayout(format: CardFormat): Layout {
  if (format === 'story') {
    const top = STORY_SAFE.top;
    return {
      margin: 90,
      brandY: top + 60,
      matchupY: top + 190,
      matchupSize: 60,
      runsY: top + 250,
      field: { y: top + 300, h: 270 },
      winY: top + 670,
      pctY: top + 880,
      pctSize: 230,
      tierY: top + 960,
      barY: top + 1020,
      barH: 60,
      legendY: top + 1150,
      waterY: CARD_SIZE.story.h - STORY_SAFE.bottom - 50,
    };
  }
  return {
    margin: 72,
    brandY: 110,
    matchupY: 210,
    matchupSize: 54,
    runsY: 265,
    field: null,
    winY: 380,
    pctY: 570,
    pctSize: 200,
    tierY: 650,
    barY: 720,
    barH: 54,
    legendY: 840,
    waterY: 975,
  };
}

/** Draw the card onto `canvas` (resized to the format). */
export function drawResultCard(
  canvas: HTMLCanvasElement,
  input: CardInput,
  format: CardFormat,
): void {
  const { w, h } = CARD_SIZE[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const L = cardLayout(format);
  const v = input.view;
  const lang = v.lang;
  const inner = w - L.margin * 2;
  const winColor = SIDE_COLOR[v.winner];

  ctx.fillStyle = CARD_PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
  // Brand colour band along the bottom edge, as on the OG card.
  ctx.fillStyle = CARD_PALETTE.heavy;
  ctx.fillRect(0, h - 14, w / 2 - 2, 14);
  ctx.fillStyle = CARD_PALETTE.pack;
  ctx.fillRect(w / 2 + 2, h - 14, w / 2 - 2, 14);

  mark(ctx, L.margin, L.brandY - 12, 34);
  text(ctx, sm(lang, 'card.brand'), L.margin + 76, L.brandY, {
    weight: 700,
    size: 34,
    color: CARD_PALETTE.muted,
    maxWidth: inner - 76,
  });

  text(ctx, matchupLine(input), L.margin, L.matchupY, {
    weight: 800,
    size: L.matchupSize,
    color: CARD_PALETTE.fg,
    maxWidth: inner,
  });
  text(ctx, runsLine(input), L.margin, L.runsY, {
    weight: 500,
    size: 34,
    color: CARD_PALETTE.muted,
    maxWidth: inner,
  });

  if (L.field) glyphField(ctx, input, L.margin, L.field.y, inner, L.field.h);

  text(ctx, v.winLabel, L.margin, L.winY, {
    weight: 800,
    size: 64,
    color: CARD_PALETTE.fg,
    maxWidth: inner,
  });
  text(ctx, pct(v.shares[v.winner]), L.margin - 8, L.pctY, {
    weight: 900,
    size: L.pctSize,
    color: winColor,
    maxWidth: inner,
  });

  // Tier chip, then the difference to the default matchup.
  ctx.font = font(800, 38);
  const chipW = ctx.measureText(v.tierLabel).width + 48;
  const chipH = 64;
  const chipY = L.tierY - chipH + 14;
  ctx.fillStyle = winColor;
  roundRect(ctx, L.margin, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(v.tierLabel, L.margin + 24, L.tierY);
  text(ctx, sm(lang, 'result.vsDefault', { diff: v.diffText }), L.margin + chipW + 22, L.tierY, {
    weight: 600,
    size: 32,
    color: CARD_PALETTE.muted,
    maxWidth: inner - chipW - 22,
  });

  winBar(ctx, v, L.margin, L.barY, inner, L.barH);
  legend(ctx, v, L.margin, L.legendY, 36, inner);

  // Watermark: domain and the assumption note, inside the safe area.
  ctx.fillStyle = CARD_PALETTE.border;
  ctx.fillRect(L.margin, L.waterY - 70, inner, 2);
  text(ctx, input.domain, L.margin, L.waterY - 18, {
    weight: 700,
    size: 32,
    color: CARD_PALETTE.fg,
    maxWidth: inner,
  });
  text(ctx, sm(lang, 'card.watermark'), L.margin, L.waterY + 26, {
    weight: 500,
    size: 28,
    color: CARD_PALETTE.muted,
    maxWidth: inner,
  });
}

export interface RenderedCard {
  blob: Blob;
  dataUrl: string;
  fileName: string;
}

export function cardFileName(input: CardInput, format: CardFormat): string {
  const c = input.config;
  const id = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '');
  return `trex-vs-tiger-${id(c.heavySpecies)}${c.heavyCount}-vs-${id(c.packSpecies)}${c.packCount}-${format}.png`;
}

/** Draw the card off-screen and encode it once as a PNG blob and a data URL. */
export async function renderCard(input: CardInput, format: CardFormat): Promise<RenderedCard> {
  await loadCardFonts(cardTexts(input));
  const canvas = document.createElement('canvas');
  drawResultCard(canvas, input, format);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  return { blob, dataUrl, fileName: cardFileName(input, format) };
}
