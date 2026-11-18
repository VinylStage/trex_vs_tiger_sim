import { describe, expect, it } from 'vitest';
import {
  FREE_LIVE_RESULT_VERSION,
  FREE_RESULT_VERSION,
  decodeAnyResult,
  encodeFreeResult,
  freeCheckFromHash,
  reproduceFreeHash,
  summarizeFree,
  type FreeResultSummary,
} from '../src/share/free-result-codec';
import { MAX_RESULT_LENGTH } from '../src/share/result-codec';
import { buildMeta, freeResultView } from '../src/share/result-text';
import { DT } from '../src/sim/engine';
import { aggregateFree } from '../src/sim/free/aggregate';
import { CARD_IDS, type CardId } from '../src/sim/free/cards';
import { defaultSide, sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import { simulateFreeBattle } from '../src/sim/free/engine';
import { MAX_INTERVENTIONS, type Intervention } from '../src/sim/free/interventions';
import type { FreeSpeciesId } from '../src/sim/free/species';
import { designRow } from '../src/sim/sampling';
import { liveLinkHash, routeHashChange, routeLink } from '../src/ui/link-route';
import { MAX_SHARE_LENGTH, base64UrlDecode, base64UrlEncode } from '../src/ui/share';
import {
  LIVE_KEY,
  encodeFreeConfig,
  freeConfigDiff,
  freeConfigFromHash,
  freeLiveFromObject,
  freePayloadFromHash,
  hashFromFreeConfig,
  type FreeLive,
} from '../src/ui/share-free';

/*
 * The live battle in links (#180, RENEWAL-1.0 §10.3): `live: {run, iv}` in a v3 config and the
 * version 3 free result link. A link carrying `live` replays the battle bit for bit, a log that
 * would not replay exactly is refused whole, and every link without `live` is unchanged.
 */

const code = (id: CardId): number => CARD_IDS.indexOf(id);

function free(
  a: FreeSpeciesId,
  na: number,
  b: FreeSpeciesId,
  nb: number,
  extra: Record<string, unknown> = {},
): FreeConfig {
  const c = sanitizeFreeConfig({ runs: 8, seed: 11, ...extra });
  c.sides = [defaultSide(a, na, c.mv), defaultSide(b, nb, c.mv)];
  return sanitizeFreeConfig(c);
}

const LOG: Intervention[] = [
  { tick: 20, card: code('focus'), side: 0 },
  { tick: 20, card: code('pitch-dark'), side: 2 },
  { tick: 60, card: code('mud'), side: 2 },
  { tick: 90, card: code('rallying-cry'), side: 1 },
];

/** The one-run snapshot of the live battle `live` of `config`, as the app shares it. */
function liveSnapshot(config: FreeConfig, live: FreeLive): FreeResultSummary {
  const row = designRow(buildFreeDesign(config), live.run);
  const { summary } = simulateFreeBattle(config, row, live.run, false, { interventions: live.iv });
  return summarizeFree(config, aggregateFree(config, [summary]));
}

const raw = (obj: unknown): string => base64UrlEncode(JSON.stringify(obj));
const payloadOf = (hash: string): Record<string, unknown> => {
  const p = freePayloadFromHash(hash);
  if (p === null) throw new Error('no payload');
  return p;
};

describe('live log in the v3 config (#180)', () => {
  const c = free('wolf', 6, 'tiger', 1);
  const live: FreeLive = { run: 3, iv: LOG };

  it('round-trips through the link as [tick, card, side] tuples', () => {
    const diff = freeConfigDiff(c, { live });
    expect(diff[LIVE_KEY]).toEqual({
      run: 3,
      iv: LOG.map((e) => [e.tick, e.card, e.side]),
    });
    const hash = hashFromFreeConfig(c, { live });
    const back = freeConfigFromHash(hash);
    expect(back && freeConfigDiff(back)).toEqual(freeConfigDiff(c));
    expect(freeLiveFromObject(payloadOf(hash), c)).toEqual(live);
  });

  it('writes `live` before the Simple marker, and leaves links without it unchanged', () => {
    expect(Object.keys(freeConfigDiff(c, { live, simple: true })).slice(-2)).toEqual([
      LIVE_KEY,
      'ui',
    ]);
    expect(encodeFreeConfig(c, { live: null })).toBe(encodeFreeConfig(c));
    expect(LIVE_KEY in freeConfigDiff(c)).toBe(false);
  });

  it('accepts an empty log (a live battle without cards)', () => {
    const hash = hashFromFreeConfig(c, { live: { run: 0, iv: [] } });
    expect(freeLiveFromObject(payloadOf(hash), c)).toEqual({ run: 0, iv: [] });
  });

  it('refuses a log that would not replay exactly, whole', () => {
    const maxSteps = Math.round(c.maxTime / DT);
    const tuples = LOG.map((e) => [e.tick, e.card, e.side]);
    const bad: unknown[] = [
      null,
      [],
      'x',
      { run: 3 },
      { iv: tuples },
      { run: -1, iv: tuples },
      { run: c.runs, iv: tuples },
      { run: 1.5, iv: tuples },
      { run: '3', iv: tuples },
      { run: 3, iv: 'x' },
      { run: 3, iv: [[20, code('focus')]] },
      { run: 3, iv: [{ tick: 20, card: code('focus'), side: 0 }] },
      { run: 3, iv: [[20.5, code('focus'), 0]] },
      { run: 3, iv: [[maxSteps, code('focus'), 0]] },
      { run: 3, iv: [[-1, code('focus'), 0]] },
      { run: 3, iv: [[20, CARD_IDS.length, 0]] },
      { run: 3, iv: [[20, code('focus'), 2]] },
      { run: 3, iv: [[20, code('downpour'), 0]] },
      { run: 3, iv: [[20, code('focus'), '0']] },
      // Out of tick order: sorting would replay another battle.
      { run: 3, iv: [tuples[2], tuples[0]] },
      { run: 3, iv: Array.from({ length: MAX_INTERVENTIONS + 1 }, () => tuples[0]) },
    ];
    for (const value of bad) {
      const payload = { ...freeConfigDiff(c), [LIVE_KEY]: value };
      expect(freeLiveFromObject(payload, c), JSON.stringify(value)).toBeNull();
    }
    // A morale card is refused when morale is off.
    const calm = free('wolf', 6, 'tiger', 1, { morale: false });
    const payload = {
      ...freeConfigDiff(calm),
      [LIVE_KEY]: { run: 0, iv: [[5, code('shaken'), 1]] },
    };
    expect(freeLiveFromObject(payload, calm)).toBeNull();
    // Other keys inside `live` are ignored.
    const extra = { ...freeConfigDiff(c), [LIVE_KEY]: { run: 3, iv: tuples, x: 1 } };
    expect(freeLiveFromObject(extra, c)).toEqual(live);
  });

  it('fits MAX_SHARE_LENGTH with the longest log', () => {
    const big = free('wolf', 5000, 'lion', 500, { runs: 20000 });
    const iv = Array.from({ length: MAX_INTERVENTIONS }, (_, i) => ({
      tick: Math.round(big.maxTime / DT) - 64 + i,
      card: code('focus'),
      side: 1 as const,
    }));
    const run = big.runs - 1;
    const hash = hashFromFreeConfig(big, { live: { run, iv } });
    expect(hash.length).toBeLessThan(MAX_SHARE_LENGTH);
    expect(freeLiveFromObject(payloadOf(hash), big)).toEqual({ run, iv });
  });

  it('opens the free form with the live battle and no batch check', () => {
    const snap = liveSnapshot(c, live);
    const route = routeLink(reproduceFreeHash(c, snap, { live }), '');
    expect(route.mode).toBe('free');
    if (route.mode !== 'free') return;
    expect(route.live).toEqual(live);
    expect(route.check).toBeNull();
    // Even with the Simple marker: Simple mode never plays cards.
    const simple = routeLink(reproduceFreeHash(c, snap, { live, simple: true }), '');
    expect(simple.mode).toBe('free');
    // Without `live` nothing changes.
    const plain = routeLink(reproduceFreeHash(c, snap), '');
    expect(plain.mode === 'free' && 'live' in plain).toBe(false);
    expect(plain.check).toEqual(snap);
  });
});

describe('free result link v3 (#180)', () => {
  for (const mv of [1, 2]) {
    it(`replays the live battle bit for bit (mv ${mv}): summary and chk= match`, () => {
      const c = free('wolf', 6, 'tiger', 1, { mv });
      expect(c.mv).toBe(mv);
      const live: FreeLive = { run: 5, iv: LOG };
      const snap = liveSnapshot(c, live);
      expect(snap.n).toBe(1);
      const r = encodeFreeResult(c, snap, { live });
      const body = JSON.parse(base64UrlDecode(r)) as Record<string, unknown>;
      expect(body['v']).toBe(FREE_LIVE_RESULT_VERSION);
      const dec = decodeAnyResult(r);
      if (!dec.ok || dec.kind !== 'free') throw new Error('decode failed');
      expect(dec.live).toEqual(live);
      expect(freeConfigDiff(dec.config)).toEqual(freeConfigDiff(c));
      // The decoded link replays to the very same snapshot.
      const again = liveSnapshot(dec.config, dec.live as FreeLive);
      expect(again).toEqual(dec.summary);
      // "Run it yourself" carries the log and the snapshot.
      const hash = reproduceFreeHash(dec.config, dec.summary, { live: dec.live });
      const back = freeConfigFromHash(hash);
      if (back === null) throw new Error('no config');
      expect(freeLiveFromObject(payloadOf(hash), back)).toEqual(live);
      expect(freeCheckFromHash(hash, back)).toEqual(liveSnapshot(back, live));
      // The cards matter: without them the battle is another one.
      const plain = liveSnapshot(c, { run: 5, iv: [] });
      expect(plain).not.toEqual(snap);
    });
  }

  it('still writes version 2, byte for byte, without a live battle', () => {
    const c = free('wolf', 6, 'tiger', 1);
    const snap: FreeResultSummary = { n: 8, a: 5, b: 3, d: 0 };
    const r = encodeFreeResult(c, snap);
    expect(r).toBe(raw({ v: FREE_RESULT_VERSION, c: freeConfigDiff(c), s: snap }));
    const dec = decodeAnyResult(r);
    expect(dec.ok && dec.kind === 'free' && dec.live).toBeNull();
    // A `live` key under version 2 is not read, as before.
    const tagged = raw({
      v: FREE_RESULT_VERSION,
      c: { ...freeConfigDiff(c), [LIVE_KEY]: { run: 0, iv: [] } },
      s: snap,
    });
    const dec2 = decodeAnyResult(tagged);
    expect(dec2.ok && dec2.kind === 'free' && dec2.live).toBeNull();
  });

  it('rejects a version 3 link without a valid log, or with a batch snapshot', () => {
    const c = free('wolf', 6, 'tiger', 1);
    const one: FreeResultSummary = { n: 1, a: 1, b: 0, d: 0 };
    const v3 = (live: unknown, s: FreeResultSummary): string =>
      raw({ v: FREE_LIVE_RESULT_VERSION, c: { ...freeConfigDiff(c), [LIVE_KEY]: live }, s });
    expect(decodeAnyResult(raw({ v: 3, c: freeConfigDiff(c), s: one }))).toMatchObject({
      ok: false,
      error: 'shape',
    });
    expect(decodeAnyResult(v3({ run: 0, iv: [[1, 999, 0]] }, one))).toMatchObject({
      ok: false,
      error: 'shape',
    });
    expect(decodeAnyResult(v3({ run: 0, iv: [] }, { n: 2, a: 2, b: 0, d: 0 }))).toMatchObject({
      ok: false,
      error: 'summary',
    });
    expect(decodeAnyResult(v3({ run: 0, iv: [] }, one))).toMatchObject({ ok: true, kind: 'free' });
    // Versions other than 2 and 3 stay errors.
    expect(decodeAnyResult(raw({ v: 4, c: freeConfigDiff(c), s: one }))).toMatchObject({
      ok: false,
      error: 'version',
    });
  });

  it('fits MAX_RESULT_LENGTH with the longest log', () => {
    const c = free('wolf', 5000, 'lion', 500, { runs: 20000 });
    const iv = Array.from({ length: MAX_INTERVENTIONS }, (_, i) => ({
      tick: Math.round(c.maxTime / DT) - 64 + i,
      card: code('focus'),
      side: 1 as const,
    }));
    const s: FreeResultSummary = {
      n: 1,
      a: 0,
      b: 1,
      d: 0,
      t: 1234.5,
      as: 12.25,
      bs: 480.5,
      ak: 4987.8,
      bk: 19.5,
      ar: 12.3,
      br: 0.5,
      bb: 0.123,
      bt: 1234.5,
      ci: [0, 0.7935, 0.2065, 1, 0, 0.7935],
    };
    const r = encodeFreeResult(c, s, { live: { run: c.runs - 1, iv } });
    expect(r.length).toBeLessThan(MAX_RESULT_LENGTH);
    expect(decodeAnyResult(r).ok).toBe(true);
  });

  it('names the live battle and its cards on the page and in the preview', () => {
    const c = free('wolf', 6, 'tiger', 1);
    const live: FreeLive = { run: 1, iv: LOG };
    const snap = liveSnapshot(c, live);
    const ko = freeResultView(c, snap, 'ko', live);
    expect(ko.context).toBe('실시간 대결 1판 · 변수 카드 4장 · 자유 대결 · 잠정 모델');
    expect(freeResultView(c, snap, 'en', live).context).toBe(
      'One live battle · variable cards: 4 · Free matchup · provisional model',
    );
    expect(freeResultView(c, snap, 'ko').context).toBe('자유 대결 · 잠정 모델');
    const meta = buildMeta(`?r=${encodeFreeResult(c, snap, { live })}`, 'ko');
    expect(meta?.description).toContain('실시간 대결 1판');
  });
});

describe('a live battle link keeps its address on reload (#239)', () => {
  const c = free('wolf', 6, 'tiger', 1);
  const live: FreeLive = { run: 3, iv: LOG };
  const snap = liveSnapshot(c, live);
  const hash = reproduceFreeHash(c, snap, { live });

  it('holds the link as it came while its battle is on screen', () => {
    const route = routeLink(hash, '');
    const held = liveLinkHash(route, hash);
    expect(held).toBe(hash);
    if (held === null) throw new Error('no held address');
    // A reload of the held address opens the same live battle, checked against the same snapshot.
    const again = routeLink(held, '');
    expect(again.mode).toBe('free');
    if (again.mode !== 'free') return;
    expect(again.live).toEqual(live);
    expect(freeConfigDiff(again.config)).toEqual(freeConfigDiff(c));
    expect(freeCheckFromHash(held, again.config)).toEqual(snap);
    // Also with the Simple marker, which a live battle overrides.
    const simple = reproduceFreeHash(c, snap, { live, simple: true });
    expect(liveLinkHash(routeLink(simple, ''), simple)).toBe(simple);
  });

  it('holds nothing for a link without a live battle', () => {
    const plain = reproduceFreeHash(c, snap);
    expect(liveLinkHash(routeLink(plain, ''), plain)).toBeNull();
    const classic = '#s=';
    expect(liveLinkHash(routeLink(classic, ''), classic)).toBeNull();
    expect(liveLinkHash(routeLink('', ''), '')).toBeNull();
  });

  it('drops the live battle once the address is written from the config again', () => {
    // What the app writes after the viewer leaves Live battle mode or edits the config.
    const route = routeLink(hash, '');
    const written = hashFromFreeConfig(route.config as FreeConfig);
    const after = routeLink(written, '');
    expect(after.mode === 'free' && 'live' in after).toBe(false);
    expect(freeLiveFromObject(payloadOf(written), route.config as FreeConfig)).toBeNull();
    expect(routeHashChange(written, '')).toEqual({ mode: 'free', config: route.config });
  });
});
