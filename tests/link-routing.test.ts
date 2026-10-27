import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { playForwardUrl, playPagePath } from '../src/pages/routes';
import { decodeAnyResultQuery, reproduceFreeHash } from '../src/share/free-result-codec';
import { decodeResultQuery, encodeResult, reproduceHash } from '../src/share/result-codec';
import { defaultConfig, type ScenarioConfig } from '../src/sim/config';
import { FREE_MODEL_VERSION, defaultFreeConfig } from '../src/sim/free/config';
import { routeLink } from '../src/ui/link-route';
import { defaultSimpleConfig } from '../src/ui/simple-model';
import { configFromHash, decodeConfig, hashFromConfig } from '../src/ui/share';
import { freeConfigFromHash } from '../src/ui/share-free';

/*
 * Link routing (docs/SHARING.md#link-routing, #142). Every link made before the lobby pointed at
 * `/` or `/en/`. The lobby's inline forwarder sends it to the play page with query and fragment
 * unchanged, and the play page opens it through `routeLink`. For every old link type this test
 * runs the real forwarder from index.html / en/index.html, checks it agrees with
 * `playForwardUrl`, and checks that the play page opens the same mode, config and reproduction
 * check as the app on `/` did (mode from `freeConfigFromHash`, config from `configFromHash`).
 * Simple mode (#146) opens only on a cold play page, which no forwarded link is: the last block
 * checks both sides of that line.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const ORIGIN = 'https://trex-vs-tiger.vinylims.com';

/** A lobby tab running the real inline forwarder against a fake `location` and `window`. */
interface LobbyTab {
  /** Where the forwarder sent the tab with `location.replace`, or null. */
  target: string | null;
  /** Change the fragment in place, as pasting a link into the address bar does. */
  setHash(hash: string): void;
}

function openLobby(file: string, url: string): LobbyTab {
  const body = /<script>([\s\S]*?)<\/script>/.exec(read(file))?.[1];
  if (body === undefined) throw new Error(`${file}: no inline forwarder`);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the page's own script, in a test
  const run = new Function('location', 'addEventListener', body) as (
    loc: unknown,
    on: (type: string, fn: () => void) => void,
  ) => void;
  const u = new URL(url);
  const listeners: Record<string, (() => void)[]> = {};
  const tab: LobbyTab = {
    target: null,
    setHash(hash) {
      loc.hash = hash;
      for (const fn of listeners['hashchange'] ?? []) fn();
    },
  };
  const loc = {
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    replace: (to: string) => {
      tab.target ??= to;
    },
  };
  run(loc, (type, fn) => (listeners[type] ??= []).push(fn));
  return tab;
}

/** The lobby's inline forwarder on first load: the URL it replaces to, or null. */
const forwarder =
  (file: string) =>
  (url: string): string | null =>
    openLobby(file, url).target;
const FORWARD = { ko: forwarder('index.html'), en: forwarder('en/index.html') };

const b64 = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url');

/** Free payloads written by the encoder on main before `mv` existed (0e5bfd8), as shared then. */
const OLD_FREE = {
  defaults:
    'eyJ2IjozLCJtIjoiZnJlZSIsImEiOnsic3AiOiJ0cmV4IiwibiI6MX0sImIiOnsic3AiOiJ0cmV4IiwibiI6MX19',
  edited:
    'eyJ2IjozLCJtIjoiZnJlZSIsImEiOnsic3AiOiJ0aWdlciIsIm4iOjV9LCJiIjp7InNwIjoibGlvbiIsIm4iOjUsInAiOnsibGF0Y2hEcHMiOlszLDgsMTVdfX0sImJ1ZmYiOnsicmVsaWVmIjpmYWxzZX0sImciOnsibGF0Y2hSYXRpbyI6WzIuNSwzLDRdfSwicnVucyI6MTIwLCJzZWVkIjo0MiwibW9yYWxlIjpmYWxzZX0',
  result:
    'eyJ2IjoyLCJjIjp7InYiOjMsIm0iOiJmcmVlIiwiYSI6eyJzcCI6IndvbGYiLCJuIjo4fSwiYiI6eyJzcCI6ImJyb3duQmVhciIsIm4iOjF9LCJydW5zIjozMDB9LCJzIjp7Im4iOjMwMCwiYSI6NDEsImIiOjI1MCwiZCI6OSwidCI6ODguNCwiYXMiOjUuMSwiYnMiOjAuMiwiYWsiOjEuMywiYmsiOjAuOCwiYXIiOjEuNiwiYnIiOjAsImFiIjowLjYyLCJhdCI6NzEuNSwiY2kiOlswLjEsMC4xOCwwLjc4LDAuODcsMC4wMSwwLjA2XX19',
} as const;

