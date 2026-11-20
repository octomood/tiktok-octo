'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { validateManifest } = require('../src/main/plugins/manifest');

/**
 * Плагин «Градиентная обводка» в живом Electron:
 *  • рамка рисуется вокруг карточки ролика через ::after;
 *  • настройки из карточки плагина меняют толщину, цвета и анимацию;
 *  • область «край окна» переносит рамку на html::after;
 *  • главный выключатель возвращает страницу в исходный вид.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

const PAGE = [
  '<!doctype html>',
  '<html lang="ru"><head><meta charset="utf-8" /><title>Лента — octo</title>',
  '<style>#card { display: block; width: 320px; height: 560px; background: #111; }</style>',
  '</head><body>',
  '<article id="card" data-e2e="recommend-list-item-container"><video></video></article>',
  '</body></html>',
].join('');

function probe(site, pseudo) {
  return site.evaluate((target) => {
    const style = getComputedStyle(document.querySelector(target), '::after');
    return {
      content: style.content,
      padding: style.paddingTop,
      radius: style.borderTopLeftRadius,
      background: style.backgroundImage,
      animation: style.animationName,
      filter: style.filter,
    };
  }, pseudo);
}

async function setSetting(manager, key, value) {
  const result = await manager.evaluate(
    (payload) => window.octoPlugins.action('pluginSettings', payload),
    { id: 'app.octo.gradient-frame', key, value },
  );
  expect(result?.ok).toBe(true);
}

test('плагин «Градиентная обводка»: CSS и настройки', async () => {
  test.setTimeout(90_000);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'plugins', 'gradient-frame', 'plugin.json'), 'utf8'),
  );
  expect(validateManifest(manifest).ok).toBe(true);

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-gradient-frame-'));
  const devDir = path.join(userData, 'dev-plugins');
  fs.mkdirSync(devDir, { recursive: true });
  fs.cpSync(
    path.join(__dirname, '..', 'plugins', 'gradient-frame'),
    path.join(devDir, 'gradient-frame'),
    { recursive: true },
  );

  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
    response.end(PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const home = `http://127.0.0.1:${server.address().port}/`;

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
      (candidate) => candidate.url().startsWith('octo-plugin://app.octo.gradient-frame/'),
      'хост плагина',
    );

    // По умолчанию рамка стоит вокруг карточки ролика.
    await expect
      .poll(() => probe(site, '#card'), { timeout: 15000 })
      .toMatchObject({ padding: '4px', radius: '18px', animation: 'octo-gf-spin' });
    await expect.poll(() => probe(site, '#card').then((style) => style.content)).not.toBe('none');
    await expect
      .poll(() => probe(site, '#card').then((style) => style.background))
      .toContain('conic-gradient');

    // Настройки из карточки плагина применяются на лету.
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );
    await manager.locator('[data-tab="installed"]').click();
    const card = manager.locator('.card--wide').filter({ hasText: 'Градиентная обводка' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Толщина, px');
    await expect(card).toContainText('Палитра');

    // Настройки из карточки плагина применяются на лету. UI менеджера
    // перерисовывается после каждого изменения, поэтому меняем через тот же
    // IPC, который вызывает и сама карточка.
    await setSetting(manager, 'thickness', 10);
    await expect.poll(() => probe(site, '#card').then((style) => style.padding)).toBe('10px');

    await setSetting(manager, 'palette', 'custom');
    await setSetting(manager, 'color_one', '#00ff00');
    await expect
      .poll(() => probe(site, '#card').then((style) => style.background))
      .toContain('rgb(0, 255, 0)');

    await setSetting(manager, 'mode', 'flow');
    await expect
      .poll(() => probe(site, '#card').then((style) => style.animation))
      .toBe('octo-gf-flow');

    // Край окна: рамка переезжает на html::after, а карточка очищается.
    await setSetting(manager, 'scope', 'window');
    await expect
      .poll(() =>
        site.evaluate(() => {
          const root = getComputedStyle(document.documentElement, '::after');
          return root.backgroundImage.includes('linear-gradient');
        }),
      )
      .toBe(true);
    await expect.poll(() => probe(site, '#card').then((style) => style.content)).toBe('none');

    // Главный выключатель убирает и возвращает эффект.
    await setSetting(manager, 'enabled', false);
    await expect
      .poll(() =>
        site.evaluate(
          () => getComputedStyle(document.documentElement, '::after').content === 'none',
        ),
      )
      .toBe(true);

    await setSetting(manager, 'enabled', true);
    await expect
      .poll(() =>
        site.evaluate(
          () => getComputedStyle(document.documentElement, '::after').content !== 'none',
        ),
      )
      .toBe(true);
  } finally {
    if (app) await app.close();
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
