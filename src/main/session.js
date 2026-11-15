'use strict';

const { session } = require('electron');
const { PARTITION, CHROME_UA, isTikTokUrl } = require('./shared');
const downloads = require('./downloads');

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
]);

const preparedSessions = new Set();

/** Разрешения выдаём только самому TikTok, а не любому хосту в этой сессии. */
function isTrustedOrigin(url) {
  return isTikTokUrl(url);
}

function prepareSession() {
  const ses = session.fromPartition(PARTITION);

  // Окно могут пересоздать (macOS activate) — обработчики ставим один раз.
  if (preparedSessions.has(ses)) return ses;
  preparedSessions.add(ses);

  ses.setUserAgent(CHROME_UA, 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');

  try {
    const available = ses.availableSpellCheckerLanguages;
    const wanted = ['ru', 'en-US'].filter((lang) => available.includes(lang));
    if (wanted.length > 0) ses.setSpellCheckerLanguages(wanted);
  } catch {
    /* раскладка может быть недоступна в урезанной сборке */
  }

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
  ses.on('will-download', (_event, item) => downloads.handle(item));

  return ses;
}

module.exports = { prepareSession, ALLOWED_PERMISSIONS };
