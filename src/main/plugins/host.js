'use strict';

const { BrowserWindow, ipcMain, protocol, session, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ctx, toast } = require('../app-context');
const { openExternal } = require('../links');
const { isSafeRelativePath, isCompatible } = require('./manifest');
const { scanPageScript, validateCss } = require('./security');
const { verifyInstalled, manifestFor, saveRecord, setRecordSettings } = require('./installer');
const { LIMITS, PROTOCOL } = require('./constants');
const state = require('./state');
const { normalizeTikTokUrl } = require('./navigation');
const { normalizeAccelerator, matchesInput } = require('./accelerator');

/**
 * Хост плагина.
 *
 * Каждый плагин живёт в собственном скрытом BrowserWindow с sandbox: true,
 * contextIsolation: true и без Node. Страница хоста загружается с
 * octo-plugin://<id>/…, сессия эфемерная, сеть на уровне webRequest запрещена.
 * Всё, что плагину действительно нужно, идёт через узкий IPC-мост с проверкой
 * разрешений. Никакого vm/require: это не границы безопасности.
 */

const hostWindows = new Map();
const pluginSessions = new Map();
const pendingEvents = new Map();
let initialized = false;
let onChange = null;
let onError = null;
let nextEventToken = 1;
let nextWorldId = 1000;
let networkSession = null;

const LOCAL_ID_RE = /^[a-zA-Z0-9._-]{1,48}$/;
const STORAGE_KEY_RE = /^[a-zA-Z0-9._-]{1,64}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
};

function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

function hostHtml(manifest) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none';"
    />
    <title>${manifest.name.replace(/[<>&"]/g, '')}</title>
  </head>
  <body>
    <script src="./${manifest.main.replace(/[<>&"]/g, '')}"></script>
  </body>
</html>`;
}

function textResponse(body, status = 200, type = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function serveHostFile(manifest) {
  return textResponse(hostHtml(manifest), 200, MIME['.html']);
}

function servePluginFile(id, rawUrl, root = state.pluginDir(id)) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl).pathname).replace(/^\/+/, '');
  } catch {
    return textResponse('Bad request', 400);
  }

  if (!isSafeRelativePath(pathname)) return textResponse('Not found', 404);

  const file = path.join(root, ...pathname.split('/'));
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return textResponse('Not found', 404);
  }

  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > LIMITS.fileBytes) return textResponse('Not found', 404);
    const data = fs.readFileSync(file);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return textResponse('Not found', 404);
  }
}

function createSession(id, manifest, entry) {
  const cached = pluginSessions.get(id);
  if (cached) {
    entry.session = cached;
    return cached;
  }

  const ses = session.fromPartition(`octo-plugin-runtime:${id}`);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setSpellCheckerEnabled(false);

  // Сеть плагину не нужна: его код загружается с octo-plugin://, а данные —
  // через разрешение network и отдельную сессию без cookies.
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  );

  ses.protocol.handle(PROTOCOL, (request) => {
    let host;
    let pathname;
    try {
      const url = new URL(request.url);
      host = url.hostname;
      pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return textResponse('Bad request', 400);
    }
    if (host !== id) return textResponse('Not found', 404);

    // Манифест мог обновиться: точку входа берём у текущего экземпляра.
    const current = hostWindows.get(id);
    if (pathname === '__octo_host.html') {
      return serveHostFile(current ? current.manifest : manifest);
    }
    const root = current?.record?.devDir || state.pluginDir(id);
    return servePluginFile(id, request.url, root);
  });

  pluginSessions.set(id, ses);
  entry.session = ses;
  return ses;
}

function worldIdFor(id) {
  // Стабильный, но не совпадающий с нашими служебными мирами id.
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  nextWorldId = 1000 + ((nextWorldId + hash) % 9000);
  return nextWorldId;
}

function findBySender(sender) {
  for (const entry of hostWindows.values()) {
    if (entry.wc === sender && !entry.wc.isDestroyed()) return entry;
  }
  return null;
}

function registrations(entry) {
  return {
    pluginId: entry.id,
    pluginName: entry.manifest.name,
    commands: [...entry.commands.values()].map((item) => ({ ...item })),
    panelRows: [...entry.panelRows.values()].map((item) => ({ ...item })),
  };
}

function notifyChange() {
  if (onChange) onChange();
}

function setError(entry, message, options = {}) {
  entry.error = message;
  entry.active = false;
  pushLog(entry, 'error', message);
  if (options.crash) {
    entry.record.lastLogs = entry.logs.slice(-60);
    if (!entry.record.dev) saveRecord(entry.record);
  }
  if (onError) onError(entry.id, message, options);
}

function pushLog(entry, level, message) {
  if (!entry) return;
  const text = String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
  if (!text) return;
  entry.logs.push({
    at: new Date().toISOString(),
    level: String(level || 'log').slice(0, 16),
    message: text,
  });
  if (entry.logs.length > 120) entry.logs.splice(0, entry.logs.length - 120);
}
function send(entry, type, payload = {}) {
  if (!entry.wc || entry.wc.isDestroyed()) return;
  entry.wc.send('octo:plugin-event', { type, ...payload });
}

function requestDeactivate(entry) {
  if (!entry.wc || entry.wc.isDestroyed() || !entry.ready) return Promise.resolve();
  const token = `evt-${nextEventToken++}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingEvents.delete(token);
      resolve();
    }, 800);
    pendingEvents.set(token, () => {
      clearTimeout(timer);
      pendingEvents.delete(token);
      resolve();
    });
    send(entry, 'deactivate', { token });
  });
}

