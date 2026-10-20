import { afterEach, describe, expect, it } from 'vitest';
import type { AggregateResult, Sensitivity } from '../src/sim/montecarlo';
import { wilson } from '../src/sim/stats';
import { histogramTable, nextHit, outcomeTable, tornadoTable, wrapLabel } from '../src/ui/charts';
import { initLang } from '../src/ui/i18n';

afterEach(() => initLang('ko'));

describe('chart data tables', () => {
  it('lists every outcome with its count, honest share and interval', () => {
    initLang('en');
    const agg = {
      n: 500,
      heavyWins: 500,
      packWins: 0,
      draws: 0,
      pHeavy: wilson(500, 500),
      pPack: wilson(0, 500),
      pDraw: wilson(0, 500),
    } as AggregateResult;
    const table = outcomeTable(agg);
    expect(table.head).toEqual(['Outcome', 'Count', 'Share', '95% interval']);
    expect(table.rows).toEqual([
      ['T-Rex victory', '500 / 500', '> 99%', '99%–100%'],
      ['Tiger victory', '0 / 500', '< 1%', '0%–1%'],
      ['Draw', '0 / 500', '< 1%', '0%–1%'],
    ]);
  });

  it('lists every histogram bin, empty ones included', () => {
    initLang('en');
    const table = histogramTable({ min: 0, max: 30, counts: [3, 0, 1] }, (lo, hi) => `${lo}–${hi}`);
    expect(table.rows).toEqual([
      ['0–10', '3', '75%'],
      ['10–20', '0', '0%'],
      ['20–30', '1', '25%'],
    ]);
  });

  it('never rounds a bin share onto 0% or 100%', () => {
    initLang('en');
    const table = histogramTable({ min: 0, max: 20, counts: [4999, 1] }, String);
    expect(table.rows.map((r) => r[2])).toEqual(['> 99.9%', '< 0.1%']);
    const all = histogramTable({ min: 0, max: 20, counts: [0, 50] }, String);
    expect(all.rows.map((r) => r[2])).toEqual(['0%', '100%']);
  });

  it('lists the plotted sensitivities with sign and the side they favour', () => {
    initLang('en');
    const sens: Sensitivity[] = [
      { id: 'heavy.mass', rho: 0.5 },
      { id: 'pack.mass', rho: -0.25 },
      { id: 'pack.dps', rho: 0 },
    ];
    expect(tornadoTable(sens, (id) => id).rows).toEqual([
      ['heavy.mass', '+0.50', 'favours T-Rex →'],
      ['pack.mass', '−0.25', '← favours tigers'],
      ['pack.dps', '+0.00', 'no effect'],
    ]);
    expect(tornadoTable(sens, (id) => id, 2).rows).toHaveLength(2);
  });
});

describe('keyboard tooltip', () => {
  it('steps through the values with wrapping arrows and jumps with Home/End', () => {
    expect(nextHit('ArrowRight', -1, 3)).toBe(0);
    expect(nextHit('ArrowDown', 2, 3)).toBe(0);
    expect(nextHit('ArrowLeft', -1, 3)).toBe(2);
    expect(nextHit('ArrowUp', 1, 3)).toBe(0);
    expect(nextHit('Home', 2, 3)).toBe(0);
    expect(nextHit('End', 0, 3)).toBe(2);
    expect(nextHit('a', 0, 3)).toBeNull();
    expect(nextHit('ArrowRight', -1, 0)).toBeNull();
  });
});

describe('wrapLabel', () => {
  const measure = (s: string): number => s.length * 6;

  it('keeps a label that fits on one line', () => {
    expect(wrapLabel('T-Rex · 체중', 120, measure)).toEqual(['T-Rex · 체중']);
  });

  it('wraps at spaces onto a second line and cuts only what still does not fit', () => {
    // 60 px = 10 characters per line.
    expect(wrapLabel('T-Rex · bite angle (deg)', 60, measure)).toEqual(['T-Rex ·', 'bite angl…']);
    expect(wrapLabel('Tiger · morale', 60, measure)).toEqual(['Tiger ·', 'morale']);
  });

  it('cuts a single word that is too long with an ellipsis', () => {
    expect(wrapLabel('Spearmanrho', 30, measure)).toEqual(['Spea…']);
  });
});
