import { afterEach, describe, expect, it } from 'vitest';
import { formatDuration, formatFixed, formatInt, formatNum, formatPct } from '../src/ui/format';
import { initLang } from '../src/ui/i18n';

afterEach(() => {
  initLang('ko');
});

describe('formatDuration', () => {
  it('shows seconds under a minute with the given decimals', () => {
    initLang('en');
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(42.46)).toBe('42.5 s');
    expect(formatDuration(42.46, 0)).toBe('42 s');
    expect(formatDuration(59.94)).toBe('59.9 s');
  });

  it('shows minutes and zero-padded seconds from 60 s', () => {
    initLang('en');
    expect(formatDuration(60)).toBe('1 min 00 s');
    expect(formatDuration(185)).toBe('3 min 05 s');
    expect(formatDuration(3599)).toBe('59 min 59 s');
  });

  it('rolls 59.5+ seconds over into the next minute instead of printing 60', () => {
    initLang('en');
    expect(formatDuration(119.6)).toBe('2 min 00 s');
    expect(formatDuration(179.5)).toBe('3 min 00 s');
    expect(formatDuration(119.4)).toBe('1 min 59 s');
  });

  it('shows hours and minutes from one hour, rounded to the minute', () => {
    initLang('en');
    expect(formatDuration(3600)).toBe('1 h 0 min');
    expect(formatDuration(3600 + 29)).toBe('1 h 0 min');
    expect(formatDuration(3600 + 30)).toBe('1 h 1 min');
    expect(formatDuration(2 * 3600 + 59 * 60 + 40)).toBe('3 h 0 min');
  });

  it('clamps negatives to 0 and shows a dash for non-finite values', () => {
    initLang('en');
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('uses the Korean units on the Korean page', () => {
    initLang('ko');
    expect(formatDuration(42.5)).toBe('42.5초');
    expect(formatDuration(185)).toBe('3분 05초');
    expect(formatDuration(7200)).toBe('2시간 0분');
  });
});

describe('number formats', () => {
  it('formatPct: fixed decimals, dash for non-finite', () => {
    initLang('en');
    expect(formatPct(0.5)).toBe('50.0%');
    expect(formatPct(0.12345, 2)).toBe('12.35%');
    expect(formatPct(Number.NaN)).toBe('—');
    expect(formatPct(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formatNum: up to `digits` decimals, grouping, dash for NaN and ∞ for infinity', () => {
    initLang('en');
    expect(formatNum(1234.56)).toBe('1,234.6');
    expect(formatNum(2)).toBe('2');
    expect(formatNum(Number.NaN)).toBe('—');
    expect(formatNum(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatNum(Number.NEGATIVE_INFINITY)).toBe('∞');
  });

  it('formatFixed: always exactly `digits` decimals', () => {
    initLang('en');
    expect(formatFixed(0.3, 2)).toBe('0.30');
    expect(formatFixed(Number.NaN, 2)).toBe('—');
  });

  it('formatInt: rounds half up and groups thousands', () => {
    initLang('en');
    expect(formatInt(20000)).toBe('20,000');
    expect(formatInt(2.5)).toBe('3');
  });
});
