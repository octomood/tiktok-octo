'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { createZip } = require('../src/main/plugins/zip');

/**
 * Установщик проверяется без Electron: подменяем только файловые пути и
 * хранилище состояния, а распаковка, аудит, запись и проверка целостности —
 * настоящие.
 */

function rawManifest(version = '1.0.0') {
  return {
    id: 'app.octo.install-test',
    name: 'Install test',
    version,
    apiVersion: 1,
    minAppVersion: '0.5.0',
    description: 'Проверка установки',
    author: { name: 'octo' },
    license: 'MIT',
    main: 'index.js',
    permissions: ['page:css'],
    settings: [
      {
        key: 'greeting',
        type: 'string',
        title: 'Приветствие',
        default: 'Привет',
      },
    ],
  };
}

function packageBuffer(version = '1.0.0') {
  return createZip(
    new Map([
      ['plugin.json', JSON.stringify(rawManifest(version))],
      ['index.js', "octo.page.injectCSS('body { color: red; }');"],
      ['README.md', '# Test'],
    ]),
  );
}

test('установка, обновление с сохранением настроек, проверка и удаление', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-installer-'));
  const pluginsDir = path.join(root, 'plugins');
  const records = {};

  const state = require('../src/main/plugins/state');
  state.pluginsDir = () => pluginsDir;
  state.pluginDir = (id) => path.join(pluginsDir, id);
  state.versionsDir = (id) => path.join(pluginsDir, '.versions', id);
  state.ensureDirs = () => fs.mkdirSync(pluginsDir, { recursive: true });
  state.get = (id) => records[id] || null;
  state.stats = () => ({ installed: Object.keys(records).length, limit: 24 });
  state.set = (record) => {
    records[record.id] = record;
  };
  state.remove = (id) => {
    delete records[id];
    return true;
  };
  state.removePluginDir = (id) => {
    fs.rmSync(path.join(pluginsDir, id), { recursive: true, force: true });
    return true;
  };

  try {
    const installer = require('../src/main/plugins/installer');
    const id = 'app.octo.install-test';

    const inspection = installer.inspectPackage(packageBuffer('1.0.0'));
    expect(inspection.ok, inspection.error).toBe(true);
    expect(inspection.report.verdict).toBe('safe');

    const installed = installer.install(inspection, { source: 'file' });
    expect(installed.ok, installed.error).toBe(true);
    expect(records[id]).toBeTruthy();
    expect(records[id].enabled).toBe(true);
    expect(records[id].signature).toBe('unsigned');
    expect(records[id].settings.greeting).toBe('Привет');

    const filesPath = path.join(pluginsDir, id);
    expect(fs.existsSync(path.join(filesPath, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(filesPath, 'plugin.json'))).toBe(true);
    expect(installer.verifyInstalled(records[id]).ok).toBe(true);

    // Обновление сохраняет настройки, хранилище и включённость.
    records[id].settings.greeting = 'Своё приветствие';
    records[id].storage = { counter: 3 };
    const update = installer.inspectPackage(packageBuffer('1.0.1'));
    expect(update.ok, update.error).toBe(true);
    const updated = installer.install(update, { source: 'file' });
    expect(updated.ok, updated.error).toBe(true);
    expect(records[id].version).toBe('1.0.1');
    expect(records[id].enabled).toBe(true);
    expect(records[id].settings.greeting).toBe('Своё приветствие');
    expect(records[id].storage.counter).toBe(3);
    expect(records[id].history.map((item) => item.version)).toContain('1.0.0');

    // Откат возвращает старые файлы, сохраняя данные плагина.
    const rolled = installer.rollback(id, '1.0.0');
    expect(rolled.ok, rolled.error).toBe(true);
    expect(records[id].version).toBe('1.0.0');
    expect(records[id].settings.greeting).toBe('Своё приветствие');
    expect(records[id].storage.counter).toBe(3);
    expect(records[id].history.map((item) => item.version)).toContain('1.0.1');
    expect(installer.verifyInstalled(records[id]).ok).toBe(true);

    // Ручная правка файла ловится проверкой целостности.
    fs.appendFileSync(path.join(filesPath, 'index.js'), '\n// tampered\n');
    const integrity = installer.verifyInstalled(records[id]);
    expect(integrity.ok).toBe(false);
    expect(integrity.reason).toBe('tampered');

    installer.remove(id);
    expect(records[id]).toBeUndefined();
    expect(fs.existsSync(filesPath)).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
