'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { app, dialog } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { isTikTokUrl, authorFromUrl } = require('./shared');
const player = require('./player');

/**
 * Библиотека: закладки с таймкодом и заметкой, очередь «посмотреть позже»,
 * поиск и экспорт. Всё хранится локально в состоянии приложения, никаких
 * запросов к TikTok.
 */

const MAX_ITEMS = 500;

let items = [];
let queue = [];
let auto = false;
let pendingSeek = null;
let currentId = null;
let pollTimer = null;
let lastEnded = null;
/** После openItem() ждём коммита адреса, а не сравниваем его сразу. */
let awaitingUrl = null;
let checking = false;

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\s*[|—–]\s*TikTok\s*$/i, '')
    .replace(/^TikTok\s*[-–—]\s*/i, '')
    .trim()
    .slice(0, 160);
}

function readSettings() {
  const saved = readState().library;
  const value = saved && typeof saved === 'object' ? saved : {};
  const savedItems = Array.isArray(value.items) ? value.items : [];
  const savedQueue = Array.isArray(value.queue) ? value.queue : [];

  const clean = savedItems
    .filter((item) => item && typeof item.url === 'string' && isTikTokUrl(item.url))
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      url: item.url,
      author: typeof item.author === 'string' ? item.author : '',
      title: typeof item.title === 'string' ? item.title : '',
      time: Math.max(0, Number(item.time) || 0),
      note: typeof item.note === 'string' ? item.note.slice(0, 500) : '',
      savedAt: Number(item.savedAt) || Date.now(),
    }));

  const ids = new Set(clean.map((item) => item.id));
  return {
    items: clean,
    queue: savedQueue.filter((id) => typeof id === 'string' && ids.has(id)),
    auto: value.auto === true,
  };
}

function publicState() {
  return {
    items: items.map((item) => ({ ...item })),
    queue: queue.slice(),
    auto,
  };
}

function snapshot() {
  return publicState();
}

function sync() {
  const saved = readSettings();
  items = saved.items;
  queue = saved.queue;
  auto = saved.auto === true;
  ctx.library = publicState();
}

function save() {
  writeState({ library: { items, queue, auto } });
  ctx.library = publicState();
  pushState();
}

function currentVideo() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return null;
  // Тесты подменяют адрес, чтобы не открывать настоящий TikTok.
  const url = process.env.OCTO_LIBRARY_URL || wc.getURL();
  if (!isTikTokUrl(url)) return null;
  return { url, author: authorFromUrl(url), title: cleanTitle(wc.getTitle()) };
}

async function addCurrent({ queue: toQueue = false } = {}) {
  const video = currentVideo();
  if (!video) {
    toast('Откройте ролик TikTok, чтобы сохранить его');
    return null;
  }

  const info = await player.status();
  const time = info ? Math.max(0, Math.round(Number(info.time) || 0)) : 0;
  const existing = items.find((item) => item.url === video.url && Math.abs(item.time - time) < 2);
  if (existing) {
    toast('Этот ролик с этой секунды уже сохранён');
    return existing;
  }

  const item = {
    id: crypto.randomUUID(),
    url: video.url,
    author: video.author,
    title: video.title,
    time,
    note: '',
    savedAt: Date.now(),
  };
  items.unshift(item);
  items = items.slice(0, MAX_ITEMS);
  if (toQueue) queue.unshift(item.id);
  save();
  toast(toQueue ? 'Добавлено в «Посмотреть позже»' : 'Ролик сохранён в библиотеку');
  return item;
}

function remove(id) {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  queue = queue.filter((entry) => entry !== id);
  if (currentId === id) stopAuto();
  save();
}

function setNote(id, note) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.note = String(note || '').slice(0, 500);
  save();
}

function toggleQueue(id) {
  if (!items.some((item) => item.id === id)) return;
  queue = queue.includes(id) ? queue.filter((entry) => entry !== id) : [id, ...queue];
  save();
  toast(queue.includes(id) ? 'Добавлено в очередь' : 'Убрано из очереди');
}

function clearQueue() {
  if (!queue.length) return;
  queue = [];
  stopAuto();
  save();
  toast('Очередь очищена');
}

