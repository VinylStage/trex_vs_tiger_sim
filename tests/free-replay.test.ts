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
import { freeKeyAction, freeLoadPlan } from '../src/ui/free-replay';
import {
  FREE_TRIANGLE_RADIUS,
  FreeWorld,
  freeGlyphPx,
  freeLod,
  freeSideGlyph,
  validGlyphScale,
} from '../src/ui/replay/free-world';
import { GLYPH, heavyLengthForRadius } from '../src/ui/replay/glyphs';
import { isChord } from '../src/ui/replay/timeline';

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

describe('free replay keys', () => {
  it('toggles play from the physical K key while a Korean IME is on', () => {
    expect(freeKeyAction('KeyK', 'ㅏ', false)).toEqual({ kind: 'toggle' });
    expect(freeKeyAction('KeyK', 'Process', false)).toEqual({ kind: 'toggle' });
    expect(freeKeyAction('KeyJ', 'ㅓ', false)).toEqual({ kind: 'seekBy', seconds: -5 });
    expect(freeKeyAction('KeyL', 'ㅣ', false)).toEqual({ kind: 'seekBy', seconds: 5 });
    expect(freeKeyAction('KeyF', 'ㄹ', false)).toEqual({ kind: 'view' });
  });

  it('keeps its own keys and leaves out the classic event keys', () => {
    expect(freeKeyAction('Space', ' ', false)).toEqual({ kind: 'toggle' });
    expect(freeKeyAction('KeyK', 'K', true)).toEqual({ kind: 'toggle' });
    expect(freeKeyAction('ArrowLeft', 'ArrowLeft', true)).toEqual({ kind: 'seekBy', seconds: -5 });
    expect(freeKeyAction('ArrowRight', 'ArrowRight', false)).toEqual({
      kind: 'seekBy',
      seconds: 1,
    });
    expect(freeKeyAction('Home', 'Home', false)).toEqual({ kind: 'seekTo', to: 'start' });
    expect(freeKeyAction('End', 'End', false)).toEqual({ kind: 'seekTo', to: 'end' });
    expect(freeKeyAction('BracketRight', ']', false)).toEqual({ kind: 'speed', dir: 1 });
    expect(freeKeyAction('KeyC', 'ㅊ', false)).toBeNull();
    expect(freeKeyAction('Comma', ',', false)).toBeNull();
    expect(freeKeyAction('PageUp', 'PageUp', false)).toBeNull();
  });

  it('changes speed from [ and ] typed with AltGr or Option, and leaves Ctrl+F to the browser', () => {
    const altGr = (k: string): boolean => k === 'AltGraph';
    // AltGr+9 on a German layout, as Chrome on Windows reports it (Ctrl+Alt plus AltGraph).
    const de = { key: ']', ctrlKey: true, altKey: true, metaKey: false, getModifierState: altGr };
    expect(isChord(de)).toBe(false);
    expect(freeKeyAction('Digit9', ']', false)).toEqual({ kind: 'speed', dir: 1 });
    // Option+5 on a German Mac.
    expect(isChord({ key: '[', ctrlKey: false, altKey: true, metaKey: false })).toBe(false);
    expect(freeKeyAction('Digit5', '[', false)).toEqual({ kind: 'speed', dir: -1 });
    // Ctrl+F and Cmd+F find in page, not the view toggle.
    expect(isChord({ key: 'f', ctrlKey: true, altKey: false, metaKey: false })).toBe(true);
    expect(isChord({ key: 'f', ctrlKey: false, altKey: false, metaKey: true })).toBe(true);
  });
});

