'use strict';

const { app, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ctx, toast } = require('./app-context');

/**
 * Снимок текущего кадра.
 *
 * capturePage у WebContentsView снимает отрендеренную страницу вместе с
 * видео. Файл кладём в «Изображения» (в тестах путь можно переопределить),
 * картинку дублируем в буфер обмена.
 */

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function outputDir() {
  if (process.env.OCTO_SCREENSHOT_DIR) return process.env.OCTO_SCREENSHOT_DIR;
  try {
    return app.getPath('pictures');
  } catch {
    return app.getPath('downloads');
  }
}

async function captureFrame() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  try {
    const image = await wc.capturePage();
    if (!image || image.isEmpty()) {
      toast('Не удалось сделать снимок');
      return;
    }

    const dir = outputDir();
    fs.mkdirSync(dir, { recursive: true });
    const name = `tiktok-octo-${timestamp()}.png`;
    fs.writeFileSync(path.join(dir, name), image.toPNG());

    try {
      clipboard.writeImage(image);
    } catch {
      /* буфер обмена может быть недоступен — файл уже сохранён */
    }

    toast(`Снимок сохранён · ${name}`);
  } catch {
    toast('Не удалось сделать снимок');
  }
}

module.exports = { captureFrame };
