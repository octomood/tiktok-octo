'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, clipboard, ipcMain, nativeImage } = require('electron');
const { toast } = require('./app-context');
const { outputDir } = require('./screenshot');
const i18n = require('./i18n');
const windowChrome = require('./window-chrome');

/**
 * Окно «Снимок с аннотацией».
 *
 * Картинка приходит как data URL, редактор живёт на canvas, результат
 * возвращается PNG: пишем в «Изображения» и кладём в буфер обмена. Сайт и
 * main о содержимом аннотации ничего не знают.
 */

let win = null;

function open(image) {
  if (!image || typeof image.dataUrl !== 'string') return null;
  if (win && !win.isDestroyed()) win.close();

  // Окно запоминаем локально: closed старого окна приходит позже и не должен
  // обнулять ссылку на только что созданное новое.
  const editor = new BrowserWindow(
    windowChrome.framelessOptions({
      width: 980,
      height: 740,
      minWidth: 560,
      minHeight: 420,
      title: i18n.t('Снимок с аннотацией'),
      webPreferences: {
        preload: path.join(__dirname, 'annotator-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    }),
  );
  windowChrome.attach(editor);
  win = editor;

  editor.loadFile(path.join(__dirname, '../renderer/annotator.html'));
  editor.webContents.once('did-finish-load', () => {
    if (!editor.isDestroyed()) editor.webContents.send('octo:annotate-image', image);
  });
  editor.on('closed', () => {
    if (win === editor) win = null;
  });

  return editor;
}

function fromEditor(event) {
  return Boolean(win && !win.isDestroyed() && event.sender === win.webContents);
}

ipcMain.on('octo:annotate-save', (event, payload) => {
  if (!fromEditor(event)) return;
  const dataUrl = payload && typeof payload.dataUrl === 'string' ? payload.dataUrl : '';
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) {
    toast('Не удалось сохранить снимок');
    return;
  }

  const buffer = Buffer.from(match[1], 'base64');
  const rawName =
    payload && typeof payload.name === 'string' && payload.name
      ? payload.name
          .replace(/[\\/:*?"<>|]/g, ' ')
          .replace(/^\.+/, '')
          .trim()
      : '';
  const baseName = rawName || `tiktok-octo-${Date.now()}-annotated.png`;
  const name = baseName.toLowerCase().endsWith('.png') ? baseName : `${baseName}.png`;

  try {
    const dir = outputDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buffer);
    try {
      clipboard.writeImage(nativeImage.createFromBuffer(buffer));
    } catch {
      /* буфер обмена может быть недоступен — файл уже сохранён */
    }
    toast(`Снимок с аннотацией сохранён: ${name}`);
    if (win && !win.isDestroyed()) win.close();
  } catch (err) {
    toast(`Не удалось сохранить снимок: ${err.message}`);
  }
});

ipcMain.on('octo:annotate-close', (event) => {
  if (!fromEditor(event)) return;
  if (win && !win.isDestroyed()) win.close();
});

module.exports = { open };
