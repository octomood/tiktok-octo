'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { validateManifest } = require('../src/main/plugins/manifest');

/**
 * Косметические паки: манифест разрешает только CSS, превью включает пакет на
 * время и возвращает его обратно, откат версий — общий механизм плагинов.
 */

function manifest(overrides = {}) {
  return {
    id: 'app.octo.cosmetic',
    name: 'Cosmetic test',
    version: '1.0.0',
    apiVersion: 1,
    description: 'Косметический пак для теста',
    author: { name: 'octo' },
    license: 'MIT',
    main: 'index.js',
    cosmetic: true,
    permissions: ['page:css'],
    ...overrides,
  };
}

test('манифест косметического пака: только page:css', () => {
  expect(validateManifest(manifest()).ok).toBe(true);

  const noCss = validateManifest(manifest({ permissions: [] }));
  expect(noCss.ok).toBe(false);
  expect(noCss.errors.join(' ')).toContain('page:css');

  const withScript = validateManifest(manifest({ permissions: ['page:css', 'page:script'] }));
  expect(withScript.ok).toBe(false);
  expect(withScript.errors.join(' ')).toContain('нельзя');
});

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('косметический пак: бейдж, выключение и превью', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-cosmetic-'));
  const devDir = path.join(userData, 'dev-plugins');
  const pluginDir = path.join(devDir, 'cosmetic');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest(), null, 2));
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `'use strict';
octo.onActivate(async () => {
  await octo.page.injectCSS('body { background-color: rgb(10, 20, 30) !important; }');
});
`,
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
        OCTO_PLUGIN_DEV_DIR: devDir,
        OCTO_PLUGIN_PREVIEW_MS: '500',
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor), {
        timeout: 10000,
      })
      .toBe('rgb(10, 20, 30)');

    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = page.locator('#pluginsPanel');
    await expect(manager).toBeVisible();
    await manager.locator('[data-tab="installed"]').click();

    const card = manager.locator('.card--wide').filter({ hasText: 'Cosmetic test' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('косметика');

    await card.locator('[data-act="enable"]').click();
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .not.toBe('rgb(10, 20, 30)');

    await expect(card.locator('[data-act="enable"]')).toHaveAttribute('aria-checked', 'false');
    const preview = card.locator('button').filter({ hasText: 'Превью' });
    await expect(preview).toBeVisible();
    await preview.click();
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor), {
        timeout: 8000,
      })
      .toBe('rgb(10, 20, 30)');

    // Превью живёт полсекунды и снимает пакет само.
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor), {
        timeout: 8000,
      })
      .not.toBe('rgb(10, 20, 30)');
    await expect(card.locator('[data-act="enable"]')).toHaveAttribute('aria-checked', 'false');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
