// Regenerates every brand asset in public/ from the sources in brand/src/.
//
//   node brand/render.mjs [--preview <file.png>]
//
// Needs Node 22+, Python 3 with Pillow, and Playwright with its Chromium build. Playwright is not a
// project dependency: it is imported from PLAYWRIGHT_MODULE (a path to playwright's index.mjs) or
// from a resolvable `playwright` package (e.g. `npm i --no-save playwright && npx playwright install chromium`).
//
// Typography is fixed: every text in every asset is Pretendard 1.3.9 (SIL OFL 1.1). The font files
// are not committed; they are downloaded into brand/.cache/fonts/ on first run and checked against
// pinned SHA-256 hashes. Each page is then checked through the Chrome DevTools Protocol, and the run
// fails if any glyph (Hangul or Latin) was drawn with anything other than those Pretendard files.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { faviconSvg, maskableSvg, squareSvg } from './src/mark.mjs';

const BRAND = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(BRAND, '..');
const SRC = path.join(BRAND, 'src');
const CACHE = path.join(BRAND, '.cache');
const FONT_DIR = path.join(CACHE, 'fonts');
const RAW = path.join(CACHE, 'raw');
const PUBLIC = path.join(ROOT, 'public');

const args = process.argv.slice(2);
const previewArg = args.indexOf('--preview');
if (previewArg >= 0 && !args[previewArg + 1]?.endsWith('.png'))
  throw new Error('usage: node brand/render.mjs [--preview <file.png>]');
const previewOut = previewArg >= 0 ? path.resolve(args[previewArg + 1]) : null;

/* ---------------------------------------------------------------- fonts */

const PRETENDARD_VERSION = '1.3.9';
const FONT_BASES = [
  `https://cdn.jsdelivr.net/npm/pretendard@${PRETENDARD_VERSION}/dist/public/static/`,
  `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v${PRETENDARD_VERSION}/packages/pretendard/dist/public/static/`,
];
const FONT_FILES = {
  'Pretendard-Medium.otf': 'd39e50e4bb52b4993b6a4eeb821a171254745bd824446af01e1f616b89fface0',
  'Pretendard-SemiBold.otf': 'c89bc43027dc7cde5726e96223376f8eec09302b2fc1f8147fd5b57cfc376118',
  'Pretendard-Bold.otf': '2e91915fab54df71cc9598ebf608b2bdb54c6fe3c066ac61dff0bc44fca71cc7',
  'Pretendard-ExtraBold.otf': 'c35fe941b7568d52a96010561540e47f9d3948dfde66ba25bc1908233e0a40cd',
  'Pretendard-Black.otf': '94628b0bcea8936b6e5c30d98d685eb9bbaffb0fe2ed255542ecc656c248e021',
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchBytes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // Node's fetch ignores HTTPS_PROXY; curl honours it, so use it as the fallback transport
    const r = spawnSync('curl', ['-fsSL', '--retry', '3', url], {
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status === 0) return r.stdout;
    throw new Error(`${url}: ${err.message}; curl: ${String(r.stderr).trim()}`, { cause: err });
  }
}

async function ensureFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  for (const [file, hash] of Object.entries(FONT_FILES)) {
    const dest = path.join(FONT_DIR, file);
    if (fs.existsSync(dest) && sha256(fs.readFileSync(dest)) === hash) continue;
    let ok = false;
    for (const base of FONT_BASES) {
      try {
        const buf = await fetchBytes(base + file);
        if (sha256(buf) !== hash) throw new Error('SHA-256 mismatch');
        fs.writeFileSync(dest, buf);
        console.log(`[fonts] downloaded ${file} from ${base}`);
        ok = true;
        break;
      } catch (err) {
        console.warn(`[fonts] ${base}${file}: ${err.message}`);
      }
    }
    if (!ok) throw new Error(`could not download ${file}`);
  }
  console.log(
    `[fonts] Pretendard ${PRETENDARD_VERSION}: ${Object.keys(FONT_FILES).length} files verified`,
  );
}

