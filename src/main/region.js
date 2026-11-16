'use strict';

const { app, ipcMain, session } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { HOME_URL, PARTITION } = require('./shared');
const { REGION_PRESETS, findPreset } = require('./region-catalog');
const { SITE_LANGUAGES, findSiteLanguage, findAppLanguage } = require('./language-catalog');
const { showMessageBox } = require('./dialogs');
const { t } = require('./i18n');
const cosmetics = require('./cosmetics');

/**
 * Подмена региона.
 *
 * Что реально меняется на стороне приложения:
 *   • Accept-Language для запросов к tiktok.com;
 *   • язык navigator, часовой пояс Intl/Date и координаты геолокации
 *     (через region-preload.js);
 *   • прокси для всей сессии, если пользователь его указал.
 *
 * IP-адрес меняет только прокси или системный VPN: без них сайт видит
 * настоящий адрес, а пресет влияет лишь на браузерные сигналы. Приложение
 * не поставляет прокси и не притворяется, что делает это за пользователя.
 */

const PROXY_SCHEMES = new Set(['http:', 'https:', 'socks4:', 'socks5:']);

/**
 * Сервисы, которые возвращают внешний IP. Проверка идёт через сессию TikTok,
 * то есть через тот же прокси, что и сам сайт.
 */
const IP_SERVICES = [
  {
    url: 'https://ipinfo.io/json',
    parse: (json) => ({ ip: json.ip, country: json.country, city: json.city }),
  },
  {
    url: 'https://api.myip.com',
    parse: (json) => ({ ip: json.ip, country: json.cc || json.country, city: '' }),
  },
  {
    url: 'https://ifconfig.co/json',
    parse: (json) => ({
      ip: json.ip,
      country: json.country_iso || json.country,
      city: json.city,
    }),
  },
];

let onChange = null;
let checkToken = 0;

function activePreset() {
  return findPreset(ctx.region.preset);
}

function sync() {
  const state = readState();
  const saved = state.region;
  const preset = findPreset(saved?.preset);
  ctx.region = {
    preset: preset.id,
    proxy: typeof saved?.proxy === 'string' ? saved.proxy.trim() : '',
  };
  ctx.siteLanguage = findSiteLanguage(state.siteLanguage)?.id || 'auto';
  ctx.regionCheck = { state: 'idle', text: 'Проверить' };
}

function activeSiteLanguage() {
  return findSiteLanguage(ctx.siteLanguage);
}

/** Cookie default_lang — документированный способ сказать TikTok о языке. */
async function applySiteLanguageCookie(ses, { clear = false } = {}) {
  if (!ses) return;
  const site = activeSiteLanguage();

  if (!site) {
    if (!clear) return;
    let cookies = [];
    try {
      cookies = await ses.cookies.get({ name: 'default_lang' });
    } catch {
      return;
    }
    for (const cookie of cookies) {
      const host = String(cookie.domain || 'www.tiktok.com').replace(/^\./, '');
      try {
        await ses.cookies.remove(`https://${host}${cookie.path || '/'}`, cookie.name);
      } catch {
        /* cookie уже удалена */
      }
    }
    return;
  }

  const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const common = {
    name: 'default_lang',
    value: site.tiktok,
    path: '/',
    secure: true,
    expirationDate,
  };

  // Дублируем host-only и доменную cookie: часть сборок TikTok читает только
  // конкретный хост, а часть — общую cookie домена.
  for (const cookie of [
    { ...common, url: 'https://www.tiktok.com/' },
    { ...common, url: 'https://tiktok.com/' },
    { ...common, url: 'https://www.tiktok.com/', domain: '.tiktok.com' },
  ]) {
    try {
      await ses.cookies.set(cookie);
    } catch (err) {
      if (process.env.OCTO_DEBUG) console.warn('[octo] language cookie failed:', err.message);
    }
  }
}

function appSession() {
  return ctx.view?.webContents.session || session.fromPartition(PARTITION);
}

/** Код страны → название на языке интерфейса (US → США / USA). */
function countryName(code) {
  if (!code) return '';
  const value = String(code).trim();
  if (value.length > 3) return value;
  try {
    const locale = findAppLanguage(ctx.language).locale;
    return new Intl.DisplayNames([locale], { type: 'region' }).of(value.toUpperCase()) || value;
  } catch {
    return value;
  }
}

