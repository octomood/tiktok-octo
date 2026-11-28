'use strict';

/**
 * Ядро покомпонентной кастомизации интерфейса TikTok Octo.
 *
 * Индексирует все страницы и элементы оболочки (главное окно, боковое меню,
 * все разделы настроек, менеджер плагинов, быстрые меню, экраны, диалоги и
 * отдельные окна), а также применяет сохранённые стили к любому окну renderer.
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
      id: 'download',
      label: 'Загрузка',
      paths: [
        ['path', 'M12 3v12'],
        ['path', 'm7 10 5 5 5-5'],
        ['path', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'],
      ],
    },
    {
      id: 'bookmark',
      label: 'Закладка',
      paths: [['path', 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z']],
    },
    {
      id: 'clock',
      label: 'Часы',
      paths: [
        ['circle', { cx: 12, cy: 12, r: 9 }],
        ['path', 'M12 7v5l3 2'],
      ],
    },
    {
      id: 'maximize',
      label: 'Экран',
      paths: [
        [
          'path',
          'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3',
        ],
      ],
    },
    {
      id: 'link',
      label: 'Ссылка',
      paths: [
        ['path', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'],
        ['path', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
      ],
    },
    {
      id: 'qr',
      label: 'QR-код',
      paths: [
        ['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }],
        ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }],
        ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }],
        ['path', 'M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 21h3'],
      ],
    },
    {
      id: 'play',
      label: 'Плей',
      paths: [['path', 'M6 4.5 19 12 6 19.5z']],
    },
    {
      id: 'skip-back',
      label: 'Пред. видео',
      paths: [
        ['path', 'M19 19 9 12l10-7z'],
        ['path', 'M5 5v14'],
      ],
    },
    {
      id: 'skip-next',
      label: 'След. видео',
      paths: [
        ['path', 'M5 5l10 7-10 7z'],
        ['path', 'M19 5v14'],
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

  const LEGACY_BY_ELEMENT = new Map([
    ['titlebar', 'titlebar'],
    ['pagePill', 'pagePill'],
    ['panelDialog', 'panel'],
    ['pluginsDialog', 'pluginsPanel'],
    ['popover', 'popover'],
    ['findbar', 'findbar'],
    ['pipbar', 'pipbar'],
    ['baronly', 'baronly'],
  ]);

  const LEGACY_LABELS = {
    titlebar: 'Верхняя полоса',
    brand: 'Логотип и название',
    btnBack: 'Кнопка «Назад»',
    btnForward: 'Кнопка «Вперёд»',
    btnReload: 'Кнопка «Обновить»',
    btnHome: 'Кнопка «Главная»',
    pagePill: 'Пилюля страницы',
    btnPip: 'Кнопка «Картинка в картинке»',
    btnMute: 'Кнопка «Звук»',
    btnTop: 'Кнопка «Поверх всех окон»',
    btnStickers: 'Кнопка «Картинки в чат»',
    btnPluginsActive: 'Кнопка «Активные плагины»',
    btnChat: 'Кнопка «Сообщения сбоку»',
    btnPanel: 'Кнопка «Настройки»',
    btnMin: 'Кнопка «Свернуть»',
    btnMax: 'Кнопка «Развернуть»',
    btnClose: 'Кнопка «Закрыть»',
    panel: 'Окно настроек',
    pluginsPanel: 'Менеджер плагинов',
    palette: 'Палитра команд',
    popover: 'Быстрые меню (стикеры / плагины)',
    findbar: 'Панель поиска',
    pipbar: 'Мини-панель PiP',
    baronly: 'Режим «Только полоса»',
  };

  const SETTINGS_PAGE_TITLES = [
    ['page', 'Настройки · Страница'],
    ['picture', 'Настройки · Картинка'],
    ['filters', 'Настройки · Фильтры'],
    ['ads', 'Настройки · Реклама'],
    ['playback', 'Настройки · Воспроизведение'],
    ['player', 'Настройки · Плеер и звук'],
    ['gif', 'Настройки · Экспорт GIF'],
    ['keys', 'Настройки · Клавиши и сочетания'],
    ['focus', 'Настройки · Фокус-режим'],
    ['notify', 'Настройки · Уведомления'],
    ['replies', 'Настройки · Быстрые ответы'],
    ['library', 'Настройки · Библиотека'],
    ['stats', 'Настройки · Статистика'],
    ['downloads', 'Настройки · Загрузки'],
    ['cosmetics', 'Настройки · Оформление'],
    ['components', 'Настройки · Компоненты'],
    ['custom', 'Настройки · Свой CSS и JS'],
    ['region', 'Настройки · Регион и прокси'],
    ['language', 'Настройки · Язык'],
    ['plugins', 'Настройки · Плагины'],
    ['data', 'Настройки · Данные и профили'],
    ['privacy', 'Настройки · Приватность'],
    ['app', 'Настройки · Приложение'],
    ['experimental', 'Настройки · Эксперименты'],
  ];

  /** Описания элементов отдельных дочерних окон для редактора и синхронизации. */
  const CHILD_WINDOW_ELEMENTS = [
    // Менеджер загрузок (downloads.html)
    {
      id: 'win:downloads:winbar',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.octo-winbar',
      label: 'Верхняя полоса окна',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:brand',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.octo-winbar-brand',
      label: 'Заголовок в полосе окна',
      defaultLabel: 'Менеджер загрузок',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:controls',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.octo-winbar-controls',
      label: 'Блок кнопок окна',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:btnMin',
      page: 'winDownloads',
      win: 'downloads',
      selector: '[data-win-act="minimize"]',
      label: 'Кнопка «Свернуть»',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:btnMax',
      page: 'winDownloads',
      win: 'downloads',
      selector: '[data-win-act="maximize"]',
      label: 'Кнопка «Развернуть»',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:btnClose',
      page: 'winDownloads',
      win: 'downloads',
      selector: '[data-win-act="close"]',
      label: 'Кнопка «Закрыть окно»',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:head',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.manager-head',
      label: 'Шапка списка загрузок',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:title',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.manager-title',
      label: 'Заголовок страницы',
      defaultLabel: 'Менеджер загрузок',
      supportsLabel: true,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:openFolder',
      page: 'winDownloads',
      win: 'downloads',
      selector: '#btnOpenFolder',
      label: 'Кнопка «Открыть папку загрузок»',
      defaultLabel: 'Открыть папку загрузок',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:clear',
      page: 'winDownloads',
      win: 'downloads',
      selector: '#btnClear',
      label: 'Кнопка «Очистить список»',
      defaultLabel: 'Очистить список',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:closeBtn',
      page: 'winDownloads',
      win: 'downloads',
      selector: '#btnClose',
      label: 'Кнопка «Закрыть»',
      defaultLabel: 'Закрыть',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:downloads:row',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.manager-row',
      all: true,
      label: 'Карточка загрузки',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:rowBtn',
      page: 'winDownloads',
      win: 'downloads',
      selector: '.manager-btn--small',
      all: true,
      label: 'Кнопки действий в карточке',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:downloads:empty',
      page: 'winDownloads',
      win: 'downloads',
      selector: '#managerEmpty',
      label: 'Текст «Пока ничего не скачано»',
      defaultLabel: 'Пока ничего не скачано',
      supportsLabel: true,
      supportsIcon: false,
    },

    // Окно обновления (update.html)
    {
      id: 'win:update:card',
      page: 'winUpdate',
      win: 'update',
      selector: '.update-card',
      label: 'Карточка обновления',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:update:head',
      page: 'winUpdate',
      win: 'update',
      selector: '.update-head',
      label: 'Шапка окна обновления',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:update:brand',
      page: 'winUpdate',
      win: 'update',
      selector: '.update-brand',
      label: 'Логотип и заголовок',
      supportsLabel: false,
      supportsIcon: true,
    },
    {
      id: 'win:update:title',
      page: 'winUpdate',
      win: 'update',
      selector: '#updateTitle',
      label: 'Заголовок «Обновление приложения»',
      defaultLabel: 'Обновление приложения',
      supportsLabel: true,
      supportsIcon: false,
    },
    {
      id: 'win:update:btnClose',
      page: 'winUpdate',
      win: 'update',
      selector: '#btnClose',
      label: 'Кнопка закрытия (×)',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:update:message',
      page: 'winUpdate',
      win: 'update',
      selector: '#updateMessage',
      label: 'Статус версии',
      supportsLabel: true,
      supportsIcon: false,
    },
    {
      id: 'win:update:hint',
      page: 'winUpdate',
      win: 'update',
      selector: '#updateHint',
      label: 'Пояснение под статусом',
      supportsLabel: true,
      supportsIcon: false,
    },
    {
      id: 'win:update:progress',
      page: 'winUpdate',
      win: 'update',
      selector: '#updateBar',
      label: 'Полоса прогресса загрузки',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:update:btnLater',
      page: 'winUpdate',
      win: 'update',
      selector: '#btnLater',
      label: 'Кнопка «Позже»',
      defaultLabel: 'Позже',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:update:btnAction',
      page: 'winUpdate',
      win: 'update',
      selector: '#btnAction',
      label: 'Кнопка «Обновить / Перезапустить»',
      defaultLabel: 'Обновить',
      supportsLabel: true,
      supportsIcon: true,
    },

    // Окно аннотаций (annotator.html)
    {
      id: 'win:annotator:winbar',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '.octo-winbar',
      label: 'Верхняя полоса окна',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:annotator:bar',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '.annotator-bar',
      label: 'Панель инструментов',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:annotator:title',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '.annotator-title',
      label: 'Заголовок панели',
      defaultLabel: 'Снимок с аннотацией',
      supportsLabel: true,
      supportsIcon: false,
    },
    {
      id: 'win:annotator:arrow',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '[data-tool="arrow"]',
      label: 'Инструмент «Стрелка»',
      defaultLabel: 'Стрелка',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:rect',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '[data-tool="rect"]',
      label: 'Инструмент «Рамка»',
      defaultLabel: 'Рамка',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:blur',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '[data-tool="blur"]',
      label: 'Инструмент «Размытие»',
      defaultLabel: 'Размытие',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:undo',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '#btnUndo',
      label: 'Кнопка «Отменить»',
      defaultLabel: 'Отменить',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:clear',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '#btnClear',
      label: 'Кнопка «Очистить»',
      defaultLabel: 'Очистить',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:closeBtn',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '#btnClose',
      label: 'Кнопка «Закрыть»',
      defaultLabel: 'Закрыть',
      supportsLabel: true,
      supportsIcon: true,
    },
    {
      id: 'win:annotator:saveBtn',
      page: 'winAnnotator',
      win: 'annotator',
      selector: '#btnSave',
      label: 'Кнопка «Сохранить»',
      defaultLabel: 'Сохранить',
      supportsLabel: true,
      supportsIcon: true,
    },

    // Контекстное меню (context-menu.html)
    {
      id: 'win:ctx:menu',
      page: 'winContextMenu',
      win: 'ctx',
      selector: '#ctxMenu',
      label: 'Контейнер контекстного меню',
      supportsLabel: false,
      supportsIcon: false,
    },
    {
      id: 'win:ctx:item',
      page: 'winContextMenu',
      win: 'ctx',
      selector: '.ctx-item',
      all: true,
      label: 'Пункты контекстного меню',
      supportsLabel: false,
      supportsIcon: true,
    },
    {
      id: 'win:ctx:sep',
      page: 'winContextMenu',
      win: 'ctx',
      selector: '.ctx-sep',
      all: true,
      label: 'Разделитель в меню',
      supportsLabel: false,
      supportsIcon: false,
    },
  ];

  const CHILD_WINDOW_MAP = new Map(CHILD_WINDOW_ELEMENTS.map((item) => [item.id, item]));

  const PAGE_LIST = [
    { id: 'titlebar', label: 'Верхняя полоса' },
    { id: 'sidenav', label: 'Боковое меню' },
    { id: 'panelChrome', label: 'Окно настроек (шапка и меню)' },
    ...SETTINGS_PAGE_TITLES.map(([cat, title]) => ({ id: `settings:${cat}`, label: title })),
    { id: 'pluginsPanel', label: 'Менеджер плагинов' },
    { id: 'popovers', label: 'Быстрые меню (стикеры / плагины)' },
    { id: 'palette', label: 'Палитра команд' },
    { id: 'findbar', label: 'Поиск по странице' },
    { id: 'minibars', label: 'Мини-режимы (PiP и Только полоса)' },
    { id: 'screens', label: 'Экраны (загрузка, офлайн, мастер)' },
    { id: 'dialogs', label: 'Диалоги (приложение и плагины)' },
    { id: 'winDownloads', label: 'Окно «Менеджер загрузок»' },
    { id: 'winUpdate', label: 'Окно «Обновление приложения»' },
    { id: 'winAnnotator', label: 'Окно «Аннотатор снимка»' },
    { id: 'winContextMenu', label: 'Контекстное меню' },
  ];

  function detectChildWindowKey() {
    const body = document.body;
    if (!body) return '';
    if (body.classList.contains('manager')) return 'downloads';
    if (body.classList.contains('update')) return 'update';
    if (body.classList.contains('annotator')) return 'annotator';
    if (body.classList.contains('ctx-menu-host')) return 'ctx';
    if (body.classList.contains('dialog-standalone')) return 'dialog';
    return '';
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

  function slugText(raw) {
    return String(raw || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32);
  }

  function shortText(raw, maxLen = 44) {
    const clean = String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return '';
    return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
  }

  function elementRolePrefix(node) {
    const tag = node.tagName;
    if (tag === 'BUTTON') {
      if (node.getAttribute('role') === 'switch') return 'Переключатель';
      return 'Кнопка';
    }
    if (tag === 'INPUT') {
      if (node.type === 'range') return 'Ползунок';
      return 'Поле';
    }
    if (tag === 'TEXTAREA') return 'Поле';
    if (tag === 'SELECT') return 'Список';
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') return 'Заголовок';
    if (tag === 'KBD') return 'Клавиша';
    if (tag === 'P') return 'Текст';
    return '';
  }

  function deriveNodeLabel(compId, node) {
    if (LEGACY_LABELS[compId]) return LEGACY_LABELS[compId];
    if (node.dataset?.customBtnLabel) return node.dataset.customBtnLabel;
    if (node.classList.contains('nav')) return 'Группа кнопок навигации';
    if (node.classList.contains('actions')) return 'Группа кнопок режимов';
    if (node.classList.contains('tools') && !node.classList.contains('custom-tools')) {
      return 'Группа инструментов';
    }
    if (node.classList.contains('custom-tools')) return 'Группа своих кнопок';
    if (node.classList.contains('win-controls')) return 'Группа кнопок окна';
    if (node.classList.contains('brand-mark')) return 'Значок логотипа';
    if (node.classList.contains('pill-icon')) return 'Иконка пилюли';
    if (node.classList.contains('status-dot')) return 'Индикатор статуса';
    if (node.classList.contains('progress')) return 'Полоса загрузки страницы';
    if (node.classList.contains('download')) return 'Полоса скачивания';
    if (node.classList.contains('panel-head')) return 'Шапка окна настроек';
    if (node.classList.contains('panel-brand')) return 'Логотип в шапке настроек';
    if (node.classList.contains('panel-search')) return 'Строка поиска настроек';
    if (node.classList.contains('app-sidenav-head')) return 'Шапка бокового меню';
    if (node.classList.contains('app-sidenav-brand')) return 'Бренд в боковом меню';
    if (node.classList.contains('app-sidenav-search')) return 'Поле поиска в боковом меню';
    if (node.classList.contains('palette-search')) return 'Строка поиска палитры';
    if (node.classList.contains('palette-list')) return 'Список команд палитры';
    if (node.classList.contains('palette-foot')) return 'Подсказка внизу палитры';
    if (node.classList.contains('offline-card')) return 'Карточка офлайна';
    if (node.classList.contains('welcome-card')) return 'Карточка мастера настройки';
    if (node.classList.contains('app-dialog-card')) return 'Карточка диалога приложения';
    if (node.classList.contains('plugin-dialog-card')) return 'Карточка диалога плагина';
    if (node.classList.contains('telegram-panel')) return 'Карточка «Плагины в Telegram»';

    const labelEl = node.querySelector(
      ':scope > .panel-row-label, :scope > .panel-field-label, :scope > .panel-cat-title, :scope > .app-sidenav-label, :scope > .settings-label, :scope > .quick-panel-title, :scope > span:not(.switch):not(.octo-custom-icon)',
    );
    const labelText = shortText(labelEl?.textContent);
    if (labelText) {
      const prefix = elementRolePrefix(node);
      return prefix && !labelText.toLowerCase().startsWith(prefix.toLowerCase())
        ? `${prefix} «${labelText}»`
        : labelText;
    }

    if (node.id) {
      const explicitLabel = document.querySelector(`label[for="${node.id}"]`);
      const forText = shortText(explicitLabel?.textContent);
      if (forText) {
        const prefix = elementRolePrefix(node);
        return prefix ? `${prefix}: ${forText}` : forText;
      }
    }

    const attrText = shortText(
      node.getAttribute('aria-label') ||
        node.getAttribute('title') ||
        node.getAttribute('placeholder'),
    );
    if (attrText) {
      const prefix = elementRolePrefix(node);
      return prefix && !attrText.toLowerCase().startsWith(prefix.toLowerCase())
        ? `${prefix} «${attrText}»`
        : attrText;
    }

    const text = shortText(node.textContent);
    if (text) {
      const prefix = elementRolePrefix(node);
      return prefix ? `${prefix} «${text}»` : text;
    }

    return compId;
  }

  function hasIconSupport(compId, node) {
    if (
      compId === 'titlebar' ||
      compId === 'panel' ||
      compId === 'pluginsPanel' ||
      compId === 'popover' ||
      compId === 'findbar' ||
      compId === 'pipbar' ||
      compId === 'baronly'
    ) {
      return false;
    }
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
      return false;
    }
    if (
      node.tagName === 'BUTTON' ||
      node.classList.contains('brand') ||
      node.classList.contains('page-pill') ||
      node.classList.contains('palette-card') ||
      Boolean(
        node.querySelector(
          ':scope > svg, :scope > img, :scope > .app-sidenav-icon, :scope > .panel-cat-icon',
        ),
      )
    ) {
      return true;
    }
    return false;
  }

  function hasLabelSupport(compId, node) {
    if (compId === 'titlebar' || compId === 'popover') return false;
    if (
      node.classList.contains('progress') ||
      node.classList.contains('download') ||
      node.classList.contains('status-dot')
    ) {
      return false;
    }
    if (node.tagName === 'SELECT') return false;
    if (node.tagName === 'INPUT' && node.type === 'range') return false;
    if (node.tagName === 'INPUT' && node.type === 'color') return false;
    return true;
  }

  function deriveStableId(pageId, node, counters) {
    if (node.id && LEGACY_BY_ELEMENT.has(node.id)) {
      return LEGACY_BY_ELEMENT.get(node.id);
    }
    if (node.classList.contains('brand') && node.closest('#titlebar')) return 'brand';
    if (node.classList.contains('palette-card') && node.closest('#palette')) return 'palette';
    if (node.dataset?.customBtnId) return `customBtn:${node.dataset.customBtnId}`;
    if (node.id) {
      return LEGACY_LABELS[node.id] ? node.id : `id:${node.id}`;
    }

    if (node.dataset?.sidenav) return `sn:${slugText(node.dataset.sidenav)}`;
    if (node.dataset?.sidenavGroup) return `sng:${slugText(node.dataset.sidenavGroup)}`;
    if (node.dataset?.catHead) return `cathead:${slugText(node.dataset.catHead)}`;
    if (node.dataset?.cosmetic) return `cosmetic:${slugText(node.dataset.cosmetic)}`;
    if (node.dataset?.playerSpeed) return `speed:${slugText(node.dataset.playerSpeed)}`;
    if (node.dataset?.pictureFit) return `fit:${slugText(node.dataset.pictureFit)}`;
    if (node.dataset?.playerToggle) return `ptoggle:${slugText(node.dataset.playerToggle)}`;
    if (node.dataset?.sleep) return `sleep:${slugText(node.dataset.sleep)}`;
    if (node.dataset?.sleepVideos) return `sleepv:${slugText(node.dataset.sleepVideos)}`;
    if (node.dataset?.themePalette) return `tpal:${slugText(node.dataset.themePalette)}`;
    if (node.dataset?.tab && node.closest('#pluginsPanel')) {
      return `ptab:${slugText(node.dataset.tab)}`;
    }
    if (node.dataset?.page && node.closest('#pluginsPanel')) {
      return `ppage:${slugText(node.dataset.page)}`;
    }

    if (node.dataset?.cmd) {
      const extra = node.dataset.export || node.dataset.id || '';
      const key = `cmd:${slugText(pageId)}:${slugText(node.dataset.cmd)}${extra ? `:${slugText(extra)}` : ''}`;
      const seen = counters.get(key) || 0;
      counters.set(key, seen + 1);
      return seen === 0 ? key : `${key}:${seen}`;
    }

    const cls = Array.from(node.classList)
      .filter((c) => !c.startsWith('is-') && !c.startsWith('has-') && c !== 'octo-select-native')
      .slice(0, 2)
      .join('.');
    const base = `el:${slugText(pageId)}:${slugText(cls || node.tagName.toLowerCase())}`;
    const idx = counters.get(base) || 0;
    counters.set(base, idx + 1);
    return `${base}:${idx}`;
  }

  const ELEMENT_SELECTOR = [
    '.brand',
    '.brand-mark',
    '.nav',
    '.actions',
    '.tools',
    '.win-controls',
    '.page-pill',
    '.pill-icon',
    '.status-dot',
    '.unread',
    '.progress',
    '.download',
    '.app-sidenav',
    '.app-sidenav-head',
    '.app-sidenav-brand',
    '.app-sidenav-brand-text',
    '.app-sidenav-toggle',
    '.app-sidenav-search',
    '.app-sidenav-search-trigger',
    '.app-sidenav-search-input',
    '.app-sidenav-group',
    '.app-sidenav-item',
    '.app-sidenav-badge',
    '.panel-dialog',
    '.panel-head',
    '.panel-brand',
    '.panel-head-title',
    '.panel-head-version',
    '.panel-search',
    '.panel-search-input',
    '.panel-close',
    '.settings-nav',
    '.settings-content',
    '.panel-group',
    '.panel-cat-head',
    '.panel-row',
    '.panel-field',
    '.panel-field-label',
    '.panel-input',
    '.panel-textarea',
    '.panel-select',
    '.panel-inline-btn',
    '.panel-note',
    '.panel-empty',
    '.md3-slider',
    '.stepper',
    '.stepper-btn',
    '.stepper-value',
    '.speed-btn',
    '.timer-btn',
    '.theme-swatch',
    '.comp-preview-card',
    '.comp-actions',
    '.quick-panel',
    '.quick-panel-head',
    '.quick-panel-title',
    '.quick-panel-count',
    '.quick-panel-actions',
    '.quick-panel-action',
    '.quick-panel-action-text',
    '.quick-panel-close',
    '.quick-panel-empty',
    '.sticker-note',
    '.palette-card',
    '.palette-search',
    '.palette-input',
    '.palette-esc',
    '.palette-list',
    '.palette-foot',
    '.findbar',
    '.findbar-input',
    '.findbar-count',
    '.findbar-btn',
    '.pipbar',
    '.pip-row',
    '.pip-scrub',
    '.pip-rewind',
    '.pip-seek',
    '.pip-time',
    '.pip-title',
    '.baronly',
    '.baronly-row',
    '.baronly-title',
    '.baronly-range',
    '.loading-screen',
    '.loading-ring',
    '.loading-logo',
    '.offline-screen',
    '.offline-card',
    '.welcome',
    '.welcome-card',
    '.welcome-head',
    '.welcome-section',
    '.welcome-actions',
    '.welcome-btn',
    '.app-dialog',
    '.app-dialog-card',
    '.app-dialog-head',
    '.app-dialog-title',
    '.app-dialog-close',
    '.app-dialog-body',
    '.app-dialog-actions',
    '.plugin-dialog-card',
    '.plugin-dialog-title',
    '.plugin-dialog-message',
    '.plugin-dialog-input',
    '.plugin-dialog-actions',
    '.plugins-nav',
    '.plugins-nav-link',
    '.plugins-head-actions',
    '.plugins-btn',
    '.plugins-page-head',
    '.telegram-panel',
    '.plugins-settings-group',
    '.plugins-setting-row',
    '.plugins-path-row',
    'button',
    'h1',
    'h2',
    'h3',
    'kbd',
  ].join(',');

  function scanPageContainer(pageId, root, outMap, outList, counters) {
    if (!root) return;
    const nodes = [];
    if (root.matches?.(ELEMENT_SELECTOR)) nodes.push(root);
    for (const node of root.querySelectorAll(ELEMENT_SELECTOR)) nodes.push(node);

    for (const node of nodes) {
      if (
        node.closest(
          '#compPickerBar, #compPickerHighlight, #octoSelectMenu, .octo-custom-icon, .comp-icon-grid, .comp-emoji-chips, .color-swatch-row',
        )
      ) {
        continue;
      }
      if (
        node.classList.contains('octo-select-trigger') ||
        node.classList.contains('octo-select-opt')
      ) {
        continue;
      }
      // Навигационные пункты настроек относятся к каркасу настроек, а не к телу активной страницы.
      if (pageId === 'panelChrome' && node.closest('.panel-cat-body')) continue;

      const compId = deriveStableId(pageId, node, counters);
      if (!compId || outMap.has(compId)) {
        if (compId && !node.dataset.uiCompId) {
          node.dataset.uiCompId = compId;
          node.dataset.uiPageId = pageId;
        }
        continue;
      }

      node.dataset.uiCompId = compId;
      node.dataset.uiPageId = pageId;

      const meta = {
        id: compId,
        page: pageId,
        label: deriveNodeLabel(compId, node),
        defaultLabel:
          node.getAttribute('placeholder') ||
          shortText(
            node.querySelector(
              ':scope > .settings-label, :scope > .panel-cat-title, :scope > .panel-row-label, :scope > .app-sidenav-label',
            )?.textContent,
            60,
          ) ||
          '',
        defaultTooltip: node.getAttribute('title') || '',
        supportsLabel: hasLabelSupport(compId, node),
        supportsIcon: hasIconSupport(compId, node),
        supportsHeight: compId === 'titlebar',
        node,
      };
      outMap.set(compId, meta);
      outList.push(meta);
    }
  }

  let indexedCatalog = null;
  let catalogVersion = 0;

  function collectCatalog(force = false) {
    if (indexedCatalog && !force) return indexedCatalog;
    catalogVersion += 1;

    const byId = new Map();
    const list = [];
    const counters = new Map();

    // На index.html индексируем все страницы собственного интерфейса.
    if (!detectChildWindowKey()) {
      scanPageContainer('titlebar', $('titlebar'), byId, list, counters);
      scanPageContainer('sidenav', $('appSideNav'), byId, list, counters);

      const panelDialog = $('panelDialog');
      if (panelDialog) {
        // Каркас настроек (шапка, поиск, навигация по категориям)
        scanPageContainer('panelChrome', panelDialog, byId, list, counters);
      }

      for (const [cat] of SETTINGS_PAGE_TITLES) {
        const body =
          document.querySelector(
            `.panel-cat-body[id="cat${cat[0].toUpperCase()}${cat.slice(1)}"]`,
          ) ||
          document.querySelector(
            `.panel-cat-body[aria-labelledby="cat${cat[0].toUpperCase()}${cat.slice(1)}Head"]`,
          );
        if (body) {
          scanPageContainer(`settings:${cat}`, body, byId, list, counters);
        }
      }

      scanPageContainer('pluginsPanel', $('pluginsDialog'), byId, list, counters);
      scanPageContainer('popovers', $('popover'), byId, list, counters);
      scanPageContainer('palette', $('palette'), byId, list, counters);
      scanPageContainer('findbar', $('findbar'), byId, list, counters);
      scanPageContainer('minibars', $('pipbar'), byId, list, counters);
      scanPageContainer('minibars', $('baronly'), byId, list, counters);
      scanPageContainer('screens', $('loadingScreen'), byId, list, counters);
      scanPageContainer('screens', $('offlineScreen'), byId, list, counters);
      scanPageContainer('screens', $('welcome'), byId, list, counters);
      scanPageContainer('dialogs', $('appDialog'), byId, list, counters);
      scanPageContainer('dialogs', $('pluginDialog'), byId, list, counters);

      // Динамические групповые цели палитры команд
      const paletteItemMeta = {
        id: 'role:palette:item',
        page: 'palette',
        label: 'Пункты списка команд',
        supportsLabel: false,
        supportsIcon: false,
        supportsHeight: false,
        selector: '#paletteList .palette-item',
        all: true,
      };
      byId.set(paletteItemMeta.id, paletteItemMeta);
      list.push(paletteItemMeta);
    }

    for (const childMeta of CHILD_WINDOW_ELEMENTS) {
      if (!byId.has(childMeta.id)) {
        byId.set(childMeta.id, childMeta);
        list.push(childMeta);
      }
    }

    indexedCatalog = { byId, list, pages: PAGE_LIST };
    return indexedCatalog;
  }

  function resolveTargets(id) {
    if (!id) return [];

    const childKey = detectChildWindowKey();
    if (childKey) {
      const childMeta = CHILD_WINDOW_MAP.get(id);
      if (childMeta && childMeta.win === childKey) {
        return Array.from(document.querySelectorAll(childMeta.selector));
      }
      if (childKey === 'dialog') {
        const direct = id.startsWith('id:') ? $(id.slice(3)) : null;
        if (direct) return [direct];
        const map = {
          'el:dialogs:app_dialog_card:0': '.app-dialog-card',
          'el:dialogs:app_dialog_head:0': '.app-dialog-head',
          'el:dialogs:app_dialog_badge:0': '#appDialogBadge',
          'el:dialogs:app_dialog_actions:0': '#appDialogActions',
          'el:dialogs:app_dialog_btn:0': '.app-dialog-btn',
        };
        if (map[id]) return Array.from(document.querySelectorAll(map[id]));
      }
      return [];
    }

    const catalog = collectCatalog();
    const entry = catalog.byId.get(id);
    if (entry?.selector) {
      return Array.from(document.querySelectorAll(entry.selector));
    }
    if (entry?.node && document.contains(entry.node)) {
      return [entry.node];
    }

    switch (id) {
      case 'titlebar':
        return $('titlebar') ? [$('titlebar')] : [];
      case 'brand': {
        const node = document.querySelector('#titlebar .brand');
        return node ? [node] : [];
      }
      case 'pagePill':
        return $('pagePill') ? [$('pagePill')] : [];
      case 'panel':
        return $('panelDialog') ? [$('panelDialog')] : [];
      case 'pluginsPanel':
        return $('pluginsDialog') ? [$('pluginsDialog')] : [];
      case 'palette': {
        const node = document.querySelector('#palette .palette-card');
        return node ? [node] : [];
      }
      case 'popover':
        return $('popover') ? [$('popover')] : [];
      case 'findbar':
        return $('findbar') ? [$('findbar')] : [];
      case 'pipbar':
        return $('pipbar') ? [$('pipbar')] : [];
      case 'baronly':
        return $('baronly') ? [$('baronly')] : [];
      default:
        break;
    }

    if (id.startsWith('customBtn:')) {
      const btnId = id.slice('customBtn:'.length);
      const esc = window.CSS && window.CSS.escape ? window.CSS.escape(btnId) : btnId;
      const node = document.querySelector(`[data-custom-btn-id="${esc}"]`);
      return node ? [node] : [];
    }
    if (id.startsWith('id:')) {
      const node = $(id.slice(3));
      return node ? [node] : [];
    }
    const direct = $(id);
    if (direct) return [direct];
    const escId = window.CSS && window.CSS.escape ? window.CSS.escape(id) : id;
    const stamped = document.querySelectorAll(`[data-ui-comp-id="${escId}"]`);
    return Array.from(stamped);
  }

  const originals = new WeakMap();
  const componentFonts = new Map();

  function visualHostOf(target) {
    if (target.tagName === 'SELECT') {
      const wrap = target.closest('.octo-select');
      const trigger = wrap?.querySelector(':scope > .octo-select-trigger');
      if (trigger) return { styleTarget: trigger, hideTarget: wrap };
    }
    return { styleTarget: target, hideTarget: target };
  }

  function findInnerLabelNode(target) {
    return target.querySelector(
      ':scope > .app-sidenav-label, :scope > .panel-row-label, :scope > .panel-cat-title, :scope > .panel-field-label, :scope > .settings-label, :scope > .octo-winbar-title, :scope > .quick-panel-title, :scope > .ctx-item-label, :scope > .octo-custom-label',
    );
  }

  function isLeafTextElement(target) {
    if (target.children.length === 0) return true;
    const onlyTextAndSkip = Array.from(target.children).every((child) =>
      child.classList.contains('octo-custom-icon'),
    );
    return onlyTextAndSkip && Boolean(target.textContent.trim());
  }

  function captureOriginals(id, target) {
    if (originals.has(target)) return originals.get(target);
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
    } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      info.placeholder = target.getAttribute('placeholder') || '';
    } else {
      const inner = findInnerLabelNode(target);
      if (inner) info.labelText = inner.textContent || '';
      else if (isLeafTextElement(target)) info.labelText = target.textContent || '';
    }
    originals.set(target, info);
    return info;
  }

  function applyComponentFont(id, styleTarget, cfg) {
    const preset = cfg.fontPreset || 'inherit';
    if (preset === 'inherit') {
      styleTarget.style.removeProperty('font-family');
      return;
    }
    if (preset === 'custom-name' && cfg.fontFamily) {
      styleTarget.style.fontFamily = `'${cfg.fontFamily}', var(--ui-font-fallback)`;
      return;
    }
    if (preset === 'custom-file' && cfg.fontDataBase64) {
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const faceName = `OctoCompFont_${safeId}`;
      const key = `${cfg.fontFileName || ''}:${cfg.fontDataBase64.length}:${cfg.fontDataBase64.slice(0, 24)}`;
      const cached = componentFonts.get(id);
      if (cached && cached.key === key) {
        styleTarget.style.fontFamily = `'${faceName}', var(--ui-font-fallback)`;
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
            styleTarget.style.fontFamily = `'${faceName}', var(--ui-font-fallback)`;
          })
          .catch(() => {
            styleTarget.style.removeProperty('font-family');
          });
      } catch {
        styleTarget.style.removeProperty('font-family');
      }
      return;
    }
    if (FONT_STACKS[preset]) {
      styleTarget.style.fontFamily = FONT_STACKS[preset];
    } else {
      styleTarget.style.removeProperty('font-family');
    }
  }

  function iconHostOf(id, target) {
    if (id === 'palette' || target.classList.contains('palette-card')) {
      return target.querySelector('.palette-search') || target;
    }
    return target.querySelector(':scope > .app-sidenav-icon, :scope > .panel-cat-icon') || target;
  }

  function clearCustomIcon(id, target) {
    const host = iconHostOf(id, target);
    target.classList.remove('has-custom-icon', 'is-icon-none');
    host.classList.remove('has-custom-icon', 'is-icon-none');
    delete host.dataset.octoIconMode;
    host.querySelector(':scope > .octo-custom-icon')?.remove();
  }

  function applyComponentIcon(id, target, cfg) {
    const host = iconHostOf(id, target);
    const mode = cfg.iconType || 'default';
    if (mode === 'default') {
      clearCustomIcon(id, target);
      return;
    }

    host.classList.add('has-custom-icon');
    target.classList.add('has-custom-icon');
    host.dataset.octoIconMode = mode;
    host.classList.toggle('is-icon-none', mode === 'none');
    target.classList.toggle('is-icon-none', mode === 'none');

    let customNode = host.querySelector(':scope > .octo-custom-icon');
    if (mode === 'none') {
      customNode?.remove();
      return;
    }

    if (mode === 'preset') {
      const svg = buildSvgIcon(cfg.iconValue);
      if (!svg) {
        clearCustomIcon(id, target);
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

    clearCustomIcon(id, target);
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

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (label) {
        target.setAttribute('data-octo-custom-tooltip', '1');
        target.setAttribute('placeholder', label);
      } else if (target.hasAttribute('data-octo-custom-tooltip')) {
        target.removeAttribute('data-octo-custom-tooltip');
        target.setAttribute('placeholder', orig.placeholder || '');
        window.octoI18n?.refresh?.();
      }
      return;
    }

    const inner = findInnerLabelNode(target);
    if (inner) {
      if (label) {
        if (inner.classList.contains('octo-custom-label') || !inner.dataset.customBtnDefault) {
          inner.setAttribute('data-i18n-skip', '');
        }
        inner.textContent = label;
        target.classList.add('has-comp-label');
      } else if (inner.hasAttribute('data-i18n-skip')) {
        if (!inner.dataset.customBtnDefault) {
          inner.removeAttribute('data-i18n-skip');
        }
        inner.textContent = inner.dataset.customBtnDefault || orig.labelText || '';
        if (inner.classList.contains('octo-custom-label') && !inner.dataset.customBtnDefault) {
          target.classList.remove('has-comp-label');
        }
        window.octoI18n?.refresh?.();
      }
      return;
    }

    if (
      isLeafTextElement(target) &&
      !target.classList.contains('icon-btn') &&
      !target.classList.contains('win-btn')
    ) {
      if (label) {
        target.setAttribute('data-i18n-skip', '');
        const customIcon = target.querySelector(':scope > .octo-custom-icon');
        if (customIcon) {
          for (const child of Array.from(target.childNodes)) {
            if (child.nodeType === 3) child.remove();
          }
          target.append(document.createTextNode(label));
        } else {
          target.textContent = label;
        }
      } else if (target.hasAttribute('data-i18n-skip')) {
        target.removeAttribute('data-i18n-skip');
        const customIcon = target.querySelector(':scope > .octo-custom-icon');
        if (customIcon) {
          for (const child of Array.from(target.childNodes)) {
            if (child.nodeType === 3) child.remove();
          }
          target.append(document.createTextNode(orig.labelText || ''));
        } else {
          target.textContent = orig.labelText || '';
        }
        window.octoI18n?.refresh?.();
      }
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
    const host = visualHostOf(target).styleTarget;
    if (tooltip) {
      target.setAttribute('data-octo-custom-tooltip', '1');
      target.setAttribute('title', tooltip);
      if (host !== target) host.setAttribute('title', tooltip);
      if (orig.ariaLabel) {
        target.setAttribute('aria-label', tooltip);
        if (host !== target) host.setAttribute('aria-label', tooltip);
      }
    } else if (target.hasAttribute('data-octo-custom-tooltip')) {
      target.removeAttribute('data-octo-custom-tooltip');
      if (orig.title) target.setAttribute('title', orig.title);
      else target.removeAttribute('title');
      if (host !== target) host.removeAttribute('title');
      if (orig.ariaLabel) {
        target.setAttribute('aria-label', orig.ariaLabel);
        if (host !== target) host.setAttribute('aria-label', orig.ariaLabel);
      }
      window.octoI18n?.refresh?.();
    }
  }

  const APPLIED_IDS = new Set();

  function applySingleConfig(id, cfg, target) {
    const orig = captureOriginals(id, target);
    const { styleTarget, hideTarget } = visualHostOf(target);

    applyComponentLabel(id, target, cfg, orig);
    applyComponentTooltip(target, cfg, orig);

    const catalogMeta = !detectChildWindowKey()
      ? collectCatalog().byId.get(id)
      : CHILD_WINDOW_MAP.get(id);
    const supportsIcon = catalogMeta ? catalogMeta.supportsIcon : hasIconSupport(id, target);
    if (supportsIcon) applyComponentIcon(id, target, cfg);

    applyComponentFont(id, styleTarget, cfg);

    if (cfg.fgColor) styleTarget.style.color = cfg.fgColor;
    else styleTarget.style.removeProperty('color');

    if (cfg.bgColor) styleTarget.style.background = cfg.bgColor;
    else styleTarget.style.removeProperty('background');

    if (cfg.borderColor) {
      styleTarget.style.borderColor = cfg.borderColor;
      styleTarget.classList.add('has-custom-border');
    } else {
      styleTarget.style.removeProperty('border-color');
      styleTarget.classList.remove('has-custom-border');
    }

    if (cfg.fontSize > 0) styleTarget.style.fontSize = `${cfg.fontSize}px`;
    else styleTarget.style.removeProperty('font-size');

    if (cfg.fontWeight) styleTarget.style.fontWeight = cfg.fontWeight;
    else styleTarget.style.removeProperty('font-weight');

    if (cfg.iconSize > 0) target.style.setProperty('--octo-comp-icon-size', `${cfg.iconSize}px`);
    else target.style.removeProperty('--octo-comp-icon-size');

    if (typeof cfg.radius === 'number' && cfg.radius >= 0) {
      styleTarget.style.borderRadius = `${cfg.radius}px`;
    } else {
      styleTarget.style.removeProperty('border-radius');
    }

    if (cfg.opacity && cfg.opacity < 100) styleTarget.style.opacity = String(cfg.opacity / 100);
    else styleTarget.style.removeProperty('opacity');

    if (id === 'titlebar') {
      const rootStyle = document.documentElement.style;
      if (cfg.height > 0) rootStyle.setProperty('--bar-h', `${cfg.height}px`);
      else rootStyle.removeProperty('--bar-h');
    }

    hideTarget.classList.toggle('is-comp-hidden', cfg.hidden === true);
  }

  function syncTopbarGroupVisibility() {
    for (const sel of ['#navGroup', '#actionsGroup', '#toolsGroup', '#customToolsGroup']) {
      const group = document.querySelector(sel);
      if (!group) continue;
      const buttons = Array.from(group.children).filter((child) => child.tagName === 'BUTTON');
      const anyVisible = buttons.some(
        (btn) => !btn.hidden && !btn.classList.contains('is-comp-hidden'),
      );
      group.classList.toggle('is-group-empty', !anyVisible);
    }
  }

  let lastAppliedKey = '';

  function applyAll(customMap) {
    const map = customMap && typeof customMap === 'object' ? customMap : {};
    const isChild = Boolean(detectChildWindowKey());

    if (!isChild) {
      collectCatalog(false);
      const nextKey = `${catalogVersion}:${JSON.stringify(map)}`;
      if (nextKey === lastAppliedKey) return;
      lastAppliedKey = nextKey;
    }

    const activeIds = new Set(Object.keys(map));
    const allIds = new Set([...APPLIED_IDS, ...activeIds]);
    if (!isChild) {
      const baseList = Array.isArray(window.octo?.uiComponents) ? window.octo.uiComponents : [];
      for (const item of baseList) allIds.add(item.id);
    }

    for (const id of allIds) {
      const cfg = map[id] || {};
      const targets = resolveTargets(id);
      if (!targets.length) continue;
      for (const target of targets) {
        applySingleConfig(id, cfg, target);
      }
      if (Object.keys(cfg).length > 0) APPLIED_IDS.add(id);
      else APPLIED_IDS.delete(id);
    }

    if (!isChild) {
      syncTopbarGroupVisibility();
    }
  }

  function getPageTitle(compId, defaultTitle, customMap) {
    const label = customMap?.[compId]?.label;
    if (!label) return defaultTitle;
    return label.includes('{title}') ? label.replaceAll('{title}', defaultTitle) : label;
  }

  // Автосинхронизация для дочерних окон (загрузки, обновление, аннотатор, меню, диалоги).
  const childWinKey = detectChildWindowKey();
  if (childWinKey && window.octo && typeof window.octo.uiCustom === 'object') {
    let latestMap = window.octo.uiCustom || {};
    let rafId = 0;
    const scheduleApply = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        applyAll(latestMap);
      });
    };
    const startChildSync = () => {
      applyAll(latestMap);
      const observer = new MutationObserver(scheduleApply);
      observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startChildSync);
    } else {
      startChildSync();
    }
    if (typeof window.octo.onUiCustom === 'function') {
      window.octo.onUiCustom((nextMap) => {
        latestMap = nextMap && typeof nextMap === 'object' ? nextMap : {};
        applyAll(latestMap);
      });
    }
  }

  window.octoUiCore = {
    ICON_PRESETS,
    ICON_PRESET_MAP,
    EMOJI_PRESETS,
    FONT_STACKS,
    PAGE_LIST,
    CHILD_WINDOW_ELEMENTS,
    buildSvgIcon,
    collectCatalog,
    resolveTargets,
    applyAll,
    applyComponentFont,
    syncTopbarGroupVisibility,
    getPageTitle,
    tr,
  };
})();
