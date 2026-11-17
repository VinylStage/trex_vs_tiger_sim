import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';
import {
  DEFAULT_C_OBS,
  NEAR_CHECKPOINTS,
  PAUSE_SHARE,
  RESIM_LIMIT_MS,
  WHATIF_RUNS,
  gateMessageKey,
  pauseGate,
  pauseWorkMs,
  planLiveCards,
  preBattleGate,
  resimGate,
  type GateInput,
  type GateNote,
  type LivePlan,
} from '../src/ui/live-gates';
import { bannedIn } from './banned-words';

/*
 * The live-card gates (#181, RENEWAL-1.0 §10.2 point 5, R6). Every input is a measurement passed
 * in, so the decisions are table-driven and never depend on this machine's clock.
 */

/** §10.2's example streamer PC: 2 batch workers, c_obs 1.3, a 15 s pause, a 30 s prediction. */
const PC: Omit<GateInput, 'liveSimMs' | 'msPerRun'> = {
  cObs: 1.3,
  batchWorkers: 2,
  pauseMs: 15_000,
  predictionMs: 30_000,
  checkpointsAfter: 5,
  branches: 32,
};

const at = (liveSimMs: number, msPerRun: number, extra: Partial<GateInput> = {}): GateInput => ({
  ...PC,
  liveSimMs,
  msPerRun,
  ...extra,
});

describe('gate (a): re-simulation', () => {
  it.each([
    [0, true],
    [100, true],
    [333.33, true],
    [RESIM_LIMIT_MS / 1.5, true],
    [334, false],
    [500, false],
    [NaN, false],
    [-1, false],
    [Infinity, false],
  ])('liveSimMs %s → %s', (ms, ok) => {
    expect(resimGate(ms)).toBe(ok);
  });
});

describe('pre-battle cards: 50 % of the prediction window', () => {
  it.each([
    [5_000, 30_000, true],
    [10_000, 30_000, true],
    [10_001, 30_000, false],
    [600, 0, false],
    [600, NaN, false],
  ])('liveSimMs %s, window %s → %s', (ms, win, ok) => {
    expect(preBattleGate(ms, win)).toBe(ok);
  });
});

describe('gate (b): card-pause budget', () => {
  it('is (3N + checkpoints × B) × ms × c_obs ÷ workers', () => {
    const input = at(100, 10);
    // N = 100: W₁ = 300, W₂ = 5 × 32 = 160 → 460 × 10 × 1.3 ÷ 2 = 2,990 ms.
    expect(pauseWorkMs(300 + 160, input)).toBeCloseTo(2990, 9);
    expect(pauseGate(100, 5, input)).toBe(true);
    // 0.8 × 15 s = 12 s holds at most 12,000 × 2 ÷ (10 × 1.3) ≈ 1,846 runs.
    expect(pauseGate(560, 5, input)).toBe(true); // 1,840 runs
    expect(pauseGate(563, 5, input)).toBe(false); // 1,849 runs
  });

  it('takes the default OBS factor when none was measured, and never less than 1', () => {
    const rest: GateInput = at(100, 10);
    delete rest.cObs;
    expect(pauseWorkMs(100, rest)).toBeCloseTo((100 * 10 * DEFAULT_C_OBS) / 2, 9);
    expect(pauseWorkMs(100, at(100, 10, { cObs: 0.5 }))).toBeCloseTo((100 * 10) / 2, 9);
  });

  it('treats a bad worker count as one worker and a bad cost as free', () => {
    expect(pauseWorkMs(10, at(1, 10, { batchWorkers: 0 }))).toBeCloseTo(130, 9);
    expect(pauseWorkMs(10, at(1, NaN))).toBe(0);
  });
});

