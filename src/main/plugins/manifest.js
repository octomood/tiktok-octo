'use strict';

const path = require('node:path');
const { API_VERSION, LIMITS } = require('./constants');
const { isKnownPermission } = require('./permissions');

/**
 * Манифест плагина.
 *
 * Валидация намеренно строгая: опечатка в разрешении не должна молча
 * превращаться в «плагин без прав», а путь к точке входа не должен выходить
 * за пределы папки плагина. Всё, что не прошло проверку, не устанавливается.
 */

const ID_RE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const SETTING_KEY_RE = /^[a-z][a-z0-9_]{0,47}$/;
const HOST_RE =
  /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const SAFE_FILE_RE = /^[A-Za-z0-9._/-]+$/;
const SAFE_URL_RE = /^https:\/\/[^\s]+$/i;
const ICON_RE = /\.(?:png|jpe?g|webp|svg)$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSemver(value) {
  return typeof value === 'string' && VERSION_RE.test(value);
}

function parseVersion(value) {
  const match = typeof value === 'string' ? value.match(VERSION_RE) : null;
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function comparePrerelease(left, right) {
  // Отсутствие prerelease означает более новую версию.
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;

    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) < Number(b) ? -1 : 1;
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

/** Сравнение semver: -1, 0 или 1. Невалидные версии считаются старыми. */
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function isCompatible(manifest, appVersion) {
  return compareVersions(appVersion, manifest.minAppVersion) >= 0;
}

/** Путь внутри пакета: только относительный, без «..», абсолютных путей и дисков. */
function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240) return false;
  if (!SAFE_FILE_RE.test(value)) return false;
  if (value.startsWith('/') || value.includes('\\') || value.includes('\0')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return true;
}

function normalizeString(value, { max, fallback = '' } = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return max ? trimmed.slice(0, max) : trimmed;
}

function normalizeUrl(value) {
  const text = normalizeString(value, { max: 500 });
  return SAFE_URL_RE.test(text) ? text : '';
}

function normalizeAuthor(value) {
  if (typeof value === 'string') {
    const name = normalizeString(value, { max: 80 });
    return name ? { name, url: '' } : null;
  }
  if (!isPlainObject(value)) return null;
  const name = normalizeString(value.name, { max: 80 });
  if (!name) return null;
  return { name, url: normalizeUrl(value.url) };
}

function normalizeSetting(raw, index, errors) {
  if (!isPlainObject(raw)) {
    errors.push(`settings[${index}]: ожидается объект`);
    return null;
  }

  const key = raw.key;
  if (typeof key !== 'string' || !SETTING_KEY_RE.test(key)) {
    errors.push(`settings[${index}].key: нужен ключ вида lower_snake_case`);
    return null;
  }

  const type = ['boolean', 'string', 'number', 'select'].includes(raw.type) ? raw.type : '';
  if (!type) {
    errors.push(`settings[${index}].type: boolean, string, number или select`);
    return null;
  }

  const title = normalizeString(raw.title, { max: 80 });
  if (!title) {
    errors.push(`settings[${index}].title: обязателен`);
    return null;
  }

  const description = normalizeString(raw.description, { max: 300 });
  const setting = { key, type, title, description };

  if (type === 'boolean') {
    setting.default = raw.default === true;
  } else if (type === 'string') {
    setting.default = typeof raw.default === 'string' ? raw.default.slice(0, 1000) : '';
    setting.maxLength = Math.min(1000, Math.max(1, Number(raw.maxLength) || 200));
  } else if (type === 'number') {
    const min = Number.isFinite(Number(raw.min)) ? Number(raw.min) : 0;
    const max = Number.isFinite(Number(raw.max)) ? Number(raw.max) : 100;
    setting.min = min;
    setting.max = Math.max(min, max);
    setting.step = Math.max(0.001, Number(raw.step) || 1);
    const fallback = Number.isFinite(Number(raw.default)) ? Number(raw.default) : min;
    setting.default = Math.min(setting.max, Math.max(setting.min, fallback));
  } else {
    const options = Array.isArray(raw.options) ? raw.options : [];
    setting.options = options
      .filter(
        (option) =>
          isPlainObject(option) &&
          typeof option.value === 'string' &&
          option.value.length > 0 &&
          option.value.length <= 80,
      )
      .slice(0, 30)
      .map((option) => ({
        value: option.value,
        label: normalizeString(option.label, { max: 80 }) || option.value,
      }));
    if (!setting.options.length) {
      errors.push(`settings[${index}].options: нужен хотя бы один вариант`);
      return null;
    }
    const fallback = setting.options[0].value;
    setting.default =
      typeof raw.default === 'string' && setting.options.some((item) => item.value === raw.default)
        ? raw.default
        : fallback;
  }

  return setting;
}

