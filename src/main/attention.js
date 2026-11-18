'use strict';

const { powerMonitor, powerSaveBlocker } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const media = require('./media');

/**
 * Внимание к пользователю и питанию.
 *
 * Автопауза по простою: если системного ввода нет N минут, ролик ставится на
 * паузу, а когда пользователь вернулся — продолжается. Пауза ставится только
 * если видео действительно играло: ручную паузу не трогаем.
 *
 * «Не спать, пока играет» держит экран включённым через powerSaveBlocker,
 * пока идёт воспроизведение.
 */

const DEFAULTS = { idlePause: 0, keepAwake: false };
const POLL_MS = Number(process.env.OCTO_IDLE_POLL_MS) || 5000;
const RETURN_SECONDS = 5;

let timer = null;
let blocker = null;
let pausedByUs = false;

function readSettings() {
  const saved = readState().attention;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    ...DEFAULTS,
    ...value,
    idlePause: Math.max(0, Number(value.idlePause) || 0),
    keepAwake: value.keepAwake === true,
  };
}

function sync() {
  const saved = readSettings();
  ctx.idlePause = saved.idlePause;
  ctx.keepAwake = saved.keepAwake;
}

function save(patch) {
  writeState({ attention: { ...readSettings(), ...patch } });
  sync();
}

function pauseForIdle() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  wc.executeJavaScript(
    `(() => {
       document.querySelectorAll('video').forEach((video) => {
         if (!video.paused) video.pause();
       });
       return true;
     })()`,
    false,
  ).catch(() => {
    /* страница уже ушла */
  });
}

function syncBlocker() {
  const needed = ctx.keepAwake && ctx.playing;
  if (needed && blocker === null) {
    try {
      blocker = powerSaveBlocker.start('prevent-display-sleep');
    } catch {
      blocker = null;
    }
    return;
  }
  if (!needed && blocker !== null) {
    try {
      if (powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
    } catch {
      /* блокировка уже снята системой */
    }
    blocker = null;
  }
}

function poll() {
  if (ctx.idlePause > 0) {
    let idle = 0;
    try {
      idle = powerMonitor.getSystemIdleTime();
    } catch {
      idle = 0;
    }

    if (!pausedByUs && idle >= ctx.idlePause * 60 && ctx.playing) {
      pausedByUs = true;
      pauseForIdle();
      toast(`Пауза: нет ввода ${ctx.idlePause} мин`);
    } else if (pausedByUs && idle < RETURN_SECONDS) {
      pausedByUs = false;
      toast('С возвращением — продолжаем');
      media.resume();
    }
  } else {
    pausedByUs = false;
  }

  syncBlocker();
}

function start() {
  if (timer) return;
  timer = setInterval(poll, POLL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

function setIdlePause(minutes) {
  const value = Math.min(120, Math.max(0, Math.round(Number(minutes) || 0)));
  pausedByUs = false;
  save({ idlePause: value });
  toast(value > 0 ? `Автопауза по простою: ${value} мин` : 'Автопауза по простою выключена');
  pushState();
}

function toggleKeepAwake() {
  ctx.keepAwake = !ctx.keepAwake;
  save({ keepAwake: ctx.keepAwake });
  syncBlocker();
  toast(
    ctx.keepAwake ? 'Экран не будет засыпать при воспроизведении' : 'Система снова решает сама',
  );
  pushState();
}

sync();
start();

module.exports = { setIdlePause, toggleKeepAwake, sync };
