import type { ScenarioConfig } from './config';
import { individualFactor } from './distributions';
import {
  DeathCause,
  EVENT_NONE,
  EventLog,
  EventType,
  ReleaseCause,
  angleByte,
  damageByte,
  type EventLogLimits,
  type EventStats,
} from './events';
import { PARAMS, PARAM_INDEX as P } from './params';
import { Rng, deriveSeed } from './rng';
import { HEAVY_SPECIES, PACK_SPECIES, boundsTable, type HeavySpeciesId } from './species';
import { SpatialGrid } from './spatial';

/** Fixed integration step in seconds. */
export const DT = 0.1;

/** Model constants not exposed as uncertain parameters. Documented in docs/MODEL.md. */
export const CONSTANTS = {
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
  heavyRetarget: 0.5,
  packRetarget: 1,
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
  eventP0Cap: 262_144,
  eventP1Cap: 32_768,
  biteMissCoalesce: 1,
  latchFailCoalesce: 2,
  recoverMinTime: 5,
  shockPad: 6.5,
} as const;

export const PackState = {
  Approach: 0,
  Latched: 1,
  Recover: 2,
  Routed: 3,
  Dead: 4,
  Left: 5,
} as const;

export const Outcome = { Heavy: 0, Pack: 1, Draw: 2 } as const;
export type OutcomeCode = (typeof Outcome)[keyof typeof Outcome];

export interface RunSummary {
  run: number;
  outcome: OutcomeCode;
  duration: number;
  heavyAlive: number;
  packKilled: number;
  packRouted: number;
  packActive: number;
  heavyHpFrac: number;
  /** heavyHpFrac − (active pack animals / initial pack animals), in [−1, 1]. Used for sensitivity. */
  heavyAdvantage: number;
}

export interface TraceFrame {
  t: number;
  /** Per heavy: x, y, heading, hpFrac (hpFrac ≤ 0 → dead). */
  heavy: Float32Array<ArrayBuffer>;
  /** Per pack animal: x, y, state. */
  pack: Float32Array<ArrayBuffer>;
}

/** Static per-run data the replay needs for geometry (bite wedges, latch positions). */
export interface TraceMeta {
  /** Integration step in seconds; event time = stamp × dt. */
  dt: number;
  bodyRadius: number;
  packRadius: number;
  /** Per heavy bite reach (m). */
  reach: Float32Array<ArrayBuffer>;
  /** Per heavy bite half-angle (rad). */
  arc: Float32Array<ArrayBuffer>;
}

export const TRACE_VERSION = 2;

export interface BattleTrace {
  version: typeof TRACE_VERSION;
  arenaSize: number;
  heavyCount: number;
  packCount: number;
  frames: TraceFrame[];
  /** Event log, 4 × u16 per event (events.ts, docs/MODEL.md §2.6). */
  events: Uint16Array<ArrayBuffer>;
  /**
   * Every event with stamp ≤ this step is in `events`. Equals the battle's tick count unless the
   * P0 budget was exhausted; after it, a renderer must fall back to frame-sampled states.
   */
  eventsCompleteUntilStep: number;
  eventStats: EventStats;
  meta: TraceMeta;
}

/** Test hooks for traced runs. The app always uses the defaults. */
export interface TraceOptions {
  /** Record the event log (default true). */
  events?: boolean;
  /** Override parts of the event budget. */
  eventLimits?: Partial<EventLogLimits>;
}

export interface BattleOutput {
  summary: RunSummary;
  trace?: BattleTrace;
}

const BATTLE_SALT = 2;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const len = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy);

const wrap = (a: number): number => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
};

/**
 * What a heavy's hits and shake-offs cost the pack animal they strike: morale lost on a hit, on
 * a throw, and the minimum recovery time after a hit. The species constant `intimidation` scales
 * the shared constants; it is exactly 1 for every species that shipped before #47, and x × 1 is
 * exact, so their results are unchanged.
 */
