'use strict';

const { app, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ctx, toast } = require('./app-context');
const watermark = require('./watermark');

/**
 * Снимок текущего кадра.
 *
 * capturePage у WebContentsView снимает отрендеренную страницу вместе с
 * видео. Файл кладём в «Изображения» (в тестах путь можно переопределить),
 * картинку дублируем в буфер обмена. В правом нижнем углу — подпись
 * «tiktok octo», чтобы снимок было видно в чужой ленте.
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

/** Кадр может быть пустым сразу после навигации — даём странице дорисоваться. */
async function grabFrame(wc) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const image = await wc.capturePage();
      if (image && !image.isEmpty()) return image;
    } catch {
      /* рендерер ещё не готов */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function captureFrame() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;

  try {
    const frame = await grabFrame(wc);
    if (!frame) {
      toast('Не удалось сделать снимок');
      return;
    }
    const image = await watermark.apply(frame);

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

/**
 * Снимок для редактора: отдаём PNG как data URL, файл сохранит окно
 * аннотаций после правок.
 */
async function captureForAnnotation() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return null;

  try {
    const frame = await grabFrame(wc);
    if (!frame) {
      toast('Не удалось сделать снимок');
      return null;
    }
    const image = await watermark.apply(frame);

    const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`;
    const name = `tiktok-octo-${timestamp()}-annotated.png`;
    require('./annotator').open({ dataUrl, name });
    return dataUrl;
  } catch {
    toast('Не удалось сделать снимок');
    return null;
  }
}

module.exports = { captureFrame, captureForAnnotation, outputDir, timestamp };