/** Внешний IP через текущий прокси — для проверки, что страна действительно та. */
async function checkIp() {
  const ses = appSession();
  if (!ses) return;

  const token = ++checkToken;
  ctx.regionCheck = { state: 'loading', text: 'Проверяю…' };
  pushState();

  for (const service of IP_SERVICES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await ses.fetch(service.url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) continue;

      const info = service.parse(await response.json());
      if (!info.ip) continue;

      const text = [info.ip, countryName(info.country), info.city].filter(Boolean).join(' · ');
      if (token !== checkToken) return;
      ctx.regionCheck = { state: 'done', text };
      pushState();
      toast(`Внешний IP: ${text}`);
      return;
    } catch {
      /* сервис недоступен — пробуем следующий */
    } finally {
      clearTimeout(timer);
    }
  }

  if (token !== checkToken) return;
  ctx.regionCheck = { state: 'error', text: t('Не удалось проверить') };
  pushState();
  toast('Не удалось узнать внешний IP — проверьте прокси и сеть');
}

/**
 * Сброс cookies и хранилищ TikTok, чтобы сайт заново определил регион по
 * текущему IP. Вход придётся повторить — поэтому сначала спрашиваем.
 */
async function resetSiteData() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  const options = {
    type: 'warning',
    buttons: ['Отмена', 'Сбросить'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: 'Сбросить данные TikTok',
    message: 'Удалить cookies, кэш и вход в TikTok?',
    detail: 'Придётся войти заново. Это помогает TikTok заново определить регион по текущему IP.',
  };
  const { response } = ctx.win
    ? await showMessageBox(ctx.win, options)
    : await showMessageBox(options);
  if (response !== 1) return;

  const ses = wc.session;
  ctx.regionCheck = { state: 'idle', text: 'Проверить' };
  pushState();

  try {
    await ses.clearData({
      dataTypes: [
        'cache',
        'cookies',
        'indexedDB',
        'localStorage',
        'serviceWorkers',
        'webSQL',
        'fileSystems',
      ],
      origins: ['https://www.tiktok.com', 'https://tiktok.com'],
    });
    await ses.clearHostResolverCache();
    // Сброс стёр cookie темы и языка — вернём их до перезагрузки страницы.
    await cosmetics.prepareTheme(ses);
    await applySiteLanguageCookie(ses);
    wc.loadURL(HOME_URL);
    toast('Данные TikTok сброшены — войдите заново');
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] clear data failed:', err.message);
    toast('Не удалось сбросить данные сайта');
  }
}

function persist(patch) {
  const saved = readState().region;
  writeState({
    region: { ...(saved && typeof saved === 'object' ? saved : {}), ...patch },
  });
}

/**
 * Разбирает адрес прокси. Без схемы считаем, что это SOCKS5:
 * локальные VPN-клиенты чаще всего отдают именно его.
 */
function parseProxy(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: true, rules: '', auth: null };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `socks5://${text}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, rules: '', auth: null };
  }

  const defaultPort = url.protocol === 'http:' || url.protocol === 'https:';
  if (!PROXY_SCHEMES.has(url.protocol) || !url.hostname || (!url.port && !defaultPort)) {
    return { ok: false, rules: '', auth: null };
  }

  const auth = url.username
    ? {
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      }
    : null;

  return { ok: true, rules: `${url.protocol}//${url.host}`, auth };
}

function proxyConfig(raw) {
  const parsed = parseProxy(raw);
  if (!parsed.ok || !parsed.rules) return { mode: 'system' };
  return { proxyRules: parsed.rules, proxyBypassRules: '<local>' };
}

/** Подпись для меню — без логина и пароля, которые могут быть в адресе. */
function proxyLabel() {
  const parsed = parseProxy(ctx.region.proxy);
  if (!parsed.rules) return 'Прокси не задан';
  return `Прокси: ${parsed.rules}`;
}

function reloadView(ignoreCache = false) {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  if (ignoreCache) wc.reloadIgnoringCache();
  else wc.reload();
}

function applyProxy(ses) {
  if (!ses) return;
  ses.setProxy(proxyConfig(ctx.region.proxy)).catch((err) => {
    if (process.env.OCTO_DEBUG) console.warn('[octo] proxy failed:', err.message);
  });
}

/**
 * Вешается на persistent-сессию один раз: переписывает Accept-Language
 * только у TikTok и восстанавливает сохранённый прокси при старте.
 */
function installSessionHooks(ses) {
  applyProxy(ses);
  applySiteLanguageCookie(ses).catch(() => {});

  ses.webRequest.onBeforeSendHeaders(
    { urls: ['*://tiktok.com/*', '*://*.tiktok.com/*'] },
    (details, callback) => {
      const preset = activePreset();
      const site = activeSiteLanguage();
      const acceptLanguage = site?.acceptLanguage || preset.acceptLanguage;
      if (acceptLanguage) {
        for (const key of Object.keys(details.requestHeaders)) {
          if (key.toLowerCase() === 'accept-language') delete details.requestHeaders[key];
        }
        details.requestHeaders['Accept-Language'] = acceptLanguage;
      }
      callback({ requestHeaders: details.requestHeaders });
    },
  );
}

