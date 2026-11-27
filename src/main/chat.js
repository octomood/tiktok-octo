'use strict';

const crypto = require('node:crypto');
const { ipcMain, WebContentsView } = require('electron');
const {
  ctx,
  layout,
  layoutSoon,
  pushState,
  setPanelOpen,
  toast,
  chatWidthLimit,
} = require('./app-context');
const { CHROME_UA, REGION_PRELOAD, CHAT_W, isTikTokUrl } = require('./shared');
const { readState, writeState } = require('./store');
const { openExternal } = require('./links');
const cosmetics = require('./cosmetics');
const autoTheme = require('./auto-theme');
const { evalInPage } = require('./page-eval');

/**
 * Чат в панели слева.
 *
 * TikTok открывает «Сообщения» отдельной страницей на всё окно. В десктоп-
 * клиенте удобнее наоборот: лента остаётся на месте и продолжает играть, а
 * переписка занимает узкую панель слева. Панель — это тот же сайт в отдельном
 * WebContentsView с общей сессией, поэтому логин, тема и стикеры уже на месте.
 *
 * Один клик по «Сообщениям» на сайте открывает панель, второй клик двойного
 * нажатия уводит на обычную страницу сообщений: сайт не патчим и не подменяем
 * его данные, только перехватываем сам клик по ссылке.
 */

const DEFAULT_CHAT_URL = 'https://www.tiktok.com/messages';
const MESSAGES_PATH = /^\/messages(?:\/|$)/;
const BUSINESS_CHAT_PATH = /^\/business-suite\/?(?:messages|inbox|chat)?(?:\/|$)/i;
const BUSINESS_HOST = /^business\.tiktok\.com$/i;
const BUSINESS_SUB_CHAT_PATH = /^\/(?:$|messages|inbox|chat|i18n|creator)(?:\/|$)/i;

// Метка в console.log, по которой страница просит открыть панель. Токен
// защищает от случайных сообщений сайта и вложенных фреймов: подделать его
// из чужого фрейма нельзя, а эффект ограничен открытием панели.
const SIGNAL_PREFIX = 'OCTO_CHAT';
const signalToken = crypto.randomBytes(8).toString('hex');

// На странице сообщений прячем глобальную навигацию и шапку TikTok: в панели
// они съедают место, оставляя от списка переписок узкую полоску. Тёмную тему,
// шрифт, скроллбары и скрытие промо даёт общий косметический слой — его
// применяем к панели так же, как к основному окну (см. applyChatStyles).
const PANEL_CSS = `
  [class*="DivSideNavContainer"],
  [class*="DivHeaderContainer"],
  [data-e2e="tiktok-logo"] {
    display: none !important;
  }
  [class*="DivBodyContainer"] {
    margin: 0 !important;
    padding: 0 !important;
  }
  html, body {
    min-width: 0 !important;
    overflow-x: hidden !important;
  }
`;

const attached = new WeakSet();

// Ширина панели: слишком узкая не помещает диалог, слишком широкая съедает ленту.
const MIN_WIDTH = 300;
const MAX_WIDTH = 980;

// Запас, чтобы у правого края диалога не оставалось обрезанной рамки.
const FIT_MARGIN = 8;
// Страница сообщений дорисовывается не мгновенно: меряем ещё раз чуть позже.
const FIT_DELAYS = [500, 1600];

/** Ширина и режим «док» живут в состоянии и переживают перезапуск. */
function syncPrefs() {
  const saved = readState();
  const width = Number(saved.chatWidth);
  ctx.chatWidth = Number.isFinite(width)
    ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
    : CHAT_W;
  ctx.chatDock = saved.chatDock !== false;
}

function setWidth(value) {
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(Number(value) || CHAT_W)));
  // Пользователь выбрал ширину руками — до следующего открытия панели её не
  // трогаем, даже когда внутри страницы открывается другая переписка.
  manualWidth = true;
  cancelFit();
  if (width === ctx.chatWidth) return;
  ctx.chatWidth = width;
  writeState({ chatWidth: width });
  layoutSoon();
  pushState();
}

/**
 * Сколько ширины просит страница сообщений. Панель — тот же сайт, и его
 * список переписок с диалогом не всегда сжимаются до ширины панели: они
 * уезжают под горизонтальную прокрутку, поэтому аватарки и поле ввода
 * обрезаются. `scrollWidth` самой страницы этого не видит — прокрутка живёт
 * во внутреннем контейнере, поэтому ищем крупные горизонтальные скроллеры.
 */
