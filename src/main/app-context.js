'use strict';

/**
 * Общее состояние окна и мост «main → полоса заголовка».
 *
 * Здесь нет зависимостей от окон, сессий и меню: остальные модули берут
 * отсюда ctx и вспомогательные функции, поэтому циклических require нет.
 */

const { app } = require('electron');
const logger = require('./logger');
const {
  TITLEBAR_H,
  MAX_CHROME_H,
  PANEL_W,
  SIDENAV_W,
  SIDENAV_COLLAPSED_W,
  CHAT_W,
  CHAT_HANDLE_W,
} = require('./shared');
const { COSMETIC_RULES } = require('./cosmetic-catalog');
const { REGION_PRESETS } = require('./region-catalog');
const { APP_LANGUAGES, SITE_LANGUAGES } = require('./language-catalog');

const ctx = {
  /** @type {import('electron').BrowserWindow | null} */
  win: null,
  /** @type {import('electron').WebContentsView | null} */
  view: null,
  /**
   * Панель чата слева: отдельный WebContentsView поверх ленты.
   * @type {import('electron').WebContentsView | null}
   */
  chatView: null,
  /** Открыта ли панель чата. */
  chatOpen: false,
  /**
   * Попросить страницу чата пересобрать раскладку: подставляет chat.js, чтобы
   * app-context не зависел от него напрямую.
   * @type {((view: import('electron').WebContentsView) => void) | null}
   */
  chatRelayout: null,
  /** Ширина панели чата: тянется за полоску между чатом и лентой. */
  chatWidth: CHAT_W,
  /** Чат поджимает ленту (иначе лежит поверх неё). */
  chatDock: true,
  /** Свёрнуто ли кастомное левое меню навигации до узкого рельса иконок. */
  sideNavCollapsed: false,
  /** Уведомления о новых сообщениях: тип по заголовку не определить, только счётчик. */
  notifications: {
    enabled: false,
    dnd: false,
    dndFrom: '23:00',
    dndTo: '08:00',
    quietFocused: true,
  },
  /** Быстрые ответы: строки-шаблоны для палитры и вставки в диалог. */
  replies: [],
  /** Библиотека: закладки с таймкодом и очередь «посмотреть позже». */
  library: { items: [], queue: [] },
  /** Настройки GIF-экспорта: длительность, fps и ширина. */
  gif: { duration: 3, fps: 10, width: 480 },
  /** Свой CSS/JS на страницу (расширенный режим). */
  customCode: { enabled: false, cssLength: 0, jsLength: 0 },
  /** Фильтры контента: правила и включённость. */
  filters: { enabled: false, keywords: [], hashtags: [], authors: [] },
  /** Настройки имён файлов загрузок и лимит одновременных. */
  downloadNaming: {
    auto: false,
    template: '{author}-{date}-{title}',
    folderPerAuthor: false,
    limit: 2,
  },
  /** Сводка статистики просмотра за сегодня и неделю. */
  stats: {
    today: { minutes: 0, seconds: 0, videos: 0 },
    week: { minutes: 0, videos: 0 },
    topAuthors: [],
  },
  /** Focus mode: лимит просмотра, перерыв и затемнение ленты. */
  focus: { enabled: false, minutes: 25, breakMinutes: 5, phase: 'off', elapsed: 0, total: 1500 },
  /** Амбиентный режим: лента без звука и интерфейса на другом мониторе. */
  ambient: false,
  /** @type {import('electron').Tray | null} */
  tray: null,
  /** Действия трея подставляет main.js, чтобы tray.js не зависел от commands.js. */
  trayActions: null,
  quitting: false,
  htmlFullscreen: false,
  /** Высота нашего интерфейса над контентом: 44 или 44 + панель поиска. */
  chromeHeight: TITLEBAR_H,
  /** Высота полосы в CSS-пикселях: масштаб интерфейса пересчитывает её в DIP. */
  chromeHeightCss: TITLEBAR_H,
  /** Масштаб собственного интерфейса; сайт масштабируется отдельно. */
  uiScale: 1,
  /** Шрифт собственного интерфейса (Google Sans Medium по умолчанию). */
  uiFont: { preset: 'google-sans-medium', family: '', fileName: '' },
  /** Покомпонентная кастомизация собственного интерфейса. */
  uiCustom: {},
  /** Пользовательские кнопки верхней полосы. */
  topbarButtons: [],
  /** Временный файл иконки для черновика кнопки верхней полосы. */
  pendingTopbarIcon: null,
  /** Открыта ли панель функций. */
  panelOpen: false,
  /** Активна пипетка выбора элемента в редакторе компонентов. */
  uiPickerActive: false,
  /** Открыт ли оверлей менеджера плагинов. */
  pluginsOpen: false,
  /** Открыт ли модальный диалог плагина (confirm/prompt/pick). */
  pluginDialogOpen: false,
  /** Открыт ли кастомный системный диалог приложения (showMessageBox). */
  appDialogOpen: false,
  /** Какое быстрое меню открыто под полосой: стикеры или активные плагины. */
  popover: null,
  /** Открыта ли палитра команд (view на время скрывается). */
  paletteOpen: false,
  /** Мастер первого запуска: язык и прокси поверх скрытой ленты. */
  welcome: { open: false, done: false, mutedByUs: false, muteTouched: false },
  /** Результат поиска локального прокси для мастера. */
  proxyScan: { state: 'idle', items: [] },
  /** Локальный обход DPI: фрагментация TLS без прокси и VPN (см. dpi-bypass.js). */
  dpi: { enabled: false, active: false, port: 0 },
  /** Проверка соединения через прокси/DPI. */
  proxyTest: { state: 'idle', ms: 0, text: '' },
  /** Профили аккаунтов (изолированные сессии TikTok). */
  profiles: { active: 'default', list: [{ id: 'default', name: 'Основной' }] },
  /** Локальная история просмотров. */
  history: [],
  /** Заметки и теги к авторам. */
  creatorNotes: [],
  /** Цикл отрезка A–B текущего видео. */
  abLoop: { a: null, b: null, enabled: false },
  /** Режим темы: 'system' | 'dark' | 'light'. */
  themeMode: 'dark',
  /** Чисто чёрный AMOLED-фон поверх тёмной темы. */
  themeAmoled: false,
  /** Менять ли палитру оформления на случайную при каждом запуске. */
  themeRandomOnStart: false,
  /** Цветовая палитра MD3 Expressive (см. md3-palettes.js). */
  themePalette: 'octo-lavender',
  /** Пользовательские цвета палитры 'custom'. */
  themeCustom: { primary: '#8c84a9', secondary: '', tertiary: '', surface: '', text: '' },
  /** Настройки переливания цветов: диапазон оттенков и скорость. */
  themeRainbow: { hueFrom: 0, hueTo: 360, speed: 1 },
  /** Динамические токены для режима переливания цветов. */
  themeRainbowTokens: null,
  /** Настройки плеера, которых нет у сайта. */
  player: {
    speed: 1,
    volume: 1,
    startMuted: false,
    loop: false,
    pauseOnBlur: false,
    sinkId: '',
    equalizer: 'off',
    mono: false,
  },
  /** Кеш настройки «закрывать в трей» — чтобы не читать диск на каждый pushState. */
  closeToTray: false,
  /** Последняя резервная копия состояния: показывается в панели. */
  backups: { latest: '', count: 0 },
  /** Локальные данные: размеры и удаление по пунктам. */
  privacy: { items: [], totalBytes: 0, updatedAt: 0 },
  /** Безопасный режим после двух падений подряд. */
  safeMode: false,
  /** Экономный режим и питание: влияет на фоновые скрипты. */
  eco: false,
  ecoOnBattery: true,
  onBattery: false,
  memoryGuard: true,
  /** Страница не загрузилась: показываем свой экран вместо белого. */
  offline: false,
  /** Основной документ ещё грузится: показываем экран загрузки с логотипом. */
  viewLoading: false,
  /**
   * Состояние косметических правил для панели функций.
   * @type {Array<{ id: string, label: string, hint: string, enabled: boolean }>}
   */
  cosmetics: COSMETIC_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    hint: rule.hint || '',
    enabled: rule.default,
    experimental: Boolean(rule.experimental),
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
  /** Режим таймера сна: off, minutes, end (до конца ролика) или videos. */
  sleepTimerMode: 'off',
  /** Сколько видео выбрал пользователь в режиме «стоп после N видео». */
  sleepTimerVideos: 3,
  /** Сколько роликов ещё осталось до остановки. */
  sleepTimerVideosLeft: 0,
  /** Плавно гасить звук перед остановкой. */
  sleepTimerFade: false,
  /** Клавиатурная лента: J/K/L, пробел, цифры и «?». */
  feedKeys: true,
  /** Автопауза, если системного ввода нет N минут (0 — выключена). */
  idlePause: 0,
  /** Не давать экрану засыпать, пока идёт воспроизведение. */
  keepAwake: false,
  /** Состояние редактора горячих клавиш для панели. */
  keymapState: { profile: 'default', profiles: [], rows: [] },
  /** Субтитры по умолчанию и их оформление (см. captions.js). */
  subtitles: { enabled: false, size: 100, background: true, outline: true },
  /** Дата публикации текущего ролика, если сайт её показывает. */
  videoDate: '',
  /** Разрешение, битрейт и поддержка HEVC у текущего потока. */
  videoQuality: { width: 0, height: 0, bitrate: 0, hevc: false },
  /** Аппаратное декодирование на Linux: настройка и доступность переключателя. */
  hardwareVideo: { enabled: false, supported: process.platform === 'linux' },
  /** QR текущей страницы: матрица модулей, которую renderer рисует на canvas. */
  qr: null,
  /** Режим «только полоса»: сайт скрыт, остаётся компактный пульт. */
  barOnly: false,
  /** Настройки таймера сна для страничного скрипта плеера. */
  sleepPage: { endsAt: 0, stopAtEnd: false, videosLeft: null, fade: false },
  /** Список аудиовыходов, собранный в странице сайта. */
  audioDevices: [],
  /** Позиция и длительность ролика для полосы PiP. */
  pipTime: 0,
  pipDuration: 0,
  autostart: false,
  linkHandler: false,
  startInTray: false,
  /** Автоматически пролистывать рекламные ролики в ленте. */
  adsSkip: false,
  /** Пропускать рекламу и в режиме PiP. */
  adsInPip: true,
  /** Сколько рекламных роликов пропущено и когда. */
  adsSkipped: 0,
  adJournal: [],
  /** Подмена региона: пресет страны и адрес прокси (см. region.js). */
  region: { preset: 'off', proxy: '' },
  /** Язык интерфейса оболочки (см. i18n.js). */
  language: 'ru',
  /** Язык сайта TikTok: auto или id из SITE_LANGUAGES (см. region.js). */
  siteLanguage: 'auto',
  /** Результат проверки внешнего IP через текущий прокси. */
  regionCheck: { state: 'idle', text: 'Проверить' },
  /** Установлен ли AppImage в пользовательское меню приложений. */
  appimageInstalled: false,
  /** Стикеры пользователя: файлы лежат в userData, здесь только метаданные. */
  stickers: {
    items: [],
    dir: '',
  },
  /** Сводка системы плагинов для панели, палитры и трея. */
  plugins: {
    managerOpen: false,
    installedCount: 0,
    enabledCount: 0,
    updateCount: 0,
    errorCount: 0,
    items: [],
    rows: [],
    commands: [],
    docsUrl: '',
    rulesUrl: '',
  },
  toastSeq: 0,
};

