'use strict';

const fs = require('node:fs');
const { session } = require('electron');
const state = require('./state');
const { compareVersions, isSemver } = require('./manifest');
const { normalizePermissions } = require('./permissions');
const { verifySignature } = require('./signature');
const { LIMITS } = require('./constants');

/**
 * Каталог плагинов.
 *
 * registry.json — обычный JSON в GitHub (или на своём сервере). Приложение
 * кеширует его, проверяет схему, хеши и (если есть) подписи. Сеть для
 * каталога не даёт доступа к сессии TikTok: отдельная сессия без cookies.
 */

const HOST_RE =
  /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const ID_RE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

let netSession = null;
let cache = null;

function getSession() {
  if (netSession) return netSession;
  netSession = session.fromPartition('octo-plugin-registry', { cache: false });
  netSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  return netSession;
}

function isAllowedRegistryUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return true;
    // Локальный реестр удобен для разработки и тестов.
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

function isAllowedDownloadUrl(raw) {
  return isAllowedRegistryUrl(raw);
}

function normalizeAuthor(raw) {
  if (typeof raw === 'string') return { name: raw.slice(0, 80), url: '' };
  if (!raw || typeof raw !== 'object') return { name: 'неизвестен', url: '' };
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'неизвестен',
    url: typeof raw.url === 'string' && /^https:\/\//.test(raw.url) ? raw.url : '',
  };
}

function normalizeHosts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((host) => typeof host === 'string' && HOST_RE.test(host.toLowerCase()))
    .map((host) => host.toLowerCase())
    .slice(0, 30);
}

function normalizeRelease(raw, pluginId) {
  if (!raw || typeof raw !== 'object') return null;
  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  if (!isSemver(version)) return null;

  const download = typeof raw.download === 'string' ? raw.download.trim() : '';
  if (!isAllowedDownloadUrl(download)) return null;

  const sha256 = typeof raw.sha256 === 'string' ? raw.sha256.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;

  const signature = typeof raw.signature === 'string' ? raw.signature.trim().slice(0, 200) : '';
  const permissions = normalizePermissions(raw.permissions);
  const networkHosts = normalizeHosts(raw.networkHosts);
  if (permissions.includes('network') && networkHosts.length === 0) return null;

  return {
    pluginId,
    version,
    minAppVersion:
      typeof raw.minAppVersion === 'string' && isSemver(raw.minAppVersion)
        ? raw.minAppVersion
        : '0.0.0',
    download,
    sha256,
    signature,
    size: Math.max(0, Number(raw.size) || 0),
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt.slice(0, 40) : '',
    changelog: typeof raw.changelog === 'string' ? raw.changelog.slice(0, 4000) : '',
    permissions,
    networkHosts,
  };
}

function normalizePlugin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : '';
  if (!ID_RE.test(id) || id.length > 64) return null;

  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  if (!name) return null;

  const releases = Array.isArray(raw.releases)
    ? raw.releases
        .map((release) => normalizeRelease(release, id))
        .filter(Boolean)
        .sort((left, right) => compareVersions(right.version, left.version))
    : [];
  if (!releases.length) return null;

  const latest = releases[0];
  return {
    id,
    name,
    author: normalizeAuthor(raw.author),
    description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 600) : '',
    homepage:
      typeof raw.homepage === 'string' && /^https:\/\//.test(raw.homepage) ? raw.homepage : '',
    source: typeof raw.source === 'string' && /^https:\/\//.test(raw.source) ? raw.source : '',
    license: typeof raw.license === 'string' ? raw.license.slice(0, 64) : 'UNLICENSED',
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter((item) => typeof item === 'string').slice(0, 5)
      : [],
    icon: typeof raw.icon === 'string' && /^https:\/\//.test(raw.icon) ? raw.icon : '',
    screenshots: Array.isArray(raw.screenshots)
      ? raw.screenshots
          .filter((url) => typeof url === 'string' && /^https:\/\//.test(url))
          .slice(0, 4)
      : [],
    releases,
    latest,
    verified: latest.signature ? verifySignature(latest) === 'verified' : false,
  };
}

