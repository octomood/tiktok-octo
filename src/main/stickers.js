'use strict';

/**
 * Стикеры для чата TikTok.
 *
 * В веб-версии нет панели стикеров, поэтому работаем штатным путём сайта:
 * подкладываем картинку в скрытый input[type=file] чата и, если появляется
 * кнопка отправки, нажимаем её. Для собеседника это обычное фото, но
 * прозрачный PNG/GIF выглядит как стикер.
 *
 * Файлы лежат в userData/stickers, превью отдаёт собственная схема
 * octo-sticker:// — renderer не получает доступ к произвольным путям.
 */

const { app, nativeImage, protocol, shell } = require('electron');
const { showOpenDialog } = require('./dialogs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { ctx, pushState, toast } = require('./app-context');

const SCHEME = 'octo-sticker';
const DIR_NAME = 'stickers';
const INDEX_FILE = 'stickers.json';
const THUMB_DIR = 'thumbs';
const MAX_BYTES = 8 * 1024 * 1024;
const THUMB_WIDTH = 160;
const ID_RE = /^[a-z0-9-]{1,64}$/;
const EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

let rootDir = '';
let items = [];

function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: false,
        corsEnabled: false,
      },
    },
  ]);
}

function indexPath() {
  return path.join(rootDir, INDEX_FILE);
}

function itemFile(item) {
  return path.join(rootDir, `${item.id}${item.ext}`);
}

function thumbFile(item) {
  return path.join(rootDir, THUMB_DIR, `${item.id}.png`);
}

function publicItem(item) {
  return {
    id: item.id,
    name: item.name,
    ext: item.ext,
    size: item.size,
    addedAt: item.addedAt,
  };
}

