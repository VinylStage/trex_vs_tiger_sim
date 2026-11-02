import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSTANTS, DT } from '../src/sim/engine';
import { CARD_IDS, type CardId } from '../src/sim/free/cards';
import { sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FreeState,
  simulateFreeBattle,
  type FreeAgentView,
  type FreeBattleOptions,
  type FreeBattleOutput,
  type FreeRunSummary,
} from '../src/sim/free/engine';
import {
  MAX_INTERVENTIONS,
  MAX_INTERVENTION_INPUT,
  compileInterventions,
  durationTicks,
  mulProduct,
  sanitizeInterventions,
  type Intervention,
  type InterventionSide,
} from '../src/sim/free/interventions';
import { TRAIT_BOUNDS } from '../src/sim/free/traits';
import { designRow } from '../src/sim/sampling';

/**
 * Intervention hook of the free engine (#174; docs/design/RENEWAL-1.0.md §10.1, §10.4 step 3,
 * Appendix B; ADR-0008 §7). The existing goldens prove that an empty log changes nothing; this
 * file pins what a non-empty log does: the sanitizer, instant ops, the deterministic recomputation
 * of overlapping `mul` durations, the clamps, and a fixture of fixed logs (fixed log → fixed
 * summary). The fixture is written only when it does not exist yet
 * (`CAPTURE_INTERVENTIONS_GOLDEN=<label>`); never regenerate it.
 */

const code = (id: CardId): number => CARD_IDS.indexOf(id);
const iv = (tick: number, id: CardId, side: InterventionSide): Intervention => ({
  tick,
  card: code(id),
  side,
});

const configOf = (input: Record<string, unknown>): FreeConfig => sanitizeFreeConfig(input);
const TREX = configOf({ runs: 4, sides: [{ species: 'trex' }, { species: 'trex' }] });
const WOLVES = configOf({
  runs: 4,
  sides: [
    { species: 'wolf', count: 8 },
    { species: 'brownBear', count: 1 },
  ],
});

const runOf = (
  config: FreeConfig,
  run: number,
  opts?: FreeBattleOptions,
  trace = false,
): FreeBattleOutput =>
  simulateFreeBattle(config, designRow(buildFreeDesign(config), run), run, trace, opts);

/** Copies of the view's arrays at each inspected tick. */
type Snap = Record<keyof FreeAgentView, number[]>;
const snapOf = (v: FreeAgentView): Snap =>
  Object.fromEntries(
    Object.entries(v).map(([k, a]) => [k, Array.from(a as ArrayLike<number>)]),
  ) as Snap;

function inspectRun(
  config: FreeConfig,
  run: number,
  interventions: readonly Intervention[],
  ticks: readonly number[],
): { snaps: Map<number, Snap>; summary: FreeRunSummary } {
  const snaps = new Map<number, Snap>();
  const { summary } = runOf(config, run, {
    interventions,
    inspect: { ticks, at: (step, v) => snaps.set(step, snapOf(v)) },
  });
  return { snaps, summary };
}

/** A tick at 95 % of run `run`'s battle without interventions: late, but before the end. */
const lateTick = (config: FreeConfig, run: number): number =>
  Math.floor((0.95 * runOf(config, run).summary.duration) / DT);

const at = (snaps: Map<number, Snap>, tick: number): Snap => {
  const s = snaps.get(tick);
  if (!s) throw new Error(`battle ended before tick ${tick}`);
  return s;
};

