'use strict';

/**
 * Логика собственного интерфейса. Никакого доступа к сети и Node —
 * только команды окна через мост window.octo из preload.
 */

const api = window.octo;
const $ = (id) => document.getElementById(id);

const el = {
  chrome: $('chrome'),
  titlebar: $('titlebar'),
  pipbar: $('pipbar'),
  pipTitle: $('pipTitle'),
  pipPrev: $('btnPipPrev'),
  pipPlay: $('btnPipPlay'),
  pipNext: $('btnPipNext'),
  pipAuto: $('btnPipAuto'),
  pipAdaptive: $('btnPipAdaptive'),
  pipClose: $('btnPipClose'),
  back: $('btnBack'),
  forward: $('btnForward'),
  reload: $('btnReload'),
  home: $('btnHome'),
  pip: $('btnPip'),
  mute: $('btnMute'),
  top: $('btnTop'),
  min: $('btnMin'),
  max: $('btnMax'),
  close: $('btnClose'),
  pill: $('pagePill'),
  title: $('pageTitle'),
  unread: $('unreadBadge'),
  progress: $('progress'),
  findbar: $('findbar'),
  findInput: $('findInput'),
  findCount: $('findCount'),
  findPrev: $('btnFindPrev'),
  findNext: $('btnFindNext'),
  findClose: $('btnFindClose'),
  download: $('download'),
  downloadFill: $('downloadFill'),
  panel: $('panel'),
  btnPanel: $('btnPanel'),
  btnPanelClose: $('btnPanelClose'),
  panelVersion: $('panelVersion'),
  panelSearch: $('panelSearch'),
  panelSearchClear: $('btnPanelSearchClear'),
  panelNoResults: $('panelNoResults'),
  panelZoom: $('panelZoom'),
  panelCosmetics: $('panelCosmetics'),
  panelDownloads: $('panelDownloads'),
  downloadsEmpty: $('downloadsEmpty'),
  sleepLabel: $('sleepLabel'),
  rowMute: $('rowMute'),
  volumeRange: $('volumeRange'),
  volumeValue: $('volumeValue'),
  rowPip: $('rowPip'),
  rowPipAuto: $('rowPipAuto'),
  rowPipAdaptive: $('rowPipAdaptive'),
  rowOnTop: $('rowOnTop'),
  rowTray: $('rowTray'),
  rowAutostart: $('rowAutostart'),
  rowStartTray: $('rowStartTray'),
  rowStartMuted: $('rowStartMuted'),
  rowLoop: $('rowLoop'),
  rowPauseBlur: $('rowPauseBlur'),
  rowAdSkip: $('rowAdSkip'),
  regionSelect: $('regionSelect'),
  regionProxy: $('regionProxy'),
  regionProxyState: $('regionProxyState'),
  regionIpValue: $('regionIpValue'),
  regionIpResult: $('regionIpResult'),
  rowInstallApp: $('rowInstallApp'),
  installAppLabel: $('installAppLabel'),
  palette: $('palette'),
  paletteInput: $('paletteInput'),
  paletteList: $('paletteList'),
};

const state = {
  title: 'TikTok',
  url: '',
  loading: false,
  muted: false,
  onTop: false,
  pip: false,
  pipAuto: true,
  pipAdaptive: false,
  playing: false,
  maximized: false,
  canGoBack: false,
  canGoForward: false,
  chromeHidden: false,
  unread: 0,
  zoom: 100,
  find: { open: false, text: '', matches: 0, active: 0 },
  download: null,
  panel: false,
  panelWidth: 300,
  palette: false,
  player: { speed: 1, volume: 1, startMuted: false, loop: false, pauseOnBlur: false },
  cosmetics: [],
  closeToTray: false,
  autostart: false,
  startInTray: false,
  adsSkip: false,
  region: { preset: 'off', proxy: '' },
  regionCheck: { state: 'idle', text: 'Проверить' },
  regions: [],
  appimage: { available: false, installed: false },
  downloads: [],
  sleepTimerEnds: 0,
  sleepTimerMinutes: 0,
  version: '',
};

let toastText = '';
let toastTimer = null;
let findWasOpen = false;

// Открытые разделы панели функций и текущий поисковый запрос.
const openCategories = new Set(['page']);
let panelQuery = '';

if (api.ui.platform === 'darwin') document.body.classList.add('mac');

// --- Действия ---------------------------------------------------------------

