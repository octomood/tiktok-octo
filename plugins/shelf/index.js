'use strict';

/**
 * «Полка» — закладки внутри приложения.
 *
 * Сохраняет открытую страницу (адрес, заголовок и автора из адреса) в
 * локальное хранилище плагина. Всё остаётся на устройстве: нет сети, нет
 * аккаунта, нет запросов к сайту. Открытие идёт через безопасный
 * octo.navigate, который пускает только страницы TikTok.
 */

const STORAGE_KEY = 'shelf';
const MAX_ITEMS = 40;
const DEFAULT_ITEMS = 20;
const CLEAR_CONFIRM_MS = 5000;
const LABEL_LIMIT = 78;

// Метки TikTok меняются от открытия к открытию: без чистки один и тот же
// ролик попадал бы на полку дважды.
const TRACKING_PARAMS = new Set([
  '_r',
  '_t',
  'enter_from',
  'iid',
  'is_from_webapp',
  'language',
  'refer',
  'sender_device',
  'share_app_id',
  'share_item_id',
  'share_link_id',
  'timestamp',
  'u_code',
  'with_sec_did',
]);

const CSS = `
  html[data-octo-shelf] body::after {
    content: 'На полке';
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: 2147483000;
    box-sizing: border-box;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 93, 143, 0.94);
    color: #ffffff;
    font: 700 11px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: 0.02em;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }
`;

const PAGE_PROBE = `
  var description = '';
  var selectors = ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', 'h1'];
  for (var index = 0; index < selectors.length; index += 1) {
    var node = document.querySelector(selectors[index]);
    if (node && node.textContent && node.textContent.trim()) {
      description = node.textContent.trim();
      break;
    }
  }
  return {
    url: String(document.URL || ''),
    title: String(document.title || ''),
    description: description.slice(0, 160)
  };
`;

let items = [];
let currentUrl = '';
let maxItems = DEFAULT_ITEMS;
let badgeEnabled = true;
let cssApplied = false;
let clearArmedUntil = 0;
const itemCommands = new Set();

function readSettings(values = octo.settings.get()) {
  badgeEnabled = values.show_badge !== false;
  const size = Number(values.max_items);
  maxItems = Number.isFinite(size)
    ? Math.min(MAX_ITEMS, Math.max(4, Math.round(size)))
    : DEFAULT_ITEMS;
}

function canonicalUrl(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 2000) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  if (parsed.username || parsed.password) return '';
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

function sameUrl(left, right) {
  const a = canonicalUrl(left);
  const b = canonicalUrl(right);
  return Boolean(a) && a === b;
}

function cleanText(raw, limit = 90) {
  let text = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/\s*[|·-]\s*TikTok\s*$/i, '').trim();
  return text.slice(0, limit);
}

function authorOf(raw) {
  const url = canonicalUrl(raw);
  if (!url) return '';
  try {
    const match = /^\/@([^/]+)/.exec(new URL(url).pathname);
    if (!match) return '';
    return `@${decodeURIComponent(match[1])}`;
  } catch {
    return '';
  }
}

function labelFor(url, title, description) {
  const author = authorOf(url);
  const text = cleanText(description) || cleanText(title);
  let label = '';
  if (text && author) label = `${author} · ${text}`;
  else if (text) label = text;
  else if (author) label = author;
  else {
    try {
      label = decodeURIComponent(new URL(url).pathname);
    } catch {
      label = url;
    }
  }
  return cleanText(label, LABEL_LIMIT);
}

function makeId() {
  return `m${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')}`;
}

function sanitizeItems(raw) {
  const source = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const seenUrls = new Set();
  const seenIds = new Set();
  const result = [];

  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const url = canonicalUrl(entry.url);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    let id = typeof entry.id === 'string' && /^[a-zA-Z0-9-]{1,32}$/.test(entry.id) ? entry.id : '';
    if (!id || seenIds.has(id)) id = makeId();
    while (seenIds.has(id)) id = makeId();
    seenIds.add(id);

    result.push({
      id,
      url,
      label: cleanText(entry.label, LABEL_LIMIT) || labelFor(url, '', ''),
      addedAt: Number(entry.addedAt) || Date.now(),
    });
    if (result.length >= MAX_ITEMS) break;
  }

  return result;
}

async function loadItems() {
  try {
    return sanitizeItems(await octo.storage.get(STORAGE_KEY));
  } catch (error) {
    octo.log('хранилище:', error.message);
    return [];
  }
}

