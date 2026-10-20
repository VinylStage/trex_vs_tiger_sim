import {
  BLOG_URL,
  CONTENT_PAGES,
  LINKTREE_URL,
  SITE_ORIGIN,
  canonicalUrl,
  type PageId,
} from '../pages/routes.ts';
import { DICTIONARIES, LANGS, type Lang } from '../ui/i18n.ts';

/*
 * The one registry behind every generated SEO artefact (docs/SEO.md): head tags and JSON-LD
 * (head.ts), sitemap.xml (sitemap.ts), robots.txt (robots.ts) and llms.txt (llms.ts). Page words
 * (titles, descriptions, headings, FAQ) come from each page's own HTML; names come from the UI
 * dictionaries; URLs from src/pages/routes.ts.
 */

/** Every indexable page, in sitemap and llms.txt order. `/reset/` and the 404 pages are not pages. */
export const INDEXABLE_PAGES: readonly PageId[] = ['simulator', ...CONTENT_PAGES];

/** Every indexable URL as `{ page, lang }`, Korean first. */
export const INDEXABLE_ROUTES: readonly { page: PageId; lang: Lang }[] = LANGS.flatMap((lang) =>
  INDEXABLE_PAGES.map((page) => ({ page, lang })),
);

/** Language used for `hreflang="x-default"`: English, for readers of neither language (SEO_GEO §1.4). */
export const X_DEFAULT_LANG: Lang = 'en';

/** Source file of a page, relative to the repository root. */
export function pageSource(page: PageId, lang: Lang): string {
  const dir = page === 'simulator' ? '' : `${page}/`;
  return `${lang === 'en' ? 'en/' : ''}${dir}index.html`;
}

/** hreflang alternates of a page: every language plus x-default, absolute URLs. */
export function alternates(page: PageId): { hreflang: string; href: string }[] {
  return [
    ...LANGS.map((lang) => ({ hreflang: lang, href: canonicalUrl(page, lang) })),
    { hreflang: 'x-default', href: canonicalUrl(page, X_DEFAULT_LANG) },
  ];
}

/** Open Graph locale (`language_TERRITORY`). */
export const OG_LOCALE: Readonly<Record<Lang, string>> = { ko: 'ko_KR', en: 'en_US' };

/** The language's 1200×630 social card in public/ (docs/BRANDING.md). */
export const OG_IMAGE: Readonly<
  Record<Lang, { url: string; width: number; height: number; type: string; alt: string }>
> = {
  ko: {
    url: `${SITE_ORIGIN}/og-image-ko.png`,
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: '티렉스 대 호랑이: 몬테카를로 전투 시뮬레이션. 티라노사우루스 10마리(파란 삼각형)와 호랑이 100마리(주황색 점)가 맞붙는 전투 재생 장면',
  },
  en: {
    url: `${SITE_ORIGIN}/og-image-en.png`,
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: 'T-Rex vs Tiger: Monte Carlo battle simulator. A replay frame of 10 T. rex (blue triangles) facing 100 tigers (orange dots)',
  },
};

/** Site names (SEO_GEO §5.4): one per language, plus the Korean alternate name. */
export const SITE_NAME: Readonly<Record<Lang, string>> = {
  ko: DICTIONARIES.ko['app.shortTitle'],
  en: DICTIONARIES.en['app.shortTitle'],
};
export const SITE_ALTERNATE_NAMES: readonly string[] = [SITE_NAME.en, '티라노사우루스 vs 호랑이'];

/** The author, the same node on every page and ideally on the owner's other sites. */
export const PERSON = {
  id: 'https://link.vinylims.com/#person',
  name: 'VinylStage',
  url: 'https://github.com/VinylStage',
  sameAs: [LINKTREE_URL, BLOG_URL, 'https://github.com/VinylStage'],
} as const;

export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const appId = (lang: Lang): string => `${canonicalUrl('simulator', lang)}#app`;

/** schema.org type of each content page's main node. */
export const PAGE_TYPE: Readonly<Record<Exclude<PageId, 'simulator'>, string>> = {
  guide: 'TechArticle',
  model: 'TechArticle',
  parameters: 'TechArticle',
  about: 'AboutPage',
  'patch-notes': 'WebPage',
  privacy: 'WebPage',
  license: 'WebPage',
};

/** Topics of the simulator, as Wikidata entities (SEO_GEO §2.3, checked 2026-10-19). */
export const TOPICS: readonly { name: string; sameAs: string[] }[] = [
  {
    name: 'Tyrannosaurus',
    sameAs: ['https://www.wikidata.org/wiki/Q14332', 'https://en.wikipedia.org/wiki/Tyrannosaurus'],
  },
  {
    name: 'Tiger',
    sameAs: ['https://www.wikidata.org/wiki/Q19939', 'https://en.wikipedia.org/wiki/Tiger'],
  },
  { name: 'Monte Carlo method', sameAs: ['https://www.wikidata.org/wiki/Q232207'] },
];

/**
 * Webmaster-tool ownership codes (owner action, docs/SEO.md#owner-actions). A non-empty value
 * adds `<meta name="<name>" content="<value>">` to the Korean home page `/` only.
 */
export const SITE_VERIFICATION: Readonly<Record<string, string>> = {
  'naver-site-verification': '',
  'msvalidate.01': '',
};
