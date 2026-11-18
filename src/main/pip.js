'use strict';

const { screen } = require('electron');
const { ctx, layout, pushState, toast, setPanelOpen, setPaletteOpen } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');
const { TITLEBAR_H } = require('./shared');
const { refreshTrayMenu } = require('./tray');
const find = require('./find');

/**
 * Картинка в картинке — собственный мини-плеер.
 *
 * Нативное PiP-окно Chromium не умеет ни листать ленту, ни переключать
 * видео, ни подстраиваться под экран. Поэтому в этом режиме главное окно
 * приложения само становится компактным окном поверх всех: сайт остаётся
 * тем же WebContents, видео через страничный скрипт разворачивается на весь
 * кадр, а управление живёт в собственной полосе PiP.
 */

const BAR_H = 56;
const MIN_W = 240;
const MIN_H = 240;
const NORMAL_MIN_W = 900;
const NORMAL_MIN_H = 600;
const MARGIN = 16;
const STATUS_MS = 500;
const DEFAULTS = { auto: true, adaptive: false };

let normal = null;
let entering = false;
let fitTimer = null;
let moveTimer = null;
let statusTimer = null;
let lastStatusPush = 0;
let lastDisplayId = null;
let displayWatchers = false;

function readSettings() {
  const saved = readState().pip;
  return {
    ...DEFAULTS,
    ...(saved && typeof saved === 'object' ? saved : {}),
  };
}

/** Синхронизировать сохранённые настройки PiP с общим состоянием. */
function sync() {
  const saved = readSettings();
  ctx.pipAuto = saved.auto !== false;
  ctx.pipAdaptive = saved.adaptive === true;
}

function save(patch) {
  writeState({ pip: { auto: ctx.pipAuto, adaptive: ctx.pipAdaptive, ...patch } });
  sync();
}

function contents() {
  return ctx.view?.webContents ?? null;
}

/** executeJavaScript может ждать did-stop-loading — ограничиваем ожидание. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

async function videoInfo(wc) {
  if (!wc || wc.isDestroyed()) return null;
  try {
    const info = await withTimeout(
      wc.executeJavaScript(
        `(() => {
           if (window.__octoPip && typeof window.__octoPip.info === 'function') {
             return window.__octoPip.info();
           }
           const videos = [...document.querySelectorAll('video')];
           const visible = (el) => {
             const rect = el.getBoundingClientRect();
             return rect.width > 40 && rect.height > 40;
           };
           const video =
             videos.find((el) => visible(el) && !el.paused) ||
             videos.find((el) => visible(el)) ||
             videos[0];
           return video
             ? {
                 width: video.videoWidth || 0,
                 height: video.videoHeight || 0,
                 paused: Boolean(video.paused),
                 ended: Boolean(video.ended),
                 currentTime: Number(video.currentTime) || 0,
                 duration: Number.isFinite(video.duration) ? video.duration : 0,
               }
             : null;
         })()`,
        false,
      ),
      1500,
    );
    return info && typeof info === 'object' ? info : null;
  } catch {
    return null;
  }
}

function aspectOf(info) {
  const width = Number(info?.width) || 0;
  const height = Number(info?.height) || 0;
  return width > 0 && height > 0 ? width / height : 9 / 16;
}

/**
 * Таймкод и прогресс полосы PiP. Сайт не присылает timeupdate в main, поэтому,
 * пока PiP открыт, раз в полсекунды спрашиваем страницу о текущем ролике.
 */
async function pollStatus() {
  if (!ctx.pipActive) return;
  const info = await videoInfo(contents());
  if (!ctx.pipActive || !info) return;

  const time = Number(info.currentTime) || 0;
  const duration = Number(info.duration) || 0;
  const paused = Boolean(info.paused);
  const moved = Math.abs(time - ctx.pipTime) > 0.24 || duration !== ctx.pipDuration;
  const playingChanged = !paused !== ctx.playing;

  ctx.pipTime = time;
  ctx.pipDuration = duration;
  ctx.playing = !paused;

  if (!moved && !playingChanged) return;
  const now = Date.now();
  if (moved && now - lastStatusPush < 300) return;
  lastStatusPush = now;
  pushState();
}

function startStatus() {
  if (statusTimer) return;
  statusTimer = setInterval(pollStatus, STATUS_MS);
}

function stopStatus() {
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = null;
}

