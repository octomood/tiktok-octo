'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { build } = require('../src/main/qr-code');

/**
 * Картинка, субтитры, дата публикации, QR и режим «только полоса».
 *
 * Всё, кроме QR-матрицы, проверяется на about:blank: поддельное видео,
 * кнопка субтитров и дата имитируют разметку сайта, поэтому тест не ходит
 * в сеть. Кодирование QR проверяется отдельно, без Electron.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

async function launch(userData) {
  const app = await electron.launch({
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
  return { app, page, site };
}

test('картинка, субтитры и дата публикации', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-picture-'));
  // Старое состояние: «заполнить» попадало в настройки как значение по
  // умолчанию. После обновления кадр должен снова показывать сайт.
  fs.writeFileSync(
    path.join(userData, 'octo-state.json'),
    JSON.stringify({ player: { fit: 'cover' } }, null, 2),
  );
  let app;

  try {
    ({ app } = await launch(userData));
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await site.evaluate(() => {
      const video = document.createElement('video');
      video.style.width = '320px';
      video.style.height = '180px';
      video.getBoundingClientRect = () => ({
        width: 320,
        height: 180,
        top: 0,
        left: 0,
        right: 320,
        bottom: 180,
      });
      document.body.append(video);
      window.__fakeVideo = video;
    });

    // --- Фильтр и кадрирование ---------------------------------------------
    await page.evaluate(() =>
      window.octo.cmd('picture', { brightness: 120, contrast: 90, warmth: 40 }),
    );
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('filter')))
      .toContain('brightness(1.2)');
    const filter = await site.evaluate(() => window.__fakeVideo.style.getPropertyValue('filter'));
    expect(filter).toContain('contrast(0.9)');
    expect(filter).toContain('sepia');

    // По умолчанию кадр не трогаем: иначе cover обрезает и «увеличивает»
    // ролики сайта без причины.
    expect(await site.evaluate(() => window.__fakeVideo.style.getPropertyValue('object-fit'))).toBe(
      '',
    );

    await page.evaluate(() => window.octo.cmd('pictureFit', 'contain'));
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('object-fit')))
      .toBe('contain');

    await page.evaluate(() => window.octo.cmd('pictureFit', 'cover'));
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('object-fit')))
      .toBe('cover');

    await page.evaluate(() => window.octo.cmd('pictureFit', 'auto'));
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('object-fit')))
      .toBe('');

    await page.evaluate(() => window.octo.cmd('pictureReset'));
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('filter')))
      .toBe('');
    await expect
      .poll(() => site.evaluate(() => window.__fakeVideo.style.getPropertyValue('object-fit')))
      .toBe('');

    // --- Субтитры -----------------------------------------------------------
    await site.evaluate(() => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Captions');
      button.setAttribute('aria-pressed', 'false');
      button.style.width = '24px';
      button.style.height = '24px';
      window.__captionClicks = 0;
      button.addEventListener('click', () => {
        window.__captionClicks += 1;
        button.setAttribute('aria-pressed', 'true');
      });
      document.body.append(button);

      const caption = document.createElement('div');
      caption.dataset.e2e = 'caption';
      caption.textContent = 'hello';
      document.body.append(caption);

      const date = document.createElement('div');
      date.dataset.e2e = 'browse-video-date';
      date.textContent = '2024-5-1';
      document.body.append(date);
    });

    const captionStyle = () =>
      site.evaluate(() => {
        const node = document.getElementById('octo-caption-style');
        return node ? node.textContent : '';
      });

    await page.evaluate(() => window.octo.cmd('captionToggle'));
    await expect.poll(() => site.evaluate(() => window.__captionClicks)).toBeGreaterThan(0);
    await expect.poll(captionStyle).toContain('font-size: 16px');

    await page.evaluate(() => window.octo.cmd('captionSize', 140));
    await expect.poll(captionStyle).toContain('font-size: 22px');

    await page.evaluate(() => window.octo.cmd('captionBackground'));
    await expect.poll(captionStyle).not.toContain('rgba(0, 0, 0, 0.62)');

    // --- Дата публикации видна в панели -------------------------------------
    await page.locator('#btnPanel').click();
    await expect(page.locator('#videoDateValue')).toHaveText('2024-5-1', { timeout: 8000 });

    // --- Настройки сохранились ----------------------------------------------
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.subtitles.enabled).toBe(true);
    expect(saved.subtitles.size).toBe(140);
    expect(saved.subtitles.background).toBe(false);
    expect(saved.player.fit).toBe('auto');
    expect(saved.player.brightness).toBe(100);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('QR-код: матрица валидна и повторяема', () => {
  const qr = build('https://www.tiktok.com/@octo/video/1');
  expect(qr.count).toBeGreaterThanOrEqual(21);
  expect(qr.rows).toHaveLength(qr.count);
  for (const row of qr.rows) expect(row).toHaveLength(qr.count);

  // Позиционные маркеры по углам: тёмная рамка 7×7 и белое кольцо внутри.
  expect(qr.rows[0].slice(0, 7)).toBe('1111111');
  expect(qr.rows[0].slice(-7)).toBe('1111111');
  expect(qr.rows[qr.count - 1].slice(0, 7)).toBe('1111111');
  expect(qr.rows[1][1]).toBe('0');
  expect(qr.rows[3][3]).toBe('1');

  expect(build('https://www.tiktok.com/@octo/video/1').rows).toEqual(qr.rows);
  expect(() => build('')).toThrow();
});

test('режим «только полоса»: пульт, громкость и возврат', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-bar-'));
  let app;

  try {
    ({ app } = await launch(userData));
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    const bounds = () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().startsWith('file://'),
        );
        return win ? win.getBounds() : null;
      });
    const before = await bounds();

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

    await page.evaluate(() => window.octo.cmd('barOnly'));
    await expect(page.locator('body')).toHaveClass(/is-bar/);
    await expect(page.locator('#baronly')).toBeVisible();
    await expect(page.locator('#titlebar')).toBeHidden();

    await expect.poll(async () => (await bounds()).height).toBeLessThan(200);

    // Сайт скрыт, но остаётся загруженным и не считается «фоновым».
    const visibility = await site.evaluate(() => document.visibilityState);
    expect(visibility).toBe('visible');

    // Громкость из пульта уходит в плеер.
    await page.locator('#barVolume').evaluate((element) => {
      element.value = '40';
      element.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await expect(page.locator('#barVolumeValue')).toHaveText('40 %');
    await expect
      .poll(() => {
        try {
          const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
          return saved.player.volume;
        } catch {
          return null;
        }
      })
      .toBeCloseTo(0.4, 2);

    // Play/pause в пульте управляет роликом на скрытой странице.
    await page.click('#btnBarPlay');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.paused)).toBe(true);
    await page.click('#btnBarPlay');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.paused)).toBe(false);

    await page.evaluate(() => window.octo.cmd('barExit'));
    await expect(page.locator('body')).not.toHaveClass(/is-bar/);
    await expect(page.locator('#titlebar')).toBeVisible();
    await expect.poll(async () => (await bounds()).height).toBe(before.height);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
