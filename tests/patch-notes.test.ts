import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  PATCH_CATEGORIES,
  PATCH_NOTES,
  compareVersions,
  releasedNotes,
  versionAnchor,
  versionParts,
} from '../src/content/patch-notes';
import {
  PATCH_NOTES_PLACEHOLDER,
  expandPatchNotes,
  formatNoteDate,
  renderPatchNotes,
} from '../src/pages/patch-notes-page';
import { LANGS } from '../src/ui/i18n';

/*
 * The patch notes board (src/content/patch-notes.ts, docs/PAGES.md#patch-notes). Every release
 * needs an entry (CONTRIBUTING.md#release-cadence); the messages below say how to fix a failure.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const MANIFEST_VERSION = (JSON.parse(read('.release-please-manifest.json')) as { '.': string })[
  '.'
];
const PKG_VERSION = (JSON.parse(read('package.json')) as { version: string }).version;

/** `## [0.2.8](…) (2026-10-20)` and `## 0.1.0 (2026-10-19)` headings of CHANGELOG.md. */
const CHANGELOG = [
  ...read('CHANGELOG.md').matchAll(
    /^## \[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))? \((\d{4}-\d{2}-\d{2})\)/gm,
  ),
].map((m) => ({ version: m[1] ?? '', date: m[2] ?? '' }));

const HOW_TO_FIX =
  'Add an entry for this version at the top of PATCH_NOTES in src/content/patch-notes.ts ' +
  '(version, the CHANGELOG.md date, a ko/en title, 2–6 ko/en items and the PR numbers), and bump ' +
  'the "last updated" <time> in patch-notes/index.html and en/patch-notes/index.html ' +
  '(CONTRIBUTING.md#release-cadence).';

/**
 * Words the content rules forbid (CONTRIBUTING.md#content-framing-rules): death words for
 * simulation states (the same pattern as tests/pages.test.ts) plus blood, gore and slaughter words.
 */
const FORBIDDEN = [
  /(?<!가)죽[은을는지기음었이]|사망|\b(?:dead|killed|kills?|died|dies|die|death)\b/i,
  /학살|도륙|잔혹|유혈|(?<![가-힣])피(?:[가를는]|투성이)?(?![가-힣])/,
  /\b(?:blood\w*|bloody|gore|gory|massacre|slaughter\w*|kill count|corpses?|wounds?)\b/i,
];
const forbiddenIn = (s: string): string | null => {
  for (const re of FORBIDDEN) {
    const m = re.exec(s);
    if (m) return m[0];
  }
  return null;
};

const allTexts = (): { where: string; lang: 'ko' | 'en'; text: string }[] =>
  PATCH_NOTES.flatMap((n) =>
    LANGS.flatMap((lang) => [
      { where: `v${n.version} title`, lang, text: n.title[lang] },
      ...n.items.map((i, k) => ({ where: `v${n.version} item ${k + 1}`, lang, text: i[lang] })),
    ]),
  );

describe('patch notes data', () => {
  it('reads the released versions from CHANGELOG.md', () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(10);
    expect(CHANGELOG[0]?.version).toBe(MANIFEST_VERSION);
    expect(PKG_VERSION).toBe(MANIFEST_VERSION);
  });

  it.each(CHANGELOG)('has an entry for released v$version, dated as in CHANGELOG.md', (rel) => {
    const note = PATCH_NOTES.find((n) => n.version === rel.version);
    expect(note, `v${rel.version} is released but has no patch notes. ${HOW_TO_FIX}`).toBeDefined();
    expect(note?.date, `v${rel.version}: use the CHANGELOG.md date ${rel.date}`).toBe(rel.date);
  });

  it('has an entry for the version in .release-please-manifest.json', () => {
    expect(
      PATCH_NOTES.some((n) => n.version === MANIFEST_VERSION),
      `v${MANIFEST_VERSION} has no patch notes. ${HOW_TO_FIX}`,
    ).toBe(true);
  });

  it('lists versions newest first, each once, with dates that never go forward', () => {
    for (let i = 1; i < PATCH_NOTES.length; i++) {
      const newer = PATCH_NOTES[i - 1];
      const older = PATCH_NOTES[i];
      if (!newer || !older) continue;
      expect(
        compareVersions(newer.version, older.version),
        `v${newer.version} must come before v${older.version} (newest first)`,
      ).toBeGreaterThan(0);
      expect(newer.date >= older.date, `v${newer.version} dated before v${older.version}`).toBe(
        true,
      );
    }
  });

  it('only writes ahead for the next release, never further', () => {
    const ahead = PATCH_NOTES.filter((n) => compareVersions(n.version, MANIFEST_VERSION) > 0);
    expect(ahead.length).toBeLessThanOrEqual(1);
    for (const n of ahead) {
      const [ma, mi, pa] = versionParts(MANIFEST_VERSION);
      expect([`${ma}.${mi}.${pa + 1}`, `${ma}.${mi + 1}.0`, `${ma + 1}.0.0`]).toContain(n.version);
    }
    // Every entry at or below the release is a real CHANGELOG.md release.
    for (const n of releasedNotes(MANIFEST_VERSION)) {
      expect(
        CHANGELOG.map((c) => c.version),
        `v${n.version} is not in CHANGELOG.md`,
      ).toContain(n.version);
    }
  });

  it.each(PATCH_NOTES.map((n) => [n.version, n] as const))('v%s is well formed', (_, n) => {
    expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.items.length, '2–6 items').toBeGreaterThanOrEqual(2);
    expect(n.items.length, '2–6 items').toBeLessThanOrEqual(6);
    expect(n.prs.length).toBeGreaterThan(0);
    for (const ref of [...n.prs, ...n.items.flatMap((i) => i.refs ?? [])]) {
      expect(Number.isInteger(ref) && ref > 0, `#${ref}`).toBe(true);
    }
    for (const i of n.items) expect(PATCH_CATEGORIES).toContain(i.cat);
  });

  it('has both languages for every title and item, each in its own script', () => {
    for (const t of allTexts()) {
      expect(t.text.trim().length, `${t.where} (${t.lang}) is empty`).toBeGreaterThan(3);
      expect(t.text, `${t.where} (${t.lang}) has markup`).not.toMatch(/[<>]/);
      if (t.lang === 'ko') expect(t.text, `${t.where} (ko)`).toMatch(/[가-힣]/);
      else expect(t.text, `${t.where} (en)`).not.toMatch(/[가-힣]/);
    }
    for (const lang of LANGS) {
      expect(Object.keys(CATEGORY_LABELS[lang]).sort()).toEqual([...PATCH_CATEGORIES].sort());
    }
  });

  it('uses no blood, death or gore words (CONTRIBUTING.md content rules)', () => {
    const hits = allTexts()
      .map((t) => ({ ...t, hit: forbiddenIn(t.text) }))
      .filter((t) => t.hit !== null)
      .map((t) => `${t.where} (${t.lang}): "${t.hit}"`);
    expect(hits).toEqual([]);
  });

  it('still recognises the words it rejects', () => {
    for (const s of ['죽은 호랑이', '사망', '피가 났다', '학살', 'a dead tiger', 'bloody', 'gore'])
      expect(forbiddenIn(s), s).not.toBeNull();
    for (const s of ['가죽은 두껍다', '피해', '피드백', '회피', 'incapacitated', 'diet', 'skills'])
      expect(forbiddenIn(s), s).toBeNull();
  });
});

