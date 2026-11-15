'use strict';

const { app, shell } = require('electron');
const path = require('node:path');
const { ctx, pushState, toast } = require('./app-context');

/**
 * Менеджер загрузок.
 *
 * Сайт умеет только «сохранить файл» через системный диалог. Мы оставляем
 * диалог, но добавляем очередь: прогресс, отмену, «показать в папке» и список
 * завершённых за сессию.
 */

let sequence = 0;
/** @type {Map<string, Electron.DownloadItem>} */
const items = new Map();

function activeSummary() {
  const active = ctx.downloads.find((entry) => entry.state === 'progressing');
  return active ? { name: active.name, percent: active.percent } : null;
}

function refresh() {
  ctx.download = activeSummary();
  pushState();
}

function patch(id, changes) {
  const entry = ctx.downloads.find((candidate) => candidate.id === id);
  if (!entry) return;
  Object.assign(entry, changes);
  refresh();
}

function handle(item) {
  const id = `dl-${(sequence += 1)}`;
  const name = item.getFilename();
  items.set(id, item);

  ctx.downloads.push({
    id,
    name,
    percent: 0,
    state: 'progressing',
    path: '',
    totalBytes: item.getTotalBytes(),
    receivedBytes: 0,
  });
  refresh();

  item.setSaveDialogOptions({
    title: 'Сохранить файл',
    defaultPath: path.join(app.getPath('downloads'), name),
  });

  let lastPercent = -1;
  item.on('updated', (_event, state) => {
    if (state !== 'progressing') return;
    const total = item.getTotalBytes();
    const received = item.getReceivedBytes();
    const percent = total > 0 ? Math.round((received / total) * 100) : 0;
    if (percent === lastPercent) return;
    lastPercent = percent;
    patch(id, { percent, totalBytes: total, receivedBytes: received });
  });

  item.once('done', (_event, state) => {
    const finalState =
      state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed';
    patch(id, {
      state: finalState,
      path: item.getSavePath() || '',
      percent: finalState === 'completed' ? 100 : undefined,
    });

    if (finalState === 'completed') toast('Загрузка завершена');
    else if (finalState === 'cancelled') toast('Загрузка отменена');
    else toast('Загрузка прервана');
  });
}

function cancel(id) {
  const item = items.get(id);
  if (!item) return;
  try {
    item.cancel();
  } catch {
    /* уже завершилась */
  }
}

function showInFolder(id) {
  const item = items.get(id);
  const filePath = item?.getSavePath?.();
  if (filePath) shell.showItemInFolder(filePath);
}

/** Убирает из списка всё, что уже не качается. Активные не трогаем. */
function clearFinished() {
  const finished = ctx.downloads.filter((entry) => entry.state !== 'progressing');
  for (const entry of finished) items.delete(entry.id);
  ctx.downloads = ctx.downloads.filter((entry) => entry.state === 'progressing');
  refresh();
}

module.exports = { handle, cancel, showInFolder, clearFinished };