function normalizeItem(raw) {
  const id = String(raw?.id || '');
  const ext = String(raw?.ext || '').toLowerCase();
  if (!ID_RE.test(id) || !MIME[ext]) return null;

  const file = path.join(rootDir, `${id}${ext}`);
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    return {
      id,
      ext,
      name: String(raw?.name || id).slice(0, 120),
      size: stat.size,
      addedAt: Number(raw?.addedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

function readIndex() {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
    const list = Array.isArray(parsed?.items) ? parsed.items : [];
    return list.map(normalizeItem).filter(Boolean);
  } catch {
    return [];
  }
}

function writeIndex() {
  try {
    fs.mkdirSync(rootDir, { recursive: true });
    const tmp = `${indexPath()}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify({ version: 1, items: items.map(publicItem) }, null, 2),
      'utf8',
    );
    fs.renameSync(tmp, indexPath());
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] stickers index:', err.message);
  }
}

function syncState() {
  ctx.stickers = { items: items.map(publicItem), dir: rootDir };
}

function makeThumb(item, source) {
  try {
    const image = nativeImage.createFromPath(source);
    if (image.isEmpty()) return;
    const resized = image.resize({ width: THUMB_WIDTH, quality: 'good' });
    if (resized.isEmpty()) return;
    fs.writeFileSync(thumbFile(item), resized.toPNG());
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker thumb:', err.message);
  }
}

function init() {
  rootDir = path.join(app.getPath('userData'), DIR_NAME);
  try {
    fs.mkdirSync(path.join(rootDir, THUMB_DIR), { recursive: true });
  } catch {
    /* каталог недоступен — список будет пустым */
  }
  items = readIndex();
  syncState();
  installProtocol();
}

function installProtocol() {
  try {
    protocol.handle(SCHEME, (request) => {
      try {
        const url = new URL(request.url);
        const kind = url.hostname;
        const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if ((kind !== 'thumb' && kind !== 'full') || !ID_RE.test(id)) return notFound();

        const item = items.find((entry) => entry.id === id);
        if (!item) return notFound();

        let file = itemFile(item);
        let type = MIME[item.ext];
        if (kind === 'thumb') {
          const preview = thumbFile(item);
          if (fs.existsSync(preview)) {
            file = preview;
            type = 'image/png';
          }
        }

        const data = fs.readFileSync(file);
        return new Response(new Uint8Array(data), {
          status: 200,
          headers: {
            'content-type': type,
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          },
        });
      } catch {
        return notFound();
      }
    });
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] stickers protocol:', err.message);
  }
}

function notFound() {
  return new Response(new Uint8Array(0), { status: 404 });
}

function extensionOf(file) {
  return path.extname(file).toLowerCase();
}

async function addFromDialog() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  let result;
  try {
    result = await showOpenDialog(ctx.win, {
      title: 'Добавить стикеры',
      buttonLabel: 'Добавить',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Изображения', extensions: EXTS.map((ext) => ext.slice(1)) },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    });
  } catch (err) {
    toast(`Не удалось открыть выбор файлов: ${err.message}`);
    return;
  }
  if (result.canceled || !result.filePaths.length) return;

  let added = 0;
  let skipped = 0;

  for (const source of result.filePaths) {
    const ext = extensionOf(source);
    if (!MIME[ext]) {
      skipped += 1;
      continue;
    }

    try {
      const stat = fs.statSync(source);
      if (!stat.isFile() || stat.size > MAX_BYTES) {
        skipped += 1;
        continue;
      }

      const id = crypto.randomUUID();
      const item = {
        id,
        ext,
        name: path.basename(source, ext).slice(0, 120) || 'sticker',
        size: stat.size,
        addedAt: Date.now(),
      };
      const destination = path.join(rootDir, `${id}${ext}`);
      fs.copyFileSync(source, destination);
      makeThumb(item, destination);
      items.unshift(item);
      added += 1;
    } catch (err) {
      skipped += 1;
      if (process.env.OCTO_DEBUG) console.warn('[octo] sticker import:', err.message);
    }
  }

  if (added) {
    writeIndex();
    syncState();
    pushState();
    toast(
      skipped
        ? `Добавлено стикеров: ${added}, пропущено: ${skipped}`
        : `Добавлено стикеров: ${added}`,
    );
  } else {
    toast('Не удалось добавить стикеры: нужен PNG, JPG, WebP или GIF до 8 МБ');
  }
}

function remove(id) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const [item] = items.splice(index, 1);
  try {
    fs.rmSync(itemFile(item), { force: true });
    fs.rmSync(thumbFile(item), { force: true });
  } catch {
    /* файл уже удалён вручную */
  }
  writeIndex();
  syncState();
  pushState();
  toast('Стикер удалён');
}

function openFolder() {
  if (!rootDir) return;
  shell.openPath(rootDir).then((error) => {
    if (error) toast('Не удалось открыть папку стикеров');
  });
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const CHAT_READY_EXPR = `(() => {
  const composer = document.querySelector(
    '[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea'
  );
  if (!composer) return false;
  const aria = (composer.getAttribute('aria-label') || '').toLowerCase();
  if (/message|сообщен|chat|чат/.test(aria)) return true;
  return /\\/messages(?:[/?#]|$)/.test(location.pathname);
})()`;

const FIND_UPLOAD_BUTTON_EXPR = `(() => {
  const composer = document.querySelector(
    '[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea'
  );
  const composerRect = composer ? composer.getBoundingClientRect() : null;
  const re = /(?:photo|image|upload|attach|media|фото|изображ|вложен)/i;
  const buttons = [...document.querySelectorAll('button, [role="button"]')].filter((element) => {
    const aria = element.getAttribute('aria-label') || '';
    const e2e = element.getAttribute('data-e2e') || '';
    const cls = typeof element.className === 'string' ? element.className : '';
    const text = (element.textContent || '').trim();
    return re.test(aria) || re.test(e2e) || re.test(cls) || re.test(text);
  });
  if (!buttons.length) return null;
  if (!composerRect) return buttons[buttons.length - 1];

  return buttons
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - (composerRect.left + composerRect.width / 2);
      const dy = rect.top + rect.height / 2 - (composerRect.top + composerRect.height / 2);
      return { element, distance: dx * dx + dy * dy };
    })
    .sort((left, right) => left.distance - right.distance)[0].element;
})()`;

const FIND_INPUT_EXPR = `(() => {
  const isImageInput = (input) => {
    if (input.disabled) return false;
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('*');
  };
  const inputs = [...document.querySelectorAll('input[type="file"]')].filter(isImageInput);
  if (!inputs.length) return null;

  const composer = document.querySelector(
    '[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea'
  );
  if (composer) {
    const root = composer.closest(
      '[data-e2e*="chat"], [class*="Chat"], [class*="chat"], [class*="Message"], [class*="message"], form'
    );
    if (root) {
      const scoped = inputs.filter((input) => root.contains(input));
      if (scoped.length) return scoped[scoped.length - 1];
    }
  }
  return inputs[inputs.length - 1];
})()`;

function attachWithDebugger(wc, file) {
  const dbg = wc.debugger;
  if (!dbg) return Promise.resolve(null);

  let attachedHere = false;
  let objectId = '';

  return (async () => {
    try {
      if (!dbg.isAttached()) {
        dbg.attach('1.3');
        attachedHere = true;
      }
      const found = await withTimeout(
        dbg.sendCommand('Runtime.evaluate', {
          expression: FIND_INPUT_EXPR,
          objectGroup: 'octo-sticker',
          includeCommandLineAPI: false,
        }),
        4000,
        'поиск поля загрузки',
      );
      objectId = found?.result?.objectId || '';
      if (!objectId) return null;

      await withTimeout(
        dbg.sendCommand('DOM.setFileInputFiles', { files: [file], objectId }),
        6000,
        'прикрепление файла',
      );
      return { mode: 'input' };
    } catch (err) {
      if (process.env.OCTO_DEBUG) console.warn('[octo] sticker debugger:', err.message);
      return null;
    } finally {
      try {
        if (objectId && !attachedHere) {
          dbg.sendCommand('Runtime.releaseObject', { objectId }).catch(() => {});
        }
      } catch {
        /* объект уже освобождён */
      }
      try {
        if (attachedHere) dbg.detach();
      } catch {
        /* debugger уже отключён */
      }
    }
  })();
}

/**
 * Запасной путь для чатов, которые создают input[type=file] только по клику
 * на кнопку фото. Перехватываем системный диалог выбора файла через CDP и
 * подставляем файл прямо в открывшийся input.
 */
async function attachWithFileChooser(wc, file) {
  const dbg = wc.debugger;
  if (!dbg) return null;

  let attachedHere = false;
  let backendNodeId = 0;

  const onMessage = (_event, method, params) => {
    if (method === 'Page.fileChooserOpened' && params?.backendNodeId) {
      backendNodeId = params.backendNodeId;
    }
  };

  try {
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      attachedHere = true;
    }
    await withTimeout(dbg.sendCommand('Page.enable'), 3000, 'Page.enable');
    await withTimeout(
      dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true }),
      3000,
      'перехват выбора файла',
    );
    dbg.on('message', onMessage);

    const clicked = await withTimeout(
      dbg.sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const button = ${FIND_UPLOAD_BUTTON_EXPR};
          if (!button) return false;
          button.click();
          return true;
        })()`,
        returnByValue: true,
        userGesture: true,
      }),
      3000,
      'клик по кнопке фото',
    );
    if (!clicked?.result?.value) return null;

    for (let attempt = 0; attempt < 20 && !backendNodeId; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!backendNodeId) return null;

    await withTimeout(
      dbg.sendCommand('DOM.setFileInputFiles', { files: [file], backendNodeId }),
      6000,
      'прикрепление файла',
    );
    return { mode: 'input' };
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker file chooser:', err.message);
    return null;
  } finally {
    try {
      dbg.removeListener('message', onMessage);
    } catch {
      /* debugger уже отключён */
    }
    try {
      await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: false });
    } catch {
      /* домен уже недоступен */
    }
    try {
      if (attachedHere) dbg.detach();
    } catch {
      /* debugger уже отключён */
    }
  }
}

