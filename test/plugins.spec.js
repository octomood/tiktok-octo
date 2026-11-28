'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { createZip } = require('../src/main/plugins/zip');

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
    await page.waitForLoadState('load');
    await page.click('#btnPanel');
    await expect(page.locator('#panel')).toBeVisible();
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

    // Быстрое меню показывает только активные плагины и их действия.
    await page.click('#btnPluginsActive');
    await expect(page.locator('#pluginsPopover')).toBeVisible();
    await expect(page.locator('#pluginsPopoverList')).toContainText('Hello octo');
    const quickRow = page
      .locator('#pluginsPopoverList .active-plugin-action')
      .filter({ hasText: 'Посчитать видео' });
    await expect(quickRow).toBeVisible();
    await quickRow.click();
    await expect(page.locator('#pageTitle')).toContainText('Hello octo: Видео на странице: 0');
    await page.click('#btnPluginsPopoverClose');
    await expect(page.locator('#popover')).toBeHidden();

    // Менеджер плагинов открывается оверлеем, как меню функций.
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = page.locator('#pluginsPanel');
    await expect(manager).toBeVisible();

    // Каталог заменён ссылкой на Telegram-канал, кнопка уводит в него.
    await expect(manager.locator('[data-page="catalog"]')).toBeVisible();
    await expect(manager.locator('#telegramPanel')).toContainText('t.me/octo_plugins');
    await expect(manager.locator('#catalogList')).toHaveCount(0);

    await app.evaluate(({ shell }) => {
      global.__openedUrls = [];
      shell.openExternal = async (url) => {
        global.__openedUrls.push(url);
      };
    });
    await manager.locator('#btnTelegram').click();
    await expect
      .poll(() => app.evaluate(() => global.__openedUrls))
      .toEqual(['https://t.me/octo_plugins']);

    await manager.locator('[data-tab="installed"]').click();
    await expect(manager.locator('#installedList')).toContainText('Hello octo');
    await expect(manager.locator('#installedList')).toContainText('Скрипты на странице');
    await expect(manager.locator('#installedList')).toContainText('замечаний нет');
    await expect(manager.locator('#installedList .plugin-logs')).toContainText('активирован');
    await expect(manager.locator('#installedList')).toContainText('Хранилище:');
    await expect(manager.locator('#installedList')).toContainText('Команды: 1 из 64');

    await manager.locator('[data-tab="settings"]').click();
    await expect(manager.locator('#switchRequireSignatures')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await manager.locator('#switchRequireSignatures').click();
    await expect(manager.locator('#switchRequireSignatures')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await manager.locator('#switchRequireSignatures').click();
    await expect(manager.locator('#switchRequireSignatures')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await page.evaluate(() => {
      window.octoPlugins.action('close').catch(() => {});
    });
    await expect(manager).toBeHidden();

    // Встроенная документация работает офлайн и без публикации.
    await page.evaluate(() => window.octo.cmd('pluginDocs'));
    const docs = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins-docs/index.html'),
      'встроенная документация',
    );
    await expect(docs.locator('h1')).toContainText('Плагины TikTok Octo');
    await docs.locator('.topnav a[href="publishing.html"]').click();
    await expect.poll(() => docs.url()).toContain('/renderer/plugins-docs/publishing.html');
    await expect(docs.locator('h1')).toContainText('Правила публикации плагинов');

    // Плагин под будущую версию приложения не устанавливается: иначе он висел
    // бы в списке включённым, а host.load() отказывал бы при каждом запуске.
    const tooNew = createZip(
      new Map([
        [
          'plugin.json',
          JSON.stringify({
            id: 'app.octo.too-new',
            name: 'Слишком новый',
            version: '1.0.0',
            apiVersion: 1,
            minAppVersion: '99.0.0',
            description: 'Плагин для будущей версии приложения',
            author: { name: 'octo' },
            license: 'MIT',
            main: 'index.js',
            permissions: ['page:css'],
          }),
        ],
        ['index.js', "octo.page.injectCSS('body { outline: 1px solid red; }');"],
        ['README.md', '# Too new'],
      ]),
    );
    const tooNewFile = path.join(userData, 'too-new.octoplugin');
    fs.writeFileSync(tooNewFile, tooNew);

    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, tooNewFile);

    await page.evaluate(() => window.octo.cmd('pluginInstallFile'));
    await expect(page.locator('#appDialog')).toBeVisible();
    await expect(page.locator('#appDialogTitle')).toContainText('99.0.0');
    await page.locator('#appDialogActions button').first().click();
    await expect(page.locator('#appDialog')).toBeHidden();
    const pluginsStateFile = path.join(userData, 'plugins-state.json');
    const savedPlugins = fs.existsSync(pluginsStateFile)
      ? fs.readFileSync(pluginsStateFile, 'utf8')
      : '';
    expect(savedPlugins).not.toContain('app.octo.too-new');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('обновление файлом показывает смену издателя, новые права и хосты', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-plugin-update-'));
  const pack = (version, author, extra = {}) => {
    const file = path.join(userData, `trust-${version}.octoplugin`);
    fs.writeFileSync(
      file,
      createZip(
        new Map([
          [
            'plugin.json',
            JSON.stringify({
              id: 'app.octo.update-trust',
              name: 'Издатель',
              version,
              apiVersion: 1,
              minAppVersion: '0.5.0',
              description: 'Проверка обновления файлом',
              author: { name: author },
              license: 'MIT',
              main: 'index.js',
              permissions: ['page:css'],
              ...extra,
            }),
          ],
          ['index.js', "octo.page.injectCSS('body { outline: 1px solid red; }');"],
        ]),
      ),
    );
    return file;
  };
  const v1 = pack('1.0.0', 'octo');
  const v2 = pack('1.1.0', 'mallory', {
    permissions: ['page:css', 'network'],
    networkHosts: ['api.example.com'],
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
      },
    });
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );

    const capturedDialogs = [];
    const install = async (file, buttonLabels) => {
      await app.evaluate(({ dialog }, picked) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] });
      }, file);
      const pending = page.evaluate(() => window.octoPlugins.action('installFile'));
      for (const label of buttonLabels) {
        await expect(page.locator('#appDialog')).toBeVisible();
        capturedDialogs.push({
          eyebrow: await page.locator('#appDialogEyebrow').textContent(),
          title: await page.locator('#appDialogTitle').textContent(),
          body: await page.locator('#appDialogBody').textContent(),
        });
        await page.locator('#appDialogActions button', { hasText: label }).click();
      }
      await expect(page.locator('#appDialog')).toBeHidden();
      return pending;
    };
    const savedVersion = () => {
      const file = path.join(userData, 'plugins-state.json');
      if (!fs.existsSync(file)) return '';
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      return saved.plugins?.['app.octo.update-trust']?.version || '';
    };

    expect(await install(v1, ['Установить'])).toMatchObject({ ok: true });
    expect(savedVersion()).toBe('1.0.0');

    // Чужой автор: сначала отдельное предупреждение, «Отмена» оставляет 1.0.0.
    capturedDialogs.length = 0;
    expect(await install(v2, ['Отмена'])).toMatchObject({ cancelled: true });
    expect(capturedDialogs).toHaveLength(1);
    expect(capturedDialogs[0].eyebrow).toBe('Другой издатель');
    expect(capturedDialogs[0].body).toContain('«mallory»');
    expect(capturedDialogs[0].body).toContain('не передадутся');
    expect(savedVersion()).toBe('1.0.0');

    // Согласие: второй диалог показывает новые права и хосты, данные не переходят.
    capturedDialogs.length = 0;
    expect(await install(v2, ['Продолжить без данных', 'Обновить'])).toMatchObject({ ok: true });
    expect(savedVersion()).toBe('1.1.0');
    expect(capturedDialogs).toHaveLength(2);
    expect(capturedDialogs[1].body).toContain('Обновление с версии 1.0.0 до 1.1.0.');
    expect(capturedDialogs[1].body).toContain('Издатель сменился');
    expect(capturedDialogs[1].body).toContain('Новые разрешения');
    expect(capturedDialogs[1].body).toContain('Новые сетевые хосты');
    expect(capturedDialogs[1].body).toContain('api.example.com');

    // Просмотр кода плагина доступен прямо в диалоге установки/обновления.
    const v3 = pack('1.2.0', 'mallory');
    await app.evaluate(({ dialog }, picked) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] });
    }, v3);
    const installPending = page.evaluate(() => window.octoPlugins.action('installFile'));
    await expect(page.locator('#appDialog')).toBeVisible();
    await page.locator('#appDialogCodeToggle').click();
    await expect(page.locator('#appDialogCodeBody')).toBeVisible();
    await expect(page.locator('.app-dialog-code-view')).toContainText('octo.page.injectCSS');
    await page.locator('.app-dialog-code-tab', { hasText: 'plugin.json' }).click();
    await expect(page.locator('.app-dialog-code-view')).toContainText('"app.octo.update-trust"');
    await page.locator('#appDialogActions button', { hasText: 'Отмена' }).click();
    await expect(page.locator('#appDialog')).toBeHidden();
    expect(await installPending).toMatchObject({ cancelled: true });
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
