'use strict';

/**
 * Внешний IP через заданную сессию.
 *
 * Сервисы общие для проверки региона и для проверки найденного прокси:
 * оба вопроса должны получать один и тот же ответ. Запрос идёт через ту же
 * сессию, то есть через тот же прокси, что и сам сайт.
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

/**
 * Первый ответивший сервис или null. Таймаут свой у каждого сервиса, чтобы
 * мёртвый прокси не держал проверку минутами.
 */
async function lookupExternalIp(ses, { timeoutMs = 8000 } = {}) {
  if (!ses) return null;

  for (const service of IP_SERVICES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await ses.fetch(service.url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) continue;

      const info = service.parse(await response.json());
      if (info?.ip) return info;
    } catch {
      /* сервис недоступен — пробуем следующий */
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

module.exports = { IP_SERVICES, lookupExternalIp };
