import { SITE_ORIGIN } from '../pages/routes.ts';

/**
 * Crawlers named explicitly in robots.txt (SEO_GEO §5.6). They are already covered by
 * `User-agent: *`; listing them in the same group documents the policy (search, AI answers and AI
 * training all allowed) and keeps them on the same rules if a bot-specific group is ever added.
 */
export const NAMED_CRAWLERS: readonly { token: string; operator: string; purpose: string }[] = [
  { token: 'Googlebot', operator: 'Google', purpose: 'search' },
  { token: 'Google-Extended', operator: 'Google', purpose: 'Gemini training and grounding' },
  { token: 'Bingbot', operator: 'Microsoft', purpose: 'search, Copilot' },
  { token: 'Yeti', operator: 'Naver', purpose: 'search' },
  { token: 'Daum', operator: 'Kakao', purpose: 'search' },
  { token: 'DuckDuckBot', operator: 'DuckDuckGo', purpose: 'search' },
  { token: 'Applebot', operator: 'Apple', purpose: 'search' },
  { token: 'Applebot-Extended', operator: 'Apple', purpose: 'training' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', purpose: 'ChatGPT search' },
  { token: 'ChatGPT-User', operator: 'OpenAI', purpose: 'user-initiated fetch' },
  { token: 'GPTBot', operator: 'OpenAI', purpose: 'training' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', purpose: 'search' },
  { token: 'Claude-User', operator: 'Anthropic', purpose: 'user-initiated fetch' },
  { token: 'ClaudeBot', operator: 'Anthropic', purpose: 'training' },
  { token: 'PerplexityBot', operator: 'Perplexity', purpose: 'search' },
  { token: 'Perplexity-User', operator: 'Perplexity', purpose: 'user-initiated fetch' },
  { token: 'Amazonbot', operator: 'Amazon', purpose: 'search, training' },
  { token: 'meta-externalagent', operator: 'Meta', purpose: 'search, training' },
  { token: 'CCBot', operator: 'Common Crawl', purpose: 'open web archive' },
];

/** Paths no crawler needs: the cache/storage reset utility (docs/VERSIONING.md). */
export const DISALLOWED_PATHS: readonly string[] = ['/reset/'];

/**
 * Daum Webmaster Tool ownership line (owner action, docs/SEO.md#owner-actions): paste the whole
 * line Daum issues, `#DaumWebMasterTool:<hash>:<pin>`. Empty means none. It is a comment, so other
 * crawlers ignore it.
 */
export const DAUM_WEBMASTER_LINE = '';

/** robots.txt: everything allowed except the utility paths, plus the absolute sitemap URL. */
export function robotsTxt(daumLine: string = DAUM_WEBMASTER_LINE): string {
  const lines = [
    `# ${SITE_ORIGIN}/robots.txt`,
    '# All content is public. Search indexing, AI answers (retrieval and grounding) and AI training',
    '# are allowed. Generated at build time by src/seo/robots.ts (docs/SEO.md).',
    'User-agent: *',
    ...NAMED_CRAWLERS.map((c) => `User-agent: ${c.token}`),
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    'Allow: /',
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ];
  if (daumLine.trim()) lines.push('', daumLine.trim());
  return `${lines.join('\n')}\n`;
}
