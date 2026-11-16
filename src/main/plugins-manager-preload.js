'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост менеджера плагинов. Renderer не получает Node и не может сам
 * скачивать/распаковывать пакеты — только просить main выполнить действие.
 */

contextBridge.exposeInMainWorld('octoPlugins', {
  platform: process.platform,
  i18n: ipcRenderer.sendSync('octo:i18n'),
  onI18n(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:i18n-changed', listener);
    return () => ipcRenderer.removeListener('octo:i18n-changed', listener);
  },
  action(action, payload) {
    return ipcRenderer.invoke('octo:plugins', action, payload);
  },
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('octo:plugins-state', listener);
    return () => ipcRenderer.removeListener('octo:plugins-state', listener);
  },
  ready() {
    return ipcRenderer.invoke('octo:plugins', 'ready');
  },
});
