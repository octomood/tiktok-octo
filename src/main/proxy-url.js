'use strict';

/**
 * Адрес прокси для файлов, которые покидают профиль: экспорт настроек,
 * резервные копии и «мой архив».
 *
 * Логин и пароль нужны живой сессии, но не должны уезжать в JSON, который
 * пользователь пересылает или хранит отдельно. Адрес без них остаётся
 * полезным: видно, какой прокси был выбран, и его можно дополнить вручную.
 */

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

function stripProxyCredentials(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  const hasScheme = SCHEME.test(text);
  let url;
  try {
    url = new URL(hasScheme ? text : `socks5://${text}`);
  } catch {
    return text;
  }

  // Без логина и пароля адрес возвращаем как написан: не меняем регистр,
  // схему по умолчанию и хвостовой слэш.
  if (!url.username && !url.password) return text;

  const clean = `${url.protocol}//${url.host}`;
  return hasScheme ? clean : url.host;
}

/** Копия настроек региона без учётных данных и секрета прокси. */
function stripRegionCredentials(region) {
  const value = region && typeof region === 'object' ? { ...region } : {};
  if ('proxy' in value) value.proxy = stripProxyCredentials(value.proxy);
  delete value.proxySecret;
  delete value.proxyAuth;
  return value;
}

module.exports = { stripProxyCredentials, stripRegionCredentials };