describe('sanitizeInterventions', () => {
  const maxSteps = 1000;
  const on = { morale: true };

  it('keeps valid entries in tuple or object form and sorts them stably by tick', () => {
    const out = sanitizeInterventions(
      [
        [300, code('focus'), 1],
        { tick: 100, card: code('mud'), side: 2 },
        [100, code('focus'), 0],
        [0, code('regroup'), 1],
      ],
      maxSteps,
      1,
      on,
    );
    expect(out).toEqual([
      iv(0, 'regroup', 1),
      iv(100, 'mud', 2),
      iv(100, 'focus', 0),
      iv(300, 'focus', 1),
    ]);
  });

  it('rejects ticks outside [0, maxSteps) and non-integer ticks', () => {
    for (const tick of [-1, maxSteps, maxSteps + 5, 1.5, Number.NaN, Infinity, '3', null]) {
      expect(sanitizeInterventions([[tick, code('focus'), 0]], maxSteps, 1, on)).toEqual([]);
    }
    expect(sanitizeInterventions([[maxSteps - 1, code('focus'), 0]], maxSteps, 1, on)).toEqual([
      iv(maxSteps - 1, 'focus', 0),
    ]);
  });

  it('rejects cards the model version does not define', () => {
    for (const card of [-1, CARD_IDS.length, 1.5, '7', null]) {
      expect(sanitizeInterventions([[10, card, 0]], maxSteps, 1, on)).toEqual([]);
    }
    for (const mv of [0, 2, 1.5, Number.NaN]) {
      expect(sanitizeInterventions([[10, code('focus'), 0]], maxSteps, mv, on)).toEqual([]);
    }
  });

  it('rejects a side that does not match the card target', () => {
    expect(sanitizeInterventions([[10, code('mud'), 0]], maxSteps, 1, on)).toEqual([]);
    expect(sanitizeInterventions([[10, code('mud'), 1]], maxSteps, 1, on)).toEqual([]);
    expect(sanitizeInterventions([[10, code('focus'), 2]], maxSteps, 1, on)).toEqual([]);
    for (const side of [3, -1, '0', 0.5, null]) {
      expect(sanitizeInterventions([[10, code('focus'), side]], maxSteps, 1, on)).toEqual([]);
    }
  });

  it('drops morale cards when morale is off, and keeps the rest', () => {
    const raw = [
      [10, code('rallying-cry'), 0],
      [11, code('shaken'), 1],
      [12, code('focus'), 0],
    ];
    expect(sanitizeInterventions(raw, maxSteps, 1, { morale: false })).toEqual([
      iv(12, 'focus', 0),
    ]);
    expect(sanitizeInterventions(raw, maxSteps, 1, on)).toHaveLength(3);
  });

  it('rejects malformed entries and non-array input', () => {
    for (const raw of [null, undefined, 3, 'x', {}, { 0: [1, 0, 2] }]) {
      expect(sanitizeInterventions(raw, maxSteps, 1, on)).toEqual([]);
    }
    expect(
      sanitizeInterventions([null, 7, [1, 0], [1, 0, 2, 9], {}, [1, 0, 2]], maxSteps, 1, on),
    ).toEqual([iv(1, 'downpour', 2)]);
  });

  it('keeps at most MAX_INTERVENTIONS entries, the earliest ticks', () => {
    const raw = Array.from({ length: 100 }, (_, k) => [99 - k, code('focus'), 0]);
    const out = sanitizeInterventions(raw, maxSteps, 1, on);
    expect(out).toHaveLength(MAX_INTERVENTIONS);
    expect(out.map((e) => e.tick)).toEqual(Array.from({ length: MAX_INTERVENTIONS }, (_, k) => k));
  });

  it('rejects an input longer than MAX_INTERVENTION_INPUT without scanning it', () => {
    const raw: unknown[] = [[1, code('focus'), 0]];
    raw.length = MAX_INTERVENTION_INPUT + 1;
    expect(sanitizeInterventions(raw, maxSteps, 1, on)).toEqual([]);
    raw.length = MAX_INTERVENTION_INPUT;
    expect(sanitizeInterventions(raw, maxSteps, 1, on)).toEqual([iv(1, 'focus', 0)]);
  });
});

