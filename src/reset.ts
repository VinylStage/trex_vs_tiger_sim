import './reset.css';
import { clearSiteData } from './ui/site-data';
import { reloadUrl } from './ui/version-model';

/** Keep the message on screen briefly so the hand-off does not look like a flash. */
const MIN_VISIBLE_MS = 400;

const target = reloadUrl(Date.now(), location.hash);

// The fallback link (shown by CSS after a few seconds) leads to the same URL as the automatic
// hand-off, so it keeps the scenario in the fragment too. Without JavaScript it stays `/`.
const fallback = document.querySelector<HTMLAnchorElement>('.reset-fallback a');
if (fallback) fallback.href = target;

const shown = new Promise<void>((resolve) => window.setTimeout(resolve, MIN_VISIBLE_MS));

// The response's Clear-Site-Data header has already run where supported; repeat the
// JavaScript-reachable part for browsers without it and for visitors who open /reset/ directly.
void Promise.allSettled([clearSiteData(), shown]).then(() => {
  location.replace(target);
});
