import { FREE_FRAME_STRIDE, FreeState, type FreeTrace } from '../../sim/free/engine.ts';
import { CLUSTER_GAP_S, CLUSTER_MAX_S } from './timeline.ts';

/*
 * Battle events derived from free-trace frames (RENEWAL-1.0 §10.8, #176; docs/REPLAY.md §14).
 * Trace v3 carries no event log, so every event here is read from the stored frames (one every
 * ≥ 0.5 s): states, HP fractions and positions. Pure and DOM-free (tests/free-events.test.ts);
 * captions, the slowdown, highlights and the still-standing names read it (#183).
 *
 * Times are frame times: an event is dated by the first frame that shows it, so it is never
 * ahead of the replay and at most one frame interval late.
 */

/**
 * Encirclement needs at least this many active enemies around one active target (k, S: an
 * assumption to be tuned in pilots, RENEWAL-1.0 §10.8).
 */
export const ENCIRCLE_MIN_ATTACKERS = 3;
/**
 * Encirclement radius r, measured between centres, is both body radii plus this gap (m, S).
 * Body-relative, so the same rule fits a wolf and an elephant.
 */
export const ENCIRCLE_GAP_M = 1;
/** A morale break is a rise of the side's fled share by at least x within the window (x, S). */
export const MORALE_BREAK_JUMP = 0.25;
/** Window of the morale-break rise (s, §10.8). */
export const MORALE_BREAK_WINDOW_S = 2;
/** The decisive moment is the last crossing of this win chance (§4.4). */
export const DECISIVE_CHANCE = 0.5;

export type FreeSide = 0 | 1;

/** First frame where some animal is latched or has lost HP. */
export interface FreeContactEvent {
  readonly kind: 'contact';
  readonly t: number;
}

/**
 * Animals of one side that became incapacitated, or fled (routed or left the arena), clustered
 * with the classic rule: the cluster continues while the next one is within CLUSTER_GAP_S of
 * the previous and is cut CLUSTER_MAX_S after its first (docs/REPLAY.md §8).
 */
export interface FreeClusterEvent {
  readonly kind: 'incapacitated' | 'fled';
  readonly side: FreeSide;
  /** Time of the first transition in the cluster. */
  readonly t: number;
  /** Time of the last transition in the cluster. */
  readonly end: number;
  readonly count: number;
  /** Agent indices, in transition order (index order within a frame). */
  readonly agents: readonly number[];
}

/**
 * An encirclement episode of one side: from the first frame where one of its active animals has
 * at least ENCIRCLE_MIN_ATTACKERS active enemies within the radius, until the first frame where
 * none has.
 */
export interface FreeEncircleEvent {
  readonly kind: 'encircle';
  /** Side of the encircled animal. */
  readonly side: FreeSide;
  readonly t: number;
  /** First frame without an encircled animal of the side, or the last frame's time. */
  readonly end: number;
  /** At the first frame: the encircled animal with the most enemies around it (lowest index). */
  readonly target: number;
  readonly attackers: number;
}

/** The share of a side that has ever fled rose by at least MORALE_BREAK_JUMP in the window. */
export interface FreeMoraleBreakEvent {
  readonly kind: 'moraleBreak';
  readonly side: FreeSide;
  readonly t: number;
  /** Fled share at the start of the window. */
  readonly from: number;
  /** Fled share at `t`. */
  readonly to: number;
}

export type FreeBattleEvent =
  FreeContactEvent | FreeClusterEvent | FreeEncircleEvent | FreeMoraleBreakEvent;

export interface FreeEvents {
  /** Time of the last frame (0 for an empty trace). */
  readonly duration: number;
  /** First-contact time, or null if the sides never met. */
  readonly firstContact: number | null;
  /** Time of the last incapacitation, or null: the decisive moment's fallback (§4.4). */
  readonly lastIncapacitation: number | null;
  /** Every event, sorted by time, then contact, incapacitated, fled, morale break, encircle, side. */
  readonly events: readonly FreeBattleEvent[];
  /** Per side, the agent indices still active (not fled, not incapacitated) in the final frame. */
  readonly stillStanding: readonly [readonly number[], readonly number[]];
}

const KIND_ORDER: Readonly<Record<FreeBattleEvent['kind'], number>> = {
  contact: 0,
  incapacitated: 1,
  fled: 2,
  moraleBreak: 3,
  encircle: 4,
};

const sideOf = (e: FreeBattleEvent): number => (e.kind === 'contact' ? -1 : e.side);

const isFled = (st: number): boolean => st === FreeState.Routed || st === FreeState.Left;

/** One transition: time and agent. */
interface Transition {
  t: number;
  agent: number;
}

