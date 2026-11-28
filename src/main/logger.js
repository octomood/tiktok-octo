'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron');
const app = electron && typeof electron === 'object' ? electron.app : null;

/**
 * Централизованный журнал событий и действий приложения.
 *
 * Пишет очищенные от секретов логи в память (кольцевой буфер) и на диск
 * (`userData/logs/octo.log` с ротацией в `octo.prev.log`). Пользователь может
 * скопировать диагностику или сохранить полный файл логов из раздела
 * «Приватность» и отправить разработчикам при проблемах со входом или чатами.
 */

const MAX_RING_LINES = 2500;
const MAX_LINE_CHARS = 2000;
const MAX_FILE_BYTES = 1536 * 1024;
const FLUSH_INTERVAL_MS = 200;
const MAX_THROTTLE_KEYS = 500;

const LEVEL_WEIGHT = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const SENSITIVE_COMMANDS = new Set([
  'customCodeSet',
  'repliesSet',
  'creatorNoteSet',
  'filtersSet',
  'sideNavSearch',
  'find',
]);

const ring = [];
const pending = [];
const throttleMap = new Map();

let flushTimer = null;
let initialized = false;
let errorHandlersInstalled = false;
let flushing = false;

function logsDir() {
  if (process.env.OCTO_LOGS_DIR) return process.env.OCTO_LOGS_DIR;
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(os.tmpdir(), 'tiktok-octo-logs');
  }
}

function activeLogFile() {
  return path.join(logsDir(), 'octo.log');
}

function prevLogFile() {
  return path.join(logsDir(), 'octo.prev.log');
}

function sensitiveRoots() {
  const roots = [];
  try {
    roots.push(app.getPath('userData'));
  } catch {
    /* app ещё не инициализирован */
  }
  try {
    roots.push(app.getPath('home'));
  } catch {
    /* игнорируем */
  }
  roots.push(os.homedir());
  return [...new Set(roots.filter(Boolean))].sort((a, b) => b.length - a.length);
}

/** Убрать пути пользователя, пароли в URL, токены, cookies и секреты из текста. */
function sanitizeText(value) {
  let text = String(value ?? '');
  if (!text) return '';

  for (const root of sensitiveRoots()) {
    text = text.split(root).join('~');
    const slashRoot = root.replaceAll('\\', '/');
    if (slashRoot !== root) text = text.split(slashRoot).join('~');
  }

  text = text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s:]+:[^/@\s]+@/gi, '$1<скрыто>@');
  text = text.replace(
    /((?:token|secret|password|passwd|api[_-]?key|cookie|set-cookie|authorization|sessionid|sid_tt|uid_tt|passport_csrf_token|mstoken|ttwid|access_token|refresh_token|id_token|part|code|state)\s*[:=]\s*)[^\s,;'"&]+/gi,
    '$1<скрыто>',
  );
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer <скрыто>');
  text = text.replace(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    '<jwt>',
  );
  return text;
}

/**
 * Очистить URL: оставить схему, хост и путь, скрыть логин/пароль и значения
 * query/hash-параметров (имена параметров сохраняются для отладки OAuth).
 */
function sanitizeUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  if (!text) return '';
  if (/^about:/i.test(text)) return text.slice(0, 80);
  if (/^data:/i.test(text)) return `data:<${text.length}>`;
  if (/^blob:/i.test(text)) return `blob:${sanitizeUrl(text.slice(5))}`;

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return sanitizeText(text).slice(0, 240);
  }

  if (parsed.protocol === 'file:') {
    return sanitizeText(parsed.href).slice(0, 240);
  }

  const host = parsed.host || '';
  const pathname = parsed.pathname || '/';
  const keys = [];
  for (const [key, val] of parsed.searchParams.entries()) {
    keys.push(`${key}=<${String(val || '').length}>`);
    if (keys.length >= 16) break;
  }
  const query = keys.length ? `?${keys.join('&')}` : '';
  const hash = parsed.hash ? `#<${parsed.hash.length}>` : '';
  return sanitizeText(`${parsed.protocol}//${host}${pathname}${query}${hash}`).slice(0, 400);
}

