'use strict';

const { app, Menu, clipboard } = require('electron');
const { ctx, canGoBack, canGoForward, stepHistory } = require('./app-context');
const { openExternal } = require('./links');
const { handleCommand } = require('./commands');
const { showAbout } = require('./about');
const cosmetics = require('./cosmetics');
const region = require('./region');

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
      click: () => wc.inspectElement(params.x, params.y),
    });

    Menu.buildFromTemplate(template).popup({ window: ctx.win ?? undefined });
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
        { label: 'Панель функций', click: () => handleCommand('panel') },
        { label: 'Палитра команд', click: () => handleCommand('palette') },
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
      : [{ label: 'Справка', submenu: [{ label: 'О программе', click: showAboutDialog }] }]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { attachContextMenu, buildAppMenu, showAbout: showAboutDialog };
