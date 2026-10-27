import { h, uniqueId } from './dom';
import { versionAnchor } from '../content/patch-notes';
import { pagePath, playPagePath } from '../pages/routes';
import { getLang, locale, onLangChange, t, type MsgKey } from './i18n';
import { clearSiteData } from './site-data';
import {
  POLL_INTERVAL_MS,
  RELEASES_URL,
  STATUS_LABELS,
  VERSION_JSON_PATH,
  bottomInset,
  deploymentKey,
  parseBuildInfo,
  reduceStatus,
  resetUrl,
  shortSha,
  shouldCheck,
  shouldShowBanner,
  statusDetail,
  statusLabel,
  stripReloadParam,
  stuckBarLift,
  type BuildInfo,
  type CheckTrigger,
  type StatusLabel,
  type VersionStatus,
} from './version-model';
import './version.css';

/** The build this page was loaded from (Vite `define`, see vite.config.ts). */
export const CURRENT_BUILD: BuildInfo = {
  version: __APP_VERSION__,
  sha: __BUILD_SHA__,
  builtAt: __BUILD_TIME__,
};

const FETCH_TIMEOUT_MS = 10_000;
/** Opening the dialog refreshes the status when the last check is older than this. */
const DIALOG_REFRESH_MS = 60_000;
const NOTICE_MS = 6000;
/**
 * Bar that sticks to the bottom of the viewport on the single-column layout (the config panel's
 * run bar, src/ui/app.ts). The update banner sits above it instead of covering it.
 */
const STICKY_BOTTOM_BAR = '.run-bar';
const LIFT_PROPERTY = '--update-banner-lift';
/** Clearance kept between the banner and focused content or the end of the page. */
const BANNER_GAP_PX = 8;

const versionLabel = (b: BuildInfo): string => `v${b.version} (${shortSha(b.sha)})`;

/**
 * Link to a version's card on the patch notes page (docs/PAGES.md#patch-notes). `data-page` and
 * `data-href-suffix` let relocalizeLinks (src/ui/site-nav.ts) follow an in-app language switch.
 */
function patchNotesLink(key: MsgKey, version: string, className?: string): HTMLAnchorElement {
  const suffix = `#${versionAnchor(version)}`;
  return h('a', {
    ...(className ? { class: className } : {}),
    i18n: key,
    attrs: {
      href: `${pagePath('patch-notes', getLang())}${suffix}`,
      'data-page': 'patch-notes',
      'data-href-suffix': suffix,
    },
  });
}

/** Update text only when it changes, so live regions do not repeat themselves on re-renders. */
function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function formatDate(iso: string, withDate: boolean): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return t('version.unknown');
  return new Intl.DateTimeFormat(
    locale(),
    withDate ? { dateStyle: 'medium', timeStyle: 'short' } : { timeStyle: 'short' },
  ).format(d);
}

const LABEL_KEYS: Readonly<Record<StatusLabel, MsgKey>> = {
  checking: 'version.status.checking',
  latest: 'version.status.latest',
  newer: 'version.status.newer',
  rebuild: 'version.status.rebuild',
  changed: 'version.status.changed',
  error: 'version.status.error',
};

function messageKey(s: VersionStatus): MsgKey {
  switch (s.kind) {
    case 'checking':
      return 'version.msg.checking';
    case 'error':
      return 'version.msg.error';
    case 'latest':
      return 'version.msg.latest';
    case 'update':
      return `version.msg.${s.reason}`;
  }
}

async function fetchDeployed(): Promise<BuildInfo | null> {
  const res = await fetch(VERSION_JSON_PATH, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal:
      typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : null,
  });
  if (!res.ok) return null;
  return parseBuildInfo(await res.json());
}

function whenIdle(fn: () => void): void {
  const run = (): void => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 3000 });
    } else {
      window.setTimeout(fn, 1);
    }
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/**
 * Header badge with the running version and the result of comparing it against the deployed
 * `/version.json`. Clicking it opens a dialog with build details, release notes and the
 * "load the latest version" reset. Call once per page.
 */
