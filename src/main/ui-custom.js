'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeHex } = require('./md3-palettes');
const uiFont = require('./ui-font');

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_FONT_BYTES = 10 * 1024 * 1024;
const MAX_COMPONENTS = 500;
const MAX_TOPBAR_BUTTONS = 24;
const ICON_TYPES = new Set(['default', 'preset', 'emoji', 'file', 'none']);
const TOPBAR_SLOTS = new Set(['nav', 'actions', 'tools', 'extra']);
const TOPBAR_ICON_TYPES = new Set(['preset', 'emoji', 'file', 'none']);
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const UNHIDEABLE_IDS = new Set([
  'titlebar',
  'panel',
  'win:downloads:winbar',
  'win:annotator:winbar',
  'win:update:card',
  'win:dialogs:card',
]);
const FONT_PRESETS = new Set([
  'inherit',
  'google-sans-medium',
  'inter',
  'system',
  'mono',
  'custom-name',
  'custom-file',
]);
const FONT_WEIGHTS = new Set(['', '400', '500', '600', '700']);
const ICON_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};
const ALLOWED_ICON_EXTS = new Set(Object.keys(ICON_MIME));

const UI_COMPONENTS = [
  {
    id: 'titlebar',
    group: 'titlebar',
    label: 'Верхняя полоса',
    supportsLabel: false,
    supportsIcon: false,
    supportsHeight: true,
  },
  {
    id: 'brand',
    group: 'titlebar',
    label: 'Логотип и название',
    defaultLabel: 'TikTok Octo',
    defaultTooltip: 'TikTok Octo',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnBack',
    group: 'titlebar',
    label: 'Кнопка «Назад»',
    defaultTooltip: 'Назад (Alt+←)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnForward',
    group: 'titlebar',
    label: 'Кнопка «Вперёд»',
    defaultTooltip: 'Вперёд (Alt+→)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnReload',
    group: 'titlebar',
    label: 'Кнопка «Обновить»',
    defaultTooltip: 'Обновить (Ctrl+R)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnHome',
    group: 'titlebar',
    label: 'Кнопка «Главная»',
    defaultTooltip: 'Главная',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'pagePill',
    group: 'titlebar',
    label: 'Пилюля страницы',
    defaultLabel: '{title}',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnPip',
    group: 'titlebar',
    label: 'Кнопка «Картинка в картинке»',
    defaultTooltip: 'Картинка в картинке (Ctrl+Shift+P)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnMute',
    group: 'titlebar',
    label: 'Кнопка «Звук»',
    defaultTooltip: 'Звук (Ctrl+Shift+M)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnTop',
    group: 'titlebar',
    label: 'Кнопка «Поверх всех окон»',
    defaultTooltip: 'Поверх всех окон (Ctrl+Shift+O)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnStickers',
    group: 'titlebar',
    label: 'Кнопка «Картинки в чат»',
    defaultTooltip: 'Картинки в чат',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnPluginsActive',
    group: 'titlebar',
    label: 'Кнопка «Активные плагины»',
    defaultTooltip: 'Активные плагины',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnChat',
    group: 'titlebar',
    label: 'Кнопка «Сообщения сбоку»',
    defaultTooltip: 'Сообщения сбоку (Ctrl+Shift+C)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnPanel',
    group: 'titlebar',
    label: 'Кнопка «Настройки»',
    defaultLabel: 'Настройки',
    defaultTooltip: 'Настройки (Ctrl+,)',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnMin',
    group: 'titlebar',
    label: 'Кнопка «Свернуть»',
    defaultTooltip: 'Свернуть',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnMax',
    group: 'titlebar',
    label: 'Кнопка «Развернуть»',
    defaultTooltip: 'Развернуть',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'btnClose',
    group: 'titlebar',
    label: 'Кнопка «Закрыть»',
    defaultTooltip: 'Закрыть',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'panel',
    group: 'panels',
    label: 'Окно настроек',
    defaultLabel: 'Настройки',
    supportsLabel: true,
    supportsIcon: false,
  },
  {
    id: 'pluginsPanel',
    group: 'panels',
    label: 'Менеджер плагинов',
    defaultLabel: 'Плагины',
    supportsLabel: true,
    supportsIcon: false,
  },
  {
    id: 'palette',
    group: 'panels',
    label: 'Палитра команд',
    defaultLabel: 'Введите команду или имя…',
    supportsLabel: true,
    supportsIcon: true,
  },
  {
    id: 'popover',
    group: 'panels',
    label: 'Быстрые меню (стикеры / плагины)',
    supportsLabel: false,
    supportsIcon: false,
  },
  {
    id: 'findbar',
    group: 'panels',
    label: 'Панель поиска',
    defaultLabel: 'Найти на странице',
    supportsLabel: true,
    supportsIcon: false,
  },
  {
    id: 'pipbar',
    group: 'panels',
    label: 'Мини-панель PiP',
    defaultLabel: '{title}',
    supportsLabel: true,
    supportsIcon: false,
  },
  {
    id: 'baronly',
    group: 'panels',
    label: 'Режим «Только полоса»',
    defaultLabel: '{title}',
    supportsLabel: true,
    supportsIcon: false,
  },
];

