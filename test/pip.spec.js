'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * PiP — собственный мини-плеер приложения, а не нативное окно Chromium.
 * Поэтому его можно проверить без сети: в about:blank подкладываем видео,
 * кнопки ленты и смотрим, что окно сжимается, управление работает, а после
 * выхода геометрия возвращается.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

function mainBounds(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().startsWith('file://'),
    );
    return win ? win.getBounds() : null;
  });
}

/**
 * Wayland-композиторы (и некоторые тайловые WM) игнорируют setBounds.
 * Проверяем это заранее: на таких системах проверяем интерфейс, но не размеры.
 */
function boundsRespected(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().startsWith('file://'),
    );
    if (!win) return false;
    const original = win.getBounds();
    const minimum = win.getMinimumSize();
    win.setMinimumSize(240, 220);
    win.setBounds({ x: original.x, y: original.y, width: 777, height: 555 });
    const changed = win.getBounds();
    win.setBounds(original);
    win.setMinimumSize(minimum[0], minimum[1]);
    return Math.abs(changed.width - 777) <= 4 && Math.abs(changed.height - 555) <= 4;
  });
}

test('PiP: автолистание, переключение и адаптивный размер', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-pip-'));
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

    await expect(page.locator('#pipbar')).toBeHidden();
    await expect(page.locator('#titlebar')).toBeVisible();

    // На Wayland размер и позицию окна решает композитор, поэтому проверяем
    // только интерфейс. На X11/Windows/macOS (и в CI под xvfb) — ещё и размеры.
    const isWayland = await app.evaluate(() => process.env.XDG_SESSION_TYPE === 'wayland');
    const canResize = !isWayland && (await boundsRespected(app));
    const before = await mainBounds(app);
    expect(before).not.toBeNull();

    // Подкладываем видео и кнопки ленты вместо настоящего TikTok.
    await site.evaluate(() => {
      const video = document.createElement('video');
      video.id = 'fake-video';
      video.style.width = '320px';
      video.style.height = '180px';
      document.body.append(video);

      window.__navClicks = 0;

      const next = document.createElement('button');
      next.dataset.e2e = 'feed-navigation-next';
      next.addEventListener('click', () => {
        window.__navClicks += 1;
      });
      document.body.append(next);

      const prev = document.createElement('button');
      prev.dataset.e2e = 'feed-navigation-prev';
      prev.addEventListener('click', () => {
        window.__navClicks -= 1;
      });
      document.body.append(prev);
    });

    await page.evaluate(() => window.octo.cmd('pip'));
    await expect(page.locator('#pipbar')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-pip/);
    await expect(page.locator('#titlebar')).toBeHidden();

    if (canResize) {
      await expect.poll(async () => (await mainBounds(app)).width).toBeLessThan(before.width);
      await expect.poll(async () => (await mainBounds(app)).height).toBeLessThan(before.height);
    }

    // Автолистание: конец ролика сам нажимает «следующее видео».
    await site.evaluate(() => {
      document
        .getElementById('fake-video')
        .dispatchEvent(new window.Event('ended', { bubbles: true }));
    });
    await expect.poll(() => site.evaluate(() => window.__navClicks), { timeout: 5000 }).toBe(1);

    // Назад/вперёд работают даже чаще, чем раз в секунду: ручное переключение
    // не должно попадать под защиту от двойного автолистания.
    await page.click('#btnPipNext');
    await expect.poll(() => site.evaluate(() => window.__navClicks)).toBe(2);
    await page.click('#btnPipPrev');
    await expect.poll(() => site.evaluate(() => window.__navClicks)).toBe(1);

    // Автолистание по умолчанию включено и переключается из полосы PiP.
    await expect(page.locator('#btnPipAuto')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#btnPipAuto');
    await expect(page.locator('#btnPipAuto')).toHaveAttribute('aria-pressed', 'false');
    await page.click('#btnPipAuto');
    await expect(page.locator('#btnPipAuto')).toHaveAttribute('aria-pressed', 'true');

    // Адаптивный режим возвращает окну расчётный размер после ручного ресайза.
    if (canResize) {
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().startsWith('file://'),
        );
        win.setBounds({ x: 20, y: 20, width: 260, height: 300 });
      });
    }
    await page.click('#btnPipAdaptive');
    await expect(page.locator('#btnPipAdaptive')).toHaveAttribute('aria-pressed', 'true');
    if (canResize) {
      await expect.poll(async () => (await mainBounds(app)).width).toBeGreaterThan(240);
      await expect.poll(async () => (await mainBounds(app)).height).toBeGreaterThan(350);
    }
    await page.click('#btnPipAdaptive');
    await expect(page.locator('#btnPipAdaptive')).toHaveAttribute('aria-pressed', 'false');

    // Выход возвращает обычную полосу и прежнюю геометрию окна.
    await page.evaluate(() => window.octo.cmd('pipClose'));
    await expect(page.locator('#pipbar')).toBeHidden();
    await expect(page.locator('#titlebar')).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/is-pip/);

    if (canResize) {
      await expect.poll(async () => (await mainBounds(app)).width).toBe(before.width);
      await expect.poll(async () => (await mainBounds(app)).height).toBe(before.height);
    }

    // Настройки PiP доступны и в панели функций.
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="playback"]').click();
    await expect(page.locator('#rowPipAuto')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#rowPipAdaptive')).toHaveAttribute('aria-checked', 'false');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
