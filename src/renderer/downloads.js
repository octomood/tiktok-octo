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

function buildActions(entry) {
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
    if (/\.(mp4|mov|webm|mkv)$/i.test(entry.name || '')) {
      actions.append(actionButton('Аудио', 'extractAudio', entry.id));
    }
    actions.append(actionButton('Показать в папке', 'show', entry.id));
  }
  return actions;
}

function updateRow(row, entry) {
  row.dataset.state = entry.state || '';
  const name = row.querySelector('.manager-name');
  if (name) {
    name.textContent = entry.name;
    name.title = entry.name;
  }
  const status = row.querySelector('.manager-status');
  if (status) status.textContent = statusOf(entry);

  const percent = entry.state === 'completed' ? 100 : Number(entry.percent) || 0;
  const clamped = Math.max(0, Math.min(100, percent));
  const bar = row.querySelector('.manager-bar');
  const fill = bar?.querySelector('span');
  if (fill) fill.style.width = `${clamped}%`;
  window.octoProgress?.attachLinear(bar, {
    mode:
      entry.state === 'progressing' && !(entry.totalBytes > 0) ? 'indeterminate' : 'determinate',
    value: clamped / 100,
    active: entry.state === 'progressing',
    strokeWidth: 3.4,
    amplitude: 2.3,
    wavelength: 24,
  });

  const actionSig = `${entry.state}:${/\.(mp4|mov|webm|mkv)$/i.test(entry.name || '')}`;
  if (row.dataset.actionSig !== actionSig) {
    row.dataset.actionSig = actionSig;
    const oldActions = row.querySelector('.manager-row-actions');
    const nextActions = buildActions(entry);
    if (oldActions) oldActions.replaceWith(nextActions);
    else row.append(nextActions);
  }
}

function rowFor(entry) {
  const row = document.createElement('article');
  row.className = 'manager-row';
  row.dataset.id = entry.id;

  const head = document.createElement('div');
  head.className = 'manager-row-head';

  const name = document.createElement('span');
  name.className = 'manager-name';

  const status = document.createElement('span');
  status.className = 'manager-status';

  head.append(name, status);

  const bar = document.createElement('div');
  bar.className = 'manager-bar';
  const fill = document.createElement('span');
  bar.append(fill);

  row.append(head, bar);
  updateRow(row, entry);
  return row;
}

function render() {
  const list = $('managerList');
  $('managerEmpty').hidden = downloads.length > 0;
  const existing = new Map();
  for (const node of list.children) {
    if (node.dataset?.id) existing.set(node.dataset.id, node);
  }
  const nextNodes = [];
  for (const entry of downloads) {
    const reused = existing.get(entry.id);
    if (reused) {
      updateRow(reused, entry);
      nextNodes.push(reused);
    } else {
      nextNodes.push(rowFor(entry));
    }
  }
  list.replaceChildren(...nextNodes);
}

$('btnOpenFolder').addEventListener('click', () => api.openFolder());
$('btnClear').addEventListener('click', () => api.clear());
$('btnClose').addEventListener('click', () => api.close());

api.onState((next) => {
  downloads = Array.isArray(next) ? next : [];
  render();
});

render();