/** Group time-sorted transitions with the classic rule (timeline.ts `cluster`). */
function cluster(
  list: readonly Transition[],
  kind: FreeClusterEvent['kind'],
  side: FreeSide,
  out: FreeBattleEvent[],
): void {
  let agents: number[] = [];
  let start = 0;
  let last = 0;
  const flush = (): void => {
    if (agents.length > 0)
      out.push({ kind, side, t: start, end: last, count: agents.length, agents });
  };
  for (const { t, agent } of list) {
    if (agents.length > 0 && t - last <= CLUSTER_GAP_S && t - start <= CLUSTER_MAX_S) {
      last = t;
      agents.push(agent);
      continue;
    }
    flush();
    agents = [agent];
    start = t;
    last = t;
  }
  flush();
}

/** Packs a cell key and an agent index into one sortable number (index below 2^20). */
const IDX = 0x100000;

/**
 * Encircled animals of side `s` in one frame: the one with the most attackers (lowest index on
 * ties) and its attacker count, or null. Active enemies are sorted by grid cell (cell size `r`,
 * `g` cells per row, coordinates clamped to the grid, which keeps neighbours neighbours), so each
 * target scans three row runs found by binary search: about O(n log n) per frame.
 */
function encircled(
  f: Float32Array,
  s: FreeSide,
  nA: number,
  n: number,
  r: number,
  g: number,
): { target: number; attackers: number } | null {
  const [from, to] = s === 0 ? [0, nA] : [nA, n];
  const [eFrom, eTo] = s === 0 ? [nA, n] : [0, nA];
  const cell = (v: number): number => Math.min(g - 1, Math.max(0, Math.floor(v / r) + 1));
  const packed: number[] = [];
  for (let i = eFrom; i < eTo; i++) {
    const o = i * FREE_FRAME_STRIDE;
    if ((f[o + 4] as number) >= FreeState.Routed) continue;
    packed.push((cell(f[o + 1] as number) * g + cell(f[o] as number)) * IDX + i);
  }
  const m = packed.length;
  if (m < ENCIRCLE_MIN_ATTACKERS) return null;
  const sorted = Float64Array.from(packed).sort();
  const keys = new Float64Array(m);
  const ids = new Int32Array(m);
  for (let k = 0; k < m; k++) {
    const v = sorted[k] as number;
    const key = Math.floor(v / IDX);
    keys[k] = key;
    ids[k] = v - key * IDX;
  }
  const lowerBound = (key: number): number => {
    let lo = 0;
    let hi = m;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((keys[mid] as number) < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const r2 = r * r;
  let best: { target: number; attackers: number } | null = null;
  for (let j = from; j < to; j++) {
    const o = j * FREE_FRAME_STRIDE;
    if ((f[o + 4] as number) >= FreeState.Routed) continue;
    const x = f[o] as number;
    const y = f[o + 1] as number;
    const cx = cell(x);
    const cy = cell(y);
    const x0 = Math.max(0, cx - 1);
    const x1 = Math.min(g - 1, cx + 1);
    let k = 0;
    for (let ry = Math.max(0, cy - 1); ry <= Math.min(g - 1, cy + 1); ry++) {
      const hi = ry * g + x1;
      for (let q = lowerBound(ry * g + x0); q < m && (keys[q] as number) <= hi; q++) {
        const p = (ids[q] as number) * FREE_FRAME_STRIDE;
        const ex = (f[p] as number) - x;
        const ey = (f[p + 1] as number) - y;
        if (ex * ex + ey * ey <= r2) k++;
      }
    }
    if (k >= ENCIRCLE_MIN_ATTACKERS && (best === null || k > best.attackers))
      best = { target: j, attackers: k };
  }
  return best;
}

/** Derive the battle events of a free trace (v3). Pure: the same trace gives the same events. */
export function deriveFreeEvents(trace: FreeTrace): FreeEvents {
  const frames = trace.frames;
  const [nA, nB] = trace.counts;
  const n = nA + nB;
  const side = (i: number): FreeSide => (i < nA ? 0 : 1);
  const last = frames[frames.length - 1];
  if (last === undefined)
    return {
      duration: 0,
      firstContact: null,
      lastIncapacitation: null,
      events: [],
      stillStanding: [[], []],
    };

  const events: FreeBattleEvent[] = [];
  const first = (frames[0] as (typeof frames)[number]).agents;

  // First contact: a latched animal or an HP fraction below its value in the first frame.
  let firstContact: number | null = null;
  for (const fr of frames) {
    const f = fr.agents;
    for (let i = 0; i < n && firstContact === null; i++) {
      const o = i * FREE_FRAME_STRIDE;
      if (
        (f[o + 4] as number) === FreeState.Latched ||
        (f[o + 3] as number) < (first[o + 3] as number)
      )
        firstContact = fr.t;
    }
    if (firstContact !== null) break;
  }
  if (firstContact !== null) events.push({ kind: 'contact', t: firstContact });

  // State transitions between consecutive frames, per side. An animal that fled and is later
  // incapacitated gives both; leaving the arena after a rout gives nothing new.
  const down: [Transition[], Transition[]] = [[], []];
  const fled: [Transition[], Transition[]] = [[], []];
  const everFled = new Uint8Array(n);
  const fledCount: [number, number] = [0, 0];
  for (let i = 0; i < n; i++) {
    if (isFled(first[i * FREE_FRAME_STRIDE + 4] as number)) {
      everFled[i] = 1;
      fledCount[side(i)]++;
    }
  }
  const share: [number[], number[]] = [[], []];
  const pushShare = (): void => {
    share[0].push(nA > 0 ? fledCount[0] / nA : 0);
    share[1].push(nB > 0 ? fledCount[1] / nB : 0);
  };
  pushShare();
  for (let k = 1; k < frames.length; k++) {
    const fr = frames[k] as (typeof frames)[number];
    const prev = (frames[k - 1] as (typeof frames)[number]).agents;
    const f = fr.agents;
    for (let i = 0; i < n; i++) {
      const o = i * FREE_FRAME_STRIDE + 4;
      const was = prev[o] as number;
      const now = f[o] as number;
      const s = side(i);
      if (now === FreeState.Dead && was !== FreeState.Dead) down[s].push({ t: fr.t, agent: i });
      if (isFled(now) && was < FreeState.Routed) fled[s].push({ t: fr.t, agent: i });
      if (isFled(now) && !everFled[i]) {
        everFled[i] = 1;
        fledCount[s]++;
      }
    }
    pushShare();
  }
  for (const s of [0, 1] as const) {
    cluster(down[s], 'incapacitated', s, events);
    cluster(fled[s], 'fled', s, events);
  }
  let lastIncapacitation: number | null = null;
  for (const s of [0, 1] as const) {
    const d = down[s][down[s].length - 1];
    if (d !== undefined && (lastIncapacitation === null || d.t > lastIncapacitation))
      lastIncapacitation = d.t;
  }

  // Morale break: the ever-fled share against the earliest frame within the window (at least
  // the previous frame, for traces whose frame interval grew past the window). One event per
  // rise; the next needs the condition to lapse first.
  for (const s of [0, 1] as const) {
    let open = false;
    let j = 0;
    for (let k = 1; k < frames.length; k++) {
      const t = (frames[k] as (typeof frames)[number]).t;
      while (j < k - 1 && t - (frames[j] as (typeof frames)[number]).t > MORALE_BREAK_WINDOW_S) j++;
      const from = share[s][j] as number;
      const to = share[s][k] as number;
      const jump = to - from >= MORALE_BREAK_JUMP - 1e-9;
      if (jump && !open) events.push({ kind: 'moraleBreak', side: s, t, from, to });
      open = jump;
    }
  }

  // Encirclement episodes per side.
  const r = trace.meta.radius[0] + trace.meta.radius[1] + ENCIRCLE_GAP_M;
  // Cells cover the arena plus one ring outside it; anything further out is clamped onto it.
  const g = Math.ceil(trace.arenaSize / r) + 3;
  for (const s of [0, 1] as const) {
    let open: { t: number; target: number; attackers: number } | null = null;
    for (const fr of frames) {
      const hit = encircled(fr.agents, s, nA, n, r, g);
      if (hit && !open) open = { t: fr.t, ...hit };
      else if (!hit && open) {
        events.push({ kind: 'encircle', side: s, end: fr.t, ...open });
        open = null;
      }
    }
    if (open) events.push({ kind: 'encircle', side: s, end: last.t, ...open });
  }

  events.sort(
    (a, b) => a.t - b.t || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || sideOf(a) - sideOf(b),
  );

  const stillStanding: [number[], number[]] = [[], []];
  for (let i = 0; i < n; i++)
    if ((last.agents[i * FREE_FRAME_STRIDE + 4] as number) < FreeState.Routed)
      stillStanding[side(i)].push(i);

  return { duration: last.t, firstContact, lastIncapacitation, events, stillStanding };
}

/** One point of a live win-chance timeline (§10.2): side A's win chance in [0, 1] at time t. */
export interface WinChancePoint {
  readonly t: number;
  readonly chance: number;
}

/**
 * The decisive moment (§4.4): the time of the last crossing of DECISIVE_CHANCE on the win-chance
 * timeline, interpolated linearly between the points on either side of it; touching 50 % and
 * turning back is not a crossing. Without a crossing it falls back to `events`' last
 * incapacitation, then to null. Points with a non-finite time or chance are ignored; the rest
 * are taken in time order.
 */
export function decisiveMoment(
  timeline: readonly WinChancePoint[],
  events?: Pick<FreeEvents, 'lastIncapacitation'>,
): number | null {
  const pts = timeline
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.chance))
    .sort((a, b) => a.t - b.t);
  let crossing: number | null = null;
  let prev: WinChancePoint | null = null;
  for (const p of pts) {
    const d = p.chance - DECISIVE_CHANCE;
    if (d === 0) continue;
    if (prev !== null && d > 0 !== prev.chance - DECISIVE_CHANCE > 0) {
      const f = (DECISIVE_CHANCE - prev.chance) / (p.chance - prev.chance);
      crossing = prev.t + f * (p.t - prev.t);
    }
    prev = p;
  }
  return crossing ?? events?.lastIncapacitation ?? null;
}