async function persist() {
  await octo.storage.set(STORAGE_KEY, { version: 1, items });
}

async function applyCss() {
  if (cssApplied) return;
  try {
    await octo.page.injectCSS(CSS);
    cssApplied = true;
  } catch (error) {
    octo.log('стиль:', error.message);
  }
}

async function readPage() {
  try {
    const info = await octo.page.run(PAGE_PROBE);
    if (info && typeof info === 'object') {
      return {
        url: canonicalUrl(info.url) || currentUrl,
        title: typeof info.title === 'string' ? info.title : '',
        description: typeof info.description === 'string' ? info.description : '',
      };
    }
  } catch (error) {
    octo.log('чтение страницы:', error.message);
  }
  return { url: currentUrl, title: '', description: '' };
}

async function syncBadge() {
  if (!currentUrl) {
    const info = await readPage();
    if (info.url) currentUrl = info.url;
  }
  const marked = badgeEnabled && items.some((item) => sameUrl(item.url, currentUrl));
  const code = marked
    ? `document.documentElement.setAttribute('data-octo-shelf', '1'); return true;`
    : `document.documentElement.removeAttribute('data-octo-shelf'); return true;`;
  try {
    await octo.page.run(code);
  } catch (error) {
    octo.log('метка:', error.message);
  }
}

async function syncItemCommands() {
  const wanted = new Map(items.map((item) => [`item-${item.id}`, item]));
  const tasks = [];

  for (const id of [...itemCommands]) {
    if (wanted.has(id)) continue;
    itemCommands.delete(id);
    tasks.push(octo.commands.remove(id).catch(() => {}));
  }

  for (const [id, item] of wanted) {
    if (itemCommands.has(id)) continue;
    itemCommands.add(id);
    tasks.push(
      octo.commands
        .add({
          id,
          title: item.label,
          description: `Открыть с полки: ${item.url}`,
          run: () => openItem(item.id),
        })
        .catch((error) => {
          itemCommands.delete(id);
          octo.log('команда:', error.message);
        }),
    );
  }

  await Promise.all(tasks);
}

async function refreshPanel() {
  try {
    await octo.ui.panelRow({
      id: 'save',
      label: `Сохранить на полку (${items.length})`,
      description: 'Запоминает открытую страницу, чтобы вернуться к ней позже.',
      run: saveCurrent,
    });
  } catch (error) {
    octo.log('панель:', error.message);
  }
}

async function savePage(info) {
  const url = canonicalUrl(info.url);
  if (!url) {
    await octo.notify('Эту ссылку нельзя сохранить: нужен обычный http-адрес');
    return false;
  }

  const existing = items.find((item) => sameUrl(item.url, url));
  if (existing) {
    await octo.notify(`Уже на полке: «${existing.label}»`);
    return false;
  }

  const item = {
    id: makeId(),
    url,
    label: labelFor(url, info.title, info.description),
    addedAt: Date.now(),
  };
  items.unshift(item);
  if (items.length > maxItems) items = items.slice(0, maxItems);

  try {
    await persist();
  } catch (error) {
    octo.log('сохранение:', error.message);
  }

  await syncItemCommands();
  await refreshPanel();
  await syncBadge();
  await octo.notify(`Сохранил: «${item.label}» · всего ${items.length}`);
  return true;
}

async function saveCurrent() {
  clearArmedUntil = 0;
  const info = await readPage();
  if (info.url) currentUrl = info.url;
  await savePage(info);
}

async function saveFromContext(context) {
  clearArmedUntil = 0;
  const target =
    canonicalUrl(context?.linkURL) || canonicalUrl(context?.pageURL) || canonicalUrl(currentUrl);
  if (!target) {
    await octo.notify('Эту ссылку нельзя сохранить: нужен обычный http-адрес');
    return;
  }
  if (sameUrl(target, currentUrl)) {
    await savePage(await readPage());
    return;
  }
  await savePage({ url: target, title: context?.selectionText, description: '' });
}

async function openItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    await octo.notify('Этой страницы больше нет на полке');
    return;
  }
  try {
    await octo.navigate(item.url);
    await octo.notify(`Открываю: «${item.label}»`);
  } catch (error) {
    octo.log('переход:', error.message);
    await octo.notify('Не удалось открыть: приложение разрешает только страницы TikTok');
  }
}

async function openRandom() {
  if (!items.length) {
    await octo.notify('Сначала сохраните страницу — полка пуста');
    return;
  }
  const item = items[Math.floor(Math.random() * items.length)];
  await openItem(item.id);
}

