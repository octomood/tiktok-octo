'use strict';

const { session } = require('electron');
const { PARTITION, CHROME_UA, isTikTokUrl } = require('./shared');
const downloads = require('./downloads');
const region = require('./region');
const { findAppLanguage } = require('./language-catalog');
const { readState } = require('./store');

/**
 * Разрешения, которые реально нужны сайту.
 *
 * display-capture и прочий screen sharing не нужны: чем меньше выдано,
 * тем меньше поверхность атаки у недоверенной страницы.
 */
const ALLOWED_PERMISSIONS = new Set([
  'media', // камера и микрофон для записи/загрузки видео
  'notifications',
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock',
  'background-sync',
  // Выбор аудиовыхода: setSinkId для конкретного устройства требует этого
  // разрешения. Захвата звука оно не даёт — только выбор, куда его выводить.
  'speaker-selection',
]);

const preparedSessions = new Set();

/** Разрешения выдаём только самому TikTok, а не любому хосту в этой сессии. */
function isTrustedOrigin(url) {
  return isTikTokUrl(url);
}

/** Языки проверки орфографии: язык оболочки, русский и английский. */
function applySpellChecker(ses = session.fromPartition(PARTITION)) {
  try {
    const available = ses.availableSpellCheckerLanguages;
    const app = findAppLanguage(readState().language);
    const wanted = [app.spellcheck, 'ru', 'en-US']
      .filter(Boolean)
      .filter((lang, index, list) => list.indexOf(lang) === index)
      .filter((lang) => available.includes(lang));
    if (wanted.length > 0) ses.setSpellCheckerLanguages(wanted);
  } catch {
    /* раскладка может быть недоступна в урезанной сборке */
  }
}

function prepareSession() {
  const ses = session.fromPartition(PARTITION);

  // Окно могут пересоздать (macOS activate) — обработчики ставим один раз.
  if (preparedSessions.has(ses)) return ses;
  preparedSessions.add(ses);

  // Accept-Language для TikTok и сохранённый прокси (см. region.js).
  region.installSessionHooks(ses);

  ses.setUserAgent(CHROME_UA, 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');
  applySpellChecker(ses);

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (!ALLOWED_PERMISSIONS.has(permission)) return callback(false);
    const origin = details?.requestingUrl || wc?.getURL() || '';
    callback(isTrustedOrigin(origin));
  });

  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) => {
    if (!ALLOWED_PERMISSIONS.has(permission)) return false;
    return isTrustedOrigin(requestingOrigin || wc?.getURL() || '');
  });

  // Загрузки: системный диалог сохранения + очередь и прогресс в панели.
  ses.on('will-download', (_event, item, webContents) => downloads.handle(item, webContents));

  return ses;
}

module.exports = { prepareSession, applySpellChecker, ALLOWED_PERMISSIONS };
