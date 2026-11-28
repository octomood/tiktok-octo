'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

const SITE_PAGE = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Видео</title>
    <style>
      body { margin: 0; background: #111; color: #fff; font-family: sans-serif; }
      .DivItemContainerV2 { position: relative; width: 720px; height: 480px; }
      .DivBasicPlayerWrapper { position: relative; width: 400px; height: 420px; background: #000; }
      video { width: 100%; height: 100%; display: block; background: #000; }
      .PlayOverlay { position: absolute; inset: 0; }
      .DivVideoInfo { position: absolute; left: 16px; bottom: 56px; }
      .DivBottomControls { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; }
      .hashed-stage { position: relative; width: 320px; height: 180px; }
      .hashed-mask { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <div class="DivItemContainerV2">
      <div class="DivBasicPlayerWrapper" id="playerWrap">
        <video id="mainVideo"></video>
        <div class="PlayOverlay" id="playMask"></div>
      </div>
      <div class="DivVideoInfo">
        <span data-e2e="video-author-uniqueid" id="author">author_name</span>
        <p data-e2e="video-desc" id="desc">Описание видео для копирования</p>
      </div>
      <div class="DivBottomControls" id="controls">00:08 / 00:14</div>
    </div>
    <div class="hashed-stage" id="hashedStage">
      <video id="hashedVideo"></video>
      <div class="hashed-mask" id="hashedMask"></div>
    </div>
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

test('видео и подложки плеера не выделяются, а описание можно выделить', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(SITE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-no-select-'));
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
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith(url),
      'страница сайта',
    );

    await expect
      .poll(() =>
        site.evaluate(() => ({
          video: getComputedStyle(document.getElementById('mainVideo')).userSelect,
          wrap: getComputedStyle(document.getElementById('playerWrap')).userSelect,
          mask: getComputedStyle(document.getElementById('playMask')).userSelect,
          controls: getComputedStyle(document.getElementById('controls')).userSelect,
          hashedMask: getComputedStyle(document.getElementById('hashedMask')).userSelect,
          desc: getComputedStyle(document.getElementById('desc')).userSelect,
        })),
      )
      .toEqual({
        video: 'none',
        wrap: 'none',
        mask: 'none',
        controls: 'none',
        hashedMask: 'none',
        desc: 'text',
      });

    // Двойной клик и протяжка по видео не создают выделения.
    const box = await site.locator('#playerWrap').boundingBox();
    await site.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await site.mouse.move(box.x + 20, box.y + 20);
    await site.mouse.down();
    await site.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 6 });
    await site.mouse.up();

    const afterVideoDrag = await site.evaluate(() => {
      const sel = window.getSelection();
      return {
        isCollapsed: sel ? sel.isCollapsed : true,
        text: sel ? sel.toString() : '',
      };
    });
    expect(afterVideoDrag).toEqual({ isCollapsed: true, text: '' });

    // Текст описания выделяется как обычно.
    const descBox = await site.locator('#desc').boundingBox();
    await site.mouse.move(descBox.x + 4, descBox.y + descBox.height / 2);
    await site.mouse.down();
    await site.mouse.move(descBox.x + descBox.width - 4, descBox.y + descBox.height / 2, {
      steps: 6,
    });
    await site.mouse.up();

    const descSelected = await site.evaluate(() => window.getSelection()?.toString() || '');
    expect(descSelected.trim().length).toBeGreaterThan(0);

    // Ctrl+A не должен визуально окрашивать <video> выделением.
    await site.keyboard.press('Control+a');
    const selectionBg = await site.evaluate(
      () => getComputedStyle(document.getElementById('mainVideo'), '::selection').backgroundColor,
    );
    expect(selectionBg).toBe('rgba(0, 0, 0, 0)');
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
