'use strict';

/**
 * Бейджи сообщества у ников пользователей в TikTok Octo.
 *
 * Список ролей и пользователей хранится в `src/main/badges.json` (работает
 * офлайн из сборки) и обновляется из GitHub в фоне main-процессом через
 * изолированную сессию с поддержкой ETag и локальным кэшем.
 *
 * Сами иконки — встроенные векторные SVG из `badge-icons.js` с `currentColor`
 * и CSS-анимацией: цвета автоматически подстраиваются под выбранную палитру
 * MD3 Expressive или под индивидуальный цвет роли/бейджа.
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, session } = require('electron');
const { resolveIconId, getBadgeSvg } = require('./badge-icons');
const { t } = require('./i18n');

const BUNDLED_PATH = path.join(__dirname, 'badges.json');
const DEFAULT_REMOTE_URL =
  'https://raw.githubusercontent.com/octomood/tiktok-octo/main/src/main/badges.json';
const SYNC_TIMEOUT_MS = 8000;
const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;
const MAX_REMOTE_BYTES = 512 * 1024;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const ACCENTS = new Set(['primary', 'secondary', 'tertiary']);

const BADGE_ATTR = 'data-octo-badged';
const BADGE_CLASS = 'octo-user-badge';
const MODAL_ATTR = 'data-octo-badge-modal';
const SCALLOP_PATH =
  'M50.0 4.0 C53.7 4.0 59.1 11.9 62.1 12.9 C65.0 13.9 74.1 10.6 77.0 12.8 C80.0 14.9 79.7 24.6 81.6 27.1 C83.4 29.6 92.6 32.3 93.7 35.8 C94.9 39.3 89.0 46.9 89.0 50.0 C89.0 53.1 94.9 60.7 93.7 64.2 C92.6 67.7 83.4 70.4 81.6 72.9 C79.7 75.4 80.0 85.1 77.0 87.2 C74.1 89.4 65.0 86.1 62.1 87.1 C59.1 88.1 53.7 96.0 50.0 96.0 C46.3 96.0 40.9 88.1 37.9 87.1 C35.0 86.1 25.9 89.4 23.0 87.2 C20.0 85.1 20.3 75.4 18.4 72.9 C16.6 70.4 7.4 67.7 6.3 64.2 C5.1 60.7 11.0 53.1 11.0 50.0 C11.0 46.9 5.1 39.3 6.3 35.8 C7.4 32.3 16.6 29.6 18.4 27.1 C20.3 24.6 20.0 14.9 23.0 12.8 C25.9 10.6 35.0 13.9 37.9 12.9 C40.9 11.9 46.3 4.0 50.0 4.0 Z';

let netSession = null;
let cachedConfig = null;
let syncTimer = null;
let onUpdate = null;

function getSession() {
  if (netSession) return netSession;
  netSession = session.fromPartition('octo-badges', { cache: false });
  netSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  return netSession;
}

function cacheFilePath() {
  try {
    return path.join(app.getPath('userData'), 'badges-cache.json');
  } catch {
    return '';
  }
}

function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function normalizeColor(raw) {
  const value = String(raw || '').trim();
  return COLOR_RE.test(value) ? value : '';
}

function normalizeAccent(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  return ACCENTS.has(value) ? value : 'primary';
}

function normalizeBadgeEntry(raw, roles) {
  if (!raw) return null;
  const spec = typeof raw === 'string' ? { role: raw } : raw;
  if (typeof spec !== 'object') return null;

  const roleKey = typeof spec.role === 'string' ? spec.role.trim() : '';
  const role = roleKey && roles[roleKey] ? roles[roleKey] : {};

  const icon = resolveIconId(spec.icon || role.icon || '01_code_brackets');
  const title = String(spec.title || role.title || 'Участник TikTok Octo')
    .trim()
    .slice(0, 80);
  const description = String(spec.description || role.description || '')
    .trim()
    .slice(0, 320);
  const color = normalizeColor(spec.color || role.color);
  const accent = normalizeAccent(spec.accent || role.accent);
  const since = typeof spec.since === 'string' ? spec.since.trim().slice(0, 32) : '';

  if (!title) return null;
  return { icon, title, description, color, accent, since };
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return { version: 1, users: {} };
  const rawRoles = raw.roles && typeof raw.roles === 'object' ? raw.roles : {};
  const roles = {};
  for (const [key, val] of Object.entries(rawRoles)) {
    if (!val || typeof val !== 'object') continue;
    roles[key] = {
      icon: resolveIconId(val.icon || '01_code_brackets'),
      title: String(val.title || '')
        .trim()
        .slice(0, 80),
      description: String(val.description || '')
        .trim()
        .slice(0, 320),
      color: normalizeColor(val.color),
      accent: normalizeAccent(val.accent),
    };
  }

  const rawUsers = raw.users && typeof raw.users === 'object' ? raw.users : {};
  const users = {};
  for (const [rawKey, rawVal] of Object.entries(rawUsers)) {
    const key = normalizeHandle(rawKey);
    if (!key) continue;
    const list = Array.isArray(rawVal) ? rawVal : [rawVal];
    const badges = list.map((item) => normalizeBadgeEntry(item, roles)).filter(Boolean);
    if (badges.length) users[key] = badges;
  }

  return {
    version: Number(raw.version) || 1,
    users,
  };
}

function readBundledConfig() {
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(BUNDLED_PATH, 'utf8')));
  } catch {
    return { version: 1, users: {} };
  }
}

function readDiskCache() {
  const file = cacheFilePath();
  if (!file) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
    return {
      etag: typeof parsed.etag === 'string' ? parsed.etag : '',
      data: normalizeConfig(parsed.data),
    };
  } catch {
    return null;
  }
}

function writeDiskCache(data, etag) {
  const file = cacheFilePath();
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ etag: etag || '', data }), 'utf8');
  } catch {
    /* запись кэша не критична */
  }
}