/** Краткое безопасное описание прокси без адреса и учётных данных. */
function describeProxy(raw) {
  const text = String(raw || '').trim();
  if (!text) return { enabled: false };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `socks5://${text}`;
  try {
    const parsed = new URL(withScheme);
    return {
      enabled: true,
      scheme: parsed.protocol.replace(/:$/, ''),
      hasAuth: Boolean(parsed.username || parsed.password),
      port: Number(parsed.port) || undefined,
    };
  } catch {
    return { enabled: true, invalid: true };
  }
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^(?:https?|octo-plugin|octo-sticker|tiktok-octo|about|data|blob|file):/i.test(value)) {
      return sanitizeUrl(value);
    }
    const clean = sanitizeText(value).replace(/\s+/g, ' ').trim();
    return clean.length > 180 ? `${clean.slice(0, 180)}…` : clean;
  }
  if (value instanceof Error) {
    return sanitizeText(value.stack || value.message || String(value)).slice(0, 600);
  }
  if (depth >= 2) return '[…]';
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === 'object') {
    const out = {};
    const entries = Object.entries(value).slice(0, 16);
    for (const [key, item] of entries) {
      if (
        /^(?:password|passwd|secret|token|cookie|cookies|authorization|proxy|proxySecret|text|message|content|js|css)$/i.test(
          key,
        )
      ) {
        if (key === 'proxy') {
          out.proxy =
            item && typeof item === 'object' ? sanitizeValue(item, depth + 1) : describeProxy(item);
        } else {
          out[key] = item ? `<len:${String(item).length}>` : '';
        }
        continue;
      }
      if (/url$/i.test(key) && typeof item === 'string') {
        out[key] = sanitizeUrl(item);
        continue;
      }
      out[key] = sanitizeValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Очистить payload команды перед записью в журнал действий. */
function sanitizeCommandPayload(command, payload) {
  if (payload === undefined) return undefined;
  if (command === 'regionProxyApply') return describeProxy(payload);
  if (command === 'openUrl' || command === 'historyOpen') {
    return typeof payload === 'string' && payload.startsWith('/')
      ? sanitizeText(payload)
      : sanitizeUrl(payload);
  }
  if (command === 'customCodeSet' && payload && typeof payload === 'object') {
    return {
      cssLen: typeof payload.css === 'string' ? payload.css.length : 0,
      jsLen: typeof payload.js === 'string' ? payload.js.length : 0,
    };
  }
  if (SENSITIVE_COMMANDS.has(command)) {
    if (typeof payload === 'string') return `<len:${payload.length}>`;
    if (payload && typeof payload === 'object') {
      const summary = {};
      for (const [key, val] of Object.entries(payload)) {
        summary[key] = Array.isArray(val)
          ? `Array(${val.length})`
          : `<len:${String(val ?? '').length}>`;
      }
      return summary;
    }
  }
  return sanitizeValue(payload, 0);
}

function formatMeta(meta) {
  if (meta === undefined) return '';
  const clean = sanitizeValue(meta, 0);
  if (clean === undefined) return '';
  if (typeof clean === 'string') return clean ? ` | ${clean}` : '';
  try {
    const json = JSON.stringify(clean);
    return json && json !== '{}' ? ` | ${json}` : '';
  } catch {
    return '';
  }
}

function formatLine(level, scope, message, meta) {
  const ts = new Date().toISOString();
  const cleanScope = String(scope || 'app')
    .replace(/[^a-z0-9_.:-]/gi, '')
    .slice(0, 32);
  const cleanMsg = sanitizeText(message)
    .replace(/[\r\n]+/g, ' \\n ')
    .trim();
  const extra = formatMeta(meta);
  const full = `${ts} [${level}] [${cleanScope || 'app'}] ${cleanMsg}${extra}`;
  return full.length > MAX_LINE_CHARS ? `${full.slice(0, MAX_LINE_CHARS - 1)}…` : full;
}

function rotateIfNeeded(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size < MAX_FILE_BYTES) return;
    const prev = prevLogFile();
    try {
      fs.rmSync(prev, { force: true });
    } catch {
      /* игнорируем */
    }
    fs.renameSync(file, prev);
  } catch {
    /* файла ещё нет или недоступен */
  }
}

