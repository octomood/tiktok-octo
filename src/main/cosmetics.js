'use strict';

/**
 * Косметический слой.
 *
 * Мы не трогаем трафик и не подменяем поведение сайта: только прячем
 * бесполезные в десктоп-клиенте промо-блоки и приводим мелочи (скроллбары,
 * лишние разделы навигации) к виду приложения.
 *
 * Правила применяются поверх документа сайта как user-origin CSS, поэтому
 * перебивают стили TikTok без !important на каждый селектор. Текстовые промо
 * нельзя выбрать CSS'ом — их помечает маленький скрипт в контексте страницы,
 * а прячет уже наше правило по атрибуту.
 */

const fs = require('node:fs');
const path = require('node:path');

const { ctx, setCosmeticsState } = require('./app-context');
const { readState, writeState } = require('./store');
const { COSMETIC_RULES } = require('./cosmetic-catalog');
const { evalInPage } = require('./page-eval');

const PROMO_MARK = 'data-octo-promo';
const BRAND_MARK = 'data-octo-brand';

// Подписи кнопок, которые в десктоп-клиенте ведут в никуда.
const PROMO_LABELS = [
  'скачать приложение',
  'download app',
  'get app',
  'открыть приложение',
  'open app',
  'открыть в приложении',
  'open in app',
  'смотреть в приложении',
  'watch in app',
];

const PROMO_JS = `(() => {
  const MARK = '${PROMO_MARK}';
  const LABELS = new Set(${JSON.stringify(PROMO_LABELS)});
  const norm = (value) => (value || '')
    .replace(/\\u00a0/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (window.__octoPromo) {
    window.__octoPromo.scan();
    return 0;
  }

  const observers = [];
  const observedSidebars = new WeakSet();

  function observeSidebar() {
    const sidebar = document.querySelector('[class*="DivSideNavContainer"]');
    if (!sidebar || observedSidebars.has(sidebar)) return;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleScan();
    });
    observer.observe(sidebar, { childList: true, subtree: true });
    observedSidebars.add(sidebar);
    observers.push(observer);
  }

  function scan() {
    observeSidebar();
    const nodes = document.querySelectorAll(
      'a, button, [role="button"], [class*="item__"], [class*="Item"]',
    );
    let hidden = 0;

    for (const node of nodes) {
      if (node.hasAttribute(MARK)) continue;
      const text = norm(node.innerText);
      if (!text || text.length > 40 || !LABELS.has(text)) continue;
      if (node.closest('[role="dialog"], [aria-modal="true"]')) continue;

      // Поднимаемся, пока текст остаётся тем же: прячем всю плашку, а не букву.
      // Но не заходим в навигацию TikTok: в свёрнутом сайдбаре единственный
      // текст может быть именно промо, и мы случайно спрячем весь рельс.
      const looksLikeNav = (element) =>
        element instanceof Element &&
        (element.matches(
          'nav, aside, [class*="SideNav"], [class*="Sidebar"], [class*="side-nav"]',
        ) ||
          element.querySelector('[data-e2e^="nav-"]'));

      let target = node;
      while (target.parentElement && norm(target.parentElement.innerText) === text) {
        const parent = target.parentElement;
        if (looksLikeNav(parent)) break;

        const rect = parent.getBoundingClientRect();
        if (rect.width > 420 || rect.height > 120) break;

        target = parent;
      }

      if (looksLikeNav(target)) continue;

      // Плавающий баннер «открыть в приложении» прячем целиком, но только
      // если это действительно компактный баннер, а не фиксированный сайдбар.
      let fixed = target;
      for (let depth = 0; depth < 6 && fixed; depth += 1) {
        if (getComputedStyle(fixed).position === 'fixed') break;
        fixed = fixed.parentElement;
      }
      if (fixed && getComputedStyle(fixed).position === 'fixed') {
        const fixedRect = fixed.getBoundingClientRect();
        if (
          !looksLikeNav(fixed) &&
          fixedRect.width <= 520 &&
          fixedRect.height <= 220 &&
          norm(fixed.innerText).length < 200
        ) {
          target = fixed;
        }
      }

      if (target.closest('[role="dialog"], [aria-modal="true"]')) continue;

      target.setAttribute(MARK, '');
      hidden += 1;
      if (hidden >= 4) break;
    }

    return hidden;
  }

  let timer = null;
  const scheduleScan = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, 400);
  };

  // Промо дорисовывается лениво: следим за сайдбаром целиком, а по body —
  // только за узлами, похожими на баннер (иначе скан на каждое видео).
  const looksLikePromo = (node) => {
    if (node.nodeType !== 1) return false;
    const cls = node.getAttribute('class') || '';
    if (/promo|banner|download|sidenav|sidebar/i.test(cls)) return true;
    return /скачать|download|get app|open app|открыть в приложении|open in app|watch in app/i.test(
      node.textContent || '',
    );
  };

  if (document.body) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (looksLikePromo(node)) {
            scheduleScan();
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observers.push(observer);
  }

  window.__octoPromo = {
    scan,
    stop() {
      observers.forEach((observer) => observer.disconnect());
      if (timer) clearTimeout(timer);
      document.querySelectorAll('[' + MARK + ']').forEach((el) => el.removeAttribute(MARK));
      delete window.__octoPromo;
    },
  };

  scan();
  return 1;
})()`;

