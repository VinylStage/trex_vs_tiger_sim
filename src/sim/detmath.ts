/**
 * Deterministic elementary functions (#197, docs/MODEL.md §2.2).
 *
 * ECMAScript leaves `Math.sin`, `Math.cos`, `Math.atan2`, `Math.log`, `Math.exp` and `Math.hypot`
 * implementation-approximated (§21.3.2), so the same battle could differ between V8 and
 * JavaScriptCore. These versions use only `+ − × ÷`, `Math.sqrt`, `Math.floor`, comparisons and
 * exact reads and writes of IEEE 754 bit patterns. Every one of those is exactly specified, so
 * the results are the same in every conforming engine on every platform.
 *
 * The algorithms and coefficients are those of fdlibm (Sun Microsystems, 1993, freely
 * redistributable, as kept in FreeBSD's msun; the basis of most C libraries' and of V8's own
 * versions): Cody–Waite argument
 * reduction and minimax polynomials, accurate to about one unit in the last place over the
 * ranges the engines use. Models from `mv` 2 and classic model version 2 call these; earlier
 * versions keep `Math` so their links reproduce as before.
 */

const view = new DataView(new ArrayBuffer(8));

const highWord = (x: number): number => {
  view.setFloat64(0, x);
  return view.getInt32(0);
};
const lowWord = (x: number): number => {
  view.setFloat64(0, x);
  return view.getUint32(4);
};
/** `x` with its high 32 bits replaced by `hi` (signed int32 bit pattern). */
const withHighWord = (x: number, hi: number): number => {
  view.setFloat64(0, x);
  view.setInt32(0, hi);
  return view.getFloat64(0);
};
/** 2^k for an integer k in [−1022, 1023], built from its bit pattern (exact). */
const pow2 = (k: number): number => {
  view.setUint32(0, ((k + 1023) << 20) >>> 0);
  view.setUint32(4, 0);
  return view.getFloat64(0);
};

// --- sin and cos ---

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

