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

// Поле сообщения с contenteditable="plaintext-only": селектор
// [contenteditable="true"] его пропускал, и чат считался неоткрытым.
const PLAINTEXT_HTML = `<!doctype html>
<html>
  <body>
    <div contenteditable="plaintext-only" aria-label="Compose" style="min-height: 40px"></div>
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

// Чат, где кнопка «+» сначала открывает меню «Фото/Видео», и только пункт
// «Фото» создаёт input[type=file] и открывает системный выбор файла.
const PHOTO_MENU_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <button id="attach" aria-label="Attach">+</button>
    <button class="StyledSendButton">Send</button>
    <div id="menu" hidden style="position: fixed; bottom: 60px; left: 20px">
      <button role="menuitem">Photo</button>
      <button role="menuitem">Video</button>
    </div>
    <script>
      window.__events = { attached: null, sent: 0 };
      const menu = document.getElementById('menu');
      document.getElementById('attach').addEventListener('click', () => {
        menu.hidden = false;
      });
      document.querySelector('[role="menuitem"]').addEventListener('click', () => {
        menu.hidden = true;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.png,.jpg,.jpeg,.webp,.gif';
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

// Поле загрузки спрятано в закрытом shadow root: querySelector его не видит,
// а DOM-агент CDP видит.
const CLOSED_SHADOW_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <div id="host"></div>
    <button class="StyledSendButton">Send</button>
    <script>
      window.__events = { attached: null, sent: 0 };
      const root = document.getElementById('host').attachShadow({ mode: 'closed' });
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.jpg,.jpeg,.webp,.gif';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        window.__events.attached = file
          ? { name: file.name, size: file.size, type: file.type }
          : null;
      });
      root.append(input);
      document.querySelector('.StyledSendButton').addEventListener('click', () => {
        window.__events.sent += 1;
      });
    </script>
  </body>
</html>`;

// Чат вообще без поля загрузки и кнопки вложения: остаётся доверенный
// drag-and-drop через CDP.
const DRAG_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <button class="StyledSendButton">Send</button>
    <script>
      window.__events = { attached: null, sent: 0 };
      document.addEventListener('dragover', (event) => event.preventDefault());
      document.addEventListener('drop', (event) => {
        event.preventDefault();
        const file = event.dataTransfer && event.dataTransfer.files[0];
        window.__events.attached = file
          ? { name: file.name, size: file.size, type: file.type }
          : null;
      });
      document.querySelector('.StyledSendButton').addEventListener('click', () => {
        window.__events.sent += 1;
      });
    </script>
  </body>
</html>`;

// Безликая иконка вложения: нет ни текста, ни aria-label. Найти её можно
// только по положению рядом с полем сообщения и кликнуть доверенно через CDP.
const ICON_ONLY_HTML = `<!doctype html>
<html>
  <body>
    <div style="display: flex; align-items: center; gap: 8px; width: 480px">
      <button id="attach" style="width: 32px; height: 32px; padding: 0">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" /></svg>
      </button>
      <div
        role="textbox"
        contenteditable="true"
        aria-label="Send a message..."
        style="flex: 1; min-height: 40px"
      ></div>
    </div>
    <button class="StyledSendButton">Send</button>
    <script>
      window.__events = { attached: null, sent: 0 };
      document.getElementById('attach').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.png,.jpg,.jpeg,.webp,.gif';
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

// Чат с родной кнопкой стикеров TikTok.
const NATIVE_HTML = `<!doctype html>
<html>
  <body>
    <div role="textbox" contenteditable="true" aria-label="Send a message..."></div>
    <button id="stickers" aria-label="Stickers">🙂</button>
    <script>
      window.__events = { nativeOpened: false };
      document.getElementById('stickers').addEventListener('click', () => {
        window.__events.nativeOpened = true;
      });
    </script>
  </body>
</html>`;

// Чат, который после отправки показывает баннер о недоступности в регионе.
const REGION_HTML = `<!doctype html>
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
      document.querySelector('.StyledSendButton').addEventListener('click', () => {
        window.__events.sent += 1;
        setTimeout(() => {
          const note = document.createElement('p');
          note.textContent = 'Эта функция недоступна в стране или регионе получателя';
          document.body.append(note);
        }, 200);
      });
    </script>
  </body>
</html>`;

