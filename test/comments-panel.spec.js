'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Правая панель страницы видео не должна занимать место, пока пользователь не
 * открыл комментарии. Проверяем на локальной странице с разметкой TikTok:
 * панель скрыта, значок комментариев открывает её, повторный клик, Esc,
 * переход по SPA и выключение правила возвращают прежнее поведение.
 */

const SITE_PAGE = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Видео</title>
    <style>
      body { margin: 0; display: flex; }
      .DivVideoDetailContainer { display: flex; width: 100vw; height: 100vh; }
      .DivLeftContainer { flex: 1 1 auto; background: #111; }
      .DivVideoListTabBarWrapper { display: flex; flex: 0 0 320px; flex-direction: column; background: #222; }
    </style>
  </head>
  <body>
    <div class="DivVideoDetailContainer">
      <div class="DivLeftContainer" id="videoArea">видео</div>
      <div class="DivVideoListTabBarWrapper" id="rightPanel">
        <div class="StyledContentWrapper">
          <span>Вам может понравиться</span>
        </div>
      </div>
    </div>
    <button type="button" data-e2e="comment-icon" id="commentButton">Комментарии</button>
    <div class="DivCommentListContainer" id="commentList">Комментарий</div>
  </body>
</html>`;

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('правую панель видео открывают только комментарии', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(SITE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-comments-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: url,
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
      (candidate) => candidate.url().startsWith(url),
      'страница сайта',
    );

    await expect.poll(() => site.evaluate(() => typeof window.__octoCommentsPanel)).toBe('object');

    const panel = site.locator('#rightPanel');
    const commentButton = site.locator('#commentButton');

    // Пока комментарии не открывали, панель не занимает место.
    await expect(panel).toBeHidden();

    // Значок комментариев показывает вкладки и список комментариев.
    await commentButton.click();
    await expect(panel).toBeVisible();

    // Повторный клик по значку закрывает открытые комментарии.
    await commentButton.click();
    await expect(panel).toBeHidden();

    // Esc закрывает панель, но не мешает вводу комментария.
    await commentButton.click();
    await expect(panel).toBeVisible();
    await site.evaluate(() => {
      const input = document.createElement('textarea');
      input.id = 'commentInput';
      document.body.append(input);
    });
    await site.locator('#commentInput').focus();
    await site.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await site.evaluate(() => document.getElementById('commentInput').blur());
    await site.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // SPA меняет ролик: новая страница снова начинается без панели.
    await commentButton.click();
    await expect(panel).toBeVisible();
    await site.evaluate(() => window.history.pushState({}, '', '/next-video'));
    await expect(panel).toBeHidden();

    // Выключенное правило возвращает панель на место, включённое — прячет.
    await page.evaluate(() => window.octo.cmd('cosmetic', 'comments-panel'));
    await expect(panel).toBeVisible();
    await expect
      .poll(() =>
        site.evaluate(() => document.documentElement.hasAttribute('data-octo-comments-panel')),
      )
      .toBe(false);
    await page.evaluate(() => window.octo.cmd('cosmetic', 'comments-panel'));
    await expect(panel).toBeHidden();
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
