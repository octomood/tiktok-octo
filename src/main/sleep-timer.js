'use strict';

const { ctx, pushState, toast } = require('./app-context');

/**
 * Таймер сна: через N минут мягко ставит видео на паузу.
 * Живёт только в памяти процесса — перезапуск его сбрасывает.
 */

let timer = null;

function clear() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function pausePlayback() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  wc.executeJavaScript(
    `(() => {
       document.querySelectorAll('video').forEach((video) => video.pause());
       return true;
     })()`,
  ).catch(() => {
    /* страница уже ушла */
  });
}

function set(minutes) {
  const value = Math.min(240, Math.max(0, Math.round(Number(minutes) || 0)));
  clear();

  if (value === 0) {
    ctx.sleepTimerEnds = 0;
    ctx.sleepTimerMinutes = 0;
    toast('Таймер сна выключен');
    pushState();
    return;
  }

  ctx.sleepTimerMinutes = value;
  ctx.sleepTimerEnds = Date.now() + value * 60_000;

  timer = setTimeout(() => {
    timer = null;
    ctx.sleepTimerEnds = 0;
    ctx.sleepTimerMinutes = 0;
    pausePlayback();
    toast('Таймер сна: воспроизведение остановлено');
    pushState();
  }, value * 60_000);

  toast(`Таймер сна: ${value} мин`);
  pushState();
}

module.exports = { set, clear };
