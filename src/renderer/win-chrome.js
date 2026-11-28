'use strict';

/**
 * Логика кнопок управления окном в безрамочных дочерних окнах.
 */
(() => {
  const api = window.octoWindow;
  if (!api) return;

  document.body.classList.add('octo-frameless');

  const sync = (state) => {
    const maximized = Boolean(state && state.maximized);
    document.body.classList.toggle('is-maximized', maximized);
    const maxBtn = document.querySelector('[data-win-act="maximize"]');
    if (maxBtn) {
      const label = maximized ? 'Восстановить' : 'Развернуть';
      maxBtn.title = label;
      maxBtn.setAttribute('aria-label', label);
    }
  };

  if (typeof api.state === 'function') sync(api.state());
  if (typeof api.onState === 'function') api.onState(sync);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-win-act]');
    if (!button) return;
    api.control(button.dataset.winAct);
  });

  const bar = document.querySelector('.octo-winbar');
  if (bar && bar.dataset.maximizable !== 'false') {
    bar.addEventListener('dblclick', (event) => {
      if (event.target.closest('button')) return;
      api.control('maximize');
    });
  }
})();
