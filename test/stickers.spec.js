'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

// 1×1 прозрачный PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const CHAT_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <input type="file" accept="image/*" style="display: none" />
    <button class="StyledSendButton">Send</button>
    <script>
      window.__events = { attached: null, sent: 0 };
      const input = document.querySelector('input[type="file"]');
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        window.__events.attached = file
          ? { name: file.name, size: file.size, type: file.type }
          : null;
      });
      document.querySelector('button').addEventListener('click', () => {
        window.__events.sent += 1;
      });
    </script>
  </body>
</html>`;

// Чат, который создаёт input[type=file] только после клика по кнопке фото.
const LAZY_INPUT_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <button id="upload" aria-label="Upload photo">Photo</button>
    <button class="StyledSendButton">Send</button>
    <script>
      window.__events = { attached: null, sent: 0 };
      document.getElementById('upload').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          window.__events.attached = file
            ? { name: file.name, size: file.size, type: file.type }
            : null;
        });
        document.body.append(input);
        input.click();
      });
      document.querySelector('.StyledSendButton').addEventListener('click', () => {
        window.__events.sent += 1;
      });
    </script>
  </body>
</html>`;

function seedProfile() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-stickers-'));
  const stickerDir = path.join(userData, 'stickers');
  const stickerFile = path.join(stickerDir, 'test.png');
  fs.mkdirSync(path.join(stickerDir, 'thumbs'), { recursive: true });
  fs.writeFileSync(stickerFile, PNG);
  fs.writeFileSync(
    path.join(stickerDir, 'stickers.json'),
    JSON.stringify({
      version: 1,
      items: [
        {
          id: 'test',
          name: 'test',
          ext: '.png',
          size: PNG.length,
          addedAt: Date.now(),
        },
      ],
    }),
  );
  return { userData, stickerFile };
}

async function startServer(html) {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function findWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const window = app.windows().find(predicate);
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

async function launch(app, userData, chatUrl) {
  const instance = await electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: chatUrl,
    },
  });

  await instance.firstWindow();

  const page = await findWindow(instance, (candidate) => candidate.url().startsWith('file://'));
  expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

  const view = await findWindow(instance, (candidate) => candidate.url().startsWith(chatUrl));
  expect(view, 'страница чата не появилась').toBeTruthy();
  await expect.poll(() => view.evaluate(() => Boolean(window.__events))).toBe(true);

  return { instance, page, view };
}

async function openStickers(page) {
  await page.click('#btnStickers');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#catStickers')).toBeVisible();
  await expect(page.locator('#stickerGrid .sticker-tile')).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator('#stickerGrid img')
        .evaluate((image) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
}

/**
 * Стикер проходит полный путь: файл из userData → панель → скрытый
 * input[type=file] чата → кнопка отправки. Проверяем на локальной странице,
 * чтобы не зависеть от входа в TikTok.
 */
test('стикеры: панель, превью, вставка в чат и удаление', async () => {
  const { userData, stickerFile } = seedProfile();
  const { server, url } = await startServer(CHAT_HTML);
  let app;

  try {
    const launched = await launch(electron, userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    // Имя зависит от способа вставки: CDP берёт имя файла с диска,
    // запасной путь передаёт sticker.png. Размер и тип важнее имени.
    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.size ?? 0))
      .toBe(PNG.length);
    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.type ?? ''))
      .toBe('image/png');
    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.name ?? ''))
      .toMatch(/^(?:sticker|test)\.png$/);
    await expect.poll(() => view.evaluate(() => window.__events.sent)).toBe(1);

    // Удаление убирает и запись, и файл с диска.
    await page.evaluate(() => window.octo.cmd('stickerRemove', 'test'));
    await expect(page.locator('#stickerGrid .sticker-tile')).toHaveCount(0);
    await expect.poll(() => fs.existsSync(stickerFile)).toBe(false);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * Некоторые версии чата создают input[type=file] только по клику на кнопку
 * фото. Проверяем перехват системного диалога через CDP.
 */
test('стикеры: поле загрузки, созданное по клику на кнопку фото', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(LAZY_INPUT_HTML);
  let app;

  try {
    const launched = await launch(electron, userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.size ?? 0))
      .toBe(PNG.length);
    // Именно перехват диалога: CDP подставляет файл с диска, а не sticker.png.
    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.name ?? ''))
      .toBe('test.png');
    await expect.poll(() => view.evaluate(() => window.__events.sent)).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
