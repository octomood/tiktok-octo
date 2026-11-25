'use strict';

const https = require('node:https');
const net = require('node:net');

/**
 * Локальный обход DPI без прокси и VPN (в духе Zapret / GoodbyeDPI / ByeDPI).
 *
 * Два уровня защиты от блокировок и замедления (включая ТСПУ):
 *   1. DoH (DNS-over-HTTPS) напрямую по IP (1.1.1.1 / 8.8.8.8 / 9.9.9.9) —
 *      обходит подмену и блокировку системного DNS провайдера.
 *   2. Разбиение TLS-записи ClientHello (TLS Record Splitting) + TCP-фрагментация
 *      прямо внутри имени хоста (SNI): и запись TLS, и TCP-пакеты разрезаются
 *      внутри домена (например, «www.tik» | «tok.com»). Для TLS-сервера это
 *      стандартная фрагментация записи по RFC 5246/8446, а DPI не видит SNI
 *      целиком ни в одной записи, ни в одном сегменте.
 *
 * Ограничения, о которых честно сказано в интерфейсе:
 *   • не помогает, если сам IP-адрес сервера заблокирован на маршрутизаторе;
 *   • не меняет внешний IP (ограничения самого TikTok по стране IP снимает
 *     только прокси или VPN);
 *   • работает только для HTTPS (CONNECT на 443).
 */

const HANDSHAKE_LIMIT = 16 * 1024;
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = Number(process.env.OCTO_DPI_IDLE_MS) || 5 * 60_000;
const DOH_TIMEOUT_MS = 2500;
const DOH_CACHE_MAX = 256;
const TLS_HANDSHAKE = 0x16;
const TLS_CLIENT_HELLO = 0x01;
const FRAGMENT_DELAY_MS = 1;
// Запасное разбиение, если SNI не найден (например, ECH или неполный буфер).
const FALLBACK_SIZES = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

const DOH_ENDPOINTS = [
  (host) => `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
  (host) => `https://8.8.8.8/resolve?name=${encodeURIComponent(host)}&type=A`,
  (host) => `https://9.9.9.9:5053/dns-query?name=${encodeURIComponent(host)}&type=A`,
];

let server = null;
let port = 0;
const sockets = new Set();
const dnsCache = new Map();

function track(socket) {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
}

/** В обычной жизни пропускаем только HTTPS и не-локальные IP; в тестах нужен свой порт. */
function isPrivateHost(host) {
  const lower = String(host || '').toLowerCase();
  if (lower === 'localhost' || lower === '::1' || lower === '::') return true;
  if (/^fe80:/i.test(lower) || /^fc[0-9a-f]{2}:/i.test(lower) || /^fd[0-9a-f]{2}:/i.test(lower)) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function allowedTarget(host, targetPort) {
  if (process.env.OCTO_E2E === '1') return true;
  return targetPort === 443 && !isPrivateHost(host);
}

/**
 * Находит точные смещения имени хоста (SNI, extension 0x0000) внутри буфера
 * TLS-записи ClientHello. При неполном или нестандартном пакете возвращает null.
 */
function findClientHelloSni(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 43) return null;
  if (buf[0] !== TLS_HANDSHAKE || buf[5] !== TLS_CLIENT_HELLO) return null;

  const recordLen = buf.readUInt16BE(3);
  const recordEnd = Math.min(buf.length, 5 + recordLen);

  // Пропускаем заголовок handshake (4), версию (2) и ClientRandom (32).
  let pos = 5 + 4 + 2 + 32;
  if (pos >= recordEnd) return null;

  // Session ID (1-byte len)
  const sidLen = buf[pos];
  pos += 1 + sidLen;
  if (pos + 2 > recordEnd) return null;

  // Cipher Suites (2-byte len)
  const csLen = buf.readUInt16BE(pos);
  pos += 2 + csLen;
  if (pos + 1 > recordEnd) return null;

  // Compression Methods (1-byte len)
  const cmLen = buf[pos];
  pos += 1 + cmLen;
  if (pos + 2 > recordEnd) return null;

  // Extensions (2-byte total len)
  const extLen = buf.readUInt16BE(pos);
  pos += 2;
  const extEnd = Math.min(recordEnd, pos + extLen);

  while (pos + 4 <= extEnd) {
    const type = buf.readUInt16BE(pos);
    const len = buf.readUInt16BE(pos + 2);
    pos += 4;
    if (pos + len > extEnd) break;

    if (type === 0x0000 && len >= 5) {
      const nameType = buf[pos + 2];
      const nameLen = buf.readUInt16BE(pos + 3);
      const start = pos + 5;
      const end = start + nameLen;
      if (nameType === 0x00 && nameLen > 0 && end <= pos + len) {
        return { start, end };
      }
    }
    pos += len;
  }

  return null;
}