function normalizeRegistry(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.plugins)) {
    throw new Error('Каталог: ожидается объект с массивом plugins');
  }
  if (raw.schema !== 1) throw new Error('Каталог: неподдерживаемая версия схемы');

  const plugins = [];
  const seen = new Set();
  for (const item of raw.plugins) {
    const plugin = normalizePlugin(item);
    if (!plugin || seen.has(plugin.id)) continue;
    seen.add(plugin.id);
    plugins.push(plugin);
  }

  return {
    schema: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : '',
    plugins: plugins.sort((left, right) => left.name.localeCompare(right.name, 'ru')),
  };
}

async function readRegistryText(settings) {
  if (process.env.OCTO_PLUGIN_REGISTRY_FILE) {
    return fs.readFileSync(process.env.OCTO_PLUGIN_REGISTRY_FILE, 'utf8');
  }

  const url = settings.registryUrl;
  if (!isAllowedRegistryUrl(url)) throw new Error('Некорректный адрес каталога');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await getSession().fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const error = new Error(`Каталог ответил ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const length = Number(response.headers.get('content-length')) || 0;
    if (length > LIMITS.registryBytes) throw new Error('Каталог слишком большой');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > LIMITS.registryBytes) {
      throw new Error('Каталог слишком большой');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function loadCache() {
  if (cache) return cache;
  const saved = state.readRegistryCache();
  if (saved) {
    try {
      cache = {
        status: 'stale',
        updatedAt: saved.updatedAt || '',
        fetchedAt: saved.fetchedAt || 0,
        error: '',
        plugins: normalizeRegistry(saved).plugins,
      };
    } catch {
      cache = null;
    }
  }
  return cache;
}

function getCache() {
  return cache || loadCache();
}

/**
 * Загружает каталог. При ошибке возвращает кеш, если он есть.
 * @returns {Promise<{ ok: boolean, status: string, updatedAt: string, fetchedAt: number, error: string, plugins: object[] }>}
 */
async function load({ force = false, settings } = {}) {
  if (!force && cache && Date.now() - cache.fetchedAt < 5 * 60 * 1000) {
    return { ...cache, ok: cache.status !== 'error' };
  }

  try {
    const text = await readRegistryText(settings || state.getSettings());
    const parsed = normalizeRegistry(JSON.parse(text));
    const fetchedAt = Date.now();
    cache = {
      status: 'ready',
      updatedAt: parsed.updatedAt,
      fetchedAt,
      error: '',
      plugins: parsed.plugins,
    };
    state.writeRegistryCache({
      schema: 1,
      updatedAt: parsed.updatedAt,
      fetchedAt,
      plugins: parsed.plugins.map((plugin) => ({
        ...plugin,
        latest: undefined,
        releases: plugin.releases,
      })),
    });
    return { ...cache, ok: true };
  } catch (err) {
    const fallback = getCache();
    if (fallback) {
      cache = {
        ...fallback,
        status: 'stale',
        // 404 означает «каталог ещё не опубликован», а не ошибку сети.
        error: err.status === 404 ? '' : err.message,
      };
      return { ...cache, ok: true };
    }
    const empty = err.status === 404;
    cache = {
      status: empty ? 'empty' : 'error',
      updatedAt: '',
      fetchedAt: Date.now(),
      error: empty ? '' : err.message,
      plugins: [],
    };
    return { ...cache, ok: empty };
  }
}

function find(id) {
  const current = getCache();
  return current?.plugins.find((plugin) => plugin.id === id) || null;
}

function latestRelease(plugin) {
  return plugin?.latest || null;
}

function releaseSignature(release) {
  return verifySignature({
    id: release.pluginId,
    version: release.version,
    sha256: release.sha256,
    signature: release.signature,
  });
}

function reset() {
  cache = null;
}

module.exports = {
  isAllowedRegistryUrl,
  isAllowedDownloadUrl,
  normalizeRegistry,
  load,
  getCache,
  find,
  latestRelease,
  releaseSignature,
  reset,
};