describe('planLiveCards: degradation order', () => {
  const plan = (p: LivePlan): [string, number | null, string, GateNote] => [
    p.mode,
    p.whatIfRuns,
    p.chance,
    p.note,
  ];

  // §10.2's example table: matchup, ms per run (taken as the live run's cost too).
  it.each([
    ['1 tiger v 1 lion', 1.93, 1.93, ['live', 200, 'all', 'ok']],
    ['1 brown bear v 8 wolves', 6.97, 6.97, ['live', 200, 'all', 'ok']],
    ['1 elephant v 6 lions', 10.87, 10.87, ['live', 200, 'all', 'ok']],
    // 33.6 ms: N = 200 → (600 + 160) × 33.6 × 1.3 / 2 ≈ 16.6 s > 12 s; N = 100 ≈ 10 s fits.
    ['10 T. rex v 100 tigers', 33.6, 33.6, ['live', 100, 'all', 'reduced']],
    // A heavy run still under gate (a): N = 50 with 5 checkpoints is 310 runs, too much, then
    // 50 with the next 2 (214 runs) fits.
    ['heavy, next 2 checkpoints', 70, 300, ['live', 50, 'near', 'reduced']],
    // Even N = 50 and 2 checkpoints do not fit: numbers dropped, bar falls back.
    ['heavy, no what-if', 200, 300, ['live', null, 'strength', 'noWhatIf']],
    // 1,000 wolves v 50 mammoths at 591 ms: gate (a) fails (887 ms with the factor).
    ['1,000 wolves v 50 mammoths', 591, 591, ['preBattle', null, 'strength', 'preBattle']],
    // A run of 12 s does not fit half of a 30 s prediction window either.
    ['huge', 12_000, 12_000, ['none', null, 'strength', 'noCards']],
  ] as const)('%s', (_name, msPerRun, liveSimMs, want) => {
    expect(plan(planLiveCards(at(liveSimMs, msPerRun)))).toEqual(want);
  });

  it('tries N = 200, 100, 50 in that order before cutting checkpoints', () => {
    const seen: number[] = [];
    // Shrink the pause until each step is the first that fits.
    for (let pauseMs = 40_000; pauseMs > 0; pauseMs -= 250) {
      const p = planLiveCards(at(100, 20, { pauseMs }));
      const step =
        p.whatIfRuns === null
          ? 4
          : p.chance === 'near'
            ? 3
            : WHATIF_RUNS.indexOf(p.whatIfRuns as 200);
      if (seen.at(-1) !== step) seen.push(step);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps every checkpoint when there are no more than the next two', () => {
    const p = planLiveCards(at(100, 1, { checkpointsAfter: NEAR_CHECKPOINTS }));
    expect(p).toMatchObject({ mode: 'live', whatIfRuns: 200, chance: 'all' });
  });

  it('never exceeds the pause share when it keeps numbers', () => {
    for (const ms of [0.5, 2, 8, 20, 40, 80, 160]) {
      for (const k of [0, 1, 3, 8]) {
        const input = at(100, ms, { checkpointsAfter: k });
        const p = planLiveCards(input);
        if (p.mode !== 'live' || p.whatIfRuns === null) continue;
        const cps = p.chance === 'near' ? Math.min(k, NEAR_CHECKPOINTS) : k;
        const work = pauseWorkMs(3 * p.whatIfRuns + cps * input.branches, input);
        expect(work).toBeLessThanOrEqual(PAUSE_SHARE * input.pauseMs);
      }
    }
  });

  it('decides from gate (a) alone when the live run is too slow', () => {
    // Pause budget irrelevant: a free pause cannot save a slow re-simulation.
    expect(planLiveCards(at(400, 0.001)).mode).toBe('preBattle');
    expect(planLiveCards(at(400, 0.001, { predictionMs: 1000 })).mode).toBe('none');
  });
});

describe('gate messages', () => {
  it('maps notes to ko/en keys, and says nothing when it all fits or only shrank', () => {
    expect(gateMessageKey('ok')).toBeNull();
    expect(gateMessageKey('reduced')).toBeNull();
    expect(ko[gateMessageKey('noWhatIf') as keyof typeof ko]).toBe(
      '효과 계산 생략: 대결 규모가 큼',
    );
    expect(ko[gateMessageKey('preBattle') as keyof typeof ko]).toBe(
      '대결 규모가 커서 출전 전 변수만 씁니다',
    );
    for (const note of ['noWhatIf', 'preBattle', 'noCards'] as const) {
      const key = gateMessageKey(note) as keyof typeof ko;
      for (const text of [ko[key], en[key]]) {
        expect(text.length).toBeGreaterThan(0);
        expect(bannedIn(text)).toBeNull();
      }
    }
  });
});
