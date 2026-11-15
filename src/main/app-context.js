'use strict';

/**
 * Общее состояние окна и мост «main → полоса заголовка».
 *
 * Здесь нет зависимостей от окон, сессий и меню: остальные модули берут
 * отсюда ctx и вспомогательные функции, поэтому циклических require нет.
 */

const { app } = require('electron');
const { TITLEBAR_H, MAX_CHROME_H } = require('./shared');

const ctx = {
  /** @type {import('electron').BrowserWindow | null} */
  win: null,
  /** @type {import('electron').WebContentsView | null} */
  view: null,
  /** @type {import('electron').Tray | null} */
  tray: null,
  /** Действия трея подставляет main.js, чтобы tray.js не зависел от commands.js. */
  trayActions: null,
  quitting: false,
  htmlFullscreen: false,
  /** Высота нашего интерфейса над контентом: 44 или 44 + панель поиска. */
  chromeHeight: TITLEBAR_H,
  pipActive: false,
  unread: 0,
  /**
   * @type {{
   *   open: boolean,
   *   text: string,
   *   matches: number,
   *   active: number,
   *   requestId: number,
   * }}
   */
  find: { open: false, text: '', matches: 0, active: 0, requestId: 0 },
  /** @type {{ name: string, percent: number } | null} */
  download: null,
  toastSeq: 0,
};

function sendToWindow(channel, payload) {
  if (ctx.win && !ctx.win.isDestroyed()) ctx.win.webContents.send(channel, payload);
}

function toast(text) {
  sendToWindow('octo:state', { toast: { id: ++ctx.toastSeq, text } });
}

/** Контент сайта занимает всё окно, кроме нашей полосы (и панели поиска). */
function layout() {
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view) return;
  const [width, height] = ctx.win.getContentSize();
  const top = ctx.htmlFullscreen ? 0 : ctx.chromeHeight;
  ctx.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
}

/** Renderer сообщает фактическую высоту своего интерфейса (панель поиска). */
function setChromeHeight(px) {
  const next = Math.min(MAX_CHROME_H, Math.max(TITLEBAR_H, Math.round(Number(px) || TITLEBAR_H)));
  if (next === ctx.chromeHeight) return;
  ctx.chromeHeight = next;
  layout();
}

/**
 * Считаем доступность навигации по индексам, а не через
 * navigationHistory.canGoBack(): TikTok помечает записи истории как
 * "skippable" (history.replaceState в SPA-роутере), из-за чего встроенный
 * canGoBack() возвращает false при реально доступной предыдущей странице.
 */
function canGoBack(wc) {
  if (!wc) return false;
  const history = wc.navigationHistory;
  return history.length() > 1 && history.getActiveIndex() > 0;
}

function canGoForward(wc) {
  if (!wc) return false;
  const history = wc.navigationHistory;
  const index = history.getActiveIndex();
  return index >= 0 && index < history.length() - 1;
}

/**
 * Шаг по истории на явный индекс.
 *
 * navigationHistory.goBack()/goForward() у TikTok не работают: SPA-роутер
 * помечает записи как "skippable", и смещение -1 схлопывается в текущую же
 * запись (запрос просто игнорируется). goToIndex(index) при этом работает.
 */
function stepHistory(delta) {
  if (!ctx.view) return;
  const history = ctx.view.webContents.navigationHistory;
  const target = history.getActiveIndex() + delta;
  if (target < 0 || target >= history.length()) return;
  history.goToIndex(target);
}

function currentState() {
  const wc = ctx.view?.webContents;
  return {
    canGoBack: canGoBack(wc),
    canGoForward: canGoForward(wc),
    loading: !!wc && wc.isLoading(),
    title: wc?.getTitle() || 'TikTok',
    url: wc?.getURL() || '',
    muted: !!wc && wc.isAudioMuted(),
    onTop: !!ctx.win && ctx.win.isAlwaysOnTop(),
    maximized: !!ctx.win && ctx.win.isMaximized(),
    fullscreen: !!ctx.win && ctx.win.isFullScreen(),
    chromeHidden: ctx.htmlFullscreen,
    zoom: wc ? Math.round(wc.getZoomFactor() * 100) : 100,
    pip: ctx.pipActive,
    unread: ctx.unread,
    find: { ...ctx.find },
    download: ctx.download ? { ...ctx.download } : null,
  };
}

function pushState() {
  sendToWindow('octo:state', currentState());
}

/** Бейдж непрочитанных на иконке приложения (macOS, Linux с Unity-лончером). */
function setUnread(count) {
  const next = Math.max(0, Number(count) || 0);
  if (next === ctx.unread) return;
  ctx.unread = next;
  try {
    app.setBadgeCount(next);
  } catch {
    /* платформа не поддерживает бейджи */
  }
  pushState();
}

module.exports = {
  ctx,
  sendToWindow,
  toast,
  layout,
  setChromeHeight,
  canGoBack,
  canGoForward,
  stepHistory,
  currentState,
  pushState,
  setUnread,
};
