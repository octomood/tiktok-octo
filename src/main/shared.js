'use strict';

/**
 * Константы и предикаты, общие для main-процесса.
 *
 * Важно: preload работает в песочнице и не может требовать этот файл,
 * поэтому всё, что нужно мосту, дублируется там явно.
 */

// Тесты и отладка могут подменить стартовую страницу (см. OCTO_HOME_URL).
const HOME_URL = process.env.OCTO_HOME_URL || 'https://www.tiktok.com/';

// Высота нашей собственной полосы заголовка (px).
const TITLEBAR_H = 44;

// Верхняя граница «хрома»: полоса заголовка + панель поиска по странице.
const MAX_CHROME_H = 120;

// Отдельная persistent-сессия: логин и настройки сайта живут между запусками.
const PARTITION = 'persist:octo-tiktok';

/**
 * TikTok и часть CDN отсекают неизвестные UA с токеном Electron,
 * поэтому представляемся обычным свежим Chrome.
 */
function buildUserAgent() {
  const chrome = process.versions.chrome || '128.0.0.0';
  const os =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
}

const CHROME_UA = buildUserAgent();

/**
 * OAuth-окна (Google, Apple, Facebook, X).
 *
 * Проверяем не только хост, но и путь: иначе любая ссылка на facebook.com
 * (пост, профиль) открывалась бы в маленьком popup вместо системного браузера.
 */
const AUTH_RULES = [
  {
    host: 'accounts.google.com',
    path: /^\/(?:o\/oauth2|signin|v3\/signin|ServiceLogin)/,
  },
  { host: 'appleid.apple.com', path: /^\/(?:auth|appleid)/ },
  { host: 'idmsa.apple.com', path: /^\// },
  {
    host: /^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/,
    path: /^\/(?:v\d+\.\d+\/dialog\/oauth|dialog\/oauth)/,
  },
  { host: /^(?:www\.)?twitter\.com$/, path: /^\/(?:i\/)?oauth/ },
  { host: 'api.twitter.com', path: /^\/oauth/ },
  { host: /^(?:www\.)?x\.com$/, path: /^\/(?:i\/)?oauth/ },
];

/** @returns {URL | null} */
function parseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isTikTokUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return false;
  return url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com');
}

function isAuthUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return false;
  return AUTH_RULES.some((rule) => {
    const hostOk =
      typeof rule.host === 'string' ? url.hostname === rule.host : rule.host.test(url.hostname);
    return hostOk && rule.path.test(url.pathname);
  });
}

/** Хост из списка OAuth-провайдеров, без проверки пути (для popup-окон). */
function isAuthHost(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return false;
  return AUTH_RULES.some((rule) =>
    typeof rule.host === 'string' ? url.hostname === rule.host : rule.host.test(url.hostname),
  );
}

/** Ссылки, которые можно безопасно отдать системному браузеру. */
function isExternalUrl(rawUrl) {
  return /^(?:https?|mailto):/i.test(rawUrl || '');
}

/** Внутри приложения живут только TikTok, OAuth-экраны и служебные схемы. */
function isInternalUrl(rawUrl) {
  return isTikTokUrl(rawUrl) || isAuthUrl(rawUrl) || /^about:blank$/i.test(rawUrl || '');
}

/**
 * TikTok кладёт число непрочитанных в заголовок страницы — этого достаточно
 * для бейджа, не нужно лезть в DOM и приватные запросы.
 */
function parseUnreadCount(title) {
  if (!title) return 0;
  const leading = title.match(/^\s*\((\d+)\+?\)/);
  if (leading) return Number(leading[1]);
  const worded = title.match(/(\d+)\s*(?:new\s+)?(?:notifications?|уведомлен)/i);
  return worded ? Number(worded[1]) : 0;
}

module.exports = {
  HOME_URL,
  TITLEBAR_H,
  MAX_CHROME_H,
  PARTITION,
  AUTH_RULES,
  CHROME_UA,
  isTikTokUrl,
  isAuthUrl,
  isAuthHost,
  isExternalUrl,
  isInternalUrl,
  parseUnreadCount,
};
