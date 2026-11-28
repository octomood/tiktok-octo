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

const { BrowserWindow, ipcMain, nativeTheme } = require('electron');
const { ctx, setCosmeticsState, pushState } = require('./app-context');
const { readState, writeState } = require('./store');
const { COSMETIC_RULES } = require('./cosmetic-catalog');
const { evalInPage } = require('./page-eval');
const { isTikTokUrl } = require('./shared');
const autoTheme = require('./auto-theme');
const badges = require('./badges');
const md3Site = require('./md3-site');
const { EMOJI_SCRIPT } = require('./tiktok-emoji');
const {
  getPaletteTokens,
  getIridescentCssTokens,
  listPalettes,
  RAINBOW_PRESETS,
  normalizePaletteId,
  normalizeCustomTheme,
  normalizeRainbowConfig,
} = require('./md3-palettes');

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
      // Сначала проверяем textContent (не вызывает reflow), и только точные
      // кандидаты перепроверяем через innerText.
      const tc = norm(node.textContent);
      if (!tc || tc.length > 120 || !LABELS.has(tc)) continue;
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

  const railOf = (anchor) =>
    anchor.closest('[class*="DivSideNavContainer"], [data-octo-md3-surface="sidenav"]');

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
    anchor.querySelectorAll('svg').forEach((svg) => {
      if (svg.style.display !== 'none') svg.style.display = 'none';
    });

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
    const nextCss =
      'display:block;flex:none;width:auto;max-width:none;' +
      'height:' + height + 'px;pointer-events:none;-webkit-user-drag:none;' +
      // Новый светлый знак на светлой теме затемняем с сохранением лавандового оттенка.
      'filter:' + (lightTheme() ? 'brightness(0.54) contrast(1.38) saturate(1.15)' : 'none') + ';';
    if (img.dataset.octoBrandStyle !== nextCss) {
      img.dataset.octoBrandStyle = nextCss;
      img.style.cssText = nextCss;
    }
    if (anchor.getAttribute(MARK) !== variant) anchor.setAttribute(MARK, variant);
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

  // Рельс и шапка пересоздаются при смене раскладки — ловим это сразу на мутации,
  // чтобы оригинальный SVG TikTok не успевал мигнуть до следующей отрисовки кадра.
  const isSelfBrandImg = (node) => node.nodeType === 1 && node.hasAttribute(IMG);

  const looksLikeBrand = (node) =>
    node.nodeType === 1 &&
    !isSelfBrandImg(node) &&
    (node.matches('[data-e2e="tiktok-logo"]') ||
      Boolean(node.querySelector && node.querySelector('[data-e2e="tiktok-logo"]')) ||
      node.matches(
        '[class*="DivSideNavContainer"], [class*="DivHeaderContainer"], [data-octo-md3-surface="sidenav"]',
      ));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (looksLikeBrand(node)) {
          scan();
          return;
        }
      }
      if (mutation.target && mutation.target.closest && mutation.target.closest('[data-e2e="tiktok-logo"]')) {
        const added = Array.from(mutation.addedNodes);
        const onlySelfAdded =
          mutation.removedNodes.length === 0 && added.length > 0 && added.every(isSelfBrandImg);
        if (!onlySelfAdded) {
          scan();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });

  const heartbeat = setInterval(() => {
    if (document.visibilityState !== 'hidden') scan();
  }, 3000);

  window.__octoBrand = {
    scan,
    stop() {
      observer.disconnect();
      resizers.forEach((resizer) => resizer.disconnect());
      clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
      document.querySelectorAll('[data-e2e="tiktok-logo"]').forEach((anchor) => {
        anchor.querySelectorAll('img[' + IMG + ']').forEach((img) => img.remove());
        anchor.querySelectorAll('svg').forEach((svg) => {
          svg.style.display = '';
        });
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
const FONT_STACK = `'Inter', 'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif`;
const SITE_FRAME_STYLE_ID = 'octo-frame-css';
const SHADOW_STYLE_ID = 'octo-shadow-css';

/**
 * Тот же Inter, что и в оболочке, но для страницы сайта.
 *
 * Шрифты вшиваются в CSS как data: URI (CSP TikTok их пропускает). Правило
 * должно накрывать все элементы, а не только body: TikTok задаёт
 * `font-family: TikTokFont/TikTokDisplayFont` на внутренних компонентах, и эти
 * объявления перебивают наследование от body — часть интерфейса (шапки, имена
 * в чатах) оставалась в фирменном шрифте, часть в Inter. Иконки на сайте —
 * SVG, поэтому исключаем только их; иконочных шрифтов на живой странице нет.
 */
function googleFontFaceCss() {
  try {
    const css = fs.readFileSync(FONT_CSS_FILE, 'utf8');
    return css.replace(/url\('assets\/fonts\/([^']+)'\)/g, (_match, name) => {
      const file = path.join(FONT_DIR, name);
      return `url('data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}')`;
    });
  } catch {
    return '';
  }
}

function documentFontRule() {
  return `html, body, body :not(svg):not(svg *) { font-family: ${FONT_STACK} !important; }
input, textarea, select { font-family: ${FONT_STACK} !important; }`;
}

function shadowFontRule() {
  return `:host, :host *:not(svg):not(svg *) { font-family: ${FONT_STACK} !important; }
input, textarea, select { font-family: ${FONT_STACK} !important; }`;
}

function siteFontCss() {
  return `${googleFontFaceCss()}\n${documentFontRule()}`;
}

/**
 * CSS для подфреймов. `insertCSS` действует только на главный документ, а
 * Business Suite и часть экранов TikTok живут во вложенных фреймах. Там стиль
 * приходится ставить элементом <style>: CSP TikTok разрешает inline-стили.
 */
function frameInjectionScript(documentCss, shadowCss) {
  return `(() => {
  const DOC_CSS = ${JSON.stringify(documentCss || '')};
  const SHADOW_CSS = ${JSON.stringify(shadowCss || '')};
  const DOC_ID = ${JSON.stringify(SITE_FRAME_STYLE_ID)};
  const SHADOW_ID = ${JSON.stringify(SHADOW_STYLE_ID)};

  const install = (root, css, id) => {
    if (!root || !root.querySelector) return;
    let style = root.querySelector('style#' + id);
    if (!css) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (root.head || root).appendChild(style);
    } else if (root.head && root.head.lastElementChild !== style) {
      root.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  };

  install(document, DOC_CSS, DOC_ID);

  // В подфреймах (Studio, Business Suite) SPA иногда пересоздаёт <head> или
  // дописывает новые теги стиля: следим, чтобы <style> не пропал при догрузке.
  if (window.__octoFrameCssObserver) {
    window.__octoFrameCssObserver.disconnect();
    delete window.__octoFrameCssObserver;
  }
  window.__octoFrameCssValue = DOC_CSS;
  if (DOC_CSS && document.head && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      const targetCss = window.__octoFrameCssValue || '';
      if (!targetCss) return;
      const existing = document.querySelector('style#' + DOC_ID);
      if (!existing || existing.textContent !== targetCss) {
        install(document, targetCss, DOC_ID);
      }
    });
    observer.observe(document.head, { childList: true });
    window.__octoFrameCssObserver = observer;
  }

  const prevShadowCss = window.__octoShadowCssValue;
  const hasShadowHook = Boolean(window.__octoShadowCssHook);
  window.__octoShadowCssValue = SHADOW_CSS;

  if (!hasShadowHook || prevShadowCss !== SHADOW_CSS) {
    const seen = new WeakSet();
    const walk = (root) => {
      if (!root || seen.has(root)) return;
      seen.add(root);
      let nodes;
      try {
        nodes = root.querySelectorAll('*');
      } catch {
        return;
      }
      for (const element of nodes) {
        if (!element.shadowRoot) continue;
        install(element.shadowRoot, SHADOW_CSS, SHADOW_ID);
        walk(element.shadowRoot);
      }
    };
    walk(document);
  }

  // Новые shadow root появляются после SPA-переходов и ленивой отрисовки.
  if (!hasShadowHook) {
    const original = Element.prototype.attachShadow;
    window.__octoShadowCssHook = { original };
    Element.prototype.attachShadow = function (init) {
      const root = original.call(this, init);
      try {
        install(root, window.__octoShadowCssValue || '', SHADOW_ID);
      } catch {
        /* закрытый shadow root */
      }
      return root;
    };
  }
  return true;
})()`;
}

function framesOf(wc) {
  try {
    const main = wc.mainFrame;
    const list = Array.isArray(main.framesInSubtree)
      ? main.framesInSubtree
      : [main, ...(Array.isArray(main.frames) ? main.frames : [])];
    const mainOrigin = main.origin;
    return list.filter((frame) => {
      if (!frame || frame === main || frame.isDestroyed?.()) return false;
      const url = frame.url || '';
      // В чужие https-фреймы (капча, платёжные виджеты, реклама) не лезем.
      if (url.startsWith('about:')) return true;
      if (isTikTokUrl(url)) return true;
      return frame.origin === mainOrigin;
    });
  } catch {
    return [];
  }
}

function resolveValue(value) {
  return typeof value === 'function' ? value() : value || '';
}

function enabledCss() {
  return RULES.filter((rule) => isEnabled(rule.id))
    .map((rule) => resolveValue(rule.css))
    .filter(Boolean)
    .join('\n');
}

function enabledShadowCss() {
  const parts = [];
  if (isEnabled('modern-font')) parts.push(shadowFontRule());
  if (isEnabled('md3-design')) {
    parts.push(
      md3Site.shadowCss(
        isEnabled('dark-theme'),
        getThemePalette(),
        getThemeCustom(),
        isEffectiveAmoled(),
        isEnabled('rainbow-theme'),
      ),
    );
  }
  return parts.join('\n');
}

/**
 * Досылает стили во вложенные фреймы и во все открытые shadow root.
 * Основной документ уже получает CSS через insertCSS, поэтому ему передаём
 * только правило для shadow root.
 */
async function injectFrameStyles(wc = ctx.view?.webContents) {
  if (!wc || wc.isDestroyed()) return;

  const documentCss = enabledCss();
  const shadowCss = enabledShadowCss();

  try {
    await wc.mainFrame.executeJavaScript(frameInjectionScript('', shadowCss), false);
  } catch {
    /* документ сменился во время инъекции */
  }

  const frames = framesOf(wc);
  if (!frames.length) return;

  const frameMd3Script = isEnabled('md3-design')
    ? md3Site.syncScript(isEnabled('dark-theme'), isEffectiveAmoled())
    : md3Site.CLEANUP_JS;
  const frameRainbowScript = isEnabled('rainbow-theme') ? rainbowScript() : RAINBOW_CLEANUP_JS;

  await Promise.all(
    frames.map(async (frame) => {
      await frame
        .executeJavaScript(frameInjectionScript(documentCss, shadowCss), false)
        .catch(() => false);
      await frame.executeJavaScript(frameMd3Script, false).catch(() => false);
      await frame.executeJavaScript(frameRainbowScript, false).catch(() => false);
      await frame.executeJavaScript(EMOJI_SCRIPT, false).catch(() => false);
    }),
  );
}

/**
 * Тёмная тема сайта.
 *
 * TikTok хранит выбор темы в cookie, а провайдер styled-components в чате
 * (`web_dm`) читает `isDark` только при монтировании. Поэтому тему включаем
 * cookie до загрузки страницы, а не CSS поверх документа: тогда перекрашиваются
 * и сообщения, и панели эмодзи, и меню, и системные диалоги сайта.
 *
 * Значения повторяют то, что выставляет сам сайт при ручном выборе темы:
 * `theme_source` — выбранная тема, `theme_manual` — признак ручного выбора,
 * `theme` — тема текущей страницы. Cookie живут 300 дней, как и у TikTok.
 */
const SITE_URL = 'https://www.tiktok.com/';
const THEME_MAX_AGE = 300 * 24 * 60 * 60;
const THEME_COOKIES = [
  { name: 'tiktok_webapp_theme_manual', value: '1' },
  { name: 'tiktok_webapp_theme_source', value: 'dark' },
  { name: 'tiktok_webapp_theme', value: 'dark' },
];

// Доменную cookie получают все поддомены: Business Suite и служебные экраны
// TikTok живут не на www и иначе остаются светлыми.
const THEME_TARGETS = [
  { url: SITE_URL },
  { url: 'https://tiktok.com/' },
  { url: SITE_URL, domain: '.tiktok.com' },
];

async function removeThemeCookies(ses) {
  let cookies = [];
  try {
    cookies = await ses.cookies.get({});
  } catch {
    return;
  }

  const names = new Set(THEME_COOKIES.map((cookie) => cookie.name));
  await Promise.all(
    cookies
      .filter((cookie) => names.has(cookie.name))
      .map((cookie) => {
        const host = String(cookie.domain || 'www.tiktok.com').replace(/^\./, '');
        return ses.cookies
          .remove(`https://${host}${cookie.path || '/'}`, cookie.name)
          .catch(() => {});
      }),
  );
}

async function syncThemeCookies(ses, enabled) {
  if (!ses) return;
  if (!enabled) {
    await removeThemeCookies(ses);
    return;
  }

  const expirationDate = Math.floor(Date.now() / 1000) + THEME_MAX_AGE;
  await Promise.all(
    THEME_COOKIES.flatMap(({ name, value }) =>
      THEME_TARGETS.map((target) =>
        ses.cookies
          .set({
            ...target,
            name,
            value,
            expirationDate,
            secure: true,
            sameSite: 'lax',
          })
          .catch(() => {
            /* cookie jar может быть недоступен в тестовом профиле */
          }),
      ),
    ),
  );
}

/**
 * Ставит тему до первого рендера сайта: при старте окна и после сброса
 * данных TikTok, который стирает cookie.
 */
async function prepareTheme(ses) {
  await syncThemeCookies(ses, isEnabled('dark-theme'));
}

/**
 * Правая колонка страницы видео.
 *
 * На десктопе TikTok всегда держит справа панель с вкладками «Комментарии» и
 * «Вам может понравиться», даже когда комментарии не нужны. Прячем её и
 * освобождаем место ролику; значок комментариев возвращает панель, а Esc,
 * повторный клик по значку или переход на другой ролик снова её убирают.
 * Скрываем только контейнер страницы видео, чтобы лента и чат не менялись.
 */
const COMMENTS_PANEL_MARK = 'data-octo-comments-panel';

const COMMENTS_PANEL_CSS = `
  [class*="DivVideoDetailContainer"] [class*="DivVideoListTabBarWrapper"] {
    display: none !important;
  }
  html[${COMMENTS_PANEL_MARK}="open"]
    [class*="DivVideoDetailContainer"]
    [class*="DivVideoListTabBarWrapper"] {
    display: flex !important;
  }
`;

const COMMENTS_PANEL_JS = `(() => {
  const MARK = '${COMMENTS_PANEL_MARK}';
  if (window.__octoCommentsPanel) return 0;

  const root = document.documentElement;
  const isOpen = () => root.getAttribute(MARK) === 'open';
  const open = () => root.setAttribute(MARK, 'open');
  const close = () => root.removeAttribute(MARK);

  // Вкладка «Комментарии» отрисована, только когда сайт показывает список.
  const commentsVisible = () => Boolean(document.querySelector('[class*="DivCommentListContainer"]'));

  const onClick = (event) => {
    const target =
      event.target instanceof Element ? event.target.closest('[data-e2e="comment-icon"]') : null;
    if (!target) return;
    // Первый клик открывает панель, повторный по уже открытым комментариям —
    // закрывает. Если сайт успел переключиться на «Вам может понравиться»,
    // клик по значку возвращает вкладку комментариев и панель не прячет.
    if (isOpen() && commentsVisible()) {
      close();
      return;
    }
    open();
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    const target = event.target;
    const editing =
      target instanceof Element &&
      Boolean(target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]'));
    if (editing) return;
    close();
  };

  // SPA меняет ролик без перезагрузки: новая страница снова начинается
  // со скрытой панелью, иначе она оставалась бы открытой с прошлого раза.
  const closeOnNavigate = () => close();
  const originalHistory = {};
  const wrapHistory = (name) => {
    const original = history[name];
    if (typeof original !== 'function') return;
    originalHistory[name] = original;
    history[name] = function wrappedHistory(...args) {
      const before = location.href;
      const result = original.apply(this, args);
      if (location.href !== before) close();
      return result;
    };
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('popstate', closeOnNavigate);

  window.__octoCommentsPanel = {
    stop() {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('popstate', closeOnNavigate);
      for (const [name, original] of Object.entries(originalHistory)) {
        if (typeof original === 'function') history[name] = original;
      }
      close();
      delete window.__octoCommentsPanel;
    },
  };

  close();
  return 1;
})()`;

const COMMENTS_PANEL_CLEANUP_JS = `(() => {
  if (window.__octoCommentsPanel) {
    window.__octoCommentsPanel.stop();
    return;
  }
  document.documentElement.removeAttribute('${COMMENTS_PANEL_MARK}');
})()`;

const RAINBOW_HUE_ATTR = 'data-octo-rainbow';

function rainbowScript(config = getThemeRainbow()) {
  const cfg = normalizeRainbowConfig(config);
  return `(() => {
  const ATTR = '${RAINBOW_HUE_ATTR}';
  const BASE_DEG_PER_MS = 0.024;
  const INITIAL_CFG = ${JSON.stringify(cfg)};
  if (!document.documentElement) return 0;

  if (window.__octoRainbow) {
    window.__octoRainbow.update(INITIAL_CFG);
    return 0;
  }

  let cfg = INITIAL_CFG;
  const mq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const computeHue = (reduced) => {
    const from = Number(cfg.hueFrom) || 0;
    const to = Number(cfg.hueTo) ?? 360;
    const speed = Math.min(4, Math.max(0.2, Number(cfg.speed) || 1));
    const isFull = Math.abs(to - from) >= 360;
    const span = isFull ? 360 : ((to - from) % 360 + 360) % 360;
    if (reduced) {
      return ((from + (isFull ? 260 : span / 2)) % 360).toFixed(2);
    }
    if (!isFull && span === 0) {
      return (((from % 360) + 360) % 360).toFixed(2);
    }
    const degPerMs = BASE_DEG_PER_MS * speed;
    if (isFull) {
      return ((Date.now() * degPerMs) % 360).toFixed(2);
    }
    const periodMs = (2 * Math.max(span, 30)) / degPerMs;
    const phase = (Date.now() % periodMs) / periodMs;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return ((from + span * wave) % 360).toFixed(2);
  };

  const stepMsForSpeed = () => {
    const speed = Math.min(4, Math.max(0.2, Number(cfg.speed) || 1));
    return Math.round(Math.min(260, Math.max(100, 160 / Math.sqrt(speed))));
  };

  let lastHue = '';
  let scrolling = false;
  let scrollTimer = null;
  const paint = () => {
    if (!document.documentElement || scrolling) return;
    const hue = computeHue(Boolean(mq && mq.matches));
    if (hue !== lastHue) {
      lastHue = hue;
      document.documentElement.style.setProperty('--octo-hue', hue);
    }
    if (document.documentElement.getAttribute(ATTR) !== 'true') {
      document.documentElement.setAttribute(ATTR, 'true');
    }
  };

  let timer = null;
  const sync = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    paint();
    if (document.visibilityState === 'hidden') return;
    if (mq && mq.matches) return;
    timer = setInterval(paint, stepMsForSpeed());
  };

  const onVisibility = () => sync();
  const onMotion = () => sync();
  const onScroll = () => {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrolling = false;
      paint();
    }, 220);
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onMotion);
  }

  window.__octoRainbow = {
    sync,
    update(nextCfg) {
      if (nextCfg && typeof nextCfg === 'object') cfg = nextCfg;
      sync();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      clearTimeout(scrollTimer);
      scrolling = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (mq && typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', onMotion);
      }
      if (document.documentElement) {
        document.documentElement.removeAttribute(ATTR);
        document.documentElement.style.removeProperty('--octo-hue');
      }
      delete window.__octoRainbow;
    },
  };

  sync();
  return 1;
})()`;
}

const RAINBOW_CLEANUP_JS = `(() => {
  if (window.__octoRainbow) {
    window.__octoRainbow.stop();
    return;
  }
  if (document.documentElement) {
    document.documentElement.removeAttribute('${RAINBOW_HUE_ATTR}');
    document.documentElement.style.removeProperty('--octo-hue');
  }
})()`;

const IMPLEMENTATIONS = {
  'octo-brand': {
    css: '[data-octo-brand] svg { display: none !important; }',
    js: brandScript(),
    cleanupJs: BRAND_CLEANUP_JS,
  },
  'md3-design': {
    css: () =>
      md3Site.siteCss(
        isEnabled('dark-theme'),
        getThemePalette(),
        getThemeCustom(),
        isEffectiveAmoled(),
        isEnabled('rainbow-theme'),
      ),
    js: () => md3Site.syncScript(isEnabled('dark-theme'), isEffectiveAmoled()),
    cleanupJs: md3Site.CLEANUP_JS,
  },
  'rainbow-theme': {
    js: () => rainbowScript(),
    cleanupJs: RAINBOW_CLEANUP_JS,
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
  'comments-panel': {
    css: COMMENTS_PANEL_CSS,
    js: COMMENTS_PANEL_JS,
    cleanupJs: COMMENTS_PANEL_CLEANUP_JS,
  },
  'user-badges': {
    css: badges.BADGES_CSS,
    js: () => badges.badgesScript(),
    cleanupJs: badges.BADGES_CLEANUP_JS,
  },
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

/**
 * Вставленный CSS живёт отдельно для каждого webContents: у основного окна и
 * панели чата свои ключи. removeInsertedCSS со старым ключом после навигации
 * просто отклоняется, это нормально.
 */
const insertionState = new WeakMap();

function stateOf(wc) {
  let state = insertionState.get(wc);
  if (!state) {
    state = { generation: 0, keys: [] };
    insertionState.set(wc, state);
  }
  return state;
}

let timer = null;
let scriptTimer = null;
let onChange = null;
let eco = false;

function settings() {
  const value = readState().cosmetics;
  return value && typeof value === 'object' ? value : {};
}

function getThemeMode() {
  const saved = readState().themeMode;
  if (saved === 'system' || saved === 'dark' || saved === 'light') return saved;
  return settings()['dark-theme'] === false ? 'light' : 'dark';
}

function getThemePalette() {
  return normalizePaletteId(readState().themePalette);
}

function getThemeCustom() {
  return normalizeCustomTheme(readState().themeCustom);
}

function getThemeAmoled() {
  return readState().themeAmoled === true;
}

function getThemeRainbow() {
  return normalizeRainbowConfig(readState().themeRainbow);
}

function isEffectiveAmoled() {
  return isEnabled('dark-theme') && getThemeAmoled();
}

function getThemePayload() {
  const dark = isEnabled('dark-theme');
  const amoled = dark && getThemeAmoled();
  const palette = getThemePalette();
  const custom = getThemeCustom();
  const rainbow = isEnabled('rainbow-theme');
  const rainbowConfig = getThemeRainbow();
  return {
    dark,
    amoled,
    palette,
    custom,
    rainbow,
    rainbowConfig,
    rainbowTokens: rainbow ? getIridescentCssTokens(dark, { amoled }) : null,
    tokens: getPaletteTokens(palette, dark, custom, { amoled }),
  };
}

function syncThemeContext() {
  const payload = getThemePayload();
  ctx.themeTokens = payload.tokens;
  ctx.themeRainbowTokens = payload.rainbowTokens;
  return payload;
}

function broadcastTheme() {
  const payload = syncThemeContext();
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      const wc = win.webContents;
      if (!wc || wc.isDestroyed()) continue;
      try {
        wc.send('octo:theme-changed', payload);
      } catch {
        /* окно закрывается */
      }
    }
  } catch {
    /* тестовая среда */
  }
  try {
    require('./plugins').onThemeChange({ mode: getThemeMode(), ...payload });
  } catch {
    /* модуль плагинов ещё не инициализирован */
  }
}

function effectiveSettings() {
  const base = settings();
  const mode = getThemeMode();
  const dark = mode === 'system' ? Boolean(nativeTheme.shouldUseDarkColors) : mode === 'dark';
  return { ...base, 'dark-theme': dark };
}

function isEnabled(id) {
  const rule = RULES.find((candidate) => candidate.id === id);
  if (!rule) return false;
  if (id === 'dark-theme') {
    const mode = getThemeMode();
    return mode === 'system' ? Boolean(nativeTheme.shouldUseDarkColors) : mode === 'dark';
  }
  const saved = settings()[id];
  return saved === undefined ? rule.default : saved === true;
}

/** Дымовой тест и отладка могут подменить состояние без записи на диск. */
function setOnChange(callback) {
  onChange = callback;
}

const applyQueues = new WeakMap();

function apply(wc = ctx.view?.webContents) {
  if (!wc || wc.isDestroyed()) return Promise.resolve();
  // Быстрые переключения и dom-ready не должны вставлять CSS параллельно:
  // иначе ключ от первой вставки теряется и правило не снять до перезагрузки.
  const previous = applyQueues.get(wc) || Promise.resolve();
  const next = previous.then(() => applyNow(wc)).catch(() => {});
  applyQueues.set(wc, next);
  return next;
}

async function applyNow(wc) {
  if (!wc || wc.isDestroyed()) return;

  const state = stateOf(wc);
  const currentGeneration = ++state.generation;
  const previous = state.keys;
  state.keys = [];

  const css = enabledCss();

  if (css.trim()) {
    try {
      const key = await wc.insertCSS(css, { cssOrigin: 'user' });
      if (currentGeneration === state.generation) state.keys.push(key);
      else wc.removeInsertedCSS(key).catch(() => {});
    } catch {
      /* документ сменился между вызовом и вставкой */
    }
  }
  await Promise.all(previous.map((key) => wc.removeInsertedCSS(key).catch(() => {})));
  if (currentGeneration !== state.generation) return;

  await runScripts(wc);
  injectFrameStyles(wc).catch(() => {});
}

const scriptRunning = new WeakSet();
const scriptPending = new WeakSet();

async function runScripts(wc = ctx.view?.webContents) {
  if (!wc || wc.isDestroyed()) return;
  if (scriptRunning.has(wc)) {
    scriptPending.add(wc);
    return;
  }

  const enabled = RULES.filter((rule) => isEnabled(rule.id));
  // Всегда включено, независимо от скина и переключателей косметики.
  const scripts = [EMOJI_SCRIPT];

  for (const rule of RULES) {
    const js = resolveValue(rule.js);
    if (!js) continue;
    if (enabled.includes(rule)) scripts.push(js);
    else {
      const cleanup = resolveValue(rule.cleanupJs);
      if (cleanup) scripts.push(cleanup);
    }
  }

  if (!scripts.length) return;

  scriptRunning.add(wc);
  try {
    await evalInPage(wc, scripts);
  } finally {
    scriptRunning.delete(wc);
    if (scriptPending.has(wc)) {
      scriptPending.delete(wc);
      runScripts(wc).catch(() => {});
    }
  }
}

function scheduleScripts(delay = 500) {
  clearTimeout(scriptTimer);
  if (eco) return;
  scriptTimer = setTimeout(() => {
    runScripts();
    injectFrameStyles().catch(() => {});
  }, delay);
}

/** Экономный режим на батарее: декоративные скрипты не пересканируют DOM. */
function setEco(value) {
  const next = Boolean(value);
  if (eco === next) return;
  eco = next;
  if (eco) {
    clearTimeout(timer);
    clearTimeout(scriptTimer);
  } else {
    scheduleScripts(0);
  }
}

/** SPA-переходы и поздние баннеры: пересканировать DOM без перевставки CSS ленты. */
function schedule(delay = 300) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!eco) runScripts();
    injectFrameStyles().catch(() => {});
  }, delay);
}

