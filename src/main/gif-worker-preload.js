'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Скрытое окно-кодировщик GIF: кадры входят, base64 выходит. */
contextBridge.exposeInMainWorld('gifWorker', {
  onJob(callback) {
    ipcRenderer.on('octo:gif-job', (_event, job) => callback(job));
  },
  done(result) {
    ipcRenderer.send('octo:gif-done', result);
  },
});
