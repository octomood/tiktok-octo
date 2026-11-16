'use strict';

/**
 * Языки интерфейса оболочки и языка самого сайта TikTok.
 *
 * Это два независимых списка:
 *   • APP_LANGUAGES — языки, на которые переведены меню, панель, диалоги
 *     и менеджер плагинов;
 *   • SITE_LANGUAGES — языки, которые можно выставить сайту TikTok. Он шире:
 *     сайт знает больше языков, чем переведена оболочка.
 *
 * `tiktok` — значение cookie `default_lang`, `locale` — тег для navigator/Intl,
 * `acceptLanguage` — заголовок Accept-Language.
 */

const APP_LANGUAGES = [
  {
    id: 'ru',
    label: 'Русский',
    english: 'Russian',
    locale: 'ru-RU',
    acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.6',
    tiktok: 'ru',
    spellcheck: 'ru',
    dir: 'ltr',
  },
  {
    id: 'en',
    label: 'English',
    english: 'English',
    locale: 'en-US',
    acceptLanguage: 'en-US,en;q=0.9',
    tiktok: 'en',
    spellcheck: 'en-US',
    dir: 'ltr',
  },
  {
    id: 'es',
    label: 'Español',
    english: 'Spanish',
    locale: 'es-ES',
    acceptLanguage: 'es-ES,es;q=0.9,en;q=0.6',
    tiktok: 'es',
    spellcheck: 'es-ES',
    dir: 'ltr',
  },
  {
    id: 'pt-BR',
    label: 'Português (Brasil)',
    english: 'Portuguese (Brazil)',
    locale: 'pt-BR',
    acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.6',
    tiktok: 'pt-BR',
    spellcheck: 'pt-BR',
    dir: 'ltr',
  },
  {
    id: 'de',
    label: 'Deutsch',
    english: 'German',
    locale: 'de-DE',
    acceptLanguage: 'de-DE,de;q=0.9,en;q=0.6',
    tiktok: 'de',
    spellcheck: 'de-DE',
    dir: 'ltr',
  },
  {
    id: 'fr',
    label: 'Français',
    english: 'French',
    locale: 'fr-FR',
    acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.6',
    tiktok: 'fr',
    spellcheck: 'fr-FR',
    dir: 'ltr',
  },
  {
    id: 'tr',
    label: 'Türkçe',
    english: 'Turkish',
    locale: 'tr-TR',
    acceptLanguage: 'tr-TR,tr;q=0.9,en;q=0.6',
    tiktok: 'tr',
    spellcheck: 'tr-TR',
    dir: 'ltr',
  },
  {
    id: 'id',
    label: 'Bahasa Indonesia',
    english: 'Indonesian',
    locale: 'id-ID',
    acceptLanguage: 'id-ID,id;q=0.9,en;q=0.6',
    tiktok: 'id',
    spellcheck: 'id-ID',
    dir: 'ltr',
  },
  {
    id: 'vi',
    label: 'Tiếng Việt',
    english: 'Vietnamese',
    locale: 'vi-VN',
    acceptLanguage: 'vi-VN,vi;q=0.9,en;q=0.6',
    tiktok: 'vi',
    spellcheck: 'vi-VN',
    dir: 'ltr',
  },
  {
    id: 'ja',
    label: '日本語',
    english: 'Japanese',
    locale: 'ja-JP',
    acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.6',
    tiktok: 'ja',
    spellcheck: '',
    dir: 'ltr',
  },
  {
    id: 'ko',
    label: '한국어',
    english: 'Korean',
    locale: 'ko-KR',
    acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.6',
    tiktok: 'ko',
    spellcheck: '',
    dir: 'ltr',
  },
  {
    id: 'ar',
    label: 'العربية',
    english: 'Arabic',
    locale: 'ar-SA',
    acceptLanguage: 'ar-SA,ar;q=0.9,en;q=0.6',
    tiktok: 'ar',
    spellcheck: '',
    dir: 'rtl',
  },
];

const SITE_ONLY_LANGUAGES = [
  {
    id: 'it',
    label: 'Italiano',
    english: 'Italian',
    locale: 'it-IT',
    acceptLanguage: 'it-IT,it;q=0.9,en;q=0.6',
    tiktok: 'it',
    dir: 'ltr',
  },
  {
    id: 'th',
    label: 'ไทย',
    english: 'Thai',
    locale: 'th-TH',
    acceptLanguage: 'th-TH,th;q=0.9,en;q=0.6',
    tiktok: 'th',
    dir: 'ltr',
  },
  {
    id: 'hi',
    label: 'हिन्दी',
    english: 'Hindi',
    locale: 'hi-IN',
    acceptLanguage: 'hi-IN,hi;q=0.9,en;q=0.6',
    tiktok: 'hi',
    dir: 'ltr',
  },
  {
    id: 'pl',
    label: 'Polski',
    english: 'Polish',
    locale: 'pl-PL',
    acceptLanguage: 'pl-PL,pl;q=0.9,en;q=0.6',
    tiktok: 'pl',
    dir: 'ltr',
  },
  {
    id: 'nl',
    label: 'Nederlands',
    english: 'Dutch',
    locale: 'nl-NL',
    acceptLanguage: 'nl-NL,nl;q=0.9,en;q=0.6',
    tiktok: 'nl',
    dir: 'ltr',
  },
  {
    id: 'uk',
    label: 'Українська',
    english: 'Ukrainian',
    locale: 'uk-UA',
    acceptLanguage: 'uk-UA,uk;q=0.9,en;q=0.6',
    tiktok: 'uk',
    dir: 'ltr',
  },
  {
    id: 'zh-Hans',
    label: '简体中文',
    english: 'Chinese (Simplified)',
    locale: 'zh-CN',
    acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.6',
    tiktok: 'zh-Hans',
    dir: 'ltr',
  },
  {
    id: 'zh-Hant',
    label: '繁體中文',
    english: 'Chinese (Traditional)',
    locale: 'zh-TW',
    acceptLanguage: 'zh-TW,zh;q=0.9,en;q=0.6',
    tiktok: 'zh-Hant',
    dir: 'ltr',
  },
  {
    id: 'ms',
    label: 'Bahasa Melayu',
    english: 'Malay',
    locale: 'ms-MY',
    acceptLanguage: 'ms-MY,ms;q=0.9,en;q=0.6',
    tiktok: 'ms',
    dir: 'ltr',
  },
  {
    id: 'fil',
    label: 'Filipino',
    english: 'Filipino',
    locale: 'fil-PH',
    acceptLanguage: 'fil-PH,fil;q=0.9,en;q=0.6',
    tiktok: 'fil',
    dir: 'ltr',
  },
];

const SITE_LANGUAGES = [...APP_LANGUAGES, ...SITE_ONLY_LANGUAGES];

function findAppLanguage(id) {
  return APP_LANGUAGES.find((language) => language.id === id) || APP_LANGUAGES[0];
}

function findSiteLanguage(id) {
  if (!id || id === 'auto') return null;
  return SITE_LANGUAGES.find((language) => language.id === id) || null;
}

module.exports = {
  APP_LANGUAGES,
  SITE_LANGUAGES,
  findAppLanguage,
  findSiteLanguage,
};