async function removeCss(entry) {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    entry.cssKeys = [];
    return;
  }
  const keys = entry.cssKeys.splice(0);
  await Promise.all(keys.map((key) => wc.removeInsertedCSS(key).catch(() => {})));
}

async function applyCss(entry, css) {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  try {
    const key = await wc.insertCSS(css, { cssOrigin: 'user' });
    entry.cssKeys.push(key);
    return true;
  } catch {
    return false;
  }
}

async function reapplyCss(entry) {
  await removeCss(entry);
  for (const css of entry.cssBlocks) {
    await applyCss(entry, css);
  }
}

async function load(record) {
  if (!initialized) return false;
  if (hostWindows.has(record.id)) await unload(record.id);
  if (hostWindows.size >= LIMITS.maxPlugins) {
    if (onError) onError(record.id, 'Слишком много одновременно запущенных плагинов');
    return false;
  }

  const manifest = manifestFor(record);
  if (!manifest) {
    if (onError) onError(record.id, 'Манифест плагина не читается');
    return false;
  }
  if (!isCompatible(manifest, require('electron').app.getVersion())) {
    if (onError) onError(record.id, `Нужен TikTok octo ${manifest.minAppVersion} или новее`);
    return false;
  }

  const integrity = verifyInstalled(record);
  if (!integrity.ok) {
    if (onError) onError(record.id, integrity.error);
    return false;
  }

  const entry = {
    id: record.id,
    record,
    manifest,
    win: null,
    wc: null,
    session: null,
    active: false,
    ready: false,
    error: '',
    worldId: worldIdFor(record.id),
    commands: new Map(),
    panelRows: new Map(),
    contextItems: new Map(),
    shortcuts: new Map(),
    cssBlocks: [],
    cssKeys: [],
    calls: [],
    notifyCalls: [],
    networkCalls: [],
    pageCalls: [],
    cssCalls: [],
    logs: [],
    saveTimer: null,
  };

  let win;
  try {
    const ses = createSession(record.id, manifest, entry);
    win = new BrowserWindow({
      show: false,
      width: 420,
      height: 300,
      skipTaskbar: true,
      focusable: false,
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(__dirname, '../plugin-host-preload.js'),
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webviewTag: false,
        spellcheck: false,
        backgroundThrottling: false,
        additionalArguments: [`--octo-plugin-id=${record.id}`],
      },
    });
  } catch (err) {
    if (onError) onError(record.id, `Не удалось запустить плагин: ${err.message}`);
    return false;
  }

  entry.win = win;
  entry.wc = win.webContents;
  hostWindows.set(record.id, entry);

  win.removeMenu();
  entry.wc.setAudioMuted(true);
  entry.wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  entry.wc.on('will-navigate', (event) => event.preventDefault());
  entry.wc.on('will-redirect', (event) => event.preventDefault());
  entry.wc.on('will-attach-webview', (event) => event.preventDefault());

  entry.wc.on('console-message', (event) => {
    const message = String(event.message || '').slice(0, 1200);
    pushLog(entry, event.level ?? 'log', message);
    if (process.env.OCTO_DEBUG) {
      console.log(`[plugin:${record.id}:${event.level}]`, message.slice(0, 500));
    }
  });

  entry.wc.on('preload-error', (_event, preloadPath, error) => {
    setError(entry, `Ошибка preload: ${error?.message || preloadPath}`);
    notifyChange();
  });

  entry.wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;
    setError(entry, `Не удалось загрузить ${url}: ${description} (${code})`);
    notifyChange();
  });

  entry.wc.on('render-process-gone', (_event, details) => {
    setError(entry, `Процесс плагина завершился: ${details.reason}`, { crash: true });
    notifyChange();
  });

  entry.wc.on('unresponsive', () => {
    setError(entry, 'Плагин не отвечает');
    notifyChange();
    setTimeout(() => {
      if (hostWindows.get(record.id) === entry && entry.win && !entry.win.isDestroyed()) {
        entry.win.destroy();
        if (onError) onError(record.id, 'Плагин завис и был остановлен', { crash: true });
      }
    }, 5000);
  });

  win.on('closed', () => {
    if (hostWindows.get(record.id) === entry) hostWindows.delete(record.id);
    notifyChange();
  });

  try {
    await win.loadURL(`octo-plugin://${record.id}/__octo_host.html`);
  } catch (err) {
    setError(entry, `Не удалось загрузить плагин: ${err.message}`);
    notifyChange();
    return false;
  }

  return true;
}

