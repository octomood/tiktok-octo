'use strict';

const { app } = require('electron');
const { toast } = require('./app-context');
const { showMessageBox } = require('./dialogs');

/**
 * Автообновление (electron-updater) — только для упакованной сборки.
 *
 * Работает, если в build.publish указан репозиторий GitHub (см. package.json
 * и README). В dev-режиме модуль молчит, чтобы не мешать отладке.
 */

/**
 * В Flatpak приложение обновляется вместе с пакетом: собственный апдейтер
 * качал бы мимо песочницы и нарушал правила Flathub.
 */
const IS_FLATPAK = Boolean(process.env.FLATPAK_ID);

/** @type {import('electron-updater').AppUpdater | null} */
let autoUpdater = null;
let packaged = false;

function initUpdates() {
  // В Electron 45 app.isPackaged бывает true и при запуске из папки,
  // поэтому дополнительно проверяем process.defaultApp («это Electron, а не
  // собранное приложение»).
  packaged = app.isPackaged && !process.defaultApp;
  if (!packaged || IS_FLATPAK || process.env.OCTO_E2E) return;

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
    const { response } = await showMessageBox({
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

/** Ручная проверка из панели функций. */
async function checkNow() {
  if (IS_FLATPAK) {
    toast('Обновления приходят через Flathub');
    return;
  }

  if (!packaged || !autoUpdater) {
    toast('Обновления доступны только в собранной версии');
    return;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo || result.updateInfo.version === app.getVersion()) {
      toast('Обновлений нет');
    } else {
      toast(`Доступна версия ${result.updateInfo.version}`);
    }
  } catch {
    toast('Не удалось проверить обновления');
  }
}

module.exports = { initUpdates, checkNow };
