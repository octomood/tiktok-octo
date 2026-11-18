'use strict';

/**
 * Менеджер плагинов.
 *
 * Renderer не решает, что и как устанавливать: он рисует состояние из main и
 * отправляет действия. Диалоги подтверждения, скачивание, проверки и запись
 * файлов остаются в main-процессе, поэтому интерфейс нельзя «обойти» из DevTools.
 */

const api = window.octoPlugins;
const $ = (id) => document.getElementById(id);

const PERMISSION_LABELS = {
  'page:css': 'Стили страницы',
  'page:script': 'Скрипты на странице',
  network: 'Сеть',
  links: 'Внешние ссылки',
};

const el = {
  content: $('content'),
  search: $('search'),
  catalogSort: $('catalogSort'),
  catalogSource: $('catalogSource'),
  inputRegistries: $('inputRegistries'),
  btnRefresh: $('btnRefresh'),
  version: $('version'),
  pluginDir: $('pluginDir'),
  notice: $('notice'),
  noticeText: $('noticeText'),
  btnNoticeClose: $('btnNoticeClose'),
  toast: $('toast'),
  catalogList: $('catalogList'),
  catalogEmpty: $('catalogEmpty'),
  catalogMeta: $('catalogMeta'),
  catalogCategories: $('catalogCategories'),
  installedList: $('installedList'),
  installedEmpty: $('installedEmpty'),
  installedMeta: $('installedMeta'),
  updatesList: $('updatesList'),
  updatesEmpty: $('updatesEmpty'),
  updatesMeta: $('updatesMeta'),
  btnUpdateAll: $('btnUpdateAll'),
  badgeCatalog: $('badgeCatalog'),
  badgeInstalled: $('badgeInstalled'),
  badgeUpdates: $('badgeUpdates'),
  switchAutoUpdate: $('switchAutoUpdate'),
  switchAllowUnsigned: $('switchAllowUnsigned'),
  switchRequireSignatures: $('switchRequireSignatures'),
  selectInterval: $('selectInterval'),
  inputRegistry: $('inputRegistry'),
  registryHint: $('registryHint'),
};

let state = {
  version: '',
  settings: {},
  catalog: { status: 'idle', plugins: [], error: '', fetchedAt: 0, updatedAt: '' },
  installed: [],
  updates: [],
  busy: null,
  info: {},
};
let info = {};
let activeTab = 'catalog';
let activeCategory = '';
let query = '';
let catalogSort = 'name';
let catalogSource = '';
let dismissedNotice = '';
let toastTimer = null;
let rendered = false;

if (api.platform === 'darwin') document.body.classList.add('mac');

// --- Мелкие DOM-помощники ---------------------------------------------------

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function makeButton(label, className, action, payload = {}, extra = {}) {
  const button = node('button', className, label);
  button.type = 'button';
  if (action) button.dataset.act = action;
  if (payload.id) button.dataset.id = payload.id;
  if (payload.url) button.dataset.url = payload.url;
  if (extra.disabled) button.disabled = true;
  if (extra.title) button.title = extra.title;
  return button;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function permissionLabel(id) {
  return PERMISSION_LABELS[id] || id;
}

function scanLabel(verdict) {
  if (verdict === 'safe') return 'замечаний нет';
  if (verdict === 'blocked') return 'запрещено';
  return 'есть предупреждения';
}

function showToast(text, error = false) {
  el.toast.textContent = text;
  el.toast.classList.toggle('toast--error', Boolean(error));
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3000);
}

async function run(action, payload = {}) {
  if (state.busy) {
    showToast('Дождитесь окончания текущей операции');
    return { ok: false };
  }
  try {
    const result = await api.action(action, payload);
    if (!result || result.ok !== true) {
      if (!result?.cancelled) showToast(result?.error || 'Не удалось выполнить действие', true);
    }
    return result || { ok: false };
  } catch (err) {
    showToast(err.message, true);
    return { ok: false, error: err.message };
  }
}

function busyLabel(scope) {
  if (scope === 'catalog') return 'Обновляю каталог…';
  if (scope === 'update') return 'Обновляю…';
  if (scope === 'install') return 'Устанавливаю…';
  return 'Подождите…';
}

// --- Общие элементы карточек ------------------------------------------------

function cardIcon(item) {
  const icon = node('div', 'card-icon');
  if (typeof item.icon === 'string' && item.icon.startsWith('data:image/')) {
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    icon.append(image);
    return icon;
  }
  const name = String(item.name || item.id || '?').trim();
  icon.textContent = name.slice(0, 1) || '?';
  return icon;
}

function pill(text, kind = '') {
  return node('span', `pill${kind ? ` pill--${kind}` : ''}`, text);
}

function permissionChips(permissions, container) {
  const list = Array.isArray(permissions) ? permissions : [];
  if (!list.length) {
    container.append(node('span', 'chip', 'без дополнительных разрешений'));
    return;
  }
  for (const permission of list) {
    container.append(node('span', `chip chip--${permission.risk}`, permission.label));
  }
}

function cardMeta(items) {
  const meta = node('div', 'card-meta');
  items.filter(Boolean).forEach((value, index) => {
    if (index > 0) meta.append(node('span', 'dot'));
    meta.append(node('span', '', value));
  });
  return meta;
}

