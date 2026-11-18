'use strict';

/**
 * Отдельное окно «Менеджер загрузок».
 *
 * Список приходит из main, действия уходят обратно через preload. Никакого
 * доступа к Node и сайту: окно умеет только показывать и управлять загрузками.
 */

const api = window.octoManager;
const $ = (id) => document.getElementById(id);

let downloads = [];

function statusOf(entry) {
  switch (entry.state) {
    case 'progressing':
      return entry.totalBytes > 0 ? `${entry.percent} %` : '…';
    case 'queued':
      return 'В очереди';
    case 'paused':
      return 'Пауза';
    case 'completed':
      return 'готово';
    case 'cancelled':
      return 'отменено';
    default:
      return 'ошибка';
  }
}

function actionButton(label, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'manager-btn manager-btn--small';
  button.textContent = label;
  button.addEventListener('click', () => api[action](id));
  return button;
}

function rowFor(entry) {
  const row = document.createElement('article');
  row.className = 'manager-row';
  row.dataset.id = entry.id;

  const head = document.createElement('div');
  head.className = 'manager-row-head';

  const name = document.createElement('span');
  name.className = 'manager-name';
  name.textContent = entry.name;
  name.title = entry.name;

  const status = document.createElement('span');
  status.className = 'manager-status';
  status.textContent = statusOf(entry);

  head.append(name, status);

  const bar = document.createElement('div');
  bar.className = 'manager-bar';
  const fill = document.createElement('span');
  const percent = entry.state === 'completed' ? 100 : Number(entry.percent) || 0;
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  bar.append(fill);

  const actions = document.createElement('div');
  actions.className = 'manager-row-actions';

  if (entry.state === 'progressing') actions.append(actionButton('Пауза', 'pause', entry.id));
  if (entry.state === 'paused' || entry.state === 'queued') {
    actions.append(actionButton('Продолжить', 'resume', entry.id));
  }
  if (entry.state === 'progressing' || entry.state === 'paused' || entry.state === 'queued') {
    actions.append(actionButton('Отменить', 'cancel', entry.id));
  }
  if (entry.state === 'completed') {
    actions.append(actionButton('Показать в папке', 'show', entry.id));
  }

  row.append(head, bar, actions);
  return row;
}

function render() {
  $('managerEmpty').hidden = downloads.length > 0;
  $('managerList').replaceChildren(...downloads.map(rowFor));
}

$('btnOpenFolder').addEventListener('click', () => api.openFolder());
$('btnClear').addEventListener('click', () => api.clear());
$('btnClose').addEventListener('click', () => api.close());

api.onState((next) => {
  downloads = Array.isArray(next) ? next : [];
  render();
});

render();