function applyThemeMode(mode, { reload = true } = {}) {
  const nextMode = mode === 'system' || mode === 'light' || mode === 'dark' ? mode : 'dark';
  const prevDark = isEnabled('dark-theme');
  try {
    nativeTheme.themeSource = nextMode;
  } catch {
    /* в раннем тесте nativeTheme может быть недоступен */
  }
  const nextDark =
    nextMode === 'system' ? Boolean(nativeTheme.shouldUseDarkColors) : nextMode === 'dark';

  ctx.themeMode = nextMode;
  writeState({
    themeMode: nextMode,
    cosmetics: { ...settings(), 'dark-theme': nextDark },
  });
  setCosmeticsState(effectiveSettings());
  syncThemeContext();
  apply();
  const chatWc = ctx.chatView?.webContents;
  if (chatWc && !chatWc.isDestroyed()) apply(chatWc);

  if (reload && nextDark !== prevDark) {
    const views = [ctx.view?.webContents, chatWc].filter((wc) => wc && !wc.isDestroyed());
    for (const wc of views) autoTheme.setEnabled(wc, nextDark).catch(() => {});
    const ses = ctx.view?.webContents?.session || ctx.chatView?.webContents?.session;
    syncThemeCookies(ses, nextDark).finally(() => {
      for (const wc of views) {
        if (!wc.isDestroyed()) wc.reload();
      }
    });
  } else {
    pushState();
  }
  broadcastTheme();
  if (onChange) onChange();
  return nextMode;
}

