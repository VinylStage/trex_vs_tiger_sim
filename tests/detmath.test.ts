import { describe, expect, it } from 'vitest';
import { DET_MATH, NATIVE_MATH, datan2, dcos, dexp, dlog, dsin } from '../src/sim/detmath';
import { Rng } from '../src/sim/rng';

/*
 * Deterministic elementary functions (#197, src/sim/detmath.ts). Cross-engine identity is
 * checked by `npm run test:jsc` against tests/fixtures/mv2-golden.json; here: accuracy against
 * the engine's own `Math`, the special values, and that model 1 keeps `Math`.
 */

/** Distance in units in the last place of `b`. */
const ulps = (a: number, b: number): number => {
  if (a === b) return 0;
  const e = Math.max(Math.floor(Math.log2(Math.abs(b))), -1022);
  return Math.abs(a - b) / 2 ** (e - 52);
};

function inputs(n: number, scale: number, seed: number): number[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => (r.next() - 0.5) * scale);
}

describe('accuracy against Math', () => {
  it('sin and cos within 1 ulp on [−20, 20] and near zero', () => {
    for (const x of [...inputs(50000, 40, 1), ...inputs(2000, 2e-6, 2)]) {
      expect(ulps(dsin(x), Math.sin(x)), String(x)).toBeLessThanOrEqual(1);
      expect(ulps(dcos(x), Math.cos(x)), String(x)).toBeLessThanOrEqual(1);
    }
  });

  it('atan2 within 1 ulp in every quadrant', () => {
    const ys = inputs(50000, 2000, 3);
    const xs = inputs(50000, 2000, 4);
    ys.forEach((y, i) => {
      const x = xs[i] as number;
      expect(
        ulps(datan2(y, x), Math.atan2(y, x)),
        `${String(y)}, ${String(x)}`,
      ).toBeLessThanOrEqual(1);
    });
  });

  it('log and exp within 1 ulp', () => {
    for (const x of inputs(50000, 2000, 5)) {
      const p = Math.abs(x) + 1e-12;
      expect(ulps(dlog(p), Math.log(p)), String(p)).toBeLessThanOrEqual(1);
      expect(ulps(dexp(x / 3), Math.exp(x / 3)), String(x)).toBeLessThanOrEqual(1);
    }
    for (const p of inputs(5000, 1, 6).map((x) => Math.abs(x) + Number.MIN_VALUE)) {
      expect(ulps(dlog(p), Math.log(p)), String(p)).toBeLessThanOrEqual(1);
    }
  });
});

describe('special values', () => {
  it('follow Math', () => {
    for (const x of [Number.NaN, Infinity, -Infinity]) {
      expect(dsin(x)).toBeNaN();
      expect(dcos(x)).toBeNaN();
    }
    expect(Object.is(dsin(-0), -0)).toBe(true);
    expect(dcos(0)).toBe(1);
    const pairs: [number, number][] = [
      [0, 0],
      [-0, 0],
      [0, -0],
      [-0, -0],
      [1, 0],
      [-1, 0],
      [0, -1],
      [-0, -1],
      [Infinity, Infinity],
      [-Infinity, -Infinity],
      [1, Infinity],
      [1, -Infinity],
      [Infinity, 1],
    ];
    for (const [y, x] of pairs)
      expect(Object.is(datan2(y, x), Math.atan2(y, x)), `${y},${x}`).toBe(true);
    expect(datan2(Number.NaN, 1)).toBeNaN();
    expect(dlog(0)).toBe(-Infinity);
    expect(dlog(-1)).toBeNaN();
    expect(dlog(Infinity)).toBe(Infinity);
    expect(dlog(1)).toBe(0);
    expect(dexp(0)).toBe(1);
    expect(dexp(-Infinity)).toBe(0);
    expect(dexp(1000)).toBe(Infinity);
    expect(dexp(-1000)).toBe(0);
    expect(dexp(709.7)).toBe(Math.exp(709.7));
  });
});

describe('model versions', () => {
  it('model 1 keeps the engine’s own Math; model 2 uses the deterministic set', () => {
    expect(NATIVE_MATH.sin).toBe(Math.sin);
    expect(NATIVE_MATH.atan2).toBe(Math.atan2);
    expect(NATIVE_MATH.log).toBe(Math.log);
    expect(NATIVE_MATH.hypot).toBe(Math.hypot);
    expect(DET_MATH.sin).toBe(dsin);
  });

  it('Rng keeps the same integer stream; only normal() changes, by at most a few ulps', () => {
    const a = new Rng(42);
    const b = new Rng(42, true);
    for (let i = 0; i < 1000; i++) expect(b.nextU32()).toBe(a.nextU32());
    const c = new Rng(42);
    const d = new Rng(42, true);
    for (let i = 0; i < 10000; i++) {
      const x = c.normal();
      expect(Math.abs(d.normal() - x)).toBeLessThanOrEqual(
        4 * Number.EPSILON * Math.max(1, Math.abs(x)),
      );
    }
  });
});
