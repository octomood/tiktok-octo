'use strict';

const { ctx, pushState, setWelcomeOpen, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const i18n = require('./i18n');
const region = require('./region');

/**
 * Мастер первого запуска: язык интерфейса и прокси.
 *
 * Показывается один раз, когда в состоянии нет отметки `welcomeDone`.
 * Повторно открывается из панели («Мастер настройки») и палитры команд —
 * например, если прокси понадобился позже. Прокси берётся свой: мастер
 * умеет только найти уже запущенный локальный клиент (см. proxy-discovery.js)
 * и не содержит чужих серверов.
 *
 * Тесты запускают приложение с пустым профилем на каждый сценарий. Мастер
 * перекрыл бы им полосу и панель, поэтому при OCTO_E2E он выключен, а
 * OCTO_WELCOME=1 включает его явно для проверки самого мастера.
 */

const FORCED = process.env.OCTO_WELCOME === '1';

function shouldShow() {
  if (FORCED) return true;
  if (process.env.OCTO_E2E === '1') return false;
  return readState().welcomeDone !== true;
}

/** Прочитать состояние до создания окна: от него зависит видимость ленты. */
function sync() {
  ctx.welcome = {
    open: shouldShow(),
    done: readState().welcomeDone === true,
  };
}

function open() {
  setWelcomeOpen(true);
}

function markDone() {
  writeState({ welcomeDone: true });
  ctx.welcome.done = true;
}

function skip() {
  markDone();
  setWelcomeOpen(false);
}

/**
 * Завершение мастера. Возвращает false, если прокси включён, но адрес не
 * принят, или не удалось поднять обход DPI: экран остаётся открытым, чтобы
 * человек исправил настройку.
 */
async function finish(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};

  if (typeof data.language === 'string') i18n.setLanguage(data.language);

  if (data.proxyEnabled === true) {
    const address = String(data.proxy || '').trim();
    if (!address) {
      toast('Прокси: нужен адрес вида socks5://host:port');
      pushState();
      return false;
    }
    // Свой адрес важнее обхода DPI: setProxy сам выключает обход.
    if (!region.setProxy(address)) return false;
  } else if (data.dpiEnabled === true) {
    // Обход и прокси взаимоисключающие: адрес уступает.
    if (ctx.region.proxy) region.setProxy('');
    if (!(await region.setDpiBypass(true))) return false;
  } else {
    await region.setDpiBypass(false);
    if (ctx.region.proxy) region.setProxy('');
  }

  markDone();
  setWelcomeOpen(false);
  toast('Настройка завершена');
  return true;
}

function discover() {
  return region.discoverProxies();
}

module.exports = { sync, open, finish, skip, discover, shouldShow };
