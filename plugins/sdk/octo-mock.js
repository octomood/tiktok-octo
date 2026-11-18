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
    const overlays = new Map();
    const downloads = [];
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
        author: config.author || 'test',
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

      settings: {
        get: () => ({ ...settings }),
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
        removePanelRow: async (id) => {
          panelRows.delete(String(id));
          return true;
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
        run: async (code) => {
          if (typeof code !== 'string') throw new Error('page.run принимает строку');
          if (typeof config.pageRun === 'function') return config.pageRun(code);
          return null;
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
        overlays,
        downloads,
        playback,
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
