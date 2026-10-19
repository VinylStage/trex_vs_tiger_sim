import { h, uniqueId } from './dom';
import { locale, onLangChange, t, type MsgKey } from './i18n';
import { clearSiteData } from './site-data';
import {
  POLL_INTERVAL_MS,
  RELEASES_URL,
  VERSION_JSON_PATH,
  deploymentKey,
  parseBuildInfo,
  reduceStatus,
  resetUrl,
  shortSha,
  shouldCheck,
  shouldShowBanner,
  stripReloadParam,
  type BuildInfo,
  type CheckTrigger,
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

const versionLabel = (b: BuildInfo): string => `v${b.version} (${shortSha(b.sha)})`;

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

function statusText(s: VersionStatus): string {
  switch (s.kind) {
    case 'checking':
      return t('version.status.checking');
    case 'error':
      return t('version.status.error');
    case 'latest':
      return t('version.status.latest');
    case 'update':
      if (s.reason === 'rebuild') return t('version.status.rebuild');
      return t(s.reason === 'newer' ? 'version.status.newer' : 'version.status.changed', {
        version: s.deployed.version,
      });
  }
}

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
  const label = h('span', { class: 'version-badge-status' });
  const badge = h(
    'button',
    {
      class: 'version-badge',
      i18nTitle: 'version.badgeTitle',
      attrs: { type: 'button', 'aria-haspopup': 'dialog' },
    },
    num,
    h('span', { class: 'version-badge-dot', attrs: { 'aria-hidden': 'true' } }),
    label,
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

  function buildBanner() {
    const text = h('p', { class: 'update-banner-text', attrs: { role: 'status' } });
    const updateBtn = h('button', {
      class: 'btn btn-small btn-primary',
      i18n: 'version.bannerAction',
      attrs: { type: 'button' },
    });
    const dismissBtn = h('button', { class: 'btn btn-small btn-ghost', attrs: { type: 'button' } });
    const el = h(
      'section',
      { class: 'update-banner', i18nAria: 'version.bannerRegion' },
      text,
      h('div', { class: 'update-banner-actions' }, updateBtn, dismissBtn),
    );
    el.hidden = true;
    updateBtn.addEventListener('click', () => openDialog(true));
    dismissBtn.addEventListener('click', () => {
      if (bannerMode === 'update' && status.kind === 'update') {
        dismissedKey = deploymentKey(status.deployed);
      }
      bannerMode = null;
      paintBanner();
    });
    document.body.append(el);
    return { el, text, updateBtn, dismissBtn };
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

  function paintBanner(): void {
    const b = bannerParts ?? (bannerMode ? (bannerParts = buildBanner()) : null);
    if (!b) return;
    if (!bannerMode) {
      if (b.el.hidden) return;
      const hadFocus = b.el.contains(document.activeElement);
      b.el.hidden = true;
      if (hadFocus) badge.focus();
      return;
    }
    const withActions = bannerMode === 'update';
    b.updateBtn.hidden = !withActions;
    b.dismissBtn.textContent = t(withActions ? 'version.bannerDismiss' : 'version.close');
    if (b.el.hidden) {
      // Reveal first, fill the live region a moment later so screen readers announce it.
      b.text.textContent = '';
      b.el.hidden = false;
      window.setTimeout(() => {
        b.text.textContent = bannerText();
      }, 50);
    } else {
      setText(b.text, bannerText());
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
    setText(label, statusText(status));
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
    location.replace(resetUrl(CURRENT_BUILD.version, location.hash));
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

/** Footer line with the running version, linking to the release notes. */
export function createVersionFooter(): HTMLAnchorElement {
  return h(
    'a',
    {
      class: 'version-footer',
      i18nTitle: 'version.footerTitle',
      attrs: { href: RELEASES_URL, rel: 'noopener', target: '_blank' },
    },
    h('span', { i18n: 'version.footer' }),
    ` ${versionLabel(CURRENT_BUILD)}`,
  );
}
