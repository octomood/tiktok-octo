'use strict';

const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Автозапуск.
 *
 * macOS/Windows — штатный API Electron. Linux — свой .desktop в
 * XDG_CONFIG_HOME/autostart: Electron не умеет этого сам, а пользователи
 * Linux ждут именно файл автозапуска.
 */

const DESKTOP_FILE = 'tiktok-octo.desktop';

function linuxAutostartFile() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'autostart', DESKTOP_FILE);
}

/** В AppImage путь к .AppImage лежит в APPIMAGE, иначе — путь к бинарнику. */
function executablePath() {
  return process.env.APPIMAGE || app.getPath('exe');
}

function isEnabled() {
  if (process.platform === 'linux') return fs.existsSync(linuxAutostartFile());
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function setEnabled(enabled) {
  if (process.platform === 'linux') {
    const file = linuxAutostartFile();
    if (!enabled) {
      fs.rmSync(file, { force: true });
      return;
    }

    fs.mkdirSync(path.dirname(file), { recursive: true });
    const exec = executablePath().replace(/"/g, '\\"');
    const content = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=TikTok octo',
      `Exec="${exec}" --hidden`,
      'X-GNOME-Autostart-enabled=true',
      'Terminal=false',
      '',
    ].join('\n');
    fs.writeFileSync(file, content, { mode: 0o644 });
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      args: ['--hidden'],
    });
  } catch {
    /* политика ОС может запрещать автозапуск */
  }
}

module.exports = { isEnabled, setEnabled };
