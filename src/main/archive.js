'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, dialog } = require('electron');
const { ctx, toast } = require('./app-context');
const { readState } = require('./store');
const { createZip } = require('./plugins/zip');
const library = require('./library');
const { stripRegionCredentials } = require('./proxy-url');

/**
 * «Мой архив»: закладки, статистика, настройки и стикеры одним ZIP.
 *
 * ZIP собираем своим writer'ом из системы плагинов — он уже проверяет пути,
 * CRC и лимиты. Архив создаётся только по кнопке и лежит на диске у
 * пользователя; ничего никуда не отправляется.
 */

const SETTINGS_KEYS = [
  'player',
  'cosmetics',
  'region',
  'language',
  'siteLanguage',
  'keymap',
  'attention',
  'replies',
  'notifications',
  'subtitles',
  'focus',
  'feedKeys',
  'zoomFactor',
  'alwaysOnTop',
  'closeToTray',
  'startInTray',
  'lastUrl',
  'chatWidth',
  'chatDock',
];

const STICKER_MAX_BYTES = 8 * 1024 * 1024;
const STICKERS_TOTAL_BYTES = 18 * 1024 * 1024;

const README = `TikTok octo — мой архив

library.json / library.md  — закладки с таймкодом, заметками и очередь
stats.json                 — статистика просмотра по дням
settings.json              — настройки приложения (только локальные)
stickers/                  — свои картинки для чата

Архив создан приложением TikTok octo. Неофициальный клиент, не связан с TikTok Ltd.
`;

function dateStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}

function settingsSlice(state) {
  const result = {};
  for (const key of SETTINGS_KEYS) {
    if (state[key] === undefined) continue;
    // «Мой архив» тоже не должен содержать пароль прокси.
    result[key] = key === 'region' ? stripRegionCredentials(state[key]) : state[key];
  }
  return result;
}

function stickerEntries(dir) {
  if (!dir) return [];
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const entries = [];
  let total = 0;
  for (const name of names) {
    if (!/\.(png|jpe?g|webp|gif|json)$/i.test(name)) continue;
    try {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > STICKER_MAX_BYTES) continue;
      if (total + stat.size > STICKERS_TOTAL_BYTES) break;
      total += stat.size;
      entries.push({ name: `stickers/${name}`, data: fs.readFileSync(file) });
    } catch {
      /* файл пропал между чтением каталога и чтением файла */
    }
  }
  return entries;
}

function buildEntries() {
  const state = readState();
  const snapshot = library.snapshot();

  return [
    { name: 'README.txt', data: README },
    {
      name: 'library.json',
      data: `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          items: snapshot.items,
          queue: snapshot.queue,
        },
        null,
        2,
      )}\n`,
    },
    { name: 'library.md', data: library.buildMarkdown(snapshot.items) },
    {
      name: 'stats.json',
      data: `${JSON.stringify(state.stats || { days: {} }, null, 2)}\n`,
    },
    {
      name: 'settings.json',
      data: `${JSON.stringify(settingsSlice(state), null, 2)}\n`,
    },
    ...stickerEntries(ctx.stickers?.dir),
  ];
}

async function exportArchive() {
  let zip;
  try {
    zip = createZip(buildEntries());
  } catch (err) {
    toast(`Не удалось собрать архив: ${err.message}`);
    return null;
  }

  const name = `tiktok-octo-archive-${dateStamp()}.zip`;

  try {
    if (process.env.OCTO_ARCHIVE_DIR) {
      fs.mkdirSync(process.env.OCTO_ARCHIVE_DIR, { recursive: true });
      const file = path.join(process.env.OCTO_ARCHIVE_DIR, name);
      fs.writeFileSync(file, zip);
      toast(`Архив готов: ${name}`);
      return file;
    }

    const result = await dialog.showSaveDialog(ctx.win, {
      title: 'Экспорт архива',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, zip);
    toast('Архив сохранён');
    return result.filePath;
  } catch (err) {
    toast(`Не удалось сохранить архив: ${err.message}`);
    return null;
  }
}

module.exports = { exportArchive };
