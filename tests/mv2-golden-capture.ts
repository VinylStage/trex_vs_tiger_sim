import { DET_MATH } from '../src/sim/detmath';
import { sanitizeConfig } from '../src/sim/config';
import { simulateBattle, type RunSummary } from '../src/sim/engine';
import { runAll } from '../src/sim/montecarlo';
import { CARD_IDS } from '../src/sim/free/cards';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  BRANCH_SALT_MIN,
  simulateFreeBattle,
  type FreeBattleOptions,
  type FreeRunSummary,
} from '../src/sim/free/engine';
import { runFreeChunk } from '../src/sim/free/montecarlo';
import { Rng } from '../src/sim/rng';
import { designRow } from '../src/sim/sampling';

/*
 * Golden cases of free `mv` 2 and classic model 2 (#169, #197), shared by the V8 test
 * (tests/mv2-golden.test.ts, vitest on Node) and the JavaScriptCore check
 * (scripts/cross-engine/check-goldens.mjs, run with Bun). No test framework here, so both
 * engines run exactly this code. The fixture is tests/fixtures/mv2-golden.json; like every
 * golden it is never regenerated.
 */

export const FREE_CASES: {
  name: string;
  input: Record<string, unknown>;
  opts?: FreeBattleOptions;
}[] = [
  {
    name: 'trex 1 v trex 1',
    input: { runs: 40, sides: [{ species: 'trex' }, { species: 'trex' }] },
  },
  {
    name: 'trex 1 v tiger 10 (flight)',
    input: { runs: 30, sides: [{ species: 'trex' }, { species: 'tiger', count: 10 }] },
  },
  {
    name: 'trex 10 v tiger 100 (flight, solitary shock)',
    input: {
      runs: 8,
      maxTime: 300,
      sides: [
        { species: 'trex', count: 10 },
        { species: 'tiger', count: 100 },
      ],
    },
  },
  {
    name: 'wolf 8 v brownBear 1 (pack buff)',
    input: { runs: 20, sides: [{ species: 'wolf', count: 8 }, { species: 'brownBear' }] },
  },
  {
    name: 'polarBear 1 v brownBear 1 (revised polar bear)',
    input: { runs: 40, sides: [{ species: 'polarBear' }, { species: 'brownBear' }] },
  },
  {
    name: 'raptor 12 v trex 1 (social, latching)',
    input: {
      runs: 10,
      maxTime: 300,
      sides: [{ species: 'raptor', count: 12 }, { species: 'trex' }],
    },
  },
  {
    name: 'brownBear 2 v tiger 3, random sampling, morale off, edited ranges',
    input: {
      runs: 20,
      maxTime: 300,
      sampling: 'random',
      morale: false,
      seed: 7,
      individualCV: 0.15,
      sides: [
        {
          species: 'brownBear',
          count: 2,
          params: { strikeAccuracy: { min: 0.5, mode: 0.6, max: 0.7 } },
        },
        { species: 'tiger', count: 3 },
      ],
    },
  },
  {
    name: 'lion 5 v tiger 5 with cards and a branch (run 0 only)',
    input: {
      runs: 1,
      sides: [
        { species: 'lion', count: 5 },
        { species: 'tiger', count: 5 },
      ],
    },
    opts: {
      interventions: [
        { tick: 30, card: CARD_IDS.indexOf('mud'), side: 2 },
        { tick: 80, card: CARD_IDS.indexOf('focus'), side: 0 },
      ],
      branch: { tick: 100, salt: BRANCH_SALT_MIN + 1 },
    },
  },
];

export const CLASSIC_CASES: { name: string; input: Record<string, unknown> }[] = [
  { name: 'trex 1 v tiger 10', input: { heavyCount: 1, packCount: 10, runs: 40 } },
  {
    name: 'trex 3 v tiger 40, direct',
    input: { heavyCount: 3, packCount: 40, runs: 10, packTactic: 'direct' },
  },
  {
    name: 'elephant 2 v lion 20, random sampling, CV 0.2',
    input: {
      heavySpecies: 'elephant',
      packSpecies: 'lion',
      heavyCount: 2,
      packCount: 20,
      runs: 10,
      sampling: 'random',
      individualCV: 0.2,
      seed: 99,
    },
  },
];

const fnv = (h: number, bytes: Uint8Array): number => {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ (bytes[k] as number), 0x01000193);
  return h >>> 0;
};
const hex = (h: number): string => h.toString(16).padStart(8, '0');
const bytesOf = (a: ArrayBufferView): Uint8Array =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const hashOf = (a: ArrayBufferView): string => hex(fnv(0x811c9dc5, bytesOf(a)));
const hashNumbers = (xs: readonly number[]): string => hashOf(Float64Array.from(xs));

