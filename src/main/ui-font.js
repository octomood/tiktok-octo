'use strict';

const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const PRESETS = new Set(['google-sans-medium', 'inter', 'system', 'custom-name', 'custom-file']);
const ALLOWED_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const MAX_FONT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PRESET = 'google-sans-medium';

let cachedFileKey = '';
let cachedFileBase64 = '';

function sanitizeFamily(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/['"`\\;{}\r\n<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function customFontDir() {
  return path.join(app.getPath('userData'), 'fonts');
}

function findStoredFontFile() {
  try {
    const dir = customFontDir();
    if (!fs.existsSync(dir)) return '';
    for (const ext of ALLOWED_EXTS) {
      const candidate = path.join(dir, `ui-custom${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    /* игнорируем ошибки чтения каталога шрифтов */
  }
  return '';
}

function readCustomFontBase64() {
  const file = findStoredFontFile();
  if (!file) {
    cachedFileKey = '';
    cachedFileBase64 = '';
    return '';
  }
  try {
    const stat = fs.statSync(file);
    const key = `${file}:${stat.size}:${stat.mtimeMs}`;
    if (key === cachedFileKey && cachedFileBase64) return cachedFileBase64;
    if (stat.size <= 0 || stat.size > MAX_FONT_BYTES) return '';
    cachedFileBase64 = fs.readFileSync(file).toString('base64');
    cachedFileKey = key;
    return cachedFileBase64;
  } catch {
    return '';
  }
}

function normalizeUiFont(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preset: DEFAULT_PRESET, family: '', fileName: '' };
  }
  const preset = PRESETS.has(raw.preset) ? raw.preset : DEFAULT_PRESET;
  const family = preset === 'custom-name' ? sanitizeFamily(raw.family) : '';
  const fileName =
    preset === 'custom-file' && typeof raw.fileName === 'string'
      ? path.basename(raw.fileName).slice(0, 120)
      : '';

  if (preset === 'custom-name' && !family) {
    return { preset: DEFAULT_PRESET, family: '', fileName: '' };
  }
  if (preset === 'custom-file' && !findStoredFontFile()) {
    return { preset: DEFAULT_PRESET, family: '', fileName: '' };
  }
  return { preset, family, fileName };
}

function installFontFile(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
    return { ok: false, error: 'Не выбран файл шрифта' };
  }
  const resolved = path.resolve(sourcePath);
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
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

  const dir = customFontDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const oldExt of ALLOWED_EXTS) {
    const oldPath = path.join(dir, `ui-custom${oldExt}`);
    if (oldExt !== ext && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        /* не критично */
      }
    }
  }

  const dest = path.join(dir, `ui-custom${ext}`);
  fs.copyFileSync(resolved, dest);
  cachedFileKey = '';
  cachedFileBase64 = '';
  return {
    ok: true,
    uiFont: {
      preset: 'custom-file',
      family: '',
      fileName: path.basename(resolved).slice(0, 120),
    },
  };
}

function toRendererPayload(uiFont) {
  const normalized = normalizeUiFont(uiFont);
  return {
    preset: normalized.preset,
    family: normalized.family,
    fileName: normalized.fileName,
    dataBase64: normalized.preset === 'custom-file' ? readCustomFontBase64() : '',
  };
}

module.exports = {
  DEFAULT_PRESET,
  PRESETS,
  ALLOWED_EXTS,
  sanitizeFamily,
  normalizeUiFont,
  installFontFile,
  toRendererPayload,
};
