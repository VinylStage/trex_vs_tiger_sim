import type { ScenarioConfig } from './config';
import { individualFactor } from './distributions';
import { PARAMS, PARAM_INDEX as P } from './params';
import { Rng, deriveSeed } from './rng';
import { SpatialGrid } from './spatial';

/** Fixed integration step in seconds. */
export const DT = 0.1;

/** Model constants not exposed as uncertain parameters. Documented in docs/MODEL.md. */
export const CONSTANTS = {
  tigerRadius: 0.8,
  latchRetry: 1,
  moraleRadius: 40,
  routThreshold: 0.2,
  woundMoraleLoss: 0.25,
  throwMoraleLoss: 0.1,
  throwDamageFrac: 0.1,
  throwDistance: 3,
  recoverDistance: 40,
  resumeStamina: 0.8,
  sprintTriggerDistance: 60,
  cruiseRegenFactor: 0.25,
  trexRetarget: 0.5,
  tigerRetarget: 1,
  minCarrySpeedFactor: 0.3,
  latchedAccuracyBonus: 1.5,
  maxAccuracy: 0.95,
  dangerMargin: 4,
  dangerArcPad: (20 * Math.PI) / 180,
  flankOffset: 0.6,
  biteDamageMin: 0.7,
  biteDamageSpan: 0.6,
  flankLoadPenalty: 20,
  traceFloatBudget: 6_000_000,
  traceMinEvery: 5,
} as const;

export const TigerState = {
  Approach: 0,
  Latched: 1,
  Recover: 2,
  Routed: 3,
  Dead: 4,
  Left: 5,
} as const;

export const Outcome = { Trex: 0, Tigers: 1, Draw: 2 } as const;
export type OutcomeCode = (typeof Outcome)[keyof typeof Outcome];

export interface RunSummary {
  run: number;
  outcome: OutcomeCode;
  duration: number;
  trexAlive: number;
  tigersKilled: number;
  tigersRouted: number;
  tigersActive: number;
  trexHpFrac: number;
  /** trexHpFrac − (active tigers / initial tigers), in [−1, 1]. Used for sensitivity. */
  trexAdvantage: number;
}

export interface TraceFrame {
  t: number;
  /** Per T-Rex: x, y, heading, hpFrac (hpFrac ≤ 0 → dead). */
  trex: Float32Array;
  /** Per tiger: x, y, state. */
  tiger: Float32Array;
}

export interface BattleTrace {
  arenaSize: number;
  trexCount: number;
  tigerCount: number;
  frames: TraceFrame[];
}

export interface BattleOutput {
  summary: RunSummary;
  trace?: BattleTrace;
}

const BATTLE_SALT = 2;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const wrap = (a: number): number => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
};

/**
 * Simulate one battle.
 * @param row run-level parameter values (one design row, ordered like PARAMS)
 */
