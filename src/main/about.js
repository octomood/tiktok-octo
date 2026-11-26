'use strict';

const path = require('node:path');
const { app } = require('electron');
const { showMessageBox } = require('./dialogs');
const { t } = require('./i18n');

/** Одно диалоговое окно «О программе» для меню и панели функций. */
function showAbout(parent) {
  const options = {
    type: 'info',
    title: 'О программе',
    message: 'TikTok Octo',
    icon: path.join(__dirname, '../../build/icon.png'),
    detail: [
      t(`Версия ${app.getVersion()}`),
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
      '',
      t('Неофициальный клиент. Не связан с TikTok Ltd.'),
    ].join('\n'),
    buttons: ['ОК'],
  };
  if (parent) showMessageBox(parent, options);
  else showMessageBox(options);
}

module.exports = { showAbout };
