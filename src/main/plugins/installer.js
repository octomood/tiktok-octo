'use strict';

const { session, nativeImage } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readZip } = require('./zip');
const {
  validateManifest,
  applySettings,
  settingsDefaults,
  isSafeRelativePath,
} = require('./manifest');
const { scanFiles, installDecision } = require('./security');
const {
  verifySignature,
  verifyEmbeddedSignature,
  SIGNATURE_FILES,
  sha256,
} = require('./signature');
const { LIMITS } = require('./constants');
const state = require('./state');
const {
  signerFingerprint,
  publisherOf,
  recordPublisher,
  compareUpdate,
} = require('./update-trust');

/**
 * Установка, проверка и удаление плагинов.
 *
 * Пакет сначала распаковывается в память, проверяется по манифесту, хешу,
 * подписи и статическому аудиту — и только потом попадает на диск. Запись
 * идёт во временную папку с атомарной заменой, чтобы прерванная установка
 * не оставила полурабочий плагин.
 */

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let downloadSession = null;

function getDownloadSession() {
  if (downloadSession) return downloadSession;
  downloadSession = session.fromPartition('octo-plugin-download', { cache: false });
  downloadSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  return downloadSession;
}

function dataUriFor(name, buffer) {
  const ext = path.posix.extname(name).toLowerCase();
  const mime = MIME[ext];
  if (!mime || buffer.length > LIMITS.iconBytes) return '';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function screenshotUriFor(buffer) {
  if (!buffer || buffer.length > LIMITS.iconBytes) return '';
  try {
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return '';
    const size = image.getSize();
    const scale = Math.min(1, 640 / Math.max(1, size.width), 360 / Math.max(1, size.height));
    const resized =
      scale < 1
        ? image.resize({
            width: Math.max(1, Math.round(size.width * scale)),
            height: Math.max(1, Math.round(size.height * scale)),
          })
        : image;
    return `data:image/jpeg;base64,${resized.toJPEG(82).toString('base64')}`;
  } catch {
    return '';
  }
}

function findManifest(files) {
  const entry = files.get('plugin.json');
  if (!entry) throw new Error('В пакете нет plugin.json');
  if (entry.length > LIMITS.manifestBytes) throw new Error('plugin.json слишком большой');
  let raw;
  try {
    raw = JSON.parse(entry.toString('utf8'));
  } catch {
    throw new Error('plugin.json — некорректный JSON');
  }
  return raw;
}

function sameList(left, right) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Разбирает пакет без записи на диск.
 * @param {Buffer} buffer
 * @param {{registryEntry?: object|null, expectedId?: string}} options
 */
function inspectPackage(buffer, { registryEntry = null, expectedId = '', publicKeys } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'Пустой файл плагина' };
  }
  if (buffer.length > LIMITS.packageBytes) {
    return { ok: false, error: `Пакет больше ${Math.round(LIMITS.packageBytes / 1024 / 1024)} МБ` };
  }

  let files;
  try {
    files = readZip(buffer, {
      entries: LIMITS.files,
      entryBytes: LIMITS.fileBytes,
      totalBytes: LIMITS.totalBytes,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }

  let raw;
  try {
    raw = findManifest(files);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const validation = validateManifest(raw);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join('\n'), errors: validation.errors };
  }
  const manifest = validation.manifest;

  if (expectedId && manifest.id !== expectedId) {
    return { ok: false, error: 'Идентификатор в манифесте не совпадает с каталогом' };
  }

  if (!files.has(manifest.main)) {
    return { ok: false, error: `В пакете нет точки входа «${manifest.main}»` };
  }
  if (files.get(manifest.main).length > LIMITS.entryBytes) {
    return {
      ok: false,
      error: `Точка входа больше ${Math.round(LIMITS.entryBytes / 1024 / 1024)} МБ`,
    };
  }
  if (manifest.icon && !files.has(manifest.icon)) {
    return { ok: false, error: `В пакете нет иконки «${manifest.icon}»` };
  }
  for (const shot of manifest.screenshots || []) {
    if (!files.has(shot)) return { ok: false, error: `В пакете нет скриншота «${shot}»` };
  }

  const report = scanFiles(files, manifest);
  const hash = sha256(buffer);
  const embedded = verifyEmbeddedSignature(
    files,
    { id: manifest.id, version: manifest.version },
    publicKeys,
  );
  let signature = embedded.status;
  let signatureError = embedded.error || '';
  const signatureNote = embedded.note || '';

  if (registryEntry) {
    if (manifest.id !== registryEntry.pluginId || manifest.version !== registryEntry.version) {
      return {
        ok: false,
        error: 'Содержимое пакета не совпадает с версией в каталоге',
      };
    }
    if (registryEntry.sha256 !== hash) {
      return { ok: false, error: 'SHA-256 пакета не совпадает с каталогом' };
    }
    if (registryEntry.size && registryEntry.size !== buffer.length) {
      return { ok: false, error: 'Размер пакета не совпадает с каталогом' };
    }
    if (!sameList(manifest.permissions, registryEntry.permissions)) {
      return {
        ok: false,
        error: 'Список разрешений в манифесте не совпадает с каталогом',
      };
    }
    if (!sameList(manifest.networkHosts, registryEntry.networkHosts)) {
      return { ok: false, error: 'Список networkHosts не совпадает с каталогом' };
    }

    const regSignature = verifySignature(
      {
        id: manifest.id,
        version: manifest.version,
        sha256: hash,
        signature: registryEntry.signature,
      },
      publicKeys,
    );
    if (regSignature === 'invalid' || signature === 'invalid') {
      signature = 'invalid';
      signatureError = signatureError || 'Подпись пакета недействительна';
    } else if (regSignature === 'verified' || signature === 'verified') {
      signature = 'verified';
    }
  }

  const signer = signerFingerprint(
    {
      files,
      manifest,
      sha256: hash,
      signature,
      registrySignature: registryEntry?.signature || '',
    },
    publicKeys,
  );

  return {
    ok: true,
    buffer,
    files,
    manifest,
    rawManifest: raw,
    report,
    sha256: hash,
    signature,
    signatureError,
    signatureNote,
    signer,
    icon: manifest.icon ? dataUriFor(manifest.icon, files.get(manifest.icon)) : '',
    screenshots: (manifest.screenshots || [])
      .map((shot) => screenshotUriFor(files.get(shot)))
      .filter(Boolean),
    size: buffer.length,
    warnings: validation.warnings,
  };
}