const MEASURE_SCRIPT = `(() => {
  const view = window.innerWidth;
  const doc = document.documentElement;
  const body = document.body;
  let need = Math.max(
    view,
    doc ? doc.scrollWidth : 0,
    body ? body.scrollWidth : 0,
  );

  // Поле сообщения в сжатой колонке. Когда всё «помещается», но диалог
  // сдавлен до пары слов, прокрутки нет — расширяем по ширине поля.
  const COMFORT_FIELD = 280;
  let field = null;
  const fields = document.querySelectorAll(
    '[contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], textarea',
  );
  for (const item of fields) {
    const rect = item.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 12) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    if (!field || rect.bottom > field.bottom) field = rect;
  }
  if (field && field.width < COMFORT_FIELD) {
    need = Math.max(need, field.left + COMFORT_FIELD);
  }

  for (const box of document.querySelectorAll('div, main, section, aside, ul')) {
    if (box.clientWidth < 160 || box.clientHeight < 300) continue;
    if (box.scrollWidth <= box.clientWidth + 4) continue;
    const axis = getComputedStyle(box).overflowX;
    // Только настоящие скроллеры: у скрытых обрезок содержимое может быть
    // шире по своим причинам, и панель бы росла зря.
    if (axis !== 'auto' && axis !== 'scroll') continue;
    const rect = box.getBoundingClientRect();
    need = Math.max(need, rect.left + box.scrollWidth);
  }

  // Кнопки и поля, обрезанные правым краем панели. У страницы сообщений
  // раскладка может не помещаться и без прокрутки: тогда ни scrollWidth,
  // ни скроллеры об этом не сообщают, а кнопка отправки остаётся за краем.
  // Смотрим только элементы у самого края, а не скрытые меню далеко за кадром.
  for (const item of document.querySelectorAll(
    'button, input, textarea, [role="button"], [role="textbox"], [contenteditable="true"]',
  )) {
    if (item.closest('[aria-hidden="true"]')) continue;
    const rect = item.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    if (rect.right <= view + 1) continue;
    if (rect.left > view + 320) continue;
    need = Math.max(need, Math.ceil(rect.right) + 4);
  }

  // Ноль — страница помещается, ширину трогать не нужно.
  return need > view ? Math.ceil(need) : 0;
})()`;

/**
 * Страница сообщений пересобирает раскладку по событию resize окна. Панель —
 * отдельный WebContentsView: её ширина меняется без участия окна, и раскладка
 * иногда остаётся от прежнего размера — список переписок и диалог уезжают под
 * горизонтальную прокрутку, пока пользователь не подёргает край окна. Повторяем
 * это событие изнутри страницы: для сайта это тот же путь, что и ручной resize.
 */
const RELAYOUT_SCRIPT = `(() => {
  window.dispatchEvent(new Event('resize'));
  if (window.visualViewport) {
    try {
      window.visualViewport.dispatchEvent(new Event('resize'));
    } catch {
      /* старый движок без visualViewport */
    }
  }
  return window.innerWidth;
})()`;

// Событие шлём пачкой: layout зовут несколько раз подряд (окно, панель, ручка).
const RELAYOUT_DELAY = 120;
const relayoutTimers = new WeakMap();

function relayoutNow(view) {
  const wc = view && view.webContents;
  if (!wc || wc.isDestroyed() || !ctx.chatOpen) return;
  evalInPage(wc, [RELAYOUT_SCRIPT]);
}

function relayout(view) {
  if (!view || !ctx.chatOpen || relayoutTimers.has(view)) return;
  const timer = setTimeout(() => {
    relayoutTimers.delete(view);
    relayoutNow(view);
  }, RELAYOUT_DELAY);
  relayoutTimers.set(view, timer);
}

// app-context зовёт это после смены границ панели: размер изменился, а страница
// об этом может не узнать, если окно не трогали.
ctx.chatRelayout = relayout;

// Поколение отменяет отложенный замер, если панель закрыли или потянули за
// полоску: ручная ширина важнее автоматической.
let fitGeneration = 0;
let fitTimers = [];
// Ширину выставили мышью: автоподбор молчит, пока панель не откроют заново.
let manualWidth = false;
// Последнее расширение автоподбором: если после него страница просит столько же
// сверх новой ширины, элемент едет вместе с краем (скрытое меню у правой
// границы), и расти дальше бессмысленно — только отнимаем место у ленты.
let lastGrowth = null;

