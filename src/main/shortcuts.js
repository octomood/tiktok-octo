'use strict';

const { ctx } = require('./app-context');
const { handleCommand } = require('./commands');

/**
 * Горячие клавиши.
 *
 * Обрабатываем через before-input-event на обоих webContents (полоса
 * заголовка и сайт), поэтому шорткаты работают независимо от фокуса.
 * Меню намеренно не задаёт ускорители — иначе действия срабатывали бы дважды.
 */
function handleShortcut(event, input) {
  if (input.type !== 'keyDown' || !ctx.view) return;
  const mod = input.control || input.meta;
  const key = input.key.toLowerCase();

  const run = (fn) => {
    event.preventDefault();
    fn();
  };

  if (input.key === 'F11') return run(() => handleCommand('fullscreen'));
  if (input.key === 'F5') return run(() => handleCommand('reload'));
  if (input.key === 'F3') {
    return run(() => handleCommand(input.shift ? 'findPrev' : 'findNext'));
  }
  if (input.key === 'Escape') {
    if (ctx.paletteOpen) return run(() => handleCommand('palette'));
    if (ctx.find.open) return run(() => handleCommand('findClose'));
    if (ctx.panelOpen) return run(() => handleCommand('panel'));
    if (ctx.win?.isFullScreen()) return run(() => handleCommand('fullscreen'));
    return undefined;
  }

  // Палитра сама обрабатывает стрелки и Enter; из глобальных оставляем
  // только её закрытие/переключение.
  if (ctx.paletteOpen) {
    if (mod && key === 'k') return run(() => handleCommand('palette'));
    return undefined;
  }
  if (input.alt && input.key === 'ArrowLeft') return run(() => handleCommand('back'));
  if (input.alt && input.key === 'ArrowRight') return run(() => handleCommand('forward'));

  if (!mod) return undefined;

  switch (key) {
    case 'r':
      return run(() => handleCommand(input.shift ? 'hardReload' : 'reload'));
    case 'f':
      return run(() => handleCommand('find'));
    case 'g':
      return run(() => handleCommand(input.shift ? 'findPrev' : 'findNext'));
    case 'w':
      return run(() => handleCommand('close'));
    case 'q':
      return run(() => handleCommand('quit'));
    case '=':
    case '+':
      return run(() => handleCommand('zoomIn'));
    case '-':
      return run(() => handleCommand('zoomOut'));
    case '0':
      return run(() => handleCommand('zoomReset'));
    case 'i':
      if (input.shift) return run(() => handleCommand('devtools'));
      break;
    case 'm':
      if (input.shift) return run(() => handleCommand('mute'));
      break;
    case 'p':
      if (input.shift) return run(() => handleCommand('pip'));
      break;
    case 'o':
      if (input.shift) return run(() => handleCommand('onTop'));
      break;
    case 'b':
      if (input.shift) return run(() => handleCommand('panel'));
      break;
    case 'k':
      return run(() => handleCommand('palette'));
    case 's':
      if (input.shift) return run(() => handleCommand('screenshot'));
      break;
    default:
      break;
  }
  return undefined;
}

module.exports = { handleShortcut };
