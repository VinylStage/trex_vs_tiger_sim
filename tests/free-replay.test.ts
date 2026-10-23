import { describe, expect, it } from 'vitest';
import { sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FREE_FRAME_STRIDE,
  FreeState,
  simulateFreeBattle,
  type FreeRunSummary,
  type FreeTrace,
} from '../src/sim/free/engine';
import type { FreeSpeciesId } from '../src/sim/free/species';
import { designRow } from '../src/sim/sampling';
import {
  FREE_TRIANGLE_RADIUS,
  FreeWorld,
  freeLod,
  freeSideGlyph,
} from '../src/ui/replay/free-world';
import { GLYPH, heavyLengthForRadius } from '../src/ui/replay/glyphs';

/*
 * The free-matchup replay model (#50 item 3b, design §6): glyph by size, interpolation between
 * frames, states never ahead of their frame, buff flags, end counts equal to the run summary,
 * and the classic LOD threshold.
 */

function battle(
  a: FreeSpeciesId,
  na: number,
  b: FreeSpeciesId,
  nb: number,
  run = 0,
): { config: FreeConfig; trace: FreeTrace; summary: FreeRunSummary } {
  const config = sanitizeFreeConfig({
    runs: 4,
    sides: [
      { species: a, count: na },
      { species: b, count: nb },
    ],
  });
  const out = simulateFreeBattle(config, designRow(buildFreeDesign(config), run), run, true);
  if (!out.trace) throw new Error('no trace');
  return { config, trace: out.trace, summary: out.summary };
}

describe('free replay glyphs', () => {
  it('follows size, not role', () => {
    expect(freeSideGlyph(2.5)).toEqual({ glyph: 'triangle', sizeM: heavyLengthForRadius(2.5) });
    expect(freeSideGlyph(FREE_TRIANGLE_RADIUS).glyph).toBe('triangle');
    expect(freeSideGlyph(0.5)).toEqual({ glyph: 'dot', sizeM: 0.5 });
    const { trace } = battle('trex', 1, 'wolf', 8);
    const w = new FreeWorld(trace);
    expect(w.glyphs.map((g) => g.glyph)).toEqual(['triangle', 'dot']);
    // A mirror matchup draws both sides alike; only the colour tells them apart.
    const m = new FreeWorld(battle('tiger', 2, 'tiger', 2).trace);
    expect(m.glyphs[0]).toEqual(m.glyphs[1]);
  });

  it('switches dots to LOD squares at the classic zoom threshold', () => {
    const at = GLYPH.lodBelowPx / GLYPH.lodRadiusM;
    expect(freeLod(at * 0.99)).toBe(true);
    expect(freeLod(at * 1.01)).toBe(false);
  });
});

describe('free replay world', () => {
  const { trace, summary } = battle('wolf', 6, 'tiger', 1, 1);
  const w = new FreeWorld(trace);

  it('reproduces every stored frame exactly', () => {
    for (const k of [0, Math.floor(trace.frames.length / 2), trace.frames.length - 1]) {
      const f = trace.frames[k];
      if (!f) continue;
      w.update(f.t);
      for (let i = 0; i < w.n; i++) {
        const o = i * FREE_FRAME_STRIDE;
        expect(w.x[i]).toBe(f.agents[o]);
        expect(w.y[i]).toBe(f.agents[o + 1]);
        expect(w.state[i]).toBe(f.agents[o + 4]);
        expect(w.buffed[i]).toBe(f.buffed[i]);
      }
    }
  });

  it('interpolates between frames and never shows a state early', () => {
    const fa = trace.frames[3];
    const fb = trace.frames[4];
    if (!fa || !fb) throw new Error('short trace');
    w.update((fa.t + fb.t) / 2);
    for (let i = 0; i < w.n; i++) {
      const o = i * FREE_FRAME_STRIDE;
      expect(w.state[i]).toBe(fa.agents[o + 4]);
      expect(w.buffed[i]).toBe(fa.buffed[i]);
      const ax = fa.agents[o] as number;
      const bx = fb.agents[o] as number;
      if ((fa.agents[o + 4] as number) >= FreeState.Dead) expect(w.x[i]).toBe(ax);
      else expect(w.x[i]).toBeCloseTo((ax + bx) / 2, 4);
    }
  });

  it('ends with the counts of the run summary', () => {
    w.update(w.duration);
    expect(w.duration).toBeCloseTo(summary.duration, 6);
    const c = w.counts();
    expect(c.dead).toEqual([summary.aKilled, summary.bKilled]);
    expect(c.fled).toEqual([summary.aRouted, summary.bRouted]);
    expect(c.active).toEqual([summary.aActive, summary.bActive]);
  });

  it('marks the buff only for a social side', () => {
    expect(w.buffSides).toEqual([true, false]);
    for (const f of trace.frames) for (let i = w.nA; i < w.n; i++) expect(f.buffed[i]).toBe(0);
    expect(new FreeWorld(battle('tiger', 3, 'lion', 1).trace).buffSides).toEqual([false, false]);
  });

  it('frames the fight inside the arena', () => {
    for (const time of [0, w.duration / 2, w.duration]) {
      w.update(time);
      const box = w.fightBox();
      expect(box.size).toBeGreaterThan(0);
      expect(box.size).toBeLessThanOrEqual(w.arena);
    }
  });
});

describe('free replay camera', () => {
  it('keeps a small side in the auto view next to a large one', () => {
    const { trace } = battle('wolf', 600, 'elephant', 5);
    const w = new FreeWorld(trace);
    w.update(0);
    const box = w.fightBox();
    for (let i = w.nA; i < w.n; i++) {
      expect(Math.abs((w.x[i] as number) - box.cx)).toBeLessThanOrEqual(box.size / 2);
      expect(Math.abs((w.y[i] as number) - box.cy)).toBeLessThanOrEqual(box.size / 2);
    }
  });
});