async function unload(id) {
  const entry = hostWindows.get(id);
  if (!entry) return;
  hostWindows.delete(id);
  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
    if (!entry.record.dev) saveRecord(entry.record);
  }
  entry.record.lastLogs = entry.logs.slice(-60);
  if (!entry.record.dev) saveRecord(entry.record);
  await requestDeactivate(entry);
  await removeCss(entry);
  if (entry.win && !entry.win.isDestroyed()) entry.win.destroy();
  if (entry.session) {
    entry.session.clearStorageData().catch(() => {});
  }
  notifyChange();
}

async function unloadAll() {
  await Promise.all([...hostWindows.keys()].map((id) => unload(id)));
}

function markReady(entry) {
  if (entry.ready || entry.error) return;
  entry.ready = true;
  entry.active = true;
  send(entry, 'activate');
  notifyChange();

  const wc = ctx.view?.webContents;
  if (wc && !wc.isDestroyed() && !wc.isLoading()) {
    send(entry, 'page-ready', { url: wc.getURL(), title: wc.getTitle() });
  }
}

function rateLimited(entry, bucket, limit, windowMs) {
  const now = Date.now();
  const list = entry[bucket].filter((time) => now - time < windowMs);
  if (list.length >= limit) {
    entry[bucket] = list;
    return true;
  }
  list.push(now);
  entry[bucket] = list;
  return false;
}

function scheduleSave(entry) {
  if (entry.record.dev) return;
  if (entry.saveTimer) return;
  entry.saveTimer = setTimeout(() => {
    entry.saveTimer = null;
    saveRecord(entry.record);
  }, 300);
}

