'use strict';

const { BrowserWindow } = require('electron');
const path = require('node:path');
const { TITLEBAR_H } = require('./shared');
const { ctx, layout, pushState, setCloseToTray, clampUiScale } = require('./app-context');
const { readState, writeState } = require('./store');
const { createView } = require('./view');
const { handleShortcut } = require('./shortcuts');
const { refreshTrayMenu } = require('./tray');
const player = require('./player');
const media = require('./media');
const pip = require('./pip');
const barOnly = require('./bar-only');
const ambient = require('./ambient');
const plugins = require('./plugins');
const chat = require('./chat');
const windowsMedia = require('./windows-media');
const uiFont = require('./ui-font');
const uiCustom = require('./ui-custom');
const { getPaletteTokens, normalizePaletteId } = require('./md3-palettes');
const contextMenu = require('./context-menu');
const { attachContextMenu } = require('./menu');
const logger = require('./logger');

function saveGeometry(win) {
  // В PiP и в «только полоса» окно маленькое — сохраняем геометрию до режима.
  const saved = pip.savedGeometry() || barOnly.savedGeometry();
  writeState(saved || { bounds: win.getNormalBounds(), maximized: win.isMaximized() });
}

function createWindow() {
  const saved = readState();
  const bounds = saved.bounds || {};
  const uiScale = clampUiScale(saved.uiScale);
  const initialCustom = uiCustom.normalizeUiCustom(saved.uiCustom);
  const initialTopbarButtons = uiCustom.normalizeTopbarButtons(saved.topbarButtons);
  const initialBg =
    saved.themeAmoled && saved.themeMode !== 'light'
      ? '#000000'
      : getPaletteTokens(
          normalizePaletteId(saved.themePalette),
          saved.themeMode !== 'light',
          saved.themeCustom,
        )?.surface || '#191624';
  const initialTitle = initialCustom.brand?.label || 'TikTok Octo';

  const win = new BrowserWindow({
    width: bounds.width ?? 1280,
    height: bounds.height ?? 840,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: initialBg,
    title: initialTitle,
    icon: path.join(__dirname, '../../build/icon.png'),
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  ctx.win = win;
  logger.info('window', 'created', {
    width: bounds.width ?? 1280,
    height: bounds.height ?? 840,
    uiScale,
  });
  win.setMenuBarVisibility(false);
  ctx.uiScale = uiScale;
  ctx.uiFont = uiFont.normalizeUiFont(saved.uiFont);
  ctx.uiCustom = initialCustom;
  ctx.topbarButtons = initialTopbarButtons;
  ctx.chromeHeightCss = TITLEBAR_H;
  ctx.chromeHeight = Math.round(TITLEBAR_H * uiScale);
  win.webContents.setZoomFactor(uiScale);
  ctx.panelOpen = false;
  ctx.pluginsOpen = false;
  ctx.paletteOpen = false;
  ctx.sideNavCollapsed = saved.sideNavCollapsed === true;
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
    logger.info('window', 'ready-to-show', {
      startHidden,
      hasTray: Boolean(ctx.tray),
      maximized: Boolean(saved.maximized),
    });
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
    logger.debug('window', 'maximize');
    layout();
    pushState();
  });
  win.on('unmaximize', () => {
    logger.debug('window', 'unmaximize');
    layout();
    pushState();
  });
  win.on('enter-full-screen', () => {
    logger.info('window', 'enter-full-screen');
    layout();
    pushState();
  });
  win.on('leave-full-screen', () => {
    logger.info('window', 'leave-full-screen');
    layout();
    pushState();
  });
  win.on('show', () => {
    logger.debug('window', 'show');
    layout();
    win.webContents.invalidate();
    resumePlayback();
    refreshTrayMenu();
  });
  win.on('hide', () => {
    logger.debug('window', 'hide');
    rememberPlayback();
    player.pauseForBackground();
    refreshTrayMenu();
  });
  win.on('minimize', () => {
    logger.debug('window', 'minimize');
    rememberPlayback();
    player.pauseForBackground();
    refreshTrayMenu();
  });
  win.on('blur', () => player.pauseForBackground());
  win.on('restore', () => {
    logger.debug('window', 'restore');
    resumePlayback();
    refreshTrayMenu();
  });

  win.on('close', (event) => {
    const state = readState();
    if (state.closeToTray === true && !ctx.quitting) {
      logger.info('window', 'close intercepted -> hide to tray');
      event.preventDefault();
      win.hide();
      refreshTrayMenu();
      return;
    }
    logger.info('window', 'closing', { quitting: ctx.quitting });
    saveGeometry(win);
  });

  win.on('closed', () => {
    logger.info('window', 'closed');
    contextMenu.dispose();
    chat.dispose();
    pip.reset();
    barOnly.reset();
    ambient.reset();
    ctx.win = null;
    ctx.view = null;
    plugins.suspend();
    refreshTrayMenu();
  });

  attachContextMenu(win.webContents, { editableOnly: true });
  win.webContents.on('before-input-event', handleShortcut);
  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('window', 'shell render-process-gone', {
      reason: details?.reason,
      exitCode: details?.exitCode,
    });
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    logger.error('window', 'shell did-fail-load', { code, description, url });
  });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      logger.throttled(
        `shell-console:${String(event.message).slice(0, 60)}`,
        3000,
        event.level === 'error' ? 'ERROR' : 'WARN',
        'shell:console',
        event.message,
      );
    }
  });
  win.webContents.once('did-finish-load', () => {
    logger.info('window', 'shell did-finish-load');
    pushState();
    refreshTrayMenu();
  });

  createView();
  windowsMedia.install(win, ctx.playing);
  plugins.resume();
  return win;
}

module.exports = { createWindow };
