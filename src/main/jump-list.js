'use strict';

const path = require('node:path');
const { app, Menu } = require('electron');
const { handleCommand } = require('./commands');
const { t } = require('./i18n');

/**
 * Системные меню задач: jump list в Windows и меню дока в macOS.
 * В Linux тот же набор живёт в .desktop (Actions) — см. appimage-install.js
 * и пакеты AUR/Flatpak.
 */

const ICON = path.join(__dirname, '../../build/icon.png');

function install() {
  if (process.platform === 'win32') {
    try {
      app.setJumpList([
        {
          type: 'tasks',
          items: [
            {
              type: 'task',
              title: t('Картинка в картинке'),
              program: process.execPath,
              args: '--pip',
              iconPath: ICON,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: t('Сообщения'),
              program: process.execPath,
              args: '--messages',
              iconPath: ICON,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: t('Без звука'),
              program: process.execPath,
              args: '--mute',
              iconPath: ICON,
              iconIndex: 0,
            },
          ],
        },
      ]);
    } catch {
      /* jump list не обязателен */
    }
    return;
  }

  if (process.platform === 'darwin' && app.dock?.setMenu) {
    const item = (label, command) => ({
      label: t(label),
      click: () => handleCommand(command),
    });
    app.dock.setMenu(
      Menu.buildFromTemplate([
        item('Картинка в картинке', 'pip'),
        item('Сообщения', 'chat'),
        item('Без звука', 'mute'),
      ]),
    );
  }
}

module.exports = { install };