function sendToWindow(channel, payload) {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  const wc = ctx.win.webContents;
  // Окно может быть уже закрыто, а webContents — уничтожен: send() в этот
  // момент бросает «Object has been destroyed» и роняет main-процесс.
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(channel, payload);
  } catch {
    /* гонка с закрытием окна */
  }
}

function toast(text) {
  let value = text;
  try {
    // Ленивый require: i18n сам зависит от app-context, поэтому на старте
    // модулей его здесь ещё нет.
    value = require('./i18n').t(text);
  } catch {
    /* язык ещё не готов — показываем исходную строку */
  }
  logger.info('toast', String(text || ''));
  sendToWindow('octo:state', { toast: { id: ++ctx.toastSeq, text: value } });
}

// Минимальная ширина ленты, которую чат оставляет при доке. Панель чата не
// должна поджимать ленту до нечитаемой полоски.
const CHAT_FEED_MIN = 320;

/** Видно ли кастомное левое меню навигации в текущем режиме окна. */
function isSideNavVisible() {
  return (
    !ctx.htmlFullscreen &&
    !ctx.ambient &&
    !ctx.pipActive &&
    !ctx.barOnly &&
    !ctx.offline &&
    !ctx.welcome.open
  );
}

/** Фактическая ширина кастомного левого меню в DIP. */
function sideNavWidth() {
  if (!isSideNavVisible()) return 0;
  const css = ctx.sideNavCollapsed ? SIDENAV_COLLAPSED_W : SIDENAV_W;
  return Math.round(css * (ctx.uiScale || 1));
}