const COMPONENT_MAP = new Map(UI_COMPONENTS.map((item) => [item.id, item]));
const fileCache = new Map();

function sanitizeText(value, maxLen = 80) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t\0]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampInt(value, min, max, fallback) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isValidComponentId(id) {
  if (typeof id !== 'string' || BLOCKED_KEYS.has(id)) return false;
  if (id.includes('..')) return false;
  return /^[a-zA-Z0-9:._-]{1,120}$/.test(id);
}

function safeFilePrefix(id) {
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return id;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  const hash = crypto.createHash('sha1').update(id).digest('hex').slice(0, 12);
  return `${clean}_${hash}`;
}

function metaForComponent(id) {
  const known = COMPONENT_MAP.get(id);
  if (known) return known;
  return {
    id,
    supportsLabel: true,
    supportsIcon: true,
    supportsHeight: false,
  };
}

function iconsDir() {
  return path.join(app.getPath('userData'), 'ui-icons');
}

function fontsDir() {
  return path.join(app.getPath('userData'), 'fonts');
}

function findStoredFile(dir, prefix, exts) {
  try {
    if (!fs.existsSync(dir)) return '';
    for (const ext of exts) {
      const candidate = path.join(dir, `${prefix}${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    /* игнорируем ошибки доступа */
  }
  return '';
}

function readCachedFile(file, maxBytes, mode) {
  if (!file) return '';
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) return '';
    const cacheKey = `${file}:${mode}`;
    const hit = fileCache.get(cacheKey);
    const stamp = `${stat.size}:${stat.mtimeMs}`;
    if (hit && hit.stamp === stamp) return hit.value;
    const base64 = fs.readFileSync(file).toString('base64');
    const ext = path.extname(file).toLowerCase();
    const value =
      mode === 'dataUrl' ? `data:${ICON_MIME[ext] || 'image/png'};base64,${base64}` : base64;
    fileCache.set(cacheKey, { stamp, value });
    return value;
  } catch {
    return '';
  }
}

function removePrefixedFiles(dir, prefix, exts, keepExt = '') {
  for (const ext of exts) {
    if (keepExt && ext === keepExt) continue;
    const target = path.join(dir, `${prefix}${ext}`);
    fileCache.delete(`${target}:dataUrl`);
    fileCache.delete(`${target}:base64`);
    try {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } catch {
      /* не критично */
    }
  }
}

function normalizeComponentConfig(id, raw) {
  if (!isValidComponentId(id)) return null;
  const meta = metaForComponent(id);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const prefix = safeFilePrefix(id);
  const next = {};

  if (meta.supportsLabel) {
    const label = sanitizeText(raw.label, 80);
    if (label) next.label = label;
  }

  const tooltip = sanitizeText(raw.tooltip, 100);
  if (tooltip) next.tooltip = tooltip;

  if (meta.supportsIcon) {
    const iconType = ICON_TYPES.has(raw.iconType) ? raw.iconType : 'default';
    if (iconType === 'preset') {
      const val = sanitizeText(raw.iconValue, 40).replace(/[^a-z0-9-]/gi, '');
      if (val) {
        next.iconType = 'preset';
        next.iconValue = val;
      }
    } else if (iconType === 'emoji') {
      const val = sanitizeText(raw.iconValue, 12);
      if (val) {
        next.iconType = 'emoji';
        next.iconValue = val;
      }
    } else if (iconType === 'file') {
      const stored = findStoredFile(iconsDir(), prefix, ALLOWED_ICON_EXTS);
      if (stored) {
        next.iconType = 'file';
        next.iconValue =
          typeof raw.iconValue === 'string' && raw.iconValue.trim()
            ? path.basename(raw.iconValue).slice(0, 120)
            : path.basename(stored);
      }
    } else if (iconType === 'none') {
      next.iconType = 'none';
    }
  }

  const fgColor = normalizeHex(raw.fgColor, '');
  if (fgColor) next.fgColor = fgColor;

  const bgColor = normalizeHex(raw.bgColor, '');
  if (bgColor) next.bgColor = bgColor;

  const borderColor = normalizeHex(raw.borderColor, '');
  if (borderColor) next.borderColor = borderColor;

  const fontPreset = FONT_PRESETS.has(raw.fontPreset) ? raw.fontPreset : 'inherit';
  if (fontPreset === 'custom-name') {
    const family = uiFont.sanitizeFamily(raw.fontFamily);
    if (family) {
      next.fontPreset = 'custom-name';
      next.fontFamily = family;
    }
  } else if (fontPreset === 'custom-file') {
    const storedFont = findStoredFile(fontsDir(), `comp-${prefix}`, uiFont.ALLOWED_EXTS);
    if (storedFont) {
      next.fontPreset = 'custom-file';
      next.fontFileName =
        typeof raw.fontFileName === 'string' && raw.fontFileName.trim()
          ? path.basename(raw.fontFileName).slice(0, 120)
          : path.basename(storedFont);
    }
  } else if (fontPreset !== 'inherit') {
    next.fontPreset = fontPreset;
  }

  const fontSize = Number(raw.fontSize) > 0 ? clampInt(raw.fontSize, 9, 24, 0) : 0;
  if (fontSize > 0) next.fontSize = fontSize;

  const fontWeight = FONT_WEIGHTS.has(String(raw.fontWeight || ''))
    ? String(raw.fontWeight || '')
    : '';
  if (fontWeight) next.fontWeight = fontWeight;

  if (meta.supportsIcon) {
    const iconSize = Number(raw.iconSize) > 0 ? clampInt(raw.iconSize, 10, 28, 0) : 0;
    if (iconSize > 0) next.iconSize = iconSize;
  }

  if (raw.radius !== undefined && raw.radius !== '' && Number(raw.radius) >= 0) {
    next.radius = clampInt(raw.radius, 0, 32, 0);
  }

  const opacity = raw.opacity !== undefined ? clampInt(raw.opacity, 20, 100, 100) : 100;
  if (opacity < 100) next.opacity = opacity;

  if (meta.supportsHeight && Number(raw.height) > 0) {
    next.height = clampInt(raw.height, 38, 72, 0);
  }

  if (raw.hidden === true && !UNHIDEABLE_IDS.has(id)) {
    next.hidden = true;
  }

  return Object.keys(next).length ? next : null;
}

function normalizeUiCustom(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  let count = 0;
  for (const key of Object.keys(raw)) {
    if (count >= MAX_COMPONENTS) break;
    const cleaned = normalizeComponentConfig(key, raw[key]);
    if (cleaned) {
      result[key] = cleaned;
      count += 1;
    }
  }
  return result;
}

function sanitizeUrlPayload(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().slice(0, 400);
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return `https://www.tiktok.com${trimmed}`;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    /* невалидный URL */
  }
  return '';
}

function normalizeTopbarPayload(cmd, rawPayload) {
  if (cmd === 'openUrl') return sanitizeUrlPayload(rawPayload);
  if (typeof rawPayload === 'string') return sanitizeText(rawPayload, 200);
  if (typeof rawPayload === 'number' && Number.isFinite(rawPayload)) return rawPayload;
  if (typeof rawPayload === 'boolean') return rawPayload;
  return undefined;
}

function normalizeTopbarButton(raw, index, usedIds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cmd =
    typeof raw.cmd === 'string' && /^[a-zA-Z0-9:._-]{1,80}$/.test(raw.cmd.trim())
      ? raw.cmd.trim()
      : '';
  if (!cmd) return null;

  let id =
    typeof raw.id === 'string'
      ? raw.id
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 40)
      : '';
  if (!id || BLOCKED_KEYS.has(id) || (usedIds && usedIds.has(id))) {
    let seq = index + 1;
    while (usedIds && usedIds.has(`tb_${seq}`)) seq += 1;
    id = `tb_${seq}`;
  }
  usedIds?.add(id);

  const slot = TOPBAR_SLOTS.has(raw.slot) ? raw.slot : 'extra';
  const label = sanitizeText(raw.label, 40);
  const tooltip = sanitizeText(raw.tooltip, 100);
  const payload = normalizeTopbarPayload(cmd, raw.payload);
  if (cmd === 'openUrl' && !payload) return null;

  let iconType = TOPBAR_ICON_TYPES.has(raw.iconType) ? raw.iconType : 'preset';
  let iconValue = '';
  if (iconType === 'preset') {
    iconValue = sanitizeText(raw.iconValue, 40).replace(/[^a-z0-9-]/gi, '') || 'sparkle';
  } else if (iconType === 'emoji') {
    iconValue = sanitizeText(raw.iconValue, 12);
    if (!iconValue) {
      iconType = 'preset';
      iconValue = 'sparkle';
    }
  } else if (iconType === 'file') {
    const stored = findStoredFile(iconsDir(), safeFilePrefix(`customBtn:${id}`), ALLOWED_ICON_EXTS);
    if (stored) {
      iconValue =
        typeof raw.iconValue === 'string' && raw.iconValue.trim()
          ? path.basename(raw.iconValue).slice(0, 120)
          : path.basename(stored);
    } else {
      iconType = 'preset';
      iconValue = 'sparkle';
    }
  } else if (iconType === 'none' && !label) {
    // Кнопка совсем без иконки и текста невозможна.
    iconType = 'preset';
    iconValue = 'sparkle';
  }

  const entry = { id, cmd, slot, iconType };
  if (iconValue) entry.iconValue = iconValue;
  if (label) entry.label = label;
  if (tooltip) entry.tooltip = tooltip;
  if (payload !== undefined && payload !== '') entry.payload = payload;
  return entry;
}

function normalizeTopbarButtons(raw) {
  if (!Array.isArray(raw)) return [];
  const used = new Set();
  const out = [];
  for (let i = 0; i < raw.length && out.length < MAX_TOPBAR_BUTTONS; i += 1) {
    const item = normalizeTopbarButton(raw[i], i, used);
    if (item) out.push(item);
  }
  return out;
}

function toTopbarPayload(rawList) {
  const list = normalizeTopbarButtons(rawList);
  return list.map((item) => {
    const entry = { ...item };
    if (entry.iconType === 'file') {
      const iconFile = findStoredFile(
        iconsDir(),
        safeFilePrefix(`customBtn:${entry.id}`),
        ALLOWED_ICON_EXTS,
      );
      const dataUrl = readCachedFile(iconFile, MAX_ICON_BYTES, 'dataUrl');
      if (dataUrl) entry.iconDataUrl = dataUrl;
      else {
        entry.iconType = 'preset';
        entry.iconValue = 'sparkle';
      }
    }
    return entry;
  });
}

function installComponentIcon(compId, sourcePath) {
  if (!isValidComponentId(compId)) {
    return { ok: false, error: 'Некорректный идентификатор компонента' };
  }
  const meta = metaForComponent(compId);
  if (!meta.supportsIcon) {
    return { ok: false, error: 'Этот компонент не поддерживает смену иконки' };
  }
  if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
    return { ok: false, error: 'Не выбран файл иконки' };
  }
  const resolved = path.resolve(sourcePath);
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_ICON_EXTS.has(ext)) {
    return { ok: false, error: 'Поддерживаются PNG, JPG, WebP, SVG и GIF' };
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { ok: false, error: 'Не удалось прочитать файл иконки' };
  }
  if (!stat.isFile() || stat.size <= 0) {
    return { ok: false, error: 'Файл иконки пустой' };
  }
  if (stat.size > MAX_ICON_BYTES) {
    return { ok: false, error: 'Файл иконки больше 2 МБ' };
  }
  const dir = iconsDir();
  const prefix = safeFilePrefix(compId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  removePrefixedFiles(dir, prefix, ALLOWED_ICON_EXTS, ext);
  const dest = path.join(dir, `${prefix}${ext}`);
  fs.copyFileSync(resolved, dest);
  fileCache.delete(`${dest}:dataUrl`);
  return {
    ok: true,
    fileName: path.basename(resolved).slice(0, 120),
    dataUrl: readCachedFile(dest, MAX_ICON_BYTES, 'dataUrl'),
  };
}

