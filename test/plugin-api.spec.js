'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Новые API плагинов: playback, feed, downloads, overlay, i18n, clipboard.
 * Плагин-фикстура ставится как dev и вызывает каждый метод из своей команды,
 * а тест смотрит на реальные последствия: перемотку, загрузку, плашку, буфер.
 */

const BODY = Buffer.alloc(32 * 1024, 5);

const PLUGIN = {
  json: {
    id: 'app.octo.api',
    name: 'API test',
    version: '1.0.0',
    apiVersion: 1,
    minAppVersion: '0.5.0',
    description: 'Плагин для теста новых API',
    author: { name: 'octo' },
    license: 'MIT',
    main: 'index.js',
    permissions: ['playback', 'feed', 'downloads', 'overlay', 'i18n', 'clipboard', 'os:notify'],
  },
  source: `'use strict';

let overlayId = '';

octo.onActivate(async () => {
  const add = (id, title, run) =>
    octo.commands.add({ id, title, run });

  await add('status', 'API status', async () => {
    const status = await octo.playback.status();
    await octo.notify('status:' + Math.round(status.time) + ':' + Math.round(status.duration));
  });

  await add('seek', 'API seek', async () => {
    await octo.playback.seek(12);
    await octo.notify('seek:12');
  });

  await add('volume', 'API volume', async () => {
    await octo.playback.setVolume(0.4);
    await octo.notify('volume:0.4');
  });

  await add('speed', 'API speed', async () => {
    await octo.playback.setSpeed(1.5);
    await octo.notify('speed:1.5');
  });

  await add('feed', 'API feed', async () => {
    await octo.feed.next();
    await octo.notify('feed:next');
  });

  await add('download', 'API download', async (url) => {
    await octo.downloads.add(url);
    await octo.notify('download:started');
  });

  await add('overlay', 'API overlay', async () => {
    const result = await octo.ui.overlay.show({ text: 'API overlay', timeoutMs: 8000 });
    overlayId = result.id;
    await octo.notify('overlay:' + overlayId);
  });

  await add('overlayHide', 'API overlay hide', async () => {
    await octo.ui.overlay.hide(overlayId);
    await octo.notify('overlay:hidden');
  });

  await add('i18n', 'API i18n', async () => {
    const info = await octo.i18n.get();
    await octo.notify('i18n:' + info.locale + ':' + info.dir);
  });

  await add('clipboard', 'API clipboard', async () => {
    await octo.clipboard.write('api-clip');
    await octo.notify('clipboard:written');
  });

  await add('osNotify', 'API system notification', async () => {
    await octo.os.notify({ title: 'API test', body: 'system-notify' });
    await octo.notify('os:notified');
  });
});
`,
};

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

