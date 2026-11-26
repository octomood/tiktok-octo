'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост для плагина.
 *
 * Плагин видит только этот объект: ни require, ни process, ни ipcRenderer.
 * Все вызовы уходят в main, где проверяются разрешения из манифеста. Сами
 * колбэки живут здесь, в preload, поэтому плагин не может подменить обработчик
 * команды уже после регистрации.
 */

const arg = process.argv.find((value) => value.startsWith('--octo-plugin-id='));
const pluginId = arg ? arg.slice('--octo-plugin-id='.length) : '';

function reportError(error, { fatal = false } = {}) {
  const message = error && error.stack ? error.stack : String(error);
  ipcRenderer.invoke('octo:plugin-api', 'log', { args: [message] }).catch(() => {});
  if (fatal) ipcRenderer.send('octo:plugin-runtime-error', message);
}

let init = { ok: false };
try {
  init = ipcRenderer.sendSync('octo:plugin-init');
} catch (error) {
  reportError(error, { fatal: true });
}

if (!init || !init.ok) {
  throw new Error(`Плагин ${pluginId || '(без id)'} не зарегистрирован в приложении`);
}

let settings = { ...(init.settings || {}) };
const activateHandlers = [];
const deactivateHandlers = [];
const pageReadyHandlers = [];
const pageNavigateHandlers = [];
const settingsHandlers = [];
const settingActionHandlers = [];
const themeHandlers = [];
const playbackHandlers = [];
const watchers = new Map();
const commands = new Map();
const panelRows = new Map();
const contextItems = new Map();
const shortcuts = new Map();

function register(list, callback) {
  if (typeof callback !== 'function') return () => {};
  list.push(callback);
  return () => {
    const index = list.indexOf(callback);
    if (index >= 0) list.splice(index, 1);
  };
}

async function runHandler(callback, ...args) {
  try {
    return await callback(...args);
  } catch (error) {
    reportError(error);
    return undefined;
  }
}

function runAll(list, ...args) {
  for (const callback of [...list]) runHandler(callback, ...args);
}

async function call(method, payload) {
  const response = await ipcRenderer.invoke('octo:plugin-api', method, payload);
  if (!response || response.ok !== true) {
    throw new Error(response?.error || 'Плагин: вызов API отклонён');
  }
  return response.result;
}

async function addCommand(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('commands.add: нужен объект');
  if (typeof spec.id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(spec.id)) {
    throw new Error('commands.add: некорректный id');
  }
  if (typeof spec.title !== 'string' || !spec.title.trim()) {
    throw new Error('commands.add: нужен title');
  }
  if (typeof spec.run !== 'function') throw new Error('commands.add: нужен run()');

  commands.set(spec.id, spec.run);
  try {
    return await call('command.add', {
      id: spec.id,
      title: spec.title,
      description: spec.description,
    });
  } catch (error) {
    commands.delete(spec.id);
    throw error;
  }
}

async function addPanelRow(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('ui.panelRow: нужен объект');
  if (typeof spec.id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(spec.id)) {
    throw new Error('ui.panelRow: некорректный id');
  }
  if (typeof spec.label !== 'string' || !spec.label.trim()) {
    throw new Error('ui.panelRow: нужен label');
  }
  if (typeof spec.run !== 'function') throw new Error('ui.panelRow: нужен run()');

  panelRows.set(spec.id, spec.run);
  try {
    return await call('panel.add', {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      badge: spec.badge,
    });
  } catch (error) {
    panelRows.delete(spec.id);
    throw error;
  }
}

async function updatePanelRow(id, patch) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(id)) {
    throw new Error('ui.updatePanelRow: некорректный id');
  }
  const options = patch && typeof patch === 'object' ? patch : {};
  if (typeof options.run === 'function') panelRows.set(id, options.run);
  return call('panel.update', {
    id,
    label: options.label,
    description: options.description,
    badge: options.badge,
  });
}

async function addContextItem(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('ui.contextMenu.add: нужен объект');
  if (typeof spec.id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(spec.id)) {
    throw new Error('ui.contextMenu.add: некорректный id');
  }
  if (typeof spec.title !== 'string' || !spec.title.trim()) {
    throw new Error('ui.contextMenu.add: нужен title');
  }
  if (typeof spec.run !== 'function') throw new Error('ui.contextMenu.add: нужен run()');

  contextItems.set(spec.id, spec.run);
  try {
    return await call('contextMenu.add', {
      id: spec.id,
      title: spec.title,
      description: spec.description,
    });
  } catch (error) {
    contextItems.delete(spec.id);
    throw error;
  }
}

