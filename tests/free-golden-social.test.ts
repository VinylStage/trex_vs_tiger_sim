import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FreeOutcome,
  simulateFreeBattle,
  type BuffStats,
  type FreeRunSummary,
} from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { designRow } from '../src/sim/sampling';

/**
 * Golden fixture of the free engine for social species with the pack buff on (1.0 renewal,
 * docs/design/RENEWAL-1.0.md §10.4 step 1, #124). `tests/free-golden.test.ts` covers only
 * non-social species, so the pack-buff layer had no golden. This one was captured from `main`
 * before any engine change of the renewal (intervention hook, branch hook, model versions), and
 * every later change must reproduce it bit for bit. Never regenerate it.
 *
 * Each case records the design hash, every run's outcome summary with both sides' pack-buff
 * counters, the outcome counts, and hashes of run 0's trace (positions, states and buff flags).
 *
 * The fixture is written only when it does not exist yet (`CAPTURE_SOCIAL_GOLDEN=<label>`).
 */

const FIXTURE = new URL('./fixtures/free-v3-social-golden.json', import.meta.url);

const CASES: { name: string; input: Record<string, unknown> }[] = [
  {
    name: 'lion 4 v tiger 2',
    input: {
      runs: 30,
      sides: [
        { species: 'lion', count: 4 },
        { species: 'tiger', count: 2 },
      ],
    },
  },
  {
    name: 'wolf 8 v brownBear 1 (group latching)',
    input: {
      runs: 30,
      sides: [
        { species: 'wolf', count: 8 },
        { species: 'brownBear', count: 1 },
      ],
    },
  },
  {
    name: 'hyena 6 v lion 3 (both sides social)',
    input: {
      runs: 20,
      sides: [
        { species: 'hyena', count: 6 },
        { species: 'lion', count: 3 },
      ],
    },
  },
  {
    name: 'homoErectus 6 v mammoth 1',
    input: {
      runs: 20,
      maxTime: 300,
      sides: [{ species: 'homoErectus', count: 6 }, { species: 'mammoth' }],
    },
  },
  {
    name: 'wolf 10 v wolf 10 (mirror)',
    input: {
      runs: 16,
      maxTime: 300,
      sides: [
        { species: 'wolf', count: 10 },
        { species: 'wolf', count: 10 },
      ],
    },
  },
  {
    name: 'tiger 30 v lion 30 (rout contagion)',
    input: {
      runs: 8,
      maxTime: 300,
      sides: [
        { species: 'tiger', count: 30 },
        { species: 'lion', count: 30 },
      ],
    },
  },
  {
    name: 'lion 5 v hyena 10, random sampling, seed 11, edited buff ranges',
    input: {
      runs: 16,
      maxTime: 300,
      sampling: 'random',
      seed: 11,
      individualCV: 0.15,
      sides: [
        {
          species: 'lion',
          count: 5,
          buff: { routShock: { min: 0.02, mode: 0.06, max: 0.1 } },
        },
        {
          species: 'hyena',
          count: 10,
          buff: { cohesionRadius: { min: 20, mode: 40, max: 80 } },
        },
      ],
      globals: { buffGrace: { min: 1, mode: 3, max: 6 } },
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

/** Pack-buff counters in a fixed order, so a counter added later does not alter old rows. */
const BUFF_KEYS: readonly (keyof BuffStats)[] = [
  'activeFrac',
  'anyTime',
  'activations',
  'coordinate',
  'focus',
  'groupLatch',
  'restraint',
  'support',
  'contagion',
  'relief',
];

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
  ...BUFF_KEYS.map((k) => s.buffA[k]),
  ...BUFF_KEYS.map((k) => s.buffB[k]),
];

interface Captured {
  name: string;
  input: Record<string, unknown>;
  designHash: string;
  /** Side A wins, side B wins, draws. */
  outcomes: [number, number, number];
  summaries: number[][];
  trace: { run: number; frames: number; framesHash: string; massHash: string };
}

function capture(name: string, input: Record<string, unknown>): Captured {
  const config = sanitizeFreeConfig(input);
  const { design, summaries } = runAllFree(config);
  const count = (o: number): number => summaries.filter((s) => s.outcome === o).length;
  const { trace } = simulateFreeBattle(config, designRow(buildFreeDesign(config), 0), 0, true);
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
    designHash: hex(fnv(0x811c9dc5, bytesOf(design.values))),
    outcomes: [count(FreeOutcome.A), count(FreeOutcome.B), count(FreeOutcome.Draw)],
    summaries: summaries.map(row),
    trace: {
      run: 0,
      frames: trace.frames.length,
      framesHash: hex(fh),
      massHash: hex(fnv(0x811c9dc5, bytesOf(trace.meta.mass))),
    },
  };
}

if (process.env['CAPTURE_SOCIAL_GOLDEN'] && !existsSync(FIXTURE)) {
  writeFileSync(
    FIXTURE,
    `${JSON.stringify({ capturedFrom: process.env['CAPTURE_SOCIAL_GOLDEN'], cases: CASES.map((c) => capture(c.name, c.input)) }, null, 1)}\n`,
  );
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  capturedFrom: string;
  cases: Captured[];
};

describe(`free engine with the pack buff reproduces bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every case', () => {
    expect(golden.cases.map((c) => c.name)).toEqual(CASES.map((c) => c.name));
  });

  it('exercises the pack buff in every case', () => {
    const at = 14 + BUFF_KEYS.indexOf('activations');
    for (const g of golden.cases) {
      const activations = g.summaries.reduce(
        (sum, r) => sum + (r[at] as number) + (r[at + BUFF_KEYS.length] as number),
        0,
      );
      expect(activations, g.name).toBeGreaterThan(0);
    }
  });

  it.each(golden.cases)('$name', (g) => {
    expect(capture(g.name, g.input)).toEqual(g);
  });
});
