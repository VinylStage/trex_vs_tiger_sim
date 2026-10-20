import { h } from '../dom';
import type { MsgKey } from '../i18n';
import { paintPath } from './draw';
import {
  BUCKET_ORDER,
  PAINTS,
  biteCone,
  tigerGlyph,
  trexGauge,
  trexTriangle,
  type Bucket,
  type PathSink,
} from './glyphs';
import type { ReplayTheme } from './theme';

/** Legend swatch size (CSS px); matches `.legend-glyph` in styles.css. */
export const SWATCH_W = 30;
export const SWATCH_H = 18;
const TREX_LEN = 17;
const TIGER_R = 4.2;

type SwatchBuilder = (sink: (b: Bucket) => PathSink) => void;

const cx = SWATCH_W / 2;
const cy = SWATCH_H / 2;

/** Legend rows: each swatch is built by the same glyph builders and paints as the stage. */
export const LEGEND_ITEMS: readonly { key: MsgKey; head?: true; build?: SwatchBuilder }[] = [
  { key: 'replay.legendTrex', build: (s) => trexTriangle(s('trex'), cx, cy, 1, 0, TREX_LEN) },
  {
    key: 'replay.legendHp',
    build: (s) => {
      trexTriangle(s('trexHollow'), cx, cy, 1, 0, TREX_LEN);
      trexTriangle(s('trexOutline'), cx, cy, 1, 0, TREX_LEN);
      trexGauge(s('trexGauge'), cx, cy, 1, 0, TREX_LEN, 0.45);
    },
  },
  {
    key: 'replay.legendTrexDead',
    build: (s) => trexTriangle(s('deadTrex'), cx, cy, 1, 0, TREX_LEN),
  },
  { key: 'species.tiger', head: true },
  { key: 'state.approach', build: (s) => tigerGlyph('approach', s, cx - 4, cy, TIGER_R, 1, 0) },
  {
    key: 'state.latched',
    build: (s) => tigerGlyph('latched', s, cx + 5, cy, TIGER_R, 1, 0, 1, cy),
  },
  { key: 'state.recover', build: (s) => tigerGlyph('recover', s, cx, cy, TIGER_R, 1, 0) },
  { key: 'state.routed', build: (s) => tigerGlyph('routed', s, cx, cy, TIGER_R, 1, 0) },
  { key: 'state.dead', build: (s) => tigerGlyph('dead', s, cx, cy, TIGER_R, 1, 0) },
  {
    key: 'replay.legendBite',
    build: (s) => biteCone(s('biteHit'), 4, cy, 0, SWATCH_W - 8, 0.32),
  },
];

/**
 * DOM legend (text stays crisp, translatable and accessible); every swatch is a small canvas
 * painted with the stage's own glyph functions, so legend and stage cannot drift apart.
 */
export class ReplayLegend {
  readonly el: HTMLUListElement;
  private readonly swatches: { canvas: HTMLCanvasElement; build: SwatchBuilder }[] = [];

  constructor() {
    this.el = h('ul', { class: 'legend', i18nAria: 'replay.legendLabel' });
    for (const item of LEGEND_ITEMS) {
      if (item.head) {
        this.el.append(h('li', { class: 'legend-head', i18n: item.key }));
        continue;
      }
      const canvas = h('canvas', { class: 'legend-glyph', attrs: { 'aria-hidden': 'true' } });
      if (item.build) this.swatches.push({ canvas, build: item.build });
      this.el.append(h('li', {}, canvas, h('span', { i18n: item.key })));
    }
  }

  draw(theme: ReplayTheme, dpr: number): void {
    for (const { canvas, build } of this.swatches) {
      const bw = Math.round(SWATCH_W * dpr);
      const bh = Math.round(SWATCH_H * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = theme.arena;
      ctx.fillRect(0, 0, SWATCH_W, SWATCH_H);
      const paths: Partial<Record<Bucket, Path2D>> = {};
      build((b) => (paths[b] ??= new Path2D()));
      for (const b of BUCKET_ORDER) {
        const path = paths[b];
        if (path) paintPath(ctx, path, PAINTS[b], theme);
      }
    }
  }
}
