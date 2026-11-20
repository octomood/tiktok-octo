'use strict';

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
let owned = false;
// Переключения и sync после перезагрузки идут через одну очередь: быстрые
// «выключить → включить» иначе выполняются наперегонки, и отложенный detach
// старого вызова снимает режим уже после того, как новый его включил.
let queue = Promise.resolve();

function alive(wc) {
  return Boolean(wc && !wc.isDestroyed?.() && wc.debugger);
}

function detachOwned(wc) {
  if (!owned || !wc) return;
  try {
    if (wc.debugger.isAttached()) wc.debugger.detach();
  } catch {
    /* отладчик уже отключён или занят DevTools */
  }
  owned = false;
}

/**
 * Применяет или снимает auto dark mode на конкретной странице.
 * @param {Electron.WebContents} [wc]
 * @param {boolean} [on]
 */
function applyNow(wc, on) {
  if (!alive(wc)) {
    detachOwned(target);
    target = null;
    return false;
  }

  if (target !== wc) owned = false;
  target = wc;

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      owned = true;
    }
    return wc.debugger
      .sendCommand('Emulation.setAutoDarkModeOverride', { enabled: Boolean(on) })
      .then(() => {
        if (!on) detachOwned(wc);
        return true;
      })
      .catch((err) => {
        if (process.env.OCTO_DEBUG) console.warn('[octo] auto dark:', err.message);
        if (owned) detachOwned(wc);
        return false;
      });
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] auto dark:', err.message);
    if (owned) detachOwned(wc);
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
