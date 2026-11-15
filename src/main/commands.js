'use strict';

const { app } = require('electron');
const { ctx, pushState, toast, stepHistory } = require('./app-context');
const { writeState } = require('./store');
const { HOME_URL } = require('./shared');
const { refreshTrayMenu } = require('./tray');
const find = require('./find');

// Ступени масштаба как в браузерах.
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function viewContents() {
  return ctx.view?.webContents ?? null;
}

function zoomBy(direction) {
  const wc = viewContents();
  if (!wc) return;
  const current = wc.getZoomFactor();

  // Chromium-подобные ступени: 100 → 110 → 125 → 150 …
  let nearest = 0;
  let best = Infinity;
  ZOOM_STEPS.forEach((step, index) => {
    const distance = Math.abs(step - current);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  });

  const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, nearest + direction));
  applyZoom(ZOOM_STEPS[next]);
}

function applyZoom(factor) {
  const wc = viewContents();
  if (!wc) return;
  const clamped = Math.min(3, Math.max(0.5, factor));
  wc.setZoomFactor(clamped);
  writeState({ zoomFactor: clamped });
  pushState();
  toast(`Масштаб: ${Math.round(clamped * 100)}%`);
}

async function togglePip() {
  const wc = viewContents();
  if (!wc) return;

  try {
    // requestPictureInPicture может «зависнуть» на некоторых Wayland-сборках —
    // поэтому не ждём бесконечно.
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 3000));

    const result = await Promise.race([
      wc.executeJavaScript(
        `(async () => {
           const v = document.querySelector('video');
           if (!v) return 'none';
           try {
             if (document.pictureInPictureElement) {
               await document.exitPictureInPicture();
               return 'off';
             }
             await v.requestPictureInPicture();
             return 'on';
           } catch (err) { return 'error'; }
         })()`,
        true, // userGesture: без него requestPictureInPicture отклоняется
      ),
      timeout,
    ]);

    if (result === 'on') ctx.pipActive = true;
    if (result === 'off') ctx.pipActive = false;

    toast(
      result === 'on'
        ? 'Картинка в картинке включена'
        : result === 'off'
          ? 'Картинка в картинке выключена'
          : result === 'none'
            ? 'На странице нет видео'
            : 'PiP недоступен',
    );
  } catch {
    toast('PiP недоступен');
  }
  refreshTrayMenu();
  pushState();
}

/**
 * PiP можно закрыть из плавающего окна, о котором main-процесс не узнаёт.
 * Поэтому при возврате фокуса сверяемся с самой страницей.
 */
async function refreshPipState() {
  const wc = viewContents();
  if (!wc) return;
  try {
    const active = await wc.executeJavaScript('Boolean(document.pictureInPictureElement)', false);
    if (active !== ctx.pipActive) {
      ctx.pipActive = active;
      pushState();
      refreshTrayMenu();
    }
  } catch {
    /* страница ещё загружается — не страшно */
  }
}

async function togglePlayback() {
  const wc = viewContents();
  if (!wc) return;
  try {
    await wc.executeJavaScript(
      `(() => {
         const v = document.querySelector('video');
         if (!v) return 'none';
         if (v.paused) { v.play(); return 'playing'; }
         v.pause();
         return 'paused';
       })()`,
      true,
    );
    pushState();
  } catch {
    /* нет видео на странице */
  }
}

function handleCommand(command) {
  if (!ctx.win || !ctx.view) return;
  const wc = ctx.view.webContents;

  switch (command) {
    case 'back':
      stepHistory(-1);
      break;
    case 'forward':
      stepHistory(1);
      break;
    case 'reload':
      if (wc.isLoading()) wc.stop();
      else wc.reload();
      break;
    case 'hardReload':
      wc.reloadIgnoringCache();
      break;
    case 'home':
      find.close({ focusView: false });
      wc.loadURL(HOME_URL);
      break;
    case 'minimize':
      ctx.win.minimize();
      break;
    case 'maximize':
      ctx.win.isMaximized() ? ctx.win.unmaximize() : ctx.win.maximize();
      break;
    case 'close':
      ctx.win.close();
      break;
    case 'quit':
      ctx.quitting = true;
      app.quit();
      break;
    case 'pip':
      togglePip();
      break;
    case 'togglePlayback':
      togglePlayback();
      break;
    case 'mute': {
      const next = !wc.isAudioMuted();
      wc.setAudioMuted(next);
      toast(next ? 'Звук выключен' : 'Звук включён');
      refreshTrayMenu();
      break;
    }
    case 'onTop': {
      const next = !ctx.win.isAlwaysOnTop();
      ctx.win.setAlwaysOnTop(next, 'floating');
      writeState({ alwaysOnTop: next });
      toast(next ? 'Поверх всех окон' : 'Обычное окно');
      refreshTrayMenu();
      break;
    }
    case 'zoomIn':
      zoomBy(1);
      break;
    case 'zoomOut':
      zoomBy(-1);
      break;
    case 'zoomReset':
      applyZoom(1);
      break;
    case 'devtools':
      wc.toggleDevTools();
      break;
    case 'fullscreen':
      ctx.win.setFullScreen(!ctx.win.isFullScreen());
      break;
    case 'find':
      find.open();
      break;
    case 'findNext':
      find.next();
      break;
    case 'findPrev':
      find.prev();
      break;
    case 'findClose':
      find.close();
      break;
    default:
      break;
  }
  pushState();
}

module.exports = { handleCommand, refreshPipState };
