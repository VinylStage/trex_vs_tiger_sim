import { shareEn } from '../share/messages-en.ts';
import { shareKo, type ShareDictionary } from '../share/messages-ko.ts';
import { en } from './en.ts';
import { ko, type Dictionary } from './ko.ts';
import type { Lang } from './lang.ts';

/*
 * Both dictionaries at once, for build-time code (src/seo, the header and footer renderers in
 * src/pages) and the tests. Never import this from code that ships to the browser: it would put
 * both languages into the bundle again (#79; tests/i18n.test.ts checks the built entries).
 */
export const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { ko, en };

/** Both sharing tables at once (tests). */
export const SHARE_MESSAGES: Readonly<Record<Lang, ShareDictionary>> = { ko: shareKo, en: shareEn };
