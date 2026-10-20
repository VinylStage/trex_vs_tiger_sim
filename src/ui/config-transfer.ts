import {
  configCode,
  configFileJson,
  configFileName,
  MAX_CONFIG_FILE_BYTES,
  parseConfigFile,
  parseConfigInput,
  type ParseResult,
} from '../share/config-code.ts';
import { sm, type ShareMsgKey } from '../share/messages.ts';
import { shortName } from '../share/result-text.ts';
import { copyText, downloadBlob, flash } from '../share/share-ui.ts';
import type { ScenarioConfig } from '../sim/config.ts';
import { getLang, onLangChange } from './i18n.ts';
import { configDiff } from './share.ts';
import './share-panel.css';

/*
 * Config export/import panel of the simulator (docs/SHARING.md#config-code): copy a `TVT2-` code,
 * save or load a `.json` file, paste a code or link. An import is only previewed; it is applied
 * when the person confirms, and never starts a run.
 */

export interface ConfigTransferHooks {
  getConfig(): ScenarioConfig;
  applyConfig(config: ScenarioConfig): void;
  /**
   * Pasted text that is a free-matchup config (`TVT3-` code or v3 link, #50): apply it and
   * return true; return false to parse it as a classic config.
   */
  applyFreeInput?(text: string): boolean;
}

const t = (key: ShareMsgKey, vars?: Readonly<Record<string, string | number>>): string =>
  sm(getLang(), key, vars);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...children);
  return e;
}

function btn(cls = 'btn btn-small'): HTMLButtonElement {
  const b = el('button', cls);
  b.type = 'button';
  return b;
}

/** One-line summary of a config for the import preview. */
export function configSummaryLines(c: ScenarioConfig, lang = getLang()): string[] {
  const edited = Object.keys((configDiff(c)['params'] as object | undefined) ?? {}).length;
  return [
    sm(lang, 'xfer.summary', {
      heavy: shortName(c.heavySpecies, c.heavyCount, lang),
      heavyCount: c.heavyCount,
      pack: shortName(c.packSpecies, c.packCount, lang),
      packCount: c.packCount,
      runs: c.runs.toLocaleString(lang),
      seed: String(c.seed),
    }),
    edited > 0
      ? sm(lang, 'xfer.summaryParams', { n: edited })
      : sm(lang, 'xfer.summaryDefaultParams'),
  ];
}

export function createConfigTransfer(hooks: ConfigTransferHooks): HTMLElement {
  const summary = el('summary');
  const help = el('p', 'hint xfer-help');
  const codeLabel = el('label', 'xfer-label');
  const codeField = el('input', 'xfer-field');
  codeField.readOnly = true;
  codeField.id = 'xfer-code';
  codeLabel.htmlFor = codeField.id;
  const copyBtn = btn();
  const saveBtn = btn();

  const pasteLabel = el('label', 'xfer-label');
  const pasteField = el('textarea', 'xfer-field');
  pasteField.id = 'xfer-paste';
  pasteField.rows = 2;
  pasteField.spellcheck = false;
  pasteField.autocomplete = 'off';
  pasteLabel.htmlFor = pasteField.id;
  const checkBtn = btn();
  const loadBtn = btn();
  const fileInput = el('input', 'visually-hidden');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.tabIndex = -1;
  fileInput.setAttribute('aria-hidden', 'true');

  const errorEl = el('p', 'xfer-error');
  errorEl.setAttribute('role', 'alert');
  const statusEl = el('p', 'xfer-status');
  statusEl.setAttribute('role', 'status');

  const previewTitle = el('p', 'xfer-preview-title');
  const previewList = el('ul', 'xfer-preview-list');
  const applyBtn = btn('btn btn-small btn-primary');
  const cancelBtn = btn();
  const preview = el(
    'div',
    'xfer-preview',
    previewTitle,
    previewList,
    el('div', 'xfer-buttons', applyBtn, cancelBtn),
  );
  preview.hidden = true;
  let pending: ScenarioConfig | null = null;

  const panel = el(
    'details',
    'advanced xfer',
    summary,
    el(
      'div',
      'xfer-body',
      help,
      codeLabel,
      codeField,
      el('div', 'xfer-buttons', copyBtn, saveBtn),
      pasteLabel,
      pasteField,
      el('div', 'xfer-buttons', checkBtn, loadBtn),
      fileInput,
      errorEl,
      preview,
      statusEl,
    ),
  );

  const refreshCode = (): void => {
    codeField.value = configCode(hooks.getConfig());
  };

  function relabel(): void {
    summary.textContent = t('xfer.title');
    help.textContent = t('xfer.codeHelp');
    codeLabel.textContent = t('xfer.codeLabel');
    copyBtn.textContent = t('xfer.copyCode');
    saveBtn.textContent = t('xfer.saveFile');
    pasteLabel.textContent = t('xfer.pasteLabel');
    pasteField.placeholder = t('xfer.pastePlaceholder');
    checkBtn.textContent = t('xfer.check');
    loadBtn.textContent = t('xfer.loadFile');
    previewTitle.textContent = t('xfer.previewTitle');
    applyBtn.textContent = t('xfer.apply');
    cancelBtn.textContent = t('xfer.cancel');
    if (pending) showPreview(pending);
    errorEl.textContent = '';
  }

  function showPreview(c: ScenarioConfig): void {
    pending = c;
    previewList.replaceChildren(...configSummaryLines(c).map((line) => el('li', '', line)));
    preview.hidden = false;
  }

  function handle(res: ParseResult): void {
    errorEl.textContent = '';
    if (!res.ok) {
      pending = null;
      preview.hidden = true;
      errorEl.textContent = t(`xfer.err.${res.error}`);
      return;
    }
    showPreview(res.config);
  }

  panel.addEventListener('toggle', () => {
    if (panel.open) refreshCode();
  });
  codeField.addEventListener('focus', () => {
    refreshCode();
    codeField.select();
  });
  copyBtn.addEventListener('click', () => {
    refreshCode();
    void copyText(codeField.value, getLang()).then((ok) => {
      if (ok) flash(statusEl, t('xfer.codeCopied'));
    });
  });
  saveBtn.addEventListener('click', () => {
    const c = hooks.getConfig();
    const blob = new Blob([configFileJson(c, new Date())], { type: 'application/json' });
    downloadBlob(blob, configFileName(c));
    flash(statusEl, t('xfer.saved'));
  });
  const check = (): void => {
    if (hooks.applyFreeInput?.(pasteField.value)) {
      pasteField.value = '';
      pending = null;
      preview.hidden = true;
      flash(statusEl, t('xfer.applied'));
      return;
    }
    handle(parseConfigInput(pasteField.value));
  };
  checkBtn.addEventListener('click', check);
  pasteField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      check();
    }
  });
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_CONFIG_FILE_BYTES) {
      handle({ ok: false, error: 'length' });
      return;
    }
    file.text().then(
      (text) => handle(parseConfigFile(text, file.size)),
      () => {
        errorEl.textContent = t('xfer.err.file');
      },
    );
  });
  applyBtn.addEventListener('click', () => {
    if (!pending) return;
    hooks.applyConfig(pending);
    pending = null;
    preview.hidden = true;
    pasteField.value = '';
    refreshCode();
    flash(statusEl, t('xfer.applied'));
  });
  cancelBtn.addEventListener('click', () => {
    pending = null;
    preview.hidden = true;
  });

  relabel();
  onLangChange(relabel);
  return panel;
}