const PROMO_CLEANUP_JS = `(() => {
  if (window.__octoPromo) {
    window.__octoPromo.stop();
    return;
  }
  document
    .querySelectorAll('[${PROMO_MARK}]')
    .forEach((el) => el.removeAttribute('${PROMO_MARK}'));
})()`;

/**
 * Логотип бренда вместо знака TikTok.
 *
 * Сайт рисует логотип инлайновым SVG в двух слотах: узком рельсе навигации
 * (26×28) и широкой шапке или развёрнутом рельсе (118×42). SVG прячем, а рядом
 * ставим свой PNG: в широком слоте — полный локап «tt-octo», в узком — только
 * знак приложения. Ширину слота читаем у ближайшего контейнера навигации, чтобы
 * переключаться вместе с разворотом рельса.
 *
 * Картинки уходят в страницу data: URI: CSP TikTok разрешает data: в img-src,
 * а file:// с https-страницы всё равно не загрузится.
 */
const BRAND_ASSETS = {
  full: path.join(__dirname, '../renderer/assets/octo-logo-full.png'),
  mark: path.join(__dirname, '../renderer/assets/octo-logo-mark.png'),
};

function dataUri(file) {
  try {
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return '';
  }
}

// Уже свёрнутый рельс — 72 px, развёрнутый заметно шире.
const BRAND_WIDE_MIN = 140;

