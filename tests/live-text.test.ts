import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flash, LIVE_TEXT_DELAY_MS, setLiveText } from '../src/share/share-ui';

/** Only `textContent` is used by the live-text helpers. */
const region = (text = ''): HTMLElement => ({ textContent: text }) as HTMLElement;

describe('live region text (WCAG 4.1.3, #69)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('empties the region first and writes the text after a delay', () => {
    const el = region('old');
    setLiveText(el, 'copied');
    expect(el.textContent).toBe('');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS);
    expect(el.textContent).toBe('copied');
  });

  it('changes the text again when the same message repeats, so it is re-announced', () => {
    const el = region();
    setLiveText(el, 'copied');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS);
    setLiveText(el, 'copied');
    expect(el.textContent).toBe('');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS);
    expect(el.textContent).toBe('copied');
  });

  it('keeps only the latest of two quick messages', () => {
    const el = region();
    setLiveText(el, 'first');
    setLiveText(el, 'second');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS);
    expect(el.textContent).toBe('second');
  });

  it('flash clears its own message after 3 s, but not a newer one', () => {
    const el = region();
    flash(el, 'saved');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS);
    expect(el.textContent).toBe('saved');
    vi.advanceTimersByTime(3000);
    expect(el.textContent).toBe('');
    flash(el, 'one');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS + 2000);
    flash(el, 'two');
    vi.advanceTimersByTime(LIVE_TEXT_DELAY_MS + 1500);
    expect(el.textContent).toBe('two');
  });
});