function installComponentFont(compId, sourcePath) {
  if (!isValidComponentId(compId)) {
    return { ok: false, error: 'Неизвестный компонент' };
  }
  if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
    return { ok: false, error: 'Не выбран файл шрифта' };
  }
  const resolved = path.resolve(sourcePath);
  const ext = path.extname(resolved).toLowerCase();
  if (!uiFont.ALLOWED_EXTS.has(ext)) {
    return { ok: false, error: 'Поддерживаются только файлы TTF, OTF, WOFF и WOFF2' };
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { ok: false, error: 'Не удалось прочитать файл шрифта' };
  }
  if (!stat.isFile() || stat.size <= 0) {
    return { ok: false, error: 'Файл шрифта пустой' };
  }
  if (stat.size > MAX_FONT_BYTES) {
    return { ok: false, error: 'Файл шрифта больше 10 МБ' };
  }
  const dir = fontsDir();
  const prefix = `comp-${safeFilePrefix(compId)}`;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  removePrefixedFiles(dir, prefix, uiFont.ALLOWED_EXTS, ext);
  const dest = path.join(dir, `${prefix}${ext}`);
  fs.copyFileSync(resolved, dest);
  fileCache.delete(`${dest}:base64`);
  return {
    ok: true,
    fileName: path.basename(resolved).slice(0, 120),
  };
}

