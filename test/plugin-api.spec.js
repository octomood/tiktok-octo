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

    // playback.status: время и длительность из страницы.
    await run('status');
    await expect(page.locator('#pageTitle')).toContainText('status:7:30');

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
