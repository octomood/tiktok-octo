'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');

/**
 * GIF из текущего ролика.
 *
 * Кадры снимает страничный скрипт в canvas (с текущей секунды), кодирует
 * скрытое окно с gifenc — оно доверенное, без доступа к сайту. В main
 * приходит готовый base64, файл сохраняется локально. Внешних сервисов нет.
 */

const DEFAULTS = { duration: 3, fps: 10, width: 480 };
const SETTINGS = {
  duration: [3, 5, 10],
  fps: [5, 10, 15],
  width: [320, 480, 640],
};

let settings = { ...DEFAULTS };
let worker = null;
let pending = null;
let busy = false;

function readSettings() {
  const saved = readState().gif;
  const value = saved && typeof saved === 'object' ? saved : {};
  const pick = (key) => {
    const allowed = SETTINGS[key];
    const number = Number(value[key]);
    return allowed.includes(number) ? number : DEFAULTS[key];
  };
  return { duration: pick('duration'), fps: pick('fps'), width: pick('width') };
}

function sync() {
  settings = readSettings();
  ctx.gif = { ...settings };
}

function save(patch) {
  writeState({ gif: { ...readSettings(), ...patch } });
  sync();
  pushState();
}

function setDuration(value) {
  const number = Number(value);
  if (SETTINGS.duration.includes(number)) save({ duration: number });
}

function setFps(value) {
  const number = Number(value);
  if (SETTINGS.fps.includes(number)) save({ fps: number });
}

function setWidth(value) {
  const number = Number(value);
  if (SETTINGS.width.includes(number)) save({ width: number });
}

function captureScript(config) {
  return `(async () => {
    const CONFIG = ${JSON.stringify(config)};
    const videos = [...document.querySelectorAll('video')];
    const visible = (video) => {
      if (!video || !video.isConnected) return false;
      const rect = video.getBoundingClientRect();
      return rect.width > 80 && rect.height > 80;
    };
    const area = (video) => {
      const rect = video.getBoundingClientRect();
      return rect.width * rect.height;
    };
    const list = videos.filter(visible).sort((left, right) => area(right) - area(left));
    const video = list.find((item) => !item.paused) || list[0];
    if (!video) return { error: 'no-video' };

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const start = Math.max(0, Math.min(Number(video.currentTime) || 0, duration > 0 ? duration - 0.15 : Number(video.currentTime) || 0));
    const frameCount = Math.max(2, Math.min(60, Math.round(CONFIG.fps * CONFIG.duration)));
    const width = CONFIG.width;
    const ratio = video.videoHeight > 0 && video.videoWidth > 0 ? video.videoHeight / video.videoWidth : 9 / 16;
    const height = Math.max(2, Math.round(width * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { error: 'no-canvas' };

    const wasPaused = video.paused;
    try {
      video.pause();
    } catch (err) {
      /* видео уже остановлено */
    }

    const seek = (time) =>
      new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          video.removeEventListener('seeked', finish);
          resolve();
        };
        video.addEventListener('seeked', finish, { once: true });
        try {
          video.currentTime = Math.max(0, Math.min(duration > 0 ? duration : time, time));
        } catch (err) {
          /* время недоступно */
        }
        setTimeout(finish, 180);
      });

    const frames = [];
    try {
      for (let index = 0; index < frameCount; index += 1) {
        await seek(start + index / CONFIG.fps);
        context.drawImage(video, 0, 0, width, height);
        frames.push(canvas.toDataURL('image/jpeg', 0.85));
      }
    } catch (err) {
      try {
        video.currentTime = start;
        if (!wasPaused) video.play().catch(() => {});
      } catch {
        /* видео ушло со страницы */
      }
      return { error: 'tainted' };
    }

    try {
      video.currentTime = start;
      if (!wasPaused) video.play().catch(() => {});
    } catch (err) {
      /* видео ушло со страницы */
    }

    return { frames, width, height, delay: Math.round(1000 / CONFIG.fps) };
  })()`;
}

function ensureWorker() {
  if (worker && !worker.isDestroyed()) return worker;

  worker = new BrowserWindow({
    show: false,
    width: 360,
    height: 240,
    parent: ctx.win && !ctx.win.isDestroyed() ? ctx.win : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'gif-worker-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  worker.loadFile(path.join(__dirname, '../renderer/gif-worker.html'));
  worker.on('closed', () => {
    worker = null;
    const finish = pending;
    pending = null;
    if (typeof finish === 'function') finish({ ok: false, error: 'closed' });
  });
  return worker;
}

function saveGif(buffer) {
  const stamp = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const name = `tiktok-octo-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(
    stamp.getDate(),
  )}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.gif`;

  if (process.env.OCTO_GIF_DIR) {
    fs.mkdirSync(process.env.OCTO_GIF_DIR, { recursive: true });
    const file = path.join(process.env.OCTO_GIF_DIR, name);
    fs.writeFileSync(file, buffer);
    toast(`GIF сохранён: ${name}`);
    return file;
  }

  return dialog
    .showSaveDialog(ctx.win, {
      title: 'Сохранить GIF',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: 'GIF', extensions: ['gif'] }],
    })
    .then((result) => {
      if (result.canceled || !result.filePath) return null;
      fs.writeFileSync(result.filePath, buffer);
      toast('GIF сохранён');
      return result.filePath;
    });
}

async function exportGif() {
  if (busy) {
    toast('GIF уже собирается…');
    return null;
  }
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return null;

  busy = true;
  try {
    toast('Снимаю кадры для GIF…');
    let captured;
    try {
      captured = await Promise.race([
        wc.executeJavaScript(captureScript(settings), false),
        new Promise((resolve) => {
          setTimeout(() => resolve({ error: 'timeout' }), 30000);
        }),
      ]);
    } catch {
      captured = { error: 'failed' };
    }

    if (!captured || captured.error) {
      if (captured && captured.error === 'tainted') {
        toast('Кадры ролика недоступны для GIF');
      } else if (captured && captured.error === 'no-video') {
        toast('Нет видео для GIF');
      } else {
        toast('Не удалось снять кадры для GIF');
      }
      return null;
    }

    const encoded = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (pending) {
          pending = null;
          resolve({ ok: false, error: 'timeout' });
        }
      }, 60000);

      pending = (result) => {
        clearTimeout(timeout);
        pending = null;
        resolve(result);
      };

      const view = ensureWorker();
      const send = () => view.webContents.send('octo:gif-job', captured);
      if (view.webContents.isLoading()) view.webContents.once('did-finish-load', send);
      else send();
    });

    if (!encoded || !encoded.ok) {
      toast(`Не удалось создать GIF: ${encoded && encoded.error ? encoded.error : 'ошибка'}`);
      return null;
    }

    try {
      return await saveGif(Buffer.from(encoded.base64, 'base64'));
    } catch (err) {
      toast(`Не удалось сохранить GIF: ${err.message}`);
      return null;
    }
  } finally {
    busy = false;
  }
}

ipcMain.on('octo:gif-done', (event, result) => {
  if (!worker || worker.isDestroyed() || event.sender !== worker.webContents) return;
  if (typeof pending === 'function') pending(result);
});

sync();

module.exports = { exportGif, setDuration, setFps, setWidth, sync };