async function removeCurrent() {
  const info = await readPage();
  const index = items.findIndex((item) => sameUrl(item.url, info.url));
  if (index < 0) {
    await octo.notify('Этой страницы нет на полке');
    return;
  }
  const [removed] = items.splice(index, 1);
  try {
    await persist();
  } catch (error) {
    octo.log('сохранение:', error.message);
  }
  await syncItemCommands();
  await refreshPanel();
  await syncBadge();
  await octo.notify(`Убрал: «${removed.label}» · всего ${items.length}`);
}

async function clearShelf() {
  if (!items.length) {
    await octo.notify('Полка уже пуста');
    return;
  }
  const now = Date.now();
  if (clearArmedUntil < now) {
    clearArmedUntil = now + CLEAR_CONFIRM_MS;
    await octo.notify('Нажмите ещё раз в течение 5 секунд, чтобы очистить полку');
    return;
  }

  clearArmedUntil = 0;
  items = [];
  try {
    await octo.storage.remove(STORAGE_KEY);
  } catch (error) {
    octo.log('хранилище:', error.message);
  }
  await syncItemCommands();
  await refreshPanel();
  await syncBadge();
  await octo.notify('Очистил полку');
}

async function registerBase() {
  // Панельные строки — основные действия: они видны и в панели функций, и в
  // быстром меню. Команды оставляем для редких операций, чтобы одно и то же
  // действие не дублировалось в палитре.
  await octo.commands.add({
    id: 'remove',
    title: 'Убрать текущую страницу с полки',
    description: 'Удаляет открытую страницу из сохранённых.',
    run: removeCurrent,
  });
  await octo.commands.add({
    id: 'clear',
    title: 'Очистить полку',
    description: 'Удаляет все закладки. Нужно подтвердить повторным запуском.',
    run: clearShelf,
  });

  await octo.shortcuts.add({
    id: 'save',
    title: 'Полка: сохранить страницу',
    accelerator: 'Ctrl+Shift+L',
    run: saveCurrent,
  });
  await octo.shortcuts.add({
    id: 'random',
    title: 'Полка: случайная страница',
    accelerator: 'Ctrl+Alt+L',
    run: openRandom,
  });

  await octo.ui.contextMenu.add({
    id: 'save-link',
    title: 'Полка: сохранить ссылку',
    description: 'Добавляет на полку ссылку или текущую страницу.',
    run: saveFromContext,
  });

  await octo.ui.panelRow({
    id: 'random',
    label: 'Случайная страница с полки',
    description: 'Если не знаете, что посмотреть, — доверьтесь полке.',
    run: openRandom,
  });
}

octo.onActivate(async () => {
  readSettings();
  items = (await loadItems()).slice(0, maxItems);
  await applyCss();
  await registerBase();
  await refreshPanel();
  await syncItemCommands();
  await syncBadge();
  octo.log(`полка: ${items.length}`);
});

octo.onSettingsChange(async (values) => {
  readSettings(values);
  if (items.length > maxItems) {
    items = items.slice(0, maxItems);
    try {
      await persist();
    } catch (error) {
      octo.log('сохранение:', error.message);
    }
    await syncItemCommands();
  }
  await refreshPanel();
  await syncBadge();
});

octo.onPageReady(({ url }) => {
  currentUrl = canonicalUrl(url);
  syncBadge();
});

octo.onPageNavigate(({ url }) => {
  currentUrl = canonicalUrl(url);
  syncBadge();
});

octo.onDeactivate(async () => {
  const tasks = [];
  for (const id of ['remove', 'clear']) {
    tasks.push(octo.commands.remove(id).catch(() => {}));
  }
  for (const id of [...itemCommands]) {
    tasks.push(octo.commands.remove(id).catch(() => {}));
  }
  itemCommands.clear();

  tasks.push(octo.ui.removePanelRow('save').catch(() => {}));
  tasks.push(octo.ui.removePanelRow('random').catch(() => {}));
  tasks.push(octo.ui.contextMenu.remove('save-link').catch(() => {}));
  tasks.push(octo.shortcuts.remove('save').catch(() => {}));
  tasks.push(octo.shortcuts.remove('random').catch(() => {}));
  tasks.push(
    octo.page
      .run(`document.documentElement.removeAttribute('data-octo-shelf'); return true;`)
      .catch(() => {}),
  );

  await Promise.allSettled(tasks);
});
