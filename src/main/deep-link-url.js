'use strict';

const { isTikTokUrl } = require('./shared');

/** Разбор ссылок tiktok-octo:// и argv без зависимостей от Electron. */

const PROTOCOL = 'tiktok-octo';

function decodeArgument(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();

  if (raw.startsWith(`${PROTOCOL}://`)) {
    try {
      const url = new URL(raw);
      const target = url.searchParams.get('url');
      if (target) return target;
      const host = url.hostname;
      if (!host) return '';
      return `https://${host}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '';
    }
  }

  try {
    return new URL(raw).href;
  } catch {
    return '';
  }
}

function targetFromArgv(argv) {
  for (const value of argv || []) {
    const url = decodeArgument(value);
    if (isTikTokUrl(url)) return url;
  }
  return '';
}

module.exports = { PROTOCOL, decodeArgument, targetFromArgv };
