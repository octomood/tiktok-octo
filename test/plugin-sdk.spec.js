'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { createOctoMock } = require('../plugins/sdk/octo-mock.js');
const { validateManifest } = require('../src/main/plugins/manifest');
const { LIMITS } = require('../src/main/plugins/constants');

/**
 * SDK плагинов без Electron: мок моста и генератор стартового плагина.
 * Манифест сгенерированного шаблона проходит настоящую валидацию.
 */

test('мок octo: команды, настройки, хранилище и хуки', async () => {
  const mock = createOctoMock({
    id: 'app.test.mock',
    settings: { greeting: 'Привет' },
  });
  const { octo, state, emit } = mock;

  expect(octo.apiVersion).toBe(1);
  expect(octo.plugin.id).toBe('app.test.mock');
  expect(octo.settings.get().greeting).toBe('Привет');

  expect(await octo.storage.get('missing')).toBeNull();
  await octo.storage.set('key', { value: 1 });
  expect(await octo.storage.get('key')).toEqual({ value: 1 });
  await octo.storage.remove('key');
  expect(await octo.storage.get('key')).toBeNull();

  await octo.commands.add({ id: 'hello', title: 'Hello', run: () => {} });
  expect(state.commands.has('hello')).toBe(true);
  await octo.commands.remove('hello');
  expect(state.commands.has('hello')).toBe(false);

  await octo.ui.panelRow({ id: 'row', label: 'Строка', run: () => {} });
  expect(state.panelRows.has('row')).toBe(true);

  await octo.shortcuts.add({ id: 'key', accelerator: 'Ctrl+Shift+9', run: () => {} });
  expect(state.shortcuts.has('key')).toBe(true);

  await octo.secrets.set('token', 'abc');
  expect(await octo.secrets.get('token')).toBe('abc');
  expect(await octo.secrets.get('missing')).toBeNull();

  await octo.page.injectCSS('body { color: red; }');
  expect(state.css).toHaveLength(1);
  expect(await octo.page.run('return 42;')).toBeNull();

  await expect(octo.net.fetch('https://example.com')).rejects.toThrow();

  await octo.notify('Привет');
  expect(state.notifications).toEqual(['Привет']);

  // Новые API: плеер, лента, загрузки, плашка, язык и буфер.
  await octo.playback.seek(8);
  expect((await octo.playback.status()).time).toBe(8);
  await octo.playback.setVolume(0.3);
  expect((await octo.playback.status()).volume).toBe(0.3);
  await octo.feed.next();
  expect(state.playback.feed).toBe(1);
  await octo.downloads.add('https://www.tiktok.com/@octo/video/1');
  expect(state.downloads).toHaveLength(1);
  const overlay = await octo.ui.overlay.show({ text: 'Тест' });
  expect(state.overlays.get(overlay.id)).toBe('Тест');
  await octo.ui.overlay.hide(overlay.id);
  expect(state.overlays.size).toBe(0);
  expect((await octo.i18n.get()).locale).toBe('ru');
  await octo.clipboard.write('скопировано');
  expect(state.clipboard()).toBe('скопировано');

  let activated = 0;
  octo.onActivate(() => {
    activated += 1;
  });
  await emit('activate');
  expect(activated).toBe(1);
});

test('plugin:new создаёт плагин с валидным манифестом', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-sdk-'));

  try {
    const target = path.join(workspace, 'my-plugin');
    execFileSync(
      process.execPath,
      [
        path.join(__dirname, '..', 'scripts', 'create-plugin.js'),
        target,
        '--id',
        'app.example.my-plugin',
        '--name',
        'My plugin',
      ],
      { cwd: path.join(__dirname, '..'), stdio: 'pipe' },
    );

    const files = fs.readdirSync(target).sort();
    expect(files).toEqual(['README.md', 'index.js', 'plugin.json']);

    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'plugin.json'), 'utf8'));
    expect(manifest.id).toBe('app.example.my-plugin');
    expect(manifest.name).toBe('My plugin');
    expect(manifest.main).toBe('index.js');
    expect(manifest.settings).toHaveLength(1);
    expect(manifest.permissions).toEqual([]);
    expect(validateManifest(manifest).ok).toBe(true);

    const source = fs.readFileSync(path.join(target, 'index.js'), 'utf8');
    expect(source).toContain('octo.commands.add');
    expect(source).toContain('octo.ui.panelRow');
    expect(source).toContain('octo.storage.set');

    // Повторная генерация в занятую папку запрещена.
    let failed = false;
    try {
      execFileSync(
        process.execPath,
        [path.join(__dirname, '..', 'scripts', 'create-plugin.js'), target],
        { cwd: path.join(__dirname, '..'), stdio: 'pipe' },
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('типы SDK описывают реальные лимиты и API', () => {
  const types = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'sdk', 'octo.d.ts'), 'utf8');
  for (const api of [
    'settings',
    'storage',
    'commands',
    'panelRow',
    'contextMenu',
    'shortcuts',
    'secrets',
    'injectCSS',
    'run<',
    'net',
    'navigate',
    'openExternal',
    'notify',
    'playback',
    'feed',
    'downloads',
    'overlay',
    'clipboard',
  ]) {
    expect(types).toContain(api);
  }
  expect(types).toContain('256 КБ');
  expect(types).toContain('10 секунд');
  expect(LIMITS.storageBytes).toBe(256 * 1024);
  expect(LIMITS.maxCommands).toBe(64);
  expect(LIMITS.maxPanelRows).toBe(64);
});
