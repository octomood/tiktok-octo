'use strict';

const { dialog } = require('electron');
const { t } = require('./i18n');

/**
 * Нативные диалоги Electron не умеют локализацию: строки в них задаёт
 * приложение. Оборачиваем options перед вызовом, чтобы подписи кнопок,
 * заголовки и тексты проходили через тот же словарь, что меню и панель.
 */

function localizeOptions(options) {
  if (!options || typeof options !== 'object') return options;
  const next = { ...options };

  for (const key of ['title', 'message', 'detail', 'buttonLabel']) {
    if (typeof next[key] === 'string') next[key] = t(next[key]);
  }

  if (Array.isArray(next.buttons)) {
    next.buttons = next.buttons.map((button) => (typeof button === 'string' ? t(button) : button));
  }

  if (Array.isArray(next.filters)) {
    next.filters = next.filters.map((filter) =>
      filter && typeof filter === 'object'
        ? { ...filter, name: typeof filter.name === 'string' ? t(filter.name) : filter.name }
        : filter,
    );
  }

  return next;
}

function showMessageBox(parentOrOptions, maybeOptions) {
  if (maybeOptions === undefined) {
    return dialog.showMessageBox(localizeOptions(parentOrOptions));
  }
  return dialog.showMessageBox(parentOrOptions, localizeOptions(maybeOptions));
}

function showOpenDialog(parentOrOptions, maybeOptions) {
  if (maybeOptions === undefined) {
    return dialog.showOpenDialog(localizeOptions(parentOrOptions));
  }
  return dialog.showOpenDialog(parentOrOptions, localizeOptions(maybeOptions));
}

function showSaveDialog(parentOrOptions, maybeOptions) {
  if (maybeOptions === undefined) {
    return dialog.showSaveDialog(localizeOptions(parentOrOptions));
  }
  return dialog.showSaveDialog(parentOrOptions, localizeOptions(maybeOptions));
}

function showErrorBox(title, content) {
  return dialog.showErrorBox(t(title), typeof content === 'string' ? t(content) : content);
}

module.exports = {
  showMessageBox,
  showOpenDialog,
  showSaveDialog,
  showErrorBox,
};