function sourcePill(record) {
  if (record.dev) return pill('разработка', 'warn');
  if (record.source === 'registry') return pill('каталог');
  return pill('файл');
}

function signaturePill(value) {
  if (value === 'verified') return pill('подпись', 'ok');
  if (value === 'invalid') return pill('подпись неверна', 'error');
  return pill('без подписи');
}

function addPermissionsDetail(container, record) {
  const block = node('div', 'detail-block');
  block.append(node('h4', '', 'Разрешения'));
  const items = [...(record.permissions || []), ...(record.baseline || [])];
  if (!items.length) {
    block.append(node('p', '', 'Дополнительных разрешений нет.'));
  }
  for (const permission of items) {
    const row = node('div', 'permission-row');
    row.append(node('span', `chip chip--${permission.risk}`, permission.label));
    row.append(node('span', 'permission-text', permission.description));
    block.append(row);
  }
  container.append(block);
}

function addScanDetail(container, record) {
  const block = node('div', 'detail-block');
  const head = node('div', 'card-title-row');
  head.append(node('h4', '', 'Проверка безопасности'));
  head.append(
    node(
      'span',
      `verdict verdict--${record.scan?.verdict || 'review'}`,
      scanLabel(record.scan?.verdict),
    ),
  );
  block.append(head);

  const scan = record.scan || {};
  block.append(
    node(
      'p',
      '',
      `${scan.files || 0} файлов · ${formatBytes(scan.bytes)} · предупреждений: ${scan.warnings || 0}`,
    ),
  );

  const findings = Array.isArray(scan.findings) ? scan.findings : [];
  if (!findings.length) {
    block.append(node('p', '', 'Запрещённых конструкций и подозрительных мест не найдено.'));
  } else {
    for (const finding of findings.slice(0, 40)) {
      const row = node(
        'div',
        `finding finding--${finding.severity === 'block' ? 'block' : 'warn'}`,
      );
      row.append(node('span', 'finding-mark', finding.severity === 'block' ? '!' : '·'));
      row.append(
        node(
          'span',
          '',
          `${finding.file || 'код'}${finding.line ? `:${finding.line}` : ''} — ${finding.message}`,
        ),
      );
      block.append(row);
    }
  }
  container.append(block);
}

function logsText(logs) {
  const items = Array.isArray(logs) ? logs : [];
  if (!items.length) return 'Логов пока нет';
  return items
    .map((item) => {
      const time = item.at ? new Date(item.at).toLocaleTimeString('ru-RU') : '--:--:--';
      return `[${time}] ${item.message || ''}`;
    })
    .join('\n');
}

function updateLogs(id, logs) {
  for (const pre of document.querySelectorAll('pre[data-plugin-logs]')) {
    if (pre.dataset.pluginLogs !== id) continue;
    pre.textContent = logsText(logs);
  }
}

function addLogsDetail(container, record) {
  const block = node('div', 'detail-block');
  const head = node('div', 'card-title-row');
  head.append(node('h4', '', 'Логи'));
  const refresh = makeButton('Обновить', 'ghost', 'logs', { id: record.id });
  refresh.classList.add('log-refresh');
  head.append(refresh);
  block.append(head);

  const pre = node('pre', 'plugin-logs', logsText(record.logs));
  pre.dataset.pluginLogs = record.id;
  block.append(pre);
  container.append(block);
}

function addHistoryDetail(container, record) {
  const history = Array.isArray(record.history) ? record.history : [];
  if (!history.length) return;
  const block = node('div', 'detail-block');
  block.append(node('h4', '', 'История версий'));
  for (const item of history) {
    const row = node('div', 'version-row');
    const text = node('div', 'version-text');
    text.append(node('strong', '', `v${item.version}`));
    const meta = [];
    if (item.installedAt) meta.push(formatDate(item.installedAt));
    if (item.signature === 'verified') meta.push('подпись');
    if (item.verdict) meta.push(scanLabel(item.verdict));
    if (meta.length) text.append(node('small', '', meta.join(' · ')));
    row.append(text);
    const button = makeButton('Откатить', 'ghost', 'rollback', { id: record.id });
    button.dataset.version = item.version;
    row.append(button);
    block.append(row);
  }
  container.append(block);
}

function addScreenshotsDetail(container, record) {
  const shots = Array.isArray(record.screenshots) ? record.screenshots : [];
  if (!shots.length) return;
  const block = node('div', 'detail-block');
  block.append(node('h4', '', 'Скриншоты'));
  const row = node('div', 'catalog-shots');
  for (const src of shots.slice(0, 4)) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    row.append(image);
  }
  block.append(row);
  container.append(block);
}

