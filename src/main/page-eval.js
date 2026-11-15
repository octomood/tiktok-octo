'use strict';

/**
 * Выполнение наших скриптов в странице сайта.
 *
 * executeJavaScript ждёт did-stop-loading, а лента TikTok может грузиться
 * бесконечно: вызовы висят, а Electron копит слушатели. Поэтому при активной
 * загрузке идём через CDP (webContents.debugger), который выполняет код сразу.
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

  let attachedHere = false;
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      attachedHere = true;
    }
  } catch (err) {
    // Например, открыт DevTools — тогда попробуем в следующий раз.
    if (process.env.OCTO_DEBUG) console.warn('[octo] page eval attach failed:', err.message);
    return;
  }

  try {
    for (const script of scripts) {
      await wc.debugger.sendCommand('Runtime.evaluate', {
        expression: script,
        awaitPromise: false,
        userGesture: true,
      });
    }
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] page eval failed:', err.message);
  } finally {
    if (attachedHere) {
      try {
        wc.debugger.detach();
      } catch {
        /* уже отключился */
      }
    }
  }
}

module.exports = { evalInPage };