function readDirectoryFiles(
  root,
  { prefix = '', depth = 0, files = new Map(), bytes = { total: 0 } } = {},
) {
  if (depth > 6) throw new Error('Слишком глубокая вложенность папок');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name.endsWith('.octoplugin') || entry.name.endsWith('.zip')) continue;
    if (SIGNATURE_FILES.includes(entry.name) && !prefix) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Символические ссылки в плагине запрещены');
    if (entry.isDirectory()) {
      readDirectoryFiles(absolute, { prefix: relative, depth: depth + 1, files, bytes });
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isSafeRelativePath(relative)) throw new Error(`Недопустимый путь: ${relative}`);
    if (files.size >= LIMITS.files) throw new Error('Слишком много файлов');
    const data = fs.readFileSync(absolute);
    if (data.length > LIMITS.fileBytes) throw new Error(`Файл «${relative}» слишком большой`);
    bytes.total += data.length;
    if (bytes.total > LIMITS.totalBytes) throw new Error('Плагин слишком большой');
    files.set(relative, data);
  }
  return files;
}

/**
 * Разбор распакованной папки для режима разработки (OCTO_PLUGIN_DEV_DIR).
 * Подписи и хеша пакета здесь нет: это локальный код, но манифест и
 * статический аудит проверяются так же строго.
 */
