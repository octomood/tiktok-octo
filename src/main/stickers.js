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
 *
 * Чат ищется в том webContents, который сейчас показывает переписку: это либо
 * основная лента (полная страница сообщений), либо отдельная панель «Чат
 * сбоку» (ctx.chatView).
 */

const { app, nativeImage, protocol, shell } = require('electron');
const { showOpenDialog } = require('./dialogs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { ctx, pushState, toast } = require('./app-context');
const { isTikTokUrl } = require('./shared');

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
  // У брошенного в чат файла путь уже готов: копировать его в стикеры незачем.
  if (item && typeof item.file === 'string') return item.file;
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

/** Совпадает ли accept с картинкой: MIME, `image/*` или список расширений. */
function isImageAccept(value) {
  const accept = String(value || '').toLowerCase();
  if (!accept || accept.includes('image') || accept.includes('*')) return true;
  return /(?:^|[,;\s])\.?(?:png|jpe?g|webp|gif)(?:[,;\s]|$)/.test(accept);
}

async function addFromDialog() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  let result;
  try {
    result = await showOpenDialog(ctx.win, {
      title: 'Добавить картинки',
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
        ? `Добавлено картинок: ${added}, пропущено: ${skipped}`
        : `Добавлено картинок: ${added}`,
    );
  } else {
    toast('Не удалось добавить картинки: нужен PNG, JPG, WebP или GIF до 8 МБ');
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
  toast('Картинка удалена');
}

function openFolder() {
  if (!rootDir) return;
  shell.openPath(rootDir).then((error) => {
    if (error) toast('Не удалось открыть папку картинок');
  });
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Поиск по документу и открытым shadow root: чат TikTok и его кнопки вложения
// могут жить в web-компонентах, до которых document.querySelector не достаёт.
const DEEP_QUERY_EXPR = `
  const deepAll = (selector, root = document, out = []) => {
    if (!root || !root.querySelectorAll) return out;
    out.push(...root.querySelectorAll(selector));
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) deepAll(selector, element.shadowRoot, out);
    }
    return out;
  };
  const deepFind = (selector, root = document) => {
    if (!root || !root.querySelector) return null;
    const direct = root.querySelector(selector);
    if (direct) return direct;
    for (const element of root.querySelectorAll('*')) {
      if (!element.shadowRoot) continue;
      const nested = deepFind(selector, element.shadowRoot);
      if (nested) return nested;
    }
    return null;
  };
  const isSearchField = (element) => {
    if (element.getAttribute('role') === 'searchbox') return true;
    const label = element.getAttribute('aria-label') || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const type = element.getAttribute('type') || '';
    return /search|поиск/i.test(label + ' ' + placeholder + ' ' + type);
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
  };
  const isImageInput = (input) => {
    if (!input || input.disabled) return false;
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    if (!accept || accept.includes('image') || accept.includes('*')) return true;
    // Некоторые сборки чата перечисляют расширения вместо MIME.
    return /(?:^|[,;\\s])\\.?(?:png|jpe?g|webp|gif)(?:[,;\\s]|$)/.test(accept);
  };
  const isTypingField = (element) => {
    if (!element || element.disabled) return false;
    const tag = element.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      return type === 'text' || type === 'search';
    }
    // TikTok может ставить contenteditable="plaintext-only" или пустое
    // значение — старый селектор [contenteditable="true"] такое поле пропускал.
    return element.isContentEditable === true;
  };
  const COMPOSER_SELECTOR = [
    '[role="textbox"]',
    '[contenteditable]:not([contenteditable="false"])',
    'textarea',
    'input[type="text"]',
    'input:not([type])'
  ].join(',');
  const describe = (element) =>
    (element.getAttribute('aria-label') || '') +
    ' ' +
    (element.getAttribute('placeholder') || '') +
    ' ' +
    (element.getAttribute('data-e2e') || '') +
    ' ' +
    (typeof element.className === 'string' ? element.className : '');
  // На странице сообщений несколько редакторов: поиск в списке чатов и поле
  // сообщения. Ищем именно поле сообщения, а не первый элемент DOM.
  const findComposer = () => {
    const composers = deepAll(COMPOSER_SELECTOR).filter(
      (element) => isTypingField(element) && !isSearchField(element) && isVisible(element)
    );
    if (!composers.length) return null;
    const messageRe = /message|сообщен|chat|чат|отправ|reply|ответ/i;
    let preferred = null;
    for (const element of composers) {
      if (messageRe.test(describe(element))) preferred = element;
    }
    return preferred || composers[composers.length - 1];
  };
  const chatLikePage = () =>
    /(?:messages|inbox|chat)/i.test(location.pathname) ||
    /business\\./i.test(location.hostname);
  const hasVisibleSendButton = () =>
    deepAll('button, [role="button"]').some((element) => {
      if (!isVisible(element)) return false;
      const hint =
        (element.getAttribute('aria-label') || '') +
        ' ' +
        (element.getAttribute('data-e2e') || '') +
        ' ' +
        (typeof element.className === 'string' ? element.className : '') +
        ' ' +
        (element.textContent || '');
      return /send|отправ/i.test(hint);
    });
`;

const CHAT_READY_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const composer = findComposer();
  if (composer) {
    const aria = (composer.getAttribute('aria-label') || '').toLowerCase();
    if (/message|сообщен|chat|чат|отправ/.test(aria)) return true;
  }
  const chatLike = chatLikePage();
  // В Business Suite путь не всегда /messages, поэтому ориентируемся на
  // видимую кнопку отправки рядом с редактором.
  if (composer && chatLike && hasVisibleSendButton()) return true;
  if (!chatLike) return false;
  if (composer) return true;
  // Иногда поле сообщения — web component с закрытым shadow root, а поле
  // загрузки картинки остаётся в обычном DOM.
  return deepAll('input[type="file"]').some(isImageInput);
})()`;

const FIND_UPLOAD_BUTTON_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const composer = findComposer();
  const composerRect = composer ? composer.getBoundingClientRect() : null;
  const re = /(?:photo|image|picture|upload|attach|media|фото|изображ|вложен|прикреп|файл|добав)/i;
  const buttons = deepAll('button, [role="button"]').filter((element) => {
    if (!isVisible(element)) return false;
    const aria = element.getAttribute('aria-label') || '';
    const title = element.getAttribute('title') || '';
    const e2e = element.getAttribute('data-e2e') || '';
    const cls = typeof element.className === 'string' ? element.className : '';
    const text = (element.textContent || '').trim();
    return (
      re.test(aria) || re.test(title) || re.test(e2e) || re.test(cls) || re.test(text)
    );
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

// «+» в чате TikTok открывает меню «Фото/Видео», и только потом — системный
// выбор файла. Кликаем пункт «Фото», пока перехват диалога ещё включён.
const FIND_PHOTO_MENU_ITEM_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const re = /(?:photo|image|picture|media|фото|изображ|медиа|картин)/i;
  const items = deepAll(
    'button, [role="menuitem"], [role="option"], [role="button"], li'
  ).filter((element) => {
    if (!isVisible(element)) return false;
    const hint =
      (element.getAttribute('aria-label') || '') +
      ' ' +
      (element.getAttribute('data-e2e') || '') +
      ' ' +
      (element.textContent || '');
    return re.test(hint);
  });
  return items[items.length - 1] || null;
})()`;

// Метка на элементе в iframe и поиск его абсолютной точки в главном окне.
// Нужна, чтобы нажать кнопку вложения доверенным Input.dispatchMouseEvent:
// без user activation сайт не открывает системный выбор файла.
const TARGET_ATTR = 'data-octo-sticker-target';

function markTargetExpr(expression, marker) {
  return `(() => {
    const element = ${expression};
    if (!element || !element.setAttribute) return null;
    document
      .querySelectorAll('[${TARGET_ATTR}]')
      .forEach((node) => node.removeAttribute('${TARGET_ATTR}'));
    element.setAttribute('${TARGET_ATTR}', ${JSON.stringify(marker)});
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`;
}

function markedPointExpr(marker) {
  return `(() => {
    const ATTR = ${JSON.stringify(TARGET_ATTR)};
    const VALUE = ${JSON.stringify(marker)};
    const findMarked = (root) => {
      if (!root || !root.querySelector) return null;
      const direct = root.querySelector('[' + ATTR + '="' + VALUE + '"]');
      if (direct) return direct;
      for (const element of root.querySelectorAll('*')) {
        if (!element.shadowRoot) continue;
        const nested = findMarked(element.shadowRoot);
        if (nested) return nested;
      }
      return null;
    };
    const find = (doc, offsetX, offsetY) => {
      if (!doc) return null;
      const marked = findMarked(doc);
      if (marked) {
        const rect = marked.getBoundingClientRect();
        marked.removeAttribute(ATTR);
        return { x: offsetX + rect.left + rect.width / 2, y: offsetY + rect.top + rect.height / 2 };
      }
      for (const frame of doc.querySelectorAll('iframe')) {
        try {
          const rect = frame.getBoundingClientRect();
          const nested = find(
            frame.contentDocument,
            offsetX + rect.left + frame.clientLeft,
            offsetY + rect.top + frame.clientTop
          );
          if (nested) return nested;
        } catch {
          /* чужой фрейм */
        }
      }
      return null;
    };
    return find(document, 0, 0);
  })()`;
}

/**
 * Видимые кнопки в строке поля сообщения. Нужны, когда кнопка вложения —
 * безликая иконка без aria-label и понятного класса: её можно найти только
 * по положению рядом с редактором.
 */
const COMPOSER_CONTROLS_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const composer = findComposer();
  if (!composer) return { point: null, controls: [] };
  const rect = composer.getBoundingClientRect();
  const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const scope =
    composer.closest('form') ||
    composer.parentElement?.parentElement ||
    composer.parentElement ||
    document;
  const collect = (root) =>
    deepAll('button, [role="button"], [role="menuitem"], [tabindex]', root)
      .filter((element) => element !== composer && isVisible(element))
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          aria: element.getAttribute('aria-label') || '',
          title: element.getAttribute('title') || '',
          e2e: element.getAttribute('data-e2e') || '',
          cls: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
          text: (element.textContent || '').trim().slice(0, 40),
          x: Math.round(box.left + box.width / 2),
          y: Math.round(box.top + box.height / 2),
          dx: Math.round(box.left + box.width / 2 - (rect.left + rect.width / 2)),
          dy: Math.round(box.top + box.height / 2 - (rect.top + rect.height / 2)),
          disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
        };
      })
      .filter((item) => Math.abs(item.dy) < 90 && Math.abs(item.dx) < 280);
  let controls = collect(scope);
  // Разметка Business Suite может держать панель кнопок вне контейнера поля.
  if (controls.length < 2) controls = collect(document);
  return { point, controls: controls.slice(0, 24) };
})()`;

const FIND_INPUT_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const inputs = deepAll('input[type="file"]').filter(isImageInput);
  if (!inputs.length) return null;

  const composer = findComposer();
  const scope =
    composer?.closest(
      '[data-e2e*="chat"], [data-e2e*="message"], [class*="Chat"], [class*="chat"], [class*="Message"], [class*="message"], form'
    ) ||
    (chatLikePage()
      ? deepFind('[data-e2e*="chat"], [data-e2e*="message"], [class*="Chat"], [class*="Message"]')
      : null);
  if (scope) {
    const scoped = inputs.filter((input) => scope.contains(input));
    if (scoped.length) return scoped[scoped.length - 1];
  }
  return inputs[inputs.length - 1];
})()`;

