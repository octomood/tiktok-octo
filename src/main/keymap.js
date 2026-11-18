'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * Горячие клавиши.
 *
 * Команда → сочетание. Профиль — готовый набор сочетаний: «Стандартный»
 * (Ctrl+Shift для внутренних действий), «Компактный» (то же на Ctrl+Alt,
 * чтобы не спорить с сайтом) и «Свой», который начинается со стандартного.
 * Правки живут в выбранном профиле и переживают перезапуск.
 *
 * Сочетание без Ctrl/Alt не назначаем: иначе оно перехватывало бы обычный
 * ввод в комментариях и поиске. Исключение — функциональные клавиши F1–F12.
 */

const COMMANDS = [
  { id: 'back', label: 'Назад', keys: 'Alt+Left' },
  { id: 'forward', label: 'Вперёд', keys: 'Alt+Right' },
  { id: 'reload', label: 'Обновить', keys: 'Ctrl+R' },
  { id: 'hardReload', label: 'Обновить без кэша', keys: 'Ctrl+Shift+R' },
  { id: 'home', label: 'Главная', keys: 'Alt+Home' },
  { id: 'find', label: 'Поиск по странице', keys: 'Ctrl+F' },
  { id: 'findNext', label: 'Следующее совпадение', keys: 'F3' },
  { id: 'findPrev', label: 'Предыдущее совпадение', keys: 'Shift+F3' },
  { id: 'palette', label: 'Палитра команд', keys: 'Ctrl+K' },
  { id: 'panel', label: 'Меню клиента', keys: 'Ctrl+Shift+B' },
  { id: 'chat', label: 'Чат сбоку', keys: 'Ctrl+Shift+C' },
  { id: 'plugins', label: 'Менеджер плагинов', keys: 'Ctrl+Shift+E' },
  { id: 'pip', label: 'Картинка в картинке', keys: 'Ctrl+Shift+P' },
  { id: 'feedPrev', label: 'Предыдущее видео', keys: 'Ctrl+Shift+Left' },
  { id: 'feedNext', label: 'Следующее видео', keys: 'Ctrl+Shift+Right' },
  { id: 'screenshot', label: 'Снимок кадра', keys: 'Ctrl+Shift+S' },
  { id: 'mute', label: 'Звук вкл/выкл', keys: 'Ctrl+Shift+M' },
  { id: 'onTop', label: 'Поверх всех окон', keys: 'Ctrl+Shift+O' },
  { id: 'fullscreen', label: 'Полный экран', keys: 'F11' },
  { id: 'openInBrowser', label: 'Открыть в браузере', keys: 'Ctrl+Shift+U' },
  { id: 'zoomIn', label: 'Крупнее', keys: 'Ctrl+=' },
  { id: 'zoomOut', label: 'Мельче', keys: 'Ctrl+-' },
  { id: 'zoomReset', label: 'Масштаб 100 %', keys: 'Ctrl+0' },
  { id: 'devtools', label: 'Инструменты разработчика', keys: 'Ctrl+Shift+I' },
];

const PROFILES = [
  { id: 'default', label: 'Стандартный' },
  { id: 'compact', label: 'Компактный' },
  { id: 'custom', label: 'Свой' },
];

const MODIFIERS = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: 'Ctrl',
  meta: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
};

const NAMED_KEYS = {
  ' ': 'Space',
  Spacebar: 'Space',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Escape: 'Esc',
  '+': '=',
};

const NAMED = new Set([
  'Left',
  'Right',
  'Up',
  'Down',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Space',
  'Esc',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
]);

function defaultMap() {
  return Object.fromEntries(COMMANDS.map((command) => [command.id, command.keys]));
}

/** Компактный профиль: внутренние действия переезжают с Ctrl+Shift на Ctrl+Alt. */
function compactMap() {
  return Object.fromEntries(
    COMMANDS.map((command) => [command.id, command.keys.replace(/^Ctrl\+Shift\+/, 'Ctrl+Alt+')]),
  );
}

const PRESETS = {
  default: defaultMap(),
  compact: compactMap(),
  custom: defaultMap(),
};

