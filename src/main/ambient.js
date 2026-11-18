'use strict';

const { screen } = require('electron');
const { ctx, layout, pushState, setPanelOpen, setPaletteOpen, toast } = require('./app-context');
const { TITLEBAR_H } = require('./shared');
const find = require('./find');

/**
 * Амбиентный режим: лента без звука и интерфейса на втором мониторе.
 *
 * Окно переезжает на другой экран (если он есть), уходит в полный экран,
 * звук выключается, полоса и панели прячутся. Выход — <kbd>Esc</kbd>;
 * прежняя геометрия и звук возвращаются.
 */

let normal = null;

function pickDisplay(win) {
  const current = screen.getDisplayMatching(win.getBounds());
  const others = screen.getAllDisplays().filter((display) => display.id !== current.id);
  return others[0] || current;
}

function enter() {
  if (!ctx.win || ctx.win.isDestroyed() || ctx.ambient) return false;
  if (ctx.pipActive || ctx.barOnly) {
    toast('Сначала выйдите из PiP или режима «только полоса»');
    return false;
  }

  const win = ctx.win;
  const wc = ctx.view?.webContents;
  const display = pickDisplay(win);

  normal = {
    bounds: win.getNormalBounds(),
    fullscreen: win.isFullScreen(),
    alwaysOnTop: win.isAlwaysOnTop(),
    muted: wc && !wc.isDestroyed() ? wc.isAudioMuted() : false,
  };

  if (ctx.htmlFullscreen && wc && !wc.isDestroyed()) {
    wc.executeJavaScript(
      'document.exitFullscreen && document.exitFullscreen().catch(() => {})',
      false,
    ).catch(() => {});
    ctx.htmlFullscreen = false;
  }

  setPanelOpen(false, { persist: false });
  setPaletteOpen(false);
  find.close({ focusView: false });

  ctx.ambient = true;
  ctx.chromeHeight = 0;
  if (wc && !wc.isDestroyed()) wc.setAudioMuted(true);
  win.setAlwaysOnTop(false);

  if (win.isFullScreen()) win.setFullScreen(false);
  win.setBounds(display.bounds);
  win.setFullScreen(true);

  layout();
  setTimeout(layout, 350);
  pushState();
  toast('Амбиентный режим: Esc — выйти');
  return true;
}

function exit({ silent = false } = {}) {
  if (!ctx.ambient) return;

  const saved = normal;
  normal = null;
  ctx.ambient = false;

  const win = ctx.win;
  const wc = ctx.view?.webContents;

  if (win && !win.isDestroyed()) {
    if (win.isFullScreen()) win.setFullScreen(false);
    win.setAlwaysOnTop(saved ? saved.alwaysOnTop : false);

    if (saved) {
      if (saved.fullscreen) win.setFullScreen(true);
      else win.setBounds(saved.bounds);
    }

    ctx.chromeHeight = TITLEBAR_H;
    layout();
    setTimeout(layout, 250);
  }

  if (saved && wc && !wc.isDestroyed()) wc.setAudioMuted(saved.muted);

  pushState();
  if (!silent) toast('Обычный режим');
}

function toggle() {
  if (ctx.ambient) exit();
  else enter();
}

/** Окно закрывается: снимаем режим без восстановления геометрии. */
function reset() {
  ctx.ambient = false;
  normal = null;
}

module.exports = { enter, exit, toggle, reset };