/** Штатная кнопка стикеров TikTok в поле сообщения. */
const FIND_STICKER_BUTTON_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const composer = findComposer();
  const composerRect = composer ? composer.getBoundingClientRect() : null;
  const re = /(?:sticker|стикер)/i;
  const buttons = deepAll('button, [role="button"]').filter((element) => {
    if (!isVisible(element)) return false;
    const hint =
      (element.getAttribute('aria-label') || '') +
      ' ' +
      (element.getAttribute('title') || '') +
      ' ' +
      (element.getAttribute('data-e2e') || '') +
      ' ' +
      (typeof element.className === 'string' ? element.className : '') +
      ' ' +
      (element.textContent || '');
    return re.test(hint);
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

/** Если отдельной кнопки стикеров нет — открываем эмодзи, там обычно вкладка. */
const FIND_EMOJI_BUTTON_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const composer = findComposer();
  const composerRect = composer ? composer.getBoundingClientRect() : null;
  const re = /(?:emoji|emoticon|smile|смайл|эмодзи)/i;
  const buttons = deepAll('button, [role="button"]').filter((element) => {
    if (!isVisible(element)) return false;
    const hint =
      (element.getAttribute('aria-label') || '') +
      ' ' +
      (element.getAttribute('title') || '') +
      ' ' +
      (element.getAttribute('data-e2e') || '') +
      ' ' +
      (typeof element.className === 'string' ? element.className : '') +
      ' ' +
      (element.textContent || '');
    return re.test(hint);
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

/** Вкладка «Стикеры» внутри панели эмодзи. */
const FIND_STICKER_TAB_EXPR = `(() => {
  ${DEEP_QUERY_EXPR}
  const re = /^(?:stickers?|стикеры?)$/i;
  return (
    deepAll('button, [role="tab"], [role="button"], [role="menuitem"]').find((element) => {
      if (!isVisible(element)) return false;
      const hint = (
        (element.getAttribute('aria-label') || '') +
        ' ' +
        (element.textContent || '')
      ).trim();
      return re.test(hint);
    }) || null
  );
})()`;

function framesOf(wc) {
  try {
    const main = wc.mainFrame;
    const list = Array.isArray(main.framesInSubtree)
      ? main.framesInSubtree
      : [main, ...(Array.isArray(main.frames) ? main.frames : [])];
    const mainOrigin = main.origin;
    return list.filter((frame) => {
      if (!frame || frame.isDestroyed?.()) return false;
      if (frame === main) return true;
      const url = frame.url || '';
      if (url.startsWith('about:')) return true;
      if (isTikTokUrl(url)) return true;
      return frame.origin === mainOrigin;
    });
  } catch {
    return [];
  }
}

/** Чат может жить в панели слева (ctx.chatView), а не в основной ленте. */
function targetWebContents() {
  if (ctx.chatOpen) {
    const chat = ctx.chatView?.webContents;
    if (chat && !chat.isDestroyed()) return chat;
  }
  const main = ctx.view?.webContents;
  return main && !main.isDestroyed() ? main : null;
}

async function evaluateFrame(frame, code, { timeout = 8000 } = {}) {
  if (!frame || frame.isDestroyed?.()) return null;
  try {
    return await withTimeout(frame.executeJavaScript(code, true), timeout, 'таймаут выполнения');
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker frame eval:', err.message);
    return null;
  }
}

/** Хост и путь без query: в ссылках TikTok бывают токены, их не логируем. */
function describeUrl(raw) {
  try {
    const url = new URL(raw || '');
    return `${url.host}${url.pathname}`.slice(0, 120);
  } catch {
    return '';
  }
}

function pageLabel(wc) {
  try {
    const url = new URL(wc.getURL());
    return `${url.host}${url.pathname}`.slice(0, 80);
  } catch {
    return '';
  }
}

/** Последняя попытка отправки — для диагностики, без URL-параметров и текста. */
function writeSendLog(entry) {
  if (!rootDir) return;
  try {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'send.log'),
      JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2),
      'utf8',
    );
  } catch {
    /* каталог недоступен — диагностика не критична */
  }
}

/**
 * Ищет фрейм с открытым чатом. Все фреймы проверяются параллельно с коротким
 * таймаутом: на странице ленты их десятки, и последовательные ожидания по 4 с
 * превращались в минуту «ничего не происходит» с вечным тостом «подождите».
 */
async function findChatFrame(wc) {
  const frames = framesOf(wc);
  if (process.env.OCTO_DEBUG) {
    console.warn(
      '[octo] sticker frames:',
      frames.map((frame) => describeUrl(frame.url)).join(' | '),
    );
  }
  if (!frames.length) return null;

  const main = wc.mainFrame;
  const results = await Promise.all(
    frames.map(async (frame) => ({
      frame,
      ready: Boolean(
        await evaluateFrame(frame, CHAT_READY_EXPR, { timeout: frame === main ? 2500 : 1500 }),
      ),
    })),
  );

  const mainResult = results.find((entry) => entry.frame === main);
  if (mainResult?.ready) return main;
  return results.find((entry) => entry.ready)?.frame || null;
}

/**
 * Ищет input[type=file] через DOM-агент CDP. В отличие от querySelector он
 * видит и закрытые shadow root — Business Suite иногда прячет поле загрузки
 * именно там.
 */
async function attachWithDomTree(dbg, file) {
  try {
    await withTimeout(dbg.sendCommand('DOM.enable'), 2000, 'DOM.enable');
    const doc = await withTimeout(
      dbg.sendCommand('DOM.getDocument', { depth: -1, pierce: true }),
      5000,
      'дерево DOM',
    );

    const inputs = [];
    const walk = (node) => {
      if (!node) return;
      if (node.nodeName === 'INPUT' && node.backendNodeId) {
        const attrs = {};
        const list = Array.isArray(node.attributes) ? node.attributes : [];
        for (let index = 0; index + 1 < list.length; index += 2) {
          attrs[list[index].toLowerCase()] = list[index + 1];
        }
        if (
          (attrs.type || '').toLowerCase() === 'file' &&
          !('disabled' in attrs) &&
          isImageAccept(attrs.accept)
        ) {
          inputs.push(node);
        }
      }
      for (const child of node.children || []) walk(child);
      for (const shadow of node.shadowRoots || []) walk(shadow);
      if (node.contentDocument) walk(node.contentDocument);
    };
    walk(doc?.root);
    if (!inputs.length) return null;

    const input = inputs[inputs.length - 1];
    await withTimeout(
      dbg.sendCommand('DOM.setFileInputFiles', {
        files: [file],
        backendNodeId: input.backendNodeId,
      }),
      4000,
      'прикрепление файла через DOM',
    );
    return { mode: 'input' };
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker dom input:', err.message);
    return null;
  }
}

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
        3000,
        'поиск поля загрузки',
      );
      objectId = found?.result?.objectId || '';
      if (!objectId) {
        // Поле может быть в закрытом shadow root: querySelector его не видит.
        const fromDom = await attachWithDomTree(dbg, file);
        if (fromDom) return fromDom;
        return null;
      }

      await withTimeout(
        dbg.sendCommand('DOM.setFileInputFiles', { files: [file], objectId }),
        4000,
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
async function attachWithFileChooser(wc, file, frame = wc.mainFrame, report = null) {
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
    await withTimeout(dbg.sendCommand('Page.enable'), 2000, 'Page.enable');
    await withTimeout(
      dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true }),
      2000,
      'перехват выбора файла',
    );
    dbg.on('message', onMessage);

    const evaluateValue = async (expression, timeout, label) => {
      if (frame && frame !== wc.mainFrame) {
        return await evaluateFrame(frame, expression, { timeout });
      }
      const result = await withTimeout(
        dbg.sendCommand('Runtime.evaluate', {
          expression,
          returnByValue: true,
          userGesture: true,
        }),
        timeout,
        label,
      );
      return result?.result?.value ?? null;
    };

    const waitForChooser = async (ms) => {
      const until = Date.now() + ms;
      while (Date.now() < until && !backendNodeId) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return Boolean(backendNodeId);
    };

    // Меню «Фото/Видео» может отрисоваться в главном документе, даже если
    // кнопка вложения находится в iframe Business Suite.
    const clickPhotoEverywhere = async () => {
      const candidates = [frame, wc.mainFrame, ...framesOf(wc)];
      const seen = new Set();
      for (const candidate of candidates) {
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        try {
          if (await clickExprTrusted(FIND_PHOTO_MENU_ITEM_EXPR, candidate, 'пункт «Фото»')) {
            return true;
          }
        } catch {
          /* фрейм уже ушёл */
        }
      }
      return false;
    };

    const info = await evaluateValue(COMPOSER_CONTROLS_EXPR, 2500, 'кнопки поля сообщения');
    if (report) {
      report.controls = (info?.controls || []).map((item) => ({
        tag: item.tag,
        aria: item.aria,
        title: item.title,
        e2e: item.e2e,
        cls: item.cls,
        text: item.text,
        dx: item.dx,
        dy: item.dy,
        disabled: item.disabled,
      }));
      writeSendLog(report);
    }

    // Кнопка вложения может появляться только при наведении на поле.
    if (frame === wc.mainFrame && info?.point) {
      try {
        await withTimeout(
          dbg.sendCommand('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: Math.round(info.point.x),
            y: Math.round(info.point.y),
          }),
          1500,
          'наведение на поле сообщения',
        );
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch {
        /* наведение не критично */
      }
    }

    const clickAt = async (x, y) => {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await withTimeout(
          dbg.sendCommand('Input.dispatchMouseEvent', {
            type,
            x,
            y,
            button: 'left',
            clickCount: 1,
            buttons: type === 'mousePressed' ? 1 : 0,
          }),
          2000,
          'клик по кнопке вложения',
        );
      }
    };

    /**
     * Нажимает элемент доверенным кликом CDP. В iframe координаты находим,
     * помечая элемент и складывая смещения вложенных документов.
     */
    const clickExprTrusted = async (expression, targetFrame, label) => {
      const marker = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      let marked = null;
      try {
        marked = await evaluateFrame(targetFrame, markTargetExpr(expression, marker), {
          timeout: 2500,
        });
      } catch {
        marked = null;
      }
      if (!marked) return false;

      let point = targetFrame === wc.mainFrame ? marked : null;
      if (!point && targetFrame !== wc.mainFrame) {
        point = await evaluateFrame(wc.mainFrame, markedPointExpr(marker), { timeout: 2500 });
        if (process.env.OCTO_DEBUG) {
          console.warn('[octo] sticker frame point:', label, Boolean(point));
        }
      }
      try {
        if (point) {
          await clickAt(Math.round(point.x), Math.round(point.y));
          return true;
        }
        // Чужой фрейм: координаты не сложить, кликаем помеченный элемент.
        return Boolean(
          await evaluateFrame(
            targetFrame,
            `(() => {
              const element = document.querySelector('[${TARGET_ATTR}="${marker}"]');
              if (!element) return false;
              element.click();
              return true;
            })()`,
            { timeout: 2000 },
          ),
        );
      } finally {
        try {
          await evaluateFrame(
            targetFrame,
            `document.querySelectorAll('[${TARGET_ATTR}]').forEach((node) => node.removeAttribute('${TARGET_ATTR}'))`,
            { timeout: 1000 },
          );
        } catch {
          /* фрейм уже ушёл */
        }
      }
    };

    const pressEscape = async () => {
      try {
        for (const type of ['rawKeyDown', 'keyUp']) {
          await withTimeout(
            dbg.sendCommand('Input.dispatchKeyEvent', {
              type,
              key: 'Escape',
              code: 'Escape',
              windowsVirtualKeyCode: 27,
            }),
            1500,
            'Escape',
          );
        }
      } catch {
        /* меню могло закрыться само */
      }
    };

    let handled = false;
    const uploadClicked = await clickExprTrusted(FIND_UPLOAD_BUTTON_EXPR, frame, 'кнопка вложения');
    if (uploadClicked) {
      handled = await waitForChooser(900);
      if (!handled && (await clickPhotoEverywhere())) {
        handled = await waitForChooser(1500);
      }
    }

    // Безликая иконка вложения: пробуем видимые кнопки рядом с редактором.
    if (!handled && frame === wc.mainFrame) {
      const current = await evaluateValue(COMPOSER_CONTROLS_EXPR, 2500, 'кнопки поля сообщения');
      const list = Array.isArray(current?.controls) ? current.controls : [];
      const hintOf = (item) => `${item.aria} ${item.title} ${item.e2e} ${item.text} ${item.cls}`;
      const banned =
        /send|emoji|gif|sticker|voice|mic|call|video|gift|settings|отправ|смайл|стикер|голос|звон|настро/i;
      const preferred =
        /attach|upload|photo|image|media|файл|фото|изображ|вложен|прикреп|plus|add|добав|\+/i;
      const usable = list.filter((item) => !item.disabled && !banned.test(hintOf(item)));
      const matched = usable.filter((item) => preferred.test(hintOf(item)));
      const iconOnly = usable
        .filter((item) => !String(item.text || '').trim() && item.dx < 80)
        .sort((left, right) => Math.abs(left.dx) - Math.abs(right.dx));
      const candidates = [...matched, ...iconOnly].slice(0, 5);

      if (report) {
        report.candidates = candidates.map((item) => ({
          aria: item.aria,
          title: item.title,
          e2e: item.e2e,
          cls: item.cls,
          text: item.text,
          dx: item.dx,
          dy: item.dy,
        }));
        writeSendLog(report);
      }

      for (const candidate of candidates) {
        try {
          await clickAt(candidate.x, candidate.y);
          if (await waitForChooser(700)) {
            handled = true;
            break;
          }
          if (await clickPhotoEverywhere()) {
            if (await waitForChooser(1200)) {
              handled = true;
              break;
            }
          }
          await pressEscape();
        } catch (err) {
          if (process.env.OCTO_DEBUG) console.warn('[octo] sticker control click:', err.message);
        }
      }
    }

    if (!handled || !backendNodeId) return null;

    await withTimeout(
      dbg.sendCommand('DOM.setFileInputFiles', { files: [file], backendNodeId }),
      4000,
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
      // Без таймаута эта очистка могла висеть вечно, а вместе с ней и весь
      // send(): `sending` не сбрасывался, и каждый следующий клик отвечал
      // «подождите, предыдущий стикер ещё отправляется».
      await withTimeout(
        dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: false }),
        1500,
        'снятие перехвата выбора файла',
      );
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

