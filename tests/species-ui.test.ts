import { afterEach, describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/sim/config';
import { HEAVY_SPECIES, speciesRanges } from '../src/sim/species';
import { GLYPH, heavyLengthForRadius, heavyLengthPx } from '../src/ui/replay/glyphs';
import {
  PRESETS,
  matchupInfo,
  matchupNoteText,
  presetLabel,
  qualifiedParamLabel,
  roleEdited,
  withPreset,
  withSpecies,
} from '../src/ui/form';
import {
  initLang,
  paramLabel,
  setNamePair,
  speciesCounter,
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
    expect(speciesVars()).toEqual(speciesVars({ heavySpecies: 'elephant', packSpecies: 'lion' }));
    expect(t('outcome.heavy')).toBe('Elephant victory');
    expect(t('stat.killed')).toBe('Lions incapacitated (mean)');
    expect(t('outcome.heavy', { Heavy: 'X' })).toBe('X victory');
    initLang('ko');
    expect(t('verdict.pack', { n: '20', k: '1', pct: '5%' })).toBe(
      '이 모델로 20번 싸워 보니 사자 쪽이 1번 이겼습니다 (5%).',
    );
  });

  it('keeps the default English texts for T-Rex and tigers', () => {
    initLang('en');
    expect(t('stat.exchangeSub')).toBe('tigers incapacitated per T-Rex lost');
    expect(t('chart.favHeavy')).toBe('favours T-Rex →');
    expect(t('field.packCount')).toBe('Tiger count');
  });

  it('counts Homo erectus with 명 in Korean and every animal with 마리', () => {
    initLang('ko');
    const pair = { heavySpecies: 'homoErectus', packSpecies: 'wolf' } as const;
    expect(speciesCounter('homoErectus')).toBe('명');
    for (const id of ['trex', 'mammoth', 'wolf', 'tiger'] as const) {
      expect(speciesCounter(id)).toBe('마리');
    }
    expect(teamLabel('wolf', 8)).toBe('늑대 8마리');
    expect(teamLabel('homoErectus', 1)).toBe('호모 에렉투스 1명');
    expect(t('stat.ofN', { n: '1', counter: speciesCounter('homoErectus') })).toBe('1명 중');
    expect(t('stat.ofN', { n: '8', counter: speciesCounter('wolf') })).toBe('8마리 중');
    setNamePair(pair);
    expect(t('stat.exchangeSub')).toBe('호모 에렉투스 1명 손실당 전투 불능 늑대');
    expect(
      t('replay.scene', {
        time: '0:10',
        alive: '1',
        total: '1',
        approach: '8',
        latched: '0',
        recover: '0',
        out: '0',
        dead: '0',
      }),
    ).toMatch(/^0:10: 호모 에렉투스 1명 중 1명 생존\./);
    setNamePair({ heavySpecies: 'trex', packSpecies: 'tiger' });
    expect(t('stat.exchangeSub')).toBe('T-Rex 1마리 손실당 전투 불능 호랑이');
    // English has no counter word.
    initLang('en');
    setNamePair(pair);
    expect(speciesCounter('homoErectus')).toBe('');
    expect(t('stat.ofN', { n: '1', counter: speciesCounter('homoErectus') })).toBe('of 1');
    expect(t('stat.exchangeSub')).toBe('wolves incapacitated per Homo erectus lost');
  });

  it('names the woolly mammoth and Homo erectus in both languages', () => {
    initLang('en');
    expect(teamLabel('mammoth', 1)).toBe('1 mammoth');
    expect(teamLabel('mammoth', 12)).toBe('12 mammoths');
    expect(teamLabel('homoErectus', 1)).toBe('1 Homo erectus');
    expect(teamLabel('homoErectus', 100)).toBe('100 Homo erectus');
    expect(paramLabel('heavy.biteForce', 'hands')).toBe('Bare-hand strike and grip force');
    initLang('ko');
    expect(teamLabel('homoErectus', 100)).toBe('호모 에렉투스 100명');
    expect(teamLabel('mammoth', 1)).toBe('매머드 1마리');
    expect(paramLabel('heavy.biteForce', 'hands')).toBe('맨손 타격 · 붙잡기 힘');
  });

  it('adds the thought-experiment note only to matchups with a hominin', () => {
    initLang('en');
    expect(matchupNoteText({ heavySpecies: 'trex', packSpecies: 'homoErectus' })).toContain(
      'does not depict or endorse real violence',
    );
    expect(matchupNoteText({ heavySpecies: 'homoErectus', packSpecies: 'wolf' })).not.toBeNull();
    expect(matchupNoteText({ heavySpecies: 'mammoth', packSpecies: 'wolf' })).toBeNull();
    expect(matchupNoteText({ heavySpecies: 'trex', packSpecies: 'tiger' })).toBeNull();
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
    initLang('en');
    expect(matchupInfo({ heavySpecies: 'homoErectus', packSpecies: 'lion' }).text).toBe(
      'No recorded overlap',
    );
    expect(matchupInfo({ heavySpecies: 'elephant', packSpecies: 'wolf' }).text).toBe(
      'No recorded encounters',
    );
    initLang('ko');
    expect(matchupInfo({ heavySpecies: 'homoErectus', packSpecies: 'lion' }).text).toBe(
      '기록된 조우 없음',
    );
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
    for (const id of ['elephant', 'buffalo', 'brownBear', 'mammoth', 'homoErectus'] as const) {
      const s = HEAVY_SPECIES[id];
      const len = heavyLengthForRadius(s.ranges.bodyRadius.mode);
      // The half-base stays inside the ring where the smallest pack animal latches.
      expect(GLYPH.heavyHalfBase * len).toBeLessThan(s.ranges.bodyRadius.min + 0.5);
    }
  });
});