/** Ширина, доступная сайту и док-панели чата. */
function contentWidth() {
  if (!ctx.win || ctx.win.isDestroyed()) return 0;
  const [width] = ctx.win.getContentSize();
  return Math.max(0, width - sideNavWidth());
}

/**
 * Предел ширины чата. В доке оставляем ленте минимум, поверх ленты — ничего:
 * перекрытой ленте место не нужно, и чат может занять всё окно.
 */
function chatWidthLimit(available = contentWidth()) {
  const spare = ctx.chatDock === false ? 0 : CHAT_FEED_MIN;
  return Math.max(200, available - spare);
}

let viewHidden = false;
let lastViewVisible = null;

/** Показать view только когда нет оверлеев (настройки, палитра, мастер, экран ошибки). */
function syncViewVisibility() {
  if (!ctx.view || typeof ctx.view.setVisible !== 'function') return;
  if (ctx.view.webContents && ctx.view.webContents.isDestroyed()) return;
  const visible =
    !ctx.offline &&
    !ctx.viewLoading &&
    !ctx.paletteOpen &&
    !ctx.panelOpen &&
    !ctx.pluginsOpen &&
    !ctx.pluginDialogOpen &&
    !ctx.appDialogOpen &&
    !ctx.barOnly &&
    !ctx.welcome.open;
  if (lastViewVisible !== visible) {
    lastViewVisible = visible;
    logger.debug('view', 'visibility changed', {
      visible,
      offline: ctx.offline,
      loading: ctx.viewLoading,
      panel: ctx.panelOpen,
      plugins: ctx.pluginsOpen,
      palette: ctx.paletteOpen,
      welcome: ctx.welcome.open,
      barOnly: ctx.barOnly,
    });
  }
  try {
    ctx.view.setVisible(visible);
    if (visible && viewHidden) {
      viewHidden = false;
      ctx.view.webContents?.invalidate?.();
      try {
        require('./media').repaint();
      } catch {
        /* view ещё не готов */
      }
    } else if (!visible) {
      viewHidden = true;
    }
  } catch {
    /* view уже закрывается */
  }
}