function inspectDirectory(dir) {
  let files;
  try {
    files = readDirectoryFiles(dir);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
  } catch {
    return { ok: false, error: 'В папке нет корректного plugin.json' };
  }

  const validation = validateManifest(raw);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join('\n'), errors: validation.errors };
  }
  const manifest = validation.manifest;
  if (!files.has(manifest.main)) {
    return { ok: false, error: `В папке нет точки входа «${manifest.main}»` };
  }
  if (files.get(manifest.main).length > LIMITS.entryBytes) {
    return { ok: false, error: 'Точка входа больше 2 МБ' };
  }

  const report = scanFiles(files, manifest);
  return {
    ok: true,
    files,
    manifest,
    rawManifest: raw,
    report,
    sha256: 'dev',
    signature: 'unsigned',
    signatureError: '',
    icon: manifest.icon ? dataUriFor(manifest.icon, files.get(manifest.icon)) : '',
    screenshots: (manifest.screenshots || [])
      .map((shot) => screenshotUriFor(files.get(shot)))
      .filter(Boolean),
    size: [...files.values()].reduce((sum, data) => sum + data.length, 0),
    warnings: validation.warnings,
    dev: true,
  };
}

const TEXT_PREVIEW_EXTS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
  '.txt',
  '.svg',
]);
const MAX_PREVIEW_FILES = 24;
const MAX_PREVIEW_FILE_BYTES = 64 * 1024;
const MAX_PREVIEW_TOTAL_BYTES = 256 * 1024;

function extractSourcePreview(files, manifest) {
  if (!(files instanceof Map)) return [];
  const candidates = [];
  for (const [name, buf] of files.entries()) {
    if (!Buffer.isBuffer(buf)) continue;
    const ext = path.extname(name).toLowerCase();
    if (!TEXT_PREVIEW_EXTS.has(ext) && name !== manifest?.main) continue;
    // Пропускаем бинарные файлы с нулевым байтом.
    if (buf.subarray(0, 1024).includes(0)) continue;
    candidates.push([name, buf]);
  }
  candidates.sort(([a], [b]) => {
    if (a === manifest?.main) return -1;
    if (b === manifest?.main) return 1;
    if (a === 'plugin.json') return -1;
    if (b === 'plugin.json') return 1;
    return a.localeCompare(b);
  });

  const out = [];
  let total = 0;
  for (const [name, buf] of candidates.slice(0, MAX_PREVIEW_FILES)) {
    const remaining = MAX_PREVIEW_TOTAL_BYTES - total;
    if (remaining <= 0) break;
    const limit = Math.min(MAX_PREVIEW_FILE_BYTES, remaining);
    const truncated = buf.length > limit;
    const slice = truncated ? buf.subarray(0, limit) : buf;
    total += slice.length;
    out.push({
      path: name,
      size: buf.length,
      truncated,
      content: slice.toString('utf8'),
    });
  }
  return out;
}

/** Данные для диалога подтверждения. */
function preview(inspection, { source = 'file', entry = null } = {}) {
  if (!inspection?.ok) return null;
  return {
    id: inspection.manifest.id,
    name: inspection.manifest.name,
    version: inspection.manifest.version,
    author: inspection.manifest.author,
    description: inspection.manifest.description,
    license: inspection.manifest.license,
    homepage: inspection.manifest.homepage,
    source,
    signature: inspection.signature,
    signatureNote: inspection.signatureNote || '',
    registryVersion: entry?.version || '',
    permissions: inspection.report.permissions,
    baseline: inspection.report.baseline,
    networkHosts: inspection.manifest.networkHosts || [],
    report: inspection.report,
    icon: inspection.icon || '',
    size: inspection.size,
    sourceFiles: extractSourcePreview(inspection.files, inspection.manifest),
  };
}

function hashFiles(files) {
  const hashes = {};
  for (const [name, data] of files) hashes[name] = sha256(data);
  return hashes;
}

function writeFiles(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, data] of files) {
    const target = path.join(dir, ...name.split('/'));
    const relative = path.relative(dir, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Недопустимый путь файла: ${name}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data, { mode: 0o644 });
  }
}

function signatureLabel(value) {
  if (value === 'verified') return 'подпись проверена';
  if (value === 'invalid') return 'подпись недействительна';
  return 'без подписи';
}

