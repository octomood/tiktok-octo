'use strict';

/**
 * Окно обновления: показывает предложение, прогресс загрузки и предложение
 * перезапуститься. Текст состояния всегда русский — общий i18n-dom.js
 * переводит его так же, как остальной интерфейс.
 */

const api = window.octoUpdate;
const $ = (id) => document.getElementById(id);

let state = { phase: 'available', version: '', percent: 0 };
let lastPhase = '';

const PHASES = {
  available: {
    message: (version) => `Доступна версия ${version}`,
    hint: 'Скачать обновление сейчас? Загрузка пойдёт в фоне.',
    action: 'Обновить',
    later: 'Позже',
    progress: false,
  },
  downloading: {
    message: () => 'Загрузка обновления…',
    hint: 'Загрузка идёт в фоне, окно можно закрыть.',
    action: '',
    later: 'Скрыть',
    progress: true,
  },
  ready: {
    message: () => 'Обновление готово',
    hint: 'Перезапустить приложение сейчас?',
    action: 'Перезапустить',
    later: 'Позже',
    progress: true,
  },
  error: {
    message: () => 'Не удалось скачать обновление',
    hint: 'Проверьте соединение и попробуйте ещё раз.',
    action: 'Повторить',
    later: 'Закрыть',
    progress: false,
  },
};

function render() {
  const phase = PHASES[state.phase] || PHASES.available;
  const percent = state.phase === 'ready' ? 100 : Math.round(Number(state.percent) || 0);

  $('updateMessage').textContent = phase.message(state.version);
  $('updateHint').textContent = phase.hint;

  const action = $('btnAction');
  action.hidden = !phase.action;
  if (phase.action) action.textContent = phase.action;

  $('btnLater').textContent = phase.later;

  $('updateProgress').hidden = !phase.progress;
  if (phase.progress) {
    $('updateFill').style.width = `${percent}%`;
    $('updateBar').setAttribute('aria-valuenow', String(percent));
    $('updatePercent').textContent = `${percent} %`;
  }

  // Фокус ставим один раз на состояние, чтобы прогресс не перебивал кнопку.
  if (state.phase !== lastPhase) {
    lastPhase = state.phase;
    if (phase.action) action.focus({ preventScroll: true });
    else $('btnLater').focus({ preventScroll: true });
  }
}

function act() {
  if (state.phase === 'ready') api.restart();
  else api.install();
}

$('btnAction').addEventListener('click', act);
$('btnLater').addEventListener('click', () => api.close());
$('btnClose').addEventListener('click', () => api.close());

api.onState((next) => {
  state = { ...state, ...next };
  render();
});

render();
