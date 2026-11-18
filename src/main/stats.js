'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { authorFromUrl } = require('./shared');

/**
 * Статистика просмотра.
 *
 * Пока ролик играет, раз в N миллисекунд добавляем это время к сегодняшнему
 * дню. Ролик считаем один раз на новый адрес: `did-navigate-in-page` в ленте
 * приходит ровно на смену видео, а `media-started-playing` ещё и на возврат
 * после паузы. Данные хранятся локально, наружу не уходят.
 */

const KEEP_DAYS = 120;
const TICK_MS = Number(process.env.OCTO_STATS_TICK_MS) || 15000;
const WEEK_DAYS = 7;
const TOP_AUTHORS = 5;

let days = {};
let timer = null;
let lastVideo = { url: '', at: 0 };

function dayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function emptyDay() {
  return { ms: 0, videos: 0, authors: {} };
}

function readSettings() {
  const saved = readState().stats;
  const source = saved && typeof saved === 'object' && saved.days ? saved.days : {};
  const result = {};

  for (const [key, value] of Object.entries(source)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !value || typeof value !== 'object') continue;
    const authors = {};
    if (value.authors && typeof value.authors === 'object') {
      for (const [name, count] of Object.entries(value.authors)) {
        if (typeof name === 'string' && name && Number(count) > 0) {
          authors[name.slice(0, 80)] = Math.round(Number(count));
        }
      }
    }
    result[key] = {
      ms: Math.max(0, Number(value.ms) || 0),
      videos: Math.max(0, Number(value.videos) || 0),
      authors,
    };
  }
  return result;
}

/** Сводка для панели: сегодня, неделя и топ авторов за неделю. */
function summary() {
  const today = days[dayKey()] || emptyDay();
  const keys = [];
  for (let index = 0; index < WEEK_DAYS; index += 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    keys.push(dayKey(date));
  }

  const week = emptyDay();
  for (const key of keys) {
    const day = days[key];
    if (!day) continue;
    week.ms += day.ms;
    week.videos += day.videos;
    for (const [name, count] of Object.entries(day.authors)) {
      week.authors[name] = (week.authors[name] || 0) + count;
    }
  }

  const topAuthors = Object.entries(week.authors)
    .map(([name, videos]) => ({ name, videos }))
    .sort((left, right) => right.videos - left.videos || left.name.localeCompare(right.name))
    .slice(0, TOP_AUTHORS);

  return {
    today: {
      minutes: Math.round(today.ms / 60000),
      seconds: Math.round(today.ms / 1000),
      videos: today.videos,
    },
    week: { minutes: Math.round(week.ms / 60000), videos: week.videos },
    topAuthors,
  };
}

function refresh() {
  ctx.stats = summary();
}

function save() {
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) {
    const oldest = keys.shift();
    delete days[oldest];
  }
  writeState({ stats: { days } });
  refresh();
  pushState();
}

function sync() {
  days = readSettings();
  refresh();
}

/** Новый ролик в ленте: адрес сменился — это засчитываем один раз. */
function noteVideo(rawUrl) {
  const url = typeof rawUrl === 'string' ? rawUrl : ctx.view?.webContents?.getURL() || '';
  if (!/\/video\/\d+/.test(url)) return;
  const now = Date.now();
  if (url === lastVideo.url && now - lastVideo.at < 10000) return;
  lastVideo = { url, at: now };

  const key = dayKey();
  const day = days[key] || emptyDay();
  day.videos += 1;
  const author = authorFromUrl(url);
  if (author) day.authors[author] = (day.authors[author] || 0) + 1;
  days[key] = day;
  save();
}

function tick() {
  if (!ctx.playing) return;
  const key = dayKey();
  const day = days[key] || emptyDay();
  day.ms += TICK_MS;
  days[key] = day;
  save();
}

function reset() {
  days = {};
  lastVideo = { url: '', at: 0 };
  save();
  toast('Статистика просмотра сброшена');
}

function start() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

sync();
start();

module.exports = { sync, start, noteVideo, reset, tick };