// Страница с редактором комментария: это не чат, в него стикер уходить не должен.
const COMMENT_HTML = `<!doctype html>
<html>
  <body>
    <div contenteditable="true" aria-label="Add a comment"></div>
    <input type="file" accept="image/*" style="display: none" />
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

async function startServer(html, routes = {}) {
  const server = http.createServer((request, response) => {
    const body = routes[request.url] ?? html;
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(body);
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

/** Все WebContentsView окна: лента и панель чата. */
function contentViews(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    return win.contentView.children.map((child) => ({
      url: child.webContents.getURL(),
      destroyed: child.webContents.isDestroyed(),
    }));
  });
}

/** Выполнить код в отдельном view по префиксу адреса. */
function evaluateInView(app, urlPrefix, code) {
  return app.evaluate(
    async ({ BrowserWindow }, input) => {
      const win = BrowserWindow.getAllWindows()[0];
      const view = win?.contentView.children.find((child) =>
        child.webContents.getURL().startsWith(input.urlPrefix),
      );
      if (!view) return null;
      return view.webContents.executeJavaScript(input.code, true);
    },
    { urlPrefix, code },
  );
}

async function launchRaw(userData, chatUrl, extraEnv = {}) {
  const instance = await electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: chatUrl,
      ...extraEnv,
    },
  });

  await instance.firstWindow();

  const page = await findWindow(instance, (candidate) => candidate.url().startsWith('file://'));
  expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

  const view = await findWindow(instance, (candidate) => candidate.url().startsWith(chatUrl));
  expect(view, 'страница чата не появилась').toBeTruthy();

  return { instance, page, view };
}

async function launch(app, userData, chatUrl) {
  const launched = await launchRaw(userData, chatUrl);
  await expect.poll(() => launched.view.evaluate(() => Boolean(window.__events))).toBe(true);
  return launched;
}

/** Состояние чата внутри iframe #chat: Playwright-фрейм может ещё не успеть. */
function chatEvents(view) {
  return view.evaluate(() => {
    const win = document.getElementById('chat')?.contentWindow;
    return win ? (win.__events ?? null) : null;
  });
}

/** Встраивает чат через srcdoc: без второго HTTP-запроса и гонки загрузки. */
function iframePage(content) {
  const srcdoc = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html><body style="margin:0">
  <iframe id="chat" style="width:640px;height:420px;border:0" srcdoc="${srcdoc}"></iframe>
</body></html>`;
}