function addSettingsDetail(container, record) {
  if (!record.settings?.length) return;
  const block = node('div', 'detail-block');
  block.append(node('h4', '', 'Настройки'));
  const fields = node('div', 'settings-fields');
  for (const setting of record.settings) {
    const row = node('div', 'setting-control');
    row.append(node('label', '', setting.title));
    const common = {
      'data-setting': '',
      'data-id': record.id,
      'data-key': setting.key,
      'data-type': setting.type,
    };

    if (setting.type === 'boolean') {
      const toggle = node('span', 'switch');
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('tabindex', '0');
      toggle.dataset.settingToggle = '';
      toggle.dataset.id = record.id;
      toggle.dataset.key = setting.key;
      toggle.setAttribute('aria-checked', String(setting.value === true));
      row.append(toggle);
    } else if (setting.type === 'select') {
      const select = node('select', 'select');
      for (const key of Object.keys(common)) select.setAttribute(key, common[key]);
      for (const option of setting.options || []) {
        const item = document.createElement('option');
        item.value = option.value;
        item.textContent = option.label;
        item.selected = option.value === setting.value;
        select.append(item);
      }
      row.append(select);
    } else if (setting.type === 'number') {
      const input = document.createElement('input');
      input.className = 'text-input';
      input.type = 'number';
      input.min = String(setting.min);
      input.max = String(setting.max);
      input.step = String(setting.step);
      input.value = String(setting.value);
      for (const key of Object.keys(common)) input.setAttribute(key, common[key]);
      row.append(input);
    } else {
      const input = document.createElement('input');
      input.className = 'text-input';
      input.type = 'text';
      input.maxLength = setting.maxLength || 1000;
      input.value = String(setting.value ?? '');
      for (const key of Object.keys(common)) input.setAttribute(key, common[key]);
      row.append(input);
    }

    fields.append(row);
  }

  block.append(fields);
  container.append(block);
}

function addAboutDetail(container, record) {
  const block = node('div', 'detail-block');
  block.append(node('h4', '', 'О плагине'));
  const list = node('ul');
  list.append(node('li', '', `Источник: ${record.sourceLabel || record.source || 'файл'}`));
  list.append(node('li', '', `Лицензия: ${record.license || 'UNLICENSED'}`));
  list.append(node('li', '', `Подпись: ${record.signatureLabel || 'без подписи'}`));
  list.append(node('li', '', `Минимальная версия: ${record.minAppVersion || '0.0.0'}`));
  if (record.secretsCount) {
    list.append(node('li', '', `Секретов сохранено: ${record.secretsCount}`));
  }
  if (record.networkHosts?.length) {
    list.append(node('li', '', `Сетевые хосты: ${record.networkHosts.join(', ')}`));
  }
  if (record.installedAt) {
    list.append(node('li', '', `Установлен: ${formatDate(record.installedAt)}`));
  }
  const resources = record.resources;
  if (resources) {
    const kb = (value) => `${Math.round((Number(value) || 0) / 1024)} КБ`;
    list.append(
      node('li', '', `Хранилище: ${kb(resources.storageBytes)} из ${kb(resources.storageLimit)}`),
    );
    list.append(node('li', '', `Команды: ${resources.commands} из ${resources.commandsLimit}`));
    list.append(node('li', '', `Строки панели: ${resources.rows} из ${resources.rowsLimit}`));
    list.append(
      node(
        'li',
        '',
        `Скрипт страницы: таймаут ${Math.round((resources.scriptTimeoutMs || 0) / 1000)} с`,
      ),
    );
  }
  if (record.updatedAt) list.append(node('li', '', `Обновлён: ${formatDate(record.updatedAt)}`));
  block.append(list);

  if (record.homepage || record.sourceCode) {
    const links = node('div', 'settings-actions');
    if (record.homepage) {
      links.append(makeButton('Сайт', 'ghost', 'home', { url: record.homepage }));
    }
    if (record.sourceCode) {
      links.append(makeButton('Исходники', 'ghost', 'home', { url: record.sourceCode }));
    }
    block.append(links);
  }

  container.append(block);
}

// --- Каталог ----------------------------------------------------------------

function permissionIdsText(ids) {
  return (Array.isArray(ids) ? ids : []).map(permissionLabel).join(', ');
}

function sortedCatalog(items) {
  const byName = (left, right) => (left.name || '').localeCompare(right.name || '', 'ru');
  const list = [...items];
  if (catalogSort === 'date') {
    return list.sort(
      (left, right) =>
        String(right.publishedAt || '').localeCompare(String(left.publishedAt || '')) ||
        byName(left, right),
    );
  }
  if (catalogSort === 'installs') {
    return list.sort(
      (left, right) =>
        (Number(right.installs) || 0) - (Number(left.installs) || 0) || byName(left, right),
    );
  }
  if (catalogSort === 'updates') {
    return list.sort(
      (left, right) => (left.update ? 0 : 1) - (right.update ? 0 : 1) || byName(left, right),
    );
  }
  return list.sort(byName);
}

