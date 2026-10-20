import { setLiveText } from '../share/share-ui';

/*
 * One persistent, visually hidden live region for the simulator's status messages (WCAG 4.1.3,
 * #69). Screen readers skip text that is already inside a live region when the region appears,
 * and regions inside `hidden` or rebuilt subtrees are not reliably watched. This region is created
 * once, outside every rebuilt subtree, and its text is always set after it is in the tree.
 */

let region: HTMLElement | null = null;

/** Announce `text` politely; repeating the same text announces it again. */
export function announce(text: string): void {
  if (!region) {
    region = document.createElement('div');
    region.className = 'visually-hidden';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.append(region);
  }
  setLiveText(region, text);
}
