'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Язык интерфейса нужен общему переводчику i18n-dom.js. */
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

/** Мост окна аннотаций: картинка входит, PNG выходит. */
contextBridge.exposeInMainWorld('octoAnnotate', {
  onImage(callback) {
    ipcRenderer.on('octo:annotate-image', (_event, image) => callback(image));
  },
  save(dataUrl, name) {
    ipcRenderer.send('octo:annotate-save', { dataUrl, name });
  },
  close() {
    ipcRenderer.send('octo:annotate-close');
  },
});

contextBridge.exposeInMainWorld('octoWindow', {
  control(action) {
    ipcRenderer.send('octo:win-control', action);
  },
  state() {
    return ipcRenderer.sendSync('octo:win-state');
  },
  onState(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:win-state', listener);
    return () => ipcRenderer.removeListener('octo:win-state', listener);
  },
});
