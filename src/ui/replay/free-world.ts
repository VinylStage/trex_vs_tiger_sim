import { FREE_FRAME_STRIDE, FreeState, type FreeTrace } from '../../sim/free/engine.ts';
import { GLYPH, heavyLengthForRadius } from './glyphs.ts';
import { frameIndex, lerp, lerpAngle } from './interp.ts';

/*
 * The free-matchup replay model (design §6 "Replay", #50 item 3b): positions, headings, states
 * and pack-buff flags at any time of a free trace (v3), interpolated between the stored frames.
 * Pure and DOM-free (tests/free-replay.test.ts); src/ui/free-replay.ts draws it.
 *
 * Glyphs stay abstract and side-coloured. Shape follows size, not role: a side whose body radius
 * is at least FREE_TRIANGLE_RADIUS is drawn as heading triangles (the classic heavy glyph, length
 * from the radius), any other side as dots sized from the radius.
 */

/** Body radius (m) from which a side is drawn as triangles (design §6). */
export const FREE_TRIANGLE_RADIUS = 1;

export type FreeGlyph = 'triangle' | 'dot';

export interface FreeSideGlyph {
  glyph: FreeGlyph;
  /** Triangle length or dot radius, in metres. */
  sizeM: number;
}

/** Glyph of a side with body radius `radiusM`. */
export function freeSideGlyph(radiusM: number): FreeSideGlyph {
  return radiusM >= FREE_TRIANGLE_RADIUS
    ? { glyph: 'triangle', sizeM: heavyLengthForRadius(radiusM) }
    : { glyph: 'dot', sizeM: radiusM };
}

/**
 * Whether dots switch to level-of-detail squares at `scale` px/m: the classic rule, the same
 * zoom threshold for every species (a reference 0.8 m radius below 3 CSS px; docs/REPLAY.md §6).
 */
export const freeLod = (scale: number): boolean => GLYPH.lodRadiusM * scale < GLYPH.lodBelowPx;

/** Per-side counts at the current time. */
export interface FreeSceneCounts {
  /** Still fighting (approach, latched, recovering). */
  active: [number, number];
  /** Fled (routed or left the arena). */
  fled: [number, number];
  dead: [number, number];
}

export class FreeWorld {
  readonly n: number;
  readonly nA: number;
  readonly arena: number;
  readonly duration: number;
  readonly times: Float64Array;
  readonly glyphs: [FreeSideGlyph, FreeSideGlyph];
  /** Interpolated state at the last `update`. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly head: Float32Array;
  readonly state: Uint8Array;
  readonly buffed: Uint8Array;
  /** Per side: any of its agents is ever buffed (the legend then shows the ring). */
  readonly buffSides: [boolean, boolean];
  private readonly trace: FreeTrace;

  constructor(trace: FreeTrace) {
    this.trace = trace;
    this.nA = trace.counts[0];
    this.n = trace.counts[0] + trace.counts[1];
    this.arena = trace.arenaSize;
    this.times = Float64Array.from(trace.frames, (f) => f.t);
    this.duration = this.times.length > 0 ? (this.times[this.times.length - 1] as number) : 0;
    this.glyphs = [freeSideGlyph(trace.meta.radius[0]), freeSideGlyph(trace.meta.radius[1])];
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.head = new Float32Array(this.n);
    this.state = new Uint8Array(this.n);
    this.buffed = new Uint8Array(this.n);
    const everBuffed = (from: number, to: number): boolean =>
      trace.frames.some((f) => f.buffed.subarray(from, to).some((b) => b !== 0));
    this.buffSides = [everBuffed(0, this.nA), everBuffed(this.nA, this.n)];
    this.update(0);
  }

  /** Side of agent `i`: 0 (A) or 1 (B). */
  side(i: number): 0 | 1 {
    return i < this.nA ? 0 : 1;
  }

  /**
   * Interpolate to `time`: position and heading linearly between the frames around it; state
   * and buff flag from the earlier frame, so a change never shows before it happened.
   */
  update(time: number): void {
    const frames = this.trace.frames;
    if (frames.length === 0) return;
    const ia = frameIndex(this.times, time);
    const ib = Math.min(ia + 1, frames.length - 1);
    const fa = frames[ia] as (typeof frames)[number];
    const fb = frames[ib] as (typeof frames)[number];
    const ta = this.times[ia] as number;
    const tb = this.times[ib] as number;
    const f = tb > ta ? Math.min(1, Math.max(0, (time - ta) / (tb - ta))) : 0;
    const a = fa.agents;
    const b = fb.agents;
    for (let i = 0; i < this.n; i++) {
      const o = i * FREE_FRAME_STRIDE;
      const st = a[o + 4] as number;
      this.state[i] = st;
      // Dead and departed agents stay where frame a has them.
      const g = st >= FreeState.Dead ? 0 : f;
      this.x[i] = lerp(a[o] as number, b[o] as number, g);
      this.y[i] = lerp(a[o + 1] as number, b[o + 1] as number, g);
      this.head[i] = lerpAngle(a[o + 2] as number, b[o + 2] as number, g);
      this.buffed[i] = fa.buffed[i] as number;
    }
  }

  counts(): FreeSceneCounts {
    const c: FreeSceneCounts = { active: [0, 0], fled: [0, 0], dead: [0, 0] };
    for (let i = 0; i < this.n; i++) {
      const s = this.side(i);
      const st = this.state[i] as number;
      if (st === FreeState.Dead) c.dead[s]++;
      else if (st >= FreeState.Routed) c.fled[s]++;
      else c.active[s]++;
    }
    return c;
  }

  /**
   * Box around the agents still fighting (each side trimmed of its outer 2 % per axis when it
   * has many), padded
   * by 6 m and at least 24 m wide; the whole arena when nobody fights.
   */
  fightBox(): { cx: number; cy: number; size: number } {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    // Trimmed per side, so a small side is never cut away as an outlier of a large one.
    for (const [from, to] of [
      [0, this.nA],
      [this.nA, this.n],
    ] as const) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = from; i < to; i++) {
        if ((this.state[i] as number) >= FreeState.Routed) continue;
        xs.push(this.x[i] as number);
        ys.push(this.y[i] as number);
      }
      if (xs.length === 0) continue;
      xs.sort((p, q) => p - q);
      ys.sort((p, q) => p - q);
      const trim = xs.length >= 50 ? Math.floor(xs.length * 0.02) : 0;
      x0 = Math.min(x0, xs[trim] as number);
      x1 = Math.max(x1, xs[xs.length - 1 - trim] as number);
      y0 = Math.min(y0, ys[trim] as number);
      y1 = Math.max(y1, ys[ys.length - 1 - trim] as number);
    }
    if (x0 > x1) return { cx: this.arena / 2, cy: this.arena / 2, size: this.arena };
    const size = Math.min(this.arena, Math.max(24, x1 - x0 + 12, y1 - y0 + 12));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size };
  }
}