/* ---------------------------------------------------------------- playwright */

async function loadChromium() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(
    Boolean,
  );
  for (const spec of candidates) {
    try {
      const mod = await import(path.isAbsolute(spec) ? pathToFileURL(spec).href : spec);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    'Playwright not found. Set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs, or run ' +
      '`npm i --no-save playwright && npx playwright install chromium`.',
  );
}

const fileUrl = (p, qs = '') => pathToFileURL(p).href + qs;

// Any font that is not one of the downloaded Pretendard files fails the build. The fonts that a
// Hangul run could silently fall back to on a typical Linux box are named explicitly in the error.
const FALLBACK_SUSPECTS =
  /WenQuanYi|Unifont|Noto|Nanum|DejaVu|Liberation|Droid|Baekmuk|UnDotum|Malgun|Gothic/i;
const PRETENDARD_FACE = /^Pretendard-(Medium|SemiBold|Bold|ExtraBold|Black)$/;

async function verifyFonts(page, label, { expectHangul }) {
  await page.evaluate(() => document.fonts.ready);
  // mark every element whose own text contains Hangul, so those runs are checked on their own too
  const hangulNodes = await page.evaluate(() => {
    let n = 0;
    for (const e of document.querySelectorAll('body, body *')) {
      if (e.closest('script, style, title')) continue;
      const own = [...e.childNodes]
        .filter((c) => c.nodeType === 3)
        .map((c) => c.textContent)
        .join('');
      if (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(own)) {
        e.setAttribute('data-hangul', '');
        n++;
      }
    }
    return n;
  });
  if (expectHangul && hangulNodes === 0)
    throw new Error(`${label}: no Hangul text found to verify`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const collect = async (selector) => {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
    const used = new Map();
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      for (const f of fonts) {
        const key = `${f.familyName}|${f.postScriptName}|${f.isCustomFont}`;
        used.set(key, (used.get(key) ?? 0) + f.glyphCount);
      }
    }
    return used;
  };
  const all = await collect('body, body *');
  const hangul = await collect('[data-hangul]');
  await cdp.detach();

  const bad = (used) =>
    [...used.keys()].filter((k) => {
      const [, ps, custom] = k.split('|');
      return custom !== 'true' || !PRETENDARD_FACE.test(ps) || FALLBACK_SUSPECTS.test(k);
    });
  const fmt = (used) => [...used].map(([k, n]) => `${k.split('|')[1]}=${n}`).join(', ');
  console.log(`[fonts] ${label}: ${fmt(all)}`);
  if (hangulNodes) console.log(`        Hangul runs (${hangulNodes} elements): ${fmt(hangul)}`);
  if (all.size === 0) throw new Error(`${label}: no fonts reported`);
  const wrong = [...bad(all), ...bad(hangul)];
  if (wrong.length) throw new Error(`${label}: non-Pretendard font used -> ${wrong.join(' | ')}`);

  const check = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => [
        f.weight,
        document.fonts.check(`${f.weight} 40px PretendardBrand`, '티렉스 대 호랑이 T-Rex vs Tiger'),
      ]),
  );
  console.log(`        document.fonts.check: ${check.map(([w, ok]) => `${w}=${ok}`).join(', ')}`);
  if (!check.length || check.some(([, ok]) => !ok))
    throw new Error(`${label}: document.fonts.check failed`);
}

/* ---------------------------------------------------------------- checks */

