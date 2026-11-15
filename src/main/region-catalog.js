'use strict';

/**
 * Страны для подмены региона.
 *
 * Набор — это не «волшебная кнопка VPN»: приложение не содержит прокси и не
 * обещает чужой IP. Пресет задаёт то, что сайт читает на стороне браузера:
 * Accept-Language, язык `navigator`, часовой пояс Intl/Date и координаты
 * геолокации. Настоящий адрес меняется только через собственный прокси или
 * системный VPN — поле для прокси есть в панели.
 *
 * Список намеренно короткий: страны, куда из РФ обычно переезжают аккаунтом,
 * плюс несколько популярных направлений.
 */

const REGION_PRESETS = [
  { id: 'off', label: 'Не подменять' },
  {
    id: 'kz',
    label: 'Казахстан',
    locale: 'ru-KZ',
    acceptLanguage: 'ru-KZ,ru;q=0.9,kk;q=0.8,en-US;q=0.7,en;q=0.6',
    timezone: 'Asia/Almaty',
    latitude: 43.238949,
    longitude: 76.889709,
  },
  {
    id: 'am',
    label: 'Армения',
    locale: 'hy-AM',
    acceptLanguage: 'hy-AM,hy;q=0.9,ru;q=0.8,en-US;q=0.7,en;q=0.6',
    timezone: 'Asia/Yerevan',
    latitude: 40.1772,
    longitude: 44.5035,
  },
  {
    id: 'ge',
    label: 'Грузия',
    locale: 'ka-GE',
    acceptLanguage: 'ka-GE,ka;q=0.9,ru;q=0.8,en-US;q=0.7,en;q=0.6',
    timezone: 'Asia/Tbilisi',
    latitude: 41.7151,
    longitude: 44.8271,
  },
  {
    id: 'tr',
    label: 'Турция',
    locale: 'tr-TR',
    acceptLanguage: 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Istanbul',
    latitude: 41.0082,
    longitude: 28.9784,
  },
  {
    id: 'rs',
    label: 'Сербия',
    locale: 'sr-RS',
    acceptLanguage: 'sr-RS,sr;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Belgrade',
    latitude: 44.7866,
    longitude: 20.4489,
  },
  {
    id: 'ae',
    label: 'ОАЭ',
    locale: 'en-AE',
    acceptLanguage: 'en-AE,en;q=0.9,ar;q=0.8',
    timezone: 'Asia/Dubai',
    latitude: 25.2048,
    longitude: 55.2708,
  },
  {
    id: 'il',
    label: 'Израиль',
    locale: 'he-IL',
    acceptLanguage: 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Asia/Jerusalem',
    latitude: 31.7683,
    longitude: 35.2137,
  },
  {
    id: 'us',
    label: 'США',
    locale: 'en-US',
    acceptLanguage: 'en-US,en;q=0.9',
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    id: 'de',
    label: 'Германия',
    locale: 'de-DE',
    acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Berlin',
    latitude: 52.52,
    longitude: 13.405,
  },
  {
    id: 'nl',
    label: 'Нидерланды',
    locale: 'nl-NL',
    acceptLanguage: 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Amsterdam',
    latitude: 52.3676,
    longitude: 4.9041,
  },
  {
    id: 'gb',
    label: 'Великобритания',
    locale: 'en-GB',
    acceptLanguage: 'en-GB,en;q=0.9',
    timezone: 'Europe/London',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'pl',
    label: 'Польша',
    locale: 'pl-PL',
    acceptLanguage: 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Warsaw',
    latitude: 52.2297,
    longitude: 21.0122,
  },
];

const OFF_PRESET = REGION_PRESETS[0];

/** Неизвестный id (старый конфиг, опечатка) безопасно схлопывается в «выкл». */
function findPreset(id) {
  return REGION_PRESETS.find((preset) => preset.id === id) || OFF_PRESET;
}

module.exports = { REGION_PRESETS, findPreset };
