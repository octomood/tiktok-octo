'use strict';

const { BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { ctx } = require('../app-context');
const { openExternal } = require('../links');
const { t } = require('../i18n');
const windowChrome = require('../window-chrome');

/**
 * Встроенная документация.
 *
 * Статический HTML собирается scripts/build-plugin-docs.js и лежит внутри
 * приложения. Окно полностью офлайн: внешние ссылки уходят в системный
 * браузер, внутренние страницы открываются в этом же окне.
 */

const ROOT = path.join(__dirname, '../../renderer/plugins-docs');

let win = null;

function docsUrl(url) {
  if (!/^file:\/\//i.test(url || '')) return false;
  try {
    const target = fileURLToPath(url);
    const relative = path.relative(ROOT, target);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function openPage(page = 'index.html') {
  const file = path.join(ROOT, path.basename(page));
  if (!fs.existsSync(file)) return false;

  if (win && !win.isDestroyed()) {
    win.loadFile(file);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return true;
  }

  win = new BrowserWindow(
    windowChrome.framelessOptions({
      width: 1080,
      height: 800,
      minWidth: 760,
      minHeight: 520,
      show: false,
      parent: (() => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused && !focused.isDestroyed()) return focused;
        if (ctx.win && !ctx.win.isDestroyed() && ctx.win.isVisible()) return ctx.win;
        return undefined;
      })(),
      title: t('Документация — TikTok Octo'),
      webPreferences: {
        preload: path.join(__dirname, 'docs-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    }),
  );
  windowChrome.attach(win);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (docsUrl(url)) return;
    event.preventDefault();
    if (/^https:\/\//i.test(url)) openExternal(url);
  });

  win.once('ready-to-show', () => {
    if (!win || win.isDestroyed()) return;
    win.show();
    win.focus();
  });

  win.on('closed', () => {
    win = null;
  });

  win.loadFile(file);
  return true;
}

function close() {
  if (win && !win.isDestroyed()) win.close();
}

function isOpen() {
  return Boolean(win && !win.isDestroyed());
}

function isDocsContents(wc) {
  return Boolean(win && !win.isDestroyed() && wc === win.webContents);
}

module.exports = { openPage, close, isOpen, isDocsContents };