function fallbackScript(base64, mime, name) {
  return `(async () => {
  const b64 = ${JSON.stringify(base64)};
  const mime = ${JSON.stringify(mime)};
  const name = ${JSON.stringify(name)};
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index += 1) bytes[index] = bin.charCodeAt(index);
  const file = new File([bytes], name, { type: mime });
  const data = new DataTransfer();
  data.items.add(file);

  const isImageInput = (input) => {
    if (input.disabled) return false;
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('*');
  };
  const inputs = [...document.querySelectorAll('input[type="file"]')].filter(isImageInput);
  const input = inputs[inputs.length - 1] || null;
  if (input) {
    try {
      input.files = data.files;
    } catch {
      return { mode: 'none', reason: 'files' };
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { mode: 'input' };
  }

  const target =
    document.querySelector('[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea') ||
    document.querySelector('[data-e2e*="chat"]') ||
    document.body;
  if (!target) return { mode: 'none', reason: 'no-input' };

  target.focus();
  const rect = target.getBoundingClientRect();
  const options = {
    bubbles: true,
    cancelable: true,
    dataTransfer: data,
    clientX: rect.left + Math.min(20, Math.max(4, rect.width / 2)),
    clientY: rect.top + Math.min(20, Math.max(4, rect.height / 2)),
  };
  for (const type of ['dragenter', 'dragover', 'drop']) {
    target.dispatchEvent(new DragEvent(type, options));
  }
  const paste = new DataTransfer();
  paste.items.add(file);
  target.dispatchEvent(
    new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: paste }),
  );
  return { mode: 'drop' };
})()`;
}

