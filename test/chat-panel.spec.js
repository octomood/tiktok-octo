'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { inQuietHours, minutesOfTime, shouldNotify } = require('../src/main/notifications-policy');

/**
 * Чат: ширина, док, трей и быстрые ответы.
 *
 * Панель чата — отдельный WebContentsView, поэтому её ширину и положение
 * проверяем через contentView.children в main. Страница чата локальная: тест
 * не ходит в сеть, а поле сообщения и загрузка файла — поддельные.
 */

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

async function startServer(html) {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

function viewLayout(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().startsWith('file://'),
    );
    if (!win) return [];
    return win.contentView.children.map((child) => ({
      url: child.webContents.getURL(),
      bounds: child.getBounds(),
      visible: child.getVisible ? child.getVisible() : true,
    }));
  });
}

test('чат: ширина, док, ручка и сохранение', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatpanel-'));
  const { server, url } = await startServer(CHAT_HTML);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    await waitForWindow(app, (candidate) => candidate.url().startsWith('http://127.0.0.1'));

    // По умолчанию слева стоит кастомное меню (240 px), а чат поджимает ленту.
    await expect
      .poll(async () => {
        const views = await viewLayout(app);
        const feed = views.find((item) => item.url === 'about:blank');
        return feed ? feed.bounds.x : -1;
      })
      .toBe(240 + 426);

    // Ширина тянется командой (её шлёт ручка) и запоминается.
    await page.evaluate(() => window.octo.cmd('chatResize', 520));
    await expect
      .poll(async () => {
        const views = await viewLayout(app);
        const feed = views.find((item) => item.url === 'about:blank');
        return feed ? feed.bounds.x : -1;
      })
      .toBe(240 + 526);

    const handle = page.locator('#chatResize');
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    expect(Math.round(box.x)).toBe(240 + 520);

    // Отключённый док возвращает прежнее поведение: чат поверх ленты (лента сразу после бокового меню).
    await page.evaluate(() => window.octo.cmd('chatDock'));
    await expect
      .poll(async () => {
        const views = await viewLayout(app);
        const feed = views.find((item) => item.url === 'about:blank');
        return feed ? feed.bounds.x : -1;
      })
      .toBe(240);

    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.chatWidth).toBe(520);
    expect(saved.chatDock).toBe(false);

    // Закрытый чат прячет ручку и возвращает ленте всю ширину.
    await page.evaluate(() => window.octo.cmd('chat'));
    await expect(handle).toBeHidden();
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: панель подстраивается под ширину страницы сообщений', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatfit-'));
  // Как на странице сообщений: колонки не сжимаются, а уезжают под
  // горизонтальную прокрутку внутри контейнера. Сама страница при этом
  // не переполняется — прокрутка живёт внутри.
  const wide = `<!doctype html>
<html><body style="margin:0;background:#111">
  <div id="inbox" style="width:100%;height:100vh;overflow-x:auto;overflow-y:hidden">
    <div style="width:900px;height:100vh">
      <div role="textbox" contenteditable="true" style="width:840px;height:40px"></div>
    </div>
  </div>
</body></html>`;
  const { server, url } = await startServer(wide);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    const chatBounds = async () => {
      const views = await viewLayout(app);
      const chat = views.find((item) => item.url.startsWith('http://127.0.0.1'));
      return chat ? chat.bounds : null;
    };

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    await waitForWindow(app, (candidate) => candidate.url().startsWith('http://127.0.0.1'));

    // Стартовые 420 px не вмещают страницу — панель расширяется сама.
    await expect
      .poll(async () => {
        const bounds = await chatBounds();
        return bounds ? bounds.width : -1;
      })
      .toBeGreaterThanOrEqual(900);
    const grown = await chatBounds();
    expect(grown.width).toBeLessThanOrEqual(980);

    const views = await viewLayout(app);
    const feed = views.find((item) => item.url === 'about:blank');
    expect(feed.bounds.x).toBe(240 + grown.width + 6);

    // Ручная ширина важнее автоподбора: панель больше не растягивается.
    await page.evaluate(() => window.octo.cmd('chatResize', 500));
    await expect
      .poll(async () => {
        const bounds = await chatBounds();
        return bounds ? bounds.width : -1;
      })
      .toBe(500);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await chatBounds()).width).toBe(500);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: кнопка за правым краем тоже расширяет панель', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatclip-'));
  // Страница не прокручивается: раскладка обрезана контейнером, а кнопка
  // отправки уехала за правый край. Так выглядит сжатый диалог сообщений.
  const clipped = `<!doctype html>
<html><body style="margin:0;background:#111">
  <div style="position:relative;width:100%;height:100vh;overflow:hidden">
    <div role="textbox" contenteditable="true" style="width:280px;height:40px"></div>
    <button id="send" style="position:absolute;left:405px;bottom:8px;width:36px;height:36px">
      Send
    </button>
  </div>
</body></html>`;
  const { server, url } = await startServer(clipped);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    await waitForWindow(app, (candidate) => candidate.url().startsWith('http://127.0.0.1'));

    await expect
      .poll(async () => {
        const views = await viewLayout(app);
        const chat = views.find((item) => item.url.startsWith('http://127.0.0.1'));
        return chat ? chat.bounds.width : -1;
      })
      .toBeGreaterThan(420);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: меню, спрятанное за правым краем, не раздувает панель', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatchase-'));
  // Скрытое меню стоит сразу за правой границей и уезжает вместе с ней: сколько
  // ни расширяй панель, оно снова «за краем». Панель не должна гнаться за ним до
  // 980 px, отнимая ширину у ленты.
  const chase = `<!doctype html>
<html><body style="margin:0;background:#111">
  <div style="position:relative;width:100%;height:100vh;overflow:hidden">
    <div role="textbox" contenteditable="true" style="width:300px;height:40px"></div>
    <button id="parked" style="position:absolute;left:calc(100% + 40px);top:8px;width:36px;height:36px">
      Menu
    </button>
  </div>
</body></html>`;
  const { server, url } = await startServer(chase);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    await waitForWindow(app, (candidate) => candidate.url().startsWith('http://127.0.0.1'));

    const chatWidth = async () => {
      const views = await viewLayout(app);
      const chat = views.find((item) => item.url.startsWith('http://127.0.0.1'));
      return chat ? chat.bounds.width : -1;
    };
    // Все отложенные замеры (500 и 1600 мс после загрузки) успевают пройти.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(await chatWidth()).toBe(420);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: открытие переписки внутри страницы заново подгоняет панель', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatnav-'));
  // Сначала список переписок помещается в 420 px, а открытый диалог — нет.
  const late = `<!doctype html>
<html><body style="margin:0;background:#111">
  <div id="inbox" style="width:100%;height:100vh;overflow-x:auto;overflow-y:hidden">
    <div id="pane" style="width:320px;height:100vh">
      <div role="textbox" contenteditable="true" style="width:260px;height:40px"></div>
    </div>
  </div>
</body></html>`;
  const { server, url } = await startServer(late);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    const chat = await waitForWindow(app, (candidate) =>
      candidate.url().startsWith('http://127.0.0.1'),
    );

    const width = async () => {
      const views = await viewLayout(app);
      const view = views.find((item) => item.url.startsWith('http://127.0.0.1'));
      return view ? view.bounds.width : -1;
    };

    // Список переписок помещается: панель остаётся стартовой.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(await width()).toBe(420);

    // Переход внутри страницы открывает широкий диалог — панель дорастает.
    await chat.evaluate(() => {
      document.getElementById('pane').style.width = '900px';
      window.history.pushState({}, '', '/messages/1');
    });
    await expect.poll(width).toBeGreaterThanOrEqual(900);
    expect(await width()).toBeLessThanOrEqual(980);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: панель просит страницу пересобрать раскладку', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatreflow-'));
  // Страница сообщений пересобирает раскладку по resize окна. Панель меняет
  // ширину без окна, поэтому без нашего события раскладка остаётся прежней:
  // список и диалог уезжают под горизонтальную прокрутку до тех пор, пока
  // пользователь не подёргает край окна.
  const stale = `<!doctype html>
<html><body style="margin:0;background:#111">
  <div id="pane" style="width:100%;height:100vh">wide</div>
  <script>
    window.__layout = { mode: 'wide', relayouts: 0 };
    const pane = document.getElementById('pane');
    window.addEventListener('resize', () => {
      window.__layout.relayouts += 1;
      window.__layout.mode = window.innerWidth < 700 ? 'narrow' : 'wide';
      pane.textContent = window.__layout.mode;
    });
  </script>
</body></html>`;
  const { server, url } = await startServer(stale);
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    // Расширяем окно, чтобы поместились боковое меню (240 px), 900 px чат и минимум ленты.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('file://'),
      );
      if (win) win.setSize(1540, 840);
    });

    await page.evaluate(() => window.octo.cmd('chat'));
    const chat = await waitForWindow(app, (candidate) =>
      candidate.url().startsWith('http://127.0.0.1'),
    );

    // Панель 420 px: страница должна получить событие и уйти в узкую раскладку.
    await expect
      .poll(() => chat.evaluate(() => window.__layout))
      .toEqual({ mode: 'narrow', relayouts: expect.any(Number) });
    const narrow = await chat.evaluate(() => window.__layout.relayouts);
    expect(narrow).toBeGreaterThanOrEqual(1);

    // Ширина меняется — снова событие, раскладка следует за панелью.
    await page.evaluate(() => window.octo.cmd('chatResize', 800));
    await expect.poll(() => chat.evaluate(() => window.__layout.mode)).toBe('wide');
    expect(await chat.evaluate(() => window.__layout.relayouts)).toBeGreaterThan(narrow);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('чат: быстрые ответы и файл, брошенный в чат', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-chatdrop-'));
  const { server, url } = await startServer(CHAT_HTML);
  const image = path.join(userData, 'dropped.png');
  const text = path.join(userData, 'notes.txt');
  fs.writeFileSync(image, PNG);
  fs.writeFileSync(text, 'hello');

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await page.evaluate(() => window.octo.cmd('chat'));
    const chat = await waitForWindow(app, (candidate) =>
      candidate.url().startsWith('http://127.0.0.1'),
    );

    // --- Быстрые ответы -----------------------------------------------------
    await page.evaluate(() => window.octo.cmd('repliesSet', 'Первый ответ\nВторой ответ'));
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.replies).toEqual(['Первый ответ', 'Второй ответ']);

    await page.evaluate(() => window.octo.cmd('replyInsert', 1));
    await expect
      .poll(() => chat.evaluate(() => document.querySelector('[contenteditable]').textContent))
      .toContain('Второй ответ');

    // Шаблоны видны в палитре команд.
    await page.evaluate(() => window.octo.cmd('palette'));
    await expect(page.locator('#paletteList')).toContainText('Быстрый ответ: Второй ответ');
    await page.evaluate(() => window.octo.cmd('palette'));

    // --- Файл, брошенный в чат ---------------------------------------------
    await chat.evaluate(() => {
      window.__events.attached = null;
    });
    await page.evaluate((file) => window.octo.cmd('chatFiles', [file]), image);
    await expect
      .poll(() => chat.evaluate(() => window.__events.attached && window.__events.attached.name))
      .toBe('dropped.png');

    // Не картинку не отправляем.
    await chat.evaluate(() => {
      window.__events.attached = null;
    });
    await page.evaluate((file) => window.octo.cmd('chatFiles', [file]), text);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await chat.evaluate(() => window.__events.attached)).toBeNull();

    // Панель чата не мешает ленте получать заголовок страницы: бейдж работает.
    await site.evaluate(() => {
      document.title = '(3) TikTok';
    });
    await expect(page.locator('#unreadBadge')).toHaveText('3');
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('уведомления: окно «не беспокоить» и активное окно', () => {
  expect(minutesOfTime('23:30')).toBe(1410);
  expect(minutesOfTime('7:05')).toBe(425);
  expect(minutesOfTime('25:00')).toBeNull();
  expect(minutesOfTime('abc')).toBeNull();

  // Обычное окно и переход через полночь.
  expect(inQuietHours(1410, '23:00', '08:00')).toBe(true);
  expect(inQuietHours(120, '23:00', '08:00')).toBe(true);
  expect(inQuietHours(720, '23:00', '08:00')).toBe(false);
  expect(inQuietHours(540, '08:00', '18:00')).toBe(true);
  expect(inQuietHours(1080, '08:00', '18:00')).toBe(false);
  expect(inQuietHours(600, '08:00', '08:00')).toBe(false);

  const base = {
    enabled: true,
    previous: 0,
    next: 2,
    focused: false,
    quietFocused: true,
    dnd: false,
    dndFrom: '23:00',
    dndTo: '08:00',
    nowMinutes: 720,
  };
  expect(shouldNotify(base)).toBe(true);
  expect(shouldNotify({ ...base, enabled: false })).toBe(false);
  expect(shouldNotify({ ...base, previous: 2 })).toBe(false);
  expect(shouldNotify({ ...base, focused: true })).toBe(false);
  expect(shouldNotify({ ...base, focused: true, quietFocused: false })).toBe(true);
  expect(shouldNotify({ ...base, dnd: true, nowMinutes: 1400 })).toBe(false);
  expect(shouldNotify({ ...base, dnd: true, nowMinutes: 700 })).toBe(true);
});
