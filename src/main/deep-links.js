'use strict';

const { app } = require('electron');
const { ctx, toast } = require('./app-context');
const { isTikTokUrl } = require('./shared');
const { PROTOCOL, decodeArgument, targetFromArgv } = require('./deep-link-url');
const logger = require('./logger');

/**
 * Ссылки из системы.
 *
 * Приложение регистрирует схему tiktok-octo:// — браузер и другие программы
 * могут открыть в нём конкретное видео. Прямую схему https:// занять нельзя,
 * поэтому поддерживаются оба вида:
 *   tiktok-octo://open?url=https%3A%2F%2Fwww.tiktok.com%2F...
 *   tiktok-octo://www.tiktok.com/@author/video/123
 * Обычный argv с tiktok.com тоже принимается: так работают ярлыки и
 * xdg-open, если система передала URL аргументом.
 */

let pending = '';
let ready = false;

function flush() {
  if (!ready || !pending) return;
  const url = pending;
  pending = '';
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    pending = url;
    return;
  }
  logger.info('deeplink', 'opening URL', { url: logger.sanitizeUrl(url) });
  wc.loadURL(url).catch((err) => {
    logger.warn('deeplink', 'loadURL failed', err?.message);
  });
}

function open(url) {
  if (!isTikTokUrl(url)) {
    logger.warn('deeplink', 'rejected non-TikTok URL', { url: logger.sanitizeUrl(url) });
    return false;
  }
  pending = url;
  flush();
  if (pending && ready) toast('Не удалось открыть ссылку');
  return true;
}

function queueFrom(argv) {
  const url = targetFromArgv(argv);
  if (!url) return false;
  pending = url;
  flush();
  return true;
}

function init() {
  if (process.env.OCTO_E2E) return;
  try {
    app.setAsDefaultProtocolClient(PROTOCOL);
  } catch {
    /* система может не поддерживать регистрацию схемы */
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    const target = decodeArgument(url);
    if (isTikTokUrl(target)) open(target);
  });
}

function setReady() {
  ready = true;
  flush();
}

module.exports = {
  PROTOCOL,
  init,
  setReady,
  open,
  queueFrom,
  decodeArgument,
  targetFromArgv,
};