async function startServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'video/mp4', 'content-length': BODY.length });
    response.end(BODY);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/api-clip.mp4` };
}

test('новые API плагинов работают через разрешения', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-api-'));
  const devDir = path.join(userData, 'dev-plugins');
  const pluginDir = path.join(devDir, 'api-test');
  const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-api-out-'));
  const notifyLog = path.join(userData, 'notify.log');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(PLUGIN.json, null, 2));
  fs.writeFileSync(path.join(pluginDir, 'index.js'), PLUGIN.source);

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
        OCTO_PLUGIN_DEV_DIR: devDir,
        OCTO_DOWNLOADS_DIR: downloadsDir,
        OCTO_NOTIFY_LOG: notifyLog,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );
    await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('octo-plugin://app.octo.api/'),
      'хост плагина',
    );

    // Поддельное видео и кнопка «следующее видео».
    await site.evaluate(() => {
      const video = document.createElement('video');
      let time = 7;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 30 });
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => time,
        set: (value) => {
          time = value;
        },
      });
      Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
      video.play = () => Promise.resolve();
      video.pause = () => {};
      video.getBoundingClientRect = () => ({
        width: 320,
        height: 568,
        top: 0,
        left: 0,
        right: 320,
        bottom: 568,
      });
      document.body.append(video);
      window.__video = () => time;

      window.__feedClicks = 0;
      const next = document.createElement('button');
      next.setAttribute('data-e2e', 'feed-navigation-next');
      next.addEventListener('click', () => {
        window.__feedClicks += 1;
      });
      document.body.append(next);
    });

    const run = (id, payload) =>
      page.evaluate(({ command, value }) => window.octo.cmd(command, value), {
        command: `plugin:app.octo.api:${id}`,
        value: payload,
      });

    await expect.poll(() => site.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    // playback.status: время и длительность из страницы (дожидаемся регистрации команд в onActivate).
    await expect
      .poll(
        async () => {
          await run('status');
          return page.locator('#pageTitle').textContent();
        },
        { timeout: 10000 },
      )
      .toContain('status:7:30');

    await run('seek');
    await expect.poll(() => site.evaluate(() => window.__video())).toBe(12);

    await run('volume');
    await expect(page.locator('#pageTitle')).toContainText('volume:0.4');
    await run('speed');
    await expect(page.locator('#pageTitle')).toContainText('speed:1.5');

    // feed.next нажимает кнопку ленты.
    await run('feed');
    await expect.poll(() => site.evaluate(() => window.__feedClicks)).toBe(1);

    // overlay: текстовая плашка, затем удаление.
    await run('overlay');
    await expect(site.locator('[id^="octo-plugin-overlay-"]')).toHaveText('API overlay');
    await run('overlayHide');
    await expect(site.locator('[id^="octo-plugin-overlay-"]')).toHaveCount(0);

    // i18n и буфер обмена.
    await run('i18n');
    await expect(page.locator('#pageTitle')).toContainText('i18n:ru:ltr');
    await run('clipboard');
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('api-clip');

    // Системное уведомление: разрешение os:notify и ограниченный текст.
    await run('osNotify');
    await expect(page.locator('#pageTitle')).toContainText('os:notified');
    await expect
      .poll(() =>
        fs.existsSync(notifyLog)
          ? JSON.parse(fs.readFileSync(notifyLog, 'utf8').trim().split('\n').at(-1))
          : null,
      )
      .toMatchObject({ title: 'API test', body: 'system-notify' });

    // downloads.add: локальный адрес разрешён только в тестовом режиме.
    await page.evaluate(() => window.octo.cmd('downloadNamingAuto', true));
    await page.evaluate(() => window.octo.cmd('downloadTemplate', '{title}'));
    await site.evaluate(() => {
      document.title = 'API download';
    });
    await run('download', url);
    await expect.poll(() => fs.readdirSync(downloadsDir).length, { timeout: 15000 }).toBe(1);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(downloadsDir, { recursive: true, force: true });
  }
});

test('расширенные возможности плагинов: ES-модуль, CSS по id, события, диалоги и настройки', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-api-ext-'));
  const devDir = path.join(userData, 'dev-plugins');
  const pluginDir = path.join(devDir, 'ext-test');
  fs.mkdirSync(pluginDir, { recursive: true });

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(
      {
        id: 'app.octo.ext',
        name: 'Ext test',
        version: '1.0.0',
        apiVersion: 1,
        minAppVersion: '0.5.0',
        description: 'Проверка новых возможностей',
        author: { name: 'octo' },
        license: 'MIT',
        main: 'index.js',
        module: true,
        permissions: ['page:css', 'page:script', 'playback'],
        settings: [
          {
            key: 'accent',
            type: 'color',
            title: 'Цвет рамки',
            description: 'Выбирает цвет выделения',
            default: '#ff5500',
          },
          {
            key: 'api_token',
            type: 'secret',
            title: 'API токен',
            description: 'Хранится зашифрованным',
          },
          {
            key: 'ping_action',
            type: 'action',
            title: 'Проверка действия',
            buttonLabel: 'Выполнить',
          },
        ],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(pluginDir, 'helper.js'),
    `export function formatTag(val) { return 'tag:' + val; }\n`,
  );

  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `import { formatTag } from './helper.js';

