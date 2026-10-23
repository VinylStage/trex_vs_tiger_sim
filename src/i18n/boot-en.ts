import { shareEn } from '../share/messages-en.ts';
import { en } from './en.ts';
import { registerLang } from './registry.ts';

/** Register the English words; the English entries call this before they start (see boot-ko.ts). */
export function registerEn(): void {
  registerLang('en', en, shareEn);
}
