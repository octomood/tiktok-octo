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
};

const state = {
  title: 'TikTok',
  url: '',
  loading: false,
  muted: false,
  onTop: false,
  pip: false,
  maximized: false,
  canGoBack: false,
  canGoForward: false,
  chromeHidden: false,
  unread: 0,
  find: { open: false, text: '', matches: 0, active: 0 },
  download: null,
};

let toastText = '';
let toastTimer = null;
let findWasOpen = false;

if (api.ui.platform === 'darwin') document.body.classList.add('mac');

// --- Действия ---------------------------------------------------------------

const actions = [
  [el.back, 'back'],
  [el.forward, 'forward'],
  [el.reload, 'reload'],
  [el.home, 'home'],
  [el.pip, 'pip'],
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
  el.findbar.hidden = !find.open;

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
  el.titlebar.classList.toggle('is-hidden', state.chromeHidden);

  el.max.title = state.maximized ? 'Восстановить' : 'Развернуть';
  el.max.setAttribute('aria-label', state.maximized ? 'Восстановить' : 'Развернуть');

  renderUnread();
  renderFind();
  renderDownload();
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
