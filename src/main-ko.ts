/* Korean simulator entry (index.html): register its words, then start the app (#79). */
import { registerKo } from './i18n/boot-ko.ts';
import { start } from './main.ts';

registerKo();
start();