/** Размер окна под экран и пропорции текущего видео. */
function fitSize(info) {
  const win = ctx.win;
  if (!win) return { x: 0, y: 0, width: 360, height: 680 };

  const display = screen.getDisplayMatching(win.getBounds());
  const area = display.workArea;
  const aspect = aspectOf(info);
  const capWidth = aspect >= 1 ? 720 : 420;
  const maxWidth = Math.max(MIN_W, area.width * 0.4);
  const maxHeight = Math.max(MIN_H, area.height * 0.8);

  let width = Math.min(capWidth, maxWidth, (maxHeight - BAR_H) * aspect);
  width = Math.max(MIN_W, Math.round(width));
  let videoHeight = Math.round(width / aspect);

  if (videoHeight + BAR_H > maxHeight) {
    videoHeight = Math.max(MIN_H - BAR_H, Math.round(maxHeight - BAR_H));
    width = Math.max(MIN_W, Math.round(videoHeight * aspect));
  }

  const height = videoHeight + BAR_H;
  return {
    x: Math.round(area.x + area.width - width - MARGIN),
    y: Math.round(area.y + area.height - height - MARGIN),
    width,
    height,
  };
}

async function applyFit() {
  if (!ctx.pipActive || !ctx.win || ctx.win.isDestroyed()) return;
  const info = await videoInfo(contents());
  if (!ctx.pipActive || !ctx.win || ctx.win.isDestroyed()) return;
  ctx.win.setBounds(fitSize(info));
}

/** Пересчитать размер после смены видео, дисплея или настроек. */
function scheduleFit(delay = 350) {
  if (!ctx.pipActive || !ctx.pipAdaptive) return;
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    applyFit();
  }, delay);
}

function onDisplayChange() {
  if (!ctx.pipActive || !ctx.pipAdaptive || !ctx.win) return;
  applyFit();
}

function onWindowMoved() {
  if (!ctx.pipActive || !ctx.pipAdaptive || !ctx.win) return;
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    if (!ctx.win || ctx.win.isDestroyed()) return;
    const display = screen.getDisplayMatching(ctx.win.getBounds());
    if (display.id === lastDisplayId) return;
    lastDisplayId = display.id;
    applyFit();
  }, 250);
}

function attachWatchers() {
  if (displayWatchers) return;
  displayWatchers = true;
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  ctx.win?.on('moved', onWindowMoved);
}

function detachWatchers() {
  if (!displayWatchers) return;
  displayWatchers = false;
  screen.removeListener('display-metrics-changed', onDisplayChange);
  screen.removeListener('display-added', onDisplayChange);
  screen.removeListener('display-removed', onDisplayChange);
  ctx.win?.removeListener('moved', onWindowMoved);
}