function catalogCard(item) {
  const card = node('article', 'card');
  if (item.blocked) card.classList.add('card--error');
  const head = node('div', 'card-head');
  head.append(cardIcon(item));

  const titleBlock = node('div', 'card-title-block');
  const titleRow = node('div', 'card-title-row');
  titleRow.append(node('h3', 'card-title', item.name));
  titleRow.append(pill(`v${item.version}`));
  if (item.verified) titleRow.append(pill('проверено', 'ok'));
  if (item.registryLabel && item.registryLabel !== 'официальный') {
    titleRow.append(pill(item.registryLabel, 'info'));
  } else titleRow.append(signaturePill(item.signature));
  titleBlock.append(titleRow);
  titleBlock.append(
    node('p', 'card-author', `${item.author?.name || 'неизвестный автор'} · ${item.license}`),
  );
  head.append(titleBlock);
  card.append(head);

  card.append(node('p', 'card-description', item.description || 'Без описания.'));

  if (item.screenshots?.length) {
    const shots = node('div', 'catalog-shots');
    for (const src of item.screenshots.slice(0, 3)) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      shots.append(image);
    }
    card.append(shots);
  }

  const chips = node('div', 'chips');
  permissionChips(item.permissions, chips);
  card.append(chips);

  card.append(
    cardMeta([
      item.categories?.length ? item.categories.join(' · ') : 'без категории',
      item.size ? formatBytes(item.size) : '',
      item.publishedAt ? formatDate(item.publishedAt) : '',
      item.installs ? `установок: ${item.installs}` : '',
    ]),
  );

  const changes = item.installedPermissionChanges || item.permissionChanges;
  if (changes && (changes.added.length || changes.removed.length)) {
    const block = node('div', 'permission-diff');
    block.append(
      node(
        'span',
        'permission-diff-title',
        item.installedPermissionChanges
          ? 'Изменения разрешений при обновлении'
          : 'Изменения разрешений к прошлой версии',
      ),
    );
    for (const label of changes.added) block.append(pill(`+ ${label}`, 'warn'));
    for (const label of changes.removed) block.append(pill(`− ${label}`, 'ok'));
    card.append(block);
  }

  if (!item.compatible) {
    card.append(
      node(
        'div',
        'card-banner card-banner--warn',
        `Нужен TikTok octo ${item.minAppVersion} или новее.`,
      ),
    );
  }
  if (item.blocked) {
    card.append(
      node('div', 'card-banner', 'Подпись не совпадает с содержимым пакета — установка запрещена.'),
    );
  }
  if (item.update) {
    const text = item.update.requiresApproval
      ? `Обновление до ${item.update.version} меняет разрешения и потребует подтверждения.`
      : `Доступно обновление до ${item.update.version}.`;
    card.append(
      node(
        'div',
        `card-banner ${item.update.requiresApproval ? 'card-banner--warn' : 'card-banner--info'}`,
        text,
      ),
    );
  }

  const actions = node('div', 'card-actions');
  const busy = state.busy && (state.busy.id === item.id || state.busy.scope === 'catalog');
  if (busy) {
    actions.append(node('span', 'ghost loading', busyLabel(state.busy.scope)));
  } else if (item.blocked) {
    actions.append(makeButton('Подпись неверна', 'ghost', '', {}, { disabled: true }));
  } else if (!item.compatible) {
    actions.append(makeButton(`Нужен ${item.minAppVersion}`, 'ghost', '', {}, { disabled: true }));
  } else if (item.update) {
    actions.append(
      makeButton(
        `Обновить до ${item.update.version}`,
        'primary',
        'update',
        { id: item.id },
        { disabled: Boolean(state.busy) },
      ),
    );
  } else if (item.installedVersion) {
    actions.append(
      makeButton(`Установлено ${item.installedVersion}`, 'ghost', '', {}, { disabled: true }),
    );
  } else {
    actions.append(
      makeButton(
        'Установить',
        'primary',
        'install',
        { id: item.id },
        { disabled: Boolean(state.busy) },
      ),
    );
  }

  if (item.homepage) {
    actions.append(makeButton('Сайт', 'ghost', 'home', { url: item.homepage }));
  }
  if (item.sourceCode) {
    actions.append(makeButton('Исходники', 'ghost', 'home', { url: item.sourceCode }));
  }
  actions.append(node('span', 'spacer'));
  const releases = item.releases || 1;
  actions.append(pill(`Выпусков: ${releases}`));
  card.append(actions);

  return card;
}

