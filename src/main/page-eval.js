'use strict';

const autoTheme = require('./auto-theme');

const pendingByWc = new WeakMap();

/**
 * Выполнение наших скриптов в странице сайта.
 *
 * executeJavaScript ждёт did-stop-loading, а лента TikTok может грузиться
 * бесконечно: вызовы висят, а Electron копит слушатели. Поэтому при активной
 * загрузке идём через CDP (webContents.debugger), который выполняет код сразу.
 * Параллельные вызовы на одном wc делят одну сессию отладчика по счётчику,
 * чтобы первый завершившийся не отцепил отладчик у остальных.
 */
async function evalInPage(wc, scripts) {
  if (!wc || wc.isDestroyed() || !scripts || scripts.length === 0) return;

  if (!wc.isLoading()) {
    for (const script of scripts) {
      wc.executeJavaScript(script).catch(() => {
        /* страница уже ушла */
      });
    }
    return;
  }

  let state = pendingByWc.get(wc);
  if (!state) {
    state = { refs: 0, owned: false };
    pendingByWc.set(wc, state);
  }

  if (state.refs === 0) {
    try {
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
        state.owned = true;
      } else {
        state.owned = false;
      }
    } catch (err) {
      // Например, открыт DevTools — тогда попробуем в следующий раз.
      if (process.env.OCTO_DEBUG) console.warn('[octo] page eval attach failed:', err.message);
      return;
    }
  }
  state.refs += 1;

  try {
    for (const script of scripts) {
      if (wc.isDestroyed()) break;
      await wc.debugger.sendCommand('Runtime.evaluate', {
        expression: script,
        awaitPromise: false,
        userGesture: true,
      });
    }
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] page eval failed:', err.message);
  } finally {
    state.refs = Math.max(0, state.refs - 1);
    if (state.refs === 0 && state.owned) {
      state.owned = false;
      try {
        if (!wc.isDestroyed() && wc.debugger.isAttached()) wc.debugger.detach();
      } catch {
        /* уже отключился */
      }
      // Мы могли занять сессию отладчика раньше auto dark mode и отцепить её.
      // Возвращаем автотёмную тему, чтобы она не пропала до перезагрузки.
      if (autoTheme.isEnabled()) autoTheme.sync(wc).catch(() => {});
    }
  }
}

module.exports = { evalInPage };