function pageScript(auto) {
  return `(() => {
    try {
      if (window.__octoPip) {
        window.__octoPip.update({ auto: ${auto ? 'true' : 'false'} });
        return true;
      }

      const STAGE_ID = 'octo-pip-stage';
      const state = {
        active: false,
        auto: ${auto ? 'true' : 'false'},
        video: null,
        home: null,
        nextSibling: null,
        style: null,
        item: null,
        lastAdvance: 0,
        ticker: null,
        htmlOverflow: '',
        bodyOverflow: '',
      };

      const important = (el, styles) => {
        for (const [name, value] of Object.entries(styles)) {
          el.style.setProperty(name, value, 'important');
        }
      };

      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 40 || rect.height <= 40) return false;
        const style = getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        );
      };

      const videos = () => [...document.querySelectorAll('video')];

      /** Видео занимает заметную часть экрана: так отсекаем предзагрузку соседей. */
      const mostlyVisible = (video) => {
        if (!video || !video.isConnected) return false;
        const rect = video.getBoundingClientRect();
        const width = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
        const height = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
        if (width <= 0 || height <= 0) return false;
        return width * height >= innerWidth * innerHeight * 0.25;
      };

      /**
       * Звук должен идти только от ролика, который сейчас на экране.
       * Иначе сайт тихо доигрывает соседнее видео, и картинка в PiP
       * расходится со звуком.
       */
      const pauseOthers = (keep) => {
        for (const video of videos()) {
          if (video === keep) continue;
          try {
            video.pause();
          } catch (err) {
            /* элемент уже выгружен */
          }
        }
      };

      const activeVideo = () => {
        const list = videos();
        return (
          list.find((video) => !video.paused && visible(video)) ||
          list.find((video) => visible(video)) ||
          list[0] ||
          null
        );
      };

      const ensureStage = () => {
        let stage = document.getElementById(STAGE_ID);
        if (stage) return stage;
        stage = document.createElement('div');
        stage.id = STAGE_ID;
        important(stage, {
          position: 'fixed',
          inset: '0',
          'z-index': '2147483647',
          display: 'block',
          background: '#000',
          overflow: 'hidden',
          'pointer-events': 'auto',
        });
        document.documentElement.appendChild(stage);
        return stage;
      };

      const restoreVideo = (dropOrphan) => {
        const video = state.video;
        const home = state.home;
        if (video) {
          // Старое видео не должно продолжать звучать под новым.
          if (dropOrphan) {
            try {
              video.pause();
            } catch (err) {
              /* уже остановлено */
            }
          }
          if (state.style === null) video.removeAttribute('style');
          else video.setAttribute('style', state.style);

          if (home && home.isConnected) {
            try {
              home.insertBefore(
                video,
                state.nextSibling && state.nextSibling.parentNode === home
                  ? state.nextSibling
                  : null,
              );
            } catch (err) {
              home.appendChild(video);
            }
          } else if (!dropOrphan) {
            document.body.appendChild(video);
          } else if (video.parentNode) {
            video.parentNode.removeChild(video);
          }
        }
        state.video = null;
        state.home = null;
        state.nextSibling = null;
        state.style = null;
        state.item = null;
      };

      const fitVideo = (video) => {
        important(video, {
          position: 'absolute',
          inset: '0',
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          width: '100%',
          height: '100%',
          'max-width': 'none',
          'max-height': 'none',
          'min-width': '0',
          'min-height': '0',
          margin: '0',
          padding: '0',
          transform: 'none',
          'object-fit': 'contain',
          background: '#000',
          'z-index': '2147483647',
        });
      };

      const adopt = (video) => {
        if (!video) return;
        if (state.video === video) {
          // Сайт мог перерисовать контейнер и вынуть видео из сцены.
          const stage = ensureStage();
          if (video.parentNode !== stage) stage.appendChild(video);
          fitVideo(video);
          return;
        }

        if (state.video) restoreVideo(true);

        state.item =
          video.closest('[data-e2e="recommend-list-item-container"]') ||
          video.closest('article') ||
          null;
        state.video = video;
        state.home = video.parentNode;
        state.nextSibling = video.nextSibling;
        state.style = video.getAttribute('style');

        fitVideo(video);
        ensureStage().appendChild(video);
        pauseOthers(video);
      };

      const playActive = () => {
        const video = activeVideo();
        if (video && video.paused) video.play().catch(() => {});
      };

      const navigate = (direction, immediate = false) => {
        const now = Date.now();
        if (!immediate && now - state.lastAdvance < 1000) return false;
        state.lastAdvance = now;

        const next = direction === 'next';
        const selector = next
          ? '[data-e2e="feed-navigation-next"]'
          : '[data-e2e="feed-navigation-prev"]';
        const button = document.querySelector(selector);
        if (button) {
          button.click();
          setTimeout(playActive, 900);
          return true;
        }

        const key = next ? 'ArrowDown' : 'ArrowUp';
        const code = next ? 40 : 38;
        for (const target of [document, window]) {
          target.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              code: key,
              keyCode: code,
              which: code,
              bubbles: true,
              cancelable: true,
            }),
          );
        }

        const items = [
          ...document.querySelectorAll('[data-e2e="recommend-list-item-container"], article'),
        ];
        const index = state.item ? items.indexOf(state.item) : -1;
        const item = index >= 0 ? items[index + (next ? 1 : -1)] : null;
        if (item) {
          item.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(playActive, 900);
          return true;
        }

        window.scrollBy({
          top: next ? window.innerHeight : -window.innerHeight,
          behavior: 'smooth',
        });
        setTimeout(playActive, 900);
        return false;
      };

      const onPlay = (event) => {
        const video = event.target;
        if (!state.active || !(video instanceof HTMLVideoElement)) return;

        // Новый ролик зазвучал раньше, чем мы успели переставить кадр:
        // сразу глушим старый, иначе секунду звучат оба.
        if (
          video !== state.video &&
          !video.muted &&
          state.video &&
          !state.video.paused
        ) {
          try {
            state.video.pause();
          } catch (err) {
            /* элемент уже выгружен */
          }
        }

        setTimeout(() => {
          if (!state.active || !video.isConnected || video.paused) return;

          // Сайт начал играть новый ролик. Берём именно его, а не висящее
          // в сцене старое видео: иначе картинка и звук разъезжаются.
          if (video !== state.video) {
            // Тихая предзагрузка соседнего ролика не должна перебивать кадр.
            if (video.muted && !mostlyVisible(video) && state.video && !state.video.paused) {
              try {
                video.pause();
              } catch (err) {
                /* элемент уже выгружен */
              }
              return;
            }
            adopt(video);
          } else {
            fitVideo(video);
          }
        }, 80);
      };

      const onEnded = (event) => {
        const video = event.target;
        if (!state.active || !state.auto) return;
        if (!(video instanceof HTMLVideoElement) || video.loop) return;

        const href = location.href;
        const src = video.currentSrc;
        setTimeout(() => {
          if (!state.active || !state.auto) return;
          if (Date.now() - state.lastAdvance < 1400) return;
          if (location.href !== href) return;

          const current = activeVideo();
          // Сайт уже сам переключил видео — не прыгаем через одно.
          if (current && current !== video) return;
          if (current === video && !video.paused) return;
          if (src && current && current.currentSrc && current.currentSrc !== src && !current.paused) {
            return;
          }

          navigate('next');
        }, 900);
      };

      const tick = () => {
        if (!state.active) return;

        const current = state.video;
        if (!current || !current.isConnected) {
          const video = activeVideo();
          if (video) adopt(video);
          return;
        }

        // Сайт переключил ленту, а наше видео осталось на паузе: показываем
        // ролик, который реально играет и звучит, иначе картинка отстаёт.
        if (current.paused || current.ended) {
          const playing = videos().find(
            (video) =>
              video !== current &&
              video.isConnected &&
              !video.paused &&
              !video.ended &&
              (!video.muted || mostlyVisible(video)),
          );
          if (playing) {
            adopt(playing);
            return;
          }
        }

        const stage = ensureStage();
        if (current.parentNode !== stage) {
          stage.appendChild(current);
          fitVideo(current);
        }
      };

      const activate = () => {
        if (state.active) return;
        state.active = true;

        state.htmlOverflow = document.documentElement.style.getPropertyValue('overflow');
        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
        if (document.body) {
          state.bodyOverflow = document.body.style.getPropertyValue('overflow');
          document.body.style.setProperty('overflow', 'hidden', 'important');
        }

        document.addEventListener('play', onPlay, true);
        document.addEventListener('loadedmetadata', onPlay, true);
        document.addEventListener('ended', onEnded, true);

        state.ticker = setInterval(tick, 700);
        adopt(activeVideo());
      };

      const stop = () => {
        state.active = false;
        clearInterval(state.ticker);
        state.ticker = null;

        document.removeEventListener('play', onPlay, true);
        document.removeEventListener('loadedmetadata', onPlay, true);
        document.removeEventListener('ended', onEnded, true);

        restoreVideo(false);
        const stage = document.getElementById(STAGE_ID);
        if (stage) stage.remove();

        if (state.htmlOverflow) {
          document.documentElement.style.setProperty('overflow', state.htmlOverflow);
        } else {
          document.documentElement.style.removeProperty('overflow');
        }
        if (document.body) {
          if (state.bodyOverflow) {
            document.body.style.setProperty('overflow', state.bodyOverflow);
          } else {
            document.body.style.removeProperty('overflow');
          }
        }

        delete window.__octoPip;
      };

      window.__octoPip = {
        update(configuration = {}) {
          if (typeof configuration.auto === 'boolean') state.auto = configuration.auto;
          activate();
        },
        detach: stop,
        next: () => navigate('next', true),
        prev: () => navigate('prev', true),
        playPause() {
          const video = state.video || activeVideo();
          if (!video) return;
          if (video.paused) video.play().catch(() => {});
          else video.pause();
        },
        seek(seconds) {
          const video = state.video || activeVideo();
          if (!video) return false;
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          const target = Math.max(0, Number(seconds) || 0);
          try {
            video.currentTime = duration > 0 ? Math.min(duration, target) : target;
          } catch (err) {
            return false;
          }
          return true;
        },
        nudge(delta) {
          const video = state.video || activeVideo();
          if (!video) return false;
          return window.__octoPip.seek((Number(video.currentTime) || 0) + (Number(delta) || 0));
        },
        info() {
          const video = state.video || activeVideo();
          if (!video) return null;
          return {
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
            paused: Boolean(video.paused),
            ended: Boolean(video.ended),
            currentTime: Number(video.currentTime) || 0,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
          };
        },
      };

      activate();
      return true;
    } catch (err) {
      return false;
    }
  })()`;
}