function newDataId() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * @param {{keepData?: boolean}} options keepData: false — издатель сменился,
 *   хранилище, секреты и настройки старой версии новой не передаются.
 */
function installRecord(inspection, { source, registryUrl = '', previous = null, keepData = true }) {
  const manifest = inspection.manifest;
  const now = new Date().toISOString();
  const inherit = previous && keepData !== false ? previous : null;
  const previousSettings = inherit?.settings || {};
  const values = applySettings(manifest, previousSettings);

  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    author: manifest.author,
    description: manifest.description,
    license: manifest.license,
    homepage: manifest.homepage,
    sourceCode: manifest.source,
    enabled: previous ? previous.enabled === true : true,
    autoUpdate: previous ? previous.autoUpdate !== false : true,
    source,
    registryUrl,
    installedAt: previous?.installedAt || now,
    updatedAt: now,
    sha256: inspection.sha256,
    signature: inspection.signature,
    scan: inspection.report,
    permissions: manifest.permissions,
    networkHosts: manifest.networkHosts,
    publisher: publisherOf(inspection),
    // Метка «чьи это данные»: меняется, когда данные начинаются с нуля, чтобы
    // откат на версию другого издателя вернул её собственные данные.
    dataId: inherit ? inherit.dataId || '' : previous ? newDataId() : '',
    settings: values,
    storage: inherit?.storage && typeof inherit.storage === 'object' ? { ...inherit.storage } : {},
    secrets: inherit?.secrets && typeof inherit.secrets === 'object' ? { ...inherit.secrets } : {},
    files: hashFiles(inspection.files),
    manifest,
    icon: inspection.icon,
    screenshots: inspection.screenshots || [],
    lastError: null,
    tampered: false,
    dev: false,
    pendingUpdate: null,
  };
}

function historyEntry(record) {
  return {
    version: record.version,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
    sha256: record.sha256,
    signature: record.signature,
    manifest: record.manifest,
    permissions: record.permissions,
    networkHosts: record.networkHosts,
    files: record.files,
    scan: record.scan,
    source: record.source,
    registryUrl: record.registryUrl,
    icon: record.icon,
    screenshots: record.screenshots,
    settings: record.settings,
    storage: record.storage,
    secrets: record.secrets,
    publisher: record.publisher,
    dataId: record.dataId || '',
  };
}

function backupVersion(record, target) {
  if (!record?.version || !fs.existsSync(target)) return null;
  const dir = path.join(state.versionsDir(record.id), record.version);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(target, dir, { recursive: true });
  return historyEntry(record);
}

function trimHistory(id, history) {
  while (history.length > 3) {
    const removed = history.pop();
    if (removed?.version) {
      fs.rmSync(path.join(state.versionsDir(id), removed.version), {
        recursive: true,
        force: true,
      });
    }
  }
}

