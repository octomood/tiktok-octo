'use strict';

const crypto = require('node:crypto');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { isTikTokUrl, authorFromUrl } = require('./shared');

/**
 * Локальная история просмотров (Watch History).
 *
 * Записывает только адреса просмотренных роликов TikTok, их автора и
 * заголовок страницы. Хранится локально в octo-state.json.
 */

const MAX_ITEMS = 300;

let items = [];

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\s*[|—–]\s*TikTok\s*$/i, '')
    .replace(/^TikTok\s*[-–—]\s*/i, '')
    .trim()
    .slice(0, 160);
}

function isVideoUrl(rawUrl) {
  return isTikTokUrl(rawUrl) && /\/(?:video|photo)\/\d+/.test(rawUrl);
}

function readSettings() {
  const saved = readState().watchHistory;
  const list = Array.isArray(saved) ? saved : [];
  return list
    .filter((entry) => entry && typeof entry.url === 'string' && isVideoUrl(entry.url))
    .slice(0, MAX_ITEMS)
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
      url: entry.url,
      author: typeof entry.author === 'string' ? entry.author : authorFromUrl(entry.url),
      title: typeof entry.title === 'string' ? entry.title.slice(0, 160) : '',
      watchedAt: Number(entry.watchedAt) || Date.now(),
    }));
}

function sync() {
  items = readSettings();
  ctx.history = items.map((entry) => ({ ...entry }));
}

function save() {
  writeState({ watchHistory: items });
  ctx.history = items.map((entry) => ({ ...entry }));
  pushState();
}

function noteVideo(rawUrl, rawTitle) {
  const url = typeof rawUrl === 'string' ? rawUrl : ctx.view?.webContents?.getURL() || '';
  if (!isVideoUrl(url)) return;

  const title = cleanTitle(rawTitle || ctx.view?.webContents?.getTitle() || '');
  const author = authorFromUrl(url);
  const existingIndex = items.findIndex((entry) => entry.url === url);

  if (existingIndex === 0) {
    items[0].watchedAt = Date.now();
    if (title && !items[0].title) items[0].title = title;
    save();
    return;
  }

  let entry;
  if (existingIndex > 0) {
    [entry] = items.splice(existingIndex, 1);
    entry.watchedAt = Date.now();
    if (title) entry.title = title;
  } else {
    entry = {
      id: crypto.randomUUID(),
      url,
      author,
      title,
      watchedAt: Date.now(),
    };
  }

  items.unshift(entry);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  save();
}

function updateTitle(rawUrl, rawTitle) {
  if (!isVideoUrl(rawUrl)) return;
  const title = cleanTitle(rawTitle);
  if (!title) return;
  const target = items.find((entry) => entry.url === rawUrl);
  if (!target || target.title === title) return;
  target.title = title;
  save();
}

function open(id) {
  const target = items.find((entry) => entry.id === id);
  if (!target) return false;
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  wc.loadURL(target.url).catch(() => {});
  return true;
}

function remove(id) {
  const next = items.filter((entry) => entry.id !== id);
  if (next.length === items.length) return false;
  items = next;
  save();
  return true;
}

function clear() {
  if (items.length === 0) return;
  items = [];
  save();
  toast('История просмотров очищена');
}

sync();

module.exports = { sync, noteVideo, updateTitle, open, remove, clear };