function applyPage(active) {
  const wc = contents();
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [
    active ? pageScript(ctx.pipAuto) : 'window.__octoPip && window.__octoPip.detach()',
  ]);
}

/** dom-ready после полной навигации: страничный скрипт нужно вернуть. */
function reapply() {
  if (ctx.pipActive) applyPage(true);
}

async function enter() {
  if (!ctx.win || ctx.win.isDestroyed() || ctx.pipActive || entering) return;

  const wc = contents();
  if (!wc || wc.isDestroyed()) return;

  entering = true;
  const info = await videoInfo(wc);
  if (!info) {
    entering = false;
    toast('На странице нет видео');
    return;
  }

  const win = ctx.win;
  if (!win || win.isDestroyed()) {
    entering = false;
    return;
  }

  if (ctx.htmlFullscreen) {
    wc.executeJavaScript(
      'document.exitFullscreen && document.exitFullscreen().catch(() => {})',
      false,
    ).catch(() => {});
    ctx.htmlFullscreen = false;
  }

  // Если сайт успел открыть системный PiP, закрываем его: у нас свой плеер.
  wc.executeJavaScript(
    'document.exitPictureInPicture && document.exitPictureInPicture().catch(() => {})',
    false,
  ).catch(() => {});

  setPanelOpen(false, { persist: false });
  setPaletteOpen(false);
  find.close({ focusView: false });
  // Панель закрыта — дата ролика больше не нужна.
  require('./player').watchPanel(false);
  if (!ctx.adsInPip) require('./ads').suspend();

  normal = {
    bounds: win.getNormalBounds(),
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen(),
    alwaysOnTop: win.isAlwaysOnTop(),
    visible: win.isVisible(),
    minimized: win.isMinimized(),
  };

  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  ctx.pipActive = true;
  ctx.chromeHeight = BAR_H;
  win.setMinimumSize(MIN_W, MIN_H);
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* платформа не поддерживает */
    }
  }

  const bounds = fitSize(info);
  win.setBounds(bounds);
  layout();
  lastDisplayId = screen.getDisplayMatching(bounds).id;
  attachWatchers();

  ctx.pipTime = Number(info.currentTime) || 0;
  ctx.pipDuration = Number(info.duration) || 0;
  lastStatusPush = 0;
  startStatus();

  applyPage(true);

  win.show();
  win.focus();
  wc.focus();

  entering = false;
  pushState();
  refreshTrayMenu();
  toast('Картинка в картинке включена');
}