/** Контент сайта занимает всё окно, кроме верхней полосы, левого меню и панели чата. */
function layout() {
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view) return;
  const wc = ctx.view.webContents;
  if (wc && wc.isDestroyed()) return;
  try {
    const [width, height] = ctx.win.getContentSize();
    const top = ctx.htmlFullscreen || ctx.ambient ? 0 : ctx.chromeHeight;
    const sideW = sideNavWidth();
    const available = Math.max(0, width - sideW);

    // Чат виден только в обычном окне; в PiP, полном экране и оверлеях он спрятан.
    const chat = ctx.chatView;
    const chatAlive = Boolean(chat && !chat.webContents.isDestroyed());
    const chatVisible =
      chatAlive &&
      ctx.chatOpen &&
      !ctx.htmlFullscreen &&
      !ctx.ambient &&
      !ctx.pipActive &&
      !ctx.paletteOpen &&
      !ctx.panelOpen &&
      !ctx.pluginsOpen &&
      !ctx.pluginDialogOpen &&
      !ctx.appDialogOpen &&
      !ctx.barOnly &&
      !ctx.welcome.open;
    const chatWidth = Math.min(ctx.chatWidth, chatWidthLimit(available));
    // «Док» поджимает ленту; иначе панель лежит поверх неё, как раньше.
    const docked = chatVisible && ctx.chatDock !== false;

    ctx.view.setBounds({
      x: sideW + (docked ? chatWidth + CHAT_HANDLE_W : 0),
      y: top,
      width: Math.max(0, available - (docked ? chatWidth + CHAT_HANDLE_W : 0)),
      height: Math.max(0, height - top),
    });

    syncViewVisibility();

    if (chat && !chat.webContents.isDestroyed()) {
      chat.setVisible(chatVisible);
      if (chatVisible) {
        const next = {
          x: sideW,
          y: top,
          width: chatWidth,
          height: Math.max(0, height - top),
        };
        const previous = chat.getBounds();
        chat.setBounds(next);
        // Размер поменялся без участия окна: страница сообщений может остаться
        // в старой раскладке, пока не дёрнуть край окна. Пусть пересоберёт сама.
        if (
          ctx.chatRelayout &&
          (previous.width !== next.width || previous.height !== next.height)
        ) {
          ctx.chatRelayout(chat);
        }
      }
    }
  } catch {
    /* окно или view уже закрываются */
  }
}

/**
 * После сдвига WebContentsView открывается полоса нашего renderer.
 * На Wayland композитор иногда оставляет её чёрной до следующей
 * инвалидации — просим окно перерисоваться, в том числе на следующем кадре.
 */
function repaintWindow() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  const wc = ctx.win.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.invalidate();
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

/** Открыть/закрыть оверлей настроек поверх главного окна. */
function setPanelOpen(open) {
  const next = Boolean(open);
  if (next === ctx.panelOpen) return;
  ctx.panelOpen = next;
  logger.info('ui', 'panel toggle', { open: next });
  if (next) {
    ctx.popover = null;
    ctx.pluginsOpen = false;
  }
  layoutSoon();

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (next && wc && !wc.isDestroyed()) wc.focus();
    else if (
      !next &&
      !ctx.pluginsOpen &&
      !ctx.paletteOpen &&
      !ctx.pluginDialogOpen &&
      !ctx.appDialogOpen &&
      !ctx.welcome.open &&
      !ctx.find.open &&
      ctx.view &&
      !ctx.view.webContents.isDestroyed()
    ) {
      ctx.view.webContents.focus();
    }
  }

  pushState();
}

