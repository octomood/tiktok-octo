'use strict';

/**
 * Менеджер плагинов.
 *
 * Renderer не решает, что и как устанавливать: он рисует состояние из main и
 * отправляет действия. Диалоги подтверждения, скачивание, проверки и запись
 * файлов остаются в main-процессе, поэтому интерфейс нельзя «обойти» из DevTools.
 */

(() => {
  const api = window.octoPlugins;
  const $ = (id) => document.getElementById(id);

  const el = {
    panel: $('pluginsPanel'),
    content: $('pluginsContent'),
    version: $('pluginsVersion'),
    btnClose: $('btnPluginsClose'),
    pluginDir: $('pluginDir'),
    toast: $('pluginsToast'),
    installedList: $('installedList'),
    installedEmpty: $('installedEmpty'),
    installedMeta: $('installedMeta'),
    badgeInstalled: $('badgeInstalled'),
    switchAllowUnsigned: $('switchAllowUnsigned'),
    switchRequireSignatures: $('switchRequireSignatures'),
  };

  let state = {
    version: '',
    settings: {},
    installed: [],
    busy: null,
    info: {},
  };
  let info = {};
  let activeTab = 'catalog';
  let toastTimer = null;
  let rendered = false;
  const openDetails = new Set();

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
      return new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' }).format(
        date,
      );
    } catch {
      return date.toLocaleString();
    }
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
      const head = node('div', 'setting-label-wrap');
      head.append(node('label', '', setting.title));
      if (setting.description) {
        head.append(node('small', 'setting-desc', setting.description));
      }
      row.append(head);
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
      } else if (setting.type === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = String(setting.value || setting.default || '#8c84a9');
        for (const key of Object.keys(common)) input.setAttribute(key, common[key]);
        row.append(input);
      } else if (setting.type === 'textarea') {
        row.classList.add('setting-control--stack');
        const textarea = document.createElement('textarea');
        textarea.className = 'text-area';
        textarea.rows = 3;
        textarea.maxLength = setting.maxLength || 4000;
        if (setting.placeholder) textarea.placeholder = setting.placeholder;
        textarea.value = String(setting.value ?? '');
        for (const key of Object.keys(common)) textarea.setAttribute(key, common[key]);
        row.append(textarea);
      } else if (setting.type === 'secret') {
        row.classList.add('setting-control--stack');
        const wrap = node('div', 'setting-secret-wrap');
        const input = document.createElement('input');
        input.className = 'text-input';
        input.type = 'password';
        input.autocomplete = 'off';
        input.maxLength = setting.maxLength || 4096;
        input.placeholder = setting.hasValue
          ? 'Сохранено (введите новое значение)'
          : setting.placeholder || 'Введите значение…';
        input.dataset.secretInput = setting.key;
        input.dataset.id = record.id;
        const saveBtn = makeButton('Сохранить', 'ghost setting-mini-btn', 'secretSave', {
          id: record.id,
        });
        saveBtn.dataset.key = setting.key;
        wrap.append(input, saveBtn);
        if (setting.hasValue) {
          const clearBtn = makeButton('Очистить', 'ghost setting-mini-btn', 'secretClear', {
            id: record.id,
          });
          clearBtn.dataset.key = setting.key;
          wrap.append(clearBtn);
        }
        row.append(wrap);
      } else if (setting.type === 'action') {
        const btn = makeButton(
          setting.buttonLabel || setting.title,
          'ghost setting-mini-btn',
          'settingAction',
          {
            id: record.id,
          },
        );
        btn.dataset.key = setting.key;
        row.append(btn);
      } else {
        const input = document.createElement('input');
        input.className = 'text-input';
        input.type = 'text';
        input.maxLength = setting.maxLength || 1000;
        if (setting.placeholder) input.placeholder = setting.placeholder;
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
    if (record.cosmetic) titleRow.append(pill('косметика', 'ok'));
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
      if (record.dev && record.active) {
        actions.append(
          makeButton(
            'DevTools',
            'ghost',
            'devtools',
            { id: record.id },
            { disabled: Boolean(state.busy) },
          ),
        );
      }
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
        {
          disabled: record.dev || Boolean(state.busy),
          title: record.dev ? 'Папка разработки' : '',
        },
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
    details.dataset.pluginDetails = record.id;
    if (openDetails.has(record.id)) details.open = true;
    details.addEventListener('toggle', () => {
      if (details.open) openDetails.add(record.id);
      else openDetails.delete(record.id);
    });
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
    const records = state.installed || [];
    el.installedList.replaceChildren(...records.map(installedCard));
    el.installedEmpty.hidden = records.length > 0;
    el.installedEmpty.querySelector('h3').textContent = 'Плагинов пока нет';
    el.installedEmpty.querySelector('p').textContent =
      'Скачайте плагин из Telegram-канала t.me/octo_plugins и установите файл .octoplugin.';

    const total = state.installed?.length || 0;
    const enabled = state.installed?.filter((record) => record.enabled).length || 0;
    el.installedMeta.textContent = total
      ? `Плагинов: ${total} · включено ${enabled}`
      : 'Пока ничего не установлено';
    el.badgeInstalled.hidden = total === 0;
    el.badgeInstalled.textContent = String(total);
  }

  // --- Настройки --------------------------------------------------------------

  function setSwitch(element, value) {
    element.setAttribute('aria-checked', String(Boolean(value)));
  }

  function renderSettings() {
    const settings = state.settings || {};
    setSwitch(el.switchAllowUnsigned, settings.allowUnsigned !== false);
    setSwitch(el.switchRequireSignatures, settings.requireSignatures === true);
  }

  // --- Общая отрисовка --------------------------------------------------------

  function renderTabs() {
    for (const item of el.panel.querySelectorAll('[data-tab]')) {
      const active = item.dataset.tab === activeTab;
      item.classList.toggle('is-active', active);
      item.classList.toggle('is-current', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    }
    for (const page of el.panel.querySelectorAll('[data-page]')) {
      page.hidden = page.dataset.page !== activeTab;
    }
  }

  function render() {
    rendered = true;
    el.version.textContent = `v${state.version || '—'} · менеджер плагинов`;
    el.pluginDir.textContent = state.info?.pluginDir || info.pluginDir || '';
    renderTabs();
    renderInstalled();
    renderSettings();
  }

  // --- События ----------------------------------------------------------------

  el.content.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]');
    if (!action) return;
    const id = action.dataset.id || '';
    const kind = action.dataset.act;

    if (kind === 'remove') run('remove', { id });
    else if (kind === 'reload') run('reload', { id });
    else if (kind === 'devtools') run('openDevTools', { id });
    else if (kind === 'preview') run('preview', { id });
    else if (kind === 'rollback') {
      run('rollback', { id, version: action.dataset.version || '' });
    } else if (kind === 'logs') {
      const result = await run('logs', { id });
      if (result?.logs) updateLogs(id, result.logs);
    } else if (kind === 'settingAction') {
      run('pluginSettingAction', { id, key: action.dataset.key || '' });
    } else if (kind === 'secretSave') {
      const wrap = action.closest('.setting-secret-wrap');
      const input = wrap?.querySelector('[data-secret-input]');
      const value = input ? input.value : '';
      if (!value) {
        showToast('Введите значение секрета', true);
        return;
      }
      const res = await run('pluginSettings', { id, key: action.dataset.key || '', value });
      if (res?.ok && input) input.value = '';
    } else if (kind === 'secretClear') {
      run('pluginSettings', { id, key: action.dataset.key || '', value: '' });
    } else if (kind === 'home') run('openHomepage', { url: action.dataset.url || '' });
    else if (kind === 'enable') {
      run('toggle', { id, enabled: action.getAttribute('aria-checked') !== 'true' });
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

  for (const item of el.panel.querySelectorAll('[data-tab]')) {
    item.addEventListener('click', () => {
      activeTab = item.dataset.tab;
      render();
      el.content.scrollTop = 0;
    });
  }

  el.panel.addEventListener('click', (event) => {
    if (event.target === el.panel) api.action('close').catch(() => {});
  });
  el.btnClose.addEventListener('click', () => api.action('close').catch(() => {}));

  $('btnTelegram').addEventListener('click', () => run('openTelegram'));
  $('btnInstallFile').addEventListener('click', () => run('installFile'));
  $('btnInstallFileInline').addEventListener('click', () => run('installFile'));
  $('btnDocs').addEventListener('click', () => run('openDocs'));
  $('btnRules').addEventListener('click', () => run('openRules'));
  $('btnFolder').addEventListener('click', () => run('openFolder'));
  $('btnSettingsDocs').addEventListener('click', () => run('openDocs'));
  $('btnSettingsRules').addEventListener('click', () => run('openRules'));
  $('btnOpenFolder').addEventListener('click', () => run('openFolder'));
  $('btnReloadDev').addEventListener('click', () => run('reloadDev'));

  el.switchAllowUnsigned.addEventListener('click', () => {
    const value = el.switchAllowUnsigned.getAttribute('aria-checked') !== 'true';
    run('setSettings', { patch: { allowUnsigned: value } });
  });
  el.switchRequireSignatures.addEventListener('click', () => {
    const value = el.switchRequireSignatures.getAttribute('aria-checked') !== 'true';
    run('setSettings', { patch: { requireSignatures: value } });
  });

  el.panel.addEventListener('keydown', (event) => {
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

  // Рисуем пустое состояние до первого ответа, чтобы оверлей не мигал.
  if (!rendered) render();
})();
