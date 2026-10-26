/*
 * Language basics shared by the app, the pages, the sharing code, the SEO build and the Pages
 * Function (#67). No dictionary and no DOM here, so any layer may import it.
 */

export type Lang = 'ko' | 'en';
export const LANGS: readonly Lang[] = ['ko', 'en'];
export const DEFAULT_LANG: Lang = 'ko';

/** The other of the two languages. */
export const otherLang = (lang: Lang): Lang => (lang === 'ko' ? 'en' : 'ko');

export type Vars = Readonly<Record<string, string | number>>;

/** Replace `{name}` placeholders; unknown placeholders are left as-is. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}