/**
 * Разбирает и нормализует plugin.json.
 * @returns {{ ok: boolean, manifest: object|null, errors: string[], warnings: string[] }}
 */
function validateManifest(raw) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(raw)) {
    return { ok: false, manifest: null, errors: ['plugin.json: ожидается JSON-объект'], warnings };
  }

  const id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : '';
  if (!ID_RE.test(id) || id.length > 64) {
    errors.push('id: нужен идентификатор вида app.author.plugin (латиница, цифры, точки и дефисы)');
  }

  const name = normalizeString(raw.name, { max: 80 });
  if (!name) errors.push('name: обязательное короткое название');

  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  if (!isSemver(version)) errors.push('version: нужна семантическая версия, например 1.2.0');

  const apiVersion = Number(raw.apiVersion);
  if (apiVersion !== API_VERSION) {
    errors.push(`apiVersion: поддерживается только ${API_VERSION}`);
  }

  const minAppVersion = typeof raw.minAppVersion === 'string' ? raw.minAppVersion.trim() : '0.0.0';
  if (!isSemver(minAppVersion)) errors.push('minAppVersion: нужна семантическая версия');

  const description = normalizeString(raw.description, { max: 600 });
  if (!description) errors.push('description: расскажите, что делает плагин');

  const author = normalizeAuthor(raw.author);
  if (!author) errors.push('author: имя автора обязательно');

  const license = normalizeString(raw.license, { max: 64 }) || 'UNLICENSED';

  const main = typeof raw.main === 'string' && raw.main.trim() ? raw.main.trim() : 'index.js';
  if (!main.endsWith('.js') || !isSafeRelativePath(main) || !main.includes('.')) {
    errors.push('main: относительный путь к .js внутри пакета');
  } else if (path.posix.normalize(main) !== main) {
    errors.push('main: путь должен быть нормализован (без ./ и ..)');
  }

  let icon = '';
  if (raw.icon !== undefined && raw.icon !== '') {
    if (typeof raw.icon !== 'string' || !isSafeRelativePath(raw.icon) || !ICON_RE.test(raw.icon)) {
      errors.push('icon: относительный путь к png, jpg, webp или svg');
    } else {
      icon = raw.icon;
    }
  }

  const screenshots = [];
  if (raw.screenshots !== undefined) {
    if (!Array.isArray(raw.screenshots)) {
      errors.push('screenshots: ожидается массив путей');
    } else if (raw.screenshots.length > 4) {
      errors.push('screenshots: не больше 4 изображений');
    } else {
      for (const shot of raw.screenshots) {
        if (typeof shot !== 'string' || !isSafeRelativePath(shot) || !ICON_RE.test(shot)) {
          errors.push('screenshots: только относительные png, jpg, webp или svg');
          continue;
        }
        if (!screenshots.includes(shot)) screenshots.push(shot);
      }
    }
  }

  const permissions = [];
  if (raw.permissions !== undefined) {
    if (!Array.isArray(raw.permissions)) {
      errors.push('permissions: ожидается массив');
    } else {
      for (const permission of raw.permissions) {
        if (typeof permission !== 'string' || !isKnownPermission(permission)) {
          errors.push(`permissions: неизвестное разрешение «${String(permission).slice(0, 40)}»`);
          continue;
        }
        if (!permissions.includes(permission)) permissions.push(permission);
      }
    }
  }
  if (permissions.length > 10) errors.push('permissions: не больше 10 разрешений');

  const networkHosts = [];
  if (raw.networkHosts !== undefined) {
    if (!Array.isArray(raw.networkHosts)) {
      errors.push('networkHosts: ожидается массив хостов');
    } else {
      for (const host of raw.networkHosts.slice(0, 30)) {
        const value = typeof host === 'string' ? host.trim().toLowerCase() : '';
        if (!HOST_RE.test(value) || value.length > 253) {
          errors.push(`networkHosts: некорректный хост «${String(host).slice(0, 60)}»`);
          continue;
        }
        if (!networkHosts.includes(value)) networkHosts.push(value);
      }
    }
  }
  if (permissions.includes('network') && networkHosts.length === 0) {
    errors.push('networkHosts: для разрешения network нужен хотя бы один хост');
  }
  if (!permissions.includes('network') && networkHosts.length) {
    warnings.push('networkHosts указаны, но разрешение network не запрошено');
  }

  // Косметический пак — только CSS: никаких скриптов, сети и навигации.
  const cosmetic = raw.cosmetic === true;
  if (raw.cosmetic !== undefined && typeof raw.cosmetic !== 'boolean') {
    errors.push('cosmetic: ожидается true или false');
  }
  if (cosmetic) {
    if (!permissions.includes('page:css')) {
      errors.push('cosmetic: косметическому паку нужно разрешение page:css');
    }
    const extra = permissions.filter((permission) => permission !== 'page:css');
    if (extra.length) {
      errors.push(`cosmetic: косметическому паку нельзя разрешения ${extra.join(', ')}`);
    }
  }

  const settings = [];
  if (raw.settings !== undefined) {
    if (!Array.isArray(raw.settings)) {
      errors.push('settings: ожидается массив');
    } else if (raw.settings.length > 20) {
      errors.push('settings: не больше 20 настроек');
    } else {
      const keys = new Set();
      raw.settings.forEach((item, index) => {
        const setting = normalizeSetting(item, index, errors);
        if (!setting) return;
        if (keys.has(setting.key)) {
          errors.push(`settings[${index}].key: ключ «${setting.key}» повторяется`);
          return;
        }
        keys.add(setting.key);
        settings.push(setting);
      });
    }
  }

  const homepage = normalizeUrl(raw.homepage);
  const source = normalizeUrl(raw.source);
  if (raw.homepage && !homepage) warnings.push('homepage: нужен https-адрес');
  if (raw.source && !source) warnings.push('source: нужен https-адрес');

  const changelog = normalizeString(raw.changelog, { max: 4000 });
  const categories = Array.isArray(raw.categories)
    ? raw.categories
        .filter((item) => typeof item === 'string' && /^[a-z0-9-]{1,24}$/.test(item))
        .slice(0, 5)
    : [];

  if (errors.length) {
    return { ok: false, manifest: null, errors, warnings };
  }

  return {
    ok: true,
    manifest: {
      id,
      name,
      version,
      apiVersion: API_VERSION,
      minAppVersion,
      description,
      author,
      license,
      homepage,
      source,
      main,
      icon,
      screenshots,
      permissions,
      networkHosts,
      cosmetic,
      settings,
      changelog,
      categories,
    },
    errors,
    warnings,
  };
}