export function simulateBattle(
  config: ScenarioConfig,
  row: ArrayLike<number>,
  run: number,
  trace = false,
): BattleOutput {
  const C = CONSTANTS;
  const rng = new Rng(deriveSeed(config.seed, run, BATTLE_SALT));
  const N = config.trexCount;
  const M = config.tigerCount;
  const L = config.arenaSize;
  const cv = config.individualCV;

  const indiv = (k: number): number => {
    const d = PARAMS[k] as (typeof PARAMS)[number];
    const base = row[k] as number;
    const v = d.individual ? base * individualFactor(rng, cv) : base;
    return Math.min(d.bounds[1], Math.max(d.bounds[0], v));
  };
  const runVal = (k: number): number => row[k] as number;

  // --- T-Rex state (SoA) ---
  const rx = new Float64Array(N);
  const ry = new Float64Array(N);
  const rh = new Float64Array(N);
  const rHp = new Float64Array(N);
  const rMaxHp = new Float64Array(N);
  const rMass = new Float64Array(N);
  const rSpeed = new Float64Array(N);
  const rTurn = new Float64Array(N);
  const rBiteDmg = new Float64Array(N);
  const rBiteInt = new Float64Array(N);
  const rReach = new Float64Array(N);
  const rArc = new Float64Array(N);
  const rAcc = new Float64Array(N);
  const rShake = new Float64Array(N);
  const rCd = new Float64Array(N);
  const rWound = new Float64Array(N);
  const rCarry = new Float64Array(N);
  const rLatched = new Int32Array(N);
  const rTarget = new Int32Array(N).fill(-1);
  const rTimer = new Float64Array(N);
  const rAlive = new Uint8Array(N);
  const radius = runVal(P['trex.bodyRadius']);
  const lethality = runVal(P['trex.biteLethality']);
  const bleed = runVal(P['tiger.bleed']);

  const sep = Math.min(200, 0.4 * L);
  const spacing = Math.min(15, (0.8 * L) / Math.max(1, N));
  for (let i = 0; i < N; i++) {
    rx[i] = L / 2 - sep / 2;
    ry[i] = L / 2 + (i - (N - 1) / 2) * spacing;
    rh[i] = 0;
    rMass[i] = indiv(P['trex.mass']);
    rHp[i] = rMaxHp[i] = rMass[i] as number;
    rSpeed[i] = indiv(P['trex.speed']);
    rTurn[i] = indiv(P['trex.turnRate']) * DEG;
    rBiteDmg[i] = indiv(P['trex.biteForce']) * lethality;
    rBiteInt[i] = indiv(P['trex.biteInterval']);
    rReach[i] = indiv(P['trex.biteReach']);
    rArc[i] = indiv(P['trex.biteArc']) * DEG;
    rAcc[i] = indiv(P['trex.biteAccuracy']);
    rShake[i] = indiv(P['trex.shakeRate']);
    rCd[i] = rng.next() * (rBiteInt[i] as number);
    rTimer[i] = rng.next() * C.trexRetarget;
    rAlive[i] = 1;
  }

  // --- Tiger state (SoA) ---
  const tx = new Float64Array(M);
  const ty = new Float64Array(M);
  const tHp = new Float64Array(M);
  const tMaxHp = new Float64Array(M);
  const tMass = new Float64Array(M);
  const tSprint = new Float64Array(M);
  const tCruise = new Float64Array(M);
  const tSprintEnd = new Float64Array(M);
  const tLatchEnd = new Float64Array(M);
  const tRecovery = new Float64Array(M);
  const tLatchChance = new Float64Array(M);
  const tDps = new Float64Array(M);
  const tMorale = new Float64Array(M);
  const tMoraleLoss = new Float64Array(M);
  const tStamina = new Float64Array(M);
  const tState = new Uint8Array(M);
  const tHost = new Int32Array(M).fill(-1);
  const tLatchAng = new Float64Array(M);
  const tLatchCd = new Float64Array(M);
  const tTarget = new Int32Array(M).fill(-1);
  const tTimer = new Float64Array(M);
  const tSide = new Int8Array(M);

  const discR = Math.min(0.2 * L, 3 * Math.sqrt(M));
  for (let j = 0; j < M; j++) {
    const a = rng.next() * TAU;
    const d = discR * Math.sqrt(rng.next());
    tx[j] = L / 2 + sep / 2 + Math.cos(a) * d;
    ty[j] = L / 2 + Math.sin(a) * d;
    tMass[j] = indiv(P['tiger.mass']);
    tHp[j] = tMaxHp[j] = tMass[j] as number;
    tSprint[j] = indiv(P['tiger.sprintSpeed']);
    tCruise[j] = Math.min(tSprint[j] as number, indiv(P['tiger.cruiseSpeed']));
    tSprintEnd[j] = indiv(P['tiger.sprintEndurance']);
    tLatchEnd[j] = indiv(P['tiger.latchEndurance']);
    tRecovery[j] = indiv(P['tiger.recoveryTime']);
    tLatchChance[j] = indiv(P['tiger.latchChance']);
    tDps[j] = indiv(P['tiger.dps']);
    tMorale[j] = indiv(P['tiger.morale']);
    tMoraleLoss[j] = indiv(P['tiger.moraleLoss']);
    tStamina[j] = 1;
    tState[j] = TigerState.Approach;
    tTimer[j] = rng.next() * C.tigerRetarget;
    tSide[j] = rng.next() < 0.5 ? -1 : 1;
  }

  const grid = new SpatialGrid(L, M);
  const presentFilter = (j: number): boolean => (tState[j] as number) < TigerState.Dead;
  let killed = 0;

  // Morale shock around a dead tiger.
  let shockX = 0;
  let shockY = 0;
  let shockSelf = -1;
  const shockVisit = (k: number): void => {
    if (k === shockSelf || (tState[k] as number) >= TigerState.Dead) return;
    const dx = (tx[k] as number) - shockX;
    const dy = (ty[k] as number) - shockY;
    if (dx * dx + dy * dy <= C.moraleRadius * C.moraleRadius) {
      tMorale[k] = (tMorale[k] as number) - (tMoraleLoss[k] as number);
    }
  };

  const kill = (j: number): void => {
    tState[j] = TigerState.Dead;
    tHp[j] = 0;
    tHost[j] = -1;
    killed++;
    if (config.morale) {
      shockX = tx[j] as number;
      shockY = ty[j] as number;
      shockSelf = j;
      grid.query(shockX, shockY, C.moraleRadius, shockVisit);
    }
  };

  const toRecover = (j: number, moraleLoss: number): void => {
    tState[j] = TigerState.Recover;
    tHost[j] = -1;
    tMorale[j] = (tMorale[j] as number) - moraleLoss;
  };

  // Bite target search.
  let biter = 0;
  let best: number;
  let bestScore: number;
  const biteVisit = (j: number): void => {
    const s = tState[j] as number;
    if (s >= TigerState.Dead) return;
    const dx = (tx[j] as number) - (rx[biter] as number);
    const dy = (ty[j] as number) - (ry[biter] as number);
    const d = Math.hypot(dx, dy);
    if (d > (rReach[biter] as number) + C.tigerRadius) return;
    if (Math.abs(wrap(Math.atan2(dy, dx) - (rh[biter] as number))) > (rArc[biter] as number))
      return;
    const score = s === TigerState.Latched && tHost[j] === biter ? d - 1000 : d;
    if (score < bestScore) {
      bestScore = score;
      best = j;
    }
  };

  const nearestFreeTiger = (i: number): number => {
    let bi = -1;
    let bd = Infinity;
    const x = rx[i] as number;
    const y = ry[i] as number;
    for (let j = 0; j < M; j++) {
      const s = tState[j] as number;
      if (s === TigerState.Latched || s >= TigerState.Dead) continue;
      const dx = (tx[j] as number) - x;
      const dy = (ty[j] as number) - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        bi = j;
      }
    }
    return bi;
  };

  const nearestTrex = (j: number): number => {
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (!rAlive[i]) continue;
      const dx = (rx[i] as number) - (tx[j] as number);
      const dy = (ry[i] as number) - (ty[j] as number);
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  };

  const chooseTrex = (j: number): number => {
    if (config.tigerTactic === 'direct') return nearestTrex(j);
    let bi = -1;
    let bs = Infinity;
    for (let i = 0; i < N; i++) {
      if (!rAlive[i]) continue;
      const d = Math.hypot(
        (rx[i] as number) - (tx[j] as number),
        (ry[i] as number) - (ty[j] as number),
      );
      const s = d + C.flankLoadPenalty * (rLatched[i] as number);
      if (s < bs) {
        bs = s;
        bi = i;
      }
    }
    return bi;
  };

  const moveToward = (j: number, angle: number, step: number): void => {
    tx[j] = (tx[j] as number) + Math.cos(angle) * step;
    ty[j] = (ty[j] as number) + Math.sin(angle) * step;
  };

  // --- Trace ---
  const maxSteps = Math.ceil(config.maxTime / DT);
  const traceEvery = Math.max(
    C.traceMinEvery,
    Math.ceil((maxSteps * (4 * N + 3 * M)) / C.traceFloatBudget),
  );
  const frames: TraceFrame[] = [];
  const record = (t: number): void => {
    const fr = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      fr[i * 4] = rx[i] as number;
      fr[i * 4 + 1] = ry[i] as number;
      fr[i * 4 + 2] = rh[i] as number;
      fr[i * 4 + 3] = rAlive[i] ? (rHp[i] as number) / (rMaxHp[i] as number) : 0;
    }
    const ft = new Float32Array(M * 3);
    for (let j = 0; j < M; j++) {
      ft[j * 3] = tx[j] as number;
      ft[j * 3 + 1] = ty[j] as number;
      ft[j * 3 + 2] = tState[j] as number;
    }
    frames.push({ t, trex: fr, tiger: ft });
  };

  let outcome: OutcomeCode = Outcome.Draw;
  let step = 0;
  if (trace) record(0);

  for (; step < maxSteps; step++) {
    grid.rebuild(M, tx, ty, presentFilter);
    rCarry.fill(0);
    rLatched.fill(0);
    for (let j = 0; j < M; j++) {
      if (tState[j] === TigerState.Latched) {
        const h = tHost[j] as number;
        rCarry[h] = (rCarry[h] as number) + (tMass[j] as number);
        rLatched[h] = (rLatched[h] as number) + 1;
      }
    }

    // --- T-Rex ---
    for (let i = 0; i < N; i++) {
      if (!rAlive[i]) continue;
      rTimer[i] = (rTimer[i] as number) - DT;
      const tgt = rTarget[i] as number;
      const tgtState = tgt >= 0 ? (tState[tgt] as number) : TigerState.Dead;
      if (
        (rTimer[i] as number) <= 0 ||
        tgtState === TigerState.Latched ||
        tgtState >= TigerState.Dead
      ) {
        rTarget[i] = nearestFreeTiger(i);
        rTimer[i] = C.trexRetarget;
      }
      const target = rTarget[i] as number;
      if (target >= 0) {
        const dx = (tx[target] as number) - (rx[i] as number);
        const dy = (ty[target] as number) - (ry[i] as number);
        const dh = wrap(Math.atan2(dy, dx) - (rh[i] as number));
        const maxTurn = (rTurn[i] as number) * DT;
        rh[i] = wrap((rh[i] as number) + Math.max(-maxTurn, Math.min(maxTurn, dh)));
        const dist = Math.hypot(dx, dy);
        if (dist > (rReach[i] as number) * 0.8) {
          const carry = Math.max(
            C.minCarrySpeedFactor,
            1 - (rCarry[i] as number) / (rMass[i] as number),
          );
          const turnPenalty = Math.abs(dh) > Math.PI / 3 ? 0.5 : 1;
          const v = (rSpeed[i] as number) * carry * turnPenalty * DT;
          rx[i] = Math.min(L, Math.max(0, (rx[i] as number) + Math.cos(rh[i] as number) * v));
          ry[i] = Math.min(L, Math.max(0, (ry[i] as number) + Math.sin(rh[i] as number) * v));
        }
      }

      rCd[i] = (rCd[i] as number) - DT;
      if ((rCd[i] as number) <= 0) {
        biter = i;
        best = -1;
        bestScore = Infinity;
        grid.query(
          rx[i] as number,
          ry[i] as number,
          (rReach[i] as number) + C.tigerRadius,
          biteVisit,
        );
        if (best >= 0) {
          rCd[i] = rBiteInt[i] as number;
          const latched = tState[best] === TigerState.Latched;
          const acc = latched
            ? Math.min(C.maxAccuracy, (rAcc[i] as number) * C.latchedAccuracyBonus)
            : (rAcc[i] as number);
          if (rng.next() < acc) {
            const dmg = (rBiteDmg[i] as number) * (C.biteDamageMin + C.biteDamageSpan * rng.next());
            tHp[best] = (tHp[best] as number) - dmg;
            if ((tHp[best] as number) <= 0) kill(best);
            else toRecover(best, C.woundMoraleLoss);
          }
        }
      }

      if (bleed > 0) rHp[i] = (rHp[i] as number) - (rWound[i] as number) * bleed * DT;
    }

    // --- Tigers ---
    for (let j = 0; j < M; j++) {
      const s = tState[j] as number;
      if (s >= TigerState.Dead) continue;

      if (config.morale && s !== TigerState.Routed && (tMorale[j] as number) < C.routThreshold) {
        tState[j] = TigerState.Routed;
        tHost[j] = -1;
      }

      switch (tState[j]) {
        case TigerState.Approach: {
          tLatchCd[j] = (tLatchCd[j] as number) - DT;
          tTimer[j] = (tTimer[j] as number) - DT;
          let r = tTarget[j] as number;
          if ((tTimer[j] as number) <= 0 || r < 0 || !rAlive[r]) {
            r = tTarget[j] = chooseTrex(j);
            tTimer[j] = C.tigerRetarget;
          }
          if (r < 0) break;
          const dx = (rx[r] as number) - (tx[j] as number);
          const dy = (ry[r] as number) - (ty[j] as number);
          const dist = Math.hypot(dx, dy);
          const contact = radius + C.tigerRadius + 0.5;
          const rel = wrap(Math.atan2(-dy, -dx) - (rh[r] as number));

          let aimX = rx[r] as number;
          let aimY = ry[r] as number;
          let heading: number;
          if (config.tigerTactic === 'flank') {
            const back = (rh[r] as number) + Math.PI + (tSide[j] as number) * C.flankOffset;
            aimX += Math.cos(back) * radius;
            aimY += Math.sin(back) * radius;
            const danger =
              dist < (rReach[r] as number) + C.dangerMargin &&
              Math.abs(rel) < (rArc[r] as number) + C.dangerArcPad;
            heading = danger
              ? (rh[r] as number) + (rel >= 0 ? 1 : -1) * (Math.PI / 2)
              : Math.atan2(aimY - (ty[j] as number), aimX - (tx[j] as number));
          } else {
            heading = Math.atan2(dy, dx);
          }

          let speed: number;
          if (dist > C.sprintTriggerDistance) {
            speed = tCruise[j] as number;
            tStamina[j] = Math.min(
              1,
              (tStamina[j] as number) + (DT / (tRecovery[j] as number)) * C.cruiseRegenFactor,
            );
          } else {
            speed = tSprint[j] as number;
            tStamina[j] = (tStamina[j] as number) - DT / (tSprintEnd[j] as number);
          }
          let stepLen = speed * DT;
          if (config.tigerTactic === 'direct')
            stepLen = Math.min(stepLen, Math.max(0, dist - contact));
          else {
            const aimDist = Math.hypot(aimX - (tx[j] as number), aimY - (ty[j] as number));
            stepLen = Math.min(stepLen, aimDist);
          }
          moveToward(j, heading, stepLen);

          if ((tStamina[j] as number) <= 0) {
            toRecover(j, 0);
            break;
          }
          const nd = Math.hypot(
            (rx[r] as number) - (tx[j] as number),
            (ry[r] as number) - (ty[j] as number),
          );
          if (nd <= contact && (tLatchCd[j] as number) <= 0) {
            if (rng.next() < (tLatchChance[j] as number)) {
              tState[j] = TigerState.Latched;
              tHost[j] = r;
              tLatchAng[j] = wrap(
                Math.atan2(
                  (ty[j] as number) - (ry[r] as number),
                  (tx[j] as number) - (rx[r] as number),
                ) - (rh[r] as number),
              );
            } else {
              tLatchCd[j] = C.latchRetry;
            }
          }
          break;
        }
        case TigerState.Latched: {
          const h = tHost[j] as number;
          if (h < 0 || !rAlive[h]) {
            toRecover(j, 0);
            break;
          }
          const a = (rh[h] as number) + (tLatchAng[j] as number);
          tx[j] = (rx[h] as number) + Math.cos(a) * (radius + C.tigerRadius);
          ty[j] = (ry[h] as number) + Math.sin(a) * (radius + C.tigerRadius);
          const dmg = (tDps[j] as number) * DT;
          rHp[h] = (rHp[h] as number) - dmg;
          rWound[h] = (rWound[h] as number) + dmg;
          tStamina[j] = (tStamina[j] as number) - DT / (tLatchEnd[j] as number);
          if (rng.next() < (rShake[h] as number) * DT) {
            tHp[j] = (tHp[j] as number) - C.throwDamageFrac * (tMaxHp[j] as number);
            if ((tHp[j] as number) <= 0) {
              kill(j);
              break;
            }
            toRecover(j, C.throwMoraleLoss);
            moveToward(j, a, C.throwDistance);
            break;
          }
          if ((tStamina[j] as number) <= 0) toRecover(j, 0);
          break;
        }
        case TigerState.Recover: {
          const r = nearestTrex(j);
          tStamina[j] = Math.min(1, (tStamina[j] as number) + DT / (tRecovery[j] as number));
          if (r >= 0) {
            const dx = (tx[j] as number) - (rx[r] as number);
            const dy = (ty[j] as number) - (ry[r] as number);
            if (Math.hypot(dx, dy) < C.recoverDistance) {
              moveToward(j, Math.atan2(dy, dx), (tCruise[j] as number) * DT);
            }
          }
          if ((tStamina[j] as number) >= C.resumeStamina) {
            tState[j] = TigerState.Approach;
            tTarget[j] = -1;
          }
          break;
        }
        case TigerState.Routed: {
          const r = nearestTrex(j);
          let away: number;
          if (r >= 0)
            away = Math.atan2(
              (ty[j] as number) - (ry[r] as number),
              (tx[j] as number) - (rx[r] as number),
            );
          else away = Math.atan2((ty[j] as number) - L / 2, (tx[j] as number) - L / 2);
          let speed = tCruise[j] as number;
          if ((tStamina[j] as number) > 0) {
            speed = tSprint[j] as number;
            tStamina[j] = (tStamina[j] as number) - DT / (tSprintEnd[j] as number);
          }
          moveToward(j, away, speed * DT);
          const x = tx[j] as number;
          const y = ty[j] as number;
          if (x < 0 || y < 0 || x > L || y > L) tState[j] = TigerState.Left;
          break;
        }
      }

      if ((tState[j] as number) < TigerState.Routed) {
        tx[j] = Math.min(L, Math.max(0, tx[j] as number));
        ty[j] = Math.min(L, Math.max(0, ty[j] as number));
      }
    }

    // --- Casualties & termination ---
    let trexAlive = 0;
    for (let i = 0; i < N; i++) {
      if (rAlive[i] && (rHp[i] as number) <= 0) {
        rAlive[i] = 0;
        rHp[i] = 0;
      }
      if (rAlive[i]) trexAlive++;
    }
    let active = 0;
    for (let j = 0; j < M; j++) if ((tState[j] as number) < TigerState.Routed) active++;

    if (trace && (step + 1) % traceEvery === 0) record((step + 1) * DT);
    if (trexAlive === 0) {
      outcome = Outcome.Tigers;
      step++;
      break;
    }
    if (active === 0) {
      outcome = Outcome.Trex;
      step++;
      break;
    }
  }

  if (trace && (frames.length === 0 || (frames[frames.length - 1] as TraceFrame).t < step * DT)) {
    record(step * DT);
  }

  let trexAlive = 0;
  let hpSum = 0;
  let maxHpSum = 0;
  for (let i = 0; i < N; i++) {
    if (rAlive[i]) {
      trexAlive++;
      hpSum += rHp[i] as number;
    }
    maxHpSum += rMaxHp[i] as number;
  }
  let routed = 0;
  let active = 0;
  for (let j = 0; j < M; j++) {
    const s = tState[j] as number;
    if (s === TigerState.Routed || s === TigerState.Left) routed++;
    else if (s < TigerState.Routed) active++;
  }
  const trexHpFrac = maxHpSum > 0 ? hpSum / maxHpSum : 0;
  const summary: RunSummary = {
    run,
    outcome,
    duration: step * DT,
    trexAlive,
    tigersKilled: killed,
    tigersRouted: routed,
    tigersActive: active,
    trexHpFrac,
    trexAdvantage: trexHpFrac - active / M,
  };
  return trace
    ? { summary, trace: { arenaSize: L, trexCount: N, tigerCount: M, frames } }
    : { summary };
}
