import type { ScenarioConfig } from '../sim/config.ts';
import {
  base64UrlDecode,
  configDiff,
  configFromObject,
  encodeConfig,
  MAX_SHARE_LENGTH,
  payloadFromHash,
  SHARE_VERSION,
} from '../ui/share.ts';

/*
 * Config export/import (docs/SHARING.md#config-code): a copy/paste code `TVT2-<payload>` and a
 * small `.json` file. Both carry the same payload as the `#s=` link and are decoded through the
 * same pipeline: length → alphabet → JSON → v1 upgrade → `sanitizeConfig`. Pure, DOM-free.
 */

/** Prefix of a config code. The digit is the payload version (`SHARE_VERSION`). */
export const CODE_PREFIX = `TVT${SHARE_VERSION}-`;
/** Largest accepted `.json` file, in bytes. */
export const MAX_CONFIG_FILE_BYTES = 64 * 1024;
/** `app` and `kind` of an exported file. */
export const FILE_APP = 'trex-vs-tiger';
export const FILE_KIND = 'config';

export type ParseError = 'empty' | 'length' | 'alphabet' | 'json' | 'shape' | 'noPayload' | 'app';

export type ParseResult = { ok: true; config: ScenarioConfig } | { ok: false; error: ParseError };

/** The copy/paste code of a config (`TVT2-` alone for the defaults). */
export function configCode(config: ScenarioConfig): string {
  return CODE_PREFIX + encodeConfig(config);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Strictly decode a bare `encodeConfig` payload; `''` is the defaults. */
export function parsePayload(payload: string): ParseResult {
  if (payload.length > MAX_SHARE_LENGTH) return { ok: false, error: 'length' };
  if (!/^[A-Za-z0-9_-]*$/.test(payload)) return { ok: false, error: 'alphabet' };
  if (payload === '') return { ok: true, config: configFromObject({ v: SHARE_VERSION }) };
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(payload));
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'shape' };
  return { ok: true, config: configFromObject(parsed) };
}

/**
 * Parse whatever a person pasted: a config code (`TVT2-…`, any case), a full link with `#s=`
 * (a link without one is rejected), or a bare payload. Surrounding whitespace is ignored.
 */
export function parseConfigInput(input: string): ParseResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'empty' };
  if (text.length > MAX_SHARE_LENGTH + 2048) return { ok: false, error: 'length' };
  if (text.slice(0, CODE_PREFIX.length).toUpperCase() === CODE_PREFIX) {
    return parsePayload(text.slice(CODE_PREFIX.length));
  }
  if (/^https?:\/\//i.test(text) || text.includes('#')) {
    const hashAt = text.indexOf('#');
    const payload = hashAt < 0 ? null : payloadFromHash(text.slice(hashAt));
    return payload === null ? { ok: false, error: 'noPayload' } : parsePayload(payload);
  }
  return parsePayload(text);
}

/** The exported `.json` document of a config. */
export function configFileJson(config: ScenarioConfig, exportedAt: Date): string {
  const doc = {
    app: FILE_APP,
    kind: FILE_KIND,
    v: SHARE_VERSION,
    config: configDiff(config),
    exportedAt: exportedAt.toISOString(),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** File name of an export, e.g. `trex-vs-tiger-config-trex10-tiger100.json`. */
export function configFileName(config: ScenarioConfig): string {
  const side = (id: string, n: number): string => `${id.replace(/[^A-Za-z0-9]/g, '')}${n}`;
  return `${FILE_APP}-config-${side(config.heavySpecies, config.heavyCount)}-${side(config.packSpecies, config.packCount)}.json`;
}

/**
 * Parse the text of an imported `.json` file. `byteLength` is the file size (checked before the
 * text is read by the caller, and again here). The `config` object is decoded like a payload:
 * `v` < 2 in the file means v1 names.
 */
export function parseConfigFile(text: string, byteLength = text.length): ParseResult {
  if (byteLength > MAX_CONFIG_FILE_BYTES || text.length > MAX_CONFIG_FILE_BYTES) {
    return { ok: false, error: 'length' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'shape' };
  if (parsed['app'] !== FILE_APP || parsed['kind'] !== FILE_KIND) {
    return { ok: false, error: 'app' };
  }
  const config = parsed['config'];
  if (!isPlainObject(config)) return { ok: false, error: 'shape' };
  const v = typeof parsed['v'] === 'number' ? parsed['v'] : 1;
  return { ok: true, config: configFromObject({ ...config, v }) };
}
