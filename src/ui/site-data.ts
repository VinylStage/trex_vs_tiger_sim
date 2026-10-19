import { expiringCookies, parseCookieNames } from './version-model';

/** Upper bound on the asynchronous clean-up, so a stuck browser API never blocks the reload. */
const ASYNC_TIMEOUT_MS = 5000;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Best-effort client-side clean-up of everything this origin can reach from JavaScript: Cache
 * Storage, service worker registrations, localStorage, sessionStorage and this host's
 * JavaScript-visible cookies. The `/reset/` page's `Clear-Site-Data` header repeats the cache and
 * storage part on the server side; see docs/VERSIONING.md.
 */
export async function clearSiteData(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (typeof caches !== 'undefined') {
    tasks.push(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister()))),
    );
  }
  await Promise.race([Promise.allSettled(tasks), delay(ASYNC_TIMEOUT_MS)]);

  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      window[storage].clear();
    } catch {
      // Blocked storage (privacy settings, sandboxing): nothing to clear.
    }
  }

  try {
    const names = parseCookieNames(document.cookie);
    const secure = location.protocol === 'https:';
    for (const c of expiringCookies(names, location.hostname, secure)) document.cookie = c;
  } catch {
    // Cookie access can throw in sandboxed documents.
  }
}