/** Автопереход: пока играет запись из очереди, следим за концом ролика. */
function stopAuto() {
  currentId = null;
  lastEnded = null;
  awaitingUrl = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** TikTok добавляет к адресу query/hash — сравниваем саму страницу. */
function samePage(current, saved) {
  try {
    const left = new URL(current);
    const right = new URL(saved);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return current === saved;
  }
}

function advanceQueue() {
  const index = queue.indexOf(currentId);
  if (index === -1) {
    stopAuto();
    return false;
  }
  const next = queue[index + 1];
  if (!next) {
    stopAuto();
    toast('Очередь закончилась');
    return false;
  }
  return openItem(next);
}

async function checkQueue() {
  if (checking) return;
  checking = true;
  try {
    if (!auto || !currentId) return;
    const wc = ctx.view?.webContents;
    const item = items.find((entry) => entry.id === currentId);
    if (!wc || wc.isDestroyed() || !item) {
      stopAuto();
      return;
    }

    if (!samePage(wc.getURL(), item.url)) {
      // Страница ещё грузится после openItem(): адрес коммитится позже тика,
      // а TikTok может добавить query. В это время старую страницу не читаем,
      // иначе счётчик ended старого ролика станет базой для нового.
      if (awaitingUrl && Date.now() < awaitingUrl.until) return;
      stopAuto();
      return;
    }
    awaitingUrl = null;

    const info = await player.status();
    if (currentId !== item.id) return;
    if (!info) return;
    if (lastEnded === null) {
      lastEnded = Number(info.ended) || 0;
      return;
    }
    if (Number(info.ended) > lastEnded) {
      lastEnded = Number(info.ended);
      advanceQueue();
    }
  } finally {
    checking = false;
  }
}

function startAuto() {
  if (!auto || !currentId || pollTimer) return;
  lastEnded = null;
  pollTimer = setInterval(checkQueue, 1200);
  if (typeof pollTimer.unref === 'function') pollTimer.unref();
}

function toggleAuto() {
  auto = !auto;
  save();
  if (!auto) {
    stopAuto();
    toast('Автопереход выключен');
    return;
  }

  // Если сейчас играет ролик из очереди, подхватываем его без перезагрузки.
  const wc = ctx.view?.webContents;
  const url = wc && !wc.isDestroyed() ? wc.getURL() : '';
  const current = queue
    .map((id) => items.find((item) => item.id === id))
    .find((item) => item && samePage(item.url, url));
  currentId = current ? current.id : null;
  startAuto();
  toast('Автопереход по очереди включён');
}

/** Открыть сохранённый ролик и вернуться на его секунду. */
function openItem(id) {
  const item = items.find((entry) => entry.id === id);
  const wc = ctx.view?.webContents;
  if (!item || !wc || wc.isDestroyed()) return false;

  pendingSeek = { url: item.url, time: item.time };
  currentId = item.id;
  lastEnded = null;
  awaitingUrl = { url: item.url, until: Date.now() + 20_000 };
  startAuto();
  wc.loadURL(item.url)
    .then(() => {
      setTimeout(() => {
        if (!pendingSeek || pendingSeek.url !== item.url) return;
        pendingSeek = null;
        if (item.time > 0) player.seekTo(item.time);
      }, 1200);
    })
    .catch(() => {
      pendingSeek = null;
    });
  return true;
}

/** Первая запись очереди — кнопка «посмотреть позже» в панели. */
function openNext() {
  const id = queue[0];
  if (!id) {
    toast('Очередь пуста');
    return false;
  }
  return openItem(id);
}

function stamp(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatDate(value) {
  const date = new Date(Number(value) || Date.now());
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function buildMarkdown(list) {
  const lines = ['# TikTok Octo — библиотека', ''];
  if (!list.length) lines.push('Пока пусто.');
  for (const item of list) {
    const title = item.title || item.url;
    lines.push(`- [${title}](${item.url})`);
    lines.push(
      `  ${item.author ? `@${item.author} · ` : ''}${stamp(item.time)} · ${formatDate(item.savedAt)}`,
    );
    if (item.note) lines.push(`  > ${item.note.replace(/\n/g, '\n  > ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildJson(list) {
  return `${JSON.stringify(
    {
      app: 'TikTok Octo',
      exportedAt: new Date().toISOString(),
      items: list.map((item) => ({ ...item })),
      queue: queue.slice(),
    },
    null,
    2,
  )}\n`;
}

/** Экспорт в файл: тесты пишут в OCTO_EXPORT_DIR, люди — через диалог. */
async function exportLibrary(format) {
  const id = format === 'md' || format === 'json' ? format : 'json';
  const content = id === 'md' ? buildMarkdown(items) : buildJson(items);
  const name = `tiktok-octo-library.${id}`;

  try {
    if (process.env.OCTO_EXPORT_DIR) {
      fs.mkdirSync(process.env.OCTO_EXPORT_DIR, { recursive: true });
      const file = path.join(process.env.OCTO_EXPORT_DIR, name);
      fs.writeFileSync(file, content, 'utf8');
      toast(`Библиотека экспортирована: ${name}`);
      return file;
    }

    const result = await dialog.showSaveDialog(ctx.win, {
      title: 'Экспорт библиотеки',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: id === 'json' ? 'JSON' : 'Markdown', extensions: [id] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, 'utf8');
    toast('Библиотека экспортирована');
    return result.filePath;
  } catch (err) {
    toast(`Не удалось экспортировать: ${err.message}`);
    return null;
  }
}

sync();

module.exports = {
  sync,
  snapshot,
  buildMarkdown,
  buildJson,
  addCurrent,
  remove,
  setNote,
  toggleQueue,
  clearQueue,
  openItem,
  openNext,
  toggleAuto,
  exportLibrary,
};