function getConfig() {
  if (cachedConfig) return cachedConfig;
  const bundled = readBundledConfig();
  const cached = readDiskCache();
  // Приоритет — более свежая или кэшированная удалённая конфигурация,
  // но встроенный `churros_dev` и прочие базовые записи не пропадают, если кэш устарел.
  if (cached && cached.data && Object.keys(cached.data.users).length > 0) {
    cachedConfig = {
      version: Math.max(bundled.version, cached.data.version),
      users: { ...bundled.users, ...cached.data.users },
    };
  } else {
    cachedConfig = bundled;
  }
  return cachedConfig;
}

function remoteUrl() {
  const override = process.env.OCTO_BADGES_URL;
  if (typeof override === 'string' && override.trim()) return override.trim();
  if (process.env.OCTO_E2E) return '';
  return DEFAULT_REMOTE_URL;
}

async function syncFromRemote() {
  const url = remoteUrl();
  if (!url) return false;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    const isLocal =
      parsedUrl.protocol === 'http:' &&
      (parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '[::1]');
    if (parsedUrl.protocol !== 'https:' && !isLocal) return false;
  } catch {
    return false;
  }

  const disk = readDiskCache();
  const headers = { Accept: 'application/json' };
  if (disk?.etag) headers['If-None-Match'] = disk.etag;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  try {
    const response = await getSession().fetch(parsedUrl.toString(), {
      headers,
      signal: controller.signal,
    });
    if (response.status === 304) return false;
    if (!response.ok) return false;

    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_REMOTE_BYTES) return false;

    const json = JSON.parse(text);
    const normalized = normalizeConfig(json);
    const etag = response.headers.get('etag') || '';
    writeDiskCache(json, etag);

    const bundled = readBundledConfig();
    cachedConfig = {
      version: Math.max(bundled.version, normalized.version),
      users: { ...bundled.users, ...normalized.users },
    };

    if (onUpdate) onUpdate();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function init({ onSynced } = {}) {
  onUpdate = typeof onSynced === 'function' ? onSynced : null;
  cachedConfig = null;
  getConfig();
  syncFromRemote().catch(() => {});
  if (syncTimer) clearInterval(syncTimer);
  if (remoteUrl()) {
    syncTimer = setInterval(() => {
      syncFromRemote().catch(() => {});
    }, SYNC_INTERVAL_MS);
    if (typeof syncTimer.unref === 'function') syncTimer.unref();
  }
}

function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function resetCacheForTests() {
  cachedConfig = null;
}

