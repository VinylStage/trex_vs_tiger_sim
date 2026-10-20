import { describe, expect, it } from 'vitest';
import {
  GLYPH,
  gaugeHeight,
  packGlyph,
  heavyGauge,
  heavyTriangle,
  type PathSink,
} from '../src/ui/replay/glyphs';
import { iou, rasterize, record, RecordingPath } from './glyph-raster';

const STATES = ['approach', 'latched', 'recover', 'routed', 'dead'] as const;

function mask(state: (typeof STATES)[number], r: number, heading: number): Uint8Array {
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  return rasterize(record((sink) => packGlyph(state, sink, 16, 16, r, dx, dy)));
}

const area = (m: Uint8Array): number => m.reduce((s, v) => s + v, 0);

describe('tiger glyphs are separable by shape alone (V1)', () => {
  // r from the smallest true-shape size (LOD threshold) to a close zoom that still fits 32 × 32.
  const radii = [GLYPH.lodBelowPx, 4, 6, 8];
  const headings = [0, Math.PI / 4, (2 * Math.PI) / 3];

  it.each(radii)('pairwise mask IoU < 0.6 at r = %s px', (r) => {
    for (const h of headings) {
      const masks = STATES.map((s) => mask(s, r, h));
      for (const m of masks) expect(area(m)).toBeGreaterThan(0);
      for (let a = 0; a < STATES.length; a++) {
        for (let b = a + 1; b < STATES.length; b++) {
          const v = iou(masks[a] as Uint8Array, masks[b] as Uint8Array);
          expect(v, `${STATES[a]} vs ${STATES[b]} at r=${r}, heading=${h.toFixed(2)}`).toBeLessThan(
            0.6,
          );
        }
      }
    }
  });
});

describe('T-Rex HP gauge', () => {
  it('fills an area equal to the HP fraction', () => {
    for (const hp of [0.1, 0.25, 0.5, 0.8, 0.99]) {
      const h = gaugeHeight(hp);
      expect(1 - (1 - h) ** 2).toBeCloseTo(hp, 12);
    }
    expect(gaugeHeight(0)).toBe(0);
    expect(gaugeHeight(1)).toBe(1);
    expect(gaugeHeight(-1)).toBe(0);
  });

  it('builds a gauge polygon whose area matches the HP fraction', () => {
    const polyArea = (p: RecordingPath): number => {
      const pts = p.subpaths[0]?.pts ?? [];
      let s = 0;
      for (let k = 0; k < pts.length / 2; k++) {
        const x0 = pts[k * 2] as number;
        const y0 = pts[k * 2 + 1] as number;
        const x1 = pts[((k + 1) % (pts.length / 2)) * 2] as number;
        const y1 = pts[((k + 1) % (pts.length / 2)) * 2 + 1] as number;
        s += x0 * y1 - x1 * y0;
      }
      return Math.abs(s) / 2;
    };
    const tri = new RecordingPath();
    heavyTriangle(tri, 50, 40, Math.cos(0.7), Math.sin(0.7), 30);
    const full = polyArea(tri);
    for (const hp of [0.2, 0.5, 0.9]) {
      const g = new RecordingPath();
      heavyGauge(g, 50, 40, Math.cos(0.7), Math.sin(0.7), 30, hp);
      expect(polyArea(g) / full).toBeCloseTo(hp, 9);
    }
  });

  it('draws nothing for an empty gauge', () => {
    const calls: string[] = [];
    const sink: PathSink = {
      moveTo: () => calls.push('m'),
      lineTo: () => calls.push('l'),
      arc: () => calls.push('a'),
      closePath: () => calls.push('z'),
    };
    heavyGauge(sink, 0, 0, 1, 0, 20, 0);
    expect(calls).toEqual([]);
  });
});