const actions = [
  [el.back, 'back'],
  [el.forward, 'forward'],
  [el.reload, 'reload'],
  [el.home, 'home'],
  [el.pip, 'pip'],
  [el.pipPrev, 'feedPrev'],
  [el.pipPlay, 'togglePlayback'],
  [el.pipNext, 'feedNext'],
  [el.pipAuto, 'pipAuto'],
  [el.pipAdaptive, 'pipAdaptive'],
  [el.pipClose, 'pipClose'],
  [el.mute, 'mute'],
  [el.top, 'onTop'],
  [el.min, 'minimize'],
  [el.max, 'maximize'],
  [el.close, 'close'],
];

for (const [node, command] of actions) {
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    api.cmd(command);
  });
}

el.findPrev.addEventListener('click', () => api.find('prev'));
el.findNext.addEventListener('click', () => api.find('next'));
el.findClose.addEventListener('click', () => api.find('close'));

el.btnPanel.addEventListener('click', (event) => {
  event.stopPropagation();
  api.cmd('panel');
});
el.btnPanelClose.addEventListener('click', () => api.cmd('panel'));

el.panelSearch.addEventListener('input', applyPanelFilter);
el.panelSearchClear.addEventListener('click', () => {
  el.panelSearch.value = '';
  applyPanelFilter();
  el.panelSearch.focus();
});

// Строки панели: действия и переключатели косметики.
el.panel.addEventListener('click', (event) => {
  const catHead = event.target.closest('[data-cat-head]');
  if (catHead) {
    toggleCategory(catHead.dataset.catHead);
    return;
  }

  const sleep = event.target.closest('[data-sleep]');
  if (sleep) {
    api.cmd('sleepTimer', Number(sleep.dataset.sleep));
    return;
  }

  const cancelDownload = event.target.closest('[data-download-cancel]');
  if (cancelDownload) {
    api.cmd('downloadCancel', cancelDownload.dataset.downloadCancel);
    return;
  }

  const showDownload = event.target.closest('[data-download-show]');
  if (showDownload) {
    api.cmd('downloadShow', showDownload.dataset.downloadShow);
    return;
  }

  const speed = event.target.closest('[data-player-speed]');
  if (speed) {
    api.cmd('playerSpeed', Number(speed.dataset.playerSpeed));
    return;
  }

  const playerToggle = event.target.closest('[data-player-toggle]');
  if (playerToggle) {
    api.cmd('playerToggle', playerToggle.dataset.playerToggle);
    return;
  }

  const cosmetic = event.target.closest('[data-cosmetic]');
  if (cosmetic) {
    api.cmd('cosmetic', cosmetic.dataset.cosmetic);
    return;
  }

  const row = event.target.closest('[data-cmd]');
  if (!row) return;
  if (row.dataset.cmd === 'regionProxyApply') {
    api.cmd('regionProxyApply', el.regionProxy.value.trim());
    return;
  }
  api.cmd(row.dataset.cmd);
});

// Громкость: ползунок живёт в панели и меняет volume у видео сайта.
let volumeTimer = null;
el.volumeRange.addEventListener('input', () => {
  const percent = Math.min(100, Math.max(0, Math.round(Number(el.volumeRange.value) || 0)));
  paintVolume(percent);
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    api.cmd('playerVolume', percent / 100);
  }, 40);
});

// Регион: выбор страны применяется сразу, прокси — по кнопке или Enter.
el.regionSelect.addEventListener('change', () => api.cmd('region', el.regionSelect.value));
el.regionProxy.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  api.cmd('regionProxyApply', el.regionProxy.value.trim());
});
api.onPanelCategory((id) => {
  if (!id) return;
  openCategories.add(id);
  applyPanelFilter();
});

// Палитра команд.
el.paletteInput.addEventListener('input', () => {
  paletteIndex = 0;
  filterPalette();
});

el.paletteInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    movePalette(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    movePalette(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    activatePalette(paletteIndex);
  }
});

el.paletteList.addEventListener('click', (event) => {
  const item = event.target.closest('[data-index]');
  if (item) activatePalette(Number(item.dataset.index));
});

el.findInput.addEventListener('input', () => api.find('query', el.findInput.value));
el.findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    api.find(event.shiftKey ? 'prev' : 'next');
  }
});

// Двойной клик по пустому месту полосы — развернуть/восстановить.
el.titlebar.addEventListener('dblclick', (event) => {
  if (event.target.closest('button')) return;
  api.cmd('maximize');
});