function renderCatalog() {
  const catalog = state.catalog || {};
  renderCategories(catalog);
  const sources = Array.isArray(catalog.sources) ? catalog.sources : [];
  const labels = sources.map((source) => source.label).filter(Boolean);
  const sourceSignature = labels.join('|');
  if (sourceSignature !== el.catalogSource.dataset.signature) {
    el.catalogSource.dataset.signature = sourceSignature;
    el.catalogSource.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'Все источники';
    el.catalogSource.append(all);
    for (const label of labels) {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      el.catalogSource.append(option);
    }
  }
  if (catalogSource && !labels.includes(catalogSource)) catalogSource = '';
  el.catalogSource.value = catalogSource;

  const items = sortedCatalog(
    (catalog.plugins || []).filter(
      (item) =>
        matches(item) &&
        (!catalogSource || (item.registryLabel || 'официальный') === catalogSource),
    ),
  );
  el.catalogList.replaceChildren(...items.map(catalogCard));
  el.catalogEmpty.hidden = items.length > 0 || catalog.status === 'loading';
  const unpublished = catalog.status === 'empty' && !query;
  const unavailable = catalog.status === 'error' && !query;
  el.catalogEmpty.querySelector('h3').textContent = query
    ? 'Ничего не найдено'
    : unpublished
      ? 'Каталог пока не опубликован'
      : unavailable
        ? 'Каталог недоступен'
        : 'Каталог пуст';
  el.catalogEmpty.querySelector('p').textContent = query
    ? 'Попробуйте другой запрос или очистите поиск.'
    : unpublished
      ? 'Локальная установка работает без каталога: выберите файл .octoplugin или укажите свой registry.json в настройках.'
      : 'Проверьте соединение или укажите другой адрес каталога в настройках.';

  el.badgeCatalog.hidden = !catalog.plugins?.length;
  el.badgeCatalog.textContent = String(catalog.plugins?.length || 0);

  if (state.busy?.scope === 'catalog') {
    el.catalogMeta.textContent = 'Обновляю каталог…';
  } else if (catalog.status === 'empty' && !catalog.plugins?.length) {
    el.catalogMeta.textContent = 'Каталог пока не опубликован · локальная установка доступна';
  } else if (catalog.status === 'error' && !catalog.plugins?.length) {
    el.catalogMeta.textContent = catalog.error || 'Каталог недоступен';
  } else if (catalog.plugins?.length) {
    const warnings = Array.isArray(catalog.warnings) ? catalog.warnings.length : 0;
    el.catalogMeta.textContent = `Плагинов в каталоге: ${catalog.plugins.length}${
      warnings ? ` · предупреждений: ${warnings}` : ''
    }`;
  } else {
    el.catalogMeta.textContent = 'Каталог ещё не загружен';
  }
}

function renderCategories(catalog) {
  const categories = [
    ...new Set((catalog.plugins || []).flatMap((item) => item.categories || [])),
  ].sort();
  if (activeCategory && !categories.includes(activeCategory)) activeCategory = '';
  el.catalogCategories.replaceChildren();
  el.catalogCategories.hidden = !categories.length;
  if (!categories.length) return;

  const add = (value, label) => {
    const button = node(
      'button',
      `category-chip${activeCategory === value ? ' is-active' : ''}`,
      label,
    );
    button.type = 'button';
    button.dataset.category = value;
    el.catalogCategories.append(button);
  };
  add('', 'Все');
  for (const category of categories) add(category, category);
}

// --- Установленные ----------------------------------------------------------

function installedCard(record) {
  const card = node('article', 'card card--wide');
  if (record.tampered || record.lastError) card.classList.add('card--error');

  const head = node('div', 'card-head');
  head.append(cardIcon(record));

  const titleBlock = node('div', 'card-title-block');
  const titleRow = node('div', 'card-title-row');
  titleRow.append(node('h3', 'card-title', record.name));
  titleRow.append(pill(`v${record.version}`));
  titleRow.append(sourcePill(record));
  titleRow.append(signaturePill(record.signature));
  if (record.update) titleRow.append(pill(`есть ${record.update.version}`, 'update'));
  if (record.cosmetic) titleRow.append(pill('косметика', 'ok'));
  if (record.pendingUpdate) titleRow.append(pill('ждёт подтверждения', 'warn'));
  titleBlock.append(titleRow);
  titleBlock.append(
    node(
      'p',
      'card-author',
      `${record.author?.name || 'неизвестный автор'} · ${record.license || 'UNLICENSED'}`,
    ),
  );
  head.append(titleBlock);

  const actions = node('div', 'card-actions');
  if (record.update) {
    actions.append(
      makeButton(
        `Обновить до ${record.update.version}`,
        'primary',
        'update',
        { id: record.id },
        { disabled: Boolean(state.busy) },
      ),
    );
  }
  if (record.cosmetic && !record.enabled) {
    actions.append(
      makeButton(
        'Превью',
        'ghost',
        'preview',
        { id: record.id },
        { disabled: Boolean(state.busy) },
      ),
    );
  }
  if (record.enabled) {
    actions.append(
      makeButton(
        'Перезагрузить',
        'ghost',
        'reload',
        { id: record.id },
        { disabled: Boolean(state.busy) },
      ),
    );
  }
  actions.append(
    makeButton(
      record.dev ? 'Удалить нельзя' : 'Удалить',
      record.dev ? 'ghost' : 'danger',
      record.dev ? '' : 'remove',
      { id: record.id },
      { disabled: record.dev || Boolean(state.busy), title: record.dev ? 'Папка разработки' : '' },
    ),
  );
  head.append(actions);
  card.append(head);

  card.append(node('p', 'card-description', record.description || 'Без описания.'));

  const switches = node('div', 'row-switches');
  const enable = node('label', 'inline-switch');
  const enableSwitch = node('span', 'switch');
  enableSwitch.setAttribute('role', 'switch');
  enableSwitch.setAttribute('tabindex', '0');
  enableSwitch.setAttribute('aria-checked', String(record.enabled === true));
  enableSwitch.dataset.act = 'enable';
  enableSwitch.dataset.id = record.id;
  if (record.tampered) enableSwitch.setAttribute('aria-disabled', 'true');
  enable.append(enableSwitch, node('span', '', record.enabled ? 'Включён' : 'Выключен'));
  switches.append(enable);

  if (!record.dev) {
    const auto = node('label', 'inline-switch');
    const autoSwitch = node('span', 'switch');
    autoSwitch.setAttribute('role', 'switch');
    autoSwitch.setAttribute('tabindex', '0');
    autoSwitch.setAttribute('aria-checked', String(record.autoUpdate === true));
    autoSwitch.dataset.act = 'auto';
    autoSwitch.dataset.id = record.id;
    auto.append(autoSwitch, node('span', '', 'Автообновление'));
    switches.append(auto);
  }

  if (record.active) switches.append(node('span', 'chip chip--low', 'работает'));
  else if (record.enabled) switches.append(node('span', 'chip chip--medium', 'остановлен'));
  card.append(switches);

  if (record.tampered) {
    card.append(
      node(
        'div',
        'card-banner',
        'Файлы изменены после установки. Плагин остановлен — переустановите его.',
      ),
    );
  } else if (record.lastError) {
    card.append(node('div', 'card-banner', record.lastError));
  }
  if (record.scan?.verdict === 'review') {
    card.append(
      node(
        'div',
        'card-banner card-banner--warn',
        `Статическая проверка нашла ${record.scan.warnings || 0} предупреждений. Подробности ниже.`,
      ),
    );
  }
  if (record.scan?.verdict === 'blocked') {
    card.append(
      node('div', 'card-banner', 'Проверка безопасности запретила запуск этого плагина.'),
    );
  }

  const chips = node('div', 'chips');
  permissionChips(record.permissions, chips);
  card.append(chips);

  card.append(
    cardMeta([
      record.sourceLabel,
      record.installedAt ? `установлен ${formatDate(record.installedAt)}` : '',
      record.networkHosts?.length ? `сеть: ${record.networkHosts.join(', ')}` : '',
    ]),
  );

  const details = document.createElement('details');
  details.className = 'details';
  details.append(node('summary', '', 'Разрешения, проверка, логи и настройки'));
  const grid = node('div', 'detail-grid');
  addPermissionsDetail(grid, record);
  addScanDetail(grid, record);
  addLogsDetail(grid, record);
  addScreenshotsDetail(grid, record);
  addSettingsDetail(grid, record);
  addHistoryDetail(grid, record);
  addAboutDetail(grid, record);
  details.append(grid);
  card.append(details);

  return card;
}

