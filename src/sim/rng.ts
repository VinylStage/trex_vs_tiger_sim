/** splitmix32 step: good avalanche, used for seeding and hashing. */
export function splitmix32(state: number): number {
  let z = (state + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/** Derive an independent 32-bit seed for a stream (e.g. run index) from a master seed. */
export function deriveSeed(master: number, stream: number, salt = 0): number {
  return splitmix32(splitmix32(master ^ Math.imul(salt + 1, 0x85ebca6b)) ^ stream);
}

/** sfc32 PRNG (PractRand-clean, 128-bit state). Deterministic for a given seed. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;

  constructor(seed: number) {
    let s = seed >>> 0;
    s = splitmix32(s);
    this.a = s;
    s = splitmix32(s);
    this.b = s;
    s = splitmix32(s);
    this.c = s;
    s = splitmix32(s);
    this.d = s;
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Standard normal (Box–Muller, cached pair). */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
}
