'use strict';

const { ipcRenderer, webFrame } = require('electron');

/**
 * Preload страницы TikTok для подмены региона.
 *
 * Он ничего не отдаёт странице и не даёт ей доступ к Node: contextIsolation и
 * sandbox остаются включёнными. Единственная задача — до выполнения скриптов
 * сайта подменить те сигналы региона, которые читает браузерный клиент:
 * язык navigator, часовой пояс Intl/Date и координаты геолокации.
 *
 * Функция ниже сериализуется в главный мир страницы, поэтому она не должна
 * ссылаться ни на что снаружи — только на переданный config.
 */
function installRegion(config) {
  const { locale, timezone } = config;

  try {
    const languages = [locale, locale.split('-')[0], 'en-US', 'en'].filter(
      (value, index, list) => list.indexOf(value) === index,
    );

    Object.defineProperty(window.Navigator.prototype, 'language', {
      configurable: true,
      get: () => locale,
    });
    Object.defineProperty(window.Navigator.prototype, 'languages', {
      configurable: true,
      get: () => languages.slice(),
    });
  } catch {
    /* браузер не дал переопределить navigator */
  }

  // Intl по умолчанию берёт часовой пояс и локаль из системы.
  if (timezone) {
    try {
      const OriginalDateTimeFormat = Intl.DateTimeFormat;
      const WrappedDateTimeFormat = function (locales, options) {
        const next = Object.assign({ timeZone: timezone }, options || {});
        return new OriginalDateTimeFormat(locales || locale, next);
      };
      WrappedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
      WrappedDateTimeFormat.supportedLocalesOf =
        OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);
      Intl.DateTimeFormat = WrappedDateTimeFormat;
    } catch {
      /* Intl может быть заморожен страницей */
    }

    // Date.getTimezoneOffset() читает системную зону напрямую, мимо Intl.
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      Date.prototype.getTimezoneOffset = function () {
        const parts = formatter.formatToParts(this);
        const map = {};
        for (const part of parts) map[part.type] = part.value;
        const asUTC = Date.UTC(
          Number(map.year),
          Number(map.month) - 1,
          Number(map.day),
          Number(map.hour),
          Number(map.minute),
          Number(map.second),
        );
        const wholeSeconds = Math.floor(this.getTime() / 1000) * 1000;
        return -(asUTC - wholeSeconds) / 60000;
      };
    } catch {
      /* оставляем системную зону */
    }
  }

  if (typeof config.latitude === 'number' && typeof config.longitude === 'number') {
    try {
      const position = {
        coords: {
          latitude: config.latitude,
          longitude: config.longitude,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      let watchId = 0;
      const geolocation = window.navigator.geolocation;
      if (geolocation) {
        geolocation.getCurrentPosition = (success) => {
          if (typeof success === 'function') setTimeout(() => success(position), 0);
        };
        geolocation.watchPosition = (success) => {
          watchId += 1;
          if (typeof success === 'function') setTimeout(() => success(position), 0);
          return watchId;
        };
        geolocation.clearWatch = () => {};
      }
    } catch {
      /* геолокация отключена политикой */
    }
  }

  try {
    const applyLang = () => {
      document.documentElement.lang = locale;
    };
    if (document.documentElement) applyLang();
    else document.addEventListener('DOMContentLoaded', applyLang, { once: true });
  } catch {
    /* документ ещё не готов */
  }
}

const config = ipcRenderer.sendSync('octo:region-config');
const host = window.location?.hostname || '';
const isTikTok = host === 'tiktok.com' || host.endsWith('.tiktok.com');

if (config && config.locale && isTikTok) {
  const script = `(${installRegion.toString()})(${JSON.stringify(config)})`;
  webFrame.executeJavaScript(script).catch(() => {
    /* страница уже ушла — патчи не нужны */
  });
}