/** A classic v1 payload: no `v`, v1 names (`trexCount`, `tiger.*`). */
const V1 = b64({ trexCount: 4, tigerCount: 60, params: { 'tiger.mass': [90, 150, 200] } });
/** A classic v2 settings link as the encoder writes it. */
const V2_CONFIG: ScenarioConfig = { ...defaultConfig(), heavyCount: 3, packCount: 40, seed: 7 };
const V2_HASH = hashFromConfig(V2_CONFIG);
/** A classic result link and its "Run it yourself" fragment. */
const CLASSIC_SUMMARY = { n: 500, h: 480, p: 15, d: 5 };
const CLASSIC_RESULT = decodeResultQuery(`?r=${encodeResult(V2_CONFIG, CLASSIC_SUMMARY)}`);
const FREE_RESULT = decodeAnyResultQuery(`?r=${OLD_FREE.result}`);
if (!CLASSIC_RESULT.ok || !FREE_RESULT.ok || FREE_RESULT.kind !== 'free') {
  throw new Error('fixture result links do not decode');
}
const CLASSIC_REPRO = reproduceHash(CLASSIC_RESULT.config, CLASSIC_RESULT.summary);
const DEFAULT_REPRO = reproduceHash(defaultConfig(), CLASSIC_SUMMARY);
const FREE_REPRO = reproduceFreeHash(FREE_RESULT.config, FREE_RESULT.summary);
const NEWER = b64({ v: 3, m: 'free', mv: FREE_MODEL_VERSION + 1, a: { sp: 'lion', n: 3 } });

interface Fixture {
  name: string;
  /** Query and fragment of the old link, on `/` or `/en/`. */
  tail: string;
  mode: 'classic' | 'free';
  /** What the opened config must be. */
  config: unknown;
  /** Whether the link carries a reproduction check. */
  check: boolean;
  newerModel?: boolean;
}

const FIXTURES: readonly Fixture[] = [
  {
    name: 'classic v1 settings link',
    tail: `#s=${V1}`,
    mode: 'classic',
    config: decodeConfig(V1),
    check: false,
  },
  {
    name: 'classic v2 settings link',
    tail: V2_HASH,
    mode: 'classic',
    config: V2_CONFIG,
    check: false,
  },
  {
    name: 'classic "Run it yourself" from a /r/ v1 result link',
    tail: CLASSIC_REPRO,
    mode: 'classic',
    config: V2_CONFIG,
    check: true,
  },
  {
    name: 'classic "Run it yourself" of the defaults (bare #chk=)',
    tail: DEFAULT_REPRO,
    mode: 'classic',
    config: defaultConfig(),
    check: true,
  },
  {
    name: 'free v3 settings link (defaults)',
    tail: `#s=${OLD_FREE.defaults}`,
    mode: 'free',
    config: defaultFreeConfig(),
    check: false,
  },
  {
    name: 'free v3 settings link (edited ranges, buffs, globals)',
    tail: `#s=${OLD_FREE.edited}`,
    mode: 'free',
    config: freeConfigFromHash(`#s=${OLD_FREE.edited}`),
    check: false,
  },
  {
    name: 'free "Run it yourself" from a /r/ v2 result link',
    tail: FREE_REPRO,
    mode: 'free',
    config: FREE_RESULT.config,
    check: true,
  },
  {
    name: 'free link of a newer model (opens the defaults, address kept)',
    tail: `#s=${NEWER}`,
    mode: 'free',
    config: defaultFreeConfig(),
    check: false,
    newerModel: true,
  },
  {
    name: 'settings link with the tour deep link',
    tail: `?tour=1${V2_HASH}`,
    mode: 'classic',
    config: V2_CONFIG,
    check: false,
  },
  {
    name: 'tour deep link alone',
    tail: '?tour=1',
    mode: 'classic',
    config: defaultConfig(),
    check: false,
  },
  {
    name: 'bare tour deep link (?tour, no value)',
    tail: '?tour',
    mode: 'classic',
    config: defaultConfig(),
    check: false,
  },
  {
    name: 'tour deep link after another parameter (?a=1&tour)',
    tail: '?a=1&tour',
    mode: 'classic',
    config: defaultConfig(),
    check: false,
  },
  {
    name: 'malformed settings payload (opens the defaults, as before)',
    tail: '#s=%%',
    mode: 'classic',
    config: defaultConfig(),
    check: false,
  },
  {
    name: 'settings code in the fragment (TVT3-)',
    tail: `#TVT3-${OLD_FREE.defaults}`,
    mode: 'classic',
    config: defaultConfig(),
    check: false,
  },
];

