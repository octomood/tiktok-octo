'use strict';

const { BrowserWindow } = require('electron');
const path = require('node:path');
const { TITLEBAR_H } = require('./shared');
const { ctx, layout, pushState, setCloseToTray } = require('./app-context');
const { readState, writeState } = require('./store');
const { createView } = require('./view');
const { handleShortcut } = require('./shortcuts');
const { refreshTrayMenu } = require('./tray');
const player = require('./player');
const media = require('./media');
const pip = require('./pip');
const plugins = require('./plugins');

function saveGeometry(win) {
  // В PiP окно маленькое — сохраняем геометрию, которая была до режима.
  const saved = pip.savedGeometry();
  writeState(saved || { bounds: win.getNormalBounds(), maximized: win.isMaximized() });
}

function createWindow() {
  const saved = readState();
  const bounds = saved.bounds || {};

  const win = new BrowserWindow({
    width: bounds.width ?? 1280,
    height: bounds.height ?? 840,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0b0f',
    title: 'TikTok octo',
    icon: path.join(__dirname, '../../build/icon.png'),
    autoHideMenuBar: true,
    // На Linux/Windows прячем системный заголовок, но оставляем рамку —
    // так работают ресайз краями и тени оконного менеджера.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 15 } }
      : { titleBarStyle: 'hidden' }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  ctx.win = win;
  ctx.chromeHeight = TITLEBAR_H;
  ctx.panelOpen = saved.panelOpen === true;
  ctx.paletteOpen = false;
  ctx.startInTray = saved.startInTray === true;
  setCloseToTray(saved.closeToTray === true);

  const startHidden = ctx.startInTray || process.argv.includes('--hidden');

  // Свернули во время воспроизведения — после возврата продолжим сами:
  // Chromium иногда ставит видео на паузу в фоне, а сайт этого не замечает.
  let resumeOnReturn = false;
  const rememberPlayback = () => {
    // При включённой «паузе в фоне» решение остаётся за пользователем.
    resumeOnReturn = ctx.playing && !ctx.player.pauseOnBlur;
  };
  const resumePlayback = () => {
    if (!resumeOnReturn) return;
    resumeOnReturn = false;
    media.resume();
  };

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    if (saved.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
    if (saved.maximized) win.maximize();

    // Запуск в трее: окно не показываем, если есть куда свернуться.
    // Без трея (Linux без StatusNotifier) лучше показать окно, иначе
    // приложение станет невидимым.
    if (startHidden && ctx.tray) return;
    win.show();
  });

  win.on('resize', layout);
  win.on('maximize', () => {
    layout();
    pushState();
  });
  win.on('unmaximize', () => {
    layout();
    pushState();
  });
  win.on('enter-full-screen', () => {
    layout();
    pushState();
  });
  win.on('leave-full-screen', () => {
    layout();
    pushState();
  });
  win.on('show', () => {
    layout();
    win.webContents.invalidate();
    resumePlayback();
    refreshTrayMenu();
  });
  win.on('hide', () => {
    rememberPlayback();
    player.pauseForBackground();
    refreshTrayMenu();
  });
  win.on('minimize', () => {
    rememberPlayback();
    player.pauseForBackground();
    refreshTrayMenu();
  });
  win.on('blur', () => player.pauseForBackground());
  win.on('restore', () => {
    resumePlayback();
    refreshTrayMenu();
  });

  win.on('close', (event) => {
    const state = readState();
    if (state.closeToTray === true && !ctx.quitting) {
      event.preventDefault();
      win.hide();
      refreshTrayMenu();
      return;
    }
    saveGeometry(win);
  });

  win.on('closed', () => {
    pip.reset();
    ctx.win = null;
    ctx.view = null;
    plugins.suspend();
    refreshTrayMenu();
  });

  win.webContents.on('before-input-event', handleShortcut);
  win.webContents.once('did-finish-load', () => {
    pushState();
    refreshTrayMenu();
  });

  createView();
  plugins.resume();
  return win;
}

module.exports = { createWindow };
