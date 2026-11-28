'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const {
  ctx,
  pushState,
  toast,
  setCosmeticsState,
  setCloseToTray,
  clampUiScale,
} = require('./app-context');
const { readState, writeState, replaceState, statePath } = require('./store');
const pluginsState = require('./plugins/state');
const { showOpenDialog, showSaveDialog, showMessageBox } = require('./dialogs');
const { APP_LANGUAGES, SITE_LANGUAGES } = require('./language-catalog');
const { REGION_PRESETS } = require('./region-catalog');
const { COSMETIC_RULES } = require('./cosmetic-catalog');
const { PARTITION } = require('./shared');
const { stripProxyCredentials, stripRegionCredentials } = require('./proxy-url');

/**
 * Экспорт и импорт настроек одним JSON, плюс ежедневные резервные копии.
 *
 * В файл попадают только собственные настройки приложения и настройки
 * менеджера плагинов. Cookies, переписка, история, ключи, содержимое
 * библиотеки и пароли не экспортируются. Импорт заменяет совпадающие ключи,
 * а перед заменой делает резервную копию текущего состояния.
 */

const EXPORT_KIND = 'tiktok-octo-settings';
const BACKUP_KIND = 'tiktok-octo-backup';
const SCHEMA = 1;
const MAX_IMPORT_BYTES = 512 * 1024;
const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
const MAX_BACKUPS = 8;
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const LIMITS = { depth: 5, keys: 300, array: 300, string: 4000 };

/** Что считается настройками: остальное (библиотека, статистика, cookies) — нет. */
const SETTINGS_KEYS = [
  'player',
  'cosmetics',
  'themeMode',
  'themeAmoled',
  'themePalette',
  'themeCustom',
  'themeRainbow',
  'region',
  'language',
  'siteLanguage',
  'keymap',
  'attention',
  'replies',
  'notifications',
  'subtitles',
  'focus',
  'feedKeys',
  'zoomFactor',
  'uiScale',
  'uiFont',
  'uiCustom',
  'alwaysOnTop',
  'closeToTray',
  'startInTray',
  'chatWidth',
  'chatDock',
  'pip',
  'sleep',
  'downloadNaming',
  'filters',
  'gif',
];

const BOOLEAN_KEYS = new Set([
  'themeAmoled',
  'feedKeys',
  'alwaysOnTop',
  'closeToTray',
  'startInTray',
]);

