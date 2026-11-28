'use strict';

const path = require('node:path');
const { BrowserWindow, ipcMain } = require('electron');
const { ctx } = require('./app-context');
const { keyFromInput } = require('./key-input');

/**
 * Единая безрамочная оболочка для всех BrowserWindow на каждой ОС.
 *
 * Все окна приложения используют frame: false, без системного заголовка,
 * светофора macOS и Alt-менюбара. Кнопки управления окном принимаются только
 * от доверенных renderer-окон из trustedContents.
 */

const trustedContents = new WeakSet();
let ipcInstalled = false;

function windowFromEvent(event) {
  if (!event || !trustedContents.has(event.sender)) return null;
  const win = BrowserWindow.fromWebContents(event.sender);
  return win && !win.isDestroyed() ? win : null;
}

function installIpc() {
  if (ipcInstalled) return;
  ipcInstalled = true;

  ipcMain.on('octo:win-control', (event, action) => {
    const win = windowFromEvent(event);
    if (!win) return;
    if (action === 'minimize') {
      if (win.isMinimizable()) win.minimize();
    } else if (action === 'maximize') {
      if (!win.isMaximizable()) return;
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    } else if (action === 'close') {
      win.close();
    }
  });

  ipcMain.on('octo:win-state', (event) => {
    const win = windowFromEvent(event);
    event.returnValue = {
      maximized: Boolean(win && win.isMaximized()),
    };
  });
}

function sendWinState(win) {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc || wc.isDestroyed() || !trustedContents.has(wc)) return;
  try {
    wc.send('octo:win-state', { maximized: win.isMaximized() });
  } catch {
    /* окно закрывается */
  }
}

function framelessOptions(extra = {}) {
  return {
    icon: path.join(__dirname, '../../build/icon.png'),
    backgroundColor: ctx.themeTokens?.surface || '#191624',
    ...extra,
    frame: false,
    autoHideMenuBar: true,
  };
}

function attach(win, options = {}) {
  if (!win || win.isDestroyed()) return win;
  installIpc();
  trustedContents.add(win.webContents);

  try {
    win.setMenuBarVisibility(false);
  } catch {
    /* окно закрывается */
  }

  const sync = () => sendWinState(win);
  win.on('maximize', sync);
  win.on('unmaximize', sync);
  win.on('enter-full-screen', sync);
  win.on('leave-full-screen', sync);

  const closeOnEscape = options.closeOnEscape === true;
  const closeOnCtrlW = options.closeOnCtrlW !== false;
  if (closeOnEscape || closeOnCtrlW) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (closeOnEscape && input.key === 'Escape' && !input.control && !input.meta && !input.alt) {
        event.preventDefault();
        win.close();
        return;
      }
      const mod = input.control || input.meta;
      if (closeOnCtrlW && mod && !input.alt && keyFromInput(input).toLowerCase() === 'w') {
        event.preventDefault();
        win.close();
      }
    });
  }

  return win;
}

module.exports = {
  installIpc,
  framelessOptions,
  attach,
};
