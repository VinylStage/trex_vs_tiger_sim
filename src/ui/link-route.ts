import { checkFromHash, type ResultSummary } from '../share/result-codec';
import { freeCheckFromHash, type FreeResultSummary } from '../share/free-result-codec';
import { defaultConfig, type ScenarioConfig } from '../sim/config';
import type { FreeConfig } from '../sim/free/config';
import { hasTourParam, hashHasAppState } from '../pages/routes';
import { configFromHash } from './share';
import { freeConfigFromHash, freeHashModelNewer } from './share-free';
import { defaultSimpleConfig } from './simple-model';

/*
 * Link routing (docs/SHARING.md#link-routing): what a simulator fragment opens. The app reads its
 * starting fragment through `routeLink`, so the tests that run every old link type through it
 * (tests/link-routing.test.ts) check what the play page actually opens. A link that reaches the
 * lobby (`/`, `/en/`) is first forwarded to the play page with its fragment unchanged
 * (`playForwardUrl` in src/pages/routes.ts), so it opens exactly as it did on `/` before.
 * A cold play page, with no app state to open, shows Simple mode (#146): no link the lobby
 * forwards is cold, so every old link opens as before.
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
  | { mode: 'classic'; config: ScenarioConfig; check: ResultSummary | null }
  /** A cold play page: Simple mode on the free engine, at the default preset. */
  | { mode: 'simple'; config: FreeConfig; check: null };

/**
 * Route a location hash and query. A cold page (a fragment without app state, `hashHasAppState`,
 * and no `tour` parameter, `hasTourParam`) opens Simple mode. Otherwise a v3 payload
 * (`m: "free"`) opens free mode, and anything else (v1 and v2 payloads, a bare `#chk=`, a
 * malformed payload, a settings code in the fragment, the tour deep link without a fragment)
 * opens classic, with the defaults where the fragment holds no config.
 */
export function routeLink(hash: string, search: string): LinkRoute {
  if (!hashHasAppState(hash) && !hasTourParam(search)) {
    return { mode: 'simple', config: defaultSimpleConfig(), check: null };
  }
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
