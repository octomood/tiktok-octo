'use strict';

const crypto = require('node:crypto');
const { ipcMain } = require('electron');
const { PROTOCOL } = require('./constants');

/**
 * Изолированный мир страницы, где выполняются скрипты плагинов
 * (octo.page.run, getMediaInfo, watch).
 *
 * Статическая проверка scanPageScript ловит только очевидное: `const f = fetch`
 * или `[].constructor.constructor` она не видит. Поэтому граница проводится в
 * самом Chromium:
 *
 *  1. Миру выдаётся своя строгая CSP через webFrame.setIsolatedWorldInfo
 *     (это умеет только preload страницы, см. region-preload.js). Она
 *     запрещает fetch/XHR/WebSocket/sendBeacon/EventSource, картинки, шрифты,
 *     скрипты и import() с чужих адресов, а без 'unsafe-eval' — eval, Function
 *     и constructor.constructor.
 *  2. Перед первым скриптом в документе в мир ставятся замки
 *     (hardenPageWorld): cookie и хранилища сайта, парсеры HTML, iframe/object/
 *     script/base/meta, window.open. Это прототипы именно этого мира: сайт и
 *     другие плагины их не видят.
 *  3. Признак готовности мира ставится только если CSP действительно
 *     работает (проба fetch('data:') отклонена), а обёртка page.run
 *     (wrapPageRun) проверяет его в том же вызове. Если политика не применилась (preload не ответил),
 *     скрипт плагина не выполняется вовсе.
 *
 * CSP выдаётся до первого кода в мире: preload берёт список миров при каждой
 * загрузке документа (octo:plugin-worlds), а для мира, появившегося позже,
 * main просит об этом отдельно и ждёт ответа (prepareWorld). Порядок важен:
 * fetch и картинки Chromium проверяет в момент запроса, а запрет eval V8
 * фиксирует при создании контекста мира.
 *
 * Чего это не закрывает (честно описано в docs/plugins/README.md): загрузки,
 * которые Chromium приписывает самой странице — url() в стилях, <audio>/<video>,
 * переход уже существующих фреймов, — подчиняются CSP сайта, а не нашей.
 */