describe('free replay trace swap (#177)', () => {
  const { trace } = battle('wolf', 6, 'tiger', 1, 1);
  const k = Math.floor(trace.frames.length / 2);
  const swapAt = (trace.frames[k] as (typeof trace.frames)[number]).t;
  // A fork at the swap time: the frames up to it are shared, every later one has diverged.
  const fork: FreeTrace = {
    ...trace,
    frames: trace.frames.map((f, i) => {
      if (i <= k) return f;
      const agents = Float32Array.from(f.agents, (v, j) => (j % FREE_FRAME_STRIDE < 2 ? v + 3 : v));
      return { t: f.t + 0.25, agents, buffed: f.buffed.slice() };
    }),
  };

  it('shows the same scene at every time before the swap for two traces sharing a prefix', () => {
    const a = new FreeWorld(trace);
    const b = new FreeWorld(fork);
    const before = trace.frames.slice(0, k).flatMap((f, i) => {
      const next = trace.frames[i + 1] as (typeof trace.frames)[number];
      return [f.t, (f.t + next.t) / 2];
    });
    for (const time of [...before, swapAt]) {
      a.update(time);
      b.update(time);
      expect(b.x).toEqual(a.x);
      expect(b.y).toEqual(a.y);
      expect(b.head).toEqual(a.head);
      expect(b.state).toEqual(a.state);
      expect(b.buffed).toEqual(a.buffed);
      expect(b.fightBox()).toEqual(a.fightBox());
    }
    // Past the swap the fork shows its own frames.
    const late = (trace.frames[k + 1] as (typeof trace.frames)[number]).t;
    a.update(late);
    b.update(late);
    expect(b.x).not.toEqual(a.x);
  });

  it('loads from the start as before when no options are given', () => {
    const idle = { hasWorld: false, playing: false, reducedMotion: false };
    const fresh = {
      time: 0,
      playing: true,
      snapCamera: true,
      releaseAutoPause: true,
      resetGlyphScale: true,
    };
    expect(freeLoadPlan(42, {}, idle)).toEqual(fresh);
    // A trace that replaces another one, mid-playback, still starts over.
    expect(freeLoadPlan(42, {}, { hasWorld: true, playing: true, reducedMotion: false })).toEqual(
      fresh,
    );
    expect(freeLoadPlan(42, {}, { ...idle, hasWorld: true })).toEqual(fresh);
    expect(freeLoadPlan(42, {}, { ...idle, reducedMotion: true })).toEqual({
      ...fresh,
      playing: false,
    });
    expect(freeLoadPlan(0, {}, idle)).toEqual({ ...fresh, playing: false });
    expect(freeLoadPlan(42, { autoplay: false }, idle)).toEqual({ ...fresh, playing: false });
    expect(freeLoadPlan(42, { autoplay: true }, idle)).toEqual(fresh);
  });

  it('swaps at the playhead and keeps camera, position and playback', () => {
    const live = { hasWorld: true, playing: true, reducedMotion: false };
    expect(freeLoadPlan(60, { startAt: 12.5 }, live)).toEqual({
      time: 12.5,
      playing: true,
      snapCamera: false,
      releaseAutoPause: false,
      resetGlyphScale: false,
    });
    // Paused stays paused, whatever autoplay says; a playback the viewer started under
    // reduced motion keeps playing.
    expect(
      freeLoadPlan(60, { startAt: 12.5, autoplay: true }, { ...live, playing: false }),
    ).toEqual({
      time: 12.5,
      playing: false,
      snapCamera: false,
      releaseAutoPause: false,
      resetGlyphScale: false,
    });
    expect(freeLoadPlan(60, { startAt: 12.5 }, { ...live, reducedMotion: true }).playing).toBe(
      true,
    );
    // A fork that ends before the playhead stops at its end.
    expect(freeLoadPlan(10, { startAt: 12.5 }, live)).toMatchObject({ time: 10, playing: false });
    expect(freeLoadPlan(60, { startAt: -1 }, live).time).toBe(0);
    // Nothing on screen yet: the camera has nothing to carry over.
    expect(freeLoadPlan(60, { startAt: 12.5 }, { ...live, hasWorld: false }).snapCamera).toBe(true);
    // A non-finite time is ignored: a plain load.
    expect(freeLoadPlan(60, { startAt: Number.NaN }, live).time).toBe(0);
  });

  it('has a render-only glyph scale that leaves the default size untouched', () => {
    const tri = freeSideGlyph(2.5);
    const dot = freeSideGlyph(0.5);
    for (const lod of [false, true]) {
      for (const pxPerM of [0.5, 4, 40]) {
        const len = Math.max(lod ? GLYPH.minHeavyPx * 0.6 : GLYPH.minHeavyPx, tri.sizeM * pxPerM);
        expect(freeGlyphPx(tri, pxPerM, lod)).toEqual({ tri: true, len, r: len * 0.42 });
        expect(freeGlyphPx(dot, pxPerM, lod).r).toBe(Math.max(GLYPH.minPackPx, 0.5 * pxPerM));
        const big = freeGlyphPx(tri, pxPerM, lod, 1.5);
        expect(big.len).toBeCloseTo(len * 1.5, 9);
        expect(freeGlyphPx(dot, pxPerM, lod, 1.5).r).toBeCloseTo(
          Math.max(GLYPH.minPackPx, 0.5 * pxPerM) * 1.5,
          9,
        );
      }
    }
    for (const bad of [0, -2, Number.NaN, Infinity]) expect(validGlyphScale(bad)).toBe(1);
    // The world, and so the physics radius it reads, does not change.
    const w = new FreeWorld(trace);
    expect(w.glyphs).toEqual([
      freeSideGlyph(trace.meta.radius[0]),
      freeSideGlyph(trace.meta.radius[1]),
    ]);
  });
});