function verifyFilesIn(dir, files) {
  for (const [name, expected] of Object.entries(files || {})) {
    try {
      const data = fs.readFileSync(path.join(dir, ...name.split('/')));
      if (sha256(data) !== expected) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Записывает проверенный плагин в userData.
 * @returns {{ ok: boolean, error?: string, record?: object }}
 */
function install(inspection, options = {}) {
  if (!inspection?.ok) return { ok: false, error: inspection?.error || 'Пакет не проверен' };

  const existing = state.get(inspection.manifest.id);
  if (!existing && state.stats().installed >= LIMITS.maxPlugins) {
    return { ok: false, error: `Установлено уже ${LIMITS.maxPlugins} плагинов` };
  }

  const id = inspection.manifest.id;
  const root = state.pluginsDir();
  const target = state.pluginDir(id);
  const stamp = `${Date.now()}-${process.pid}`;
  const temp = path.join(root, `.tmp-${id}-${stamp}`);
  const backup = path.join(root, `.old-${id}-${stamp}`);
  const history = Array.isArray(existing?.history) ? [...existing.history] : [];
  let currentEntry = null;

  try {
    state.ensureDirs();
    writeFiles(temp, inspection.files);

    if (existing && fs.existsSync(target)) {
      try {
        currentEntry = backupVersion(existing, target);
      } catch {
        currentEntry = null;
      }
      if (currentEntry) {
        history.unshift(currentEntry);
        trimHistory(id, history);
      }
    }

    if (fs.existsSync(target)) fs.renameSync(target, backup);
    try {
      fs.renameSync(temp, target);
    } catch (err) {
      if (fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
      throw err;
    }
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });

    // Издатель сравнивается здесь, а не только в диалоге: так данные не
    // утекут к чужому пакету ни по какому пути установки.
    const trust = compareUpdate(existing, inspection);
    const keepData = options.keepData === false ? false : trust ? trust.keepData : true;
    const record = installRecord(inspection, { ...options, previous: existing, keepData });
    record.history = history;
    state.set(record);

    return { ok: true, record, trust, dataKept: Boolean(existing) && keepData };
  } catch (err) {
    try {
      fs.rmSync(temp, { recursive: true, force: true });
      if (fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
    } catch {
      /* уборка не должна скрывать исходную ошибку */
    }
    return { ok: false, error: `Не удалось записать плагин: ${err.message}` };
  }
}

function rollback(id, version) {
  const record = state.get(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  if (record.dev) return { ok: false, error: 'Для dev-плагина откат не нужен' };
  if (record.version === version) return { ok: false, error: 'Эта версия уже установлена' };

  const history = Array.isArray(record.history) ? record.history : [];
  const entry = history.find((item) => item.version === version);
  if (!entry) return { ok: false, error: 'Такая версия не найдена в истории' };

  const target = state.pluginDir(id);
  const backupDir = path.join(state.versionsDir(id), version);
  if (!fs.existsSync(backupDir)) {
    return { ok: false, error: 'Резервная копия версии не найдена' };
  }
  if (!verifyFilesIn(backupDir, entry.files)) {
    return { ok: false, error: 'Резервная копия повреждена' };
  }

  let currentEntry = null;
  const tempOld = path.join(state.pluginsDir(), `.rollback-${id}-${Date.now()}`);
  try {
    state.ensureDirs();
    currentEntry = backupVersion(record, target);
    if (fs.existsSync(target)) fs.renameSync(target, tempOld);
    try {
      fs.cpSync(backupDir, target, { recursive: true });
    } catch (err) {
      if (fs.existsSync(tempOld) && !fs.existsSync(target)) fs.renameSync(tempOld, target);
      throw err;
    }
    if (fs.existsSync(tempOld)) fs.rmSync(tempOld, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });

    const restored = {
      ...record,
      version: entry.version,
      installedAt: entry.installedAt || record.installedAt,
      updatedAt: new Date().toISOString(),
      sha256: entry.sha256,
      signature: entry.signature,
      manifest: entry.manifest,
      permissions: entry.permissions,
      networkHosts: entry.networkHosts,
      files: entry.files,
      scan: entry.scan,
      source: entry.source,
      registryUrl: entry.registryUrl,
      icon: entry.icon || record.icon,
      screenshots: entry.screenshots || record.screenshots,
      pendingUpdate: null,
      lastError: '',
      crashCount: 0,
      lastCrashAt: 0,
    };
    restored.settings = applySettings(entry.manifest || { settings: [] }, record.settings);
    // Версия другого издателя жила со своими данными: возвращаем их, а данные
    // текущей версии остаются в её записи истории.
    if ((entry.dataId || '') !== (record.dataId || '')) {
      restored.dataId = entry.dataId || '';
      restored.settings = applySettings(entry.manifest || { settings: [] }, entry.settings || {});
      restored.storage =
        entry.storage && typeof entry.storage === 'object' ? { ...entry.storage } : {};
      restored.secrets =
        entry.secrets && typeof entry.secrets === 'object' ? { ...entry.secrets } : {};
    }
    restored.publisher = recordPublisher(entry);
    restored.history = [
      ...(currentEntry ? [currentEntry] : []),
      ...history.filter((item) => item.version !== version),
    ];
    trimHistory(id, restored.history);
    state.set(restored);
    return { ok: true, record: restored };
  } catch (err) {
    if (fs.existsSync(tempOld) && !fs.existsSync(target)) {
      try {
        fs.renameSync(tempOld, target);
      } catch {
        /* восстановление уже не критично */
      }
    }
    return { ok: false, error: `Не удалось откатить версию: ${err.message}` };
  }
}

function remove(id) {
  state.remove(id);
  state.removePluginDir(id);
}

/**
 * Проверяет, что файлы установленного плагина не изменились. Плагин не имеет
 * доступа к файловой системе, поэтому любое расхождение — это ручная правка
 * или повреждение; такой плагин не запускаем.
 */
function verifyInstalled(record) {
  if (!record) return { ok: false, reason: 'missing', error: 'Плагин не найден' };
  if (record.dev) return { ok: true };

  const dir = state.pluginDir(record.id);
  if (!fs.existsSync(dir)) {
    return { ok: false, reason: 'missing-dir', error: 'Папка плагина удалена' };
  }

  const files = record.files && typeof record.files === 'object' ? record.files : {};
  for (const [name, expected] of Object.entries(files)) {
    const target = path.join(dir, ...name.split('/'));
    try {
      const data = fs.readFileSync(target);
      if (sha256(data) !== expected) {
        return { ok: false, reason: 'tampered', error: `Файл «${name}» изменён после установки` };
      }
    } catch {
      return { ok: false, reason: 'missing-file', error: `Файл «${name}» отсутствует` };
    }
  }

  return { ok: true };
}

function manifestFor(record) {
  if (!record) return null;
  if (record.manifest) return record.manifest;
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(state.pluginDir(record.id), 'plugin.json'), 'utf8'),
    );
    const validation = validateManifest(raw);
    return validation.ok ? validation.manifest : null;
  } catch {
    return null;
  }
}