/** sin(x + y) for |x| ≤ π/4, y the tail of x (fdlibm __kernel_sin). */
function kernelSin(x: number, y: number): number {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** cos(x + y) for |x| ≤ π/4, y the tail of x (fdlibm __kernel_cos). */
function kernelCos(x: number, y: number): number {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_3 = 2.0222662487111664558e-21;
const PIO2_3T = 8.47842766036889956997e-32;
const PIO4 = 7.85398163397448278999e-1;

/**
 * sin(ax) (`cos` false) or cos(ax) (`cos` true) for finite ax > π/4: ax = n·π/2 + (y0 + y1) with
 * |y0| ≲ π/4 (Cody–Waite with a three-part π/2, as fdlibm's medium-size path, applied at every
 * size), then the kernel of quadrant n. Accurate while ax is below about 2^19·π/2; beyond that it
 * is still deterministic, only less accurate. The engines' angles stay below 2π.
 */
function reduced(ax: number, cos: boolean): number {
  const fn = Math.floor(ax * INV_PIO2 + 0.5);
  // fdlibm's three steps, each dropping the previous tail for the finer next part of π/2.
  let t = ax - fn * PIO2_1;
  let w = fn * PIO2_2;
  let r = t - w;
  t = r;
  w = fn * PIO2_3;
  r = t - w;
  w = fn * PIO2_3T - (t - r - w);
  const y0 = r - w;
  const y1 = r - y0 - w;
  // `fn & 3` is fn mod 4 for every integer fn (ToInt32 wraps modulo 2^32).
  const q = ((fn & 3) + (cos ? 1 : 0)) & 3;
  if (q === 0) return kernelSin(y0, y1);
  if (q === 1) return kernelCos(y0, y1);
  if (q === 2) return -kernelSin(y0, y1);
  return -kernelCos(y0, y1);
}

/** Deterministic sine. NaN and ±Infinity give NaN. */
export function dsin(x: number): number {
  const ax = x < 0 ? -x : x;
  if (ax <= PIO4) return ax < 7.450580596923828e-9 ? x : kernelSin(x, 0);
  if (!(ax < Infinity)) return NaN;
  return x < 0 ? -reduced(ax, false) : reduced(ax, false);
}

/** Deterministic cosine. NaN and ±Infinity give NaN. */
export function dcos(x: number): number {
  const ax = x < 0 ? -x : x;
  if (ax <= PIO4) return ax < 7.450580596923828e-9 ? 1 : kernelCos(ax, 0);
  if (!(ax < Infinity)) return NaN;
  return reduced(ax, true);
}

// --- atan and atan2 ---

const ATAN_HI = [
  4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1,
  1.570796326794896558,
] as const;
const ATAN_LO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17,
  6.12323399573676603587e-17,
] as const;
const AT0 = 3.33333333333329318027e-1;
const AT1 = -1.99999999998764832476e-1;
const AT2 = 1.42857142725034663711e-1;
const AT3 = -1.1111110405462355788e-1;
const AT4 = 9.09088713343650656196e-2;
const AT5 = -7.69187620504482999495e-2;
const AT6 = 6.66107313738753120669e-2;
const AT7 = -5.83357013379057348645e-2;
const AT8 = 4.97687799461593236017e-2;
const AT9 = -3.6531572744216915527e-2;
const AT10 = 1.62858201153657823623e-2;

/** atan(x) for x ≥ 0, finite (fdlibm s_atan.c). */
function atanPos(x: number): number {
  if (x >= 7.378697629483821e19) return ATAN_HI[3] + ATAN_LO[3];
  let id: number;
  if (x < 0.4375) {
    if (x < 7.450580596923828e-9) return x;
    id = -1;
  } else if (x < 1.1875) {
    if (x < 0.6875) {
      id = 0;
      x = (2 * x - 1) / (2 + x);
    } else {
      id = 1;
      x = (x - 1) / (x + 1);
    }
  } else if (x < 2.4375) {
    id = 2;
    x = (x - 1.5) / (1 + 1.5 * x);
  } else {
    id = 3;
    x = -1 / x;
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) return x - x * (s1 + s2);
  return (ATAN_HI[id] as number) - (x * (s1 + s2) - (ATAN_LO[id] as number) - x);
}

const PI = Math.PI;
const PI_LO = 1.2246467991473532e-16;
const PI_O_2 = 1.5707963267948966;
const PI_O_4 = 0.7853981633974483;
const TWO60 = 1.152921504606847e18;

/** Deterministic two-argument arctangent with the quadrant rules of `Math.atan2`. */
export function datan2(y: number, x: number): number {
  // Fast path: both finite and non-zero (every call the engines make with distinct points).
  if (y !== 0 && x !== 0 && y - y === 0 && x - x === 0) {
    const ay = y < 0 ? -y : y;
    const ax = x < 0 ? -x : x;
    const q = ay / ax;
    let z: number;
    if (q > TWO60) z = PI_O_2 + 0.5 * PI_LO;
    else if (x < 0 && q < 1 / TWO60) z = 0;
    else z = atanPos(q);
    if (x > 0) return y > 0 ? z : -z;
    return y > 0 ? PI - (z - PI_LO) : z - PI_LO - PI;
  }
  if (x !== x || y !== y) return NaN;
  // m: bit 1 set when x is negative (or −0), bit 0 when y is.
  const yNeg = y < 0 || (y === 0 && 1 / y < 0);
  const xNeg = x < 0 || (x === 0 && 1 / x < 0);
  const m = (xNeg ? 2 : 0) | (yNeg ? 1 : 0);
  if (y === 0) {
    if (m === 2) return PI;
    if (m === 3) return -PI;
    return y;
  }
  if (x === 0) return yNeg ? -PI_O_2 : PI_O_2;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      return m === 0 ? PI_O_4 : m === 1 ? -PI_O_4 : m === 2 ? 3 * PI_O_4 : -3 * PI_O_4;
    }
    return m === 0 ? 0 : m === 1 ? -0 : m === 2 ? PI : -PI;
  }
  if (y === Infinity || y === -Infinity) return yNeg ? -PI_O_2 : PI_O_2;
  const ay = y < 0 ? -y : y;
  const ax = x < 0 ? -x : x;
  const q = ay / ax;
  let z: number;
  if (q > TWO60) z = PI_O_2 + 0.5 * PI_LO;
  else if (xNeg && q < 1 / TWO60) z = 0;
  else z = atanPos(q);
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

