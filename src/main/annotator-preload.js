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
