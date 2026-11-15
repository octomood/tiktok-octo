'use strict';

const { Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { ctx } = require('./app-context');
const { readState, writeState } = require('./store');
const cosmetics = require('./cosmetics');
const region = require('./region');

/**
 * Трей: быстрый доступ к звуку/поверх всех окон и режим «закрыть в трей».
 * На Linux без StatusNotifier этот модуль тихо отключается — приложение
 * продолжает работать без иконки.
 */

const iconPath = path.join(__dirname, '../../build/icon.png');

function createTray() {
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) return;

  const size = process.platform === 'darwin' ? 18 : 22;
  icon = icon.resize({ width: size, height: size });

  try {
    ctx.tray = new Tray(icon);
  } catch (err) {
    console.warn('[octo] tray unavailable:', err.message);
    ctx.tray = null;
    return;
  }

  ctx.tray.setToolTip('TikTok octo');
  ctx.tray.on('click', toggleWindow);
  refreshTrayMenu();
}

function toggleWindow() {
  if (!ctx.win) {
    // На macOS окно могли закрыть, а приложение осталось в трее.
    ctx.trayActions?.show?.();
    return;
  }
  if (ctx.win.isVisible() && !ctx.win.isMinimized()) {
    ctx.win.hide();
    return;
  }
  if (ctx.win.isMinimized()) ctx.win.restore();
  ctx.win.show();
  ctx.win.focus();
}

function showWindow() {
  if (!ctx.win) return;
  if (ctx.win.isMinimized()) ctx.win.restore();
  ctx.win.show();
  ctx.win.focus();
}

function refreshTrayMenu() {
  if (!ctx.tray || ctx.tray.isDestroyed()) return;
  const actions = ctx.trayActions;
  if (!actions) return;

  const saved = readState();
  const wc = ctx.view?.webContents;
  const visible = !!ctx.win && ctx.win.isVisible() && !ctx.win.isMinimized();

  const menu = Menu.buildFromTemplate([
    { label: visible ? 'Скрыть окно' : 'Показать окно', click: toggleWindow },
    { type: 'separator' },
    {
      label: 'Без звука',
      type: 'checkbox',
      checked: !!wc?.isAudioMuted(),
      click: () => actions.mute(),
    },
    {
      label: 'Поверх всех окон',
      type: 'checkbox',
      checked: !!ctx.win?.isAlwaysOnTop(),
      click: () => actions.onTop(),
    },
    {
      label: 'Картинка в картинке',
      type: 'checkbox',
      checked: ctx.pipActive,
      click: () => actions.pip(),
    },
    {
      label: 'Следующее видео',
      enabled: Boolean(wc),
      click: () => actions.next?.(),
    },
    {
      label: 'Предыдущее видео',
      enabled: Boolean(wc),
      click: () => actions.prev?.(),
    },
    {
      label: 'Автолистание в PiP',
      type: 'checkbox',
      checked: ctx.pipAuto,
      click: () => actions.pipAuto?.(),
    },
    {
      label: 'Адаптивный PiP',
      type: 'checkbox',
      checked: ctx.pipAdaptive,
      click: () => actions.pipAdaptive?.(),
    },
    {
      label: 'Панель функций',
      type: 'checkbox',
      checked: ctx.panelOpen,
      click: () => actions.panel(),
    },
    { label: 'Косметика', submenu: cosmetics.menuItems() },
    { label: 'Регион', submenu: region.menuItems() },
    { type: 'separator' },
    {
      label: 'Закрывать в трей',
      type: 'checkbox',
      checked: saved.closeToTray === true,
      click: () => {
        writeState({ closeToTray: saved.closeToTray !== true });
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    { label: 'Выход', click: () => actions.quit() },
  ]);

  ctx.tray.setContextMenu(menu);
}

function destroyTray() {
  if (!ctx.tray) return;
  ctx.tray.destroy();
  ctx.tray = null;
}

module.exports = { createTray, refreshTrayMenu, toggleWindow, showWindow, destroyTray };
