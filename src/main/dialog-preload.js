'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост для отдельного безрамочного окна диалога (используется, когда
 * главное окно скрыто в трее или диалог открыт поверх дочернего окна).
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
  onAppDialog(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:app-dialog', listener);
    return () => ipcRenderer.removeListener('octo:app-dialog', listener);
  },
  replyAppDialog(payload) {
    ipcRenderer.send('octo:app-dialog-result', payload);
  },
  appDialogReady() {
    ipcRenderer.send('octo:app-dialog-ready');
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
