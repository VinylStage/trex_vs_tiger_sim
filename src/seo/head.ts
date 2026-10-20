import {
  NAV_LABEL_KEYS,
  SITE_ORIGIN,
  canonicalUrl,
  pagePath,
  type PageId,
} from '../pages/routes.ts';
import { DICTIONARIES, LANGS, type Lang } from '../ui/i18n.ts';
import type { PageFacts } from './extract.ts';
import { escapeHtml } from './html.ts';
import {
  OG_IMAGE,
  OG_LOCALE,
  PAGE_TYPE,
  PERSON,
  SITE_ALTERNATE_NAMES,
  SITE_NAME,
  SITE_VERIFICATION,
  TOPICS,
  WEBSITE_ID,
  alternates,
  appId,
} from './site.ts';

/** Everything the generated head of one page depends on. */
export interface HeadInput {
  page: PageId;
  lang: Lang;
  facts: PageFacts;
  /** Last commit date of the page source (ISO 8601), or null when git cannot tell. */
  dateModified: string | null;
  /** package.json version, for WebApplication.softwareVersion. */
  version: string;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const otherLangs = (lang: Lang): Lang[] => LANGS.filter((l) => l !== lang);

const personNode = (): Json => ({
  '@type': 'Person',
  '@id': PERSON.id,
  name: PERSON.name,
  url: PERSON.url,
  sameAs: [...PERSON.sameAs],
});

const personRef = (): Json => ({
  '@type': 'Person',
  '@id': PERSON.id,
  name: PERSON.name,
  url: PERSON.url,
});

const websiteNode = (): Json => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE_ORIGIN}/`,
  name: SITE_NAME.ko,
  alternateName: [...SITE_ALTERNATE_NAMES],
  inLanguage: [...LANGS],
  publisher: { '@id': PERSON.id },
});

/** The page's visible FAQ as FAQPage, or nothing when it has none. */
function faqNode(input: HeadInput, url: string): Json[] {
  if (input.facts.faq.length === 0) return [];
  return [
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      url,
      inLanguage: input.lang,
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: input.facts.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];
}

function appNode(input: HeadInput, url: string): Json {
  const d = DICTIONARIES[input.lang];
  return {
    '@type': 'WebApplication',
    '@id': appId(input.lang),
    name: d['app.title'],
    alternateName: otherLangs(input.lang).map((l) => DICTIONARIES[l]['app.title']),
    url,
    description: input.facts.description,
    inLanguage: input.lang,
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Simulation',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and Web Workers',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: input.lang === 'ko' ? 'KRW' : 'USD' },
    softwareVersion: input.version,
    license: canonicalUrl('license', input.lang),
    image: OG_IMAGE[input.lang].url,
    about: TOPICS.map((t) => ({ '@type': 'Thing', name: t.name, sameAs: [...t.sameAs] })),
    author: { '@id': PERSON.id },
    publisher: { '@id': PERSON.id },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

function articleNode(input: HeadInput, page: Exclude<PageId, 'simulator'>, url: string): Json {
  const node: { [key: string]: Json } = {
    '@type': PAGE_TYPE[page],
    '@id': `${url}#main`,
    url,
    mainEntityOfPage: url,
    headline: input.facts.h1 ?? input.facts.title,
    name: input.facts.title,
    description: input.facts.description,
    inLanguage: input.lang,
    image: OG_IMAGE[input.lang].url,
    author: personRef(),
    publisher: { '@id': PERSON.id },
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': appId(input.lang) },
  };
  if (input.dateModified) node['dateModified'] = input.dateModified;
  return node;
}

function breadcrumbNode(input: HeadInput, page: Exclude<PageId, 'simulator'>, url: string): Json {
  const d = DICTIONARIES[input.lang];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: d['app.shortTitle'],
        item: canonicalUrl('simulator', input.lang),
      },
      { '@type': 'ListItem', position: 2, name: d[NAV_LABEL_KEYS[page]], item: url },
    ],
  };
}

/** The page's JSON-LD graph (docs/SEO.md#structured-data). */
export function structuredData(input: HeadInput): { '@context': string; '@graph': Json[] } {
  const url = canonicalUrl(input.page, input.lang);
  const graph: Json[] = [websiteNode(), personNode()];
  if (input.page === 'simulator') {
    graph.push(appNode(input, url));
  } else {
    graph.push(articleNode(input, input.page, url), breadcrumbNode(input, input.page, url));
  }
  graph.push(...faqNode(input, url));
  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * JSON for an inline `<script type="application/ld+json">` data block: `<`, `>` and `&` are
 * written as \u escapes so the text can never close the element or look like markup.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

const meta = (attr: 'name' | 'property', key: string, content: string | number): string =>
  `<meta ${attr}="${key}" content="${escapeHtml(String(content))}" />`;

/**
 * The generated head tags of an indexable page, one per line: canonical, hreflang alternates,
 * Open Graph, Twitter card, webmaster verification (home page only) and the JSON-LD block.
 */
export function headTags(input: HeadInput): string[] {
  const { page, lang, facts } = input;
  const url = canonicalUrl(page, lang);
  const image = OG_IMAGE[lang];
  const lines = [
    `<link rel="canonical" href="${url}" />`,
    ...alternates(page).map(
      (a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`,
    ),
    meta('property', 'og:type', page === 'simulator' ? 'website' : 'article'),
    meta('property', 'og:site_name', SITE_NAME[lang]),
    meta('property', 'og:locale', OG_LOCALE[lang]),
    ...otherLangs(lang).map((l) => meta('property', 'og:locale:alternate', OG_LOCALE[l])),
    meta('property', 'og:url', url),
    meta('property', 'og:title', facts.title),
    meta('property', 'og:description', facts.description),
    meta('property', 'og:image', image.url),
    meta('property', 'og:image:type', image.type),
    meta('property', 'og:image:width', image.width),
    meta('property', 'og:image:height', image.height),
    meta('property', 'og:image:alt', image.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', facts.title),
    meta('name', 'twitter:description', facts.description),
    meta('name', 'twitter:image', image.url),
    meta('name', 'twitter:image:alt', image.alt),
  ];
  if (pagePath(page, lang) === '/') {
    for (const [name, value] of Object.entries(SITE_VERIFICATION)) {
      if (value) lines.push(meta('name', name, value));
    }
  }
  lines.push(`<script type="application/ld+json">${jsonForScript(structuredData(input))}</script>`);
  return lines;
}

/** Marker after which the generated tags go: the end of the page's `<title>`. */
const TITLE_END = /<\/title>/i;

/** The page HTML with its generated head tags inserted after `</title>`. */
export function injectHead(html: string, input: HeadInput): string {
  const m = TITLE_END.exec(html);
  if (!m) throw new Error(`${pagePath(input.page, input.lang)}: no </title>`);
  const at = m.index + m[0].length;
  const block = headTags(input)
    .map((l) => `\n    ${l}`)
    .join('');
  return html.slice(0, at) + block + html.slice(at);
}
