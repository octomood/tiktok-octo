'use strict';

const { app, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeHex } = require('./md3-palettes');
const uiFont = require('./ui-font');

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_FONT_BYTES = 10 * 1024 * 1024;
const ICON_TYPES = new Set(['default', 'preset', 'emoji', 'file', 'none']);
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
  const meta = COMPONENT_MAP.get(id);
  if (!meta || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const next = {};

  if (meta.supportsLabel) {
    const label = sanitizeText(raw.label, 60);
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
      const stored = findStoredFile(iconsDir(), id, ALLOWED_ICON_EXTS);
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
    const storedFont = findStoredFile(fontsDir(), `comp-${id}`, uiFont.ALLOWED_EXTS);
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

  if (raw.hidden === true && id !== 'titlebar' && id !== 'panel') {
    next.hidden = true;
  }

  return Object.keys(next).length ? next : null;
}

function normalizeUiCustom(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const item of UI_COMPONENTS) {
    const cleaned = normalizeComponentConfig(item.id, raw[item.id]);
    if (cleaned) result[item.id] = cleaned;
  }
  return result;
}

function installComponentIcon(compId, sourcePath) {
  const meta = COMPONENT_MAP.get(compId);
  if (!meta || !meta.supportsIcon) {
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
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  removePrefixedFiles(dir, compId, ALLOWED_ICON_EXTS, ext);
  const dest = path.join(dir, `${compId}${ext}`);
  fs.copyFileSync(resolved, dest);
  fileCache.delete(`${dest}:dataUrl`);
  return {
    ok: true,
    fileName: path.basename(resolved).slice(0, 120),
  };
}

function installComponentFont(compId, sourcePath) {
  if (!COMPONENT_MAP.has(compId)) {
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
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  removePrefixedFiles(dir, `comp-${compId}`, uiFont.ALLOWED_EXTS, ext);
  const dest = path.join(dir, `comp-${compId}${ext}`);
  fs.copyFileSync(resolved, dest);
  fileCache.delete(`${dest}:base64`);
  return {
    ok: true,
    fileName: path.basename(resolved).slice(0, 120),
  };
}

function removeComponentFiles(compId) {
  if (!compId) {
    for (const item of UI_COMPONENTS) removeComponentFiles(item.id);
    return;
  }
  removePrefixedFiles(iconsDir(), compId, ALLOWED_ICON_EXTS);
  removePrefixedFiles(fontsDir(), `comp-${compId}`, uiFont.ALLOWED_EXTS);
}

function toRendererPayload(uiCustom) {
  const normalized = normalizeUiCustom(uiCustom);
  const out = {};
  for (const [id, cfg] of Object.entries(normalized)) {
    const entry = { ...cfg };
    if (entry.iconType === 'file') {
      const iconFile = findStoredFile(iconsDir(), id, ALLOWED_ICON_EXTS);
      const dataUrl = readCachedFile(iconFile, MAX_ICON_BYTES, 'dataUrl');
      if (dataUrl) entry.iconDataUrl = dataUrl;
      else {
        delete entry.iconType;
        delete entry.iconValue;
      }
    }
    if (entry.fontPreset === 'custom-file') {
      const fontFile = findStoredFile(fontsDir(), `comp-${id}`, uiFont.ALLOWED_EXTS);
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

function listComponents() {
  return UI_COMPONENTS.map((item) => ({ ...item }));
}

try {
  ipcMain?.on('octo:ui-components', (event) => {
    event.returnValue = listComponents();
  });
} catch {
  /* тестовая среда без Electron IPC */
}

module.exports = {
  UI_COMPONENTS,
  COMPONENT_MAP,
  ALLOWED_ICON_EXTS,
  normalizeComponentConfig,
  normalizeUiCustom,
  installComponentIcon,
  installComponentFont,
  removeComponentFiles,
  toRendererPayload,
  listComponents,
};
