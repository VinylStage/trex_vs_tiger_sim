import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../src/sim/config';
import { aggregateFree } from '../src/sim/free/aggregate';
import { defaultFreeConfig, sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { FreeOutcome, type FreeRunSummary } from '../src/sim/free/engine';
import { runAllFree, runFreeChunk } from '../src/sim/free/montecarlo';
import { buildFreeDesign } from '../src/sim/free/config';
import { configFromHash, decodeConfig, encodeConfig, hashFromConfig } from '../src/ui/share';
import {
  FREE_CODE_PREFIX,
  encodeFreeConfig,
  freeConfigCode,
  freeConfigFromHash,
  hashFromFreeConfig,
  parseFreeConfigInput,
} from '../src/ui/share-free';
import type { WorkerRequest, WorkerResponse } from '../src/workers/protocol';
import {
  sideBuffState,
  withBuffSwitch,
  withMorale,
  withNumber,
  withSampling,
  withSideCount,
  withSideSpecies,
} from '../src/ui/free-form-model';

describe('pack buff in the free form (design §5.5, §6)', () => {
  const wolvesVsBear = (): FreeConfig =>
    sanitizeFreeConfig({
      runs: 12,
      sides: [
        { species: 'wolf', count: 6 },
        { species: 'brownBear', count: 1 },
      ],
    });

  it('switches each effect and keeps it through a v3 link', () => {
    let c = wolvesVsBear();
    c = withBuffSwitch(c, 'relief', false);
    c = withBuffSwitch(c, 'focus', false);
    expect(c.packBuff).toEqual({
      coordinate: true,
      focus: false,
      groupLatch: true,
      morale: true,
      relief: false,
    });
    expect(freeConfigFromHash(hashFromFreeConfig(c))).toEqual(c);
  });

  it('labels each side: buff active, buff off, individuals alone, or a single animal', () => {
    const c = wolvesVsBear();
    expect(sideBuffState(c, 0, true)).toBe('active');
    expect(sideBuffState(c, 1, false)).toBe('single');
    let off = c;
    for (const e of ['coordinate', 'focus', 'groupLatch', 'morale', 'relief'] as const) {
      off = withBuffSwitch(off, e, false);
    }
    expect(sideBuffState(off, 0, true)).toBe('off');
    const tigers = withSideCount(withSideSpecies(c, 0, 'tiger'), 0, 5);
    expect(sideBuffState(tigers, 0, false)).toBe('alone');
  });

  it('aggregates buff-active time per side, zero for a non-social side', () => {
    const c = wolvesVsBear();
    const { summaries } = runAllFree(c);
    const agg = aggregateFree(c, summaries);
    const mean = summaries.reduce((a, s) => a + s.buffA.activeFrac, 0) / summaries.length;
    expect(agg.buffA.mean.activeFrac).toBeCloseTo(mean, 12);
    expect(agg.buffA.mean.activeFrac).toBeGreaterThan(0);
    expect(agg.buffA.anyTimeMedian).toBeGreaterThan(0);
    expect(agg.buffB.mean.activeFrac).toBe(0);
    expect(agg.buffB.anyTimeMedian).toBe(0);
  });
});

/** Free mode plumbing for the UI: v3 links, TVT3 codes, worker dispatch, aggregation (#50). */

describe('form to config (free-form-model)', () => {
  it('turns form edits into a sanitized config that survives a v3 link', () => {
    let c = defaultFreeConfig();
    c = withSideSpecies(c, 0, 'tiger');
    c = withSideSpecies(c, 1, 'tiger');
    c = withSideCount(c, 0, 3);
    c = withSideCount(c, 1, 4.6);
    c = withNumber(c, 'runs', 250);
    c = withNumber(c, 'seed', 7);
    c = withNumber(c, 'arenaSize', 800);
    c = withNumber(c, 'maxTime', 600);
    c = withNumber(c, 'individualCV', 0.1);
    c = withSampling(c, 'random');
    c = withMorale(c, false);
    expect(c.sides.map((s) => [s.species, s.count])).toEqual([
      ['tiger', 3],
      ['tiger', 5],
    ]);
    expect([c.runs, c.seed, c.arenaSize, c.maxTime, c.individualCV, c.sampling, c.morale]).toEqual([
      250,
      7,
      800,
      600,
      0.1,
      'random',
      false,
    ]);
    expect(c).toEqual(sanitizeFreeConfig(c));
    expect(freeConfigFromHash(hashFromFreeConfig(c))).toEqual(c);
  });

  it('keeps the count and resets the ranges when the species changes', () => {
    let c = sanitizeFreeConfig({
      sides: [{ species: 'lion', count: 6, params: { mass: { min: 120, mode: 130, max: 140 } } }],
    });
    c = withSideSpecies(c, 0, 'wolf');
    expect(c.sides[0].count).toBe(6);
    const wolf = sanitizeFreeConfig({ sides: [{ species: 'wolf' }] });
    expect(c.sides[0].params.mass).toEqual(wolf.sides[0].params.mass);
  });

  it('ignores invalid input and clamps out-of-range values', () => {
    const d = defaultFreeConfig();
    expect(withSideSpecies(d, 0, 'dragon')).toBe(d);
    expect(withSideCount(d, 0, Number.NaN)).toBe(d);
    expect(withNumber(d, 'runs', Number.POSITIVE_INFINITY)).toBe(d);
    expect(withSideCount(d, 1, 99999).sides[1].count).toBe(5000);
    expect(withSampling(d, 'bogus').sampling).toBe(d.sampling);
  });
});

const tigersVsLions = (): FreeConfig =>
  sanitizeFreeConfig({
    runs: 120,
    seed: 42,
    morale: false,
    sides: [
      { species: 'tiger', count: 5 },
      { species: 'lion', count: 5, params: { latchDps: { min: 3, mode: 8, max: 15 } } },
    ],
    packBuff: { relief: false },
    globals: { latchRatio: { min: 2.5, mode: 3, max: 4 } },
  });

describe('share link v3', () => {
  it('round-trips a free config through #s=', () => {
    const c = tigersVsLions();
    expect(freeConfigFromHash(hashFromFreeConfig(c))).toEqual(c);
    const d = defaultFreeConfig();
    expect(freeConfigFromHash(hashFromFreeConfig(d))).toEqual(d);
  });

  it('carries v: 3 and the mode marker, and never an empty hash', () => {
    const json = JSON.parse(
      Buffer.from(encodeFreeConfig(defaultFreeConfig()), 'base64url').toString(),
    );
    expect(json).toMatchObject({
      v: 3,
      m: 'free',
      a: { sp: 'trex', n: 1 },
      b: { sp: 'trex', n: 1 },
    });
    expect(hashFromFreeConfig(defaultFreeConfig())).toMatch(/^#s=/);
  });

  it('leaves legacy links to the legacy decoder', () => {
    const legacy = { ...defaultConfig(), heavyCount: 3, packCount: 30 };
    const hash = hashFromConfig(legacy);
    expect(freeConfigFromHash(hash)).toBeNull();
    expect(configFromHash(hash)).toEqual(legacy);
    expect(freeConfigFromHash('')).toBeNull();
    expect(freeConfigFromHash('#s=!!!')).toBeNull();
    // A v1-style payload without a version is legacy too.
    const v1 = Buffer.from(JSON.stringify({ trexCount: 2 })).toString('base64url');
    expect(freeConfigFromHash(`#s=${v1}`)).toBeNull();
  });

  it('is not mistaken for a legacy config by the legacy decoder', () => {
    // The app checks for a free payload first; the legacy decoder alone still never throws and
    // yields a legacy config with the default species (it only shares the scalar names).
    const legacy = decodeConfig(encodeFreeConfig(tigersVsLions()));
    expect(legacy).not.toHaveProperty('mode');
    expect([legacy.heavySpecies, legacy.packSpecies]).toEqual(['trex', 'tiger']);
    expect(encodeConfig(defaultConfig())).toBe('');
  });

  it('requires the mode marker', () => {
    const p = Buffer.from(JSON.stringify({ v: 3, a: { sp: 'lion' } })).toString('base64url');
    expect(freeConfigFromHash(`#s=${p}`)).toBeNull();
  });
});

describe('settings code TVT3', () => {
  it('round-trips through a code, a link and a bare payload', () => {
    const c = tigersVsLions();
    const code = freeConfigCode(c);
    expect(code.startsWith(FREE_CODE_PREFIX)).toBe(true);
    expect(parseFreeConfigInput(code)).toEqual(c);
    expect(parseFreeConfigInput(`  ${code.toLowerCase().slice(0, 5)}${code.slice(5)}  `)).toEqual(
      c,
    );
    expect(parseFreeConfigInput(`https://example.org/en/${hashFromFreeConfig(c)}`)).toEqual(c);
    expect(parseFreeConfigInput(encodeFreeConfig(c))).toEqual(c);
  });

  it('returns null for legacy and malformed input', () => {
    expect(parseFreeConfigInput('TVT2-')).toBeNull();
    expect(parseFreeConfigInput('')).toBeNull();
    expect(parseFreeConfigInput('TVT3-%%%')).toBeNull();
    expect(parseFreeConfigInput('https://example.org/')).toBeNull();
  });
});

describe('worker dispatch', () => {
  const posted: WorkerResponse[] = [];
  let onmessage: ((e: { data: WorkerRequest }) => void) | null = null;

  beforeAll(async () => {
    const ctx = {
      postMessage: (m: WorkerResponse) => posted.push(m),
      onmessage: null as ((e: { data: WorkerRequest }) => void) | null,
    };
    vi.stubGlobal('self', ctx);
    await import('../src/workers/sim.worker');
    onmessage = ctx.onmessage;
  });

  it('runs a free config on the free engine', () => {
    const c = tigersVsLions();
    posted.length = 0;
    onmessage?.({ data: { type: 'run', jobId: 7, config: c, start: 10, end: 20 } });
    const result = posted.find((m) => m.type === 'result');
    if (!result || result.type !== 'result') throw new Error('no result');
    expect(result.jobId).toBe(7);
    expect(result.summaries).toEqual(runFreeChunk(c, buildFreeDesign(c), 10, 20));
  });

  it('still runs a legacy config on the legacy engine', () => {
    posted.length = 0;
    const c = { ...defaultConfig(), runs: 4 };
    onmessage?.({ data: { type: 'run', jobId: 8, config: c, start: 0, end: 2 } });
    const result = posted.find((m) => m.type === 'result');
    if (!result || result.type !== 'result') throw new Error('no result');
    expect(result.summaries).toHaveLength(2);
    expect(result.summaries[0]).toHaveProperty('heavyAlive');
  });
});

describe('free aggregation', () => {
  it('counts outcomes, intervals and per-side means consistently', () => {
    const c = tigersVsLions();
    const { summaries } = runAllFree(c);
    const agg = aggregateFree(c, summaries);
    expect(agg.n).toBe(c.runs);
    expect(agg.aWins + agg.bWins + agg.draws).toBe(c.runs);
    expect(agg.pA.p).toBeCloseTo(agg.aWins / c.runs, 12);
    for (const p of [agg.pA, agg.pB, agg.pDraw]) {
      expect(p.lo).toBeLessThanOrEqual(p.p);
      expect(p.hi).toBeGreaterThanOrEqual(p.p);
    }
    expect(agg.a.survivors + agg.a.killed).toBeCloseTo(5, 9);
    expect(agg.b.survivors + agg.b.killed).toBeCloseTo(5, 9);
    expect(agg.duration.p5).toBeLessThanOrEqual(agg.duration.p50);
    expect(agg.duration.p50).toBeLessThanOrEqual(agg.duration.p95);
    const rep = summaries.find((s) => s.run === agg.representativeRun) as FreeRunSummary;
    const most = Math.max(agg.aWins, agg.bWins, agg.draws);
    const commonOutcome =
      agg.aWins === most ? FreeOutcome.A : agg.bWins === most ? FreeOutcome.B : FreeOutcome.Draw;
    expect(rep.outcome).toBe(commonOutcome);
  });

  it('handles an empty batch', () => {
    const agg = aggregateFree(defaultFreeConfig(), []);
    expect(agg.n).toBe(0);
    expect(agg.pA).toEqual({ p: 0, lo: 0, hi: 1 });
  });
});
