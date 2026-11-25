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

function buildFakeClientHello(hostname) {
  const hostBytes = Buffer.from(hostname, 'ascii');
  const sniEntry = Buffer.alloc(3 + hostBytes.length);
  sniEntry[0] = 0x00;
  sniEntry.writeUInt16BE(hostBytes.length, 1);
  hostBytes.copy(sniEntry, 3);

  const sniList = Buffer.alloc(2 + sniEntry.length);
  sniList.writeUInt16BE(sniEntry.length, 0);
  sniEntry.copy(sniList, 2);

  const sniExt = Buffer.alloc(4 + sniList.length);
  sniExt.writeUInt16BE(0x0000, 0);
  sniExt.writeUInt16BE(sniList.length, 2);
  sniList.copy(sniExt, 4);

  const otherExt = Buffer.from([0x00, 0x17, 0x00, 0x00]);
  const exts = Buffer.concat([otherExt, sniExt]);
  const extBlock = Buffer.alloc(2 + exts.length);
  extBlock.writeUInt16BE(exts.length, 0);
  exts.copy(extBlock, 2);

  const body = Buffer.concat([
    Buffer.from([0x03, 0x03]),
    Buffer.alloc(32, 0xaa),
    Buffer.from([0x00]),
    Buffer.from([0x00, 0x02, 0x13, 0x01]),
    Buffer.from([0x01, 0x00]),
    extBlock,
  ]);

  const hs = Buffer.alloc(4 + body.length);
  hs[0] = 0x01;
  hs[1] = (body.length >> 16) & 0xff;
  hs[2] = (body.length >> 8) & 0xff;
  hs[3] = body.length & 0xff;
  body.copy(hs, 4);

  const rec = Buffer.alloc(5 + hs.length);
  rec[0] = 0x16;
  rec[1] = 0x03;
  rec[2] = 0x01;
  rec.writeUInt16BE(hs.length, 3);
  hs.copy(rec, 5);
  return rec;
}

test('разбиение TLS ClientHello режет запись внутри SNI', () => {
  const { findClientHelloSni, buildTlsPieces } = require('../src/main/dpi-bypass');

  const hello = buildFakeClientHello('www.tiktok.com');
  const sni = findClientHelloSni(hello);
  expect(sni).not.toBeNull();
  expect(hello.subarray(sni.start, sni.end).toString('ascii')).toBe('www.tiktok.com');

  const pieces = buildTlsPieces(hello);
  expect(pieces.length).toBeGreaterThan(2);

  let reassembledPayload = Buffer.alloc(0);
  for (const piece of pieces) {
    expect(piece[0]).toBe(0x16);
    expect(piece.subarray(1, 3)).toEqual(Buffer.from([0x03, 0x01]));
    const len = piece.readUInt16BE(3);
    expect(piece.length).toBe(5 + len);
    expect(piece.toString('ascii')).not.toContain('tiktok.com');
    reassembledPayload = Buffer.concat([reassembledPayload, piece.subarray(5)]);
  }
  expect(reassembledPayload).toEqual(hello.subarray(5));
});

test('разбиение TLS без SNI сохраняет целостность данных', () => {
  const { findClientHelloSni, buildTlsPieces } = require('../src/main/dpi-bypass');

  const raw = Buffer.concat([Buffer.from([0x16, 0x03, 0x01, 0x00, 0x40]), Buffer.alloc(64, 0x55)]);
  expect(findClientHelloSni(raw)).toBeNull();

  const pieces = buildTlsPieces(raw);
  expect(pieces.length).toBeGreaterThan(1);
  expect(Buffer.concat(pieces)).toEqual(raw);
});