/**
 * Настоящий drag-and-drop через CDP: события получают isTrusted, поэтому
 * чаты, которые игнорируют синтетический drop из страницы, принимают файл.
 */
async function attachWithDrag(wc, frame, file) {
  const dbg = wc.debugger;
  if (!dbg || frame !== wc.mainFrame) return null;

  let attachedHere = false;
  try {
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      attachedHere = true;
    }
    const evaluated = await withTimeout(
      dbg.sendCommand('Runtime.evaluate', {
        expression: `(() => {
          ${DEEP_QUERY_EXPR}
          const composer = findComposer();
          if (!composer) return null;
          const rect = composer.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()`,
        returnByValue: true,
      }),
      3000,
      'позиция поля сообщения',
    );
    const point = evaluated?.result?.value;
    if (!point) return null;

    const data = {
      items: [{ mimeType: MIME[extensionOf(file)] || 'application/octet-stream', data: '' }],
      files: [file],
      dragOperationsMask: 1,
    };
    for (const type of ['dragEnter', 'dragOver', 'drop']) {
      await withTimeout(
        dbg.sendCommand('Input.dispatchDragEvent', {
          type,
          x: Math.round(point.x),
          y: Math.round(point.y),
          data,
        }),
        3000,
        `перетаскивание ${type}`,
      );
    }
    return { mode: 'drag' };
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker drag:', err.message);
    return null;
  } finally {
    try {
      if (attachedHere) dbg.detach();
    } catch {
      /* debugger уже отключён */
    }
  }
}

