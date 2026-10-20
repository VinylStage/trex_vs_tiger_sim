import {
  LIMITS,
  SAMPLING_METHODS,
  PACK_TACTICS,
  type SamplingMethod,
  type ScenarioConfig,
  type PackTactic,
} from '../sim/config';
import { PARAMS, type ParamDef, type ParamId, type Role, type Triangular } from '../sim/params';
import {
  HEAVY_SPECIES,
  HEAVY_SPECIES_IDS,
  PACK_SPECIES,
  PACK_SPECIES_IDS,
  matchupAnchor,
  matchupClass,
  paramBounds,
  paramEvidence,
  presetRange,
  speciesRanges,
  type Era,
  type HeavySpeciesId,
  type MatchupClass,
  type PackSpeciesId,
} from '../sim/species';
import { pagePath } from '../pages/routes';
import { costSummary, isCostOk } from './cost';
import { clear, h, uniqueId } from './dom';
import { formatDuration, formatNum } from './format';
import {
  getLang,
  paramHelp,
  paramLabel,
  speciesName,
  speciesVars,
  t,
  teamLabel,
  type MsgKey,
  type NamePair,
} from './i18n';

/** A matchup preset: both species, head counts and the run count. */
export interface Preset {
  heavySpecies: HeavySpeciesId;
  packSpecies: PackSpeciesId;
  heavyCount: number;
  packCount: number;
  runs: number;
}

/**
 * Matchup presets (docs/SPECIES.md). A preset sets the species, head counts and runs and resets
 * the ranges to the species' presets; every other setting is kept. The first is the default.
 */
export const PRESETS: readonly Preset[] = [
  { heavySpecies: 'trex', packSpecies: 'tiger', heavyCount: 10, packCount: 100, runs: 500 },
  { heavySpecies: 'trex', packSpecies: 'tiger', heavyCount: 1, packCount: 10, runs: 1000 },
  { heavySpecies: 'elephant', packSpecies: 'lion', heavyCount: 5, packCount: 30, runs: 500 },
  { heavySpecies: 'buffalo', packSpecies: 'lion', heavyCount: 1, packCount: 6, runs: 1000 },
  { heavySpecies: 'buffalo', packSpecies: 'hyena', heavyCount: 1, packCount: 15, runs: 1000 },
  { heavySpecies: 'brownBear', packSpecies: 'wolf', heavyCount: 1, packCount: 8, runs: 1000 },
  { heavySpecies: 'brownBear', packSpecies: 'tiger', heavyCount: 1, packCount: 1, runs: 2000 },
];

/** "10 T-Rex vs 100 tigers" / "T-Rex 10마리 vs 호랑이 100마리". */
export function matchupLabel(
  pair: NamePair & Pick<ScenarioConfig, 'heavyCount' | 'packCount'>,
): string {
  return `${teamLabel(pair.heavySpecies, pair.heavyCount)} vs ${teamLabel(pair.packSpecies, pair.packCount)}`;
}

export function presetLabel(p: Preset): string {
  const label = matchupLabel(p);
  return p === PRESETS[0] ? t('preset.default', { label }) : label;
}

type NumKey = keyof typeof LIMITS;

interface NumField {
  key: NumKey;
  step: number;
  int: boolean;
}

