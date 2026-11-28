'use strict';

const { session } = require('electron');
const { PARTITION, CHROME_UA, isTikTokUrl, isAuthHost } = require('./shared');
const downloads = require('./downloads');
const region = require('./region');
const { findAppLanguage } = require('./language-catalog');
const { readState } = require('./store');
const logger = require('./logger');

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
function applySpellChecker(ses) {
  const target = ses || session.fromPartition(require('./profiles').activePartition());
  try {
    const available = target.availableSpellCheckerLanguages;
    const app = findAppLanguage(readState().language);
    const wanted = [app.spellcheck, 'ru', 'en-US']
      .filter(Boolean)
      .filter((lang, index, list) => list.indexOf(lang) === index)
      .filter((lang) => available.includes(lang));
    if (wanted.length > 0) target.setSpellCheckerLanguages(wanted);
    logger.debug('session', 'spellchecker languages applied', { wanted });
  } catch (err) {
    logger.warn('session', 'spellchecker setup failed', err?.message);
  }
}

function isDiagnosticEndpoint(rawUrl) {
  if (!rawUrl) return false;
  if (isAuthHost(rawUrl)) return true;
  if (!isTikTokUrl(rawUrl)) return false;
  return /\/(?:passport|login|oauth|messages|inbox|business-suite|im\/|api\/v\d+\/im)/i.test(
    rawUrl,
  );
}

function installNetworkDiagnostics(ses) {
  const filter = { urls: ['https://*/*', 'http://*/*'] };

  ses.webRequest.onBeforeRedirect(filter, (details) => {
    const isFrame = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
    if (
      !isFrame &&
      !isDiagnosticEndpoint(details.url) &&
      !isDiagnosticEndpoint(details.redirectURL)
    ) {
      return;
    }
    logger.throttled(
      `net-redir:${details.resourceType}:${logger.sanitizeUrl(details.url)}`,
      1000,
      'INFO',
      'net:redirect',
      `${details.statusCode} ${details.resourceType}`,
      {
        from: logger.sanitizeUrl(details.url),
        to: logger.sanitizeUrl(details.redirectURL),
      },
    );
  });

  ses.webRequest.onCompleted(filter, (details) => {
    const code = Number(details.statusCode) || 0;
    const isFrame = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
    const isDiag = isDiagnosticEndpoint(details.url);
    if (code >= 400 && (isFrame || isDiag)) {
      logger.warn('net:http', `HTTP ${code} ${details.method} ${details.resourceType}`, {
        url: logger.sanitizeUrl(details.url),
        fromCache: details.fromCache,
      });
    } else if (isFrame && isAuthHost(details.url)) {
      logger.info('net:auth', `HTTP ${code} ${details.method} ${details.resourceType}`, {
        url: logger.sanitizeUrl(details.url),
      });
    }
  });

  ses.webRequest.onErrorOccurred(filter, (details) => {
    if (details.error === 'net::ERR_ABORTED') return;
    const isFrame = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
    const isDiag = isDiagnosticEndpoint(details.url);
    if (isFrame || isDiag) {
      logger.warn('net:err', `${details.error} ${details.method} ${details.resourceType}`, {
        url: logger.sanitizeUrl(details.url),
      });
      return;
    }
    if (isTikTokUrl(details.url)) {
      logger.throttled(
        `net-err:${details.error}:${details.resourceType}`,
        5000,
        'DEBUG',
        'net:err',
        `${details.error} ${details.resourceType}`,
        { url: logger.sanitizeUrl(details.url) },
      );
    }
  });
}

function prepareSession(partition) {
  const part = partition || require('./profiles').activePartition() || PARTITION;
  const ses = session.fromPartition(part);

  // Окно могут пересоздать (macOS activate) — обработчики ставим один раз.
  if (preparedSessions.has(ses)) return ses;
  preparedSessions.add(ses);
  logger.info('session', 'prepareSession', { partition: part });

  // Accept-Language для TikTok и сохранённый прокси (см. region.js).
  region.installSessionHooks(ses);
  installNetworkDiagnostics(ses);

  ses.setUserAgent(CHROME_UA, 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');
  applySpellChecker(ses);

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = details?.requestingUrl || wc?.getURL() || '';
    if (!ALLOWED_PERMISSIONS.has(permission)) {
      logger.info('perm', 'request denied (not allowed)', {
        permission,
        origin: logger.sanitizeUrl(origin),
      });
      return callback(false);
    }
    const allowed = isTrustedOrigin(origin);
    logger.info('perm', allowed ? 'request granted' : 'request denied (untrusted)', {
      permission,
      origin: logger.sanitizeUrl(origin),
    });
    callback(allowed);
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
