'use strict';

const { ctx, pushState } = require('./app-context');

/**
 * Поиск по странице.
 *
 * Панель живёт в нашем renderer (полоса заголовка), а сам поиск выполняется
 * в webContents сайта через findInPage — страницу не трогаем.
 */

function contents() {
  return ctx.view?.webContents ?? null;
}

function open() {
  if (!ctx.win) return;
  ctx.find.open = true;
  pushState();
  // Фокус уходит в input панели, иначе печатать будет некуда.
  ctx.win.webContents.focus();
}

function close({ focusView = true } = {}) {
  const wc = contents();
  ctx.find = {
    open: false,
    text: '',
    matches: 0,
    active: 0,
    requestId: 0,
  };
  if (wc && !wc.isDestroyed()) wc.stopFindInPage('clearSelection');
  pushState();
  if (focusView) ctx.view?.webContents.focus();
}

function search(text, { forward = true, findNext = false } = {}) {
  const wc = contents();
  if (!wc) return;

  const value = String(text ?? '');
  ctx.find.text = value;

  if (!value) {
    wc.stopFindInPage('clearSelection');
    ctx.find.matches = 0;
    ctx.find.active = 0;
    pushState();
    return;
  }

  // Каждый запрос получает свой id: результаты по старым запросам игнорируем.
  const requestId = wc.findInPage(value, { forward, findNext });
  ctx.find.requestId = requestId;
  pushState();
}

function next() {
  if (ctx.find.text) search(ctx.find.text, { forward: true, findNext: true });
}

function prev() {
  if (ctx.find.text) search(ctx.find.text, { forward: false, findNext: true });
}

function onFound(result) {
  if (!ctx.find.open) return;
  // Игнорируем результаты прошлых запросов: каждая findInPage — новый requestId.
  if (result.requestId !== ctx.find.requestId) return;
  ctx.find.matches = result.matches ?? 0;
  ctx.find.active = result.activeMatchOrdinal ?? 0;
  pushState();
}

/** Навигация сбрасывает подсветку: результаты уже не соответствуют странице. */
function resetOnNavigate() {
  if (!ctx.find.open) return;
  close({ focusView: false });
}

/** Сообщения из renderer: { action: 'query' | 'next' | 'prev' | 'close', text }. */
function handle(payload) {
  const { action, text } = payload || {};
  switch (action) {
    case 'query':
      search(text);
      break;
    case 'next':
      next();
      break;
    case 'prev':
      prev();
      break;
    case 'close':
      close();
      break;
    default:
      break;
  }
}

module.exports = { open, close, search, next, prev, onFound, resetOnNavigate, handle };
