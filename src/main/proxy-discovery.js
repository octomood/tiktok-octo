'use strict';

const net = require('node:net');
const { session } = require('electron');
const { lookupExternalIp } = require('./ip-lookup');

/**
 * Поиск уже запущенного локального прокси.
 *
 * Приложение не поставляет прокси-серверы: бесплатные публичные прокси живут
 * часы, а трафик через них идёт к незнакомым людям. Зато почти все VPN-клиенты
 * (v2ray/Xray, Clash/Mihomo, Tor, Privoxy) поднимают SOCKS5 или HTTP-прокси
 * на localhost со стандартным портом. Их и ищем: TCP-проверка порта, затем
 * настоящий запрос внешнего IP через найденный прокси.
 */

const LOCAL_PROXIES = [
  { url: 'socks5://127.0.0.1:10808', label: 'v2ray / Xray' },
  { url: 'http://127.0.0.1:10809', label: 'v2ray / Xray (HTTP)' },
  { url: 'http://127.0.0.1:7890', label: 'Clash / Mihomo' },
  { url: 'socks5://127.0.0.1:7891', label: 'Clash / Mihomo (SOCKS)' },
  { url: 'http://127.0.0.1:7897', label: 'Clash Verge' },
  { url: 'socks5://127.0.0.1:9050', label: 'Tor' },
  { url: 'http://127.0.0.1:8118', label: 'Privoxy' },
  { url: 'socks5://127.0.0.1:1080', label: 'SOCKS5' },
];

const PROBE_TIMEOUT_MS = 400;
const VERIFY_TIMEOUT_MS = 5000;

function portOf(url) {
  try {
    return Number(new URL(url).port);
  } catch {
    return 0;
  }
}

/** Открыт ли TCP-порт. Ошибка и таймаут — это «закрыт». */
function isPortOpen(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (!port) {
      resolve(false);
      return;
    }

    const socket = net.connect({ host, port });
    let settled = false;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

let verifySeq = 0;

/**
 * Настоящая проверка: запрос внешнего IP через временную сессию с этим
 * прокси. Возвращает { ip, country, city } или null.
 */
async function verifyProxy(url) {
  const partition = `octo-proxy-check-${process.pid}-${++verifySeq}`;
  const ses = session.fromPartition(partition);

  try {
    await ses.setProxy({
      mode: 'fixed_servers',
      proxyRules: url,
      proxyBypassRules: '<local>',
    });
    return await lookupExternalIp(ses, { timeoutMs: VERIFY_TIMEOUT_MS });
  } catch {
    return null;
  } finally {
    try {
      ses.closeAllConnections();
    } catch {
      /* соединения закроются сами */
    }
    try {
      await ses.clearStorageData();
    } catch {
      /* временная сессия умирает вместе с процессом */
    }
  }
}

/**
 * Список найденных прокси. По умолчанию проверяем ещё и выход в интернет:
 * открытый порт без связи только запутает.
 */
async function discover({ verify = true } = {}) {
  const reachable = await Promise.all(
    LOCAL_PROXIES.map(async (candidate) => ({
      ...candidate,
      open: await isPortOpen('127.0.0.1', portOf(candidate.url)),
    })),
  );

  const found = reachable.filter((candidate) => candidate.open);

  const items = await Promise.all(
    found.map(async (candidate) => {
      const info = verify ? await verifyProxy(candidate.url) : null;
      return {
        url: candidate.url,
        label: candidate.label,
        online: Boolean(info?.ip),
        ip: info?.ip || '',
        country: info?.country || '',
        city: info?.city || '',
      };
    }),
  );

  // Сначала работающие, потом просто открытые порты; внутри — порядок списка.
  return items.sort((left, right) => Number(right.online) - Number(left.online));
}

module.exports = { LOCAL_PROXIES, discover, verifyProxy, isPortOpen };