function exit({ silent = false, restore = true } = {}) {
  entering = false;
  if (!ctx.pipActive) return;

  const saved = normal;
  ctx.pipActive = false;
  clearTimeout(fitTimer);
  clearTimeout(moveTimer);
  fitTimer = null;
  moveTimer = null;
  stopStatus();
  ctx.pipTime = 0;
  ctx.pipDuration = 0;

  applyPage(false);
  detachWatchers();
  // Возвращаем страничный скрипт рекламы, если его снимали на время PiP.
  require('./ads').apply();

  if (ctx.win && !ctx.win.isDestroyed()) {
    const win = ctx.win;
    win.setSkipTaskbar(false);
    win.setMinimumSize(NORMAL_MIN_W, NORMAL_MIN_H);
    win.setAlwaysOnTop(saved ? saved.alwaysOnTop : false);
    if (process.platform === 'darwin') {
      try {
        win.setWindowButtonVisibility(true);
      } catch {
        /* платформа не поддерживает */
      }
    }

    if (restore && saved) {
      if (saved.fullscreen) {
        win.setFullScreen(true);
      } else if (saved.maximized) {
        win.maximize();
      } else {
        win.setBounds(saved.bounds);
      }
    }

    ctx.chromeHeight = TITLEBAR_H;
    layout();

    if (saved && saved.minimized) {
      win.minimize();
    } else if (saved && !saved.visible) {
      win.hide();
    } else {
      win.show();
      win.focus();
      contents()?.focus();
    }
  }

  normal = null;
  pushState();
  refreshTrayMenu();
  if (!silent) toast('Картинка в картинке выключена');
}

