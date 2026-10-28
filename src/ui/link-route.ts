import { checkFromHash, type ResultSummary } from '../share/result-codec';
import { freeCheckFromHash, type FreeResultSummary } from '../share/free-result-codec';
import { defaultConfig, type ScenarioConfig } from '../sim/config';
import type { FreeConfig } from '../sim/free/config';
import { hasTourParam, hashHasAppState } from '../pages/routes';
import { configFromHash } from './share';
import {
  freeConfigFromHash,
  freeHashModelNewer,
  freeModelVersion,
  freePayloadFromHash,
  freePayloadSimple,
} from './share-free';
import { defaultSimpleConfig, simpleCanShow } from './simple-model';

/*
 * Link routing (docs/SHARING.md#link-routing): what a simulator fragment opens. The app reads its
 * starting fragment through `routeLink`, so the tests that run every old link type through it
 * (tests/link-routing.test.ts) check what the play page actually opens. A link that reaches the
 * lobby (`/`, `/en/`) is first forwarded to the play page with its fragment unchanged
 * (`playForwardUrl` in src/pages/routes.ts), so it opens exactly as it did on `/` before.
 * A cold play page, with no app state to open, shows Simple mode (#146): no link the lobby
 * forwards is cold, so every old link opens as before. A link written by Simple mode carries the
 * marker `ui: "simple"` (#154) and opens Simple again; no link made before #154 carries it.
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
  /**
   * Simple mode on the free engine: a cold play page (the default preset, no check) or a link
   * Simple mode wrote (its config, and the free reproduction check when `chk=` validates).
   */
  | { mode: 'simple'; config: FreeConfig; check: FreeResultSummary | null };

/**
 * Route a location hash and query. A cold page (a fragment without app state, `hashHasAppState`,
 * and no `tour` parameter, `hasTourParam`) opens Simple mode. Otherwise a v3 payload
 * (`m: "free"`) opens Simple mode when it carries the Simple marker, names a model this build
 * runs and Simple can show its config (`simpleCanShow`, #154), else free mode. Anything else (v1
 * and v2 payloads, a bare `#chk=`, a malformed payload, a settings code in the fragment, the tour
 * deep link without a fragment) opens classic, with the defaults where the fragment holds no
 * config.
 */
export function routeLink(hash: string, search: string): LinkRoute {
  if (!hashHasAppState(hash) && !hasTourParam(search)) {
    return { mode: 'simple', config: defaultSimpleConfig(), check: null };
  }
  const free = freeConfigFromHash(hash);
  if (free) {
    const newerModel = freeHashModelNewer(hash);
    const check = freeCheckFromHash(hash, free);
    // Only a model this build runs: a newer or malformed `mv` opens the free defaults as before,
    // marker or not (ADR-0008 §6).
    const raw = freePayloadFromHash(hash);
    const runsHere = raw !== null && freeModelVersion(raw) !== null;
    if (runsHere && freePayloadSimple(raw) && simpleCanShow(free)) {
      return { mode: 'simple', config: free, check };
    }
    return {
      mode: 'free',
      config: free,
      newerModel,
      check,
    };
  }
  const config = configFromHash(hash) ?? defaultConfig();
  return { mode: 'classic', config, check: checkFromHash(hash, config) };
}
