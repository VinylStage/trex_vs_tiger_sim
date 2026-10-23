import type { ShareDictionary } from '../share/messages-ko.ts';
import type { Lang } from './lang.ts';
import type { Dictionary } from './ko.ts';

/*
 * The dictionaries a page has loaded (#79). A page statically bundles only its own language
 * (src/i18n/boot-ko.ts or boot-en.ts, imported first by its entry); the other language registers
 * itself when the language switch loads it (src/i18n/load.ts). Build-time code and tests that need
 * both languages use src/i18n/dictionaries.ts or src/i18n/boot-all.ts instead.
 */

interface LangTables {
  ui: Dictionary;
  share: ShareDictionary;
}

const tables: Partial<Record<Lang, LangTables>> = {};

export function registerLang(lang: Lang, ui: Dictionary, share: ShareDictionary): void {
  tables[lang] = { ui, share };
}

export const hasLang = (lang: Lang): boolean => tables[lang] !== undefined;

function tablesOf(lang: Lang): LangTables {
  const t = tables[lang];
  if (!t) throw new Error(`i18n: the ${lang} dictionary is not loaded`);
  return t;
}

/** The app and site words in `lang`; throws when that language is not loaded. */
export const dictionary = (lang: Lang): Dictionary => tablesOf(lang).ui;

/** The sharing words in `lang`; throws when that language is not loaded. */
export const shareDictionary = (lang: Lang): ShareDictionary => tablesOf(lang).share;
