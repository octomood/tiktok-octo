'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { isTikTokUrl } = require('./shared');
const { build } = require('./qr-code');

/**
 * QR-код текущей страницы.
 *
 * Считаем локально: ссылка никуда не уходит, внешние сервисы не нужны.
 * Renderer рисует матрицу на canvas из состояния (img-src в CSP не расширяем).
 */

const MAX_URL = 900;

function show() {
  const wc = ctx.view?.webContents;
  const url = wc && !wc.isDestroyed() ? wc.getURL() : '';
  if (!isTikTokUrl(url)) {
    toast('QR-код доступен на странице TikTok');
    return null;
  }
  if (url.length > MAX_URL) {
    toast('Ссылка слишком длинная для QR-кода');
    return null;
  }

  try {
    ctx.qr = { url, ...build(url) };
    pushState();
    toast('QR-код готов');
    return ctx.qr;
  } catch {
    toast('Не удалось построить QR-код');
    return null;
  }
}

/** Страница сменилась — старый QR показывает чужую ссылку. */
function clear() {
  if (!ctx.qr) return false;
  ctx.qr = null;
  return true;
}

module.exports = { show, clear };
