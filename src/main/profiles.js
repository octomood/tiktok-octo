'use strict';

const crypto = require('node:crypto');
const { session } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { PARTITION } = require('./shared');
const { readState, writeState } = require('./store');

/**
 * Профили аккаунтов (изолированные сессии TikTok при общих настройках оболочки).
 *
 * Основной профиль использует исторический раздел `persist:octo-tiktok`, чтобы
 * существующие пользователи не потеряли вход. Дополнительные профили получают
 * `persist:octo-tiktok-<id>` и переключаются «на лету» пересозданием view.
 */

const DEFAULT_ID = 'default';
const DEFAULT_NAME = 'Основной';
const MAX_PROFILES = 10;

let active = DEFAULT_ID;
let list = [{ id: DEFAULT_ID, name: DEFAULT_NAME, partition: PARTITION }];
let switcher = null;

function cleanName(raw, fallback = '') {
  return (
    String(raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40) || fallback
  );
}

function partitionFor(id) {
  return id === DEFAULT_ID ? PARTITION : `${PARTITION}-${id}`;
}

function readSettings() {
  const saved = readState().profiles;
  const value = saved && typeof saved === 'object' ? saved : {};
  const rawList = Array.isArray(value.list) ? value.list : [];

  const seen = new Set([DEFAULT_ID]);
  const defaultEntry = rawList.find((item) => item && item.id === DEFAULT_ID);
  const items = [
    {
      id: DEFAULT_ID,
      name: cleanName(defaultEntry?.name, DEFAULT_NAME),
      partition: PARTITION,
    },
  ];

  for (const item of rawList) {
    if (!item || typeof item.id !== 'string') continue;
    const id = item.id.replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      name: cleanName(item.name, `Аккаунт ${items.length}`),
      partition: partitionFor(id),
    });
    if (items.length >= MAX_PROFILES) break;
  }

  const savedActive = typeof value.active === 'string' ? value.active : DEFAULT_ID;
  const activeId = items.some((item) => item.id === savedActive) ? savedActive : DEFAULT_ID;
  return { active: activeId, list: items };
}

function sync() {
  const saved = readSettings();
  active = saved.active;
  list = saved.list;
  ctx.profiles = {
    active,
    list: list.map((item) => ({ id: item.id, name: item.name })),
  };
}

function save() {
  writeState({
    profiles: {
      active,
      list: list.map((item) => ({ id: item.id, name: item.name })),
    },
  });
  sync();
  pushState();
}

function activeProfile() {
  return list.find((item) => item.id === active) || list[0];
}

function activePartition() {
  return activeProfile().partition;
}

function setSwitcher(fn) {
  switcher = typeof fn === 'function' ? fn : null;
}

function switchTo(id) {
  const target = list.find((item) => item.id === id);
  if (!target || target.id === active) return false;
  active = target.id;
  save();
  if (switcher) switcher(target);
  toast(`Профиль «${target.name}»`);
  return true;
}

function create(name) {
  if (list.length >= MAX_PROFILES) {
    toast(`Максимум ${MAX_PROFILES} профилей`);
    return null;
  }
  const id = crypto.randomBytes(4).toString('hex');
  const entry = {
    id,
    name: cleanName(name, `Аккаунт ${list.length}`),
    partition: partitionFor(id),
  };
  list.push(entry);
  active = id;
  save();
  if (switcher) switcher(entry);
  toast(`Создан профиль «${entry.name}»`);
  return entry;
}

function rename(id, name) {
  const target = list.find((item) => item.id === id);
  if (!target) return false;
  const next = cleanName(name);
  if (!next) return false;
  target.name = next;
  save();
  return true;
}

function remove(id) {
  if (id === DEFAULT_ID) {
    toast('Основной профиль нельзя удалить');
    return false;
  }
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const [removed] = list.splice(index, 1);
  const wasActive = active === id;
  if (wasActive) active = DEFAULT_ID;
  save();

  try {
    session
      .fromPartition(removed.partition)
      .clearStorageData()
      .catch(() => {});
  } catch {
    /* сессия не инициализирована */
  }

  if (wasActive && switcher) switcher(activeProfile());
  toast(`Профиль «${removed.name}» удалён`);
  return true;
}

sync();

module.exports = {
  DEFAULT_ID,
  MAX_PROFILES,
  sync,
  activeProfile,
  activePartition,
  setSwitcher,
  switchTo,
  create,
  rename,
  remove,
};
