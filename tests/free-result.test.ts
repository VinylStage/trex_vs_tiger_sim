import { describe, expect, it } from 'vitest';
import {
  FREE_RESULT_VERSION,
  buffApplies,
  decodeAnyResult,
  decodeAnyResultQuery,
  encodeFreeResult,
  freeCheckFromHash,
  reproduceFreeHash,
  summarizeFree,
  validateFreeSummary,
  type FreeResultSummary,
} from '../src/share/free-result-codec';
import { decodeResult, encodeResult, RESULT_VERSION } from '../src/share/result-codec';
import { onResultRequest } from '../src/share/result-function';
import {
  buildMeta,
  freeResultView,
  freeShareText,
  resultView,
  shareText,
} from '../src/share/result-text';
import { defaultConfig } from '../src/sim/config';
import { aggregateFree, type FreeAggregate } from '../src/sim/free/aggregate';
import { defaultSide, sanitizeFreeConfig, type FreeConfig } from '../src/sim/free/config';
import { runAllFree } from '../src/sim/free/montecarlo';
import type { FreeSpeciesId } from '../src/sim/free/species';
import { wilson } from '../src/sim/stats';
import { cardFileName, cardTexts, matchupLine, runsLine } from '../src/ui/result-card';
import { compareFreeRun } from '../src/ui/result-share';
import { base64UrlEncode } from '../src/ui/share';
import { freeConfigDiff, freeConfigFromHash } from '../src/ui/share-free';

/*
 * Result links of free matchups (#50 item 3a, design §2.5): the v2 codec, strict validation,
 * the classic v1 links left exactly as they were, the views (mirror side labels), the text
 * share, the link preview and the reproduction check.
 */

function free(a: FreeSpeciesId, na: number, b: FreeSpeciesId, nb: number, runs = 30): FreeConfig {
  const c = sanitizeFreeConfig({ runs, seed: 7 });
  c.sides = [defaultSide(a, na), defaultSide(b, nb)];
  return sanitizeFreeConfig(c);
}

const raw = (obj: unknown): string => base64UrlEncode(JSON.stringify(obj));

/** A fixed snapshot (n 500: A 270, B 210, draws 20). */
const SNAP: FreeResultSummary = { n: 500, a: 270, b: 210, d: 20, t: 41.2 };

function fakeFreeAgg(n: number, a: number, b: number, d: number): FreeAggregate {
  const side = { survivors: 0.5, killed: 0.4, routed: 0.1, active: 0 };
  const buff = {
    mean: {
      activeFrac: 0.38,
      anyTime: 20,
      activations: 3,
      coordinate: 0,
      focus: 0,
      groupLatch: 0,
      restraint: 0,
      support: 0,
      contagion: 0,
      relief: 0,
    },
    anyTimeMedian: 12.34,
  };
  return {
    n,
    aWins: a,
    bWins: b,
    draws: d,
    pA: wilson(a, n),
    pB: wilson(b, n),
    pDraw: wilson(d, n),
    duration: { mean: 41.23, p5: 10, p50: 40, p95: 80 },
    a: side,
    b: side,
    buffA: buff,
    buffB: buff,
    representativeRun: 0,
  };
}

