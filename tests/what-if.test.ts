import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';
import { CARD_IDS, type CardId } from '../src/sim/free/cards';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import { FreeOutcome, type FreeRunSummary } from '../src/sim/free/engine';
import { runFreeChunk } from '../src/sim/free/montecarlo';
import { setLang } from '../src/ui/i18n';
import { CancelledError, Priority, Scheduler, type WorkerLike } from '../src/ui/scheduler';
import {
  CARD_SWING_PP,
  WHATIF_DESIGN_RUNS,
  countWins,
  submitWhatIf,
  submitWhatIfBaseline,
  whatIfConfig,
  whatIfOptions,
  whatIfShift,
  whatIfText,
  type WhatIfOption,
  type WinCounts,
} from '../src/ui/what-if';
import type { WorkerRequest } from '../src/workers/protocol';
import { bannedIn } from './banned-words';

/*
 * What-if shift of the offered cards (#182, RENEWAL-1.0 §10.2 point 3): the options and their
 * run split, the paired counts, the swing threshold, the label that always carries N, and the
 * P1 job against a fake worker that runs the real engine.
 */

const code = (id: CardId): number => CARD_IDS.indexOf(id);

const config = sanitizeFreeConfig({
  runs: 7,
  seed: 5,
  sides: [
    { species: 'wolf', count: 6 },
    { species: 'tiger', count: 1 },
  ],
});

const counts = (a: number, b: number, draw: number): WinCounts => ({ a, b, draw, n: a + b + draw });

describe('what-if options', () => {
  it('gives a card on both sides all N runs and splits a one-side card between the sides', () => {
    const cards = [code('downpour'), code('focus'), code('mud')];
    expect(whatIfOptions(config.mv, cards, 101)).toEqual([
      { card: code('downpour'), side: 2, runs: 101 },
      { card: code('focus'), side: 0, runs: 51 },
      { card: code('focus'), side: 1, runs: 50 },
      { card: code('mud'), side: 2, runs: 101 },
    ]);
  });

  it('keeps the pause workload at 3 × N runs, as gate (b) counts it (#181)', () => {
    for (const cards of [
      [code('focus'), code('shaken'), code('regroup')],
      [code('downpour'), code('pitch-dark'), code('heatwave')],
    ]) {
      for (const n of [50, 100, 200]) {
        const runs = whatIfOptions(config.mv, cards, n).reduce((s, o) => s + o.runs, 0);
        expect(runs).toBe(3 * n);
      }
    }
  });

  it('skips unknown cards and N = 0', () => {
    expect(whatIfOptions(config.mv, [999, -1], 100)).toEqual([]);
    expect(whatIfOptions(config.mv, [code('focus')], 0)).toEqual([]);
    expect(whatIfOptions(99, [code('focus')], 100)).toEqual([]);
  });

  it('runs every N on the same fixed design, so a smaller N reuses the same runs', () => {
    expect(whatIfConfig(config).runs).toBe(WHATIF_DESIGN_RUNS);
    expect({ ...whatIfConfig(config), runs: config.runs }).toEqual(config);
  });
});

describe('what-if shift', () => {
  const opt = (side: 0 | 1 | 2): WhatIfOption => ({ card: code('focus'), side, runs: 100 });

  it('shows the side the card is played on, side A for a card on both', () => {
    const before = counts(40, 55, 5);
    const after = counts(60, 35, 5);
    expect(whatIfShift(opt(0), before, after)).toMatchObject({
      shownSide: 0,
      before: 0.4,
      after: 0.6,
      deltaPp: 20,
      swing: true,
      n: 100,
    });
    expect(whatIfShift(opt(1), before, after)).toMatchObject({
      shownSide: 1,
      deltaPp: -20,
      swing: true,
    });
    expect(whatIfShift(opt(2), before, after).shownSide).toBe(0);
  });

  it('marks a card swing from 15 points, in either direction', () => {
    expect(CARD_SWING_PP).toBe(15);
    const at = (a: number): boolean =>
      whatIfShift(opt(0), counts(400, 600, 0), counts(a, 1000 - a, 0)).swing;
    expect(at(550)).toBe(true);
    expect(at(549)).toBe(false);
    expect(at(250)).toBe(true);
    expect(at(251)).toBe(false);
  });

  it('counts wins, side B wins and draws of the first n runs', () => {
    const s = (outcome: number): FreeRunSummary => ({ outcome }) as FreeRunSummary;
    const list = [s(FreeOutcome.A), s(FreeOutcome.B), s(FreeOutcome.Draw), s(FreeOutcome.A)];
    expect(countWins(list)).toEqual(counts(2, 1, 1));
    expect(countWins(list, 2)).toEqual(counts(1, 1, 0));
  });
});