function cancelFit() {
  fitGeneration += 1;
  for (const timer of fitTimers) clearTimeout(timer);
  fitTimers = [];
}

function measureFrame(frame) {
  try {
    return frame
      .executeJavaScript(MEASURE_SCRIPT, false)
      .then((value) => (Number.isFinite(value) ? Math.round(value) : 0))
      .catch(() => 0);
  } catch {
    return Promise.resolve(0);
  }
}

async function measureNeed(wc) {
  let maxNeed = await wc
    .executeJavaScript(MEASURE_SCRIPT, false)
    .then((value) => (Number.isFinite(value) ? Math.round(value) : 0))
    .catch(() => 0);

  let frames = [];
  try {
    frames = wc.mainFrame.framesInSubtree || [];
  } catch {
    frames = [];
  }
  const subframes = frames.filter((frame) => {
    if (!frame || frame === wc.mainFrame) return false;
    const url = frame.url || '';
    return url.startsWith('about:') || isTikTokUrl(url);
  });
  if (subframes.length) {
    const extra = await Promise.all(subframes.map(measureFrame));
    for (const value of extra) {
      if (value > maxNeed) maxNeed = value;
    }
  }
  return maxNeed;
}

/**
 * Подогнать панель под страницу сообщений: расширяемся до тех пор, пока
 * диалог влезает, но не больше MAX_WIDTH и не в ущерб ленте (в доке). Панель
 * только растёт — вручную выставленную широкую ширину замер не откатывает.
 */
function scheduleFit(view, { immediate = true } = {}) {
  cancelFit();
  if (manualWidth) return;
  if (!view || view.webContents.isDestroyed()) return;
  const wc = view.webContents;
  const generation = fitGeneration;

  const run = async () => {
    if (generation !== fitGeneration || wc.isDestroyed() || !ctx.chatOpen) return;
    // Сначала просим страницу пересобрать раскладку под текущую ширину: иначе
    // замер увидит старую, слишком широкую раскладку и раздует панель зря.
    relayoutNow(view);
    await new Promise((resolve) => setTimeout(resolve, RELAYOUT_DELAY));
    if (generation !== fitGeneration || wc.isDestroyed() || !ctx.chatOpen) return;
    const need = await measureNeed(wc);
    if (!need || generation !== fitGeneration || wc.isDestroyed() || !ctx.chatOpen) return;

    const prev = lastGrowth && lastGrowth.generation === generation ? lastGrowth : null;
    if (prev && ctx.chatWidth === prev.to && need - prev.need >= prev.to - prev.from - 4) {
      // Расширение не помогло: возвращаем ширину до погони и больше не меряем.
      lastGrowth = null;
      cancelFit();
      ctx.chatWidth = prev.from;
      layoutSoon();
      pushState();
      return;
    }

    const limit = Math.min(MAX_WIDTH, chatWidthLimit());
    const next = Math.min(limit, need + FIT_MARGIN);
    if (next <= ctx.chatWidth) return;

    lastGrowth = { generation, from: ctx.chatWidth, to: next, need };
    ctx.chatWidth = next;
    layoutSoon();
    pushState();
  };

  fitTimers = FIT_DELAYS.map((delay) => setTimeout(run, delay));
  if (immediate) run();
}

function toggleDock() {
  ctx.chatDock = !ctx.chatDock;
  writeState({ chatDock: ctx.chatDock });
  layoutSoon();
  pushState();
  if (ctx.chatOpen) scheduleFit(ctx.chatView);
  toast(ctx.chatDock ? 'Чат поджимает ленту' : 'Чат поверх ленты');
}

/** Файлы, брошенные на панель чата: отправляем как фото по одному. */
async function sendFiles(paths) {
  if (!ctx.chatOpen) {
    toast('Откройте чат, чтобы отправить файл');
    return;
  }
  const list = Array.isArray(paths) ? paths.filter((item) => typeof item === 'string') : [];
  if (!list.length) return;

  const stickers = require('./stickers');
  for (const file of list) {
    await stickers.sendFile(file);
  }
}

function chatAddress() {
  // Тесты подменяют адрес локальной страницей, чтобы не ходить в сеть.
  return process.env.OCTO_CHAT_URL || DEFAULT_CHAT_URL;
}

