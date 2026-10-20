// Self-hosted Pretendard (ADR-0005). src/main.ts imports the same file, so the build emits one
// @font-face stylesheet shared by the app and the pages and links it from each page's HTML
// (it applies without JavaScript too).
import '../assets/fonts/pretendard/pretendard-variable-dynamic-subset.css';
import { dropLegacyStorage } from './legacy-storage';
import { counterpartPath, parsePagePath } from './routes';

/*
 * Progressive enhancement for the static content pages (docs/PAGES.md). Every page works
 * without this script; it only
 * 1. marks the current page in the site navigation (aria-current),
 * 2. keeps the language link pointing at the same section of the counterpart page,
 * 3. writes the running version into the footer's version link, and
 * 4. deletes the language value v0.1.0 stored (src/pages/legacy-storage.ts).
 * Nothing is stored: every page, the simulator included, takes its language from its URL.
 * It must not import src/ui/i18n.ts at runtime (that would pull the dictionaries into the pages).
 */

dropLegacyStorage();

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
langLink?.addEventListener('click', syncLangLink);

for (const el of document.querySelectorAll<HTMLElement>('[data-app-version]')) {
  el.textContent = `v${__APP_VERSION__}`;
}