function autoSendScript() {
  return `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => {
    if (!element || element.disabled) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
  };
  const labels = new Set(['send', 'send message', 'отправить', 'отправить сообщение']);
  const candidates = () =>
    [...document.querySelectorAll('button, [role="button"]')].filter((element) => {
      const aria = (element.getAttribute('aria-label') || '').trim().toLowerCase();
      const text = (element.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const cls = typeof element.className === 'string' ? element.className : '';
      const e2e = (element.getAttribute('data-e2e') || '').trim().toLowerCase();
      return (
        e2e.includes('message-send') ||
        e2e.includes('send-button') ||
        e2e === 'send' ||
        /StyledSendButton|SendButton|send-button/i.test(cls) ||
        /^(send|отправить)$/.test(text) ||
        labels.has(aria)
      );
    });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const send = candidates().find(visible);
    if (send) {
      send.click();
      await sleep(350);
      return { clicked: true };
    }
    await sleep(200);
  }
  return { clicked: false };
})()`;
}

async function evaluate(wc, code, { timeout = 10000 } = {}) {
  if (!wc || wc.isDestroyed()) return null;

  // executeJavaScript ждёт did-stop-loading, а лента TikTok может грузиться
  // бесконечно. Поэтому сначала пробуем CDP, а при занятом debugger —
  // обычный путь. Оба варианта ограничены таймаутом.
  const dbg = wc.debugger;
  if (dbg) {
    let attachedHere = false;
    try {
      if (!dbg.isAttached()) {
        dbg.attach('1.3');
        attachedHere = true;
      }
      const result = await withTimeout(
        dbg.sendCommand('Runtime.evaluate', {
          expression: code,
          awaitPromise: true,
          returnByValue: true,
          userGesture: true,
        }),
        timeout,
        'таймаут выполнения',
      );
      if (result?.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'ошибка на странице');
      }
      return result?.result?.value ?? null;
    } catch (err) {
      if (process.env.OCTO_DEBUG) console.warn('[octo] sticker eval:', err.message);
    } finally {
      try {
        if (attachedHere) dbg.detach();
      } catch {
        /* debugger уже отключён */
      }
    }
  }

  try {
    return await withTimeout(wc.executeJavaScript(code, true), timeout, 'таймаут выполнения');
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker eval fallback:', err.message);
    return null;
  }
}

let sending = false;

async function send(id) {
  if (sending) {
    toast('Подождите: предыдущий стикер ещё отправляется');
    return { ok: false, error: 'busy' };
  }

  sending = true;
  try {
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      toast('Стикер не найден');
      return { ok: false, error: 'not-found' };
    }

    const wc = ctx.view?.webContents;
    if (!wc || wc.isDestroyed()) {
      toast('Страница TikTok ещё не готова');
      return { ok: false, error: 'no-page' };
    }

    const file = itemFile(item);
    if (!fs.existsSync(file)) {
      toast('Файл стикера пропал — удалите его из панели');
      return { ok: false, error: 'no-file' };
    }

    // Не трогаем чужие input[type=file] (например, загрузку аватара):
    // отправляем только когда на странице есть поле сообщения.
    const chatReady = await evaluate(wc, CHAT_READY_EXPR, { timeout: 4000 });
    if (!chatReady) {
      toast('Откройте диалог в «Сообщениях» TikTok и выберите собеседника');
      return { ok: false, error: 'not-chat' };
    }

    let attached = await attachWithDebugger(wc, file);
    if (!attached) attached = await attachWithFileChooser(wc, file);

    if (!attached) {
      try {
        const base64 = fs.readFileSync(file).toString('base64');
        const fileName = `sticker${item.ext}`;
        attached = await evaluate(wc, fallbackScript(base64, MIME[item.ext], fileName));
      } catch (err) {
        if (process.env.OCTO_DEBUG) console.warn('[octo] sticker fallback:', err.message);
        attached = null;
      }
    }

    if (!attached || attached.mode === 'none') {
      toast('Откройте диалог в «Сообщениях» TikTok — стикер отправится как фото');
      return { ok: false, error: attached?.reason || 'no-target' };
    }

    // Даём сайту создать превью и включаем кнопку отправки.
    await new Promise((resolve) => setTimeout(resolve, 650));
    const sent = await evaluate(wc, autoSendScript(), { timeout: 8000 });

    if (sent?.clicked) toast('Стикер отправлен');
    else toast('Стикер прикреплён — нажмите «Отправить» в чате');

    pushState();
    return { ok: true, mode: attached.mode, sent: Boolean(sent?.clicked) };
  } finally {
    sending = false;
  }
}

module.exports = {
  registerScheme,
  init,
  addFromDialog,
  remove,
  openFolder,
  send,
};
