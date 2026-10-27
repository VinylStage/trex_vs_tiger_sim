import { describe, expect, it } from 'vitest';
import {
  MIN_CHECK_GAP_MS,
  STATUS_LABELS,
  appReturnPath,
  bottomInset,
  compareBuilds,
  compareSemver,
  deploymentKey,
  expiringCookies,
  parseBuildInfo,
  parseCookieNames,
  parseSemver,
  reduceStatus,
  reloadUrl,
  resetUrl,
  returnPathFromSearch,
  sameCommit,
  shortSha,
  shouldCheck,
  shouldShowBanner,
  statusDetail,
  statusLabel,
  stripReloadParam,
  stuckBarLift,
  type BuildInfo,
  type SemVer,
  type UpdateReason,
  type VersionStatus,
} from '../src/ui/version-model';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const build = (version: string, sha = SHA_A): BuildInfo => ({ version, sha, builtAt: '' });

const semver = (v: string): SemVer => {
  const p = parseSemver(v);
  if (!p) throw new Error(`not semver: ${v}`);
  return p;
};
const cmp = (a: string, b: string): number => compareSemver(semver(a), semver(b));

describe('parseSemver / compareSemver', () => {
  it('parses release, pre-release and build metadata, with or without a leading v', () => {
    expect(parseSemver('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0, prerelease: [] });
    expect(parseSemver('v1.2.3-rc.1+abc')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['rc', '1'],
    });
  });

  it('rejects non-semver strings', () => {
    for (const v of ['', '1', '1.2', '01.2.3', '1.2.3-', 'latest', '1.2.3.4']) {
      expect(parseSemver(v), v).toBeNull();
    }
  });

  it('orders by SemVer 2.0.0 precedence', () => {
    const ordered = [
      '0.1.0',
      '0.1.1',
      '0.2.0-alpha',
      '0.2.0-alpha.1',
      '0.2.0-alpha.beta',
      '0.2.0-beta',
      '0.2.0-beta.2',
      '0.2.0-beta.11',
      '0.2.0-rc.1',
      '0.2.0',
      '0.10.0',
      '1.0.0',
    ];
    for (let i = 0; i + 1 < ordered.length; i++) {
      const [a, b] = [ordered[i] ?? '', ordered[i + 1] ?? ''];
      expect(cmp(a, b), `${a} < ${b}`).toBeLessThan(0);
      expect(cmp(b, a), `${b} > ${a}`).toBeGreaterThan(0);
    }
    expect(cmp('1.2.3', 'v1.2.3+build.5')).toBe(0);
  });
});

describe('parseBuildInfo', () => {
  it('accepts the emitted version.json shape', () => {
    expect(
      parseBuildInfo({ version: '0.1.0', sha: SHA_A, builtAt: '2026-10-19T12:00:00.000Z' }),
    ).toEqual({ version: '0.1.0', sha: SHA_A, builtAt: '2026-10-19T12:00:00.000Z' });
  });

  it('normalises a leading v and an upper-case sha, tolerates a missing build time', () => {
    expect(parseBuildInfo({ version: 'v0.2.0', sha: 'ABCDEF0' })).toEqual({
      version: '0.2.0',
      sha: 'abcdef0',
      builtAt: '',
    });
    expect(parseBuildInfo({ version: '0.2.0', sha: 'dev', builtAt: 'not a date' })?.builtAt).toBe(
      '',
    );
  });

  it('rejects anything that is not a usable build description', () => {
    const bad: unknown[] = [
      null,
      '0.1.0',
      [],
      {},
      { version: '0.1.0' },
      { version: 'latest', sha: SHA_A },
      { version: '0.1.0', sha: 'main' },
      { version: '0.1.0', sha: '<img src=x>' },
      { version: 1, sha: SHA_A },
      { version: `0.1.0-${'x'.repeat(80)}`, sha: SHA_A },
    ];
    for (const v of bad) expect(parseBuildInfo(v), JSON.stringify(v)).toBeNull();
  });
});

describe('compareBuilds', () => {
  it('reports nothing for the same build', () => {
    expect(compareBuilds(build('0.1.0'), build('0.1.0'))).toBeNull();
  });

  it('detects a higher deployed version', () => {
    expect(compareBuilds(build('0.1.0'), build('0.2.0', SHA_B))).toBe('newer');
    expect(compareBuilds(build('0.2.0-rc.1'), build('0.2.0'))).toBe('newer');
  });

  it('treats a different commit under the same version as a newer deployment', () => {
    expect(compareBuilds(build('0.1.0', SHA_A), build('0.1.0', SHA_B))).toBe('rebuild');
  });

  it('flags a lower deployed version (rollback) as changed', () => {
    expect(compareBuilds(build('0.2.0'), build('0.1.0', SHA_B))).toBe('changed');
  });

  it('ignores the sha when either side is unknown', () => {
    expect(compareBuilds(build('0.1.0', 'dev'), build('0.1.0', SHA_B))).toBeNull();
    expect(compareBuilds(build('0.1.0', SHA_A), build('0.1.0', 'dev'))).toBeNull();
    expect(compareBuilds(build('0.1.0', 'dev'), build('0.2.0', 'dev'))).toBe('newer');
  });

  it('compares a short sha against a full one by prefix', () => {
    expect(sameCommit(SHA_A, SHA_A.slice(0, 7))).toBe(true);
    expect(sameCommit(SHA_A.toUpperCase(), SHA_A)).toBe(true);
    expect(sameCommit(SHA_A, SHA_B.slice(0, 7))).toBe(false);
    expect(shortSha(SHA_A)).toBe('aaaaaaa');
    expect(shortSha('dev')).toBe('dev');
  });
});

describe('reduceStatus', () => {
  const current = build('0.1.0');
  const latest = build('0.1.0');
  const newer = build('0.2.0', SHA_B);

  it('goes checking → latest / update on success', () => {
    let s: VersionStatus = { kind: 'checking' };
    s = reduceStatus(s, { type: 'start' }, current);
    expect(s).toEqual({ kind: 'checking' });
    expect(reduceStatus(s, { type: 'success', deployed: latest, at: 5 }, current)).toEqual({
      kind: 'latest',
      deployed: latest,
      checkedAt: 5,
    });
    expect(reduceStatus(s, { type: 'success', deployed: newer, at: 6 }, current)).toEqual({
      kind: 'update',
      deployed: newer,
      reason: 'newer',
      checkedAt: 6,
    });
  });

  it('reports an error only when nothing was ever fetched', () => {
    expect(reduceStatus({ kind: 'checking' }, { type: 'failure' }, current)).toEqual({
      kind: 'error',
    });
    expect(reduceStatus({ kind: 'error' }, { type: 'start' }, current)).toEqual({
      kind: 'checking',
    });
  });

  it('keeps the last known result during and after a failed background re-check', () => {
    const known: VersionStatus = { kind: 'update', deployed: newer, reason: 'newer', checkedAt: 1 };
    expect(reduceStatus(known, { type: 'start' }, current)).toBe(known);
    expect(reduceStatus(known, { type: 'failure' }, current)).toBe(known);
    const ok: VersionStatus = { kind: 'latest', deployed: latest, checkedAt: 1 };
    expect(reduceStatus(ok, { type: 'failure' }, current)).toBe(ok);
  });

  it('moves from update back to latest when the deployment matches again', () => {
    const known: VersionStatus = { kind: 'update', deployed: newer, reason: 'newer', checkedAt: 1 };
    expect(reduceStatus(known, { type: 'success', deployed: latest, at: 2 }, current).kind).toBe(
      'latest',
    );
  });
});

describe('shouldCheck', () => {
  const t0 = 1_000_000;

  it('always runs the first check and explicit ones', () => {
    expect(shouldCheck('load', t0, null, false)).toBe(true);
    expect(shouldCheck('manual', t0, t0, false)).toBe(true);
    expect(shouldCheck('visible', t0, null, false)).toBe(true);
  });

  it('throttles background checks to the minimum gap', () => {
    expect(shouldCheck('visible', t0 + MIN_CHECK_GAP_MS - 1, t0, false)).toBe(false);
    expect(shouldCheck('visible', t0 + MIN_CHECK_GAP_MS, t0, false)).toBe(true);
    expect(shouldCheck('interval', t0 + 5 * 60_000, t0, false)).toBe(false);
    expect(shouldCheck('interval', t0 + 30 * 60_000, t0, false)).toBe(true);
    expect(shouldCheck('visible', t0 + 61_000, t0, false, 60_000)).toBe(true);
  });

  it('never overlaps a check that is still in flight', () => {
    expect(shouldCheck('load', t0, null, true)).toBe(false);
    expect(shouldCheck('manual', t0, t0, true)).toBe(false);
  });
});

describe('shouldShowBanner', () => {
  const newer = build('0.2.0', SHA_B);
  const update: VersionStatus = { kind: 'update', deployed: newer, reason: 'newer', checkedAt: 1 };

  it('shows once per deployment until dismissed', () => {
    expect(shouldShowBanner(update, null)).toBe(true);
    expect(shouldShowBanner(update, deploymentKey(newer))).toBe(false);
    const newest = build('0.3.0', SHA_A);
    expect(
      shouldShowBanner(
        { kind: 'update', deployed: newest, reason: 'newer', checkedAt: 2 },
        deploymentKey(newer),
      ),
    ).toBe(true);
  });

  it('never shows without an update', () => {
    expect(shouldShowBanner({ kind: 'checking' }, null)).toBe(false);
    expect(shouldShowBanner({ kind: 'error' }, null)).toBe(false);
    expect(shouldShowBanner({ kind: 'latest', deployed: newer, checkedAt: 1 }, null)).toBe(false);
  });
});

describe('badge label', () => {
  const update = (reason: UpdateReason, deployed: BuildInfo): VersionStatus => ({
    kind: 'update',
    deployed,
    reason,
    checkedAt: 1,
  });

  it('maps every status onto one of a fixed set of labels', () => {
    const statuses: VersionStatus[] = [
      { kind: 'checking' },
      { kind: 'error' },
      { kind: 'latest', deployed: build('0.1.0'), checkedAt: 1 },
      update('newer', build('0.10.0-beta.12', SHA_B)),
      update('rebuild', build('0.1.0', SHA_B)),
      update('changed', build('0.0.9', SHA_B)),
    ];
    const labels = statuses.map(statusLabel);
    expect(labels).toEqual(['checking', 'error', 'latest', 'newer', 'rebuild', 'changed']);
    for (const l of labels) expect(STATUS_LABELS).toContain(l);
    expect(new Set(STATUS_LABELS).size).toBe(STATUS_LABELS.length);
  });

  it('keeps the deployed version out of the label and in the screen-reader detail', () => {
    expect(statusDetail(update('newer', build('0.10.0-beta.12', SHA_B)))).toBe(' v0.10.0-beta.12');
    expect(statusDetail(update('changed', build('0.0.9', SHA_B)))).toBe(' v0.0.9');
    expect(statusDetail(update('rebuild', build('0.1.0', SHA_B)))).toBe(' (bbbbbbb)');
    expect(statusDetail({ kind: 'latest', deployed: build('0.1.0'), checkedAt: 1 })).toBe('');
    expect(statusDetail({ kind: 'checking' })).toBe('');
    expect(statusDetail({ kind: 'error' })).toBe('');
  });
});

describe('banner placement', () => {
  const vh = 844;

  it('rises above a bar that is stuck to the bottom edge', () => {
    expect(stuckBarLift({ top: 743, bottom: 844 }, vh)).toBe(101);
    expect(stuckBarLift({ top: 742.4, bottom: 843.6 }, vh)).toBe(102);
  });

  it('stays at the bottom edge when the bar is elsewhere or missing', () => {
    expect(stuckBarLift(null, vh)).toBe(0);
    expect(stuckBarLift({ top: 500, bottom: 601 }, vh)).toBe(0);
    expect(stuckBarLift({ top: 900, bottom: 1001 }, vh)).toBe(0);
    expect(stuckBarLift({ top: 844, bottom: 844 }, vh)).toBe(0);
  });

  it('keeps the band from the banner top down clear, plus a gap', () => {
    expect(bottomInset(642, vh, 8)).toBe(210);
    expect(bottomInset(642.2, vh, 8)).toBe(210);
    expect(bottomInset(900, vh, 8)).toBe(0);
  });
});

describe('cookies', () => {
  it('parses names from document.cookie', () => {
    expect(parseCookieNames('')).toEqual([]);
    expect(parseCookieNames('a=1; b=two=2;c=; a=again')).toEqual(['a', 'b', 'c']);
    expect(parseCookieNames(' spaced = x ;=nameless; novalue')).toEqual(['spaced']);
    expect(parseCookieNames('__Host-id=1; __Secure-x=2')).toEqual(['__Host-id', '__Secure-x']);
  });

  it('expires each cookie host-only and for the exact host, never a parent domain', () => {
    const lines = expiringCookies(['a'], 'trex-vs-tiger.vinylims.com', true);
    expect(lines).toEqual([
      'a=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Secure',
      'a=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=trex-vs-tiger.vinylims.com; Secure',
    ]);
    expect(lines.some((l) => /Domain=\.?vinylims\.com/.test(l))).toBe(false);
    expect(expiringCookies(['b'], 'localhost', false)[0]).not.toContain('Secure');
    expect(expiringCookies([], 'localhost', false)).toEqual([]);
  });
});

describe('reset URLs', () => {
  it('builds the reset URL and keeps only a fragment', () => {
    expect(resetUrl('0.1.0', '')).toBe('/reset/?from=0.1.0');
    expect(resetUrl('0.1.0-rc.1+x', '#s=abc')).toBe('/reset/?from=0.1.0-rc.1%2Bx#s=abc');
    expect(resetUrl('0.1.0', 'not-a-hash')).toBe('/reset/?from=0.1.0');
  });

  it('names the play page of the app’s language as the place to return to', () => {
    expect(resetUrl('0.1.0', '#s=abc', '/play/')).toBe('/reset/?from=0.1.0#s=abc');
    expect(resetUrl('0.1.0', '#s=abc', '/en/play/')).toBe(
      '/reset/?from=0.1.0&to=%2Fen%2Fplay%2F#s=abc',
    );
    expect(resetUrl('0.1.0', '', '/guide/')).toBe('/reset/?from=0.1.0');
  });

  it('builds the cache-busting reload URL', () => {
    expect(reloadUrl(1234, '')).toBe('/play/?_r=1234');
    expect(reloadUrl(1234, '#s=abc')).toBe('/play/?_r=1234#s=abc');
    expect(reloadUrl(1234, '#s=abc', '/en/play/')).toBe('/en/play/?_r=1234#s=abc');
  });

  it('returns only to a play page, or to a lobby an older build names', () => {
    expect(returnPathFromSearch('?from=0.1.0&to=%2Fen%2Fplay%2F')).toBe('/en/play/');
    expect(returnPathFromSearch('?from=0.1.0')).toBe('/play/');
    // A tab of a build before the lobby sends `to=/en/` (or nothing, meaning `/`): it returns to
    // the play page of that language, not to the lobby (#142).
    expect(returnPathFromSearch('?from=0.1.0&to=%2Fen%2F')).toBe('/en/play/');
    expect(returnPathFromSearch('?from=0.1.0&to=%2F')).toBe('/play/');
    expect(reloadUrl(1, '#s=x', '/en/')).toBe('/en/play/?_r=1#s=x');
    for (const proto of ['__proto__', 'constructor', 'toString']) {
      expect(appReturnPath(proto), proto).toBe('/play/');
    }
    for (const to of ['//evil.example/', 'https://evil.example/', '/en', '/guide/', '/en/../x']) {
      expect(returnPathFromSearch(`?to=${encodeURIComponent(to)}`), to).toBe('/play/');
      expect(appReturnPath(to), to).toBe('/play/');
    }
    expect(appReturnPath(null)).toBe('/play/');
    const back = resetUrl('0.1.0', '#s=x', '/en/play/');
    expect(
      reloadUrl(1, '#s=x', returnPathFromSearch(back.slice(back.indexOf('?'), back.indexOf('#')))),
    ).toBe('/en/play/?_r=1#s=x');
  });

  it('strips only the reload marker from the query string', () => {
    expect(stripReloadParam('')).toBeNull();
    expect(stripReloadParam('?tour=1')).toBeNull();
    expect(stripReloadParam('?_r=1234')).toBe('');
    expect(stripReloadParam('?tour=1&_r=1234')).toBe('?tour=1');
  });
});
