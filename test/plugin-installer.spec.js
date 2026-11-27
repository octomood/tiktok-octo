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

function trustManifest({ version = '1.0.0', author = 'octo', permissions = ['page:css'], hosts }) {
  return {
    ...rawManifest(version),
    author: { name: author },
    permissions,
    ...(hosts ? { networkHosts: hosts } : {}),
  };
}

function trustPackage(manifest, privateKey) {
  const files = new Map([
    ['plugin.json', Buffer.from(JSON.stringify(manifest))],
    ['index.js', Buffer.from("octo.page.injectCSS('body { color: red; }');")],
  ]);
  if (privateKey) {
    const { createSignatureManifest } = require('../src/main/plugins/signature');
    files.set(
      'SIGNATURE.json',
      Buffer.from(
        createSignatureManifest(privateKey, {
          id: manifest.id,
          version: manifest.version,
          files,
        }),
      ),
    );
  }
  return createZip(files);
}

test('обновление файлом: смена издателя не получает данные старой версии', () => {
  const crypto = require('node:crypto');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-update-trust-'));
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

  const pem = (key) => key.export({ type: 'spki', format: 'pem' });
  const official = crypto.generateKeyPairSync('ed25519');
  const other = crypto.generateKeyPairSync('ed25519');
  const keys = [pem(official.publicKey), pem(other.publicKey)];

  try {
    const installer = require('../src/main/plugins/installer');
    const { compareUpdate } = require('../src/main/plugins/update-trust');
    const id = 'app.octo.install-test';
    const fill = () => {
      records[id].settings.greeting = 'Своё';
      records[id].storage = { counter: 7 };
      records[id].secrets = { token: 'encrypted' };
    };
    const inspect = (manifest, key) => {
      const result = installer.inspectPackage(trustPackage(manifest, key), { publicKeys: keys });
      expect(result.ok, result.error).toBe(true);
      return result;
    };

    // Старая запись без поля publisher (как у уже установленных плагинов).
    expect(installer.install(inspect(trustManifest({})), { source: 'file' }).ok).toBe(true);
    delete records[id].publisher;
    delete records[id].dataId;
    fill();

    // Тот же автор без подписи — данные переходят, как раньше; новые права и хосты видны.
    const sameAuthor = inspect(
      trustManifest({
        version: '1.1.0',
        permissions: ['page:css', 'network'],
        hosts: ['api.example.com'],
      }),
    );
    const diff = compareUpdate(records[id], sameAuthor);
    expect(diff.publisherChanged).toBe(false);
    expect(diff.unverified).toBe(true);
    expect(diff.addedPermissions).toEqual(['network']);
    expect(diff.addedHosts).toEqual(['api.example.com']);
    let result = installer.install(sameAuthor, { source: 'file' });
    expect(result.dataKept).toBe(true);
    expect(records[id].storage.counter).toBe(7);
    expect(records[id].secrets.token).toBe('encrypted');

    // Чужой автор без подписи — ставится как новый плагин, данных нет.
    const stranger = inspect(trustManifest({ version: '1.2.0', author: 'mallory' }));
    expect(compareUpdate(records[id], stranger).reason).toBe('author-changed');
    result = installer.install(stranger, { source: 'file' });
    expect(result.ok, result.error).toBe(true);
    expect(result.dataKept).toBe(false);
    expect(records[id].storage).toEqual({});
    expect(records[id].secrets).toEqual({});
    expect(records[id].settings.greeting).toBe('Привет');

    // Откат на версию прежнего издателя возвращает её данные.
    expect(installer.rollback(id, '1.1.0').ok).toBe(true);
    expect(records[id].storage.counter).toBe(7);
    expect(records[id].secrets.token).toBe('encrypted');
    expect(records[id].settings.greeting).toBe('Своё');
    expect(records[id].publisher.author).toBe('octo');

    // Переход на подпись тем же автором — данные сохраняются, ключ закрепляется.
    const signed = inspect(trustManifest({ version: '2.0.0' }), official.privateKey);
    expect(signed.signature).toBe('verified');
    expect(signed.signer).toMatch(/^[0-9a-f]{64}$/);
    expect(compareUpdate(records[id], signed).signedNow).toBe(true);
    expect(installer.install(signed, { source: 'file' }).dataKept).toBe(true);
    expect(records[id].publisher.key).toBe(signed.signer);
    expect(records[id].storage.counter).toBe(7);

    // Тот же ключ — данные переходят; понижение версии видно.
    const older = inspect(trustManifest({ version: '1.9.0' }), official.privateKey);
    expect(compareUpdate(records[id], older)).toMatchObject({
      publisherChanged: false,
      downgrade: true,
    });

    // Другой доверенный ключ или потеря подписи при том же имени автора — смена издателя.
    const otherKey = inspect(trustManifest({ version: '2.1.0' }), other.privateKey);
    expect(compareUpdate(records[id], otherKey).reason).toBe('key-changed');
    const unsigned = inspect(trustManifest({ version: '2.1.0' }));
    expect(compareUpdate(records[id], unsigned).reason).toBe('signature-lost');
    result = installer.install(unsigned, { source: 'file' });
    expect(result.dataKept).toBe(false);
    expect(records[id].storage).toEqual({});
    expect(records[id].secrets).toEqual({});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
