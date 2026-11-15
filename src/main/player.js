'use strict';

const { ctx, pushState } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');

/**
 * Настройки плеера, которых нет у сайта: скорость по умолчанию, старт без
 * звука, повтор видео и пауза в фоне. Применяются к каждому новому <video>.
 */

const DEFAULTS = {
  speed: 1,
  volume: 1,
  startMuted: false,
  loop: false,
  pauseOnBlur: false,
};

const SPEEDS = [0.5, 1, 1.5, 2];
const MIN_SPEED = 0.5;
const MAX_SPEED = 3;

function readSettings() {
  const saved = readState().player;
  return {
    ...DEFAULTS,
    ...(saved && typeof saved === 'object' ? saved : {}),
  };
}

function sync() {
  ctx.player = readSettings();
}

function save(patch) {
  writeState({ player: { ...readSettings(), ...patch } });
  sync();
}

function pageScript(config) {
  return `(() => {
    const next = ${JSON.stringify(config)};

    if (window.__octoPlayer) {
      window.__octoPlayer.update(next);
      return 0;
    }

    let current = next;
    const seen = new WeakSet();

    const apply = (video) => {
      if (!video) return;
      // Пишем скорость только при реальном отличии. Лишняя запись playbackRate
      // перезапускает видео-конвейер: на Linux звук продолжается, а кадры
      // замирают на первой секунде.
      if (Math.abs(video.playbackRate - current.speed) > 0.001) {
        try {
          video.playbackRate = current.speed;
        } catch (err) {
          /* некоторые видео запрещают смену скорости */
        }
      }
      try {
        const volume = Number(current.volume);
        const target = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
        if (Math.abs(video.volume - target) > 0.001) video.volume = target;
      } catch (err) {
        /* громкость недоступна до появления источника */
      }
      if (video.loop !== Boolean(current.loop)) video.loop = Boolean(current.loop);
    };

    const handle = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;

      if (!seen.has(video)) {
        seen.add(video);
        if (current.startMuted && !video.muted) video.muted = true;
      }

      apply(video);
      // Сайт иногда выставляет свою скорость уже после play.
      setTimeout(() => apply(video), 600);
    };

    document.addEventListener('play', handle, true);
    document.addEventListener('loadedmetadata', handle, true);

    window.__octoPlayer = {
      update(configuration) {
        current = { ...current, ...configuration };
        document.querySelectorAll('video').forEach((video) => {
          seen.add(video);
          const mute = Boolean(current.startMuted);
          if (video.muted !== mute) video.muted = mute;
          apply(video);
        });
      },
      stop() {
        document.removeEventListener('play', handle, true);
        document.removeEventListener('loadedmetadata', handle, true);
        document.querySelectorAll('video').forEach((video) => {
          video.playbackRate = 1;
          video.loop = false;
        });
        delete window.__octoPlayer;
      },
    };

    document.querySelectorAll('video').forEach((video) => {
      seen.add(video);
      if (current.startMuted) video.muted = true;
      apply(video);
    });
    return 1;
  })()`;
}

function apply() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [pageScript(ctx.player)]);
}

function setSpeed(value) {
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(Number(value) * 4) / 4));
  save({ speed });
  apply();
  pushState();
}

/** Громкость 0…1: сайт не даёт своего ползунка, поэтому задаём её у каждого <video>. */
function setVolume(value) {
  const volume = Math.min(1, Math.max(0, Number(value) || 0));
  save({ volume: Math.round(volume * 100) / 100 });
  apply();
  pushState();
}

function toggle(key) {
  if (!(key in DEFAULTS) || key === 'speed') return;
  save({ [key]: !ctx.player[key] });
  apply();
  pushState();
}

/** Пауза при потере фокуса/сворачивании — только если включено. */
function pauseForBackground() {
  if (!ctx.player.pauseOnBlur) return;
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [`document.querySelectorAll('video').forEach((video) => video.pause())`]);
}

sync();

module.exports = { SPEEDS, apply, setSpeed, setVolume, toggle, pauseForBackground };