async function addShortcut(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('shortcuts.add: нужен объект');
  if (typeof spec.id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(spec.id)) {
    throw new Error('shortcuts.add: некорректный id');
  }
  if (typeof spec.title !== 'string' || !spec.title.trim()) {
    throw new Error('shortcuts.add: нужен title');
  }
  if (typeof spec.run !== 'function') throw new Error('shortcuts.add: нужен run()');
  if (typeof spec.accelerator !== 'string' || !spec.accelerator.trim()) {
    throw new Error('shortcuts.add: нужен accelerator');
  }

  shortcuts.set(spec.id, spec.run);
  try {
    return await call('shortcuts.add', {
      id: spec.id,
      title: spec.title,
      accelerator: spec.accelerator,
    });
  } catch (error) {
    shortcuts.delete(spec.id);
    throw error;
  }
}

ipcRenderer.on('octo:plugin-event', (_event, message) => {
  if (!message || typeof message !== 'object') return;
  switch (message.type) {
    case 'activate':
      runAll(activateHandlers);
      break;
    case 'deactivate':
      Promise.allSettled(deactivateHandlers.map((callback) => runHandler(callback))).finally(() => {
        ipcRenderer.send('octo:plugin-event-done', message.token);
      });
      break;
    case 'page-ready':
      runAll(pageReadyHandlers, { url: message.url || '', title: message.title || '' });
      break;
    case 'page-navigate':
      runAll(pageNavigateHandlers, { url: message.url || '', title: message.title || '' });
      break;
    case 'settings-changed':
      settings = { ...(message.settings || {}) };
      runAll(settingsHandlers, { ...settings });
      break;
    case 'setting-action':
      runAll(settingActionHandlers, String(message.key || ''));
      break;
    case 'theme-changed':
      runAll(themeHandlers, {
        mode: message.mode || 'dark',
        dark: Boolean(message.dark),
        palette: message.palette || 'octo-lavender',
        tokens: message.tokens || {},
      });
      break;
    case 'playback-changed':
      runAll(playbackHandlers, {
        playing: Boolean(message.playing),
        muted: Boolean(message.muted),
        volume: Number(message.volume ?? 1),
        speed: Number(message.speed ?? 1),
        url: message.url || '',
      });
      break;
    case 'page-watch': {
      const handler = watchers.get(message.id);
      if (handler) {
        runHandler(handler, {
          id: message.id,
          count: Number(message.count) || 0,
          matched: Boolean(message.matched),
          texts: Array.isArray(message.texts) ? message.texts : [],
        });
      }
      break;
    }
    case 'command': {
      const handler = commands.get(message.id);
      if (handler) runHandler(handler, message.payload);
      break;
    }
    case 'panel-row': {
      const handler = panelRows.get(message.id);
      if (handler) runHandler(handler);
      break;
    }
    case 'context-menu': {
      const handler = contextItems.get(message.id);
      if (handler) runHandler(handler, message.context || {});
      break;
    }
    case 'shortcut': {
      const handler = shortcuts.get(message.id);
      if (handler) runHandler(handler);
      break;
    }
    default:
      break;
  }
});

window.addEventListener('load', () => {
  ipcRenderer.invoke('octo:plugin-api', 'ready').catch(reportError);
});

window.addEventListener('error', (event) => {
  reportError(event.error || event.message || 'Неизвестная ошибка плагина', { fatal: true });
});

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason || 'Необработанный Promise в плагине');
});

