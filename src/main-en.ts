/* English simulator entry (en/index.html): register its words, then start the app (#79). */
import { registerEn } from './i18n/boot-en.ts';
import { start } from './main.ts';

registerEn();
start();