describe('old links reaching the lobby', () => {
  describe.each(['ko', 'en'] as const)('on the %s lobby', (lang) => {
    const lobby = lang === 'ko' ? '/' : '/en/';

    it.each(FIXTURES)('$name: forwarded to the play page, same query and fragment', (f) => {
      const url = `${ORIGIN}${lobby}${f.tail}`;
      const target = FORWARD[lang](url);
      expect(target).toBe(`${playPagePath(lang)}${f.tail}`);
      const u = new URL(url);
      expect(playForwardUrl(u.pathname, u.search, u.hash)).toBe(target);
      // Also from the forms Pages redirects to the lobby.
      for (const path of lang === 'ko' ? ['/index.html'] : ['/en', '/en/index.html']) {
        expect(FORWARD[lang](`${ORIGIN}${path}${f.tail}`), path).toBe(target);
      }
    });

    it.each(FIXTURES)('$name: opens the same mode, config and check as on / before', (f) => {
      const target = FORWARD[lang](`${ORIGIN}${lobby}${f.tail}`) ?? '';
      const { hash, search } = new URL(target, ORIGIN);
      const route = routeLink(hash, search);
      // The app on `/` (before #142): free mode iff the fragment holds a v3 payload, else
      // classic with `configFromHash(hash) ?? defaultConfig()`.
      const before = freeConfigFromHash(hash) ? 'free' : 'classic';
      expect(route.mode).toBe(before);
      expect(route.mode).toBe(f.mode);
      expect(route.config).toEqual(f.config);
      if (route.mode === 'classic') {
        expect(route.config).toEqual(configFromHash(hash) ?? defaultConfig());
      } else if (route.mode === 'free') {
        expect(route.newerModel).toBe(f.newerModel ?? false);
      }
      expect(route.check !== null).toBe(f.check);
      const original = new URL(`${ORIGIN}${lobby}${f.tail}`);
      expect(routeLink(original.hash, original.search)).toEqual(route);
    });
  });

  it('keeps the shared snapshot of a "Run it yourself" link intact', () => {
    const classic = routeLink(CLASSIC_REPRO, '');
    expect(classic.check).toEqual(CLASSIC_SUMMARY);
    const free = routeLink(FREE_REPRO, '');
    expect(free.check).toEqual(FREE_RESULT.summary);
  });
});