function storageSize(storage) {
  try {
    return Buffer.byteLength(JSON.stringify(storage), 'utf8');
  } catch {
    return 0;
  }
}

function hostForbidden(message) {
  return { ok: false, error: message };
}

async function pageContents(_entry) {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return null;
  return wc;
}

function getNetworkSession() {
  if (networkSession) return networkSession;
  networkSession = session.fromPartition('octo-plugin-outbound', { cache: false });
  networkSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  networkSession.setPermissionCheckHandler(() => false);
  return networkSession;
}

function hostAllowed(host, allowed) {
  const value = String(host || '').toLowerCase();
  return allowed.some((pattern) => {
    if (pattern === value) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return value.endsWith(suffix) && value !== suffix.slice(1);
    }
    return false;
  });
}

async function handleNetwork(entry, payload) {
  if (!entry.manifest.permissions.includes('network')) {
    return hostForbidden('Нет разрешения network');
  }
  if (rateLimited(entry, 'networkCalls', 30, 60_000)) {
    return hostForbidden('Слишком много сетевых запросов');
  }

  const rawUrl = typeof payload?.url === 'string' ? payload.url : '';
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return hostForbidden('Некорректный URL');
  }

  const local =
    url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !local) return hostForbidden('Разрешён только https');
  if (!hostAllowed(url.hostname, entry.manifest.networkHosts)) {
    return hostForbidden(`Хост ${url.hostname} не разрешён в манифесте`);
  }

  const method = String(payload?.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return hostForbidden('Метод не разрешён');
  }

  const headers = {};
  if (payload?.headers && typeof payload.headers === 'object') {
    for (const [key, value] of Object.entries(payload.headers).slice(0, 30)) {
      if (typeof value !== 'string' || value.length > 1000) continue;
      if (/^(?:cookie|host|origin|referer|content-length)$/i.test(key)) continue;
      headers[key] = value;
    }
  }

  let body;
  if (payload?.body !== undefined && payload?.body !== null) {
    body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body);
    if (Buffer.byteLength(body, 'utf8') > 100 * 1024) {
      return hostForbidden('Тело запроса больше 100 КБ');
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await getNetworkSession().fetch(url.toString(), {
      method,
      headers,
      body: method === 'GET' ? undefined : body,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
    });

    const finalUrl = new URL(response.url || url.toString());
    if (!hostAllowed(finalUrl.hostname, entry.manifest.networkHosts)) {
      return hostForbidden('Редирект увёл на неразрешённый хост');
    }

    const chunks = [];
    let total = 0;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > LIMITS.networkResponseBytes) {
          try {
            await reader.cancel();
          } catch {
            /* поток уже закрыт */
          }
          return hostForbidden('Ответ больше 2 МБ');
        }
        chunks.push(Buffer.from(value));
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > LIMITS.networkResponseBytes) {
        return hostForbidden('Ответ больше 2 МБ');
      }
      chunks.push(buffer);
    }

    const text = Buffer.concat(chunks, total).toString('utf8');
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: true,
      result: {
        ok: response.ok,
        status: response.status,
        url: finalUrl.toString(),
        headers: responseHeaders,
        text,
      },
    };
  } catch (err) {
    return hostForbidden(`Сеть: ${err.name === 'AbortError' ? 'таймаут' : err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function handleApi(entry, method, payload) {
  if (!entry || !entry.record) return hostForbidden('Плагин не найден');
  if (rateLimited(entry, 'calls', 600, 60_000)) {
    return hostForbidden('Слишком много вызовов API');
  }

  switch (method) {
    case 'ready':
      markReady(entry);
      return { ok: true };

    case 'command.add': {
      const id = typeof payload?.id === 'string' ? payload.id : '';
      const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 80) : '';
      if (!LOCAL_ID_RE.test(id) || !title) return hostForbidden('Некорректная команда');
      if (entry.commands.size >= LIMITS.maxCommands) return hostForbidden('Слишком много команд');
      entry.commands.set(id, {
        id,
        title,
        description:
          typeof payload?.description === 'string' ? payload.description.trim().slice(0, 200) : '',
      });
      notifyChange();
      return { ok: true, result: `plugin:${entry.id}:${id}` };
    }

    case 'command.remove':
      entry.commands.delete(String(payload?.id || ''));
      notifyChange();
      return { ok: true };

    case 'panel.add': {
      const id = typeof payload?.id === 'string' ? payload.id : '';
      const label = typeof payload?.label === 'string' ? payload.label.trim().slice(0, 80) : '';
      if (!LOCAL_ID_RE.test(id) || !label) return hostForbidden('Некорректная строка панели');
      if (entry.panelRows.size >= LIMITS.maxPanelRows) {
        return hostForbidden('Слишком много строк панели');
      }
      entry.panelRows.set(id, {
        id,
        label,
        description:
          typeof payload?.description === 'string' ? payload.description.trim().slice(0, 200) : '',
      });
      notifyChange();
      return { ok: true, result: `plugin:${entry.id}:row:${id}` };
    }

    case 'panel.remove':
      entry.panelRows.delete(String(payload?.id || ''));
      notifyChange();
      return { ok: true };

    case 'contextMenu.add': {
      const id = typeof payload?.id === 'string' ? payload.id : '';
      const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 80) : '';
      if (!LOCAL_ID_RE.test(id) || !title) return hostForbidden('Некорректный пункт меню');
      if (entry.contextItems.size >= 20) return hostForbidden('Слишком много пунктов меню');
      entry.contextItems.set(id, {
        id,
        title,
        description:
          typeof payload?.description === 'string' ? payload.description.trim().slice(0, 200) : '',
      });
      notifyChange();
      return { ok: true };
    }

    case 'contextMenu.remove':
      entry.contextItems.delete(String(payload?.id || ''));
      notifyChange();
      return { ok: true };

    case 'shortcuts.add': {
      if (!entry.manifest.permissions.includes('shortcuts')) {
        return hostForbidden('Нет разрешения shortcuts');
      }
      const id = typeof payload?.id === 'string' ? payload.id : '';
      const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 80) : '';
      const accelerator = normalizeAccelerator(payload?.accelerator);
      if (!LOCAL_ID_RE.test(id) || !title || !accelerator) {
        return hostForbidden('Некорректная горячая клавиша');
      }
      if (entry.shortcuts.size >= 20) return hostForbidden('Слишком много горячих клавиш');
      entry.shortcuts.set(id, {
        id,
        title,
        accelerator: String(payload.accelerator).trim().slice(0, 80),
        parsed: accelerator,
      });
      notifyChange();
      return { ok: true };
    }

    case 'shortcuts.remove':
      entry.shortcuts.delete(String(payload?.id || ''));
      notifyChange();
      return { ok: true };

    case 'navigate': {
      if (!entry.manifest.permissions.includes('navigation')) {
        return hostForbidden('Нет разрешения navigation');
      }
      const url = normalizeTikTokUrl(payload?.url);
      if (!url) return hostForbidden('Разрешены только https-страницы tiktok.com');
      const wc = await pageContents(entry);
      if (!wc) return hostForbidden('Страница ещё не готова');
      wc.loadURL(url).catch(() => {});
      return { ok: true, result: url };
    }

    case 'secrets.set': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ секрета');
      if (typeof payload?.value !== 'string') return hostForbidden('Секрет должен быть строкой');
      if (payload.value.length > 64 * 1024) return hostForbidden('Секрет больше 64 КБ');
      if (!safeStorage.isEncryptionAvailable()) {
        return hostForbidden('Системное хранилище секретов недоступно');
      }
      try {
        const encrypted = safeStorage.encryptString(payload.value).toString('base64');
        const next = { ...(entry.record.secrets || {}), [key]: encrypted };
        if (storageSize(next) > 128 * 1024) {
          return hostForbidden('Хранилище секретов заполнено');
        }
        entry.record.secrets = next;
        scheduleSave(entry);
        return { ok: true };
      } catch (err) {
        return hostForbidden(`Не удалось сохранить секрет: ${err.message}`);
      }
    }

    case 'secrets.get': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ секрета');
      const encrypted = entry.record.secrets?.[key];
      if (!encrypted) return { ok: true, result: null };
      if (!safeStorage.isEncryptionAvailable()) {
        return hostForbidden('Системное хранилище секретов недоступно');
      }
      try {
        return {
          ok: true,
          result: safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
        };
      } catch {
        return hostForbidden('Не удалось расшифровать секрет');
      }
    }

    case 'secrets.remove': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ секрета');
      const secrets = { ...(entry.record.secrets || {}) };
      delete secrets[key];
      entry.record.secrets = secrets;
      scheduleSave(entry);
      return { ok: true };
    }

    case 'secrets.clear':
      entry.record.secrets = {};
      scheduleSave(entry);
      return { ok: true };

    case 'notify': {
      if (rateLimited(entry, 'notifyCalls', 20, 60_000)) {
        return hostForbidden('Слишком много уведомлений');
      }
      const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 300) : '';
      if (!text) return hostForbidden('Пустое уведомление');
      toast(`${entry.manifest.name}: ${text}`);
      return { ok: true };
    }

    case 'storage.get': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ хранилища');
      return { ok: true, result: entry.record.storage?.[key] ?? null };
    }

    case 'storage.set': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ хранилища');
      let value;
      try {
        value = JSON.parse(JSON.stringify(payload?.value ?? null));
      } catch {
        return hostForbidden('Значение не сериализуется в JSON');
      }
      let serialized = '';
      try {
        serialized = JSON.stringify(value);
      } catch {
        return hostForbidden('Значение не сериализуется в JSON');
      }
      if (serialized.length > LIMITS.storageBytes) {
        return hostForbidden('Значение больше лимита хранилища');
      }
      const storage = { ...(entry.record.storage || {}), [key]: value };
      if (storageSize(storage) > LIMITS.storageBytes) {
        return hostForbidden('Хранилище плагина заполнено');
      }
      entry.record.storage = storage;
      scheduleSave(entry);
      return { ok: true };
    }

    case 'storage.remove': {
      const key = String(payload?.key || '');
      if (!STORAGE_KEY_RE.test(key)) return hostForbidden('Некорректный ключ хранилища');
      const storage = { ...(entry.record.storage || {}) };
      delete storage[key];
      entry.record.storage = storage;
      scheduleSave(entry);
      return { ok: true };
    }

    case 'storage.clear':
      entry.record.storage = {};
      scheduleSave(entry);
      return { ok: true };

    case 'settings.get':
      return { ok: true, result: { ...entry.record.settings } };

    case 'page.css': {
      if (!entry.manifest.permissions.includes('page:css')) {
        return hostForbidden('Нет разрешения page:css');
      }
      if (rateLimited(entry, 'cssCalls', 30, 60_000)) {
        return hostForbidden('Слишком много изменений CSS');
      }
      if (!(await pageContents(entry))) return hostForbidden('Страница ещё не готова');
      const css = typeof payload?.css === 'string' ? payload.css : '';
      const validation = validateCss(css);
      if (!validation.ok) return hostForbidden(validation.error);
      const currentSize = entry.cssBlocks.reduce((sum, block) => sum + block.length, 0);
      if (currentSize + css.length > LIMITS.cssBytes * 2) {
        return hostForbidden('Слишком много CSS для одного плагина');
      }
      entry.cssBlocks.push(css);
      if (entry.cssBlocks.length > 32) entry.cssBlocks.shift();
      const applied = await applyCss(entry, css);
      if (!applied) return hostForbidden('Не удалось применить CSS');
      return { ok: true };
    }

    case 'page.run': {
      if (!entry.manifest.permissions.includes('page:script')) {
        return hostForbidden('Нет разрешения page:script');
      }
      if (rateLimited(entry, 'pageCalls', 120, 60_000)) {
        return hostForbidden('Слишком много скриптов на странице');
      }
      const wc = await pageContents(entry);
      if (!wc) return hostForbidden('Страница ещё не готова');
      const code = typeof payload?.code === 'string' ? payload.code : '';
      if (!code.trim()) return hostForbidden('Пустой скрипт');
      const scan = scanPageScript(code);
      if (!scan.ok) {
        const first = scan.findings.find((item) => item.severity === 'block');
        return hostForbidden(first?.message || 'Скрипт не прошёл проверку');
      }
      try {
        let timer = null;
        const timeout = new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('таймаут выполнения')), 10000);
        });
        const execution = wc.executeJavaScriptInIsolatedWorld(entry.worldId, [
          {
            code: `(() => {
              const result = (() => { ${code} })();
              if (result === undefined) return null;
              let json;
              try {
                json = JSON.stringify(result);
              } catch {
                throw new Error('Результат page.run не сериализуется в JSON');
              }
              if (json && json.length > 256 * 1024) {
                throw new Error('Результат page.run больше 256 КБ');
              }
              return result;
            })()`,
          },
        ]);
        let result;
        try {
          result = await Promise.race([execution, timeout]);
        } finally {
          clearTimeout(timer);
        }
        return { ok: true, result };
      } catch (err) {
        return hostForbidden(`Ошибка на странице: ${err.message}`);
      }
    }

    case 'net.fetch':
      return handleNetwork(entry, payload);

    case 'openExternal': {
      if (!entry.manifest.permissions.includes('links')) {
        return hostForbidden('Нет разрешения links');
      }
      const raw = typeof payload?.url === 'string' ? payload.url : '';
      if (!/^https:\/\//i.test(raw)) return hostForbidden('Разрешены только https-ссылки');
      openExternal(raw);
      return { ok: true };
    }

    case 'log': {
      const args = Array.isArray(payload?.args)
        ? payload.args.map((item) => String(item).slice(0, 500))
        : [];
      pushLog(entry, 'log', args.join(' '));
      if (process.env.OCTO_DEBUG) console.log(`[plugin:${entry.id}]`, ...args);
      return { ok: true };
    }

    default:
      return hostForbidden(`Неизвестный метод API: ${String(method).slice(0, 40)}`);
  }
}

function updateSettings(record) {
  const entry = hostWindows.get(record.id);
  if (!entry) return;
  entry.record = record;
  send(entry, 'settings-changed', { settings: { ...record.settings } });
}

function onPageReady(info) {
  for (const entry of hostWindows.values()) {
    if (!entry.active) continue;
    reapplyCss(entry);
    send(entry, 'page-ready', info);
  }
}

function onPageNavigate(info) {
  for (const entry of hostWindows.values()) {
    if (!entry.active) continue;
    send(entry, 'page-navigate', info);
  }
}

function runCommand(commandId, payload) {
  const match = /^plugin:([a-z0-9.-]+):(row:)?([a-zA-Z0-9._-]+)$/.exec(String(commandId || ''));
  if (!match) return false;

  const entry = hostWindows.get(match[1]);
  if (!entry || !entry.active) return false;

  if (match[2]) {
    if (!entry.panelRows.has(match[3])) return false;
    send(entry, 'panel-row', { id: match[3] });
    return true;
  }

  if (!entry.commands.has(match[3])) return false;
  send(entry, 'command', { id: match[3], payload });
  return true;
}

function handleShortcut(input) {
  for (const entry of hostWindows.values()) {
    if (!entry.active) continue;
    for (const shortcut of entry.shortcuts.values()) {
      if (!matchesInput(shortcut.parsed, input)) continue;
      send(entry, 'shortcut', { id: shortcut.id });
      return true;
    }
  }
  return false;
}

function contextMenuItems(context) {
  const safeContext = {
    linkURL: String(context?.linkURL || '').slice(0, 1000),
    selectionText: String(context?.selectionText || '').slice(0, 1000),
    isEditable: context?.isEditable === true,
    mediaType: String(context?.mediaType || '').slice(0, 40),
    srcURL: String(context?.srcURL || '').slice(0, 1000),
    pageURL: String(context?.pageURL || '').slice(0, 1000),
  };

  const items = [];
  for (const entry of hostWindows.values()) {
    if (!entry.active) continue;
    for (const item of entry.contextItems.values()) {
      if (items.length >= 12) return items;
      items.push({
        label: `${item.title} · ${entry.manifest.name}`,
        click: () => send(entry, 'context-menu', { id: item.id, context: safeContext }),
      });
    }
  }
  return items;
}

function getLogs(id, limit = 60) {
  const entry = hostWindows.get(id);
  const logs = entry ? entry.logs : state.get(id)?.lastLogs || [];
  return logs.slice(-Math.max(1, Math.min(120, limit))).map((item) => ({ ...item }));
}

function summaryRows() {
  const rows = [];
  const commands = [];
  for (const entry of hostWindows.values()) {
    if (!entry.active) continue;
    for (const row of entry.panelRows.values()) {
      rows.push({
        id: `plugin:${entry.id}:row:${row.id}`,
        label: row.label,
        description: row.description,
        pluginId: entry.id,
        pluginName: entry.manifest.name,
      });
    }
    for (const command of entry.commands.values()) {
      commands.push({
        id: `plugin:${entry.id}:${command.id}`,
        title: command.title,
        description: command.description,
        pluginId: entry.id,
        pluginName: entry.manifest.name,
      });
    }
  }
  return { rows, commands };
}

function getHost(id) {
  return hostWindows.get(id) || null;
}

function init({ onChange: changeHandler, onError: errorHandler } = {}) {
  if (initialized) return;
  initialized = true;
  onChange = typeof changeHandler === 'function' ? changeHandler : null;
  onError = typeof errorHandler === 'function' ? errorHandler : null;

  ipcMain.on('octo:plugin-init', (event) => {
    const entry = findBySender(event.sender);
    if (!entry) {
      event.returnValue = { ok: false };
      return;
    }
    event.returnValue = {
      ok: true,
      plugin: {
        id: entry.manifest.id,
        name: entry.manifest.name,
        version: entry.manifest.version,
        author: entry.manifest.author,
        permissions: entry.manifest.permissions,
      },
      app: {
        version: require('electron').app.getVersion(),
        electron: process.versions.electron,
        platform: process.platform,
      },
      settings: { ...entry.record.settings },
    };
  });

  ipcMain.handle('octo:plugin-api', async (event, method, payload) => {
    const entry = findBySender(event.sender);
    if (!entry) return hostForbidden('Плагин не найден');
    try {
      return await handleApi(entry, method, payload);
    } catch (err) {
      return hostForbidden(err.message);
    }
  });

  ipcMain.on('octo:plugin-event-done', (_event, token) => {
    const resolve = pendingEvents.get(token);
    if (resolve) resolve();
  });

  ipcMain.on('octo:plugin-runtime-error', (event, message) => {
    const entry = findBySender(event.sender);
    if (!entry) return;
    const text = String(message || 'Неизвестная ошибка').slice(0, 800);
    setError(entry, text);
    notifyChange();
  });
}

module.exports = {
  registerScheme,
  init,
  load,
  unload,
  unloadAll,
  onPageReady,
  onPageNavigate,
  runCommand,
  handleShortcut,
  contextMenuItems,
  getLogs,
  updateSettings,
  summaryRows,
  getHost,
  registrations,
  setRecordSettings,
};
