'use strict';

/**
 * Общее состояние окна и мост «main → полоса заголовка».
 *
 * Здесь нет зависимостей от окон, сессий и меню: остальные модули берут
 * отсюда ctx и вспомогательные функции, поэтому циклических require нет.
 */

const { app } = require('electron');
const { TITLEBAR_H, MAX_CHROME_H, PANEL_W } = require('./shared');
const { COSMETIC_RULES } = require('./cosmetic-catalog');
const { REGION_PRESETS } = require('./region-catalog');
const { writeState } = require('./store');

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
  /** Открыта ли боковая панель функций. */
  panelOpen: false,
  /** Открыта ли палитра команд (view на время скрывается). */
  paletteOpen: false,
  /** Настройки плеера, которых нет у сайта. */
  player: {
    speed: 1,
    volume: 1,
    startMuted: false,
    loop: false,
    pauseOnBlur: false,
  },
  /** Кеш настройки «закрывать в трей» — чтобы не читать диск на каждый pushState. */
  closeToTray: false,
  /**
   * Состояние косметических правил для панели функций.
   * @type {Array<{ id: string, label: string, enabled: boolean }>}
   */
  cosmetics: COSMETIC_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    enabled: rule.default,
  })),
  pipActive: false,
  /** Автолистание ленты в режиме PiP. */
  pipAuto: true,
  /** Подстраивать окно PiP под экран и пропорции видео. */
  pipAdaptive: false,
  /** Играет ли сейчас видео (для кнопки play/pause в полосе PiP). */
  playing: false,
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
  /**
   * Очередь и история загрузок текущей сессии.
   * @type {Array<{
   *   id: string,
   *   name: string,
   *   percent: number,
   *   state: 'progressing' | 'completed' | 'cancelled' | 'failed',
   *   path: string,
   *   totalBytes: number,
   *   receivedBytes: number,
   * }>}
   */
  downloads: [],
  sleepTimerEnds: 0,
  sleepTimerMinutes: 0,
  autostart: false,
  startInTray: false,
  /** Автоматически пролистывать рекламные ролики в ленте. */
  adsSkip: false,
  /** Подмена региона: пресет страны и адрес прокси (см. region.js). */
  region: { preset: 'off', proxy: '' },
  /** Результат проверки внешнего IP через текущий прокси. */
  regionCheck: { state: 'idle', text: 'Проверить' },
  /** Установлен ли AppImage в пользовательское меню приложений. */
  appimageInstalled: false,
  toastSeq: 0,
};

function sendToWindow(channel, payload) {
  if (ctx.win && !ctx.win.isDestroyed()) ctx.win.webContents.send(channel, payload);
}

function toast(text) {
  sendToWindow('octo:state', { toast: { id: ++ctx.toastSeq, text } });
}

/** Контент сайта занимает всё окно, кроме нашей полосы (и панелей). */
function layout() {
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view) return;
  const [width, height] = ctx.win.getContentSize();
  const top = ctx.htmlFullscreen ? 0 : ctx.chromeHeight;
  const left = ctx.htmlFullscreen ? 0 : ctx.panelOpen ? PANEL_W : 0;
  ctx.view.setBounds({
    x: left,
    y: top,
    width: Math.max(0, width - left),
    height: Math.max(0, height - top),
  });
}

/**
 * После сдвига WebContentsView открывается полоса нашего renderer.
 * На Wayland композитор иногда оставляет её чёрной до следующей
 * инвалидации — просим окно перерисоваться, в том числе на следующем кадре.
 */
function repaintWindow() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  try {
    ctx.win.webContents.invalidate();
  } catch {
    /* окно уже закрывается */
  }
}

function layoutSoon() {
  layout();
  repaintWindow();
  setTimeout(() => {
    layout();
    repaintWindow();
  }, 40);
}

/** Открыть/закрыть панель функций. */
function setPanelOpen(open, { persist = true } = {}) {
  const next = Boolean(open);
  if (next === ctx.panelOpen) return;
  ctx.panelOpen = next;
  if (persist) writeState({ panelOpen: next });
  layoutSoon();
  pushState();
}

/** Синхронизировать состояние косметики для интерфейса. */
function setCosmeticsState(saved = {}) {
  ctx.cosmetics = COSMETIC_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    enabled: saved[rule.id] === undefined ? rule.default : saved[rule.id] === true,
  }));
}

/**
 * Палитра команд — модальное окно нашего интерфейса. На время показа
 * прячем WebContentsView, иначе он перекроет затемнение и карточку.
 */
function setPaletteOpen(open) {
  const next = Boolean(open);
  if (next === ctx.paletteOpen) return;
  ctx.paletteOpen = next;

  if (ctx.view && typeof ctx.view.setVisible === 'function') {
    ctx.view.setVisible(!next);
  }

  repaintWindow();
  setTimeout(repaintWindow, 40);

  if (next) ctx.win?.webContents.focus();
  else ctx.view?.webContents.focus();

  pushState();
}

/** Настройка «закрывать в трей» меняется из панели и трея. */
function setCloseToTray(value) {
  ctx.closeToTray = Boolean(value);
}

/** Renderer сообщает фактическую высоту своего интерфейса (панель поиска). */
function setChromeHeight(px) {
  const next = Math.min(MAX_CHROME_H, Math.max(TITLEBAR_H, Math.round(Number(px) || TITLEBAR_H)));
  if (next === ctx.chromeHeight) return;
  ctx.chromeHeight = next;
  layoutSoon();
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
    pipAuto: ctx.pipAuto,
    pipAdaptive: ctx.pipAdaptive,
    playing: ctx.playing,
    unread: ctx.unread,
    panel: ctx.panelOpen,
    panelWidth: PANEL_W,
    palette: ctx.paletteOpen,
    player: { ...ctx.player },
    cosmetics: ctx.cosmetics,
    closeToTray: ctx.closeToTray,
    version: app.getVersion(),
    find: { ...ctx.find },
    download: ctx.download ? { ...ctx.download } : null,
    downloads: ctx.downloads.map((entry) => ({ ...entry })),
    sleepTimerEnds: ctx.sleepTimerEnds,
    sleepTimerMinutes: ctx.sleepTimerMinutes,
    autostart: ctx.autostart,
    startInTray: ctx.startInTray,
    adsSkip: ctx.adsSkip,
    region: { ...ctx.region },
    regionCheck: { ...ctx.regionCheck },
    regions: REGION_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
    appimage: {
      available: Boolean(process.env.APPIMAGE),
      installed: ctx.appimageInstalled,
    },
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
  setPanelOpen,
  setPaletteOpen,
  setCosmeticsState,
  setCloseToTray,
  canGoBack,
  canGoForward,
  stepHistory,
  currentState,
  pushState,
  setUnread,
};