async function openStickers(page) {
  await page.click('#btnStickers');
  await expect(page.locator('#stickerPopover')).toBeVisible();
  await expect(page.locator('#panel')).toBeHidden();
  await expect(page.locator('#stickerPopoverGrid .sticker-tile')).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator('#stickerPopoverGrid img')
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
    await expect(page.locator('#stickerPopoverGrid .sticker-tile')).toHaveCount(0);
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

/**
 * «+» в чате открывает меню «Фото/Видео», и файл выбирается только после
 * клика по «Фото». Скрытый пункт меню не должен перехватывать первый клик.
 */
test('стикеры: вложение через меню «Фото»', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(PHOTO_MENU_HTML);
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

/**
 * Business Suite может держать input[type=file] в закрытом shadow root.
 * Такой узел виден только DOM-агенту CDP, а не querySelector.
 */
test('стикеры: поле загрузки в закрытом shadow root', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(CLOSED_SHADOW_HTML);
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
    await expect.poll(() => view.evaluate(() => window.__events.sent)).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/** Если ни поля, ни кнопки нет, файл уходит настоящим drag-and-drop. */
test('стикеры: вложение перетаскиванием через CDP', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(DRAG_HTML);
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
    await expect.poll(() => view.evaluate(() => window.__events.sent)).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/** Кнопка вложения — иконка без подписи; её ищем по положению у редактора. */
test('стикеры: безликая иконка вложения', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(ICON_ONLY_HTML);
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

/**
 * Business Suite держит переписку во вложенном фрейме. Раньше стикер искал
 * поле только в главном документе и молча не находил чат.
 */
test('стикеры: чат во вложенном фрейме', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(iframePage(CHAT_HTML));
  let app;

  try {
    const launched = await launchRaw(userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await expect.poll(async () => Boolean(await chatEvents(view))).toBe(true);

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect.poll(async () => (await chatEvents(view))?.attached?.size ?? 0).toBe(PNG.length);
    await expect.poll(async () => (await chatEvents(view))?.sent ?? 0).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * Ленивое поле загрузки во вложенном фрейме: клик по кнопке фото должен
 * перехватываться через CDP так же, как в главном документе.
 */
test('стикеры: ленивое поле загрузки во вложенном фрейме', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(iframePage(LAZY_INPUT_HTML));
  let app;

  try {
    const launched = await launchRaw(userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await expect.poll(async () => Boolean(await chatEvents(view))).toBe(true);

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect.poll(async () => (await chatEvents(view))?.attached?.size ?? 0).toBe(PNG.length);
    await expect.poll(async () => (await chatEvents(view))?.attached?.name ?? '').toBe('test.png');
    await expect.poll(async () => (await chatEvents(view))?.sent ?? 0).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * TikTok может отдавать поле сообщения как contenteditable="plaintext-only".
 * Раньше такой чат не считался открытым: стикер не прикреплялся, а повторный
 * клик получал «подождите, предыдущий ещё отправляется».
 */
test('стикеры: поле сообщения contenteditable=plaintext-only', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(CHAT_HTML, { '/messages': PLAINTEXT_HTML });
  const chatUrl = new URL('messages', url).href;
  let app;

  try {
    const launched = await launch(electron, userData, chatUrl);
    app = launched.instance;
    const { page, view } = launched;

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect
      .poll(() => view.evaluate(() => window.__events.attached?.size ?? 0))
      .toBe(PNG.length);
    await expect.poll(() => view.evaluate(() => window.__events.sent)).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * Если чата на странице нет, отправка должна быстро и понятно закончиться, а
 * не оставить `sending` навсегда: иначе каждый следующий клик отвечает
 * «подождите».
 */
test('стикеры: без чата отправка завершается и не блокирует следующую', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(COMMENT_HTML);
  let app;

  try {
    const launched = await launchRaw(userData, url);
    app = launched.instance;
    const { page } = launched;

    await page.evaluate(() => {
      window.__toasts = [];
      window.octo.onState((state) => {
        if (state?.toast?.text) window.__toasts.push(state.toast.text);
      });
    });

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect
      .poll(() => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || ''), {
        timeout: 10_000,
      })
      .toMatch(/Чат не найден на странице/);
    expect(await page.evaluate(() => window.__toasts.join('\n'))).not.toContain('Подождите');

    // Вторая попытка не должна упираться в «предыдущий стикер ещё отправляется».
    await page.evaluate(() => {
      window.__toasts.length = 0;
      window.octo.cmd('stickerSend', 'test');
    });
    await expect
      .poll(() => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || ''), {
        timeout: 10_000,
      })
      .toMatch(/Чат не найден на странице/);
    expect(await page.evaluate(() => window.__toasts.join('\n'))).not.toContain('Подождите');
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * «Чат сбоку» живёт в отдельном WebContentsView. Раньше стикер искал чат
 * только в основной ленте и молча не находил его в открытой панели.
 */
test('стикеры: отправка в чат сбоку', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(COMMENT_HTML, { '/messages': CHAT_HTML });
  const chatUrl = new URL('messages', url).href;
  let app;

  try {
    const launched = await launchRaw(userData, url, { OCTO_CHAT_URL: chatUrl });
    app = launched.instance;
    const { page } = launched;

    await page.click('#btnChat');
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await contentViews(app)).some((view) => view.url.startsWith(chatUrl)))
      .toBe(true);

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect
      .poll(() => evaluateInView(app, chatUrl, 'window.__events?.attached?.size ?? 0'), {
        timeout: 10_000,
      })
      .toBe(PNG.length);
    await expect
      .poll(() => evaluateInView(app, chatUrl, 'window.__events?.sent ?? 0'), { timeout: 10_000 })
      .toBe(1);

    // Диагностика подтверждает, что отправка ушла именно в панель чата.
    const logPath = path.join(userData, 'stickers', 'send.log');
    await expect
      .poll(
        () => {
          try {
            return JSON.parse(fs.readFileSync(logPath, 'utf8')).result?.ok ?? false;
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    expect(log.target).toBe('chat');
    expect(log.result).toMatchObject({ ok: true, sent: true });
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/** Кнопка «Стикеры TikTok» открывает родную панель сайта. */
test('стикеры: родная панель TikTok открывается', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(NATIVE_HTML);
  let app;

  try {
    const launched = await launch(electron, userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('nativeStickers'));

    await expect
      .poll(() => view.evaluate(() => window.__events?.nativeOpened ?? false), { timeout: 10_000 })
      .toBe(true);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/** Баннер «недоступно в регионе» не должен выдаваться за успешную отправку. */
test('стикеры: ошибка региона после отправки', async () => {
  const { userData } = seedProfile();
  const { server, url } = await startServer(REGION_HTML);
  let app;

  try {
    const launched = await launch(electron, userData, url);
    app = launched.instance;
    const { page, view } = launched;

    await page.evaluate(() => {
      window.__toasts = [];
      window.octo.onState((state) => {
        if (state?.toast?.text) window.__toasts.push(state.toast.text);
      });
    });

    await openStickers(page);
    await page.evaluate(() => window.octo.cmd('stickerSend', 'test'));

    await expect
      .poll(() => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || ''), {
        timeout: 10_000,
      })
      .toMatch(/Получатель не может получать фото/);

    const log = JSON.parse(fs.readFileSync(path.join(userData, 'stickers', 'send.log'), 'utf8'));
    expect(log.result).toMatchObject({ ok: false, regionBlocked: true, sent: true });
    expect(await view.evaluate(() => window.__events.sent)).toBe(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