describe('free result codec (v2)', () => {
  it('round-trips a real free batch', () => {
    const c = free('wolf', 6, 'tiger', 1);
    const agg = aggregateFree(c, runAllFree(c).summaries);
    const s = summarizeFree(c, agg);
    expect(s.a + s.b + s.d).toBe(c.runs);
    // Wolves are social and more than one: their buff time is in the snapshot; the tiger's not.
    expect(s.ab).toBeGreaterThanOrEqual(0);
    expect(s.at).toBeGreaterThanOrEqual(0);
    expect(s.bb).toBeUndefined();
    expect(s.bt).toBeUndefined();
    const res = decodeAnyResult(encodeFreeResult(c, s));
    expect(res.ok && res.kind).toBe('free');
    if (!res.ok || res.kind !== 'free') return;
    expect(freeConfigDiff(res.config)).toEqual(freeConfigDiff(c));
    expect(res.summary).toEqual(s);
  });

  it('writes v 2 with the v3 config payload', () => {
    const c = free('tiger', 1, 'lion', 1);
    const body = JSON.parse(
      Buffer.from(encodeFreeResult(c, SNAP), 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    expect(body['v']).toBe(FREE_RESULT_VERSION);
    expect(FREE_RESULT_VERSION).not.toBe(RESULT_VERSION);
    expect(body['c']).toEqual(freeConfigDiff(c));
    expect((body['c'] as Record<string, unknown>)['m']).toBe('free');
  });

  it('keeps classic v1 links exactly as before', () => {
    const c = defaultConfig();
    c.heavyCount = 1;
    c.packCount = 100;
    const s = { n: 500, h: 305, p: 175, d: 20, t: 43.5, hs: 0.61, pk: 14.1 };
    const r = encodeResult(c, s);
    expect(decodeAnyResult(r)).toEqual({ ...decodeResult(r), kind: 'classic' });
    // Every failure of a classic link is reported as before.
    for (const bad of [
      null,
      '',
      'A'.repeat(5000),
      'bad!',
      raw([1]),
      raw({ v: 2, c: { v: 2 }, s }),
      raw({ v: 1, c: { v: 2 }, s: { n: 2, h: 1, p: 0, d: 0 } }),
    ]) {
      expect(decodeAnyResult(bad)).toEqual(decodeResult(bad));
    }
  });

  it('reports a free config in a classic version as a version error', () => {
    const c = free('tiger', 1, 'lion', 1);
    const res = decodeAnyResult(raw({ v: 1, c: freeConfigDiff(c), s: SNAP }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('version');
    expect(res.config && 'mode' in res.config && res.config.mode).toBe('free');
  });

  describe('strict summary validation', () => {
    const wolves = free('wolf', 6, 'tiger', 1);
    const bad: [string, unknown][] = [
      ['not an object', [1]],
      ['unknown key', { ...SNAP, h: 1 }],
      ['classic keys', { n: 500, h: 270, p: 210, d: 20 }],
      ['n = 0', { n: 0, a: 0, b: 0, d: 0 }],
      ['sum', { ...SNAP, a: 271 }],
      ['fraction', { ...SNAP, a: 269.5, d: 20.5 }],
      ['survivors above count', { ...SNAP, as: 7 }],
      ['B survivors above its count', { ...SNAP, bs: 1.5 }],
      ['fled negative', { ...SNAP, ar: -1 }],
      ['buff share above 1', { ...SNAP, ab: 1.2 }],
      ['buff for a non-social side', { ...SNAP, bb: 0.1 }],
      ['buff time for a non-social side', { ...SNAP, bt: 3 }],
      ['ci order', { ...SNAP, ci: [0.6, 0.5, 0.3, 0.4, 0, 0.1] }],
      ['ci length', { ...SNAP, ci: [0.5, 0.6] }],
      ['duration', { ...SNAP, t: 1e9 }],
    ];
    it.each(bad)('rejects %s', (_, s) => {
      expect(validateFreeSummary(s, wolves)).toBeNull();
      expect(decodeAnyResult(raw({ v: 2, c: freeConfigDiff(wolves), s })).ok).toBe(false);
    });

    it('accepts every field within bounds', () => {
      const s = {
        ...SNAP,
        as: 6,
        ak: 0,
        ar: 1.5,
        bs: 1,
        bk: 0.4,
        br: 0,
        ab: 1,
        at: 0,
        ci: [0.5, 0.58, 0.38, 0.46, 0.02, 0.06],
      };
      expect(validateFreeSummary(s, wolves)).toEqual(s);
    });

    it('allows buff fields only where the buff applies', () => {
      const lone = free('wolf', 1, 'wolf', 2);
      expect(buffApplies(lone, 0)).toBe(false);
      expect(buffApplies(lone, 1)).toBe(true);
      expect(validateFreeSummary({ ...SNAP, ab: 0.1 }, lone)).toBeNull();
      expect(validateFreeSummary({ ...SNAP, bb: 0.1 }, lone)).not.toBeNull();
      const off = sanitizeFreeConfig({
        ...lone,
        packBuff: {
          coordinate: false,
          focus: false,
          groupLatch: false,
          morale: false,
          relief: false,
        },
      });
      expect(validateFreeSummary({ ...SNAP, bb: 0.1 }, off)).toBeNull();
    });
  });

  it('decodes from a query string and rejects oversized queries unparsed', () => {
    const c = free('tiger', 1, 'lion', 1);
    const res = decodeAnyResultQuery(`?r=${encodeFreeResult(c, SNAP)}`);
    expect(res.ok && res.kind).toBe('free');
    expect(decodeAnyResultQuery(`?r=${'A'.repeat(5000)}`)).toMatchObject({ error: 'length' });
  });
});

describe('free result views', () => {
  it('names the sides by species, with side letters only for a mirror', () => {
    const v = freeResultView(free('tiger', 1, 'lion', 1), SNAP, 'ko');
    expect(v.matchup).toBe('호랑이 1 vs 사자 1');
    expect(v.headline).toBe('호랑이 54%');
    expect(v.winLabel).toBe('호랑이 승리');
    const m = freeResultView(free('tiger', 1, 'tiger', 1), SNAP, 'ko');
    expect(m.matchup).toBe('호랑이 A 1 vs 호랑이 B 1');
    expect(m.winLabel).toBe('호랑이 A 승리');
    expect(m.context).toContain('같은 종 대결');
    const en = freeResultView(free('wolf', 8, 'wolf', 8), { ...SNAP, a: 200, b: 280 }, 'en');
    expect(en.matchup).toBe('Wolves A 8 vs Wolves B 8');
    expect(en.winLabel).toBe('Wolf B wins');
    expect(en.context).toMatch(/Same-species/);
  });

  it('never calls a free result an upset and never compares it with the default', () => {
    for (const s of [SNAP, { n: 500, a: 10, b: 480, d: 10 }, { n: 10, a: 2, b: 2, d: 6 }]) {
      const v = freeResultView(free('trex', 1, 'tiger', 100), s, 'en');
      expect(v.tier).not.toBe('upset');
      expect(v.context).not.toMatch(/default/);
    }
  });

  it('draws large animals as triangles and small ones as dots', () => {
    const v = freeResultView(free('elephant', 2, 'hyena', 20), SNAP, 'en');
    expect([v.heavyGlyph, v.packGlyph]).toEqual(['triangle', 'dot']);
    const classic = resultView(defaultConfig(), { n: 10, h: 5, p: 5, d: 0 }, 'en');
    expect([classic.heavyGlyph, classic.packGlyph]).toEqual(['triangle', 'dot']);
  });

  it('writes the Wordle-style text for a mirror matchup', () => {
    const c = free('tiger', 1, 'tiger', 1);
    expect(freeShareText(c, SNAP, 'ko', 'https://x.test/r/?r=1').split('\n')).toEqual([
      '🐅 호랑이 A 1 vs 🐅 호랑이 B 1 — 500회',
      '🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧',
      '호랑이 A 54% · 호랑이 B 42% · 무승부 4%',
      'https://x.test/r/?r=1',
    ]);
    expect(freeShareText(free('wolf', 5, 'lion', 1), SNAP, 'en', 'u').split('\n')[0]).toBe(
      '🐺 Wolves 5 vs 🦁 Lion 1 — 500 runs',
    );
  });

  it('leaves the classic text share unchanged', () => {
    const c = defaultConfig();
    c.heavyCount = 1;
    c.packCount = 100;
    expect(shareText(c, { n: 500, h: 305, p: 175, d: 20 }, 'ko', 'u').split('\n')).toEqual([
      '🦖 T-Rex 1 vs 🐅 호랑이 100 — 500회',
      '🟦🟦🟦🟦🟦🟦🟧🟧🟧🟧',
      'T-Rex 61% · 호랑이 35% · 무승부 4%',
      'u',
    ]);
  });

  it('fills the card with both sides and the pack-buff share', () => {
    const c = free('wolf', 8, 'wolf', 8);
    const s = summarizeFree(c, fakeFreeAgg(500, 270, 210, 20));
    expect(s.ab).toBe(0.38);
    expect(s.at).toBe(12.3);
    const view = freeResultView(c, s, 'en');
    const input = { view, summary: s, domain: 'x.test' };
    expect(matchupLine(input)).toBe('🐺 Wolves A 8  vs  🐺 Wolves B 8');
    expect(runsLine(input)).toBe(
      '500 simulated runs · mean 41 s · Pack buff Wolf A 38%, Wolf B 38%',
    );
    expect(cardFileName(input, 'story')).toBe('trex-vs-tiger-free-wolf8-vs-wolf8-story.png');
    expect(cardTexts(input)).toContain(view.context);
  });
});

describe('free link preview', () => {
  const c = free('tiger', 1, 'lion', 1);
  const r = encodeFreeResult(c, SNAP);

  it('uses the free title and description', () => {
    expect(buildMeta(`?r=${r}`, 'ko')).toEqual({
      title: '호랑이 1 vs 사자 1 — 호랑이 54%',
      description:
        '500회 몬테카를로 시뮬레이션 스냅샷 · 접전 · 자유 대결 · 잠정 모델. 같은 설정으로 직접 실행해 보세요.',
    });
    expect(buildMeta(`?r=${r}`, 'en')?.title).toBe('Tiger 1 vs Lion 1 — Tiger 54%');
    const mirror = encodeFreeResult(free('tiger', 1, 'tiger', 1), SNAP);
    expect(buildMeta(`?r=${mirror}`, 'en')?.title).toBe('Tiger A 1 vs Tiger B 1 — Tiger A 54%');
  });

  it('rewrites the meta tags in the Pages Function', async () => {
    const set: Record<string, string> = {};
    class Rewriter {
      on(sel: string, h: { element(el: { setAttribute(n: string, v: string): void }): void }) {
        h.element({ setAttribute: (_n, v) => (set[sel] = v) });
        return this;
      }
      transform(res: Response): Response {
        return res;
      }
    }
    const g = globalThis as { HTMLRewriter?: unknown };
    g.HTMLRewriter = Rewriter;
    try {
      await onResultRequest({
        request: new Request(`https://x.test/r/?r=${r}`),
        next: async () =>
          new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      });
      expect(set['meta[property="og:title"]']).toBe('호랑이 1 vs 사자 1 — 호랑이 54%');
    } finally {
      delete g.HTMLRewriter;
    }
  });
});

describe('free reproduction check', () => {
  const c = free('wolf', 6, 'tiger', 1);

  it('carries the v3 config and the snapshot in the simulator fragment', () => {
    const s = { ...SNAP, ab: 0.4 };
    const hash = reproduceFreeHash(c, s);
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+&chk=[A-Za-z0-9_-]+$/);
    const back = freeConfigFromHash(hash);
    expect(back && freeConfigDiff(back)).toEqual(freeConfigDiff(c));
    expect(freeCheckFromHash(hash, c)).toEqual(s);
    // A snapshot that does not fit the config is ignored.
    expect(freeCheckFromHash(hash, free('tiger', 1, 'tiger', 1))).toBeNull();
    expect(freeCheckFromHash('#s=x&chk=bad!', c)).toBeNull();
    expect(freeCheckFromHash('#s=x', c)).toBeNull();
  });

  it('compares a fresh run: same, within the intervals, outside, changed', () => {
    const agg = fakeFreeAgg(500, 270, 210, 20);
    expect(compareFreeRun(SNAP, agg, true)).toBe('same');
    expect(compareFreeRun({ ...SNAP, a: 265, b: 215 }, agg, true)).toBe('within');
    expect(compareFreeRun({ ...SNAP, a: 400, b: 80 }, agg, true)).toBe('outside');
    expect(compareFreeRun(SNAP, agg, false)).toBe('changed');
  });
});
