'use strict';

const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('node:path');
const { ctx } = require('../app-context');
const { DOCS_URL, PUBLISHING_URL, DEFAULT_REGISTRY_URL } = require('./constants');
const state = require('./state');
const { t } = require('../i18n');

/**
 * Окно менеджера плагинов.
 *
 * Живёт отдельно от основного окна, но закрывается вместе с ним. Состояние
 * целиком приходит из main — renderer только рисует и отправляет действия,
 * поэтому подделать установку или разрешения из интерфейса нельзя.
 */

let win = null;
let initialized = false;
let getState = null;
let dispatch = null;
let onChange = null;

function info() {
  return {
    platform: process.platform,
    electron: process.versions.electron,
    version: app.getVersion(),
    docsUrl: DOCS_URL,
    rulesUrl: PUBLISHING_URL,
    pluginDir: state.pluginsDir(),
    defaultRegistryUrl: DEFAULT_REGISTRY_URL,
  };
}

function sendState() {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send('octo:plugins-state', getState ? getState() : null);
  } catch {
    /* окно закрывается */
  }
}

function notifyChange() {
  if (onChange) onChange();
}

function installIpc() {
  if (initialized) return;
  initialized = true;

  ipcMain.handle('octo:plugins', async (event, action, payload) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) {
      return { ok: false, error: 'Нет доступа к менеджеру плагинов' };
    }

    if (action === 'ready') {
      return { ok: true, state: getState ? getState() : null, info: info() };
    }

    if (action === 'window') {
      const kind = String(payload || '');
      if (kind === 'minimize') win.minimize();
      else if (kind === 'maximize') {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      } else if (kind === 'close') {
        setTimeout(() => win.close(), 0);
      }
      return { ok: true };
    }

    if (action === 'close') {
      setTimeout(() => win.close(), 0);
      return { ok: true };
    }

    if (!dispatch) return { ok: false, error: 'Диспетчер ещё не готов' };
    try {
      const result = await dispatch(action, payload || {});
      return { ok: true, ...(result || {}) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

function open() {
  installIpc();

  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    sendState();
    return win;
  }

  win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    show: false,
    parent: ctx.win && !ctx.win.isDestroyed() && ctx.win.isVisible() ? ctx.win : undefined,
    backgroundColor: '#141218',
    title: t('Плагины — TikTok octo'),
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 } }
      : { titleBarStyle: 'hidden' }),
    webPreferences: {
      preload: path.join(__dirname, '../plugins-manager-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    if (mod && input.key.toLowerCase() === 'w') {
      event.preventDefault();
      win.close();
    }
  });

  win.once('ready-to-show', () => {
    if (!win || win.isDestroyed()) return;
    win.show();
    win.focus();
  });

  win.webContents.once('did-finish-load', sendState);
  win.on('closed', () => {
    win = null;
    notifyChange();
  });

  win.loadFile(path.join(__dirname, '../../renderer/plugins.html'));
  notifyChange();
  return win;
}

function close() {
  if (win && !win.isDestroyed()) win.close();
}

function isOpen() {
  return Boolean(win && !win.isDestroyed());
}

function init(options) {
  getState = options?.getState || getState;
  dispatch = options?.dispatch || dispatch;
  onChange = options?.onChange || onChange;
  installIpc();
}

module.exports = {
  init,
  open,
  close,
  isOpen,
  send: sendState,
  info,
};
