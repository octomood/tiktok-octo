'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Локальный обход DPI: включение, настоящий CONNECT-туннель, фрагментация
 * первого TLS-куска и выключение.
 *
 * Сеть не нужна: целимся в локальный echo-сервер. Проверка обхода DPI по
 * настоящему TikTok невозможна — блокировки в тестовой среде нет.
 */

async function waitForWindow(app, predicate) {
  let page = app.windows().find(predicate);
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    page = app.windows().find(predicate);
  }
  return page;
}

function waitForFileWindow(app) {
  return waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
}

function readState(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

function startEcho() {
  return new Promise((resolve) => {
    const chunks = [];
    const server = net.createServer((socket) => {
      socket.on('data', (data) => {
        chunks.push(data.length);
        socket.write(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, chunks }));
  });
}

function readUntil(socket, marker) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.off('data', onData);
      reject(new Error('ответ прокси не пришёл'));
    }, 5000);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.includes(marker)) {
        clearTimeout(timer);
        socket.off('data', onData);
        resolve(buffer.toString('latin1'));
      }
    };
    socket.on('data', onData);
  });
}

function readBytes(socket, size) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.off('data', onData);
      reject(new Error('данные не вернулись'));
    }, 5000);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= size) {
        clearTimeout(timer);
        socket.off('data', onData);
        resolve(buffer);
      }
    };
    socket.on('data', onData);
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

test('обход DPI: туннель, фрагментация и выключение', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-dpi-'));
  const echo = await startEcho();
  let app;
  let client;

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
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    // Включаем обход: сервер поднимается на случайном порту 127.0.0.1.
    await page.evaluate(() => window.octo.cmd('dpiToggle'));
    await expect.poll(() => readState(userData).dpiBypass).toBe(true);

    const resolved = await app.evaluate(({ session }) =>
      session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
    );
    const match = /PROXY (127\.0\.0\.1:\d+)/.exec(resolved);
    expect(match, `Chromium не использует локальный обход: ${resolved}`).toBeTruthy();
    const proxyPort = Number(match[1].split(':')[1]);

    // CONNECT до локального сервера и фрагментированный первый пакет.
    client = await connect(proxyPort);
    client.write(`CONNECT 127.0.0.1:${echo.port} HTTP/1.1\r\nHost: 127.0.0.1:${echo.port}\r\n\r\n`);
    const head = await readUntil(client, '\r\n\r\n');
    expect(head).toContain('200');

    const payload = Buffer.concat([
      Buffer.from([0x16, 0x03, 0x01, 0x00, 0x64]),
      Buffer.alloc(295, 7),
    ]);
    client.write(payload);
    const echoed = await readBytes(client, payload.length);
    expect(echoed.subarray(0, payload.length).equals(payload)).toBe(true);

    // Первый TLS-кусок пришёл на сервер несколькими пакетами, а не целиком.
    expect(echo.chunks.length).toBeGreaterThan(1);

    // Выключение: Chromium снова ходит напрямую, порт закрыт.
    await page.evaluate(() => window.octo.cmd('dpiToggle'));
    await expect.poll(() => readState(userData).dpiBypass).toBe(false);
    const direct = await app.evaluate(({ session }) =>
      session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
    );
    expect(direct).toBe('DIRECT');

    client.destroy();
    client = null;
    await expect(connect(proxyPort)).rejects.toThrow();
  } finally {
    client?.destroy();
    echo.server.close();
    await app?.close();
  }
});

test('обход DPI вытесняет адрес прокси и наоборот', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-dpi-switch-'));
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
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    // Сначала свой прокси.
    await page.evaluate(() => window.octo.cmd('regionProxyApply', 'socks5://127.0.0.1:1080'));
    await expect.poll(() => readState(userData).region?.proxy).toBe('socks5://127.0.0.1:1080');

    // Включение обхода убирает адрес: два способа не смешиваются.
    await page.evaluate(() => window.octo.cmd('dpiToggle'));
    await expect.poll(() => readState(userData).dpiBypass).toBe(true);
    expect(readState(userData).region?.proxy).toBe('');

    // Переключатель в панели отражает состояние.
    await page.click('#btnPanel');
    await page.click('[data-cat-head="region"]');
    await expect(page.locator('#rowDpiBypass')).toHaveAttribute('aria-checked', 'true');

    // Обратно: адрес прокси выключает обход.
    await page.evaluate(() => window.octo.cmd('regionProxyApply', 'socks5://127.0.0.1:1080'));
    await expect.poll(() => readState(userData).dpiBypass).toBe(false);
    expect(readState(userData).region?.proxy).toBe('socks5://127.0.0.1:1080');
    await expect(page.locator('#rowDpiBypass')).toHaveAttribute('aria-checked', 'false');
  } finally {
    await app?.close();
  }
});

test('обход DPI закрывает простаивающий туннель', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-dpi-idle-'));
  const echo = await startEcho();
  let app;
  let client;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        // Секунды в тесте не ждём: продовый таймаут — 5 минут.
        OCTO_DPI_IDLE_MS: '400',
      },
    });

    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await page.evaluate(() => window.octo.cmd('dpiToggle'));
    await expect.poll(() => readState(userData).dpiBypass).toBe(true);

    const resolved = await app.evaluate(({ session }) =>
      session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
    );
    const match = /PROXY (127\.0\.0\.1:\d+)/.exec(resolved);
    expect(match, `Chromium не использует локальный обход: ${resolved}`).toBeTruthy();
    const proxyPort = Number(match[1].split(':')[1]);

    client = await connect(proxyPort);
    client.write(`CONNECT 127.0.0.1:${echo.port} HTTP/1.1\r\nHost: 127.0.0.1:${echo.port}\r\n\r\n`);
    expect(await readUntil(client, '\r\n\r\n')).toContain('200');

    // Ничего не отправляем: туннель должен закрыться сам по idle-таймауту.
    const closed = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      client.once('close', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    expect(closed).toBe(true);
  } finally {
    client?.destroy();
    echo.server.close();
    await app?.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('сохранённый обход DPI применяется до первой загрузки', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-dpi-start-'));
  fs.writeFileSync(path.join(userData, 'octo-state.json'), JSON.stringify({ dpiBypass: true }));
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
    // prepareDpi() поднимает сервер до createView(), а сессия получает
    // proxyRules до первого loadURL.
    await expect
      .poll(() =>
        app.evaluate(({ session }) =>
          session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
        ),
      )
      .toMatch(/PROXY 127\.0\.0\.1:\d+/);
    expect(readState(userData).dpiBypass).toBe(true);
  } finally {
    await app?.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
