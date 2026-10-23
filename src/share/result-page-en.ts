/* English result page entry (en/r/index.html): register its words, then render (#79). */
import { registerEn } from '../i18n/boot-en.ts';
import { startResultPage } from './result-page.ts';

registerEn();
startResultPage();
