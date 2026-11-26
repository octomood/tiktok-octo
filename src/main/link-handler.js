'use strict';

const { execFileSync, spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, writeState } = require('./store');
const { externalHttpUrlFromArgv, targetFromArgv } = require('./deep-link-url');

/**
 * Системный диспетчер http/https-ссылок (Linux).
 *
 * Linux (XDG) не умеет назначать обработчик только на домен tiktok.com:
 * регистрируется схема целиком (x-scheme-handler/http и https). Поэтому при
 * включении запоминаем прежний браузер по умолчанию, перехватываем ссылки
 * TikTok в TikTok Octo, а все остальные адреса сразу передаём в прежний
 * браузер — без открытия окна клиента.
 */

const HANDLER_DESKTOP = 'tiktok-octo-handler.desktop';
const OWN_DESKTOPS = new Set([HANDLER_DESKTOP, 'tiktok-octo.desktop', 'tiktok-octo-local.desktop']);

const KNOWN_BROWSER_DESKTOPS = [
  'google-chrome.desktop',
  'firefox.desktop',
  'firefox_firefox.desktop',
  'chromium.desktop',
  'chromium_chromium.desktop',
  'brave-browser.desktop',
  'vivaldi-stable.desktop',
  'microsoft-edge.desktop',
  'zen.desktop',
  'librewolf.desktop',
  'opera.desktop',
  'org.gnome.Epiphany.desktop',
];

const KNOWN_BROWSER_BINS = [
  'firefox',
  'google-chrome',
  'chromium',
  'chromium-browser',
  'brave-browser',
  'vivaldi',
  'microsoft-edge',
  'zen-browser',
  'librewolf',
  'opera',
  'epiphany',
];

function isAvailable() {
  return process.platform === 'linux' && !process.env.FLATPAK_ID;
}