/** Значения настроек по умолчанию + сохранённые значения правильного типа. */
function settingsDefaults(manifest) {
  const values = {};
  for (const setting of manifest.settings || []) {
    values[setting.key] = setting.default;
  }
  return values;
}

function normalizeSettingValue(setting, value) {
  if (!setting) return undefined;
  if (setting.type === 'boolean') return value === true;
  if (setting.type === 'string') {
    return typeof value === 'string' ? value.slice(0, setting.maxLength || 1000) : setting.default;
  }
  if (setting.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) return setting.default;
    return Math.min(setting.max, Math.max(setting.min, number));
  }
  if (setting.type === 'select') {
    return setting.options.some((option) => option.value === value) ? value : setting.default;
  }
  return undefined;
}

function applySettings(manifest, saved) {
  const values = settingsDefaults(manifest);
  if (!isPlainObject(saved)) return values;
  const byKey = new Map((manifest.settings || []).map((setting) => [setting.key, setting]));
  for (const [key, value] of Object.entries(saved)) {
    const setting = byKey.get(key);
    if (!setting) continue;
    values[key] = normalizeSettingValue(setting, value);
  }
  return values;
}

module.exports = {
  LIMITS,
  isSemver,
  parseVersion,
  compareVersions,
  isCompatible,
  isSafeRelativePath,
  validateManifest,
  settingsDefaults,
  applySettings,
  normalizeSettingValue,
  isPlainObject,
};
