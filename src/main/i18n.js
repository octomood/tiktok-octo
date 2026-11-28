'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { APP_LANGUAGES, findAppLanguage } = require('./language-catalog');

/**
 * Локализация собственного интерфейса.
 *
 * Строки-ключи — русские, как исходный язык проекта. Для каждого языка лежит
 * JSON `locales/<id>.json`; значение подставляется по точному совпадению, а
 * шаблоны вида «Плагин «{0}» включён» — по регулярному выражению. Это
 * позволяет переводить и статические подписи DOM, и строки, собранные в
 * рантайме с числами, именами и версиями.
 *
 * Сам сайт TikTok переводится отдельно — через cookie default_lang и
 * Accept-Language в region.js.
 */

const LOCALES_DIR = path.join(__dirname, 'locales');

let current = 'ru';
let dictionary = null;
let compiled = null;
let fallbackCompiled = null;
let onChange = null;
const cache = new Map();

function loadDictionary(code) {
  if (code === 'ru') return {};
  if (cache.has(code)) return cache.get(code);
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8'));
  } catch (err) {
    if (process.env.OCTO_DEBUG) console.warn('[octo] locale load failed:', code, err.message);
  }
  cache.set(code, data);
  return data;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(dict) {
  const exact = new Map();
  const patterns = [];

  for (const [source, value] of Object.entries(dict)) {
    if (typeof value !== 'string') continue;
    if (/\{\d+\}/.test(source)) {
      const literal = source.replace(/\{\d+\}/g, '');
      patterns.push({
        regex: new RegExp(
          `^${escapeRegExp(source).replace(/\\\{(\d+)\\\}/g, '([\\s\\S]+?)')}$`,
          's',
        ),
        value,
        weight: literal.length,
      });
    } else {
      exact.set(source, value);
    }
  }

  patterns.sort((left, right) => right.weight - left.weight);
  return { exact, patterns };
}

function translateWith(source, compiledDict) {
  if (!source) return source;
  const exact = compiledDict.exact.get(source);
  if (exact !== undefined) return exact;

  for (const pattern of compiledDict.patterns) {
    const match = source.match(pattern.regex);
    if (!match) continue;
    return pattern.value.replace(/\{(\d+)\}/g, (_all, index) => match[Number(index) + 1] ?? '');
  }
  return null;
}

function protectBrand(source, value) {
  if (!source.includes('TikTok Octo')) return value;
  return value.replace(/TikTok\s+[^\s.,:;!?)«»]+/u, 'TikTok Octo');
}

/** Перевести строку интерфейса. Для русского возвращает исходник. */
function t(source) {
  if (typeof source !== 'string' || !source || current === 'ru') return source;
  if (!compiled) compiled = compile(dictionary || {});

  const lookup = (text) => {
    let value = translateWith(text, compiled);
    if (value === null && fallbackCompiled) value = translateWith(text, fallbackCompiled);
    return value;
  };

  let value = lookup(source);
  if (value === null && source.includes('\n')) {
    // Диалоги часто собирают detail из строк: переводим построчно.
    const sourceLines = source.split('\n');
    const lines = sourceLines.map((line) => lookup(line) ?? line);
    if (lines.some((line, index) => line !== sourceLines[index])) {
      value = lines.join('\n');
    }
  }
  if (value === null) return source;
  return protectBrand(source, value);
}

/** Перевести подпись меню и подобные короткие строки без порчи данных. */
function label(source) {
  return t(source);
}

function payload() {
  return {
    lang: current,
    dir: findAppLanguage(current).dir,
    dict: dictionary || {},
    fallback: current === 'en' ? {} : loadDictionary('en'),
  };
}

function broadcast() {
  const data = payload();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win || win.isDestroyed()) continue;
    const wc = win.webContents;
    if (!wc || wc.isDestroyed()) continue;
    try {
      wc.send('octo:i18n-changed', data);
    } catch {
      /* окно закрывается */
    }
  }
  require('./context-menu').syncI18n?.(data);
}

function menuItems() {
  return APP_LANGUAGES.map((language) => ({
    label: language.label,
    native: true,
    type: 'radio',
    checked: current === language.id,
    click: () => setLanguage(language.id),
  }));
}

function setLanguage(id) {
  const language = findAppLanguage(id);
  if (language.id === current) return current;

  current = language.id;
  dictionary = loadDictionary(current);
  compiled = compile(dictionary);
  fallbackCompiled = current === 'en' ? null : compile(loadDictionary('en'));
  writeState({ language: current });
  ctx.language = current;

  broadcast();
  onChange?.();
  pushState();
  toast(current === 'ru' ? 'Язык интерфейса: Русский' : `Язык интерфейса: ${language.label}`);
  return current;
}

/** Прочитать сохранённый язык до создания окон и меню. */
function sync() {
  current = findAppLanguage(readState().language).id;
  dictionary = loadDictionary(current);
  compiled = compile(dictionary);
  fallbackCompiled = current === 'en' ? null : compile(loadDictionary('en'));
  ctx.language = current;
}

function installIpc() {
  const { ipcMain } = require('electron');
  ipcMain.on('octo:i18n', (event) => {
    event.returnValue = payload();
  });
}

function setOnChange(callback) {
  onChange = typeof callback === 'function' ? callback : null;
}

function currentLanguage() {
  return current;
}

function applyToMenuTemplate(template) {
  if (!Array.isArray(template)) return template;
  return template.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next = { ...item };
    if (typeof next.label === 'string' && !next.native) next.label = t(next.label);
    if (typeof next.sublabel === 'string') next.sublabel = t(next.sublabel);
    if (typeof next.toolTip === 'string') next.toolTip = t(next.toolTip);
    if (Array.isArray(next.submenu)) next.submenu = applyToMenuTemplate(next.submenu);
    delete next.native;
    return next;
  });
}

module.exports = {
  t,
  label,
  payload,
  sync,
  setLanguage,
  installIpc,
  setOnChange,
  currentLanguage,
  menuItems,
  broadcast,
  applyToMenuTemplate,
};