// Средняя кнопка мыши по «Назад» — как в браузерах, ничего не делает,
// поэтому просто гасим автоскролл-жесты внутри полосы.
el.titlebar.addEventListener('mousedown', (event) => {
  if (event.button === 1) event.preventDefault();
});

// --- Высота интерфейса ------------------------------------------------------

let lastChromeHeight = 0;

function syncChromeHeight() {
  const height = Math.round(el.chrome.getBoundingClientRect().height);
  if (!height || height === lastChromeHeight) return;
  lastChromeHeight = height;
  // Панель функций начинается там же, где и контент сайта.
  document.documentElement.style.setProperty('--chrome-h', `${height}px`);
  // Панель поиска меняет высоту — main должен сдвинуть WebContentsView.
  api.setChromeHeight(height);
}

if ('ResizeObserver' in window) {
  new ResizeObserver(syncChromeHeight).observe(el.chrome);
}

// --- Отрисовка --------------------------------------------------------------

function prettyTitle(text) {
  const clean = (text || '')
    .replace(/\s*[|—–]\s*TikTok\s*$/i, '')
    .replace(/^TikTok\s*[-–—]\s*/i, '')
    .trim();
  if (!clean) return 'TikTok';
  return clean.length > 64 ? `${clean.slice(0, 63)}…` : clean;
}

function renderFind() {
  const find = state.find || { open: false, text: '', matches: 0, active: 0 };
  el.findbar.hidden = !find.open || state.pip;

  if (find.open) {
    if (!findWasOpen) {
      el.findInput.value = find.text || '';
      el.findInput.focus();
      el.findInput.select();
    }
    const text = el.findInput.value.trim();
    el.findCount.textContent =
      text === '' ? '' : find.matches > 0 ? `${find.active}/${find.matches}` : 'Нет совпадений';
    el.findCount.classList.toggle('is-empty', text !== '' && find.matches === 0);
  } else if (findWasOpen) {
    el.findInput.value = '';
    el.findInput.blur();
  }

  findWasOpen = Boolean(find.open);
}

function renderDownload() {
  const download = state.download;
  el.download.hidden = !download;
  document.body.classList.toggle('is-downloading', Boolean(download));
  if (!download) return;

  const percent = Math.max(0, Math.min(100, Number(download.percent) || 0));
  el.downloadFill.style.width = `${percent}%`;
  el.download.title = `${download.name} — ${percent}%`;
}

function renderUnread() {
  const count = Number(state.unread) || 0;
  el.unread.hidden = count <= 0;
  el.unread.textContent = count > 99 ? '99+' : String(count);
  el.unread.title = `Непрочитанных: ${count}`;
  el.pill.title = count > 0 ? `${count} непрочитанных` : '';
}

function setSwitch(row, value) {
  row.setAttribute('aria-checked', String(Boolean(value)));
}

function paintVolume(percent) {
  const value = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
  el.volumeRange.style.setProperty('--volume', `${value}%`);
  el.volumeValue.textContent = `${value} %`;
}

let cosmeticsSignature = '';
let regionSignature = '';
function renderCosmetics(list) {
  const items = Array.isArray(list) ? list : [];
  const signature = items.map((item) => item.id).join('|');

  if (signature !== cosmeticsSignature) {
    cosmeticsSignature = signature;
    el.panelCosmetics.replaceChildren();

    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'panel-row';
      row.dataset.cosmetic = item.id;
      row.setAttribute('role', 'switch');
      row.setAttribute('aria-checked', 'false');

      const label = document.createElement('span');
      label.className = 'panel-row-label';
      label.textContent = item.label;

      const toggle = document.createElement('span');
      toggle.className = 'switch';
      toggle.setAttribute('aria-hidden', 'true');

      row.append(label, toggle);
      el.panelCosmetics.append(row);
    }
  }

  for (const item of items) {
    const row = [...el.panelCosmetics.children].find((node) => node.dataset.cosmetic === item.id);
    if (row) row.setAttribute('aria-checked', String(Boolean(item.enabled)));
  }
}

let downloadsSignature = '';

function downloadStatus(entry) {
  switch (entry.state) {
    case 'progressing':
      return entry.totalBytes > 0 ? `${entry.percent} %` : '…';
    case 'completed':
      return 'готово';
    case 'cancelled':
      return 'отменено';
    default:
      return 'ошибка';
  }
}

