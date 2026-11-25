'use strict';

const { ipcMain } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const player = require('./player');

/**
 * Клавиатурная лента.
 *
 * Клавиши приходят из изолированного preload страницы (там же проверяется,
 * что пользователь не печатает в поле), а здесь превращаются в команды.
 * Обычный ввод в комментариях и поиске остаётся странице.
 */

const SEEK_STEP = 10;
const REPEATABLE = new Set(['seekBack', 'seekForward', 'seekPercent', 'framePrev', 'frameNext']);

/** Ленивый require: commands.js сам ссылается на этот модуль. */
function run(command) {
  require('./commands').handleCommand(command);
}

function handle(action, payload, repeat) {
  if (ctx.feedKeys === false) return;
  if (repeat && !REPEATABLE.has(action)) return;

  switch (action) {
    case 'playPause':
      run('togglePlayback');
      break;
    case 'seekBack':
      player.nudge(-SEEK_STEP);
      break;
    case 'seekForward':
      player.nudge(SEEK_STEP);
      break;
    case 'framePrev':
      player.stepFrame(-1);
      break;
    case 'frameNext':
      player.stepFrame(1);
      break;
    case 'seekPercent': {
      const step = Math.min(9, Math.max(0, Math.round(Number(payload) || 0)));
      player.seekPercent(step / 10);
      break;
    }
    case 'screenshot':
      run('screenshot');
      break;
    case 'help':
      run('keysPanel');
      break;
    default:
      break;
  }
}

function install() {
  ipcMain.on('octo:feed-key', (event, action, payload, repeat) => {
    if (!ctx.view || event.sender !== ctx.view.webContents) return;
    if (typeof action !== 'string') return;
    handle(action, payload, repeat === true);
  });
}

/** Сообщить странице, включена ли лента (preload держит своё состояние). */
function sync() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send('octo:feed-keys', ctx.feedKeys !== false);
  } catch {
    /* страница уже ушла */
  }
}

function toggle() {
  ctx.feedKeys = ctx.feedKeys === false;
  writeState({ feedKeys: ctx.feedKeys });
  sync();
  toast(ctx.feedKeys ? 'Клавиатурная лента включена' : 'Клавиатурная лента выключена');
  pushState();
}

ctx.feedKeys = readState().feedKeys !== false;

install();

module.exports = { sync, toggle };
