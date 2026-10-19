import { locale, t } from './i18n';

export function formatPct(p: number, digits = 1): string {
  if (!Number.isFinite(p)) return '—';
  return new Intl.NumberFormat(locale(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(p);
}

export function formatNum(n: number, digits = 1): string {
  if (Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return '∞';
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(n);
}

/** Always exactly `digits` decimals (e.g. 0.30). */
export function formatFixed(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatInt(n: number): string {
  return formatNum(Math.round(n), 0);
}

/** Human duration: `42.5초` / `3분 05초` style, in the current language. */
export function formatDuration(seconds: number, digits = 1): string {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, seconds);
  if (s < 60) return t('time.sec', { s: formatNum(s, digits) });
  if (s >= 3600) {
    const totalMin = Math.round(s / 60);
    return t('time.hourMin', { h: formatInt(Math.floor(totalMin / 60)), m: totalMin % 60 });
  }
  let m = Math.floor(s / 60);
  let rest = Math.round(s - m * 60);
  if (rest === 60) {
    m += 1;
    rest = 0;
  }
  return t('time.minSec', { m: formatInt(m), s: String(rest).padStart(2, '0') });
}