function flush() {
  if (flushing || pending.length === 0) return;
  flushing = true;
  clearTimeout(flushTimer);
  flushTimer = null;

  const chunk = `${pending.splice(0, pending.length).join('\n')}\n`;
  try {
    const dir = logsDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = activeLogFile();
    rotateIfNeeded(file);
    fs.appendFileSync(file, chunk, { encoding: 'utf8', mode: 0o600 });
  } catch {
    /* журнал никогда не должен ломать основное приложение */
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function write(level, scope, message, meta) {
  const normalized = LEVEL_WEIGHT[level] ? level : 'INFO';
  const line = formatLine(normalized, scope, message, meta);

  ring.push(line);
  if (ring.length > MAX_RING_LINES) ring.splice(0, ring.length - MAX_RING_LINES);

  pending.push(line);
  if (normalized === 'ERROR' || pending.length >= 40) flush();
  else scheduleFlush();

  if (process.env.OCTO_DEBUG) {
    if (normalized === 'ERROR') console.error(line);
    else if (normalized === 'WARN') console.warn(line);
    else console.log(line);
  }
  return line;
}

function debug(scope, message, meta) {
  return write('DEBUG', scope, message, meta);
}

function info(scope, message, meta) {
  return write('INFO', scope, message, meta);
}

function warn(scope, message, meta) {
  return write('WARN', scope, message, meta);
}

function error(scope, message, meta) {
  return write('ERROR', scope, message, meta);
}

/**
 * Ограничить частоту повторяющихся сообщений по ключу.
 * Подавленные повторы суммируются и дописываются при следующем пропуске.
 */
function throttled(key, intervalMs, level, scope, message, meta) {
  const now = Date.now();
  const prev = throttleMap.get(key);
  if (prev && now - prev.at < intervalMs) {
    prev.suppressed += 1;
    return '';
  }
  const suppressed = prev ? prev.suppressed : 0;
  if (throttleMap.size > MAX_THROTTLE_KEYS) {
    const firstKey = throttleMap.keys().next().value;
    if (firstKey !== undefined) throttleMap.delete(firstKey);
  }
  throttleMap.set(key, { at: now, suppressed: 0 });
  const suffix = suppressed > 0 ? ` (+${suppressed} повторов)` : '';
  return write(level, scope, `${message}${suffix}`, meta);
}

function recentLines(limit = 150) {
  const count = Math.max(1, Math.min(MAX_RING_LINES, Number(limit) || 150));
  return ring.slice(-count);
}

function readFileSafe(file, maxBytes) {
  try {
    if (!fs.existsSync(file)) return '';
    const stat = fs.statSync(file);
    if (stat.size <= maxBytes) {
      return fs.readFileSync(file, 'utf8');
    }
    const fd = fs.openSync(file, 'r');
    try {
      const start = Math.max(0, stat.size - maxBytes);
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      const text = buf.toString('utf8');
      const nl = text.indexOf('\n');
      return nl >= 0 ? text.slice(nl + 1) : text;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function readAllLogs(maxBytes = 2 * 1024 * 1024) {
  flush();
  const half = Math.floor(maxBytes / 2);
  const prev = readFileSafe(prevLogFile(), half);
  const curr = readFileSafe(activeLogFile(), maxBytes - Buffer.byteLength(prev, 'utf8'));
  const combined = [prev.trim(), curr.trim()].filter(Boolean).join('\n');
  if (combined) return sanitizeText(combined);
  return ring.join('\n');
}

function clear() {
  ring.length = 0;
  pending.length = 0;
  throttleMap.clear();
  clearTimeout(flushTimer);
  flushTimer = null;
  try {
    fs.rmSync(activeLogFile(), { force: true });
    fs.rmSync(prevLogFile(), { force: true });
  } catch {
    /* файлы логов уже отсутствуют */
  }
  info('logger', 'logs cleared');
  flush();
}

function init() {
  if (initialized) return;
  initialized = true;
  if (app && typeof app.on === 'function') {
    app.on('before-quit', () => flush());
    app.on('will-quit', () => flush());
  }
}

function installGlobalErrorHandlers() {
  if (errorHandlersInstalled) return;
  errorHandlersInstalled = true;

  process.on('uncaughtException', (err) => {
    error('process', 'uncaughtException', err);
    flush();
  });

  process.on('unhandledRejection', (reason) => {
    error('process', 'unhandledRejection', reason instanceof Error ? reason : String(reason));
  });
}

module.exports = {
  init,
  installGlobalErrorHandlers,
  flush,
  clear,
  logsDir,
  activeLogFile,
  prevLogFile,
  recentLines,
  readAllLogs,
  sanitizeText,
  sanitizeUrl,
  sanitizeValue,
  sanitizeCommandPayload,
  describeProxy,
  debug,
  info,
  warn,
  error,
  throttled,
};
