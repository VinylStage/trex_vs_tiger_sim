/**
 * Adaptive quality (docs/REPLAY.md §10; ANIMATION.md §5.6). Pure: fed one sample per animation
 * frame, it picks a tier that sheds trails, effect fills, backing-store density and finally
 * glyph detail while frames are slow, and restores them once there is headroom again.
 */

export interface QualityTier {
  readonly heavyTrails: boolean;
  readonly packTrails: boolean;
  /** Bite cones may be filled (otherwise every effect is an outline). */
  readonly fills: boolean;
  /** Backing-store density cap. */
  readonly dprCap: number;
  /** Draw pack animals as LOD squares at any zoom. */
  readonly forceLod: boolean;
}

/** T0 full · T1 no pack animal trails · T2 + outline-only effects, DPR ≤ 2 · T3 + LOD squares, no trails. */
export const TIERS: readonly QualityTier[] = [
  { heavyTrails: true, packTrails: true, fills: true, dprCap: 3, forceLod: false },
  { heavyTrails: true, packTrails: false, fills: true, dprCap: 3, forceLod: false },
  { heavyTrails: true, packTrails: false, fills: false, dprCap: 2, forceLod: false },
  { heavyTrails: false, packTrails: false, fills: false, dprCap: 2, forceLod: true },
];

export const QUALITY = {
  /** Rolling window of frame samples (ms). */
  windowMs: 1000,
  /** Slow: p95 frame interval above max(slowMs, slowRatio × cadence) … */
  slowMs: 20,
  slowRatio: 1.25,
  /** … for this long steps down one tier. */
  downAfterMs: 1000,
  /**
   * Headroom: p95 interval within headroomRatio × cadence and p95 draw time below headroomJsMs,
   * held for upAfterMs, steps up one tier. A step down within flapMs of a step up doubles the
   * wait (up to maxUpAfterMs), so the tiers do not oscillate.
   */
  headroomRatio: 1.15,
  headroomJsMs: 12,
  upAfterMs: 5000,
  maxUpAfterMs: 40_000,
  flapMs: 10_000,
  /**
   * Cadence: a window whose p95 interval is within steadyRatio × its median while the p95 draw
   * time is below cheapJsMs; 60 Hz until one is seen.
   */
  steadyRatio: 1.1,
  cheapJsMs: 8,
  defaultCadenceMs: 1000 / 60,
  /** Ring buffer size (frames). */
  capacity: 240,
} as const;

/**
 * Chooses the tier from frame samples. "Cadence" is the display's own frame interval: the
 * smallest steady window median seen while drawing was cheap. A browser that caps rAF at 30 fps
 * (iOS Low Power Mode) is therefore not treated as slow; only frames slower than its cadence are.
 */
export class QualityGovernor {
  tier = 0;
  private readonly at = new Float64Array(QUALITY.capacity);
  private readonly iv = new Float64Array(QUALITY.capacity);
  private readonly js = new Float64Array(QUALITY.capacity);
  private readonly tmp = new Float64Array(QUALITY.capacity);
  private head = 0;
  private size = 0;
  private cadence = Infinity;
  private slowSince = -1;
  private fastSince = -1;
  private upAfter: number = QUALITY.upAfterMs;
  private lastUp = -Infinity;
  /** Last computed window statistics (ms), for the debug overlay. */
  p95Interval = 0;
  p95Js = 0;

  /** Forget the window (after a pause, a seek or a hidden page); keeps tier and cadence. */
  reset(): void {
    this.size = 0;
    this.slowSince = -1;
    this.fastSince = -1;
  }

  get cadenceMs(): number {
    return this.cadence;
  }

  /**
   * One animation frame: `now` its timestamp, `intervalMs` the time since the previous frame,
   * `jsMs` the time spent drawing it. Returns true when the tier changed.
   */
  push(now: number, intervalMs: number, jsMs: number): boolean {
    if (!(intervalMs > 0)) return false;
    const cap = QUALITY.capacity;
    this.at[this.head] = now;
    this.iv[this.head] = intervalMs;
    this.js[this.head] = jsMs;
    this.head = (this.head + 1) % cap;
    if (this.size < cap) this.size++;

    // Samples inside the window, newest first.
    let n = 0;
    let span = 0;
    for (let q = 0; q < this.size; q++) {
      const idx = (this.head - 1 - q + cap) % cap;
      if (now - (this.at[idx] as number) > QUALITY.windowMs) break;
      n++;
      span = now - (this.at[idx] as number);
    }
    // Decide only on a (nearly) full window.
    if (span < QUALITY.windowMs * 0.8) return false;
    const median = this.quantile(this.iv, n, 0.5);
    this.p95Interval = this.quantile(this.iv, n, 0.95);
    this.p95Js = this.quantile(this.js, n, 0.95);
    // A steady interval while drawing is cheap is the display's (or browser's) cadence.
    const steady = this.p95Interval <= QUALITY.steadyRatio * median;
    if (steady && this.p95Js < QUALITY.cheapJsMs && median < this.cadence) this.cadence = median;
    const cad = Number.isFinite(this.cadence) ? this.cadence : QUALITY.defaultCadenceMs;

    const slow = this.p95Interval > Math.max(QUALITY.slowMs, QUALITY.slowRatio * cad);
    const fast =
      this.p95Interval <= QUALITY.headroomRatio * cad && this.p95Js < QUALITY.headroomJsMs;
    this.slowSince = slow ? (this.slowSince < 0 ? now : this.slowSince) : -1;
    this.fastSince = fast ? (this.fastSince < 0 ? now : this.fastSince) : -1;

    if (slow && this.tier < TIERS.length - 1 && now - this.slowSince >= QUALITY.downAfterMs) {
      if (now - this.lastUp < QUALITY.flapMs)
        this.upAfter = Math.min(QUALITY.maxUpAfterMs, this.upAfter * 2);
      this.tier++;
      this.reset();
      return true;
    }
    if (fast && this.tier > 0 && now - this.fastSince >= this.upAfter) {
      this.tier--;
      this.lastUp = now;
      this.reset();
      return true;
    }
    return false;
  }

  /** Quantile of the newest n samples of a ring buffer (insertion sort into scratch, no alloc). */
  private quantile(src: Float64Array, n: number, q: number): number {
    const cap = QUALITY.capacity;
    const t = this.tmp;
    for (let k = 0; k < n; k++) {
      const v = src[(this.head - 1 - k + cap) % cap] as number;
      let m = k - 1;
      while (m >= 0 && (t[m] as number) > v) {
        t[m + 1] = t[m] as number;
        m--;
      }
      t[m + 1] = v;
    }
    return t[Math.min(n - 1, Math.floor(q * (n - 1)))] as number;
  }
}
