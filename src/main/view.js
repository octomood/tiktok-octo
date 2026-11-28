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
const {
  ctx,
  layout,
  pushState,
  toast,
  setUnread,
  setPanelOpen,
  syncViewVisibility,
  applyWelcomeAudio,
} = require('./app-context');
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
const fullscreenNav = require('./fullscreen-nav');
const feedKeys = require('./feed-keys');
const qr = require('./qr');
const stats = require('./stats');
const focus = require('./focus');
const filters = require('./filters');
const customCode = require('./custom-code');
const mpris = require('./mpris');
const find = require('./find');
const plugins = require('./plugins');
const region = require('./region');
const autoTheme = require('./auto-theme');
const chat = require('./chat');
const resilience = require('./resilience');
const windowsMedia = require('./windows-media');
const profiles = require('./profiles');
const history = require('./history');

/** Окно OAuth: то же persistent-хранилище, без системной рамки, Node и preload. */
function authWindowOptions() {
  return {
    width: 520,
    height: 760,
    parent: ctx.win ?? undefined,
    frame: false,
    autoHideMenuBar: true,
    minimizable: false,
    maximizable: false,
    backgroundColor: ctx.themeTokens?.surface || '#191624',
    webPreferences: {
      session: session.fromPartition(profiles.activePartition() || PARTITION),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

function attachOAuthChrome(childWin) {
  if (!childWin || childWin.isDestroyed()) return;
  try {
    childWin.setMenuBarVisibility(false);
  } catch {
    /* окно закрывается */
  }
  const cwc = childWin.webContents;
  if (!cwc || cwc.isDestroyed()) return;

  cwc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape' && !input.control && !input.meta && !input.alt) {
      event.preventDefault();
      childWin.close();
      return;
    }
    if ((input.control || input.meta) && !input.alt && input.key?.toLowerCase() === 'w') {
      event.preventDefault();
      childWin.close();
    }
  });

  const injectBar = () => {
    if (childWin.isDestroyed() || cwc.isDestroyed()) return;
    const tokens = ctx.themeTokens || {};
    const bg = tokens.surfaceContainerLow || '#211d30';
    const fg = tokens.onSurface || '#ddd2e0';
    const muted = tokens.onSurfaceVariant || '#b8aec8';
    const border = tokens.outlineVariant || '#47405e';
    const errBg = tokens.errorContainer || '#601410';
    const errFg = tokens.onErrorContainer || '#f9dedc';
    const css = `
      html { padding-top: 34px !important; }
      #octo-oauth-bar {
        position: fixed !important;
        inset: 0 0 auto 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        height: 34px !important;
        padding: 0 6px 0 12px !important;
        background: ${bg} !important;
        color: ${fg} !important;
        border-bottom: 1px solid ${border} !important;
        font: 600 12px/1 'Inter', system-ui, sans-serif !important;
        user-select: none !important;
        -webkit-app-region: drag !important;
        box-sizing: border-box !important;
      }
      #octo-oauth-bar-title {
        overflow: hidden !important;
        color: ${muted} !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
      }
      #octo-oauth-bar-close {
        display: grid !important;
        place-items: center !important;
        width: 26px !important;
        height: 24px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 9999px !important;
        background: transparent !important;
        color: ${muted} !important;
        cursor: pointer !important;
        -webkit-app-region: no-drag !important;
      }
      #octo-oauth-bar-close:hover {
        background: ${errBg} !important;
        color: ${errFg} !important;
      }
    `;
    cwc.insertCSS(css, { cssOrigin: 'user' }).catch(() => {});
    const hostText = (() => {
      try {
        return new URL(cwc.getURL()).hostname || 'Вход';
      } catch {
        return 'Вход';
      }
    })();
    cwc
      .executeJavaScript(
        `(() => {
          const root = document.documentElement;
          if (!root) return;
          let bar = document.getElementById('octo-oauth-bar');
          if (!bar) {
            bar = document.createElement('div');
            bar.id = 'octo-oauth-bar';
            const title = document.createElement('span');
            title.id = 'octo-oauth-bar-title';
            const btn = document.createElement('button');
            btn.id = 'octo-oauth-bar-close';
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Закрыть');
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 20 20');
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.7');
            svg.setAttribute('stroke-linecap', 'round');
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', 'M6.4 6.4l7.2 7.2M13.6 6.4l-7.2 7.2');
            svg.appendChild(p);
            btn.appendChild(svg);
            btn.addEventListener('click', () => window.close());
            bar.append(title, btn);
            root.appendChild(bar);
          }
          const titleEl = document.getElementById('octo-oauth-bar-title');
          if (titleEl) titleEl.textContent = ${JSON.stringify(hostText)};
        })()`,
        false,
      )
      .catch(() => {});
  };

  cwc.on('dom-ready', injectBar);
  cwc.on('did-navigate', injectBar);
  cwc.on('did-navigate-in-page', injectBar);
}