describe('compiled log and combined multiplier', () => {
  it('converts durations to ticks; rest-of-battle cards never expire', () => {
    expect(durationTicks(20)).toBe(200);
    expect(durationTicks(15)).toBe(150);
    expect(durationTicks(null)).toBe(Infinity);
  });

  it('lists start and expiry ticks below maxSteps as events', () => {
    const log = compileInterventions([iv(100, 'focus', 0), iv(150, 'pitch-dark', 2)], 1, 1000);
    expect(log.events).toEqual([100, 150, 300]);
    expect(compileInterventions([iv(900, 'focus', 0)], 1, 1000).events).toEqual([900]);
  });

  it('multiplies the active ops in (start tick, log index) order, clamped to [0.5, 2]', () => {
    // RENEWAL-1.0 §10.1 worked example.
    const { muls } = compileInterventions([iv(100, 'focus', 0), iv(150, 'pitch-dark', 2)], 1, 1e4);
    expect(mulProduct(muls, 0, 'accuracy', 99)).toBeNull();
    expect(mulProduct(muls, 0, 'accuracy', 100)).toBe(1.2);
    expect(mulProduct(muls, 0, 'accuracy', 150)).toBe(1.2 * 0.8);
    expect(mulProduct(muls, 0, 'accuracy', 299)).toBe(1.2 * 0.8);
    expect(mulProduct(muls, 0, 'accuracy', 300)).toBe(0.8);
    expect(mulProduct(muls, 1, 'accuracy', 149)).toBeNull();
    expect(mulProduct(muls, 1, 'accuracy', 150)).toBe(0.8);
    expect(mulProduct(muls, 0, 'speed', 200)).toBeNull();

    const many = compileInterventions(
      [iv(0, 'mud', 2), iv(0, 'mud', 2), iv(0, 'downpour', 2), iv(0, 'giant', 1)],
      1,
      1e4,
    ).muls;
    expect(mulProduct(many, 0, 'speed', 5)).toBe(0.5);
    expect(mulProduct(many, 1, 'power', 5)).toBe(1.5);
    const strong = compileInterventions(
      [iv(0, 'giant', 0), iv(0, 'power-surge', 0), iv(0, 'power-surge', 0)],
      1,
      1e4,
    ).muls;
    expect(mulProduct(strong, 0, 'power', 5)).toBe(2);
  });
});

describe('empty log', () => {
  it('gives the same summary and trace as no options at all', () => {
    for (const config of [TREX, WOLVES]) {
      for (const run of [0, 1]) {
        const plain = runOf(config, run, undefined, true);
        expect(runOf(config, run, {}, true)).toEqual(plain);
        expect(runOf(config, run, { interventions: [] }, true)).toEqual(plain);
        const nul = { interventions: null } as unknown as FreeBattleOptions;
        expect(runOf(config, run, nul, true)).toEqual(plain);
        // Every entry is dropped: a morale card with morale off, a tick past the end.
        const off = sanitizeFreeConfig({ ...config, morale: false });
        expect(
          runOf(off, run, { interventions: [iv(5, 'rallying-cry', 0), iv(1e6, 'mud', 2)] }, true),
        ).toEqual(runOf(off, run, undefined, true));
      }
    }
  });

  it('inspection alone changes nothing', () => {
    const plain = runOf(TREX, 0, undefined, true);
    const seen: number[] = [];
    const out = runOf(
      TREX,
      0,
      { inspect: { ticks: [-3, 0, 10, 2.5], at: (s) => seen.push(s) } },
      true,
    );
    expect(out).toEqual(plain);
    expect(seen).toEqual([0, 10]);
  });
});

describe('a card changes nothing before its tick', () => {
  it('keeps every trace frame up to the card tick bit-identical', () => {
    const T = 200;
    const plain = runOf(TREX, 0, undefined, true).trace;
    const forked = runOf(
      TREX,
      0,
      { interventions: [iv(T, 'giant', 0), iv(T, 'mud', 2)] },
      true,
    ).trace;
    if (!plain || !forked) throw new Error('no trace');
    const before = (fs: typeof plain.frames) => fs.filter((f) => f.t <= T * DT + 1e-9);
    expect(before(forked.frames)).toEqual(before(plain.frames));
    expect(forked.frames).not.toEqual(plain.frames);
  });
});

/** Field clamps of RENEWAL-1.0 §10.1, mirrored independently of the engine. */
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const accOf = (b: number, p: number): number =>
  Math.min(CONSTANTS.maxAccuracy, clamp(b * p, ...TRAIT_BOUNDS.strikeAccuracy));
const sprintOf = (b: number, p: number): number => clamp(b * p, ...TRAIT_BOUNDS.sprintSpeed);
const turnOf = (b: number, p: number): number =>
  clamp(
    b * p,
    TRAIT_BOUNDS.turnRate[0] * (Math.PI / 180),
    TRAIT_BOUNDS.turnRate[1] * (Math.PI / 180),
  );

