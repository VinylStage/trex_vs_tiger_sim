import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/sim/config';
import { Outcome } from '../src/sim/engine';
import {
  exchangeCard,
  isStale,
  outcomeKey,
  progressNote,
  tornadoHeight,
} from '../src/ui/app-model';

describe('app-model (#61)', () => {
  it('outcomeKey names each outcome code, draws included', () => {
    expect(outcomeKey(Outcome.Heavy)).toBe('outcome.heavy');
    expect(outcomeKey(Outcome.Pack)).toBe('outcome.pack');
    expect(outcomeKey(Outcome.Draw)).toBe('outcome.draw');
  });

  it('tornadoHeight grows 28 px per bar with a 120 px floor', () => {
    expect(tornadoHeight(0)).toBe(120);
    expect(tornadoHeight(3)).toBe(120);
    expect(tornadoHeight(10)).toBe(304);
  });

  it('isStale compares the shown config with the form, nothing shown is never stale', () => {
    const a = defaultConfig();
    expect(isStale(null, a)).toBe(false);
    expect(isStale(structuredClone(a), a)).toBe(false);
    expect(isStale({ ...a, runs: a.runs + 1 }, a)).toBe(true);
  });

  it('exchangeCard: a number, or a dash with the 0/0 or one-sided sub-line', () => {
    expect(exchangeCard(2.5)).toEqual({ value: 2.5, sub: 'stat.exchangeSub' });
    expect(exchangeCard(Number.NaN)).toEqual({ value: null, sub: 'stat.exchangeNone' });
    expect(exchangeCard(Number.POSITIVE_INFINITY)).toEqual({
      value: null,
      sub: 'stat.exchangeInf',
    });
  });

  it('progressNote: estimate while running, then cancelled, done or empty', () => {
    const base = { running: false, cancelled: false, elapsedMs: null, etaMs: null };
    expect(progressNote({ ...base, running: true })).toEqual({ key: 'progress.etaPending' });
    expect(progressNote({ ...base, running: true, etaMs: 4000 })).toEqual({
      key: 'progress.eta',
      ms: 4000,
    });
    expect(progressNote({ ...base, cancelled: true, elapsedMs: 10 })).toEqual({
      key: 'progress.cancelled',
    });
    expect(progressNote({ ...base, elapsedMs: 1500 })).toEqual({ key: 'progress.done', ms: 1500 });
    expect(progressNote(base)).toBeNull();
  });
});
