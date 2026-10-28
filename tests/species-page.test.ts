import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPECIES_GUIDE } from '../src/content/species-guide';
import { DICTIONARIES } from '../src/i18n/dictionaries';
import { LANGS, type Lang } from '../src/i18n/lang';
import { playPagePath } from '../src/pages/routes';
import { headerRouteOf } from '../src/pages/site-header';
import {
  GUIDE_SPECIES,
  SPECIES_GUIDE_PLACEHOLDER,
  classicRoles,
  expandSpeciesGuide,
  fmt,
  isWhatIf,
  presetsWith,
  speciesAnchor,
  speciesGlyph,
  tryItHref,
  tryOpponent,
  yearsAgo,
} from '../src/pages/species-page';
import { decodeEntities, textOf } from '../src/seo/html';
import { FREE_PRESETS } from '../src/sim/free/presets';
import { FREE_SPECIES, FREE_SPECIES_IDS, type FreeSpeciesId } from '../src/sim/free/species';
import {
  HEAVY_SPECIES_IDS,
  PACK_SPECIES_IDS,
  erasNeverMet,
  matchupClass,
} from '../src/sim/species';
import { routeLink } from '../src/ui/link-route';

/*
 * The species guide (docs/PAGES.md#species-guide) against the registries it is rendered from:
 * every species of the free and classic rosters is listed, every number on the page equals the
 * registry value it names, and every "Try it" link opens Simple mode with that species.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sourceOf = (lang: Lang): string =>
  lang === 'ko' ? 'species/index.html' : 'en/species/index.html';
const pageOf = (lang: Lang): string => {
  const file = sourceOf(lang);
  return expandSpeciesGuide(
    readFileSync(join(ROOT, file), 'utf8'),
    headerRouteOf(`/${file}`),
    file,
  );
};

const attrs = (tag: string): Record<string, string> =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1] ?? '', decodeEntities(m[2] ?? '')]),
  );

/** The `<section id="sp-<id>">` of a species (cards hold no nested sections). */
function card(html: string, id: FreeSpeciesId): string {
  const m = new RegExp(`<section id="${speciesAnchor(id)}"[\\s\\S]*?</section>`).exec(html);
  if (!m) throw new Error(`no section for ${id}`);
  return m[0];
}

/** Every `<data data-k value>` in a fragment: key → [value, shown text]. */
function dataValues(html: string): Map<string, [number, string]> {
  const out = new Map<string, [number, string]>();
  for (const m of html.matchAll(/<data\s([^>]*)>([\s\S]*?)<\/data>/g)) {
    const a = attrs(m[1] ?? '');
    const k = a['data-k'] ?? '';
    expect(out.has(k), `${k} appears once`).toBe(false);
    out.set(k, [Number(a['value']), textOf(m[2] ?? '')]);
  }
  return out;
}

/** `data-k` → `data-value` of the non-numeric facts. */
const flags = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/data-k="([^"]+)" data-value="([^"]*)"/g)].map((m): [string, string] => [
      m[1] ?? '',
      m[2] ?? '',
    ]),
  );

const FORBIDDEN = [
  /(?<!가)죽[은을는지기음었이]|사망|\b(?:dead|killed|kills?|died|dies|die|death)\b/i,
  /학살|도륙|잔혹|유혈|(?<![가-힣])피(?:[가를는]|투성이)?(?![가-힣])/,
  /\b(?:blood\w*|bloody|gore|gory|massacre|slaughter\w*|kill count|corpses?|wounds?)\b/i,
  /사피엔스|sapiens|현대인|modern humans?/i,
];

describe('species registries behind the guide', () => {
  it('lists the free roster, which holds every classic species', () => {
    expect(GUIDE_SPECIES).toEqual(FREE_SPECIES_IDS);
    for (const id of [...HEAVY_SPECIES_IDS, ...PACK_SPECIES_IDS]) {
      expect(GUIDE_SPECIES).toContain(id);
    }
    expect(Object.keys(SPECIES_GUIDE).sort()).toEqual([...FREE_SPECIES_IDS].sort());
  });

  it('tags as what-if exactly the species that never met any other (T. rex today)', () => {
    expect(GUIDE_SPECIES.filter(isWhatIf)).toEqual(['trex']);
    // The same answer as the classic matchup badge: every T. rex pairing is "never met".
    for (const p of PACK_SPECIES_IDS) expect(matchupClass('trex', p)).toBe('neverMet');
    for (const id of GUIDE_SPECIES.filter((x) => !isWhatIf(x))) {
      expect(
        GUIDE_SPECIES.some(
          (o) => o !== id && !erasNeverMet(FREE_SPECIES[id].era, FREE_SPECIES[o].era),
        ),
      ).toBe(true);
    }
  });

  it('formats years before present for each language', () => {
    expect(yearsAgo(68, 'ko')).toBe('6,800만');
    expect(yearsAgo(0.004, 'ko')).toBe('4,000');
    expect(yearsAgo(0.11, 'ko')).toBe('11만');
    expect(yearsAgo(68, 'en')).toBe('68 million');
    expect(yearsAgo(1.9, 'en')).toBe('1.9 million');
    expect(yearsAgo(0.4, 'en')).toBe('400,000');
  });

  it('types no numbers by hand: curated notes and page descriptions hold no digits', () => {
    for (const id of FREE_SPECIES_IDS) {
      for (const lang of LANGS)
        expect(SPECIES_GUIDE[id].note[lang], `${id} ${lang}`).not.toMatch(/\d/);
    }
    for (const lang of LANGS) {
      const src = readFileSync(join(ROOT, sourceOf(lang)), 'utf8');
      const head = /<main[\s\S]*?<!-- species-guide -->/.exec(src)?.[0] ?? '';
      const desc = /name="description"\s+content="([^"]*)"/.exec(src)?.[1] ?? '';
      const visible = textOf(head.replace(/<time[\s\S]*?<\/time>/g, ''));
      expect(desc, `${lang} description`).not.toMatch(/\d/);
      expect(visible, `${lang} lead`).not.toMatch(/\d/);
    }
  });

  it('keeps the placeholder to the species guide', () => {
    expect(() =>
      expandSpeciesGuide(SPECIES_GUIDE_PLACEHOLDER, { lang: 'ko', page: 'about' }, 'x'),
    ).toThrow();
    expect(expandSpeciesGuide('<p>x</p>', null, 'x')).toBe('<p>x</p>');
  });
});

