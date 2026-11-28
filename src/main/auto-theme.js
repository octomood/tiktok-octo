'use strict';

const logger = require('./logger');

/**
 * Автотёмная тема Chromium для страниц, которые не читают cookie-тему TikTok.
 *
 * Основной путь — нативные cookie `tiktok_webapp_theme*`: их понимает сам сайт,
 * и он перекрашивает свои компоненты. Но Business Suite, служебные экраны и
 * сторонние поддомены эти cookie игнорируют и остаются белыми. Для них включаем
 * auto dark mode Chromium через CDP: он затемняет светлые поверхности, не
 * инвертируя фотографии и видео.
 *
 * Настройка `Emulation.setAutoDarkModeOverride` живёт в сессии отладчика, поэтому
 * её нельзя включать и сразу отцеплять: тогда режим сбрасывается. Сессию держим
 * открытой, а остальные модули (page-eval, стикеры) переиспользуют её — они уже
 * проверяют `debugger.isAttached()` и не отцепляют чужое подключение.
 */

let target = null;
let desired = false;
/** Владение отладчиком по конкретному WebContents (лента и чат раздельно). */
const ownedByWc = new WeakSet();
// Переключения и sync после перезагрузки идут через одну очередь: быстрые
// «выключить → включить» иначе выполняются наперегонки, и отложенный detach
// старого вызова снимает режим уже после того, как новый его включил.
let queue = Promise.resolve();

function alive(wc) {
  return Boolean(wc && !wc.isDestroyed?.() && wc.debugger);
}

function detachOwned(wc) {
  if (!wc || !ownedByWc.has(wc)) return;
  try {
    if (wc.debugger.isAttached()) wc.debugger.detach();
  } catch {
    /* отладчик уже отключён или занят DevTools */
  }
  ownedByWc.delete(wc);
}

/**
 * Применяет или снимает auto dark mode на конкретной странице.
 * @param {Electron.WebContents} [wc]
 * @param {boolean} [on]
 */
function applyNow(wc, on) {
  if (!alive(wc)) {
    detachOwned(target);
    if (target === wc) target = null;
    return false;
  }

  target = wc;

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      ownedByWc.add(wc);
    }
    return wc.debugger
      .sendCommand('Emulation.setAutoDarkModeOverride', { enabled: Boolean(on) })
      .then(() => {
        if (!on) detachOwned(wc);
        return true;
      })
      .catch((err) => {
        logger.throttled('auto-dark-err', 5000, 'WARN', 'theme', 'auto dark failed', err?.message);
        if (process.env.OCTO_DEBUG) console.warn('[octo] auto dark:', err.message);
        if (ownedByWc.has(wc)) detachOwned(wc);
        return false;
      });
  } catch (err) {
    logger.throttled('auto-dark-err', 5000, 'WARN', 'theme', 'auto dark failed', err?.message);
    if (process.env.OCTO_DEBUG) console.warn('[octo] auto dark:', err.message);
    if (ownedByWc.has(wc)) detachOwned(wc);
    return false;
  }
}

/** Ставит применение в очередь: последний вызов задаёт итоговое состояние. */
function apply(wc = target, on = desired) {
  const next = queue.then(() => applyNow(wc, on)).catch(() => false);
  queue = next;
  return next;
}

/** Повторить текущее состояние после навигации или закрытия DevTools. */
function sync(wc = target) {
  return apply(wc, desired);
}

/** Пользователь включил или выключил «Тёмную тему везде». */
function setEnabled(wc, on) {
  desired = Boolean(on);
  return apply(wc, desired);
}

/** Временно снять режим, не меняя выбор пользователя (например, для DevTools). */
function suspend(wc = target) {
  return apply(wc, false);
}

function isEnabled() {
  return desired;
}

module.exports = { setEnabled, sync, suspend, isEnabled };
