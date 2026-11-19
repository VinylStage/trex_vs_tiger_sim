// History rows of the release check (docs/PERFORMANCE.md, "Release check" and "History"): turns a
// bench run, the page sizes and the Chromium checks into the two rows a release adds, and into the
// markdown summary of the release workflow. Pure functions; bench/release-report.mjs is the CLI.

/** ms in the style of the History table: 0.42, 30.3, 660, 6,367. */
export function fmtHistMs(x) {
  if (!Number.isFinite(x)) return '–';
  if (x >= 1000) return Math.round(x).toLocaleString('en-US');
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

export const fmtHistKb = (bytes) =>
  Number.isFinite(bytes) ? `${(bytes / 1024).toFixed(1)} KB` : '–';

/** "4 x Intel(R) Xeon(R) Processor @ 2.10GHz" and "v22.22.0" → "4 × Intel Xeon @ 2.10GHz, Node 22.22.0". */
export function machineOf(cpu, node) {
  const [count, ...rest] = String(cpu).split(' x ');
  const model = rest
    .join(' x ')
    .replace(/\((?:R|TM)\)/g, '')
    .replace(/\b(?:Processor|CPU)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${count} × ${model}, Node ${String(node).replace(/^v/, '')}`;
}

const SCALE_IDS = ['scale-1v1', 'scale-10v100', 'scale-50v1000', 'scale-500v5000'];

/** The preset row with the highest median ms/run, as "`id` `flight`, ms". */
export function slowestPreset(results) {
  const presets = results.filter((r) => r.group === 'preset');
  if (presets.length === 0) return '–';
  const top = presets.reduce((a, b) => (b.msMedian > a.msMedian ? b : a));
  const id = top.id.replace(/^preset-/, '').replace(new RegExp(`-${top.flight}$`), '');
  return `\`${id}\` \`${top.flight}\`, ${fmtHistMs(top.msMedian)}`;
}

/** A fixed-point number, or a dash when it is missing. */
const fx = (x, digits) => (Number.isFinite(x) ? x.toFixed(digits) : '–');
/** Whole milliseconds with thousands separators, or a dash. */
const ms0 = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '–');

const pageBytes = (size, page) => size?.pages?.find((p) => p.page === page)?.gzipBytes ?? NaN;
const cell = (s) => String(s).replace(/\|/g, '\\|');

/**
 * The engine row (the History table's columns): version, commit, date, model, matrix hash, the
 * scale ladder, the slowest preset, `/play/` startup JavaScript, the machine and a note.
 */
export function engineRow(bench, size, { commit, note = '' } = {}) {
  if (bench.matrix !== 'full' || bench.only !== null) {
    throw new Error('a History row needs a full-matrix run (no --reduced, no --only)');
  }
  const byId = new Map(bench.results.map((r) => [r.id, r]));
  const ladder = SCALE_IDS.map((id) => fmtHistMs(byId.get(id)?.msMedian ?? NaN)).join(' / ');
  return `| ${[
    bench.version,
    `\`${(commit ?? bench.commit).slice(0, 7)}\``,
    bench.date.slice(0, 10),
    bench.mv,
    `\`${bench.hash}\``,
    ladder,
    slowestPreset(bench.results),
    fmtHistKb(pageBytes(size, 'play/index.html')),
    machineOf(bench.cpu, bench.node),
    cell(note),
  ].join(' | ')} |`;
}

/**
 * The browser row: Run to verdict and its long tasks, result CLS at both viewports, startup long
 * tasks at 4x CPU, replay frame time p95 at 1x and 16x, and the browser.
 */
export function browserRow(browser, { version, note = '' } = {}) {
  const r = browser.run;
  const s = browser.startup;
  return `| ${[
    version ?? browser.version,
    browser.date.slice(0, 10),
    ms0(r.verdictMs),
    `${r.longTaskCount} / ${ms0(r.longestTaskMs)}`,
    `${fx(browser.cls.desktop, 4)} / ${fx(browser.cls.mobile, 4)}`,
    `${s.longTaskCount} / ${ms0(s.longTaskTotalMs)} / ${ms0(s.longestTaskMs)}`,
    `${fx(browser.replay.x1P95Ms, 1)} / ${fx(browser.replay.x16P95Ms, 1)}`,
    browser.browser,
    cell(note),
  ].join(' | ')} |`;
}

/** The markdown summary of the release workflow: both rows ready to paste, then the details. */
export function releaseSummary({ bench, size, browser, commit, note = '' }) {
  const out = [`## Release check, ${bench.version}`, ''];
  out.push(
    `Full matrix: ${bench.results.length} scenarios, ${bench.passes} pass(es), ` +
      `${(bench.totalMs / 1000).toFixed(0)} s, matrix hash \`${bench.hash}\`, model ${bench.mv}, ` +
      `${machineOf(bench.cpu, bench.node)}.`,
    '',
    'History rows for `docs/PERFORMANCE.md` (engine table, then browser table):',
    '',
    '```markdown',
    engineRow(bench, size, { commit, note }),
  );
  if (browser) out.push(browserRow(browser, { version: bench.version, note }));
  out.push('```', '');

  const over = (size?.pages ?? []).filter((p) => p.status !== 'ok');
  out.push('### Page JavaScript (gzip)', '');
  if (over.length === 0) out.push('Every budgeted page is within its budget.', '');
  for (const p of over) {
    out.push(
      `- **${p.status}**: \`${p.page}\` ${fmtHistKb(p.gzipBytes)}` +
        (p.budget === null ? '' : ` (budget ${fmtHistKb(p.budget)})`),
    );
  }
  if (over.length > 0) out.push('');

  out.push(
    '### Slowest scenarios (ms/run, median)',
    '',
    '| Scenario | Median | p95 |',
    '| --- | ---: | ---: |',
  );
  for (const r of [...bench.results].sort((a, b) => b.msMedian - a.msMedian).slice(0, 8)) {
    out.push(`| \`${r.id}\` | ${fmtHistMs(r.msMedian)} | ${fmtHistMs(r.msP95)} |`);
  }
  out.push('');

  if (browser) {
    const r = browser.run;
    const s = browser.startup;
    out.push(
      `### Chromium (${browser.browser}, median of ${browser.samples})`,
      '',
      '| Check | Value |',
      '| --- | --- |',
      `| Run to verdict, \`${r.preset}\`, 1366×900 | ${ms0(r.verdictMs)} ms |`,
      `| Long tasks > 50 ms, Run to 1 s after verdict | ${r.longTaskCount} (total ${ms0(r.longTaskTotalMs)} ms, longest ${ms0(r.longestTaskMs)} ms) |`,
      `| CLS on first result render, 1366×900 / 390×800 | ${fx(browser.cls.desktop, 4)} / ${fx(browser.cls.mobile, 4)} |`,
      `| Startup long tasks, \`${s.page}\`, 412×915, 4x CPU, first 4 s | ${s.longTaskCount} (total ${ms0(s.longTaskTotalMs)} ms, longest ${ms0(s.longestTaskMs)} ms) |`,
      `| Replay frame interval p95 (max), \`${browser.replay.preset}\`, 1x | ${fx(browser.replay.x1P95Ms, 1)} ms (${fx(browser.replay.x1MaxMs, 1)} ms) |`,
      `| Replay frame interval p95 (max), 16x | ${fx(browser.replay.x16P95Ms, 1)} ms (${fx(browser.replay.x16MaxMs, 1)} ms) |`,
      '',
    );
  }
  return out.join('\n');
}
