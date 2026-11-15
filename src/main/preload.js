'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост в renderer-процесс (полоса заголовка).
 *
 * Важно: окно работает с sandbox: true, а в песочнице preload может
 * подключать только `electron` и встроенные модули — поэтому здесь нет
 * require('./shared') и никаких констант из других файлов.
 */
contextBridge.exposeInMainWorld('octo', {
  ui: {
    platform: process.platform,
    electron: process.versions.electron,
  },
  cmd(command, payload) {
    ipcRenderer.send('octo:cmd', command, payload);
  },
  find(action, text) {
    ipcRenderer.send('octo:find', { action, text });
  },
  /** Renderer сообщает, сколько места занимает его интерфейс (панель поиска). */
  setChromeHeight(height) {
    ipcRenderer.send('octo:chrome-height', height);
  },
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('octo:state', listener);
    return () => ipcRenderer.removeListener('octo:state', listener);
  },
  ready() {
    ipcRenderer.send('octo:ready');
  },
});