describe('the lobby itself', () => {
  it.each([
    ['/', ''],
    ['/', '#faq'],
    ['/', '#intro'],
    ['/en/', ''],
    ['/en/', '#faq'],
    ['/', '?utm_source=x'],
    ['/', '?_r=123'],
    ['/', '?tourist=1'],
    ['/', '?detour=1'],
  ])('%s%s stays on the lobby', (path, tail) => {
    const lang = path.startsWith('/en') ? 'en' : 'ko';
    const u = new URL(`${ORIGIN}${path}${tail}`);
    expect(FORWARD[lang](u.href)).toBeNull();
    expect(playForwardUrl(u.pathname, u.search, u.hash)).toBeNull();
  });

  it.each(['index.html', 'en/index.html'])(
    '%s forwards a settings link pasted into an open lobby tab (hashchange)',
    (file) => {
      const lobby = file === 'index.html' ? '/' : '/en/';
      const tab = openLobby(file, `${ORIGIN}${lobby}`);
      expect(tab.target).toBeNull();
      tab.setHash('#faq');
      expect(tab.target).toBeNull();
      tab.setHash(V2_HASH);
      expect(tab.target).toBe(`${lobby === '/' ? '/play/' : '/en/play/'}${V2_HASH}`);
    },
  );

  it('is the same script in both languages', () => {
    const body = (f: string): string | undefined =>
      /<script>([\s\S]*?)<\/script>/.exec(read(f))?.[1];
    expect(body('index.html')).toBe(body('en/index.html'));
  });
});

describe('routeLink', () => {
  it('opens Simple mode at the default preset on a cold play page (#146)', () => {
    expect(routeLink('', '')).toEqual({
      mode: 'simple',
      config: defaultSimpleConfig(),
      check: null,
    });
  });

  it('opens a free link in free mode and a classic one in classic mode', () => {
    expect(routeLink(`#s=${OLD_FREE.edited}`, '').mode).toBe('free');
    expect(routeLink(V2_HASH, '').mode).toBe('classic');
    expect(routeLink(`#s=${V1}`, '').mode).toBe('classic');
  });

  it('opens a classic "Run it yourself" link without config at the defaults, check kept', () => {
    const r = routeLink(DEFAULT_REPRO, '');
    expect(r).toEqual({ mode: 'classic', config: defaultConfig(), check: CLASSIC_SUMMARY });
  });
});

describe('Simple mode on the play page (#146)', () => {
  /** Query and fragment of a play page with nothing to open. */
  const COLD = [
    '',
    '#',
    '#main',
    '#faq',
    '?_r=1730000000000',
    '?utm_source=x',
    '?tour=0',
    '?tourist=1',
  ];

  it.each(COLD)('a cold /play/%s opens Simple at the default preset', (tail) => {
    const u = new URL(`${ORIGIN}/play/${tail}`);
    expect(routeLink(u.hash, u.search)).toEqual({
      mode: 'simple',
      config: defaultSimpleConfig(),
      check: null,
    });
  });

  it('lands on preset #1, lion vs tiger 1:1, with every other setting at its default', () => {
    const c = defaultSimpleConfig();
    expect(c.sides.map((s) => [s.species, s.count])).toEqual([
      ['lion', 1],
      ['tiger', 1],
    ]);
    expect(c.runs).toBe(defaultFreeConfig().runs);
    expect(c.seed).toBe(defaultFreeConfig().seed);
  });

  describe.each(['ko', 'en'] as const)('every old link from the %s lobby', (lang) => {
    const lobby = lang === 'ko' ? '/' : '/en/';
    it.each(FIXTURES)('$name: never opens Simple, the same as on /play/ directly', (f) => {
      const target = FORWARD[lang](`${ORIGIN}${lobby}${f.tail}`) ?? '';
      const { hash, search } = new URL(target, ORIGIN);
      expect(routeLink(hash, search).mode).toBe(f.mode);
      // The same link opened on the play page itself, not through the lobby.
      const direct = new URL(`${ORIGIN}${playPagePath(lang)}${f.tail}`);
      expect(routeLink(direct.hash, direct.search)).toEqual(routeLink(hash, search));
    });
  });

  it('opens the tour deep link without a fragment in classic, as before', () => {
    for (const q of ['?tour=1', '?tour', '?a=1&tour']) {
      expect(routeLink('', q)).toEqual({ mode: 'classic', config: defaultConfig(), check: null });
    }
  });

  it('keeps malformed payloads and settings codes in the fragment on the classic defaults', () => {
    for (const hash of ['#s=%%', `#TVT3-${OLD_FREE.defaults}`, '#tvt2-x', '#chk=%%']) {
      const r = routeLink(hash, '');
      expect(r.mode).toBe('classic');
      expect(r.config).toEqual(defaultConfig());
    }
  });
});
