'use strict';

const net = require('node:net');

/**
 * Локальный обход DPI фрагментацией TLS-рукопожатия.
 *
 * Идея та же, что у Zapret/GoodbyeDPI: фильтр в сети ищет имя сайта (SNI) в
 * первых пакетах TLS-рукопожатия. Мы не подменяем трафик и не расшифровываем
 * его — только отдаём ClientHello мелкими кусками с паузами, чтобы DPI не
 * увидел имя целиком. Соединение идёт напрямую к настоящему серверу, без
 * прокси, VPN и чужих серверов.
 *
 * Ограничения, о которых честно сказано в интерфейсе:
 *   • это не помогает, если адрес сайта блокируют по IP, а не по имени;
 *   • DPI может собирать пакеты обратно;
 *   • работает только HTTPS (CONNECT на 443), потому что только там мы видим
 *     начало TLS-рукопожатия.
 *
 * Порт слушается на 127.0.0.1 и выбирается случайно: снаружи сервер
 * недоступен, и это не открытый прокси.
 */

const HANDSHAKE_LIMIT = 8 * 1024;
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = Number(process.env.OCTO_DPI_IDLE_MS) || 5 * 60_000;
const TLS_HANDSHAKE = 0x16;
const FRAGMENT_DELAY_MS = 1;
// Нарастающие куски: имя сайта приходится на первые байты ClientHello.
const FRAGMENT_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

let server = null;
let port = 0;
const sockets = new Set();

function track(socket) {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
}

/** В обычной жизни пропускаем только HTTPS; в тестах нужен свой порт. */
function allowedPort(targetPort) {
  if (process.env.OCTO_E2E === '1') return true;
  return targetPort === 443;
}

/**
 * Отправляет первый кусок TLS мелкими записями с паузами. TCP сохраняет
 * порядок, поэтому данные не теряются и не перемешиваются.
 */
function writeFragments(socket, buffer) {
  let offset = 0;
  let index = 0;

  return new Promise((resolve) => {
    const step = () => {
      if (socket.destroyed || offset >= buffer.length) {
        resolve();
        return;
      }

      const size = index < FRAGMENT_SIZES.length ? FRAGMENT_SIZES[index] : 128;
      const end = Math.min(buffer.length, offset + size);
      const piece = buffer.subarray(offset, end);
      offset = end;
      index += 1;

      socket.write(piece, () => setTimeout(step, FRAGMENT_DELAY_MS));
    };

    step();
  });
}

function deny(client, status, reason) {
  try {
    client.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  } catch {
    /* клиент уже закрылся */
  }
}

function openTunnel(client, host, targetPort, rest) {
  const upstream = net.connect({ host, port: targetPort });
  track(upstream);
  let established = false;

  upstream.setTimeout(CONNECT_TIMEOUT_MS, () => {
    if (!established) upstream.destroy();
  });

  upstream.once('connect', () => {
    established = true;
    // Простаивающий туннель закрываем сами: без обработчика IDLE_TIMEOUT_MS
    // оставался только connect-таймаут с проверкой established, и сокеты
    // висели до закрытия со стороны браузера.
    upstream.setTimeout(IDLE_TIMEOUT_MS, () => upstream.destroy());
    upstream.setNoDelay(true);
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    let fragmented = false;
    const forward = (chunk) => {
      if (upstream.destroyed || !chunk.length) return;

      // Фрагментируем ровно первое, что прислал клиент, — TLS ClientHello.
      if (!fragmented) {
        fragmented = true;
        if (chunk[0] === TLS_HANDSHAKE) {
          void writeFragments(upstream, chunk);
          return;
        }
      }

      upstream.write(chunk);
    };

    if (rest.length) forward(rest);
    client.on('data', forward);
    client.resume();
    upstream.on('data', (chunk) => {
      if (!client.destroyed) client.write(chunk);
    });
  });

  upstream.once('error', () => {
    if (!established) deny(client, 502, 'Bad Gateway');
    else client.destroy();
  });

  client.once('error', () => upstream.destroy());
  upstream.once('close', () => client.destroy());
  client.once('close', () => upstream.destroy());
}

function handleConnection(client) {
  track(client);
  client.setNoDelay(true);
  client.setTimeout(CONNECT_TIMEOUT_MS, () => client.destroy());

  let buffer = Buffer.alloc(0);

  const onData = (chunk) => {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;

    if (buffer.length > HANDSHAKE_LIMIT) {
      client.off('data', onData);
      deny(client, 431, 'Request Header Fields Too Large');
      return;
    }

    const end = buffer.indexOf('\r\n\r\n');
    if (end < 0) return;

    client.off('data', onData);
    client.setTimeout(0);
    // Пока открывается туннель, байты копятся в потоке, а не теряются.
    client.pause();

    const head = buffer.subarray(0, end).toString('latin1');
    const rest = buffer.subarray(end + 4);
    const requestLine = head.split('\r\n')[0] || '';
    const parts = requestLine.split(' ');

    if (parts[0]?.toUpperCase() !== 'CONNECT' || parts.length < 3) {
      deny(client, 405, 'Method Not Allowed');
      return;
    }

    const target = parts[1];
    const colon = target.lastIndexOf(':');
    if (colon <= 0) {
      deny(client, 400, 'Bad Request');
      return;
    }

    const host = target.slice(0, colon).replace(/^\[|\]$/g, '');
    const targetPort = Number(target.slice(colon + 1));
    if (!host || !Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
      deny(client, 400, 'Bad Request');
      return;
    }

    if (!allowedPort(targetPort)) {
      deny(client, 403, 'Forbidden');
      return;
    }

    openTunnel(client, host, targetPort, rest);
  };

  client.on('data', onData);
}

function connectServer() {
  const next = net.createServer(handleConnection);
  next.on('error', () => {
    if (process.env.OCTO_DEBUG) console.warn('[octo] dpi proxy server error');
  });

  return new Promise((resolve, reject) => {
    const onError = (err) => {
      next.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      next.off('error', onError);
      resolve(next);
    };

    next.once('error', onError);
    next.once('listening', onListening);
    next.listen(0, '127.0.0.1');
  });
}

async function start() {
  if (server) return port;
  server = await connectServer();
  port = server.address().port;
  return port;
}

function stop() {
  if (!server) return;
  const current = server;
  server = null;
  port = 0;

  try {
    current.close();
  } catch {
    /* сервер уже закрыт */
  }

  for (const socket of sockets) socket.destroy();
  sockets.clear();
}

function activeRules() {
  return port ? `https=127.0.0.1:${port}` : '';
}

function isActive() {
  return Boolean(server);
}

module.exports = { start, stop, activeRules, isActive };