function setPreset(id) {
  const preset = findPreset(id);
  if (preset.id === ctx.region.preset) return preset.id;

  ctx.region.preset = preset.id;
  persist({ preset: preset.id });
  reloadView();
  toast(preset.id === 'off' ? 'Подмена региона выключена' : `Регион: ${preset.label}`);
  pushState();
  onChange?.();
  return preset.id;
}

/**
 * Язык сайта TikTok. Cookie и Accept-Language применяются сразу, страницу
 * перезагружаем: SPA не перечитывает язык без новой загрузки.
 */
function setSiteLanguage(id) {
  const site = findSiteLanguage(id);
  const next = site ? site.id : 'auto';
  if (next === ctx.siteLanguage) return next;

  ctx.siteLanguage = next;
  writeState({ siteLanguage: next });

  const ses = appSession();
  applySiteLanguageCookie(ses, { clear: next === 'auto' })
    .catch(() => {})
    .finally(() => reloadView(true));

  toast(next === 'auto' ? 'Язык сайта сброшен' : `Язык TikTok: ${site.label}`);
  pushState();
  onChange?.();
  return next;
}

function siteLanguageMenuItems() {
  return [
    {
      label: 'Авто (как у сайта)',
      type: 'radio',
      checked: ctx.siteLanguage === 'auto',
      click: () => setSiteLanguage('auto'),
    },
    { type: 'separator' },
    ...SITE_LANGUAGES.map((language) => ({
      label: language.label,
      native: true,
      type: 'radio',
      checked: ctx.siteLanguage === language.id,
      click: () => setSiteLanguage(language.id),
    })),
  ];
}

function setProxy(raw) {
  const text = String(raw || '').trim();
  if (!parseProxy(text).ok) {
    toast('Прокси: нужен адрес вида socks5://host:port');
    pushState();
    return false;
  }

  ctx.region.proxy = text;
  persist({ proxy: text });
  checkToken += 1;
  ctx.regionCheck = { state: 'idle', text: 'Проверить' };

  const ses = appSession();
  applyProxy(ses);
  try {
    ses.closeAllConnections();
  } catch {
    /* старые соединения закроются сами */
  }

  reloadView();
  toast(text ? 'Прокси применён — проверьте внешний IP' : 'Прокси отключён');
  pushState();
  onChange?.();
  return true;
}

function menuItems() {
  return [
    ...REGION_PRESETS.map((preset) => ({
      label: preset.label,
      type: 'radio',
      checked: ctx.region.preset === preset.id,
      click: () => setPreset(preset.id),
    })),
    { type: 'separator' },
    { label: proxyLabel(), enabled: false },
    { label: 'Проверить внешний IP', click: () => checkIp() },
    {
      label: 'Сбросить прокси',
      enabled: Boolean(ctx.region.proxy),
      click: () => setProxy(''),
    },
    { label: 'Сбросить данные сайта…', click: () => resetSiteData() },
  ];
}

/** Preload страницы спрашивает конфиг синхронно, до скриптов сайта. */
function installIpc() {
  ipcMain.on('octo:region-config', (event) => {
    const preset = activePreset();
    const site = activeSiteLanguage();
    const locale = site?.locale || preset.locale;
    if (!locale) {
      event.returnValue = null;
      return;
    }
    event.returnValue = {
      locale,
      timezone: preset.timezone,
      latitude: preset.latitude,
      longitude: preset.longitude,
    };
  });
}

/** Прокси с логином/паролем: Electron спрашивает их через app.on('login'). */
function installLoginHandler() {
  app.on('login', (event, _webContents, _details, authInfo, callback) => {
    if (!authInfo.isProxy) return;
    const parsed = parseProxy(ctx.region.proxy);
    if (!parsed.auth) return;
    event.preventDefault();
    callback(parsed.auth.username, parsed.auth.password);
  });
}

function setOnChange(callback) {
  onChange = typeof callback === 'function' ? callback : null;
}

module.exports = {
  sync,
  setPreset,
  setSiteLanguage,
  siteLanguageMenuItems,
  setProxy,
  checkIp,
  resetSiteData,
  installSessionHooks,
  installIpc,
  installLoginHandler,
  applySiteLanguageCookie,
  menuItems,
  setOnChange,
};
