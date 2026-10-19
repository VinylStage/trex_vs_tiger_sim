export interface Interval {
  p: number;
  lo: number;
  hi: number;
}

/** Wilson score interval for a binomial proportion (default 95%). */
export function wilson(k: number, n: number, z = 1.959963984540054): Interval {
  if (n <= 0) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

export function mean(xs: ArrayLike<number>): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i] as number;
  return s / xs.length;
}

/** Linear-interpolated quantile of an ascending-sorted array. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = (n - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  return a + ((sorted[hi] as number) - a) * (pos - lo);
}

export interface Histogram {
  min: number;
  max: number;
  counts: number[];
}

export function histogram(
  xs: ArrayLike<number>,
  bins: number,
  min: number,
  max: number,
): Histogram {
  const counts = new Array<number>(bins).fill(0);
  const width = (max - min) / bins || 1;
  for (let i = 0; i < xs.length; i++) {
    let b = Math.floor(((xs[i] as number) - min) / width);
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    counts[b] = (counts[b] as number) + 1;
  }
  return { min, max, counts };
}

/** Fractional ranks (ties get the average rank), 1-based. */
export function ranks(xs: ArrayLike<number>): Float64Array {
  const n = xs.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (xs[a] as number) - (xs[b] as number),
  );
  const r = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && xs[idx[j + 1] as number] === xs[idx[i] as number]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k] as number] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  if (n < 2 || y.length !== n) return NaN;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman rank correlation. Returns 0 when either input is constant. */
export function spearman(x: ArrayLike<number>, y: ArrayLike<number>): number {
  return pearson(ranks(x), ranks(y));
}