/** Показать/скрыть модальный диалог плагина поверх основного окна. */
function setPluginDialogOpen(open) {
  const next = Boolean(open);
  if (next === ctx.pluginDialogOpen) return;
  ctx.pluginDialogOpen = next;
  syncViewVisibility();
  if (next && ctx.chatView && !ctx.chatView.webContents.isDestroyed()) {
    try {
      ctx.chatView.setVisible(false);
    } catch {
      /* view уже закрывается */
    }
  }
  if (!next) layout();
  repaintWindow();
  setTimeout(repaintWindow, 40);

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (next && wc && !wc.isDestroyed()) wc.focus();
    else if (
      !next &&
      !ctx.panelOpen &&
      !ctx.pluginsOpen &&
      !ctx.paletteOpen &&
      !ctx.appDialogOpen &&
      !ctx.welcome.open &&
      !ctx.find.open &&
      ctx.view &&
      !ctx.view.webContents.isDestroyed()
    ) {
      ctx.view.webContents.focus();
    }
  }
}

/** Показать/скрыть модальный диалог приложения поверх основного окна. */
function setAppDialogOpen(open) {
  const next = Boolean(open);
  if (next === ctx.appDialogOpen) return;
  ctx.appDialogOpen = next;
  syncViewVisibility();
  if (next && ctx.chatView && !ctx.chatView.webContents.isDestroyed()) {
    try {
      ctx.chatView.setVisible(false);
    } catch {
      /* view уже закрывается */
    }
  }
  if (!next) layout();
  repaintWindow();
  setTimeout(repaintWindow, 40);

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (next && wc && !wc.isDestroyed()) wc.focus();
    else if (
      !next &&
      !ctx.panelOpen &&
      !ctx.pluginsOpen &&
      !ctx.paletteOpen &&
      !ctx.pluginDialogOpen &&
      !ctx.welcome.open &&
      !ctx.find.open &&
      ctx.view &&
      !ctx.view.webContents.isDestroyed()
    ) {
      ctx.view.webContents.focus();
    }
  }
}

/** Открыть/закрыть оверлей менеджера плагинов поверх главного окна. */
function setPluginsOpen(open) {
  const next = Boolean(open);
  if (next === ctx.pluginsOpen) return;
  ctx.pluginsOpen = next;
  logger.info('ui', 'plugins overlay toggle', { open: next });
  if (next) {
    ctx.popover = null;
    ctx.panelOpen = false;
  }
  layoutSoon();

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (next && wc && !wc.isDestroyed()) wc.focus();
    else if (
      !next &&
      !ctx.panelOpen &&
      !ctx.paletteOpen &&
      !ctx.pluginDialogOpen &&
      !ctx.appDialogOpen &&
      !ctx.welcome.open &&
      !ctx.find.open &&
      ctx.view &&
      !ctx.view.webContents.isDestroyed()
    ) {
      ctx.view.webContents.focus();
    }
  }

  pushState();
}

/**
 * Открыть быстрое меню под полосой заголовка: «stickers» или «plugins».
 * Меню живёт в renderer, но состояние хранится здесь, чтобы Esc и команды
 * из меню/трея закрывали его так же, как настройки.
 */
function setPopover(id, { toggle = true } = {}) {
  let next = id === 'stickers' || id === 'plugins' ? id : null;
  // Повторный клик по той же кнопке закрывает меню, а команда «добавить»
  // должна только открыть его, даже если оно уже открыто.
  if (toggle && next && next === ctx.popover) next = null;
  if (next === ctx.popover) return;
  ctx.popover = next;

  if (next && (ctx.panelOpen || ctx.pluginsOpen)) {
    ctx.panelOpen = false;
    ctx.pluginsOpen = false;
    layoutSoon();
  }

  pushState();
}

/** Синхронизировать состояние косметики для интерфейса. */
function setCosmeticsState(saved = {}) {
  ctx.cosmetics = COSMETIC_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    hint: rule.hint || '',
    enabled: saved[rule.id] === undefined ? rule.default : saved[rule.id] === true,
    experimental: Boolean(rule.experimental),
  }));
}

/** Сводка плагинов обновляется из plugins/index.js, чтобы не плодить циклы. */
function setPluginsState(summary) {
  if (!summary || typeof summary !== 'object') return;
  ctx.plugins = {
    ...ctx.plugins,
    ...summary,
    items: Array.isArray(summary.items)
      ? summary.items.map((item) => ({ ...item }))
      : ctx.plugins.items,
    rows: Array.isArray(summary.rows) ? summary.rows.map((row) => ({ ...row })) : ctx.plugins.rows,
    commands: Array.isArray(summary.commands)
      ? summary.commands.map((command) => ({ ...command }))
      : ctx.plugins.commands,
  };
}

/**
 * Палитра команд — модальное окно нашего интерфейса. На время показа
 * прячем WebContentsView, иначе он перекроет затемнение и карточку.
 */
