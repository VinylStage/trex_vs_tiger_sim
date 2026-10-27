/**
 * DOM-free logic behind the version badge: parsing `version.json`, deciding whether the deployed
 * build is newer than the running one, when to re-check, and which cookies the reset expires.
 * See docs/VERSIONING.md.
 */

export interface BuildInfo {
  version: string;
  /** Full commit SHA, or `dev` when unknown. */
  sha: string;
  /** ISO 8601 build time; empty when unknown. */
  builtAt: string;
}

export const UNKNOWN_SHA = 'dev';
export const VERSION_JSON_PATH = '/version.json';
export const RESET_PATH = '/reset/';
export const RELOAD_PARAM = '_r';
export { RELEASES_URL } from '../pages/routes';
/** Background re-checks (tab shown again, timer) are at least this far apart. */
export const MIN_CHECK_GAP_MS = 10 * 60 * 1000;
/** Timer period for re-checks while the tab is visible. */
export const POLL_INTERVAL_MS = 30 * 60 * 1000;

const MAX_FIELD_LENGTH = 64;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const SEMVER_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: readonly string[];
}

export function parseSemver(v: string): SemVer | null {
  const m = SEMVER_RE.exec(v.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

function compareIdentifiers(a: string, b: string): number {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Math.sign(Number(a) - Number(b));
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** SemVer 2.0.0 precedence: negative if `a < b`, 0 if equal, positive if `a > b`. */
export function compareSemver(a: SemVer, b: SemVer): number {
  const core =
    Math.sign(a.major - b.major) || Math.sign(a.minor - b.minor) || Math.sign(a.patch - b.patch);
  if (core !== 0) return core;
  const ap = a.prerelease;
  const bp = b.prerelease;
  if (ap.length === 0 || bp.length === 0) return Math.sign(bp.length - ap.length);
  for (let i = 0; i < Math.min(ap.length, bp.length); i++) {
    const c = compareIdentifiers(ap[i] ?? '', bp[i] ?? '');
    if (c !== 0) return c;
  }
  return Math.sign(ap.length - bp.length);
}

const isShortString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_FIELD_LENGTH;

/** Validate untrusted `version.json` content; null when it is not a usable build description. */
export function parseBuildInfo(data: unknown): BuildInfo | null {
  if (typeof data !== 'object' || data === null) return null;
  const { version, sha, builtAt } = data as Record<string, unknown>;
  if (!isShortString(version) || !parseSemver(version)) return null;
  if (!isShortString(sha) || (sha !== UNKNOWN_SHA && !SHA_RE.test(sha))) return null;
  const time = isShortString(builtAt) && !Number.isNaN(Date.parse(builtAt)) ? builtAt : '';
  return { version: version.replace(/^v/, ''), sha: sha.toLowerCase(), builtAt: time };
}

export function shortSha(sha: string): string {
  return sha === UNKNOWN_SHA ? sha : sha.slice(0, 7);
}

/** True when the SHAs name the same commit, or when either one is unknown. */
export function sameCommit(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === UNKNOWN_SHA || y === UNKNOWN_SHA || x === '' || y === '') return true;
  const n = Math.min(x.length, y.length);
  return x.slice(0, n) === y.slice(0, n);
}

/**
 * Why the deployed build differs from the running one:
 * - `newer`: higher version (a release-please release was deployed),
 * - `rebuild`: same version, different commit (a change merged since the last release),
 * - `changed`: lower or unparseable version (for example a dashboard rollback).
 */
export type UpdateReason = 'newer' | 'rebuild' | 'changed';

export function compareBuilds(current: BuildInfo, deployed: BuildInfo): UpdateReason | null {
  const cv = parseSemver(current.version);
  const dv = parseSemver(deployed.version);
  if (cv && dv) {
    const c = compareSemver(dv, cv);
    if (c > 0) return 'newer';
    if (c < 0) return 'changed';
  } else if (current.version !== deployed.version) {
    return 'changed';
  }
  return sameCommit(current.sha, deployed.sha) ? null : 'rebuild';
}

export type VersionStatus =
  | { kind: 'checking' }
  | { kind: 'error' }
  | { kind: 'latest'; deployed: BuildInfo; checkedAt: number }
  | { kind: 'update'; deployed: BuildInfo; reason: UpdateReason; checkedAt: number };

export type VersionEvent =
  { type: 'start' } | { type: 'success'; deployed: BuildInfo; at: number } | { type: 'failure' };

/**
 * Status reducer. A background re-check keeps showing the last known result instead of flickering
 * back to "checking", and a failed re-check keeps it too: only a page that never reached
 * `version.json` reports an error.
 */
export function reduceStatus(
  state: VersionStatus,
  event: VersionEvent,
  current: BuildInfo,
): VersionStatus {
  const known = state.kind === 'latest' || state.kind === 'update';
  switch (event.type) {
    case 'start':
      return known ? state : { kind: 'checking' };
    case 'failure':
      return known ? state : { kind: 'error' };
    case 'success': {
      const reason = compareBuilds(current, event.deployed);
      return reason
        ? { kind: 'update', deployed: event.deployed, reason, checkedAt: event.at }
        : { kind: 'latest', deployed: event.deployed, checkedAt: event.at };
    }
  }
}

export type CheckTrigger = 'load' | 'visible' | 'interval' | 'manual';

/** Throttle: the first check and explicit ones always run; background ones wait `minGapMs`. */
export function shouldCheck(
  trigger: CheckTrigger,
  now: number,
  lastAttemptAt: number | null,
  inFlight: boolean,
  minGapMs: number = MIN_CHECK_GAP_MS,
): boolean {
  if (inFlight) return false;
  if (trigger === 'load' || trigger === 'manual' || lastAttemptAt === null) return true;
  return now - lastAttemptAt >= minGapMs;
}

export function deploymentKey(b: BuildInfo): string {
  return `${b.version}+${b.sha}`;
}

/** The update banner shows once per deployment until the visitor dismisses it. */
export function shouldShowBanner(status: VersionStatus, dismissedKey: string | null): boolean {
  return status.kind === 'update' && deploymentKey(status.deployed) !== dismissedKey;
}

/** Which of the badge's fixed set of short labels a status shows. */
export type StatusLabel = 'checking' | 'latest' | 'error' | UpdateReason;

export const STATUS_LABELS: readonly StatusLabel[] = [
  'checking',
  'latest',
  'newer',
  'rebuild',
  'changed',
  'error',
];

export function statusLabel(status: VersionStatus): StatusLabel {
  return status.kind === 'update' ? status.reason : status.kind;
}

/**
 * Detail that the badge only gives to assistive technology: the deployed version when it differs.
 * The visible label stays from a fixed set so the badge never changes width.
 */
export function statusDetail(status: VersionStatus): string {
  if (status.kind !== 'update') return '';
  return status.reason === 'rebuild'
    ? ` (${shortSha(status.deployed.sha)})`
    : ` v${status.deployed.version}`;
}

/** Vertical extent of an element in viewport coordinates (a DOMRect fits). */
export interface VerticalBox {
  top: number;
  bottom: number;
}

/**
 * How far a banner docked to the bottom of the viewport has to rise to sit above a bar that is
 * stuck to the bottom edge (the config panel's sticky run bar): 0 when the bar is elsewhere.
 */
export function stuckBarLift(bar: VerticalBox | null, viewportHeight: number): number {
  if (!bar || bar.bottom <= bar.top) return 0;
  const stuck = bar.top < viewportHeight && bar.bottom >= viewportHeight - 1;
  return stuck ? Math.ceil(viewportHeight - bar.top) : 0;
}

/**
 * Space to keep clear at the bottom of the viewport while a bottom-docked banner is shown: from the
 * banner's top edge down, plus a gap. Used as `scroll-padding-bottom`, so focused elements scroll
 * clear of the banner.
 */
export function bottomInset(bannerTop: number, viewportHeight: number, gap: number): number {
  return Math.max(0, Math.ceil(viewportHeight - bannerTop + gap));
}

/** Cookie names visible in `document.cookie` (`a=1; b=2`), deduplicated, nameless ones skipped. */
export function parseCookieNames(cookie: string): string[] {
  const names = new Set<string>();
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (name) names.add(name);
  }
  return [...names];
}

const EXPIRED = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/';

/**
 * `document.cookie` assignments that expire each named cookie on this host: once as a host-only
 * cookie and once with `Domain=<host>`. Parent-domain cookies are deliberately left alone.
 */
export function expiringCookies(names: readonly string[], host: string, secure: boolean): string[] {
  const flags = secure ? '; Secure' : '';
  return names.flatMap((name) => [
    `${name}=; ${EXPIRED}${flags}`,
    `${name}=; ${EXPIRED}; Domain=${host}${flags}`,
  ]);
}

/** Only keep a URL fragment (`#…`) so the scenario survives the reset round-trip. */
const fragment = (hash: string): string => (hash.startsWith('#') ? hash : '');

/** Query parameter of `/reset/` that names the app page to return to (`/play/` or `/en/play/`). */
export const RETURN_PARAM = 'to';

/**
 * The paths a reset may name, and the play page each returns to. `/` and `/en/` come from a tab
 * of a build before the lobby (#142): they return to the play page of that language, so the app
 * opens (and drops `?_r=`) instead of the lobby.
 */
const RETURN_PATHS: Readonly<Record<string, string>> = {
  '/play/': '/play/',
  '/en/play/': '/en/play/',
  '/': '/play/',
  '/en/': '/en/play/',
};

/**
 * The app path to come back to after the reset: the play page {@link RETURN_PATHS} maps the
 * named path to, `/play/` for anything else (no `to`). Only these values are accepted, so the
 * reset page never redirects off-site.
 */
export function appReturnPath(path: string | null): string {
  return (path !== null && Object.hasOwn(RETURN_PATHS, path) && RETURN_PATHS[path]) || '/play/';
}

export function resetUrl(fromVersion: string, hash: string, appPath = '/play/'): string {
  const back = appReturnPath(appPath);
  const to = back === '/play/' ? '' : `&${RETURN_PARAM}=${encodeURIComponent(back)}`;
  return `${RESET_PATH}?from=${encodeURIComponent(fromVersion)}${to}${fragment(hash)}`;
}

/**
 * Where the reset page sends the visitor: a never-cached URL of the app in the language it came
 * from (`returnPath`, see `appReturnPath`), fragment preserved.
 */
export function reloadUrl(now: number, hash: string, returnPath: string | null = null): string {
  return `${appReturnPath(returnPath)}?${RELOAD_PARAM}=${now}${fragment(hash)}`;
}

/** The validated return path named by the `/reset/` query string. */
export function returnPathFromSearch(search: string): string {
  return appReturnPath(new URLSearchParams(search).get(RETURN_PARAM));
}

/** `search` without the reload marker, or null when the marker is absent. */
export function stripReloadParam(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has(RELOAD_PARAM)) return null;
  params.delete(RELOAD_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
