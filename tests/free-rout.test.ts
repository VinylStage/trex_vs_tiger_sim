import { describe, expect, it } from 'vitest';
import { ROUT_NOTICE_SHARE, aggregateFree, routNotice, routShare } from '../src/sim/free/aggregate';
import { PACK_BUFF_EFFECTS, defaultSide, sanitizeFreeConfig } from '../src/sim/free/config';
import { FreeOutcome, emptyBuffStats, type FreeRunSummary } from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { FREE_SPECIES, type FreeSpeciesId } from '../src/sim/free/species';

/** Rout share and the still standing / fled / incapacitated breakdown of free results (#42). */

function run(
  outcome: number,
  a: [killed: number, routed: number, active: number],
  b: [killed: number, routed: number, active: number],
): FreeRunSummary {
  return {
    run: 0,
    outcome: outcome as FreeRunSummary['outcome'],
    duration: 10,
    aAlive: a[1] + a[2],
    aKilled: a[0],
    aRouted: a[1],
    aActive: a[2],
    bAlive: b[1] + b[2],
    bKilled: b[0],
    bRouted: b[1],
    bActive: b[2],
    aHpFrac: 0,
    bHpFrac: 0,
    advantage: 0,
    buffA: emptyBuffStats(),
    buffB: emptyBuffStats(),
  };
}

describe('routShare', () => {
  it("pools the loser's fled ÷ (fled + incapacitated) over decided runs", () => {
    const runs = [
      run(FreeOutcome.A, [0, 0, 5], [2, 8, 0]),
      run(FreeOutcome.B, [3, 1, 0], [0, 0, 10]),
    ];
    expect(routShare(runs)).toBeCloseTo(9 / 14, 12);
  });

  it('filters by the side that lost', () => {
    const runs = [
      run(FreeOutcome.A, [0, 0, 5], [2, 8, 0]),
      run(FreeOutcome.B, [3, 1, 0], [0, 0, 10]),
    ];
    expect(routShare(runs, 1)).toBeCloseTo(0.8, 12);
    expect(routShare(runs, 0)).toBeCloseTo(0.25, 12);
  });

  it('ignores draws and is NaN without a decided run or a loser out of the fight', () => {
    const draw = run(FreeOutcome.Draw, [1, 1, 1], [1, 1, 1]);
    expect(routShare([draw, run(FreeOutcome.A, [0, 0, 1], [1, 0, 0])])).toBe(0);
    expect(routShare([draw])).toBeNaN();
    expect(routShare([])).toBeNaN();
    expect(routShare([run(FreeOutcome.A, [0, 0, 1], [1, 0, 0])], 0)).toBeNaN();
  });

  it('agrees with a real batch, whose loser always has nobody active left', () => {
    const c = sanitizeFreeConfig({ runs: 24, seed: 7 });
    c.sides = [defaultSide('wolf', 6), defaultSide('brownBear', 1)];
    const cfg = sanitizeFreeConfig(c);
    const { summaries } = runAllFree(cfg);
    let fled = 0;
    let out = 0;
    for (const s of summaries) {
      if (s.outcome === FreeOutcome.Draw) continue;
      const lostA = s.outcome === FreeOutcome.B;
      expect(lostA ? s.aActive : s.bActive).toBe(0);
      fled += lostA ? s.aRouted : s.bRouted;
      out += lostA ? s.aRouted + s.aKilled : s.bRouted + s.bKilled;
    }
    expect(routShare(summaries)).toBe(fled / out);
  });
});

describe('still standing / fled / incapacitated', () => {
  it('adds up to the head count of each side, per run and on average', () => {
    const c = sanitizeFreeConfig({ runs: 20, seed: 3 });
    c.sides = [defaultSide('lion', 5), defaultSide('tiger', 5)];
    const cfg = sanitizeFreeConfig(c);
    const { summaries } = runAllFree(cfg);
    for (const s of summaries) {
      expect(s.aActive + s.aRouted + s.aKilled).toBe(5);
      expect(s.bActive + s.bRouted + s.bKilled).toBe(5);
    }
    const agg = aggregateFree(cfg, summaries);
    for (const side of [agg.a, agg.b]) {
      expect(side.active + side.routed + side.killed).toBeCloseTo(5, 9);
    }
  });
});