const PAGE_WORLD_CSP = [
  "default-src 'none'",
  // Без 'unsafe-eval': eval, Function и [].constructor.constructor падают.
  "script-src 'none'",
  // Стили, которые скрипт вешает на элементы, и <style> оставляем: их
  // используют плагины, а загрузки из CSS всё равно идут по CSP сайта.
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const READY_FLAG = '__octoPageWorldReady';
const PAGE_RUN_RESULT_BYTES = 256 * 1024;
const ACK_TIMEOUT_MS = 3000;

/**
 * Замки внутри мира плагина. Функция сериализуется в мир, поэтому не должна
 * ссылаться ни на что снаружи. Каждый замок в своём try: если Chromium
 * переименует свойство, остальные всё равно встанут.
 */
function hardenPageWorld() {
  const { Document, Element, Attr, Node } = window;
  const apply = Reflect.apply;
  const define = Object.defineProperty;
  const describe = Object.getOwnPropertyDescriptor;
  const lower = (value) => String(value).toLowerCase();
  const fail = (what) => {
    throw new Error(`${what} недоступно скриптам плагинов`);
  };
  const lock = (target, key, descriptor) => {
    try {
      if (target) define(target, key, { configurable: false, enumerable: false, ...descriptor });
    } catch {
      /* свойства нет в этой версии Chromium */
    }
  };
  const lockSetter = (target, key, what) => {
    const original = target && describe(target, key);
    if (!original || !original.get) return;
    lock(target, key, {
      get: original.get,
      set() {
        fail(what);
      },
    });
  };
  const deny = (target, key, what) =>
    lock(target, key, {
      value() {
        fail(what);
      },
      writable: false,
    });

  // Cookie и хранилища сайта.
  lock(Document.prototype, 'cookie', { get: () => '', set: () => {} });
  for (const key of ['localStorage', 'sessionStorage', 'indexedDB', 'cookieStore', 'caches']) {
    lock(window, key, {
      get() {
        fail(key);
      },
    });
  }

  // Новые окна и вложенные документы: через них уходят мимо CSP мира.
  deny(window, 'open', 'window.open');
  const frameTags = ['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe'];
  const blockedTags = new Set([...frameTags, 'script', 'base', 'meta']);
  const isBlockedTag = (name) => blockedTags.has(lower(name).split(':').pop());
  const isFrameLike = (element) => {
    try {
      return Boolean(element) && blockedTags.has(lower(element.localName));
    } catch {
      return false;
    }
  };
  for (const ctor of ['HTMLIFrameElement', 'HTMLFrameElement', 'HTMLObjectElement']) {
    const proto = window[ctor]?.prototype;
    lock(proto, 'contentWindow', { get: () => null });
    lock(proto, 'contentDocument', { get: () => null });
  }
  for (const ctor of ['HTMLObjectElement', 'HTMLEmbedElement', 'HTMLIFrameElement']) {
    deny(window[ctor]?.prototype, 'getSVGDocument', 'Вложенный документ');
  }
  lockSetter(window.HTMLIFrameElement?.prototype, 'src', 'iframe');
  lockSetter(window.HTMLIFrameElement?.prototype, 'srcdoc', 'iframe');
  lockSetter(window.HTMLFrameElement?.prototype, 'src', 'frame');
  lockSetter(window.HTMLObjectElement?.prototype, 'data', 'object');
  lockSetter(window.HTMLEmbedElement?.prototype, 'src', 'embed');
  lockSetter(window.HTMLScriptElement?.prototype, 'src', 'script');
  lockSetter(window.HTMLScriptElement?.prototype, 'text', 'script');
  lockSetter(window.HTMLBaseElement?.prototype, 'href', 'base');

  const createElement = Document.prototype.createElement;
  lock(Document.prototype, 'createElement', {
    writable: false,
    value: function createElementGuarded(name, ...rest) {
      if (isBlockedTag(name)) fail(`<${lower(name)}>`);
      return apply(createElement, this, [name, ...rest]);
    },
  });
  const createElementNS = Document.prototype.createElementNS;
  lock(Document.prototype, 'createElementNS', {
    writable: false,
    value: function createElementNSGuarded(ns, name, ...rest) {
      if (isBlockedTag(name)) fail(`<${lower(name)}>`);
      return apply(createElementNS, this, [ns, name, ...rest]);
    },
  });

  // Атрибуты: обработчики on* и адреса у фреймов, скриптов, base и meta.
  const riskyAttr = (element, name) => {
    const attr = lower(name).split(':').pop();
    return attr.startsWith('on') || (isFrameLike(element) && attr !== 'class' && attr !== 'id');
  };
  for (const key of ['setAttribute', 'setAttributeNS', 'toggleAttribute']) {
    const original = Element.prototype[key];
    if (typeof original !== 'function') continue;
    lock(Element.prototype, key, {
      writable: false,
      value: function guardedAttribute(...args) {
        const name = key === 'setAttributeNS' ? args[1] : args[0];
        if (riskyAttr(this, name)) fail(`Атрибут ${lower(name)}`);
        return apply(original, this, args);
      },
    });
  }
  for (const key of ['setAttributeNode', 'setAttributeNodeNS']) {
    const original = Element.prototype[key];
    if (typeof original !== 'function') continue;
    lock(Element.prototype, key, {
      writable: false,
      value: function guardedAttributeNode(attr) {
        if (riskyAttr(this, attr?.name || '')) fail('Атрибут');
        return apply(original, this, [attr]);
      },
    });
  }
  for (const key of ['setNamedItem', 'setNamedItemNS']) {
    deny(window.NamedNodeMap?.prototype, key, 'NamedNodeMap');
  }
  for (const key of ['value', 'nodeValue', 'textContent']) {
    const proto = key === 'value' ? Attr.prototype : Node.prototype;
    const original = describe(proto, key);
    if (!original || !original.set) continue;
    lock(proto, key, {
      get: original.get,
      set(next) {
        if (this instanceof Attr && riskyAttr(this.ownerElement, this.name)) fail('Атрибут');
        return apply(original.set, this, [next]);
      },
    });
  }

  // Парсеры HTML: через них в DOM попадают те же iframe, script и on*.
  const html = 'Вставка HTML';
  for (const proto of [Element.prototype, window.ShadowRoot?.prototype]) {
    lockSetter(proto, 'innerHTML', html);
    deny(proto, 'setHTMLUnsafe', html);
  }
  lockSetter(Element.prototype, 'outerHTML', html);
  deny(Element.prototype, 'insertAdjacentHTML', html);
  deny(Document.prototype, 'write', html);
  deny(Document.prototype, 'writeln', html);
  deny(Document.prototype, 'execCommand', html);
  deny(window.Document, 'parseHTMLUnsafe', html);
  deny(window.DOMParser?.prototype, 'parseFromString', html);
  deny(window.Range?.prototype, 'createContextualFragment', html);
  deny(window.XSLTProcessor?.prototype, 'transformToFragment', html);
  deny(window.XSLTProcessor?.prototype, 'transformToDocument', html);
}

/**
 * Код проверки мира: 'ready' или 'no-policy', если CSP мира не действует.
 * Проба — fetch('data:'): сети не трогает, а connect-src 'none' её запрещает.
 * eval для пробы не годится: V8 решает о нём при создании контекста мира.
 */
function ensureScript() {
  const flag = JSON.stringify(READY_FLAG);
  return `(async () => {
    if (globalThis[${flag}] === true) return 'ready';
    try {
      await fetch('data:,octo');
      return 'no-policy';
    } catch {
      /* connect-src 'none': CSP мира действует */
    }
    if (globalThis[${flag}] === true) return 'ready';
    (${hardenPageWorld.toString()})();
    Object.defineProperty(globalThis, ${flag}, {
      value: true,
      configurable: false,
      writable: false,
      enumerable: false,
    });
    return 'ready';
  })()`;
}

/**
 * Обёртка скрипта page.run. Ошибки и признак «мир не готов» возвращаются
 * объектом с одноразовым токеном: Electron заменяет текст любого исключения из
 * мира на общее «Script failed to execute», а токен не даёт коду плагина
 * подделать ответ. Без готового мира код плагина не выполняется вовсе.
 */
function wrapPageRun(code) {
  const token = crypto.randomUUID();
  const key = JSON.stringify(token);
  const source = `(async () => {
    const reply = (fields) => Object.assign({ octoPageRun: ${key} }, fields);
    if (globalThis[${JSON.stringify(READY_FLAG)}] !== true) return reply({ notReady: true });
    let result;
    try {
      result = await (() => { ${code} })();
    } catch (error) {
      return reply({ error: String((error && error.message) || error) });
    }
    if (result === undefined) return reply({ result: null });
    let json;
    try {
      json = JSON.stringify(result);
    } catch {
      return reply({ error: 'Результат page.run не сериализуется в JSON' });
    }
    if (json && json.length > ${PAGE_RUN_RESULT_BYTES}) {
      return reply({ error: 'Результат page.run больше 256 КБ' });
    }
    return reply({ result });
  })()`;
  return { token, source };
}

/** Разбирает ответ обёртки: { notReady } | { error } | { result }. */
function unwrapPageRun(value, token) {
  if (!value || typeof value !== 'object' || value.octoPageRun !== token) {
    return { error: 'Некорректный ответ скрипта страницы' };
  }
  if (value.notReady === true) return { notReady: true };
  if (typeof value.error === 'string') return { error: value.error.slice(0, 500) };
  return { result: value.result === undefined ? null : value.result };
}

function worldOrigin(pluginId) {
  return `${PROTOCOL}://${pluginId}`;
}

// worldId → id плагина. id миров не переиспользуются (host.js worldIdFor),
// поэтому записи не удаляются: политика для старого id никому не мешает.
const worlds = new Map();
// processId рендерера → id миров, которым там уже выдана CSP. Политика живёт
// в процессе, а не в документе, поэтому навигация её не сбрасывает.
const configured = new Map();
const pending = new Map();
let listening = false;

function worldInfo(worldId) {
  const pluginId = worlds.get(worldId);
  return {
    worldId,
    origin: worldOrigin(pluginId),
    name: `octo-plugin ${pluginId}`,
    csp: PAGE_WORLD_CSP,
  };
}

function markConfigured(processId, worldIds) {
  if (!Number.isInteger(processId)) return;
  const set = configured.get(processId) || new Set();
  for (const id of worldIds) set.add(id);
  configured.set(processId, set);
}

function listen() {
  if (listening) return;
  listening = true;
  // preload страницы при каждой загрузке документа сразу выдаёт CSP всем
  // известным мирам — до того, как в них что-то выполнится.
  ipcMain.on('octo:plugin-worlds', (event) => {
    const list = [...worlds.keys()].map(worldInfo);
    event.returnValue = list;
    markConfigured(
      event.processId,
      list.map((item) => item.worldId),
    );
  });
  ipcMain.on('octo:plugin-world-ready', (event, token, ok) => {
    const waiter = pending.get(token);
    if (!waiter || waiter.sender !== event.sender) return;
    pending.delete(token);
    clearTimeout(waiter.timer);
    if (ok === true) markConfigured(event.processId, [waiter.worldId]);
    waiter.resolve(ok === true);
  });
}

// preload страницы спрашивает список миров синхронно при каждой загрузке
// документа, даже когда плагинов нет. sendSync без обработчика навсегда
// подвесит рендерер, поэтому обработчики ставятся сразу при загрузке модуля
// (main.js → plugins → host → page-world), а не при первом плагине.
if (ipcMain) listen();

/** Мир плагина появился: следующие документы получат его CSP из preload. */
function registerWorld(worldId, pluginId) {
  listen();
  worlds.set(worldId, pluginId);
}

/** Просит preload страницы выдать миру CSP и ждёт ответа. */
function requestWorldPolicy(wc, worldId) {
  listen();
  return new Promise((resolve) => {
    const token = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(token);
      resolve(false);
    }, ACK_TIMEOUT_MS);
    pending.set(token, { sender: wc, worldId, resolve, timer });
    try {
      wc.send('octo:plugin-world', { token, ...worldInfo(worldId) });
    } catch {
      pending.delete(token);
      clearTimeout(timer);
      resolve(false);
    }
  });
}

