'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Мост для отдельного окна обновления.
 *
 * Окно не видит Node и не знает, откуда берётся релиз: только состояние от
 * main и три команды — обновить, перезапустить, закрыть.
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
});

contextBridge.exposeInMainWorld('octoUpdate', {
  onState(callback) {
    const listener = (_event, next) => callback(next && typeof next === 'object' ? next : {});
    ipcRenderer.on('octo:update-state', listener);
    return () => ipcRenderer.removeListener('octo:update-state', listener);
  },
  install() {
    ipcRenderer.send('octo:update-install');
  },
  restart() {
    ipcRenderer.send('octo:update-restart');
  },
  close() {
    ipcRenderer.send('octo:update-close');
  },
});