/**
 * Per-agent check over consecutive inspected ticks. Every event tick is inspected, so between two
 * inspected ticks no trait changes: an agent incapacitated at a tick keeps its previous value, and
 * every other agent has `expected(base, side, tick)`.
 */
function expectTrait(
  snaps: Map<number, Snap>,
  ticks: readonly number[],
  key: 'acc' | 'sprint' | 'cruise' | 'turn' | 'hitDmg',
  expected: (base: Snap, i: number, side: number, tick: number) => number,
): { checked: number; frozen: number } {
  const base = at(snaps, ticks[0] as number);
  let prev = base;
  let checked = 0;
  let frozen = 0;
  for (const t of ticks) {
    const s = at(snaps, t);
    for (let i = 0; i < s.side.length; i++) {
      const v = s[key][i];
      if ((s.state[i] as number) >= FreeState.Dead) {
        expect(v, `${key}[${i}] at ${t} (incapacitated)`).toBe(prev[key][i]);
        frozen++;
      } else {
        const want = expected(base, i, s.side[i] as number, t);
        expect(v, `${key}[${i}] at ${t}`).toBe(want);
        checked++;
      }
    }
    prev = s;
  }
  return { checked, frozen };
}

describe('overlapping durations (RENEWAL-1.0 §10.1 worked example)', () => {
  it('Focus then Pitch dark inside its 20 s: acc is base × 1.2, × 1.2 × 0.8, then × 0.8', () => {
    const log = [iv(100, 'focus', 0), iv(150, 'pitch-dark', 2)];
    const ticks = [0, 99, 100, 120, 149, 150, 200, 299, 300, 400];
    const { snaps } = inspectRun(TREX, 0, log, ticks);
    const p = (side: number, t: number): number => {
      if (side === 0) {
        if (t < 100) return 1;
        if (t < 150) return 1.2;
        return t < 300 ? 1.2 * 0.8 : 0.8;
      }
      return t < 150 ? 1 : 0.8;
    };
    const { checked } = expectTrait(snaps, ticks, 'acc', (b, i, s, t) =>
      p(s, t) === 1 ? (b.acc[i] as number) : accOf(b.acc[i] as number, p(s, t)),
    );
    expect(checked).toBe(2 * ticks.length);
    // The values really move: before, inside and after the overlap differ for side A.
    const a0 = [99, 120, 200, 400].map((t) => at(snaps, t).acc[0]);
    expect(new Set(a0).size).toBe(4);
    // Other traits are untouched.
    for (const t of ticks) {
      expect(at(snaps, t).sprint).toEqual(at(snaps, 0).sprint);
      expect(at(snaps, t).hitDmg).toEqual(at(snaps, 0).hitDmg);
    }
  });

  it('Adrenaline then Mud: speed × 1.25, × 1.25 × 0.7, then × 0.7; turn × 0.8 from Mud', () => {
    const log = [iv(100, 'adrenaline', 0), iv(150, 'mud', 2)];
    const ticks = [0, 99, 100, 130, 149, 150, 200, 249, 250, 260, 400];
    const { snaps } = inspectRun(WOLVES, 0, log, ticks);
    const p = (side: number, t: number): number => {
      if (side === 0) {
        if (t < 100) return 1;
        if (t < 150) return 1.25;
        return t < 250 ? 1.25 * 0.7 : 0.7;
      }
      return t < 150 ? 1 : 0.7;
    };
    const speed = expectTrait(snaps, ticks, 'sprint', (b, i, s, t) =>
      p(s, t) === 1 ? (b.sprint[i] as number) : sprintOf(b.sprint[i] as number, p(s, t)),
    );
    expect(speed.checked).toBe(9 * ticks.length);
    expectTrait(snaps, ticks, 'cruise', (b, i, s, t) => {
      const c = b.cruise[i] as number;
      if (p(s, t) === 1) return c;
      const sp = sprintOf(b.sprint[i] as number, p(s, t));
      return Math.min(sp, clamp(c * p(s, t), ...TRAIT_BOUNDS.cruiseSpeed));
    });
    expectTrait(snaps, ticks, 'turn', (b, i, _s, t) =>
      t < 150 ? (b.turn[i] as number) : turnOf(b.turn[i] as number, 0.8),
    );
    const w0 = [99, 130, 200, 400].map((t) => at(snaps, t).sprint[0]);
    expect(new Set(w0).size).toBe(4);
  });

  it('never changes an incapacitated agent, and still slows a routed one', () => {
    // Late in a battle: with morale off agents fall, with morale on they rout or leave.
    const fallen = sanitizeFreeConfig({ ...WOLVES, morale: false });
    let down = 0;
    let routed = 0;
    for (const config of [fallen, WOLVES]) {
      const T = lateTick(config, 3);
      // The same run without the cards is identical up to the start of tick T.
      const before = at(inspectRun(config, 3, [], [T]).snaps, T);
      const { snaps } = inspectRun(config, 3, [iv(T, 'mud', 2), iv(T, 'regroup', 0)], [0, T]);
      const after = at(snaps, T);
      for (let i = 0; i < before.side.length; i++) {
        const st = before.state[i] as number;
        if (st >= FreeState.Dead) {
          down++;
          for (const k of ['sprint', 'cruise', 'turn', 'hp', 'maxHp', 'stamina'] as const) {
            expect(after[k][i], `${k}[${i}]`).toBe(before[k][i]);
          }
        } else {
          expect(after.sprint[i]).toBe(sprintOf(at(snaps, 0).sprint[i] as number, 0.7));
          if (st === FreeState.Routed) {
            routed++;
            expect(after.hp[i]).toBe(before.hp[i]);
          }
        }
      }
    }
    expect(down).toBeGreaterThan(0);
    expect(routed).toBeGreaterThan(0);
  });
});

