import './reset.css';
import { clearSiteData } from './ui/site-data';
import { reloadUrl } from './ui/version-model';

/** Keep the message on screen briefly so the hand-off does not look like a flash. */
const MIN_VISIBLE_MS = 400;

const shown = new Promise<void>((resolve) => window.setTimeout(resolve, MIN_VISIBLE_MS));

// The response's Clear-Site-Data header has already run where supported; repeat the
// JavaScript-reachable part for browsers without it and for visitors who open /reset/ directly.
void Promise.allSettled([clearSiteData(), shown]).then(() => {
  location.replace(reloadUrl(Date.now(), location.hash));
});
