'use strict';

/**
 * Покомпонентная кастомизация собственного интерфейса и редактор компонентов.
 * Работает в песочнице renderer через window.octo, без Node и inline <style>.
 */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const tr = (text) => (window.octoI18n ? window.octoI18n.translate(text) : text);

  const ICON_PRESETS = [
    {
      id: 'home',
      label: 'Дом',
      paths: [
        ['path', 'M3 10.5 12 3l9 7.5'],
        ['path', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5'],
      ],
    },
    { id: 'arrow-left', label: 'Назад', paths: [['path', 'm15 18-6-6 6-6']] },
    { id: 'arrow-right', label: 'Вперёд', paths: [['path', 'm9 18 6-6-6-6']] },
    {
      id: 'refresh',
      label: 'Обновить',
      paths: [
        ['path', 'M21 12a9 9 0 1 1-2.64-6.36'],
        ['path', 'M21 3v6h-6'],
      ],
    },
    {
      id: 'star',
      label: 'Звезда',
      paths: [
        ['path', 'm12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z'],
      ],
    },
    {
      id: 'heart',
      label: 'Сердце',
      paths: [
        [
          'path',
          'M12 20.5s-7.5-4.8-9.2-9.4C1.6 7.8 3.9 4.5 7.3 4.5c1.9 0 3.6 1 4.7 2.5 1.1-1.5 2.8-2.5 4.7-2.5 3.4 0 5.7 3.3 4.5 6.6-1.7 4.6-9.2 9.4-9.2 9.4z',
        ],
      ],
    },
    {
      id: 'sparkle',
      label: 'Искра',
      paths: [['path', 'm12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z']],
    },
    { id: 'bolt', label: 'Молния', paths: [['path', 'M13 2 4 14h7l-1 8 10-12h-7z']] },
    {
      id: 'flame',
      label: 'Огонь',
      paths: [
        [
          'path',
          'M12 2c.5 3.5 3.5 5 3.5 9a4.5 4.5 0 0 1-9 0c0-2.1 1.1-4 2.5-5.3 0 1.8 1.2 2.8 2.2 2.8.8-2 0-4.4.8-6.5z',
        ],
      ],
    },
    {
      id: 'crown',
      label: 'Корона',
      paths: [
        ['path', 'm3 18 1.5-10 4.5 4 3-6 3 6 4.5-4L21 18z'],
        ['path', 'M4 20h16'],
      ],
    },
    {
      id: 'music',
      label: 'Музыка',
      paths: [
        ['path', 'M9 18V5l11-2v13'],
        ['circle', { cx: 6, cy: 18, r: 3 }],
        ['circle', { cx: 17, cy: 16, r: 3 }],
      ],
    },
    {
      id: 'video',
      label: 'Видео',
      paths: [
        ['rect', { x: 2.5, y: 5.5, width: 14, height: 13, rx: 2.5 }],
        ['path', 'm16.5 10 5-3v10l-5-3z'],
      ],
    },
    {
      id: 'camera',
      label: 'Камера',
      paths: [
        [
          'path',
          'M4 7h3l2-2.5h6L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
        ],
        ['circle', { cx: 12, cy: 13, r: 3.5 }],
      ],
    },
    {
      id: 'message',
      label: 'Чат',
      paths: [['path', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']],
    },
    {
      id: 'bell',
      label: 'Колокол',
      paths: [
        ['path', 'M6 8a6 6 0 0 1 12 0c0 7 3 8.5 3 8.5H3s3-1.5 3-8.5'],
        ['path', 'M10.3 20a1.9 1.9 0 0 0 3.4 0'],
      ],
    },
    {
      id: 'settings',
      label: 'Шестерёнка',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 3 }],
        [
          'path',
          'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
        ],
      ],
    },
    {
      id: 'sliders',
      label: 'Слайдеры',
      paths: [['path', 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6']],
    },
    {
      id: 'palette',
      label: 'Палитра',
      paths: [
        [
          'path',
          'M12 22a10 10 0 1 1 10-10c0 2.5-1.5 3.5-3.5 3.5h-1.8a1.5 1.5 0 0 0-1.5 1.5c0 .8.8 1.5.8 2.5A2.5 2.5 0 0 1 12 22z',
        ],
        ['circle', { cx: 7.5, cy: 10.5, r: 1 }],
        ['circle', { cx: 10.5, cy: 7, r: 1 }],
        ['circle', { cx: 14.5, cy: 7.5, r: 1 }],
        ['circle', { cx: 17, cy: 11, r: 1 }],
      ],
    },
    {
      id: 'brush',
      label: 'Кисть',
      paths: [
        ['path', 'm9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08'],
        [
          'path',
          'M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
        ],
      ],
    },
    { id: 'code', label: 'Код', paths: [['path', 'm8 6-6 6 6 6M16 6l6 6-6 6']] },
    {
      id: 'puzzle',
      label: 'Пазл',
      paths: [
        [
          'path',
          'M4 7h3a1 1 0 0 0 1-1V5a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a2 2 0 0 0 0-4H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1',
        ],
      ],
    },
    {
      id: 'pin',
      label: 'Булавка',
      paths: [
        ['path', 'M12 17v5'],
        [
          'path',
          'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
        ],
      ],
    },
    {
      id: 'eye',
      label: 'Глаз',
      paths: [
        ['path', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z'],
        ['circle', { cx: 12, cy: 12, r: 3 }],
      ],
    },
    {
      id: 'shield',
      label: 'Щит',
      paths: [['path', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']],
    },
    {
      id: 'search',
      label: 'Лупа',
      paths: [
        ['circle', { cx: 11, cy: 11, r: 7 }],
        ['path', 'm21 21-4.3-4.3'],
      ],
    },
    {
      id: 'globe',
      label: 'Глобус',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 9 }],
        ['path', 'M3 12h18'],
        [
          'path',
          'M12 3a13.5 13.5 0 0 1 3.6 9A13.5 13.5 0 0 1 12 21a13.5 13.5 0 0 1-3.6-9A13.5 13.5 0 0 1 12 3Z',
        ],
      ],
    },
    {
      id: 'compass',
      label: 'Компас',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 9 }],
        ['path', 'm16 8-2.5 5.5L8 16l2.5-5.5z'],
      ],
    },
    {
      id: 'moon',
      label: 'Луна',
      paths: [['path', 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z']],
    },
    {
      id: 'sun',
      label: 'Солнце',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 4 }],
        [
          'path',
          'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
        ],
      ],
    },
    {
      id: 'smile',
      label: 'Смайл',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 9 }],
        ['path', 'M9 10h.01M15 10h.01'],
        ['path', 'M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2'],
      ],
    },
    {
      id: 'folder',
      label: 'Папка',
      paths: [
        ['path', 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
      ],
    },
    {
      id: 'power',
      label: 'Закрыть',
      paths: [
        ['path', 'M12 2v10'],
        ['path', 'M18.4 6.6a9 9 0 1 1-12.8 0'],
      ],
    },
  ];

  const ICON_PRESET_MAP = new Map(ICON_PRESETS.map((item) => [item.id, item]));
  const EMOJI_PRESETS = ['🐙', '✨', '⚡', '❤️', '🔥', '⭐', '🎵', '🎬', '📌', '⚙️', '🎨', '💬'];

  const FONT_STACKS = {
    'google-sans-medium':
      "'Google Sans Medium', 'Google Sans', 'Google Sans Flex', var(--ui-font-fallback)",
    inter: 'var(--ui-font-fallback)',
    system:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  };

  function resolveTarget(id) {
    switch (id) {
      case 'titlebar':
        return $('titlebar');
      case 'brand':
        return document.querySelector('#titlebar .brand');
      case 'pagePill':
        return $('pagePill');
      case 'panel':
        return $('panelDialog');
      case 'pluginsPanel':
        return $('pluginsDialog');
      case 'palette':
        return document.querySelector('#palette .palette-card');
      case 'popover':
        return $('popover');
      case 'findbar':
        return $('findbar');
      case 'pipbar':
        return $('pipbar');
      case 'baronly':
        return $('baronly');
      default:
        return $(id);
    }
  }

  function buildSvgIcon(presetId) {
    const preset = ICON_PRESET_MAP.get(presetId);
    if (!preset) return null;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of preset.paths) {
      const node = document.createElementNS(SVG_NS, tag);
      if (typeof attrs === 'string') {
        node.setAttribute('d', attrs);
      } else {
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      }
      svg.append(node);
    }
    return svg;
  }

  const originals = new Map();
  const componentFonts = new Map();

  function captureOriginals(id, target) {
    if (originals.has(id)) return originals.get(id);
    const info = {
      title: target.getAttribute('title') || '',
      ariaLabel: target.getAttribute('aria-label') || '',
      labelText: '',
      placeholder: '',
    };
    if (id === 'btnPanel') {
      info.labelText = target.querySelector('.settings-label')?.textContent || 'Настройки';
    } else if (id === 'panel') {
      info.labelText = $('panelHeadTitle')?.textContent || 'Настройки';
    } else if (id === 'pluginsPanel') {
      info.labelText = $('pluginsHeadTitle')?.textContent || 'Плагины';
    } else if (id === 'palette') {
      info.placeholder = $('paletteInput')?.getAttribute('placeholder') || '';
    } else if (id === 'findbar') {
      info.placeholder = $('findInput')?.getAttribute('placeholder') || '';
    }
    originals.set(id, info);
    return info;
  }

  function applyComponentFont(id, target, cfg) {
    const preset = cfg.fontPreset || 'inherit';
    if (preset === 'inherit') {
      target.style.removeProperty('font-family');
      return;
    }
    if (preset === 'custom-name' && cfg.fontFamily) {
      target.style.fontFamily = `'${cfg.fontFamily}', var(--ui-font-fallback)`;
      return;
    }
    if (preset === 'custom-file' && cfg.fontDataBase64) {
      const faceName = `OctoCompFont_${id}`;
      const key = `${cfg.fontFileName || ''}:${cfg.fontDataBase64.length}:${cfg.fontDataBase64.slice(0, 24)}`;
      const cached = componentFonts.get(id);
      if (cached && cached.key === key) {
        target.style.fontFamily = `'${faceName}', var(--ui-font-fallback)`;
        return;
      }
      try {
        const bin = window.atob(cfg.fontDataBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        const face = new window.FontFace(faceName, bytes);
        face
          .load()
          .then((ready) => {
            if (cached && cached.face) document.fonts.delete(cached.face);
            document.fonts.add(ready);
            componentFonts.set(id, { key, face: ready });
            target.style.fontFamily = `'${faceName}', var(--ui-font-fallback)`;
          })
          .catch(() => {
            target.style.removeProperty('font-family');
          });
      } catch {
        target.style.removeProperty('font-family');
      }
      return;
    }
    if (FONT_STACKS[preset]) {
      target.style.fontFamily = FONT_STACKS[preset];
    } else {
      target.style.removeProperty('font-family');
    }
  }

  function clearCustomIcon(target) {
    target.classList.remove('has-custom-icon', 'is-icon-none');
    delete target.dataset.octoIconMode;
    target.querySelector(':scope > .octo-custom-icon')?.remove();
    if (target.id === 'palette' || target.classList.contains('palette-card')) {
      const search = target.querySelector('.palette-search');
      search?.classList.remove('has-custom-icon', 'is-icon-none');
      search?.querySelector(':scope > .octo-custom-icon')?.remove();
    }
  }

  function applyComponentIcon(id, target, cfg) {
    const host = id === 'palette' ? target.querySelector('.palette-search') || target : target;
    const mode = cfg.iconType || 'default';
    if (mode === 'default') {
      clearCustomIcon(target);
      return;
    }

    host.classList.add('has-custom-icon');
    host.dataset.octoIconMode = mode;
    host.classList.toggle('is-icon-none', mode === 'none');

    let customNode = host.querySelector(':scope > .octo-custom-icon');
    if (mode === 'none') {
      customNode?.remove();
      return;
    }

    if (mode === 'preset') {
      const svg = buildSvgIcon(cfg.iconValue);
      if (!svg) {
        clearCustomIcon(target);
        return;
      }
      if (!customNode || !customNode.classList.contains('octo-custom-icon--svg')) {
        customNode?.remove();
        customNode = document.createElement('span');
        customNode.className = 'octo-custom-icon octo-custom-icon--svg';
        customNode.setAttribute('aria-hidden', 'true');
        host.prepend(customNode);
      }
      customNode.replaceChildren(svg);
      return;
    }

    if (mode === 'emoji') {
      if (!customNode || !customNode.classList.contains('octo-custom-icon--emoji')) {
        customNode?.remove();
        customNode = document.createElement('span');
        customNode.className = 'octo-custom-icon octo-custom-icon--emoji';
        customNode.setAttribute('aria-hidden', 'true');
        customNode.setAttribute('data-i18n-skip', '');
        host.prepend(customNode);
      }
      customNode.textContent = cfg.iconValue || '';
      return;
    }

    if (mode === 'file' && cfg.iconDataUrl) {
      if (!customNode || !customNode.classList.contains('octo-custom-icon--img')) {
        customNode?.remove();
        customNode = document.createElement('img');
        customNode.className = 'octo-custom-icon octo-custom-icon--img';
        customNode.alt = '';
        customNode.draggable = false;
        host.prepend(customNode);
      }
      if (customNode.getAttribute('src') !== cfg.iconDataUrl) {
        customNode.setAttribute('src', cfg.iconDataUrl);
      }
      return;
    }

    clearCustomIcon(target);
  }

  function applyComponentLabel(id, target, cfg, orig) {
    const label = typeof cfg.label === 'string' ? cfg.label : '';

    if (id === 'brand') {
      let span = target.querySelector(':scope > .brand-custom-label');
      if (label) {
        if (!span) {
          span = document.createElement('span');
          span.className = 'brand-custom-label';
          span.setAttribute('data-i18n-skip', '');
          target.append(span);
        }
        span.textContent = label;
        target.classList.add('has-brand-label');
        document.title = label;
      } else {
        span?.remove();
        target.classList.remove('has-brand-label');
        document.title = 'TikTok Octo';
      }
      return;
    }

    if (id === 'btnPanel') {
      const span = target.querySelector('.settings-label');
      if (span) {
        if (label) {
          span.setAttribute('data-i18n-skip', '');
          span.textContent = label;
        } else if (span.hasAttribute('data-i18n-skip')) {
          span.removeAttribute('data-i18n-skip');
          span.textContent = orig.labelText || 'Настройки';
          window.octoI18n?.refresh?.();
        }
      }
      return;
    }

    if (id === 'panel') {
      const titleEl = $('panelHeadTitle');
      if (titleEl) {
        if (label) {
          titleEl.setAttribute('data-i18n-skip', '');
          titleEl.textContent = label;
        } else if (titleEl.hasAttribute('data-i18n-skip')) {
          titleEl.removeAttribute('data-i18n-skip');
          titleEl.textContent = orig.labelText || 'Настройки';
          window.octoI18n?.refresh?.();
        }
      }
      return;
    }

    if (id === 'pluginsPanel') {
      const titleEl = $('pluginsHeadTitle');
      if (titleEl) {
        if (label) {
          titleEl.setAttribute('data-i18n-skip', '');
          titleEl.textContent = label;
        } else if (titleEl.hasAttribute('data-i18n-skip')) {
          titleEl.removeAttribute('data-i18n-skip');
          titleEl.textContent = orig.labelText || 'Плагины';
          window.octoI18n?.refresh?.();
        }
      }
      return;
    }

    if (id === 'palette') {
      const input = $('paletteInput');
      if (input) {
        if (label) {
          input.setAttribute('data-octo-custom-tooltip', '1');
          input.setAttribute('placeholder', label);
        } else if (input.hasAttribute('data-octo-custom-tooltip')) {
          input.removeAttribute('data-octo-custom-tooltip');
          input.setAttribute('placeholder', orig.placeholder || 'Введите команду или имя…');
          window.octoI18n?.refresh?.();
        }
      }
      return;
    }

    if (id === 'findbar') {
      const input = $('findInput');
      if (input) {
        if (label) {
          input.setAttribute('data-octo-custom-tooltip', '1');
          input.setAttribute('placeholder', label);
        } else if (input.hasAttribute('data-octo-custom-tooltip')) {
          input.removeAttribute('data-octo-custom-tooltip');
          input.setAttribute('placeholder', orig.placeholder || 'Найти на странице');
          window.octoI18n?.refresh?.();
        }
      }
      return;
    }

    if (id === 'pagePill' || id === 'pipbar' || id === 'baronly') {
      return;
    }

    let badge = target.querySelector(':scope > .octo-comp-label');
    if (label) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'octo-comp-label';
        badge.setAttribute('data-i18n-skip', '');
        target.append(badge);
      }
      badge.textContent = label;
      target.classList.add('has-comp-label');
    } else {
      badge?.remove();
      target.classList.remove('has-comp-label');
    }
  }

  function applyComponentTooltip(target, cfg, orig) {
    const tooltip = typeof cfg.tooltip === 'string' ? cfg.tooltip : '';
    if (tooltip) {
      target.setAttribute('data-octo-custom-tooltip', '1');
      target.setAttribute('title', tooltip);
      if (orig.ariaLabel) target.setAttribute('aria-label', tooltip);
    } else if (target.hasAttribute('data-octo-custom-tooltip')) {
      target.removeAttribute('data-octo-custom-tooltip');
      if (orig.title) target.setAttribute('title', orig.title);
      else target.removeAttribute('title');
      if (orig.ariaLabel) target.setAttribute('aria-label', orig.ariaLabel);
      window.octoI18n?.refresh?.();
    }
  }

  function applyAll(customMap) {
    const map = customMap && typeof customMap === 'object' ? customMap : {};
    const list = Array.isArray(window.octo?.uiComponents) ? window.octo.uiComponents : [];
    const rootStyle = document.documentElement.style;

    for (const meta of list) {
      const target = resolveTarget(meta.id);
      if (!target) continue;
      const orig = captureOriginals(meta.id, target);
      const cfg = map[meta.id] || {};

      applyComponentLabel(meta.id, target, cfg, orig);
      applyComponentTooltip(target, cfg, orig);
      if (meta.supportsIcon) applyComponentIcon(meta.id, target, cfg);
      applyComponentFont(meta.id, target, cfg);

      if (cfg.fgColor) target.style.color = cfg.fgColor;
      else target.style.removeProperty('color');

      if (cfg.bgColor) target.style.background = cfg.bgColor;
      else target.style.removeProperty('background');

      if (cfg.borderColor) {
        target.style.borderColor = cfg.borderColor;
        target.classList.add('has-custom-border');
      } else {
        target.style.removeProperty('border-color');
        target.classList.remove('has-custom-border');
      }

      if (cfg.fontSize > 0) target.style.fontSize = `${cfg.fontSize}px`;
      else target.style.removeProperty('font-size');

      if (cfg.fontWeight) target.style.fontWeight = cfg.fontWeight;
      else target.style.removeProperty('font-weight');

      if (cfg.iconSize > 0) target.style.setProperty('--octo-comp-icon-size', `${cfg.iconSize}px`);
      else target.style.removeProperty('--octo-comp-icon-size');

      if (typeof cfg.radius === 'number' && cfg.radius >= 0) {
        target.style.borderRadius = `${cfg.radius}px`;
      } else {
        target.style.removeProperty('border-radius');
      }

      if (cfg.opacity && cfg.opacity < 100) target.style.opacity = String(cfg.opacity / 100);
      else target.style.removeProperty('opacity');

      if (meta.id === 'titlebar') {
        if (cfg.height > 0) rootStyle.setProperty('--bar-h', `${cfg.height}px`);
        else rootStyle.removeProperty('--bar-h');
      }

      target.classList.toggle('is-comp-hidden', cfg.hidden === true);
    }
  }

  function getPageTitle(compId, defaultTitle, customMap) {
    const label = customMap?.[compId]?.label;
    if (!label) return defaultTitle;
    return label.includes('{title}') ? label.replaceAll('{title}', defaultTitle) : label;
  }

  // --- Редактор в настройках -------------------------------------------------

  let selectedId = 'brand';
  let currentMap = {};
  let editorBound = false;
  let pendingIconType = '';
  let pendingFontPreset = '';
  let activeCompColorRole = 'fgColor';
  let activeColorDefaults = { fg: '#ddd2e0', bg: '#2b263d', border: '#8c84a9' };

  const THEME_SWATCH_TOKENS = [
    { varName: '--md-primary', label: 'Основной' },
    { varName: '--md-on-primary', label: 'На основном' },
    { varName: '--md-primary-container', label: 'Контейнер' },
    { varName: '--md-secondary', label: 'Доп.' },
    { varName: '--md-tertiary', label: 'Третичный' },
    { varName: '--md-surface', label: 'Фон' },
    { varName: '--md-surface-container-high', label: 'Карточка' },
    { varName: '--md-on-surface', label: 'Текст' },
    { hex: '#ffffff', label: 'Белый' },
    { hex: '#000000', label: 'Чёрный' },
  ];

  function editorRefs() {
    return {
      select: $('compSelect'),
      chips: $('compModifiedChips'),
      previewBox: $('compPreviewSample'),
      previewIcon: $('compPreviewIcon'),
      previewLabel: $('compPreviewLabel'),
      labelRow: $('compLabelRow'),
      labelInput: $('compLabelInput'),
      tooltipInput: $('compTooltipInput'),
      hiddenRow: $('compHiddenRow'),
      iconSection: $('compIconSection'),
      iconType: $('compIconType'),
      iconPresetWrap: $('compIconPresetWrap'),
      iconPresetGrid: $('compIconPresetGrid'),
      iconEmojiWrap: $('compIconEmojiWrap'),
      iconEmojiInput: $('compIconEmojiInput'),
      iconEmojiChips: $('compIconEmojiChips'),
      iconFileWrap: $('compIconFileWrap'),
      iconFileName: $('compIconFileName'),
      iconPickBtn: $('compIconPickBtn'),
      colorRoleTabs: $('compColorRoleTabs'),
      colorHue: $('compColorHue'),
      colorHueVal: $('compColorHueVal'),
      colorSat: $('compColorSat'),
      colorSatVal: $('compColorSatVal'),
      colorLight: $('compColorLight'),
      colorLightVal: $('compColorLightVal'),
      colorSwatches: $('compColorSwatches'),
      fgColor: $('compFgColor'),
      fgHex: $('compFgHex'),
      fgReset: $('compFgReset'),
      bgColor: $('compBgColor'),
      bgHex: $('compBgHex'),
      bgReset: $('compBgReset'),
      borderColor: $('compBorderColor'),
      borderHex: $('compBorderHex'),
      borderReset: $('compBorderReset'),
      fontPreset: $('compFontPreset'),
      fontNameRow: $('compFontNameRow'),
      fontNameInput: $('compFontNameInput'),
      fontNameApply: $('compFontNameApply'),
      fontFileRow: $('compFontFileRow'),
      fontFileName: $('compFontFileName'),
      fontPickBtn: $('compFontPickBtn'),
      fontSize: $('compFontSize'),
      fontSizeValue: $('compFontSizeValue'),
      fontWeight: $('compFontWeight'),
      iconSizeRow: $('compIconSizeRow'),
      iconSize: $('compIconSize'),
      iconSizeValue: $('compIconSizeValue'),
      radius: $('compRadius'),
      radiusValue: $('compRadiusValue'),
      heightRow: $('compHeightRow'),
      height: $('compHeight'),
      heightValue: $('compHeightValue'),
      opacity: $('compOpacity'),
      opacityValue: $('compOpacityValue'),
      resetBtn: $('compResetBtn'),
      resetAllBtn: $('compResetAllBtn'),
    };
  }

  function sendPatch(patch) {
    const nextLocal = { ...(currentMap[selectedId] || {}), ...patch };
    currentMap = { ...currentMap, [selectedId]: nextLocal };
    window.octo?.cmd('uiCustomSet', { id: selectedId, patch });
  }

  function normalizeHexInput(raw) {
    if (typeof raw !== 'string') return '';
    let clean = raw.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(clean)) {
      clean = clean
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return /^[0-9a-f]{6}$/i.test(clean) ? `#${clean.toLowerCase()}` : '';
  }

  function hexToHsl(hex) {
    const norm = normalizeHexInput(hex) || '#8c84a9';
    const num = parseInt(norm.slice(1), 16);
    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return {
      h: Math.round((h * 60 + 360) % 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function hslToHex(hVal, sVal, lVal) {
    const h = ((Number(hVal) % 360) + 360) % 360;
    const s = Math.min(100, Math.max(0, Number(sVal) || 0)) / 100;
    const l = Math.min(100, Math.max(0, Number(lVal) || 0)) / 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  }

  function paintSlider(rangeEl) {
    if (!rangeEl) return;
    const min = Number(rangeEl.min) || 0;
    const max = Number(rangeEl.max) || 100;
    const val = Number(rangeEl.value);
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    rangeEl.style.setProperty('--slider-pct', `${Math.min(100, Math.max(0, pct)).toFixed(2)}%`);
  }

  function paintHslSliders(hueEl, satEl, lightEl, hsl) {
    if (!hsl) return;
    const hueHex = hslToHex(hsl.h, 100, 50);
    const satLow = hslToHex(hsl.h, 0, Math.min(82, Math.max(20, hsl.l)));
    const satHigh = hslToHex(hsl.h, 100, Math.min(72, Math.max(32, hsl.l)));
    const lightMid = hslToHex(hsl.h, hsl.s, 50);
    const currentHex = hslToHex(hsl.h, hsl.s, hsl.l);

    if (hueEl) {
      paintSlider(hueEl);
      hueEl.style.setProperty('--thumb-color', hueHex);
    }
    if (satEl) {
      paintSlider(satEl);
      satEl.style.setProperty('--sat-low', satLow);
      satEl.style.setProperty('--sat-high', satHigh);
      satEl.style.setProperty('--thumb-color', currentHex);
    }
    if (lightEl) {
      paintSlider(lightEl);
      lightEl.style.setProperty('--light-mid', lightMid);
      lightEl.style.setProperty('--thumb-color', currentHex);
    }
  }

  function readThemeDefaults() {
    const cs = getComputedStyle(document.documentElement);
    activeColorDefaults = {
      fg: normalizeHexInput(cs.getPropertyValue('--md-on-surface')) || '#ddd2e0',
      bg: normalizeHexInput(cs.getPropertyValue('--md-surface-container')) || '#2b263d',
      border: normalizeHexInput(cs.getPropertyValue('--md-outline')) || '#8c84a9',
    };
  }

  function populateSelect(refs) {
    if (!refs.select || refs.select.options.length > 0) return;
    const list = Array.isArray(window.octo?.uiComponents) ? window.octo.uiComponents : [];
    const groups = [
      { id: 'titlebar', label: tr('Верхняя полоса') },
      { id: 'panels', label: tr('Панели и мини-режимы') },
    ];
    for (const group of groups) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      for (const comp of list.filter((item) => item.group === group.id)) {
        const option = document.createElement('option');
        option.value = comp.id;
        option.textContent = tr(comp.label);
        optgroup.append(option);
      }
      refs.select.append(optgroup);
    }
    if (list[0]) selectedId = list[0].id;
    refs.select.value = selectedId;
  }

  function populateIconGrids(refs) {
    if (refs.iconPresetGrid && !refs.iconPresetGrid.children.length) {
      refs.iconPresetGrid.replaceChildren(
        ...ICON_PRESETS.map((preset) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'comp-icon-btn';
          btn.dataset.iconPreset = preset.id;
          btn.title = tr(preset.label);
          btn.setAttribute('aria-label', tr(preset.label));
          const svg = buildSvgIcon(preset.id);
          if (svg) btn.append(svg);
          return btn;
        }),
      );
    }
    if (refs.iconEmojiChips && !refs.iconEmojiChips.children.length) {
      refs.iconEmojiChips.replaceChildren(
        ...EMOJI_PRESETS.map((emoji) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'comp-emoji-chip';
          btn.dataset.emoji = emoji;
          btn.setAttribute('data-i18n-skip', '');
          btn.textContent = emoji;
          return btn;
        }),
      );
    }
  }

  function bindEditor() {
    if (editorBound) return;
    const refs = editorRefs();
    if (!refs.select) return;
    editorBound = true;

    populateSelect(refs);
    populateIconGrids(refs);

    refs.select.addEventListener('change', () => {
      selectedId = refs.select.value;
      pendingIconType = '';
      pendingFontPreset = '';
      renderEditor(currentMap);
    });

    refs.chips?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-comp-chip]');
      if (!chip) return;
      selectedId = chip.dataset.compChip;
      pendingIconType = '';
      pendingFontPreset = '';
      refs.select.value = selectedId;
      renderEditor(currentMap);
    });

    let labelTimer = null;
    const pushLabel = () => {
      clearTimeout(labelTimer);
      sendPatch({ label: refs.labelInput.value });
    };
    refs.labelInput?.addEventListener('input', () => {
      clearTimeout(labelTimer);
      labelTimer = setTimeout(pushLabel, 140);
    });
    refs.labelInput?.addEventListener('change', pushLabel);

    let tipTimer = null;
    const pushTooltip = () => {
      clearTimeout(tipTimer);
      sendPatch({ tooltip: refs.tooltipInput.value });
    };
    refs.tooltipInput?.addEventListener('input', () => {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(pushTooltip, 140);
    });
    refs.tooltipInput?.addEventListener('change', pushTooltip);

    refs.hiddenRow?.addEventListener('click', () => {
      const next = !(currentMap[selectedId]?.hidden === true);
      sendPatch({ hidden: next });
    });

    refs.iconType?.addEventListener('change', () => {
      const nextType = refs.iconType.value;
      pendingIconType = nextType === 'emoji' || nextType === 'file' ? nextType : '';
      if (nextType === 'preset') {
        const curVal =
          currentMap[selectedId]?.iconType === 'preset' ? currentMap[selectedId]?.iconValue : '';
        sendPatch({ iconType: 'preset', iconValue: curVal || ICON_PRESETS[0].id });
      } else if (nextType === 'file') {
        if (currentMap[selectedId]?.iconDataUrl) {
          sendPatch({ iconType: 'file' });
        } else {
          window.octo?.cmd('uiCustomIconPick', { id: selectedId });
        }
      } else if (nextType === 'emoji') {
        const curEmoji =
          currentMap[selectedId]?.iconType === 'emoji'
            ? currentMap[selectedId]?.iconValue || ''
            : '';
        if (curEmoji) sendPatch({ iconType: 'emoji', iconValue: curEmoji });
        else sendPatch({ iconType: 'default', iconValue: '' });
      } else {
        sendPatch({ iconType: nextType, iconValue: '' });
      }
      renderEditor(currentMap);
    });

    refs.iconPresetGrid?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-icon-preset]');
      if (!btn) return;
      pendingIconType = '';
      sendPatch({ iconType: 'preset', iconValue: btn.dataset.iconPreset });
    });

    let emojiTimer = null;
    refs.iconEmojiInput?.addEventListener('input', () => {
      clearTimeout(emojiTimer);
      emojiTimer = setTimeout(() => {
        const val = refs.iconEmojiInput.value.trim();
        if (val) pendingIconType = '';
        sendPatch({ iconType: val ? 'emoji' : 'default', iconValue: val });
      }, 120);
    });

    refs.iconEmojiChips?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-emoji]');
      if (!btn) return;
      pendingIconType = '';
      refs.iconEmojiInput.value = btn.dataset.emoji;
      sendPatch({ iconType: 'emoji', iconValue: btn.dataset.emoji });
    });

    refs.iconPickBtn?.addEventListener('click', () => {
      window.octo?.cmd('uiCustomIconPick', { id: selectedId });
    });

    const bindColorField = (picker, hexInput, resetBtn, fieldKey) => {
      picker?.addEventListener('focus', () => {
        activeCompColorRole = fieldKey;
        renderEditor(currentMap);
      });
      picker?.addEventListener('input', () => {
        const val = picker.value;
        activeCompColorRole = fieldKey;
        if (hexInput) hexInput.value = val;
        sendPatch({ [fieldKey]: val });
      });
      hexInput?.addEventListener('focus', () => {
        activeCompColorRole = fieldKey;
        renderEditor(currentMap);
      });
      hexInput?.addEventListener('change', () => {
        const hex = normalizeHexInput(hexInput.value);
        activeCompColorRole = fieldKey;
        if (!hexInput.value.trim()) {
          sendPatch({ [fieldKey]: '' });
          return;
        }
        if (hex) {
          hexInput.value = hex;
          if (picker) picker.value = hex;
          sendPatch({ [fieldKey]: hex });
        }
      });
      resetBtn?.addEventListener('click', () => {
        sendPatch({ [fieldKey]: '' });
      });
    };

    bindColorField(refs.fgColor, refs.fgHex, refs.fgReset, 'fgColor');
    bindColorField(refs.bgColor, refs.bgHex, refs.bgReset, 'bgColor');
    bindColorField(refs.borderColor, refs.borderHex, refs.borderReset, 'borderColor');

    refs.colorRoleTabs?.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-comp-color-role]');
      if (!tab) return;
      activeCompColorRole = tab.dataset.compColorRole;
      renderEditor(currentMap);
    });

    const pushHslColor = () => {
      const hsl = {
        h: Number(refs.colorHue?.value) || 0,
        s: Number(refs.colorSat?.value) || 0,
        l: Number(refs.colorLight?.value) || 0,
      };
      paintHslSliders(refs.colorHue, refs.colorSat, refs.colorLight, hsl);
      if (refs.colorHueVal) refs.colorHueVal.textContent = `${hsl.h}°`;
      if (refs.colorSatVal) refs.colorSatVal.textContent = `${hsl.s} %`;
      if (refs.colorLightVal) refs.colorLightVal.textContent = `${hsl.l} %`;
      const hex = hslToHex(hsl.h, hsl.s, hsl.l);
      sendPatch({ [activeCompColorRole]: hex });
    };

    refs.colorHue?.addEventListener('input', pushHslColor);
    refs.colorSat?.addEventListener('input', pushHslColor);
    refs.colorLight?.addEventListener('input', pushHslColor);

    refs.colorSwatches?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-swatch-hex]');
      if (!btn) return;
      const hex = btn.dataset.swatchHex;
      if (hex) sendPatch({ [activeCompColorRole]: hex });
    });

    refs.fontPreset?.addEventListener('change', () => {
      const preset = refs.fontPreset.value;
      pendingFontPreset = preset === 'custom-name' || preset === 'custom-file' ? preset : '';
      if (preset === 'custom-name') {
        refs.fontNameRow.hidden = false;
        refs.fontFileRow.hidden = true;
        refs.fontNameInput?.focus();
        const family = refs.fontNameInput?.value.trim();
        if (family) {
          pendingFontPreset = '';
          sendPatch({ fontPreset: 'custom-name', fontFamily: family });
        }
        return;
      }
      if (preset === 'custom-file') {
        refs.fontNameRow.hidden = true;
        refs.fontFileRow.hidden = false;
        if (currentMap[selectedId]?.fontDataBase64) {
          pendingFontPreset = '';
          sendPatch({ fontPreset: 'custom-file' });
        } else {
          window.octo?.cmd('uiCustomFontPick', { id: selectedId });
        }
        return;
      }
      sendPatch({ fontPreset: preset });
    });

    const applyFontName = () => {
      const family = refs.fontNameInput?.value.trim() || '';
      if (!family) return;
      pendingFontPreset = '';
      sendPatch({ fontPreset: 'custom-name', fontFamily: family });
    };
    refs.fontNameApply?.addEventListener('click', applyFontName);
    refs.fontNameInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyFontName();
      }
    });

    refs.fontPickBtn?.addEventListener('click', () => {
      window.octo?.cmd('uiCustomFontPick', { id: selectedId });
    });

    refs.fontSize?.addEventListener('input', () => {
      const val = Number(refs.fontSize.value);
      const next = val <= 8 ? 0 : val;
      paintSlider(refs.fontSize);
      refs.fontSizeValue.textContent = next > 0 ? `${next} px` : tr('Авто');
      sendPatch({ fontSize: next });
    });

    refs.fontWeight?.addEventListener('change', () => {
      sendPatch({ fontWeight: refs.fontWeight.value });
    });

    refs.iconSize?.addEventListener('input', () => {
      const val = Number(refs.iconSize.value);
      const next = val <= 9 ? 0 : val;
      paintSlider(refs.iconSize);
      refs.iconSizeValue.textContent = next > 0 ? `${next} px` : tr('Авто');
      sendPatch({ iconSize: next });
    });

    refs.radius?.addEventListener('input', () => {
      const val = Number(refs.radius.value);
      const next = val < 0 ? -1 : val;
      paintSlider(refs.radius);
      refs.radiusValue.textContent = next >= 0 ? `${next} px` : tr('Авто');
      sendPatch({ radius: next });
    });

    refs.height?.addEventListener('input', () => {
      const val = Number(refs.height.value);
      const next = val < 38 ? 0 : val;
      paintSlider(refs.height);
      refs.heightValue.textContent = next > 0 ? `${next} px` : tr('Авто');
      sendPatch({ height: next });
    });

    refs.opacity?.addEventListener('input', () => {
      const val = Number(refs.opacity.value) || 100;
      paintSlider(refs.opacity);
      refs.opacityValue.textContent = `${val} %`;
      sendPatch({ opacity: val });
    });

    refs.resetBtn?.addEventListener('click', () => {
      pendingIconType = '';
      pendingFontPreset = '';
      window.octo?.cmd('uiCustomReset', selectedId);
    });

    refs.resetAllBtn?.addEventListener('click', () => {
      pendingIconType = '';
      pendingFontPreset = '';
      window.octo?.cmd('uiCustomReset', 'all');
    });
  }

  function renderPreview(refs, meta, cfg) {
    if (!refs.previewBox || !refs.previewIcon || !refs.previewLabel) return;
    const box = refs.previewBox;
    box.style.color = cfg.fgColor || '';
    box.style.background = cfg.bgColor || '';
    box.style.borderColor = cfg.borderColor || '';
    box.style.fontSize = cfg.fontSize > 0 ? `${cfg.fontSize}px` : '';
    box.style.fontWeight = cfg.fontWeight || '';
    box.style.borderRadius =
      typeof cfg.radius === 'number' && cfg.radius >= 0 ? `${cfg.radius}px` : '';
    box.style.opacity = cfg.opacity && cfg.opacity < 100 ? String(cfg.opacity / 100) : '';
    applyComponentFont(meta.id, box, cfg);

    refs.previewIcon.replaceChildren();
    refs.previewIcon.hidden = false;
    if (!meta.supportsIcon || cfg.iconType === 'none') {
      refs.previewIcon.hidden = true;
    } else if (cfg.iconType === 'preset' && cfg.iconValue) {
      const svg = buildSvgIcon(cfg.iconValue);
      if (svg) refs.previewIcon.append(svg);
      else refs.previewIcon.textContent = '◆';
    } else if (cfg.iconType === 'emoji' && cfg.iconValue) {
      refs.previewIcon.textContent = cfg.iconValue;
    } else if (cfg.iconType === 'file' && cfg.iconDataUrl) {
      const img = document.createElement('img');
      img.src = cfg.iconDataUrl;
      img.alt = '';
      img.draggable = false;
      refs.previewIcon.append(img);
    } else {
      const svg = buildSvgIcon('sparkle');
      if (svg) refs.previewIcon.append(svg);
    }
    if (cfg.iconSize > 0) {
      refs.previewIcon.style.setProperty('--octo-comp-icon-size', `${cfg.iconSize}px`);
    } else {
      refs.previewIcon.style.removeProperty('--octo-comp-icon-size');
    }

    const previewText = cfg.label || meta.defaultLabel || meta.label;
    refs.previewLabel.textContent = previewText;
    box.classList.toggle('is-hidden-preview', cfg.hidden === true);
  }

  function renderEditor(customMap) {
    currentMap = customMap && typeof customMap === 'object' ? customMap : {};
    bindEditor();
    const refs = editorRefs();
    if (!refs.select) return;

    readThemeDefaults();
    const list = Array.isArray(window.octo?.uiComponents) ? window.octo.uiComponents : [];
    const meta = list.find((item) => item.id === selectedId) || list[0];
    if (!meta) return;
    selectedId = meta.id;

    if (document.activeElement !== refs.select) {
      refs.select.value = selectedId;
    }

    const cfg = currentMap[selectedId] || {};

    if (refs.chips) {
      const modifiedIds = Object.keys(currentMap);
      refs.chips.hidden = modifiedIds.length === 0;
      refs.chips.replaceChildren(
        ...modifiedIds.map((id) => {
          const itemMeta = list.find((m) => m.id === id);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `comp-chip${id === selectedId ? ' is-active' : ''}`;
          chip.dataset.compChip = id;
          chip.textContent = tr(itemMeta ? itemMeta.label : id);
          return chip;
        }),
      );
    }

    renderPreview(refs, meta, cfg);

    if (refs.labelRow) refs.labelRow.hidden = !meta.supportsLabel;
    if (refs.labelInput && document.activeElement !== refs.labelInput) {
      refs.labelInput.value = cfg.label || '';
      refs.labelInput.placeholder = meta.defaultLabel ? tr(meta.defaultLabel) : tr('Своё название');
    }
    if (refs.tooltipInput && document.activeElement !== refs.tooltipInput) {
      refs.tooltipInput.value = cfg.tooltip || '';
      refs.tooltipInput.placeholder = meta.defaultTooltip
        ? tr(meta.defaultTooltip)
        : tr('По умолчанию');
    }

    if (refs.hiddenRow) {
      const canHide = meta.id !== 'titlebar' && meta.id !== 'panel';
      refs.hiddenRow.hidden = !canHide;
      const hidden = cfg.hidden === true;
      refs.hiddenRow.classList.toggle('is-on', hidden);
      refs.hiddenRow.setAttribute('aria-checked', String(hidden));
    }

    if (refs.iconSection) refs.iconSection.hidden = !meta.supportsIcon;
    if (meta.supportsIcon) {
      if (cfg.iconType && cfg.iconType === pendingIconType) pendingIconType = '';
      const iconType = pendingIconType || cfg.iconType || 'default';
      if (refs.iconType && document.activeElement !== refs.iconType) {
        refs.iconType.value = iconType;
      }
      if (refs.iconPresetWrap) refs.iconPresetWrap.hidden = iconType !== 'preset';
      if (refs.iconEmojiWrap) refs.iconEmojiWrap.hidden = iconType !== 'emoji';
      if (refs.iconFileWrap) refs.iconFileWrap.hidden = iconType !== 'file';

      if (refs.iconPresetGrid) {
        for (const btn of refs.iconPresetGrid.children) {
          btn.classList.toggle(
            'is-active',
            iconType === 'preset' && btn.dataset.iconPreset === cfg.iconValue,
          );
        }
      }
      if (refs.iconEmojiInput && document.activeElement !== refs.iconEmojiInput) {
        refs.iconEmojiInput.value = iconType === 'emoji' ? cfg.iconValue || '' : '';
      }
      if (refs.iconFileName) {
        refs.iconFileName.textContent =
          iconType === 'file' && cfg.iconValue ? cfg.iconValue : tr('Файл не выбран');
      }
    }

    if (refs.fgColor) refs.fgColor.value = cfg.fgColor || activeColorDefaults.fg;
    if (refs.fgHex && document.activeElement !== refs.fgHex) refs.fgHex.value = cfg.fgColor || '';
    if (refs.fgReset) refs.fgReset.disabled = !cfg.fgColor;

    if (refs.bgColor) refs.bgColor.value = cfg.bgColor || activeColorDefaults.bg;
    if (refs.bgHex && document.activeElement !== refs.bgHex) refs.bgHex.value = cfg.bgColor || '';
    if (refs.bgReset) refs.bgReset.disabled = !cfg.bgColor;

    if (refs.borderColor) refs.borderColor.value = cfg.borderColor || activeColorDefaults.border;
    if (refs.borderHex && document.activeElement !== refs.borderHex) {
      refs.borderHex.value = cfg.borderColor || '';
    }
    if (refs.borderReset) refs.borderReset.disabled = !cfg.borderColor;

    if (refs.colorRoleTabs) {
      for (const tab of refs.colorRoleTabs.children) {
        const active = tab.dataset.compColorRole === activeCompColorRole;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      }
    }

    const defaultForRole =
      activeCompColorRole === 'fgColor'
        ? activeColorDefaults.fg
        : activeCompColorRole === 'bgColor'
          ? activeColorDefaults.bg
          : activeColorDefaults.border;
    const activeRoleHex = cfg[activeCompColorRole] || defaultForRole;
    const activeHsl = hexToHsl(activeRoleHex);
    if (refs.colorHue && document.activeElement !== refs.colorHue) {
      refs.colorHue.value = String(activeHsl.h);
    }
    if (refs.colorSat && document.activeElement !== refs.colorSat) {
      refs.colorSat.value = String(activeHsl.s);
    }
    if (refs.colorLight && document.activeElement !== refs.colorLight) {
      refs.colorLight.value = String(activeHsl.l);
    }
    if (refs.colorHueVal) refs.colorHueVal.textContent = `${activeHsl.h}°`;
    if (refs.colorSatVal) refs.colorSatVal.textContent = `${activeHsl.s} %`;
    if (refs.colorLightVal) refs.colorLightVal.textContent = `${activeHsl.l} %`;
    paintHslSliders(refs.colorHue, refs.colorSat, refs.colorLight, activeHsl);

    if (refs.colorSwatches) {
      const cs = getComputedStyle(document.documentElement);
      refs.colorSwatches.replaceChildren(
        ...THEME_SWATCH_TOKENS.map((item) => {
          const hex = item.hex || normalizeHexInput(cs.getPropertyValue(item.varName)) || '#8c84a9';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `color-swatch-dot${hex === cfg[activeCompColorRole] ? ' is-selected' : ''}`;
          btn.dataset.swatchHex = hex;
          btn.title = `${tr(item.label)} (${hex})`;
          btn.setAttribute('aria-label', `${tr(item.label)} ${hex}`);
          btn.style.backgroundColor = hex;
          return btn;
        }),
      );
    }

    if (cfg.fontPreset && cfg.fontPreset === pendingFontPreset) pendingFontPreset = '';
    const fontPreset = pendingFontPreset || cfg.fontPreset || 'inherit';
    if (refs.fontPreset && document.activeElement !== refs.fontPreset) {
      refs.fontPreset.value = fontPreset;
    }
    if (refs.fontNameRow) refs.fontNameRow.hidden = fontPreset !== 'custom-name';
    if (refs.fontFileRow) refs.fontFileRow.hidden = fontPreset !== 'custom-file';
    if (refs.fontNameInput && document.activeElement !== refs.fontNameInput) {
      refs.fontNameInput.value = cfg.fontFamily || '';
    }
    if (refs.fontFileName) {
      refs.fontFileName.textContent = cfg.fontFileName || tr('Файл не выбран');
    }

    if (refs.fontSize && document.activeElement !== refs.fontSize) {
      refs.fontSize.value = String(cfg.fontSize > 0 ? cfg.fontSize : 8);
    }
    paintSlider(refs.fontSize);
    if (refs.fontSizeValue) {
      refs.fontSizeValue.textContent = cfg.fontSize > 0 ? `${cfg.fontSize} px` : tr('Авто');
    }

    if (refs.fontWeight && document.activeElement !== refs.fontWeight) {
      refs.fontWeight.value = cfg.fontWeight || '';
    }

    if (refs.iconSizeRow) refs.iconSizeRow.hidden = !meta.supportsIcon;
    if (refs.iconSize && document.activeElement !== refs.iconSize) {
      refs.iconSize.value = String(cfg.iconSize > 0 ? cfg.iconSize : 9);
    }
    paintSlider(refs.iconSize);
    if (refs.iconSizeValue) {
      refs.iconSizeValue.textContent = cfg.iconSize > 0 ? `${cfg.iconSize} px` : tr('Авто');
    }

    if (refs.radius && document.activeElement !== refs.radius) {
      refs.radius.value = String(
        typeof cfg.radius === 'number' && cfg.radius >= 0 ? cfg.radius : -1,
      );
    }
    paintSlider(refs.radius);
    if (refs.radiusValue) {
      refs.radiusValue.textContent =
        typeof cfg.radius === 'number' && cfg.radius >= 0 ? `${cfg.radius} px` : tr('Авто');
    }

    if (refs.heightRow) refs.heightRow.hidden = !meta.supportsHeight;
    if (refs.height && document.activeElement !== refs.height) {
      refs.height.value = String(cfg.height > 0 ? cfg.height : 37);
    }
    paintSlider(refs.height);
    if (refs.heightValue) {
      refs.heightValue.textContent = cfg.height > 0 ? `${cfg.height} px` : tr('Авто');
    }

    const op = cfg.opacity || 100;
    if (refs.opacity && document.activeElement !== refs.opacity) {
      refs.opacity.value = String(op);
    }
    paintSlider(refs.opacity);
    if (refs.opacityValue) {
      refs.opacityValue.textContent = `${op} %`;
    }

    if (refs.resetBtn) refs.resetBtn.disabled = Object.keys(cfg).length === 0;
    if (refs.resetAllBtn) refs.resetAllBtn.disabled = Object.keys(currentMap).length === 0;
  }

  window.octoUiCustom = {
    ICON_PRESETS,
    colorHelpers: {
      normalizeHex: normalizeHexInput,
      hexToHsl,
      hslToHex,
      paintSlider,
      paintHslSliders,
    },
    apply: applyAll,
    renderEditor,
    getPageTitle,
  };
})();
