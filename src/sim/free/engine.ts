import { individualFactor } from '../distributions.ts';
import { CONSTANTS, DT } from '../engine.ts';
import { Rng, deriveSeed } from '../rng.ts';
import { SpatialGrid } from '../spatial.ts';
import { FREE_PARAM_INDEX, type FreeConfig, type GlobalId } from './config.ts';
import { FREE_SPECIES } from './species.ts';
import { TRAITS, TRAIT_BOUNDS, type TraitId } from './traits.ts';

/**
 * Symmetric battle engine of the free model (docs/design/FREE-MATCHUPS.md §4) with the pack-buff
 * layer of §5 on top. The legacy engine (`src/sim/engine.ts`) is frozen and never calls this
 * module.
 *
 * The pack buff applies only to agents of a `social` species, with at least one effect switched
 * on, while an ally is within the species' cohesion radius (plus the `T_grace` hysteresis). It
 * draws no random numbers, so with every effect off, or for a non-social species, every result is
 * bit-identical to the individual layer (tests/free-golden.test.ts, tests/free-buff.test.ts).
 *
 * Every agent runs the same state machine with its own species' traits. A tick has three phases
 * so that update order cannot favour a side (design §4.6):
 *
 * 1. **Move**: every agent decides and moves from the start-of-tick snapshot into next buffers;
 *    positions and headings are committed together, then riders are placed on their hosts.
 * 2. **Act**: strikes, latch attempts and shake-off rolls against the moved positions; effects go
 *    into per-agent accumulators, never directly into HP or state.
 * 3. **Apply**: damage, bleeding, morale, deaths, releases, knock-backs, throws, then routs.
 *
 * Side A uses one random stream and side B another (`SALT_A`, `SALT_B`); each side draws only
 * for its own agents, in index order, so spawning side B never shifts side A's draws.
 */

export const FreeState = {
  Approach: 0,
  Latched: 1,
  Recover: 2,
  Routed: 3,
  Dead: 4,
  Left: 5,
} as const;

export const FreeOutcome = { A: 0, B: 1, Draw: 2 } as const;
export type FreeOutcomeCode = (typeof FreeOutcome)[keyof typeof FreeOutcome];

/** Free-model constants not sampled per run (the sampled ones are `GLOBALS` in config.ts). */
export const FREE_CONSTANTS = {
  /** Retarget interval for every agent (s); one value avoids a role-like asymmetry (§4.1). */
  retarget: 0.5,
  /** Gap kept at contact (m), as the legacy contact margin. */
  contactMargin: 0.5,
  /** Agents in Approach stop at this fraction of strike reach from the target's body. */
  strikeStop: 0.8,
  /** Pack-buff status is refreshed every this many ticks, staggered by agent index (§7). */
  buffRefreshTicks: 5,
  /** E3: group latching raises a latch chance to at most this multiple of its base (**S**, 1.5–3). */
  groupLatchCap: 2,
  /** E3: turn-rate loss of a host per buffed rider, and its floor (**S**). */
  restraintPerRider: 0.1,
  restraintFloor: 0.5,
  /** E4a: bound on the numbers-based morale support `c` (**S**, 0–0.2). */
  supportCap: 0.1,
  /**
   * E4b: most allies' deaths and routs that cost an agent morale in one tick (**S**, 1–5 and
   * 1–3). Without a cap a few routs in a large pack cascade into a rout of the whole pack within
   * a second; the design bounds every effect's magnitude (§5.2).
   */
  contagionDeathCap: 3,
  /** E5: allies within cohesion range examined for a fresh reliever, nearest cells first (cost cap). */
  reliefMaxVisits: 32,
  contagionRoutCap: 1,
  /** E4a: allies and enemies counted for morale support, at most (cost cap, §7). */
  supportCountCap: 16,
  /** E4a support is refreshed every this many ticks (2 s), staggered; it changes slowly. */
  supportRefreshTicks: 20,
} as const;

/**
 * What the pack buff did for one side in one run (design §5, §6). All zero for a non-social
 * species, a side of one, or with every effect switched off.
 */
export interface BuffStats {
  /** Buffed agent-ticks / active agent-ticks, in [0, 1]. */
  activeFrac: number;
  /** Seconds during which at least one agent of the side was buffed. */
  anyTime: number;
  /** Times an agent's buff switched on. */
  activations: number;
  /** E1: agent-ticks spent on a coordinated (slot or sidestep) approach. */
  coordinate: number;
  /** E2: retargets where the shared target differed from the nearest enemy. */
  focus: number;
  /** E3: latch attempts with a raised chance. */
  groupLatch: number;
  /** E3: host-ticks with a reduced turn rate. */
  restraint: number;
  /** E4a: status refreshes with a non-zero morale support. */
  support: number;
  /** E4b: morale losses applied for an ally's death or rout. */
  contagion: number;
  /** E5: riders relieved by a fresh ally. */
  relief: number;
}

export const emptyBuffStats = (): BuffStats => ({
  activeFrac: 0,
  anyTime: 0,
  activations: 0,
  coordinate: 0,
  focus: 0,
  groupLatch: 0,
  restraint: 0,
  support: 0,
  contagion: 0,
  relief: 0,
});

export interface FreeRunSummary {
  run: number;
  outcome: FreeOutcomeCode;
  duration: number;
  aAlive: number;
  aKilled: number;
  aRouted: number;
  aActive: number;
  bAlive: number;
  bKilled: number;
  bRouted: number;
  bActive: number;
  /** HP of side A's surviving agents / side A's initial HP. */
  aHpFrac: number;
  bHpFrac: number;
  /** Active HP fraction of A minus that of B, in [−1, 1]. Used for sensitivity. */
  advantage: number;
  /** Pack-buff activity of side A and side B. */
  buffA: BuffStats;
  buffB: BuffStats;
}

export const FREE_TRACE_VERSION = 3;

/** Per agent: x, y, heading, hpFrac (≤ 0 dead), state. */
export const FREE_FRAME_STRIDE = 5;

export interface FreeTraceFrame {
  t: number;
  agents: Float32Array<ArrayBuffer>;
  /** Per agent 1 while its pack buff is active (social sides only; all 0 otherwise). */
  buffed: Uint8Array<ArrayBuffer>;
}

