'use strict';

/**
 * Отрисовка и клавиатурная навигация кастомного MD3-контекстного меню.
 */
(() => {
  const api = window.octoContextMenu;
  const listEl = document.getElementById('ctxMenu');
  if (!api || !listEl) return;

  let currentToken = '';
  let buttons = [];
  let activeIndex = -1;

  function setActive(index) {
    activeIndex = index;
    buttons.forEach((btn, idx) => {
      btn.classList.toggle('is-active', idx === activeIndex);
    });
    if (activeIndex >= 0 && buttons[activeIndex]) {
      buttons[activeIndex].focus({ preventScroll: true });
    }
  }

  function step(delta) {
    const enabled = buttons.map((b, i) => (!b.disabled ? i : -1)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const pos = enabled.indexOf(activeIndex);
    const nextPos =
      pos < 0
        ? delta > 0
          ? 0
          : enabled.length - 1
        : (pos + delta + enabled.length) % enabled.length;
    setActive(enabled[nextPos]);
  }

  function render(payload) {
    currentToken = payload.token || '';
    listEl.replaceChildren();
    buttons = [];
    activeIndex = -1;

    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const item of items) {
      if (!item) continue;
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        sep.setAttribute('role', 'separator');
        listEl.append(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctx-item';
      btn.setAttribute('role', 'menuitem');
      if (item.enabled === false) btn.disabled = true;

      const label = document.createElement('span');
      label.className = 'ctx-item-label';
      label.textContent = item.label || '';
      btn.append(label);

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        api.pick({ token: currentToken, id: item.id });
      });
      btn.addEventListener('pointerenter', () => {
        if (!btn.disabled) setActive(buttons.indexOf(btn));
      });

      buttons.push(btn);
      listEl.append(btn);
    }

    const rect = listEl.getBoundingClientRect();
    const width = Math.ceil(rect.width) + 12;
    const height = Math.ceil(rect.height) + 12;
    api.sendSize({ token: currentToken, width, height });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      api.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && buttons[activeIndex]) {
      event.preventDefault();
      if (!buttons[activeIndex].disabled) buttons[activeIndex].click();
    }
  });

  api.onOpen((payload) => {
    if (payload && typeof payload === 'object') render(payload);
  });
  api.ready();
})();
