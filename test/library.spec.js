'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Библиотека и статистика.
 *
 * Адрес ролика подменяется env-переменной: тест не ходит в сеть, но видит
 * «tiktok.com», как на настоящей странице. Экспорт пишется в OCTO_EXPORT_DIR
 * вместо системного диалога.
 */

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

test('библиотека: сохранение, заметка, очередь, поиск и экспорт', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-library-'));
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-export-'));
  let app;

  try {
    const launched = await launch(userData, {
      OCTO_LIBRARY_URL: 'https://www.tiktok.com/@octo/video/123',
      OCTO_EXPORT_DIR: exportDir,
    });
    app = launched.app;
    const { page, site } = launched;

    await site.evaluate(() => {
      const video = document.createElement('video');
      const fake = { time: 12.4 };
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 100 });
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
      document.title = 'Разбор ленты | TikTok';
      window.__fakeTime = fake;
    });
    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    // --- Сохранение ---------------------------------------------------------
    await page.evaluate(() => window.octo.cmd('libraryAdd'));
    await page.locator('#btnPanel').click();
    await page.locator('[data-cat-head="library"]').click();

    const item = page.locator('.library-item').first();
    await expect(item.locator('.library-open')).toHaveText('Разбор ленты');
    await expect(item.locator('.library-meta')).toContainText('@octo · 0:12');

    // --- Заметка ------------------------------------------------------------
    await item.locator('[data-library-note]').fill('показать другу');
    await page.locator('#librarySearch').click();
    await expect
      .poll(() => {
        const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
        return saved.library.items[0].note;
      })
      .toBe('показать другу');

    // --- Очередь: второй ролик с другой секунды -----------------------------
    await site.evaluate(() => {
      window.__fakeTime.time = 30;
    });
    const statusTime = await site.evaluate(() => window.__octoPlayer.status().time);
    expect(statusTime).toBe(30);
    await page.evaluate(() => window.octo.cmd('libraryQueueAdd'));
    const libraryFile = path.join(userData, 'octo-state.json');
    const readLibrary = () => {
      try {
        return JSON.parse(fs.readFileSync(libraryFile, 'utf8')).library || { items: [], queue: [] };
      } catch {
        return { items: [], queue: [] };
      }
    };
    await expect.poll(() => readLibrary().items.length).toBe(2);
    await expect.poll(() => readLibrary().queue.length).toBe(1);
    await expect(page.locator('.library-item')).toHaveCount(2);
    await expect(page.locator('.library-chip.is-on')).toHaveCount(1);

    // --- Поиск --------------------------------------------------------------
    await page.locator('#librarySearch').fill('zzz');
    await expect(page.locator('#libraryEmpty')).toHaveText('Ничего не найдено');
    await page.locator('#librarySearch').fill('другу');
    await expect(page.locator('.library-item')).toHaveCount(1);
    await page.locator('#librarySearch').fill('');

    // --- Экспорт ------------------------------------------------------------
    await page.locator('[data-export="md"]').click();
    await page.locator('[data-export="json"]').click();

    const markdown = path.join(exportDir, 'tiktok-octo-library.md');
    const json = path.join(exportDir, 'tiktok-octo-library.json');
    await expect.poll(() => fs.existsSync(markdown) && fs.existsSync(json)).toBe(true);

    const md = fs.readFileSync(markdown, 'utf8');
    expect(md).toContain('https://www.tiktok.com/@octo/video/123');
    expect(md).toContain('показать другу');
    const exported = JSON.parse(fs.readFileSync(json, 'utf8'));
    expect(exported.items).toHaveLength(2);
    expect(exported.queue).toHaveLength(1);

    // --- Удаление -----------------------------------------------------------
    await page.locator('[data-library-remove]').first().click();
    await expect(page.locator('.library-item')).toHaveCount(1);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
});

test('статистика: время просмотра и сброс', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-stats-'));
  let app;

  try {
    const launched = await launch(userData, { OCTO_STATS_TICK_MS: '100' });
    app = launched.app;
    const { page, site } = launched;

    // Сайт сообщил о старте воспроизведения — main тикает статистику.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith('file://'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL() === 'about:blank',
      );
      view.webContents.emit('media-started-playing');
    });

    // Новый ролик в ленте: SPA меняет адрес, статистика считает его один раз.
    await site.evaluate(() => {
      window.location.hash = '/video/1';
    });

    const statePath = path.join(userData, 'octo-state.json');
    await expect
      .poll(() => {
        try {
          const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          const days = saved.stats && saved.stats.days ? Object.values(saved.stats.days) : [];
          const total = days.reduce((sum, day) => sum + (Number(day.ms) || 0), 0);
          return total;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(300);

    const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const day = Object.values(saved.stats.days)[0];
    expect(day.videos).toBe(1);

    // Панель показывает ту же статистику.
    await page.locator('#btnPanel').click();
    await page.locator('[data-cat-head="stats"]').click();
    await expect(page.locator('#statsTodayVideos')).toHaveText('1');

    // Пауза: тикер больше не добавляет время, иначе после сброса день
    // появится снова с нулевыми роликами.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith('file://'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
      );
      view.webContents.emit('media-paused');
    });

    await page.evaluate(() => window.octo.cmd('statsReset'));
    await expect(page.locator('#statsTodayVideos')).toHaveText('0');
    await expect
      .poll(() => {
        const next = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return Object.keys(next.stats.days || {}).length;
      })
      .toBe(0);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
