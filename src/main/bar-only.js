'use strict';

const { screen } = require('electron');
const { ctx, layout, pushState, toast } = require('./app-context');
const { TITLEBAR_H } = require('./shared');
const { refreshTrayMenu } = require('./tray');

/**
 * Режим «только полоса».
 *
 * Сайт остаётся загруженным и продолжает играть, но окно сжимается до
 * компактного пульта: название ролика, play/pause, переключение, громкость,
 * PiP и выход. WebContentsView прячется, поэтому картинка и наш интерфейс не
 * спорят за место в маленьком окне.
 */

const BAR_H = 76;
const BAR_W = 380;
const MIN_W = 280;
const NORMAL_MIN_W = 900;
const NORMAL_MIN_H = 600;
const MARGIN = 16;

let normal = null;

function enter() {
  if (!ctx.win || ctx.win.isDestroyed() || ctx.barOnly || ctx.pipActive) return;

  const win = ctx.win;
  normal = {
    bounds: win.getNormalBounds(),
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen(),
    alwaysOnTop: win.isAlwaysOnTop(),
  };

  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  ctx.barOnly = true;
  ctx.chromeHeight = BAR_H;
  win.setMinimumSize(MIN_W, BAR_H);
  win.setAlwaysOnTop(true, 'floating');

  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  win.setBounds({
    x: Math.round(area.x + area.width - BAR_W - MARGIN),
    y: Math.round(area.y + area.height - BAR_H - MARGIN),
    width: BAR_W,
    height: BAR_H,
  });

  if (ctx.view) {
    try {
      ctx.view.setVisible(false);
    } catch {
      /* view уже закрывается */
    }
  }

  layout();
  win.show();
  win.focus();
  pushState();
  refreshTrayMenu();
  toast('Режим «только полоса»');
}

function exit({ silent = false, restore = true } = {}) {
  if (!ctx.barOnly) return;

  const saved = normal;
  ctx.barOnly = false;
  normal = null;

  try {
    require('./app-context').syncViewVisibility();
  } catch {
    /* view уже закрывается */
  }

  if (ctx.win && !ctx.win.isDestroyed()) {
    const win = ctx.win;
    win.setMinimumSize(NORMAL_MIN_W, NORMAL_MIN_H);
    win.setAlwaysOnTop(saved ? saved.alwaysOnTop : false);

    if (restore && saved) {
      if (saved.fullscreen) win.setFullScreen(true);
      else if (saved.maximized) win.maximize();
      else win.setBounds(saved.bounds);
    }

    ctx.chromeHeight = TITLEBAR_H;
    layout();
    win.show();
    win.focus();
    ctx.view?.webContents?.focus();
  }

  pushState();
  refreshTrayMenu();
  if (!silent) toast('Обычный режим');
}

function toggle() {
  if (ctx.barOnly) exit();
  else enter();
}

/** Окно закрывается: снимаем режим без восстановления геометрии. */
function reset() {
  ctx.barOnly = false;
  normal = null;
}

/** Из полосы в PiP: сначала вернуть сайт и обычные размеры окна. */
function toPip() {
  if (!ctx.barOnly) return;
  exit({ silent: true });
}

/** Геометрия до режима — чтобы закрытие окна не сохранило пульт. */
function savedGeometry() {
  if (!ctx.barOnly || !normal) return null;
  return { bounds: normal.bounds, maximized: normal.maximized };
}

module.exports = { enter, exit, toggle, reset, toPip, savedGeometry };
