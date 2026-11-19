// Chromium checks of the release check (docs/PERFORMANCE.md, "Release check").
//
//   npx vite preview --port 4173 --strictPort &
//   PLAYWRIGHT_DIR=<dir> node bench/browser.mjs [--url http://localhost:4173] [--out <file.json>]
//                                               [--samples 3]
//
// Playwright is not a dependency of this project. The script loads it from PLAYWRIGHT_DIR (or
// `--playwright`), a directory whose node_modules holds it, for example one made with
// `npm install --prefix <dir> --no-save playwright@<version>`; the release workflow does exactly
// that with a pinned version. It measures the built site served by `vite preview`:
//
//   run      long tasks > 50 ms from the click on Run until 1 s after the verdict, one mid-size
//            preset in Simple mode, 1366x900, no throttling; and the time to the verdict
//   cls      layout shift without recent input in the same window (the first result render),
//            at 1366x900 and 390x800
//   startup  long tasks in the first 4 s after navigating to /play/, 412x915, 4x CPU
//   replay   requestAnimationFrame interval p95 while the replay of the largest preset plays at
//            1x and 16x, 1366x900, no throttling
//
// Each check runs `--samples` times in a fresh browser context and keeps the median. The JSON
// goes to `--out` (default bench/last-browser.json, ignored by git).

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { argv, env, stdout } from 'node:process';
import { BENCH_DIR, ROOT, median, readJson } from './lib.mjs';

const args = argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const URL_BASE = (option('--url') ?? 'http://localhost:4173').replace(/\/$/, '');
const OUT = option('--out') ?? path.join(BENCH_DIR, 'last-browser.json');
const SAMPLES = Math.max(1, Number(option('--samples') ?? 3));
const PW_DIR = option('--playwright') ?? env.PLAYWRIGHT_DIR;

const RUN_PRESET = 'elephants-pride';
const REPLAY_PRESET = 'trex-squad-tiger-horde';
const STARTUP_WINDOW_MS = 4000;
const AFTER_VERDICT_MS = 1000;
const REPLAY_WINDOW_MS = 4000;
const VERDICT_TIMEOUT_MS = 120_000;

const requireFrom = createRequire(
  PW_DIR ? path.join(path.resolve(PW_DIR), 'noop.js') : import.meta.url,
);
let playwright;
try {
  playwright = requireFrom('playwright');
} catch {
  throw new Error(
    'Playwright not found: set PLAYWRIGHT_DIR to a directory whose node_modules holds it ' +
      '(npm install --prefix <dir> --no-save playwright@<version>)',
  );
}
const { chromium } = playwright;

const log = (line) => stdout.write(`${line}\n`);

// Runs before any page script: collects long tasks and layout shifts from navigation on, and
// stamps the moment the Simple result bar is first shown (the verdict).
const INIT = () => {
  const perf = { lt: [], ls: [], verdictAt: null };
  window.__perf = perf;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) perf.lt.push({ start: e.startTime, dur: e.duration });
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      perf.ls.push({ start: e.startTime, value: e.value, input: e.hadRecentInput });
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