function processIdOf(wc) {
  try {
    return wc.mainFrame?.processId;
  } catch {
    return undefined;
  }
}

/**
 * Выдаёт CSP миру в текущем процессе страницы, если ещё не выдана. Вызывать
 * до любого кода в мире: так CSP действует и на eval с первого же вызова.
 */
async function prepareWorld(wc, worldId) {
  if (!worlds.has(worldId)) return false;
  if (configured.get(processIdOf(wc))?.has(worldId)) return true;
  return requestWorldPolicy(wc, worldId);
}

/**
 * Готовит мир плагина в текущем документе страницы. true — CSP действует и
 * замки стоят; false — выполнять код плагина нельзя.
 */
async function ensurePageWorld(wc, worldId) {
  const run = () => wc.executeJavaScriptInIsolatedWorld(worldId, [{ code: ensureScript() }]);
  try {
    if (!(await prepareWorld(wc, worldId))) return false;
    if ((await run()) === 'ready') return true;
    // Процесс сменился без нашего ведома: выдаём политику заново.
    configured.delete(processIdOf(wc));
    if (!(await requestWorldPolicy(wc, worldId))) return false;
    return (await run()) === 'ready';
  } catch {
    return false;
  }
}

module.exports = {
  PAGE_WORLD_CSP,
  READY_FLAG,
  registerWorld,
  prepareWorld,
  ensurePageWorld,
  wrapPageRun,
  unwrapPageRun,
  worldOrigin,
  hardenPageWorld,
};
