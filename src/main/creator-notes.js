'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * Локальные заметки и теги к авторам TikTok.
 *
 * Позволяют подписывать профили и авторов роликов («монтаж», «референс» и т.д.)
 * без отправки данных наружу.
 */

const MAX_NOTES = 500;
const MAX_TAGS = 10;

let notesMap = {};

function normalizeAuthor(raw) {
  const clean = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  if (!clean || !/^[a-z0-9._-]{1,64}$/i.test(clean)) return '';
  return `@${clean}`;
}

function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set();
  const result = [];
  for (const tag of list) {
    const clean = String(tag || '')
      .trim()
      .replace(/^#+/, '')
      .slice(0, 32);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

function readSettings() {
  const saved = readState().creatorNotes;
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const result = {};
  let count = 0;

  for (const [key, value] of Object.entries(source)) {
    const author = normalizeAuthor(key);
    if (!author || !value || typeof value !== 'object') continue;
    const note = typeof value.note === 'string' ? value.note.trim().slice(0, 500) : '';
    const tags = normalizeTags(value.tags);
    if (!note && tags.length === 0) continue;
    result[author] = {
      author,
      note,
      tags,
      updatedAt: Number(value.updatedAt) || Date.now(),
    };
    count += 1;
    if (count >= MAX_NOTES) break;
  }
  return result;
}

function listItems() {
  return Object.values(notesMap)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((entry) => ({
      author: entry.author,
      note: entry.note,
      tags: entry.tags.slice(),
      updatedAt: entry.updatedAt,
    }));
}

function sync() {
  notesMap = readSettings();
  ctx.creatorNotes = listItems();
}

function save() {
  writeState({ creatorNotes: notesMap });
  ctx.creatorNotes = listItems();
  pushState();
}

function set(rawAuthor, payload = {}) {
  const author = normalizeAuthor(rawAuthor);
  if (!author) {
    toast('Укажите имя автора (например, @username)');
    return false;
  }
  const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 500) : '';
  const tags = normalizeTags(payload.tags);

  if (!note && tags.length === 0) {
    return remove(author);
  }

  if (!notesMap[author] && Object.keys(notesMap).length >= MAX_NOTES) {
    toast(`Максимум ${MAX_NOTES} заметок к авторам`);
    return false;
  }

  notesMap[author] = {
    author,
    note,
    tags,
    updatedAt: Date.now(),
  };
  save();
  toast(`Заметка для ${author} сохранена`);
  return true;
}

function remove(rawAuthor) {
  const author = normalizeAuthor(rawAuthor);
  if (!author || !notesMap[author]) return false;
  delete notesMap[author];
  save();
  toast(`Заметка для ${author} удалена`);
  return true;
}

function openAuthor(rawAuthor) {
  const author = normalizeAuthor(rawAuthor);
  if (!author) return false;
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  wc.loadURL(`https://www.tiktok.com/${author}`).catch(() => {});
  return true;
}

sync();

module.exports = { sync, set, remove, openAuthor, normalizeAuthor };
