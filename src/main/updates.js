'use strict';

const { app } = require('electron');
const { toast } = require('./app-context');
const updateWindow = require('./update-window');
const logger = require('./logger');

/**
 * Автообновление (electron-updater) — только для упакованной сборки.
 *
 * Работает, если в build.publish указан репозиторий GitHub (см. package.json
 * и README). В dev-режиме модуль молчит, чтобы не мешать отладке.
 *
 * Скачивание не начинается само: при запуске проверяем релиз и показываем
 * окно с предложением. Если пользователь закрыл окно, на следующем запуске
 * предложение появится снова. После загрузки окно просит перезапуститься.
 */

/**
 * В Flatpak приложение обновляется вместе с пакетом: собственный апдейтер
 * качал бы мимо песочницы и нарушал правила Flathub.
 */
const IS_FLATPAK = Boolean(process.env.FLATPAK_ID);

/** @type {import('electron-updater').AppUpdater | null} */
let autoUpdater = null;
let packaged = false;

/** idle → available → downloading → ready | error */
let phase = 'idle';
let offeredVersion = '';
let checking = false;

async function startDownload() {
  if (!autoUpdater || (phase !== 'available' && phase !== 'error')) return;

  logger.info('updates', 'startDownload', { version: offeredVersion });
  phase = 'downloading';
  updateWindow.show({ phase, percent: 0 });

  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    logger.error('updates', 'downloadUpdate failed', err?.message ?? err);
    console.warn('[octo] update download failed:', err?.message ?? err);
    phase = 'error';
    updateWindow.show({ phase, percent: 0 });
  }
}

function restartNow() {
  if (!autoUpdater || phase !== 'ready') return;
  logger.info('updates', 'quitAndInstall', { version: offeredVersion });
  logger.flush();
  // isSilent=true: обновляем без окна установщика NSIS на Windows.
  // isForceRunAfter=true: после тихой установки приложение запускается снова.
  autoUpdater.quitAndInstall(true, true);
}

function offer(info, { force = false } = {}) {
  const version = String(info?.version || '');
  if (!version) return;
  // Не сбиваем уже идущую загрузку или готовое обновление новой карточкой.
  if (phase === 'downloading' || phase === 'ready') return;
  if (!force && phase === 'available' && offeredVersion === version && updateWindow.isOpen()) {
    return;
  }

  phase = 'available';
  offeredVersion = version;
  updateWindow.show({ phase, version, percent: 0 });
}

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

  updateWindow.setHandlers({
    install: startDownload,
    restart: restartNow,
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    logger.error('updates', 'autoUpdater error', err?.message ?? err);
    console.warn('[octo] update error:', err?.message ?? err);
    if (phase !== 'downloading') return;
    phase = 'error';
    updateWindow.show({ phase, percent: 0 });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('updates', 'update-available', { version: info?.version });
    offer(info);
  });

  autoUpdater.on('update-not-available', () => {
    logger.debug('updates', 'update-not-available');
    if (phase !== 'available') return;
    phase = 'idle';
    updateWindow.close();
  });

  autoUpdater.on('download-progress', (info) => {
    if (phase !== 'downloading') return;
    updateWindow.progress(Number(info?.percent) || 0);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updates', 'update-downloaded', { version: info?.version || offeredVersion });
    phase = 'ready';
    updateWindow.show({
      phase,
      version: String(info?.version || offeredVersion),
      percent: 100,
    });
  });

  checking = true;
  logger.info('updates', 'startup checkForUpdates');
  autoUpdater
    .checkForUpdates()
    .catch((err) => {
      logger.warn('updates', 'startup check failed', err?.message ?? err);
      console.warn('[octo] update check failed:', err?.message ?? err);
    })
    .finally(() => {
      checking = false;
    });
}

/** Ручная проверка из панели функций. */
async function checkNow() {
  logger.info('updates', 'manual checkNow', { packaged, flatpak: IS_FLATPAK, phase });
  if (IS_FLATPAK) {
    toast('Обновления приходят через Flathub');
    return;
  }

  if (!packaged || !autoUpdater) {
    toast('Обновления доступны только в собранной версии');
    return;
  }

  // Уже качаем или ждём перезапуска — просто показываем окно, без новой проверки.
  if (phase === 'downloading' || phase === 'ready') {
    updateWindow.show({ phase });
    return;
  }

  if (checking) return;
  checking = true;

  try {
    const result = await autoUpdater.checkForUpdates();
    const version = String(result?.updateInfo?.version || '');
    if (!version || version === app.getVersion()) toast('Обновлений нет');
  } catch (err) {
    logger.warn('updates', 'manual check failed', err?.message ?? err);
    toast('Не удалось проверить обновления');
  } finally {
    checking = false;
  }
}

module.exports = { initUpdates, checkNow };
