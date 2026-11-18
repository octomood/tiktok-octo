'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Каталог: сортировка, счётчик установок и diff разрешений между версиями.
 * Каталог подменяется локальным registry.json, сеть не нужна.
 */

function release(version, permissions, publishedAt) {
  return {
    version,
    minAppVersion: '0.5.0',
    download: `https://example.test/plugin-${version}.octoplugin`,
    sha256: 'a'.repeat(64),
    size: 1024,
    publishedAt,
    permissions,
    networkHosts: [],
  };
}

const REGISTRY = {
  schema: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  plugins: [
    {
      id: 'app.test.alpha',
      name: 'Alpha plugin',
      author: { name: 'octo' },
      description: 'Плагин с двумя версиями',
      license: 'MIT',
      categories: ['demo'],
      installs: 42,
      releases: [
        release('2.0.0', ['page:css', 'page:script'], '2026-02-01T00:00:00.000Z'),
        release('1.0.0', ['page:css'], '2026-01-01T00:00:00.000Z'),
      ],
    },
    {
      id: 'app.test.beta',
      name: 'Beta plugin',
      author: { name: 'octo' },
      description: 'Плагин с одной версией',
      license: 'MIT',
      categories: ['demo'],
      installs: 7,
      releases: [release('1.0.0', ['page:css'], '2026-03-01T00:00:00.000Z')],
    },
  ],
};

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('каталог: сортировка, установки и diff разрешений', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-catalog-'));
  const registryFile = path.join(userData, 'registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(REGISTRY, null, 2));

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_PLUGIN_REGISTRY_FILE: registryFile,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );

    await manager.locator('#btnRefresh').click();
    const cards = manager.locator('#catalogList .card');
    await expect(cards).toHaveCount(2, { timeout: 15000 });

    // Установки и diff разрешений видны в карточке.
    const alpha = cards.filter({ hasText: 'Alpha plugin' });
    await expect(alpha).toContainText('установок: 42');
    await expect(alpha).toContainText('Изменения разрешений к прошлой версии');
    await expect(alpha).toContainText('+ Скрипты на странице');
    // У плагина без подписи нет бейджа «проверено».
    await expect(alpha).not.toContainText('проверено');

    // Сортировка по установкам: Alpha (42) выше Beta (7).
    await manager.locator('#catalogSort').selectOption('installs');
    await expect(manager.locator('#catalogList .card .card-title').first()).toHaveText(
      'Alpha plugin',
    );

    // По дате: Beta опубликован позже.
    await manager.locator('#catalogSort').selectOption('date');
    await expect(manager.locator('#catalogList .card .card-title').first()).toHaveText(
      'Beta plugin',
    );

    // По названию: Alpha снова первая.
    await manager.locator('#catalogSort').selectOption('name');
    await expect(manager.locator('#catalogList .card .card-title').first()).toHaveText(
      'Alpha plugin',
    );

    // Поиск работает вместе с сортировкой.
    await manager.locator('#search').fill('beta');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Beta plugin');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