function setPaletteOpen(open) {
  const next = Boolean(open);
  if (next === ctx.paletteOpen) return;
  ctx.paletteOpen = next;
  logger.info('ui', 'palette toggle', { open: next });

  syncViewVisibility();

  // Палитра — модальное окно поверх всего: спрятать нужно и панель чата,
  // иначе она окажется выше затемнения. При закрытии layout вернёт её.
  if (next && ctx.chatView && !ctx.chatView.webContents.isDestroyed()) {
    try {
      ctx.chatView.setVisible(false);
    } catch {
      /* view уже закрывается */
    }
  }
  if (!next) layout();

  repaintWindow();
  setTimeout(repaintWindow, 40);

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (next && wc && !wc.isDestroyed()) wc.focus();
    else if (!next && ctx.view && !ctx.view.webContents.isDestroyed()) {
      ctx.view.webContents.focus();
    }
  }

  pushState();
}

/**
 * Мастер первого запуска — модальный экран нашего интерфейса. Он тоже прячет
 * WebContentsView, иначе лента TikTok перекроет карточку.
 */
function setWelcomeOpen(open) {
  const next = Boolean(open);
  if (next === ctx.welcome.open) return;
  ctx.welcome.open = next;
  logger.info('ui', 'welcome toggle', { open: next });
  applyWelcomeAudio(next);

  layoutSoon();

  if (ctx.win && !ctx.win.isDestroyed()) {
    const wc = ctx.win.webContents;
    if (wc && !wc.isDestroyed()) wc.focus();
  }

  pushState();
}

/**
 * Звук ленты под мастером: view скрыт, но видео продолжает играть, а Electron
 * по умолчанию разрешает автозапуск со звуком. Глушим на время мастера и
 * возвращаем звук, только если пользователь не трогал его сам.
 */
function applyWelcomeAudio(open, wc = ctx.view?.webContents) {
  if (!wc || wc.isDestroyed()) return;
  try {
    if (open) {
      ctx.welcome.mutedByUs = !wc.isAudioMuted();
      if (ctx.welcome.mutedByUs) wc.setAudioMuted(true);
      ctx.welcome.muteTouched = false;
      return;
    }
    if (ctx.welcome.mutedByUs && !ctx.welcome.muteTouched) wc.setAudioMuted(false);
    ctx.welcome.mutedByUs = false;
    ctx.welcome.muteTouched = false;
  } catch {
    /* view уже закрывается */
  }
}

/** Настройка «закрывать в трей» меняется из панели и трея. */
function setCloseToTray(value) {
  ctx.closeToTray = Boolean(value);
}

/** Renderer сообщает фактическую высоту своего интерфейса (панель поиска). */
function clampUiScale(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(1.75, Math.max(0.75, Math.round(number * 100) / 100));
}

/** Масштаб интерфейса: меняет только нашу полосу, панель и диалоги. */
function setUiScale(value) {
  const next = clampUiScale(value);
  if (next === ctx.uiScale) return ctx.uiScale;
  ctx.uiScale = next;
  if (ctx.win && !ctx.win.isDestroyed()) {
    try {
      ctx.win.webContents.setZoomFactor(next);
    } catch {
      /* окно ещё не загрузилось */
    }
  }
  ctx.chromeHeight = Math.min(
    MAX_CHROME_H,
    Math.max(Math.round(TITLEBAR_H * next), Math.round((ctx.chromeHeightCss || TITLEBAR_H) * next)),
  );
  layoutSoon();
  pushState();
  return ctx.uiScale;
}

function setChromeHeight(px) {
  // В амбиентном режиме, PiP, «только полосе» и полноэкранном сайте высоту
  // задаёт режим. Запоздавший замер полосы из renderer'а иначе вернул бы
  // сдвиг ленты на 44 px прямо посреди амбиента.
  if (ctx.ambient || ctx.barOnly || ctx.pipActive || ctx.htmlFullscreen) return;
  const css = Math.min(MAX_CHROME_H, Math.max(TITLEBAR_H, Math.round(Number(px) || TITLEBAR_H)));
  ctx.chromeHeightCss = css;
  const next = Math.min(MAX_CHROME_H, Math.max(Math.round(css * (ctx.uiScale || 1)), 1));
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
  if (!wc || wc.isDestroyed()) return false;
  try {
    const history = wc.navigationHistory;
    return history.length() > 1 && history.getActiveIndex() > 0;
  } catch {
    return false;
  }
}

function canGoForward(wc) {
  if (!wc || wc.isDestroyed()) return false;
  try {
    const history = wc.navigationHistory;
    const index = history.getActiveIndex();
    return index >= 0 && index < history.length() - 1;
  } catch {
    return false;
  }
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
  const wc = ctx.view.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    const history = wc.navigationHistory;
    const target = history.getActiveIndex() + delta;
    if (target < 0 || target >= history.length()) return;
    logger.info('nav', 'step history', { delta, target, len: history.length() });
    history.goToIndex(target);
  } catch (err) {
    logger.warn('nav', 'step history failed', err?.message);
  }
}

