import { interpolate, type Lang, type Vars } from '../i18n/lang.ts';
import { shareDictionary } from '../i18n/registry.ts';
import type { ShareMsgKey } from './messages-ko.ts';

/*
 * Words of the sharing features (config export/import, result links, the result page, the result
 * card, the text share and the link-preview function). Kept apart from the app dictionary so the
 * Pages Function and the result page carry only what they need. The tables are
 * src/share/messages-ko.ts and messages-en.ts; a page bundles only its own language and the
 * language switch loads the other one (src/i18n/registry.ts, #79). Placeholders follow the app
 * dictionary (`{name}`). Wording rules (CONTRIBUTING.md): neutral words only, 전투 불능 /
 * incapacitated.
 */

export type { ShareDictionary, ShareMsgKey } from './messages-ko.ts';

/** A sharing message in `lang` (that language must be loaded). */
export function sm(lang: Lang, key: ShareMsgKey, vars?: Vars): string {
  return interpolate(shareDictionary(lang)[key], vars);
}