function dataHome() {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

function applicationsDir() {
  return path.join(dataHome(), 'applications');
}

function handlerDesktopPath() {
  return path.join(applicationsDir(), HANDLER_DESKTOP);
}

function applicationSearchDirs() {
  const dirs = [applicationsDir()];
  const xdgDirs = (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
    .split(':')
    .filter(Boolean);
  for (const base of xdgDirs) {
    dirs.push(path.join(base, 'applications'));
  }
  dirs.push(
    path.join(os.homedir(), '.local', 'share', 'flatpak', 'exports', 'share', 'applications'),
    '/var/lib/flatpak/exports/share/applications',
  );
  return [...new Set(dirs)];
}

function findDesktopFile(desktopId) {
  if (!desktopId || typeof desktopId !== 'string') return '';
  const clean = path.basename(desktopId.trim());
  if (!clean.endsWith('.desktop')) return '';
  for (const dir of applicationSearchDirs()) {
    const candidate = path.join(dir, clean);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* игнорируем недоступные каталоги */
    }
  }
  return '';
}

function runQuery(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function queryDefaultDesktop(scheme = 'x-scheme-handler/https') {
  return runQuery('xdg-mime', ['query', 'default', scheme]);
}

function isEnabled() {
  if (!isAvailable()) return false;
  if (!fs.existsSync(handlerDesktopPath())) return false;
  return queryDefaultDesktop('x-scheme-handler/https') === HANDLER_DESKTOP;
}

function detectFallbackBrowser() {
  const saved = readState().fallbackBrowserDesktop;
  if (saved && !OWN_DESKTOPS.has(saved) && findDesktopFile(saved)) {
    return saved;
  }

  const candidates = [
    queryDefaultDesktop('x-scheme-handler/https'),
    runQuery('xdg-settings', ['get', 'default-web-browser']),
    queryDefaultDesktop('x-scheme-handler/http'),
    ...KNOWN_BROWSER_DESKTOPS,
  ];

  for (const id of candidates) {
    if (!id || OWN_DESKTOPS.has(id)) continue;
    if (findDesktopFile(id)) return id;
  }
  return '';
}

function executablePath() {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') return app.getPath('exe');
  } catch {
    /* вызывается вне Electron или до инициализации */
  }
  return process.execPath;
}

function handlerDesktopEntry(execPath) {
  const escaped = execPath.replace(/"/g, '\\"');
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    'Name=TikTok Octo (обработчик ссылок)',
    'Comment=Открывает ссылки TikTok в клиенте, остальные — в браузере',
    `Exec="${escaped}" --open-link %U`,
    'Icon=tiktok-octo',
    'Terminal=false',
    'NoDisplay=true',
    'Categories=Network;',
    'MimeType=x-scheme-handler/http;x-scheme-handler/https;',
    '',
  ].join('\n');
}

function refreshDesktopDatabase() {
  spawnSync('update-desktop-database', [applicationsDir()], { stdio: 'ignore', timeout: 2000 });
}

function setXdgBrowser(desktopId) {
  const mime = spawnSync(
    'xdg-mime',
    ['default', desktopId, 'x-scheme-handler/http', 'x-scheme-handler/https'],
    { stdio: 'ignore', timeout: 2000 },
  );
  // xdg-settings может не работать на минимальных WM без DE — не считаем ошибкой.
  spawnSync('xdg-settings', ['set', 'default-web-browser', desktopId], {
    stdio: 'ignore',
    timeout: 2000,
  });
  return mime.status === 0;
}

function enable() {
  if (!isAvailable()) {
    return { ok: false, error: 'Доступно только на Linux' };
  }
  const fallback = detectFallbackBrowser();
  if (fallback) {
    writeState({ fallbackBrowserDesktop: fallback });
  }

  try {
    fs.mkdirSync(applicationsDir(), { recursive: true });
    fs.writeFileSync(handlerDesktopPath(), handlerDesktopEntry(executablePath()), {
      mode: 0o644,
    });
    refreshDesktopDatabase();
    if (!setXdgBrowser(HANDLER_DESKTOP)) {
      return { ok: false, error: 'xdg-mime не удалось назначить обработчик' };
    }
    return { ok: true, fallback };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function disable() {
  if (!isAvailable()) return { ok: false, error: 'Доступно только на Linux' };
  const fallback = detectFallbackBrowser();
  if (fallback) {
    setXdgBrowser(fallback);
  }
  try {
    fs.rmSync(handlerDesktopPath(), { force: true });
    refreshDesktopDatabase();
    return { ok: true, fallback };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Разбирает строку Exec= из .desktop по спецификации Freedesktop и
 * подставляет URL вместо %u/%U (или добавляет в конец).
 */
function parseExecLine(execLine, url) {
  if (!execLine || typeof execLine !== 'string') return null;
  const tokens = [];
  let current = '';
  let quote = '';
  let escaped = false;

  for (let i = 0; i < execLine.length; i += 1) {
    const ch = execLine[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  if (tokens.length === 0) return null;

  const cmd = tokens[0];
  const args = [];
  let inserted = false;

  for (const token of tokens.slice(1)) {
    if (token === '%u' || token === '%U' || token === '%f' || token === '%F') {
      args.push(url);
      inserted = true;
    } else if (/^%[ick]$/.test(token)) {
      continue;
    } else if (token.includes('%u') || token.includes('%U')) {
      args.push(token.replace(/%[uU]/g, url));
      inserted = true;
    } else {
      args.push(token);
    }
  }
  if (!inserted) args.push(url);
  return { cmd, args };
}

function readDesktopExec(desktopPath) {
  try {
    const content = fs.readFileSync(desktopPath, 'utf8');
    let inMainSection = false;
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('[')) {
        inMainSection = line === '[Desktop Entry]';
        continue;
      }
      if (inMainSection && line.startsWith('Exec=')) {
        return line.slice(5).trim();
      }
    }
  } catch {
    /* файл недоступен */
  }
  return '';
}

function spawnDetached(cmd, args) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function openInFallbackBrowser(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  } catch {
    return false;
  }

  const fallbackId = detectFallbackBrowser();
  if (fallbackId) {
    const desktopPath = findDesktopFile(fallbackId);
    const execLine = desktopPath ? readDesktopExec(desktopPath) : '';
    const parsedExec = parseExecLine(execLine, url);
    if (parsedExec && spawnDetached(parsedExec.cmd, parsedExec.args)) {
      return true;
    }
  }

  // Если .desktop не найден, пробуем известные бинарники напрямую (без xdg-open,
  // чтобы не зациклиться, если обработчик всё ещё указывает на нас).
  for (const bin of KNOWN_BROWSER_BINS) {
    const found = spawnSync('which', [bin], { stdio: 'ignore', timeout: 1000 });
    if (found.status === 0 && spawnDetached(bin, [url])) {
      return true;
    }
  }
  return false;
}

/**
 * Быстрый проброс не-TikTok ссылки на старте процесса до захвата single-instance
 * блокировки: окно клиента не поднимается и не получает фокус.
 */
function dispatchEarlyFromArgv(argv) {
  if (!isAvailable()) return false;
  if (targetFromArgv(argv)) return false;
  const extUrl = externalHttpUrlFromArgv(argv);
  if (!extUrl) return false;
  openInFallbackBrowser(extUrl);
  return true;
}

module.exports = {
  HANDLER_DESKTOP,
  OWN_DESKTOPS,
  isAvailable,
  isEnabled,
  enable,
  disable,
  detectFallbackBrowser,
  findDesktopFile,
  parseExecLine,
  readDesktopExec,
  openInFallbackBrowser,
  dispatchEarlyFromArgv,
};
