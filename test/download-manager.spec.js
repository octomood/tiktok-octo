'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Отдельное окно менеджера загрузок: открывается командой, получает список из
 * main и закрывается своей кнопкой. Загрузку берём с локального сервера.
 */

const BODY = Buffer.alloc(48 * 1024, 3);

async function startServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'video/mp4', 'content-length': BODY.length });
    response.end(BODY);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/manager.mp4` };
}

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('менеджер загрузок: отдельное окно, список и закрытие', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-manager-'));
  const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-manager-out-'));
  const { server, url } = await startServer();
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_DOWNLOADS_DIR: downloadsDir,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await page.evaluate(() => window.octo.cmd('downloadManager'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/downloads.html'),
      'менеджер загрузок',
    );

    await expect(manager.locator('.manager-title')).toHaveText('Менеджер загрузок');
    await expect(manager.locator('#managerEmpty')).toBeVisible();

    // Загрузка с локального сервера — менеджер получает её из main.
    await site.evaluate(() => {
      document.title = 'Manager clip';
    });
    await page.evaluate(() => window.octo.cmd('downloadNamingAuto', true));
    await page.evaluate(() => window.octo.cmd('downloadTemplate', '{title}'));
    await app.evaluate(({ BrowserWindow }, target) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().endsWith('/index.html'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
      );
      view.webContents.downloadURL(target);
    }, url);

    await expect.poll(() => fs.readdirSync(downloadsDir).length).toBeGreaterThan(0);
    await expect(manager.locator('.manager-row')).toHaveCount(1, { timeout: 8000 });
    await expect(manager.locator('.manager-name')).toContainText('Manager clip');
    await expect(manager.locator('.manager-status')).toHaveText('готово');

    await manager.locator('#btnClose').click();
    await expect
      .poll(() => app.windows().some((candidate) => candidate.url().endsWith('/downloads.html')))
      .toBe(false);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(downloadsDir, { recursive: true, force: true });
  }
});