let onChange = null;
let initialized = false;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Глубокая копия с ограничениями: чужие ключи и гигантские значения не нужны. */
function clone(value, depth = 0) {
  if (depth > LIMITS.depth) return undefined;
  if (typeof value === 'string') return value.slice(0, LIMITS.string);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (!value || typeof value !== 'object') return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, LIMITS.array)
      .map((item) => clone(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  const result = {};
  for (const key of Object.keys(value).slice(0, LIMITS.keys)) {
    if (BLOCKED_KEYS.has(key) || key.length > 60) continue;
    const next = clone(value[key], depth + 1);
    if (next !== undefined) result[key] = next;
  }
  return result;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function cleanCosmetics(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  for (const rule of COSMETIC_RULES) {
    if (typeof value[rule.id] === 'boolean') result[rule.id] = value[rule.id];
  }
  return result;
}

function cleanRegion(value) {
  if (!isPlainObject(value)) return null;
  const result = {};
  const preset = REGION_PRESETS.find((item) => item.id === value.preset);
  if (preset) result.preset = preset.id;
  if (typeof value.proxy === 'string') {
    // Диалог импорта обещает не импортировать пароли: адрес оставляем,
    // учётные данные из чужого файла отбрасываем.
    const proxy = stripProxyCredentials(value.proxy).slice(0, 300);
    if (!proxy || /^(https?|socks4|socks5):\/\/\S+$/i.test(proxy)) result.proxy = proxy;
  }
  return result;
}

function cleanSleep(value) {
  if (!isPlainObject(value)) return null;
  const videos = clampNumber(value.videos, 1, 100);
  const minutes = clampNumber(value.minutes, 1, 600);
  return {
    mode: 'off',
    endsAt: 0,
    videos: videos === null ? 3 : Math.round(videos),
    minutes: minutes === null ? 0 : Math.round(minutes),
    videosLeft: 0,
    fade: value.fade === true,
  };
}

function cleanPlugins(patch) {
  const result = {};
  if (!isPlainObject(patch)) return result;
  if (patch.autoUpdate !== undefined) result.autoUpdate = patch.autoUpdate === true;
  if (patch.allowUnsigned !== undefined) result.allowUnsigned = patch.allowUnsigned !== false;
  if (patch.requireSignatures !== undefined) {
    result.requireSignatures = patch.requireSignatures === true;
  }
  if (patch.updateIntervalHours !== undefined) {
    const interval = Number(patch.updateIntervalHours);
    if ([0, 1, 6, 24].includes(interval)) result.updateIntervalHours = interval;
  }

  const registry = require('./plugins/registry');
  if (typeof patch.registryUrl === 'string') {
    const url = patch.registryUrl.trim().slice(0, 500);
    if (url && registry.isAllowedRegistryUrl(url)) result.registryUrl = url;
  }
  if (Array.isArray(patch.registryUrls)) {
    const urls = [];
    for (const item of patch.registryUrls.slice(0, 3)) {
      const url = String(item || '')
        .trim()
        .slice(0, 500);
      if (!url || !registry.isAllowedRegistryUrl(url) || urls.includes(url)) continue;
      urls.push(url);
    }
    result.registryUrls = urls;
  }
  return result;
}

function cleanSettings(raw) {
  const result = {};
  if (!isPlainObject(raw)) return result;

  for (const key of SETTINGS_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];

    if (BOOLEAN_KEYS.has(key)) {
      result[key] = value === true;
      continue;
    }
    if (key === 'zoomFactor') {
      const zoom = clampNumber(value, 0.5, 3);
      if (zoom !== null) result.zoomFactor = zoom;
      continue;
    }
    if (key === 'uiScale') {
      if (Number.isFinite(Number(value))) result.uiScale = clampUiScale(value);
      continue;
    }
    if (key === 'uiFont') {
      result.uiFont = require('./ui-font').normalizeUiFont(value);
      continue;
    }
    if (key === 'uiCustom') {
      result.uiCustom = require('./ui-custom').normalizeUiCustom(value);
      continue;
    }
    if (key === 'language') {
      const language = APP_LANGUAGES.find((item) => item.id === value);
      if (language) result.language = language.id;
      continue;
    }
    if (key === 'siteLanguage') {
      if (value === 'auto') {
        result.siteLanguage = 'auto';
      } else {
        const language = SITE_LANGUAGES.find((item) => item.id === value);
        if (language) result.siteLanguage = language.id;
      }
      continue;
    }
    if (key === 'cosmetics') {
      result.cosmetics = cleanCosmetics(value);
      continue;
    }
    if (key === 'themeMode') {
      if (value === 'system' || value === 'dark' || value === 'light') result.themeMode = value;
      continue;
    }
    if (key === 'themePalette') {
      const { normalizePaletteId } = require('./md3-palettes');
      if (typeof value === 'string') result.themePalette = normalizePaletteId(value);
      continue;
    }
    if (key === 'themeCustom') {
      const { normalizeCustomTheme } = require('./md3-palettes');
      result.themeCustom = normalizeCustomTheme(value);
      continue;
    }
    if (key === 'themeRainbow') {
      const { normalizeRainbowConfig } = require('./md3-palettes');
      result.themeRainbow = normalizeRainbowConfig(value);
      continue;
    }
    if (key === 'region') {
      const region = cleanRegion(value);
      if (region) result.region = region;
      continue;
    }
    if (key === 'sleep') {
      const sleep = cleanSleep(value);
      if (sleep) result.sleep = sleep;
      continue;
    }

    const clean = clone(value);
    if (clean !== undefined) result[key] = clean;
  }

  return result;
}

/** Значения по умолчанию для настроек, которые ещё не попали в файл. */
function liveDefaults() {
  const cosmetic = {};
  for (const rule of ctx.cosmetics || []) cosmetic[rule.id] = rule.enabled;

  return {
    player: ctx.player,
    cosmetics: cosmetic,
    themeMode: ctx.themeMode,
    themeAmoled: Boolean(ctx.themeAmoled),
    themePalette: ctx.themePalette,
    themeCustom: ctx.themeCustom,
    themeRainbow: ctx.themeRainbow,
    // Логин и пароль прокси остаются в профиле, но не в экспорте.
    region: stripRegionCredentials(ctx.region),
    language: ctx.language,
    siteLanguage: ctx.siteLanguage,
    keymap: ctx.keymap
      ? { profile: ctx.keymap.profile, maps: ctx.keymap.maps }
      : { profile: ctx.keymapProfile || 'default', maps: {} },
    attention: { idlePause: ctx.idlePause, keepAwake: ctx.keepAwake },
    replies: ctx.replies,
    notifications: ctx.notifications,
    subtitles: ctx.subtitles,
    focus: {
      enabled: ctx.focus?.enabled === true,
      minutes: ctx.focus?.minutes,
      breakMinutes: ctx.focus?.breakMinutes,
    },
    feedKeys: ctx.feedKeys !== false,
    zoomFactor: 1,
    uiScale: ctx.uiScale || 1,
    uiFont: ctx.uiFont || { preset: 'google-sans-medium', family: '', fileName: '' },
    uiCustom: ctx.uiCustom || {},
    alwaysOnTop: false,
    closeToTray: ctx.closeToTray,
    startInTray: ctx.startInTray,
    chatWidth: ctx.chatWidth,
    chatDock: ctx.chatDock,
    pip: { auto: ctx.pipAuto, adaptive: ctx.pipAdaptive },
    sleep: { mode: 'off', endsAt: 0, videos: 3, minutes: 0, videosLeft: 0, fade: false },
    downloadNaming: ctx.downloadNaming,
    filters: {
      enabled: ctx.filters?.enabled === true,
      keywords: ctx.filters?.keywords || [],
      hashtags: ctx.filters?.hashtags || [],
      authors: ctx.filters?.authors || [],
    },
    gif: ctx.gif,
  };
}

function buildSettings() {
  const state = readState();
  const defaults = liveDefaults();
  const settings = {};
  for (const key of SETTINGS_KEYS) {
    if (state[key] !== undefined) settings[key] = state[key];
    else if (defaults[key] !== undefined) settings[key] = defaults[key];
  }
  if (settings.region && typeof settings.region === 'object') {
    settings.region = stripRegionCredentials(settings.region);
  }

  const saved = pluginsState.getSettings();
  return {
    app: 'TikTok Octo',
    kind: EXPORT_KIND,
    schema: SCHEMA,
    appVersion: app.getVersion(),
    exportedAt: new Date().toISOString(),
    settings,
    plugins: {
      autoUpdate: saved.autoUpdate,
      updateIntervalHours: saved.updateIntervalHours,
      allowUnsigned: saved.allowUnsigned,
      requireSignatures: saved.requireSignatures,
      registryUrl: saved.registryUrl,
      registryUrls: saved.registryUrls,
    },
  };
}

function stamp(date = new Date(), withSeconds = true) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return withSeconds ? `${day}-${time}${pad(date.getSeconds())}` : `${day}-${time}`;
}

