'use strict';

const { app, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { authorFromUrl } = require('./shared');
const { buildPath } = require('./download-name');

/**
 * Менеджер загрузок.
 *
 * Сайт умеет только «сохранить файл» через системный диалог. Мы добавляем
 * очередь: лимит одновременных, паузу/продолжить, прогресс, отмену и
 * «показать в папке». Имя файла можно собирать по шаблону
 * `{author}-{date}-{title}` с транслитерацией и папкой автора.
 */

const DEFAULTS = {
  auto: false,
  template: '{author}-{date}-{title}',
  folderPerAuthor: false,
  limit: 2,
};

let sequence = 0;
let settings = { ...DEFAULTS };
/** @type {Map<string, Electron.DownloadItem>} */
const items = new Map();
/** Загрузки, приостановленные лимитом (не пользователем). */
const queued = [];

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\s*[|—–]\s*TikTok\s*$/i, '')
    .replace(/^TikTok\s*[-–—]\s*/i, '')
    .trim();
}

function readSettings() {
  const saved = readState().downloadNaming;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    auto: value.auto === true,
    template:
      typeof value.template === 'string' && value.template.trim()
        ? value.template.slice(0, 160)
        : DEFAULTS.template,
    folderPerAuthor: value.folderPerAuthor === true,
    limit: Math.min(5, Math.max(1, Math.round(Number(value.limit) || DEFAULTS.limit))),
  };
}

function sync() {
  settings = readSettings();
  ctx.downloadNaming = { ...settings };
}

function save(patch) {
  writeState({ downloadNaming: { ...readSettings(), ...patch } });
  sync();
  pushState();
}

function setAuto(value) {
  save({ auto: value === true });
}

function setTemplate(value) {
  save({ template: String(value || '').slice(0, 160) || DEFAULTS.template });
}

function toggleFolder() {
  save({ folderPerAuthor: !settings.folderPerAuthor });
}

function setLimit(value) {
  save({ limit: Math.min(5, Math.max(1, Math.round(Number(value) || DEFAULTS.limit))) });
  releaseQueue();
}

function activeSummary() {
  const active = ctx.downloads.find((entry) => entry.state === 'progressing');
  return active ? { name: active.name, percent: active.percent } : null;
}

function refresh() {
  ctx.download = activeSummary();
  pushState();
  updateTaskbarProgress();
  try {
    // Окно менеджера живёт отдельно и получает тот же список.
    require('./downloads-window').push();
  } catch {
    /* окно менеджера ещё не открывали */
  }
}

/** Прогресс на иконке: Windows taskbar и Linux Unity/лончер. */
function updateTaskbarProgress() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  const active = ctx.downloads.filter((entry) => entry.state === 'progressing');
  let value = -1;
  if (active.length) {
    const total = active.reduce((sum, entry) => sum + (Number(entry.totalBytes) || 0), 0);
    const received = active.reduce((sum, entry) => sum + (Number(entry.receivedBytes) || 0), 0);
    value =
      total > 0
        ? Math.min(1, Math.max(0, received / total))
        : Math.min(1, Math.max(0, (Number(active[0].percent) || 0) / 100));
  }
  try {
    ctx.win.setProgressBar(value);
  } catch {
    /* платформа не поддерживает индикатор */
  }
}

function patch(id, changes) {
  const entry = ctx.downloads.find((candidate) => candidate.id === id);
  if (!entry) return;
  Object.assign(entry, changes);
  refresh();
}

function entryOf(id) {
  return ctx.downloads.find((candidate) => candidate.id === id);
}

/** Освободилось место — продолжаем первую загрузку из очереди. */
function releaseQueue() {
  while (queued.length) {
    const active = ctx.downloads.filter((entry) => entry.state === 'progressing').length;
    if (active >= settings.limit) return;

    const id = queued.shift();
    const item = items.get(id);
    const entry = entryOf(id);
    if (!item || !entry) continue;
    try {
      item.resume();
      patch(id, { state: 'progressing' });
    } catch {
      /* загрузка уже завершилась */
    }
  }
}

