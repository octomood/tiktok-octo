'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { createZip, readZip } = require('../src/main/plugins/zip');

/**
 * Плагины в живом Electron:
 *  • dev-плагин проходит манифест и аудит, запускается в скрытом хосте;
 *  • команда и строка панели появляются в интерфейсе и работают;
 *  • страница получает безопасный скрипт через изолированный мир;
 *  • отдельный менеджер открывается, показывает установленные и настройки.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('плагин, команды, панель и менеджер', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-plugins-'));
  const devDir = path.join(userData, 'dev-plugins');
  fs.mkdirSync(devDir, { recursive: true });
  fs.cpSync(
    path.join(__dirname, '..', 'plugins', 'examples', 'hello-octo'),
    path.join(devDir, 'hello'),
    {
      recursive: true,
    },
  );

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
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    // Хост плагина — отдельное скрытое окно на octo-plugin://.
    const host = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('octo-plugin://app.octo.hello/'),
      'хост плагина',
    );
    expect(host).toBeTruthy();

    // onPageReady выполняется в изолированном мире и ставит маркер в DOM.
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-hello')))
      .toBe('1');

    // Панель функций: плагин виден, включён и добавил свою строку.
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="plugins"]').click();
    await expect(page.locator('#panelPlugins')).toContainText('Hello octo');
    await expect(page.locator('#panelPlugins [data-plugin-toggle]')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const pluginRow = page
      .locator('#panelPluginActions .panel-row')
      .filter({ hasText: 'Посчитать видео' });
    await expect(pluginRow).toBeVisible();
    await pluginRow.click();
    await expect(page.locator('#pageTitle')).toContainText('Hello octo: Видео на странице: 0');

    // Команда из палитры/плагина идёт через общий диспетчер команд.
    await page.evaluate(() => window.octo.cmd('plugin:app.octo.hello:hello'));
    await expect(page.locator('#pageTitle')).toContainText('Привет из плагина!');

    // Выключение плагина снимает строки и останавливает команды.
    await page.locator('#panelPlugins [data-plugin-toggle]').click();
    await expect(page.locator('#panelPlugins [data-plugin-toggle]')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(page.locator('#panelPluginActions .panel-row')).toHaveCount(0);

    // Включение возвращает плагин без перезапуска приложения.
    await page.locator('#panelPlugins [data-plugin-toggle]').click();
    await expect(page.locator('#panelPluginActions .panel-row')).toHaveCount(1);

    // Отдельный менеджер: установленные, отчёт и настройки.
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );

    await expect(manager.locator('[data-page="catalog"]')).toBeVisible();
    await manager.locator('#btnRefresh').click();
    await expect(manager.locator('#catalogList')).toContainText('Hello octo');
    await expect(manager.locator('#catalogList')).toContainText('Установлено');

    await manager.locator('[data-tab="installed"]').click();
    await expect(manager.locator('#installedList')).toContainText('Hello octo');
    await expect(manager.locator('#installedList')).toContainText('Скрипты на странице');
    await expect(manager.locator('#installedList')).toContainText('замечаний нет');
    await expect(manager.locator('#installedList .plugin-logs')).toContainText('активирован');

    await manager.locator('[data-tab="settings"]').click();
    await expect(manager.locator('#switchAutoUpdate')).toHaveAttribute('aria-checked', 'true');
    await manager.locator('#switchAutoUpdate').click();
    await expect(manager.locator('#switchAutoUpdate')).toHaveAttribute('aria-checked', 'false');

    await manager.evaluate(() => {
      window.octoPlugins.action('close').catch(() => {});
    });
    await expect
      .poll(() =>
        app.windows().some((candidate) => candidate.url().endsWith('/renderer/plugins.html')),
      )
      .toBe(false);

    // Встроенная документация работает офлайн и без публикации.
    await page.evaluate(() => window.octo.cmd('pluginDocs'));
    const docs = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins-docs/index.html'),
      'встроенная документация',
    );
    await expect(docs.locator('h1')).toContainText('Плагины TikTok octo');
    await docs.locator('.topnav a[href="publishing.html"]').click();
    await expect.poll(() => docs.url()).toContain('/renderer/plugins-docs/publishing.html');
    await expect(docs.locator('h1')).toContainText('Правила публикации плагинов');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('404 каталога — это нейтральное состояние, а не ошибка', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-no-catalog-'));
  const server = http.createServer((_request, response) => {
    response.writeHead(404, { connection: 'close' });
    response.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_PLUGIN_REGISTRY: `http://127.0.0.1:${port}/registry.json`,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );

    await manager.locator('#btnRefresh').click();
    await expect(manager.locator('#catalogMeta')).toContainText('пока не опубликован');
    await expect(manager.locator('#catalogEmpty')).toContainText('Локальная установка');
    await expect(manager.locator('#notice')).toBeHidden();
  } finally {
    if (app) await app.close();
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('установка из каталога: скачивание, проверка, хэш и запуск', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-catalog-'));
  const packageFile = path.join(
    __dirname,
    '..',
    'plugins',
    'packages',
    'app.octo.hello-1.0.0.octoplugin',
  );
  const packageBuffer = fs.readFileSync(packageFile);
  const crypto = require('node:crypto');
  const sha256 = crypto.createHash('sha256').update(packageBuffer).digest('hex');

  // Версия 1.0.1 для проверки обновления: тот же код, новый манифест.
  const nextFiles = readZip(packageBuffer);
  const nextManifest = JSON.parse(nextFiles.get('plugin.json').toString('utf8'));
  nextManifest.version = '1.0.1';
  nextManifest.changelog = 'Тестовое обновление';
  nextFiles.set('plugin.json', Buffer.from(JSON.stringify(nextManifest)));
  const nextBuffer = createZip(nextFiles);
  const nextSha = crypto.createHash('sha256').update(nextBuffer).digest('hex');

  const server = http.createServer((request, response) => {
    const isNext = request.url?.includes('next.octoplugin');
    if (!request.url?.endsWith('.octoplugin')) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    const body = isNext ? nextBuffer : packageBuffer;
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': body.length,
      connection: 'close',
    });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const registryFile = path.join(userData, 'registry.json');
  fs.writeFileSync(
    registryFile,
    JSON.stringify({
      schema: 1,
      updatedAt: new Date().toISOString(),
      plugins: [
        {
          id: 'app.octo.hello',
          name: 'Hello octo',
          author: { name: 'octo', url: 'https://github.com/octomood' },
          description: 'Пример плагина из локального каталога.',
          license: 'MIT',
          categories: ['demo'],
          releases: [
            {
              version: '1.0.0',
              minAppVersion: '0.5.0',
              download: `http://127.0.0.1:${port}/app.octo.hello-1.0.0.octoplugin`,
              sha256,
              size: packageBuffer.length,
              publishedAt: new Date().toISOString(),
              changelog: 'Первый выпуск',
              permissions: ['page:css', 'page:script'],
              networkHosts: [],
            },
          ],
        },
      ],
    }),
  );

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_PLUGIN_REGISTRY_FILE: registryFile,
      },
    });

    await app.firstWindow();
    // В тесте нет человека, который нажмёт «Установить» в нативном диалоге.
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
      return true;
    });

    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );

    await manager.locator('#btnRefresh').click();
    await expect(manager.locator('#catalogList')).toContainText('Hello octo');
    await expect(manager.locator('#catalogCategories')).toContainText('demo');
    await manager.locator('#catalogList .primary').click();

    await expect
      .poll(() =>
        app
          .windows()
          .some((candidate) => candidate.url().startsWith('octo-plugin://app.octo.hello/')),
      )
      .toBe(true);

    await manager.locator('[data-tab="installed"]').click();
    await expect(manager.locator('#installedList')).toContainText('Hello octo');
    await expect(manager.locator('#installedList')).toContainText('каталог');
    await expect(manager.locator('#installedList')).toContainText('Скрипты на странице');
    await expect(manager.locator('#installedList')).toContainText('замечаний нет');

    // Файлы действительно записаны в профиль, а не только показаны в UI.
    const installedDir = path.join(userData, 'plugins', 'app.octo.hello');
    expect(fs.existsSync(path.join(installedDir, 'index.js'))).toBe(true);
    const stateFile = path.join(userData, 'plugins-state.json');
    let saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(saved.plugins['app.octo.hello']).toBeTruthy();
    expect(saved.plugins['app.octo.hello'].sha256).toBe(sha256);
    expect(saved.plugins['app.octo.hello'].source).toBe('registry');

    // Обновление каталога: 1.0.0 → 1.0.1 с подтверждением и заменой файлов.
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    registry.plugins[0].releases.push({
      version: '1.0.1',
      minAppVersion: '0.5.0',
      download: `http://127.0.0.1:${port}/next.octoplugin`,
      sha256: nextSha,
      size: nextBuffer.length,
      publishedAt: new Date().toISOString(),
      changelog: 'Тестовое обновление',
      permissions: ['page:css', 'page:script'],
      networkHosts: [],
    });
    fs.writeFileSync(registryFile, JSON.stringify(registry));

    await manager.locator('[data-tab="catalog"]').click();
    await manager.locator('#btnRefresh').click();
    await expect(manager.locator('#catalogList')).toContainText('Обновить до 1.0.1');
    await manager.locator('#catalogList .primary').click();

    await manager.locator('[data-tab="installed"]').click();
    await expect(manager.locator('#installedList')).toContainText('v1.0.1');
    saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(saved.plugins['app.octo.hello'].version).toBe('1.0.1');
    expect(saved.plugins['app.octo.hello'].sha256).toBe(nextSha);
  } finally {
    if (app) await app.close();
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
