'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { readZip } = require('../src/main/plugins/zip');

/**
 * Focus mode, амбиентный режим и ZIP-архив.
 *
 * Focus ускоряется через OCTO_FOCUS_UNIT_MS/OCTO_FOCUS_TICK_MS: одна «минута»
 * длится 300 мс, поэтому тест не ждёт настоящие 25. Архив пишется в
 * OCTO_ARCHIVE_DIR и разбирается тем же ZIP-читателем, что и в приложении.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

async function launch(userData, extraEnv = {}) {
  const app = await electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
      ...extraEnv,
    },
  });
  await app.firstWindow();
  const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
  const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');
  return { app, page, site };
}

function emitMedia(app, event) {
  return app.evaluate(({ BrowserWindow }, name) => {
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().startsWith('file://'),
    );
    const view = win.contentView.children.find(
      (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
    );
    view.webContents.emit(name);
  }, event);
}

test('focus mode: затемнение после лимита и возврат после перерыва', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-focus-'));
  let app;

  try {
    const launched = await launch(userData, {
      OCTO_FOCUS_UNIT_MS: '300',
      OCTO_FOCUS_TICK_MS: '100',
    });
    app = launched.app;
    const { page, site } = launched;

    await site.evaluate(() => {
      const video = document.createElement('video');
      const fake = { paused: false };
      Object.defineProperty(video, 'paused', { configurable: true, get: () => fake.paused });
      video.pause = () => {
        fake.paused = true;
      };
      video.play = () => {
        fake.paused = false;
        return Promise.resolve();
      };
      video.getBoundingClientRect = () => ({
        width: 320,
        height: 568,
        top: 0,
        left: 0,
        right: 320,
        bottom: 568,
      });
      document.body.append(video);
      window.__fakeVideo = fake;
    });

    await page.evaluate(() => window.octo.cmd('focusMinutes', 1));
    await page.evaluate(() => window.octo.cmd('focusBreak', 1));
    await emitMedia(app, 'media-started-playing');
    await page.evaluate(() => window.octo.cmd('focusToggle'));
    await expect(page.locator('#rowFocus')).toHaveAttribute('aria-checked', 'true');

    // Лимит исчерпан: затемнение и пауза.
    await expect(site.locator('#octo-focus-curtain')).toBeVisible({ timeout: 5000 });
    expect(await site.evaluate(() => window.__fakeVideo.paused)).toBe(true);

    // Перерыв короткий (тоже 300 мс) — затемнение уходит само.
    await expect(site.locator('#octo-focus-curtain')).toBeHidden({ timeout: 5000 });

    // Esc/кнопка выключают режим и снимают настройку.
    await page.evaluate(() => window.octo.cmd('focusExit'));
    await expect(page.locator('#rowFocus')).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(() => {
        const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
        return saved.focus.enabled;
      })
      .toBe(false);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('амбиентный режим: звук выключен, полоса спрятана, Esc возвращает', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-ambient-'));
  let app;

  try {
    const launched = await launch(userData);
    app = launched.app;
    const { page } = launched;

    const viewState = () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().startsWith('file://'),
        );
        const view = win.contentView.children.find(
          (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
        );
        return { muted: view.webContents.isAudioMuted(), y: view.getBounds().y };
      });

    await page.evaluate(() => window.octo.cmd('ambientToggle'));
    await expect(page.locator('body')).toHaveClass(/is-ambient/);
    await expect(page.locator('#chrome')).toBeHidden();
    await expect.poll(async () => (await viewState()).muted).toBe(true);
    await expect.poll(async () => (await viewState()).y).toBe(0);

    await page.evaluate(() => window.octo.cmd('ambientExit'));
    await expect(page.locator('body')).not.toHaveClass(/is-ambient/);
    await expect(page.locator('#chrome')).toBeVisible();
    await expect.poll(async () => (await viewState()).muted).toBe(false);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('архив: закладки, статистика, настройки и стикеры в ZIP', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-archive-'));
  const archiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-archive-out-'));
  let app;

  try {
    const launched = await launch(userData, {
      OCTO_LIBRARY_URL: 'https://www.tiktok.com/@octo/video/321',
      OCTO_ARCHIVE_DIR: archiveDir,
    });
    app = launched.app;
    const { page, site } = launched;

    await site.evaluate(() => {
      const video = document.createElement('video');
      const fake = { time: 5 };
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => fake.time,
        set: (value) => {
          fake.time = value;
        },
      });
      Object.defineProperty(video, 'paused', { configurable: true, get: () => true });
      video.getBoundingClientRect = () => ({
        width: 320,
        height: 568,
        top: 0,
        left: 0,
        right: 320,
        bottom: 568,
      });
      document.body.append(video);
      document.title = 'Архивный ролик | TikTok';
    });
    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    await page.evaluate(() => window.octo.cmd('libraryAdd'));
    // Одна настройка, чтобы settings.json был не пустым.
    await page.evaluate(() => window.octo.cmd('playerVolume', 0.5));

    // Свой стикер: попадает в архив отдельной папкой.
    const stickersDir = path.join(userData, 'stickers');
    fs.mkdirSync(stickersDir, { recursive: true });
    fs.writeFileSync(path.join(stickersDir, 'drop.png'), PNG);

    await page.evaluate(() => window.octo.cmd('archiveExport'));

    await expect
      .poll(
        () =>
          fs.readdirSync(archiveDir).find((name) => name.startsWith('tiktok-octo-archive-')) || '',
      )
      .toMatch(/tiktok-octo-archive-\d{8}-\d{4}\.zip/);

    const file = fs.readdirSync(archiveDir).find((name) => name.startsWith('tiktok-octo-archive-'));
    const entries = readZip(fs.readFileSync(path.join(archiveDir, file)));
    const names = [...entries.keys()].sort();

    expect(names).toEqual(
      expect.arrayContaining([
        'README.txt',
        'library.json',
        'library.md',
        'settings.json',
        'stats.json',
        'stickers/drop.png',
      ]),
    );

    const libraryJson = JSON.parse(entries.get('library.json').toString('utf8'));
    expect(libraryJson.items).toHaveLength(1);
    expect(libraryJson.items[0].url).toBe('https://www.tiktok.com/@octo/video/321');
    expect(libraryJson.items[0].time).toBe(5);

    const settings = JSON.parse(entries.get('settings.json').toString('utf8'));
    expect(settings.player).toBeTruthy();
    expect(entries.get('library.md').toString('utf8')).toContain('@octo/video/321');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(archiveDir, { recursive: true, force: true });
  }
});
