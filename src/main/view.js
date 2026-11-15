'use strict';

const { WebContentsView, session } = require('electron');
const {
  HOME_URL,
  PARTITION,
  CHROME_UA,
  REGION_PRELOAD,
  isTikTokUrl,
  isAuthUrl,
  isInternalUrl,
  parseUnreadCount,
} = require('./shared');
const { ctx, layout, pushState, toast, setUnread, setPanelOpen } = require('./app-context');
const { prepareSession } = require('./session');
const { readState, writeState } = require('./store');
const { openExternal } = require('./links');
const { attachContextMenu } = require('./menu');
const { handleShortcut } = require('./shortcuts');
const cosmetics = require('./cosmetics');
const ads = require('./ads');
const player = require('./player');
const media = require('./media');
const pip = require('./pip');
const mpris = require('./mpris');
const find = require('./find');

/** Окно OAuth: то же persistent-хранилище, но без Node и preload. */
function authWindowOptions() {
  return {
    width: 520,
    height: 760,
    parent: ctx.win ?? undefined,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      session: session.fromPartition(PARTITION),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

function startUrl() {
  const saved = readState();
  // В тестах и при явном OCTO_HOME_URL не восстанавливаем прошлую страницу.
  if (process.env.OCTO_HOME_URL) return HOME_URL;
  if (saved.restoreSession === false) return HOME_URL;
  return isTikTokUrl(saved.lastUrl) ? saved.lastUrl : HOME_URL;
}

function createView() {
  if (!ctx.win) return;

  const ses = prepareSession();
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // Свёрнутое или перекрытое окно не должно замедлять таймеры и видео:
      // иначе ролик замирает и сайт об этом не узнаёт.
      backgroundThrottling: false,
      // Свои preload в контент TikTok не подключаем: страница недоверенная.
      // Единственное исключение — подмена региона: preload ничего не отдаёт
      // странице, contextIsolation и sandbox остаются включёнными.
      preload: REGION_PRELOAD,
    },
  });

  ctx.view = view;
  ctx.win.contentView.addChildView(view);

  const wc = view.webContents;
  wc.setUserAgent(CHROME_UA);
  // Непрозрачный фон: полупрозрачный WebContentsView на Linux заставляет
  // композитор собирать видео через лишний слой и кадры могут «застыть».
  view.setBackgroundColor('#000000');
  wc.setZoomFactor(readState().zoomFactor ?? 1);

  // --- Навигация: внутри приложения только TikTok и OAuth --------------------
  wc.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  wc.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame || isInternalUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  wc.setWindowOpenHandler(({ url }) => {
    // Внутренние ссылки TikTok с target=_blank открываем в том же окне.
    if (isTikTokUrl(url)) {
      wc.loadURL(url);
      return { action: 'deny' };
    }
    // Окна OAuth (Google/Apple/Facebook/X) — нативные popup'ы поверх приложения.
    if (isAuthUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: authWindowOptions() };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  // --- Состояние -----------------------------------------------------------
  const refresh = () => pushState();
  for (const event of [
    'did-start-loading',
    'did-stop-loading',
    'did-navigate',
    'did-navigate-in-page',
    'page-title-updated',
  ]) {
    wc.on(event, refresh);
  }

  let lastUrlTimer = null;
  const rememberUrl = (url) => {
    if (!isTikTokUrl(url)) return;
    clearTimeout(lastUrlTimer);
    // SPA меняет URL на каждом видео — не пишем на диск на каждый скролл.
    lastUrlTimer = setTimeout(() => writeState({ lastUrl: url }), 1500);
  };

  wc.on('did-navigate', () => {
    ctx.playing = false;
    find.resetOnNavigate();
    rememberUrl(wc.getURL());
    mpris.setPlaying(false);
    mpris.scheduleMetadata(1200);
    pushState();
  });

  wc.on('did-navigate-in-page', () => {
    rememberUrl(wc.getURL());
    mpris.scheduleMetadata();
  });

  wc.on('media-started-playing', () => {
    ctx.playing = true;
    mpris.setPlaying(true);
    mpris.scheduleMetadata(400);
    // Новое видео может быть другим по пропорциям — адаптивный PiP подстроится.
    pip.scheduleFit(600);
    pushState();
  });

  wc.on('media-paused', () => {
    ctx.playing = false;
    mpris.setPlaying(false);
    pushState();
  });

  wc.on('page-title-updated', (_event, title) => {
    setUnread(parseUnreadCount(title));
    mpris.setTitle(title);
  });

  // --- Ошибки загрузки: повтор с backoff, без бесконечного цикла -----------
  let loadFailures = 0;
  let crashCount = 0;
  let retryTimer = null;
  let crashTimer = null;

  wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* ERR_ABORTED */) return;
    if (process.env.OCTO_E2E) return;

    loadFailures += 1;
    if (loadFailures > 3) {
      toast('Не удалось загрузить — нажмите ⟳ для повтора');
      return;
    }

    const delay = 1200 * 2 ** (loadFailures - 1);
    toast(`Нет соединения, повтор через ${Math.round(delay / 1000)} с…`);
    if (process.env.OCTO_DEBUG) console.warn('[octo] load failed', code, description, url);

    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!wc.isDestroyed()) wc.reload();
    }, delay);
  });

  wc.on('render-process-gone', (_event, details) => {
    console.error('[octo] renderer gone:', details.reason);
    // Штатное завершение рендерера (закрытие окна) перезагружать не нужно.
    if (details.reason === 'clean-exit' || process.env.OCTO_E2E) return;

    crashCount += 1;
    if (crashCount > 3) {
      toast('Страница падает повторно. Перезапустите приложение.');
      return;
    }

    toast('Страница упала, перезагружаю…');
    clearTimeout(crashTimer);
    crashTimer = setTimeout(() => {
      if (!wc.isDestroyed()) wc.reload();
    }, 800 * crashCount);
  });

  wc.on('did-finish-load', () => {
    loadFailures = 0;
    crashCount = 0;
    pushState();
  });

  // Зависший рендерер: звук из медиа-пайплайна может ещё играть, но страница
  // уже не отвечает и не перерисовывается. Если сама не очнётся — перезапускаем
  // её, иначе приложение остаётся с «застывшим» кадром навсегда.
  let hangTimer = null;
  let lastHangReload = 0;

  wc.on('unresponsive', () => {
    toast('Страница не отвечает…');
    clearTimeout(hangTimer);
    hangTimer = setTimeout(() => {
      if (wc.isDestroyed()) return;
      const now = Date.now();
      if (now - lastHangReload < 120000) return;
      lastHangReload = now;
      toast('Перезапускаю зависшую страницу…');
      wc.reload();
    }, 12000);
  });
  wc.on('responsive', () => {
    clearTimeout(hangTimer);
    hangTimer = null;
  });

  // --- Косметика: промо, скроллбары, лишние разделы ------------------------
  wc.on('dom-ready', () => {
    cosmetics.apply();
    player.apply();
    media.apply();
    pip.reapply();
    ads.apply();
    // Промо в сайдбаре иногда дорисовывается позже — просканируем ещё раз.
    cosmetics.schedule(3000);
  });
  wc.on('did-navigate-in-page', () => cosmetics.scheduleScripts());
  wc.on('did-stop-loading', () => cosmetics.schedule(600));

  // --- Поиск по странице ---------------------------------------------------
  wc.on('found-in-page', (_event, result) => find.onFound(result));

  // --- Полноэкранное видео --------------------------------------------------
  wc.on('enter-html-full-screen', () => {
    ctx.htmlFullscreen = true;
    // Панель сбоку не должна мешать видео на весь экран.
    setPanelOpen(false, { persist: false });
    layout();
    pushState();
  });
  wc.on('leave-html-full-screen', () => {
    ctx.htmlFullscreen = false;
    layout();
    pushState();
  });

  wc.on('before-input-event', handleShortcut);
  attachContextMenu(wc);

  layout();
  wc.loadURL(startUrl());
}

module.exports = { createView, authWindowOptions };
