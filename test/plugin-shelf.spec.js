'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Плагин «Полка» в живом Electron:
 *  • страница сохраняется вместе с заголовком и автором из адреса;
 *  • на странице появляется метка, а в палитре — команда закладки;
 *  • повторное сохранение не плодит дубли;
 *  • очистка требует подтверждения и убирает всё.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('плагин «Полка»: сохранение, метка, команда и очистка', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-shelf-'));
  const devDir = path.join(userData, 'dev-plugins');
  fs.mkdirSync(devDir, { recursive: true });
  fs.cpSync(path.join(__dirname, '..', 'plugins', 'shelf'), path.join(devDir, 'shelf'), {
    recursive: true,
  });

  // Локальная страница вместо TikTok: тот же адрес видео, но без сети.
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      connection: 'close',
    });
    response.end(
      [
        '<!doctype html>',
        '<html lang="ru"><head><meta charset="utf-8" />',
        '<title>Тихий океан — octo</title></head>',
        '<body><h1>Тихий океан</h1></body></html>',
      ].join(''),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const home = `http://127.0.0.1:${port}/@octo/video/731`;

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: home,
        OCTO_PLUGIN_DEV_DIR: devDir,
        OCTO_PLUGIN_REGISTRY_FILE: path.join(__dirname, '..', 'plugins', 'registry.json'),
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
      (candidate) => candidate.url() === home,
      'страница сайта',
    );
    await expect.poll(() => site.evaluate(() => document.readyState === 'complete')).toBe(true);

    await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('octo-plugin://app.octo.shelf/'),
      'хост плагина',
    );

    // Панель функций: плагин насчитал ноль закладок и предлагает сохранить.
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="plugins"]').click();
    await expect(page.locator('#panelPlugins')).toContainText('Полка');

    const saveRow = page
      .locator('#panelPluginActions .panel-row')
      .filter({ hasText: 'Сохранить на полку' });
    await expect(saveRow).toContainText('(0)');
    await saveRow.click();

    await expect(page.locator('#pageTitle')).toContainText('Сохранил');
    await expect(page.locator('#pageTitle')).toContainText('Тихий океан');
    await expect(saveRow).toContainText('(1)');

    // Метка «На полке» ставится в изолированном мире страницы.
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-shelf')))
      .toBe('1');

    // Быстрое меню: закладка стала отдельным действием плагина.
    await page.click('#btnPluginsActive');
    await expect(page.locator('#pluginsPopover')).toBeVisible();
    await expect(page.locator('#pluginsPopoverList')).toContainText('@octo · Тихий океан');
    await page.click('#btnPluginsPopoverClose');
    await expect(page.locator('#popover')).toBeHidden();

    // Повторное сохранение видит дубль и не меняет счётчик. Панель уже
    // закрылась вместе с быстрым меню, поэтому идём через палитру команд.
    await page.evaluate(() => window.octo.cmd('plugin:app.octo.shelf:row:save'));
    await expect(page.locator('#pageTitle')).toContainText('Уже на полке');
    await expect(saveRow).toContainText('(1)');

    // Очистка в два шага: первый запуск только предупреждает.
    await page.evaluate(() => window.octo.cmd('plugin:app.octo.shelf:clear'));
    await expect(page.locator('#pageTitle')).toContainText('Нажмите ещё раз');
    await expect(saveRow).toContainText('(1)');

    await page.evaluate(() => window.octo.cmd('plugin:app.octo.shelf:clear'));
    await expect(page.locator('#pageTitle')).toContainText('Очистил полку');
    await expect(saveRow).toContainText('(0)');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-shelf')))
      .toBeNull();

    // Случайная закладка на пустой полке честно об этом говорит.
    await page.evaluate(() => window.octo.cmd('plugin:app.octo.shelf:row:random'));
    await expect(page.locator('#pageTitle')).toContainText('полка пуста');
  } finally {
    if (app) await app.close();
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
