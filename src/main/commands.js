'use strict';

const { app, shell } = require('electron');
const {
  ctx,
  pushState,
  setUiScale,
  toast,
  stepHistory,
  setPanelOpen,
  setPopover,
  setPaletteOpen,
  setCloseToTray,
  sendToWindow,
} = require('./app-context');
const { writeState } = require('./store');
const { HOME_URL, isTikTokUrl } = require('./shared');
const { openExternal } = require('./links');
const { refreshTrayMenu } = require('./tray');
const { showAbout } = require('./about');
const { checkNow } = require('./updates');
const cosmetics = require('./cosmetics');
const downloads = require('./downloads');
const sleepTimer = require('./sleep-timer');
const player = require('./player');
const videoQuality = require('./video-quality');
const pip = require('./pip');
const { captureFrame, captureForAnnotation } = require('./screenshot');
const autostart = require('./autostart');
const appimage = require('./appimage-install');
const ads = require('./ads');
const region = require('./region');
const welcome = require('./welcome');
const find = require('./find');
const plugins = require('./plugins');
const dialogs = require('./dialogs');
const uiFont = require('./ui-font');
const stickers = require('./stickers');
const i18n = require('./i18n');
const autoTheme = require('./auto-theme');
const chat = require('./chat');
const keymap = require('./keymap');
const feedKeys = require('./feed-keys');
const attention = require('./attention');
const captions = require('./captions');
const qr = require('./qr');
const barOnly = require('./bar-only');
const notifications = require('./notifications');
const replies = require('./replies');
const library = require('./library');
const stats = require('./stats');
const focus = require('./focus');
const ambient = require('./ambient');
const archive = require('./archive');
const settingsTransfer = require('./settings-transfer');
const privacy = require('./privacy');
const resilience = require('./resilience');
const filters = require('./filters');
const gif = require('./gif');
const customCode = require('./custom-code');
const downloadsWindow = require('./downloads-window');
const profiles = require('./profiles');
const history = require('./history');
const creatorNotes = require('./creator-notes');
const { showMessageBox } = require('./dialogs');
// Ступени масштаба как в браузерах.
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function viewContents() {
  return ctx.view?.webContents ?? null;
}

function zoomBy(direction) {
  const wc = viewContents();
  if (!wc) return;
  const current = wc.getZoomFactor();

  // Chromium-подобные ступени: 100 → 110 → 125 → 150 …
  let nearest = 0;
  let best = Infinity;
  ZOOM_STEPS.forEach((step, index) => {
    const distance = Math.abs(step - current);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  });

  const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, nearest + direction));
  applyZoom(ZOOM_STEPS[next]);
}

function applyZoom(factor) {
  const wc = viewContents();
  if (!wc) return;
  const clamped = Math.min(3, Math.max(0.5, factor));
  wc.setZoomFactor(clamped);
  writeState({ zoomFactor: clamped });
  pushState();
  toast(`Масштаб: ${Math.round(clamped * 100)}%`);
}

async function togglePlayback() {
  const wc = viewContents();
  if (!wc) return;
  try {
    await wc.executeJavaScript(
      `(() => {
         const videos = [...document.querySelectorAll('video')];
         const playing = videos.find((video) => !video.paused);
         if (playing) {
           videos.forEach((video) => video.pause());
           return 'paused';
         }
         const visible = videos.find((video) => {
           const rect = video.getBoundingClientRect();
           return rect.width > 120 && rect.height > 120;
         });
         const video = visible || videos[0];
         if (!video) return 'none';
         video.play();
         return 'playing';
       })()`,
      true,
    );
    pushState();
  } catch {
    /* нет видео на странице */
  }
}

function openSettingsCategory(category) {
  if (ctx.barOnly) barOnly.exit({ silent: true });
  if (ctx.htmlFullscreen || ctx.pipActive) return;
  setPanelOpen(true);
  player.watchPanel(true);
  player.refreshDevices();
  sendToWindow('octo:panel-category', category);
}

