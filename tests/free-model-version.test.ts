import { describe, expect, it } from 'vitest';
import {
  decodeAnyResult,
  decodeAnyResultQuery,
  encodeFreeResult,
  freeCheckFromHash,
  reproduceFreeHash,
  type FreeResultSummary,
} from '../src/share/free-result-codec';
import { buildMeta } from '../src/share/result-text';
import { defaultConfig } from '../src/sim/config';
import {
  FREE_MODEL_VERSION,
  defaultFreeConfig,
  isFreeModelVersion,
  sanitizeFreeConfig,
} from '../src/sim/free/config';
import {
  encodeFreeConfig,
  freeConfigCode,
  freeConfigDiff,
  freeConfigFromHash,
  freeHashModelNewer,
  freeInputModelNewer,
  freeModelNewer,
  freeModelVersion,
  parseFreeConfigInput,
} from '../src/ui/share-free';
import { hashFromConfig } from '../src/ui/share';

/*
 * Model version `mv` in free links (ADR-0008, docs/SHARING.md#model-version-mv, #124): absent
 * means 1, model 1 links stay byte-identical, and a version this build does not run is never
 * read as its own.
 */

/** Payloads written by the encoder on main before `mv` existed (0e5bfd8). */
const OLD = {
  /** The default free config: T. rex 1 v T. rex 1. */
  defaults:
    'eyJ2IjozLCJtIjoiZnJlZSIsImEiOnsic3AiOiJ0cmV4IiwibiI6MX0sImIiOnsic3AiOiJ0cmV4IiwibiI6MX19',
  /** Tigers 5 v lions 5 with edited ranges, a buff switch off, a global and scalars. */
  edited:
    'eyJ2IjozLCJtIjoiZnJlZSIsImEiOnsic3AiOiJ0aWdlciIsIm4iOjV9LCJiIjp7InNwIjoibGlvbiIsIm4iOjUsInAiOnsibGF0Y2hEcHMiOlszLDgsMTVdfX0sImJ1ZmYiOnsicmVsaWVmIjpmYWxzZX0sImciOnsibGF0Y2hSYXRpbyI6WzIuNSwzLDRdfSwicnVucyI6MTIwLCJzZWVkIjo0MiwibW9yYWxlIjpmYWxzZX0',
  /** Wolves 8 v a brown bear, 300 runs. */
  wolves:
    'eyJ2IjozLCJtIjoiZnJlZSIsImEiOnsic3AiOiJ3b2xmIiwibiI6OH0sImIiOnsic3AiOiJicm93bkJlYXIiLCJuIjoxfSwicnVucyI6MzAwfQ',
  /** A free result link (`r`) of the wolves with a full snapshot. */
  result:
    'eyJ2IjoyLCJjIjp7InYiOjMsIm0iOiJmcmVlIiwiYSI6eyJzcCI6IndvbGYiLCJuIjo4fSwiYiI6eyJzcCI6ImJyb3duQmVhciIsIm4iOjF9LCJydW5zIjozMDB9LCJzIjp7Im4iOjMwMCwiYSI6NDEsImIiOjI1MCwiZCI6OSwidCI6ODguNCwiYXMiOjUuMSwiYnMiOjAuMiwiYWsiOjEuMywiYmsiOjAuOCwiYXIiOjEuNiwiYnIiOjAsImFiIjowLjYyLCJhdCI6NzEuNSwiY2kiOlswLjEsMC4xOCwwLjc4LDAuODcsMC4wMSwwLjA2XX19',
} as const;