function brandScript() {
  const full = dataUri(BRAND_ASSETS.full);
  const mark = dataUri(BRAND_ASSETS.mark);
  if (!full || !mark) return '';

  return `(() => {
  const MARK = '${BRAND_MARK}';
  const IMG = 'data-octo-brand-img';
  const FULL = ${JSON.stringify(full)};
  const MARK_SRC = ${JSON.stringify(mark)};
  const WIDE_MIN = ${BRAND_WIDE_MIN};

  if (window.__octoBrand) {
    window.__octoBrand.scan();
    return 0;
  }

  const railOf = (anchor) => anchor.closest('[class*="DivSideNavContainer"]');

  // Широкий слот — развёрнутый рельс; без рельса логотип стоит в шапке.
  function variantOf(anchor) {
    const rail = railOf(anchor);
    const width = rail ? rail.getBoundingClientRect().width : window.innerWidth;
    return width >= WIDE_MIN ? 'full' : 'mark';
  }

  // Тема сайта: у TikTok две палитры, и светлая не видна стеклянному знаку.
  function lightTheme() {
    const bg = getComputedStyle(document.body || document.documentElement).backgroundColor;
    const parts = (bg.match(/[\\d.]+/g) || []).map(Number);
    if (parts.length < 3) return false;
    const lum = 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    return lum > 140;
  }

  function paint(anchor) {
    const variant = variantOf(anchor);
    const svg = anchor.querySelector('svg');
    if (svg && svg.style.display !== 'none') svg.style.display = 'none';

    let img = anchor.querySelector('img[' + IMG + ']');
    if (!img) {
      img = document.createElement('img');
      img.setAttribute(IMG, variant);
      img.alt = '';
      img.draggable = false;
      anchor.appendChild(img);
    }

    if (img.getAttribute(IMG) !== variant) {
      img.setAttribute(IMG, variant);
      img.removeAttribute('src');
    }
    if (!img.getAttribute('src')) img.src = variant === 'full' ? FULL : MARK_SRC;

    const height = variant === 'full' ? 42 : 28;
    img.style.cssText =
      'display:block;flex:none;width:auto;max-width:none;' +
      'height:' + height + 'px;pointer-events:none;-webkit-user-drag:none;' +
      // Стекло светлое: на светлой теме сайта его нужно вывернуть.
      'filter:' + (lightTheme() ? 'invert(1) brightness(0.8)' : 'none') + ';';
    anchor.setAttribute(MARK, variant);
  }

  const observed = new WeakSet();
  const resizers = [];

  function observe(rail) {
    if (!rail || observed.has(rail) || typeof ResizeObserver === 'undefined') return;
    observed.add(rail);
    const observer = new ResizeObserver(schedule);
    observer.observe(rail);
    resizers.push(observer);
  }

  let timer = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, 120);
  };

  function scan() {
    const anchors = document.querySelectorAll('[data-e2e="tiktok-logo"]');
    anchors.forEach((anchor) => {
      paint(anchor);
      observe(railOf(anchor));
    });
    return anchors.length;
  }

  // Рельс и шапка пересоздаются при смене раскладки — ловим это по контейнерам,
  // а редкий таймер страхует от замены самого SVG без нового контейнера.
  const looksLikeBrand = (node) =>
    node.nodeType === 1 &&
    (node.matches('a[data-e2e="tiktok-logo"]') ||
      node.matches('[class*="DivSideNavContainer"], [class*="DivHeaderContainer"]'));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (looksLikeBrand(node)) {
          schedule();
          return;
        }
      }
      if (mutation.target && mutation.target.closest && mutation.target.closest('[data-e2e="tiktok-logo"]')) {
        schedule();
        return;
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  const heartbeat = setInterval(scan, 3000);

  window.__octoBrand = {
    scan,
    stop() {
      observer.disconnect();
      resizers.forEach((resizer) => resizer.disconnect());
      clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
      document.querySelectorAll('[data-e2e="tiktok-logo"]').forEach((anchor) => {
        anchor.querySelectorAll('img[' + IMG + ']').forEach((img) => img.remove());
        const svg = anchor.querySelector('svg');
        if (svg) svg.style.display = '';
        anchor.removeAttribute(MARK);
      });
      delete window.__octoBrand;
    },
  };

  scan();
  return 1;
})()`;
}

const BRAND_CLEANUP_JS = `(() => {
  if (window.__octoBrand) {
    window.__octoBrand.stop();
    return;
  }
  document.querySelectorAll('img[data-octo-brand-img]').forEach((img) => img.remove());
  document.querySelectorAll('[data-e2e="tiktok-logo"]').forEach((anchor) => {
    const svg = anchor.querySelector('svg');
    if (svg) svg.style.display = '';
    anchor.removeAttribute('${BRAND_MARK}');
  });
})()`;

const SCROLLBAR_CSS = `
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.26) transparent;
  }
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.24);
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.36);
    background-clip: content-box;
  }
  ::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

const FONT_CSS_FILE = path.join(__dirname, '../renderer/fonts.css');
const FONT_DIR = path.join(__dirname, '../renderer/assets/fonts');

/**
 * Тот же Inter, что и в оболочке, но для страницы сайта.
 *
 * Шрифты вшиваются в CSS как data: URI (CSP TikTok может их не пропустить —
 * тогда просто останется системный стек). Меняем только body и поля ввода,
 * чтобы не задеть иконочные шрифты самого TikTok.
 */
function siteFontCss() {
  const stack = `'Inter', 'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif`;
  const bodyRule = `body { font-family: ${stack} !important; }
input, textarea, select { font-family: ${stack} !important; }`;

  try {
    const css = fs.readFileSync(FONT_CSS_FILE, 'utf8');
    const embedded = css.replace(/url\('assets\/fonts\/([^']+)'\)/g, (_match, name) => {
      const file = path.join(FONT_DIR, name);
      return `url('data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}')`;
    });
    return `${embedded}\n${bodyRule}`;
  } catch {
    return bodyRule;
  }
}