function applyThemePalette(paletteId) {
  const nextPalette = normalizePaletteId(paletteId);
  ctx.themePalette = nextPalette;
  writeState({ themePalette: nextPalette });
  syncThemeContext();
  apply();
  const chatWc = ctx.chatView?.webContents;
  if (chatWc && !chatWc.isDestroyed()) apply(chatWc);
  pushState();
  broadcastTheme();
  if (onChange) onChange();
  return nextPalette;
}

function applyThemeAmoled(enabled) {
  const nextAmoled = Boolean(enabled);
  ctx.themeAmoled = nextAmoled;
  writeState({ themeAmoled: nextAmoled });
  syncThemeContext();
  apply();
  const chatWc = ctx.chatView?.webContents;
  if (chatWc && !chatWc.isDestroyed()) apply(chatWc);
  pushState();
  broadcastTheme();
  if (onChange) onChange();
  return nextAmoled;
}

function applyThemeCustom(customRaw, { activate = true } = {}) {
  const nextCustom = normalizeCustomTheme(customRaw);
  const nextPalette = activate ? 'custom' : getThemePalette();
  ctx.themeCustom = nextCustom;
  ctx.themePalette = nextPalette;
  writeState({ themeCustom: nextCustom, themePalette: nextPalette });
  syncThemeContext();
  apply();
  const chatWc = ctx.chatView?.webContents;
  if (chatWc && !chatWc.isDestroyed()) apply(chatWc);
  pushState();
  broadcastTheme();
  if (onChange) onChange();
  return nextCustom;
}