describe('patch notes board', () => {
  it('shows the released entries newest first and hides an entry written ahead', () => {
    const html = renderPatchNotes('ko', '0.2.8');
    const shown = [...html.matchAll(/<section id="(v[\d-]+)"/g)].map((m) => m[1]);
    expect(shown).toEqual(releasedNotes('0.2.8').map((n) => versionAnchor(n.version)));
    expect(shown).not.toContain('v0-2-9');
    expect(shown[0]).toBe('v0-2-8');
  });

  it.each(LANGS)('(%s) tags only the newest card NEW and links every card', (lang) => {
    const html = renderPatchNotes(lang, PKG_VERSION);
    const notes = releasedNotes(PKG_VERSION);
    expect(html.match(/class="patch-new"/g)).toHaveLength(1);
    expect(html.indexOf('class="patch-new"')).toBeLessThan(
      html.indexOf(`id="${versionAnchor(notes[1]?.version ?? '')}"`),
    );
    for (const n of notes) {
      const id = versionAnchor(n.version);
      expect(html).toContain(`<a href="#${id}">v${n.version}</a>`);
      expect(html).toContain(`<time datetime="${n.date}">${formatNoteDate(n.date, lang)}</time>`);
    }
    expect(html).toContain(CATEGORY_LABELS[lang].new);
    expect(html).not.toMatch(/\sstyle=|<script|\son\w+=/i);
  });

  it('formats dates like the other pages', () => {
    expect(formatNoteDate('2026-10-20', 'ko')).toBe('2026년 10월 20일');
    expect(formatNoteDate('2026-10-19', 'en')).toBe('19 October 2026');
    expect(versionAnchor('0.2.10')).toBe('v0-2-10');
  });

  it('expands the placeholder on the patch notes page only', () => {
    const src = `<main>${PATCH_NOTES_PLACEHOLDER}</main>`;
    expect(expandPatchNotes(src, { lang: 'en', page: 'patch-notes' }, PKG_VERSION, 'x')).toContain(
      'patch-card',
    );
    expect(() => expandPatchNotes(src, { lang: 'en', page: 'about' }, PKG_VERSION, 'x')).toThrow();
    expect(expandPatchNotes('<p>x</p>', null, PKG_VERSION, 'x')).toBe('<p>x</p>');
  });

  it.each([
    ['ko', 'patch-notes/index.html'],
    ['en', 'en/patch-notes/index.html'],
  ] as const)('(%s) %s shows a "last updated" date no older than the newest release', (_, file) => {
    const source = read(file);
    expect(source.split(PATCH_NOTES_PLACEHOLDER)).toHaveLength(2);
    const updated = /<p class="page-meta">[\s\S]*?<time datetime="([^"]+)">/.exec(source)?.[1];
    const newest = releasedNotes(PKG_VERSION)[0]?.date ?? '';
    expect(
      (updated ?? '') >= newest,
      `${file}: bump the page-meta <time> to ${newest}. ${HOW_TO_FIX}`,
    ).toBe(true);
  });

  it('is linked from the version badge and the update banner', () => {
    const src = read('src/ui/version.ts');
    expect(src).toMatch(/patchNotesLink\(\s*'version\.patchNotes'/);
    expect(src).toMatch(/patchNotesLink\(\s*'version\.bannerNotes'/);
  });
});