export interface FreeTrace {
  version: typeof FREE_TRACE_VERSION;
  arenaSize: number;
  /** Agents of side A are indices 0…counts[0]−1, side B follows. */
  counts: [number, number];
  frames: FreeTraceFrame[];
  meta: {
    dt: number;
    /** Body radius per side (run-level). */
    radius: [number, number];
    /** Individual mass per agent. */
    mass: Float32Array<ArrayBuffer>;
  };
}

export interface FreeBattleOutput {
  summary: FreeRunSummary;
  trace?: FreeTrace;
}

const SALT_A = 3;
const SALT_B = 4;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const wrap = (a: number): number => {
  // `a % TAU` is exactly `a` when |a| < TAU, so skipping it there changes no result.
  if (a >= TAU || a <= -TAU) a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
};

/** Design-row column of each side's traits, keyed by trait id (no string building per call). */
const SIDE_COLUMNS: readonly Readonly<Record<string, number>>[] = ['a', 'b'].map((side) =>
  Object.fromEntries(
    Object.entries(FREE_PARAM_INDEX)
      .filter(([key]) => key.startsWith(`${side}.`))
      .map(([key, col]) => [key.slice(2), col]),
  ),
);

/** Individual traits drawn per agent, in draw order (`TRAITS` order, run-level ones skipped). */
const DRAWN: readonly TraitId[] = TRAITS.filter((t) => t.individual).map((t) => t.id);
const LATCH_DRAWN = new Set<TraitId>(['latchChance', 'latchEndurance', 'latchDps']);

/**
 * Simulate one free battle.
 * @param row run-level values, one design row ordered like FREE_PARAMS
 */