export function heavyMoraleEffects(id: HeavySpeciesId): {
  woundMoraleLoss: number;
  throwMoraleLoss: number;
  hitRecoverTime: number;
} {
  const k = HEAVY_SPECIES[id].constants.intimidation;
  return {
    woundMoraleLoss: CONSTANTS.woundMoraleLoss * k,
    throwMoraleLoss: CONSTANTS.throwMoraleLoss * k,
    hitRecoverTime: CONSTANTS.recoverMinTime * k,
  };
}

/**
 * Simulate one battle.
 * @param row run-level parameter values (one design row, ordered like PARAMS)
 */
export function simulateBattle(
  config: ScenarioConfig,
  row: ArrayLike<number>,
  run: number,
  trace = false,
  options: TraceOptions = {},
): BattleOutput {
  const C = CONSTANTS;
  const rng = new Rng(deriveSeed(config.seed, run, BATTLE_SALT));
  const N = config.heavyCount;
  const M = config.packCount;
  const L = config.arenaSize;
  const cv = config.individualCV;
  // Species constants: no random draws, and exact identities for T. rex (hide 1) and the pack animal
  // (radius 0.8 m, the former engine constant), so v1 links reproduce bit-identically.
  const hide = HEAVY_SPECIES[config.heavySpecies].constants.hide;
  const { woundMoraleLoss, throwMoraleLoss, hitRecoverTime } = heavyMoraleEffects(
    config.heavySpecies,
  );
  const packRadius = PACK_SPECIES[config.packSpecies].constants.radius;
  const bounds = boundsTable(config.heavySpecies, config.packSpecies);

  const indiv = (k: number): number => {
    const d = PARAMS[k] as (typeof PARAMS)[number];
    const b = bounds[k] as readonly [number, number];
    const base = row[k] as number;
    const v = d.individual ? base * individualFactor(rng, cv) : base;
    return Math.min(b[1], Math.max(b[0], v));
  };
  const runVal = (k: number): number => row[k] as number;

  // --- heavy state (SoA) ---
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
  const radius = runVal(P['heavy.bodyRadius']);
  const lethality = runVal(P['heavy.biteLethality']);
  const bleed = runVal(P['pack.bleed']);

  const sep = Math.min(200, 0.4 * L);
  const spacing = Math.min(15, (0.8 * L) / Math.max(1, N));
  for (let i = 0; i < N; i++) {
    rx[i] = L / 2 - sep / 2;
    ry[i] = L / 2 + (i - (N - 1) / 2) * spacing;
    rh[i] = 0;
    rMass[i] = indiv(P['heavy.mass']);
    rHp[i] = rMaxHp[i] = rMass[i] as number;
    rSpeed[i] = indiv(P['heavy.speed']);
    rTurn[i] = indiv(P['heavy.turnRate']) * DEG;
    rBiteDmg[i] = indiv(P['heavy.biteForce']) * lethality;
    rBiteInt[i] = indiv(P['heavy.biteInterval']);
    rReach[i] = indiv(P['heavy.biteReach']);
    rArc[i] = indiv(P['heavy.biteArc']) * DEG;
    rAcc[i] = indiv(P['heavy.biteAccuracy']);
    rShake[i] = indiv(P['heavy.shakeRate']);
    rCd[i] = rng.next() * (rBiteInt[i] as number);
    rTimer[i] = rng.next() * C.heavyRetarget;
    rAlive[i] = 1;
  }

  // --- Pack animal state (SoA) ---
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
  const tRecoverTimer = new Float64Array(M);

  const discR = Math.min(0.2 * L, 3 * Math.sqrt(M));
  for (let j = 0; j < M; j++) {
    const a = rng.next() * TAU;
    const d = discR * Math.sqrt(rng.next());
    tx[j] = L / 2 + sep / 2 + Math.cos(a) * d;
    ty[j] = L / 2 + Math.sin(a) * d;
    tMass[j] = indiv(P['pack.mass']);
    tHp[j] = tMaxHp[j] = tMass[j] as number;
    tSprint[j] = indiv(P['pack.sprintSpeed']);
    tCruise[j] = Math.min(tSprint[j] as number, indiv(P['pack.cruiseSpeed']));
    tSprintEnd[j] = indiv(P['pack.sprintEndurance']);
    tLatchEnd[j] = indiv(P['pack.latchEndurance']);
    tRecovery[j] = indiv(P['pack.recoveryTime']);
    tLatchChance[j] = indiv(P['pack.latchChance']);
    tDps[j] = indiv(P['pack.dps']);
    tMorale[j] = indiv(P['pack.morale']);
    tMoraleLoss[j] = indiv(P['pack.moraleLoss']);
    tStamina[j] = 1;
    tState[j] = PackState.Approach;
    tTimer[j] = rng.next() * C.packRetarget;
    tSide[j] = rng.next() < 0.5 ? -1 : 1;
  }

  const grid = new SpatialGrid(L, M);
  const heavyGrid = new SpatialGrid(L, N);
  const heavyAliveFilter = (i: number): boolean => rAlive[i] === 1;
  const presentFilter = (j: number): boolean => (tState[j] as number) < PackState.Dead;
  let killed = 0;

  // Morale shock around a dead pack animal.
  let shockX = 0;
  let shockY = 0;
  let shockSelf = -1;
  const shockVisit = (k: number): void => {
    if (k === shockSelf || (tState[k] as number) >= PackState.Dead) return;
    const dx = (tx[k] as number) - shockX;
    const dy = (ty[k] as number) - shockY;
    if (dx * dx + dy * dy <= C.moraleRadius * C.moraleRadius) {
      tMorale[k] = (tMorale[k] as number) - (tMoraleLoss[k] as number);
    }
  };

  // Event log: only for traced runs. `log?.emit(...)` skips argument evaluation when null.
  // Emission only reads state; it never draws random numbers or changes control flow.
  const log =
    trace && options.events !== false
      ? new EventLog(N, M, {
          p0Cap: C.eventP0Cap,
          p1Cap: C.eventP1Cap,
          missWindow: Math.round(C.biteMissCoalesce / DT),
          failWindow: Math.round(C.latchFailCoalesce / DT),
          ...options.eventLimits,
        })
      : null;

  const kill = (j: number, cause: number, by: number): void => {
    log?.emit(EventType.PackDeath, cause, j, by);
    tState[j] = PackState.Dead;
    tHp[j] = 0;
    tHost[j] = -1;
    killed++;
    if (config.morale) {
      shockX = tx[j] as number;
      shockY = ty[j] as number;
      shockSelf = j;
      grid.query(shockX, shockY, C.moraleRadius + C.shockPad, shockVisit);
    }
  };

  const toRecover = (j: number, moraleLoss: number, minTime: number): void => {
    tState[j] = PackState.Recover;
    tHost[j] = -1;
    tRecoverTimer[j] = minTime;
    tMorale[j] = (tMorale[j] as number) - moraleLoss;
  };

  // Bite target search.
  let biter = 0;
  let best: number;
  let bestScore: number;
  const biteVisit = (j: number): void => {
    const s = tState[j] as number;
    if (s >= PackState.Dead) return;
    let px = tx[j] as number;
    let py = ty[j] as number;
    if (s === PackState.Latched) {
      // Latched pack animals ride their host; use the host's current pose, not last tick's position.
      const h = tHost[j] as number;
      const a = (rh[h] as number) + (tLatchAng[j] as number);
      px = (rx[h] as number) + Math.cos(a) * (radius + packRadius);
      py = (ry[h] as number) + Math.sin(a) * (radius + packRadius);
    }
    const dx = px - (rx[biter] as number);
    const dy = py - (ry[biter] as number);
    const d = len(dx, dy);
    if (d > (rReach[biter] as number) + packRadius) return;
    if (Math.abs(wrap(Math.atan2(dy, dx) - (rh[biter] as number))) > (rArc[biter] as number))
      return;
    const score = s === PackState.Latched && tHost[j] === biter ? d - 1000 : d;
    if (score < bestScore) {
      bestScore = score;
      best = j;
    }
  };

  const freeFilter = (j: number): boolean => {
    const s = tState[j] as number;
    return s !== PackState.Latched && s < PackState.Dead;
  };
  const nearestFreePack = (i: number): number =>
    grid.nearest(rx[i] as number, ry[i] as number, tx, ty, freeFilter);
  const nearestHeavy = (j: number): number =>
    heavyGrid.nearest(tx[j] as number, ty[j] as number, rx, ry, heavyAliveFilter);

  const chooseHeavy = (j: number): number => {
    if (config.packTactic === 'direct') return nearestHeavy(j);
    let bi = -1;
    let bs = Infinity;
    for (let i = 0; i < N; i++) {
      if (!rAlive[i]) continue;
      const d = len((rx[i] as number) - (tx[j] as number), (ry[i] as number) - (ty[j] as number));
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
  const maxSteps = Math.round(config.maxTime / DT);
  // Adaptive decimation: start dense, halve the frame rate whenever the float budget is exceeded.
  let traceEvery: number = C.traceMinEvery;
  const maxFrames = Math.max(2, Math.floor(C.traceFloatBudget / (4 * N + 3 * M)));
  let frames: TraceFrame[] = [];
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
    frames.push({ t, heavy: fr, pack: ft });
  };

  let outcome: OutcomeCode = Outcome.Draw;
  let step = 0;
  if (trace) record(0);

  for (; step < maxSteps; step++) {
    log?.beginStep(step + 1);
    grid.rebuild(M, tx, ty, presentFilter);
    rCarry.fill(0);
    rLatched.fill(0);
    for (let j = 0; j < M; j++) {
      if (tState[j] === PackState.Latched) {
        const h = tHost[j] as number;
        rCarry[h] = (rCarry[h] as number) + (tMass[j] as number);
        rLatched[h] = (rLatched[h] as number) + 1;
      }
    }

    // --- heavy ---
    for (let i = 0; i < N; i++) {
      if (!rAlive[i]) continue;
      rTimer[i] = (rTimer[i] as number) - DT;
      const tgt = rTarget[i] as number;
      const tgtState = tgt >= 0 ? (tState[tgt] as number) : PackState.Dead;
      if (
        (rTimer[i] as number) <= 0 ||
        tgtState === PackState.Latched ||
        tgtState >= PackState.Dead
      ) {
        rTarget[i] = nearestFreePack(i);
        rTimer[i] = C.heavyRetarget;
      }
      const target = rTarget[i] as number;
      if (target >= 0) {
        const dx = (tx[target] as number) - (rx[i] as number);
        const dy = (ty[target] as number) - (ry[i] as number);
        const dh = wrap(Math.atan2(dy, dx) - (rh[i] as number));
        const maxTurn = (rTurn[i] as number) * DT;
        rh[i] = wrap((rh[i] as number) + Math.max(-maxTurn, Math.min(maxTurn, dh)));
        const dist = len(dx, dy);
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
        grid.query(rx[i] as number, ry[i] as number, (rReach[i] as number) + packRadius, biteVisit);
        if (best >= 0) {
          rCd[i] = rBiteInt[i] as number;
          const latched = tState[best] === PackState.Latched;
          const acc = latched
            ? Math.min(C.maxAccuracy, (rAcc[i] as number) * C.latchedAccuracyBonus)
            : (rAcc[i] as number);
          if (rng.next() < acc) {
            const dmg = (rBiteDmg[i] as number) * (C.biteDamageMin + C.biteDamageSpan * rng.next());
            log?.emit(EventType.BiteHit, damageByte(dmg, tMaxHp[best] as number), i, best);
            tHp[best] = (tHp[best] as number) - dmg;
            if ((tHp[best] as number) <= 0) kill(best, DeathCause.Bite, i);
            else toRecover(best, woundMoraleLoss, hitRecoverTime);
          } else {
            log?.emit(EventType.BiteMiss, 0, i, best);
          }
        }
      }

      if (bleed > 0) rHp[i] = (rHp[i] as number) - (rWound[i] as number) * bleed * DT;
    }
    heavyGrid.rebuild(N, rx, ry, heavyAliveFilter);

    // --- Pack animals ---
    for (let j = 0; j < M; j++) {
      const s = tState[j] as number;
      if (s >= PackState.Dead) continue;

      if (config.morale && s !== PackState.Routed && (tMorale[j] as number) < C.routThreshold) {
        log?.emit(
          EventType.Rout,
          0,
          j,
          s === PackState.Latched ? (tHost[j] as number) : EVENT_NONE,
        );
        tState[j] = PackState.Routed;
        tHost[j] = -1;
      }

      switch (tState[j]) {
        case PackState.Approach: {
          tLatchCd[j] = (tLatchCd[j] as number) - DT;
          tTimer[j] = (tTimer[j] as number) - DT;
          let r = tTarget[j] as number;
          if ((tTimer[j] as number) <= 0 || r < 0 || !rAlive[r]) {
            r = tTarget[j] = chooseHeavy(j);
            tTimer[j] = C.packRetarget;
          }
          if (r < 0) break;
          const dx = (rx[r] as number) - (tx[j] as number);
          const dy = (ry[r] as number) - (ty[j] as number);
          const dist = len(dx, dy);
          const contact = radius + packRadius + 0.5;
          const rel = wrap(Math.atan2(-dy, -dx) - (rh[r] as number));

          let aimX = rx[r] as number;
          let aimY = ry[r] as number;
          let heading: number;
          if (config.packTactic === 'flank') {
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
          if (config.packTactic === 'direct')
            stepLen = Math.min(stepLen, Math.max(0, dist - contact));
          else {
            const aimDist = len(aimX - (tx[j] as number), aimY - (ty[j] as number));
            stepLen = Math.min(stepLen, aimDist);
          }
          moveToward(j, heading, stepLen);

          if ((tStamina[j] as number) <= 0) {
            log?.emit(EventType.Exhausted, 0, j, r);
            toRecover(j, 0, 0);
            break;
          }
          const nd = len(
            (rx[r] as number) - (tx[j] as number),
            (ry[r] as number) - (ty[j] as number),
          );
          if (nd <= contact && (tLatchCd[j] as number) <= 0) {
            if (rng.next() < (tLatchChance[j] as number)) {
              tState[j] = PackState.Latched;
              tHost[j] = r;
              tLatchAng[j] = wrap(
                Math.atan2(
                  (ty[j] as number) - (ry[r] as number),
                  (tx[j] as number) - (rx[r] as number),
                ) - (rh[r] as number),
              );
              log?.emit(EventType.Latch, angleByte(tLatchAng[j] as number), j, r);
            } else {
              log?.emit(EventType.LatchFail, 0, j, r);
              tLatchCd[j] = C.latchRetry;
            }
          }
          break;
        }
        case PackState.Latched: {
          const h = tHost[j] as number;
          if (h < 0 || !rAlive[h]) {
            log?.emit(EventType.Release, ReleaseCause.HostDied, j, h < 0 ? EVENT_NONE : h);
            toRecover(j, 0, 0);
            break;
          }
          const a = (rh[h] as number) + (tLatchAng[j] as number);
          tx[j] = (rx[h] as number) + Math.cos(a) * (radius + packRadius);
          ty[j] = (ry[h] as number) + Math.sin(a) * (radius + packRadius);
          const dmg = (tDps[j] as number) * DT * hide;
          rHp[h] = (rHp[h] as number) - dmg;
          rWound[h] = (rWound[h] as number) + dmg;
          tStamina[j] = (tStamina[j] as number) - DT / (tLatchEnd[j] as number);
          if (rng.next() < (rShake[h] as number) * DT) {
            log?.emit(EventType.Throw, 0, j, h);
            tHp[j] = (tHp[j] as number) - C.throwDamageFrac * (tMaxHp[j] as number);
            if ((tHp[j] as number) <= 0) {
              kill(j, DeathCause.Throw, h);
              break;
            }
            toRecover(j, throwMoraleLoss, C.recoverMinTime);
            moveToward(j, a, C.throwDistance);
            break;
          }
          if ((tStamina[j] as number) <= 0) {
            log?.emit(EventType.Release, ReleaseCause.Stamina, j, h);
            toRecover(j, 0, 0);
          }
          break;
        }
        case PackState.Recover: {
          const r = nearestHeavy(j);
          tStamina[j] = Math.min(1, (tStamina[j] as number) + DT / (tRecovery[j] as number));
          if (r >= 0) {
            const dx = (tx[j] as number) - (rx[r] as number);
            const dy = (ty[j] as number) - (ry[r] as number);
            if (len(dx, dy) < C.recoverDistance) {
              moveToward(j, Math.atan2(dy, dx), (tCruise[j] as number) * DT);
            }
          }
          tRecoverTimer[j] = (tRecoverTimer[j] as number) - DT;
          if ((tStamina[j] as number) >= C.resumeStamina && (tRecoverTimer[j] as number) <= 0) {
            log?.emit(EventType.Resume, 0, j, EVENT_NONE);
            tState[j] = PackState.Approach;
            tTarget[j] = -1;
          }
          break;
        }
        case PackState.Routed: {
          const r = nearestHeavy(j);
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
          if (x < 0 || y < 0 || x > L || y > L) {
            log?.emit(EventType.Exit, 0, j, EVENT_NONE);
            tState[j] = PackState.Left;
          }
          break;
        }
      }

      if ((tState[j] as number) < PackState.Routed) {
        tx[j] = Math.min(L, Math.max(0, tx[j] as number));
        ty[j] = Math.min(L, Math.max(0, ty[j] as number));
      }
    }

    // --- Casualties & termination ---
    let heavyAlive = 0;
    for (let i = 0; i < N; i++) {
      if (rAlive[i] && (rHp[i] as number) <= 0) {
        log?.emit(EventType.HeavyDeath, 0, i, EVENT_NONE);
        rAlive[i] = 0;
        rHp[i] = 0;
      }
      if (rAlive[i]) heavyAlive++;
    }
    let active = 0;
    for (let j = 0; j < M; j++) if ((tState[j] as number) < PackState.Routed) active++;

    if (trace && (step + 1) % traceEvery === 0) {
      record((step + 1) * DT);
      if (frames.length > maxFrames) {
        frames = frames.filter((_, k) => k % 2 === 0);
        traceEvery *= 2;
      }
    }
    if (heavyAlive === 0) {
      outcome = Outcome.Pack;
      step++;
      break;
    }
    if (active === 0) {
      outcome = Outcome.Heavy;
      step++;
      break;
    }
  }

  if (trace && (frames.length === 0 || (frames[frames.length - 1] as TraceFrame).t < step * DT)) {
    record(step * DT);
  }

  let heavyAlive = 0;
  let hpSum = 0;
  let maxHpSum = 0;
  for (let i = 0; i < N; i++) {
    if (rAlive[i]) {
      heavyAlive++;
      hpSum += rHp[i] as number;
    }
    maxHpSum += rMaxHp[i] as number;
  }
  let routed = 0;
  let active = 0;
  for (let j = 0; j < M; j++) {
    const s = tState[j] as number;
    if (s === PackState.Routed || s === PackState.Left) routed++;
    else if (s < PackState.Routed) active++;
  }
  const heavyHpFrac = maxHpSum > 0 ? hpSum / maxHpSum : 0;
  const summary: RunSummary = {
    run,
    outcome,
    duration: step * DT,
    heavyAlive,
    packKilled: killed,
    packRouted: routed,
    packActive: active,
    heavyHpFrac,
    heavyAdvantage: heavyHpFrac - active / M,
  };
  if (!trace) return { summary };
  const ev = log ? log.finish(step) : null;
  return {
    summary,
    trace: {
      version: TRACE_VERSION,
      arenaSize: L,
      heavyCount: N,
      packCount: M,
      frames,
      events: ev ? ev.events : new Uint16Array(0),
      eventsCompleteUntilStep: ev ? ev.completeUntilStep : 0,
      eventStats: ev ? ev.stats : { p0: 0, p1: 0, p1Coalesced: 0, p1Dropped: 0, p0Dropped: 0 },
      meta: {
        dt: DT,
        bodyRadius: radius,
        packRadius,
        reach: Float32Array.from(rReach),
        arc: Float32Array.from(rArc),
      },
    },
  };
}
