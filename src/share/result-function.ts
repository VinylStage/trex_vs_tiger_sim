import { buildMeta } from './result-text.ts';

/*
 * The thin runtime glue of the result-preview Pages Function (functions/r/[[path]].ts,
 * functions/en/r/[[path]].ts; ADR-0006). It takes the static result page from `context.next()`
 * and, when `?r=` validates, rewrites four meta tags with `HTMLRewriter`. Everything that decides
 * what to write is the pure `buildMeta` (src/share/result-text.ts), unit-tested in Node.
 * No storage, no logging, no outgoing requests. Typed locally so the repository needs no
 * @cloudflare/workers-types.
 */

interface RewriterElement {
  setAttribute(name: string, value: string): void;
}

interface Rewriter {
  on(selector: string, handlers: { element(el: RewriterElement): void }): Rewriter;
  transform(response: Response): Response;
}

type RewriterCtor = new () => Rewriter;

/** The subset of a Pages Function's EventContext used here. */
export interface ResultContext {
  request: Request;
  next(): Promise<Response>;
}

/**
 * Headers `_headers` gives `/r/*` and `/en/r/*`. Cloudflare does not promise to apply `_headers`
 * to responses that pass through a Function, so the Function sets them itself;
 * tests/result-share.test.ts checks that this list equals what `public/_headers` sends there.
 */
export const RESULT_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), xr-spatial-tracking=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-cache, no-transform',
  'X-Robots-Tag': 'noindex',
};

/** Meta tags rewritten with the result text; og:image stays the static card. */
export const REWRITTEN_META: readonly { selector: string; field: 'title' | 'description' }[] = [
  { selector: 'meta[property="og:title"]', field: 'title' },
  { selector: 'meta[property="og:description"]', field: 'description' },
  { selector: 'meta[name="twitter:title"]', field: 'title' },
  { selector: 'meta[name="twitter:description"]', field: 'description' },
];

/** Language of a result path: `/en/r/…` is English, everything else Korean. */
export const resultPathLang = (pathname: string): 'ko' | 'en' =>
  pathname.startsWith('/en/') ? 'en' : 'ko';

export async function onResultRequest(context: ResultContext): Promise<Response> {
  const res = await context.next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(RESULT_HEADERS)) out.headers.set(k, v);
  const type = res.headers.get('content-type') ?? '';
  if (res.status !== 200 || !type.includes('text/html')) return out;
  const url = new URL(context.request.url);
  const meta = buildMeta(url.search, resultPathLang(url.pathname));
  const Ctor = (globalThis as { HTMLRewriter?: RewriterCtor }).HTMLRewriter;
  if (!meta || !Ctor) return out;
  let rw = new Ctor();
  for (const { selector, field } of REWRITTEN_META) {
    const value = meta[field];
    rw = rw.on(selector, { element: (el) => el.setAttribute('content', value) });
  }
  return rw.transform(out);
}
