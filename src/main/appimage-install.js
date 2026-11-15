'use strict';

const { nativeImage } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Установка AppImage в пользовательское меню приложений.
 *
 * Никакого sudo: кладём образ в ~/.local/bin, иконки — в hicolor,
 * .desktop — в ~/.local/share/applications. Это стандартные XDG-пути,
 * которые видят GNOME/KDE/XFCE.
 */

const APP_ID = 'tiktok-octo';
const APP_NAME = 'TikTok octo';
const ICON_SIZES = [512, 256, 128, 64, 48, 32];

function dataHome() {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

function installDir() {
  return path.join(os.homedir(), '.local', 'bin');
}

function installedAppImage() {
  return path.join(installDir(), `${APP_ID}.AppImage`);
}

function applicationsDir() {
  return path.join(dataHome(), 'applications');
}

function desktopFilePath() {
  return path.join(applicationsDir(), `${APP_ID}.desktop`);
}

function iconsRoot() {
  return path.join(dataHome(), 'icons', 'hicolor');
}

function sourceAppImage() {
  return process.env.APPIMAGE || '';
}

function isAvailable() {
  return Boolean(sourceAppImage());
}

function isInstalled() {
  try {
    const desktop = fs.readFileSync(desktopFilePath(), 'utf8');
    return desktop.includes(installedAppImage()) && fs.existsSync(installedAppImage());
  } catch {
    return false;
  }
}

function refreshCaches() {
  execFile('update-desktop-database', [applicationsDir()], () => {});
  execFile('gtk-update-icon-cache', ['-f', '-t', iconsRoot()], () => {});
}

function writeIcon() {
  const source = path.join(__dirname, '../../build/icon.png');
  const image = nativeImage.createFromPath(source);
  if (image.isEmpty()) return false;

  for (const size of ICON_SIZES) {
    const dir = path.join(iconsRoot(), `${size}x${size}`, 'apps');
    fs.mkdirSync(dir, { recursive: true });
    const resized = image.resize({ width: size, height: size });
    fs.writeFileSync(path.join(dir, `${APP_ID}.png`), resized.toPNG());
  }
  return true;
}

function desktopEntry(execPath) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    `Name=${APP_NAME}`,
    'Comment=Неофициальный десктоп-клиент TikTok',
    `Exec="${execPath}" %U`,
    `TryExec=${execPath}`,
    `Icon=${APP_ID}`,
    'Terminal=false',
    'Categories=Network;',
    'StartupNotify=true',
    'X-GNOME-UsesNotifications=true',
    '',
  ].join('\n');
}

function install() {
  const source = sourceAppImage();
  if (!source || !fs.existsSync(source)) {
    return { ok: false, error: 'Запустите установку из AppImage' };
  }

  const target = installedAppImage();

  try {
    fs.mkdirSync(installDir(), { recursive: true });
    fs.mkdirSync(applicationsDir(), { recursive: true });

    // Если уже запущены из установленной копии — не копируем файл сам в себя.
    // Заменяем через временный файл и rename: так установку можно обновлять
    // даже когда старый AppImage сейчас запущен (ETXTBSY не мешает).
    if (path.resolve(source) !== path.resolve(target)) {
      const temporary = `${target}.new`;
      fs.copyFileSync(source, temporary);
      fs.chmodSync(temporary, 0o755);
      fs.renameSync(temporary, target);
    }
    fs.chmodSync(target, 0o755);

    writeIcon();
    fs.writeFileSync(desktopFilePath(), desktopEntry(target), { mode: 0o644 });
    refreshCaches();

    return { ok: true, appImage: target, desktop: desktopFilePath() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function uninstall() {
  try {
    fs.rmSync(desktopFilePath(), { force: true });

    for (const size of ICON_SIZES) {
      fs.rmSync(path.join(iconsRoot(), `${size}x${size}`, 'apps', `${APP_ID}.png`), {
        force: true,
      });
    }

    // Если приложение запущено из установленной копии, Linux спокойно
    // переживёт удаление файла — процесс уже держит его открытым.
    fs.rmSync(installedAppImage(), { force: true });
    refreshCaches();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isAvailable,
  isInstalled,
  install,
  uninstall,
  installedAppImage,
  desktopFilePath,
};
