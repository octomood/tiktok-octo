'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * Субтитры по умолчанию.
 *
 * Настройки аккаунта TikTok не трогаем: страничный скрипт ищет кнопку
 * субтитров и включает её, а оформление (размер, фон, обводка) задаёт CSS.
 * Если сайт не помечает состояние кнопки, приложение её не тыкает вслепую —
 * лучше оставить как есть, чем выключить уже включённые субтитры.
 */

const DEFAULTS = { enabled: false, size: 100, background: true, outline: true };
const MIN_SIZE = 75;
const MAX_SIZE = 150;

function readSettings() {
  const saved = readState().subtitles;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    ...DEFAULTS,
    ...value,
    enabled: value.enabled === true,
    background: value.background !== false,
    outline: value.outline !== false,
    size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(value.size) || 100)),
  };
}

function sync() {
  ctx.subtitles = readSettings();
}

function save(patch) {
  writeState({ subtitles: { ...readSettings(), ...patch } });
  sync();
}

function apply() {
  // Настройки уходят в страничный скрипт плеера вместе с остальными.
  require('./player').apply();
  pushState();
}

function toggle() {
  save({ enabled: !ctx.subtitles.enabled });
  apply();
  toast(
    ctx.subtitles.enabled ? 'Субтитры включены по умолчанию' : 'Субтитры по умолчанию выключены',
  );
}

function setSize(value) {
  save({ size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(Number(value) || 100))) });
  apply();
}

function toggleBackground() {
  save({ background: !ctx.subtitles.background });
  apply();
}

function toggleOutline() {
  save({ outline: !ctx.subtitles.outline });
  apply();
}

sync();

module.exports = { sync, toggle, setSize, toggleBackground, toggleOutline };