const NUM_FIELDS: Readonly<Record<NumKey, NumField>> = {
  heavyCount: { key: 'heavyCount', step: 1, int: true },
  packCount: { key: 'packCount', step: 1, int: true },
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

/** Full name of the species on one side, e.g. "African bush elephant". */
export function speciesLabel(role: Role, pair: NamePair): string {
  return speciesName(role === 'heavy' ? pair.heavySpecies : pair.packSpecies);
}

/** Parameter name including the species, e.g. "Lion · Sprint speed". */
export function qualifiedParamLabel(id: ParamId, pair: NamePair): string {
  const v = speciesVars(pair);
  const heavy = id.startsWith('heavy.');
  const weapon = HEAVY_SPECIES[pair.heavySpecies].weapon;
  return `${heavy ? v['Heavy'] : v['Pack']} · ${paramLabel(id, weapon)}`;
}

/** The matchup badge of a species pair: its class, text and a link to the field records. */
export function matchupInfo(pair: NamePair): {
  kind: MatchupClass;
  text: string;
  href: string | null;
} {
  const kind = matchupClass(pair.heavySpecies, pair.packSpecies);
  const anchor = matchupAnchor(pair.heavySpecies, pair.packSpecies);
  return {
    kind,
    text: t(`matchup.${kind}`),
    href: anchor ? `${pagePath('model', getLang())}#matchup-${anchor}` : null,
  };
}

/** The badge element (`.matchup-badge`), shared by the form and the results. */
export function matchupBadge(pair: NamePair): HTMLElement {
  const info = matchupInfo(pair);
  return h(
    'p',
    { class: `matchup-badge matchup-${info.kind}` },
    h('span', { class: 'matchup-dot', attrs: { 'aria-hidden': 'true' } }),
    h('span', { text: info.text }),
    info.href
      ? h('a', { class: 'matchup-link', text: t('matchup.sources'), attrs: { href: info.href } })
      : null,
  );
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

/** Whether any parameter of `role` differs from the presets of the config's species. */
export function roleEdited(c: ScenarioConfig, role?: Role): boolean {
  const presets = speciesRanges(c.heavySpecies, c.packSpecies);
  return PARAMS.some(
    (p) => (role === undefined || p.role === role) && !sameRange(c.params[p.id], presets[p.id]),
  );
}

/**
 * Switch one side to another species: that side's eleven ranges become the new species'
 * presets; the other side is kept.
 */
export function withSpecies(c: ScenarioConfig, role: Role, id: string): ScenarioConfig {
  const next: ScenarioConfig = structuredClone(c);
  if (role === 'heavy') next.heavySpecies = id as HeavySpeciesId;
  else next.packSpecies = id as PackSpeciesId;
  const presets = speciesRanges(next.heavySpecies, next.packSpecies);
  for (const p of PARAMS) if (p.role === role) next.params[p.id] = presets[p.id];
  return next;
}

/** Apply a matchup preset: species, counts and runs; all ranges back to the presets. */
export function withPreset(c: ScenarioConfig, p: Preset): ScenarioConfig {
  return {
    ...structuredClone(c),
    heavySpecies: p.heavySpecies,
    packSpecies: p.packSpecies,
    heavyCount: p.heavyCount,
    packCount: p.packCount,
    runs: p.runs,
    params: speciesRanges(p.heavySpecies, p.packSpecies),
  };
}

/**
 * What the form tells the user after correcting a typed value (WCAG 3.3.1/3.3.3: no silent
 * clamping): `null` when the value was taken as typed.
 */
export function correctionNote(
  typed: number | null,
  stored: number,
  [lo, hi]: readonly [number, number],
): string | null {
  const v = formatNum(stored, 6);
  if (typed === null) return t('clamp.empty', { value: v });
  if (typed === stored) return null;
  if (typed < lo || typed > hi) {
    return t('clamp.range', { min: formatNum(lo, 6), max: formatNum(hi, 6), value: v });
  }
  return t('clamp.integer', { value: v });
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

/** Where focus goes after a rebuild: a species picker or a preset chip (by index). */
type FocusTarget = { role: Role } | { preset: number };

/**
 * The inline notice after a change that discarded edited ranges. It stays until the next such
 * change, Undo or Dismiss (no timer, WCAG 2.2.1), right after the pickers and presets.
 */
interface Notice {
  message: string;
  undo?: { previous: ScenarioConfig; focus: FocusTarget };
}

export function createConfigForm(
  initial: ScenarioConfig,
  workers: number,
  onChange: (c: ScenarioConfig) => void,
): ConfigForm {
  let cfg: ScenarioConfig = structuredClone(initial);
  const root = h('form', { class: 'config-form', attrs: { novalidate: '' } });
  root.addEventListener('submit', (e) => e.preventDefault());

  const numInputs = new Map<NumKey, HTMLInputElement>();
  const paramInputs = new Map<ParamId, Record<keyof Triangular, HTMLInputElement>>();
  const paramRows = new Map<ParamId, HTMLTableRowElement>();
  const speciesSels = new Map<Role, HTMLSelectElement>();
  let samplingSel: HTMLSelectElement | null = null;
  let tacticSel: HTMLSelectElement | null = null;
  let moraleBox: HTMLInputElement | null = null;
  let costEl: HTMLParagraphElement | null = null;
  let modifiedEl: HTMLSpanElement | null = null;
  let detailsOpen = false;
  let notice: Notice | null = null;
  const presetBtns: HTMLButtonElement[] = [];

  /** Name placeholders of the edited config's species (the app's may name the shown results). */
  const names = (): Record<string, string> => speciesVars(cfg);

  const emit = (): void => {
    updateDerived();
    onChange(structuredClone(cfg));
  };

  function focusOn(target: FocusTarget): void {
    if ('role' in target) speciesSels.get(target.role)?.focus();
    else presetBtns[target.preset]?.focus();
  }

  /** Replace the whole config (species changes relabel everything) and keep focus in place. */
  function replace(next: ScenarioConfig, focus: FocusTarget, nextNotice: Notice | null): void {
    cfg = next;
    notice = nextNotice;
    build();
    focusOn(focus);
    emit();
  }

  function updateDerived(): void {
    if (costEl) {
      const cost = costSummary(cfg, workers);
      costEl.hidden = isCostOk(cost);
      costEl.className = `cost-warning cost-${cost.level === 'ok' ? 'heavy' : cost.level}`;
      const parts: string[] = [];
      if (cost.cap !== null) parts.push(t('cost.capped', { n: cost.cap.toLocaleString() }));
      if (cost.level !== 'ok') {
        const eta = formatDuration(cost.etaMs / 1000, 0);
        parts.push(t(cost.level === 'heavy' ? 'cost.heavy' : 'cost.extreme', { eta }));
      }
      costEl.textContent = parts.join(' ');
    }
    const presets = speciesRanges(cfg.heavySpecies, cfg.packSpecies);
    let modified = 0;
    for (const p of PARAMS) {
      const changed = !sameRange(cfg.params[p.id], presets[p.id]);
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
    if (tacticSel) tacticSel.value = cfg.packTactic;
    if (moraleBox) moraleBox.checked = cfg.morale;
    const heavySel = speciesSels.get('heavy');
    const packSel = speciesSels.get('pack');
    if (heavySel) heavySel.value = cfg.heavySpecies;
    if (packSel) packSel.value = cfg.packSpecies;
    for (const [id, inputs] of paramInputs) {
      const r = cfg.params[id];
      inputs.min.value = String(r.min);
      inputs.mode.value = String(r.mode);
      inputs.max.value = String(r.max);
    }
  }

  function field(
    label: string,
    help: string,
    control: HTMLElement,
    id: string,
    described: HTMLElement = control,
    note?: HTMLElement,
  ): HTMLElement {
    const hintId = `${id}-hint`;
    described.setAttribute('aria-describedby', note ? `${hintId} ${note.id}` : hintId);
    return h(
      'div',
      { class: 'field' },
      h('label', { attrs: { for: id }, text: label }),
      control,
      h('small', { class: 'hint', id: hintId, text: help }),
      note ?? null,
    );
  }

  /**
   * A polite live note under a field: why a typed value was corrected, or the allowed range while
   * the typed value is outside it (then the input is also aria-invalid). Empty notes take no space.
   */
  function noteFor(
    input: HTMLInputElement,
    id: string,
  ): (text: string | null, invalid: boolean) => HTMLElement {
    const note = h('small', { class: 'field-note', id, attrs: { 'aria-live': 'polite' } });
    const set = (text: string | null, invalid: boolean): HTMLElement => {
      if (note.textContent !== (text ?? '')) note.textContent = text ?? '';
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      return note;
    };
    return set;
  }

  function numberField(key: NumKey): { input: HTMLInputElement; id: string; note: HTMLElement } {
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
    const setNote = noteFor(input, `${id}-note`);
    const note = setNote(null, false);
    const normalise = (n: number): number => {
      const v = clamp(spec.int ? Math.round(n) : n, lo, hi);
      return key === 'seed' ? v >>> 0 : v;
    };
    input.addEventListener('input', () => {
      const n = parseNum(input.value);
      const bad = n !== null && (n < lo || n > hi || (spec.int && !Number.isInteger(n)));
      setNote(
        bad ? t('clamp.typing', { min: formatNum(lo, 6), max: formatNum(hi, 6) }) : null,
        bad,
      );
      if (n === null || bad) return;
      if (cfg[key] === n) return;
      cfg = { ...cfg, [key]: normalise(n) };
      emit();
    });
    input.addEventListener('change', () => {
      const n = parseNum(input.value);
      const v = n === null ? cfg[key] : normalise(n);
      setNote(correctionNote(n, v, [lo, hi]), false);
      input.value = String(v);
      if (cfg[key] !== v) {
        cfg = { ...cfg, [key]: v };
        emit();
      }
    });
    numInputs.set(key, input);
    return { input, id, note };
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

  /** Offer to undo a change that discarded edited ranges. */
  function buildNotice(): HTMLElement {
    const region = h('div', {
      class: 'undo-notice',
      attrs: { role: 'status', 'aria-live': 'polite' },
    });
    const n = notice;
    if (!n) {
      region.hidden = true;
      return region;
    }
    region.append(h('span', { class: 'undo-text', text: n.message }));
    const undo = n.undo;
    if (undo) {
      const undoBtn = h('button', {
        class: 'btn btn-small',
        text: t('toast.undo'),
        attrs: { type: 'button' },
      });
      undoBtn.addEventListener('click', () => {
        replace(undo.previous, undo.focus, { message: t('toast.restored') });
      });
      const dismiss = h('button', {
        class: 'btn btn-small btn-ghost',
        text: t('toast.dismiss'),
        attrs: { type: 'button' },
      });
      dismiss.addEventListener('click', () => {
        notice = null;
        region.hidden = true;
        clear(region);
        focusOn(undo.focus);
      });
      region.append(undoBtn, dismiss);
    }
    return region;
  }

  function speciesField(role: Role): HTMLElement {
    const id = uniqueId(`f-${role}-species`);
    const el = h('select', { id, class: 'species-select' });
    const ids: readonly string[] = role === 'heavy' ? HEAVY_SPECIES_IDS : PACK_SPECIES_IDS;
    const eraOf = (s: string): Era =>
      role === 'heavy'
        ? HEAVY_SPECIES[s as HeavySpeciesId].era
        : PACK_SPECIES[s as PackSpeciesId].era;
    for (const group of ['extant', 'extinct'] as const) {
      const members = ids.filter((s) => (eraOf(s) === 'extant') === (group === 'extant'));
      if (members.length === 0) continue;
      const og = h('optgroup', { attrs: { label: t(`species.group.${group}`) } });
      for (const s of members) {
        og.append(
          h('option', {
            attrs: { value: s },
            text: speciesName(s as HeavySpeciesId | PackSpeciesId),
          }),
        );
      }
      el.append(og);
    }
    el.value = role === 'heavy' ? cfg.heavySpecies : cfg.packSpecies;
    el.addEventListener('change', () => {
      if (!ids.includes(el.value)) return;
      const previous = structuredClone(cfg);
      const edited = roleEdited(previous, role);
      const next = withSpecies(previous, role, el.value);
      const name = speciesName(role === 'heavy' ? next.heavySpecies : next.packSpecies);
      const focus = { role };
      replace(
        next,
        focus,
        edited ? { message: t('toast.rangesReset', { name }), undo: { previous, focus } } : null,
      );
    });
    speciesSels.set(role, el);
    const label = t(role === 'heavy' ? 'field.heavySpecies' : 'field.packSpecies');
    const help = t(role === 'heavy' ? 'help.heavySpecies' : 'help.packSpecies');
    return field(label, help, el, id);
  }

  function buildSpecies(): HTMLElement {
    return h(
      'div',
      { class: 'species-pickers' },
      h('div', { class: 'species-grid' }, speciesField('heavy'), speciesField('pack')),
      matchupBadge(cfg),
    );
  }

  function buildBasic(): HTMLElement {
    const grid = h('div', { class: 'field-grid' });
    const nv = names();
    const add = (key: NumKey, label: MsgKey, help: MsgKey, tour?: string): void => {
      const { input, id, note } = numberField(key);
      const el = field(t(label, nv), t(help, nv), input, id, input, note);
      if (tour) el.dataset.tour = tour;
      grid.append(el);
    };
    add('heavyCount', 'field.heavyCount', 'help.heavyCount', 'counts');
    add('packCount', 'field.packCount', 'help.packCount', 'counts');
    add('runs', 'field.runs', 'help.runs', 'runs');
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
    grid.append(field(t('field.sampling'), t('help.sampling'), sampling.el, sampling.id));

    const tactic = select<PackTactic>(
      PACK_TACTICS,
      (v) => (v === 'flank' ? 'tactic.flank' : 'tactic.direct'),
      cfg.packTactic,
      (v) => {
        cfg = { ...cfg, packTactic: v };
        emit();
      },
    );
    tacticSel = tactic.el;
    grid.append(field(t('field.packTactic'), t('help.packTactic', nv), tactic.el, tactic.id));

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
      seed.note.textContent = '';
      seed.input.removeAttribute('aria-invalid');
      emit();
    });
    const seedRow = h('div', { class: 'input-row' }, seed.input, randomBtn);
    const seedField = field(
      t('field.seed'),
      t('help.seed'),
      seedRow,
      seed.id,
      seed.input,
      seed.note,
    );
    seedField.classList.add('field-wide');
    seedField.dataset.tour = 'seed';
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
        h('small', { class: 'hint', id: `${moraleId}-hint`, text: t('help.morale', nv) }),
      ),
    );
    return grid;
  }

  function buildPresets(): HTMLElement {
    const group = h('div', { class: 'preset-buttons', attrs: { role: 'group' } });
    const labelId = uniqueId('presets');
    group.setAttribute('aria-labelledby', labelId);
    for (const [index, p] of PRESETS.entries()) {
      const label = presetLabel(p);
      const btn = h('button', { class: 'btn btn-chip', text: label, attrs: { type: 'button' } });
      presetBtns.push(btn);
      btn.addEventListener('click', () => {
        const previous = structuredClone(cfg);
        const focus = { preset: index };
        const message = t('toast.presetApplied', { label: matchupLabel(p) });
        replace(
          withPreset(previous, p),
          focus,
          roleEdited(previous) ? { message, undo: { previous, focus } } : null,
        );
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

  function evidenceChip(p: ParamDef): HTMLElement {
    const tag = paramEvidence(p.id, cfg.heavySpecies, cfg.packSpecies);
    const title = t(`evidence.${tag}`);
    return h('span', {
      class: `evidence ev-${tag}`,
      text: tag,
      attrs: { role: 'img', title, 'aria-label': t('evidence.aria', { tag: title }) },
    });
  }

  function paramRow(p: ParamDef): HTMLTableRowElement {
    const weapon = HEAVY_SPECIES[cfg.heavySpecies].weapon;
    const label = paramLabel(p.id, weapon);
    const name = `${speciesLabel(p.role, cfg)} ${label}`;
    const helpId = uniqueId('ph');
    const noteId = `${helpId}-note`;
    const note = h('small', { class: 'field-note', id: noteId, attrs: { 'aria-live': 'polite' } });
    const inputs = {} as Record<keyof Triangular, HTMLInputElement>;
    const bounds = paramBounds(p.id, cfg.heavySpecies, cfg.packSpecies);
    const cells: HTMLTableCellElement[] = [];
    for (const which of ['min', 'mode', 'max'] as const) {
      const input = h('input', {
        class: 'param-input',
        attrs: {
          type: 'number',
          inputmode: 'decimal',
          min: String(bounds[0]),
          max: String(bounds[1]),
          step: String(p.step),
          'aria-label': t('advanced.inputAria', { name, which: t(`advanced.${which}`) }),
          'aria-describedby': `${helpId} ${noteId}`,
        },
      });
      input.value = String(cfg.params[p.id][which]);
      input.addEventListener('change', () => {
        const n = parseNum(input.value);
        const current = cfg.params[p.id];
        const next = n === null ? current : orderRange(current, which, n, bounds);
        const parts = [correctionNote(n, next[which], bounds)];
        const others = (['min', 'mode', 'max'] as const).filter((k) => k !== which);
        if (n !== null && others.some((k) => next[k] !== current[k])) parts.push(t('clamp.order'));
        note.textContent = parts.filter((x) => x !== null).join(' ');
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
      const preset = presetRange(p.id, cfg.heavySpecies, cfg.packSpecies);
      cfg = { ...cfg, params: { ...cfg.params, [p.id]: preset } };
      syncInputs();
      emit();
    });
    const row = h(
      'tr',
      { class: 'param-row' },
      h(
        'th',
        { attrs: { scope: 'row' }, class: 'col-name' },
        h('span', { class: 'param-name', text: label }),
        ' ',
        evidenceChip(p),
        h('small', { class: 'param-help', id: helpId, text: paramHelp(p.id, names()) }),
        note,
      ),
      ...cells,
      h('td', { class: 'col-unit', text: unitLabel(p.unit) }),
      h('td', { class: 'col-reset' }, reset),
    );
    paramRows.set(p.id, row);
    return row;
  }

  /**
   * The advanced parameter table (22 rows, 66 inputs) is built when the section is first opened,
   * not with the rest of the form: most visits never open it, and building it was the largest part
   * of the start-up and language-switch work (docs/PERFORMANCE.md).
   */
  function buildAdvanced(): HTMLDetailsElement {
    const details = h('details', { class: 'advanced', attrs: { 'data-tour': 'advanced' } });
    modifiedEl = h('span', { class: 'badge' });
    const summary = h('summary', {}, h('span', { text: t('advanced.title') }), ' ', modifiedEl);
    details.append(summary);
    let filled = false;
    const fill = (): void => {
      if (filled) return;
      filled = true;
      details.append(...advancedBody());
      updateDerived();
    };
    details.open = detailsOpen;
    if (detailsOpen) fill();
    details.addEventListener('toggle', () => {
      detailsOpen = details.open;
      if (details.open) fill();
    });
    return details;
  }

  function advancedBody(): HTMLElement[] {
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
    for (const role of ['heavy', 'pack'] as const) {
      const body = h(
        'tbody',
        {},
        h(
          'tr',
          { class: 'group-row' },
          h('th', {
            attrs: { scope: 'colgroup', colspan: '6' },
            text: speciesLabel(role, cfg),
          }),
        ),
      );
      for (const p of PARAMS) if (p.role === role) body.append(paramRow(p));
      table.append(body);
    }
    const resetAll = h('button', {
      class: 'btn btn-small',
      text: t('advanced.resetAll'),
      attrs: { type: 'button' },
    });
    resetAll.addEventListener('click', () => {
      cfg = { ...cfg, params: speciesRanges(cfg.heavySpecies, cfg.packSpecies) };
      syncInputs();
      emit();
    });
    return [
      h('p', { class: 'hint', text: t('advanced.intro') }),
      h('div', { class: 'table-wrap' }, table),
      h('div', { class: 'advanced-actions' }, resetAll),
    ];
  }

  function build(): void {
    clear(root);
    numInputs.clear();
    paramInputs.clear();
    paramRows.clear();
    speciesSels.clear();
    presetBtns.length = 0;
    costEl = h('p', { class: 'cost-warning', attrs: { role: 'status' } });
    root.append(
      h(
        'div',
        { class: 'matchup', attrs: { 'data-tour': 'presets' } },
        buildSpecies(),
        buildPresets(),
        buildNotice(),
      ),
      buildBasic(),
      costEl,
      buildAdvanced(),
    );
    updateDerived();
  }

  build();

  return {
    el: root,
    setConfig(c: ScenarioConfig): void {
      const relabel = c.heavySpecies !== cfg.heavySpecies || c.packSpecies !== cfg.packSpecies;
      cfg = structuredClone(c);
      if (relabel) build();
      else syncInputs();
      updateDerived();
    },
    refresh(): void {
      build();
    },
  };
}