describe.each(LANGS)('species guide (%s)', (lang) => {
  const html = pageOf(lang);
  const d = DICTIONARIES[lang];

  it('is fully rendered: no placeholder left', () => {
    expect(html).not.toContain(SPECIES_GUIDE_PLACEHOLDER);
  });

  it('has one section and one overview row per species, in registry order', () => {
    const sections = [...html.matchAll(/<section id="sp-([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(sections).toEqual(GUIDE_SPECIES);
    const rows = [...html.matchAll(/<tr data-species="([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(rows).toEqual(GUIDE_SPECIES);
  });

  it.each(GUIDE_SPECIES)('shows the registry numbers of %s', (id) => {
    const s = FREE_SPECIES[id];
    const c = card(html, id);
    const v = dataValues(c);
    const mass = s.traits.mass.range;
    const radius = s.traits.bodyRadius.range;
    const expected: [string, number][] = [
      ['mass.min', mass.min],
      ['mass.mode', mass.mode],
      ['mass.max', mass.max],
      ['bodyRadius.mode', radius.mode],
    ];
    if (radius.min !== radius.max) {
      expected.push(['bodyRadius.min', radius.min], ['bodyRadius.max', radius.max]);
    }
    if (s.era !== 'extant') expected.push(['era.fromMa', s.era.fromMa], ['era.toMa', s.era.toMa]);
    expect([...v.keys()].sort()).toEqual(expected.map(([k]) => k).sort());
    for (const [k, value] of expected) {
      const [shownValue, shownText] = v.get(k) ?? [NaN, ''];
      expect(shownValue, `${id} ${k}`).toBe(value);
      expect(shownText, `${id} ${k} text`).toBe(
        k.startsWith('era.') ? yearsAgo(value, lang) : fmt(value),
      );
    }
    const f = flags(c);
    expect(f['era'] ?? null).toBe(s.era === 'extant' ? 'extant' : null);
    expect(f['social']).toBe(String(s.social));
    expect(f['canLatch']).toBe(String(s.canLatch));
    expect(f['classic']).toBe(classicRoles(id).join(' '));
    expect(c).toContain(`>${s.traits.mass.evidence ?? 'S'}</abbr>`);
  });

  it.each(GUIDE_SPECIES)('names %s, its what-if tag, glyph and presets', (id) => {
    const c = card(html, id);
    const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(c)?.[1] ?? '';
    expect(textOf(h2).startsWith(d[`species.${id}`])).toBe(true);
    expect(c.includes('sp-whatif'), `${id} what-if tag`).toBe(isWhatIf(id));
    expect(c).toContain(`<i>${SPECIES_GUIDE[id].scientific}</i>`);
    expect(c).toContain(`sp-glyph-${speciesGlyph(id)}`);
    const presets = [...c.matchAll(/data-preset="([^"]+)"/g)].map((m) => m[1]);
    expect(presets).toEqual(presetsWith(id).map((p) => p.id));
    for (const p of presetsWith(id)) {
      expect(c).toContain(p.name[lang]);
      expect(p.a.sp === id || p.b.sp === id).toBe(true);
    }
    expect(c.includes('data-i18n="matchup.thoughtExperiment"')).toBe(id === 'homoErectus');
  });

  it('lists every preset under each of its species', () => {
    for (const p of FREE_PRESETS) {
      expect(card(html, p.a.sp)).toContain(`data-preset="${p.id}"`);
      expect(card(html, p.b.sp)).toContain(`data-preset="${p.id}"`);
    }
  });

  it.each(GUIDE_SPECIES)('links %s to Simple mode with that species preselected', (id) => {
    const a = /<a class="button" href="([^"]+)" data-try="([^"]+)"/.exec(card(html, id));
    expect(a?.[2]).toBe(id);
    const href = decodeEntities(a?.[1] ?? '');
    expect(href).toBe(tryItHref(id, lang));
    const [path = '', hash = ''] = href.split('#');
    expect(path).toBe(playPagePath(lang));
    const route = routeLink(`#${hash}`, '');
    expect(route.mode).toBe('simple');
    if (route.mode !== 'simple') return;
    expect(route.config.sides.map((s) => [s.species, s.count])).toEqual([
      [id, 1],
      [tryOpponent(id), 1],
    ]);
    expect(tryOpponent(id)).not.toBe(id);
  });

  it('draws only abstract glyphs: no images, only triangles and dots', () => {
    const main = /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? '';
    expect(main).not.toMatch(/<img\b/);
    for (const svg of main.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
      const inner = svg[0].replace(/^<svg[^>]*>|<\/svg>$/g, '');
      expect(inner).toMatch(
        /^(<path d="M6 34 L20 6 L34 34 Z" \/>|<circle cx="20" cy="20" r="11" \/>)$/,
      );
      expect(svg[0]).toContain('aria-hidden="true"');
    }
  });

  it('keeps to the content framing rules', () => {
    const text = textOf(/<main[\s\S]*<\/main>/.exec(html)?.[0] ?? '');
    for (const re of FORBIDDEN) expect(re.exec(text)?.[0] ?? null).toBeNull();
  });
});