function handleCommand(command, payload) {
  if (!ctx.win || !ctx.view) return;
  const wc = ctx.view.webContents;

  switch (command) {
    case 'back':
      stepHistory(-1);
      break;
    case 'forward':
      stepHistory(1);
      break;
    case 'reload':
      if (wc.isLoading()) wc.stop();
      else wc.reload();
      break;
    case 'hardReload':
      wc.reloadIgnoringCache();
      break;
    case 'home':
      find.close({ focusView: false });
      wc.loadURL(HOME_URL);
      break;
    case 'minimize':
      ctx.win.minimize();
      break;
    case 'maximize':
      ctx.win.isMaximized() ? ctx.win.unmaximize() : ctx.win.maximize();
      break;
    case 'close':
      ctx.win.close();
      break;
    case 'quit':
      ctx.quitting = true;
      app.quit();
      break;
    case 'pip':
      if (ctx.barOnly) barOnly.toPip();
      if (!ctx.pipActive) setPopover(null);
      pip.toggle();
      refreshTrayMenu();
      break;
    case 'pipClose':
      pip.exit();
      refreshTrayMenu();
      break;
    case 'feedNext':
      pip.next();
      break;
    case 'feedPrev':
      pip.prev();
      break;
    case 'pipAuto':
      pip.toggleAuto();
      refreshTrayMenu();
      break;
    case 'pipAdaptive':
      pip.toggleAdaptive();
      refreshTrayMenu();
      break;
    case 'pipSeek':
      pip.seek(payload);
      break;
    case 'pipRewind':
      pip.nudge(-10);
      break;
    case 'togglePlayback':
      togglePlayback();
      break;
    case 'mute': {
      const next = !wc.isAudioMuted();
      wc.setAudioMuted(next);
      // Пользователь сам распорядился звуком под мастером — на закрытии не
      // возвращаем прежнее состояние.
      if (ctx.welcome.open) ctx.welcome.muteTouched = true;
      toast(next ? 'Звук выключен' : 'Звук включён');
      refreshTrayMenu();
      break;
    }
    case 'onTop': {
      const next = !ctx.win.isAlwaysOnTop();
      ctx.win.setAlwaysOnTop(next, 'floating');
      writeState({ alwaysOnTop: next });
      pip.setRestoreOnTop(next);
      toast(next ? 'Поверх всех окон' : 'Обычное окно');
      refreshTrayMenu();
      break;
    }
    case 'uiScale': {
      const scale = setUiScale(payload);
      writeState({ uiScale: scale });
      toast(`Масштаб интерфейса: ${Math.round(scale * 100)} %`);
      break;
    }
    case 'uiFont': {
      const next = uiFont.normalizeUiFont(payload);
      ctx.uiFont = next;
      writeState({ uiFont: next });
      pushState();
      if (next.preset === 'custom-name' && next.family) {
        toast(`Шрифт интерфейса: ${next.family}`);
      } else if (next.preset === 'inter') {
        toast('Шрифт интерфейса: Inter');
      } else if (next.preset === 'system') {
        toast('Шрифт интерфейса: системный');
      } else if (next.preset === 'google-sans-medium') {
        toast('Шрифт интерфейса: Google Sans Medium');
      }
      break;
    }
    case 'uiFontPick': {
      const applyFile = (filePath) => {
        const installed = uiFont.installFontFile(filePath);
        if (!installed.ok) {
          toast(installed.error);
          return;
        }
        ctx.uiFont = installed.uiFont;
        writeState({ uiFont: installed.uiFont });
        pushState();
        toast(`Шрифт интерфейса: ${installed.uiFont.fileName}`);
      };

      if (typeof payload === 'string' && payload.trim()) {
        applyFile(payload);
        break;
      }

      dialogs
        .showOpenDialog(ctx.win, {
          title: 'Выберите файл шрифта',
          properties: ['openFile'],
          filters: [{ name: 'Шрифты', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
        })
        .then((res) => {
          if (!res.canceled && res.filePaths && res.filePaths[0]) {
            applyFile(res.filePaths[0]);
          }
        });
      break;
    }
    case 'zoomIn':
      zoomBy(1);
      break;
    case 'zoomOut':
      zoomBy(-1);
      break;
    case 'zoomReset':
      applyZoom(1);
      break;
    case 'devtools':
      // DevTools и webContents.debugger не могут работать одновременно.
      // Снимаем auto dark mode; после закрытия окна view.js включит его снова.
      autoTheme.suspend(wc).finally(() => wc.toggleDevTools());
      break;
    case 'fullscreen':
      if (!ctx.pipActive) ctx.win.setFullScreen(!ctx.win.isFullScreen());
      break;
    case 'find':
      if (!ctx.pipActive && !ctx.barOnly) find.open();
      break;
    case 'findNext':
      find.next();
      break;
    case 'findPrev':
      find.prev();
      break;
    case 'findClose':
      find.close();
      break;
    case 'panel':
    case 'settings': {
      if (!ctx.htmlFullscreen && !ctx.pipActive && !ctx.barOnly) {
        const opening = !ctx.panelOpen;
        setPanelOpen(opening);
        // Список аудиовыходов и дата ролика нужны только открытым настройкам.
        player.watchPanel(opening);
        if (opening) player.refreshDevices();
      }
      refreshTrayMenu();
      break;
    }
    case 'settingsClose':
      if (ctx.panelOpen) {
        setPanelOpen(false);
        player.watchPanel(false);
      }
      refreshTrayMenu();
      break;
    case 'chat':
      if (!ctx.htmlFullscreen && !ctx.pipActive && !ctx.barOnly) chat.toggle();
      refreshTrayMenu();
      break;
    case 'chatResize':
      chat.setWidth(payload);
      break;
    case 'chatDock':
      chat.toggleDock();
      break;
    case 'chatFiles':
      if (Array.isArray(payload)) chat.sendFiles(payload);
      break;
    case 'palette':
      if (!ctx.htmlFullscreen && !ctx.pipActive && !ctx.barOnly) setPaletteOpen(!ctx.paletteOpen);
      break;
    case 'screenshot':
      captureFrame();
      break;
    case 'screenshotAnnotate':
      captureForAnnotation();
      break;
    case 'playerSpeed':
      player.setSpeed(payload);
      break;
    case 'framePrev':
      player.stepFrame(-1);
      break;
    case 'frameNext':
      player.stepFrame(1);
      break;
    case 'abLoopA':
      player.setAbPoint('a');
      break;
    case 'abLoopB':
      player.setAbPoint('b');
      break;
    case 'abLoopClear':
      player.clearAbLoop();
      break;
    case 'playerVolume':
      player.setVolume(payload);
      break;
    case 'playerToggle':
      if (typeof payload === 'string') player.toggle(payload);
      break;
    case 'playerEqualizer':
      if (typeof payload === 'string') player.setEqualizer(payload);
      break;
    case 'picture':
      player.setPicture(payload);
      break;
    case 'pictureFit':
      player.setFit(payload);
      break;
    case 'pictureEnhance':
      player.enhancePicture();
      break;
    case 'hardwareVideo':
      videoQuality.toggle();
      break;
    case 'pictureReset':
      player.resetPicture();
      break;
    case 'captionToggle':
      captions.toggle();
      break;
    case 'captionSize':
      captions.setSize(payload);
      break;
    case 'captionBackground':
      captions.toggleBackground();
      break;
    case 'captionOutline':
      captions.toggleOutline();
      break;
    case 'qrVideo':
      qr.show();
      break;
    case 'barOnly':
      barOnly.toggle();
      break;
    case 'barExit':
      barOnly.exit();
      break;
    case 'barPip':
      barOnly.toPip();
      pip.enter();
      break;
    case 'playerSink':
      player.setSink(payload);
      break;
    case 'audioDevices':
      player.refreshDevices();
      break;
    case 'openUrl':
      if (typeof payload === 'string' && isTikTokUrl(payload)) {
        find.close({ focusView: false });
        wc.loadURL(payload);
      } else if (typeof payload === 'string') {
        openExternal(payload);
      }
      break;
    case 'openInBrowser': {
      const url = wc.getURL();
      if (isTikTokUrl(url)) {
        openExternal(url);
        toast('Открываю в браузере');
      }
      break;
    }
    case 'keymapProfile':
      if (typeof payload === 'string') keymap.setProfile(payload);
      break;
    case 'keymapSet':
      if (payload && typeof payload.id === 'string') {
        keymap.setKeys(payload.id, typeof payload.keys === 'string' ? payload.keys : '');
      }
      break;
    case 'keymapCapturing':
      // Пока в редакторе ждут сочетание, Esc отменяет захват, а не панель.
      ctx.keymapCapturing = payload === true;
      break;
    case 'keymapReset':
      keymap.resetProfile();
      break;
    case 'keysPanel':
      openSettingsCategory('keys');
      break;
    case 'libraryPanel':
      openSettingsCategory('library');
      break;
    case 'statsPanel':
      openSettingsCategory('stats');
      break;
    case 'feedKeys':
      feedKeys.toggle();
      break;
    case 'idlePause':
      attention.setIdlePause(payload);
      break;
    case 'keepAwake':
      attention.toggleKeepAwake();
      break;
    case 'notifyToggle':
      notifications.toggle('enabled');
      break;
    case 'notifyDnd':
      notifications.toggle('dnd');
      break;
    case 'notifyQuiet':
      notifications.toggle('quietFocused');
      break;
    case 'notifyFrom':
      notifications.setTime('dndFrom', payload);
      break;
    case 'notifyTo':
      notifications.setTime('dndTo', payload);
      break;
    case 'repliesSet':
      replies.set(payload);
      break;
    case 'replyInsert':
      replies.insert(payload);
      break;
    case 'libraryAdd':
      library.addCurrent();
      break;
    case 'libraryQueueAdd':
      library.addCurrent({ queue: true });
      break;
    case 'libraryRemove':
      if (typeof payload === 'string') library.remove(payload);
      break;
    case 'libraryNote':
      if (payload && typeof payload.id === 'string') {
        library.setNote(payload.id, typeof payload.note === 'string' ? payload.note : '');
      }
      break;
    case 'libraryQueue':
      if (typeof payload === 'string') library.toggleQueue(payload);
      break;
    case 'libraryQueueClear':
      library.clearQueue();
      break;
    case 'libraryOpen':
      if (typeof payload === 'string') library.openItem(payload);
      break;
    case 'libraryNext':
      library.openNext();
      break;
    case 'libraryExport':
      if (typeof payload === 'string') library.exportLibrary(payload);
      break;
    case 'statsReset':
      stats.reset();
      break;
    case 'libraryAuto':
      library.toggleAuto();
      break;
    case 'focusToggle':
      focus.toggle();
      break;
    case 'focusExit':
      focus.stop();
      break;
    case 'focusMinutes':
      focus.setMinutes(payload);
      break;
    case 'focusBreak':
      focus.setBreak(payload);
      break;
    case 'ambientToggle':
      ambient.toggle();
      break;
    case 'ambientExit':
      ambient.exit();
      break;
    case 'archiveExport':
      archive.exportArchive();
      break;
    case 'settingsExport':
      settingsTransfer.exportSettings();
      break;
    case 'settingsImport':
      settingsTransfer.importSettings(payload || {});
      break;
    case 'backupNow':
      settingsTransfer.createBackup('manual');
      break;
    case 'backupRestore': {
      const restore = () => settingsTransfer.restoreBackup(payload || {});
      if (process.env.OCTO_E2E) {
        restore();
        break;
      }
      showMessageBox(ctx.win, {
        type: 'warning',
        title: 'Восстановление из копии',
        message: 'Заменить текущие настройки резервной копией?',
        detail:
          'Настройки и список плагинов будут заменены выбранной копией, приложение перезапустится.',
        buttons: ['Восстановить', 'Отмена'],
        defaultId: 0,
        cancelId: 1,
      }).then((answer) => {
        if (answer.response === 0) restore();
      });
      break;
    }
    case 'backupFolder':
      settingsTransfer.openBackupFolder();
      break;
    case 'privacyRefresh':
      privacy.refresh();
      break;
    case 'retryLoad': {
      const retryWc = viewContents();
      if (!retryWc) break;
      toast('Повторяю загрузку…');
      retryWc.reload();
      break;
    }
    case 'memoryGuard':
      resilience.setMemoryGuard(ctx.memoryGuard === false);
      break;
    case 'ecoOnBattery':
      resilience.setEcoOnBattery(ctx.ecoOnBattery === false);
      break;
    case 'safeModeExit':
      resilience.exitSafeMode(payload || {});
      break;
    case 'privacyDelete':
      if (payload && typeof payload.id === 'string') privacy.remove(payload.id);
      break;
    case 'diagnosticsCopy':
      privacy.copyDiagnostics();
      break;
    case 'showLicenses':
      privacy.showLicenses();
      break;
    case 'showDisclaimer':
      privacy.showDisclaimer();
      break;
    case 'cosmetic':
      if (typeof payload === 'string') cosmetics.toggle(payload);
      break;
    case 'closeToTray': {
      const next = !ctx.closeToTray;
      setCloseToTray(next);
      writeState({ closeToTray: next });
      toast(next ? 'Окно будет закрываться в трей' : 'Окно закрывается как обычно');
      refreshTrayMenu();
      break;
    }
    case 'downloadManager':
      downloadsWindow.open();
      break;
    case 'openDownloads':
      shell.openPath(app.getPath('downloads')).then((error) => {
        if (error) toast('Не удалось открыть папку загрузок');
      });
      break;
    case 'downloadCancel':
      if (typeof payload === 'string') downloads.cancel(payload);
      break;
    case 'downloadPause':
      if (typeof payload === 'string') downloads.pause(payload);
      break;
    case 'downloadResume':
      if (typeof payload === 'string') downloads.resume(payload);
      break;
    case 'downloadNamingAuto':
      downloads.setAuto(payload === true);
      break;
    case 'downloadTemplate':
      if (typeof payload === 'string') downloads.setTemplate(payload);
      break;
    case 'downloadFolderPerAuthor':
      downloads.toggleFolder();
      break;
    case 'downloadLimit':
      downloads.setLimit(payload);
      break;
    case 'downloadShow':
      if (typeof payload === 'string') downloads.showInFolder(payload);
      break;
    case 'downloadClear':
      downloads.clearFinished();
      break;
    case 'sleepTimer':
      sleepTimer.set(payload);
      break;
    case 'sleepMode':
      sleepTimer.setStopAtEnd(payload === 'end');
      break;
    case 'sleepVideos':
      sleepTimer.setVideos(payload);
      break;
    case 'sleepFade':
      sleepTimer.toggleFade();
      break;
    case 'autostart': {
      const next = !ctx.autostart;
      autostart.setEnabled(next);
      ctx.autostart = autostart.isEnabled();
      toast(
        ctx.autostart === next
          ? next
            ? 'Автозапуск включён'
            : 'Автозапуск выключен'
          : 'Не удалось изменить автозапуск',
      );
      break;
    }
    case 'startInTray': {
      ctx.startInTray = !ctx.startInTray;
      writeState({ startInTray: ctx.startInTray });
      toast(ctx.startInTray ? 'Будет запускаться свёрнутым' : 'Будет открывать окно');
      break;
    }
    case 'adsSkip': {
      const next = ads.toggle();
      toast(next ? 'Пропуск рекламы включён' : 'Пропуск рекламы выключен');
      break;
    }
    case 'adsPip':
      ads.setInPip(!ctx.adsInPip);
      toast(ctx.adsInPip ? 'Реклама пропускается и в PiP' : 'В PiP реклама не пропускается');
      break;
    case 'adsReset':
      ads.resetCounter();
      toast('Счётчик пропущенной рекламы сброшен');
      break;
    case 'filtersToggle':
      filters.toggle();
      break;
    case 'gifExport':
      gif.exportGif();
      break;
    case 'customCodeToggle':
      customCode.toggle();
      break;
    case 'customCodeSet':
      if (payload && typeof payload === 'object') customCode.setCode(payload);
      break;
    case 'gifDuration':
      gif.setDuration(payload);
      break;
    case 'gifFps':
      gif.setFps(payload);
      break;
    case 'gifWidth':
      gif.setWidth(payload);
      break;
    case 'filtersSet':
      if (payload && typeof payload === 'object') filters.setLists(payload);
      break;
    case 'language':
      if (typeof payload === 'string') i18n.setLanguage(payload);
      break;
    case 'siteLanguage':
      if (typeof payload === 'string') region.setSiteLanguage(payload);
      break;
    case 'region':
      if (typeof payload === 'string') region.setPreset(payload);
      break;
    case 'regionProxyApply':
      region.setProxy(typeof payload === 'string' ? payload : '');
      break;
    case 'regionProxyClear':
      region.setProxy('');
      break;
    case 'dpiToggle':
      region.setDpiBypass(!ctx.dpi.enabled);
      break;
    case 'regionCheckIp':
      region.checkIp();
      break;
    case 'regionTestProxy':
      region.testConnection();
      break;
    case 'themeMode':
      if (typeof payload === 'string') cosmetics.applyThemeMode(payload);
      break;
    case 'profileSwitch':
      if (typeof payload === 'string') profiles.switchTo(payload);
      break;
    case 'profileCreate':
      profiles.create(typeof payload === 'string' ? payload : '');
      break;
    case 'profileRename':
      if (payload && typeof payload === 'object') profiles.rename(payload.id, payload.name);
      break;
    case 'profileDelete':
      if (typeof payload === 'string') profiles.remove(payload);
      break;
    case 'historyOpen':
      if (typeof payload === 'string') history.open(payload);
      break;
    case 'historyRemove':
      if (typeof payload === 'string') history.remove(payload);
      break;
    case 'historyClear':
      history.clear();
      break;
    case 'creatorNoteSet':
      if (payload && typeof payload === 'object') creatorNotes.set(payload.author, payload);
      break;
    case 'creatorNoteRemove':
      if (typeof payload === 'string') creatorNotes.remove(payload);
      break;
    case 'creatorNoteOpen':
      if (typeof payload === 'string') creatorNotes.openAuthor(payload);
      break;
    case 'regionResetData':
      region.resetSiteData();
      break;
    case 'regionPanel':
      openSettingsCategory('region');
      break;
    case 'languagePanel':
      openSettingsCategory('language');
      break;
    case 'welcomeFinish':
      welcome.finish(payload);
      break;
    case 'welcomeSkip':
      welcome.skip();
      break;
    case 'welcomeDiscover':
      welcome.discover();
      break;
    case 'welcomeOpen':
      // Открывается из панели и палитры: панель уступает место мастеру.
      setPanelOpen(false);
      welcome.open();
      break;
    case 'stickerPanel':
      if (!ctx.htmlFullscreen && !ctx.pipActive && !ctx.barOnly) setPopover('stickers');
      break;
    case 'stickerAdd':
      if (!ctx.htmlFullscreen && !ctx.pipActive) {
        setPopover('stickers', { toggle: false });
      }
      stickers.addFromDialog();
      break;
    case 'pluginsActive':
      if (!ctx.htmlFullscreen && !ctx.pipActive && !ctx.barOnly) setPopover('plugins');
      break;
    case 'stickerSend':
      if (typeof payload === 'string') stickers.send(payload);
      break;
    case 'stickerRemove':
      if (typeof payload === 'string') stickers.remove(payload);
      break;
    case 'stickerFolder':
      stickers.openFolder();
      break;
    case 'nativeStickers':
      stickers.openNativePanel();
      break;
    case 'appimageInstall': {
      if (!appimage.isAvailable()) {
        toast('Установка доступна только из AppImage');
        break;
      }

      const result = ctx.appimageInstalled ? appimage.uninstall() : appimage.install();
      if (!result.ok) {
        toast(result.error || 'Не удалось изменить меню приложений');
        break;
      }

      ctx.appimageInstalled = appimage.isInstalled();
      toast(ctx.appimageInstalled ? 'Добавлено в меню приложений' : 'Удалено из меню приложений');
      break;
    }
    case 'checkUpdates':
      checkNow();
      break;
    case 'plugins':
      setPopover(null);
      plugins.openManager();
      break;
    case 'pluginInstallFile':
      plugins.installFromFile();
      break;
    case 'pluginToggle':
      if (typeof payload === 'string') plugins.toggle(payload);
      else if (payload && typeof payload.id === 'string') {
        plugins.setEnabled(payload.id, payload.enabled !== false);
      }
      break;
    case 'pluginDocs':
      plugins.openDocs();
      break;
    case 'pluginRules':
      plugins.openRules();
      break;
    case 'pluginFolder':
      plugins.openFolder();
      break;
    case 'about':
      showAbout(ctx.win);
      break;
    default:
      plugins.runCommand(command, payload);
      break;
  }
  pushState();
}

module.exports = { handleCommand };