function saveRecord(record) {
  if (!record) return;
  state.set(record);
}

function setRecordSettings(record, patch) {
  if (!record) return record;
  const manifest = record.manifest || manifestFor(record);
  if (!manifest) return record;
  const next = { ...record.settings, ...patch };
  record.settings = applySettings(manifest, next);
  saveRecord(record);
  return record;
}

function defaultSettingsFor(record) {
  return settingsDefaults(record?.manifest || { settings: [] });
}

function getDownloadSessionForTests() {
  return getDownloadSession();
}

async function readLimited(response, maxBytes) {
  const length = Number(response.headers.get('content-length')) || 0;
  if (length > maxBytes) throw new Error('Ответ больше допустимого размера');

  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('Ответ больше допустимого размера');
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* поток уже закрыт */
      }
      throw new Error('Ответ больше допустимого размера');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function downloadPackage(release) {
  if (!release?.download) throw new Error('В каталоге нет ссылки на пакет');

  let downloadUrl;
  try {
    downloadUrl = new URL(release.download);
  } catch {
    throw new Error('Некорректная ссылка на пакет');
  }
  const local =
    downloadUrl.protocol === 'http:' &&
    (downloadUrl.hostname === '127.0.0.1' ||
      downloadUrl.hostname === 'localhost' ||
      downloadUrl.hostname === '[::1]');
  if (downloadUrl.protocol !== 'https:' && !local) {
    throw new Error('Пакет можно скачать только по https');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await getDownloadSession().fetch(downloadUrl.toString(), {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/octet-stream' },
    });
    if (!response.ok) throw new Error(`Не удалось скачать пакет: ${response.status}`);
    const buffer = await readLimited(response, LIMITS.packageBytes);
    const hash = sha256(buffer);
    if (release.sha256 && hash !== release.sha256) {
      throw new Error('SHA-256 скачанного пакета не совпадает с каталогом');
    }
    return { buffer, sha256: hash };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  inspectPackage,
  inspectDirectory,
  preview,
  install,
  installRecord,
  rollback,
  remove,
  verifyInstalled,
  manifestFor,
  saveRecord,
  setRecordSettings,
  defaultSettingsFor,
  signatureLabel,
  downloadPackage,
  getDownloadSessionForTests,
  readLimited,
  installDecision,
};
