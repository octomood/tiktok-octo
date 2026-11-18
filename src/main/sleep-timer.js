'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const player = require('./player');

/**
 * Таймер сна.
 *
 * Режимы: N минут (с плавным затуханием), «до конца ролика» и «стоп после N
 * видео». Затухание и саму паузу делает страничный скрипт плеера: только он
 * знает точный конец ролика и умеет гасить громкость, не трогая настройки
 * пользователя. Здесь живут состояние, обратный отсчёт и сохранение между
 * запусками.
 */

const DEFAULTS = {
  mode: 'off',
  endsAt: 0,
  minutes: 0,
  videos: 3,
  videosLeft: 0,
  fade: false,
};

const MODES = ['off', 'minutes', 'end', 'videos'];

let timer = null;
let poller = null;

function readSettings() {
  const saved = readState().sleep;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    ...DEFAULTS,
    ...value,
    mode: MODES.includes(value.mode) ? value.mode : 'off',
  };
}

function save(patch) {
  writeState({ sleep: { ...readSettings(), ...patch } });
}

function stopTimers() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (poller) clearInterval(poller);
  poller = null;
}

/** Состояние для страничного скрипта: он и гасит звук, и ставит паузу. */
function updatePage() {
  const mode = ctx.sleepTimerMode;
  ctx.sleepPage = {
    endsAt: mode === 'minutes' ? ctx.sleepTimerEnds : 0,
    stopAtEnd: mode === 'end',
    videosLeft: mode === 'videos' ? Math.max(0, ctx.sleepTimerVideosLeft) : null,
    fade: Boolean(ctx.sleepTimerFade) && mode !== 'off',
  };
  player.apply();
}

function schedule(endsAt) {
  if (timer) clearTimeout(timer);
  timer = null;
  const left = Math.max(0, Number(endsAt) - Date.now());
  timer = setTimeout(() => {
    timer = null;
    finish('Таймер сна: воспроизведение остановлено');
  }, left);
  // Таймер сна не должен держать приложение в памяти после закрытия окна.
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/** Режимы «до конца» и «N видео» узнают о событии из опроса страницы. */
function startPolling() {
  if (poller) return;
  poller = setInterval(poll, 700);
  if (poller && typeof poller.unref === 'function') poller.unref();
}

async function poll() {
  const mode = ctx.sleepTimerMode;
  if (mode !== 'end' && mode !== 'videos') return;

  const info = await player.status();
  if (!info) return;

  if (mode === 'videos' && Number.isFinite(Number(info.videosLeft))) {
    const left = Math.max(0, Number(info.videosLeft));
    if (left !== ctx.sleepTimerVideosLeft) {
      ctx.sleepTimerVideosLeft = left;
      save({ videosLeft: left });
      pushState();
    }
  }

  if (info.done) finish('Таймер сна: воспроизведение остановлено');
}

/** Выключить отсчёт, не трогая выбранные пользователем пресеты. */
function finish(message) {
  stopTimers();
  ctx.sleepTimerMode = 'off';
  ctx.sleepTimerEnds = 0;
  ctx.sleepTimerMinutes = 0;
  ctx.sleepTimerVideosLeft = 0;
  save({ mode: 'off', endsAt: 0, minutes: 0, videosLeft: 0 });
  updatePage();
  if (message) toast(message);
  pushState();
}

/** Таймер на N минут. 0 — выключить. */
function set(minutes) {
  const value = Math.min(240, Math.max(0, Math.round(Number(minutes) || 0)));
  stopTimers();

  if (value === 0) {
    finish('Таймер сна выключен');
    return;
  }

  ctx.sleepTimerMode = 'minutes';
  ctx.sleepTimerMinutes = value;
  ctx.sleepTimerEnds = Date.now() + value * 60_000;
  ctx.sleepTimerVideosLeft = 0;
  save({
    mode: 'minutes',
    minutes: value,
    endsAt: ctx.sleepTimerEnds,
    videosLeft: 0,
  });
  schedule(ctx.sleepTimerEnds);
  updatePage();
  toast(`Таймер сна: ${value} мин`);
  pushState();
}

/** «До конца ролика»: включает режим и ждёт события ended из страницы. */
function setStopAtEnd(enabled) {
  if (!enabled) {
    finish('Таймер сна выключен');
    return;
  }
  stopTimers();
  ctx.sleepTimerMode = 'end';
  ctx.sleepTimerEnds = 0;
  ctx.sleepTimerMinutes = 0;
  ctx.sleepTimerVideosLeft = 0;
  save({ mode: 'end', endsAt: 0, minutes: 0, videosLeft: 0 });
  updatePage();
  startPolling();
  toast('Стоп после этого ролика');
  pushState();
}

/** «Стоп после N видео»: счётчик уменьшается на каждом закончившемся ролике. */
function setVideos(count) {
  const value = Math.min(50, Math.max(1, Math.round(Number(count) || 0)));
  stopTimers();
  ctx.sleepTimerMode = 'videos';
  ctx.sleepTimerVideos = value;
  ctx.sleepTimerVideosLeft = value;
  ctx.sleepTimerEnds = 0;
  ctx.sleepTimerMinutes = 0;
  save({ mode: 'videos', videos: value, videosLeft: value, endsAt: 0, minutes: 0 });
  updatePage();
  startPolling();
  toast(`Стоп после ${value} видео`);
  pushState();
}

function toggleFade() {
  ctx.sleepTimerFade = !ctx.sleepTimerFade;
  save({ fade: ctx.sleepTimerFade });
  updatePage();
  toast(ctx.sleepTimerFade ? 'Плавное затухание включено' : 'Плавное затухание выключено');
  pushState();
}

/** Восстановить таймер после перезапуска приложения. */
function sync() {
  const saved = readSettings();
  ctx.sleepTimerMode = saved.mode;
  ctx.sleepTimerMinutes = saved.minutes;
  ctx.sleepTimerEnds = saved.endsAt;
  ctx.sleepTimerVideos = saved.videos;
  ctx.sleepTimerVideosLeft = saved.videosLeft;
  ctx.sleepTimerFade = saved.fade;

  if (saved.mode === 'minutes') {
    if (saved.endsAt > Date.now()) {
      schedule(saved.endsAt);
    } else {
      // Пока приложение было закрыто, таймер истёк — просто снимаем его.
      ctx.sleepTimerMode = 'off';
      ctx.sleepTimerEnds = 0;
      ctx.sleepTimerMinutes = 0;
      save({ mode: 'off', endsAt: 0, minutes: 0 });
    }
  } else if (saved.mode === 'end' || saved.mode === 'videos') {
    startPolling();
  }

  updatePage();
}

sync();

module.exports = { set, setStopAtEnd, setVideos, toggleFade, sync };