function checkOgLayout(L) {
  const errors = [];
  const tol = 0.75;
  if (L.counts.trex !== 10 || L.counts.tigers !== 100)
    errors.push(
      `arena counts ${L.counts.trex}/${L.counts.tigers}, expected 10/100 (the HUD must stay honest)`,
    );
  for (const [name, b] of Object.entries(L.items)) {
    if (b.right > L.column.right + tol)
      errors.push(`${name} overflows the text column (${b.right.toFixed(1)} > ${L.column.right})`);
    if (b.right > L.arenaLeft - 24) errors.push(`${name} runs into the arena panel`);
    if (b.top < 0 || b.bottom > L.bandTop - 16)
      errors.push(`${name} leaves the safe vertical area`);
    if ('ink' in b && Math.abs(b.ink - L.column.left) > tol)
      errors.push(`${name} ink starts at x=${b.ink.toFixed(2)}, expected ${L.column.left}`);
  }
  if (errors.length) throw new Error(`og-${L.lang} layout:\n  ${errors.join('\n  ')}`);
  const w = (b) => (b.right - b.left).toFixed(0);
  console.log(
    `[layout] og-${L.lang}: ok (title ${w(L.items.line1)} / ${w(L.items.line2)} px of 560)`,
  );
}

/* ---------------------------------------------------------------- render */

async function rasterSvg(browser, svgFile, size, outFile) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl(path.join(SRC, 'raster.html')));
  // drawn through <img>, the same path a browser takes for a favicon or <img src="*.svg">
  await page.evaluate(
    async ([src, s]) => {
      const img = new Image(s, s);
      img.src = src;
      document.body.appendChild(img);
      await img.decode();
    },
    [fileUrl(svgFile), size],
  );
  await page.screenshot({
    path: outFile,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
}

await ensureFonts();
fs.mkdirSync(RAW, { recursive: true });

const favicon = path.join(PUBLIC, 'favicon.svg');
const square = path.join(CACHE, 'icon-square.svg');
const maskable = path.join(CACHE, 'icon-maskable.svg');
fs.writeFileSync(favicon, faviconSvg());
fs.writeFileSync(square, squareSvg());
fs.writeFileSync(maskable, maskableSvg());

const chromium = await loadChromium();
const browser = await chromium.launch();
try {
  for (const s of [16, 32, 48, 192, 512])
    await rasterSvg(browser, favicon, s, path.join(RAW, `icon-${s}.png`));
  await rasterSvg(browser, square, 180, path.join(RAW, 'apple-touch-icon.png'));
  await rasterSvg(browser, maskable, 512, path.join(RAW, 'icon-maskable-512.png'));

  for (const lang of ['ko', 'en']) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    await page.goto(fileUrl(path.join(SRC, 'og.html'), `?lang=${lang}`));
    await page.waitForSelector('body[data-ready="1"]');
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await verifyFonts(page, `og-${lang}`, { expectHangul: lang === 'ko' });
    checkOgLayout(await page.evaluate(() => window.__layout));
    await page.screenshot({
      path: path.join(RAW, `og-${lang}.png`),
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    await page.close();
  }

  // result-page link previews (/r/, /en/r/): a static card, the same for every shared result
  for (const lang of ['ko', 'en']) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    await page.goto(fileUrl(path.join(SRC, 'og-result.html'), `?lang=${lang}`));
    await page.waitForSelector('body[data-ready="1"]');
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await verifyFonts(page, `og-result-${lang}`, { expectHangul: lang === 'ko' });
    await page.screenshot({
      path: path.join(RAW, `og-result-${lang}.png`),
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    await page.close();
  }

  const py = spawnSync(
    process.env.PYTHON ?? 'python3',
    ['-I', path.join(BRAND, 'pack.py'), RAW, PUBLIC],
    {
      stdio: 'inherit',
    },
  );
  if (py.status !== 0) throw new Error('pack.py failed (needs Python 3 with Pillow)');

  // contact sheet of the shipped files, for review only (not committed)
  const page = await browser.newPage({
    viewport: { width: 1480, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl(path.join(SRC, 'sheet.html')));
  await page.waitForSelector('body[data-ready="1"]');
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await verifyFonts(page, 'sheet', { expectHangul: true });
  const sheet = path.join(CACHE, 'preview.png');
  await page.screenshot({ path: sheet, fullPage: true });
  await page.close();
  if (previewOut) {
    fs.mkdirSync(path.dirname(previewOut), { recursive: true });
    fs.copyFileSync(sheet, previewOut);
  }
  console.log(`[sheet] ${previewOut ?? sheet}`);
} finally {
  await browser.close();
}
console.log('done');
