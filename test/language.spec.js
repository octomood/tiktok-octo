'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Язык оболочки и языка сайта.
 *
 * Сайт не грузим: проверяем панель, меню, cookie default_lang и RTL. Для
 * TikTok язык задаётся cookie + Accept-Language, поэтому сеть тесту не нужна.
 */

async function waitForWindow(app, predicate) {
  let page = app.windows().find(predicate);
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    page = app.windows().find(predicate);
  }
  return page;
}

function waitForFileWindow(app) {
  return waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
}

function launch(userData) {
  return electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
    },
  });
}

test('язык интерфейса и сайта переключается и сохраняется', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-language-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await page.click('#btnPanel');
    await page.click('[data-cat-head="language"]');
    await expect(page.locator('#catLanguage')).toBeVisible();
    await expect(page.locator('#appLanguageSelect')).toHaveValue('ru');
    await expect(page.locator('#siteLanguageSelect')).toHaveValue('auto');

    // Интерфейс: панель и нативное меню переходят на немецкий.
    await page.selectOption('#appLanguageSelect', 'de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('[data-cat="page"] .panel-cat-title')).toHaveText('Seite');
    await expect(page.locator('[data-cat="language"] .panel-cat-title')).toHaveText('Sprache');
    await expect(page.locator('#panelHeadTitle')).toHaveText('Einstellungen');
    await expect(page.locator('[data-cat-head="language"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.locator('.panel-group').first()).toHaveText('Anzeige');

    const menu = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().items.map((item) => item.label),
    );
    expect(menu).toContain('Datei');
    expect(menu).toContain('Sprache');

    // Менеджер плагинов — отдельное окно, словарь приходит через свой preload.
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(app, (candidate) =>
      candidate.url().includes('plugins.html'),
    );
    expect(manager, 'окно менеджера плагинов не появилось').toBeTruthy();
    await expect(manager.locator('h1')).toHaveText('Plugins');
    await expect(manager.locator('[data-tab="settings"] span:not(.nav-badge)')).toHaveText(
      'Einstellungen',
    );

    // Язык сайта: cookie default_lang и состояние селекта.
    await page.selectOption('#siteLanguageSelect', 'de');
    await expect(page.locator('#siteLanguageSelect')).toHaveValue('de');
    const cookies = await app.evaluate(({ session }) =>
      session.fromPartition('persist:octo-tiktok').cookies.get({ name: 'default_lang' }),
    );
    expect(cookies.some((cookie) => cookie.value === 'de')).toBe(true);

    // Арабский включает RTL.
    await page.evaluate(() => window.octo.cmd('language', 'ar'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-cat="language"] .panel-cat-title')).toHaveText('اللغة');

    // Возвращаем немецкий и проверяем сохранение после перезапуска.
    await page.evaluate(() => window.octo.cmd('language', 'de'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await app.close();
    app = null;

    app = await launch(userData);
    await app.firstWindow();
    const restarted = await waitForFileWindow(app);
    await expect(restarted.locator('html')).toHaveAttribute('lang', 'de');
    await expect(restarted.locator('#panelVersion')).toContainText('v');
    if (await restarted.locator('#panel').evaluate((node) => node.hidden)) {
      await restarted.click('#btnPanel');
    }
    await expect(restarted.locator('#panel')).not.toHaveAttribute('hidden', '');
    await restarted.click('[data-cat-head="language"]');
    await expect(restarted.locator('#appLanguageSelect')).toHaveValue('de');
    await expect(restarted.locator('#siteLanguageSelect')).toHaveValue('de');
    const savedCookies = await app.evaluate(({ session }) =>
      session.fromPartition('persist:octo-tiktok').cookies.get({ name: 'default_lang' }),
    );
    expect(savedCookies.some((cookie) => cookie.value === 'de')).toBe(true);
  } finally {
    await app?.close();
  }
});