function isMessagesUrl(rawUrl) {
  if (!isTikTokUrl(rawUrl)) return false;
  try {
    return MESSAGES_PATH.test(new URL(rawUrl).pathname);
  } catch {
    return false;
  }
}

function isChatPanelUrl(rawUrl) {
  if (!isTikTokUrl(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    if (MESSAGES_PATH.test(parsed.pathname) || BUSINESS_CHAT_PATH.test(parsed.pathname)) {
      return true;
    }
    return BUSINESS_HOST.test(parsed.hostname) && BUSINESS_SUB_CHAT_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isMainFrameEvent(event, isMainFrame) {
  return typeof event?.isMainFrame === 'boolean' ? event.isMainFrame : isMainFrame !== false;
}

// Двойной клик уводит на полноценную страницу сообщений: переходы на этот путь
// в ближайшие секунды не перехватываем, иначе панель откатит страницу назад.
let pendingFull = null;

function allowFullNavigation(url) {
  try {
    pendingFull = { path: new URL(url).pathname, until: Date.now() + 5000 };
  } catch {
    pendingFull = null;
  }
}

function fullNavigationAllowed(url) {
  if (!pendingFull || Date.now() > pendingFull.until) return false;
  try {
    return new URL(url).pathname === pendingFull.path;
  } catch {
    return false;
  }
}

/**
 * Переход основной страницы на /messages. Возвращает true, если переход нужно
 * отменить: панель уже открыта. Сработает, даже если клик по ссылке успел
 * проскочить мимо нашего перехватчика в странице.
 *
 * `fromUrl` — страница, с которой уходим. Если она уже была сообщениями,
 * это внутренний переход самой страницы (выбор переписки), его не трогаем.
 */
function interceptNavigation(url, fromUrl) {
  if (!isMessagesUrl(url)) return false;
  if (isMessagesUrl(fromUrl)) return false;
  if (ctx.htmlFullscreen || ctx.pipActive) return false;
  if (fullNavigationAllowed(url)) return false;
  open(url);
  return true;
}

function addressFor(rawUrl) {
  if (process.env.OCTO_CHAT_URL) return process.env.OCTO_CHAT_URL;
  return isMessagesUrl(rawUrl) ? rawUrl : chatAddress();
}

/**
 * Скрипт в странице перехватывает клик по ссылке «Сообщения» до роутера
 * сайта. Иначе React успевает сменить маршрут, и страница сообщений уже
 * занимает всё окно. detail > 1 — это второй клик двойного нажатия.
 */
function linkScript() {
  return `(() => {
  if (window.__octoChatLinks) return 0;
  // На самой странице сообщений и в Business Suite перехватывать нечего.
  if (
    /^\\/(?:messages|business-suite)(?:\\/|$)/i.test(location.pathname) ||
    /(^|\\.)business\\.tiktok\\.com$/i.test(location.hostname)
  ) {
    return 0;
  }
  const TOKEN = ${JSON.stringify(signalToken)};
  const isMessages = (raw) => {
    try {
      const url = new URL(raw);
      return /(^|\\.)tiktok\\.com$/.test(url.hostname) && /^\\/messages(?:\\/|$)/.test(url.pathname);
    } catch {
      return false;
    }
  };
  const hrefOf = (target) => {
    if (!(target instanceof Element)) return null;
    let anchor = target.closest('a[href]');
    let href = anchor ? anchor.href : '';
    if (!isMessages(href)) {
      // Business Suite рисует разделы не ссылками: ищем пункт по data-e2e.
      const item = target.closest('[data-e2e*="message"], [data-e2e*="inbox"]');
      anchor = item ? item.closest('a[href]') : null;
      href = anchor ? anchor.href : '';
      if (!href && !item) {
        // Запасной путь для пункта без ссылки и e2e: подпись «Сообщения».
        const item2 = target.closest('a, button, [role="button"], [role="link"], [data-e2e]');
        if (!item2) return null;
        const text = (item2.innerText || '').trim().toLowerCase();
        const aria = (
          item2.getAttribute('aria-label') ||
          item2.getAttribute('title') ||
          ''
        ).toLowerCase();
        const byText = /^(сообщения|messages|inbox|direct messages)\b/.test(text);
        const byAria = /(messages|сообщен|inbox|direct)/.test(aria);
        if (!byText && !byAria) return null;
      }
      if (!isMessages(href)) href = 'https://www.tiktok.com/messages';
    }
    return href;
  };
  let pending = null;
  // Сайт может открыть своё окно сообщений раньше click — на pointerdown или
  // mousedown. Перехватываем и эти фазы, иначе поверх панели появляется его
  // собственный чат. preventDefault здесь не нужен: click должен состояться.
  const onPress = (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (!hrefOf(event.target)) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  const onClick = (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const href = hrefOf(event.target);
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const signal = (full) => {
      try {
        console.log('${SIGNAL_PREFIX} ' + TOKEN + ' ' + JSON.stringify({ url: href, full }));
      } catch {
        /* консоль могла быть подменена страницей */
      }
    };

    clearTimeout(pending);
    if (event.detail > 1) {
      // Второй клик двойного нажатия: обычная страница сообщений.
      signal(true);
      pending = null;
      return;
    }

    // Панель перекроет саму ссылку, поэтому даём второму клику двойного
    // нажатия дойти до страницы, и только потом открываем панель.
    pending = setTimeout(() => {
      pending = null;
      signal(false);
    }, 280);
  };
  document.addEventListener('click', onClick, true);
  window.addEventListener('pointerdown', onPress, true);
  window.addEventListener('pointerup', onPress, true);
  window.addEventListener('mousedown', onPress, true);
  window.addEventListener('mouseup', onPress, true);
  window.addEventListener('click', onClick, true);
  window.__octoChatLinks = {
    stop() {
      clearTimeout(pending);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('pointerup', onPress, true);
      window.removeEventListener('mousedown', onPress, true);
      window.removeEventListener('mouseup', onPress, true);
      window.removeEventListener('click', onClick, true);
      delete window.__octoChatLinks;
    },
  };
  return 1;
})()`;
}

function injectLinks(wc, script) {
  if (!wc || wc.isDestroyed()) return;
  const run = (frame) => {
    try {
      frame.executeJavaScript(script, false).catch(() => {});
    } catch {
      /* фрейм уже ушёл */
    }
  };

  run(wc.mainFrame);

  let frames = [];
  try {
    frames = wc.mainFrame.framesInSubtree || [];
  } catch {
    frames = [];
  }
  for (const frame of frames) {
    if (!frame || frame === wc.mainFrame) continue;
    const url = frame.url || '';
    // В чужие фреймы (капча, платёжные виджеты) не лезем.
    if (!url.startsWith('about:') && !isTikTokUrl(url)) continue;
    run(frame);
  }
}

/** Слушаем страницу сайта, из которой открывают «Сообщения». */
function attach(wc) {
  if (!wc || wc.isDestroyed() || attached.has(wc)) return;
  attached.add(wc);

  wc.on('console-message', (event) => {
    const message = event && event.message;
    if (typeof message !== 'string') return;
    const prefix = `${SIGNAL_PREFIX} ${signalToken} `;
    if (!message.startsWith(prefix)) return;

    let payload;
    try {
      payload = JSON.parse(message.slice(prefix.length));
    } catch {
      return;
    }
    if (!payload || !isMessagesUrl(payload.url)) return;

    if (payload.full) openFull(payload.url);
    else open(payload.url);
  });

  const inject = () => injectLinks(wc, linkScript());
  wc.on('dom-ready', inject);
  wc.on('did-frame-finish-load', inject);
  wc.on('did-navigate-in-page', inject);
  inject();
}

/**
 * Панель чата — часть приложения, а не отдельный браузер: применяем к ней тот
 * же косметический слой (тёмная тема, Inter, скроллбары, скрытие промо), что и
 * к ленте, плюс собственные правила компактной раскладки.
 */
const panelCssKeys = new WeakMap();

const PANEL_FRAME_SCRIPT = `(() => {
  const CSS = ${JSON.stringify(PANEL_CSS)};
  const ID = 'octo-chat-panel-css';
  const root = document.head || document.documentElement;
  if (!root) return false;
  let style = document.querySelector('style#' + ID);
  if (!style) {
    style = document.createElement('style');
    style.id = ID;
    root.appendChild(style);
  }
  if (style.textContent !== CSS) style.textContent = CSS;
  return true;
})()`;

function injectPanelFrameStyles(wc) {
  if (!wc || wc.isDestroyed()) return;
  let frames = [];
  try {
    frames = wc.mainFrame.framesInSubtree || [];
  } catch {
    frames = [];
  }
  for (const frame of frames) {
    if (!frame || frame === wc.mainFrame) continue;
    const url = frame.url || '';
    if (!url.startsWith('about:') && !isTikTokUrl(url)) continue;
    try {
      frame.executeJavaScript(PANEL_FRAME_SCRIPT, false).catch(() => {});
    } catch {
      /* фрейм уже ушёл */
    }
  }
}

function applyChatStyles(wc) {
  if (!wc || wc.isDestroyed()) return;

  const prev = panelCssKeys.get(wc);
  // Вставляем новый CSS до удаления прежнего, чтобы страница не мигала без стилей.
  wc.insertCSS(PANEL_CSS, { cssOrigin: 'user' })
    .then((key) => {
      if (wc.isDestroyed()) {
        wc.removeInsertedCSS(key).catch(() => {});
        return;
      }
      panelCssKeys.set(wc, key);
      if (prev && prev !== key) wc.removeInsertedCSS(prev).catch(() => {});
    })
    .catch(() => {
      /* документ сменился между вызовом и вставкой */
    });
  injectPanelFrameStyles(wc);
  cosmetics.apply(wc);
  autoTheme.sync(wc).catch(() => {});
}

function ensureView() {
  if (ctx.chatView && !ctx.chatView.webContents.isDestroyed()) return ctx.chatView;
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view || ctx.view.webContents.isDestroyed()) {
    return null;
  }

  const main = ctx.view.webContents;
  const view = new WebContentsView({
    webPreferences: {
      session: main.session,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // Переписка не должна замирать, пока лента в фокусе.
      backgroundThrottling: false,
      // Тот же безобидный preload региона, что и у основного view.
      preload: REGION_PRELOAD,
    },
  });

  ctx.chatView = view;
  ctx.win.contentView.addChildView(view);
  view.setBackgroundColor('#000000');

  const wc = view.webContents;
  wc.setUserAgent(CHROME_UA);
  // Тёмная тема включается до первой загрузки, иначе страница сообщений
  // успевает мигнуть белым.
  autoTheme.sync(wc).catch(() => {});

  wc.on('dom-ready', () => applyChatStyles(wc));
  wc.on('did-finish-load', () => {
    applyChatStyles(wc);
    scheduleFit(view);
  });
  // Промо и ленивые блоки дорисовываются позже — повторяем, как в ленте.
  wc.on('did-stop-loading', () => {
    setTimeout(() => {
      if (!wc.isDestroyed()) cosmetics.apply(wc);
    }, 1200);
    scheduleFit(view);
  });
  wc.on('did-frame-finish-load', (_event, isMainFrame) => {
    if (!isMainFrame) {
      injectPanelFrameStyles(wc);
      cosmetics.injectFrameStyles(wc).catch(() => {});
      if (ctx.chatView === view && ctx.chatOpen) scheduleFit(view, { immediate: false });
    }
  });
  // Переписка открывается внутри той же страницы: после перехода раскладка
  // сообщений может стать шире, чем была у списка. Иначе правый край диалога
  // остаётся обрезанным до следующего открытия панели.
  wc.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
    if (!isMainFrame) return;
    cosmetics.injectFrameStyles(wc).catch(() => {});
    // Ждём, пока доиграет переход: в момент анимации колонки ещё сдвинуты,
    // и замер поехавших кнопок расширил бы панель зря.
    if (ctx.chatView === view && ctx.chatOpen) scheduleFit(view, { immediate: false });
  });

  // Фокус может быть в переписке — Esc всё равно должен закрывать панель.
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape') return;
    if (input.control || input.meta || input.shift || input.alt) return;
    event.preventDefault();
    close();
  });

  // Ссылки из переписки не должны уводить панель в ленту: внешние открываем
  // в браузере, внутренние TikTok — в основном окне, панель остаётся чатом.
  // Навигации вложенных iframe (Business Suite web_dm, капча, служебные фреймы)
  // пропускаем внутри самой панели, иначе /messages блокируется и уводит ленту.
  wc.on('will-navigate', (event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrameEvent(event, isMainFrame)) return;
    if (isTikTokUrl(url)) {
      if (isChatPanelUrl(url)) return;
      event.preventDefault();
      const target = ctx.view && ctx.view.webContents;
      if (target && !target.isDestroyed()) target.loadURL(url).catch(() => {});
      return;
    }
    event.preventDefault();
    openExternal(url);
  });
  wc.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrameEvent(event, isMainFrame)) return;
    if (isTikTokUrl(url) || /^about:blank$/i.test(url)) return;
    event.preventDefault();
    openExternal(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (isTikTokUrl(url)) {
      const target = ctx.view && ctx.view.webContents;
      if (target && !target.isDestroyed()) target.loadURL(url);
    } else {
      openExternal(url);
    }
    return { action: 'deny' };
  });

  wc.on('destroyed', () => {
    if (ctx.chatView === view) {
      ctx.chatView = null;
      ctx.chatOpen = false;
    }
  });

  return view;
}

