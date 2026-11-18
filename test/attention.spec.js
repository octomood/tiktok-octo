'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Автопауза по простою и «не спать, пока играет».
 *
 * Время простоя и блокировку сна подменяем в main, а воспроизведение —
 * поддельным видео в about:blank. Так проверяется вся цепочка: опрос,
 * пауза, возврат и powerSaveBlocker, без сети и без настоящего простоя.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('автопауза по простою и блокировка сна', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-attention-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_IDLE_POLL_MS: '150',
      },
    });

    await app.firstWindow();

    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');
    expect(page, 'полоса заголовка не появилась').toBeTruthy();
    expect(site, 'страница сайта не появилась').toBeTruthy();

    // Системное время простоя и блокировка сна — под контролем теста.
    await app.evaluate(({ powerMonitor, powerSaveBlocker }) => {
      process.__octoIdle = 0;
      powerMonitor.getSystemIdleTime = () => process.__octoIdle;
      const original = powerSaveBlocker.start.bind(powerSaveBlocker);
      powerSaveBlocker.start = (type) => {
        const id = original(type);
        process.__octoBlockerId = id;
        return id;
      };
    });

    await site.evaluate(() => {
      const video = document.createElement('video');
      const fake = { paused: false };
      Object.defineProperty(video, 'paused', { configurable: true, get: () => fake.paused });
      video.play = () => {
        fake.paused = false;
        return Promise.resolve();
      };
      video.pause = () => {
        fake.paused = true;
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

    // Сайт сообщил о старте воспроизведения — main считает, что ролик играет.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith('file://'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL() === 'about:blank',
      );
      view.webContents.emit('media-started-playing');
    });

    await page.evaluate(() => window.octo.cmd('idlePause', 1));
    await app.evaluate(() => {
      process.__octoIdle = 999;
    });
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.paused), { timeout: 4000 })
      .toBe(true);

    // Пользователь вернулся — ролик продолжается.
    await app.evaluate(() => {
      process.__octoIdle = 0;
    });
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.paused), { timeout: 4000 })
      .toBe(false);

    // «Не спать, пока играет» держит экран включённым и снимает блокировку.
    await page.evaluate(() => window.octo.cmd('keepAwake'));
    await expect(page.locator('#rowKeepAwake')).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(() =>
        app.evaluate(({ powerSaveBlocker }) => {
          const id = process.__octoBlockerId;
          return Boolean(id !== undefined && powerSaveBlocker.isStarted(id));
        }),
      )
      .toBe(true);

    await page.evaluate(() => window.octo.cmd('keepAwake'));
    await expect(page.locator('#rowKeepAwake')).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(() =>
        app.evaluate(({ powerSaveBlocker }) => {
          const id = process.__octoBlockerId;
          return id === undefined ? false : powerSaveBlocker.isStarted(id);
        }),
      )
      .toBe(false);

    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.attention.idlePause).toBe(1);
    expect(saved.attention.keepAwake).toBe(false);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
