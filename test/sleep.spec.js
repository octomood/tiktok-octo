'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Таймер сна: затухание, «до конца ролика» и «стоп после N видео».
 *
 * Затухание и паузу делает страничный скрипт плеера, поэтому основную часть
 * проверяем прямо в about:blank, без сети. Отдельно смотрим, что команды из
 * интерфейса доходят до страницы и переживают перезапуск приложения.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('таймер сна: затухание, стоп после видео и сохранение', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-sleep-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
      },
    });

    await app.firstWindow();

    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');
    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    // --- Плавное затухание и остановка по времени ---------------------------
    const fade = await site.evaluate(async () => {
      const video = document.createElement('video');
      let volume = 1;
      let paused = false;

      Object.defineProperty(video, 'volume', {
        configurable: true,
        get: () => volume,
        set: (value) => {
          volume = value;
        },
      });
      Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
      video.pause = () => {
        paused = true;
      };
      video.getBoundingClientRect = () => ({ width: 320, height: 568, top: 0, left: 0 });
      document.body.append(video);

      window.__octoPlayer.update({
        volume: 1,
        sleepFade: true,
        sleepEndsAt: Date.now() + 700,
        sleepStopAtEnd: false,
        sleepVideosLeft: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 1300));

      const after = { paused, volume, done: window.__octoPlayer.status().done };
      video.remove();
      return after;
    });

    expect(fade.paused).toBe(true);
    expect(fade.volume).toBeLessThan(0.5);
    expect(fade.done).toBe(true);

    // --- «Стоп после N видео» ----------------------------------------------
    const counted = await site.evaluate(() => {
      const video = document.createElement('video');
      let paused = false;

      Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
      video.pause = () => {
        paused = true;
      };
      video.getBoundingClientRect = () => ({ width: 320, height: 568, top: 0, left: 0 });
      document.body.append(video);

      window.__octoPlayer.update({
        sleepFade: false,
        sleepEndsAt: 0,
        sleepStopAtEnd: false,
        sleepVideosLeft: 2,
      });

      video.dispatchEvent(new window.Event('ended'));
      const afterFirst = { paused, left: window.__octoPlayer.status().videosLeft };

      video.dispatchEvent(new window.Event('ended'));
      const afterSecond = {
        paused,
        left: window.__octoPlayer.status().videosLeft,
        done: window.__octoPlayer.status().done,
      };

      video.remove();
      return { afterFirst, afterSecond };
    });

    expect(counted.afterFirst.paused).toBe(false);
    expect(counted.afterFirst.left).toBe(1);
    expect(counted.afterSecond.paused).toBe(true);
    expect(counted.afterSecond.left).toBe(0);
    expect(counted.afterSecond.done).toBe(true);

    // --- «До конца ролика» --------------------------------------------------
    const stopAtEnd = await site.evaluate(() => {
      const video = document.createElement('video');
      let paused = false;

      Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
      video.pause = () => {
        paused = true;
      };
      video.getBoundingClientRect = () => ({ width: 320, height: 568, top: 0, left: 0 });
      document.body.append(video);

      window.__octoPlayer.update({
        sleepEndsAt: 0,
        sleepVideosLeft: null,
        sleepStopAtEnd: true,
      });
      video.dispatchEvent(new window.Event('ended'));
      const result = { paused, done: window.__octoPlayer.status().done };
      video.remove();
      return result;
    });

    expect(stopAtEnd.paused).toBe(true);
    expect(stopAtEnd.done).toBe(true);

    // --- Команды интерфейса доходят до страницы -----------------------------
    await page.evaluate(() => window.octo.cmd('sleepMode', 'end'));
    await expect(page.locator('#rowSleepEnd')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#sleepLabel')).toHaveText('Таймер сна');

    await page.evaluate(() => window.octo.cmd('sleepFade'));
    await expect(page.locator('#rowSleepFade')).toHaveAttribute('aria-checked', 'true');

    await page.evaluate(() => window.octo.cmd('sleepVideos', 2));
    await expect(page.locator('#sleepVideosValue')).toHaveText('2');
    await expect(page.locator('#rowSleepEnd')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => site.evaluate(() => window.__octoPlayer.status().videosLeft)).toBe(2);

    // --- Настройки переживают перезапуск ------------------------------------
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.sleep.mode).toBe('videos');
    expect(saved.sleep.videos).toBe(2);
    expect(saved.sleep.fade).toBe(true);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
