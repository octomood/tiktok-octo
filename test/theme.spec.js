'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * «Тёмная тема везде» проверяем на белой странице без TikTok: на сайте тему
 * перекрашивают cookie, а Business Suite и служебные экраны — auto dark mode
 * Chromium. Смотрим реальный пиксель кадра, а не computed style: auto dark
 * работает на уровне отрисовки.
 */

const WHITE_PAGE = `<!doctype html>
<html><body style="margin:0;background:#fff;color:#111">
  <h1>Белая страница</h1>
</body></html>`;

function brightness([r, g, b]) {
  return (r + g + b) / 3;
}

async function findWindow(app, predicate) {
  let found = app.windows().find(predicate);
  for (let attempt = 0; attempt < 80 && !found; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    found = app.windows().find(predicate);
  }
  return found;
}

test('тёмная тема: cookie для всех поддоменов и auto dark на белых страницах', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(WHITE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-theme-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: url,
      },
    });

    await app.firstWindow();
    const page = await findWindow(app, (candidate) => candidate.url().startsWith('file://'));
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();
    const view = await findWindow(app, (candidate) => candidate.url().startsWith(url));
    expect(view, 'страница сайта не появилась').toBeTruthy();

    // capturePage может ругнуться UnknownVizError прямо во время перезагрузки
    // или смены темы — это не падение приложения, просто пробуем ещё раз.
    const capturePixel = () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const content = win.contentView.children[0].webContents;
        const image = await content.capturePage();
        const size = image.getSize();
        const bitmap = image.toBitmap();
        const x = Math.max(0, size.width - 12);
        const y = Math.max(0, size.height - 12);
        const index = (y * size.width + x) * 4;
        return [bitmap[index], bitmap[index + 1], bitmap[index + 2]];
      });

    const sample = async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          return await capturePixel();
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
      throw lastError;
    };

    const cookies = () =>
      app.evaluate(({ session }) =>
        session.fromPartition('persist:octo-tiktok').cookies.get({ name: 'tiktok_webapp_theme' }),
      );

    // Доменная cookie нужна Business Suite и другим поддоменам.
    await expect
      .poll(async () => (await cookies()).some((cookie) => cookie.value === 'dark'))
      .toBe(true);
    await expect
      .poll(async () =>
        (await cookies()).some(
          (cookie) => String(cookie.domain).includes('tiktok.com') && cookie.domain.startsWith('.'),
        ),
      )
      .toBe(true);

    // Белая страница затемняется на уровне отрисовки.
    await expect.poll(async () => brightness(await sample())).toBeLessThan(80);

    // Выключение снимает и cookie, и auto dark mode.
    await page.evaluate(() => window.octo.cmd('cosmetic', 'dark-theme'));
    await expect.poll(async () => (await cookies()).length).toBe(0);
    await expect.poll(async () => brightness(await sample())).toBeGreaterThan(220);

    // Включение возвращает тему без перезапуска приложения.
    await page.evaluate(() => window.octo.cmd('cosmetic', 'dark-theme'));
    await expect
      .poll(async () => (await cookies()).some((cookie) => cookie.value === 'dark'))
      .toBe(true);
    await expect.poll(async () => brightness(await sample())).toBeLessThan(80);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
