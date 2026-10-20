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
  /** Bounding box (in cells) of the occupied cells after the last rebuild; empty when min > max. */
  private minCol = 0;
  private maxCol = -1;
  private minRow = 0;
  private maxRow = -1;

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
    let minCol = this.cols;
    let maxCol = -1;
    let minRow = this.cols;
    let maxRow = -1;
    for (let i = 0; i < n; i++) {
      if (!include(i)) {
        this.cellOf[i] = -1;
        continue;
      }
      const row = this.col(ys[i] as number);
      const col = this.col(xs[i] as number);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
      const c = row * this.cols + col;
      this.cellOf[i] = c;
      this.cellCount[c] = (this.cellCount[c] as number) + 1;
    }
    this.minCol = minCol;
    this.maxCol = maxCol;
    this.minRow = minRow;
    this.maxRow = maxRow;
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
    // Clipped to the occupied box: cells outside it are empty, so the same points are visited
    // in the same order as without the clip (bit-identical; docs/PERFORMANCE.md).
    const c0 = Math.max(this.col(x - r), this.minCol);
    const c1 = Math.min(this.col(x + r), this.maxCol);
    const r0 = Math.max(this.col(y - r), this.minRow);
    const r1 = Math.min(this.col(y + r), this.maxRow);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const c = row * this.cols + col;
        const end = this.cellStart[c + 1] as number;
        for (let k = this.cellStart[c] as number; k < end; k++) visit(this.items[k] as number);
      }
    }
  }

  /**
   * Number of `accept`ed points within distance `r` of (x, y), counting at most `cap`: the scan
   * stops as soon as `cap` is reached, so a dense crowd costs O(cap) instead of O(neighbours).
   * Points are visited in the same order as `query`.
   */
  countWithin(
    x: number,
    y: number,
    r: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
    cap: number,
  ): number {
    if (cap <= 0) return 0;
    const r2 = r * r;
    const c0 = Math.max(this.col(x - r), this.minCol);
    const c1 = Math.min(this.col(x + r), this.maxCol);
    const r0 = Math.max(this.col(y - r), this.minRow);
    const r1 = Math.min(this.col(y + r), this.maxRow);
    let count = 0;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const c = row * this.cols + col;
        const end = this.cellStart[c + 1] as number;
        for (let k = this.cellStart[c] as number; k < end; k++) {
          const i = this.items[k] as number;
          const dx = (xs[i] as number) - x;
          const dy = (ys[i] as number) - y;
          if (dx * dx + dy * dy > r2 || !accept(i)) continue;
          if (++count >= cap) return count;
        }
      }
    }
    return count;
  }

  /**
   * Whether any `accept`ed point lies within distance `r` of (x, y). Scans the cell holding
   * (x, y) first, where a neighbour usually is, then the rest of the square.
   */
  hasWithin(
    x: number,
    y: number,
    r: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
  ): boolean {
    const r2 = r * r;
    const home = this.col(y) * this.cols + this.col(x);
    if (this.cellHas(home, x, y, r2, xs, ys, accept)) return true;
    const c0 = Math.max(this.col(x - r), this.minCol);
    const c1 = Math.min(this.col(x + r), this.maxCol);
    const r0 = Math.max(this.col(y - r), this.minRow);
    const r1 = Math.min(this.col(y + r), this.maxRow);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const c = row * this.cols + col;
        if (c !== home && this.cellHas(c, x, y, r2, xs, ys, accept)) return true;
      }
    }
    return false;
  }

  private cellHas(
    c: number,
    x: number,
    y: number,
    r2: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
  ): boolean {
    const end = this.cellStart[c + 1] as number;
    for (let k = this.cellStart[c] as number; k < end; k++) {
      const i = this.items[k] as number;
      const dx = (xs[i] as number) - x;
      const dy = (ys[i] as number) - y;
      if (dx * dx + dy * dy <= r2 && accept(i)) return true;
    }
    return false;
  }

  /**
   * First `accept`ed point within distance `r` of (x, y) in cell order (the order `query`
   * visits), or -1. Stops at the first match.
   */
  firstWithin(
    x: number,
    y: number,
    r: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
    maxVisits = Infinity,
  ): number {
    const r2 = r * r;
    const c0 = Math.max(this.col(x - r), this.minCol);
    const c1 = Math.min(this.col(x + r), this.maxCol);
    const r0 = Math.max(this.col(y - r), this.minRow);
    const r1 = Math.min(this.col(y + r), this.maxRow);
    // Rings of cells outward from the cell holding (x, y), so a capped search sees the nearest
    // candidates first; `maxVisits` bounds the points examined within distance r.
    const cx = this.col(x);
    const cy = this.col(y);
    const rings = Math.max(cx - c0, c1 - cx, cy - r0, r1 - cy);
    let visits = 0;
    for (let ring = 0; ring <= rings; ring++) {
      for (let row = cy - ring; row <= cy + ring; row++) {
        if (row < r0 || row > r1) continue;
        const edge = row === cy - ring || row === cy + ring;
        for (let col = cx - ring; col <= cx + ring; col += edge || ring === 0 ? 1 : 2 * ring) {
          if (col < c0 || col > c1) continue;
          const c = row * this.cols + col;
          const end = this.cellStart[c + 1] as number;
          for (let k = this.cellStart[c] as number; k < end; k++) {
            const i = this.items[k] as number;
            const dx = (xs[i] as number) - x;
            const dy = (ys[i] as number) - y;
            if (dx * dx + dy * dy > r2) continue;
            if (accept(i)) return i;
            if (++visits >= maxVisits) return -1;
          }
        }
      }
    }
    return -1;
  }

  /**
   * Nearest indexed point to (x, y) among those `accept`ed, searching rings of cells outward
   * and stopping once no unvisited ring can hold a closer point. Returns -1 if none.
   * Distances use the points' true coordinates `xs`/`ys`.
   *
   * Only cells inside the bounding box of the occupied cells are read, and the search ends once
   * a ring covers that box. Cells outside the box are empty, so the points are visited in exactly
   * the same order as by a full ring search and ties resolve the same way (bit-identical runs;
   * docs/PERFORMANCE.md).
   */
  nearest(
    x: number,
    y: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
  ): number {
    const { minCol, maxCol, minRow, maxRow } = this;
    if (maxCol < minCol) return -1;
    const cx = this.col(x);
    const cy = this.col(y);
    // Rings needed to cover the occupied box from (cx, cy).
    const lastRing = Math.max(cx - minCol, maxCol - cx, cy - minRow, maxRow - cy);
    let best = -1;
    let bestD = Infinity;
    for (let ring = 0; ring <= lastRing; ring++) {
      if (best >= 0) {
        const gap = (ring - 1) * this.cellSize;
        if (gap > 0 && gap * gap > bestD) break;
      }
      const r0 = cy - ring;
      const r1 = cy + ring;
      const c0 = cx - ring;
      const c1 = cx + ring;
      const rowFrom = r0 > minRow ? r0 : minRow;
      const rowTo = r1 < maxRow ? r1 : maxRow;
      for (let row = rowFrom; row <= rowTo; row++) {
        if (row === r0 || row === r1) {
          // Top or bottom edge of the ring: every column, clipped to the box.
          const colFrom = c0 > minCol ? c0 : minCol;
          const colTo = c1 < maxCol ? c1 : maxCol;
          for (let col = colFrom; col <= colTo; col++) {
            const k = this.scan(row * this.cols + col, x, y, xs, ys, accept, bestD);
            if (k >= 0) {
              best = k;
              bestD = this.lastD;
            }
          }
        } else {
          // Side rows: only the two edge columns (one when ring = 0), left before right.
          if (c0 >= minCol && c0 <= maxCol) {
            const k = this.scan(row * this.cols + c0, x, y, xs, ys, accept, bestD);
            if (k >= 0) {
              best = k;
              bestD = this.lastD;
            }
          }
          if (c1 !== c0 && c1 >= minCol && c1 <= maxCol) {
            const k = this.scan(row * this.cols + c1, x, y, xs, ys, accept, bestD);
            if (k >= 0) {
              best = k;
              bestD = this.lastD;
            }
          }
        }
      }
    }
    return best;
  }

  /** Squared distance of the point `scan` last returned. */
  private lastD = Infinity;

  /** The closest accepted point of cell `c` strictly closer than `bestD` (first on ties), or -1. */
  private scan(
    c: number,
    x: number,
    y: number,
    xs: Float64Array,
    ys: Float64Array,
    accept: (i: number) => boolean,
    bestD: number,
  ): number {
    let best = -1;
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
    if (best >= 0) this.lastD = bestD;
    return best;
  }
}
