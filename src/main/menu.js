'use strict';

const { app, Menu, clipboard } = require('electron');
const { ctx, canGoBack, canGoForward, stepHistory } = require('./app-context');
const { openExternal } = require('./links');
const { handleCommand } = require('./commands');
const { showAbout } = require('./about');
const cosmetics = require('./cosmetics');
const region = require('./region');
const plugins = require('./plugins');
const i18n = require('./i18n');
const autoTheme = require('./auto-theme');
const privacy = require('./privacy');

const isMac = process.platform === 'darwin';

/**
 * Контекстное меню контента.
 *
 * Без него в приложении не было ни копирования, ни проверки орфографии,
 * ни «открыть ссылку в браузере» — только системные шорткаты.
 */
function attachContextMenu(wc) {
  wc.on('context-menu', (_event, params) => {
    const template = [];
    const selection = (params.selectionText || '').trim();

    if (params.misspelledWord) {
      for (const suggestion of (params.dictionarySuggestions || []).slice(0, 4)) {
        template.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) });
      }
      template.push({
        label: 'Добавить в словарь',
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      template.push({ type: 'separator' });
    }

    if (params.linkURL) {
      template.push({
        label: 'Открыть ссылку в браузере',
        click: () => openExternal(params.linkURL),
      });
      template.push({
        label: 'Копировать ссылку',
        click: () => clipboard.writeText(params.linkURL),
      });
      template.push({ type: 'separator' });
    }

    if (params.mediaType === 'image' && params.srcURL) {
      template.push({ label: 'Сохранить изображение', click: () => wc.downloadURL(params.srcURL) });
      template.push({
        label: 'Копировать адрес изображения',
        click: () => clipboard.writeText(params.srcURL),
      });
      template.push({ type: 'separator' });
    }

    if (params.isEditable) {
      template.push({ label: 'Вырезать', role: 'cut' });
      template.push({ label: 'Копировать', role: 'copy' });
      template.push({ label: 'Вставить', role: 'paste' });
      template.push({ label: 'Выделить всё', role: 'selectAll' });
    } else if (selection) {
      template.push({ label: 'Копировать', role: 'copy' });
      template.push({
        label: 'Искать в Google',
        click: () =>
          openExternal(
            `https://www.google.com/search?q=${encodeURIComponent(selection.slice(0, 200))}`,
          ),
      });
    } else {
      template.push({
        label: 'Назад',
        enabled: canGoBack(wc),
        click: () => stepHistory(-1),
      });
      template.push({
        label: 'Вперёд',
        enabled: canGoForward(wc),
        click: () => stepHistory(1),
      });
      template.push({ label: 'Обновить', click: () => wc.reload() });
      template.push({ label: 'Найти на странице…', click: () => handleCommand('find') });
    }

    template.push({ type: 'separator' });
    template.push({
      label: 'Проверить элемент',
      click: () =>
        autoTheme.suspend(wc).finally(() => {
          if (!wc.isDestroyed()) wc.inspectElement(params.x, params.y);
        }),
    });

    const pluginItems = plugins.contextMenuItems({
      linkURL: params.linkURL,
      selectionText: params.selectionText,
      isEditable: params.isEditable,
      mediaType: params.mediaType,
      srcURL: params.srcURL,
      pageURL: wc.getURL(),
    });
    if (pluginItems.length) {
      template.push({ type: 'separator' });
      template.push(...pluginItems);
    }

    Menu.buildFromTemplate(i18n.applyToMenuTemplate(template)).popup({
      window: ctx.win ?? undefined,
    });
  });
}

function showAboutDialog() {
  showAbout(ctx.win);
}

/**
 * Меню приложения. На Linux/Windows оно скрыто (autoHideMenuBar), но
 * открывается по Alt и даёт стандартные роли правки — без них на macOS
 * не работают Cmd+C/Cmd+V.
 */
function buildAppMenu() {
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Файл',
      submenu: [
        { label: 'Главная', click: () => handleCommand('home') },
        { label: 'Обновить', click: () => handleCommand('reload') },
        { label: 'Обновить без кэша', click: () => handleCommand('hardReload') },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ role: 'quit', label: 'Выход' }]),
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
        { type: 'separator' },
        { label: 'Найти на странице…', click: () => handleCommand('find') },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Настройки', click: () => handleCommand('panel') },
        { label: 'Чат сбоку', click: () => handleCommand('chat') },
        { label: 'Палитра команд', click: () => handleCommand('palette') },
        {
          label: 'Картинки в чат',
          submenu: [
            { label: 'Меню картинок', click: () => handleCommand('stickerPanel') },
            { label: 'Добавить картинки…', click: () => handleCommand('stickerAdd') },
            { label: 'Папка картинок', click: () => handleCommand('stickerFolder') },
            { label: 'Стикеры TikTok', click: () => handleCommand('nativeStickers') },
          ],
        },
        { type: 'separator' },
        { label: 'Крупнее', click: () => handleCommand('zoomIn') },
        { label: 'Мельче', click: () => handleCommand('zoomOut') },
        { label: 'Масштаб 100 %', click: () => handleCommand('zoomReset') },
        { type: 'separator' },
        { label: 'Полный экран', click: () => handleCommand('fullscreen') },
        { type: 'separator' },
        { label: 'Косметика', submenu: cosmetics.menuItems() },
        { label: 'Регион', submenu: region.menuItems() },
        { type: 'separator' },
        { label: 'Инструменты разработчика', click: () => handleCommand('devtools') },
      ],
    },
    {
      label: 'Язык',
      submenu: [
        { label: 'Интерфейс', submenu: i18n.menuItems() },
        { label: 'TikTok', submenu: region.siteLanguageMenuItems() },
      ],
    },
    {
      label: 'Плагины',
      submenu: [
        { label: 'Менеджер плагинов', click: () => handleCommand('plugins') },
        { label: 'Активные плагины', click: () => handleCommand('pluginsActive') },
        { label: 'Установить из файла…', click: () => handleCommand('pluginInstallFile') },
        { type: 'separator' },
        ...plugins.menuItems(),
        { type: 'separator' },
        { label: 'Документация для разработчиков', click: () => handleCommand('pluginDocs') },
        { label: 'Правила публикации', click: () => handleCommand('pluginRules') },
        { label: 'Папка плагинов', click: () => handleCommand('pluginFolder') },
      ],
    },
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { label: 'Развернуть', click: () => handleCommand('maximize') },
        { type: 'separator' },
        { label: 'Поверх всех окон', click: () => handleCommand('onTop') },
        { label: 'Картинка в картинке', click: () => handleCommand('pip') },
        { label: 'Следующее видео', click: () => handleCommand('feedNext') },
        { label: 'Предыдущее видео', click: () => handleCommand('feedPrev') },
        { label: 'Автолистание в PiP', click: () => handleCommand('pipAuto') },
        { label: 'Адаптивный PiP', click: () => handleCommand('pipAdaptive') },
        { label: 'Без звука', click: () => handleCommand('mute') },
      ],
    },
    ...(isMac
      ? []
      : [
          {
            label: 'Справка',
            submenu: [
              { label: 'О программе', click: showAboutDialog },
              { label: 'Диагностика', click: () => privacy.copyDiagnostics() },
              { label: 'Лицензии', click: () => privacy.showLicenses() },
              { label: 'Не связан с TikTok', click: () => privacy.showDisclaimer() },
            ],
          },
        ]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(i18n.applyToMenuTemplate(template)));
}

module.exports = { attachContextMenu, buildAppMenu, showAbout: showAboutDialog };