async function withPage(browser, viewport, fn, { cpu = 1 } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  if (cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

const sumOf = (xs) => xs.reduce((a, b) => a + b, 0);
const longTasks = (entries) => ({
  count: entries.length,
  totalMs: sumOf(entries.map((e) => e.dur)),
  longestMs: entries.length > 0 ? Math.max(...entries.map((e) => e.dur)) : 0,
});

/** Opens /play/ (Simple mode), picks a preset, runs it and waits for the verdict. */
async function runPreset(page, preset) {
  await page.goto(`${URL_BASE}/play/`, { waitUntil: 'load' });
  await page.click(`[data-simple="preset-${preset}"]`);
  await page.waitForFunction(
    (id) => document.querySelector(`[data-simple="preset-${id}"]`)?.ariaPressed === 'true',
    preset,
  );
  await page.waitForTimeout(500);
  const run = page.locator('button.btn-primary.btn-large:visible');
  const t0 = await page.evaluate(() => performance.now());
  await run.click();
  await page.waitForFunction(
    () => {
      const bar = document.querySelector('.simple-bar');
      if (!bar || bar.hidden) return false;
      window.__perf.verdictAt ??= performance.now();
      return true;
    },
    null,
    { polling: 'raf', timeout: VERDICT_TIMEOUT_MS },
  );
  const verdictAt = await page.evaluate(() => window.__perf.verdictAt);
  return { t0, verdictAt };
}

/** Long tasks and layout shift from Run to 1 s after the verdict. */
async function runSample(browser, viewport) {
  return withPage(browser, viewport, async (page) => {
    const { t0, verdictAt } = await runPreset(page, RUN_PRESET);
    await page.waitForTimeout(AFTER_VERDICT_MS);
    const { lt, ls } = await page.evaluate(() => window.__perf);
    const end = verdictAt + AFTER_VERDICT_MS;
    const inWindow = (e) => e.start >= t0 && e.start <= end;
    return {
      verdictMs: verdictAt - t0,
      longTasks: longTasks(lt.filter(inWindow)),
      cls: sumOf(ls.filter((e) => inWindow(e) && !e.input).map((e) => e.value)),
    };
  });
}

/** Long tasks in the first 4 s after navigation, 4x CPU. */
async function startupSample(browser) {
  return withPage(
    browser,
    { width: 412, height: 915 },
    async (page) => {
      await page.goto(`${URL_BASE}/play/`, { waitUntil: 'load' });
      await page.waitForFunction((ms) => performance.now() >= ms, STARTUP_WINDOW_MS + 200, {
        timeout: STARTUP_WINDOW_MS * 4,
      });
      const { lt } = await page.evaluate(() => window.__perf);
      return longTasks(lt.filter((e) => e.start < STARTUP_WINDOW_MS));
    },
    { cpu: 4 },
  );
}

/** rAF intervals while the replay plays at `speed`, from the start of the battle. */
async function playReplay(page, speed) {
  const section = page.locator('.free-replay-section:visible').first();
  const play = section.locator('button[aria-pressed]').first();
  if ((await play.getAttribute('aria-pressed')) === 'true') await play.click();
  await section.locator('select:has(option[value="16"])').selectOption(String(speed));
  await section.locator('input[type="range"]').first().focus();
  await page.keyboard.press('Home');
  await play.click();
  const frames = await page.evaluate(
    ({ windowMs }) =>
      new Promise((resolve) => {
        const btn = document.querySelector('.free-replay-section button[aria-pressed="true"]');
        const out = [];
        let last = 0;
        let start = 0;
        const tick = (ts) => {
          if (start === 0) start = ts;
          else out.push(ts - last);
          last = ts;
          if (ts - start < windowMs && btn?.getAttribute('aria-pressed') === 'true') {
            requestAnimationFrame(tick);
          } else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    { windowMs: REPLAY_WINDOW_MS },
  );
  if ((await play.getAttribute('aria-pressed')) === 'true') await play.click();
  return frames;
}

async function replaySample(browser) {
  return withPage(browser, { width: 1366, height: 900 }, async (page) => {
    await runPreset(page, REPLAY_PRESET);
    const section = page.locator('.free-replay-section:visible').first();
    await section.locator('canvas').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const b = document.querySelector('.free-replay-section button[aria-pressed]');
      return b !== null && !b.disabled;
    });
    const out = {};
    for (const speed of [1, 16]) {
      const frames = await playReplay(page, speed);
      const sorted = [...frames].sort((a, b) => a - b);
      out[`x${speed}`] = {
        frames: frames.length,
        p95Ms:
          sorted.length > 0
            ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
            : NaN,
        medianMs: median(frames),
        maxMs: sorted.length > 0 ? sorted[sorted.length - 1] : NaN,
      };
    }
    return out;
  });
}

const medianBy = (samples, pick) => median(samples.map(pick));

const browser = await chromium.launch();
const started = Date.now();
try {
  const desktop = { width: 1366, height: 900 };
  const mobile = { width: 390, height: 800 };
  const runs = [];
  const mobileRuns = [];
  const startups = [];
  const replays = [];
  for (let i = 0; i < SAMPLES; i++) {
    log(`sample ${i + 1} of ${SAMPLES}`);
    runs.push(await runSample(browser, desktop));
    mobileRuns.push(await runSample(browser, mobile));
    startups.push(await startupSample(browser));
    replays.push(await replaySample(browser));
  }

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    // not a git checkout
  }
  const report = {
    version: readJson(path.join(ROOT, 'package.json')).version,
    commit,
    date: new Date().toISOString(),
    browser: `Chromium ${browser.version()}`,
    playwright: requireFrom('playwright/package.json').version,
    url: URL_BASE,
    samples: SAMPLES,
    totalMs: Date.now() - started,
    run: {
      preset: RUN_PRESET,
      viewport: desktop,
      verdictMs: medianBy(runs, (r) => r.verdictMs),
      longTaskCount: medianBy(runs, (r) => r.longTasks.count),
      longTaskTotalMs: medianBy(runs, (r) => r.longTasks.totalMs),
      longestTaskMs: medianBy(runs, (r) => r.longTasks.longestMs),
      raw: runs,
    },
    cls: {
      preset: RUN_PRESET,
      desktop: medianBy(runs, (r) => r.cls),
      mobile: medianBy(mobileRuns, (r) => r.cls),
      raw: { desktop: runs.map((r) => r.cls), mobile: mobileRuns.map((r) => r.cls) },
    },
    startup: {
      page: '/play/',
      viewport: { width: 412, height: 915 },
      cpuThrottle: 4,
      windowMs: STARTUP_WINDOW_MS,
      longTaskCount: medianBy(startups, (s) => s.count),
      longTaskTotalMs: medianBy(startups, (s) => s.totalMs),
      longestTaskMs: medianBy(startups, (s) => s.longestMs),
      raw: startups,
    },
    replay: {
      preset: REPLAY_PRESET,
      viewport: desktop,
      x1P95Ms: medianBy(replays, (r) => r.x1.p95Ms),
      x16P95Ms: medianBy(replays, (r) => r.x16.p95Ms),
      x1MaxMs: medianBy(replays, (r) => r.x1.maxMs),
      x16MaxMs: medianBy(replays, (r) => r.x16.maxMs),
      raw: replays,
    },
  };
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  const f = (x) => (Number.isFinite(x) ? x.toFixed(0) : '–');
  log(
    `run ${RUN_PRESET}: verdict ${f(report.run.verdictMs)} ms, long tasks ${report.run.longTaskCount} (total ${f(report.run.longTaskTotalMs)} ms, longest ${f(report.run.longestTaskMs)} ms)`,
  );
  log(
    `result CLS: ${report.cls.desktop.toFixed(4)} (1366x900) / ${report.cls.mobile.toFixed(4)} (390x800)`,
  );
  log(
    `startup 4x: long tasks ${report.startup.longTaskCount} (total ${f(report.startup.longTaskTotalMs)} ms, longest ${f(report.startup.longestTaskMs)} ms)`,
  );
  log(
    `replay ${REPLAY_PRESET}: frame p95 ${report.replay.x1P95Ms.toFixed(1)} ms at 1x, ${report.replay.x16P95Ms.toFixed(1)} ms at 16x`,
  );
  log(`wrote ${path.relative(ROOT, OUT)} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
} finally {
  await browser.close();
}
