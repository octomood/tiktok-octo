'use strict';

const { app, BrowserWindow, shell, safeStorage } = require('electron');
const { showMessageBox, showOpenDialog } = require('../dialogs');
const fs = require('node:fs');
const path = require('node:path');
const { ctx, pushState, setPluginsState, toast } = require('../app-context');
const { openExternal } = require('../links');
const state = require('./state');
const registry = require('./registry');
const installer = require('./installer');
const host = require('./host');
const managerWindow = require('./window');
const docsWindow = require('./docs-window');
const { compareVersions, isCompatible, applySettings } = require('./manifest');
const { installDecision } = require('./security');
const { trustNotice, needsTrustWarning } = require('./plugin-trust');
const { compareUpdate } = require('./update-trust');
const {
  describePermissions,
  baselinePermissions,
  highestRisk,
  riskLabel,
} = require('./permissions');
const { DOCS_URL, PUBLISHING_URL, TELEGRAM_URL, LIMITS } = require('./constants');

/**
 * Система плагинов целиком.
 *
 * Здесь сходятся каталог, установка, безопасность, хосты и менеджер.
 * Renderer не принимает решений об установке: диалоги подтверждения и все
 * проверки живут в main-процессе.
 */

let initialized = false;
let safeMode = false;
let onChange = null;
let catalog = {
  status: 'idle',
  updatedAt: '',
  fetchedAt: 0,
  error: '',
  plugins: [],
};
let busy = null;
let devRecords = [];
let devWatcher = null;
let devWatchTimer = null;
const previewTimers = new Map();
const PREVIEW_MS = Number(process.env.OCTO_PLUGIN_PREVIEW_MS) || 20000;

function settings() {
  return state.getSettings();
}

