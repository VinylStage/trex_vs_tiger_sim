import { individualFactor } from '../distributions';
import { CONSTANTS, DT } from '../engine';
import { Rng, deriveSeed } from '../rng';
import { SpatialGrid } from '../spatial';
import { FREE_PARAM_INDEX, type FreeConfig, type GlobalId } from './config';
import { FREE_SPECIES } from './species';
import { TRAITS, TRAIT_BOUNDS, type TraitId } from './traits';

/**
 * Symmetric battle engine of the free model, individual layer only (docs/design/FREE-MATCHUPS.md
 * §4; the pack buff of §5 is not part of this layer). The legacy engine (`src/sim/engine.ts`) is
 * frozen and never calls this module.
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
} as const;

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
}

export const FREE_TRACE_VERSION = 3;

/** Per agent: x, y, heading, hpFrac (≤ 0 dead), state. */
export const FREE_FRAME_STRIDE = 5;

export interface FreeTraceFrame {
  t: number;
  agents: Float32Array<ArrayBuffer>;
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
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
};

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
  const SIDE = ['a', 'b'] as const;
  const val = (s: number, id: string): number =>
    row[FREE_PARAM_INDEX[`${SIDE[s]}.${id}`] as number] as number;
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

  // Strike target search (phase 2).
  let striker = 0;
  let enemyOff = 0;
  let enemyR = 0;
  let best: number;
  let bestScore: number;
  const strikeVisit = (k: number): void => {
    const j = enemyOff + k;
    if ((state[j] as number) >= FreeState.Dead) return;
    const dx = (x[j] as number) - (x[striker] as number);
    const dy = (y[j] as number) - (y[striker] as number);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > (reach[striker] as number) + enemyR) return;
    if (Math.abs(wrap(Math.atan2(dy, dx) - (h[striker] as number))) > (arc[striker] as number))
      return;
    const score = state[j] === FreeState.Latched && host[j] === striker ? d - 1000 : d;
    if (score < bestScore) {
      bestScore = score;
      best = j;
    }
  };

  /** Crowding penalty on agents of one side engaged on the same target (design §5.6). */
  const crowd = (t: number): number => {
    const k = engaged[t] as number;
    return k >= 2 ? 1 / (1 + interference * (k - 1)) : 1;
  };

  /** Turn toward `angle` (rate-limited) and advance up to `step` m along the new heading. */
  const steer = (i: number, angle: number, step: number): void => {
    const dh = wrap(angle - (h[i] as number));
    const maxTurn = (turn[i] as number) * DT;
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
    frames.push({ t, agents: f });
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
    carry.fill(0);
    engaged.fill(0);
    for (let i = 0; i < n; i++) {
      const st = state[i] as number;
      if (st === FreeState.Latched) {
        const hst = host[i] as number;
        carry[hst] = (carry[hst] as number) + (mass[i] as number);
        engaged[hst] = (engaged[hst] as number) + 1;
      } else if (st === FreeState.Approach) {
        const t = target[i] as number;
        if (t < 0) continue;
        const dx = (x[t] as number) - (x[i] as number);
        const dy = (y[t] as number) - (y[i] as number);
        const r = (reach[i] as number) + (radius[side[t] as number] as number);
        if (dx * dx + dy * dy <= r * r) engaged[t] = (engaged[t] as number) + 1;
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
          t = target[i] = nearestEnemy(i);
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
        const gap = dist - stop;
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
        steer(i, Math.atan2(dy, dx), Math.min(speed * carryF * DT, gap));
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
          enemyR = radius[e] as number;
          best = -1;
          bestScore = Infinity;
          (grids[e] as SpatialGrid).query(
            x[i] as number,
            y[i] as number,
            (reach[i] as number) + enemyR,
            strikeVisit,
          );
          if (best >= 0) {
            const j = best;
            cd[i] = interval[i] as number;
            let p = acc[i] as number;
            if (state[j] === FreeState.Latched)
              p = Math.min(C.maxAccuracy, p * C.latchedAccuracyBonus);
            p *= crowd(j);
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
            if (rng.next() < (latchChance[i] as number) * crowd(t)) {
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
    state.set(nstate);
    if (config.morale) {
      for (let i = 0; i < n; i++) {
        if ((state[i] as number) < FreeState.Routed && (morale[i] as number) < C.routThreshold) {
          state[i] = FreeState.Routed;
          host[i] = -1;
        }
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
