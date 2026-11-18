'use strict';

const path = require('node:path');
const { Notification } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { shouldNotify } = require('./notifications-policy');

/**
 * Нативные уведомления о новых сообщениях.
 *
 * Тип уведомления TikTok в заголовке не пишет — там только число
 * непрочитанных. Поэтому приложение честно уведомляет «в TikTok есть новое»
 * и открывает по клику панель сообщений; приватные запросы не нужны.
 */

const DEFAULTS = {
  enabled: false,
  dnd: false,
  dndFrom: '23:00',
  dndTo: '08:00',
  quietFocused: true,
};

// Не спамим: одно уведомление в 8 секунд, даже если счётчик скачет.
const COOLDOWN_MS = 8000;

let lastAt = 0;

function readSettings() {
  const saved = readState().notifications;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    ...DEFAULTS,
    ...value,
    enabled: value.enabled === true,
    dnd: value.dnd === true,
    quietFocused: value.quietFocused !== false,
    dndFrom: typeof value.dndFrom === 'string' ? value.dndFrom : DEFAULTS.dndFrom,
    dndTo: typeof value.dndTo === 'string' ? value.dndTo : DEFAULTS.dndTo,
  };
}

function sync() {
  ctx.notifications = readSettings();
}

function save(patch) {
  writeState({ notifications: { ...readSettings(), ...patch } });
  sync();
}

function toggle(key) {
  const next = !ctx.notifications[key];
  save({ [key]: next });
  pushState();

  if (key === 'enabled') {
    toast(next ? 'Уведомления включены' : 'Уведомления выключены');
  } else if (key === 'dnd') {
    toast(next ? 'Расписание «не беспокоить» включено' : 'Расписание «не беспокоить» выключено');
  } else if (key === 'quietFocused') {
    toast(next ? 'Активное окно не уведомляет' : 'Уведомления приходят и в активном окне');
  }
}

function setTime(key, value) {
  if (key !== 'dndFrom' && key !== 'dndTo') return;
  const time = typeof value === 'string' ? value.trim() : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  save({ [key]: time });
  pushState();
}

/** Счётчик непрочитанных вырос — возможно, стоит показать уведомление. */
function onUnread(previous, next) {
  if (!ctx.win || ctx.win.isDestroyed()) return;

  const settings = ctx.notifications || DEFAULTS;
  const now = new Date();
  const allowed = shouldNotify({
    ...settings,
    previous,
    next,
    focused: Boolean(ctx.win.isFocused()),
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
  });
  if (!allowed) return;
  if (Date.now() - lastAt < COOLDOWN_MS) return;
  lastAt = Date.now();

  try {
    if (!Notification.isSupported()) return;
    const note = new Notification({
      title: 'TikTok octo',
      body: next > 1 ? `Непрочитанных: ${next}` : 'Новое сообщение',
      icon: path.join(__dirname, '../../build/icon.png'),
    });
    note.on('click', () => {
      const { showWindow } = require('./tray');
      showWindow();
      require('./chat').open();
    });
    note.show();
  } catch {
    /* система не даёт показать уведомление */
  }
}

sync();

module.exports = { sync, toggle, setTime, onUnread };