const IMPLEMENTATIONS = {
  'octo-brand': {
    css: '[data-octo-brand] > svg { display: none !important; }',
    js: brandScript(),
    cleanupJs: BRAND_CLEANUP_JS,
  },
  'modern-font': { css: siteFontCss() },
  'hide-app-promo': {
    css: `[${PROMO_MARK}] { display: none !important; }`,
    js: PROMO_JS,
    cleanupJs: PROMO_CLEANUP_JS,
  },
  'dark-scrollbars': { css: SCROLLBAR_CSS },
  // data-e2e у TikTok стабильнее хешированных классов.
  'hide-live-nav': { css: 'h2:has([data-e2e="nav-live"]) { display: none !important; }' },
  'hide-drama-nav': { css: 'h2:has([data-e2e="nav-short-drama"]) { display: none !important; }' },
};

/**
 * @type {Array<{
 *   id: string,
 *   label: string,
 *   default: boolean,
 *   css?: string,
 *   js?: string,
 *   cleanupJs?: string,
 * }>}
 */
const RULES = COSMETIC_RULES.map((rule) => ({ ...rule, ...(IMPLEMENTATIONS[rule.id] || {}) }));

let insertedKeys = [];
let generation = 0;
let timer = null;
let scriptTimer = null;
let onChange = null;

function settings() {
  const value = readState().cosmetics;
  return value && typeof value === 'object' ? value : {};
}

function isEnabled(id) {
  const rule = RULES.find((candidate) => candidate.id === id);
  if (!rule) return false;
  const saved = settings()[id];
  return saved === undefined ? rule.default : saved === true;
}

/** Дымовой тест и отладка могут подменить состояние без записи на диск. */
function setOnChange(callback) {
  onChange = callback;
}

async function apply() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  const currentGeneration = ++generation;
  const previous = insertedKeys;
  insertedKeys = [];

  await Promise.all(previous.map((key) => wc.removeInsertedCSS(key).catch(() => {})));
  if (currentGeneration !== generation) return;

  const enabled = RULES.filter((rule) => isEnabled(rule.id));
  const css = enabled
    .map((rule) => rule.css || '')
    .filter(Boolean)
    .join('\n');

  if (css.trim()) {
    try {
      const key = await wc.insertCSS(css, { cssOrigin: 'user' });
      if (currentGeneration === generation) insertedKeys.push(key);
    } catch {
      /* документ сменился между вызовом и вставкой */
    }
  }
  if (currentGeneration !== generation) return;

  runScripts();
}

let scriptRunning = false;

async function runScripts() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed() || scriptRunning) return;

  const enabled = RULES.filter((rule) => isEnabled(rule.id));
  const scripts = [];

  for (const rule of RULES) {
    if (!rule.js) continue;
    if (enabled.includes(rule)) scripts.push(rule.js);
    else if (rule.cleanupJs) scripts.push(rule.cleanupJs);
  }

  if (!scripts.length) return;

  scriptRunning = true;
  try {
    await evalInPage(wc, scripts);
  } finally {
    scriptRunning = false;
  }
}

function scheduleScripts(delay = 500) {
  clearTimeout(scriptTimer);
  scriptTimer = setTimeout(() => {
    runScripts();
  }, delay);
}

/** SPA-переходы и поздние баннеры: пересканировать DOM с небольшой задержкой. */
function schedule(delay = 300) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    apply();
  }, delay);
}

function toggle(id) {
  const rule = RULES.find((candidate) => candidate.id === id);
  if (!rule) return false;

  const next = !isEnabled(id);
  writeState({ cosmetics: { ...settings(), [id]: next } });
  setCosmeticsState(settings());
  apply();
  if (onChange) onChange();
  return next;
}

function menuItems() {
  return RULES.map((rule) => ({
    label: rule.label,
    type: 'checkbox',
    checked: isEnabled(rule.id),
    click: () => toggle(rule.id),
  }));
}

// Интерфейс получает актуальные галочки сразу при старте.
setCosmeticsState(settings());

module.exports = {
  RULES,
  apply,
  schedule,
  scheduleScripts,
  toggle,
  isEnabled,
  menuItems,
  setOnChange,
};