describe('instant ops', () => {
  const T = 200;
  const RUN = 3;
  /**
   * State at the start of a late tick `t` of run 3 without the cards (identical up to `t`) and
   * with them; `log` maps `t` to the log.
   */
  const pair = (config: FreeConfig, log: (t: number) => Intervention[]) => {
    const t = lateTick(config, RUN);
    const pre = at(inspectRun(config, RUN, [], [t]).snaps, t);
    const post = at(inspectRun(config, RUN, log(t), [t]).snaps, t);
    return { pre, post };
  };
  const active = (s: Snap, i: number): boolean => (s.state[i] as number) < FreeState.Routed;

  it('regroup adds 15 % of maxHp to active agents of its side, never above maxHp', () => {
    const { pre, post } = pair(TREX, (t) => [iv(t, 'regroup', 0)]);
    expect(pre.hp[0]).toBeLessThan(pre.maxHp[0] as number);
    for (let i = 0; i < pre.side.length; i++) {
      const m = pre.maxHp[i] as number;
      const want =
        pre.side[i] === 0 && active(pre, i)
          ? Math.min(m, (pre.hp[i] as number) + 0.15 * m)
          : pre.hp[i];
      expect(post.hp[i]).toBe(want);
      expect(post.maxHp[i]).toBe(m);
    }
  });

  it('heatwave halves stamina on both sides; second wind refills one side', () => {
    const { pre, post } = pair(WOLVES, (t) => [iv(t, 'heatwave', 2), iv(t, 'second-wind', 1)]);
    for (let i = 0; i < pre.side.length; i++) {
      const s0 = pre.stamina[i] as number;
      let want = s0;
      if (active(pre, i)) want = pre.side[i] === 1 ? 1 : clamp(s0 * 0.5, 0, 1);
      expect(post.stamina[i], `stamina[${i}]`).toBe(want);
    }
  });

  it('rallying cry and shaken add ±0.2 morale, clamped to [0, 1]', () => {
    const { pre, post } = pair(WOLVES, (t) => [iv(t, 'rallying-cry', 0), iv(t, 'shaken', 1)]);
    for (let i = 0; i < pre.side.length; i++) {
      const m = pre.morale[i] as number;
      const want = !active(pre, i) ? m : clamp(m + (pre.side[i] === 0 ? 0.2 : -0.2), 0, 1);
      expect(post.morale[i], `morale[${i}]`).toBe(want);
    }
  });

  it('giant scales maxHp then hp by 1.5; pocket by 0.6; hp never exceeds maxHp', () => {
    const { pre, post } = pair(TREX, (t) => [iv(t, 'giant', 0), iv(t, 'pocket', 1)]);
    for (const [i, k] of [
      [0, 1.5],
      [1, 0.6],
    ] as const) {
      expect(post.maxHp[i]).toBe((pre.maxHp[i] as number) * k);
      expect(post.hp[i]).toBe(Math.min(post.maxHp[i] as number, (pre.hp[i] as number) * k));
      expect(post.hp[i]).toBeLessThanOrEqual(post.maxHp[i] as number);
    }
    expect(post.hitDmg[0]).toBe((pre.hitDmg[0] as number) * 1.5);
    expect(post.sprint[0]).toBe(sprintOf(pre.sprint[0] as number, 0.85));
    expect(post.sprint[1]).toBe(sprintOf(pre.sprint[1] as number, 1.3));
  });

  it('are never undone: a later tick still holds the changed value or less', () => {
    const { snaps } = inspectRun(TREX, 0, [iv(T, 'giant', 0)], [T - 1, T, T + 100]);
    expect(at(snaps, T + 100).maxHp[0]).toBe(at(snaps, T).maxHp[0]);
    expect(at(snaps, T).maxHp[0]).toBe((at(snaps, T - 1).maxHp[0] as number) * 1.5);
  });
});

