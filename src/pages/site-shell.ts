import type { Dictionary } from '../i18n/ko.ts';
import type { Lang } from '../i18n/lang.ts';
import { NAV_GROUPS, NAV_LABEL_KEYS, pagePath, type NavGroup, type PageId } from './routes.ts';

/*
 * The parts of the site header that also run in the browser (the app's logo and site nav). Kept
 * apart from src/pages/site-header.ts, which renders the static header at build time with both
 * dictionaries, so the app bundle carries only its own language (#79).
 */

/**
 * The header logo of every page: the original icon the owner chose (docs/BRANDING.md#assets).
 * The app header shows it at 40 px, the content-page header at 32 px; `alt` is empty because the
 * brand text or the app title sits next to it.
 */
export const SITE_LOGO = {
  src: '/header-logo.svg',
  alt: '',
  size: { app: 40, page: 32 },
} as const;

/** `<img>` attributes of the logo in the app header or the content-page header. */
export function logoAttrs(where: keyof typeof SITE_LOGO.size): Record<string, string> {
  const size = String(SITE_LOGO.size[where]);
  return { src: SITE_LOGO.src, alt: SITE_LOGO.alt, width: size, height: size };
}

export interface SiteNavItem {
  page: PageId;
  href: string;
  label: string;
  current: boolean;
  /** The nav group the link belongs to (`NAV_GROUPS`). */
  group: NavGroup['id'];
  /** The group's landing page (its head link); false for the group's children. */
  head: boolean;
}

/**
 * Links of the shared site navigation in `lang` with labels from `words` (that language's
 * dictionary), `current` marked (null: none, e.g. a 404), in header order: each group's head,
 * then its children.
 */
export function navItems(
  lang: Lang,
  current: PageId | null,
  words: Pick<Dictionary, (typeof NAV_LABEL_KEYS)[PageId]>,
): SiteNavItem[] {
  return NAV_GROUPS.flatMap((g) =>
    g.pages.map((page, i) => ({
      page,
      href: pagePath(page, lang),
      label: words[NAV_LABEL_KEYS[page]],
      current: page === current,
      group: g.id,
      head: i === 0,
    })),
  );
}

/** The nav items split into their groups, in header order: `[head, children]` per group. */
export function navGroupsOf(items: readonly SiteNavItem[]): [SiteNavItem, SiteNavItem[]][] {
  const out: [SiteNavItem, SiteNavItem[]][] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (item.head || !last) out.push([item, []]);
    else last[1].push(item);
  }
  return out;
}
