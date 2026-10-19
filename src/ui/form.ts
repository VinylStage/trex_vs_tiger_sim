import {
  LIMITS,
  SAMPLING_METHODS,
  TIGER_TACTICS,
  defaultConfig,
  maxRunsFor,
  type SamplingMethod,
  type ScenarioConfig,
  type TigerTactic,
} from '../sim/config';
import { PARAMS, type ParamDef, type ParamId, type Species, type Triangular } from '../sim/params';
import { costLevel, estimateTotalMs } from './cost';
import { clear, h, uniqueId } from './dom';
import { formatDuration } from './format';
import { paramHelp, paramLabel, t, type MsgKey } from './i18n';

export interface Preset {
  key: MsgKey;
  trexCount: number;
  tigerCount: number;
  runs: number;
}

/** Presets change head counts and the run count only; everything else is kept. */
export const PRESETS: readonly Preset[] = [
  { key: 'preset.default', trexCount: 10, tigerCount: 100, runs: 500 },
  { key: 'preset.1v100', trexCount: 1, tigerCount: 100, runs: 500 },
  { key: 'preset.1v10', trexCount: 1, tigerCount: 10, runs: 1000 },
  { key: 'preset.10v1000', trexCount: 10, tigerCount: 1000, runs: 200 },
  { key: 'preset.1v1', trexCount: 1, tigerCount: 1, runs: 2000 },
];

type NumKey = keyof typeof LIMITS;

interface NumField {
  key: NumKey;
  step: number;
  int: boolean;
}

const NUM_FIELDS: Readonly<Record<NumKey, NumField>> = {
  trexCount: { key: 'trexCount', step: 1, int: true },
  tigerCount: { key: 'tigerCount', step: 1, int: true },
  runs: { key: 'runs', step: 1, int: true },
  seed: { key: 'seed', step: 1, int: true },
  arenaSize: { key: 'arenaSize', step: 50, int: false },
  maxTime: { key: 'maxTime', step: 30, int: false },
  individualCV: { key: 'individualCV', step: 0.01, int: false },
};

const UNIT_DISPLAY: Readonly<Record<string, string>> = {
  'deg/s': '°/s',
  deg: '°',
  p: '0–1',
  '0-1': '0–1',
};

export function unitLabel(unit: string): string {
  return UNIT_DISPLAY[unit] ?? unit;
}

export function speciesLabel(s: Species): string {
  return t(s === 'trex' ? 'species.trex' : 'species.tiger');
}