/** Открыть панель; url — страница сообщений, с которой пришёл клик. */
function open(url) {
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view) return false;
  if (ctx.htmlFullscreen || ctx.pipActive) return false;
  if (ctx.panelOpen) setPanelOpen(false);

  const view = ensureView();
  if (!view) return false;

  const wc = view.webContents;
  const target = addressFor(url);
  const wasOpen = ctx.chatOpen;
  ctx.chatOpen = true;
  // Панель открыли заново — снова доверяем автоподбору, даже если ширину
  // в прошлый раз тянули мышью.
  if (!wasOpen) manualWidth = false;

  if (wc.getURL() !== target) {
    wc.loadURL(target).catch(() => {
      /* окно закрыли во время загрузки */
    });
  }

  layout();
  pushState();
  // Страница могла остаться с прошлого открытия: подгоняем панель под неё же.
  scheduleFit(view);
  try {
    wc.focus();
  } catch {
    /* view ещё не готов */
  }
  return true;
}

/** Двойной клик: обычная страница сообщений на всё окно. */
function openFull(url) {
  close({ focus: false });
  const main = ctx.view && ctx.view.webContents;
  if (!main || main.isDestroyed()) return;
  const target = addressFor(url);
  allowFullNavigation(target);
  main.loadURL(target).catch(() => {
    /* окно закрыли во время загрузки */
  });
  main.focus();
}