function toggle() {
  if (ctx.pipActive) exit();
  else enter();
}

function next() {
  const wc = contents();
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [
    `(() => {
       if (window.__octoPip) {
         window.__octoPip.next();
         return;
       }
       const button = document.querySelector('[data-e2e="feed-navigation-next"]');
       if (button) {
         button.click();
         return;
       }
       for (const target of [document, window]) {
         target.dispatchEvent(new KeyboardEvent('keydown', {
           key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40,
           bubbles: true, cancelable: true,
         }));
       }
     })()`,
  ]);
  scheduleFit(1200);
}

function prev() {
  const wc = contents();
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [
    `(() => {
       if (window.__octoPip) {
         window.__octoPip.prev();
         return;
       }
       const button = document.querySelector('[data-e2e="feed-navigation-prev"]');
       if (button) {
         button.click();
         return;
       }
       for (const target of [document, window]) {
         target.dispatchEvent(new KeyboardEvent('keydown', {
           key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38,
           bubbles: true, cancelable: true,
         }));
       }
     })()`,
  ]);
  scheduleFit(1200);
}

/** Перемотка внутри текущего ролика: значение в секундах. */
function seek(seconds) {
  const wc = contents();
  if (!wc || wc.isDestroyed()) return;
  const value = Math.max(0, Number(seconds) || 0);
  evalInPage(wc, [`window.__octoPip && window.__octoPip.seek(${value})`]);
  ctx.pipTime = value;
  pushState();
}

/** «−10 секунд» в полосе PiP. */
function nudge(delta) {
  const wc = contents();
  if (!wc || wc.isDestroyed()) return;
  const step = Number(delta) || 0;
  evalInPage(wc, [`window.__octoPip && window.__octoPip.nudge(${step})`]);
  ctx.pipTime = Math.max(0, ctx.pipTime + step);
  pushState();
}

function toggleAuto() {
  ctx.pipAuto = !ctx.pipAuto;
  save({ auto: ctx.pipAuto });
  const wc = contents();
  if (ctx.pipActive && wc && !wc.isDestroyed()) {
    evalInPage(wc, [
      `window.__octoPip && window.__octoPip.update({ auto: ${ctx.pipAuto ? 'true' : 'false'} })`,
    ]);
  }
  toast(ctx.pipAuto ? 'Автолистание включено' : 'Автолистание выключено');
  pushState();
}

function toggleAdaptive() {
  ctx.pipAdaptive = !ctx.pipAdaptive;
  save({ adaptive: ctx.pipAdaptive });

  if (ctx.pipActive) {
    if (ctx.pipAdaptive) applyFit();
    else {
      clearTimeout(fitTimer);
      fitTimer = null;
    }
  }

  toast(ctx.pipAdaptive ? 'Адаптивный режим включён' : 'Адаптивный режим выключен');
  pushState();
}

/** Пользователь переключил «поверх всех» уже внутри PiP. */
function setRestoreOnTop(value) {
  if (normal) normal.alwaysOnTop = Boolean(value);
}

/** Геометрия до PiP — чтобы закрытие окна не сохранило крошечные размеры. */
function savedGeometry() {
  if (!ctx.pipActive || !normal) return null;
  return { bounds: normal.bounds, maximized: normal.maximized };
}

/** Окно закрывается: снимаем режим без попыток что-то восстановить. */
function reset() {
  ctx.pipActive = false;
  entering = false;
  normal = null;
  clearTimeout(fitTimer);
  clearTimeout(moveTimer);
  fitTimer = null;
  moveTimer = null;
  stopStatus();
  ctx.pipTime = 0;
  ctx.pipDuration = 0;
  detachWatchers();
}

sync();

module.exports = {
  enter,
  exit,
  toggle,
  next,
  prev,
  seek,
  nudge,
  toggleAuto,
  toggleAdaptive,
  reapply,
  scheduleFit,
  savedGeometry,
  setRestoreOnTop,
  reset,
};
