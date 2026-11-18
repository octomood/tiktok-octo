'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, powerMonitor } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { showMessageBox } = require('./dialogs');

/**
 * Устойчивость: безопасный режим после падений, сторож памяти и экономный
 * режим на батарее.
 *
 * Файл `resilience.json` отдельный от настроек: резервные копии и экспорт не
 * должны случайно включать безопасный режим. Если приложение завершилось
 * аварийно, в файле остаётся `running: true`; два таких запуска подряд
 * включают безопасный режим — без плагинов и своего кода.
 */

const FILE = 'resilience.json';
const MAX_RELOADS = 3;
const RELOAD_COOLDOWN_MS = 10 * 60 * 1000;

let running = false;
let safeMode = false;
let memoryTimer = null;
let lastMemoryReload = 0;
let memoryReloads = 0;

function guardPath() {
  return path.join(app.getPath('userData'), FILE);
}

function readGuard() {
  try {
    const value = JSON.parse(fs.readFileSync(guardPath(), 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeGuard(value) {
  const next = {
    running: value.running === true,
    failures: Math.max(0, Number(value.failures) || 0),
    safeMode: value.safeMode === true,
  };
  try {
    fs.mkdirSync(path.dirname(guardPath()), { recursive: true });
    const tmp = `${guardPath()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, guardPath());
  } catch {
    /* без файла защита просто не накопится между запусками */
  }
  return next;
}

function markCleanExit() {
  if (!running) return;
  running = false;
  writeGuard({ running: false, failures: 0, safeMode });
}

/** Вызывается один раз при старте, до создания окна. */
function init() {
  const saved = readGuard();
  let failures = Math.max(0, Number(saved.failures) || 0);
  if (saved.running === true) failures += 1;
  else failures = 0;

  safeMode = saved.safeMode === true || failures >= 2;
  running = true;
  writeGuard({ running: true, failures, safeMode });

  ctx.safeMode = safeMode;
  const state = readState();
  ctx.ecoOnBattery = state.ecoOnBattery !== false;
  ctx.memoryGuard = state.memoryGuard !== false;

  app.on('will-quit', markCleanExit);
  app.on('before-quit', () => {
    // app.exit() не всегда доходит до will-quit, но перед ним ставим флаг.
    markCleanExit();
  });

  powerMonitor.on('on-battery', () => setBattery(true));
  powerMonitor.on('on-ac', () => setBattery(false));
  updatePower();

  startMemoryGuard();

  if (safeMode) {
    toast('Безопасный режим: плагины и свой код отключены');
  }
}

function isSafeMode() {
  return safeMode;
}

function setSafeMode(value) {
  safeMode = value === true;
  ctx.safeMode = safeMode;
  writeGuard({ running, failures: 0, safeMode });
  if (!safeMode) {
    lastMemoryReload = 0;
    memoryReloads = 0;
  }
  pushState();
  return safeMode;
}

async function exitSafeMode(payload = {}) {
  if (!safeMode) return { ok: true };
  const restart = !(process.env.OCTO_E2E && payload.restart === false);
  if (restart) {
    const answer = await showMessageBox(ctx.win, {
      type: 'question',
      title: 'Безопасный режим',
      message: 'Выключить безопасный режим и перезапустить приложение?',
      detail: 'Плагины и свой CSS/JavaScript снова будут загружаться.',
      buttons: ['Перезапустить', 'Отмена'],
      defaultId: 0,
      cancelId: 1,
    });
    if (answer.response !== 0) return { ok: false, canceled: true };
  }

  setSafeMode(false);
  toast('Безопасный режим выключен');
  if (restart) {
    markCleanExit();
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);
  }
  return { ok: true, restart };
}

function setBattery(value) {
  const next = value === true;
  if (ctx.onBattery === next) return;
  ctx.onBattery = next;
  applyEco();
}

function applyEco() {
  const wanted = ctx.ecoOnBattery !== false && ctx.onBattery === true;
  if (ctx.eco === wanted) return;
  ctx.eco = wanted;
  try {
    require('./cosmetics').setEco(wanted);
  } catch {
    /* косметика ещё не загружена */
  }
  pushState();
}

function updatePower() {
  const forced = process.env.OCTO_POWER_SOURCE;
  let onBattery;
  if (forced === 'battery') onBattery = true;
  else if (forced === 'ac') onBattery = false;
  else {
    try {
      onBattery = powerMonitor.isOnBatteryPower();
    } catch {
      onBattery = false;
    }
  }
  ctx.onBattery = onBattery;
  applyEco();
}

function setEcoOnBattery(value) {
  ctx.ecoOnBattery = value !== false;
  writeState({ ecoOnBattery: ctx.ecoOnBattery });
  applyEco();
  pushState();
  toast(ctx.ecoOnBattery ? 'Экономный режим на батарее включён' : 'Экономный режим выключен');
}

function setMemoryGuard(value) {
  ctx.memoryGuard = value !== false;
  writeState({ memoryGuard: ctx.memoryGuard });
  pushState();
  toast(ctx.memoryGuard ? 'Проверка памяти включена' : 'Проверка памяти выключена');
}

function memoryUsed() {
  try {
    return app.getAppMetrics().reduce((sum, metric) => {
      const kb = Number(metric?.memory?.workingSetSize) || 0;
      return sum + kb;
    }, 0);
  } catch {
    return 0;
  }
}

function noteMemoryReload(kb) {
  const file = process.env.OCTO_MEMORY_LOG;
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify({ at: Date.now(), kb })}\n`);
  } catch {
    /* журнал только для тестов */
  }
}

function checkMemory() {
  if (ctx.memoryGuard === false || ctx.offline) return;
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  const kb = memoryUsed();
  const limitMb = Number(process.env.OCTO_MEMORY_LIMIT_MB) || 1200;
  if (kb < limitMb * 1024) return;
  if (memoryReloads >= MAX_RELOADS) return;

  const now = Date.now();
  if (now - lastMemoryReload < RELOAD_COOLDOWN_MS) return;
  lastMemoryReload = now;
  memoryReloads += 1;
  noteMemoryReload(kb);
  toast('Высокий расход памяти — перезапускаю страницу');
  try {
    wc.reload();
  } catch {
    /* страница уже закрылась */
  }
}

function startMemoryGuard() {
  clearInterval(memoryTimer);
  const poll = Math.max(50, Number(process.env.OCTO_MEMORY_POLL_MS) || 60000);
  memoryTimer = setInterval(checkMemory, poll);
  if (typeof memoryTimer.unref === 'function') memoryTimer.unref();
}

module.exports = {
  init,
  markCleanExit,
  isSafeMode,
  setSafeMode,
  exitSafeMode,
  setEcoOnBattery,
  setMemoryGuard,
  applyEco,
  updatePower,
  checkMemory,
  memoryUsed,
  guardPath,
};
