import { afterEach, describe, expect, it } from 'vitest';
import { correctionNote } from '../src/ui/form';
import { initLang } from '../src/ui/i18n';

afterEach(() => initLang('ko'));

describe('correctionNote', () => {
  it('says nothing when the typed value was kept', () => {
    expect(correctionNote(250, 250, [1, 5000])).toBeNull();
  });

  it('names the range and the stored value after clamping', () => {
    initLang('en');
    expect(correctionNote(99999, 5000, [1, 5000])).toBe('Outside 1–5,000; set to 5,000.');
    initLang('ko');
    expect(correctionNote(0, 1, [1, 5000])).toBe('1–5,000 범위 밖이라 1에 맞췄습니다.');
  });

  it('explains rounding to a whole number and restoring an emptied field', () => {
    initLang('en');
    expect(correctionNote(12.4, 12, [1, 500])).toBe('Whole numbers only; set to 12.');
    expect(correctionNote(null, 10, [1, 500])).toBe(
      'The field was empty; restored the previous value: 10',
    );
  });
});
