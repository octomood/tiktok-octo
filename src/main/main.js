'use strict';

const { app, ipcMain, globalShortcut, nativeTheme } = require('electron');

// Тесты подменяют каталог профиля, чтобы не трогать реальную сессию и логин.
if (process.env.OCTO_USER_DATA) app.setPath('userData', process.env.OCTO_USER_DATA);

const { ctx, pushState, setChromeHeight } = require('./app-context');
const { buildAppMenu } = require('./menu');
const { createWindow } = require('./window');
const { createTray, refreshTrayMenu, showWindow, destroyTray } = require('./tray');
const { handleCommand } = require('./commands');
const { installWebContentsGuards } = require('./hardening');
const { initUpdates } = require('./updates');
const find = require('./find');

function registerMediaKeys() {
  if (process.env.OCTO_E2E) return;
  const bind = (accelerator, command) => {
    try {
      globalShortcut.register(accelerator, () => handleCommand(command));
    } catch (err) {
      // На Wayland глобальные клавиши могут требовать портал — не критично.
      console.warn('[octo] shortcut failed:', accelerator, err.message);
    }
  };
  bind('MediaPlayPause', 'togglePlayback');
  bind('MediaStop', 'mute');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    app.setAppUserModelId('app.octo.tiktok');

    installWebContentsGuards();
    buildAppMenu();
    createWindow();

    ctx.trayActions = {
      mute: () => handleCommand('mute'),
      onTop: () => handleCommand('onTop'),
      pip: () => handleCommand('pip'),
      home: () => handleCommand('home'),
      show: () => {
        if (!ctx.win) createWindow();
        else showWindow();
      },
      quit: () => {
        ctx.quitting = true;
        app.quit();
      },
    };
    createTray();
    refreshTrayMenu();

    initUpdates();
    registerMediaKeys();

    ipcMain.on('octo:cmd', (_event, command) => handleCommand(command));
    ipcMain.on('octo:ready', () => pushState());
    ipcMain.on('octo:chrome-height', (_event, height) => setChromeHeight(height));
    ipcMain.on('octo:find', (_event, payload) => find.handle(payload));

    app.on('activate', () => {
      if (!ctx.win) createWindow();
      else showWindow();
    });
  });

  app.on('before-quit', () => {
    ctx.quitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