describe('clamps', () => {
  it('caps a stacked multiplier at 2 and 0.5, then the field bounds', () => {
    const log = [
      iv(10, 'giant', 0),
      iv(10, 'power-surge', 0),
      iv(10, 'power-surge', 0),
      iv(10, 'mud', 2),
      iv(10, 'mud', 2),
      iv(10, 'downpour', 2),
    ];
    const { snaps } = inspectRun(TREX, 0, log, [0, 10, 209, 210]);
    const b = at(snaps, 0);
    const s = at(snaps, 10);
    expect(s.hitDmg[0]).toBe((b.hitDmg[0] as number) * 2);
    expect(s.hitDmg[1]).toBe(b.hitDmg[1]);
    for (const i of [0, 1]) expect(s.sprint[i]).toBe(sprintOf(b.sprint[i] as number, 0.5));
    // Both power surges expire after 20 s: giant's ×1.5 alone remains.
    expect(at(snaps, 209).hitDmg[0]).toBe((b.hitDmg[0] as number) * 2);
    expect(at(snaps, 210).hitDmg[0]).toBe((b.hitDmg[0] as number) * 1.5);
  });

  it('caps accuracy at maxAccuracy and restores the base exactly when Focus ends', () => {
    const sharp = configOf({
      runs: 2,
      individualCV: 0,
      sides: [
        { species: 'trex', params: { strikeAccuracy: { min: 0.9, mode: 0.9, max: 0.9 } } },
        { species: 'trex', params: { strikeAccuracy: { min: 0.98, mode: 0.98, max: 0.98 } } },
      ],
    });
    const { snaps } = inspectRun(sharp, 0, [iv(10, 'focus', 0), iv(10, 'focus', 1)], [0, 10, 210]);
    expect(at(snaps, 0).acc).toEqual([0.9, 0.98]);
    expect(at(snaps, 10).acc).toEqual([CONSTANTS.maxAccuracy, CONSTANTS.maxAccuracy]);
    // No op active: the base comes back bit for bit, even above maxAccuracy.
    expect(at(snaps, 210).acc).toEqual([0.9, 0.98]);
  });
});

// --- golden fixture: fixed logs → fixed summaries -------------------------------------------

const FIXTURE = new URL('./fixtures/free-v3-interventions-golden.json', import.meta.url);

