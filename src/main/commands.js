'use strict';

const { app, shell } = require('electron');
const {
  ctx,
  pushState,
  toast,
  stepHistory,
  setPanelOpen,
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
const pip = require('./pip');
const { captureFrame } = require('./screenshot');
const autostart = require('./autostart');
const appimage = require('./appimage-install');
const ads = require('./ads');
const region = require('./region');
const find = require('./find');
const plugins = require('./plugins');
const stickers = require('./stickers');
const i18n = require('./i18n');
const autoTheme = require('./auto-theme');

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
    case 'togglePlayback':
      togglePlayback();
      break;
    case 'mute': {
      const next = !wc.isAudioMuted();
      wc.setAudioMuted(next);
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
      if (!ctx.pipActive) find.open();
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
      if (!ctx.htmlFullscreen && !ctx.pipActive) setPanelOpen(!ctx.panelOpen);
      refreshTrayMenu();
      break;
    case 'palette':
      if (!ctx.htmlFullscreen && !ctx.pipActive) setPaletteOpen(!ctx.paletteOpen);
      break;
    case 'screenshot':
      captureFrame();
      break;
    case 'playerSpeed':
      player.setSpeed(payload);
      break;
    case 'playerVolume':
      player.setVolume(payload);
      break;
    case 'playerToggle':
      if (typeof payload === 'string') player.toggle(payload);
      break;
    case 'openUrl':
      if (typeof payload === 'string' && isTikTokUrl(payload)) {
        find.close({ focusView: false });
        wc.loadURL(payload);
      } else if (typeof payload === 'string') {
        openExternal(payload);
      }
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
    case 'openDownloads':
      shell.openPath(app.getPath('downloads')).then((error) => {
        if (error) toast('Не удалось открыть папку загрузок');
      });
      break;
    case 'downloadCancel':
      if (typeof payload === 'string') downloads.cancel(payload);
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
    case 'regionCheckIp':
      region.checkIp();
      break;
    case 'regionResetData':
      region.resetSiteData();
      break;
    case 'regionPanel':
      setPanelOpen(true);
      sendToWindow('octo:panel-category', 'region');
      break;
    case 'languagePanel':
      setPanelOpen(true);
      sendToWindow('octo:panel-category', 'language');
      break;
    case 'stickerPanel':
      setPanelOpen(true);
      sendToWindow('octo:panel-category', 'stickers');
      break;
    case 'stickerAdd':
      setPanelOpen(true);
      sendToWindow('octo:panel-category', 'stickers');
      stickers.addFromDialog();
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
