import { afterEach, describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/sim/config';
import { HEAVY_SPECIES, speciesRanges } from '../src/sim/species';
import { GLYPH, heavyLengthForRadius, heavyLengthPx } from '../src/ui/replay/glyphs';
import {
  PRESETS,
  matchupInfo,
  presetLabel,
  qualifiedParamLabel,
  roleEdited,
  withPreset,
  withSpecies,
} from '../src/ui/form';
import {
  getNamePair,
  initLang,
  paramLabel,
  setNamePair,
  speciesVars,
  t,
  teamLabel,
} from '../src/ui/i18n';

afterEach(() => {
  initLang('ko');
  setNamePair({ heavySpecies: 'trex', packSpecies: 'tiger' });
});

describe('species names in messages', () => {
  it('fills singular, plural and capitalised names in English', () => {
    initLang('en');
    const v = speciesVars({ heavySpecies: 'brownBear', packSpecies: 'wolf' });
    expect(v).toMatchObject({
      heavy: 'brown bear',
      heavyPl: 'brown bears',
      Heavy: 'Brown bear',
      pack: 'wolf',
      packPl: 'wolves',
      PackPl: 'Wolves',
    });
    expect(teamLabel('wolf', 1)).toBe('1 wolf');
    expect(teamLabel('wolf', 8)).toBe('8 wolves');
    expect(teamLabel('trex', 10)).toBe('10 T-Rex');
  });

  it('uses the same name for every form in Korean, with the count after it', () => {
    initLang('ko');
    const v = speciesVars({ heavySpecies: 'elephant', packSpecies: 'lion' });
    expect(new Set(Object.values(v).slice(0, 4))).toEqual(new Set(['코끼리']));
    expect(teamLabel('lion', 30)).toBe('사자 30마리');
  });

  it('names the current pair by default and lets explicit vars win', () => {
    initLang('en');
    setNamePair({ heavySpecies: 'elephant', packSpecies: 'lion' });
    expect(getNamePair()).toEqual({ heavySpecies: 'elephant', packSpecies: 'lion' });
    expect(t('outcome.heavy')).toBe('Elephant victory');
    expect(t('stat.killed')).toBe('Lions killed (mean)');
    expect(t('outcome.heavy', { Heavy: 'X' })).toBe('X victory');
    initLang('ko');
    expect(t('verdict.pack', { n: '20', k: '1', pct: '5%' })).toBe(
      '이 모델로 20번 싸워 보니 사자 쪽이 1번 이겼습니다 (5%).',
    );
  });

  it('keeps the default English texts for T-Rex and tigers', () => {
    initLang('en');
    expect(t('stat.exchangeSub')).toBe('tigers killed per T-Rex lost');
    expect(t('chart.favHeavy')).toBe('favours T-Rex →');
    expect(t('field.packCount')).toBe('Tiger count');
  });

  it('relabels the weapon of non-biting heavies', () => {
    initLang('en');
    expect(paramLabel('heavy.biteForce')).toBe('Bite force');
    expect(paramLabel('heavy.biteForce', 'tusk')).toBe('Tusk and trample force');
    expect(paramLabel('heavy.biteInterval', 'horn')).toBe('Attack interval');
    expect(paramLabel('heavy.mass', 'horn')).toBe('Body mass');
    expect(
      qualifiedParamLabel('heavy.biteForce', { heavySpecies: 'buffalo', packSpecies: 'lion' }),
    ).toBe('Buffalo · Horn force');
    expect(qualifiedParamLabel('pack.dps', { heavySpecies: 'buffalo', packSpecies: 'lion' })).toBe(
      'Lion · Damage per second',
    );
  });
});

describe('matchup presets and species changes', () => {
  it('starts with the default T-Rex vs tigers scenario', () => {
    const d = defaultConfig();
    const first = PRESETS[0];
    expect(first).toMatchObject({
      heavySpecies: d.heavySpecies,
      packSpecies: d.packSpecies,
      heavyCount: d.heavyCount,
      packCount: d.packCount,
      runs: d.runs,
    });
    if (!first) throw new Error('no preset');
    expect(withPreset(d, first)).toEqual(d);
    initLang('en');
    expect(presetLabel(first)).toBe('10 T-Rex vs 100 tigers (default)');
  });

  it('offers the documented pairings', () => {
    const documented = PRESETS.filter((p) => matchupInfo(p).kind === 'documented');
    expect(documented.length).toBeGreaterThanOrEqual(4);
    expect(matchupInfo(PRESETS[0] ?? defaultConfig()).kind).toBe('neverMet');
    expect(matchupInfo({ heavySpecies: 'elephant', packSpecies: 'lion' }).href).toBe(
      '/model/#matchup-elephants-and-lions',
    );
  });

  it('resets only the changed side to the new species presets', () => {
    const c = defaultConfig();
    c.params['pack.dps'] = { min: 1, mode: 2, max: 3 };
    c.params['heavy.mass'] = { min: 6000, mode: 7000, max: 8000 };
    expect(roleEdited(c, 'heavy')).toBe(true);
    const next = withSpecies(c, 'heavy', 'elephant');
    expect(next.heavySpecies).toBe('elephant');
    expect(next.params['heavy.mass']).toEqual(speciesRanges('elephant', 'tiger')['heavy.mass']);
    expect(next.params['pack.dps']).toEqual({ min: 1, mode: 2, max: 3 });
    expect(roleEdited(next, 'heavy')).toBe(false);
    expect(roleEdited(next, 'pack')).toBe(true);
    expect(c.heavySpecies).toBe('trex');
  });
});

describe('replay glyph sizes per species', () => {
  it('keeps the T. rex triangle at exactly 7 m and scales others by body radius', () => {
    expect(heavyLengthForRadius(HEAVY_SPECIES.trex.ranges.bodyRadius.mode)).toBe(7);
    expect(heavyLengthPx(10)).toBe(70);
    expect(heavyLengthPx(10, heavyLengthForRadius(2.5))).toBe(heavyLengthPx(10));
    for (const id of ['elephant', 'buffalo', 'brownBear'] as const) {
      const s = HEAVY_SPECIES[id];
      const len = heavyLengthForRadius(s.ranges.bodyRadius.mode);
      // The half-base stays inside the ring where the smallest pack animal latches.
      expect(GLYPH.heavyHalfBase * len).toBeLessThan(s.ranges.bodyRadius.min + 0.5);
    }
  });
});