const STATIC_REGIONS = REGION_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }));
const STATIC_LANGUAGES = APP_LANGUAGES.map((language) => ({
  id: language.id,
  label: language.label,
}));
const STATIC_SITE_LANGUAGES = [
  { id: 'auto', label: 'Авто (как у сайта)' },
  ...SITE_LANGUAGES.map((language) => ({ id: language.id, label: language.label })),
];

function currentState() {
  const wc = ctx.view?.webContents;
  const alive = Boolean(wc && !wc.isDestroyed());
  return {
    canGoBack: canGoBack(wc),
    canGoForward: canGoForward(wc),
    loading: alive && wc.isLoading(),
    title: (alive && wc.getTitle()) || 'TikTok',
    url: (alive && wc.getURL()) || '',
    muted: alive && wc.isAudioMuted(),
    onTop: !!ctx.win && !ctx.win.isDestroyed() && ctx.win.isAlwaysOnTop(),
    maximized: !!ctx.win && !ctx.win.isDestroyed() && ctx.win.isMaximized(),
    fullscreen: !!ctx.win && !ctx.win.isDestroyed() && ctx.win.isFullScreen(),
    chromeHidden: ctx.htmlFullscreen,
    zoom: alive ? Math.round(wc.getZoomFactor() * 100) : 100,
    pip: ctx.pipActive,
    pipAuto: ctx.pipAuto,
    pipAdaptive: ctx.pipAdaptive,
    playing: ctx.playing,
    unread: ctx.unread,
    panel: ctx.panelOpen,
    pluginsOpen: ctx.pluginsOpen,
    popover: ctx.popover,
    panelWidth: PANEL_W,
    sideNavCollapsed: Boolean(ctx.sideNavCollapsed),
    sideNavWidth: SIDENAV_W,
    sideNavCollapsedWidth: SIDENAV_COLLAPSED_W,
    uiScale: ctx.uiScale,
    uiFont: require('./ui-font').toRendererPayload(ctx.uiFont),
    uiCustom: require('./ui-custom').toRendererPayload(ctx.uiCustom),
    topbarButtons: require('./ui-custom').toTopbarPayload(ctx.topbarButtons),
    pendingTopbarIcon: ctx.pendingTopbarIcon || null,
    // Ширина для полоски-ручки: фактическая, а не желаемая — в узком окне
    // чат упирается в предел и ручка должна стоять на его краю.
    chat: {
      open: ctx.chatOpen,
      width: Math.min(ctx.chatWidth, chatWidthLimit()),
      dock: ctx.chatDock,
    },
    notifications: { ...ctx.notifications },
    downloadNaming: { ...ctx.downloadNaming },
    gif: { ...ctx.gif },
    customCode: { ...ctx.customCode },
    filters: {
      enabled: ctx.filters.enabled,
      keywords: ctx.filters.keywords.slice(),
      hashtags: ctx.filters.hashtags.slice(),
      authors: ctx.filters.authors.slice(),
    },
    replies: ctx.replies.slice(),
    library: {
      items: ctx.library.items.map((item) => ({ ...item })),
      queue: ctx.library.queue.slice(),
    },
    stats: {
      today: { ...ctx.stats.today },
      week: { ...ctx.stats.week },
      topAuthors: ctx.stats.topAuthors.map((author) => ({ ...author })),
    },
    focus: { ...ctx.focus },
    ambient: ctx.ambient,
    palette: ctx.paletteOpen,
    welcome: { open: ctx.welcome.open, done: ctx.welcome.done },
    dpi: { ...ctx.dpi },
    proxyTest: { ...ctx.proxyTest },
    profiles: {
      active: ctx.profiles.active,
      list: ctx.profiles.list.map((item) => ({ ...item })),
    },
    history: ctx.history.map((item) => ({ ...item })),
    creatorNotes: ctx.creatorNotes.map((item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.slice() : [],
    })),
    abLoop: { ...ctx.abLoop },
    themeMode: ctx.themeMode,
    themeAmoled: Boolean(ctx.themeAmoled),
    themeRandomOnStart: Boolean(ctx.themeRandomOnStart),
    themePalette: ctx.themePalette,
    themeCustom: ctx.themeCustom,
    themeRainbow: ctx.themeRainbow,
    themeTokens: ctx.themeTokens || null,
    themeRainbowTokens: ctx.themeRainbowTokens || null,
    proxyScan: {
      state: ctx.proxyScan.state,
      items: ctx.proxyScan.items.map((item) => ({ ...item })),
    },
    player: { ...ctx.player },
    cosmetics: ctx.cosmetics,
    closeToTray: ctx.closeToTray,
    backups: { ...ctx.backups },
    privacy: {
      ...ctx.privacy,
      items: ctx.privacy.items.map((item) => ({ ...item })),
    },
    safeMode: ctx.safeMode,
    eco: ctx.eco,
    ecoOnBattery: ctx.ecoOnBattery,
    onBattery: ctx.onBattery,
    memoryGuard: ctx.memoryGuard,
    offline: ctx.offline,
    viewLoading: Boolean(ctx.viewLoading),
    version: app.getVersion(),
    find: { ...ctx.find },
    download: ctx.download ? { ...ctx.download } : null,
    downloads: ctx.downloads.map((entry) => ({ ...entry })),
    sleepTimerEnds: ctx.sleepTimerEnds,
    sleepTimerMinutes: ctx.sleepTimerMinutes,
    sleepTimerMode: ctx.sleepTimerMode,
    sleepTimerVideos: ctx.sleepTimerVideos,
    sleepTimerVideosLeft: ctx.sleepTimerVideosLeft,
    sleepTimerFade: ctx.sleepTimerFade,
    feedKeys: ctx.feedKeys !== false,
    idlePause: ctx.idlePause,
    keepAwake: ctx.keepAwake,
    keymap: {
      ...ctx.keymapState,
      profiles: ctx.keymapState.profiles.map((profile) => ({ ...profile })),
      rows: ctx.keymapState.rows.map((row) => ({ ...row })),
    },
    subtitles: { ...ctx.subtitles },
    videoDate: ctx.videoDate,
    videoQuality: { ...ctx.videoQuality },
    hardwareVideo: { ...ctx.hardwareVideo },
    qr: ctx.qr ? { url: ctx.qr.url, count: ctx.qr.count, rows: ctx.qr.rows.slice() } : null,
    barOnly: ctx.barOnly,
    audioDevices: ctx.audioDevices.map((device) => ({ ...device })),
    pipTime: ctx.pipTime,
    pipDuration: ctx.pipDuration,
    autostart: ctx.autostart,
    linkHandler: {
      available: process.platform === 'linux' && !process.env.FLATPAK_ID,
      enabled: ctx.linkHandler,
    },
    startInTray: ctx.startInTray,
    adsSkip: ctx.adsSkip,
    adsInPip: ctx.adsInPip,
    adsSkipped: ctx.adsSkipped,
    adJournal: ctx.adJournal.slice(),
    stickers: {
      items: ctx.stickers.items.map((item) => ({ ...item })),
      dir: ctx.stickers.dir,
    },
    region: { ...ctx.region },
    regionCheck: { ...ctx.regionCheck },
    regions: STATIC_REGIONS,
    language: ctx.language,
    siteLanguage: ctx.siteLanguage,
    languages: STATIC_LANGUAGES,
    siteLanguages: STATIC_SITE_LANGUAGES,
    plugins: {
      ...ctx.plugins,
      items: ctx.plugins.items.map((item) => ({ ...item })),
      rows: ctx.plugins.rows.map((row) => ({ ...row })),
      commands: ctx.plugins.commands.map((command) => ({ ...command })),
    },
    appimage: {
      available: Boolean(process.env.APPIMAGE),
      installed: ctx.appimageInstalled,
    },
  };
}

