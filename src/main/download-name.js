'use strict';

const path = require('node:path');

/**
 * Имена файлов для загрузок: шаблон вида `{author}-{date}-{title}`,
 * транслитерация и безопасные символы. Вынесено отдельно, чтобы проверять
 * без Electron: ffmpeg/сеть тут не нужны.
 */

const TRANSLIT = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};

function transliterate(text) {
  return String(text || '').replace(/[а-яёіїєґ]/gi, (letter) => {
    const lower = letter.toLowerCase();
    const value = TRANSLIT[lower];
    if (value === undefined) return letter;
    return letter === lower ? value : value.charAt(0).toUpperCase() + value.slice(1);
  });
}

function sanitize(text, limit = 120) {
  return transliterate(text)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .slice(0, limit)
    .trim();
}

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const PLACEHOLDERS = ['author', 'date', 'title', 'ext'];

/**
 * @param {string} template
 * @param {{ author?: string, title?: string, date?: string, ext?: string, fallback?: string }} info
 */
function buildName(template, info = {}) {
  const ext = sanitize(info.ext || '', 10)
    .replace(/^\./, '')
    .toLowerCase();
  const values = {
    author: sanitize(info.author || '', 60),
    title: sanitize(info.title || '', 90),
    date: sanitize(info.date || formatDate(), 20),
    ext,
  };

  let name = String(template || '');
  for (const placeholder of PLACEHOLDERS) {
    name = name.replace(new RegExp(`\\{${placeholder}\\}`, 'gi'), values[placeholder]);
  }

  let clean = sanitize(name);
  if (!clean) clean = sanitize(info.fallback || `video-${formatDate()}`, 90);
  if (!clean) clean = 'video';

  if (ext && !clean.toLowerCase().endsWith(`.${ext}`)) clean = `${clean}.${ext}`;
  return clean;
}

function buildPath({ template, folderPerAuthor = false, baseDir, info = {} } = {}) {
  const author = sanitize(info.author || '', 60);
  const directory = folderPerAuthor && author ? path.join(baseDir, author) : baseDir;
  return { directory, file: buildName(template, info) };
}

module.exports = { transliterate, sanitize, formatDate, buildName, buildPath, PLACEHOLDERS };
