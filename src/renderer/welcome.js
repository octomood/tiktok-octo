'use strict';

/**
 * Мастер первого запуска: язык интерфейса и прокси.
 *
 * Разметка лежит в index.html, состояние приходит из main через octo:state.
 * Никакой сети и Node: поиск прокси выполняет main (proxy-discovery.js),
 * здесь только команды и отрисовка результата.
 */
(() => {
  const api = window.octo;
  const $ = (id) => document.getElementById(id);
  const tr = (text) => (window.octoI18n ? window.octoI18n.translate(text) : text);

  const el = {
    root: $('welcome'),
    language: $('welcomeLanguage'),
    toggle: $('welcomeProxyToggle'),
    fields: $('welcomeProxyFields'),
    proxy: $('welcomeProxy'),
    discover: $('welcomeDiscover'),
    scan: $('welcomeScanState'),
    found: $('welcomeFound'),
    dpi: $('welcomeDpiToggle'),
    dpiNote: $('welcomeDpiNote'),
    skip: $('welcomeSkip'),
    continue: $('welcomeContinue'),
  };

  if (!el.root) return;

  let state = {};
  let proxyEnabled = false;
  let dpiEnabled = false;
  let wasOpen = false;
  let languagesSignature = '';
  let foundSignature = '';

  function fillLanguages() {
    const languages = Array.isArray(state.languages) ? state.languages : [];
    const selected = state.language || 'ru';
    const signature = `${selected}#${languages.map((item) => `${item.id}:${item.label}`).join('|')}`;
    if (signature === languagesSignature) return;
    languagesSignature = signature;

    el.language.replaceChildren(
      ...languages.map((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        option.selected = item.id === selected;
        // Названия языков принято показывать на самом языке, не переводим.
        option.dataset.i18nSkip = '1';
        return option;
      }),
    );
    el.language.value = selected;
  }

  function foundLabel(item) {
    const tail = item.online ? item.country || 'OK' : tr('нет интернета');
    return [item.label, item.url, tail].filter(Boolean).join(' · ');
  }

  function fillFound(scan) {
    const items = Array.isArray(scan.items) ? scan.items : [];
    // Язык в подписи: при его смене подпись «нет интернета» переводится заново.
    const signature = `${state.language || 'ru'}#${items
      .map((item) => `${item.url}:${item.online}:${item.country}:${item.city}`)
      .join('|')}`;
    if (signature === foundSignature) return;
    foundSignature = signature;

    el.found.hidden = items.length === 0;
    el.found.replaceChildren(
      ...items.map((item) => {
        const option = document.createElement('option');
        option.value = item.url;
        option.textContent = foundLabel(item);
        // Адрес и страна — данные, не текст интерфейса.
        option.dataset.i18nSkip = '1';
        return option;
      }),
    );

    if (items.length > 0) {
      el.found.value = items[0].url;
      // Поле ещё пустое — подставляем первый работающий прокси.
      if (!el.proxy.value) el.proxy.value = items[0].url;
    }
  }

  function renderScan(scan) {
    const loading = scan.state === 'loading';
    el.discover.disabled = loading;

    if (loading) {
      el.scan.textContent = tr('Ищу запущенные прокси…');
      el.scan.hidden = false;
      return;
    }

    if (scan.state !== 'done') {
      el.scan.textContent = '';
      el.scan.hidden = true;
      return;
    }

    const count = Array.isArray(scan.items) ? scan.items.length : 0;
    el.scan.textContent =
      count === 0
        ? tr('Ничего не найдено. Запустите VPN-клиент или укажите адрес вручную.')
        : tr(`Найдено прокси: ${count}`);
    el.scan.hidden = false;
    fillFound(scan);
  }

  function render() {
    const open = Boolean(state.welcome && state.welcome.open);
    el.root.hidden = !open;

    if (!open) {
      wasOpen = false;
      return;
    }

    // Открыли мастер (впервые или повторно) — берём сохранённый адрес.
    if (!wasOpen) {
      wasOpen = true;
      proxyEnabled = Boolean(state.region && state.region.proxy);
      dpiEnabled = Boolean(state.dpi && state.dpi.enabled);
      el.proxy.value = (state.region && state.region.proxy) || '';
      el.language.focus();
    }

    fillLanguages();
    el.toggle.setAttribute('aria-checked', String(proxyEnabled));
    el.fields.hidden = !proxyEnabled;
    el.dpi.setAttribute('aria-checked', String(dpiEnabled));
    el.dpiNote.hidden = !dpiEnabled;

    if (proxyEnabled) {
      renderScan(state.proxyScan || { state: 'idle', items: [] });
    }
  }

  el.language.addEventListener('change', () => api.cmd('language', el.language.value));

  el.toggle.addEventListener('click', () => {
    proxyEnabled = !proxyEnabled;
    // Прокси и обход DPI — альтернативы, одновременно не нужны.
    if (proxyEnabled) dpiEnabled = false;
    render();
    if (proxyEnabled) el.proxy.focus();
  });

  el.dpi.addEventListener('click', () => {
    dpiEnabled = !dpiEnabled;
    if (dpiEnabled) proxyEnabled = false;
    render();
  });

  el.discover.addEventListener('click', () => api.cmd('welcomeDiscover'));

  el.found.addEventListener('change', () => {
    if (el.found.value) el.proxy.value = el.found.value;
  });

  el.proxy.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    el.continue.click();
  });

  el.skip.addEventListener('click', () => api.cmd('welcomeSkip'));

  el.continue.addEventListener('click', () => {
    api.cmd('welcomeFinish', {
      language: el.language.value,
      proxyEnabled,
      dpiEnabled,
      proxy: el.proxy.value.trim(),
    });
  });

  api.onState((next) => {
    // app-context присылает и частичные обновления (например, {toast}):
    // заменять состояние целиком нельзя, иначе мастер закроется на тосте.
    state = { ...state, ...next };
    render();
  });
  render();
})();
