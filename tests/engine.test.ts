import { describe, expect, it } from 'vitest';
import { defaultConfig, sanitizeConfig, type ScenarioConfig } from '../src/sim/config';
import { Outcome, simulateBattle } from '../src/sim/engine';
import { aggregate, runChunk } from '../src/sim/montecarlo';
import { buildDesign, designRow } from '../src/sim/sampling';
import { HEAVY_SPECIES, PACK_SPECIES, speciesRanges } from '../src/sim/species';
import { checkTrace, countRng } from './trace-helpers';

const small = (over: Partial<ScenarioConfig> = {}): ScenarioConfig => ({
  ...defaultConfig(),
  heavyCount: 2,
  packCount: 20,
  runs: 12,
  ...over,
});

describe('simulateBattle', () => {
  it('is deterministic for (seed, run)', () => {
    const c = small();
    const d = buildDesign(c);
    expect(simulateBattle(c, designRow(d, 3), 3)).toEqual(simulateBattle(c, designRow(d, 3), 3));
  });

  it('keeps summary invariants', () => {
    const c = small();
    const d = buildDesign(c);
    for (let run = 0; run < c.runs; run++) {
      const s = simulateBattle(c, designRow(d, run), run).summary;
      expect(s.duration).toBeGreaterThan(0);
      expect(s.duration).toBeLessThanOrEqual(c.maxTime + 1e-9);
      expect(s.packKilled + s.packRouted + s.packActive).toBe(c.packCount);
      expect(s.heavyAlive).toBeGreaterThanOrEqual(0);
      expect(s.heavyAlive).toBeLessThanOrEqual(c.heavyCount);
      expect(s.heavyHpFrac).toBeGreaterThanOrEqual(0);
      expect(s.heavyHpFrac).toBeLessThanOrEqual(1);
      if (s.outcome === Outcome.Heavy) expect(s.packActive).toBe(0);
      if (s.outcome === Outcome.Pack) expect(s.heavyAlive).toBe(0);
    }
  });

  it('records a trace ending at the battle duration', () => {
    const c = small({ heavyCount: 1, packCount: 5 });
    const d = buildDesign(c);
    const out = simulateBattle(c, designRow(d, 0), 0, true);
    const frames = out.trace?.frames ?? [];
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]?.heavy.length).toBe(4);
    expect(frames[0]?.pack.length).toBe(15);
    expect(frames.at(-1)?.t).toBeCloseTo(out.summary.duration, 6);
  });

  it('responds to tiger damage: overwhelming tigers beat a lone T-Rex', () => {
    const c = small({ heavyCount: 1, packCount: 200, runs: 6, morale: false });
    c.params['pack.dps'] = { min: 150, mode: 180, max: 200 };
    c.params['pack.latchChance'] = { min: 0.9, mode: 0.95, max: 1 };
    const d = buildDesign(c);
    const summaries = runChunk(c, d, 0, c.runs);
    expect(summaries.every((s) => s.outcome === Outcome.Pack)).toBe(true);
  });

  it('ends at maxTime with a draw when nobody can land an attack', () => {
    const c = small({ heavyCount: 1, packCount: 1, runs: 1, maxTime: 30, morale: false });
    c.params['pack.latchChance'] = { min: 0, mode: 0, max: 0 };
    c.params['heavy.biteAccuracy'] = { min: 0, mode: 0, max: 0 };
    const d = buildDesign(c);
    const s = simulateBattle(c, designRow(d, 0), 0).summary;
    expect(s.outcome).toBe(Outcome.Draw);
    expect(s.duration).toBeCloseTo(30, 6);
  });
});

describe('engine edge cases', () => {
  it('never reports a draw longer than maxTime', () => {
    const c = small({ heavyCount: 1, packCount: 1, runs: 1, maxTime: 30.1, morale: false });
    c.params['pack.latchChance'] = { min: 0, mode: 0, max: 0 };
    c.params['heavy.biteAccuracy'] = { min: 0, mode: 0, max: 0 };
    const d = buildDesign(c);
    const s = simulateBattle(c, designRow(d, 0), 0).summary;
    expect(s.duration).toBeLessThanOrEqual(c.maxTime + 1e-9);
  });

  it('bounds trace memory and keeps frames dense for large battles', () => {
    const c = small({ heavyCount: 50, packCount: 2000, runs: 1, maxTime: 600 });
    const d = buildDesign(c);
    const out = simulateBattle(c, designRow(d, 0), 0, true);
    const frames = out.trace?.frames ?? [];
    const floats = frames.reduce((a, f) => a + f.heavy.length + f.pack.length, 0);
    expect(floats).toBeLessThanOrEqual(6_000_000 + 4 * 50 + 3 * 2000);
    expect(frames.length).toBeGreaterThanOrEqual(Math.min(20, out.summary.duration / 0.5));
  });
});