const freeRow = (s: FreeRunSummary): number[] => [
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

const classicRow = (s: RunSummary): number[] => [
  s.run,
  s.outcome,
  s.duration,
  s.heavyAlive,
  s.packKilled,
  s.packRouted,
  s.packActive,
  s.heavyHpFrac,
  s.heavyAdvantage,
];

export interface CapturedCase {
  name: string;
  input: Record<string, unknown>;
  designHash: string;
  summaries: number[][];
  traceHash: string;
}

export function captureFree(
  name: string,
  input: Record<string, unknown>,
  opts?: FreeBattleOptions,
): CapturedCase {
  const config = sanitizeFreeConfig({ ...input, mv: 2 });
  if (config.mv !== 2) throw new Error('model 2 is not runnable');
  const design = buildFreeDesign(config);
  const summaries = opts
    ? [simulateFreeBattle(config, designRow(design, 0), 0, false, opts).summary]
    : runFreeChunk(config, design, 0, config.runs);
  const { trace } = simulateFreeBattle(config, designRow(design, 0), 0, true, opts);
  if (!trace) throw new Error('no trace');
  let fh = 0x811c9dc5;
  const t = new Float64Array(1);
  for (const f of trace.frames) {
    t[0] = f.t;
    fh = fnv(fh, bytesOf(t));
    fh = fnv(fh, bytesOf(f.agents));
    fh = fnv(fh, bytesOf(f.buffed));
  }
  return {
    name,
    input,
    designHash: hashOf(design.values),
    summaries: summaries.map((s) => [
      ...freeRow(s),
      ...(Object.values(s.buffA) as number[]),
      ...(Object.values(s.buffB) as number[]),
    ]),
    traceHash: hex(fh),
  };
}

export function captureClassic(name: string, input: Record<string, unknown>): CapturedCase {
  const config = sanitizeConfig({ ...input, mv: 2 });
  if (config.mv !== 2) throw new Error('classic model 2 is not runnable');
  const { design, summaries } = runAll(config);
  const { trace } = simulateBattle(config, designRow(design, 0), 0, true);
  if (!trace) throw new Error('no trace');
  let fh = 0x811c9dc5;
  const t = new Float64Array(1);
  for (const f of trace.frames) {
    t[0] = f.t;
    fh = fnv(fh, bytesOf(t));
    fh = fnv(fh, bytesOf(f.heavy));
    fh = fnv(fh, bytesOf(f.pack));
  }
  fh = fnv(fh, bytesOf(trace.events));
  return {
    name,
    input,
    designHash: hashOf(design.values),
    summaries: summaries.map(classicRow),
    traceHash: hex(fh),
  };
}

/**
 * Hashes of the deterministic functions over fixed inputs, and of `Rng.normal()` with them, so a
 * difference between engines shows up in the function that causes it.
 */
export function captureMath(): Record<string, string> {
  const rng = new Rng(20261019);
  const xs: number[] = [];
  for (let i = 0; i < 20000; i++) xs.push((rng.next() - 0.5) * 40);
  const ys = xs.map((x, i) => x * ((i % 7) - 3) + 1e-3 * i);
  const pos = xs.map((x) => Math.abs(x) * 1e3 + 1e-9);
  const normal = new Rng(7, true);
  return {
    sin: hashNumbers(xs.map(DET_MATH.sin)),
    cos: hashNumbers(xs.map(DET_MATH.cos)),
    atan2: hashNumbers(xs.map((x, i) => DET_MATH.atan2(ys[i] as number, x))),
    log: hashNumbers(pos.map(DET_MATH.log)),
    normal: hashNumbers(Array.from({ length: 100000 }, () => normal.normal())),
  };
}

export interface Mv2Golden {
  capturedFrom: string;
  math: Record<string, string>;
  free: CapturedCase[];
  classic: CapturedCase[];
}

export function captureAll(capturedFrom: string): Mv2Golden {
  return {
    capturedFrom,
    math: captureMath(),
    free: FREE_CASES.map((c) => captureFree(c.name, c.input, c.opts)),
    classic: CLASSIC_CASES.map((c) => captureClassic(c.name, c.input)),
  };
}

/** Names of the parts of `actual` that differ from `expected` (empty when identical). */
export function compareGolden(expected: Mv2Golden, actual: Mv2Golden): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(expected.math)) {
    if (actual.math[k] !== v) out.push(`math.${k}`);
  }
  for (const kind of ['free', 'classic'] as const) {
    expected[kind].forEach((e, i) => {
      const a = actual[kind][i];
      if (JSON.stringify(a) !== JSON.stringify(e)) out.push(`${kind}: ${e.name}`);
    });
    if (actual[kind].length !== expected[kind].length) out.push(`${kind}: case count`);
  }
  return out;
}