function applyThemeRainbow(patch) {
  const current = getThemeRainbow();
  const nextRainbow = normalizeRainbowConfig({ ...current, ...(patch || {}) });
  ctx.themeRainbow = nextRainbow;
  writeState({ themeRainbow: nextRainbow });
  syncThemeContext();
  if (isEnabled('rainbow-theme')) {
    runScripts();
    injectFrameStyles().catch(() => {});
    const chatWc = ctx.chatView?.webContents;
    if (chatWc && !chatWc.isDestroyed()) {
      runScripts(chatWc);
      injectFrameStyles(chatWc).catch(() => {});
    }
  }
  pushState();
  broadcastTheme();
  if (onChange) onChange();
  return nextRainbow;
}

function initThemeListener() {
  try {
    nativeTheme.themeSource = getThemeMode();
    nativeTheme.on('updated', () => {
      if (getThemeMode() !== 'system') return;
      applyThemeMode('system', { reload: true });
    });
  } catch {
    /* тестовая среда */
  }
}

function toggle(id) {
  const rule = RULES.find((candidate) => candidate.id === id);
  if (!rule) return false;

  if (id === 'dark-theme') {
    const nextDark = !isEnabled('dark-theme');
    applyThemeMode(nextDark ? 'dark' : 'light', { reload: true });
    return nextDark;
  }

  const next = !isEnabled(id);
  writeState({ cosmetics: { ...settings(), [id]: next } });
  setCosmeticsState(effectiveSettings());
  if (id === 'rainbow-theme') syncThemeContext();
  apply();
  const chatWc = ctx.chatView?.webContents;
  if (chatWc && !chatWc.isDestroyed()) apply(chatWc);

  if (id === 'rainbow-theme') {
    pushState();
    broadcastTheme();
  }

  if (onChange) onChange();
  return next;
}