function makeTlsRecord(verHi, verLo, payload) {
  const header = Buffer.allocUnsafe(5);
  header[0] = TLS_HANDSHAKE;
  header[1] = verHi;
  header[2] = verLo;
  header.writeUInt16BE(payload.length, 3);
  return Buffer.concat([header, payload]);
}

function sliceBytes(buf) {
  const pieces = [];
  let offset = 0;
  let index = 0;
  while (offset < buf.length) {
    const size = index < FALLBACK_SIZES.length ? FALLBACK_SIZES[index] : 128;
    const end = Math.min(buf.length, offset + size);
    pieces.push(buf.subarray(offset, end));
    offset = end;
    index += 1;
  }
  return pieces;
}

/**
 * Разбивает TLS-запись ClientHello на несколько валидных TLS-записей прямо
 * внутри SNI-имени, чтобы ни одна запись и ни один TCP-пакет не содержали
 * домен целиком.
 */
function buildTlsPieces(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 5 || buf[0] !== TLS_HANDSHAKE) {
    return [buf];
  }

  const recordLen = buf.readUInt16BE(3);
  if (recordLen === 0 || 5 + recordLen > buf.length) {
    return sliceBytes(buf);
  }

  const sni = findClientHelloSni(buf);
  if (!sni || sni.end - sni.start < 4) {
    return sliceBytes(buf);
  }

  const verHi = buf[1];
  const verLo = buf[2];
  const payload = buf.subarray(5, 5 + recordLen);
  const trailing = buf.subarray(5 + recordLen);

  const pStart = sni.start - 5;
  const pEnd = sni.end - 5;
  const span = pEnd - pStart;
  const cut1 = pStart + Math.max(1, Math.min(2, Math.floor(span / 3)));
  const cut2 = Math.max(cut1 + 1, pStart + Math.floor((span * 2) / 3));

  const records = [];
  let prev = 0;
  for (const cut of [cut1, cut2]) {
    if (cut > prev && cut < payload.length) {
      records.push(makeTlsRecord(verHi, verLo, payload.subarray(prev, cut)));
      prev = cut;
    }
  }
  records.push(makeTlsRecord(verHi, verLo, payload.subarray(prev)));
  if (trailing.length) records.push(trailing);
  return records;
}

function writePieces(socket, pieces) {
  let index = 0;

  return new Promise((resolve) => {
    const step = () => {
      if (socket.destroyed || index >= pieces.length) {
        resolve();
        return;
      }

      const piece = pieces[index];
      index += 1;
      if (!piece || !piece.length) {
        step();
        return;
      }

      socket.write(piece, () => {
        if (index >= pieces.length) resolve();
        else setTimeout(step, FRAGMENT_DELAY_MS);
      });
    };

    step();
  });
}

function fetchDohJson(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: { accept: 'application/dns-json' },
        timeout: DOH_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size <= 32 * 1024) chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const answers = Array.isArray(json.Answer) ? json.Answer : [];
            const record = answers.find((item) => item.type === 1 && net.isIPv4(item.data));
            if (!record) {
              resolve(null);
              return;
            }
            const ttl = Math.min(300, Math.max(30, Number(record.TTL) || 60));
            resolve({ ip: record.data, expiresAt: Date.now() + ttl * 1000 });
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * Резолвит хост через DoH напрямую по IP, чтобы обойти подмену DNS провайдера.
 * При неудаче или в E2E-тестах возвращает исходный хост для системного DNS.
 */
