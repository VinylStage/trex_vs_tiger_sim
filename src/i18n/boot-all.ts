import { registerEn } from './boot-en.ts';
import { registerKo } from './boot-ko.ts';

/* Both languages: for the Pages Function, which answers /r/ and /en/r/, and for the tests. */
registerKo();
registerEn();
