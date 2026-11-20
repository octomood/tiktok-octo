'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');
const i18n = require('./i18n');

/**
 * Focus mode.
 *
 * Пока идёт фокус, приложение считает время просмотра. Когда лимит исчерпан,
 * лента мягко блокируется: затемнение с таймером перерыва, видео на паузе.
 * Перерыв заканчивается сам, <kbd>Esc</kbd> выключает режим целиком.
 * Реальные минуты можно ускорить в тестах через OCTO_FOCUS_UNIT_MS.
 */

const DEFAULTS = { enabled: false, minutes: 25, breakMinutes: 5 };
const UNIT_MS = Number(process.env.OCTO_FOCUS_UNIT_MS) || 60_000;
const TICK_MS = Number(process.env.OCTO_FOCUS_TICK_MS) || 5000;
const CURTAIN_ID = 'octo-focus-curtain';

let phase = 'off';
let elapsed = 0;
let ticker = null;
let breakTimer = null;

function readSettings() {
  const saved = readState().focus;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    enabled: value.enabled === true,
    minutes: Math.min(180, Math.max(1, Math.round(Number(value.minutes) || DEFAULTS.minutes))),
    breakMinutes: Math.min(
      60,
      Math.max(1, Math.round(Number(value.breakMinutes) || DEFAULTS.breakMinutes)),
    ),
  };
}

function syncState() {
  const settings = readSettings();
  ctx.focus = {
    ...settings,
    phase,
    elapsed: Math.round((elapsed / UNIT_MS) * 60),
    total: Math.round(settings.minutes * 60),
  };
}

function save(patch) {
  writeState({ focus: { ...readSettings(), ...patch } });
  syncState();
}

function curtainScript(minutes) {
  const title = i18n.t('Перерыв');
  const hint = i18n.t('Лента на паузе {0} мин').replace('{0}', String(minutes));
  return `(() => {
    const ID = ${JSON.stringify(CURTAIN_ID)};
    if (document.getElementById(ID)) return;
    const box = document.createElement('div');
    box.id = ID;
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
      'padding:24px;background:rgba(5,5,8,0.92);color:#fff;text-align:center;' +
      'font:500 18px/1.4 system-ui,-apple-system,sans-serif;backdrop-filter:blur(6px)';
    const title = document.createElement('div');
    title.textContent = ${JSON.stringify(title)};
    const hint = document.createElement('div');
    hint.textContent = ${JSON.stringify(hint)};
    hint.style.cssText = 'font-size:12px;font-weight:400;opacity:0.66';
    box.append(title, hint);
    document.documentElement.appendChild(box);
    document.querySelectorAll('video').forEach((video) => {
      try { video.pause(); } catch (err) { /* элемент уже выгружен */ }
    });
  })()`;
}

const REMOVE_SCRIPT = `(() => {
  const node = document.getElementById(${JSON.stringify(CURTAIN_ID)});
  if (node) node.remove();
})()`;

function run(script) {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [script]);
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(tick, TICK_MS);
  if (typeof ticker.unref === 'function') ticker.unref();
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function tick() {
  if (phase !== 'focus') return;
  if (!ctx.playing) return;
  elapsed += TICK_MS;
  if (elapsed >= (ctx.focus?.minutes || DEFAULTS.minutes) * UNIT_MS) {
    enterBreak();
    return;
  }
  syncState();
  pushState();
}

function enterBreak() {
  phase = 'break';
  elapsed = 0;
  const minutes = ctx.focus?.breakMinutes || DEFAULTS.breakMinutes;
  run(curtainScript(minutes));
  toast(`Focus: перерыв ${minutes} мин`);
  syncState();
  pushState();

  breakTimer = setTimeout(() => {
    breakTimer = null;
    phase = 'focus';
    run(REMOVE_SCRIPT);
    toast('Перерыв окончен — продолжаем');
    syncState();
    pushState();
  }, minutes * UNIT_MS);
  if (typeof breakTimer.unref === 'function') breakTimer.unref();
}

function start() {
  elapsed = 0;
  phase = 'focus';
  save({ enabled: true });
  startTicker();
  toast(`Focus: ${ctx.focus.minutes} мин`);
  pushState();
}

function stop(message = 'Focus выключен') {
  stopTicker();
  if (breakTimer) clearTimeout(breakTimer);
  breakTimer = null;
  phase = 'off';
  elapsed = 0;
  save({ enabled: false });
  run(REMOVE_SCRIPT);
  toast(message);
  pushState();
}

function toggle() {
  if (phase === 'off') start();
  else stop();
}

function setMinutes(value) {
  save({ minutes: Math.min(180, Math.max(1, Math.round(Number(value) || DEFAULTS.minutes))) });
  if (phase === 'off') elapsed = 0;
  pushState();
}

function setBreak(value) {
  save({
    breakMinutes: Math.min(60, Math.max(1, Math.round(Number(value) || DEFAULTS.breakMinutes))),
  });
  pushState();
}

/** dom-ready после перехода: затемнение нужно вернуть. */
function reapply() {
  if (phase !== 'break') return;
  run(curtainScript(ctx.focus?.breakMinutes || DEFAULTS.breakMinutes));
}

/**
 * Перечитать лимиты после импорта настроек и привести режим к ним: выключенный
 * Focus останавливает счётчик и снимает затемнение, включённый — запускает
 * новый отсчёт. Без этого импорт менял только файл, а панель и счётчик жили
 * по старым значениям до перезапуска.
 */
function sync() {
  const settings = readSettings();

  if (!settings.enabled) {
    if (phase !== 'off') {
      stopTicker();
      if (breakTimer) clearTimeout(breakTimer);
      breakTimer = null;
      phase = 'off';
      elapsed = 0;
      run(REMOVE_SCRIPT);
    }
    syncState();
    return;
  }

  if (phase === 'off') {
    phase = 'focus';
    elapsed = 0;
    startTicker();
  }
  syncState();
}

syncState();

// Режим переживает перезапуск: если он был включён, счётчик стартует с нуля.
if (readSettings().enabled) {
  phase = 'focus';
  startTicker();
  syncState();
}

module.exports = {
  toggle,
  stop,
  setMinutes,
  setBreak,
  reapply,
  sync,
  isOn: () => phase !== 'off',
};
