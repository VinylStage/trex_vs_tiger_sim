import { afterEach, describe, expect, it } from 'vitest';
import type { AggregateResult } from '../src/sim/montecarlo';
import { wilson } from '../src/sim/stats';
import { initLang, setNamePair } from '../src/ui/i18n';
import {
  formatBound,
  formatCountShare,
  formatShare,
  headline,
  leadingOutcome,
  precisionLine,
  shareDigits,
} from '../src/ui/verdict';

const agg = (heavyWins: number, packWins: number, draws: number): AggregateResult => {
  const n = heavyWins + packWins + draws;
  return {
    n,
    heavyWins,
    packWins,
    draws,
    pHeavy: wilson(heavyWins, n),
    pPack: wilson(packWins, n),
    pDraw: wilson(draws, n),
  } as AggregateResult;
};

afterEach(() => {
  initLang('ko');
  setNamePair({ heavySpecies: 'trex', packSpecies: 'tiger' });
});

describe('formatShare', () => {
  it('uses no decimals below 1,000 runs and one from 1,000', () => {
    expect(shareDigits(999)).toBe(0);
    expect(shareDigits(1000)).toBe(1);
    initLang('en');
    expect(formatShare(497, 500)).toBe('99%');
    expect(formatShare(1234, 2000)).toBe('61.7%');
  });

  it('writes all or none of the runs as "> 99%" / "< 1%", never 100% or 0%', () => {
    initLang('en');
    expect(formatShare(500, 500)).toBe('> 99%');
    expect(formatShare(0, 500)).toBe('< 1%');
    expect(formatShare(498, 500)).toBe('> 99%');
    expect(formatShare(2, 500)).toBe('< 1%');
    expect(formatShare(2000, 2000)).toBe('> 99.9%');
    expect(formatShare(0, 2000)).toBe('< 0.1%');
  });

  it.each(['ko', 'en'] as const)('never prints a false 100%% or 0%% (%s)', (lang) => {
    initLang(lang);
    for (const n of [1, 2, 3, 7, 10, 99, 100, 500, 999, 1000, 1001, 4999, 20000]) {
      for (let k = 0; k <= n; k += Math.max(1, Math.floor(n / 400))) {
        const text = formatShare(k, n);
        expect(text, `${k}/${n}`).not.toMatch(/^(100(\.0)?|0(\.0)?)\s?%$/);
        expect(text).not.toMatch(/100\.0|(^|\D)0\.0\s?%/);
      }
      for (const k of [1, n - 1].filter((v) => v > 0 && v < n)) {
        expect(formatShare(k, n)).not.toMatch(/^(100|0)\s?%$/);
      }
    }
  });
});

describe('formatBound', () => {
  it('prints exact 0 and 1 as 0% and 100% and never rounds other bounds onto them', () => {
    initLang('en');
    expect(formatBound(1, 500)).toBe('100%');
    expect(formatBound(0, 500)).toBe('0%');
    expect(formatBound(0.9962, 500)).toBe('99.6%');
    expect(formatBound(0.0004, 500)).toBe('0.04%');
    expect(formatBound(0.4321, 500)).toBe('43%');
    expect(formatBound(0.4321, 5000)).toBe('43.2%');
  });

  it('prints bounds within 0.005 points of 0% or 100% as < 0.01% / > 99.99%', () => {
    initLang('en');
    expect(formatBound(0.99996, 20000)).toBe('> 99.99%');
    expect(formatBound(0.00004, 20000)).toBe('< 0.01%');
    initLang('ko');
    expect(formatBound(0.99996, 20000)).toBe('> 99.99%');
    expect(formatBound(0.00004, 20000)).toBe('< 0.01%');
  });

  it('never prints 0.00% or 100.00% for any outcome of 20,000 runs', () => {
    initLang('en');
    const n = 20000;
    for (let k = 0; k <= n; k++) {
      const iv = wilson(k, n);
      for (const [x, s] of [
        [iv.lo, formatBound(iv.lo, n)],
        [iv.hi, formatBound(iv.hi, n)],
      ] as const) {
        if (x > 1e-9 && x < 1 - 1e-9) expect(s).not.toMatch(/^(0(\.0+)?|100(\.0+)?)%$/);
        expect(s).not.toMatch(/^(0\.0+|100\.0+)%$/);
      }
    }
    // The case from review: 19,999 of 20,000.
    expect(formatBound(wilson(19999, n).hi, n)).toBe('> 99.99%');
  });
});

describe('headline', () => {
  it('leads with counts out of the run total in both languages', () => {
    const a = agg(498, 1, 1);
    initLang('ko');
    expect(headline(leadingOutcome(a))).toBe(
      '이 모델로 500번 싸워 보니 T-Rex 쪽이 498번 이겼습니다 (> 99%).',
    );
    initLang('en');
    expect(headline(leadingOutcome(a))).toBe(
      'In 500 simulated battles under this model, the T-Rex side won 498 (> 99%).',
    );
  });

  it('names the species of the shown results and handles draws', () => {
    initLang('en');
    setNamePair({ heavySpecies: 'elephant', packSpecies: 'lion' });
    expect(headline(leadingOutcome(agg(100, 1200, 700)))).toBe(
      'In 2,000 simulated battles under this model, the lion side won 1,200 (60.0%).',
    );
    expect(headline(leadingOutcome(agg(1, 2, 7)))).toBe(
      'In 10 simulated battles under this model, 7 reached the time limit undecided (70%).',
    );
    initLang('ko');
    expect(headline(leadingOutcome(agg(100, 1200, 700)))).toBe(
      '이 모델로 2,000번 싸워 보니 사자 쪽이 1,200번 이겼습니다 (60.0%).',
    );
  });

  it('explains the interval in plain words, as run precision only', () => {
    initLang('en');
    const line = precisionLine(leadingOutcome(agg(500, 0, 0)));
    expect(line).toContain('between 99% and 100%');
    expect(line).toContain('number of runs');
    initLang('ko');
    expect(precisionLine(leadingOutcome(agg(250, 250, 0)))).toContain('46%–54%');
  });
});

describe('formatCountShare', () => {
  it('prints exactly none or all of the runs as 0% / 100% and nothing else onto them', () => {
    initLang('en');
    expect(formatCountShare(0, 500)).toBe('0%');
    expect(formatCountShare(500, 500)).toBe('100%');
    expect(formatCountShare(499, 500)).toBe('> 99%');
    expect(formatCountShare(1, 500)).toBe('< 1%');
    expect(formatCountShare(3, 0)).toBe('—');
  });
});
