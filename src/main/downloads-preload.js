'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост для отдельного окна «Менеджер загрузок».
 *
 * Окно не видит Node: только список загрузок и команды паузы/продолжения.
 * `window.octo` с i18n нужен общему переводчику i18n-dom.js.
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

contextBridge.exposeInMainWorld('octoManager', {
  onState(callback) {
    const listener = (_event, list) => callback(Array.isArray(list) ? list : []);
    ipcRenderer.on('octo:downloads', listener);
    return () => ipcRenderer.removeListener('octo:downloads', listener);
  },
  pause(id) {
    ipcRenderer.send('octo:downloads-pause', id);
  },
  resume(id) {
    ipcRenderer.send('octo:downloads-resume', id);
  },
  cancel(id) {
    ipcRenderer.send('octo:downloads-cancel', id);
  },
  show(id) {
    ipcRenderer.send('octo:downloads-show', id);
  },
  extractAudio(id) {
    ipcRenderer.send('octo:downloads-audio', id);
  },
  clear() {
    ipcRenderer.send('octo:downloads-clear');
  },
  openFolder() {
    ipcRenderer.send('octo:downloads-folder');
  },
  close() {
    ipcRenderer.send('octo:downloads-close');
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