// --- log and exp ---

const LN2_HI = 6.9314718036912381649e-1;
const LN2_LO = 1.90821492927058770002e-10;
const TWO54 = 1.8014398509481984e16;
const LG1 = 6.66666666666673513e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;

/** Deterministic natural logarithm (fdlibm e_log.c). */
export function dlog(x: number): number {
  if (x !== x) return NaN;
  let hx = highWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // Zero, subnormal or negative.
    if (((hx & 0x7fffffff) | lowWord(x)) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= TWO54;
    hx = highWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  // Normalise x into [√2/2, √2).
  x = withHighWord(x, hx | (i ^ 0x3ff00000));
  k += i >> 20;
  const f = x - 1;
  const dk = k;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) return k === 0 ? 0 : dk * LN2_HI + dk * LN2_LO;
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - R : dk * LN2_HI - (R - dk * LN2_LO - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * LN2_HI - (hfsq - (s * (hfsq + R) + dk * LN2_LO) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * LN2_HI - (s * (f - R) - dk * LN2_LO - f);
}

const O_THRESHOLD = 7.09782712893383973096e2;
const U_THRESHOLD = -7.4513321910194110842e2;
const INV_LN2 = 1.442695040888963387;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;
const HALF_LN2 = 0.5 * LN2_HI;
const THREE_HALF_LN2 = 1.0397207708399179;
const TWOM1000 = 9.3326361850321887899e-302;

/** Deterministic exponential (fdlibm e_exp.c). */
export function dexp(x: number): number {
  if (x !== x) return NaN;
  if (x === Infinity) return Infinity;
  if (x === -Infinity) return 0;
  if (x > O_THRESHOLD) return Infinity;
  if (x < U_THRESHOLD) return 0;
  const neg = x < 0;
  const ax = neg ? -x : x;
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (ax > HALF_LN2) {
    if (ax < THREE_HALF_LN2) {
      hi = neg ? x + LN2_HI : x - LN2_HI;
      lo = neg ? -LN2_LO : LN2_LO;
      k = neg ? -1 : 1;
    } else {
      const kf = INV_LN2 * x + (neg ? -0.5 : 0.5);
      k = kf < 0 ? -Math.floor(-kf) : Math.floor(kf);
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (ax < 3.725290298461914e-9) {
    return 1 + x;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  if (k >= -1021) return k > 1023 ? y * 2 * pow2(k - 1) : y * pow2(k);
  return y * pow2(k + 1000) * TWOM1000;
}

/** Deterministic hypotenuse √(x² + y²), the form the engines already use for distances. */
export const dhypot = (x: number, y: number): number => Math.sqrt(x * x + y * y);

/** The functions an engine calls, so a model version can pick its set once per battle. */
export interface MathSet {
  readonly sin: (x: number) => number;
  readonly cos: (x: number) => number;
  readonly atan2: (y: number, x: number) => number;
  readonly log: (x: number) => number;
  readonly hypot: (x: number, y: number) => number;
}

/** The engine's own implementations: the math of free `mv` 1 and classic model version 1. */
export const NATIVE_MATH: MathSet = {
  sin: Math.sin,
  cos: Math.cos,
  atan2: Math.atan2,
  log: Math.log,
  hypot: Math.hypot,
};

/** The deterministic implementations: free `mv` 2 and classic model version 2 onward. */
export const DET_MATH: MathSet = {
  sin: dsin,
  cos: dcos,
  atan2: datan2,
  log: dlog,
  hypot: dhypot,
};
