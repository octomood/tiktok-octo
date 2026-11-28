'use strict';

const logger = require('./logger');

/**
 * Выполнение наших скриптов в странице сайта.
 *
 * `wc.executeJavaScript` ждёт `did-stop-loading`, а лента TikTok может грузиться
 * бесконечно: вызовы висят, а Electron копит слушатели. `mainFrame.executeJavaScript`
 * выполняется сразу без ожидания конца загрузки и без подключения CDP-отладчика,
 * чтобы не провоцировать детекторы отладки на экранах входа и регистрации.
 */
async function evalInPage(wc, scripts) {
  if (!wc || wc.isDestroyed() || !scripts || scripts.length === 0) return;

  const target = wc.mainFrame || wc;
  if (!wc.isLoading()) {
    for (const script of scripts) {
      target.executeJavaScript(script, false).catch(() => {
        /* страница уже ушла */
      });
    }
    return;
  }

  let done = false;
  const runAll = Promise.all(
    scripts.map((script) =>
      wc.isDestroyed()
        ? Promise.resolve()
        : target.executeJavaScript(script, false).catch((err) => {
            if (!wc.isDestroyed()) {
              logger.throttled(
                'page-eval-run',
                5000,
                'DEBUG',
                'page-eval',
                'evaluate failed',
                err?.message,
              );
            }
          }),
    ),
  ).finally(() => {
    done = true;
  });

  await Promise.race([
    runAll,
    new Promise((resolve) =>
      setTimeout(() => {
        if (!done) {
          logger.throttled('page-eval-timeout', 5000, 'DEBUG', 'page-eval', 'evaluate timeout');
        }
        resolve();
      }, 1000).unref?.(),
    ),
  ]);
}

module.exports = { evalInPage };
