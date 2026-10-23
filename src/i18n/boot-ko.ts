import { shareKo } from '../share/messages-ko.ts';
import { ko } from './ko.ts';
import { registerLang } from './registry.ts';

/**
 * Register the Korean words. The Korean entries call this before they start their page (#79):
 * Vite turns an entry's chunk imports into separate script tags, so a side-effect import would not
 * be guaranteed to run first.
 */
export function registerKo(): void {
  registerLang('ko', ko, shareKo);
}
