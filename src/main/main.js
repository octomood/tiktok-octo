'use strict';

const { app, ipcMain, globalShortcut, nativeTheme } = require('electron');

// Тесты подменяют каталог профиля, чтобы не трогать реальную сессию и логин.
if (process.env.OCTO_USER_DATA) app.setPath('userData', process.env.OCTO_USER_DATA);

/**
 * Аппаратный декодер на Linux — частая причина «звук идёт, картинка стоит»:
 * драйвер отдаёт звук, но перестаёт проводить кадры в композитор. Для клиента
 * ленты софт-декода 1080p достаточно, поэтому по умолчанию выключаем
 * аппаратное декодирование на Linux. Вернуть можно OCTO_HW_VIDEO=1.
 */
if (process.platform === 'linux' && process.env.OCTO_HW_VIDEO !== '1') {
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
}

const { ctx, pushState, setChromeHeight, toast } = require('./app-context');
const { buildAppMenu } = require('./menu');
const { createWindow } = require('./window');
const { createTray, refreshTrayMenu, showWindow, destroyTray } = require('./tray');
const { handleCommand } = require('./commands');
const { installWebContentsGuards } = require('./hardening');
const { initUpdates } = require('./updates');
const { initMpris, isActive: mprisActive } = require('./mpris');
const autostart = require('./autostart');
const appimage = require('./appimage-install');
const ads = require('./ads');
const region = require('./region');
const cosmetics = require('./cosmetics');
const find = require('./find');
const plugins = require('./plugins');
const stickers = require('./stickers');
const i18n = require('./i18n');
const session = require('./session');

// Кастомные схемы (хосты плагинов и превью стикеров) должны быть объявлены
// до app.whenReady().
plugins.registerScheme();
stickers.registerScheme();

const cliInstall = process.argv.includes('--install-appimage');
const cliUninstall = process.argv.includes('--uninstall-appimage');
const cliMode = cliInstall || cliUninstall;

let mediaKeysFailed = false;

function registerMediaKeys() {
  if (process.env.OCTO_E2E) return;
  const bind = (accelerator, command) => {
    try {
      if (globalShortcut.register(accelerator, () => handleCommand(command))) return;
      mediaKeysFailed = true;
      console.warn('[octo] shortcut is taken:', accelerator);
    } catch (err) {
      // На Wayland глобальные клавиши могут требовать портал — не критично.
      mediaKeysFailed = true;
      console.warn('[octo] shortcut failed:', accelerator, err.message);
    }
  };
  bind('MediaPlayPause', 'togglePlayback');
  bind('MediaStop', 'mute');

  // MPRIS уже принимает next/previous по D-Bus. Если взять те же клавиши
  // глобально, на некоторых DE лента прыгала бы через видео.
  if (!mprisActive()) {
    bind('MediaNextTrack', 'feedNext');
    bind('MediaPreviousTrack', 'feedPrev');
  }
}

const gotLock = cliMode ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ctx.win && !ctx.win.isDestroyed()) showWindow();
    else createWindow();
  });

  app.whenReady().then(() => {
    if (cliMode) {
      const result = cliInstall ? appimage.install() : appimage.uninstall();
      if (result.ok) {
        console.log(
          `[octo] ${cliInstall ? 'installed' : 'uninstalled'}`,
          result.appImage || result.desktop || '',
        );
      } else {
        console.error('[octo] AppImage integration failed:', result.error);
      }
      app.quit();
      return;
    }

    nativeTheme.themeSource = 'dark';
    app.setAppUserModelId('app.octo.tiktok');
    ctx.appimageInstalled = appimage.isInstalled();
    ads.sync();
    i18n.sync();
    i18n.installIpc();
    region.sync();
    region.installIpc();
    region.installLoginHandler();

    installWebContentsGuards();
    stickers.init();
    // Переключатели косметики, региона и языка меняют меню и трей — пересобираем их.
    const rebuildMenus = () => {
      buildAppMenu();
      refreshTrayMenu();
    };
    cosmetics.setOnChange(rebuildMenus);
    region.setOnChange(rebuildMenus);
    i18n.setOnChange(() => {
      rebuildMenus();
      session.applySpellChecker();
    });
    buildAppMenu();
    createWindow();
    plugins.init({ onChange: rebuildMenus });

    ctx.trayActions = {
      mute: () => handleCommand('mute'),
      onTop: () => handleCommand('onTop'),
      pip: () => handleCommand('pip'),
      next: () => handleCommand('feedNext'),
      prev: () => handleCommand('feedPrev'),
      pipAuto: () => handleCommand('pipAuto'),
      pipAdaptive: () => handleCommand('pipAdaptive'),
      panel: () => handleCommand('panel'),
      home: () => handleCommand('home'),
      show: () => {
        if (!ctx.win || ctx.win.isDestroyed()) createWindow();
        else showWindow();
      },
      quit: () => {
        ctx.quitting = true;
        app.quit();
      },
    };
    createTray();
    refreshTrayMenu();

    try {
      ctx.autostart = autostart.isEnabled();
    } catch {
      ctx.autostart = false;
    }

    initMpris();
    initUpdates();
    registerMediaKeys();

    ipcMain.on('octo:cmd', (_event, command, payload) => handleCommand(command, payload));
    ipcMain.on('octo:ready', () => {
      pushState();
      // Сообщаем один раз, что медиа-клавиши не достались (Wayland, заняты).
      if (mediaKeysFailed) {
        mediaKeysFailed = false;
        toast('Медиа-клавиши недоступны в этой среде');
      }
    });
    ipcMain.on('octo:chrome-height', (_event, height) => setChromeHeight(height));
    ipcMain.on('octo:find', (_event, payload) => find.handle(payload));

    app.on('activate', () => {
      if (!ctx.win || ctx.win.isDestroyed()) createWindow();
      else showWindow();
    });
  });

  app.on('before-quit', () => {
    ctx.quitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    plugins.dispose();
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
