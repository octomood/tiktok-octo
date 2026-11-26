'use strict';

const { ipcMain, app } = require('electron');
const { ctx, setPluginsOpen } = require('../app-context');
const { DOCS_URL, PUBLISHING_URL, DEFAULT_REGISTRY_URL } = require('./constants');
const state = require('./state');

/**
 * Контроллер оверлея менеджера плагинов.
 *
 * Менеджер живёт в главном окне как модальный MD3-оверлей (как панель функций).
 * Состояние целиком приходит из main — renderer только рисует и отправляет
 * действия, поэтому подделать установку или разрешения из интерфейса нельзя.
 */

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
  if (!ctx.win || ctx.win.isDestroyed()) return;
  const wc = ctx.win.webContents;
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
    const wc = ctx.win && !ctx.win.isDestroyed() ? ctx.win.webContents : null;
    if (!wc || event.sender !== wc) {
      return { ok: false, error: 'Нет доступа к менеджеру плагинов' };
    }

    if (action === 'ready') {
      return { ok: true, state: getState ? getState() : null, info: info() };
    }

    if (action === 'window') {
      return { ok: true };
    }

    if (action === 'close') {
      close();
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
  setPluginsOpen(true);
  sendState();
  notifyChange();
  return ctx.win;
}

function close() {
  setPluginsOpen(false);
  notifyChange();
}

function isOpen() {
  return Boolean(ctx.pluginsOpen);
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
