/**
 * Мок window.octo для unit-тестов плагина без Electron.
 *
 * В браузере: `const { octo } = createOctoMock({ settings })`.
 * В Node: `const { createOctoMock } = require('./octo-mock.js')`.
 *
 * Мок повторяет форму настоящего API, но всё хранит в памяти и не трогает
 * страницу. Сетевых запросов нет: `net.fetch` по умолчанию бросает ошибку.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.createOctoMock = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildMock() {
  'use strict';

  function createOctoMock(options) {
    const config = options && typeof options === 'object' ? options : {};
    const settings = { ...(config.settings || {}) };
    const storage = new Map(Object.entries(config.storage || {}));
    const secrets = new Map(Object.entries(config.secrets || {}));
    const commands = new Map();
    const panelRows = new Map();
    const contextItems = new Map();
    const shortcuts = new Map();
    const notifications = [];
    const systemNotifications = [];
    const logs = [];
    const css = [];
    const namedCss = new Map();
    const watchers = new Map();
    const overlays = new Map();
    const downloads = [];
    const theme = {
      mode: config.theme?.mode || 'dark',
      dark: config.theme?.dark !== false,
      palette: config.theme?.palette || 'octo-lavender',
      tokens: config.theme?.tokens || {},
    };
    const playback = {
      time: Number(config.time) || 0,
      duration: Number(config.duration) || 0,
      volume: Number(config.volume ?? 1),
      speed: Number(config.speed ?? 1),
      playing: config.playing !== false,
      pauses: 0,
      seeks: 0,
      feed: 0,
    };
    let clipboardText = '';
    const handlers = {
      activate: [],
      deactivate: [],
      pageReady: [],
      pageNavigate: [],
      settings: [],
      settingAction: [],
      theme: [],
      playback: [],
    };

    const register = (list, callback) => {
      if (typeof callback !== 'function') throw new Error('Нужна функция');
      list.push(callback);
      return () => {
        const index = list.indexOf(callback);
        if (index !== -1) list.splice(index, 1);
      };
    };

    const octo = {
      apiVersion: 1,
      plugin: Object.freeze({
        id: config.id || 'app.octo.test',
        name: config.name || 'Test plugin',
        version: config.version || '1.0.0',
        author:
          config.author && typeof config.author === 'object'
            ? config.author
            : { name: String(config.author || 'test'), url: '' },
        permissions: Object.freeze([...(config.permissions || [])]),
      }),
      app: Object.freeze({
        version: config.appVersion || '0.0.0',
        electron: '0.0.0',
        platform: 'linux',
      }),

      onActivate: (callback) => register(handlers.activate, callback),
      onDeactivate: (callback) => register(handlers.deactivate, callback),
      onPageReady: (callback) => register(handlers.pageReady, callback),
      onPageNavigate: (callback) => register(handlers.pageNavigate, callback),
      onSettingsChange: (callback) => register(handlers.settings, callback),
      onSettingAction: (callback) => register(handlers.settingAction, callback),
      onThemeChange: (callback) => register(handlers.theme, callback),

      settings: {
        get: () => ({ ...settings }),
      },

      theme: {
        get: async () => ({ ...theme }),
      },

      storage: {
        get: async (key) => (storage.has(String(key)) ? storage.get(String(key)) : null),
        set: async (key, value) => {
          storage.set(String(key), value);
          return true;
        },
        remove: async (key) => {
          storage.delete(String(key));
          return true;
        },
        clear: async () => {
          storage.clear();
          return true;
        },
        keys: async () => [...storage.keys()],
        usage: async () => ({
          bytes: Buffer.byteLength(JSON.stringify(Object.fromEntries(storage)), 'utf8'),
          limit: 256 * 1024,
        }),
      },

      commands: {
        add: async (spec) => {
          if (!spec || typeof spec.id !== 'string' || typeof spec.run !== 'function') {
            throw new Error('Команде нужны id и run');
          }
          commands.set(spec.id, spec);
          return true;
        },
        remove: async (id) => {
          commands.delete(String(id));
          return true;
        },
      },

      ui: {
        panelRow: async (spec) => {
          if (!spec || typeof spec.id !== 'string' || typeof spec.label !== 'string') {
            throw new Error('Строке нужны id и label');
          }
          panelRows.set(spec.id, spec);
          return true;
        },
        updatePanelRow: async (id, patch) => {
          const existing = panelRows.get(String(id));
          if (!existing) throw new Error('Строка панели не найдена');
          panelRows.set(String(id), { ...existing, ...(patch || {}) });
          return true;
        },
        removePanelRow: async (id) => {
          panelRows.delete(String(id));
          return true;
        },
        confirm: async (spec) =>
          typeof config.confirm === 'function' ? Boolean(config.confirm(spec)) : true,
        prompt: async (spec) =>
          typeof config.prompt === 'function'
            ? config.prompt(spec)
            : spec && spec.defaultValue !== undefined
              ? String(spec.defaultValue)
              : null,
        pick: async (spec) => {
          if (typeof config.pick === 'function') return config.pick(spec);
          const first = spec && Array.isArray(spec.items) ? spec.items[0] : null;
          if (!first) return null;
          return typeof first === 'string' ? first : first.value;
        },
        overlay: {
          show: async (spec) => {
            const id = `ov-${overlays.size + 1}`;
            overlays.set(id, String(spec && spec.text ? spec.text : ''));
            return { id };
          },
          hide: async (id) => {
            overlays.delete(String(id));
            return true;
          },
        },
        contextMenu: {
          add: async (spec) => {
            if (!spec || typeof spec.id !== 'string' || typeof spec.run !== 'function') {
              throw new Error('Пункту меню нужны id и run');
            }
            contextItems.set(spec.id, spec);
            return true;
          },
          remove: async (id) => {
            contextItems.delete(String(id));
            return true;
          },
        },
      },

      shortcuts: {
        add: async (spec) => {
          if (!spec || typeof spec.id !== 'string' || typeof spec.run !== 'function') {
            throw new Error('Клавише нужны id и run');
          }
          shortcuts.set(spec.id, spec);
          return true;
        },
        remove: async (id) => {
          shortcuts.delete(String(id));
          return true;
        },
      },

      secrets: {
        get: async (key) => (secrets.has(String(key)) ? secrets.get(String(key)) : null),
        set: async (key, value) => {
          secrets.set(String(key), String(value));
          return true;
        },
        remove: async (key) => {
          secrets.delete(String(key));
          return true;
        },
        clear: async () => {
          secrets.clear();
          return true;
        },
      },

      page: {
        injectCSS: async (value) => {
          if (typeof value !== 'string') throw new Error('page.injectCSS принимает строку');
          css.push(value);
          return true;
        },
        setCSS: async (id, value) => {
          if (typeof id !== 'string' || typeof value !== 'string') {
            throw new Error('page.setCSS принимает id и строку CSS');
          }
          namedCss.set(id, value);
          return true;
        },
        removeCSS: async (id) => {
          namedCss.delete(String(id));
          return true;
        },
        run: async (code) => {
          if (typeof code !== 'string') throw new Error('page.run принимает строку');
          if (typeof config.pageRun === 'function') return config.pageRun(code);
          return null;
        },
        getMediaInfo: async () =>
          typeof config.mediaInfo === 'function'
            ? config.mediaInfo()
            : config.mediaInfo || {
                url: 'https://www.tiktok.com/@octo/video/1',
                title: 'TikTok',
                author: '@octo',
                description: '',
                video: null,
              },
        watch: async (id, selector, callback) => {
          if (
            typeof id !== 'string' ||
            typeof selector !== 'string' ||
            typeof callback !== 'function'
          ) {
            throw new Error('page.watch требует id, selector и callback');
          }
          watchers.set(id, { selector, callback });
          return async () => {
            watchers.delete(id);
            return true;
          };
        },
        unwatch: async (id) => {
          watchers.delete(String(id));
          return true;
        },
      },

      playback: {
        status: async () => ({
          playing: playback.playing,
          muted: false,
          time: playback.time,
          duration: playback.duration,
          volume: playback.volume,
          speed: playback.speed,
        }),
        playPause: async () => {
          playback.playing = !playback.playing;
          playback.pauses += 1;
          return true;
        },
        seek: async (seconds) => {
          playback.time = Number(seconds) || 0;
          playback.seeks += 1;
          return true;
        },
        setVolume: async (value) => {
          playback.volume = Number(value) || 0;
          return true;
        },
        setSpeed: async (value) => {
          playback.speed = Number(value) || 1;
          return true;
        },
        onChange: (callback) => register(handlers.playback, callback),
      },

      feed: {
        next: async () => {
          playback.feed += 1;
          return true;
        },
        prev: async () => {
          playback.feed -= 1;
          return true;
        },
      },

      downloads: {
        add: async (url) => {
          downloads.push(String(url));
          return true;
        },
      },

      i18n: {
        get: async () => ({ locale: config.locale || 'ru', dir: config.dir || 'ltr' }),
      },

      clipboard: {
        write: async (text) => {
          clipboardText = String(text);
          return true;
        },
      },
      os: {
        notify: async (spec = {}) => {
          systemNotifications.push({
            title: String(spec.title || ''),
            body: String(spec.body || ''),
          });
          return true;
        },
      },

      net: {
        fetch: async () => {
          if (typeof config.fetch === 'function') return config.fetch();
          throw new Error('Сеть отключена в моке');
        },
      },

      navigate: async () => {
        throw new Error('navigate отключён в моке');
      },
      openExternal: async () => {
        throw new Error('openExternal отключён в моке');
      },
      notify: async (text) => {
        notifications.push(String(text));
        return true;
      },
      log: (...args) => {
        logs.push(args);
      },
    };

    return {
      octo,
      state: {
        settings,
        storage,
        secrets,
        commands,
        panelRows,
        contextItems,
        shortcuts,
        notifications,
        systemNotifications,
        logs,
        css,
        namedCss,
        watchers,
        overlays,
        downloads,
        playback,
        theme,
        clipboard: () => clipboardText,
      },
      handlers,
      /** Вызвать все зарегистрированные обработчики — как это делает хост. */
      async emit(name, payload) {
        const list = handlers[name] || [];
        for (const callback of list) await callback(payload);
      },
    };
  }

  return { createOctoMock };
});
