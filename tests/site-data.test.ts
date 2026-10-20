import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSiteData } from '../src/ui/site-data';

/** Fake browser surface for clearSiteData: storage, Cache Storage, service workers, cookies. */
function fakeBrowser(opts: { cookie?: string; hangCaches?: boolean; throwingStorage?: boolean }) {
  const cleared: string[] = [];
  const cookiesSet: string[] = [];
  const storage = (name: string) => ({
    clear: () => {
      if (opts.throwingStorage) throw new Error('SecurityError');
      cleared.push(name);
    },
  });
  const deletedCaches: string[] = [];
  const unregistered: number[] = [];
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    localStorage: storage('localStorage'),
    sessionStorage: storage('sessionStorage'),
  });
  vi.stubGlobal('caches', {
    keys: () =>
      opts.hangCaches ? new Promise<string[]>(() => undefined) : Promise.resolve(['v1', 'v2']),
    delete: (k: string) => {
      deletedCaches.push(k);
      return Promise.resolve(true);
    },
  });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistrations: () =>
        Promise.resolve([1, 2].map((id) => ({ unregister: () => unregistered.push(id) }))),
    },
  });
  vi.stubGlobal('location', { protocol: 'https:', hostname: 'trex-vs-tiger.vinylims.com' });
  const doc = {
    get cookie() {
      return opts.cookie ?? '';
    },
    set cookie(v: string) {
      cookiesSet.push(v);
    },
  };
  vi.stubGlobal('document', doc);
  return { cleared, cookiesSet, deletedCaches, unregistered };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('clearSiteData', () => {
  it('clears caches, service workers, both storages and every visible cookie', async () => {
    const b = fakeBrowser({ cookie: 'a=1; b=2' });
    await clearSiteData();
    expect(b.deletedCaches).toEqual(['v1', 'v2']);
    expect(b.unregistered).toEqual([1, 2]);
    expect(b.cleared).toEqual(['localStorage', 'sessionStorage']);
    expect(b.cookiesSet.length).toBeGreaterThan(0);
    for (const name of ['a', 'b']) {
      expect(
        b.cookiesSet.some((c) => c.startsWith(`${name}=`) && /expires=|max-age=0/i.test(c)),
      ).toBe(true);
    }
  });

  it('does not wait more than 5 s for a stuck Cache Storage API', async () => {
    vi.useFakeTimers();
    const b = fakeBrowser({ hangCaches: true });
    const done = clearSiteData();
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(b.cleared).toEqual(['localStorage', 'sessionStorage']);
  });

  it('survives blocked storage and an empty cookie jar', async () => {
    const b = fakeBrowser({ throwingStorage: true });
    await expect(clearSiteData()).resolves.toBeUndefined();
    expect(b.cleared).toEqual([]);
    expect(b.cookiesSet).toEqual([]);
  });
});
