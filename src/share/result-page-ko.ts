/* Korean result page entry (r/index.html): register its words, then render (#79). */
import { registerKo } from '../i18n/boot-ko.ts';
import { startResultPage } from './result-page.ts';

registerKo();
startResultPage();