function renderDownloads(list) {
  const downloads = Array.isArray(list) ? list : [];
  el.downloadsEmpty.hidden = downloads.length > 0;

  const signature = downloads
    .map((entry) => `${entry.id}:${entry.state}:${entry.percent}`)
    .join('|');
  if (signature === downloadsSignature) return;
  downloadsSignature = signature;

  el.panelDownloads.replaceChildren();

  for (const entry of downloads) {
    const row = document.createElement('div');
    row.className = 'download-row';

    const name = document.createElement('span');
    name.className = 'download-name';
    name.textContent = entry.name;
    name.title = entry.name;

    const meta = document.createElement('span');
    meta.className = 'download-meta';
    meta.textContent = downloadStatus(entry);

    row.append(name, meta);

    if (entry.state === 'progressing') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'download-action';
      cancel.dataset.downloadCancel = entry.id;
      cancel.title = 'Отменить';
      cancel.setAttribute('aria-label', `Отменить загрузку ${entry.name}`);
      cancel.innerHTML =
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>';
      row.append(cancel);
    } else if (entry.state === 'completed') {
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'download-action';
      show.dataset.downloadShow = entry.id;
      show.title = 'Показать в папке';
      show.setAttribute('aria-label', `Показать ${entry.name} в папке`);
      show.innerHTML =
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.2h14M4.4 5.2h4l1.2 1.4h6a1.4 1.4 0 0 1 1.4 1.4v6.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 14.6V6.6a1.4 1.4 0 0 1 1.4-1.4z"/></svg>';
      row.append(show);
    }

    el.panelDownloads.append(row);
  }
}