octo.onActivate(async () => {
  await octo.storage.set('alpha', 1);
  await octo.ui.panelRow({ id: 'main', label: 'Строка Ext', badge: 'INIT', run: () => {} });

  await octo.commands.add({
    id: 'namedCss',
    title: 'Named CSS',
    run: async () => {
      await octo.page.setCSS('accent', 'body { outline: 2px solid rgb(10, 20, 30); }');
      await octo.notify('css:set');
    },
  });

  await octo.commands.add({
    id: 'removeCss',
    title: 'Remove CSS',
    run: async () => {
      await octo.page.removeCSS('accent');
      await octo.notify('css:removed');
    },
  });

  await octo.commands.add({
    id: 'mediaInfo',
    title: 'Media Info',
    run: async () => {
      const info = await octo.page.getMediaInfo();
      await octo.notify('media:' + info.author + ':' + info.description);
    },
  });

  await octo.commands.add({
    id: 'storageInfo',
    title: 'Storage Info',
    run: async () => {
      const keys = await octo.storage.keys();
      const usage = await octo.storage.usage();
      await octo.notify(formatTag(keys.join(',') + ':' + usage.bytes));
    },
  });

  await octo.commands.add({
    id: 'themeInfo',
    title: 'Theme Info',
    run: async () => {
      const t = await octo.theme.get();
      await octo.notify('theme:' + t.palette);
    },
  });

  await octo.commands.add({
    id: 'updateRow',
    title: 'Update Row',
    run: async () => {
      await octo.ui.updatePanelRow('main', { badge: 'DONE' });
      await octo.notify('row:updated');
    },
  });

  await octo.commands.add({
    id: 'askConfirm',
    title: 'Ask Confirm',
    run: async () => {
      const ok = await octo.ui.confirm({ title: 'Подтверждение', message: 'Удалить?' });
      await octo.notify('confirm:' + ok);
    },
  });

  await octo.commands.add({
    id: 'askPrompt',
    title: 'Ask Prompt',
    run: async () => {
      const val = await octo.ui.prompt({ title: 'Имя', defaultValue: 'octo' });
      await octo.notify('prompt:' + val);
    },
  });

  await octo.commands.add({
    id: 'askPick',
    title: 'Ask Pick',
    run: async () => {
      const val = await octo.ui.pick({
        title: 'Выбор',
        items: [
          { value: 'first', label: 'Первый' },
          { value: 'second', label: 'Второй' },
        ],
      });
      await octo.notify('pick:' + val);
    },
  });

  await octo.commands.add({
    id: 'readSecret',
    title: 'Read Secret',
    run: async () => {
      const sec = await octo.secrets.get('api_token');
      await octo.notify('secret:' + (sec || 'none'));
    },
  });

  await octo.commands.add({
    id: 'watchStart',
    title: 'Watch Start',
    run: async () => {
      await octo.page.watch('items', '.watch-item', (evt) => {
        octo.notify('watch:' + evt.count + ':' + evt.texts.join(','));
      });
    },
  });

  octo.onSettingAction((key) => {
    octo.notify('action:' + key);
  });

  octo.onThemeChange((theme) => {
    octo.notify('themeChanged:' + theme.palette);
  });

  octo.playback.onChange((st) => {
    octo.notify('playbackChanged:' + st.speed);
  });
});
`,
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
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );
    await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('octo-plugin://app.octo.ext/'),
      'хост плагина',
    );

    await site.evaluate(() => {
      const author = document.createElement('span');
      author.setAttribute('data-e2e', 'browse-username');
      author.textContent = 'octomood';
      const desc = document.createElement('div');
      desc.setAttribute('data-e2e', 'video-desc');
      desc.textContent = 'Привет мир';
      document.body.append(author, desc);
    });

    const run = (id) =>
      page.evaluate((command) => window.octo.cmd(command), `plugin:app.octo.ext:${id}`);

    // Ждём завершения onActivate плагина (появления строки панели).
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="plugins"]').click();
    await expect(page.locator('#panelPluginActions')).toContainText('Строка Ext');

    // ES-модуль и storage.keys/usage.
    await run('storageInfo');
    await expect(page.locator('#pageTitle')).toContainText('tag:alpha:');

    // getMediaInfo.
    await run('mediaInfo');
    await expect(page.locator('#pageTitle')).toContainText('media:@octomood:Привет мир');

    // Именованный CSS: setCSS / removeCSS.
    await run('namedCss');
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).outlineColor))
      .toBe('rgb(10, 20, 30)');
    await run('removeCss');
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).outlineStyle))
      .toBe('none');

    // Обновление бейджа строки панели.
    await run('updateRow');
    await expect(page.locator('#panelPluginActions')).toContainText('DONE · Ext test');
    await page.click('#btnPanel');

    // Тема и событие смены темы.
    await run('themeInfo');
    await expect(page.locator('#pageTitle')).toContainText('theme:');
    await page.evaluate(() => window.octo.cmd('themePalette', 'cobalt-ocean'));
    await expect(page.locator('#pageTitle')).toContainText('themeChanged:cobalt-ocean');

    // Событие смены скорости плеера.
    await page.evaluate(() => window.octo.cmd('playerSpeed', 2));
    await expect(page.locator('#pageTitle')).toContainText('playbackChanged:2');

    // Наблюдатель DOM (page.watch).
    await run('watchStart');
    await site.evaluate(() => {
      const node = document.createElement('div');
      node.className = 'watch-item';
      node.textContent = 'Элемент 1';
      document.body.append(node);
    });
    await expect(page.locator('#pageTitle')).toContainText('watch:1:Элемент 1', { timeout: 10000 });

    // Интерактивные диалоги ui.confirm / ui.prompt / ui.pick.
    await run('askConfirm');
    await expect(page.locator('#pluginDialog')).toBeVisible();
    await page.click('#pluginDialogConfirm');
    await expect(page.locator('#pageTitle')).toContainText('confirm:true');

    await run('askPrompt');
    await expect(page.locator('#pluginDialogInput')).toBeVisible();
    await page.fill('#pluginDialogInput', 'новое имя');
    await page.click('#pluginDialogConfirm');
    await expect(page.locator('#pageTitle')).toContainText('prompt:новое имя');

    await run('askPick');
    await expect(page.locator('#pluginDialogList')).toBeVisible();
    await page.locator('#pluginDialogList button').filter({ hasText: 'Второй' }).click();
    await expect(page.locator('#pageTitle')).toContainText('pick:second');

    // Менеджер: описание настроек, secret, action и кнопка DevTools.
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = page.locator('#pluginsPanel');
    await manager.locator('[data-tab="installed"]').click();
    await expect(manager.locator('#installedList')).toContainText('DevTools');
    await manager.locator('#installedList details summary').first().click();
    await expect(manager.locator('#installedList')).toContainText('Выбирает цвет выделения');

    // Сохранение secret в настройках (в headless Xvfb без keyring safeStorage может быть недоступен).
    const secretInput = manager.locator('[data-secret-input="api_token"]');
    const hasSafeStorage = await app.evaluate(({ safeStorage }) =>
      safeStorage.isEncryptionAvailable(),
    );
    await secretInput.fill('top-secret-123');
    await manager.locator('[data-act="secretSave"][data-key="api_token"]').click();
    if (hasSafeStorage) {
      await expect(secretInput).toHaveValue('');
      await run('readSecret');
      await expect(page.locator('#pageTitle')).toContainText('secret:top-secret-123');
    } else {
      await expect(manager.locator('#pluginsToast')).toContainText('недоступно');
    }

    // Настройка action.
    await manager.locator('[data-act="settingAction"][data-key="ping_action"]').click();
    await expect(page.locator('#pageTitle')).toContainText('action:ping_action');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