const json = (payload: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
const encode = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('model version of the free config', () => {
  it('is 1 in this build, for the defaults and wherever it is absent', () => {
    expect(FREE_MODEL_VERSION).toBe(1);
    expect(defaultFreeConfig().mv).toBe(1);
    expect(sanitizeFreeConfig({}).mv).toBe(1);
    expect(sanitizeFreeConfig({ mv: 1 }).mv).toBe(1);
  });

  it('accepts only integers from 1 to FREE_MODEL_VERSION', () => {
    expect(isFreeModelVersion(1)).toBe(true);
    for (const v of [0, -1, 1.5, FREE_MODEL_VERSION + 1, Number.NaN, '1', null, undefined, [1]]) {
      expect(isFreeModelVersion(v)).toBe(false);
      expect(sanitizeFreeConfig({ mv: v }).mv).toBe(1);
    }
  });
});

describe('links made before mv existed', () => {
  it('decode as model 1 and re-encode byte for byte', () => {
    for (const payload of [OLD.defaults, OLD.edited, OLD.wolves]) {
      const c = freeConfigFromHash(`#s=${payload}`);
      expect(c?.mv).toBe(1);
      if (!c) return;
      expect(encodeFreeConfig(c)).toBe(payload);
      expect(freeConfigDiff(c)).toEqual(json(payload));
      expect(parseFreeConfigInput(`TVT3-${payload}`)).toEqual(c);
      // An explicit `mv: 1` is the same link.
      expect(freeConfigFromHash(`#s=${encode({ ...json(payload), mv: 1 })}`)).toEqual(c);
    }
  });

  it('decode to the same matchup and settings as before', () => {
    const c = freeConfigFromHash(`#s=${OLD.edited}`);
    expect(c).toEqual(
      sanitizeFreeConfig({
        runs: 120,
        seed: 42,
        morale: false,
        sides: [
          { species: 'tiger', count: 5 },
          { species: 'lion', count: 5, params: { latchDps: { min: 3, mode: 8, max: 15 } } },
        ],
        packBuff: { relief: false },
        globals: { latchRatio: { min: 2.5, mode: 3, max: 4 } },
      }),
    );
    expect(freeConfigFromHash(`#s=${OLD.defaults}`)).toEqual(defaultFreeConfig());
    expect(freeConfigCode(defaultFreeConfig())).toBe(`TVT3-${OLD.defaults}`);
  });

  it('keep free result links decoding and re-encoding unchanged', () => {
    const res = decodeAnyResult(OLD.result);
    expect(res.ok && res.kind).toBe('free');
    if (!res.ok || res.kind !== 'free') return;
    expect(res.config.mv).toBe(1);
    const old = json(OLD.result);
    expect(res.summary).toEqual(old['s']);
    expect(freeConfigDiff(res.config)).toEqual(old['c']);
    // The validator orders the summary keys its own way, so encode the snapshot as it came.
    expect(encodeFreeResult(res.config, old['s'] as FreeResultSummary)).toBe(OLD.result);
    expect(reproduceFreeHash(res.config, res.summary)).toMatch(new RegExp(`^#s=${OLD.wolves}&`));
  });
});

describe('the encoder', () => {
  it('omits mv while it is 1 and writes any other version after the mode marker', () => {
    const c = sanitizeFreeConfig({ sides: [{ species: 'lion', count: 5 }, { species: 'tiger' }] });
    expect(Object.keys(freeConfigDiff(c))).toEqual(['v', 'm', 'a', 'b']);
    // A later model (not runnable here yet) is written explicitly.
    const later = freeConfigDiff({ ...c, mv: 2 });
    expect(Object.keys(later)).toEqual(['v', 'm', 'mv', 'a', 'b']);
    expect(later['mv']).toBe(2);
  });
});

describe('a model version this build does not run', () => {
  const newer = { ...json(OLD.edited), mv: FREE_MODEL_VERSION + 1 };

  it('is named by freeModelVersion as null; absent is 1', () => {
    expect(freeModelVersion(json(OLD.edited))).toBe(1);
    expect(freeModelVersion({ mv: 1 })).toBe(1);
    expect(freeModelVersion(newer)).toBeNull();
    for (const mv of [0, -1, 1.5, '1', null, true, [1], {}])
      expect(freeModelVersion({ mv })).toBeNull();
  });

  it('is newer only as an integer above FREE_MODEL_VERSION (freeModelNewer)', () => {
    expect(freeModelNewer(newer)).toBe(true);
    expect(freeModelNewer({ mv: FREE_MODEL_VERSION + 7 })).toBe(true);
    for (const mv of [1, 0, -1, 1.5, FREE_MODEL_VERSION + 0.5, '1', '2', null, true, [2], {}])
      expect(freeModelNewer({ mv }), JSON.stringify(mv)).toBe(false);
    expect(freeModelNewer(json(OLD.edited))).toBe(false);
  });

  it('opens a settings link or code at the free defaults, never with its values', () => {
    const payload = encode(newer);
    expect(freeConfigFromHash(`#s=${payload}`)).toEqual(defaultFreeConfig());
    expect(parseFreeConfigInput(`TVT3-${payload}`)).toEqual(defaultFreeConfig());
    expect(parseFreeConfigInput(`https://example.org/en/#s=${payload}`)).toEqual(
      defaultFreeConfig(),
    );
    // A malformed mv is still a free link: it never falls through to the classic decoder.
    for (const mv of [0, -1, 1.5, '1', '2', null]) {
      const bad = encode({ ...newer, mv });
      expect(freeConfigFromHash(`#s=${bad}`)).toEqual(defaultFreeConfig());
      expect(parseFreeConfigInput(`TVT3-${bad}`)).toEqual(defaultFreeConfig());
    }
  });

  it('is refused by the import field when pasted (freeInputModelNewer)', () => {
    const payload = encode(newer);
    for (const text of [
      `TVT3-${payload}`,
      `  tvt3-${payload}\n`,
      `https://example.org/en/#s=${payload}`,
      `https://example.org/en/#s=${payload}&chk=${encode({ n: 200, a: 120, b: 70, d: 10 })}`,
      payload,
    ]) {
      expect(freeInputModelNewer(text), text).toBe(true);
    }
    // A model this build runs, a malformed mv (applied as the defaults, like any malformed
    // value), a classic code or link, or no payload: not refused as newer.
    for (const text of [
      `TVT3-${OLD.edited}`,
      `https://example.org/en/#s=${OLD.wolves}`,
      ...[0, -1, 1.5, '1', '2', null].map((mv) => `TVT3-${encode({ ...newer, mv })}`),
      `TVT2-${encode({ v: 2, mv: FREE_MODEL_VERSION + 1 })}`,
      `https://example.org/en/${hashFromConfig({ ...defaultConfig(), seed: 7 })}`,
      encode({ v: 3, mv: FREE_MODEL_VERSION + 1 }),
      '',
      'TVT3-',
      'TVT3-%%%',
      'https://example.org/',
    ]) {
      expect(freeInputModelNewer(text), text).toBe(false);
    }
  });

  it('is found in a location hash, so the app keeps that address (freeHashModelNewer)', () => {
    const payload = encode(newer);
    const chk = encode({ n: 200, a: 120, b: 70, d: 10 });
    for (const hash of [
      `#s=${payload}`,
      `s=${payload}`,
      `#s=${payload}&chk=${chk}`,
      `#chk=${chk}&s=${payload}`,
      `#s=${encode({ ...newer, mv: FREE_MODEL_VERSION + 5 })}`,
    ]) {
      expect(freeHashModelNewer(hash), hash).toBe(true);
    }
    // A model this build runs, a malformed mv, a classic link, no payload or a malformed one: the
    // app writes the address as before. No build will ever run a malformed mv, so a reload could
    // not open it and the note would not be true.
    for (const hash of [
      ...[0, -1, 1.5, '1', '2', null, true].map((mv) => `#s=${encode({ ...newer, mv })}`),
      `#s=${OLD.edited}`,
      `#s=${encode({ ...json(OLD.edited), mv: 1 })}`,
      `#s=${OLD.wolves}&chk=${chk}`,
      hashFromConfig({ ...defaultConfig(), heavyCount: 3, seed: 7 }),
      `#s=${encode({ v: 2, mv: FREE_MODEL_VERSION + 1 })}`,
      `#s=${encode({ v: 3, mv: FREE_MODEL_VERSION + 1 })}`,
      '',
      '#',
      '#s=',
      '#s=%%',
      '#tour',
    ]) {
      expect(freeHashModelNewer(hash), hash).toBe(false);
    }
  });

  it('rejects a result link as a version error without a config to rerun', () => {
    const c = { ...(json(OLD.result)['c'] as object), mv: FREE_MODEL_VERSION + 1 };
    const r = encode({ ...json(OLD.result), c });
    expect(decodeAnyResult(r)).toEqual({ ok: false, error: 'version', config: null });
    expect(decodeAnyResultQuery(`?r=${r}`)).toEqual({ ok: false, error: 'version', config: null });
    // The link preview keeps the static text.
    expect(buildMeta(`?r=${r}`, 'en')).toBeNull();
    expect(buildMeta(`?r=${OLD.result}`, 'en')).not.toBeNull();
  });

  it('drops the snapshot of a "Run it yourself" link, so no reproduction is reported', () => {
    // The fragment an mv 2 result page writes: its settings and a snapshot that fits the defaults.
    const chk = encode({ n: 200, a: 120, b: 70, d: 10 });
    const sides = { a: { sp: 'tiger', n: 1 }, b: { sp: 'lion', n: 1 } };
    const later = { v: 3, m: 'free', mv: FREE_MODEL_VERSION + 1, ...sides, runs: 200 };
    const hash = `#s=${encode(later)}&chk=${chk}`;
    const c = freeConfigFromHash(hash);
    expect(c).toEqual(defaultFreeConfig());
    if (!c) return;
    expect(freeCheckFromHash(hash, c)).toBeNull();
    expect(freeCheckFromHash(hash.slice(1), c)).toBeNull();
    // The same snapshot under model 1 (absent or explicit) is still checked.
    const own = (mv: object): string =>
      `#s=${encode({ v: 3, m: 'free', ...mv, a: { sp: 'trex', n: 1 }, b: { sp: 'trex', n: 1 } })}&chk=${chk}`;
    for (const mv of [{}, { mv: 1 }]) {
      expect(freeCheckFromHash(own(mv), c)).toEqual({ n: 200, a: 120, b: 70, d: 10 });
    }
  });
});
