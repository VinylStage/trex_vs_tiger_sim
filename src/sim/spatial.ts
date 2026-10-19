/**
 * Uniform grid over a square arena, rebuilt each tick via counting sort.
 * Points outside the arena are clamped into border cells.
 * Resolution scales with both area (≥ 10 m cells) and population (~2·√capacity columns),
 * so a sparse grid does not pay O(cells) bookkeeping per tick.
 */
export class SpatialGrid {
  readonly cellSize: number;
  readonly cols: number;
  private readonly cellStart: Int32Array;
  private readonly cellCount: Int32Array;
  private items: Int32Array;
  private cellOf: Int32Array;

  constructor(arenaSize: number, capacity: number, maxCols = 128) {
    const byArea = Math.ceil(arenaSize / 10);
    const byPopulation = Math.max(4, Math.ceil(2 * Math.sqrt(capacity)));
    this.cols = Math.max(1, Math.min(maxCols, byArea, byPopulation));
    this.cellSize = arenaSize / this.cols;
    const cells = this.cols * this.cols;
    this.cellStart = new Int32Array(cells + 1);
    this.cellCount = new Int32Array(cells);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  private col(v: number): number {
    const c = Math.floor(v / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  /** Index points `i` where `include(i)` is true. */
  rebuild(n: number, xs: Float64Array, ys: Float64Array, include: (i: number) => boolean): void {
    this.cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      if (!include(i)) {
        this.cellOf[i] = -1;
        continue;
      }
      const c = this.col(ys[i] as number) * this.cols + this.col(xs[i] as number);
      this.cellOf[i] = c;
      this.cellCount[c] = (this.cellCount[c] as number) + 1;
    }
    let acc = 0;
    for (let c = 0; c < this.cellCount.length; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c] as number;
    }
    this.cellStart[this.cellCount.length] = acc;
    this.cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i] as number;
      if (c < 0) continue;
      this.items[(this.cellStart[c] as number) + (this.cellCount[c] as number)] = i;
      this.cellCount[c] = (this.cellCount[c] as number) + 1;
    }
  }

  /** Visit candidate indices whose cell intersects the square around (x, y) of half-size r. */
  query(x: number, y: number, r: number, visit: (i: number) => void): void {
    const c0 = this.col(x - r);
    const c1 = this.col(x + r);
    const r0 = this.col(y - r);
    const r1 = this.col(y + r);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const c = row * this.cols + col;
        const end = this.cellStart[c + 1] as number;
        for (let k = this.cellStart[c] as number; k < end; k++) visit(this.items[k] as number);
      }
    }
  }

  /**
   * Nearest indexed point to (x, y) among those `accept`ed, searching rings of cells outward
   * and stopping once no unvisited ring can hold a closer point. Returns -1 if none.
   * Distances use the points' true coordinates `xs`/`ys`.
   */
  nearest(
    x: number,
    y: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
  ): number {
    const cx = this.col(x);
    const cy = this.col(y);
    let best = -1;
    let bestD = Infinity;
    for (let ring = 0; ring < this.cols; ring++) {
      if (best >= 0) {
        const gap = (ring - 1) * this.cellSize;
        if (gap > 0 && gap * gap > bestD) break;
      }
      const r0 = cy - ring;
      const r1 = cy + ring;
      const c0 = cx - ring;
      const c1 = cx + ring;
      for (let row = r0; row <= r1; row++) {
        if (row < 0 || row >= this.cols) continue;
        const step = row === r0 || row === r1 ? 1 : Math.max(1, c1 - c0);
        for (let col = c0; col <= c1; col += step) {
          if (col < 0 || col >= this.cols) continue;
          const c = row * this.cols + col;
          const end = this.cellStart[c + 1] as number;
          for (let k = this.cellStart[c] as number; k < end; k++) {
            const i = this.items[k] as number;
            if (!accept(i)) continue;
            const dx = (xs[i] as number) - x;
            const dy = (ys[i] as number) - y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
    }
    return best;
  }
}
