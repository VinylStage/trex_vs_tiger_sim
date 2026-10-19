// Self-hosted Pretendard (ADR-0005). src/main.ts imports the same file, so the build emits one
// @font-face stylesheet shared by the app and the pages and links it from each page's HTML
// (it applies without JavaScript too).
import '../assets/fonts/pretendard/pretendard-variable-dynamic-subset.css';
import { LANG_STORAGE_KEY, counterpartPath, parsePagePath } from './routes';

/*
 * Progressive enhancement for the static content pages (docs/PAGES.md). Every page works
 * without this script; it only
 * 1. marks the current page in the site navigation (aria-current), and
 * 2. keeps the language link pointing at the same section of the counterpart page, and makes
 *    links to the simulator open it in the language being read.
 * It must not import src/ui/i18n.ts at runtime (that would pull the dictionaries into the pages).
 */

const here = parsePagePath(location.pathname);
for (const a of document.querySelectorAll<HTMLAnchorElement>('.site-nav a[data-page]')) {
  if (here && a.dataset['page'] === here.page) a.setAttribute('aria-current', 'page');
  else a.removeAttribute('aria-current');
}

const langLink = document.querySelector<HTMLAnchorElement>('a[data-lang-switch]');
const counterpart = counterpartPath(location.pathname);
const syncLangLink = (): void => {
  if (langLink && counterpart) langLink.href = counterpart + location.hash;
};
syncLangLink();
window.addEventListener('hashchange', syncLangLink);

document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a') : null;
  if (a && a === langLink) syncLangLink();
  const lang = here?.lang;
  if (!a || !lang || a.origin !== location.origin || a.pathname !== '/') return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Storage may be blocked; the simulator then opens in its default language.
  }
});
