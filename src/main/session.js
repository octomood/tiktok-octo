'use strict';

const { session } = require('electron');
const { PARTITION, CHROME_UA, isTikTokUrl, isAuthHost, isOAuthPopupUrl } = require('./shared');
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
  if (!rawUrl || !/^https:/i.test(rawUrl)) return false;
  if (!isTikTokUrl(rawUrl)) return isOAuthPopupUrl(rawUrl);
  return /\/(?:passport|login|signup|register|oauth|messages|inbox|business-suite|im\/|api\/v\d+\/im)/i.test(
    rawUrl,
  );
}

function deleteHeaderInsensitive(headers, targetLower) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === targetLower) delete headers[key];
  }
}

function setHeader(headers, name, value) {
  deleteHeaderInsensitive(headers, name.toLowerCase());
  headers[name] = value;
}

function clientHintValues() {
  const major = String(process.versions.chrome || '128.0.0.0').split('.')[0] || '128';
  const platform =
    process.platform === 'darwin'
      ? '"macOS"'
      : process.platform === 'win32'
        ? '"Windows"'
        : '"Linux"';
  return {
    ua: `"Chromium";v="${major}", "Not:A-Brand";v="8", "Google Chrome";v="${major}"`,
    mobile: '?0',
    platform,
  };
}

function installSessionHeaders(ses) {
  const hints = clientHintValues();
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (details, callback) => {
    const url = details.url || '';
    const isTikTok = isTikTokUrl(url);
    const isOAuth = !isTikTok && isOAuthPopupUrl(url);
    if (isTikTok) {
      region.applyRequestHeaders(details);
    }
    if ((isTikTok || isOAuth) && details.requestHeaders) {
      setHeader(details.requestHeaders, 'Sec-CH-UA', hints.ua);
      setHeader(details.requestHeaders, 'Sec-CH-UA-Mobile', hints.mobile);
      setHeader(details.requestHeaders, 'Sec-CH-UA-Platform', hints.platform);
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

function headerValuesCount(headers, targetLower) {
  if (!headers) return 0;
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() !== targetLower) continue;
    return Array.isArray(val) ? val.length : val ? 1 : 0;
  }
  return 0;
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
    } else if (isDiag) {
      logger.throttled(
        `net-diag:${details.method}:${details.resourceType}:${logger.sanitizeUrl(details.url)}`,
        500,
        'INFO',
        'net:diag',
        `HTTP ${code} ${details.method} ${details.resourceType}`,
        {
          url: logger.sanitizeUrl(details.url),
          setCookies: headerValuesCount(details.responseHeaders, 'set-cookie'),
          hasCors: headerValuesCount(details.responseHeaders, 'access-control-allow-origin') > 0,
          fromCache: details.fromCache,
        },
      );
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

  // Прокси, Accept-Language для TikTok и согласованные Client Hints.
  region.installSessionHooks(ses);
  installSessionHeaders(ses);
  installNetworkDiagnostics(ses);

  // Chromium сам добавляет веса (;q=0.9, …) к списку языков; если передать
  // уже взвешенную строку, получается битый заголовок «ru;q=0.9;q=0.9».
  ses.setUserAgent(CHROME_UA, 'ru-RU,ru,en-US,en');
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