/** Parameter name including the species, e.g. "Tiger · Sprint speed". */
export function qualifiedParamLabel(id: ParamId): string {
  const species: Species = id.startsWith('trex.') ? 'trex' : 'tiger';
  return `${species === 'trex' ? 'T-Rex' : t('species.tiger')} · ${paramLabel(id)}`;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function parseNum(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sameRange(a: Triangular, b: Triangular): boolean {
  return a.min === b.min && a.mode === b.mode && a.max === b.max;
}

/** Keep `min ≤ mode ≤ max` while honouring the field the user just edited. */
export function orderRange(
  r: Triangular,
  edited: keyof Triangular,
  value: number,
  bounds: readonly [number, number],
): Triangular {
  const v = clamp(value, bounds[0], bounds[1]);
  const out = { ...r, [edited]: v };
  if (edited === 'min') {
    out.mode = Math.max(out.mode, v);
    out.max = Math.max(out.max, out.mode);
  } else if (edited === 'max') {
    out.mode = Math.min(out.mode, v);
    out.min = Math.min(out.min, out.mode);
  } else {
    out.min = Math.min(out.min, v);
    out.max = Math.max(out.max, v);
  }
  return out;
}

export interface ConfigForm {
  readonly el: HTMLElement;
  /** Replace the edited config (e.g. from a pasted URL) without emitting a change. */
  setConfig(c: ScenarioConfig): void;
  /** Rebuild labels after a language change. */
  refresh(): void;
}

export function createConfigForm(
  initial: ScenarioConfig,
  workers: number,
  onChange: (c: ScenarioConfig) => void,
): ConfigForm {
  let cfg: ScenarioConfig = structuredClone(initial);
  const defaults = defaultConfig();
  const root = h('form', { class: 'config-form', attrs: { novalidate: '' } });
  root.addEventListener('submit', (e) => e.preventDefault());

  const numInputs = new Map<NumKey, HTMLInputElement>();
  const paramInputs = new Map<ParamId, Record<keyof Triangular, HTMLInputElement>>();
  const paramRows = new Map<ParamId, HTMLTableRowElement>();
  let samplingSel: HTMLSelectElement | null = null;
  let tacticSel: HTMLSelectElement | null = null;
  let moraleBox: HTMLInputElement | null = null;
  let costEl: HTMLParagraphElement | null = null;
  let modifiedEl: HTMLSpanElement | null = null;
  let detailsOpen = false;

  const emit = (): void => {
    updateDerived();
    onChange(structuredClone(cfg));
  };

  function updateDerived(): void {
    if (costEl) {
      const cap = maxRunsFor(cfg);
      const capped = cfg.runs > cap;
      const effective = capped ? { ...cfg, runs: cap } : cfg;
      const level = costLevel(effective, workers);
      costEl.hidden = level === 'ok' && !capped;
      costEl.className = `cost-warning cost-${level === 'ok' ? 'heavy' : level}`;
      const parts: string[] = [];
      if (capped) parts.push(t('cost.capped', { n: cap.toLocaleString() }));
      if (level !== 'ok') {
        const eta = formatDuration(estimateTotalMs(effective, workers) / 1000, 0);
        parts.push(t(level === 'heavy' ? 'cost.heavy' : 'cost.extreme', { eta }));
      }
      costEl.textContent = parts.join(' ');
    }
    let modified = 0;
    for (const p of PARAMS) {
      const changed = !sameRange(cfg.params[p.id], defaults.params[p.id]);
      if (changed) modified++;
      paramRows.get(p.id)?.classList.toggle('modified', changed);
    }
    if (modifiedEl) {
      modifiedEl.hidden = modified === 0;
      modifiedEl.textContent = t('advanced.modified', { n: modified });
    }
  }

  function syncInputs(): void {
    for (const [key, input] of numInputs) input.value = String(cfg[key]);
    if (samplingSel) samplingSel.value = cfg.sampling;
    if (tacticSel) tacticSel.value = cfg.tigerTactic;
    if (moraleBox) moraleBox.checked = cfg.morale;
    for (const [id, inputs] of paramInputs) {
      const r = cfg.params[id];
      inputs.min.value = String(r.min);
      inputs.mode.value = String(r.mode);
      inputs.max.value = String(r.max);
    }
  }

  function field(
    labelKey: MsgKey,
    helpKey: MsgKey,
    control: HTMLElement,
    id: string,
    described: HTMLElement = control,
  ): HTMLElement {
    const hintId = `${id}-hint`;
    described.setAttribute('aria-describedby', hintId);
    return h(
      'div',
      { class: 'field' },
      h('label', { attrs: { for: id }, text: t(labelKey) }),
      control,
      h('small', { class: 'hint', id: hintId, text: t(helpKey) }),
    );
  }

  function numberField(key: NumKey): { input: HTMLInputElement; id: string } {
    const spec = NUM_FIELDS[key];
    const [lo, hi] = LIMITS[key];
    const id = uniqueId(`f-${key}`);
    const input = h('input', {
      id,
      attrs: {
        type: 'number',
        inputmode: spec.int ? 'numeric' : 'decimal',
        min: String(lo),
        max: String(hi),
        step: String(spec.step),
        required: '',
      },
    });
    input.value = String(cfg[key]);
    const normalise = (n: number): number => {
      const v = clamp(spec.int ? Math.round(n) : n, lo, hi);
      return key === 'seed' ? v >>> 0 : v;
    };
    input.addEventListener('input', () => {
      const n = parseNum(input.value);
      if (n === null || n < lo || n > hi || (spec.int && !Number.isInteger(n))) return;
      if (cfg[key] === n) return;
      cfg = { ...cfg, [key]: normalise(n) };
      emit();
    });
    input.addEventListener('change', () => {
      const n = parseNum(input.value);
      const v = n === null ? cfg[key] : normalise(n);
      input.value = String(v);
      if (cfg[key] !== v) {
        cfg = { ...cfg, [key]: v };
        emit();
      }
    });
    numInputs.set(key, input);
    return { input, id };
  }

  function select<T extends string>(
    values: readonly T[],
    labelOf: (v: T) => MsgKey,
    current: T,
    onPick: (v: T) => void,
  ): { el: HTMLSelectElement; id: string } {
    const id = uniqueId('f-sel');
    const el = h('select', { id });
    for (const v of values) el.append(h('option', { attrs: { value: v }, text: t(labelOf(v)) }));
    el.value = current;
    el.addEventListener('change', () => {
      const v = values.find((x) => x === el.value);
      if (v !== undefined) onPick(v);
    });
    return { el, id };
  }

  function buildBasic(): HTMLElement {
    const grid = h('div', { class: 'field-grid' });
    const add = (key: NumKey, label: MsgKey, help: MsgKey): void => {
      const { input, id } = numberField(key);
      grid.append(field(label, help, input, id));
    };
    add('trexCount', 'field.trexCount', 'help.trexCount');
    add('tigerCount', 'field.tigerCount', 'help.tigerCount');
    add('runs', 'field.runs', 'help.runs');
    add('maxTime', 'field.maxTime', 'help.maxTime');
    add('arenaSize', 'field.arenaSize', 'help.arenaSize');
    add('individualCV', 'field.individualCV', 'help.individualCV');

    const sampling = select<SamplingMethod>(
      SAMPLING_METHODS,
      (v) => (v === 'lhs' ? 'sampling.lhs' : 'sampling.random'),
      cfg.sampling,
      (v) => {
        cfg = { ...cfg, sampling: v };
        emit();
      },
    );
    samplingSel = sampling.el;
    grid.append(field('field.sampling', 'help.sampling', sampling.el, sampling.id));

    const tactic = select<TigerTactic>(
      TIGER_TACTICS,
      (v) => (v === 'flank' ? 'tactic.flank' : 'tactic.direct'),
      cfg.tigerTactic,
      (v) => {
        cfg = { ...cfg, tigerTactic: v };
        emit();
      },
    );
    tacticSel = tactic.el;
    grid.append(field('field.tigerTactic', 'help.tigerTactic', tactic.el, tactic.id));

    const seed = numberField('seed');
    const randomBtn = h('button', {
      class: 'btn btn-small',
      text: t('seed.randomize'),
      attrs: { type: 'button', 'aria-label': t('seed.randomizeAria') },
    });
    randomBtn.addEventListener('click', () => {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      cfg = { ...cfg, seed: (buf[0] ?? 0) >>> 0 };
      seed.input.value = String(cfg.seed);
      emit();
    });
    const seedRow = h('div', { class: 'input-row' }, seed.input, randomBtn);
    const seedField = field('field.seed', 'help.seed', seedRow, seed.id, seed.input);
    seedField.classList.add('field-wide');
    grid.append(seedField);

    const moraleId = uniqueId('f-morale');
    const box = h('input', {
      id: moraleId,
      attrs: { type: 'checkbox', 'aria-describedby': `${moraleId}-hint` },
    });
    box.checked = cfg.morale;
    box.addEventListener('change', () => {
      cfg = { ...cfg, morale: box.checked };
      emit();
    });
    moraleBox = box;
    grid.append(
      h(
        'div',
        { class: 'field field-wide' },
        h('span', { class: 'field-label', text: t('field.morale') }),
        h(
          'label',
          { class: 'check', attrs: { for: moraleId } },
          box,
          h('span', { text: t('morale.on') }),
        ),
        h('small', { class: 'hint', id: `${moraleId}-hint`, text: t('help.morale') }),
      ),
    );
    return grid;
  }

  function buildPresets(): HTMLElement {
    const group = h('div', { class: 'preset-buttons', attrs: { role: 'group' } });
    const labelId = uniqueId('presets');
    group.setAttribute('aria-labelledby', labelId);
    for (const p of PRESETS) {
      const btn = h('button', { class: 'btn btn-chip', text: t(p.key), attrs: { type: 'button' } });
      btn.addEventListener('click', () => {
        cfg = { ...cfg, trexCount: p.trexCount, tigerCount: p.tigerCount, runs: p.runs };
        syncInputs();
        emit();
      });
      group.append(btn);
    }
    return h(
      'div',
      { class: 'presets' },
      h('span', { class: 'field-label', id: labelId, text: t('config.presets') }),
      group,
      h('small', { class: 'hint', text: t('preset.hint') }),
    );
  }

  function paramRow(p: ParamDef): HTMLTableRowElement {
    const name = `${speciesLabel(p.species)} ${paramLabel(p.id)}`;
    const helpId = uniqueId('ph');
    const inputs = {} as Record<keyof Triangular, HTMLInputElement>;
    const cells: HTMLTableCellElement[] = [];
    for (const which of ['min', 'mode', 'max'] as const) {
      const input = h('input', {
        class: 'param-input',
        attrs: {
          type: 'number',
          inputmode: 'decimal',
          min: String(p.bounds[0]),
          max: String(p.bounds[1]),
          step: String(p.step),
          'aria-label': t('advanced.inputAria', { name, which: t(`advanced.${which}`) }),
          'aria-describedby': helpId,
        },
      });
      input.value = String(cfg.params[p.id][which]);
      input.addEventListener('change', () => {
        const n = parseNum(input.value);
        const current = cfg.params[p.id];
        const next = n === null ? current : orderRange(current, which, n, p.bounds);
        cfg = { ...cfg, params: { ...cfg.params, [p.id]: next } };
        inputs.min.value = String(next.min);
        inputs.mode.value = String(next.mode);
        inputs.max.value = String(next.max);
        if (!sameRange(current, next)) emit();
      });
      inputs[which] = input;
      cells.push(
        h('td', { class: `col-${which}`, attrs: { 'data-label': t(`advanced.${which}`) } }, input),
      );
    }
    paramInputs.set(p.id, inputs);
    const reset = h('button', {
      class: 'btn btn-icon',
      text: '↺',
      attrs: {
        type: 'button',
        'aria-label': t('advanced.resetRowAria', { name }),
        title: t('advanced.resetRowAria', { name }),
      },
    });
    reset.addEventListener('click', () => {
      cfg = { ...cfg, params: { ...cfg.params, [p.id]: { ...p.default } } };
      syncInputs();
      emit();
    });
    const row = h(
      'tr',
      { class: 'param-row' },
      h(
        'th',
        { attrs: { scope: 'row' }, class: 'col-name' },
        h('span', { class: 'param-name', text: paramLabel(p.id) }),
        h('small', { class: 'param-help', id: helpId, text: paramHelp(p.id) }),
      ),
      ...cells,
      h('td', { class: 'col-unit', text: unitLabel(p.unit) }),
      h('td', { class: 'col-reset' }, reset),
    );
    paramRows.set(p.id, row);
    return row;
  }

  function buildAdvanced(): HTMLDetailsElement {
    const details = h('details', { class: 'advanced' });
    details.open = detailsOpen;
    details.addEventListener('toggle', () => {
      detailsOpen = details.open;
    });
    modifiedEl = h('span', { class: 'badge' });
    const summary = h('summary', {}, h('span', { text: t('advanced.title') }), ' ', modifiedEl);
    const head = h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { attrs: { scope: 'col' }, text: t('advanced.param') }),
        h('th', { attrs: { scope: 'col' }, text: t('advanced.min') }),
        h('th', { attrs: { scope: 'col' }, text: t('advanced.mode') }),
        h('th', { attrs: { scope: 'col' }, text: t('advanced.max') }),
        h('th', { attrs: { scope: 'col' }, text: t('advanced.unit') }),
        h('th', { attrs: { scope: 'col' }, class: 'visually-hidden', text: t('advanced.reset') }),
      ),
    );
    const table = h('table', { class: 'param-table' }, head);
    for (const species of ['trex', 'tiger'] as const) {
      const body = h(
        'tbody',
        {},
        h(
          'tr',
          { class: 'group-row' },
          h('th', { attrs: { scope: 'colgroup', colspan: '6' }, text: speciesLabel(species) }),
        ),
      );
      for (const p of PARAMS) if (p.species === species) body.append(paramRow(p));
      table.append(body);
    }
    const resetAll = h('button', {
      class: 'btn btn-small',
      text: t('advanced.resetAll'),
      attrs: { type: 'button' },
    });
    resetAll.addEventListener('click', () => {
      cfg = { ...cfg, params: structuredClone(defaults.params) };
      syncInputs();
      emit();
    });
    details.append(
      summary,
      h('p', { class: 'hint', text: t('advanced.intro') }),
      h('div', { class: 'table-wrap' }, table),
      h('div', { class: 'advanced-actions' }, resetAll),
    );
    return details;
  }

  function build(): void {
    clear(root);
    numInputs.clear();
    paramInputs.clear();
    paramRows.clear();
    costEl = h('p', { class: 'cost-warning', attrs: { role: 'status' } });
    root.append(buildPresets(), buildBasic(), costEl, buildAdvanced());
    updateDerived();
  }

  build();

  return {
    el: root,
    setConfig(c: ScenarioConfig): void {
      cfg = structuredClone(c);
      syncInputs();
      updateDerived();
    },
    refresh(): void {
      build();
    },
  };
}
