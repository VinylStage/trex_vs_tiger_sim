/**
 * Uniform grid over a square arena, rebuilt each tick via counting sort.
 * Points outside the arena are clamped into border cells.
 */
export class SpatialGrid {
  readonly cellSize: number;
  readonly cols: number;
  private readonly cellStart: Int32Array;
  private readonly cellCount: Int32Array;
  private items: Int32Array;
  private cellOf: Int32Array;

  constructor(arenaSize: number, capacity: number, maxCols = 128) {
    this.cols = Math.max(1, Math.min(maxCols, Math.ceil(arenaSize / 10)));
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
}
