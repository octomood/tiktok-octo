'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Три исправления без сети, на about:blank:
 * 1. ползунок громкости меняет volume у видео сайта, а переключатель «Звук»
 *    показывает включённый звук, а не mute;
 * 2. при пропуске рекламы на секунду появляется плашка «Реклама пропущена»;
 * 3. PiP показывает ролик, который сайт начал играть, а не предыдущий —
 *    иначе картинка и звук расходятся.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('громкость, плашка рекламы и синхронный PiP', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-mods-'));
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

    // --- Громкость -------------------------------------------------------
    await site.evaluate(() => {
      const video = document.createElement('video');
      video.id = 'volume-video';
      video.style.width = '320px';
      video.style.height = '180px';
      document.body.append(video);
    });

    await page.evaluate(() => window.octo.cmd('playerVolume', 0.4));
    await expect
      .poll(() => site.evaluate(() => document.getElementById('volume-video').volume))
      .toBeCloseTo(0.4, 2);

    await page.click('#btnPanel');
    await page.locator('[data-cat-head="playback"]').click();
    await expect(page.locator('#volumeRange')).toHaveValue('40');
    await expect(page.locator('#volumeValue')).toHaveText('40 %');

    // Переключатель «Звук» включён, пока звук не выключен.
    await expect(page.locator('#rowMute')).toHaveAttribute('aria-checked', 'true');
    await page.locator('#rowMute').click();
    await expect(page.locator('#rowMute')).toHaveAttribute('aria-checked', 'false');
    await page.locator('#rowMute').click();
    await expect(page.locator('#rowMute')).toHaveAttribute('aria-checked', 'true');

    await page.evaluate(() => {
      const range = document.getElementById('volumeRange');
      range.value = '65';
      range.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await expect(page.locator('#volumeValue')).toHaveText('65 %');
    await expect
      .poll(() => site.evaluate(() => document.getElementById('volume-video').volume))
      .toBeCloseTo(0.65, 2);
    await page.click('#btnPanelClose');

    // --- Плашка пропуска рекламы ----------------------------------------
    await page.evaluate(() => window.octo.cmd('adsSkip'));
    await expect.poll(() => site.evaluate(() => typeof window.__octoAds)).toBe('object');

    await site.evaluate(() => {
      window.__adClicks = 0;

      const item = document.createElement('div');
      item.setAttribute('data-e2e', 'recommend-list-item-container');
      item.style.cssText = 'position: relative; width: 360px; height: 640px;';

      const label = document.createElement('span');
      label.setAttribute('data-e2e', 'ad-label');
      label.textContent = 'Реклама';
      // Метка на реальной странице лежит поверх видео; здесь тоже закрепляем
      // её сверху, чтобы она не оказалась за нижним краем окна теста.
      label.style.cssText = 'position: absolute; top: 10px; left: 10px; width: 60px; height: 20px;';

      const video = document.createElement('video');
      video.style.cssText = 'width: 320px; height: 568px;';
      item.append(video, label);
      document.body.append(item);

      // Кнопка «следующее видео» у сайта закреплена поверх ленты. Фиксируем
      // её в углу, чтобы она не уезжала за нижний край маленького окна теста.
      const next = document.createElement('button');
      next.setAttribute('data-e2e', 'feed-navigation-next');
      next.style.cssText =
        'position: fixed; top: 20px; right: 20px; width: 40px; height: 40px; z-index: 10;';
      next.addEventListener('click', () => {
        window.__adClicks += 1;
      });
      document.body.append(next);
    });

    await expect.poll(() => site.evaluate(() => window.__adClicks), { timeout: 5000 }).toBe(1);
    await expect
      .poll(() => site.evaluate(() => document.getElementById('octo-ad-notice')?.textContent))
      .toBe('Реклама пропущена');

    // Плашка исчезает сама и не появляется повторно для того же ролика.
    await expect
      .poll(() => site.evaluate(() => Boolean(document.getElementById('octo-ad-notice'))), {
        timeout: 4000,
      })
      .toBe(false);

    // --- PiP следует за роликом, который начал играть сайт ---------------
    await page.evaluate(() => window.octo.cmd('pip'));
    await expect.poll(() => site.evaluate(() => Boolean(window.__octoPip))).toBe(true);
    await expect
      .poll(() => site.evaluate(() => Boolean(document.getElementById('octo-pip-stage'))))
      .toBe(true);

    const firstVideoInStage = await site.evaluate(
      () => document.querySelector('#octo-pip-stage video')?.id || null,
    );

    await site.evaluate(() => {
      const next = document.createElement('video');
      next.id = 'next-video';
      next.style.cssText = 'width: 320px; height: 568px;';
      Object.defineProperty(next, 'paused', { configurable: true, get: () => false });
      document.body.append(next);
      next.dispatchEvent(new window.Event('play', { bubbles: true }));
    });

    // В сцене оказывается новый ролик, а не старое видео из ленты.
    await expect
      .poll(() => site.evaluate(() => document.querySelector('#octo-pip-stage video')?.id || null))
      .toBe('next-video');

    const oldPaused = await site.evaluate((id) => {
      if (!id) return true;
      const old = document.getElementById(id);
      return !old || old.paused;
    }, firstVideoInStage);
    expect(oldPaused).toBe(true);

    await page.evaluate(() => window.octo.cmd('pipClose'));
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
