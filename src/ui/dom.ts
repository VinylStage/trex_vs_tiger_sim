import { I18N_ATTR, t, type MsgKey } from './i18n';

export type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  id?: string;
  text?: string;
  /** Bind textContent to a message key (re-applied on language change). */
  i18n?: MsgKey;
  /** Bind the `title` attribute to a message key. */
  i18nTitle?: MsgKey;
  /** Bind `aria-label` to a message key. */
  i18nAria?: MsgKey;
  attrs?: Readonly<Record<string, string>>;
}

/**
 * Minimal element factory. Builds DOM with createElement/textContent only, so it is safe under a
 * strict CSP (no innerHTML, no inline style attributes).
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.id) el.id = props.id;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.i18n) {
    el.setAttribute(I18N_ATTR.text, props.i18n);
    el.textContent = t(props.i18n);
  } else if (props.text !== undefined) {
    el.textContent = props.text;
  }
  if (props.i18nTitle) {
    el.setAttribute(I18N_ATTR.title, props.i18nTitle);
    el.title = t(props.i18nTitle);
  }
  if (props.i18nAria) {
    el.setAttribute(I18N_ATTR.aria, props.i18nAria);
    el.setAttribute('aria-label', t(props.i18nAria));
  }
  append(el, ...children);
  return el;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

export function clear(el: Node): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let uid = 0;
/** Unique DOM id with a readable prefix. */
export function uniqueId(prefix: string): string {
  uid += 1;
  return `${prefix}-${uid}`;
}