async function exportSettings() {
  const content = `${JSON.stringify(buildSettings(), null, 2)}\n`;
  const file = `tiktok-octo-settings-${stamp()}.json`;

  try {
    if (process.env.OCTO_EXPORT_DIR) {
      fs.mkdirSync(process.env.OCTO_EXPORT_DIR, { recursive: true });
      const target = path.join(process.env.OCTO_EXPORT_DIR, file);
      fs.writeFileSync(target, content, 'utf8');
      toast(`Настройки экспортированы: ${file}`);
      return { ok: true, file: target };
    }

    const result = await showSaveDialog(ctx.win, {
      title: 'Экспорт настроек',
      defaultPath: path.join(app.getPath('downloads'), file),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(result.filePath, content, 'utf8');
    toast('Настройки экспортированы');
    return { ok: true, file: result.filePath };
  } catch (err) {
    toast(`Не удалось экспортировать настройки: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function readSmallFile(file, limit) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('Это не файл');
  if (stat.size > limit) throw new Error('Файл слишком большой');
  return fs.readFileSync(file, 'utf8');
}

function parseImport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл настроек повреждён: это не JSON' };
  }
  if (!isPlainObject(raw) || raw.kind !== EXPORT_KIND) {
    return { ok: false, error: 'Это не файл настроек TikTok Octo' };
  }
  if (raw.schema !== SCHEMA) {
    return { ok: false, error: 'Неподдерживаемая версия файла настроек' };
  }

  const settings = cleanSettings(raw.settings);
  if (!Object.keys(settings).length) {
    return { ok: false, error: 'В файле нет известных настроек' };
  }
  return { ok: true, settings, plugins: cleanPlugins(raw.plugins), version: raw.appVersion };
}

function applyPluginSettings(patch) {
  if (!isPlainObject(patch) || !Object.keys(patch).length) return { ok: true };
  try {
    // Ленивый require: плагины и так загружены в main, но порядок не важен.
    const plugins = require('./plugins');
    return plugins.setSettings(patch);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Перечитать настройки в живые модули, не требуя перезапуска. */
function refreshLive() {
  const state = readState();
  const proxyBefore = ctx.region?.proxy;
  const call = (module, method) => {
    try {
      const loaded = require(module);
      if (typeof loaded[method] === 'function') loaded[method]();
    } catch (err) {
      if (process.env.OCTO_DEBUG) console.warn(`[octo] refresh ${module}.${method}:`, err.message);
    }
  };

  if (state.uiScale !== undefined) require('./app-context').setUiScale(state.uiScale);
  if (state.uiFont !== undefined) {
    require('./app-context').ctx.uiFont = require('./ui-font').normalizeUiFont(state.uiFont);
  }
  if (state.uiCustom !== undefined) {
    const nextCustom = require('./ui-custom').normalizeUiCustom(state.uiCustom);
    require('./app-context').ctx.uiCustom = nextCustom;
    if (ctx.win && !ctx.win.isDestroyed()) {
      ctx.win.setTitle(nextCustom.brand?.label || 'TikTok Octo');
    }
  }
  call('./i18n', 'sync');
  call('./i18n', 'broadcast');
  call('./region', 'sync');
  call('./keymap', 'sync');
  call('./player', 'sync');
  call('./player', 'apply');
  call('./pip', 'sync');
  call('./sleep-timer', 'sync');
  call('./notifications', 'sync');
  call('./captions', 'sync');
  call('./chat', 'syncPrefs');
  call('./downloads', 'sync');
  call('./gif', 'sync');
  call('./filters', 'sync');
  call('./attention', 'sync');
  call('./replies', 'sync');
  call('./focus', 'sync');
  call('./ads', 'sync');

  setCosmeticsState(state.cosmetics || {});
  if ('themeAmoled' in state) {
    call('./cosmetics', 'applyThemeAmoled', state.themeAmoled === true);
  }
  if (state.themeCustom) {
    call('./cosmetics', 'applyThemeCustom', state.themeCustom, {
      activate: state.themePalette === 'custom',
    });
  }
  if (state.themeRainbow) {
    call('./cosmetics', 'applyThemeRainbow', state.themeRainbow);
  }
  if (state.themePalette) {
    call('./cosmetics', 'applyThemePalette', state.themePalette);
  }
  if (state.themeMode) {
    call('./cosmetics', 'applyThemeMode', state.themeMode, { reload: false });
  }
  call('./cosmetics', 'schedule');
  try {
    const ses = require('electron').session.fromPartition(
      require('./profiles').activePartition() || PARTITION,
    );
    require('./cosmetics').prepareTheme(ses);
    require('./region').applySiteLanguageCookie(ses);
  } catch {
    /* тема и язык сайта применятся при следующей загрузке страницы */
  }

  ctx.feedKeys = state.feedKeys !== false;
  call('./feed-keys', 'sync');
  setCloseToTray(state.closeToTray === true);
  ctx.startInTray = state.startInTray === true;

  const wc = ctx.view?.webContents;
  if (wc && !wc.isDestroyed()) {
    const zoom = clampNumber(state.zoomFactor, 0.5, 2);
    wc.setZoomFactor(zoom === null ? 1 : zoom);
  }
  if (ctx.win && !ctx.win.isDestroyed()) {
    ctx.win.setAlwaysOnTop(state.alwaysOnTop === true, state.alwaysOnTop ? 'floating' : 'normal');
  }

  // Импортированный прокси применяем к сессии, иначе панель показывала бы
  // новый адрес, а запросы шли через старый до перезапуска.
  if (proxyBefore !== ctx.region?.proxy) call('./region', 'applySavedProxy');

  onChange?.();
  pushState();
}

async function importSettings(payload = {}) {
  let file = '';
  if (process.env.OCTO_E2E && typeof payload.path === 'string') file = payload.path;

  if (!file) {
    const result = await showOpenDialog(ctx.win, {
      title: 'Импорт настроек',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
    file = result.filePaths[0];
  }

  let parsed;
  try {
    parsed = parseImport(readSmallFile(file, MAX_IMPORT_BYTES));
  } catch (err) {
    toast(`Не удалось прочитать настройки: ${err.message}`);
    return { ok: false, error: err.message };
  }
  if (!parsed.ok) {
    toast(parsed.error);
    return parsed;
  }

  if (process.env.OCTO_E2E !== '1') {
    const answer = await showMessageBox(ctx.win, {
      type: 'warning',
      title: 'Импорт настроек',
      message: 'Заменить текущие настройки?',
      detail:
        'Совпадающие настройки будут заменены значениями из файла. Cookies, переписка и пароли не импортируются.',
      buttons: ['Импортировать', 'Отмена'],
      defaultId: 0,
      cancelId: 1,
    });
    if (answer.response !== 0) return { ok: false, canceled: true };
  }

  createBackup('before-import', { silent: true });
  writeState(parsed.settings);
  applyPluginSettings(parsed.plugins);
  refreshLive();

  toast(`Настройки импортированы: ${Object.keys(parsed.settings).length} разделов`);
  return { ok: true, settings: parsed.settings, plugins: parsed.plugins };
}

function backupDir() {
  return process.env.OCTO_BACKUP_DIR || path.join(app.getPath('userData'), 'backups');
}

function backupName(date = new Date(), reason = 'manual') {
  return `backup-${stamp(date)}-${reason}.json`;
}

function listBackups() {
  let names = [];
  try {
    names = fs.readdirSync(backupDir()).filter((name) => /^backup-[\w-]+\.json$/.test(name));
  } catch {
    return [];
  }

  const result = [];
  for (const name of names) {
    try {
      const file = path.join(backupDir(), name);
      const stat = fs.statSync(file);
      result.push({
        name,
        file,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        modifiedAt: stat.mtimeMs,
      });
    } catch {
      /* файл исчез между чтением каталога и stat */
    }
  }
  return result.sort((left, right) => right.modifiedAt - left.modifiedAt);
}

function pruneBackups() {
  for (const item of listBackups().slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(item.file);
    } catch {
      /* файл уже удалён */
    }
  }
}

function updateSummary() {
  const items = listBackups();
  ctx.backups = {
    latest: items[0]?.createdAt || '',
    count: items.length,
  };
  pushState();
}

function hasState() {
  return fs.existsSync(statePath()) || fs.existsSync(pluginsState.statePath());
}

function createBackup(reason = 'manual', { silent = false } = {}) {
  try {
    if (!hasState()) {
      if (!silent) toast('Пока нечего сохранять: настройки ещё не записаны');
      return { ok: false, error: 'Нет состояния' };
    }

    const createdAt = new Date();
    const saved = pluginsState.read();
    const state = readState();
    const payload = {
      app: 'TikTok Octo',
      kind: BACKUP_KIND,
      schema: SCHEMA,
      appVersion: app.getVersion(),
      createdAt: createdAt.toISOString(),
      reason,
      // Копию могут переслать или приложить к отчёту об ошибке: пароль
      // прокси в неё не пишем, адрес остаётся.
      state: state.region ? { ...state, region: stripRegionCredentials(state.region) } : state,
      plugins: { settings: saved.settings, plugins: saved.plugins },
    };
    const content = `${JSON.stringify(payload, null, 2)}\n`;
    if (Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES) {
      if (!silent) toast('Состояние слишком большое для резервной копии');
      return { ok: false, error: 'Слишком большое состояние' };
    }

    fs.mkdirSync(backupDir(), { recursive: true });
    const name = backupName(createdAt, reason);
    const file = path.join(backupDir(), name);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
    pruneBackups();
    updateSummary();

    if (!silent) {
      toast(
        reason === 'before-import' ? 'Копия перед импортом создана' : 'Резервная копия создана',
      );
    }
    return { ok: true, file, name, createdAt: payload.createdAt };
  } catch (err) {
    if (!silent) toast(`Не удалось создать копию: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Ежедневная копия при запуске: одна на календарный день. */
function ensureDailyBackup() {
  if (!hasState()) return null;
  const newest = listBackups()[0];
  if (newest && sameDay(new Date(newest.modifiedAt), new Date())) return null;
  return createBackup('daily', { silent: true });
}

function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Копия повреждена: это не JSON' };
  }
  if (!isPlainObject(raw) || raw.kind !== BACKUP_KIND || raw.schema !== SCHEMA) {
    return { ok: false, error: 'Это не резервная копия TikTok Octo' };
  }
  if (!isPlainObject(raw.state) || !isPlainObject(raw.plugins)) {
    return { ok: false, error: 'Копия неполная' };
  }
  return { ok: true, backup: raw };
}

function restoreBackup(payload = {}) {
  const items = listBackups();
  let target = items[0] || null;

  if (process.env.OCTO_E2E && typeof payload.file === 'string' && payload.file) {
    const name = path.basename(payload.file);
    target = items.find((item) => item.name === name) || null;
  }
  if (!target) {
    toast('Резервных копий пока нет');
    return { ok: false, error: 'Нет копий' };
  }

  let parsed;
  try {
    parsed = parseBackup(readSmallFile(target.file, MAX_BACKUP_BYTES));
  } catch (err) {
    toast(`Не удалось прочитать копию: ${err.message}`);
    return { ok: false, error: err.message };
  }
  if (!parsed.ok) {
    toast(parsed.error);
    return parsed;
  }

  createBackup('before-restore', { silent: true });
  const backup = parsed.backup;
  try {
    replaceState(backup.state);
    pluginsState.write({
      settings: backup.plugins.settings || {},
      plugins: backup.plugins.plugins || {},
    });
  } catch (err) {
    toast(`Не удалось восстановить копию: ${err.message}`);
    return { ok: false, error: err.message };
  }

  if (payload.restart !== false) {
    toast('Копия восстановлена, перезапускаю приложение');
    try {
      require('./resilience').markCleanExit();
    } catch {
      /* устойчивость ещё не загружена */
    }
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);
    return { ok: true, name: target.name, restart: true };
  }

  refreshLive();
  toast('Копия восстановлена');
  return { ok: true, name: target.name };
}

async function openBackupFolder() {
  try {
    fs.mkdirSync(backupDir(), { recursive: true });
    const { shell } = require('electron');
    const error = await shell.openPath(backupDir());
    if (error) toast(`Не удалось открыть папку: ${error}`);
  } catch (err) {
    toast(`Не удалось открыть папку: ${err.message}`);
  }
}

function init(callbacks = {}) {
  onChange = typeof callbacks.onChange === 'function' ? callbacks.onChange : null;
  if (initialized) return;
  initialized = true;
  ensureDailyBackup();
  updateSummary();
}

module.exports = {
  init,
  exportSettings,
  importSettings,
  createBackup,
  restoreBackup,
  openBackupFolder,
  listBackups,
  ensureDailyBackup,
  buildSettings,
  cleanSettings,
  parseImport,
  backupDir,
  SETTINGS_KEYS,
};
