import './assets/fonts/pretendard/pretendard-variable-dynamic-subset.css';
import './assets/fonts/pretendard-fallback.css';
import './ui/styles.css';
import { dropLegacyStorage } from './pages/legacy-storage';
import { startApp } from './ui/app';

/** Start the simulator; the page's entry (main-ko.ts / main-en.ts) registers its words first. */
export function start(): void {
  dropLegacyStorage();
  const root = document.getElementById('app');
  if (root) startApp(root);
}
