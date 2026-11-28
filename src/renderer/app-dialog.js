'use strict';

/**
 * Общий контроллер системных диалогов в MD3 Expressive.
 * Работает как в оверлее главного окна (index.html), так и в отдельном
 * безрамочном окне (dialog.html).
 */
(() => {
  const api = window.octo;
  const root = document.getElementById('appDialog');
  if (!root || !api || typeof api.onAppDialog !== 'function') return;

  const backdrop = document.getElementById('appDialogBackdrop');
  const card = root.querySelector('.app-dialog-card');
  const badgeEl = document.getElementById('appDialogBadge');
  const eyebrowEl = document.getElementById('appDialogEyebrow');
  const titleEl = document.getElementById('appDialogTitle');
  const closeBtn = document.getElementById('appDialogClose');
  const bodyEl = document.getElementById('appDialogBody');
  const actionsEl = document.getElementById('appDialogActions');

  let current = null;
  let lastFocused = null;

  const ICONS = {
    info: '<circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />',
    question:
      '<circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.6-2.5 2-2.5 3.5M12 17h.01" />',
    warning:
      '<path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 16.5h.01" />',
    error: '<circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" />',
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function renderBadge(payload) {
    badgeEl.replaceChildren();
    if (payload.brandIcon) {
      badgeEl.dataset.tone = 'brand';
      const img = document.createElement('img');
      img.src = 'assets/octo-logo-mark.png';
      img.alt = '';
      img.draggable = false;
      badgeEl.append(img);
      return;
    }
    const tone = ['info', 'question', 'warning', 'error'].includes(payload.type)
      ? payload.type
      : 'info';
    badgeEl.dataset.tone = tone;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[tone];
    badgeEl.append(svg);
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} Б`;
    return `${(value / 1024).toFixed(1)} КБ`;
  }

  function svgIcon(paths, size = 14) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths;
    return svg;
  }

  function renderCodeSection(rich) {
    if (!Array.isArray(rich.files) || !rich.files.length) return;
    const tr = (text) => (window.octoI18n ? window.octoI18n.translate(text) : text);

    const wrap = el('section', 'app-dialog-code');
    const head = el('div', 'app-dialog-code-head');
    const labelWrap = el('div', 'app-dialog-code-label');
    labelWrap.append(el('h3', 'app-dialog-section-title', rich.filesTitle || 'Код плагина'));
    labelWrap.append(el('span', 'app-dialog-code-count', String(rich.files.length)));

    const toggleBtn = el('button', 'app-dialog-code-toggle', tr('Показать код'));
    toggleBtn.type = 'button';
    toggleBtn.id = 'appDialogCodeToggle';
    toggleBtn.setAttribute('aria-expanded', 'false');
    head.append(labelWrap, toggleBtn);

    const body = el('div', 'app-dialog-code-body');
    body.id = 'appDialogCodeBody';
    body.hidden = true;

    const tabs = el('div', 'app-dialog-code-tabs');
    tabs.setAttribute('role', 'tablist');
    const meta = el('div', 'app-dialog-code-meta');
    const metaInfo = el('span', '', '');
    const copyBtn = el('button', 'app-dialog-code-copy', tr('Копировать'));
    copyBtn.type = 'button';
    meta.append(metaInfo, copyBtn);

    const pre = el('pre', 'app-dialog-code-view');
    const code = el('code', '', '');
    pre.append(code);

    let activeFile = 0;
    const tabButtons = [];

    const selectFile = (index) => {
      activeFile = index;
      const file = rich.files[activeFile];
      if (!file) return;
      tabButtons.forEach((btn, idx) => {
        const active = idx === activeFile;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
      });
      const truncNote = file.truncated ? ` · ${tr('Файл обрезан для предпросмотра')}` : '';
      metaInfo.textContent = `${file.path} · ${formatBytes(file.size)}${truncNote}`;
      code.textContent = file.content || '';
      pre.scrollTop = 0;
      pre.scrollLeft = 0;
    };

    copyBtn.addEventListener('click', () => {
      const file = rich.files[activeFile];
      const clip = window.navigator && window.navigator.clipboard;
      if (!file || !clip || typeof clip.writeText !== 'function') return;
      clip
        .writeText(file.content || '')
        .then(() => {
          copyBtn.textContent = tr('ОК');
          setTimeout(() => {
            copyBtn.textContent = tr('Копировать');
          }, 1200);
        })
        .catch(() => {});
    });

    rich.files.forEach((file, index) => {
      const tab = el('button', 'app-dialog-code-tab', file.path);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => selectFile(index));
      tabButtons.push(tab);
      tabs.append(tab);
    });

    selectFile(0);
    body.append(tabs, meta, pre);

    toggleBtn.addEventListener('click', () => {
      const open = body.hidden;
      body.hidden = !open;
      card.classList.toggle('is-code-open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
      toggleBtn.textContent = tr(open ? 'Скрыть код' : 'Показать код');
    });

    wrap.append(head, body);
    bodyEl.append(wrap);
  }

  function renderRich(rich) {
    if (rich.summary) {
      const box = el('div', 'app-dialog-summary');
      const iconWrap = el('div', 'app-dialog-summary-icon');
      if (typeof rich.summary.icon === 'string' && rich.summary.icon.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.src = rich.summary.icon;
        img.alt = '';
        img.draggable = false;
        iconWrap.append(img);
      } else {
        iconWrap.append(
          svgIcon(
            '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1" /><circle cx="12" cy="12" r="3.2" />',
            22,
          ),
        );
      }

      const copy = el('div', 'app-dialog-summary-copy');
      const head = el('div', 'app-dialog-summary-head');
      head.append(el('span', 'app-dialog-summary-name', rich.summary.title || ''));
      if (rich.summary.version) {
        head.append(el('span', 'app-dialog-summary-ver', `v${rich.summary.version}`));
      }
      if (rich.summary.subtitle) {
        head.append(el('span', 'app-dialog-summary-author', rich.summary.subtitle));
      }
      copy.append(head);
      if (rich.summary.description) {
        copy.append(el('p', 'app-dialog-summary-desc', rich.summary.description));
      }
      box.append(iconWrap, copy);
      bodyEl.append(box);
    }

    if (Array.isArray(rich.badges) && rich.badges.length) {
      const meta = el('div', 'app-dialog-meta');
      for (const item of rich.badges) {
        if (!item) continue;
        const text = item.label ? `${item.label}: ${item.value}` : String(item.value || '');
        const pill = el('span', 'app-dialog-pill');
        if (item.tone) pill.dataset.tone = item.tone;
        const iconPath =
          item.tone === 'ok'
            ? '<path d="m5 12 4.5 4.5L19 7" />'
            : item.tone === 'warn' || item.tone === 'error'
              ? '<path d="M12 8v5M12 16.5h.01" /><circle cx="12" cy="12" r="9" />'
              : '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" />';
        pill.append(svgIcon(iconPath, 13), document.createTextNode(text));
        meta.append(pill);
      }
      bodyEl.append(meta);
    }

    if (Array.isArray(rich.permissions) && rich.permissions.length) {
      const section = el('section', 'app-dialog-section');
      section.append(el('h3', 'app-dialog-section-title', rich.permissionsTitle || 'Доступ'));
      const list = el('div', 'app-dialog-perms');
      for (const perm of rich.permissions) {
        const row = el('div', 'app-dialog-perm');
        if (perm.risk) row.dataset.risk = perm.risk;
        const head = el('div', 'app-dialog-perm-head');
        head.append(el('span', 'app-dialog-perm-name', perm.label || ''));
        if (perm.riskLabel) {
          const risk = el('span', 'app-dialog-risk', perm.riskLabel);
          if (perm.risk) risk.dataset.risk = perm.risk;
          head.append(risk);
        }
        row.append(head);
        if (perm.description) {
          row.append(el('p', 'app-dialog-perm-desc', perm.description));
        }
        list.append(row);
      }
      section.append(list);
      bodyEl.append(section);
    }

    if (Array.isArray(rich.hosts) && rich.hosts.length) {
      const section = el('section', 'app-dialog-section');
      section.append(el('h3', 'app-dialog-section-title', rich.hostsTitle || 'Сетевые хосты'));
      const chips = el('div', 'app-dialog-chips');
      for (const host of rich.hosts) {
        chips.append(el('span', 'app-dialog-chip', host));
      }
      section.append(chips);
      bodyEl.append(section);
    }

    if (Array.isArray(rich.sections)) {
      for (const sec of rich.sections) {
        if (!sec || !Array.isArray(sec.items) || !sec.items.length) continue;
        const section = el('section', 'app-dialog-section');
        if (sec.title) section.append(el('h3', 'app-dialog-section-title', sec.title));
        const chips = el('div', 'app-dialog-chips');
        for (const item of sec.items) {
          chips.append(el('span', 'app-dialog-chip', item));
        }
        section.append(chips);
        bodyEl.append(section);
      }
    }

    if (Array.isArray(rich.notices) && rich.notices.length) {
      const callout = el('div', 'app-dialog-callout');
      for (const line of rich.notices) {
        if (line) callout.append(el('p', '', line));
      }
      if (callout.childElementCount) bodyEl.append(callout);
    }

    renderCodeSection(rich);
  }

  function finish(responseIndex) {
    if (!current) return;
    const token = current.token;
    current = null;
    if (!document.body.classList.contains('dialog-standalone')) {
      root.hidden = true;
      card.classList.remove('is-code-open');
      bodyEl.replaceChildren();
      actionsEl.replaceChildren();
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try {
          lastFocused.focus();
        } catch {
          /* элемент уже скрыт */
        }
      }
      lastFocused = null;
    }
    api.replyAppDialog({ token, response: responseIndex });
  }

  function cancel() {
    if (!current) return;
    const cancelIndex =
      Number.isInteger(current.cancelId) && current.cancelId >= 0 ? current.cancelId : 0;
    finish(cancelIndex);
  }

  function openDialog(payload) {
    if (!document.body.classList.contains('dialog-standalone')) {
      lastFocused = document.activeElement;
    }
    current = payload;
    const isRich = Boolean(payload.rich);
    card.classList.toggle('is-rich', isRich);
    card.classList.remove('is-code-open');

    renderBadge(payload);

    const hasTitle = Boolean(payload.title);
    const hasMessage = Boolean(payload.message);
    if (hasTitle && hasMessage) {
      eyebrowEl.textContent = payload.title;
      eyebrowEl.hidden = false;
      titleEl.textContent = payload.message;
    } else {
      eyebrowEl.textContent = '';
      eyebrowEl.hidden = true;
      titleEl.textContent = payload.message || payload.title || '';
    }

    bodyEl.replaceChildren();
    if (payload.rich) {
      renderRich(payload.rich);
    } else if (payload.detail) {
      const detail = el(
        'p',
        `app-dialog-detail${payload.detail.length > 220 ? ' app-dialog-detail--box' : ''}`,
        payload.detail,
      );
      bodyEl.append(detail);
    }

    const buttons =
      Array.isArray(payload.buttons) && payload.buttons.length ? payload.buttons : ['ОК'];
    const cancelId = Number.isInteger(payload.cancelId) ? payload.cancelId : -1;
    const defaultId = Number.isInteger(payload.defaultId) ? payload.defaultId : 0;

    actionsEl.replaceChildren();
    const renderedButtons = buttons.map((label, index) => {
      const btn = el('button', 'app-dialog-btn', label);
      btn.type = 'button';
      btn.dataset.index = String(index);
      const isCancel = index === cancelId;
      const isSingle = buttons.length === 1;
      if (isCancel && !isSingle) {
        btn.classList.add('app-dialog-btn--tonal');
      } else if (!isCancel && payload.destructive && !isSingle) {
        btn.classList.add('app-dialog-btn--danger');
      } else if (!isCancel || isSingle) {
        btn.classList.add('app-dialog-btn--primary');
      }
      btn.addEventListener('click', () => finish(index));
      actionsEl.append(btn);
      return btn;
    });

    root.hidden = false;
    const focusTarget = renderedButtons[defaultId] || renderedButtons[0] || closeBtn;
    focusTarget?.focus({ preventScroll: true });
  }

  api.onAppDialog((payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.action === 'close') {
      current = null;
      if (!document.body.classList.contains('dialog-standalone')) {
        root.hidden = true;
        bodyEl.replaceChildren();
        actionsEl.replaceChildren();
      }
      return;
    }
    if (payload.action === 'open') {
      openDialog(payload);
    }
  });

  if (backdrop) backdrop.addEventListener('click', cancel);
  if (closeBtn) closeBtn.addEventListener('click', cancel);

  document.addEventListener('keydown', (event) => {
    if (!current) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = [
        ...card.querySelectorAll(
          'button:not([hidden]):not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  if (typeof api.appDialogReady === 'function') {
    api.appDialogReady();
  }
})();