function sameList(left, right) {
  const a = [...new Set(left || [])].sort();
  const b = [...new Set(right || [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sourceLabel(source) {
  if (source === 'registry') return 'каталог';
  if (source === 'dev') return 'папка разработки';
  return 'файл';
}

function allRecords() {
  const installed = state.list().map((record) => {
    if (!record.manifest) record.manifest = installer.manifestFor(record);
    if (!record.settings && record.manifest) {
      record.settings = installer.defaultSettingsFor(record);
    }
    if (!record.permissions && record.manifest) record.permissions = record.manifest.permissions;
    if (!record.networkHosts && record.manifest) record.networkHosts = record.manifest.networkHosts;
    if (!record.scan && record.manifest) {
      record.scan = {
        verdict: 'review',
        findings: [],
        warnings: 0,
        blocked: 0,
        permissions: [],
        baseline: [],
        risk: 'medium',
      };
    }
    return record;
  });

  const byId = new Map(installed.map((record) => [record.id, record]));
  for (const record of devRecords) {
    byId.set(record.id, record);
  }
  return [...byId.values()];
}

function getRecord(id) {
  return devRecords.find((record) => record.id === id) || state.get(id);
}

function manifestOf(record) {
  return record?.manifest || installer.manifestFor(record);
}

function updateInfo(record, release) {
  if (!record || !release || record.dev) return null;
  if (record.source !== 'registry') return null;

  const manifest = manifestOf(record);
  if (!manifest) return null;
  if (compareVersions(release.version, record.version) <= 0) return null;

  const currentPermissions = record.permissions || manifest.permissions || [];
  const addedPermissions = (release.permissions || []).filter(
    (permission) => !currentPermissions.includes(permission),
  );
  const changedHosts = !sameList(release.networkHosts || [], record.networkHosts || []);
  const signature = registry.releaseSignature(release);
  const signatureDowngrade = record.signature === 'verified' && signature !== 'verified';
  const compatible = isCompatible({ minAppVersion: release.minAppVersion }, app.getVersion());

  return {
    version: release.version,
    minAppVersion: release.minAppVersion,
    changelog: release.changelog,
    publishedAt: release.publishedAt,
    signature,
    signatureDowngrade,
    compatible,
    incompatible: !compatible,
    blocked: signature === 'invalid',
    requiresApproval: addedPermissions.length > 0 || changedHosts || signatureDowngrade,
    addedPermissions,
    changedHosts,
    permissions: describePermissions(release.permissions),
    networkHosts: release.networkHosts,
    release,
  };
}

function findCatalogItem(id) {
  return catalog.plugins.find((plugin) => plugin.id === id) || null;
}

function installedView(record) {
  const manifest = manifestOf(record);
  const latest = findCatalogItem(record.id)?.latest || null;
  const update = updateInfo(record, latest);
  const report = record.scan || {
    verdict: 'review',
    findings: [],
    warnings: 0,
    blocked: 0,
    permissions: describePermissions(record.permissions || []),
    baseline: baselinePermissions(),
    risk: 'medium',
  };
  const liveLogs = host.getLogs(record.id, 20);
  const logs = liveLogs.length ? liveLogs : (record.lastLogs || []).slice(-20);

  return {
    id: record.id,
    name: record.name || manifest?.name || record.id,
    version: record.version,
    author: record.author || manifest?.author || { name: 'неизвестен', url: '' },
    description: record.description || manifest?.description || '',
    license: record.license || manifest?.license || 'UNLICENSED',
    homepage: record.homepage || manifest?.homepage || '',
    sourceCode: record.sourceCode || manifest?.source || '',
    source: record.source,
    sourceLabel: sourceLabel(record.source),
    enabled: record.enabled === true,
    autoUpdate: record.autoUpdate !== false,
    dev: record.dev === true,
    cosmetic: record.manifest?.cosmetic === true || record.cosmetic === true,
    tampered: record.tampered === true,
    lastError: record.lastError || '',
    signature: record.signature || 'unsigned',
    signatureLabel: installer.signatureLabel(record.signature),
    permissions: describePermissions(record.permissions || manifest?.permissions || []),
    baseline: baselinePermissions(),
    risk: highestRisk(record.permissions || manifest?.permissions || []),
    networkHosts: record.networkHosts || manifest?.networkHosts || [],
    scan: report,
    settings: (manifest?.settings || []).map((setting) => {
      if (setting.type === 'secret') {
        return {
          ...setting,
          value: '',
          hasValue: Boolean(record.secrets && record.secrets[setting.key]),
        };
      }
      return {
        ...setting,
        value: record.settings?.[setting.key],
      };
    }),
    icon: record.icon || '',
    screenshots: record.screenshots || [],
    logs,
    secretsCount: Object.keys(record.secrets || {}).length,
    history: (Array.isArray(record.history) ? record.history : []).map((item) => ({
      version: item.version,
      installedAt: item.installedAt || '',
      updatedAt: item.updatedAt || '',
      signature: item.signature || 'unsigned',
      verdict: item.scan?.verdict || '',
    })),
    installedAt: record.installedAt || '',
    updatedAt: record.updatedAt || '',
    minAppVersion: manifest?.minAppVersion || '0.0.0',
    apiVersion: manifest?.apiVersion || 0,
    update,
    pendingUpdate: record.pendingUpdate || '',
    active: Boolean(host.getHost(record.id)?.active),
    resources: resourceReport(record),
  };
}

/** Сколько плагин занимает: хранилище, команды, строки панели, таймауты. */
function resourceReport(record) {
  const entry = host.getHost(record.id);
  let storageBytes = 0;
  try {
    storageBytes = Buffer.byteLength(JSON.stringify(record.storage || {}), 'utf8');
  } catch {
    storageBytes = 0;
  }
  return {
    storageBytes,
    storageLimit: LIMITS.storageBytes,
    commands: entry?.commands?.size || 0,
    commandsLimit: LIMITS.maxCommands,
    rows: entry?.panelRows?.size || 0,
    rowsLimit: LIMITS.maxPanelRows,
    scriptTimeoutMs: 10000,
  };
}

function permissionDiff(from, to) {
  const labels = (ids) => describePermissions(ids).map((permission) => permission.label);
  const before = new Set(Array.isArray(from) ? from : []);
  const after = new Set(Array.isArray(to) ? to : []);
  return {
    added: labels([...after].filter((id) => !before.has(id))),
    removed: labels([...before].filter((id) => !after.has(id))),
  };
}

function catalogView(plugin) {
  const record = getRecord(plugin.id);
  const release = plugin.latest;
  const update = record ? updateInfo(record, release) : null;
  const signature = registry.releaseSignature(release);
  const previous = plugin.releases[1] || null;

  return {
    id: plugin.id,
    name: plugin.name,
    author: plugin.author,
    description: plugin.description,
    license: plugin.license,
    categories: plugin.categories,
    homepage: plugin.homepage,
    sourceCode: plugin.source,
    icon: plugin.icon,
    screenshots: plugin.screenshots,
    version: release.version,
    minAppVersion: release.minAppVersion,
    size: release.size,
    publishedAt: release.publishedAt,
    changelog: release.changelog,
    permissions: describePermissions(release.permissions),
    networkHosts: release.networkHosts,
    verified: signature === 'verified',
    signature,
    signatureLabel: installer.signatureLabel(signature),
    releases: plugin.releases.length,
    installs: plugin.installs || 0,
    registryLabel: plugin.registryLabel || 'официальный',
    registryUrl: plugin.registryUrl || '',
    permissionChanges: previous
      ? permissionDiff(previous.permissions, release.permissions)
      : { added: [], removed: [] },
    installedPermissionChanges: record
      ? permissionDiff(record.permissions || [], release.permissions || [])
      : null,
    installedVersion: record?.version || '',
    installedEnabled: record?.enabled === true,
    update,
    compatible: isCompatible({ minAppVersion: release.minAppVersion }, app.getVersion()),
    blocked: signature === 'invalid',
  };
}

function managerState() {
  const records = allRecords();
  const installed = records.map(installedView);
  const updates = installed.filter((record) => record.update && !record.dev);

  return {
    version: app.getVersion(),
    settings: settings(),
    catalog: {
      status: catalog.status,
      updatedAt: catalog.updatedAt,
      fetchedAt: catalog.fetchedAt,
      error: catalog.error,
      warnings: Array.isArray(catalog.warnings) ? catalog.warnings : [],
      sources: Array.isArray(catalog.sources) ? catalog.sources : [],
      plugins: catalog.plugins.map(catalogView),
    },
    installed,
    updates,
    busy,
    info: managerWindow.info(),
    limits: {
      maxPlugins: LIMITS.maxPlugins,
      maxPackageBytes: LIMITS.packageBytes,
    },
    docsUrl: DOCS_URL,
    rulesUrl: PUBLISHING_URL,
  };
}

function publishSummary() {
  if (!initialized || ctx.quitting) return;
  try {
    publishSummaryNow();
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] plugins summary failed:', err.message);
  }
}

function publishSummaryNow() {
  const records = allRecords();
  const updates = records
    .map((record) => {
      const latest = findCatalogItem(record.id)?.latest || null;
      return { record, update: updateInfo(record, latest) };
    })
    .filter((entry) => entry.update);

  const registrations = host.summaryRows();

  setPluginsState({
    managerOpen: managerWindow.isOpen(),
    installedCount: records.length,
    enabledCount: records.filter((record) => record.enabled === true).length,
    updateCount: updates.length,
    errorCount: records.filter((record) => record.lastError || record.tampered).length,
    items: records.map((record) => ({
      id: record.id,
      name: record.name || record.id,
      version: record.version,
      enabled: record.enabled === true,
      dev: record.dev === true,
      tampered: record.tampered === true,
      error: record.lastError || '',
      update: Boolean(updateInfo(record, findCatalogItem(record.id)?.latest || null)),
      icon: record.icon || '',
    })),
    rows: registrations.rows,
    commands: registrations.commands,
    docsUrl: DOCS_URL,
    rulesUrl: PUBLISHING_URL,
  });

  pushState();
  if (managerWindow.isOpen()) managerWindow.send(managerState());
  if (onChange) {
    try {
      onChange();
    } catch (err) {
      if (process.env.OCTO_DEBUG) console.warn('[octo] plugins onChange failed:', err.message);
    }
  }
}

function safePublish() {
  try {
    publishSummary();
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] plugins summary failed:', err.message);
  }
}

function parentWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  if (ctx.win && !ctx.win.isDestroyed()) return ctx.win;
  return undefined;
}

async function showMessage(options) {
  const parent = parentWindow();
  try {
    return parent ? await showMessageBox(parent, options) : await showMessageBox(options);
  } catch {
    // Ошибка диалога не должна означать согласие: по умолчанию — отмена.
    return { response: 1 };
  }
}

function findingsText(report, limit = 6) {
  const warnings = (report?.findings || [])
    .filter((finding) => finding.severity === 'warn')
    .slice(0, limit)
    .map((finding) => `• ${finding.file || 'код'}:${finding.line || 1} — ${finding.message}`);
  return warnings.length ? warnings.join('\n') : '';
}

function shortKey(fingerprint) {
  return String(fingerprint || '')
    .slice(0, 16)
    .replace(/(.{4})(?=.)/g, '$1 ');
}

function permissionLines(ids) {
  return describePermissions(ids).map(
    (item) => `• ${item.label} (риск: ${riskLabel(item.risk)}) — ${item.description}`,
  );
}

/** Строки диалога о том, что меняет обновление поверх установленной версии. */
function trustLines(trust) {
  if (!trust) return [];
  const lines = [''];
  if (trust.downgrade) {
    lines.push(`Внимание: версия ${trust.version} старше установленной ${trust.previousVersion}.`);
  } else if (trust.sameVersion) {
    lines.push(`Та же версия ${trust.version}, но содержимое пакета другое.`);
  } else {
    lines.push(`Обновление с версии ${trust.previousVersion} до ${trust.version}.`);
  }

  if (trust.publisherChanged) {
    lines.push('Издатель сменился: настройки, хранилище и секреты не перейдут к новой версии.');
  } else if (trust.signedNow) {
    lines.push(
      `Теперь плагин подписан: издатель закрепится за ключом ${shortKey(trust.publisher.key)}.`,
    );
  } else if (trust.publisher.key) {
    lines.push(`Издатель подтверждён подписью (ключ ${shortKey(trust.publisher.key)}).`);
  } else {
    lines.push('Издатель не подтверждён: пакет без подписи, сверяется только имя автора.');
  }

  if (trust.addedPermissions.length) {
    lines.push('', 'Новые разрешения:', ...permissionLines(trust.addedPermissions));
  }
  if (trust.removedPermissions.length) {
    lines.push('', 'Убраны разрешения:', ...permissionLines(trust.removedPermissions));
  }
  if (trust.addedHosts.length) {
    lines.push('', 'Новые сетевые хосты:', ...trust.addedHosts.map((item) => `• ${item}`));
  }
  if (trust.removedHosts.length) {
    lines.push('', 'Убраны сетевые хосты:', ...trust.removedHosts.map((item) => `• ${item}`));
  }
  return lines;
}

function confirmDetail(preview, { update = false, addedPermissions = [], trust = null } = {}) {
  const lines = [
    `${preview.name} ${preview.version} · ${preview.author?.name || 'неизвестный автор'}`,
    preview.description,
    '',
    `Источник: ${sourceLabel(preview.source)}`,
    `Подпись: ${installer.signatureLabel(preview.signature)}`,
    `Проверка безопасности: ${
      preview.report.verdict === 'safe'
        ? 'замечаний нет'
        : `предупреждений — ${preview.report.warnings}`
    }`,
  ];

  const permissionItems = [...preview.permissions, ...preview.baseline];
  if (permissionItems.length) {
    lines.push('', 'Доступ:');
    for (const item of permissionItems) {
      lines.push(`• ${item.label} (риск: ${riskLabel(item.risk)}) — ${item.description}`);
    }
  }
  if (preview.networkHosts?.length) {
    lines.push('', 'Сетевые хосты:', ...preview.networkHosts.map((item) => `• ${item}`));
  }
  lines.push(...trustLines(trust && { ...trust, version: preview.version }));

  if (update && preview.registryVersion) {
    lines.push('', `Обновление до версии ${preview.registryVersion}.`);
  }
  if (addedPermissions.length) {
    lines.push('', 'Новые разрешения:', ...addedPermissions.map((id) => `• ${id}`));
  }

  const warnings = findingsText(preview.report);
  if (warnings) {
    lines.push('', 'Предупреждения статической проверки:', warnings);
  }
  lines.push('', ...trustNotice(preview));

  return lines.filter((line) => line !== undefined && line !== null).join('\n');
}

function trustNeedsAttention(trust) {
  return Boolean(
    trust &&
    (trust.publisherChanged ||
      trust.downgrade ||
      trust.addedPermissions.length ||
      trust.addedHosts.length),
  );
}

async function confirmInstall(preview, options = {}) {
  const { response } = await showMessage({
    type:
      preview.report.verdict === 'safe' &&
      !trustNeedsAttention(options.trust) &&
      !needsTrustWarning(preview)
        ? 'question'
        : 'warning',
    title: options.update ? 'Обновление плагина' : 'Установка плагина',
    message: options.update
      ? `Обновить «${preview.name}» до ${preview.version}?`
      : `Установить «${preview.name}» ${preview.version}?`,
    detail: confirmDetail(preview, options),
    buttons: [options.update ? 'Обновить' : 'Установить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  return response === 0;
}

/**
 * Отдельное подтверждение, когда пакет с тем же id выпустил другой издатель:
 * по умолчанию — отмена, а при согласии данные старой версии не переносятся.
 */
async function confirmPublisherChange(preview, trust) {
  const reason =
    trust.reason === 'key-changed'
      ? 'Новая версия подписана другим ключом, чем установленная.'
      : trust.reason === 'signature-lost'
        ? 'Установленная версия подписана, а новая — нет.'
        : `Автор в новой версии — «${trust.publisher.author || '?'}», в установленной — «${
            trust.previousPublisher.author || '?'
          }».`;
  const { response } = await showMessage({
    type: 'warning',
    title: 'Другой издатель',
    message: `Плагин «${preview.name}» выпустил другой издатель`,
    detail: [
      reason,
      '',
      'Если продолжить, новая версия встанет как отдельный плагин: настройки, хранилище и секреты установленной версии ей не передадутся.',
      'Прежнюю версию вместе с её данными можно вернуть в «История версий».',
      '',
      'Продолжайте, только если получили файл от автора плагина.',
    ].join('\n'),
    buttons: ['Продолжить без данных', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  return response === 0;
}

async function showError(message, title = 'Плагин не установлен') {
  await showMessage({
    type: 'error',
    title,
    message,
    buttons: ['ОК'],
    noLink: true,
  });
}

async function loadRecord(record, { silent = false } = {}) {
  if (!record || record.enabled !== true) return false;
  if (record.tampered) return false;

  const integrity = installer.verifyInstalled(record);
  if (!integrity.ok) {
    record.lastError = integrity.error;
    if (!record.dev) state.set(record);
    if (!silent) toast(`${record.name}: ${integrity.error}`);
    return false;
  }

  const loaded = await host.load(record);
  if (!loaded) {
    record.lastError = record.lastError || 'Не удалось запустить плагин';
    if (!record.dev) state.set(record);
  } else {
    record.lastError = '';
    if (!record.dev) state.set(record);
  }
  return loaded;
}

function applyInspection(inspection) {
  // host.load() всё равно откажет, но установка не должна оставлять в списке
  // заведомо неработающий плагин с зелёной галочкой.
  if (!isCompatible(inspection.manifest, app.getVersion())) {
    return {
      ok: false,
      error: `Нужен TikTok Octo ${inspection.manifest.minAppVersion} или новее`,
    };
  }

  const current = getRecord(inspection.manifest.id);
  const decision = installDecision({
    report: inspection.report,
    signature: inspection.signature,
    settings: settings(),
    update: Boolean(current),
  });

  if (!decision.ok) {
    return { ok: false, error: decision.message };
  }

  if (
    current &&
    current.version === inspection.manifest.version &&
    current.sha256 === inspection.sha256
  ) {
    return { ok: false, error: 'Эта версия уже установлена', unchanged: true };
  }

  return { ok: true, current };
}

async function installInspection(inspection, options = {}) {
  if (!inspection?.ok) return { ok: false, error: inspection?.error || 'Пакет не проверен' };
  const managedBusy = options.managedBusy === true;
  if (busy && !managedBusy) return { ok: false, error: 'Другая операция с плагинами уже идёт' };
  if (!managedBusy) {
    busy = { scope: options.update ? 'update' : 'install', id: inspection.manifest.id };
    publishSummary();
  }

  try {
    const applied = applyInspection(inspection);
    if (!applied.ok) {
      if (options.auto) return applied;
      await showError(
        applied.error,
        applied.unchanged ? 'Уже установлено' : 'Плагин не установлен',
      );
      return applied;
    }

    const current = applied.current;
    const preview = installer.preview(inspection, {
      source: options.source || 'file',
      entry: options.entry || null,
    });

    const trust = compareUpdate(current, inspection);
    if (options.auto && trust?.publisherChanged) {
      return { ok: false, error: 'Пакет выпустил другой издатель' };
    }

    if (!options.auto) {
      if (trust?.publisherChanged && !(await confirmPublisherChange(preview, trust))) {
        return { ok: false, cancelled: true };
      }
      const confirmed = await confirmInstall(preview, {
        update: Boolean(current),
        addedPermissions: options.addedPermissions || [],
        trust,
      });
      if (!confirmed) return { ok: false, cancelled: true };
    }

    if (current && host.getHost(current.id)) await host.unload(current.id);

    const result = installer.install(inspection, {
      source: options.source || 'file',
      registryUrl: options.registryUrl || '',
      entry: options.entry || null,
    });

    if (!result.ok) {
      if (current) await loadRecord(current, { silent: true });
      if (!options.auto) await showError(result.error);
      return result;
    }

    if (result.ok && current?.dev) {
      devRecords = devRecords.filter((record) => record.id !== current.id);
    }
    // Настройки и данные dev-версии не теряются при переходе на пакет того же автора.
    if (result.ok && current?.dev && !trust?.publisherChanged) {
      if (current.settings && Object.keys(current.settings).length) {
        result.record.settings = applySettings(result.record.manifest, current.settings);
      }
      if (current.storage && Object.keys(current.storage).length) {
        result.record.storage = { ...current.storage };
      }
      state.set(result.record);
    }

    if (result.record.enabled) await loadRecord(result.record, { silent: options.auto });

    if (!options.auto) {
      toast(`Плагин «${result.record.name}» установлен`);
    }
    return { ok: true, record: result.record };
  } finally {
    if (!managedBusy) {
      busy = null;
      publishSummary();
    }
  }
}

async function installFromFile() {
  if (busy) {
    toast('Дождитесь окончания текущей операции');
    return { ok: false };
  }

  let picked;
  try {
    picked = await showOpenDialog(parentWindow(), {
      title: 'Установить плагин из файла',
      properties: ['openFile'],
      filters: [
        { name: 'Плагины TikTok Octo', extensions: ['octoplugin', 'zip'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    });
  } catch (err) {
    await showError(`Не удалось открыть диалог: ${err.message}`);
    return { ok: false };
  }
  const { canceled, filePaths } = picked;
  if (canceled || !filePaths?.length) return { ok: false, cancelled: true };

  const file = filePaths[0];
  let buffer;
  try {
    const stat = fs.statSync(file);
    if (stat.size > LIMITS.packageBytes) {
      await showError(`Пакет больше ${Math.round(LIMITS.packageBytes / 1024 / 1024)} МБ`);
      return { ok: false };
    }
    buffer = fs.readFileSync(file);
  } catch (err) {
    await showError(`Не удалось прочитать файл: ${err.message}`);
    return { ok: false };
  }

  const inspection = installer.inspectPackage(buffer, {});
  if (!inspection.ok) {
    await showError(inspection.error);
    return { ok: false };
  }

  try {
    return await installInspection(inspection, { source: 'file' });
  } catch (err) {
    await showError(`Не удалось установить плагин: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function installFromRegistry(id) {
  if (busy) return { ok: false, error: 'Другая операция с плагинами уже идёт' };
  let item = findCatalogItem(id);
  if (!item) {
    await refreshCatalog({ silent: true });
    item = findCatalogItem(id);
  }
  if (!item) {
    await showError('Плагин не найден в каталоге');
    return { ok: false };
  }

  const release = item.latest;
  if (registry.releaseSignature(release) === 'invalid') {
    await showError('Подпись плагина в каталоге недействительна');
    return { ok: false };
  }
  if (!isCompatible({ minAppVersion: release.minAppVersion }, app.getVersion())) {
    await showError(`Нужен TikTok Octo ${release.minAppVersion} или новее`);
    return { ok: false };
  }

  busy = { scope: 'install', id };
  publishSummary();
  try {
    const downloaded = await installer.downloadPackage(release);
    const inspection = installer.inspectPackage(downloaded.buffer, {
      registryEntry: release,
      expectedId: id,
    });
    if (!inspection.ok) {
      await showError(inspection.error);
      return { ok: false };
    }
    return await installInspection(inspection, {
      source: 'registry',
      registryUrl: item.registryUrl || settings().registryUrl,
      entry: release,
      managedBusy: true,
    });
  } catch (err) {
    await showError(err.message);
    return { ok: false, error: err.message };
  } finally {
    busy = null;
    publishSummary();
  }
}

async function performUpdate(record, release, { auto = false } = {}) {
  if (!record || !release) return { ok: false, error: 'Нет данных об обновлении' };
  if (busy) return { ok: false, error: 'Другая операция уже идёт' };
  const signature = registry.releaseSignature(release);
  if (signature === 'invalid') return { ok: false, error: 'Подпись обновления недействительна' };
  if (!isCompatible({ minAppVersion: release.minAppVersion }, app.getVersion())) {
    return { ok: false, error: `Нужен TikTok Octo ${release.minAppVersion} или новее` };
  }

  const added = (release.permissions || []).filter(
    (permission) => !(record.permissions || []).includes(permission),
  );
  const changedHosts = !sameList(release.networkHosts || [], record.networkHosts || []);
  const signatureDowngrade = record.signature === 'verified' && signature !== 'verified';
  if (auto && (added.length || changedHosts || signatureDowngrade)) {
    record.pendingUpdate = release.version;
    if (!record.dev) state.set(record);
    publishSummary();
    return {
      ok: false,
      pending: true,
      error: 'Обновление меняет разрешения и ждёт подтверждения',
    };
  }

  busy = { scope: 'update', id: record.id };
  publishSummary();
  try {
    const downloaded = await installer.downloadPackage(release);
    const inspection = installer.inspectPackage(downloaded.buffer, {
      registryEntry: release,
      expectedId: record.id,
    });
    if (!inspection.ok) {
      if (!auto) await showError(inspection.error, 'Обновление не установлено');
      return { ok: false, error: inspection.error };
    }

    if (auto && inspection.report.verdict !== 'safe') {
      record.pendingUpdate = release.version;
      if (!record.dev) state.set(record);
      publishSummary();
      toast(`«${record.name}»: обновление ждёт проверки предупреждений`);
      return { ok: false, pending: true, error: 'Обновление содержит предупреждения' };
    }

    if (!auto) {
      const preview = installer.preview(inspection, { source: 'registry', entry: release });
      const confirmed = await confirmInstall(preview, {
        update: true,
        addedPermissions: [
          ...added,
          ...(changedHosts ? ['networkHosts изменены'] : []),
          ...(signatureDowngrade ? ['подпись больше не проверена'] : []),
        ],
      });
      if (!confirmed) return { ok: false, cancelled: true };
    }

    const wasEnabled = record.enabled === true;
    if (host.getHost(record.id)) await host.unload(record.id);

    const result = installer.install(inspection, {
      source: 'registry',
      registryUrl:
        findCatalogItem(record.id)?.registryUrl || record.registryUrl || settings().registryUrl,
      entry: release,
    });

    if (!result.ok) {
      if (wasEnabled) await loadRecord(record, { silent: true });
      if (!auto) await showError(result.error, 'Обновление не установлено');
      return result;
    }

    if (result.record.enabled) await loadRecord(result.record, { silent: auto });
    if (!auto) {
      toast(`«${result.record.name}» обновлён до ${result.record.version}`);
    } else {
      toast(`Плагин «${result.record.name}» обновлён до ${result.record.version}`);
    }
    return { ok: true, record: result.record };
  } catch (err) {
    if (!auto) await showError(err.message, 'Обновление не установлено');
    return { ok: false, error: err.message };
  } finally {
    busy = null;
    publishSummary();
  }
}

async function checkForUpdates({ auto = false, silent = false } = {}) {
  if (busy) return [];
  const current = settings();
  if (auto && (!current.autoUpdate || current.updateIntervalHours === 0)) return [];
  if (process.env.OCTO_E2E && auto) return [];

  const result = await registry.load({ force: true, settings: current });
  catalog = result;
  publishSummary();

  const updates = [];
  for (const record of state.list()) {
    if (record.source !== 'registry') continue;
    const item = findCatalogItem(record.id);
    const update = updateInfo(record, item?.latest || null);
    if (!update) continue;
    updates.push({ record, update });
  }

  if (auto) {
    for (const entry of updates) {
      const record = getRecord(entry.record.id);
      if (!record || record.autoUpdate === false) continue;
      // Уже ждёт подтверждения — не тратим трафик на повторное скачивание.
      if (record.pendingUpdate === entry.update.version) continue;
      if (entry.update.incompatible || entry.update.blocked) {
        if (record.pendingUpdate) {
          record.pendingUpdate = '';
          state.set(record);
        }
        continue;
      }
      if (entry.update.requiresApproval) {
        if (record.pendingUpdate !== entry.update.version) {
          record.pendingUpdate = entry.update.version;
          state.set(record);
          toast(`«${record.name}»: обновление ждёт подтверждения`);
        }
        continue;
      }
      await performUpdate(record, entry.update.release, { auto: true });
    }
  }

  if (!silent) {
    if (!result.ok && !result.plugins.length) {
      toast('Не удалось проверить обновления');
    } else if (updates.length === 0) {
      toast('Обновлений нет');
    } else {
      toast(`Доступно обновлений: ${updates.length}`);
    }
  }

  publishSummary();
  return updates;
}

async function refreshCatalog({ silent = false, force = true } = {}) {
  if (busy) {
    if (busy.scope === 'catalog') return catalog;
    return catalog;
  }
  busy = { scope: 'catalog', id: '' };
  catalog = { ...catalog, status: 'loading', error: '' };
  if (managerWindow.isOpen()) managerWindow.send(managerState());

  try {
    const result = await registry.load({ force, settings: settings() });
    catalog = {
      status: result.status,
      updatedAt: result.updatedAt,
      fetchedAt: result.fetchedAt,
      error: result.error,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      sources: Array.isArray(result.sources) ? result.sources : [],
      plugins: result.plugins,
    };
    if (!silent) {
      if (result.status === 'empty') toast('Каталог пока не опубликован');
      else if (result.ok) toast('Каталог обновлён');
      else toast('Каталог недоступен');
    }
    return catalog;
  } finally {
    busy = null;
    publishSummary();
  }
}

async function loadInstalled() {
  for (const record of state.list()) {
    if (record.dev || record.source === 'dev') {
      state.remove(record.id);
      continue;
    }
    const integrity = installer.verifyInstalled(record);
    if (!integrity.ok) {
      record.tampered = integrity.reason === 'tampered';
      record.lastError = integrity.error;
      record.enabled = false;
      state.set(record);
      continue;
    }
    const manifest = installer.manifestFor(record);
    if (!manifest) {
      record.lastError = 'Манифест плагина не читается';
      record.enabled = false;
      state.set(record);
      continue;
    }
    record.manifest = manifest;
    if (!isCompatible(manifest, app.getVersion())) {
      record.lastError = `Нужен TikTok Octo ${manifest.minAppVersion} или новее`;
      state.set(record);
      continue;
    }
    if (record.enabled === true) await loadRecord(record, { silent: true });
  }
}

function loadDevPlugins() {
  const dir = process.env.OCTO_PLUGIN_DEV_DIR;
  if (!dir) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn('[octo] dev plugins:', err.message);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (!fs.existsSync(path.join(full, 'plugin.json'))) continue;

    const inspection = installer.inspectDirectory(full);
    if (!inspection.ok) {
      console.warn(`[octo] dev plugin ${entry.name}: ${inspection.error}`);
      continue;
    }
    const existing = state.get(inspection.manifest.id);
    if (existing) {
      // Запись могла остаться от ранней версии, которая сохраняла dev-плагины.
      if (existing.source === 'dev' || existing.dev === true) state.remove(inspection.manifest.id);
      else {
        console.warn(`[octo] dev plugin ${entry.name}: id уже установлен, пропускаю`);
        continue;
      }
    }

    const record = installer.installRecord(inspection, {
      source: 'dev',
      registryUrl: '',
      previous: null,
    });
    record.dev = true;
    record.devDir = full;
    record.autoUpdate = false;
    record.enabled = inspection.report.verdict !== 'blocked';
    record.lastError =
      inspection.report.verdict === 'blocked' ? 'Статическая проверка запретила запуск' : '';
    devRecords.push(record);
    if (record.enabled) loadRecord(record, { silent: true });
  }

  watchDevPlugins(dir);
}

/** Изменения в папке разработки перезагружают dev-плагины автоматически. */
function watchDevPlugins(dir) {
  if (devWatcher) return;
  try {
    devWatcher = fs.watch(dir, { recursive: true }, () => {
      clearTimeout(devWatchTimer);
      devWatchTimer = setTimeout(() => {
        reloadDevPlugins().catch((err) => {
          if (process.env.OCTO_DEBUG) console.warn('[octo] dev reload failed:', err.message);
        });
      }, 400);
    });
    devWatcher.on('error', (err) => {
      if (process.env.OCTO_DEBUG) console.warn('[octo] dev watch:', err.message);
    });
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] dev watch failed:', err.message);
  }
}

async function reloadDevPlugins() {
  await Promise.all(devRecords.map((record) => host.unload(record.id)));
  devRecords = [];
  loadDevPlugins();
  publishSummary();
  toast('Плагины разработки перезагружены');
}

async function setEnabled(id, enabled) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  const preview = previewTimers.get(id);
  if (preview) {
    clearTimeout(preview);
    previewTimers.delete(id);
  }
  if (record.tampered) return { ok: false, error: 'Плагин изменён после установки' };

  if (enabled) {
    if (!manifestOf(record)) return { ok: false, error: 'Манифест не читается' };
    record.enabled = true;
    record.crashCount = 0;
    record.lastCrashAt = 0;
    if (!record.dev) state.set(record);
    const loaded = await loadRecord(record);
    publishSummary();
    if (!loaded) return { ok: false, error: record.lastError || 'Не удалось запустить' };
    toast(`Плагин «${record.name}» включён`);
  } else {
    record.enabled = false;
    if (!record.dev) state.set(record);
    await host.unload(id);
    toast(`Плагин «${record.name}» выключен`);
    publishSummary();
  }
  return { ok: true };
}

/** Превью косметического пака: включаем на время и возвращаем как было. */
async function previewPlugin(id) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  if (!(record.manifest?.cosmetic === true || record.cosmetic === true)) {
    return { ok: false, error: 'Это не косметический пак' };
  }
  if (record.enabled === true) return { ok: false, error: 'Пакет уже включён' };

  const result = await setEnabled(id, true);
  if (!result.ok) return result;

  const seconds = Math.max(1, Math.round(PREVIEW_MS / 1000));
  toast(`Превью «${record.name}»: ${seconds} с`);
  const timer = setTimeout(() => {
    previewTimers.delete(id);
    setEnabled(id, false)
      .catch(() => {})
      .then(() => toast(`Превью «${record.name}» закончилось`));
  }, PREVIEW_MS);
  if (typeof timer.unref === 'function') timer.unref();
  previewTimers.set(id, timer);
  return { ok: true };
}

async function togglePlugin(id) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  return setEnabled(id, record.enabled !== true);
}

async function reloadPlugin(id) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  if (record.enabled !== true) return { ok: false, error: 'Плагин выключен' };
  await host.unload(id);
  record.lastError = '';
  if (!record.dev) state.set(record);
  const loaded = await loadRecord(record, { silent: true });
  publishSummary();
  if (!loaded) return { ok: false, error: record.lastError || 'Не удалось запустить' };
  toast(`Плагин «${record.name}» перезагружен`);
  return { ok: true };
}

async function rollbackPlugin(id, version) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  const entry = (record.history || []).find((item) => item.version === version);
  if (!entry) return { ok: false, error: 'Версия не найдена' };

  const { response } = await showMessage({
    type: 'warning',
    title: 'Откатить плагин',
    message: `Откатить «${record.name}» с ${record.version} до ${version}?`,
    detail:
      'Файлы текущей версии сохранятся в истории, настройки и обычное хранилище ' +
      'останутся. Плагин будет перезапущен.',
    buttons: ['Откатить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return { ok: false, cancelled: true };

  if (host.getHost(id)) await host.unload(id);
  const result = installer.rollback(id, version);
  if (!result.ok) {
    await showError(result.error, 'Откат не выполнен');
    if (record.enabled) await loadRecord(record, { silent: true });
    publishSummary();
    return result;
  }

  if (result.record.enabled) await loadRecord(result.record, { silent: true });
  toast(`«${result.record.name}» откатан до ${result.record.version}`);
  publishSummary();
  return { ok: true, record: result.record };
}

async function removePlugin(id) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };

  const { response } = await showMessage({
    type: 'warning',
    title: 'Удалить плагин',
    message: `Удалить «${record.name}»?`,
    detail:
      'Файлы плагина, его настройки и сохранённые данные будут удалены. ' +
      'Действие нельзя отменить.',
    buttons: ['Удалить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return { ok: false, cancelled: true };

  await host.unload(id);
  if (record.dev) {
    devRecords = devRecords.filter((item) => item.id !== id);
  } else {
    installer.remove(id);
  }
  toast(`Плагин «${record.name}» удалён`);
  publishSummary();
  return { ok: true };
}

async function setPluginAutoUpdate(id, value) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  record.autoUpdate = Boolean(value);
  if (!record.dev) state.set(record);
  publishSummary();
  return { ok: true };
}

function savePluginSetting(id, key, value) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  const manifest = manifestOf(record);
  const setting = manifest?.settings?.find((item) => item.key === key);
  if (!setting) return { ok: false, error: 'Неизвестная настройка' };
  if (setting.type === 'action') return { ok: false, error: 'Это кнопка действия' };

  if (setting.type === 'secret') {
    const raw = typeof value === 'string' ? value : '';
    const secrets = { ...(record.secrets || {}) };
    if (!raw) {
      delete secrets[key];
    } else {
      if (raw.length > (setting.maxLength || 4096)) {
        return { ok: false, error: 'Секрет слишком длинный' };
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return { ok: false, error: 'Системное хранилище секретов недоступно' };
      }
      try {
        secrets[key] = safeStorage.encryptString(raw).toString('base64');
      } catch (err) {
        return { ok: false, error: `Не удалось сохранить секрет: ${err.message}` };
      }
    }
    record.secrets = secrets;
    if (!record.dev) installer.saveRecord(record);
    if (managerWindow.isOpen()) managerWindow.send(managerState());
    publishSummary();
    return { ok: true };
  }

  if (record.dev) {
    record.settings = applySettings(manifest, { ...record.settings, [key]: value });
  } else {
    installer.setRecordSettings(record, { [key]: value });
  }
  host.updateSettings(record);
  if (managerWindow.isOpen()) managerWindow.send(managerState());
  publishSummary();
  return { ok: true };
}

function triggerPluginSettingAction(id, key) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  const manifest = manifestOf(record);
  const setting = manifest?.settings?.find((item) => item.key === key && item.type === 'action');
  if (!setting) return { ok: false, error: 'Действие не найдено' };
  if (!host.sendSettingAction(id, key)) {
    return { ok: false, error: 'Включите плагин, чтобы выполнить действие' };
  }
  return { ok: true };
}

function openPluginDevTools(id) {
  const record = getRecord(id);
  if (!record || !record.dev) {
    return { ok: false, error: 'DevTools доступен только для dev-плагинов' };
  }
  if (!host.openDevTools(id)) return { ok: false, error: 'Плагин сейчас не запущен' };
  return { ok: true };
}

function saveSettings(patch) {
  const next = {};
  if (patch.autoUpdate !== undefined) next.autoUpdate = patch.autoUpdate === true;
  if (patch.allowUnsigned !== undefined) next.allowUnsigned = patch.allowUnsigned !== false;
  if (patch.requireSignatures !== undefined) {
    next.requireSignatures = patch.requireSignatures === true;
  }
  if (patch.updateIntervalHours !== undefined) {
    const value = Number(patch.updateIntervalHours);
    if (![0, 1, 6, 24].includes(value)) return { ok: false, error: 'Некорректный интервал' };
    next.updateIntervalHours = value;
  }
  if (patch.registryUrls !== undefined) {
    if (!Array.isArray(patch.registryUrls)) {
      return { ok: false, error: 'Список каталогов должен быть массивом' };
    }
    const urls = [];
    for (const item of patch.registryUrls.slice(0, 3)) {
      const url = String(item || '').trim();
      if (!url) continue;
      if (!registry.isAllowedRegistryUrl(url)) {
        return {
          ok: false,
          error: 'Адреса каталогов должны быть https:// (или localhost для разработки)',
        };
      }
      if (!urls.includes(url)) urls.push(url);
    }
    next.registryUrls = urls;
  }
  if (patch.registryUrl !== undefined) {
    const url = String(patch.registryUrl || '').trim();
    if (!registry.isAllowedRegistryUrl(url)) {
      return {
        ok: false,
        error: 'Адрес каталога должен быть https:// (или localhost для разработки)',
      };
    }
    next.registryUrl = url;
  }

  const previous = settings();
  state.saveSettings(next);
  const current = settings();

  if (
    current.registryUrl !== previous.registryUrl ||
    JSON.stringify(current.registryUrls) !== JSON.stringify(previous.registryUrls)
  ) {
    registry.reset();
    catalog = { status: 'idle', updatedAt: '', fetchedAt: 0, error: '', plugins: [] };
  }
  publishSummary();
  return { ok: true };
}

async function updatePlugin(id) {
  const record = getRecord(id);
  if (!record) return { ok: false, error: 'Плагин не найден' };
  let item = findCatalogItem(id);
  if (!item) {
    await refreshCatalog({ silent: true });
    item = findCatalogItem(id);
  }
  if (!item) return { ok: false, error: 'Плагин не найден в каталоге' };
  return performUpdate(record, item.latest, { auto: false });
}

async function updateAll() {
  const records = state.list();
  const planned = [];
  for (const record of records) {
    if (record.source !== 'registry') continue;
    const item = findCatalogItem(record.id);
    const update = updateInfo(record, item?.latest || null);
    if (update && !update.blocked && !update.incompatible) {
      planned.push({ record, update });
    }
  }
  if (!planned.length) {
    toast('Обновлений нет');
    return { ok: true, updated: 0 };
  }

  let updated = 0;
  for (const entry of planned) {
    const record = getRecord(entry.record.id);
    if (!record) continue;
    if (entry.update.requiresApproval) {
      // Новые разрешения всегда подтверждает пользователь — даже при «обновить всё».
      const result = await performUpdate(record, entry.update.release, { auto: false });
      if (result.ok) updated += 1;
    } else {
      const result = await performUpdate(record, entry.update.release, { auto: true });
      if (result.ok) updated += 1;
    }
  }
  publishSummary();
  toast(updated ? `Обновлено плагинов: ${updated}` : 'Обновления не установлены');
  return { ok: true, updated };
}

async function dispatchAction(action, payload) {
  switch (action) {
    case 'refreshCatalog':
      await refreshCatalog({ silent: false });
      return {};
    case 'install':
      return installFromRegistry(String(payload.id || ''));
    case 'installFile':
      return installFromFile();
    case 'remove':
      return removePlugin(String(payload.id || ''));
    case 'toggle':
      return setEnabled(String(payload.id || ''), payload.enabled === true);
    case 'reload':
      return reloadPlugin(String(payload.id || ''));

    case 'preview':
      return previewPlugin(String(payload.id || ''));
    case 'rollback':
      return rollbackPlugin(String(payload.id || ''), String(payload.version || ''));
    case 'logs':
      return { logs: host.getLogs(String(payload.id || '')) };
    case 'autoUpdate':
      return setPluginAutoUpdate(String(payload.id || ''), payload.value === true);
    case 'setSettings':
      return saveSettings(payload.patch || {});
    case 'pluginSettings':
      return savePluginSetting(String(payload.id || ''), String(payload.key || ''), payload.value);
    case 'pluginSettingAction':
      return triggerPluginSettingAction(String(payload.id || ''), String(payload.key || ''));
    case 'openDevTools':
      return openPluginDevTools(String(payload.id || ''));
    case 'update':
      return updatePlugin(String(payload.id || ''));
    case 'updateAll':
      return updateAll();
    case 'checkUpdates':
      await checkForUpdates({ auto: false, silent: false });
      return {};
    case 'openFolder':
      shell.openPath(state.pluginsDir());
      return {};
    case 'openDocs':
      openDocs();
      return {};
    case 'openRules':
      openRules();
      return {};
    case 'openTelegram':
      openExternal(TELEGRAM_URL);
      return {};
    case 'openHomepage': {
      const url = String(payload.url || '');
      if (/^https:\/\//i.test(url)) openExternal(url);
      return {};
    }
    case 'reloadDev':
      await reloadDevPlugins();
      return {};
    default:
      return { ok: false, error: `Неизвестное действие: ${action}` };
  }
}

function init(options = {}) {
  if (initialized) return;
  initialized = true;
  safeMode = options.safeMode === true;
  onChange = typeof options.onChange === 'function' ? options.onChange : null;

  state.ensureDirs();

  host.init({
    onChange: () => safePublish(),
    onError: (id, message, options = {}) => {
      const record = getRecord(id);
      if (record) {
        record.lastError = message;
        if (options.crash) {
          const now = Date.now();
          const recent = now - (record.lastCrashAt || 0) < 10 * 60 * 1000;
          record.crashCount = recent ? (record.crashCount || 0) + 1 : 1;
          record.lastCrashAt = now;
          if (record.crashCount >= 3) {
            record.enabled = false;
            record.lastError = 'Автоотключён после 3 падений подряд';
            setTimeout(() => host.unload(id).catch(() => {}), 0);
          }
        }
        if (!record.dev) state.set(record);
      }
      toast(`${record?.name || id}: ${record?.lastError || message}`);
      safePublish();
    },
  });

  managerWindow.init({
    getState: managerState,
    dispatch: dispatchAction,
    onChange: () => safePublish(),
  });

  if (safeMode) {
    publishSummary();
    return;
  }

  loadInstalled()
    .catch((err) => console.warn('[octo] plugins load failed:', err.message))
    .finally(() => {
      loadDevPlugins();
      publishSummary();
    });
}

function dispose() {
  clearTimeout(devWatchTimer);
  if (devWatcher) {
    try {
      devWatcher.close();
    } catch {
      /* наблюдатель уже закрыт */
    }
    devWatcher = null;
  }
  docsWindow.close();
  managerWindow.close();
  host.unloadAll().catch(() => {});
}

async function suspend() {
  docsWindow.close();
  managerWindow.close();
  await host.unloadAll().catch(() => {});
  publishSummary();
}

async function resume() {
  if (!initialized || !ctx.win || safeMode) return;
  for (const record of devRecords) {
    if (record.enabled) await loadRecord(record, { silent: true });
  }
  await loadInstalled().catch(() => {});
  publishSummary();
}

function openManager() {
  managerWindow.open();
  publishSummary();
}

function closeManager() {
  managerWindow.close();
}

function onPageReady(info) {
  host.onPageReady(info);
}

function onPageNavigate(info) {
  host.onPageNavigate(info);
}

function onThemeChange(payload) {
  host.onThemeChange(payload);
}

function onPlaybackChange() {
  host.onPlaybackChange();
}

function cancelDialog() {
  host.cancelDialog();
}

function runCommand(commandId, payload) {
  return host.runCommand(commandId, payload);
}

function handleShortcut(input) {
  return host.handleShortcut(input);
}

function contextMenuItems(context) {
  return host.contextMenuItems(context);
}

function menuItems() {
  const records = allRecords().filter((record) => record.enabled === true);
  if (!records.length) return [{ label: 'Плагины не установлены', enabled: false }];

  return records.map((record) => {
    const entry = host.getHost(record.id);
    const registrations =
      entry && entry.active ? host.registrations(entry) : { commands: [], panelRows: [] };
    const items = [
      ...registrations.commands.map((command) => ({
        label: command.title,
        click: () => host.runCommand(`plugin:${record.id}:${command.id}`),
      })),
      ...registrations.panelRows.map((row) => ({
        label: row.label,
        click: () => host.runCommand(`plugin:${record.id}:row:${row.id}`),
      })),
    ];
    return {
      label: `${record.name}${record.version ? ` ${record.version}` : ''}`,
      submenu: items.length ? items : [{ label: 'Нет команд', enabled: false }],
    };
  });
}

function openFolder() {
  shell.openPath(state.pluginsDir());
}

function openDocs() {
  if (!docsWindow.openPage('index.html')) {
    toast('Документация не собрана — запустите npm run docs:build');
    openExternal(DOCS_URL);
  }
}

function openRules() {
  if (!docsWindow.openPage('publishing.html')) {
    toast('Документация не собрана — запустите npm run docs:build');
    openExternal(PUBLISHING_URL);
  }
}

module.exports = {
  registerScheme: host.registerScheme,
  init,
  dispose,
  suspend,
  resume,
  openManager,
  closeManager,
  onPageReady,
  onPageNavigate,
  onThemeChange,
  onPlaybackChange,
  cancelDialog,
  runCommand,
  handleShortcut,
  contextMenuItems,
  installFromFile,
  menuItems,
  openFolder,
  openDocs,
  openRules,
  getState: managerState,
  getSummary: () => ctx.plugins,
  setEnabled,
  setSettings: saveSettings,
  toggle: togglePlugin,
  reloadDevPlugins,
};