const api = {
  apiVersion: 1,
  plugin: Object.freeze({
    id: init.plugin.id,
    name: init.plugin.name,
    version: init.plugin.version,
    author: init.plugin.author,
    permissions: Object.freeze([...(init.plugin.permissions || [])]),
  }),
  app: Object.freeze({ ...init.app }),
  onActivate(callback) {
    return register(activateHandlers, callback);
  },
  onDeactivate(callback) {
    return register(deactivateHandlers, callback);
  },
  onPageReady(callback) {
    return register(pageReadyHandlers, callback);
  },
  onPageNavigate(callback) {
    return register(pageNavigateHandlers, callback);
  },
  onSettingsChange(callback) {
    return register(settingsHandlers, callback);
  },
  onSettingAction(callback) {
    return register(settingActionHandlers, callback);
  },
  onThemeChange(callback) {
    return register(themeHandlers, callback);
  },
  settings: {
    get() {
      return { ...settings };
    },
  },
  theme: {
    get() {
      return call('theme.get', {});
    },
  },
  storage: {
    get(key) {
      return call('storage.get', { key: String(key) });
    },
    set(key, value) {
      return call('storage.set', { key: String(key), value });
    },
    remove(key) {
      return call('storage.remove', { key: String(key) });
    },
    clear() {
      return call('storage.clear', {});
    },
    keys() {
      return call('storage.keys', {});
    },
    usage() {
      return call('storage.usage', {});
    },
  },
  commands: {
    add(spec) {
      return addCommand(spec);
    },
    remove(id) {
      commands.delete(String(id));
      return call('command.remove', { id: String(id) });
    },
  },
  ui: {
    panelRow(spec) {
      return addPanelRow(spec);
    },
    updatePanelRow(id, patch) {
      return updatePanelRow(id, patch);
    },
    removePanelRow(id) {
      panelRows.delete(String(id));
      return call('panel.remove', { id: String(id) });
    },
    confirm(spec = {}) {
      const options = spec && typeof spec === 'object' ? spec : {};
      return call('ui.confirm', {
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
      });
    },
    prompt(spec = {}) {
      const options = spec && typeof spec === 'object' ? spec : {};
      return call('ui.prompt', {
        title: options.title,
        message: options.message,
        placeholder: options.placeholder,
        defaultValue: options.defaultValue,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
      });
    },
    pick(spec = {}) {
      const options = spec && typeof spec === 'object' ? spec : {};
      return call('ui.pick', {
        title: options.title,
        placeholder: options.placeholder,
        items: options.items,
      });
    },
    contextMenu: {
      add(spec) {
        return addContextItem(spec);
      },
      remove(id) {
        contextItems.delete(String(id));
        return call('contextMenu.remove', { id: String(id) });
      },
    },
    overlay: {
      show(spec) {
        const options = spec && typeof spec === 'object' ? spec : {};
        return call('overlay.show', {
          text: String(options.text || '').slice(0, 200),
          timeoutMs: Number(options.timeoutMs) || 2500,
        });
      },
      hide(id) {
        return call('overlay.hide', { id: String(id) });
      },
    },
  },
  shortcuts: {
    add(spec) {
      return addShortcut(spec);
    },
    remove(id) {
      shortcuts.delete(String(id));
      return call('shortcuts.remove', { id: String(id) });
    },
  },
  secrets: {
    get(key) {
      return call('secrets.get', { key: String(key) });
    },
    set(key, value) {
      return call('secrets.set', { key: String(key), value: String(value) });
    },
    remove(key) {
      return call('secrets.remove', { key: String(key) });
    },
    clear() {
      return call('secrets.clear', {});
    },
  },
  page: {
    injectCSS(css) {
      if (typeof css !== 'string') throw new Error('page.injectCSS принимает строку');
      return call('page.css', { css });
    },
    setCSS(id, css) {
      if (typeof id !== 'string') throw new Error('page.setCSS принимает id и css');
      if (typeof css !== 'string') throw new Error('page.setCSS принимает строку CSS');
      return call('page.setCSS', { id, css });
    },
    removeCSS(id) {
      return call('page.removeCSS', { id: String(id) });
    },
    run(code) {
      if (typeof code !== 'string') throw new Error('page.run принимает строку кода');
      return call('page.run', { code });
    },
    getMediaInfo() {
      return call('page.getMediaInfo', {});
    },
    async watch(id, selector, callback) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,48}$/.test(id)) {
        throw new Error('page.watch: некорректный id');
      }
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error('page.watch: нужен CSS-селектор');
      }
      if (typeof callback !== 'function') {
        throw new Error('page.watch: нужен callback');
      }
      watchers.set(id, callback);
      try {
        await call('page.watch', { id, selector });
      } catch (error) {
        watchers.delete(id);
        throw error;
      }
      return () => {
        watchers.delete(id);
        return call('page.unwatch', { id }).catch(() => {});
      };
    },
    unwatch(id) {
      watchers.delete(String(id));
      return call('page.unwatch', { id: String(id) });
    },
  },
  net: {
    fetch(url, options = {}) {
      return call('net.fetch', { url: String(url), ...options });
    },
  },
  playback: {
    status() {
      return call('playback.status', {});
    },
    playPause() {
      return call('playback.playPause', {});
    },
    seek(seconds) {
      return call('playback.seek', { seconds: Number(seconds) });
    },
    setVolume(value) {
      return call('playback.volume', { value: Number(value) });
    },
    setSpeed(value) {
      return call('playback.speed', { value: Number(value) });
    },
    onChange(callback) {
      if (!(init.plugin.permissions || []).includes('playback')) {
        throw new Error('Нет разрешения playback');
      }
      return register(playbackHandlers, callback);
    },
  },
  feed: {
    next() {
      return call('feed.next', {});
    },
    prev() {
      return call('feed.prev', {});
    },
  },
  downloads: {
    add(url) {
      return call('downloads.add', { url: String(url) });
    },
  },
  i18n: {
    get() {
      return call('i18n.get', {});
    },
  },
  clipboard: {
    write(text) {
      return call('clipboard.write', { text: String(text) });
    },
  },
  os: {
    notify(spec = {}) {
      return call('os.notify', {
        title: String(spec.title || ''),
        body: String(spec.body || ''),
      });
    },
  },
  navigate(url) {
    return call('navigate', { url: String(url) });
  },
  openExternal(url) {
    return call('openExternal', { url: String(url) });
  },
  notify(text) {
    return call('notify', { text: String(text) });
  },
  log(...args) {
    const values = args.map((item) => {
      if (typeof item === 'string') return item;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    });
    ipcRenderer.invoke('octo:plugin-api', 'log', { args: values }).catch(() => {});
  },
};

Object.freeze(api);
contextBridge.exposeInMainWorld('octo', api);
