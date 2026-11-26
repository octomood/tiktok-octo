'use strict';

const { app, ipcMain, globalShortcut } = require('electron');

// Тесты подменяют каталог профиля, чтобы не трогать реальную сессию и логин.
if (process.env.OCTO_USER_DATA) app.setPath('userData', process.env.OCTO_USER_DATA);
// Тесты не должны писать в настоящую папку «Загрузки».
if (process.env.OCTO_DOWNLOADS_DIR) app.setPath('downloads', process.env.OCTO_DOWNLOADS_DIR);

/**
 * Аппаратный декодер на Linux — частая причина «звук идёт, картинка стоит»:
 * драйвер отдаёт звук, но перестаёт проводить кадры в композитор. Для клиента
 * ленты софт-декода 540p достаточно, поэтому по умолчанию выключаем
 * аппаратное декодирование на Linux. Вернуть можно OCTO_HW_VIDEO=1 или
 * переключателем в разделе «Плеер» (см. video-quality.js).
 */
if (process.platform === 'linux') {
  let hardwareVideo = process.env.OCTO_HW_VIDEO === '1';
  if (!hardwareVideo) {
    try {
      hardwareVideo = require('./store').readState().hardwareVideo === true;
    } catch {
      hardwareVideo = false;
    }
  }
  if (hardwareVideo) {
    // Без этих флагов Chromium на Linux часто не видит VA-API, а HEVC живёт
    // только в системном декодере. Флаги экспериментальные: включаются вместе
    // с настройкой и только после явного согласия пользователя.
    app.commandLine.appendSwitch(
      'enable-features',
      [
        'AcceleratedVideoDecodeLinuxGL',
        'VaapiVideoDecodeLinuxGL',
        'VaapiOnNvidiaGPUs',
        'VaapiIgnoreDriverChecks',
      ].join(','),
    );
  } else {
    app.commandLine.appendSwitch('disable-accelerated-video-decode');
  }
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
const welcome = require('./welcome');
const cosmetics = require('./cosmetics');
const badges = require('./badges');
const find = require('./find');
const plugins = require('./plugins');
const stickers = require('./stickers');
const i18n = require('./i18n');
const session = require('./session');
const settingsTransfer = require('./settings-transfer');
const privacy = require('./privacy');
const resilience = require('./resilience');
const deepLinks = require('./deep-links');
const { externalHttpUrlFromArgv } = require('./deep-link-url');
const linkHandler = require('./link-handler');
const jumpList = require('./jump-list');
const videoQuality = require('./video-quality');

// Кастомные схемы (хосты плагинов и превью стикеров) должны быть объявлены
// до app.whenReady().
plugins.registerScheme();
stickers.registerScheme();

const cliInstall = process.argv.includes('--install-appimage');
const cliUninstall = process.argv.includes('--uninstall-appimage');
const cliMode = cliInstall || cliUninstall;

if (!cliMode && !process.env.OCTO_E2E && linkHandler.dispatchEarlyFromArgv(process.argv)) {
  app.exit(0);
}

deepLinks.init();

function applyStartupActions() {
  const run = (flag, command) => {
    if (!process.argv.includes(flag)) return;
    setTimeout(() => {
      try {
        handleCommand(command);
      } catch {
        /* окно ещё не готово */
      }
    }, 1200);
  };
  run('--pip', 'pip');
  run('--messages', 'chat');
  run('--mute', 'mute');
}

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
  app.on('second-instance', (_event, argv) => {
    if (!deepLinks.queueFrom(argv)) {
      const extUrl = externalHttpUrlFromArgv(argv);
      if (extUrl && linkHandler.isAvailable()) {
        linkHandler.openInFallbackBrowser(extUrl);
        return;
      }
    }
    if (ctx.win && !ctx.win.isDestroyed()) showWindow();
    else createWindow();
  });

  app.whenReady().then(async () => {
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

    resilience.init();
    cosmetics.initThemeListener();
    app.setAppUserModelId('app.octo.tiktok');
    ctx.appimageInstalled = appimage.isInstalled();
    ads.sync();
    i18n.sync();
    i18n.installIpc();
    region.sync();
    videoQuality.sync();
    region.installIpc();
    region.installLoginHandler();
    welcome.sync();
    // Локальный обход DPI поднимаем до первой загрузки страницы, иначе
    // TikTok успеет открыться напрямую и получить блокировку.
    await region.prepareDpi();

    installWebContentsGuards();
    stickers.init();
    badges.init({
      onSynced: () => {
        if (cosmetics.isEnabled('user-badges')) {
          cosmetics.scheduleScripts(0);
          const chatWc = ctx.chatView?.webContents;
          if (chatWc && !chatWc.isDestroyed()) cosmetics.apply(chatWc);
        }
      },
    });
    // Переключатели косметики, региона и языка меняют меню и трей — пересобираем их.
    const rebuildMenus = () => {
      buildAppMenu();
      refreshTrayMenu();
      jumpList.install();
    };
    cosmetics.setOnChange(rebuildMenus);
    region.setOnChange(rebuildMenus);
    i18n.setOnChange(() => {
      rebuildMenus();
      session.applySpellChecker();
    });
    buildAppMenu();
    createWindow();
    deepLinks.queueFrom(process.argv);
    deepLinks.setReady();
    applyStartupActions();
    jumpList.install();
    plugins.init({ onChange: rebuildMenus, safeMode: resilience.isSafeMode() });
    settingsTransfer.init({
      onChange: () => {
        rebuildMenus();
        session.applySpellChecker();
      },
    });
    privacy.init();

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
    try {
      ctx.linkHandler = process.env.OCTO_E2E ? false : linkHandler.isEnabled();
    } catch {
      ctx.linkHandler = false;
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
    badges.stopSync();
    plugins.dispose();
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
