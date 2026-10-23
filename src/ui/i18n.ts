import type { ParamId } from '../sim/params.ts';
import {
  DEFAULT_HEAVY,
  DEFAULT_PACK,
  type HeavySpeciesId,
  type PackSpeciesId,
  type SpeciesId,
  type Weapon,
} from '../sim/species.ts';

import { DEFAULT_LANG, interpolate, type Lang, type Vars } from '../i18n/lang.ts';
import type { Dictionary, MsgKey } from '../i18n/ko.ts';
import { loadLang } from '../i18n/load.ts';
import { dictionary } from '../i18n/registry.ts';

/*
 * The i18n runtime of the app (#67): current language, `t()`, species-name grammar and applying
 * strings to bound DOM elements. The words live in src/i18n/ko.ts and en.ts; a page bundles only
 * its own language, and `setLang` loads the other one before switching (#79).
 */

export { DEFAULT_LANG, LANGS, interpolate, isLang, otherLang } from '../i18n/lang.ts';
export type { Lang, Vars } from '../i18n/lang.ts';
export type { Dictionary, MsgKey } from '../i18n/ko.ts';
export { loadLang } from '../i18n/load.ts';

let current: Lang = DEFAULT_LANG;
const listeners = new Set<(lang: Lang) => void>();

/** The loaded dictionary of `lang` (the current language by default). */
export const words = (lang: Lang = current): Dictionary => dictionary(lang);

export function getLang(): Lang {
  return current;
}

/** The species pair whose names fill `{heavy}`, `{Pack}`, … in messages (see `speciesVars`). */
export interface NamePair {
  heavySpecies: HeavySpeciesId;
  packSpecies: PackSpeciesId;
}

let names: NamePair = { heavySpecies: DEFAULT_HEAVY, packSpecies: DEFAULT_PACK };

/**
 * Set the species named by messages that do not pass their own names: the results, charts and
 * replay of the shown run. The form passes its own (`speciesVars`).
 */
export function setNamePair(pair: NamePair): void {
  names = { heavySpecies: pair.heavySpecies, packSpecies: pair.packSpecies };
}

export function getNamePair(): NamePair {
  return { ...names };
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Short species name, singular (`one`) or plural (`other`), in the current language. */
export function speciesShort(
  id: SpeciesId,
  form: 'one' | 'other' = 'one',
  lang: Lang = current,
): string {
  return dictionary(lang)[`species.${id}.${form}`];
}

/** Full species name (pickers, table headings). */
export function speciesName(id: SpeciesId): string {
  return dictionary(current)[`species.${id}`];
}

/**
 * Name placeholders for a species pair: `{heavy}` short singular, `{heavyPl}` plural, and
 * capitalised `{Heavy}`/`{HeavyPl}` (the same for `pack`). Korean has no plural or case, so all
 * four are the same there; messages therefore never put a particle after a name.
 */
export function speciesVars(pair: NamePair = names, lang: Lang = current): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, id] of [
    ['heavy', pair.heavySpecies],
    ['pack', pair.packSpecies],
  ] as const) {
    const one = speciesShort(id, 'one', lang);
    const other = speciesShort(id, 'other', lang);
    const Role = capitalize(role);
    out[role] = one;
    out[`${role}Pl`] = other;
    out[Role] = capitalize(one);
    out[`${Role}Pl`] = capitalize(other);
    out[`${role}Counter`] = speciesCounter(id, lang);
  }
  return out;
}

/**
 * Korean counter word for a species: 명 for the hominin, 마리 for animals. English has none, so
 * the `{counter}` placeholders in English messages are empty.
 */
const KO_COUNTERS: Partial<Record<SpeciesId, string>> = { homoErectus: '명' };

export function speciesCounter(id: SpeciesId, lang: Lang = current): string {
  return lang === 'ko' ? (KO_COUNTERS[id] ?? '마리') : '';
}

/** "10 T-Rex" / "T-Rex 10마리" / "호모 에렉투스 100명": a head count with the right forms. */
export function teamLabel(id: SpeciesId, n: number): string {
  const rule = new Intl.PluralRules(locale()).select(n) === 'one' ? 'one' : 'other';
  return t(`team.${rule}`, {
    n: n.toLocaleString(locale()),
    name: speciesShort(id, rule),
    counter: speciesCounter(id),
  });
}

export function t(key: MsgKey, vars?: Vars): string {
  const template = dictionary(current)[key];
  // Name placeholders default to the current name pair; explicit vars win.
  return interpolate(template, template.includes('{') ? { ...speciesVars(), ...vars } : vars);
}

/** The label key of a parameter, with the heavy species' weapon overrides (docs/SPECIES.md). */
export function paramLabelKey(id: ParamId, weapon: Weapon = 'bite'): MsgKey {
  if (weapon !== 'bite') {
    if (id === 'heavy.biteForce') return `param.weapon.${weapon}`;
    if (
      id === 'heavy.biteLethality' ||
      id === 'heavy.biteInterval' ||
      id === 'heavy.biteReach' ||
      id === 'heavy.biteArc' ||
      id === 'heavy.biteAccuracy'
    ) {
      return `param.attack.${id.slice('heavy.'.length) as 'biteLethality'}`;
    }
  }
  return `param.${id}`;
}

export function paramLabel(id: ParamId, weapon?: Weapon): string {
  return t(paramLabelKey(id, weapon));
}

export function paramHelp(id: ParamId, vars?: Vars): string {
  return t(`paramHelp.${id}`, vars);
}

/** BCP 47 locale for number formatting. */
export function locale(): string {
  return current === 'ko' ? 'ko-KR' : 'en-US';
}

function syncDocumentLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

/**
 * Set the starting language and apply it to `<html lang>`. The app passes the language of its
 * URL (`/` Korean, `/en/` English; see `pageLang` in src/pages/routes.ts). Nothing is stored.
 */
export function initLang(lang: Lang = DEFAULT_LANG): Lang {
  current = lang;
  syncDocumentLang();
  return current;
}

/**
 * Switch the language: load its words if this page has not yet (#79), then relabel. Resolves
 * once every listener ran. Rejects (and changes nothing) when the words cannot be loaded.
 */
export async function setLang(lang: Lang): Promise<void> {
  if (lang === current) return;
  await loadLang(lang);
  if (lang === current) return;
  current = lang;
  syncDocumentLang();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Attribute names used to bind static elements to message keys. */
export const I18N_ATTR = {
  text: 'data-i18n',
  title: 'data-i18n-title',
  aria: 'data-i18n-aria',
} as const;

function isMsgKey(v: string | null): v is MsgKey {
  return v !== null && Object.hasOwn(dictionary(current), v);
}

/** Re-translate every bound element under `root` (text, title and aria-label bindings). */
export function applyI18n(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.text}]`)) {
    const key = el.getAttribute(I18N_ATTR.text);
    if (isMsgKey(key)) el.textContent = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.title}]`)) {
    const key = el.getAttribute(I18N_ATTR.title);
    if (isMsgKey(key)) el.title = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>(`[${I18N_ATTR.aria}]`)) {
    const key = el.getAttribute(I18N_ATTR.aria);
    if (isMsgKey(key)) el.setAttribute('aria-label', t(key));
  }
}
