'use strict';

const { isTikTokUrl } = require('./shared');

/** Разбор ссылок tiktok-octo:// и argv без зависимостей от Electron. */

const PROTOCOL = 'tiktok-octo';

function normalizeTikTokHttp(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com'))
    ) {
      parsed.protocol = 'https:';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

function decodeArgument(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();

  if (raw.startsWith(`${PROTOCOL}://`)) {
    try {
      const url = new URL(raw);
      const target = url.searchParams.get('url');
      if (target) return normalizeTikTokHttp(target);
      const host = url.hostname;
      if (!host) return '';
      return `https://${host}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '';
    }
  }

  return normalizeTikTokHttp(raw);
}

function targetFromArgv(argv) {
  for (const value of argv || []) {
    const url = decodeArgument(value);
    if (isTikTokUrl(url)) return url;
  }
  return '';
}

function externalHttpUrlFromArgv(argv) {
  for (const value of argv || []) {
    if (typeof value !== 'string') continue;
    const raw = value.trim();
    if (!raw || raw.startsWith('-') || raw.startsWith(`${PROTOCOL}://`)) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (isTikTokUrl(normalizeTikTokHttp(url.href))) continue;
      return url.href;
    } catch {
      /* не URL */
    }
  }
  return '';
}

module.exports = { PROTOCOL, decodeArgument, targetFromArgv, externalHttpUrlFromArgv };
