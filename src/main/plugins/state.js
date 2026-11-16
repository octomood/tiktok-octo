'use strict';

const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_REGISTRY_URL, LIMITS } = require('./constants');

/**
 * Состояние плагинов.
 *
 * Отдельный файл, а не octo-state.json: установленные плагины, их отчёты
 * безопасности и настройки не должны теряться при сбросе настроек окна.
 */

const SCHEMA = 1;
const STATE_FILE = 'plugins-state.json';
const REGISTRY_CACHE_FILE = 'plugins-registry.json';
const PLUGINS_DIR = 'plugins';

const DEFAULT_SETTINGS = {
  autoUpdate: true,
  updateIntervalHours: 6,
  allowUnsigned: true,
  requireSignatures: false,
  registryUrl: DEFAULT_REGISTRY_URL,
};

function baseDir() {
  return app.getPath('userData');
}

function statePath() {
  return path.join(baseDir(), STATE_FILE);
}

function registryCachePath() {
  return path.join(baseDir(), REGISTRY_CACHE_FILE);
}

function pluginsDir() {
  return path.join(baseDir(), PLUGINS_DIR);
}

function pluginDir(id) {
  return path.join(pluginsDir(), id);
}

function versionsDir(id) {
  return path.join(pluginsDir(), '.versions', id);
}

function ensureDirs() {
  fs.mkdirSync(pluginsDir(), { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] plugins state write failed:', err.message);
  }
}

function read() {
  const raw = readJson(statePath(), {});
  const plugins = raw && typeof raw.plugins === 'object' && raw.plugins ? raw.plugins : {};
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw && typeof raw.settings === 'object' && raw.settings ? raw.settings : {}),
  };

  settings.autoUpdate = settings.autoUpdate === true;
  settings.allowUnsigned = settings.allowUnsigned !== false;
  settings.requireSignatures = settings.requireSignatures === true;
  const interval = Number(settings.updateIntervalHours);
  settings.updateIntervalHours = [0, 1, 6, 24].includes(interval)
    ? interval
    : DEFAULT_SETTINGS.updateIntervalHours;
  settings.registryUrl =
    typeof settings.registryUrl === 'string' && settings.registryUrl.trim()
      ? settings.registryUrl.trim()
      : DEFAULT_SETTINGS.registryUrl;

  return { schema: SCHEMA, settings, plugins };
}

function write(state) {
  writeJson(statePath(), { schema: SCHEMA, ...state });
}

function getSettings() {
  return read().settings;
}

function saveSettings(patch) {
  const state = read();
  state.settings = { ...state.settings, ...patch };
  write(state);
  return state.settings;
}

function list() {
  return Object.values(read().plugins);
}

function get(id) {
  return read().plugins[id] || null;
}

function set(record) {
  if (!record || typeof record.id !== 'string') return;
  const state = read();
  state.plugins[record.id] = record;
  write(state);
}

function remove(id) {
  const state = read();
  if (!state.plugins[id]) return false;
  delete state.plugins[id];
  write(state);
  return true;
}

function readRegistryCache() {
  const raw = readJson(registryCachePath(), null);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.plugins)) return null;
  return raw;
}

function writeRegistryCache(value) {
  writeJson(registryCachePath(), value);
}

/** Удаляет папку плагина без выхода за пределы plugins/. */
function removePluginDir(id) {
  const target = pluginDir(id);
  const root = pluginsDir();
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  try {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(versionsDir(id), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function stats() {
  const state = read();
  return {
    installed: Object.keys(state.plugins).length,
    limit: LIMITS.maxPlugins,
  };
}

module.exports = {
  SCHEMA,
  DEFAULT_SETTINGS,
  statePath,
  registryCachePath,
  pluginsDir,
  pluginDir,
  versionsDir,
  ensureDirs,
  read,
  write,
  getSettings,
  saveSettings,
  list,
  get,
  set,
  remove,
  readRegistryCache,
  writeRegistryCache,
  removePluginDir,
  stats,
};
