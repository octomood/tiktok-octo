'use strict';

const { ctx, setPopover } = require('./app-context');
const { handleCommand } = require('./commands');
const plugins = require('./plugins');
const keymap = require('./keymap');
const fullscreenNav = require('./fullscreen-nav');

/**
 * Горячие клавиши.
 *
 * Сочетания берутся из keymap.js, поэтому пользователь может переназначить
 * любую команду. Обрабатываем через before-input-event на обоих webContents
 * (полоса заголовка и сайт), поэтому шорткаты работают независимо от фокуса.
 * Меню намеренно не задаёт ускорители — иначе действия срабатывали бы дважды.
 */

/** Старые сочетания в запасе: не занимают список команд, но работают. */
const ALIASES = {
  F5: 'reload',
  'Ctrl+,': 'panel',
  'Ctrl+G': 'findNext',
  'Ctrl+Shift+G': 'findPrev',
  // Ctrl и «+» даёт Shift+= на большинстве раскладок.
  'Ctrl+Shift+=': 'zoomIn',
  'Ctrl+Shift+-': 'zoomOut',
};

function handleShortcut(event, input) {
  if (input.type !== 'keyDown' || !ctx.view) return;
  const run = (fn) => {
    event.preventDefault();
    fn();
  };

  // Esc — не команда редактора: он закрывает то, что открыто сверху.
  if (input.key === 'Escape') {
    // Редактор клавиш ждёт сочетание: Esc отменяет захват, панель остаётся.
    if (ctx.keymapCapturing) {
      return run(() => {});
    }
    // Амбиентный режим и перерыв Focus выходят по Esc первыми.
    if (ctx.ambient) return run(() => handleCommand('ambientExit'));
    if (ctx.focus && ctx.focus.phase === 'break') {
      return run(() => handleCommand('focusExit'));
    }
    // HTML-fullscreen важнее PiP: сначала вернуть полосу PiP, потом выходить.
    if (ctx.htmlFullscreen) {
      return run(() => {
        fullscreenNav.cancelSwitch();
        const wc = ctx.view?.webContents;
        if (wc && !wc.isDestroyed()) {
          wc.executeJavaScript(
            'document.exitFullscreen && document.exitFullscreen().catch(() => {})',
            false,
          ).catch(() => {});
        }
      });
    }
    if (ctx.pluginDialogOpen) return run(() => plugins.cancelDialog());
    if (ctx.paletteOpen) return run(() => handleCommand('palette'));
    if (ctx.find.open) return run(() => handleCommand('findClose'));
    if (ctx.popover) return run(() => setPopover(null));
    if (ctx.pluginsOpen) return run(() => handleCommand('pluginsClose'));
    if (ctx.panelOpen) return run(() => handleCommand('panel'));
    if (ctx.chatOpen) return run(() => handleCommand('chat'));
    if (ctx.barOnly) return run(() => handleCommand('barExit'));
    if (ctx.pipActive) return run(() => handleCommand('pipClose'));
    if (ctx.win?.isFullScreen()) return run(() => handleCommand('fullscreen'));
    return undefined;
  }

  // Палитра сама обрабатывает стрелки и Enter; из глобальных оставляем
  // только её закрытие/переключение.
  if (ctx.paletteOpen) {
    if (keymap.commandFor(keymap.acceleratorOf(input)) === 'palette') {
      return run(() => handleCommand('palette'));
    }
    return undefined;
  }

  const accelerator = keymap.acceleratorOf(input);
  const command = keymap.commandFor(accelerator) || ALIASES[accelerator];

  if (command) {
    return run(() => handleCommand(command));
  }

  if (plugins.handleShortcut(input)) {
    event.preventDefault();
  }
  return undefined;
}

module.exports = { handleShortcut };