async function resolveTargetHost(host) {
  if (!host || net.isIP(host) !== 0 || isPrivateHost(host)) return host;
  if (process.env.OCTO_E2E === '1' && !process.env.OCTO_DOH_URL) return host;

  const key = host.toLowerCase();
  const cached = dnsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.ip;
  if (cached) dnsCache.delete(key);

  const customUrl = process.env.OCTO_DOH_URL;
  const urls = customUrl
    ? [`${customUrl}?name=${encodeURIComponent(key)}&type=A`]
    : DOH_ENDPOINTS.map((build) => build(key));

  for (const url of urls) {
    const resolved = await fetchDohJson(url);
    if (resolved) {
      if (dnsCache.size >= DOH_CACHE_MAX) {
        const oldest = dnsCache.keys().next().value;
        if (oldest) dnsCache.delete(oldest);
      }
      dnsCache.set(key, resolved);
      return resolved.ip;
    }
  }

  return host;
}

function deny(client, status, reason) {
  try {
    client.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  } catch {
    /* клиент уже закрылся */
  }
}

async function openTunnel(client, host, targetPort, rest) {
  const connectHost = await resolveTargetHost(host);
  if (client.destroyed) return;

  const connectOpts = { host: connectHost, port: targetPort };
  // Если DoH не сработал, предпочитаем IPv4: на части провайдеров IPv6 висит.
  if (net.isIP(connectHost) === 0 && !isPrivateHost(connectHost)) connectOpts.family = 4;

  const upstream = net.connect(connectOpts);
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
    client.setTimeout(IDLE_TIMEOUT_MS, () => client.destroy());
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    let handledFirst = false;
    let fragmenting = false;
    let tlsBuffer = Buffer.alloc(0);
    let expectedRecordBytes = 0;

    const flushTls = () => {
      const data = tlsBuffer;
      tlsBuffer = Buffer.alloc(0);
      handledFirst = true;
      fragmenting = true;
      client.pause();
      const pieces = buildTlsPieces(data);
      void writePieces(upstream, pieces).then(() => {
        fragmenting = false;
        if (!client.destroyed && !upstream.destroyed) client.resume();
      });
    };

    const forward = (chunk) => {
      if (upstream.destroyed || !chunk.length) return;

      // Собираем первый TLS-пакет целиком, чтобы найти точный SNI и разрезать
      // ClientHello сразу и на уровне TLS-записей, и на уровне TCP-сегментов.
      if (!handledFirst) {
        if (!tlsBuffer.length && chunk[0] !== TLS_HANDSHAKE) {
          handledFirst = true;
          if (!upstream.write(chunk)) client.pause();
          return;
        }

        tlsBuffer = tlsBuffer.length ? Buffer.concat([tlsBuffer, chunk]) : chunk;
        if (!expectedRecordBytes && tlsBuffer.length >= 5) {
          expectedRecordBytes = 5 + tlsBuffer.readUInt16BE(3);
        }

        if (
          (expectedRecordBytes > 0 && tlsBuffer.length >= expectedRecordBytes) ||
          tlsBuffer.length >= HANDSHAKE_LIMIT
        ) {
          flushTls();
        }
        return;
      }

      if (!upstream.write(chunk) && !fragmenting) client.pause();
    };

    upstream.on('drain', () => {
      if (!fragmenting && !client.destroyed) client.resume();
    });

    if (rest.length) forward(rest);
    client.on('data', forward);
    if (!fragmenting) client.resume();
    upstream.on('data', (chunk) => {
      if (client.destroyed) return;
      if (!client.write(chunk)) upstream.pause();
    });
    client.on('drain', () => {
      if (!upstream.destroyed) upstream.resume();
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

    if (!allowedTarget(host, targetPort)) {
      deny(client, 403, 'Forbidden');
      return;
    }

    void openTunnel(client, host, targetPort, rest);
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
  dnsCache.clear();
}

function activeRules() {
  return port ? `https=127.0.0.1:${port}` : '';
}

function isActive() {
  return Boolean(server);
}

module.exports = {
  start,
  stop,
  activeRules,
  isActive,
  findClientHelloSni,
  buildTlsPieces,
};
