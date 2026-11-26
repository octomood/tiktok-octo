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
  /** Словарь текущего языка; renderer переводит им текст и атрибуты DOM. */
  i18n: ipcRenderer.sendSync('octo:i18n'),
  onI18n(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:i18n-changed', listener);
    return () => ipcRenderer.removeListener('octo:i18n-changed', listener);
  },
  theme: ipcRenderer.sendSync('octo:theme'),
  themePalettes: ipcRenderer.sendSync('octo:theme-palettes'),
  onTheme(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:theme-changed', listener);
    return () => ipcRenderer.removeListener('octo:theme-changed', listener);
  },
  cmd(command, payload) {
    ipcRenderer.send('octo:cmd', command, payload);
  },
  find(action, text) {
    ipcRenderer.send('octo:find', { action, text });
  },
  /** Свой CSS/JS живёт в main и в pushState не ездит: забираем по запросу. */
  customCode() {
    return ipcRenderer.sendSync('octo:custom-code');
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
  /** Открыть панель на конкретной категории (например, «Регион»). */
  onPanelCategory(callback) {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('octo:panel-category', listener);
    return () => ipcRenderer.removeListener('octo:panel-category', listener);
  },
  onPluginDialog(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('octo:plugin-dialog', listener);
    return () => ipcRenderer.removeListener('octo:plugin-dialog', listener);
  },
  replyPluginDialog(payload) {
    ipcRenderer.send('octo:plugin-dialog-result', payload);
  },
  ready() {
    ipcRenderer.send('octo:ready');
  },
});

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
