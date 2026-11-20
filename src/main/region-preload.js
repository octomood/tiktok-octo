'use strict';

const { ipcRenderer, webFrame, webUtils } = require('electron');

/**
 * Preload страницы TikTok для подмены региона.
 *
 * Он ничего не отдаёт странице и не даёт ей доступ к Node: contextIsolation и
 * sandbox остаются включёнными. Единственная задача — до выполнения скриптов
 * сайта подменить те сигналы региона, которые читает браузерный клиент:
 * язык navigator, часовой пояс Intl/Date и координаты геолокации.
 *
 * Функция ниже сериализуется в главный мир страницы, поэтому она не должна
 * ссылаться ни на что снаружи — только на переданный config.
 */
function installRegion(config) {
  const { locale, timezone } = config;

  try {
    const languages = [locale, locale.split('-')[0], 'en-US', 'en'].filter(
      (value, index, list) => list.indexOf(value) === index,
    );

    Object.defineProperty(window.Navigator.prototype, 'language', {
      configurable: true,
      get: () => locale,
    });
    Object.defineProperty(window.Navigator.prototype, 'languages', {
      configurable: true,
      get: () => languages.slice(),
    });
  } catch {
    /* браузер не дал переопределить navigator */
  }

  // Intl по умолчанию берёт часовой пояс и локаль из системы.
  if (timezone) {
    try {
      const OriginalDateTimeFormat = Intl.DateTimeFormat;
      const WrappedDateTimeFormat = function (locales, options) {
        const next = Object.assign({ timeZone: timezone }, options || {});
        return new OriginalDateTimeFormat(locales || locale, next);
      };
      WrappedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
      WrappedDateTimeFormat.supportedLocalesOf =
        OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);
      Intl.DateTimeFormat = WrappedDateTimeFormat;
    } catch {
      /* Intl может быть заморожен страницей */
    }

    // Date.getTimezoneOffset() читает системную зону напрямую, мимо Intl.
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      Date.prototype.getTimezoneOffset = function () {
        const parts = formatter.formatToParts(this);
        const map = {};
        for (const part of parts) map[part.type] = part.value;
        const asUTC = Date.UTC(
          Number(map.year),
          Number(map.month) - 1,
          Number(map.day),
          Number(map.hour),
          Number(map.minute),
          Number(map.second),
        );
        const wholeSeconds = Math.floor(this.getTime() / 1000) * 1000;
        return -(asUTC - wholeSeconds) / 60000;
      };
    } catch {
      /* оставляем системную зону */
    }
  }

  if (typeof config.latitude === 'number' && typeof config.longitude === 'number') {
    try {
      const position = {
        coords: {
          latitude: config.latitude,
          longitude: config.longitude,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      let watchId = 0;
      const geolocation = window.navigator.geolocation;
      if (geolocation) {
        geolocation.getCurrentPosition = (success) => {
          if (typeof success === 'function') setTimeout(() => success(position), 0);
        };
        geolocation.watchPosition = (success) => {
          watchId += 1;
          if (typeof success === 'function') setTimeout(() => success(position), 0);
          return watchId;
        };
        geolocation.clearWatch = () => {};
      }
    } catch {
      /* геолокация отключена политикой */
    }
  }

  try {
    const applyLang = () => {
      document.documentElement.lang = locale;
    };
    if (document.documentElement) applyLang();
    else document.addEventListener('DOMContentLoaded', applyLang, { once: true });
  } catch {
    /* документ ещё не готов */
  }
}

const config = ipcRenderer.sendSync('octo:region-config');
// «chat» — панель сообщений, «feed» — основной сайт. Нужно, чтобы перетаскивание
// файлов работало только в чате и не ломало загрузку на самом TikTok.
const pageRole = ipcRenderer.sendSync('octo:page-role');
const host = window.location?.hostname || '';
const isTikTok = host === 'tiktok.com' || host.endsWith('.tiktok.com');

// Перехват «Сообщений» ставим раньше скриптов сайта: иначе собственный чат
// TikTok успевает открыться на pointerdown/mousedown до нашего click.
// Слушатель живёт в изолированном мире preload и не отдаёт странице ничего,
// кроме факта перехвата: сама страница не может отправить этот IPC.
function installChatLinks() {
  const isMessages = (raw) => {
    try {
      const url = new URL(raw);
      return /(^|\.)tiktok\.com$/.test(url.hostname) && /^\/messages(?:\/|$)/.test(url.pathname);
    } catch {
      return false;
    }
  };
  const hrefOf = (target) => {
    if (!(target instanceof window.Element)) return null;
    let anchor = target.closest('a[href]');
    let href = anchor ? anchor.href : '';
    if (!isMessages(href)) {
      const item = target.closest('[data-e2e*="message"], [data-e2e*="inbox"]');
      anchor = item ? item.closest('a[href]') : null;
      href = anchor ? anchor.href : '';
      if (!href && !item) {
        const candidate = target.closest('a, button, [role="button"], [role="link"], [data-e2e]');
        if (!candidate) return null;
        const text = (candidate.innerText || '').trim().toLowerCase();
        const aria = (
          candidate.getAttribute('aria-label') ||
          candidate.getAttribute('title') ||
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

  const onPage = () => /^\/messages(?:\/|$)/.test(window.location.pathname);
  let pending = null;
  const onPress = (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    if (onPage() || !hrefOf(event.target)) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  const onClick = (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    if (onPage()) return;
    const href = hrefOf(event.target);
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearTimeout(pending);
    if (event.detail > 1) {
      ipcRenderer.send('octo:chat-open', { url: href, full: true });
      pending = null;
      return;
    }
    // Панель перекроет ссылку, поэтому даём второму клику двойного нажатия
    // дойти до страницы, и только потом просим открыть панель.
    pending = setTimeout(() => {
      pending = null;
      ipcRenderer.send('octo:chat-open', { url: href, full: false });
    }, 280);
  };

  window.addEventListener('pointerdown', onPress, true);
  window.addEventListener('pointerup', onPress, true);
  window.addEventListener('mousedown', onPress, true);
  window.addEventListener('mouseup', onPress, true);
  window.addEventListener('click', onClick, true);
  // Страничному fallback-скрипту сообщаем, что перехват уже стоит.
  webFrame
    .executeJavaScript('window.__octoChatLinks = window.__octoChatLinks || { native: true }')
    .catch(() => {});
}

if (isTikTok && !/^\/messages(?:\/|$)/.test(window.location.pathname)) {
  try {
    installChatLinks();
  } catch {
    /* DOM ещё не готов — обработчики не нужны */
  }
}

/**
 * Клавиатурная лента.
 *
 * Слушатель живёт в изолированном мире preload: страница не может отправить
 * этот IPC, а обычный ввод в комментариях и поиске не перехватывается.
 * preventDefault нужен, чтобы пробел не прокручивал ленту поверх действия.
 */
let feedKeysEnabled = true;

function installFeedKeys() {
  const isEditable = (element) => {
    if (!element || element.nodeType !== 1) return false;
    const tag = element.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (element.isContentEditable) return true;
    return Boolean(
      typeof element.closest === 'function' &&
      element.closest(
        '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]',
      ),
    );
  };

  const actionOf = (event) => {
    // Латиница приходит по key, нелатинская раскладка — только по code.
    // Сравниваем с обоими: так J/K/L работают и по подписи, и по позиции.
    const key = event.key;
    const code = event.code;
    if (key === ' ' || key === 'k' || key === 'K' || code === 'Space' || code === 'KeyK') {
      return 'playPause';
    }
    if (key === 'j' || key === 'J' || code === 'KeyJ') return 'seekBack';
    if (key === 'l' || key === 'L' || code === 'KeyL') return 'seekForward';
    if (key === 's' || key === 'S' || code === 'KeyS') return 'screenshot';
    // «?» зависит от раскладки: на US это Shift+/, на других — свой символ.
    if (key === '?' || (code === 'Slash' && event.shiftKey)) return 'help';
    if (/^[0-9]$/.test(key) || /^Digit[0-9]$/.test(code)) return 'seekPercent';
    return null;
  };

  window.addEventListener(
    'keydown',
    (event) => {
      if (!feedKeysEnabled || !event.isTrusted || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event.target) || isEditable(document.activeElement)) return;

      const action = actionOf(event);
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const repeat = event.repeat === true;
      if (repeat && action !== 'seekBack' && action !== 'seekForward' && action !== 'seekPercent') {
        return;
      }
      const digit =
        action === 'seekPercent'
          ? Number(/^[0-9]$/.test(event.key) ? event.key : event.code.replace('Digit', ''))
          : undefined;
      ipcRenderer.send('octo:feed-key', action, digit, repeat);
    },
    true,
  );
}

ipcRenderer.on('octo:feed-keys', (_event, enabled) => {
  feedKeysEnabled = enabled !== false;
});

try {
  installFeedKeys();
} catch {
  /* DOM ещё не готов — обработчики не нужны */
}

/**
 * Перетаскивание файлов в панель чата: drop = отправить как фото.
 *
 * Работает только в роли «chat»: на самом сайте TikTok файл, брошенный в
 * загрузчик, должен остаться загрузчиком. Путь к файлу даёт webUtils —
 * страница его не видит и IPC отправить не может.
 */
function installDropFiles() {
  if (pageRole !== 'chat') return;
  const IMAGE = /\.(png|jpe?g|webp|gif)$/i;

  const pathsOf = (event) => {
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files || []) : [];
    const paths = [];
    for (const file of files) {
      let full = '';
      try {
        full = webUtils.getPathForFile ? webUtils.getPathForFile(file) : file.path || '';
      } catch {
        full = '';
      }
      if (full && IMAGE.test(full)) paths.push(full);
    }
    return paths;
  };

  window.addEventListener(
    'dragover',
    (event) => {
      const types = event.dataTransfer ? Array.from(event.dataTransfer.types || []) : [];
      if (!types.includes('Files')) return;
      event.preventDefault();
      try {
        event.dataTransfer.dropEffect = 'copy';
      } catch {
        /* тип данных уже зафиксирован */
      }
    },
    true,
  );

  window.addEventListener(
    'drop',
    (event) => {
      const types = event.dataTransfer ? Array.from(event.dataTransfer.types || []) : [];
      if (!types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      const paths = pathsOf(event);
      if (paths.length) ipcRenderer.send('octo:chat-files', { paths });
    },
    true,
  );
}

try {
  installDropFiles();
} catch {
  /* DOM ещё не готов — перетаскивание не нужно */
}

if (config && config.locale && isTikTok) {
  const script = `(${installRegion.toString()})(${JSON.stringify(config)})`;
  webFrame.executeJavaScript(script).catch(() => {
    /* страница уже ушла — патчи не нужны */
  });
}
