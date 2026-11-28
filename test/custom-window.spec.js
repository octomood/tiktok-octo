'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Проверка кастомных безрамочных окон, MD3-диалогов и контекстного меню.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('безрамочные окна, кастомные диалоги и MD3-контекстное меню', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-custom-win-'));
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
      (candidate) => candidate.url().endsWith('/index.html'),
      'главное окно',
    );
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank', 'страница сайта');

    // Главное окно без нативного менюбара, кнопки окна видны.
    const mainMenuVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      return win ? win.isMenuBarVisible() : true;
    });
    expect(mainMenuVisible).toBe(false);
    await expect(page.locator('#winControls')).toBeVisible();
    await expect(page.locator('#btnMin')).toBeVisible();
    await expect(page.locator('#btnMax')).toBeVisible();
    await expect(page.locator('#btnClose')).toBeVisible();

    // Кастомный MD3-диалог поверх главного окна («О программе»).
    await app.evaluate(({ app: electronApp }) => {
      const { showAbout } = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/about.js`,
      );
      const { ctx } = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/app-context.js`,
      );
      showAbout(ctx.win);
    });
    await expect(page.locator('#appDialog')).toBeVisible();
    await expect(page.locator('#appDialogEyebrow')).toHaveText('О программе');
    await expect(page.locator('#appDialogTitle')).toHaveText('TikTok Octo');
    await page.locator('#appDialogActions button', { hasText: 'ОК' }).click();
    await expect(page.locator('#appDialog')).toBeHidden();

    // Кастомное MD3-контекстное меню поверх WebContentsView.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL() === 'about:blank',
      );
      view.webContents.emit('context-menu', {}, { x: 120, y: 120 });
    });
    const ctxMenuPage = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/context-menu.html'),
      'контекстное меню',
    );
    await expect(ctxMenuPage.locator('#ctxMenu')).toBeVisible();
    await expect(ctxMenuPage.locator('.ctx-item', { hasText: 'Обновить' })).toBeVisible();
    await expect(ctxMenuPage.locator('.ctx-item', { hasText: 'Проверить элемент' })).toBeVisible();

    await app.evaluate(({ app: electronApp }) => {
      const contextMenu = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/context-menu.js`,
      );
      contextMenu.close();
    });
    const menuIsOpen = await app.evaluate(({ app: electronApp }) => {
      const contextMenu = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/context-menu.js`,
      );
      return contextMenu.isOpen();
    });
    expect(menuIsOpen).toBe(false);

    // Документация открывается без системного менюбара и с кастомной шапкой.
    await page.evaluate(() => window.octo.cmd('pluginDocs'));
    const docsPage = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins-docs/index.html'),
      'окно документации',
    );
    await expect(docsPage.locator('#octoWinbar')).toBeVisible();
    const docsMenuVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/plugins-docs/index.html'),
      );
      return win ? win.isMenuBarVisible() : true;
    });
    expect(docsMenuVisible).toBe(false);

    // Отдельное окно диалога (fallback), когда главное окно скрыто.
    const dlgPromise = app.evaluate(({ app: electronApp }) => {
      const { ctx } = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/app-context.js`,
      );
      const { showMessageBox } = process.mainModule.require(
        `${electronApp.getAppPath()}/src/main/dialogs.js`,
      );
      ctx.win.hide();
      return showMessageBox({
        type: 'question',
        title: 'Проверка',
        message: 'Отдельное окно?',
        buttons: ['Подтвердить', 'Отмена'],
        defaultId: 0,
        cancelId: 1,
      });
    });
    const dlgPage = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/dialog.html'),
      'отдельное окно диалога',
    );
    await expect(dlgPage.locator('#appDialogTitle')).toHaveText('Отдельное окно?');
    await dlgPage.locator('#appDialogActions button', { hasText: 'Подтвердить' }).click();
    expect(await dlgPromise).toMatchObject({ response: 0 });
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
