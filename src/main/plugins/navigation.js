'use strict';

const { isTikTokUrl } = require('../shared');

/**
 * Безопасная навигация плагина.
 *
 * Разрешаем только https-страницы самого TikTok. Относительные пути
 * (/@user, /search?q=…) считаются страницами tiktok.com. Всё остальное —
 * null, чтобы плагин не мог увести приложение на внешний сайт.
 */
function normalizeTikTokUrl(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 2000) return null;
  if (/[\u0000-\u001f]/.test(text)) return null;

  let candidate = text;
  if (candidate.startsWith('/')) candidate = `https://www.tiktok.com${candidate}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!isTikTokUrl(url.toString())) return null;
  return url.toString();
}

module.exports = { normalizeTikTokUrl };