function renderInstalled() {
  const records = (state.installed || []).filter((record) => matches(record));
  el.installedList.replaceChildren(...records.map(installedCard));
  el.installedEmpty.hidden = records.length > 0;
  el.installedEmpty.querySelector('h3').textContent = query
    ? 'Ничего не найдено'
    : 'Плагинов пока нет';
  el.installedEmpty.querySelector('p').textContent = query
    ? 'Попробуйте другой запрос.'
    : 'Выберите что-нибудь в каталоге или установите файл .octoplugin.';

  const total = state.installed?.length || 0;
  const enabled = state.installed?.filter((record) => record.enabled).length || 0;
  el.installedMeta.textContent = total
    ? `Плагинов: ${total} · включено ${enabled}`
    : 'Пока ничего не установлено';
  el.badgeInstalled.hidden = total === 0;
  el.badgeInstalled.textContent = String(total);
}

// --- Обновления -------------------------------------------------------------

function updateCard(record) {
  const update = record.update;
  const card = node('article', 'card card--wide');
  const head = node('div', 'card-head');
  head.append(cardIcon(record));

  const titleBlock = node('div', 'card-title-block');
  const titleRow = node('div', 'card-title-row');
  titleRow.append(node('h3', 'card-title', record.name));
  titleRow.append(signaturePill(update.signature));
  titleBlock.append(titleRow);
  titleBlock.append(node('p', 'card-author', record.author?.name || 'неизвестный автор'));
  head.append(titleBlock);
  card.append(head);

  const arrow = node('div', 'update-arrow');
  arrow.append(node('span', '', `v${record.version}`));
  arrow.append(node('span', '', '→'));
  arrow.append(node('strong', '', `v${update.version}`));
  card.append(arrow);

  if (update.changelog) {
    const changelog = node('p', 'card-description changelog', update.changelog);
    card.append(changelog);
  }

  if (update.requiresApproval) {
    const parts = [];
    if (update.addedPermissions?.length) {
      parts.push(`новые разрешения: ${permissionIdsText(update.addedPermissions)}`);
    }
    if (update.changedHosts) parts.push('изменены сетевые хосты');
    if (update.signatureDowngrade) parts.push('подпись больше не проверена');
    card.append(
      node(
        'div',
        'card-banner card-banner--warn',
        `Обновление потребует подтверждения: ${parts.join('; ')}.`,
      ),
    );
  }
  if (record.pendingUpdate === update.version) {
    card.append(
      node(
        'div',
        'card-banner card-banner--warn',
        'Автоматическое обновление приостановлено: проверьте предупреждения и подтвердите вручную.',
      ),
    );
  }
  if (update.incompatible) {
    card.append(
      node(
        'div',
        'card-banner card-banner--warn',
        `Нужен TikTok octo ${update.minAppVersion || ''} или новее.`,
      ),
    );
  }
  if (update.blocked) {
    card.append(
      node('div', 'card-banner', 'Подпись обновления недействительна — установка запрещена.'),
    );
  }

  const actions = node('div', 'card-actions');
  actions.append(
    makeButton(
      'Обновить',
      'primary',
      'update',
      { id: record.id },
      { disabled: Boolean(state.busy) || update.blocked || update.incompatible },
    ),
  );
  actions.append(node('span', 'spacer'));
  actions.append(pill(record.autoUpdate ? 'авто' : 'вручную'));
  card.append(actions);
  return card;
}