function removeAllStoredComponentFiles() {
  try {
    const dir = iconsDir();
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const target = path.join(dir, name);
        fileCache.delete(`${target}:dataUrl`);
        try {
          if (fs.statSync(target).isFile()) fs.unlinkSync(target);
        } catch {
          /* игнорируем */
        }
      }
    }
  } catch {
    /* игнорируем */
  }
  try {
    const dir = fontsDir();
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.startsWith('comp-')) continue;
        const target = path.join(dir, name);
        fileCache.delete(`${target}:base64`);
        try {
          if (fs.statSync(target).isFile()) fs.unlinkSync(target);
        } catch {
          /* игнорируем */
        }
      }
    }
  } catch {
    /* игнорируем */
  }
}

function removeComponentFiles(compId) {
  if (!compId) {
    removeAllStoredComponentFiles();
    return;
  }
  if (!isValidComponentId(compId)) return;
  const prefix = safeFilePrefix(compId);
  removePrefixedFiles(iconsDir(), prefix, ALLOWED_ICON_EXTS);
  removePrefixedFiles(fontsDir(), `comp-${prefix}`, uiFont.ALLOWED_EXTS);
}

function toRendererPayload(uiCustom) {
  const normalized = normalizeUiCustom(uiCustom);
  const out = {};
  for (const [id, cfg] of Object.entries(normalized)) {
    const entry = { ...cfg };
    const prefix = safeFilePrefix(id);
    if (entry.iconType === 'file') {
      const iconFile = findStoredFile(iconsDir(), prefix, ALLOWED_ICON_EXTS);
      const dataUrl = readCachedFile(iconFile, MAX_ICON_BYTES, 'dataUrl');
      if (dataUrl) entry.iconDataUrl = dataUrl;
      else {
        delete entry.iconType;
        delete entry.iconValue;
      }
    }
    if (entry.fontPreset === 'custom-file') {
      const fontFile = findStoredFile(fontsDir(), `comp-${prefix}`, uiFont.ALLOWED_EXTS);
      const base64 = readCachedFile(fontFile, MAX_FONT_BYTES, 'base64');
      if (base64) entry.fontDataBase64 = base64;
      else {
        delete entry.fontPreset;
        delete entry.fontFileName;
      }
    }
    out[id] = entry;
  }
  return out;
}

