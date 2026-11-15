'use strict';

const { app, dialog } = require('electron');

/**
 * Автообновление (electron-updater) — только для упакованной сборки.
 *
 * Работает, если в build.publish указан репозиторий GitHub (см. package.json
 * и README). В dev-режиме модуль молчит, чтобы не мешать отладке.
 */
function initUpdates() {
  if (!app.isPackaged || process.env.OCTO_E2E) return;

  let autoUpdater;
  try {
    // Пакет может отсутствовать в урезанной сборке — приложение важнее.
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.warn('[octo] update error:', err?.message ?? err);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Обновление готово',
      message: `Версия ${info.version} загружена`,
      detail: 'Перезапустить приложение сейчас?',
      buttons: ['Перезапустить', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[octo] update check failed:', err?.message ?? err);
  });
}

module.exports = { initUpdates };
