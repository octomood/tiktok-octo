'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { ctx } = require('./app-context');
const downloads = require('./downloads');
const i18n = require('./i18n');

/**
 * Отдельное окно «Менеджер загрузок».
 *
 * Своя страница, свой preload и минимум прав: список, пауза/продолжить,
 * отмена, «показать в папке». Состояние приходит из main, поэтому окно не
 * зависит от сайта и работает, даже когда основное окно свёрнуто.
 */

let win = null;

function list() {
  return ctx.downloads.map((entry) => ({ ...entry }));
}

function push() {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('octo:downloads', list());
  } catch {
    /* окно закрывается */
  }
}

function open() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    push();
    return win;
  }

  win = new BrowserWindow({
    width: 640,
    height: 540,
    minWidth: 460,
    minHeight: 340,
    title: i18n.t('Менеджер загрузок'),
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'downloads-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/downloads.html'));
  win.once('ready-to-show', () => {
    push();
    win.show();
  });
  win.on('closed', () => {
    win = null;
  });

  return win;
}

function close() {
  if (win && !win.isDestroyed()) win.close();
}

function fromManager(event) {
  return Boolean(win && !win.isDestroyed() && event.sender === win.webContents);
}

ipcMain.on('octo:downloads-pause', (event, id) => {
  if (!fromManager(event) || typeof id !== 'string') return;
  downloads.pause(id);
  push();
});

ipcMain.on('octo:downloads-resume', (event, id) => {
  if (!fromManager(event) || typeof id !== 'string') return;
  downloads.resume(id);
  push();
});

ipcMain.on('octo:downloads-cancel', (event, id) => {
  if (!fromManager(event) || typeof id !== 'string') return;
  downloads.cancel(id);
  push();
});

ipcMain.on('octo:downloads-show', (event, id) => {
  if (!fromManager(event) || typeof id !== 'string') return;
  downloads.showInFolder(id);
});

ipcMain.on('octo:downloads-clear', (event) => {
  if (!fromManager(event)) return;
  downloads.clearFinished();
  push();
});

ipcMain.on('octo:downloads-folder', (event) => {
  if (!fromManager(event)) return;
  shell.openPath(app.getPath('downloads'));
});

ipcMain.on('octo:downloads-close', (event) => {
  if (!fromManager(event)) return;
  close();
});

module.exports = { open, close, push };