describe('routNotice', () => {
  const sides = (a: FreeSpeciesId, na: number, b: FreeSpeciesId, nb: number, runs?: number) => {
    const c = sanitizeFreeConfig(runs === undefined ? {} : { runs });
    c.sides = [defaultSide(a, na), defaultSide(b, nb)];
    return sanitizeFreeConfig(c);
  };
  const config = (na: number, nb: number) => sides('lion', na, 'elephant', nb);
  /** Side B wins every run; side A (30) loses with `fled` fled and the rest incapacitated. */
  const lostA = (fled: number): FreeRunSummary[] => [
    run(FreeOutcome.B, [30 - fled, fled, 0], [0, 0, 5]),
    run(FreeOutcome.B, [30 - fled, fled, 0], [0, 0, 5]),
  ];

  it('points out the losing group from the documented share on', () => {
    expect(ROUT_NOTICE_SHARE).toBe(0.8);
    expect(routNotice(config(30, 5), { aWins: 0, bWins: 2 }, lostA(24))).toEqual({
      side: 0,
      share: 0.8,
    });
    expect(routNotice(config(30, 5), { aWins: 0, bWins: 2 }, lostA(23))).toBeNull();
  });

  it('says nothing for a side of one, on equal wins, or without a lost run', () => {
    const duel = [run(FreeOutcome.B, [0, 1, 0], [0, 0, 1])];
    expect(routNotice(config(1, 1), { aWins: 0, bWins: 1 }, duel)).toBeNull();
    expect(routNotice(config(30, 5), { aWins: 1, bWins: 1 }, lostA(30))).toBeNull();
    expect(routNotice(config(30, 5), { aWins: 0, bWins: 0 }, [])).toBeNull();
    expect(routNotice(config(30, 5), { aWins: 2, bWins: 0 }, lostA(30))).toBeNull();
  });

  it('fires for 30 lions against 5 elephants, the case the smoke test opens', () => {
    const c = sanitizeFreeConfig({ runs: 40 });
    c.sides = [defaultSide('lion', 30), defaultSide('elephant', 5)];
    const cfg = sanitizeFreeConfig(c);
    const { summaries } = runAllFree(cfg);
    const agg = aggregateFree(cfg, summaries);
    expect(routNotice(cfg, agg, summaries)?.side).toBe(0);
  });

  it('says nothing for solitary animals that each withdraw: tigers share no morale', () => {
    const allFled: FreeRunSummary[] = [run(FreeOutcome.A, [0, 0, 5], [0, 5, 0])];
    expect(FREE_SPECIES.tiger.social).toBe(false);
    expect(routNotice(sides('lion', 5, 'tiger', 5), { aWins: 1, bWins: 0 }, allFled)).toBeNull();
    const lionsFled: FreeRunSummary[] = [run(FreeOutcome.B, [0, 5, 0], [0, 0, 5])];
    expect(routNotice(sides('lion', 5, 'tiger', 5), { aWins: 0, bWins: 1 }, lionsFled)).toEqual({
      side: 0,
      share: 1,
    });
  });

  it('needs the morale contagion: off with morale or the pack buff morale effect off', () => {
    const lost = { aWins: 0, bWins: 2 };
    const noBuffMorale = config(30, 5);
    noBuffMorale.packBuff.morale = false;
    expect(routNotice(noBuffMorale, lost, lostA(30))).toBeNull();
    const noMorale = config(30, 5);
    noMorale.morale = false;
    expect(routNotice(noMorale, lost, lostA(30))).toBeNull();
    const onlyMorale = config(30, 5);
    for (const e of PACK_BUFF_EFFECTS) onlyMorale.packBuff[e] = e === 'morale';
    expect(routNotice(onlyMorale, lost, lostA(30))?.side).toBe(0);
  });

  it('5 lions vs 5 tigers: the tigers lose more runs and nearly all flee, with no notice', () => {
    const cfg = sides('lion', 5, 'tiger', 5, 60);
    const { summaries } = runAllFree(cfg);
    const agg = aggregateFree(cfg, summaries);
    expect(agg.bWins).toBeLessThan(agg.aWins);
    expect(routShare(summaries, 1)).toBeGreaterThanOrEqual(ROUT_NOTICE_SHARE);
    expect(routNotice(cfg, agg, summaries)).toBeNull();
  });

  it('3 lions vs 10 hyenas: the losing pride breaks, and only with the morale effect on', () => {
    const cfg = sides('lion', 3, 'hyena', 10, 40);
    const { summaries } = runAllFree(cfg);
    const agg = aggregateFree(cfg, summaries);
    const notice = routNotice(cfg, agg, summaries);
    expect(notice?.side).toBe(0);
    expect(notice?.share).toBe(routShare(summaries, 0));
    // Without the contagion the lions still lose and flee, each on its own morale: no notice.
    cfg.packBuff.morale = false;
    const solo = runAllFree(cfg).summaries;
    const soloAgg = aggregateFree(cfg, solo);
    expect(soloAgg.aWins).toBeLessThan(soloAgg.bWins);
    expect(routShare(solo, 0)).toBeGreaterThanOrEqual(ROUT_NOTICE_SHARE);
    expect(routNotice(cfg, soloAgg, solo)).toBeNull();
  });
});
