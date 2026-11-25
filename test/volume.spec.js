'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Громкость из панели должна переживать переключение ролика. TikTok создаёт
 * новое <video> и иногда возвращает свою громкость уже после play — например,
 * когда снимает mute с автозапуска. Раньше такая поздняя запись оставалась
 * до конца ролика: следующий ролик звучал громче, чем выбрано в приложении.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('громкость применяется к следующему ролику после поздней записи сайта', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-volume-'));
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

    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    await page.evaluate(() => window.octo.cmd('playerVolume', 0.4));

    const addVideo = (id) =>
      site.evaluate(async (videoId) => {
        const video = document.createElement('video');
        video.id = videoId;
        video.style.cssText = 'width: 320px; height: 568px;';
        document.body.append(video);
        video.dispatchEvent(new window.Event('play', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 100));
        return video.volume;
      }, id);

    // Первый ролик: громкость выставляет приложение.
    expect(await addVideo('first')).toBeCloseTo(0.4, 2);

    // Сайт создаёт следующий ролик с полной громкостью до play.
    const beforePlay = await site.evaluate(async () => {
      const video = document.createElement('video');
      video.id = 'second';
      video.style.cssText = 'width: 320px; height: 568px;';
      document.body.append(video);
      video.volume = 1;
      video.dispatchEvent(new window.Event('play', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      return video.volume;
    });
    expect(beforePlay).toBeCloseTo(0.4, 2);

    // Сайт возвращает 100 % уже после play и после отложенной правки плеера.
    const lateReset = await site.evaluate(async () => {
      const video = document.createElement('video');
      video.id = 'late-reset';
      video.style.cssText = 'width: 320px; height: 568px;';
      document.body.append(video);
      video.dispatchEvent(new window.Event('play', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      video.volume = 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return video.volume;
    });
    expect(lateReset).toBeCloseTo(0.4, 2);

    // Снятие mute у автозапуска тоже не должно возвращать полную громкость.
    const afterUnmute = await site.evaluate(async () => {
      const video = document.createElement('video');
      video.id = 'unmute';
      video.style.cssText = 'width: 320px; height: 568px;';
      document.body.append(video);
      video.muted = true;
      video.volume = 1;
      video.dispatchEvent(new window.Event('play', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 800));
      video.muted = false;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return video.volume;
    });
    expect(afterUnmute).toBeCloseTo(0.4, 2);

    // Панель продолжает показывать выбранное значение.
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="playback"]').click();
    await expect(page.locator('#volumeRange')).toHaveValue('40');
    await expect(page.locator('#volumeValue')).toHaveText('40 %');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
