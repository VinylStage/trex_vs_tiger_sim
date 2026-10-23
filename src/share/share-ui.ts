import type { Lang } from '../i18n/lang.ts';
import { sm } from './messages.ts';
import './share-ui.css';

/*
 * Browser helpers shared by the simulator and the result page (docs/SHARING.md): clipboard with a
 * selectable fallback, the image save/share chain and the in-app-browser image overlay.
 * DOM is built with createElement only (strict CSP, no inline styles).
 */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function modal(lang: Lang, cls: string, ...children: Node[]): HTMLDialogElement {
  const dlg = el('dialog', `share-dialog ${cls}`);
  const close = el('button', 'share-dialog-close', sm(lang, 'copy.close'));
  close.type = 'button';
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.append(...children, close);
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

/**
 * Show `text` in a selected readonly field so the person can copy it by hand (clipboard API
 * missing, denied, or not allowed in this context).
 */
export function showCopyFallback(text: string, lang: Lang): HTMLDialogElement {
  const title = el('p', 'share-dialog-title', sm(lang, 'copy.fallbackTitle'));
  title.id = `copy-fallback-${Date.now()}`;
  const field = el('textarea', 'share-dialog-field');
  field.readOnly = true;
  field.value = text;
  field.rows = Math.min(8, Math.max(2, text.split('\n').length + 1));
  field.setAttribute('aria-labelledby', title.id);
  const dlg = modal(lang, 'copy-fallback', title, field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);
  return dlg;
}

/** Copy `text` silently; resolves false when the clipboard is missing or refused. */
export async function tryCopy(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copy `text`; on failure show the selectable fallback. Resolves true when copied. */
export async function copyText(text: string, lang: Lang): Promise<boolean> {
  if (await tryCopy(text)) return true;
  showCopyFallback(text, lang);
  return false;
}

/** In-app browsers that ignore `<a download>` and often lack Web Share for files. */
export const IN_APP_UA = /KAKAOTALK|Instagram|NAVER\(inapp|FBAN|FBAV|\bLine\//i;

export const isInAppBrowser = (ua: string): boolean => IN_APP_UA.test(ua);

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException ? err.name === 'AbortError' : false;

/** Show the image full-screen with a long-press hint (in-app browsers). */
export function showImageOverlay(dataUrl: string, alt: string, lang: Lang): HTMLDialogElement {
  const img = el('img', 'share-overlay-img');
  img.src = dataUrl;
  img.alt = alt;
  const hint = el('p', 'share-overlay-hint', sm(lang, 'result.overlayHint'));
  return modal(lang, 'share-overlay', img, hint);
}

/** Download a blob through `<a download>`; the object URL is revoked a little later. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type SaveOutcome = 'shared' | 'downloaded' | 'overlay' | 'cancelled';

/**
 * Save or share a prepared image. The blob must exist before the click, so the share call keeps
 * the user activation. Order: in-app browser → overlay; `navigator.canShare({files})` →
 * `navigator.share` (AbortError = cancelled, other errors fall through); else `<a download>`.
 * `preferShare: false` skips Web Share (the "save" button on desktop).
 */
export async function saveImage(
  image: { blob: Blob; dataUrl: string; fileName: string; alt: string },
  lang: Lang,
  opts: { preferShare: boolean; title?: string; text?: string },
): Promise<SaveOutcome> {
  if (isInAppBrowser(navigator.userAgent)) {
    showImageOverlay(image.dataUrl, image.alt, lang);
    return 'overlay';
  }
  if (opts.preferShare && typeof navigator.canShare === 'function') {
    const file = new File([image.blob], image.fileName, { type: image.blob.type });
    const data: ShareData = { files: [file] };
    if (opts.title) data.title = opts.title;
    if (opts.text) data.text = opts.text;
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share(data);
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
      }
    }
  }
  downloadBlob(image.blob, image.fileName);
  return 'downloaded';
}

/** Web Share for a link or text; resolves 'unavailable' when there is no Web Share. */
export async function shareLink(data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (typeof navigator.share !== 'function') return 'unavailable';
  const d: ShareData = {};
  if (data.title) d.title = data.title;
  if (data.text) d.text = data.text;
  if (data.url) d.url = data.url;
  if (typeof navigator.canShare === 'function' && !navigator.canShare(d)) return 'unavailable';
  try {
    await navigator.share(d);
    return 'shared';
  } catch (err) {
    return isAbort(err) ? 'cancelled' : 'unavailable';
  }
}

/** Delay between emptying a live region and writing its new text. */
export const LIVE_TEXT_DELAY_MS = 100;
const pendingText = new WeakMap<HTMLElement, number>();

/**
 * Write `text` into a live region so that it is announced, also when it equals the current text:
 * empty the region now and write after a short delay, a change screen readers always pick up
 * (WCAG 4.1.3, #69). The region itself must already be in the document and rendered.
 */
export function setLiveText(target: HTMLElement, text: string, then?: () => void): void {
  window.clearTimeout(pendingText.get(target));
  target.textContent = '';
  pendingText.set(
    target,
    window.setTimeout(() => {
      pendingText.delete(target);
      target.textContent = text;
      then?.();
    }, LIVE_TEXT_DELAY_MS),
  );
}

/** A short status line that clears itself. */
export function flash(target: HTMLElement, text: string): void {
  setLiveText(target, text, () => {
    window.setTimeout(() => {
      if (target.textContent === text) target.textContent = '';
    }, 3000);
  });
}
