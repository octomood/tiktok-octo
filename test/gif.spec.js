'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * GIF из ролика: кадры снимаются со страницы, кодируются в скрытом окне и
 * сохраняются файлом. Проверяем заголовок GIF и ширину — то, что можно
 * проверить без декодера.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('GIF: кадры, кодирование и файл с нужной шириной', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-gif-'));
  const gifDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-gif-out-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_GIF_DIR: gifDir,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().endsWith('/index.html'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');
    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    await site.evaluate(() => {
      const video = document.createElement('video');
      let time = 2;
      let paused = true;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 10 });
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => time,
        set: (value) => {
          time = value;
        },
      });
      Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
      Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => 720 });
      Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => 1280 });
      video.play = () => {
        paused = false;
        return Promise.resolve();
      };
      video.pause = () => {
        paused = true;
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
    });

    await page.evaluate(() => window.octo.cmd('gifDuration', 3));
    await page.evaluate(() => window.octo.cmd('gifFps', 5));
    await page.evaluate(() => window.octo.cmd('gifWidth', 320));
    await expect.poll(() => page.locator('#gifWidth').inputValue()).toBe('320');

    await page.evaluate(() => window.octo.cmd('gifExport'));

    await expect
      .poll(() => fs.readdirSync(gifDir).find((name) => name.endsWith('.gif')) || '', {
        timeout: 40000,
      })
      .toMatch(/^tiktok-octo-\d{8}-\d{6}\.gif$/);

    const file = fs.readdirSync(gifDir).find((name) => name.endsWith('.gif'));
    const buffer = fs.readFileSync(path.join(gifDir, file));
    expect(buffer.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(buffer.readUInt16LE(6)).toBe(320);
    expect(buffer.readUInt16LE(8)).toBeGreaterThan(0);
    expect(buffer.length).toBeGreaterThan(1000);

    const state = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(state.gif).toEqual({ duration: 3, fps: 5, width: 320 });
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(gifDir, { recursive: true, force: true });
  }
});