function normalizeSearch(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Раскрывает нужные категории и прячет всё, что не подходит под запрос.
 * При активном поиске категории раскрываются сами: пользователь ищет
 * функцию, а не место, где она лежит.
 */
function applyPanelFilter() {
  const query = normalizeSearch(el.panelSearch.value);
  panelQuery = query;
  el.panelSearchClear.hidden = !query;

  let visibleCategories = 0;

  for (const cat of el.panel.querySelectorAll('.panel-cat')) {
    const title = normalizeSearch(cat.querySelector('.panel-cat-title')?.textContent || '');
    const titleMatch = Boolean(query) && title.includes(query);
    const body = cat.querySelector('.panel-cat-body');
    let rowMatch = false;

    // Текст подсказок тоже участвует в поиске: например, «прокси» находится
    // по пояснению под полем, а не только по названию категории.
    const noteText = normalizeSearch(
      [...cat.querySelectorAll('.panel-note, .panel-empty')]
        .filter((hint) => !hint.hasAttribute('hidden'))
        .map((hint) => hint.textContent)
        .join(' '),
    );
    const noteMatch = Boolean(query) && noteText.includes(query);

    for (const row of cat.querySelectorAll('.panel-row, .download-row, .panel-field')) {
      const label = normalizeSearch(row.textContent);
      const hiddenRow = row.hasAttribute('hidden');
      const match = !query || titleMatch || noteMatch || (!hiddenRow && label.includes(query));
      row.classList.toggle('is-filtered', !match);
      if (match && !hiddenRow) rowMatch = true;
    }

    for (const hint of cat.querySelectorAll('.panel-note, .panel-empty')) {
      hint.classList.toggle('is-filtered', Boolean(query) && !titleMatch && !noteMatch);
    }

    const categoryMatch = !query || titleMatch || noteMatch || rowMatch;
    if (categoryMatch) visibleCategories += 1;
    cat.classList.toggle('is-filtered', !categoryMatch);

    const expanded = query ? categoryMatch : openCategories.has(cat.dataset.cat);
    body.hidden = !expanded;
    cat.dataset.open = String(expanded);
    cat.querySelector('[data-cat-head]')?.setAttribute('aria-expanded', String(expanded));
  }

  el.panelNoResults.hidden = !(query && visibleCategories === 0);
}

function toggleCategory(id) {
  // Во время поиска раскрытием управляет фильтр.
  if (!id || panelQuery) return;
  if (openCategories.has(id)) openCategories.delete(id);
  else openCategories.add(id);
  applyPanelFilter();
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderSleep() {
  const ends = Number(state.sleepTimerEnds) || 0;
  const active = ends > Date.now();
  el.sleepLabel.textContent = active
    ? `Таймер сна · ${formatRemaining(ends - Date.now())}`
    : 'Таймер сна';

  const minutes = active ? Number(state.sleepTimerMinutes) || 0 : 0;
  for (const button of el.panel.querySelectorAll('[data-sleep]')) {
    const value = Number(button.dataset.sleep);
    const selected = value !== 0 && value === minutes;
    button.classList.toggle('is-on', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

// --- Палитра команд ---------------------------------------------------------

let paletteWasOpen = false;
let paletteIndex = 0;
let paletteFiltered = [];

function paletteItems() {
  const items = [
    { label: 'Главная', cmd: 'home' },
    { label: 'Назад', cmd: 'back' },
    { label: 'Вперёд', cmd: 'forward' },
    { label: 'Обновить', cmd: 'reload', hint: 'Ctrl R' },
    { label: 'Обновить без кэша', cmd: 'hardReload', hint: 'Ctrl Shift R' },
    { label: 'Поиск по странице', cmd: 'find', hint: 'Ctrl F' },
    { label: 'Панель функций', cmd: 'panel', hint: 'Ctrl Shift B' },
    { label: 'Регион и прокси', cmd: 'regionPanel' },
    { label: 'Снимок кадра', cmd: 'screenshot', hint: 'Ctrl Shift S' },
    { label: 'Звук вкл/выкл', cmd: 'mute', hint: 'Ctrl Shift M' },
    { label: 'Картинка в картинке', cmd: 'pip', hint: 'Ctrl Shift P' },
    { label: 'Следующее видео', cmd: 'feedNext', hint: 'Ctrl Shift →' },
    { label: 'Предыдущее видео', cmd: 'feedPrev', hint: 'Ctrl Shift ←' },
    { label: 'Автолистание в PiP', cmd: 'pipAuto' },
    { label: 'Адаптивный PiP', cmd: 'pipAdaptive' },
    { label: 'Выйти из PiP', cmd: 'pipClose', hint: 'Esc' },
    { label: 'Поверх всех окон', cmd: 'onTop', hint: 'Ctrl Shift O' },
    { label: 'Полный экран', cmd: 'fullscreen', hint: 'F11' },
    { label: 'Инструменты разработчика', cmd: 'devtools', hint: 'Ctrl Shift I' },
    { label: 'Папка загрузок', cmd: 'openDownloads' },
    { label: 'Проверить обновления', cmd: 'checkUpdates' },
    { label: 'О программе', cmd: 'about' },
    { label: 'Подписки', cmd: 'openUrl', payload: 'https://www.tiktok.com/following' },
    { label: 'Интересное', cmd: 'openUrl', payload: 'https://www.tiktok.com/explore' },
    { label: 'Выход', cmd: 'quit' },
  ];

  for (const rule of state.cosmetics) {
    items.push({
      label: `${rule.enabled ? 'Отключить' : 'Включить'} «${rule.label}»`,
      cmd: 'cosmetic',
      payload: rule.id,
    });
  }

  for (const minutes of [15, 30, 60]) {
    items.push({ label: `Таймер сна: ${minutes} мин`, cmd: 'sleepTimer', payload: minutes });
  }
  items.push({ label: 'Таймер сна: выключить', cmd: 'sleepTimer', payload: 0 });

  for (const speed of [0.5, 1, 1.5, 2]) {
    items.push({ label: `Скорость ${speed}×`, cmd: 'playerSpeed', payload: speed });
  }

  items.push(
    { label: 'Запускать без звука', cmd: 'playerToggle', payload: 'startMuted' },
    { label: 'Повторять видео', cmd: 'playerToggle', payload: 'loop' },
    { label: 'Пауза в фоне', cmd: 'playerToggle', payload: 'pauseOnBlur' },
    {
      label: `${state.adsSkip ? 'Выключить' : 'Включить'} пропуск рекламы`,
      cmd: 'adsSkip',
    },
  );

  if (state.region && state.region.proxy) {
    items.push({ label: 'Сбросить прокси', cmd: 'regionProxyClear' });
  }

  items.push(
    { label: 'Проверить внешний IP', cmd: 'regionCheckIp' },
    { label: 'Сбросить данные сайта…', cmd: 'regionResetData' },
  );

  if (state.appimage && state.appimage.available) {
    items.push({
      label: state.appimage.installed
        ? 'Удалить из меню приложений'
        : 'Установить в меню приложений',
      cmd: 'appimageInstall',
    });
  }

  return items;
}

function renderPaletteList() {
  el.paletteList.replaceChildren();

  if (!paletteFiltered.length) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = 'Ничего не найдено';
    el.paletteList.append(empty);
    return;
  }

  paletteFiltered.forEach((item, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `palette-item${index === paletteIndex ? ' is-active' : ''}`;
    row.dataset.index = String(index);
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(index === paletteIndex));

    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(label);

    if (item.hint) {
      const kbd = document.createElement('kbd');
      kbd.textContent = item.hint;
      row.append(kbd);
    }

    el.paletteList.append(row);
  });

  const active = el.paletteList.children[paletteIndex];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}

function filterPalette() {
  const query = el.paletteInput.value.trim().toLowerCase();
  const all = paletteItems();
  paletteFiltered = query ? all.filter((item) => item.label.toLowerCase().includes(query)) : all;

  if (paletteIndex >= paletteFiltered.length) {
    paletteIndex = Math.max(0, paletteFiltered.length - 1);
  }
  renderPaletteList();
}

function movePalette(delta) {
  if (!paletteFiltered.length) return;
  paletteIndex = (paletteIndex + delta + paletteFiltered.length) % paletteFiltered.length;
  renderPaletteList();
}

function activatePalette(index) {
  const item = paletteFiltered[index];
  if (!item) return;
  api.cmd('palette');
  api.cmd(item.cmd, item.payload);
}

function renderPalette() {
  el.palette.hidden = !state.palette;

  if (state.palette && !paletteWasOpen) {
    el.paletteInput.value = '';
    paletteIndex = 0;
    filterPalette();
    el.paletteInput.focus();
  } else if (!state.palette && paletteWasOpen) {
    el.paletteInput.blur();
  }

  paletteWasOpen = Boolean(state.palette);
}

function renderPlayer() {
  const player = state.player || { speed: 1 };
  for (const button of el.panel.querySelectorAll('[data-player-speed]')) {
    const value = Number(button.dataset.playerSpeed);
    const active = Math.abs(value - Number(player.speed || 1)) < 0.001;
    button.classList.toggle('is-on', active);
    button.setAttribute('aria-pressed', String(active));
  }

  // Пока пользователь тянет ползунок, не перебиваем его значениями из main.
  if (document.activeElement !== el.volumeRange) {
    const volume = player.volume === undefined ? 1 : Number(player.volume);
    const percent = Math.round(Math.min(1, Math.max(0, volume || 0)) * 100);
    el.volumeRange.value = String(percent);
    paintVolume(percent);
  }

  setSwitch(el.rowStartMuted, player.startMuted);
  setSwitch(el.rowLoop, player.loop);
  setSwitch(el.rowPauseBlur, player.pauseOnBlur);
}

function renderRegion() {
  const region = state.region || { preset: 'off', proxy: '' };
  const regions = Array.isArray(state.regions) ? state.regions : [];
  const signature = `${regions.map((item) => `${item.id}:${item.label}`).join('|')}#${region.preset}`;

  if (signature !== regionSignature) {
    regionSignature = signature;
    el.regionSelect.replaceChildren(
      ...regions.map((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        option.selected = item.id === region.preset;
        return option;
      }),
    );
    el.regionSelect.value = region.preset;
  }

  // Не перебиваем ввод, пока пользователь печатает адрес прокси.
  if (document.activeElement !== el.regionProxy && el.regionProxy.value !== region.proxy) {
    el.regionProxy.value = region.proxy;
  }

  el.regionProxyState.textContent = region.proxy
    ? 'Прокси включён — сайт видит IP прокси.'
    : 'Прокси не задан — сайт видит ваш IP.';

  const check = state.regionCheck || { state: 'idle', text: 'Проверить' };
  const checkLabel =
    check.state === 'loading'
      ? 'Проверяю…'
      : check.state === 'done'
        ? 'Готово'
        : check.state === 'error'
          ? 'Ошибка'
          : 'Проверить';
  el.regionIpValue.textContent = checkLabel;
  el.regionIpValue.classList.toggle('is-error', check.state === 'error');
  el.regionIpValue.classList.toggle('is-loading', check.state === 'loading');

  const hasResult = check.state === 'done' || check.state === 'error';
  el.regionIpResult.hidden = !hasResult;
  el.regionIpResult.textContent = hasResult ? check.text : '';
  el.regionIpResult.classList.toggle('is-error', check.state === 'error');
}

function renderPanel() {
  el.panel.hidden = !state.panel;
  el.btnPanel.classList.toggle('is-on', Boolean(state.panel));
  el.btnPanel.setAttribute('aria-pressed', String(Boolean(state.panel)));

  const width = Number(state.panelWidth) || 300;
  document.documentElement.style.setProperty('--panel-w', `${width}px`);

  el.panelVersion.textContent = `v${state.version || '—'} · Electron ${api.ui.electron}`;
  el.panelZoom.textContent = `${state.zoom || 100} %`;

  setSwitch(el.rowMute, !state.muted);
  setSwitch(el.rowPip, state.pip);
  setSwitch(el.rowPipAuto, state.pipAuto);
  setSwitch(el.rowPipAdaptive, state.pipAdaptive);
  setSwitch(el.rowOnTop, state.onTop);
  setSwitch(el.rowTray, state.closeToTray);
  setSwitch(el.rowAutostart, state.autostart);
  setSwitch(el.rowStartTray, state.startInTray);
  setSwitch(el.rowAdSkip, state.adsSkip);

  const appimage = state.appimage || { available: false, installed: false };
  el.rowInstallApp.hidden = !appimage.available;
  el.installAppLabel.textContent = appimage.installed
    ? 'Удалить из меню приложений'
    : 'Установить в приложения';

  renderCosmetics(state.cosmetics);
  renderDownloads(state.downloads);
  renderSleep();
  renderPlayer();
  renderRegion();
  applyPanelFilter();
}

function render() {
  el.back.disabled = !state.canGoBack;
  el.forward.disabled = !state.canGoForward;

  el.pip.classList.toggle('is-on', Boolean(state.pip));
  el.pip.setAttribute('aria-pressed', String(Boolean(state.pip)));
  el.mute.classList.toggle('is-on', state.muted);
  el.mute.setAttribute('aria-pressed', String(state.muted));
  el.top.classList.toggle('is-on', state.onTop);
  el.top.setAttribute('aria-pressed', String(state.onTop));

  el.title.textContent = toastText || prettyTitle(state.title);

  el.pill.classList.toggle('is-loading', state.loading && !toastText);
  el.pill.classList.toggle('is-toast', Boolean(toastText));
  el.progress.classList.toggle('is-loading', state.loading);

  document.body.classList.toggle('is-muted', state.muted);
  document.body.classList.toggle('is-maximized', state.maximized);

  // Режим PiP: обычная полоса уступает место компактному мини-плееру.
  const pip = Boolean(state.pip);
  document.body.classList.toggle('is-pip', pip);
  el.titlebar.hidden = pip;
  el.pipbar.hidden = !pip;
  el.titlebar.classList.toggle('is-hidden', state.chromeHidden && !pip);
  el.pipTitle.textContent = toastText || prettyTitle(state.title);
  el.pipTitle.classList.toggle('is-toast', Boolean(toastText));
  el.pipPlay.classList.toggle('is-playing', Boolean(state.playing));
  el.pipPlay.title = state.playing ? 'Пауза' : 'Играть';
  el.pipPlay.setAttribute('aria-label', state.playing ? 'Пауза' : 'Играть');
  el.pipAuto.classList.toggle('is-on', Boolean(state.pipAuto));
  el.pipAuto.setAttribute('aria-pressed', String(Boolean(state.pipAuto)));
  el.pipAdaptive.classList.toggle('is-on', Boolean(state.pipAdaptive));
  el.pipAdaptive.setAttribute('aria-pressed', String(Boolean(state.pipAdaptive)));

  el.max.title = state.maximized ? 'Восстановить' : 'Развернуть';
  el.max.setAttribute('aria-label', state.maximized ? 'Восстановить' : 'Развернуть');

  renderUnread();
  renderFind();
  renderDownload();
  renderPanel();
  renderPalette();
}

function showToast(text) {
  toastText = text;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = '';
    render();
  }, 1900);
}

function apply(next) {
  const { toast, ...rest } = next;
  Object.assign(state, rest);
  if (toast) {
    showToast(toast.text);
    return;
  }
  render();
}

api.onState(apply);
api.ready();
render();
syncChromeHeight();

// Обратный отсчёт таймера сна: раз в секунду обновляем подпись, без IPC.
setInterval(() => {
  if (Number(state.sleepTimerEnds) > 0) renderSleep();
}, 1000);
