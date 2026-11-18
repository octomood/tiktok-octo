'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');
const i18n = require('./i18n');

/**
 * Фильтры контента.
 *
 * Смотрим только видимый DOM активного ролика: описание, хэштеги и ссылки на
 * автора. Совпадение с ключевым словом, хэштегом или автором — и лента
 * перелистывается дальше, как при пропуске рекламы. Никаких запросов к API и
 * скрытых данных сайта.
 */

const MARK = 'data-octo-filter-skip';
const MAX_ITEMS = 80;

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim().slice(0, 80))
    .slice(0, MAX_ITEMS);
}

function readSettings() {
  const saved = readState().filters;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    enabled: value.enabled === true,
    keywords: cleanList(value.keywords),
    hashtags: cleanList(value.hashtags),
    authors: cleanList(value.authors),
  };
}

function syncState() {
  const settings = readSettings();
  ctx.filters = {
    enabled: settings.enabled,
    keywords: settings.keywords.slice(),
    hashtags: settings.hashtags.slice(),
    authors: settings.authors.slice(),
  };
  return settings;
}

function save(patch) {
  writeState({ filters: { ...readSettings(), ...patch } });
  syncState();
}

function pageConfig(settings) {
  return {
    enabled: settings.enabled,
    keywords: settings.keywords.map((item) => item.toLowerCase()),
    hashtags: settings.hashtags.map((item) => item.replace(/^#/, '').toLowerCase()),
    authors: settings.authors.map((item) => item.replace(/^@/, '').toLowerCase()),
    notice: i18n.t('Скрыто по фильтру'),
  };
}

function pageScript(config) {
  return `(() => {
    const CONFIG = ${JSON.stringify(config)};
    if (window.__octoFilters) {
      window.__octoFilters.update(CONFIG);
      return 0;
    }

    const NOTICE_ID = 'octo-filter-notice';
    const ITEM_SELECTOR =
      '[data-e2e="recommend-list-item-container"], [data-e2e="browse-video"], article';
    let current = CONFIG;
    let running = true;
    let timer = null;
    let lastAt = 0;
    const tried = new WeakSet();

    const visible = (el) => {
      if (!el || !el.isConnected) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const activeItem = () => {
      const videos = [...document.querySelectorAll('video')].filter(visible);
      if (!videos.length) return null;
      const video = videos.find((item) => !item.paused) || videos[0];
      return video.closest(ITEM_SELECTOR) || video.parentElement;
    };

    const matches = (item) => {
      if (!item) return null;
      const text = (item.innerText || '').toLowerCase().slice(0, 3000);
      for (const keyword of current.keywords) {
        if (keyword && text.includes(keyword)) return keyword;
      }
      for (const tag of current.hashtags) {
        if (tag && text.includes('#' + tag)) return '#' + tag;
      }
      if (current.authors.length) {
        const links = [...item.querySelectorAll('a[href]')]
          .map((link) => (link.getAttribute('href') || '').toLowerCase())
          .join(' ');
        for (const author of current.authors) {
          if (author && links.includes('/@' + author)) return '@' + author;
        }
      }
      return null;
    };

    const advance = () => {
      const selectors = [
        '[data-e2e="feed-navigation-next"]',
        '[data-e2e="arrow-down"]',
        '[data-e2e="feed-arrow-down"]',
        'button[class*="ArrowDown"]',
      ];
      for (const selector of selectors) {
        for (const button of document.querySelectorAll(selector)) {
          if (visible(button) && !button.disabled) {
            button.click();
            return true;
          }
        }
      }
      for (const target of [document, window]) {
        target.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            code: 'ArrowDown',
            keyCode: 40,
            which: 40,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      return false;
    };

    const notice = (rule) => {
      if (!document.documentElement) return;
      let node = document.getElementById(NOTICE_ID);
      if (!node) {
        node = document.createElement('div');
        node.id = NOTICE_ID;
        node.setAttribute('role', 'status');
        const set = (name, value) => node.style.setProperty(name, value, 'important');
        set('position', 'fixed');
        set('top', '24px');
        set('left', '50%');
        set('transform', 'translate(-50%, 0)');
        set('z-index', '2147483647');
        set('padding', '10px 18px');
        set('border-radius', '999px');
        set('background', 'rgba(24, 24, 27, 0.92)');
        set('color', '#ffffff');
        set('font', '500 14px/1.2 system-ui, -apple-system, sans-serif');
        set('pointer-events', 'none');
      }
      document.documentElement.appendChild(node);
      node.textContent = current.notice + ' · ' + rule;
      clearTimeout(node.__octoTimer);
      node.__octoTimer = setTimeout(() => node.remove(), 1200);
    };

    const tick = () => {
      if (!running || !current.enabled) return;
      const now = Date.now();
      if (now - lastAt < 2500) return;

      const item = activeItem();
      if (!item || tried.has(item)) return;
      const rule = matches(item);
      if (!rule) return;

      lastAt = now;
      tried.add(item);
      item.setAttribute('${MARK}', '');
      advance();
      notice(rule);
    };

    function start() {
      running = true;
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 1500);
      tick();
    }

    function stop() {
      running = false;
      if (timer) clearInterval(timer);
      timer = null;
      const node = document.getElementById(NOTICE_ID);
      if (node) node.remove();
      document.querySelectorAll('[${MARK}]').forEach((el) => el.removeAttribute('${MARK}'));
      delete window.__octoFilters;
    }

    window.__octoFilters = {
      start,
      stop,
      tick,
      update(configuration) {
        current = { ...current, ...configuration };
      },
    };
    start();
    return 1;
  })()`;
}

const CLEANUP_SCRIPT = `(() => {
  if (window.__octoFilters) window.__octoFilters.stop();
  document.querySelectorAll('[${MARK}]').forEach((el) => el.removeAttribute('${MARK}'));
})()`;

function apply() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const settings = readSettings();
  evalInPage(wc, [settings.enabled ? pageScript(pageConfig(settings)) : CLEANUP_SCRIPT]);
}

function parser(text, prefix = '') {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (prefix ? line.replace(new RegExp(`^${prefix}`), '') : line).trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

/** Списки приходят строкой из textarea: по одному правилу в строке. */
function setLists(payload = {}) {
  writeState({
    filters: {
      ...readSettings(),
      keywords: parser(payload.keywords),
      hashtags: parser(payload.hashtags, '#'),
      authors: parser(payload.authors, '@'),
    },
  });
  syncState();
  apply();
  pushState();
}

function setEnabled(value) {
  save({ enabled: Boolean(value) });
  apply();
  pushState();
  const filters = ctx.filters;
  const total = filters.keywords.length + filters.hashtags.length + filters.authors.length;
  toast(
    filters.enabled
      ? total
        ? `Фильтры включены: правил ${total}`
        : 'Фильтры включены, но правил пока нет'
      : 'Фильтры выключены',
  );
  return ctx.filters.enabled;
}

function toggle() {
  return setEnabled(!readSettings().enabled);
}

syncState();

module.exports = { sync: syncState, apply, setEnabled, toggle, setLists };
