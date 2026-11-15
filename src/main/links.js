'use strict';

const { shell } = require('electron');
const { toast } = require('./app-context');
const { isExternalUrl } = require('./shared');

/**
 * Всё, что не является внутренней страницей приложения, уходит в системный
 * браузер. Схему проверяем белым списком: file:// и javascript: сюда не попадут.
 */
function openExternal(url) {
  if (!isExternalUrl(url)) return false;
  shell.openExternal(url).catch(() => toast('Не удалось открыть ссылку'));
  toast('Ссылка открыта в браузере');
  return true;
}

module.exports = { openExternal };
