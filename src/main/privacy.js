'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, clipboard, session } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const pluginsState = require('./plugins/state');
const { showMessageBox } = require('./dialogs');
const { PARTITION } = require('./shared');
const { backupDir } = require('./settings-transfer');

/**
 * Приватность и диагностика.
 *
 * Панель показывает, что приложение хранит локально и сколько это занимает,
 * позволяет удалить данные по пунктам и объясняет, что видит сайт TikTok.
 * Диагностика собирается без cookies, токенов, переписки и путей пользователя.
 */

const MAX_WALK = 20000;

let refreshing = null;
let initialized = false;

function byteSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  } catch {
    return 0;
  }
}

function directorySize(dir) {
  let total = 0;
  let seen = 0;
  const stack = [dir];

  while (stack.length && seen < MAX_WALK) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen += 1;
      if (seen > MAX_WALK) break;
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* файл исчез во время обхода */
        }
      }
    }
  }
  return total;
}

function backupCount() {
  try {
    return fs.readdirSync(backupDir()).filter((name) => name.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function siteInfo() {
  let cache = 0;
  let cookies = 0;
  try {
    const ses = session.fromPartition(require('./profiles').activePartition() || PARTITION);
    cache = await ses.getCacheSize();
    cookies = (await ses.cookies.get({})).length;
  } catch {
    /* сессия ещё не готова */
  }
  return { cache, cookies };
}

async function collect() {
  const state = readState();
  const saved = pluginsState.read();
  const plugins = Object.keys(saved.plugins || {}).length;
  const site = await siteInfo();
  const library = state.library && typeof state.library === 'object' ? state.library : {};
  const items = Array.isArray(library.items) ? library.items.length : 0;
  const queue = Array.isArray(library.queue) ? library.queue.length : 0;
  const days = state.stats?.days && typeof state.stats.days === 'object' ? state.stats.days : {};

  const rows = [
    {
      id: 'library',
      label: 'Библиотека и очередь',
      detail: `Закладок: ${items} · очередь: ${queue}`,
      bytes: byteSize(library),
      deletable: true,
    },
    {
      id: 'stats',
      label: 'Статистика просмотра',
      detail: `Дней: ${Object.keys(days).length}`,
      bytes: byteSize(state.stats),
      deletable: true,
    },
    {
      id: 'replies',
      label: 'Быстрые ответы',
      detail: `Шаблонов: ${Array.isArray(state.replies) ? state.replies.length : 0}`,
      bytes: byteSize(state.replies),
      deletable: true,
    },
    {
      id: 'ads',
      label: 'Журнал пропущенной рекламы',
      detail: `Записей: ${Array.isArray(state.adJournal) ? state.adJournal.length : 0}`,
      bytes: byteSize({ adsSkipped: state.adsSkipped, adJournal: state.adJournal }),
      deletable: true,
    },
    {
      id: 'site',
      label: 'Cookies и кэш TikTok',
      detail: `Cookies: ${site.cookies}`,
      bytes: site.cache,
      deletable: true,
    },
    {
      id: 'plugins',
      label: 'Плагины',
      detail: `Плагинов: ${plugins}`,
      bytes: directorySize(pluginsState.pluginsDir()),
      deletable: false,
    },
    {
      id: 'backups',
      label: 'Резервные копии',
      detail: `Копий: ${backupCount()}`,
      bytes: directorySize(backupDir()),
      deletable: true,
    },
  ];

  const totalBytes = rows.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0);
  ctx.privacy = { items: rows, totalBytes, updatedAt: Date.now() };
  pushState();
  return ctx.privacy;
}

function refresh() {
  if (!refreshing) {
    refreshing = collect().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function confirmDelete(label) {
  if (process.env.OCTO_E2E === '1') return true;
  const answer = await showMessageBox(ctx.win, {
    type: 'warning',
    title: 'Удаление данных',
    message: `Удалить «${label}»?`,
    detail: 'Это действие необратимо.',
    buttons: ['Удалить', 'Отмена'],
    defaultId: 0,
    cancelId: 1,
  });
  return answer.response === 0;
}

async function remove(id) {
  const item = (ctx.privacy?.items || []).find((entry) => entry.id === id);
  if (!item || !item.deletable) return { ok: false, error: 'Эти данные нельзя удалить' };

  // Cookies и кэш сайта уже спрашивают подтверждение и умеют чистить сессию.
  if (id === 'site') {
    await require('./region').resetSiteData();
    await refresh();
    return { ok: true };
  }

  if (!(await confirmDelete(require('./i18n').t(item.label)))) {
    return { ok: false, canceled: true };
  }

  try {
    if (id === 'library') {
      const library = readState().library;
      writeState({
        library: { items: [], queue: [], auto: library && library.auto === true },
      });
      require('./library').sync();
    } else if (id === 'stats') {
      require('./stats').reset();
    } else if (id === 'replies') {
      writeState({ replies: [] });
      require('./replies').sync();
    } else if (id === 'ads') {
      require('./ads').resetCounter();
    } else if (id === 'backups') {
      fs.rmSync(backupDir(), { recursive: true, force: true });
      ctx.backups = { latest: '', count: 0 };
    } else {
      return { ok: false, error: 'Неизвестный раздел' };
    }

    await refresh();
    toast('Данные удалены');
    return { ok: true };
  } catch (err) {
    toast(`Не удалось удалить данные: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Убрать домашний каталог и похожие на секреты значения из текста. */
function sanitizeText(value) {
  let text = String(value || '');
  const roots = [app.getPath('userData'), os.homedir(), app.getPath('home')].filter(Boolean);
  for (const root of roots) {
    text = text.split(root).join('~');
    text = text.split(root.replaceAll('\\', '/')).join('~');
  }
  text = text.replace(
    /((?:token|secret|password|passwd|api[_-]?key|cookie|authorization)\s*[:=]\s*)[^\s,;]+/gi,
    '$1<скрыто>',
  );
  return text;
}

function buildDiagnostics() {
  const state = readState();
  const plugins = pluginsState.list();
  const lines = [
    `TikTok Octo ${app.getVersion()}`,
    `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    `Node ${process.versions.node} · V8 ${process.versions.v8}`,
    `ОС: ${process.platform} ${process.arch} · ${os.release()}`,
    `Профиль: ${app.getPath('userData')}`,
    `Язык: ${state.language || 'ru'} · TikTok: ${state.siteLanguage || 'auto'}`,
    `Регион: ${state.region?.preset || 'off'} · прокси: ${state.region?.proxy ? 'включён' : 'нет'}`,
    `Тема: ${state.cosmetics?.['dark-theme'] === false ? 'светлая' : 'тёмная'}`,
    `Режим: ${ctx.safeMode ? 'безопасный' : 'обычный'}`,
    `Питание: ${ctx.onBattery ? 'батарея' : 'сеть'}${ctx.eco ? ' · экономный режим' : ''}`,
    `Фильтры: ${state.filters?.enabled === true ? 'включены' : 'выключены'}`,
    `Свой код: ${state.customCode?.enabled === true ? 'включён' : 'выключен'}`,
    `Клавиатурная лента: ${state.feedKeys === false ? 'выключена' : 'включена'}`,
    `Библиотека: ${Array.isArray(state.library?.items) ? state.library.items.length : 0} · очередь: ${
      Array.isArray(state.library?.queue) ? state.library.queue.length : 0
    }`,
    `Статистика: ${Object.keys(state.stats?.days || {}).length} дней`,
    `Резервные копии: ${backupCount()}`,
    `Плагины: ${plugins.length}`,
    ...plugins.map(
      (plugin) =>
        `  ${plugin.id} ${plugin.version || '?'} · ${plugin.enabled === false ? 'выкл' : 'вкл'}`,
    ),
    '',
    'Cookies, токены, переписка и адреса страниц не включены.',
  ];
  return sanitizeText(lines.join('\n'));
}

function stamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function copyDiagnostics() {
  const text = buildDiagnostics();
  if (process.env.OCTO_DIAGNOSTICS_DIR) {
    try {
      fs.mkdirSync(process.env.OCTO_DIAGNOSTICS_DIR, { recursive: true });
      const name = `tiktok-octo-diagnostics-${stamp()}.txt`;
      const file = path.join(process.env.OCTO_DIAGNOSTICS_DIR, name);
      fs.writeFileSync(file, `${text}\n`, { encoding: 'utf8', mode: 0o600 });
      toast(`Диагностика сохранена: ${name}`);
      return { ok: true, file };
    } catch (err) {
      toast(`Не удалось сохранить диагностику: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  try {
    clipboard.writeText(text);
    toast('Диагностика скопирована');
    return { ok: true };
  } catch (err) {
    toast(`Не удалось сохранить диагностику: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function licenseOf(info) {
  if (typeof info.license === 'string') return info.license;
  if (info.license && typeof info.license.type === 'string') return info.license.type;
  if (Array.isArray(info.licenses)) {
    const list = info.licenses
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter(Boolean);
    if (list.length) return list.join(', ');
  }
  return 'лицензия не найдена';
}

function licensesText() {
  const root = app.getAppPath();
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    manifest = {};
  }

  const lines = [
    'TikTok Octo — MIT',
    'Electron — MIT',
    'Chromium — BSD-3-Clause и другие открытые лицензии',
    '',
    'Зависимости:',
  ];
  for (const name of Object.keys(manifest.dependencies || {}).sort()) {
    try {
      const info = JSON.parse(
        fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'),
      );
      lines.push(`${name} ${info.version || ''} — ${licenseOf(info)}`);
    } catch {
      lines.push(`${name} — лицензия не найдена`);
    }
  }
  lines.push('', 'Полные тексты лицензий лежат в пакетах зависимостей.');
  return lines.join('\n');
}

function writeE2eFile(name, text) {
  if (process.env.OCTO_E2E !== '1' || !process.env.OCTO_DIAGNOSTICS_DIR) return false;
  fs.mkdirSync(process.env.OCTO_DIAGNOSTICS_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.OCTO_DIAGNOSTICS_DIR, name), `${text}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return true;
}

async function showLicenses() {
  const text = licensesText();
  if (writeE2eFile('licenses.txt', text)) return { ok: true, file: 'licenses.txt' };
  await showMessageBox(ctx.win, {
    type: 'info',
    title: 'Лицензии',
    message: 'Лицензии TikTok Octo',
    detail: text,
    buttons: ['ОК'],
  });
  return { ok: true };
}

async function showDisclaimer() {
  const lines = [
    'TikTok Octo — независимый клиент, сделанный пользователями. Он не связан с TikTok Ltd., ByteDance и их продуктами, не одобрен ими и не использует приватные API, обход подписей или scraping cookies.',
    'Приложение открывает обычные страницы TikTok как браузер. Сайт видит стандартные запросы: IP, cookies, язык и регион, которые вы выбрали. Ваши файлы, библиотека и статистика остаются на устройстве и никуда не отправляются.',
    'TikTok и связанные знаки принадлежат их владельцам.',
  ];
  if (writeE2eFile('disclaimer.txt', lines.join('\n\n'))) return { ok: true };
  await showMessageBox(ctx.win, {
    type: 'info',
    title: 'Не связан с TikTok',
    message: 'TikTok Octo — неофициальный клиент',
    detail: lines.join('\n\n'),
    buttons: ['Понятно'],
  });
  return { ok: true };
}

function init() {
  if (initialized) return;
  initialized = true;
  refresh().catch(() => {});
}

module.exports = {
  init,
  refresh,
  remove,
  buildDiagnostics,
  sanitizeText,
  copyDiagnostics,
  licensesText,
  showLicenses,
  showDisclaimer,
  byteSize,
  directorySize,
  backupDir,
};
