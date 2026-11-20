'use strict';

const { dialog, ipcMain } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * Свой CSS и JavaScript на страницу — расширенный режим для продвинутых.
 *
 * По умолчанию выключен. При включении показываем предупреждение: код
 * выполняется в изолированном мире страницы (без JS сайта), но видит DOM и
 * может менять внешний вид и поведение ленты. CSS применяется через
 * insertCSS и снимается одной кнопкой; JS выполняется один раз за загрузку
 * страницы (и повторно после навигации).
 */

const MAX_CSS = 256 * 1024;
const MAX_JS = 64 * 1024;
const WORLD_ID = 4242;

let cssKey = null;

function readSettings() {
  const saved = readState().customCode;
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    enabled: value.enabled === true,
    css: typeof value.css === 'string' ? value.css.slice(0, MAX_CSS) : '',
    js: typeof value.js === 'string' ? value.js.slice(0, MAX_JS) : '',
  };
}

function sync() {
  const settings = readSettings();
  ctx.customCode = {
    enabled: settings.enabled,
    cssLength: settings.css.length,
    jsLength: settings.js.length,
  };
  return settings;
}

function publicState() {
  const settings = readSettings();
  return {
    enabled: settings.enabled,
    cssLength: settings.css.length,
    jsLength: settings.js.length,
  };
}

function publish() {
  ctx.customCode = publicState();
  pushState();
}

function removeCss(wc) {
  if (!cssKey || !wc || wc.isDestroyed()) {
    cssKey = null;
    return;
  }
  const key = cssKey;
  cssKey = null;
  wc.removeInsertedCSS(key).catch(() => {
    /* документ уже сменился */
  });
}

/** Применить код к текущей странице (или снять, если режим выключен). */
let applyQueue = Promise.resolve();

function apply() {
  // insertCSS асинхронный: два вызова (переключение + dom-ready) иначе
  // перезаписывают cssKey и оставляют старый стиль без ручки.
  const next = applyQueue.then(() => applyNow()).catch(() => {});
  applyQueue = next;
  return next;
}

async function applyNow() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const settings = readSettings();

  removeCss(wc);
  if (!settings.enabled) return;
  // Безопасный режим: чужой код не исполняем до явного выхода из него.
  if (require('./resilience').isSafeMode()) return;

  if (settings.css.trim()) {
    try {
      cssKey = await wc.insertCSS(settings.css, { cssOrigin: 'user' });
    } catch {
      cssKey = null;
    }
  }

  if (settings.js.trim()) {
    const code = `(() => {
      try {
        ${settings.js}
      } catch (err) {
        console.warn('[octo custom js]', err && err.message ? err.message : err);
      }
    })()`;
    try {
      await wc.executeJavaScriptInIsolatedWorld(WORLD_ID, [{ code }]);
    } catch {
      /* страница уже ушла */
    }
  }
}

/** dom-ready после перехода: CSS и JS нужно вернуть. */
function reapply() {
  const settings = readSettings();
  if (!settings.enabled) return;
  apply();
}

async function toggle() {
  const settings = readSettings();
  if (settings.enabled) {
    writeState({ customCode: { ...settings, enabled: false } });
    sync();
    await apply();
    publish();
    toast('Свой код выключен');
    return false;
  }

  const hasCode = Boolean(settings.css.trim() || settings.js.trim());
  if (hasCode && process.env.OCTO_E2E !== '1') {
    const result = await dialog.showMessageBox(ctx.win, {
      type: 'warning',
      buttons: ['Включить', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      title: 'Свой код',
      message: 'Включить свой CSS и JavaScript?',
      detail:
        'Код выполняется на странице TikTok в изолированном мире. Он не получает ' +
        'объекты сайта и Node, но видит DOM и может менять ленту и её поведение.\n\n' +
        'Включайте только свой проверенный код. Выключить можно одной кнопкой.',
    });
    if (result.response !== 0) return false;
  }

  writeState({ customCode: { ...settings, enabled: true } });
  sync();
  await apply();
  publish();
  toast('Свой код включён');
  return true;
}

async function setCode(payload = {}) {
  const settings = readSettings();
  writeState({
    customCode: {
      ...settings,
      css: typeof payload.css === 'string' ? payload.css.slice(0, MAX_CSS) : settings.css,
      js: typeof payload.js === 'string' ? payload.js.slice(0, MAX_JS) : settings.js,
    },
  });
  sync();
  if (readSettings().enabled) await apply();
  publish();
  toast('Свой код сохранён');
}

// Renderer просит код отдельно: в pushState он не ездит.
ipcMain.on('octo:custom-code', (event) => {
  const wc = ctx.win?.webContents;
  if (!wc || wc.isDestroyed() || event.sender !== wc) {
    event.returnValue = null;
    return;
  }
  event.returnValue = readSettings();
});

sync();

module.exports = { sync, apply, reapply, toggle, setCode, publish };
