'use strict';

const path = require('node:path');
const { BrowserWindow, ipcMain } = require('electron');
const i18n = require('./i18n');

/**
 * Отдельное окно обновления.
 *
 * Окно ничего не скачивает само: main присылает состояние (доступно, загрузка,
 * готово, ошибка), а кнопки уходят обратно через preload. Закрытие окна не
 * отменяет загрузку — она продолжается в main, и после неё окно откроется
 * снова с предложением перезапуститься.
 */

let win = null;
let state = { phase: 'available', version: '', percent: 0 };
let handlers = { install() {}, restart() {} };

function push() {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('octo:update-state', { ...state });
  } catch {
    /* окно закрывается */
  }
}

function open() {
  win = new BrowserWindow({
    width: 480,
    height: 312,
    minWidth: 380,
    minHeight: 260,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    title: i18n.t('Обновление приложения'),
    backgroundColor: '#141218',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'update-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/update.html'));
  win.once('ready-to-show', () => {
    push();
    if (!win || win.isDestroyed()) return;
    win.show();
    win.focus();
  });
  win.on('closed', () => {
    win = null;
  });
}

function isOpen() {
  return Boolean(win && !win.isDestroyed());
}

function show(next = {}) {
  state = { ...state, ...next };
  if (!isOpen()) {
    open();
    return;
  }
  push();
  if (win.isVisible()) win.focus();
}

/** Прогресс загрузки не открывает закрытое окно: загрузка идёт в фоне. */
function progress(percent) {
  if (state.phase !== 'downloading') return;
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  state = { ...state, percent: value };
  push();
}

function close() {
  if (isOpen()) win.close();
}

function fromWindow(event) {
  return Boolean(win && !win.isDestroyed() && event.sender === win.webContents);
}

function setHandlers(next) {
  handlers = { ...handlers, ...(next || {}) };
}

ipcMain.on('octo:update-install', (event) => {
  if (!fromWindow(event)) return;
  handlers.install();
});

ipcMain.on('octo:update-restart', (event) => {
  if (!fromWindow(event)) return;
  handlers.restart();
});

ipcMain.on('octo:update-close', (event) => {
  if (!fromWindow(event)) return;
  close();
});

module.exports = { show, progress, close, isOpen, setHandlers };