/**
 * Доверенный клик по элементу из main-процесса. Работает и во вложенном
 * фрейме: элемент помечается, его абсолютная точка ищется в главном документе.
 */
async function dispatchTrustedClick(dbg, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await dbg.sendCommand('Input.dispatchMouseEvent', {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1,
      buttons: type === 'mousePressed' ? 1 : 0,
    });
  }
}

async function trustedClickElement(wc, frame, expression) {
  const dbg = wc.debugger;
  if (!dbg || !frame) return false;

  let attachedHere = false;
  const marker = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      attachedHere = true;
    }
    const marked = await evaluateFrame(frame, markTargetExpr(expression, marker), {
      timeout: 2500,
    });
    if (!marked) return false;

    const point =
      frame === wc.mainFrame
        ? marked
        : await evaluateFrame(wc.mainFrame, markedPointExpr(marker), { timeout: 2500 });
    if (!point) return false;
    await dispatchTrustedClick(dbg, point.x, point.y);
    return true;
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] trusted click:', err.message);
    return false;
  } finally {
    try {
      await evaluateFrame(
        frame,
        `document.querySelectorAll('[${TARGET_ATTR}]').forEach((node) => node.removeAttribute('${TARGET_ATTR}'))`,
        { timeout: 1000 },
      );
    } catch {
      /* фрейм уже ушёл */
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
  ${DEEP_QUERY_EXPR}
  const b64 = ${JSON.stringify(base64)};
  const mime = ${JSON.stringify(mime)};
  const name = ${JSON.stringify(name)};
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index += 1) bytes[index] = bin.charCodeAt(index);
  const file = new File([bytes], name, { type: mime });
  const data = new DataTransfer();
  data.items.add(file);

  const inputs = deepAll('input[type="file"]').filter(isImageInput);
  const composer = findComposer();
  const scope =
    composer?.closest(
      '[data-e2e*="chat"], [data-e2e*="message"], [class*="Chat"], [class*="chat"], [class*="Message"], [class*="message"], form'
    ) || null;
  const scoped = scope ? inputs.filter((input) => scope.contains(input)) : [];
  const input = scoped[scoped.length - 1] || inputs[inputs.length - 1] || null;
  if (input) {
    try {
      input.files = data.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { mode: 'input' };
    } catch {
      /* некоторые браузерные поля запрещают подмену files — пробуем drop */
    }
  }

  const target =
    findComposer() ||
    deepFind('[data-e2e*="chat"]') ||
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
  ${DEEP_QUERY_EXPR}
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
    deepAll('button, [role="button"]').filter((element) => {
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

/**
 * TikTok отвечает на фото в DM ошибкой «Эта функция недоступна в стране или
 * регионе получателя». Ловим её, чтобы не писать «отправлено» зря.
 */
const REGION_ERROR_EXPR = `(() => {
  const text = document.body ? document.body.innerText || '' : '';
  return /недоступн[а-я]*\\s+в\\s+стране\\s+или\\s+регионе|not available in .*region|not available in your (?:country|region)/i.test(
    text
  );
})()`;

const SEND_TIMEOUT_MS = Number(process.env.OCTO_STICKER_SEND_TIMEOUT_MS) || 25_000;

let sending = false;
/** Тикет активной отправки: старый «зависший» вызов не должен мешать новому. */
let activeSend = 0;
let sendSeq = 0;

/**
 * Прикрепляет файл внутри конкретного фрейма. Основной путь — подменить files
 * у input[type=file] и отправить change; если поля нет, пробуем drop/paste в
 * поле сообщения. Работает и в iframe, и в shadow root.
 */
async function attachInFrame(frame, file, item) {
  try {
    const base64 = fs.readFileSync(file).toString('base64');
    const name = `sticker${item.ext}`;
    const result = await evaluateFrame(frame, fallbackScript(base64, MIME[item.ext], name), {
      timeout: 8000,
    });
    if (result && result.mode && result.mode !== 'none') return result;
    return null;
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker frame attach:', err.message);
    return null;
  }
}

async function runSend(item, wc, ticket, report) {
  const file = itemFile(item);
  if (!fs.existsSync(file)) {
    report.stage = 'no-file';
    toast('Файл картинки пропал — удалите его из панели');
    return { ok: false, error: 'no-file' };
  }

  // Не трогаем чужие input[type=file] (например, загрузку аватара):
  // отправляем только когда на странице есть поле сообщения. Business Suite
  // держит чат во вложенном фрейме, поэтому проверяем всё дерево.
  report.stage = 'find-chat';
  writeSendLog(report);
  const chatFrame = await findChatFrame(wc);
  if (!chatFrame) {
    report.stage = 'not-chat';
    toast(
      report.page
        ? `Чат не найден на странице ${report.page} — откройте диалог в «Сообщениях» TikTok`
        : 'Откройте диалог в «Сообщениях» TikTok и выберите собеседника',
    );
    return { ok: false, error: 'not-chat', page: report.page };
  }
  if (activeSend !== ticket) return { ok: false, error: 'timeout' };

  report.stage = 'chat-found';
  report.frame = describeUrl(chatFrame.url);
  writeSendLog(report);
  if (process.env.OCTO_DEBUG) {
    console.warn('[octo] sticker chat frame:', report.frame);
  }

  let attached = null;
  if (chatFrame === wc.mainFrame) {
    report.stage = 'attach-input';
    writeSendLog(report);
    attached = await attachWithDebugger(wc, file);
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker attach input:', Boolean(attached));
    if (!attached && activeSend === ticket) {
      report.stage = 'attach-chooser';
      writeSendLog(report);
      attached = await attachWithFileChooser(wc, file, wc.mainFrame, report);
      if (process.env.OCTO_DEBUG) {
        console.warn('[octo] sticker attach file chooser:', Boolean(attached));
      }
    }
  }

  // Во фрейме сначала перехватываем системный диалог: если чат создаёт
  // input только по клику на фото, drop/paste ничего не докажет.
  if (!attached && activeSend === ticket && chatFrame !== wc.mainFrame) {
    report.stage = 'attach-chooser-frame';
    writeSendLog(report);
    attached = await attachWithFileChooser(wc, file, chatFrame, report);
    if (process.env.OCTO_DEBUG) {
      console.warn('[octo] sticker attach file chooser (frame):', Boolean(attached));
    }
  }
  if (!attached && activeSend === ticket) {
    report.stage = 'attach-drag';
    writeSendLog(report);
    attached = await attachWithDrag(wc, chatFrame, file);
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker attach drag:', Boolean(attached));
  }
  if (!attached && activeSend === ticket) {
    report.stage = 'attach-fallback';
    writeSendLog(report);
    attached = await attachInFrame(chatFrame, file, item);
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker attach fallback:', Boolean(attached));
  }

  if (activeSend !== ticket) return { ok: false, error: 'timeout' };

  if (!attached || attached.mode === 'none') {
    report.stage = 'no-target';
    toast('Чат открыт, но поле загрузки не найдено — откройте диалог заново');
    return { ok: false, error: attached?.reason || 'no-target' };
  }

  report.stage = 'attached';
  report.mode = attached.mode;
  writeSendLog(report);

  // Даём сайту создать превью и включаем кнопку отправки.
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (activeSend !== ticket) return { ok: false, error: 'timeout' };
  report.stage = 'autosend';
  writeSendLog(report);
  const sent = await evaluateFrame(chatFrame, autoSendScript(), { timeout: 6000 });
  if (activeSend !== ticket) return { ok: false, error: 'timeout' };

  report.stage = 'done';
  report.sent = Boolean(sent?.clicked);

  // После отправки TikTok может ответить баннером «недоступно в регионе».
  let regionBlocked = false;
  if (sent?.clicked) {
    for (let attempt = 0; attempt < 4 && !regionBlocked; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      regionBlocked = Boolean(await evaluateFrame(chatFrame, REGION_ERROR_EXPR, { timeout: 2000 }));
    }
  }
  report.regionBlocked = regionBlocked;

  if (regionBlocked) {
    toast('Получатель не может получать фото в личных сообщениях — картинка не доставлена');
  } else if (sent?.clicked) {
    toast('Картинка отправлена');
  } else {
    toast('Картинка прикреплена — нажмите «Отправить» в чате');
  }

  pushState();
  return {
    ok: !regionBlocked,
    mode: attached.mode,
    sent: Boolean(sent?.clicked),
    regionBlocked,
  };
}

/**
 * Открывает штатную панель стикеров/эмодзи TikTok. Свои PNG туда добавить
 * нельзя — это только родные стикеры сайта, зато они работают во всех
 * регионах, где доступны личные сообщения.
 */
async function openNativePanel() {
  const wc = targetWebContents();
  if (!wc) {
    toast('Страница TikTok ещё не готова');
    return { ok: false, error: 'no-page' };
  }

  const chatFrame = await findChatFrame(wc);
  if (!chatFrame) {
    toast('Откройте диалог в «Сообщениях» TikTok и выберите собеседника');
    return { ok: false, error: 'not-chat' };
  }

  let opened = await trustedClickElement(wc, chatFrame, FIND_STICKER_BUTTON_EXPR);
  if (!opened) opened = await trustedClickElement(wc, chatFrame, FIND_EMOJI_BUTTON_EXPR);
  if (!opened) {
    toast('Не удалось открыть стикеры TikTok');
    return { ok: false, error: 'no-button' };
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  for (const frame of [chatFrame, wc.mainFrame]) {
    if (await trustedClickElement(wc, frame, FIND_STICKER_TAB_EXPR)) break;
  }

  toast('Стикеры TikTok открыты — выберите стикер');
  return { ok: true };
}

async function send(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    toast('Картинка не найдена');
    return { ok: false, error: 'not-found' };
  }
  return sendItem(item);
}

/** Файл с диска (например, брошенный в чат): без добавления в стикеры. */
async function sendFile(source) {
  const ext = extensionOf(source);
  if (!ext || !MIME[ext]) {
    toast('Можно отправить только PNG, JPG, WebP или GIF');
    return { ok: false, error: 'not-image' };
  }

  try {
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size > MAX_BYTES) {
      toast('Файл слишком большой для отправки');
      return { ok: false, error: 'too-big' };
    }
  } catch {
    toast('Не удалось прочитать файл');
    return { ok: false, error: 'no-file' };
  }

  return sendItem({ id: 'dropped', ext, name: path.basename(source), file: source });
}

async function sendItem(item) {
  if (sending) {
    // Вторая отправка не начинается, пока первая держит debugger и поле
    // страницы: иначе вызовы отцепляют отладчик друг у друга и путают файлы.
    // Зависший runSend завершается по таймаутам своих шагов.
    toast('Подождите: предыдущая картинка ещё отправляется');
    return { ok: false, error: 'busy' };
  }

  const wc = targetWebContents();
  if (!wc) {
    toast('Страница TikTok ещё не готова');
    return { ok: false, error: 'no-page' };
  }

  const ticket = ++sendSeq;
  sending = true;
  activeSend = ticket;
  const report = {
    page: pageLabel(wc),
    target: ctx.chatOpen ? 'chat' : 'main',
    stage: 'start',
  };
  writeSendLog(report);
  toast('Отправляю картинку…');

  const watchdog = setTimeout(() => {
    if (activeSend !== ticket) return;
    // Не сбрасываем activeSend/sending: старый runSend всё ещё держит
    // debugger и поле страницы. Он завершится по своим таймаутам, и только
    // тогда новая отправка получит управление — иначе два вызова работают
    // с одной страницей одновременно и отцепляют отладчик друг у друга.
    if (process.env.OCTO_DEBUG) console.warn('[octo] sticker send watchdog fired');
    writeSendLog({ ...report, stage: 'watchdog' });
    toast('Картинка не отправлена: страница TikTok не ответила. Попробуйте ещё раз');
  }, SEND_TIMEOUT_MS);

  try {
    const result = await runSend(item, wc, ticket, report);
    writeSendLog({ ...report, result });
    return result;
  } catch (err) {
    writeSendLog({ ...report, error: String(err?.message || err) });
    throw err;
  } finally {
    clearTimeout(watchdog);
    if (activeSend === ticket) {
      activeSend = 0;
      sending = false;
    }
  }
}

module.exports = {
  registerScheme,
  init,
  addFromDialog,
  remove,
  openFolder,
  openNativePanel,
  send,
  sendFile,
};
