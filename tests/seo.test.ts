import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CONTENT_PAGES,
  SITE_ORIGIN,
  canonicalUrl,
  parsePagePath,
  type PageId,
} from '../src/pages/routes';
import { extractFaq, extractPageFacts, extractUpdated } from '../src/seo/extract';
import {
  headTags,
  injectHead,
  jsonForScript,
  structuredData,
  type HeadInput,
} from '../src/seo/head';
import { decodeEntities, textOf } from '../src/seo/html';
import { htmlToText, llmsFullTxt, llmsTxt, type LlmsPage } from '../src/seo/llms';
import { DISALLOWED_PATHS, NAMED_CRAWLERS, robotsTxt } from '../src/seo/robots';
import {
  INDEXABLE_PAGES,
  INDEXABLE_ROUTES,
  OG_IMAGE,
  PERSON,
  SITE_VERIFICATION,
  X_DEFAULT_LANG,
  pageSource,
} from '../src/seo/site';
import { pageLastmod, sitemapXml, visibleDateIsStale } from '../src/seo/sitemap';
import { DICTIONARIES, LANGS, type Lang } from '../src/ui/i18n';
import { findHtmlEntries } from '../vite.pages';
import {
  absolutizeUrls,
  gitHistory,
  gitLastmod,
  needsRootAbsoluteUrls,
  notFoundLang,
  unshallow,
} from '../vite.seo';