function broadcastUiCustom(uiCustom) {
  const payload = toRendererPayload(uiCustom);
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      const wc = win.webContents;
      if (!wc || wc.isDestroyed()) continue;
      try {
        wc.send('octo:ui-custom-changed', payload);
      } catch {
        /* окно закрывается */
      }
    }
    require('./context-menu').syncUiCustom?.(payload);
  } catch {
    /* тестовая среда */
  }
  return payload;
}

function listComponents() {
  return UI_COMPONENTS.map((item) => ({ ...item }));
}

try {
  ipcMain?.on('octo:ui-components', (event) => {
    event.returnValue = listComponents();
  });
  ipcMain?.on('octo:ui-custom', (event) => {
    event.returnValue = toRendererPayload(require('./app-context').ctx.uiCustom);
  });
} catch {
  /* тестовая среда без Electron IPC */
}

module.exports = {
  UI_COMPONENTS,
  COMPONENT_MAP,
  ALLOWED_ICON_EXTS,
  isValidComponentId,
  safeFilePrefix,
  normalizeComponentConfig,
  normalizeUiCustom,
  normalizeTopbarButton,
  normalizeTopbarButtons,
  toTopbarPayload,
  installComponentIcon,
  installComponentFont,
  removeComponentFiles,
  toRendererPayload,
  broadcastUiCustom,
  listComponents,
};