/** Путь по шаблону: без диалога, с папкой автора и расширением оригинала. */
function autoPath(item, entry, original) {
  const wc = ctx.view?.webContents;
  const url = wc && !wc.isDestroyed() ? wc.getURL() : '';
  const ext = path.extname(original).slice(1);
  const { directory, file } = buildPath({
    template: settings.template,
    folderPerAuthor: settings.folderPerAuthor,
    baseDir: app.getPath('downloads'),
    info: {
      author: authorFromUrl(url),
      title: cleanTitle(wc && !wc.isDestroyed() ? wc.getTitle() : ''),
      ext,
      fallback: path.basename(original, path.extname(original)),
    },
  });

  try {
    fs.mkdirSync(directory, { recursive: true });
    item.setSavePath(path.join(directory, file));
    entry.name = file;
    return true;
  } catch {
    return false;
  }
}

function handle(item) {
  const id = `dl-${(sequence += 1)}`;
  const original = item.getFilename();
  items.set(id, item);

  const entry = {
    id,
    name: original,
    percent: 0,
    state: 'progressing',
    path: '',
    totalBytes: item.getTotalBytes(),
    receivedBytes: 0,
  };
  ctx.downloads.push(entry);

  const activeCount = ctx.downloads.filter((candidate) => candidate.state === 'progressing').length;
  const overLimit = activeCount > settings.limit;

  if (settings.auto) {
    autoPath(item, entry, original);
  }
  if (!settings.auto) {
    item.setSaveDialogOptions({
      title: 'Сохранить файл',
      defaultPath: path.join(app.getPath('downloads'), entry.name),
    });
  }

  refresh();

  if (overLimit) {
    try {
      item.pause();
      entry.state = 'queued';
      queued.push(id);
      refresh();
    } catch {
      /* без паузы загрузка просто идёт дальше */
    }
  }

  let lastPercent = -1;
  item.on('updated', (_event, state) => {
    if (state !== 'progressing') return;
    const total = item.getTotalBytes();
    const received = item.getReceivedBytes();
    const percent = total > 0 ? Math.round((received / total) * 100) : 0;
    if (percent === lastPercent) return;
    lastPercent = percent;
    const patchEntry = { percent, totalBytes: total, receivedBytes: received };
    if (entry.state === 'progressing') patchEntry.state = 'progressing';
    patch(id, patchEntry);
  });

  item.once('done', (_event, state) => {
    const finalState =
      state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed';
    patch(id, {
      state: finalState,
      path: item.getSavePath() || '',
      percent: finalState === 'completed' ? 100 : undefined,
    });

    const index = queued.indexOf(id);
    if (index !== -1) queued.splice(index, 1);
    releaseQueue();

    if (finalState === 'completed') toast('Загрузка завершена');
    else if (finalState === 'cancelled') toast('Загрузка отменена');
    else toast('Загрузка прервана');
  });
}

function cancel(id) {
  const item = items.get(id);
  if (!item) return;
  const index = queued.indexOf(id);
  if (index !== -1) queued.splice(index, 1);
  try {
    item.cancel();
  } catch {
    /* уже завершилась */
  }
}

function pause(id) {
  const item = items.get(id);
  const entry = entryOf(id);
  if (!item || !entry || entry.state !== 'progressing') return;
  try {
    item.pause();
    patch(id, { state: 'paused' });
  } catch {
    /* загрузка уже завершилась */
  }
}

function resume(id) {
  const item = items.get(id);
  const entry = entryOf(id);
  if (!item || !entry || (entry.state !== 'paused' && entry.state !== 'queued')) return;
  const index = queued.indexOf(id);
  if (index !== -1) queued.splice(index, 1);
  try {
    item.resume();
    patch(id, { state: 'progressing' });
  } catch {
    /* загрузка уже завершилась */
  }
}

function showInFolder(id) {
  const item = items.get(id);
  const filePath = item?.getSavePath?.();
  if (filePath) shell.showItemInFolder(filePath);
}

/** Убирает из списка всё, что уже не качается. Активные не трогаем. */
function clearFinished() {
  const finished = ctx.downloads.filter(
    (entry) =>
      entry.state !== 'progressing' && entry.state !== 'paused' && entry.state !== 'queued',
  );
  for (const entry of finished) items.delete(entry.id);
  ctx.downloads = ctx.downloads.filter(
    (entry) =>
      entry.state === 'progressing' || entry.state === 'paused' || entry.state === 'queued',
  );
  refresh();
}

sync();

module.exports = {
  handle,
  cancel,
  pause,
  resume,
  showInFolder,
  clearFinished,
  setAuto,
  setTemplate,
  toggleFolder,
  setLimit,
  sync,
};
