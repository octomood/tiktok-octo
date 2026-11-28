'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост для собственного контекстного меню поверх WebContentsView.
 */
contextBridge.exposeInMainWorld('octo', {
  i18n: ipcRenderer.sendSync('octo:i18n'),
  onI18n(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:i18n-changed', listener);
    return () => ipcRenderer.removeListener('octo:i18n-changed', listener);
  },
  theme: ipcRenderer.sendSync('octo:theme'),
  onTheme(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:theme-changed', listener);
    return () => ipcRenderer.removeListener('octo:theme-changed', listener);
  },
  uiCustom: ipcRenderer.sendSync('octo:ui-custom'),
  onUiCustom(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:ui-custom-changed', listener);
    return () => ipcRenderer.removeListener('octo:ui-custom-changed', listener);
  },
});

contextBridge.exposeInMainWorld('octoContextMenu', {
  onOpen(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:ctx-menu-open', listener);
    return () => ipcRenderer.removeListener('octo:ctx-menu-open', listener);
  },
  sendSize(payload) {
    ipcRenderer.send('octo:ctx-menu-size', payload);
  },
  pick(payload) {
    ipcRenderer.send('octo:ctx-menu-pick', payload);
  },
  close() {
    ipcRenderer.send('octo:ctx-menu-close');
  },
  ready() {
    ipcRenderer.send('octo:ctx-menu-ready');
  },
});
