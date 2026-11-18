'use strict';

/**
 * Локальная сборка и пункт в меню приложений.
 *
 * После правок агенту не нужно запускать приложение, чтобы что-то показать:
 * `npm run install:local` собирает AppImage из текущего рабочего дерева и
 * обновляет пункт «TikTok octo (локальная сборка)» в меню. Пользователь сам
 * открывает его, когда ему удобно.
 *
 * Сборка не открывает окон и не публикуется на GitHub: `--publish never`.
 * Имя AppImage фиксированное, чтобы .desktop не ломался при смене версии.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ICON = path.join(ROOT, 'build', 'icon.png');
const APPIMAGE = path.join(DIST, 'tiktok-octo-local.AppImage');
const APPLICATIONS = path.join(os.homedir(), '.local', 'share', 'applications');
const DESKTOP_FILE = path.join(APPLICATIONS, 'tiktok-octo-local.desktop');
const NAME = 'TikTok octo (локальная сборка)';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.error) {
    console.error(`[octo] не удалось запустить ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[octo] ${command} завершился с кодом ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function buildAppImage() {
  // Встроенные доки плагинов попадают в пакет, поэтому собираем их до сборки.
  run(process.execPath, [path.join(ROOT, 'scripts', 'build-plugin-docs.js')]);
  run(process.execPath, [
    require.resolve('electron-builder/out/cli/cli.js'),
    '--linux',
    'AppImage',
    '--publish',
    'never',
  ]);
}

function findArtifact() {
  const candidate = fs
    .readdirSync(DIST)
    .filter((name) => name.endsWith('.AppImage') && name !== path.basename(APPIMAGE))
    .map((name) => path.join(DIST, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

  if (!candidate) {
    console.error('[octo] electron-builder не оставил AppImage в dist/.');
    process.exit(1);
  }
  return candidate;
}

function writeDesktopEntry() {
  fs.mkdirSync(APPLICATIONS, { recursive: true });
  const entry = [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    `Name=${NAME}`,
    'Comment=Сборка из рабочей копии — для проверки изменений',
    `Exec="${APPIMAGE}" %U`,
    `TryExec=${APPIMAGE}`,
    `Icon=${ICON}`,
    'Terminal=false',
    'Categories=Network;',
    'StartupWMClass=tiktok-octo',
    'Keywords=tiktok;video;social;',
    '',
  ].join('\n');
  fs.writeFileSync(DESKTOP_FILE, entry, 'utf8');

  // Индекс меню обновляем, если утилита есть; её отсутствие не ошибка.
  spawnSync('update-desktop-database', [APPLICATIONS], { stdio: 'ignore' });
}

function main() {
  buildAppImage();

  const artifact = findArtifact();
  // Замена через rename: старый AppImage может быть ещё запущен, и прямая
  // запись в него падает с ETXTBSY. Новый файл подменяет путь атомарно.
  const temp = `${APPIMAGE}.new`;
  try {
    fs.copyFileSync(artifact, temp);
    fs.chmodSync(temp, 0o755);
    fs.renameSync(temp, APPIMAGE);
  } finally {
    fs.rmSync(temp, { force: true });
  }

  writeDesktopEntry();

  console.log(`[octo] локальная сборка: ${path.relative(ROOT, APPIMAGE)}`);
  console.log(`[octo] пункт меню: ${DESKTOP_FILE}`);
  console.log('[octo] если приложение уже запущено, закройте старый экземпляр перед проверкой.');
}

main();