describe('Monte Carlo runner', () => {
  it('is independent of chunk boundaries', () => {
    const c = small();
    const d = buildDesign(c);
    const whole = runChunk(c, d, 0, c.runs);
    const parts = [...runChunk(c, d, 0, 5), ...runChunk(c, d, 5, c.runs)];
    expect(parts).toEqual(whole);
  });

  it('aggregates consistent totals regardless of summary order', () => {
    const c = small();
    const d = buildDesign(c);
    const a = aggregate(c, d, runChunk(c, d, 0, c.runs).reverse());
    expect(a.n).toBe(c.runs);
    expect(a.heavyWins + a.packWins + a.draws).toBe(c.runs);
    expect(a.heavySurvivors.hist.counts.reduce((x, y) => x + y, 0)).toBe(c.runs);
    expect(a.sensitivity).toHaveLength(d.dims);
    expect(a.representativeRun).toBeGreaterThanOrEqual(0);
    expect(a.representativeRun).toBeLessThan(c.runs);
    expect(a.duration.hist.counts.reduce((x, y) => x + y, 0)).toBe(c.runs);
    const binWidth = a.duration.hist.max / a.duration.hist.counts.length;
    expect(Math.abs(binWidth / 0.1 - Math.round(binWidth / 0.1))).toBeLessThan(1e-9);
  });

  it('reports NaN exchange ratio when nobody dies', () => {
    const c = small({ heavyCount: 1, packCount: 1, runs: 3, maxTime: 30, morale: false });
    c.params['pack.latchChance'] = { min: 0, mode: 0, max: 0 };
    c.params['heavy.biteAccuracy'] = { min: 0, mode: 0, max: 0 };
    const d = buildDesign(c);
    expect(aggregate(c, d, runChunk(c, d, 0, c.runs)).exchangeRatio).toBeNaN();
  });
});

describe('species constants', () => {
  const pair = (
    heavySpecies: ScenarioConfig['heavySpecies'],
    packSpecies: ScenarioConfig['packSpecies'],
    over: Partial<ScenarioConfig> = {},
  ): ScenarioConfig => {
    const c = sanitizeConfig({ ...small(), heavySpecies, packSpecies, params: undefined });
    return { ...c, ...over };
  };

  it('sizes the pack contact radius from the species and replays exactly', () => {
    for (const [h, p] of [
      ['brownBear', 'wolf'],
      ['elephant', 'lion'],
      ['buffalo', 'hyena'],
      ['mammoth', 'wolf'],
      ['homoErectus', 'wolf'],
      ['trex', 'homoErectus'],
    ] as const) {
      const c = pair(h, p, { heavyCount: 1, packCount: 8, runs: 4 });
      const d = buildDesign(c);
      for (let run = 0; run < c.runs; run++) {
        const plain = countRng(() => simulateBattle(c, designRow(d, run), run));
        const traced = countRng(() => simulateBattle(c, designRow(d, run), run, true));
        expect(traced.value.summary).toEqual(plain.value.summary);
        expect(traced.calls).toBe(plain.calls);
        const trace = traced.value.trace;
        if (!trace) throw new Error('no trace');
        expect(trace.meta.packRadius).toBe(PACK_SPECIES[p].constants.radius);
        expect(checkTrace(trace, plain.value.summary).problems).toEqual([]);
      }
    }
  });

  it('lets a thick hide reduce the damage a heavy takes, without extra random draws', () => {
    const params = speciesRanges('trex', 'lion');
    // No heavy attacks and no shake-off: one lion stays latched and only the hide differs.
    params['heavy.biteAccuracy'] = { min: 0, mode: 0, max: 0 };
    params['heavy.shakeRate'] = { min: 0, mode: 0, max: 0 };
    params['pack.latchChance'] = { min: 1, mode: 1, max: 1 };
    params['pack.latchEndurance'] = { min: 1200, mode: 1200, max: 1200 };
    params['pack.bleed'] = { min: 0, mode: 0, max: 0 };
    const a = pair('trex', 'lion', {
      heavyCount: 1,
      packCount: 1,
      runs: 1,
      morale: false,
      maxTime: 60,
      individualCV: 0,
      params,
    });
    const b: ScenarioConfig = { ...a, heavySpecies: 'elephant' };
    const row = designRow(buildDesign(a), 0);
    const ra = countRng(() => simulateBattle(a, row, 0));
    const rb = countRng(() => simulateBattle(b, row, 0));
    expect(rb.calls).toBe(ra.calls);
    const lostA = 1 - ra.value.summary.heavyHpFrac;
    const lostB = 1 - rb.value.summary.heavyHpFrac;
    expect(lostA).toBeGreaterThan(0);
    expect(lostB).toBeCloseTo(lostA * HEAVY_SPECIES.elephant.constants.hide, 9);
  });
});
