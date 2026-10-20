import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFreeDesign, sanitizeFreeConfig } from '../src/sim/free/config';
import { simulateFreeBattle, type FreeRunSummary } from '../src/sim/free/engine';
import { runAllFree } from '../src/sim/free/montecarlo';
import { designRow } from '../src/sim/sampling';

/**
 * Golden fixture of the free engine (v3 links), captured when P3 (#50) was written. Like the v1
 * and v2 goldens it must never be regenerated: later phases (the pack buff, sharing, UI) must
 * reproduce these results bit for bit. Every case uses non-social species only, so the pack-buff
 * layer (P4) cannot touch them.
 *
 * The fixture is written only when it does not exist yet (`CAPTURE_FREE_GOLDEN=1`).
 */

const FIXTURE = new URL('./fixtures/free-v3-golden.json', import.meta.url);

const CASES: { name: string; input: Record<string, unknown> }[] = [
  {
    name: 'trex 1 v trex 1',
    input: { runs: 60, sides: [{ species: 'trex' }, { species: 'trex' }] },
  },
  {
    name: 'tiger 1 v brownBear 1',
    input: { runs: 60, sides: [{ species: 'tiger' }, { species: 'brownBear' }] },
  },
  {
    name: 'tiger 20 v mammoth 1 (latching)',
    input: { runs: 30, sides: [{ species: 'tiger', count: 20 }, { species: 'mammoth' }] },
  },
  {
    name: 'elephant 3 v buffalo 5',
    input: {
      runs: 30,
      sides: [
        { species: 'elephant', count: 3 },
        { species: 'buffalo', count: 5 },
      ],
    },
  },
  {
    name: 'trex 10 v tiger 100',
    input: {
      runs: 10,
      maxTime: 300,
      sides: [
        { species: 'trex', count: 10 },
        { species: 'tiger', count: 100 },
      ],
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
      globals: { knockRatio: { min: 1.2, mode: 1.5, max: 2 } },
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
  designHash: string;
  summaries: number[][];
  trace: { run: number; frames: number; framesHash: string; massHash: string };
}

function capture(name: string, input: Record<string, unknown>): Captured {
  const config = sanitizeFreeConfig(input);
  const { design, summaries } = runAllFree(config);
  const { trace } = simulateFreeBattle(config, designRow(buildFreeDesign(config), 0), 0, true);
  if (!trace) throw new Error('no trace');
  let fh = 0x811c9dc5;
  const t = new Float64Array(1);
  for (const f of trace.frames) {
    t[0] = f.t;
    fh = fnv(fh, bytesOf(t));
    fh = fnv(fh, bytesOf(f.agents));
  }
  return {
    name,
    input,
    designHash: hex(fnv(0x811c9dc5, bytesOf(design.values))),
    summaries: summaries.map(row),
    trace: {
      run: 0,
      frames: trace.frames.length,
      framesHash: hex(fh),
      massHash: hex(fnv(0x811c9dc5, bytesOf(trace.meta.mass))),
    },
  };
}

if (process.env['CAPTURE_FREE_GOLDEN'] && !existsSync(FIXTURE)) {
  writeFileSync(
    FIXTURE,
    `${JSON.stringify({ capturedFrom: process.env['CAPTURE_FREE_GOLDEN'], cases: CASES.map((c) => capture(c.name, c.input)) }, null, 1)}\n`,
  );
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  capturedFrom: string;
  cases: Captured[];
};

describe(`free engine reproduces bit-identically (golden from ${golden.capturedFrom})`, () => {
  it('has every case', () => {
    expect(golden.cases.map((c) => c.name)).toEqual(CASES.map((c) => c.name));
  });

  it.each(golden.cases)('$name', (g) => {
    expect(capture(g.name, g.input)).toEqual(g);
  });
});
