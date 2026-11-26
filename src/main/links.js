'use strict';

const { shell } = require('electron');
const { toast } = require('./app-context');
const { isExternalUrl } = require('./shared');
const linkHandler = require('./link-handler');

/**
 * Всё, что не является внутренней страницей приложения, уходит в системный
 * браузер. Схему проверяем белым списком: file:// и javascript: сюда не попадут.
 * Если клиент сам назначен обработчиком http/https, отправляем ссылку в
 * сохранённый браузер напрямую, чтобы не зациклиться через xdg-open.
 */
function openExternal(url) {
  if (!isExternalUrl(url)) return false;
  if (/^https?:/i.test(url) && linkHandler.isEnabled()) {
    if (linkHandler.openInFallbackBrowser(url)) {
      toast('Ссылка открыта в браузере');
    } else {
      toast('Не удалось открыть ссылку');
    }
    return true;
  }
  shell.openExternal(url).catch(() => toast('Не удалось открыть ссылку'));
  toast('Ссылка открыта в браузере');
  return true;
}

module.exports = { openExternal };
