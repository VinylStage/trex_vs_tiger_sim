import type { Lang } from './lang.ts';
import { hasLang, registerLang } from './registry.ts';

/*
 * Loads a language's words on demand (#79): the language switch of the app awaits this before it
 * relabels anything, and hovering or focusing the button warms it. Only the word tables are
 * imported here (src/i18n/<lang>.ts and src/share/messages-<lang>.ts), the same modules the
 * entries of that language bundle statically, so the chunks stay shared and hold nothing else.
 */

const LOADERS: Readonly<Record<Lang, () => Promise<void>>> = {
  ko: async () => {
    const [{ ko }, { shareKo }] = await Promise.all([
      import('./ko.ts'),
      import('../share/messages-ko.ts'),
    ]);
    registerLang('ko', ko, shareKo);
  },
  en: async () => {
    const [{ en }, { shareEn }] = await Promise.all([
      import('./en.ts'),
      import('../share/messages-en.ts'),
    ]);
    registerLang('en', en, shareEn);
  },
};

const pending = new Map<Lang, Promise<void>>();

export function loadLang(lang: Lang): Promise<void> {
  if (hasLang(lang)) return Promise.resolve();
  let p = pending.get(lang);
  if (!p) {
    p = LOADERS[lang]().catch((err: unknown) => {
      pending.delete(lang);
      throw err;
    });
    pending.set(lang, p);
  }
  return p;
}
