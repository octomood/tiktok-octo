'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { buildName, buildPath, sanitize, transliterate } = require('../src/main/download-name');

/**
 * Имена файлов, менеджер загрузок и счётчик пропущенной рекламы.
 *
 * Шаблон и транслитерация проверяются обычным юнит-тестом, авто-имя — реальной
 * загрузкой с локального сервера в подменённую папку «Загрузки».
 */

const BODY = Buffer.alloc(64 * 1024, 7);
const CHAT_PAGE =
  '<!doctype html><html><head><title>Чат с Аней | TikTok</title></head><body>чат</body></html>';

async function startServer() {
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/chat')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(CHAT_PAGE);
      return;
    }
    response.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': BODY.length,
    });
    response.end(BODY);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  return { server, url: `${root}/clip.mp4`, chat: `${root}/chat` };
}

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('шаблон имени: транслитерация, подстановки и папка автора', () => {
  expect(transliterate('Привет, мир')).toBe('Privet, mir');
  expect(transliterate('Щука')).toBe('Shchuka');
  expect(sanitize('  мой/ролик: "тест"  ')).toBe('moy rolik test');
  expect(sanitize('...')).toBe('');

  const name = buildName('{author}-{date}-{title}', {
    author: 'Иван',
    title: 'Лучший ролик',
    date: '2024-05-01',
    ext: 'mp4',
  });
  expect(name).toBe('Ivan-2024-05-01-Luchshiy rolik.mp4');

  // Расширение не дублируется, если оно уже есть в шаблоне.
  expect(buildName('{title}.mp4', { title: 'Клип', ext: 'mp4' })).toBe('Klip.mp4');

  // Пустой шаблон и пустые данные дают безопасное имя.
  expect(buildName('', { fallback: 'clip' })).toBe('clip');
  const pathInfo = buildPath({
    template: '{author}/{title}',
    folderPerAuthor: true,
    baseDir: '/tmp/downloads',
    info: { author: '@octo', title: 'Клип', ext: 'webm' },
  });
  expect(pathInfo.directory).toBe('/tmp/downloads/@octo');
  expect(pathInfo.file).toBe('@octo Klip.webm');
});

test('авто-имя файла при загрузке и счётчик пропущенной рекламы', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-dl-'));
  const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-dl-out-'));
  const { server, url, chat } = await startServer();
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: chat,
        OCTO_DOWNLOADS_DIR: downloadsDir,
        OCTO_ADS_POLL_MS: '300',
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // --- Авто-имя -----------------------------------------------------------
    await site.evaluate(() => {
      document.title = 'Мой ролик | TikTok';
    });
    await page.evaluate(() => window.octo.cmd('downloadNamingAuto', true));
    await page.evaluate(() => window.octo.cmd('downloadTemplate', '{title}-{date}'));

    await app.evaluate(({ BrowserWindow }, target) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith('file://'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
      );
      view.webContents.downloadURL(target);
    }, url);

    await expect
      .poll(() => fs.readdirSync(downloadsDir).find((name) => name.endsWith('.mp4')) || '')
      .toMatch(/^Moy rolik-\d{4}-\d{2}-\d{2}\.mp4$/);

    const state = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(state.downloadNaming.auto).toBe(true);
    expect(state.downloadNaming.template).toBe('{title}-{date}');

    // Повторная загрузка с тем же именем не затирает первый файл: второй
    // получает суффикс « (1)», как это делает системный диалог сохранения.
    await app.evaluate(({ BrowserWindow }, target) => {
      const win = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith('file://'),
      );
      const view = win.contentView.children.find(
        (child) => child.webContents && child.webContents.getURL().startsWith('about:blank'),
      );
      view.webContents.downloadURL(target);
    }, url);
    const downloaded = () => fs.readdirSync(downloadsDir).filter((name) => name.endsWith('.mp4'));
    await expect.poll(downloaded).toHaveLength(2);
    expect(downloaded().filter((name) => name.includes(' (1).mp4'))).toHaveLength(1);

    // Загрузка из панели чата: имя берётся из страницы чата, а не из ленты.
    await page.evaluate(() => window.octo.cmd('downloadTemplate', '{title}'));
    await page.evaluate(() => window.octo.cmd('chat'));
    const chatPage = await waitForWindow(app, (candidate) => candidate.url() === chat);
    expect(chatPage).toBeTruthy();
    await app.evaluate(
      ({ BrowserWindow }, { chatUrl, fileUrl }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().startsWith('file://'),
        );
        const view = win.contentView.children.find(
          (child) => child.webContents && child.webContents.getURL() === chatUrl,
        );
        view.webContents.downloadURL(fileUrl);
      },
      { chatUrl: chat, fileUrl: url },
    );
    await expect.poll(downloaded).toContain('Chat s Aney.mp4');
    expect(downloaded()).not.toContain('Moy rolik.mp4');

    // --- Счётчик рекламы ----------------------------------------------------
    await page.evaluate(() => window.octo.cmd('adsSkip'));
    await expect.poll(() => site.evaluate(() => typeof window.__octoAds)).toBe('object');

    await site.evaluate(() => {
      window.__adNext = 0;
      const item = document.createElement('div');
      item.setAttribute('data-e2e', 'recommend-list-item-container');
      item.style.cssText = 'position: relative; width: 360px; height: 640px;';
      const label = document.createElement('span');
      label.setAttribute('data-e2e', 'ad-label');
      label.textContent = 'Реклама';
      label.style.cssText = 'position: absolute; top: 10px; left: 10px; width: 60px; height: 20px;';
      const video = document.createElement('video');
      video.style.cssText = 'width: 320px; height: 568px;';
      item.append(video, label);
      document.body.append(item);

      const next = document.createElement('button');
      next.setAttribute('data-e2e', 'feed-navigation-next');
      next.style.cssText = 'position: fixed; right: 10px; bottom: 10px; width: 40px; height: 40px;';
      next.addEventListener('click', () => {
        window.__adNext += 1;
      });
      document.body.append(next);
    });

    await expect.poll(() => site.evaluate(() => window.__adNext)).toBeGreaterThan(0);
    await expect(page.locator('#adsCount')).toHaveText('1');

    const withAds = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(withAds.adsSkipped).toBe(1);
    expect(withAds.adJournal).toHaveLength(1);

    await page.evaluate(() => window.octo.cmd('adsPip'));
    await expect(page.locator('#rowAdsPip')).toHaveAttribute('aria-checked', 'false');
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(downloadsDir, { recursive: true, force: true });
  }
});