function renderUpdates() {
  const updates = state.updates || [];
  el.updatesList.replaceChildren(...updates.map(updateCard));
  el.updatesEmpty.hidden = updates.length > 0;
  el.updatesMeta.textContent = updates.length ? `Обновлений: ${updates.length}` : 'Всё актуально';
  el.badgeUpdates.hidden = updates.length === 0;
  el.badgeUpdates.textContent = String(updates.length);
  el.btnUpdateAll.hidden = updates.length === 0;
  el.btnUpdateAll.disabled = Boolean(state.busy);
}

// --- Настройки --------------------------------------------------------------

function setSwitch(element, value) {
  element.setAttribute('aria-checked', String(Boolean(value)));
}

function renderSettings() {
  const settings = state.settings || {};
  setSwitch(el.switchAutoUpdate, settings.autoUpdate === true);
  setSwitch(el.switchAllowUnsigned, settings.allowUnsigned !== false);
  setSwitch(el.switchRequireSignatures, settings.requireSignatures === true);
  el.selectInterval.value = String(settings.updateIntervalHours ?? 6);

  if (document.activeElement !== el.inputRegistry) {
    el.inputRegistry.value = settings.registryUrl || '';
  }
  if (document.activeElement !== el.inputRegistries) {
    el.inputRegistries.value = (settings.registryUrls || []).join('\n');
  }

  const catalog = state.catalog || {};
  const note = catalog.fetchedAt
    ? `Последняя удачная загрузка: ${formatDate(catalog.fetchedAt)}.`
    : 'Каталог ещё не загружался.';
  el.registryHint.textContent =
    settings.registryUrl === info.defaultRegistryUrl
      ? `${note} Это стандартный каталог проекта.`
      : `${note} Используется пользовательский адрес.`;
}

// --- Общая отрисовка --------------------------------------------------------

function matches(item) {
  if (
    activeCategory &&
    Array.isArray(item.categories) &&
    !item.categories.includes(activeCategory)
  ) {
    return false;
  }
  if (!query) return true;
  const haystack = [
    item.name,
    item.id,
    item.description,
    item.author?.name,
    ...(item.categories || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function renderNotice() {
  const catalog = state.catalog || {};
  let text = '';
  if (catalog.status === 'error') text = `Каталог недоступен: ${catalog.error || 'нет соединения'}`;
  else if (catalog.status === 'stale' && catalog.error) {
    text = `Не удалось обновить каталог, показан кеш: ${catalog.error}`;
  }
  if (!text || text === dismissedNotice) {
    el.notice.hidden = true;
    return;
  }
  el.noticeText.textContent = text;
  el.notice.hidden = false;
}

function renderTabs() {
  for (const item of document.querySelectorAll('[data-tab]')) {
    item.classList.toggle('is-active', item.dataset.tab === activeTab);
    item.setAttribute('aria-current', item.dataset.tab === activeTab ? 'page' : 'false');
  }
  for (const page of document.querySelectorAll('[data-page]')) {
    page.hidden = page.dataset.page !== activeTab;
  }
}

function render() {
  rendered = true;
  el.version.textContent = `v${state.version || '—'} · менеджер плагинов`;
  el.pluginDir.textContent = state.info?.pluginDir || info.pluginDir || '';
  renderTabs();
  renderNotice();
  renderCatalog();
  renderInstalled();
  renderUpdates();
  renderSettings();

  const empty = state.installed?.length === 0 && state.catalog?.plugins?.length === 0;
  if (activeTab === 'catalog' && empty && !state.busy) {
    // Первый запуск: подсказка вместо пустого экрана.
    el.catalogEmpty.hidden = Boolean(query);
  }

  if (state.busy) el.btnRefresh.disabled = true;
  else el.btnRefresh.disabled = false;
}

// --- События ----------------------------------------------------------------

el.content.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-act]');
  if (!action) return;
  const id = action.dataset.id || '';
  const kind = action.dataset.act;

  if (kind === 'install') run('install', { id });
  else if (kind === 'update') run('update', { id });
  else if (kind === 'remove') run('remove', { id });
  else if (kind === 'reload') run('reload', { id });
  else if (kind === 'preview') run('preview', { id });
  else if (kind === 'rollback') {
    run('rollback', { id, version: action.dataset.version || '' });
  } else if (kind === 'logs') {
    const result = await run('logs', { id });
    if (result?.logs) updateLogs(id, result.logs);
  } else if (kind === 'home') run('openHomepage', { url: action.dataset.url || '' });
  else if (kind === 'enable') {
    run('toggle', { id, enabled: action.getAttribute('aria-checked') !== 'true' });
  } else if (kind === 'auto') {
    run('autoUpdate', { id, value: action.getAttribute('aria-checked') !== 'true' });
  }
});