const BADGES_CSS = `
  button.${BADGE_CLASS}[id^="octo-badge-btn-"] {
    all: unset !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 auto !important;
    vertical-align: middle !important;
    width: 19px !important;
    height: 19px !important;
    margin: 0 0 0 5px !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: none !important;
    background-color: transparent !important;
    box-shadow: none !important;
    color: var(--octo-badge-color, var(--octo-md-primary, #9ac1fc)) !important;
    cursor: pointer !important;
    line-height: 1 !important;
    transition: transform 0.2s cubic-bezier(0.34, 1.45, 0.64, 1), opacity 0.15s ease !important;
    position: relative !important;
    z-index: 2 !important;
  }
  button.${BADGE_CLASS}[id^="octo-badge-btn-"][data-octo-badge-size="lg"] {
    width: 22px !important;
    height: 22px !important;
    margin-left: 7px !important;
  }
  button.${BADGE_CLASS}[id^="octo-badge-btn-"]:hover {
    background: none !important;
    background-color: transparent !important;
    transform: scale(1.18) !important;
  }
  button.${BADGE_CLASS}[id^="octo-badge-btn-"]:active {
    transform: scale(0.92) !important;
  }
  button.${BADGE_CLASS}[id^="octo-badge-btn-"]:focus-visible {
    outline: 2px solid var(--octo-md-primary, #9ac1fc) !important;
    outline-offset: 2px !important;
    border-radius: 6px !important;
  }
  .${BADGE_CLASS} svg,
  #octo-badge-modal-emblem-icon svg {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    overflow: visible !important;
  }

  /* Анимации MD3 Expressive для встроенных SVG-иконок */
  .ob-rock, .ob-float-tilt, .ob-spin-45, .ob-spin-36, .ob-spin-180, .ob-squash-tilt,
  .ob-float, .ob-heartbeat, .ob-bounce-tilt, .ob-alert, .ob-bell,
  .ob-nudge-l, .ob-nudge-r, .ob-tilt-pop, .ob-sparkle, .ob-sparkle-d,
  .ob-blink, .ob-wiggle-l, .ob-wiggle-r, .ob-pulse, .ob-flame,
  .ob-ember, .ob-bounce, .ob-wave, .ob-wave-d, .ob-dot0, .ob-dot1, .ob-dot2 {
    transform-box: fill-box;
    transform-origin: center;
  }
  .ob-rock { animation: octo-b-rock 2s ease-in-out infinite; }
  .ob-float-tilt { animation: octo-b-float-tilt 2s ease-in-out infinite; }
  .ob-float { animation: octo-b-float 2s ease-in-out infinite; }
  .ob-spin-45 { animation: octo-b-spin45 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }
  .ob-spin-36 { animation: octo-b-spin36 4s linear infinite; }
  .ob-spin-180 { animation: octo-b-spin180 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }
  .ob-squash-tilt { animation: octo-b-squash 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-heartbeat { animation: octo-b-heart 2s ease-in-out infinite; }
  .ob-bounce-tilt { animation: octo-b-bounce-tilt 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-alert { animation: octo-b-alert 2s ease-in-out infinite; }
  .ob-bell { transform-origin: 50% 18%; animation: octo-b-bell 2s ease-in-out infinite; }
  .ob-nudge-l { animation: octo-b-nudge-l 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-nudge-r { animation: octo-b-nudge-r 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-tilt-pop { animation: octo-b-tilt-pop 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-sparkle { animation: octo-b-sparkle 2s ease-in-out infinite; }
  .ob-sparkle-d { animation: octo-b-sparkle 2s ease-in-out 0.45s infinite; }
  .ob-blink { animation: octo-b-blink 2s ease-in-out infinite; }
  .ob-wiggle-l { transform-origin: 80% 80%; animation: octo-b-rock 1.2s ease-in-out infinite; }
  .ob-wiggle-r { transform-origin: 20% 80%; animation: octo-b-rock 1.2s ease-in-out 0.3s infinite; }
  .ob-pulse { animation: octo-b-pulse 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-flame { transform-origin: 50% 10%; animation: octo-b-pulse 1.2s ease-in-out infinite; }
  .ob-ember { animation: octo-b-ember 2s ease-out infinite; }
  .ob-bounce { animation: octo-b-bounce 2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite; }
  .ob-wave { animation: octo-b-wave 2s ease-in-out infinite; }
  .ob-wave-d { animation: octo-b-wave 2s ease-in-out 0.25s infinite; }
  .ob-dot0 { animation: octo-b-dot 1.8s ease-in-out 0s infinite; }
  .ob-dot1 { animation: octo-b-dot 1.8s ease-in-out 0.22s infinite; }
  .ob-dot2 { animation: octo-b-dot 1.8s ease-in-out 0.44s infinite; }

  @keyframes octo-b-rock { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(5deg); } }
  @keyframes octo-b-float-tilt { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-14px) rotate(5deg); } }
  @keyframes octo-b-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(12px, -16px); } }
  @keyframes octo-b-spin45 { 0% { transform: rotate(0deg); } 55%, 100% { transform: rotate(45deg); } }
  @keyframes octo-b-spin36 { 0% { transform: rotate(0deg); } 100% { transform: rotate(36deg); } }
  @keyframes octo-b-spin180 { 0%, 40% { transform: rotate(0deg); } 80%, 100% { transform: rotate(180deg); } }
  @keyframes octo-b-squash { 0%, 100% { transform: scale(1) rotate(-3deg); } 25% { transform: scale(1.12, 0.9) rotate(4deg); } 50% { transform: scale(0.94, 1.08) rotate(-2deg); } }
  @keyframes octo-b-heart { 0%, 60%, 100% { transform: scale(1); } 15% { transform: scale(1.16); } 30% { transform: scale(0.96); } 42% { transform: scale(1.1); } }
  @keyframes octo-b-bounce-tilt { 0%, 70%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-18px) rotate(-6deg); } 48% { transform: translateY(4px) rotate(3deg); } }
  @keyframes octo-b-alert { 0%, 65%, 100% { transform: rotate(0deg); } 14% { transform: rotate(8deg); } 28% { transform: rotate(-8deg); } 42% { transform: rotate(4deg); } }
  @keyframes octo-b-bell { 0%, 75%, 100% { transform: rotate(0deg); } 18% { transform: rotate(16deg); } 40% { transform: rotate(-14deg); } 58% { transform: rotate(6deg); } }
  @keyframes octo-b-nudge-l { 0%, 70%, 100% { transform: translateX(0); } 24% { transform: translateX(-22px); } 48% { transform: translateX(6px); } }
  @keyframes octo-b-nudge-r { 0%, 70%, 100% { transform: translateX(0); } 24% { transform: translateX(22px); } 48% { transform: translateX(-6px); } }
  @keyframes octo-b-tilt-pop { 0%, 70%, 100% { transform: rotate(0deg) scale(1); } 26% { transform: rotate(14deg) scale(1.08); } }
  @keyframes octo-b-sparkle { 0%, 100% { transform: scale(0.35) rotate(-20deg); opacity: 0.25; } 45% { transform: scale(1.18) rotate(35deg); opacity: 1; } 75% { transform: scale(0.85) rotate(65deg); opacity: 0.7; } }
  @keyframes octo-b-blink { 0%, 40%, 70%, 100% { opacity: 1; } 55%, 85% { opacity: 0.22; } }
  @keyframes octo-b-pulse { 0%, 70%, 100% { transform: scale(1); } 28% { transform: scale(1.16); } }
  @keyframes octo-b-ember { 0% { transform: translateY(16px) scale(0.6); opacity: 0; } 35% { opacity: 1; } 100% { transform: translateY(-56px) scale(0.9); opacity: 0; } }
  @keyframes octo-b-bounce { 0%, 65%, 100% { transform: translateY(0); } 25% { transform: translateY(-18px); } 45% { transform: translateY(4px); } }
  @keyframes octo-b-wave { 0%, 100% { opacity: 0.3; transform: scale(0.92); } 45% { opacity: 1; transform: scale(1.06); } }
  @keyframes octo-b-dot { 0%, 55%, 100% { transform: translateY(0); } 25% { transform: translateY(-22px); } }

  @media (prefers-reduced-motion: reduce) {
    .${BADGE_CLASS} *,
    #octo-badge-modal-emblem * {
      animation: none !important;
    }
  }

  /* Выразительное всплывающее окно сверху поверх страницы (MD3 Expressive) */
  #octo-badge-modal[${MODAL_ATTR}] {
    position: fixed !important;
    z-index: 2147483646 !important;
    width: min(364px, calc(100vw - 24px)) !important;
    border-radius: 28px !important;
    padding: 18px 18px 16px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    isolation: isolate !important;
    background:
      radial-gradient(
        148px 148px at 44px 44px,
        color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 26%, transparent),
        transparent 72%
      ),
      radial-gradient(
        210px 150px at 100% 100%,
        color-mix(in srgb, var(--octo-md-tertiary, var(--octo-badge-accent, #efb8c8)) 14%, transparent),
        transparent 72%
      ),
      color-mix(in srgb, var(--octo-md-surface-container-high, #24212e) 94%, transparent) !important;
    backdrop-filter: blur(18px) saturate(1.25) !important;
    color: var(--octo-md-on-surface, #f2ecf8) !important;
    border: 0 !important;
    box-shadow:
      0 22px 52px rgba(0, 0, 0, 0.48),
      0 6px 20px color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 18%, transparent) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 14px !important;
    font-family: var(--octo-font, 'Google Sans', 'Inter', system-ui, sans-serif) !important;
    animation: octo-badge-pop 0.28s cubic-bezier(0.34, 1.45, 0.64, 1) !important;
  }
  #octo-badge-modal-watermark {
    position: absolute !important;
    inset-inline-end: -22px !important;
    top: -22px !important;
    width: 112px !important;
    height: 112px !important;
    pointer-events: none !important;
    z-index: 0 !important;
    color: var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) !important;
    opacity: 0.085 !important;
    transform: rotate(14deg) !important;
  }
  #octo-badge-modal-head {
    position: relative !important;
    z-index: 1 !important;
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    background: transparent !important;
  }
  #octo-badge-modal-emblem {
    position: relative !important;
    width: 56px !important;
    height: 56px !important;
    flex: 0 0 56px !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background: transparent !important;
    display: grid !important;
    place-items: center !important;
    filter: drop-shadow(0 6px 14px color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 28%, transparent)) !important;
  }
  #octo-badge-modal-emblem-shape {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    z-index: 0 !important;
    pointer-events: none !important;
    fill: color-mix(
      in srgb,
      var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 24%,
      var(--octo-badge-container, var(--octo-md-primary-container, rgba(154, 193, 252, 0.22)))
    ) !important;
    stroke: color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 52%, transparent) !important;
    stroke-width: 2.2 !important;
    animation: octo-badge-scallop-spin 28s linear infinite !important;
  }
  #octo-badge-modal-emblem-icon {
    position: relative !important;
    z-index: 1 !important;
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) !important;
  }
  #octo-badge-modal-meta {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 6px !important;
    background: transparent !important;
  }
  #octo-badge-modal-title {
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    letter-spacing: -0.015em !important;
    line-height: 1.22 !important;
    color: var(--octo-md-on-surface, #f2ecf8) !important;
  }
  #octo-badge-modal-chips {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    background: transparent !important;
  }
  #octo-badge-modal-handle {
    display: inline-flex !important;
    align-items: center !important;
    padding: 3px 10px !important;
    border-radius: 9999px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
    background: color-mix(
      in srgb,
      var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 18%,
      var(--octo-badge-container, var(--octo-md-secondary-container, rgba(255, 255, 255, 0.1)))
    ) !important;
    border: 1px solid color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 36%, transparent) !important;
    color: var(--octo-badge-on-container, var(--octo-md-on-secondary-container, #e6e0e9)) !important;
  }
  #octo-badge-modal-handle::before {
    content: '' !important;
    width: 6px !important;
    height: 6px !important;
    border-radius: 9999px !important;
    margin-inline-end: 6px !important;
    flex: none !important;
    background: var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) !important;
    box-shadow: 0 0 8px color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 75%, transparent) !important;
  }
  #octo-badge-modal-since {
    display: inline-flex !important;
    align-items: center !important;
    padding: 3px 9px !important;
    border-radius: 9999px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    background: color-mix(in srgb, var(--octo-md-surface-container-highest, rgba(255, 255, 255, 0.08)) 86%, transparent) !important;
    border: 1px solid color-mix(in srgb, var(--octo-md-outline-variant, #49454f) 50%, transparent) !important;
    color: var(--octo-md-on-surface-variant, #cbc2da) !important;
  }
  #octo-badge-modal-close {
    all: unset !important;
    flex: 0 0 32px !important;
    width: 32px !important;
    height: 32px !important;
    align-self: flex-start !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    background-color: color-mix(in srgb, var(--octo-md-surface-container-highest, rgba(255, 255, 255, 0.1)) 82%, transparent) !important;
    border: 1px solid color-mix(in srgb, var(--octo-md-outline-variant, #49454f) 45%, transparent) !important;
    color: var(--octo-md-on-surface-variant, #cbc2da) !important;
    transition: background-color 0.14s ease, transform 0.14s ease !important;
  }
  #octo-badge-modal-close svg {
    width: 14px !important;
    height: 14px !important;
    display: block !important;
    flex: none !important;
  }
  #octo-badge-modal-close:hover {
    background-color: var(--octo-md-primary, #9ac1fc) !important;
    color: var(--octo-md-on-primary, #1f1f1f) !important;
    border-color: transparent !important;
    transform: scale(1.06) !important;
  }
  #octo-badge-modal-close:focus-visible {
    outline: 2px solid var(--octo-md-primary, #9ac1fc) !important;
    outline-offset: 2px !important;
  }
  #octo-badge-modal-desc {
    position: relative !important;
    z-index: 1 !important;
    margin: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
    padding: 12px 14px 12px 18px !important;
    border-radius: 16px !important;
    font-size: 13.5px !important;
    line-height: 1.48 !important;
    background:
      linear-gradient(
        135deg,
        color-mix(
          in srgb,
          var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 10%,
          var(--octo-md-surface-container, rgba(255, 255, 255, 0.06))
        ),
        color-mix(in srgb, var(--octo-md-surface-container-low, rgba(255, 255, 255, 0.03)) 90%, transparent)
      ) !important;
    border: 1px solid color-mix(
      in srgb,
      var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 18%,
      var(--octo-md-outline-variant, #49454f)
    ) !important;
    color: color-mix(in srgb, var(--octo-md-on-surface, #f2ecf8) 90%, var(--octo-md-on-surface-variant, #cbc2da)) !important;
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--octo-md-on-surface, #ffffff) 6%, transparent) !important;
  }
  #octo-badge-modal-desc::before {
    content: '' !important;
    position: absolute !important;
    inset-inline-start: 7px !important;
    top: 10px !important;
    bottom: 10px !important;
    width: 3px !important;
    border-radius: 9999px !important;
    background: linear-gradient(
      180deg,
      var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)),
      color-mix(in srgb, var(--octo-badge-accent, var(--octo-md-primary, #9ac1fc)) 45%, var(--octo-md-tertiary, #efb8c8))
    ) !important;
    opacity: 0.9 !important;
  }
  @keyframes octo-badge-pop {
    from { opacity: 0; transform: translateY(-8px) scale(0.94); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes octo-badge-scallop-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* «Уменьшить движение»: значок, кнопка закрытия и окно меняют состояние без
     пружин и появления. Блок стоит в конце, чтобы перекрыть правила выше. */
  @media (prefers-reduced-motion: reduce) {
    button.${BADGE_CLASS}[id^="octo-badge-btn-"],
    #octo-badge-modal-close {
      transition: none !important;
    }
    #octo-badge-modal[${MODAL_ATTR}] {
      animation: none !important;
    }
  }
`;

