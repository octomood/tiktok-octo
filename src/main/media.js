'use strict';

const { ctx } = require('./app-context');
const { evalInPage } = require('./page-eval');

/**
 * Сторож воспроизведения.
 *
 * TikTok иногда оставляет <video> в состоянии «должно играть, но кадры
 * встали»: paused === false, плеер рисует кнопку паузы, а currentTime стоит
 * на месте. Обычно это сетевой провал, сбой декодера или пауза, которую
 * Chromium сделал в фоне, а сайт о ней не узнал. Сам сайт такую остановку не
 * лечит — ролик висит до перезагрузки страницы.
 *
 * Скрипт живёт в странице и раз в секунду проверяет активное видео. Если
 * время не двигается, он сначала повторяет play(), затем перезагружает
 * источник с возвратом на ту же секунду. Пользовательскую паузу не трогает:
 * paused === true — всегда сигнал «оставь как есть». После серии неудач
 * выдерживает паузу, чтобы не дёргать сеть в цикле.
 */

const PAGE_SCRIPT = `(() => {
  if (window.__octoMedia) {
    window.__octoMedia.start();
    return 0;
  }

  const TICK_MS = 1000;
  // Столько ждём движения currentTime, прежде чем считать видео зависшим.
  const STALL_MS = 3500;
  // Столько ждём новых *показанных* кадров: звук и время идут, картинки нет.
  const FRAME_STALL_MS = 3000;
  // Минимальная пауза между попытками внутри одной серии.
  const RETRY_MS = 1500;
  // После стольких попыток оставляем видео в покое на COOLDOWN_MS.
  const MAX_ATTEMPTS = 4;
  const COOLDOWN_MS = 20000;
  const MOVE_EPSILON = 0.05;

  const state = {
    timer: null,
    video: null,
    lastTime: -1,
    progressAt: 0,
    attempts: 0,
    lastAttemptAt: 0,
    cooldownUntil: 0,
    frames: null,
    framesAt: 0,
    frameAttempts: 0,
    lastFrameAttemptAt: 0,
    frameCooldownUntil: 0,
  };

  const videos = () => [...document.querySelectorAll('video')];

  const visible = (video) => {
    if (!video || !video.isConnected) return false;
    const rect = video.getBoundingClientRect();
    return rect.width > 80 && rect.height > 80;
  };

  // Лента держит в DOM соседние ролики: размер у всех большой, поэтому
  // «на экране» — это ещё и центр в пределах окна.
  const onScreen = (video) => {
    if (!visible(video)) return false;
    const rect = video.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight;
  };

  const inViewport = (video) => {
    if (!visible(video)) return false;
    const rect = video.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    );
  };

  /**
   * Оставить звук одному ролику. После смены видео TikTok иногда продолжает
   * играть предыдущий <video>: на экране уже другой кадр, а звучит старый.
   * Если на экране нет активного ролика или играет только один, не
   * вмешиваемся — иначе можно поставить на паузу новый ролик во время скролла.
   */
  const solePlayer = () => {
    const playing = videos().filter((video) => !video.paused && !video.ended);
    if (playing.length < 2) return null;
    const screen = playing.find(onScreen) || null;
    if (!screen) return null;
    let paused = false;
    for (const video of playing) {
      if (video === screen) continue;
      // Два ролика на экране или новый ролик уже въезжает в кадр — не мешаем.
      if (onScreen(video) || inViewport(video)) continue;
      try {
        video.pause();
        paused = true;
      } catch (err) {
        /* элемент уже выгружен */
      }
    }
    return paused ? screen : null;
  };

  const activeVideo = () => {
    const list = videos();
    return (
      list.find((video) => onScreen(video) && !video.paused && !video.ended) ||
      list.find(onScreen) ||
      list.find((video) => visible(video) && !video.paused && !video.ended) ||
      list.find(visible) ||
      list[0] ||
      null
    );
  };

  const pageHidden = () => document.visibilityState === 'hidden';

  // totalVideoFrames считает показанные (или отброшенные) кадры. Если звук
  // играет, а счётчик стоит — кадры не доходят до экрана.
  const framesOf = (video) => {
    try {
      const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
      return quality ? quality.totalVideoFrames : null;
    } catch (err) {
      return null;
    }
  };

  // Источник есть, но данных нет: сеть не отдала сегмент или декодер упал.
  const withoutData = (video) =>
    Boolean(video.error) ||
    video.readyState === 0 ||
    video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;

  const kicked = new WeakMap();

  /**
   * Сдвиг слоя заставляет композитор собрать кадр заново. Лечит «застывший»
   * кадр, когда звук играет, а картинка не обновляется, без перезагрузки.
   */
  const kick = (video) => {
    try {
      const existing = kicked.get(video);
      if (existing) {
        clearTimeout(existing.timer);
      } else {
        kicked.set(video, { previous: video.style.transform, timer: null });
      }
      const entry = kicked.get(video);
      video.style.transform = 'translateZ(0)';
      entry.timer = setTimeout(() => {
        const saved = kicked.get(video);
        kicked.delete(video);
        if (saved) video.style.transform = saved.previous;
      }, 150);
    } catch (err) {
      /* видео ушло со страницы */
    }
  };

  const forget = () => {
    state.video = null;
    state.lastTime = -1;
    state.progressAt = 0;
    state.attempts = 0;
    state.lastAttemptAt = 0;
    state.cooldownUntil = 0;
    state.frames = null;
    state.framesAt = 0;
    state.frameAttempts = 0;
    state.lastFrameAttemptAt = 0;
    state.frameCooldownUntil = 0;
  };

  const reset = (video) => {
    state.video = video;
    state.lastTime = video.currentTime;
    state.progressAt = Date.now();
    state.attempts = 0;
    state.lastAttemptAt = 0;
    state.cooldownUntil = 0;
    state.frames = framesOf(video);
    state.framesAt = Date.now();
    state.frameAttempts = 0;
    state.lastFrameAttemptAt = 0;
    state.frameCooldownUntil = 0;
  };

  /**
   * Мягкий пинок медиа-пайплайна для MSE (blob:) и потоков с буфером:
   * переустановка currentTime заставляет декодер выдать свежий кадр
   * композитору без сброса буфера через load().
   */
  const nudgePipeline = (video) => {
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const position = Number(video.currentTime) || 0;
        const seekable = video.seekable;
        if (seekable && seekable.length > 0) {
          const end = seekable.end(seekable.length - 1);
          video.currentTime = Number.isFinite(end) && end > 0 ? Math.min(position, end) : position;
        } else {
          video.currentTime = position;
        }
      }
      kick(video);
      if (!video.paused && !video.ended) video.play().catch(() => {});
      return true;
    } catch (err) {
      return false;
    }
  };

  /** Перезагрузка источника с возвратом на ту же секунду. */
  const reload = (video) => {
    const source = video.currentSrc || video.getAttribute('src');
    if (!source || /^blob:/i.test(source)) return false;

    const position = video.currentTime;
    const seekBack = () => {
      try {
        const seekable = video.seekable;
        if (position > 0.25 && seekable && seekable.length > 0) {
          video.currentTime = Math.min(position, seekable.end(seekable.length - 1));
          return true;
        }
      } catch (err) {
        /* метаданные ещё не пришли */
      }
      return false;
    };
    const resume = () => {
      if (!seekBack() && position > 0.25) {
        video.addEventListener('canplay', seekBack, { once: true });
      }
      video.addEventListener('loadeddata', () => kick(video), { once: true });
      video.play().catch(() => {});
    };

    video.addEventListener('loadedmetadata', resume, { once: true });
    try {
      if (video.currentSrc !== source) video.src = source;
      video.load();
    } catch (err) {
      video.removeEventListener('loadedmetadata', resume);
      return false;
    }
    // После load() счётчик кадров начинается заново.
    state.frames = null;
    state.framesAt = Date.now();
    return true;
  };

  const recover = (video, now) => {
    state.lastAttemptAt = now;
    state.attempts += 1;

    if (state.attempts >= MAX_ATTEMPTS) {
      // Сеть или декодер залипли безнадёжно: ждём смены видео или действия
      // пользователя, чтобы не перезагружать источник по кругу.
      state.cooldownUntil = now + COOLDOWN_MS;
      state.attempts = 0;
      state.progressAt = now;
      state.lastTime = video.currentTime;
      return;
    }

    if (state.attempts === 1 && !withoutData(video)) {
      // Первая попытка мягкая: play() мог быть отклонён политикой автозапуска,
      // а сайт об этом не узнал.
      kick(video);
      video.play().catch(() => {});
    } else if (!reload(video)) {
      nudgePipeline(video);
    }

    state.progressAt = now;
    state.lastTime = video.currentTime;
  };

  /**
   * Звук и currentTime идут, но новые кадры не показываются. Сначала просим
   * композитор пересобрать слой, затем пересоздаём медиа-пайплайн.
   */
  const recoverFrames = (video, now) => {
    state.lastFrameAttemptAt = now;
    state.frameAttempts += 1;

    if (state.frameAttempts > MAX_ATTEMPTS) {
      state.frameCooldownUntil = now + COOLDOWN_MS;
      state.frameAttempts = 0;
      state.framesAt = now;
      return false;
    }

    if (state.frameAttempts === 1) {
      kick(video);
      state.framesAt = now;
      return true;
    }

    if (!reload(video)) {
      nudgePipeline(video);
    }
    // load()/seek сбрасывает или двигает позицию: обычному сторожу тоже нужен отсчёт.
    state.progressAt = now;
    state.lastTime = video.currentTime;
    state.lastAttemptAt = now;
    return true;
  };

  function tick() {
    if (pageHidden()) return;

    // Сайт иногда оставляет играть прошлый ролик — звук от него, картинка от
    // нового. Здесь же ловим это и без сворачивания окна.
    solePlayer();

    const video = activeVideo();
    if (!video) {
      forget();
      return;
    }

    if (video !== state.video) {
      reset(video);
      return;
    }

    const now = Date.now();

    // Пауза или конец ролика — решение сайта/пользователя, не вмешиваемся.
    if (video.paused || video.ended) {
      state.lastTime = video.currentTime;
      state.progressAt = now;
      state.attempts = 0;
      state.frames = null;
      state.framesAt = now;
      state.frameAttempts = 0;
      return;
    }

    const moved = Math.abs(video.currentTime - state.lastTime) > MOVE_EPSILON;
    if (moved) {
      state.lastTime = video.currentTime;
      state.progressAt = now;
      state.attempts = 0;
      state.cooldownUntil = 0;
    }

    // Кадры не показываются, хотя время и звук идут. Если стоит и время,
    // это обычный сторож ниже: здесь именно «звук есть, картинки нет».
    if (moved && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const frames = framesOf(video);
      if (frames !== null) {
        if (state.frames === null || frames > state.frames) {
          state.frames = frames;
          state.framesAt = now;
          state.frameAttempts = 0;
        } else if (now - state.framesAt >= FRAME_STALL_MS) {
          if (now - state.lastFrameAttemptAt >= RETRY_MS && now >= state.frameCooldownUntil) {
            if (recoverFrames(video, now)) return;
          }
        }
      }
    }

    if (!moved) {
      if (!state.progressAt) state.progressAt = now;
      if (now - state.progressAt < STALL_MS) return;
      if (now - state.lastAttemptAt < RETRY_MS) return;
      if (now < state.cooldownUntil) return;
      recover(video, now);
    }
  }

  // Битый источник: не ждём полный таймаут, следующая проверка перезагрузит.
  const onError = (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || video !== state.video) return;
    if (pageHidden()) return;
    state.progressAt = Date.now() - STALL_MS - 1;
    state.lastAttemptAt = 0;
  };

  const onVisibility = () => {
    if (pageHidden()) return;
    // Пока окно было скрыто, сайт мог переключить ролик: звук старого
    // оставался, а на экране уже другой. Гасим лишние и начинаем заново.
    solePlayer();
    forget();
  };

  // Первый кадр нового ролика иногда не доезжает до экрана: просим
  // композитор пересобрать слой только если за 180 мс кадры так и не пошли,
  // чтобы не дёргать здоровый видеослой на каждом старте.
  const onPlaying = (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !visible(video)) return;
    const before = framesOf(video);
    setTimeout(() => {
      if (!video.isConnected || video.paused || !inViewport(video)) return;
      const after = framesOf(video);
      if (
        after === null ||
        after === 0 ||
        video.videoWidth === 0 ||
        (before !== null && after <= before)
      ) {
        kick(video);
      }
    }, 180);
  };

  function start() {
    if (state.timer) return;
    document.addEventListener('error', onError, true);
    document.addEventListener('playing', onPlaying, true);
    document.addEventListener('visibilitychange', onVisibility);
    state.timer = setInterval(tick, TICK_MS);
    tick();
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    document.removeEventListener('error', onError, true);
    document.removeEventListener('playing', onPlaying, true);
    document.removeEventListener('visibilitychange', onVisibility);
    forget();
    delete window.__octoMedia;
  }

  window.__octoMedia = {
    start,
    stop,
    tick,
    /** Возобновить видимое видео после возврата окна. Паузу пользователя не трогает. */
    resume() {
      const video = activeVideo();
      if (!video) return;
      // Старый ролик мог остаться играть, пока окно было в трее: его звук
      // слышен, а на экране уже другое видео. Гасим всех, кроме текущего.
      for (const other of videos()) {
        if (other === video || other.paused || other.ended) continue;
        if (onScreen(other)) continue;
        try {
          other.pause();
        } catch (err) {
          /* элемент уже выгружен */
        }
      }
      kick(video);
      if (video.paused && !video.ended) video.play().catch(() => {});
    },
    /** Перерисовать видимое видео после сброса GPU или показа view без снятия паузы. */
    repaint() {
      const video = activeVideo();
      if (!video || !video.isConnected) return false;
      kick(video);
      if (!video.paused && !video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const frames = framesOf(video);
        if (frames === 0 || video.videoWidth === 0) nudgePipeline(video);
      }
      return true;
    },
    info() {
      return {
        attempts: state.attempts,
        stalledFor: state.progressAt ? Date.now() - state.progressAt : 0,
        frameAttempts: state.frameAttempts,
        frames: state.frames,
        paused: state.video ? state.video.paused : null,
      };
    },
  };

  start();
  return 1;
})()`;

const RESUME_SCRIPT = `window.__octoMedia && window.__octoMedia.resume()`;
const REPAINT_SCRIPT = `window.__octoMedia && window.__octoMedia.repaint()`;

function contents() {
  const wc = ctx.view?.webContents;
  return wc && !wc.isDestroyed() ? wc : null;
}

/** dom-ready и повторно после навигации — скрипт должен пережить переход. */
function apply() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [PAGE_SCRIPT]);
}

/** Окно вернулось из фона: если сайт сам поставил паузу, продолжить. */
function resume() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [RESUME_SCRIPT]);
}

/** View вернулся на экран или перезапустился GPU: пересобрать видеослой. */
function repaint() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [REPAINT_SCRIPT]);
}

module.exports = { apply, resume, repaint };