el.content.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-setting-toggle]');
  if (!toggle) return;
  const value = toggle.getAttribute('aria-checked') !== 'true';
  run('pluginSettings', {
    id: toggle.dataset.id,
    key: toggle.dataset.key,
    value,
  });
});

el.content.addEventListener('change', (event) => {
  const control = event.target.closest('[data-setting]');
  if (!control) return;
  const type = control.dataset.type;
  let value = control.value;
  if (type === 'number') value = Number(value);
  run('pluginSettings', {
    id: control.dataset.id,
    key: control.dataset.key,
    value,
  });
});

el.content.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const toggle = event.target.closest('[data-setting-toggle]');
  if (!toggle) return;
  event.preventDefault();
  toggle.click();
});

for (const item of document.querySelectorAll('[data-tab]')) {
  item.addEventListener('click', () => {
    activeTab = item.dataset.tab;
    render();
    el.content.scrollTop = 0;
  });
}

el.catalogCategories.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category || '';
  render();
});

el.catalogSort.addEventListener('change', () => {
  catalogSort = el.catalogSort.value;
  renderCatalog();
});

el.catalogSource.addEventListener('change', () => {
  catalogSource = el.catalogSource.value;
  renderCatalog();
});

el.search.addEventListener('input', () => {
  query = el.search.value.trim().toLowerCase();
  render();
});

el.btnRefresh.addEventListener('click', () => run('refreshCatalog'));
$('btnCatalogRefresh').addEventListener('click', () => run('refreshCatalog'));
$('btnInstallFile').addEventListener('click', () => run('installFile'));
$('btnUpdateAll').addEventListener('click', () => run('updateAll'));
$('btnCheckUpdates').addEventListener('click', () => run('checkUpdates'));
$('btnDocs').addEventListener('click', () => run('openDocs'));
$('btnRules').addEventListener('click', () => run('openRules'));
$('btnFolder').addEventListener('click', () => run('openFolder'));
$('btnSettingsDocs').addEventListener('click', () => run('openDocs'));
$('btnSettingsRules').addEventListener('click', () => run('openRules'));
$('btnOpenFolder').addEventListener('click', () => run('openFolder'));
$('btnReloadDev').addEventListener('click', () => run('reloadDev'));
el.btnNoticeClose.addEventListener('click', () => {
  dismissedNotice = el.noticeText.textContent;
  el.notice.hidden = true;
});

el.switchAutoUpdate.addEventListener('click', () => {
  const value = el.switchAutoUpdate.getAttribute('aria-checked') !== 'true';
  run('setSettings', { patch: { autoUpdate: value } });
});
el.switchAllowUnsigned.addEventListener('click', () => {
  const value = el.switchAllowUnsigned.getAttribute('aria-checked') !== 'true';
  run('setSettings', { patch: { allowUnsigned: value } });
});
el.switchRequireSignatures.addEventListener('click', () => {
  const value = el.switchRequireSignatures.getAttribute('aria-checked') !== 'true';
  run('setSettings', { patch: { requireSignatures: value } });
});
el.selectInterval.addEventListener('change', () => {
  run('setSettings', { patch: { updateIntervalHours: Number(el.selectInterval.value) } });
});

$('btnRegistrySave').addEventListener('click', async () => {
  const value = el.inputRegistry.value.trim();
  if (!value) {
    showToast('Укажите адрес registry.json', true);
    return;
  }
  const result = await run('setSettings', { patch: { registryUrl: value } });
  if (result.ok) {
    showToast('Адрес каталога сохранён');
    run('refreshCatalog');
  }
});

$('btnRegistriesSave').addEventListener('click', async () => {
  const urls = el.inputRegistries.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result = await run('setSettings', { patch: { registryUrls: urls } });
  if (!result.ok) {
    showToast(result.error || 'Не удалось сохранить каталоги', true);
    return;
  }
  showToast('Дополнительные каталоги сохранены');
  run('refreshCatalog');
});

$('btnRegistryReset').addEventListener('click', async () => {
  const value = info.defaultRegistryUrl;
  if (!value) return;
  const result = await run('setSettings', { patch: { registryUrl: value } });
  if (result.ok) {
    showToast('Стандартный каталог восстановлен');
    run('refreshCatalog');
  }
});

for (const button of document.querySelectorAll('[data-window]')) {
  button.addEventListener('click', () => {
    api.action('window', button.dataset.window).catch(() => {});
  });
}

document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    el.search.focus();
    el.search.select();
  }
  if (mod && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    run('refreshCatalog');
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const toggle = event.target.closest?.('.switch[role="switch"]');
    if (toggle) {
      event.preventDefault();
      toggle.click();
    }
  }
});

api.onState((next) => {
  if (!next) return;
  state = next;
  if (next.info) info = next.info;
  render();
});

(async function init() {
  try {
    const result = await api.ready();
    if (result?.ok) {
      state = result.state || state;
      info = result.info || state.info || {};
      render();
    }
  } catch (err) {
    showToast(`Не удалось открыть менеджер: ${err.message}`, true);
  }
})();

// Рисуем пустое состояние до первого ответа, чтобы окно не мигало белым.
if (!rendered) render();