const CASES: {
  name: string;
  input: Record<string, unknown>;
  log: [number, CardId, InterventionSide][];
}[] = [
  {
    name: 'trex 1 v trex 1, Focus then Pitch dark inside its 20 s',
    input: { runs: 12, sides: [{ species: 'trex' }, { species: 'trex' }] },
    log: [
      [100, 'focus', 0],
      [150, 'pitch-dark', 2],
    ],
  },
  {
    name: 'wolf 8 v brownBear 1, Adrenaline then Mud',
    input: {
      runs: 12,
      sides: [
        { species: 'wolf', count: 8 },
        { species: 'brownBear', count: 1 },
      ],
    },
    log: [
      [100, 'adrenaline', 0],
      [150, 'mud', 2],
    ],
  },
  {
    name: 'lion 4 v tiger 2, instant cards',
    input: {
      runs: 12,
      sides: [
        { species: 'lion', count: 4 },
        { species: 'tiger', count: 2 },
      ],
    },
    log: [
      [30, 'heatwave', 2],
      [40, 'second-wind', 1],
      [50, 'rallying-cry', 0],
      [50, 'shaken', 1],
      [80, 'regroup', 0],
    ],
  },
  {
    name: 'tiger 3 v lion 3, every trait card and the what-if pack',
    input: {
      runs: 12,
      sides: [
        { species: 'tiger', count: 3 },
        { species: 'lion', count: 3 },
      ],
    },
    log: [
      [0, 'giant', 1],
      [0, 'pocket', 0],
      [20, 'downpour', 2],
      [40, 'power-surge', 0],
      [60, 'agitation', 1],
      [70, 'focus', 1],
      [90, 'adrenaline', 0],
      [100, 'mud', 2],
    ],
  },
];

const fnv = (h: number, bytes: Uint8Array): number => {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ (bytes[k] as number), 0x01000193);
  return h >>> 0;
};
const hex = (h: number): string => h.toString(16).padStart(8, '0');
const bytesOf = (a: ArrayBufferView): Uint8Array =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

const row = (s: FreeRunSummary): number[] => [
  s.run,
  s.outcome,
  s.duration,
  s.aAlive,
  s.aKilled,
  s.aRouted,
  s.aActive,
  s.bAlive,
  s.bKilled,
  s.bRouted,
  s.bActive,
  s.aHpFrac,
  s.bHpFrac,
  s.advantage,
];

interface Captured {
  name: string;
  input: Record<string, unknown>;
  log: [number, number, number][];
  summaries: number[][];
  trace: { run: number; frames: number; framesHash: string };
}

function capture(c: (typeof CASES)[number]): Captured {
  const config = sanitizeFreeConfig(c.input);
  const design = buildFreeDesign(config);
  const log = c.log.map(([t, id, s]) => iv(t, id, s));
  const summaries: number[][] = [];
  for (let r = 0; r < config.runs; r++) {
    summaries.push(
      row(
        simulateFreeBattle(config, designRow(design, r), r, false, { interventions: log }).summary,
      ),
    );
  }
  const { trace } = simulateFreeBattle(config, designRow(design, 0), 0, true, {
    interventions: log,
  });
  if (!trace) throw new Error('no trace');
  let fh = 0x811c9dc5;
  const t = new Float64Array(1);
  for (const f of trace.frames) {
    t[0] = f.t;
    fh = fnv(fh, bytesOf(t));
    fh = fnv(fh, bytesOf(f.agents));
  }
  return {
    name: c.name,
    input: c.input,
    log: log.map((e) => [e.tick, e.card, e.side]),
    summaries,
    trace: { run: 0, frames: trace.frames.length, framesHash: hex(fh) },
  };
}

if (process.env['CAPTURE_INTERVENTIONS_GOLDEN'] && !existsSync(FIXTURE)) {
  writeFileSync(
    FIXTURE,
    `${JSON.stringify({ capturedFrom: process.env['CAPTURE_INTERVENTIONS_GOLDEN'], cases: CASES.map(capture) }, null, 1)}\n`,
  );
}

describe('intervention golden (tests/fixtures/free-v3-interventions-golden.json)', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { cases: Captured[] };

  it('covers every case', () => {
    expect(fixture.cases.map((c) => c.name)).toEqual(CASES.map((c) => c.name));
  });

  for (const c of CASES) {
    it(c.name, () => {
      const g = fixture.cases.find((x) => x.name === c.name);
      expect(capture(c)).toEqual(g);
    });
  }

  it('differs from the same runs without the log', () => {
    for (const c of CASES) {
      const config = sanitizeFreeConfig(c.input);
      const design = buildFreeDesign(config);
      const g = fixture.cases.find((x) => x.name === c.name) as Captured;
      const plain = Array.from({ length: config.runs }, (_, r) =>
        row(simulateFreeBattle(config, designRow(design, r), r).summary),
      );
      expect(g.summaries, c.name).not.toEqual(plain);
    }
  });
});