export function createVersionBadge(): HTMLButtonElement {
  let status: VersionStatus = { kind: 'checking' };
  let lastAttemptAt: number | null = null;
  let inFlight = false;
  let dismissedKey: string | null = null;
  let resetting = false;

  const num = h('span', { class: 'version-badge-num', text: `v${CURRENT_BUILD.version}` });
  // Every label is rendered in the same grid cell and only the current one is visible, so the
  // badge is as wide as the longest label from the first paint and never reflows the header.
  const labels = new Map(
    STATUS_LABELS.map((k) => [k, h('span', { i18n: LABEL_KEYS[k] })] as const),
  );
  const detail = h('span', { class: 'visually-hidden' });
  const badge = h(
    'button',
    {
      class: 'version-badge',
      i18nTitle: 'version.badgeTitle',
      attrs: { type: 'button', 'aria-haspopup': 'dialog' },
    },
    num,
    h('span', { class: 'version-badge-dot', attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'version-badge-status' }, ...labels.values()),
    detail,
  );

  // ---------- dialog (built on first open) ----------
  let dialogParts: ReturnType<typeof buildDialog> | null = null;

  function buildDialog() {
    const titleId = uniqueId('version-title');
    const confirmTitleId = uniqueId('version-confirm');
    const closeBtn = h('button', {
      class: 'btn btn-ghost btn-icon version-close',
      i18nAria: 'version.close',
      text: '×',
      attrs: { type: 'button' },
    });
    const msg = h('p', { class: 'version-msg', attrs: { role: 'status' } });
    const currentDd = h('dd', { text: versionLabel(CURRENT_BUILD) });
    const builtDd = h('dd');
    const deployedDd = h('dd');
    const checkedDd = h('dd');
    const fact = (key: MsgKey, dd: HTMLElement): HTMLElement[] => [h('dt', { i18n: key }), dd];
    const recheckBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'version.recheck',
      attrs: { type: 'button' },
    });
    const reloadBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'version.reload',
      attrs: { type: 'button' },
    });
    const actions = h('div', { class: 'version-actions' }, recheckBtn, reloadBtn);
    const confirmTitle = h('h3', {
      id: confirmTitleId,
      i18n: 'version.confirmTitle',
      attrs: { tabindex: '-1' },
    });
    const cancelBtn = h('button', {
      class: 'btn btn-small',
      i18n: 'version.cancel',
      attrs: { type: 'button' },
    });
    const confirmBtn = h('button', {
      class: 'btn btn-small btn-primary',
      attrs: { type: 'button' },
    });
    const confirmBox = h(
      'div',
      { class: 'version-confirm', attrs: { role: 'group', 'aria-labelledby': confirmTitleId } },
      confirmTitle,
      h('p', { i18n: 'version.confirmBody' }),
      h('div', { class: 'version-actions' }, cancelBtn, confirmBtn),
    );
    confirmBox.hidden = true;

    const dialog = h(
      'dialog',
      { class: 'version-dialog', attrs: { 'aria-labelledby': titleId } },
      h(
        'div',
        { class: 'version-dialog-body' },
        h(
          'div',
          { class: 'version-dialog-head' },
          h('h2', { id: titleId, i18n: 'version.dialogTitle' }),
          closeBtn,
        ),
        msg,
        h(
          'dl',
          { class: 'version-facts' },
          ...fact('version.current', currentDd),
          ...fact('version.builtAt', builtDd),
          ...fact('version.deployed', deployedDd),
          ...fact('version.checkedAt', checkedDd),
        ),
        h(
          'p',
          { class: 'version-links' },
          patchNotesLink('version.patchNotes', CURRENT_BUILD.version),
          h('a', {
            i18n: 'version.releaseNotes',
            attrs: { href: RELEASES_URL, rel: 'noopener', target: '_blank' },
          }),
        ),
        actions,
        confirmBox,
      ),
    );

    const showConfirm = (show: boolean): void => {
      confirmBox.hidden = !show;
      actions.hidden = show;
      (show ? confirmTitle : reloadBtn).focus();
    };

    closeBtn.addEventListener('click', () => dialog.close());
    // A click whose target is the <dialog> itself landed on the backdrop (the body fills the box).
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && !resetting) dialog.close();
    });
    dialog.addEventListener('cancel', (e) => {
      if (resetting) e.preventDefault();
    });
    dialog.addEventListener('close', () => {
      confirmBox.hidden = true;
      actions.hidden = false;
      if (document.activeElement === document.body) badge.focus();
    });
    recheckBtn.addEventListener('click', () => void check('manual'));
    reloadBtn.addEventListener('click', () => showConfirm(true));
    cancelBtn.addEventListener('click', () => showConfirm(false));
    confirmBtn.addEventListener('click', () => void reset());

    document.body.append(dialog);
    return {
      dialog,
      msg,
      builtDd,
      deployedDd,
      checkedDd,
      recheckBtn,
      reloadBtn,
      cancelBtn,
      confirmBtn,
      closeBtn,
      showConfirm,
    };
  }

  function renderDialog(): void {
    const d = dialogParts;
    if (!d) return;
    setText(d.msg, t(messageKey(status)));
    d.msg.dataset.state = status.kind;
    setText(d.builtDd, formatDate(CURRENT_BUILD.builtAt, true));
    const known = status.kind === 'latest' || status.kind === 'update' ? status : null;
    setText(
      d.deployedDd,
      known
        ? versionLabel(known.deployed)
        : t(status.kind === 'checking' ? 'version.status.checking' : 'version.unknown'),
    );
    setText(d.checkedDd, known ? formatDate(new Date(known.checkedAt).toISOString(), false) : '—');
    // aria-disabled instead of disabled keeps keyboard focus on the button while a check runs.
    d.recheckBtn.setAttribute('aria-disabled', String(inFlight || resetting));
    d.recheckBtn.setAttribute('aria-busy', String(inFlight));
    d.reloadBtn.classList.toggle('btn-primary', status.kind === 'update');
    for (const b of [d.reloadBtn, d.cancelBtn, d.confirmBtn, d.closeBtn]) b.disabled = resetting;
    setText(d.confirmBtn, t(resetting ? 'version.resetting' : 'version.confirm'));
  }

  function openDialog(confirm: boolean): void {
    dialogParts ??= buildDialog();
    renderDialog();
    if (!dialogParts.dialog.open) dialogParts.dialog.showModal();
    if (confirm) dialogParts.showConfirm(true);
    void check('visible', DIALOG_REFRESH_MS);
  }

  badge.addEventListener('click', () => openDialog(false));

  // ---------- banner (built on first use) ----------
  /** `update`: a newer deployment was found; `notice`: confirmation after a reset reload. */
  let bannerMode: 'update' | 'notice' | null = null;
  let bannerParts: ReturnType<typeof buildBanner> | null = null;
  let noticeTimer = 0;

  function dismissBanner(): void {
    if (bannerMode === 'update' && status.kind === 'update') {
      dismissedKey = deploymentKey(status.deployed);
    }
    bannerMode = null;
    paintBanner();
  }

  function buildBanner() {
    // The visible text is set before the banner is revealed, so its size is final from its first
    // frame. Screen readers get the same text from a separate live region filled just after.
    const text = h('p', { class: 'update-banner-text', attrs: { 'aria-hidden': 'true' } });
    const live = h('p', { class: 'visually-hidden', attrs: { role: 'status' } });
    const updateBtn = h('button', {
      class: 'btn btn-small btn-primary',
      i18n: 'version.bannerAction',
      attrs: { type: 'button' },
    });
    const dismissBtn = h('button', { class: 'btn btn-small btn-ghost', attrs: { type: 'button' } });
    // Points at the deployed version's card; the page is fetched fresh, so the card exists there.
    const notesLink = patchNotesLink(
      'version.bannerNotes',
      CURRENT_BUILD.version,
      'update-banner-notes',
    );
    const el = h(
      'section',
      { class: 'update-banner', i18nAria: 'version.bannerRegion' },
      text,
      live,
      h('div', { class: 'update-banner-actions' }, notesLink, updateBtn, dismissBtn),
    );
    el.hidden = true;
    updateBtn.addEventListener('click', () => openDialog(true));
    dismissBtn.addEventListener('click', dismissBanner);
    el.addEventListener('animationend', schedulePlace);
    el.addEventListener('transitionend', schedulePlace);
    document.body.append(el);
    return { el, text, live, notesLink, updateBtn, dismissBtn };
  }

  function bannerText(): string {
    if (bannerMode === 'notice') return t('version.updated', { version: CURRENT_BUILD.version });
    if (bannerMode === 'update' && status.kind === 'update') {
      const d = status.deployed;
      return t('version.banner', {
        label: status.reason === 'rebuild' ? versionLabel(d) : `v${d.version}`,
      });
    }
    return '';
  }

  // The banner is docked to the bottom of the viewport. On the single-column layout it rises above
  // the config panel's run bar while that bar is stuck to the bottom edge (version.css applies the
  // lift below 1000 px). While it is shown, `scroll-padding-bottom` keeps focused elements clear of
  // the band it covers, body padding lets the end of the page scroll above it, and Esc dismisses it.
  let placeFrame = 0;
  let observer: ResizeObserver | null = null;
  let observedBar: Element | null = null;

  function placeBanner(): void {
    const el = bannerParts?.el;
    if (!el || el.hidden) return;
    const vh = document.documentElement.clientHeight;
    // Looked up on every pass: the post-reset notice can be revealed before the app is mounted.
    const barEl = document.querySelector(STICKY_BOTTOM_BAR);
    if (barEl && barEl !== observedBar && observer) {
      observer.observe(barEl);
      observedBar = barEl;
    }
    const lift = `${stuckBarLift(barEl?.getBoundingClientRect() ?? null, vh)}px`;
    if (el.style.getPropertyValue(LIFT_PROPERTY) !== lift)
      el.style.setProperty(LIFT_PROPERTY, lift);
    const inset = bottomInset(el.getBoundingClientRect().top, vh, BANNER_GAP_PX);
    document.documentElement.style.scrollPaddingBottom = `${inset}px`;
    const docked = (Number.parseFloat(getComputedStyle(el).bottom) || 0) + el.offsetHeight;
    document.body.style.paddingBottom = `${Math.ceil(docked + BANNER_GAP_PX)}px`;
  }

  function schedulePlace(): void {
    if (placeFrame) return;
    placeFrame = window.requestAnimationFrame(() => {
      placeFrame = 0;
      placeBanner();
    });
  }

  function onBannerKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
    // An open modal dialog handles its own Esc.
    if (document.querySelector('dialog[open]')) return;
    dismissBanner();
  }

  function trackBanner(on: boolean): void {
    if (on) {
      window.addEventListener('scroll', schedulePlace, { passive: true });
      window.addEventListener('resize', schedulePlace);
      document.addEventListener('keydown', onBannerKeydown);
      if (typeof ResizeObserver === 'function') {
        observer ??= new ResizeObserver(schedulePlace);
        if (bannerParts) observer.observe(bannerParts.el);
      }
      placeBanner();
      schedulePlace();
      return;
    }
    window.removeEventListener('scroll', schedulePlace);
    window.removeEventListener('resize', schedulePlace);
    document.removeEventListener('keydown', onBannerKeydown);
    observer?.disconnect();
    observedBar = null;
    window.cancelAnimationFrame(placeFrame);
    placeFrame = 0;
    document.documentElement.style.removeProperty('scroll-padding-bottom');
    document.body.style.removeProperty('padding-bottom');
  }

  function paintBanner(): void {
    const b = bannerParts ?? (bannerMode ? (bannerParts = buildBanner()) : null);
    if (!b) return;
    if (!bannerMode) {
      if (b.el.hidden) return;
      const hadFocus = b.el.contains(document.activeElement);
      b.el.hidden = true;
      trackBanner(false);
      if (hadFocus) badge.focus();
      return;
    }
    const withActions = bannerMode === 'update';
    b.updateBtn.hidden = !withActions;
    b.notesLink.hidden = !withActions;
    if (withActions && status.kind === 'update') {
      const suffix = `#${versionAnchor(status.deployed.version)}`;
      b.notesLink.dataset['hrefSuffix'] = suffix;
      b.notesLink.href = `${pagePath('patch-notes', getLang())}${suffix}`;
    }
    b.dismissBtn.textContent = t(withActions ? 'version.bannerDismiss' : 'version.close');
    setText(b.text, bannerText());
    if (b.el.hidden) {
      // Reveal first, fill the live region a moment later so screen readers announce it.
      b.live.textContent = '';
      b.el.hidden = false;
      trackBanner(true);
      window.setTimeout(() => {
        b.live.textContent = bannerText();
      }, 50);
    } else {
      setText(b.live, bannerText());
    }
  }

  function renderBanner(): void {
    if (shouldShowBanner(status, dismissedKey)) {
      clearTimeout(noticeTimer);
      bannerMode = 'update';
    } else if (bannerMode === 'update') {
      bannerMode = null;
    }
    paintBanner();
  }

  // ---------- status ----------
  function render(): void {
    badge.dataset.state = status.kind;
    const current = statusLabel(status);
    for (const [k, el] of labels) el.classList.toggle('is-current', k === current);
    setText(detail, statusDetail(status));
    renderDialog();
    renderBanner();
  }

  async function check(trigger: CheckTrigger, minGapMs?: number): Promise<void> {
    if (!shouldCheck(trigger, Date.now(), lastAttemptAt, inFlight || resetting, minGapMs)) return;
    inFlight = true;
    lastAttemptAt = Date.now();
    status = reduceStatus(status, { type: 'start' }, CURRENT_BUILD);
    render();
    const deployed = await fetchDeployed().catch(() => null);
    inFlight = false;
    status = reduceStatus(
      status,
      deployed ? { type: 'success', deployed, at: Date.now() } : { type: 'failure' },
      CURRENT_BUILD,
    );
    render();
  }

  async function reset(): Promise<void> {
    if (resetting) return;
    resetting = true;
    render();
    await clearSiteData();
    location.replace(resetUrl(CURRENT_BUILD.version, location.hash, playPagePath(getLang())));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check('visible');
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void check('interval');
  }, POLL_INTERVAL_MS);
  onLangChange(render);

  // Landing from /reset/: drop the cache-busting marker from the URL and confirm the update.
  const cleanSearch = stripReloadParam(location.search);
  if (cleanSearch !== null) {
    history.replaceState(history.state, '', `${location.pathname}${cleanSearch}${location.hash}`);
    bannerMode = 'notice';
    noticeTimer = window.setTimeout(() => {
      if (bannerMode !== 'notice') return;
      bannerMode = null;
      paintBanner();
    }, NOTICE_MS);
  }

  render();
  whenIdle(() => void check('load'));
  return badge;
}

/**
 * Fill the version slot of the static footer (`[data-app-version]` inside `a.version-footer`,
 * see docs/VERSIONING.md) with the running version and build. The link to the release notes and
 * its label are in the static HTML of every page.
 */
export function fillVersionFooter(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-app-version]')) {
    el.textContent = versionLabel(CURRENT_BUILD);
  }
}
