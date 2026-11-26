'use strict';

/**
 * Кастомный выпадающий список в стиле Material Design 3 Expressive.
 *
 * Заменяет нативный системный popup элемента `<select>` на стилизованное меню
 * поверх документа. Исходный `<select>` остаётся в DOM (прозрачный поверх
 * подложки контейнера) ради доступности, автоматического обновления списка
 * опций и совместимости с `selectOption(...)` в тестах Playwright.
 */
(() => {
  const ENHANCED = new WeakSet();
  const RECORDS = new WeakMap();
  const MENU_ID = 'octoSelectMenu';
  const CHECK_SVG =
    '<svg class="octo-select-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 10.2 3.6 3.6 7.4-7.6"/></svg>';
  const CHEVRON_SVG =
    '<svg class="octo-select-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5.5 7.8 4.5 4.5 4.5-4.5"/></svg>';

  let activeRecord = null;
  let sharedMenu = null;
  let valuePatched = false;

  function selectedOptionOf(select) {
    const idx = select.selectedIndex;
    if (idx >= 0 && select.options[idx]) return select.options[idx];
    return select.options[0] || null;
  }

  function syncRecord(select) {
    const rec = RECORDS.get(select);
    if (!rec) return;
    const { wrap, trigger, valueEl } = rec;
    const opt = selectedOptionOf(select);
    valueEl.textContent = opt ? opt.textContent.trim() : '';
    trigger.disabled = Boolean(select.disabled);
    wrap.hidden = Boolean(select.hidden);
    wrap.classList.toggle('octo-select--wide', select.classList.contains('panel-select--wide'));
    if (activeRecord && activeRecord.select === select) {
      refreshMenuSelection();
    }
  }

  function patchSelectSetters() {
    if (valuePatched || !window.HTMLSelectElement) return;
    valuePatched = true;
    const proto = window.HTMLSelectElement.prototype;
    const valDesc = Object.getOwnPropertyDescriptor(proto, 'value');
    const idxDesc = Object.getOwnPropertyDescriptor(proto, 'selectedIndex');
    if (valDesc && valDesc.set && valDesc.get) {
      Object.defineProperty(proto, 'value', {
        configurable: true,
        enumerable: valDesc.enumerable,
        get() {
          return valDesc.get.call(this);
        },
        set(next) {
          valDesc.set.call(this, next);
          syncRecord(this);
        },
      });
    }
    if (idxDesc && idxDesc.set && idxDesc.get) {
      Object.defineProperty(proto, 'selectedIndex', {
        configurable: true,
        enumerable: idxDesc.enumerable,
        get() {
          return idxDesc.get.call(this);
        },
        set(next) {
          idxDesc.set.call(this, next);
          syncRecord(this);
        },
      });
    }
  }

  function ensureMenu() {
    if (sharedMenu && document.body.contains(sharedMenu)) return sharedMenu;
    sharedMenu = document.createElement('div');
    sharedMenu.id = MENU_ID;
    sharedMenu.className = 'octo-select-menu';
    sharedMenu.setAttribute('role', 'listbox');
    sharedMenu.hidden = true;
    document.body.append(sharedMenu);
    return sharedMenu;
  }

  function refreshMenuSelection() {
    if (!sharedMenu || !activeRecord) return;
    const current = activeRecord.select.value;
    for (const btn of sharedMenu.querySelectorAll('.octo-select-opt')) {
      const selected = btn.dataset.value === current;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-selected', String(selected));
    }
  }

  function closeMenu(restoreFocus = false) {
    if (!activeRecord) return;
    const prevTrigger = activeRecord.trigger;
    activeRecord.trigger.classList.remove('is-open');
    activeRecord.trigger.setAttribute('aria-expanded', 'false');
    activeRecord = null;
    if (sharedMenu) {
      sharedMenu.classList.remove('is-open');
      sharedMenu.hidden = true;
      sharedMenu.textContent = '';
    }
    if (restoreFocus && document.contains(prevTrigger)) {
      prevTrigger.focus({ preventScroll: true });
    }
  }

  function createOptionButton(select, option) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'octo-select-opt';
    btn.setAttribute('role', 'option');
    btn.dataset.value = option.value;
    btn.disabled = Boolean(option.disabled);
    const selected = Boolean(option.selected);
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-selected', String(selected));

    const label = document.createElement('span');
    label.className = 'octo-select-opt-label';
    label.textContent = option.textContent.trim();
    btn.append(label);
    btn.insertAdjacentHTML('beforeend', CHECK_SVG);

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      select.value = option.value;
      select.dispatchEvent(new window.Event('input', { bubbles: true }));
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      syncRecord(select);
      closeMenu(true);
    });
    return btn;
  }

  function positionMenu(trigger, menu) {
    const rect = trigger.getBoundingClientRect();
    const minW = Math.max(rect.width, 190);
    const maxW = Math.min(360, window.innerWidth - 16);
    const width = Math.min(Math.max(minW, rect.width), maxW);
    menu.style.width = `${Math.round(width)}px`;

    menu.hidden = false;
    const menuH = Math.min(menu.scrollHeight + 12, 320);
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openUp = spaceBelow < Math.min(menuH, 200) && spaceAbove > spaceBelow;

    const top = openUp
      ? Math.max(8, rect.top - Math.min(menuH, spaceAbove) - 6)
      : Math.min(window.innerHeight - Math.min(menuH, 160) - 8, rect.bottom + 6);

    const alignRight =
      rect.left + width > window.innerWidth - 8 || rect.left > window.innerWidth / 2;
    const left = alignRight
      ? Math.max(8, rect.right - width)
      : Math.min(window.innerWidth - width - 8, rect.left);

    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.maxHeight = `${Math.max(140, Math.min(320, (openUp ? spaceAbove : spaceBelow) - 6))}px`;
    menu.classList.toggle('is-up', openUp);
    menu.classList.add('is-open');
  }

  function openMenu(rec) {
    const { select, trigger } = rec;
    if (select.disabled || !select.options.length) return;
    if (activeRecord === rec) {
      closeMenu(false);
      return;
    }
    closeMenu(false);

    const menu = ensureMenu();
    menu.textContent = '';

    for (const child of select.children) {
      if (child.tagName === 'OPTGROUP') {
        const groupLabel = document.createElement('div');
        groupLabel.className = 'octo-select-group';
        groupLabel.textContent = child.label || '';
        menu.append(groupLabel);
        for (const opt of child.children) {
          if (opt.tagName === 'OPTION') menu.append(createOptionButton(select, opt));
        }
      } else if (child.tagName === 'OPTION') {
        menu.append(createOptionButton(select, child));
      }
    }

    activeRecord = rec;
    rec.scrollParent = select.closest(
      '.settings-content, .welcome-card, .plugins-main, .panel-dialog',
    );
    rec.openedScrollTop = rec.scrollParent ? rec.scrollParent.scrollTop : 0;
    rec.openedAt = Date.now();
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    positionMenu(trigger, menu);

    const selectedBtn =
      menu.querySelector('.octo-select-opt.is-selected') ||
      menu.querySelector('.octo-select-opt:not(:disabled)');
    if (selectedBtn) {
      const top = selectedBtn.offsetTop;
      const bottom = top + selectedBtn.offsetHeight;
      if (top < menu.scrollTop || bottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = Math.max(
          0,
          top - Math.round((menu.clientHeight - selectedBtn.offsetHeight) / 2),
        );
      }
    }
  }

  function moveFocusInMenu(menu, delta) {
    const items = Array.from(menu.querySelectorAll('.octo-select-opt:not(:disabled)'));
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    const next = idx < 0 ? 0 : (idx + delta + items.length) % items.length;
    items[next].focus();
    items[next].scrollIntoView({ block: 'nearest' });
  }

  function deriveAccessibleName(select) {
    const explicit = select.getAttribute('aria-label');
    if (explicit) return explicit;
    if (select.id) {
      const label = document.querySelector(`label[for="${select.id}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }
    const rowLabel = select
      .closest('.panel-row, .setting-control')
      ?.querySelector('.panel-row-label, label');
    return rowLabel ? rowLabel.textContent.trim() : '';
  }

  function enhanceSelect(select) {
    if (!select || ENHANCED.has(select) || select.closest('.octo-select')) return;
    ENHANCED.add(select);

    const wrap = document.createElement('div');
    wrap.className = 'octo-select';
    if (select.classList.contains('panel-select--wide')) wrap.classList.add('octo-select--wide');
    if (select.closest('.setting-control')) wrap.classList.add('octo-select--compact');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'octo-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const a11yName = deriveAccessibleName(select);
    if (a11yName) trigger.setAttribute('aria-label', a11yName);
    if (select.id) trigger.dataset.for = select.id;

    const valueEl = document.createElement('span');
    valueEl.className = 'octo-select-value';
    trigger.append(valueEl);
    trigger.insertAdjacentHTML('beforeend', CHEVRON_SVG);

    select.parentNode.insertBefore(wrap, select);
    wrap.append(trigger, select);
    select.classList.add('octo-select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const rec = { wrap, select, trigger, valueEl };
    RECORDS.set(select, rec);
    syncRecord(select);

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      openMenu(rec);
    });

    trigger.addEventListener('keydown', (event) => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        openMenu(rec);
      }
    });

    select.addEventListener('change', () => syncRecord(select));
    select.addEventListener('input', () => syncRecord(select));

    const optObserver = new MutationObserver(() => syncRecord(select));
    optObserver.observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'selected', 'label', 'aria-label'],
    });
  }

  function scanSelects(root = document) {
    patchSelectSetters();
    for (const select of root.querySelectorAll('select.panel-select, .setting-control select')) {
      enhanceSelect(select);
    }
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!activeRecord) return;
      const target = event.target;
      if (sharedMenu && sharedMenu.contains(target)) return;
      if (activeRecord.trigger.contains(target)) return;
      closeMenu(false);
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (!activeRecord || !sharedMenu) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocusInMenu(sharedMenu, 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocusInMenu(sharedMenu, -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        const first = sharedMenu.querySelector('.octo-select-opt:not(:disabled)');
        if (first) first.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        const items = sharedMenu.querySelectorAll('.octo-select-opt:not(:disabled)');
        if (items.length) items[items.length - 1].focus();
      } else if (event.key === 'Tab') {
        closeMenu(false);
      }
    },
    true,
  );

  document.addEventListener(
    'scroll',
    (event) => {
      if (!activeRecord) return;
      if (sharedMenu && (event.target === sharedMenu || sharedMenu.contains(event.target))) return;
      if (
        activeRecord.scrollParent &&
        event.target === activeRecord.scrollParent &&
        Date.now() - activeRecord.openedAt > 120 &&
        Math.abs(event.target.scrollTop - activeRecord.openedScrollTop) >= 12
      ) {
        closeMenu(false);
      }
    },
    true,
  );

  window.addEventListener('resize', () => closeMenu(false));

  if (document.body) {
    const domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('select.panel-select, .setting-control select')) {
            enhanceSelect(node);
          } else if (node.querySelectorAll) {
            scanSelects(node);
          }
        }
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    scanSelects(document);
  } else {
    document.addEventListener('DOMContentLoaded', () => scanSelects(document));
  }

  window.octoEnhanceSelects = scanSelects;
})();
