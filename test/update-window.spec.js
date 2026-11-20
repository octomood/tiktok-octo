'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Окно обновления: предложение, фоновая загрузка, готовность и повтор.
 *
 * Сам updater с сетью не поднимаем: окно — отдельный слой, поэтому тест
 * подставляет состояние и проверяет кнопки через main. Реальный GitHub
 * Releases в тестах не трогаем.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

async function showUpdate(app, state) {
  await app.evaluate(({ app: electronApp }, next) => {
    const updateWindow = process.mainModule.require(
      `${electronApp.getAppPath()}/src/main/update-window.js`,
    );
    updateWindow.setHandlers({
      install() {
        global.__octoUpdateAction = 'install';
      },
      restart() {
        global.__octoUpdateAction = 'restart';
      },
    });
    updateWindow.show(next);
  }, state);
}

test('окно обновления: предложение, загрузка и перезапуск', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-update-'));
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

    await showUpdate(app, { phase: 'available', version: '9.9.9', percent: 0 });
    let update = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/update.html'),
      'окно обновления',
    );

    await expect(update.locator('#updateTitle')).toHaveText('Обновление приложения');
    await expect(update.locator('#updateMessage')).toHaveText('Доступна версия 9.9.9');
    await expect(update.locator('#updateHint')).toHaveText(
      'Скачать обновление сейчас? Загрузка пойдёт в фоне.',
    );
    await expect(update.locator('#btnAction')).toHaveText('Обновить');
    await expect(update.locator('#btnLater')).toHaveText('Позже');
    await expect(update.locator('#updateProgress')).toBeHidden();

    // Кнопка обновления уходит в main: сам updater начинает фоновую загрузку.
    await update.locator('#btnAction').click();
    await expect.poll(() => app.evaluate(() => global.__octoUpdateAction)).toBe('install');

    await showUpdate(app, { phase: 'downloading', version: '9.9.9', percent: 42 });
    await expect(update.locator('#updateMessage')).toHaveText('Загрузка обновления…');
    await expect(update.locator('#updateHint')).toHaveText(
      'Загрузка идёт в фоне, окно можно закрыть.',
    );
    await expect(update.locator('#updateProgress')).toBeVisible();
    await expect(update.locator('#updatePercent')).toHaveText('42 %');
    expect(await update.locator('#updateFill').evaluate((node) => node.style.width)).toBe('42%');
    await expect(update.locator('#btnAction')).toBeHidden();
    await expect(update.locator('#btnLater')).toHaveText('Скрыть');

    // Закрытие во время загрузки не отменяет её: окно откроется после установки.
    await update.locator('#btnClose').click();
    await expect.poll(() => update.isClosed()).toBe(true);

    await showUpdate(app, { phase: 'ready', version: '9.9.9', percent: 100 });
    update = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/update.html'),
      'окно готового обновления',
    );

    await expect(update.locator('#updateMessage')).toHaveText('Обновление готово');
    await expect(update.locator('#updateHint')).toHaveText('Перезапустить приложение сейчас?');
    await expect(update.locator('#btnAction')).toHaveText('Перезапустить');
    await expect(update.locator('#updatePercent')).toHaveText('100 %');

    await update.locator('#btnAction').click();
    await expect.poll(() => app.evaluate(() => global.__octoUpdateAction)).toBe('restart');

    await showUpdate(app, { phase: 'error', version: '9.9.9', percent: 0 });
    await expect(update.locator('#updateMessage')).toHaveText('Не удалось скачать обновление');
    await expect(update.locator('#updateHint')).toHaveText(
      'Проверьте соединение и попробуйте ещё раз.',
    );
    await expect(update.locator('#btnAction')).toHaveText('Повторить');
    await expect(update.locator('#btnLater')).toHaveText('Закрыть');
    await expect(update.locator('#updateProgress')).toBeHidden();

    await update.locator('#btnLater').click();
    await expect.poll(() => update.isClosed()).toBe(true);
  } finally {
    await app?.close();
  }
});