function close({ focus = true } = {}) {
  const view = ctx.chatView;
  const wasOpen = ctx.chatOpen || Boolean(view);
  cancelFit();
  ctx.chatView = null;
  ctx.chatOpen = false;

  if (view) {
    try {
      if (ctx.win && !ctx.win.isDestroyed()) ctx.win.contentView.removeChildView(view);
    } catch {
      /* окно уже закрывается */
    }
    try {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    } catch {
      /* webContents уже уничтожен */
    }
  }

  if (!wasOpen) return;

  layoutSoon();
  pushState();
  if (focus && ctx.view && !ctx.view.webContents.isDestroyed()) {
    ctx.view.webContents.focus();
  }
}

function toggle(url) {
  if (ctx.chatOpen) close();
  else open(url);
}

function dispose() {
  close({ focus: false });
}

function resetView() {
  close({ focus: false });
  if (ctx.chatView) {
    try {
      if (ctx.win && !ctx.win.isDestroyed()) ctx.win.contentView.removeChildView(ctx.chatView);
      if (!ctx.chatView.webContents.isDestroyed()) ctx.chatView.webContents.close();
    } catch {
      /* уже уничтожено */
    }
    ctx.chatView = null;
  }
}

// Основной путь: preload страницы присылает адрес «Сообщений» синхронно со
// своего изолированного слушателя. Второй путь — console-сигнал страничного
// fallback-скрипта (см. attach); оба проверяют адрес.
ipcMain.on('octo:chat-open', (event, payload) => {
  if (!ctx.view || event.sender !== ctx.view.webContents) return;
  if (!payload || typeof payload.url !== 'string' || !isMessagesUrl(payload.url)) return;
  if (payload.full) openFull(payload.url);
  else open(payload.url);
});

// Роль страницы: preload включает перетаскивание файлов только в панели чата,
// чтобы не ломать загрузку на самом сайте TikTok.
ipcMain.on('octo:page-role', (event) => {
  const chatView = ctx.chatView;
  event.returnValue = chatView && event.sender === chatView.webContents ? 'chat' : 'feed';
});

// Файл бросили на панель чата — уходит тем же путём, что и стикер.
ipcMain.on('octo:chat-files', (event, payload) => {
  const chatView = ctx.chatView;
  if (!chatView || event.sender !== chatView.webContents) return;
  sendFiles(payload && Array.isArray(payload.paths) ? payload.paths : []);
});

syncPrefs();

module.exports = {
  attach,
  open,
  close,
  toggle,
  dispose,
  resetView,
  interceptNavigation,
  setWidth,
  toggleDock,
  sendFiles,
  syncPrefs,
};