function normalizeKey(key) {
  if (typeof key !== 'string' || !key) return '';
  if (NAMED_KEYS[key]) return NAMED_KEYS[key];
  if (NAMED.has(key)) return key;
  if (/^F\d{1,2}$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return '';
}

/** «ctrl+shift+p» и «Shift+Ctrl+P» → «Ctrl+Shift+P». */
function canonical(accelerator) {
  if (!accelerator) return '';
  const mods = new Set();
  let key = '';
  for (const raw of String(accelerator).split('+')) {
    const part = raw.trim();
    if (!part) continue;
    const modifier = MODIFIERS[part.toLowerCase()];
    if (modifier) mods.add(modifier);
    else key = normalizeKey(part);
  }
  if (!key) return '';
  return [...['Ctrl', 'Alt', 'Shift'].filter((modifier) => mods.has(modifier)), key].join('+');
}

/** Сочетание из события before-input-event. */
function acceleratorOf(input) {
  if (!input || typeof input.key !== 'string') return '';
  const key = normalizeKey(input.key);
  if (!key) return '';
  const mods = [];
  if (input.control || input.meta) mods.push('Ctrl');
  if (input.alt) mods.push('Alt');
  if (input.shift) mods.push('Shift');
  return [...mods, key].join('+');
}

/** Без Ctrl/Alt сочетание перехватывало бы обычный ввод. */
function assignable(keys) {
  if (!keys) return true;
  if (/^F\d{1,2}$/.test(keys)) return true;
  const mods = keys.split('+').slice(0, -1);
  return mods.includes('Ctrl') || mods.includes('Alt');
}

function readSettings() {
  const saved = readState().keymap;
  const profile = PROFILES.some((item) => item.id === saved?.profile) ? saved.profile : 'default';
  const maps = {};

  for (const preset of PROFILES) {
    const base = PRESETS[preset.id];
    const own = saved?.maps?.[preset.id];
    maps[preset.id] = {};
    for (const command of COMMANDS) {
      const savedKeys = own && typeof own === 'object' ? own[command.id] : undefined;
      maps[preset.id][command.id] =
        typeof savedKeys === 'string' ? canonical(savedKeys) : base[command.id];
    }
  }

  return { profile, maps };
}

function sync() {
  const settings = readSettings();
  ctx.keymap = settings;
  ctx.keymapProfile = settings.profile;
  ctx.keymapMap = settings.maps[settings.profile];
  ctx.keymapState = {
    profile: settings.profile,
    profiles: PROFILES.map((item) => ({ ...item })),
    rows: COMMANDS.map((command) => ({
      id: command.id,
      label: command.label,
      keys: settings.maps[settings.profile][command.id] || '',
    })),
  };
}

function save() {
  writeState({ keymap: { profile: ctx.keymapProfile, maps: ctx.keymap.maps } });
  sync();
}

function describeProfile(id) {
  return PROFILES.find((item) => item.id === id)?.label || id;
}

function setProfile(id) {
  if (!PROFILES.some((item) => item.id === id) || id === ctx.keymapProfile) return;
  ctx.keymapProfile = id;
  ctx.keymapMap = ctx.keymap.maps[id] || PRESETS.default;
  save();
  pushState();
  toast(`Профиль сочетаний: ${describeProfile(id)}`);
}

function setKeys(commandId, keys) {
  if (!ctx.keymapMap || !(commandId in ctx.keymapMap)) return false;

  const next = canonical(keys);
  if (!assignable(next)) {
    toast('Нужен Ctrl или Alt: без них сочетание перехватит ввод');
    return false;
  }

  ctx.keymapMap[commandId] = next;
  save();
  pushState();

  const occupied = COMMANDS.find(
    (command) => command.id !== commandId && next && ctx.keymapMap[command.id] === next,
  );
  if (occupied) toast(`Сочетание уже занято: ${occupied.label}`);
  return true;
}

function resetProfile() {
  const profile = ctx.keymapProfile;
  ctx.keymapMap = { ...PRESETS[profile] };
  ctx.keymap.maps[profile] = ctx.keymapMap;
  save();
  pushState();
  toast('Сочетания сброшены');
}

/** Команда для сочетания или null. */
function commandFor(accelerator) {
  const value = canonical(accelerator);
  if (!value || !ctx.keymapMap) return null;
  for (const command of COMMANDS) {
    if (ctx.keymapMap[command.id] === value) return command.id;
  }
  return null;
}

sync();

module.exports = {
  COMMANDS,
  PROFILES,
  acceleratorOf,
  canonical,
  commandFor,
  setProfile,
  setKeys,
  resetProfile,
  sync,
};