export function simulateFreeBattle(
  config: FreeConfig,
  row: ArrayLike<number>,
  run: number,
  trace = false,
): FreeBattleOutput {
  const C = CONSTANTS;
  const F = FREE_CONSTANTS;
  const L = config.arenaSize;
  const cv = config.individualCV;
  const nA = config.sides[0].count;
  const nB = config.sides[1].count;
  const n = nA + nB;
  const offOf = (side: number): number => (side === 0 ? 0 : nA);
  const cntOf = (side: number): number => (side === 0 ? nA : nB);
  const spA = FREE_SPECIES[config.sides[0].species];
  const spB = FREE_SPECIES[config.sides[1].species];
  const rngs = [
    new Rng(deriveSeed(config.seed, run, SALT_A)),
    new Rng(deriveSeed(config.seed, run, SALT_B)),
  ];
  const val = (s: number, id: string): number =>
    row[(SIDE_COLUMNS[s] as Readonly<Record<string, number>>)[id] as number] as number;
  const glob = (id: GlobalId): number => row[FREE_PARAM_INDEX[`g.${id}`] as number] as number;

  // Run-level per side.
  const radius = [val(0, 'bodyRadius'), val(1, 'bodyRadius')];
  const lethality = [val(0, 'strikeLethality'), val(1, 'strikeLethality')];
  const bleedBy = [val(0, 'bleed'), val(1, 'bleed')];
  const hide = [spA.constants.hide, spB.constants.hide];
  const intim = [spA.constants.intimidation, spB.constants.intimidation];
  const canLatch = [spA.canLatch, spB.canLatch];
  const latchRatio = glob('latchRatio');
  const knockRatio = glob('knockRatio');
  const woundRef = glob('woundRef');
  const interference = glob('interference');

  // Pack buff (design §5): per side, only for a social species with at least one switch on.
  const sw = config.packBuff;
  const anySwitch = sw.coordinate || sw.focus || sw.groupLatch || sw.morale || sw.relief;
  const social = [spA.social && anySwitch, spB.social && anySwitch];
  const buffLayer = (social[0] as boolean) || (social[1] as boolean);
  const cohesion = [val(0, 'cohesionRadius'), val(1, 'cohesionRadius')];
  const groupGain = [val(0, 'groupLatchGain'), val(1, 'groupLatchGain')];
  const focusBonus = [val(0, 'focusBonus'), val(1, 'focusBonus')];
  const supportK = [val(0, 'moraleSupport'), val(1, 'moraleSupport')];
  const routShock = [val(0, 'routShock'), val(1, 'routShock')];
  const reliefStamina = [val(0, 'reliefStamina'), val(1, 'reliefStamina')];
  const buffGrace = glob('buffGrace');
  const moraleBuff = sw.morale && config.morale;
  const stats = [emptyBuffStats(), emptyBuffStats()] as const;
  const buffTicks = [0, 0];
  const activeTicks = [0, 0];
  const anyTicks = [0, 0];

  // Agent state (SoA), global index i: side A first.
  const side = new Uint8Array(n);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const h = new Float64Array(n);
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  const nh = new Float64Array(n);
  const hp = new Float64Array(n);
  const maxHp = new Float64Array(n);
  const mass = new Float64Array(n);
  const turn = new Float64Array(n);
  const sprint = new Float64Array(n);
  const cruise = new Float64Array(n);
  const sprintEnd = new Float64Array(n);
  const recovery = new Float64Array(n);
  const hitDmg = new Float64Array(n);
  const interval = new Float64Array(n);
  const reach = new Float64Array(n);
  const arc = new Float64Array(n);
  const acc = new Float64Array(n);
  const latchChance = new Float64Array(n);
  const latchEnd = new Float64Array(n);
  const latchDps = new Float64Array(n);
  const shake = new Float64Array(n);
  const morale = new Float64Array(n);
  const stamina = new Float64Array(n).fill(1);
  const state = new Uint8Array(n);
  const nstate = new Uint8Array(n);
  const target = new Int32Array(n).fill(-1);
  const host = new Int32Array(n).fill(-1);
  const retarget = new Float64Array(n);
  const cd = new Float64Array(n);
  const latchCd = new Float64Array(n);
  const latchAng = new Float64Array(n);
  const recTimer = new Float64Array(n);
  const wound = new Float64Array(n);
  const dmgAcc = new Float64Array(n);
  const woundAcc = new Float64Array(n);
  const moraleAcc = new Float64Array(n);
  const knock = new Float64Array(n);
  const thrown = new Uint8Array(n);
  const carry = new Float64Array(n);
  const engaged = new Int32Array(n);
  const moraleLoss = new Float64Array(n);
  // Pack-buff state. `buffed` is fixed for the whole tick (computed before phase 1).
  const buffed = new Uint8Array(n);
  const cohesive = new Uint8Array(n);
  const graceLeft = new Float64Array(n);
  const support = new Float64Array(n);
  const crowdable = new Uint8Array(n).fill(1);
  const buffEngaged = new Int32Array(n);
  const buffRiders = new Int32Array(n);
  const slotN = new Int32Array(n);
  const slot = new Int32Array(n);
  const slotTarget = new Int32Array(n).fill(-1);
  const restraint = new Float64Array(n).fill(1);
  const reliefTarget = new Int32Array(n).fill(-1);
  const wasBuffed = new Uint8Array(n);
  const routedNow = new Uint8Array(n);
  const engagedBySide = [0, 0];

  // --- spawn ---
  const sep = Math.min(200, 0.4 * L);
  for (let s = 0; s < 2; s++) {
    const rng = rngs[s] as Rng;
    const cx = s === 0 ? L / 2 - sep / 2 : L / 2 + sep / 2;
    const dir = s === 0 ? 1 : -1;
    const discR = Math.min(0.2 * L, Math.max(3, 3 * (radius[s] as number)) * Math.sqrt(cntOf(s)));
    const drawn: Partial<Record<TraitId, number>> = {};
    for (let k = 0; k < cntOf(s); k++) {
      const i = offOf(s) + k;
      side[i] = s;
      for (const id of DRAWN) {
        if (!canLatch[s] && LATCH_DRAWN.has(id)) {
          drawn[id] = val(s, id);
          continue;
        }
        const b = TRAIT_BOUNDS[id];
        const v = val(s, id) * individualFactor(rng, cv);
        drawn[id] = Math.min(b[1], Math.max(b[0], v));
      }
      const t = drawn as Record<TraitId, number>;
      mass[i] = t.mass;
      hp[i] = maxHp[i] = t.mass;
      turn[i] = t.turnRate * DEG;
      sprint[i] = t.sprintSpeed;
      cruise[i] = Math.min(t.sprintSpeed, t.cruiseSpeed);
      sprintEnd[i] = t.sprintEndurance;
      recovery[i] = t.recoveryTime;
      hitDmg[i] = t.strikeForce * (lethality[s] as number);
      interval[i] = t.strikeInterval;
      reach[i] = t.strikeReach;
      arc[i] = t.strikeArc * DEG;
      acc[i] = t.strikeAccuracy;
      latchChance[i] = t.latchChance;
      latchEnd[i] = t.latchEndurance;
      latchDps[i] = t.latchDps;
      shake[i] = t.shakeRate;
      morale[i] = t.morale;
      moraleLoss[i] = t.moraleLoss;
      const a = rng.next() * TAU;
      const d = discR * Math.sqrt(rng.next());
      x[i] = cx + dir * Math.cos(a) * d;
      y[i] = L / 2 + Math.sin(a) * d;
      h[i] = s === 0 ? 0 : Math.PI;
      cd[i] = rng.next() * t.strikeInterval;
      retarget[i] = rng.next() * F.retarget;
    }
  }

  // --- spatial index, one grid per side over local indices ---
  const xs = [x.subarray(0, nA), x.subarray(nA)];
  const ys = [y.subarray(0, nA), y.subarray(nA)];
  const grids = [new SpatialGrid(L, nA), new SpatialGrid(L, nB)];
  const present = [
    (k: number): boolean => (state[k] as number) < FreeState.Dead,
    (k: number): boolean => (state[nA + k] as number) < FreeState.Dead,
  ];
  const active = [
    (k: number): boolean => (state[k] as number) < FreeState.Routed,
    (k: number): boolean => (state[nA + k] as number) < FreeState.Routed,
  ];
  const nearestEnemy = (i: number): number => {
    const e = 1 - (side[i] as number);
    const k = (grids[e] as SpatialGrid).nearest(
      x[i] as number,
      y[i] as number,
      xs[e] as Float64Array,
      ys[e] as Float64Array,
      active[e] as (k: number) => boolean,
    );
    return k < 0 ? -1 : offOf(e) + k;
  };

  // Pack-buff neighbour counts (capped, design §7).
  let self = -1;
  let selfOff = 0;
  const allyFilters = [
    (k: number): boolean => k !== self && (state[k] as number) < FreeState.Routed,
    (k: number): boolean => nA + k !== self && (state[nA + k] as number) < FreeState.Routed,
  ];
  const buffedAllyFilters = [
    (k: number): boolean =>
      k !== self && buffed[k] === 1 && (state[k] as number) < FreeState.Routed,
    (k: number): boolean =>
      nA + k !== self && buffed[nA + k] === 1 && (state[nA + k] as number) < FreeState.Routed,
  ];
  const fresh = (j: number): boolean =>
    buffed[j] === 1 &&
    state[j] === FreeState.Approach &&
    nstate[j] === FreeState.Approach &&
    (stamina[j] as number) >= C.resumeStamina;
  const reliefFilters = [(k: number): boolean => fresh(k), (k: number): boolean => fresh(nA + k)];
  // Scratch doubles shared with the search callbacks. Kept in a typed array, not in closure
  // variables, so assigning a new double value does not allocate a boxed number (GC, §7).
  const scratch = new Float64Array(6);
  const FOCUS_SCORE = 2;
  const FOCUS_BONUS = 3;
  const ENEMY_R = 4;
  const BEST_SCORE = 5;
  // E4b contagion: morale loss for buffed allies near a fallen or routed agent. Sources are
  // counted into a coarse grid of cell size R per side; an ally sums the 3×3 cells around its
  // own, which holds every source within R (and some up to about 2R). O(n) per tick with
  // sources, instead of one neighbourhood query per source (design §7).
  const fieldCols = (r: number): number =>
    Math.max(1, Math.min(256, Math.ceil(L / Math.max(r, 1))));
  const makeField = (r: number) => {
    const cols = fieldCols(r);
    return { cols, size: L / cols, counts: new Int32Array(cols * cols) };
  };
  const deathFields = [makeField(C.moraleRadius), makeField(C.moraleRadius)];
  const routFields = [makeField(cohesion[0] as number), makeField(cohesion[1] as number)];
  // Active agents per coarse cell of size R_coh, rebuilt on refresh ticks: an empty 3×3 block
  // around an agent proves there is no ally within R_coh (exact reject, design §7).
  const cohFields = [makeField(cohesion[0] as number), makeField(cohesion[1] as number)];
  const fillCohesion = (s: number): void => {
    const f = cohFields[s] as (typeof cohFields)[0];
    f.counts.fill(0);
    const off = offOf(s);
    for (let k = 0; k < cntOf(s); k++) {
      const i = off + k;
      if ((state[i] as number) >= FreeState.Routed) continue;
      const c = cellOf(y[i] as number, f) * f.cols + cellOf(x[i] as number, f);
      f.counts[c] = (f.counts[c] as number) + 1;
    }
  };
  const blockCount = (i: number, f: (typeof cohFields)[0]): number => {
    const cx = cellOf(x[i] as number, f);
    const cy = cellOf(y[i] as number, f);
    let m = 0;
    for (let row = Math.max(0, cy - 1); row <= Math.min(f.cols - 1, cy + 1); row++) {
      for (let col = Math.max(0, cx - 1); col <= Math.min(f.cols - 1, cx + 1); col++) {
        m += f.counts[row * f.cols + col] as number;
      }
    }
    return m;
  };
  const cellOf = (v: number, f: { cols: number; size: number }): number => {
    const c = Math.floor(v / f.size);
    return c < 0 ? 0 : c >= f.cols ? f.cols - 1 : c;
  };
  /**
   * Apply one kind of contagion for side `s`: `isSource(i)` marks this tick's fallen or routed
   * agents; each present buffed ally loses `loss(j)` per source in its neighbourhood.
   */
  const contagion = (
    s: number,
    f: { cols: number; size: number; counts: Int32Array },
    isSource: (i: number) => boolean,
    loss: (j: number) => number,
    cap: number,
  ): void => {
    const off = offOf(s);
    const cnt = cntOf(s);
    let any = false;
    for (let k = 0; k < cnt; k++) {
      const i = off + k;
      if (!isSource(i)) continue;
      if (!any) {
        f.counts.fill(0);
        any = true;
      }
      const c = cellOf(y[i] as number, f) * f.cols + cellOf(x[i] as number, f);
      f.counts[c] = (f.counts[c] as number) + 1;
    }
    if (!any) return;
    const st = stats[s as 0 | 1];
    for (let k = 0; k < cnt; k++) {
      const j = off + k;
      if (!buffed[j] || (state[j] as number) >= FreeState.Dead || nstate[j] === FreeState.Dead) {
        continue;
      }
      const cx = cellOf(x[j] as number, f);
      const cy = cellOf(y[j] as number, f);
      let m = 0;
      for (let row = Math.max(0, cy - 1); row <= Math.min(f.cols - 1, cy + 1); row++) {
        for (let col = Math.max(0, cx - 1); col <= Math.min(f.cols - 1, cx + 1); col++) {
          m += f.counts[row * f.cols + col] as number;
        }
      }
      if (isSource(j)) m -= 1;
      if (m <= 0) continue;
      if (m > cap) m = cap;
      morale[j] = (morale[j] as number) - loss(j) * m;
      st.contagion += m;
    }
  };
  const newlyDead = (i: number): boolean =>
    nstate[i] === FreeState.Dead && state[i] !== FreeState.Dead;
  const isRoutedNow = (i: number): boolean => routedNow[i] === 1;
  const ownLoss = (j: number): number => moraleLoss[j] as number;
  const countAllies = (i: number, r: number, cap: number, onlyBuffed: boolean): number => {
    const s = side[i] as number;
    self = i;
    const filters = onlyBuffed ? buffedAllyFilters : allyFilters;
    return (grids[s] as SpatialGrid).countWithin(
      x[i] as number,
      y[i] as number,
      r,
      xs[s] as Float64Array,
      ys[s] as Float64Array,
      filters[s] as (k: number) => boolean,
      cap,
    );
  };
  const countEnemies = (i: number, r: number, cap: number): number => {
    const e = 1 - (side[i] as number);
    return (grids[e] as SpatialGrid).countWithin(
      x[i] as number,
      y[i] as number,
      r,
      xs[e] as Float64Array,
      ys[e] as Float64Array,
      active[e] as (k: number) => boolean,
      cap,
    );
  };

  // E2 shared target: score = distance − focusBonus × buffed allies already engaged on it.
  let focusBest = -1;
  let focusFrom = 0;
  const focusVisit = (k: number): void => {
    const j = selfOff + k;
    if ((state[j] as number) >= FreeState.Routed) return;
    const dx = (x[j] as number) - (x[focusFrom] as number);
    const dy = (y[j] as number) - (y[focusFrom] as number);
    const score =
      Math.sqrt(dx * dx + dy * dy) - (scratch[FOCUS_BONUS] as number) * (buffEngaged[j] as number);
    if (score < (scratch[FOCUS_SCORE] as number)) {
      scratch[FOCUS_SCORE] = score;
      focusBest = j;
    }
  };
  const focusTarget = (i: number): number => {
    const near = nearestEnemy(i);
    if (near < 0) return near;
    const s = side[i] as number;
    // With no buffed ally engaged anywhere every score is a plain distance: the nearest wins.
    if (engagedBySide[s] === 0 || (focusBonus[s] as number) <= 0) return near;
    const e = 1 - s;
    const d0 = Math.hypot(
      (x[near] as number) - (x[i] as number),
      (y[near] as number) - (y[i] as number),
    );
    focusFrom = i;
    selfOff = offOf(e);
    scratch[FOCUS_BONUS] = focusBonus[s] as number;
    focusBest = -1;
    scratch[FOCUS_SCORE] = Infinity;
    // Only enemies within d0 + focusBonus can beat the nearest one.
    (grids[e] as SpatialGrid).query(
      x[i] as number,
      y[i] as number,
      d0 + scratch[FOCUS_BONUS],
      focusVisit,
    );
    const nearScore = d0 - scratch[FOCUS_BONUS] * (buffEngaged[near] as number);
    const pick = focusBest >= 0 && scratch[FOCUS_SCORE] < nearScore ? focusBest : near;
    if (pick !== near) (stats[s] as BuffStats).focus += 1;
    return pick;
  };

  // Strike target search (phase 2).
  let striker = 0;
  let enemyOff = 0;
  let best: number;
  const strikeVisit = (k: number): void => {
    const j = enemyOff + k;
    if ((state[j] as number) >= FreeState.Dead) return;
    const dx = (x[j] as number) - (x[striker] as number);
    const dy = (y[j] as number) - (y[striker] as number);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > (reach[striker] as number) + (scratch[ENEMY_R] as number)) return;
    if (Math.abs(wrap(Math.atan2(dy, dx) - (h[striker] as number))) > (arc[striker] as number))
      return;
    const score = state[j] === FreeState.Latched && host[j] === striker ? d - 1000 : d;
    if (score < (scratch[BEST_SCORE] as number)) {
      scratch[BEST_SCORE] = score;
      best = j;
    }
  };

  /**
   * Crowding penalty (design §5.6) on agent `i` acting on `t`: `k` crowdable agents engaged on
   * the same target obstruct each other. A coordinated (E1) buffed agent is exempt and not counted.
   */
  const crowd = (i: number, t: number): number => {
    if (!crowdable[i]) return 1;
    const k = engaged[t] as number;
    return k >= 2 ? 1 / (1 + interference * (k - 1)) : 1;
  };

  /** Turn toward `angle` (rate-limited) and advance up to `step` m along the new heading. */
  const steer = (i: number, angle: number, step: number): void => {
    const dh = wrap(angle - (h[i] as number));
    const maxTurn = (turn[i] as number) * (restraint[i] as number) * DT;
    const head = wrap((h[i] as number) + Math.max(-maxTurn, Math.min(maxTurn, dh)));
    nh[i] = head;
    if (step <= 0) return;
    const v = step * (Math.abs(dh) > Math.PI / 3 ? 0.5 : 1);
    nx[i] = (x[i] as number) + Math.cos(head) * v;
    ny[i] = (y[i] as number) + Math.sin(head) * v;
  };

  // --- trace ---
  const maxSteps = Math.round(config.maxTime / DT);
  let traceEvery: number = C.traceMinEvery;
  const maxFrames = Math.max(2, Math.floor(C.traceFloatBudget / (FREE_FRAME_STRIDE * n)));
  let frames: FreeTraceFrame[] = [];
  const record = (t: number): void => {
    const f = new Float32Array(n * FREE_FRAME_STRIDE);
    for (let i = 0; i < n; i++) {
      const o = i * FREE_FRAME_STRIDE;
      f[o] = x[i] as number;
      f[o + 1] = y[i] as number;
      f[o + 2] = h[i] as number;
      f[o + 3] =
        (state[i] as number) === FreeState.Dead ? 0 : (hp[i] as number) / (maxHp[i] as number);
      f[o + 4] = state[i] as number;
    }
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = buffed[i] && (state[i] as number) < FreeState.Routed ? 1 : 0;
    frames.push({ t, agents: f, buffed: b });
  };

  const killed = [0, 0];
  let outcome: FreeOutcomeCode = FreeOutcome.Draw;
  let step = 0;
  if (trace) record(0);

  for (; step < maxSteps; step++) {
    // Spatial index and per-target counts from the snapshot.
    (grids[0] as SpatialGrid).rebuild(
      nA,
      xs[0] as Float64Array,
      ys[0] as Float64Array,
      present[0] as (k: number) => boolean,
    );
    (grids[1] as SpatialGrid).rebuild(
      nB,
      xs[1] as Float64Array,
      ys[1] as Float64Array,
      present[1] as (k: number) => boolean,
    );
    // Pack-buff status (design §5.1, §5.4), fixed for the whole tick. Two passes, so no agent
    // reads another's status from this tick before it is final. Draws no random numbers.
    if (buffLayer) {
      const R = F.buffRefreshTicks;
      for (let s = 0; s < 2; s++) if (social[s]) fillCohesion(s);
      for (let i = 0; i < n; i++) {
        const s = side[i] as number;
        if (!social[s]) continue;
        if ((state[i] as number) >= FreeState.Routed) {
          buffed[i] = 0;
          cohesive[i] = 0;
          graceLeft[i] = 0;
          continue;
        }
        if (step === 0 || (i + step) % R === 0) {
          self = i;
          const c =
            blockCount(i, cohFields[s] as (typeof cohFields)[0]) > 1 &&
            (grids[s] as SpatialGrid).hasWithin(
              x[i] as number,
              y[i] as number,
              cohesion[s] as number,
              xs[s] as Float64Array,
              ys[s] as Float64Array,
              allyFilters[s] as (k: number) => boolean,
            );
          cohesive[i] = c ? 1 : 0;
          if (c) graceLeft[i] = buffGrace;
          else if (step > 0) graceLeft[i] = (graceLeft[i] as number) - R * DT;
        }
        buffed[i] = cohesive[i] || (graceLeft[i] as number) > 0 ? 1 : 0;
      }
      for (let i = 0; i < n; i++) {
        const s = side[i] as number;
        if (!social[s]) continue;
        const st = stats[s as 0 | 1];
        if (buffed[i] && !wasBuffed[i]) st.activations += 1;
        wasBuffed[i] = buffed[i] as number;
        crowdable[i] = buffed[i] && sw.coordinate ? 0 : 1;
        if (!buffed[i] || !moraleBuff) {
          support[i] = 0;
        } else if (step === 0 || (i + step) % F.supportRefreshTicks === 0) {
          const cap = F.supportCountCap;
          const a = countAllies(i, C.moraleRadius, cap, true);
          const e = countEnemies(i, C.moraleRadius, cap);
          const c = (supportK[s] as number) * Math.log((a + 1) / (e + 1));
          support[i] = Math.max(-F.supportCap, Math.min(F.supportCap, c));
          if (support[i] !== 0) st.support += 1;
        }
      }
      buffEngaged.fill(0);
      buffRiders.fill(0);
      slotN.fill(0);
      engagedBySide[0] = 0;
      engagedBySide[1] = 0;
    }

    carry.fill(0);
    engaged.fill(0);
    for (let i = 0; i < n; i++) {
      const st = state[i] as number;
      if (st === FreeState.Latched) {
        const hst = host[i] as number;
        carry[hst] = (carry[hst] as number) + (mass[i] as number);
        if (crowdable[i]) engaged[hst] = (engaged[hst] as number) + 1;
        if (buffed[i]) {
          buffEngaged[hst] = (buffEngaged[hst] as number) + 1;
          buffRiders[hst] = (buffRiders[hst] as number) + 1;
          engagedBySide[side[i] as number] = (engagedBySide[side[i] as number] as number) + 1;
        }
      } else if (st === FreeState.Approach) {
        const t = target[i] as number;
        slotTarget[i] = -1;
        if (t < 0) continue;
        // E1 only against a target that could knock the attacker back: encircling pays against
        // larger prey, not against an agile animal of similar size (design §5.2).
        if (buffed[i] && sw.coordinate && (mass[t] as number) >= knockRatio * (mass[i] as number)) {
          slot[i] = slotN[t] as number;
          slotN[t] = (slotN[t] as number) + 1;
          slotTarget[i] = t;
        }
        const dx = (x[t] as number) - (x[i] as number);
        const dy = (y[t] as number) - (y[i] as number);
        const r = (reach[i] as number) + (radius[side[t] as number] as number);
        if (dx * dx + dy * dy <= r * r) {
          if (crowdable[i]) engaged[t] = (engaged[t] as number) + 1;
          if (buffed[i]) {
            buffEngaged[t] = (buffEngaged[t] as number) + 1;
            engagedBySide[side[i] as number] = (engagedBySide[side[i] as number] as number) + 1;
          }
        }
      }
    }
    // E3 restraint: buffed riders slow their host's turning.
    if (buffLayer && sw.groupLatch) {
      for (let i = 0; i < n; i++) {
        const k = buffRiders[i] as number;
        if (k === 0) {
          restraint[i] = 1;
          continue;
        }
        restraint[i] = Math.max(F.restraintFloor, 1 - F.restraintPerRider * k);
        stats[(1 - (side[i] as number)) as 0 | 1].restraint += 1;
      }
    }
    nstate.set(state);
    nx.set(x);
    ny.set(y);
    nh.set(h);
    dmgAcc.fill(0);
    woundAcc.fill(0);
    moraleAcc.fill(0);
    knock.fill(0);
    thrown.fill(0);

    // --- phase 1: move ---
    for (let i = 0; i < n; i++) {
      const st = state[i] as number;
      if (st >= FreeState.Dead || st === FreeState.Latched) continue;
      const s = side[i] as number;
      if (st === FreeState.Approach) {
        retarget[i] = (retarget[i] as number) - DT;
        latchCd[i] = (latchCd[i] as number) - DT;
        let t = target[i] as number;
        if ((retarget[i] as number) <= 0 || t < 0 || (state[t] as number) >= FreeState.Routed) {
          t = target[i] = buffed[i] && sw.focus ? focusTarget(i) : nearestEnemy(i);
          retarget[i] = F.retarget;
        }
        if (t < 0) continue;
        const dx = (x[t] as number) - (x[i] as number);
        const dy = (y[t] as number) - (y[i] as number);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rT = radius[side[t] as number] as number;
        const wantsLatch =
          (canLatch[s] as boolean) &&
          (mass[t] as number) >= latchRatio * (mass[i] as number) &&
          state[t] !== FreeState.Latched;
        const stop = wantsLatch
          ? (radius[s] as number) + rT + F.contactMargin
          : F.strikeStop * (reach[i] as number) + rT;
        // E1 coordinated approach: a slot around the target's rear, sidestepping its strike cone.
        let heading = Math.atan2(dy, dx);
        let gap = dist - stop;
        if (slotTarget[i] === t && buffed[i]) {
          const m = slotN[t] as number;
          const spread = Math.min(TAU / m, C.flankOffset);
          const ang = (h[t] as number) + Math.PI + ((slot[i] as number) - (m - 1) / 2) * spread;
          const ax = (x[t] as number) + Math.cos(ang) * stop - (x[i] as number);
          const ay = (y[t] as number) + Math.sin(ang) * stop - (y[i] as number);
          const near = dist < (reach[t] as number) + C.dangerMargin;
          const rel = near ? wrap(Math.atan2(-dy, -dx) - (h[t] as number)) : 0;
          const danger = near && Math.abs(rel) < (arc[t] as number) + C.dangerArcPad;
          gap = Math.sqrt(ax * ax + ay * ay);
          if (danger) {
            heading = (h[t] as number) + (rel >= 0 ? 1 : -1) * (Math.PI / 2);
            gap = Math.max(gap, (sprint[i] as number) * DT);
          } else if (gap > F.contactMargin) {
            heading = Math.atan2(ay, ax);
          } else {
            gap = 0;
          }
          if (gap > 0) stats[s as 0 | 1].coordinate += 1;
        }
        if (gap <= 0) {
          steer(i, Math.atan2(dy, dx), 0);
          continue;
        }
        let speed: number;
        if (dist > C.sprintTriggerDistance) {
          speed = cruise[i] as number;
          stamina[i] = Math.min(
            1,
            (stamina[i] as number) + (DT / (recovery[i] as number)) * C.cruiseRegenFactor,
          );
        } else {
          speed = sprint[i] as number;
          stamina[i] = (stamina[i] as number) - DT / (sprintEnd[i] as number);
        }
        const carryF = Math.max(
          C.minCarrySpeedFactor,
          1 - (carry[i] as number) / (mass[i] as number),
        );
        steer(i, heading, Math.min(speed * carryF * DT, gap));
        if ((stamina[i] as number) <= 0) {
          nstate[i] = FreeState.Recover;
          recTimer[i] = 0;
        }
      } else if (st === FreeState.Recover) {
        stamina[i] = Math.min(1, (stamina[i] as number) + DT / (recovery[i] as number));
        const e = nearestEnemy(i);
        if (e >= 0) {
          const dx = (x[i] as number) - (x[e] as number);
          const dy = (y[i] as number) - (y[e] as number);
          if (dx * dx + dy * dy < C.recoverDistance * C.recoverDistance) {
            steer(i, Math.atan2(dy, dx), (cruise[i] as number) * DT);
          }
        }
        recTimer[i] = (recTimer[i] as number) - DT;
        if ((stamina[i] as number) >= C.resumeStamina && (recTimer[i] as number) <= 0) {
          nstate[i] = FreeState.Approach;
          target[i] = -1;
        }
      } else {
        // Routed: flee from the nearest active enemy, sprinting while stamina lasts.
        const e = nearestEnemy(i);
        const away =
          e >= 0
            ? Math.atan2((y[i] as number) - (y[e] as number), (x[i] as number) - (x[e] as number))
            : Math.atan2((y[i] as number) - L / 2, (x[i] as number) - L / 2);
        let speed = cruise[i] as number;
        if ((stamina[i] as number) > 0) {
          speed = sprint[i] as number;
          stamina[i] = (stamina[i] as number) - DT / (sprintEnd[i] as number);
        }
        steer(i, away, speed * DT);
        const px = nx[i] as number;
        const py = ny[i] as number;
        if (px < 0 || py < 0 || px > L || py > L) nstate[i] = FreeState.Left;
        continue;
      }
      nx[i] = Math.min(L, Math.max(0, nx[i] as number));
      ny[i] = Math.min(L, Math.max(0, ny[i] as number));
    }
    x.set(nx);
    y.set(ny);
    h.set(nh);
    for (let i = 0; i < n; i++) {
      if (state[i] !== FreeState.Latched) continue;
      const hst = host[i] as number;
      const a = (h[hst] as number) + (latchAng[i] as number);
      const r = (radius[side[hst] as number] as number) + (radius[side[i] as number] as number);
      x[i] = (x[hst] as number) + Math.cos(a) * r;
      y[i] = (y[hst] as number) + Math.sin(a) * r;
    }

    // --- phase 2: act ---
    for (let i = 0; i < n; i++) {
      const st = state[i] as number;
      const s = side[i] as number;
      const rng = rngs[s] as Rng;
      if (st === FreeState.Approach && nstate[i] === FreeState.Approach) {
        const e = 1 - s;
        cd[i] = (cd[i] as number) - DT;
        if ((cd[i] as number) <= 0) {
          striker = i;
          enemyOff = offOf(e);
          scratch[ENEMY_R] = radius[e] as number;
          best = -1;
          scratch[BEST_SCORE] = Infinity;
          (grids[e] as SpatialGrid).query(
            x[i] as number,
            y[i] as number,
            (reach[i] as number) + scratch[ENEMY_R],
            strikeVisit,
          );
          if (best >= 0) {
            const j = best;
            cd[i] = interval[i] as number;
            let p = acc[i] as number;
            if (state[j] === FreeState.Latched)
              p = Math.min(C.maxAccuracy, p * C.latchedAccuracyBonus);
            p *= crowd(i, j);
            if (rng.next() < p) {
              const dmg = (hitDmg[i] as number) * (C.biteDamageMin + C.biteDamageSpan * rng.next());
              dmgAcc[j] = (dmgAcc[j] as number) + dmg;
              woundAcc[j] = (woundAcc[j] as number) + dmg;
              const frac = Math.min(1, dmg / (woundRef * (maxHp[j] as number)));
              moraleAcc[j] =
                (moraleAcc[j] as number) - C.woundMoraleLoss * (intim[s] as number) * frac;
              if ((mass[i] as number) >= knockRatio * (mass[j] as number)) {
                knock[j] = Math.max(knock[j] as number, C.recoverMinTime * (intim[s] as number));
              }
            }
          }
        }
        // Latch attempt: only species that can grab, onto a much heavier target (design §4.2).
        const t = target[i] as number;
        if (
          canLatch[s] &&
          t >= 0 &&
          (state[t] as number) < FreeState.Routed &&
          state[t] !== FreeState.Latched &&
          (latchCd[i] as number) <= 0 &&
          (mass[t] as number) >= latchRatio * (mass[i] as number)
        ) {
          const dx = (x[i] as number) - (x[t] as number);
          const dy = (y[i] as number) - (y[t] as number);
          const contact = (radius[s] as number) + (radius[e] as number) + F.contactMargin;
          if (dx * dx + dy * dy <= contact * contact) {
            let p = latchChance[i] as number;
            // E3 group latching: each buffed rider already on the target raises the chance.
            const k = buffRiders[t] as number;
            if (k > 0 && buffed[i] && sw.groupLatch) {
              p = Math.min(F.groupLatchCap * p, p * (1 + (groupGain[s] as number) * k));
              stats[s as 0 | 1].groupLatch += 1;
            }
            if (rng.next() < p * crowd(i, t)) {
              nstate[i] = FreeState.Latched;
              host[i] = t;
              latchAng[i] = wrap(Math.atan2(dy, dx) - (h[t] as number));
            } else {
              latchCd[i] = C.latchRetry;
            }
          }
        }
      } else if (st === FreeState.Latched) {
        const hst = host[i] as number;
        const dmg = (latchDps[i] as number) * DT * (hide[side[hst] as number] as number);
        dmgAcc[hst] = (dmgAcc[hst] as number) + dmg;
        woundAcc[hst] = (woundAcc[hst] as number) + dmg;
        stamina[i] = (stamina[i] as number) - DT / (latchEnd[i] as number);
        if (rng.next() < (shake[hst] as number) * DT) thrown[i] = 1;
        else if ((stamina[i] as number) <= 0) {
          nstate[i] = FreeState.Recover;
          recTimer[i] = 0;
        } else if (
          buffed[i] &&
          sw.relief &&
          (i + step) % F.buffRefreshTicks === 0 &&
          (stamina[i] as number) < (reliefStamina[s] as number)
        ) {
          // E5 relief (checked on the agent's refresh ticks): hand the target to a fresh buffed
          // ally within cohesion range.
          const k = (grids[s] as SpatialGrid).firstWithin(
            x[i] as number,
            y[i] as number,
            cohesion[s] as number,
            xs[s] as Float64Array,
            ys[s] as Float64Array,
            reliefFilters[s] as (k: number) => boolean,
            F.reliefMaxVisits,
          );
          if (k >= 0) {
            nstate[i] = FreeState.Recover;
            recTimer[i] = 0;
            reliefTarget[offOf(s) + k] = hst;
            stats[s as 0 | 1].relief += 1;
          }
        }
      }
    }

    // --- phase 3: apply ---
    for (let i = 0; i < n; i++) {
      if ((state[i] as number) >= FreeState.Dead) continue;
      const s = side[i] as number;
      if (thrown[i]) {
        const hst = host[i] as number;
        dmgAcc[i] = (dmgAcc[i] as number) + C.throwDamageFrac * (maxHp[i] as number);
        moraleAcc[i] =
          (moraleAcc[i] as number) - C.throwMoraleLoss * (intim[side[hst] as number] as number);
      }
      hp[i] = (hp[i] as number) - (dmgAcc[i] as number);
      wound[i] = (wound[i] as number) + (woundAcc[i] as number);
      const bleed = bleedBy[1 - s] as number;
      if (bleed > 0) hp[i] = (hp[i] as number) - (wound[i] as number) * bleed * DT;
      morale[i] = (morale[i] as number) + (moraleAcc[i] as number);
    }
    for (let i = 0; i < n; i++) {
      if ((state[i] as number) >= FreeState.Dead || (hp[i] as number) > 0) continue;
      nstate[i] = FreeState.Dead;
      hp[i] = 0;
      host[i] = -1;
      const ks = side[i] as number;
      killed[ks] = (killed[ks] as number) + 1;
    }
    if (buffLayer && moraleBuff) {
      for (let s = 0; s < 2; s++) {
        if (social[s])
          contagion(
            s,
            deathFields[s] as (typeof deathFields)[0],
            newlyDead,
            ownLoss,
            F.contagionDeathCap,
          );
      }
    }
    for (let i = 0; i < n; i++) {
      const ns = nstate[i] as number;
      if (ns >= FreeState.Dead) continue;
      if (thrown[i]) {
        const hst = host[i] as number;
        const a = (h[hst] as number) + (latchAng[i] as number);
        x[i] = (x[i] as number) + Math.cos(a) * C.throwDistance;
        y[i] = (y[i] as number) + Math.sin(a) * C.throwDistance;
        nstate[i] = FreeState.Recover;
        host[i] = -1;
        recTimer[i] = C.recoverMinTime;
      } else if (
        ns === FreeState.Latched &&
        (nstate[host[i] as number] as number) >= FreeState.Dead
      ) {
        nstate[i] = FreeState.Recover;
        host[i] = -1;
        recTimer[i] = 0;
      } else if (ns === FreeState.Recover && state[i] === FreeState.Latched) {
        host[i] = -1; // released for stamina
      }
      const kn = knock[i] as number;
      if (kn > 0 && (nstate[i] as number) < FreeState.Routed) {
        if (nstate[i] !== FreeState.Recover) recTimer[i] = 0;
        nstate[i] = FreeState.Recover;
        host[i] = -1;
        recTimer[i] = Math.max(recTimer[i] as number, kn);
      }
    }
    if (buffLayer && sw.relief) {
      for (let j = 0; j < n; j++) {
        const t = reliefTarget[j] as number;
        if (t < 0) continue;
        reliefTarget[j] = -1;
        if (nstate[j] === FreeState.Approach && (nstate[t] as number) < FreeState.Routed) {
          target[j] = t;
          retarget[j] = F.retarget;
        }
      }
    }
    state.set(nstate);
    if (config.morale) {
      for (let i = 0; i < n; i++) {
        // E4a: buffed agents rout on morale + support; `support` is 0 for everyone else.
        if (
          (state[i] as number) < FreeState.Routed &&
          (morale[i] as number) + (support[i] as number) < C.routThreshold
        ) {
          state[i] = FreeState.Routed;
          host[i] = -1;
          routedNow[i] = 1;
        }
      }
      // E4b rout contagion after every rout of this tick is known, so index order cannot cascade.
      if (buffLayer && moraleBuff) {
        for (let s = 0; s < 2; s++) {
          if (!social[s]) continue;
          const shockLoss = routShock[s] as number;
          contagion(
            s,
            routFields[s] as (typeof routFields)[0],
            isRoutedNow,
            () => shockLoss,
            F.contagionRoutCap,
          );
        }
      }
      routedNow.fill(0);
    }
    if (buffLayer) {
      for (let i = 0; i < n; i++) {
        const s = side[i] as number;
        if (!social[s] || (state[i] as number) >= FreeState.Routed) continue;
        activeTicks[s] = (activeTicks[s] as number) + 1;
        if (buffed[i]) buffTicks[s] = (buffTicks[s] as number) + 1;
      }
      for (let s = 0; s < 2; s++) {
        if (!social[s]) continue;
        let any = false;
        for (let k = 0; k < cntOf(s) && !any; k++) {
          const j = offOf(s) + k;
          any = buffed[j] === 1 && (state[j] as number) < FreeState.Routed;
        }
        if (any) anyTicks[s] = (anyTicks[s] as number) + 1;
      }
    }

    let activeA = 0;
    let activeB = 0;
    for (let i = 0; i < n; i++) {
      if ((state[i] as number) < FreeState.Routed) {
        if (side[i] === 0) activeA++;
        else activeB++;
      }
    }
    if (trace && (step + 1) % traceEvery === 0) {
      record((step + 1) * DT);
      if (frames.length > maxFrames) {
        frames = frames.filter((_, k) => k % 2 === 0);
        traceEvery *= 2;
      }
    }
    if (activeA === 0 || activeB === 0) {
      outcome =
        activeA === activeB ? FreeOutcome.Draw : activeA === 0 ? FreeOutcome.B : FreeOutcome.A;
      step++;
      break;
    }
  }

  if (
    trace &&
    (frames.length === 0 || (frames[frames.length - 1] as FreeTraceFrame).t < step * DT)
  ) {
    record(step * DT);
  }

  const alive = [0, 0];
  const routed = [0, 0];
  const activeN = [0, 0];
  const hpSum = [0, 0];
  const activeHp = [0, 0];
  const maxHpSum = [0, 0];
  for (let i = 0; i < n; i++) {
    const s = side[i] as number;
    const st = state[i] as number;
    maxHpSum[s] = (maxHpSum[s] as number) + (maxHp[i] as number);
    if (st === FreeState.Dead) continue;
    alive[s] = (alive[s] as number) + 1;
    hpSum[s] = (hpSum[s] as number) + (hp[i] as number);
    if (st >= FreeState.Routed) routed[s] = (routed[s] as number) + 1;
    else {
      activeN[s] = (activeN[s] as number) + 1;
      activeHp[s] = (activeHp[s] as number) + (hp[i] as number);
    }
  }
  const frac = (a: number, b: number): number => (b > 0 ? a / b : 0);
  const summary: FreeRunSummary = {
    run,
    outcome,
    duration: step * DT,
    aAlive: alive[0] as number,
    aKilled: killed[0] as number,
    aRouted: routed[0] as number,
    aActive: activeN[0] as number,
    bAlive: alive[1] as number,
    bKilled: killed[1] as number,
    bRouted: routed[1] as number,
    bActive: activeN[1] as number,
    aHpFrac: frac(hpSum[0] as number, maxHpSum[0] as number),
    bHpFrac: frac(hpSum[1] as number, maxHpSum[1] as number),
    advantage:
      frac(activeHp[0] as number, maxHpSum[0] as number) -
      frac(activeHp[1] as number, maxHpSum[1] as number),
    buffA: {
      ...stats[0],
      activeFrac: frac(buffTicks[0] as number, activeTicks[0] as number),
      anyTime: (anyTicks[0] as number) * DT,
    },
    buffB: {
      ...stats[1],
      activeFrac: frac(buffTicks[1] as number, activeTicks[1] as number),
      anyTime: (anyTicks[1] as number) * DT,
    },
  };
  if (!trace) return { summary };
  return {
    summary,
    trace: {
      version: FREE_TRACE_VERSION,
      arenaSize: L,
      counts: [nA, nB],
      frames,
      meta: {
        dt: DT,
        radius: [radius[0] as number, radius[1] as number],
        mass: Float32Array.from(mass),
      },
    },
  };
}