function badgesScript() {
  const cfg = getConfig();
  const icons = {};
  for (const list of Object.values(cfg.users)) {
    for (const item of list) {
      if (!icons[item.icon]) icons[item.icon] = getBadgeSvg(item.icon);
    }
  }

  const payload = {
    users: cfg.users,
    icons,
    labels: {
      close: t('Закрыть'),
    },
  };

  return `(() => {
  const DATA = ${JSON.stringify(payload)};
  const MARK = '${BADGE_ATTR}';
  const CLS = '${BADGE_CLASS}';
  const MODAL_MARK = '${MODAL_ATTR}';

  if (window.__octoBadges) {
    window.__octoBadges.update(DATA);
    return 0;
  }

  let currentData = DATA;
  let btnSeq = 0;

  const normHandle = (raw) => String(raw || '').trim().replace(/^@+/, '').toLowerCase();

  const accentToVar = (badge) => {
    if (badge.color) return badge.color;
    if (badge.accent === 'secondary') return 'var(--octo-md-secondary, #ccc2dc)';
    if (badge.accent === 'tertiary') return 'var(--octo-md-tertiary, #efb8c8)';
    return 'var(--octo-md-primary, #9ac1fc)';
  };

  const applyModalTone = (card, badge) => {
    if (badge.color) {
      card.style.setProperty('--octo-badge-accent', badge.color);
      card.style.setProperty(
        '--octo-badge-container',
        'color-mix(in srgb, ' + badge.color + ' 22%, var(--octo-md-surface-container-highest, #36343b))',
      );
      card.style.setProperty(
        '--octo-badge-on-container',
        'color-mix(in srgb, ' + badge.color + ' 78%, var(--octo-md-on-surface, #f2ecf8))',
      );
      return;
    }
    const role = badge.accent === 'secondary' || badge.accent === 'tertiary' ? badge.accent : 'primary';
    const fallback =
      role === 'secondary'
        ? { accent: '#ccc2dc', container: 'rgba(204, 194, 220, 0.22)', on: '#e8def8' }
        : role === 'tertiary'
          ? { accent: '#efb8c8', container: 'rgba(239, 184, 200, 0.22)', on: '#ffd8e4' }
          : { accent: '#9ac1fc', container: 'rgba(154, 193, 252, 0.22)', on: '#d3e3fd' };
    card.style.setProperty('--octo-badge-accent', 'var(--octo-md-' + role + ', ' + fallback.accent + ')');
    card.style.setProperty(
      '--octo-badge-container',
      'var(--octo-md-' + role + '-container, ' + fallback.container + ')',
    );
    card.style.setProperty(
      '--octo-badge-on-container',
      'var(--octo-md-on-' + role + '-container, ' + fallback.on + ')',
    );
  };

  const closeModal = () => {
    const existing = document.getElementById('octo-badge-modal');
    if (existing) existing.remove();
  };

  const positionPopover = (card, anchor) => {
    const rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const cardRect = card.getBoundingClientRect();
    const cw = cardRect.width || 364;
    const ch = cardRect.height || 180;

    let left = Math.round((vw - cw) / 2);
    let top = 18;
    if (rect && rect.width > 0 && rect.height > 0) {
      left = Math.round(rect.left + rect.width / 2 - cw / 2);
      top = Math.round(rect.bottom + 10);
      if (top + ch > vh - 14 && rect.top - ch - 10 >= 14) {
        top = Math.round(rect.top - ch - 10);
      }
    }
    left = Math.max(12, Math.min(vw - cw - 12, left));
    top = Math.max(12, Math.min(vh - ch - 12, top));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  };

  const openModal = (handle, badge, anchor) => {
    closeModal();
    const card = document.createElement('div');
    card.id = 'octo-badge-modal';
    card.setAttribute(MODAL_MARK, '1');
    card.setAttribute('aria-label', badge.title || '@' + handle);
    applyModalTone(card, badge);

    const watermark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    watermark.id = 'octo-badge-modal-watermark';
    watermark.setAttribute('viewBox', '0 0 100 100');
    watermark.setAttribute('aria-hidden', 'true');
    watermark.innerHTML = '<path fill="currentColor" d="${SCALLOP_PATH}"/>';

    const head = document.createElement('div');
    head.id = 'octo-badge-modal-head';

    const emblem = document.createElement('div');
    emblem.id = 'octo-badge-modal-emblem';

    const emblemShape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    emblemShape.id = 'octo-badge-modal-emblem-shape';
    emblemShape.setAttribute('viewBox', '0 0 100 100');
    emblemShape.setAttribute('aria-hidden', 'true');
    emblemShape.innerHTML = '<path d="${SCALLOP_PATH}"/>';

    const emblemIcon = document.createElement('div');
    emblemIcon.id = 'octo-badge-modal-emblem-icon';
    emblemIcon.innerHTML = currentData.icons[badge.icon] || '';

    emblem.append(emblemShape, emblemIcon);

    const meta = document.createElement('div');
    meta.id = 'octo-badge-modal-meta';

    const title = document.createElement('h3');
    title.id = 'octo-badge-modal-title';
    title.textContent = badge.title || '';

    const chips = document.createElement('div');
    chips.id = 'octo-badge-modal-chips';

    const handlePill = document.createElement('span');
    handlePill.id = 'octo-badge-modal-handle';
    handlePill.textContent = '@' + handle;
    chips.appendChild(handlePill);

    if (badge.since) {
      const sincePill = document.createElement('span');
      sincePill.id = 'octo-badge-modal-since';
      sincePill.textContent = badge.since;
      chips.appendChild(sincePill);
    }

    meta.append(title, chips);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'octo-badge-modal-close';
    closeBtn.type = 'button';
    closeBtn.className = 'octo-badge-modal-close';
    closeBtn.setAttribute('aria-label', currentData.labels?.close || 'Закрыть');
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18"/></svg>';
    closeBtn.addEventListener('click', closeModal);

    head.append(emblem, meta, closeBtn);
    card.append(watermark, head);

    if (badge.description) {
      const desc = document.createElement('p');
      desc.id = 'octo-badge-modal-desc';
      desc.textContent = badge.description;
      card.appendChild(desc);
    }

    (document.body || document.documentElement).appendChild(card);
    positionPopover(card, anchor);
  };

  const lookupBadges = (handle) => {
    const h = normHandle(handle);
    if (!h) return null;
    return currentData.users[h] || null;
  };

  const handleFromHref = (href) => {
    const match = String(href || '').match(/\\/@([a-zA-Z0-9._]{1,64})(?:[/?#]|$)/);
    return match ? normHandle(match[1]) : '';
  };

  const isNavOrHiddenHost = (el) =>
    Boolean(
      el.closest(
        'nav, [data-e2e="nav-profile"], [data-e2e="tiktok-logo"], #octo-badge-modal',
      ),
    );

  const attachBadges = (host, handle, size = 'sm') => {
    const list = lookupBadges(handle);
    if (!list || !list.length) return;
    const sig = handle + ':' + list.map((b) => b.icon + ':' + b.title).join('|');
    if (host.getAttribute(MARK) === sig && host.querySelector('.' + CLS)) return;

    host.querySelectorAll('.' + CLS).forEach((el) => el.remove());

    for (const badge of list) {
      btnSeq += 1;
      const btn = document.createElement('button');
      btn.id = 'octo-badge-btn-' + btnSeq;
      btn.type = 'button';
      btn.className = CLS;
      btn.setAttribute('data-octo-badge-icon', badge.icon);
      btn.setAttribute('data-octo-badge-user', handle);
      btn.setAttribute('data-octo-badge-size', size);
      btn.setAttribute('aria-label', badge.title);
      btn.title = badge.title;
      btn.style.setProperty('--octo-badge-color', accentToVar(badge));
      btn.innerHTML = currentData.icons[badge.icon] || '';
      btn.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          openModal(handle, badge, btn);
        },
        true,
      );
      host.appendChild(btn);
    }
    host.setAttribute(MARK, sig);
  };

  const findInlineHost = (el) => {
    let cur = el;
    for (let depth = 0; depth < 4; depth += 1) {
      const children = Array.from(cur.children).filter((c) => !c.classList?.contains(CLS));
      if (children.length !== 1) break;
      const only = children[0];
      if (only.querySelector('img, video, canvas')) break;
      if (!(only.textContent || '').trim()) break;
      cur = only;
    }
    return cur;
  };

  const scan = () => {
    const subtitle = document.querySelector('[data-e2e="user-subtitle"]');
    if (subtitle && !isNavOrHiddenHost(subtitle)) {
      const h = normHandle(subtitle.textContent) || handleFromHref(location.pathname);
      if (h && lookupBadges(h)) attachBadges(findInlineHost(subtitle), h, 'lg');
    } else {
      const title = document.querySelector('[data-e2e="user-title"]');
      if (title && !isNavOrHiddenHost(title)) {
        const h = handleFromHref(location.pathname);
        if (h && lookupBadges(h)) attachBadges(findInlineHost(title), h, 'lg');
      }
    }

    const candidates = document.querySelectorAll(
      'a[href*="/@"], [data-e2e="video-author-uniqueid"], [data-e2e="browse-username"], ' +
        '[data-e2e="comment-username-1"], [data-e2e="comment-username-2"], ' +
        '[data-e2e="search-card-user-unique-id"], [data-e2e="user-card-unique-id"], ' +
        '[data-octo-user-handle]',
    );

    candidates.forEach((el) => {
      if (el.hasAttribute(MARK) && el.querySelector('.' + CLS)) return;
      if (isNavOrHiddenHost(el)) return;
      if (el.closest('[' + MARK + ']') && el.closest('[' + MARK + ']') !== el) return;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 64) return;
      if (el.querySelector('img, video, canvas') && !el.querySelector('span, p, h3, h4')) return;

      const explicit = normHandle(el.getAttribute('data-octo-user-handle'));
      const fromHref = el.tagName === 'A' ? handleFromHref(el.getAttribute('href')) : '';
      const fromParentLink = !fromHref && el.closest('a[href*="/@"]')
        ? handleFromHref(el.closest('a[href*="/@"]').getAttribute('href'))
        : '';
      const fromText =
        !explicit && !fromHref && !fromParentLink ? normHandle(text) : '';
      const handle = explicit || fromHref || fromParentLink || fromText;
      if (!handle || !lookupBadges(handle)) return;

      const host = findInlineHost(el);
      if (host.closest('[' + MARK + ']') && host.closest('[' + MARK + ']') !== host) return;
      attachBadges(host, handle, 'sm');
    });
  };

  let timer = null;
  let dirtyWhileHidden = false;
  const schedule = () => {
    if (timer) return;
    if (document.visibilityState === 'hidden') {
      dirtyWhileHidden = true;
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      dirtyWhileHidden = false;
      scan();
    }, 220);
  };
  const onVisibility = () => {
    if (document.visibilityState !== 'hidden' && dirtyWhileHidden) schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target instanceof Element && (m.target.id?.startsWith('octo-') || m.target.closest('#octo-badge-modal'))) {
        continue;
      }
      if (m.addedNodes && m.addedNodes.length) {
        for (const node of m.addedNodes) {
          if (
            node.nodeType === 1 &&
            !node.id?.startsWith('octo-') &&
            !node.classList?.contains(CLS) &&
            node.tagName !== 'SVG' &&
            node.tagName !== 'PATH' &&
            node.tagName !== 'VIDEO'
          ) {
            schedule();
            return;
          }
        }
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  const onKeyDown = (event) => {
    if (event.key === 'Escape') closeModal();
  };
  const onPointerDown = (event) => {
    const modal = document.getElementById('octo-badge-modal');
    if (!modal) return;
    const target = event.target;
    if (target instanceof Element && (modal.contains(target) || target.closest('.' + CLS))) {
      return;
    }
    closeModal();
  };
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);

  window.__octoBadges = {
    scan,
    update(nextData) {
      currentData = nextData;
      document.querySelectorAll('[' + MARK + ']').forEach((el) => el.removeAttribute(MARK));
      scan();
    },
    stop() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (timer) clearTimeout(timer);
      closeModal();
      document.querySelectorAll('.' + CLS).forEach((el) => el.remove());
      document.querySelectorAll('[' + MARK + ']').forEach((el) => el.removeAttribute(MARK));
      delete window.__octoBadges;
    },
  };

  scan();
  return 1;
})()`;
}

const BADGES_CLEANUP_JS = `(() => {
  if (window.__octoBadges) {
    window.__octoBadges.stop();
    return;
  }
  const modal = document.getElementById('octo-badge-modal');
  if (modal) modal.remove();
  document.querySelectorAll('.${BADGE_CLASS}').forEach((el) => el.remove());
  document.querySelectorAll('[${BADGE_ATTR}]').forEach((el) => el.removeAttribute('${BADGE_ATTR}'));
})()`;

module.exports = {
  init,
  stopSync,
  syncFromRemote,
  getConfig,
  resetCacheForTests,
  BADGES_CSS,
  badgesScript,
  BADGES_CLEANUP_JS,
};
