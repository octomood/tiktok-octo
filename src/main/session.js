'use strict';

const { app, session } = require('electron');
const path = require('node:path');
const { PARTITION, CHROME_UA, isTikTokUrl } = require('./shared');
const { ctx, pushState, toast } = require('./app-context');

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

function handleDownload(item) {
  const name = item.getFilename();

  item.setSaveDialogOptions({
    title: 'Сохранить файл',
    defaultPath: path.join(app.getPath('downloads'), name),
  });

  const publish = (percent) => {
    ctx.download = { name, percent };
    pushState();
  };

  publish(0);

  let lastPercent = -1;
  item.on('updated', (_event, state) => {
    if (state !== 'progressing') return;
    const total = item.getTotalBytes();
    const percent = total > 0 ? Math.round((item.getReceivedBytes() / total) * 100) : 0;
    if (percent === lastPercent) return;
    lastPercent = percent;
    publish(percent);
  });

  item.once('done', (_event, state) => {
    ctx.download = null;
    toast(state === 'completed' ? 'Загрузка завершена' : 'Загрузка прервана');
    pushState();
  });
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

  // Загрузки: системный диалог сохранения + прогресс в полосе заголовка.
  ses.on('will-download', (_event, item) => handleDownload(item));

  return ses;
}

module.exports = { prepareSession, ALLOWED_PERMISSIONS };