/*
 * Build-time SEO (docs/SEO.md). The generators are pure; these tests run them over the real page
 * sources, exactly as vite.seo.ts does during the build, and check the output against the route
 * registry, the dictionaries and each page's visible text.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const VERSION = (JSON.parse(read('package.json')) as { version: string }).version;
const DATE = '2026-10-20T09:00:00+09:00';

const ROUTES = INDEXABLE_ROUTES.map(({ page, lang }) => {
  const html = read(pageSource(page, lang));
  const input: HeadInput = {
    page,
    lang,
    facts: extractPageFacts(html),
    version: VERSION,
  };
  return { page, lang, file: pageSource(page, lang), html, input, built: injectHead(html, input) };
});

// ---------- small HTML readers (independent of src/seo/html.ts where it matters) ----------

const attrsOf = (tag: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)="([^"]*)"/g))
    out[m[1] ?? ''] = decodeEntities(m[2] ?? '');
  return out;
};
const headOf = (html: string): string => html.slice(0, html.indexOf('</head>'));
const linkTags = (html: string): Record<string, string>[] =>
  [...headOf(html).matchAll(/<link\s[^>]*>/g)].map((m) => attrsOf(m[0]));
const metas = (html: string, attr: 'name' | 'property', key: string): string[] =>
  [...headOf(html).matchAll(/<meta\s[^>]*>/g)]
    .map((m) => attrsOf(m[0]))
    .filter((a) => a[attr] === key)
    .map((a) => a['content'] ?? '');
const oneMeta = (html: string, attr: 'name' | 'property', key: string): string => {
  const all = metas(html, attr, key);
  expect(all, key).toHaveLength(1);
  return all[0] ?? '';
};
const scripts = (html: string): { attrs: Record<string, string>; body: string }[] =>
  [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => ({
    attrs: attrsOf(m[1] ?? ''),
    body: m[2] ?? '',
  }));

type Node = Record<string, unknown>;
const graphOf = (html: string): Node[] => {
  const blocks = scripts(html).filter((s) => s.attrs['type'] === 'application/ld+json');
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0]?.body ?? '') as { '@context': string; '@graph': Node[] };
  expect(data['@context']).toBe('https://schema.org');
  return data['@graph'];
};
const nodesOf = (graph: Node[], type: string): Node[] => graph.filter((n) => n['@type'] === type);
const nodeOf = (graph: Node[], type: string): Node => {
  const all = nodesOf(graph, type);
  expect(all, type).toHaveLength(1);
  return all[0] as Node;
};

// ---------- registry ----------

describe('indexable pages', () => {
  it('are the simulator and every content page, in both languages, never /reset/ or 404', () => {
    expect(INDEXABLE_PAGES).toEqual(['simulator', ...CONTENT_PAGES]);
    expect(INDEXABLE_ROUTES).toHaveLength(2 * (1 + CONTENT_PAGES.length));
  });

  it('match the build entries that are pages (findHtmlEntries minus /reset/ and 404)', () => {
    const discovered = Object.values(findHtmlEntries(ROOT))
      .map((f) => `/${relative(ROOT, f).split('\\').join('/')}`)
      .map((p) => parsePagePath(p))
      .filter((r): r is { page: PageId; lang: Lang } => r !== null);
    const key = (r: { page: PageId; lang: Lang }): string => `${r.lang}:${r.page}`;
    expect(discovered.map(key).sort()).toEqual(INDEXABLE_ROUTES.map(key).sort());
    for (const r of INDEXABLE_ROUTES) {
      expect(Object.values(findHtmlEntries(ROOT))).toContain(
        join(ROOT, pageSource(r.page, r.lang)),
      );
    }
  });

  it('use English for x-default', () => {
    expect(X_DEFAULT_LANG).toBe('en');
  });
});

// ---------- head tags on every indexable page ----------

describe.each(ROUTES)('$file generated head', ({ page, lang, html, input, built }) => {
  const url = canonicalUrl(page, lang);
  const title = input.facts.title;
  const description = input.facts.description;

  it('reads the page’s own title and description', () => {
    expect(html).toContain(`<title>${title}</title>`);
    expect(description.length).toBeGreaterThan(50);
  });

  it('has a self-referencing absolute canonical and bidirectional hreflang with x-default = en', () => {
    const links = linkTags(built);
    const canonical = links.filter((l) => l['rel'] === 'canonical');
    expect(canonical.map((l) => l['href'])).toEqual([url]);
    const alternates = links
      .filter((l) => l['rel'] === 'alternate')
      .map((l) => [l['hreflang'], l['href']]);
    expect(Object.fromEntries(alternates)).toEqual({
      ko: canonicalUrl(page, 'ko'),
      en: canonicalUrl(page, 'en'),
      'x-default': canonicalUrl(page, 'en'),
    });
    expect(alternates).toHaveLength(3);
  });

  it('has Open Graph tags that repeat the title, description and canonical', () => {
    expect(oneMeta(built, 'property', 'og:type')).toBe(
      page === 'simulator' ? 'website' : 'article',
    );
    expect(oneMeta(built, 'property', 'og:url')).toBe(url);
    expect(oneMeta(built, 'property', 'og:title')).toBe(title);
    expect(oneMeta(built, 'property', 'og:description')).toBe(description);
    expect(oneMeta(built, 'property', 'og:site_name')).toBe(DICTIONARIES[lang]['app.shortTitle']);
    expect(oneMeta(built, 'property', 'og:locale')).toBe(lang === 'ko' ? 'ko_KR' : 'en_US');
    expect(oneMeta(built, 'property', 'og:locale:alternate')).toBe(
      lang === 'ko' ? 'en_US' : 'ko_KR',
    );
  });

  it('shares the language’s 1200×630 card with alt text, also as summary_large_image', () => {
    const image = `${SITE_ORIGIN}/og-image-${lang}.png`;
    expect(oneMeta(built, 'property', 'og:image')).toBe(image);
    expect(oneMeta(built, 'property', 'og:image:width')).toBe('1200');
    expect(oneMeta(built, 'property', 'og:image:height')).toBe('630');
    expect(oneMeta(built, 'property', 'og:image:type')).toBe('image/png');
    expect(oneMeta(built, 'property', 'og:image:alt')).toBe(OG_IMAGE[lang].alt);
    expect(oneMeta(built, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(oneMeta(built, 'name', 'twitter:title')).toBe(title);
    expect(oneMeta(built, 'name', 'twitter:description')).toBe(description);
    expect(oneMeta(built, 'name', 'twitter:image')).toBe(image);
    expect(oneMeta(built, 'name', 'twitter:image:alt')).toBe(OG_IMAGE[lang].alt);
  });

  it('keeps the static head (manifest, icons, theme colours) and its single title', () => {
    const links = linkTags(built);
    expect(links.filter((l) => l['rel'] === 'manifest').map((l) => l['href'])).toEqual([
      '/site.webmanifest',
    ]);
    expect(links.filter((l) => l['rel'] === 'apple-touch-icon')).toHaveLength(1);
    expect(metas(built, 'name', 'theme-color')).toHaveLength(2);
    expect(built.match(/<title>/g)).toHaveLength(1);
    expect(built.indexOf('<link rel="canonical"')).toBeLessThan(built.indexOf('</head>'));
  });

  it('allows only JSON-LD data blocks inline, and their JSON cannot close the element', () => {
    for (const s of scripts(built)) {
      if (s.attrs['src']) {
        expect(s.body.trim()).toBe('');
        continue;
      }
      expect(s.attrs['type']).toBe('application/ld+json');
      expect(s.body).not.toMatch(/<\/?script|<!--/i);
      expect(() => JSON.parse(s.body) as unknown).not.toThrow();
    }
  });

  it('describes the site and its author on every page', () => {
    const graph = graphOf(built);
    const site = nodeOf(graph, 'WebSite');
    expect(site).toMatchObject({
      '@id': `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: '티렉스 대 호랑이',
      alternateName: ['T-Rex vs Tiger', '티라노사우루스 vs 호랑이'],
      inLanguage: ['ko', 'en'],
    });
    const person = nodeOf(graph, 'Person');
    expect(person).toMatchObject({
      '@id': PERSON.id,
      name: 'VinylStage',
      url: 'https://github.com/VinylStage',
    });
    expect([...(person['sameAs'] as string[])].sort()).toEqual(
      ['https://link.vinylims.com', 'https://vinylims.com', 'https://github.com/VinylStage'].sort(),
    );
    for (const n of graph) expect(n['@type'], 'every node is typed').toBeTruthy();
  });

  if (page === 'simulator') {
    it('describes the simulator as a free educational web application', () => {
      const app = nodeOf(graphOf(built), 'WebApplication');
      expect(app).toMatchObject({
        '@id': `${url}#app`,
        url,
        name: DICTIONARIES[lang]['app.title'],
        description,
        inLanguage: lang,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        softwareVersion: VERSION,
        offers: { '@type': 'Offer', price: 0 },
      });
      expect(app['aggregateRating']).toBeUndefined();
      expect(app['review']).toBeUndefined();
      expect(nodesOf(graphOf(built), 'BreadcrumbList')).toHaveLength(0);
    });
  } else {
    it('has a breadcrumb and an article node with the page’s heading and modification date', () => {
      const graph = graphOf(built);
      const crumbs = nodeOf(graph, 'BreadcrumbList')['itemListElement'] as Node[];
      expect(crumbs.map((c) => [c['position'], c['name'], c['item']])).toEqual([
        [1, DICTIONARIES[lang]['app.shortTitle'], canonicalUrl('simulator', lang)],
        [2, DICTIONARIES[lang][`nav.${page}`], url],
      ]);
      // Structured data must match visible content: the page shows the same trail.
      const trail = /<nav class="eyebrow breadcrumb"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
      expect(
        [...trail.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1] ?? '')),
      ).toEqual(crumbs.map((c) => c['name']));
      const type = ['guide', 'model', 'parameters'].includes(page)
        ? 'TechArticle'
        : page === 'about'
          ? 'AboutPage'
          : 'WebPage';
      const article = nodeOf(graph, type);
      const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
      const visibleDate = /<p class="page-meta">[\s\S]*?<time datetime="([^"]+)">/.exec(html)?.[1];
      expect(visibleDate, 'a visible “last updated” date').toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article).toMatchObject({
        headline: textOf(h1),
        description,
        inLanguage: lang,
        mainEntityOfPage: url,
        dateModified: visibleDate,
        author: { '@type': 'Person', '@id': PERSON.id, name: 'VinylStage' },
      });
      expect((article['headline'] as string).length).toBeLessThanOrEqual(110);
    });
  }

  it('has FAQPage exactly where a visible FAQ exists, with the visible text', () => {
    const faqs = nodesOf(graphOf(built), 'FAQPage');
    const visible = /<section\b[^>]*\bid="faq"/.test(html);
    expect(faqs).toHaveLength(visible ? 1 : 0);
    expect(visible).toBe(page === 'simulator' || page === 'guide');
    if (!visible) return;
    const items = (faqs[0]?.['mainEntity'] as Node[]).map((q) => ({
      question: q['name'],
      answer: (q['acceptedAnswer'] as Node)['text'],
    }));
    const section = html.slice(html.search(/<section\b[^>]*\bid="faq"/));
    const body = section.slice(0, section.indexOf('</section>'));
    expect(items).toHaveLength((body.match(/<h3[\s>]/g) ?? []).length);
    for (const item of items) {
      expect(textOf(body)).toContain(`${item.question as string} ${item.answer as string}`);
    }
    if (page === 'simulator') {
      const d: Readonly<Record<string, string>> = DICTIONARIES[lang];
      items.forEach((item, i) => {
        expect(item.question).toBe(d[`faq.q${i + 1}`]);
        expect(item.answer).toBe((d[`faq.a${i + 1}`] ?? '').replace(/\s+/g, ' ').trim());
      });
    }
  });
});

describe('generated head (whole set)', () => {
  it('puts the webmaster verification codes on the Korean home page only', () => {
    const input = ROUTES[0]?.input as HeadInput;
    expect(input.page).toBe('simulator');
    expect(Object.keys(SITE_VERIFICATION).sort()).toEqual([
      'msvalidate.01',
      'naver-site-verification',
    ]);
    for (const r of ROUTES) {
      for (const name of Object.keys(SITE_VERIFICATION)) {
        expect(metas(r.built, 'name', name), `${r.file} ${name}`).toEqual(
          r.page === 'simulator' && r.lang === 'ko' && SITE_VERIFICATION[name]
            ? [SITE_VERIFICATION[name]]
            : [],
        );
      }
    }
  });

  it('takes dateModified from the visible date only, and omits it when a page shows none', () => {
    const r = ROUTES.find((x) => x.page === 'model' && x.lang === 'en');
    const input = r?.input as HeadInput;
    const article = (updated: string | null): Node =>
      structuredData({ ...input, facts: { ...input.facts, updated } })['@graph'].find(
        (n) => (n as Node)['@type'] === 'TechArticle',
      ) as Node;
    expect(article('2030-01-02')['dateModified']).toBe('2030-01-02');
    expect(article(null)['dateModified']).toBeUndefined();
  });

  it('reads the visible date from the page-meta <time> and rejects a malformed one', () => {
    expect(
      extractUpdated('<p class="page-meta">Updated <time datetime="2026-01-02">2 Jan</time></p>'),
    ).toBe('2026-01-02');
    expect(
      extractUpdated('<p>x</p><time datetime="2026-01-02">a time elsewhere</time>'),
    ).toBeNull();
    expect(
      extractUpdated('<p class="page-meta">no date</p><time datetime="2026-01-02"></time>'),
    ).toBeNull();
    expect(() =>
      extractUpdated('<p class="page-meta"><time datetime="2 Jan 2026">x</time></p>'),
    ).toThrow(/YYYY-MM-DD/);
    for (const r of ROUTES) {
      expect(r.input.facts.updated === null, r.file).toBe(r.page === 'simulator');
    }
  });

  it('publishes the visible date as lastmod and falls back to git only without one', () => {
    expect(pageLastmod('2026-10-20', '2026-10-25T01:00:00+00:00')).toBe('2026-10-20');
    expect(pageLastmod(null, '2026-10-25T01:00:00+00:00')).toBe('2026-10-25T01:00:00+00:00');
    expect(pageLastmod(null, null)).toBeNull();
  });

  it('flags a page committed after its visible date (the build warns)', () => {
    expect(visibleDateIsStale('2026-10-20', '2026-10-21T00:10:00+09:00')).toBe(true);
    expect(visibleDateIsStale('2026-10-20', '2026-10-20T23:59:00+09:00')).toBe(false);
    expect(visibleDateIsStale('2026-10-20', '2026-10-19T08:00:00+00:00')).toBe(false);
    expect(visibleDateIsStale(null, '2026-10-21T00:00:00+00:00')).toBe(false);
    expect(visibleDateIsStale('2026-10-20', null)).toBe(false);
  });

  it('escapes markup in JSON-LD and attributes', () => {
    expect(jsonForScript({ a: '</script><b>&' })).toBe(
      '{"a":"\\u003c/script\\u003e\\u003cb\\u003e\\u0026"}',
    );
    const r = ROUTES[0]?.input as HeadInput;
    const tags = headTags({ ...r, facts: { ...r.facts, title: 'A "quoted" <b> & c' } });
    expect(tags.join('\n')).toContain('content="A &quot;quoted&quot; &lt;b&gt; &amp; c"');
  });

  it('extracts FAQ items from h3/p pairs', () => {
    expect(
      extractFaq(
        '<section id="faq"><h2>FAQ</h2><h3>Q1?</h3><p>A <a href="/x">link</a>.</p><h3>Q2</h3><p>B</p><p>C</p></section>',
      ),
    ).toEqual([
      { question: 'Q1?', answer: 'A link.' },
      { question: 'Q2', answer: 'B C' },
    ]);
    expect(extractFaq('<section id="intro"><h3>x</h3></section>')).toEqual([]);
  });
});

// ---------- sitemap.xml ----------

describe('sitemap.xml', () => {
  const lastmod = (page: PageId, lang: Lang): string | null =>
    page === 'about' ? null : `2026-10-${lang === 'ko' ? '19' : '20'}T00:00:00+09:00`;
  const xml = sitemapXml(lastmod);
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const body = m[1] ?? '';
    return {
      loc: /<loc>([^<]*)<\/loc>/.exec(body)?.[1] ?? '',
      lastmod: /<lastmod>([^<]*)<\/lastmod>/.exec(body)?.[1] ?? null,
      alternates: Object.fromEntries(
        [
          ...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g),
        ].map((a) => [a[1], a[2]]),
      ),
    };
  });

  it('is a urlset with the xhtml namespace', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset ')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml).not.toMatch(/<priority>|<changefreq>/);
  });

  it('lists exactly the registry’s URLs, each once', () => {
    expect(urls.map((u) => u.loc).sort()).toEqual(
      INDEXABLE_ROUTES.map((r) => canonicalUrl(r.page, r.lang)).sort(),
    );
    expect(new Set(urls.map((u) => u.loc)).size).toBe(urls.length);
    for (const u of urls) expect(u.loc).not.toMatch(/reset|404/);
  });

  it('gives every URL its ko, en and x-default (English) alternates', () => {
    for (const r of INDEXABLE_ROUTES) {
      const entry = urls.find((u) => u.loc === canonicalUrl(r.page, r.lang));
      expect(entry?.alternates).toEqual({
        ko: canonicalUrl(r.page, 'ko'),
        en: canonicalUrl(r.page, 'en'),
        'x-default': canonicalUrl(r.page, 'en'),
      });
    }
  });

  it('writes lastmod where known and omits it otherwise', () => {
    for (const r of INDEXABLE_ROUTES) {
      const entry = urls.find((u) => u.loc === canonicalUrl(r.page, r.lang));
      expect(entry?.lastmod ?? null).toBe(lastmod(r.page, r.lang));
    }
    expect(sitemapXml(() => null)).not.toContain('<lastmod>');
  });

  it('gives every content page its visible date as lastmod, the same as its dateModified', () => {
    const facts = (page: PageId, lang: Lang): HeadInput['facts'] =>
      (ROUTES.find((r) => r.page === page && r.lang === lang) as (typeof ROUTES)[number]).input
        .facts;
    const built = sitemapXml((page, lang) => pageLastmod(facts(page, lang).updated, null));
    for (const r of ROUTES.filter((x) => x.page !== 'simulator')) {
      const graph = graphOf(r.built);
      const modified = graph.find((n) => typeof n['dateModified'] === 'string')?.['dateModified'];
      expect(modified, r.file).toBe(r.input.facts.updated);
      expect(built, r.file).toContain(
        `<loc>${canonicalUrl(r.page, r.lang)}</loc>\n    <lastmod>${modified as string}</lastmod>`,
      );
    }
  });
});

// ---------- robots.txt ----------

describe('robots.txt', () => {
  const txt = robotsTxt('');
  const lines = txt.split('\n');

  it('allows everything in one group that names the search and AI crawlers', () => {
    expect(lines).toContain('User-agent: *');
    for (const token of [
      'Googlebot',
      'Google-Extended',
      'Bingbot',
      'Yeti',
      'Daum',
      'Applebot-Extended',
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'ClaudeBot',
      'Claude-User',
      'Claude-SearchBot',
      'PerplexityBot',
    ]) {
      expect(lines, token).toContain(`User-agent: ${token}`);
    }
    expect(NAMED_CRAWLERS.length).toBe(new Set(NAMED_CRAWLERS.map((c) => c.token)).size);
    // one group: every User-agent line comes before the first rule
    const firstRule = lines.findIndex((l) => /^(Allow|Disallow|Content-Signal):/.test(l));
    const lastAgent = lines.map((l) => l.startsWith('User-agent:')).lastIndexOf(true);
    expect(lastAgent).toBeLessThan(firstRule);
    expect(lines).toContain('Allow: /');
    expect(lines).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=yes');
  });

  it('disallows only /reset/ and points at the absolute sitemap', () => {
    expect(DISALLOWED_PATHS).toEqual(['/reset/']);
    expect(lines.filter((l) => l.startsWith('Disallow:'))).toEqual(['Disallow: /reset/']);
    expect(lines).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
    expect(txt.endsWith('\n')).toBe(true);
  });

  it('appends the Daum ownership comment when one is set', () => {
    expect(robotsTxt('#DaumWebMasterTool:abc:def')).toMatch(/\n#DaumWebMasterTool:abc:def\n$/);
    expect(txt).not.toContain('DaumWebMasterTool');
  });
});

// ---------- llms.txt and llms-full.txt ----------

describe('llms.txt and llms-full.txt', () => {
  const pages: LlmsPage[] = ROUTES.map((r) => ({
    page: r.page,
    lang: r.lang,
    html: r.html,
    facts: r.input.facts,
    lastmod: DATE,
  }));
  const llms = llmsTxt(pages);
  const full = llmsFullTxt(pages);

  it('follows the llmstxt.org layout: H1, blockquote, notes, H2 file lists', () => {
    const lines = llms.split('\n');
    expect(lines[0]).toBe('# 티렉스 대 호랑이 (T-Rex vs Tiger)');
    expect(lines[2]?.startsWith('> ')).toBe(true);
    expect(lines.filter((l) => l.startsWith('# '))).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith('## '))).toHaveLength(LANGS.length);
  });

  it('links every indexable URL with its own description', () => {
    for (const r of ROUTES) {
      const label = DICTIONARIES[r.lang][`nav.${r.page}`];
      expect(llms).toContain(
        `- [${label}](${canonicalUrl(r.page, r.lang)}): ${r.input.facts.description}`,
      );
    }
    const links = [...llms.matchAll(/\]\((https:[^)]+)\)/g)].map((m) => m[1]);
    expect(links).toHaveLength(INDEXABLE_ROUTES.length);
    expect(llms).not.toMatch(/<[a-z]/i);
  });

  it('carries the educational disclaimer in both languages', () => {
    for (const lang of LANGS) expect(llms).toContain(DICTIONARIES[lang]['footer.disclaimer']);
  });

  it('has the main text of every page, without markup', () => {
    for (const r of ROUTES) {
      expect(full).toContain(`- URL: ${canonicalUrl(r.page, r.lang)}`);
      if (r.input.facts.h1) expect(full).toContain(`# ${r.input.facts.h1}`);
    }
    expect(full).toContain(DICTIONARIES.ko['faq.q1']);
    expect(full).toContain(DICTIONARIES.en['intro.title']);
    expect(full).not.toMatch(/<\/?(p|a|div|span|section|li|code|strong|em)\b/);
    expect(full).toContain('Permission is hereby granted, free of charge');
  });

  it('keeps link targets as absolute Markdown links', () => {
    const ko = DICTIONARIES.ko;
    expect(full).toContain(`- [${ko['intro.link.guide']}](${canonicalUrl('guide', 'ko')})`);
    expect(full).toContain(`[${ko['intro.link.model']}](${canonicalUrl('model', 'ko')}#results)`);
    expect(full).toContain(`[${ko['intro.link.tour']}](${SITE_ORIGIN}/?tour=1)`);
    const links = [...full.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? '');
    expect(links.length).toBeGreaterThan(50);
    for (const href of links) expect(href).toMatch(/^https:\/\//);
    expect(
      htmlToText(
        '<p>See <a href="../model/#a">the <em>model</em></a>, <a href="#x">x [1]</a> and <a href="https://e.org/a_(b)">e</a>.</p>',
        'https://s.test/en/guide/',
      ),
    ).toBe(
      'See [the model](https://s.test/en/model/#a), [x \\[1\\]](https://s.test/en/guide/#x) and [e](https://e.org/a_%28b%29).',
    );
  });

  it('converts headings, lists, tables and pre blocks', () => {
    const text = htmlToText(
      '<nav><a>skip</a></nav><h2>Title &amp; more</h2><p>One\n   two <a href="#">three</a>.</p><ul><li>a</li><li>b</li></ul>' +
        '<table><caption>Cap</caption><tr><th>h1</th><th>h2</th></tr><tr><td>x|y</td><td>z</td></tr></table>' +
        '<pre>\nline 1\n  line 2\n</pre>',
    );
    expect(text).toBe(
      [
        '## Title & more',
        '',
        'One two three.',
        '',
        '- a',
        '- b',
        '',
        'Cap:',
        '',
        '| h1 | h2 |',
        '| --- | --- |',
        '| x\\|y | z |',
        '',
        '```',
        'line 1',
        '  line 2',
        '```',
      ].join('\n'),
    );
  });
});

// ---------- 404 pages and git dates (vite.seo.ts) ----------

describe('404 pages', () => {
  it('are recognised by path', () => {
    expect(notFoundLang('404.html')).toBe('ko');
    expect(notFoundLang('en/404.html')).toBe('en');
    expect(notFoundLang('/en/404.html')).toBe('en');
    expect(notFoundLang('guide/404.html')).toBeNull();
    expect(notFoundLang('index.html')).toBeNull();
  });

  it('get root-absolute asset URLs, since they are served at any depth', () => {
    const html =
      '<link rel="icon" href="./favicon.svg" /><script src="./assets/a.js"></script>' +
      '<a href="/en/">x</a><a href="#main">y</a><link href="https://x.test/a">';
    expect(absolutizeUrls(html, '404.html')).toBe(
      '<link rel="icon" href="/favicon.svg" /><script src="/assets/a.js"></script>' +
        '<a href="/en/">x</a><a href="#main">y</a><link href="https://x.test/a">',
    );
    expect(
      absolutizeUrls('<img src="../favicon.svg"><script src="../assets/b.js">', 'en/404.html'),
    ).toBe('<img src="/favicon.svg"><script src="/assets/b.js">');
  });
});

describe('root-absolute URLs on every built page', () => {
  it('covers the app entries, the /r/ pages, content pages and the 404 pages', () => {
    for (const f of [
      'index.html',
      'en/index.html',
      'r/index.html',
      'en/r/index.html',
      'guide/index.html',
      '404.html',
    ]) {
      expect(needsRootAbsoluteUrls(f), f).toBe(true);
    }
    expect(needsRootAbsoluteUrls('sitemap.xml')).toBe(false);
    expect(needsRootAbsoluteUrls('assets/main-abc.js')).toBe(false);
  });

  it('keeps the icon on the root after the app switches from / to /en/ in place', () => {
    const head =
      '<link rel="icon" href="./favicon.svg"><link rel="manifest" href="./site.webmanifest">';
    const out = absolutizeUrls(head, 'index.html');
    expect(out).toBe(
      '<link rel="icon" href="/favicon.svg"><link rel="manifest" href="/site.webmanifest">',
    );
    // Resolved against the address after pushState to /en/, the icon is still the root file.
    const href = /href="([^"]+)"/.exec(out)?.[1] ?? '';
    expect(new URL(href, 'https://site.invalid/en/').pathname).toBe('/favicon.svg');
  });
});

describe('lastmod from git', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'seo-git-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const repo = join(tmp, 'repo');
  const run = (cwd: string, args: string[], date?: string): string =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@example.invalid',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@example.invalid',
        ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
      },
    });

  it('dates each file by its last commit, and says nothing for dirty, untracked or shallow-boundary files', () => {
    execFileSync('git', ['init', '-q', repo]);
    writeFileSync(join(repo, 'a.html'), 'a');
    writeFileSync(join(repo, 'b.html'), 'b');
    run(repo, ['add', '.']);
    run(repo, ['commit', '-q', '-m', 'one'], '2026-01-02T03:04:05+09:00');
    writeFileSync(join(repo, 'b.html'), 'b2');
    run(repo, ['commit', '-q', '-am', 'two'], '2026-02-03T04:05:06+09:00');

    const h = gitHistory(repo);
    expect(h).toMatchObject({ available: true, shallow: false });
    expect(gitLastmod(repo, h, 'a.html')).toBe('2026-01-02T03:04:05+09:00');
    expect(gitLastmod(repo, h, 'b.html')).toBe('2026-02-03T04:05:06+09:00');
    expect(gitLastmod(repo, h, 'missing.html')).toBeNull();
    writeFileSync(join(repo, 'a.html'), 'changed');
    expect(gitLastmod(repo, h, 'a.html')).toBeNull();

    const shallow = join(tmp, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, shallow]);
    const hs = gitHistory(shallow);
    expect(hs.shallow).toBe(true);
    expect(hs.boundary.size).toBe(1);
    // a.html last changed before the boundary: its real date is not in the clone
    expect(gitLastmod(shallow, hs, 'a.html')).toBeNull();
    expect(gitLastmod(shallow, hs, 'b.html')).toBeNull();

    // what the build does on Cloudflare Pages: fetch the rest of the history, then date the files
    expect(unshallow(shallow)).toBe(true);
    const full = gitHistory(shallow);
    expect(full.shallow).toBe(false);
    expect(gitLastmod(shallow, full, 'a.html')).toBe('2026-01-02T03:04:05+09:00');
    expect(gitLastmod(shallow, full, 'b.html')).toBe('2026-02-03T04:05:06+09:00');

    const outside = join(tmp, 'plain');
    execFileSync('mkdir', ['-p', outside]);
    expect(gitHistory(outside).available).toBe(false);
    expect(gitLastmod(outside, gitHistory(outside), 'a.html')).toBeNull();
  });
});

// ---------- IndexNow ----------

describe('IndexNow', () => {
  const keys = readdirSync(join(ROOT, 'public')).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  const workflow = read('.github/workflows/indexnow.yml');

  it('hosts exactly one key file whose content is its name', () => {
    expect(keys).toHaveLength(1);
    const key = (keys[0] ?? '').replace('.txt', '');
    expect(read(`public/${keys[0]}`).trim()).toBe(key);
  });

  it('submits with that key from a least-privilege workflow', () => {
    const key = (keys[0] ?? '').replace('.txt', '');
    expect(workflow).toContain(`INDEXNOW_KEY: ${key}`);
    expect(workflow).toContain(`SITE: ${SITE_ORIGIN}`);
    expect(workflow).toContain(`HOST: ${new URL(SITE_ORIGIN).host}`);
    expect(workflow).toContain('INDEXNOW_ENDPOINT: https://api.indexnow.org/indexnow');
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(workflow).toMatch(/^ {2}release:\n {4}types: \[published\]$/m);
    expect(workflow).toMatch(/^ {2}workflow_dispatch:$/m);
    expect(workflow).toMatch(/^ {2}workflow_call:$/m);
    expect(workflow).toContain('/version.json');
    expect(workflow).toContain('/sitemap.xml');
    // no third-party actions at all
    expect(workflow).not.toMatch(/^\s*-?\s*uses:/m);
  });

  it('is called by release-please when a release is created (GITHUB_TOKEN events trigger no workflows)', () => {
    const rp = read('.github/workflows/release-please.yml');
    expect(rp).toContain('uses: ./.github/workflows/indexnow.yml');
    expect(rp).toContain("if: needs.release-please.outputs.release_created == 'true'");
    expect(rp).toContain('version: ${{ needs.release-please.outputs.version }}');
  });
});