function pushState() {
  try {
    sendToWindow('octo:state', currentState());
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] pushState failed:', err.message);
  }
}

/** Бейдж непрочитанных на иконке приложения (macOS, Linux с Unity-лончером). */
function setUnread(count) {
  const next = Math.max(0, Number(count) || 0);
  if (next === ctx.unread) return;
  const previous = ctx.unread;
  ctx.unread = next;
  logger.info('notify', 'unread changed', { previous, next });
  try {
    app.setBadgeCount(next);
  } catch {
    /* платформа не поддерживает бейджи */
  }
  try {
    // Ленивый require: notifications сам зависит от app-context.
    require('./notifications').onUnread(previous, next);
  } catch {
    /* уведомления не критичны */
  }
  pushState();
}

module.exports = {
  ctx,
  sendToWindow,
  toast,
  layout,
  layoutSoon,
  setChromeHeight,
  setPanelOpen,
  setPluginsOpen,
  setPluginDialogOpen,
  setAppDialogOpen,
  setPopover,
  setPaletteOpen,
  setWelcomeOpen,
  applyWelcomeAudio,
  setCosmeticsState,
  setPluginsState,
  setCloseToTray,
  setUiScale,
  clampUiScale,
  syncViewVisibility,
  contentWidth,
  chatWidthLimit,
  canGoBack,
  canGoForward,
  stepHistory,
  currentState,
  pushState,
  setUnread,
};