describe('what-if text', () => {
  const shift = whatIfShift(
    { card: code('focus'), side: 1, runs: 50 },
    counts(30, 18, 2),
    counts(20, 28, 2),
  );

  it('always carries N and says the numbers are not about the battle on screen', async () => {
    await setLang('ko');
    const ko1 = whatIfText(shift, '호랑이');
    expect(ko1.basis).toBe('같은 대결 50판 기준 · 지금 전황과는 별개');
    expect(ko1.line).toBe('호랑이 승률 36% → 56% (+20%p)');
    expect(ko1.swing).toBe('판도 변화');
    await setLang('en');
    const en1 = whatIfText(shift, 'Tiger');
    expect(en1.basis).toBe('Based on 50 battles of this matchup, not on the battle on screen');
    expect(en1.line).toBe('Tiger win share 36% → 56% (+20 pp)');
    expect(en1.swing).toBe('Card swing');
    await setLang('ko');
    for (const n of [1, 25, 100, 200]) {
      expect(whatIfText({ ...shift, n }, 'x').basis).toContain(String(n));
    }
  });

  it('shows a fall with a minus sign and no swing below the threshold', async () => {
    await setLang('ko');
    const down = whatIfShift(
      { card: code('shaken'), side: 0, runs: 100 },
      counts(50, 50, 0),
      counts(45, 55, 0),
    );
    const text = whatIfText(down, '늑대');
    expect(text.line).toBe('늑대 승률 50% → 45% (−5%p)');
    expect(text.swing).toBeNull();
  });

  it('uses no banned words in either language', () => {
    for (const key of ['whatIf.basis', 'whatIf.line', 'whatIf.swing'] as const) {
      expect(bannedIn(ko[key])).toBeNull();
      expect(bannedIn(en[key])).toBeNull();
    }
  });
});

/** Workers that run each `run` message on the real engine and answer asynchronously. */
function computing(size: number) {
  const posted: WorkerRequest[] = [];
  const scheduler = new Scheduler(size, () => {
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(msg: WorkerRequest) {
        posted.push(msg);
        if (msg.type !== 'run' || !('mode' in msg.config))
          throw new Error(`unexpected ${msg.type}`);
        const c = sanitizeFreeConfig(msg.config);
        const summaries = runFreeChunk(
          c,
          buildFreeDesign(c),
          msg.start,
          msg.end,
          undefined,
          msg.interventions ?? [],
        );
        setTimeout(() =>
          w.onmessage?.({ data: { type: 'result', jobId: msg.jobId, summaries } } as never),
        );
      },
      terminate: () => undefined,
    };
    return w;
  });
  return { scheduler, posted };
}

describe('what-if job (P1)', () => {
  const TICK = 40;
  const N = 12;
  const cards = [code('downpour'), code('power-surge')];

  it('plays each card at the pause tick on the same runs as the baseline', async () => {
    const { scheduler, posted } = computing(3);
    const baseline = await submitWhatIfBaseline(scheduler, config, N).promise;
    expect(baseline).toHaveLength(N);
    const options = whatIfOptions(config.mv, cards, N);
    const shifts = await submitWhatIf(scheduler, { config, tick: TICK, options }, baseline).promise;
    // Direct engine runs of the same design, with and without each card.
    const wc = whatIfConfig(config);
    const design = buildFreeDesign(wc);
    const plain = runFreeChunk(wc, design, 0, N);
    expect(baseline).toEqual(plain);
    options.forEach((o, i) => {
      const iv = [{ tick: TICK, card: o.card, side: o.side }];
      const after = runFreeChunk(wc, design, 0, o.runs, undefined, iv);
      expect(shifts[i]).toEqual(whatIfShift(o, countWins(plain, o.runs), countWins(after)));
    });
    // Every what-if message carries the card at the pause tick and the fixed design size.
    const runs = posted.filter((m) => m.type === 'run' && (m.interventions?.length ?? 0) > 0);
    expect(runs.length).toBeGreaterThan(0);
    for (const m of runs) {
      if (m.type !== 'run') continue;
      expect(m.config.runs).toBe(WHATIF_DESIGN_RUNS);
      expect(m.interventions?.[0]?.tick).toBe(TICK);
    }
    scheduler.dispose();
  });

  it('gives the same shifts on 1 and 3 workers', async () => {
    const options = whatIfOptions(config.mv, cards, N);
    const run = async (size: number) => {
      const { scheduler } = computing(size);
      const base = await submitWhatIfBaseline(scheduler, config, N).promise;
      const out = await submitWhatIf(scheduler, { config, tick: TICK, options }, base).promise;
      scheduler.dispose();
      return out;
    };
    expect(await run(1)).toEqual(await run(3));
  });

  it('rejects with CancelledError when cancelled, and runs ahead of live chance', async () => {
    const { scheduler } = computing(1);
    const base = await submitWhatIfBaseline(scheduler, config, N, Priority.LiveChance).promise;
    const job = submitWhatIf(
      scheduler,
      { config, tick: TICK, options: whatIfOptions(config.mv, cards, N) },
      base,
    );
    job.cancel();
    await expect(job.promise).rejects.toBeInstanceOf(CancelledError);
    scheduler.dispose();
  });
});