function menuItems() {
  return RULES.filter((rule) => !rule.experimental).map((rule) => ({
    label: rule.label,
    type: 'checkbox',
    checked: isEnabled(rule.id),
    click: () => toggle(rule.id),
  }));
}

// Интерфейс получает актуальные галочки сразу при старте.
ctx.themeMode = getThemeMode();
ctx.themeAmoled = getThemeAmoled();
ctx.themePalette = getThemePalette();
ctx.themeCustom = getThemeCustom();
ctx.themeRainbow = getThemeRainbow();
setCosmeticsState(effectiveSettings());
syncThemeContext();

try {
  ipcMain?.on('octo:theme', (event) => {
    event.returnValue = getThemePayload();
  });
  ipcMain?.on('octo:theme-palettes', (event) => {
    event.returnValue = listPalettes();
  });
  ipcMain?.on('octo:rainbow-presets', (event) => {
    event.returnValue = RAINBOW_PRESETS;
  });
} catch {
  /* тестовая среда без Electron IPC */
}

module.exports = {
  RULES,
  apply,
  schedule,
  scheduleScripts,
  injectFrameStyles,
  prepareTheme,
  applyThemeMode,
  applyThemeAmoled,
  applyThemePalette,
  applyThemeCustom,
  applyThemeRainbow,
  getThemeAmoled,
  getThemePalette,
  getThemeCustom,
  getThemeRainbow,
  getThemePayload,
  initThemeListener,
  toggle,
  isEnabled,
  setEco,
  menuItems,
  setOnChange,
};
