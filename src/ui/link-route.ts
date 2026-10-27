import { checkFromHash, type ResultSummary } from '../share/result-codec';
import { freeCheckFromHash, type FreeResultSummary } from '../share/free-result-codec';
import { defaultConfig, type ScenarioConfig } from '../sim/config';
import type { FreeConfig } from '../sim/free/config';
import { configFromHash } from './share';
import { freeConfigFromHash, freeHashModelNewer } from './share-free';

/*
 * Link routing (docs/SHARING.md#link-routing): what a simulator fragment opens. The app reads its
 * starting fragment through `routeLink`, so the tests that run every old link type through it
 * (tests/link-routing.test.ts) check what the play page actually opens. A link that reaches the
 * lobby (`/`, `/en/`) is first forwarded to the play page with its fragment unchanged
 * (`playForwardUrl` in src/pages/routes.ts), so it opens exactly as it did on `/` before.
 */

/** What a fragment opens: the mode, its config and the shared snapshot of a "Run it yourself" link. */
export type LinkRoute =
  | {
      mode: 'free';
      config: FreeConfig;
      /** The payload names a newer model: the defaults open and the address is kept (ADR-0008). */
      newerModel: boolean;
      check: FreeResultSummary | null;
    }
  | { mode: 'classic'; config: ScenarioConfig; check: ResultSummary | null };

/**
 * Route a location hash. A v3 payload (`m: "free"`, `TVT3-` codes carry the same) opens free
 * mode; anything else, v1 and v2 payloads, a bare `#chk=` and no fragment at all, opens classic,
 * with the defaults where the fragment holds no config.
 */
export function routeLink(hash: string): LinkRoute {
  const free = freeConfigFromHash(hash);
  if (free) {
    return {
      mode: 'free',
      config: free,
      newerModel: freeHashModelNewer(hash),
      check: freeCheckFromHash(hash, free),
    };
  }
  const config = configFromHash(hash) ?? defaultConfig();
  return { mode: 'classic', config, check: checkFromHash(hash, config) };
}