function startUrl() {
  if (resilience.isSafeMode()) return HOME_URL;
  const saved = readState();
  // В тестах и при явном OCTO_HOME_URL не восстанавливаем прошлую страницу.
  if (process.env.OCTO_HOME_URL) return HOME_URL;
  if (saved.restoreSession === false) return HOME_URL;
  return isTikTokUrl(saved.lastUrl) ? saved.lastUrl : HOME_URL;
}

function createView(urlOverride) {
  if (!ctx.win) return;

  const ses = prepareSession(profiles.activePartition());
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
  // Окно пересоздали, пока открыт мастер: новый view тоже должен молчать.
  if (ctx.welcome.open) applyWelcomeAudio(true, wc);
  const setOffline = (next) => {
    const value = Boolean(next);
    if (ctx.offline === value) return;
    ctx.offline = value;
    syncViewVisibility();
    pushState();
  };
  const setViewLoading = (next) => {
    const value = Boolean(next);
    if (ctx.viewLoading === value) return;
    ctx.viewLoading = value;
    syncViewVisibility();
    pushState();
  };
  setViewLoading(true);

  wc.setUserAgent(CHROME_UA);
  // Непрозрачный фон: полупрозрачный WebContentsView на Linux заставляет
  // композитор собирать видео через лишний слой и кадры могут «застыть».
  view.setBackgroundColor('#000000');
  wc.setZoomFactor(readState().zoomFactor ?? 1);

  // --- Навигация: внутри приложения только TikTok и OAuth --------------------
  wc.on('will-navigate', (event, url) => {
    // «Сообщения» живут в панели: не отдаём им всё окно, даже если клик
    // проскочил мимо перехватчика в странице.
    if (chat.interceptNavigation(url, wc.getURL())) {
      event.preventDefault();
      return;
    }
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
    // Окна OAuth (Google/Apple/Facebook/X) — безрамочные popup'ы поверх приложения.
    if (isAuthUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: authWindowOptions() };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-create-window', (childWin) => attachOAuthChrome(childWin));

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

  // Предыдущий адрес нужен, чтобы отличить переход на сообщения из ленты от
  // внутреннего перехода уже открытой страницы сообщений.
  let lastUrl = wc.getURL();

  let lastUrlTimer = null;
  const rememberUrl = (url) => {
    if (!isTikTokUrl(url)) return;
    clearTimeout(lastUrlTimer);
    // SPA меняет URL на каждом видео — не пишем на диск на каждый скролл.
    lastUrlTimer = setTimeout(() => writeState({ lastUrl: url }), 1500);
  };

  wc.on('did-navigate', () => {
    const previousUrl = lastUrl;
    lastUrl = wc.getURL();
    ctx.playing = false;
    // Ссылка сменилась — старый QR-код показывал бы чужую страницу.
    qr.clear();
    player.clearAbLoop({ silent: true });
    find.resetOnNavigate();
    rememberUrl(wc.getURL());
    stats.noteVideo(wc.getURL());
    history.noteVideo(wc.getURL(), wc.getTitle());
    mpris.setPlaying(false);
    mpris.scheduleMetadata(1200);
    pushState();
    // Восстановленная сессия могла закончиться на /messages: показываем чат
    // панелью и возвращаем ленту вместо страницы на всё окно.
    if (chat.interceptNavigation(wc.getURL(), previousUrl)) {
      wc.loadURL(HOME_URL).catch(() => {});
    }
  });

  wc.on('did-navigate-in-page', () => {
    const previousUrl = lastUrl;
    const currentUrl = wc.getURL();
    lastUrl = currentUrl;
    // SPA сменила ролик: старый QR показывал бы чужую ссылку.
    if (qr.clear()) pushState();
    player.clearAbLoop({ silent: true });
    rememberUrl(currentUrl);
    stats.noteVideo(currentUrl);
    history.noteVideo(currentUrl, wc.getTitle());
    mpris.scheduleMetadata();
    // SPA-роутер мог успеть уйти на страницу сообщений. Возвращаем ленту:
    // переписка уже открыта панелью слева.
    if (!chat.interceptNavigation(currentUrl, previousUrl)) return;
    try {
      const history = wc.navigationHistory;
      const index = history.getActiveIndex();
      if (index > 0) history.goToIndex(index - 1);
      else wc.loadURL(HOME_URL);
    } catch {
      /* история недоступна — панель всё равно открыта */
    }
  });

  wc.on('media-started-playing', () => {
    ctx.playing = true;
    windowsMedia.setPlaying(true);
    mpris.setPlaying(true);
    mpris.scheduleMetadata(400);
    // Новое видео может быть другим по пропорциям — адаптивный PiP подстроится.
    pip.scheduleFit(600);
    pushState();
    plugins.onPlaybackChange();
  });

  wc.on('media-paused', () => {
    ctx.playing = false;
    windowsMedia.setPlaying(false);
    mpris.setPlaying(false);
    pushState();
    plugins.onPlaybackChange();
  });

  wc.on('page-title-updated', (_event, title) => {
    setUnread(parseUnreadCount(title));
    mpris.setTitle(title);
    history.updateTitle(wc.getURL(), title);
  });

  // --- Ошибки загрузки: повтор с backoff, без бесконечного цикла -----------
  let loadFailures = 0;
  let loadFailed = false;
  let crashCount = 0;
  let retryTimer = null;
  let crashTimer = null;

  wc.on('did-start-navigation', (details) => {
    if (details && details.isMainFrame && !details.isSameDocument) {
      setViewLoading(true);
    }
  });

  wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;
    setViewLoading(false);
    if (code === -3 /* ERR_ABORTED */) return;

    loadFailed = true;
    setOffline(true);
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
    // did-finish-load приходит и после сетевой ошибки, когда документ пустой.
    // В этом случае оставляем свой экран и не сбрасываем счётчик повторов.
    if (loadFailed) {
      wc.executeJavaScript(
        '!document.body || (document.body.childElementCount === 0 && !document.body.innerText.trim())',
        true,
      )
        .then((empty) => {
          setViewLoading(false);
          if (empty) {
            setOffline(true);
            return;
          }
          loadFailed = false;
          loadFailures = 0;
          crashCount = 0;
          setOffline(false);
          autoTheme.sync(wc).catch(() => {});
          cosmetics.injectFrameStyles().catch(() => {});
          pushState();
        })
        .catch(() => {
          setViewLoading(false);
          setOffline(true);
        });
      return;
    }
    loadFailures = 0;
    crashCount = 0;
    setViewLoading(false);
    setOffline(false);
    autoTheme.sync(wc).catch(() => {});
    cosmetics.injectFrameStyles().catch(() => {});
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
    }, 20000);
  });
  wc.on('responsive', () => {
    clearTimeout(hangTimer);
    hangTimer = null;
  });

  // --- Косметика: промо, скроллбары, лишние разделы ------------------------
  wc.on('dom-ready', () => {
    cosmetics.apply();
    autoTheme.sync(wc).catch(() => {});
    player.apply();
    focus.reapply();
    media.apply();
    pip.reapply();
    fullscreenNav.apply();
    feedKeys.sync();
    ads.apply();
    filters.apply();
    customCode.reapply();
    plugins.onPageReady({ url: wc.getURL(), title: wc.getTitle() });
    // Промо в сайдбаре иногда дорисовывается позже — просканируем ещё раз.
    cosmetics.schedule(3000);
  });
  wc.on('did-frame-finish-load', (_event, isMainFrame) => {
    // insertCSS не проникает во вложенные фреймы, а Business Suite и часть
    // экранов TikTok живут именно там.
    if (!isMainFrame) cosmetics.injectFrameStyles().catch(() => {});
  });
  wc.on('devtools-closed', () => autoTheme.sync(wc).catch(() => {}));
  wc.on('did-navigate-in-page', () => {
    cosmetics.scheduleScripts();
    plugins.onPageNavigate({ url: wc.getURL(), title: wc.getTitle() });
  });
  wc.on('did-stop-loading', () => {
    setViewLoading(false);
    cosmetics.schedule(600);
  });

  // --- Поиск по странице ---------------------------------------------------
  wc.on('found-in-page', (_event, result) => find.onFound(result));

  // --- Полноэкранное видео --------------------------------------------------
  wc.on('enter-html-full-screen', () => {
    fullscreenNav.onEnterFullscreen();
    ctx.htmlFullscreen = true;
    // Панель сбоку не должна мешать видео на весь экран.
    setPanelOpen(false, { persist: false });
    layout();
    pushState();
  });
  wc.on('leave-html-full-screen', () => {
    if (fullscreenNav.onLeaveFullscreen()) return;
    ctx.htmlFullscreen = false;
    layout();
    pushState();
  });

  wc.on('before-input-event', handleShortcut);
  attachContextMenu(wc);
  chat.attach(wc);

  layout();
  // Auto dark mode включается до первой загрузки: страницы, которые не
  // понимают cookie темы TikTok (Business Suite), не должны мигнуть белым.
  autoTheme.setEnabled(wc, cosmetics.isEnabled('dark-theme')).catch(() => {});
  // Тема сайта ставится cookie до первой загрузки: чат и другие разделы
  // читают её при монтировании и иначе останутся светлыми до перезагрузки.
  // Прокси (в том числе сохранённый обход DPI) применяем до первой загрузки:
  // иначе стартовый запрос уйдёт напрямую и получит блокировку.
  region
    .whenProxyReady()
    .catch(() => {})
    .then(() => cosmetics.prepareTheme(ses))
    .catch(() => {})
    .then(() => region.applySiteLanguageCookie(ses).catch(() => {}))
    .finally(() => {
      if (!wc.isDestroyed()) wc.loadURL(urlOverride || startUrl());
    });
}

function recreateView() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  chat.resetView();
  const old = ctx.view;
  ctx.view = null;
  ctx.playing = false;
  setUnread(0);
  if (old) {
    try {
      ctx.win.contentView.removeChildView(old);
      if (!old.webContents.isDestroyed()) old.webContents.close();
    } catch {
      /* уже уничтожено */
    }
  }
  createView(HOME_URL);
  pushState();
}

profiles.setSwitcher(() => recreateView());

module.exports = { createView, recreateView, authWindowOptions };
