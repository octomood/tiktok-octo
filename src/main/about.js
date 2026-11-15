'use strict';

const { app, dialog } = require('electron');

/** Одно диалоговое окно «О программе» для меню и панели функций. */
function showAbout(parent) {
  const options = {
    type: 'info',
    title: 'О программе',
    message: 'TikTok octo',
    detail: [
      `Версия ${app.getVersion()}`,
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
      '',
      'Неофициальный клиент. Не связан с TikTok Ltd.',
    ].join('\n'),
    buttons: ['ОК'],
  };
  if (parent) dialog.showMessageBox(parent, options);
  else dialog.showMessageBox(options);
}

module.exports = { showAbout };
