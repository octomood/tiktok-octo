'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { readZip } = require('../src/main/plugins/zip');

/**
 * Настройки одним JSON и резервные копии состояния.
 *
 * Экспорт пишется в OCTO_EXPORT_DIR, копии — в OCTO_BACKUP_DIR, диалоги
 * отключены через OCTO_E2E. Проверяем живое применение импорта, ежедневную
 * копию при повторном запуске и восстановление без перезапуска.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function waitForValue(read, check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await read();
    if (check(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`не дождались: ${label}`);
}

function settingsFile(dir) {
  const names = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => /^tiktok-octo-settings-.*\.json$/.test(name))
    : [];
  return names.length ? path.join(dir, names.sort().at(-1)) : '';
}

test('настройки: экспорт, импорт, ежедневная копия и восстановление', async () => {
  test.setTimeout(120_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-settings-'));
  const exportDir = path.join(userData, 'export');
  const backupDir = path.join(userData, 'backups');
  const archiveDir = path.join(userData, 'archive');
  const stateFile = path.join(userData, 'octo-state.json');
  const pluginsFile = path.join(userData, 'plugins-state.json');

  const launch = () =>
    electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_EXPORT_DIR: exportDir,
        OCTO_BACKUP_DIR: backupDir,
        OCTO_ARCHIVE_DIR: archiveDir,
      },
    });

  let app;

  try {
    app = await launch();
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    // Меняем настройку, чтобы появилось состояние.
    await page.evaluate(() => window.octo.cmd('zoomIn'));
    await waitForValue(
      () => (fs.existsSync(stateFile) ? readJson(stateFile).zoomFactor : 0),
      (value) => value > 1,
      'масштаб записан',
    );
    if (process.platform !== 'win32') {
      // В octo-state.json может лежать пароль прокси: только владелец.
      expect((fs.statSync(stateFile).mode & 0o777).toString(8)).toBe('600');
    }

    // Прокси с паролем: в живом состоянии он нужен целиком, в файлы — нет.
    const proxySecret = 'pa55word-not-exported';
    await page.evaluate(
      (address) => window.octo.cmd('regionProxyApply', address),
      `http://user:${proxySecret}@127.0.0.1:8080`,
    );
    await waitForValue(
      () => (fs.existsSync(stateFile) ? readJson(stateFile).region?.proxy : ''),
      (value) =>
        value === `http://user:${proxySecret}@127.0.0.1:8080` || value === 'http://127.0.0.1:8080',
      'прокси записан',
    );

    // Экспорт: файл появляется в OCTO_EXPORT_DIR без диалога.
    await page.evaluate(() => window.octo.cmd('settingsExport'));
    const exportedFile = await waitForValue(
      () => settingsFile(exportDir),
      (value) => Boolean(value),
      'файл настроек',
    );
    const exported = await readJson(exportedFile);

    expect(exported.kind).toBe('tiktok-octo-settings');
    expect(exported.schema).toBe(1);
    expect(exported.settings.zoomFactor).toBeGreaterThan(1);
    expect(exported.settings.keymap.profile).toBeTruthy();
    expect(exported.plugins).toHaveProperty('autoUpdate');
    expect(exported.plugins).toHaveProperty('registryUrl');
    expect(exported.settings.region.proxy).toBe('http://127.0.0.1:8080');
    expect(JSON.stringify(exported)).not.toContain(proxySecret);
    // В экспорт не попадают данные, которых там быть не должно.
    expect(exported.settings).not.toHaveProperty('library');
    expect(exported.settings).not.toHaveProperty('stats');
    expect(exported.settings).not.toHaveProperty('lastUrl');

    // Копия создаётся по кнопке и видна в панели.
    await page.evaluate(() => window.octo.cmd('backupNow'));
    const backupFile = await waitForValue(
      () => {
        if (!fs.existsSync(backupDir)) return '';
        const name = fs.readdirSync(backupDir).find((item) => item.endsWith('.json'));
        return name ? path.join(backupDir, name) : '';
      },
      (value) => Boolean(value),
      'резервная копия',
    );
    await expect(page.locator('#backupLatest')).not.toHaveText('—');
    expect(readJson(backupFile).state.region.proxy).toBe('http://127.0.0.1:8080');
    expect(fs.readFileSync(backupFile, 'utf8')).not.toContain(proxySecret);

    // «Мой архив» собирается через наш ZIP-ридер: пароля в settings.json нет.
    await page.evaluate(() => window.octo.cmd('archiveExport'));
    const archiveFile = await waitForValue(
      () => {
        if (!fs.existsSync(archiveDir)) return '';
        const name = fs.readdirSync(archiveDir).find((item) => item.endsWith('.zip'));
        return name ? path.join(archiveDir, name) : '';
      },
      (value) => Boolean(value),
      'архив',
    );
    const archive = readZip(fs.readFileSync(archiveFile));
    const archivedSettings = JSON.parse(archive.get('settings.json').toString('utf8'));
    expect(archivedSettings.region.proxy).toBe('http://127.0.0.1:8080');
    expect(archive.get('settings.json').toString('utf8')).not.toContain(proxySecret);

    // Импорт возвращает масштаб из файла и применяет его без перезапуска.
    await page.evaluate(() => window.octo.cmd('zoomReset'));
    await waitForValue(
      () => (fs.existsSync(stateFile) ? readJson(stateFile).zoomFactor : 0),
      (value) => value === 1,
      'масштаб сброшен',
    );
    await page.evaluate((file) => window.octo.cmd('settingsImport', { path: file }), exportedFile);
    await waitForValue(
      () => (fs.existsSync(stateFile) ? readJson(stateFile).zoomFactor : 0),
      (value) => value > 1,
      'импорт применён',
    );
    await expect(page.locator('#panelZoom')).toHaveText('110 %');

    // Битый файл не меняет настройки и не считается настройками.
    const broken = path.join(userData, 'broken.json');
    fs.writeFileSync(broken, '{ not json');
    await page.evaluate(() => window.octo.cmd('zoomReset'));
    await page.evaluate((file) => window.octo.cmd('settingsImport', { path: file }), broken);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(readJson(stateFile).zoomFactor).toBe(1);

    // Повторный запуск создаёт ежедневную копию, если за сегодня её ещё нет.
    fs.rmSync(backupDir, { recursive: true, force: true });
    await app.close();
    app = await launch();
    await app.firstWindow();
    const daily = await waitForValue(
      () => fs.readdirSync(backupDir).filter((name) => name.includes('-daily')),
      (names) => names.length > 0,
      'ежедневная копия',
    );
    expect(daily.length).toBeGreaterThan(0);

    const page2 = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка после перезапуска',
    );

    // Меняем масштаб и восстанавливаем последнюю копию без перезапуска.
    await page2.evaluate(() => window.octo.cmd('zoomIn'));
    await waitForValue(
      () => readJson(stateFile).zoomFactor,
      (value) => value === 1.1,
      'масштаб изменён перед восстановлением',
    );
    const beforeRestore = await waitForValue(
      () =>
        fs
          .readdirSync(backupDir)
          .filter((name) => name.endsWith('.json'))
          .map((name) => ({ name, file: path.join(backupDir, name) }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      (items) => items.length > 0,
      'список копий',
    );
    expect(beforeRestore.length).toBeGreaterThan(0);

    await page2.evaluate(() => window.octo.cmd('backupRestore', { restart: false }));
    await waitForValue(
      () => readJson(stateFile).zoomFactor,
      (value) => value === 1,
      'состояние восстановлено из копии',
    );
    // Копия хранит и настройки плагинов.
    expect(JSON.parse(fs.readFileSync(pluginsFile, 'utf8')).settings).toBeTruthy();

    // Импорт проверяет типы и отбрасывает небезопасные адреса каталогов.
    const custom = path.join(userData, 'custom-settings.json');
    fs.writeFileSync(
      custom,
      JSON.stringify({
        app: 'TikTok Octo',
        kind: 'tiktok-octo-settings',
        schema: 1,
        settings: {
          zoomFactor: 1.25,
          feedKeys: false,
          region: { preset: 'off', proxy: 'http://user:pa55word-import@127.0.0.1:9090' },
          replies: ['Привет', 'Куда пропал?'],
          focus: { enabled: false, minutes: 50, breakMinutes: 10 },
          sleep: { mode: 'off', endsAt: 0, videos: 3, minutes: 0, videosLeft: 0, fade: false },
        },
        plugins: {
          autoUpdate: false,
          updateIntervalHours: 24,
          registryUrls: ['http://evil.example/registry.json'],
        },
      }),
    );
    await page2.evaluate((file) => window.octo.cmd('settingsImport', { path: file }), custom);
    await waitForValue(
      () => readJson(stateFile).zoomFactor,
      (value) => value === 1.25,
      'импорт пользовательского файла',
    );
    const pluginSettings = await waitForValue(
      () => readJson(pluginsFile).settings,
      (settings) => settings.autoUpdate === false,
      'настройки плагинов импортированы',
    );
    expect(pluginSettings.updateIntervalHours).toBe(24);
    expect(pluginSettings.registryUrls).toEqual([]);
    expect(readJson(stateFile).feedKeys).toBe(false);

    // Импорт применяет быстрые ответы и лимиты Focus без перезапуска.
    await expect(page2.locator('#repliesInput')).toHaveValue('Привет\nКуда пропал?');
    await expect(page2.locator('#focusMinutes')).toHaveValue('50');
    // И новый прокси сразу уходит в сессию, а не ждёт перезапуска.
    // Пароль из файла отброшен: диалог импорта обещает их не импортировать.
    expect(readJson(stateFile).region.proxy).toBe('http://127.0.0.1:9090');
    await expect
      .poll(() =>
        app.evaluate(({ session }) =>
          session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
        ),
      )
      .toBe('PROXY 127.0.0.1:9090');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
