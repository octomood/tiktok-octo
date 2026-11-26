'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Приватность: размеры локальных данных, удаление по пунктам, диагностика без
 * путей и токенов, лицензии и честная страница «не связан с TikTok».
 */

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
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

function diagnosticsFile(dir) {
  if (!fs.existsSync(dir)) return '';
  const name = fs
    .readdirSync(dir)
    .filter((item) => /^tiktok-octo-diagnostics-.*\.txt$/.test(item))
    .sort()
    .at(-1);
  return name ? path.join(dir, name) : '';
}

test('приватность: локальные данные, удаление, диагностика и лицензии', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-privacy-'));
  const diagnosticsDir = path.join(userData, 'diagnostics');
  const backupDir = path.join(userData, 'backups');
  const stateFile = path.join(userData, 'octo-state.json');

  fs.writeFileSync(
    stateFile,
    JSON.stringify(
      {
        library: {
          items: [
            {
              id: 'item-1',
              url: 'https://www.tiktok.com/@octo/video/123',
              author: '@octo',
              title: 'Тестовый ролик',
              time: 12,
              note: '',
              savedAt: 1,
            },
          ],
          queue: ['item-1'],
          auto: false,
        },
        stats: {
          days: {
            '2026-11-18': { ms: 60000, videos: 1, authors: { '@octo': 1 } },
          },
        },
        replies: ['привет', 'пока'],
        adsSkipped: 3,
        adJournal: [{ at: 1, url: 'https://www.tiktok.com/@octo/video/123' }],
        region: { preset: 'off', proxy: 'socks5://user:pass@127.0.0.1:1080' },
        language: 'ru',
        siteLanguage: 'auto',
        cosmetics: { 'dark-theme': true },
        zoomFactor: 1,
      },
      null,
      2,
    ),
  );

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_DIAGNOSTICS_DIR: diagnosticsDir,
        OCTO_BACKUP_DIR: backupDir,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    const rows = page.locator('#privacyList .privacy-row');
    await expect(rows).toHaveCount(7, { timeout: 15000 });
    await expect(page.locator('#privacySize')).not.toHaveText('');

    const libraryRow = rows.filter({ hasText: 'Библиотека и очередь' });
    await expect(libraryRow).toContainText('Закладок: 1');
    await expect(rows.filter({ hasText: 'Cookies и кэш TikTok' })).toHaveCount(1);
    // Плагины не удаляются одной кнопкой, остальные разделы — да.
    await expect(rows.filter({ hasText: 'Плагины' }).first().locator('button')).toHaveCount(0);

    // --- Диагностика --------------------------------------------------------
    await page.evaluate(() => window.octo.cmd('diagnosticsCopy'));
    const diagFile = await waitForValue(
      () => diagnosticsFile(diagnosticsDir),
      (value) => Boolean(value),
      'файл диагностики',
    );
    const diagnostics = fs.readFileSync(diagFile, 'utf8');
    expect(diagnostics).toContain('TikTok Octo');
    expect(diagnostics).toContain('Electron');
    expect(diagnostics).toContain('Профиль: ~');
    expect(diagnostics).not.toContain(os.homedir());
    expect(diagnostics).not.toContain('user:pass');
    expect(diagnostics).not.toContain('socks5://');
    expect(diagnostics).toContain('Cookies, токены, переписка');

    // --- Лицензии и дисклеймер ---------------------------------------------
    await page.evaluate(() => window.octo.cmd('showLicenses'));
    const licensesFile = await waitForValue(
      () => path.join(diagnosticsDir, 'licenses.txt'),
      (file) => fs.existsSync(file),
      'файл лицензий',
    );
    const licenses = fs.readFileSync(licensesFile, 'utf8');
    expect(licenses).toContain('TikTok Octo — MIT');
    expect(licenses).toContain('acorn');
    expect(licenses).toContain('MIT');

    await page.evaluate(() => window.octo.cmd('showDisclaimer'));
    const disclaimerFile = await waitForValue(
      () => path.join(diagnosticsDir, 'disclaimer.txt'),
      (file) => fs.existsSync(file),
      'страница «не связан с TikTok»',
    );
    const disclaimer = fs.readFileSync(disclaimerFile, 'utf8');
    expect(disclaimer).toContain('TikTok Ltd.');
    expect(disclaimer).toContain('остаются на устройстве');

    // --- Удаление по пунктам ------------------------------------------------
    // Удаление идёт кликом по строке панели, а не только командой.
    await page.locator('#btnPanel').click();
    await page.locator('[data-cat-head="privacy"]').click();
    await page.locator('[data-cmd="privacyDelete"][data-id="replies"]').click();
    await waitForValue(
      () => readJson(stateFile).replies,
      (value) => Array.isArray(value) && value.length === 0,
      'быстрые ответы удалены',
    );
    await expect(rows.filter({ hasText: 'Быстрые ответы' })).toContainText('Шаблонов: 0');

    await page.evaluate(() => window.octo.cmd('privacyDelete', { id: 'library' }));
    await waitForValue(
      () => readJson(stateFile).library.items,
      (value) => Array.isArray(value) && value.length === 0,
      'библиотека удалена',
    );

    await page.evaluate(() => window.octo.cmd('privacyDelete', { id: 'stats' }));
    await waitForValue(
      () => readJson(stateFile).stats.days,
      (value) => value && Object.keys(value).length === 0,
      'статистика удалена',
    );

    await page.evaluate(() => window.octo.cmd('privacyDelete', { id: 'ads' }));
    await waitForValue(
      () => readJson(stateFile).adJournal,
      (value) => Array.isArray(value) && value.length === 0,
      'журнал рекламы удалён',
    );

    // Ежедневная копия появилась при запуске — удаляем её из панели.
    await waitForValue(
      () => (fs.existsSync(backupDir) ? fs.readdirSync(backupDir).length : 0),
      (value) => value > 0,
      'ежедневная копия',
    );
    await page.evaluate(() => window.octo.cmd('privacyDelete', { id: 'backups' }));
    await waitForValue(
      () => (fs.existsSync(backupDir) ? fs.readdirSync(backupDir).length : 0),
      (value) => value === 0,
      'копии удалены',
    );
    await expect(rows.filter({ hasText: 'Резервные копии' })).toContainText('Копий: 0');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
