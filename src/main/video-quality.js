'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * Аппаратное декодирование на Linux.
 *
 * Chromium умеет HEVC только через системный декодер (VA-API), а по умолчанию
 * приложение выключает аппаратное декодирование из-за бага «звук идёт, кадры
 * стоят». Флаг включается до app.whenReady(), поэтому переключатель честно
 * просит перезапуск. На Windows и macOS настройка не нужна: там платформенный
 * декодер (Media Foundation / VideoToolbox) работает без нашего вмешательства.
 */

const SUPPORTED = process.platform === 'linux';

function storedEnabled() {
  try {
    return readState().hardwareVideo === true;
  } catch {
    return false;
  }
}

function settingEnabled() {
  return process.env.OCTO_HW_VIDEO === '1' || storedEnabled();
}

function sync() {
  ctx.hardwareVideo = { enabled: SUPPORTED && settingEnabled(), supported: SUPPORTED };
}

function toggle() {
  if (!SUPPORTED) return;
  const next = !storedEnabled();
  writeState({ hardwareVideo: next });
  sync();
  pushState();
  toast(
    next
      ? 'Аппаратное декодирование включено — перезапустите приложение'
      : 'Аппаратное декодирование выключено — перезапустите приложение',
  );
}

sync();

module.exports = { SUPPORTED, settingEnabled, sync, toggle };
