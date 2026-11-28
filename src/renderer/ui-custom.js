'use strict';

/**
 * Редактор компонентов, конструктор кнопок верхней полосы и интерактивный
 * выбор элементов кликом. Работает в песочнице renderer поверх window.octoUiCore.
 */
(() => {
  const core = window.octoUiCore;
  if (!core) return;

  const $ = (id) => document.getElementById(id);
  const tr = core.tr;

  const TOPBAR_BUILTIN_ITEMS = [
    { id: 'brand', label: 'Логотип' },
    { id: 'btnBack', label: 'Назад' },
    { id: 'btnForward', label: 'Вперёд' },
    { id: 'btnReload', label: 'Обновить' },
    { id: 'btnHome', label: 'Главная' },
    { id: 'pagePill', label: 'Пилюля страницы' },
    { id: 'btnPip', label: 'PiP' },
    { id: 'btnMute', label: 'Звук' },
    { id: 'btnTop', label: 'Поверх окон' },
    { id: 'btnStickers', label: 'Стикеры' },
    { id: 'btnPluginsActive', label: 'Активные плагины' },
    { id: 'btnChat', label: 'Чат сбоку' },
    { id: 'btnPanel', label: 'Настройки' },
    { id: 'btnMin', label: 'Свернуть' },
    { id: 'btnMax', label: 'Развернуть' },
    { id: 'btnClose', label: 'Закрыть' },
  ];

  const TOPBAR_ACTION_GROUPS = [
    {
      label: 'Навигация и окно',
      items: [
        { cmd: 'home', label: 'Главная', icon: 'home' },
        { cmd: 'back', label: 'Назад', icon: 'arrow-left' },
        { cmd: 'forward', label: 'Вперёд', icon: 'arrow-right' },
        { cmd: 'reload', label: 'Обновить', icon: 'refresh' },
        { cmd: 'hardReload', label: 'Обновить без кэша', icon: 'refresh' },
        { cmd: 'find', label: 'Поиск по странице', icon: 'search' },
        { cmd: 'palette', label: 'Палитра команд', icon: 'bolt' },
        { cmd: 'fullscreen', label: 'Полный экран', icon: 'maximize' },
        { cmd: 'downloadManager', label: 'Менеджер загрузок', icon: 'download' },
        { cmd: 'openDownloads', label: 'Папка загрузок', icon: 'folder' },
        { cmd: 'openInBrowser', label: 'Открыть в браузере', icon: 'globe' },
        { cmd: 'barOnly', label: 'Режим «только полоса»', icon: 'sliders' },
        { cmd: 'devtools', label: 'Инструменты разработчика', icon: 'code' },
        { cmd: 'openUrl', label: 'Открыть раздел / ссылку TikTok…', icon: 'link' },
      ],
    },
    {
      label: 'Плеер и видео',
      items: [
        { cmd: 'togglePlayback', label: 'Играть / пауза', icon: 'play' },
        { cmd: 'feedPrev', label: 'Предыдущее видео', icon: 'skip-back' },
        { cmd: 'feedNext', label: 'Следующее видео', icon: 'skip-next' },
        { cmd: 'mute', label: 'Звук вкл/выкл', icon: 'music' },
        { cmd: 'pip', label: 'Картинка в картинке', icon: 'video' },
        { cmd: 'pictureEnhance', label: 'Улучшить картинку', icon: 'sparkle' },
        { cmd: 'pictureReset', label: 'Сбросить картинку', icon: 'refresh' },
        { cmd: 'captionToggle', label: 'Субтитры вкл/выкл', icon: 'message' },
        { cmd: 'screenshot', label: 'Снимок кадра', icon: 'camera' },
        { cmd: 'screenshotAnnotate', label: 'Снимок с аннотацией', icon: 'brush' },
        { cmd: 'qrVideo', label: 'QR-код видео', icon: 'qr' },
        { cmd: 'gifExport', label: 'Экспорт GIF', icon: 'video' },
        { cmd: 'ambientToggle', label: 'Амбиентный режим', icon: 'moon' },
      ],
    },
    {
      label: 'Библиотека, фокус и разделы',
      items: [
        { cmd: 'libraryAdd', label: 'Сохранить в библиотеку', icon: 'bookmark' },
        { cmd: 'libraryQueueAdd', label: 'В «Посмотреть позже»', icon: 'clock' },
        { cmd: 'libraryPanel', label: 'Библиотека', icon: 'bookmark' },
        { cmd: 'statsPanel', label: 'Статистика просмотра', icon: 'star' },
        { cmd: 'focusToggle', label: 'Фокус-режим', icon: 'eye' },
        { cmd: 'sideNavToggle', label: 'Свернуть / развернуть меню слева', icon: 'sliders' },
        { cmd: 'chat', label: 'Чат сбоку', icon: 'message' },
        { cmd: 'stickerPanel', label: 'Картинки в чат', icon: 'smile' },
        { cmd: 'pluginsActive', label: 'Активные плагины', icon: 'puzzle' },
        { cmd: 'plugins', label: 'Менеджер плагинов', icon: 'puzzle' },
        { cmd: 'regionPanel', label: 'Регион и прокси', icon: 'compass' },
        { cmd: 'languagePanel', label: 'Язык', icon: 'globe' },
        { cmd: 'panel', label: 'Настройки', icon: 'settings' },
        { cmd: 'checkUpdates', label: 'Проверить обновления', icon: 'download' },
      ],
    },
  ];

  const TOPBAR_ACTION_MAP = new Map(
    TOPBAR_ACTION_GROUPS.flatMap((group) => group.items.map((item) => [item.cmd, item])),
  );

  const SLOT_TARGETS = {
    nav: 'navGroup',
    actions: 'actionsGroup',
    tools: 'toolsGroup',
    extra: 'customToolsGroup',
  };

  function isCommandActive(cmd, appState) {
    if (!appState) return false;
    switch (cmd) {
      case 'pip':
        return Boolean(appState.pip);
      case 'mute':
        return Boolean(appState.muted);
      case 'onTop':
        return Boolean(appState.onTop);
      case 'chat':
        return Boolean(appState.chat?.open);
      case 'panel':
        return Boolean(appState.panel);
      case 'plugins':
        return Boolean(appState.pluginsOpen);
      case 'focusToggle':
        return Boolean(appState.focus?.enabled);
      case 'ambientToggle':
        return Boolean(appState.ambient);
      case 'captionToggle':
        return Boolean(appState.subtitles?.enabled);
      case 'stickerPanel':
        return appState.popover === 'stickers';
      case 'pluginsActive':
        return appState.popover === 'plugins';
      case 'find':
        return Boolean(appState.find?.open);
      default:
        return false;
    }
  }

  function actionDisplayName(btn, appState) {
    if (btn.cmd === 'openUrl') return btn.payload || tr('Ссылка');
    const known = TOPBAR_ACTION_MAP.get(btn.cmd);
    if (known) return tr(known.label);
    const pluginCmd = appState?.plugins?.commands?.find((item) => item.id === btn.cmd);
    if (pluginCmd) return `${pluginCmd.title} · ${pluginCmd.pluginName}`;
    return btn.cmd;
  }

  let lastTopbarSig = null;

  function topbarButtonSignature(buttons, appState) {
    if (!buttons.length) return '';
    return buttons
      .map(
        (btn) =>
          `${btn.id}|${btn.cmd}|${btn.payload || ''}|${btn.slot || ''}|${btn.label || ''}|${btn.tooltip || ''}|${actionDisplayName(btn, appState)}|${btn.iconType || ''}|${btn.iconValue || ''}|${btn.iconDataUrl ? btn.iconDataUrl.length : 0}`,
      )
      .join('\n');
  }

  function renderTopbarButtons(buttons, customMap, appState) {
    const list = Array.isArray(buttons) ? buttons : [];
    const sig = topbarButtonSignature(list, appState);
    if (sig === lastTopbarSig) {
      for (const btn of list) {
        const esc = window.CSS && window.CSS.escape ? window.CSS.escape(btn.id) : btn.id;
        const el = document.querySelector(`[data-custom-btn-id="${esc}"]`);
        if (!el) continue;
        const active = isCommandActive(btn.cmd, appState);
        el.classList.toggle('is-on', active);
        el.setAttribute('aria-pressed', String(active));
      }
      return;
    }
    lastTopbarSig = sig;

    for (const containerId of Object.values(SLOT_TARGETS)) {
      const container = $(containerId);
      if (!container) continue;
      for (const node of Array.from(container.querySelectorAll('[data-custom-btn-id]'))) {
        node.remove();
      }
    }

    for (const btn of list) {
      const containerId = SLOT_TARGETS[btn.slot] || SLOT_TARGETS.extra;
      const container = $(containerId);
      if (!container) continue;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'icon-btn octo-custom-topbar-btn';
      el.dataset.customBtnId = btn.id;
      el.dataset.uiCompId = `customBtn:${btn.id}`;
      el.dataset.uiPageId = 'titlebar';
      const defaultTip = btn.tooltip || btn.label || actionDisplayName(btn, appState);
      el.dataset.customBtnLabel = btn.label || defaultTip;
      el.title = defaultTip;
      el.setAttribute('aria-label', defaultTip);

      const active = isCommandActive(btn.cmd, appState);
      el.classList.toggle('is-on', active);
      el.setAttribute('aria-pressed', String(active));

      if (btn.iconType === 'preset') {
        const svg = core.buildSvgIcon(btn.iconValue || 'sparkle');
        if (svg) el.append(svg);
      } else if (btn.iconType === 'emoji' && btn.iconValue) {
        const emoji = document.createElement('span');
        emoji.className = 'octo-custom-icon octo-custom-icon--emoji octo-btn-native-emoji';
        emoji.setAttribute('aria-hidden', 'true');
        emoji.setAttribute('data-i18n-skip', '');
        emoji.textContent = btn.iconValue;
        el.append(emoji);
      } else if (btn.iconType === 'file' && btn.iconDataUrl) {
        const img = document.createElement('img');
        img.className = 'octo-custom-icon octo-custom-icon--img';
        img.src = btn.iconDataUrl;
        img.alt = '';
        img.draggable = false;
        el.append(img);
      }

      if (btn.label) {
        const span = document.createElement('span');
        span.className = 'octo-custom-label';
        span.setAttribute('data-i18n-skip', '');
        span.dataset.customBtnDefault = btn.label;
        span.textContent = btn.label;
        el.append(span);
        el.classList.add('has-comp-label');
      }

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        window.octo?.cmd(btn.cmd, btn.payload);
      });

      container.append(el);
    }

    core.syncTopbarGroupVisibility();
    // Переиндексируем каталог, чтобы свои кнопки сразу были в редакторе.
    core.collectCatalog(true);
  }

  // --- Редактор в настройках -------------------------------------------------

  let selectedPage = 'all';
  let selectedId = 'brand';
  let compFilterQuery = '';
  let currentMap = {};
  let currentTopbarButtons = [];
  let currentAppState = null;
  let editorBound = false;
  let pendingIconType = '';
  let pendingFontPreset = '';
  let activeCompColorRole = 'fgColor';
  let activeColorDefaults = { fg: '#ddd2e0', bg: '#2b263d', border: '#8c84a9' };

  // Состояние конструктора кнопок верхней полосы
  let editingTopbarId = '';
  let draftBtnId = `tb_${Date.now().toString(36)}`;
  let draftBtnIconType = 'preset';
  let draftBtnIconValue = 'camera';

  // Состояние пипетки выбора элемента кликом
  let pickerActive = false;
  let pickerHoveredEl = null;

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
      pageSelect: $('compPageSelect'),
      searchInput: $('compSearchInput'),
      pickElementBtn: $('compPickElementBtn'),
      pickerBar: $('compPickerBar'),
      pickerStatus: $('compPickerStatus'),
      pickerTogglePanel: $('compPickerTogglePanel'),
      pickerCancel: $('compPickerCancel'),
      pickerHighlight: $('compPickerHighlight'),
      pickerTag: $('compPickerTag'),

      tbBuiltinChips: $('topbarBuiltinChips'),
      tbCustomList: $('topbarCustomList'),
      tbCustomEmpty: $('topbarCustomEmpty'),
      tbAction: $('topbarBtnAction'),
      tbUrlRow: $('topbarBtnUrlRow'),
      tbUrl: $('topbarBtnUrl'),
      tbLabel: $('topbarBtnLabel'),
      tbTooltip: $('topbarBtnTooltip'),
      tbSlot: $('topbarBtnSlot'),
      tbIconType: $('topbarBtnIconType'),
      tbIconPresetWrap: $('topbarBtnIconPresetWrap'),
      tbIconGrid: $('topbarBtnIconGrid'),
      tbIconEmojiWrap: $('topbarBtnIconEmojiWrap'),
      tbIconEmoji: $('topbarBtnIconEmoji'),
      tbEmojiChips: $('topbarBtnEmojiChips'),
      tbIconFileWrap: $('topbarBtnIconFileWrap'),
      tbIconFileName: $('topbarBtnIconFileName'),
      tbIconPickBtn: $('topbarBtnIconPickBtn'),
      tbSubmit: $('topbarBtnSubmit'),
      tbCancelEdit: $('topbarBtnCancelEdit'),
      tbResetAll: $('topbarBtnResetAll'),

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

  function populatePageSelect(refs) {
    if (!refs.pageSelect || refs.pageSelect.options.length > 0) return;
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = tr('Все страницы');
    refs.pageSelect.append(allOpt);
    for (const page of core.PAGE_LIST) {
      const opt = document.createElement('option');
      opt.value = page.id;
      opt.textContent = tr(page.label);
      refs.pageSelect.append(opt);
    }
    refs.pageSelect.value = selectedPage;
  }

  function populateComponentSelect(refs) {
    if (!refs.select) return;
    const catalog = core.collectCatalog(false);
    const query = compFilterQuery.trim().toLowerCase();
    const pagesById = new Map(core.PAGE_LIST.map((p) => [p.id, tr(p.label)]));

    const items = catalog.list.filter((item) => {
      if (selectedPage !== 'all' && item.page !== selectedPage) return false;
      if (query) {
        const label = tr(item.label).toLowerCase();
        const pageName = (pagesById.get(item.page) || '').toLowerCase();
        if (
          !label.includes(query) &&
          !pageName.includes(query) &&
          !item.id.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });

    const sig = `${selectedPage}:${query}:${items.map((i) => i.id).join(',')}`;
    if (refs.select.dataset.listSig === sig) return;
    refs.select.dataset.listSig = sig;
    refs.select.replaceChildren();

    const grouped = new Map();
    for (const item of items) {
      const bucket = grouped.get(item.page) || [];
      bucket.push(item);
      grouped.set(item.page, bucket);
    }

    for (const page of core.PAGE_LIST) {
      const groupItems = grouped.get(page.id);
      if (!groupItems || !groupItems.length) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = tr(page.label);
      for (const comp of groupItems) {
        const option = document.createElement('option');
        option.value = comp.id;
        option.textContent = tr(comp.label);
        optgroup.append(option);
      }
      refs.select.append(optgroup);
    }

    if (items.length && !items.some((item) => item.id === selectedId)) {
      selectedId = items[0].id;
    }
    if (selectedId && items.some((item) => item.id === selectedId)) {
      refs.select.value = selectedId;
    }
  }

  function populateIconGrids(refs) {
    const fillPresetGrid = (grid, attr) => {
      if (!grid || grid.children.length) return;
      grid.replaceChildren(
        ...core.ICON_PRESETS.map((preset) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'comp-icon-btn';
          btn.dataset[attr] = preset.id;
          btn.title = tr(preset.label);
          btn.setAttribute('aria-label', tr(preset.label));
          const svg = core.buildSvgIcon(preset.id);
          if (svg) btn.append(svg);
          return btn;
        }),
      );
    };

    const fillEmojiGrid = (grid, attr) => {
      if (!grid || grid.children.length) return;
      grid.replaceChildren(
        ...core.EMOJI_PRESETS.map((emoji) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'comp-emoji-chip';
          btn.dataset[attr] = emoji;
          btn.setAttribute('data-i18n-skip', '');
          btn.textContent = emoji;
          return btn;
        }),
      );
    };

    fillPresetGrid(refs.iconPresetGrid, 'iconPreset');
    fillEmojiGrid(refs.iconEmojiChips, 'emoji');
    fillPresetGrid(refs.tbIconGrid, 'tbIconPreset');
    fillEmojiGrid(refs.tbEmojiChips, 'tbEmoji');
  }

  function populateTopbarActions(refs, appState) {
    if (!refs.tbAction) return;
    const pluginCmds = Array.isArray(appState?.plugins?.commands) ? appState.plugins.commands : [];
    const sig = pluginCmds.map((c) => `${c.id}:${c.title}`).join('|');
    if (refs.tbAction.dataset.actionSig === sig && refs.tbAction.options.length > 0) return;
    refs.tbAction.dataset.actionSig = sig;
    const prev = refs.tbAction.value;
    refs.tbAction.replaceChildren();

    for (const group of TOPBAR_ACTION_GROUPS) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = tr(group.label);
      for (const item of group.items) {
        const opt = document.createElement('option');
        opt.value = item.cmd;
        opt.textContent = tr(item.label);
        optgroup.append(opt);
      }
      refs.tbAction.append(optgroup);
    }

    if (pluginCmds.length) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = tr('Команды плагинов');
      for (const cmd of pluginCmds) {
        const opt = document.createElement('option');
        opt.value = cmd.id;
        opt.textContent = `${cmd.title} · ${cmd.pluginName}`;
        optgroup.append(opt);
      }
      refs.tbAction.append(optgroup);
    }

    refs.tbAction.value = prev || 'screenshot';
  }

  function syncTopbarDraftForm(refs) {
    if (!refs.tbAction) return;
    const cmd = refs.tbAction.value;
    if (refs.tbUrlRow) refs.tbUrlRow.hidden = cmd !== 'openUrl';
    if (refs.tbIconType && document.activeElement !== refs.tbIconType) {
      refs.tbIconType.value = draftBtnIconType;
    }
    if (refs.tbIconPresetWrap) refs.tbIconPresetWrap.hidden = draftBtnIconType !== 'preset';
    if (refs.tbIconEmojiWrap) refs.tbIconEmojiWrap.hidden = draftBtnIconType !== 'emoji';
    if (refs.tbIconFileWrap) refs.tbIconFileWrap.hidden = draftBtnIconType !== 'file';

    if (refs.tbIconGrid) {
      for (const btn of refs.tbIconGrid.children) {
        btn.classList.toggle(
          'is-active',
          draftBtnIconType === 'preset' && btn.dataset.tbIconPreset === draftBtnIconValue,
        );
      }
    }
    if (refs.tbIconEmoji && document.activeElement !== refs.tbIconEmoji) {
      refs.tbIconEmoji.value = draftBtnIconType === 'emoji' ? draftBtnIconValue : '';
    }

    const activeId = editingTopbarId || draftBtnId;
    const pending = currentAppState?.pendingTopbarIcon;
    const existing = editingTopbarId
      ? currentTopbarButtons.find((item) => item.id === editingTopbarId)
      : null;
    if (refs.tbIconFileName) {
      const fileLabel =
        pending && pending.id === activeId
          ? pending.fileName
          : existing && existing.iconType === 'file'
            ? existing.iconValue
            : tr('Файл не выбран');
      refs.tbIconFileName.textContent = fileLabel;
    }

    if (refs.tbSubmit) {
      refs.tbSubmit.textContent = editingTopbarId ? tr('Сохранить кнопку') : tr('Добавить кнопку');
    }
    if (refs.tbCancelEdit) {
      refs.tbCancelEdit.hidden = !editingTopbarId;
    }
  }

  function resetTopbarDraft(refs) {
    editingTopbarId = '';
    draftBtnId = `tb_${Date.now().toString(36)}`;
    draftBtnIconType = 'preset';
    draftBtnIconValue = TOPBAR_ACTION_MAP.get(refs.tbAction?.value)?.icon || 'camera';
    if (refs.tbLabel) refs.tbLabel.value = '';
    if (refs.tbTooltip) refs.tbTooltip.value = '';
    if (refs.tbUrl) refs.tbUrl.value = '';
    if (refs.tbSlot) refs.tbSlot.value = 'extra';
    syncTopbarDraftForm(refs);
  }

  function renderTopbarManager(refs) {
    if (refs.tbBuiltinChips) {
      refs.tbBuiltinChips.replaceChildren(
        ...TOPBAR_BUILTIN_ITEMS.map((item) => {
          const isHidden = currentMap[item.id]?.hidden === true;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `tb-builtin-chip${isHidden ? ' is-off' : ' is-on'}`;
          btn.dataset.tbToggleBuiltin = item.id;
          btn.setAttribute('aria-pressed', String(!isHidden));
          btn.textContent = tr(item.label);
          return btn;
        }),
      );
    }

    if (refs.tbCustomList) {
      refs.tbCustomList.replaceChildren(
        ...currentTopbarButtons.map((btn, index) => {
          const row = document.createElement('div');
          row.className = 'tb-custom-row';
          row.dataset.tbRowId = btn.id;

          const iconWrap = document.createElement('span');
          iconWrap.className = 'tb-custom-ico';
          if (btn.iconType === 'preset') {
            const svg = core.buildSvgIcon(btn.iconValue || 'sparkle');
            if (svg) iconWrap.append(svg);
          } else if (btn.iconType === 'emoji') {
            iconWrap.textContent = btn.iconValue || '✨';
          } else if (btn.iconType === 'file' && btn.iconDataUrl) {
            const img = document.createElement('img');
            img.src = btn.iconDataUrl;
            img.alt = '';
            iconWrap.append(img);
          } else {
            iconWrap.textContent = '•';
          }

          const info = document.createElement('div');
          info.className = 'tb-custom-info';
          const title = document.createElement('span');
          title.className = 'tb-custom-title';
          title.textContent = btn.label || btn.tooltip || actionDisplayName(btn, currentAppState);
          const sub = document.createElement('span');
          sub.className = 'tb-custom-sub';
          sub.textContent = actionDisplayName(btn, currentAppState);
          info.append(title, sub);

          const actions = document.createElement('div');
          actions.className = 'tb-custom-actions';

          const mkBtn = (text, act, titleText, disabled = false) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tb-mini-btn';
            b.dataset.tbAct = act;
            b.dataset.tbId = btn.id;
            b.title = tr(titleText);
            b.setAttribute('aria-label', tr(titleText));
            b.textContent = text;
            b.disabled = disabled;
            return b;
          };

          actions.append(
            mkBtn('↑', 'up', 'Выше', index === 0),
            mkBtn('↓', 'down', 'Ниже', index === currentTopbarButtons.length - 1),
            mkBtn('✎', 'edit', 'Изменить'),
            mkBtn('🎨', 'style', 'Оформление'),
            mkBtn('✕', 'remove', 'Удалить'),
          );

          row.append(iconWrap, info, actions);
          return row;
        }),
      );
    }

    if (refs.tbCustomEmpty) refs.tbCustomEmpty.hidden = currentTopbarButtons.length > 0;
    if (refs.tbResetAll) refs.tbResetAll.disabled = currentTopbarButtons.length === 0;
    syncTopbarDraftForm(refs);
  }

  // --- Интерактивный выбор элемента кликом ----------------------------------

  function updatePickerHighlight(target) {
    const refs = editorRefs();
    if (!refs.pickerHighlight || !refs.pickerTag) return;
    if (!target) {
      refs.pickerHighlight.hidden = true;
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      refs.pickerHighlight.hidden = true;
      return;
    }
    refs.pickerHighlight.hidden = false;
    refs.pickerHighlight.style.left = `${Math.round(rect.left)}px`;
    refs.pickerHighlight.style.top = `${Math.round(rect.top)}px`;
    refs.pickerHighlight.style.width = `${Math.round(rect.width)}px`;
    refs.pickerHighlight.style.height = `${Math.round(rect.height)}px`;

    const compId = target.dataset.uiCompId || '';
    const pageId = target.dataset.uiPageId || '';
    const catalog = core.collectCatalog(false);
    const meta = catalog.byId.get(compId);
    const pageTitle = core.PAGE_LIST.find((p) => p.id === pageId)?.label || pageId;
    const text = meta ? `${tr(pageTitle)} → ${tr(meta.label)}` : compId;
    refs.pickerTag.textContent = text;
    if (refs.pickerStatus) refs.pickerStatus.textContent = text;
  }

  function findPickableTarget(rawTarget) {
    if (!rawTarget || rawTarget.nodeType !== 1) return null;
    if (rawTarget.closest('#compPickerBar, #compPickerHighlight')) return null;

    // Если кликнули по кастомному триггеру <select>, сопоставляем со скрытым <select>.
    const selectWrap = rawTarget.closest('.octo-select');
    if (selectWrap) {
      const nativeSelect = selectWrap.querySelector('select[data-ui-comp-id]');
      if (nativeSelect) return nativeSelect;
    }

    const hit = rawTarget.closest('[data-ui-comp-id]');
    if (!hit) return null;
    return hit;
  }

  function onPickerPointerMove(event) {
    if (!pickerActive) return;
    const target = findPickableTarget(event.target);
    if (target === pickerHoveredEl) return;
    pickerHoveredEl = target;
    updatePickerHighlight(target);
  }

  function onPickerClick(event) {
    if (!pickerActive) return;
    if (event.target.closest('#compPickerBar')) return;
    if (event.altKey) return;

    const target = findPickableTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();

    const compId = target.dataset.uiCompId;
    const pageId = target.dataset.uiPageId || 'all';
    stopPicker(true);
    if (compId) {
      selectedPage = pageId;
      selectedId = compId;
      compFilterQuery = '';
      const refs = editorRefs();
      if (refs.searchInput) refs.searchInput.value = '';
      if (refs.pageSelect) refs.pageSelect.value = selectedPage;
      pendingIconType = '';
      pendingFontPreset = '';
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
    }
  }

  function onPickerKeyDown(event) {
    if (!pickerActive) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stopPicker(true);
    }
  }

  function startPicker() {
    if (pickerActive) return;
    core.collectCatalog(true);
    pickerActive = true;
    pickerHoveredEl = null;
    window.octo?.cmd('uiPickerActive', true);

    const refs = editorRefs();
    const panel = $('panel');
    const minimizeByDefault =
      selectedPage === 'titlebar' ||
      selectedPage === 'sidenav' ||
      selectedPage === 'findbar' ||
      selectedPage === 'minibars';
    if (panel) panel.classList.toggle('is-picker-minimized', minimizeByDefault);
    if (refs.pickerBar) refs.pickerBar.hidden = false;
    if (refs.pickerTogglePanel && panel) {
      refs.pickerTogglePanel.textContent = panel.classList.contains('is-picker-minimized')
        ? tr('Показать панель')
        : tr('Скрыть панель');
    }
    if (refs.pickerStatus) {
      refs.pickerStatus.textContent = tr('Кликните на любой элемент · Alt+клик нажимает кнопку');
    }

    document.addEventListener('pointermove', onPickerPointerMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeyDown, true);
  }

  function stopPicker(restorePanel = true) {
    if (!pickerActive) return;
    pickerActive = false;
    pickerHoveredEl = null;
    window.octo?.cmd('uiPickerActive', false);

    document.removeEventListener('pointermove', onPickerPointerMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeyDown, true);

    const refs = editorRefs();
    if (refs.pickerBar) refs.pickerBar.hidden = true;
    if (refs.pickerHighlight) refs.pickerHighlight.hidden = true;
    if (restorePanel) $('panel')?.classList.remove('is-picker-minimized');
  }

  function bindEditor() {
    if (editorBound) return;
    const refs = editorRefs();
    if (!refs.select) return;
    editorBound = true;

    core.collectCatalog(true);
    populatePageSelect(refs);
    populateComponentSelect(refs);
    populateIconGrids(refs);
    populateTopbarActions(refs, currentAppState);

    // --- Конструктор кнопок верхней полосы ---
    refs.tbBuiltinChips?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tb-toggle-builtin]');
      if (!btn) return;
      const id = btn.dataset.tbToggleBuiltin;
      const nextHidden = !(currentMap[id]?.hidden === true);
      const nextLocal = { ...(currentMap[id] || {}), hidden: nextHidden };
      currentMap = { ...currentMap, [id]: nextLocal };
      window.octo?.cmd('uiCustomSet', { id, patch: { hidden: nextHidden } });
    });

    refs.tbCustomList?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tb-act]');
      if (!btn) return;
      const act = btn.dataset.tbAct;
      const id = btn.dataset.tbId;
      if (!id) return;
      if (act === 'up') window.octo?.cmd('topbarButtonMove', { id, dir: -1 });
      else if (act === 'down') window.octo?.cmd('topbarButtonMove', { id, dir: 1 });
      else if (act === 'remove') {
        if (editingTopbarId === id) resetTopbarDraft(refs);
        window.octo?.cmd('topbarButtonRemove', id);
      } else if (act === 'style') {
        selectedPage = 'titlebar';
        selectedId = `customBtn:${id}`;
        if (refs.pageSelect) refs.pageSelect.value = 'titlebar';
        renderEditor(currentMap, currentTopbarButtons, currentAppState);
      } else if (act === 'edit') {
        const entry = currentTopbarButtons.find((item) => item.id === id);
        if (!entry) return;
        editingTopbarId = id;
        if (refs.tbAction) refs.tbAction.value = entry.cmd;
        if (refs.tbUrl) refs.tbUrl.value = entry.cmd === 'openUrl' ? entry.payload || '' : '';
        if (refs.tbLabel) refs.tbLabel.value = entry.label || '';
        if (refs.tbTooltip) refs.tbTooltip.value = entry.tooltip || '';
        if (refs.tbSlot) refs.tbSlot.value = entry.slot || 'extra';
        draftBtnIconType = entry.iconType || 'preset';
        draftBtnIconValue = entry.iconValue || 'sparkle';
        syncTopbarDraftForm(refs);
      }
    });

    refs.tbAction?.addEventListener('change', () => {
      const info = TOPBAR_ACTION_MAP.get(refs.tbAction.value);
      if (!editingTopbarId && info?.icon && draftBtnIconType === 'preset') {
        draftBtnIconValue = info.icon;
      }
      syncTopbarDraftForm(refs);
    });

    refs.tbIconType?.addEventListener('change', () => {
      draftBtnIconType = refs.tbIconType.value;
      if (draftBtnIconType === 'preset' && !draftBtnIconValue) draftBtnIconValue = 'sparkle';
      syncTopbarDraftForm(refs);
    });

    refs.tbIconGrid?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tb-icon-preset]');
      if (!btn) return;
      draftBtnIconType = 'preset';
      draftBtnIconValue = btn.dataset.tbIconPreset;
      syncTopbarDraftForm(refs);
    });

    refs.tbEmojiChips?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tb-emoji]');
      if (!btn) return;
      draftBtnIconType = 'emoji';
      draftBtnIconValue = btn.dataset.tbEmoji;
      syncTopbarDraftForm(refs);
    });

    refs.tbIconEmoji?.addEventListener('input', () => {
      draftBtnIconType = 'emoji';
      draftBtnIconValue = refs.tbIconEmoji.value.trim();
    });

    refs.tbIconPickBtn?.addEventListener('click', () => {
      draftBtnIconType = 'file';
      const targetId = editingTopbarId || draftBtnId;
      window.octo?.cmd('topbarButtonIconPick', { id: targetId });
      syncTopbarDraftForm(refs);
    });

    refs.tbSubmit?.addEventListener('click', () => {
      const cmd = refs.tbAction?.value || 'screenshot';
      const urlVal = refs.tbUrl?.value.trim() || '';
      if (cmd === 'openUrl' && !urlVal) {
        refs.tbUrl?.focus();
        return;
      }
      const label = refs.tbLabel?.value.trim() || '';
      const tooltip = refs.tbTooltip?.value.trim() || '';
      const slot = refs.tbSlot?.value || 'extra';
      const iconType = draftBtnIconType;
      const activeId = editingTopbarId || draftBtnId;
      const pending = currentAppState?.pendingTopbarIcon;
      let iconValue = draftBtnIconValue;
      if (iconType === 'emoji') iconValue = refs.tbIconEmoji?.value.trim() || draftBtnIconValue;
      else if (iconType === 'file') {
        iconValue =
          pending && pending.id === activeId ? pending.fileName : draftBtnIconValue || 'icon.png';
      }

      const payloadObj = {
        id: activeId,
        cmd,
        payload: cmd === 'openUrl' ? urlVal : undefined,
        label,
        tooltip,
        slot,
        iconType,
        iconValue,
      };

      if (editingTopbarId) {
        window.octo?.cmd('topbarButtonUpdate', { id: editingTopbarId, patch: payloadObj });
      } else {
        window.octo?.cmd('topbarButtonAdd', payloadObj);
      }
      resetTopbarDraft(refs);
    });

    refs.tbCancelEdit?.addEventListener('click', () => resetTopbarDraft(refs));
    refs.tbResetAll?.addEventListener('click', () => {
      resetTopbarDraft(refs);
      window.octo?.cmd('topbarButtonsReset');
    });

    // --- Выбор страницы, фильтрация и пипетка ---
    refs.pageSelect?.addEventListener('change', () => {
      selectedPage = refs.pageSelect.value || 'all';
      pendingIconType = '';
      pendingFontPreset = '';
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
    });

    refs.searchInput?.addEventListener('input', () => {
      compFilterQuery = refs.searchInput.value;
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
    });

    refs.pickElementBtn?.addEventListener('click', startPicker);
    refs.pickerCancel?.addEventListener('click', () => stopPicker(true));
    refs.pickerTogglePanel?.addEventListener('click', () => {
      const panel = $('panel');
      if (!panel) return;
      panel.classList.toggle('is-picker-minimized');
      if (refs.pickerTogglePanel) {
        refs.pickerTogglePanel.textContent = panel.classList.contains('is-picker-minimized')
          ? tr('Показать панель')
          : tr('Скрыть панель');
      }
    });

    // --- Основной редактор выбранного элемента ---
    refs.select.addEventListener('change', () => {
      selectedId = refs.select.value;
      pendingIconType = '';
      pendingFontPreset = '';
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
    });

    refs.chips?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-comp-chip]');
      if (!chip) return;
      const targetId = chip.dataset.compChip;
      const meta = core.collectCatalog(false).byId.get(targetId);
      if (meta && selectedPage !== 'all' && meta.page !== selectedPage) {
        selectedPage = meta.page;
        if (refs.pageSelect) refs.pageSelect.value = selectedPage;
      }
      selectedId = targetId;
      pendingIconType = '';
      pendingFontPreset = '';
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
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
        sendPatch({ iconType: 'preset', iconValue: curVal || core.ICON_PRESETS[0].id });
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
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
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
        renderEditor(currentMap, currentTopbarButtons, currentAppState);
      });
      picker?.addEventListener('input', () => {
        const val = picker.value;
        activeCompColorRole = fieldKey;
        if (hexInput) hexInput.value = val;
        sendPatch({ [fieldKey]: val });
      });
      hexInput?.addEventListener('focus', () => {
        activeCompColorRole = fieldKey;
        renderEditor(currentMap, currentTopbarButtons, currentAppState);
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
      renderEditor(currentMap, currentTopbarButtons, currentAppState);
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
    core.applyComponentFont(meta.id, box, cfg);

    refs.previewIcon.replaceChildren();
    refs.previewIcon.hidden = false;
    if (!meta.supportsIcon || cfg.iconType === 'none') {
      refs.previewIcon.hidden = true;
    } else if (cfg.iconType === 'preset' && cfg.iconValue) {
      const svg = core.buildSvgIcon(cfg.iconValue);
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
      const svg = core.buildSvgIcon('sparkle');
      if (svg) refs.previewIcon.append(svg);
    }
    if (cfg.iconSize > 0) {
      refs.previewIcon.style.setProperty('--octo-comp-icon-size', `${cfg.iconSize}px`);
    } else {
      refs.previewIcon.style.removeProperty('--octo-comp-icon-size');
    }

    const previewText = cfg.label || meta.defaultLabel || tr(meta.label);
    refs.previewLabel.textContent = previewText;
    box.classList.toggle('is-hidden-preview', cfg.hidden === true);
  }

  function renderEditor(customMap, topbarButtons, appState) {
    currentMap = customMap && typeof customMap === 'object' ? customMap : {};
    if (Array.isArray(topbarButtons)) currentTopbarButtons = topbarButtons;
    if (appState && typeof appState === 'object') currentAppState = appState;
    if (currentAppState && currentAppState.panel === false) return;

    bindEditor();
    const refs = editorRefs();
    if (!refs.select) return;

    readThemeDefaults();
    populateTopbarActions(refs, currentAppState);
    renderTopbarManager(refs);
    populateComponentSelect(refs);

    const catalog = core.collectCatalog(false);
    const meta = catalog.byId.get(selectedId) || catalog.list[0];
    if (!meta) return;
    selectedId = meta.id;

    if (document.activeElement !== refs.pageSelect && refs.pageSelect) {
      refs.pageSelect.value = selectedPage;
    }
    if (document.activeElement !== refs.select) {
      refs.select.value = selectedId;
    }

    const cfg = currentMap[selectedId] || {};

    if (refs.chips) {
      const modifiedIds = Object.keys(currentMap);
      refs.chips.hidden = modifiedIds.length === 0;
      refs.chips.replaceChildren(
        ...modifiedIds.map((id) => {
          const itemMeta = catalog.byId.get(id);
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
      const canHide =
        meta.id !== 'titlebar' &&
        meta.id !== 'panel' &&
        meta.id !== 'win:downloads:winbar' &&
        meta.id !== 'win:annotator:winbar' &&
        meta.id !== 'win:update:card';
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
    ICON_PRESETS: core.ICON_PRESETS,
    colorHelpers: {
      normalizeHex: normalizeHexInput,
      hexToHsl,
      hslToHex,
      paintSlider,
      paintHslSliders,
    },
    apply: core.applyAll,
    renderTopbarButtons,
    renderEditor,
    getPageTitle: core.getPageTitle,
    isPicking: () => pickerActive,
  };
})();
