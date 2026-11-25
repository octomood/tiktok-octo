// Покадровый рендер промо: сцена считается в Chromium, кадры отдаёт Playwright.
// Кадры детерминированы: window.renderAt(t) — чистая функция, порядок неважен.
//
//   node docs/promo/render.mjs [--fps 30] [--dsf 2] [--out docs/promo/build]
//   node docs/promo/render.mjs --start 6 --end 9   # только диапазон, в секундах
//   node docs/promo/render.mjs --still 13.4        # один кадр (постер)

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};

const fps = Number(arg('fps', 30));
const dsf = Number(arg('dsf', 2));
const width = Number(arg('width', 1080));
const height = Number(arg('height', 1920));
const still = arg('still', null);
const start = Number(arg('start', 0));
const end = Number(arg('end', 0));
const scene = arg('scene', 'scene.html');
const outDir = path.resolve(here, arg('out', 'build'));
const framesDir = path.join(outDir, 'frames');
const DEFAULT_DUR = 15;

fs.mkdirSync(framesDir, { recursive: true });

// Playwright может ожидать более новый Chromium, чем установлен в кеше.
// Берём любой доступный, чтобы рендер не зависел от сети.
function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()));
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const executablePath = findChromium();

const browser = await chromium.launch({
  executablePath,
  args: [
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
  ],
});

const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dsf,
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
});

const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.error('[scene]', m.text());
});
page.on('pageerror', (e) => console.error('[scene error]', e.message));

await page.goto(pathToFileURL(path.join(here, scene)).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => document.body.dataset.ready === '1');

const DUR = await page.evaluate((fallback) => window.DUR || fallback, DEFAULT_DUR);

if (still != null) {
  const t = Number(still);
  await page.evaluate((x) => window.renderAt(x), t);
  const file = path.join(outDir, `poster-${t.toFixed(2)}.png`);
  await page.screenshot({ path: file });
  console.log(`poster ${file}`);
  await browser.close();
  process.exit(0);
}

const total = Math.round(DUR * fps);
const firstFrame = Math.max(0, Math.round(start * fps));
const lastFrame = end > 0 ? Math.min(total - 1, Math.round(end * fps) - 1) : total - 1;
console.log(`rendering frames ${firstFrame}…${lastFrame} of ${total} at ${fps} fps, dsf ${dsf} …`);

const started = Date.now();
for (let i = firstFrame; i <= lastFrame; i++) {
  const t = i / fps;
  await page.evaluate((x) => window.renderAt(x), t);
  await page.screenshot({
    path: path.join(framesDir, `${String(i).padStart(4, '0')}.png`),
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  if (i % 45 === 0 || i === lastFrame) {
    const el = (Date.now() - started) / 1000;
    console.log(`  ${i + 1}/${lastFrame + 1}  ${el.toFixed(1)}s  (${(el / (i - firstFrame + 1)).toFixed(2)}s/frame)`);
  }
}

await browser.close();
console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s → ${framesDir}`);
