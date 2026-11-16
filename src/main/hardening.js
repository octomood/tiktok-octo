'use strict';

const { app } = require('electron');
const { ctx } = require('./app-context');
const { isTikTokUrl, isAuthHost } = require('./shared');
const { openExternal } = require('./links');
const docsWindow = require('./plugins/docs-window');

/**
 * Общие ограничения для всех webContents.
 *
 * Главное здесь — popup'ы OAuth: они создаются самим Electron по
 * action: 'allow' в view.js, и без этого обработчика могли бы уйти на любой
 * сайт или открыть новое окно. Проверка «свой ли это webContents» делается
 * в момент события: на момент web-contents-created ctx.view ещё не заполнен.
 */

function isOwnContents(wc) {
  return (
    wc === ctx.win?.webContents || wc === ctx.view?.webContents || docsWindow.isDocsContents(wc)
  );
}

/** Навигация, разрешённая внутри popup'а: сам TikTok и экраны входа. */
function isPopupUrl(url) {
  return isTikTokUrl(url) || isAuthHost(url);
}

function installWebContentsGuards() {
  app.on('web-contents-created', (_event, wc) => {
    // Встраиваемые <webview> не нужны: сайт живёт в WebContentsView.
    wc.on('will-attach-webview', (event) => event.preventDefault());

    // Новые окна из popup'ов не открываем — только в системном браузере.
    wc.setWindowOpenHandler(({ url }) => {
      if (!isOwnContents(wc) && !isPopupUrl(url)) openExternal(url);
      return { action: 'deny' };
    });

    wc.on('will-navigate', (event, url) => {
      if (isOwnContents(wc) || wc.isDestroyed()) return;
      if (isPopupUrl(url)) return;
      event.preventDefault();
      openExternal(url);
    });

    wc.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
      if (isOwnContents(wc) || !isMainFrame || wc.isDestroyed()) return;
      if (isPopupUrl(url)) return;
      event.preventDefault();
      openExternal(url);
    });
  });
}

module.exports = { installWebContentsGuards };
