'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Hot reload dev-плагинов: приложение следит за OCTO_PLUGIN_DEV_DIR и
 * перезагружает плагин, когда меняется его файл. Перезапуск не нужен.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('dev-плагин перезагружается при изменении файла', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-devwatch-'));
  const devDir = path.join(userData, 'dev-plugins');
  fs.mkdirSync(devDir, { recursive: true });
  const pluginDir = path.join(devDir, 'hello');
  fs.cpSync(path.join(__dirname, '..', 'plugins', 'examples', 'hello-octo'), pluginDir, {
    recursive: true,
  });

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_PLUGIN_DEV_DIR: devDir,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    await page.click('#btnPanel');
    await page.locator('[data-cat-head="plugins"]').click();
    await expect(
      page.locator('#panelPluginActions .panel-row').filter({ hasText: 'Посчитать видео' }),
    ).toBeVisible();

    const source = path.join(pluginDir, 'index.js');
    const text = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(source, text.replace('Посчитать видео на странице', 'Посчитать видео 2'));

    await expect
      .poll(
        () =>
          page
            .locator('#panelPluginActions .panel-row')
            .filter({ hasText: 'Посчитать видео 2' })
            .count(),
        { timeout: 15000 },
      )
      .toBe(1);

    // Старая строка снята: команды и панель обновились, а не задвоились.
    await expect(
      page.locator('#panelPluginActions .panel-row').filter({ hasText: 'Посчитать видео' }),
    ).toHaveCount(1);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
